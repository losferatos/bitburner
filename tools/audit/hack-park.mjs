// Audit 03.10.2026, Bereich HACK: Grenzertrag von Netz-RAM im laufenden
// V2-Knoten (BN2) - wieviel $/s bringt zusaetzlicher Arbeiterspeicher?
//
// Formeln: die des Bots (src/lib/calc.js: targetMetrics, batchThroughput),
// die ihrerseits Hacking.ts:9-94, Server/formulas/grow.ts:102-123 und
// ServerHelpers.ts:315-323 nachbauen; ihre Uebereinstimmung mit dem Spiel ist
// im Spielstand belegt (data/calccheck.txt: hackChance/hackPercent/growThreads
// 0,000 % Abweichung gegen ns.formulas).
//
// Modell: Jedes Ziel ist ein "Segment" mit Kapazitaet (GB) und Effizienz
// ($/GB*s). Stapelziele (Top 3 nach batchThroughput, wie bn4net.js:2043-2060)
// bieten ihren Kalenderdeckel ramCeiling zu perS/ramCeiling; offene Ziele
// bieten targetMetrics.kapazitaet zu steadyEff. Gefuellt wird nach Effizienz.
// Eine einzige Realisierungsquote r wird so geeicht, dass das Modell beim
// gemessenen Arbeiterspeicher die gemessene Hacking-Einnahme trifft.
//
// Aufruf: node tools/audit/hack-park.mjs <backup.json.gz> <gemessene $/s> [bnGrowth] [bnShm]
import { loadSave, runningScripts } from "./hack-save.mjs";
import { targetMetrics, batchThroughput, hackTime } from "../../src/lib/calc.js";

const file = process.argv[2];
const gemessen = Number(process.argv[3]);          // $/s, aus moneySourceA.hacking zweier Staende
const bnGrowth = Number(process.argv[4] || 0.8);   // BN2 ServerGrowthRate (BitNode.tsx:573)
const bnShm = Number(process.argv[5] || 1);        // BN2 ScriptHackMoney (nicht gesetzt = 1)
const { p, servers } = loadSave(file);

const pl = {
  skill: p.skills.hacking, int: p.skills.intelligence,
  multMoney: p.mults.hacking_money, multChance: p.mults.hacking_chance,
  multGrow: p.mults.hacking_grow, multSpeed: p.mults.hacking_speed,
};
const RAM = { hackT: 1.75, growT: 1.8, weakenT: 1.8 };   // gemessen im Spielstand (ramUsage)

// Arbeiterspeicher im Stand
let geldGb = 0, shareGb = 0, netz = 0;
for (const [n, s] of Object.entries(servers)) {
  if (!s.hasAdminRights || n.startsWith("hacknet-")) continue;
  netz += s.maxRam || 0;
  for (const r of runningScripts(s)) {
    const gb = (r.ramUsage || 0) * (r.threads || 1);
    if (r.filename === "worker/share.js") shareGb += gb;
    else if (String(r.filename).startsWith("worker/")) geldGb += gb;
  }
}

function segmente(ramTotal) {
  const kand = [];
  for (const [n, s] of Object.entries(servers)) {
    if (!s.hasAdminRights || s.purchasedByPlayer || !(s.moneyMax > 0)) continue;
    if (s.requiredHackingSkill > pl.skill) continue;
    const tIst = hackTime({ sec: s.hackDifficulty, reqSkill: s.requiredHackingSkill }, pl, 1);
    const kz = targetMetrics(s, pl, tIst, {
      ramHackT: RAM.hackT, ramGrowT: RAM.growT, ramWeakenT: RAM.weakenT,
      bnScriptHackMoney: bnShm, bnServerGrowthRate: bnGrowth, bnServerWeakenRate: 1,
      mixMoneyHigh: 0.95, kapAbzug: 0.2, secOk: 1, moneyLow: 0.75, prepRamGb: ramTotal * 0.3,
    });
    if (!(kz.steadyEff > 0)) continue;
    const bt = batchThroughput(kz, s.moneyMax, ramTotal, RAM, 1);
    kand.push({ host: n, kz, bt });
  }
  // Stapelziele wie im Stand (Telemetrie data/bn4net.json batchZiele), das
  // Erfahrungsziel (expZiel) faellt aus den Geldzielen heraus (bn4net.js:1928).
  const STAPEL = (process.env.BATCH || "omega-net,silver-helix,phantasy").split(",");
  const EXP = process.env.EXPZIEL || "joesguns";
  const seg = [];
  kand.filter((c) => c.host !== EXP).forEach((c) => {
    if (STAPEL.includes(c.host) && c.bt) seg.push({ host: c.host, art: "stapel", cap: c.bt.ramCeiling, eff: c.bt.perS / c.bt.ramCeiling });
    else seg.push({ host: c.host, art: "offen", cap: c.kz.kapazitaet, eff: c.kz.steadyEff });
  });
  seg.sort((a, b) => b.eff - a.eff);
  return seg;
}

