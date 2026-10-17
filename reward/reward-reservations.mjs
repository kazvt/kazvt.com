const FILENAME_PATTERN = /^[^/\\\u0000-\u001f]+\.(?:png|gif)$/i;
const ASSET_ID_PATTERN = /^[a-f0-9]{64}$/i;
const SEPARATOR_PATTERN = /\s*(?:->|=>|→|=|:)\s*/u;

function normalizeAlias(value) {
  return value.normalize("NFKC").trim().replace(/^@+/, "").trim().toLowerCase();
}

function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2 &&
      ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
       (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
       (trimmed.startsWith("<") && trimmed.endsWith(">")))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function basename(value) {
  return unquote(value).split(/[\\/]/u).pop() ?? "";
}

function resolveAssetId(catalog, requestedFilename, currentByName, historyByName) {
  const filename = basename(requestedFilename);
  if (!FILENAME_PATTERN.test(filename)) return "";
  const current = currentByName.get(filename.toLocaleLowerCase());
  if (current) return current;
  const historical = historyByName.get(filename.toLocaleLowerCase());
  if (!ASSET_ID_PATTERN.test(historical ?? "")) return "";
  return catalog.assetsById?.[historical.toLowerCase()] ? historical.toLowerCase() : "";
}

/** Parse forgiving `alias, alias -> filename` rules without exposing rule labels in UI. */
export function parseRewardReservations(source, catalog) {
  if (typeof source !== "string") throw new TypeError("The reward reservation list must be text.");
  if (!catalog || !Array.isArray(catalog.files) || !catalog.assets || !catalog.assetsById ||
      !catalog.filenameHistory) {
    throw new TypeError("A valid reward catalog is required to resolve reservations.");
  }

  const currentByName = new Map();
  for (const filename of catalog.files) {
    const id = catalog.assets[filename]?.assetId;
    if (FILENAME_PATTERN.test(filename) && ASSET_ID_PATTERN.test(id ?? "")) {
      currentByName.set(filename.toLowerCase(), id.toLowerCase());
    }
  }
  const historyByName = new Map(Object.entries(catalog.filenameHistory)
    .filter(([filename, id]) => FILENAME_PATTERN.test(filename) && ASSET_ID_PATTERN.test(id ?? ""))
    .map(([filename, id]) => [filename.toLowerCase(), id.toLowerCase()]));

  const aliases = new Map();
  const assetIds = new Set();
  const entries = [];
  for (const [index, rawLine] of source.split(/\r?\n/u).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = SEPARATOR_PATTERN.exec(line);
    if (!separator) throw new Error(`Reservation line ${index + 1} needs an alias-to-artwork separator.`);
    const left = line.slice(0, separator.index).trim();
    const right = line.slice(separator.index + separator[0].length).trim();
    const names = left.split(/[,;|]/u).map(normalizeAlias).filter(Boolean);
    if (!names.length || names.some(name => name.length > 100 || /[\u0000-\u001f]/u.test(name))) {
      throw new Error(`Reservation line ${index + 1} has an invalid alias.`);
    }
    const filename = basename(right);
    const assetId = resolveAssetId(catalog, right, currentByName, historyByName);
    if (!assetId) throw new Error(`Reservation line ${index + 1} refers to artwork not found in the current catalog.`);
    for (const alias of names) {
      const existing = aliases.get(alias);
      if (existing && existing !== assetId) {
        throw new Error(`Reservation alias “${alias}” points to more than one artwork.`);
      }
      aliases.set(alias, assetId);
    }
    assetIds.add(assetId);
    entries.push({ aliases: names, filename, assetId });
  }
  return { aliases, assetIds, entries };
}

export function reservedAssetForIdentity(reservations, username, userId = "") {
  const matches = new Set();
  for (const candidate of [username, userId]) {
    if (typeof candidate !== "string" || !candidate.trim()) continue;
    const assetId = reservations?.aliases?.get(normalizeAlias(candidate));
    if (assetId) matches.add(assetId);
  }
  if (matches.size > 1) throw new Error("The username and platform user ID resolve to different reserved rewards.");
  return matches.values().next().value ?? "";
}
