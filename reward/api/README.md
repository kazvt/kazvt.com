# Reward API

GitHub Pages serves the reward site as static files; it cannot keep an issuer secret or run the award-writing endpoint. This small Cloudflare Worker is the private issuer boundary, with Cloudflare D1 as the durable one-award-per-artwork ledger. Its public read endpoints only expose the same award records the site already publishes.

## API

`GET /health` checks that the Worker responds.

`GET /v1/artwork/available` lists currently published PNG artwork that has not been assigned. Each item includes the content-based `assetId`, current filename, dimensions, and tier. The caller must send that `assetId` back; filenames are labels and can change.

`POST /v1/awards` issues an award. It requires `Authorization: Bearer <issuer key>` and is server-to-server only (requests with a browser `Origin` are rejected). The JSON body accepts only:

```json
{
  "username": "winner-name",
  "assetId": "64-character SHA-256 from /v1/artwork/available",
  "eventId": "optional-stable-game-win-id",
  "platform": "optional-game-name"
}
```

The response includes a short 22-character random link ID and the public reward URL. Reusing an `eventId` with the same winner/artwork returns the original result, so retrying a timed-out request will not issue twice. Reusing an artwork ID for another award returns `409`. The D1 unique constraints enforce both rules even if two requests arrive at the same time.

`GET /v1/awards` returns the full public assignment index (including the existing static assignments). `?username=name` filters it. `GET /v1/awards/{linkId}` resolves one public award. The site uses these read endpoints for direct reward pages, the public award index, and each user's award collection once `reward/api-config.js` is pointed at the deployed Worker.

Award links are public, opaque identifiers—not proof of a real-world identity or passwords. The issuer key, not the URL, authorizes creation.

## Add or rename reward artwork

Put each new reward PNG in the repository's `zzz_assets/rewards/` directory. Regenerate the browser and widget catalogs with:

```powershell
node obs/trivia-rewards-widget/generate-reward-catalog.mjs
```

That script scans the directory, hashes the exact PNG bytes, derives the tier, preserves filename history, and updates `zzz_assets/rewards/manifest.json`. Publish the updated files to GitHub Pages; after that, `/v1/artwork/available` will see the new PNGs automatically. No Worker code change is needed. Existing artwork must stay byte-identical when renamed; changing the PNG bytes creates a new artwork identity.

The website already loads reward images from `/zzz_assets/rewards/{filename}` and its catalog from `/zzz_assets/rewards/manifest.json`; those paths resolve to `zzz_assets/rewards/` in this repository. The Worker uses the same published catalog and `assignments.json` as its authoritative static inputs.

## One-time Cloudflare setup

Run these commands from this directory with a Cloudflare account available to Wrangler:

1. `npx wrangler d1 create kazvt-rewards`
2. Replace `REPLACE_WITH_D1_DATABASE_ID` in `wrangler.jsonc` with the returned database ID.
3. `npx wrangler d1 migrations apply kazvt-rewards --remote`
4. Generate a 32-byte random key in a trusted terminal (for example, `node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))"`) and store it in a password manager.
5. Run `npx wrangler secret put AWARD_ISSUER_KEY` and paste the key at the hidden prompt. Do not put it in this repository, a workflow log, OBS browser-source HTML, or website JavaScript.
6. Run `npx wrangler deploy`.
7. Set `window.KAZVT_REWARD_API_BASE` in `reward/api-config.js` to the deployed Worker origin. Prefer a custom domain such as `https://api.kazvt.com`; if using the `workers.dev` URL, add that exact origin to `connect-src` in the CSP of `reward/index.html` and `reward/list/index.html`. The Worker CORS allowlist is `ALLOWED_ORIGINS` in `wrangler.jsonc`; keep it limited to the website origins.

The `AWARD_ISSUER_KEY` must live only in a trusted server process, such as a private game/OBS companion process on the streaming PC. A key placed in a public browser game can be extracted by viewers and cannot be made secret by obfuscation. If a key is exposed, rotate it with `npx wrangler secret put AWARD_ISSUER_KEY`.

## Calling it from a trusted Node.js game process

Set `KAZVT_REWARD_API_URL` and `KAZVT_REWARD_ISSUER_KEY` in that process's environment, then call the included helper:

```js
import { issueAward } from "./reward/api/issue-award.mjs";

const { assignment, href } = await issueAward({
  username: winnerName,
  assetId: chosenArtwork.assetId,
  eventId: `round-${roundId}-winner-${winnerId}`
});
```

The game should get `chosenArtwork` from `/v1/artwork/available`. Keep winner selection on the trusted game/server side; the API validates the key, published artwork, unique ownership, and retries, but it cannot independently prove that a game winner was chosen fairly.

## Important issuer boundary

The existing local OBS issuer remains available for compatibility. Do not use it to issue new awards at the same time as this Worker until it is explicitly switched to call the Worker; the Worker can see committed static assignments and its own D1 rows, but cannot see an uncommitted local `.reward-queue.json`. Use one active issuer at a time so the one-of-one rule has a single authoritative writer.
