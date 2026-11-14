const FALLBACK_TIME_ZONES = [
  "Africa/Cairo", "Africa/Johannesburg", "America/Anchorage", "America/Chicago",
  "America/Denver", "America/Los_Angeles", "America/New_York", "America/Sao_Paulo",
  "Asia/Bangkok", "Asia/Dubai", "Asia/Hong_Kong", "Asia/Kolkata", "Asia/Seoul",
  "Asia/Singapore", "Asia/Tokyo", "Australia/Adelaide", "Australia/Brisbane",
  "Australia/Darwin", "Australia/Melbourne", "Australia/Perth", "Australia/Sydney",
  "Europe/Berlin", "Europe/London", "Europe/Moscow", "Europe/Paris",
  "Pacific/Auckland", "Pacific/Honolulu", "UTC",
];

const formatterCache = new Map();
let supportedTimeZoneCache;

export function getSystemTimeZone() {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function isValidTimeZone(timeZone) {
  if (typeof timeZone !== "string" || !timeZone) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function getSupportedTimeZones(systemZone = getSystemTimeZone()) {
  if (!supportedTimeZoneCache) {
    let supported = FALLBACK_TIME_ZONES;
    try {
      if (typeof Intl.supportedValuesOf === "function") supported = Intl.supportedValuesOf("timeZone");
    } catch {
      // Use the small fallback list on older or partial Intl implementations.
    }
    supportedTimeZoneCache = [...new Set(["UTC", ...supported].filter(isValidTimeZone))];
  }
  if (!isValidTimeZone(systemZone) || supportedTimeZoneCache.includes(systemZone)) return supportedTimeZoneCache;
  return ["UTC", systemZone, ...supportedTimeZoneCache.slice(1).sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" }))];
}

function getFormatter(timeZone, kind) {
  const cacheKey = timeZone + ":" + kind;
  if (!formatterCache.has(cacheKey)) {
    const options = kind === "time"
      ? { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZone }
      : kind === "compactDate"
        ? { day: "2-digit", month: "short", year: "2-digit", timeZone }
        : kind === "fullDate"
          ? { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone }
          : { hour: "2-digit", timeZoneName: "short", timeZone };
    formatterCache.set(cacheKey, new Intl.DateTimeFormat("en-GB", options));
  }
  return formatterCache.get(cacheKey);
}

export function formatZonedClock(date, timeZone) {
  if (!isValidTimeZone(timeZone)) throw new RangeError("Unsupported time zone: " + timeZone);
  const zoneParts = getFormatter(timeZone, "zoneName").formatToParts(date);
  return {
    time: getFormatter(timeZone, "time").format(date),
    compactDate: getFormatter(timeZone, "compactDate").format(date).toLocaleUpperCase("en-GB"),
    fullDate: getFormatter(timeZone, "fullDate").format(date),
    zoneName: zoneParts.find((part) => part.type === "timeZoneName")?.value || timeZone,
  };
}
