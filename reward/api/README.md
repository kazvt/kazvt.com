# GitHub-only reward issuing

GitHub Pages is static hosting: it cannot run a private API, keep a secret, or update files in the repository. This implementation uses GitHub Actions as the small write bridge and GitHub Pages as the public read-only site. It adds no Cloudflare Worker, database, or other hosting service.

## What happens when a trusted game issues a reward

1. A trusted local game/OBS companion process calls `issueAward()` from `issue-award.mjs`.
2. The helper reads the published artwork catalog and assignment list from `https://kazvt.com` and chooses an available artwork by its SHA-256 content ID.
3. It dispatches `.github/workflows/issue-reward.yml` through GitHub's workflow-dispatch API.
4. The workflow runs on GitHub, serializes writes, validates that the artwork is published and still unassigned, records one assignment, and commits the public JSON registry.
5. The workflow explicitly starts the GitHub Pages deploy workflow. The helper waits until the award appears on Pages and returns the short reward URL.

The browser only reads the public `manifest.json` and `assignments.json`. No issuance credential or write endpoint is included in the website.

## One-time credential setup

Create a fine-grained personal access token on GitHub with access to only `kazvt/kazvt.com` and the repository permission **Actions: Read and write**. The helper needs this permission to dispatch the workflow and check its run. It does not need Contents write permission; the workflow's repository-scoped `GITHUB_TOKEN` commits the assignment.

Store the token only in the trusted local process environment as `KAZVT_GITHUB_ISSUER_TOKEN`. Do not put it in browser JavaScript, an OBS browser source, this repository, or game code distributed to players. Anyone who obtains the token can request issuance as the repository owner. Rotate it in GitHub if it is exposed. The workflow also refuses to run its issuing job unless the dispatch actor is the repository owner and the ref is `main`.

The token is not needed to browse rewards or list available artwork:

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

`eventId` must be stable and unique for one game win. Reuse the same value for a retry; a retry with the same winner and artwork returns the original link. Reusing it for a different winner/artwork is rejected. Do not generate a new event ID just because a request timed out.

`listAvailableArtwork()` only sees changes after the catalog is on Pages. Each returned `assetId` identifies the exact PNG bytes, so renaming a reward file does not change its identity. Add PNGs to `zzz_assets/rewards/`; the generated-files workflow refreshes the catalog. The issue workflow checks the current catalog and registry again before committing, so stale clients cannot double-assign the same artwork.

## Limits and security boundary

- This is not an API hosted by Pages. Issuance requires an authenticated GitHub workflow dispatch from a trusted process.
- The assignment list and reward cards are public. The random link ID is an opaque lookup ID, not proof of identity or a secret claim token.
- A compromised PAT can issue awards, so keep it on the trusted machine and restrict it to this repository. Do not include it in a public browser game.
- GitHub Actions and Pages can take seconds or minutes to finish. The helper waits for publication; a timeout does not mean the workflow failed. Check the Actions run and retry with the same `eventId`.
- The workflow serializes its own writes and rejects already-assigned artwork. Do not issue from the separate local OBS issuer at the same time; that existing local tool is not coordinated with GitHub's workflow lock.
- The API credential can trigger repository workflows within its granted GitHub permission. The dispatch workflow is constrained to the repository owner and `main`, but this is a modest personal-site safeguard, not a high-stakes prize system.

For a real prize, money, or private access, this GitHub-only design is not appropriate: it has no private database, expiration, revocation, or identity verification.
