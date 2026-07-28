import { find as geoTzFind } from "geo-tz";
import { DateTime } from "luxon";
import * as Astronomy from "astronomy-engine";

const SIGNS = [
  "Áries", "Touro", "Gêmeos", "Câncer", "Leão", "Virgem",
  "Libra", "Escorpião", "Sagitário", "Capricórnio", "Aquário", "Peixes",
];

const D2R = Math.PI / 180;

function norm(d: number): number {
  return ((d % 360) + 360) % 360;
}

function signOf(lon: number) {
  const n = norm(lon);
  const si = Math.floor(n / 30);
  const pos = n - si * 30;
  return { sign: SIGNS[si], degree: pos };
}

async function geocode(place: string): Promise<{ lat: number; lon: number }> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place)}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Assence-Astro/1.0 (astrological birth chart)" },
  });
  if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!data.length) throw new Error(`Local não encontrado: ${place}`);
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

// ──────────────────────────────────────────────
// Planet positions via astronomy-engine (DE421)
// ──────────────────────────────────────────────

type AstroBody =
  | "Sun" | "Moon" | "Mercury" | "Venus" | "Mars"
  | "Jupiter" | "Saturn" | "Uranus" | "Neptune" | "Pluto";

function geoEclipticLon(body: AstroBody, date: Date): number {
  if (body === "Moon") {
    const sph = Astronomy.EclipticGeoMoon(date);
    return norm(sph.lon);
  }
  const vec = Astronomy.GeoVector(body as unknown as Astronomy.Body, date, true);
  const ec = Astronomy.Ecliptic(vec);
  return norm(ec.elon);
}

function isRetrograde(body: AstroBody, date: Date): boolean {
  if (body === "Moon" || body === "Sun") return false;
  const prev = new Date(date.valueOf() - 12 * 3600 * 1000);
  const next = new Date(date.valueOf() + 12 * 3600 * 1000);
  let delta = geoEclipticLon(body, next) - geoEclipticLon(body, prev);
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta < 0;
}

// ──────────────────────────────────────────────
// North Node & Lilith (mean Black Moon Lilith)
// These bodies are not in DE421 — use analytical formulas.
// ──────────────────────────────────────────────

function toJD(y: number, m: number, d: number, h: number, mn: number): number {
  if (m <= 2) { y--; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) +
         Math.floor(30.6001 * (m + 1)) +
         d + (h + mn / 60) / 24 + B - 1524.5;
}

function northNodeLon(jd: number): number {
  const T = (jd - 2451545) / 36525;
  return norm(125.0445479 - 1934.1362608 * T + 0.0020762 * T * T);
}

/** Mean Black Moon Lilith (h13) — lunar apogee = mean perigee + 180° */
function lilithLon(jd: number): number {
  const T = (jd - 2451545) / 36525;
  // 83.3532430 + 4069.0137287*T is the mean PERIGEE longitude.
  // BML = lunar APOGEE = perigee + 180°.
  return norm(83.3532430 + 4069.0137287 * T - 0.0103200 * T * T - 0.00001249 * T * T * T + 180);
}

// ──────────────────────────────────────────────
// Quíron (2060 Chiron) — not in DE421
// Computed via Kepler's equation + geocentric correction
// Orbital elements J2000.0 (JPL approx.)
// ──────────────────────────────────────────────

