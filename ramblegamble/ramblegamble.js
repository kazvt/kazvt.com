import {
  resolvePointClickAction,
  resolvePointClickBack,
  resolvePointClickCursor,
  resolvePointClickZone,
  resolveArcadeShortcut,
} from "./point-click-routing.js?v=slot-machine-live-game-20261126-v1";
import { createQuestionPicker, readSessionQuestionBank } from "./question-bank.mjs?v=host-question-bank-session-20261118-v1";
import { DICE_DOOR_OPENING, isDiceDoorBackingTriangle } from "./dice-doorway.mjs?v=dice-door-wall-target-20261120-v1";
import { readPointScores, subscribePointScores, writePointScores } from "./points-store.mjs?v=points-console-20261120-v1";
import {
  createCssProjectiveQuad,
  LIQUID_PORTAL_HEIGHT,
  LIQUID_PORTAL_SOURCE,
  LIQUID_PORTAL_WIDTH,
} from "./liquid-portal.mjs?v=liquid-door-portal-20261120-v1";
import {
  createSlotReelMotion,
  normalizeSlotGrid,
  sampleSlotReelColumn,
  slotCellIndexAtUv,
  slotScreenPoint,
} from "./slot-reels.mjs?v=slot-machine-live-game-20261126-v1";
import { placeSlotBerry, resolveSlotPayouts, rotateSlotColumns, secureRandomIndex } from "./slot-game.mjs?v=slot-machine-live-game-20261126-v2";
import {
  ROULETTE_BALL_COLOR,
  ROULETTE_BALL_LANDING_RADIUS,
  ROULETTE_BALL_TRACK_RADIUS,
  rouletteBallPositionAtRadius,
  sampleRouletteBallRadius,
} from "./roulette-ball-motion.mjs?v=roulette-ball-inner-ring-20261125-v2";

