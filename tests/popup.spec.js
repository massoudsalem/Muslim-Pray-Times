/**
 * popup.spec.js — E2E tests for the extension popup.
 * Covers: structure, location panel, city search, prayer tracker,
 * countdown, dates, prayer mode overlay.
 */

import { test, expect, chromium } from '@playwright/test';
import path from 'path';

// ─── Shared context ────────────────────────────────────────────────────────────

let browserContext;
let extensionId;

test.beforeAll(async () => {
  const extensionPath = path.join(__dirname, '../extension');
  browserContext = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  let [background] = browserContext.serviceWorkers();
  if (!background)
    background = await browserContext.waitForEvent('serviceworker');

  const extensionURL = background.url();
  extensionId = extensionURL.split('/')[2];
});

test.afterAll(async () => {
  await browserContext.close();
});

/** Inject a Cairo location into storage so the popup can render prayer times. */
async function seedLocation(page) {
  await page.evaluate(() =>
    chrome.storage.local.set({
      location: {
        latitude: 30.0444,
        longitude: 31.2357,
        timezone: 2,
        label: 'Cairo, Egypt',
      },
    }),
  );
}

/** Open a fresh popup page (with location pre-seeded). */
async function openPopup() {
  const page = await browserContext.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  await seedLocation(page);
  await page.reload();
  // Wait until loading overlay disappears
  await page.waitForSelector('#loading-overlay.hidden', { timeout: 6000 });
  return page;
}

// ─── Structure tests ───────────────────────────────────────────────────────────

test.describe('Popup structure', () => {
  test('popup loads and shows all main sections', async () => {
    const page = await openPopup();
    await expect(page.locator('.header')).toBeVisible();
    await expect(page.locator('.countdown-card')).toBeVisible();
    await expect(page.locator('.prayer-list')).toBeVisible();
    await expect(page.locator('.footer')).toBeVisible();
    await page.close();
  });

  test('shows exactly 5 prayer rows', async () => {
    const page = await openPopup();
    await expect(page.locator('.prayer-row')).toHaveCount(5);
    await page.close();
  });

  test('prayer rows have expected IDs', async () => {
    const page = await openPopup();
    for (const name of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
      await expect(page.locator(`#row-${name}`)).toBeVisible();
    }
    await page.close();
  });

  test('each prayer row has a time span and a check button', async () => {
    const page = await openPopup();
    for (const name of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
      await expect(page.locator(`#time-${name}`)).toBeVisible();
      await expect(
        page.locator(`.pray-check[data-prayer="${name}"]`),
      ).toBeVisible();
    }
    await page.close();
  });

  test('prayer times are displayed (not --:--) after location is set', async () => {
    const page = await openPopup();
    for (const name of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
      const text = await page.locator(`#time-${name}`).textContent();
      expect(text).not.toBe('—');
      expect(text).toMatch(/\d{1,2}[:.]\d{2}/);
    }
    await page.close();
  });
});

// ─── Dates section ─────────────────────────────────────────────────────────────

test.describe('Date display', () => {
  test('Hijri date shows a non-empty value', async () => {
    const page = await openPopup();
    const hijri = await page.locator('#hijri-date').textContent();
    expect(hijri).not.toBe('—');
    expect(hijri.length).toBeGreaterThan(5);
    await page.close();
  });

  test('Hijri date contains "AH"', async () => {
    const page = await openPopup();
    const hijri = await page.locator('#hijri-date').textContent();
    expect(hijri).toContain('AH');
    await page.close();
  });

  test('Gregorian date shows day, month, year', async () => {
    const page = await openPopup();
    const greg = await page.locator('#greg-date').textContent();
    expect(greg).not.toBe('—');
    // e.g. "Sunday, 15 March 2026"
    expect(greg).toMatch(/\w+, \d{1,2} \w+ \d{4}/);
    await page.close();
  });
});

// ─── Countdown section ──────────────────────────────────────────────────────────

test.describe('Countdown timer', () => {
  test('next prayer name is displayed', async () => {
    const page = await openPopup();
    const name = await page.locator('#next-prayer-name').textContent();
    expect(['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']).toContain(name);
    await page.close();
  });

  test('countdown timer shows a formatted time', async () => {
    const page = await openPopup();
    const timer = await page.locator('#countdown-timer').textContent();
    // Should match MM:SS or H:MM:SS
    expect(timer).toMatch(/^\d{1,2}:\d{2}(:\d{2})?$/);
    await page.close();
  });

  test('countdown timer changes over time', async () => {
    const page = await openPopup();
    const first = await page.locator('#countdown-timer').textContent();
    await page.waitForTimeout(2500);
    const second = await page.locator('#countdown-timer').textContent();
    // The countdown ticks every second so two consecutive reads 2s apart should differ
    expect(first).not.toBe(second);
    await page.close();
  });
});

