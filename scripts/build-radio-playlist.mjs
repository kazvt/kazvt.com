#!/usr/bin/env node

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSET_ROOT = path.join(ROOT, "radio", "assets");
const TRACKS_ROOT = path.join(ASSET_ROOT, "tracks");
const INDEX_PATH = path.join(ROOT, "radio", "index.html");
const METADATA_PATH = path.join(ROOT, "radio", "track-metadata.json");
const NORMALIZATION_PATH = path.join(ROOT, "radio", "normalization.json");
const START_MARKER = "<!-- AUTO-GENERATED RADIO PLAYLIST START -->";
const END_MARKER = "<!-- AUTO-GENERATED RADIO PLAYLIST END -->";
const TRACK_SELECT_START = '<select class="track-select" id="track-select"';
const AUDIO_EXTENSIONS = new Set([".aac", ".m4a", ".mp3", ".ogg", ".opus", ".wav", ".webm"]);
const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

async function collectAudioFiles(directory, prefix = "", recursive = false) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const files = [];

  for (const entry of entries) {
    // The site sync keeps protected mirror copies beside some assets. They are
    // storage safeguards, not separate songs for the public playlist.
    if (entry.name.startsWith(".") || /_DONTTOUCH(?=\.[^.]+$)/i.test(entry.name)) continue;
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const fullPath = path.join(directory, entry.name);

    if (entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(relativePath.replaceAll(path.sep, "/"));
    } else if (recursive && entry.isDirectory()) {
      files.push(...await collectAudioFiles(fullPath, relativePath, true));
    }
  }

  return files;
}

