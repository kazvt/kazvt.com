import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  resolvePointClickAction,
  resolvePointClickCursor,
  resolvePointClickZone,
} from "./point-click-routing.js?v=point-click-20261115-v1";

(() => {
  "use strict";

  const preview = document.getElementById("rg-preview");
  const canvas = document.getElementById("rg-canvas");
  const billboardLayer = document.getElementById("rg-billboard-layer");
  const gameCursor = document.getElementById("rg-game-cursor");
  const gameCursorImage = document.getElementById("rg-game-cursor-image");
  const loading = document.getElementById("rg-loading");
  const result = document.getElementById("rg-result");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const FORCED_THEME = "p2";
  const ROULETTE_PART_NAMES = new Set(["center", "wheel", "rim", "ball"]);
  const SLOT_PART_NAMES = new Set(["machine", "arm", "button1", "button2", "button3", "button4", "button5"]);
  const BILLBOARD_SOURCES = [
    { id: "faroe", label: "Faroe", source: "" },
    { id: "erin", label: "Erin", source: "https://reactive.fugi.tech/basic/205887066855178244" },
    { id: "kaz", label: "Kaz", source: "https://reactive.fugi.tech/basic/796834631961935893" },
  ];
  const CURSOR_ASSETS = {
    default: "/ramblegamble/assets/cursors/pointer-default.gif",
    hover: "/ramblegamble/assets/cursors/pointer-hover.gif",
    direction: "/ramblegamble/assets/cursors/direction-right.gif",
  };
  const prompts = [
    "What tiny thing brings you an unreasonable amount of joy?",
    "Which game could you happily ramble about for an hour?",
    "What is your most specific current obsession?",
    "Which fictional place would you visit for one afternoon?",
    "What old internet thing do you wish would make a comeback?",
    "What song feels like the opening theme to your life lately?",
    "What is a small comfort you think everyone should try?",
    "Which character would you trust to plan a day out?",
    "What is something you learned recently and immediately told someone?",
    "If you could become excellent at one hobby overnight, which one?",
    "What food deserves way more appreciation?",
    "Tell us about a moment that felt like a side quest.",
    "Which creature would you invite to your little internet arcade?",
    "What is a delightfully niche hill you are willing to defend?",
    "What is the best thing you have found by wandering online?",
    "If today had a soundtrack, what would the next track be?",
  ];

  let renderer;
  let scene;
  let camera;
  let resizeObserver;
  let animationFrame = 0;
  let wheelPivot;
  let ballPivot;
  let lever;
  let rouletteRig;
  let slotRig;
  let rouletteTargets = [];
  let slotTargets = [];
  let wheelMotion = null;
  let leverMotion = null;
  let promptBag = [];
  let playing = false;
  let sceneReady = false;
  let stageModel;
  let rouletteModel;
  let slotsModel;
  let contestants = [];
  let contestantTargets = [];
  let currentView = { kind: "overview", look: 0 };
  let viewHistory = [];
  let cameraTarget = new THREE.Vector3();
  let cameraTransition = null;
  let cursorMode = "";

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
    scene.background = new THREE.Color(color);
    scene.fog.color.set(color);
    const bgColor = new THREE.Color(color);
    const accentColor = new THREE.Color(themeValue("--pink", "#f599c6"));
    const blueColor = new THREE.Color(themeValue("--blue", "#4d6787"));
    scene.traverse((object) => {
      if (object.userData.rgFloor) object.material.color.copy(bgColor);
      if (object.userData.rgAccent) object.material.color.copy(accentColor);
      if (object.userData.rgSecondary) object.material.color.copy(blueColor);
    });
    scene.children.forEach((child) => {
      if (child.userData.rgAccentLight) child.color.copy(accentColor);
    });
  }

  function shuffled(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function nextPrompt() {
    if (promptBag.length === 0) promptBag = shuffled(prompts);
    return promptBag.pop();
  }

  function finishTurn() {
    result.textContent = nextPrompt();
    result.hidden = false;
    playing = false;
    preview.classList.remove("is-playing");
    window.dispatchEvent(new CustomEvent("rg:turn-finish", { detail: { prompt: result.textContent } }));
  }

  function beginTurn(machine) {
    if (playing) return false;
    playing = true;
    preview.classList.add("is-playing");
    result.hidden = true;
    window.dispatchEvent(new CustomEvent("rg:turn-start", { detail: { machine } }));
    return true;
  }

  function startWheelSpin() {
    if (!beginTurn("wheel")) return;
    if (!wheelPivot || !ballPivot) {
      wheelMotion = { started: performance.now(), duration: 700, wheelFrom: 0, wheelTo: 0, ballFrom: 0, ballTo: 0 };
      return;
    }
    wheelMotion = {
      started: performance.now(),
      duration: reducedMotion.matches ? 650 : 3900,
      wheelFrom: wheelPivot.rotation.y,
      wheelTo: wheelPivot.rotation.y + (5 + Math.random() * 3) * Math.PI * 2 + Math.random() * Math.PI * 2,
      ballFrom: ballPivot.rotation.y,
      ballTo: ballPivot.rotation.y - (8 + Math.random() * 4) * Math.PI * 2 - Math.random() * Math.PI * 2,
    };
  }

  function startLeverPull() {
    if (!beginTurn("slot")) return;
    if (!lever) {
      leverMotion = { started: performance.now(), duration: 650, base: 0 };
      return;
    }
    leverMotion = {
      started: performance.now(),
      duration: reducedMotion.matches ? 500 : 1700,
      base: lever.rotation.z,
    };
  }

  applyTheme();

  function createWorld() {
    const bg = themeValue("--bg", "#17213c");
    scene = new THREE.Scene();
    scene.background = new THREE.Color(bg);
    scene.fog = new THREE.Fog(bg, 120, 230);

    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 320);
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    scene.add(new THREE.HemisphereLight(0xfff4e8, 0x282044, 2.0));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.0);
    keyLight.position.set(-22, 38, 32);
    scene.add(keyLight);
    const accentLight = new THREE.PointLight(themeValue("--pink", "#f599c6"), 90, 130, 2);
    accentLight.position.set(22, 17, 17);
    accentLight.userData.rgAccentLight = true;
    scene.add(accentLight);
    const fillLight = new THREE.PointLight(themeValue("--blue", "#4d6787"), 55, 120, 2);
    fillLight.position.set(-30, 6, -18);
    scene.add(fillLight);

    rouletteRig = new THREE.Group();
    scene.add(rouletteRig);

    slotRig = new THREE.Group();
    slotRig.rotation.y = Math.PI;
    scene.add(slotRig);

  }

  function fitCamera() {
    if (!camera || !renderer || !sceneReady) return;
    const width = Math.max(1, preview.clientWidth);
    const height = Math.max(1, preview.clientHeight);
    const aspect = width / height;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setSize(width, height, false);

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
    const yaw = -view.look * 0.42;
    const direction = new THREE.Vector3(Math.sin(yaw), 0.38, Math.cos(yaw) * 0.925).normalize();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(worldUp, direction).normalize();
    const viewUp = new THREE.Vector3().crossVectors(direction, right).normalize();
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

    distance = Math.max(distance, 1) * (view.kind === "overview" ? 1.14 : 1.18);
    return { target, position: target.clone().addScaledVector(direction, distance) };
  }

  function getViewBounds(view) {
    const bounds = new THREE.Box3().makeEmpty();
    scene?.updateMatrixWorld(true);

    if (view.kind === "overview") return getArcadeBounds();
    if (view.kind === "contestants") return getContestantsBounds();
    if (view.kind === "contestant") {
      const contestant = contestants.find((entry) => entry.id === view.contestantId);
      if (!contestant) return getContestantsBounds();
      bounds.expandByObject(contestant.hitProxy);
      addBillboardBounds(bounds, contestant);
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

  function transitionToView(nextView, { record = true, immediate = false } = {}) {
    const sameView = currentView.kind === nextView.kind && currentView.contestantId === nextView.contestantId;
    if (record && !sameView) viewHistory.push({ ...currentView });
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
      duration: 460,
      fromPosition: camera.position.clone(),
      fromTarget: cameraTarget.clone(),
      toPosition: pose.position,
      toTarget: pose.target,
    };
  }

  function setLookDirection(look) {
    if (cameraTransition || currentView.look === look) return;
    transitionToView({ ...currentView, look }, { record: false });
  }

  function canGoBack() {
    return currentView.look !== 0 || viewHistory.length > 0;
  }

  function goBack() {
    if (cameraTransition) return;
    if (currentView.look !== 0) {
      setLookDirection(0);
      return;
    }
    const previous = viewHistory.pop();
    if (previous) transitionToView(previous, { record: false });
  }

  function getArcadeBounds() {
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
      if (!/^(chair|tall_chair)$/i.test(object.name)) return;
      const chairBounds = new THREE.Box3().setFromObject(object);
      if (chairBounds.isEmpty()) return;
      const chairCenter = chairBounds.getCenter(new THREE.Vector3());
      const distance = Math.hypot(chairCenter.x - tableCenter.x, chairCenter.z - tableCenter.z);
      if (distance < 2.2) bounds.union(chairBounds);
    });

    if (rouletteRig) bounds.expandByObject(rouletteRig);
    if (slotRig) bounds.expandByObject(slotRig);
    return bounds;
  }

  function placeMachinesFromStage() {
    const table = stageModel?.getObjectByName("table");
    if (!table || !rouletteModel || !slotsModel) {
      throw new Error("The supplied stage is missing the table or machine model.");
    }

    scene.updateMatrixWorld(true);
    const tableBounds = new THREE.Box3().setFromObject(table);
    const tableSize = tableBounds.getSize(new THREE.Vector3());
    const tableCenter = tableBounds.getCenter(new THREE.Vector3());
    const floorY = tableBounds.min.y;

    // The archive's roulette is authored about 40 units across while the
    // table is only 1.57 units deep. Fit the rim to the table footprint and
    // rest its lowest point exactly on the tabletop.
    rouletteRig.position.set(tableCenter.x, 0, tableCenter.z);
    rouletteModel.scale.setScalar(1);
    rouletteModel.position.set(0, 0, 0);
    rouletteModel.updateMatrixWorld(true);
    const rouletteSourceBounds = new THREE.Box3().setFromObject(rouletteModel);
    const rouletteSourceSize = rouletteSourceBounds.getSize(new THREE.Vector3());
    const rouletteDiameter = Math.max(rouletteSourceSize.x, rouletteSourceSize.z);
    const rouletteScale = (Math.min(tableSize.x, tableSize.z) * 0.72) / rouletteDiameter;
    rouletteModel.scale.setScalar(rouletteScale);
    rouletteModel.updateMatrixWorld(true);
    const rouletteBounds = new THREE.Box3().setFromObject(rouletteModel);
    rouletteModel.position.y += tableBounds.max.y - rouletteBounds.min.y;

    // The slot cabinet has its own unrelated export scale. Size it against
    // the tall chairs in the same supplied scene, then place it beside the
    // table with enough room for the adjacent chair.
    const tallChair = stageModel.getObjectByName("tall_chair");
    const tallChairBounds = tallChair
      ? new THREE.Box3().setFromObject(tallChair)
      : tableBounds;
    const tallChairSize = tallChairBounds.getSize(new THREE.Vector3());
    const slotSourceBounds = new THREE.Box3().setFromObject(slotsModel);
    const slotSourceSize = slotSourceBounds.getSize(new THREE.Vector3());
    const slotScale = (tallChairSize.y * 1.55) / slotSourceSize.y;
    slotsModel.scale.setScalar(slotScale);
    slotsModel.position.set(0, 0, 0);
    slotRig.position.set(0, 0, 0);
    slotRig.updateMatrixWorld(true);
    slotsModel.updateMatrixWorld(true);
    const slotBounds = new THREE.Box3().setFromObject(slotsModel);
    const slotSize = slotBounds.getSize(new THREE.Vector3());
    const slotCenter = slotBounds.getCenter(new THREE.Vector3());
    const slotTargetCenter = new THREE.Vector3(
      tableBounds.max.x + slotSize.x / 2 + 0.42,
      floorY,
      tableCenter.z - 0.3,
    );
    slotRig.position.set(
      slotTargetCenter.x - slotCenter.x,
      0,
      slotTargetCenter.z - slotCenter.z,
    );
    slotRig.updateMatrixWorld(true);
    const groundedSlotBounds = new THREE.Box3().setFromObject(slotsModel);
    slotRig.position.y = floorY - groundedSlotBounds.min.y;
  }

  function prepareModel(root) {
    root.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (material?.map) {
          material.map.colorSpace = THREE.SRGBColorSpace;
          material.map.magFilter = THREE.NearestFilter;
          material.map.minFilter = THREE.NearestMipmapLinearFilter;
          material.map.generateMipmaps = true;
          material.map.needsUpdate = true;
        }
        if (material) {
          material.roughness = 0.82;
          material.metalness = 0.02;
          material.needsUpdate = true;
        }
      }
    });
  }

  function setupPicking() {
    rouletteTargets = [];
    slotTargets = [];
    contestantTargets = [];
    rouletteModel?.traverse((object) => {
      if (object.isMesh) rouletteTargets.push(object);
    });
    slotsModel?.traverse((object) => {
      if (object.isMesh) slotTargets.push(object);
    });
    setupContestants();
  }

  function setupContestants() {
    const chairs = [];
    stageModel?.traverse((object) => {
      if (object.name === "tall_chair") chairs.push(object);
    });
    scene.updateMatrixWorld(true);

    const sortedFallback = [...chairs].sort((a, b) => {
      const aPosition = a.getWorldPosition(new THREE.Vector3());
      const bPosition = b.getWorldPosition(new THREE.Vector3());
      return aPosition.x - bPosition.x;
    });
    const assigned = new Set();

    contestants = BILLBOARD_SOURCES.map((source, index) => {
      const plate = stageModel.getObjectByName(`nameplate_${source.id}`);
      const platePosition = plate?.getWorldPosition(new THREE.Vector3());
      let chair = platePosition
        ? chairs
          .filter((candidate) => !assigned.has(candidate))
          .sort((a, b) => {
            const aPosition = a.getWorldPosition(new THREE.Vector3());
            const bPosition = b.getWorldPosition(new THREE.Vector3());
            return Math.hypot(aPosition.x - platePosition.x, aPosition.z - platePosition.z)
              - Math.hypot(bPosition.x - platePosition.x, bPosition.z - platePosition.z);
          })[0]
        : null;
      chair ||= sortedFallback.find((candidate) => !assigned.has(candidate));
      if (!chair) return null;
      assigned.add(chair);

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

      const anchor = new THREE.Vector3(chairCenter.x, chairBounds.max.y + 0.34, chairBounds.max.z + 0.12);
      const worldWidth = 1.04;
      const worldHeight = worldWidth * 9 / 16;
      const panel = document.createElement("div");
      panel.className = "rg-billboard";
      panel.dataset.contestant = source.id;
      panel.setAttribute("aria-label", `${source.label} browser-source billboard`);

      if (source.source) {
        const iframe = document.createElement("iframe");
        iframe.src = source.source;
        iframe.title = `${source.label} live browser source`;
        iframe.loading = "eager";
        iframe.referrerPolicy = "strict-origin-when-cross-origin";
        iframe.sandbox = "allow-scripts allow-same-origin";
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
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function getNamedPart(hit, model, knownNames) {
    for (let object = hit?.object; object && object !== model; object = object.parent) {
      const name = String(object.name || "").toLowerCase();
      if (knownNames.has(name)) return name;
    }
    return "";
  }

  function getSceneInteractionAt(clientX, clientY) {
    const bounds = canvas.getBoundingClientRect();
    pointer.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const wheelHit = raycaster.intersectObjects(rouletteTargets, true)[0];
    const slotHit = raycaster.intersectObjects(slotTargets, true)[0];
    const chairHit = raycaster.intersectObjects(contestantTargets, false)[0];
    const hits = [
      wheelHit && { distance: wheelHit.distance, hit: wheelHit, machine: "roulette", model: rouletteModel },
      slotHit && { distance: slotHit.distance, hit: slotHit, machine: "slot", model: slotsModel },
      chairHit && {
        distance: chairHit.distance,
        machine: "contestant",
        contestantId: chairHit.object.userData.contestantId,
      },
    ].filter(Boolean).sort((a, b) => a.distance - b.distance);
    const hit = hits[0];
    if (!hit) return null;
    if (hit.machine === "contestant") return hit;
    const partNames = hit.machine === "roulette" ? ROULETTE_PART_NAMES : SLOT_PART_NAMES;
    return { ...hit, part: getNamedPart(hit.hit, hit.model, partNames) };
  }

  function updatePointer(event) {
    if (event.pointerType === "touch" || !camera || event.buttons) return;
    const rect = preview.getBoundingClientRect();
    const zone = resolvePointClickZone({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      canGoBack: canGoBack(),
    });
    const interaction = zone ? null : getSceneInteractionAt(event.clientX, event.clientY);
    const actionable = Boolean(interaction && (
      interaction.machine !== "contestant"
      || currentView.kind !== "contestant"
      || currentView.contestantId !== interaction.contestantId
    ));
    setGameCursor(resolvePointClickCursor({ zone, actionable }), event.clientX, event.clientY);
  }

  function setGameCursor(mode, clientX, clientY) {
    if (reducedMotion.matches || matchMedia("(pointer: coarse)").matches) {
      gameCursor.hidden = true;
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

  function pointClickAt(clientX, clientY) {
    if (!camera || !sceneReady || cameraTransition) return;
    const rect = preview.getBoundingClientRect();
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

    const interaction = getSceneInteractionAt(clientX, clientY);
    if (!interaction) return;

    if (interaction.machine === "contestant") {
      if (currentView.kind === "contestants" || currentView.kind === "contestant") {
        transitionToView({ kind: "contestant", contestantId: interaction.contestantId });
      } else {
        transitionToView({ kind: "contestants" });
      }
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
    else if (action === "open-slots") window.dispatchEvent(new CustomEvent("rg:open-host-panel", { detail: { tab: "slots" } }));
    else if (action === "open-trivia") window.dispatchEvent(new CustomEvent("rg:open-host-panel", { detail: { tab: "trivia" } }));
  }

  canvas.addEventListener("pointermove", updatePointer);
  canvas.addEventListener("click", (event) => pointClickAt(event.clientX, event.clientY));
  canvas.addEventListener("pointerleave", hideGameCursor);
  window.addEventListener("blur", hideGameCursor);

  canvas.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    if (key === "arrowleft") setLookDirection(-1);
    else if (key === "arrowright") setLookDirection(1);
    else if (key === "arrowdown" || key === "escape" || key === "backspace") goBack();
    else if (key === "enter" || key === " ") {
      const bounds = canvas.getBoundingClientRect();
      pointClickAt(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    }
    else if (key === "r") startWheelSpin();
    else if (key === "s") startLeverPull();
    else if (key === "g") window.dispatchEvent(new CustomEvent("rg:open-host-panel", { detail: { tab: "slots" } }));
    else if (key === "t") window.dispatchEvent(new CustomEvent("rg:open-host-panel", { detail: { tab: "trivia" } }));
    else return;
    event.preventDefault();
  });

  gameCursorImage.src = CURSOR_ASSETS.default;

  window.addEventListener("rg:spin-wheel", startWheelSpin);
  window.addEventListener("rg:pull-slots", startLeverPull);

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

    for (const contestant of contestants) {
      const cameraSpace = camera.worldToLocal(contestant.anchor.clone());
      const depth = -cameraSpace.z;
      const projected = contestant.anchor.clone().project(camera);
      const visible = depth > camera.near && projected.z >= -1 && projected.z <= 1;
      if (!visible) {
        contestant.panel.style.visibility = "hidden";
        continue;
      }

      const x = (projected.x + 1) * 0.5 * width;
      const y = (1 - projected.y) * 0.5 * height;
      const rawWidth = contestant.worldWidth * pixelsPerWorldUnitAtOne / depth;
      const panelWidth = Math.min(rawWidth, width * 0.78);
      contestant.panel.style.left = `${x}px`;
      contestant.panel.style.top = `${y}px`;
      contestant.panel.style.width = `${panelWidth}px`;
      contestant.panel.style.visibility = "visible";
    }
  }

  function animate(time) {
    animationFrame = requestAnimationFrame(animate);
    if (!renderer || !scene || !camera) return;

    updateCameraTransition(time);
    updateBillboardProjection();

    if (wheelMotion && wheelPivot && ballPivot) {
      const progress = Math.min(1, (time - wheelMotion.started) / wheelMotion.duration);
      const ease = 1 - Math.pow(1 - progress, 4.6);
      wheelPivot.rotation.y = THREE.MathUtils.lerp(wheelMotion.wheelFrom, wheelMotion.wheelTo, ease);
      ballPivot.rotation.y = THREE.MathUtils.lerp(
        wheelMotion.ballFrom,
        wheelMotion.ballTo,
        1 - Math.pow(1 - progress, 2.2),
      );
      if (progress >= 1) {
        wheelPivot.rotation.y = wheelMotion.wheelTo;
        ballPivot.rotation.y = wheelMotion.ballTo;
        wheelMotion = null;
        finishTurn();
      }
    } else if (wheelMotion && time - wheelMotion.started >= wheelMotion.duration) {
      wheelMotion = null;
      finishTurn();
    }

    if (leverMotion && lever) {
      const progress = Math.min(1, (time - leverMotion.started) / leverMotion.duration);
      lever.rotation.z = leverMotion.base - Math.sin(progress * Math.PI) * 0.65;
      if (progress >= 1) {
        lever.rotation.z = leverMotion.base;
        leverMotion = null;
        finishTurn();
      }
    } else if (leverMotion && time - leverMotion.started >= leverMotion.duration) {
      leverMotion = null;
      finishTurn();
    }

    renderer.render(scene, camera);
  }

  async function boot() {
    try {
      createWorld();
      const loader = new GLTFLoader();
      const [stageGltf, rouletteGltf, slotsGltf] = await Promise.all([
        loader.loadAsync("/ramblegamble/assets/provided/rg_stage.gltf"),
        loader.loadAsync("/ramblegamble/assets/provided/rg_roulette.gltf"),
        loader.loadAsync("/ramblegamble/assets/provided/rg_slots.gltf"),
      ]);

      stageModel = stageGltf.scene;
      prepareModel(stageModel);
      scene.add(stageModel);

      rouletteModel = rouletteGltf.scene;
      prepareModel(rouletteModel);
      rouletteRig.add(rouletteModel);
      rouletteModel.traverse((object) => {
        if (object.name === "wheel" && !object.isMesh && object.children.length > 0) wheelPivot = object;
        if (object.name === "ball" && !object.isMesh && object.children.length > 0) ballPivot = object;
      });

      slotsModel = slotsGltf.scene;
      prepareModel(slotsModel);
      slotRig.add(slotsModel);
      slotsModel.traverse((object) => {
        if (object.name === "arm") lever = object;
      });

      placeMachinesFromStage();
      setupPicking();
      applyTheme();
      sceneReady = true;
      fitCamera();
      loading.classList.add("is-hidden");
      resizeObserver = new ResizeObserver(fitCamera);
      resizeObserver.observe(preview);
      window.addEventListener("resize", fitCamera, { passive: true });
      if (!document.hidden) animationFrame = requestAnimationFrame(animate);
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
    } else if (sceneReady && renderer && !animationFrame) {
      animationFrame = requestAnimationFrame(animate);
    }
  });

  window.addEventListener("pagehide", () => {
    cancelAnimationFrame(animationFrame);
    resizeObserver?.disconnect();
    renderer?.dispose();
  }, { once: true });
})();
