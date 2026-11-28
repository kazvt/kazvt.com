import assert from "node:assert/strict";
import test from "node:test";
import {
  createCssProjectiveQuad,
  LIQUID_PORTAL_HEIGHT,
  LIQUID_PORTAL_SOURCE,
  LIQUID_PORTAL_WIDTH,
} from "./liquid-portal.mjs";

function mapCssMatrix(matrixText, x, y) {
  const values = matrixText.match(/matrix3d\(([^)]+)\)/)?.[1]
    .split(",")
    .map(Number);
  assert.equal(values?.length, 16);
  const denominator = values[3] * x + values[7] * y + values[15];
  return {
    x: (values[0] * x + values[4] * y + values[12]) / denominator,
    y: (values[1] * x + values[5] * y + values[13]) / denominator,
  };
}

test("liquid portal iframe maps its corners to the perspective-projected doorway", () => {
  const corners = [
    { x: 130, y: 70 },
    { x: 390, y: 92 },
    { x: 365, y: 620 },
    { x: 148, y: 590 },
  ];
  const matrix = createCssProjectiveQuad(512, 1024, corners);
  assert.ok(matrix);
  const sourceCorners = [[0, 0], [512, 0], [512, 1024], [0, 1024]];
  for (let index = 0; index < sourceCorners.length; index += 1) {
    const projected = mapCssMatrix(matrix, ...sourceCorners[index]);
    assert.ok(Math.abs(projected.x - corners[index].x) < 1e-5);
    assert.ok(Math.abs(projected.y - corners[index].y) < 1e-5);
  }
});

test("front-facing portal rectangles map without unintended rotation or distortion", () => {
  const matrix = createCssProjectiveQuad(512, 1024, [
    { x: 40, y: 30 },
    { x: 296, y: 30 },
    { x: 296, y: 542 },
    { x: 40, y: 542 },
  ]);
  assert.ok(matrix);
  assert.deepEqual(mapCssMatrix(matrix, 0, 0), { x: 40, y: 30 });
  assert.deepEqual(mapCssMatrix(matrix, 512, 1024), { x: 296, y: 542 });
});

test("degenerate or invalid portal geometry is rejected", () => {
  assert.equal(createCssProjectiveQuad(0, 100, []), null);
  assert.equal(createCssProjectiveQuad(100, 100, [{ x: 0, y: 0 }]), null);
  assert.equal(createCssProjectiveQuad(100, 100, [
    { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 },
  ]), null);
  assert.equal(createCssProjectiveQuad(100, 100, [
    { x: 0, y: 0 }, { x: Number.NaN, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 },
  ]), null);
});

test("liquid portal URL requests a clean theatre view and applies the provided settings", () => {
  const parameters = new URL(`https://kazvt.com${LIQUID_PORTAL_SOURCE}`).searchParams;
  assert.equal(parameters.get("theatre"), "on");
  assert.equal(parameters.get("fullscreen"), "on");
  assert.equal(parameters.get("color_low"), "#030303");
  assert.equal(parameters.get("color_mid"), "#171717");
  assert.equal(parameters.get("color_high"), "#626262");
  assert.equal(parameters.get("speed"), "2");
  assert.equal(parameters.get("fold_size"), "0.65");
  assert.equal(parameters.get("zoom"), "0.74");
  assert.equal(parameters.get("height_range"), "0.45");
  assert.equal(parameters.get("detail"), "61%");
  assert.equal(parameters.get("render_quality"), "50%");
  assert.equal(LIQUID_PORTAL_WIDTH / LIQUID_PORTAL_HEIGHT, 0.5);
});

import { createLiquidPortal, findLiquidCanvas, getLiquidPortalPlane, isLiquidPortalActive } from "./liquid-portal.mjs";
import { DICE_DOOR_OPENING } from "./dice-doorway.mjs";
import { readFileSync } from "node:fs";

