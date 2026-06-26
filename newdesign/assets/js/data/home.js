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
      label: "start",
      icon: "assets/img/start-icon.png"
    },
    activeApp: {
      title: "welcome.txt - Notepad",
      icon: "assets/img/notepad-icon.png"
    },
    tray: {
      time: "12:00 PM",
      icons: [
        {
          src: "assets/img/network-icon.png",
          alt: "Network status"
        },
        {
          src: "assets/img/speaker-icon.png",
          alt: "Volume"
        }
      ]
    }
  }
};