function chironLon(jd: number, date: Date): number {
  const a  = 13.6485;       // semi-major axis (AU)
  const e  = 0.38017;       // eccentricity
  const iR = 6.9259 * D2R;  // inclination
  const OmR = 209.3795 * D2R; // longitude of ascending node
  const omR = 339.5568 * D2R; // argument of perihelion
  const T0  = 2450128.5;    // perihelion JD ≈ 1996-Feb-14
  const P   = 18539.3;      // period in days (~50.76 yr)

  // Mean anomaly
  const M = norm((jd - T0) / P * 360) * D2R;

  // Solve Kepler: E - e*sin(E) = M  (50 iterations → converges to 1e-12)
  let E = M;
  for (let k = 0; k < 50; k++) E = M + e * Math.sin(E);

  // True anomaly ν
  const nu = 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2)
  );

  // Heliocentric distance
  const r = a * (1 - e * Math.cos(E));

  // Heliocentric ecliptic rectangular (standard transformation)
  const cosOm = Math.cos(OmR), sinOm = Math.sin(OmR);
  const cosnu  = Math.cos(omR + nu), sinnu = Math.sin(omR + nu);
  const cosI   = Math.cos(iR),       sinI  = Math.sin(iR);

  const xh = r * (cosOm * cosnu - sinOm * sinnu * cosI);
  const yh = r * (sinOm * cosnu + cosOm * sinnu * cosI);
  const zh = r * sinnu * sinI;

  // Earth's heliocentric ecliptic position = −(geocentric Sun vector) rotated to ecliptic
  const sunVec = Astronomy.GeoVector(Astronomy.Body.Sun, date, false);
  const eps = obliquity(jd) * D2R;
  // rotate equatorial → ecliptic (rotation about x-axis by +eps)
  const ex =  -sunVec.x;
  const ey =  -sunVec.y * Math.cos(eps) - sunVec.z * Math.sin(eps);

  // Geocentric ecliptic longitude of Quíron
  return norm(Math.atan2(yh - ey, xh - ex) * (180 / Math.PI));
}

function isChironRetrograde(jd: number, date: Date): boolean {
  const prev = new Date(date.valueOf() - 12 * 3600 * 1000);
  const next = new Date(date.valueOf() + 12 * 3600 * 1000);
  const jdPrev = jd - 0.5;
  const jdNext = jd + 0.5;
  let delta = chironLon(jdNext, next) - chironLon(jdPrev, prev);
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta < 0;
}

// ──────────────────────────────────────────────
// Obliquity, GMST, Ascendant/MC
// ──────────────────────────────────────────────

function obliquity(jd: number): number {
  const T = (jd - 2451545) / 36525;
  return 23.439291111 - 0.013004167 * T - 0.000000164 * T * T + 0.000000504 * T * T * T;
}

function gmstDeg(jd: number): number {
  const T = (jd - 2451545) / 36525;
  return norm(280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * T * T - (T * T * T) / 38710000);
}

function calcAsc(ramc: number, eps: number, lat: number): number {
  const r = ramc * D2R, e = eps * D2R, l = lat * D2R;
  return norm(Math.atan2(Math.cos(r), -(Math.sin(r) * Math.cos(e) + Math.tan(l) * Math.sin(e))) * (180 / Math.PI));
}

function calcMC(ramc: number, eps: number): number {
  const r = ramc * D2R, e = eps * D2R;
  return norm(Math.atan2(Math.sin(r), Math.cos(r) * Math.cos(e)) * (180 / Math.PI));
}

// ──────────────────────────────────────────────
// Placidus house cusps
// ──────────────────────────────────────────────

function placidusHouseCusps(
  ramc: number,
  eps: number,
  lat: number,
  ascLon: number,
  mcLon: number
): number[] {
  const epsR = eps * D2R;
  const phiR = lat * D2R;

  if (Math.abs(lat) > 66) {
    return Array.from({ length: 12 }, (_, i) => norm(ascLon + i * 30));
  }

  function computeRA(lonDeg: number): number {
    const l = lonDeg * D2R;
    return norm(Math.atan2(Math.sin(l) * Math.cos(epsR), Math.cos(l)) * (180 / Math.PI));
  }

  function computeDSA(lonDeg: number): number {
    const l = lonDeg * D2R;
    const dec = Math.asin(Math.sin(l) * Math.sin(epsR));
    const t = Math.tan(dec) * Math.tan(phiR);
    if (t <= -1) return 180;
    if (t >= 1) return 0;
    return Math.acos(-t) * (180 / Math.PI);
  }

  function solve(k: number, C: number): number {
    let lon = norm(C + k * 90);
    for (let i = 0; i < 100; i++) {
      const ra  = computeRA(lon);
      const dsa = computeDSA(lon);
      const residual = norm(ra - k * dsa - C + 180) - 180;
      if (Math.abs(residual) < 1e-7) break;
      lon = norm(lon - residual);
    }
    return lon;
  }

  const h11 = solve(1 / 3, ramc);
  const h12 = solve(2 / 3, ramc);
  const h2  = solve(2 / 3, norm(ramc + 60));
  const h3  = solve(1 / 3, norm(ramc + 120));

  const icLon   = norm(mcLon  + 180);
  const descLon = norm(ascLon + 180);

  return [
    ascLon,          // H1
    h2,              // H2
    h3,              // H3
    icLon,           // H4
    norm(h11 + 180), // H5
    norm(h12 + 180), // H6
    descLon,         // H7
    norm(h2  + 180), // H8
    norm(h3  + 180), // H9
    mcLon,           // H10
    h11,             // H11
    h12,             // H12
  ];
}

