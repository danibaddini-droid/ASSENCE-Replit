import { find as geoTzFind } from "geo-tz";
import { DateTime } from "luxon";

const SIGNS = [
  "Áries", "Touro", "Gêmeos", "Câncer", "Leão", "Virgem",
  "Libra", "Escorpião", "Sagitário", "Capricórnio", "Aquário", "Peixes",
];

const R2D = 180 / Math.PI;
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

function toJD(y: number, m: number, d: number, h: number, mn: number): number {
  if (m <= 2) { y--; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) +
         Math.floor(30.6001 * (m + 1)) +
         d + (h + mn / 60) / 24 + B - 1524.5;
}

function obliquity(jd: number): number {
  const T = (jd - 2451545) / 36525;
  return 23.439291111 - 0.013004167 * T - 0.000000164 * T * T + 0.000000504 * T * T * T;
}

function sunLon(jd: number): number {
  const T = (jd - 2451545) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = norm(357.52911 + 35999.05029 * T - 0.0001537 * T * T) * D2R;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M)
          + (0.019993 - 0.000101 * T) * Math.sin(2 * M)
          + 0.000289 * Math.sin(3 * M);
  const theta = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  return norm(theta - 0.00569 - 0.00478 * Math.sin(omega * D2R));
}

function moonLon(jd: number): number {
  const T  = (jd - 2451545) / 36525;
  const L0 = 218.3164477 + 481267.88123421 * T;
  const M  = norm(357.5291092  + 35999.0502909  * T) * D2R;
  const M1 = norm(134.9633964  + 477198.8675055 * T) * D2R;
  const D  = norm(297.8501921  + 445267.1114034 * T) * D2R;
  const F  = norm(93.2720950   + 483202.0175233 * T) * D2R;
  const E  = 1 - 0.002516 * T - 0.0000074 * T * T;
  return norm(L0
    + 6.288774 * Math.sin(M1)
    + 1.274027 * Math.sin(2 * D - M1)
    + 0.658314 * Math.sin(2 * D)
    + 0.213618 * Math.sin(2 * M1)
    - 0.185116 * E * Math.sin(M)
    - 0.114332 * Math.sin(2 * F)
    + 0.058793 * Math.sin(2 * D - 2 * M1)
    + 0.057066 * E * Math.sin(2 * D - M - M1)
    + 0.053322 * Math.sin(2 * D + M1)
    + 0.045758 * E * Math.sin(2 * D - M)
    - 0.040923 * E * Math.sin(M - M1)
    - 0.034720 * Math.sin(D)
    - 0.030383 * E * Math.sin(M + M1)
    + 0.015327 * Math.sin(2 * D - 2 * F)
    - 0.012528 * Math.sin(M1 + 2 * F)
    + 0.010980 * Math.sin(M1 - 2 * F)
    + 0.010675 * Math.sin(4 * D - M1)
    + 0.010034 * Math.sin(3 * M1)
    + 0.008548 * Math.sin(4 * D - 2 * M1)
    - 0.007888 * E * Math.sin(2 * D + M - M1)
    - 0.006766 * E * Math.sin(2 * D + M)
    - 0.005163 * Math.sin(D + M1)
    + 0.004987 * E * Math.sin(D + M)
    + 0.004036 * E * Math.sin(2 * D - M + M1)
    + 0.003994 * Math.sin(2 * D + 2 * M1)
    + 0.003861 * Math.sin(4 * D)
    + 0.003665 * Math.sin(2 * D - 3 * M1)
    - 0.002689 * E * Math.sin(M - 2 * M1)
    + 0.002390 * E * Math.sin(2 * D - M - 2 * M1)
    + 0.002236 * E * Math.sin(2 * D - 2 * M)
    - 0.002120 * E * Math.sin(M + 2 * M1)
    - 0.002069 * E * Math.sin(2 * M)
    + 0.001773 * Math.sin(2 * D + M1 - 2 * F)
    + 0.001215 * E * Math.sin(4 * D - M - M1)
    - 0.001110 * Math.sin(2 * M1 + 2 * F));
}

