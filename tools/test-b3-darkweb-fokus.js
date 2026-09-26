/**
 * Ebene 2: B3 (Audit 26.09.2026, 6#1) - darkweb.js darf bn4life nicht mehr
 * in die Quere kommen, wenn bn4life selbst schon Portprogramme kauft.
 *
 * DER BEFUND: bn4net.js startete den Oberflaechen-Nachholer darkweb.js alle
 * 5 min, sobald EIN Portprogramm fehlte - unabhaengig davon, ob bn4life.js
 * (seit SF4.3) dieselben Programme laengst per Singularity kauft. darkweb.js
 * klickt dabei "Do something else simultaneously" und wechselt die Seite,
 * was laufende Faktionsarbeit aus dem Fokus reisst (0,8x Rep-Rate). Belegt:
 * 14 von 25 BN5-Spielstaenden mit Faktionsarbeit ohne Fokus.
 *
 * DER FIX: der Nachholer startet nur noch, wenn `lifeLaeuft` falsch ist -
 * also wenn bn4life.js NICHT mit frischer Telemetrie laeuft (Kaltstart,
 * Absturz). Dieser Test faehrt den echten Kern (dieselbe Datei, die das
 * Spiel ausfuehrt, ueber tools/mock/lader.js) einmal mit lebendigem
 * bn4life-Lebenszeichen und einmal ohne - bei fehlenden Portprogrammen in
 * beiden Faellen.
 *
 * Aufruf: node tools/test-b3-darkweb-fokus.js
 *
 * NACHTRAG Skeptiker B, Einwand 8 (26.09.2026): ein bn4life-Prozess, den der
 * Kern zum ersten Mal sieht, gilt 2 min lang als "kauft selbst", auch wenn
 * seine Telemetrie aelter als 5 min ist (Knotenwechsel mit langem Handschlag,
 * Offline-Nacht). Haengt er laenger, greift der Notnagel wieder.
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { neuerMock } from "./mock/ns.js";
import { ladeAusBeiden } from "./mock/lader.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

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

console.log("");
console.log("=== Ebene 2: B3 - darkweb.js nur ohne lebendiges bn4life ===");

/**
 * Grundzustand: home + zwei Netzrechner, alle Portprogramme fehlen. Wenn
 * `bn4lifeLebt` gesetzt ist, liegt eine frische bn4life-Telemetrie vor UND
 * ein bn4life.js-Prozess laeuft - genau das Signal, das `lifeLaeuft` prueft.
 */
function grundzustand(bn4lifeLebt) {
  const wall = 1_700_000_000_000;
  const dateien = {
    home: {
      "bn4net.js": "// Platzhalter",
      "darkweb.js": "// Platzhalter - der Test prueft nur, OB es gestartet wird",
      "worker/hack.js": "//", "worker/grow.js": "//", "worker/weaken.js": "//",
      "worker/share.js": "//",
      "data/verfahren.txt": "V1 5 2",
    },
  };
  if (bn4lifeLebt) {
    // Frisch heisst: juenger als 300000 ms - der Mock startet bei `wall`,
    // also reicht ein Zeitstempel gleich der Startzeit.
    dateien.home["data/bn4life.json"] = JSON.stringify({ zeit: wall });
  }
  const server = {
    // geld: 0 auf home -> moneyMax 0 -> kein Hack-Ziel. Mit einem Geldziel im
    // Netz fluten grow/weaken schon VOR der Nachholer-Sektion (Zeilenlage
    // "2b1" liegt weit hinter der offenen Mischung) fast den ganzen
    // Speicher - dann waere ein "darkweb.js findet keinen Platz" nicht vom
    // Fix zu unterscheiden. Das Spielerkonto (`geld` oben) bleibt getrennt
    // davon, das steuert nur `ns.getServerMoneyAvailable("home")`.
    home: { ram: 64, used: 0, root: true, geld: 0, cores: 1, ports: 0, hackLevel: 1 },
  };
  return { host: "home", wall, knoten: 5, nodeReset: 1000, geld: 1e9, server, dateien };
}

