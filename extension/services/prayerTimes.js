/**
 * prayerTimes.js — Thin wrapper around the proven PrayTimes.js library.
 * Returns times as decimal hours (e.g. 5.5 = 05:30).
 */

import pt from '../lib/PrayTimes.js';

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Calculate the five daily prayer times using the PrayTimes.org library.
 *
 * @param {{ latitude: number, longitude: number, timezone: number }} location
 * @param {Date} date
 * @param {{ method?: string, asrJuristic?: string }} options
 *
 * @returns {{ fajr, sunrise, dhuhr, asr, maghrib, isha }} in decimal hours
 */
export function calculatePrayerTimes(location, date, options = {}) {
  const { latitude, longitude, timezone } = location;
  const method = options.method || 'MWL';
  const asr    = options.asrJuristic || 'Standard';

  // Configure the library instance
  pt.setMethod(method);
  pt.adjust({ asr });

  // getTimes(date, coords, timezone, dst, format)
  // Pass timezone explicitly, dst=0 (already included in timezone value),
  // format='Float' to get decimal hours instead of HH:MM strings.
  const raw = pt.getTimes(
    [date.getFullYear(), date.getMonth() + 1, date.getDate()],
    [latitude, longitude],
    timezone,
    0,
    'Float',
  );

  return {
    fajr:    raw.fajr,
    sunrise: raw.sunrise,
    dhuhr:   raw.dhuhr,
    asr:     raw.asr,
    maghrib: raw.maghrib,
    isha:    raw.isha,
    midnight: raw.midnight,
  };
}

/** Human-readable method names keyed by ID. */
export function getMethodNames() {
  return {
    MWL:     'Muslim World League',
    ISNA:    'ISNA (North America)',
    Egypt:   'Egyptian General Authority',
    Makkah:  'Umm al-Qura (Makkah)',
    Karachi: 'Karachi',
    Tehran:  'Tehran',
    Jafari:  'Jafari (Shia)',
  };
}

/** The five prayer names in order. */
export const PRAYER_NAMES = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

/**
 * Given decimal prayer times and current decimal hour,
 * returns { current, next, secondsToNext }.
 */
export function getActivePrayer(times) {
  const now = new Date();
  const current =
    now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;

  let currentPrayer = null;
  let nextPrayer = null;
  let secondsToNext = 0;

  for (let i = PRAYER_NAMES.length - 1; i >= 0; i--) {
    if (current >= times[PRAYER_NAMES[i]]) {
      currentPrayer = PRAYER_NAMES[i];
      // Next is the following prayer (wraps to fajr)
      const nextIdx = (i + 1) % PRAYER_NAMES.length;
      nextPrayer = PRAYER_NAMES[nextIdx];
      let nextTime = times[nextPrayer];
      if (nextIdx === 0) nextTime += 24; // tomorrow's fajr
      secondsToNext = Math.round((nextTime - current) * 3600);
      break;
    }
  }

  // Before Fajr: next is Fajr
  if (!currentPrayer) {
    nextPrayer = "fajr";
    secondsToNext = Math.round((times.fajr - current) * 3600);
    if (secondsToNext < 0) secondsToNext += 24 * 3600;
  }

  return { current: currentPrayer, next: nextPrayer, secondsToNext };
}
