/**
 * popup.js — Main popup controller
 * Handles: location, prayer time display, countdown, prayer tracker, modals.
 */

import {
  calculatePrayerTimes,
  getActivePrayer,
  PRAYER_NAMES,
} from "../services/prayerTimes.js";
import {
  detectGeolocation,
  saveManualLocation,
  searchCities,
} from "../services/locationService.js";
import {
  getSettings,
  getLocation,
  getPrayerCache,
  setPrayerCache,
  getPrayerTracker,
  markPrayer,
} from "../utils/storage.js";
import {
  gregorianToHijri,
  formatHijriDate,
  formatGregorianDate,
  todayKey,
  decimalToTime,
  formatCountdown,
} from "../utils/dateUtils.js";

// ─── State ─────────────────────────────────────────────────────────────────────

let state = {
  times: null, // { fajr, dhuhr, asr, maghrib, isha, ... } decimal hours
  settings: null,
  location: null,
  tracker: {}, // { fajr: bool, dhuhr: bool, ... }
  timerID: null,
};

// ─── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", init);

async function init() {
  applyTheme();
  renderDates();
  await loadAndRender();
  applyTheme(); // re-apply after settings loaded
}

async function loadAndRender() {
  showLoading(true);

  state.settings = await getSettings();
  state.location = await getLocation();

  if (!state.location) {
    showLoading(false);
    openLocationPanel();
    return;
  }

  // Try cache first, otherwise calculate
  const cached = await getPrayerCache(todayKey());
  if (cached) {
    state.times = cached;
  } else {
    state.times = calculatePrayerTimes(state.location, new Date(), state.settings);
    await setPrayerCache(todayKey(), state.times);
  }

  // Load tracker state
  const tracker = await getPrayerTracker();
  state.tracker = tracker.prayers || {};

  renderLocation();
  renderPrayerList();
  renderTracker();
  startCountdown();

  showLoading(false);
}

// ─── Render: dates ─────────────────────────────────────────────────────────────

function renderDates() {
  const now = new Date();
  const hijri = gregorianToHijri(now);

  document.getElementById("hijri-date").textContent = formatHijriDate(hijri);
  document.getElementById("greg-date").textContent = formatGregorianDate(now);
}

// ─── Render: location label ────────────────────────────────────────────────────

function renderLocation() {
  const lbl = state.location?.label || "Unknown location";
  document.getElementById("location-label").textContent = lbl;
}

// ─── Render: prayer list ───────────────────────────────────────────────────────

function renderPrayerList() {
  if (!state.times) return;

  const { current: currentPrayer } = getActivePrayer(state.times);
  const use12h = state.settings?.timeFormat === "12h";
  const nowDec = currentDecimalHour();

  for (const name of PRAYER_NAMES) {
    const row = document.getElementById(`row-${name}`);
    const timeSpan = document.getElementById(`time-${name}`);
    if (!row || !timeSpan) continue;

    const decimal = state.times[name];
    timeSpan.textContent = decimalToTime(decimal, use12h);

    row.classList.toggle("current", name === currentPrayer);
    row.classList.toggle(
      "passed",
      name !== currentPrayer && decimal < nowDec && name !== "isha",
    );
  }
}

// ─── Render: prayer tracker ────────────────────────────────────────────────────

function renderTracker() {
  for (const name of PRAYER_NAMES) {
    const btn = document.querySelector(`.pray-check[data-prayer="${name}"]`);
    if (!btn) continue;
    const done = !!state.tracker[name];
    btn.classList.toggle("checked", done);
    btn.textContent = done ? "☑" : "☐";
    btn.setAttribute(
      "aria-label",
      `${done ? "Unmark" : "Mark"} ${nameLabel(name)} as prayed`,
    );
  }

  renderWeeklySummary();
}

async function renderWeeklySummary() {
  const weekly = document.getElementById("weekly-summary");
  if (!weekly) return;

  // Show today's tracker as 5 dots
  weekly.innerHTML = "";
  for (const name of PRAYER_NAMES) {
    const dot = document.createElement("div");
    const done = !!state.tracker[name];
    const dec = state.times?.[name] ?? 0;
    const past = dec < currentDecimalHour();

    dot.className =
      "weekly-dot " + (done ? "done" : past ? "past" : "upcoming");
    dot.title = nameLabel(name) + (done ? " ✓" : past ? " (missed)" : "");
    weekly.appendChild(dot);
  }
}

// ─── Countdown timer ───────────────────────────────────────────────────────────

function startCountdown() {
  if (state.timerID) clearInterval(state.timerID);
  updateCountdown();
  state.timerID = setInterval(() => {
    updateCountdown();
    renderPrayerList(); // keep .current class accurate
    checkPrayerMode();
  }, 1000);
}

function updateCountdown() {
  if (!state.times) return;

  const { next, secondsToNext } = getActivePrayer(state.times);

  const nextEl = document.getElementById("next-prayer-name");
  const timerEl = document.getElementById("countdown-timer");

  if (!next) return;
  if (nextEl) nextEl.textContent = nameLabel(next);
  if (timerEl) timerEl.textContent = formatCountdown(secondsToNext);
}

// ─── Prayer Mode ───────────────────────────────────────────────────────────────

let lastOverlayPrayer = null; // avoid repeated overlays for same prayer

function checkPrayerMode() {
  if (!state.settings?.prayerModeEnabled || !state.times) return;

  const { current } = getActivePrayer(state.times);
  if (!current || current === lastOverlayPrayer) return;

  // Show overlay when a new prayer time starts
  const overlay = document.getElementById("prayer-mode-overlay");
  if (overlay && overlay.classList.contains("hidden")) {
    document.getElementById("overlay-title").textContent =
      `It is time for ${nameLabel(current)}`;
    overlay.classList.remove("hidden");
    lastOverlayPrayer = current;
  }
}

