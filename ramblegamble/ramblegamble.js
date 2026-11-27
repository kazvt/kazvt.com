import { createShowCredits } from "./show-credits.mjs?v=show-finale-20261128-v1";
import { createContestantStands } from "./contestant-stands.mjs?v=stand-lift-20261128-v1";
import { horrorRenderScale, HORROR_FRAME_MS } from "./smeemo-horror.mjs?v=smeemo-arrival-20261128-v1";
import { readCardGames } from "./card-games-store.mjs?v=show-stage-20261126-v1";
import { createSlotMarquee } from "./slot-marquee.mjs?v=slot-marquee-20261128-v1";
import { createSmeemoEncounter, createSmeemoStinger, createSmeemoTableSession, SMEEMO_RETURN_MS } from "./smeemo-reveal.mjs?v=smeemo-smooth-20261128-v1";
import { createFloatingSky } from "./floating-sky.mjs?v=sky-solid-lettering-20261128-v1";
import { createStageDance, createDanceClock, createDanceIntensitySampler, dancePose } from "./stage-dance.mjs?v=music-intensity-20261128-v1";
import { createSoundtrack, soundtrackFor } from "./soundtrack.mjs?v=freecam-music-20261128-v1";
import { createVipInteriorTracker, sampleMusicZoneGain } from "./music-zones.mjs?v=music-zone-fade-20261128-v1";
import { createMenuMarquee } from "./menu-marquee.mjs?v=retro-karaoke-20261128-v1";
import { createFocusArrow, focusArrowKey, projectedArrowTarget, characterArrowTarget } from "./focus-arrow.mjs?v=smeemo-reveal-20261127-v1";
import { HAZEL_SOURCE, hazelBalconyPose, hazelCameraFrame } from "./hazel-balcony.mjs?v=hazel-balcony-20261127-v1";
import { createSignGlow } from "./sign-glow.mjs?v=neon-focus-20261127-v1";
import { selectedCharacterId, characterRenderPose, createCharacterSelection } from "./character-selection.mjs?v=stage-dance-20261127-v1";
import { sampleVipAmbience } from "./vip-atmosphere.mjs?v=sky-soot-20261127-v1";
import { createStageShow } from "./stage-show.mjs?v=curtain-karaoke-20261128-v1";
import { REVEAL_MS, RETRACT_MS, smooth as theatreEase } from "./stage-show-state.mjs?v=all-curtain-20261127-v1";
import { createCharacterOcclusion } from "./character-occlusion.mjs?v=stage-dance-20261127-v1";
import { bindHoldFreecam } from "./hold-freecam.mjs?v=hold-freecam-20261127-v1";
import { AUDIENCE_MODES, AUDIENCE_KEY, readAudienceMode, writeAudienceMode, createAudienceState } from "./audience-state.mjs?v=smeemo-alpha-20261128-v1";
import { createAudienceRenderer, crowdCatAnchor, CROWD_CAT } from "./audience-render.mjs?v=exterior-hands-20261128-v1";
import { createShowFX } from "./show-fx.mjs?v=sky-soot-20261127-v1";
import { createRouletteCabinetFX } from "./roulette-cabinet-fx.mjs?v=sky-soot-20261127-v1";
import { cameraTravelDuration, isSpookyView, suspenseEase, crowdCloseupPose } from "./spooky-camera.mjs?v=cartoon-machines-20261127-v1";
import { CHARACTER_SOURCE_SIZE, CHARACTER_YAW_LIMIT, characterYaw, standingCharacterPose, projectCharacterQuad, pointInCharacterQuad } from "./character-billboards.mjs?v=stage-dance-20261127-v1";
import { createScoreHud } from "./show-ui-fx.mjs?v=show-energy-20261127-v1";
import { createFocusOrbit, orbitPosition, bindFocusDrag, focusLimits } from "./focus-orbit.mjs?v=settlement-hover-20261127-v1";
import { createExteriorHands, sampleExteriorAmbience } from "./exterior-hands.mjs?v=exterior-hands-20261128-v1";
import { createExteriorMist, EXTERIOR_FLOOR } from "./exterior-mist.mjs?v=crowd-mist-20261127-v1";
import { fitSlotInteractionFrame, fitSlotColumnArrow, rouletteRecessCenter, ROULETTE_RECESS, fitCharacterCloseup } from "./arcade-framing.mjs?v=slot-closeup-20261128-v1";
import { foley } from "./game-foley.mjs?v=sky-soot-20261127-v1";
import { createSlotCabinetFX } from "./slot-cabinet-fx.mjs?v=sky-soot-20261127-v1";
import {
  resolvePointClickAction,
  resolvePointClickBack,
  resolvePointClickCursor,
  resolveSceneNavigationZone,
  resolveArcadeShortcut,
  resolveSlotContextCell,
  resolveHostContextAction,
} from "./point-click-routing.js?v=cartoon-machines-20261127-v1";
import { createQuestionPicker, readSessionQuestionBank } from "./question-bank.mjs?v=host-question-bank-session-20261118-v1";
import { DICE_DOOR_OPENING, isDiceDoorBackingTriangle } from "./dice-doorway.mjs?v=dice-door-wall-target-20261120-v1";
import { readPointScores, subscribePointScores, subscribeStarScores, writePointScores, withPointScoresLock } from "./points-store.mjs?v=player-stats-20261127-v1";
import {
  createLiquidPortal,
  createCssProjectiveQuad,
  isLiquidPortalActive,
} from "./liquid-portal.mjs?v=vip-opacity-20261126-v1";
import {
  createSlotLineMotion,
  normalizeSlotGrid,
  sampleSlotReelColumn,
  sampleSlotReelRow,
  SLOT_REEL_WILDCARD,
  slotCellIndexAtUv,
  slotScreenPoint,
  slotMotionFrame,
} from "./slot-reels.mjs?v=parked-reels-20261127-v1";
import { createSlotWinAnimation, isSlotWinFinished, paintSlotWin } from "./slot-win-animation.mjs?v=show-stage-20261126-v1";
import { createSlotLinePainter } from "./slot-reel-render.mjs?v=parked-reels-20261127-v1";
import { getSlotEligibleIndexes, placeSlotBerry, placeSlotSymbolAtCell, removeSlotSymbol, resolveSlotPayouts, rotateSlotColumns, secureRandomIndex } from "./slot-game.mjs?v=host-cell-cards-20261127-v1";
import {
  ROULETTE_BALL_COLOR,
  ROULETTE_BALL_LANDING_RADIUS,
  ROULETTE_BALL_LANDING_HEIGHT,
  sampleRouletteBallHeight,
  alignBallToPocket,
  ROULETTE_BALL_TRACK_RADIUS,
  rouletteBallPositionAtRadius,
  sampleRouletteBallRadius,
} from "./roulette-ball-motion.mjs?v=stage-dance-20261127-v1";