function findHouse(lon: number, cusps: number[]): number {
  for (let i = 0; i < 12; i++) {
    const c1 = cusps[i];
    const c2 = cusps[(i + 1) % 12];
    const span = norm(c2 - c1);
    const d    = norm(lon - c1);
    if (d < span) return i + 1;
  }
  return 1;
}

// ──────────────────────────────────────────────
// Aspects
// ──────────────────────────────────────────────

const LUMINARIES = new Set(["Sol", "Lua"]);

const ASPECT_DEFS = [
  { type: "Conjunção",  angle: 0,   orbDefault: 10, orbLuminary: 12 },
  { type: "Oposição",   angle: 180, orbDefault: 10, orbLuminary: 12 },
  { type: "Trígono",    angle: 120, orbDefault: 8,  orbLuminary: 8  },
  { type: "Quadratura", angle: 90,  orbDefault: 8,  orbLuminary: 8  },
  { type: "Sextil",     angle: 60,  orbDefault: 6,  orbLuminary: 6  },
];

function calculateAspects(
  planets: Array<{ name: string; lon: number }>
): Array<{ planet1: string; planet2: string; type: string; orb: number }> {
  const aspects: Array<{ planet1: string; planet2: string; type: string; orb: number }> = [];

  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const p1 = planets[i];
      const p2 = planets[j];

      let sep = norm(p1.lon - p2.lon);
      if (sep > 180) sep = 360 - sep;

      const isLuminary = LUMINARIES.has(p1.name) || LUMINARIES.has(p2.name);

      for (const def of ASPECT_DEFS) {
        const maxOrb = isLuminary ? def.orbLuminary : def.orbDefault;
        const diff = Math.abs(sep - def.angle);
        if (diff <= maxOrb) {
          aspects.push({
            planet1: p1.name,
            planet2: p2.name,
            type: def.type,
            orb: Math.round(diff * 10) / 10,
          });
          break;
        }
      }
    }
  }

  return aspects;
}

// ──────────────────────────────────────────────
// Local time → UT conversion
// ──────────────────────────────────────────────

function localToUT(
  birthDate: string,
  birthTime: string | null | undefined,
  lat: number,
  lon: number,
  timezoneOverride?: string | null
): { utcDate: Date; tzName: string; utcOffsetMin: number } {
  const timePart = birthTime ?? "12:00";
  let tzName: string;
  if (timezoneOverride && timezoneOverride.trim().length > 0) {
    tzName = timezoneOverride.trim();
  } else {
    const timezones = geoTzFind(lat, lon);
    tzName = timezones[0] ?? "UTC";
  }

  const dt = DateTime.fromISO(`${birthDate}T${timePart}:00`, { zone: tzName });
  return {
    utcDate: dt.toUTC().toJSDate(),
    tzName,
    utcOffsetMin: dt.offset,
  };
}

// ──────────────────────────────────────────────
// Transit calculations
// ──────────────────────────────────────────────

const SIGN_INDEX: Record<string, number> = {
  "Áries": 0, "Touro": 1, "Gêmeos": 2, "Câncer": 3, "Leão": 4, "Virgem": 5,
  "Libra": 6, "Escorpião": 7, "Sagitário": 8, "Capricórnio": 9, "Aquário": 10, "Peixes": 11,
};

function natalLon(sign: string, degree: number): number {
  const idx = SIGN_INDEX[sign] ?? 0;
  return idx * 30 + degree;
}

function aspectAngle(lon1: number, lon2: number): number {
  const d = Math.abs(lon1 - lon2) % 360;
  return d > 180 ? 360 - d : d;
}

const TRANSIT_ASPECTS = [
  { type: "Conjunção", angle: 0 },
  { type: "Oposição", angle: 180 },
  { type: "Quadratura", angle: 90 },
  { type: "Trígono", angle: 120 },
  { type: "Sextil", angle: 60 },
];

const TRANSIT_ORB = 3;

