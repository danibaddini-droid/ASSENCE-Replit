import * as Astronomy from 'astronomy-engine';
import { DateTime } from 'luxon';

const SIGNS = ["Áries","Touro","Gêmeos","Câncer","Leão","Virgem","Libra","Escorpião","Sagitário","Capricórnio","Aquário","Peixes"];
function signOf(lon) {
  const n = ((lon % 360) + 360) % 360;
  const si = Math.floor(n / 30);
  return `${SIGNS[si]} ${(n - si * 30).toFixed(2)}°`;
}

// ── LILITH FIX ──────────────────────────────────────────────
// 83.3532430 + 4069*T is the PERIGEE (closest approach), NOT the apogee.
// Black Moon Lilith = lunar APOGEE = perigee + 180°.
// Our Cancer 24.87° + 180° = Capricorn 24.87° ✓
const T = -0.2576742527948936;
const perigee = ((83.3532430 + 4069.0137287*T - 0.0103200*T*T - 0.00001249*T*T*T) % 360 + 360) % 360;
const apogee  = ((perigee + 180) % 360 + 360) % 360;
console.log('Lilith PERIGEE (what we compute):', signOf(perigee));
console.log('Lilith APOGEE  (correct BML)    :', signOf(apogee));
console.log('→ Adding 180° gives Capricórnio ✓\n');

// ── MOON INVESTIGATION ──────────────────────────────────────
// At 22:45 UT (19:45 local UTC-3) on 1974-03-26, Moon = Taurus 13°
// For Moon to be in Aries, we need to go back ~24h earlier
// Let's scan UTC times to find when Moon was in Aries around that date

console.log('Moon positions throughout 1974-03-25 and 1974-03-26:');
for (let h = 0; h <= 48; h += 4) {
  const d = new Date(Date.UTC(1974, 2, 25) + h * 3600000);
  const sph = Astronomy.EclipticGeoMoon(d);
  const lon = ((sph.lon % 360) + 360) % 360;
  console.log(`  ${d.toISOString().slice(0,16)} UT → Moon ${signOf(lon)}`);
}

// What UTC time gives Moon at Aries boundary (0°-30°)?
console.log('\nFine scan for Moon in Aries on 1974-03-25:');
for (let m = 0; m <= 1440; m += 60) {
  const d = new Date(Date.UTC(1974, 2, 25) + m * 60000);
  const sph = Astronomy.EclipticGeoMoon(d);
  const lon = ((sph.lon % 360) + 360) % 360;
  if (lon < 30) {
    const dtBR = DateTime.fromJSDate(d, { zone: 'America/Sao_Paulo' });
    console.log(`  ${d.toISOString().slice(0,16)} UT = ${dtBR.toISO().slice(0,16)} local (UTC${dtBR.offset/60}) → Moon ${signOf(lon)}`);
  }
}

// What if the user's reference uses UTC-2 for the 1974 date?
// UTC-2 is "horário de Brasília de verão" (summer time)
console.log('\n--- Hypothesis: if birth time was recorded in UTC-2 DST ---');
// 19:45 local UTC-2 → 21:45 UT
const dateUTC2 = new Date(Date.UTC(1974, 2, 26, 21, 45, 0));
const sphUTC2 = Astronomy.EclipticGeoMoon(dateUTC2);
console.log('Moon at 21:45 UT (19:45 UTC-2):', signOf(((sphUTC2.lon%360)+360)%360));

// What if birth time was 19:45 UTC (not local time)?
const dateAsUTC = new Date(Date.UTC(1974, 2, 26, 19, 45, 0));
const sphUTC = Astronomy.EclipticGeoMoon(dateAsUTC);
console.log('Moon at 19:45 UT (if stored as UTC):', signOf(((sphUTC.lon%360)+360)%360));

