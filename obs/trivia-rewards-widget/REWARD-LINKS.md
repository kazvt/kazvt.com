# Reward links: flow and limits

## How a chat win becomes a link

```text
Correct chat answer
      ↓
OBS widget selects one PNG and encrypts { username, assetId }
      ↓ POST on 127.0.0.1 only
Local reward queue → Reward Links dashboard → Copy into chat
      ↓
Viewer opens https://kazvt.com/reward/?id=…#key=…
      ↓
Reward page decrypts the claim, checks the public PNG catalog, and shows it
```

The OBS widget receives chat over the existing WebSocket. Its local Python server records the generated link in an ignored `.reward-queue.json` file. That local file contains the full bearer link, username, and PNG filename in readable form; it is excluded from Git and the distributable ZIP. Open `http://127.0.0.1:8765/reward-links.html` on the streaming PC and copy the ready-to-send link into chat. The dashboard retains the 250 most recent links and refreshes every five seconds.

## Link format

The query parameter `id` is a JWE Compact Serialization with the protected header `{"alg":"dir","enc":"A256GCM"}`. New links encrypt the version, chat display name, and artwork `assetId`; older version-1 links contain a filename and resolve through the catalog's preserved filename history. An asset ID is SHA-256 of the exact PNG bytes; the catalog also stores width and height. The direct 256-bit key is generated separately for each link and placed in the URL fragment as `#key=…`. AES-GCM uses a fresh 96-bit random IV and a 128-bit authentication tag; the protected header is authenticated as additional data. The page accepts only this algorithm pair and resolves artwork IDs through `/zzz_assets/rewards/manifest.json`.

The fragment is processed by the browser and is not part of the HTTP request. That keeps the decryption key out of ordinary server request logs; the query contains the JWE protected header, IV, ciphertext, and authentication tag, but not the plaintext username, PNG name, or key. The page also sends no referrer and loads only same-origin resources. Copy the entire URL because a link without its fragment key cannot be opened.

## What this link proves—and what it does not

This is a self-contained share card for public art. It is not a login token or proof that the streamer issued the award: anyone with the code can make another key and encrypt a different username or catalog asset ID. The full link lets anyone who receives it view its contents. The image itself is public, and the page does not let a viewer redeem, claim, or spend anything.

The local widget assigns each distinct PNG artwork at most once. The content ID for the `1.png` artwork is preassigned to `kazvt`; additional assignments are kept in the all-time `owners` map in the local `.reward-queue.json` state file. The current filename is a display label, not the ownership key, so renames preserve assignments and new links. The queue retains only the 250 newest full links, but the ownership map is never truncated. Removed artwork remains assigned by ID if later re-added with the same bytes. Once every distinct artwork item is assigned, the widget stops issuing rewards until new artwork is added.

The one-of-one rule is enforced by the issuing widget, not by the public static reward page. The widget checks both its private ledger and the public assignment index, so installations using the same up-to-date repository copy see the same recorded assignments. The index is static and has no real-time lock or automatic GitHub push, so stale copies or concurrent issuers do not coordinate. A JWE link can also be created outside the intended issuer. The card is a shareable display card, not cryptographic proof of exclusive ownership. The Frequent, Uncommon, Rare, Epic, Legendary, Mythic, Divine, or S+ tier remains fixed from the PNG's SHA-256 content hash; its matching pattern palette is cosmetic and independent from the one-time assignment rule.

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
      "platform": "manual"
    }
  ]
}
```

Other systems can read this format and should join records to `manifest.json` by `assetId` (or legacy `assetSha256`), never by filename. The filename is only the current human-readable label. The list searches usernames and the current artwork filename, and uses the content ID to find renamed artwork. Older records remain searchable if artwork is later removed or replaced, but their detail link is disabled unless the matching content is present. The local OBS issuer imports this registry when checking availability and updates it after an award, alongside its private ignored queue. The public file intentionally contains no encrypted URLs, keys, or bearer-link data. It is a public index, not a secure proof of ownership. The issuer does not push to GitHub; publish its local registry changes with the usual repository commit/push workflow. A read-only/distributable copy can still use its private ledger, but cannot update the repository index.

## Chat posting

The current trivia WebSocket is receive-only. The widget creates each URL and puts it in the local dashboard, but it cannot post to Twitch, YouTube, or Kick by itself. Automatic posting requires an authenticated sender in the local chat bridge. For example, Twitch's Send Chat Message API requires a user token with `user:write:chat` or the documented bot scopes; YouTube's live chat insert API requires OAuth authorization. Those credentials belong in the bridge, not OBS page JavaScript or GitHub. Until an outbound bridge is configured, the dashboard's copy-and-paste step is intentional.

## Design references

- [RFC 7516: JSON Web Encryption](https://www.rfc-editor.org/rfc/rfc7516.html) defines the five-part URL-safe compact format and protected-header authentication used for `id`.
- [Web Crypto Level 2](https://www.w3.org/TR/WebCryptoAPI/) and [MDN's AES-GCM parameters](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams) document browser AES-GCM, IV uniqueness, and authenticated additional data.
- [RFC 3986, section 3.5](https://www.rfc-editor.org/rfc/rfc3986.html#section-3.5) defines fragment identifiers as client-side URI components separated before dereferencing.
- [OWASP REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html#sensitive-information-in-http-requests) warns against putting credentials or security tokens in URLs because requests can be logged. This design keeps the actual username and PNG name encrypted in the query and keeps the key in the fragment, but the full share link is still a bearer link and remains in the recipient's browser history.
- [OWASP Forgot Password guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html#url-tokens) recommends secure random tokens, expiry, and invalidation for links that grant a real account action. Those server-side controls are intentionally absent here because this page only displays public images.
- [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) publishes a static site from repository files; this is why issuance history stays on the streaming PC.
- [Anime.js animation documentation](https://animejs.com/documentation/animation/) documents the property animations and loops used by the reward badge. The page honors the user's reduced-motion preference as described by [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion).
- [MDN SubtleCrypto.digest()](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest) describes SHA-256 digests as fixed-length values derived from arbitrary input. The catalog generator hashes each complete PNG once and stores its tier, avoiding per-viewer file hashing.
- [Twitch Send Chat Message](https://dev.twitch.tv/docs/api/reference/#send-chat-message) and [YouTube LiveChatMessages: insert](https://developers.google.com/youtube/v3/live/docs/liveChatMessages/insert) show that automatic chat replies are authenticated API operations.
