/**
 * Ebene 0 am Stueck. Stufe A der Abnahme verlangt von diesem Aufruf Exit 0.
 *
 * Alle Tests laufen OHNE Spiel und ohne Bruecke. Das ist Absicht: ein
 * Testgeschirr, das eine laufende Umgebung braucht, wird genau dann nicht
 * gefahren, wenn die Umgebung kaputt ist.
 *
 * Aufruf:
 *   node tools/test-alles.js           alle
 *   node tools/test-alles.js --schnell nur die, die unter einer Sekunde brauchen
 */

import { execFile } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

/**
 * Je Eintrag: Datei, worum es geht, und ob der Test schnell ist.
 * Ein Test, der hier fehlt, wird nicht gefahren - deshalb steht bei jedem, was
 * er abdeckt, damit eine Luecke beim Lesen auffaellt.
 */
const TESTS = [
  {
    datei: "test-backup.js",
    deckt: "Sicherungskette: Format, Kennwerte, jeder Ablehnungsgrund, Rotation",
    schnell: true,
  },
  {
    datei: "test-verbote.js",
    deckt: "Verbotsgrep und Selbstblockade-Muster, mit Selbstprobe",
    schnell: true,
  },
  {
    datei: "test-route.js",
    deckt: "planeRoute ueber alle Routeneintraege",
    schnell: true,
  },
  {
    datei: "test-stillstandsuhr.js",
    deckt: "Stillstandsuhr des Motors",
    schnell: true,
  },
  {
    datei: "test-motorzeit.js",
    deckt: "Motorzeit gegen Drosselung, Offline-Nacht und Nachholklumpen",
    schnell: true,
  },
  {
    datei: "test-kontrakte.js",
    deckt: "Herzschlag v2, kpi.json-Feldliste und Ereignisstrom (C.1)",
    schnell: true,
  },
  {
    datei: "test-ram-namen.js",
    deckt: "Namenspruefer gegen die wakelock-Fehlerklasse, mit Selbstprobe",
    schnell: true,
  },
  {
    datei: "test-zielvalidierung.js",
    deckt: "Zielpruefung vor dem Sprung gegen die echte route.json (C.3)",
    schnell: true,
  },
  {
    datei: "test-registry.js",
    deckt: "Registry, Rollen-Riegel und der Migrationsbeweis gegen die heutige Liste (C.4)",
    schnell: true,
  },
  {
    datei: "test-graftwahl.js",
    deckt: "Graft-Auswahl: Vorzug, Puffer, Sprungnaehe, gegen den echten Plan (C.14)",
    schnell: true,
  },
  {
    datei: "test-figur.js",
    deckt: "Figur-Vergabepunkt: Lease, Rangfolge, Folgenummer, Knotenstempel (C.11)",
    schnell: true,
  },
  {
    datei: "test-leiter.js",
    deckt: "Strafleiter, Signale und die drei Waechteruhren, mit Uhren-Lint (C.6)",
    schnell: true,
  },
  {
    datei: "test-motor-ebene2.js",
    deckt: "EBENE 2: der echte Kern gegen den ns-Mock, drei Pflichtproben (C.1)",
    schnell: false,
  },
  {
    datei: "test-matrix-ebene2.js",
    deckt: "EBENE 2: Szenarienmatrix ueber alle 15 Knoten der Route",
    schnell: false,
  },
  {
    datei: "test-guard-ebene2.js",
    deckt: "EBENE 2: der Waechter im Beobachtungsmodus, boot.js-Schonliste (C.6)",
    schnell: false,
  },
  {
    datei: "test-endspurt.js",
    deckt: "Ausgangs-Interlock und Endspurt-Regel, inkl. ns.read-Asymmetrie (C.3)",
    schnell: true,
  },
  {
    datei: "test-reserve-eta.js",
    deckt: "Wirtreserve mit Verfall und Restzeit gegen Nachholklumpen (C.3)",
    schnell: true,
  },
  {
    datei: "test-analyse-eichung.js",
    deckt: "Eichung der ersetzten Analyse-Familie gegen den Spielquelltext (C.7)",
    schnell: true,
  },
  {
    datei: "test-formeln.js",
    deckt: "Die entscheidungstragenden Formeln gegen unabhaengige Eichpunkte",
    schnell: true,
  },
];

/**
 * Was Ebene 0 nach Auftrag 6.1 noch abdecken MUSS und heute nicht abdeckt.
 * Die Liste wird ausgegeben, nicht verschwiegen: ein gruener Sammellauf, der
 * die Haelfte nicht prueft, ist gefaehrlicher als ein roter.
 */
const LUECKEN = [


  // Der ns-Mock steht seit dem 04.09.2026 (tools/mock/ns.js + lader.js), und
  // der Kern laeuft damit in test-motor-ebene2.js. Was noch fehlt, ist die
  // Breite: dieselben Proben ueber die verschiedenen Knotenklassen.

];

const nurSchnell = process.argv.includes("--schnell");

function fahre(datei) {
  return new Promise((fertig) => {
    const p = path.join(HIER, datei);
    if (!fs.existsSync(p)) {
      fertig({ datei, rc: 127, ausgabe: "Datei fehlt: " + p });
      return;
    }
    const beginn = Date.now();
    execFile("node", [p], { cwd: ROOT, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
      (err, out, errout) => {
        fertig({
          datei,
          rc: err ? (err.code ?? 1) : 0,
          ms: Date.now() - beginn,
          ausgabe: (out || "") + (errout || ""),
        });
      });
  });
}

console.log("");
console.log("===========================================");
console.log("  Ebene 0 - alle Tests ohne Spiel");
console.log("===========================================");

const auswahl = TESTS.filter((t) => !nurSchnell || t.schnell);
const ergebnisse = [];

for (const t of auswahl) {
  const r = await fahre(t.datei);
  ergebnisse.push({ ...t, ...r });
  const zeichen = r.rc === 0 ? "gruen" : "ROT  ";
  console.log("");
  console.log("  [" + zeichen + "] " + t.datei + "  (" + (r.ms ?? "?") + " ms)");
  console.log("           " + t.deckt);
  if (r.rc !== 0) {
    console.log("");
    for (const z of r.ausgabe.split("\n").slice(-25)) console.log("      " + z);
  }
}

const rot = ergebnisse.filter((r) => r.rc !== 0);

console.log("");
console.log("===========================================");
console.log("  " + (ergebnisse.length - rot.length) + " von " + ergebnisse.length + " gruen");
if (rot.length) {
  for (const r of rot) console.log("  ROT: " + r.datei + " (Exit " + r.rc + ")");
}
console.log("===========================================");
console.log("");
console.log("  NOCH NICHT ABGEDECKT (Auftrag 6.1):");
for (const l of LUECKEN) console.log("    - " + l);
console.log("");
console.log("  Stufe A verlangt Exit 0 UND eine leere Lueckenliste.");
console.log("");

process.exit(rot.length ? 1 : 0);
