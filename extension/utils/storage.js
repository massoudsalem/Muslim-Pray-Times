/**
 * storage.js — Typed wrapper around chrome.storage.local
 * Works on both Chrome and Firefox (using the chrome.* polyfill in Firefox MV3).
 */

/** Default user settings */
const DEFAULTS = {
  // Calculation
  method: "MWL", // MWL | ISNA | Egypt | Makkah | Karachi | Tehran | Jafari
  asrJuristic: "Standard", // Standard (Shafi) | Hanafi

  // Display
  timeFormat: "12h", // 12h | 24h
  theme: "light", // light | dark

  // Location
  locationMode: "auto", // auto | manual
  city: "",
  latitude: null,
  longitude: null,
  timezone: null,
  locationLabel: "",

  // Notifications
  notificationsEnabled: false,
  preWarningMinutes: 10, // notify N minutes before each prayer
  adhanEnabled: false,

  // Prayer Mode
  prayerModeEnabled: false,
};

/** Promisify chrome.storage.local calls */
function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(data) {
  return new Promise((resolve) => chrome.storage.local.set(data, resolve));
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function getSettings() {
  const stored = await storageGet("settings");
  return { ...DEFAULTS, ...(stored.settings || {}) };
}

export async function setSettings(partial) {
  const current = await getSettings();
  const updated = { ...current, ...partial };
  await storageSet({ settings: updated });
  return updated;
}

// ─── Location ─────────────────────────────────────────────────────────────────

export async function getLocation() {
  const stored = await storageGet("location");
  return stored.location || null;
}

export async function setLocation(locationData) {
  await storageSet({ location: locationData });
}

// ─── Prayer Times Cache ───────────────────────────────────────────────────────

/**
 * Returns cached prayer times for today's date key, or null if stale/missing.
 * @param {string} dateKey – "YYYY-MM-DD"
 */
export async function getPrayerCache(dateKey) {
  const stored = await storageGet("prayerCache");
  const cache = stored.prayerCache;
  if (!cache || cache.dateKey !== dateKey) return null;
  return cache.times; // { fajr, sunrise, dhuhr, asr, maghrib, isha } in decimal hours
}

export async function setPrayerCache(dateKey, times) {
  await storageSet({ prayerCache: { dateKey, times } });
}

// ─── Prayer Tracker ───────────────────────────────────────────────────────────

/**
 * Prayer tracker: stores which prayers were marked as prayed today & weekly log.
 * Shape: { dateKey: string, prayers: { fajr: bool, dhuhr: bool, ... }, history: { [dateKey]: {...} } }
 */
export async function getPrayerTracker() {
  const stored = await storageGet("prayerTracker");
  return stored.prayerTracker || { dateKey: null, prayers: {}, history: {} };
}

export async function markPrayer(name, done) {
  const tracker = await getPrayerTracker();
  const { todayKey } = await import("./dateUtils.js");
  const today = todayKey();

  // Reset if new day
  const current = tracker.dateKey === today ? tracker.prayers : {};
  current[name.toLowerCase()] = done;

  // Archive today's data into history
  const history = tracker.history || {};
  history[today] = current;

  await storageSet({
    prayerTracker: { dateKey: today, prayers: current, history },
  });
}

export async function clearOldHistory() {
  const tracker = await getPrayerTracker();
  const history = tracker.history || {};

  // Keep only last 30 days
  const keys = Object.keys(history).sort().slice(-30);
  const trimmed = {};
  keys.forEach((k) => {
    trimmed[k] = history[k];
  });

  await storageSet({
    prayerTracker: { ...tracker, history: trimmed },
  });
}
