#!/usr/bin/env python3
"""Offline authoring tool: Whisper transcription + forced alignment, never edits live files."""
import argparse
from difflib import SequenceMatcher
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


def map_transcript_words(cues, recognized):
    """Fuzzy sequence-map unprompted ASR words to lyrics without losing order."""
    expected = [word[0] for cue in cues for word in cue['words']]
    heard = [word for word in recognized if norm(word.get('word', ''))]
    left = [norm(word).casefold() for word in expected]
    right = [norm(word['word']).casefold() for word in heard]
    gap = .76
    costs = [[0.0] * (len(right) + 1) for _ in range(len(left) + 1)]
    back = [[None] * (len(right) + 1) for _ in range(len(left) + 1)]
    for i in range(1, len(left) + 1):
        costs[i][0], back[i][0] = i * gap, 'delete'
    for j in range(1, len(right) + 1):
        costs[0][j], back[0][j] = j * gap, 'insert'
    for i, target in enumerate(left, 1):
        for j, heard_word in enumerate(right, 1):
            similarity = SequenceMatcher(None, target, heard_word, autojunk=False).ratio()
            substitute = 0.0 if target == heard_word else (.1 + .9 * (1 - similarity) if min(len(target), len(heard_word)) >= 3 and similarity >= .55 else 1.53)
            options = ((costs[i-1][j-1] + substitute, 'match'),
                       (costs[i-1][j] + gap, 'delete'),
                       (costs[i][j-1] + gap, 'insert'))
            costs[i][j], back[i][j] = min(options, key=lambda item: item[0])
    result = [None] * len(expected)
    i, j = len(left), len(right)
    while i or j:
        action = back[i][j]
        if action == 'match':
            similarity = SequenceMatcher(None, left[i-1], right[j-1], autojunk=False).ratio()
            exact = left[i-1] == right[j-1]
            enough = exact or (min(len(left[i-1]), len(right[j-1])) >= 3 and similarity >= .55)
            if enough:
                result[i-1] = dict(word=heard[j-1]['word'], start=heard[j-1].get('start'),
                                   end=heard[j-1].get('end'), similarity=similarity, exact=exact)
            i -= 1
            j -= 1
        elif action == 'delete':
            i -= 1
        elif action == 'insert':
            j -= 1
        else:
            raise ValueError('ASR-to-lyrics sequence mapping is incomplete')
    return result


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
    """Rebuild lead/instrumental bounds while preserving separate backing timing."""
    result, report = [], []
    recognized_map = map_transcript_words(cues, recognized)
    at = 0
    def copy_responses(cue):
        return [dict(start=r['start'], end=r['end'], words=[list(w) for w in r['words']])
                for r in cue.get('responses', [])]
    for i, cue in enumerate(cues):
        n = len(cue['words'])
        if not n:
            result.append(dict(section=cue['section'], start=None, end=None, words=[], responses=copy_responses(cue)))
            continue
        words = mapped[at:at+n]
        at += n
        # Independently decoded ASR tokens close to the forced-alignment onset.
        # This is a diagnostic, not proof; repeated short words may match by chance.
        matched = recognized_map[at-n:at]
        checks = [r is not None and r.get('start') is not None and abs(w[1] - float(r['start'])) <= .6 for w, r in zip(words, matched)]
        low = [w[0] for w in words if w[3] is not None and w[3] < .25]
        long = [w[0] for w in words if w[2]-w[1] > 3]
        result.append(dict(section=cue['section'], start=words[0][1], end=words[-1][2], words=[list(w[:3]) for w in words], responses=copy_responses(cue)))
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


def ctc_words_from_spans(spans, cues, labels, frame_seconds):
    """Convert TorchAudio CTC character spans into one scored interval per lyric word."""
    output = []
    cursor = 0
    previous_end = 0.0
    words = [word[0] for cue in cues for word in cue['words']]
    for index, original in enumerate(words):
        token = norm(original).upper()
        if not token:
            raise ValueError(f'Lyric token {original!r} has no alignable letters')
        chars = spans[cursor:cursor + len(token)]
        if len(chars) != len(token):
            raise ValueError(f'CTC alignment ended inside {original!r}')
        if ''.join(labels[span.token] for span in chars) != token:
            raise ValueError(f'CTC token mismatch at {original!r}')
        start = float(chars[0].start) * frame_seconds
        end = float(chars[-1].end) * frame_seconds
        frame_count = sum(len(span) for span in chars)
        if frame_count <= 0:
            raise ValueError(f'CTC alignment has no acoustic frames for {original!r}')
        # TorchAudio reports mean log posterior per character span. Geometric
        # averaging retains a useful 0..1 diagnostic without calling it truth.
        log_score = sum(float(span.score) * len(span) for span in chars) / frame_count
        score = math.exp(min(0.0, log_score))
        if not (math.isfinite(start) and math.isfinite(end) and 0 <= start < end <= DURATION + .05):
            raise ValueError(f'Invalid CTC interval for {original!r}: {start}–{end}')
        if start < previous_end - .001:
            raise ValueError(f'Overlapping CTC word at {original!r}')
        output.append(dict(word=original, start=start, end=end, probability=score))
        previous_end = end
        cursor += len(token)
        if index + 1 < len(words):
            if cursor >= len(spans) or labels[spans[cursor].token] != '|':
                raise ValueError(f'Missing CTC word separator after {original!r}')
            cursor += 1
    if cursor != len(spans):
        raise ValueError('Unexpected CTC alignment spans remain after the final lyric')
    return output


