// BN8-Routenrechner (10.11.2026): wie viele Einbaurunden, bei welchem Vermoegen,
// mit welchen Augmentierungen - und wie lange dauert eine BN8-Stufe.
//
// Alles aus dem Spielquellcode (reference/v301/src), nichts geschaetzt:
//   Level        skill = floor(m*(32*ln(exp+534,6)-200))            skill.ts:5-13
//   Exp/Thread   (3+0,3*baseDifficulty)*hacking_exp                 Hacking.ts:30-40
//   weakenTime   4*5*((2,5*req*sec+500)/(lvl+50))/(speed*intBonus)  Hacking.ts:60-95
//   Spende       rep = $/1e6 * faction_rep (Favor ab 0 in BN8)      donation.ts:8-30
//   Aug-Preis    base*(1,9*0,93)^wartend (SF11.3)                   AugmentationHelpers.ts:127-162
//   NFG          750e3*1,14^L*1,767^q, Ruf 500*1,14^L               Augmentation.ts:238-246
//   home-RAM     R->2R: R*32000*1,58^log2(R)                        ServerPurchases.ts:169-185
//   Server       ram*55000*4^max(0,log2(ram)-6), 25 Stueck          ServerPurchases.ts:21-45
//   Einbau       Exp 0, Geld 250 Mio, Server weg, Faktionen weg; home-RAM und 4S bleiben  Prestige.ts
// Vermoegenskurven: tools/audit/boerse-kurve.mjs (Regel aus src/lib/handel.js, 24 Seeds).
//
// Aufruf: node tools/audit/bn8-route.mjs [--frisch] [--top N]
//   --frisch  eine neue BN8-Stufe ab 250 Mio (statt der laufenden ab 550 Mio)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const PLAN = await import(pathToFileURL(path.join(HIER, "..", "..", "src", "lib", "bn8plan.js")).href);
const R = path.join(HIER, "..", "..", "reference", "v301", "src");
const arg = process.argv.slice(2);
const FRISCH = arg.includes("--frisch");
const TOP = arg.includes("--top") ? Number(arg[arg.indexOf("--top") + 1]) : 6;

// --- Augmentierungen aus der Quelle ------------------------------------------
function ladeAugs() {
  const name = {};
  for (const m of fs.readFileSync(path.join(R, "Augmentation", "Enums.ts"), "utf8").matchAll(/^\s*(\w+)\s*=\s*"([^"]+)",/gm)) name[m[1]] = m[2];
  let fen = "";
  for (const p of [["Faction", "Enums.ts"], ["Enums.ts"]]) { try { fen += fs.readFileSync(path.join(R, ...p), "utf8"); } catch { /* egal */ } }
  const fac = {};
  for (const m of fen.matchAll(/^\s*(\w+)\s*=\s*"([^"]+)",/gm)) fac[m[1]] = m[2];
  const src = fs.readFileSync(path.join(R, "Augmentation", "Augmentations.ts"), "utf8");
  const aus = [];
  for (const m of src.matchAll(/\[AugmentationName\.(\w+)\]:\s*\{([\s\S]*?)\n    \},/g)) {
    const b = m[2];
    const num = (k) => { const r = b.match(new RegExp("\\n\\s*" + k + ":\\s*([0-9.e]+)")); return r ? Number(r[1]) : null; };
    const fm = b.match(/factions:\s*\[([^\]]*)\]/);
    const pm = b.match(/prereqs:\s*\[([^\]]*)\]/);
    aus.push({
      name: name[m[1]] || m[1], cost: num("moneyCost") || 0, rep: num("repCost") || 0,
      factions: fm ? [...fm[1].matchAll(/FactionName\.(\w+)/g)].map((x) => fac[x[1]] || x[1]) : [],
      prereqs: pm ? [...pm[1].matchAll(/AugmentationName\.(\w+)/g)].map((x) => name[x[1]] || x[1]) : [],
      hack: num("hacking") || 1, exp: num("hacking_exp") || 1, speed: num("hacking_speed") || 1, frep: num("faction_rep") || 1,
      special: /isSpecial:\s*true/.test(b),
    });
  }
  return aus;
}
const ALLE = ladeAugs().filter((a) => !a.special);
const AUG = Object.fromEntries(ALLE.map((a) => [a.name, a]));
const RED_PILL = "The Red Pill";

