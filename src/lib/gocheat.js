/**
 * go.cheat-Planung fuer IPvGO (27.10.2026). Reines JS ohne ns, 0 GB RAM,
 * ausserhalb des Spiels testbar. Nachbau der Spiellogik aus
 * Go/effects/netscriptGoImplementation.ts (Datei:Zeile siehe BERICHT.md).
 *
 * Brett wie in gomcts.js: flaches Feld, 0 leer, 1 Spieler (Schwarz), 2 Gegner
 * (Weiss), 3 offline.
 */
import { _intern } from "lib/gomcts.js";

const E = 0, B = 1, Wt = 2;
const { geomOf, chainLibs, play, areaScore } = _intern;

/**
 * Erfolgschance eines Cheats (netscriptGoImplementation.ts:561-567):
 *   max(min(0.6 * (0.7 - 0.02 * n)^n * crime_success + sf14Bonus, 1), 0)
 * sf14Bonus ist 0.25 NUR bei Source-File 14 genau Stufe 3 (Zeile 565).
 * @param {number} count bisherige Cheats dieser Partie (auch fehlgeschlagene)
 * @param {number} crime Player.mults.crime_success
 * @param {number} sf14 Stufe von Source-File 14
 */
export function cheatChance(count, crime, sf14) {
  const scalar = (0.7 - 0.02 * count) ** count;
  const bonus = sf14 === 3 ? 0.25 : 0;
  return Math.max(Math.min(0.6 * scalar * crime + bonus, 1), 0);
}

/**
 * Wie updateCaptures nach einem Cheat (boardState.ts:234, boardAnalysis.ts:474):
 * zuerst werden ALLE gegnerischen Ketten ohne Freiheit geschlagen; gab es keine,
 * die eigenen Ketten ohne Freiheit (Selbstmord). Nur dieser eine Durchgang.
 * Veraendert h; gibt die Zahl der geschlagenen Steine zurueck (negativ bei Selbstmord).
 */
export function resolveCaptures(geo, h, mover) {
  const foe = 3 - mover;
  for (const colour of [foe, mover]) {
    const dead = [];
    const seen = new Uint8Array(geo.N);
    for (let i = 0; i < geo.N; i++) {
      if (h[i] !== colour || seen[i]) continue;
      const libs = chainLibs(geo, h, i, 1);
      for (let t = 0; t < geo.size; t++) seen[geo.chain[t]] = 1;
      if (libs === 0) for (let t = 0; t < geo.size; t++) dead.push(geo.chain[t]);
    }
    if (dead.length) {
      for (const d of dead) h[d] = E;
      return colour === foe ? dead.length : -dead.length;
    }
  }
  return 0;
}

/** Zwei Steine ohne Legalitaetspruefung setzen (cheatPlayTwoMoves, Zeile 599-627). */
export function simulatePair(geo, g, a, b) {
  const h = g.slice();
  if (h[a] !== E || h[b] !== E || a === b) return null;
  h[a] = B; h[b] = B;
  const captured = resolveCaptures(geo, h, B);
  return { h, captured };
}

/** Flaechenvorsprung des Spielers (Schwarz minus Weiss, ohne Komi). */
function lead(geo, h) {
  const s = areaScore(geo, h);
  return s[0] - s[1];
}

/**
 * Besten Doppelzug suchen, der gegnerische Ketten schlaegt, und mit dem besten
 * NORMALEN Zug vergleichen. Kandidatenpunkte: Freiheiten weisser Ketten mit
 * hoechstens maxLibs Freiheiten (zwei Steine nehmen einer Kette bis zu zwei
 * Freiheiten auf einmal - das geht mit einem normalen Zug nie).
 *
 * @param {Uint8Array} g Brett
 * @param {number} n Kantenlaenge
 * @param {object} [o] { maxLibs = 3, ko = -1, blocked }
 * @returns {null | {a:number,b:number,captured:number,gain:number,normal:number}}
 *   gain = Flaechenvorsprung nach dem Doppelzug minus nach dem besten normalen Zug
 */
export function planKill(g, n, o = {}) {
  const geo = geomOf(n);
  const maxLibs = o.maxLibs ?? 3;
  const pts = new Set();
  const seen = new Uint8Array(geo.N);
  for (let i = 0; i < geo.N; i++) {
    if (g[i] !== Wt || seen[i]) continue;
    const libs = chainLibs(geo, g, i, maxLibs + 1);
    const size = geo.size;
    for (let t = 0; t < size; t++) seen[geo.chain[t]] = 1;
    if (libs > maxLibs) continue;                       // chain unvollstaendig gelaufen, aber dann ohnehin ausgeschlossen
    // Freiheiten einsammeln
    const mark = new Uint8Array(geo.N);
    for (let t = 0; t < size; t++) {
      const p = geo.chain[t];
      for (let k = 0; k < 4; k++) {
        const q = geo.nb[p * 4 + k];
        if (q >= 0 && g[q] === E && !mark[q]) { mark[q] = 1; pts.add(q); }
      }
    }
  }
  if (pts.size < 2) return null;
  const base = lead(geo, g);
  // bester normaler Zug (Spielregeln inkl. Selbstmordverbot) als Vergleich
  let normal = -Infinity;
  const koOut = [-1];
  for (let i = 0; i < geo.N; i++) {
    if (g[i] !== E) continue;
    const t = g.slice();
    if (play(geo, t, i, B, o.ko ?? -1, koOut) < 0) continue;
    const v = lead(geo, t);
    if (v > normal) normal = v;
  }
  if (normal === -Infinity) normal = base;
  const list = [...pts];
  let best = null;
  for (let x = 0; x < list.length; x++) {
    for (let y = x + 1; y < list.length; y++) {
      const r = simulatePair(geo, g, list[x], list[y]);
      if (!r || r.captured <= 0) continue;
      const v = lead(geo, r.h) - normal;
      if (!best || v > best.gain) best = { a: list[x], b: list[y], captured: r.captured, gain: v, normal: normal - base };
    }
  }
  return best;
}
