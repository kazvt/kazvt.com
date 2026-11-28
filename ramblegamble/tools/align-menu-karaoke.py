#!/usr/bin/env python3
"""Offline authoring tool: Whisper transcription + forced alignment, never edits live files."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / 'assets/music/ramble-gamble-theme.mp3'
CUES = ROOT / 'menu-karaoke-cues.mjs'
SHA256 = '7485aa4feaf5557e2688b1ecf4fe448d96ec7e33d2388842096cd4d319258ec5'
DURATION = 198.288


def norm(word):
    return re.sub(r'[^a-z0-9]', '', word.casefold())


def load_cues():
    # The cue module is an exported JSON array, not executable input.
    return json.loads(CUES.read_text(encoding='utf-8').split('export const MENU_KARAOKE_CUES = ', 1)[1].strip().removesuffix(';'))


def flatten(result):
    return [w for seg in result['segments'] for w in seg.get('words', []) if norm(w['word'])]


def map_words(cues, aligned):
    """Map model token splits to the original exact spelling. No invented word times."""
    expected = [w[0] for c in cues for w in c['words']]
    mapped = []
    j = 0
    for token in expected:
        target = norm(token)
        combined = ''
        parts = []
        while j < len(aligned) and combined != target:
            w = aligned[j]
            j += 1
            combined += norm(w['word'])
            parts.append(w)
            if not target.startswith(combined):
                raise ValueError(f'Alignment text mismatch at {token!r}: {combined!r}. No candidate written.')
        if combined != target or not parts:
            raise ValueError(f'Missing alignment for {token!r}')
        start, end = float(parts[0]['start']), float(parts[-1]['end'])
        prob = [float(w['probability']) for w in parts if w.get('probability') is not None]
        if not (math.isfinite(start) and math.isfinite(end) and 0 <= start < end <= DURATION + .001):
            raise ValueError(f'Invalid acoustic timestamp for {token!r}: {start}–{end}')
        start, end = round(start, 3), min(DURATION, round(end, 3))
        if end <= start or (mapped and start < mapped[-1][2]):
            raise ValueError(f'Overlapping or collapsed acoustic word at {token!r}; review raw alignment.')
        mapped.append((token, start, end, min(prob) if prob else None))
    if j != len(aligned):
        raise ValueError('Unexpected extra aligned words')
    return mapped


def candidate(cues, mapped, recognized):
    """Rebuild phrase and instrumental bounds from aligned word times, not old offsets."""
    result, report = [], []
    at = 0
    for i, cue in enumerate(cues):
        n = len(cue['words'])
        if not n:
            result.append(dict(section=cue['section'], start=None, end=None, words=[]))
            continue
        words = mapped[at:at+n]
        at += n
        # Independently decoded ASR tokens close to the forced-alignment onset.
        # This is a diagnostic, not proof; repeated short words may match by chance.
        checks = [any(norm(w[0]) == norm(r['word']) and abs(w[1] - float(r['start'])) <= .6 for r in recognized) for w in words]
        low = [w[0] for w in words if w[3] is not None and w[3] < .25]
        long = [w[0] for w in words if w[2]-w[1] > 3]
        result.append(dict(section=cue['section'], start=words[0][1], end=words[-1][2], words=[list(w[:3]) for w in words]))
        report.append(dict(cue=i+1, lyric=' '.join(w[0] for w in words), oldStart=cue['start'], start=words[0][1], end=words[-1][2], independentlyMatched=sum(checks), total=n, lowProbability=low, unusuallyLong=long, review=not all(checks) or bool(low or long)))
    if at != len(mapped):
        raise ValueError('Unexpected mapped word count')
    for i, c in enumerate(result):
        if c['words']:
            continue
        c['start'] = result[i-1]['end'] if i else 0
        c['end'] = result[i+1]['start'] if i+1 < len(result) else DURATION
    prev = 0
    for c in result:
        if not prev <= c['start'] < c['end'] <= DURATION:
            raise ValueError('Invalid phrase or missing instrumental interval; review raw model output.')
        prev = c['end']
    # The owner reported a real instrumental break before the first chorus.
    if result[2]['end'] - result[2]['start'] < .5 or result[23]['end'] - result[23]['start'] < 20:
        raise ValueError('Model collapsed a known instrumental break; refusing to produce misleading timings.')
    return result, report


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')


def load_alignment_model(stable_whisper, model_name, backend, device=None):
    """Load either Whisper backend through stable-ts without changing the model choice."""
    options = {'device': device} if device else {}
    if backend == 'faster-whisper':
        loader = getattr(stable_whisper, 'load_faster_whisper', None)
        if loader is None:
            raise RuntimeError('This stable-ts install lacks Faster-Whisper support; install stable-ts[fw].')
    else:
        loader = stable_whisper.load_model
    return loader(model_name, **options)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model', default='medium.en', help='Whisper model (small.en for lower-memory CPU, large-v3 for higher accuracy)')
    parser.add_argument('--backend', choices=('openai', 'faster-whisper'), default='openai', help='Whisper implementation; faster-whisper reuses its Hugging Face model cache')
    parser.add_argument('--device', default=None, help='cpu or cuda; default auto')
    parser.add_argument('--vocals', type=Path, help='Optional untrimmed vocal stem separated from the exact bundled MP3')
    parser.add_argument('--output', type=Path, default=Path('karaoke-alignment'), help='Output directory (does not change game files)')
    args = parser.parse_args()
    if hashlib.sha256(AUDIO.read_bytes()).hexdigest() != SHA256:
        raise SystemExit('Unexpected song version: refusing to align against a different recording.')
    source = args.vocals or AUDIO
    if args.vocals:
        duration = float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(source)], text=True).strip())
        if abs(duration-DURATION) > .15:
            raise SystemExit('Vocal stem must have the same duration and sample origin as the MP3.')
    cues = load_cues()
    lyrics = '\n'.join(' '.join(w[0] for w in c['words']) for c in cues if c['words'])
    args.output.mkdir(parents=True, exist_ok=True)
    out = args.output
    # Do not let a failed rerun leave an old candidate looking like new output.
    for filename in ('candidate.json','review.json'):
        (out/filename).unlink(missing_ok=True)
    import stable_whisper
    model = load_alignment_model(stable_whisper, args.model, args.backend, args.device)
    print('Independent transcription (no lyric prompt)...', flush=True)
    transcribed = model.transcribe(str(source), language='en', word_timestamps=True, regroup=False).to_dict()
    write_json(out/'transcription.json', transcribed)
    print('Forced alignment of supplied lyrics against recording...', flush=True)
    aligned = model.align(str(source), lyrics, language='en', original_split=True, regroup=False).to_dict()
    write_json(out/'forced-alignment.json', aligned)
    result, report = candidate(cues, map_words(cues, flatten(aligned)), flatten(transcribed))
    write_json(out/'review.json', report)
    write_json(out/'candidate.json', dict(audioSha256=SHA256, cues=result, review=report))
    print(f'Candidate: {out / "candidate.json"}. Review flagged phrases in review.json, then import in the timing editor.')
    print(f'{sum(r["independentlyMatched"] for r in report)}/{sum(r["total"] for r in report)} words matched independent recognition within 0.6 s. This is not a verified sync score.')


if __name__ == '__main__':
    main()
