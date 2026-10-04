// Gegenpruefung G10 (BLADE-1): Monte-Carlo der Stadtdynamik von Bladeburner (Quelle:
// Bladeburner.ts completeOperation :803-870, randomEvent :601-697, City.ts, Action.ts,
// LevelableAction.ts). Vergleicht die Stadtwahl des Bots (blade.js:2788-2850, Wert popEst/
// Chaosfaktor, Vorsprung 2, Rundreise comms<3) gegen eine bevoelkerungsbewusste Wahl.
//
// EICHUNG (Soll = Spielstand, Ist = Nachbau) laeuft zuerst:
//   E1 Chaoswachstum + Bevoelkerungsabbau von Sector-12 BN2.1 05:33 -> 09:59 (129 Versuche)
//   E2 Zufallsstreuung der Bevoelkerung ungenutzter Staedte (ln-Aenderung je Stunde)
//   E3 BN2.2 Sector-12 11:17 -> 13:17 (49 Versuche)
// Aufruf: node tools/audit/verify-g10-stadtsim.mjs [--n 2000]
import fs from "node:fs";
import path from "node:path";
import { ladeSpielstand, flach } from "./blade-lage.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const NRUNS = (() => { const i = process.argv.indexOf("--n"); return i >= 0 ? Number(process.argv[i + 1]) : 2000; })();

function rng32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const clampI = (x, lo = 0) => Math.max(lo, Math.round(x));
const NAMEN = ["Sector-12", "Aevum", "Volhaven", "Chongqing", "New Tokyo", "Ishima"];

// --- Stadt wie City.ts ---------------------------------------------------
function neueStadt(r) {
  const pop = ri(r, 1e9, 1.5e9);
  return { pop, popEst: pop * (r() + 0.5), comms: ri(r, 5, 150), chaos: 0 };
}
const changePopPct = (c, p, { nonZero, eqEst }) => {
  let ch = Math.round(c.pop * (p / 100));   // clampInteger OHNE Untergrenze wie City.ts:changePopulationByPercentage
  if (nonZero && ch === 0) ch = p > 0 ? 1 : -1;
  c.pop = clampI(c.pop + ch);
  if (eqEst) c.popEst = clampI(c.popEst + ch);
};
const changePopCount = (c, n) => { c.pop = clampI(c.pop + n); };
const changeChaosPct = (c, p) => { c.chaos = Math.max(0, c.chaos * (1 + p / 100)); };
const changeChaosCnt = (c, n) => { c.chaos = Math.max(0, c.chaos + n); };

// --- Zufallsereignis wie Bladeburner.ts:601-697 ----------------------------
function zufallsEreignis(cs, r) {
  const chance = r();
  const si = ri(r, 0, 5);
  let di = ri(r, 0, 5); while (di === si) di = ri(r, 0, 5);
  const S = cs[si], D = cs[di];
  const wachs = (c) => { if (c.pop < 1.5e9) c.pop += 100; };
  const migr = (srcI) => {
    let dI = ri(r, 0, 5); while (dI === srcI) dI = ri(r, 0, 5);
    const src = cs[srcI], dst = cs[dI];
    let pc = ri(r, 3, 15) / 100;
    if (r() < 0.05 && src.comms > 0) { pc *= ri(r, 2, 4); src.comms--; dst.comms++; }
    const n = Math.round(src.pop * pc);
    changePopCount(src, -n); changePopCount(dst, n); wachs(dst);
  };
  if (chance <= 0.05) { S.comms++; changePopCount(S, Math.round(S.pop * ri(r, 10, 20) / 100)); wachs(S); }
  else if (chance <= 0.1) {
    if (S.comms <= 0) { S.comms++; changePopCount(S, Math.round(S.pop * ri(r, 10, 20) / 100)); wachs(S); }
    else { S.comms--; D.comms++; const n = Math.round(S.pop * ri(r, 10, 20) / 100); changePopCount(S, -n); changePopCount(D, n); wachs(D); }
  } else if (chance <= 0.3) { changePopCount(S, Math.round(S.pop * ri(r, 8, 24) / 100)); wachs(S); }
  else if (chance <= 0.5) { migr(si); }
  else if (chance <= 0.7) { changeChaosCnt(S, 1); changeChaosPct(S, ri(r, 5, 20)); }
  else if (chance <= 0.9) { changePopCount(S, -Math.round(S.pop * ri(r, 8, 20) / 100)); }
}

