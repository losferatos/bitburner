// G09: Eichung des eigenen Nachbaus gegen Spielstandwerte. Ausgabe Soll (Spiel) / Ist (Nachbau).
import fs from "node:fs";
import { listRun, readSave, homeJson, fmt } from "./verify-g09-lib.mjs";
import { ACT, ctxOf, range, chance, actionTime, maxStaminaOf, regenPerSec } from "./verify-g09-model.mjs";

console.log("== E1/E2/E3: maxStamina, s.min (getSuccessRange[0]), Dauer gegen blade.json der laufenden Aktion");
console.log("stand | aktion L | maxStam Soll/Ist | s.min Soll/Ist | dauer Soll/Ist");
let worst = 0, worstT = 0, nmin = 0;
for (const run of ["BN2L1", "BN2L2"]) for (const f of listRun(run)) {
  const { save, p } = readSave(f);
  const bj = homeJson(save, "data/blade.json");
  if (!bj || !bj.aktion) continue;
  const { ctx, bb } = ctxOf(p);
  const ms = maxStaminaOf(ctx, bb.staminaBonus || 0);
  const name = bj.aktion.split("/")[1];
  const a = ACT[name];
  let line = `${f.slice(25, 52)} | ${bj.aktion} L${bj.stufe} | ${fmt(bb.maxStamina, 4)}/${fmt(ms, 4)} |`;
  if (a && bj.chance != null && bj.stufe) {
    const r = range(a, bj.stufe, ctx);
    const t = actionTime(a, bj.stufe, ctx);
    line += ` ${fmt(bj.chance, 3)}/${fmt(r[0], 4)} | ${bj.dauer / 1000}/${t}`;
    worst = Math.max(worst, Math.abs(bj.chance - r[0]));
    worstT = Math.max(worstT, Math.abs(bj.dauer / 1000 - t));
    nmin++;
  }
  console.log(line);
}
console.log("max |dChance|", worst.toFixed(5), "bei", nmin, "Staenden; max |dDauer| s", worstT);
