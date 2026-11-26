#!/usr/bin/env python3
"""Prepare the recorded CC0 VIP ambience from the original Freesound download.
Download https://freesound.org/people/Sclolex/sounds/177958/ (login required),
then pass the original WAV file. No synthesized audio, no network credentials.
Requires ffmpeg and ffprobe on PATH.
"""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

DEST = Path(__file__).resolve().parent / 'foley' / 'vip-water-drips.ogg'


def probe(path):
    return json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path)
    ], text=True))


def make_loop(source, dest, length):
    fade = 3
    graph = (f'[0:a]asplit=3[b][t][h];'
             f'[b]atrim=start={fade}:end={length-fade:.6f},asetpts=PTS-STARTPTS[body];'
             f'[t]atrim=start={length-fade:.6f},asetpts=PTS-STARTPTS,afade=t=out:st=0:d={fade}[tail];'
             f'[h]atrim=end={fade},asetpts=PTS-STARTPTS,afade=t=in:st=0:d={fade}[head];'
             '[tail][head]amix=inputs=2:duration=shortest:normalize=0[join];'
             '[body][join]concat=n=2:v=0:a=1,highpass=f=65,lowpass=f=5500[out]')
    subprocess.run(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y',
                    '-i',str(source),'-filter_complex',graph,'-map','[out]',
                    '-c:a','libvorbis','-q:a','5',str(dest)],check=True)
    if abs(float(probe(dest)['format']['duration'])-(length-fade))>.15:
        raise ValueError('Unexpected loop length')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source',type=Path,help='Original downloaded Water Dripping in Cave.wav')
    args=parser.parse_args()
    if not shutil.which('ffmpeg') or not shutil.which('ffprobe'):
        parser.error('Install ffmpeg and ffprobe first.')
    if not args.source.is_file():parser.error('Download the original recording first and provide its path.')
    info=probe(args.source);audio=[s for s in info['streams'] if s['codec_type']=='audio']
    length=float(info['format']['duration'])
    # Published original metadata (not a cryptographic identity check).
    if len(audio)!=1 or len(info['streams'])!=1 or not 89.7<=length<=89.95 or audio[0]['sample_rate']!='48000' or audio[0]['channels']!=2 or audio[0]['codec_name']!='pcm_s16le':
        parser.error('Expected the original 89.820s stereo 48kHz 16-bit WAV from Freesound 177958.')
    DEST.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='vip-water-',dir=DEST.parent) as tmp:
        output=Path(tmp)/DEST.name
        make_loop(args.source,output,length)
        output.replace(DEST)
    print('Installed',DEST,'— commit this local file before deployment.')

if __name__=='__main__':main()
