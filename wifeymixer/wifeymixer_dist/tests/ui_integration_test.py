from array import array
from pathlib import Path
import base64
import io
import json
import re
import wave

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "tests" / "artifacts"
ART.mkdir(parents=True, exist_ok=True)

TAILWIND_STUB = r'''
(function(){var s=document.createElement('style');s.textContent=`
.fixed{position:fixed}.absolute{position:absolute}.relative{position:relative}.inset-0{inset:0}.left-2{left:.5rem}.right-2{right:.5rem}.top-2{top:.5rem}.bottom-2{bottom:.5rem}
.flex{display:flex}.grid{display:grid}.hidden{display:none!important}.block{display:block}.inline-flex{display:inline-flex}.flex-col{flex-direction:column}.flex-1{flex:1 1 0%}.flex-none{flex:none}.items-center{align-items:center}.items-end{align-items:flex-end}.justify-between{justify-content:space-between}.justify-center{justify-content:center}
.h-full{height:100%}.w-full{width:100%}.w-screen{width:100vw}.min-w-0{min-width:0}.min-h-0{min-height:0}.overflow-hidden{overflow:hidden}.overflow-auto{overflow:auto}.shrink-0{flex-shrink:0}
.p-1\\.5{padding:.375rem}.p-2{padding:.5rem}.px-2{padding-left:.5rem;padding-right:.5rem}.pb-2{padding-bottom:.5rem}.pt-0\\.5{padding-top:.125rem}.gap-1{gap:.25rem}.gap-2{gap:.5rem}.gap-3{gap:.75rem}.z-\\[1\\]{z-index:1}.h-\\[100dvh\\]{height:100dvh}
@media(min-width:640px){.sm\\:p-2{padding:.5rem}.sm\\:p-2\\.5{padding:.625rem}.sm\\:block{display:block!important}}@media(min-width:768px){.md\\:flex{display:flex!important}}@media(min-width:1024px){.lg\\:p-4{padding:1rem}.lg\\:p-3{padding:.75rem}}
`;document.head.appendChild(s)})();
'''


