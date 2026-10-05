// Audit geldwert BN3 (05.10.2026): Laufverlauf je Knoten aus backups/INDEX.tsv. Nur lesen.
// Aufruf: node tools/audit/geld-bn3-verlauf.mjs <bitNode> <lauf> [jede n-te Zeile]
import fs from "node:fs"; import path from "node:path";
import {loadSave, jsonMap} from "./player-save.mjs";
const [bn, lauf, stepArg] = process.argv.slice(2);
const step = +(stepArg||1);
const idx = fs.readFileSync("backups/INDEX.tsv","utf8").trim().split(/\r?\n/).slice(1).map(l=>l.split("\t"))
  .filter(r=>r[4]===bn && r[5]===lauf);
const g = (o)=> o ? (o.data||o) : {};
let i=0;
console.log("zeit             hNode  hAug   Rang     BO  Geld(Mrd) inst queue augsAusgabe(Mrd,B) str/dex mult  bbFacRep  einnahmenB");
for (const r of idx) {
  if ((i++ % step) && i!==idx.length) continue;
  const f = fs.existsSync(r[9]) ? r[9] : r[10];
  if (!fs.existsSync(f)) continue;
  let s; try { s = loadSave(f); } catch(e){ continue; }
  const p = s.player, bb = g(p.bladeburner);
  const msB = g(p.moneySourceB);
  const facs = JSON.parse(s.save.data.FactionsSave);
  const bbf = g(facs["Bladeburners"]);
  const inc = Object.entries(msB).filter(([k,v])=>v>0 && k!=="total").reduce((a,[,v])=>a+v,0);
  const m = g(p.mults);
  console.log(`${r[0].slice(5,16)}  ${(p.playtimeSinceLastBitnode/3.6e6).toFixed(1).padStart(5)} ${(p.playtimeSinceLastAug/3.6e6).toFixed(1).padStart(5)} ${String(Math.round(bb.rank||0)).padStart(7)} ${String(bb.numBlackOpsComplete??0).padStart(3)} ${(p.money/1e9).toFixed(2).padStart(9)} ${String(p.augmentations.length).padStart(4)} ${String(p.queuedAugmentations.length).padStart(4)} ${(-(msB.augmentations||0)/1e9).toFixed(1).padStart(8)} ${(m.strength||0).toFixed(2)}/${(m.dexterity||0).toFixed(2)} ${String(Math.round(bbf.playerReputation||0)).padStart(9)} ${(inc/1e9).toFixed(1)} ${r[7]}`);
}
