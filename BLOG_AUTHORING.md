# Blog authoring and publishing

The public archive lives at `/blog/`. Its source of truth is `blog/posts.json`, a versioned JSON manifest that the browser reads directly. Post pages use shareable URLs such as `/blog/?post=first-post`; tag links use `/blog/?tag=art`.

## Publish a post

1. Start or restart MSI as usual from `C:\Users\pc\Documents\MEGA\ellie acoustic\programming stuff\OpenSeeFace-v1.20.4`, then open `http://localhost:8000/blog/write/`. MSI's existing server also serves the public archive at `http://localhost:8000/blog/`, uses shared files from this site checkout, and keeps the OpenSeeFace folder as its default document root. The writer rejects non-loopback requests. Drafts autosave in this browser only.
2. Choose **add / update in export**, then **download posts.json**.
3. Replace the repository's `blog/posts.json` with the downloaded file.
4. Commit and push that file to `main`. The existing GitHub Pages workflow builds and deploys the site.

The editor is deliberately not served at `kazvt.com/blog/write/`; Jekyll excludes that path from the public deployment, and the writer source lives outside the website repo. Keep the editor available only on your own loopback interface. GitHub Pages serves static files and does not provide a private write API, so no browser-only password can securely gate a public editor. No GitHub token, account credential, or draft is sent to a server; only people with repository write access can publish a changed manifest.

If you edit a post already in the export list, use **edit selected**, then **add / update in export**. Removing a post from that list does not remove it from the live site until the replacement manifest is pushed. Importing a `posts.json` file replaces only the local prepared list; browser drafts are separate.

## Manifest shape

```json
{
  "schema_version": 1,
  "posts": [
    {
      "slug": "first-post",
      "title": "First post",
      "summary": "A short optional description.",
      "tags": ["art", "web"],
      "publishedAt": "2026-09-29T08:00:00.000Z",
      "updatedAt": "2026-09-29T08:00:00.000Z",
      "content": {
        "ops": [
          { "insert": "A paragraph with " },
          { "insert": "bold text", "attributes": { "bold": true } },
          { "insert": ".\n" }
        ]
      }
    }
  ]
}
```

`publishedAt` and `updatedAt` are ISO 8601 timestamps in UTC. `content` is a Quill Delta document (not arbitrary HTML); the renderer keeps only supported text formatting, safe links, images, and approved video sources. Posts are sorted by publication time, newest first by default.

## Media and safety

- Uploaded JPG, PNG, and WebP images are resized/converted in the browser and embedded in the post data. Animated GIFs are preserved, with a 1.1 MB upload limit. Direct image links must use HTTPS. Add alt text or explicitly mark an image decorative.
- YouTube and Vimeo links become privacy-enhanced video embeds; Spotify and SoundCloud links become audio embeds; direct HTTPS MP4/WebM URLs become video players. External media is not contacted until a reader activates its load button.
- The editor does not accept arbitrary iframe or HTML embeds. Use a normal link for other services. This keeps the manifest portable and prevents pasted markup from becoming executable page content.
- Large uploaded images increase `posts.json`; the editor warns before exporting a manifest above 2 MB. Optimize or remove large media before committing.

Quill 2.0.3 is bundled locally under `zzz_assets/vendor/quill/` so the editor has no runtime CDN dependency. Its license is next to the bundle.

## Design notes

- The site is hosted as static files, so the manifest is the published source of truth and the browser editor is a local-first authoring tool. This keeps publishing compatible with the existing deployment and avoids exposing a write credential in client-side JavaScript.
- Rich text is stored as Quill Delta JSON, then rendered from an explicit allow-list rather than arbitrary saved HTML. Media providers are parsed into canonical URLs; arbitrary iframe markup is never accepted.
- Search, tag filtering, and sort are available together, with visible result counts, preserved URL state, and a clear-all action. Draft, export, and live-publish states are intentionally separate so a local edit cannot silently appear on the public site.
- External embeds are click-to-load. The page has a lightweight baseline layout and uses the site's existing palette, music, and navigation components; the editor toolbar supports keyboard arrow navigation.

These choices follow [GitHub Pages' static hosting model](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [Quill's document Delta format](https://quilljs.com/docs/delta), [OWASP's XSS guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html), the [WAI-ARIA toolbar pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/), and [WCAG 2.2's target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum). Dates use semantic HTML `<time datetime>` values. Search/filter behavior includes the DWP Design System's optional controls, visible result feedback, and clear-all convention ([filter guidance](https://design-system.dwp.gov.uk/contribute/filters)). The media cards follow the URL-first, block-based authoring affordance used by [Ghost](https://ghost.org/help/cards/), while limiting iframe sources to documented [Spotify](https://developer.spotify.com/documentation/embeds) and [SoundCloud](https://developers.soundcloud.com/docs/oembed) integrations.
