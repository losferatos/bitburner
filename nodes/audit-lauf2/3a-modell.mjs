// 3a-modell.mjs - Reihenfolge-Modell fuer Lauf 2 (Audit Teil 3a, 13.11.2026)
//
// Aufruf:  node 3a-modell.mjs            (Eichung, Waterfall, Varianten, Suche, Mitte-Parameter, ~5 s)
//          node 3a-modell.mjs full       (zusaetzlich Monte-Carlo ueber die Parameter, Ablation, Anfangsfolgen, ~30 s)
// Bericht dazu: 3a-reihenfolge.md (gleicher Ordner). Reihenfolge = Array von Knotennummern, Stufe ergibt sich aus dem Auftreten.
// Liest chronik.json und 2b-sf-modell.json aus dem Ordner dieser Datei (oder AUDIT_DIR).
// Reine Rechnung, kein Netz, keine Schreibzugriffe ausser stdout.
//
// ZEITEINHEITEN
//  E  = effektive Knotenstunden: V1 = Online-Stunden; V2 = online + 0,5 x offline (50-%-Gutschrift, UNGEEICHT, Streuung 0-100 %).
//  Wanduhr = E/(1-q/2) fuer V2, E/(1-q) fuer V1, q = Offline-Anteil der Wanduhr.
//
// MODELL JE LAUF (Knoten n, Stufe k, Verfahren m):
//  V2:  E = max(0,35 B, B[n,m] * exp(rho*p1*erst) * (pi4 falls kein SF4) - G)
//  V1:  E = B[n,m] * exp(rho*p1*erst) * fV1(SF)   (BN8 zusaetzlich - Casino)
//  B    = je (Knoten, Verfahren) aus Lauf 1 gefittet (Log-Mittel), nach Abzug der SF-Gewinne G (V2) bzw. fV1 (V1),
//         und nach Division durch die Unreife I(Datum) des Bots im Lauf 1. Lauf 2: I = 1 (Bot fertig).
//  G    = Summe der SF-Gewinne in Stunden aus 2b-sf-modell.json (lo/mid/hi je Stufe, Grenznutzen), plus Sleeves,
//         Grafting (nur ab SF10.1/BN10), Go, Kaltstart-Gewinne; Graft ueberdeckt die Chance-Kanaele von SF1/6/7/14 (omega).
//  I(d) = 1 + a exp(-d/tau), d = Tage seit 19.08.2026 (Beginn Lauf 1). a, tau sind PRIOR (nicht identifizierbar), siehe Bericht.
//
// UNGEEICHT (alles was nicht aus Messdaten fliesst): SF-Gewinne in Stunden, I(d), p1 (nur grob), fV1-Kaltstartfaktoren k1/k5/k8,
// pi4 (V2 ohne SF4), 50-%-Gutschrift, Offline-Anteil q, Graft-/Boersen-/Casino-Gewinne.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = process.env.AUDIT_DIR ||
  (fs.existsSync(path.join(HERE, 'chronik.json')) ? HERE : 'C:/Users/erche/Desktop/claude_projecto/bitburner/nodes/audit-lauf2');
const chron = JSON.parse(fs.readFileSync(path.join(DATA, 'chronik.json'), 'utf8'));
const sfm = JSON.parse(fs.readFileSync(path.join(DATA, '2b-sf-modell.json'), 'utf8'));

const T0 = Date.parse('2026-08-19T16:35:12Z');
const GRAFT_DATE = Date.parse('2026-11-07T18:32:00Z'); // Zuender erst BN15.2 (CHRONIK Abschn. 5)
const GO_DATE = Date.parse('2026-10-27T00:00:00Z');    // go.js ab BN13 (2b ipvgo.botAb)
const V1_NODES = new Set([1, 5, 12, 8]);

// ---------- Parameter ----------
const pick = (a, u) => (u < 0.5 ? a[0] + (a[1] - a[0]) * (u / 0.5) : a[1] + (a[2] - a[1]) * ((u - 0.5) / 0.5));
// Jeder Parameter: [lo, mid, hi]; u in [0,1] waehlt (0 = Wirkung klein, 0,5 = Mitte, 1 = Wirkung gross)
const RANGES = {
  omega: [0.3, 0.7, 0.9],       // Anteil der SF1/6/7/14-Chance-Gewinne, den Graft ueberdeckt (2c: "nahe 0" -> 0,7-0,9)
  k1: [0.10, 0.25, 0.45],       // V1-Zeitzuschlag ohne SF1 (v1cf.js: Hack-Stufe -14..-23 %); Umrechnung in Zeit GERATEN
  k5: [0.04, 0.10, 0.20],       // dito SF5 (-8..-12 %)
  k8: [0.5, 1.0, 2.0],          // BN8: Zuschlag bei leerer SF-Lage (S8=0): Faktor 1+k8 (GERATEN)
  pi4: [1.05, 1.20, 1.50],      // V2-Zuschlag ohne SF4 (Singularity ueber DOM statt API) GERATEN
  pi4v1: [1.0, 1.1, 1.25],      // V1 ohne SF4
  casino: [11, 12, 13],         // MECHANIKEN Rang 1: 11-13 h je BN8-Stufe
  rho: [0.2, 0.5, 0.8],         // Rest des "Erststufe"-Aufschlags in Lauf 2 (Bot kennt den Knoten schon, Code uebernimmt Lehren)
  a1: [0.1, 0.3, 0.6],          // Unreife V1-Bot am 19.08. (I = 1 + a e^(-d/tau)), PRIOR: belegte Fehlerstunden 33-130 h (CHRONIK Abschn. 4)
  tau1: [7, 10, 14],
  a2: [0.4, 1.0, 2.0],          // Unreife V2-Bot ab erstem V2-Lauf (BN6.1, 24.08.): BN6.1 brauchte ~3x BN6.2/6.3
  tau2: [4, 5, 8],
  imp1: [0.45, 0.63, 0.9],      // Online/Wanduhr fuer die 3 V1-Laeufe ohne Messung (1.1, 4.1, 5.1); bekannte V1: 0,63
  imp2: [0.65, 0.78, 0.9],      // dito V2 (6.1, 10.1, 10.2); bekannte fruehe V2: 0,78
  c2: [0.2, 0.5, 0.9],          // Offline-Gutschrift V2 (CHRONIK: grob 50 %, 8 Luecken, Streuung 0-100 %); gilt in Eichung UND Wanduhr-Umrechnung
  q: [0.10, 0.25, 0.40],        // Offline-Anteil der Wanduhr in Lauf 2 (Lauf 1: 0,37 gesamt, 0,20 in der 2. Oktoberhaelfte)
};

