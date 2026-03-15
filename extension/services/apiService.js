export async function getPrayerTimesFromApi(lat, lng, methodMethod = "MWL") {
  // Method mapping based on prayerTimes.js METHODS to aladhan methods
  // Aladhan API Methods:
  // 1: University of Islamic Sciences, Karachi
  // 2: Islamic Society of North America (ISNA)
  // 3: Muslim World League (MWL)
  // 4: Umm Al-Qura University, Makkah
  // 5: Egyptian General Authority of Survey
  // 7: Institute of Geophysics, University of Tehran
  // 0: Shia Ithna-Ashari, Leva Institute, Qum
  
  const methodMap = {
    "MWL": 3,
    "ISNA": 2,
    "Egypt": 5,
    "Makkah": 4,
    "Karachi": 1,
    "Tehran": 7,
    "Jafari": 0
  };
  const aladhanMethod = methodMap[methodMethod] || 3;
  
  const d = new Date();
  const dateStr = `${d.getDate()}-${d.getMonth()+1}-${d.getFullYear()}`;
  const url = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${lat}&longitude=${lng}&method=${aladhanMethod}`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("API errored: " + res.status);
    const json = await res.json();
    const timings = json.data.timings;
    
    // Convert "15:30 (+02)" or "15:30" to decimal hour 15.5
    const parseTimeToDecimal = (timeStr) => {
      if (!timeStr) return 0;
      const match = timeStr.match(/^(\d{2}):(\d{2})/);
      if (!match) return 0;
      const hrs = parseInt(match[1], 10);
      const mins = parseInt(match[2], 10);
      return hrs + (mins / 60);
    };

    return {
      fajr: parseTimeToDecimal(timings.Fajr),
      sunrise: parseTimeToDecimal(timings.Sunrise),
      dhuhr: parseTimeToDecimal(timings.Dhuhr),
      asr: parseTimeToDecimal(timings.Asr),
      maghrib: parseTimeToDecimal(timings.Maghrib),
      isha: parseTimeToDecimal(timings.Isha),
      midnight: parseTimeToDecimal(timings.Midnight)
    };
  } catch (err) {
    console.error("Failed to fetch from Aladhan API", err);
    throw err;
  }
}
