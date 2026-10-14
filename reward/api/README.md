# Local reward issuer

GitHub Pages stays static. Award issuance happens only on the streaming PC through the existing `msi.py` HTTP server; it does not add a GitHub Actions issuer, PAT, database, Cloudflare Worker, or other service. The server accepts issuer requests from loopback only, then uses the site's existing Git login to publish the one updated public registry file.

## Use it from a trusted local game process

Keep MSI running, then import the small Node client from a trusted local program:

```js
import { listAvailableArtwork, issueAward } from "./reward/api/issue-award.mjs";

const available = await listAvailableArtwork();
const { assignment, href } = await issueAward({
  username: winnerName,
  assetId: available[0].assetId,
  eventId: `match-${matchId}-winner-${winnerId}`,
  platform: "stream-game"
});
```

`GET http://127.0.0.1:8000/reward-api/available` returns catalogued PNGs that have not already been awarded. `POST http://127.0.0.1:8000/reward-api/issue` takes JSON with `username`, `assetId`, a stable `eventId`, and optional `platform`. The client supplies the required local same-origin header. `issueAward()` waits until the public Pages registry contains the new link, then returns `{ assignment, href, replayed, pushed }`.

Give the same stable `eventId` to retries. MSI stores only its SHA-256 digest in the public registry. A retry for the same winner and art returns the original link; trying to reuse that event for another winner/art is rejected. Each PNG's exact bytes are checked against its SHA-256 catalog ID and dimensions immediately before assignment, and a PNG can only be assigned once.

New art belongs in `zzz_assets/rewards/`. It is eligible after the repository's reward catalog has been regenerated and published. The filename is only a display name; the SHA-256 asset ID is the identity.

## What it publishes

Before writing, MSI checks that the configured folder is the `kazvt/kazvt.com` checkout, on `main`, clean, and synchronized with `origin/main`. It refuses if it sees unrelated edits or commits. It stages only `zzz_assets/rewards/assignments.json`, creates a small reward-specific commit, and pushes with the Git credentials already configured on that PC. The existing Pages-on-push publishing then makes the static record live. If push or deployment is delayed, retry using the same `eventId`; do not invent a new one.

There is no new token to create or paste anywhere. This assumes `git push` already works from the website checkout on the MSI computer. If it does not, the issuer refuses and reports a publish error; it will not switch to an unauthenticated or public write path. After updating `msi.py`, restart MSI once so its existing port-8000 server loads the route.

## Safety boundary

- `/reward-api/*` is not part of the public website and is not an internet-facing issuer. MSI checks the client address, local Host, and same-origin headers; it emits no CORS permission. Requests from other computers and cross-origin web pages are rejected.
- This is intentionally modest protection: any program already running as the local Windows user can call loopback and issue awards. Do not expose port 8000 through a router, tunnel, or public reverse proxy, and do not put the client in code distributed to players.
- `assignments.json` and all award images are public. Opaque reward IDs identify existing cards; they do not prove who opened a link, keep an award private, or prevent copying.
- The older OBS trivia widget has its own local assignment writer and private queue. Do not issue awards in both it and MSI at the same time; they share the public registry but have no cross-process lock. Use one issuer at a time.
- For real money, valuable prizes, accounts, private access, expiry, or revocation, this local/static setup is not enough. This is a convenience feature for stream-game rewards, not a high-stakes authorization system.
