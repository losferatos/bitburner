// G09-Betrieb: in welcher Stadt steht die Division in den Stundenstaenden, und wie hoch ist das Chaos dort (Beleg: Stadtwechsel beendet das Chaos-Regime).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSave } from "./sleeve-save.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = path.join(root, "backups");
const files = fs.readdirSync(dir).filter((f) => f.includes("BN2L1_2026-10-03T2") || f.includes("BN2L1_2026-10-03T19") || f.includes("BN2L1_2026-10-04T0")).sort();
for (const f of files) {
  const { player: p } = loadSave(path.join(dir, f));
  const bb = p.bladeburner.data || p.bladeburner;
  const c = (n) => { const e = bb.cities[n]; const v = e.data || e; return Math.round(v.chaos * 10) / 10; };
  console.log(f.slice(32, 58).padEnd(26), "Stadt", bb.city.padEnd(10), "| Chaos je Stadt:", Object.keys(bb.cities).map((n) => n.slice(0, 4) + " " + c(n)).join(", "));
}
