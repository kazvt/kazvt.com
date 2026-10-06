# OBS Trivia Widget v2 · Reward Links Edition

A local, transparent 1920×1080 OBS Browser Source widget that receives chat messages over WebSocket, runs category-based trivia, awards points, and shows an on-stream leaderboard.

This copy also issues a random PNG reward link for each correct answer. The original `obs-trivia-widget-v2.zip` archive is unchanged.

## What changed from the first version

This version is structured like a small production overlay instead of a single demo HTML file:

- `questions.json` is the editable question bank.
- `questions.schema.json` documents and validates the question-bank format.
- `config.schema.json` documents the configuration contract.
- `chat-message.schema.json` defines the preferred sender → overlay WebSocket event contract.
- `sample-messages.jsonl` contains ready-to-send example events.
- `config.json` controls WebSocket, command, scoring, display, and persistence behavior.
- `rewards.json` lists the PNG rewards hosted by the site.
- `reward-links.html` is the local dashboard for copying newly issued links into chat.
- `app.js` contains the WebSocket adapters, trivia state machine, scoring, dedupe, reconnect, and UI logic.
- `styles.css` is the OBS-friendly overlay styling; `reward-links.css` styles the local copy dashboard.
- `server.py` serves the widget and its local reward queue on `127.0.0.1`.
- Incoming messages can be your preferred normalized format, a simple flat format, or common Twitch EventSub / YouTube LiveChatMessage / Kick `chat.message.sent` shapes.

The browser still receives chat only. It saves generated links to a local queue; the dashboard lets you copy a link and paste it into chat.

---

## Recommended OBS setup

1. Start the local widget server:

   **Windows**: double-click `start-widget.bat`

   **macOS/Linux**:

   ```bash
   ./start-widget.sh
   ```

   Or directly:

   ```bash
   python3 server.py 8765
   ```

2. Open the reward dashboard in a normal browser on the streaming PC:

   ```text
   http://127.0.0.1:8765/reward-links.html
   ```

   Leave this page open during trivia. When a viewer answers correctly, the widget creates a reward URL and the dashboard adds a **Copy link** button for that viewer. Paste the link into chat to give it to them. The existing WebSocket contract is receive-only, so chat posting stays with your chat bot or streamer.

3. In OBS, add a **Browser Source**.
4. Leave **Local file** OFF.
5. URL:

   ```text
   http://127.0.0.1:8765/
   ```

6. Set Width = `1920` and Height = `1080`.
6. Leave **Shutdown source when not visible** OFF if you want the WebSocket and an active round to survive scene changes.
7. `Refresh browser source when scene becomes active` is normally best left OFF.

The overlay background is transparent. The trivia UI appears in the top-left at 32×32 by default.

## Reward links

The public reward page is `https://kazvt.com/reward/`. Each issued URL contains an AES-GCM encrypted `id` value with the viewer's display name and PNG filename. A random decryption key is included after `#key=` in the URL, so copy the complete link. The key stays out of the HTTP request; anyone who has the full reward link can still open it, so treat the link as a public bearer link.

The page only accepts PNG filenames listed in the site repository's `/assets/rewards/manifest.json`. The images are hosted under `https://kazvt.com/assets/rewards/`. The local dashboard keeps the 250 most recent reward links in an ignored `.reward-queue.json` file beside `server.py`.

### Override the WebSocket without editing config.json

```text
http://127.0.0.1:8765/?ws=ws://127.0.0.1:9000
```

You can also override the question-bank URL:

```text
http://127.0.0.1:8765/?questions=my-other-questions.json
```

### If you host the widget somewhere other than localhost

If the page is served over HTTPS, use a `wss://` WebSocket endpoint. Browsers generally block insecure WebSocket connections from secure pages as mixed content. If `questionsUrl` points to another origin, that server must also allow the browser request with appropriate CORS headers.

---

## Why localhost instead of opening index.html directly?

The question bank is intentionally a real JSON file. Modern Chromium-based browsers commonly treat `file://` documents as opaque origins, so `fetch("questions.json")` from a local HTML file is not a reliable cross-browser design. `localStorage` behavior on `file://` is also not standardized. Serving the folder on `127.0.0.1` gives the widget a normal, stable browser origin and keeps the entire project local to the streaming PC.

