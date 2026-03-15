/**
 * notificationService.js — Prayer notification scheduling.
 * Uses chrome.alarms + chrome.notifications.
 * Called from background.js (service worker context).
 */

import { PRAYER_NAMES } from "./prayerTimes.js";

const PRAYER_LABELS = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

/**
 * Schedule alarms for each prayer time and optional pre-warnings.
 *
 * @param {{ fajr, dhuhr, asr, maghrib, isha }} times  — decimal hours
 * @param {object} settings
 * @param {boolean} settings.notificationsEnabled
 * @param {number}  settings.preWarningMinutes
 * @param {string}  settings.dateKey  — "YYYY-MM-DD" (today's date)
 */
export function schedulePrayerAlarms(times, settings, dateKey) {
  // Clear all previously scheduled prayer alarms first
  clearPrayerAlarms();

  if (!settings.notificationsEnabled) return;

  const now = Date.now();
  const todayBase = getDateBase(dateKey); // ms since epoch at midnight today

  for (const name of PRAYER_NAMES) {
    const decimal = times[name];
    if (decimal == null) continue;

    const prayerMs = todayBase + decimal * 3600 * 1000;

    // At-prayer-time alarm
    if (prayerMs > now) {
      chrome.alarms.create(`prayer_${name}_${dateKey}`, { when: prayerMs });
    }

    // Pre-warning alarm (e.g. 10 min before)
    const preWarningMs = settings.preWarningMinutes || 10;
    const warnMs = prayerMs - preWarningMs * 60 * 1000;
    if (warnMs > now) {
      chrome.alarms.create(`warn_${name}_${dateKey}`, { when: warnMs });
    }
  }
}

/**
 * Remove all prayer-related alarms (on settings change or new day).
 */
export function clearPrayerAlarms() {
  chrome.alarms.getAll((alarms) => {
    for (const alarm of alarms) {
      if (alarm.name.startsWith("prayer_") || alarm.name.startsWith("warn_")) {
        chrome.alarms.clear(alarm.name);
      }
    }
  });
}

/**
 * Handle a fired alarm — show the appropriate notification.
 * @param {chrome.alarms.Alarm} alarm
 * @param {object} settings
 */
export function handleAlarm(alarm, settings) {
  // Badge update alarm — handled in background.js directly
  if (alarm.name === "badge_tick") return;

  const parts = alarm.name.split("_");
  if (parts.length < 3) return;

  const [type, prayerKey] = parts; // type = 'prayer' | 'warn'
  const label = PRAYER_LABELS[prayerKey];
  if (!label) return;

  if (!settings.notificationsEnabled) return;

  if (type === "prayer") {
    showNotification(
      `🕌 It is time for ${label}`,
      "Time to pause and pray. May Allah accept your prayer.",
      true,
    );
  } else if (type === "warn") {
    const mins = settings.preWarningMinutes || 10;
    showNotification(
      `🕌 ${label} in ${mins} minutes`,
      "Prepare for prayer — make wudu and find a quiet place.",
      false,
    );
  }
}

/**
 * Display a Chrome/Firefox browser notification.
 */
function showNotification(title, message, isPrayerTime) {
  const id = `prayer_notif_${Date.now()}`;
  chrome.notifications.create(id, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("assets/icons/icon-48.png"),
    title,
    message,
    priority: isPrayerTime ? 2 : 1,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get epoch ms for midnight on the given date key ("YYYY-MM-DD").
 */
function getDateBase(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}