// --- Konstanten ----------------------------------------------------------------
const Q = 1.9 * 0.93;                 // Preisfaktor je wartendem Stueck (SF11.3) - PLAN.preisFaktor(3)
const NFG_M = 1.0100026;              // je Stufe auf (fast) alle Mults
const INT_BONUS = 1 + Math.pow(171, 0.8) / 600;
const XP_K = 7.5 / (1.75 * 12500) * INT_BONUS;   // joesguns, weaken: Exp je GB-s je (expMult*speedMult*(lvl+50))
const level = (e, m) => Math.max(1, Math.floor(m * (32 * Math.log(e + 534.6) - 200)));
const expFuer = (L, m) => Math.exp((L / m + 200) / 32) - 534.6;

// Vermoegenskurven [Vermoegen, Median h] (boerse-kurve.mjs, 24 Seeds)
const KURVE_4S = [[250e6, 0], [1e9, 1.42], [3e9, 2.44], [10e9, 3.5], [26e9, 4.51], [45e9, 5.0], [100e9, 5.69], [200e9, 6.43], [300e9, 6.93], [500e9, 7.62], [1e12, 8.68], [1.5e12, 9.38], [2e12, 9.92], [3e12, 10.65], [4e12, 11.73], [5e12, 12.6]];
const KURVE_OHNE = [[250e6, 0], [1e9, 3.12], [3e9, 5.63], [10e9, 7.24], [26e9, 8.96], [45e9, 11.44], [100e9, 12.03], [200e9, 12.95], [300e9, 13.28], [500e9, 14.09], [1e12, 14.99], [1.5e12, 15.15], [2e12, 15.4], [3e12, 16.57], [4e12, 17.18], [5e12, 17.94]];
function stundenBis(W, kurve) {
  if (W <= kurve[0][0]) return 0;
  for (let i = 1; i < kurve.length; i++) {
    if (W <= kurve[i][0]) {
      const [w0, t0] = kurve[i - 1], [w1, t1] = kurve[i];
      return t0 + (t1 - t0) * (Math.log(W / w0) / Math.log(w1 / w0));
    }
  }
  return Infinity;
}
function vermoegenNach(h, kurve) {
  for (let i = 1; i < kurve.length; i++) {
    if (h <= kurve[i][1]) {
      const [w0, t0] = kurve[i - 1], [w1, t1] = kurve[i];
      return w0 * Math.pow(w1 / w0, (h - t0) / (t1 - t0));
    }
  }
  return kurve[kurve.length - 1][0];
}

// --- RAM -------------------------------------------------------------------------
const homeSchritt = (ram) => ram * 32000 * Math.pow(1.58, Math.log2(ram));
function homeKosten(von, bis) { let k = 0; for (let r = von; r < bis; r *= 2) k += homeSchritt(r); return k; }
const serverKosten = (ram) => ram * 55000 * Math.pow(4, Math.max(0, Math.log2(ram) - 6));
function serverGb(budget) {            // 25 gleich grosse Server, groesste bezahlbare Stufe
  let best = 0;
  for (let k = 6; k <= 20; k++) { const ram = 2 ** k; if (25 * serverKosten(ram) <= budget) best = 25 * ram; }
  return best;
}