// --- Raid-Abschluss wie Bladeburner.ts:830-843 -----------------------------
function raidAbschluss(c, erfolg, r) {
  if (erfolg) { changePopPct(c, -1, { nonZero: true, eqEst: true }); c.comms--; }
  else { changePopPct(c, ri(r, -10, -5) / 10, { nonZero: true, eqEst: false }); }
  changeChaosPct(c, ri(r, 1, 5));
}

const faktor = (ch) => (ch > 50 ? Math.sqrt(1 + ch - 50) : 1);
const needed = (L) => Math.ceil(0.5 * L * (5 + L - 1));      // LevelableAction.getSuccessesNeededForNextLevel (2,5 je Stufe)

// --- Politiken ---------------------------------------------------------------
const wertBot = (c) => c.popEst / faktor(c.chaos);
const wertPop = (c) => Math.pow(c.pop / 1e9, 0.7) / faktor(c.chaos);
const POLITIK = {
  // blade.js:2788-2825: Wert popEst/Chaosfaktor, Wechsel nur bei > 2 x hier; danach Rundreise (:2827-2850)
  bot(cs, cur) {
    let beste = -1, bw = wertBot(cs[cur]);
    for (let i = 0; i < 6; i++) { if (i === cur) continue; const w = wertBot(cs[i]); if (w > bw) { bw = w; beste = i; } }
    if (beste >= 0 && bw > wertBot(cs[cur]) * 2) cur = beste;
    if (cs[cur].comms < 3) {
      let bi = -1, bc = 0;
      for (let i = 0; i < 6; i++) if (i !== cur && cs[i].comms > bc) { bc = cs[i].comms; bi = i; }
      if (bi >= 0 && bc >= 55) cur = bi;
    }
    return cur;
  },
  // Fix-Skizze BLADE-1: wahre pop aus r, Vorsprung 1,2
  pop12(cs, cur) {
    let beste = -1, bw = wertPop(cs[cur]);
    for (let i = 0; i < 6; i++) { if (i === cur) continue; const w = wertPop(cs[i]); if (w > bw) { bw = w; beste = i; } }
    return beste >= 0 && bw > wertPop(cs[cur]) * 1.2 ? beste : cur;
  },
  // wie pop12, aber Staedte ohne Gemeinden (Raid unmoeglich, Operation.ts:63-68) zaehlen null
  pop12c(cs, cur) {
    const w = (c) => (c.comms >= 3 ? wertPop(c) : 0);
    let beste = -1, bw = w(cs[cur]);
    for (let i = 0; i < 6; i++) { if (i === cur) continue; const x = w(cs[i]); if (x > bw) { bw = x; beste = i; } }
    return beste >= 0 && bw > w(cs[cur]) * 1.2 ? beste : cur;
  },
  // Obergrenze: jedes Mal die beste Stadt
  gierig(cs, cur) {
    let bi = cur, bw = wertPop(cs[cur]);
    for (let i = 0; i < 6; i++) { const w = wertPop(cs[i]); if (w > bw) { bw = w; bi = i; } }
    return bi;
  },
  // Keine Wahl: bleibt in Sector-12 (Vergleich "nie wechseln")
  bleib(cs, cur) { return cur; },
};

