#!/usr/bin/env python3
"""Install the original owner-supplied soundtrack attachments, without editing audio."""
import argparse
import json
import pathlib
import shutil
import subprocess
import tempfile
import urllib.parse
import urllib.request

DEST = pathlib.Path(__file__).resolve().parent
FILES = ('sonic_gammon_leel_theme.mp3', 'sonic_no_daifuugou_title_theme.mp3')
LIMIT = 64 * 1024 * 1024


def download(url, output):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != 'https' or parsed.hostname not in ('cdn.discordapp.com', 'media.discordapp.net') or not parsed.path.startswith('/attachments/'):
        raise ValueError('Expected a current HTTPS Discord attachment link.')
    request = urllib.request.Request(url, headers={'User-Agent': 'RambleGambleSoundtrackInstaller/1.0'})
    with urllib.request.urlopen(request, timeout=60) as response, output.open('wb') as dest:
        total = 0
        while chunk := response.read(65536):
            total += len(chunk)
            if total > LIMIT:
                raise ValueError('Attachment exceeds the 64 MiB limit.')
            dest.write(chunk)


def validate(path):
    result = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_name,codec_type:format=duration', '-of', 'json', str(path)], check=True, capture_output=True, text=True)
    info = json.loads(result.stdout)
    if not any(s.get('codec_type') == 'audio' and s.get('codec_name') == 'mp3' for s in info.get('streams', [])) or float(info.get('format', {}).get('duration', 0)) <= 0:
        raise ValueError('Expected a nonempty MP3 recording.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--downloads', type=pathlib.Path, help='Directory with the two original MP3s saved under their exact filenames.')
    args = parser.parse_args()
    if not shutil.which('ffprobe'):
        parser.error('ffprobe is required for validating the files; or save the originals manually beside the README.')
    with tempfile.TemporaryDirectory(prefix='rg-music-', dir=DEST) as folder:
        work = pathlib.Path(folder)
        for name in FILES:
            target = work / name
            try:
                if args.downloads:
                    source = args.downloads / name
                    if source.stat().st_size > LIMIT:
                        raise ValueError('File exceeds the 64 MiB limit.')
                    shutil.copyfile(source, target)
                else:
                    download(input(f'Current Discord link for {name}: ').strip(), target)
                validate(target)
            except (OSError, ValueError, subprocess.CalledProcessError) as error:
                # Do not echo a signed URL (or log an expired signature).
                parser.exit(1, f'{name}: could not install ({type(error).__name__}). Download the original MP3 again or use --downloads. Existing files unchanged.\n')
        for name in FILES:
            (work / name).replace(DEST / name)
    print('Both original MP3s installed. Refresh the host arcade.')


if __name__ == '__main__':
    main()