// --- Eine Einbaurunde planen: DERSELBE Code wie im Bot (src/lib/bn8plan.js) -------
function planeRunde({ besitz, faktionen, repMult, budget, gewichte, maxStueck, pflicht = [], nfgInstalliert, wartend = 0 }) {
  const fset = new Set(faktionen);
  const kandidaten = ALLE
    .filter((a) => !besitz.has(a.name) && a.name !== RED_PILL && a.factions.some((f) => fset.has(f)))
    .map((a) => ({ name: a.name, preis: a.cost * Math.pow(Q, wartend), ruf: a.rep, faktionen: a.factions.filter((f) => fset.has(f)),
      vor: a.prereqs.filter((p) => !besitz.has(p)), hackMult: a.hack, exp: a.exp, speed: a.speed, frep: a.frep }));
  const p = PLAN.planeRunde({ kandidaten, budget, q: Q, repMult, rufHaben: {}, gewichte, pflicht, maxStueck });
  if (!p) return null;
  // Rest in NeuroFlux: Preis 750e3*1,14^L*Q^q, Ruf 500*1,14^L (gegen die hoechste schon bezahlte Huerde)
  const rufMax = Math.max(0, ...p.spenden.map((x) => x.rufZiel));
  let rest = budget - p.kosten, nfg = 0;
  for (; nfg < 60; nfg++) {
    const L = nfgInstalliert + nfg;
    const k = 750e3 * Math.pow(1.14, L) * Math.pow(Q, wartend + p.stueck + nfg)
      + Math.max(0, 500 * Math.pow(1.14, L) - Math.max(rufMax, nfg ? 500 * Math.pow(1.14, L - 1) : 0)) * 1e6 / repMult;
    if (k > rest) break;
    rest -= k;
  }
  return { namen: p.kaeufe.map((k) => k.name), nfg, kosten: budget - rest };
}
function wirkung(zustand, plan) {
  const z = { ...zustand, besitz: new Set(zustand.besitz) };
  for (const n of plan.namen) { const a = AUG[n]; z.besitz.add(n); z.hack *= a.hack; z.exp *= a.exp; z.speed *= a.speed; z.frep *= a.frep; }
  const f = Math.pow(NFG_M, plan.nfg);
  z.hack *= f; z.exp *= f; z.speed *= f; z.frep *= f; z.nfg += plan.nfg;
  if (plan.nfg > 0) z.besitz.add("NeuroFlux Governor");
  return z;
}

// --- Erfahrung: Stunden bis Level L ------------------------------------------------
// gb(h): RAM zur Stunde h der Runde. Reiner XP-Modus (alles RAM auf weaken joesguns).
function stundenBisLevel(L, z, gb, maxH = 60) {
  const ziel = expFuer(L, z.hack);
  let e = 0, h = 0;
  const dt = 1 / 120;
  while (e < ziel && h < maxH) {
    const lvl = level(e, z.hack);
    e += gb(h) * z.exp * z.speed * (lvl + 50) * XP_K * dt * 3600;
    h += dt;
  }
  return e >= ziel ? h : Infinity;
}

// --- Routen ---------------------------------------------------------------------
const HACKER = ["CyberSec", "NiteSec", "The Black Hand", "BitRunners"];
const STADT = ["Sector-12", "Aevum"];
const TDH = ["Tian Di Hui"];
const GEW = PLAN.GEWICHTE;
// Startzustand: die Mults stehen im Spielstand (SF + 3 NeuroFlux aus SF12), 2 Stuecke sind schon gekauft
const START = {
  besitz: new Set(FRISCH ? ["NeuroFlux Governor"] : ["NeuroFlux Governor", "Wired Reflexes", "Neurotrainer I"]),
  hack: 1.5200475, exp: 1.5200475 * (FRISCH ? 1 : 1.1), speed: 1.5200475, frep: 1.3333750, nfg: 3, home: 128,
};
const STARTGELD_H = FRISCH ? 0 : stundenBis(0.55e9, KURVE_OHNE);   // die laufende Stufe steht bei 550 Mio