(() => {
  "use strict";

  let THREE;
  let GLTFLoader;
  const preview = document.getElementById("rg-preview");
  const focusArrow = createFocusArrow(preview);
  const canvas = document.getElementById("rg-canvas");
  const liquidPortalLayer = document.getElementById("rg-liquid-portal-layer");
  const liquidPortalFrame = document.getElementById("rg-liquid-portal-frame");
  const billboardLayer = document.getElementById("rg-billboard-layer");
  const slotControlLayer = document.getElementById("rg-slot-control-layer");
  const pointsHud = document.getElementById("rg-points-hud");
  const diceHeader = document.querySelector(".rg-dice-header");
  const loading = document.getElementById("rg-loading");
  const result = document.getElementById("rg-result");
  const readyScreen = document.getElementById("rg-ready-screen");
  const goButton = document.getElementById("rg-go");
  const pauseMenu = document.getElementById("rg-pause-menu");
  const menuMarquee = document.getElementById("rg-marquee-video");
  const menuTheme = document.getElementById("rg-menu-theme");
  menuTheme.muted = foley.muted;
  const playButton = document.getElementById("rg-play");
  const controlsOpenButton = document.getElementById("rg-controls-open");
  const controlsDialog = document.getElementById("rg-controls-dialog");
  const controlsCloseButton = document.getElementById("rg-controls-close");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const creditsDialog = document.getElementById("rg-show-credits");
  const menuPresentation = createMenuMarquee({menu:pauseMenu,video:menuMarquee,theme:menuTheme,karaokeRoot:document.getElementById("rg-menu-karaoke"),plate:document.getElementById("rg-marquee-plate"),glow:document.getElementById("rg-marquee-neon"),controls:controlsDialog,credits:creditsDialog});
  const creditsPresentation = createShowCredits({dialog:creditsDialog,button:document.getElementById("rg-credits-open"),menu:pauseMenu,onOpenChange:()=>menuPresentation.sync(),muted:()=>foley.muted});
  const FORCED_THEME = "p2";
  const ROULETTE_PART_NAMES = new Set(["center", "wheel", "rim", "ball"]);
  const SLOT_PART_NAMES = new Set(["machine", "slot-reel-display", "arm", "button1", "button2", "button3", "button4", "button5"]);
  const SLOT_GRID_STORAGE_KEY = "ramblegamble.slot-game-board.v1";
  const SLOT_DISPLAY_PIXELS = Object.freeze({ left: 5, right: 75, top: 16, bottom: 58 });
  const SLOT_SYMBOL_IMAGE_PATH = "/ramblegamble/assets/berries/";
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
    diceDoor: DICE_DOOR_OPENING,
    // The back-wall recess in rg_stage.gltf spans x=9.14..14.48 at z=-6.10.
    // A small size increase matches the reference cabinet while staying inside the recess.
    slotBay: Object.freeze({ left: 9.14, right: 14.48, wallZ: -6.10, height: 2.52, widthScale: 1.08, clearance: 0.025 }),
    // The roulette is placed against the actual recessed lip in world space.
    rouletteScale: 0.13,
  });
  const SKY_CONFIG = Object.freeze({
    radius: 260,
    // One instanced draw keeps a denser, full-sky field inexpensive to render.
    starCount: 1800,
    topColor: "#100818",
    // A blue-violet lavender, avoiding the dusty pink cast of the old horizon.
    horizonColor: "#865fd0",
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
  let audience, showFX, stageShow, signGlow, characterSelection, stageDance, slotMarquee, contestantStands;
  const danceClock=createDanceClock();
  const danceIntensity=createDanceIntensitySampler();
  let danceTime=NaN;
  let characterSelectedAt=-Infinity;
  let crowdClock=0,crowdLastFrame=null;
  const crowdState=createAudienceState(crowdClock,readAudienceMode());
  const audienceControls=document.getElementById("rg-audience-controls");
  function syncAudienceControls(){for(const b of audienceControls?.querySelectorAll("[data-audience]")||[])b.setAttribute("aria-pressed",String(b.dataset.audience===crowdState.mode));}
  function selectAudienceMode(mode){if(document.documentElement.hasAttribute("data-rg-host-locked"))return;if(writeAudienceMode(mode)){crowdState.setMode(mode,crowdClock);if(encounter.quiet)silenceCrowd();syncAudienceControls();}}
  for(const mode of AUDIENCE_MODES){if(!audienceControls)break;const b=document.createElement("button");b.type="button";b.dataset.audience=mode;b.textContent=mode.toUpperCase();b.className="rg-secondary-button";b.addEventListener("click",()=>selectAudienceMode(mode));audienceControls.append(b);}
  const crowdStatus=document.createElement("small"); crowdStatus.setAttribute("role","status"); audienceControls?.append(crowdStatus);
  let shownCrowdStatus="";
  function silenceCrowd(){const wasCheering=crowdState.mode==='cheer';crowdState.silence(crowdClock);if(wasCheering){writeAudienceMode(crowdState.mode);syncAudienceControls();}}
  function reactCrowd(emotion){if(!encounter.quiet)crowdState.react(emotion,crowdClock);}
  function updateCrowdStatus(){const label=encounter.hideCrowd?"HIDDEN · SMEEMO":encounter.quiet?"IDLE · SMEEMO":crowdState.active.toUpperCase()+(crowdState.pending!==crowdState.active?` → ${crowdState.pending.toUpperCase()}`:"");if(label!==shownCrowdStatus){crowdStatus.textContent=label;shownCrowdStatus=label;}}
  syncAudienceControls();
  window.addEventListener("storage",event=>{if(event.key===AUDIENCE_KEY||event.key===null){crowdState.setMode(readAudienceMode(),crowdClock);if(encounter.quiet)silenceCrowd();syncAudienceControls();}});
  window.addEventListener("rg:audience-reaction",event=>{if(gameStarted&&!pauseMenuOpen&&!document.hidden&&!document.documentElement.hasAttribute("data-rg-host-locked"))reactCrowd(event.detail?.emotion);});
  let renderer;
  let scene;
  let camera;
  let raycaster;
  let pointer;
  let resizeObserver;
  let animationFrame = 0;
  let wheelPivot;
  let ballPivot;
  let ballOrbitObject;
  let lever;
  let rouletteRig;
  let slotRig;
  let slotCabinetFX;
  let rouletteCabinetFX;
  let cardTableModel;
  let skyRoot, floatingSky;
  let exteriorMist, exteriorHands;
  let skyStars;
  let skyStarsMesh;
  let skyShootingStarsMesh;
  let skyShootingStars = [];
  let skyStarsInitialized = false;
  let rouletteTargets = [];
  let slotTargets = [];
  let cardTableTargets = [];
  let diceDoorTargets = [];
  let wheelMotion = null;
  let leverMotion = null;
  let slotReelMotion = null;
  let slotCellPop = null;
  let slotWinCelebration = null;
  let lastSlotTravelRows = Object.create(null);
  let lastSlotTravelColumns = Object.create(null);
  let slotReelGrid = readSavedSlotGrid();
  let slotReelCanvas = null;
  let slotReelContext = null;
  let slotReelTexture = null;
  let slotReelDisplay = null;
  let slotControlTargets = new Map();
  const slotReelImages = new Map();
  let selectedSlotBerry = "kazberry";
  let slotPlacementControls = [];
  let slotFocusPoints = [];
  let slotSpinButtonCorners = [];
  let slotBerryPicker = null;
  let slotHoverLine = null;
  let slotHoverCell = -1;
  let slotResultTimeout = 0;
  let slotResultToken = 0;
  const pickQuestion = createQuestionPicker();
  let playing = false;
  let gameStarted = false;
  let pauseMenuOpen = false;
  let sceneReady = false;
  let liquidPortal = null;
  let diceModeOpen = false;
  let diceModeVisibility = null;
  let stageModel;
  let rouletteModel;
  let slotsModel;
  const unlitMaterialCache = new WeakMap();
  let contestants = [];
  let hostBillboard = null;
  let hazelBillboard = null;
  let billboards = [];
  let contestantTargets = [];
  let hostTargets = [];
  let currentView = { kind: "overview", look: 0 };
  let cameraTarget;
  let cameraTransition = null;
  const focusOrbit = createFocusOrbit();
  let focusBase = null;
  let focusDrag = null;
  let freecam = null;
  let cameraDetached = false;
  let characterOcclusion = null;
  let warnedOcclusion = false;
  let lastScenePointer = null;
  let overviewCameraBounds = null;
  let pendingCardGameMode = "";
  let pendingTrivia = false;
  let cardMusicMode = "";
  const soundtrack = createSoundtrack();
  const vipMusicInterior = createVipInteriorTracker(DICE_DOOR_OPENING);
  const smeemoMusicAnchor = Object.freeze(crowdCatAnchor());
  const spatialAudioState = { insideVip:false, vipMix:{room:1,water:0,cutoff:null}, exteriorMix:{room:1,water:0}, musicGain:1 };
  const encounter = createSmeemoEncounter();
  const smeemoTable = createSmeemoTableSession();
  let encounterStartPending = null;
  let encounterReturnRevision = null;
  const smeemoAura=document.getElementById("rg-smeemo-aura"), smeemoTag=document.getElementById("rg-smeemo-tag"), smeemoCount=document.getElementById("rg-smeemo-count");
  const stinger=createSmeemoStinger({root:document.getElementById("rg-smeemo-stinger"),video:document.getElementById("rg-smeemo-video"),caption:document.getElementById("rg-smeemo-stinger-caption"),muted:()=>foley.muted,onFinish:()=>{
    if(encounter.finish()){encounterReturnRevision=readCardGames().activityRevision;cardMusicMode="";canvas.focus({preventScroll:true});transitionToView({kind:"card-table"},{encounterReturn:true});}
  }});
  function resetEncounter(){
    encounterStartPending=null;encounterReturnRevision=null;
    if(encounter.phase==="hidden")return;
    // A cancelled encounter must not resume its old ambience on a later visit.
    // The post-return table phase is separate and may belong to a live Smeemo game.
    if(encounter.phase!=="table")soundtrack.resetTrackPosition("smeemo");
    if(encounter.quiet)silenceCrowd();
    encounter.reset();stinger.cancel();smeemoTag.hidden=true;smeemoAura.hidden=true;preview.removeAttribute("data-smeemo-step");
    for(const channel of ["smeemo-encounter-drum","smeemo-encounter-rumble","smeemo-encounter-scare"])foley.stop(channel);
    stageShow?.dismiss(performance.now());syncMusic();
  }
  function clickSmeemo(){
    if(!gameStarted||pauseMenuOpen||diceModeOpen||document.hidden||document.documentElement.hasAttribute("data-rg-host-locked")||document.querySelector("dialog[open]"))return;
    if(currentView.kind!=="smeemo-crowd"||cameraDetached)transitionToView({kind:"smeemo-crowd"});
    else if(cameraTransition)return;
    encounter.focus();const count=encounter.click();if(count===null)return;
    smeemoCount.textContent=`${count}/5`;preview.dataset.smeemoStep=String(count);
    smeemoTag.classList.remove("rg-smeemo-pulse");void smeemoTag.offsetWidth;smeemoTag.classList.add("rg-smeemo-pulse");
    smeemoAura.classList.remove("rg-smeemo-aura-pulse");void smeemoAura.offsetWidth;smeemoAura.classList.add("rg-smeemo-aura-pulse");
    if(count===1)stinger.prepare();
    if(count===2){foley.setRoomAmbience(false);foley.stopAll();silenceCrowd();stageShow?.silent(crowdCatAnchor(),performance.now());}
    foley.start("smeemo-encounter-drum","stageDrumHit",{rate:1-count*.075,volume:.36+count*.075});
    if(count===3||count===4)stageShow?.silent(crowdCatAnchor(),performance.now());
    if(count>=3)foley.start("smeemo-encounter-rumble","smeemoRumble",{rate:.8,volume:.4+count*.07});
    if(count===4)foley.start("smeemo-encounter-scare","smeemoWin",{rate:.72,volume:.28});
    if(count===5)foley.stop("smeemo-encounter-scare");
    syncMusic(true);
    if(count===5){smeemoTag.hidden=true;smeemoAura.hidden=true;focusArrow.hide();stinger.start();}
  }
  smeemoTag.addEventListener("click",clickSmeemo);
  function updateSmeemoEncounter(time,roomVisible){
    if(!roomVisible||diceModeOpen||cameraDetached||freecam?.active||document.querySelector("dialog[open]")){resetEncounter();return;}
    stinger.step();
    if(encounter.phase==="returning"&&!cameraTransition&&currentView.kind==="card-table"&&encounter.arrive()){
      if(cardTableModel){const b=new THREE.Box3().setFromObject(cardTableModel),center=b.getCenter(new THREE.Vector3());center.y=b.max.y;stageShow?.silent(center,time);}
      // Arrival, not stinger end, owns the fresh round. Keep the encounter
      // track through the asynchronous room lock; cancellation invalidates the ticket.
      const ticket={};encounterStartPending=ticket;cardLayer?.classList.add("is-off-table");
      const isCurrent=()=>encounterStartPending===ticket&&encounter.phase==="table"&&currentView.kind==="card-table"&&!cameraTransition&&!cameraDetached&&!freecam?.active&&gameStarted&&!pauseMenuOpen&&!diceModeOpen&&!document.hidden&&!document.documentElement.hasAttribute("data-rg-host-locked")&&!document.querySelector("dialog[open]");
      const detail={expectedRevision:encounterReturnRevision,isCurrent,handled:false,onSettled:()=>{
        if(encounterStartPending!==ticket)return;
        encounterStartPending=null;encounterReturnRevision=null;
        if(!smeemoTable.active)resetEncounter();else syncMusic();
      }};
      window.dispatchEvent(new CustomEvent("rg:start-smeemo-after-arrival",{detail}));
      if(!detail.handled)detail.onSettled(); // A missing UI must not leave music/controls stuck.
    }
    if(encounter.phase==="focused"&&currentView.kind==="smeemo-crowd"&&!cameraTransition&&stageShow&&!reducedMotion.matches&&!stageShow.silentActive)stageShow.silent(crowdCatAnchor(),time);
    const cat=audience?.cat;
    smeemoTag.hidden=!(encounter.phase==="focused"&&!cameraTransition&&currentView.kind==="smeemo-crowd"&&cat?.visible);
    smeemoAura.hidden=smeemoTag.hidden||encounter.count<2;
    if(smeemoTag.hidden)return;
    cat.updateWorldMatrix(true,false);
    const top=new THREE.Vector3(0,CROWD_CAT.height*.5,0).applyMatrix4(cat.matrixWorld).project(camera);
    if(top.z< -1||top.z>1||Math.abs(top.x)>1||Math.abs(top.y)>1){smeemoTag.hidden=true;smeemoAura.hidden=true;return;}
    const center=new THREE.Vector3().setFromMatrixPosition(cat.matrixWorld).project(camera);
    smeemoAura.style.left=`${(center.x+1)*preview.clientWidth*.5}px`;smeemoAura.style.top=`${(1-center.y)*preview.clientHeight*.5}px`;
    smeemoAura.style.width=`${Math.max(60,Math.abs(top.y-center.y)*preview.clientHeight*.9)}px`;
    smeemoTag.style.left=`${Math.max(70,Math.min(preview.clientWidth-70,(top.x+1)*preview.clientWidth*.5))}px`;
    smeemoTag.style.top=`${Math.max(48,(1-top.y)*preview.clientHeight*.5-8)}px`;
  }
  function sampleSpatialAudioZones() {
    const position = camera?.position;
    const trackedInsideVip = vipMusicInterior.update(position);
    const insideVip = diceModeOpen || trackedInsideVip;
    // Reuse the same VIP falloff sample for foley and music; no per-frame
    // allocations are needed for the audio-zone state or Smeemo anchor.
    sampleVipAmbience(position, DICE_DOOR_OPENING, { inside: insideVip }, spatialAudioState.vipMix);
    spatialAudioState.insideVip = insideVip;
    // Authored close-ups and the responsive overview are intentionally audible.
    // Only a camera physically detached from the room enters the exterior zone.
    sampleExteriorAmbience(position, !insideVip && (cameraDetached || !!freecam?.active || !!cameraTransition?.fromExterior), spatialAudioState.exteriorMix);
    // Smeemo and the VIP room attenuate normal music by actual camera
    // position, not by the selected view or the way the camera got there.
    spatialAudioState.musicGain = sampleMusicZoneGain(position, DICE_DOOR_OPENING, smeemoMusicAnchor, {
      insideVip, vipGain:spatialAudioState.vipMix.room,
    });
    spatialAudioState.musicGain = Math.min(spatialAudioState.musicGain, spatialAudioState.exteriorMix.room);
    return spatialAudioState;
  }
  function syncMusic(retry = false, zones = null) {
    // The marquee is music too: the shared sound preference applies to it.
    if (menuMarquee.muted !== foley.muted) menuMarquee.muted = foley.muted;
    if (menuTheme.muted !== foley.muted) menuTheme.muted = foley.muted;
    creditsPresentation.sync();
    if (retry) menuPresentation.retryTheme();
    zones ||= sampleSpatialAudioZones();
    const nextTrack = soundtrackFor({
      active: gameStarted && sceneReady && !pauseMenuOpen && !document.hidden && !document.documentElement.hasAttribute("data-rg-host-locked"),
      muted: foley.muted, dice: diceModeOpen, view: currentView.kind, cardMode: cardMusicMode, encounter:encounter.phase==="stinger"?"stinger":encounter.song||(encounterStartPending?"smeemo":null), smeemoTable:smeemoTable.active, detached:cameraDetached||!!freecam?.active,
    });
    // The authored Smeemo encounter/table track is intentional music for that
    // sequence. Spatial silence applies to ordinary scene music around the
    // hidden cat and VIP doorway, including while flying there in freecam.
    soundtrack.sync(nextTrack, { retry, spatialGain: nextTrack === "smeemo" ? 1 : zones.musicGain });
  }
  for (const type of ["pointerdown", "keydown", "click"]) document.addEventListener(type, event => {
    if (event.isTrusted) syncMusic(true);
  }, { capture: true, passive: true });
  document.getElementById("rg-foley-enabled")?.addEventListener("change", () => syncMusic(true));
  window.addEventListener("storage", event => {
    if (event.key === "ramblegamble.foley.muted.v1" || event.key === null) syncMusic();
  });
  new MutationObserver(() => { syncMusic(); if (document.documentElement.hasAttribute("data-rg-host-locked")) { resetEncounter(); floatingSky?.suspend(); slotMarquee?.suspend(); contestantStands?.suspend(); } }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-rg-host-locked"] });
  const triviaLayer = document.getElementById("rg-live-trivia");
  let skyRandomState = 0x4b415a56;

  function updateLiquidPortal(time = performance.now()) {
    if (!liquidPortal) return;
    liquidPortal.setActive(isLiquidPortalActive({
      gameStarted, pauseMenuOpen, diceModeOpen, sceneReady,
      documentHidden: document.hidden,
    }));
    liquidPortal.update(camera, time);
  }

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
    const bgColor = new THREE.Color(color);
    const accentColor = new THREE.Color(themeValue("--pink", "#f599c6"));
    const blueColor = new THREE.Color(themeValue("--blue", "#4d6787"));
    scene.traverse((object) => {
      if (object.userData.rgFloor) object.material.color.copy(bgColor);
      if (object.userData.rgAccent) object.material.color.copy(accentColor);
      if (object.userData.rgSecondary) object.material.color.copy(blueColor);
    });
  }

  function nextHostQuestion() {
    return pickQuestion(readSessionQuestionBank());
  }

  function finishTurn({ settled = false, audible = false } = {}) {
    foley.stop("roulette");
    foley.stop("roulette-rattle");
    const visible = gameStarted && !pauseMenuOpen && !diceModeOpen && !document.hidden
      && currentView.kind === "roulette" && !document.documentElement.hasAttribute("data-rg-host-locked");
    // This is a completed spin, not a claim that a player won points.
    if (settled && audible && visible) {
      foley.start("roulette-landing", "ball", { volume: .65 });
      foley.start("roulette-settlement", "settlement");
      showFX?.impact(performance.now(),true); reactCrowd("cheer");
    }
    const prompt = nextHostQuestion();
    if (prompt && !settled && visible) foley.play("question", { volume: .55 });
    slotResultToken += 1;
    window.clearTimeout(slotResultTimeout);
    slotResultTimeout = 0;
    result.textContent = prompt;
    result.hidden = !prompt;
    playing = false;
    preview.classList.remove("is-playing");
    syncSlotPlacementControls();
    window.dispatchEvent(new CustomEvent("rg:turn-finish", { detail: { prompt } }));
  }

  function beginTurn(machine) {
    if (playing || document.documentElement.hasAttribute("data-rg-host-locked")) return false;
    playing = true;
    preview.classList.add("is-playing");
    hideResult();
    syncSlotPlacementControls();
    window.dispatchEvent(new CustomEvent("rg:turn-start", { detail: { machine } }));
    return true;
  }

  function hideResult() {
    slotResultToken += 1;
    window.clearTimeout(slotResultTimeout);
    slotResultTimeout = 0;
    result.hidden = true;
  }

  function showSlotPayout(totals) {
    const messages = Object.entries(totals)
      .filter(([, amount]) => amount > 0)
      .map(([name, amount]) => `${name.toUpperCase()} +${Number(amount).toLocaleString()}`);
    if (!messages.length) return;
    result.textContent = messages.join(" - ");
    result.hidden = false;
    const token = ++slotResultToken;
    window.clearTimeout(slotResultTimeout);
    slotResultTimeout = window.setTimeout(() => {
      if (token === slotResultToken) result.hidden = true;
      slotResultTimeout = 0;
    }, 3200);
  }

  function stopRouletteSettlement() {
    foley.stop("roulette-landing"); foley.stop("roulette-settlement");
  }

  function canShowRouletteCabinet() {
    return gameStarted && !pauseMenuOpen && !diceModeOpen && !document.hidden
      && !document.documentElement.hasAttribute("data-rg-host-locked")
      && currentView.kind === "roulette" && !cameraDetached && !freecam?.active && !cameraTransition;
  }

  function startWheelSpin() {
    if (!beginTurn("wheel")) return;
    stopRouletteSettlement();
    showFX?.clearRoulette(); if(gameStarted&&!pauseMenuOpen&&!document.hidden&&currentView.kind==="roulette")reactCrowd("suspense");
    foley.play("switch");
    foley.start("roulette", "wheel", { loop: true });
    foley.start("roulette-rattle", "slotRattle", { loop: true, volume: .64 });
    if (!wheelPivot || !ballPivot || !ballOrbitObject) {
      wheelMotion = { started: performance.now(), duration: 700, wheelFrom: 0, wheelTo: 0, ballFrom: 0, ballTo: 0 };
      return;
    }
    const ballPosition = ballOrbitObject?.position;
    const ballRadiusFrom = ballPosition ? Math.hypot(ballPosition.x, ballPosition.z) : ROULETTE_BALL_TRACK_RADIUS;
    const ballPositionAtStart = ballPosition && rouletteBallPositionAtRadius(ballPosition, ballRadiusFrom);
    wheelMotion = {
      started: performance.now(),
      duration: reducedMotion.matches ? 650 : 3900,
      wheelFrom: wheelPivot.rotation.y,
      wheelTo: wheelPivot.rotation.y + (5 + Math.random() * 3) * Math.PI * 2 + Math.random() * Math.PI * 2,
      ballFrom: ballPivot.rotation.y,
      ballTo: ballPivot.rotation.y - (8 + Math.random() * 4) * Math.PI * 2 - Math.random() * Math.PI * 2,
      ballRadiusFrom,
      ballAngle: ballPositionAtStart ? Math.atan2(ballPositionAtStart.z, ballPositionAtStart.x) : Math.atan2(1, -13),
      ballHeight: ballPositionAtStart?.y ?? -7,
      pocketSector: null, lastPocketSound: -Infinity,
    };
    wheelMotion.ballTo = alignBallToPocket(wheelMotion.ballTo, wheelMotion.wheelTo, wheelMotion.ballAngle);
    rouletteCabinetFX?.begin(wheelMotion.started, wheelMotion.duration, {active:canShowRouletteCabinet(),reduced:reducedMotion.matches});
  }

  function prepareRouletteBall() {
    if (!ballPivot) return;

    const orbitNodes = [];
    const ballMaterial = new THREE.MeshBasicMaterial({ color: ROULETTE_BALL_COLOR, fog: false });
    ballMaterial.toneMapped = false;
    ballPivot.traverse((object) => {
      if (object === ballPivot) return;
      if (Math.hypot(object.position.x, object.position.z) > 1) orbitNodes.push(object);
      if (object.isMesh) object.material = ballMaterial;
    });
    ballOrbitObject = orbitNodes.find((object) => String(object.name || "").toLowerCase() === "ball")
      || orbitNodes[0]
      || null;
    if (!ballOrbitObject) {
      console.warn("Could not find the roulette ball's authored orbit offset.");
      return;
    }
    const startingPosition = rouletteBallPositionAtRadius(ballOrbitObject.position, ROULETTE_BALL_LANDING_RADIUS);
    if (startingPosition) {
      ballOrbitObject.position.set(startingPosition.x, ROULETTE_BALL_LANDING_HEIGHT, startingPosition.z);
      if (wheelPivot) ballPivot.rotation.y = alignBallToPocket(ballPivot.rotation.y, wheelPivot.rotation.y, Math.atan2(startingPosition.z, startingPosition.x));
    }
  }

  function startLeverPull() {
    return startSlotReelSpin([0, 1, 2, 3, 4], true);
  }

  function readSavedSlotGrid() {
    try { return normalizeSlotGrid(localStorage.getItem(SLOT_GRID_STORAGE_KEY)); }
    catch { return normalizeSlotGrid(null); }
  }

  const paintSlotLines = createSlotLinePainter();

  function drawSlotSymbol(column, row, symbol, xOffset = 0, yOffset = 0, {
    scale = 1,
    alpha = 1,
    rotation = 0,
    glow = 0,
  } = {}, context = slotReelContext) {
    if (!symbol || !context) return;
    const image = slotReelImages.get(symbol);
    if (!image?.complete || !image.naturalWidth) return;
    const cellWidth = slotReelCanvas.width / 5;
    const cellHeight = slotReelCanvas.height / 3;
    const size = Math.min(cellWidth, cellHeight) * 0.82 * scale;
    const centerX = column * cellWidth + cellWidth / 2 + xOffset;
    const centerY = row * cellHeight + cellHeight / 2 + yOffset;
    context.save();
    context.globalAlpha = alpha;
    if (glow > 0) {
      context.shadowColor = "#48f5ff";
      context.shadowBlur = glow;
    }
    context.translate(centerX, centerY);
    context.rotate(rotation);
    context.drawImage(image, -size / 2, -size / 2, size, size);
    context.restore();
  }

  function drawSlotReelDisplay(time = performance.now()) {
    if (!slotReelContext || !slotReelTexture) return;
    const context = slotReelContext;
    const cellWidth = slotReelCanvas.width / 5;
    const cellHeight = slotReelCanvas.height / 3;
    context.clearRect(0, 0, slotReelCanvas.width, slotReelCanvas.height);

    const motionFrame = slotReelMotion ? slotMotionFrame(slotReelMotion, time, reducedMotion.matches) : null;
    const fixedGrid = motionFrame?.grid || slotCellPop?.motion.targetGrid || slotReelGrid;
    fixedGrid.forEach((symbol, index) => {
      const column = index % 5;
      const row = Math.floor(index / 5);
      const pop = slotCellPop?.index === index ? slotCellPop : null;
      if (!pop) {
        const shake = motionFrame?.parked.get(index);
        drawSlotSymbol(column, row, symbol, (shake?.x || 0) * cellWidth, (shake?.y || 0) * cellHeight);
        return;
      }
      const progress = Math.max(0, Math.min(1, (time - pop.startedAt) / pop.duration));
      const eased = progress * progress * (3 - 2 * progress);
      const bounce = progress < 0.72
        ? 0.62 + 0.56 * (1 - Math.pow(1 - progress / 0.72, 3))
        : 1.18 - 0.18 * Math.pow((progress - 0.72) / 0.28, 2);
      const pulse = Math.sin(progress * Math.PI * 8) * (1 - progress);
      const cellX = column * cellWidth + cellWidth / 2;
      const cellY = row * cellHeight + cellHeight / 2;
      context.save();
      context.globalAlpha = (1 - eased) * 0.78;
      context.strokeStyle = "#fff5a6";
      context.lineWidth = Math.max(3, cellWidth * 0.045);
      context.beginPath();
      context.arc(cellX, cellY, Math.min(cellWidth, cellHeight) * (0.18 + eased * 0.34), 0, Math.PI * 2);
      context.stroke();
      context.restore();
      drawSlotSymbol(column, row, symbol, 0, 0, {
        scale: bounce,
        rotation: pulse * 0.12,
        glow: 30 * (1 - eased) + 8,
      });
    });
    if (motionFrame) {
      paintSlotLines(context, motionFrame.lines, (target, column, row, symbol, x, y) => {
        drawSlotSymbol(column, row, symbol, x, y, {}, target);
      });
    }

    if (slotWinCelebration) {
      paintSlotWin(context, slotWinCelebration.animation, time, drawSlotSymbol);
    }

    context.save();
    context.strokeStyle = "rgba(255, 242, 155, 0.62)";
    context.lineWidth = 3;
    context.beginPath();
    for (let column = 1; column < 5; column += 1) {
      context.moveTo(column * cellWidth, 0);
      context.lineTo(column * cellWidth, slotReelCanvas.height);
    }
    for (let row = 1; row < 3; row += 1) {
      context.moveTo(0, row * cellHeight);
      context.lineTo(slotReelCanvas.width, row * cellHeight);
    }
    if (slotHoverLine && !slotReelMotion && !slotWinCelebration && currentView.kind === "slot") {
      context.fillStyle = "rgba(255, 242, 155, 0.3)";
      if (slotHoverLine.axis === "row") context.fillRect(0, slotHoverLine.index * cellHeight, slotReelCanvas.width, cellHeight);
      else context.fillRect(slotHoverLine.index * cellWidth, 0, cellWidth, slotReelCanvas.height);
    }
    context.stroke();
    context.restore();
    if (slotHoverCell >= 0 && !slotReelMotion && !slotWinCelebration && !playing && currentView.kind === "slot") {
      const column = slotHoverCell % 5;
      const row = Math.floor(slotHoverCell / 5);
      context.fillStyle = "rgba(56, 242, 255, 0.23)";
      context.fillRect(column * cellWidth, row * cellHeight, cellWidth, cellHeight);
      if (slotReelGrid[slotHoverCell] !== selectedSlotBerry) {
        const occupied = Boolean(slotReelGrid[slotHoverCell]);
        drawSlotSymbol(column, row, selectedSlotBerry, occupied ? cellWidth * .25 : 0, occupied ? cellHeight * .25 : 0,
          { alpha: occupied ? .9 : .68, scale: occupied ? .42 : .9, glow: 12 });
      }
    }
    slotReelTexture.needsUpdate = true;
  }

  function createSlotReelDisplay() {
    slotReelCanvas = document.createElement("canvas");
    slotReelCanvas.width = 1000;
    slotReelCanvas.height = 600;
    slotReelContext = slotReelCanvas.getContext("2d", { alpha: true });
    slotReelContext.imageSmoothingEnabled = false;

    slotReelTexture = new THREE.CanvasTexture(slotReelCanvas);
    slotReelTexture.colorSpace = THREE.SRGBColorSpace;
    slotReelTexture.magFilter = THREE.NearestFilter;
    slotReelTexture.minFilter = THREE.NearestFilter;
    slotReelTexture.generateMipmaps = false;

    const { left, right, top, bottom } = SLOT_DISPLAY_PIXELS;
    const points = [
      slotScreenPoint(left, top, 0.065),
      slotScreenPoint(left, bottom, 0.065),
      slotScreenPoint(right, top, 0.065),
      slotScreenPoint(right, bottom, 0.065),
    ];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(
      points.flatMap(({ x, y, z }) => [x, y, z]),
      3,
    ));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute([
      0, 1,
      0, 0,
      1, 1,
      1, 0,
    ], 2));
    geometry.setIndex([0, 1, 2, 1, 3, 2]);
    geometry.computeVertexNormals();

    const material = new THREE.MeshBasicMaterial({
      map: slotReelTexture,
      transparent: true,
      alphaTest: 0.01,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    slotReelDisplay = new THREE.Mesh(geometry, material);
    slotReelDisplay.name = "slot-reel-display";
    slotReelDisplay.renderOrder = 1;
    slotReelDisplay.frustumCulled = false;
    slotsModel.add(slotReelDisplay);

    for (const symbol of ["faroeberry", "erinberry", "kazberry", SLOT_REEL_WILDCARD]) {
      const image = new Image();
      image.decoding = "async";
      image.addEventListener("load", () => drawSlotReelDisplay());
      image.src = `${SLOT_SYMBOL_IMAGE_PATH}${symbol}.png`;
      slotReelImages.set(symbol, image);
    }
    drawSlotReelDisplay();
  }

  function slotWorldPoint(textureX, textureY, depth = 0.16) {
    const point = slotScreenPoint(textureX, textureY, depth);
    return slotsModel.localToWorld(new THREE.Vector3(point.x, point.y, point.z));
  }

  function createSlotPlacementControls() {
    if (!slotControlLayer || !slotsModel) return;
    slotRig.updateMatrixWorld(true);
    slotsModel.updateMatrixWorld(true);
    slotControlLayer.replaceChildren();
    slotPlacementControls = [];
    slotBerryPicker = document.createElement("div");
    slotBerryPicker.className = "rg-slot-overlay-picker";
    slotBerryPicker.setAttribute("role", "group");
    slotBerryPicker.setAttribute("aria-label", "Choose slot berry or wildcard");
    for (const [berry, label] of Object.entries({ kazberry: "Kazberry", faroeberry: "Faroeberry", erinberry: "Erinberry", star: "Star wildcard" })) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "rg-slot-sprite-blank";
      button.dataset.slotBerry = berry;
      button.dataset.foley = "off";
      button.setAttribute("aria-label", label);
      button.title = `${label}: left-click a cell to place; right-click to remove`;
      const img = document.createElement("img");
      img.src = SLOT_SYMBOL_IMAGE_PATH + berry + ".png";
      img.alt = "";
      img.draggable = false;
      button.append(img);
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        if (!playing && berry !== selectedSlotBerry) { foley.play("select"); window.dispatchEvent(new CustomEvent("rg:slot-settings-updated", { detail: { berry } })); }
      });
      slotBerryPicker.append(button);
    }
    slotControlLayer.append(slotBerryPicker);
    const { left, right, top, bottom } = SLOT_DISPLAY_PIXELS;
    const cellWidth = (right - left) / 5;
    const cellHeight = (bottom - top) / 3;
    const definitions = [
      ...Array.from({ length: 5 }, (_, index) => ({
        axis: "column",
        index,
        label: String(index + 1),
        x: left + (index + 0.5) * cellWidth,
        y: bottom + cellHeight * 0.5,
      })),
      ...Array.from({ length: 3 }, (_, index) => ({
        axis: "row",
        index,
        label: String.fromCharCode(65 + index),
        x: left - cellWidth * 0.5,
        y: top + (index + 0.5) * cellHeight,
      })),
    ];

    for (const definition of definitions) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "rg-slot-placement-marker";
      button.dataset.axis = definition.axis;
      button.dataset.foley = "off";
      button.dataset.index = String(definition.index);
      button.classList.add("rg-slot-sprite-" + definition.axis);
      button.setAttribute("aria-label", definition.axis + " " + definition.label);
      button.addEventListener("pointerenter", () => {
        if (selectedSlotBerry !== SLOT_REEL_WILDCARD) slotHoverLine = { axis: definition.axis, index: definition.index };
        drawSlotReelDisplay();
        hideGameCursor();
      });
      button.addEventListener("pointerleave", () => {
        if (slotHoverLine?.axis === definition.axis && slotHoverLine.index === definition.index) {
          slotHoverLine = null;
          drawSlotReelDisplay();
        }
      });
      button.addEventListener("focus", () => {
        if (selectedSlotBerry !== SLOT_REEL_WILDCARD) slotHoverLine = { axis: definition.axis, index: definition.index };
        drawSlotReelDisplay();
      });
      button.addEventListener("blur", () => {
        if (slotHoverLine?.axis === definition.axis && slotHoverLine.index === definition.index) {
          slotHoverLine = null;
          drawSlotReelDisplay();
        }
      });
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        placeSlotBerryOnLine(definition.axis, definition.index);
      });
      slotControlLayer.append(button);

      const anchor = slotWorldPoint(definition.x, definition.y);
      const worldWidth = slotWorldPoint(definition.x - cellWidth * 0.32, definition.y)
        .distanceTo(slotWorldPoint(definition.x + cellWidth * 0.32, definition.y));
      const worldHeight = slotWorldPoint(definition.x, definition.y - cellHeight * 0.27)
        .distanceTo(slotWorldPoint(definition.x, definition.y + cellHeight * 0.27));
      const adjacentX = definition.index === (definition.axis === "column" ? 4 : 0)
        ? definition.x - cellWidth
        : definition.x + cellWidth;
      const adjacentY = definition.index === (definition.axis === "row" ? 2 : 0)
        ? definition.y - cellHeight
        : definition.y + cellHeight;
      slotPlacementControls.push({
        ...definition,
        anchor,
        xSpacingAnchor: slotWorldPoint(adjacentX, definition.y),
        ySpacingAnchor: slotWorldPoint(definition.x, adjacentY),
        button,
        worldWidth,
        worldHeight,
      });
    }
    syncSlotPlacementControls();
  }

  function saveSlotGrid(grid, { requirePersistence = false } = {}) {
    const next = normalizeSlotGrid(grid);
    try { localStorage.setItem(SLOT_GRID_STORAGE_KEY, JSON.stringify(next)); }
    catch (error) {
      if (requirePersistence) throw error;
      console.warn("Ramble Gamble slot board could not be saved:", error);
    }
    slotReelGrid = next;
    window.dispatchEvent(new CustomEvent("rg:slot-grid-updated", { detail: { grid: slotReelGrid.slice() } }));
  }

  function startSlotAction(targetGrid, axis, indexes, { pullCrank = false, kind = "spin" } = {}) {
    if (playing || slotReelMotion || stageShow?.busy || document.documentElement.hasAttribute("data-rg-host-locked")) return false;
    const startedAt = performance.now();
    const startingGrid = slotReelGrid.slice();
    const settledGrid = normalizeSlotGrid(targetGrid);
    const motionOptions = {
      targetGrid: settledGrid,
      startedAt,
      duration: reducedMotion.matches ? 520 : 1950,
      stagger: reducedMotion.matches ? 55 : 120,
      reducedMotion: reducedMotion.matches,
      previousSpinRows: lastSlotTravelRows,
      previousSpinColumns: lastSlotTravelColumns,
      preserveUnchanged: kind === "place-row" || kind === "place-column",
    };
    slotReelMotion = createSlotLineMotion(startingGrid, { axis, indexes }, motionOptions);
    if (!slotReelMotion) return false;
    for (const column of slotReelMotion.columns) lastSlotTravelRows[column.column] = column.travelRows;
    for (const row of slotReelMotion.rows || []) lastSlotTravelColumns[row.row] = row.travelColumns;
    slotReelMotion.action = kind;
    slotReelMotion.soundedStops = new Set();
    foley.play(pullCrank ? "lever" : "switch");
    if (slotCabinetFX) slotCabinetFX.begin(startedAt, pullCrank ? "crank" : "press", { active: canShowCabinetFX(), reduced: reducedMotion.matches });
    else foley.start("slots", "reel", { loop: true });
    playing = true;
    preview.classList.add("is-playing");
    syncSlotPlacementControls();
    hideResult();
    if (pullCrank && lever) {
      leverMotion = {
        started: startedAt,
        duration: reducedMotion.matches ? 360 : 760,
        baseQuaternion: lever.quaternion.clone(),
      };
    }
    window.dispatchEvent(new CustomEvent("rg:slot-action-start", { detail: { kind } }));
    drawSlotReelDisplay(startedAt);
    return true;
  }

  function placeSlotBerryOnLine(axis, lineIndex) {
    if (playing || slotReelMotion || selectedSlotBerry === SLOT_REEL_WILDCARD || !["row", "column"].includes(axis)) return false;
    const placement = placeSlotBerry(slotReelGrid, selectedSlotBerry, {
      axis,
      index: lineIndex,
      randomIndex: secureRandomIndex,
    });
    if (placement.placedIndex < 0) {
      window.dispatchEvent(new CustomEvent("rg:slot-action-finish", { detail: { reason: "no-eligible-cell", totals: {} } }));
      return false;
    }
    return startSlotAction(placement.grid, axis, [lineIndex], { kind: "place-" + axis });
  }

  function placeSelectedSlotSymbolAtCell(index) {
    if (playing || slotReelMotion || slotCellPop || stageShow?.busy || currentView.kind !== "slot" || document.documentElement.hasAttribute("data-rg-host-locked")) return false;
    const placement = placeSlotSymbolAtCell(slotReelGrid, selectedSlotBerry, index);
    if (placement.placedIndex < 0) return false;
    const startedAt = performance.now();
    const kind = selectedSlotBerry === SLOT_REEL_WILDCARD ? "wildcard-place" : "cell-place";
    slotCellPop = {
      index: placement.placedIndex,
      startedAt,
      duration: reducedMotion.matches ? 1 : 620,
      motion: { targetGrid: placement.grid, action: kind, baseGrid: slotReelGrid.slice() },
    };
    playing = true;
    preview.classList.add("is-playing");
    hideResult();
    syncSlotPlacementControls();
    foley.play(selectedSlotBerry === SLOT_REEL_WILDCARD ? "wildcard" : "select");
    slotCabinetFX?.begin(startedAt, "tap", { active: canShowCabinetFX(), reduced: reducedMotion.matches });
    window.dispatchEvent(new CustomEvent("rg:slot-action-start", { detail: { kind } }));
    drawSlotReelDisplay(startedAt);
    return true;
  }

  function syncSlotPlacementControls() {
    if (!slotPlacementControls.length) return;
    const grid = slotReelGrid;
    const berryNames = { faroeberry: "Faroeberry", erinberry: "Erinberry", kazberry: "Kazberry", star: "Star wildcard" };
    const wildcardMode = selectedSlotBerry === SLOT_REEL_WILDCARD;
    slotControlLayer.classList.toggle("is-wildcard-mode", wildcardMode);
    for (const button of slotBerryPicker?.children || []) {
      button.setAttribute("aria-pressed", String(button.dataset.slotBerry === selectedSlotBerry));
      button.disabled = playing;
    }
    for (const control of slotPlacementControls) {
      const available = wildcardMode ? 0 : getSlotEligibleIndexes(grid, selectedSlotBerry, {
        axis: control.axis,
        index: control.index,
      }).length;
      const lineName = control.axis === "column" ? "column " + (control.index + 1) : "row " + control.label;
      control.button.disabled = Boolean(playing || slotReelMotion || wildcardMode || available === 0);
      control.button.setAttribute("aria-label", wildcardMode
        ? "Left-click a slot cell to place a star; right-click to remove its icon"
        : "Place " + berryNames[selectedSlotBerry] + " in a random available cell in " + lineName + "; " + available + " available");
      control.button.title = wildcardMode
        ? "Star selected - left-click to place; right-click to remove"
        : "Place " + berryNames[selectedSlotBerry] + " in " + lineName + " (" + available + " available)";
      control.button.classList.toggle("is-unavailable", available === 0);
    }
  }

  function startSlotReelSpin(columns, pullCrank = false) {
    const startingGrid = slotReelGrid.slice();
    const spin = rotateSlotColumns(startingGrid, columns, { randomIndex: secureRandomIndex });
    return startSlotAction(spin.grid, "column", Object.keys(spin.rotations).map(Number), {
      pullCrank,
      kind: pullCrank ? "spin-all" : "spin-column",
    });
  }

  function spinSlotColumn(column) {
    return startSlotReelSpin([column]);
  }

  function completeSlotPresentation(motion, outcome, showResult = true) {
    // Presentation cleanup never writes scores or re-clears the board.
    slotWinCelebration = null;
    playing = false;
    preview.classList.remove("is-playing");
    drawSlotReelDisplay();
    syncSlotPlacementControls();
    if (showResult) showSlotPayout(outcome.totals);
    window.dispatchEvent(new CustomEvent("rg:slot-action-finish", {
      detail: {
        kind: motion.action,
        payouts: outcome.payouts,
        totals: outcome.totals,
        clearedCells: outcome.clearedCells,
        grid: slotReelGrid.slice(),
      },
    }));
  }

  function endSlotCelebration(showResult = true) {
    const celebration = slotWinCelebration;
    if (!celebration) return;
    completeSlotPresentation(celebration.motion, celebration.outcome, showResult);
  }

  function canShowSlotCelebration() {
    return gameStarted && !pauseMenuOpen && !diceModeOpen && !document.hidden
      && !document.documentElement.hasAttribute("data-rg-host-locked");
  }

  function canShowCabinetFX() {
    return canShowSlotCelebration() && sceneReady && currentView.kind === "slot"
      && !cameraDetached && !freecam?.active && !cameraTransition && !stageShow?.busy && slotsModel?.visible;
  }

  async function finishSlotAction(motion, time = performance.now()) {
    slotCabinetFX?.stopRolling();
    foley.stop("slots");
    const outcome = resolveSlotPayouts(motion.targetGrid);
    const hasPayout = Object.values(outcome.totals).some(amount => amount > 0);
    const checkManualBoard = () => {
      if (!motion.baseGrid) return;
      const latest = normalizeSlotGrid(localStorage.getItem(SLOT_GRID_STORAGE_KEY));
      if (latest.some((symbol, index) => symbol !== motion.baseGrid[index])) {
        slotReelGrid = latest;
        throw Error("Slot board changed; placement cancelled. Try again.");
      }
    };
    try {
      if (hasPayout) {
        await withPointScoresLock(() => {
          checkManualBoard();
          const prior = readPointScores({ strict: true });
          const scores = { ...prior };
          for (const [name, amount] of Object.entries(outcome.totals)) {
            if (amount > 0) {
              if (!Number.isSafeInteger(scores[name] + amount)) throw Error("Point total would exceed the safe integer limit; slot award cancelled.");
              scores[name] += amount;
            }
          }
          if (!writePointScores(scores).persisted) throw Error("Could not save points; slot award cancelled.");
          try { saveSlotGrid(outcome.grid, { requirePersistence: true }); }
          catch (error) {
            if (!writePointScores(prior).persisted) throw Error("Slot board could not be saved or points refunded; check the console before continuing.");
            throw Error("Could not save slot board; points restored.", { cause: error });
          }
        });
      } else {
        checkManualBoard();
        saveSlotGrid(outcome.grid, { requirePersistence: Boolean(motion.baseGrid) });
      }
    } catch (error) {
      slotCabinetFX?.reset();
      playing = false;
      preview.classList.remove("is-playing");
      drawSlotReelDisplay();
      syncSlotPlacementControls();
      result.textContent = error.message;
      result.hidden = false;
      console.error("Ramble Gamble slot payout failed:", error);
      window.dispatchEvent(new CustomEvent("rg:slot-action-finish", { detail: { kind: motion.action, reason: "save-failed", message: error.message, totals: {}, grid: slotReelGrid.slice() } }));
      return;
    }
    // Score and board are committed before any presentation. Start the FX at
    // the actual completion time, not the frame before waiting for the lock.
    const visible = canShowSlotCelebration();
    time = performance.now();
    slotCabinetFX?.result(time, hasPayout, { active: canShowCabinetFX(), reduced: reducedMotion.matches, wasRolling: !motion.baseGrid });
    const animation = visible ? createSlotWinAnimation(motion.targetGrid, outcome, time, reducedMotion.matches) : null;
    if (animation) slotWinCelebration = { animation, motion, outcome };
    if (outcome.payouts.length && visible) {
      foley.play("payout");
      if (outcome.payouts.some(payout => payout.points >= 50000)) foley.play("jackpot");
    }
    if (!animation) completeSlotPresentation(motion, outcome, visible);
    else drawSlotReelDisplay(time);
  }

  applyTheme();

  function createWorld() {
    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2();
    cameraTarget = new THREE.Vector3();
    scene = new THREE.Scene();
    scene.background = new THREE.Color(SKY_CONFIG.topColor);

    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 320);
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true, // Only the depth-tested compatibility plane writes transparent pixels.
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = false;

    createSkybox();
    try { floatingSky = createFloatingSky({ THREE, scene }); }
    catch (error) { scene.getObjectByName("rg-floating-video-sky")?.removeFromParent(); console.warn("Floating sky unavailable", error); }

    rouletteRig = new THREE.Group();
    rouletteRig.visible = !pauseMenuOpen;
    scene.add(rouletteRig);

    slotRig = new THREE.Group();
    slotRig.visible = !pauseMenuOpen;
    slotRig.rotation.y = Math.PI;
    scene.add(slotRig);

    resizeObserver = new ResizeObserver(fitCamera);
    resizeObserver.observe(preview);
    window.addEventListener("resize", fitCamera, { passive: true });
    fitCamera();
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
    const width = 40;
    const height = 8;
    const pixels = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const headX = width - 7;
        const headDistance = ((x - headX) / 4.1) ** 2 + ((y - 3.5) / 2.5) ** 2;
        let alpha = headDistance <= 1 ? 255 : 0;
        const tailStrength = x / headX;
        if ((y === 3 || y === 4) && x < headX) {
          alpha = Math.max(alpha, Math.round(175 * (0.12 + 0.88 * tailStrength)));
        } else if (x < headX && (y === 2 || y === 5) && (x * 3 + y * 5) % 9 === 0) {
          alpha = Math.max(alpha, Math.round(112 * (0.12 + 0.88 * tailStrength)));
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
    const count = 4;
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
      duration: 3000,
      // Defer scheduling until the sky is actually animating; the READY screen
      // can remain open for an arbitrary time before the pause menu starts.
      nextAt: 0,
      active: false,
      angle: 0,
      length: 88,
      thickness: 8,
      tint: new THREE.Color(["#fff0de", "#e9e2ff", "#dce8ff"][index % 3]),
    }));
  }

  function initializeSkyStars() {
    if (skyStarsInitialized || !camera || !skyStars) return;
    for (const star of skyStars) {
      // Uniformly distribute directions over the whole dome, rather than
      // placing stars in a camera-relative strip above the view center.
      const vertical = nextSkyRandom() * 2 - 1;
      const azimuth = nextSkyRandom() * Math.PI * 2;
      const horizontal = Math.sqrt(1 - vertical * vertical);
      star.direction = new THREE.Vector3(
        Math.cos(azimuth) * horizontal,
        vertical,
        Math.sin(azimuth) * horizontal,
      );
    }
    skyStarsInitialized = true;
  }

  function makeShootingStarPath() {
    camera.updateMatrixWorld(true);
    const forward = camera.getWorldDirection(new THREE.Vector3());
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    const viewUp = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    const horizontalRange = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    const verticalRange = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const horizontalStart = (nextSkyRandom() * 2 - 1) * horizontalRange * 0.76;
    const verticalStart = (nextSkyRandom() * 2 - 1) * verticalRange * 0.72;
    const start = forward
      .addScaledVector(right, horizontalStart)
      .addScaledVector(viewUp, verticalStart)
      .normalize();
    const travelDirection = nextSkyRandom() < 0.5 ? -1 : 1;
    const horizontalTravel = travelDirection * (0.15 + nextSkyRandom() * 0.22);
    const verticalTravel = (nextSkyRandom() < 0.72 ? -1 : 1) * (0.035 + nextSkyRandom() * 0.13);
    const end = start.clone()
      .addScaledVector(right, horizontalTravel)
      .addScaledVector(viewUp, verticalTravel)
      .normalize();
    return {
      start: start.multiplyScalar(SKY_CONFIG.radius - 2),
      end: end.multiplyScalar(SKY_CONFIG.radius - 2),
      angle: Math.atan2(verticalTravel, horizontalTravel),
      length: 78 + nextSkyRandom() * 72,
      thickness: 7 + nextSkyRandom() * 4,
      tint: new THREE.Color(["#fff0dc", "#e9e1ff", "#dae5ff"][Math.floor(nextSkyRandom() * 3)]),
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

      if (!star.active && star.nextAt === 0) {
        star.nextAt = time + 1400 + star.index * 2300 + nextSkyRandom() * 1000;
      }

      if (!star.active && time >= star.nextAt) {
        const path = makeShootingStarPath();
        star.start = path.start;
        star.end = path.end;
        star.angle = path.angle;
        star.length = path.length;
        star.thickness = path.thickness;
        star.tint = path.tint;
        star.startedAt = time;
        star.duration = 2600 + nextSkyRandom() * 1500;
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
      // Start with a quick dart, then ease into a softer disappearing tail.
      const eased = 1 - (1 - progress) ** 2.1;
      position.lerpVectors(star.start, star.end, eased);
      roll.setFromAxisAngle(worldZ, star.angle);
      rotation.copy(pixelQuaternion).multiply(roll);
      const fadeIn = Math.min(1, progress / 0.08);
      const fadeOut = 1 - Math.max(0, (progress - 0.64) / 0.36);
      const glint = 0.92 + 0.08 * Math.sin(progress * Math.PI * 5);
      const fade = fadeIn * fadeOut * glint * 0.9;
      scale.set(star.length * worldPerPixel, star.thickness * worldPerPixel, 1);
      matrix.compose(position, rotation, scale);
      skyShootingStarsMesh.setMatrixAt(star.index, matrix);
      skyShootingStarsMesh.setColorAt(star.index, color.copy(star.tint).multiplyScalar(fade));
      if (progress >= 1) {
        star.active = false;
        star.nextAt = time + 14000 + nextSkyRandom() * 14000;
      }
    }
    skyShootingStarsMesh.instanceMatrix.needsUpdate = true;
    if (skyShootingStarsMesh.instanceColor) skyShootingStarsMesh.instanceColor.needsUpdate = true;
  }

  let lastHorrorScaleMode = null;
  function syncHorrorRenderScale(width=preview.clientWidth,height=preview.clientHeight) {
    if(!renderer)return;
    lastHorrorScaleMode=preview.classList.contains("is-smeemo-cinema");
    const ratio=horrorRenderScale(width,height,window.devicePixelRatio||1,lastHorrorScaleMode);
    if(renderer.getPixelRatio()!==ratio)renderer.setPixelRatio(ratio);
  }

  function fitCamera() {
    if (!camera || !renderer) return;
    const width = Math.max(1, preview.clientWidth);
    const height = Math.max(1, preview.clientHeight);
    const aspect = width / height;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    syncHorrorRenderScale(width,height);
    renderer.setSize(width, height, false);
    if (!sceneReady || freecam?.active || cameraDetached) return;

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
    if (view.kind === "smeemo-crowd") {
      const pose=crowdCloseupPose(crowdCatAnchor(),aspect,camera.fov);
      return {target:new THREE.Vector3().copy(pose.target),position:new THREE.Vector3().copy(pose.position)};
    }
    if (view.kind === "hazel") {
      const [yawCap,pitchCap]=focusLimits(view.kind);
      const frame=hazelCameraFrame(hazelBillboard ?? hazelBalconyPose(),aspect,camera.fov,camera.near,yawCap,pitchCap);
      return {target:new THREE.Vector3().copy(frame.target),position:new THREE.Vector3().copy(frame.position)};
    }
    if (view.kind === "trivia") {
      // The actual uninterrupted back-wall panels run x=4.51..9.14, z=-6.16.
      // Face the central panel squarely, above the nearby raised-floor lip.
      const target = new THREE.Vector3(7.15, 1.57, -6.10);
      const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const distance = Math.max(1.45 / tan, 1.9 / (tan * Math.max(.5, aspect)));
      return {target,position:target.clone().add(new THREE.Vector3(0,0,distance))};
    }
    const character = view.kind === "host" ? hostBillboard : view.kind === "contestant"
      ? contestants.find(entry => entry.id === view.contestantId) : null;
    if (character) {
      const target = character.anchor.clone();
      const elevation = .12, yaw = REFERENCE_START_VIEW.yaw;
      const horizontal = Math.sqrt(1-elevation*elevation);
      const direction = new THREE.Vector3(Math.sin(yaw)*horizontal, elevation, Math.cos(yaw)*horizontal);
      const distance = fitCharacterCloseup({worldWidth: character.worldWidth, worldHeight: character.worldHeight,
        aspect, fov: camera.fov, near: camera.near, elevation, pitchCap: focusLimits(view.kind)[1],
        relativeYaw: Math.max(...[-1,1].map(sign => {
          const eyeYaw = yaw + sign * focusLimits(view.kind)[0];
          return Math.abs(eyeYaw-characterYaw(Math.sin(eyeYaw),Math.cos(eyeYaw)));
        }))});
      return {target, position: target.clone().addScaledVector(direction, distance)};
    }
    const bounds = view.kind === "slot" && slotFocusPoints.length
      ? new THREE.Box3().setFromPoints(slotFocusPoints)
      : getViewBounds(view);
    if (bounds.isEmpty()) return null;
    const target = bounds.getCenter(new THREE.Vector3());
    // The Dice entrance is on the room's right-hand wall, so approach it from
    // inside the room along the X axis instead of aiming at the rear wall.
    const yaw = (view.kind === "dice-door" ? -Math.PI / 2 : view.kind === "slot" ? -0.08 : REFERENCE_START_VIEW.yaw) - view.look * 0.42;
    // The roulette interaction is best inspected from above, like looking down
    // at a real table. Keep the room and every other close-up at the authored angle.
    // Preserve the reference's elevated oblique view instead of a near-vertical map view.
    const elevation = view.kind === "roulette" ? 0.86 : view.kind === "card-table" ? 0.72 : view.kind === "slot" ? 0.14 : REFERENCE_START_VIEW.elevation;
    const horizontal = Math.sqrt(1 - elevation * elevation);
    const direction = new THREE.Vector3(
      Math.sin(yaw) * horizontal,
      elevation,
      Math.cos(yaw) * horizontal,
    ).normalize();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(worldUp, direction).normalize();
    const viewUp = new THREE.Vector3().crossVectors(direction, right).normalize();
    if (view.kind === "slot" && slotFocusPoints.length) {
      const points = slotFocusPoints.map(point => {
        const relative = point.clone().sub(target);
        return { x: relative.dot(right), y: relative.dot(viewUp), z: relative.dot(direction) };
      });
      const height = Math.max(1, preview.clientHeight);
      const frame = fitSlotInteractionFrame(points, { width: height * aspect, height, fov: camera.fov, near: camera.near, cabinetMotion: Boolean(slotCabinetFX) });
      target.addScaledVector(right, frame.shiftX).addScaledVector(viewUp, frame.shiftY);
      return { target, position: target.clone().addScaledVector(direction, frame.distance) };
    }
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

    const overviewDistanceScale = view.kind === "overview"
      ? THREE.MathUtils.lerp(
        REFERENCE_START_VIEW.narrowDistanceScale,
        REFERENCE_START_VIEW.wideDistanceScale,
        wideComposition,
      )
      : 1;
    distance = Math.max(distance, 1)
      * (view.kind === "overview" ? 1.14 : view.kind === "card-table" ? 1.12 : view.kind === "roulette" ? 1.06 : 1.18)
      * overviewDistanceScale;
    return { target, position: target.clone().addScaledVector(direction, distance) };
  }

  function captureSlotFocusPoints() {
    const { left, right, top, bottom } = SLOT_DISPLAY_PIXELS;
    const points = [slotWorldPoint(left, top), slotWorldPoint(left, bottom),
      slotWorldPoint(right, top), slotWorldPoint(right, bottom)];
    // Include the full arrow footprints, not merely their centers.
    for (const control of slotPlacementControls) {
      const half = Math.max(control.worldWidth, control.worldHeight) * .6;
      for (const x of [-half, half]) for (const y of [-half, half]) for (const z of [-half, half]) {
        points.push(control.anchor.clone().add(new THREE.Vector3(x, y, z)));
      }
    }
    // Keep the physical spin buttons and resting crank reachable. Cache once:
    // a resize during a pull must not cause the camera to chase the moving arm.
    slotSpinButtonCorners = [];
    for (const [part, object] of slotControlTargets) {
      const corners = [];
      const box = new THREE.Box3().setFromObject(object);
      if (box.isEmpty()) continue;
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        corners.push(new THREE.Vector3(x, y, z));
      }
      points.push(...corners);
      if (/^button[1-5]$/.test(part)) slotSpinButtonCorners[Number(part.slice(-1)) - 1] = corners;
    }
    slotFocusPoints = points;
  }

  function getViewBounds(view) {
    const bounds = new THREE.Box3().makeEmpty();
    scene?.updateMatrixWorld(true);

    if (view.kind === "overview") return getArcadeBounds();
    if (view.kind === "dice-door") {
      const opening = ARCADE_REFERENCE_LAYOUT.diceDoor;
      const interactionX = opening.wallX - opening.interactionOffset;
      bounds.set(
        new THREE.Vector3(interactionX, opening.minY, opening.minZ),
        new THREE.Vector3(interactionX, opening.maxY, opening.maxZ),
      );
      return bounds.expandByScalar(0.18);
    }
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
      if(rouletteCabinetFX)bounds.copy(rouletteCabinetFX.framing);
      else bounds.setFromObject(rouletteRig);
      // A stable envelope includes the wheel's airborne poses.
      return bounds.expandByScalar(0.06);
    }
    if (view.kind === "card-table" && cardTableModel) {
      bounds.setFromObject(cardTableModel);
      bounds.min.y = Math.max(bounds.min.y, bounds.max.y - 0.14);
      return bounds.expandByScalar(0.04);
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
    const halfDepth = halfWidth * Math.sin(CHARACTER_YAW_LIMIT);
    bounds.expandByPoint(new THREE.Vector3(x - halfWidth, y - halfHeight, z - halfDepth));
    bounds.expandByPoint(new THREE.Vector3(x + halfWidth, y + halfHeight, z + halfDepth));
  }

  function applyCameraPose(pose) {
    focusBase = pose.position.clone();
    camera.position.copy(pose.position);
    cameraTarget.copy(pose.target);
    camera.lookAt(cameraTarget);
    camera.updateMatrixWorld(true);
  }

  function transitionToView(nextView, { immediate = false, encounterReturn = false } = {}) {
    hideGameCursor(); lastScenePointer = null;
    const fromExterior = cameraDetached || !!freecam?.active || !!cameraTransition?.fromExterior;
    freecam?.stop();
    if(!encounterReturn&&((nextView.kind!=="smeemo-crowd"&&(nextView.kind!=="card-table"||encounter.phase!=="table"))||(nextView.kind==="smeemo-crowd"&&encounter.phase!=="focused")))resetEncounter();
    if(nextView.kind==="smeemo-crowd"&&encounter.phase==="hidden"){
      encounter.focus();smeemoCount.textContent="0/5";preview.dataset.smeemoStep="0";stageShow?.silent(crowdCatAnchor(),performance.now());
    }
    // Keep the whole Smeemo-to-table camera journey unlit; the table spotlight
    // is deliberately re-armed only after updateSmeemoEncounter sees arrival.
    if(encounterReturn)stageShow?.clearLight();
    if (nextView.kind !== "roulette") {foley.stop("roulette-rattle"); stopRouletteSettlement(); rouletteCabinetFX?.reset(); showFX?.clearRoulette();}
    const viewChanged=currentView.kind!==nextView.kind||currentView.contestantId!==nextView.contestantId;
    if(stageShow?.busy&&!viewChanged&&nextView.kind==="slot"&&!immediate)return;
    if (selectedCharacterId(nextView) && (viewChanged || cameraDetached) && !immediate) characterSelectedAt=performance.now();
    else if (!selectedCharacterId(nextView) || immediate) characterSelectedAt=-Infinity;
    cameraDetached = false;
    preview.classList.remove("is-freecam-detached");
    if (nextView.kind !== "slot") slotCabinetFX?.reset();
    const openingSlot=currentView.kind!=="slot"&&nextView.kind==="slot";
    const closingSlot=currentView.kind==="slot"&&nextView.kind!=="slot";
    if(stageShow&&viewChanged){
      const now=performance.now();
      if(immediate)stageShow.reset(nextView.kind==="slot");
      else if(openingSlot||closingSlot)stageShow.slot(openingSlot,now);
      else if(stageShow.manual&&nextView.kind!=="smeemo-crowd")stageShow.dismiss(now);
    }
    if(viewChanged&&!immediate&&sceneReady){preview.dataset.showArrival=nextView.kind;preview.classList.remove("rg-show-arrival");void preview.offsetWidth;preview.classList.add("rg-show-arrival");if(nextView.kind==="overview"&&!closingSlot)reactCrowd("idle");}
    if (!immediate && sceneReady && (currentView.kind !== nextView.kind || currentView.look !== (nextView.look ?? 0) || currentView.contestantId !== nextView.contestantId)) foley.play(nextView.kind === "overview" ? "back" : "navigate");
    currentView = { ...nextView, look: nextView.kind === "overview" ? nextView.look ?? 0 : 0 };
    focusOrbit.reset(currentView.kind);
    focusDrag?.reset();
    const pose = getCameraPoseForView(currentView, camera.aspect);
    if (!pose) { syncMusic(); return; }

    if (immediate || reducedMotion.matches || !sceneReady) {
      cameraTransition = null;
      applyCameraPose(pose);
      syncMusic();
      return;
    }

    cameraTransition = {
      fromExterior,
      started: performance.now(),
      duration: encounterReturn ? SMEEMO_RETURN_MS : cameraTravelDuration(nextView.kind, stageShow&&(openingSlot||closingSlot) ? (openingSlot?REVEAL_MS:RETRACT_MS) : 0),
      spooky: encounterReturn || isSpookyView(nextView.kind),
      theatre: Boolean(stageShow&&(openingSlot||closingSlot)),
      fromPosition: camera.position.clone(),
      fromTarget: cameraTarget.clone(),
      toPosition: pose.position,
      toTarget: pose.target,
    };
    syncMusic();
  }

  function setLookDirection(look) {
    if (cameraDetached) { transitionToView({kind:"overview",look}); return; }
    if (currentView.kind !== "overview") { focusDrag?.stopFollowing(); focusOrbit.nudge(-look * .012, 0); return; }
    if (currentView.look === look) return;
    transitionToView({ ...currentView, look });
  }

  function canGoBack() {
    return cameraDetached || Boolean(resolvePointClickBack(currentView));
  }

  function goBack() {
    const destination = cameraDetached ? {kind:"overview",look:0} : resolvePointClickBack(currentView);
    if (destination) transitionToView(destination);
  }

  function getArcadeBounds() {
    if (overviewCameraBounds) return overviewCameraBounds.clone();
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

    // Use the actual recessed stage edge, independent of viewport or camera.
    // The outer/lower lip is closer to the wheel than the upper deck edge.
    rouletteRig.position.set(0, 0, 0);
    rouletteModel.scale.setScalar(ARCADE_REFERENCE_LAYOUT.rouletteScale);
    rouletteModel.position.set(0, 0, 0);
    rouletteRig.updateMatrixWorld(true);
    rouletteModel.updateMatrixWorld(true);
    const rouletteLocalBounds = new THREE.Box3().setFromObject(rouletteModel);
    const rouletteLocalCenter = rouletteLocalBounds.getCenter(new THREE.Vector3());
    const rouletteBoundsSize = rouletteLocalBounds.getSize(new THREE.Vector3());
    const radius = Math.max(rouletteBoundsSize.x, rouletteBoundsSize.z) / 2;
    const recess = rouletteRecessCenter(radius);
    rouletteRig.position.set(
      recess.x - rouletteLocalCenter.x,
      EXTERIOR_FLOOR.y - rouletteLocalBounds.min.y,
      recess.z - rouletteLocalCenter.z,
    );
    rouletteRig.updateMatrixWorld(true);
    const rouletteBounds = new THREE.Box3().setFromObject(rouletteModel);
    if (rouletteBounds.min.z < ROULETTE_RECESS.frontZ + ROULETTE_RECESS.clearance - 0.001) {
      throw new Error("The roulette footprint overlaps the recessed stage lip.");
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
      object.castShadow = false;
      object.receiveShadow = false;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (material?.map) {
          material.map.colorSpace = THREE.SRGBColorSpace;
          material.map.magFilter = THREE.NearestFilter;
          material.map.minFilter = THREE.NearestMipmapLinearFilter;
          material.map.generateMipmaps = true;
          material.map.needsUpdate = true;
        }
      }
      object.material = Array.isArray(object.material)
        ? materials.map(toUnlitMaterial)
        : toUnlitMaterial(materials[0]);
    });
  }

  function carveDiceDoorway(root) {
    scene.updateMatrixWorld(true);
    let removedTriangles = 0;

    root.traverse((object) => {
      if (!object.isMesh || !object.geometry?.index) return;
      const geometry = object.geometry;
      const position = geometry.getAttribute("position");
      const index = geometry.index;
      if (!position || index.count < 3) return;

      const keptIndices = [];
      let removedHere = 0;
      for (let offset = 0; offset + 2 < index.count; offset += 3) {
        const points = [0, 1, 2].map((corner) =>
          new THREE.Vector3()
            .fromBufferAttribute(position, index.getX(offset + corner))
            .applyMatrix4(object.matrixWorld)
        );
        if (isDiceDoorBackingTriangle(points, ARCADE_REFERENCE_LAYOUT.diceDoor)) {
          removedHere += 1;
          continue;
        }
        keptIndices.push(index.getX(offset), index.getX(offset + 1), index.getX(offset + 2));
      }

      if (removedHere) {
        geometry.setIndex(keptIndices);
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        object.userData.diceDoorBackingTrianglesRemoved = removedHere;
        removedTriangles += removedHere;
      }
    });

    root.userData.diceDoorBackingTrianglesRemoved = removedTriangles;
    if (removedTriangles !== 2) {
      console.warn(`Expected to open the two backing triangles inside the right-wall dice doorway, removed ${removedTriangles}.`);
    }
    return removedTriangles;
  }

  function toUnlitMaterial(material) {
    if (!material) return material;
    const cached = unlitMaterialCache.get(material);
    if (cached) return cached;

    // Keep the authored base-color texture and alpha behavior, but remove all
    // lighting-dependent maps and physically based response from the models.
    const unlit = new THREE.MeshBasicMaterial({
      name: material.name,
      color: material.color,
      map: material.map,
      alphaMap: material.alphaMap,
      alphaTest: material.alphaTest,
      opacity: material.opacity,
      transparent: material.transparent,
      side: material.side,
      vertexColors: material.vertexColors,
      depthTest: material.depthTest,
      depthWrite: material.depthWrite,
      blending: material.blending,
      fog: false,
    });
    unlit.toneMapped = false;
    unlit.userData = { ...material.userData };
    unlitMaterialCache.set(material, unlit);
    material.dispose();
    return unlit;
  }

  function setupPicking() {
    rouletteTargets = [];
    slotTargets = [];
    slotControlTargets = new Map();
    cardTableTargets = [];
    diceDoorTargets = [];
    contestantTargets = [];
    hostTargets = [];
    contestants = [];
    hostBillboard = null;
    hazelBillboard = null;
    billboards = [];
    billboardLayer?.replaceChildren();
    rouletteModel?.traverse((object) => {
      if (object.isMesh) rouletteTargets.push(object);
    });
    slotsModel?.traverse((object) => {
      if (object.isMesh) slotTargets.push(object);
      const name = String(object.name || "").toLowerCase();
      if (name === "arm" || /^button[1-5]$/.test(name)) slotControlTargets.set(name, object);
    });
    cardTableModel = stageModel?.getObjectByName("table") || null;
    cardTableModel?.traverse((object) => {
      if (object.isMesh) cardTableTargets.push(object);
    });
    setupDiceDoorTarget();
    setupContestants();
  }

  function setupDiceDoorTarget() {
    const opening = ARCADE_REFERENCE_LAYOUT.diceDoor;
    const target = new THREE.Mesh(
      new THREE.PlaneGeometry(opening.maxZ - opening.minZ, opening.maxY - opening.minY),
      new THREE.MeshBasicMaterial({
        colorWrite: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    target.name = "point-click-dice-door";
    target.rotation.y = Math.PI / 2;
    target.position.set(
      opening.wallX - opening.interactionOffset,
      (opening.minY + opening.maxY) / 2,
      (opening.minZ + opening.maxZ) / 2,
    );
    target.userData.machine = "dice-door";
    target.frustumCulled = false;
    scene.add(target);
    diceDoorTargets.push(target);
  }

  function createBillboardPanel(source, kind) {
    const panel = document.createElement("div");
    panel.className = source.source ? "rg-billboard rg-billboard-live" : "rg-billboard";
    panel.dataset[kind] = source.id;
    panel.style.width = panel.style.height = `${CHARACTER_SOURCE_SIZE}px`;
    panel.style.visibility = "hidden";
    panel.setAttribute("aria-label", `${source.label} browser-source billboard`);

    if (source.source) {
      const iframe = document.createElement("iframe");
      iframe.src = source.source;
      iframe.title = `${source.label} live browser source`;
      iframe.loading = "eager";
      iframe.width = iframe.height = String(CHARACTER_SOURCE_SIZE);
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

    const mask = document.createElement("div");
    mask.className = "rg-character-visibility";
    mask.append(panel);
    billboardLayer.append(mask);
    return panel;
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

      const pose = standingCharacterPose(chairBounds);
      const { worldWidth, worldHeight } = pose;
      const anchor = new THREE.Vector3(pose.anchor.x, pose.anchor.y, pose.anchor.z);
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
    setupHazelBillboard();
    billboardLayer.setAttribute(
      "aria-label",
      `Host, contestant and balcony guest browser-source billboards, ${billboards.length} screens`,
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

    const pose = standingCharacterPose(highestBounds, true);
    const { worldWidth, worldHeight } = pose;
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

    const anchor = new THREE.Vector3(pose.anchor.x, pose.anchor.y, pose.anchor.z);
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

  function setupHazelBillboard() {
    const pose=hazelBalconyPose();
    try {
      hazelBillboard={...HAZEL_SOURCE,...pose,anchor:new THREE.Vector3().copy(pose.anchor),
        panel:createBillboardPanel(HAZEL_SOURCE,"guest"), seated:true};
    } catch (error) {
      hazelBillboard=null;
      console.warn("Hazel billboard unavailable; balcony camera remains available",error);
      return;
    }
    // A visible, depth-masked panel is the only pick target: an invisible
    // box behind the balcony would steal clicks through the wall.
    billboards.push(hazelBillboard);
  }

  function getNamedPart(hit, model, knownNames) {
    for (let object = hit?.object; object && object !== model; object = object.parent) {
      const name = String(object.name || "").toLowerCase();
      if (knownNames.has(name)) return name;
    }
    return "";
  }

  function getProjectedSlotControlAt(clientX, clientY, canvasBounds) {
    if (!camera || cameraDetached || !slotsModel?.visible || !slotControlTargets.size) return null;
    camera.updateMatrixWorld(true);
    const candidates = [];
    for (const [part, object] of slotControlTargets) {
      const box = new THREE.Box3().setFromObject(object);
      if (box.isEmpty()) continue;
      const projected = [];
      for (const x of [box.min.x, box.max.x]) {
        for (const y of [box.min.y, box.max.y]) {
          for (const z of [box.min.z, box.max.z]) {
            const point = new THREE.Vector3(x, y, z).project(camera);
            if (point.z >= -1 && point.z <= 1) projected.push(point);
          }
        }
      }
      if (projected.length < 2) continue;
      const left = canvasBounds.left + (Math.min(...projected.map((point) => point.x)) + 1) * 0.5 * canvasBounds.width;
      const right = canvasBounds.left + (Math.max(...projected.map((point) => point.x)) + 1) * 0.5 * canvasBounds.width;
      const top = canvasBounds.top + (1 - Math.max(...projected.map((point) => point.y))) * 0.5 * canvasBounds.height;
      const bottom = canvasBounds.top + (1 - Math.min(...projected.map((point) => point.y))) * 0.5 * canvasBounds.height;
      const padding = part.startsWith("button") ? 5 : 2;
      if (clientX < left - padding || clientX > right + padding || clientY < top - padding || clientY > bottom + padding) continue;
      const center = box.getCenter(new THREE.Vector3());
      const centerX = (left + right) / 2;
      const centerY = (top + bottom) / 2;
      candidates.push({
        part,
        area: Math.max(1, (right - left) * (bottom - top)),
        centerDistance: Math.hypot(clientX - centerX, clientY - centerY),
        distance: camera.position.distanceTo(center),
      });
    }
    candidates.sort((a, b) => a.area - b.area || a.centerDistance - b.centerDistance);
    return candidates[0] || null;
  }

  function getSceneInteractionAt(clientX, clientY) {
    // Preserve visible live-character picking except for the same seat's
    // explicitly reserved stand-return footprint.
    const visibleCharacter = getBillboardAtScreen(clientX, clientY);
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return null;
    pointer.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const standHit=contestantStands?.pick(raycaster,visibleCharacter,[stageModel,rouletteModel,slotsModel?.visible?slotsModel:null,...(stageShow?.curtains||[])]);
    if(standHit)return standHit;
    if(visibleCharacter)return visibleCharacter;
    const cat=audience?.cat;
    if(cat?.visible&&audience.group.visible){
      const hit=raycaster.intersectObject(cat,false)[0];
      if(hit&&hit.uv&&hit.uv.x>.08&&hit.uv.x<.94&&hit.uv.y>.02){
        const blocker=raycaster.intersectObjects([stageModel,rouletteModel,slotsModel?.visible?slotsModel:null,...(stageShow?.curtains||[])].filter(Boolean),true).find(h=>{
          for(let o=h.object;o;o=o.parent)if(!o.visible)return false;
          const m=Array.isArray(h.object.material)?h.object.material[h.face?.materialIndex??0]:h.object.material;
          return m?.visible!==false&&m?.colorWrite!==false&&!m?.transparent;
        });
        if(!blocker||blocker.distance>=hit.distance-.005)return {machine:"smeemo-crowd",distance:hit.distance};
      }
    }
    const wheelHit = raycaster.intersectObjects(rouletteTargets, true)[0];
    const slotIntersections = raycaster.intersectObjects([...(slotsModel?.visible ? slotTargets : []), ...(stageShow?.curtains||[])], true);
    const slotHit = slotIntersections[0];
    const projectedSlotControl = getProjectedSlotControlAt(clientX, clientY, bounds);
    const cardTableHit = raycaster.intersectObjects(cardTableTargets, true)[0];
    const diceDoorHit = raycaster.intersectObjects(diceDoorTargets, false)[0];
    const chairHit = raycaster.intersectObjects(contestantTargets, false)[0];
    const hostHit = raycaster.intersectObjects(hostTargets, false)[0];
    const hits = [
      wheelHit && { distance: wheelHit.distance, hit: wheelHit, machine: "roulette", model: rouletteModel },
      slotHit && { distance: slotHit.distance, hit: slotHit, machine: "slot", model: slotsModel },
      cardTableHit && { distance: cardTableHit.distance, hit: cardTableHit, machine: "card-table", model: cardTableModel },
      diceDoorHit && { distance: diceDoorHit.distance, hit: diceDoorHit, machine: "dice-door" },
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
    if (!hit) {
      return projectedSlotControl
        ? { machine: "slot", part: projectedSlotControl.part, distance: projectedSlotControl.distance, model: slotsModel }
        : getSeatAtScreen(clientX, clientY, bounds);
    }
    if (hit.machine === "contestant" || hit.machine === "host") return hit;
    if (hit.machine === "card-table") return hit;
    const partNames = hit.machine === "roulette" ? ROULETTE_PART_NAMES : SLOT_PART_NAMES;
    let part = getNamedPart(hit.hit, hit.model, partNames);
    if (hit.machine === "slot" && projectedSlotControl && part !== "slot-reel-display") part = projectedSlotControl.part;
    return {
      ...hit,
      part,
      cellIndex: hit.machine === "slot" && part === "slot-reel-display" ? slotCellIndexAtUv(hit.hit?.uv) : -1,
    };
  }

  function getBillboardAtScreen(clientX, clientY) {
    if (diceModeOpen || pauseMenuOpen || (!cameraDetached && !["overview","host","contestant","contestants","hazel"].includes(currentView.kind))
      || billboardLayer.classList.contains("rg-billboards-fading")) return null;
    const rect = billboardLayer.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const x = (clientX-rect.left)*preview.clientWidth/rect.width;
    const y = (clientY-rect.top)*preview.clientHeight/rect.height;
    // Use the actual projected quadrilateral, not an oversized rectangle.
    // Where panels overlap, prefer the visible frontmost DOM layer,
    // then use distance to the projected centre as a tie breaker.
    const hits = billboards.filter(entry=>entry.panel.style.visibility==="visible"
      && pointInCharacterQuad(entry.projectedQuad?.corners,x,y)
      && characterOcclusion?.contains(entry,x,y)).map(entry=>{
      const corners=entry.projectedQuad.corners;
      const cx=corners.reduce((sum,p)=>sum+p.x,0)/4, cy=corners.reduce((sum,p)=>sum+p.y,0)/4;
      return {entry,distance:Math.hypot(x-cx,y-cy)};
    }).sort((a,b)=>Number(b.entry.panel.parentElement.style.zIndex)-Number(a.entry.panel.parentElement.style.zIndex) || a.distance-b.distance);
    const entry = hits[0]?.entry;
    if (!entry) return null;
    if (entry.id === "hazel") return {machine:"hazel"};
    return entry === hostBillboard ? {machine:"host",hostId:entry.id} : {machine:"contestant",contestantId:entry.id};
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
    if (freecam?.active || !gameStarted || pauseMenuOpen || diceModeOpen || !sceneReady || event.pointerType === "touch" || !camera || event.buttons || cameraTransition || document.documentElement.hasAttribute("data-rg-host-locked")) {
      hideGameCursor();
      return;
    }
    const rect = preview.getBoundingClientRect();
    if (!cameraDetached && currentView.kind === "trivia") {
      const backBand = Math.min(84, Math.max(48, rect.height * 0.11));
      setGameCursor(event.clientY >= rect.bottom - backBand ? "back" : "default");
      return;
    }
    const interaction = getSceneInteractionAt(event.clientX, event.clientY);
    const hoveredCell = !cameraDetached && currentView.kind === "slot"
      && interaction?.machine === "slot"
      && interaction.part === "slot-reel-display"
      ? interaction.cellIndex
      : -1;
    const nextHoverCell = hoveredCell;
    const hoveredLine = null;
    if (nextHoverCell !== slotHoverCell) {
      slotHoverCell = nextHoverCell;
      drawSlotReelDisplay();
    }
    if (hoveredLine?.axis !== slotHoverLine?.axis || hoveredLine?.index !== slotHoverLine?.index) {
      slotHoverLine = hoveredLine;
      drawSlotReelDisplay();
    }
    const zone = resolveSceneNavigationZone({
      interaction, view: currentView.kind,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      canGoBack: canGoBack(),
    });
    const sameFocusedTarget = !cameraDetached && (interaction?.machine === "host"
      ? currentView.kind === "host"
      : interaction?.machine === "hazel" ? currentView.kind === "hazel"
      : interaction?.machine === "contestant"
        && currentView.kind === "contestant"
        && currentView.contestantId === interaction.contestantId);
    const decorativeSlot = !cameraDetached && currentView.kind === "slot" && interaction?.machine === "slot"
      && (!interaction.part || interaction.part === "machine");
    const actionable = Boolean(interaction && !sameFocusedTarget && !decorativeSlot);
    setGameCursor(resolvePointClickCursor({ zone, actionable }));
  }

  // Native CSS cursor images use fixed pixel hotspots and never intercept input.
  function setGameCursor(mode) {
    if (canvas.dataset.rgCursor !== mode) canvas.dataset.rgCursor = mode;
  }

  function hideGameCursor() {
    delete canvas.dataset.rgCursor;
  }

  function setMenuSceneVisibility(visible) {
    if (!visible) floatingSky?.suspend();
    if (!visible) slotMarquee?.suspend();
    if (!visible) contestantStands?.suspend();
    for (const object of [stageModel, rouletteRig, slotRig, exteriorMist?.group, audience?.group, showFX?.group, stageShow?.group, characterSelection?.group, exteriorHands?.group]) {
      if (object) object.visible = visible;
    }
    characterSelection?.hide();
    focusArrow.hide();
    billboardLayer.classList.toggle("rg-billboards-fading", !visible);
  }

  function showPauseMenu() {
    if (pauseMenuOpen) return;
    freecam?.stop();
    resetEncounter();
    stageShow?.reset(currentView.kind==="slot");
    foley.setRoomAmbience(false);
    foley.stopAll();
    rouletteCabinetFX?.reset();
    focusDrag?.clearHover(); lastScenePointer = null;
    foley.play("close");
    gameStarted = false;
    pauseMenuOpen = true;
    syncMusic(); // Stop the soundtrack before the marquee audio begins.
    setMenuSceneVisibility(false);
    preview.classList.add("is-menu");
    readyScreen.hidden = true;
    pauseMenu.hidden = false;
    loading.classList.add("is-hidden");
    hideResult();
    hideGameCursor();
    if (!document.hidden && renderer && !animationFrame) animationFrame = requestAnimationFrame(animate);

    menuPresentation.sync();
    playButton.focus({ preventScroll: true });
  }

  function startGame() {
    if (!pauseMenuOpen) return;
    foley.play("open");
    pauseMenuOpen = false;
    gameStarted = true;
    pauseMenu.hidden = true;
    creditsPresentation.close();
    preview.classList.remove("is-menu");
    setMenuSceneVisibility(true);
    menuPresentation.sync();
    syncMusic(true);
    canvas.focus({ preventScroll: true });
  }

  function activateTriviaMode() {
    if (!sceneReady || diceModeOpen) { pendingTrivia=true; if(diceModeOpen)window.dispatchEvent(new Event("rg:close-dice-mode")); return; }
    pendingTrivia=false; pendingCardGameMode=""; cardMusicMode="";
    if (!gameStarted) {
      gameStarted=true;pauseMenuOpen=false;readyScreen.hidden=true;pauseMenu.hidden=true;creditsPresentation.close();preview.classList.remove("is-menu");setMenuSceneVisibility(true);menuPresentation.sync();
    }
    hideResult();hideGameCursor();
    window.dispatchEvent(new Event("rg:trivia-stage-open"));
    window.dispatchEvent(new Event("rg:close-host-panel"));
    transitionToView({kind:"trivia"});
  }
  window.addEventListener("rg:show-trivia-stage",activateTriviaMode);
  window.addEventListener("rg:hide-trivia-stage",()=>{pendingTrivia=false;if(currentView.kind==="trivia"&&sceneReady)transitionToView({kind:"overview"});});
  function activateCardGameMode(mode) {
    pendingTrivia=false;
    if (!new Set(["red-handed", "quiplash", "shop", "smeemo", "menu"]).has(mode)) return;
    if (!sceneReady || diceModeOpen) {
      pendingCardGameMode = mode;
      if (diceModeOpen) window.dispatchEvent(new Event("rg:close-dice-mode"));
      return;
    }
    if (!gameStarted) {
      gameStarted = true;
      pauseMenuOpen = false;
      readyScreen.hidden = true;
      pauseMenu.hidden = true;
      creditsPresentation.close();
      preview.classList.remove("is-menu");
      setMenuSceneVisibility(true);
      menuPresentation.sync();
    }
    // A newer non-Smeemo activity must not inherit the encounter spotlight,
    // quiet crowd or pending automatic start, even on the same table camera.
    if(mode!=="smeemo"&&["returning","table"].includes(encounter.phase))resetEncounter();
    cardMusicMode = mode;
    const wasSmeemoActive=smeemoTable.active;
    smeemoTable.choose(mode);
    if(wasSmeemoActive&&!smeemoTable.active)soundtrack.resetTrackPosition("smeemo");
    result.hidden = true;
    window.dispatchEvent(new Event("rg:close-host-panel"));
    if (cameraDetached || currentView.kind !== "card-table") { reactCrowd(mode === "menu" || mode === "shop" ? "idle" : "suspense"); transitionToView({ kind: "card-table" }); }
    else syncMusic(); // Same camera, different card game (notably Smeemo).
  }

  window.addEventListener("rg:smeemo-round-state", event => {
    const wasSmeemoActive=smeemoTable.active;
    smeemoTable.observe(event.detail);
    if(wasSmeemoActive&&!smeemoTable.active)soundtrack.resetTrackPosition("smeemo");
    syncMusic();
  });
  window.addEventListener("rg:card-game-active", (event) => activateCardGameMode(event.detail?.mode));
  window.addEventListener("rg:close-card-games", () => {
    const wasSmeemoTableMode=smeemoTable.active||cardMusicMode==="smeemo";
    pendingCardGameMode = "";
    cardMusicMode = "";
    if(wasSmeemoTableMode)soundtrack.resetTrackPosition("smeemo");
    smeemoTable.cancel();
    if (currentView.kind === "card-table") transitionToView({ kind: "overview" });
    else syncMusic();
  });

  goButton.addEventListener("click", showPauseMenu);
  playButton.addEventListener("click", startGame);
  controlsOpenButton.addEventListener("click", () => {
    if (typeof controlsDialog.showModal === "function") controlsDialog.showModal();
    else controlsDialog.setAttribute("open", "");
  });
  function closeControls() {
    if (typeof controlsDialog.close === "function") controlsDialog.close();
    else { controlsDialog.removeAttribute("open"); controlsOpenButton.focus({ preventScroll: true }); }
  }
  controlsCloseButton.addEventListener("click", closeControls);
  controlsDialog.addEventListener("click", (event) => {
    if (event.target !== controlsDialog) return;
    const rect = controlsDialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeControls();
  });
  goButton.focus({ preventScroll: true });

  function playCheer() {
    const mode=crowdState.mode==="cheer"?"idle":"cheer";
    selectAudienceMode(mode);
  }

  if(pointsHud)subscribePointScores(createScoreHud(pointsHud,{names:["faroe","erin","kaz"],assetPath:SLOT_SYMBOL_IMAGE_PATH,visible:()=>gameStarted&&!pauseMenuOpen}));
  window.addEventListener("rg:slot-action-finish",event=>{if(gameStarted&&!pauseMenuOpen&&!diceModeOpen&&!document.hidden&&currentView.kind==="slot"&&Object.values(event.detail?.totals||{}).some(v=>v>0))reactCrowd("cheer");});

  function pointClickAt(clientX, clientY) {
    if (encounter.phase==="stinger"||document.documentElement.hasAttribute("data-rg-host-locked"))return;
    if (freecam?.active || !gameStarted || pauseMenuOpen || !camera || !sceneReady || diceModeOpen || cameraTransition || stageShow?.busy) return;
    const rect = preview.getBoundingClientRect();
    if(!cameraDetached && currentView.kind==="trivia") { if(clientY>=rect.bottom-Math.min(84,Math.max(48,rect.height*.11)))goBack(); return; }
    const interaction = getSceneInteractionAt(clientX, clientY);
    const zone = resolveSceneNavigationZone({
      interaction, view: currentView.kind,
      x: clientX - rect.left,
      y: clientY - rect.top,
      width: rect.width,
      height: rect.height,
      canGoBack: canGoBack(),
    });
    if (zone === "left") return setLookDirection(-1);
    if (zone === "right") return setLookDirection(1);
    if (zone === "back") return goBack();
    if (!interaction) return;
    if(interaction.machine==="smeemo-crowd"){clickSmeemo();return;}
    if(interaction.machine==="contestant-stand"){
      contestantStands?.toggle(interaction.contestantId,performance.now(),reducedMotion.matches);
      return;
    }
    // A free camera has no focused controls. A scene click deliberately docks
    // at the selected object; it never spends a berry or spins a machine.
    if (cameraDetached) {
      const kind=interaction.machine;
      if (["host","contestant","hazel","card-table","slot","roulette","dice-door"].includes(kind))
        transitionToView({kind,...(kind==="contestant"?{contestantId:interaction.contestantId}:{})});
      return;
    }

    if (interaction.machine === "dice-door") {
      const action = resolvePointClickAction({
        machine: "dice-door",
        focused: currentView.kind === "dice-door",
      });
      if (action === "focus-dice-door") {
        transitionToView({ kind: "dice-door" });
      } else if (action === "open-dice") {
        window.dispatchEvent(new CustomEvent("rg:open-dice-mode"));
      }
      return;
    }

    if (interaction.machine === "contestant") {
      const focused = !cameraDetached && currentView.kind === "contestant" && currentView.contestantId === interaction.contestantId;
      const action = resolvePointClickAction({ machine: "contestant", focused });
      if (action === "focus-contestant") transitionToView({kind:"contestant", contestantId:interaction.contestantId});
      return;
    }

    if (interaction.machine === "hazel") {
      const action = resolvePointClickAction({machine:"hazel",focused:currentView.kind==="hazel"});
      if (action === "focus-hazel") transitionToView({kind:"hazel"});
      return;
    }

    if (interaction.machine === "host") {
      const action = resolvePointClickAction({ machine: "host", focused: !cameraDetached && currentView.kind === "host" });
      if (action === "focus-host") transitionToView({ kind: "host" });
      return;
    }

    if (interaction.machine === "card-table") {
      const action = resolvePointClickAction({
        machine: "card-table",
        focused: currentView.kind === "card-table",
      });
      if (action === "focus-card-table") transitionToView({ kind: "card-table" });
      else if (action === "open-card-games") window.dispatchEvent(new CustomEvent("rg:show-card-menu"));
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
    else if (action.startsWith("spin-column-")) spinSlotColumn(Number(action.slice("spin-column-".length)));
    else if (action === "place-slot-berry") {
      if (Number.isInteger(interaction.cellIndex) && interaction.cellIndex >= 0) {
        placeSelectedSlotSymbolAtCell(interaction.cellIndex);
      }
    }
    else if (action === "open-slots") window.dispatchEvent(new CustomEvent("rg:open-host-panel", { detail: { tab: "slots" } }));
    else if (action === "show-trivia") window.dispatchEvent(new Event("rg:show-latest-trivia"));
  }

  const canFreecam = () => gameStarted && sceneReady && camera && !stageShow?.busy && !pauseMenuOpen && !diceModeOpen
    && !document.hidden && !document.querySelector("dialog[open]") && !document.documentElement.hasAttribute("data-rg-host-locked");
  freecam = bindHoldFreecam({
    surface: canvas, viewport: preview, eligible: canFreecam,
    readPose: () => ({ position: {x:camera.position.x,y:camera.position.y,z:camera.position.z},
      direction: camera.getWorldDirection(new THREE.Vector3()) }),
    writePose: ({position,direction}) => {
      camera.position.set(position.x,position.y,position.z);
      cameraTarget.set(position.x+direction.x,position.y+direction.y,position.z+direction.z);
      camera.lookAt(cameraTarget); camera.updateMatrixWorld(true);
    },
    onStart: () => {
      cameraDetached = true;
      resetEncounter();
      cameraTransition = null;
      focusDrag?.reset(); focusOrbit.reset(currentView.kind); lastScenePointer = null;
      slotHoverCell = -1; slotHoverLine = null; drawSlotReelDisplay(); hideGameCursor();
      preview.classList.add("is-freecam", "is-freecam-detached");
      syncMusic(true);
    },
    onStop: () => {
      preview.classList.remove("is-freecam");
      focusDrag?.reset(); focusOrbit.reset(currentView.kind); lastScenePointer = null; hideGameCursor();
      // Release only the input capture. Retain the world pose until an explicit
      // navigation action; resize, pointer hover and game state cannot reframe it.
      cameraDetached = true;
      preview.classList.add("is-freecam-detached");
      syncMusic();
    },
  });
  window.addEventListener("rg:open-host-panel", () => freecam.stop());
  const canOrbit = () => !freecam.active && !cameraDetached && !stageShow?.busy && gameStarted && sceneReady && !pauseMenuOpen && !diceModeOpen && !cameraTransition
    && currentView.kind !== "overview" && !document.hidden && !document.querySelector("dialog[open]") && !document.documentElement.hasAttribute("data-rg-host-locked");
  focusDrag = bindFocusDrag(canvas, {
    enabled: canOrbit, hoverSurface: preview,
    hoverEnabled: event => canOrbit() && !reducedMotion.matches && !event.target?.closest?.("button, input, select, textarea, a, [role=button], [contenteditable]"),
    move: (dx,dy) => focusOrbit.nudge(dx,dy),
    follow: (x,y) => focusOrbit.follow(x,y), hold: () => focusOrbit.hold(),
    onMove: hideGameCursor,
  });
  const rememberPointer = event => { if (freecam.active) return; lastScenePointer = event; updatePointer(event); };
  canvas.addEventListener("pointerenter", rememberPointer);
  canvas.addEventListener("pointermove", rememberPointer);
  canvas.addEventListener("pointerdown", () => { lastScenePointer = null; hideGameCursor(); });
  canvas.addEventListener("pointerup", rememberPointer);
  canvas.addEventListener("pointercancel", () => { lastScenePointer = null; hideGameCursor(); });
  reducedMotion.addEventListener?.("change", () => { if (reducedMotion.matches) focusDrag.clearHover(); });
  // Shift-click is a presentation gesture, never a machine activation.
  function spotlightAt(clientX,clientY){
    if(!stageShow||!canFreecam()||freecam.active||cameraTransition||encounter.phase==="stinger"||encounter.phase==="focused")return;
    if(encounter.phase==="table")resetEncounter();
    const character=getBillboardAtScreen(clientX,clientY);
    const entry=character?.machine==="hazel"?hazelBillboard:character?.machine==="host"?hostBillboard:character?.machine==="contestant"?contestants.find(c=>c.id===character.contestantId):null;
    let point=entry?.anchor;
    if(!point){
      const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
      pointer.set((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1);
      raycaster.setFromCamera(pointer,camera);
      const roots=[stageModel,rouletteModel,slotsModel?.visible?slotsModel:null,...stageShow.curtains].filter(Boolean);
      point=raycaster.intersectObjects(roots,true).find(h=>{
        if(!h.object.isMesh)return false;
        for(let o=h.object;o;o=o.parent)if(!o.visible)return false;
        const material=Array.isArray(h.object.material)?h.object.material[h.face?.materialIndex??0]:h.object.material;
        return material?.visible!==false&&material?.colorWrite!==false;
      })?.point;
    }
    if(point){stageShow.toggle(point,performance.now());hideGameCursor();}
    else if(stageShow.manual)stageShow.dismiss(performance.now());
  }
  canvas.addEventListener("click", (event) => {
    if (freecam.active || event.button !== 0 || focusDrag.consumeClick()) return;
    if(event.shiftKey){event.preventDefault();spotlightAt(event.clientX,event.clientY);return;}
    pointClickAt(event.clientX, event.clientY);
  });
  canvas.addEventListener("contextmenu", (event) => {
    if (freecam.active || !gameStarted || pauseMenuOpen || !camera || !sceneReady || diceModeOpen || cameraTransition || document.documentElement.hasAttribute("data-rg-host-locked")) return;
    if(event.button!==2)return;
    const interaction=getSceneInteractionAt(event.clientX,event.clientY);
    const index = resolveSlotContextCell({
      button: event.button, view: cameraDetached ? "overview" : currentView.kind, selected: selectedSlotBerry,
      interaction,
    });
    if (index < 0) {
      const tab=resolveHostContextAction(interaction);
      if(tab){event.preventDefault();
        if (tab === "dice") window.dispatchEvent(new CustomEvent("rg:open-dice-mode", {detail:{staff:true}}));
        else window.dispatchEvent(new CustomEvent("rg:open-host-panel",{detail:{tab}}));
      }
      return;
    }
    // Do not open a browser menu over a slot cell, even if it is empty or busy.
    event.preventDefault();
    if (playing || slotReelMotion || slotCellPop || stageShow?.busy) return;
    const removal = removeSlotSymbol(slotReelGrid, index);
    if (!removal.removed) return;
    try { saveSlotGrid(removal.grid, { requirePersistence: true }); }
    catch { result.textContent = "Could not save slot removal."; result.hidden = false; return; }
    hideResult();
    foley.play("remove");
    drawSlotReelDisplay();
    syncSlotPlacementControls();
    window.dispatchEvent(new CustomEvent("rg:slot-symbol-removed", { detail: { index } }));
  });
  canvas.addEventListener("pointerleave", () => {
    lastScenePointer = null;
    slotHoverLine = null;
    slotHoverCell = -1;
    drawSlotReelDisplay();
    hideGameCursor();
  });
  window.addEventListener("blur", () => { focusDrag.clearHover(); lastScenePointer = null; hideGameCursor(); });

  window.addEventListener("rg:dice-mode-state", (event) => {
    const open = Boolean(event.detail?.open);
    if (open === diceModeOpen) return;
    if (open) { freecam?.stop(); resetEncounter(); stageShow?.reset(currentView.kind==="slot"); }
    diceModeOpen = open;
    if (open) syncMusic();
    syncVipAmbience(gameStarted&&sceneReady&&!pauseMenuOpen&&!document.hidden&&!document.documentElement.hasAttribute("data-rg-host-locked"));
    // The modal is in the browser top layer: keep the one live score strip
    // inside it while playing Dice, then restore it to the room on exit.
    if (pointsHud && diceHeader) {
      if (open) diceHeader.prepend(pointsHud);
      else preview.insertBefore(pointsHud, result);
    }
    updateLiquidPortal();
    if (open) {
      floatingSky?.suspend();
      slotMarquee?.suspend();
      contestantStands?.suspend();
      rouletteCabinetFX?.reset();
      focusDrag.clearHover(); lastScenePointer = null; stopRouletteSettlement();
      diceModeVisibility = [stageModel, rouletteRig, slotRig, exteriorMist?.group, audience?.group, showFX?.group, stageShow?.group, characterSelection?.group, exteriorHands?.group]
        .filter(Boolean)
        .map((object) => [object, object.visible]);
      for (const [object] of diceModeVisibility) object.visible = false;
      billboardLayer.classList.add("rg-billboards-fading");
      preview.classList.add("is-dice-mode");
      hideGameCursor();
      result.hidden = true;
      // The transparent dialog composites over this existing canvas. Replace
      // its last room frame synchronously so no room geometry leaks through.
      if (renderer && scene && camera) renderer.render(scene, camera);
    } else {
      for (const [object, visible] of diceModeVisibility || []) object.visible = visible;
      diceModeVisibility = null;
      suppressElapsedWheelCue();
      billboardLayer.classList.remove("rg-billboards-fading");
      preview.classList.remove("is-dice-mode");
      camera.updateMatrixWorld(true);
      if(pendingTrivia)activateTriviaMode();
      else if(pendingCardGameMode){ const mode=pendingCardGameMode; pendingCardGameMode=""; activateCardGameMode(mode); }
      syncMusic();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (freecam?.active) return;
    if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    if (diceModeOpen || document.querySelector("dialog[open]") || (event.target instanceof Element && event.target.closest("dialog[open]"))) return;
    if (event.target instanceof Element && (event.target.isContentEditable || event.target.closest("input, textarea, select, [role='textbox']"))) return;
    if (!gameStarted || pauseMenuOpen || document.documentElement.hasAttribute("data-rg-host-locked")) return;
    const key = event.key.toLowerCase();
    if(encounter.phase==="stinger"&&!["escape","backspace","arrowdown"].includes(key))return;
    // Keep native button activation: the canvas shortcut must not steal row clicks.
    if ((key === "enter" || key === " ") && event.target instanceof Element && event.target.closest("button, [role='button']")) return;
    // Arrow-key orbit remains continuous; all other arcade shortcuts are discrete.
    // Native controls keep their own activation and unrelated keys keep browser defaults.
    if (event.repeat && !["arrowleft", "arrowright", "arrowup"].includes(key) && !(key === "arrowdown" && event.shiftKey)) {
      if (resolveArcadeShortcut(key) || ["2", "3", "escape", "arrowdown", "backspace", "enter", " ", "r", "s", "g", "t"].includes(key) || (key === "b" && event.shiftKey)) event.preventDefault();
      return;
    }
    if (key === "escape") {
      if(currentView.kind==="trivia"){goBack();event.preventDefault();return;}
      showPauseMenu();
      event.preventDefault();
      return;
    }
    const shortcut = resolveArcadeShortcut(key);
    if (shortcut === "participants") transitionToView({ kind: "contestants" });
    else if (shortcut === "dice-door") {
      if (cameraDetached || currentView.kind !== "dice-door" || currentView.look !== 0) {
        transitionToView({ kind: "dice-door" });
      }
    }
    else if (shortcut === "host") transitionToView({ kind: "host" });
    else if (shortcut === "hazel") {
      if (!event.repeat && sceneReady && !document.documentElement.hasAttribute("data-rg-host-locked"))
        transitionToView({kind:"hazel"});
    }
    else if (shortcut === "smeemo-crowd") {
      // Deliberately unlisted Easter-egg shortcut; no visible marker or hover hint.
      if (!event.repeat && sceneReady && audience && !document.documentElement.hasAttribute("data-rg-host-locked")
          && (cameraDetached || currentView.kind !== "smeemo-crowd" || encounter.phase==="hidden")) transitionToView({kind:"smeemo-crowd"});
    }
    else if (shortcut === "card-table") transitionToView({ kind: "card-table" });
    else if (key === "b" && event.shiftKey) window.dispatchEvent(new CustomEvent("rg:open-host-panel", {detail:{tab:"card-games"}}));
    else if (shortcut === "cheer") {
      if (!event.repeat) playCheer();
    }
    else if (key === "2") transitionToView({ kind: "slot" });
    else if (key === "3") transitionToView({ kind: "roulette" });
    else if (key === "arrowleft") setLookDirection(-1);
    else if (key === "arrowright") setLookDirection(1);
    else if (key === "arrowup" && !cameraDetached && currentView.kind !== "overview") { focusDrag.stopFollowing(); focusOrbit.nudge(0,.012); }
    else if (key === "arrowdown" && event.shiftKey && !cameraDetached && currentView.kind !== "overview") { focusDrag.stopFollowing(); focusOrbit.nudge(0,-.012); }
    else if (key === "arrowdown" || key === "backspace") goBack();
    else if (key === "enter" || key === " ") {
      const bounds = canvas.getBoundingClientRect();
      pointClickAt(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    }
    else if (key === "r") { if(cameraDetached)transitionToView({kind:"roulette"});else startWheelSpin(); }
    else if (key === "s") { if(cameraDetached)transitionToView({kind:"slot"});else startLeverPull(); }
    else if (key === "g") window.dispatchEvent(new CustomEvent("rg:open-host-panel", { detail: { tab: "slots" } }));
    else if (key === "t") { if(event.shiftKey)window.dispatchEvent(new CustomEvent("rg:open-host-panel",{detail:{tab:"trivia"}}));else window.dispatchEvent(new Event("rg:show-latest-trivia")); }
    else if (shortcut !== "cheer") return;
    event.preventDefault();
  });

  window.addEventListener("rg:spin-wheel", startWheelSpin);
  window.addEventListener("rg:pull-slots", startLeverPull);
  window.addEventListener("rg:slot-grid-updated", (event) => {
    slotReelGrid = normalizeSlotGrid(event.detail?.grid);
    if (slotWinCelebration && slotReelGrid.some((symbol, index) => symbol !== slotWinCelebration.outcome.grid[index])) endSlotCelebration(false);
    syncSlotPlacementControls();
    if (!slotReelMotion) drawSlotReelDisplay();
  });
  window.addEventListener("rg:slot-settings-updated", (event) => {
    const berry = event.detail?.berry;
    if (["faroeberry", "erinberry", "kazberry", SLOT_REEL_WILDCARD].includes(berry)) selectedSlotBerry = berry;
    slotHoverLine = null;
    syncSlotPlacementControls();
    slotHoverCell = -1;
    drawSlotReelDisplay();
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== SLOT_GRID_STORAGE_KEY) return;
    slotReelGrid = normalizeSlotGrid(event.newValue);
    if (slotWinCelebration && slotReelGrid.some((symbol, index) => symbol !== slotWinCelebration.outcome.grid[index])) endSlotCelebration(false);
    syncSlotPlacementControls();
    if (!slotReelMotion) drawSlotReelDisplay();
  });

  function updateCameraTransition(time) {
    if (!cameraTransition) return;
    const transition = cameraTransition;
    const progress = Math.min(1, (time - transition.started) / transition.duration);
    const eased = transition.spooky ? suspenseEase(progress) : transition.theatre ? theatreEase(progress) : 1 - Math.pow(1 - progress, 3);
    camera.position.lerpVectors(transition.fromPosition, transition.toPosition, eased);
    cameraTarget.lerpVectors(transition.fromTarget, transition.toTarget, eased);
    camera.lookAt(cameraTarget);
    camera.updateMatrixWorld(true);
    if (progress >= 1) {
      applyCameraPose({position:transition.toPosition, target:transition.toTarget});
      cameraTransition = null;
    }
  }

  function updateBillboardProjection(time) {
    if (!camera || !billboardLayer || preview.clientWidth < 1 || preview.clientHeight < 1) return;
    camera.updateMatrixWorld(true);
    const viewport = {width: preview.clientWidth, height: preview.clientHeight};
    const visible = [];
    const project = p => {
      const v = new THREE.Vector3(p.x,p.y,p.z);
      const depth = -camera.worldToLocal(v.clone()).z;
      const ndc = v.project(camera);
      return {x:ndc.x,y:ndc.y,z:ndc.z,depth};
    };
    const selectionId = !cameraDetached && !freecam?.active ? selectedCharacterId(currentView) : null;
    for (const billboard of billboards) {
      billboard.renderPose=characterRenderPose(billboard,billboard.id===selectionId?time-characterSelectedAt:Infinity,reducedMotion.matches,{time:undefined,...characterSelection?.reaction(billboard.id,time)});
      const dance=dancePose(danceTime,reducedMotion.matches ? 0 : (billboard.seated ? .38 : .9),0,danceIntensity(`billboard:${billboard.id}`));
      billboard.renderPose.worldWidth*=dance.width;
      billboard.renderPose.shear=dance.shear;
      const quad = projectCharacterQuad(billboard.renderPose,camera.position,project,viewport,camera.near);
      const transform = quad && createCssProjectiveQuad(CHARACTER_SOURCE_SIZE,CHARACTER_SOURCE_SIZE,quad.corners);
      billboard.projectedQuad = transform ? quad : null;
      if (!transform) {
        billboard.panel.style.visibility = "hidden";
        continue;
      }
      if (billboard.lastTransform !== transform) {
        billboard.panel.style.transform = transform;
        billboard.lastTransform = transform;
      }
      const brightness=stageShow?.brightnessAt(billboard.anchor)??1;
      const filter=brightness===1?"":`brightness(${brightness.toFixed(3)})`;
      if(billboard.panel.style.filter!==filter)billboard.panel.style.filter=filter;
      visible.push(billboard);
    }
    // Actual scene geometry masks the DOM planes at pixel granularity. The
    // iframe itself is never read or replaced; transparent pixels remain live.
    visible.sort((a,b)=>b.projectedQuad.depth-a.projectedQuad.depth);
    visible.forEach((entry,index)=>{const style=entry.panel.parentElement.style,value=String(index+1);if(style.zIndex!==value)style.zIndex=value;});
    try {
      if (!characterOcclusion) throw new Error("Character depth pass unavailable");
      scene.updateMatrixWorld(true);
      characterOcclusion.update(visible,viewport,camera);
      const groupTags=!cameraDetached&&!freecam?.active&&!cameraTransition&&currentView.kind==="contestants"?contestants:[];
      characterSelection?.update(visible.find(entry=>entry.id===selectionId),time,time-characterSelectedAt,reducedMotion.matches,viewport,characterOcclusion,groupTags);
    } catch(error) {
      // Fail closed instead of letting a character show through walls.
      for(const entry of visible)entry.panel.style.visibility="hidden";
      characterSelection?.hide();
      characterOcclusion?.invalidate();
      if(!warnedOcclusion){warnedOcclusion=true;console.warn("Character occlusion unavailable",error);}
    }
  }

  function updateSlotPlacementControlProjection() {
    if (freecam?.active || cameraDetached || !slotControlLayer || !camera || !sceneReady || preview.clientWidth < 1 || preview.clientHeight < 1) {
      if (slotControlLayer) slotControlLayer.hidden = true;
      return;
    }
    const visible = gameStarted && !pauseMenuOpen && !diceModeOpen && !document.hidden && !document.documentElement.hasAttribute("data-rg-host-locked") && !cameraTransition && !stageShow?.busy && currentView.kind === "slot";
    slotControlLayer.hidden = !visible;
    if (!visible || !slotPlacementControls.length) return;

    camera.updateMatrixWorld(true);
    const width = preview.clientWidth;
    const height = preview.clientHeight;
    const pixelsPerWorldUnitAtOne = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    const toScreen = point => {
      const p = point.clone().project(camera);
      return { x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2 };
    };
    const { left, right, bottom } = SLOT_DISPLAY_PIXELS;
    const screenBottom = [left, right].map(x => toScreen(slotWorldPoint(x, bottom, .065)));
    const movingPoint = point => slotCabinetFX ? slotCabinetFX.worldPoint(point) : point;
    const spinButtons = slotSpinButtonCorners.map(corners => {
      // Use the same conservative world AABB as physical button picking.
      const box = new THREE.Box3().setFromPoints(corners.map(movingPoint));
      const p = [];
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) p.push(toScreen(new THREE.Vector3(x, y, z)));
      return { left: Math.min(...p.map(v => v.x)), right: Math.max(...p.map(v => v.x)), top: Math.min(...p.map(v => v.y)) };
    });
    for (const control of slotPlacementControls) {
      const anchor = movingPoint(control.anchor);
      const cameraSpace = camera.worldToLocal(anchor.clone());
      const depth = -cameraSpace.z;
      const projected = anchor.clone().project(camera);
      if (depth <= camera.near || projected.z < -1 || projected.z > 1) {
        control.button.style.visibility = "hidden";
        continue;
      }
      const xSpacingPoint = movingPoint(control.xSpacingAnchor).clone().project(camera);
      const ySpacingPoint = movingPoint(control.ySpacingAnchor).clone().project(camera);
      const horizontalGap = Math.hypot(
        (xSpacingPoint.x - projected.x) * width * 0.5,
        (xSpacingPoint.y - projected.y) * height * 0.5,
      );
      const verticalGap = Math.hypot(
        (ySpacingPoint.x - projected.x) * width * 0.5,
        (ySpacingPoint.y - projected.y) * height * 0.5,
      );
      const preferredSize = Math.min(Math.max(22, Math.min(control.worldWidth, control.worldHeight) * pixelsPerWorldUnitAtOne / depth), horizontalGap * .9, verticalGap * .9);
      const placement = control.axis === "column"
        ? fitSlotColumnArrow({ x: toScreen(slotWorldPoint(control.x, bottom, .065)).x, size: preferredSize, screenBottom, spinButtons, index: control.index })
        : { x: (projected.x + 1) * width / 2, y: (1 - projected.y) * height / 2, size: preferredSize };
      if (!placement) {
        control.button.style.visibility = "hidden";
        continue;
      }
      control.button.style.left = placement.x + "px";
      control.button.style.top = placement.y + "px";
      control.button.style.width = placement.size + "px";
      control.button.style.height = placement.size + "px";
      control.button.style.visibility = "visible";
    }
  }

  // Screen-facing DOM anchored to the tabletop; the room remains interactive around it.
  const cardLayer = document.getElementById("rg-card-games-layer");
  let cardTableBounds = null;
  function updateCardTableProjection() {
    if (!cardLayer || freecam?.active || cameraDetached) return;
    const active = gameStarted && !pauseMenuOpen && !diceModeOpen && !cameraTransition && !encounterStartPending && currentView.kind === "card-table" && cardTableModel;
    cardLayer.classList.toggle("is-off-table", !active);
    if (!active || cardLayer.hidden) return;
    cardTableBounds ||= new THREE.Box3().setFromObject(cardTableModel);
    const center = cardTableBounds.getCenter(new THREE.Vector3());
    center.y = cardTableBounds.max.y;
    center.project(camera);
    const width = preview.clientWidth, height = preview.clientHeight;
    if (!width || !height) return;
    // Clamp for narrow screens and large/long responses; use a screen-facing overlay,
    // not a perspective-warped texture, so text and pointer targets remain readable.
    const shell = cardLayer.firstElementChild;
    shell?.classList.toggle("is-scrollable", shell.scrollHeight > shell.clientHeight + 1);
    const halfWidth = Math.min(width / 2, (shell?.offsetWidth || width) / 2 + 4);
    const halfHeight = Math.min(height / 2, (shell?.offsetHeight || height) / 2 + 4);
    const x=`${Math.max(halfWidth, Math.min(width - halfWidth, (center.x + 1) * width / 2))}px`;
    const y=`${Math.max(halfHeight, Math.min(height - halfHeight, (1 - center.y) * height / 2))}px`;
    if(cardLayer.style.getPropertyValue("--table-x")!==x)cardLayer.style.setProperty("--table-x",x);
    if(cardLayer.style.getPropertyValue("--table-y")!==y)cardLayer.style.setProperty("--table-y",y);
  }

  function updateFocusArrow(time, roomVisible) {
    if (!roomVisible || diceModeOpen || cameraDetached || freecam?.active || cameraTransition || !focusArrowKey(currentView) || document.querySelector("dialog[open]")) {
      focusArrow.hide(!focusArrowKey(currentView) || cameraDetached || freecam?.active);
      return;
    }
    const viewport={width:preview.clientWidth,height:preview.clientHeight};
    const kind=currentView.kind;
    const id=selectedCharacterId(currentView);
    let target=null;
    if(kind==="smeemo-crowd"){
      const cat=audience?.cat;
      if(cat?.visible&&encounter.phase==="focused"){
        cat.updateWorldMatrix(true,false);
        const points=[[-.5,-.5],[-.5,.5],[.5,.5],[.5,-.5]].map(([x,y])=>new THREE.Vector3(x*CROWD_CAT.width,y*CROWD_CAT.height,0).applyMatrix4(cat.matrixWorld).project(camera));
        if(points.every(p=>p.z>=-1&&p.z<=1))target=projectedArrowTarget(points.map(p=>({x:(p.x+1)*viewport.width/2,y:(1-p.y)*viewport.height/2})),viewport);
      }
    } else if(id || kind==="contestants") {
      const entries=id?billboards.filter(entry=>entry.id===id):contestants;
      target=entries.map(entry=>characterArrowTarget(entry,viewport,characterOcclusion)).filter(Boolean).sort((a,b)=>a.bounds.left-b.bounds.left)[0]||null;
    } else {
      // A presented question/card stage is the visible objective, not the
      // physical table or wall behind its controls.
      const overlay=kind==="card-table"&&!cardLayer?.hidden&&!cardLayer?.classList.contains("is-off-table")?cardLayer.firstElementChild:
        kind==="trivia"&&!triviaLayer?.hidden?triviaLayer.querySelector(".rg-live-stage-content"):null;
      if(overlay){
        const rect=overlay.getBoundingClientRect(),base=preview.getBoundingClientRect();
        if(rect.width>0&&rect.height>0)target={bounds:{left:rect.left-base.left,right:rect.right-base.left,top:rect.top-base.top,bottom:rect.bottom-base.top}};
      }
      if(!target){
        let points=[];
        if(kind==="slot"){
          const {left,right,top,bottom}=SLOT_DISPLAY_PIXELS;
          for(const x of [left,(left+right)/2,right])for(const y of [top,(top+bottom)/2,bottom])points.push(slotWorldPoint(x,y));
        }
        else if(kind==="dice-door"){
          const door=ARCADE_REFERENCE_LAYOUT.diceDoor;
          for(const y of [door.minY,door.maxY])for(const z of [door.minZ,door.maxZ])points.push(new THREE.Vector3(door.wallX-door.interactionOffset,y,z));
        } else if(kind==="trivia"){
          for(const x of [4.51,9.14])for(const y of [.45,2.7])points.push(new THREE.Vector3(x,y,-6.10));
        } else {
          const object=kind==="roulette"?rouletteModel?.getObjectByName("rim")||rouletteRig:kind==="card-table"?cardTableModel:null;
          if(object?.visible){
            const box=new THREE.Box3().setFromObject(object);
            if(!box.isEmpty()){
              if(kind==="roulette"){
                const center=box.getCenter(new THREE.Vector3());
                for(let i=0;i<32;i++){const a=i*Math.PI/16;points.push(new THREE.Vector3(center.x+Math.cos(a)*(box.max.x-box.min.x)/2,box.max.y,center.z+Math.sin(a)*(box.max.z-box.min.z)/2));}
              }else for(const x of [box.min.x,box.max.x])for(const z of [box.min.z,box.max.z])points.push(new THREE.Vector3(x,box.max.y,z));
            }
          }
        }
        if(kind==="slot"&&(!slotsModel?.visible||stageShow?.busy))points=[];
        camera.updateMatrixWorld(true);
        const projected=points.map(point=>point.clone().project(camera));
        if(projected.length&&projected.every(p=>Number.isFinite(p.z)&&p.z>=-1&&p.z<=1)){
          target=projectedArrowTarget(projected.map(p=>({x:(p.x+1)*viewport.width/2,y:(1-p.y)*viewport.height/2})),viewport);
        }
      }
    }
    focusArrow.update(currentView,target,viewport,time,reducedMotion.matches);
  }

  function syncVipAmbience(roomVisible, emotion=crowdState.active, zones=null) {
    zones ||= sampleSpatialAudioZones();
    const mix=zones.vipMix;
    foley.setRoomAmbience(roomVisible&&!encounter.quiet,Math.min(mix.room,zones.exteriorMix.room),emotion,Math.max(mix.water,zones.exteriorMix.water),mix.cutoff);
  }

  function animate(time) {
    animationFrame = requestAnimationFrame(animate);
    if (!renderer || !scene || !camera) return;

    const roomVisible=gameStarted&&sceneReady&&!pauseMenuOpen&&!document.hidden&&!document.documentElement.hasAttribute("data-rg-host-locked");
    stageShow?.update(time,roomVisible&&!diceModeOpen,currentView.kind==="slot");
    slotMarquee?.update(time,roomVisible&&!diceModeOpen&&Boolean(slotsModel?.visible),currentView.kind==="slot"&&(stageShow?.travel??1)>.02);
    if(roomVisible){if(crowdLastFrame!==null)crowdClock+=Math.max(0,Math.min(250,time-crowdLastFrame));crowdLastFrame=time;}else crowdLastFrame=null;
    const emotion=encounter.quiet?"idle":crowdState.step(crowdClock); updateCrowdStatus();
    if(audience)audience.group.visible=roomVisible&&!diceModeOpen;
    signGlow?.update(time,roomVisible&&!diceModeOpen,reducedMotion.matches);
    if(!roomVisible||diceModeOpen){characterSelection?.hide();focusArrow.hide();}
    if(diceModeOpen)showFX?.update(time,{active:false});
    freecam.step(time);
    if (!freecam.active) updateCameraTransition(time);
    if (focusBase && canOrbit()) {
      const {yaw,pitch,moving} = focusOrbit.step(time, reducedMotion.matches);
      const pos = orbitPosition(focusBase, cameraTarget, yaw, pitch);
      const changed = camera.position.x !== pos.x || camera.position.y !== pos.y || camera.position.z !== pos.z;
      camera.position.set(pos.x,pos.y,pos.z);
      camera.lookAt(cameraTarget); camera.updateMatrixWorld(true);
      // Re-pick under a stationary cursor as the damped camera moves, including its final frame.
      if ((changed || moving) && lastScenePointer && !lastScenePointer.buttons) updatePointer(lastScenePointer);
    }
    const audioZones=sampleSpatialAudioZones();
    syncVipAmbience(roomVisible,emotion,audioZones);
    syncMusic(false,audioZones);
    // Keep camera/input continuous; only decorative pose sampling is 10 FPS in horror.
    // The DOM depth pass caches identical geometry, so this also reduces readbacks.
    const horrorActive=preview.classList.contains("is-smeemo-cinema");
    const poseInterval=horrorActive?HORROR_FRAME_MS:1000/30;
    danceTime=Math.floor(danceClock.step(time,roomVisible&&!diceModeOpen&&!reducedMotion.matches,soundtrack.playbackPosition())/poseInterval)*poseInterval;
    if(horrorActive!==lastHorrorScaleMode)syncHorrorRenderScale();
    stageDance?.update(danceTime,Number.isFinite(danceTime));
    contestantStands?.update(time,roomVisible&&!diceModeOpen,reducedMotion.matches);
    audience?.update(crowdClock,emotion,reducedMotion.matches,camera.position,{time:danceTime,catIntensity:danceIntensity("crowd-cat:smeemo"),focused:encounter.phase==="focused"&&currentView.kind==="smeemo-crowd"&&!cameraTransition&&!cameraDetached&&!freecam?.active,revealed:encounter.revealed,quiet:encounter.quiet,hideCrowd:encounter.hideCrowd});
    updateSmeemoEncounter(time,roomVisible);
    preview.classList.toggle("is-trivia",!cameraDetached && currentView.kind === "trivia");
    if (triviaLayer) triviaLayer.hidden = !(gameStarted && !pauseMenuOpen && !diceModeOpen && sceneReady && !cameraTransition && !cameraDetached && currentView.kind === "trivia" && triviaLayer.dataset.ready === "true");
    updateCardTableProjection();
    exteriorMist?.update(time, reducedMotion.matches, camera);
    exteriorHands?.update(crowdClock,roomVisible&&!diceModeOpen,reducedMotion.matches,camera.position);
    if (slotWinCelebration) {
      if (!canShowSlotCelebration() || (reducedMotion.matches && !slotWinCelebration.animation.reduced)) endSlotCelebration(false);
      else if (isSlotWinFinished(slotWinCelebration.animation, time)) endSlotCelebration();
      else drawSlotReelDisplay(time);
    }
    if (!canShowRouletteCabinet() || reducedMotion.matches) rouletteCabinetFX?.reset();
    slotCabinetFX?.update(time, { active: canShowCabinetFX(), reduced: reducedMotion.matches });
    floatingSky?.update(camera, roomVisible && !diceModeOpen, time);
    updateSkyAnimations(time);
    updateLiquidPortal(time);
    if (diceModeOpen) {
      renderer.render(scene, camera);
      return;
    }
    if (wheelMotion && wheelPivot && ballPivot && ballOrbitObject && Number.isFinite(wheelMotion.ballAngle)) {
      const progress = Math.min(1, (time - wheelMotion.started) / wheelMotion.duration);
      rouletteCabinetFX?.update(time,progress,canShowRouletteCabinet()&&!reducedMotion.matches);
      const ease = 1 - Math.pow(1 - progress, 4.6);
      wheelPivot.rotation.y = THREE.MathUtils.lerp(wheelMotion.wheelFrom, wheelMotion.wheelTo, ease);
      ballPivot.rotation.y = THREE.MathUtils.lerp(
        wheelMotion.ballFrom,
        wheelMotion.ballTo,
        1 - Math.pow(1 - progress, 2.2),
      );
      let pocketImpact=false;
      // Audible pocket contacts follow the ball entering the inner ring, not render frames.
      if (progress >= .76 && progress < .99 && !pauseMenuOpen) {
        const sector = Math.floor((wheelMotion.ballAngle - ballPivot.rotation.y + wheelPivot.rotation.y) / (Math.PI * 2 / 38));
        if (sector !== wheelMotion.pocketSector && time - wheelMotion.lastPocketSound >= 95) {
          wheelMotion.lastPocketSound = time;
          foley.play("pocket", { volume: 1 - .55 * progress });
          pocketImpact=true;
        }
        wheelMotion.pocketSector = sector;
      }
      if (ballOrbitObject) {
        const radius = sampleRouletteBallRadius(progress, wheelMotion.ballRadiusFrom);
        const position = rouletteBallPositionAtRadius({
          x: Math.cos(wheelMotion.ballAngle),
          y: sampleRouletteBallHeight(progress, wheelMotion.ballHeight),
          z: Math.sin(wheelMotion.ballAngle),
        }, radius);
        if (position) ballOrbitObject.position.set(position.x, position.y, position.z);
      }
      if(pocketImpact&&currentView.kind==="roulette"&&roomVisible)showFX?.impact(time);
      if (progress >= 1) {
        wheelPivot.rotation.y = wheelMotion.wheelTo;
        ballPivot.rotation.y = wheelMotion.ballTo;
        if (ballOrbitObject) {
          const landingPosition = rouletteBallPositionAtRadius(ballOrbitObject.position, ROULETTE_BALL_LANDING_RADIUS);
          if (landingPosition) ballOrbitObject.position.set(landingPosition.x, ROULETTE_BALL_LANDING_HEIGHT, landingPosition.z);
        }
        const audible = !wheelMotion.silentCompletion;
        wheelMotion = null;
        finishTurn({ settled: true, audible });
      }
    } else if (wheelMotion && time - wheelMotion.started >= wheelMotion.duration) {
      rouletteCabinetFX?.reset();
      wheelMotion = null;
      finishTurn();
    }

    if (!wheelMotion) rouletteCabinetFX?.update(time,1,canShowRouletteCabinet()&&!reducedMotion.matches);

    if (leverMotion && lever) {
      const progress = Math.min(1, (time - leverMotion.started) / leverMotion.duration);
      lever.quaternion.copy(leverMotion.baseQuaternion);
      // The cabinet and authored arm each turn ~180° about Y; +local X pulls the upper handle toward +world Z (the player).
      lever.rotateX(Math.sin(progress * Math.PI) * 0.92);
      if (progress >= 1) {
        lever.quaternion.copy(leverMotion.baseQuaternion);
        leverMotion = null;
      }
    } else if (leverMotion && time - leverMotion.started >= leverMotion.duration) {
      leverMotion = null;
    }

    if (slotReelMotion) {
      drawSlotReelDisplay(time);
      // Follow actual line stop times, including staggered all-reel spins.
      for (const line of [...slotReelMotion.columns, ...(slotReelMotion.rows || [])]) {
        const key = line.column === undefined ? `r${line.row}` : `c${line.column}`;
        if (!slotReelMotion.soundedStops.has(key) && time >= slotReelMotion.startedAt + line.delay + line.duration) {
          slotReelMotion.soundedStops.add(key);
          if (canShowCabinetFX() && time - (slotReelMotion.startedAt + line.delay + line.duration) < 220) slotCabinetFX?.brake(time);
          if (!pauseMenuOpen && time - (slotReelMotion.startedAt + line.delay + line.duration) < 220) foley.play("stop");
        }
      }
      const columnsSettled = slotReelMotion.columns.every((column) => (
        !sampleSlotReelColumn(column, slotReelMotion, time)?.spinning
      ));
      const rowsSettled = (slotReelMotion.rows || []).every((row) => (
        !sampleSlotReelRow(row, slotReelMotion, time)?.spinning
      ));
      if (columnsSettled && rowsSettled) {
        const completedMotion = slotReelMotion;
        slotReelMotion = null;
        finishSlotAction(completedMotion, time);
      }
    }

    if (slotCellPop) {
      drawSlotReelDisplay(time);
      if (time - slotCellPop.startedAt >= slotCellPop.duration) {
        const completedPop = slotCellPop;
        slotCellPop = null;
        finishSlotAction(completedPop.motion, time);
      }
    }

    showFX?.update(time,{active:roomVisible,spinning:Boolean(wheelMotion),view:currentView,reduced:reducedMotion.matches});
    // Project against this frame’s completed camera and cabinet pose, not the prior frame.
    if (sceneReady) updateSlotPlacementControlProjection();
    if (sceneReady && roomVisible) updateBillboardProjection(time);
    updateFocusArrow(time,roomVisible);
    renderer.render(scene, camera);
  }

  async function boot() {
    try {
      const [threeModule, loaderModule] = await Promise.all([
        import("three"),
        import("three/addons/loaders/GLTFLoader.js"),
      ]);
      THREE = threeModule;
      GLTFLoader = loaderModule.GLTFLoader;
      createWorld();
      if (!document.hidden && (gameStarted || pauseMenuOpen) && !animationFrame) {
        animationFrame = requestAnimationFrame(animate);
      }
      const loader = new GLTFLoader();
      const [stageGltf, rouletteGltf, slotsGltf] = await Promise.all([
        loader.loadAsync("/ramblegamble/assets/provided/rg_stage.gltf?v=all-curtain-20261127-v1"),
        loader.loadAsync("/ramblegamble/assets/provided/rg_roulette.gltf?v=roulette-ground-20261127-v1"),
        loader.loadAsync("/ramblegamble/assets/provided/rg_slots.gltf"),
      ]);

      stageModel = stageGltf.scene;
      prepareModel(stageModel);
      try {signGlow=createSignGlow(THREE,stageModel);} catch(error){console.warn("Sign animation unavailable",error);}
      stageModel.visible = !pauseMenuOpen;
      scene.add(stageModel);
      try { stageDance=createStageDance(THREE,stageModel,stageGltf.parser.associations,danceIntensity); }
      catch(error){console.warn("Stage dance unavailable",error);}
      try { contestantStands=createContestantStands(THREE,stageModel,stageGltf.parser.associations,{foley}); }
      catch(error){console.warn("Contestant stand lifts unavailable",error);}
      carveDiceDoorway(stageModel);
      if (liquidPortalFrame && liquidPortalLayer) {
        liquidPortal = createLiquidPortal({
          THREE, scene, frame: liquidPortalFrame, layer: liquidPortalLayer,
          opening: ARCADE_REFERENCE_LAYOUT.diceDoor, preview,
        });
        // Load once during room boot, not on entry to the door close-up.
        liquidPortal.preload();
      }
      exteriorMist = createExteriorMist({ THREE, scene, stage: stageModel, horizonColor: SKY_CONFIG.horizonColor });
      try { exteriorHands=createExteriorHands(THREE,scene); }
      catch(error){scene.getObjectByName("rg-exterior-hands")?.removeFromParent();console.warn("Exterior hands unavailable",error);}

      rouletteModel = rouletteGltf.scene;
      prepareModel(rouletteModel);
      rouletteRig.add(rouletteModel);
      rouletteModel.traverse((object) => {
        if (object.name === "wheel" && !object.isMesh && object.children.length > 0) wheelPivot = object;
        if (object.name === "ball" && !object.isMesh && object.children.length > 0) ballPivot = object;
      });
      prepareRouletteBall();

      slotsModel = slotsGltf.scene;
      prepareModel(slotsModel);
      slotRig.add(slotsModel);
      slotsModel.traverse((object) => {
        if (String(object.name || "").toLowerCase() === "arm") lever = object;
      });
      createSlotReelDisplay();

      placeMachinesFromStage();
      createSlotPlacementControls();
      setupPicking();
      captureSlotFocusPoints();
      try { slotMarquee=createSlotMarquee(THREE,slotsModel); }
      catch(error){console.warn("Slot marquee unavailable",error); }
      try { audience=createAudienceRenderer(THREE,scene); audience.group.visible=!pauseMenuOpen; }
      catch(error){scene.getObjectByName("rg-audience")?.removeFromParent(); console.warn("Audience presentation unavailable",error);}
      try { rouletteCabinetFX=createRouletteCabinetFX(THREE,rouletteRig,rouletteModel,{foley}); }
      catch(error){console.warn("Roulette cabinet effects unavailable",error);}
      try { showFX=createShowFX(THREE,scene,{wheel:rouletteModel,wheelPivot,ball:ballOrbitObject,door:DICE_DOOR_OPENING,wheelPoint:rouletteCabinetFX?.worldPoint,wheelCarrier:rouletteCabinetFX?.carrier}); showFX.group.visible=!pauseMenuOpen; }
      catch(error){scene.getObjectByName("rg-show-fx")?.removeFromParent(); console.warn("Show effects unavailable",error);}
      applyTheme();
      sceneReady = true;
      // Fit the overview only after all machines have their final world placement.
      overviewCameraBounds = getArcadeBounds();
      try { slotCabinetFX = createSlotCabinetFX(THREE, slotRig, slotsModel, { bayWidth: ARCADE_REFERENCE_LAYOUT.slotBay.right - ARCADE_REFERENCE_LAYOUT.slotBay.left, foley }); }
      catch (error) { console.warn("Slot cabinet effects unavailable", error); }
      try { stageShow=createStageShow(THREE,scene,{slotRig,slotsModel,roots:[stageModel,rouletteModel,slotsModel,audience?.group],foley,onEmotion:reactCrowd,reduced:()=>reducedMotion.matches});stageShow.group.visible=!pauseMenuOpen; }
      catch(error){scene.getObjectByName("rg-stage-theatre")?.removeFromParent();slotsModel.visible=true;console.warn("Stage theatre unavailable",error);}
      characterSelection=createCharacterSelection(THREE,scene,billboardLayer,{subscribePoints:subscribePointScores,subscribeStars:subscribeStarScores});
      try {characterOcclusion=createCharacterOcclusion(THREE,renderer,[stageModel,rouletteModel,slotsModel,stageShow?.group],billboards);}
      catch(error){console.warn("Character depth pass unavailable",error);}
      fitCamera();
      if (pendingCardGameMode) {
        const mode = pendingCardGameMode;
        pendingCardGameMode = "";
        activateCardGameMode(mode);
      }
      if(pendingTrivia)activateTriviaMode();
      loading.classList.add("is-hidden");
    } catch (error) {
      console.error("Ramble Gamble preview failed to start:", error);
      loading.textContent = "The 3D preview could not load.";
    }
  }

  boot();

  // The animation clock advances while hidden; do not celebrate a round that
  // completed off-screen. Foreground frame hitches, however, are real landings.
  function suppressElapsedWheelCue() {
    if (wheelMotion && performance.now() >= wheelMotion.started + wheelMotion.duration) wheelMotion.silentCompletion = true;
  }
  document.addEventListener("visibilitychange", () => {
    syncMusic();
    if (document.hidden) {
      floatingSky?.suspend();
      resetEncounter();
      contestantStands?.suspend();
      slotMarquee?.suspend();
      characterSelection?.hide();
      slotCabinetFX?.reset();
      rouletteCabinetFX?.reset();
      focusArrow.hide();
      stageShow?.reset(currentView.kind==="slot");
      crowdLastFrame=null;
      showFX?.clearRoulette();
      focusDrag?.clearHover(); lastScenePointer = null;
      endSlotCelebration(false);
      liquidPortal?.setActive(false);
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    } else if ((gameStarted || pauseMenuOpen) && renderer && !animationFrame) {
      suppressElapsedWheelCue();
      animationFrame = requestAnimationFrame(animate);
    }
  });

  window.addEventListener("pageshow", event => {
    if (!event.persisted) return;
    fitCamera();
    suppressElapsedWheelCue();
    menuPresentation.setPageSuspended(false);
    creditsPresentation.setPageSuspended(false);
    syncMusic();
    if (!document.hidden && (gameStarted || pauseMenuOpen) && renderer && !animationFrame) animationFrame = requestAnimationFrame(animate);
  });

  window.addEventListener("pagehide", event => {
    resetEncounter();
    contestantStands?.suspend();
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    if (event.persisted) {
      // A frozen page can return with the same JS heap. Keep the renderer and
      // media controllers alive, but stop active playback and transient effects.
      soundtrack.sync(null);
      menuPresentation.setPageSuspended(true);
      creditsPresentation.setPageSuspended(true);
      floatingSky?.suspend();
      slotMarquee?.suspend();
      liquidPortal?.setActive(false);
      slotCabinetFX?.reset();
      rouletteCabinetFX?.reset();
      focusArrow.hide();
      crowdLastFrame = null;
      return;
    }
    resizeObserver?.disconnect();
    liquidPortal?.dispose();
    exteriorMist?.dispose();
    exteriorHands?.dispose();
    floatingSky?.dispose();
    slotMarquee?.dispose();
    menuPresentation.dispose();
    creditsPresentation.dispose();
    soundtrack.dispose();
    contestantStands?.dispose();
    stageDance?.dispose();
    slotCabinetFX?.dispose();
    rouletteCabinetFX?.dispose();
    focusArrow.dispose(); characterOcclusion?.dispose(); characterSelection?.dispose(); signGlow?.dispose(); audience?.dispose(); showFX?.dispose(); stageShow?.dispose();
    renderer?.dispose();
  });
})();