def make_click_wav(seconds=6, sample_rate=24000, stem="drums"):
    """Small deterministic fixture: silence plus beat clicks at 120 BPM."""
    total = seconds * sample_rate
    samples = array("h", [0]) * total
    click_len = int(sample_rate * 0.008)
    amplitude = 29000 if stem == "drums" else 23500
    beat_samples = sample_rate // 2
    for beat_start in range(0, total, beat_samples):
        for j in range(min(click_len, total - beat_start)):
            samples[beat_start + j] = int(amplitude * (1 - j / click_len))
    if samples.itemsize != 2:
        raise AssertionError("Expected 16-bit short samples")
    if __import__("sys").byteorder != "little":
        samples.byteswap()
    raw = io.BytesIO()
    with wave.open(raw, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(samples.tobytes())
    return raw.getvalue()


MANIFEST = {"files": []}
ASSET_B64 = {}
for song in range(1, 5):
    folder = f"Song {song:02d} bp120"
    for stem in ("drums", "bass"):
        filename = f"{stem} str1 end5.wav" if song == 4 and stem == "bass" else f"{stem}.wav"
        rel = f"{folder}/{filename}"
        MANIFEST["files"].append(rel)
        ASSET_B64[rel] = base64.b64encode(make_click_wav(stem=stem)).decode("ascii")
MANIFEST["files"].append("Song 05 bp120/missing.wav")


def inline_script(code):
    return "<script>" + code.replace("</script>", "<\\/script>") + "</script>"


def build_html(storage_raw=None):
    html = (ROOT / "index.html").read_text()
    # Browser navigation is blocked in this sandbox, so execute the real app as a
    # self-contained document. Only network/CDN resources are replaced by test shims.
    html = html.replace('<script src="https://cdn.tailwindcss.com"></script>', inline_script(TAILWIND_STUB))
    html = re.sub(r'\s*<link rel="preconnect"[^>]*>', "", html)
    html = re.sub(r'\s*<link href="https://fonts\.googleapis\.com[^>]*>', "", html)
    html = re.sub(r'\s*<link rel="stylesheet" href="https://cdnjs\.cloudflare\.com[^>]*>', "", html)
    html = html.replace(
        '<script src="https://cdn.jsdelivr.net/npm/tonal/browser/tonal.min.js"></script>',
        inline_script("window.Tonal=window.Tonal||{};"),
    )
    for name in [
        "sf2-procedural.js",
        "midi-support.js",
        "soundfont-icons.js",
        "filename-tag-rules.js",
        "auto-gain-references.js",
        "strip-fx-engine.js",
        "tempo-stretch-engine.js",
    ]:
        html = html.replace(f'<script src="{name}"></script>', inline_script((ROOT / name).read_text()))
    html = html.replace(
        '<link rel="stylesheet" href="hardware-polish.css">',
        "<style>" + (ROOT / "hardware-polish.css").read_text() + "</style>",
    )

    storage_value = json.dumps(storage_raw) if storage_raw is not None else "null"
    setup = f'''<script>
    (()=>{{
      const store={{}};
      if({storage_value}!==null)store["wifey-mix8-persistent-v1"]={storage_value};
      Object.defineProperty(window,"localStorage",{{configurable:true,value:{{
        getItem:key=>Object.prototype.hasOwnProperty.call(store,key)?store[key]:null,
        setItem:(key,value)=>{{store[key]=String(value)}},removeItem:key=>delete store[key],clear:()=>Object.keys(store).forEach(key=>delete store[key])
      }}}});
      const assets={json.dumps(ASSET_B64,separators=(',',':'))};
      const manifest={json.dumps(MANIFEST,separators=(',',':'))};
      const b64ToBytes=b64=>{{const raw=atob(b64),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out}};
      window.fetch=async input=>{{
        const url=String(input?.url||input||"");
        if(url.endsWith('manifest.json'))return new Response(JSON.stringify(manifest),{{status:200,headers:{{'Content-Type':'application/json'}}}});
        if(url.endsWith('instrument-icons.json'))return new Response('{{}}',{{status:200,headers:{{'Content-Type':'application/json'}}}});
        let match=null;
        for(const name of Object.keys(assets))if(url.endsWith(name)){{match=name;break}};
        if(match)return new Response(b64ToBytes(assets[match]),{{status:200,headers:{{'Content-Type':'audio/wav'}}}});
        return new Response('missing',{{status:404}});
      }};
    }})();
    </script>'''
    return html.replace("<head>", "<head>" + setup, 1)


def wait_ready(page):
    page.wait_for_function(
        "typeof playlists!=='undefined' && playlists.length===5 && typeof currentPlaylist!=='undefined' && currentPlaylist && typeof channels!=='undefined' && channels.length===2",
        timeout=30000,
    )
    page.wait_for_function("channels.length>0 && channels.every(c=>c.ready===true || c.error===true)", timeout=30000)
    page.wait_for_function("document.getElementById('loadReadout').textContent !== 'LOADING'", timeout=30000)


def set_tempo(page, value):
    page.eval_on_selector(
        "#topTempoControl",
        "(el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}",
        value,
    )
    page.wait_for_function(
        f"topTempoModule.dataset.targetBpm === '{value}' && topTempoModule.getAttribute('aria-busy') !== 'true'",
        timeout=30000,
    )


def approx(actual, expected, tolerance=0.08):
    assert abs(actual - expected) <= tolerance, f"{actual} not within {tolerance} of {expected}"


with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        executable_path="/usr/bin/chromium",
        args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
    )
    context = browser.new_context(viewport={"width": 1440, "height": 980}, has_touch=True)
    page = context.new_page()
    page.set_default_timeout(7000)
    errors = []
    page.on("pageerror", lambda e: errors.append("pageerror:" + str(e)))
    page.on("console", lambda m: errors.append("console:" + m.text) if m.type == "error" else None)
    page.set_content(build_html(), wait_until="load", timeout=60000)
    wait_ready(page)

    # Audio playlists expose pitch-locked tempo and inherit authored folder BPM.
    assert page.locator("#topTempoModule").is_visible()
    tempo_meta = page.evaluate(
        "({kind:topTempoModule.dataset.tempoKind,native:+topTempoModule.dataset.nativeBpm,target:+topTempoModule.dataset.targetBpm,min:+topTempoControl.min,max:+topTempoControl.max})"
    )
    assert tempo_meta["kind"] == "audio" and tempo_meta["native"] == 120 and tempo_meta["target"] == 120, tempo_meta
    assert tempo_meta["min"] <= 90 and tempo_meta["max"] >= 160, tempo_meta

    # 120 -> 150 BPM must produce one exact shared duration/length for every stem.
    set_tempo(page, 150)
    state = page.evaluate(
        "({duration:playlistDuration,lengths:channels.map(c=>c.buffer.length),durations:channels.map(c=>c.buffer.duration),tempo:currentPlaylist.playbackTempoBpm})"
    )
    assert state["tempo"] == 150
    approx(state["duration"], 4.8, 0.04)
    assert len(set(state["lengths"])) == 1
    approx(state["durations"][0], 4.8, 0.04)

    # Rapid changes must not allow the older render to overwrite the newest render.
    busy_seen = page.evaluate(
        """()=>{const el=topTempoControl;el.value='132';el.dispatchEvent(new Event('change',{bubbles:true}));const busy=topTempoModule.getAttribute('aria-busy')==='true';el.value='144';el.dispatchEvent(new Event('change',{bubbles:true}));return busy;}"""
    )
    assert busy_seen is True
    page.wait_for_function(
        "topTempoModule.dataset.targetBpm==='144' && topTempoModule.getAttribute('aria-busy')!=='true'",
        timeout=30000,
    )
    rapid = page.evaluate(
        "({tempo:currentPlaylist.playbackTempoBpm,duration:playlistDuration,lengths:channels.map(c=>c.buffer.length)})"
    )
    assert rapid["tempo"] == 144
    approx(rapid["duration"], 5.0, 0.04)
    assert len(set(rapid["lengths"])) == 1

    # Tempo extremes are rendered from the original decode, not cumulatively from
    # the previous stretch. Returning to native must restore the exact six-second clock.
    extreme_states = {}
    for bpm, expected in [(84, 6 * 120 / 84), (174, 6 * 120 / 174), (120, 6.0)]:
        set_tempo(page, bpm)
        value = page.evaluate(
            "({duration:playlistDuration,lengths:channels.map(c=>c.buffer.length),durations:channels.map(c=>c.buffer.duration),busy:topTempoModule.getAttribute('aria-busy')})"
        )
        approx(value["duration"], expected, 0.05)
        approx(value["durations"][0], expected, 0.05)
        assert len(set(value["lengths"])) == 1
        assert value["busy"] != "true"
        extreme_states[str(bpm)] = value

    # Missing/null authored tempo must remain genuinely unset, and untagged audio
    # must derive a positive native tempo from decoded audio instead of coercing null to 0.
    tempo_null_probe = page.evaluate(
        """async()=>{
          const fake={folder:'UNTAGGED',title:'UNTAGGED',filenameConfig:{bpm:null},stems:[{kind:'audio-file'}]};
          initializePlaylistMode(fake);
          const source=currentPlaylist.stems[0];
          const stem={...source};
          const probe={folder:'PROBE',title:'PROBE',filenameConfig:{},filenameTempoBpm:null,nativeTempoBpm:null,playbackTempoBpm:null,stems:[stem]};
          stem.playlistRef=probe;
          const detected=await ensurePlaylistNativeTempo(probe);
          return {authored:fake.filenameTempoBpm,detected,playback:probe.playbackTempoBpm};
        }"""
    )
    assert tempo_null_probe["authored"] is None, tempo_null_probe
    assert 118 <= tempo_null_probe["detected"] <= 122 and tempo_null_probe["playback"] == tempo_null_probe["detected"], tempo_null_probe

    # FX rack is materially larger/readable and its physical controls actuate.
    page.locator(".strip-fx-button").first.click()
    panel = page.locator(".strip-fx-panel")
    panel.wait_for(state="visible")
    box = panel.bounding_box()
    assert box and box["width"] >= 580, box
    css = page.evaluate(
        "()=>{const n=document.querySelector('.strip-fx-name'),p=document.querySelector('.strip-fx-power'),f=document.querySelector('.fader');return {font:parseFloat(getComputedStyle(n).fontSize),h:p.getBoundingClientRect().height,faderH:f.getBoundingClientRect().height}}"
    )
    assert css["font"] >= 11 and css["h"] >= 30 and css["faderH"] >= 150, css
    power = panel.locator(".strip-fx-power").first
    before = power.get_attribute("aria-pressed")
    power.click()
    assert power.get_attribute("aria-pressed") != before
    expand = panel.locator(".strip-fx-expand").first
    expand.click()
    params = panel.locator(".strip-fx-params").first
    assert params.is_visible()
    param_font = page.evaluate("parseFloat(getComputedStyle(document.querySelector('.strip-fx-param label')).fontSize)")
    assert param_font >= 8
    page.screenshot(path=str(ART / "wide.png"), full_page=True)
    panel.locator(".strip-fx-panel__close").click()

    # Exclusions are independent of track selection and persist in localStorage.
    page.locator("#playlistSelectorButton").click()
    menu = page.locator("#playlistMenu")
    menu.wait_for(state="visible")
    toggles = page.locator("[data-playlist-toggle-index]")
    assert toggles.count() == 5
    toggles.nth(1).tap()
    assert toggles.nth(1).get_attribute("aria-checked") == "false"
    assert "4/5 IN" in page.locator("#playlistRotationSummary").inner_text()
    included_check_opacity = page.evaluate(
        "parseFloat(getComputedStyle(document.querySelector('[data-playlist-toggle-index=\"0\"] .playlist-include-toggle__check')).opacity)"
    )
    excluded_check_opacity = page.evaluate(
        "parseFloat(getComputedStyle(document.querySelector('[data-playlist-toggle-index=\"1\"] .playlist-include-toggle__check')).opacity)"
    )
    assert included_check_opacity >= 0.9 and excluded_check_opacity <= 0.15
    page.screenshot(path=str(ART / "playlist-menu.png"), full_page=True)
    storage_raw = page.evaluate("localStorage.getItem('wifey-mix8-persistent-v1')")
    page.keyboard.press("Escape")

    # Transport/shuffle must skip excluded tracks.
    page.locator("#nextTrackBtn").click()
    page.wait_for_function("currentPlaylistIndex===2 && channels.length===2", timeout=30000)
    picks = page.evaluate("Array.from({length:60},()=>{queuedShuffleIndex=null;return chooseQueuedShuffleIndex()})")
    assert 1 not in picks, picks
    page.locator("#prevTrackBtn").click()
    page.wait_for_function("currentPlaylistIndex===0", timeout=30000)

    # Filename seconds stay on the same musical clock after tempo change.
    page.evaluate("changePlaylist(3,false)")
    page.wait_for_function("currentPlaylistIndex===3 && channels.length===2", timeout=30000)
    set_tempo(page, 150)
    timing = page.evaluate(
        "()=>{const stem=currentPlaylist.stems.find(s=>/bass/i.test(s.name));const ch=channels.find(c=>c.stem===stem);return {start:configuredTrackTimelineStart(stem,currentPlaylist),end:configuredTrackTimelineEnd(stem,ch.buffer,currentPlaylist)}}"
    )
    approx(timing["start"], 0.8, 0.002)
    approx(timing["end"], 4.0, 0.002)

    # Missing audio remains contained to its strip and the UI remains usable.
    page.evaluate("changePlaylist(4,false)")
    page.wait_for_function("currentPlaylistIndex===4 && channels.length===1 && channels[0].ready===true", timeout=30000)
    missing = page.evaluate("({error:channels[0].error,buttons:!playlistSelectorButton.disabled})")
    assert missing["error"] is True and missing["buttons"] is True, missing

    # New document, same persisted JSON: exclusion must survive.
    page.close()
    page = context.new_page()
    page.set_default_timeout(7000)
    page.on("pageerror", lambda e: errors.append("pageerror:" + str(e)))
    page.on("console", lambda m: errors.append("console:" + m.text) if m.type == "error" else None)
    page.set_content(build_html(storage_raw), wait_until="load", timeout=60000)
    wait_ready(page)
    page.locator("#playlistSelectorButton").click()
    menu = page.locator("#playlistMenu")
    menu.wait_for(state="visible")
    assert page.locator('[data-playlist-toggle-index="1"]').get_attribute("aria-checked") == "false"

    # Never permit a zero-track automatic rotation; ALL IN recovers state.
    for i in [2, 3, 4]:
        toggle = page.locator(f'[data-playlist-toggle-index="{i}"]')
        if toggle.get_attribute("aria-checked") == "true":
            toggle.click()
    t0 = page.locator('[data-playlist-toggle-index="0"]')
    assert t0.get_attribute("aria-checked") == "true"
    t0.click()
    assert t0.get_attribute("aria-checked") == "true"
    page.locator(".playlist-hardware-all-in").click()
    assert page.locator("#playlistRotationSummary").inner_text() == "ALL IN"

    # Keyboard focus and escape behavior.
    page.keyboard.press("Escape")
    page.locator("#playlistSelectorButton").focus()
    page.keyboard.press("ArrowDown")
    page.wait_for_function("!playlistMenu.hidden")
    first_focus = page.evaluate("document.activeElement?.dataset?.playlistIndex")
    page.keyboard.press("ArrowDown")
    second_focus = page.evaluate("document.activeElement?.dataset?.playlistIndex")
    assert first_focus == "0" and second_focus == "1", (first_focus, second_focus)
    page.keyboard.press("Escape")
    assert page.evaluate("document.activeElement===playlistSelectorButton")

    # Touch + narrow viewport: both overlays must remain inside the viewport.
    page.set_viewport_size({"width": 390, "height": 844})
    page.locator(".strip-fx-button").first.tap()
    panel = page.locator(".strip-fx-panel")
    panel.wait_for(state="visible")
    nbox = panel.bounding_box()
    assert nbox and nbox["x"] >= -1 and nbox["x"] + nbox["width"] <= 391, nbox
    overflow = page.evaluate("document.documentElement.scrollWidth-window.innerWidth")
    assert overflow <= 2, overflow
    page.screenshot(path=str(ART / "narrow.png"), full_page=True)
    panel.locator(".strip-fx-panel__close").tap()
    page.evaluate("playlists[0].title='THIS IS AN EXTREMELY LONG PLAYLIST TITLE THAT MUST STAY INSIDE THE ANALOGUE PROGRAM CARD';rebuildPlaylistHardwareMenu()")
    page.locator("#playlistSelectorButton").tap()
    menu.wait_for(state="visible")
    mbox = menu.bounding_box()
    assert mbox and mbox["x"] >= -1 and mbox["x"] + mbox["width"] <= 391, mbox
    long_content = page.evaluate(
        "()=>{const menu=document.getElementById('playlistMenu'),copy=menu.querySelector('.playlist-hardware-option__copy strong');return {menuOverflow:menu.scrollWidth-menu.clientWidth,titleOverflow:copy.scrollWidth-copy.clientWidth}}"
    )
    assert long_content["menuOverflow"] <= 2 and long_content["titleOverflow"] > 0, long_content

    # Empty playlist state is coherent and disables selection.
    empty_state = page.evaluate(
        "()=>{closePlaylistHardwareMenu();playlists=[];currentPlaylist=null;syncPlaylistSelector();return {disabled:playlistSelectorButton.disabled,label:playlistSelectorLabel.textContent}}"
    )
    assert empty_state["disabled"] is True and "NO PROGRAM" in empty_state["label"], empty_state

    runtime = [
        e
        for e in errors
        if "missing.wav" not in e
        and "HTTP 404" not in e
        and "AudioWorklet" not in e
        and "worklet" not in e.lower()
    ]
    assert not runtime, runtime
    print(
        json.dumps(
            {
                "tempo_meta": tempo_meta,
                "tempo_150": state,
                "rapid": rapid,
                "extremes": extreme_states,
                "tempo_null_probe": tempo_null_probe,
                "timing": timing,
                "missing": missing,
                "wide_fx": box,
                "narrow_fx": nbox,
                "menu_narrow": mbox,
                "long_content": long_content,
                "keyboard": [first_focus, second_focus],
                "check_opacity": [included_check_opacity, excluded_check_opacity],
                "empty": empty_state,
            },
            indent=2,
        )
    )
    browser.close()