// ─── Theme ─────────────────────────────────────────────────────────────────────

function applyTheme() {
  const theme = state.settings?.theme || "light";
  document.documentElement.setAttribute("data-theme", theme);
}

// ─── Event listeners ───────────────────────────────────────────────────────────

document.getElementById("settings-btn").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

document
  .getElementById("location-btn")
  .addEventListener("click", openLocationPanel);
document
  .getElementById("prayer-mode-btn")
  .addEventListener("click", togglePrayerMode);

// Prayer check buttons
document.querySelectorAll(".pray-check").forEach((btn) => {
  btn.addEventListener("click", async (e) => {
    const name = e.currentTarget.dataset.prayer;
    const done = !state.tracker[name];
    state.tracker[name] = done;
    await markPrayer(name, done);
    renderTracker();
  });
});

// Prayer Mode overlay
document
  .getElementById("overlay-prayed")
  .addEventListener("click", async () => {
    // Mark current prayer as prayed
    const { current } = getActivePrayer(state.times);
    if (current) {
      state.tracker[current] = true;
      await markPrayer(current, true);
      renderTracker();
    }
    document.getElementById("prayer-mode-overlay").classList.add("hidden");
  });

document.getElementById("overlay-snooze").addEventListener("click", () => {
  const overlay = document.getElementById("prayer-mode-overlay");
  overlay.classList.add("hidden");
  // Show again in 5 minutes
  setTimeout(
    () => {
      lastOverlayPrayer = null; // allow re-trigger
    },
    5 * 60 * 1000,
  );
});

document.getElementById("overlay-close").addEventListener("click", () => {
  document.getElementById("prayer-mode-overlay").classList.add("hidden");
  lastOverlayPrayer = getActivePrayer(state.times)?.current || null;
});

// ─── Location panel ────────────────────────────────────────────────────────────

function openLocationPanel() {
  document.getElementById("location-panel").classList.remove("hidden");
}

document.getElementById("close-location-btn").addEventListener("click", () => {
  document.getElementById("location-panel").classList.add("hidden");
});

document
  .getElementById("auto-location-btn")
  .addEventListener("click", async () => {
    const status = document.getElementById("auto-location-status");
    status.textContent = "Detecting…";
    try {
      state.location = await detectGeolocation();
      status.textContent = `✓ ${state.location.label}`;
      await chrome.storage.local.remove("prayerCache"); // force recalculate
      chrome.runtime.sendMessage({ type: "LOCATION_UPDATED" }).catch(() => {});
      setTimeout(() => {
        document.getElementById("location-panel").classList.add("hidden");
        loadAndRender();
      }, 800);
    } catch (err) {
      status.textContent = `⚠ ${err.message}`;
    }
  });

// City search autocomplete
const cityInput = document.getElementById("city-input");
const suggestions = document.getElementById("city-suggestions");

cityInput?.addEventListener("input", () => {
  const query = cityInput.value;
  const results = searchCities(query);
  suggestions.innerHTML = "";
  if (results.length === 0) {
    suggestions.classList.add("hidden");
    return;
  }

  results.forEach((city) => {
    const li = document.createElement("li");
    li.textContent = city.label;
    li.addEventListener("click", () => {
      document.getElementById("lat-input").value = city.lat;
      document.getElementById("lng-input").value = city.lng;
      document.getElementById("tz-input").value = city.tz;
      cityInput.value = city.label;
      suggestions.classList.add("hidden");
    });
    suggestions.appendChild(li);
  });
  suggestions.classList.remove("hidden");
});

document.addEventListener("click", (e) => {
  if (!cityInput.contains(e.target)) suggestions.classList.add("hidden");
});

document
  .getElementById("save-location-btn")
  .addEventListener("click", async () => {
    const lat = parseFloat(document.getElementById("lat-input").value);
    const lng = parseFloat(document.getElementById("lng-input").value);
    const tz = parseFloat(document.getElementById("tz-input").value);
    const label = cityInput.value || `${lat.toFixed(2)}, ${lng.toFixed(2)}`;

    if (isNaN(lat) || isNaN(lng)) {
      alert("Please enter valid latitude and longitude.");
      return;
    }
    if (isNaN(tz)) {
      alert("Please enter a valid timezone offset.");
      return;
    }

    state.location = await saveManualLocation({
      latitude: lat,
      longitude: lng,
      timezone: tz,
      label,
    });
    await chrome.storage.local.remove("prayerCache");
    chrome.runtime.sendMessage({ type: "LOCATION_UPDATED" }).catch(() => {});
    document.getElementById("location-panel").classList.add("hidden");
    loadAndRender();
  });

// ─── Prayer Mode toggle ────────────────────────────────────────────────────────

async function togglePrayerMode() {
  const { setSettings } = await import("../utils/storage.js");
  const enabled = !state.settings?.prayerModeEnabled;
  state.settings = await setSettings({ prayerModeEnabled: enabled });

  const btn = document.getElementById("prayer-mode-btn");
  btn.textContent = enabled ? "🕌 Mode: ON" : "🕌 Prayer Mode";
  btn.classList.toggle("primary-btn", enabled);
  btn.classList.toggle("secondary-btn", !enabled);
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function currentDecimalHour() {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
}

function nameLabel(name) {
  const labels = {
    fajr: "Fajr",
    dhuhr: "Dhuhr",
    asr: "Asr",
    maghrib: "Maghrib",
    isha: "Isha",
  };
  return labels[name] || name;
}

function showLoading(show) {
  const el = document.getElementById("loading-overlay");
  if (el) el.classList.toggle("hidden", !show);
}
