// G09: Verlauf eines Laufs aus den Spielstaenden - Rang, maxRank, Black Ops, SP, Sleeves.
// Aufruf: node tools/audit/verify-g09-lage.mjs BN2L1 [--alle]
import { listRun, readSave, bbOf, sleeveOf, homeJson, mapEntries, fmt } from "./verify-g09-lib.mjs";

const run = process.argv[2] || "BN2L1";
const alle = process.argv.includes("--alle");
const files = listRun(run);
let lastH = -9;
console.log("run", run, files.length, "Staende");
console.log("h_node  rank     maxRank  BO  SP   sync/shock/kampfmin sleeves[work]   action   chaos(Stadt)  city");
for (const f of files) {
  const { save, p } = readSave(f);
  const h = p.playtimeSinceLastBitnode / 3.6e6;
  if (!alle && h - lastH < 0.9) continue;
  lastH = h;
  const bb = bbOf(p);
  const sl = (p.sleeves || []).map(sleeveOf);
  const sleeveStr = sl.map((s) => {
    const w = s.work;
    let n = "-";
    if (w) {
      n = w.ctor.replace("Sleeve", "").replace("Work", "");
      if (w.actionId) n += ":" + w.actionId.name;
      if (w.classType) n += ":" + w.classType;
      if (w.crimeType) n += ":" + w.crimeType;
      if (w.factionName) n += ":" + w.factionName;
    }
    const k = Math.min(s.skills.strength, s.skills.defense, s.skills.dexterity, s.skills.agility);
    return `[${n} k${k} sh${fmt(s.shock, 1)} cha${s.skills.charisma}]`;
  }).join(" ");
  const cities = bb ? mapEntries(bb.cities) : {};
  const cc = cities[bb && bb.city] || {};
  const act = bb && bb.action ? (bb.action.name || JSON.stringify(bb.action)) : "-";
  console.log([fmt(h, 2).padStart(6), fmt(bb && bb.rank, 0).padStart(8), fmt(bb && bb.maxRank, 0).padStart(8),
    String(bb && bb.numBlackOpsComplete).padStart(3), String(bb && bb.totalSkillPoints).padStart(5), sleeveStr,
    act, fmt(cc.chaos, 1), bb && bb.city, f.slice(f.indexOf(run) + 6, f.indexOf(run) + 17)].join(" "));
}
