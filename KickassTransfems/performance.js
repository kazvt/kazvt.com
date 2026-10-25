/* Lightweight rendering guard for KickassTransfems.
 * Web pages cannot read the browser's hardware-acceleration setting directly.
 * Use a conservative WebGL software-renderer check, accessibility/data-saving
 * preferences, and actual frame timing while the pointer moves instead.
 * Cache the last inferred rendering state for fast reloads, then probe again
 * to detect changes. Override automatic detection with ?ktPerf=lite or ?ktPerf=full.
 */
(() => {
  'use strict';

  const root = document.documentElement;
  const params = new URLSearchParams(location.search);
  const override = params.get('ktPerf');
  const forced = override === 'lite' || override === 'full';
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const dataSaver = Boolean(navigator.connection && navigator.connection.saveData);

  // Browsers don't provide access to their hardware-acceleration checkbox.
  // Persist our *best-effort* renderer/slow-frame observations instead, so
  // return visitors start in the last suitable mode without a heavy first paint.
  // Recheck WebGL on each non-forced load to notice hardware-setting changes.
  const CACHE_KEY = 'kt:render-performance:v1';
  const MAX_CACHE_AGE = 30 * 24 * 60 * 60 * 1000;
  const SLOW_FRAME_TTL = 48 * 60 * 60 * 1000;
  const now = Date.now();

  function readCachedDetection() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.version !== 1 || !Number.isFinite(data.updatedAt) ||
          data.updatedAt > now || now - data.updatedAt > MAX_CACHE_AGE ||
          !['software', 'accelerated', 'unknown'].includes(data.renderer)) return null;
      return data;
    } catch (_) {
      // Storage may be blocked (private browsing, site settings, sandbox).
      return null;
    }
  }

  const cached = readCachedDetection();
  let renderer = cached ? cached.renderer : 'unknown';
  let slowPointerAt = cached && Number.isFinite(cached.slowPointerAt) &&
    cached.slowPointerAt <= now && now - cached.slowPointerAt < SLOW_FRAME_TTL
    ? cached.slowPointerAt : 0;

  function saveDetection() {
    if (forced) return; // URL testing must not overwrite automatic detection.
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        version: 1,
        renderer,
        slowPointerAt,
        updatedAt: Date.now()
      }));
    } catch (_) {
      // Storage failure should never affect the page.
    }
  }

  function shouldUseLite() {
    return motionPreference.matches || dataSaver || renderer === 'software' || Boolean(slowPointerAt);
  }

  // Apply the cached decision BEFORE probing WebGL and before the body paints.
  // Cached status is only an initial hint, never a permanent hardware claim.
  let lite = override === 'lite' || (!forced && shouldUseLite());
  let flagVideo = null;
  let flagInView = true;
  let prideObserver = null;
  let prideContainer = null;
  const optionalGIFs = [
    '.kt-pride-sticker img',
    '.kt-roster-welcome-art__pride-sticker',
    '.kt-webring-intro-art__pride-sticker',
    '.kt-discord__art-sticker img[src*="/pride-gifmojis/"]',
    '[data-kt-pride-gif-stagger] img'
  ].join(', ');

  function updateVideo() {
    if (!flagVideo) return;
    const shouldPlay = !lite && !document.hidden && flagInView;
    if (!shouldPlay) {
      flagVideo.pause();
      return;
    }
    if (flagVideo.paused) {
      flagVideo.preload = 'metadata';
      const play = flagVideo.play();
      if (play && typeof play.catch === 'function') play.catch(() => {});
    }
  }

  function syncOptionalGIFs() {
    if (!flagVideo) return; // The body has not been parsed yet.
    if (lite) {
      document.querySelectorAll(optionalGIFs).forEach(img => {
        if (img.hasAttribute('src') && !img.hasAttribute('data-kt-paused-gif')) {
          img.setAttribute('data-kt-paused-gif', img.getAttribute('src'));
          img.removeAttribute('src');
        }
      });
      if (prideObserver && prideContainer) {
        prideObserver.observe(prideContainer, { childList: true, subtree: true });
      }
    } else {
      if (prideObserver) prideObserver.disconnect();
      document.querySelectorAll('img[data-kt-paused-gif]').forEach(img => {
        img.setAttribute('src', img.getAttribute('data-kt-paused-gif'));
        img.removeAttribute('data-kt-paused-gif');
      });
    }
  }

  function setMode(nextLite) {
    lite = nextLite;
    root.classList.toggle('kt-lite-mode', lite);
    root.dataset.ktPerformance = lite ? 'lite' : 'full';
    updateVideo();
    syncOptionalGIFs();
  }

  // Apply before markup/CSS paint, and before the page's deferred scripts run.
  setMode(lite);

  if (!forced) {
    // failIfMajorPerformanceCaveat rejects many software WebGL contexts. A
    // missing context is a hint, not proof that GPU acceleration is disabled.
    // No persistent GL context or animation loop is created by this probe.
    function checkRenderer() {
      const canvas = document.createElement('canvas');
      try {
        const gl = canvas.getContext('webgl', {
          failIfMajorPerformanceCaveat: true,
          powerPreference: 'low-power'
        });
        if (!gl) return 'software';
        const debug = gl.getExtension('WEBGL_debug_renderer_info');
        const description = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : '';
        const isSoftware = /swiftshader|llvmpipe|softpipe|software raster|software renderer/i.test(description);
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
        return isSoftware ? 'software' : 'accelerated';
      } catch (_) {
        return 'unknown'; // Keep the cached hint if probing is blocked.
      } finally {
        canvas.width = canvas.height = 0;
      }
    }

    if (!motionPreference.matches && !dataSaver) {
      const fresh = checkRenderer();
      if (fresh !== 'unknown') {
        // A changed renderer is a strong reason to discard an old slow-pointer
        // observation: e.g. acceleration was just enabled in the browser.
        if (renderer !== 'unknown' && renderer !== fresh) slowPointerAt = 0;
        renderer = fresh;
      }
      saveDetection();
      setMode(shouldUseLite());
    }

    const onMotionChange = () => setMode(shouldUseLite());
    if (motionPreference.addEventListener) motionPreference.addEventListener('change', onMotionChange);
    else if (motionPreference.addListener) motionPreference.addListener(onMotionChange);
  }

  function ready() {
    flagVideo = document.querySelector('.kt-flag-stage video.kt-flag');
    prideContainer = document.querySelector('[data-kt-pride-gif-stagger]');
    if (prideContainer && 'MutationObserver' in window) {
      prideObserver = new MutationObserver(() => {
        if (lite) syncOptionalGIFs();
      });
    }
    syncOptionalGIFs();
    if (flagVideo) {
      flagVideo.addEventListener('play', () => {
        if (lite || document.hidden || !flagInView) flagVideo.pause();
      });
      // Video has no autoplay attribute: the script starts it only when useful.
      flagVideo.autoplay = false;
      flagVideo.preload = lite ? 'none' : 'metadata';
      if ('IntersectionObserver' in window) {
        flagInView = false;
        const observer = new IntersectionObserver(entries => {
          flagInView = Boolean(entries[0] && entries[0].isIntersecting);
          updateVideo();
        }, { rootMargin: '80px 0px' });
        observer.observe(flagVideo);
      }
      updateVideo();
    }
    document.addEventListener('visibilitychange', updateVideo);

    if (forced || !('requestAnimationFrame' in window)) return;

    // Diagnose real-world jank only when the cursor is actually moving.
    // Sampling is brief and infrequent; there is NO permanent animation loop.
    let lastSample = performance.now();
    let running = false;
    let readyAfter = performance.now() + 1800;
    function samplePointerPerformance() {
      if (running || lite || document.hidden) return;
      const now = performance.now();
      if (now < readyAfter || now - lastSample < 4500) return;
      running = true;
      lastSample = now;
      let lastFrame = 0;
      let frames = 0;
      let slowFrames = 0;
      const deadline = now + 850;
      function frame(timestamp) {
        if (document.hidden || lite) {
          running = false;
          return;
        }
        if (lastFrame) {
          frames++;
          if (timestamp - lastFrame > 34) slowFrames++;
        }
        lastFrame = timestamp;
        if (timestamp < deadline) {
          requestAnimationFrame(frame);
        } else {
          running = false;
          // Several slow frames while moving the cursor signal that rendering
          // is over budget even if WebGL reported an accelerated context.
          if (frames >= 10 && slowFrames >= 7 && slowFrames / frames > 0.45) {
            slowPointerAt = Date.now();
            saveDetection();
            setMode(true);
          }
        }
      }
      requestAnimationFrame(frame);
    }
    window.addEventListener('pointermove', samplePointerPerformance, { passive: true });
    window.addEventListener('mousemove', samplePointerPerformance, { passive: true });
  }

  // 'interactive' fires as soon as markup is parsed, before external defer
  // scripts finish. This avoids needless GIF/video work during slow downloads.
  if (document.readyState === 'loading') {
    document.addEventListener('readystatechange', () => {
      if (document.readyState === 'interactive') ready();
    }, { once: true });
  } else ready();
})();
