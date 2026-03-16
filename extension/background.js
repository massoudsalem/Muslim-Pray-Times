/**
 * background.js — MV3 Service Worker
 * Handles: badge updates, alarm scheduling, prayer notifications, daily cache refresh.
 *
 * Note: Service workers are ephemeral — always read state from chrome.storage.
 */

import {
  calculatePrayerTimes,
  getActivePrayer,
  PRAYER_NAMES,
} from "./services/prayerTimes.js";
import {
  schedulePrayerAlarms,
  handleAlarm,
} from "./services/notificationService.js";
import { todayKey } from "./utils/dateUtils.js";

// ─── Initialisation ───────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(setup);
chrome.runtime.onStartup.addListener(setup);

async function setup() {
  // Tick every minute to update the badge
  await chrome.alarms.create("badge_tick", { periodInMinutes: 1 });
  // Recalculate prayer times at midnight for the new day
  scheduleNextDayAlarm();
  await refreshBadge();
  await maybeReschedulePrayerAlarms();
}

// ─── Alarm handler ────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "badge_tick") {
    await refreshBadge();
    return;
  }

  if (alarm.name === "new_day") {
    scheduleNextDayAlarm();
    // Invalidate cache — background will pick it up next badge refresh
    await chrome.storage.local.remove("prayerCache");
    await refreshBadge();
    await maybeReschedulePrayerAlarms();
    return;
  }

  // Prayer / pre-warning notifications
  const { settings } = await chrome.storage.local.get("settings");
  handleAlarm(alarm, settings || {});
});

// ─── Message handler (from popup / options) ───────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "LOCATION_UPDATED" || msg.type === "SETTINGS_UPDATED") {
    refreshBadge()
      .then(() => maybeReschedulePrayerAlarms())
      .then(() => sendResponse({ ok: true }));
    return true; // async response
  }
});

// ─── Badge logic ──────────────────────────────────────────────────────────────

const BADGE_COLORS = {
  fajr: "#1a6b8a", // teal
  dhuhr: "#1a8a3a", // emerald
  asr: "#d4891a", // amber
  maghrib: "#8a1a5a", // magenta
  isha: "#1a1a8a", // navy
  default: "#1d4e3e", // dark emerald
};

async function refreshBadge() {
  const times = await getTodayTimes();
  if (!times) {
    chrome.action.setBadgeText({ text: "" });
    return;
  }

  const { next, secondsToNext } = getActivePrayer(times);
  if (!next) {
    chrome.action.setBadgeText({ text: "" });
    return;
  }

  const minsToNext = Math.ceil(secondsToNext / 60);
  let text;

  if (minsToNext <= 0) {
    text = next.slice(0, 3).toUpperCase(); // prayer has started
  } else if (minsToNext < 60) {
    text = `${minsToNext}m`;
  } else {
    const h = Math.floor(minsToNext / 60);
    const m = minsToNext % 60;
    text = `${h}:${m}`;
  }

  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({
    color: BADGE_COLORS[next] || BADGE_COLORS.default,
  });
}

// ─── Schedule alarms ──────────────────────────────────────────────────────────

async function maybeReschedulePrayerAlarms() {
  const times = await getTodayTimes();
  if (!times) return;

  const { settings } = await chrome.storage.local.get("settings");
  const merged = {
    notificationsEnabled: false,
    preWarningMinutes: 10,
    ...(settings || {}),
  };

  schedulePrayerAlarms(times, merged, todayKey());
}

function scheduleNextDayAlarm() {
  const now = new Date();
  const midnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    10,
  );
  chrome.alarms.create("new_day", { when: midnight.getTime() });
}

// ─── Prayer time calculation with cache ──────────────────────────────────────

async function getTodayTimes() {
  const key = todayKey();

  // Check cache
  const { prayerCache } = await chrome.storage.local.get("prayerCache");
  if (prayerCache?.dateKey === key) return prayerCache.times;

  // Need location + settings to calculate
  const { location, settings } = await chrome.storage.local.get([
    "location",
    "settings",
  ]);
  if (!location) return null;

  const opts = {
    method: settings?.method || "MWL",
    asrJuristic: settings?.asrJuristic || "Standard",
  };

  const times = calculatePrayerTimes(location, new Date(), opts);

  // Cache it
  await chrome.storage.local.set({ prayerCache: { dateKey: key, times } });
  return times;
}
