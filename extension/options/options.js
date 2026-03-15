/**
 * options.js — Settings page controller
 */

import {
  getSettings,
  setSettings,
  getLocation,
  setLocation,
} from "../utils/storage.js";
import {
  detectGeolocation,
  saveManualLocation,
} from "../services/locationService.js";
import { PRAYER_NAMES } from "../services/prayerTimes.js";

// ─── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", init);

async function init() {
  const [settings, location] = await Promise.all([
    getSettings(),
    getLocation(),
  ]);

  applyTheme(settings.theme);
  populateForm(settings, location);
  renderTracker();
  bindEvents();
  highlightNavOnScroll();
}

// ─── Form population ───────────────────────────────────────────────────────────

function populateForm(settings, location) {
  // Calculation
  document.getElementById("method-select").value = settings.method || "MWL";
  document.getElementById("asr-select").value =
    settings.asrJuristic || "Standard";

  // Display
  document.getElementById("time-format").value = settings.timeFormat || "12h";
  document.getElementById("theme-select").value = settings.theme || "light";

  // Notifications
  document.getElementById("notif-toggle").checked =
    !!settings.notificationsEnabled;
  document.getElementById("pre-warning").value =
    settings.preWarningMinutes ?? 10;
  document.getElementById("prayer-mode-toggle").checked =
    !!settings.prayerModeEnabled;
  toggleNotifOptions(!!settings.notificationsEnabled);

  // Location
  const mode = settings.locationMode || "auto";
  document.querySelector(`input[name="loc-mode"][value="${mode}"]`).checked =
    true;
  toggleLocationMode(mode);

  if (location) {
    document.getElementById("opt-lat").value = location.latitude ?? "";
    document.getElementById("opt-lng").value = location.longitude ?? "";
    document.getElementById("opt-tz").value = location.timezone ?? "";
    document.getElementById("opt-city").value = location.label || "";
    document.getElementById("current-loc-label").textContent =
      location.label || "—";
  }
}

// ─── Events ────────────────────────────────────────────────────────────────────

function bindEvents() {
  // Location mode radio
  document.querySelectorAll('input[name="loc-mode"]').forEach((r) => {
    r.addEventListener("change", () => toggleLocationMode(r.value));
  });

  // Detect geolocation
  document.getElementById("detect-btn").addEventListener("click", async () => {
    const status = document.getElementById("detect-status");
    status.textContent = "Detecting…";
    try {
      const loc = await detectGeolocation();
      document.getElementById("current-loc-label").textContent = loc.label;
      status.textContent = `✓ ${loc.label}`;
      notifyBackground();
    } catch (err) {
      status.textContent = `⚠ ${err.message}`;
    }
  });

  // Save manual location
  document
    .getElementById("save-loc-btn")
    .addEventListener("click", async () => {
      const lat = parseFloat(document.getElementById("opt-lat").value);
      const lng = parseFloat(document.getElementById("opt-lng").value);
      const tz = parseFloat(document.getElementById("opt-tz").value);
      const label =
        document.getElementById("opt-city").value ||
        `${lat.toFixed(2)}, ${lng.toFixed(2)}`;

      if (isNaN(lat) || isNaN(lng) || isNaN(tz)) {
        showStatus("Please fill in all location fields.", true);
        return;
      }
      await saveManualLocation({
        latitude: lat,
        longitude: lng,
        timezone: tz,
        label,
      });
      document.getElementById("current-loc-label").textContent = label;
      showStatus("Location saved ✓");
      notifyBackground();
    });

  // Notifications toggle
  document.getElementById("notif-toggle").addEventListener("change", (e) => {
    toggleNotifOptions(e.target.checked);
  });

  // Theme live preview
  document.getElementById("theme-select").addEventListener("change", (e) => {
    applyTheme(e.target.value);
  });

  // Main Save button
  document
    .getElementById("save-btn")
    .addEventListener("click", saveAllSettings);

  // Sidebar nav smooth scroll
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute("href"));
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

