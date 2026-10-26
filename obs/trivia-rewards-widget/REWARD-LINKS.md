# Reward links: flow and limits

## How a chat win becomes a link

```text
Correct chat answer
      ↓
OBS widget proposes one PNG
      ↓ POST on 127.0.0.1 only
Local server records assignment + creates a short random ID
      ↓
Reward Links dashboard → Copy into chat
      ↓
Viewer opens https://kazvt.com/reward/?id=<16-character-ID>
      ↓
Reward page accepts only a matching public assignment and shows it
```

The OBS widget receives chat over the existing WebSocket. Its local Python server records the generated link in an ignored `.reward-queue.json` file. That local file contains the full bearer link, username, and PNG filename in readable form; it is excluded from Git and the distributable ZIP. Open `http://127.0.0.1:8765/reward-links.html` on the streaming PC and copy the ready-to-send link into chat. The dashboard retains the 250 most recent links and refreshes every five seconds.

## Link format and validation

New links contain a 16-character URL-safe random ID (96 bits): `https://kazvt.com/reward/?id=<16-character-ID>`. The trusted local Python issuer generates each ID with a cryptographically secure random source and writes it into both the durable local ownership ledger and the public assignment index. IDs are case-sensitive. The public page treats the index as an allowlist: it looks up the exact ID, then uses the recorded username and artwork. It never accepts a username or artwork from the URL. An unlisted ID is rejected, as are duplicate IDs in the registry. Previously issued UUID links continue to work.

The separate [MSI local issuer](../../reward/api/README.md) is available to trusted local game programs at `http://127.0.0.1:8000/reward-api/`. It checks the local catalog and Git checkout, then pushes only `assignments.json` using the Git credentials already configured on the streaming PC. It uses no reward-issuing GitHub Action or additional token. It is not coordinated with the OBS widget's own local issuer; use only one issuer at a time.

The IDs are public, shareable identifiers, not passwords. Anyone can copy a known reward URL and open that existing award; the random ID prevents creating a new official award merely by inventing a URL. Because the site is static, it cannot authenticate the person viewing a card or keep public assignments secret. Actual private access or revocation would require a trusted backend with authorization checks.

Previously issued JWE links remain readable for compatibility, but only when their decrypted username and artwork content ID exactly match a public assignment. This compatibility path cannot create a second assignment. New links and the OBS widget no longer encrypt data in the browser or put a decryption key in the URL.

## What this link proves-and what it does not

This is a self-contained share card for public art, not a login token or a way to redeem, claim, or spend anything. The image and assignment are public. Copying an existing reward link opens the already-recorded award; inventing a different ID does not create another award because it has no matching registry record.

The local widget assigns each distinct PNG artwork at most once. The content ID for the `1.png` artwork is preassigned to `kazvt`; additional assignments are kept in the all-time `owners` map in the local `.reward-queue.json` state file. The current filename is a display label, not the ownership key, so renames preserve assignments and new links. The queue retains only the 250 newest full links, but the ownership map is never truncated. Removed artwork remains assigned by ID if later re-added with the same bytes. Once every distinct artwork item is assigned, the widget stops issuing rewards until new artwork is added.

The one-of-one rule is enforced against the public assignment index by each issuer, but the OBS widget and MSI do not share a cross-process lock. Do not issue from both systems simultaneously; let one finish publishing before switching. Opaque IDs make arbitrary, unrecorded cards fail validation; they do not make a public card private or prove who owns the browser that opened it. The Frequent, Uncommon, Rare, Epic, Legendary, Mythic, Divine, or Good Shit tier remains fixed from the PNG's SHA-256 content hash; only direct reward pages use the corresponding tier palette. Index, username, and demo views use the neutral loading-page theme.

This limit follows from the static-site setup. GitHub Pages publishes HTML, CSS, and JavaScript; it does not provide a private server endpoint or database that can check who issued a claim. Therefore these links do not expire, cannot be revoked, and do not prevent copying. For a real or scarce prize, use a backend to issue high-entropy random IDs, store the authoritative winner and item server-side, and support expiry, revocation, and one-time redemption. Keep the platform credentials and issuance secret in that trusted backend or a local bot process, never in the public page.

