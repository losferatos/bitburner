// Gegenpruefung G11 (BLADE-2): Was wuerde schaetzNot() nach dem vorgeschlagenen Fix (spanneGenau statt spanne) liefern?
// Nachbau von blade.js: rAusBlackOp, chanceAusR, wahreChance, spanneGenau (Zeilen ~2420-2480) auf den Spielstaenden.
// spanneGenau loest nur auf, wenn r sicher bestimmt ist UND (r<1 => s.min>0). Sonst faellt es auf die ROHE Spanne zurueck.
// Aufruf: node tools/audit/verify-g11-schaetznot.mjs [filter]
import fs from "node:fs";
import path from "node:path";
import { ladeSpielstand, flach } from "./blade-lage.mjs";
import { AKTIONEN, successRange, successChance } from "./blade-formeln.mjs";
import { root, BLACKOPS, blackOpChance } from "./verify-g11-lib.mjs";

const filter = process.argv[2] || "BN2L";
const idx = fs.readFileSync(path.join(root, "backups", "INDEX.tsv"), "utf8").trim().split(/\r?\n/).slice(1).map((z) => z.split("\t"));
const NAMEN = ["Investigation", "Undercover Operation", "Sting Operation", "Raid", "Stealth Retirement Operation", "Assassination", "Tracking", "Bounty Hunter", "Retirement"];
// wie blade.js rAusBlackOp / chanceAusR
function rAusBlackOp(bo, boReal) {
  const EPS = 1e-12;
  if (bo.min < boReal - EPS) return { r: bo.min / boReal, sicher: true };
  if (bo.max > boReal + EPS && bo.max < 1) return { r: bo.max / boReal, sicher: true };
  if (bo.max >= 1 && boReal < 1) return { r: 1 / boReal, sicher: false };
  if (boReal >= 1 - EPS && bo.min >= boReal - EPS) return { r: 1, sicher: false };
  return { r: 1, sicher: true };
}
function chanceAusR(r, sicher, s) {
  if (!sicher) return null;
  if (r < 1) return s.min > 0 ? (s.min / r + s.max) / 2 : null;
  if (s.max < 1) return (s.max / r + s.min) / 2;
  return s.min;
}
console.log("stand | r (Division) | Black Op real | roh: breiteste Spanne -> schaetzNot | nach Fix (spanneGenau): breiteste -> schaetzNot | ungeloeste Aktionen (s.min=0 oder unsicher)");
for (const z of idx) {
  if (!z[1].includes(filter)) continue;
  const { p } = ladeSpielstand(path.join(root, "backups", z[1]));
  const bb = flach(p.bladeburner);
  if (!bb || bb.numBlackOpsComplete >= 21) continue;
  const P = { skills: p.skills, mults: p.mults };
  const city = bb.cities[bb.city];
  const B = { skills: bb.skills, stamina: bb.stamina, maxStamina: bb.maxStamina, staminaBonus: bb.staminaBonus };
  const lv = (n) => (bb.contracts[n] || bb.operations[n]).level;
  const r = city.pop / city.popEst;
  const op = BLACKOPS[bb.numBlackOpsComplete];
  const boReal = blackOpChance(op, P, bb.skills, { stamFrac: bb.stamina / bb.maxStamina });
  // Spanne der Black Op: est = real (Pop-Faktor 1) -> [real*r, real] bzw. [real, min(1, real*r)] (Action.ts:144-167)
  const clamp = (x) => Math.max(0, Math.min(x, 1));
  let boPair = r < 1 ? [clamp(boReal * r), clamp(boReal)] : [clamp(boReal), clamp(boReal * Math.min(r, Number.MAX_VALUE))];
  const rr = rAusBlackOp({ min: boPair[0], max: boPair[1] }, boReal);
  let breitRoh = 0, breitFix = 0; const ungeloest = [];
  for (const n of NAMEN) {
    const [lo, hi] = successRange(AKTIONEN[n], lv(n), P, B, city);
    breitRoh = Math.max(breitRoh, hi - lo);
    const ex = chanceAusR(rr.r, rr.sicher, { min: lo, max: hi });
    if (ex === null) { breitFix = Math.max(breitFix, hi - lo); ungeloest.push(n.slice(0, 6) + "[" + lo.toFixed(2) + "-" + hi.toFixed(2) + "]"); }
  }
  const sn = (b) => Math.max(0, Math.min(1, (b - 0.1) / 0.9));
  console.log(z[1].replace("LIVE_197f4d61481686_", "").replace(".json.gz", "").padEnd(34), "| r", r.toFixed(2), "| BO", op.name.replace("Operation", "").padEnd(8), boReal.toFixed(3),
    "| roh", breitRoh.toFixed(2), "->", sn(breitRoh).toFixed(2), "| Fix", breitFix.toFixed(2), "->", sn(breitFix).toFixed(2), "| ungeloest", ungeloest.length ? ungeloest.join(" ") : "-");
}
