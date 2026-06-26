export const home = {
  art: {
    src: "assets/img/art.png",
    alt: "Anime character standing beside the welcome window"
  },
  notepad: {
    title: "welcome.txt - Notepad",
    menus: ["File", "Edit", "Format", "View", "Help"],
    status: ["Ready", "Windows XP", "Ln 1", "Col 1"],
    text: "Hello, visitor!\n\nWelcome to my little corner of the old internet.\n\nThis page is built like a Windows XP desktop, with the Notepad window structure handled by XP.css.\n\nThe character on the right is loaded from assets/img/art.png, so you can swap that file whenever you want.\n\nEnjoy your stay."
  },
  taskbar: {
    startLabel: "Start",
    activeTitle: "welcome.txt - Notepad",
    trayIcons: [
      { id: "tour", label: "Take a tour of Windows XP" },
      { id: "security", label: "Security alert" },
      { id: "volume", label: "Volume" }
    ]
  }
};