// --- ein Lauf ------------------------------------------------------------------
// opt: A Versuche je Spielstunde, H Stunden, K0 = Chance bei L1, pop 1e9, chaos<=50; g = Wachstum von K je Stunde
function lauf(politik, opt, seedInit, seedEv, seedOut, start) {
  const ri0 = rng32(seedInit), re = rng32(seedEv), ro = rng32(seedOut);
  const cs = start ? start.map((c) => ({ ...c })) : NAMEN.map(() => neueStadt(ri0));
  let cur = 0, t = 0, evT = ri(re, 240, 600);
  let succ = 0, maxL = 1, rang = 0, nAtt = 0, psum = 0, wechsel = 0, ersterWechsel = null;
  const dt = 3600 / opt.A, N = Math.round(opt.A * opt.H);
  const prof = [];
  for (let k = 0; k < N; k++) {
    t += dt;
    while (evT <= t) { zufallsEreignis(cs, re); evT += ri(re, 240, 600); }
    for (const c of cs) c.chaos = Math.max(0, c.chaos - 0.0001 * dt);
    const neu = POLITIK[politik](cs, cur);
    if (neu !== cur) { wechsel++; if (ersterWechsel === null) ersterWechsel = k; cur = neu; }
    const c = cs[cur];
    const K = opt.K0 * Math.exp((opt.g || 0) * t / 3600);
    const L = maxL;
    let p = c.comms <= 0 ? 0 : Math.min(1, K * Math.pow(1.045, -(L - 1)) * Math.pow(c.pop / 1e9, 0.7) / faktor(c.chaos));
    const gain = 55 * Math.pow(1.1, L - 1), loss = 2.5 * Math.pow(1.1, L - 1);
    const erfolg = ro() < p;
    rang += erfolg ? gain : -loss;
    psum += p; nAtt++;
    if (erfolg) { succ++; if (succ >= needed(maxL)) maxL++; }
    raidAbschluss(c, erfolg, ro);
    if ((k + 1) % Math.round(opt.A) === 0) prof.push(rang);
  }
  return { rang, succ, maxL, pMittel: psum / nAtt, wechsel, prof, cs, cur, ersterWechsel };
}

function stat(xs) {
  const s = [...xs].sort((a, b) => a - b), n = s.length, m = s.reduce((a, b) => a + b, 0) / n;
  const q = (f) => s[Math.min(n - 1, Math.floor(f * n))];
  return { mean: m, med: q(0.5), q10: q(0.1), q90: q(0.9), sd: Math.sqrt(s.reduce((a, b) => a + (b - m) ** 2, 0) / n) };
}

