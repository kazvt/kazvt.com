KAZVT — CENTRAL EDITING MAP
===========================

LINKS / CLEAN REDIRECT URLS
---------------------------
Edit: /links.js

That is the single redirect config for destination URLs, clean short paths,
per-redirect logos, live variants, and redirect delay. Visible redirect wording
stays in the active language file.

After changing shortPath/liveShortPath, run:
  node zzz_redirect/build-shortlinks.mjs

The included GitHub workflow also regenerates the folders automatically on
push.

LANGUAGES / ALL USER-FACING TEXT
--------------------------------
Edit: /languages.txt for the language list.
Edit: /english.txt for the current English UI copy.

Each language manifest line is:
  language-file-name=html-language-code

Shared language selector styles are in:
  /zzz_shared/language-dock.css

Root i18n / selector behavior is in:
  /i18n.js
  /language-dock.js

EMOTES
------
Drop emote files into:
  /zzz_assets/emotes/

The filename stem is the token, regardless of file extension. Examples:
  oogway1.png     -> oogway1
  [wumpa].gif     -> [wumpa]
  (example).webp  -> (example)

Brackets/parentheses are only required when they are literally part of the
filename. /scripts/build-emote-manifest.py updates the folder manifest, and the
included GitHub workflow runs it automatically when emote files change. Runtime
code also discovers directory listings on hosts that expose them.

CURSOR / SHARED FILES
---------------------
Shared palette cursor mappings are in:
  /zzz_shared/cursor-packs.css

Redirect system files are in:
  /zzz_redirect/
