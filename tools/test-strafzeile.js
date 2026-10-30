/**
 * Strafzeile in /bb: Entwarnungen zaehlen nicht als Strafe (30.10.2026).
 * Befund: "Strafen (24 h): 1x Sprosse 1", einziger Eintrag war die
 * Entwarnung (stood-down) fuer figwatch.js. Gegen den alten Stand ROT:
 * tools/lib/strafzeile.js fehlt, die Logik stand inline in checkin.js und
 * zaehlte jeden Eintrag.
 * Aufruf: node tools/test-strafzeile.js [repo-verzeichnis]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let rot = 0;
const pruefe = (name, ok, extra = "") => {
  console.log((ok ? "  ok    " : "  ROT   ") + name + (extra ? "  (" + extra + ")" : ""));
  if (!ok) rot++;
};
console.log("\n=== Strafzeile: Entwarnung ist keine Strafe ===\n");

const libPfad = path.join(ROOT, "tools", "lib", "strafzeile.js");
if (!fs.existsSync(libPfad)) {
  pruefe("tools/lib/strafzeile.js vorhanden", false);
  console.log("\nROT: " + rot);
  process.exit(1);
}
const { penaltyLines, isPenalty } = await import(pathToFileURL(libPfad).href);
const NOW = 1793340000000;
const T = () => "12:00:00";
// Der Eintrag vom 29.10.2026, wortgleich aus data/penalties.json
const entwarnung = { rung: 1, target: "figwatch.js", reason: "S1", grund: "Entwarnung nach 10 min ohne Signal",
  wall: NOW - 22 * 3600000, playtime: 6102384400, round: 62, result: "stood-down" };
const strafe = (o = {}) => ({ rung: 2, target: "bn4net.js", reason: "S2", wall: NOW - 3600000, result: "executed", ...o });

pruefe("nur eine Entwarnung: keine Zeile", penaltyLines([entwarnung], NOW, T).length === 0,
  JSON.stringify(penaltyLines([entwarnung], NOW, T)));
pruefe("isPenalty(stood-down) ist false", isPenalty(entwarnung) === false);
for (const r of ["executed", "failed", "would-execute", "ordered", "pending", undefined]) {
  pruefe("isPenalty(" + r + ") ist true", isPenalty(strafe({ result: r })) === true);
}

{
  const z = penaltyLines([entwarnung, strafe()], NOW, T);
  pruefe("Strafe plus Entwarnung: eine Zeile", z.length === 1, JSON.stringify(z));
  pruefe("zaehlt nur die Strafe", z[0] && z[0].startsWith("Strafen (24 h): 1x Sprosse 2 "), z[0]);
  pruefe("nennt die Entwarnung als Nachsatz", z[0] && z[0].endsWith("(dazu 1 Entwarnung)"), z[0]);
}
{
  const z = penaltyLines([strafe(), strafe({ rung: 1 }), strafe({ rung: 2 })], NOW, T);
  pruefe("ohne Entwarnung kein Nachsatz", z[0] === "Strafen (24 h): 1x Sprosse 1, 2x Sprosse 2", z[0]);
}
{
  const s3 = strafe({ rung: 3, target: "blade.js", reason: "S3", result: "failed" });
  const e3 = { ...entwarnung, rung: 3, target: "gang.js", wall: NOW - 60000 };
  const z = penaltyLines([s3, e3], NOW, T);
  pruefe("Sprosse 3 als Strafe einzeln genannt", z.length === 3 && z[1] === "  Sprosse 3 auf blade.js (S3) um 12:00:00 - failed", JSON.stringify(z));
  pruefe("Sprosse-3-Entwarnung bleibt als Spur sichtbar", z[2] === "  Sprosse 3 auf gang.js (S1) um 12:00:00 - Entwarnung", z[2]);
  pruefe("Mehrzahl der Entwarnungen", penaltyLines([s3, e3, e3], NOW, T)[0].endsWith("(dazu 2 Entwarnungen)"));
}
{
  // Live-Fall bis 20.10.: "kern" S3a stieg fast taeglich bis Sprosse 3 und wurde entwarnt
  const kern = { ...entwarnung, rung: 3, target: "kern", reason: "S3a", wall: NOW - 7200000 };
  const z = penaltyLines([entwarnung, kern], NOW, T);
  pruefe("nur Entwarnungen, eine davon ab Sprosse 3: Kopfzeile sagt 'keine'",
    z.length === 2 && z[0] === "Strafen (24 h): keine, aber Verdacht ab Sprosse 3 mit Entwarnung:", JSON.stringify(z));
  pruefe("  und die Sprosse-3-Zeile steht darunter", z[1] === "  Sprosse 3 auf kern (S3a) um 12:00:00 - Entwarnung", z[1]);
  pruefe("Sprosse-1-Entwarnung dabei nicht einzeln", !z.some((l) => l.includes("figwatch")));
}
{
  const z = penaltyLines([strafe({ rung: 4.5, target: "bn4net.js", reason: "S4" })], NOW, T);
  pruefe("Sprosse 4.5 einzeln genannt", z.length === 2 && z[0] === "Strafen (24 h): 1x Sprosse 4.5" && z[1].includes("Sprosse 4.5 auf bn4net.js"), JSON.stringify(z));
  const n = penaltyLines([strafe({ rung: null })], NOW, T);
  pruefe("Sprosse null: Zeile wie bisher, keine Einzelzeile", n.length === 1 && n[0] === "Strafen (24 h): 1x Sprosse null", JSON.stringify(n));
  const d = penaltyLines([strafe({ rung: 3 })], NOW);
  pruefe("Standard-Zeitformat wie bisher (de-DE)", d[1] && d[1].includes(" um " + new Date(NOW - 3600000).toLocaleTimeString("de-DE") + " - executed"), d[1]);
}
pruefe("aelter als 24 h: weg", penaltyLines([strafe({ wall: NOW - 25 * 3600000 })], NOW, T).length === 0);
pruefe("keine Liste: keine Zeile, kein Absturz", penaltyLines(undefined, NOW, T).length === 0 && penaltyLines(null, NOW, T).length === 0);
pruefe("null-Eintrag in der Liste: kein Absturz", penaltyLines([null, strafe()], NOW, T).length === 1);

// checkin.js nutzt die Bibliothek und zaehlt nicht mehr selbst
const ci = fs.readFileSync(path.join(ROOT, "tools", "checkin.js"), "utf8");
pruefe("checkin.js importiert penaltyLines", /import \{ penaltyLines \} from "\.\/lib\/strafzeile\.js"/.test(ci));
pruefe("checkin.js hat keine eigene Sprossenzaehlung mehr", !/nachSprosse\[e\.rung\]/.test(ci));

console.log(rot ? "\nROT: " + rot : "\nalles gruen");
process.exit(rot ? 1 : 0);
