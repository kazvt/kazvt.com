#!/usr/bin/env python3
"""Install a looped cave-drip ambience recording from OpenGameArt.

Downloads and verifies the exact CC0 FLAC source. Requires FFmpeg and FFprobe.
An optional positional argument may supply the unchanged original FLAC file
when network access is unavailable.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import urllib.request


SOURCE_URL = 'https://opengameart.org/sites/default/files/atmosbasement.mp3_.flac'
SOURCE_SHA1 = '77e17163b4bcc4c2199eecaaa1c46ed7fa627409'
SOURCE_DURATION = 20.063107
MAX_SOURCE_BYTES = 4 * 1024 * 1024
DEST = Path(__file__).resolve().parent / 'foley' / 'vip-water-drips-cc0-loop.ogg'


def probe(path):
    return json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path)
    ], text=True))


def verify_source(path):
    if path.stat().st_size > MAX_SOURCE_BYTES:
        raise ValueError('Source recording exceeds the expected size limit')
    digest = hashlib.sha1()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    if digest.hexdigest() != SOURCE_SHA1:
        raise ValueError('Source checksum mismatch; refusing unexpected audio')

    info = probe(path)
    audio = [stream for stream in info['streams'] if stream['codec_type'] == 'audio']
    length = float(info['format']['duration'])
    if (len(audio) != 1 or len(info['streams']) != 1
            or audio[0]['codec_name'] != 'flac'
            or abs(length - SOURCE_DURATION) > 0.1):
            raise ValueError('Source does not match the verified OpenGameArt cave-drip FLAC')
    return length


def make_loop(source, dest, length):
    fade = 3
    graph = (f'[0:a]asplit=3[b][t][h];'
             f'[b]atrim=start={fade}:end={length-fade:.6f},asetpts=PTS-STARTPTS[body];'
             f'[t]atrim=start={length-fade:.6f},asetpts=PTS-STARTPTS,afade=t=out:st=0:d={fade}[tail];'
             f'[h]atrim=end={fade},asetpts=PTS-STARTPTS,afade=t=in:st=0:d={fade}[head];'
             '[tail][head]amix=inputs=2:duration=shortest:normalize=0[join];'
             '[body][join]concat=n=2:v=0:a=1,highpass=f=65,lowpass=f=5500[out]')
    subprocess.run(['ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
                    '-i', str(source), '-filter_complex', graph, '-map', '[out]',
                    '-c:a', 'libvorbis', '-q:a', '5', str(dest)], check=True)
    if abs(float(probe(dest)['format']['duration']) - (length - fade)) > 0.15:
        raise ValueError('Unexpected loop length')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', nargs='?', type=Path,
                        help='optional unchanged original FLAC; omitted means download it')
    args = parser.parse_args()
    if not shutil.which('ffmpeg') or not shutil.which('ffprobe'):
        parser.error('Install ffmpeg and ffprobe first.')

    with tempfile.TemporaryDirectory(prefix='vip-water-') as folder:
        work = Path(folder)
        source = args.source
        if source is None:
            source = work / 'atmosbasement.mp3_.flac'
            request = urllib.request.Request(
                SOURCE_URL,
                headers={'User-Agent': 'RambleGambleAudioInstaller/1.0 (local game assets)'}
            )
            with urllib.request.urlopen(request, timeout=45) as response:
                data = response.read(MAX_SOURCE_BYTES + 1)
            if len(data) > MAX_SOURCE_BYTES:
                raise ValueError('Source recording exceeds the expected size limit')
            source.write_bytes(data)
        elif not source.is_file():
            parser.error('The supplied original FLAC file does not exist.')

        length = verify_source(source)
        output = work / DEST.name
        make_loop(source, output, length)
        DEST.parent.mkdir(parents=True, exist_ok=True)
        DEST.write_bytes(output.read_bytes())

    print('Installed', DEST, f'({DEST.stat().st_size:,} bytes)')


if __name__ == '__main__':
    main()
