# Local reward editor

MSI loads this editor automatically and serves it through MSI's existing local
HTTP server. Open the Local Pages hub and choose Reward Workshop; with the
default MSI configuration its address is `http://127.0.0.1:8000/reward/editor/`.
The editor and its reward-page previews are available only from the same PC.
Edits go directly into this website checkout. There is no commit, push, or
deploy action.

For standalone development only, it can still be started from the website
checkout with:

```powershell
python tools/reward-editor-local/server.py --port 4174
```

The standalone server listens on loopback only, blocks access to private files,
and writes to the same checkout. The editor directory is excluded from the
Jekyll site build. The private reservation rules remain in the Git-ignored
`reward/api/reservations.local.txt` file.
