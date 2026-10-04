// Gegenpruefung G11 (BLADE-2): Rangherkunft Vertraege (Spieler + Sleeves) gegen Operationen,
// aus den Erfolgs-/Fehlschlagzaehlern der Spielstaende. Nur lesen.
// Rang je Erfolg = rankGain * rewardFac^(L-1) * BN-Faktor (Formulas.ts:9-44), Verlust rankLoss*rewardFac^(L-1).
// Naeherung: Stufe L je Aktion = Stufe im Staende (autoLevel steigt monoton) - Fehler < 1 Stufe je Intervall.
import fs from "node:fs";
import path from "node:path";
import { ladeSpielstand, flach } from "./blade-lage.mjs";
import { AKTIONEN, rankGain, rankLoss } from "./blade-formeln.mjs";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const filter = process.argv[2] || "BN2L1";
const idx = fs.readFileSync(path.join(root, "backups", "INDEX.tsv"), "utf8").trim().split(/\r?\n/).slice(1).map((z) => z.split("\t"));
const staende = [];
for (const z of idx) {
  if (!z[1].includes(filter)) continue;
  const { p } = ladeSpielstand(path.join(root, "backups", z[1]));
  const bb = flach(p.bladeburner);
  staende.push({ f: z[1].replace("LIVE_197f4d61481686_", "").replace(".json.gz", ""), t: p.playtimeSinceLastBitnode / 3.6e6, bb });
}
const NAMEN = ["Tracking", "Bounty Hunter", "Retirement", "Investigation", "Undercover Operation", "Sting Operation", "Raid", "Stealth Retirement Operation", "Assassination"];
function rangAus(bb, name) {
  const o = bb.contracts[name] || bb.operations[name];
  const a = AKTIONEN[name];
  if (!o || !a) return null;
  // Naeherung: alle Erfolge/Fehlschlaege auf der aktuellen Stufe bewertet (obere Grenze)
  return { s: o.successes, f: o.failures, L: o.level, gain: rankGain(a, o.level), loss: rankLoss(a, o.level) };
}
console.log("Intervall | h | dRang | Vertraege (dErfolge x Rang) | Operationen (netto) | Rest");
for (let i = 1; i < staende.length; i++) {
  const a = staende[i - 1], b = staende[i];
  let ctr = 0, ctrS = 0, ops = 0, detail = [];
  for (const n of NAMEN) {
    const x = rangAus(a.bb, n), y = rangAus(b.bb, n);
    if (!x || !y) continue;
    const dS = y.s - x.s, dF = y.f - x.f;
    // mittlere Stufe im Intervall
    const Lm = Math.round((x.L + y.L) / 2);
    const A = AKTIONEN[n];
    const g = rankGain(A, Lm), l = rankLoss(A, Lm);
    const r = dS * g - dF * l;
    if (A.typ === "Contracts") { ctr += r; ctrS += dS; } else ops += r;
    if (dS || dF) detail.push(n.slice(0, 6) + " +" + dS + "/-" + dF + " L" + Lm + " =" + r.toFixed(0));
  }
  const dR = b.bb.rank - a.bb.rank;
  console.log(b.f.padEnd(34), (b.t - a.t).toFixed(2) + "h", "dRang", dR.toFixed(0), "| Vertraege", ctr.toFixed(0), "(" + ctrS + " Erf.)", "| Ops", ops.toFixed(0), "| Rest", (dR - ctr - ops).toFixed(0), "|", detail.join(" ; "));
}