test("VIP liquid surface is recessed, inward-facing, centered and overscans the authored frame", () => {
  const opening = DICE_DOOR_OPENING;
  const plane = getLiquidPortalPlane(opening);
  assert.ok(plane.x > opening.wallX && plane.x - opening.wallX < 0.01);
  assert.equal(plane.y, (opening.minY + opening.maxY) / 2);
  assert.equal(plane.z, (opening.minZ + opening.maxZ) / 2);
  assert.equal(plane.rotationY, -Math.PI / 2);
  assert.ok(Math.abs(plane.width / plane.height - 0.5) < 1e-12);
  assert.ok(plane.corners[0].z < opening.minZ && plane.corners[1].z > opening.maxZ);
  assert.ok(plane.corners[0].y > opening.maxY && plane.corners[2].y < opening.minY);
  // A ray through any point in the original opening at up to 80 degrees
  // from the wall normal still lands on the recessed, slightly larger plane.
  const maxShift = (plane.x - opening.wallX) * Math.tan(80 * Math.PI / 180);
  assert.ok((plane.width - (opening.maxZ - opening.minZ)) / 2 > maxShift);
  assert.ok((plane.height - (opening.maxY - opening.minY)) / 2 > maxShift);
});

test("portal remains active in every gameplay camera view, but not menus or full-screen Dice", () => {
  const state = { gameStarted: true, pauseMenuOpen: false, diceModeOpen: false, sceneReady: true, documentHidden: false };
  for (const kind of ["overview", "dice-door", "card-table", "slot", "roulette", "contestants", "host"]) {
    assert.equal(isLiquidPortalActive({ ...state, currentView: { kind } }), true);
  }
  for (const [key, value] of Object.entries(state)) {
    assert.equal(isLiquidPortalActive({ ...state, [key]: !value }), false, key);
  }
});

function fixture({ capturable = true, rejectPlay = false, frameCallbacks = false } = {}) {
  class Disposable {
    constructor(options) { Object.assign(this, options); }
    dispose() { this.disposed = true; }
  }
  class Vector3 {
    constructor(x, y, z) { Object.assign(this, { x, y, z }); }
    clone() { return new Vector3(this.x, this.y, this.z); }
    project() { return new Vector3((this.z + 1.9304) / 2, (this.y - 1.016) / 2, 0); }
  }
  const THREE = {
    MeshBasicMaterial: Disposable, ShaderMaterial: Disposable,
    PlaneGeometry: class extends Disposable { constructor(width, height) { super({ width, height }); } },
    Mesh: class { constructor(geometry, material) { Object.assign(this, { geometry, material, position: { set: (...xyz) => this.xyz = xyz }, rotation: {} }); } },
    VideoTexture: class extends Disposable { constructor(video) { super({ video }); } },
    NoBlending: 0, SRGBColorSpace: "srgb", Vector3,
  };
  const scene = { objects: new Set(), add(obj) { this.objects.add(obj); }, remove(obj) { this.objects.delete(obj); } };
  const track = { readyState: "live", stop() { this.readyState = "ended"; this.stopped = true; } };
  const stream = { getVideoTracks: () => [track], getTracks: () => [track] };
  const sourceCanvas = { width: 256, height: 512, clientWidth: 512, clientHeight: 1024 };
  let captures = 0;
  if (capturable) sourceCanvas.captureStream = (fps) => { assert.equal(fps, 30); captures++; track.readyState = "live"; return stream; };
  const events = new Map();
  let srcWrites = 0;
  const frame = {
    style: {}, contentDocument: { location: { pathname: "/liquid/" }, querySelectorAll: () => [sourceCanvas] },
    set src(value) { srcWrites++; this.source = value; },
    addEventListener(name, fn) { events.set(name, fn); },
    removeEventListener(name) { events.delete(name); },
    removeAttribute(name) { if (name === "src") this.source = undefined; },
  };
  const layer = { hidden: true };
  const camera = { position: { x: 10 }, near: 0.1, far: 320, updateMatrixWorld() {}, worldToLocal: () => ({ z: -10 }) };
  const videos = [];
  const controller = createLiquidPortal({ THREE, scene, frame, layer, opening: DICE_DOOR_OPENING,
    preview: { clientWidth: 800, clientHeight: 600 }, createVideo() {
      const video = { readyState: 0, videoWidth: 0, videoHeight: 0, currentTime: 0,
        play: () => rejectPlay ? Promise.reject(Error("blocked")) : Promise.resolve(),
        pause() { this.paused = true; } };
      if (frameCallbacks) {
        video.requestVideoFrameCallback = (fn) => { video.frameCallback = fn; return 1; };
        video.cancelVideoFrameCallback = () => { video.frameCallback = null; };
      }
      videos.push(video);
      return video;
    } });
  return { ...controller, scene, frame, layer, camera, track, videos, sourceCanvas,
    fireLoad: () => events.get("load")?.(), sourceWrites: () => srcWrites, captures: () => captures };
}