const KELP: Record<string, number[]> = {
  mercury: [0.38709927, 0.00000037, 0.20563593,  0.00001906,  7.00497902, -0.00594749, 252.25032350,149472.67411175,  77.45779628, 0.16047689,  48.33076593, -0.12534081],
  venus:   [0.72333566, 0.00000390, 0.00677672, -0.00004107,  3.39467605, -0.00078890, 181.97909950, 58517.81538729, 131.60246718, 0.00268329,  76.67984255, -0.27769418],
  mars:    [1.52371034, 0.00001847, 0.09339410,  0.00007882,  1.84969142, -0.00813131,  -4.55343205, 19140.30268499, -23.94362959, 0.44441088,  49.55953891, -0.29257343],
  jupiter: [5.20288700,-0.00011607, 0.04838624, -0.00013253,  1.30439695, -0.00183714,  34.39644051,  3034.74612775,  14.72847983, 0.21252668, 100.47390909,  0.20469106],
  saturn:  [9.53667594,-0.00125060, 0.05386179, -0.00050991,  2.48599187,  0.00193609,  49.95424423,  1222.49362201,  92.59887831,-0.41897216, 113.66242448, -0.28867794],
  uranus:  [19.18916464,-0.00196176,0.04725744, -0.00004397,  0.77263783, -0.00242939, 313.23810451,   428.48202785, 170.95427630, 0.40805281,  74.01692503,  0.04240589],
  neptune: [30.06992276, 0.00026291,0.00859048,  0.00005105,  1.77004347,  0.00035372, -55.12002969,   218.45945325,  44.96476227,-0.32241464, 131.78422574, -0.00508664],
};

function keplerXYZ(planet: string, jd: number): { X: number; Y: number; Z: number } {
  const T = (jd - 2451545) / 36525;
  const [a0,ar,e0,er,I0,Ir,L0,Lr,w0,wr,O0,Or] = KELP[planet];
  const a  = a0 + ar * T;
  const e  = e0 + er * T;
  const I  = norm(I0 + Ir * T) * D2R;
  const Ld = norm(L0 + Lr * T);
  const wd = norm(w0 + wr * T);
  const Od = norm(O0 + Or * T);
  const w  = wd * D2R;
  const O  = Od * D2R;
  const Mr = norm(Ld - wd) * D2R;

  let E = Mr + e * Math.sin(Mr);
  for (let i = 0; i < 100; i++) {
    const dE = (Mr - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-12) break;
  }

  const xo = a * (Math.cos(E) - e);
  const yo = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const wp = w - O;
  const cO = Math.cos(O), sO = Math.sin(O);
  const cI = Math.cos(I), sI = Math.sin(I);
  const cW = Math.cos(wp), sW = Math.sin(wp);

  return {
    X: (cW * cO - sW * sO * cI) * xo + (-sW * cO - cW * sO * cI) * yo,
    Y: (cW * sO + sW * cO * cI) * xo + (-sW * sO + cW * cO * cI) * yo,
    Z: (sW * sI) * xo + (cW * sI) * yo,
  };
}

function planetGeoLon(planet: string, jd: number): number {
  const { X: px, Y: py } = keplerXYZ(planet, jd);
  const T = (jd - 2451545) / 36525;
  const sl = sunLon(jd);
  const Msun = norm(357.52911 + 35999.05029 * T) * D2R;
  const R = 1.000001018 * (1 - 0.01670862 * Math.cos(Msun) - 0.000139589 * Math.cos(2 * Msun));
  const ex = R * Math.cos((sl + 180) * D2R);
  const ey = R * Math.sin((sl + 180) * D2R);
  return norm(Math.atan2(py - ey, px - ex) * R2D);
}

