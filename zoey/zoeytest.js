(() => {
  const body = document.body;
  const html = document.documentElement;
  const gifSky = document.getElementById("gifSky");
  const backgroundMusicUrl = "/zoey/assets/background/zoey-galaxy-background.mp3";
  const backgroundMusicBytes = fetch(backgroundMusicUrl, { cache: "force-cache" })
    .then((response) => response.ok ? response.arrayBuffer() : null)
    .catch(() => null);

  // Submitted sender artwork and recordings stay local to this site; never synthesize them.
  const entrySlots = [
    {
      id: "kaz",
      name: "Kaz",
      avatar: "/zoey/assets/kaz/kaz-avatar.png",
      clips: [
        { src: "/zoey/assets/kaz/kaz-voice-1.wav", caption: "Kaz's voice note 1 of 3." },
        { src: "/zoey/assets/kaz/kaz-voice-2.wav", caption: "Kaz's voice note 2 of 3." },
        { src: "/zoey/assets/kaz/kaz-voice-3.wav", caption: "Kaz's voice note 3 of 3." }
      ]
    },
    {
      id: "abigail",
      name: "Abigail",
      avatar: "/zoey/assets/abigail/abigail-avatar.png",
      clips: [
        { src: "/zoey/assets/abigail/abigail-voice-1.wav", caption: "Abigail's voice note 1 of 3." },
        { src: "/zoey/assets/abigail/abigail-voice-2.wav", caption: "Abigail's voice note 2 of 3." },
        { src: "/zoey/assets/abigail/abigail-voice-3.wav", caption: "Abigail's voice note 3 of 3." }
      ]
    },
    {
      id: "letty",
      name: "Letty",
      avatar: "/zoey/assets/letty/letty-avatar.png",
      clips: [
        { src: "/zoey/assets/letty/letty-voice-1.wav", caption: "Letty's voice note 1 of 2." },
        { src: "/zoey/assets/letty/letty-voice-2.wav", caption: "Letty's voice note 2 of 2." }
      ]
    },
    {
      id: "traaansfem",
      name: "TraaansFem",
      avatar: "/zoey/assets/traaansfem/traaansfem-avatar.png",
      clips: [
        { src: "/zoey/assets/traaansfem/traaansfem-voice-1.wav", caption: "TraaansFem's voice note 1 of 2." },
        { src: "/zoey/assets/traaansfem/traaansfem-voice-2.wav", caption: "TraaansFem's voice note 2 of 2." }
      ]
    },
    {
      id: "kilda",
      name: "Kilda",
      avatar: "/zoey/assets/kilda/kilda-avatar.png",
      clips: [
        { src: "/zoey/assets/kilda/kilda-voice-1.wav", caption: "Kilda's voice note 1 of 3." },
        { src: "/zoey/assets/kilda/kilda-voice-2.wav", caption: "Kilda's voice note 2 of 3." },
        { src: "/zoey/assets/kilda/kilda-voice-3.wav", caption: "Kilda's voice note 3 of 3." }
      ]
    },
    {
      id: "froggy",
      name: "Froggy",
      avatar: "/zoey/assets/froggy/froggy-avatar.png",
      clips: [
        { src: "/zoey/assets/froggy/froggy-voice-1-centered-20261108.wav?v=20261108-11", caption: "Froggy's voice note 1 of 3." },
        { src: "/zoey/assets/froggy/froggy-voice-2-centered-20261108.wav?v=20261108-11", caption: "Froggy's voice note 2 of 3." },
        { src: "/zoey/assets/froggy/froggy-voice-3-centered-20261108.wav?v=20261108-11", caption: "Froggy's voice note 3 of 3." }
      ]
    },
    {
      id: "oceo",
      name: "Oceo",
      avatar: "/zoey/assets/oceo/oceo-avatar.png",
      clips: [
        { src: "/zoey/assets/oceo/oceo-voice-1.wav?v=20261108-04", caption: "Oceo's voice note 1 of 3." },
        { src: "/zoey/assets/oceo/oceo-voice-2.wav?v=20261108-04", caption: "Oceo's voice note 2 of 3." },
        { src: "/zoey/assets/oceo/oceo-voice-3.wav?v=20261108-04", caption: "Oceo's voice note 3 of 3." }
      ]
    },
    {
      id: "diosu",
      name: "Diosu",
      avatar: "/zoey/assets/diosu/diosu-avatar.png",
      clips: [
        { src: "/zoey/assets/diosu/diosu-voice-1-20261108-later.wav?v=20261108-03", caption: "Diosu's voice note 1 of 4." },
        { src: "/zoey/assets/diosu/diosu-voice-2-20261108-later.wav?v=20261108-03", caption: "Diosu's voice note 2 of 4." },
        { src: "/zoey/assets/diosu/diosu-voice-3.wav?v=20261110-01", caption: "Diosu's voice note 3 of 4." },
        { src: "/zoey/assets/diosu/diosu-voice-4.wav?v=20261110-01", caption: "Diosu's voice note 4 of 4." }
      ]
    },
    {
      id: "poppy",
      name: "Poppy",
      avatar: "/zoey/assets/poppy/poppy-avatar.png",
      clips: [
        { src: "/zoey/assets/poppy/poppy-voice-1-20261108-later-2.wav?v=20261108-11", caption: "Poppy's voice note 1 of 3." },
        { src: "/zoey/assets/poppy/poppy-voice-2-20261108-later-2.wav?v=20261108-11", caption: "Poppy's voice note 2 of 3." },
        { src: "/zoey/assets/poppy/poppy-voice-3.wav?v=20261108-01", caption: "Poppy's voice note 3 of 3." }
      ]
    },
    {
      id: "frosty",
      name: "Frosty",
      avatar: "/zoey/assets/frosty/frosty-avatar.gif?v=20261109-01",
      clips: [
        { src: "/zoey/assets/frosty/frosty-voice-1.wav", caption: "Frosty's voice note 1 of 3." },
        { src: "/zoey/assets/frosty/frosty-voice-2.wav", caption: "Frosty's voice note 2 of 3." },
        { src: "/zoey/assets/frosty/frosty-voice-3.wav", caption: "Frosty's voice note 3 of 3." }
      ]
    },
    {
      id: "rochelle",
      name: "Rochelle",
      avatar: "/zoey/assets/evo/evo-avatar.png",
      clips: [
        { src: "/zoey/assets/evo/evo-voice-1-20261106.mp3", caption: "Rochelle's voice note 1 of 3." },
        { src: "/zoey/assets/evo/evo-voice-2-20261106.mp3", caption: "Rochelle's voice note 2 of 3." },
        { src: "/zoey/assets/evo/evo-voice-3-20261106.mp3", caption: "Rochelle's voice note 3 of 3." }
      ]
    },
    {
      id: "nea-pollen",
      name: "Nea",
      avatar: "/zoey/assets/nea-pollen/nea-pollen-avatar.png",
      clips: [
        { src: "/zoey/assets/nea-pollen/nea-pollen-voice-1.wav?v=20261107-06", caption: "Nea's voice note 1 of 3." },
        { src: "/zoey/assets/nea-pollen/nea-pollen-voice-2.wav?v=20261107-06", caption: "Nea's voice note 2 of 3." },
        { src: "/zoey/assets/nea-pollen/nea-pollen-voice-3.wav?v=20261107-06", caption: "Nea's voice note 3 of 3." }
      ]
    },
    {
      id: "dom",
      name: "Dom",
      avatar: "/zoey/assets/dom/dom-avatar.png",
      clips: [
        { src: "/zoey/assets/dom/dom-voice-1.wav", caption: "Dom's voice note 1 of 3." },
        { src: "/zoey/assets/dom/dom-voice-2.wav", caption: "Dom's voice note 2 of 3." },
        { src: "/zoey/assets/dom/dom-voice-3.wav", caption: "Dom's voice note 3 of 3." }
      ]
    },
    {
      id: "serunie",
      name: "Serunie",
      avatar: "/zoey/assets/serunie/serunie-avatar.png",
      clips: [
        { src: "/zoey/assets/serunie/serunie-voice-1.wav?v=20261107-05", caption: "Serunie's voice note 1 of 3." },
        { src: "/zoey/assets/serunie/serunie-voice-2.wav?v=20261107-05", caption: "Serunie's voice note 2 of 3." },
        { src: "/zoey/assets/serunie/serunie-voice-3.wav?v=20261107-05", caption: "Serunie's voice note 3 of 3." }
      ]
    },
    {
      id: "maple",
      name: "Maple",
      avatar: "/zoey/assets/maple/maple-avatar.png",
      clips: [
        { src: "/zoey/assets/maple/maple-voice-1.wav?v=20261107-07", caption: "Maple's voice note 1 of 3." },
        { src: "/zoey/assets/maple/maple-voice-2.wav?v=20261107-07", caption: "Maple's voice note 2 of 3." },
        { src: "/zoey/assets/maple/maple-voice-3.wav?v=20261107-07", caption: "Maple's voice note 3 of 3." }
      ]
    },
    {
      id: "pato",
      name: "Pato",
      avatar: "/zoey/assets/pato/pato-avatar.png",
      clips: [
        { src: "/zoey/assets/pato/pato-voice-1-20261108-later.wav?v=20261108-08", caption: "Pato's voice note 1 of 3." },
        { src: "/zoey/assets/pato/pato-voice-2-20261108-later.wav?v=20261108-08", caption: "Pato's voice note 2 of 3." },
        { src: "/zoey/assets/pato/pato-voice-3-20261108-tail.wav?v=20261108-11", caption: "Pato's voice note 3 of 3." }
      ]
    },
    {
      id: "lily",
      name: "Lily",
      avatar: "/zoey/assets/lily/lily-avatar.gif",
      clips: [
        { src: "/zoey/assets/lily/lily-voice-1-20261110.wav?v=20261110-02", caption: "Lily's voice note 1 of 3." },
        { src: "/zoey/assets/lily/lily-voice-2-20261110.wav?v=20261110-02", caption: "Lily's voice note 2 of 3." },
        { src: "/zoey/assets/lily/lily-voice-3-20261110.wav?v=20261110-02", caption: "Lily's voice note 3 of 3." }
      ]
    },
    {
      id: "faroe",
      name: "Faroe",
      avatar: "/zoey/assets/faroe/faroe-avatar.gif",
      clips: [
        { src: "/zoey/assets/faroe/faroe-voice-1.wav?v=20261108-01", caption: "Faroe's voice note 1 of 3." },
        { src: "/zoey/assets/faroe/faroe-voice-2.wav?v=20261108-01", caption: "Faroe's voice note 2 of 3." },
        { src: "/zoey/assets/faroe/faroe-voice-3.wav?v=20261108-01", caption: "Faroe's voice note 3 of 3." }
      ]
    },
    {
      id: "alyx",
      name: "Alyx",
      avatar: "/zoey/assets/alyx/alyx-avatar.gif?v=20261109-01",
      clips: [
        { src: "/zoey/assets/alyx/alyx-voice-1.wav?v=20261109-01", caption: "Alyx's voice note 1 of 3." },
        { src: "/zoey/assets/alyx/alyx-voice-2.wav?v=20261109-01", caption: "Alyx's voice note 2 of 3." },
        { src: "/zoey/assets/alyx/alyx-voice-3.wav?v=20261109-01", caption: "Alyx's voice note 3 of 3." }
      ]
    },
    {
      id: "willow",
      name: "Willow",
      avatar: "/zoey/assets/willow/willow-avatar.png?v=20261109-02",
      clips: [
        { src: "/zoey/assets/willow/willow-voice-1.wav?v=20261109-02", caption: "Willow's voice note 1 of 3." },
        { src: "/zoey/assets/willow/willow-voice-2.wav?v=20261109-02", caption: "Willow's voice note 2 of 3." },
        { src: "/zoey/assets/willow/willow-voice-3.wav?v=20261109-02", caption: "Willow's voice note 3 of 3." }
      ]
    },
    {
      id: "claire",
      name: "Claire",
      avatar: "/zoey/assets/claire/claire-avatar.png?v=20261109-03",
      clips: [
        { src: "/zoey/assets/claire/claire-voice-1.wav?v=20261109-03", caption: "Claire's voice note 1 of 3." },
        { src: "/zoey/assets/claire/claire-voice-2.wav?v=20261109-03", caption: "Claire's voice note 2 of 3." },
        { src: "/zoey/assets/claire/claire-voice-3.wav?v=20261109-03", caption: "Claire's voice note 3 of 3." }
      ]
    },
    {
      id: "skawtzilla",
      name: "Skawtzilla",
      avatar: "/zoey/assets/skawtzilla/skawtzilla-avatar.png?v=20261109-04",
      clips: [
        { src: "/zoey/assets/skawtzilla/skawtzilla-voice-1.wav?v=20261109-04", caption: "Skawtzilla's voice note 1 of 3." },
        { src: "/zoey/assets/skawtzilla/skawtzilla-voice-2.wav?v=20261109-04", caption: "Skawtzilla's voice note 2 of 3." },
        { src: "/zoey/assets/skawtzilla/skawtzilla-voice-3.wav?v=20261109-04", caption: "Skawtzilla's voice note 3 of 3." }
      ]
    },
    {
      id: "blue",
      name: "Blue",
      avatar: "/zoey/assets/blu/blu-avatar.png?v=20261109-05",
      clips: [
        { src: "/zoey/assets/blu/blu-voice-1.wav?v=20261109-05", caption: "Blue's voice note 1 of 3." },
        { src: "/zoey/assets/blu/blu-voice-2.wav?v=20261109-05", caption: "Blue's voice note 2 of 3." },
        { src: "/zoey/assets/blu/blu-voice-3.wav?v=20261109-05", caption: "Blue's voice note 3 of 3." }
      ]
    },
    {
      id: "glyph",
      name: "Glyph",
      avatar: "/zoey/assets/glyph/glyph-avatar.gif?v=20261109-01",
      placementBias: "hero-side",
      clips: [
        { src: "/zoey/assets/glyph/glyph-voice-1.wav?v=20261109-01", caption: "Glyph's voice note 1 of 3." },
        { src: "/zoey/assets/glyph/glyph-voice-2.wav?v=20261109-01", caption: "Glyph's voice note 2 of 3." },
        { src: "/zoey/assets/glyph/glyph-voice-3.wav?v=20261109-01", caption: "Glyph's voice note 3 of 3." }
      ]
    },
    {
      id: "kaye",
      name: "Kaye",
      avatar: "/zoey/assets/kaye/kaye-avatar.gif?v=20261110-01",
      placementBias: "hero-side",
      clips: [
        { src: "/zoey/assets/kaye/kaye-voice-1.wav?v=20261110-01", caption: "Kaye's voice note 1 of 3." },
        { src: "/zoey/assets/kaye/kaye-voice-2.wav?v=20261110-01", caption: "Kaye's voice note 2 of 3." },
        { src: "/zoey/assets/kaye/kaye-voice-3.wav?v=20261110-01", caption: "Kaye's voice note 3 of 3." }
      ]
    },
    {
      id: "naya",
      name: "Naya",
      avatar: "/zoey/assets/naya/naya-avatar.gif?v=20261110-02",
      clips: [
        { src: "/zoey/assets/naya/naya-voice-1.wav?v=20261110-02", caption: "Naya's voice note 1 of 3." },
        { src: "/zoey/assets/naya/naya-voice-2.wav?v=20261110-02", caption: "Naya's voice note 2 of 3." },
        { src: "/zoey/assets/naya/naya-voice-3.wav?v=20261110-02", caption: "Naya's voice note 3 of 3." }
      ]
    },
    {
      id: "fae",
      name: "Fae",
      avatar: "/zoey/assets/fae/fae-avatar.png?v=20261110-02",
      clips: [
        { src: "/zoey/assets/fae/fae-voice-1.wav?v=20261110-02", caption: "Fae's voice note 1 of 3." },
        { src: "/zoey/assets/fae/fae-voice-2.wav?v=20261110-02", caption: "Fae's voice note 2 of 3." },
        { src: "/zoey/assets/fae/fae-voice-3.wav?v=20261110-02", caption: "Fae's voice note 3 of 3." }
      ]
    },
    {
      id: "dorbu",
      name: "Dorbu",
      avatar: "/zoey/assets/dorbu/dorbu-avatar.png?v=20261110-01",
      clips: [
        { src: "/zoey/assets/dorbu/dorbu-voice-2.wav?v=20261110-01", caption: "Dorbu's voice note 1 of 4." },
        { src: "/zoey/assets/dorbu/dorbu-voice-3.wav?v=20261110-01", caption: "Dorbu's voice note 2 of 4." },
        { src: "/zoey/assets/dorbu/dorbu-voice-4.wav?v=20261110-01", caption: "Dorbu's voice note 3 of 4." },
        { src: "/zoey/assets/dorbu/dorbu-voice-1.wav?v=20261110-01", caption: "Dorbu's voice note 4 of 4." }
      ]
    },
    {
      id: "luci",
      name: "Luci",
      avatar: "/zoey/assets/luci/luci-avatar.png",
      clips: [
        { src: "/zoey/assets/luci/luci-voice-1.wav?v=20261110-01", caption: "Luci's voice note 1 of 3." },
        { src: "/zoey/assets/luci/luci-voice-2.wav?v=20261110-01", caption: "Luci's voice note 2 of 3." },
        { src: "/zoey/assets/luci/luci-voice-3.wav?v=20261110-01", caption: "Luci's voice note 3 of 3." }
      ]
    },
    {
      id: "violet",
      name: "Violet",
      avatar: "/zoey/assets/violet/violet-avatar.png",
      clips: [
        { src: "/zoey/assets/violet/violet-voice-1.wav?v=20261110-01", caption: "Violet's voice note 1 of 3." },
        { src: "/zoey/assets/violet/violet-voice-2.wav?v=20261110-01", caption: "Violet's voice note 2 of 3." },
        { src: "/zoey/assets/violet/violet-voice-3.wav?v=20261110-01", caption: "Violet's voice note 3 of 3." }
      ]
    },
    {
      id: "kay",
      name: "Kay",
      avatar: "/zoey/assets/kay/kay-avatar.png",
      clips: [
        { src: "/zoey/assets/kay/kay-voice-1.wav?v=20261110-01", caption: "Kay's voice note 1 of 3." },
        { src: "/zoey/assets/kay/kay-voice-2.wav?v=20261110-01", caption: "Kay's voice note 2 of 3." },
        { src: "/zoey/assets/kay/kay-voice-3.wav?v=20261110-01", caption: "Kay's voice note 3 of 3." }
      ]
    },
    {
      id: "jelly",
      name: "Jelly",
      avatar: "/zoey/assets/jelly/jelly-avatar.gif",
      clips: [
        { src: "/zoey/assets/jelly/jelly-voice-1.wav?v=20261110-01", caption: "Jelly's voice note 1 of 3." },
        { src: "/zoey/assets/jelly/jelly-voice-2.wav?v=20261110-01", caption: "Jelly's voice note 2 of 3." },
        { src: "/zoey/assets/jelly/jelly-voice-3.wav?v=20261110-01", caption: "Jelly's voice note 3 of 3." }
      ]
    },
    {
      id: "kaos",
      name: "Kaos",
      avatar: "/zoey/assets/kaos/kaos-avatar.png",
      clips: [
        { src: "/zoey/assets/kaos/kaos-voice-1.wav?v=20261110-01", caption: "Kaos's voice note 1 of 3." },
        { src: "/zoey/assets/kaos/kaos-voice-2.wav?v=20261110-01", caption: "Kaos's voice note 2 of 3." },
        { src: "/zoey/assets/kaos/kaos-voice-3.wav?v=20261110-01", caption: "Kaos's voice note 3 of 3." }
      ]
    },
    {
      id: "katsu",
      name: "Katsu",
      avatar: "/zoey/assets/katsu/katsu-avatar.png",
      clips: [
        { src: "/zoey/assets/katsu/katsu-voice-1.wav?v=20261110-01", caption: "Katsu's voice note 1 of 3." },
        { src: "/zoey/assets/katsu/katsu-voice-2.wav?v=20261110-01", caption: "Katsu's voice note 2 of 3." },
        { src: "/zoey/assets/katsu/katsu-voice-3.wav?v=20261110-01", caption: "Katsu's voice note 3 of 3." }
      ]
    },
    {
      id: "crashit",
      name: "crashit",
      avatar: "/zoey/assets/crashit/crashit-avatar.jpg",
      clips: [
        { src: "/zoey/assets/crashit/crashit-voice-1.wav?v=20261111-01", caption: "crashit's voice note 1 of 2." },
        { src: "/zoey/assets/crashit/crashit-voice-2.wav?v=20261111-01", caption: "crashit's voice note 2 of 2." }
      ]
    },
    {
      id: "lola",
      name: "Lola",
      avatar: "/zoey/assets/lola/lola-avatar.png",
      clips: [
        { src: "/zoey/assets/lola/lola-voice-1.wav?v=20261111-01", caption: "Lola's voice note." }
      ]
    }
  ];

  // Each sender gets a stable, ID-seeded tilt and scatter seed. Resizing never
  // rerolls the personality of a sticker, and every tilt stays within +/-30deg.
  function stableHash(value) {
    let hash = 2166136261;
    for (const character of String(value)) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
      state = state + 0x6D2B79F5 | 0;
      let value = state;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }

  const entryTilts = new Map(entrySlots.map((entry) => [
    entry.id,
    (seededRandom(stableHash(`tilt:${entry.id}`))() * 60) - 30
  ]));

  let audioEnabled = false;
  let audioContext = null;
  let audioMixBus = null;
  let audioResumePromise = null;
  let backgroundMusicGain = null;
  let backgroundMusicBuffer = null;
  let backgroundMusicBufferPromise = null;
  let backgroundMusicStartPromise = null;
  let backgroundMusicLoopStart = 0;
  let backgroundMusicSource = null;
  let fallbackBackgroundMusic = null;
  let backgroundMusicFallback = false;
  const voiceBufferPromises = new Map();
  let startingClip = null;
  let activeVoice = null;
  const activeMedia = new Set();
  const playingCounts = new Map();
  let gifEntries = null;
  let gifImages = [];
  let catalogPromise = null;
  const clipIndexes = new Map();

  function seeded(index, salt) {
    const value = Math.sin((index + 1) * 127.1 + salt * 311.7) * 43758.5453;
    return value - Math.floor(value);
  }

  function renderEntries() {
    const fragment = document.createDocumentFragment();
    entrySlots.forEach((entry) => {
      const card = document.createElement("article");
      card.className = "z-entry";

      const button = document.createElement("button");
      button.className = "z-entry-button";
      button.type = "button";
      button.dataset.entryId = entry.id;
      button.addEventListener("click", () => {
        if (!audioEnabled) enableAudio();
        playNextClip(entry, button);
      });

      const avatar = document.createElement("span");
      avatar.className = "z-entry-avatar";
      if (entry.avatar) {
        const image = document.createElement("img");
        image.src = entry.avatar;
        image.loading = "eager";
        avatar.append(image);
      } else {
        const star = document.createElement("span");
        star.className = "z-avatar-star";
        star.textContent = "*";
        avatar.append(star);
      }

      const name = document.createElement("span");
      name.className = "z-entry-name";
      name.textContent = entry.name;
      avatar.append(name);
      button.append(avatar);
      card.append(button);
      fragment.append(card);
    });
    document.getElementById("entryCanvas").replaceChildren(fragment);
    layoutEntryStickers();
  }

  function layoutEntryStickers() {
    const canvas = document.getElementById("entryCanvas");
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    const { width, height: canvasHeight } = canvasRect;
    if (!width || !canvasHeight) return;

    const heading = document.querySelector(".z-stage-heading");
    const minimumCardSize = Math.min(width, canvasHeight) * .09;
    const preferredSize = Math.max(minimumCardSize, Math.min(width, canvasHeight) * .23);
    // Measure the heading at the largest scene scale we will try. The final
    // scale is never larger than this, so the heading can only get smaller
    // after placement and cannot collide with the stickers.
    heading?.style.setProperty("--z-scene-size", `${preferredSize.toFixed(2)}px`);
    const headingRect = heading?.getBoundingClientRect();
    const headingHeight = headingRect?.height || 48;
    const headingWidth = headingRect?.width || Math.min(width - 16, width * .72);
    const creditElement = document.getElementById("featuredCredit");
    const creditRect = creditElement?.getBoundingClientRect();
    const creditWidth = creditRect?.width || 0;
    const creditHeight = creditRect?.height || 0;
    const hoverScale = 1.12;
    // Keep the full scene in the viewport. Prefer a large centerpiece and
    // large stickers, then trade their sizes only as much as packing requires.
    const preferredEdge = preferredSize * .025;
    const headingTop = preferredEdge;
    const headingBottom = headingTop + headingHeight + preferredEdge;
    const targetHeroHeight = Math.min(canvasHeight * .8, (width - preferredEdge * 2) * 858 / 481);
    const maxHeroHeight = Math.max(48, Math.min(targetHeroHeight, canvasHeight - headingBottom * 2));
    const heroCenterX = width / 2;
    const heroPerCardRatio = 3.6;
    const sceneSizeCeiling = Math.max(1, Math.min(preferredSize, maxHeroHeight / heroPerCardRatio));
    const sceneMinimumSize = Math.min(minimumCardSize, sceneSizeCeiling);
    const cards = [...canvas.querySelectorAll(".z-entry")];
    const placementOrder = [...entrySlots].sort((left, right) => {
      const priority = Number(right.placementBias === "hero-side") - Number(left.placementBias === "hero-side");
      return priority || stableHash(`placement:${left.id}`) - stableHash(`placement:${right.id}`);
    });
    canvas.dataset.crowded = cards.length >= 20 ? "true" : "false";

    function intersects(a, b, separation = 0) {
      return !(a.right + separation <= b.left || a.left >= b.right + separation ||
        a.bottom + separation <= b.top || a.top >= b.bottom + separation);
    }

    function buildLayout(cardSize, heroHeight, samples = 96, attempt = 0) {
      const glowAllowance = cardSize * .012;
      const edge = cardSize * .025;
      const collisionGap = cardSize * .005;
      const cardHeadingTop = cardSize * .025;
      const cardHeadingBottom = cardHeadingTop + headingHeight + cardSize * .025;
      const heroCenterY = canvasHeight / 2;
      const heroWidth = heroHeight * 481 / 858;
      const hero = {
        left: heroCenterX - heroWidth / 2 - glowAllowance,
        right: heroCenterX + heroWidth / 2 + glowAllowance,
        top: heroCenterY - heroHeight / 2 - glowAllowance,
        bottom: heroCenterY + heroHeight / 2 + glowAllowance
      };
      const heading = {
        left: (width - headingWidth) / 2 - 4,
        right: (width + headingWidth) / 2 + 4,
        top: cardHeadingTop,
        bottom: cardHeadingBottom
      };
      const creditTop = hero.bottom + cardSize * .06;
      const credit = {
        left: heroCenterX - creditWidth / 2,
        right: heroCenterX + creditWidth / 2,
        top: creditTop,
        bottom: creditTop + creditHeight
      };
      const placed = [];
      const sectorCounts = Array(8).fill(0);
      // These coarse cells only balance the score; they never constrain or show as a grid.
      const coverageColumns = Math.max(2, Math.round(width / (cardSize * 2.2)));
      const coverageRows = Math.max(2, Math.round(canvasHeight / (cardSize * 2.2)));
      const coverageCounts = Array(coverageColumns * coverageRows).fill(0);
      const fieldRandom = seededRandom(stableHash(
        `coverage:${width.toFixed(1)}:${canvasHeight.toFixed(1)}:${cardSize.toFixed(2)}:${attempt}`
      ));
      const fieldPoints = [];
      const fieldColumns = Math.max(8, Math.ceil(width / Math.max(12, cardSize * .72)));
      const fieldRows = Math.max(8, Math.ceil(canvasHeight / Math.max(12, cardSize * .72)));

      // Jittered samples span the viewport so local neighbors cannot pull the
      // placement search into one increasingly dense cluster.
      for (let row = 0; row < fieldRows; row += 1) {
        for (let column = 0; column < fieldColumns; column += 1) {
          fieldPoints.push({
            centerX: (column + .12 + fieldRandom() * .76) * width / fieldColumns,
            centerY: (row + .12 + fieldRandom() * .76) * canvasHeight / fieldRows
          });
        }
      }
      const randomPointCount = Math.min(samples,
        Math.max(96, entrySlots.length * (attempt ? 8 : 5)));
      for (let sample = 0; sample < randomPointCount; sample += 1) {
        fieldPoints.push({ centerX: fieldRandom() * width, centerY: fieldRandom() * canvasHeight });
      }
      for (let index = fieldPoints.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(fieldRandom() * (index + 1));
        [fieldPoints[index], fieldPoints[swapIndex]] = [fieldPoints[swapIndex], fieldPoints[index]];
      }

      for (const entry of placementOrder) {
        const random = seededRandom(stableHash(`scatter:${entry.id}:${attempt}`));
        const angleDegrees = entryTilts.get(entry.id) || 0;
        const angle = angleDegrees * Math.PI / 180;
        const visualSize = cardSize * hoverScale;
        const rotatedWidth = visualSize * (Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle))) + glowAllowance * 2;
        const rotatedHeight = visualSize * (Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle))) + glowAllowance * 2;
        const halfWidth = rotatedWidth / 2;
        const halfHeight = rotatedHeight / 2;
        if (width < rotatedWidth + edge * 2 || canvasHeight < rotatedHeight + edge * 2) return null;
        let bestCandidate = null;
        let bestScore = -Infinity;
        const heroSideTargets = entry.placementBias === "hero-side"
          ? [
            { centerX: heroCenterX, centerY: hero.bottom + halfHeight + collisionGap, preference: 0 },
            { centerX: hero.right + halfWidth + collisionGap, centerY: heroCenterY, preference: cardSize * .02 },
            { centerX: hero.left - halfWidth - collisionGap, centerY: heroCenterY, preference: cardSize * .02 }
          ]
          : [];
        // Evaluate viewport-wide jittered points instead of filling the nearest
        // available pocket around the previous sticker. That preserves an
        // organic scatter while stopping early placements from attracting the rest.
        const candidatePoints = heroSideTargets.length
          ? [...heroSideTargets, ...fieldPoints]
          : fieldPoints;

        for (const point of candidatePoints) {
          const { centerX, centerY } = point;
          if (centerX < edge + halfWidth || centerX > width - edge - halfWidth ||
              centerY < edge + halfHeight || centerY > canvasHeight - edge - halfHeight) continue;
          const box = {
            left: centerX - halfWidth,
            right: centerX + halfWidth,
            top: centerY - halfHeight,
            bottom: centerY + halfHeight,
            centerX,
            centerY
          };
          if (intersects(box, hero, collisionGap) || intersects(box, heading, collisionGap) ||
              intersects(box, credit, collisionGap) ||
              placed.some((other) => intersects(box, other, collisionGap))) continue;

          const sector = (Math.floor((Math.atan2(centerY - heroCenterY, centerX - heroCenterX) + Math.PI) / (Math.PI / 4)) % 8 + 8) % 8;
          let nearestCenterDistance = Infinity;
          for (const other of placed) {
            nearestCenterDistance = Math.min(nearestCenterDistance,
              Math.hypot(centerX - other.centerX, centerY - other.centerY));
          }
          const coverageColumn = Math.min(coverageColumns - 1, Math.floor(centerX / width * coverageColumns));
          const coverageRow = Math.min(coverageRows - 1, Math.floor(centerY / canvasHeight * coverageRows));
          const coverageCell = coverageRow * coverageColumns + coverageColumn;
          const coveragePenalty = coverageCounts[coverageCell] * cardSize * .72;
          const sectorPenalty = sectorCounts[sector] * cardSize * .16;
          box.sector = sector;
          box.coverageCell = coverageCell;
          box.angle = angleDegrees;
          box.entryId = entry.id;
          const heroSideBias = heroSideTargets.length
            ? Math.min(...heroSideTargets.map((target) =>
              Math.hypot(centerX - target.centerX, centerY - target.centerY) + target.preference
            ))
            : 0;
          // Spread each next sticker into underused screen regions, then maximize
          // its distance from the existing stickers for even, organic spacing.
          const balancePenalty = coveragePenalty + sectorPenalty;
          box.score = heroSideTargets.length
            ? -heroSideBias - balancePenalty + random() * cardSize * .02
            : placed.length
              ? nearestCenterDistance - balancePenalty + random() * cardSize * .02
              : random() * cardSize * .02;
          if (box.score > bestScore) {
            bestCandidate = box;
            bestScore = box.score;
          }
        }

        if (!bestCandidate) return null;
        const chosen = bestCandidate;
        sectorCounts[chosen.sector] += 1;
        coverageCounts[chosen.coverageCell] += 1;
        placed.push(chosen);
      }
      return { placed, headingTop: cardHeadingTop, heroHeight };
    }

    let finalLayout = null;
    let finalSize = sceneSizeCeiling;
    const sizeScales = Array.from({ length: 81 }, (_, index) => 1 - index * .01);
    const cardSizes = [...new Set(sizeScales.map((scale) => Math.max(sceneMinimumSize,
      Math.min(sceneSizeCeiling, sceneSizeCeiling * scale))))];
    for (const cardSize of cardSizes) {
      // Keep the centerpiece and stickers in one visual scale system. Reduce
      // both together when the centered art approaches its viewport-safe cap.
      const heroHeight = cardSize * heroPerCardRatio;
      const layout = buildLayout(cardSize, heroHeight);
      if (layout) {
        finalLayout = layout;
        finalSize = cardSize;
        break;
      }
    }

    // Retry with independent candidate fields and progressively smaller stickers
    // if an unusually tight viewport defeats the preferred-size packing passes.
    if (!finalLayout) {
      const fallbackScales = [.92, .8, .68, .56, .44, .32, .2, .1];
      let attempt = 1;
      for (const scale of fallbackScales) {
        const fallbackCard = Math.max(.5, sceneMinimumSize * scale);
        const fallbackHero = fallbackCard * heroPerCardRatio;
        for (let retry = 0; retry < 2; retry += 1, attempt += 1) {
          const layout = buildLayout(fallbackCard, fallbackHero, 384, attempt);
          if (!layout) continue;
          finalLayout = layout;
          finalSize = fallbackCard;
          break;
        }
        if (finalLayout) break;
      }
    }

    if (!finalLayout) {
      console.error("The Zoey sticker field could not find a collision-free layout for every friend.");
      return;
    }

    heading.style.top = `${finalLayout.headingTop}px`;
    const art = document.getElementById("featuredArt");
    art?.style.setProperty("--z-hero-width", `${(finalLayout.heroHeight * 481 / 858).toFixed(2)}px`);
    creditElement?.style.setProperty("top", `${(canvasHeight / 2 + finalLayout.heroHeight / 2 + finalSize * .072).toFixed(2)}px`);
    const placementById = new Map(finalLayout.placed.map((sticker) => [sticker.entryId, sticker]));
    cards.forEach((card) => {
      const entryId = card.querySelector(".z-entry-button")?.dataset.entryId;
      const sticker = placementById.get(entryId);
      if (!sticker) return;
      card.style.setProperty("--entry-x", `${(sticker.centerX - finalSize / 2).toFixed(2)}px`);
      card.style.setProperty("--entry-y", `${(sticker.centerY - finalSize / 2).toFixed(2)}px`);
      card.style.setProperty("--entry-size", `${finalSize.toFixed(2)}px`);
      card.style.setProperty("--entry-tilt", `${sticker.angle.toFixed(2)}deg`);
      card.style.setProperty("--entry-hover-scale", hoverScale.toFixed(2));
    });
    heading?.style.setProperty("--z-scene-size", `${finalSize.toFixed(2)}px`);
    canvas.dataset.compact = finalSize < 48 ? "true" : "false";
    canvas.dataset.layout = "scattered";
    canvas.dataset.entrySize = finalSize.toFixed(1);
    canvas.dataset.heroHeight = finalLayout.heroHeight.toFixed(1);

    cards.forEach((card) => {
      const avatar = card.querySelector(".z-entry-avatar");
      const star = card.querySelector(".z-avatar-star");
      if (!avatar) return;
      if (star) {
        const starSize = Math.min(avatar.clientWidth * .22, avatar.clientHeight * .52);
        star.style.setProperty("--entry-star-size", `${Math.max(0, starSize).toFixed(2)}px`);
      }
    });
  }

  function layoutGifSky() {
    if (!gifImages.length || !gifEntries) return;
    const sceneSide = Math.min(window.innerWidth, window.innerHeight);
    gifImages.forEach((image, index) => {
      image.hidden = false;
      if (body.dataset.motion !== "on") {
        image.removeAttribute("src");
        return;
      }

      const longest = Math.max(gifEntries[index].width, gifEntries[index].height) || 1;
      const base = sceneSide * (.04 + seeded(index, 3) * .03);
      const scale = base / longest;
      const width = Math.max(.1, gifEntries[index].width * scale);
      const height = Math.max(.1, gifEntries[index].height * scale);
      const xInset = Math.min(12, width / Math.max(1, window.innerWidth) * 50);
      const yInset = Math.min(12, height / Math.max(1, window.innerHeight) * 50);
      const x = Math.max(xInset, Math.min(100 - xInset, 2 + seeded(index, 1) * 96));
      const y = Math.max(yInset, Math.min(100 - yInset, 2 + seeded(index, 2) * 96));
      image.style.left = `${x}%`;
      image.style.top = `${y}%`;
      image.style.setProperty("--z-gif-width", `${width.toFixed(1)}px`);
      image.style.setProperty("--z-gif-height", `${height.toFixed(1)}px`);
      image.style.setProperty("--z-gif-opacity", (.56 + seeded(index, 4) * .3).toFixed(2));
      image.style.setProperty("--z-gif-tilt", `${((seeded(index, 5) - .5) * 24).toFixed(1)}deg`);
      if (!image.hasAttribute("src")) image.src = image.dataset.src;
    });
  }

  async function loadGifCatalog() {
    if (gifEntries) return gifEntries;
    if (catalogPromise) return catalogPromise;
    catalogPromise = fetch("/zoey/gif-manifest.json?v=20261105-06", { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) throw new Error("GIF list unavailable");
        return response.json();
      })
      .then((entries) => {
        if (!Array.isArray(entries) || !entries.length || entries.some((entry) => !entry.file || !Number.isFinite(entry.width) || !Number.isFinite(entry.height))) {
          throw new Error("Unexpected GIF list");
        }
        gifEntries = entries;
        const fragment = document.createDocumentFragment();
        entries.forEach((entry) => {
          const image = document.createElement("img");
          image.className = "z-float-gif";
          image.width = entry.width;
          image.height = entry.height;
          image.loading = "lazy";
          image.decoding = "async";
          image.dataset.src = "/zoey/assets/gifs/" + entry.file;
          fragment.append(image);
          gifImages.push(image);
        });
        gifSky.append(fragment);
        gifSky.hidden = body.dataset.motion !== "on";
        layoutGifSky();
        return entries;
      })
      .catch(() => {
        catalogPromise = null;
        return null;
      });
    return catalogPromise;
  }

  function setMotion(enabled) {
    body.dataset.motion = enabled ? "on" : "off";
    gifSky.hidden = !enabled;
    if (enabled) {
      if (gifEntries) layoutGifSky();
      else void loadGifCatalog();
    } else {
      gifImages.forEach((image) => image.removeAttribute("src"));
    }
  }

  function createCrossfadedLoopBuffer(buffer) {
    const overlap = Math.min(Math.floor(buffer.sampleRate * .65), Math.floor(buffer.length / 4));
    if (overlap < 2) return { buffer, loopStart: 0 };

    // Preserve the full opening once, then let the loop repeat from just beyond
    // the crossfade where the blended tail meets the same sample sequence.
    const loopBuffer = audioContext.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );
    const tailStart = buffer.length - overlap;
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const input = buffer.getChannelData(channel);
      const output = loopBuffer.getChannelData(channel);
      output.set(input.subarray(0, tailStart), 0);
      for (let index = 0; index < overlap; index += 1) {
        const position = (index + .5) / overlap;
        const tailGain = Math.cos(position * Math.PI / 2);
        const headGain = Math.sin(position * Math.PI / 2);
        output[tailStart + index] = input[tailStart + index] * tailGain + input[index] * headGain;
      }
    }
    return { buffer: loopBuffer, loopStart: overlap / buffer.sampleRate };
  }

  function loadBackgroundMusic() {
    if (backgroundMusicBuffer) return Promise.resolve(backgroundMusicBuffer);
    if (!backgroundMusicBufferPromise) {
      backgroundMusicBufferPromise = backgroundMusicBytes
        .then((bytes) => {
          if (!bytes || !audioContext) throw new Error("Background song is unavailable");
          return audioContext.decodeAudioData(bytes.slice(0));
        })
        .then((buffer) => {
          const loop = createCrossfadedLoopBuffer(buffer);
          backgroundMusicBuffer = loop.buffer;
          backgroundMusicLoopStart = loop.loopStart;
          return backgroundMusicBuffer;
        })
        .catch((error) => {
          backgroundMusicBufferPromise = null;
          throw error;
        });
    }
    return backgroundMusicBufferPromise;
  }

  function backgroundMusicLevel() {
    return activeMedia.size ? .5 : .86;
  }

  function updateBackgroundMusicLevel() {
    const target = backgroundMusicLevel();
    if (backgroundMusicGain && audioContext) {
      const parameter = backgroundMusicGain.gain;
      const now = audioContext.currentTime;
      parameter.cancelScheduledValues(now);
      parameter.setTargetAtTime(target, now, activeMedia.size ? .12 : .38);
    }
    if (fallbackBackgroundMusic) fallbackBackgroundMusic.volume = target;
  }

  function startFallbackBackgroundMusic() {
    if (!audioEnabled) return;
    backgroundMusicFallback = true;
    fallbackBackgroundMusic ??= new Audio(backgroundMusicUrl);
    fallbackBackgroundMusic.loop = true;
    fallbackBackgroundMusic.preload = "auto";
    fallbackBackgroundMusic.volume = backgroundMusicLevel();
    try {
      const playback = fallbackBackgroundMusic.play();
      playback?.catch?.(() => {});
    } catch {}
  }

  function ensureAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;
    try {
      if (!audioContext || audioContext.state === "closed") {
        audioContext = new AudioContextClass();
        audioMixBus = null;
        backgroundMusicGain = null;
        backgroundMusicBuffer = null;
        backgroundMusicBufferPromise = null;
        backgroundMusicSource = null;
        voiceBufferPromises.clear();
        audioContext.addEventListener?.("statechange", () => {
          if (!audioEnabled || audioContext?.state !== "running") return;
          updateBackgroundMusicLevel();
          const directVoiceActive = [...activeMedia].some((media) => media.path === "html");
          if (directVoiceActive) return;
          if (backgroundMusicSource) {
            fallbackBackgroundMusic?.pause();
            backgroundMusicFallback = false;
          } else {
            void startBackgroundMusic();
          }
        });
      }
      if (!audioMixBus) {
        // Music and every voice clip share one persistent output graph.
        audioMixBus = audioContext.createDynamicsCompressor();
        audioMixBus.threshold.value = -3;
        audioMixBus.knee.value = 0;
        audioMixBus.ratio.value = 20;
        audioMixBus.attack.value = 0.002;
        audioMixBus.release.value = 0.14;
        audioMixBus.connect(audioContext.destination);
      }
      return true;
    } catch {
      return false;
    }
  }

  function resumeAudioContext() {
    if (!audioContext) return Promise.resolve(false);
    if (audioContext.state === "running") return Promise.resolve(true);
    if (audioResumePromise) return audioResumePromise;

    // Call resume synchronously, while the tap/click's user activation is live.
    const context = audioContext;
    try {
      audioResumePromise = Promise.resolve(context.resume())
        .then(() => context.state === "running")
        .catch(() => false)
        .finally(() => {
          if (audioContext === context) audioResumePromise = null;
        });
    } catch {
      audioResumePromise = Promise.resolve(false).finally(() => {
        if (audioContext === context) audioResumePromise = null;
      });
    }
    return audioResumePromise;
  }

  function loadVoiceBuffer(url) {
    if (!audioContext) return Promise.reject(new Error("Audio is not ready"));
    if (!voiceBufferPromises.has(url)) {
      const context = audioContext;
      const bufferPromise = fetch(url, { cache: "force-cache" })
        .then((response) => {
          if (!response.ok) throw new Error("Voice message is unavailable");
          return response.arrayBuffer();
        })
        .then((bytes) => context.decodeAudioData(bytes.slice(0)))
        .catch((error) => {
          voiceBufferPromises.delete(url);
          throw error;
        });
      voiceBufferPromises.set(url, bufferPromise);
    }
    return voiceBufferPromises.get(url);
  }

  function startBackgroundMusic() {
    if (!audioEnabled || backgroundMusicSource) return Promise.resolve();
    if (!audioContext) {
      startFallbackBackgroundMusic();
      return Promise.resolve();
    }
    if (backgroundMusicStartPromise) return backgroundMusicStartPromise;

    const context = audioContext;
    const startPromise = (async () => {
      try {
        const buffer = await loadBackgroundMusic();
        if (!audioEnabled || audioContext !== context || context.state !== "running" || backgroundMusicSource) return;

        if (!backgroundMusicGain) {
          backgroundMusicGain = context.createGain();
          backgroundMusicGain.gain.value = 0;
          backgroundMusicGain.connect(audioMixBus || context.destination);
        }

        const source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.loopStart = backgroundMusicLoopStart;
        source.loopEnd = buffer.duration;
        source.connect(backgroundMusicGain);
        source.onended = () => {
          source.disconnect();
          if (backgroundMusicSource === source) {
            backgroundMusicSource = null;
            if (audioEnabled && context.state === "running") void startBackgroundMusic();
          }
        };

        const now = context.currentTime;
        source.start(now);
        backgroundMusicSource = source;
        const gain = backgroundMusicGain.gain;
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(0, now);
        gain.linearRampToValueAtTime(backgroundMusicLevel(), now + .8);
        fallbackBackgroundMusic?.pause();
        backgroundMusicFallback = false;
      } catch {
        if (audioEnabled && audioContext === context) startFallbackBackgroundMusic();
      }
    })();
    const wrappedPromise = startPromise.finally(() => {
      if (backgroundMusicStartPromise === wrappedPromise) backgroundMusicStartPromise = null;
    });
    backgroundMusicStartPromise = wrappedPromise;
    return wrappedPromise;
  }

  function enableAudio() {
    audioEnabled = true;
    body.dataset.audio = "on";
    if (!ensureAudioContext()) {
      startFallbackBackgroundMusic();
      return;
    }
    void resumeAudioContext().then((running) => {
      if (!audioEnabled) return;
      if (running) void startBackgroundMusic();
      else startFallbackBackgroundMusic();
    });
  }

  function releaseMedia(media) {
    if (!activeMedia.delete(media)) return;
    if (activeVoice === media) activeVoice = null;
    if (startingClip === media) startingClip = null;
    media.source?.disconnect();
    media.voiceGain?.disconnect();
    const remaining = (playingCounts.get(media.owner) || 1) - 1;
    if (remaining > 0) {
      playingCounts.set(media.owner, remaining);
    } else {
      playingCounts.delete(media.owner);
      media.owner?.classList.remove("is-playing");
    }
    updateBackgroundMusicLevel();
    if (!activeMedia.size && audioEnabled && audioContext?.state === "running") {
      if (backgroundMusicSource) {
        fallbackBackgroundMusic?.pause();
        backgroundMusicFallback = false;
      } else if (backgroundMusicFallback) {
        void startBackgroundMusic();
      }
    }
  }

  function confirmClipStarted(media) {
    if (media.started || !activeMedia.has(media)) return;
    media.started = true;
    if (startingClip === media) startingClip = null;
  }

  function failClipPlayback(media) {
    if (activeMedia.has(media)) {
      releaseMedia(media);
      return;
    }
    if (startingClip === media) {
      startingClip = null;
    }
  }

  function stopActiveVoice() {
    const media = activeVoice;
    if (startingClip?.loading) startingClip = null;
    if (!media) return;

    if (media.audio) {
      media.audio.pause();
      try { media.audio.currentTime = 0; } catch {}
    } else if (media.source) {
      media.source.onended = null;
      try { media.source.stop(); } catch {}
    }
    releaseMedia(media);
  }

  function startHtmlAudioClip(clip, button) {
    const audio = new Audio(clip.src);
    audio.preload = "auto";
    audio.volume = .9;
    const owner = button.closest(".z-entry");
    const media = { audio, owner, path: "html", started: false };
    activeVoice = media;
    activeMedia.add(media);
    startingClip = media;
    updateBackgroundMusicLevel();
    playingCounts.set(owner, (playingCounts.get(owner) || 0) + 1);
    owner.classList.add("is-playing");
    audio.addEventListener("playing", () => confirmClipStarted(media), { once: true });
    audio.addEventListener("ended", () => releaseMedia(media), { once: true });
    audio.addEventListener("error", () => {
      failClipPlayback(media);
    }, { once: true });
    try {
      const playback = audio.play();
      if (playback && typeof playback.then === "function") {
        playback.then(() => confirmClipStarted(media)).catch(() => {
          failClipPlayback(media);
        });
      } else if (!audio.paused) {
        confirmClipStarted(media);
      }
    } catch {
      failClipPlayback(media);
    }
  }

  async function startClipNow(entry, button) {
    if (!audioEnabled || !entry.clips.length) return;
    const clipIndex = clipIndexes.get(entry.id) || 0;
    const clip = entry.clips[clipIndex % entry.clips.length];
    clipIndexes.set(entry.id, (clipIndex + 1) % entry.clips.length);
    const owner = button.closest(".z-entry");
    if (!ensureAudioContext() || backgroundMusicFallback) {
      startHtmlAudioClip(clip, button);
      return;
    }

    const loading = { owner, loading: true };
    startingClip = loading;
    let media = null;
    try {
      // This is a tap-triggered call on iOS, so resume is requested before any await.
      const running = await resumeAudioContext();
      if (!running) {
        if (startingClip !== loading) return;
        startFallbackBackgroundMusic();
        startingClip = null;
        startHtmlAudioClip(clip, button);
        return;
      }
      const buffer = await loadVoiceBuffer(clip.src);
      if (startingClip !== loading) return;
      if (!audioEnabled || !button.isConnected) {
        startingClip = null;
        return;
      }

      const context = audioContext;
      const source = context.createBufferSource();
      const voiceGain = context.createGain();
      source.buffer = buffer;
      voiceGain.gain.value = .9;
      source.connect(voiceGain);
      voiceGain.connect(audioMixBus || context.destination);
      media = { source, voiceGain, owner, started: false };
      activeVoice = media;
      activeMedia.add(media);
      startingClip = media;
      updateBackgroundMusicLevel();
      playingCounts.set(owner, (playingCounts.get(owner) || 0) + 1);
      owner.classList.add("is-playing");
      source.onended = () => releaseMedia(media);
      source.start(context.currentTime);
      confirmClipStarted(media);
    } catch {
      if (media) {
        failClipPlayback(media);
      } else {
        failClipPlayback(loading);
      }
    }
  }

  function playNextClip(entry, button) {
    if (!audioEnabled || !entry.clips.length) return;

    stopActiveVoice();
    startClipNow(entry, button);
  }

  renderEntries();
  document.fonts?.ready?.then(() => layoutEntryStickers());
  setMotion(true);

  let resizeFrame = 0;
  function scheduleResponsiveLayout() {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      layoutGifSky();
      layoutEntryStickers();
    });
  }
  window.addEventListener("resize", scheduleResponsiveLayout, { passive: true });
  window.visualViewport?.addEventListener("resize", scheduleResponsiveLayout, { passive: true });
  if ("ResizeObserver" in window) {
    const entryLayoutObserver = new ResizeObserver(scheduleResponsiveLayout);
    entryLayoutObserver.observe(document.getElementById("entryCanvas"));
  }

  const loader = document.getElementById("fakeLoader");
  const enterButton = document.getElementById("enterGalaxy");
  let loaderClosing = false;

  function closeLoader() {
    if (loader.hidden || loaderClosing) return;
    loaderClosing = true;
    loader.classList.add("is-closing");
    window.setTimeout(() => {
      loader.hidden = true;
      loader.classList.remove("is-closing");
      body.classList.remove("z-loader-open");
      html.classList.remove("z-loader-open");
      loaderClosing = false;
    }, body.dataset.motion === "on" ? 160 : 0);
  }

  function enterGalaxy() {
    if (loader.hidden || loaderClosing) return;
    enableAudio();
    closeLoader();
  }

  loader.hidden = false;
  body.classList.add("z-loader-open");
  html.classList.add("z-loader-open");
  enterButton.addEventListener("click", enterGalaxy);

})();
