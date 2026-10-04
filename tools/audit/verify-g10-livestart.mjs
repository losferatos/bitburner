// Gegenpruefung G10 (BLADE-1): Prognose fuer das LAUFENDE BN2.2 ab dem Stand 13:17 (Ortszeit).
// 1) K = Raid-Chance bei Stufe 1, pop 1e9, Chaos <= 50 (Kompetenz/Schwierigkeit) aus den
//    Spielstaenden 11:17 / 12:15 / 13:17 -> gemessenes Wachstum g je Stunde (Eichung: Raid
//    s.min Soll aus data/blade.json gegen Nachbau).
// 2) Monte-Carlo ab dem echten Stadtzustand 13:17: Bot-Regel gegen bevoelkerungsbewusste Regel.
// Aufruf: node tools/audit/verify-g10-livestart.mjs [--n 3000]
import path from "node:path";
import { ladeSpielstand, flach, homeDatei } from "./blade-lage.mjs";
import { AKTIONEN, successChance } from "./blade-formeln.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const NRUNS = (() => { const i = process.argv.indexOf("--n"); return i >= 0 ? Number(process.argv[i + 1]) : 3000; })();
const dateien = [
  ["BN2L2_2026-10-04T11-17_hourly", "09:17Z = 11:17 lokal"],
  ["BN2L2_2026-10-04T12-15_pre-hotswap", "12:15Z = 12:15 lokal?"],
  ["BN2L2_2026-10-04T13-17_hourly", "13:17"],
];
import fs from "node:fs";
const alle = fs.readdirSync(path.join(root, "backups")).filter((f) => f.includes("BN2L2")).sort();
console.log("BN2.2-Staende:", alle.join(", "));
const Ks = [];
for (const f of alle) {
  const { p, servers } = ladeSpielstand(path.join(root, "backups", f));
  const bb = flach(p.bladeburner);
  const P = { skills: p.skills, mults: p.mults };
  const BB = { skills: bb.skills, stamina: bb.maxStamina, maxStamina: bb.maxStamina, staminaBonus: bb.staminaBonus };
  const K = successChance(AKTIONEN.Raid, 1, P, BB, { pop: 1e9, popEst: 1e9, chaos: 0, comms: 100 });
  const bj = JSON.parse(homeDatei(servers, "data/blade.json") || "null");
  // Eichung: s.min der laufenden Aktion
  let eich = "";
  if (bb.action && bb.action.name === "Raid" && bj) {
    const c = bb.cities[bb.city];
    const L = bb.operations.Raid.level;
    const BB2 = { ...BB, stamina: bb.stamina };
    const real = successChance(AKTIONEN.Raid, L, P, BB2, c);
    const est = successChance(AKTIONEN.Raid, L, P, BB2, c, { est: true });
    const d = Math.abs(real - est); let lo = real - d; const r = c.pop / c.popEst; if (r < 1) lo *= r;
    eich = " | s.min Soll " + bj.chance + " Ist " + Math.max(0, lo).toFixed(4);
  }
  Ks.push({ f, K, tp: p.playtimeSinceLastBitnode / 3.6e6 });
  console.log(f.padEnd(40), "Spielzeit im Knoten", (p.playtimeSinceLastBitnode / 3.6e6).toFixed(2) + " h", "K (Raid L1, pop 1e9)", K.toFixed(4), "Raid L" + bb.operations.Raid.level, eich);
}
const a = Ks[0], z = Ks[Ks.length - 1];
const g = Math.log(z.K / a.K) / (z.tp - a.tp);
console.log("K-Wachstum g:", g.toFixed(3), "je Stunde (ln-Mittel ueber", (z.tp - a.tp).toFixed(2), "h)");

