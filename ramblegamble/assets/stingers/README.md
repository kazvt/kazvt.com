# Smeemo encounter stinger

`smeemo-explosive-alpha.webm` replaces the earlier opaque H.264 cutaway. The supplied OBS side-by-side export (3840x1080) contains two distinct things: the left 1920x1080 stinger artwork **with its own encoded alpha channel**, and the right grayscale source-A/source-B transition matte. Only the left artwork is displayed; the game continues rendering behind it. The right panel is not an artwork opacity mask and is deliberately not used to change the live camera scene. No chroma/luma key, flattened backing, opacity approximation or duplicate caption. The 300 original video frames retain their 30 FPS cadence and the stereo Vorbis audio packets are copied unchanged. The old MP4 is no longer referenced at runtime and may be removed manually after deployment if desired.

Offline reproduction (FFmpeg with libvpx):

```sh
ffmpeg -c:v libvpx-vp9 -i SMEEMO_Explosive_10s_OBS_TrackMatte_3840x1080.webm -vf crop=1920:1080:0:0 -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 24 -deadline good -cpu-used 5 -row-mt 1 -threads 8 -auto-alt-ref 0 -c:a copy smeemo-explosive-alpha.webm
```

Specify the alpha-aware decoder before the input; the ordinary FFmpeg native VP9 decoder may report/decode only YUV. Validate alpha by actual decoding, not metadata alone. Browser player uses native WebM alpha on a transparent DOM overlay; older Safari/WebKit builds may not composite WebM alpha. No opaque MP4 fallback is selected. Existing lazy preload, skip, shared mute, failure/stall recovery and 4.4-second camera return remain.

References: https://obsproject.com/kb/track-matte-stinger-transitions ; https://wiki.webmproject.org/alpha-channel ; https://bugs.webkit.org/show_bug.cgi?id=275908

# Points earned stinger

`points-earned.webm` is the owner-supplied 1920×1080, 10 FPS, five-second `POINTS_EARNED_OBS.webm` with the video stream copied unchanged (including native alpha). Stereo audio was attenuated by 26 dB at encode time so it remains quiet even in browsers that disregard programmatic media volume. Original measured peak −1.8 dBFS / mean −21.6 dBFS; output −27.2 / −47.8 dBFS. No normalization or gain makeup. The 50 decoded alpha-aware video frames match the original frame hashes exactly.

```sh
ffmpeg -i POINTS_EARNED_OBS.webm -map 0:v -map 0:a -c:v copy -af volume=-26dB -c:a libvorbis -q:a 4 points-earned.webm
```

A noninteractive transparent overlay places live text and the existing points chip beneath the baked headline. Award notifications are independent of balance refreshes: publish only after console `points add/give` or the complete slot transaction succeeds. Administrative set/reset, deductions, stars, shop payments/refunds, failed persistence, and old balances do not celebrate. Same-origin browser tabs receive the transient event through BroadcastChannel and storage events, deduplicated by ID; it is not cross-device transport or a transaction ledger. Recent events can wait up to 30 seconds for a hidden tab or blocking dialog; rapid awards combine into the next presentation. The Dice dialog receives the same overlay via reparenting. Pause/lock/leave clears presentation; reduced motion and unavailable media fall back to a readable static card. Existing Foley mute is respected; browsers that prohibit unmuted playback retry silently. Older browsers may not composite VP9 alpha correctly; no opaque MP4 is substituted.

Design references: [Streamlabs alert templates and timing](https://streamlabs.com/content-hub/post/setting-up-your-streamlabs-alerts), [OBS stingers](https://obsproject.com/kb/track-matte-stinger-transitions), [Nielsen Norman Group system status](https://www.nngroup.com/articles/visibility-system-status/), [Xbox contrast](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/102), [Xbox audio](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/105), [W3C reduced motion](https://www.w3.org/WAI/WCAG22/Techniques/css/C39), [MDN autoplay](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay), [MDN BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API), [MDN storage events](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event). No formal photosensitivity certification is implied for the supplied video.
