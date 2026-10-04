// Gegenpruefung G11 (BLADE-2): Umrechnung der Simulations-Faktoren in "Stunden frueher" fuer Operation Typhoon.
// Eingabe: nodes/audit-2026-10-03/verify-g11-sim-log.json (verify-g11-sim.mjs).
// Wirkungswege der freigewordenen SP:
//   Chance   : Chance(t) = Chance_Ist(t) * Verhaeltnis_Variante/bot(t)    (GERECHNET, Regelnachbildung geeicht)
//   Overclock: kuerzere Aktionen -> mehr Aktionen je Stunde -> Kampf-Erfahrung (und damit die Chance-Bahn) schneller.
//              Annahme (GESCHAETZT, nicht gemessen): ln Chance waechst proportional zur Aktionsrate.
// Die Ist-Bahn ist die gemessene Typhoon-Chance der Staende; Feuern bei 0,90 (SICHER_BLACKOP_FRUEH, blade.js:542).
import fs from "node:fs";
import path from "node:path";
import { root } from "./verify-g11-lib.mjs";
const D = JSON.parse(fs.readFileSync(path.join(root, "nodes", "audit-2026-10-03", "verify-g11-sim-" + (process.argv[2] || "log") + ".json"), "utf8"));
const idx = fs.readFileSync(path.join(root, "backups", "INDEX.tsv"), "utf8").trim().split(/\r?\n/).slice(1).map((z) => z.split("\t"));
const ts = {}; for (const z of idx) ts[z[1].replace("LIVE_197f4d61481686_", "").replace(".json.gz", "")] = Date.parse(z[0]);
const g = (s, n) => { const m = new RegExp("(^| )" + n + "(\\d+)").exec(s); return m ? Number(m[2]) : 0; };
// nur Staende bis zur Typhoon-Chance 0,81 (vor dem Feuern), ohne Doppelungen gleicher Zeit
const pts = D.filter((o) => o.i0 === undefined).map((o) => ({ t: ts[o.f] / 3.6e6, c: o.cIst, f: o.f, o }));
const bis = pts.findIndex((p) => p.f.includes("04T03-17"));
const P = pts.slice(0, bis + 1).filter((p, i, a) => i === 0 || p.t > a[i - 1].t + 1e-6);
const lin = (xs, ys, x) => { if (x <= xs[0]) return ys[0]; for (let i = 1; i < xs.length; i++) if (x <= xs[i]) { const w = (x - xs[i - 1]) / (xs[i] - xs[i - 1]); return ys[i - 1] + w * (ys[i] - ys[i - 1]); } return ys[ys.length - 1] + (x - xs[xs.length - 1]) * (ys[ys.length - 1] - ys[ys.length - 2]) / (xs[xs.length - 1] - xs[xs.length - 2]); };
const T = P.map((p) => p.t), LC = P.map((p) => Math.log(p.c));
// Verhaeltnis und Geschwindigkeit ausserhalb der Staende konstant halten (kein Hochrechnen)
const flat = (xs, ys, x) => (x >= xs[xs.length - 1] ? ys[ys.length - 1] : lin(xs, ys, x));
// tatsaechliches Feuern: Typhoon-Abschnitt im Log 01:40Z = 03:40 lokal am 04.10. -> in "Stunden" der Staende
const tFeuer = Date.parse("2026-10-04T01:40:00Z") / 3.6e6;
function lauf(chanceVar, ocVar) {
  // chanceVar: Schluessel in o.ratio oder null; ocVar: Variante fuer den Overclock-Weg oder null
  const ratio = P.map((p) => (chanceVar ? p.o.ratio[chanceVar] : 1));
  const speed = P.map((p) => { if (!ocVar) return 1; return (1 - g(p.o.lv.bot, "O") / 100) / (1 - g(p.o.lv[ocVar], "O") / 100); });
  // Arbeitszeit tau(t) = Integral speed dt (ab dem ersten Stand), Chance(t) = c_Ist(tau) * ratio(t)
  let tau = 0, tPrev = T[0], best = null;
  const dt = 0.01;
  for (let t = T[0]; t < T[T.length - 1] + 2; t += dt) {
    const s = flat(T, speed, t);
    tau += s * dt;
    const c = Math.exp(lin(T, LC, T[0] + tau)) * flat(T, ratio, t);
    if (c >= 0.9 && best === null) { best = t; break; }
  }
  return best;
}
const L = (t) => new Date(t * 3.6e6 + 2 * 3.6e6).toISOString().slice(5, 16).replace("T", " ") + " lokal";
const ist = lauf(null, null);
console.log("Modell-Feuerzeit ohne Aenderung:", ist ? L(ist) : "-", "| tatsaechlich Typhoon im Log:", L(tFeuer));
// HINWEIS (Selbstkorrektur): Ein "Overclock-Weg" (kuerzere Aktionen -> mehr Erfahrung je Stunde -> schnellere Chance)
// gilt NICHT: Bladeburner.ts:699-729 getActionStats rechnet die Erfahrung je Abschluss mit time * BaseStatGain *
// difficultyMult - proportional zur Aktionsdauer. Erfahrung je Stunde laufender Aktionen ist unabhaengig von Overclock.
// Overclock hebt nur Rang (und Vertragsgeld) je Stunde, nicht die Kampfwerte. Die Spalte ocVar bleibt deshalb leer.
const fall = [
  ["Chance-Weg, vollstaendiger Fix (fixDM ideal)", "fixDM", null],
  ["Chance-Weg, Fix wie vorgeschlagen (fixDMreal)", "fixDMreal", null],
  ["Chance + Tracer-Messung (fixBoth ideal)", "fixBoth", null],
  ["Chance + Tracer-Messung, wie vorgeschlagen (fixBothReal)", "fixBothReal", null],
];
for (const [name, cv, ov] of fall) {
  const t = lauf(cv, ov);
  console.log(name.padEnd(62), t ? ("Feuern " + L(t) + "  " + (ist ? (ist - t).toFixed(2) : "?") + " h frueher") : "nicht erreicht");
}
