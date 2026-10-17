# Local reward issuer

GitHub Pages stays static. Award issuance happens only on the streaming PC through the existing `msi.py` HTTP server; it does not add a GitHub Actions issuer, PAT, database, Cloudflare Worker, or other service. The server accepts issuer requests from loopback only, then uses the site's existing Git login to publish the assignment registry and anonymous pool count.

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

A game page served locally by MSI can call the endpoint directly with a same-origin `fetch()`. A game running only at `kazvt.com` cannot issue awards; it must not be given a public write endpoint or a credential.

## Issue from Twitch, Kick, and YouTube chat

With MSI running on the streaming PC, Acer remains the primary source for Twitch IRC and Kick's public Pusher chat feed on the other PC. MSI also subscribes to Streamer.bot's local WebSocket for `YouTube.Message`, `Twitch.ChatMessage`, and `Kick.ChatMessage`; its Twitch/Kick events are a backup path if Acer misses a message. The Twitch backup only accepts the `kazvt` broadcaster. Both paths can be live together. They use the platform message ID as the same idempotency key, so a command received from both feeds should only mutate the award ledger once. In any of those chats, an exact `!reward @username` message from `kazvt` or `Chimpwurldos` issues the next unused catalog artwork. `@` is optional. A platform user ID can be used instead of a handle.

The same authorized accounts can undo awards with `!unreward @username` (aliases: `!rewardremove`, `!remreward`, `!delreward`, `!removereward`, `!remove-reward`, `!unassignreward`, `!revokeaward`, `!removeaward`, and `!delaward`). This releases the recipient's most recently issued active award on that platform. Use `!rewardsclear @username` to release every active award for that platform identity (aliases: `!rewardclear`, `!clearrewards`, `!clearreward`, `!delrewards`, `!delallrewards`, and `!removeallrewards`). Commands require one recipient handle or platform user ID; they do not guess across Twitch, Kick, and YouTube identities.

Removed cards immediately stop resolving from the active public registry, and their image returns to the available-art pool after the registry push/deployment propagates. The issuer archives the prior assignment and records a hashed command event instead of erasing history. This prevents a retried old `!reward` message from resurrecting a revoked link, and makes duplicate removal events safe. A removal event with no current awards is also recorded, so a delayed retry cannot clear a later award.

On the streaming PC, enable Streamer.bot's WebSocket server under **Servers/Clients → WebSocket Server** and keep it on `127.0.0.1:8080` (the Streamer.bot default). MSI connects to `ws://127.0.0.1:8080/` automatically and requests the three event subscriptions above. No password is needed when WebSocket authentication is disabled; if it is enabled, set `STREAMERBOT_WS_PASSWORD` in MSI's existing secrets configuration. Keep the server loopback-only. Make sure the Twitch, Kick, and YouTube accounts are connected in Streamer.bot. On the remote PC, Acer must already be connected to this MSI instance through the existing `MSI_WS_HOST`/`MSI_WS_PORT` settings.

Acer's Kick watcher is pinned to the `kazvt` channel and uses `wss://ws-us2.pusher.com` with the public Pusher app key configured in `acer.py` (the key is not an app secret). A Pusher `4001` response means the server rejected that key/cluster pairing; retrying the same URL will not repair it. If it appears, Streamer.bot remains the Twitch/Kick fallback while the public key's actual Pusher cluster is verified.