function plutoLon(jd: number): number {
  const T = (jd - 2451545) / 36525;
  const J = (34.35   + 3034.9057  * T) * D2R;
  const S = (50.08   + 1222.1138  * T) * D2R;
  const P = (238.96  +  144.9600  * T) * D2R;
  return norm(
    238.956785 + 144.96 * T
    - 19.799804 * Math.sin(J - P) + 19.850055 * Math.cos(J - P)
    +  0.897144 * Math.sin(2*(J-P)) - 4.956829 * Math.cos(2*(J-P))
    +  0.610820 * Math.sin(3*(J-P)) + 1.211439 * Math.cos(3*(J-P))
    - 0.341243  * Math.sin(4*(J-P)) - 0.189585 * Math.cos(4*(J-P))
    +  0.128803 * Math.sin(5*(J-P)) - 0.034190 * Math.cos(5*(J-P))
    + 0.075785  * Math.sin(S - P)   - 0.107508 * Math.cos(S - P)
    - 0.105950  * Math.sin(J)       + 0.260460 * Math.cos(J)
  );
}

function northNodeLon(jd: number): number {
  const T = (jd - 2451545) / 36525;
  return norm(125.0445479 - 1934.1362608 * T + 0.0020762 * T * T);
}

function lilithLon(jd: number): number {
  const T = (jd - 2451545) / 36525;
  return norm(83.3532465 + 4069.0137287 * T - 0.0103200 * T * T);
}

function gmstDeg(jd: number): number {
  const T = (jd - 2451545) / 36525;
  return norm(280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * T * T - (T * T * T) / 38710000);
}

function calcAsc(ramc: number, eps: number, lat: number): number {
  const r = ramc * D2R, e = eps * D2R, l = lat * D2R;
  return norm(Math.atan2(Math.cos(r), -(Math.sin(r) * Math.cos(e) + Math.tan(l) * Math.sin(e))) * R2D);
}

function calcMC(ramc: number, eps: number): number {
  const r = ramc * D2R, e = eps * D2R;
  return norm(Math.atan2(Math.sin(r), Math.cos(r) * Math.cos(e)) * R2D);
}

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
    return norm(Math.atan2(Math.sin(l) * Math.cos(epsR), Math.cos(l)) * R2D);
  }

  function computeDSA(lonDeg: number): number {
    const l = lonDeg * D2R;
    const dec = Math.asin(Math.sin(l) * Math.sin(epsR));
    const t = Math.tan(dec) * Math.tan(phiR);
    if (t <= -1) return 180;
    if (t >= 1) return 0;
    return Math.acos(-t) * R2D;
  }

  // Placidus solver: find ecliptic lon s.t. RA(lon) - k*DSA(lon) = C
  // H11/H12 (above horizon): C = RAMC + 0;  k = 1/3, 2/3
  // H2/H3   (below horizon): C = RAMC + 60, RAMC + 120; k = 2/3, 1/3
  // (below-horizon formula derived from IC trisection going toward ASC)
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

function retrograde(fn: (j: number) => number, jd: number): boolean {
  let d = fn(jd + 0.5) - fn(jd - 0.5);
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d < 0;
}

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

function localToUT(
  birthDate: string,
  birthTime: string | null | undefined,
  lat: number,
  lon: number
): { yr: number; mo: number; dy: number; hrUT: number; mnUT: number; tzName: string; utcOffsetMin: number } {
  const timePart = birthTime ?? "12:00";
  const timezones = geoTzFind(lat, lon);
  const tzName = timezones[0] ?? "UTC";

  const dt = DateTime.fromISO(`${birthDate}T${timePart}:00`, { zone: tzName });
  const utc = dt.toUTC();
  return {
    yr: utc.year,
    mo: utc.month,
    dy: utc.day,
    hrUT: utc.hour,
    mnUT: utc.minute,
    tzName,
    utcOffsetMin: dt.offset,
  };
}

