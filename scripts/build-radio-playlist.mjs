#!/usr/bin/env node

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSET_ROOT = path.join(ROOT, "radio", "assets");
const TRACKS_ROOT = path.join(ASSET_ROOT, "tracks");
const INDEX_PATH = path.join(ROOT, "radio", "index.html");
const METADATA_PATH = path.join(ROOT, "radio", "track-metadata.json");
const START_MARKER = "<!-- AUTO-GENERATED RADIO PLAYLIST START -->";
const END_MARKER = "<!-- AUTO-GENERATED RADIO PLAYLIST END -->";
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
    if (entry.name.startsWith(".")) continue;
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

function encodedAssetUrl(relativePath) {
  const encodedPath = relativePath.split("/").map(encodeURIComponent).join("/");
  return `/radio/assets/${encodedPath}`;
}

function normalizeTag(value) {
  return String(value).trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferTrackTags(file, details, title, artist) {
  const source = `${file} ${title} ${artist}`
    .normalize("NFKC")
    .replace(/DONTTOUCH/gi, "")
    .toLowerCase();
  const tags = new Set(["instrumental"]);

  for (const tag of Array.isArray(details.tags) ? details.tags : []) {
    const normalized = normalizeTag(tag);
    if (normalized) tags.add(normalized);
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
  if (/\b(?:ost|soundtrack|movie|film)\b/.test(source)) tags.add("soundtrack");
  if (/\bdeep[ -]?house\b/.test(source)) tags.add("deep-house");
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
  const [rootTracks, folderTracks] = await Promise.all([
    collectAudioFiles(ASSET_ROOT),
    collectAudioFiles(TRACKS_ROOT, "tracks", true),
  ]);
  const files = [...new Set([...rootTracks, ...folderTracks])];
  const tracks = files.map((file) => {
    const details = metadata[file] || {};
    return {
      file,
      title: details.title || titleFromFilename(file),
      artist: details.artist || "Unknown artist",
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
    const selected = track.isDefault ? " selected" : "";
    return `                <option value="${value}" data-artist="${artist}" data-tags="${tags}"${selected}>${title}</option>`;
  }).join("\n");

  const html = await readFile(INDEX_PATH, "utf8");
  const start = html.indexOf(START_MARKER);
  const end = html.indexOf(END_MARKER, start + START_MARKER.length);
  if (start < 0 || end < 0) throw new Error("Radio playlist generation markers are missing from radio/index.html.");

  const contentStart = start + START_MARKER.length;
  const updated = `${html.slice(0, contentStart)}\n${options}\n                ${html.slice(end)}`;
  if (updated !== html) {
    await writeFile(INDEX_PATH, updated, "utf8");
    console.log(`Updated radio playlist manifest with ${tracks.length} tracks.`);
  } else {
    console.log(`Radio playlist manifest is current (${tracks.length} tracks).`);
  }
}

buildRadioPlaylist().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
