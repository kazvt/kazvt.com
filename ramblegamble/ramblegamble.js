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
    rouletteRig.position.set(-14, 0, 0);
    scene.add(rouletteRig);

    slotRig = new THREE.Group();
    slotRig.position.set(20, 0, 0);
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
    controls.target.set(-4, 0, 0);
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

    const mobileStack = aspect < 1.05;
    if (rouletteRig && slotRig) {
      if (mobileStack) {
        rouletteRig.position.set(0, 12, 0);
        slotRig.position.set(0, -16, -4);
        controls.target.set(0, -2.75, -1.8);
      } else {
        rouletteRig.position.set(-14, 0, 0);
        slotRig.position.set(20, 0, 0);
        controls.target.set(-4, 0, 0);
      }
      if (stageModel) stageModel.position.x = mobileStack ? -13 : 0;
    }

    const horizontalSpan = mobileStack ? 40 : 66;
    const verticalSpan = mobileStack ? 46 : 30;
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const distance = Math.max(
      horizontalSpan / (2 * tangent * Math.max(aspect, 0.28)),
      verticalSpan / (2 * tangent),
    ) * 1.08;
    const target = controls.target;
    camera.position.set(target.x, target.y + distance * 0.42, target.z + distance);
    camera.lookAt(target);
    controls.minDistance = distance * 0.55;
    controls.maxDistance = distance * 1.85;
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
      rouletteModel.position.y = 2.3;
      prepareModel(rouletteModel);
      rouletteRig.add(rouletteModel);
      rouletteModel.traverse((object) => {
        if (object.name === "wheel" && !object.isMesh && object.children.length > 0) wheelPivot = object;
        if (object.name === "ball" && !object.isMesh && object.children.length > 0) ballPivot = object;
      });

      slotsModel = slotsGltf.scene;
      slotsModel.position.y = 9;
      prepareModel(slotsModel);
      slotRig.add(slotsModel);
      slotsModel.traverse((object) => {
        if (object.name === "arm") lever = object;
      });

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
