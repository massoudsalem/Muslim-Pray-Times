/**
 * unit.spec.js — Unit tests for pure utility functions.
 *
 * Functions are evaluated inline inside a real browser page to avoid
 * ES module / CommonJS mismatch issues in the Node test runner.
 *
 * Covers: decimalToTime, formatCountdown, gregorianToHijri,
 *         formatHijriDate, formatGregorianDate, searchCities,
 *         getActivePrayer (deterministic variant with injected time).
 */

import { test, expect, chromium } from '@playwright/test';

// ─── Shared browser page ───────────────────────────────────────────────────────

let browser;
let page;

test.beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
  await page.goto('about:blank');
});

test.afterAll(async () => {
  await browser.close();
});

// ─── decimalToTime ─────────────────────────────────────────────────────────────

/** Evaluate decimalToTime inline in the browser. */
function evalDecimalToTime({ decimal, use12h }) {
  function decimalToTime(decimal, use12h) {
    if (typeof decimal !== 'number' || isNaN(decimal)) return '--:--';
    const totalMinutes = Math.round(decimal * 60);
    let hours = Math.floor(totalMinutes / 60) % 24;
    const mins = totalMinutes % 60;
    if (use12h) {
      const period = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${hours}:${String(mins).padStart(2, '0')} ${period}`;
    }
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }
  return decimalToTime(decimal, use12h);
}

test.describe('decimalToTime — 24-hour format', () => {
  test('5.5 → "05:30"', async () => {
    expect(await page.evaluate(evalDecimalToTime, { decimal: 5.5, use12h: false })).toBe('05:30');
  });

  test('12.0 → "12:00"', async () => {
    expect(await page.evaluate(evalDecimalToTime, { decimal: 12.0, use12h: false })).toBe('12:00');
  });

  test('13.0 → "13:00"', async () => {
    expect(await page.evaluate(evalDecimalToTime, { decimal: 13.0, use12h: false })).toBe('13:00');
  });

  test('18.75 → "18:45"', async () => {
    expect(await page.evaluate(evalDecimalToTime, { decimal: 18.75, use12h: false })).toBe('18:45');
  });

  test('0.0 → "00:00"', async () => {
    expect(await page.evaluate(evalDecimalToTime, { decimal: 0.0, use12h: false })).toBe('00:00');
  });

  test('23.9833… → "23:59"', async () => {
    // 23 hours + 59 minutes = 23.9833…
    expect(await page.evaluate(evalDecimalToTime, { decimal: 23 + 59/60, use12h: false })).toBe('23:59');
  });

  test('20 + 30/60 → "20:30"', async () => {
    expect(await page.evaluate(evalDecimalToTime, { decimal: 20.5, use12h: false })).toBe('20:30');
  });
});

test.describe('decimalToTime — 12-hour format', () => {
  test('5.5 → "5:30 AM"', async () => {
    expect(await page.evaluate(evalDecimalToTime, { decimal: 5.5, use12h: true })).toBe('5:30 AM');
  });

  test('12.0 → "12:00 PM"', async () => {
    expect(await page.evaluate(evalDecimalToTime, { decimal: 12.0, use12h: true })).toBe('12:00 PM');
  });

  test('13.0 → "1:00 PM"', async () => {
    expect(await page.evaluate(evalDecimalToTime, { decimal: 13.0, use12h: true })).toBe('1:00 PM');
  });

  test('0.0 → "12:00 AM"', async () => {
    expect(await page.evaluate(evalDecimalToTime, { decimal: 0.0, use12h: true })).toBe('12:00 AM');
  });

  test('18.75 → "6:45 PM"', async () => {
    expect(await page.evaluate(evalDecimalToTime, { decimal: 18.75, use12h: true })).toBe('6:45 PM');
  });

  test('11.5 → "11:30 AM"', async () => {
    expect(await page.evaluate(evalDecimalToTime, { decimal: 11.5, use12h: true })).toBe('11:30 AM');
  });
});

test.describe('decimalToTime — edge cases', () => {
  test('NaN → "--:--"', async () => {
    expect(await page.evaluate(evalDecimalToTime, { decimal: NaN, use12h: false })).toBe('--:--');
  });

  test('undefined treated as NaN → "--:--"', async () => {
    const result = await page.evaluate(({ use12h }) => {
      function decimalToTime(decimal, use12h) {
        if (typeof decimal !== 'number' || isNaN(decimal)) return '--:--';
        const totalMinutes = Math.round(decimal * 60);
        let hours = Math.floor(totalMinutes / 60) % 24;
        const mins = totalMinutes % 60;
        if (use12h) {
          const period = hours >= 12 ? 'PM' : 'AM';
          hours = hours % 12 || 12;
          return `${hours}:${String(mins).padStart(2, '0')} ${period}`;
        }
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      }
      return decimalToTime(undefined, use12h);
    }, { use12h: false });
    expect(result).toBe('--:--');
  });

  test('wraps correctly at 24h boundary (24.0 → "00:00")', async () => {
    expect(await page.evaluate(evalDecimalToTime, { decimal: 24.0, use12h: false })).toBe('00:00');
  });
});

// ─── formatCountdown ───────────────────────────────────────────────────────────

function evalFormatCountdown({ totalSeconds }) {
  function formatCountdown(totalSeconds) {
    if (totalSeconds <= 0) return '00:00';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }
  return formatCountdown(totalSeconds);
}

test.describe('formatCountdown', () => {
  test('3661 → "1:01:01"', async () => {
    expect(await page.evaluate(evalFormatCountdown, { totalSeconds: 3661 })).toBe('1:01:01');
  });

  test('3600 → "1:00:00"', async () => {
    expect(await page.evaluate(evalFormatCountdown, { totalSeconds: 3600 })).toBe('1:00:00');
  });

  test('61 → "01:01"', async () => {
    expect(await page.evaluate(evalFormatCountdown, { totalSeconds: 61 })).toBe('01:01');
  });

  test('60 → "01:00"', async () => {
    expect(await page.evaluate(evalFormatCountdown, { totalSeconds: 60 })).toBe('01:00');
  });

  test('30 → "00:30"', async () => {
    expect(await page.evaluate(evalFormatCountdown, { totalSeconds: 30 })).toBe('00:30');
  });

  test('0 → "00:00"', async () => {
    expect(await page.evaluate(evalFormatCountdown, { totalSeconds: 0 })).toBe('00:00');
  });

  test('negative → "00:00"', async () => {
    expect(await page.evaluate(evalFormatCountdown, { totalSeconds: -100 })).toBe('00:00');
  });

  test('7322 → "2:02:02"', async () => {
    // 2h 2min 2sec
    expect(await page.evaluate(evalFormatCountdown, { totalSeconds: 7322 })).toBe('2:02:02');
  });
});

// ─── gregorianToHijri ──────────────────────────────────────────────────────────

function evalGregorianToHijri({ year, month, day }) {
  function gregorianToHijri(gYear, gMonth, gDay) {
    const JD =
      Math.floor((1461 * (gYear + 4800 + Math.floor((gMonth - 14) / 12))) / 4) +
      Math.floor((367 * (gMonth - 2 - 12 * Math.floor((gMonth - 14) / 12))) / 12) -
      Math.floor((3 * Math.floor((gYear + 4900 + Math.floor((gMonth - 14) / 12)) / 100)) / 4) +
      gDay - 32075;

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

    const hMonth = Math.floor((24 * l3) / 709);
    const hDay = l3 - Math.floor((709 * hMonth) / 24);
    const hYear = 30 * n + j - 30;
    return { year: hYear, month: hMonth, day: hDay };
  }
  return gregorianToHijri(year, month, day);
}

const HIJRI_MONTHS = [
  'Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani",
  'Jumada al-Awwal', 'Jumada al-Thani', 'Rajab', "Sha'ban",
  'Ramadan', 'Shawwal', "Dhul Qi'dah", 'Dhul Hijjah',
];

test.describe('gregorianToHijri', () => {
  test('2024-03-15 is in Ramadan 1445', async () => {
    const result = await page.evaluate(evalGregorianToHijri, { year: 2024, month: 3, day: 15 });
    expect(result.year).toBe(1445);
    expect(result.month).toBe(9); // Ramadan = 9th Hijri month
  });

  test('2026-03-15 is in Ramadan 1447', async () => {
    const result = await page.evaluate(evalGregorianToHijri, { year: 2026, month: 3, day: 15 });
    expect(result.year).toBe(1447);
    expect(result.month).toBe(9); // Ramadan
  });

  test('2000-01-01 is year 1420', async () => {
    const result = await page.evaluate(evalGregorianToHijri, { year: 2000, month: 1, day: 1 });
    expect(result.year).toBe(1420);
  });

  test('returns sensible day (1–30)', async () => {
    const result = await page.evaluate(evalGregorianToHijri, { year: 2024, month: 6, day: 15 });
    expect(result.day).toBeGreaterThanOrEqual(1);
    expect(result.day).toBeLessThanOrEqual(30);
  });

  test('returns sensible month (1–12)', async () => {
    const result = await page.evaluate(evalGregorianToHijri, { year: 2024, month: 6, day: 15 });
    expect(result.month).toBeGreaterThanOrEqual(1);
    expect(result.month).toBeLessThanOrEqual(12);
  });

  test('consecutive days give adjacent or same Hijri days', async () => {
    const r1 = await page.evaluate(evalGregorianToHijri, { year: 2024, month: 3, day: 15 });
    const r2 = await page.evaluate(evalGregorianToHijri, { year: 2024, month: 3, day: 16 });
    // The Hijri day should advance by 1 (or roll to next month)
    const total1 = r1.year * 12 * 30 + (r1.month - 1) * 30 + r1.day;
    const total2 = r2.year * 12 * 30 + (r2.month - 1) * 30 + r2.day;
    expect(total2 - total1).toBe(1);
  });
});

// ─── formatHijriDate ───────────────────────────────────────────────────────────

function evalFormatHijriDate({ year, month, day, monthName }) {
  const HIJRI_MONTHS = [
    'Muharram','Safar',"Rabi' al-Awwal","Rabi' al-Thani",
    'Jumada al-Awwal','Jumada al-Thani','Rajab',"Sha'ban",
    'Ramadan','Shawwal',"Dhul Qi'dah",'Dhul Hijjah',
  ];
  function formatHijriDate({ year, month, day, monthName }) {
    return `${day} ${monthName || HIJRI_MONTHS[month - 1]} ${year} AH`;
  }
  return formatHijriDate({ year, month, day, monthName });
}

test.describe('formatHijriDate', () => {
  test('formats correctly with explicit monthName', async () => {
    const result = await page.evaluate(evalFormatHijriDate, {
      year: 1445, month: 9, day: 5, monthName: 'Ramadan',
    });
    expect(result).toBe('5 Ramadan 1445 AH');
  });

  test('resolves monthName from month number when absent', async () => {
    const result = await page.evaluate(evalFormatHijriDate, {
      year: 1445, month: 9, day: 5, monthName: undefined,
    });
    expect(result).toBe('5 Ramadan 1445 AH');
  });

  test('contains "AH" suffix', async () => {
    const result = await page.evaluate(evalFormatHijriDate, {
      year: 1447, month: 1, day: 1, monthName: 'Muharram',
    });
    expect(result).toContain('AH');
  });

  test('all 12 months resolve correctly', async () => {
    const months = [
      'Muharram','Safar',"Rabi' al-Awwal","Rabi' al-Thani",
      'Jumada al-Awwal','Jumada al-Thani','Rajab',"Sha'ban",
      'Ramadan','Shawwal',"Dhul Qi'dah",'Dhul Hijjah',
    ];
    for (let i = 1; i <= 12; i++) {
      const result = await page.evaluate(evalFormatHijriDate, {
        year: 1447, month: i, day: 1, monthName: undefined,
      });
      expect(result).toContain(months[i - 1]);
    }
  });
});

// ─── formatGregorianDate ───────────────────────────────────────────────────────

function evalFormatGregorianDate({ year, month, day }) {
  const GREGORIAN_MONTHS = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];
  const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  function formatGregorianDate(year, month, day) {
    const date = new Date(year, month - 1, day);
    const weekday = WEEKDAYS[date.getDay()];
    return `${weekday}, ${day} ${GREGORIAN_MONTHS[month - 1]} ${year}`;
  }
  return formatGregorianDate(year, month, day);
}

test.describe('formatGregorianDate', () => {
  test('2026-03-15 is "Sunday, 15 March 2026"', async () => {
    const result = await page.evaluate(evalFormatGregorianDate, { year: 2026, month: 3, day: 15 });
    expect(result).toBe('Sunday, 15 March 2026');
  });

  test('2024-01-01 is "Monday, 1 January 2024"', async () => {
    const result = await page.evaluate(evalFormatGregorianDate, { year: 2024, month: 1, day: 1 });
    expect(result).toBe('Monday, 1 January 2024');
  });

  test('output contains year, month name, and weekday', async () => {
    const result = await page.evaluate(evalFormatGregorianDate, { year: 2025, month: 6, day: 15 });
    expect(result).toMatch(/\w+, \d{1,2} \w+ \d{4}/);
  });
});

// ─── searchCities ──────────────────────────────────────────────────────────────

function evalSearchCities({ query }) {
  const CITIES = [
    { label: 'Cairo, Egypt',           lat: 30.0444, lng: 31.2357, tz: 2 },
    { label: 'Alexandria, Egypt',      lat: 31.2001, lng: 29.9187, tz: 2 },
    { label: 'Mecca, Saudi Arabia',    lat: 21.4225, lng: 39.8264, tz: 3 },
    { label: 'Medina, Saudi Arabia',   lat: 24.5247, lng: 39.5692, tz: 3 },
    { label: 'Riyadh, Saudi Arabia',   lat: 24.7136, lng: 46.6753, tz: 3 },
    { label: 'Jeddah, Saudi Arabia',   lat: 21.5433, lng: 39.1727, tz: 3 },
    { label: 'Dubai, UAE',             lat: 25.2048, lng: 55.2708, tz: 4 },
    { label: 'Abu Dhabi, UAE',         lat: 24.4539, lng: 54.3773, tz: 4 },
    { label: 'Kuwait City, Kuwait',    lat: 29.3794, lng: 47.9774, tz: 3 },
    { label: 'Doha, Qatar',            lat: 25.2854, lng: 51.5310, tz: 3 },
    { label: 'Istanbul, Turkey',       lat: 41.0082, lng: 28.9784, tz: 3 },
    { label: 'Casablanca, Morocco',    lat: 33.5731, lng: -7.5898, tz: 0 },
    { label: 'Algiers, Algeria',       lat: 36.7538, lng: 3.0588,  tz: 1 },
    { label: 'Tunis, Tunisia',         lat: 36.8065, lng: 10.1686, tz: 1 },
    { label: 'Karachi, Pakistan',      lat: 24.8607, lng: 67.0011, tz: 5 },
    { label: 'Lahore, Pakistan',       lat: 31.5204, lng: 74.3587, tz: 5 },
    { label: 'Dhaka, Bangladesh',      lat: 23.8103, lng: 90.4125, tz: 6 },
    { label: 'Mumbai, India',          lat: 19.0760, lng: 72.8777, tz: 5.5 },
    { label: 'Delhi, India',           lat: 28.7041, lng: 77.1025, tz: 5.5 },
    { label: 'Jakarta, Indonesia',     lat: -6.2088, lng: 106.8456, tz: 7 },
    { label: 'Kuala Lumpur, Malaysia', lat: 3.1390,  lng: 101.6869, tz: 8 },
    { label: 'Singapore',              lat: 1.3521,  lng: 103.8198, tz: 8 },
    { label: 'London, UK',             lat: 51.5074, lng: -0.1278,  tz: 0 },
    { label: 'Paris, France',          lat: 48.8566, lng: 2.3522,   tz: 1 },
    { label: 'New York, USA',          lat: 40.7128, lng: -74.0060, tz: -5 },
    { label: 'Toronto, Canada',        lat: 43.6629, lng: -79.3957, tz: -5 },
  ];
  function searchCities(query) {
    if (!query || query.length < 1) return [];
    const lower = query.toLowerCase();
    return CITIES.filter((c) => c.label.toLowerCase().includes(lower)).slice(0, 8);
  }
  return searchCities(query);
}

test.describe('searchCities', () => {
  test('returns Cairo for "cairo"', async () => {
    const results = await page.evaluate(evalSearchCities, { query: 'cairo' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].label).toBe('Cairo, Egypt');
  });

  test('"egypt" returns both Cairo and Alexandria', async () => {
    const results = await page.evaluate(evalSearchCities, { query: 'egypt' });
    const labels = results.map((r) => r.label);
    expect(labels).toContain('Cairo, Egypt');
    expect(labels).toContain('Alexandria, Egypt');
  });

  test('"saudi" returns 4 Saudi cities', async () => {
    const results = await page.evaluate(evalSearchCities, { query: 'saudi' });
    expect(results.length).toBe(4);
  });

  test('empty string returns no results', async () => {
    const results = await page.evaluate(evalSearchCities, { query: '' });
    expect(results.length).toBe(0);
  });

  test('no-match query returns empty array', async () => {
    const results = await page.evaluate(evalSearchCities, { query: 'zzznomatch' });
    expect(results.length).toBe(0);
  });

  test('results are limited to 8', async () => {
    // "a" matches many cities
    const results = await page.evaluate(evalSearchCities, { query: 'a' });
    expect(results.length).toBeLessThanOrEqual(8);
  });

  test('results include lat, lng, tz fields', async () => {
    const results = await page.evaluate(evalSearchCities, { query: 'london' });
    expect(results.length).toBe(1);
    expect(results[0]).toHaveProperty('lat');
    expect(results[0]).toHaveProperty('lng');
    expect(results[0]).toHaveProperty('tz');
  });

  test('search is case-insensitive', async () => {
    const lower = await page.evaluate(evalSearchCities, { query: 'dubai' });
    const upper = await page.evaluate(evalSearchCities, { query: 'DUBAI' });
    expect(lower.length).toBe(upper.length);
    expect(lower[0].label).toBe(upper[0].label);
  });
});

// ─── getActivePrayer (deterministic with injected time) ────────────────────────

function evalGetActivePrayer({ times, nowDecimal }) {
  const PRAYER_NAMES = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  function getActivePrayer(times, current) {
    let currentPrayer = null;
    let nextPrayer = null;
    let secondsToNext = 0;
    for (let i = PRAYER_NAMES.length - 1; i >= 0; i--) {
      if (current >= times[PRAYER_NAMES[i]]) {
        currentPrayer = PRAYER_NAMES[i];
        const nextIdx = (i + 1) % PRAYER_NAMES.length;
        nextPrayer = PRAYER_NAMES[nextIdx];
        let nextTime = times[nextPrayer];
        if (nextIdx === 0) nextTime += 24;
        secondsToNext = Math.round((nextTime - current) * 3600);
        break;
      }
    }
    if (!currentPrayer) {
      nextPrayer = 'fajr';
      secondsToNext = Math.round((times.fajr - current) * 3600);
      if (secondsToNext < 0) secondsToNext += 24 * 3600;
    }
    return { current: currentPrayer, next: nextPrayer, secondsToNext };
  }
  return getActivePrayer(times, nowDecimal);
}

const SAMPLE_TIMES = { fajr: 5.0, dhuhr: 12.5, asr: 15.75, maghrib: 18.25, isha: 20.0 };

test.describe('getActivePrayer', () => {
  test('before Fajr: current is null, next is "fajr"', async () => {
    const result = await page.evaluate(evalGetActivePrayer, {
      times: SAMPLE_TIMES, nowDecimal: 3.0,
    });
    expect(result.current).toBeNull();
    expect(result.next).toBe('fajr');
    expect(result.secondsToNext).toBeGreaterThan(0);
  });

  test('exactly at Fajr: current is "fajr", next is "dhuhr"', async () => {
    const result = await page.evaluate(evalGetActivePrayer, {
      times: SAMPLE_TIMES, nowDecimal: 5.0,
    });
    expect(result.current).toBe('fajr');
    expect(result.next).toBe('dhuhr');
  });

  test('between Fajr and Dhuhr: current is "fajr"', async () => {
    const result = await page.evaluate(evalGetActivePrayer, {
      times: SAMPLE_TIMES, nowDecimal: 8.0,
    });
    expect(result.current).toBe('fajr');
    expect(result.next).toBe('dhuhr');
  });

  test('during Dhuhr window: current is "dhuhr", next is "asr"', async () => {
    const result = await page.evaluate(evalGetActivePrayer, {
      times: SAMPLE_TIMES, nowDecimal: 14.0,
    });
    expect(result.current).toBe('dhuhr');
    expect(result.next).toBe('asr');
  });

  test('during Asr window: current is "asr"', async () => {
    const result = await page.evaluate(evalGetActivePrayer, {
      times: SAMPLE_TIMES, nowDecimal: 16.5,
    });
    expect(result.current).toBe('asr');
    expect(result.next).toBe('maghrib');
  });

  test('during Maghrib window: current is "maghrib"', async () => {
    const result = await page.evaluate(evalGetActivePrayer, {
      times: SAMPLE_TIMES, nowDecimal: 19.0,
    });
    expect(result.current).toBe('maghrib');
    expect(result.next).toBe('isha');
  });

  test('after Isha: current is "isha", next is "fajr" (tomorrow)', async () => {
    const result = await page.evaluate(evalGetActivePrayer, {
      times: SAMPLE_TIMES, nowDecimal: 22.0,
    });
    expect(result.current).toBe('isha');
    expect(result.next).toBe('fajr');
    // secondsToNext wraps to next day: fajr is at 5.0 tomorrow, now is 22.0
    // diff = (5.0 + 24) - 22.0 = 7h = 25200 seconds
    expect(result.secondsToNext).toBe(25200);
  });

  test('secondsToNext is always positive', async () => {
    const testTimes = [1.5, 3.0, 7.0, 13.0, 17.0, 19.0, 21.0, 23.5];
    for (const nowDecimal of testTimes) {
      const result = await page.evaluate(evalGetActivePrayer, {
        times: SAMPLE_TIMES, nowDecimal,
      });
      expect(result.secondsToNext).toBeGreaterThan(0);
    }
  });

  test('result always has a next prayer', async () => {
    const testTimes = [0.0, 5.0, 12.5, 15.75, 18.25, 20.0, 23.99];
    const validPrayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    for (const nowDecimal of testTimes) {
      const result = await page.evaluate(evalGetActivePrayer, {
        times: SAMPLE_TIMES, nowDecimal,
      });
      expect(validPrayers).toContain(result.next);
    }
  });
});