export async function calculateBirthChart(
  birthDate: string,
  birthTime: string | null | undefined,
  birthPlace: string
): Promise<Record<string, unknown>> {
  const coords = await geocode(birthPlace);
  const { lat, lon } = coords;

  const { yr, mo, dy, hrUT, mnUT, tzName, utcOffsetMin } = localToUT(birthDate, birthTime, lat, lon);

  const jd = toJD(yr, mo, dy, hrUT, mnUT);
  const eps = obliquity(jd);
  const ramc = norm(gmstDeg(jd) + lon);
  const ascLon = calcAsc(ramc, eps, lat);
  const mcLon  = calcMC(ramc, eps);
  const cusps  = placidusHouseCusps(ramc, eps, lat, ascLon, mcLon);

  function planet(lon: number, rx = false) {
    const { sign, degree } = signOf(lon);
    return { sign, house: findHouse(lon, cusps), degree, retrograde: rx };
  }

  const sLon   = sunLon(jd);
  const mLon   = moonLon(jd);
  const merLon = planetGeoLon("mercury", jd);
  const venLon = planetGeoLon("venus",   jd);
  const marLon = planetGeoLon("mars",    jd);
  const jupLon = planetGeoLon("jupiter", jd);
  const satLon = planetGeoLon("saturn",  jd);
  const uraLon = planetGeoLon("uranus",  jd);
  const nepLon = planetGeoLon("neptune", jd);
  const pluLon = plutoLon(jd);
  const nnLon  = northNodeLon(jd);
  const snLon  = norm(nnLon + 180);
  const lilLon = lilithLon(jd);

  const { sign: ascSign, degree: ascDeg } = signOf(ascLon);
  const { sign: mcSign }                  = signOf(mcLon);

  const houseCusps = cusps.map((cl, i) => {
    const { sign: cs, degree: cd } = signOf(cl);
    return { house: i + 1, sign: cs, degrees: Math.floor(cd), minutes: Math.round((cd % 1) * 60) };
  });

  const aspects = calculateAspects([
    { name: "Sol",        lon: sLon   },
    { name: "Lua",        lon: mLon   },
    { name: "Mercúrio",   lon: merLon },
    { name: "Vênus",      lon: venLon },
    { name: "Marte",      lon: marLon },
    { name: "Júpiter",    lon: jupLon },
    { name: "Saturno",    lon: satLon },
    { name: "Urano",      lon: uraLon },
    { name: "Netuno",     lon: nepLon },
    { name: "Plutão",     lon: pluLon },
    { name: "Nodo Norte", lon: nnLon  },
    { name: "Lilith",     lon: lilLon },
  ]);

  return {
    ascendant: ascSign,
    ascendantDegree: Math.floor(ascDeg),
    ascendantMinutes: Math.round((ascDeg % 1) * 60),
    midheaven: mcSign,
    sun:      planet(sLon),
    moon:     planet(mLon,   retrograde(moonLon, jd)),
    mercury:  planet(merLon, retrograde(j => planetGeoLon("mercury", j), jd)),
    venus:    planet(venLon, retrograde(j => planetGeoLon("venus",   j), jd)),
    mars:     planet(marLon, retrograde(j => planetGeoLon("mars",    j), jd)),
    jupiter:  planet(jupLon, retrograde(j => planetGeoLon("jupiter", j), jd)),
    saturn:   planet(satLon, retrograde(j => planetGeoLon("saturn",  j), jd)),
    uranus:   planet(uraLon, retrograde(j => planetGeoLon("uranus",  j), jd)),
    neptune:  planet(nepLon, retrograde(j => planetGeoLon("neptune", j), jd)),
    pluto:    planet(pluLon),
    northNode: { ...planet(nnLon), retrograde: true },
    southNode: planet(snLon),
    lilith:   planet(lilLon),
    houseCusps,
    aspects,
    calculatedCoords: { lat, lon },
    timezone: { name: tzName, utcOffsetMin },
  };
}
