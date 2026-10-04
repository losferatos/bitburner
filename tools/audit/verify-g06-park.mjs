// Gegenpruefung G06: Ertrag von "Park 25x512 statt 25x256" (+6400 GB) im
// Segmentmodell, fuer mehrere Staende (andere Kurve je Zyklusalter).
// Basis G0 = Geldarbeiter-RAM des Stands, korrigiert auf einen Park von 6400 GB
// (G0 = geldGb + 6400 - park). Zuwachs d1 = 6400 (256->512), d2 = 12800 (-> 1024).
// Ausgabe in Modelleinheiten und mit r (aus verify-g06-model.mjs je Stand).
// Aufruf: node tools/audit/verify-g06-park.mjs <teilstring> <r>
import fs from "node:fs";
import { loadSave, textFile, runningScripts } from "./hack-save.mjs";
import { targetMetrics, batchThroughput, hackTime } from "../../src/lib/calc.js";
const [teil, rArg] = process.argv.slice(2);
const file = fs.readdirSync("backups").filter((f) => f.includes(teil))[0];
const r = Number(rArg || 0.7);
const RAM = { hackT: 1.75, growT: 1.8, weakenT: 1.8 };
const { p, servers } = loadSave("backups/" + file);
const pl = { skill: p.skills.hacking, int: p.skills.intelligence, multMoney: p.mults.hacking_money,
  multChance: p.mults.hacking_chance, multGrow: p.mults.hacking_grow, multSpeed: p.mults.hacking_speed };
const tele = JSON.parse(textFile(servers.home, "data/bn4net.json") || "{}");
let geldGb = 0, netz = 0; const imSpiel = new Set();
for (const [n, s] of Object.entries(servers)) {
  if (!s.hasAdminRights || n.startsWith("hacknet-")) continue;
  netz += s.maxRam || 0;
  for (const rr of runningScripts(s)) {
    if (rr.filename === "worker/share.js") continue;
    if (String(rr.filename).startsWith("worker/")) { geldGb += (rr.ramUsage || 0) * (rr.threads || 1);
      for (const a of rr.args || []) if (servers[a]) imSpiel.add(a); }
  }
}
const park = (p.purchasedServers || []).reduce((a, h) => a + (servers[h] ? servers[h].maxRam : 0), 0);
const stapel = new Set(tele.batchZiele || []);
const expZiel = tele.expZiel || "joesguns";
const segs = [];
for (const n of imSpiel) {
  const s = servers[n];
  if (!s || n === expZiel || !s.hasAdminRights || !(s.moneyMax > 0)) continue;
  const tIst = hackTime({ sec: s.hackDifficulty, reqSkill: s.requiredHackingSkill }, pl, 1);
  const kz = targetMetrics(s, pl, tIst, { ramHackT: RAM.hackT, ramGrowT: RAM.growT, ramWeakenT: RAM.weakenT, bnScriptHackMoney: 1,
    bnServerGrowthRate: (tele.bnWerte && tele.bnWerte.serverGrowthRate) || 0.8, bnServerWeakenRate: 1, mixMoneyHigh: 0.95, kapAbzug: 0.2,
    secOk: 1, moneyLow: 0.75, prepRamGb: netz * 0.3 });
  if (!(kz.steadyEff > 0)) continue;
  const bt = batchThroughput(kz, s.moneyMax, netz, RAM, 1);
  if (stapel.has(n) && bt) segs.push({ host: n, cap: bt.ramCeiling, eff: bt.perS / bt.ramCeiling });
  else segs.push({ host: n, cap: kz.kapazitaet, eff: kz.steadyEff });
}
segs.sort((a, b) => b.eff - a.eff);
const inc = (gb) => { let rest = gb, sum = 0; for (const s of segs) { if (rest <= 0) break; const t = Math.min(rest, s.cap); sum += t * s.eff; rest -= t; } return { sum, unbel: Math.max(0, rest) }; };
const G0 = geldGb + 6400 - park;
const a = inc(G0), b = inc(G0 + 6400), c = inc(G0 + 19200);
const f = (x) => (x * r * 3600 / 1e9).toFixed(2);
console.log(file.replace("LIVE_197f4d61481686_", ""), "L" + pl.skill, "park", park, "geldGb", geldGb.toFixed(0), "capSum", segs.reduce((x, s) => x + s.cap, 0).toFixed(0), "r", r);
console.log("  Basis (Park 25x256-aequiv.) G0 =", G0.toFixed(0), "-> Modell", a.sum.toFixed(0), "$/s");
console.log("  +6400 GB (25x512):  +" + (b.sum - a.sum).toFixed(0), "$/s Modell =", f(b.sum - a.sum), "Mrd $/h real; unbelegt", b.unbel.toFixed(0));
console.log("  +19200 GB (25x1024):+" + (c.sum - b.sum).toFixed(0), "$/s Modell (gegen 25x512) =", f(c.sum - b.sum), "Mrd $/h real; unbelegt", c.unbel.toFixed(0));
