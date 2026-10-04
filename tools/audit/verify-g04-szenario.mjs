// Audit 04.10.2026, Gegenpruefung G04 (share, HACK-1): Szenario "share frei" an
// einem Stand, mit der WIRKLICHEN Belegung und der WIRKLICHEN Restaufnahme der
// Ziele (Stapelkalender aus data/bn4net.json: kalenderPlaetze * stapelGb - belegtGb;
// offene Ziele: targetMetrics.kapazitaet - Belegung). Die freien share-GB gehen
//   (a) in Bot-Reihenfolge (Gewichte 0,6 / 0,24 / 0,096 der Stapelziele je Runde,
//       Rest an die offenen Ziele nach Effizienz) -> "mix",
//   (b) alles an das schlechteste Ziel mit Restaufnahme -> "unten",
//   (c) alles an das beste Ziel mit Restaufnahme -> "oben".
// Ertrag = GB * eff(Modell) * r. r kommt aus verify-g04-calib.mjs (Mittel sauberer
// Stundenpaare desselben Knotens).
//
// Aufruf: node tools/audit/verify-g04-szenario.mjs <backup.json.gz> <r> [bnGrowth] [bnShm]
// Liest nur.
import { loadSave, runningScripts, textFile } from "./hack-save.mjs";
import { targetMetrics, batchThroughput, hackTime } from "../../src/lib/calc.js";

const file = process.argv[2];
const r = Number(process.argv[3] || 0.93);
const bnGrowth = Number(process.argv[4] || 0.8);
const bnShm = Number(process.argv[5] || 1);
const RAM = { hackT: 1.75, growT: 1.8, weakenT: 1.8 };
const { p, servers } = loadSave(file);
const pl = {
  skill: p.skills.hacking, int: p.skills.intelligence,
  multMoney: p.mults.hacking_money, multChance: p.mults.hacking_chance,
  multGrow: p.mults.hacking_grow, multSpeed: p.mults.hacking_speed,
};
const tele = JSON.parse(textFile(servers.home, "data/bn4net.json"));
const stapelSet = new Set(tele.batchZiele || []);
const stapelTele = Object.fromEntries(((tele.stapel && tele.stapel.ziele) || []).map((z) => [z.ziel, z]));

let netz = 0, shareGb = 0, geldGb = 0;
const fill = {};
for (const [n, s] of Object.entries(servers)) {
  if (!s.hasAdminRights || n.startsWith("hacknet-")) continue;
  netz += s.maxRam || 0;
  for (const rs of runningScripts(s)) {
    const f = String(rs.filename);
    if (!f.startsWith("worker/")) continue;
    const gb = (rs.ramUsage || 0) * (rs.threads || 1);
    if (f === "worker/share.js") { shareGb += gb; continue; }
    const t = String((rs.args || [])[0] ?? "?");
    fill[t] = (fill[t] || 0) + gb; geldGb += gb;
  }
}

