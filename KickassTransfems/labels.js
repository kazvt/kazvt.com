/* Unify identity labels from the shared /kt/ scripts with the responsive
 * name/pronoun flow. Avoid copying label strings: existing DOM and language
 * data remain authoritative, and badges only move within the same card.
 */
(() => {
  'use strict';

  const CARD_SELECTOR = '.kt-member, .kt-recommendation-link';
  const LANGUAGE_SELECTOR = '[class*="lang" i], [class*="locale" i], [data-language], [data-languages], [data-lang-code], [data-stream-lang]';
  const LANGUAGE_CODES = new Set([
    'EN', 'ENG', 'ES', 'ESP', 'FR', 'FRA', 'DE', 'DEU', 'PT', 'POR', 'IT', 'ITA',
    'NL', 'NLD', 'PL', 'POL', 'JA', 'JPN', 'JP', 'KO', 'KOR', 'ZH', 'ZHO', 'RU',
    'RUS', 'AR', 'ARA', 'TR', 'TUR', 'SV', 'SWE', 'NO', 'NOR', 'DA', 'DAN',
    'FI', 'FIN', 'EL', 'ELL', 'HE', 'HEB', 'HI', 'HIN', 'UK', 'UKR', 'CS', 'CES',
    'RO', 'RON', 'HU', 'HUN', 'ID', 'IND', 'VI', 'VIE', 'TH', 'THA', 'TL', 'FIL'
  ]);
  const CHATTER_HANDLE_SELECTOR = '.kt-chatters__handle';
  const PROFILE_AVATAR_SELECTOR = '.kt-member-avatar, .kt-recommendation-avatar, .kt-chatters__avatar';
  const AVATAR_CACHE_NAME = 'kt-avatar-images-v1';
  const AVATAR_RECORD_PREFIX = 'kt:profile-avatar:v1:';
  const AVATAR_REVALIDATE_AFTER = 60 * 1000;
  const AVATAR_REQUEST_TIMEOUT = 8000;
  const MAX_AVATAR_REQUESTS = 4;
  const MAX_CACHED_AVATARS = 80;
  const kickAvatarBySlug = new Map();
  const pendingKickAvatarBySlug = new Map();
  const pendingAvatarSeeds = new Map();
  const kickAvatarQueue = [];
  let activeKickAvatarRequests = 0;
  const chatterLists = document.querySelectorAll('.kt-chatters__list');

  function validKickAvatarUrl(value) {
    try {
      const url = new URL(value, location.href);
      const isKickHost = url.hostname === 'files.kick.com' || url.hostname === 'kick.com';
      const isAvatarPath = url.pathname.startsWith('/images/user/')
        || url.pathname.startsWith('/img/default-profile-pictures/');
      return url.protocol === 'https:' && isKickHost && isAvatarPath ? url.href : '';
    } catch {
      return '';
    }
  }

  function kickSlugForAvatar(image) {
    const link = image.closest('a[href]');
    if (!link) return '';
    try {
      const profile = new URL(link.href, document.baseURI);
      if (profile.hostname !== 'kick.com' && profile.hostname !== 'www.kick.com') return '';
      const slug = profile.pathname.split('/').filter(Boolean)[0] || '';
      return /^[a-z0-9_-]+$/i.test(slug) ? slug.toLowerCase() : '';
    } catch {
      return '';
    }
  }

  function readCachedKickAvatar(slug) {
    if (kickAvatarBySlug.has(slug)) return kickAvatarBySlug.get(slug);
    try {
      const cached = JSON.parse(localStorage.getItem(`${AVATAR_RECORD_PREFIX}${slug}`) || 'null');
      const url = validKickAvatarUrl(cached?.url);
      if (!url || !Number.isFinite(cached?.checkedAt) || cached.checkedAt < 0
        || cached.checkedAt > Date.now() + 5 * 60 * 1000) return null;
      const record = { url, checkedAt: cached.checkedAt };
      kickAvatarBySlug.set(slug, record);
      return record;
    } catch {
      return null;
    }
  }

  function writeCachedKickAvatar(slug, url, checkedAt = Date.now()) {
    const safeUrl = validKickAvatarUrl(url);
    if (!safeUrl) return null;
    const record = { url: safeUrl, checkedAt };
    kickAvatarBySlug.set(slug, record);
    try {
      localStorage.setItem(`${AVATAR_RECORD_PREFIX}${slug}`, JSON.stringify(record));
    } catch {}
    return record;
  }

  function forgetCachedKickAvatar(slug, failedUrl) {
    const cached = readCachedKickAvatar(slug);
    if (!cached || (failedUrl && cached.url !== failedUrl)) return;
    kickAvatarBySlug.delete(slug);
    try {
      localStorage.removeItem(`${AVATAR_RECORD_PREFIX}${slug}`);
    } catch {}
  }

  function applyKickAvatarToImages(slug, url) {
    document.querySelectorAll(PROFILE_AVATAR_SELECTOR).forEach(image => {
      if (kickSlugForAvatar(image) !== slug || image.dataset.ktAvatarFailedUrl === url) return;
      if (image.src === url) return;
      delete image.dataset.ktAvatarRefreshTried;
      delete image.dataset.ktAvatarFallback;
      delete image.dataset.ktAvatarFailedUrl;
      image.src = url;
    });
  }

  async function fetchCurrentKickAvatar(slug, cached) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), AVATAR_REQUEST_TIMEOUT);
    try {
      const response = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`, {
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Kick profile lookup failed: ${response.status}`);
      const channel = await response.json();
      const imageUrl = validKickAvatarUrl(channel?.user?.profile_pic);
      if (!imageUrl) return cached?.url || null;
      writeCachedKickAvatar(slug, imageUrl);
      applyKickAvatarToImages(slug, imageUrl);
      return imageUrl;
    } catch {
      return cached?.url || null;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function drainKickAvatarQueue() {
    while (activeKickAvatarRequests < MAX_AVATAR_REQUESTS && kickAvatarQueue.length) {
      const job = kickAvatarQueue.shift();
      activeKickAvatarRequests += 1;
      fetchCurrentKickAvatar(job.slug, job.cached).then(job.resolve).finally(() => {
        if (pendingKickAvatarBySlug.get(job.slug) === job.promise) {
          pendingKickAvatarBySlug.delete(job.slug);
        }
        activeKickAvatarRequests -= 1;
        drainKickAvatarQueue();
      });
    }
  }

  function getCurrentKickAvatar(slug, { force = false } = {}) {
    const cached = readCachedKickAvatar(slug);
    const cacheAge = cached ? Date.now() - cached.checkedAt : Infinity;
    if (!force && cached?.checkedAt && cacheAge < AVATAR_REVALIDATE_AFTER) {
      return Promise.resolve(cached.url);
    }
    const pending = pendingKickAvatarBySlug.get(slug);
    if (pending) return pending;

    let resolveRequest;
    const promise = new Promise(resolve => { resolveRequest = resolve; });
    pendingKickAvatarBySlug.set(slug, promise);
    kickAvatarQueue.push({ slug, cached, promise, resolve: resolveRequest });
    drainKickAvatarQueue();
    return promise;
  }

  function rememberLoadedAvatar(image) {
    const slug = kickSlugForAvatar(image);
    const url = validKickAvatarUrl(image.currentSrc || image.src);
    if (url) {
      try {
        navigator.serviceWorker?.controller?.postMessage({ type: 'kt-avatar-cache-validated', url });
      } catch {}
      seedAvatarResponse(url);
    }
    if (!slug || !url || readCachedKickAvatar(slug)?.url === url) return;
    // A successfully rendered HTML image is a useful first snapshot even if
    // Kick's profile endpoint is temporarily unavailable; checkedAt=0 keeps
    // it eligible for an immediate background refresh on the next visit.
    writeCachedKickAvatar(slug, url, 0);
  }

  function cacheAvatarSnapshot(image) {
    const slug = kickSlugForAvatar(image);
    if (!slug) return;
    const cached = readCachedKickAvatar(slug);
    if (cached && image.src !== cached.url) image.src = cached.url;
    else if (image.complete && image.naturalWidth > 0) seedAvatarResponse(image.currentSrc || image.src);
    void getCurrentKickAvatar(slug);
  }

  function seedAvatarResponse(value) {
    const url = validKickAvatarUrl(value);
    if (!url || !('caches' in window) || pendingAvatarSeeds.has(url)) return;
    const request = new Request(url, { mode: 'no-cors', credentials: 'omit' });
    const promise = caches.open(AVATAR_CACHE_NAME).then(async cache => {
      if (await cache.match(request, { ignoreVary: true })) return;
      const response = await fetch(request, { cache: 'force-cache' });
      if (response.ok || response.type === 'opaque') await cache.put(request, response.clone());
    }).catch(() => {}).finally(() => {
      pendingAvatarSeeds.delete(url);
    });
    pendingAvatarSeeds.set(url, promise);
  }

  function registerAvatarCacheWorker() {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    const scriptUrl = new URL('./kt-avatar-cache-sw.js?v=20261117-avatar-cache-v1', document.baseURI);
    const scope = new URL('./', document.baseURI).pathname;
    navigator.serviceWorker.register(scriptUrl, { scope }).catch(() => {});
  }

  function purgeFailedAvatarResponse(url) {
    const safeUrl = validKickAvatarUrl(url);
    if (!safeUrl) return;
    try {
      navigator.serviceWorker?.controller?.postMessage({
        type: 'kt-avatar-cache-delete',
        url: safeUrl,
      });
    } catch {}
    if ('caches' in window) {
      void caches.open(AVATAR_CACHE_NAME)
        .then(cache => cache.delete(safeUrl, { ignoreVary: true }))
        .catch(() => {});
    }
  }

  function avatarFallbackData(image) {
    const card = image.closest('a');
    const identity = card?.querySelector('.kt-member-name, .kt-recommendation-name, .kt-chatters__handle')?.textContent?.trim() || '';
    const words = identity.replace(/^@/, '').split(/[\s._-]+/).filter(Boolean);
    const initials = (words.slice(0, 2).map(word => Array.from(word)[0]).join('') || Array.from(identity)[0] || '?')
      .toLocaleUpperCase();
    const safeInitials = initials.replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
    })[character]);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#fff4f8"/><path d="M-18 18 18-18M-18 58 58-18M-18 98 98-18M22 114 114 22" stroke="#5bcffa" stroke-width="13" opacity=".58"/><rect x="7" y="7" width="82" height="82" fill="#fff9fc" fill-opacity=".92" stroke="#2b2028" stroke-width="4"/><text x="48" y="61" text-anchor="middle" fill="#2b2028" font-family="Arial,sans-serif" font-size="35" font-weight="700">${safeInitials}</text></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  async function recoverAvatar(image) {
    if (image.dataset.ktAvatarRefreshTried === 'true') {
      image.dataset.ktAvatarFallback = 'true';
      image.src = avatarFallbackData(image);
      return;
    }
    image.dataset.ktAvatarRefreshTried = 'true';
    const failedUrl = validKickAvatarUrl(image.currentSrc || image.src);
    if (failedUrl) purgeFailedAvatarResponse(failedUrl);
    const slug = kickSlugForAvatar(image);
    if (slug) {
      forgetCachedKickAvatar(slug, failedUrl);
      const imageUrl = await getCurrentKickAvatar(slug, { force: true });
      if (imageUrl && imageUrl !== failedUrl) {
        delete image.dataset.ktAvatarRefreshTried;
        delete image.dataset.ktAvatarFallback;
        delete image.dataset.ktAvatarFailedUrl;
        image.src = imageUrl;
        return;
      }
      if (imageUrl === failedUrl) forgetCachedKickAvatar(slug, failedUrl);
    }
    image.dataset.ktAvatarFallback = 'true';
    image.src = avatarFallbackData(image);
  }

  function watchProfileAvatar(image) {
    if (!(image instanceof HTMLImageElement) || image.dataset.ktAvatarRecovery === 'true') return;
    image.dataset.ktAvatarRecovery = 'true';
    image.addEventListener('load', () => rememberLoadedAvatar(image));
    image.addEventListener('error', () => {
      const failedUrl = validKickAvatarUrl(image.currentSrc || image.src);
      if (failedUrl) {
        image.dataset.ktAvatarFailedUrl = failedUrl;
        purgeFailedAvatarResponse(failedUrl);
      }
      void recoverAvatar(image);
    });
    // The deferred script can start after a lazy image has already failed.
    if (image.complete && image.naturalWidth === 0) void recoverAvatar(image);
  }

  function watchAvatarsWithin(node) {
    if (!(node instanceof Element)) return;
    const images = [];
    if (node.matches(PROFILE_AVATAR_SELECTOR)) images.push(node);
    images.push(...node.querySelectorAll(PROFILE_AVATAR_SELECTOR));
    images.forEach(image => {
      watchProfileAvatar(image);
      cacheAvatarSnapshot(image);
    });
  }

  function initializeProfileAvatarRecovery() {
    registerAvatarCacheWorker();
    document.querySelectorAll(PROFILE_AVATAR_SELECTOR).forEach(image => {
      watchProfileAvatar(image);
      cacheAvatarSnapshot(image);
    });
    const observer = new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(watchAvatarsWithin));
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function fitChatterHandles() {
    for (const handle of document.querySelectorAll(CHATTER_HANDLE_SELECTOR)) {
      // Measure the real, embedded-font text at its responsive base size. Keeping
      // the text node intact preserves selection, copy/paste, and accessibility.
      handle.style.removeProperty('--kt-chatters-handle-fit-size');
      const available = handle.clientWidth;
      if (!available) continue;

      const fontSize = Number.parseFloat(getComputedStyle(handle).fontSize);
      const range = document.createRange();
      range.selectNodeContents(handle);
      const naturalWidth = range.getBoundingClientRect().width;
      if (!fontSize || !naturalWidth || naturalWidth <= available - 1) continue;

      const fittedSize = fontSize * ((available - 1) / naturalWidth);
      handle.style.setProperty('--kt-chatters-handle-fit-size', `${fittedSize.toFixed(3)}px`);
    }
  }

  function scheduleChatterHandleFit() {
    if (scheduleChatterHandleFit.queued) return;
    scheduleChatterHandleFit.queued = true;
    requestAnimationFrame(() => {
      scheduleChatterHandleFit.queued = false;
      fitChatterHandles();
    });
  }

  function isCodeContent(node) {
    const text = ((node.textContent || '').trim() ||
      node.getAttribute('data-language') || node.getAttribute('data-languages') ||
      node.getAttribute('data-lang-code') || node.getAttribute('data-stream-lang') || '')
      .trim().toUpperCase().replace(/\s+/g, ' ');
    if (text && text.length <= 48) {
      const words = text.split(/[\s,|/]+/).filter(Boolean);
      if (words.length && words.length <= 6 && words.every(word => LANGUAGE_CODES.has(word))) return true;
    }
    // A shared language group often has <span>EN</span><span>ESP</span>:
    // textContent joins these into "ENESP". Recognize its child badges instead
    // of discarding the group or relocating badges out of their source wrapper.
    return node.children.length > 0 && [...node.childNodes].every(child =>
      child.nodeType === Node.TEXT_NODE ? !child.textContent.trim() :
      child.nodeType === Node.ELEMENT_NODE && isCodeContent(child)
    );
  }

  function findLanguageNodes(card, destination) {
    const matches = [...card.querySelectorAll(LANGUAGE_SELECTOR)].filter(node =>
      !destination.contains(node) &&
      !node.closest('.kt-member-handle, .kt-recommendation-handle') &&
      // Moving card-wide wrapper content would reorder non-language UI.
      isCodeContent(node) && !node.matches('.kt-member-title, .kt-member-copy, .kt-recommendation-copy') &&
      !node.querySelector('a, button, input, select, textarea')
    );
    // Prefer original parent groups (EN+ESP), retaining source JS references.
    return matches.filter(node => !matches.some(other => other !== node && other.contains(node)));
  }

  function markBadgeGeometry(node) {
    const children = [...node.children];
    const looksLikeBadge = /(?:^|[-_\s])(?:badge|pill|label|tag|code)(?:$|[-_\s])/i.test(node.className || '');
    if (isCodeContent(node) && (children.length === 0 || looksLikeBadge)) {
      node.setAttribute('data-kt-language-badge', '');
      return;
    }
    node.setAttribute('data-kt-language-container', '');
    for (const child of children) {
      if (isCodeContent(child)) markBadgeGeometry(child);
    }
  }

  function updateCardLabels() {
    for (const card of document.querySelectorAll(CARD_SELECTOR)) {
      const title = card.querySelector('.kt-member-title');
      const copy = card.querySelector('.kt-member-copy, .kt-recommendation-copy');
      const handle = copy?.querySelector(':scope > .kt-member-handle, :scope > .kt-recommendation-handle');
      if (!title || !copy) continue;
      let destination = copy.querySelector(':scope > .kt-card-languages');
      if (!destination) {
        destination = title.querySelector(':scope > .kt-card-languages') || document.createElement('span');
        destination.className = 'kt-card-languages';
        if (handle?.parentElement === copy) handle.insertAdjacentElement('afterend', destination);
        else copy.appendChild(destination);
      }
      for (const node of findLanguageNodes(card, destination)) {
        const previous = node.parentElement;
        markBadgeGeometry(node);
        destination.appendChild(node);
        if (previous && previous !== card && !previous.textContent.trim() && !previous.children.length) {
          previous.setAttribute('data-kt-empty-language-container', '');
        }
      }
      // Shared scripts can append ESP (or another code) to a language group
      // already moved here. Mark its new children, without moving it again.
      for (const group of destination.children) {
        if (isCodeContent(group)) markBadgeGeometry(group);
      }
    }
  }

  // i18n can replace a translated span's contents via textContent, removing
  // rich markup. Restore emphasis after such updates without hijacking i18n,
  // changing the string, or touching a translation without these English terms.
  function highlightRepositoryTerms() {
    const root = document.querySelector('[data-i18n="kt.affiliation_repository"]');
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const changed = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement?.closest('strong')) continue;
      if (/community-built repository|little phone book/i.test(node.data)) changed.push(node);
    }
    for (const textNode of changed) {
      const parts = textNode.data.split(/(community-built repository|little phone book)/gi);
      const fragment = document.createDocumentFragment();
      for (const part of parts) {
        if (/^(?:community-built repository|little phone book)$/i.test(part)) {
          const strong = document.createElement('strong');
          strong.textContent = part;
          fragment.appendChild(strong);
        } else if (part) {
          fragment.appendChild(document.createTextNode(part));
        }
      }
      textNode.replaceWith(fragment);
    }
  }

  function hasLanguageMutation(records) {
    return records.some(record => {
      if (record.target.nodeType === 1 && record.target.closest('.kt-card-languages')) {
        // Newly injected codes inside an existing relocated group need tilt too.
        return record.type === 'childList' ? record.addedNodes.length > 0 :
          record.type === 'characterData' || record.type === 'attributes';
      }
      if (record.type === 'attributes') return record.target.matches(LANGUAGE_SELECTOR);
      if (record.type === 'characterData') return !!record.target.parentElement?.closest(LANGUAGE_SELECTOR);
      return [...record.addedNodes].some(node =>
        node.nodeType === 1 && (node.matches(LANGUAGE_SELECTOR + ', .kt-member-title, ' + CARD_SELECTOR) || !!node.querySelector(LANGUAGE_SELECTOR)) ||
        node.nodeType === 3 && record.target.nodeType === 1 && !!record.target.closest(LANGUAGE_SELECTOR)
      );
    });
  }

  function boot() {
    initializeProfileAvatarRecovery();
    updateCardLabels();
    scheduleChatterHandleFit();
    if (chatterLists.length && 'ResizeObserver' in window) {
      const chatterResizeObserver = new ResizeObserver(scheduleChatterHandleFit);
      chatterLists.forEach(list => {
        chatterResizeObserver.observe(list);
        list.querySelectorAll('.kt-chatters__card').forEach(card => chatterResizeObserver.observe(card));
      });
    }
    // The panel can be max-width constrained while its vw-based type size still
    // changes, so watch viewport changes even when ResizeObserver is available.
    window.addEventListener('resize', scheduleChatterHandleFit, { passive: true });
    if (document.fonts?.ready) document.fonts.ready.then(scheduleChatterHandleFit);
    if (chatterLists.length) {
      const chatterTextObserver = new MutationObserver(scheduleChatterHandleFit);
      chatterLists.forEach(list => chatterTextObserver.observe(list, {
        childList: true, characterData: true, subtree: true
      }));
    }

    const grids = document.querySelectorAll('.kt-member-grid, .kt-recommendation-grid');
    if (grids.length) {
      let queued = false;
      const observer = new MutationObserver(records => {
        if (!hasLanguageMutation(records) || queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; updateCardLabels(); });
      });
      grids.forEach(grid => observer.observe(grid, {
        childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: ['class', 'data-language', 'data-languages', 'data-lang-code', 'data-stream-lang']
      }));
    }

    highlightRepositoryTerms();
    const repository = document.querySelector('[data-i18n="kt.affiliation_repository"]');
    if (repository) {
      let queued = false;
      const observer = new MutationObserver(() => {
        if (queued) return;
        queued = true;
        queueMicrotask(() => { queued = false; highlightRepositoryTerms(); });
      });
      observer.observe(repository, { childList: true, characterData: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
