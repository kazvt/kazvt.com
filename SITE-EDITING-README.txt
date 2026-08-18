KAZVT — CENTRAL EDITING MAP
===========================

LINKS / SHORT URLS
------------------
Edit: /links.js

That is the single place for profile URLs, redirect messages, destination
labels, delays, and optional clean short paths. Copy /bsky/ to make another
shortlink folder; the copied index.html does not contain a destination URL.

LANGUAGES
---------
Edit: /languages.txt

Each line is:
  language-file-name=html-language-code

Example:
  english=en

The selector is injected everywhere by:
  /shared/language-dock.js

Its appearance + phone-safe lineboil are in:
  /shared/language-dock.css

Actual translated site text stays in the matching language file, for example:
  /english.txt

Because every page loads the same shared selector component, changing the
manifest or the shared selector files changes it everywhere, including 404,
multistream guide, generic redirect, and clean shortlink folders.

CURSOR PACKS
------------
Shared palette cursor mappings are in:
  /shared/cursor-packs.css

New packs requested in this build:
  Palette 5  -> /zzz_assets/cursors/p05-spongebob/
  Palette 6  -> /zzz_assets/cursors/p06-pizza/
  Palette 13 -> /zzz_assets/cursors/p13-tails-pocket-adventure/
  Palette 14 -> /zzz_assets/cursors/p14-nature/

Animated .ani source cursors were converted to a single static .cur frame for
browser compatibility. Semantic filenames such as default.cur, pointer.cur,
text.cur, busy.cur, etc. make later swaps easy.