function income(ramGeld, ramTotal) {
  let rest = ramGeld, sum = 0, grenz = 0;
  for (const s of segmente(ramTotal)) {
    if (rest <= 0) break;
    const take = Math.min(rest, s.cap);
    sum += take * s.eff; rest -= take; grenz = s.eff;
  }
  return { sum, grenz, unbelegt: Math.max(0, rest) };
}

const basis = income(geldGb, netz);
const r = gemessen / basis.sum;
console.log("Stand: Level", pl.skill, "Netz", netz, "GB, Geldarbeiter", geldGb.toFixed(0), "GB, share", shareGb.toFixed(0), "GB");
console.log("Segmente (Top 12):");
for (const s of segmente(netz).slice(0, 12)) console.log("  ", s.host.padEnd(18), s.art.padEnd(6), "cap", s.cap.toFixed(0).padStart(7), "GB  eff", s.eff.toFixed(0).padStart(6), "$/GB*s");
console.log("Modell bei Ist-Belegung:", basis.sum.toFixed(0), "$/s; gemessen", gemessen, "$/s -> Realisierungsquote r =", r.toFixed(3));
console.log("Grenzeffizienz bei Ist (Modell x r):", (basis.grenz * r).toFixed(0), "$/GB*s");

const szenario = (name, plusGb, plusNetz = 0) => {
  const x = income(geldGb + plusGb, netz + plusNetz);
  const d = (x.sum - basis.sum) * r;
  console.log(name.padEnd(46), "+" + plusGb.toFixed(0).padStart(6), "GB ->", "+" + d.toFixed(0).padStart(9), "$/s =",
    "+" + (d * 3600 / 1e9).toFixed(2), "Mrd $/h (", "+" + (100 * d / gemessen).toFixed(1), "% ), unbelegt", x.unbelegt.toFixed(0), "GB, Grenz-eff Modell", x.grenz.toFixed(0), "$/GB*s");
};
szenario("A share frei (kein Abnehmer in V2)", shareGb);
szenario("B Kerne einrechnen, heutige Platzierung", Number(process.env.KERN_GB || 810.6));
szenario("C Kerne + kernbewusste Platzierung", Number(process.env.KERN2_GB || 1756));
szenario("D Park 25x256 statt Ist (+2.688 GB)", 2688, 2688);
szenario("E Park 25x512 statt Ist (+9.088 GB)", 9088, 9088);
szenario("F Park 25x1024 statt Ist (+21.888 GB)", 21888, 21888);

// Amortisation der naechsten Parkstufe nach der Bot-Regel (Modellwert, wie
// grenzErtrag in bn4net.js:363-380 - ohne Realisierungsquote) und real (x r).
// Preise BN2: r*55000*1.3^(log2 r - 6) (ServerPurchases.ts:22-40, BitNode.tsx:575).
const preis = (gb) => gb * 55000 * Math.pow(1.3, Math.max(0, Math.log2(gb) - 6));
for (const [von, park] of [[128, 3712], [256, 6400], [512, 12800], [1024, 25600]]) {
  const zusatz = von;                      // Verdopplung bringt "von" GB je Rechner
  const kosten = preis(2 * von) - preis(von);
  const x = income(geldGb + (park - 3712), netz + (park - 3712));
  const amModell = kosten / (zusatz * x.grenz);
  console.log("Stufe", von, "->", 2 * von, "bei Park", park, "GB: Kosten", (kosten / 1e6).toFixed(1), "Mio,",
    (kosten / zusatz / 1e3).toFixed(1), "k$/GB, Amortisation Modell", amModell.toFixed(0), "s, real", (amModell / r).toFixed(0), "s");
}