// =============================== EICHUNG ================================================
console.log("=== EICHUNG E1: Sector-12 BN2.1, 05:33 -> 09:59, 129 Versuche (19 Erfolge, 110 Fehlschlaege), Division bleibt ===");
{
  const { p } = ladeSpielstand(path.join(root, "backups", "LIVE_197f4d61481686_BN2L1_2026-10-03T05-33_hourly.json.gz"));
  const bb = flach(p.bladeburner);
  const start = NAMEN.map((n) => ({ pop: bb.cities[n].pop, popEst: bb.cities[n].popEst, comms: bb.cities[n].comms, chaos: bb.cities[n].chaos }));
  const sollChaos = 49.1, sollPop = 587e6, sollPopEst = 899e6, sollComms = 41;
  const chS = [], pS = [], eS = [], cS = [];
  for (let i = 0; i < NRUNS; i++) {
    const r = rng32(1000 + i), re = rng32(5000 + i);
    const cs = start.map((c) => ({ ...c }));
    // feste Abfolge: 110 Fehlschlaege, 19 Erfolge gemischt (Reihenfolge zufaellig), Events alle 240-600 s bei 4,43 h
    const folge = Array(129).fill(false); for (let k = 0; k < 19; k++) folge[k] = true;
    for (let k = folge.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [folge[k], folge[j]] = [folge[j], folge[k]]; }
    let t = 0, evT = ri(re, 240, 600); const dt = 4.43 * 3600 / 129;
    for (const ok of folge) { t += dt; while (evT <= t) { zufallsEreignis(cs, re); evT += ri(re, 240, 600); } raidAbschluss(cs[0], ok, r); }
    chS.push(cs[0].chaos); pS.push(cs[0].pop); eS.push(cs[0].popEst); cS.push(cs[0].comms);
  }
  const f = (x, d = 1) => x.toFixed(d);
  const a = stat(chS), b = stat(pS), c = stat(eS), d = stat(cS);
  console.log("  Chaos   Soll", sollChaos, " Ist Median", f(a.med), "(10-90 %:", f(a.q10), "-", f(a.q90) + ")");
  console.log("  pop     Soll", (sollPop / 1e6).toFixed(0) + "M", " Ist Median", (b.med / 1e6).toFixed(0) + "M (10-90 %:", (b.q10 / 1e6).toFixed(0), "-", (b.q90 / 1e6).toFixed(0) + "M)");
  console.log("  popEst  Soll", (sollPopEst / 1e6).toFixed(0) + "M", " Ist Median", (c.med / 1e6).toFixed(0) + "M (10-90 %:", (c.q10 / 1e6).toFixed(0), "-", (c.q90 / 1e6).toFixed(0) + "M)");
  console.log("  comms   Soll", sollComms, " Ist Median", f(d.med, 0), "(10-90 %:", f(d.q10, 0), "-", f(d.q90, 0) + ")");
}
console.log("\n=== EICHUNG E2: Streuung der Bevoelkerung ungenutzter Staedte (ln-Aenderung, 4 Stunden) ===");
{
  // Daten: BN2.1 05:33 -> 09:59 die fuenf Staedte ohne Raid (Aev, Cho, NTo, Ish, Vol); Division nur in Sector-12
  const { p: p0 } = ladeSpielstand(path.join(root, "backups", "LIVE_197f4d61481686_BN2L1_2026-10-03T05-33_hourly.json.gz"));
  const { p: p1 } = ladeSpielstand(path.join(root, "backups", "LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz"));
  const b0 = flach(p0.bladeburner), b1 = flach(p1.bladeburner);
  const lns = ["Aevum", "Chongqing", "New Tokyo", "Ishima", "Volhaven"].map((n) => Math.log(b1.cities[n].pop / b0.cities[n].pop));
  const m = lns.reduce((a, b) => a + b, 0) / lns.length, sdObs = Math.sqrt(lns.reduce((a, b) => a + (b - m) ** 2, 0) / lns.length);
  console.log("  Soll (5 Staedte BN2.1, 4,43 h): ln-Aenderungen", lns.map((x) => x.toFixed(2)).join(" "), " RMS um null", Math.sqrt(lns.reduce((a, b) => a + b * b, 0) / lns.length).toFixed(3));
  const sims = [];
  for (let i = 0; i < NRUNS; i++) {
    const r = rng32(77 + i), re = rng32(900 + i);
    const cs = NAMEN.map((n) => ({ pop: b0.cities[n].pop, popEst: b0.cities[n].popEst, comms: b0.cities[n].comms, chaos: 0 }));
    const start = cs.map((c) => c.pop);
    let t = 0, evT = ri(re, 240, 600); const T = 4.43 * 3600;
    while (true) { t = evT; if (t > T) break; zufallsEreignis(cs, re); evT += ri(re, 240, 600); }
    for (const k of [1, 2, 3, 4, 5]) sims.push(Math.log(cs[k].pop / start[k]));
  }
  const rms = Math.sqrt(sims.reduce((a, b) => a + b * b, 0) / sims.length);
  console.log("  Ist (Nachbau, ohne Raid):  RMS um null", rms.toFixed(3), " (Mittel", (sims.reduce((a, b) => a + b, 0) / sims.length).toFixed(3) + ")");
}
console.log("\n=== EICHUNG E3: Sector-12 BN2.2, 11:17 -> 13:17, 49 Versuche (5 Erfolge, 44 Fehlschlaege) ===");
{
  const { p } = ladeSpielstand(path.join(root, "backups", "LIVE_197f4d61481686_BN2L2_2026-10-04T11-17_hourly.json.gz"));
  const bb = flach(p.bladeburner);
  const start = NAMEN.map((n) => ({ pop: bb.cities[n].pop, popEst: bb.cities[n].popEst, comms: bb.cities[n].comms, chaos: bb.cities[n].chaos }));
  const soll = { pop: 582e6, popEst: 780e6, comms: 136, chaos: 0 };
  const pS = [], eS = [], cS = [];
  for (let i = 0; i < NRUNS; i++) {
    const r = rng32(31 + i), re = rng32(6000 + i);
    const cs = start.map((c) => ({ ...c }));
    const folge = Array(49).fill(false); for (let k = 0; k < 5; k++) folge[k] = true;
    for (let k = folge.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [folge[k], folge[j]] = [folge[j], folge[k]]; }
    let t = 0, evT = ri(re, 240, 600); const dt = 2 * 3600 / 49;
    for (const ok of folge) { t += dt; while (evT <= t) { zufallsEreignis(cs, re); evT += ri(re, 240, 600); } raidAbschluss(cs[0], ok, r); }
    pS.push(cs[0].pop); eS.push(cs[0].popEst); cS.push(cs[0].comms);
  }
  const b = stat(pS), c = stat(eS), d = stat(cS);
  console.log("  pop    Soll", (soll.pop / 1e6).toFixed(0) + "M", " Ist Median", (b.med / 1e6).toFixed(0) + "M (10-90 %:", (b.q10 / 1e6).toFixed(0), "-", (b.q90 / 1e6).toFixed(0) + "M)");
  console.log("  popEst Soll", (soll.popEst / 1e6).toFixed(0) + "M", " Ist Median", (c.med / 1e6).toFixed(0) + "M (10-90 %:", (c.q10 / 1e6).toFixed(0), "-", (c.q90 / 1e6).toFixed(0) + "M)");
  console.log("  comms  Soll", soll.comms, " Ist Median", d.med, "(10-90 %:", d.q10, "-", d.q90 + ")");
}

