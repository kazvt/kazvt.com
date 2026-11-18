import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  resolvePointClickAction,
  resolvePointClickBack,
  resolvePointClickCursor,
  resolvePointClickZone,
} from "./point-click-routing.js?v=camera-relative-back-20261117-v1";
import { createQuestionPicker, readSessionQuestionBank } from "./question-bank.mjs?v=host-question-bank-session-20261118-v1";

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
  const OVERVIEW_RETREAT_DISTANCE = 0.45;
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
    // The back-wall recess in rg_stage.gltf spans x=9.14..14.48 at z=-6.10.
    // A small size increase matches the reference cabinet while staying inside the recess.
    slotBay: Object.freeze({ left: 9.14, right: 14.48, wallZ: -6.10, height: 2.52, widthScale: 1.08, clearance: 0.025 }),
    // The raised stage's forward lip ends at z=0.06; keep the whole wheel
    // footprint beyond it, rather than merely moving its center off the stage.
    stageFrontZ: 0.06,
    rouletteCenterX: 15.0,
    rouletteScale: 0.18,
    rouletteClearance: 0.12,
  });
  const SKY_CONFIG = Object.freeze({
    radius: 260,
    starCount: 420,
    topColor: "#100818",
    horizonColor: "#b9a0cf",
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
  let resizeObserver;
  let animationFrame = 0;
  let wheelPivot;
  let ballPivot;
  let lever;
  let rouletteRig;
  let slotRig;
  let skyRoot;
  let skyStars;
  let skyStarsMesh;
  let skyShootingStarsMesh;
  let skyShootingStars = [];
  let skyStarsInitialized = false;
  let rouletteTargets = [];
  let slotTargets = [];
  let wheelMotion = null;
  let leverMotion = null;
  const pickQuestion = createQuestionPicker();
  let playing = false;
  let sceneReady = false;
  let stageModel;
  let rouletteModel;
  let slotsModel;
  let contestants = [];
  let hostBillboard = null;
  let billboards = [];
  let contestantTargets = [];
  let hostTargets = [];
  let currentView = { kind: "overview", look: 0 };
  let cameraTarget = new THREE.Vector3();
  let cameraTransition = null;
  let cursorMode = "";
  let skyRandomState = 0x4b415a56;

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
    scene.fog.color.set(SKY_CONFIG.horizonColor);
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

  function nextHostQuestion() {
    return pickQuestion(readSessionQuestionBank());
  }

  function finishTurn() {
    const prompt = nextHostQuestion();
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
    scene = new THREE.Scene();
    scene.background = new THREE.Color(SKY_CONFIG.topColor);
    scene.fog = new THREE.Fog(SKY_CONFIG.horizonColor, 120, 230);

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

    createSkybox();

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
    const width = 24;
    const height = 8;
    const pixels = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const headDistance = ((x - 19) / 3.4) ** 2 + ((y - 3.5) / 2.5) ** 2;
        let alpha = headDistance <= 1 ? 255 : 0;
        if ((y === 3 || y === 4) && x < 20) {
          alpha = Math.max(alpha, Math.round(175 * (1 - x / 23)));
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
    const count = 3;
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
      duration: 900,
      nextAt: performance.now() + 5200 + index * 6000 + nextSkyRandom() * 1200,
      active: false,
      angle: (nextSkyRandom() - 0.5) * 0.48 - 0.30,
      tint: new THREE.Color("#fff0de"),
    }));
  }

  function initializeSkyStars() {
    if (skyStarsInitialized || !camera || !skyStars) return;
    camera.updateMatrixWorld(true);
    const forward = camera.getWorldDirection(new THREE.Vector3());
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    const viewUp = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    const horizontalRange = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * 1.45;

    for (const star of skyStars) {
      const horizontal = (nextSkyRandom() * 2 - 1) * horizontalRange;
      const vertical = 0.02 + nextSkyRandom() * 0.36;
      star.direction = forward.clone()
        .addScaledVector(right, horizontal)
        .addScaledVector(viewUp, vertical)
        .normalize();
    }
    skyStarsInitialized = true;
  }

  function makeShootingStarPath() {
    camera.updateMatrixWorld(true);
    const forward = camera.getWorldDirection(new THREE.Vector3());
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    const viewUp = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    const horizontalRange = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    const start = forward
      .addScaledVector(right, (nextSkyRandom() * 2 - 1) * horizontalRange * 0.78)
      .addScaledVector(viewUp, 0.30 + nextSkyRandom() * 0.08)
      .normalize();
    const travelDirection = nextSkyRandom() < 0.5 ? -1 : 1;
    const end = start.clone()
      .addScaledVector(right, travelDirection * (0.08 + nextSkyRandom() * 0.12))
      .addScaledVector(viewUp, -(0.025 + nextSkyRandom() * 0.05))
      .normalize();
    return {
      start: start.multiplyScalar(SKY_CONFIG.radius - 2),
      end: end.multiplyScalar(SKY_CONFIG.radius - 2),
      angle: travelDirection > 0 ? -0.30 : Math.PI + 0.30,
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

      if (!star.active && time >= star.nextAt) {
        const path = makeShootingStarPath();
        star.start = path.start;
        star.end = path.end;
        star.angle = path.angle;
        star.startedAt = time;
        star.duration = 1050 + nextSkyRandom() * 450;
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
      const eased = progress * progress * (3 - 2 * progress);
      position.lerpVectors(star.start, star.end, eased);
      roll.setFromAxisAngle(worldZ, star.angle);
      rotation.copy(pixelQuaternion).multiply(roll);
      const fade = Math.sin(progress * Math.PI) * 0.88;
      scale.set(48 * worldPerPixel, 8 * worldPerPixel, 1);
      matrix.compose(position, rotation, scale);
      skyShootingStarsMesh.setMatrixAt(star.index, matrix);
      skyShootingStarsMesh.setColorAt(star.index, color.copy(star.tint).multiplyScalar(fade));
      if (progress >= 1) {
        star.active = false;
        star.nextAt = time + 14500 + nextSkyRandom() * 16500;
      }
    }
    skyShootingStarsMesh.instanceMatrix.needsUpdate = true;
    if (skyShootingStarsMesh.instanceColor) skyShootingStarsMesh.instanceColor.needsUpdate = true;
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
    const yaw = REFERENCE_START_VIEW.yaw - view.look * 0.42;
    const elevation = REFERENCE_START_VIEW.elevation;
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

    const retreatSteps = THREE.MathUtils.clamp(view.retreat || 0, 0, 3);
    const overviewDistanceScale = view.kind === "overview"
      ? THREE.MathUtils.lerp(
        REFERENCE_START_VIEW.narrowDistanceScale,
        REFERENCE_START_VIEW.wideDistanceScale,
        wideComposition,
      )
      : 1;
    distance = Math.max(distance, 1)
      * (view.kind === "overview" ? 1.14 : 1.18)
      * overviewDistanceScale
      * (1 + retreatSteps * OVERVIEW_RETREAT_DISTANCE);
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
    });
    setupContestants();
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
    const hostHit = raycaster.intersectObjects(hostTargets, false)[0];
    const hits = [
      wheelHit && { distance: wheelHit.distance, hit: wheelHit, machine: "roulette", model: rouletteModel },
      slotHit && { distance: slotHit.distance, hit: slotHit, machine: "slot", model: slotsModel },
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
    if (!hit) return getSeatAtScreen(clientX, clientY, bounds);
    if (hit.machine === "contestant" || hit.machine === "host") return hit;
    const partNames = hit.machine === "roulette" ? ROULETTE_PART_NAMES : SLOT_PART_NAMES;
    return { ...hit, part: getNamedPart(hit.hit, hit.model, partNames) };
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

  function pointClickAt(clientX, clientY) {
    if (!camera || !sceneReady) return;
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
    if (key === "1") transitionToView({ kind: "contestants" });
    else if (key === "2") transitionToView({ kind: "slot" });
    else if (key === "3") transitionToView({ kind: "roulette" });
    else if (key === "4") transitionToView({ kind: "host" });
    else if (key === "arrowleft") setLookDirection(-1);
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