test("one source is preloaded and stays loaded across camera movement, pause and Dice", () => {
  const f = fixture({ capturable: false });
  assert.equal(f.surface.visible, false);
  f.preload(); f.preload();
  assert.equal(f.sourceWrites(), 1);
  assert.equal(f.frame.source, LIQUID_PORTAL_SOURCE);
  f.fireLoad();
  f.setActive(true); f.update(f.camera, 10);
  assert.equal(f.surface.visible, true);
  assert.equal(f.layer.hidden, false);
  const first = f.frame.style.transform;
  assert.ok(first.startsWith("matrix3d("));
  f.camera.worldToLocal = () => ({ z: 5 });
  f.update(f.camera, 20);
  assert.equal(f.surface.visible, true); // regular mesh handles offscreen/behind-camera clipping
  assert.equal(f.frame.style.transform, "");
  f.setActive(false);
  assert.equal(f.surface.visible, false);
  assert.equal(f.layer.hidden, true);
  f.setActive(true); f.update(f.camera, 30);
  assert.equal(f.sourceWrites(), 1);
  f.dispose();
  assert.equal(f.scene.objects.size, 0);
  assert.equal(f.frame.source, undefined);
  assert.equal(f.surface.geometry.disposed, true);
});

test("fallback projects the exact recessed mesh and writes depth with zero alpha", () => {
  const f = fixture({ capturable: false });
  f.setActive(true); f.fireLoad(); f.update(f.camera, 100);
  const material = f.surface.material;
  assert.equal(material.depthTest, true);
  assert.equal(material.depthWrite, true);
  assert.equal(material.transparent, false);
  assert.equal(material.blending, 0);
  assert.match(material.fragmentShader, /vec4\(0\.0\)/);
  const plane = getLiquidPortalPlane(DICE_DOOR_OPENING);
  const expected = plane.corners.map((c) => ({ x: ((c.z + 1.9304) / 2 + 1) * 400, y: (1 - (c.y - 1.016) / 2) * 300 }));
  const inputs = [[0, 0], [512, 0], [512, 1024], [0, 1024]];
  for (let i = 0; i < 4; i++) {
    const actual = mapCssMatrix(f.frame.style.transform, ...inputs[i]);
    assert.ok(Math.abs(actual.x - expected[i].x) < 1e-5);
    assert.ok(Math.abs(actual.y - expected[i].y) < 1e-5);
  }
  f.camera.position.x = 20;
  f.update(f.camera, 200);
  assert.equal(f.frame.style.transform, "");
  assert.notEqual(f.surface.material, material);
  f.dispose();
});

