/**
 * dateUtils.js — Date formatting utilities
 * Gregorian ↔ Hijri conversion + display helpers
 */

const HIJRI_MONTHS = [
  "Muharram",
  "Safar",
  "Rabi' al-Awwal",
  "Rabi' al-Thani",
  "Jumada al-Awwal",
  "Jumada al-Thani",
  "Rajab",
  "Sha'ban",
  "Ramadan",
  "Shawwal",
  "Dhul Qi'dah",
  "Dhul Hijjah",
];

const GREGORIAN_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Convert a Gregorian date to Hijri using the standard astronomical algorithm.
 * @param {Date} date
 * @returns {{ year: number, month: number, day: number, monthName: string }}
 */
export function gregorianToHijri(date) {
  const gYear = date.getFullYear();
  const gMonth = date.getMonth() + 1; // 1-based
  const gDay = date.getDate();

  // Step 1: Compute Julian Day Number
  const JD =
    Math.floor((1461 * (gYear + 4800 + Math.floor((gMonth - 14) / 12))) / 4) +
    Math.floor(
      (367 * (gMonth - 2 - 12 * Math.floor((gMonth - 14) / 12))) / 12,
    ) -
    Math.floor(
      (3 * Math.floor((gYear + 4900 + Math.floor((gMonth - 14) / 12)) / 100)) /
        4,
    ) +
    gDay -
    32075;

  // Step 2: Compute Hijri date from JD
  const l = JD - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  const l2 = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719) +
    Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
  const l3 =
    l2 -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;

  const month = Math.floor((24 * l3) / 709);
  const day = l3 - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;

  return { year, month, day, monthName: HIJRI_MONTHS[month - 1] };
}

/**
 * Format a Hijri date object as a readable string.
 * e.g. "15 Ramadan 1447 AH"
 */
export function formatHijriDate({ year, month, day, monthName }) {
  return `${day} ${monthName || HIJRI_MONTHS[month - 1]} ${year} AH`;
}

/**
 * Format a JS Date as a Gregorian display string.
 * e.g. "Sunday, 15 March 2026"
 */
export function formatGregorianDate(date) {
  const weekday = WEEKDAYS[date.getDay()];
  const day = date.getDate();
  const month = GREGORIAN_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
}

/**
 * Return today's date as a YYYY-MM-DD cache key.
 */
export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Convert a decimal hour to a HH:MM string.
 * @param {number} decimal – e.g. 5.5 → "05:30"
 * @param {boolean} use12h – whether to format as 12-hour
 */
export function decimalToTime(decimal, use12h = false) {
  if (typeof decimal !== "number" || isNaN(decimal)) return "--:--";
  const totalMinutes = Math.round(decimal * 60);
  let hours = Math.floor(totalMinutes / 60) % 24;
  const mins = totalMinutes % 60;
  if (use12h) {
    const period = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${String(mins).padStart(2, "0")} ${period}`;
  }
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/**
 * Format seconds remaining as "H:MM:SS" or "MM:SS".
 */
export function formatCountdown(totalSeconds) {
  if (totalSeconds <= 0) return "00:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Get the current decimal hour (local time).
 */
export function currentDecimalHour() {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
}

/**
 * Get total seconds until a decimal hour target.
 * @param {number} targetDecimal
 */
export function secondsUntil(targetDecimal) {
  const current = currentDecimalHour();
  let diff = targetDecimal - current;
  if (diff < 0) diff += 24; // wrap to next day
  return Math.round(diff * 3600);
}