function titleFromFilename(relativePath) {
  return path.basename(relativePath, path.extname(relativePath))
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function finiteSetting(settings, key, fallback) {
  return Number.isFinite(settings?.[key]) ? settings[key] : fallback;
}

function validNormalizationMode(mode, fallback = "loudness") {
  return ["off", "peak", "loudness"].includes(mode) ? mode : fallback;
}

function encodedAssetUrl(relativePath) {
  const encodedPath = relativePath.split("/").map(encodeURIComponent).join("/");
  return `/radio/assets/${encodedPath}`;
}

function normalizeTag(value) {
  return String(value).trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferTrackArtist(file, details, title) {
  const explicitArtist = String(details.artist || "").trim();
  if (explicitArtist && !/^unknown artist$/i.test(explicitArtist)) return explicitArtist;

  const source = `${file} ${title}`.normalize("NFKC").toLowerCase();
  // The owner credits all of these Takanaka-style covers to Wanye.
  if (/masayoshi\s+takanaka|\btakanaka\b/.test(source)) return "Wanye";
  if (source.includes("ハヌマーン") || source.includes("ハイカラさんが通る")) return "Hanuman (ハヌマーン)";
  if (source.includes("関俊彦")) return "Toshihiko Seki (関俊彦)";

  return explicitArtist || "Unknown artist";
}

function inferTrackTags(file, details, title, artist) {
  const source = `${file} ${title} ${artist}`
    .normalize("NFKC")
    .replace(/DONTTOUCH/gi, "")
    .toLowerCase();
  const detailTags = Array.isArray(details.tags) ? details.tags : [];
  const nonInstrumental = details.instrumental === false
    || detailTags.some((tag) => normalizeTag(tag) === "vocal");
  const tags = new Set(nonInstrumental ? [] : ["instrumental"]);

  for (const tag of detailTags) {
    const normalized = normalizeTag(tag);
    if (normalized && !(nonInstrumental && normalized === "instrumental")) tags.add(normalized);
  }

  if (/masayoshi\s+takanaka|\btakanaka\b/.test(source)) {
    ["masayoshi-takanaka", "cover", "rock", "city-pop", "disco", "funk", "samba"]
      .forEach((tag) => tags.add(tag));
  }
  if (/\b(?:deltarune|undertale|sonic|mario\s?\d*|pok[eé]mon|kirby|yoshi|terraria|spider[ -]?man|ratatouille|bloons|namco|katamari|omori|plok|balatro|zelda|wii|sonicomi|animal crossing|crash bandicoot|daisy'?s circuit|ocarina of time|skyward sword)\b/.test(source)) {
    tags.add("vgm");
  }
  if (/\b(?:christmas|x[ -]?mas|silent night|winter wonderland|happy new year|last christmas|santa|chestnuts roasting)\b/.test(source)) {
    tags.add("christmas");
  }
  if (/\b(?:anime|flcl|nazo no kanojo)\b|フリクリ/.test(source)) tags.add("anime");
  if (/\b(?:ost|soundtrack)\b/.test(source)) tags.add("ost");
  if (/\b(?:ost|soundtrack|movie|film)\b/.test(source)) tags.add("soundtrack");
  if (/\bdeep[ -]?house\b/.test(source)) tags.add("deep-house");
  if (/\bhouse\b/.test(source)) tags.add("house");
  if (/\bnew[ -]?age\b/.test(source)) tags.add("new-age");
  if (/\btechno\b/.test(source)) tags.add("techno");
  if (/\bhealing\b/.test(source)) tags.add("healing");
  if (/\bremix\b|\bmix\b/.test(source)) tags.add("remix");
  if (/\bkay[oō]kyoku\b|歌謡曲/.test(source)) tags.add("kayo-kyoku");
  if (/\bsh[oō]my[oō]\b/.test(source)) tags.add("shomyo");
  if (/\bjapan(?:ese)?\b|[\u3040-\u30ff\u3400-\u9fff]/u.test(source)) tags.add("japanese");
  if (/\bwalearic\b/.test(source)) tags.add("walearic");
  if (/\bimage album\b/.test(source)) tags.add("image-album");
  if (/\bexperimental\b/.test(source)) tags.add("experimental");
  if (/\b(?:electro|electronic)\b/.test(source)) tags.add("electronic");
  if (/\bambient\b/.test(source)) tags.add("ambient");
  if (/\bjazz\b/.test(source)) tags.add("jazz");
  if (/\bcover\b|\bin the style of\b|\bbut it'?s? a .* song\b/.test(source)) tags.add("cover");

  return [...tags];
}

async function buildRadioPlaylist() {
  const metadata = JSON.parse(await readFile(METADATA_PATH, "utf8"));
  const normalization = JSON.parse(await readFile(NORMALIZATION_PATH, "utf8"));
  const defaultMode = validNormalizationMode(normalization.defaultMode);
  const targetLufs = finiteSetting(normalization, "targetLufs", -16);
  const truePeakCeilingDbtp = finiteSetting(normalization, "truePeakCeilingDbtp", -1.5);
  const peakGuardMarginDb = Math.max(0, finiteSetting(normalization, "peakGuardMarginDb", 1.5));
  const maximumGainDb = Math.max(0, finiteSetting(normalization, "maximumGainDb", 12));
  const normalizationTracks = normalization.tracks && typeof normalization.tracks === "object"
    ? normalization.tracks
    : {};
  const [rootTracks, folderTracks] = await Promise.all([
    collectAudioFiles(ASSET_ROOT),
    collectAudioFiles(TRACKS_ROOT, "tracks", true),
  ]);
  const files = [...new Set([...rootTracks, ...folderTracks])];
  const tracks = files.map((file) => {
    const details = metadata[file] || {};
    const title = details.title || titleFromFilename(file);
    return {
      file,
      title,
      artist: inferTrackArtist(file, details, title),
      order: Number.isFinite(details.order) ? details.order : 10000,
      isDefault: details.default === true,
    };
  }).sort((a, b) => a.order - b.order || collator.compare(a.title, b.title) || collator.compare(a.file, b.file));

  if (!tracks.length) throw new Error("No supported audio files found under radio/assets or radio/assets/tracks.");
  const defaults = tracks.filter((track) => track.isDefault);
  if (defaults.length !== 1) throw new Error(`Expected exactly one default track in track-metadata.json; found ${defaults.length}.`);

  const options = tracks.map((track) => {
    const value = escapeHtml(encodedAssetUrl(track.file));
    const artist = escapeHtml(track.artist);
    const title = escapeHtml(track.title);
    const tags = escapeHtml(inferTrackTags(track.file, metadata[track.file] || {}, track.title, track.artist).join(" "));
    const loudness = normalizationTracks[track.file] || {};
    const mode = validNormalizationMode(loudness.mode, defaultMode);
    const integratedLufs = Number.isFinite(loudness.integratedLufs) ? ` data-integrated-lufs="${loudness.integratedLufs}"` : "";
    const truePeak = Number.isFinite(loudness.truePeakDbtp) ? ` data-true-peak-dbtp="${loudness.truePeakDbtp}"` : "";
    const trackTarget = finiteSetting(loudness, "targetLufs", targetLufs);
    const trackCeiling = finiteSetting(loudness, "truePeakCeilingDbtp", truePeakCeilingDbtp);
    const trackGuardMargin = Math.max(0, finiteSetting(loudness, "peakGuardMarginDb", peakGuardMarginDb));
    const trackMaximumGain = Math.max(0, finiteSetting(loudness, "maximumGainDb", maximumGainDb));
    const selected = track.isDefault ? " selected" : "";
    return `                <option value="${value}" data-artist="${artist}" data-tags="${tags}" data-normalization-mode="${mode}" data-normalization-target-lufs="${trackTarget}" data-normalization-true-peak-ceiling-dbtp="${trackCeiling}" data-normalization-peak-guard-margin-db="${trackGuardMargin}" data-normalization-maximum-gain-db="${trackMaximumGain}"${integratedLufs}${truePeak}${selected}>${title}</option>`;
  }).join("\n");

  const html = await readFile(INDEX_PATH, "utf8");
  const normalizationAttributes = [
    `data-normalization-default-mode="${defaultMode}"`,
    `data-normalization-target-lufs="${targetLufs}"`,
    `data-normalization-true-peak-ceiling-dbtp="${truePeakCeilingDbtp}"`,
    `data-normalization-peak-guard-margin-db="${peakGuardMarginDb}"`,
    `data-normalization-maximum-gain-db="${maximumGainDb}"`,
  ].join(" ");
  const selectPattern = /<select class="track-select" id="track-select"[^>]*>/;
  if (!selectPattern.test(html)) throw new Error("The radio track selector was not found.");
  const withNormalizationSettings = html.replace(selectPattern, `${TRACK_SELECT_START} ${normalizationAttributes} hidden>`);
  const audioPattern = /<audio id="radio-audio"[^>]*>/;
  const audioMatch = withNormalizationSettings.match(audioPattern);
  if (!audioMatch) throw new Error("The radio audio element was not found.");
  const defaultSource = escapeHtml(encodedAssetUrl(defaults[0].file));
  const audioTag = audioMatch[0].replace(/\s+src=("[^"]*"|'[^']*')/g, "");
  const withCurrentTrackSource = withNormalizationSettings.replace(
    audioPattern,
    audioTag.replace(/>$/, ` src="${defaultSource}">`),
  );
  const start = withCurrentTrackSource.indexOf(START_MARKER);
  const end = withCurrentTrackSource.indexOf(END_MARKER, start + START_MARKER.length);
  if (start < 0 || end < 0) throw new Error("Radio playlist generation markers are missing from radio/index.html.");
  const contentStart = start + START_MARKER.length;
  const updated = `${withCurrentTrackSource.slice(0, contentStart)}\n${options}\n                ${withCurrentTrackSource.slice(end)}`;
  if (updated !== html) {
    await writeFile(INDEX_PATH, updated, "utf8");
    console.log(`Updated radio playlist manifest with ${tracks.length} tracks.`);
  } else {
    console.log(`Radio playlist manifest is current (${tracks.length} tracks).`);
  }
  const unmeasured = tracks.filter((track) => !Number.isFinite(normalizationTracks[track.file]?.integratedLufs)
    || !Number.isFinite(normalizationTracks[track.file]?.truePeakDbtp));
  if (unmeasured.length) {
    console.warn(`${unmeasured.length} track(s) have no loudness measurement and will play at original level until analyzed.`);
  }
}

buildRadioPlaylist().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
