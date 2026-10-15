/**
 * Gekaufte Augs beim Sprung: bewusst gehalten oder verloren? (15.10.2026)
 *
 * BN6.3 -> BN7: sieben Blade-Augs in der Warteschlange, der Einbau war bis
 * zum Sprung vom Endspurt-Tor gesperrt (lib/endspurt.js einbauErlaubt) - der
 * Check-in meldete "5 gekaufte Augs beim Sprung verfallen" als Befund. Gegen
 * den alten Stand ROT: lib/einbauhalt.js fehlt, ausgang.js liest nur
 * kampfZuFrueh.
 *
 * Aufruf: node tools/test-einbauhalt.js [repo-verzeichnis]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let gruen = 0, rot = 0;
const pruefe = (name, ok, info = "") => {
  if (ok) { gruen++; console.log("  ok    " + name); }
  else { rot++; console.log("  ROT   " + name + (info ? " - " + info : "")); }
};

console.log("\n=== Augs beim Sprung: bewusst gehalten? ===\n");

const lib = path.join(ROOT, "src", "lib", "einbauhalt.js");
let f = null;
if (fs.existsSync(lib)) ({ augsBewusstGehalten: f } = await import(pathToFileURL(lib).href));
pruefe("src/lib/einbauhalt.js vorhanden", typeof f === "function");

if (f) {
  const reset = 1000, jetzt = 10 * 3600000;
  const einbau = (o = {}) => ({ zeit: jetzt - 60000, kampfZuFrueh: false, ...o });
  const tor = (o = {}) => ({ zeit: jetzt - 30000, state: "wait", blockedReason: "locked", warteGrund: "Sprung in etwa 20 min", ...o });
  pruefe("Wiederaufbau-Frist (kampfZuFrueh) zaehlt wie bisher", f(einbau({ kampfZuFrueh: true }), null, reset, jetzt) === true);
  pruefe("Endspurt-Tor frisch: bewusst gehalten (BN6.3-Fall)", f(einbau(), tor(), reset, jetzt) === true);
  pruefe("Tor-Zustand 4 min alt: nicht mehr gehalten", f(einbau(), tor({ zeit: jetzt - 4 * 60000 }), reset, jetzt) === false);
  pruefe("Ausgang offen (Endspurt) zaehlt ebenfalls", f(einbau(), tor({ warteGrund: "Der Ausgang steht OFFEN. Ein Einbau wuerde ..." }), reset, jetzt) === true);
  pruefe("laufender Graft zaehlt NICHT als bewusst (koennte haengen)", f(einbau(), tor({ warteGrund: "ein Graft laeuft (QLink)" }), reset, jetzt) === false);
  pruefe("kein Tor, keine Frist: echter Verlust", f(einbau(), { zeit: jetzt - 30000, state: "work" }, reset, jetzt) === false);
  pruefe("Tor-Zustand von vor dem letzten Einbau zaehlt nicht", f(null, tor({ zeit: 500 }), reset, jetzt) === null);
  pruefe("nichts lesbar: nicht pruefbar (null)", f(null, null, reset, jetzt) === null);
}

const ausgang = fs.readFileSync(path.join(ROOT, "src", "ausgang.js"), "utf8");
pruefe("ausgang.js fragt augsBewusstGehalten mit einbau.json UND bn4rep.json",
  ausgang.includes("augsBewusstGehalten(") && ausgang.includes("data/bn4rep.json"));

console.log("\n=== " + gruen + " gruen, " + rot + " rot ===\n");
process.exit(rot ? 1 : 0);
