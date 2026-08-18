KAZVT CLEAN SHORTLINKS — QUICK EDIT GUIDE
==========================================

THE ONE FILE YOU USUALLY EDIT
-----------------------------
Open: links.js

Each entry has:
  url              = where it redirects
  redirectText     = custom text shown during the 1-second transition
  destinationText  = the smaller destination label
  delayMs          = redirect delay in milliseconds (1000 = 1 second)
  shortPath         = optional clean URL path used by the main-site button

INCLUDED EXAMPLE
----------------
kazvt.com/bsky

The folder is:
  /bsky/index.html

It automatically reads the "bsky" entry from links.js and then redirects to
that entry's url after its delayMs. The bsky index.html itself contains no
profile URL, so you never have to edit the same link in two places.

HOW TO ADD kazvt.com/twitch LATER
---------------------------------
1. Copy the entire /bsky/ folder.
2. Rename the copy to /twitch/.
3. In links.js, edit the existing twitch entry's url/text as desired.
4. If you want the Twitch button on the main site to use kazvt.com/twitch too,
   add this inside the twitch entry:

     shortPath: "twitch"

No edits to /twitch/index.html are needed.

SHARED FILES
------------
/redirect/redirect.css   = shared themed graphics and animation
/redirect/redirect.js    = shared redirect logic
/links.js                = your destinations + per-link text/timing
/redirect.html           = generic redirect for miscellaneous outside links
/bsky/index.html          = example clean shortlink folder

The redirect transition has no confirmation/cancel UI. It loads lightweight
local assets, shows the themed KAZVT animation, and redirects automatically.

SHARED LANGUAGE SELECTOR
------------------------
Every page, including /bsky/, loads the same selector from:
  /shared/language-dock.js
  /shared/language-dock.css

Edit /languages.txt to change the language list globally. The selector keeps
its lineboil effect on desktop and phone without using the mobile-problematic
large SVG displacement filter.
