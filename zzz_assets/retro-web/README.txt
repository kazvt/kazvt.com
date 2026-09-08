Old-web decoration assets

The homepage scatter reads gifcities/manifest.json and uses the files listed
there, in exactly that order. All assets live together in gifcities/.

To customize the set, add or remove GIFs in that one folder, then edit only
the "files" array in manifest.json. Filenames can be anything; the homepage
does not expect numbering, categories, or a particular naming pattern.

The current assets were downloaded from https://gifcities.org/ and are kept
locally, so the site does not depend on remote GIF URLs at runtime.