def align_ctc(source, cues, device=None):
    """Forced-align exact lyrics with TorchAudio Wav2Vec2 CTC on a vocal stem."""
    import torch
    import torchaudio

    bundle = torchaudio.pipelines.WAV2VEC2_ASR_BASE_960H
    labels = bundle.get_labels()
    label_ids = {label: index for index, label in enumerate(labels)}
    target_text = '|'.join(norm(word[0]).upper() for cue in cues for word in cue['words'])
    unsupported = sorted(set(target_text) - set(label_ids))
    if unsupported:
        raise ValueError(f'Lyrics contain symbols unsupported by CTC model: {unsupported}')
    target = torch.tensor([[label_ids[char] for char in target_text]], dtype=torch.int32)
    waveform, sample_rate = torchaudio.load(str(source))
    if waveform.ndim != 2 or waveform.shape[0] < 1:
        raise ValueError('Audio could not be decoded as a channel-first waveform')
    waveform = waveform.mean(dim=0, keepdim=True)
    if sample_rate != bundle.sample_rate:
        waveform = torchaudio.functional.resample(waveform, sample_rate, bundle.sample_rate)
    device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
    model = bundle.get_model().to(device).eval()
    with torch.inference_mode():
        emissions, _ = model(waveform.to(device))
        log_probs = torch.log_softmax(emissions, dim=-1)
        aligned, scores = torchaudio.functional.forced_align(
            log_probs, target.to(device), blank=label_ids['-'])
        spans = torchaudio.functional.merge_tokens(
            aligned[0].cpu(), scores[0].cpu(), blank=label_ids['-'])
    frame_seconds = waveform.shape[-1] / bundle.sample_rate / emissions.shape[1]
    return ctc_words_from_spans(spans, cues, labels, frame_seconds), dict(
        model='torchaudio WAV2VEC2_ASR_BASE_960H', device=device,
        sampleRate=bundle.sample_rate, frames=int(emissions.shape[1]),
        frameSeconds=frame_seconds, source=str(source))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model', default='medium.en', help='Whisper model (small.en for lower-memory CPU, large-v3 for higher accuracy)')
    parser.add_argument('--backend', choices=('openai', 'faster-whisper', 'torchaudio-ctc'), default='openai', help='Forced aligner; torchaudio-ctc uses Wav2Vec2 CTC (requires torchaudio)')
    parser.add_argument('--device', default=None, help='cpu or cuda; default auto')
    parser.add_argument('--vocals', type=Path, help='Optional untrimmed vocal stem separated from the exact bundled MP3')
    parser.add_argument('--output', type=Path, default=Path('karaoke-alignment'), help='Output directory (does not change game files)')
    args = parser.parse_args()
    if hashlib.sha256(AUDIO.read_bytes()).hexdigest() != SHA256:
        raise SystemExit('Unexpected song version: refusing to align against a different recording.')
    source = args.vocals or AUDIO
    if args.vocals:
        try:
            duration = float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(source)], text=True).strip())
        except (FileNotFoundError, subprocess.CalledProcessError):
            import torchaudio
            info = torchaudio.info(str(source))
            duration = info.num_frames / info.sample_rate
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
    transcription_backend = 'faster-whisper' if args.backend == 'torchaudio-ctc' else args.backend
    model = load_alignment_model(stable_whisper, args.model, transcription_backend, args.device)
    print('Independent transcription (no lyric prompt)...', flush=True)
    transcribed = model.transcribe(str(source), language='en', word_timestamps=True, regroup=False).to_dict()
    write_json(out/'transcription.json', transcribed)
    if args.backend == 'torchaudio-ctc':
        print('CTC forced alignment of exact supplied lyrics...', flush=True)
        aligned_words, alignment_meta = align_ctc(source, cues, args.device)
        aligned = {'segments': [{'words': aligned_words}], 'alignment': alignment_meta}
    else:
        print('Whisper forced alignment of supplied lyrics against recording...', flush=True)
        aligned = model.align(str(source), lyrics, language='en', original_split=True, regroup=False).to_dict()
        alignment_meta = dict(model=f'{args.backend} {args.model}', source=str(source))
    write_json(out/'forced-alignment.json', aligned)
    result, report = candidate(cues, map_words(cues, flatten(aligned)), flatten(transcribed))
    write_json(out/'review.json', report)
    write_json(out/'candidate.json', dict(audioSha256=SHA256, alignment=alignment_meta, cues=result, review=report))
    print(f'Candidate: {out / "candidate.json"}. Review flagged phrases in review.json, then import in the timing editor.')
    print(f'{sum(r["independentlyMatched"] for r in report)}/{sum(r["total"] for r in report)} lead words matched independent recognition within 0.6 s. Backing timings were preserved. This is not a verified sync score.')


if __name__ == '__main__':
    main()