function route({ w1, w2, home2, home3, bitrunners1 }) {
  const log = [];
  let z = { ...START, besitz: new Set(START.besitz) };
  let t = 0;
  // Runde 1 (ohne 4S starten, 4S ab 45 Mrd)
  const t1Geld = stundenBis(w1, KURVE_OHNE) - STARTGELD_H;
  const f1 = [...(bitrunners1 ? HACKER : HACKER.slice(0, 3)), ...STADT, ...TDH];
  // In der laufenden Stufe warten schon 2 Stuecke: jeder Preis der Runde 1 traegt 1,767^2 (Skeptiker 10.11.)
  const p1 = planeRunde({ besitz: z.besitz, faktionen: f1, repMult: z.frep, budget: w1, gewichte: GEW, maxStueck: 40, nfgInstalliert: z.nfg, wartend: FRISCH ? 0 : 2 });
  if (!p1) return null;
  // BitRunners verlangt die Backdoor auf run4theh111z (Level bis 550) - reicht die Erfahrung in dieser Runde?
  const t1Xp = bitrunners1 ? stundenBisLevel(550, z, () => 1600) - (FRISCH ? 0 : 0) : 0;
  const t1 = Math.max(t1Geld, bitrunners1 && !FRISCH ? Math.max(0, stundenBisLevel(550, z, () => 1600) - 18.1 * 0.2) : t1Xp);
  t += t1; z = wirkung(z, p1);
  log.push({ runde: 1, h: t1, ziel: w1, plan: p1, hack: z.hack, frep: z.frep, stueck: z.besitz.size });
  // Runde 2 (mit 4S): auf 30 Stueck kommen, home-RAM kaufen
  const hk2 = homeKosten(z.home, home2);
  const fehlen = Math.max(0, 30 - z.besitz.size);
  const p2 = planeRunde({ besitz: z.besitz, faktionen: [...HACKER, ...STADT, ...TDH], repMult: z.frep, budget: w2 - hk2,
    gewichte: GEW, maxStueck: 40, nfgInstalliert: z.nfg });
  if (!p2) return null;
  const z2 = wirkung(z, p2);
  if (z2.besitz.size < 30) return null;
  const t2Xp = stundenBisLevel(550, z, (h) => z.home + serverGb(0.02 * vermoegenNach(h, KURVE_4S)));
  const t2 = Math.max(stundenBis(w2, KURVE_4S), t2Xp);
  t += t2; z = { ...z2, home: home2 };
  log.push({ runde: 2, h: t2, ziel: w2, plan: p2, hack: z.hack, frep: z.frep, stueck: z.besitz.size, home: home2 });
  // Runde 3: Hacking 2500 -> Daedalus (100 Mrd bar) -> Ruf fuer The Red Pill spenden; alles Uebrige mitnehmen
  const tXp3 = stundenBisLevel(2500, z, (h) => z.home + serverGb(0.02 * vermoegenNach(h, KURVE_4S)));
  const hk3 = homeKosten(z.home, home3);
  const pille = 2.5e6 * 1e6 / z.frep;
  // Budget so waehlen, dass Pille + home + beste Daedalus-Stuecke passen: Vermoegen zum Zeitpunkt max(XP, Geld)
  let best3 = null;
  for (const w3 of [pille + hk3 + 110e9, 1.2 * (pille + hk3 + 110e9), 1.5 * (pille + hk3 + 110e9), 2 * (pille + hk3 + 110e9)]) {
    const tGeld = stundenBis(w3, KURVE_4S);
    if (!Number.isFinite(tGeld)) continue;
    const rest = w3 - pille - hk3;
    // Daedalus-Ruf ist mit der Pille schon auf 2,5 Mio: dessen Stuecke kosten nur noch den Preis
    const p3 = planeRunde({ besitz: z.besitz, faktionen: [...HACKER, ...STADT, ...TDH], repMult: z.frep, budget: Math.max(0, rest), gewichte: GEW, maxStueck: 40, nfgInstalliert: z.nfg });
    if (!p3) continue;
    let z3 = wirkung(z, p3);
    // Daedalus-Stuecke (Ruf gedeckt): Core V3 + Vorbedingungen, wenn bezahlbar - grob: Preis mit Faktor
    const dae = ALLE.filter((a) => a.factions.includes("Daedalus") && a.name !== RED_PILL && !z3.besitz.has(a.name) && a.hack > 1 && a.prereqs.every((p) => z3.besitz.has(p)));
    let extra = 0;
    for (const a of dae) { const k = a.cost * Math.pow(Q, p3.namen.length + p3.nfg); if (p3.kosten + extra + k <= rest) { extra += k; z3 = wirkung(z3, { namen: [a.name], nfg: 0 }); } }
    const t3 = Math.max(tGeld, tXp3);
    const z4 = { ...z3, home: home3 };
    const t4 = stundenBisLevel(3000, z4, (h) => z4.home + serverGb(0.02 * vermoegenNach(h, KURVE_4S)));
    const ges = t3 + t4;
    if (!best3 || ges < best3.ges) best3 = { ges, t3, t4, w3, p3, z3: z4, tXp3, tGeld };
  }
  if (!best3) return null;
  t += best3.ges;
  log.push({ runde: 3, h: best3.t3, ziel: best3.w3, plan: best3.p3, hack: best3.z3.hack, frep: best3.z3.frep, stueck: best3.z3.besitz.size, home: home3, tXp: best3.tXp3, tGeld: best3.tGeld });
  log.push({ runde: 4, h: best3.t4, hack: best3.z3.hack });
  return { t, log, par: { w1, w2, home2, home3, bitrunners1 } };
}

