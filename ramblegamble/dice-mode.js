import { audienceReact } from "./audience-state.mjs?v=show-energy-20261127-v1";
import { createFocusOrbit, orbitPosition, bindFocusDrag } from "./focus-orbit.mjs?v=settlement-hover-20261127-v1";
import { VIP_LIQUID_SOURCE } from "./vip-liquid-preset.mjs?v=vip-black-liquid-20261126-v1";
import { foley } from "./game-foley.mjs?v=theatre-20261127-v1";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  DICE_ASSET_CYCLE,
  DICE_FACE_ORDER,
  nextDiceAsset,
} from "./dice-game-state.mjs?v=dice-berry-assets-20261120-v1";
import {
  DICE_PHYSICS_FIXED_STEP,
  createDiceBody,
  createDicePhysicsWorld,
  createDiceThrow,
  getUpwardFaceIndex,
  prepareDiceBodyForThrow,
  stepDicePhysics,
} from "./dice-roll-physics.mjs?v=dice-impact-20261127-v1";

import { createDiceEffects, collectDiceContact, collectDiceReimpacts, diceCameraDistance } from "./dice-effects.mjs?v=vip-focus-20261127-v1";

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
  let lastImpactAt = -Infinity;
  let effects = null;
  const pendingImpacts = new Map();
  let previousImpulses = new Map();
  let rollElapsed = 0;
  let graphicsLost = false;
  let lastFaces = null;
  let activeRolls = [];
  let isOpen = false;
  let isClosing = false;
  let closeFadeTimeout = 0;
  const diceOrbit = createFocusOrbit();
  const diceTarget = {x:0,y:1.65,z:0};
  let diceBase = null;
  function setStaffVisible(visible) {
    for (const picker of dialog.querySelectorAll(".rg-die-picker")) picker.hidden = !visible;
    dialog.classList.toggle("is-staff", visible);
  }
  const diceDrag = bindFocusDrag(dialog, {
    enabled: event => isOpen && !isClosing && !graphicsLost && !document.hidden && !event.target.closest?.("button, .rg-die-picker") && !document.documentElement.hasAttribute("data-rg-host-locked"),
    hoverEnabled: event => isOpen && !isClosing && !graphicsLost && !document.hidden && !reducedMotion.matches
      && !event.target.closest?.("button, .rg-die-picker") && !document.documentElement.hasAttribute("data-rg-host-locked"),
    move: (dx,dy) => diceOrbit.nudge(dx,dy), onMove: ensureRenderLoop,
    follow: (x,y) => diceOrbit.follow(x,y), hold: () => diceOrbit.hold(), onHover: ensureRenderLoop,
  });

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
      if (rolling || isClosing || graphicsLost) return;
      effects?.clear(); lastFaces = null;
      const next = nextDiceAsset(dieState.assignments[faceIndex]);
      dieState.assignments[faceIndex] = next.id;
      foley.play("diceFace");
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
    camera = new THREE.PerspectiveCamera(43, 1, 0.1, 100);
    camera.position.set(0, 5.14, 9.2);
    camera.lookAt(0, 1, 0);

    for (const [index, dieState] of dieStates.entries()) {
      dieState.group = new THREE.Group();
      dieState.group.position.x = index === 0 ? -1.4 : 1.4;
      scene.add(dieState.group);
    }

    effects = createDiceEffects(THREE, scene, dieStates);
    window.addEventListener("resize", resizeRenderer, { passive: true });
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      graphicsLost = true;
      cancelAnimationFrame(frame); frame = 0; previousFrameTime = null;
      foley.stop("dice-grab"); foley.stop("dice-impact"); foley.stop("dice-settlement");
      rollButton.disabled = true;
      status.dataset.state = "error";
      status.textContent = "DICE PAUSED - GRAPHICS CONTEXT LOST";
    });
    canvas.addEventListener("webglcontextrestored", () => {
      graphicsLost = false;
      if (rolling) abortRoll();
      else { status.textContent = ""; status.dataset.state = "idle"; effects?.clear(); lastFaces=null; }
      rollButton.disabled = !dieStates.every(d => d.body);
      ensureRenderLoop();
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
    // Only reframe the camera: resizing or rotating the screen must never move
    // a body, change a collider, alter a roll or invalidate a settled result.
    const elevation = Math.atan(.53), sin = Math.sin(elevation), cos = Math.cos(elevation);
    const distance = diceCameraDistance(camera.aspect, camera.fov, diceTarget.y, elevation);
    camera.position.set(0,diceTarget.y+distance*sin,distance*cos);
    diceBase = {x:0,y:camera.position.y,z:camera.position.z};
    camera.lookAt(0,diceTarget.y,0);
    camera.updateProjectionMatrix();
    if (isOpen && scene) ensureRenderLoop();
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
    if (!rolling || activeRolls.length !== dieStates.length) return;
    lastFaces = [];
    const labels = activeRolls.map(({ body, dieState }, index) => {
      const faceIndex = getUpwardFaceIndex(body.quaternion, DICE_FACE_ORDER);
      const asset = dieState.assignments[faceIndex];
      lastFaces.push({face:DICE_FACE_ORDER[faceIndex],asset});
      effects?.land(index, DICE_FACE_ORDER[faceIndex], asset, reducedMotion.matches);
      return asset;
    });
    foley.stop("dice-grab");
    foley.stop("dice-impact");
    foley.start("dice-settlement", "settlement");
    audienceReact("cheer");
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
      result.dataset.asset = asset.id;
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
    if (rolling || !isOpen || isClosing || graphicsLost || !renderer || !CANNON || !physicsWorld
      || dieStates.some(({ body, stickers }) => !body || stickers.length !== DICE_FACE_ORDER.length)) return;
    foley.stop("dice-settlement");
    rolling = true; lastFaces = null;
    effects?.clear();
    pendingImpacts.clear(); previousImpulses.clear();
    rollElapsed = 0;
    physicsWorld.collisionMatrix.reset();
    physicsWorld.collisionMatrixPrevious.reset();
    lastImpactAt = -Infinity;
    foley.start("dice-grab", "diceGrab");
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
    rollElapsed += deltaSeconds;
    stepDicePhysics(physicsWorld, deltaSeconds);
    for (const hit of pendingImpacts.values()) {
      effects?.impact(hit, reducedMotion.matches);
      const time = performance.now();
      if (hit.speed >= .8 && time - lastImpactAt >= 125) {
        lastImpactAt = time;
        foley.start("dice-impact", "diceImpact", { volume: Math.min(1, .25 + hit.speed / 6) });
      }
    }
    pendingImpacts.clear();
    if (rollElapsed > 25 || activeRolls.some(({body}) =>
      ![body.position.x,body.position.y,body.position.z,body.quaternion.x,body.quaternion.y,body.quaternion.z,body.quaternion.w].every(Number.isFinite)
      || Math.abs(body.position.x)>8 || Math.abs(body.position.z)>7 || body.position.y>12 || body.position.y<-.5)) {
      abortRoll(); return;
    }
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

  // Exceptional simulation failure is an explicit retry, never a made-up face.
  function abortRoll() {
    rolling=false; lastFaces=null; activeRolls=[]; pendingImpacts.clear(); previousImpulses.clear(); effects?.clear();
    foley.stop("dice-grab"); foley.stop("dice-impact"); foley.stop("dice-settlement");
    for (const {body,group,throwOrigin} of dieStates) {
      if (!body) continue;
      prepareDiceBodyForThrow(CANNON,body,{position:throwOrigin,quaternion:[0,0,0,1],velocity:[0,0,0],angularVelocity:[0,0,0]});
      body.sleep(); group.position.set(...throwOrigin); group.quaternion.set(0,0,0,1);
    }
    rollButton.disabled=graphicsLost;
    for (const picker of document.querySelectorAll(".rg-die-face-button")) picker.disabled=false;
    status.dataset.state="idle"; status.textContent="ROLL AGAIN";
  }

  function render(time) {
    frame = 0;
    if (!isOpen || isClosing || !dialog.open || document.hidden || graphicsLost || !renderer || !scene || !camera) return;
    const deltaSeconds = previousFrameTime === null ? 0 : Math.min(0.05, Math.max(0, (time - previousFrameTime) / 1000));
    previousFrameTime = time;
    updateRoll(deltaSeconds);
    const orbit = diceOrbit.step(time, reducedMotion.matches);
    if (diceBase) { const pos=orbitPosition(diceBase,diceTarget,orbit.yaw,orbit.pitch);camera.position.set(pos.x,pos.y,pos.z);camera.lookAt(0,diceTarget.y,0); }
    const effectsMoving = effects?.update(deltaSeconds, rolling, reducedMotion.matches);
    renderer.render(scene, camera);
    if (rolling || orbit.moving || effectsMoving) frame = requestAnimationFrame(render);
  }

  function ensureRenderLoop() {
    if (isOpen && !isClosing && dialog.open && !graphicsLost && !document.hidden && !frame) frame = requestAnimationFrame(render);
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
      physicsWorld.addEventListener("preStep", () => {
        if (!rolling || !isOpen || isClosing || document.hidden) return;
        previousImpulses = collectDiceReimpacts(pendingImpacts, physicsWorld.contacts, previousImpulses,
          physicsWorld.stepnumber, DICE_PHYSICS_FIXED_STEP);
      });
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
        dieState.body.addEventListener("collide", (event) => {
          if (!rolling || !isOpen || isClosing || document.hidden) return;
          collectDiceContact(pendingImpacts, event.contact, physicsWorld.stepnumber);
        });
      }
      rollButton.disabled = graphicsLost;
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
    setStaffVisible(false); diceDrag.reset(); foley.stop("dice-settlement");
    effects?.clear(); pendingImpacts.clear(); previousImpulses.clear();
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

  function openDiceMode(event) {
    if (isOpen && !dialog.open) { isClosing=true; finishClosingDiceMode(); }
    if (isOpen) { if(event?.detail?.staff) setStaffVisible(true); return; }
    setStaffVisible(Boolean(event?.detail?.staff));
    diceOrbit.reset("dice"); diceDrag.reset();
    foley.play("portal");
    isOpen = true;
    isClosing = false;
    dialog.classList.remove("rg-dice-exiting");
    dialog.classList.add("rg-dice-entering");
    dialog.showModal();
    document.body.classList.add("rg-dice-mode-open");
    liquid.src = VIP_LIQUID_SOURCE;
    window.dispatchEvent(new CustomEvent("rg:dice-mode-state", { detail: { open: true } }));
    loadDiceModel();
    if (!rolling && lastFaces) lastFaces.forEach(({face,asset},index)=>effects?.land(index,face,asset,true,true));
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
    effects?.clear(); pendingImpacts.clear(); previousImpulses.clear();
    foley.stop("dice-grab");
    foley.stop("dice-impact");
    foley.stop("dice-settlement");
    foley.play("portalExit");
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
  dialog.addEventListener("contextmenu", event => {
    if (!isOpen || isClosing) return;
    event.preventDefault(); setStaffVisible(!dialog.classList.contains("is-staff"));
  });
  dialog.addEventListener("keydown", event => {
    if(event.shiftKey && event.key.toLowerCase()==="d") {event.preventDefault();setStaffVisible(!dialog.classList.contains("is-staff"));}
    else if(event.target === dialog || event.target === returnButton) {
      const moves={ArrowLeft:[.012,0],ArrowRight:[-.012,0],ArrowUp:[0,.012],ArrowDown:[0,-.012]};
      if(moves[event.key]) {event.preventDefault();diceDrag.stopFollowing();diceOrbit.nudge(...moves[event.key]);ensureRenderLoop();}
    }
  });
  dialog.addEventListener("close", () => { if (isOpen && !dialog.open) { isClosing=true; finishClosingDiceMode(); } });
  reducedMotion.addEventListener?.("change", () => { if (reducedMotion.matches) diceDrag.clearHover(); ensureRenderLoop(); });
  window.addEventListener("blur", () => diceDrag.clearHover());
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDiceMode();
  });
  window.addEventListener("rg:open-dice-mode", openDiceMode);
  window.addEventListener("rg:close-dice-mode", closeDiceMode);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      diceDrag.clearHover();
      cancelAnimationFrame(frame);
      frame = 0;
      previousFrameTime = null;
      pendingImpacts.clear(); previousImpulses.clear();
      foley.stop("dice-grab"); foley.stop("dice-impact"); foley.stop("dice-settlement");
    } else {
      previousFrameTime = null;
      ensureRenderLoop();
    }
  });
})();
