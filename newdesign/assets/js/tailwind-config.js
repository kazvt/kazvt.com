window.tailwind = window.tailwind || {};
window.tailwind.config = {
  corePlugins: {
    preflight: false
  },
  theme: {
    extend: {
      fontFamily: {
        xp: ["Tahoma", "Microsoft Sans Serif", "Arial", "sans-serif"],
        caption: ["Trebuchet MS", "Tahoma", "Microsoft Sans Serif", "Arial", "sans-serif"],
        notepad: ["Lucida Console", "Courier New", "monospace"]
      }
    }
  }
};