async function saveAllSettings() {
  const partial = {
    method: document.getElementById("method-select").value,
    asrJuristic: document.getElementById("asr-select").value,
    timeFormat: document.getElementById("time-format").value,
    theme: document.getElementById("theme-select").value,
    locationMode:
      document.querySelector('input[name="loc-mode"]:checked')?.value || "auto",
    notificationsEnabled: document.getElementById("notif-toggle").checked,
    preWarningMinutes:
      parseInt(document.getElementById("pre-warning").value) || 10,
    prayerModeEnabled: document.getElementById("prayer-mode-toggle").checked,
  };

  await setSettings(partial);
  // Invalidate cache so prayer times re-calculate with new method
  await chrome.storage.local.remove("prayerCache");
  notifyBackground();
  showStatus("Settings saved ✓");
}

// ─── UI helpers ────────────────────────────────────────────────────────────────

function toggleLocationMode(mode) {
  document
    .getElementById("auto-section")
    .classList.toggle("hidden", mode !== "auto");
  document
    .getElementById("manual-section")
    .classList.toggle("hidden", mode !== "manual");
}

function toggleNotifOptions(enabled) {
  document.getElementById("notif-options").classList.toggle("hidden", !enabled);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme || "light");
}

function showStatus(msg, isError = false) {
  const el = document.getElementById("save-status");
  el.textContent = msg;
  el.style.color = isError ? "#d94f4f" : "var(--emerald)";
  setTimeout(() => {
    el.textContent = "";
  }, 3000);
}

function notifyBackground() {
  chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED" }).catch(() => {});
}

// ─── Prayer Tracker render ─────────────────────────────────────────────────────

async function renderTracker() {
  const { prayerTracker } = await chrome.storage.local.get("prayerTracker");
  const today = todayKey();
  const prayers =
    prayerTracker?.dateKey === today ? prayerTracker.prayers || {} : {};
  const history = prayerTracker?.history || {};

  // Today grid
  const grid = document.getElementById("tracker-today");
  if (grid) {
    grid.innerHTML = "";
    const labels = {
      fajr: "Fajr",
      dhuhr: "Dhuhr",
      asr: "Asr",
      maghrib: "Maghr",
      isha: "Isha",
    };
    for (const name of PRAYER_NAMES) {
      const cell = document.createElement("div");
      cell.className = "tracker-cell";

      const tag = document.createElement("div");
      tag.className = "prayer-tag";
      tag.textContent = labels[name];

      const icon = document.createElement("div");
      icon.className = "status-icon";
      icon.textContent = prayers[name] ? "✅" : "⬜";
      icon.title = prayers[name] ? "Prayed" : "Not marked";
      icon.addEventListener("click", async () => {
        const newVal = !prayers[name];
        prayers[name] = newVal;
        icon.textContent = newVal ? "✅" : "⬜";
        const tracker = prayerTracker || { history: {} };
        tracker.dateKey = today;
        tracker.prayers = prayers;
        tracker.history = tracker.history || {};
        tracker.history[today] = prayers;
        await chrome.storage.local.set({ prayerTracker: tracker });
      });

      cell.append(tag, icon);
      grid.appendChild(cell);
    }
  }

  // Weekly history
  const weekGrid = document.getElementById("tracker-week");
  if (weekGrid) {
    weekGrid.innerHTML = "";
    const last7 = getLast7Days();

    last7.forEach((dayKey) => {
      const row = document.createElement("div");
      row.className = "week-row";

      const dateLabel = document.createElement("div");
      dateLabel.className = "week-date";
      dateLabel.textContent = formatWeekDate(dayKey);
      row.appendChild(dateLabel);

      const dayPrayers = history[dayKey] || {};
      for (const name of PRAYER_NAMES) {
        const dot = document.createElement("div");
        dot.className =
          "week-dot " +
          (dayPrayers[name] ? "done" : dayKey < today ? "missed" : "");
        dot.title = name + (dayPrayers[name] ? " ✓" : "");
        row.appendChild(dot);
      }

      weekGrid.appendChild(row);
    });
  }
}

// ─── Scroll-spy for sidebar ────────────────────────────────────────────────────

function highlightNavOnScroll() {
  const sections = document.querySelectorAll(".section");
  const links = document.querySelectorAll(".nav-link");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          links.forEach((l) => l.classList.remove("active"));
          const active = document.querySelector(
            `.nav-link[href="#${entry.target.id}"]`,
          );
          if (active) active.classList.add("active");
        }
      });
    },
    { threshold: 0.5 },
  );

  sections.forEach((s) => observer.observe(s));
}

// ─── Date helpers ──────────────────────────────────────────────────────────────

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
  }
  return days;
}

function formatWeekDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${days[date.getDay()]} ${d}/${m}`;
}
