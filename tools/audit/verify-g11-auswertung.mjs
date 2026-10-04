// Gegenpruefung G11: Auswertung der Simulation (verify-g11-sim.mjs -> JSON). Tabelle je Stand:
// Datamancer-/Tracer-/Overclock-Stufen der Varianten, Chancenfaktor je Variante gegen die Regelnachbildung,
// sowie die Zeit-Wirkung ueber Overclock (Aktionsdauer-Faktor (1-O/100)).
import fs from "node:fs";
import path from "node:path";
import { root } from "./verify-g11-lib.mjs";
const modus = process.argv[2] || "log";
const D = JSON.parse(fs.readFileSync(path.join(root, "nodes", "audit-2026-10-03", "verify-g11-sim-" + modus + ".json"), "utf8"));
const g = (s, n) => { const m = new RegExp("(^| )" + n + "(\\d+)").exec(s); return m ? Number(m[2]) : 0; };
console.log("stand".padEnd(24), "SP".padStart(6), "luft", "| DM Ist/bot/fixDMreal/fixDM | TR bot/fixDMreal/fixBoth | OC bot/fixDMreal/fixDM/fixBoth | Chance/bot: fixDMreal fixDM fixBothReal fixBoth | Zeit-/bot real ideal");
for (const o of D) {
  const L = (v, n) => g(o.lv[v], n);
  const oc = ["bot", "fixDMreal", "fixDM", "fixBoth"].map((v) => L(v, "O"));
  const tfr = (1 - oc[1] / 100) / (1 - oc[0] / 100), tf = (1 - oc[2] / 100) / (1 - oc[0] / 100);
  console.log(o.f.replace("BN2L1_2026-", "").padEnd(24), String(o.SP).padStart(6), o.luft.toFixed(2), "|",
    [g(o.ist, "D"), L("bot", "D"), L("fixDMreal", "D"), L("fixDM", "D")].map((x) => String(x).padStart(3)).join(" "), "|",
    [L("bot", "T"), L("fixDMreal", "T"), L("fixBoth", "T")].map((x) => String(x).padStart(3)).join(" "), "|",
    oc.map((x) => String(x).padStart(3)).join(" "), "|",
    [o.ratio.fixDMreal, o.ratio.fixDM, o.ratio.fixBothReal, o.ratio.fixBoth].map((x) => x.toFixed(2)).join(" "), "|", tfr.toFixed(2), tf.toFixed(2));
}
