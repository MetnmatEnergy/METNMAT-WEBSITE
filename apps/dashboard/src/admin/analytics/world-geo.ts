/**
 * Country centroids ([lat, lng]) keyed by the country NAMES ipinfo returns
 * (its "lite" tier is country-level), plus a plain equirectangular projection.
 * Pure data + math, no deps — the live map (world-map.tsx) plots session dots
 * at these centroids. Country-level is the honest ceiling of the free ipinfo
 * tier; a paid City plan would give true lat/lng and this table becomes a
 * fallback. Aliases cover naming variants so a lookup rarely misses.
 */

export const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  // South & Central Asia
  India: [22.0, 79.0],
  Pakistan: [30.0, 70.0],
  Bangladesh: [23.7, 90.3],
  "Sri Lanka": [7.9, 80.7],
  Nepal: [28.2, 84.0],
  Afghanistan: [33.9, 66.0],
  Kazakhstan: [48.0, 67.0],
  Uzbekistan: [41.4, 64.6],
  // East & Southeast Asia
  China: [35.9, 104.2],
  Japan: [36.2, 138.3],
  "South Korea": [36.5, 127.9],
  "North Korea": [40.3, 127.5],
  Taiwan: [23.7, 121.0],
  "Hong Kong": [22.35, 114.1],
  Mongolia: [46.9, 103.8],
  Vietnam: [16.0, 107.8],
  Thailand: [15.1, 101.0],
  Malaysia: [4.2, 101.98],
  Singapore: [1.35, 103.8],
  Indonesia: [-2.5, 118.0],
  Philippines: [12.9, 122.9],
  Myanmar: [21.9, 96.0],
  Cambodia: [12.6, 104.9],
  Laos: [19.9, 102.5],
  // Middle East
  "United Arab Emirates": [24.0, 54.0],
  "Saudi Arabia": [24.0, 45.0],
  Qatar: [25.3, 51.2],
  Kuwait: [29.3, 47.6],
  Bahrain: [26.0, 50.5],
  Oman: [21.5, 55.9],
  Israel: [31.4, 35.0],
  Jordan: [31.2, 36.5],
  Lebanon: [33.9, 35.9],
  Iraq: [33.0, 43.7],
  Iran: [32.4, 53.7],
  Turkey: [39.0, 35.2],
  Yemen: [15.6, 47.6],
  // Europe
  "United Kingdom": [54.0, -2.4],
  Ireland: [53.2, -8.0],
  France: [46.6, 2.4],
  Germany: [51.1, 10.4],
  Spain: [40.2, -3.7],
  Portugal: [39.6, -8.0],
  Italy: [42.8, 12.6],
  Netherlands: [52.2, 5.5],
  Belgium: [50.6, 4.6],
  Switzerland: [46.8, 8.2],
  Austria: [47.6, 14.1],
  Poland: [52.1, 19.4],
  Ukraine: [48.4, 31.2],
  Romania: [45.9, 24.9],
  Greece: [39.1, 22.9],
  Sweden: [62.2, 15.3],
  Norway: [64.6, 12.0],
  Finland: [64.5, 26.3],
  Denmark: [56.0, 9.5],
  "Czech Republic": [49.8, 15.5],
  Hungary: [47.2, 19.4],
  Bulgaria: [42.7, 25.2],
  Serbia: [44.0, 20.9],
  Croatia: [45.1, 15.5],
  Russia: [61.5, 90.0],
  Belarus: [53.5, 27.9],
  Iceland: [64.9, -18.6],
  Luxembourg: [49.8, 6.1],
  // Africa
  Egypt: [26.8, 30.8],
  Morocco: [31.8, -7.1],
  Algeria: [28.0, 2.6],
  Tunisia: [34.1, 9.6],
  Nigeria: [9.1, 8.7],
  Ghana: [7.9, -1.0],
  Kenya: [0.2, 37.9],
  Ethiopia: [9.1, 40.5],
  Tanzania: [-6.4, 34.9],
  Uganda: [1.4, 32.3],
  "South Africa": [-30.6, 22.9],
  Zimbabwe: [-19.0, 29.9],
  Zambia: [-13.1, 27.8],
  Angola: [-11.2, 17.9],
  Cameroon: [5.7, 12.7],
  "Ivory Coast": [7.5, -5.5],
  Senegal: [14.5, -14.5],
  // North & Central America
  "United States": [39.5, -98.35],
  Canada: [56.1, -106.3],
  Mexico: [23.6, -102.5],
  Guatemala: [15.8, -90.2],
  "Costa Rica": [9.7, -83.8],
  Panama: [8.4, -80.1],
  Cuba: [21.5, -79.5],
  "Dominican Republic": [18.7, -70.2],
  Jamaica: [18.1, -77.3],
  // South America
  Brazil: [-10.8, -52.9],
  Argentina: [-38.4, -63.6],
  Chile: [-35.7, -71.5],
  Colombia: [4.6, -74.3],
  Peru: [-9.2, -75.0],
  Venezuela: [6.4, -66.6],
  Ecuador: [-1.4, -78.2],
  Bolivia: [-16.3, -63.6],
  Uruguay: [-32.5, -55.8],
  Paraguay: [-23.4, -58.4],
  // Oceania
  Australia: [-25.3, 133.8],
  "New Zealand": [-41.8, 172.9],
  Fiji: [-17.7, 178.0],
};

// Common naming aliases → canonical key (ipinfo/other providers vary).
const ALIASES: Record<string, string> = {
  "United States of America": "United States",
  USA: "United States",
  US: "United States",
  UK: "United Kingdom",
  "Great Britain": "United Kingdom",
  "Russian Federation": "Russia",
  "Korea, Republic of": "South Korea",
  "Republic of Korea": "South Korea",
  "Viet Nam": "Vietnam",
  "United Arab Emirates (UAE)": "United Arab Emirates",
  UAE: "United Arab Emirates",
  Czechia: "Czech Republic",
  "Côte d'Ivoire": "Ivory Coast",
  "Cote d'Ivoire": "Ivory Coast",
};

/** Look up a centroid by (possibly aliased) country name. */
export function centroidFor(country: string | undefined | null): [number, number] | undefined {
  if (!country) return undefined;
  return COUNTRY_CENTROIDS[country] ?? COUNTRY_CENTROIDS[ALIASES[country] ?? ""];
}

/** Equirectangular (Plate Carrée) projection of lat/lng into a W×H box. */
export function projectEquirect(lat: number, lng: number, w: number, h: number): [number, number] {
  const x = ((lng + 180) / 360) * w;
  const y = ((90 - lat) / 180) * h;
  return [x, y];
}
