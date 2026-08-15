(() => {
  "use strict";

  const SIGNAL_PREFIX = "BBX1.";
  const CHANNEL_NAME = "berrybox.secure.data";
  const PROTOCOL_VERSION = 1;
  const TEXT_ENCODER = new TextEncoder();
  const TEXT_DECODER = new TextDecoder();

  const DEFAULT_SETTINGS = {
    game: {
      title: "berrybox",
      tagline: "Draw, caption, vote, crown the winner.",
      rounds: 3,
      maxRounds: 25,
      drawingSeconds: 150,
      votingSeconds: 45,
      autoAdvance: true,
      allowHostAsPlayer: true,
      imagePickMode: "cycle",
      defaultRole: "member"
    },
    canvas: {
      width: 1280,
      height: 720,
      backgroundFit: "contain",
      safePadding: 42
    },
    network: {
      signalingMode: "peerjs",
      peerJs: {
        scope: "berrybox",
        debug: 0,
        useSettingsIceServers: false
      },
      signalingPath: "/signal",
      roomParam: "room",
      joinTimeoutMs: 3200,
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302"
        }
      ],
      iceCandidateTimeoutMs: 7000,
      channelChunkSize: 12000
    },
    security: {
      requireSecureContext: true,
      requireAppEncryption: true,
      pbkdf2Iterations: 180000,
      roomSecretWords: 4
    },
    assets: {
      imagesManifest: "./assets/images/manifest.json",
      fontsManifest: "./assets/fonts/manifest.json",
      acceptedImageTypes: ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"],
      acceptedFontTypes: ["font/ttf", "font/otf", "font/woff", "font/woff2"]
    },
    editor: {
      defaultTool: "brush",
      defaultBrushSize: 18,
      defaultTextSize: 58,
      defaultFont: "Impact",
      palette: ["#ffffff", "#171717", "#ff3f5f", "#ffcf33", "#00c2ff", "#31d07f", "#a86cff", "#ff7a1a"],
      maxStrokes: 260,
      maxPointsPerStroke: 900,
      maxTextBoxes: 24,
      maxTextLength: 360
    },
    scoring: {
      votesPerPlayer: 1,
      allowSelfVote: false,
      points: {
        first: 700,
        second: 300,
        participation: 75,
        perVote: 100
      }
    }
  };

  const SECRET_WORDS = [
    "berry", "cinder", "orbit", "pixel", "mango", "comet", "laser", "toast",
    "plum", "cobalt", "neon", "hazel", "fizz", "ribbon", "sugar", "radar",
    "vivid", "panel", "spark", "tempo", "marble", "velvet", "signal", "sunset",
    "basil", "canyon", "pickle", "ember", "punch", "frost", "tango", "lunar"
  ];

  const dom = {};
  const imageCache = new Map();
  let settings = structuredCloneSafe(DEFAULT_SETTINGS);
  let renderCanvasQueued = false;
  let renderUiQueued = false;

  const runtime = {
    role: null,
    myId: null,
    roomId: null,
    roomSecret: "",
    encryptionKey: null,
    peers: new Map(),
    pending: new Map(),
    game: null,
    assets: {
      images: [],
      fonts: []
    },
    modeView: "",
    selectedImageId: null,
    selectedFont: "",
    logs: [],
    editor: null,
    signaling: {
      socket: null,
      createdHere: false,
      connected: false,
      assigned: false,
      reconnectTimer: null
    },
    peerJs: {
      instance: null,
      hostPeerId: "",
      mode: ""
    },
    connectionLabel: "Finding room",
    hostBroadcastTimer: null,
    localAutosaveTimer: null,
    tickTimer: null,
    lastAutoSubmitKey: "",
    lastRenderedGalleryKey: "",
    securityReady: false
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cacheDom();
    bindEvents();
    runtime.editor = createEditorState();
    runtime.game = createGameState();
    loadLocalIdentity();
    await reloadAllSettings();
    await bootConfiguredRole();
    runtime.tickTimer = window.setInterval(tick, 500);
    logActivity("Ready.");
    renderAll();
  }

  function cacheDom() {
    const ids = [
      "appShell", "gameTitle", "gameTagline", "roleChip", "secureChip", "roomChip",
      "connectionChip", "roomCodeLabel", "copyRoomBtn", "roomHint",
      "hostControlsSection",
      "reloadSettingsBtn", "playerNameInput", "hostModeBtn", "joinModeBtn", "hostBox",
      "joinBox", "roomSecretInput", "copySecretBtn", "createInviteBtn", "inviteOutput",
      "copyInviteBtn", "answerInput", "acceptAnswerBtn", "joinInviteInput", "joinSecretInput",
      "makeAnswerBtn", "joinAnswerOutput", "copyAnswerBtn", "startRoundBtn", "nextRoundBtn",
      "finishVotingBtn", "resetMatchBtn", "roundLabel", "phaseLabel", "timerLabel",
      "timerFill", "stageFrame", "artCanvas", "emptyStage", "emptyStageText", "gallery",
      "editorPanel", "canvasOptionsBar", "undoBtn", "deleteTextBtn", "clearBtn", "submitBtn", "colorInput",
      "textColorInput", "sizeInput", "textSizeInput", "textSizeDownBtn", "textSizeUpBtn", "alignLeftBtn",
      "alignCenterBtn", "alignRightBtn", "globalTextSizeInput", "fontPreviewRow", "bubbleFontPreviewRow", "textInput", "textBubble",
      "playerCountLabel", "playerList", "imageCountLabel", "imageDrop", "imageFileInput",
      "imageLibrary", "fontCountLabel", "fontDrop", "fontFileInput", "activityLog"
    ];
    ids.forEach((id) => {
      dom[id] = document.getElementById(id);
    });
    dom.ctx = dom.artCanvas.getContext("2d", { alpha: false });
    dom.toolButtons = Array.from(document.querySelectorAll("[data-tool]"));
  }

  function bindEvents() {
    bind(dom.reloadSettingsBtn, "click", reloadAllSettings);
    bind(dom.playerNameInput, "input", () => {
      localStorage.setItem("berrybox.playerName", dom.playerNameInput.value.trim());
      updateOwnPlayerName();
    });
    bind(dom.copyRoomBtn, "click", () => copyRoomLink());

    bind(dom.hostModeBtn, "click", () => beginHostMode());
    bind(dom.joinModeBtn, "click", beginJoinMode);
    bind(dom.copySecretBtn, "click", () => copyText(dom.roomSecretInput?.value || "", "Room secret copied."));
    bind(dom.createInviteBtn, "click", createInvite);
    bind(dom.copyInviteBtn, "click", () => copyText(dom.inviteOutput?.value || "", "Invite copied."));
    bind(dom.acceptAnswerBtn, "click", acceptAnswer);
    bind(dom.makeAnswerBtn, "click", makeAnswer);
    bind(dom.copyAnswerBtn, "click", () => copyText(dom.joinAnswerOutput?.value || "", "Answer copied."));

    bind(dom.startRoundBtn, "click", () => {
      if (runtime.role === "host" && runtime.game.phase === "lobby") startRound();
    });
    bind(dom.nextRoundBtn, "click", () => {
      if (runtime.role === "host" && runtime.game.phase === "results") startRound();
    });
    bind(dom.finishVotingBtn, "click", () => {
      if (runtime.role !== "host") return;
      if (runtime.game.phase === "drawing") beginVoting();
      else if (runtime.game.phase === "voting") finishVoting();
    });
    bind(dom.resetMatchBtn, "click", () => {
      if (runtime.role === "host") resetMatch();
    });

    dom.toolButtons.forEach((button) => {
      button.addEventListener("click", () => setTool(button.dataset.tool));
    });
    bind(dom.colorInput, "input", () => {
      runtime.editor.color = dom.colorInput.value;
      if (dom.textColorInput) dom.textColorInput.value = dom.colorInput.value;
      if (runtime.editor.tool === "text" || document.activeElement === dom.textInput) {
        updateSelectedTextBox({ color: runtime.editor.color });
      }
    });
    bind(dom.textColorInput, "input", () => {
      runtime.editor.color = dom.textColorInput.value;
      if (dom.colorInput) dom.colorInput.value = dom.textColorInput.value;
      updateSelectedTextBox({ color: runtime.editor.color });
    });
    bind(dom.sizeInput, "input", () => {
      runtime.editor.brushSize = Number(dom.sizeInput.value);
    });
    bind(dom.textSizeInput, "input", () => {
      runtime.editor.textSize = Number(dom.textSizeInput.value);
      if (dom.globalTextSizeInput) dom.globalTextSizeInput.value = dom.textSizeInput.value;
      setTool("text");
      updateSelectedTextBox({ size: runtime.editor.textSize });
    });
    bind(dom.globalTextSizeInput, "input", () => {
      runtime.editor.textSize = Number(dom.globalTextSizeInput.value);
      if (dom.textSizeInput) dom.textSizeInput.value = dom.globalTextSizeInput.value;
      setTool("text");
      updateSelectedTextBox({ size: runtime.editor.textSize });
    });
    bind(dom.textSizeDownBtn, "click", () => bumpSelectedTextSize(-4));
    bind(dom.textSizeUpBtn, "click", () => bumpSelectedTextSize(4));
    bind(dom.alignLeftBtn, "click", () => updateSelectedTextBox({ align: "left" }));
    bind(dom.alignCenterBtn, "click", () => updateSelectedTextBox({ align: "center" }));
    bind(dom.alignRightBtn, "click", () => updateSelectedTextBox({ align: "right" }));
    bind(dom.textInput, "focus", () => {
      if (getSelectedTextBox() && !runtime.editor.textFocusSnapshot) {
        pushHistory();
        runtime.editor.textFocusSnapshot = true;
      }
    });
    bind(dom.textInput, "blur", () => {
      runtime.editor.textFocusSnapshot = false;
    });
    bind(dom.textInput, "input", () => {
      const box = getSelectedTextBox();
      if (!box) return;
      box.text = dom.textInput.value.slice(0, numberOr(settings.editor.maxTextLength, 360));
      fitTextBoxToContent(box);
      scheduleAutosave();
      requestRenderCanvas();
      updateTextOverlay();
    });
    bind(dom.undoBtn, "click", undo);
    bind(dom.deleteTextBtn, "click", deleteSelectedText);
    bind(dom.clearBtn, "click", clearEditor);
    bind(dom.submitBtn, "click", () => {
      void submitLocalContribution(true);
    });

    bind(dom.artCanvas, "pointerdown", onCanvasPointerDown);
    bind(dom.artCanvas, "pointermove", onCanvasPointerMove);
    bind(dom.artCanvas, "pointerup", onCanvasPointerUp);
    bind(dom.artCanvas, "pointercancel", onCanvasPointerUp);
    bind(dom.artCanvas, "lostpointercapture", onCanvasPointerUp);
    bind(window, "resize", () => updateTextOverlay({ keepFocus: true }));

    if (dom.imageDrop && dom.imageFileInput) setupDropZone(dom.imageDrop, dom.imageFileInput, handleImageFiles);
    if (dom.fontDrop && dom.fontFileInput) setupDropZone(dom.fontDrop, dom.fontFileInput, handleFontFiles);

    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
      }
      if ((event.key === "Delete" || event.key === "Backspace") && document.activeElement !== dom.textInput) {
        deleteSelectedText();
      }
    });
  }

  function bind(element, eventName, handler) {
    if (element) element.addEventListener(eventName, handler);
  }

  async function reloadAllSettings() {
    const previousCanvas = { width: settings.canvas.width, height: settings.canvas.height };
    settings = await loadSettings();
    runtime.securityReady = checkSecurity();
    applySettingsToShell();
    await Promise.all([loadImageManifest(), loadFontManifest()]);
    if (!runtime.selectedImageId && runtime.assets.images[0]) runtime.selectedImageId = runtime.assets.images[0].id;
    syncRoundCountWithImages();
    if (previousCanvas.width !== settings.canvas.width || previousCanvas.height !== settings.canvas.height) {
      resizeCanvasFromSettings();
      resetEditorForRound();
    }
    logActivity("Settings loaded.");
    renderAll();
  }

  async function loadSettings() {
    try {
      const response = await fetch(`./settings.json?cache=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Settings ${response.status}`);
      const external = await response.json();
      return deepMerge(structuredCloneSafe(DEFAULT_SETTINGS), external);
    } catch (error) {
      logActivity("Using built-in settings.");
      return structuredCloneSafe(DEFAULT_SETTINGS);
    }
  }

  function applySettingsToShell() {
    if (dom.gameTitle) dom.gameTitle.textContent = settings.game.title || "berrybox";
    if (dom.gameTagline) dom.gameTagline.textContent = settings.game.tagline || "";
    document.title = settings.game.title || "berrybox";
    resizeCanvasFromSettings();
    runtime.selectedFont = runtime.selectedFont || "";
    runtime.editor.tool = settings.editor.defaultTool || "brush";
    runtime.editor.brushSize = numberOr(settings.editor.defaultBrushSize, 18);
    runtime.editor.textSize = numberOr(settings.editor.defaultTextSize, 58);
    runtime.editor.font = runtime.selectedFont || settings.editor.defaultFont || "Impact";
    runtime.editor.color = normalizeColor(settings.editor.palette?.[0], "#ffffff");
    if (dom.colorInput) dom.colorInput.value = runtime.editor.color;
    if (dom.textColorInput) dom.textColorInput.value = runtime.editor.color;
    if (dom.sizeInput) dom.sizeInput.value = String(runtime.editor.brushSize);
    if (dom.textSizeInput) dom.textSizeInput.value = String(runtime.editor.textSize);
    if (dom.globalTextSizeInput) dom.globalTextSizeInput.value = String(runtime.editor.textSize);
    setTool(runtime.editor.tool);
  }

  function resizeCanvasFromSettings() {
    const width = Math.max(320, Math.floor(numberOr(settings.canvas.width, 1280)));
    const height = Math.max(180, Math.floor(numberOr(settings.canvas.height, 720)));
    if (!dom.artCanvas) return;
    dom.artCanvas.width = width;
    dom.artCanvas.height = height;
    dom.artCanvas.style.aspectRatio = `${width} / ${height}`;
    requestRenderCanvas();
  }

  function checkSecurity() {
    const hasCrypto = Boolean(window.crypto?.subtle && window.crypto?.getRandomValues);
    const secureContextRequired = Boolean(settings.security.requireSecureContext);
    const secureContextOk = !secureContextRequired || window.isSecureContext;
    const ready = hasCrypto && secureContextOk;
    if (dom.secureChip) {
      dom.secureChip.classList.toggle("good", ready);
      dom.secureChip.classList.toggle("bad", !ready);
      dom.secureChip.textContent = ready ? "Ready" : "Secure context needed";
    }
    return ready;
  }

  function loadLocalIdentity() {
    const saved = localStorage.getItem("berrybox.playerName") || "";
    if (dom.playerNameInput) dom.playerNameInput.value = saved || `Player ${Math.floor(100 + Math.random() * 900)}`;
  }

  async function bootConfiguredRole() {
    if (runtime.role) return;
    const roomSetup = ensureRoomInUrl();
    runtime.roomId = roomSetup.roomId;
    runtime.roomSecret = roomSetup.roomSecret;
    runtime.signaling.createdHere = roomSetup.createdHere;
    updateConnectionLabel("Finding room");
    renderAll();

    const signaled = await connectSignaling(roomSetup);
    if (signaled || runtime.role) return;

    if (roomSetup.createdHere || configuredRole() === "host") {
      await beginHostMode({ roomId: roomSetup.roomId, roomSecret: roomSetup.roomSecret });
      updateConnectionLabel("Room ready");
    } else {
      await beginMemberMode({ roomId: roomSetup.roomId, roomSecret: roomSetup.roomSecret });
      updateConnectionLabel("Looking for host");
    }
  }

  function ensureRoomInUrl() {
    const param = roomParamName();
    const url = new URL(window.location.href);
    let roomId = sanitizeRoomCode(url.searchParams.get(param));
    const createdHere = !roomId;
    if (!roomId) {
      roomId = makeRoomCode();
      url.searchParams.set(param, roomId);
      window.history.replaceState({}, "", url.toString());
    }
    return {
      roomId,
      roomSecret: roomSecretFor(roomId),
      createdHere
    };
  }

  function roomParamName() {
    const configured = String(settings.network.roomParam || "room").replace(/[^a-z0-9_-]/gi, "");
    return configured || "room";
  }

  function roomSecretFor(roomId) {
    return `room:${sanitizeRoomCode(roomId)}`;
  }

  function sanitizeRoomCode(value) {
    return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
  }

  function configuredRole() {
    const params = new URLSearchParams(window.location.search);
    const queryRole = String(params.get("role") || params.get("view") || "").toLowerCase();
    const hashRole = window.location.hash.replace(/^#/, "").toLowerCase();
    if (params.has("host") || queryRole === "host" || hashRole === "host") return "host";
    if (params.has("member") || params.has("player") || ["member", "player"].includes(queryRole) || ["member", "player"].includes(hashRole)) return "member";
    return String(settings.game.defaultRole || "member").toLowerCase() === "host" ? "host" : "member";
  }

  async function beginMemberMode(options = {}) {
    if (!ensureSecureReady()) return;
    closeAllPeers();
    runtime.role = "client";
    runtime.myId = runtime.myId || `member-${uid(10)}`;
    runtime.roomId = sanitizeRoomCode(options.roomId || runtime.roomId || settings.game.roomCode || "LIVE");
    runtime.roomSecret = options.roomSecret || runtime.roomSecret || roomSecretFor(runtime.roomId);
    runtime.encryptionKey = await deriveRoomKey(runtime.roomSecret, runtime.roomId);
    runtime.game = createGameState();
    runtime.game.phase = "lobby";
    runtime.game.roomId = runtime.roomId;
    addOrUpdatePlayer({
      id: runtime.myId,
      name: getPlayerName(),
      score: 0,
      host: false,
      connected: false
    });
    logActivity("Member screen ready.");
    renderAll();
  }

  async function connectSignaling() {
    const mode = String(settings.network.signalingMode || "peerjs").toLowerCase();
    if (mode === "peerjs") return connectPeerJsSignaling();
    if (mode === "websocket") return connectWebSocketSignaling();
    return await connectPeerJsSignaling() || connectWebSocketSignaling();
  }

  function connectPeerJsSignaling() {
    if (typeof Peer === "undefined") {
      updateConnectionLabel("Room link offline");
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      let settled = false;
      const hostPeerId = roomHostPeerId(runtime.roomId);
      const finish = (value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        resolve(value);
      };
      const timeoutId = window.setTimeout(() => {
        if (!runtime.role) {
          destroyPeerJsInstance();
          updateConnectionLabel("Room link offline");
        }
        finish(Boolean(runtime.role));
      }, Math.max(1800, numberOr(settings.network.joinTimeoutMs, 3200)));

      destroyPeerJsInstance();
      runtime.peerJs.hostPeerId = hostPeerId;
      runtime.peerJs.mode = "host-check";
      updateConnectionLabel("Finding room");

      let peer;
      try {
        peer = new Peer(hostPeerId, peerJsOptions());
      } catch (error) {
        finish(false);
        return;
      }

      runtime.peerJs.instance = peer;
      peer.on("open", async (id) => {
        runtime.peerJs.mode = "host";
        runtime.myId = id;
        await beginHostMode({ roomId: runtime.roomId, roomSecret: runtime.roomSecret });
        updateConnectionLabel("Room ready");
        finish(true);
      });
      peer.on("connection", (connection) => {
        acceptPeerJsHostConnection(connection);
      });
      peer.on("disconnected", () => {
        if (runtime.role === "host") updateConnectionLabel("Room link offline");
      });
      peer.on("error", (error) => {
        if (isPeerIdTakenError(error)) {
          window.clearTimeout(timeoutId);
          peer.destroy();
          if (runtime.peerJs.instance === peer) runtime.peerJs.instance = null;
          void connectPeerJsMember(hostPeerId).then(finish);
          return;
        }
        updateConnectionLabel("Room link offline");
        finish(false);
      });
    });
  }

  function connectPeerJsMember(hostPeerId) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        resolve(value);
      };
      const timeoutId = window.setTimeout(() => finish(Boolean(runtime.role)), Math.max(1800, numberOr(settings.network.joinTimeoutMs, 3200)));

      runtime.peerJs.mode = "member";
      updateConnectionLabel("Looking for host");

      let peer;
      try {
        peer = new Peer(peerJsOptions());
      } catch (error) {
        finish(false);
        return;
      }

      runtime.peerJs.instance = peer;
      peer.on("open", async (id) => {
        runtime.myId = id;
        await beginMemberMode({ roomId: runtime.roomId, roomSecret: runtime.roomSecret });
        const connection = peer.connect(hostPeerId, {
          reliable: true,
          metadata: {
            roomId: runtime.roomId,
            name: getPlayerName()
          }
        });
        acceptPeerJsMemberConnection(connection, hostPeerId);
        updateConnectionLabel("Joining room");
        finish(true);
      });
      peer.on("error", () => {
        updateConnectionLabel("Looking for host");
        finish(Boolean(runtime.role));
      });
    });
  }

  function connectWebSocketSignaling() {
    const path = String(settings.network.signalingPath || "").trim();
    if (!path || typeof WebSocket === "undefined") return Promise.resolve(false);

    return new Promise((resolve) => {
      let settled = false;
      let socket;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        resolve(value);
      };
      const timeoutId = window.setTimeout(() => finish(false), Math.max(900, numberOr(settings.network.joinTimeoutMs, 3200)));

      try {
        socket = new WebSocket(signalingUrl(path));
      } catch (error) {
        finish(false);
        return;
      }

      runtime.signaling.socket = socket;
      socket.addEventListener("open", () => {
        runtime.signaling.connected = true;
        updateConnectionLabel("Finding room");
        sendSignal({
          type: "join",
          peerId: ensurePeerId(),
          name: getPlayerName()
        });
      });
      socket.addEventListener("message", (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch (error) {
          return;
        }
        if (message.type === "role") {
          handleSignalMessage(message)
            .then(() => finish(Boolean(runtime.role)))
            .catch(() => finish(false));
          return;
        }
        void handleSignalMessage(message);
      });
      socket.addEventListener("close", () => {
        runtime.signaling.connected = false;
        if (runtime.signaling.socket === socket) runtime.signaling.socket = null;
        if (!runtime.role) updateConnectionLabel("Room link offline");
        else if (runtime.role === "host") updateConnectionLabel("Room ready");
        else if (!hasOpenPeer()) updateConnectionLabel("Looking for host");
        finish(false);
        renderAll();
      });
      socket.addEventListener("error", () => {
        updateConnectionLabel("Room link offline");
        finish(false);
      });
    });
  }

  function signalingUrl(path) {
    const url = new URL(path, window.location.href);
    if (url.protocol === "http:") url.protocol = "ws:";
    if (url.protocol === "https:") url.protocol = "wss:";
    return url.toString();
  }

  function peerJsOptions() {
    const configured = settings.network.peerJs || {};
    const options = {
      debug: clamp(Math.floor(numberOr(configured.debug, 0)), 0, 3)
    };
    if (configured.useSettingsIceServers) {
      options.config = {
        iceServers: settings.network.iceServers || [],
        sdpSemantics: "unified-plan"
      };
    }
    ["host", "path", "key"].forEach((key) => {
      if (configured[key]) options[key] = configured[key];
    });
    if (configured.port) options.port = Number(configured.port);
    if (typeof configured.secure === "boolean") options.secure = configured.secure;
    return options;
  }

  function roomHostPeerId(roomId) {
    const configured = settings.network.peerJs || {};
    const scope = peerIdPart(configured.scope || `${window.location.host}${window.location.pathname}`) || "berrybox";
    return `bbx-${scope}-${sanitizeRoomCode(roomId).toLowerCase()}-host`.slice(0, 120);
  }

  function peerIdPart(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  }

  function isPeerIdTakenError(error) {
    const type = String(error?.type || "").toLowerCase();
    const message = String(error?.message || "").toLowerCase();
    return type === "unavailable-id" || message.includes("unavailable-id") || message.includes("is taken");
  }

  function acceptPeerJsHostConnection(connection) {
    if (runtime.role !== "host") {
      connection.close();
      return;
    }
    const roomId = sanitizeRoomCode(connection.metadata?.roomId || runtime.roomId);
    if (roomId !== runtime.roomId) {
      connection.close();
      return;
    }

    const peer = {
      id: connection.peer,
      seatId: connection.peer,
      pc: null,
      conn: connection,
      channel: null,
      connected: false,
      receiveChunks: new Map(),
      outboundName: cleanPlayerName(connection.metadata?.name || "Player")
    };
    runtime.peers.set(peer.id, peer);
    addOrUpdatePlayer({
      id: peer.id,
      name: peer.outboundName,
      score: runtime.game.scores[peer.id] || 0,
      host: false,
      connected: false
    });
    setupPeerJsDataConnection(peer, connection);
    renderAll();
  }

  function acceptPeerJsMemberConnection(connection, hostPeerId) {
    const peer = {
      id: hostPeerId,
      seatId: hostPeerId,
      pc: null,
      conn: connection,
      channel: null,
      connected: false,
      receiveChunks: new Map(),
      host: true
    };
    runtime.peers.set(peer.id, peer);
    setupPeerJsDataConnection(peer, connection);
    renderAll();
  }

  function setupPeerJsDataConnection(peer, connection) {
    const channel = {
      get readyState() {
        return connection.open ? "open" : "closed";
      },
      send(data) {
        connection.send(data);
      },
      close() {
        connection.close();
      }
    };
    peer.conn = connection;
    peer.channel = channel;

    const onOpen = () => {
      peer.connected = true;
      if (runtime.role === "client") {
        sendToPeer(peer, {
          type: "HELLO",
          playerId: runtime.myId,
          name: getPlayerName()
        });
        updateConnectionLabel("Joined room");
      } else if (runtime.role === "host") {
        updateConnectionLabel("Room ready");
      }
      logActivity(runtime.role === "host" ? "Peer connected." : "Connected to host.");
      renderAll();
    };

    connection.on("open", onOpen);
    connection.on("data", (data) => receivePackedMessage(peer, data));
    connection.on("close", () => {
      peer.connected = false;
      if (runtime.role === "host") setPlayerConnected(peer.id, false);
      if (runtime.role === "client" && !hasOpenPeer()) updateConnectionLabel("Looking for host");
      logActivity("Peer disconnected.");
      renderAll();
    });
    connection.on("error", () => {
      peer.connected = false;
      if (runtime.role === "client" && !hasOpenPeer()) updateConnectionLabel("Looking for host");
      logActivity("Peer channel error.");
      renderAll();
    });
    if (connection.open) window.setTimeout(onOpen, 0);
  }

  async function handleSignalMessage(message) {
    if (!message || typeof message.type !== "string") return;
    const messageRoom = sanitizeRoomCode(message.roomId || runtime.roomId);
    if (messageRoom && runtime.roomId && messageRoom !== runtime.roomId) return;

    if (message.type === "role") {
      runtime.signaling.assigned = true;
      runtime.roomId = messageRoom || runtime.roomId;
      runtime.roomSecret = roomSecretFor(runtime.roomId);
      if (message.role === "host") {
        await beginHostMode({ roomId: runtime.roomId, roomSecret: runtime.roomSecret });
        updateConnectionLabel("Room ready");
      } else {
        await beginMemberMode({ roomId: runtime.roomId, roomSecret: runtime.roomSecret });
        updateConnectionLabel("Looking for host");
      }
      return;
    }

    if (message.type === "member-joined" && runtime.role === "host") {
      await createSignaledOffer(message.peerId, message.name);
      return;
    }

    if (message.type === "offer" && runtime.role === "client") {
      await acceptSignaledOffer(message);
      return;
    }

    if (message.type === "answer" && runtime.role === "host") {
      await acceptSignaledAnswer(message);
      return;
    }

    if (message.type === "peer-left" && runtime.role === "host") {
      markPeerGone(message.peerId);
      return;
    }

    if (message.type === "host-left" && runtime.role === "client") {
      updateConnectionLabel("Looking for host");
      logActivity("Host left the room.");
      closeAllPeers();
      renderAll();
    }
  }

  function sendSignal(message) {
    const socket = runtime.signaling.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({
      ...message,
      roomId: runtime.roomId,
      from: runtime.myId
    }));
    return true;
  }

  async function createSignaledOffer(peerId, playerName) {
    if (runtime.role !== "host" || !ensureSecureReady()) return;
    const targetId = String(peerId || "").trim();
    if (!targetId || targetId === runtime.myId) return;

    const oldPeer = runtime.pending.get(targetId) || runtime.peers.get(targetId);
    if (oldPeer) oldPeer.pc?.close();
    runtime.pending.delete(targetId);
    runtime.peers.delete(targetId);

    const pc = createPeerConnection();
    const peer = {
      id: targetId,
      seatId: targetId,
      pc,
      channel: null,
      connected: false,
      receiveChunks: new Map(),
      outboundName: cleanPlayerName(playerName || "Player")
    };
    const channel = pc.createDataChannel(CHANNEL_NAME, { ordered: true });
    setupDataChannel(peer, channel);
    runtime.pending.set(targetId, peer);
    addOrUpdatePlayer({
      id: targetId,
      name: peer.outboundName,
      score: runtime.game.scores[targetId] || 0,
      host: false,
      connected: false
    });

    try {
      await pc.setLocalDescription(await pc.createOffer());
      await waitForIceComplete(pc);
      sendSignal({
        type: "offer",
        to: targetId,
        hostId: runtime.myId,
        seatId: targetId,
        title: settings.game.title,
        sdp: pc.localDescription
      });
      logActivity(`Invite sent to ${peer.outboundName}.`);
    } catch (error) {
      runtime.pending.delete(targetId);
      peer.pc.close();
      setPlayerConnected(targetId, false);
      logActivity("Invite failed.");
    }
    renderAll();
  }

  async function acceptSignaledOffer(message) {
    if (!ensureSecureReady()) return;
    const hostId = String(message.from || message.hostId || "host").trim();
    if (!hostId || !message.sdp) return;

    closeAllPeers();
    runtime.role = "client";
    runtime.game.phase = "connecting";
    const pc = createPeerConnection();
    const peer = {
      id: hostId,
      seatId: message.seatId || hostId,
      pc,
      channel: null,
      connected: false,
      receiveChunks: new Map(),
      host: true
    };
    pc.addEventListener("datachannel", (event) => setupDataChannel(peer, event.channel));
    runtime.peers.set(peer.id, peer);

    try {
      await pc.setRemoteDescription(message.sdp);
      await pc.setLocalDescription(await pc.createAnswer());
      await waitForIceComplete(pc);
      sendSignal({
        type: "answer",
        to: hostId,
        hostId,
        seatId: message.seatId || runtime.myId,
        playerId: runtime.myId,
        playerName: getPlayerName(),
        sdp: pc.localDescription
      });
      updateConnectionLabel("Joining room");
      logActivity("Answer sent.");
      renderAll();
    } catch (error) {
      updateConnectionLabel("Could not join");
      showToast("Could not join the room.");
      logActivity("Connection setup failed.");
    }
  }

  async function acceptSignaledAnswer(message) {
    const peerId = String(message.from || message.playerId || message.seatId || "").trim();
    const peer = runtime.pending.get(peerId) || runtime.pending.get(message.seatId);
    if (runtime.role !== "host" || !peer || !message.sdp) return;
    try {
      await peer.pc.setRemoteDescription(message.sdp);
      peer.id = peerId || peer.id;
      peer.outboundName = cleanPlayerName(message.playerName || peer.outboundName || "Player");
      runtime.pending.delete(peer.seatId);
      runtime.pending.delete(peer.id);
      runtime.peers.set(peer.id, peer);
      logActivity(`${peer.outboundName} joined.`);
      renderAll();
    } catch (error) {
      peer.pc?.close();
      runtime.pending.delete(peer.seatId);
      runtime.pending.delete(peer.id);
      logActivity("Could not accept player.");
    }
  }

  function markPeerGone(peerId) {
    const id = String(peerId || "");
    if (!id) return;
    const peer = runtime.peers.get(id) || runtime.pending.get(id);
    peer?.pc?.close();
    runtime.peers.delete(id);
    runtime.pending.delete(id);
    setPlayerConnected(id, false);
    renderAll();
  }

  function hasOpenPeer() {
    return Array.from(runtime.peers.values()).some((peer) => peer.connected);
  }

  function ensurePeerId(prefix = "peer") {
    if (!runtime.myId) runtime.myId = `${prefix}-${uid(10)}`;
    return runtime.myId;
  }

  function updateConnectionLabel(label) {
    runtime.connectionLabel = label || "";
    if (dom.connectionChip) dom.connectionChip.textContent = runtime.connectionLabel || "Room";
  }

  function roomInviteUrl() {
    const url = new URL(window.location.href);
    const param = roomParamName();
    url.searchParams.delete("role");
    url.searchParams.delete("view");
    url.searchParams.delete("host");
    url.searchParams.delete("member");
    url.searchParams.delete("player");
    url.searchParams.set(param, runtime.roomId || makeRoomCode());
    url.hash = "";
    return url.toString();
  }

  function copyRoomLink() {
    if (!runtime.roomId) return;
    copyText(roomInviteUrl(), "Invite link copied.");
  }

  async function loadImageManifest() {
    const manifestUrl = settings.assets.imagesManifest || "./assets/images/manifest.json";
    let entries = [];
    try {
      const response = await fetch(`${manifestUrl}?cache=${Date.now()}`, { cache: "no-store" });
      if (response.ok) {
        const manifest = await response.json();
        entries = Array.isArray(manifest) ? manifest : (manifest.images || manifest.files || []);
      }
    } catch (error) {
      entries = [];
    }

    const manifestImages = entries.map((entry, index) => normalizeImageEntry(entry, index, manifestUrl));
    const fallback = manifestImages.length ? [] : [createFallbackImage()];
    runtime.assets.images = [...manifestImages, ...fallback];
  }

  async function loadFontManifest() {
    const manifestUrl = settings.assets.fontsManifest || "./assets/fonts/manifest.json";
    let entries = [];
    try {
      const response = await fetch(`${manifestUrl}?cache=${Date.now()}`, { cache: "no-store" });
      if (response.ok) {
        const manifest = await response.json();
        entries = Array.isArray(manifest) ? manifest : (manifest.fonts || manifest.files || []);
      }
    } catch (error) {
      entries = [];
    }

    const manifestFonts = entries.map((entry, index) => normalizeFontEntry(entry, index, manifestUrl));
    runtime.assets.fonts = dedupeFonts(manifestFonts);
    await Promise.allSettled(runtime.assets.fonts.filter((font) => font.src && !font.loaded).map(loadFontFace));
    if (!runtime.assets.fonts.some((font) => font.name === runtime.selectedFont)) {
      runtime.selectedFont = runtime.assets.fonts[0]?.name || "";
      runtime.editor.font = runtime.selectedFont || settings.editor.defaultFont || "Impact";
    }
  }

  function normalizeImageEntry(entry, index, manifestUrl) {
    const item = typeof entry === "string" ? { file: entry } : { ...entry };
    const file = item.file || item.src || item.path || "";
    const title = item.title || item.name || baseName(file) || `Image ${index + 1}`;
    const src = item.dataUrl || (file ? new URL(file, new URL(manifestUrl, window.location.href)).href : "");
    return {
      id: item.id || `manifest-image-${slugify(title)}-${index}`,
      title,
      src,
      dataUrl: item.dataUrl || "",
      manifest: true
    };
  }

  function normalizeFontEntry(entry, index, manifestUrl) {
    const item = typeof entry === "string" ? { file: entry } : { ...entry };
    const file = item.file || item.src || item.path || "";
    const name = item.name || item.title || baseName(file) || `Font ${index + 1}`;
    return {
      id: item.id || `manifest-font-${slugify(name)}-${index}`,
      name,
      src: file ? new URL(file, new URL(manifestUrl, window.location.href)).href : "",
      manifest: true,
      loaded: false
    };
  }

  function createFallbackImage() {
    return {
      id: "fallback-signal-board",
      title: "Signal Board",
      src: "",
      fallback: true
    };
  }

  async function loadFontFace(font) {
    try {
      const face = new FontFace(font.name, `url("${font.src}")`);
      await face.load();
      document.fonts.add(face);
      font.loaded = true;
    } catch (error) {
      font.loaded = false;
      logActivity(`Font skipped: ${font.name}`);
    }
  }

  function setupDropZone(zone, input, handler) {
    input.addEventListener("change", () => {
      handler(Array.from(input.files || []));
      input.value = "";
    });
    zone.addEventListener("dragenter", (event) => {
      event.preventDefault();
      zone.classList.add("dragover");
    });
    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      zone.classList.add("dragover");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      zone.classList.remove("dragover");
      const files = Array.from(event.dataTransfer?.files || []);
      handler(files);
    });
  }

  function preventFileNavigation(event) {
    const items = Array.from(event.dataTransfer?.items || []);
    if (items.some((item) => item.kind === "file")) {
      event.preventDefault();
    }
  }

  async function handleImageFiles(files) {
    const allowedTypes = settings.assets.acceptedImageTypes || [];
    const accepted = files.filter((file) => file.type.startsWith("image/") || allowedTypes.includes(file.type));
    for (const file of accepted) {
      const dataUrl = await fileToDataUrl(file);
      const title = baseName(file.name);
      const image = {
        id: `local-image-${slugify(title)}-${uid(5)}`,
        title,
        src: dataUrl,
        dataUrl,
        local: true
      };
      runtime.assets.images.push(image);
      runtime.selectedImageId = image.id;
      logActivity(`Image added: ${title}`);
    }
    renderAll();
  }

  async function handleFontFiles(files) {
    const accepted = files.filter(isSupportedFontFile);
    for (const file of accepted) {
      const name = baseName(file.name);
      try {
        const buffer = await file.arrayBuffer();
        const face = new FontFace(name, buffer);
        await face.load();
        document.fonts.add(face);
        runtime.assets.fonts.push({
          id: `local-font-${slugify(name)}-${uid(5)}`,
          name,
          local: true,
          loaded: true
        });
        runtime.selectedFont = name;
        runtime.editor.font = name;
        logActivity(`Font added: ${name}`);
      } catch (error) {
        logActivity(`Font skipped: ${name}`);
      }
    }
    runtime.assets.fonts = dedupeFonts(runtime.assets.fonts);
    renderAll();
  }

  function isSupportedFontFile(file) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    return ["ttf", "otf", "woff", "woff2"].includes(ext || "") || (settings.assets.acceptedFontTypes || []).includes(file.type);
  }

  function beginJoinMode() {
    runtime.modeView = "join";
    dom.joinBox?.classList.remove("hidden");
    dom.hostBox?.classList.add("hidden");
    if (!runtime.role) {
      runtime.game.phase = "joining";
      renderAll();
    }
  }

  async function beginHostMode(options = {}) {
    runtime.modeView = "host";
    dom.hostBox?.classList.remove("hidden");
    dom.joinBox?.classList.add("hidden");
    if (runtime.role === "host") return;
    if (!ensureSecureReady()) return;
    closeAllPeers();
    runtime.role = "host";
    runtime.myId = runtime.myId || `host-${uid(10)}`;
    runtime.roomId = sanitizeRoomCode(options.roomId || runtime.roomId) || makeRoomCode();
    runtime.roomSecret = options.roomSecret || runtime.roomSecret || roomSecretFor(runtime.roomId);
    runtime.encryptionKey = await deriveRoomKey(runtime.roomSecret, runtime.roomId);
    runtime.pending.clear();
    runtime.peers.clear();
    runtime.game = createGameState();
    runtime.game.roomId = runtime.roomId;
    addOrUpdatePlayer({
      id: runtime.myId,
      name: getPlayerName(),
      score: 0,
      host: true,
      connected: true
    });
    if (dom.roomSecretInput) dom.roomSecretInput.value = runtime.roomSecret;
    if (dom.inviteOutput) dom.inviteOutput.value = "";
    if (dom.answerInput) dom.answerInput.value = "";
    logActivity("Host screen ready.");
    renderAll();
  }

  async function createInvite() {
    if (runtime.role !== "host") {
      await beginHostMode();
      if (runtime.role !== "host") return;
    }
    if (!ensureSecureReady()) return;

    const seatId = `seat-${uid(10)}`;
    const pc = createPeerConnection();
    const peer = {
      id: seatId,
      seatId,
      pc,
      channel: null,
      connected: false,
      receiveChunks: new Map(),
      outboundName: "Guest"
    };
    const channel = pc.createDataChannel(CHANNEL_NAME, { ordered: true });
    setupDataChannel(peer, channel);
    runtime.pending.set(seatId, peer);

    try {
      await pc.setLocalDescription(await pc.createOffer());
      await waitForIceComplete(pc);
      const packet = {
        v: PROTOCOL_VERSION,
        kind: "offer",
        app: "berrybox",
        roomId: runtime.roomId,
        hostId: runtime.myId,
        seatId,
        title: settings.game.title,
        createdAt: Date.now(),
        sdp: pc.localDescription
      };
      if (dom.inviteOutput) dom.inviteOutput.value = encodeSignal(packet);
      logActivity("Invite created.");
    } catch (error) {
      runtime.pending.delete(seatId);
      peer.pc.close();
      showToast("Invite failed.");
    }
  }

  async function makeAnswer() {
    if (!ensureSecureReady()) return;
    const inviteText = dom.joinInviteInput?.value.trim() || "";
    const secret = dom.joinSecretInput?.value.trim() || "";
    if (!inviteText || !secret) {
      showToast("Invite and room secret are required.");
      return;
    }

    let offer;
    try {
      offer = decodeSignal(inviteText);
      if (offer.kind !== "offer" || !offer.sdp || !offer.roomId || !offer.seatId) {
        throw new Error("Bad offer");
      }
    } catch (error) {
      showToast("Invite code is not valid.");
      return;
    }

    closeAllPeers();
    runtime.role = "client";
    runtime.myId = `player-${uid(10)}`;
    runtime.roomId = offer.roomId;
    runtime.roomSecret = secret;
    runtime.encryptionKey = await deriveRoomKey(runtime.roomSecret, runtime.roomId);
    runtime.game = createGameState();
    runtime.game.phase = "connecting";
    runtime.game.roomId = runtime.roomId;
    runtime.pending.clear();
    runtime.peers.clear();

    const pc = createPeerConnection();
    const peer = {
      id: offer.hostId,
      seatId: offer.seatId,
      pc,
      channel: null,
      connected: false,
      receiveChunks: new Map(),
      host: true
    };
    pc.addEventListener("datachannel", (event) => setupDataChannel(peer, event.channel));
    runtime.peers.set(peer.id, peer);

    try {
      await pc.setRemoteDescription(offer.sdp);
      await pc.setLocalDescription(await pc.createAnswer());
      await waitForIceComplete(pc);
      const answer = {
        v: PROTOCOL_VERSION,
        kind: "answer",
        app: "berrybox",
        roomId: runtime.roomId,
        hostId: offer.hostId,
        seatId: offer.seatId,
        playerId: runtime.myId,
        playerName: getPlayerName(),
        createdAt: Date.now(),
        sdp: pc.localDescription
      };
      if (dom.joinAnswerOutput) dom.joinAnswerOutput.value = encodeSignal(answer);
      logActivity("Answer created.");
      renderAll();
    } catch (error) {
      showToast("Answer failed.");
      logActivity("Connection setup failed.");
    }
  }

  async function acceptAnswer() {
    if (runtime.role !== "host") return;
    const answerText = dom.answerInput?.value.trim() || "";
    if (!answerText) {
      showToast("Paste an answer code first.");
      return;
    }
    let answer;
    try {
      answer = decodeSignal(answerText);
      if (answer.kind !== "answer" || answer.roomId !== runtime.roomId || !answer.seatId || !answer.sdp) {
        throw new Error("Bad answer");
      }
    } catch (error) {
      showToast("Answer code is not valid for this room.");
      return;
    }
    const peer = runtime.pending.get(answer.seatId);
    if (!peer) {
      showToast("No pending invite matches that answer.");
      return;
    }
    try {
      await peer.pc.setRemoteDescription(answer.sdp);
      peer.id = answer.playerId || answer.seatId;
      peer.outboundName = answer.playerName || "Player";
      runtime.pending.delete(answer.seatId);
      runtime.peers.set(peer.id, peer);
      if (dom.answerInput) dom.answerInput.value = "";
      logActivity(`Answer accepted for ${peer.outboundName}.`);
      renderAll();
    } catch (error) {
      showToast("Could not accept answer.");
    }
  }

  function createPeerConnection() {
    const pc = new RTCPeerConnection({
      iceServers: settings.network.iceServers || [],
      iceCandidatePoolSize: 2
    });
    pc.addEventListener("connectionstatechange", () => {
      renderAll();
    });
    return pc;
  }

  function setupDataChannel(peer, channel) {
    peer.channel = channel;
    channel.addEventListener("open", () => {
      peer.connected = true;
      if (runtime.role === "client") {
        sendToPeer(peer, {
          type: "HELLO",
          playerId: runtime.myId,
          name: getPlayerName()
        });
        updateConnectionLabel("Joined room");
      } else if (runtime.role === "host") {
        updateConnectionLabel("Room ready");
      }
      logActivity(runtime.role === "host" ? "Peer connected." : "Connected to host.");
      renderAll();
    });
    channel.addEventListener("message", (event) => receivePackedMessage(peer, event.data));
    channel.addEventListener("close", () => {
      peer.connected = false;
      if (runtime.role === "host") setPlayerConnected(peer.id, false);
      if (runtime.role === "client" && !hasOpenPeer()) updateConnectionLabel("Looking for host");
      logActivity("Peer disconnected.");
      renderAll();
    });
    channel.addEventListener("error", () => {
      peer.connected = false;
      logActivity("Peer channel error.");
      renderAll();
    });
  }

  async function sendToPeer(peer, payload) {
    if (!peer?.channel || peer.channel.readyState !== "open") return false;
    try {
      const packed = await packMessage(payload);
      sendPacked(peer.channel, packed);
      return true;
    } catch (error) {
      logActivity("Secure send failed.");
      return false;
    }
  }

  async function broadcast(payload, options = {}) {
    const sends = [];
    for (const peer of runtime.peers.values()) {
      if (peer.channel?.readyState === "open") sends.push(sendToPeer(peer, payload));
    }
    if (options.includeSelf && runtime.role === "host") {
      handleHostMessage({ id: runtime.myId }, payload);
    }
    await Promise.allSettled(sends);
  }

  async function packMessage(payload) {
    const secureRequired = Boolean(settings.security.requireAppEncryption);
    if (!secureRequired) {
      return JSON.stringify({ secure: false, payload });
    }
    if (!runtime.encryptionKey) throw new Error("No room key");
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = TEXT_ENCODER.encode(JSON.stringify(payload));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, runtime.encryptionKey, encoded);
    return JSON.stringify({
      secure: true,
      iv: bytesToBase64Url(iv),
      body: bytesToBase64Url(new Uint8Array(ciphertext))
    });
  }

  async function unpackMessage(packed) {
    const envelope = JSON.parse(packed);
    if (!envelope.secure) {
      if (settings.security.requireAppEncryption) throw new Error("Plain payload blocked");
      return envelope.payload;
    }
    if (!runtime.encryptionKey) throw new Error("No room key");
    const iv = base64UrlToBytes(envelope.iv);
    const body = base64UrlToBytes(envelope.body);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, runtime.encryptionKey, body);
    return JSON.parse(TEXT_DECODER.decode(plain));
  }

  function sendPacked(channel, packed) {
    const size = Math.max(2000, numberOr(settings.network.channelChunkSize, 12000));
    if (packed.length <= size) {
      channel.send(packed);
      return;
    }
    const id = uid(8);
    const total = Math.ceil(packed.length / size);
    for (let index = 0; index < total; index += 1) {
      channel.send(JSON.stringify({
        chunk: true,
        id,
        index,
        total,
        data: packed.slice(index * size, (index + 1) * size)
      }));
    }
  }

  async function receivePackedMessage(peer, raw) {
    try {
      let text = typeof raw === "string" ? raw : TEXT_DECODER.decode(raw);
      const maybeChunk = JSON.parse(text);
      if (maybeChunk.chunk) {
        const current = peer.receiveChunks.get(maybeChunk.id) || {
          total: maybeChunk.total,
          parts: new Array(maybeChunk.total),
          received: 0
        };
        if (!current.parts[maybeChunk.index]) current.received += 1;
        current.parts[maybeChunk.index] = maybeChunk.data;
        peer.receiveChunks.set(maybeChunk.id, current);
        if (current.received < current.total) return;
        text = current.parts.join("");
        peer.receiveChunks.delete(maybeChunk.id);
      }
      const payload = await unpackMessage(text);
      if (runtime.role === "host") {
        handleHostMessage(peer, payload);
      } else {
        handleClientMessage(peer, payload);
      }
    } catch (error) {
      logActivity("Encrypted message could not be read.");
    }
  }

  function handleHostMessage(peer, message) {
    if (!message || typeof message.type !== "string") return;
    if (message.type === "HELLO") {
      peer.id = message.playerId || peer.id;
      addOrUpdatePlayer({
        id: peer.id,
        name: cleanPlayerName(message.name || peer.outboundName || "Player"),
        score: runtime.game.scores[peer.id] || 0,
        host: false,
        connected: true
      });
      sendToPeer(peer, {
        type: "WELCOME",
        playerId: peer.id,
        state: publicGameState()
      });
      scheduleBroadcastState();
      return;
    }
    if (message.type === "CONTRIBUTION") {
      const contribution = sanitizeContribution(message.contribution, peer.id);
      if (!contribution) return;
      runtime.game.contributions[peer.id] = contribution;
      if (contribution.submitted) logActivity(`${getPlayerNameById(peer.id)} submitted.`);
      scheduleBroadcastState();
      renderAll();
      return;
    }
    if (message.type === "VOTE") {
      recordVote(peer.id, message.targetIds || []);
      scheduleBroadcastState();
      renderAll();
      return;
    }
    if (message.type === "REQUEST_STATE") {
      sendToPeer(peer, { type: "STATE", state: publicGameState() });
    }
  }

  function handleClientMessage(peer, message) {
    if (!message || typeof message.type !== "string") return;
    if (message.type === "WELCOME") {
      runtime.myId = message.playerId || runtime.myId;
      applyRemoteState(message.state);
      logActivity("Joined room.");
      return;
    }
    if (message.type === "STATE") {
      applyRemoteState(message.state);
    }
  }

  function applyRemoteState(state) {
    if (!state) return;
    const previousPhase = runtime.game.phase;
    const previousRound = runtime.game.roundIndex;
    runtime.game = state;
    if (state.phase === "drawing" && (previousPhase !== "drawing" || previousRound !== state.roundIndex)) {
      resetEditorForRound();
      runtime.lastAutoSubmitKey = "";
    }
    if (state.phase !== "drawing") {
      runtime.editor.activeStroke = null;
      runtime.editor.dragMode = null;
      hideTextOverlay();
    }
    renderAll();
  }

  function scheduleBroadcastState() {
    if (runtime.role !== "host") return;
    clearTimeout(runtime.hostBroadcastTimer);
    runtime.hostBroadcastTimer = window.setTimeout(() => {
      broadcast({ type: "STATE", state: publicGameState() });
    }, 220);
  }

  function publicGameState() {
    return structuredCloneSafe(runtime.game);
  }

  function waitForIceComplete(pc) {
    const timeout = numberOr(settings.network.iceCandidateTimeoutMs, 7000);
    if (pc.iceGatheringState === "complete") return Promise.resolve();
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        pc.removeEventListener("icegatheringstatechange", onState);
        resolve();
      };
      const onState = () => {
        if (pc.iceGatheringState === "complete") finish();
      };
      pc.addEventListener("icegatheringstatechange", onState);
      window.setTimeout(finish, timeout);
    });
  }

  function createGameState() {
    return {
      phase: "lobby",
      roomId: runtime.roomId || "",
      roundIndex: 0,
      totalRounds: roundCountForLoadedImages(),
      currentImage: null,
      phaseStartedAt: 0,
      phaseEndsAt: 0,
      players: [],
      scores: {},
      contributions: {},
      votes: {},
      results: null,
      imageCursor: 0,
      settingsSnapshot: {
        drawingSeconds: numberOr(settings.game.drawingSeconds, 150),
        votingSeconds: numberOr(settings.game.votingSeconds, 45),
        votesPerPlayer: numberOr(settings.scoring.votesPerPlayer, 1)
      }
    };
  }

  function roundCountForLoadedImages() {
    const maxRounds = clamp(Math.floor(numberOr(settings.game.maxRounds, 25)), 1, 25);
    const imageCount = runtime.assets.images.length || Math.floor(numberOr(settings.game.rounds, 1));
    return clamp(imageCount || 1, 1, maxRounds);
  }

  function syncRoundCountWithImages() {
    if (!runtime.game) return;
    runtime.game.totalRounds = roundCountForLoadedImages();
    runtime.game.roundIndex = Math.min(runtime.game.roundIndex, runtime.game.totalRounds);
  }

  function resetMatch() {
    const oldPlayers = runtime.game.players.map((player) => ({
      ...player,
      score: 0,
      connected: player.id === runtime.myId ? true : player.connected
    }));
    runtime.game = createGameState();
    runtime.game.players = oldPlayers;
    runtime.game.players.forEach((player) => {
      runtime.game.scores[player.id] = 0;
    });
    resetEditorForRound();
    broadcast({ type: "STATE", state: publicGameState() });
    logActivity("Match reset.");
    renderAll();
  }

  function startRound() {
    if (runtime.role !== "host") return;
    syncRoundCountWithImages();
    if (runtime.game.roundIndex >= runtime.game.totalRounds) {
      runtime.game.phase = "final";
      runtime.game.phaseStartedAt = Date.now();
      runtime.game.phaseEndsAt = 0;
      broadcast({ type: "STATE", state: publicGameState() });
      renderAll();
      return;
    }
    const picked = pickRoundImage();
    runtime.game.roundIndex += 1;
    runtime.game.phase = "drawing";
    runtime.game.phaseStartedAt = Date.now();
    runtime.game.phaseEndsAt = runtime.game.phaseStartedAt + numberOr(settings.game.drawingSeconds, 150) * 1000;
    runtime.game.currentImage = serializeImageForRound(picked);
    runtime.game.contributions = {};
    runtime.game.votes = {};
    runtime.game.results = null;
    resetEditorForRound();
    logActivity(`Round ${runtime.game.roundIndex} started.`);
    broadcast({ type: "STATE", state: publicGameState() });
    renderAll();
  }

  function beginVoting() {
    if (runtime.role !== "host" || runtime.game.phase !== "drawing") return;
    submitLocalContribution(true);
    runtime.game.phase = "voting";
    runtime.game.phaseStartedAt = Date.now();
    runtime.game.phaseEndsAt = runtime.game.phaseStartedAt + numberOr(settings.game.votingSeconds, 45) * 1000;
    runtime.game.results = null;
    logActivity("Voting opened.");
    broadcast({ type: "STATE", state: publicGameState() });
    renderAll();
  }

  function finishVoting() {
    if (runtime.role !== "host" || runtime.game.phase !== "voting") return;
    const results = scoreCurrentRound();
    runtime.game.results = results;
    runtime.game.phase = runtime.game.roundIndex >= runtime.game.totalRounds ? "final" : "results";
    runtime.game.phaseStartedAt = Date.now();
    runtime.game.phaseEndsAt = 0;
    logActivity(runtime.game.phase === "final" ? "Final scores ready." : "Round results ready.");
    broadcast({ type: "STATE", state: publicGameState() });
    renderAll();
  }

  function scoreCurrentRound() {
    const voteCounts = {};
    Object.values(runtime.game.contributions).forEach((contribution) => {
      voteCounts[contribution.playerId] = 0;
    });
    Object.values(runtime.game.votes).forEach((targets) => {
      targets.forEach((targetId) => {
        if (Object.prototype.hasOwnProperty.call(voteCounts, targetId)) {
          voteCounts[targetId] += 1;
        }
      });
    });

    const pointSettings = settings.scoring.points || {};
    const perVote = numberOr(pointSettings.perVote, 100);
    const first = numberOr(pointSettings.first, 700);
    const second = numberOr(pointSettings.second, 300);
    const participation = numberOr(pointSettings.participation, 75);
    const ordered = Object.entries(voteCounts).sort((a, b) => b[1] - a[1]);
    const topVotes = ordered[0]?.[1] || 0;
    const secondVotes = ordered.find((entry) => entry[1] < topVotes)?.[1] || 0;
    const awards = {};

    ordered.forEach(([playerId, votes]) => {
      let points = participation + votes * perVote;
      if (votes > 0 && votes === topVotes) points += first;
      else if (votes > 0 && votes === secondVotes) points += second;
      awards[playerId] = points;
      runtime.game.scores[playerId] = (runtime.game.scores[playerId] || 0) + points;
    });
    runtime.game.players = runtime.game.players.map((player) => ({
      ...player,
      score: runtime.game.scores[player.id] || 0
    }));
    return {
      round: runtime.game.roundIndex,
      voteCounts,
      awards,
      winners: ordered.filter((entry) => entry[1] === topVotes && topVotes > 0).map((entry) => entry[0]),
      scoredAt: Date.now()
    };
  }

  function tick() {
    updateTimerUI();
    if (runtime.game.phase === "drawing") {
      const key = `${runtime.game.roundIndex}:${runtime.game.phase}`;
      if (runtime.game.phaseEndsAt && Date.now() >= runtime.game.phaseEndsAt && runtime.lastAutoSubmitKey !== key) {
        runtime.lastAutoSubmitKey = key;
        submitLocalContribution(true);
      }
    }
    if (runtime.role === "host" && settings.game.autoAdvance && runtime.game.phaseEndsAt && Date.now() >= runtime.game.phaseEndsAt) {
      if (runtime.game.phase === "drawing") beginVoting();
      else if (runtime.game.phase === "voting") finishVoting();
    }
  }

  function pickRoundImage() {
    const images = runtime.assets.images.length ? runtime.assets.images : [createFallbackImage()];
    if (settings.game.imagePickMode === "random") {
      return images[Math.floor(Math.random() * images.length)];
    }
    const picked = images[runtime.game.imageCursor % images.length];
    runtime.game.imageCursor += 1;
    return picked;
  }

  function serializeImageForRound(image) {
    return {
      id: image.id,
      title: image.title,
      src: image.dataUrl || image.src || "",
      fallback: Boolean(image.fallback)
    };
  }

  function addOrUpdatePlayer(player) {
    const clean = {
      id: player.id,
      name: cleanPlayerName(player.name),
      score: numberOr(player.score, 0),
      host: Boolean(player.host),
      connected: player.connected !== false
    };
    const index = runtime.game.players.findIndex((item) => item.id === clean.id);
    if (index >= 0) runtime.game.players[index] = { ...runtime.game.players[index], ...clean };
    else runtime.game.players.push(clean);
    runtime.game.scores[clean.id] = numberOr(runtime.game.scores[clean.id], clean.score);
  }

  function setPlayerConnected(playerId, connected) {
    runtime.game.players = runtime.game.players.map((player) => (
      player.id === playerId ? { ...player, connected } : player
    ));
  }

  function updateOwnPlayerName() {
    if (!runtime.role || !runtime.myId) return;
    if (runtime.role === "host") {
      addOrUpdatePlayer({
        id: runtime.myId,
        name: getPlayerName(),
        host: true,
        connected: true,
        score: runtime.game.scores[runtime.myId] || 0
      });
      broadcast({ type: "STATE", state: publicGameState() });
      renderAll();
    } else {
      const host = getHostPeer();
      if (host?.channel?.readyState === "open") {
        sendToPeer(host, { type: "HELLO", playerId: runtime.myId, name: getPlayerName() });
      }
    }
  }

  function recordVote(voterId, targetIds) {
    if (runtime.game.phase !== "voting") return;
    const limit = Math.max(1, Math.floor(numberOr(settings.scoring.votesPerPlayer, 1)));
    const validTargets = new Set(Object.keys(runtime.game.contributions));
    const filtered = [];
    for (const targetId of targetIds) {
      if (!validTargets.has(targetId)) continue;
      if (!settings.scoring.allowSelfVote && targetId === voterId) continue;
      if (!filtered.includes(targetId)) filtered.push(targetId);
      if (filtered.length >= limit) break;
    }
    runtime.game.votes[voterId] = filtered;
  }

  function castVote(targetId) {
    if (runtime.game.phase !== "voting" || !runtime.myId) return;
    const existing = runtime.game.votes[runtime.myId] || [];
    const limit = Math.max(1, Math.floor(numberOr(settings.scoring.votesPerPlayer, 1)));
    let targets = existing.includes(targetId)
      ? existing.filter((id) => id !== targetId)
      : [...existing, targetId].slice(-limit);
    if (!settings.scoring.allowSelfVote) {
      targets = targets.filter((id) => id !== runtime.myId);
    }
    if (runtime.role === "host") {
      recordVote(runtime.myId, targets);
      broadcast({ type: "STATE", state: publicGameState() });
      renderAll();
    } else {
      runtime.game.votes[runtime.myId] = targets;
      const host = getHostPeer();
      sendToPeer(host, { type: "VOTE", targetIds: targets });
      renderAll();
    }
  }

  function createEditorState() {
    return {
      tool: "brush",
      color: "#ffffff",
      brushSize: 18,
      textSize: 58,
      font: "Impact",
      strokes: [],
      textBoxes: [],
      history: [],
      activeStroke: null,
      selectedTextId: null,
      dragMode: null,
      dragStart: null,
      dragMoved: false,
      textFocusSnapshot: false
    };
  }

  function resetEditorForRound() {
    const keep = {
      tool: runtime.editor?.tool || settings.editor.defaultTool || "brush",
      color: runtime.editor?.color || normalizeColor(settings.editor.palette?.[0], "#ffffff"),
      brushSize: numberOr(runtime.editor?.brushSize, settings.editor.defaultBrushSize || 18),
      textSize: numberOr(runtime.editor?.textSize, settings.editor.defaultTextSize || 58),
      font: runtime.selectedFont || settings.editor.defaultFont || "Impact"
    };
    runtime.editor = createEditorState();
    Object.assign(runtime.editor, keep);
    if (dom.textInput) dom.textInput.value = "";
    hideTextOverlay();
    renderEditorControls();
    requestRenderCanvas();
  }

  function setTool(tool) {
    runtime.editor.tool = ["brush", "text", "eraser"].includes(tool) ? tool : "brush";
    dom.toolButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.tool === runtime.editor.tool);
    });
    if (dom.canvasOptionsBar) dom.canvasOptionsBar.dataset.tool = runtime.editor.tool;
    if (runtime.editor.tool !== "text") hideTextOverlay();
  }

  function onCanvasPointerDown(event) {
    if (!canEdit()) return;
    event.preventDefault();
    dom.artCanvas.setPointerCapture(event.pointerId);
    const point = canvasPoint(event);
    const editor = runtime.editor;

    if (editor.tool === "brush" || editor.tool === "eraser") {
      pushHistory();
      const stroke = {
        id: `stroke-${uid(8)}`,
        mode: editor.tool === "eraser" ? "erase" : "draw",
        color: editor.color,
        size: editor.tool === "eraser" ? editor.brushSize * 1.4 : editor.brushSize,
        points: [point]
      };
      editor.strokes.push(stroke);
      editor.activeStroke = stroke;
      editor.selectedTextId = null;
      if (dom.textInput) dom.textInput.value = "";
      hideTextOverlay();
      requestRenderCanvas();
      return;
    }

    const hit = hitTestTextBox(point);
    if (hit) {
      editor.selectedTextId = hit.box.id;
      editor.dragMode = hit.handle ? "resize-text" : "move-text";
      editor.dragStart = {
        point,
        box: structuredCloneSafe(hit.box),
        offsetX: point.x - hit.box.x,
        offsetY: point.y - hit.box.y
      };
      editor.dragMoved = false;
      pushHistory();
      syncSelectedTextControls();
      updateTextOverlay();
      requestRenderCanvas();
      return;
    }

    if (editor.textBoxes.length >= numberOr(settings.editor.maxTextBoxes, 24)) {
      showToast("Text limit reached.");
      return;
    }
    pushHistory();
    const box = {
      id: `text-${uid(8)}`,
      x: point.x,
      y: point.y,
      w: 1,
      h: 1,
      text: "",
      font: editor.font,
      size: editor.textSize,
      color: editor.color,
      align: "center",
      weight: 900
    };
    editor.textBoxes.push(box);
    editor.selectedTextId = box.id;
    editor.dragMode = "create-text";
    editor.dragStart = { point, box: structuredCloneSafe(box) };
    editor.dragMoved = false;
    syncSelectedTextControls();
    updateTextOverlay();
    requestRenderCanvas();
  }

  function onCanvasPointerMove(event) {
    const editor = runtime.editor;
    if (!canEdit()) return;
    const point = canvasPoint(event);
    if (editor.activeStroke) {
      const maxPoints = numberOr(settings.editor.maxPointsPerStroke, 900);
      const points = editor.activeStroke.points;
      const last = points[points.length - 1];
      if (distance(last, point) > 1.5 && points.length < maxPoints) {
        points.push(point);
        requestRenderCanvas();
        scheduleAutosave();
      }
      return;
    }
    if (!editor.dragMode || !editor.selectedTextId || !editor.dragStart) return;
    const box = getSelectedTextBox();
    if (!box) return;

    if (editor.dragMode === "move-text") {
      box.x = point.x - editor.dragStart.offsetX;
      box.y = point.y - editor.dragStart.offsetY;
    } else {
      const start = editor.dragStart.point;
      box.x = Math.min(start.x, point.x);
      box.y = Math.min(start.y, point.y);
      box.w = Math.abs(point.x - start.x);
      box.h = Math.abs(point.y - start.y);
    }
    editor.dragMoved = editor.dragMoved || distance(editor.dragStart.point, point) > 4;
    clampTextBox(box);
    updateTextOverlay();
    requestRenderCanvas();
    scheduleAutosave();
  }

  function onCanvasPointerUp(event) {
    const editor = runtime.editor;
    if (event.pointerId !== undefined && dom.artCanvas.hasPointerCapture?.(event.pointerId)) {
      dom.artCanvas.releasePointerCapture(event.pointerId);
    }
    if (editor.activeStroke) {
      editor.activeStroke = null;
      limitStrokes();
      scheduleAutosave();
      requestRenderCanvas();
    }
    if (editor.dragMode) {
      const box = getSelectedTextBox();
      if (box) {
        if (box.w < 42 || box.h < 34) {
          box.w = Math.max(box.w, 320);
          box.h = Math.max(box.h, 132);
        }
        clampTextBox(box);
        syncSelectedTextControls();
        updateTextOverlay({ focus: editor.dragMode === "create-text" || !editor.dragMoved });
      }
      editor.dragMode = null;
      editor.dragStart = null;
      editor.dragMoved = false;
      scheduleAutosave();
      requestRenderCanvas();
    }
  }

  function canEdit() {
    return runtime.game.phase === "drawing" && Boolean(runtime.role);
  }

  function pushHistory() {
    const editor = runtime.editor;
    editor.history.push({
      strokes: structuredCloneSafe(editor.strokes),
      textBoxes: structuredCloneSafe(editor.textBoxes),
      selectedTextId: editor.selectedTextId
    });
    if (editor.history.length > 50) editor.history.shift();
  }

  function undo() {
    const previous = runtime.editor.history.pop();
    if (!previous) return;
    runtime.editor.strokes = previous.strokes || [];
    runtime.editor.textBoxes = previous.textBoxes || [];
    runtime.editor.selectedTextId = previous.selectedTextId || null;
    syncSelectedTextControls();
    scheduleAutosave();
    requestRenderCanvas();
  }

  function clearEditor() {
    if (!canEdit()) return;
    pushHistory();
    runtime.editor.strokes = [];
    runtime.editor.textBoxes = [];
    runtime.editor.selectedTextId = null;
    if (dom.textInput) dom.textInput.value = "";
    hideTextOverlay();
    scheduleAutosave();
    requestRenderCanvas();
  }

  function deleteSelectedText() {
    const selected = getSelectedTextBox();
    if (!selected) return;
    pushHistory();
    runtime.editor.textBoxes = runtime.editor.textBoxes.filter((box) => box.id !== selected.id);
    runtime.editor.selectedTextId = null;
    if (dom.textInput) dom.textInput.value = "";
    hideTextOverlay();
    scheduleAutosave();
    requestRenderCanvas();
  }

  function updateSelectedTextBox(partial) {
    const box = getSelectedTextBox();
    if (!box) return;
    Object.assign(box, partial);
    if (partial.size) runtime.editor.textSize = box.size;
    if (partial.font) runtime.editor.font = box.font;
    scheduleAutosave();
    requestRenderCanvas();
    syncSelectedTextControls({ keepFocus: true });
  }

  function getSelectedTextBox() {
    const id = runtime.editor.selectedTextId;
    return runtime.editor.textBoxes.find((box) => box.id === id) || null;
  }

  function syncSelectedTextControls(options = {}) {
    const box = getSelectedTextBox();
    if (dom.textInput) dom.textInput.value = box?.text || "";
    if (box) {
      if (dom.colorInput) dom.colorInput.value = normalizeColor(box.color, runtime.editor.color);
      if (dom.textColorInput) dom.textColorInput.value = normalizeColor(box.color, runtime.editor.color);
      if (dom.textSizeInput) dom.textSizeInput.value = String(box.size);
      if (dom.globalTextSizeInput) dom.globalTextSizeInput.value = String(box.size);
      if (runtime.assets.fonts.some((font) => font.name === box.font)) runtime.selectedFont = box.font;
      updateTextOverlay({ focus: options.focus, keepFocus: options.keepFocus });
    } else {
      hideTextOverlay();
    }
    renderFontControls();
  }

  function bumpSelectedTextSize(delta) {
    const box = getSelectedTextBox();
    const next = clamp(numberOr(box?.size, runtime.editor.textSize) + delta, 16, 160);
    runtime.editor.textSize = next;
    if (dom.textSizeInput) dom.textSizeInput.value = String(next);
    if (dom.globalTextSizeInput) dom.globalTextSizeInput.value = String(next);
    if (box) updateSelectedTextBox({ size: next });
  }

  function hideTextOverlay() {
    dom.textInput?.classList.add("hidden");
    dom.textBubble?.classList.add("hidden");
  }

  function updateTextOverlay(options = {}) {
    const box = getSelectedTextBox();
    if (!canEdit() || !box || !dom.textInput || !dom.textBubble) {
      hideTextOverlay();
      return;
    }
    const rect = canvasBoxToStageRect(box);
    const edge = Math.max(8, Math.min(14, rect.width * 0.08));
    const inputLeft = rect.left + edge;
    const inputTop = rect.top + edge;
    const inputWidth = Math.max(40, rect.width - edge * 2);
    const inputHeight = Math.max(32, rect.height - edge * 2);
    Object.assign(dom.textInput.style, {
      left: `${inputLeft}px`,
      top: `${inputTop}px`,
      width: `${inputWidth}px`,
      height: `${inputHeight}px`,
      color: normalizeColor(box.color, runtime.editor.color),
      fontFamily: fontFamilyValue(box.font),
      fontSize: `${Math.max(12, box.size * rect.scaleX)}px`,
      textAlign: box.align || "center"
    });
    dom.textInput.value = box.text || "";
    dom.textInput.classList.remove("hidden");
    dom.textBubble.classList.remove("hidden");
    setAlignButtonState(box.align || "center");
    dom.textBubble.style.visibility = "hidden";
    const bubbleWidth = dom.textBubble.offsetWidth;
    const bubbleHeight = dom.textBubble.offsetHeight;
    Object.assign(dom.textBubble.style, {
      left: `${Math.max(8, Math.min(rect.left, dom.stageFrame.clientWidth - bubbleWidth - 8))}px`,
      top: `${Math.max(8, rect.top - bubbleHeight - 12)}px`,
      visibility: ""
    });
    if (options.focus) {
      window.setTimeout(() => {
        dom.textInput.focus();
        dom.textInput.setSelectionRange(dom.textInput.value.length, dom.textInput.value.length);
      }, 0);
    } else if (options.keepFocus && document.activeElement === dom.textInput) {
      dom.textInput.focus();
    }
  }

  function canvasBoxToStageRect(box) {
    const canvasRect = dom.artCanvas.getBoundingClientRect();
    const stageRect = dom.stageFrame.getBoundingClientRect();
    const scaleX = canvasRect.width / dom.artCanvas.width;
    const scaleY = canvasRect.height / dom.artCanvas.height;
    return {
      left: canvasRect.left - stageRect.left + box.x * scaleX,
      top: canvasRect.top - stageRect.top + box.y * scaleY,
      width: box.w * scaleX,
      height: box.h * scaleY,
      scaleX,
      scaleY
    };
  }

  function setAlignButtonState(align) {
    [
      [dom.alignLeftBtn, "left"],
      [dom.alignCenterBtn, "center"],
      [dom.alignRightBtn, "right"]
    ].forEach(([button, value]) => {
      button?.classList.toggle("active", align === value);
    });
  }

  function fitTextBoxToContent(box) {
    const minHeight = Math.max(58, box.size * 1.45);
    const lineCount = Math.max(1, String(box.text || "").split(/\n/).length);
    const wantedHeight = Math.min(dom.artCanvas.height - box.y, Math.max(box.h, minHeight, lineCount * box.size * 1.18 + box.size * 0.45));
    box.h = clamp(wantedHeight, 34, dom.artCanvas.height - box.y);
    clampTextBox(box);
  }

  function scheduleAutosave() {
    if (!canEdit()) return;
    markLocalContributionDirty();
    clearTimeout(runtime.localAutosaveTimer);
    runtime.localAutosaveTimer = window.setTimeout(() => submitLocalContribution(false), 700);
  }

  function markLocalContributionDirty() {
    const contribution = runtime.game.contributions?.[runtime.myId];
    if (!contribution?.submitted) return;
    contribution.submitted = false;
    renderSession();
  }

  async function submitLocalContribution(submitted) {
    if (runtime.game.phase !== "drawing" || !runtime.myId) return false;
    const box = getSelectedTextBox();
    if (box && dom.textInput && document.activeElement === dom.textInput) {
      box.text = dom.textInput.value.slice(0, numberOr(settings.editor.maxTextLength, 360));
      fitTextBoxToContent(box);
    }
    const contribution = sanitizeContribution({
      playerId: runtime.myId,
      playerName: getPlayerNameById(runtime.myId) || getPlayerName(),
      round: runtime.game.roundIndex,
      imageId: runtime.game.currentImage?.id || "",
      strokes: runtime.editor.strokes,
      textBoxes: runtime.editor.textBoxes,
      submitted: Boolean(submitted),
      updatedAt: Date.now()
    }, runtime.myId);
    runtime.game.contributions[runtime.myId] = contribution;
    if (runtime.role === "host") {
      if (submitted) {
        logActivity("Your submission is in.");
        showToast("Submitted.");
      }
      scheduleBroadcastState();
      renderAll();
      return true;
    } else {
      const host = getHostPeer();
      const sent = await sendToPeer(host, { type: "CONTRIBUTION", contribution });
      if (submitted && sent) {
        logActivity("Submission sent.");
        showToast("Submitted.");
      } else if (submitted && !sent) {
        showToast("Still connecting to the host.");
        logActivity("Submission could not be sent yet.");
      }
      renderAll();
      return sent;
    }
  }

  function sanitizeContribution(contribution, playerId) {
    if (!contribution || contribution.round !== runtime.game.roundIndex) return null;
    const maxStrokes = numberOr(settings.editor.maxStrokes, 260);
    const maxPoints = numberOr(settings.editor.maxPointsPerStroke, 900);
    const maxTextBoxes = numberOr(settings.editor.maxTextBoxes, 24);
    const maxTextLength = numberOr(settings.editor.maxTextLength, 360);
    return {
      playerId,
      playerName: getPlayerNameById(playerId) || cleanPlayerName(contribution.playerName || "Player"),
      round: runtime.game.roundIndex,
      imageId: runtime.game.currentImage?.id || contribution.imageId || "",
      submitted: Boolean(contribution.submitted),
      updatedAt: numberOr(contribution.updatedAt, Date.now()),
      strokes: (contribution.strokes || []).slice(0, maxStrokes).map((stroke) => ({
        id: String(stroke.id || `stroke-${uid(6)}`),
        mode: stroke.mode === "erase" ? "erase" : "draw",
        color: normalizeColor(stroke.color, "#ffffff"),
        size: clamp(numberOr(stroke.size, 18), 1, 180),
        points: (stroke.points || []).slice(0, maxPoints).map((point) => ({
          x: clamp(numberOr(point.x, 0), 0, dom.artCanvas.width),
          y: clamp(numberOr(point.y, 0), 0, dom.artCanvas.height)
        }))
      })).filter((stroke) => stroke.points.length > 0),
      textBoxes: (contribution.textBoxes || []).slice(0, maxTextBoxes).map((box) => ({
        id: String(box.id || `text-${uid(6)}`),
        x: clamp(numberOr(box.x, 0), 0, dom.artCanvas.width),
        y: clamp(numberOr(box.y, 0), 0, dom.artCanvas.height),
        w: clamp(numberOr(box.w, 220), 20, dom.artCanvas.width),
        h: clamp(numberOr(box.h, 100), 20, dom.artCanvas.height),
        text: String(box.text || "").slice(0, maxTextLength),
        font: String(box.font || settings.editor.defaultFont || "Impact").slice(0, 80),
        size: clamp(numberOr(box.size, 58), 8, 220),
        color: normalizeColor(box.color, "#ffffff"),
        align: ["left", "center", "right"].includes(box.align) ? box.align : "center",
        weight: clamp(numberOr(box.weight, 900), 100, 1000)
      }))
    };
  }

  function limitStrokes() {
    const max = numberOr(settings.editor.maxStrokes, 260);
    if (runtime.editor.strokes.length > max) {
      runtime.editor.strokes = runtime.editor.strokes.slice(runtime.editor.strokes.length - max);
    }
  }

  function renderAll() {
    if (renderUiQueued) return;
    renderUiQueued = true;
    requestAnimationFrame(() => {
      renderUiQueued = false;
      renderSession();
      renderPhase();
      renderPlayers();
      renderImages();
      renderEditorControls();
      renderGallery();
      requestRenderCanvas();
    });
  }

  function renderSession() {
    if (dom.roleChip) {
      dom.roleChip.textContent = runtime.role === "host" ? "Host" : "Member";
      dom.roleChip.classList.toggle("good", Boolean(runtime.role));
    }
    if (dom.roomChip) dom.roomChip.textContent = runtime.roomId ? `Room ${runtime.roomId}` : "Room --";
    if (dom.connectionChip) {
      const label = runtime.connectionLabel || "Finding room";
      const isBad = /offline|could not/i.test(label);
      dom.connectionChip.textContent = label;
      dom.connectionChip.classList.toggle("bad", isBad);
    }
    if (dom.roomCodeLabel) dom.roomCodeLabel.textContent = runtime.roomId || "------";
    if (dom.copyRoomBtn) dom.copyRoomBtn.disabled = !runtime.roomId;
    if (dom.roomHint) {
      if (runtime.role === "host") {
        dom.roomHint.textContent = "Share the link with players.";
      } else if (runtime.role === "client" && hasOpenPeer()) {
        dom.roomHint.textContent = "You are in the room.";
      } else {
        dom.roomHint.textContent = "Waiting for the host.";
      }
    }
    const showHostBox = runtime.role === "host" || (!runtime.role && runtime.modeView === "host");
    const showJoinBox = runtime.role === "client" || (!runtime.role && runtime.modeView === "join");
    dom.hostBox?.classList.toggle("hidden", !showHostBox);
    dom.joinBox?.classList.toggle("hidden", !showJoinBox);
    dom.hostControlsSection?.classList.toggle("hidden", runtime.role !== "host");
    if (dom.startRoundBtn) dom.startRoundBtn.disabled = runtime.role !== "host" || runtime.game.phase !== "lobby";
    if (dom.nextRoundBtn) dom.nextRoundBtn.disabled = runtime.role !== "host" || runtime.game.phase !== "results";
    if (dom.finishVotingBtn) {
      dom.finishVotingBtn.disabled = runtime.role !== "host" || !["drawing", "voting"].includes(runtime.game.phase);
      dom.finishVotingBtn.textContent = runtime.game.phase === "drawing" ? "Open voting" : "Close voting";
    }
    if (dom.resetMatchBtn) dom.resetMatchBtn.disabled = runtime.role !== "host";
    if (dom.createInviteBtn) dom.createInviteBtn.disabled = runtime.role !== "host";
    if (dom.acceptAnswerBtn) dom.acceptAnswerBtn.disabled = runtime.role !== "host";
    if (dom.makeAnswerBtn) dom.makeAnswerBtn.disabled = !runtime.securityReady;
    if (dom.submitBtn) {
      const submitted = Boolean(runtime.game.contributions?.[runtime.myId]?.submitted);
      dom.submitBtn.disabled = !canEdit();
      dom.submitBtn.textContent = submitted ? "Submitted" : "Submit";
      dom.submitBtn.classList.toggle("submitted", submitted);
    }
  }

  function renderPhase() {
    const phaseLabels = {
      lobby: "Lobby",
      joining: "Join room",
      connecting: "Connecting",
      drawing: "Create",
      voting: "Vote",
      results: "Results",
      final: "Winner"
    };
    dom.roundLabel.textContent = `${runtime.game.roundIndex}/${runtime.game.totalRounds}`;
    dom.phaseLabel.textContent = phaseLabels[runtime.game.phase] || "Lobby";
    const hasCanvasPhase = runtime.game.phase === "drawing";
    const hasGalleryPhase = ["voting", "results", "final"].includes(runtime.game.phase);
    dom.editorPanel.classList.toggle("hidden", !hasCanvasPhase);
    dom.canvasOptionsBar?.classList.toggle("hidden", !hasCanvasPhase);
    dom.emptyStage.classList.toggle("hidden", hasCanvasPhase || hasGalleryPhase);
    dom.gallery.classList.toggle("hidden", !hasGalleryPhase);
    if (!hasCanvasPhase) hideTextOverlay();
    if (!hasCanvasPhase && !hasGalleryPhase) {
      dom.emptyStageText.textContent = lobbyStatusText();
    }
    updateTimerUI();
  }

  function lobbyStatusText() {
    if (runtime.role === "host") return "Start the round when the members are ready.";
    if (runtime.role === "client") return "Waiting for the host.";
    return "Waiting for the host.";
  }

  function updateTimerUI() {
    const end = runtime.game.phaseEndsAt || 0;
    const start = runtime.game.phaseStartedAt || 0;
    if (!end || Date.now() >= end) {
      dom.timerLabel.textContent = "--:--";
      dom.timerFill.style.width = "0%";
      return;
    }
    const remaining = Math.max(0, end - Date.now());
    const total = Math.max(1, end - start);
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.ceil((remaining % 60000) / 1000);
    dom.timerLabel.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    dom.timerFill.style.width = `${clamp((remaining / total) * 100, 0, 100)}%`;
  }

  function renderPlayers() {
    dom.playerCountLabel.textContent = String(runtime.game.players.length);
    dom.playerList.textContent = "";
    const players = [...runtime.game.players].sort((a, b) => {
      if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
      return a.name.localeCompare(b.name);
    });
    players.forEach((player, index) => {
      const card = document.createElement("div");
      card.className = "player-card";
      const avatar = document.createElement("div");
      avatar.className = "avatar";
      avatar.style.background = playerColor(index);
      avatar.textContent = initials(player.name);
      const middle = document.createElement("div");
      const name = document.createElement("div");
      name.className = "player-name";
      name.textContent = player.name;
      const meta = document.createElement("div");
      meta.className = "player-meta";
      meta.textContent = player.host ? "Host" : (player.connected ? "Connected" : "Away");
      middle.append(name, meta);
      const score = document.createElement("div");
      score.className = "score-pill";
      score.textContent = String(runtime.game.scores[player.id] || player.score || 0);
      card.append(avatar, middle, score);
      dom.playerList.append(card);
    });
  }

  function renderImages() {
    if (!dom.imageLibrary) return;
    if (dom.imageCountLabel) dom.imageCountLabel.textContent = String(runtime.assets.images.length);
    dom.imageLibrary.textContent = "";
    runtime.assets.images.forEach((image, index) => {
      const card = document.createElement("div");
      card.className = "asset-card";
      card.classList.toggle("active", image.id === runtime.selectedImageId);
      const button = document.createElement("button");
      button.type = "button";
      button.addEventListener("click", () => {
        runtime.selectedImageId = image.id;
        if (runtime.role === "host" && runtime.game.phase === "lobby") {
          runtime.game.imageCursor = index;
          logActivity(`Image queued: ${image.title}`);
        }
        renderAll();
      });
      if (image.src) {
        const img = document.createElement("img");
        img.className = "asset-thumb";
        img.alt = "";
        img.src = image.src;
        button.append(img);
      } else {
        const thumb = document.createElement("div");
        thumb.className = "asset-thumb";
        thumb.style.background = "linear-gradient(90deg, #ff3f5f, #ffcf33, #00c2ff, #31d07f)";
        button.append(thumb);
      }
      const label = document.createElement("span");
      label.className = "asset-name";
      label.textContent = image.title;
      button.append(label);
      card.append(button);
      dom.imageLibrary.append(card);
    });
  }

  function renderEditorControls() {
    if (!runtime.editor) return;
    dom.toolButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.tool === runtime.editor.tool);
    });
    if (dom.colorInput) dom.colorInput.value = normalizeColor(dom.colorInput.value || runtime.editor.color, runtime.editor.color);
    if (dom.textColorInput) dom.textColorInput.value = normalizeColor(dom.textColorInput.value || runtime.editor.color, runtime.editor.color);
    if (dom.sizeInput) dom.sizeInput.value = String(runtime.editor.brushSize);
    if (dom.textSizeInput) dom.textSizeInput.value = String(runtime.editor.textSize);
    if (dom.globalTextSizeInput) dom.globalTextSizeInput.value = String(runtime.editor.textSize);
    if (dom.canvasOptionsBar) dom.canvasOptionsBar.dataset.tool = runtime.editor.tool;
    renderFontControls();
  }

  function renderFontControls() {
    const current = runtime.selectedFont || runtime.editor.font || "";
    if (dom.fontCountLabel) dom.fontCountLabel.textContent = String(runtime.assets.fonts.length);
    const rows = [dom.fontPreviewRow, dom.bubbleFontPreviewRow].filter(Boolean);
    if (!rows.length) return;
    rows.forEach((row) => {
      row.textContent = "";
    });
    if (!runtime.assets.fonts.length) {
      const empty = document.createElement("div");
      empty.className = "font-empty";
      empty.textContent = "No fonts loaded";
      rows.forEach((row) => row.append(empty.cloneNode(true)));
      return;
    }
    rows.forEach((row) => {
      runtime.assets.fonts.forEach((font) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "font-preview";
        button.classList.toggle("active", font.name === current);
        button.style.fontFamily = fontFamilyValue(font.name);
        button.addEventListener("click", () => {
          selectFont(font.name);
        });
        const name = document.createElement("span");
        name.textContent = font.name;
        const sample = document.createElement("span");
        sample.className = "sample";
        sample.textContent = "Aa 123";
        button.append(name, sample);
        row.append(button);
      });
    });
  }

  function selectFont(fontName) {
    if (!runtime.assets.fonts.some((font) => font.name === fontName)) return;
    runtime.selectedFont = fontName;
    runtime.editor.font = fontName;
    setTool("text");
    updateSelectedTextBox({ font: fontName });
    renderFontControls();
    updateTextOverlay({ keepFocus: true });
  }

  function renderGallery() {
    const phase = runtime.game.phase;
    if (!["voting", "results", "final"].includes(phase)) {
      runtime.lastRenderedGalleryKey = "";
      dom.gallery.textContent = "";
      return;
    }
    const key = JSON.stringify({
      phase,
      round: runtime.game.roundIndex,
      contributions: Object.keys(runtime.game.contributions).length,
      votes: runtime.game.votes,
      scores: runtime.game.scores,
      results: runtime.game.results
    });
    if (key === runtime.lastRenderedGalleryKey) return;
    runtime.lastRenderedGalleryKey = key;
    dom.gallery.textContent = "";

    const contributions = Object.values(runtime.game.contributions)
      .filter((contribution) => contribution.strokes?.length || contribution.textBoxes?.length)
      .sort((a, b) => a.playerName.localeCompare(b.playerName));

    if (!contributions.length) {
      const empty = document.createElement("div");
      empty.className = "result-card";
      const title = document.createElement("h3");
      title.textContent = "No submissions this round";
      empty.append(title);
      dom.gallery.append(empty);
      return;
    }

    const voteCounts = runtime.game.results?.voteCounts || countVotesLive();
    const sorted = phase === "voting" ? contributions : [...contributions].sort((a, b) => {
      return (voteCounts[b.playerId] || 0) - (voteCounts[a.playerId] || 0);
    });

    if (phase === "final") {
      const topScore = Math.max(0, ...runtime.game.players.map((player) => runtime.game.scores[player.id] || 0));
      const winners = runtime.game.players.filter((player) => (runtime.game.scores[player.id] || 0) === topScore && topScore > 0);
      const finalCard = document.createElement("article");
      finalCard.className = "result-card";
      const heading = document.createElement("h3");
      heading.textContent = winners.length ? `Winner: ${winners.map((player) => player.name).join(", ")}` : "Winner pending";
      const meta = document.createElement("div");
      meta.className = "player-meta";
      meta.textContent = winners.length ? `${topScore} points` : "No points scored";
      finalCard.append(heading, meta);
      dom.gallery.append(finalCard);
    }

    sorted.forEach((contribution) => {
      const card = document.createElement("article");
      card.className = phase === "voting" ? "vote-card" : "result-card";
      const header = document.createElement("header");
      const title = document.createElement("h3");
      title.textContent = contribution.playerName;
      const badge = document.createElement("span");
      badge.className = "vote-badge";
      badge.textContent = `${voteCounts[contribution.playerId] || 0} votes`;
      header.append(title, badge);
      const canvas = document.createElement("canvas");
      canvas.width = dom.artCanvas.width;
      canvas.height = dom.artCanvas.height;
      drawScene(canvas.getContext("2d"), runtime.game.currentImage, contribution, { selection: false });
      card.append(header, canvas);

      if (phase === "voting") {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "primary-button";
        const selected = (runtime.game.votes[runtime.myId] || []).includes(contribution.playerId);
        button.textContent = selected ? "Selected" : "Vote";
        button.disabled = !runtime.myId || (!settings.scoring.allowSelfVote && contribution.playerId === runtime.myId);
        button.addEventListener("click", () => castVote(contribution.playerId));
        card.append(button);
      } else {
        const award = document.createElement("div");
        award.className = "player-meta";
        const points = runtime.game.results?.awards?.[contribution.playerId] || 0;
        award.textContent = `+${points} points`;
        card.append(award);
      }
      dom.gallery.append(card);
    });
  }

  function countVotesLive() {
    const counts = {};
    Object.keys(runtime.game.contributions).forEach((playerId) => {
      counts[playerId] = 0;
    });
    Object.values(runtime.game.votes).forEach((targets) => {
      targets.forEach((targetId) => {
        if (Object.prototype.hasOwnProperty.call(counts, targetId)) counts[targetId] += 1;
      });
    });
    return counts;
  }

  function requestRenderCanvas() {
    if (renderCanvasQueued) return;
    renderCanvasQueued = true;
    requestAnimationFrame(() => {
      renderCanvasQueued = false;
      renderCanvas();
    });
  }

  function renderCanvas() {
    const ctx = dom.ctx;
    const contribution = runtime.game.phase === "drawing"
      ? {
          playerId: runtime.myId || "local",
          playerName: getPlayerName(),
          strokes: runtime.editor.strokes,
          textBoxes: runtime.editor.textBoxes
        }
      : null;
    const image = runtime.game.currentImage || runtime.assets.images.find((item) => item.id === runtime.selectedImageId) || runtime.assets.images[0] || createFallbackImage();
    drawScene(ctx, image, contribution, { selection: runtime.game.phase === "drawing" });
  }

  function drawScene(ctx, image, contribution, options = {}) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, width, height);
    drawBaseImage(ctx, image);
    if (contribution) drawContribution(ctx, contribution);
    if (options.selection) drawSelectionOverlay(ctx);
    ctx.restore();
  }

  function drawBaseImage(ctx, image) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const img = image?.src ? getCachedImage(image.src) : null;
    if (img?.complete && img.naturalWidth) {
      const fit = settings.canvas.backgroundFit || "contain";
      const rect = fitRect(img.naturalWidth, img.naturalHeight, width, height, fit);
      ctx.fillStyle = "#0d0d0d";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
      return;
    }

    const bands = ["#ff3f5f", "#ffcf33", "#00c2ff", "#31d07f", "#a86cff", "#ff7a1a"];
    bands.forEach((color, index) => {
      ctx.fillStyle = color;
      ctx.fillRect((width / bands.length) * index, 0, width / bands.length + 1, height);
    });
    ctx.fillStyle = "rgba(17, 17, 17, 0.74)";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(255, 249, 236, 0.4)";
    ctx.lineWidth = 4;
    const pad = numberOr(settings.canvas.safePadding, 42);
    ctx.strokeRect(pad, pad, width - pad * 2, height - pad * 2);
    ctx.fillStyle = "#fff9ec";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${Math.max(34, width * 0.06)}px ${fontFamilyValue(settings.editor.defaultFont || "Impact")}`;
    ctx.fillText(image?.title || "Add images", width / 2, height / 2);
  }

  function getCachedImage(src) {
    if (!imageCache.has(src)) {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        requestRenderCanvas();
        runtime.lastRenderedGalleryKey = "";
        renderGallery();
      };
      img.onerror = () => requestRenderCanvas();
      img.src = src;
      imageCache.set(src, img);
    }
    return imageCache.get(src);
  }

  function drawContribution(targetCtx, contribution) {
    const layer = document.createElement("canvas");
    layer.width = targetCtx.canvas.width;
    layer.height = targetCtx.canvas.height;
    const ctx = layer.getContext("2d");
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    (contribution.strokes || []).forEach((stroke) => {
      if (!stroke.points?.length) return;
      ctx.save();
      ctx.globalCompositeOperation = stroke.mode === "erase" ? "destination-out" : "source-over";
      ctx.strokeStyle = stroke.mode === "erase" ? "rgba(0,0,0,1)" : normalizeColor(stroke.color, "#ffffff");
      ctx.lineWidth = clamp(numberOr(stroke.size, 18), 1, 180);
      ctx.beginPath();
      stroke.points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      if (stroke.points.length === 1) {
        const point = stroke.points[0];
        ctx.lineTo(point.x + 0.01, point.y + 0.01);
      }
      ctx.stroke();
      ctx.restore();
    });

    (contribution.textBoxes || []).forEach((box) => drawTextBox(ctx, box));
    targetCtx.drawImage(layer, 0, 0);
  }

  function drawTextBox(ctx, box) {
    if (!box.text) return;
    const pad = Math.max(6, box.size * 0.12);
    const x = box.x + pad;
    const y = box.y + pad;
    const maxWidth = Math.max(10, box.w - pad * 2);
    const maxHeight = Math.max(10, box.h - pad * 2);
    const lineHeight = Math.max(14, box.size * 1.08);
    const lines = wrapText(ctx, box.text, box, maxWidth);
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    ctx.font = `${box.weight || 900} ${box.size}px ${fontFamilyValue(box.font)}`;
    ctx.textBaseline = "top";
    ctx.textAlign = box.align || "center";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(3, box.size * 0.08);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.72)";
    ctx.fillStyle = normalizeColor(box.color, "#ffffff");
    const alignX = box.align === "left" ? x : box.align === "right" ? x + maxWidth : x + maxWidth / 2;
    for (let index = 0; index < lines.length; index += 1) {
      const lineY = y + index * lineHeight;
      if (lineY + lineHeight > y + maxHeight) break;
      ctx.strokeText(lines[index], alignX, lineY, maxWidth);
      ctx.fillText(lines[index], alignX, lineY, maxWidth);
    }
    ctx.restore();
  }

  function wrapText(ctx, text, box, maxWidth) {
    ctx.save();
    ctx.font = `${box.weight || 900} ${box.size}px ${fontFamilyValue(box.font)}`;
    const lines = [];
    const paragraphs = String(text).split(/\n/);
    paragraphs.forEach((paragraph) => {
      const words = paragraph.split(/\s+/).filter(Boolean);
      if (!words.length) {
        lines.push("");
        return;
      }
      let line = "";
      words.forEach((word) => {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width <= maxWidth) {
          line = test;
        } else {
          if (line) lines.push(line);
          if (ctx.measureText(word).width <= maxWidth) {
            line = word;
          } else {
            const chars = word.split("");
            let chunk = "";
            chars.forEach((char) => {
              const testChunk = chunk + char;
              if (ctx.measureText(testChunk).width <= maxWidth) chunk = testChunk;
              else {
                if (chunk) lines.push(chunk);
                chunk = char;
              }
            });
            line = chunk;
          }
        }
      });
      lines.push(line);
    });
    ctx.restore();
    return lines;
  }

  function drawSelectionOverlay(ctx) {
    const box = getSelectedTextBox();
    if (!box) return;
    ctx.save();
    ctx.setLineDash([8, 7]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffcf33";
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    ctx.setLineDash([]);
    ctx.fillStyle = "#ffcf33";
    const handle = textBoxHandle(box);
    ctx.fillRect(handle.x, handle.y, handle.size, handle.size);
    ctx.restore();
  }

  function canvasPoint(event) {
    const rect = dom.artCanvas.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) * (dom.artCanvas.width / rect.width), 0, dom.artCanvas.width),
      y: clamp((event.clientY - rect.top) * (dom.artCanvas.height / rect.height), 0, dom.artCanvas.height)
    };
  }

  function hitTestTextBox(point) {
    for (let index = runtime.editor.textBoxes.length - 1; index >= 0; index -= 1) {
      const box = runtime.editor.textBoxes[index];
      const handle = textBoxHandle(box);
      const onHandle = point.x >= handle.x && point.x <= handle.x + handle.size && point.y >= handle.y && point.y <= handle.y + handle.size;
      const inside = point.x >= box.x && point.x <= box.x + box.w && point.y >= box.y && point.y <= box.y + box.h;
      if (onHandle || inside) return { box, handle: onHandle };
    }
    return null;
  }

  function textBoxHandle(box) {
    const size = 20;
    return {
      x: box.x + box.w - size / 2,
      y: box.y + box.h - size / 2,
      size
    };
  }

  function clampTextBox(box) {
    const width = dom.artCanvas.width;
    const height = dom.artCanvas.height;
    box.w = clamp(box.w, 20, width);
    box.h = clamp(box.h, 20, height);
    box.x = clamp(box.x, 0, width - box.w);
    box.y = clamp(box.y, 0, height - box.h);
  }

  async function deriveRoomKey(secret, roomId) {
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      TEXT_ENCODER.encode(secret),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: TEXT_ENCODER.encode(`berrybox:${roomId}`),
        iterations: Math.max(10000, numberOr(settings.security.pbkdf2Iterations, 180000)),
        hash: "SHA-256"
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  function ensureSecureReady() {
    runtime.securityReady = checkSecurity();
    if (!runtime.securityReady) {
      showToast("Open this through localhost or HTTPS to enable secure rooms.");
      return false;
    }
    return true;
  }

  function encodeSignal(value) {
    const bytes = TEXT_ENCODER.encode(JSON.stringify(value));
    return SIGNAL_PREFIX + bytesToBase64Url(bytes);
  }

  function decodeSignal(text) {
    const clean = text.trim().replace(/\s+/g, "");
    const payload = clean.startsWith(SIGNAL_PREFIX) ? clean.slice(SIGNAL_PREFIX.length) : clean;
    return JSON.parse(TEXT_DECODER.decode(base64UrlToBytes(payload)));
  }

  function bytesToBase64Url(bytes) {
    let binary = "";
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function base64UrlToBytes(value) {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  function makeRoomCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  }

  function makeRoomSecret() {
    const count = Math.max(2, Math.floor(numberOr(settings.security.roomSecretWords, 4)));
    const bytes = crypto.getRandomValues(new Uint8Array(count));
    return Array.from(bytes, (byte) => SECRET_WORDS[byte % SECRET_WORDS.length]).join("-");
  }

  function uid(length = 8) {
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  }

  function closeAllPeers() {
    for (const peer of runtime.peers.values()) closePeerConnection(peer);
    for (const peer of runtime.pending.values()) closePeerConnection(peer);
    runtime.peers.clear();
    runtime.pending.clear();
  }

  function closePeerConnection(peer) {
    peer?.pc?.close();
    peer?.conn?.close();
  }

  function destroyPeerJsInstance() {
    if (runtime.peerJs.instance) {
      runtime.peerJs.instance.destroy();
      runtime.peerJs.instance = null;
    }
    runtime.peerJs.mode = "";
  }

  function getHostPeer() {
    return Array.from(runtime.peers.values()).find((peer) => peer.host) || Array.from(runtime.peers.values())[0] || null;
  }

  function getPlayerName() {
    return cleanPlayerName(dom.playerNameInput?.value || "Player");
  }

  function cleanPlayerName(name) {
    const clean = String(name || "Player").replace(/\s+/g, " ").trim().slice(0, 28);
    return clean || "Player";
  }

  function getPlayerNameById(playerId) {
    return runtime.game.players.find((player) => player.id === playerId)?.name || "";
  }

  function playerColor(index) {
    const palette = settings.editor.palette || DEFAULT_SETTINGS.editor.palette;
    return palette[index % palette.length] || "#00c2ff";
  }

  function initials(name) {
    return cleanPlayerName(name).split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  }

  function fitRect(sourceWidth, sourceHeight, targetWidth, targetHeight, fit) {
    if (fit === "stretch") return { x: 0, y: 0, w: targetWidth, h: targetHeight };
    const scale = fit === "cover"
      ? Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight)
      : Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
    const w = sourceWidth * scale;
    const h = sourceHeight * scale;
    return {
      x: (targetWidth - w) / 2,
      y: (targetHeight - h) / 2,
      w,
      h
    };
  }

  function deepMerge(target, source) {
    if (!source || typeof source !== "object") return target;
    Object.keys(source).forEach((key) => {
      const value = source[key];
      if (Array.isArray(value)) {
        target[key] = value;
      } else if (value && typeof value === "object" && target[key] && typeof target[key] === "object" && !Array.isArray(target[key])) {
        target[key] = deepMerge(target[key], value);
      } else {
        target[key] = value;
      }
    });
    return target;
  }

  function structuredCloneSafe(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function numberOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function normalizeColor(value, fallback) {
    if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)) return value;
    return fallback || "#ffffff";
  }

  function baseName(path) {
    const name = String(path || "").split(/[\\/]/).pop() || "";
    return name.replace(/\.[^.]+$/, "");
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item";
  }

  function fontFamilyValue(name) {
    const safe = String(name || "Impact").replace(/["\\]/g, "");
    return `"${safe}", Impact, Arial Black, sans-serif`;
  }

  function dedupeFonts(fonts) {
    const seen = new Set();
    const result = [];
    fonts.forEach((font) => {
      const key = font.name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      result.push(font);
    });
    return result;
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function copyText(text, message) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast(message || "Copied.");
    } catch (error) {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
      showToast(message || "Copied.");
    }
  }

  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    document.body.append(toast);
    window.setTimeout(() => toast.remove(), 2600);
  }

  function logActivity(message) {
    runtime.logs.unshift({
      message,
      at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    });
    runtime.logs = runtime.logs.slice(0, 18);
    if (!dom.activityLog) return;
    dom.activityLog.textContent = "";
    runtime.logs.forEach((item) => {
      const row = document.createElement("div");
      row.className = "activity-item";
      row.textContent = `${item.at} ${item.message}`;
      dom.activityLog.append(row);
    });
  }
})();
