#!/usr/bin/env python3
"""Download licensed photographs and a CC0 blood decal; prepare a pixelated atlas.

Offline build step only. Requires Pillow. No generated hand anatomy, no AI art,
no remote fetch at game runtime. The output is CC BY-SA 3.0 (see SOURCES.md).
"""
import argparse
from collections import deque
import hashlib
from io import BytesIO
from pathlib import Path
import urllib.request
from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent
SOURCES = (
    ('Forearm.jpg', 'https://upload.wikimedia.org/wikipedia/commons/3/32/Forearm.jpg', '4517c205814ca7efea9b868df1bfba87dc411e47', (321,1029), 0, 'blue'),
    ('5@BackForward.jpg', 'https://upload.wikimedia.org/wikipedia/commons/e/eb/5%40BackForward.jpg', '273e012a5b280b0bdd931427361c0e58b4449d56', (1000,1000), 61, 'red'),
    ('Claw5@UlnarForward.jpg', 'https://upload.wikimedia.org/wikipedia/commons/5/58/Claw5%40UlnarForward.jpg', '94996404e47f9c33bdc7a51b5c79e9a08b4af1ae', (1000,1000), 90, 'red'),
)
BLOOD = ('blood_splatter_0.png', 'https://opengameart.org/sites/default/files/blood_splatter_0.png')
MAX_BYTES = 4*1024*1024
TILE = (48,96)


def read_asset(name, url, folder):
    if folder is not None:
        with (folder / name).open('rb') as stream:
            data = stream.read(MAX_BYTES+1)
    else:
        req = urllib.request.Request(url, headers={'User-Agent':'RambleGambleAssetInstaller/1.0 (offline asset preparation)'})
        with urllib.request.urlopen(req, timeout=45) as stream:
            data = stream.read(MAX_BYTES+1)
    if len(data)>MAX_BYTES:
        raise ValueError(f'{name}: unexpectedly large download')
    return data


def source_photo(source, folder):
    name,url,digest,size,angle,key=source
    data=read_asset(name,url,folder)
    if hashlib.sha1(data).hexdigest()!=digest:
        raise ValueError(f'{name}: original source checksum mismatch')
    with Image.open(BytesIO(data)) as im:
        if im.format!='JPEG' or im.size!=size:
            raise ValueError(f'{name}: unexpected format/dimensions')
        return cutout(im.convert('RGB'), angle, key)


def largest_component(mask):
    """Remove detached background details (e.g. shirt buttons)."""
    w,h=mask.size; bits=bytearray(mask.tobytes()); best=[]
    for i in range(len(bits)):
        if not bits[i]:
            continue
        bits[i]=0; q=deque([i]); part=[]
        while q:
            k=q.popleft();part.append(k);x=k%w
            for n in (k-1 if x else -1,k+1 if x<w-1 else -1,k-w,k+w):
                if 0<=n<len(bits) and bits[n]:
                    bits[n]=0;q.append(n)
        if len(part)>len(best):best=part
    result=bytearray(w*h)
    for i in best:result[i]=255
    return Image.frombytes('L',(w,h),bytes(result))