(() => {
  "use strict";

  let THREE;
  let GLTFLoader;
  const preview = document.getElementById("rg-preview");
  const canvas = document.getElementById("rg-canvas");
  const liquidPortalLayer = document.getElementById("rg-liquid-portal-layer");
  const liquidPortalFrame = document.getElementById("rg-liquid-portal-frame");
  const billboardLayer = document.getElementById("rg-billboard-layer");
  const slotControlLayer = document.getElementById("rg-slot-control-layer");
  const gameCursor = document.getElementById("rg-game-cursor");
  const gameCursorImage = document.getElementById("rg-game-cursor-image");
  const pointsHud = document.getElementById("rg-points-hud");
  const loading = document.getElementById("rg-loading");
  const result = document.getElementById("rg-result");
  const readyScreen = document.getElementById("rg-ready-screen");
  const goButton = document.getElementById("rg-go");
  const pauseMenu = document.getElementById("rg-pause-menu");
  const menuMarquee = document.getElementById("rg-marquee-video");
  const marqueeStill = document.getElementById("rg-marquee-still");
  const playButton = document.getElementById("rg-play");
  const controlsOpenButton = document.getElementById("rg-controls-open");
  const controlsDialog = document.getElementById("rg-controls-dialog");
  const controlsCloseButton = document.getElementById("rg-controls-close");
  const cheerSound = new Audio("/ramblegamble/assets/sfx/cheer.ogg?v=audience-applause-2");
  cheerSound.preload = "auto";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  // Keep the supplied marquee cue, but play it at one fifth of its current level.
  menuMarquee.volume = Math.max(0, Math.min(1, menuMarquee.volume * 0.2));
  const FORCED_THEME = "p2";
  const ROULETTE_PART_NAMES = new Set(["center", "wheel", "rim", "ball"]);
  const SLOT_PART_NAMES = new Set(["machine", "slot-reel-display", "arm", "button1", "button2", "button3", "button4", "button5"]);
  const SLOT_GRID_STORAGE_KEY = "ramblegamble.slot-game-board.v1";
  const SLOT_DISPLAY_PIXELS = Object.freeze({ left: 5, right: 75, top: 16, bottom: 58 });
  const SLOT_SYMBOL_IMAGE_PATH = "/ramblegamble/assets/berries/";
  const REFERENCE_START_VIEW = Object.freeze({
    // Match the supplied reference's opposite-side oblique view and lower sightline.
    // Landscape screens keep the close crop; portrait screens ease out to retain hotspots.
    yaw: -0.38,
    elevation: 0.24,
    narrowDistanceScale: 0.95,
    wideDistanceScale: 0.52,
    wideAspect: 1.8,
    rightwardComposition: -0.01,
    raisedAimOffset: -0.55,
  });
  const ARCADE_REFERENCE_LAYOUT = Object.freeze({
    diceDoor: DICE_DOOR_OPENING,
    // The back-wall recess in rg_stage.gltf spans x=9.14..14.48 at z=-6.10.
    // A small size increase matches the reference cabinet while staying inside the recess.
    slotBay: Object.freeze({ left: 9.14, right: 14.48, wallZ: -6.10, height: 2.52, widthScale: 1.08, clearance: 0.025 }),
    // The raised stage's forward lip ends at z=0.06; keep the whole wheel
    // footprint beyond it, rather than merely moving its center off the stage.
    stageFrontZ: 0.06,
    rouletteCenterX: 15.0,
    rouletteScale: 0.13,
    rouletteClearance: 0.12,
    // Ease the wheel back a fraction from the previous rightward move, then
    // nudge it forward toward the recess; both offsets scale with the wheel.
    rouletteRightOffsetDiameters: 0.55,
    rouletteForwardOffsetDiameters: 0.22,
    // Normalized canvas point at the center of the red marked floor area.
    rouletteScreenAnchor: Object.freeze({ x: 0.60, y: 0.71 }),
  });
  const SKY_CONFIG = Object.freeze({
    radius: 260,
    // One instanced draw keeps a denser, full-sky field inexpensive to render.
    starCount: 1800,
    topColor: "#100818",
    // A blue-violet lavender, avoiding the dusty pink cast of the old horizon.
    horizonColor: "#865fd0",
  });
  const BILLBOARD_SOURCES = [
    { id: "faroe", label: "Faroe", source: "https://reactive.fugi.tech/basic/489548166316949513" },
    { id: "erin", label: "Erin", source: "https://reactive.fugi.tech/basic/205887066855178244" },
    { id: "kaz", label: "Kaz", source: "https://reactive.fugi.tech/basic/796834631961935893" },
  ];
  const HOST_BILLBOARD_SOURCE = {
    id: "lillie-host",
    label: "Lillie - Host",
    source: "https://reactive.fugi.tech/basic/185073584211755008",
  };
  const CURSOR_ASSETS = {
    default: "/ramblegamble/assets/cursors/pointer-default.gif",
    hover: "/ramblegamble/assets/cursors/pointer-hover.gif",
    direction: "/ramblegamble/assets/cursors/direction-right.gif",
  };
  let renderer;
  let scene;
  let camera;
  let raycaster;
  let pointer;
  let resizeObserver;
  let animationFrame = 0;
  let wheelPivot;
  let ballPivot;
  let ballOrbitObject;
  let lever;
  let rouletteRig;
  let slotRig;
  let cardTableModel;
  let skyRoot;
  let skyStars;
  let skyStarsMesh;
  let skyShootingStarsMesh;
  let skyShootingStars = [];
  let skyStarsInitialized = false;
  let rouletteTargets = [];
  let slotTargets = [];
  let cardTableTargets = [];
  let diceDoorTargets = [];
  let wheelMotion = null;
  let leverMotion = null;
  let slotReelMotion = null;
  let slotReelGrid = normalizeSlotGrid(null);
  let slotReelCanvas = null;
  let slotReelContext = null;
  let slotReelTexture = null;
  let slotReelDisplay = null;
  let slotControlTargets = new Map();
  const slotReelImages = new Map();
  let selectedSlotBerry = "kazberry";
  let slotPlacementControls = [];
  let slotHoverLine = null;
  let slotResultTimeout = 0;
  let slotResultToken = 0;
  const pickQuestion = createQuestionPicker();
  let playing = false;
  let gameStarted = false;
  let pauseMenuOpen = false;
  let marqueeVideoUnavailable = false;
  let sceneReady = false;
  let liquidPortalLoaded = false;
  let diceModeOpen = false;
  let diceModeVisibility = null;
  let stageModel;
  let rouletteModel;
  let slotsModel;
  const unlitMaterialCache = new WeakMap();
  let contestants = [];
  let hostBillboard = null;
  let billboards = [];
  let contestantTargets = [];
  let hostTargets = [];
  let currentView = { kind: "overview", look: 0 };
  let cameraTarget;
  let cameraTransition = null;
  let overviewCameraBounds = null;
  let cursorMode = "";
  let pendingCardGameMode = "";
  let skyRandomState = 0x4b415a56;

  function setLiquidPortalLoaded(shouldLoad) {
    if (!liquidPortalFrame || shouldLoad === liquidPortalLoaded) return;
    liquidPortalLoaded = shouldLoad;
    if (shouldLoad) liquidPortalFrame.src = LIQUID_PORTAL_SOURCE;
    else {
      liquidPortalFrame.removeAttribute("src");
      liquidPortalFrame.style.transform = "";
    }
  }

  function updateLiquidPortalProjection() {
    if (!liquidPortalLayer || !liquidPortalFrame) return;
    const active = gameStarted
      && !pauseMenuOpen
      && !diceModeOpen
      && currentView.kind === "dice-door";
    setLiquidPortalLoaded(active);
    if (!active || !camera || !sceneReady || preview.clientWidth < 1 || preview.clientHeight < 1) {
      liquidPortalLayer.hidden = true;
      return;
    }

    camera.updateMatrixWorld(true);
    const opening = ARCADE_REFERENCE_LAYOUT.diceDoor;
    const planeX = opening.wallX + 0.008;
    const worldCorners = [
      new THREE.Vector3(planeX, opening.maxY, opening.minZ),
      new THREE.Vector3(planeX, opening.maxY, opening.maxZ),
      new THREE.Vector3(planeX, opening.minY, opening.maxZ),
      new THREE.Vector3(planeX, opening.minY, opening.minZ),
    ];
    const previewBounds = preview.getBoundingClientRect();
    const corners = [];
    for (const worldCorner of worldCorners) {
      const cameraSpace = camera.worldToLocal(worldCorner.clone());
      const depth = -cameraSpace.z;
      if (depth <= camera.near || depth >= camera.far) {
        liquidPortalLayer.hidden = true;
        return;
      }
      const projected = worldCorner.project(camera);
      corners.push({
        x: (projected.x + 1) * 0.5 * previewBounds.width,
        y: (1 - projected.y) * 0.5 * previewBounds.height,
      });
    }

    const transform = createCssProjectiveQuad(LIQUID_PORTAL_WIDTH, LIQUID_PORTAL_HEIGHT, corners);
    if (!transform) {
      liquidPortalLayer.hidden = true;
      return;
    }
    liquidPortalFrame.style.transform = transform;
    liquidPortalLayer.hidden = false;
  }

  function nextSkyRandom() {
    skyRandomState = (Math.imul(skyRandomState, 1664525) + 1013904223) >>> 0;
    return skyRandomState / 4294967296;
  }

  function themeValue(name, fallback) {
    const value = getComputedStyle(document.body).getPropertyValue(name).trim();
    return value || fallback;
  }

  function applyTheme() {
    // Ramble Gamble is intentionally fixed to palette 2. Never read or write
    // the shared preference, so this page cannot affect other pages.
    document.documentElement.dataset.theme = FORCED_THEME;
    document.body.dataset.theme = FORCED_THEME;

    const color = themeValue("--bg", "#17213c");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = color;

    if (!scene) return;
    scene.background = new THREE.Color(SKY_CONFIG.topColor);
    const bgColor = new THREE.Color(color);
    const accentColor = new THREE.Color(themeValue("--pink", "#f599c6"));
    const blueColor = new THREE.Color(themeValue("--blue", "#4d6787"));
    scene.traverse((object) => {
      if (object.userData.rgFloor) object.material.color.copy(bgColor);
      if (object.userData.rgAccent) object.material.color.copy(accentColor);
      if (object.userData.rgSecondary) object.material.color.copy(blueColor);
    });
  }

  function nextHostQuestion() {
    return pickQuestion(readSessionQuestionBank());
  }

  function finishTurn() {
    const prompt = nextHostQuestion();
    slotResultToken += 1;
    window.clearTimeout(slotResultTimeout);
    slotResultTimeout = 0;
    result.textContent = prompt;
    result.hidden = !prompt;
    playing = false;
    preview.classList.remove("is-playing");
    window.dispatchEvent(new CustomEvent("rg:turn-finish", { detail: { prompt } }));
  }

  function beginTurn(machine) {
    if (playing) return false;
    playing = true;
    preview.classList.add("is-playing");
    hideResult();
    window.dispatchEvent(new CustomEvent("rg:turn-start", { detail: { machine } }));
    return true;
  }

  function hideResult() {
    slotResultToken += 1;
    window.clearTimeout(slotResultTimeout);
    slotResultTimeout = 0;
    result.hidden = true;
  }

  function showSlotPayout(totals) {
    const messages = Object.entries(totals)
      .filter(([, amount]) => amount > 0)
      .map(([name, amount]) => `${name.toUpperCase()} +${Number(amount).toLocaleString()}`);
    if (!messages.length) return;
    result.textContent = messages.join(" - ");
    result.hidden = false;
    const token = ++slotResultToken;
    window.clearTimeout(slotResultTimeout);
    slotResultTimeout = window.setTimeout(() => {
      if (token === slotResultToken) result.hidden = true;
      slotResultTimeout = 0;
    }, 3200);
  }

  function startWheelSpin() {
    if (!beginTurn("wheel")) return;
    if (!wheelPivot || !ballPivot) {
      wheelMotion = { started: performance.now(), duration: 700, wheelFrom: 0, wheelTo: 0, ballFrom: 0, ballTo: 0 };
      return;
    }
    const ballPosition = ballOrbitObject?.position;
    const ballRadiusFrom = ballPosition ? Math.hypot(ballPosition.x, ballPosition.z) : ROULETTE_BALL_TRACK_RADIUS;
    const ballPositionAtStart = ballPosition && rouletteBallPositionAtRadius(ballPosition, ballRadiusFrom);
    wheelMotion = {
      started: performance.now(),
      duration: reducedMotion.matches ? 650 : 3900,
      wheelFrom: wheelPivot.rotation.y,
      wheelTo: wheelPivot.rotation.y + (5 + Math.random() * 3) * Math.PI * 2 + Math.random() * Math.PI * 2,
      ballFrom: ballPivot.rotation.y,
      ballTo: ballPivot.rotation.y - (8 + Math.random() * 4) * Math.PI * 2 - Math.random() * Math.PI * 2,
      ballRadiusFrom,
      ballAngle: ballPositionAtStart ? Math.atan2(ballPositionAtStart.z, ballPositionAtStart.x) : Math.atan2(1, -13),
      ballHeight: ballPositionAtStart?.y ?? -7,
    };
  }

  function prepareRouletteBall() {
    if (!ballPivot) return;

    const orbitNodes = [];
    const ballMaterial = new THREE.MeshBasicMaterial({ color: ROULETTE_BALL_COLOR, fog: false });
    ballMaterial.toneMapped = false;
    ballPivot.traverse((object) => {
      if (object === ballPivot) return;
      if (Math.hypot(object.position.x, object.position.z) > 1) orbitNodes.push(object);
      if (object.isMesh) object.material = ballMaterial;
    });
    ballOrbitObject = orbitNodes.find((object) => String(object.name || "").toLowerCase() === "ball")
      || orbitNodes[0]
      || null;
    if (!ballOrbitObject) {
      console.warn("Could not find the roulette ball's authored orbit offset.");
      return;
    }
    const startingPosition = rouletteBallPositionAtRadius(ballOrbitObject.position, ROULETTE_BALL_LANDING_RADIUS);
    if (startingPosition) ballOrbitObject.position.set(startingPosition.x, startingPosition.y, startingPosition.z);
  }

  function startLeverPull() {
    return startSlotReelSpin([0, 1, 2, 3, 4], true);
  }

  function readSavedSlotGrid() {
    try { return normalizeSlotGrid(localStorage.getItem(SLOT_GRID_STORAGE_KEY)); }
    catch { return normalizeSlotGrid(null); }
  }

  function drawSlotSymbol(column, row, symbol, xOffset = 0, yOffset = 0) {
    if (!symbol || !slotReelContext) return;
    const image = slotReelImages.get(symbol);
    if (!image?.complete || !image.naturalWidth) return;
    const cellWidth = slotReelCanvas.width / 5;
    const cellHeight = slotReelCanvas.height / 3;
    const size = Math.min(cellWidth, cellHeight) * 0.82;
    const x = column * cellWidth + (cellWidth - size) / 2 + xOffset;
    const y = row * cellHeight + (cellHeight - size) / 2 + yOffset;
    slotReelContext.drawImage(image, x, y, size, size);
  }

  function drawSlotReelDisplay(time = performance.now()) {
    if (!slotReelContext || !slotReelTexture) return;
    const context = slotReelContext;
    const cellWidth = slotReelCanvas.width / 5;
    const cellHeight = slotReelCanvas.height / 3;
    context.clearRect(0, 0, slotReelCanvas.width, slotReelCanvas.height);

    for (let column = 0; column < 5; column += 1) {
      const motionColumn = slotReelMotion?.columns.find((entry) => entry.column === column);
      const frame = motionColumn ? sampleSlotReelColumn(motionColumn, slotReelMotion, time) : null;
      if (!motionColumn || !frame || frame.symbols) {
        const symbols = frame?.symbols || Array.from({ length: 3 }, (_, row) => slotReelGrid[row * 5 + column]);
        symbols.forEach((symbol, row) => drawSlotSymbol(column, row, symbol));
        continue;
      }

      context.save();
      context.beginPath();
      context.rect(column * cellWidth, 0, cellWidth, slotReelCanvas.height);
      context.clip();
      const wholeRows = Math.floor(frame.offset);
      const fractionalRow = frame.offset - wholeRows;
      for (let row = 0; row <= 3; row += 1) {
        const symbol = motionColumn.strip[wholeRows + row] || null;
        drawSlotSymbol(column, row, symbol, 0, -fractionalRow * cellHeight);
      }
      context.restore();
    }
    context.save();
    context.strokeStyle = "rgba(255, 242, 155, 0.62)";
    context.lineWidth = 3;
    context.beginPath();
    for (let column = 1; column < 5; column += 1) {
      context.moveTo(column * cellWidth, 0);
      context.lineTo(column * cellWidth, slotReelCanvas.height);
    }
    for (let row = 1; row < 3; row += 1) {
      context.moveTo(0, row * cellHeight);
      context.lineTo(slotReelCanvas.width, row * cellHeight);
    }
    if (slotHoverLine && !slotReelMotion && currentView.kind === "slot") {
      context.fillStyle = "rgba(255, 242, 155, 0.3)";
      if (slotHoverLine.axis === "row") context.fillRect(0, slotHoverLine.index * cellHeight, slotReelCanvas.width, cellHeight);
      else context.fillRect(slotHoverLine.index * cellWidth, 0, cellWidth, slotReelCanvas.height);
    }
    context.stroke();
    context.restore();
    slotReelTexture.needsUpdate = true;
  }

  function createSlotReelDisplay() {
    slotReelGrid = readSavedSlotGrid();
    slotReelCanvas = document.createElement("canvas");
    slotReelCanvas.width = 1000;
    slotReelCanvas.height = 600;
    slotReelContext = slotReelCanvas.getContext("2d", { alpha: true });
    slotReelContext.imageSmoothingEnabled = false;

    slotReelTexture = new THREE.CanvasTexture(slotReelCanvas);
    slotReelTexture.colorSpace = THREE.SRGBColorSpace;
    slotReelTexture.magFilter = THREE.NearestFilter;
    slotReelTexture.minFilter = THREE.NearestFilter;
    slotReelTexture.generateMipmaps = false;

    const { left, right, top, bottom } = SLOT_DISPLAY_PIXELS;
    const points = [
      slotScreenPoint(left, top, 0.065),
      slotScreenPoint(left, bottom, 0.065),
      slotScreenPoint(right, top, 0.065),
      slotScreenPoint(right, bottom, 0.065),
    ];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(
      points.flatMap(({ x, y, z }) => [x, y, z]),
      3,
    ));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute([
      0, 1,
      0, 0,
      1, 1,
      1, 0,
    ], 2));
    geometry.setIndex([0, 1, 2, 1, 3, 2]);
    geometry.computeVertexNormals();

    const material = new THREE.MeshBasicMaterial({
      map: slotReelTexture,
      transparent: true,
      alphaTest: 0.01,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    slotReelDisplay = new THREE.Mesh(geometry, material);
    slotReelDisplay.name = "slot-reel-display";
    slotReelDisplay.renderOrder = 1;
    slotReelDisplay.frustumCulled = false;
    slotsModel.add(slotReelDisplay);

    for (const symbol of ["faroeberry", "erinberry", "kazberry"]) {
      const image = new Image();
      image.decoding = "async";
      image.addEventListener("load", () => drawSlotReelDisplay());
      image.src = `${SLOT_SYMBOL_IMAGE_PATH}${symbol}.png`;
      slotReelImages.set(symbol, image);
    }
    drawSlotReelDisplay();
  }

  function slotWorldPoint(textureX, textureY, depth = 0.16) {
    const point = slotScreenPoint(textureX, textureY, depth);
    return slotsModel.localToWorld(new THREE.Vector3(point.x, point.y, point.z));
  }

  function createSlotPlacementControls() {
    if (!slotControlLayer || !slotsModel) return;
    slotRig.updateMatrixWorld(true);
    slotsModel.updateMatrixWorld(true);
    slotControlLayer.replaceChildren();
    slotPlacementControls = [];
    const { left, right, top, bottom } = SLOT_DISPLAY_PIXELS;
    const cellWidth = (right - left) / 5;
    const cellHeight = (bottom - top) / 3;
    const definitions = [
      ...Array.from({ length: 5 }, (_, index) => ({
        axis: "column",
        index,
        label: String(index + 1),
        x: left + (index + 0.5) * cellWidth,
        y: top - cellHeight * 0.54,
      })),
      ...Array.from({ length: 3 }, (_, index) => ({
        axis: "row",
        index,
        label: String.fromCharCode(65 + index),
        x: left - cellWidth * 0.54,
        y: top + (index + 0.5) * cellHeight,
      })),
    ];

    for (const definition of definitions) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "rg-slot-placement-marker";
      button.dataset.axis = definition.axis;
      button.dataset.index = String(definition.index);
      button.innerHTML = '<img alt="" aria-hidden="true" draggable="false"><span class="rg-slot-placement-index" aria-hidden="true">' + definition.label + "</span>";
      const image = button.querySelector("img");
      image.src = SLOT_SYMBOL_IMAGE_PATH + selectedSlotBerry + ".png";
      button.addEventListener("pointerenter", () => {
        slotHoverLine = { axis: definition.axis, index: definition.index };
        drawSlotReelDisplay();
        hideGameCursor();
      });
      button.addEventListener("pointerleave", () => {
        if (slotHoverLine?.axis === definition.axis && slotHoverLine.index === definition.index) {
          slotHoverLine = null;
          drawSlotReelDisplay();
        }
      });
      button.addEventListener("focus", () => {
        slotHoverLine = { axis: definition.axis, index: definition.index };
        drawSlotReelDisplay();
      });
      button.addEventListener("blur", () => {
        if (slotHoverLine?.axis === definition.axis && slotHoverLine.index === definition.index) {
          slotHoverLine = null;
          drawSlotReelDisplay();
        }
      });
      button.addEventListener("click", () => placeSlotBerryOnLine(definition.axis, definition.index));
      slotControlLayer.append(button);

      const anchor = slotWorldPoint(definition.x, definition.y);
      const worldWidth = slotWorldPoint(definition.x - cellWidth * 0.32, definition.y)
        .distanceTo(slotWorldPoint(definition.x + cellWidth * 0.32, definition.y));
      const worldHeight = slotWorldPoint(definition.x, definition.y - cellHeight * 0.27)
        .distanceTo(slotWorldPoint(definition.x, definition.y + cellHeight * 0.27));
      slotPlacementControls.push({ ...definition, anchor, button, image, worldWidth, worldHeight });
    }
    syncSlotPlacementControls();
  }

  function saveSlotGrid(grid) {
    slotReelGrid = normalizeSlotGrid(grid);
    try { localStorage.setItem(SLOT_GRID_STORAGE_KEY, JSON.stringify(slotReelGrid)); }
    catch (error) { console.warn("Ramble Gamble slot board could not be saved:", error); }
    window.dispatchEvent(new CustomEvent("rg:slot-grid-updated", { detail: { grid: slotReelGrid.slice() } }));
  }

  function startSlotAction(targetGrid, columns, { pullCrank = false, kind = "spin" } = {}) {
    if (playing || slotReelMotion) return false;
    const startedAt = performance.now();
    const startingGrid = readSavedSlotGrid();
    const settledGrid = normalizeSlotGrid(targetGrid);
    slotReelMotion = createSlotReelMotion(startingGrid, columns, {
      targetGrid: settledGrid,
      startedAt,
      duration: reducedMotion.matches ? 520 : 1950,
      stagger: reducedMotion.matches ? 55 : 120,
      reducedMotion: reducedMotion.matches,
    });
    if (!slotReelMotion) return false;
    slotReelMotion.action = kind;
    playing = true;
    preview.classList.add("is-playing");
    syncSlotPlacementControls();
    hideResult();
    if (pullCrank && lever) {
      leverMotion = {
        started: startedAt,
        duration: reducedMotion.matches ? 360 : 760,
        baseQuaternion: lever.quaternion.clone(),
      };
    }
    window.dispatchEvent(new CustomEvent("rg:slot-action-start", { detail: { kind } }));
    drawSlotReelDisplay(startedAt);
    return true;
  }

  function placeSlotBerryOnLine(axis, lineIndex) {
    if (playing || slotReelMotion || !["row", "column"].includes(axis)) return false;
    const placement = placeSlotBerry(readSavedSlotGrid(), selectedSlotBerry, {
      axis,
      index: lineIndex,
      randomIndex: secureRandomIndex,
    });
    if (placement.placedIndex < 0) {
      window.dispatchEvent(new CustomEvent("rg:slot-action-finish", { detail: { reason: "no-eligible-cell", totals: {} } }));
      return false;
    }
    return startSlotAction(placement.grid, [placement.placedIndex % 5], { kind: "place" });
  }

  function syncSlotPlacementControls() {
    if (!slotPlacementControls.length) return;
    const grid = readSavedSlotGrid();
    const berryNames = { faroeberry: "Faroeberry", erinberry: "Erinberry", kazberry: "Kazberry" };
    for (const control of slotPlacementControls) {
      control.image.src = SLOT_SYMBOL_IMAGE_PATH + selectedSlotBerry + ".png";
      const cells = control.axis === "column"
        ? Array.from({ length: 3 }, (_, row) => row * 5 + control.index)
        : Array.from({ length: 5 }, (_, column) => control.index * 5 + column);
      const available = cells.filter((cellIndex) => grid[cellIndex] !== selectedSlotBerry).length;
      const lineName = control.axis === "column" ? "column " + (control.index + 1) : "row " + control.label;
      control.button.disabled = Boolean(playing || slotReelMotion || available === 0);
      control.button.setAttribute("aria-label", "Place " + berryNames[selectedSlotBerry] + " in a random available cell in " + lineName + "; " + available + " available");
      control.button.title = "Place " + berryNames[selectedSlotBerry] + " in " + lineName + " (" + available + " available)";
      control.button.classList.toggle("is-unavailable", available === 0);
    }
  }

  function startSlotReelSpin(columns, pullCrank = false) {
    const startingGrid = readSavedSlotGrid();
    const spin = rotateSlotColumns(startingGrid, columns, { randomIndex: secureRandomIndex });
    return startSlotAction(spin.grid, Object.keys(spin.rotations).map(Number), {
      pullCrank,
      kind: pullCrank ? "spin-all" : "spin-column",
    });
  }

  function spinSlotColumn(column) {
    return startSlotReelSpin([column]);
  }

  function finishSlotAction(motion) {
    const outcome = resolveSlotPayouts(motion.targetGrid);
    saveSlotGrid(outcome.grid);
    const scores = readPointScores();
    for (const [name, amount] of Object.entries(outcome.totals)) {
      if (amount > 0) scores[name] = Math.min(Number.MAX_SAFE_INTEGER, scores[name] + amount);
    }
    if (Object.values(outcome.totals).some((amount) => amount > 0)) writePointScores(scores);
    playing = false;
    preview.classList.remove("is-playing");
    drawSlotReelDisplay();
    syncSlotPlacementControls();
    showSlotPayout(outcome.totals);
    window.dispatchEvent(new CustomEvent("rg:slot-action-finish", {
      detail: {
        kind: motion.action,
        payouts: outcome.payouts,
        totals: outcome.totals,
        clearedCells: outcome.clearedCells,
        grid: outcome.grid.slice(),
      },
    }));
  }

  applyTheme();

  function createWorld() {
    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2();
    cameraTarget = new THREE.Vector3();
    scene = new THREE.Scene();
    scene.background = new THREE.Color(SKY_CONFIG.topColor);

    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 320);
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = false;

    createSkybox();

    rouletteRig = new THREE.Group();
    rouletteRig.visible = !pauseMenuOpen;
    scene.add(rouletteRig);

    slotRig = new THREE.Group();
    slotRig.visible = !pauseMenuOpen;
    slotRig.rotation.y = Math.PI;
    scene.add(slotRig);

    resizeObserver = new ResizeObserver(fitCamera);
    resizeObserver.observe(preview);
    window.addEventListener("resize", fitCamera, { passive: true });
    fitCamera();
  }

  function createSkybox() {
    skyRoot = new THREE.Group();
    skyRoot.name = "rg-starry-sky";
    skyRoot.frustumCulled = false;

    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTopColor: { value: new THREE.Color(SKY_CONFIG.topColor) },
        uHorizonColor: { value: new THREE.Color(SKY_CONFIG.horizonColor) },
      },
      vertexShader: `
        varying float vSkyViewHeight;
        void main() {
          vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
          vSkyViewHeight = normalize(viewPosition.xyz).y;
          gl_Position = projectionMatrix * viewPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        varying float vSkyViewHeight;
        void main() {
          float height = smoothstep(-0.34, 0.38, vSkyViewHeight);
          vec3 sky = mix(uHorizonColor, uTopColor, height);
          gl_FragColor = vec4(sky, 1.0);
          #include <colorspace_fragment>
        }
      `,
      side: THREE.BackSide,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
    });
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(SKY_CONFIG.radius, 32, 20), skyMaterial);
    skyDome.name = "rg-sky-gradient";
    skyDome.frustumCulled = false;
    skyDome.renderOrder = -10000;
    skyRoot.add(skyDome);

    const starCount = SKY_CONFIG.starCount;
    const starPalette = ["#fff0d2", "#eee3ff", "#dceeff"].map((color) => new THREE.Color(color));
    skyStars = Array.from({ length: starCount }, () => {
      return {
        direction: null,
        phase: nextSkyRandom() * Math.PI * 2,
        rate: 0.11 + nextSkyRandom() * 0.12,
        size: 2.0 + nextSkyRandom() * 1.9,
        color: starPalette[Math.floor(nextSkyRandom() * starPalette.length)]
          .clone()
          .multiplyScalar(0.58 + nextSkyRandom() * 0.48),
      };
    });

    const starMaterial = new THREE.MeshBasicMaterial({
      map: createPixelCircleTexture(),
      color: 0xffffff,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const starMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), starMaterial, starCount);
    starMesh.name = "rg-pixel-twinkle-stars";
    starMesh.frustumCulled = false;
    starMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let index = 0; index < starCount; index += 1) starMesh.setColorAt(index, skyStars[index].color);
    if (starMesh.instanceColor) starMesh.instanceColor.needsUpdate = true;
    starMesh.renderOrder = -9998;
    skyRoot.add(starMesh);
    skyStarsMesh = starMesh;

    createShootingStars();
    scene.add(skyRoot);
  }

  function createPixelCircleTexture() {
    const size = 8;
    const pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const distanceSquared = (x - 3.5) ** 2 + (y - 3.5) ** 2;
        if (distanceSquared > 10.5) continue;
        const offset = (y * size + x) * 4;
        pixels[offset] = 255;
        pixels[offset + 1] = 255;
        pixels[offset + 2] = 255;
        pixels[offset + 3] = 255;
      }
    }
    const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  }

  function createPixelShootingStarTexture() {
    const width = 40;
    const height = 8;
    const pixels = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const headX = width - 7;
        const headDistance = ((x - headX) / 4.1) ** 2 + ((y - 3.5) / 2.5) ** 2;
        let alpha = headDistance <= 1 ? 255 : 0;
        const tailStrength = x / headX;
        if ((y === 3 || y === 4) && x < headX) {
          alpha = Math.max(alpha, Math.round(175 * (0.12 + 0.88 * tailStrength)));
        } else if (x < headX && (y === 2 || y === 5) && (x * 3 + y * 5) % 9 === 0) {
          alpha = Math.max(alpha, Math.round(112 * (0.12 + 0.88 * tailStrength)));
        }
        if (alpha === 0) continue;
        const offset = (y * width + x) * 4;
        pixels[offset] = 255;
        pixels[offset + 1] = 248;
        pixels[offset + 2] = 232;
        pixels[offset + 3] = alpha;
      }
    }
    const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  }

  function createShootingStars() {
    const count = 4;
    const shootingMaterial = new THREE.MeshBasicMaterial({
      map: createPixelShootingStarTexture(),
      color: 0xffffff,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    skyShootingStarsMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), shootingMaterial, count);
    skyShootingStarsMesh.name = "rg-pixel-shooting-stars";
    skyShootingStarsMesh.frustumCulled = false;
    skyShootingStarsMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    skyShootingStarsMesh.renderOrder = -9997;
    skyRoot.add(skyShootingStarsMesh);

    skyShootingStars = Array.from({ length: count }, (_, index) => ({
      index,
      start: null,
      end: null,
      startedAt: 0,
      duration: 3000,
      // Defer scheduling until the sky is actually animating; the READY screen
      // can remain open for an arbitrary time before the pause menu starts.
      nextAt: 0,
      active: false,
      angle: 0,
      length: 88,
      thickness: 8,
      tint: new THREE.Color(["#fff0de", "#e9e2ff", "#dce8ff"][index % 3]),
    }));
  }

  function initializeSkyStars() {
    if (skyStarsInitialized || !camera || !skyStars) return;
    for (const star of skyStars) {
      // Uniformly distribute directions over the whole dome, rather than
      // placing stars in a camera-relative strip above the view center.
      const vertical = nextSkyRandom() * 2 - 1;
      const azimuth = nextSkyRandom() * Math.PI * 2;
      const horizontal = Math.sqrt(1 - vertical * vertical);
      star.direction = new THREE.Vector3(
        Math.cos(azimuth) * horizontal,
        vertical,
        Math.sin(azimuth) * horizontal,
      );
    }
    skyStarsInitialized = true;
  }

  function makeShootingStarPath() {
    camera.updateMatrixWorld(true);
    const forward = camera.getWorldDirection(new THREE.Vector3());
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    const viewUp = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    const horizontalRange = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    const verticalRange = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const horizontalStart = (nextSkyRandom() * 2 - 1) * horizontalRange * 0.76;
    const verticalStart = (nextSkyRandom() * 2 - 1) * verticalRange * 0.72;
    const start = forward
      .addScaledVector(right, horizontalStart)
      .addScaledVector(viewUp, verticalStart)
      .normalize();
    const travelDirection = nextSkyRandom() < 0.5 ? -1 : 1;
    const horizontalTravel = travelDirection * (0.15 + nextSkyRandom() * 0.22);
    const verticalTravel = (nextSkyRandom() < 0.72 ? -1 : 1) * (0.035 + nextSkyRandom() * 0.13);
    const end = start.clone()
      .addScaledVector(right, horizontalTravel)
      .addScaledVector(viewUp, verticalTravel)
      .normalize();
    return {
      start: start.multiplyScalar(SKY_CONFIG.radius - 2),
      end: end.multiplyScalar(SKY_CONFIG.radius - 2),
      angle: Math.atan2(verticalTravel, horizontalTravel),
      length: 78 + nextSkyRandom() * 72,
      thickness: 7 + nextSkyRandom() * 4,
      tint: new THREE.Color(["#fff0dc", "#e9e1ff", "#dae5ff"][Math.floor(nextSkyRandom() * 3)]),
    };
  }

  function updateSkyAnimations(time) {
    if (!skyRoot || !camera) return;
    initializeSkyStars();
    skyRoot.position.copy(camera.position);

    const reduced = reducedMotion.matches;
    const cssHeight = Math.max(1, preview.clientHeight);
    const worldPerPixel = (2 * (SKY_CONFIG.radius - 2) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / cssHeight;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const pixelQuaternion = camera.quaternion;
    const seconds = time * 0.001;

    if (skyStars) {
      for (let index = 0; index < skyStars.length; index += 1) {
        const star = skyStars[index];
        const pulse = reduced ? 0.5 : 0.5 - 0.5 * Math.cos((seconds * star.rate + star.phase / (Math.PI * 2)) * Math.PI * 2);
        const size = star.size * (0.80 + 0.52 * pulse) * worldPerPixel;
        position.copy(star.direction).multiplyScalar(SKY_CONFIG.radius - 1.4);
        scale.set(size, size, 1);
        matrix.compose(position, pixelQuaternion, scale);
        skyStarsMesh.setMatrixAt(index, matrix);
      }
      skyStarsMesh.instanceMatrix.needsUpdate = true;
    }

    if (!skyShootingStarsMesh) return;
    const roll = new THREE.Quaternion();
    const rotation = new THREE.Quaternion();
    const worldZ = new THREE.Vector3(0, 0, 1);
    const color = new THREE.Color();

    for (const star of skyShootingStars) {
      if (reduced) {
        scale.set(0, 0, 0);
        matrix.compose(position.set(0, 0, 0), pixelQuaternion, scale);
        skyShootingStarsMesh.setMatrixAt(star.index, matrix);
        skyShootingStarsMesh.setColorAt(star.index, color.setRGB(0, 0, 0));
        continue;
      }

      if (!star.active && star.nextAt === 0) {
        star.nextAt = time + 1400 + star.index * 2300 + nextSkyRandom() * 1000;
      }

      if (!star.active && time >= star.nextAt) {
        const path = makeShootingStarPath();
        star.start = path.start;
        star.end = path.end;
        star.angle = path.angle;
        star.length = path.length;
        star.thickness = path.thickness;
        star.tint = path.tint;
        star.startedAt = time;
        star.duration = 2600 + nextSkyRandom() * 1500;
        star.active = true;
      }

      if (!star.active) {
        scale.set(0, 0, 0);
        matrix.compose(position.set(0, 0, 0), pixelQuaternion, scale);
        skyShootingStarsMesh.setMatrixAt(star.index, matrix);
        skyShootingStarsMesh.setColorAt(star.index, color.setRGB(0, 0, 0));
        continue;
      }

      const progress = Math.min(1, (time - star.startedAt) / star.duration);
      // Start with a quick dart, then ease into a softer disappearing tail.
      const eased = 1 - (1 - progress) ** 2.1;
      position.lerpVectors(star.start, star.end, eased);
      roll.setFromAxisAngle(worldZ, star.angle);
      rotation.copy(pixelQuaternion).multiply(roll);
      const fadeIn = Math.min(1, progress / 0.08);
      const fadeOut = 1 - Math.max(0, (progress - 0.64) / 0.36);
      const glint = 0.92 + 0.08 * Math.sin(progress * Math.PI * 5);
      const fade = fadeIn * fadeOut * glint * 0.9;
      scale.set(star.length * worldPerPixel, star.thickness * worldPerPixel, 1);
      matrix.compose(position, rotation, scale);
      skyShootingStarsMesh.setMatrixAt(star.index, matrix);
      skyShootingStarsMesh.setColorAt(star.index, color.copy(star.tint).multiplyScalar(fade));
      if (progress >= 1) {
        star.active = false;
        star.nextAt = time + 14000 + nextSkyRandom() * 14000;
      }
    }
    skyShootingStarsMesh.instanceMatrix.needsUpdate = true;
    if (skyShootingStarsMesh.instanceColor) skyShootingStarsMesh.instanceColor.needsUpdate = true;
  }

  function fitCamera() {
    if (!camera || !renderer) return;
    const width = Math.max(1, preview.clientWidth);
    const height = Math.max(1, preview.clientHeight);
    const aspect = width / height;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setSize(width, height, false);
    if (!sceneReady) return;

    const pose = getCameraPoseForView(currentView, aspect);
    if (!pose) return;
    if (cameraTransition) {
      cameraTransition.toPosition.copy(pose.position);
      cameraTransition.toTarget.copy(pose.target);
    } else {
      applyCameraPose(pose);
    }
  }

  function getCameraPoseForView(view, aspect) {
    const bounds = getViewBounds(view);
    if (bounds.isEmpty()) return null;
    const target = bounds.getCenter(new THREE.Vector3());
    // The Dice entrance is on the room's right-hand wall, so approach it from
    // inside the room along the X axis instead of aiming at the rear wall.
    const yaw = (view.kind === "dice-door" ? -Math.PI / 2 : REFERENCE_START_VIEW.yaw) - view.look * 0.42;
    // The roulette interaction is best inspected from above, like looking down
    // at a real table. Keep the room and every other close-up at the authored angle.
    // Preserve the reference's elevated oblique view instead of a near-vertical map view.
    const elevation = view.kind === "roulette" ? 0.86 : REFERENCE_START_VIEW.elevation;
    const horizontal = Math.sqrt(1 - elevation * elevation);
    const direction = new THREE.Vector3(
      Math.sin(yaw) * horizontal,
      elevation,
      Math.cos(yaw) * horizontal,
    ).normalize();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(worldUp, direction).normalize();
    const viewUp = new THREE.Vector3().crossVectors(direction, right).normalize();
    const wideComposition = view.kind === "overview"
      ? THREE.MathUtils.smoothstep(aspect, 1, REFERENCE_START_VIEW.wideAspect)
      : 0;
    if (wideComposition > 0) {
      const boundsWidth = bounds.getSize(new THREE.Vector3()).x;
      target.addScaledVector(right, -boundsWidth * REFERENCE_START_VIEW.rightwardComposition * wideComposition);
      target.y += REFERENCE_START_VIEW.raisedAimOffset * wideComposition;
    }
    const tanHalfVertical = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const tanHalfHorizontal = tanHalfVertical * aspect;
    let distance = 0;

    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          const relative = new THREE.Vector3(x, y, z).sub(target);
          const depth = relative.dot(direction);
          distance = Math.max(
            distance,
            Math.abs(relative.dot(right)) / tanHalfHorizontal + depth,
            Math.abs(relative.dot(viewUp)) / tanHalfVertical + depth,
          );
        }
      }
    }

    const overviewDistanceScale = view.kind === "overview"
      ? THREE.MathUtils.lerp(
        REFERENCE_START_VIEW.narrowDistanceScale,
        REFERENCE_START_VIEW.wideDistanceScale,
        wideComposition,
      )
      : 1;
    distance = Math.max(distance, 1)
      * (view.kind === "overview" ? 1.14 : 1.18)
      * overviewDistanceScale;
    return { target, position: target.clone().addScaledVector(direction, distance) };
  }

  function getViewBounds(view) {
    const bounds = new THREE.Box3().makeEmpty();
    scene?.updateMatrixWorld(true);

    if (view.kind === "overview") return getArcadeBounds();
    if (view.kind === "dice-door") {
      const opening = ARCADE_REFERENCE_LAYOUT.diceDoor;
      const interactionX = opening.wallX - opening.interactionOffset;
      bounds.set(
        new THREE.Vector3(interactionX, opening.minY, opening.minZ),
        new THREE.Vector3(interactionX, opening.maxY, opening.maxZ),
      );
      return bounds.expandByScalar(0.18);
    }
    if (view.kind === "contestants") return getContestantsBounds();
    if (view.kind === "contestant") {
      const contestant = contestants.find((entry) => entry.id === view.contestantId);
      if (!contestant) return getContestantsBounds();
      bounds.expandByObject(contestant.hitProxy);
      addBillboardBounds(bounds, contestant);
      return bounds.expandByScalar(0.22);
    }
    if (view.kind === "host" && hostBillboard) {
      bounds.expandByObject(hostBillboard.hitProxy);
      addBillboardBounds(bounds, hostBillboard);
      return bounds.expandByScalar(0.22);
    }
    if (view.kind === "slot" && slotsModel) {
      bounds.setFromObject(slotsModel);
      return bounds.expandByScalar(0.35);
    }
    if (view.kind === "roulette" && rouletteRig) {
      bounds.setFromObject(rouletteRig);
      return bounds.expandByScalar(0.38);
    }
    if (view.kind === "card-table" && cardTableModel) {
      bounds.setFromObject(cardTableModel);
      return bounds.expandByScalar(0.48);
    }

    return getArcadeBounds();
  }

  function getContestantsBounds() {
    const bounds = new THREE.Box3().makeEmpty();
    for (const contestant of contestants) {
      bounds.expandByObject(contestant.hitProxy);
      addBillboardBounds(bounds, contestant);
    }
    return bounds.expandByScalar(0.25);
  }

  function addBillboardBounds(bounds, contestant) {
    const halfWidth = contestant.worldWidth / 2;
    const halfHeight = contestant.worldHeight / 2;
    const { x, y, z } = contestant.anchor;
    bounds.expandByPoint(new THREE.Vector3(x - halfWidth, y - halfHeight, z));
    bounds.expandByPoint(new THREE.Vector3(x + halfWidth, y + halfHeight, z));
  }

  function applyCameraPose(pose) {
    camera.position.copy(pose.position);
    cameraTarget.copy(pose.target);
    camera.lookAt(cameraTarget);
    camera.updateMatrixWorld(true);
  }

  function transitionToView(nextView, { immediate = false } = {}) {
    currentView = { ...nextView, look: nextView.look ?? 0 };
    const pose = getCameraPoseForView(currentView, camera.aspect);
    if (!pose) return;

    if (immediate || reducedMotion.matches || !sceneReady) {
      cameraTransition = null;
      applyCameraPose(pose);
      return;
    }

    cameraTransition = {
      started: performance.now(),
      duration: 380,
      fromPosition: camera.position.clone(),
      fromTarget: cameraTarget.clone(),
      toPosition: pose.position,
      toTarget: pose.target,
    };
  }

  function setLookDirection(look) {
    if (currentView.look === look) return;
    transitionToView({ ...currentView, look });
  }

  function canGoBack() {
    return Boolean(resolvePointClickBack(currentView));
  }

  function goBack() {
    const destination = resolvePointClickBack(currentView);
    if (destination) transitionToView(destination);
  }

  function getArcadeBounds() {
    if (overviewCameraBounds) return overviewCameraBounds.clone();
    const bounds = new THREE.Box3().makeEmpty();
    const table = stageModel?.getObjectByName("table");
    if (!table) {
      if (stageModel) bounds.expandByObject(stageModel);
      return bounds;
    }

    scene.updateMatrixWorld(true);
    const tableBounds = new THREE.Box3().setFromObject(table);
    const tableCenter = tableBounds.getCenter(new THREE.Vector3());
    bounds.union(tableBounds);

    // Keep the nearby seating in frame so the new machine placement reads as
    // part of the supplied set rather than as objects floating in isolation.
    stageModel.traverse((object) => {
      if (!/^(chair|tall_chair)$/i.test(normalizeNodeName(object.name))) return;
      const chairBounds = new THREE.Box3().setFromObject(object);
      if (chairBounds.isEmpty()) return;
      const chairCenter = chairBounds.getCenter(new THREE.Vector3());
      const distance = Math.hypot(chairCenter.x - tableCenter.x, chairCenter.z - tableCenter.z);
      if (distance < 2.2) bounds.union(chairBounds);
    });

    if (hostBillboard) {
      bounds.expandByObject(hostBillboard.chair);
      addBillboardBounds(bounds, hostBillboard);
    }

    if (rouletteRig) bounds.expandByObject(rouletteRig);
    if (slotRig) bounds.expandByObject(slotRig);
    return bounds;
  }

  function moveRouletteToMarkedFloorSpot(floorY) {
    const { x, y } = ARCADE_REFERENCE_LAYOUT.rouletteScreenAnchor;
    const rect = canvas.getBoundingClientRect();
    if (!camera || !rouletteRig || rect.width < 1 || rect.height < 1) return;

    pointer.set(x * 2 - 1, 1 - y * 2);
    raycaster.setFromCamera(pointer, camera);
    const ray = raycaster.ray;
    if (Math.abs(ray.direction.y) < 1e-5) return;
    const distance = (floorY - ray.origin.y) / ray.direction.y;
    if (!Number.isFinite(distance) || distance <= 0) return;

    // The red mark identifies the roulette unit's floor footprint, not its raised top.
    const floorPoint = ray.at(distance, new THREE.Vector3());
    const currentBounds = new THREE.Box3().setFromObject(rouletteRig);
    const currentCenter = currentBounds.getCenter(new THREE.Vector3());
    rouletteRig.position.x += floorPoint.x - currentCenter.x;
    rouletteRig.position.z += floorPoint.z - currentCenter.z;
    rouletteRig.updateMatrixWorld(true);

    // Move along the close-up camera's horizontal screen-right axis. That maps
    // the red-arrow direction into the room without changing the wheel's size
    // or elevation. Then ease it forward toward the recess while preserving
    // the stage clearance from the earlier off-stage requirement.
    const wheelDiameter = rouletteRig.userData.referenceBounds?.diameter || 0;
    const screenRightOffset = wheelDiameter * ARCADE_REFERENCE_LAYOUT.rouletteRightOffsetDiameters;
    const yaw = REFERENCE_START_VIEW.yaw;
    rouletteRig.position.x += Math.cos(yaw) * screenRightOffset;
    rouletteRig.position.z -= Math.sin(yaw) * screenRightOffset;
    rouletteRig.updateMatrixWorld(true);

    const requiredStageGap = ARCADE_REFERENCE_LAYOUT.stageFrontZ + ARCADE_REFERENCE_LAYOUT.rouletteClearance;
    const afterRightBounds = new THREE.Box3().setFromObject(rouletteRig);
    const requestedForwardOffset = wheelDiameter * ARCADE_REFERENCE_LAYOUT.rouletteForwardOffsetDiameters;
    const maxForwardOffset = Math.max(0, (afterRightBounds.min.z - requiredStageGap) / Math.cos(yaw));
    const forwardOffset = Math.min(requestedForwardOffset, maxForwardOffset);
    rouletteRig.position.x -= Math.sin(yaw) * forwardOffset;
    rouletteRig.position.z -= Math.cos(yaw) * forwardOffset;
    rouletteRig.updateMatrixWorld(true);

    const placedBounds = new THREE.Box3().setFromObject(rouletteRig);
    if (placedBounds.min.z < requiredStageGap - 0.001) {
      throw new Error("The right-and-forward roulette adjustment crossed the stage clearance.");
    }
    rouletteRig.userData.referenceBounds = {
      min: placedBounds.min.toArray(),
      max: placedBounds.max.toArray(),
      diameter: Math.max(placedBounds.getSize(new THREE.Vector3()).x, placedBounds.getSize(new THREE.Vector3()).z),
    };
  }

  function normalizeNodeName(name) {
    return String(name || "").toLowerCase().replace(/(?:[._]\d+)+$/, "");
  }

  function placeMachinesFromStage() {
    const table = stageModel?.getObjectByName("table");
    if (!table || !rouletteModel || !slotsModel) {
      throw new Error("The supplied stage is missing the table or machine model.");
    }

    scene.updateMatrixWorld(true);
    const tableBounds = new THREE.Box3().setFromObject(table);
    const floorY = tableBounds.min.y;

    // Position the roulette by its transformed footprint. The supplied stage
    // deck ends at z=0.06, so the nearest wheel edge gets a real clearance gap.
    rouletteRig.position.set(0, 0, 0);
    rouletteModel.scale.setScalar(ARCADE_REFERENCE_LAYOUT.rouletteScale);
    rouletteModel.position.set(0, 0, 0);
    rouletteRig.updateMatrixWorld(true);
    rouletteModel.updateMatrixWorld(true);
    const rouletteLocalBounds = new THREE.Box3().setFromObject(rouletteModel);
    const rouletteLocalCenter = rouletteLocalBounds.getCenter(new THREE.Vector3());
    const rouletteBoundsSize = rouletteLocalBounds.getSize(new THREE.Vector3());
    rouletteRig.position.set(
      ARCADE_REFERENCE_LAYOUT.rouletteCenterX - rouletteLocalCenter.x,
      floorY - rouletteLocalBounds.min.y,
      ARCADE_REFERENCE_LAYOUT.stageFrontZ + ARCADE_REFERENCE_LAYOUT.rouletteClearance - rouletteLocalBounds.min.z,
    );
    rouletteRig.updateMatrixWorld(true);
    const rouletteBounds = new THREE.Box3().setFromObject(rouletteModel);
    if (rouletteBounds.min.z < ARCADE_REFERENCE_LAYOUT.stageFrontZ + ARCADE_REFERENCE_LAYOUT.rouletteClearance - 0.001) {
      throw new Error("The roulette footprint overlaps the raised stage clearance zone.");
    }

    // Place the cabinet in the actual recessed back-wall bay, not under the
    // floating sign. Size it from the reference proportions, then align its
    // rear face to the wall and ground its base to the room floor.
    slotsModel.scale.setScalar(1);
    slotsModel.position.set(0, 0, 0);
    slotRig.position.set(0, 0, 0);
    slotRig.updateMatrixWorld(true);
    const slotSourceBounds = new THREE.Box3().setFromObject(slotsModel);
    const slotSourceSize = slotSourceBounds.getSize(new THREE.Vector3());
    const slotScale = ARCADE_REFERENCE_LAYOUT.slotBay.height / slotSourceSize.y;
    slotsModel.scale.set(slotScale * ARCADE_REFERENCE_LAYOUT.slotBay.widthScale, slotScale, slotScale);
    slotRig.updateMatrixWorld(true);
    slotsModel.updateMatrixWorld(true);
    const slotBounds = new THREE.Box3().setFromObject(slotsModel);
    const slotCenter = slotBounds.getCenter(new THREE.Vector3());
    const slotSize = slotBounds.getSize(new THREE.Vector3());
    const slotTargetCenter = new THREE.Vector3(
      (ARCADE_REFERENCE_LAYOUT.slotBay.left + ARCADE_REFERENCE_LAYOUT.slotBay.right) / 2,
      floorY,
      ARCADE_REFERENCE_LAYOUT.slotBay.wallZ + slotSize.z / 2 + ARCADE_REFERENCE_LAYOUT.slotBay.clearance,
    );
    slotRig.position.set(
      slotTargetCenter.x - slotCenter.x,
      floorY - slotBounds.min.y,
      slotTargetCenter.z - slotCenter.z,
    );
    slotRig.updateMatrixWorld(true);
    const placedSlotBounds = new THREE.Box3().setFromObject(slotsModel);
    const slotBayWidth = ARCADE_REFERENCE_LAYOUT.slotBay.right - ARCADE_REFERENCE_LAYOUT.slotBay.left;
    if (placedSlotBounds.getSize(new THREE.Vector3()).x >= slotBayWidth) {
      throw new Error("The slot cabinet no longer fits inside the supplied wall recess.");
    }

    // Keep a concise runtime record available for geometry-based verification.
    rouletteRig.userData.referenceBounds = {
      min: rouletteBounds.min.toArray(),
      max: rouletteBounds.max.toArray(),
      diameter: Math.max(rouletteBoundsSize.x, rouletteBoundsSize.z),
    };
    slotRig.userData.referenceBounds = {
      min: placedSlotBounds.min.toArray(),
      max: placedSlotBounds.max.toArray(),
      bay: { left: ARCADE_REFERENCE_LAYOUT.slotBay.left, right: ARCADE_REFERENCE_LAYOUT.slotBay.right, wallZ: ARCADE_REFERENCE_LAYOUT.slotBay.wallZ },
    };
  }

  function prepareModel(root) {
    root.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = false;
      object.receiveShadow = false;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (material?.map) {
          material.map.colorSpace = THREE.SRGBColorSpace;
          material.map.magFilter = THREE.NearestFilter;
          material.map.minFilter = THREE.NearestMipmapLinearFilter;
          material.map.generateMipmaps = true;
          material.map.needsUpdate = true;
        }
      }
      object.material = Array.isArray(object.material)
        ? materials.map(toUnlitMaterial)
        : toUnlitMaterial(materials[0]);
    });
  }

  function carveDiceDoorway(root) {
    scene.updateMatrixWorld(true);
    let removedTriangles = 0;

    root.traverse((object) => {
      if (!object.isMesh || !object.geometry?.index) return;
      const geometry = object.geometry;
      const position = geometry.getAttribute("position");
      const index = geometry.index;
      if (!position || index.count < 3) return;

      const keptIndices = [];
      let removedHere = 0;
      for (let offset = 0; offset + 2 < index.count; offset += 3) {
        const points = [0, 1, 2].map((corner) =>
          new THREE.Vector3()
            .fromBufferAttribute(position, index.getX(offset + corner))
            .applyMatrix4(object.matrixWorld)
        );
        if (isDiceDoorBackingTriangle(points, ARCADE_REFERENCE_LAYOUT.diceDoor)) {
          removedHere += 1;
          continue;
        }
        keptIndices.push(index.getX(offset), index.getX(offset + 1), index.getX(offset + 2));
      }

      if (removedHere) {
        geometry.setIndex(keptIndices);
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        object.userData.diceDoorBackingTrianglesRemoved = removedHere;
        removedTriangles += removedHere;
      }
    });

    root.userData.diceDoorBackingTrianglesRemoved = removedTriangles;
    if (removedTriangles !== 2) {
      console.warn(`Expected to open the two backing triangles inside the right-wall dice doorway, removed ${removedTriangles}.`);
    }
    return removedTriangles;
  }

  function toUnlitMaterial(material) {
    if (!material) return material;
    const cached = unlitMaterialCache.get(material);
    if (cached) return cached;

    // Keep the authored base-color texture and alpha behavior, but remove all
    // lighting-dependent maps and physically based response from the models.
    const unlit = new THREE.MeshBasicMaterial({
      name: material.name,
      color: material.color,
      map: material.map,
      alphaMap: material.alphaMap,
      alphaTest: material.alphaTest,
      opacity: material.opacity,
      transparent: material.transparent,
      side: material.side,
      vertexColors: material.vertexColors,
      depthTest: material.depthTest,
      depthWrite: material.depthWrite,
      blending: material.blending,
      fog: false,
    });
    unlit.toneMapped = false;
    unlit.userData = { ...material.userData };
    unlitMaterialCache.set(material, unlit);
    material.dispose();
    return unlit;
  }

  function setupPicking() {
    rouletteTargets = [];
    slotTargets = [];
    slotControlTargets = new Map();
    cardTableTargets = [];
    diceDoorTargets = [];
    contestantTargets = [];
    hostTargets = [];
    contestants = [];
    hostBillboard = null;
    billboards = [];
    billboardLayer?.replaceChildren();
    rouletteModel?.traverse((object) => {
      if (object.isMesh) rouletteTargets.push(object);
    });
    slotsModel?.traverse((object) => {
      if (object.isMesh) slotTargets.push(object);
      const name = String(object.name || "").toLowerCase();
      if (name === "arm" || /^button[1-5]$/.test(name)) slotControlTargets.set(name, object);
    });
    cardTableModel = stageModel?.getObjectByName("table") || null;
    cardTableModel?.traverse((object) => {
      if (object.isMesh) cardTableTargets.push(object);
    });
    setupDiceDoorTarget();
    setupContestants();
  }

  function setupDiceDoorTarget() {
    const opening = ARCADE_REFERENCE_LAYOUT.diceDoor;
    const target = new THREE.Mesh(
      new THREE.PlaneGeometry(opening.maxZ - opening.minZ, opening.maxY - opening.minY),
      new THREE.MeshBasicMaterial({
        colorWrite: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    target.name = "point-click-dice-door";
    target.rotation.y = Math.PI / 2;
    target.position.set(
      opening.wallX - opening.interactionOffset,
      (opening.minY + opening.maxY) / 2,
      (opening.minZ + opening.maxZ) / 2,
    );
    target.userData.machine = "dice-door";
    target.frustumCulled = false;
    scene.add(target);
    diceDoorTargets.push(target);
  }

  function createBillboardPanel(source, kind) {
    const panel = document.createElement("div");
    panel.className = source.source ? "rg-billboard rg-billboard-live" : "rg-billboard";
    panel.dataset[kind] = source.id;
    panel.setAttribute("aria-label", `${source.label} browser-source billboard`);

    if (source.source) {
      const iframe = document.createElement("iframe");
      iframe.src = source.source;
      iframe.title = `${source.label} live browser source`;
      iframe.loading = "eager";
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
      iframe.tabIndex = -1;
      panel.append(iframe);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "rg-billboard-placeholder";
      placeholder.append(document.createTextNode(source.label));
      const pending = document.createElement("small");
      pending.textContent = "SOURCE PENDING";
      placeholder.append(pending);
      panel.append(placeholder);
    }

    billboardLayer.append(panel);
    return panel;
  }

  function findSeatSurfaceCenterLocal(chair) {
    const position = chair.geometry?.getAttribute("position");
    if (!position) return null;

    const index = chair.geometry.index;
    const vertexCount = index ? index.count : position.count;
    const planes = new Map();
    for (let offset = 0; offset + 2 < vertexCount; offset += 3) {
      const aIndex = index ? index.getX(offset) : offset;
      const bIndex = index ? index.getX(offset + 1) : offset + 1;
      const cIndex = index ? index.getX(offset + 2) : offset + 2;
      const ax = position.getX(aIndex);
      const ay = position.getY(aIndex);
      const az = position.getZ(aIndex);
      const bx = position.getX(bIndex);
      const by = position.getY(bIndex);
      const bz = position.getZ(bIndex);
      const cx = position.getX(cIndex);
      const cy = position.getY(cIndex);
      const cz = position.getZ(cIndex);
      if (Math.max(ay, by, cy) - Math.min(ay, by, cy) > 1e-4) continue;

      // The signed Y component of the triangle normal distinguishes the top
      // of the seat from its underside. Group coplanar top faces, then use the
      // largest upward-facing surface (the seat, not the arms or backrest).
      const upwardArea = ((bz - az) * (cx - ax) - (bx - ax) * (cz - az)) / 2;
      if (upwardArea <= 1e-6) continue;
      const y = (ay + by + cy) / 3;
      const planeKey = Math.round(y * 1000);
      let plane = planes.get(planeKey);
      if (!plane) {
        plane = { area: 0, x: 0, y: 0, z: 0 };
        planes.set(planeKey, plane);
      }
      plane.area += upwardArea;
      plane.x += ((ax + bx + cx) / 3) * upwardArea;
      plane.y += y * upwardArea;
      plane.z += ((az + bz + cz) / 3) * upwardArea;
    }

    let seat = null;
    for (const plane of planes.values()) {
      if (!seat || plane.area > seat.area) seat = plane;
    }
    if (!seat) return null;
    return new THREE.Vector3(
      seat.x / seat.area,
      seat.y / seat.area,
      seat.z / seat.area,
    );
  }

  function getBillboardSeatAnchor(chair, worldHeight, fallbackSeatCenter) {
    chair.updateWorldMatrix(true, false);
    const seatCenter = findSeatSurfaceCenterLocal(chair) || fallbackSeatCenter;
    const anchor = chair.localToWorld(seatCenter.clone());
    // Billboards remain upright in world space; their bottom edge lands on
    // the horizontal seat plane rather than floating above the chair back.
    anchor.y += worldHeight / 2;
    return anchor;
  }

  function setupContestants() {
    const chairs = [];
    stageModel?.traverse((object) => {
      if (object.isMesh && normalizeNodeName(object.name) === "tall_chair") chairs.push(object);
    });
    scene.updateMatrixWorld(true);

    const sortedFallback = [...chairs].sort((a, b) => {
      const aPosition = a.getWorldPosition(new THREE.Vector3());
      const bPosition = b.getWorldPosition(new THREE.Vector3());
      return aPosition.x - bPosition.x;
    });
    contestants = BILLBOARD_SOURCES.map((source, index) => {
      // The supplied stage's seating row is authored left-to-right as Faroe,
      // Erin, Kaz. Use its world-space order so browser panels cannot drift to
      // another chair if decorative nameplate transforms are edited later.
      const chair = sortedFallback[index];
      if (!chair) return null;

      const chairBounds = new THREE.Box3().setFromObject(chair);
      const chairCenter = chairBounds.getCenter(new THREE.Vector3());
      const chairSize = chairBounds.getSize(new THREE.Vector3());
      const hitSize = new THREE.Vector3(
        Math.max(chairSize.x + 0.42, 0.92),
        Math.max(chairSize.y + 0.36, 1.35),
        Math.max(chairSize.z + 0.42, 0.82),
      );
      const hitProxy = new THREE.Mesh(
        new THREE.BoxGeometry(hitSize.x, hitSize.y, hitSize.z),
        new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }),
      );
      hitProxy.position.copy(chairCenter);
      hitProxy.userData.contestantId = source.id;
      hitProxy.name = `point-click-${source.id}`;
      hitProxy.castShadow = false;
      hitProxy.receiveShadow = false;
      scene.add(hitProxy);
      contestantTargets.push(hitProxy);

      const worldWidth = 1.04;
      const worldHeight = worldWidth;
      const anchor = getBillboardSeatAnchor(
        chair,
        worldHeight,
        // Fallback seat-plane centroid measured from the supplied stage GLTF.
        new THREE.Vector3(0, 0.099, 0.0263),
      );
      const panel = createBillboardPanel(source, "contestant");

      return {
        ...source,
        chair,
        hitProxy,
        anchor,
        panel,
        worldWidth,
        worldHeight,
      };
    }).filter(Boolean);
    billboards = [...contestants];
    setupHostBillboard();
    billboardLayer.setAttribute(
      "aria-label",
      `Host and contestant browser-source billboards, ${billboards.length} screens`,
    );
  }

  function setupHostBillboard() {
    let chair = null;
    let highestBounds = null;
    stageModel?.traverse((object) => {
      if (!object.isMesh || normalizeNodeName(object.name) !== "chair") return;
      const bounds = new THREE.Box3().setFromObject(object);
      if (bounds.isEmpty() || (highestBounds && bounds.max.y <= highestBounds.max.y)) return;
      chair = object;
      highestBounds = bounds;
    });
    if (!chair || !highestBounds) return;

    const worldWidth = 1.04;
    const worldHeight = worldWidth;
    const chairCenter = highestBounds.getCenter(new THREE.Vector3());
    const chairSize = highestBounds.getSize(new THREE.Vector3());
    const hitSize = new THREE.Vector3(
      Math.max(chairSize.x + 0.5, 0.96),
      Math.max(chairSize.y + 0.4, 1.42),
      Math.max(chairSize.z + 0.5, 0.86),
    );
    const hitProxy = new THREE.Mesh(
      new THREE.BoxGeometry(hitSize.x, hitSize.y, hitSize.z),
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }),
    );
    hitProxy.position.copy(chairCenter);
    hitProxy.userData.hostId = HOST_BILLBOARD_SOURCE.id;
    hitProxy.name = "point-click-host";
    hitProxy.castShadow = false;
    hitProxy.receiveShadow = false;
    scene.add(hitProxy);
    hostTargets.push(hitProxy);

    const anchor = getBillboardSeatAnchor(
      chair,
      worldHeight,
      // Fallback seat-plane centroid measured from the supplied stage GLTF.
      new THREE.Vector3(-0.0306, 0.055, -0.0004),
    );
    const panel = createBillboardPanel(HOST_BILLBOARD_SOURCE, "host");
    hostBillboard = {
      ...HOST_BILLBOARD_SOURCE,
      chair,
      hitProxy,
      anchor,
      panel,
      worldWidth,
      worldHeight,
    };
    billboards.push(hostBillboard);
  }

  function getNamedPart(hit, model, knownNames) {
    for (let object = hit?.object; object && object !== model; object = object.parent) {
      const name = String(object.name || "").toLowerCase();
      if (knownNames.has(name)) return name;
    }
    return "";
  }

  function getProjectedSlotControlAt(clientX, clientY, canvasBounds) {
    if (!camera || !slotControlTargets.size) return null;
    camera.updateMatrixWorld(true);
    const candidates = [];
    for (const [part, object] of slotControlTargets) {
      const box = new THREE.Box3().setFromObject(object);
      if (box.isEmpty()) continue;
      const projected = [];
      for (const x of [box.min.x, box.max.x]) {
        for (const y of [box.min.y, box.max.y]) {
          for (const z of [box.min.z, box.max.z]) {
            const point = new THREE.Vector3(x, y, z).project(camera);
            if (point.z >= -1 && point.z <= 1) projected.push(point);
          }
        }
      }
      if (projected.length < 2) continue;
      const left = canvasBounds.left + (Math.min(...projected.map((point) => point.x)) + 1) * 0.5 * canvasBounds.width;
      const right = canvasBounds.left + (Math.max(...projected.map((point) => point.x)) + 1) * 0.5 * canvasBounds.width;
      const top = canvasBounds.top + (1 - Math.max(...projected.map((point) => point.y))) * 0.5 * canvasBounds.height;
      const bottom = canvasBounds.top + (1 - Math.min(...projected.map((point) => point.y))) * 0.5 * canvasBounds.height;
      const padding = part.startsWith("button") ? 5 : 2;
      if (clientX < left - padding || clientX > right + padding || clientY < top - padding || clientY > bottom + padding) continue;
      const center = box.getCenter(new THREE.Vector3());
      const centerX = (left + right) / 2;
      const centerY = (top + bottom) / 2;
      candidates.push({
        part,
        area: Math.max(1, (right - left) * (bottom - top)),
        centerDistance: Math.hypot(clientX - centerX, clientY - centerY),
        distance: camera.position.distanceTo(center),
      });
    }
    candidates.sort((a, b) => a.area - b.area || a.centerDistance - b.centerDistance);
    return candidates[0] || null;
  }

  function getSceneInteractionAt(clientX, clientY) {
    const bounds = canvas.getBoundingClientRect();
    pointer.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const wheelHit = raycaster.intersectObjects(rouletteTargets, true)[0];
    const slotIntersections = raycaster.intersectObjects(slotTargets, true);
    const slotHit = slotIntersections[0];
    const projectedSlotControl = getProjectedSlotControlAt(clientX, clientY, bounds);
    const cardTableHit = raycaster.intersectObjects(cardTableTargets, true)[0];
    const diceDoorHit = raycaster.intersectObjects(diceDoorTargets, false)[0];
    const chairHit = raycaster.intersectObjects(contestantTargets, false)[0];
    const hostHit = raycaster.intersectObjects(hostTargets, false)[0];
    const hits = [
      wheelHit && { distance: wheelHit.distance, hit: wheelHit, machine: "roulette", model: rouletteModel },
      slotHit && { distance: slotHit.distance, hit: slotHit, machine: "slot", model: slotsModel },
      cardTableHit && { distance: cardTableHit.distance, hit: cardTableHit, machine: "card-table", model: cardTableModel },
      diceDoorHit && { distance: diceDoorHit.distance, hit: diceDoorHit, machine: "dice-door" },
      chairHit && {
        distance: chairHit.distance,
        machine: "contestant",
        contestantId: chairHit.object.userData.contestantId,
      },
      hostHit && {
        distance: hostHit.distance,
        machine: "host",
        hostId: hostHit.object.userData.hostId,
      },
    ].filter(Boolean).sort((a, b) => a.distance - b.distance);
    const hit = hits[0];
    if (!hit) {
      return projectedSlotControl
        ? { machine: "slot", part: projectedSlotControl.part, distance: projectedSlotControl.distance, model: slotsModel }
        : getSeatAtScreen(clientX, clientY, bounds);
    }
    if (hit.machine === "contestant" || hit.machine === "host") return hit;
    if (hit.machine === "card-table") return hit;
    const partNames = hit.machine === "roulette" ? ROULETTE_PART_NAMES : SLOT_PART_NAMES;
    let part = getNamedPart(hit.hit, hit.model, partNames);
    if (hit.machine === "slot" && projectedSlotControl) part = projectedSlotControl.part;
    return {
      ...hit,
      part,
      cellIndex: hit.machine === "slot" && part === "slot-reel-display" ? slotCellIndexAtUv(hit.hit?.uv) : -1,
    };
  }

  function getSeatAtScreen(clientX, clientY, canvasBounds) {
    camera.updateMatrixWorld(true);
    const seats = [
      ...contestants.map((contestant) => ({ machine: "contestant", entry: contestant })),
      ...(hostBillboard ? [{ machine: "host", entry: hostBillboard }] : []),
    ];
    const candidates = seats.map(({ machine, entry }) => {
      const box = new THREE.Box3().setFromObject(entry.hitProxy);
      const corners = [];
      for (const x of [box.min.x, box.max.x]) {
        for (const y of [box.min.y, box.max.y]) {
          for (const z of [box.min.z, box.max.z]) {
            const point = new THREE.Vector3(x, y, z).project(camera);
            if (point.z >= -1 && point.z <= 1) corners.push(point);
          }
        }
      }
      if (corners.length < 2) return null;
      const left = canvasBounds.left + (Math.min(...corners.map((point) => point.x)) + 1) * 0.5 * canvasBounds.width;
      const right = canvasBounds.left + (Math.max(...corners.map((point) => point.x)) + 1) * 0.5 * canvasBounds.width;
      const top = canvasBounds.top + (1 - Math.max(...corners.map((point) => point.y))) * 0.5 * canvasBounds.height;
      const bottom = canvasBounds.top + (1 - Math.min(...corners.map((point) => point.y))) * 0.5 * canvasBounds.height;
      if (clientX < left || clientX > right || clientY < top || clientY > bottom) return null;
      const centerX = (left + right) / 2;
      const centerY = (top + bottom) / 2;
      return {
        machine,
        ...(machine === "host" ? { hostId: entry.id } : { contestantId: entry.id }),
        distance: Math.hypot(clientX - centerX, clientY - centerY),
      };
    }).filter(Boolean).sort((a, b) => a.distance - b.distance);
    return candidates[0] || null;
  }

  function updatePointer(event) {
    if (!gameStarted || pauseMenuOpen || event.pointerType === "touch" || !camera || event.buttons || cameraTransition) {
      hideGameCursor();
      return;
    }
    const rect = preview.getBoundingClientRect();
    const interaction = getSceneInteractionAt(event.clientX, event.clientY);
    const hoveredCell = currentView.kind === "slot"
      && interaction?.machine === "slot"
      && interaction.part === "slot-reel-display"
      ? interaction.cellIndex
      : -1;
    if (hoveredCell !== slotHoverCellIndex) {
      slotHoverCellIndex = hoveredCell;
      drawSlotReelDisplay();
    }
    const zone = interaction ? "" : resolvePointClickZone({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      canGoBack: canGoBack(),
    });
    const sameFocusedTarget = interaction?.machine === "host"
      ? currentView.kind === "host"
      : interaction?.machine === "contestant"
        && currentView.kind === "contestant"
        && currentView.contestantId === interaction.contestantId;
    const actionable = Boolean(interaction && !sameFocusedTarget);
    setGameCursor(resolvePointClickCursor({ zone, actionable }), event.clientX, event.clientY);
  }

  function setGameCursor(mode, clientX, clientY) {
    if (reducedMotion.matches) {
      gameCursor.hidden = true;
      preview.classList.remove("has-game-cursor");
      return;
    }

    const imageSource = mode === "left" || mode === "right" || mode === "back"
      ? CURSOR_ASSETS.direction
      : CURSOR_ASSETS[mode] || CURSOR_ASSETS.default;
    if (cursorMode !== mode) {
      cursorMode = mode;
      gameCursorImage.src = imageSource;
      gameCursorImage.style.transform = mode === "left"
        ? "scaleX(-1)"
        : mode === "back"
          ? "rotate(90deg)"
          : "none";
    }

    const rect = preview.getBoundingClientRect();
    const width = gameCursor.clientWidth || 62;
    const height = gameCursor.clientHeight || 35;
    const hotspots = {
      default: [0.52, 0.45],
      hover: [0.52, 0.49],
      right: [0.61, 0.5],
      left: [0.39, 0.5],
      back: [0.5, 0.7],
    };
    const [hotspotX, hotspotY] = hotspots[mode] || hotspots.default;
    gameCursor.style.left = `${clientX - rect.left - width * hotspotX}px`;
    gameCursor.style.top = `${clientY - rect.top - height * hotspotY}px`;
    gameCursor.hidden = false;
  }

  function hideGameCursor() {
    gameCursor.hidden = true;
  }

  function updateMarqueeMatteFallback() {
    if (menuMarquee.readyState < 2) return;
    let frameHasAlpha = false;
    try {
      const probe = document.createElement("canvas");
      probe.width = 1;
      probe.height = 1;
      const context = probe.getContext("2d", { willReadFrequently: true });
      context.drawImage(menuMarquee, 0, 0, 1, 1);
      frameHasAlpha = context.getImageData(0, 0, 1, 1).data[3] < 250;
    } catch {
      frameHasAlpha = false;
    }
    menuMarquee.classList.toggle("rg-marquee-matte", !frameHasAlpha);
  }

  function updateMarqueeMotionPreference() {
    const useStill = reducedMotion.matches || marqueeVideoUnavailable;
    menuMarquee.hidden = useStill;
    marqueeStill.hidden = !useStill;
    pauseMenu.classList.toggle("rg-marquee-animated", useStill && !reducedMotion.matches && pauseMenuOpen);
    menuMarquee.preload = useStill ? "none" : "auto";
    if (useStill) {
      menuMarquee.pause();
      try { menuMarquee.currentTime = 0; } catch {}
      return;
    }
    if (pauseMenuOpen) {
      menuMarquee.pause();
      try { menuMarquee.currentTime = 0; } catch {}
      const playback = menuMarquee.play();
      if (playback?.catch) playback.catch((error) => {
        marqueeVideoUnavailable = true;
        updateMarqueeMotionPreference();
        console.warn("Marquee animation could not play:", error);
      });
    }
  }

  menuMarquee.addEventListener("loadeddata", updateMarqueeMatteFallback);
  menuMarquee.addEventListener("error", () => {
    marqueeVideoUnavailable = true;
    menuMarquee.classList.add("rg-marquee-matte");
    updateMarqueeMotionPreference();
  });
  if (typeof reducedMotion.addEventListener === "function") {
    reducedMotion.addEventListener("change", updateMarqueeMotionPreference);
  } else {
    reducedMotion.addListener(updateMarqueeMotionPreference);
  }
  updateMarqueeMotionPreference();

  function setMenuSceneVisibility(visible) {
    for (const object of [stageModel, rouletteRig, slotRig]) {
      if (object) object.visible = visible;
    }
    billboardLayer.classList.toggle("rg-billboards-fading", !visible);
  }

  function showPauseMenu() {
    if (pauseMenuOpen) return;
    gameStarted = false;
    pauseMenuOpen = true;
    setMenuSceneVisibility(false);
    preview.classList.add("is-menu");
    readyScreen.hidden = true;
    pauseMenu.hidden = false;
    loading.classList.add("is-hidden");
    hideResult();
    hideGameCursor();
    if (!document.hidden && renderer && !animationFrame) animationFrame = requestAnimationFrame(animate);

    updateMarqueeMotionPreference();
    playButton.focus({ preventScroll: true });
  }

  function startGame() {
    if (!pauseMenuOpen) return;
    pauseMenuOpen = false;
    gameStarted = true;
    pauseMenu.hidden = true;
    pauseMenu.classList.remove("rg-marquee-animated");
    preview.classList.remove("is-menu");
    setMenuSceneVisibility(true);
    menuMarquee.pause();
    try { menuMarquee.currentTime = 0; } catch {}
    canvas.focus({ preventScroll: true });
  }

  function activateCardGameMode(mode) {
    if (!new Set(["red-handed", "quiplash", "shop", "smeemo"]).has(mode)) return;
    if (!sceneReady) {
      pendingCardGameMode = mode;
      return;
    }
    if (!gameStarted) {
      gameStarted = true;
      pauseMenuOpen = false;
      readyScreen.hidden = true;
      pauseMenu.hidden = true;
      preview.classList.remove("is-menu");
      setMenuSceneVisibility(true);
      menuMarquee.pause();
      try { menuMarquee.currentTime = 0; } catch {}
    }
    result.hidden = true;
    transitionToView({ kind: "card-table" });
  }

  window.addEventListener("rg:card-game-active", (event) => activateCardGameMode(event.detail?.mode));
  window.addEventListener("rg:close-card-games", () => {
    if (currentView.kind === "card-table") transitionToView({ kind: "overview" });
  });

  goButton.addEventListener("click", showPauseMenu);
  playButton.addEventListener("click", startGame);
  controlsOpenButton.addEventListener("click", () => {
    if (typeof controlsDialog.showModal === "function") controlsDialog.showModal();
    else controlsDialog.setAttribute("open", "");
  });
  controlsCloseButton.addEventListener("click", () => controlsDialog.close());
  controlsDialog.addEventListener("click", (event) => {
    if (event.target === controlsDialog) controlsDialog.close();
  });
  goButton.focus({ preventScroll: true });

  function playCheer() {
    cheerSound.pause();
    cheerSound.currentTime = 0;
    const playback = cheerSound.play();
    if (playback?.catch) playback.catch((error) => console.warn("Cheer sound could not play:", error));
  }

  subscribePointScores((scores) => {
    if (!pointsHud) return;
    pointsHud.replaceChildren();
    for (const name of ["faroe", "erin", "kaz"]) {
      const score = document.createElement("span");
      score.textContent = `${name.toUpperCase()} ${scores[name]}`;
      pointsHud.append(score);
    }
    pointsHud.hidden = !Object.values(scores).some((score) => score > 0);
  });

  function pointClickAt(clientX, clientY) {
    if (!gameStarted || pauseMenuOpen || !camera || !sceneReady || diceModeOpen || cameraTransition) return;
    const rect = preview.getBoundingClientRect();
    const interaction = getSceneInteractionAt(clientX, clientY);
    if (!interaction) {
      const zone = resolvePointClickZone({
        x: clientX - rect.left,
        y: clientY - rect.top,
        width: rect.width,
        height: rect.height,
        canGoBack: canGoBack(),
      });
      if (zone === "left") return setLookDirection(-1);
      if (zone === "right") return setLookDirection(1);
      if (zone === "back") return goBack();
      return;
    }

    if (interaction.machine === "dice-door") {
      const action = resolvePointClickAction({
        machine: "dice-door",
        focused: currentView.kind === "dice-door",
      });
      if (action === "focus-dice-door") {
        transitionToView({ kind: "dice-door" });
      } else if (action === "open-dice") {
        window.dispatchEvent(new CustomEvent("rg:open-dice-mode"));
      }
      return;
    }

    if (interaction.machine === "contestant") {
      const focused = currentView.kind === "contestants" || currentView.kind === "contestant";
      const action = resolvePointClickAction({ machine: "contestant", focused });
      if (action === "focus-contestants") {
        transitionToView({ kind: "contestants" });
      } else if (currentView.kind === "contestants" || currentView.contestantId !== interaction.contestantId) {
        transitionToView({ kind: "contestant", contestantId: interaction.contestantId });
      }
      return;
    }

    if (interaction.machine === "host") {
      const action = resolvePointClickAction({ machine: "host", focused: currentView.kind === "host" });
      if (action === "focus-host") transitionToView({ kind: "host" });
      return;
    }

    if (interaction.machine === "card-table") {
      const action = resolvePointClickAction({
        machine: "card-table",
        focused: currentView.kind === "card-table",
      });
      if (action === "focus-card-table") transitionToView({ kind: "card-table" });
      else if (action === "open-card-games") window.dispatchEvent(new CustomEvent("rg:show-card-menu"));
      return;
    }

    const action = resolvePointClickAction({
      machine: interaction.machine,
      part: interaction.part,
      focused: currentView.kind === interaction.machine,
      canGoBack: canGoBack(),
    });
    if (action === "focus-roulette") transitionToView({ kind: "roulette" });
    else if (action === "focus-slot") transitionToView({ kind: "slot" });
    else if (action === "spin-wheel") startWheelSpin();
    else if (action === "pull-lever") startLeverPull();
    else if (action.startsWith("spin-column-")) spinSlotColumn(Number(action.slice("spin-column-".length)));
    else if (action === "place-slot-berry") placeSlotBerryFromDisplay(interaction.cellIndex);
    else if (action === "open-slots") window.dispatchEvent(new CustomEvent("rg:open-host-panel", { detail: { tab: "slots" } }));
    else if (action === "open-trivia") window.dispatchEvent(new CustomEvent("rg:open-host-panel", { detail: { tab: "trivia" } }));
  }

  canvas.addEventListener("pointermove", updatePointer);
  canvas.addEventListener("click", (event) => pointClickAt(event.clientX, event.clientY));
  canvas.addEventListener("pointerleave", () => {
    slotHoverCellIndex = -1;
    drawSlotReelDisplay();
    hideGameCursor();
  });
  window.addEventListener("blur", hideGameCursor);

  window.addEventListener("rg:dice-mode-state", (event) => {
    const open = Boolean(event.detail?.open);
    if (open === diceModeOpen) return;
    diceModeOpen = open;
    updateLiquidPortalProjection();
    if (open) {
      diceModeVisibility = [stageModel, rouletteRig, slotRig]
        .filter(Boolean)
        .map((object) => [object, object.visible]);
      for (const [object] of diceModeVisibility) object.visible = false;
      billboardLayer.classList.add("rg-billboards-fading");
      preview.classList.add("is-dice-mode");
      hideGameCursor();
      result.hidden = true;
    } else {
      for (const [object, visible] of diceModeVisibility || []) object.visible = visible;
      diceModeVisibility = null;
      billboardLayer.classList.remove("rg-billboards-fading");
      preview.classList.remove("is-dice-mode");
      camera.updateMatrixWorld(true);
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (document.querySelector("dialog[open]")) return;
    if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable='true']")) return;
    if (!gameStarted || pauseMenuOpen) return;
    const key = event.key.toLowerCase();
    if (key === "escape") {
      showPauseMenu();
      event.preventDefault();
      return;
    }
    const shortcut = resolveArcadeShortcut(key);
    if (shortcut === "participants") transitionToView({ kind: "contestants" });
    else if (shortcut === "dice-door") {
      if (currentView.kind !== "dice-door" || currentView.look !== 0) {
        transitionToView({ kind: "dice-door" });
      }
    }
    else if (shortcut === "host") transitionToView({ kind: "host" });
    else if (shortcut === "card-table") transitionToView({ kind: "card-table" });
    else if (shortcut === "cheer") {
      if (!event.repeat) playCheer();
    }
    else if (key === "2") transitionToView({ kind: "slot" });
    else if (key === "3") transitionToView({ kind: "roulette" });
    else if (key === "arrowleft") setLookDirection(-1);
    else if (key === "arrowright") setLookDirection(1);
    else if (key === "arrowdown" || key === "backspace") goBack();
    else if (key === "enter" || key === " ") {
      const bounds = canvas.getBoundingClientRect();
      pointClickAt(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    }
    else if (key === "r") startWheelSpin();
    else if (key === "s") startLeverPull();
    else if (key === "g") window.dispatchEvent(new CustomEvent("rg:open-host-panel", { detail: { tab: "slots" } }));
    else if (key === "t") window.dispatchEvent(new CustomEvent("rg:open-host-panel", { detail: { tab: "trivia" } }));
    else if (shortcut !== "cheer") return;
    event.preventDefault();
  });

  gameCursorImage.addEventListener("load", () => {
    if (!reducedMotion.matches) preview.classList.add("has-game-cursor");
  });
  gameCursorImage.addEventListener("error", () => {
    preview.classList.remove("has-game-cursor");
    hideGameCursor();
  });
  gameCursorImage.src = CURSOR_ASSETS.default;

  window.addEventListener("rg:spin-wheel", startWheelSpin);
  window.addEventListener("rg:pull-slots", startLeverPull);
  window.addEventListener("rg:slot-grid-updated", (event) => {
    slotReelGrid = normalizeSlotGrid(event.detail?.grid);
    if (!slotReelMotion) drawSlotReelDisplay();
  });
  window.addEventListener("rg:slot-settings-updated", (event) => {
    const berry = event.detail?.berry;
    const axis = event.detail?.axis;
    if (["faroeberry", "erinberry", "kazberry"].includes(berry)) selectedSlotBerry = berry;
    if (axis === "row" || axis === "column") slotPlacementAxis = axis;
    drawSlotReelDisplay();
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== SLOT_GRID_STORAGE_KEY) return;
    slotReelGrid = normalizeSlotGrid(event.newValue);
    if (!slotReelMotion) drawSlotReelDisplay();
  });

  function updateCameraTransition(time) {
    if (!cameraTransition) return;
    const transition = cameraTransition;
    const progress = Math.min(1, (time - transition.started) / transition.duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    camera.position.lerpVectors(transition.fromPosition, transition.toPosition, eased);
    cameraTarget.lerpVectors(transition.fromTarget, transition.toTarget, eased);
    camera.lookAt(cameraTarget);
    camera.updateMatrixWorld(true);
    if (progress >= 1) {
      camera.position.copy(transition.toPosition);
      cameraTarget.copy(transition.toTarget);
      camera.lookAt(cameraTarget);
      camera.updateMatrixWorld(true);
      cameraTransition = null;
    }
  }

  function updateBillboardProjection() {
    if (!camera || !billboardLayer || preview.clientWidth < 1 || preview.clientHeight < 1) return;
    camera.updateMatrixWorld(true);
    const width = preview.clientWidth;
    const height = preview.clientHeight;
    const pixelsPerWorldUnitAtOne = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    const worldUp = new THREE.Vector3(0, 1, 0);

    for (const billboard of billboards) {
      const cameraSpace = camera.worldToLocal(billboard.anchor.clone());
      const depth = -cameraSpace.z;
      const projected = billboard.anchor.clone().project(camera);
      const halfHeight = billboard.worldHeight / 2;
      const projectedTop = billboard.anchor.clone().addScaledVector(worldUp, halfHeight).project(camera);
      const projectedBottom = billboard.anchor.clone().addScaledVector(worldUp, -halfHeight).project(camera);
      const visible = depth > camera.near
        && projected.z >= -1 && projected.z <= 1
        && projectedTop.z >= -1 && projectedTop.z <= 1
        && projectedBottom.z >= -1 && projectedBottom.z <= 1;
      if (!visible) {
        billboard.panel.style.visibility = "hidden";
        continue;
      }

      const x = (projected.x + 1) * 0.5 * width;
      const top = (1 - projectedTop.y) * 0.5 * height;
      const bottom = (1 - projectedBottom.y) * 0.5 * height;
      const y = (top + bottom) / 2;
      const rawWidth = billboard.worldWidth * pixelsPerWorldUnitAtOne / depth;
      const panelWidth = Math.min(rawWidth, width * 0.78);
      const panelHeight = Math.abs(bottom - top);
      if (panelHeight < 1) {
        billboard.panel.style.visibility = "hidden";
        continue;
      }
      billboard.panel.style.left = `${x}px`;
      billboard.panel.style.top = `${y}px`;
      billboard.panel.style.width = `${panelWidth}px`;
      billboard.panel.style.height = `${panelHeight}px`;
      billboard.panel.style.visibility = "visible";
    }
  }

  function animate(time) {
    animationFrame = requestAnimationFrame(animate);
    if (!renderer || !scene || !camera) return;

    updateCameraTransition(time);
    updateSkyAnimations(time);
    if (diceModeOpen) {
      renderer.render(scene, camera);
      return;
    }
    if (sceneReady) {
      updateBillboardProjection();
      updateLiquidPortalProjection();
    }

    if (wheelMotion && wheelPivot && ballPivot) {
      const progress = Math.min(1, (time - wheelMotion.started) / wheelMotion.duration);
      const ease = 1 - Math.pow(1 - progress, 4.6);
      wheelPivot.rotation.y = THREE.MathUtils.lerp(wheelMotion.wheelFrom, wheelMotion.wheelTo, ease);
      ballPivot.rotation.y = THREE.MathUtils.lerp(
        wheelMotion.ballFrom,
        wheelMotion.ballTo,
        1 - Math.pow(1 - progress, 2.2),
      );
      if (ballOrbitObject) {
        const radius = sampleRouletteBallRadius(progress, wheelMotion.ballRadiusFrom);
        const position = rouletteBallPositionAtRadius({
          x: Math.cos(wheelMotion.ballAngle),
          y: wheelMotion.ballHeight,
          z: Math.sin(wheelMotion.ballAngle),
        }, radius);
        if (position) ballOrbitObject.position.set(position.x, position.y, position.z);
      }
      if (progress >= 1) {
        wheelPivot.rotation.y = wheelMotion.wheelTo;
        ballPivot.rotation.y = wheelMotion.ballTo;
        if (ballOrbitObject) {
          const landingPosition = rouletteBallPositionAtRadius(ballOrbitObject.position, ROULETTE_BALL_LANDING_RADIUS);
          if (landingPosition) ballOrbitObject.position.set(landingPosition.x, landingPosition.y, landingPosition.z);
        }
        wheelMotion = null;
        finishTurn();
      }
    } else if (wheelMotion && time - wheelMotion.started >= wheelMotion.duration) {
      wheelMotion = null;
      finishTurn();
    }

    if (leverMotion && lever) {
      const progress = Math.min(1, (time - leverMotion.started) / leverMotion.duration);
      lever.quaternion.copy(leverMotion.baseQuaternion);
      lever.rotateX(-Math.sin(progress * Math.PI) * 0.92);
      if (progress >= 1) {
        lever.quaternion.copy(leverMotion.baseQuaternion);
        leverMotion = null;
      }
    } else if (leverMotion && time - leverMotion.started >= leverMotion.duration) {
      leverMotion = null;
    }

    if (slotReelMotion) {
      drawSlotReelDisplay(time);
      const settled = slotReelMotion.columns.every((column) => (
        !sampleSlotReelColumn(column, slotReelMotion, time)?.spinning
      ));
      if (settled) {
        const completedMotion = slotReelMotion;
        slotReelMotion = null;
        finishSlotAction(completedMotion);
      }
    }

    renderer.render(scene, camera);
  }

  async function boot() {
    try {
      const [threeModule, loaderModule] = await Promise.all([
        import("three"),
        import("three/addons/loaders/GLTFLoader.js"),
      ]);
      THREE = threeModule;
      GLTFLoader = loaderModule.GLTFLoader;
      createWorld();
      if (!document.hidden && (gameStarted || pauseMenuOpen) && !animationFrame) {
        animationFrame = requestAnimationFrame(animate);
      }
      const loader = new GLTFLoader();
      const [stageGltf, rouletteGltf, slotsGltf] = await Promise.all([
        loader.loadAsync("/ramblegamble/assets/provided/rg_stage.gltf"),
        loader.loadAsync("/ramblegamble/assets/provided/rg_roulette.gltf"),
        loader.loadAsync("/ramblegamble/assets/provided/rg_slots.gltf"),
      ]);

      stageModel = stageGltf.scene;
      prepareModel(stageModel);
      stageModel.visible = !pauseMenuOpen;
      scene.add(stageModel);
      carveDiceDoorway(stageModel);

      rouletteModel = rouletteGltf.scene;
      prepareModel(rouletteModel);
      rouletteRig.add(rouletteModel);
      rouletteModel.traverse((object) => {
        if (object.name === "wheel" && !object.isMesh && object.children.length > 0) wheelPivot = object;
        if (object.name === "ball" && !object.isMesh && object.children.length > 0) ballPivot = object;
      });
      prepareRouletteBall();

      slotsModel = slotsGltf.scene;
      prepareModel(slotsModel);
      slotRig.add(slotsModel);
      slotsModel.traverse((object) => {
        if (String(object.name || "").toLowerCase() === "arm") lever = object;
      });
      createSlotReelDisplay();

      placeMachinesFromStage();
      setupPicking();
      applyTheme();
      sceneReady = true;
      fitCamera();
      moveRouletteToMarkedFloorSpot(new THREE.Box3().setFromObject(stageModel.getObjectByName("table")).min.y);
      // Refit from the final wheel location so both adjustments remain in frame.
      overviewCameraBounds = getArcadeBounds();
      fitCamera();
      if (pendingCardGameMode) {
        const mode = pendingCardGameMode;
        pendingCardGameMode = "";
        activateCardGameMode(mode);
      }
      loading.classList.add("is-hidden");
    } catch (error) {
      console.error("Ramble Gamble preview failed to start:", error);
      loading.textContent = "The 3D preview could not load.";
    }
  }

  boot();

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    } else if ((gameStarted || pauseMenuOpen) && renderer && !animationFrame) {
      animationFrame = requestAnimationFrame(animate);
    }
  });

  window.addEventListener("pagehide", () => {
    cancelAnimationFrame(animationFrame);
    resizeObserver?.disconnect();
    renderer?.dispose();
  }, { once: true });
})();