export interface DailyTransitPlanet {
  name: string;
  sign: string;
  degree: number;
  retrograde: boolean;
}

export interface ClientTransit {
  readingId: number;
  clientName: string;
  transits: Array<{ transitPlanet: string; natalPlanet: string; type: string; orb: number }>;
  score: number;
}

export interface DailyTransitsResult {
  date: string;
  planets: DailyTransitPlanet[];
  activatedClients: ClientTransit[];
}

type NatalChartEntry = { sign?: string; degree?: number };

export function calculateTodayTransits(
  readings: Array<{ id: number; clientName: string; birthChart: unknown }>
): DailyTransitsResult {
  const now = new Date();
  const jd = toJD(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes());

  const PLANET_BODIES: Array<{ name: string; body: AstroBody }> = [
    { name: "Sol",      body: "Sun"     },
    { name: "Lua",      body: "Moon"    },
    { name: "Mercúrio", body: "Mercury" },
    { name: "Vênus",    body: "Venus"   },
    { name: "Marte",    body: "Mars"    },
    { name: "Júpiter",  body: "Jupiter" },
    { name: "Saturno",  body: "Saturn"  },
    { name: "Urano",    body: "Uranus"  },
    { name: "Netuno",   body: "Neptune" },
    { name: "Plutão",   body: "Pluto"   },
  ];

  const transitLons: Record<string, number> = {};
  const planets: DailyTransitPlanet[] = [];

  for (const { name, body } of PLANET_BODIES) {
    const lon = geoEclipticLon(body, now);
    transitLons[name] = lon;
    const { sign, degree } = signOf(lon);
    const rx = isRetrograde(body, now);
    planets.push({ name, sign, degree: Math.round(degree * 10) / 10, retrograde: rx });
  }

  // Add North Node (not in DE421)
  const nnLon = northNodeLon(jd);
  transitLons["Nodo Norte"] = nnLon;
  const { sign: nnSign, degree: nnDeg } = signOf(nnLon);
  planets.push({ name: "Nodo Norte", sign: nnSign, degree: Math.round(nnDeg * 10) / 10, retrograde: true });

  const NATAL_KEY_MAP: Record<string, string> = {
    sun: "Sol", moon: "Lua", mercury: "Mercúrio", venus: "Vênus",
    mars: "Marte", jupiter: "Júpiter", saturn: "Saturno",
    uranus: "Urano", neptune: "Netuno", pluto: "Plutão",
    chiron: "Quíron", northNode: "Nodo Norte", lilith: "Lilith",
  };

  const activatedClients: ClientTransit[] = [];

  for (const reading of readings) {
    const chart = reading.birthChart as Record<string, NatalChartEntry> | null;
    if (!chart || !chart.sun?.sign) continue;

    const clientTransits: ClientTransit["transits"] = [];

    for (const [tName, tLon] of Object.entries(transitLons)) {
      for (const [nKey, nLabel] of Object.entries(NATAL_KEY_MAP)) {
        const natal = chart[nKey];
        if (!natal?.sign || natal.degree === undefined) continue;
        const nLon = natalLon(natal.sign, natal.degree);
        const ang = aspectAngle(tLon, nLon);

        for (const asp of TRANSIT_ASPECTS) {
          const orb = Math.abs(ang - asp.angle);
          if (orb <= TRANSIT_ORB) {
            clientTransits.push({ transitPlanet: tName, natalPlanet: nLabel, type: asp.type, orb: Math.round(orb * 10) / 10 });
            break;
          }
        }
      }
    }

    if (clientTransits.length > 0) {
      clientTransits.sort((a, b) => a.orb - b.orb);
      activatedClients.push({
        readingId: reading.id,
        clientName: reading.clientName,
        transits: clientTransits.slice(0, 5),
        score: clientTransits.length,
      });
    }
  }

  activatedClients.sort((a, b) => b.score - a.score);

  return {
    date: now.toISOString().split("T")[0],
    planets,
    activatedClients: activatedClients.slice(0, 8),
  };
}

// ──────────────────────────────────────────────
// Main birth chart calculation
// ──────────────────────────────────────────────