// SF-Gewinne je V2-Lauf (Stunden), Grenznutzen je Stufe [lo,mid,hi] aus 2b
const SFT = {};
for (const k of Object.keys(sfm.sf)) {
  const s = sfm.sf[k];
  if (!s.nutzen_h_je_V2_Lauf) continue;
  SFT[k] = [1, 2, 3].map((l) => { const o = s.nutzen_h_je_V2_Lauf[l]; return o ? [o.lo, o.mid, o.hi] : [0, 0, 0]; });
}
const KALT_SF1 = [0.1, 0.3, 0.5];
const KALT_SF9 = { 2: [0.2, 0.4, 0.7], 3: [0.1, 0.3, 0.6] };
const SLEEVE_EACH = [0.3, 0.7, 1.0];
const GRAFT_SHORT = [0, 2, 6];   // 2c: 50-%-Abschlag, lo = 0 (Wirkung auf Knotenzeit unbelegt)
const GRAFT_LONG = [0, 7.5, 25];
const GO_BASE = [0.8, 2.0, 4.8];
const LONG_NODES = new Set([4, 7, 9, 10, 13, 15]);
const MONEY_V2 = [0, 1.0, 3.0];  // Boerse+Casino-Geld in V2 je Lauf (0/35/110 ueber ~36 V2-Laeufe), nur wenn ctx.moneyV2

export function makeP(u = 0.5, over = {}) {
  const P = { u };
  for (const k of Object.keys(RANGES)) P[k] = pick(RANGES[k], u);
  return Object.assign(P, over);
}
// Parameter, deren "grosse Wirkung" in Lauf 2 SCHNELLER heisst, haben u hoch (a, rho invers: rho klein = schneller)
export function makePmix(rng) {
  const g = rng();                    // gemeinsamer Hebel (Komonotonie) ...
  const j = () => Math.min(1, Math.max(0, g + (rng() - 0.5) * 0.5)); // ... plus Jitter je Parametergruppe
  const P = { u: j() };
  P.omega = pick(RANGES.omega, rng());
  P.k1 = pick(RANGES.k1, rng()); P.k5 = pick(RANGES.k5, rng()); P.k8 = pick(RANGES.k8, rng());
  P.pi4 = pick(RANGES.pi4, rng()); P.pi4v1 = pick(RANGES.pi4v1, rng());
  P.casino = pick(RANGES.casino, rng());
  P.rho = pick(RANGES.rho, rng());
  P.a1 = pick(RANGES.a1, rng()); P.tau1 = pick(RANGES.tau1, rng());
  P.a2 = pick(RANGES.a2, rng()); P.tau2 = pick(RANGES.tau2, rng());
  P.imp1 = pick(RANGES.imp1, rng()); P.imp2 = pick(RANGES.imp2, rng());
  P.q = pick(RANGES.q, rng()); P.c2 = pick(RANGES.c2, rng());
  return P;
}

// ---------- SF-Zustand ----------
const lv = (sf, k) => Math.min(3, sf[k] || 0);
function sumLevels(tab, sf, k, u) { let s = 0; for (let l = 1; l <= lv(sf, k); l++) s += pick(tab[l - 1], u); return s; }

export function gainV2(ctx, sf, node, P) {
  const u = P.u;
  const graftOn = ctx.graftOn && ((sf[10] || 0) >= 1 || node === 10);
  const ov = graftOn ? P.omega : 0;
  let g = 0;
  for (const k of [1, 2, 3, 5, 6, 7, 11, 12, 14, 15]) {
    if (!SFT[k]) continue;
    let s = sumLevels(SFT[k], sf, k, u);
    if (k === 1 || k === 6 || k === 7 || k === 14) s *= 1 - ov;
    g += s;
  }
  if (ctx.stocksV2) g += sumLevels(SFT[8], sf, 8, u);
  g += sumLevels(SFT[9], sf, 9, u); // SF9: Stufe 3 enthaelt Hash->Rang
  // Kaltstart: 32 GB home (SF1), 128 GB home / Gratisserver (SF9.2/9.3)
  if (lv(sf, 1) >= 1) g += pick(KALT_SF1, u);
  if (lv(sf, 9) >= 2) g += pick(KALT_SF9[2], u);
  if (lv(sf, 9) >= 3) g += pick(KALT_SF9[3], u);
  // Sleeves
  const ns = Math.min(3, (sf[10] || 0) + (node === 10 ? 1 : 0));
  g += ns * pick(SLEEVE_EACH, u);
  // Grafting
  if (graftOn) g += pick(LONG_NODES.has(node) ? GRAFT_LONG : GRAFT_SHORT, u);
  // Go ohne SF14
  if (ctx.goOn) g += pick(GO_BASE, u);
  if (ctx.moneyV2) g += pick(MONEY_V2, u);
  return g * (P.gscale == null ? 1 : P.gscale);
}

export function fV1(ctx, sf, node, P) {
  const c1 = [0, 16, 24, 28][lv(sf, 1)] / 28;
  const c5 = [0, 8, 12, 14][lv(sf, 5)] / 14;
  let f = 1 + P.k1 * (1 - c1) + P.k5 * (1 - c5);
  if (node === 8) {
    const S = [1, 5, 9, 10, 11, 12].reduce((a, k) => a + lv(sf, k) / 3, 0) / 6;
    f *= 1 + P.k8 * (1 - S);
  }
  if (!(sf[4] > 0)) f *= P.pi4v1;
  return f;
}

const V2_START = Date.parse('2026-08-24T19:21:50Z'); // erster V2-Lauf (BN6.1)
// Unreife des Bots (Faktor auf die Laufzeit), je Verfahren: V1-Code seit 19.08., V2-Code seit BN6.1
const unreif = (P, startMs, method) => (method === 'V2'
  ? 1 + P.a2 * Math.exp(-Math.max(0, (startMs - V2_START) / 86400000) / P.tau2)
  : 1 + P.a1 * Math.exp(-((startMs - T0) / 86400000) / P.tau1));