const mrd = (x) => (x >= 1e12 ? (x / 1e12).toFixed(2) + " Bio" : (x / 1e9).toFixed(0) + " Mrd");
const erg = [];
for (const bitrunners1 of [true, false]) for (const w1 of [100e9, 200e9, 300e9, 500e9, 1e12, 1.5e12, 2e12])
  for (const w2 of [26e9, 45e9, 100e9, 200e9, 300e9, 500e9, 1e12, 1.5e12]) for (const home2 of [2048, 4096, 8192, 16384, 32768])
    for (const home3 of [home2, home2 * 2, home2 * 4]) {
      if (homeKosten(128, home2) > w2 * 0.8) continue;
      const r = route({ w1, w2, home2, home3, bitrunners1 });
      if (r && Number.isFinite(r.t)) erg.push(r);
    }
erg.sort((a, b) => a.t - b.t);
console.log((FRISCH ? "Neue BN8-Stufe ab 250 Mio" : "Laufende Stufe ab 550 Mio (ohne 4S)") + " - " + erg.length + " Routen gerechnet\n");
for (const r of erg.slice(0, TOP)) {
  console.log("GESAMT " + r.t.toFixed(1) + " h  | Runde 1 bei " + mrd(r.par.w1) + (r.par.bitrunners1 ? " mit" : " ohne") + " BitRunners, Runde 2 bei " + mrd(r.par.w2) + ", home " + r.par.home2 + " -> " + r.par.home3 + " GB");
  for (const l of r.log) {
    if (l.runde === 4) { console.log("   Schluss: Hacking 3000 nach " + l.h.toFixed(1) + " h (Mult " + l.hack.toFixed(2) + ")"); continue; }
    console.log("   Runde " + l.runde + ": " + l.h.toFixed(1) + " h, Vermoegen " + mrd(l.ziel) + ", kauft " + l.plan.namen.length + " Stuecke + " + l.plan.nfg + " NFG fuer " + mrd(l.plan.kosten)
      + " -> " + l.stueck + " Stuecke, Hacking-Mult " + l.hack.toFixed(2) + ", Ruf-Mult " + l.frep.toFixed(2) + (l.tXp !== undefined ? " (XP bis 2500: " + l.tXp.toFixed(1) + " h, Geld: " + l.tGeld.toFixed(1) + " h)" : ""));
  }
}
if (erg[0]) {
  console.log("\nBeste Route im Einzelnen:");
  for (const l of erg[0].log) if (l.plan) console.log("  Runde " + l.runde + ": " + l.plan.namen.join(", "));
}
