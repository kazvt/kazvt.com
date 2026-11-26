#!/usr/bin/env python3
"""Install the recorded drum roll and hit from verified Wikimedia Commons originals.
No synthesis. Requires Python 3 and FFmpeg. Optional --downloads supplies originals.
"""
import argparse
import hashlib
import pathlib
import shutil
import subprocess
import tempfile
import urllib.request

BASE = 'https://upload.wikimedia.org/wikipedia/commons/'
DEST = pathlib.Path(__file__).resolve().parent / 'foley'
SOURCES = (
    ('Drum_Roll_Intro.ogg', 'c/c4/Drum_Roll_Intro.ogg', 'e5109afea058cbc4a631fb6d05c72353bfa54ac3', 'stage-drum-roll.ogg'),
    ('Snare_drum_unmuffled.ogg', 'b/b2/Snare_drum_unmuffled.ogg', 'd8d5767eb1b289f25a8d29d0e53f2522347b6e73', 'stage-drum-hit.ogg'),
)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--downloads', type=pathlib.Path)
    args = parser.parse_args()
    if not shutil.which('ffmpeg'):
        parser.error('Install FFmpeg first.')
    with tempfile.TemporaryDirectory() as folder:
        work = pathlib.Path(folder)
        for name, url, digest, output in SOURCES:
            source = work / name
            if args.downloads:
                shutil.copyfile(args.downloads / name, source)
            else:
                req = urllib.request.Request(BASE + url, headers={'User-Agent': 'RambleGambleAudioInstaller/1.0 (local game assets)'})
                with urllib.request.urlopen(req, timeout=45) as response:
                    data = response.read(2 * 1024 * 1024 + 1)
                if len(data) > 2 * 1024 * 1024:
                    raise ValueError(f'{name}: oversized download')
                source.write_bytes(data)
            if hashlib.sha1(source.read_bytes()).hexdigest() != digest:
                raise ValueError(f'{name}: original checksum mismatch')
            cmd = ['ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source)]
            if output.endswith('hit.ogg'):
                # Keep the first recorded strike and its short decay, not the full demonstration.
                cmd += ['-af', 'silenceremove=start_periods=1:start_duration=0.001:start_threshold=-36dB,afade=t=out:st=0.55:d=0.15', '-t', '0.7']
            else:
                cmd += ['-af', 'afade=t=in:d=0.025,afade=t=out:st=3.88:d=0.10', '-t', '4']
            subprocess.run(cmd + ['-c:a', 'libvorbis', '-q:a', '5', str(work / output)], check=True)
            if (work / output).stat().st_size < 1000:
                raise ValueError(f'{output}: failed audio edit')
        DEST.mkdir(parents=True, exist_ok=True)
        for _, _, _, output in SOURCES:
            temp = DEST / (output + '.tmp')
            shutil.copyfile(work / output, temp)
            temp.replace(DEST / output)
            print('Installed', DEST / output)

if __name__ == '__main__':
    main()