console.log("\n=== EICHUNG E4: Versuche bis zum ersten Stadtwechsel der Bot-Regel, Start BN2.1 05:33 (Soll: Wechsel nach ~153-160 Versuchen insgesamt = 129-136 ab Start) ===");
{
  const { p } = ladeSpielstand(path.join(root, "backups", "LIVE_197f4d61481686_BN2L1_2026-10-03T05-33_hourly.json.gz"));
  const bb = flach(p.bladeburner);
  const start = NAMEN.map((n) => ({ pop: bb.cities[n].pop, popEst: bb.cities[n].popEst, comms: bb.cities[n].comms, chaos: bb.cities[n].chaos }));
  const erste = [];
  for (let i = 0; i < NRUNS; i++) {
    const o = lauf("bot", { A: 30, H: 12, K0: 0.089, g: 0.23 }, 1, 2000 + i, 3000 + i, start, true);
    erste.push(o.ersterWechsel ?? 999);
  }
  const s2 = stat(erste.filter((x) => x < 999));
  console.log("  Ist (Nachbau): erster Wechsel nach Versuch", s2.med.toFixed(0), "(10-90 %:", s2.q10, "-", s2.q90 + "), nie gewechselt in 360 Versuchen:", (100 * erste.filter((x) => x === 999).length / erste.length).toFixed(0) + " %");
  console.log("  Soll: Wechsel bei Versuch ~129-136 ab Start (Chaos 49,1 -> 51)");
}

