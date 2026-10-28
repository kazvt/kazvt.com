/**
 * --------------------------------------------------------------------------
 * Bootstrap util/index.js
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
 * --------------------------------------------------------------------------
 */

const MAX_UID = 1_000_000
const MILLISECONDS_MULTIPLIER = 1000
const TRANSITION_END = 'transitionend'

/**
 * Properly escape IDs selectors to handle weird IDs
 * @param {string} selector
 * @returns {string}
 */
const parseSelector = selector => {
  if (selector && window.CSS && window.CSS.escape) {
    // document.querySelector needs escaping to handle IDs (html5+) containing for instance /
    selector = selector.replace(/#([^\s"#']+)/g, (match, id) => `#${CSS.escape(id)}`)
  }

  return selector
}

// Shout-out Angus Croll (https://goo.gl/pxwQGp)
const toType = object => {
  if (object === null || object === undefined) {
    return `${object}`
  }

  return Object.prototype.toString.call(object).match(/\s([a-z]+)/i)[1].toLowerCase()
}

/**
 * Public Util API
 */

const getUID = prefix => {
  do {
    prefix += Math.floor(Math.random() * MAX_UID)
  } while (document.getElementById(prefix))

  return prefix
}

const getTransitionDurationFromElement = element => {
  if (!element) {
    return 0
  }

  // Get transition-duration of the element
  let { transitionDuration, transitionDelay } = window.getComputedStyle(element)

  const floatTransitionDuration = Number.parseFloat(transitionDuration)
  const floatTransitionDelay = Number.parseFloat(transitionDelay)

  // Return 0 if element or transition duration is not found
  if (!floatTransitionDuration && !floatTransitionDelay) {
    return 0
  }

  // If multiple durations are defined, take the first
  transitionDuration = transitionDuration.split(',')[0]
  transitionDelay = transitionDelay.split(',')[0]

  return (Number.parseFloat(transitionDuration) + Number.parseFloat(transitionDelay)) * MILLISECONDS_MULTIPLIER
}

const triggerTransitionEnd = element => {
  element.dispatchEvent(new Event(TRANSITION_END))
}

const isElement = object => {
  if (!object || typeof object !== 'object') {
    return false
  }

  if (typeof object.jquery !== 'undefined') {
    object = object[0]
  }

  return typeof object.nodeType !== 'undefined'
}

const getElement = object => {
  // it's a jQuery object or a node element
  if (isElement(object)) {
    return object.jquery ? object[0] : object
  }

  if (typeof object === 'string' && object.length > 0) {
    return document.querySelector(parseSelector(object))
  }

  return null
}

const isVisible = element => {
  if (!isElement(element) || element.getClientRects().length === 0) {
    return false
  }

  const elementIsVisible = getComputedStyle(element).getPropertyValue('visibility') === 'visible'
  // Handle `details` element as its content may falsie appear visible when it is closed
  const closedDetails = element.closest('details:not([open])')

  if (!closedDetails) {
    return elementIsVisible
  }

  if (closedDetails !== element) {
    const summary = element.closest('summary')
    if (summary && summary.parentNode !== closedDetails) {
      return false
    }

    if (summary === null) {
      return false
    }
  }

  return elementIsVisible
}

const isDisabled = element => {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return true
  }

  if (element.classList.contains('disabled')) {
    return true
  }

  if (typeof element.disabled !== 'undefined') {
    return element.disabled
  }

  return element.hasAttribute('disabled') && element.getAttribute('disabled') !== 'false'
}

const findShadowRoot = element => {
  if (!document.documentElement.attachShadow) {
    return null
  }

  // Can find the shadow root otherwise it'll return the document
  if (typeof element.getRootNode === 'function') {
    const root = element.getRootNode()
    return root instanceof ShadowRoot ? root : null
  }

  if (element instanceof ShadowRoot) {
    return element
  }

  // when we don't find a shadow root
  if (!element.parentNode) {
    return null
  }

  return findShadowRoot(element.parentNode)
}

const noop = () => {}

/**
 * Trick to restart an element's animation
 *
 * @param {HTMLElement} element
 * @return void
 *
 * @see https://www.harrytheo.com/blog/2021/02/restart-a-css-animation-with-javascript/#restarting-a-css-animation
 */
const reflow = element => {
  element.offsetHeight // eslint-disable-line no-unused-expressions
}

const getjQuery = () => {
  if (window.jQuery && !document.body.hasAttribute('data-bs-no-jquery')) {
    return window.jQuery
  }

  return null
}

const DOMContentLoadedCallbacks = []

const onDOMContentLoaded = callback => {
  if (document.readyState === 'loading') {
    // add listener on the first call when the document is in loading state
    if (!DOMContentLoadedCallbacks.length) {
      document.addEventListener('DOMContentLoaded', () => {
        for (const callback of DOMContentLoadedCallbacks) {
          callback()
        }
      })
    }

    DOMContentLoadedCallbacks.push(callback)
  } else {
    callback()
  }
}

const isRTL = () => document.documentElement.dir === 'rtl'

const defineJQueryPlugin = plugin => {
  onDOMContentLoaded(() => {
    const $ = getjQuery()
    /* istanbul ignore if */
    if ($) {
      const name = plugin.NAME
      const JQUERY_NO_CONFLICT = $.fn[name]
      $.fn[name] = plugin.jQueryInterface
      $.fn[name].Constructor = plugin
      $.fn[name].noConflict = () => {
        $.fn[name] = JQUERY_NO_CONFLICT
        return plugin.jQueryInterface
      }
    }
  })
}

const execute = (possibleCallback, args = [], defaultValue = possibleCallback) => {
  return typeof possibleCallback === 'function' ? possibleCallback.call(...args) : defaultValue
}

