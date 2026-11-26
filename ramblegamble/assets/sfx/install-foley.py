#!/usr/bin/env python3
"""Install existing recorded foley; no synthesis, no database access, no credentials required for pack.
Run from any directory. Optional --kenney-zip and --recordings allow offline installation.
Freesound public high-quality previews are preferred; an optional API token improves lookup reliability.
"""
import argparse
import html
import io
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import urllib.parse
import urllib.request
import zipfile

DEST = Path(__file__).resolve().parent / "foley"
KENNEY_PAGE = "https://kenney.nl/assets/casino-audio"
KENNEY_DOWNLOAD_ID = "assets/casino-audio".encode("utf-8").hex()
KENNEY_DOWNLOAD_LINK = f"https://kenney.nl/download-link/{KENNEY_DOWNLOAD_ID}"
# destination : exact normalized basename from the CC0 pack
PACK = {
    **{f"card-place-{n}.ogg": f"cardplace{n}.ogg" for n in (1, 2)},
    **{f"card-slide-{n}.ogg": f"cardslide{n}.ogg" for n in (1, 2, 3)},
    "card-shuffle.ogg": "cardshuffle.ogg",
    **{f"chips-handle-{n}.ogg": f"chipshandle{n}.ogg" for n in (1, 2)},
    **{f"chip-lay-{n}.ogg": f"chiplay{n}.ogg" for n in (1, 2)},
    **{f"die-shuffle-{n}.ogg": f"dieshuffle{n}.ogg" for n in (1, 2)},
    **{f"die-throw-{n}.ogg": f"diethrow{n}.ogg" for n in (1, 2, 3)},
}
# title, creator, ID, expected license URL suffix. All described as physical sounds;
# wheel uses a field recording of a hard ball rolling in a bowl.
RECORDINGS = {
    "switch.mp3": ("Crinkem", 496328, "publicdomain/zero/1.0/"),
    "lever.mp3": ("xkeril", 815492, "publicdomain/zero/1.0/"),
    "reel.mp3": ("alexarje", 863094, "licenses/by/4.0/"),
    "wheel.mp3": ("Stagno", 705775, "publicdomain/zero/1.0/"),
}
LIMIT = 20 * 1024 * 1024

def get(url, referer=None):
    headers = {"User-Agent": "RambleGamble-foley-installer/1.0"}
    if referer:
        headers["Referer"] = referer
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=25) as response:
        data = response.read(LIMIT + 1)
    if len(data) > LIMIT:
        raise ValueError("download too large")
    return data

def valid(name, data):
    if name.endswith(".ogg"):
        return data.startswith(b"OggS") and len(data) > 100
    return len(data) > 100 and (data.startswith(b"ID3") or (data[0] == 255 and data[1] & 224 == 224))

def write(name, data):
    if not valid(name, data):
        raise ValueError(f"{name}: not expected audio format")
    DEST.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=DEST, delete=False) as f:
        tmp = Path(f.name)
        f.write(data)
    try:
        tmp.chmod(0o644)
        tmp.replace(DEST / name)
    finally:
        tmp.unlink(missing_ok=True)
    print(f"Installed {name} ({len(data):,} bytes)")

def has(name):
    path = DEST / name
    return path.is_file() and valid(name, path.read_bytes())

def pack_files(data):
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        files = {re.sub(r"[-_ ]", "", Path(n).name.lower()): n for n in z.namelist() if n.lower().endswith(".ogg")}
        for name, expected in PACK.items():
            if not has(name):
                entry = files.get(expected)
                if not entry:
                    print(f"Pack missing {expected}", file=sys.stderr)
                    continue
                if z.getinfo(entry).file_size > LIMIT:
                    raise ValueError("oversized pack entry")
                write(name, z.read(entry))

def download_kenney_pack():
    metadata = json.loads(get(KENNEY_DOWNLOAD_LINK, referer=KENNEY_PAGE))
    url = metadata.get("url")
    parsed = urllib.parse.urlparse(url or "")
    if parsed.scheme != "https" or parsed.hostname != "kenney.nl" or not parsed.path.startswith("/download/"):
        raise ValueError("Kenney did not return its expected HTTPS download link")
    return get(url, referer=KENNEY_PAGE)

def preview(user, sound_id, license_suffix):
    token = os.environ.get("FREESOUND_API_TOKEN")
    if token:
        query = urllib.parse.urlencode({"token": token, "fields": "id,username,license,previews"})
        try:
            meta = json.loads(get(f"https://freesound.org/apiv2/sounds/{sound_id}/?{query}"))
        except Exception:
            # Never print errors containing the token-bearing URL.
            raise RuntimeError("Freesound metadata request failed; verify the API token") from None
        if meta.get("id") != sound_id or meta.get("username", "").lower() != user.lower() or not meta.get("license", "").endswith(license_suffix):
            raise ValueError("source identity or license changed")
        url = meta["previews"]["preview-hq-mp3"]
    else:
        page = html.unescape(get(f"https://freesound.org/people/{user}/sounds/{sound_id}/").decode("utf-8", "replace")).replace(r"\/", "/")
        if license_suffix not in page:
            raise ValueError("license could not be reverified; use API token or original source")
        matches = re.findall(rf'https://(?:cdn\.)?freesound\.org/(?:data/)?previews/\d+/{sound_id}_\d+-hq\.mp3', page)
        if not matches:
            raise ValueError("public preview URL unavailable; use API token or local recording")
        url = matches[0]
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in {"cdn.freesound.org", "freesound.org"}:
        raise ValueError("unexpected preview host")
    return get(url)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--kenney-zip", type=Path)
    parser.add_argument("--recordings", type=Path, help="directory containing source recordings converted to exact MP3 filenames (see SOURCES.md)")
    args = parser.parse_args()
    if not all(has(name) for name in PACK):
        try:
            pack_files(args.kenney_zip.read_bytes() if args.kenney_zip else download_kenney_pack())
        except Exception as error:
            print(f"Kenney pack: {error}", file=sys.stderr)
    for name, (user, sound_id, license_suffix) in RECORDINGS.items():
        if has(name):
            continue
        try:
            local = args.recordings / name if args.recordings else None
            data = local.read_bytes() if local and local.is_file() else preview(user, sound_id, license_suffix)
            write(name, data)
        except Exception as error:
            print(f"{name}: {error}", file=sys.stderr)
    missing = [name for name in [*PACK, *RECORDINGS] if not has(name)]
    if missing:
        print("Missing audio (game remains playable): " + ", ".join(missing), file=sys.stderr)
        return 1
    print("All recorded foley assets installed.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
