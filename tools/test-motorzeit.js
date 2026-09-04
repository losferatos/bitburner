/**
 * Ebene 0: Die Motorzeit gegen die drei Pflichtproben aus Auftrag 3.1.
 *
 *   8 h gedrosselt  = 8 h Motorzeit
 *   8 h Rechner aus = 0
 *   Nachholklumpen  = 0
 *
 * Diese drei Zeilen sind der Grund, warum es die Uhr ueberhaupt gibt. Ein Test,
 * der nur die erste prueft, prueft die falsche: dass eine Uhr vorwaerts laeuft,
 * ist leicht; dass sie bei Stillstand STEHT, ist der Punkt.
 *
 * Die Uhr liegt im Worktree (bitburner-bau/src/lib/motorzeit.js), weil alles
 * unter src/ der Live-Arbeitskopie binnen 400 ms ins laufende Spiel geht.
 *
 * Aufruf: node tools/test-motorzeit.js
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

// Erst im Worktree suchen, dann in der Arbeitskopie - je nachdem, wie weit die
// Position C.1 schon live ist.
const KANDIDATEN = [
  path.join(ROOT, "src", "lib", "motorzeit.js"),
  path.resolve(ROOT, "..", "bitburner-bau", "src", "lib", "motorzeit.js"),
];
const QUELLE = KANDIDATEN.find((p) => fs.existsSync(p));
if (!QUELLE) {
  console.log("");
  console.log("  src/lib/motorzeit.js nicht gefunden - weder im Worktree noch live.");
  console.log("  Gesucht in:");
  for (const k of KANDIDATEN) console.log("    " + k);
  console.log("");
  process.exit(1);
}

const { neuerZustand, runde, motorStunden, inKarenz, zuruecksetzen, laden } =
  await import(pathToFileURL(QUELLE).href);

let gruen = 0;
let rot = 0;
const fehler = [];

function pruefe(name, bedingung, hinweis = "") {
  if (bedingung) {
    gruen++;
    console.log("  ok    " + name);
  } else {
    rot++;
    fehler.push(name + (hinweis ? " - " + hinweis : ""));
    console.log("  ROT   " + name + (hinweis ? " - " + hinweis : ""));
  }
}

function nah(a, b, toleranz = 0.01) {
  return Math.abs(a - b) <= toleranz;
}

const TAKT = 10000;
const H = 3600000;

console.log("");
console.log("=== Ebene 0: Motorzeit ===");
console.log("  Quelle: " + QUELLE);
console.log("");

console.log("-- Probe 1: acht Stunden normaler Betrieb --");
{
  const z = neuerZustand(TAKT);
  let wall = 1_700_000_000_000;
  let play = 100 * H;
  // 8 h bei 10-Sekunden-Takt = 2880 Runden
  for (let i = 0; i < 2880; i++) {
    wall += TAKT;
    play += TAKT;
    runde(z, wall, play);
  }
  pruefe("8 h wach = 8 h Motorzeit", nah(motorStunden(z), 8, 0.01),
    "erhalten " + motorStunden(z).toFixed(3) + " h");
  pruefe("alle Runden gezaehlt", z.verworfeneRunden === 0,
    z.verworfeneRunden + " verworfen");
}

console.log("");
console.log("-- Probe 2: acht Stunden GEDROSSELT (1 Runde je Minute) --");
{
  const z = neuerZustand(TAKT);
  let wall = 1_700_000_000_000;
  let play = 100 * H;
  // Der verdeckte Tab liefert eine Weckung je Minute. Die Spielzeit laeuft
  // dabei mit Wanduhrgeschwindigkeit weiter - das Spiel rechnet, es meldet sich
  // nur seltener.
  for (let i = 0; i < 480; i++) {
    wall += 60000;
    play += 60000;
    runde(z, wall, play);
  }
  pruefe("8 h gedrosselt = 8 h Motorzeit", nah(motorStunden(z), 8, 0.02),
    "erhalten " + motorStunden(z).toFixed(3) + " h");
  pruefe("keine Runde verworfen", z.verworfeneRunden === 0,
    z.verworfeneRunden + " verworfen");
}
{
  // DIE GEGENPROBE ZUM DECKEL. Mit 2 x Takt statt 12 x waere dieselbe Stunde
  // nur ein Bruchteil wert - und der gedrosselte Nachtbetrieb saehe im Bericht
  // besser aus als der wache Tagbetrieb.
  const z = neuerZustand(TAKT);
  z.taktMs = TAKT;
  let wall = 1_700_000_000_000;
  let play = 100 * H;
  for (let i = 0; i < 480; i++) {
    wall += 60000;
    play += 60000;
    runde(z, wall, play);
  }
  const mit12 = motorStunden(z);

  const z2 = neuerZustand(5000); // Deckel 60 s - der Grenzfall
  let w2 = 1_700_000_000_000;
  let p2 = 100 * H;
  for (let i = 0; i < 480; i++) {
    w2 += 60000;
    p2 += 60000;
    runde(z2, w2, p2);
  }
  pruefe("bei Takt 5 s liegt die Drosselung genau auf dem Deckel", motorStunden(z2) > 7.9,
    "erhalten " + motorStunden(z2).toFixed(2) + " h");
  pruefe("12 x Takt traegt die Drosselung", mit12 > 7.9);
}

console.log("");
console.log("-- Probe 3: acht Stunden RECHNER AUS --");
{
  const z = neuerZustand(TAKT);
  let wall = 1_700_000_000_000;
  let play = 100 * H;
  // Zehn Minuten Betrieb ...
  for (let i = 0; i < 60; i++) {
    wall += TAKT;
    play += TAKT;
    runde(z, wall, play);
  }
  const vorher = motorStunden(z);
  // ... dann acht Stunden nichts. Beim Aufwachen bucht die Engine die
  // Abwesenheit in einem Klumpen auf totalPlaytime.
  wall += 8 * H;
  play += 8 * H;
  const r = runde(z, wall, play);
  pruefe("die Offline-Runde zaehlt NICHT", !r.gezaehlt, r.grund || "");
  pruefe("Motorzeit unveraendert", nah(motorStunden(z), vorher, 0.001),
    "vorher " + vorher.toFixed(4) + ", jetzt " + motorStunden(z).toFixed(4));
  pruefe("8 h Rechner aus = 0 zusaetzliche Motorzeit", nah(motorStunden(z), 10 / 60, 0.01));
  pruefe("der Sprung wird als solcher vermerkt", r.sprung === true);
}

console.log("");
console.log("-- Probe 4: Nachholklumpen bei kleiner Wanduhr --");
{
  const z = neuerZustand(TAKT);
  let wall = 1_700_000_000_000;
  let play = 100 * H;
  runde(z, wall, play);
  // Die Engine verarbeitet 8 h Rueckstand in EINER Runde: die Wanduhr zeigt
  // 10 Sekunden, die Spielzeit springt um 8 Stunden. Das ist keine Arbeit des
  // Bots, sondern Buchhaltung des Spiels.
  wall += TAKT;
  play += 8 * H;
  const r = runde(z, wall, play);
  pruefe("Nachholklumpen zaehlt NICHT", !r.gezaehlt, r.grund || "");
  pruefe("Motorzeit bleibt null", nah(motorStunden(z), 0, 0.0001),
    "erhalten " + motorStunden(z).toFixed(5));
  pruefe("Grund nennt den Klumpen", /Nachholklumpen/.test(r.grund || ""));
}

console.log("");
console.log("-- Probe 5: Karenz nach einem Sprung --");
{
  const z = neuerZustand(TAKT);
  let wall = 1_700_000_000_000;
  let play = 100 * H;
  runde(z, wall, play);
  wall += 8 * H;
  play += 8 * H;
  runde(z, wall, play);
  pruefe("direkt nach dem Sprung: in Karenz", inKarenz(z, wall));
  pruefe("nach 5 min: noch in Karenz", inKarenz(z, wall + 5 * 60000));
  pruefe("nach 11 min: Karenz vorbei", !inKarenz(z, wall + 11 * 60000));
}

console.log("");
console.log("-- Probe 6: Uhr laeuft rueckwaerts --");
{
  const z = neuerZustand(TAKT);
  let wall = 1_700_000_000_000;
  let play = 100 * H;
  runde(z, wall, play);
  const r = runde(z, wall - 60000, play);
  pruefe("Rueckwaertssprung zaehlt nicht", !r.gezaehlt);
  pruefe("Grund nennt die Uhr", /rueckwaerts/i.test(r.grund || ""));
}

console.log("");
console.log("-- Probe 7: Zuruecksetzen bei Prestige --");
{
  const z = neuerZustand(TAKT);
  let wall = 1_700_000_000_000;
  let play = 100 * H;
  for (let i = 0; i < 360; i++) {
    wall += TAKT;
    play += TAKT;
    runde(z, wall, play);
  }
  pruefe("eine Stunde gezaehlt", nah(motorStunden(z), 1, 0.01));
  zuruecksetzen(z, "Knotenwechsel");
  pruefe("nach dem Zuruecksetzen: null", motorStunden(z) === 0);
  pruefe("Grund festgehalten", /Knotenwechsel/.test(z.letzterGrund || ""));
  pruefe("Takt bleibt erhalten", z.taktMs === TAKT);
  // Die erste Runde danach darf keinen Abstand verbuchen.
  wall += TAKT;
  play += TAKT;
  const r = runde(z, wall, play);
  pruefe("erste Runde nach dem Reset zaehlt nicht", !r.gezaehlt);
}

console.log("");
console.log("-- Probe 8: Laden und Wandern --");
{
  const z = neuerZustand(TAKT);
  let wall = 1_700_000_000_000;
  let play = 100 * H;
  for (let i = 0; i < 360; i++) {
    wall += TAKT;
    play += TAKT;
    runde(z, wall, play);
  }
  const gespeichert = JSON.stringify(z);
  const geladen = laden(gespeichert, TAKT);
  pruefe("Motorzeit ueberlebt das Speichern", nah(motorStunden(geladen), 1, 0.01),
    "erhalten " + motorStunden(geladen).toFixed(3));
  // NACH DEM LADEN IST DIE KETTE UNTERBROCHEN. Der Prozess war weg; die Zeit
  // dazwischen ist keine Arbeit. Wer das vergisst, schreibt beim Neustart die
  // gesamte Ausfallzeit als Motorzeit gut.
  pruefe("letzteWall wird beim Laden geleert", geladen.letzteWall === null);
  const r = runde(geladen, wall + 5 * H, play + 5 * H);
  pruefe("erste Runde nach dem Laden zaehlt nicht", !r.gezaehlt);
  pruefe("Motorzeit dabei unveraendert", nah(motorStunden(geladen), 1, 0.01));

  // Alter Zustand ohne die neuen Felder - die Wanderung muss ihn auffuellen.
  const alt = laden(JSON.stringify({ motorTimeMs: 7200000 }), TAKT);
  pruefe("alter Zustand wandert", nah(motorStunden(alt), 2, 0.001),
    "erhalten " + motorStunden(alt).toFixed(3));
  pruefe("fehlende Felder werden ergaenzt", alt.verworfeneRunden === 0 && alt.version === 1);
  const kaputt = laden("{kein json", TAKT);
  pruefe("unlesbarer Zustand ergibt eine frische Uhr", motorStunden(kaputt) === 0);
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
