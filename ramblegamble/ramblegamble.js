import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { resolvePointClick } from "./point-click-routing.js?v=point-click-20261114-v1";

(() => {
  "use strict";

  const preview = document.getElementById("rg-preview");
  const canvas = document.getElementById("rg-canvas");
  const loading = document.getElementById("rg-loading");
  const result = document.getElementById("rg-result");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const FORCED_THEME = "p2";
  const ROULETTE_PART_NAMES = new Set(["center", "wheel", "rim", "ball"]);
  const SLOT_PART_NAMES = new Set(["machine", "arm", "button1", "button2", "button3", "button4", "button5"]);
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
  let controls;
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
  let userInteracting = false;
  let sceneReady = false;
  let lastCameraShake = new THREE.Vector3();
  let stageModel;
  let rouletteModel;
  let slotsModel;
  let cameraFramed = false;

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

    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.065;
    controls.enablePan = false;
    controls.minPolarAngle = 0.2;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.minDistance = 20;
    controls.maxDistance = 180;
    controls.target.set(0, 0, 0);
    controls.addEventListener("start", () => {
      userInteracting = true;
      preview.classList.add("is-dragging");
    });
    controls.addEventListener("end", () => {
      userInteracting = false;
      preview.classList.remove("is-dragging");
    });
  }

  function fitCamera() {
    if (!camera || !controls || !renderer) return;
    const width = Math.max(1, preview.clientWidth);
    const height = Math.max(1, preview.clientHeight);
    const aspect = width / height;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setSize(width, height, false);

    const focus = getArcadeBounds();
    if (focus.isEmpty()) return;

    const target = focus.getCenter(new THREE.Vector3());
    const direction = cameraFramed
      ? camera.position.clone().sub(controls.target).normalize()
      : new THREE.Vector3(0, 0.38, 0.925).normalize();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(worldUp, direction).normalize();
    const viewUp = new THREE.Vector3().crossVectors(direction, right).normalize();
    const tanHalfVertical = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const tanHalfHorizontal = tanHalfVertical * aspect;
    let distance = 0;

    for (const x of [focus.min.x, focus.max.x]) {
      for (const y of [focus.min.y, focus.max.y]) {
        for (const z of [focus.min.z, focus.max.z]) {
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

    distance = Math.max(distance, 1) * 1.14;
    controls.target.copy(target);
    camera.position.copy(target).addScaledVector(direction, distance);
    camera.lookAt(target);
    controls.minDistance = Math.max(0.5, distance * 0.48);
    controls.maxDistance = Math.max(18, distance * 3.2);
    controls.update();
    cameraFramed = true;
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
    rouletteModel?.traverse((object) => {
      if (object.isMesh) rouletteTargets.push(object);
    });
    slotsModel?.traverse((object) => {
      if (object.isMesh) slotTargets.push(object);
    });
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downPoint = null;

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
    const hit = wheelHit && slotHit
      ? (wheelHit.distance <= slotHit.distance ? { hit: wheelHit, machine: "roulette", model: rouletteModel } : { hit: slotHit, machine: "slot", model: slotsModel })
      : wheelHit
        ? { hit: wheelHit, machine: "roulette", model: rouletteModel }
        : slotHit
          ? { hit: slotHit, machine: "slot", model: slotsModel }
          : null;
    if (!hit) return null;
    const partNames = hit.machine === "roulette" ? ROULETTE_PART_NAMES : SLOT_PART_NAMES;
    const part = getNamedPart(hit.hit, hit.model, partNames);
    return { machine: hit.machine, part, action: resolvePointClick(hit.machine, part) };
  }

  function updatePointer(event) {
    if (event.pointerType === "touch" || !camera || event.buttons) return;
    preview.classList.toggle("is-hovering", Boolean(getSceneInteractionAt(event.clientX, event.clientY)));
  }

  function pickMachine(event) {
    if (!camera || playing || !downPoint) return;
    const distance = Math.hypot(event.clientX - downPoint.x, event.clientY - downPoint.y);
    downPoint = null;
    if (distance > 7) return;
    const interaction = getSceneInteractionAt(event.clientX, event.clientY);
    if (interaction?.action === "spin-wheel") startWheelSpin();
    else if (interaction?.action === "pull-lever") startLeverPull();
    else if (interaction?.action === "open-slots") window.dispatchEvent(new CustomEvent("rg:open-host-panel", { detail: { tab: "slots" } }));
    else if (interaction?.action === "open-trivia") window.dispatchEvent(new CustomEvent("rg:open-host-panel", { detail: { tab: "trivia" } }));
  }

  canvas.addEventListener("pointermove", updatePointer);
  canvas.addEventListener("pointerdown", (event) => {
    downPoint = { x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener("pointerup", pickMachine);
  canvas.addEventListener("pointercancel", () => {
    downPoint = null;
    preview.classList.remove("is-hovering");
  });
  canvas.addEventListener("pointerleave", () => preview.classList.remove("is-hovering"));

  canvas.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    if (key === "r") startWheelSpin();
    else if (key === "s") startLeverPull();
    else if (key === "g") window.dispatchEvent(new CustomEvent("rg:open-host-panel", { detail: { tab: "slots" } }));
    else if (key === "t") window.dispatchEvent(new CustomEvent("rg:open-host-panel", { detail: { tab: "trivia" } }));
    else return;
    event.preventDefault();
  });

  window.addEventListener("rg:spin-wheel", startWheelSpin);
  window.addEventListener("rg:pull-slots", startLeverPull);

  function animate(time) {
    animationFrame = requestAnimationFrame(animate);
    if (!renderer || !scene || !camera || !controls) return;

    if (lastCameraShake.lengthSq() > 0) camera.position.sub(lastCameraShake);
    lastCameraShake.set(0, 0, 0);
    controls.update();

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

    if (!reducedMotion.matches && !userInteracting) {
      const seconds = time * 0.001;
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      const offset = right.multiplyScalar(Math.sin(seconds * 2.35) * 0.018)
        .add(up.multiplyScalar(Math.sin(seconds * 1.73 + 0.8) * 0.013));
      camera.position.add(offset);
      camera.lookAt(controls.target);
      camera.rotateX(Math.sin(seconds * 2.05) * 0.00115);
      camera.rotateY(Math.cos(seconds * 1.67 + 0.5) * 0.0012);
      lastCameraShake.copy(offset);
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
      fitCamera();
      applyTheme();
      loading.classList.add("is-hidden");
      resizeObserver = new ResizeObserver(fitCamera);
      resizeObserver.observe(preview);
      window.addEventListener("resize", fitCamera, { passive: true });
      sceneReady = true;
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
    controls?.dispose();
    renderer?.dispose();
  }, { once: true });
})();
