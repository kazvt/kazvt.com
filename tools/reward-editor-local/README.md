# Local reward editor

Start it from the website checkout with:

```powershell
python tools/reward-editor-local/server.py
```

Then open the exact `http://127.0.0.1:4174/reward/editor/` address printed in the terminal. It serves the actual reward pages from this checkout in its preview and writes edits back into the corresponding website files. Stop it with `Ctrl+C`.

The server listens on loopback only, blocks access to private files, and has no commit, push, or deploy action. The editor directory is excluded from the Jekyll site build. The private reservation rules remain in the Git-ignored `reward/api/reservations.local.txt` file.