OBS Browser Source is based on CEF/Chromium. OBS's CEF `no_sandbox` setting is not the same thing as disabling normal browser origin/CORS behavior.

---

## Chat commands

Default commands are configured in `config.json`.

```text
!trivia
```

Starts a random question from all enabled categories.

```text
!trivia gaming
!trivia science
!trivia tech
```

Starts a question from a specific category. Category aliases are defined in `questions.json`.

```text
!leaderboard
```

Shows the overall leaderboard.

```text
!leaderboard gaming
```

Shows the leaderboard for that category only.

Commands are case-insensitive. A per-user cooldown and a global leaderboard display cooldown prevent command spam from constantly re-triggering the overlay.

---

## Scoring behavior

The default `answerMode` is:

```json
"answerMode": "all_until_timeout"
```

That means **every distinct user who answers correctly before the timer ends gets the question's points**. The same user cannot farm the same question repeatedly because `oneAwardPerUserPerQuestion` is `true`.

To make it first-answer-wins instead:

```json
"answerMode": "first_correct"
```

`maxWinnersPerQuestion: 0` means unlimited winners until timeout. Set it to a positive number if you want the round to end after N correct players.

Scores are persisted in browser `localStorage` for the localhost widget origin. The score model tracks both overall points and per-category points.

---

## questions.json format

The first item in `answers` is the canonical answer shown when the round ends. Additional entries are accepted aliases.

```json
{
  "id": "science-001",
  "prompt": "Which planet is known as the Red Planet?",
  "answers": ["Mars"],
  "points": 10,
  "durationSeconds": 20,
  "difficulty": "easy",
  "explanation": "Optional short explanation shown after the round."
}
```

A category looks like:

```json
{
  "id": "science",
  "name": "Science",
  "aliases": ["sci"],
  "icon": "🧪",
  "accent": "#22C55E",
  "enabled": true,
  "weight": 1,
  "questions": []
}
```

### Category weights

When chat uses plain `!trivia`, the widget first chooses an enabled category using `weight`, then picks a question from that category. Equal weights mean equal category probability regardless of how many questions are inside each category.

That is deliberate: a category with 300 questions does not automatically drown out a category with 20 questions.

### Repetition control

`recentQuestionMemory` in `config.json` prevents the last N question IDs from immediately repeating when alternatives are available.

---

## Preferred WebSocket message contract

Your sender script will be easiest to maintain if it normalizes Twitch/Kick/YouTube into one envelope before sending it to OBS:

```json
{
  "version": 1,
  "type": "chat.message",
  "id": "platform-message-id",
  "platform": "twitch",
  "timestamp": "2026-10-06T12:34:56.000Z",
  "user": {
    "id": "stable-platform-user-id",
    "displayName": "SomeViewer",
    "isBot": false
  },
  "message": {
    "text": "mars"
  }
}
```

Important fields:

- `version`: normalized bridge-contract version; currently `1`.
- `id`: stable platform message ID. Used to reject duplicate/replayed messages.
- `platform`: `twitch`, `youtube`, or `kick`.
- `user.id`: stable platform user/channel ID. Used as leaderboard identity.
- `user.displayName`: what appears on stream.
- `message.text`: raw chat text.

The widget never requires badges, avatars, OAuth tokens, or credentials.

---

## Simple message format also accepted

This still works:

```json
{
  "platform": "kick",
  "username": "SomeViewer",
  "message": "!trivia gaming"
}
```

For production, send stable `userId` and `messageId` too when you have them:

```json
{
  "platform": "kick",
  "userId": "987654321",
  "messageId": "unique-message-id",
  "username": "SomeViewer",
  "message": "!leaderboard"
}
```

---

## Native-ish platform payload support

The receiver also recognizes common source shapes so your bridge can stay thin:

### Twitch EventSub channel.chat.message

It looks for fields such as:

- `chatter_user_id`
- `chatter_user_name`
- `message_id`
- `message.text`

The event can be the root object or nested in common `event` / `payload.event` wrappers.

### YouTube LiveChatMessage

