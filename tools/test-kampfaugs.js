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

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) { console.log(""); for (const x of fehler) console.log("  ROT: " + x); }
console.log("");
process.exit(rot ? 1 : 0);
