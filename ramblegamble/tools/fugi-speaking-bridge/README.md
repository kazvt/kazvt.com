# Fugi speaking bridge (host browser only)

The game embeds five external Reactive by FugiTech basic sources. Ordinary website JS cannot read cross-origin iframe DOM or voice state. This small opt-in browser extension reads the documented-in-community-CSS `data-speaking="true"` / `"false"` attribute in the Fugi source itself and relays only that boolean to the parent game. No audio recording, tokens, network requests, cookies or remote code. The game accepts messages only from each registered iframe window and the Fugi origin; expired/missing/unknown states never produce a peek. The same live iframe is used for world and side rendering.

## Installation

Extract the project patch and deploy the game files normally. On the **host computer**, retain a local copy of this `tools/fugi-speaking-bridge` folder. Only the host who displays the game needs the extension.

- Firefox: open `about:debugging#/runtime/this-firefox`, select **Load Temporary Add-on**, then select this folder's `manifest.json`. Temporary add-ons are removed on browser restart; load it again next time. This is an unsigned local extension, not an AMO release.
- Chromium/Chrome: open `chrome://extensions`, turn on **Developer mode**, select **Load unpacked**, and select this folder. Keep the folder in place.

Reload the host game tab. The source frames must be connected to Discord and have speaking/inactive images configured normally. The bridge is restricted to `https://reactive.fugi.tech/basic/*` and `https://kazvt.com` / `https://www.kazvt.com` as parent origins. If running the host elsewhere, deliberately add that exact trusted origin to the `hosts` set in `bridge.js` and reload the extension. No database changes are needed.

## Check the connection

1. Open the game, join the voice channel, and navigate to a trivia view that hides a participant.
2. While that participant is silent, there should be no side portrait. While they speak, their original reactive image peeks in. Silence triggers a short release and retreat. Return to a view where the person is visible; their normal 3D portrait should be restored.
3. If nobody appears, inspect the Fugi iframe in browser developer tools. Verify the individual source toggles `[data-speaking]` between `true` and `false` in the current version of the service, and that the extension was loaded. Do not guess speaking from a random change in image or animation. If the provider changed the markup, the bridge deliberately fails silent until adapted.

Current testing exercises both sides of the message protocol with simulated event/DOM fixtures and exercises the layout in real Chromium using local stand-in artwork. Direct source access failed DNS; even intercepted cross-origin navigation was blocked by browser policy. The current basic-source attribute and live Discord transitions remain unverified. References: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage ; https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_scripts ; https://gist.github.com/Brybry16/d2eb1db68eadc597dae363f287ed3890 ; https://github.com/LumKitty/FugiReactiveHacks .
