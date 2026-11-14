import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

(() => {
  "use strict";

  const stage = document.getElementById("rg-stage");
  const canvas = document.getElementById("rg-canvas");
  const loading = document.getElementById("rg-loading");
  const loadingCopy = document.getElementById("rg-loading-copy");
  const sceneStatus = document.getElementById("rg-scene-status");
  const spinButton = document.getElementById("rg-spin");
  const pullButton = document.getElementById("rg-pull");
  const promptKicker = document.getElementById("rg-prompt-kicker");
  const promptText = document.getElementById("rg-prompt");
  const statusText = document.getElementById("rg-status");
  const roundText = document.getElementById("rg-round");
  const turnCountText = document.getElementById("rg-turn-count");
  const slotSymbols = [
    document.getElementById("rg-slot-one"),
    document.getElementById("rg-slot-two"),
    document.getElementById("rg-slot-three"),
  ];
  const paletteSelect = document.getElementById("rg-palette-select");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

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
  const symbols = ["7", "★", "♥", "✿", "◆", "☾"];

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
  let symbolChangeAt = 0;
  let promptBag = [];
  let round = 0;
  let playing = false;
  let userInteracting = false;
  let lastCameraShake = new THREE.Vector3();
  let fitDistance = 60;

  function themeValue(name, fallback) {
    const value = getComputedStyle(document.body).getPropertyValue(name).trim();
    return value || fallback;
  }

  function applyTheme(theme, persist = true) {
    if (!/^p(?:[1-9]|1[0-6])$/.test(theme)) return;
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    if (paletteSelect) paletteSelect.value = theme;
    const color = themeValue("--bg", "#17213c");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = color;

    if (scene) {
      scene.background = new THREE.Color(color);
      scene.fog.color.set(color);
      const bgColor = new THREE.Color(themeValue("--bg", "#17213c"));
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

    if (persist) {
      try { localStorage.setItem("kazvt-theme", theme); } catch {}
    }
  }

  function shuffled(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function nextPrompt() {
    if (promptBag.length === 0) promptBag = shuffled(prompts);
    return promptBag.pop();
  }

  function chooseSymbols() {
    const chosen = Array.from({ length: 3 }, () => symbols[Math.floor(Math.random() * symbols.length)]);
    if (Math.random() < 0.08) {
      const triple = symbols[Math.floor(Math.random() * symbols.length)];
      chosen.fill(triple);
    }
    return chosen;
  }

  function setPlaying(next) {
    playing = next;
    spinButton.disabled = next;
    pullButton.disabled = next;
    sceneStatus.textContent = next ? "THE MACHINES ARE THINKING" : "YOUR MOVE, YOUR LUCK";
  }

  function finishTurn(mode) {
    const result = chooseSymbols();
    result.forEach((symbol, index) => { slotSymbols[index].textContent = symbol; });
    promptKicker.textContent = mode === "wheel" ? "THE WHEEL PICKED" : "THE SLOT PICKED";
    promptText.textContent = nextPrompt();
    statusText.textContent = result.every((symbol) => symbol === result[0])
      ? "TRIPLE MATCH - EXTRA RAMBLE ENERGY."
      : "A FRESH TANGENT. TAKE IT ANYWHERE. ";
    round += 1;
    const display = String(round).padStart(2, "0");
    roundText.textContent = display;
    turnCountText.textContent = display;
    setPlaying(false);
  }

  function startWheelSpin() {
    if (!wheelPivot || !ballPivot || playing) return;
    setPlaying(true);
    promptKicker.textContent = "THE WHEEL IS DECIDING";
    statusText.textContent = "LET IT ROLL...";
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
    if (!lever || playing) return;
    setPlaying(true);
    promptKicker.textContent = "THE SLOT IS SPINNING";
    statusText.textContent = "A LITTLE LUCK, PLEASE...";
    leverMotion = {
      started: performance.now(),
      duration: reducedMotion.matches ? 500 : 1700,
      base: lever.rotation.z,
    };
    symbolChangeAt = 0;
  }

  spinButton.addEventListener("click", startWheelSpin);
  pullButton.addEventListener("click", startLeverPull);

  paletteSelect?.addEventListener("change", () => applyTheme(paletteSelect.value));
  window.addEventListener("storage", (event) => {
    if (event.key === "kazvt-theme" && event.newValue) applyTheme(event.newValue, false);
  });
  applyTheme(document.documentElement.dataset.theme || "p16", false);

  document.addEventListener("keydown", (event) => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("button, select, input, textarea, a")) return;
    if (event.code === "Space") {
      event.preventDefault();
      startWheelSpin();
    } else if (event.code === "Enter") {
      event.preventDefault();
      startLeverPull();
    }
  });

  function setColor(object, color) {
    object.material.color.set(color);
    object.material.roughness = 0.82;
    object.material.metalness = 0.05;
  }

  function makePedestal(radius, depth, color, userDataKey) {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.05 });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.94, radius, depth, 48), material);
    mesh.position.y = -9.5;
    mesh.userData[userDataKey] = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    return mesh;
  }

  function createWorld() {
    scene = new THREE.Scene();
    const bg = themeValue("--bg", "#17213c");
    scene.background = new THREE.Color(bg);
    scene.fog = new THREE.Fog(bg, 120, 230);

    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 320);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    const hemisphere = new THREE.HemisphereLight(0xfff4e8, 0x282044, 2.0);
    scene.add(hemisphere);
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

    const floorMaterial = new THREE.MeshStandardMaterial({ color: bg, roughness: 1, metalness: 0 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -10.05;
    floor.userData.rgFloor = true;
    scene.add(floor);

    const stageAccent = new THREE.MeshStandardMaterial({ color: themeValue("--pink", "#f599c6"), roughness: 0.65, metalness: 0.1, emissive: themeValue("--pink", "#f599c6"), emissiveIntensity: 0.08 });
    const rouletteDeck = new THREE.Mesh(new THREE.TorusGeometry(21.1, 0.14, 6, 80), stageAccent);
    rouletteDeck.rotation.x = Math.PI / 2;
    rouletteDeck.position.y = -9.1;
    rouletteDeck.userData.rgAccent = true;
    scene.add(rouletteDeck);

    const slotDeckMaterial = new THREE.MeshStandardMaterial({ color: themeValue("--blue", "#4d6787"), roughness: 0.72, metalness: 0.1, emissive: themeValue("--blue", "#4d6787"), emissiveIntensity: 0.06 });
    const slotDeck = new THREE.Mesh(new THREE.TorusGeometry(8.6, 0.13, 6, 64), slotDeckMaterial);
    slotDeck.rotation.x = Math.PI / 2;
    slotDeck.position.y = -9.1;
    slotDeck.userData.rgSecondary = true;
    scene.add(slotDeck);

    rouletteRig = new THREE.Group();
    rouletteRig.name = "roulette-stage";
    rouletteRig.position.set(-14, 0, 0);
    rouletteRig.add(makePedestal(21, 0.55, themeValue("--pink", "#f599c6"), "rgAccent"));
    scene.add(rouletteRig);

    slotRig = new THREE.Group();
    slotRig.name = "slot-stage";
    slotRig.position.set(20, 0, 0);
    slotRig.rotation.y = Math.PI;
    const slotPedestal = makePedestal(8.7, 0.55, themeValue("--blue", "#4d6787"), "rgSecondary");
    slotRig.add(slotPedestal);
    scene.add(slotRig);

    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.065;
    controls.enablePan = false;
    controls.minPolarAngle = 0.2;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.minDistance = 20;
    controls.maxDistance = 180;
    controls.target.set(-4, 0, 0);
    controls.addEventListener("start", () => { userInteracting = true; });
    controls.addEventListener("end", () => { userInteracting = false; });
  }

  function fitCamera() {
    if (!camera || !controls || !stage) return;
    const width = Math.max(1, stage.clientWidth);
    const height = Math.max(1, stage.clientHeight);
    const aspect = width / height;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);

    const mobileStack = aspect < 1.05;
    if (rouletteRig && slotRig) {
      if (mobileStack) {
        rouletteRig.position.set(0, 7, 0);
        slotRig.position.set(0, -11, -4);
        controls.target.set(0, -2.75, -1.8);
      } else {
        rouletteRig.position.set(-14, 0, 0);
        slotRig.position.set(20, 0, 0);
        controls.target.set(-4, 0, 0);
      }
      const stageAccent = scene.children.find((child) => child.geometry?.type === "TorusGeometry" && child.userData.rgAccent);
      const slotAccent = scene.children.find((child) => child.geometry?.type === "TorusGeometry" && child.userData.rgSecondary);
      if (stageAccent) stageAccent.position.set(mobileStack ? 0 : -14, mobileStack ? -2 : -9.1, 0);
      if (slotAccent) slotAccent.position.set(mobileStack ? 0 : 20, mobileStack ? -20 : -9.1, mobileStack ? -4 : 0);
      const slotBase = slotRig.children.find((child) => child.userData.rgSecondary);
      if (slotBase) slotBase.position.y = mobileStack ? -20.5 : -9.5;
    }

    const horizontalSpan = mobileStack ? 42 : 66;
    const verticalSpan = mobileStack ? 35 : 23;
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    fitDistance = Math.max(horizontalSpan / (2 * tangent * Math.max(aspect, 0.25)), verticalSpan / (2 * tangent)) * 1.1;
    const target = controls.target;
    camera.position.set(target.x, target.y + fitDistance * 0.42, target.z + fitDistance);
    camera.lookAt(target);
    controls.minDistance = fitDistance * 0.55;
    controls.maxDistance = fitDistance * 1.85;
    controls.update();
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
    wheelPivot?.traverse((object) => { if (object.isMesh) rouletteTargets.push(object); });
    if (rouletteTargets.length === 0 && rouletteRig) rouletteRig.traverse((object) => { if (object.isMesh) rouletteTargets.push(object); });
    slotRig?.traverse((object) => {
      if (object.isMesh && (object.name === "arm" || /^button[1-5]$/.test(object.name))) slotTargets.push(object);
    });
    if (slotTargets.length === 0 && slotRig) slotRig.traverse((object) => { if (object.isMesh) slotTargets.push(object); });
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downPoint = null;

  function pickMachine(event) {
    if (!camera || playing || !downPoint) return;
    const distance = Math.hypot(event.clientX - downPoint.x, event.clientY - downPoint.y);
    downPoint = null;
    if (distance > 7) return;
    const bounds = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hitWheel = raycaster.intersectObjects(rouletteTargets, true).length > 0;
    const hitSlot = raycaster.intersectObjects(slotTargets, true).length > 0;
    if (hitWheel) startWheelSpin();
    else if (hitSlot) startLeverPull();
  }

  canvas.addEventListener("pointerdown", (event) => {
    downPoint = { x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener("pointerup", pickMachine);
  canvas.addEventListener("pointercancel", () => { downPoint = null; });

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
      ballPivot.rotation.y = THREE.MathUtils.lerp(wheelMotion.ballFrom, wheelMotion.ballTo, 1 - Math.pow(1 - progress, 2.2));
      if (progress >= 1) {
        wheelPivot.rotation.y = wheelMotion.wheelTo;
        ballPivot.rotation.y = wheelMotion.ballTo;
        wheelMotion = null;
        finishTurn("wheel");
      }
    }

    if (leverMotion && lever) {
      const progress = Math.min(1, (time - leverMotion.started) / leverMotion.duration);
      const pull = Math.sin(progress * Math.PI);
      lever.rotation.z = leverMotion.base - pull * 0.65;
      if (time >= symbolChangeAt) {
        const next = chooseSymbols();
        next.forEach((symbol, index) => { slotSymbols[index].textContent = symbol; });
        symbolChangeAt = time + 105;
      }
      if (progress >= 1) {
        lever.rotation.z = leverMotion.base;
        leverMotion = null;
        finishTurn("slot");
      }
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
      loadingCopy.textContent = "LOADING THE WHEEL + THE SLOT...";
      const [rouletteGltf, slotsGltf] = await Promise.all([
        loader.loadAsync("/ramblegamble/assets/provided/rg_roulette.gltf"),
        loader.loadAsync("/ramblegamble/assets/provided/rg_slots.gltf"),
      ]);

      const rouletteModel = rouletteGltf.scene;
      rouletteModel.position.y = -3;
      prepareModel(rouletteModel);
      rouletteRig.add(rouletteModel);
      rouletteModel.traverse((object) => {
        if (object.name === "wheel" && !object.isMesh && object.children.length > 0) wheelPivot = object;
        if (object.name === "ball" && !object.isMesh && object.children.length > 0) ballPivot = object;
      });

      const slotsModel = slotsGltf.scene;
      slotsModel.position.y = -1;
      prepareModel(slotsModel);
      slotRig.add(slotsModel);
      slotsModel.traverse((object) => {
        if (object.name === "arm" && object.isMesh) lever = object;
      });
      setupPicking();
      fitCamera();
      applyTheme(document.body.dataset.theme || "p16", false);
      sceneStatus.textContent = "YOUR MOVE, YOUR LUCK";
      loading.classList.add("is-hidden");
      resizeObserver = new ResizeObserver(fitCamera);
      resizeObserver.observe(stage);
      window.addEventListener("resize", fitCamera, { passive: true });
      animationFrame = requestAnimationFrame(animate);
    } catch (error) {
      console.error("Ramble Gamble 3D scene failed to start:", error);
      loadingCopy.textContent = "THE MACHINES COULD NOT WAKE UP - TRY A WEBGL-CAPABLE BROWSER";
      sceneStatus.textContent = "TABLE OFFLINE";
      if (renderer) renderer.dispose();
    }
  }

  boot();

  window.addEventListener("pagehide", () => {
    cancelAnimationFrame(animationFrame);
    resizeObserver?.disconnect();
    controls?.dispose();
    renderer?.dispose();
  }, { once: true });
})();