test("live source becomes a depth-tested video texture; resizes and teardown release resources", () => {
  const f = fixture();
  f.setActive(true); f.fireLoad(); f.update(f.camera, 100);
  assert.equal(f.captures(), 1);
  assert.equal(f.videos[0].muted, true);
  assert.equal(f.videos[0].playsInline, true);
  assert.ok(f.frame.style.transform.startsWith("matrix3d("));
  const video = f.videos[0];
  Object.assign(video, { readyState: 2, videoWidth: 256, videoHeight: 512, currentTime: 0.1 });
  f.update(f.camera, 200);
  const material = f.surface.material;
  const texture = material.map;
  assert.equal(texture.video, video);
  assert.equal(material.transparent, true);
  assert.equal(material.opacity, 0.8);
  assert.equal(texture.colorSpace, "srgb");
  assert.equal(material.depthTest, true);
  assert.equal(material.depthWrite, true);
  assert.equal(f.frame.style.transform, "");
  video.videoWidth = 512; video.videoHeight = 1024; video.currentTime = 0.2;
  f.update(f.camera, 300);
  assert.equal(texture.disposed, true);
  const second = material.map;
  assert.notEqual(second, texture);
  f.setActive(false);
  assert.equal(second.disposed, true);
  assert.equal(video.paused, true);
  assert.equal(video.srcObject, null);
  assert.equal(f.track.stopped, true);
  f.setActive(true); f.update(f.camera, 400);
  assert.equal(f.captures(), 2);
  assert.equal(f.sourceWrites(), 1);
  f.dispose();
});