async function fahre(bn4lifeLebt, prozesseVorher = []) {
  const m = neuerMock({ ...grundzustand(bn4lifeLebt), maxSchlaf: 3 });
  // Einen laufenden bn4life.js-Prozess vortaeuschen, wenn verlangt - `ps()`
  // im Mock liest direkt `zustand.prozesse`.
  if (bn4lifeLebt) {
    m.zustand.prozesse.push({
      pid: 999, filename: "bn4life.js", host: "home", threads: 1, args: [], gb: 0,
    });
  }
  const { modul } = await ladeAusBeiden(ROOT, "bn4net.js");
  const zurueck = m.uhrStellen();
  try {
    await modul.main(m.ns);
  } catch (e) {
    if (!e.mockAbbruch) throw e;
  } finally {
    zurueck();
  }
  return m;
}

console.log("");
console.log("-- bn4life laeuft NICHT (Kaltstart/Absturz) --");
{
  const m = await fahre(false);
  const gestartet = m.zustand.gestartet.some((g) => g.datei === "darkweb.js");
  pruefe("darkweb.js wird als Notnagel gestartet", gestartet,
    "gestartet: " + JSON.stringify(m.zustand.gestartet.map((g) => g.datei)));
}

console.log("");
console.log("-- bn4life LAEUFT (frische Telemetrie + Prozess) --");
{
  const m = await fahre(true);
  const gestartet = m.zustand.gestartet.some((g) => g.datei === "darkweb.js");
  pruefe("darkweb.js wird NICHT gestartet - bn4life kauft schon selbst", !gestartet,
    "gestartet: " + JSON.stringify(m.zustand.gestartet.map((g) => g.datei)));
}

// ---------------------------------------------------------------------------
// Skeptiker B, Einwand 8: Telemetrie alt, Prozess frisch.
// ---------------------------------------------------------------------------
// Nach einem Knotenwechsel mit langem Handschlag oder einer Offline-Nacht ist
// data/bn4life.json aelter als 5 min, obwohl bn4life gerade (neu) laeuft.
// Vor dem Fix startete darkweb.js dann in Runde 1 einmal und riss den Fokus.
// Ein haengender bn4life (25.08.2026) soll nach der Schonfrist (2 min) aber
// weiter als tot gelten - der Notnagel darf nicht dauerhaft verschwinden.
async function fahreAlt(runden) {
  const g = grundzustand(true);
  g.dateien.home["data/bn4life.json"] = JSON.stringify({ zeit: g.wall - 10 * 60000 });
  const m = neuerMock({ ...g, maxSchlaf: runden, beiSchlaf: (ms, z, vor) => vor(10000) });
  m.zustand.prozesse.push({ pid: 999, filename: "bn4life.js", host: "home", threads: 1, args: [], gb: 0 });
  const { modul } = await ladeAusBeiden(ROOT, "bn4net.js");
  const zurueck = m.uhrStellen();
  try {
    await modul.main(m.ns);
  } catch (e) {
    if (!e.mockAbbruch) throw e;
  } finally {
    zurueck();
  }
  return m;
}

console.log("");
console.log("-- bn4life-Prozess neu gesehen, Telemetrie 10 min alt --");
{
  const m = await fahreAlt(3);
  const starts = m.zustand.gestartet.filter((g) => g.datei === "darkweb.js");
  pruefe("darkweb.js startet in den ersten 30 s NICHT (Schonfrist 2 min)", starts.length === 0,
    starts.length + " Starts");
}
{
  const m = await fahreAlt(16);
  const starts = m.zustand.gestartet.filter((g) => g.datei === "darkweb.js");
  pruefe("haengt bn4life laenger als 2 min ohne Telemetrie, greift der Notnagel wieder",
    starts.length >= 1, starts.length + " Starts nach 160 s");
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