// =============================== VERGLEICH ==============================================
console.log("\n=== VERGLEICH der Stadtwahl (Zufallsstart wie City-Konstruktor, Division startet in Sector-12) ===");
console.log("A = Raid-Versuche je Spielstunde; K0 = Chance Raid L1 bei pop 1e9; g = Kompetenzwachstum je Stunde; Rang = Summe EV (Raid) ueber H Stunden");
const SZ = [
  { name: "BN2.2 live K0 0.089 konstant", K0: 0.089, g: 0 },
  { name: "wachsende Kompetenz (g 0.23/h wie BN2.1)", K0: 0.089, g: 0.23 },
];
for (const sz of SZ) {
  for (const A of [16, 25, 40]) {
    for (const H of [3, 6, 10]) {
      const res = {};
      for (const pol of ["bot", "pop12", "pop12c", "gierig", "bleib"]) {
        const rs = [], ps = [], ls = [], ws = [];
        for (let i = 0; i < NRUNS; i++) {
          const o = lauf(pol, { A, H, K0: sz.K0, g: sz.g }, 100 + i, 200 + i, 300 + i);
          rs.push(o.rang); ps.push(o.pMittel); ls.push(o.maxL); ws.push(o.wechsel);
        }
        res[pol] = { rang: stat(rs), p: stat(ps).mean, L: stat(ls).mean, w: stat(ws).mean };
      }
      const b = res.bot.rang.mean;
      console.log(sz.name.padEnd(42), "A", String(A).padStart(2), "H", String(H).padStart(2), "|",
        "Rang bot", b.toFixed(0).padStart(7), "pop12", res.pop12.rang.mean.toFixed(0).padStart(7), "(" + (100 * (res.pop12.rang.mean / b - 1)).toFixed(0).padStart(4) + " %)",
        "pop12c", res.pop12c.rang.mean.toFixed(0).padStart(7), "gierig", res.gierig.rang.mean.toFixed(0).padStart(7), "(" + (100 * (res.gierig.rang.mean / b - 1)).toFixed(0).padStart(4) + " %)",
        "bleib", res.bleib.rang.mean.toFixed(0).padStart(7), "| mittl.p bot", res.bot.p.toFixed(3), "pop12", res.pop12.p.toFixed(3), "| L bot", res.bot.L.toFixed(1), "pop12", res.pop12.L.toFixed(1),
        "| Wechsel bot", res.bot.w.toFixed(1), "pop12", res.pop12.w.toFixed(1), "| Gewinn pop12-bot je h", ((res.pop12.rang.mean - b) / H).toFixed(0));
    }
  }
}

// =============================== VORSPRUNG-SWEEP =======================================
console.log("\n=== Vorsprung-Sweep der bevoelkerungsbewussten Regel (A 25, g 0.23, comms-Filter) ===");
for (const marge of [1.0, 1.05, 1.1, 1.2, 1.35, 1.5, 2.0]) {
  POLITIK["m" + marge] = (cs, cur) => {
    const w = (c) => (c.comms >= 3 ? wertPop(c) : 0);
    let beste = -1, bw = w(cs[cur]);
    for (let i = 0; i < 6; i++) { if (i === cur) continue; const x = w(cs[i]); if (x > bw) { bw = x; beste = i; } }
    return beste >= 0 && bw > w(cs[cur]) * marge ? beste : cur;
  };
}
for (const H of [6, 10]) {
  const rb = []; for (let i = 0; i < NRUNS; i++) rb.push(lauf("bot", { A: 25, H, K0: 0.089, g: 0.23 }, 100 + i, 200 + i, 300 + i).rang);
  const mb = stat(rb).mean;
  const out = [];
  for (const marge of [1.0, 1.05, 1.1, 1.2, 1.35, 1.5, 2.0]) {
    const rs = [], ws = [];
    for (let i = 0; i < NRUNS; i++) { const o = lauf("m" + marge, { A: 25, H, K0: 0.089, g: 0.23 }, 100 + i, 200 + i, 300 + i); rs.push(o.rang); ws.push(o.wechsel); }
    out.push("Marge " + marge + ": " + (100 * (stat(rs).mean / mb - 1)).toFixed(0) + " % (Wechsel " + stat(ws).mean.toFixed(1) + ")");
  }
  console.log("H", H, "bot", mb.toFixed(0), "|", out.join(" | "));
}

