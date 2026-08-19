KAZVT CLEAN SHORTLINKS — QUICK EDIT GUIDE
==========================================

THE ONE REDIRECT CONFIG FILE
----------------------------
Edit: /links.js

Each redirect entry supports:
  url            = destination URL
  liveUrl        = optional separate live destination
  shortPath      = clean kazvt.com path, e.g. "yt" -> kazvt.com/yt/
  liveShortPath  = optional clean path for liveUrl
  logo           = image shown by that redirect page
  delayMs        = redirect delay in milliseconds

If logo is omitted, the default redirect logo from KAZVT_REDIRECT_DEFAULTS is
used. All user-visible redirect wording is in the active language .txt file,
not links.js.

CURRENT EXAMPLES
----------------
kazvt.com/yt/
kazvt.com/bsky/
kazvt.com/spotify/
kazvt.com/obs/

GENERATING CLEAN PATH FOLDERS
-----------------------------
After adding/removing a shortPath in links.js, run:

  node zzz_redirect/build-shortlinks.mjs

That generator reads links.js and creates the matching /word/index.html pages
from /zzz_redirect/template.html. The included GitHub Actions workflow runs the
same generator automatically when links.js or the redirect template changes.

SHARED REDIRECT FILES
---------------------
/links.js                         = every redirect destination/path/logo/timing
/zzz_redirect/template.html       = redirect page HTML template
/zzz_redirect/redirect.css        = redirect style + animation
/zzz_redirect/redirect.js         = redirect routing logic
/zzz_redirect/build-shortlinks.mjs= clean-folder generator
/redirect.html                    = legacy generic redirect compatibility page

FOLDER NAMES
------------
Shared site files use /zzz_shared/.
Redirect system files use /zzz_redirect/.

LANGUAGE TEXT
-------------
All visible redirect labels/status messages/titles live in the language files,
currently /english.txt. Redirect pages load the same root i18n/language selector
used by the main site.
