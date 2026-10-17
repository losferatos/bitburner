/**
 * Umzug mit Aufraeumen (17.10.2026).
 *
 * BitNode 7.1, 13:55: Aevum 0,73 Mrd bei Chaos 163, Sector-12 0,22 Mrd bei
 * 48 - die Feinwahl sah Aevum nur zum jetzigen Chaos und blieb. Gegen den
 * alten Stand ROT: umzugWahl fehlt, keine Sperre der Stadtwahl.
 *
 * Aufruf: node tools/test-umzug.js [pfad/zu/blade.js]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATEI = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, "src", "blade.js");
const quelle = fs.readFileSync(DATEI, "utf8").replace(/\r\n/g, "\n");

let gruen = 0, rot = 0;
const pruefe = (name, ok, info = "") => {
  if (ok) { gruen++; console.log("  ok    " + name + (info ? "  (" + info + ")" : "")); }
  else { rot++; console.log("  ROT   " + name + (info ? " - " + info : "")); }
};

function extrahiere(text, name) {
  const start = text.indexOf("const " + name + " = ");
  if (start < 0) return null;
  const k = text.indexOf("{", text.indexOf("=>", start));
  let tiefe = 0, i = k;
  for (; i < text.length; i++) {
    const c = text[i];
    if (c === "{") tiefe++;
    else if (c === "}") { tiefe--; if (tiefe === 0) break; }
  }
  return text.slice(start, text[i + 1] === ";" ? i + 2 : i + 1);
}

console.log("\n=== Umzug mit Aufraeumen ===\n");

const q = extrahiere(quelle, "umzugWahl");
pruefe("umzugWahl im Quelltext", !!q, q ? "" : "alte Fassung");
if (q) {
  const f = new Function(q + "\nreturn umzugWahl;")();
  const st = (stadt, pop, chaos, sicher = true, comms = 100) => ({ stadt, pop, chaos, sicher, comms });
  const dipl = Math.pow(115, 0.045) + 115 / 1000;   // Charisma 115, 13:55
  const w = (hier, liste, gesperrt) => f(hier, liste, 55, dipl, 47, 2, 150, gesperrt);
  const bn7 = [st("Aevum", 0.73e9, 163.6, true, 109), st("Chongqing", 0.27e9, 127.9, true, 32),
    st("New Tokyo", 0.22e9, 54.3, true, 58), st("Ishima", 0.41e9, 106, true, 3), st("Volhaven", 0.33e9, 139.4, true, 13)];
  const r = w(st("Sector-12", 0.22e9, 48.4, true, 81), bn7);
  pruefe("BN7.1-Befund: Umzug nach Aevum", r && r.stadt === "Aevum", r ? r.stadt : "null");
  pruefe("Vorsprung 2,3-fach", r && Math.abs(r.q - Math.pow(0.73 / 0.22, 0.7)) < 1e-9, r ? r.q.toFixed(3) : "");
  pruefe("rund 91 Diplomacy-Laeufe", r && r.aktionen >= 88 && r.aktionen <= 94, r ? String(r.aktionen) : "");
  pruefe("Charisma 1 bei Chaos 400: zu teuer (213 Laeufe), kein Umzug",
    f(st("Sector-12", 0.22e9, 48.4), [st("Aevum", 0.73e9, 400)], 55, Math.pow(1, 0.045) + 0.001, 47, 2, 150) === null);
  pruefe("unter Vorsprung 2 kein Umzug",
    w(st("Sector-12", 0.5e9, 40), [st("Aevum", 0.73e9, 120)]) === null);
  pruefe("Ziel unter Chaos 50 ist Sache der Feinwahl",
    w(st("Sector-12", 0.1e9, 40), [st("Aevum", 0.73e9, 45)]) === null);
  pruefe("Ziel mit unsicherem r zaehlt nicht",
    w(st("Sector-12", 0.22e9, 48), [st("Aevum", 0.73e9, 163, false)]) === null);
  pruefe("Ziel mit zu wenig Gemeinden zaehlt nicht",
    w(st("Sector-12", 0.22e9, 48), [st("Aevum", 0.73e9, 163, true, 20)]) === null);
  pruefe("gesperrtes Ziel zaehlt nicht",
    w(st("Sector-12", 0.22e9, 48), [st("Aevum", 0.73e9, 163)], new Set(["Aevum"])) === null);
  pruefe("hier unsicher: kein Umzug",
    w(st("Sector-12", 0.22e9, 48, false), [st("Aevum", 0.73e9, 163)]) === null);
  pruefe("kein Diplomacy-Satz: kein Umzug",
    f(st("Sector-12", 0.22e9, 48), [st("Aevum", 0.73e9, 163)], 55, 0, 47, 2, 150) === null);
}

pruefe("laufender Umzug sperrt die Stadtwahl (break stadtwahl)",
  /stadtwahl: try \{[\s\S]{0,600}if \(umzugZiel\) \{[\s\S]{0,700}\} else break stadtwahl;/.test(quelle));
pruefe("Umzug endet bei Chaos unter CHAOS_AUS oder anderer Stadt",
  /if \(hier !== umzugZiel \|\| !\(chaosLage\(\) >= CHAOS_AUS\)\) \{ umzugZiel = null; umzugSchreiben\(\); \}/.test(quelle));
pruefe("Umzug nur ausserhalb des Aufraeumens und vor der Feinwahl",
  /\} else if \(!chaosAufraeumen && [\s\S]{0,600}const umzug = !\(raidHier < UMZUG_CHANCE_MAX\) \? null : umzugWahl\(feinHier, fein, RUNDREISE_MIN_COMMS,[\s\S]{0,200}const ziel = umzug \? null : feinWahl/.test(quelle));
pruefe("abgebrochener Umzug sperrt die Stadt 6 h Spielzeit",
  /umzugGesperrt\.set\(umzugZiel, spielMs \+ UMZUG_SPERRE_MS\);/.test(quelle));
pruefe("Budget in Spielzeit, nicht je Wahl (Skeptiker Befund 1)",
  /else if \(spielMs > umzugBisMs\)/.test(quelle) && !/umzugRunden/.test(quelle));
pruefe("Spielzeit an jedem nextUpdate mitgezaehlt",
  (quelle.match(/spielMs \+= Number\(await ns\.bladeburner\.nextUpdate\(\)\) \|\| 0;/g) || []).length
    === (quelle.match(/await ns\.bladeburner\.nextUpdate\(\)/g) || []).length);
pruefe("Umzug ueberlebt Neustart (data/umzug.txt, Befund 3)",
  /liesVonHome\(ns, UMZUG_DATEI\)/.test(quelle)
    && /umzugBisMs = spielMs \+ 2 \* umzug\.aktionen \* 60e3 \+ 30 \* 60e3;\s*umzugSchreiben\(\);/.test(quelle));

console.log("\n=== " + gruen + " gruen, " + rot + " rot ===\n");
process.exit(rot ? 1 : 0);