// =============================== Fehlerfall: r nur mit Rauschen bekannt =====================
console.log("\n=== Fehlerfall: gemessenes r mit Rauschen (relativ, gleichverteilt) statt exakt (A 25, g 0.23, H 10, Marge 1,2) ===");
for (const rauschen of [0, 0.05, 0.1, 0.2, 0.4]) {
  POLITIK["rau" + rauschen] = (cs, cur) => {
    const ru = (rauschen > 0) ? ((i) => 1 + rauschen * (Math.sin(i * 12.9898 + cur * 78.233 + cs[0].pop * 1e-9) * 43758.5453 % 1 * 2 - 1)) : () => 1;
    const w = (c, i) => (c.comms >= 3 ? Math.pow(c.pop * ru(i) / 1e9, 0.7) / faktor(c.chaos) : 0);
    let beste = -1, bw = w(cs[cur], cur);
    for (let i = 0; i < 6; i++) { if (i === cur) continue; const x = w(cs[i], i); if (x > bw) { bw = x; beste = i; } }
    return beste >= 0 && bw > w(cs[cur], cur) * 1.2 ? beste : cur;
  };
}
{
  const rb = []; for (let i = 0; i < NRUNS; i++) rb.push(lauf("bot", { A: 25, H: 10, K0: 0.089, g: 0.23 }, 100 + i, 200 + i, 300 + i).rang);
  const mb = stat(rb).mean; const out = [];
  for (const rauschen of [0, 0.05, 0.1, 0.2, 0.4]) {
    const rs = []; for (let i = 0; i < NRUNS; i++) rs.push(lauf("rau" + rauschen, { A: 25, H: 10, K0: 0.089, g: 0.23 }, 100 + i, 200 + i, 300 + i).rang);
    out.push("Rauschen +-" + (100 * rauschen).toFixed(0) + " %: " + (100 * (stat(rs).mean / mb - 1)).toFixed(0) + " %");
  }
  console.log(out.join(" | "));
}

// =============================== RESERVE: bezahlt die gleichmaessige Abnutzung spaeter? ====
// Die bevoelkerungsbewusste Regel verteilt den Verbrauch auf alle Staedte. Die Bot-Regel verbrennt eine Stadt
// nach der anderen und laesst die uebrigen frisch. Fuer eine spaetere Phase (Assassination ohne Pop-Verbrauch)
// zaehlt die BESTE verbleibende Stadt. Kennzahl: max und Summe von (pop/1e9)^0,7 / Chaosfaktor am Ende.
console.log("\n=== RESERVE am Ende der Raid-Phase (A 25, g 0.23): beste Stadt (max) und Summe der sechs Werte ===");
for (const H of [6, 10, 14, 20]) {
  const res = {};
  for (const pol of ["bot", "pop12c"]) {
    const mx = [], sm = [], rg = [];
    for (let i = 0; i < NRUNS; i++) {
      const o = lauf(pol, { A: 25, H, K0: 0.089, g: 0.23 }, 100 + i, 200 + i, 300 + i);
      const w = o.cs.map((c) => wertPop(c));
      mx.push(Math.max(...w)); sm.push(w.reduce((a, b) => a + b, 0)); rg.push(o.rang);
    }
    res[pol] = { mx: stat(mx).mean, sm: stat(sm).mean, rg: stat(rg).mean };
  }
  console.log("H", String(H).padStart(2), "| beste Stadt bot", res.bot.mx.toFixed(2), "pop12c", res.pop12c.mx.toFixed(2), "| Summe bot", res.bot.sm.toFixed(2), "pop12c", res.pop12c.sm.toFixed(2), "| Raid-Rang bot", res.bot.rg.toFixed(0), "pop12c", res.pop12c.rg.toFixed(0), "(" + (100 * (res.pop12c.rg / res.bot.rg - 1)).toFixed(0) + " %)");
}

