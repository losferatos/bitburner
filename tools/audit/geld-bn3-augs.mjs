// Audit geldwert BN3 (05.10.2026): Kampf-Augs des Bots (COMBAT_AUGS) mit Faktion, Ruf, Preis - roh und BN3 (x3/x3). Nur lesen.
import { loadAugs } from "./aug-data.mjs";
import { pathToFileURL } from "node:url";
const A = loadAugs();
const h = await import(pathToFileURL("src/lib/hackaugs.js").href);
const C = h.COMBAT_AUGS;
const rows = Object.keys(C).map(n => ({n, a: A[n]})).filter(r=>r.a);
rows.sort((x,y)=>x.a.repCost-y.a.repCost);
console.log("Aug | Faktionen | Ruf roh | Preis roh Mrd | Ruf BN3 | Preis BN3 Mrd | mults");
for (const {n,a} of rows) console.log(`${n} | ${a.factions.join(",")} | ${a.repCost} | ${(a.moneyCost/1e9).toFixed(3)} | ${a.repCost*3} | ${(a.moneyCost*3/1e9).toFixed(3)} | ${JSON.stringify(C[n])}`);
console.log("fehlend in AUGS:", Object.keys(C).filter(n=>!A[n]));