// ---------- Lauf-1-Daten ----------
function prepLauf1(P) {
  // eff aus Messung; fehlende Online-Zeit imputiert (Verhaeltnis aus bekannten Laeufen)
  const known = chron.filter((r) => r.onlineH != null && r.end);
  const effOf = (r) => (r.method === 'V1' ? r.onlineH : r.onlineH + P.c2 * (r.wallH - r.onlineH));
  const rat = { V1: [], V2: [] };
  for (const r of known) rat[r.method].push(effOf(r) / r.wallH);
  const ratio = { V1: P.imp1, V2: P.imp2 }; // bekannt: V1 im Mittel 0,63, fruehe V2 0,78 (siehe RANGES)
  const runs = chron.map((r, i) => {
    const eff = r.onlineH != null ? effOf(r) : r.wallH * ratio[r.method];
    return { i, node: r.node, level: r.level, method: r.method, wall: r.wallH, on: r.onlineH, eff, imputed: r.onlineH == null,
      start: Date.parse(r.start), sf: r.sfAtStart, partial: r.node === 8 && r.level === 2 };
  });
  return { runs, ratio };
}
let _cache = null;
export function lauf1(P) { // Imputation haengt von P ab -> je P neu aufbauen (billig)
  const k = P.imp1 + '/' + P.imp2 + '/' + P.c2;
  if (!_cache || _cache.k !== k) _cache = { k, v: prepLauf1(P) };
  return _cache.v;
}
export const LAUF1 = prepLauf1(makeP(0.5));
const ctx1 = (startMs) => ({ graftOn: startMs >= GRAFT_DATE, goOn: startMs >= GO_DATE, stocksV2: false, moneyV2: false });

// ---------- Fit von B und p1 ----------
export function fit(P, skip = null) {
  const xs = [];
  const seen = new Set();
  for (const r of lauf1(P).runs) {
    if (r.partial) continue;
    const key = r.node + r.method;
    const erst = !seen.has(key); seen.add(key);
    r.erst = erst; r.key = key;
    if (skip != null && (skip === r.i || (skip.has && skip.has(r.i)))) continue;
    const I = unreif(P, r.start, r.method);
    let Eadj;
    if (r.method === 'V2') Eadj = r.eff + gainV2(ctx1(r.start), r.sf, r.node, P);
    else Eadj = r.eff / fV1(ctx1(r.start), r.sf, r.node, P);
    xs.push({ r, key, erst, x: Math.log(Math.max(Eadj, 0.5) / I) });
  }
  // erste Stufe jeweils neu bestimmen, falls skip die "erst"-Zeile ist: Erst-Markierung bleibt am Lauf
  const byKey = {};
  for (const o of xs) (byKey[o.key] ||= []).push(o);
  const diffs = [];
  for (const k in byKey) {
    const f = byKey[k].filter((o) => o.erst), n = byKey[k].filter((o) => !o.erst);
    if (f.length && n.length) diffs.push(f[0].x - n.reduce((a, o) => a + o.x, 0) / n.length);
  }
  const p1raw = diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 0;
  const p1 = Math.min(0.5, Math.max(0, p1raw));
  const B = {}, nObs = {}, sd = {};
  for (const k in byKey) {
    // B aus ALLEN Laeufen des Schluessels (Erststufe um p1 bereinigt): p1 ist nicht nachweisbar, die Erststufe ist Rauschen wie jede andere
    const xsk = byKey[k].map((o) => o.x - (o.erst ? p1 : 0));
    const m = xsk.reduce((a, b) => a + b, 0) / xsk.length;
    B[k] = Math.exp(m); nObs[k] = xsk.length;
    sd[k] = xsk.length > 1 ? Math.sqrt(xsk.reduce((a, b) => a + (b - m) ** 2, 0) / (xsk.length - 1)) : null;
  }
  return { B, p1, p1raw, nObs, sd, diffs };
}

// ---------- Vorhersage eines Laufs ----------
const v2ok = (sf, node) => node === 6 || node === 7 || (sf[6] || 0) >= 1 || (sf[7] || 0) >= 1;
export function runE(ctx, P, F, sf, node, method, erst, lauf1date = null) {
  const key = node + method;
  const B = F.B[key];
  if (B == null) return null;
  const rho = ctx.rho != null ? ctx.rho : P.rho;
  const eFirst = Math.exp((lauf1date != null ? 1 : rho) * F.p1 * (erst ? 1 : 0));
  const I = lauf1date != null ? unreif(P, lauf1date, method) : 1;
  if (method === 'V2') {
    let base = B * eFirst * I;
    if (!(sf[4] > 0)) base *= P.pi4;
    const G = gainV2(ctx, sf, node, P);
    return Math.max(0.35 * B, base - G);
  }
  let e = B * eFirst * I * fV1(ctx, sf, node, P);
  if (node === 8 && ctx.casino) e = Math.max(0.35 * B, e - P.casino);
  return e;
}

// Bewertet eine Reihenfolge (Array von Knotennummern; Stufe ergibt sich aus dem Auftreten)
export function evalOrder(order, ctx, P, F, opt = {}) {
  const sf = {}; const seenKey = new Set(); const cnt = {};
  let E = 0, wall = 0, on = 0; const runs = [];
  const q = P.q;
  let idx = -1;
  for (const node of order) {
    idx++;
    const level = (cnt[node] = (cnt[node] || 0) + 1);
    const cand = [];
    if (V1_NODES.has(node) || node === 4) cand.push('V1');
    if (node === 4 || !V1_NODES.has(node)) if (v2ok(sf, node) && !(opt.noV2 && node !== 6 && node !== 7)) cand.push('V2');
    if (node === 4 && ctx.bn4 === 'lauf1') { cand.length = 0; cand.push(v2ok(sf, node) ? 'V2' : 'V1'); } // wie Lauf 1: BN4.1 V1 (erzwungen), danach V2
    if (opt.forceV2for && opt.forceV2for.has(node) && v2ok(sf, node)) { cand.length = 0; cand.push('V2'); }
    if (opt.forceV1for && opt.forceV1for.has(node)) { cand.length = 0; cand.push('V1'); }
    let best = null;
    for (const m of cand) {
      const key = node + m;
      const dt = opt.dates ? opt.dates[idx] : null;
      const cx = dt != null ? { ...ctx1(dt), bn4: ctx.bn4, casino: false } : ctx;
      const e = runE(cx, P, F, sf, node, m, !seenKey.has(key), dt);
      if (e != null && (best == null || e < best.e)) best = { m, e, key };
    }
    if (!best) return { E: 1e6, wall: 1e6, on: 1e6, infeasible: true, runs, at: node + '.' + level };
    seenKey.add(best.key);
    const w = best.m === 'V2' ? best.e / (1 - q + P.c2 * q) : best.e / (1 - q);
    const o = best.m === 'V2' ? w * (1 - q) : best.e;
    E += best.e; wall += w; on += o;
    runs.push({ node, level, m: best.m, e: best.e, w });
    sf[node] = level;
  }
  return { E, wall, on, runs };
}

