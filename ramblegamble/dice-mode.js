import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  chooseDiceOutcome,
  DICE_ASSET_CYCLE,
  DICE_FACE_ORDER,
  nextDiceAsset,
} from "./dice-game-state.mjs?v=dice-game-state-20261119-v1";

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
  let loadPromise = null;
  let rolling = false;
  let rollStarted = 0;
  let rollDuration = 1900;
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

  function createStickerCanvas(assetId) {
    const stickerCanvas = document.createElement("canvas");
    stickerCanvas.width = 256;
    stickerCanvas.height = 256;
    const context = stickerCanvas.getContext("2d");
    context.clearRect(0, 0, 256, 256);
    if (assetId === "blank") return stickerCanvas;

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
    return stickerCanvas;
  }

  function setStickerTexture(sticker, assetId) {
    const context = sticker.canvas.getContext("2d");
    context.clearRect(0, 0, sticker.canvas.width, sticker.canvas.height);
    const nextCanvas = createStickerCanvas(assetId);
    context.drawImage(nextCanvas, 0, 0);
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
    dieStates[0].group.position.x = -spread;
    dieStates[1].group.position.x = spread;
    for (const dieState of dieStates) {
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

  function startRoll() {
    if (rolling || !renderer || dieStates.some(({ stickers }) => stickers.length !== DICE_FACE_ORDER.length)) return;
    rolling = true;
    rollButton.disabled = true;
    for (const picker of document.querySelectorAll(".rg-die-face-button")) picker.disabled = true;
    const results = dieStates.map(({ assignments }) => chooseDiceOutcome(assignments, cryptoRandomUnit));
    activeRolls = results.map((result, index) => {
      const group = dieStates[index].group;
      const from = group.quaternion.clone();
      const normal = new THREE.Vector3(...result.face.normal);
      const align = new THREE.Quaternion().setFromUnitVectors(normal, new THREE.Vector3(0, 0, 1));
      const twist = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), cryptoRandomUnit() * Math.PI * 2);
      const target = twist.multiply(align);
      return {
        group,
        from,
        target,
        result,
        spinAxis: new THREE.Vector3(0.7 + index * 0.12, 1, 0.46).normalize(),
      };
    });
    rollStarted = performance.now();
    rollDuration = reducedMotion.matches ? 250 : 1900;
    status.textContent = "ROLLING...";
    outcomeLabels.forEach((label) => { label.textContent = "ROLLING"; });
    ensureRenderLoop();
  }

  function updateRoll(time) {
    if (!rolling) return;
    const progress = Math.min(1, (time - rollStarted) / rollDuration);
    const eased = 1 - Math.pow(1 - progress, 4);
    for (const roll of activeRolls) {
      roll.group.quaternion.slerpQuaternions(roll.from, roll.target, eased);
      const spin = new THREE.Quaternion().setFromAxisAngle(roll.spinAxis, Math.PI * 8 * (1 - eased));
      roll.group.quaternion.premultiply(spin);
    }
    if (progress < 1) return;

    activeRolls.forEach((roll, index) => {
      roll.group.quaternion.copy(roll.target);
      const label = DICE_ASSET_CYCLE.find(({ id }) => id === roll.result.asset)?.label || "Blank";
      outcomeLabels[index].textContent = `${index === 0 ? "LEFT" : "RIGHT"}: ${label.toUpperCase()}`;
    });
    rolling = false;
    activeRolls = [];
    rollButton.disabled = false;
    for (const picker of document.querySelectorAll(".rg-die-face-button")) picker.disabled = false;
    status.textContent = "ROLL COMPLETE";
  }

  function render(time) {
    frame = 0;
    if (!isOpen || !renderer || !scene || !camera) return;
    updateRoll(time);
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

  function openDiceMode() {
    if (isOpen) return;
    isOpen = true;
    dialog.showModal();
    document.body.classList.add("rg-dice-mode-open");
    liquid.src = "/liquid/?theatre=on";
    window.dispatchEvent(new CustomEvent("rg:dice-mode-state", { detail: { open: true } }));
    loadDiceModel();
    ensureRenderLoop();
    returnButton.focus({ preventScroll: true });
  }

  function closeDiceMode() {
    if (!isOpen) return;
    isOpen = false;
    cancelAnimationFrame(frame);
    frame = 0;
    if (dialog.open) dialog.close();
    liquid.removeAttribute("src");
    document.body.classList.remove("rg-dice-mode-open");
    window.dispatchEvent(new CustomEvent("rg:dice-mode-state", { detail: { open: false } }));
    document.getElementById("rg-canvas")?.focus({ preventScroll: true });
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
    } else {
      ensureRenderLoop();
    }
  });
})();
