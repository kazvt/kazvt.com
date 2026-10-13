# Kaz Capture update feed

The plugin checks this file at startup and every 24 hours:

`https://kazvt.com/obs/kaz-capture/updates/stable.json`

The GitHub Pages workflow in this repository publishes it with the rest of the
site. Keep the feed small and preserve the schema:

```json
{
  "schema_version": 1,
  "product": "kaz-capture",
  "channel": "stable",
  "version": "MAJOR.MINOR.PATCH",
  "release_url": "https://github.com/kazvt/kazvt.com/releases/tag/kaz-capture-vMAJOR.MINOR.PATCH"
}
```

## Publishing an update

1. Build and test Kaz Capture, then create a GitHub Release tagged
   `kaz-capture-vMAJOR.MINOR.PATCH` in `kazvt/kazvt.com`.
2. Attach `Kaz-Capture-Setup-MAJOR.MINOR.PATCH.exe` to that release.
3. Only after the release is public, change `version` and `release_url` above
   to that exact release, then commit and push the site change. The existing
   GitHub Pages workflow deploys the feed.

The plugin only checks for a newer version and opens the release page when the
user chooses. It does not download or run installers while OBS is open. The
release link is restricted in the plugin to the matching Kaz Capture tag in
this repository.