// ---------- Reihenfolgen ----------
export const LAUF1_ORDER = [...chron.map((r) => r.node), 8]; // BN8.3 fehlt noch -> ans Ende
export const L2CTX = (over = {}) => ({ graftOn: true, goOn: true, stocksV2: false, moneyV2: false, casino: true, bn4: 'lauf1', ...over });

// ---------- Suche ----------
function rngFrom(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export function anneal(startOrder, ctx, P, F, opt = {}) {
  const rng = rngFrom(opt.seed || 1);
  let cur = startOrder.slice();
  let curV = evalOrder(cur, ctx, P, F, opt).wall;
  let best = cur.slice(), bestV = curV;
  const N = opt.iters || 60000, T0_ = opt.t0 || 6, T1 = 0.05;
  const lock = opt.lock || 1;
  for (let it = 0; it < N; it++) {
    const T = T0_ * Math.pow(T1 / T0_, it / N);
    const a = lock + Math.floor(rng() * (cur.length - lock)), b = lock + Math.floor(rng() * (cur.length - lock));
    if (a === b) continue;
    const cand = cur.slice();
    if (rng() < 0.5) { [cand[a], cand[b]] = [cand[b], cand[a]]; }
    else { const [x] = cand.splice(a, 1); cand.splice(b, 0, x); }
    const v = evalOrder(cand, ctx, P, F, opt).wall;
    if (v < curV || rng() < Math.exp((curV - v) / T)) { cur = cand; curV = v; if (v < bestV) { best = cand.slice(); bestV = v; } }
  }
  return { order: best, v: bestV };
}

// ---------- Berichte ----------
export const fmt = (x, d = 1) => (x == null ? '-' : x.toFixed(d));
export function orderStr(order) {
  const c = {}; return order.map((n) => `${n}.${(c[n] = (c[n] || 0) + 1)}`).join(' ');
}
export function compress(order) {
  const out = []; let last = null, cnt = 0;
  for (const n of order) { if (n === last) cnt++; else { if (last != null) out.push(last + (cnt > 1 ? `x${cnt}` : '')); last = n; cnt = 1; } }
  out.push(last + (cnt > 1 ? `x${cnt}` : '')); return out.join(' ');
}

export function calibration(P) {
  const F = fit(P);
  const rows = []; let seen = new Set();
  let totObs = 0, totPred = 0, totWallObs = 0;
  for (const r of lauf1(P).runs) {
    if (r.partial) continue;
    const key = r.node + r.method;
    const erst = !seen.has(key); seen.add(key);
    const pred = runE(ctx1(r.start), P, F, r.sf, r.node, r.method, erst, r.start);
    // Leave-one-out
    const Fl = fit(P, r.i);
    const predLoo = runE(ctx1(r.start), P, Fl, r.sf, r.node, r.method, erst, r.start);
    rows.push({ i: r.i, id: `${r.node}.${r.level}`, node: r.node, method: r.method, imputed: r.imputed, obs: r.eff, pred, loo: predLoo, wall: r.wall });
    totObs += r.eff; totPred += pred; totWallObs += r.wall;
  }
  return { F, rows, totObs, totPred, totWallObs };
}

// ---------- Analyse ----------
const seq = (s) => s.trim().split(/\s+/).flatMap((t) => { const m = t.match(/^(\d+)(?:x(\d+))?$/); return Array(m[2] ? +m[2] : 1).fill(+m[1]); });
export function completeOrder(prefix, ref) {
  const skip = {}; for (const n of prefix) skip[n] = (skip[n] || 0) + 1;
  const rest = []; for (const n of ref) { if (skip[n] > 0) skip[n]--; else rest.push(n); }
  return prefix.concat(rest);
}
const TAIL = '2x3 3x3 11x3 6x2 7x3 14x3 13x3 15x3';
export const VARIANTS = {
  'a  Route 1 (Lauf-1-Reihenfolge)': LAUF1_ORDER,
  'b1 BN10+BN9 vor BN7 (nach BN6.2/6.3)': seq('1 4 5 6 4x2 1x2 5x2 12x3 2x3 3x3 11x3 6x2 10x3 9x3 7x3 14x3 13x3 15x3 8x3'),
  'b2 BN10+BN9 ganz spaet (vor BN8)': seq('1 4 5 6 4x2 1x2 5x2 12x3 2x3 3x3 11x3 6x2 7x3 14x3 13x3 15x3 10x3 9x3 8x3'),
  'b3 nur BN9 spaet': seq('1 4 5 6 10x3 4x2 1x2 5x2 12x3 2x3 3x3 11x3 6x2 9x3 7x3 14x3 13x3 15x3 8x3'),
  'b4 nur BN10 spaet': seq('1 4 5 6 9x3 4x2 1x2 5x2 12x3 2x3 3x3 11x3 6x2 10x3 7x3 14x3 13x3 15x3 8x3'),
  'c1 BN8 direkt nach BN6.1': seq('1 4 5 6 8x3 10x3 4x2 9x3 1x2 5x2 12x3 ' + TAIL),
  'c2 BN8 nach BN10 (SF10 fuer Graft/Sleeves)': seq('1 4 5 6 10x3 8x3 4x2 9x3 1x2 5x2 12x3 ' + TAIL),
  'c3 BN8 nach BN10+BN9+BN4+BN1/5': seq('1 4 5 6 10x3 4x2 9x3 1x2 5x2 8x3 12x3 ' + TAIL),
  'd1 Stufen gruppiert (alle 3 Stufen am Stueck)': seq('1x3 4x3 5x3 6x3 10x3 9x3 12x3 2x3 3x3 11x3 7x3 14x3 13x3 15x3 8x3'),
  'd2 Stufen verteilt (erst alle L1, dann L2, dann L3)': (() => { const o = seq('1 4 5 6 10 9 12 2 3 11 7 14 13 15 8'); return [...o, ...o, ...o]; })(),
  'e2 Anfang 1 5 4 6': completeOrder(seq('1 5 4 6'), LAUF1_ORDER),
  'e3 Anfang 1 6 4 5': completeOrder(seq('1 6 4 5'), LAUF1_ORDER),
  'e4 Anfang 1 6 5 4': completeOrder(seq('1 6 5 4'), LAUF1_ORDER),
  'e5 Anfang 1 4 6 5': completeOrder(seq('1 4 6 5'), LAUF1_ORDER),
  'e6 Anfang 1 5 6 4': completeOrder(seq('1 5 6 4'), LAUF1_ORDER),
  'e7 Anfang 1 6 10x3 (BN4/5 spaeter)': completeOrder(seq('1 6 10 10 10'), LAUF1_ORDER),
  'e8 Anfang 1 4 6 10 10 10 5 ...': completeOrder(seq('1 4 6 10 10 10 5'), LAUF1_ORDER),
  'c4 BN8 nach BN11 (mitten in der Route)': seq('1 4 5 6 10x3 4x2 9x3 1x2 5x2 12x3 2x3 3x3 11x3 8x3 6x2 7x3 14x3 13x3 15x3'),
  'h1 V1-Block zuerst (1x3 4 5x3), dann BN6': seq('1 4 1x2 5x3 6 10x3 9x3 4x2 12x3 ' + TAIL + ' 8x3'),
  'h2 Route 1, aber SF1.2/1.3 vorgezogen': seq('1 4 1x2 5 6 10x3 4x2 9x3 5x2 12x3 ' + TAIL + ' 8x3'),
  'h3 Route 1, aber BN14 vor BN7': seq('1 4 5 6 10x3 4x2 9x3 1x2 5x2 12x3 2x3 3x3 11x3 14x3 6x2 7x3 13x3 15x3 8x3'),
  'h4 h1 + BN14 nach BN9': seq('1 4 1x2 5x3 6 10x3 9x3 4x2 14x3 12x3 2x3 3x3 11x3 6x2 7x3 13x3 15x3 8x3'),
};

function quant(a, p) { const s = a.slice().sort((x, y) => x - y); const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); }
function gauss(rng) { return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng()); }

