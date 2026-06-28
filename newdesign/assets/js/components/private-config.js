function objectFromModule(module) {
  if (!module) return {};
  return module.secrets || module.default || module.site || module.config || {};
}

function mergeObjects(...items) {
  return items.reduce((result, item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return result;
    Object.entries(item).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") result[key] = value;
    });
    return result;
  }, {});
}

function repositoryFrom(...items) {
  for (const item of items) {
    if (item && typeof item.repository === "string" && item.repository.trim()) return { repository: item.repository };
  }
  return {};
}

function branchFrom(...items) {
  for (const item of items) {
    if (item && typeof item.branch === "string" && item.branch.trim()) return { branch: item.branch };
  }
  return {};
}

function githubApiFrom(...items) {
  for (const item of items) {
    if (item && Object.prototype.hasOwnProperty.call(item, "githubApi")) return { githubApi: item.githubApi };
    if (item && Object.prototype.hasOwnProperty.call(item, "useGithubApi")) return { useGithubApi: item.useGithubApi };
  }
  return {};
}

export async function loadSecrets() {
  try {
    return objectFromModule(await import("../data/secrets.js"));
  } catch {
    return {};
  }
}

export function getSecretTitle(secrets) {
  return secrets.title || secrets.siteTitle || secrets.websiteTitle || (secrets.website && secrets.website.title) || "";
}

export function getSecretMusicConfig(secrets) {
  const music = secrets.music || {};
  const musicRepository = secrets.musicRepository || {};
  const rootRepository = typeof secrets.repository === "string" ? { repository: secrets.repository } : {};
  const rootBranch = typeof secrets.branch === "string" ? { branch: secrets.branch } : {};
  return mergeObjects(musicRepository, music, rootRepository, rootBranch, githubApiFrom(secrets, music));
}

export function getSecretMarqueeConfig(secrets) {
  const music = secrets.music || {};
  const marquee = secrets.marquee || secrets.imageMarquee || secrets.gifMarquee || secrets.badgeMarquee || {};
  const rootRepository = typeof secrets.repository === "string" ? { repository: secrets.repository } : {};
  const rootBranch = typeof secrets.branch === "string" ? { branch: secrets.branch } : {};
  const shared = mergeObjects(repositoryFrom(music, rootRepository), branchFrom(music, rootBranch), rootRepository, rootBranch, githubApiFrom(secrets, marquee));
  if (Array.isArray(marquee)) return mergeObjects(shared, { marquees: marquee });
  return mergeObjects(shared, marquee);
}

export function getSecretRandomGifsConfig(secrets) {
  const music = secrets.music || {};
  const randomGifs = secrets.randomGifs || secrets.randomGif || secrets.desktopGifs || secrets.wallpaperGifs || {};
  const rootRepository = typeof secrets.repository === "string" ? { repository: secrets.repository } : {};
  const rootBranch = typeof secrets.branch === "string" ? { branch: secrets.branch } : {};
  return mergeObjects(repositoryFrom(music, rootRepository), branchFrom(music, rootBranch), randomGifs, rootRepository, rootBranch, githubApiFrom(secrets, randomGifs));
}


export function getSecretPeekGifsConfig(secrets) {
  const music = secrets.music || {};
  const edgePeek = secrets.edgePeek || {};
  const peekGifs = secrets.peekGifs || secrets.peekGif || secrets.edgePeekGifs || secrets.edgeGifs || {};
  const rootRepository = typeof secrets.repository === "string" ? { repository: secrets.repository } : {};
  const rootBranch = typeof secrets.branch === "string" ? { branch: secrets.branch } : {};
  return mergeObjects(repositoryFrom(music, rootRepository), branchFrom(music, rootBranch), edgePeek, peekGifs, rootRepository, rootBranch, githubApiFrom(secrets, edgePeek, peekGifs));
}

export function getSecretCursorSparklesConfig(secrets) {
  return secrets.cursorSparkles || secrets.sparkleCursor || secrets.cursorTrail || secrets.cursorEffects || {};
}

export function getSecretMotionConfig(secrets) {
  const motion = secrets.motion || secrets.animation || secrets.animations || {};
  const fps = motion.fps || secrets.fps || secrets.motionFps || secrets.siteFps || secrets.siteMotionFps || "";
  return mergeObjects(motion, fps ? { fps } : {});
}

function hasOwnValue(object, key) {
  return object && typeof object === "object" && Object.prototype.hasOwnProperty.call(object, key) && object[key] !== undefined && object[key] !== null && object[key] !== "";
}

function firstOwnValue(object, keys) {
  for (const key of keys) {
    if (hasOwnValue(object, key)) return object[key];
  }
  return undefined;
}

function hasVisualizerList(config) {
  return Boolean(config && typeof config === "object" && !Array.isArray(config) && firstOwnValue(config, ["visualizers", "visualisers", "items", "entries", "layers", "list"]));
}

export function getSecretMusicVisualizerConfig(secrets) {
  const multiple = firstOwnValue(secrets, ["musicVisualizers", "musicVisualisers", "visualizers", "visualisers", "audioVisualizers", "audioVisualisers"]);
  if (Array.isArray(multiple)) return { enabled: true, visualizers: multiple };
  if (multiple && typeof multiple === "object") return hasVisualizerList(multiple) && !hasOwnValue(multiple, "enabled") ? { enabled: true, ...multiple } : multiple;
  const single = firstOwnValue(secrets, ["musicVisualizer", "musicVisualiser", "visualizer", "visualiser", "audioVisualizer", "audioVisualiser"]);
  if (Array.isArray(single)) return { enabled: true, visualizers: single };
  if (single && typeof single === "object") return hasVisualizerList(single) && !hasOwnValue(single, "enabled") ? { enabled: true, ...single } : single;
  return {};
}
