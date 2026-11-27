#!/usr/bin/env python3
"""Download two real thunder recordings; checksum, trim, fade and install.
No synthesis or runtime hotlinks. Python 3 + FFmpeg; --downloads accepts originals.
"""
import argparse
import hashlib
import math
import pathlib
import re
import shutil
import struct
import subprocess
import tempfile
import urllib.request

DEST = pathlib.Path(__file__).resolve().parent / 'foley'
BASE = 'https://upload.wikimedia.org/wikipedia/commons/'
SOURCES = (
    ('Thunder_crack_2B.ogg', '7/75/Thunder_crack_2B.ogg', '2eedc224cd4d5b3a9caf3f7a86848cbc48675732', 'smeemo-thunder-crack.ogg', None),
    ('Thunder_Claps.ogg', '5/54/Thunder_Claps.ogg', '7a4b3422c73f34e96a614a8513e2896c5df5a908', 'smeemo-thunder-westport.ogg', 3.55),
)
LIMIT = 6 * 1024 * 1024
DURATION = 4.2


def verified_source(name, path, digest, downloads):
    if downloads:
        with (downloads / name).open('rb') as handle:
            data = handle.read(LIMIT + 1)
    else:
        req = urllib.request.Request(BASE + path, headers={'User-Agent': 'RambleGambleAudioInstaller/1.0 (local game assets)'})
        with urllib.request.urlopen(req, timeout=45) as handle:
            data = handle.read(LIMIT + 1)
    if len(data) > LIMIT or not data.startswith(b'OggS') or hashlib.sha1(data).hexdigest() != digest:
        raise ValueError(f'{name}: original checksum or Ogg format mismatch')
    return data


def onset(source):
    # Analyze the genuine recording, not a generated replacement. Find the
    # loudest 50 ms window and walk back to its nearby onset, retaining pre-roll.
    rate = 16000
    pcm = subprocess.check_output(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(source), '-vn', '-ac', '1', '-ar', str(rate), '-f', 's16le', '-'])
    values = [v[0] for v in struct.iter_unpack('<h', pcm)]
    step = rate // 20
    levels = [math.sqrt(sum(v*v for v in values[i:i+step]) / len(values[i:i+step])) for i in range(0,len(values),step)]
    if not levels or max(levels) < 10:
        raise ValueError('No usable recorded thunder')
    peak = max(range(len(levels)), key=levels.__getitem__)
    threshold = levels[peak]*.15
    start = peak
    while start > max(0, peak-24) and levels[start-1] >= threshold:
        start -= 1
    return max(0, min(start*.05-.12,len(values)/rate-DURATION))


def edit(source, output, start):
    if start is None:
        start = onset(source)
    # Match peaks conservatively without replacing the recorded dynamics.
    analysis = subprocess.run(['ffmpeg','-nostdin','-hide_banner','-ss',str(start),'-i',str(source),'-vn','-t',str(DURATION),'-af','highpass=f=35,volumedetect','-f','null','-'],capture_output=True,text=True,check=True)
    match = re.search(r'max_volume: (-?[0-9.]+) dB',analysis.stderr)
    if not match or float(match.group(1)) < -65:
        raise ValueError('Thunder excerpt is silent or could not be measured')
    gain = max(-18,min(12,-4-float(match.group(1))))
    subprocess.run(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y','-ss',str(start),'-i',str(source),'-vn','-t',str(DURATION),
                    '-af',f'highpass=f=35,volume={gain}dB,afade=t=in:d=0.025,afade=t=out:st=3.65:d=0.55,alimiter=limit=0.78:level=false',
                    '-ar','44100','-ac','2','-c:a','libvorbis','-q:a','5',str(output)],check=True)
    if output.stat().st_size < 1000 or output.read_bytes()[:4] != b'OggS':
        raise ValueError(f'{output.name}: invalid audio edit')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--downloads',type=pathlib.Path,help='Directory containing the two original Commons filenames')
    args=parser.parse_args()
    if not shutil.which('ffmpeg'):
        parser.error('Install FFmpeg first.')
    with tempfile.TemporaryDirectory() as folder:
        work=pathlib.Path(folder)
        for name,path,digest,output,start in SOURCES:
            source=work/name
            source.write_bytes(verified_source(name,path,digest,args.downloads))
            edit(source,work/output,start)
        DEST.mkdir(parents=True,exist_ok=True)
        for _,_,_,output,_ in SOURCES:
            pending=DEST/(output+'.tmp')
            shutil.copyfile(work/output,pending)
            pending.replace(DEST/output)
            print('Installed',DEST/output)


if __name__=='__main__':
    main()
