# Smeemo encounter stinger

`smeemo-explosive-alpha.webm` replaces the earlier opaque H.264 cutaway. The supplied OBS side-by-side export (3840x1080) contains two distinct things: the left 1920x1080 stinger artwork **with its own encoded alpha channel**, and the right grayscale source-A/source-B transition matte. Only the left artwork is displayed; the game continues rendering behind it. The right panel is not an artwork opacity mask and is deliberately not used to change the live camera scene. No chroma/luma key, flattened backing, opacity approximation or duplicate caption. The 300 original video frames retain their 30 FPS cadence and the stereo Vorbis audio packets are copied unchanged. The old MP4 is no longer referenced at runtime and may be removed manually after deployment if desired.

Offline reproduction (FFmpeg with libvpx):

```sh
ffmpeg -c:v libvpx-vp9 -i SMEEMO_Explosive_10s_OBS_TrackMatte_3840x1080.webm -vf crop=1920:1080:0:0 -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 24 -deadline good -cpu-used 5 -row-mt 1 -threads 8 -auto-alt-ref 0 -c:a copy smeemo-explosive-alpha.webm
```

Specify the alpha-aware decoder before the input; the ordinary FFmpeg native VP9 decoder may report/decode only YUV. Validate alpha by actual decoding, not metadata alone. Browser player uses native WebM alpha on a transparent DOM overlay; older Safari/WebKit builds may not composite WebM alpha. No opaque MP4 fallback is selected. Existing lazy preload, skip, shared mute, failure/stall recovery and 4.4-second camera return remain.

References: https://obsproject.com/kb/track-matte-stinger-transitions ; https://wiki.webmproject.org/alpha-channel ; https://bugs.webkit.org/show_bug.cgi?id=275908
