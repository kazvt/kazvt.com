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
    const selected = track.isDefault ? " selected" : "";
    return `                <option value="${value}" data-artist="${artist}"${selected}>${title}</option>`;
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
