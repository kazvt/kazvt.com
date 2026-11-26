# Live trivia

## Host workflow

See [PLAYER-SUBMISSIONS.md](PLAYER-SUBMISSIONS.md) for the current unified live controller, acknowledgement/retry behavior and private console answer viewer.

1. Deploy the changed files together on GitHub Pages. Refresh `/rg/`, `/rg/console/` and the existing contestant invitation pages once. The authenticated room protocol remains v2; no new invitations are required if they already use v2.
2. Open and unlock `/rg/` and `/rg/console/` in the same browser profile and origin. Import the authored question bank into the existing staff editor in `/rg/`; the bank/drafts are still session-local and are not published as site assets.
3. Start the shared online room from either host page if it is not already running. Kaz, Faroe and Erin keep their existing private `/rg/player/` invitation pages open.
4. Enter `trivia 25 5` in the console (round 25, difficulty 5). Other rounds 1–36 and difficulties 1–5 work the same way. The display resolves the actual inherited question, moves to the wall and shows its public content with host-local answer checking for simple choice and short-answer questions. The contestant pages update automatically. Missing authored content or a storage failure is reported in the console rather than inventing a question.
5. Use `trivia answers` to read the private submissions. Right-click the roulette or trivia stage to open the editor and see the LIVE ANSWERS section (including drawings and placements). `PRESENT` starts a fresh instance of the currently selected question. `trivia close` closes submissions. Points are still awarded manually through the existing commands.

Left-click the roulette's center/rim (or press T) to reopen the latest question without resetting answers; Shift+T is the keyboard alternative to right-click staff setup. Wheel/ball clicks retain their spin behavior. BACK or Escape returns to the room without closing submissions. A reload does not restore the presentation automatically. Starting/resuming another card game supersedes trivia for the players; deliberately reopening trivia restores its saved round. `trivia next` / `trivia previous` step through sequence items; `trivia hide` / `trivia show` control memory-image visibility. These commands do not display secret answers. The existing 00/0 special editor pages are not live contestant rounds.

## Rendering and data

The wall camera faces the authored back-wall panels. The audience layout is a transparent DOM overlay (no backdrop, modal, staff labels or score HUD; simple formats add a compact Check Answer control). Text and image grids, prompt images, video, typed answers, numeric guesses, matching, categorization, timeline ordering, sequences, drawings and repeatable image placements use the same public renderer and appropriate private inputs. For six- or ten-option text/image questions, select the answer given and click Check Answer. For short answers, type the given answer and press Enter or Check Answer. Both use the saved host-only answer key; wrong answers play a short recorded error sound and shake the interface (text feedback remains with reduced motion). The optional subtitle is smaller than the question. Grading the presentation does not submit for a contestant, reveal the key, or award points. The host can inspect raw submissions; no automatic award or answer reveal is performed. Numeric guesses are evaluated on the host, with only the guessing player's feedback returned. Objective correct answers, unrevealed sequence items and other contestants' submissions are not included in live player snapshots.

The command request/reply and live round snapshot are stored on the host's origin. `/rg/` owns the session-local draft/question bank and resolves new start commands; it must be open, unlocked and initialized to start an authored question. Either initialized host tab may remain elected reader for submissions after a question is published. Web Locks serialize live mutations and the authenticated local MessagePort or remote PeerJS connection supplies the private seat identity. New card activity is stamped independently of saved trivia; ordinary score/deck changes do not start a trivia round. Submissions are validated, persisted before acknowledgement, and round-scoped. Exact retry packets are idempotent. A new command intentionally creates a fresh round even for the same question.

Use HTTPS media URLs or imported images. Large uploaded still images can be resized to WebP for transfer; animated assets are best hosted at stable HTTPS URLs. The live snapshot reserves capacity for submissions and has a bounded size; oversized questions produce an error. External media must be reachable by the contestants; video needs a browser-playable direct URL. Offline packet fallback remains available for small questions, but larger media snapshots require a live connection and offline links cannot receive sequence changes. There is no new backend or database. The existing host gate is a casual UI deterrent; the existing cryptographic room authentication is unchanged.

## Design references

- Kahoot's separate host and participant presentations: https://support.kahoot.com/
- Jackbox shared-screen/private-controller model: https://www.jackboxgames.com/how-to-play
- MDN StorageEvent and same-origin storage: https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event
- MDN WebRTC data channels and message size considerations: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels
- Three.js screen-facing DOM overlays: https://threejs.org/docs/#examples/en/renderers/CSS2DRenderer
- W3C WCAG reflow and accessible controls: https://www.w3.org/WAI/WCAG22/Understanding/reflow.html

Validation: `node --test ramblegamble/*.test.mjs` (290 passing at packaging), including real worker-thread MessagePort rendezvous and authenticated host submission, existing player/reader tests, and simple answer grading. Isolated Chromium DOM checks covered 6/10 text/image options at four viewport sizes, typed Enter, correct/wrong feedback, reduced motion, preview shake selector and audio decoding. Full deployed Three.js rendering, browser SharedWorker networking and real cross-device PeerJS transport remain unverified in the patch environment.