// =============================== ZWEI PHASEN: Raid, danach Assassination =======================
// Prueft den Einwand "Reserve": bezahlt die gleichmaessige Abnutzung (pop12c) in der spaeteren Phase mit
// schlechteren Staedten? Phase 1 = Raid bis H1, Phase 2 = Assassination (44 Rang, rewardFac 1,14, difficultyFac 1,06,
// basis 1500; Pop-Verbrauch nur -1 je Erfolg, Chaos +-5 % zufaellig; Operation.ts/Bladeburner.ts:869-871). Beide
// Politiken laufen in Phase 2 weiter mit IHRER Regel. K_assn = 0,9 x K_raid (aus 09:59: 0,19 gegen 0,24).
function lauf2(politik, opt, seedInit, seedEv, seedOut) {
  const ri0 = rng32(seedInit), re = rng32(seedEv), ro = rng32(seedOut);
  const cs = NAMEN.map(() => neueStadt(ri0));
  let cur = 0, t = 0, evT = ri(re, 240, 600);
  const st = { raid: { succ: 0, L: 1 }, assn: { succ: 0, L: 1 } };
  let rang = 0, rang1 = 0, tEnde = null;
  const N = Math.round(opt.A * (opt.H1 + opt.H2)), dt = 3600 / opt.A;
  for (let k = 0; k < N; k++) {
    t += dt;
    while (evT <= t) { zufallsEreignis(cs, re); evT += ri(re, 240, 600); }
    for (const c of cs) c.chaos = Math.max(0, c.chaos - 0.0001 * dt);
    cur = POLITIK[politik](cs, cur);
    const c = cs[cur];
    const phase1 = t / 3600 < opt.H1;
    const K = opt.K0 * Math.exp(opt.g * t / 3600) * (phase1 ? 1 : 0.9);
    const s = phase1 ? st.raid : st.assn, L = s.L;
    const fac = phase1 ? 1.045 : 1.06, rf = phase1 ? 1.1 : 1.14, gn = phase1 ? 55 : 44, ls = phase1 ? 2.5 : 4;
    const p = (phase1 && c.comms <= 0) ? 0 : Math.min(1, K * Math.pow(fac, -(L - 1)) * Math.pow(c.pop / 1e9, 0.7) / faktor(c.chaos));
    const erfolg = ro() < p;
    rang += erfolg ? gn * Math.pow(rf, L - 1) : -ls * Math.pow(rf, L - 1);
    if (erfolg) { s.succ++; if (s.succ >= needed(s.L)) s.L++; }
    if (phase1) raidAbschluss(c, erfolg, ro);
    else { if (erfolg) changePopCount(c, -1); changeChaosPct(c, ri(ro, -5, 5)); }
    if (phase1) rang1 = rang;
    if (tEnde === null && rang >= opt.ziel) tEnde = t / 3600;
  }
  return { rang, rang1, tEnde, Lr: st.raid.L, La: st.assn.L };
}
console.log("\n=== ZWEI PHASEN (A 25, g 0.23): Raid bis H1, danach Assassination bis H1+H2; Zeit bis Rang 100.000 (Ersatzziel, 400.000 ist der Knotenausgang) ===");
for (const [H1, H2] of [[6, 14], [10, 14], [14, 10]]) {
  const res = {};
  for (const pol of ["bot", "pop12c"]) {
    const rs = [], r1 = [], te = [], La = [];
    for (let i = 0; i < NRUNS; i++) {
      const o = lauf2(pol, { A: 25, H1, H2, K0: 0.089, g: 0.23, ziel: 1e5 }, 100 + i, 200 + i, 300 + i);
      rs.push(o.rang); r1.push(o.rang1); te.push(o.tEnde ?? (H1 + H2 + 5)); La.push(o.La);
    }
    res[pol] = { rang: stat(rs).mean, rang1: stat(r1).mean, te: stat(te), La: stat(La).mean };
  }
  console.log("H1", H1, "H2", H2, "| Rang nach Phase 1: bot", res.bot.rang1.toFixed(0), "pop12c", res.pop12c.rang1.toFixed(0), "| Rang am Ende bot", res.bot.rang.toFixed(0), "pop12c", res.pop12c.rang.toFixed(0),
    "| Zeit bis 100k (Median) bot", res.bot.te.med.toFixed(1), "h pop12c", res.pop12c.te.med.toFixed(1), "h (Mittel", res.bot.te.mean.toFixed(1), "/", res.pop12c.te.mean.toFixed(1) + ") | Assn-Stufe bot", res.bot.La.toFixed(1), "pop12c", res.pop12c.La.toFixed(1));
}
