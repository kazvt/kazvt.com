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
  const repository = typeof secrets.repository === "string" ? { repository: secrets.repository } : {};
  const branch = typeof secrets.branch === "string" ? { branch: secrets.branch } : {};
  return mergeObjects(musicRepository, music, repository, branch);
}

export function getSecretMarqueeConfig(secrets) {
  const marquee = secrets.marquee || secrets.imageMarquee || secrets.gifMarquee || secrets.badgeMarquee || {};
  const repository = typeof secrets.repository === "string" ? { repository: secrets.repository } : {};
  const branch = typeof secrets.branch === "string" ? { branch: secrets.branch } : {};
  return mergeObjects(repository, branch, marquee);
}