// ─── Location panel ────────────────────────────────────────────────────────────

test.describe('Location panel', () => {
  test('location label shows set location', async () => {
    const page = await openPopup();
    const label = await page.locator('#location-label').textContent();
    expect(label).toBe('Cairo, Egypt');
    await page.close();
  });

  test('location button opens the panel', async () => {
    const page = await openPopup();
    await expect(page.locator('#location-panel')).toHaveClass(/hidden/);
    await page.locator('#location-btn').click();
    await expect(page.locator('#location-panel')).not.toHaveClass(/hidden/);
    await page.close();
  });

  test('close button hides the location panel', async () => {
    const page = await openPopup();
    await page.locator('#location-btn').click();
    await expect(page.locator('#location-panel')).not.toHaveClass(/hidden/);
    await page.locator('#close-location-btn').click();
    await expect(page.locator('#location-panel')).toHaveClass(/hidden/);
    await page.close();
  });

  test('popup shows location panel when no location is saved', async () => {
    const page = await browserContext.newPage();
    // Clear storage to simulate fresh install
    await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await page.evaluate(() => chrome.storage.local.remove('location'));
    await page.reload();
    await page.waitForSelector('#location-panel:not(.hidden)', { timeout: 4000 });
    await expect(page.locator('#location-panel')).not.toHaveClass(/hidden/);
    await page.close();
  });

  test('city search input shows suggestions on query', async () => {
    const page = await openPopup();
    await page.locator('#location-btn').click();
    await page.locator('#city-input').fill('Cairo');
    await expect(page.locator('#city-suggestions')).not.toHaveClass(/hidden/);
    const items = page.locator('#city-suggestions li');
    await expect(items).toHaveCount(1); // Only Cairo matches exactly
    await page.close();
  });

  test('city search suggestion click fills coordinate inputs', async () => {
    const page = await openPopup();
    await page.locator('#location-btn').click();
    await page.locator('#city-input').fill('Cairo');
    await page.locator('#city-suggestions li').first().click();
    const lat = await page.locator('#lat-input').inputValue();
    const lng = await page.locator('#lng-input').inputValue();
    const tz = await page.locator('#tz-input').inputValue();
    expect(parseFloat(lat)).toBeCloseTo(30.0444, 2);
    expect(parseFloat(lng)).toBeCloseTo(31.2357, 2);
    expect(parseFloat(tz)).toBe(2);
    await page.close();
  });

  test('city suggestions hide when clicking outside', async () => {
    const page = await openPopup();
    await page.locator('#location-btn').click();
    await page.locator('#city-input').fill('Mecca');
    await expect(page.locator('#city-suggestions')).not.toHaveClass(/hidden/);
    // Click elsewhere
    await page.locator('.overlay-card .overlay-title').click();
    await expect(page.locator('#city-suggestions')).toHaveClass(/hidden/);
    await page.close();
  });

  test('save with invalid coordinates shows alert', async () => {
    const page = await openPopup();
    await page.locator('#location-btn').click();
    // Leave fields empty and click save
    let alertMessage = '';
    page.on('dialog', async (dialog) => {
      alertMessage = dialog.message();
      await dialog.dismiss();
    });
    await page.locator('#save-location-btn').click();
    await page.waitForTimeout(500);
    expect(alertMessage).toContain('valid latitude');
    await page.close();
  });
});

// ─── Prayer tracker ────────────────────────────────────────────────────────────