test("rejected playback and stalled or ended media return to the live iframe instead of freezing", async () => {
  const blocked = fixture({ rejectPlay: true });
  blocked.setActive(true); blocked.fireLoad(); blocked.update(blocked.camera, 10);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(blocked.track.stopped, true);
  blocked.update(blocked.camera, 20);
  assert.match(blocked.frame.style.transform, /^matrix3d\(/);
  blocked.dispose();
  const f = fixture();
  f.setActive(true); f.fireLoad(); f.update(f.camera, 10);
  Object.assign(f.videos[0], { readyState: 2, videoWidth: 256, videoHeight: 512, currentTime: 1 });
  f.update(f.camera, 20);
  const tex = f.surface.material.map;
  f.update(f.camera, 4200);
  assert.equal(tex.disposed, true);
  assert.match(f.frame.style.transform, /^matrix3d\(/);
  f.update(f.camera, 9300);
  assert.equal(f.captures(), 2);
  f.track.readyState = "ended";
  f.update(f.camera, 9400);
  assert.match(f.frame.style.transform, /^matrix3d\(/);
  f.dispose();
});

test("only eligible same-origin liquid canvases are captured and security exceptions are safe", () => {
  const f = fixture();
  const small = { ...f.sourceCanvas, clientWidth: 1, clientHeight: 1 };
  const hidden = { ...f.sourceCanvas, clientWidth: 0 };
  f.frame.contentDocument.querySelectorAll = () => [small, hidden, f.sourceCanvas];
  assert.equal(findLiquidCanvas(f.frame), f.sourceCanvas);
  f.frame.contentDocument.location.pathname = "/other/";
  assert.equal(findLiquidCanvas(f.frame), null);
  assert.equal(findLiquidCanvas({ get contentDocument() { throw Error("security"); } }), null);
  f.dispose();
});

test("scene wiring preloads one plane, updates it before every room render, and places source below canvas", () => {
  const js = readFileSync(new URL("./ramblegamble.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("./ramblegamble.css", import.meta.url), "utf8");
  const html = readFileSync(new URL("../rg/index.html", import.meta.url), "utf8");
  assert.match(js, /carveDiceDoorway\(stageModel\);\s+if \(liquidPortalFrame && liquidPortalLayer\)/);
  assert.match(js, /liquidPortal\.preload\(\)/);
  assert.match(js, /updateSkyAnimations\(time\);\s+updateLiquidPortal\(time\);\s+if \(diceModeOpen\)/);
  assert.match(js, /alpha: true, \/\/ Only the depth-tested compatibility plane/);
  assert.match(js, /liquidPortal\?\.dispose\(\)/);
  assert.match(css, /#rg-canvas \{[^}]*z-index: 1;/);
  assert.match(css, /\.rg-liquid-portal-layer \{[^}]*z-index: 0;[^}]*pointer-events: none;/);
  assert.match(readFileSync(new URL("./host-access.mjs", import.meta.url), "utf8"), /ramblegamble\.js\?v=side-votes-20261128-v1/);
  assert.match(html, /ramblegamble\.css\?v=side-votes-20261128-v1/);
});


test("actual frame callbacks detect stalled pictures even if media time keeps advancing", () => {
  const f = fixture({ frameCallbacks: true });
  f.setActive(true); f.fireLoad(); f.update(f.camera, 100);
  const video = f.videos[0];
  Object.assign(video, { readyState: 2, videoWidth: 256, videoHeight: 512, currentTime: 1 });
  video.frameCallback(200);
  f.update(f.camera, 200);
  const texture = f.surface.material.map;
  video.currentTime = 2;
  video.frameCallback(3500);
  f.update(f.camera, 3500);
  assert.equal(f.surface.material.map, texture);
  video.currentTime = 7;
  f.update(f.camera, 7600);
  assert.equal(texture.disposed, true);
  assert.equal(video.frameCallback, null);
  assert.match(f.frame.style.transform, /^matrix3d\(/);
  f.dispose();
});

import { VIP_LIQUID_SOURCE } from "./vip-liquid-preset.mjs";

test("both VIP surfaces share one neutral black preset with all supplied motion and surface settings", () => {
  assert.equal(LIQUID_PORTAL_SOURCE, VIP_LIQUID_SOURCE);
  const url = new URL(VIP_LIQUID_SOURCE, "https://kazvt.com/rg/");
  assert.equal(url.pathname, "/liquid/");
  assert.equal(url.hash, "");
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    theatre: "on", fullscreen: "on", color_low: "#030303", color_mid: "#171717", color_high: "#626262",
    viscosity: "0", speed: "2", fold_size: "0.65", zoom: "0.74", wrap_edges: "off", height_range: "0.45",
    relief: "1.65", detail: "61%", gloss: "1.80", sharpness: "33", blur: "0", saturation: "0.88",
    contrast: "0.90", brightness: "-0.060", render_quality: "50%",
  });
  assert.equal(url.searchParams.size, 20);
  assert.match(url.search, /color_low=%23030303/);
  assert.match(url.search, /detail=61%25/);
  const dice = readFileSync(new URL("./dice-mode.js", import.meta.url), "utf8");
  assert.match(dice, /import \{ VIP_LIQUID_SOURCE \} from "\.\/vip-liquid-preset\.mjs\?v=vip-black-liquid-20261126-v1"/);
  assert.match(dice, /liquid\.src = VIP_LIQUID_SOURCE;/);
  assert.match(dice, /liquid\.removeAttribute\("src"\)/);
  assert.doesNotMatch(dice, /liquid\.src\s*=\s*["']\/liquid/);
});

test("VIP doorway has 80% opacity and Dice liquid has 50% opacity over the existing animated sky", () => {
  const css = readFileSync(new URL("./ramblegamble.css", import.meta.url), "utf8");
  assert.match(css, /\.rg-liquid-portal-frame \{[^}]*background: #030303;/);
  assert.match(css, /\.rg-dice-dialog \{[^}]*background: transparent;/);
  assert.match(css, /\.rg-dice-dialog::backdrop \{[^}]*background: transparent;/);
  assert.match(css, /\.rg-preview\.is-dice-mode > :not\(#rg-canvas\) \{ display: none !important; \}/);
  assert.match(css, /\.rg-dice-liquid \{[^}]*background: #030303;[^}]*opacity: 0\.5;/);
  const f = fixture();
  assert.equal(f.surface.material.color, 0x030303);
  assert.equal(f.surface.material.opacity, 0.8);
  assert.equal(f.surface.material.transparent, true);
  assert.match(css, /\.rg-liquid-portal-frame \{[^}]*opacity: 0\.8;/);
  f.dispose();
  const gate = readFileSync(new URL("./host-access.mjs", import.meta.url), "utf8");
  const html = readFileSync(new URL("../rg/index.html", import.meta.url), "utf8");
  assert.match(gate, /dice-mode\.js\?v=sky-soot-20261127-v1/);
  assert.match(html, /host-access\.mjs\?v=side-votes-20261128-v1/);
});

import { runInNewContext } from 'node:vm';
test('Dice mode swaps the existing room canvas to sky-only immediately and restores exact visibility on exit',()=>{
 const src=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8');
 const start=src.indexOf('  window.addEventListener("rg:dice-mode-state",');
 const end=src.indexOf('  window.addEventListener("keydown",',start);
 const objects=[{visible:true},{visible:true},{visible:false},{visible:true},{visible:true},{visible:false},{visible:true}],skyRoot={visible:true};
 const events=[],listeners={},classes=new Set(),billboardClasses=new Set(),portalStates=[],ambienceStates=[],musicStates=[],skySuspensions=[],marqueeSuspensions=[];
 const classList=set=>({add:v=>set.add(v),remove:v=>set.delete(v)});
 const pointsHud={},diceDialog={},awardParents=[];
 const context={sidePortraits:{clear(){}},pointAwardStinger:{relocate:parent=>awardParents.push(parent)},resetEncounter(){},gameStarted:true,sceneReady:true,pauseMenuOpen:false,document:{hidden:false,getElementById:()=>diceDialog,documentElement:{hasAttribute:()=>false}},syncVipAmbience:active=>ambienceStates.push([active,context.diceModeOpen]),syncMusic:()=>musicStates.push(context.diceModeOpen),freecam:{stop(){}},diceModeOpen:false,pointsHud,diceHeader:{prepend:h=>events.push(['hud-in',h])},preview:{classList:classList(classes),insertBefore:h=>events.push(['hud-out',h])},result:{hidden:false},updateLiquidPortal:()=>portalStates.push(context.diceModeOpen),focusDrag:{clearHover(){}},lastScenePointer:null,stopRouletteSettlement(){},rouletteCabinetFX:null,floatingSky:{suspend(){skySuspensions.push(context.diceModeOpen);}},slotMarquee:{suspend(){marqueeSuspensions.push(context.diceModeOpen);}},diceModeVisibility:null,stageModel:objects[0],rouletteRig:objects[1],slotRig:objects[2],exteriorMist:{group:objects[3]},audience:{group:objects[4]},showFX:{group:objects[5]},stageShow:{group:objects[6],reset(){}},characterSelection:null,exteriorHands:null,contestantStands:{suspend(){}},currentView:{kind:"overview"},billboardLayer:{classList:classList(billboardClasses)},hideGameCursor(){},renderer:{render(){events.push(['render',...objects.map(o=>o.visible),skyRoot.visible]);}},scene:{},camera:{updateMatrixWorld(){}},suppressElapsedWheelCue(){},pendingTrivia:false,pendingCardGameMode:'',window:{addEventListener:(key,fn)=>listeners[key]=fn}};
 runInNewContext(src.slice(start,end),context);
 const change=open=>listeners['rg:dice-mode-state']({detail:{open}});
 change(true);assert.deepEqual(objects.map(o=>o.visible),[false,false,false,false,false,false,false]);assert.equal(skyRoot.visible,true);assert.ok(classes.has('is-dice-mode'));assert.ok(context.result.hidden);
 assert.deepEqual(events,[['hud-in',pointsHud],['render',false,false,false,false,false,false,false,true]]);assert.deepEqual(portalStates,[true]);assert.deepEqual(skySuspensions,[true]);assert.deepEqual(marqueeSuspensions,[true]);
 change(true);assert.equal(events.length,2,'duplicate open is idempotent');
 change(false);assert.deepEqual(objects.map(o=>o.visible),[true,true,false,true,true,false,true]);assert.equal(skyRoot.visible,true);assert.ok(!classes.has('is-dice-mode'));assert.ok(!billboardClasses.size);assert.deepEqual(events.at(-1),['hud-out',pointsHud]);assert.deepEqual(portalStates,[true,false]);assert.deepEqual(ambienceStates,[[true,true],[true,false]]);assert.deepEqual(musicStates,[true,false]);assert.deepEqual(skySuspensions,[true]);assert.deepEqual(marqueeSuspensions,[true]);assert.deepEqual(awardParents,[diceDialog,context.preview]);
});
