#!/usr/bin/env python3
"""Download three verified public-domain recordings and prepare local game assets.
No synthesis, no credentials. Requires Python 3 and ffmpeg/ffprobe on PATH.
Optional --downloads DIR uses exact original files saved manually from Commons.
"""
import argparse
import hashlib
import pathlib
import shutil
import subprocess
import tempfile
import urllib.request

DEST = pathlib.Path(__file__).resolve().parent / 'foley'
BASE = 'https://upload.wikimedia.org/wikipedia/commons/'
# Immutable versions verified against the source pages' SHA-1 metadata.
SOURCES = (
    ('Cafe_ambiance.ogg', '5/54/Cafe_ambiance.ogg', '8021f4ca9645e900ffa1387e4b10d1185a7966c2', 'room-bed.mp3', 3),
    ('Restaurant_ambience.ogg', 'b/b5/Restaurant_ambience.ogg', '34e0b1f53ebe79dc106cdc89accd89fbae0a9e8c', 'room-detail.mp3', 3),
    ('Nick121087_-_Demonic_Woman_Scream_(cc0)_(freesound).mp3', 'e/e6/Nick121087_-_Demonic_Woman_Scream_%28cc0%29_%28freesound%29.mp3', '3e0160f86378d05f5cdf664bc28203e104fb9a64', 'smeemo-horror.mp3', 0),
)

def get_source(row, work, downloads):
    name, url, digest, _, _ = row
    file = work / name
    if downloads:
        shutil.copyfile(downloads / name, file)
    else:
        req = urllib.request.Request(BASE + url, headers={'User-Agent': 'RambleGambleAudioInstaller/1.0 (local open-source game asset installer)'})
        with urllib.request.urlopen(req, timeout=90) as response, file.open('wb') as out:
            data = response.read(32 * 1024 * 1024 + 1)
            if len(data) > 32 * 1024 * 1024:
                raise ValueError(f'{name}: oversized download')
            out.write(data)
    if hashlib.sha1(file.read_bytes()).hexdigest() != digest:
        raise ValueError(f'{name}: checksum mismatch; refusing to install unexpected content')
    return file

def duration(file):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', str(file)], text=True).strip())

def make_loop(source, dest, fade):
    length = duration(source)
    if length <= 3 * fade:
        raise ValueError('Recording too short for loop edit')
    # End-to-start overlap. The loop begins at t=fade and ends at the same
    # point of the recording, so there is no hard cut at the file boundary.
    graph = (f'[0:a]asplit=3[b][t][h];'
             f'[b]atrim=start={fade}:end={length-fade:.6f},asetpts=PTS-STARTPTS[body];'
             f'[t]atrim=start={length-fade:.6f},asetpts=PTS-STARTPTS[tail];'
             f'[h]atrim=end={fade},asetpts=PTS-STARTPTS[head];'
             f'[tail]afade=t=out:st=0:d={fade}[tailfade];'
             f'[head]afade=t=in:st=0:d={fade}[headfade];'
             '[tailfade][headfade]amix=inputs=2:duration=shortest:normalize=0[join];'
             '[body][join]concat=n=2:v=0:a=1,highpass=f=70,lowpass=f=3500[out]')
    subprocess.run(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y','-i',str(source),'-filter_complex',graph,'-map','[out]','-c:a','libmp3lame','-q:a','5',str(dest)], check=True)
    if abs(duration(dest) - (length-fade)) > .25:
        raise ValueError('Unexpected edited loop duration')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--downloads', type=pathlib.Path)
    args = parser.parse_args()
    if not shutil.which('ffmpeg') or not shutil.which('ffprobe'):
        parser.error('Install ffmpeg and ffprobe on PATH before running this script.')
    DEST.mkdir(parents=True, exist_ok=True)
    # Prepare everything before replacing any asset. Temp directory on same filesystem.
    with tempfile.TemporaryDirectory(prefix='room-audio-', dir=DEST.parent) as tmp:
        work = pathlib.Path(tmp)
        for row in SOURCES:
            print('Preparing', row[3], flush=True)
            source = get_source(row, work, args.downloads)
            dest = work / row[3]
            if row[4]:
                make_loop(source, dest, row[4])
            else:
                if not 3 < duration(source) < 5:
                    raise ValueError('Unexpected scream duration')
                shutil.copyfile(source, dest)
        for row in SOURCES:
            (work / row[3]).replace(DEST / row[3])
    print('Installed three verified local recordings in', DEST)

if __name__ == '__main__':
    main()
