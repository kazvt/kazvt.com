# Show presentation

The display and console keep their existing authenticated host setup and elected WebRTC reader. Contestants keep their existing v2 private links. No backend or new service is required.

- Left-click a card game to resume or start it using saved decks. Right-click a card tile or the card display for its staff editor. Configure the prompt/decks and room invitations there or use the console. Normal Dice entry shows only play controls; right-click the VIP door or inside Dice for face configuration (Shift+D also toggles it). Existing slot and roulette staff routing is retained.
- While focused on a machine or wall, drag the scene horizontally/vertically to nudge its camera. The orbit has no zoom/roll and is capped per view (roughly 1–3 degrees). A drag is not a click. Edge navigation and Back still work; a view change restores the authored framing. Reduced-motion preferences disable decorative transitions and smoothing where appropriate.
- Card submissions are private until the host reveals them. Three accepted submissions end collection without revealing any text. LOCK ANSWERS can end collection early if there is an accepted answer; late submissions are rejected. REVEAL NEXT shows one shuffled anonymous answer; ALL shows the remainder. Voting is enabled only once all accepted answers are visible. RESULTS shows the votes, NEW ROUND uses the saved deck. The private console `answers` view remains available at any time.

## Console

```
berryblast start
berryblast start A custom prompt
redhanded start
cards show
cards close
cards reveal
cards all
cards vote 1
cards results
```

`cards reveal all` also works. `cards vote` uses the visible anonymous response number, not a contestant's seat. Saved rounds remain hidden on page refresh until deliberately resumed or presented. Existing completed rounds are migrated without hiding answers that were already displayed. No player-facing protocol change or invitation replacement is necessary. Deploy the changed files together and reload all host/player tabs.

## Design references

- [Three.js OrbitControls](https://threejs.org/docs/#examples/en/controls/OrbitControls): bounded angles and damping; this implementation keeps the authored camera offset and clamps a smaller additive orbit rather than enabling free navigation.
- [Jackbox Games](https://www.jackboxgames.com/): shared-screen presentation with separate player controllers.
- [WebRTC data channels](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels): preserve existing encrypted channel and application authentication.
- [WCAG animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html): respect reduced motion.

## Validation limits

Node regression tests, actual model projection, and isolated Chromium HUD tests with the real UI code/CSS and simulated storage and room transport. Full deployed WebGL appearance and cross-device internet WebRTC are not verified. The host UI lock remains a casual local deterrent, not server access control. Shop point/card writes remain separate local storage keys; the implementation attempts rollback on failure, not a database transaction.