After a successful `!reward`, MSI sends one public Streamer.bot chat message containing the winner's reward link and exactly two kaomoji. It tries the bot account first, then the broadcaster account only if Streamer.bot explicitly rejects the bot send. A timeout is treated as ambiguous and is not retried as the broadcaster, to avoid duplicate announcements. The dedupe record is local at `%LOCALAPPDATA%\Kazvt\reward_chat_announcements.json`; it stores only hashes of command event IDs, not usernames or links. This also prevents the Acer and Streamer.bot feeds from announcing the same dual-delivered command twice. If Streamer.bot is offline or both accounts cannot send, the award remains issued and MSI logs that the chat announcement failed; it never revokes an award because chat output failed. Streamer.bot's `SendMessage` request is used for Twitch, Kick, and YouTube, with `internal` disabled so the message is public. See the [Streamer.bot WebSocket request reference](https://docs.streamer.bot/api/websocket/requests) for its `SendMessage` contract and the [WebSocket configuration guide](https://docs.streamer.bot/api/websocket/guide/configuration) for authentication settings.

Award ownership is keyed by `(platform, userId)`, not the mutable handle, while the latest handle is kept for display. MSI keeps its name-to-ID cache in `%LOCALAPPDATA%\Kazvt\reward_user_identities.json`; it is not published or stored in the website checkout. Acer and MSI can resolve Twitch handles through their existing Twitch Helix credentials. Kick and YouTube handle resolution uses observed chat identities, with the public ledger as a fallback for previously awarded users. If neither source knows the identity, or a name is ambiguous, issuance stops instead of creating a second name-based identity. Retrying a command event is idempotent, and an artwork can only be issued once globally.

Platform IDs are stored in the public `assignments.json` because GitHub Pages has no private server-side database. The username shown on award pages remains the latest known platform handle, not the ID. Treat the IDs and reward ledger as public data.

Give the same stable `eventId` to retries. MSI stores only its SHA-256 digest in the public registry. A retry for the same winner and art returns the original link; trying to reuse that event for another winner/art is rejected. Chat selection is pseudo-random from the remaining pool, seeded by the platform message ID, so a retry selects the same artwork. Each PNG's exact bytes are checked against its SHA-256 catalog ID and dimensions immediately before assignment, and a PNG can only be assigned once.

New art belongs in `zzz_assets/rewards/`. It is eligible after the repository's reward catalog has been regenerated and published. The filename is only a display name; the SHA-256 asset ID is the identity.

## Private planned rewards

Put private alias-to-artwork rules in `reward/api/reservations.local.txt`. The file is ignored by Git and is not served by the site. `reservations.example.txt` documents the forgiving syntax. For example:

```text
viewer, viewer-0000 -> award.gif
another-viewer => E:/sites/kazvt.com-1/zzz_assets/rewards/another-gift.png
```

Adding a rule does not issue or attach an award. When an authorized `!reward username` command arrives, the issuer checks both the current username and platform user ID against the aliases. A match gets that reserved artwork first; otherwise the normal unreserved pool is used. The rule itself and its alias-to-art mapping are never published, displayed, or included in reward announcements. Reserved items are omitted from the available pool and its count until issued. Once issued, the normal public assignment record is created. Keep a private backup of `reservations.local.txt`; the ignored file does not travel with Git clones or commits.

## What it publishes

Before writing, MSI checks that the configured folder is the `kazvt/kazvt.com` checkout, on `main`, clean, and synchronized with `origin/main`. It refuses if it sees unrelated edits or commits. It stages only `zzz_assets/rewards/assignments.json` and the anonymous `zzz_assets/rewards/pool.json` totals, creates a small reward-specific commit, and pushes with the Git credentials already configured on that PC. The public pool file contains only `remaining` and `total`, never usernames or reserved artwork identities. The existing Pages-on-push publishing then makes the static record live. If push or deployment is delayed, retry using the same `eventId`; do not invent a new one.

There is no new token to create or paste anywhere. This assumes `git push` already works from the website checkout on the MSI computer. If it does not, the issuer refuses and reports a publish error; it will not switch to an unauthenticated or public write path. After updating `msi.py`, restart MSI once so its existing port-8000 server loads the route.

## Safety boundary

- `/reward-api/*` is not part of the public website and is not an internet-facing issuer. MSI checks the client address, local Host, and same-origin headers; it emits no CORS permission. Requests from other computers and cross-origin web pages are rejected.
- Twitch/Kick commands cross MSI's existing LAN WebSocket from the single registered Acer client. That existing bridge is not cryptographically authenticated, so keep it on a trusted private network and never port-forward MSI's WebSocket port (9876) to the internet. The chat readers and MSI both check the issuing account allowlist, but this is not protection against a compromised trusted PC or LAN.
- This is intentionally modest protection: any program already running as the local Windows user can call loopback and issue awards. Do not expose port 8000 through a router, tunnel, or public reverse proxy, and do not put the client in code distributed to players.
- `assignments.json` and all award images are public. Opaque reward IDs identify existing cards; they do not prove who opened a link, keep an award private, or prevent copying.
- The older OBS trivia widget has its own local assignment writer and private queue. Do not issue awards in both it and MSI at the same time; they share the public registry but have no cross-process lock. Use one issuer at a time.
- For real money, valuable prizes, accounts, private access, expiry, or revocation, this local/static setup is not enough. This is a convenience feature for stream-game rewards, not a high-stakes authorization system.
