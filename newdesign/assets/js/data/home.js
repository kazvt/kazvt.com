export const home = {
  art: {
    src: "assets/img/art.png",
    alt: "Anime character standing beside the welcome window"
  },
  notepad: {
    title: "welcome.txt - Notepad",
    menus: ["File", "Edit", "Format", "View", "Help"],
    status: ["Ready", "Windows XP", "Ln 1", "Col 1"],
    text: "Hello, visitor!\n\nWelcome to my little corner of the old internet.\n\nThis page is built like a Windows XP desktop, with the clean Notepad window structure handled by XP.css.\n\nLook to the right for art.png, the character image you can swap whenever you want.\n\nEnjoy your stay."
  },
  taskbar: {
    start: {
      label: "Start",
      icon: "assets/img/xp/start_btn_normal.png"
    },
    activeApp: {
      title: "welcome.txt - Notepad",
      icon: "https://win32.run/images/xp/icons/Notepad.png"
    },
    tray: {
      time: "12:00 AM",
      icons: [
        {
          src: "https://win32.run/images/xp/icons/TourXP.png",
          alt: "Windows XP tour"
        },
        {
          src: "https://win32.run/images/xp/icons/SecurityError.png",
          alt: "Security alert"
        },
        {
          src: "https://win32.run/images/xp/icons/Volume.png",
          alt: "Volume"
        }
      ]
    }
  }
};