It looks for:

- `id`
- `authorDetails.channelId`
- `authorDetails.displayName`
- `snippet.displayMessage` or `snippet.textMessageDetails.messageText`

### Kick chat.message.sent

It looks for:

- `message_id`
- `sender.user_id`
- `sender.username`
- `content`
- `created_at`

The preferred normalized envelope is still the cleanest long-term interface between your bridge and the overlay.

---

## Answer matching

Answers are intentionally conservative to avoid accidental false positives in busy chat.

The widget:

- ignores letter case;
- trims whitespace;
- collapses repeated spaces;
- normalizes Unicode compatibility characters;
- tolerates common punctuation around the outside of an answer;
- only accepts an exact normalized answer/alias.

So `Mars`, `mars`, and `mars!` match `Mars`, but `I think it is Mars` does not unless you explicitly add that phrase as an alias.

This also avoids naive punctuation stripping that would break legitimate answers such as `C++`.

---

## Duplicate/replay protection

When a platform message ID is provided, the browser keeps a bounded recent-ID cache. The same `platform + messageId` is only processed once. This is useful when a bridge reconnects, retries, or replays recent chat.

User identity is `platform + stable user ID` when available. Display names are only a fallback. This means renaming a Twitch/YouTube/Kick account does not create a second leaderboard identity as long as your bridge sends the platform ID.

---

## Reconnect behavior

The widget reconnects automatically with exponential backoff plus jitter, capped by `reconnectMaxMs`. It does **not** send application-level ping messages because this overlay is intentionally receive-only and should not assume your WebSocket server implements a custom heartbeat protocol.

A small `Chat link reconnecting` badge appears only while disconnected. Set `showConnectionStatus` to `false` if you prefer a completely silent failure state on stream.

---

## Safe handling of viewer-controlled content

Viewer names and chat-derived text are inserted with DOM `textContent`, not `innerHTML`. Incoming JSON is parsed with `JSON.parse`. Oversized messages are ignored, message IDs are deduplicated, and the leaderboard is bounded.

The WebSocket bridge itself should still validate who is allowed to connect to it, cap payload sizes, and avoid exposing an unauthenticated listener to the public internet.

---

## Debugging / testing without real chat

Open the widget in a normal browser and use DevTools:

```js
TriviaWidget.injectChat("twitch", "Alice", "!trivia science", { userId: "1", messageId: "m1" })
TriviaWidget.injectChat("youtube", "Bob", "mars", { userId: "2", messageId: "m2" })
TriviaWidget.showLeaderboard()
TriviaWidget.getScores()
TriviaWidget.getState()
```

Reset scores:

```js
TriviaWidget.resetScores()
```

Force a reconnect:

```js
TriviaWidget.reconnect()
```

---

## Suggested next bridge contract

When you wire in your sender script, normalize every platform into the preferred envelope and send **only new text-chat messages**. Keep OAuth/API credentials in the bridge process, never in this HTML/JS overlay.

That separation gives you a clean architecture:

```text
Twitch / YouTube / Kick
        ↓
platform-specific collectors
        ↓
normalization + auth + dedupe in your bridge
        ↓
local WebSocket
        ↓
OBS trivia overlay
        ↓
visual state + scoring + leaderboard
```

Longer-term, if you need scores shared between multiple OBS machines, remote control, moderation-only commands, seasons, or durable backups, move the score store from browser `localStorage` into the bridge/server. The overlay can then become a pure rendering/game client.

---

## Relevant standards / documentation used in the design

- OBS Browser Source: https://obsproject.com/kb/browser-source
- MDN WebSocket API: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
- MDN CORS local-file behavior: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS/Errors/CORSRequestNotHttp
- MDN localStorage: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
- JSON Schema Draft 2020-12: https://json-schema.org/draft/2020-12
- Twitch EventSub chat message reference: https://dev.twitch.tv/docs/eventsub/eventsub-reference/
- YouTube LiveChatMessage reference: https://developers.google.com/youtube/v3/live/docs/liveChatMessages
- Kick developer event payloads: https://github.com/KickEngineering/KickDevDocs/blob/main/events/event-types.md
- OWASP WebSocket Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html