def cutout(photo, angle, key):
    # These source photos have blue/black cloth or saturated red cloth. Key only
    # the cloth and retain the actual skin pixels; keep the largest connected arm.
    photo.thumbnail((512,512),Image.Resampling.LANCZOS)
    mask=Image.new('L',photo.size)
    mask.putdata([255 if ((r>48 and r>g*1.025 and r>b*1.025) if key=='blue' else (r>55 and g>r*.47 and g>b*1.12)) else 0 for r,g,b in photo.getdata()])
    mask=largest_component(mask.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3)))
    bbox=mask.getbbox()
    if bbox is None or sum(mask.histogram()[128:])<photo.width*photo.height*.10:
        raise ValueError('Photo segmentation failed; inspect original source instead of generating a replacement')
    # Closing tiny holes does not change the overall outline or invent anatomy.
    rgba=ImageEnhance.Color(photo).enhance(.82).convert('RGBA');rgba.putalpha(mask)
    rgba=rgba.crop(bbox).rotate(angle,Image.Resampling.BICUBIC,expand=True)
    bbox=rgba.getchannel('A').getbbox()
    if not bbox:raise ValueError('Empty arm after rotation')
    rgba=rgba.crop(bbox)
    rgba.thumbnail((TILE[0]-4,TILE[1]-3),Image.Resampling.LANCZOS)
    tile=Image.new('RGBA',TILE)
    tile.paste(rgba,((TILE[0]-rgba.width)//2,TILE[1]-rgba.height))
    return tile


def blood_mask(folder):
    data=read_asset(*BLOOD,folder)
    with Image.open(BytesIO(data)) as im:
        if im.format!='PNG' or im.size!=(512,512):
            raise ValueError('Unexpected blood decal format/dimensions')
        im=im.convert('RGBA')
    alpha=im.getchannel('A')
    if alpha.getextrema()[0]<240:
        mask=alpha
    else:
        gray=ImageOps.grayscale(im); bg=gray.getpixel((0,0))
        mask=ImageChops.difference(gray,Image.new('L',gray.size,bg))
        mask=ImageOps.autocontrast(mask)
    box=mask.getbbox()
    if not box:raise ValueError('Empty source blood decal')
    return mask.crop(box)


def stain(tile, decal, index):
    if index%2: tile=ImageOps.mirror(tile)
    tile=tile.copy();a=tile.getchannel('A')
    # Reposition and rotate the real sourced decal, never paint arbitrary blood.
    mask=Image.new('L',TILE);spot=decal.copy()
    spot.thumbnail((25+index%3*4,31+index%2*8),Image.Resampling.LANCZOS)
    spot=spot.rotate(19+index*37,Image.Resampling.BICUBIC,expand=True)
    # Anchor on an actual opaque skin pixel, including shorter hand poses.
    left,top,right,bottom=a.getbbox()
    cx=(left+right)/2;cy=top+(bottom-top)*(.36+.12*(index%3))
    candidates=[(x,y) for y in range(top,min(bottom,76)) for x in range(left,right) if a.getpixel((x,y))>180]
    if not candidates:raise ValueError('No visible skin pixels for source decal')
    x,y=min(candidates,key=lambda q:(q[0]-cx)**2+(q[1]-cy)**2)
    sx,sy=spot.size;peak=spot.getextrema()[1]
    if not peak:raise ValueError('Source decal became empty')
    # Align the strongest source decal pixel with skin to ensure contact.
    anchor=min(((u,v) for v in range(sy) for u in range(sx) if spot.getpixel((u,v))>=peak*.85),key=lambda q:(q[0]-sx/2)**2+(q[1]-sy/2)**2)
    mask.paste(spot,(x-anchor[0],y-anchor[1]))
    mask=ImageChops.multiply(mask,a).point(lambda x:round(x*.68))
    rgb=Image.composite(Image.new('RGB',TILE,(92,17,29)),tile.convert('RGB'),mask)
    # Feather only the submerged wrist, leaving the real hand silhouette crisp.
    fade=Image.new('L',TILE);fade.putdata([round(255*min(1,max(0,(95-y)/25))) for y in range(96) for _ in range(48)])
    rgb.putalpha(ImageChops.multiply(a,fade))
    return rgb


def build(folder=None,dest=ROOT/'hands-atlas.png'):
    decal=blood_mask(folder)
    atlas=Image.new('RGBA',(TILE[0]*6,TILE[1]))
    for i,source in enumerate(SOURCES):
        tile=source_photo(source,folder)
        for j in range(2):
            index=i*2+j; edited=stain(tile,decal,index)
            if not edited.getchannel('A').getbbox():raise ValueError('Empty atlas tile')
            atlas.paste(edited,(index*TILE[0],0))
    tmp=dest.with_suffix('.tmp.png');atlas.save(tmp,optimize=True);tmp.replace(dest)
    print(f'Installed {dest} ({atlas.width} x {atlas.height}). Inspect the six tiles before deploying.')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir',type=Path,help='Use locally downloaded unchanged originals instead of network access')
    args=parser.parse_args();build(args.source_dir)
