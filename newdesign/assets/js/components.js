const XPHomepage = (() => {
  const escapeHTML = (value) =>
    String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');

  const makeTitleBar = ({ title = 'untitled - Notepad', controls = ['Minimize', 'Maximize', 'Close'] } = {}) => {
    const controlButtons = controls
      .map((label) => `<button aria-label="${escapeHTML(label)}"></button>`)
      .join('');

    return `
      <div class="title-bar">
        <div class="title-bar-text">${escapeHTML(title)}</div>
        <div class="title-bar-controls">${controlButtons}</div>
      </div>
    `;
  };

  const makeMenuBar = (items = ['File', 'Edit', 'Format', 'View', 'Help']) => `
    <nav class="notepad-menu" aria-label="Notepad menu">
      ${items.map((item) => `<span>${escapeHTML(item)}</span>`).join('')}
    </nav>
  `;

  const makeStatusBar = (items = ['Ln 1, Col 1', '100%', 'Windows (CRLF)', 'UTF-8']) => `
    <div class="status-bar notepad-status">
      ${items.map((item) => `<p class="status-bar-field">${escapeHTML(item)}</p>`).join('')}
    </div>
  `;

  const makeNotepadWindow = ({ title, greetingLines, actions = [] }) => {
    const lines = Array.isArray(greetingLines) ? greetingLines.join('\n') : greetingLines;
    const actionMarkup = actions.length
      ? `<div class="notepad-actions">${actions
          .map((action) => `<button type="button" data-action="${escapeHTML(action.id)}">${escapeHTML(action.label)}</button>`)
          .join('')}</div>`
      : '';

    return `
      <article class="window xp-notepad" role="region" aria-label="${escapeHTML(title)}">
        ${makeTitleBar({ title })}
        <div class="window-body">
          ${makeMenuBar()}
          <pre class="notepad-paper" id="notepad-paper">${escapeHTML(lines)}</pre>
          ${actionMarkup}
          ${makeStatusBar()}
        </div>
      </article>
    `;
  };

  const makeMascot = ({ src, alt, caption }) => `
    <aside class="mascot-frame" aria-label="Anime homepage mascot">
      <p class="mascot-caption">${escapeHTML(caption)}</p>
      <img class="anime-mascot" src="${escapeHTML(src)}" alt="${escapeHTML(alt)}" />
    </aside>
  `;

  const render = (target, markup) => {
    const element = typeof target === 'string' ? document.querySelector(target) : target;
    if (!element) return;
    element.innerHTML = markup;
  };

  return {
    makeNotepadWindow,
    makeMascot,
    render,
  };
})();
