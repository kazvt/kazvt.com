#!/usr/bin/env python3
"""Download the actual freely licensed Kenney models/thumbs for offline GFUMES use.

Run: python download_assets.py
This makes the site load CC0 GLBs and preview images from local files.
"""
from pathlib import Path
from urllib.request import urlopen, Request
import time

ROOT = Path(__file__).resolve().parent
FILES = [
    'prototype-kit/crate-color.glb',
    'prototype-kit/crate.glb',
    'car-kit/box.glb',
    'food-kit/pizza-box.glb',
    'blocky-characters/character-a.glb',
    'prototype-kit/thumbs/crate-color.webp',
    'prototype-kit/thumbs/crate.webp',
    'car-kit/thumbs/box.webp',
    'food-kit/thumbs/pizza-box.webp',
    'blocky-characters/thumbs/character-a.webp',
]
BASES = [
    'https://cdn.jsdelivr.net/gh/Hidencod/tge-assets@main/packs/',
    'https://raw.githubusercontent.com/Hidencod/tge-assets/main/packs/',
    'https://hidencod.github.io/tge-assets/packs/',
]

def fetch(filename):
    dest = ROOT / 'assets' / ('thumbs' if '/thumbs/' in filename else 'models') / filename.replace('/thumbs/', '/')
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.is_file() and dest.stat().st_size > 100:
        print('✓ Existing', filename)
        return True
    for base in BASES:
        url = base + filename
        try:
            req = Request(url, headers={'User-Agent': 'GFUMES-parody-asset-loader/1.0'})
            with urlopen(req, timeout=30) as response:
                blob = response.read()
            signature = b'glTF' if filename.endswith('.glb') else b'RIFF'
            if not blob.startswith(signature):
                raise ValueError('Bad binary file signature')
            dest.write_bytes(blob)
            print('✓ Downloaded', filename, f'({len(blob):,} bytes)')
            return True
        except Exception as e:
            print('  Trying mirror for', filename, ':', str(e)[:90])
            time.sleep(.25)
    return False

if __name__ == '__main__':
    print('Downloading Kenney CC0 low-poly models and thumbnails...')
    results = [fetch(file) for file in FILES]
    if all(results):
        (ROOT / 'asset-config.js').write_text('window.GFUMES_USE_LOCAL_ASSETS = true;\n')
        print('\nAll assets ready! GFUMES now uses local files (no model CDN required).')
    else:
        print('\nSome files could not be downloaded. Online model fallback remains available.')
        print('Rerun this script with a working internet connection.')
    print('Start the site with: python -m http.server 8000')