const seg = [];
let modellIst = 0;
for (const [n, s] of Object.entries(servers)) {
  if (!s.hasAdminRights || s.purchasedByPlayer || !(s.moneyMax > 0)) continue;
  if (s.requiredHackingSkill > pl.skill) continue;
  if (n === tele.expZiel) continue;
  const tIst = hackTime({ sec: s.hackDifficulty, reqSkill: s.requiredHackingSkill }, pl, 1);
  const kz = targetMetrics(s, pl, tIst, {
    ramHackT: RAM.hackT, ramGrowT: RAM.growT, ramWeakenT: RAM.weakenT,
    bnScriptHackMoney: bnShm, bnServerGrowthRate: bnGrowth, bnServerWeakenRate: 1,
    mixMoneyHigh: 0.95, kapAbzug: 0.2, secOk: 1, moneyLow: 0.75, prepRamGb: netz * 0.3,
  });
  const ist = fill[n] || 0;
  if (stapelSet.has(n)) {
    const bt = batchThroughput(kz, s.moneyMax, netz, RAM, 1);
    const tz = stapelTele[n];
    if (!bt || !tz || tz.phase !== "batch") continue;
    const cap = tz.kalenderPlaetze * tz.stapelGb;
    seg.push({ n, art: "stapel", eff: bt.perS / bt.ramCeiling, cap, ist, frei: Math.max(0, cap - ist) });
    modellIst += ist * bt.perS / bt.ramCeiling;
  } else if (ist > 0 && kz.steadyEff > 0) {
    seg.push({ n, art: "offen", eff: kz.steadyEff, cap: kz.kapazitaet, ist, frei: Math.max(0, kz.kapazitaet - ist) });
    modellIst += ist * kz.steadyEff;
  }
}
console.log("Stand", file.slice(-34), "Level", pl.skill, "Netz", netz.toFixed(0), "GB, Geldarbeiter", geldGb.toFixed(0), ", share", shareGb.toFixed(0), "GB, bn4net.shareFaeden", tele.shareFaeden);
console.log("Ziel\tart\teff(Modell)\tcap\tist\tfrei");
for (const s of seg.sort((a, b) => b.eff - a.eff)) console.log([s.n, s.art, s.eff.toFixed(0), s.cap.toFixed(0), s.ist.toFixed(0), s.frei.toFixed(0)].join("\t"));
console.log("Modell bei Ist-Belegung", modellIst.toFixed(0), "$/s x r", r, "=", (modellIst * r).toFixed(0), "$/s");

function fuelle(order, gb) {
  let rest = gb, sum = 0;
  const frei = new Map(seg.map((s) => [s.n, s.frei]));
  for (const s of order) {
    const nimm = Math.min(rest, frei.get(s.n));
    sum += nimm * s.eff; rest -= nimm; frei.set(s.n, frei.get(s.n) - nimm);
    if (rest <= 0) break;
  }
  return { sum, rest };
}
const stapel = seg.filter((s) => s.art === "stapel");
// Bot-Reihenfolge der Stapelziele = Reihenfolge in batchZiele
const botOrd = (tele.batchZiele || []).map((n) => stapel.find((s) => s.n === n)).filter(Boolean);
const offen = seg.filter((s) => s.art === "offen").sort((a, b) => b.eff - a.eff);
// mix: gewichtete Aufteilung 0,6 / 0,24 / 0,096 ..., Ueberlauf wandert weiter
function mix(gb) {
  let rest = gb, sum = 0, w = 0.6;
  const frei = new Map(seg.map((s) => [s.n, s.frei]));
  for (let pass = 0; pass < 200 && rest > 1e-6; pass++) {
    let freiGes = 0; for (const s of botOrd) freiGes += frei.get(s.n);
    if (freiGes <= 1e-6) break;
    let r0 = rest, wl = 1;
    for (const s of botOrd) {
      const nimm = Math.min(frei.get(s.n), r0 * 0.6 * wl);
      sum += nimm * s.eff; frei.set(s.n, frei.get(s.n) - nimm); rest -= nimm; wl *= 0.4;
    }
  }
  for (const s of offen) {
    if (rest <= 0) break;
    const nimm = Math.min(frei.get(s.n), rest);
    sum += nimm * s.eff; rest -= nimm; frei.set(s.n, frei.get(s.n) - nimm);
  }
  return { sum, rest };
}
const alle = [...seg].filter((s) => s.frei > 0);
const unten = fuelle([...alle].sort((a, b) => a.eff - b.eff), shareGb);
const oben = fuelle([...alle].sort((a, b) => b.eff - a.eff), shareGb);
const mx = mix(shareGb);
for (const [name, x] of [["mix (Bot-Reihenfolge)", mx], ["unten (schlechtestes mit Restaufnahme)", unten], ["oben (bestes mit Restaufnahme)", oben]]) {
  const d = x.sum * r;
  console.log(name.padEnd(40), "+" + d.toFixed(0), "$/s =", "+" + (d * 3600 / 1e9).toFixed(2), "Mrd $/h =", "+" + (100 * d / (modellIst * r)).toFixed(1), "% der Hackeinnahme; mittlere Grenz-eff", (x.sum / (shareGb - Math.max(0, x.rest))).toFixed(0), "(Modell), unplatziert", Math.max(0, x.rest).toFixed(0), "GB");
}
