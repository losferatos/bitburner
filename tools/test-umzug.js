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
  // LOW_COMMS_MAX_ACTIONS aus dem Quelltext (23.10.2026); fehlt sie (alter Stand), ist sie unbenutzt.
  const mMax = quelle.match(/const LOW_COMMS_MAX_ACTIONS = (\d+);/);
  const mHere = quelle.match(/const LOW_COMMS_HERE_MAX = (\d+);/);
  const f = new Function("const LOW_COMMS_MAX_ACTIONS = " + (mMax ? mMax[1] : "Infinity") + "; const LOW_COMMS_HERE_MAX = "
    + (mHere ? mHere[1] : "Infinity") + ";\n" + q + "\nreturn umzugWahl;")();
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

  // AUCH UNTER 55 GEMEINDEN (23.10.2026). BN7.3 h36,1 (Sicherung): Ishima
  // 0,213 Mrd bei Chaos 46 mit 17 Gemeinden, Volhaven 2,291 Mrd bei Chaos 88
  // mit 6 Gemeinden, Charisma 171. Gegen den alten Stand ROT.
  const mQ = quelle.match(/const LOW_COMMS_UMZUG_Q = ([\d.]+);/);
  const LEAD = mQ ? +mQ[1] : 3.4;
  const d171 = Math.pow(171, 0.045) + 171 / 1000;
  const nied = (hier, liste, lead) => f(hier, liste, 55, d171, 47, 2, 150, undefined, lead);
  const h36 = nied(st("Ishima", 0.213e9, 46, true, 17), [st("Volhaven", 2.291e9, 88, true, 6)], LEAD);
  pruefe("BN7.3 h36: Aufraeumfahrt nach Volhaven trotz 6 Gemeinden", h36 && h36.stadt === "Volhaven",
    h36 ? h36.stadt + " q " + h36.q.toFixed(2) : "null");
  pruefe("ohne lowCommsLead bleibt der alte Ausschluss",
    nied(st("Ishima", 0.213e9, 46, true, 17), [st("Volhaven", 2.291e9, 88, true, 6)], undefined) === null);
  pruefe("BN7.3 h39 (q 2,64, Raid in Chongqing trug): kein Umzug",
    nied(st("Chongqing", 0.460e9, 47, true, 17), [st("Volhaven", 1.842e9, 110, true, 5)], LEAD) === null);
  pruefe("BN7.1 h63,6 (hier 56 Gemeinden, q 3,19): kein Umzug",
    nied(st("Aevum", 0.138e9, 48, true, 56), [st("Ishima", 0.7e9, 70, true, 3)], LEAD) === null);
  pruefe("hier 24 Gemeinden: kein Umzug in Stadt unter 55, auch bei q 5",
    nied(st("Ishima", 0.213e9, 46, true, 24), [st("Volhaven", 2.291e9, 88, true, 6)], LEAD) === null);
  pruefe("dieselbe Stadt mit 60 Gemeinden: Vorsprung 2 reicht wie bisher",
    (nied(st("Ishima", 0.3e9, 28, true, 24), [st("Volhaven", 0.987e9, 88, true, 60)], LEAD) || {}).stadt === "Volhaven");
  pruefe("unter 55 Gemeinden hoechstens 90 Diplomacy-Laeufe (Chaos 400 bei Charisma 171: 147)",
    nied(st("Ishima", 0.213e9, 46, true, 17), [st("Volhaven", 2.291e9, 400, true, 6)], LEAD) === null);
  pruefe("Ziel mit Untergrenze (lower) zaehlt",
    (nied(st("Ishima", 0.213e9, 46, true, 17), [{ ...st("Volhaven", 2.291e9, 88, false, 6), lower: true }], LEAD) || {}).stadt === "Volhaven");
}

pruefe("laufender Umzug sperrt die Rundreise (23.10.)", /if \(RAID_AN && !umzugZiel\) \{/.test(quelle));
pruefe("Umzug-Aufruf gibt LOW_COMMS_UMZUG_Q mit",
  /UMZUG_VORSPRUNG, UMZUG_MAX_AKTIONEN, umzugGesperrt, LOW_COMMS_UMZUG_Q\);/.test(quelle));
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
