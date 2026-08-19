#!/usr/bin/env python3
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
emote_dir = root / "zzz_assets" / "emotes"
files = sorted(
    p.name for p in emote_dir.iterdir()
    if p.is_file() and p.name != "manifest.json" and not p.name.startswith(".")
)
(emote_dir / "manifest.json").write_text(
    json.dumps({"files": files}, indent=2, ensure_ascii=False) + "\n",
    encoding="utf-8",
)
print(f"wrote {len(files)} emote file(s)")
