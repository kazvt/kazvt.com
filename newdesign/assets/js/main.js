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
      '>> mascot: assets/img/art.png',
      '',
      'Stay awhile. Make yourself at home. ✧',
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

const clock = document.querySelector('#taskbar-clock');

const updateClock = () => {
  if (!clock) return;
  clock.textContent = new Intl.DateTimeFormat([], {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
};

updateClock();
window.setInterval(updateClock, 30_000);
