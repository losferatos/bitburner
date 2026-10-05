// Audit geldwert BN3 (05.10.2026): Faktionen, Ruf, Favor, gekaufte/wartende Augs eines Spielstands. Nur lesen.
import {loadSave} from "./player-save.mjs";
import {loadAugs} from "./aug-data.mjs";
const A = loadAugs();
const {save,player:p}=loadSave(process.argv[2]);
const F = JSON.parse(save.data.FactionsSave);
const g=o=>o?(o.data||o):{};
console.log("joined:", p.factions.join(", "));
for (const [n,f] of Object.entries(F)) { const d=g(f); if ((d.playerReputation||0)>0 || (d.favor||0)>0) console.log(`  ${n}: rep ${Math.round(d.playerReputation)} favor ${(d.favor||0).toFixed(1)}`); }
console.log("invitations:", (p.factionInvitations||[]).join(", "));
const q = p.queuedAugmentations.map(a=>a.name+(a.level>1?"#"+a.level:""));
console.log("queued:", q.map(n=>n+" ["+(A[n.split("#")[0]]?.factions||[]).slice(0,3).join("/")+"]").join("; "));
console.log("installed:", p.augmentations.map(a=>a.name).join("; "));
const sl = p.sleeves||[]; console.log("sleeves:", sl.length, sl.map(s=>{const d=g(s); const w=d.currentWork? g(d.currentWork):{}; return (w.type||"?")+":"+(w.factionName||w.actionName||w.crimeType||w.classType||"")+" aug#"+(d.augmentations||[]).length;}).join(" | "));
const msB = g(p.moneySourceB); console.log("moneySourceB (Mrd):", Object.entries(msB).filter(([k,v])=>Math.abs(v)>1e7).map(([k,v])=>k+" "+(v/1e9).toFixed(2)).join(", "));
console.log("entropy", p.entropy, "karma", p.karma, "home RAM", g(JSON.parse(save.data.AllServersSave).home)?.maxRam);
