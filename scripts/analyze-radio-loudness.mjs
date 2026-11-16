#!/usr/bin/env node

import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFile = promisify(execFileCallback);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSET_ROOT = path.join(ROOT, "radio", "assets");
const TRACKS_ROOT = path.join(ASSET_ROOT, "tracks");
const CONFIG_PATH = path.join(ROOT, "radio", "normalization.json");
const AUDIO_EXTENSIONS = new Set([".aac", ".m4a", ".mp3", ".ogg", ".opus", ".wav", ".webm"]);

function readArgument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function collectAudioFiles(directory, prefix = "") {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || /_DONTTOUCH(?=\.[^.]+$)/i.test(entry.name)) continue;
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const fullPath = path.join(directory, entry.name);
    if (entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push({ file: relativePath.replaceAll(path.sep, "/"), fullPath });
    } else if (entry.isDirectory()) {
      files.push(...await collectAudioFiles(fullPath, relativePath));
    }
  }
  return files;
}

function parseLoudness(stderr) {
  const start = stderr.lastIndexOf("{");
  const end = stderr.indexOf("}", start);
  if (start < 0 || end < 0) throw new Error("FFmpeg did not return loudnorm measurement data.");
  const measured = JSON.parse(stderr.slice(start, end + 1));
  const integratedLufs = Number.parseFloat(measured.input_i);
  const truePeakDbtp = Number.parseFloat(measured.input_tp);
  const loudnessRangeLufs = Number.parseFloat(measured.input_lra);
  if (!Number.isFinite(integratedLufs) || !Number.isFinite(truePeakDbtp)) {
    throw new Error(`Track has no usable integrated loudness/true-peak measurement (I=${measured.input_i}, TP=${measured.input_tp}).`);
  }
  return {
    integratedLufs: Number(integratedLufs.toFixed(2)),
    truePeakDbtp: Number(truePeakDbtp.toFixed(2)),
    ...(Number.isFinite(loudnessRangeLufs) ? { loudnessRangeLufs: Number(loudnessRangeLufs.toFixed(2)) } : {}),
  };
}

async function analyzeFile(ffmpegPath, fullPath) {
  const filter = "loudnorm=I=-16:TP=-1.5:LRA=11:dual_mono=true:print_format=json";
  const { stderr } = await execFile(ffmpegPath, [
    "-hide_banner", "-nostats", "-i", fullPath,
    "-af", filter, "-f", "null", "-",
  ], { maxBuffer: 1024 * 1024, windowsHide: true });
  return parseLoudness(stderr);
}

async function main() {
  const ffmpegPath = readArgument("--ffmpeg", process.env.RADIO_FFMPEG_PATH || "ffmpeg");
  const only = readArgument("--file", "");
  const files = await collectAudioFiles(ASSET_ROOT);
  const selected = only
    ? files.filter((entry) => entry.file === only.replaceAll("\\", "/"))
    : files;
  if (only && selected.length !== 1) throw new Error(`Could not find exactly one active radio track at radio/assets/${only}.`);
  if (!selected.length) throw new Error("No supported audio files found under radio/assets.");

  let config;
  try {
    config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    config = { defaultMode: "loudness", targetLufs: -16, truePeakCeilingDbtp: -1.5, maximumGainDb: 12, tracks: {} };
  }
  config.tracks ||= {};

  let completed = 0;
  const failures = [];
  for (const entry of selected) {
    try {
      const measured = await analyzeFile(ffmpegPath, entry.fullPath);
      config.tracks[entry.file] = { ...config.tracks[entry.file], ...measured };
      completed += 1;
      console.log(`[${completed}/${selected.length}] ${entry.file}: ${measured.integratedLufs} LUFS, ${measured.truePeakDbtp} dBTP`);
    } catch (error) {
      failures.push({ file: entry.file, error: error.message });
      console.error(`Could not measure ${entry.file}: ${error.message}`);
    }
  }

  const temporaryPath = `${CONFIG_PATH}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  await rename(temporaryPath, CONFIG_PATH);
  console.log(`Saved ${completed} loudness measurements to radio/normalization.json.`);
  if (failures.length) {
    console.error(`${failures.length} track(s) need a retry; existing per-track settings were preserved.`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