const executeAfterTransition = (callback, transitionElement, waitForTransition = true) => {
  if (!waitForTransition) {
    execute(callback)
    return
  }

  const durationPadding = 5
  const emulatedDuration = getTransitionDurationFromElement(transitionElement) + durationPadding

  let called = false

  const handler = ({ target }) => {
    if (target !== transitionElement) {
      return
    }

    called = true
    transitionElement.removeEventListener(TRANSITION_END, handler)
    execute(callback)
  }

  transitionElement.addEventListener(TRANSITION_END, handler)
  setTimeout(() => {
    if (!called) {
      triggerTransitionEnd(transitionElement)
    }
  }, emulatedDuration)
}

/**
 * Return the previous/next element of a list.
 *
 * @param {array} list    The list of elements
 * @param activeElement   The active element
 * @param shouldGetNext   Choose to get next or previous element
 * @param isCycleAllowed
 * @return {Element|elem} The proper element
 */
const getNextActiveElement = (list, activeElement, shouldGetNext, isCycleAllowed) => {
  const listLength = list.length
  let index = list.indexOf(activeElement)

  // if the element does not exist in the list return an element
  // depending on the direction and if cycle is allowed
  if (index === -1) {
    return !shouldGetNext && isCycleAllowed ? list[listLength - 1] : list[0]
  }

  index += shouldGetNext ? 1 : -1

  if (isCycleAllowed) {
    index = (index + listLength) % listLength
  }

  return list[Math.max(0, Math.min(index, listLength - 1))]
}

export {
  defineJQueryPlugin,
  execute,
  executeAfterTransition,
  findShadowRoot,
  getElement,
  getjQuery,
  getNextActiveElement,
  getTransitionDurationFromElement,
  getUID,
  isDisabled,
  isElement,
  isRTL,
  isVisible,
  noop,
  onDOMContentLoaded,
  parseSelector,
  reflow,
  triggerTransitionEnd,
  toType
}

/* Kazstrap glyph typography: round-robin across eleven font choices. */
;(function initializeKazstrapGlyphCycle() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || window.__kazstrapGlyphCycleStarted) {
    return
  }

  window.__kazstrapGlyphCycleStarted = true

  const excludedSelector = 'script, style, noscript, template, textarea, input, select, option, code, pre, kbd, samp, svg, canvas, math, .kazstrap-glyph, [contenteditable]:not([contenteditable="false"])'
  const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null
  let nextFont = 0

  const isGraphemeExtender = character => {
    const codePoint = character.codePointAt(0)
    return (codePoint >= 0x0300 && codePoint <= 0x036f) ||
      (codePoint >= 0x1ab0 && codePoint <= 0x1aff) ||
      (codePoint >= 0x1dc0 && codePoint <= 0x1dff) ||
      (codePoint >= 0x20d0 && codePoint <= 0x20ff) ||
      (codePoint >= 0xfe00 && codePoint <= 0xfe0f) ||
      (codePoint >= 0xfe20 && codePoint <= 0xfe2f) ||
      (codePoint >= 0x1f3fb && codePoint <= 0x1f3ff) ||
      (codePoint >= 0xe0020 && codePoint <= 0xe007f) ||
      (codePoint >= 0xe0100 && codePoint <= 0xe01ef)
  }

  const getGraphemes = text => {
    if (segmenter) {
      return Array.from(segmenter.segment(text), part => part.segment)
    }

    const graphemes = []

    for (const character of Array.from(text)) {
      const codePoint = character.codePointAt(0)
      const previous = graphemes[graphemes.length - 1] || ''
      const previousCodePoints = Array.from(previous)
      const previousPoint = previousCodePoints[0]?.codePointAt(0)
      const isRegionalPair = previousCodePoints.length === 1 &&
        previousPoint >= 0x1f1e6 && previousPoint <= 0x1f1ff &&
        codePoint >= 0x1f1e6 && codePoint <= 0x1f1ff

      if (previous && (isGraphemeExtender(character) || character === '\u200d' || previous.endsWith('\u200d') || isRegionalPair)) {
        graphemes[graphemes.length - 1] += character
      } else {
        graphemes.push(character)
      }
    }

    return graphemes
  }

  const cycleTextNode = textNode => {
    if (!textNode.parentElement || !textNode.nodeValue || !textNode.nodeValue.trim()) {
      return
    }

    if (textNode.parentElement.closest(excludedSelector)) {
      return
    }

    const fragment = document.createDocumentFragment()
    let changed = false

    for (const grapheme of getGraphemes(textNode.nodeValue)) {
      if (/^\s+$/u.test(grapheme)) {
        fragment.append(document.createTextNode(grapheme))
        continue
      }

      const glyph = document.createElement('span')
      glyph.className = `kazstrap-glyph kazstrap-glyph--${nextFont}`
      glyph.textContent = grapheme
      fragment.append(glyph)
      nextFont = (nextFont + 1) % 11
      changed = true
    }

    if (changed) {
      textNode.replaceWith(fragment)
    }
  }

  const cycleTextWithin = root => {
    if (root.nodeType === Node.TEXT_NODE) {
      cycleTextNode(root)
      return
    }

    if (root.nodeType === Node.ELEMENT_NODE && root.matches(excludedSelector)) {
      return
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: textNode => textNode.parentElement && textNode.parentElement.closest(excludedSelector)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT
    })
    const textNodes = []

    while (walker.nextNode()) {
      textNodes.push(walker.currentNode)
    }

    for (const textNode of textNodes) {
      cycleTextNode(textNode)
    }
  }

  const start = () => {
    if (!document.body) {
      return
    }

    cycleTextWithin(document.body)

    const observer = new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          cycleTextWithin(node)
        }
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })
    window.__kazstrapGlyphCycleObserver = observer
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true })
  } else {
    start()
  }
})()