export async function calculateBirthChart(
  birthDate: string,
  birthTime: string | null | undefined,
  birthPlace: string,
  timezoneOverride?: string | null
): Promise<Record<string, unknown>> {
  const coords = await geocode(birthPlace);
  const { lat, lon } = coords;

  const { utcDate, tzName, utcOffsetMin } = localToUT(birthDate, birthTime, lat, lon, timezoneOverride);

  // JD needed only for North Node and Lilith (not in DE421)
  const jd = toJD(
    utcDate.getUTCFullYear(),
    utcDate.getUTCMonth() + 1,
    utcDate.getUTCDate(),
    utcDate.getUTCHours(),
    utcDate.getUTCMinutes()
  );

  const eps  = obliquity(jd);
  const ramc = norm(gmstDeg(jd) + lon);
  const ascLon = calcAsc(ramc, eps, lat);
  const mcLon  = calcMC(ramc, eps);
  const cusps  = placidusHouseCusps(ramc, eps, lat, ascLon, mcLon);

  function planet(pLon: number, rx = false) {
    const { sign, degree } = signOf(pLon);
    return { sign, house: findHouse(pLon, cusps), degree, retrograde: rx };
  }

  // Geocentric ecliptic longitudes via DE421
  const sLon   = geoEclipticLon("Sun",     utcDate);
  const mLon   = geoEclipticLon("Moon",    utcDate);
  const merLon = geoEclipticLon("Mercury", utcDate);
  const venLon = geoEclipticLon("Venus",   utcDate);
  const marLon = geoEclipticLon("Mars",    utcDate);
  const jupLon = geoEclipticLon("Jupiter", utcDate);
  const satLon = geoEclipticLon("Saturn",  utcDate);
  const uraLon = geoEclipticLon("Uranus",  utcDate);
  const nepLon = geoEclipticLon("Neptune", utcDate);
  const pluLon = geoEclipticLon("Pluto",   utcDate);

  // North Node, Lilith and Quíron via analytical formulas
  const nnLon  = northNodeLon(jd);
  const snLon  = norm(nnLon + 180);
  const lilLon = lilithLon(jd);
  const chirLon = chironLon(jd, utcDate);

  const { sign: ascSign, degree: ascDeg } = signOf(ascLon);
  const { sign: mcSign }                  = signOf(mcLon);

  const houseCusps = cusps.map((cl, i) => {
    const { sign: cs, degree: cd } = signOf(cl);
    return { house: i + 1, sign: cs, degrees: Math.floor(cd), minutes: Math.round((cd % 1) * 60) };
  });

  const aspects = calculateAspects([
    { name: "Sol",        lon: sLon    },
    { name: "Lua",        lon: mLon    },
    { name: "Mercúrio",   lon: merLon  },
    { name: "Vênus",      lon: venLon  },
    { name: "Marte",      lon: marLon  },
    { name: "Júpiter",    lon: jupLon  },
    { name: "Saturno",    lon: satLon  },
    { name: "Urano",      lon: uraLon  },
    { name: "Netuno",     lon: nepLon  },
    { name: "Plutão",     lon: pluLon  },
    { name: "Quíron",     lon: chirLon },
    { name: "Nodo Norte", lon: nnLon   },
    { name: "Lilith",     lon: lilLon  },
  ]);

  return {
    ascendant: ascSign,
    ascendantDegree: Math.floor(ascDeg),
    ascendantMinutes: Math.round((ascDeg % 1) * 60),
    midheaven: mcSign,
    sun:      planet(sLon),
    moon:     planet(mLon),
    mercury:  planet(merLon, isRetrograde("Mercury", utcDate)),
    venus:    planet(venLon, isRetrograde("Venus",   utcDate)),
    mars:     planet(marLon, isRetrograde("Mars",    utcDate)),
    jupiter:  planet(jupLon, isRetrograde("Jupiter", utcDate)),
    saturn:   planet(satLon, isRetrograde("Saturn",  utcDate)),
    uranus:   planet(uraLon, isRetrograde("Uranus",  utcDate)),
    neptune:  planet(nepLon, isRetrograde("Neptune", utcDate)),
    pluto:    planet(pluLon, isRetrograde("Pluto",   utcDate)),
    chiron:   planet(chirLon, isChironRetrograde(jd, utcDate)),
    northNode: { ...planet(nnLon), retrograde: true },
    southNode: planet(snLon),
    lilith:   planet(lilLon),
    houseCusps,
    aspects,
    calculatedCoords: { lat, lon },
    timezone: { name: tzName, utcOffsetMin },
  };
}
