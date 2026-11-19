import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  DICE_ASSET_CYCLE,
  DICE_FACE_ORDER,
  nextDiceAsset,
} from "./dice-game-state.mjs?v=dice-berry-assets-20261120-v1";
import {
  createDiceBody,
  createDicePhysicsWorld,
  createDiceThrow,
  getUpwardFaceIndex,
  prepareDiceBodyForThrow,
  resizeDiceBody,
  stepDicePhysics,
} from "./dice-roll-physics.mjs?v=dice-rigid-body-physics-20261120-v1";

(() => {
  "use strict";

  const dialog = document.getElementById("rg-dice-dialog");
  const canvas = document.getElementById("rg-dice-canvas");
  const liquid = document.getElementById("rg-dice-liquid");
  const returnButton = document.getElementById("rg-dice-return");
  const rollButton = document.getElementById("rg-dice-roll");
  const status = document.getElementById("rg-dice-status");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const dieStates = [
    { side: "left", assignments: Array(6).fill("blank"), group: null, stickers: [], body: null, baseHalfExtents: null, throwOrigin: null },
    { side: "right", assignments: Array(6).fill("blank"), group: null, stickers: [], body: null, baseHalfExtents: null, throwOrigin: null },
  ];
  const berryImages = new Map();
  let renderer = null;
  let scene = null;
  let camera = null;
  let CANNON = null;
  let physicsWorld = null;
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
    const value = document.createElement("img");
    value.className = "rg-die-face-value";
    value.alt = "";
    value.setAttribute("aria-hidden", "true");
    value.draggable = false;
    button.append(faceLabel, value);
    button.addEventListener("click", () => {
      if (rolling) return;
      const next = nextDiceAsset(dieState.assignments[faceIndex]);
      dieState.assignments[faceIndex] = next.id;
      updateFaceButton(button, face, next.id);
      updateSticker(dieState, faceIndex, next.id);
      status.textContent = "";
      status.dataset.state = "idle";
      ensureRenderLoop();
    });
    updateFaceButton(button, face, dieState.assignments[faceIndex]);
    parent.append(button);
  }

  function updateFaceButton(button, face, assetId) {
    const asset = DICE_ASSET_CYCLE.find((choice) => choice.id === assetId) || DICE_ASSET_CYCLE[0];
    const image = button.querySelector(".rg-die-face-value");
    if (asset.imageSrc) {
      image.src = asset.imageSrc;
      image.hidden = false;
    } else {
      image.removeAttribute("src");
      image.hidden = true;
    }
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

    const image = berryImages.get(assetId);
    if (!image?.complete || !image.naturalWidth) return;
    context.drawImage(image, 0, 0, stickerCanvas.width, stickerCanvas.height);
  }

  function createStickerCanvas(assetId) {
    const stickerCanvas = document.createElement("canvas");
    stickerCanvas.width = 256;
    stickerCanvas.height = 256;
    paintStickerCanvas(stickerCanvas, assetId);
    return stickerCanvas;
  }

  function preloadBerryImages() {
    for (const asset of DICE_ASSET_CYCLE) {
      if (!asset.imageSrc || berryImages.has(asset.id)) continue;
      const image = new Image();
      image.decoding = "async";
      image.addEventListener("load", () => {
        for (const dieState of dieStates) {
          dieState.assignments.forEach((assignedAsset, faceIndex) => {
            if (assignedAsset === asset.id) updateSticker(dieState, faceIndex, assignedAsset);
          });
        }
        ensureRenderLoop();
      }, { once: true });
      berryImages.set(asset.id, image);
      image.src = asset.imageSrc;
    }
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
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.98, 1.98), material);
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
    camera = new THREE.PerspectiveCamera(40, 1, 0.1, 80);
    camera.position.set(0, 5.14, 9.2);
    camera.lookAt(0, 1, 0);

    for (const [index, dieState] of dieStates.entries()) {
      dieState.group = new THREE.Group();
      dieState.group.position.x = index === 0 ? -1.4 : 1.4;
      scene.add(dieState.group);
    }

    window.addEventListener("resize", resizeRenderer, { passive: true });
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      rollButton.disabled = true;
      status.dataset.state = "error";
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
    camera.position.y = 1 + camera.position.z * 0.445;
    camera.lookAt(0, 1, 0);
    const spread = compact ? 0.82 : 1.4;
    for (const [index, dieState] of dieStates.entries()) {
      const group = dieState.group;
      if (!group) continue;
      const nextX = index === 0 ? -spread : spread;
      const shift = nextX - group.position.x;
      group.position.x = nextX;
      group.scale.setScalar(compact ? 0.78 : 1);
      if (dieState.body && CANNON && dieState.baseHalfExtents) {
        const body = dieState.body;
        body.position.x += shift;
        body.previousPosition.x += shift;
        body.interpolatedPosition.x += shift;
        const scale = group.scale.x;
        const halfExtents = dieState.baseHalfExtents.map((extent) => extent * scale);
        resizeDiceBody(body, halfExtents);
        dieState.throwOrigin = [group.position.x, halfExtents[1], dieState.throwOrigin?.[2] ?? group.position.z];
        group.position.set(body.position.x, body.position.y, body.position.z);
      }
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

  function setRollResults() {
    const labels = activeRolls.map(({ body, dieState }) => {
      const faceIndex = getUpwardFaceIndex(body.quaternion, DICE_FACE_ORDER);
      const asset = dieState.assignments[faceIndex];
      return asset;
    });
    rolling = false;
    activeRolls = [];
    previousFrameTime = null;
    rollButton.disabled = false;
    for (const picker of document.querySelectorAll(".rg-die-face-button")) picker.disabled = false;
    status.dataset.state = "complete";
    status.replaceChildren();
    labels.forEach((assetId, index) => {
      const asset = DICE_ASSET_CYCLE.find((choice) => choice.id === assetId) || DICE_ASSET_CYCLE[0];
      if (index) status.append(document.createTextNode(" - "));
      const result = document.createElement("span");
      result.className = "rg-dice-result";
      const side = document.createElement("span");
      side.textContent = index === 0 ? "LEFT" : "RIGHT";
      result.append(side);
      if (asset.imageSrc) {
        const image = document.createElement("img");
        image.src = asset.imageSrc;
        image.alt = asset.label;
        image.className = "rg-dice-result-image";
        result.append(image);
      } else {
        const blank = document.createElement("span");
        blank.className = "rg-dice-result-blank";
        blank.setAttribute("role", "img");
        blank.setAttribute("aria-label", "Blank");
        result.append(blank);
      }
      status.append(result);
    });
  }

  function startRoll() {
    if (rolling || !renderer || !CANNON || !physicsWorld
      || dieStates.some(({ body, stickers }) => !body || stickers.length !== DICE_FACE_ORDER.length)) return;
    rolling = true;
    rollButton.disabled = true;
    for (const picker of document.querySelectorAll(".rg-die-face-button")) picker.disabled = true;
    physicsWorld.accumulator = 0;
    activeRolls = dieStates.map((dieState, index) => {
      const { body, group } = dieState;
      const lane = index === 0 ? -1 : 1;
      const launch = createDiceThrow({
        restPosition: dieState.throwOrigin || [body.position.x, body.position.y, body.position.z],
        lane,
        random: cryptoRandomUnit,
        reducedMotion: reducedMotion.matches,
      });
      prepareDiceBodyForThrow(CANNON, body, launch);
      group.position.set(...launch.position);
      group.quaternion.set(...launch.quaternion);
      return { body, group, dieState };
    });
    previousFrameTime = null;
    status.dataset.state = "rolling";
    status.textContent = "ROLLING";
    ensureRenderLoop();
  }

  function updateRoll(deltaSeconds) {
    if (!rolling || !physicsWorld || !CANNON) return;
    stepDicePhysics(physicsWorld, deltaSeconds);
    for (const { body, group } of activeRolls) {
      const position = body.interpolatedPosition;
      const orientation = body.interpolatedQuaternion;
      group.position.set(position.x, position.y, position.z);
      group.quaternion.set(orientation.x, orientation.y, orientation.z, orientation.w);
    }

    if (activeRolls.every(({ body }) => body.sleepState === CANNON.Body.SLEEPING)) {
      for (const { body, group } of activeRolls) {
        group.position.set(body.position.x, body.position.y, body.position.z);
        group.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
      }
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
      status.dataset.state = "loading";
      status.textContent = "LOADING";
      const loader = new GLTFLoader();
      const [gltf, cannonModule] = await Promise.all([
        loader.loadAsync("/ramblegamble/assets/dice-source/dice%20blank.gltf"),
        import("cannon-es"),
      ]);
      CANNON = cannonModule;
      physicsWorld = createDicePhysicsWorld(CANNON);
      const base = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(base);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const scale = 2.36 / Math.max(size.x, size.y, size.z);
      const baseHalfExtents = [size.x * scale / 2, size.y * scale / 2, size.z * scale / 2];

      for (const dieState of dieStates) {
        const model = base.clone(true);
        model.scale.setScalar(scale);
        model.position.copy(center).multiplyScalar(-scale);
        prepareUnlitModel(model);
        dieState.group.add(model);
        addFaceStickers(dieState);
        dieState.baseHalfExtents = baseHalfExtents;
        const halfExtents = baseHalfExtents.map((extent) => extent * dieState.group.scale.x);
        const initialPosition = [dieState.group.position.x, halfExtents[1], dieState.group.position.z];
        dieState.group.position.set(...initialPosition);
        dieState.throwOrigin = [...initialPosition];
        dieState.body = createDiceBody(CANNON, physicsWorld, halfExtents, initialPosition);
      }
      rollButton.disabled = false;
      status.textContent = "";
      status.dataset.state = "idle";
      ensureRenderLoop();
    })().catch((error) => {
      console.error("Ramble Gamble dice model failed to load:", error);
      status.dataset.state = "error";
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

  preloadBerryImages();
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