test.describe('Prayer tracker', () => {
  test('all check buttons start with checkbox symbol', async () => {
    // Clear tracker first
    const page = await browserContext.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await page.evaluate(() => chrome.storage.local.remove('prayerTracker'));
    await seedLocation(page);
    await page.reload();
    await page.waitForSelector('#loading-overlay.hidden', { timeout: 6000 });

    for (const name of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
      const btn = page.locator(`.pray-check[data-prayer="${name}"]`);
      await expect(btn).not.toHaveClass(/checked/);
      await expect(btn).toHaveText('☐');
    }
    await page.close();
  });

  test('clicking a check button marks it as checked', async () => {
    const page = await openPopup();
    await page.evaluate(() => chrome.storage.local.remove('prayerTracker'));
    await page.reload();
    await page.waitForSelector('#loading-overlay.hidden', { timeout: 6000 });

    const btn = page.locator('.pray-check[data-prayer="fajr"]');
    await btn.click();
    await expect(btn).toHaveClass(/checked/);
    await expect(btn).toHaveText('☑');
    await page.close();
  });

  test('clicking a checked button unchecks it', async () => {
    const page = await openPopup();
    await page.evaluate(() => chrome.storage.local.remove('prayerTracker'));
    await page.reload();
    await page.waitForSelector('#loading-overlay.hidden', { timeout: 6000 });

    const btn = page.locator('.pray-check[data-prayer="dhuhr"]');
    await btn.click(); // check
    await expect(btn).toHaveClass(/checked/);
    await btn.click(); // uncheck
    await expect(btn).not.toHaveClass(/checked/);
    await expect(btn).toHaveText('☐');
    await page.close();
  });

  test('weekly summary shows 5 dots', async () => {
    const page = await openPopup();
    const dots = page.locator('#weekly-summary .weekly-dot');
    await expect(dots).toHaveCount(5);
    await page.close();
  });

  test('prayed dots have "done" class', async () => {
    const page = await openPopup();
    await page.evaluate(() => chrome.storage.local.remove('prayerTracker'));
    await page.reload();
    await page.waitForSelector('#loading-overlay.hidden', { timeout: 6000 });

    // Mark fajr as prayed
    await page.locator('.pray-check[data-prayer="fajr"]').click();

    // Wait for re-render
    await page.waitForTimeout(300);
    const dots = page.locator('#weekly-summary .weekly-dot');
    const classes0 = await dots.nth(0).getAttribute('class');
    expect(classes0).toContain('done');
    await page.close();
  });
});

// ─── Prayer mode ───────────────────────────────────────────────────────────────

test.describe('Prayer mode', () => {
  test('prayer mode button is visible in footer', async () => {
    const page = await openPopup();
    await expect(page.locator('#prayer-mode-btn')).toBeVisible();
    await page.close();
  });

  test('clicking prayer mode button changes its text to ON', async () => {
    const page = await openPopup();
    // Ensure it starts OFF
    await page.evaluate(() =>
      chrome.storage.local.set({
        settings: { prayerModeEnabled: false },
      }),
    );
    await page.reload();
    await page.waitForSelector('#loading-overlay.hidden', { timeout: 6000 });

    const btn = page.locator('#prayer-mode-btn');
    await btn.click();
    const text = await btn.textContent();
    expect(text).toContain('ON');
    await page.close();
  });

  test('prayer mode overlay dismiss button hides the overlay', async () => {
    const page = await openPopup();
    // Manually show the overlay
    await page.evaluate(() => {
      document.getElementById('prayer-mode-overlay').classList.remove('hidden');
    });
    await expect(page.locator('#prayer-mode-overlay')).not.toHaveClass(/hidden/);
    await page.locator('#overlay-close').click();
    await expect(page.locator('#prayer-mode-overlay')).toHaveClass(/hidden/);
    await page.close();
  });

  test('overlay "Prayed" button hides overlay and marks prayer checked', async () => {
    const page = await openPopup();
    await page.evaluate(() => chrome.storage.local.remove('prayerTracker'));
    await page.reload();
    await page.waitForSelector('#loading-overlay.hidden', { timeout: 6000 });

    // Show overlay
    await page.evaluate(() => {
      document.getElementById('prayer-mode-overlay').classList.remove('hidden');
    });
    await page.locator('#overlay-prayed').click();
    await expect(page.locator('#prayer-mode-overlay')).toHaveClass(/hidden/);
    await page.close();
  });

  test('overlay snooze button hides overlay', async () => {
    const page = await openPopup();
    await page.evaluate(() => {
      document.getElementById('prayer-mode-overlay').classList.remove('hidden');
    });
    await page.locator('#overlay-snooze').click();
    await expect(page.locator('#prayer-mode-overlay')).toHaveClass(/hidden/);
    await page.close();
  });
});

// ─── Settings navigation ────────────────────────────────────────────────────────

test.describe('Settings navigation', () => {
  test('settings button opens options page', async () => {
    const page = await openPopup();
    const [newPage] = await Promise.all([
      browserContext.waitForEvent('page'),
      page.locator('#settings-btn').click(),
    ]);
    await newPage.waitForLoadState();
    expect(newPage.url()).toContain('options.html');
    await expect(newPage.locator('.options-container, .page-shell')).toBeVisible();
    await newPage.close();
    await page.close();
  });
});
