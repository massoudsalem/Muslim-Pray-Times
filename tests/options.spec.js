/**
 * options.spec.js — E2E tests for the extension settings (options) page.
 * Covers: page structure, dropdowns, toggles, theme live-preview,
 * save confirmation, location mode switching.
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

  extensionId = background.url().split('/')[2];
});

test.afterAll(async () => {
  await browserContext.close();
});

async function openOptions() {
  const page = await browserContext.newPage();
  await page.goto(`chrome-extension://${extensionId}/options/options.html`);
  await page.waitForLoadState('domcontentloaded');
  return page;
}

// ─── Page structure ────────────────────────────────────────────────────────────

test.describe('Options page structure', () => {
  test('page title is "Prayer Times Settings"', async () => {
    const page = await openOptions();
    await expect(page).toHaveTitle(/Prayer Times/);
    await page.close();
  });

  test('sidebar brand is visible', async () => {
    const page = await openOptions();
    await expect(page.locator('.sidebar-brand')).toBeVisible();
    await page.close();
  });

  test('sidebar has 5 navigation links', async () => {
    const page = await openOptions();
    await expect(page.locator('.nav-link')).toHaveCount(5);
    await page.close();
  });

  test('all 5 sections are present', async () => {
    const page = await openOptions();
    for (const id of ['calculation', 'location', 'notifications', 'display', 'tracker']) {
      await expect(page.locator(`#${id}`)).toBeAttached();
    }
    await page.close();
  });

  test('save button is visible', async () => {
    const page = await openOptions();
    await expect(page.locator('#save-btn')).toBeVisible();
    await page.close();
  });
});

// ─── Calculation section ───────────────────────────────────────────────────────

test.describe('Calculation method', () => {
  test('method select has 7 options', async () => {
    const page = await openOptions();
    const options = page.locator('#method-select option');
    await expect(options).toHaveCount(7);
    await page.close();
  });

  test('method select includes MWL option', async () => {
    const page = await openOptions();
    await expect(page.locator('#method-select option[value="MWL"]')).toBeAttached();
    await page.close();
  });

  test('method select includes Egypt option', async () => {
    const page = await openOptions();
    await expect(page.locator('#method-select option[value="Egypt"]')).toBeAttached();
    await page.close();
  });

  test('asr select has 2 options (Standard and Hanafi)', async () => {
    const page = await openOptions();
    const options = page.locator('#asr-select option');
    await expect(options).toHaveCount(2);
    await page.close();
  });

  test('changing method select updates selected value', async () => {
    const page = await openOptions();
    await page.locator('#method-select').selectOption('Egypt');
    expect(await page.locator('#method-select').inputValue()).toBe('Egypt');
    await page.close();
  });
});

// ─── Display section ───────────────────────────────────────────────────────────

test.describe('Display settings', () => {
  test('time-format select has 12h and 24h options', async () => {
    const page = await openOptions();
    await expect(page.locator('#time-format option[value="12h"]')).toBeAttached();
    await expect(page.locator('#time-format option[value="24h"]')).toBeAttached();
    await page.close();
  });

  test('theme select has light and dark options', async () => {
    const page = await openOptions();
    await expect(page.locator('#theme-select option[value="light"]')).toBeAttached();
    await expect(page.locator('#theme-select option[value="dark"]')).toBeAttached();
    await page.close();
  });

  test('selecting dark theme sets data-theme="dark" on <html>', async () => {
    const page = await openOptions();
    await page.locator('#theme-select').selectOption('dark');
    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    );
    expect(theme).toBe('dark');
    await page.close();
  });

  test('selecting light theme sets data-theme="light" on <html>', async () => {
    const page = await openOptions();
    await page.locator('#theme-select').selectOption('dark');
    await page.locator('#theme-select').selectOption('light');
    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    );
    expect(theme).toBe('light');
    await page.close();
  });

  test('changing time format to 24h is reflected in select value', async () => {
    const page = await openOptions();
    await page.locator('#time-format').selectOption('24h');
    expect(await page.locator('#time-format').inputValue()).toBe('24h');
    await page.close();
  });
});

// ─── Notifications section ─────────────────────────────────────────────────────

test.describe('Notifications settings', () => {
  test('notifications toggle is a checkbox', async () => {
    const page = await openOptions();
    await expect(page.locator('#notif-toggle')).toBeAttached();
    const type = await page.locator('#notif-toggle').getAttribute('type');
    expect(type).toBe('checkbox');
    await page.close();
  });

  test('pre-warning options are hidden when notifications are off', async () => {
    const page = await openOptions();
    // Ensure notifications are off
    const checked = await page.locator('#notif-toggle').isChecked();
    if (checked) await page.locator('#notif-toggle').click();
    await expect(page.locator('#notif-options')).toHaveClass(/hidden/);
    await page.close();
  });

  test('enabling notifications reveals pre-warning options', async () => {
    const page = await openOptions();
    // Ensure off first
    if (await page.locator('#notif-toggle').isChecked()) {
      await page.locator('#notif-toggle').click();
    }
    await page.locator('#notif-toggle').click();
    await expect(page.locator('#notif-options')).not.toHaveClass(/hidden/);
    await page.close();
  });

  test('pre-warning input accepts numeric values', async () => {
    const page = await openOptions();
    if (!await page.locator('#notif-toggle').isChecked()) {
      await page.locator('#notif-toggle').click();
    }
    await page.locator('#pre-warning').fill('15');
    expect(await page.locator('#pre-warning').inputValue()).toBe('15');
    await page.close();
  });

  test('prayer mode toggle is a checkbox', async () => {
    const page = await openOptions();
    const type = await page.locator('#prayer-mode-toggle').getAttribute('type');
    expect(type).toBe('checkbox');
    await page.close();
  });
});

// ─── Location section ──────────────────────────────────────────────────────────

test.describe('Location settings', () => {
  test('location mode radio buttons exist (auto and manual)', async () => {
    const page = await openOptions();
    await expect(page.locator('input[name="loc-mode"][value="auto"]')).toBeAttached();
    await expect(page.locator('input[name="loc-mode"][value="manual"]')).toBeAttached();
    await page.close();
  });

  test('auto section visible and manual section hidden by default', async () => {
    const page = await openOptions();
    // Clear settings so default "auto" mode is used
    await page.evaluate(() => chrome.storage.local.remove('settings'));
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#auto-section')).not.toHaveClass(/hidden/);
    await expect(page.locator('#manual-section')).toHaveClass(/hidden/);
    await page.close();
  });

  test('selecting manual mode shows manual section', async () => {
    const page = await openOptions();
    await page.locator('input[name="loc-mode"][value="manual"]').click();
    await expect(page.locator('#manual-section')).not.toHaveClass(/hidden/);
    await page.close();
  });

  test('detect button is visible in auto section', async () => {
    const page = await openOptions();
    await page.locator('input[name="loc-mode"][value="auto"]').click();
    await expect(page.locator('#detect-btn')).toBeVisible();
    await page.close();
  });

  test('current location label shows when location is saved', async () => {
    const page = await openOptions();
    await page.evaluate(() =>
      chrome.storage.local.set({
        location: { latitude: 30.0444, longitude: 31.2357, timezone: 2, label: 'Cairo, Egypt' },
      }),
    );
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    const label = await page.locator('#current-loc-label').textContent();
    expect(label).toBe('Cairo, Egypt');
    await page.close();
  });
});

// ─── Prayer tracker section ────────────────────────────────────────────────────

test.describe('Prayer tracker section', () => {
  test('tracker-today grid renders 5 prayer cells', async () => {
    const page = await openOptions();
    await page.waitForTimeout(500); // allow async renderTracker to run
    const cells = page.locator('#tracker-today .tracker-cell');
    await expect(cells).toHaveCount(5);
    await page.close();
  });

  test('weekly tracker shows 7 rows', async () => {
    const page = await openOptions();
    await page.waitForTimeout(500);
    const rows = page.locator('#tracker-week .week-row');
    await expect(rows).toHaveCount(7);
    await page.close();
  });

  test('clicking a tracker cell status icon toggles it', async () => {
    const page = await openOptions();
    await page.evaluate(() => chrome.storage.local.remove('prayerTracker'));
    await page.reload();
    await page.waitForTimeout(600);
    const firstIcon = page.locator('#tracker-today .status-icon').first();
    const before = await firstIcon.textContent();
    await firstIcon.click();
    const after = await firstIcon.textContent();
    expect(after).not.toBe(before);
    await page.close();
  });
});

// ─── Save settings ─────────────────────────────────────────────────────────────

test.describe('Save settings', () => {
  test('clicking save shows confirmation message', async () => {
    const page = await openOptions();
    await page.locator('#save-btn').click();
    // Wait for status message to appear
    await expect(page.locator('#save-status')).toContainText('saved', { timeout: 3000 });
    await page.close();
  });

  test('settings are persisted after save (method)', async () => {
    const page = await openOptions();
    await page.locator('#method-select').selectOption('Karachi');
    await page.locator('#save-btn').click();
    await page.waitForTimeout(500);

    // Re-open the page and check
    const page2 = await openOptions();
    const value = await page2.locator('#method-select').inputValue();
    expect(value).toBe('Karachi');
    // Reset back to MWL
    await page2.locator('#method-select').selectOption('MWL');
    await page2.locator('#save-btn').click();
    await page.close();
    await page2.close();
  });

  test('settings are persisted after save (time format)', async () => {
    const page = await openOptions();
    await page.locator('#time-format').selectOption('24h');
    await page.locator('#save-btn').click();
    await page.waitForTimeout(500);

    const page2 = await openOptions();
    const value = await page2.locator('#time-format').inputValue();
    expect(value).toBe('24h');
    // Reset
    await page2.locator('#time-format').selectOption('12h');
    await page2.locator('#save-btn').click();
    await page.close();
    await page2.close();
  });
});
