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
  const chatterLists = document.querySelectorAll('.kt-chatters__list');

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
