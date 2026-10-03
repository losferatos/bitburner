/**
 * Ebene 0: welche Augmentierungen ein Kampfknoten ueberhaupt kauft
 * (lib/hackaugs.js kampfknotenNuetzlich, 23.09.2026).
 *
 * WARUM: bn4rep.js kaufte jedes verdiente Stueck, und jedes verteuert jedes
 * weitere im Zyklus um 1,9. Am 23.09. sparte der Bot zwei Stunden
 * Hash-Einnahmen fuer ADR-V1 (Ruf x1,1). Geprueft wird die Liste - und dass
 * jeder Name darin im Spielquelltext wirklich so heisst: ein Tippfehler
 * wuerde ein nuetzliches Stueck still aussperren.
 *
 * Aufruf: node tools/test-kampfaugs.js
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const H = await import(pathToFileURL(path.join(ROOT, "src", "lib", "hackaugs.js")).href);

let gruen = 0;
let rot = 0;
const fehler = [];
function pruefe(was, bedingung, zusatz = "") {
  if (bedingung) { gruen++; console.log("  ok    " + was); }
  else {
    rot++;
    fehler.push(was + (zusatz ? " - " + zusatz : ""));
    console.log("  ROT   " + was + (zusatz ? " - " + zusatz : ""));
  }
}

console.log("");
console.log("=== Kampfknoten: nuetzliche Augmentierungen ===");

const f = H.kampfknotenNuetzlich;
pruefe("kampfknotenNuetzlich ist exportiert", typeof f === "function");
if (typeof f === "function") {
  pruefe("ADR-V1 Pheromone Gene (nur Ruf) ist NICHT nuetzlich", !f("ADR-V1 Pheromone Gene", true));
  pruefe("Bionic Arms (Kampfwerte) ist nuetzlich", f("Bionic Arms", false));
  pruefe("Hyperion Plasma Cannon V1 (Bladeburner-Chance) ist nuetzlich", f("Hyperion Plasma Cannon V1", false));
  pruefe("The Blade's Simulacrum ist nuetzlich", f("The Blade's Simulacrum", false));
  pruefe("The Red Pill ist nuetzlich", f("The Red Pill", false));
  pruefe("Hacknet-Stueck mit Hacknet-Servern nuetzlich", f("Hacknet Node Core Direct-Neural Interface", true));
  pruefe("Hacknet-Stueck ohne Hacknet-Server nicht", !f("Hacknet Node Core Direct-Neural Interface", false));
  pruefe("reines Hack-Stueck (BitWire) nicht", !f("BitWire", true));
  pruefe("Stanek's Gift - Genesis (Faktor 0,9) nicht", !f("Stanek's Gift - Genesis", true));
}

// P0 / G02 (03.10.2026, Audit "vollstaendig", verify-g02-beide.md): Hacknet-
// Stuecke nur dort, wo NACH dem Einbau Hacknet-Server gekauft werden. Das
// Praedikat ist reine Funktion - bn4rep.js (kaufen) und hacknet.js (neu kaufen
// oder beenden) rufen dieselbe.
console.log("");
console.log("=== Hacknet-Stuecke: hacknetNachEinbau (ein Praedikat fuer bn4rep.js und hacknet.js) ===");
{
  const g = H.hacknetNachEinbau;
  pruefe("hacknetNachEinbau ist exportiert", typeof g === "function");
  if (typeof g === "function") {
    for (const k of [2, 3, 11, 15, 8, 12, 1, 0]) {
      pruefe("hacknetNachEinbau(" + k + ") === false", g(k) === false);
    }
    pruefe("hacknetNachEinbau(9) === true", g(9) === true);
    // Die Funktion liefert immer einen echten Boolean (kein undefined, kein "9").
    pruefe("hacknetNachEinbau(undefined) und ('9') sind false (strenger Vergleich)",
      g(undefined) === false && g("9") === false);
  }
  // Quellprobe: bn4rep.js bildet mitHashes aus dem Praedikat - nicht mehr aus
  // dem SF-Besitz (ownedSF / sf.get(9)); hacknet.js hat keine harte 9 mehr.
  const rep = fs.readFileSync(path.join(ROOT, "src", "bn4rep.js"), "utf8");
  pruefe("bn4rep.js: mitHashes = hacknetNachEinbau(...)",
    /const\s+mitHashes\s*=\s*hacknetNachEinbau\(/.test(rep));
  pruefe("bn4rep.js: importiert hacknetNachEinbau aus lib/hackaugs.js",
    /import\s*\{[^}]*\bhacknetNachEinbau\b[^}]*\}\s*from\s*["']lib\/hackaugs\.js["']/.test(rep));
  // Zusammenfuehrung P0+P1 (04.10.2026): P1 liest ownedSF an anderer Stelle (Block 1c,
  // SF11-Preisfaktor der Torrunde: `kaufInfo.ownedSF` -> sf.get(11)). Darum prueft die
  // Probe nur die ANWEISUNG mitHashes und dass nirgends SF9 gelesen wird - nicht mehr
  // "ownedSF kommt in der ganzen Datei nicht vor".
  const mhAnweisung = (rep.match(/const\s+mitHashes\s*=[^;]*;/) || [""])[0];
  pruefe("bn4rep.js: mitHashes liest ownedSF nicht mehr (die alte Fehlregel 'SF9 da')",
    mhAnweisung !== "" && !/ownedSF|\bsf\b/.test(mhAnweisung) && !/sf\.get\(\s*9\s*\)/.test(rep),
    mhAnweisung || "Anweisung mitHashes nicht gefunden");
  const hn = fs.readFileSync(path.join(ROOT, "src", "hacknet.js"), "utf8");
  pruefe("hacknet.js: importiert hacknetNachEinbau aus lib/hackaugs.js",
    /import\s*\{[^}]*\bhacknetNachEinbau\b[^}]*\}\s*from\s*["']lib\/hackaugs\.js["']/.test(hn));
  const nutzungen = (hn.match(/hacknetNachEinbau\(knoten\)/g) || []).length;
  pruefe("hacknet.js: alle drei Stellen (erster Server, Ausstieg, Ausbau) fragen das Praedikat",
    nutzungen === 3, "gefunden: " + nutzungen);
  pruefe("hacknet.js: keine harte Knotennummer 9 mehr in den Bedingungen",
    !/knoten\s*(===|!==)\s*9/.test(hn));
}

// Namen gegen den Spielquelltext halten.
const enumPfad = path.join(ROOT, "reference", "bitburner-src", "src", "Augmentation", "Enums.ts");
if (fs.existsSync(enumPfad)) {
  const text = fs.readFileSync(enumPfad, "utf8");
  const namen = new Set([...text.matchAll(/=\s*"([^"]+)"/g)].map((m) => m[1]));
  const liste = [...(H.HACKNET_AUGS || []), "The Blade's Simulacrum", "The Red Pill",
    ...Object.keys(H.COMBAT_AUGS || {})];
  const fremd = liste.filter((n) => !namen.has(n));
  pruefe("jeder Name steht so im Spielquelltext (Augmentation/Enums.ts)", fremd.length === 0,
    fremd.join(", "));
} else {
  console.log("  (Spielquelltext fehlt - Namensprobe uebersprungen)");
}

// SKEPTIKER-AUDIT 26.09.2026, FUND 7: der Kampf-Levelfaktor des Knotens war
// hart auf `knoten === 10 ? 0,4 : 1` codiert (ENTSCHIEDEN "nie eine
// Knotennummer im Code"). Die Zahlen selbst sind in test-formeln.js gegen
// `expFuerStufe` geeicht (11.255 vs. 267.800, Faktor 23,8 in BN14) - hier nur
// die Gegenprobe gegen die tatsaechliche Datei: kein hartcodierter Knoten
// mehr, und `getBitNodeMultipliers` wird tatsaechlich aufgerufen.
console.log("");
console.log("=== Kampfknoten: Kampf-Levelfaktor nicht mehr hartcodiert ===");
{
  const quelltext = fs.readFileSync(path.join(ROOT, "src", "kampfaugs.js"), "utf8");
  pruefe(
    "kein 'knoten === 10' mehr im Code (Fund 7)",
    !/knoten\s*===\s*10/.test(quelltext),
    "die alte Zeile waere zurueck",
  );
  pruefe(
    "der Kampf-Levelfaktor kommt aus ns.getBitNodeMultipliers()",
    /getBitNodeMultipliers/.test(quelltext) && /LevelMultiplier/.test(quelltext),
    "erwartet: live gelesen wie blade.js:773",
  );
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) { console.log(""); for (const x of fehler) console.log("  ROT: " + x); }
console.log("");
process.exit(rot ? 1 : 0);
