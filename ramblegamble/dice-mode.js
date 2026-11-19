import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  chooseDiceOutcome,
  DICE_ASSET_CYCLE,
  DICE_FACE_ORDER,
  nextDiceAsset,
} from "./dice-game-state.mjs?v=dice-game-state-20261119-v1";
import {
  createDiceFlightState,
  DICE_FLIGHT_DURATION,
  DICE_FLIGHT_STEP,
  DICE_SETTLE_DURATION,
  stepDiceFlight,
} from "./dice-roll-physics.mjs?v=dice-roll-physics-20261119-v1";

(() => {
  "use strict";

  const dialog = document.getElementById("rg-dice-dialog");
  const canvas = document.getElementById("rg-dice-canvas");
  const liquid = document.getElementById("rg-dice-liquid");
  const returnButton = document.getElementById("rg-dice-return");
  const rollButton = document.getElementById("rg-dice-roll");
  const status = document.getElementById("rg-dice-status");
  const outcomeLabels = [
    document.getElementById("rg-dice-outcome-left"),
    document.getElementById("rg-dice-outcome-right"),
  ];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const berryColors = Object.freeze({
    erinberry: "#ef78bd",
    faroeberry: "#63c9ec",
    kazberry: "#b38cff",
  });
  const dieStates = [
    { side: "left", assignments: Array(6).fill("blank"), group: null, stickers: [] },
    { side: "right", assignments: Array(6).fill("blank"), group: null, stickers: [] },
  ];
  let renderer = null;
  let scene = null;
  let camera = null;
  let frame = 0;
  let previousFrameTime = null;
  let loadPromise = null;
  let rolling = false;
  let activeRolls = [];
  let isOpen = false;
  let isClosing = false;
  let closeFadeTimeout = 0;

  function makeFaceButton(dieState, face, faceIndex, parent) {
    const button = document.createElement("button");
    button.className = "rg-die-face-button";
    button.type = "button";
    button.dataset.die = dieState.side;
    button.dataset.face = face.id;
    const faceLabel = document.createElement("span");
    faceLabel.className = "rg-die-face-side";
    faceLabel.textContent = face.label;
    const value = document.createElement("strong");
    value.className = "rg-die-face-value";
    const cycle = document.createElement("span");
    cycle.className = "rg-die-face-cycle";
    cycle.setAttribute("aria-hidden", "true");
    cycle.textContent = "↻";
    button.append(faceLabel, value, cycle);
    button.addEventListener("click", () => {
      if (rolling) return;
      const next = nextDiceAsset(dieState.assignments[faceIndex]);
      dieState.assignments[faceIndex] = next.id;
      updateFaceButton(button, face, next.id);
      updateSticker(dieState, faceIndex, next.id);
      status.textContent = "SET THE FACES, THEN ROLL";
      ensureRenderLoop();
    });
    updateFaceButton(button, face, dieState.assignments[faceIndex]);
    parent.append(button);
  }

  function updateFaceButton(button, face, assetId) {
    const asset = DICE_ASSET_CYCLE.find((choice) => choice.id === assetId) || DICE_ASSET_CYCLE[0];
    button.querySelector(".rg-die-face-value").textContent = asset.label.toUpperCase();
    button.dataset.asset = asset.id;
    button.setAttribute("aria-label", `${button.dataset.die} die, ${face.label.toLowerCase()} face: ${asset.label}. Click to cycle to the next berry.`);
  }

  function buildFacePickers() {
    const left = document.getElementById("rg-die-left-faces");
    const right = document.getElementById("rg-die-right-faces");
    left.replaceChildren();
    right.replaceChildren();
    for (const [dieIndex, dieState] of dieStates.entries()) {
      const parent = dieIndex === 0 ? left : right;
      DICE_FACE_ORDER.forEach((face, faceIndex) => makeFaceButton(dieState, face, faceIndex, parent));
    }
  }

  function paintStickerCanvas(stickerCanvas, assetId) {
    const context = stickerCanvas.getContext("2d");
    context.clearRect(0, 0, stickerCanvas.width, stickerCanvas.height);
    if (assetId === "blank") return;

    const color = berryColors[assetId];
    context.fillStyle = "rgba(19, 12, 42, 0.88)";
    context.fillRect(15, 15, 226, 226);
    context.fillStyle = color;
    context.fillRect(20, 20, 216, 216);
    context.strokeStyle = "#fff4dc";
    context.lineWidth = 8;
    context.strokeRect(18, 18, 220, 220);
    context.strokeStyle = "rgba(22, 12, 50, .84)";
    context.lineWidth = 4;
    context.strokeRect(29, 29, 198, 198);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#1a1039";
    context.font = "900 28px Arial, Helvetica, sans-serif";
    context.fillText(assetId.toUpperCase(), 128, 131, 188);
    context.fillStyle = "rgba(255, 250, 230, .92)";
    context.fillRect(72, 172, 112, 6);
  }

  function createStickerCanvas(assetId) {
    const stickerCanvas = document.createElement("canvas");
    stickerCanvas.width = 256;
    stickerCanvas.height = 256;
    paintStickerCanvas(stickerCanvas, assetId);
    return stickerCanvas;
  }

  function setStickerTexture(sticker, assetId) {
    paintStickerCanvas(sticker.canvas, assetId);
    sticker.texture.needsUpdate = true;
    sticker.mesh.visible = assetId !== "blank";
  }

  function updateSticker(dieState, faceIndex, assetId) {
    const sticker = dieState.stickers[faceIndex];
    if (sticker) setStickerTexture(sticker, assetId);
  }

  function prepareUnlitModel(model) {
    model.traverse((object) => {
      if (!object.isMesh) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const unlit = materials.map((material) => {
        const basic = new THREE.MeshBasicMaterial({
          map: material?.map || null,
          color: material?.map ? 0xffffff : (material?.color || 0xe5dafb),
          alphaMap: material?.alphaMap || null,
          alphaTest: material?.alphaTest || 0,
          transparent: Boolean(material?.transparent),
          side: THREE.DoubleSide,
          toneMapped: false,
        });
        return basic;
      });
      object.material = Array.isArray(object.material) ? unlit : unlit[0];
      object.castShadow = false;
      object.receiveShadow = false;
    });
  }

  function addFaceStickers(dieState) {
    const half = 1.18;
    const decalOffset = 1.205;
    DICE_FACE_ORDER.forEach((face, faceIndex) => {
      const stickerCanvas = createStickerCanvas(dieState.assignments[faceIndex]);
      const texture = new THREE.CanvasTexture(stickerCanvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 1.34), material);
      const [x, y, z] = face.normal;
      mesh.position.set(x * decalOffset, y * decalOffset, z * decalOffset);
      mesh.rotation.set(...face.rotation);
      mesh.renderOrder = 2;
      mesh.visible = dieState.assignments[faceIndex] !== "blank";
      dieState.group.add(mesh);
      dieState.stickers.push({ canvas: stickerCanvas, texture, mesh, half });
    });
  }

  function createDiceRenderer() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
      premultipliedAlpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = false;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80);
    camera.position.set(0, 0, 9.2);

    for (const [index, dieState] of dieStates.entries()) {
      dieState.group = new THREE.Group();
      dieState.group.position.x = index === 0 ? -1.4 : 1.4;
      scene.add(dieState.group);
    }

    window.addEventListener("resize", resizeRenderer, { passive: true });
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      rollButton.disabled = true;
      status.textContent = "DICE PAUSED - GRAPHICS CONTEXT LOST";
    });
  }

  function resizeRenderer() {
    if (!renderer || !camera) return;
    const width = Math.max(1, dialog.clientWidth);
    const height = Math.max(1, dialog.clientHeight);
    const compact = width < 760;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.25 : 1.5));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.z = compact ? 11.2 : 9.2;
    const spread = compact ? 0.82 : 1.4;
    for (const [index, dieState] of dieStates.entries()) {
      const group = dieState.group;
      if (!group) continue;
      const nextX = index === 0 ? -spread : spread;
      const roll = rolling ? activeRolls[index] : null;
      if (roll) {
        const shift = nextX - roll.restPosition.x;
        roll.restPosition.x = nextX;
        roll.flight.position.x += shift;
        if (roll.settlePosition) roll.settlePosition.x += shift;
        group.position.x += shift;
      } else {
        group.position.x = nextX;
      }
      if (dieState.group) dieState.group.scale.setScalar(compact ? 0.78 : 1);
    }
    camera.updateProjectionMatrix();
    if (isOpen && !rolling && scene) renderer.render(scene, camera);
  }

  function cryptoRandomUnit() {
    if (!window.crypto?.getRandomValues) return Math.random();
    const range = 0x100000000;
    const limit = Math.floor(range / DICE_FACE_ORDER.length) * DICE_FACE_ORDER.length;
    const sample = new Uint32Array(1);
    do {
      window.crypto.getRandomValues(sample);
    } while (sample[0] >= limit);
    return sample[0] / limit;
  }

  function targetOrientation(result) {
    const normal = new THREE.Vector3(...result.face.normal);
    const align = new THREE.Quaternion().setFromUnitVectors(normal, new THREE.Vector3(0, 0, 1));
    const twist = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), cryptoRandomUnit() * Math.PI * 2);
    return twist.multiply(align);
  }

  function setRollResults() {
    activeRolls.forEach((roll, index) => {
      const label = DICE_ASSET_CYCLE.find(({ id }) => id === roll.result.asset)?.label || "Blank";
      outcomeLabels[index].textContent = `${index === 0 ? "LEFT" : "RIGHT"}: ${label.toUpperCase()}`;
    });
    rolling = false;
    activeRolls = [];
    previousFrameTime = null;
    rollButton.disabled = false;
    for (const picker of document.querySelectorAll(".rg-die-face-button")) picker.disabled = false;
    status.textContent = "ROLL COMPLETE";
  }

  function startRoll() {
    if (rolling || !renderer || dieStates.some(({ stickers }) => stickers.length !== DICE_FACE_ORDER.length)) return;
    rolling = true;
    rollButton.disabled = true;
    for (const picker of document.querySelectorAll(".rg-die-face-button")) picker.disabled = true;
    const results = dieStates.map(({ assignments }) => chooseDiceOutcome(assignments, cryptoRandomUnit));
    activeRolls = results.map((result, index) => {
      const group = dieStates[index].group;
      const restPosition = group.position.clone();
      const lane = index === 0 ? -1 : 1;
      return {
        group,
        restPosition,
        target: targetOrientation(result),
        result,
        elapsed: 0,
        flightAccumulator: 0,
        flight: createDiceFlightState({
          origin: [restPosition.x, 0.08, restPosition.z],
          lane,
          random: cryptoRandomUnit,
        }),
        settlePosition: null,
        settleQuaternion: null,
      };
    });
    outcomeLabels.forEach((label) => { label.textContent = "ROLLING"; });

    if (reducedMotion.matches) {
      activeRolls.forEach((roll) => {
        roll.group.position.copy(roll.restPosition);
        roll.group.quaternion.copy(roll.target);
      });
      setRollResults();
      renderer.render(scene, camera);
      return;
    }

    previousFrameTime = null;
    status.textContent = "ROLLING...";
    ensureRenderLoop();
  }

  function rotateDieByAngularVelocity(roll, delta) {
    const spin = roll.flight.angularVelocity;
    const speed = Math.hypot(spin.x, spin.y, spin.z);
    if (speed < 1e-5) return;
    const axis = new THREE.Vector3(spin.x / speed, spin.y / speed, spin.z / speed);
    roll.group.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, speed * delta));
    roll.group.quaternion.normalize();
  }

  function updateRoll(deltaSeconds) {
    if (!rolling) return;
    for (const roll of activeRolls) {
      const previousElapsed = roll.elapsed;
      roll.elapsed = Math.min(DICE_FLIGHT_DURATION + DICE_SETTLE_DURATION, roll.elapsed + deltaSeconds);
      const flightDelta = Math.max(0, Math.min(roll.elapsed, DICE_FLIGHT_DURATION) - previousElapsed);
      roll.flightAccumulator += flightDelta;
      while (roll.flightAccumulator + 1e-9 >= DICE_FLIGHT_STEP) {
        stepDiceFlight(roll.flight, DICE_FLIGHT_STEP);
        rotateDieByAngularVelocity(roll, DICE_FLIGHT_STEP);
        roll.flightAccumulator -= DICE_FLIGHT_STEP;
      }

      if (roll.elapsed < DICE_FLIGHT_DURATION) {
        roll.group.position.set(roll.flight.position.x, roll.flight.position.y, roll.flight.position.z);
        continue;
      }

      if (!roll.settlePosition) {
        roll.settlePosition = roll.group.position.clone();
        roll.settleQuaternion = roll.group.quaternion.clone();
      }
      const settleProgress = Math.min(1, (roll.elapsed - DICE_FLIGHT_DURATION) / DICE_SETTLE_DURATION);
      const eased = settleProgress * settleProgress * (3 - 2 * settleProgress);
      roll.group.position.lerpVectors(roll.settlePosition, roll.restPosition, eased);
      roll.group.quaternion.slerpQuaternions(roll.settleQuaternion, roll.target, eased);
    }

    if (activeRolls.every((roll) => roll.elapsed >= DICE_FLIGHT_DURATION + DICE_SETTLE_DURATION)) {
      activeRolls.forEach((roll) => {
        roll.group.position.copy(roll.restPosition);
        roll.group.quaternion.copy(roll.target);
      });
      setRollResults();
    }
  }

  function render(time) {
    frame = 0;
    if (!isOpen || !renderer || !scene || !camera) return;
    const deltaSeconds = previousFrameTime === null ? 0 : Math.min(0.05, Math.max(0, (time - previousFrameTime) / 1000));
    previousFrameTime = time;
    updateRoll(deltaSeconds);
    renderer.render(scene, camera);
    if (rolling) frame = requestAnimationFrame(render);
  }

  function ensureRenderLoop() {
    if (isOpen && !document.hidden && !frame) frame = requestAnimationFrame(render);
  }

  async function loadDiceModel() {
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      createDiceRenderer();
      resizeRenderer();
      status.textContent = "LOADING THE DICE MODEL...";
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync("/ramblegamble/assets/dice-source/dice%20blank.gltf");
      const base = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(base);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const scale = 2.36 / Math.max(size.x, size.y, size.z);

      for (const dieState of dieStates) {
        const model = base.clone(true);
        model.scale.setScalar(scale);
        model.position.copy(center).multiplyScalar(-scale);
        prepareUnlitModel(model);
        dieState.group.add(model);
        addFaceStickers(dieState);
      }
      rollButton.disabled = false;
      status.textContent = "SET THE FACES, THEN ROLL";
      ensureRenderLoop();
    })().catch((error) => {
      console.error("Ramble Gamble dice model failed to load:", error);
      status.textContent = "THE DICE MODEL COULD NOT LOAD";
      rollButton.disabled = true;
      loadPromise = null;
    });
    return loadPromise;
  }

  function finishClosingDiceMode() {
    if (!isClosing) return;
    isClosing = false;
    isOpen = false;
    if (closeFadeTimeout) window.clearTimeout(closeFadeTimeout);
    closeFadeTimeout = 0;
    dialog.removeEventListener("transitionend", onDiceDialogTransitionEnd);
    cancelAnimationFrame(frame);
    frame = 0;
    previousFrameTime = null;
    if (dialog.open) dialog.close();
    dialog.classList.remove("rg-dice-entering", "rg-dice-exiting");
    liquid.removeAttribute("src");
    document.body.classList.remove("rg-dice-mode-open");
    window.dispatchEvent(new CustomEvent("rg:dice-mode-state", { detail: { open: false } }));
    document.getElementById("rg-canvas")?.focus({ preventScroll: true });
  }

  function onDiceDialogTransitionEnd(event) {
    if (event.target === dialog && event.propertyName === "opacity" && isClosing) {
      finishClosingDiceMode();
    }
  }

  function openDiceMode() {
    if (isOpen) return;
    isOpen = true;
    isClosing = false;
    dialog.classList.remove("rg-dice-exiting");
    dialog.classList.add("rg-dice-entering");
    dialog.showModal();
    document.body.classList.add("rg-dice-mode-open");
    liquid.src = "/liquid/?theatre=on";
    window.dispatchEvent(new CustomEvent("rg:dice-mode-state", { detail: { open: true } }));
    loadDiceModel();
    ensureRenderLoop();

    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!isOpen || isClosing) return;
      dialog.classList.remove("rg-dice-entering");
      returnButton.focus({ preventScroll: true });
    }));
  }

  function closeDiceMode() {
    if (!isOpen || isClosing) return;
    const wasEntering = dialog.classList.contains("rg-dice-entering");
    isClosing = true;
    dialog.classList.remove("rg-dice-entering");
    dialog.classList.add("rg-dice-exiting");
    if (reducedMotion.matches || wasEntering || !dialog.open) {
      finishClosingDiceMode();
      return;
    }
    dialog.addEventListener("transitionend", onDiceDialogTransitionEnd);
    closeFadeTimeout = window.setTimeout(finishClosingDiceMode, 420);
  }

  buildFacePickers();
  returnButton.addEventListener("click", closeDiceMode);
  rollButton.addEventListener("click", startRoll);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDiceMode();
  });
  window.addEventListener("rg:open-dice-mode", openDiceMode);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
      previousFrameTime = null;
    } else {
      previousFrameTime = null;
      ensureRenderLoop();
    }
  });
})();