// Monte-Carlo ueber die Parameter; je Ziehung wird B neu gefittet (Eichung je Szenario) und alle Reihenfolgen bewertet
export function mc(named, N = 400, seed = 11, ctxOver = {}, over = null) {
  const rng = rngFrom(seed);
  const out = {}; for (const k of Object.keys(named)) out[k] = { wall: [], E: [], on: [] };
  for (let i = 0; i < N; i++) {
    const P = makePmix(rng); if (over) Object.assign(P, over);
    const F = fit(P);
    for (const k in F.B) F.B[k] *= Math.exp(gauss(rng) * 0.25 / Math.sqrt(F.nObs[k])); // Schaetzfehler von B (Streuung je Lauf ~25 %)
    const ctx = L2CTX(ctxOver);
    for (const k of Object.keys(named)) {
      const v = named[k]; const ev = Array.isArray(v) ? evalOrder(v, ctx, P, F) : evalOrder(v.order, v.ctxOver ? L2CTX({ ...ctxOver, ...v.ctxOver }) : ctx, P, F, v.opt || {});
      out[k].wall.push(ev.wall); out[k].E.push(ev.E); out[k].on.push(ev.on);
    }
  }
  return out;
}
export function summarize(out, baseName) {
  const rows = [];
  for (const k of Object.keys(out)) {
    const o = out[k], b = out[baseName];
    const d = o.wall.map((w, i) => w - b.wall[i]);
    const dE = o.E.map((w, i) => w - b.E[i]);
    rows.push({ name: k, wall: [quant(o.wall, 0.1), quant(o.wall, 0.5), quant(o.wall, 0.9)], on: [quant(o.on, 0.1), quant(o.on, 0.5), quant(o.on, 0.9)],
      E: [quant(o.E, 0.1), quant(o.E, 0.5), quant(o.E, 0.9)],
      dWall: [quant(d, 0.1), quant(d, 0.5), quant(d, 0.9)], dE: [quant(dE, 0.1), quant(dE, 0.5), quant(dE, 0.9)], pBetter: d.filter((x) => x < 0).length / d.length });
  }
  return rows;
}

export function beamPrefix(ref, ctx, P, F, depth = 8, width = 250) {
  let beam = [{ pre: [1], v: evalOrder(completeOrder([1], ref), ctx, P, F).wall }];
  for (let d = 1; d < depth; d++) {
    const nxt = new Map();
    for (const b of beam) {
      for (let n = 1; n <= 15; n++) {
        const cnt = b.pre.filter((x) => x === n).length; if (cnt >= 3) continue;
        const pre = b.pre.concat(n);
        const ord = completeOrder(pre, ref);
        const ev = evalOrder(ord, ctx, P, F);
        if (ev.infeasible) continue;
        nxt.set(pre.join(','), { pre, v: ev.wall });
      }
    }
    beam = [...nxt.values()].sort((a, b) => a.v - b.v).slice(0, width);
  }
  return beam;
}

function pol(order, ctx, P, F, opt) { // lokales Polieren: alle Einfuege-Zuege, solange es besser wird
  let cur = order.slice(), v = evalOrder(cur, ctx, P, F, opt).wall, improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < cur.length; i++) for (let j = 1; j < cur.length; j++) {
      if (i === j) continue;
      const c = cur.slice(); const [x] = c.splice(i, 1); c.splice(j, 0, x);
      const w = evalOrder(c, ctx, P, F, opt).wall;
      if (w < v - 1e-9) { cur = c; v = w; improved = true; }
    }
  }
  return { order: cur, v };
}