## Public assignment index

`zzz_assets/rewards/assignments.json` (served at `/zzz_assets/rewards/assignments.json`) is the public, reusable assignment index. The page at `/reward/list/` reads this file together with the reward catalog. Version 1 uses one record per artwork content hash:

```json
{
  "version": 1,
  "assignments": [
    {
      "assetId": "lowercase SHA-256 content ID from the reward catalog",
      "assetSha256": "same value; legacy-compatible field",
      "filename": "1.png",
      "username": "kazvt",
      "issuedAt": "2026-10-13T00:00:00.000Z",
      "platform": "manual",
      "linkId": "aB3_dE5-fG7_hJ9k"
    }
  ]
}
```

Other systems can read this format and should join records to `manifest.json` by `assetId` (or legacy `assetSha256`), never by filename. The filename is only the current human-readable label. `linkId` is the public compact ID used by `/reward/?id=…`; it is an opaque lookup key, not a secret. The optional `eventIdHash` field is a SHA-256 digest used to make local game retries idempotent; the original event ID is not published. The list searches usernames and the current artwork filename, and uses the content ID to find renamed artwork. Older records remain searchable if artwork is later removed or replaced, but their detail link is disabled unless both the matching content and a link ID are present. The local OBS issuer imports this registry when checking availability and updates it after an award, alongside its private ignored queue. The MSI issuer publishes only this JSON file using the local checkout's existing Git login. The public file intentionally contains no full URLs, keys, or encrypted payloads. It is a public index, not a secure proof of ownership. A read-only/distributable copy cannot issue a working public award because it cannot update the registry.

## Chat posting

The current trivia WebSocket is receive-only. The widget creates each URL and puts it in the local dashboard, but it cannot post to Twitch, YouTube, or Kick by itself. Automatic posting requires an authenticated sender in the local chat bridge. For example, Twitch's Send Chat Message API requires a user token with `user:write:chat` or the documented bot scopes; YouTube's live chat insert API requires OAuth authorization. Those credentials belong in the bridge, not OBS page JavaScript or GitHub. Until an outbound bridge is configured, the dashboard's copy-and-paste step is intentional.

## Design references

- [Python `secrets`](https://docs.python.org/3/library/secrets.html) provides cryptographically strong random tokens; new IDs use 12 random bytes encoded as 16 URL-safe characters.
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) explains that unpredictable or complex IDs do not replace server-side authorization checks; here, the assignment registry is the allowlist, while IDs are only identifiers.
- [RFC 7516: JSON Web Encryption](https://www.rfc-editor.org/rfc/rfc7516.html) documents the legacy encrypted-link format retained only for backward compatibility.
- [OWASP REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html#sensitive-information-in-http-requests) warns against putting credentials or security tokens in URLs because requests can be logged. These IDs are public lookup identifiers, not credentials; assignments are already intentionally public.
- [OWASP Forgot Password guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html#url-tokens) recommends secure random tokens, expiry, and invalidation for links that grant a real account action. Those server-side controls are intentionally absent here because this page only displays public images.
- [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) publishes a static site from repository files; this is why issuance history stays on the streaming PC.
- [Anime.js animation documentation](https://animejs.com/documentation/animation/) documents the property animations and loops used by the reward badge. The page honors the user's reduced-motion preference as described by [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion).
- [MDN SubtleCrypto.digest()](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest) describes SHA-256 digests as fixed-length values derived from arbitrary input. The catalog generator hashes each complete PNG once and stores its tier, avoiding per-viewer file hashing.
- [Twitch Send Chat Message](https://dev.twitch.tv/docs/api/reference/#send-chat-message) and [YouTube LiveChatMessages: insert](https://developers.google.com/youtube/v3/live/docs/liveChatMessages/insert) show that automatic chat replies are authenticated API operations.
