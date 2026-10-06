# Reward links: flow and limits

## How a chat win becomes a link

```text
Correct chat answer
      ↓
OBS widget selects one PNG and encrypts { username, file }
      ↓ POST on 127.0.0.1 only
Local reward queue → Reward Links dashboard → Copy into chat
      ↓
Viewer opens https://kazvt.com/reward/?id=…#key=…
      ↓
Reward page decrypts the claim, checks the public PNG catalog, and shows it
```

The OBS widget receives chat over the existing WebSocket. Its local Python server records the generated link in an ignored `.reward-queue.json` file. That local file contains the full bearer link, username, and PNG filename in readable form; it is excluded from Git and the distributable ZIP. Open `http://127.0.0.1:8765/reward-links.html` on the streaming PC and copy the ready-to-send link into chat. The dashboard retains the 250 most recent links and refreshes every five seconds.

## Link format

The query parameter `id` is a JWE Compact Serialization with the protected header `{"alg":"dir","enc":"A256GCM"}`. Its encrypted JSON contains the version, chat display name, and PNG filename. The direct 256-bit key is generated separately for each link and placed in the URL fragment as `#key=…`. AES-GCM uses a fresh 96-bit random IV and a 128-bit authentication tag; the protected header is authenticated as additional data. The page accepts only this algorithm pair and only PNG filenames in `/assets/rewards/manifest.json`.

The fragment is processed by the browser and is not part of the HTTP request. That keeps the decryption key out of ordinary server request logs; the query contains the JWE protected header, IV, ciphertext, and authentication tag, but not the plaintext username, PNG name, or key. The page also sends no referrer and loads only same-origin resources. Copy the entire URL because a link without its fragment key cannot be opened.

## What this link proves—and what it does not

This is a self-contained share card for public art. It is not a login token or proof that the streamer issued the award: anyone with the code can make another key and encrypt a different username or catalog filename. The full link lets anyone who receives it view its contents. The image itself is public, and the page does not let a viewer redeem, claim, or spend anything.

This limit follows from the static-site setup. GitHub Pages publishes HTML, CSS, and JavaScript; it does not provide a private server endpoint or database that can check who issued a claim. Therefore these links do not expire, cannot be revoked, and do not prevent copying. For a real or scarce prize, use a backend to issue high-entropy random IDs, store the authoritative winner and item server-side, and support expiry, revocation, and one-time redemption. Keep the platform credentials and issuance secret in that trusted backend or a local bot process, never in the public page.

## Chat posting

The current trivia WebSocket is receive-only. The widget creates each URL and puts it in the local dashboard, but it cannot post to Twitch, YouTube, or Kick by itself. Automatic posting requires an authenticated sender in the local chat bridge. For example, Twitch's Send Chat Message API requires a user token with `user:write:chat` or the documented bot scopes; YouTube's live chat insert API requires OAuth authorization. Those credentials belong in the bridge, not OBS page JavaScript or GitHub. Until an outbound bridge is configured, the dashboard's copy-and-paste step is intentional.

## Design references

- [RFC 7516: JSON Web Encryption](https://www.rfc-editor.org/rfc/rfc7516.html) defines the five-part URL-safe compact format and protected-header authentication used for `id`.
- [Web Crypto Level 2](https://www.w3.org/TR/WebCryptoAPI/) and [MDN's AES-GCM parameters](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams) document browser AES-GCM, IV uniqueness, and authenticated additional data.
- [RFC 3986, section 3.5](https://www.rfc-editor.org/rfc/rfc3986.html#section-3.5) defines fragment identifiers as client-side URI components separated before dereferencing.
- [OWASP REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html#sensitive-information-in-http-requests) warns against putting credentials or security tokens in URLs because requests can be logged. This design keeps the actual username and PNG name encrypted in the query and keeps the key in the fragment, but the full share link is still a bearer link and remains in the recipient's browser history.
- [OWASP Forgot Password guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html#url-tokens) recommends secure random tokens, expiry, and invalidation for links that grant a real account action. Those server-side controls are intentionally absent here because this page only displays public images.
- [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) publishes a static site from repository files; this is why issuance history stays on the streaming PC.
- [Twitch Send Chat Message](https://dev.twitch.tv/docs/api/reference/#send-chat-message) and [YouTube LiveChatMessages: insert](https://developers.google.com/youtube/v3/live/docs/liveChatMessages/insert) show that automatic chat replies are authenticated API operations.
