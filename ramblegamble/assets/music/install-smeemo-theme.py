#!/usr/bin/env python3
"""Install Kevin MacLeod's CC BY 4.0 "Evening of Chaos" for the Smeemo encounter."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import urllib.parse
import urllib.request

DEST = Path(__file__).resolve().parent / 'smeemo_theme.mp3'
SOURCE = 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Evening%20of%20Chaos.mp3'
ALLOWED_HOSTS = {'incompetech.com', 'www.incompetech.com'}
MAX_BYTES = 32 * 1024 * 1024
EXPECTED_DURATION = 282
EXPECTED_SHA256 = '00a2fee94641761f37e74973eaaa654e1a8a628269f585707d46987558d07573'


def validate(path):
    if not path.is_file() or not 1024 < path.stat().st_size <= MAX_BYTES:
        raise ValueError('missing or implausibly sized MP3')
    result = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,codec_name:format=duration', '-of', 'json', str(path)],
        check=True, capture_output=True, text=True,
    )
    info = json.loads(result.stdout)
    audio = [stream for stream in info.get('streams', []) if stream.get('codec_type') == 'audio']
    duration = float(info.get('format', {}).get('duration', 0))
    if not audio or not any(stream.get('codec_name') == 'mp3' for stream in audio):
        raise ValueError('source does not contain MP3 audio')
    if abs(duration - EXPECTED_DURATION) > 2:
        raise ValueError(f'unexpected duration: {duration:.3f}s')
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if digest != EXPECTED_SHA256:
        raise ValueError('track checksum mismatch; refusing unexpected audio')
    return duration


def download(output):
    request = urllib.request.Request(SOURCE, headers={'User-Agent': 'RambleGambleAssetInstaller/1.0'})
    with urllib.request.urlopen(request, timeout=60) as response:
        final = urllib.parse.urlsplit(response.geturl())
        if final.scheme != 'https' or final.hostname not in ALLOWED_HOSTS:
            raise ValueError('download redirected outside the official Incompetech host')
        total = 0
        digest = hashlib.sha256()
        with output.open('wb') as target:
            while chunk := response.read(65536):
                total += len(chunk)
                if total > MAX_BYTES:
                    raise ValueError('track exceeds the 32 MiB safety limit')
                digest.update(chunk)
                target.write(chunk)
    return total, digest.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='validate the local asset without downloading')
    args = parser.parse_args()
    if not shutil.which('ffprobe'):
        parser.error('ffprobe is required to validate the installed MP3')
    if args.check:
        try:
            duration = validate(DEST)
        except (OSError, ValueError, subprocess.CalledProcessError, json.JSONDecodeError) as error:
            parser.exit(1, f'Smeemo theme is missing or invalid ({type(error).__name__}).\n')
        print(f'Installed and valid: {DEST.name} ({duration:.1f}s)')
        return

    with tempfile.TemporaryDirectory(prefix='rg-smeemo-theme-', dir=DEST.parent) as folder:
        staged = Path(folder) / DEST.name
        size, digest = download(staged)
        duration = validate(staged)
        staged.replace(DEST)
    print(f'Installed {DEST.name}: {size:,} bytes, {duration:.1f}s, SHA-256 {digest}')


if __name__ == '__main__':
    main()
