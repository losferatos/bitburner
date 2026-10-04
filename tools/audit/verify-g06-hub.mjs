// Gegenpruefung G06 (HACK-4 b): was bringt ein zusaetzliches, bisher wegen
// prepMax gesperrtes Ziel (the-hub, johnson-ortho) im Segmentmodell?
// Modell wie verify-g06-model.mjs (Segmente der Ziele mit Arbeitern + Zusatzziele),
// Differenz income(mit) - income(ohne) bei gleichem Geldarbeiter-RAM, mal r
// (aus verify-g06-model.mjs: 0,6-0,8 je nach Zyklusalter; hier r als Argument).
// Aufruf: node tools/audit/verify-g06-hub.mjs <datei-teilstring> <r> [zusatzziele,...]
import fs from "node:fs";
import { loadSave, textFile, runningScripts } from "./hack-save.mjs";
import { targetMetrics, batchThroughput, hackTime } from "../../src/lib/calc.js";
const [teil, rArg, extraArg] = process.argv.slice(2);
const file = fs.readdirSync("backups").filter((f) => f.includes(teil))[0];
const r = Number(rArg || 0.7);
const extra = (extraArg || "the-hub").split(",");
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
const stapel = new Set(tele.batchZiele || []);
const expZiel = tele.expZiel || "joesguns";
function seg(set) {
  const out = [];
  for (const n of set) {
    const s = servers[n];
    if (!s || n === expZiel || !s.hasAdminRights || !(s.moneyMax > 0) || s.requiredHackingSkill > pl.skill) continue;
    // Zusatzziele werden im VORBEREITETEN Zustand bewertet (steadyEff ist schon auf min hochgerechnet)
    const tIst = hackTime({ sec: s.hackDifficulty, reqSkill: s.requiredHackingSkill }, pl, 1);
    const kz = targetMetrics(s, pl, tIst, { ramHackT: RAM.hackT, ramGrowT: RAM.growT, ramWeakenT: RAM.weakenT,
      bnScriptHackMoney: 1, bnServerGrowthRate: (tele.bnWerte && tele.bnWerte.serverGrowthRate) || 0.8, bnServerWeakenRate: 1,
      mixMoneyHigh: 0.95, kapAbzug: 0.2, secOk: 1, moneyLow: 0.75, prepRamGb: netz * 0.3 });
    if (!(kz.steadyEff > 0)) continue;
    const bt = batchThroughput(kz, s.moneyMax, netz, RAM, 1);
    if (stapel.has(n) && bt) out.push({ host: n, art: "stapel", cap: bt.ramCeiling, eff: bt.perS / bt.ramCeiling });
    else out.push({ host: n, art: "offen", cap: kz.kapazitaet, eff: kz.steadyEff });
  }
  return out.sort((a, b) => b.eff - a.eff);
}
const inc = (segs, gb) => { let rest = gb, sum = 0, grenz = 0; for (const s of segs) { if (rest <= 0) break; const t = Math.min(rest, s.cap); sum += t * s.eff; rest -= t; grenz = s.eff; } return { sum, grenz }; };
const basis = seg(imSpiel);
const mit = seg(new Set([...imSpiel, ...extra]));
const a = inc(basis, geldGb), b = inc(mit, geldGb);
console.log(file.replace("LIVE_197f4d61481686_", ""), "L" + pl.skill, "geldGb", geldGb.toFixed(0), "Netz", netz);
console.log("  Ziele im Spiel:", [...imSpiel].join(","));
console.log("  Zusatz:", mit.filter((s) => extra.includes(s.host)).map((s) => s.host + " cap" + s.cap.toFixed(0) + " eff" + s.eff.toFixed(0)).join(" | "));
console.log("  Modell ohne:", a.sum.toFixed(0), "$/s  mit:", b.sum.toFixed(0), "$/s  Differenz:", (b.sum - a.sum).toFixed(0), "$/s =",
  ((b.sum - a.sum) * r * 3600 / 1e9).toFixed(2), "Mrd $/h bei r =", r, "(", (100 * (b.sum - a.sum) / a.sum).toFixed(1), "% des Modells )");