export function bestOrder(ctx, P, F, seeds = [1, 2, 3, 4, 5, 6], iters = 40000, opt = {}) {
  let best = null;
  for (const s of seeds) {
    const sa = anneal(s % 2 ? LAUF1_ORDER : VARIANTS['b2 BN10+BN9 ganz spaet (vor BN8)'], ctx, P, F, { seed: s, iters, ...opt });
    const p = pol(sa.order, ctx, P, F, opt);
    if (!best || p.v < best.v) best = p;
  }
  return best;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const full = process.argv.includes('full');
  const P = makeP(0.5);
  const cal = calibration(P);
  const F = cal.F;
  const A = 'a  Route 1 (Lauf-1-Reihenfolge)';
  console.log('=== 1. EICHUNG gegen Lauf 1 (Mitte-Parameter) ===');
  console.log('p1 (Erststufen-Aufschlag, log) =', fmt(F.p1, 3), '(roh', fmt(F.p1raw, 3) + ')  -> nicht nachweisbar');
  console.log('B (Stunden ohne SF-Gewinn, reifer Bot):', Object.entries(F.B).map(([k, v]) => k + '=' + fmt(v)).join(' '));
  const cntk = {}; for (const r of cal.rows) { const k = r.node + r.method; cntk[k] = (cntk[k] || 0) + 1; }
  const byNode = {};
  for (const r of cal.rows) {
    const o = (byNode[r.node] ||= { obs: 0, pred: 0, loo: 0, obsL: 0, n: 0, imp: 0, wall: 0 });
    o.obs += r.obs; o.pred += r.pred; o.n++; o.imp += r.imputed ? 1 : 0; o.wall += r.wall;
    if (cntk[r.node + r.method] > 1) { o.loo += r.loo; o.obsL += r.obs; }
  }
  // Hold-out: alle dritten Stufen weglassen, aus den uebrigen vorhersagen
  const skip3 = new Set(lauf1(P).runs.filter((r) => r.level === 3 && r.node !== 8).map((r) => r.i));
  const F3 = fit(P, skip3);
  const ho = {}; let hoO = 0, hoP = 0;
  { const seen = new Set(); for (const r of lauf1(P).runs) { if (r.partial) continue; const key = r.node + r.method; const erst = !seen.has(key); seen.add(key);
      if (!skip3.has(r.i) || F3.B[key] == null) continue;
      const p = runE(ctx1(r.start), P, F3, r.sf, r.node, r.method, erst, r.start);
      (ho[r.node] ||= [0, 0]); ho[r.node][0] += p; ho[r.node][1] += r.eff; hoP += p; hoO += r.eff; } }
  console.log('Knoten | Laeufe (imputiert) | Ist E | Modell E | Fehler in-sample | Fehler Leave-one-out (Summe) | Hold-out 3. Stufe');
  for (const n of Object.keys(byNode).map(Number).sort((a, b) => a - b)) {
    const o = byNode[n];
    console.log(`BN${n} | ${o.n} (${o.imp}) | ${fmt(o.obs)} | ${fmt(o.pred)} | ${fmt((o.pred / o.obs - 1) * 100)} % | ${o.obsL ? fmt((o.loo / o.obsL - 1) * 100) + ' %' : 'n/a'} | ${ho[n] ? fmt((ho[n][0] / ho[n][1] - 1) * 100) + ' % (' + fmt(ho[n][1]) + ')' : '-'}`);
  }
  console.log(`Summe E: Ist ${fmt(cal.totObs)} Modell ${fmt(cal.totPred)} (${fmt((cal.totPred / cal.totObs - 1) * 100)} %); Hold-out 3. Stufen: Ist ${fmt(hoO)} Modell ${fmt(hoP)} (${fmt((hoP / hoO - 1) * 100)} %)`);
  let exc = 0, excW = 0;
  for (const r of lauf1(P).runs) { if (r.partial) continue; const I = unreif(P, r.start, r.method); const x = r.eff * (1 - 1 / I); exc += x; excW += x * (r.wall / r.eff); }
  console.log(`Unreife-Prior: ${fmt(exc)} eff-h = ${fmt(excW)} Wanduhr-h (CHRONIK Abschn. 4: 33 h belegte Fehler + BN6.1 <= 56 + BN10.2 21,5 + Spannen = Rahmen 60-160)`);
  const looRows = cal.rows.filter((r) => cntk[r.node + r.method] > 1);
  const ae = looRows.map((r) => Math.abs(r.loo / r.obs - 1)).sort((a, b) => a - b);
  const aeM = looRows.filter((r) => !r.imputed).map((r) => Math.abs(r.loo / r.obs - 1)).sort((a, b) => a - b);
  const within15 = looRows.filter((r) => Math.abs(r.loo / r.obs - 1) <= 0.15).length;
  console.log(`LOO je Lauf (n=${ae.length}): Median |Fehler| ${fmt(ae[Math.floor(ae.length / 2)] * 100)} %  P90 ${fmt(ae[Math.floor(ae.length * 0.9)] * 100)} %; innerhalb 15 %: ${within15}/${ae.length}; nur gemessene Laeufe (n=${aeM.length}): Median ${fmt(aeM[Math.floor(aeM.length / 2)] * 100)} % P90 ${fmt(aeM[Math.floor(aeM.length * 0.9)] * 100)} %`);
  let wK = 0, oK = 0; for (const r of chron) if (r.onlineH != null) { wK += r.wallH; oK += r.onlineH; }
  const q1 = 1 - oK / wK;
  let wallPred = 0, wallObs = 0; const wn = {};
  for (const r of cal.rows) { const w = r.method === 'V2' ? r.pred / (1 - q1 + P.c2 * q1) : r.pred / (1 - q1); wallPred += w; wallObs += r.wall; (wn[r.node] ||= [0, 0]); wn[r.node][0] += w; wn[r.node][1] += r.wall; }
  console.log(`Wanduhr-Eichung mit q=${fmt(q1, 3)} (Lauf 1, gemessen): Ist ${fmt(wallObs)} Modell ${fmt(wallPred)} (${fmt((wallPred / wallObs - 1) * 100)} %); je Knoten: ` +
    Object.keys(wn).map(Number).sort((a, b) => a - b).map((n) => `BN${n} ${fmt((wn[n][0] / wn[n][1] - 1) * 100, 0)}%`).join(' '));

  console.log('\n=== 2. Waterfall Route 1: Lauf 1 -> Lauf 2 (Mitte, E = effektive Stunden) ===');
  const dates = lauf1(P).runs.map((r) => r.start); dates.push(Date.parse('2026-11-13T12:00:00Z'), Date.parse('2026-11-15T12:00:00Z')); // BN8.2 (laeuft) und 8.3
  // chronik hat 44 Zeilen inkl. 8.2; LAUF1_ORDER hat 45 (8.3 am Ende); BN8.2 ist in der Eichung ausgenommen, hier voll modelliert
  const w0 = evalOrder(LAUF1_ORDER, L2CTX({ graftOn: false, goOn: false, casino: false }), P, F, { dates: dates.slice(0, 44).concat([Date.parse('2026-11-15T12:00:00Z')]) });
  const base = { graftOn: false, goOn: false, casino: false };
  const steps = [['Lauf 1 modelliert (Unreife, Go ab 27.10., Graft ab 07.11.)', w0.E], ['Bot reif (I=1), sonst Lauf-1-Stand', evalOrder(LAUF1_ORDER, L2CTX(base), P, F).E],
    ['+ Go ab Lauf 1 (V2)', evalOrder(LAUF1_ORDER, L2CTX({ ...base, goOn: true }), P, F).E], ['+ Graft ab SF10.1/BN10', evalOrder(LAUF1_ORDER, L2CTX({ ...base, goOn: true, graftOn: true }), P, F).E],
    ['+ Casino in BN8 (Lauf 2)', evalOrder(LAUF1_ORDER, L2CTX(), P, F).E]];
  let prev = null; for (const [lab, e] of steps) { console.log(`${lab} | ${fmt(e, 0)}${prev != null ? ' | Schritt ' + fmt(e - prev, 0) : ''}`); prev = e; }

  const L2 = L2CTX();
  console.log('\n=== 3. LAUF 2, Mitte-Parameter (q=' + P.q + ', c2=' + P.c2 + ') ===');
  for (const k of Object.keys(VARIANTS)) {
    const ev = evalOrder(VARIANTS[k], L2, P, F);
    console.log(`${k} | E ${fmt(ev.E, 0)} | online ${fmt(ev.on, 0)} | Wanduhr ${fmt(ev.wall, 0)}${ev.infeasible ? ' INFEASIBLE bei ' + ev.at : ''}`);
  }
  const bo = bestOrder(L2, P, F);
  const bev = evalOrder(bo.order, L2, P, F);
  console.log(`f  Suche (Mitte): Wanduhr ${fmt(bev.wall, 0)} E ${fmt(bev.E, 0)} | ${compress(bo.order)}`);
  console.log('   Reihenfolge:', orderStr(bo.order));
  const ev1 = evalOrder(LAUF1_ORDER, L2, P, F);
  console.log('Route 1 je Lauf (Mitte):', ev1.runs.map((r) => `${r.node}.${r.level}${r.m === 'V1' ? 'v1' : ''}:${fmt(r.e, 0)}`).join(' '));
  if (full) {
    const named = { ...VARIANTS, 'f  Suchergebnis (Mitte)': bo.order,
      'g1 Route 1, BN4 frei (V1 wo billiger)': { order: LAUF1_ORDER, opt: {}, ctxOver: { bn4: 'free' } } };
    const out = mc(named, 500, 11);
    const rows = summarize(out, A);
    console.log('\n=== 4. MONTE-CARLO (500 Ziehungen: Parameter, B-Schaetzfehler; paarweise gegen Route 1) ===');
    for (const r of rows) console.log(`${r.name} | Wanduhr P10/P50/P90 ${r.wall.map((x) => fmt(x, 0)).join('/')} | online P50 ${fmt(r.on[1], 0)} | E P50 ${fmt(r.E[1], 0)} | dWanduhr vs a: ${r.dWall.map((x) => fmt(x, 0)).join('/')} | dE ${r.dE.map((x) => fmt(x, 0)).join('/')} | P(besser) ${fmt(r.pBetter * 100, 0)} %`);

    console.log('\n=== 5. Ablation: Wanduhr-Differenz zu Route 1 (Mitte) ===');
    const names = [A, 'b1 BN10+BN9 vor BN7 (nach BN6.2/6.3)', 'b2 BN10+BN9 ganz spaet (vor BN8)', 'c1 BN8 direkt nach BN6.1', 'c3 BN8 nach BN10+BN9+BN4+BN1/5', 'd2 Stufen verteilt (erst alle L1, dann L2, dann L3)', 'e3 Anfang 1 6 4 5', 'h1 V1-Block zuerst (1x3 4 5x3), dann BN6', 'f'];
    console.log('Spalten:', names.map((n) => n.slice(0, 3)).join(' | '));
    for (const [lab, over] of [['alles an', {}], ['SF-Gewinne aus', { gscale: 0 }], ['Graft aus (lo)', { u: 0 }], ['Kaltstart-Zuschlaege aus (k=0, pi4=1)', { k1: 0, k5: 0, k8: 0, pi4: 1, pi4v1: 1 }], ['beides aus', { gscale: 0, k1: 0, k5: 0, k8: 0, pi4: 1, pi4v1: 1 }], ['nur k8 aus', { k8: 0 }], ['nur pi4 aus', { pi4: 1, pi4v1: 1 }]]) {
      const Pa = makeP(0.5, over); const Fa = fit(Pa);
      const bs = evalOrder(LAUF1_ORDER, L2, Pa, Fa).wall;
      console.log(lab.padEnd(40), names.map((n) => fmt(evalOrder(n === 'f' ? bo.order : VARIANTS[n], L2, Pa, Fa).wall - bs, 0)).join(' | '), ' (Route 1 ' + fmt(bs, 0) + ')');
    }

    console.log('\n=== 6. Suche je Szenario (Route 1 -> bestes Ergebnis, Wanduhr h) ===');
    for (const [lab, u, over, cx] of [['SF-Gewinne klein (u=0)', 0, {}, {}], ['SF-Gewinne mittel (u=0,5)', 0.5, {}, {}], ['SF-Gewinne gross (u=1)', 1, {}, {}], ['Mitte, q=0,10', 0.5, { q: 0.1 }, {}], ['Mitte, q=0,40', 0.5, { q: 0.4 }, {}], ['Mitte + Boerse in V2 (SF8-Gewinne)', 0.5, {}, { stocksV2: true }], ['Mitte, Kaltstart-Zuschlaege aus', 0.5, { k1: 0, k5: 0, k8: 0, pi4: 1, pi4v1: 1 }, {}], ['Mitte, SF-Gewinne aus', 0.5, { gscale: 0 }, {}]]) {
      const Pu = makeP(u, over); const Fu = fit(Pu); const cu = L2CTX(cx); const b = bestOrder(cu, Pu, Fu, [1, 2, 3], 25000);
      const w0_ = evalOrder(LAUF1_ORDER, cu, Pu, Fu).wall, w1_ = evalOrder(b.order, cu, Pu, Fu).wall;
      console.log(`${lab}: Route 1 ${fmt(w0_, 0)}  Suche ${fmt(w1_, 0)}  Gewinn ${fmt(w0_ - w1_, 0)} h | ${compress(b.order)}`);
    }

    console.log('\n=== 7. Kaltstart: Anfangsfolgen (Beam, Mitte; Rest nach Suchergebnis) ===');
    const beam = beamPrefix(bo.order, L2, P, F, 9, 200);
    for (const b of beam.slice(0, 8)) console.log(b.pre.join(' '), fmt(b.v, 0));
    console.log('--- Beam, Rest nach Lauf-1-Reihenfolge ---');
    const beam1 = beamPrefix(LAUF1_ORDER, L2, P, F, 9, 200);
    for (const b of beam1.slice(0, 8)) console.log(b.pre.join(' '), fmt(b.v, 0));
    console.log('--- Empfindlichkeit: BN6 vor BN4 (e3) gegen Route 1, Wanduhr-Differenz je pi4 / k1 ---');
    for (const pi4 of [1.0, 1.2, 1.5, 2.0, 3.0]) {
      const Pa = makeP(0.5, { pi4 }); const Fa = fit(Pa);
      console.log('pi4=' + pi4, 'e3-a:', fmt(evalOrder(VARIANTS['e3 Anfang 1 6 4 5'], L2, Pa, Fa).wall - evalOrder(LAUF1_ORDER, L2, Pa, Fa).wall, 1), ' e7-a:', fmt(evalOrder(VARIANTS['e7 Anfang 1 6 10x3 (BN4/5 spaeter)'], L2, Pa, Fa).wall - evalOrder(LAUF1_ORDER, L2, Pa, Fa).wall, 1));
    }
    for (const k1 of [0, 0.25, 0.5, 1.0]) {
      const Pa = makeP(0.5, { k1, k5: k1 * 0.4 }); const Fa = fit(Pa);
      console.log('k1=' + k1, 'h1-a:', fmt(evalOrder(VARIANTS['h1 V1-Block zuerst (1x3 4 5x3), dann BN6'], L2, Pa, Fa).wall - evalOrder(LAUF1_ORDER, L2, Pa, Fa).wall, 1), ' h2-a:', fmt(evalOrder(VARIANTS['h2 Route 1, aber SF1.2/1.3 vorgezogen'], L2, Pa, Fa).wall - evalOrder(LAUF1_ORDER, L2, Pa, Fa).wall, 1));
    }

    console.log('\n=== 8. Gleiche Anfangsvarianten, BN4 frei waehlbar (V1 wo billiger) - Basis a = Route 1 mit freier BN4-Wahl ===');
    {
      const nm = { 'a': LAUF1_ORDER };
      for (const k of ['e2 Anfang 1 5 4 6', 'e3 Anfang 1 6 4 5', 'e4 Anfang 1 6 5 4', 'e5 Anfang 1 4 6 5', 'e7 Anfang 1 6 10x3 (BN4/5 spaeter)', 'h1 V1-Block zuerst (1x3 4 5x3), dann BN6', 'h2 Route 1, aber SF1.2/1.3 vorgezogen', 'h4 h1 + BN14 nach BN9', 'b1 BN10+BN9 vor BN7 (nach BN6.2/6.3)', 'd1 Stufen gruppiert (alle 3 Stufen am Stueck)']) nm[k] = VARIANTS[k];
      nm['f  Suche (Mitte, BN4 gebunden)'] = bo.order;
      const o2 = mc(nm, 500, 21, { bn4: 'free' });
      for (const r of summarize(o2, 'a')) console.log(`${r.name} | Wanduhr P50 ${fmt(r.wall[1], 0)} | dWanduhr ${r.dWall.map((x) => fmt(x, 0)).join('/')} | P(besser) ${fmt(r.pBetter * 100, 0)} %`);
      const bf = bestOrder(L2CTX({ bn4: 'free' }), P, F, [1, 2, 3], 25000);
      console.log('Suche mit freier BN4-Wahl (Mitte):', fmt(evalOrder(bf.order, L2CTX({ bn4: 'free' }), P, F).wall, 0), 'gegen Route 1 frei', fmt(evalOrder(LAUF1_ORDER, L2CTX({ bn4: 'free' }), P, F).wall, 0), '|', compress(bf.order));
      for (const pi4 of [1.0, 1.2, 1.5, 2.0]) { const Pa = makeP(0.5, { pi4 }); const Fa = fit(Pa); const cf = L2CTX({ bn4: 'free' });
        console.log('pi4=' + pi4, 'BN6 vor SF4 (e3) minus Route 1:', fmt(evalOrder(VARIANTS['e3 Anfang 1 6 4 5'], cf, Pa, Fa).wall - evalOrder(LAUF1_ORDER, cf, Pa, Fa).wall, 1)); }
    }
    console.log('\n=== 9. Mit Boerse in V2 (SF8-Gewinne wirken): BN8 frueher? ===');
    {
      const nm = { 'a': LAUF1_ORDER };
      for (const k of ['c1 BN8 direkt nach BN6.1', 'c2 BN8 nach BN10 (SF10 fuer Graft/Sleeves)', 'c3 BN8 nach BN10+BN9+BN4+BN1/5', 'c4 BN8 nach BN11 (mitten in der Route)']) nm[k] = VARIANTS[k];
      for (const sv of [false, true]) {
        const o3 = mc(nm, 400, 31, { stocksV2: sv });
        console.log('stocksV2 =', sv);
        for (const r of summarize(o3, 'a')) console.log(`${r.name} | Wanduhr P50 ${fmt(r.wall[1], 0)} | dWanduhr ${r.dWall.map((x) => fmt(x, 0)).join('/')} | P(besser) ${fmt(r.pBetter * 100, 0)} %`);
      }
    }
  }
}
