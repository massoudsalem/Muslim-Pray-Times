/**
 * locationService.js — Geolocation + city database
 */

import { setLocation } from '../utils/storage.js';

export async function detectGeolocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const tz = guessTimezone(latitude, longitude);
        const label = await reverseGeocode(latitude, longitude);
        const loc = { latitude, longitude, timezone: tz, label };
        await setLocation(loc);
        resolve(loc);
      },
      (err) => {
        reject(new Error(`Geolocation failed: ${err.message}`));
      },
      { timeout: 10000, enableHighAccuracy: false },
    );
  });
}

export async function saveManualLocation(location) {
  await setLocation(location);
  return location;
}

const CITIES = [
  { label: 'Cairo, Egypt',          lat: 30.0444, lng: 31.2357, tz: 2 },
  { label: 'Alexandria, Egypt',    lat: 31.2001, lng: 29.9187, tz: 2 },
  { label: 'Mecca, Saudi Arabia',   lat: 21.4225, lng: 39.8264, tz: 3 },
  { label: 'Medina, Saudi Arabia',  lat: 24.5247, lng: 39.5692, tz: 3 },
  { label: 'Riyadh, Saudi Arabia',  lat: 24.7136, lng: 46.6753, tz: 3 },
  { label: 'Jeddah, Saudi Arabia',  lat: 21.5433, lng: 39.1727, tz: 3 },
  { label: 'Dubai, UAE',            lat: 25.2048, lng: 55.2708, tz: 4 },
  { label: 'Abu Dhabi, UAE',        lat: 24.4539, lng: 54.3773, tz: 4 },
  { label: 'Kuwait City, Kuwait',   lat: 29.3794, lng: 47.9774, tz: 3 },
  { label: 'Doha, Qatar',           lat: 25.2854, lng: 51.5310, tz: 3 },
  { label: 'Istanbul, Turkey',      lat: 41.0082, lng: 28.9784, tz: 3 },
  { label: 'Casablanca, Morocco',   lat: 33.5731, lng: -7.5898, tz: 0 },
  { label: 'Algiers, Algeria',      lat: 36.7538, lng: 3.0588, tz: 1 },
  { label: 'Tunis, Tunisia',        lat: 36.8065, lng: 10.1686, tz: 1 },
  { label: 'Karachi, Pakistan',     lat: 24.8607, lng: 67.0011, tz: 5 },
  { label: 'Lahore, Pakistan',      lat: 31.5204, lng: 74.3587, tz: 5 },
  { label: 'Dhaka, Bangladesh',     lat: 23.8103, lng: 90.4125, tz: 6 },
  { label: 'Mumbai, India',         lat: 19.0760, lng: 72.8777, tz: 5.5 },
  { label: 'Delhi, India',          lat: 28.7041, lng: 77.1025, tz: 5.5 },
  { label: 'Jakarta, Indonesia',    lat: -6.2088, lng: 106.8456, tz: 7 },
  { label: 'Kuala Lumpur, Malaysia',lat: 3.1390, lng: 101.6869, tz: 8 },
  { label: 'Singapore',             lat: 1.3521, lng: 103.8198, tz: 8 },
  { label: 'London, UK',            lat: 51.5074, lng: -0.1278, tz: 0 },
  { label: 'Paris, France',         lat: 48.8566, lng: 2.3522, tz: 1 },
  { label: 'New York, USA',         lat: 40.7128, lng: -74.0060, tz: -5 },
  { label: 'Toronto, Canada',       lat: 43.6629, lng: -79.3957, tz: -5 },
];

export function searchCities(query) {
  if (!query || query.length < 1) return [];
  const lower = query.toLowerCase();
  return CITIES.filter((city) => city.label.toLowerCase().includes(lower)).slice(0, 8);
}

function guessTimezone(lat, lng) {
  for (const city of CITIES) {
    if (Math.abs(city.lat - lat) < 0.5 && Math.abs(city.lng - lng) < 0.5) {
      return city.tz;
    }
  }
  return Math.round((lng / 15) * 4) / 4;
}

async function reverseGeocode(lat, lng) {
  let closest = CITIES[0];
  let minDist = Infinity;
  for (const city of CITIES) {
    const dist = Math.hypot(city.lat - lat, city.lng - lng);
    if (dist < minDist) {
      minDist = dist;
      closest = city;
    }
  }
  return closest.label;
}
