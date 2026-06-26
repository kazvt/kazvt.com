const homepageContent = {
  notepad: {
    title: 'greeting.txt - Notepad',
    greetingLines: [
      'Hello, user!',
      '',
      'Welcome back to the old internet.',
      'This homepage is running on pure static HTML, CSS, and JavaScript.',
      '',
      '>> theme: Windows XP',
      '>> background: Photoshop transparency checkerboard',
      '>> mascot: custom PNG art.png',
      '',
      'Stay awhile. Click around. Make yourself at home. ✧',
    ],
    actions: [
      { id: 'wave', label: 'Say hi' },
      { id: 'sparkle', label: 'Sparkle' },
    ],
  },
  mascot: {
    src: 'assets/img/art.png',
    alt: 'Anime character artwork standing to the right of the Notepad window',
    caption: 'PNG artwork loaded from assets/img/art.png.',
  },
};

XPHomepage.render('#notepad-root', XPHomepage.makeNotepadWindow(homepageContent.notepad));
XPHomepage.render('#mascot-root', XPHomepage.makeMascot(homepageContent.mascot));

const paper = document.querySelector('#notepad-paper');
const clock = document.querySelector('#taskbar-clock');

const appendLine = (line) => {
  if (!paper) return;
  paper.textContent = `${paper.textContent.trimEnd()}\n${line}`;
  paper.scrollTop = paper.scrollHeight;
};

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const actions = {
    wave: () => appendLine('\nMascot.exe says: hiiii!'),
    sparkle: () => appendLine('\n✧･ﾟ: *✧･ﾟ:* transparent pixel magic *:･ﾟ✧*:･ﾟ✧'),
  };

  actions[button.dataset.action]?.();
});

const updateClock = () => {
  if (!clock) return;
  clock.textContent = new Intl.DateTimeFormat([], {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
};

updateClock();
window.setInterval(updateClock, 30_000);
