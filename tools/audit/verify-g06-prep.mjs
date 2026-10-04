// Gegenpruefung G06 (HACK-4 b): Vorbereitungszeit (prepSec, Formel des Bots
// src/lib/calc.js targetMetrics) und Rang der Ziele the-hub / johnson-ortho /
// crush-fitness je BN2-Stand, mit ZIELWAHL des Bots (horizon 1800 / prepMax 1200)
// und mit einem laengeren prepMax. Dazu der Nutzen-Gate-Massstab (Flotte laeuft
// mit ...) aus dem Log, soweit im Ringpuffer.
//
// Frage: (1) Wann sinkt prepSec unter prepMax von selbst (RAM und Level wachsen)?
//        (2) Waere das Ziel ueberhaupt am Nutzen-Gate (steadyEff < Flottenmittel)
//            gescheitert, auch bei grossem prepMax?
// Aufruf: node tools/audit/verify-g06-prep.mjs [muster] [von] [bis]
import fs from "node:fs";
import { loadSave, textFile, runningScripts } from "./hack-save.mjs";
import { targetMetrics, targetRank, hackTime } from "../../src/lib/calc.js";

const muster = process.argv[2] || "BN2L";
const von = process.argv[3] || "";
const bis = process.argv[4] || "~";
const HOSTS = (process.env.HOSTS || "the-hub,johnson-ortho,crush-fitness").split(",");
const files = fs.readdirSync("backups").filter((f) => f.includes(muster) && f.endsWith(".json.gz") && f >= von && f <= bis).sort();
for (const f of files) {
  const { p, servers } = loadSave("backups/" + f);
  const pl = { skill: p.skills.hacking, int: p.skills.intelligence, multMoney: p.mults.hacking_money,
    multChance: p.mults.hacking_chance, multGrow: p.mults.hacking_grow, multSpeed: p.mults.hacking_speed };
  const tele = JSON.parse(textFile(servers.home, "data/bn4net.json") || "{}");
  let netz = 0;
  for (const [n, s] of Object.entries(servers)) if (s.hasAdminRights && !n.startsWith("hacknet-")) netz += s.maxRam || 0;
  const eff = tele.mischung && tele.mischung.effFlotte;
  const cols = [];
  for (const h of HOSTS) {
    const s = servers[h];
    if (!s || !s.hasAdminRights || s.requiredHackingSkill > pl.skill) { cols.push(h.slice(0, 8) + " -"); continue; }
    const tIst = hackTime({ sec: s.hackDifficulty, reqSkill: s.requiredHackingSkill }, pl, 1);
    const kz = targetMetrics(s, pl, tIst, { ramHackT: 1.75, ramGrowT: 1.8, ramWeakenT: 1.8, bnScriptHackMoney: 1,
      bnServerGrowthRate: (tele.bnWerte && tele.bnWerte.serverGrowthRate) || 0.8, bnServerWeakenRate: 1, mixMoneyHigh: 0.95,
      kapAbzug: 0.2, secOk: 1, moneyLow: 0.75, prepRamGb: netz * 0.3 });
    const rang = targetRank(kz, { horizonSec: 1800, prepMaxSec: 1200 }, null);
    const gate = eff && kz.steadyEff != null && kz.steadyEff < eff ? "GATE" : "ok";
    cols.push(h.slice(0, 8) + " eff" + Math.round(kz.steadyEff || 0) + " prep" + Math.round(kz.prepSec) + "s rang" + Math.round(rang) + " " + gate);
  }
  console.log(f.replace("LIVE_197f4d61481686_", "").replace(".json.gz", "").padEnd(34), "L" + pl.skill, "netz", String(netz).padStart(6),
    "Flotte(bot)", eff, "|", cols.join(" | "));
}