// --- Monte-Carlo ab dem echten Stand (letzter Spielstand) ---------------------------
function rng32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const NAMEN = ["Sector-12", "Aevum", "Volhaven", "Chongqing", "New Tokyo", "Ishima"];
const faktor = (ch) => (ch > 50 ? Math.sqrt(1 + ch - 50) : 1);
const wertBot = (c) => c.popEst / faktor(c.chaos);
const wertPop = (c) => (c.comms >= 3 ? Math.pow(c.pop / 1e9, 0.7) / faktor(c.chaos) : 0);
const needed = (L) => Math.ceil(0.5 * L * (5 + L - 1));
const clampI = (x) => Math.max(0, Math.round(x));
function popPct(c, p, eq) { let ch = Math.round(c.pop * (p / 100)); if (ch === 0) ch = p > 0 ? 1 : -1; c.pop = clampI(c.pop + ch); if (eq) c.popEst = clampI(c.popEst + ch); }
function ereignis(cs, r) {
  const chance = r(); const si = ri(r, 0, 5); let di = ri(r, 0, 5); while (di === si) di = ri(r, 0, 5);
  const S = cs[si], D = cs[di]; const wachs = (c) => { if (c.pop < 1.5e9) c.pop += 100; };
  const migr = (srcI) => { let dI = ri(r, 0, 5); while (dI === srcI) dI = ri(r, 0, 5); const src = cs[srcI], dst = cs[dI]; let pc = ri(r, 3, 15) / 100; if (r() < 0.05 && src.comms > 0) { pc *= ri(r, 2, 4); src.comms--; dst.comms++; } const n = Math.round(src.pop * pc); src.pop = clampI(src.pop - n); dst.pop = clampI(dst.pop + n); wachs(dst); };
  if (chance <= 0.05) { S.comms++; S.pop = clampI(S.pop + Math.round(S.pop * ri(r, 10, 20) / 100)); wachs(S); }
  else if (chance <= 0.1) { if (S.comms <= 0) { S.comms++; S.pop = clampI(S.pop + Math.round(S.pop * ri(r, 10, 20) / 100)); wachs(S); } else { S.comms--; D.comms++; const n = Math.round(S.pop * ri(r, 10, 20) / 100); S.pop = clampI(S.pop - n); D.pop = clampI(D.pop + n); wachs(D); } }
  else if (chance <= 0.3) { S.pop = clampI(S.pop + Math.round(S.pop * ri(r, 8, 24) / 100)); wachs(S); }
  else if (chance <= 0.5) migr(si);
  else if (chance <= 0.7) { S.chaos = Math.max(0, S.chaos + 1); S.chaos = Math.max(0, S.chaos * (1 + ri(r, 5, 20) / 100)); }
  else if (chance <= 0.9) { S.pop = clampI(S.pop - Math.round(S.pop * ri(r, 8, 20) / 100)); }
}
const letzte = alle[alle.length - 1];
const { p: pL } = ladeSpielstand(path.join(root, "backups", letzte));
const bbL = flach(pL.bladeburner);
const start = NAMEN.map((n) => ({ pop: bbL.cities[n].pop, popEst: bbL.cities[n].popEst, comms: bbL.cities[n].comms, chaos: bbL.cities[n].chaos }));
const L0 = bbL.operations.Raid.level, succ0 = bbL.operations.Raid.successes;
console.log("\nStart (", letzte, "): Raid L" + L0, "Erfolge", succ0, "Division in", bbL.city, "| Staedte:", NAMEN.map((n, i) => n.slice(0, 3) + " " + (start[i].pop / 1e6).toFixed(0) + "M/est " + (start[i].popEst / 1e6).toFixed(0) + "M/ch " + start[i].chaos.toFixed(1)).join(", "));
const K0 = z.K;
function lauf(pol, A, H, gg, seed, marge = 1.2) {
  const re = rng32(900 + seed), ro = rng32(77 + seed);
  const cs = start.map((c) => ({ ...c })); let cur = 0, t = 0, evT = ri(re, 240, 600);
  let maxL = L0, succ = succ0, rang = 0, sw = 0; const dt = 3600 / A, N = Math.round(A * H); const prof = [];
  for (let k = 0; k < N; k++) {
    t += dt; while (evT <= t) { ereignis(cs, re); evT += ri(re, 240, 600); }
    for (const c of cs) c.chaos = Math.max(0, c.chaos - 0.0001 * dt);
    let neu = cur;
    if (pol === "bot") {
      let b = -1, bw = wertBot(cs[cur]); for (let i = 0; i < 6; i++) { if (i !== cur && wertBot(cs[i]) > bw) { bw = wertBot(cs[i]); b = i; } }
      if (b >= 0 && bw > wertBot(cs[cur]) * 2) neu = b;
      if (cs[neu].comms < 3) { let bi = -1, bc = 0; for (let i = 0; i < 6; i++) if (i !== neu && cs[i].comms > bc) { bc = cs[i].comms; bi = i; } if (bi >= 0 && bc >= 55) neu = bi; }
    } else if (pol === "pop") {
      let b = -1, bw = wertPop(cs[cur]); for (let i = 0; i < 6; i++) { if (i !== cur && wertPop(cs[i]) > bw) { bw = wertPop(cs[i]); b = i; } }
      if (b >= 0 && bw > wertPop(cs[cur]) * marge) neu = b;
    }
    if (neu !== cur) { sw++; cur = neu; }
    const c = cs[cur]; const K = K0 * Math.exp(gg * t / 3600); const L = maxL;
    const p = c.comms <= 0 ? 0 : Math.min(1, K * Math.pow(1.045, -(L - 1)) * Math.pow(c.pop / 1e9, 0.7) / faktor(c.chaos));
    const ok = ro() < p; rang += ok ? 55 * Math.pow(1.1, L - 1) : -2.5 * Math.pow(1.1, L - 1);
    if (ok) { succ++; if (succ >= needed(maxL)) maxL++; c.pop = clampI(c.pop - 0); popPct(c, -1, true); c.comms--; } else { popPct(c, ri(ro, -10, -5) / 10, false); }
    c.chaos = Math.max(0, c.chaos * (1 + ri(ro, 1, 5) / 100));
    if ((k + 1) % Math.round(A) === 0) prof.push(rang);
  }
  return { rang, maxL, sw, prof };
}
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
for (const gg of [0, Math.max(0, g), 0.23]) {
  for (const A of [16, 25, 40]) {
    for (const H of [3, 6, 10]) {
      const rb = [], rp = [], sb = [], sp = [];
      for (let i = 0; i < NRUNS; i++) { const o = lauf("bot", A, H, gg, i), q = lauf("pop", A, H, gg, i); rb.push(o.rang); rp.push(q.rang); sb.push(o.sw); sp.push(q.sw); }
      console.log("g", gg.toFixed(2), "A", String(A).padStart(2), "H", String(H).padStart(2), "| Raid-Rang bot", mean(rb).toFixed(0).padStart(6), "pop-bewusst", mean(rp).toFixed(0).padStart(6), "| Gewinn", (mean(rp) - mean(rb)).toFixed(0).padStart(5), "= je Stunde", ((mean(rp) - mean(rb)) / H).toFixed(0).padStart(4), "(" + (100 * (mean(rp) / mean(rb) - 1)).toFixed(0) + " %) | Wechsel bot", mean(sb).toFixed(1), "pop", mean(sp).toFixed(1));
    }
  }
}
