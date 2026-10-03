// Audit 03.10.2026 (BLADE): Eichung von blade-formeln.mjs gegen echte
// Spielstandwerte aus backups/ (BN2L1). Vergleicht:
//   - maxStamina (Spielstand bb.maxStamina)          gegen maxStamina()
//   - actionTimeToComplete der laufenden Aktion       gegen actionTime()
//   - blade.json "chance" = getActionEstimatedSuccessChance()[0] der laufenden
//     Aktion (Spiel-API, 3 Nachkommastellen)          gegen successRange()[0]
//   - blade.json boChancen["Operation Typhoon"]      gegen successChance(Typhoon)
// Aufruf: node tools/audit/blade-eichung.mjs
import fs from "node:fs";
import path from "node:path";
import { ladeSpielstand, flach, homeDatei } from "./blade-lage.mjs";
import { AKTIONEN, successRange, successChance, actionTime, maxStamina } from "./blade-formeln.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const idx = fs.readFileSync(path.join(root, "backups", "INDEX.tsv"), "utf8").trim().split(/\r?\n/).slice(1)
  .map((z) => z.split("\t")).filter((t) => t[1].includes("BN2L1"));

export function zustand(datei) {
  const { p, servers } = ladeSpielstand(path.join(root, "backups", datei));
  const bb = flach(p.bladeburner);
  const bj = JSON.parse(homeDatei(servers, "data/blade.json") || "null");
  const city = bb.cities[bb.city];
  const lvl = (typ, name) => {
    const o = typ === "Contracts" ? bb.contracts[name] : bb.operations[name];
    return o ? o.level : 1;
  };
  return { p, bb, bj, city, lvl };
}

let maxAbw = { st: 0, t: 0, ch: 0, ty: 0 };
for (const t of idx) {
  const datei = t[1];
  const { p, bb, bj, city, lvl } = zustand(datei);
  const P = { skills: p.skills, mults: p.mults };
  const BB = { skills: bb.skills, stamina: bb.stamina, maxStamina: bb.maxStamina, staminaBonus: bb.staminaBonus };
  const zeile = [datei.slice(28, 50)];
  const ms = maxStamina(P, BB);
  zeile.push("maxSt soll " + bb.maxStamina.toFixed(6) + " ist " + ms.toFixed(6));
  maxAbw.st = Math.max(maxAbw.st, Math.abs(ms - bb.maxStamina));
  const act = bb.action;
  if (act && AKTIONEN[act.name]) {
    const a = AKTIONEN[act.name];
    const L = lvl(act.type, act.name);
    const tt = actionTime(a, L, P, BB);
    zeile.push(act.name + " L" + L + " Zeit soll " + bb.actionTimeToComplete + " ist " + tt);
    maxAbw.t = Math.max(maxAbw.t, Math.abs(tt - bb.actionTimeToComplete));
    if (bj && bj.aktion === act.type + "/" + act.name && Number.isFinite(bj.chance)) {
      const [lo, hi, real] = successRange(a, L, P, BB, city, { teamCount: 0 });
      zeile.push("s.min soll " + bj.chance + " ist " + lo.toFixed(4) + " (max " + hi.toFixed(4) + ", real " + real.toFixed(4) + ", r " + (city.pop / city.popEst).toFixed(4) + ")");
      maxAbw.ch = Math.max(maxAbw.ch, Math.abs(lo - bj.chance));
    }
  }
  if (bj && bj.boChancen && bj.boChancen["Operation Typhoon"] != null) {
    const ty = successChance(AKTIONEN["Operation Typhoon"], 1, P, BB, city, { teamCount: 0 });
    zeile.push("Typhoon soll " + bj.boChancen["Operation Typhoon"] + " ist " + ty.toFixed(4));
    maxAbw.ty = Math.max(maxAbw.ty, Math.abs(ty - bj.boChancen["Operation Typhoon"]));
  }
  console.log(zeile.join(" | "));
}
console.log("MAX-ABWEICHUNG", JSON.stringify(maxAbw));
