# Show presentation

The display and console keep their existing authenticated host setup and elected WebRTC reader. Contestants keep their existing v2 private links. No backend or new service is required.

- Left-click a card game to start a fresh round using saved decks. Ordinary table clicks leave a currently displayed game alone; ROOM exits the presentation. There is no Resume action. Right-click a card tile or the card display for its staff editor. Configure the prompt/decks and room invitations there or use the console. Normal Dice entry shows only play controls; right-click the VIP door or inside Dice for face configuration (Shift+D also toggles it). Existing slot and roulette staff routing is retained.
- While focused on a machine or wall (including Dice), moving a mouse or hovering pen without pressing a button smoothly follows the cursor in both axes. The orbit is bounded at twice the former per-view angles (roughly 2–5 degrees), preserves the authored target/radius and has no zoom/roll. It recenters on leaving the viewport and holds while over interactive controls to avoid moving hit targets. Drag and keyboard nudges remain available, including touch drag; an actual drag is not a click. Edge navigation, Back, overview framing and view resets remain unchanged. Reduced motion disables passive cursor-follow and keeps intentional manual nudges.
- Card submissions are private until the host reveals them. Three accepted submissions end collection without revealing any text. LOCK ANSWERS can end collection early if there is an accepted answer; late submissions are rejected. REVEAL NEXT shows one shuffled anonymous answer; ALL shows the remainder. Voting is enabled only once all accepted answers are visible. RESULTS shows the votes, NEW ROUND uses the saved deck. The private console `answers` view remains available at any time.

## Console

```
berryblast start
berryblast start A custom prompt
redhanded start
cards close
cards reveal
cards all
cards vote 1
cards results
```

`cards reveal all` also works. `cards vote` uses the visible anonymous response number, not a contestant's seat. Saved rounds remain hidden on page refresh; selecting a card game always starts a fresh round. Existing decks, point balances and saved submissions remain intact until a new round is deliberately started. Existing completed rounds are migrated without hiding answers that were already displayed. No player-facing protocol change or invitation replacement is necessary. Deploy the changed files together and reload all host/player tabs.

## Design references

- [Three.js OrbitControls](https://threejs.org/docs/#examples/en/controls/OrbitControls): bounded angles and damping; this implementation keeps the authored camera offset and clamps a smaller additive orbit rather than enabling free navigation.
- [Codrops: Crafting Scroll Based Animations in Three.js](https://tympanus.net/codrops/2022/01/05/crafting-scroll-based-animations-in-three-js/): normalized cursor targets with damped camera movement.
- [MDN Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events): distinguish passive hover from direct manipulation.
- [Jackbox Games](https://www.jackboxgames.com/): shared-screen presentation with separate player controllers.
- [WebRTC data channels](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels): preserve existing encrypted channel and application authentication.
- [WCAG animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html): respect reduced motion.

## Validation limits

Node regression tests, actual model projection, and isolated Chromium HUD tests with the real UI code/CSS and simulated storage and room transport. Full deployed WebGL appearance and cross-device internet WebRTC are not verified. The host UI lock remains a casual local deterrent, not server access control. Shop point/card writes remain separate local storage keys; the implementation attempts rollback on failure, not a database transaction.

## Slot theatre and manual spotlights

Click the closed purple curtains (or use the existing Slots shortcut) to begin the four-second reveal. The original cabinet rig advances to its previously authored world position, and the normal camera/slot controls become available when the transition finishes. Return to the room to retract the cabinet and close the curtains over 2.4 seconds. No change to the board, payouts, or random outcomes. The pleated curtains use the exact original stage wall tile. The three spotlights are world-space cone masks on the existing unlit materials with translucent beam geometry, not an added set of persistent decorative squares. Reveal/hide cues share the existing audio mixer and auto-audience state; manual emotes retain priority. The stage returns to its original brightness after the slot reveal. Shift+left-click a visible area of the room to select a manual spotlight target; Shift+click near the same point to dismiss with a cheer, or another area to retarget. A manual spotlight stays active until dismissed, a view change, or a visibility/lock reset. Ordinary clicks are unchanged. Reduced motion skips theatrical animation and opens/closes the cabinet immediately.

Before deployment, install the two recorded drum cues using `python3 ramblegamble/assets/sfx/install-stage-drums.py` (Python 3 and FFmpeg). See `assets/sfx/SOURCES.md` for originals and licensing. Original downloads were blocked in the authoring environment; no drum recordings are bundled in this patch and no synthetic fallback is used. Existing licensed applause is bundled in the base project. Full deployed WebGL appearance must be checked on the actual scene; geometry/lifecycle and shader-hook tests use actual model measurements and rendering doubles, not a GPU.
