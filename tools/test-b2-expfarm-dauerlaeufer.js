/**
 * Ebene 2: B2 (Audit 26.09.2026, 2#1) - der Erfahrungsofen muss als
 * Dauerlaeufer laufen und darf Geldziele dabei nicht verhungern lassen.
 *
 * DER BEFUND: Der Speicherueberschuss, der nach Geld- und Stapelzielen
 * uebrig bleibt, ging als EINE Einwegwelle (hack/grow/weaken) je 10-s-Runde
 * aufs Erfahrungsziel. Die Aktion dauert dort oft nur Sekundenbruchteile;
 * danach lag der Speicher bis zur naechsten Runde tot - gemessen 5-10 %
 * Auslastung auf der Haelfte des Netzes. `worker/expfarm.js` (ein
 * Dauerlaeufer mit `ns.grow` in einer Endlosschleife) lag fertig im Baum,
 * wurde aber nirgends gestartet.
 *
 * DER FIX: bn4net.js killt vor jeder Zuteilungsrunde ALLE laufenden
 * `worker/expfarm.js`-Prozesse (damit ihr Speicher fuer Geld- und
 * Stapelziele wieder sichtbar wird - genau das Verhungern, das der Auftrag
 * ausdruecklich ausschliesst) und baut sie am Ende der Runde
 * ("Ueberschuss"-Zweig) mit dem dann noch freien Speicher NEU auf. Ueber
 * viele Runden ist der Ofen damit fast immer belegt (nur eine kurze Luecke
 * innerhalb jeder Runde), Geldziele bekommen aber JEDE Runde zuerst, was
 * sie brauchen, bevor der Ofen den Rest bekommt.
 *
 * DIESER TEST faehrt den echten Kern (ueber tools/mock/lader.js) sechs
 * Runden mit einem klar besten Erfahrungsziel ("expziel") und einem klar
 * brauchbaren, davon UNTERSCHIEDLICHEN Geldziel ("geldziel") und prueft:
 *   1. worker/expfarm.js wird ueberhaupt gestartet, und zwar fuer expziel.
 *   2. Es wird zwischen den Runden immer wieder beendet (das RAM-Freigeben).
 *   3. geldziel bekommt ueber mehrere Runden hinweg weiter Faeden - der Ofen
 *      verdraengt es nicht.
 *
 * Aufruf: node tools/test-b2-expfarm-dauerlaeufer.js
 */

import path from "node:path";
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
console.log("=== Ebene 2: B2 - Erfahrungsofen als Dauerlaeufer ===");

function grundzustand() {
  const wall = 1_700_000_000_000;
  const dateien = {
    home: {
      "bn4net.js": "// Platzhalter",
      "worker/hack.js": "//", "worker/grow.js": "//", "worker/weaken.js": "//",
      "worker/share.js": "//", "worker/expfarm.js": "//",
      "data/verfahren.txt": "V1 5 2",
    },
  };
  const server = {
    home: { ram: 200000, used: 0, root: true, geld: 0, cores: 1, ports: 0, hackLevel: 1 },
    // Gewinnt eindeutig als Erfahrungsziel: hohe baseDifficulty (viel
    // Erfahrung je Faden), niedrige minDifficulty (kurze hackTime).
    // expValue = (3+0.3*100)/((2.5*1*1+500)/150) = 9.85.
    expziel: {
      ram: 8, used: 0, root: true, geld: 1e6, geldMax: 1e6, cores: 1, ports: 0,
      hackLevel: 1, sicherheit: 100, sicherheitMin: 1, wachstum: 50,
    },
    // Deutlich schlechteres Erfahrungsziel (expValue 2.45), aber ein
    // brauchbares, unterschiedliches Geldziel.
    geldziel: {
      ram: 8, used: 0, root: true, geld: 2e9, geldMax: 2e9, cores: 1, ports: 0,
      hackLevel: 1, sicherheit: 20, sicherheitMin: 20, wachstum: 50,
    },
  };
  return { host: "home", wall, knoten: 5, nodeReset: 1000, geld: 1e9, server, dateien };
}

async function fahre(runden) {
  const m = neuerMock({
    ...grundzustand(), maxSchlaf: runden,
    skriptRam: {
      "worker/expfarm.js": 1.75, "worker/hack.js": 1.75,
      "worker/grow.js": 1.8, "worker/weaken.js": 1.8, "worker/share.js": 4,
    },
  });
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
console.log("-- der Kern waehlt expziel als Erfahrungsziel --");
const RUNDEN = 6;
const m = await fahre(RUNDEN);
const t = JSON.parse(m.lies("home", "data/bn4net.json") || "null");
pruefe("Telemetrie da", t !== null);
pruefe("expZiel ist expziel", t && t.expZiel === "expziel", "erhalten: " + (t && t.expZiel));

console.log("");
console.log("-- worker/expfarm.js laeuft als Dauerlaeufer auf expziel --");
const expfarmExecs = m.zustand.gestartet.filter((g) => g.datei === "worker/expfarm.js");
pruefe("worker/expfarm.js wird ueberhaupt gestartet", expfarmExecs.length > 0,
  "gestartete Dateien: " + [...new Set(m.zustand.gestartet.map((g) => g.datei))].join(", "));
pruefe("jeder Start zielt auf expziel", expfarmExecs.every((e) => e.args[0] === "expziel"),
  "Ziele: " + [...new Set(expfarmExecs.map((e) => e.args[0]))].join(", "));
pruefe("es sind spuerbar viele Faeden (der Ueberschuss ist gross)",
  expfarmExecs.some((e) => e.threads > 1000),
  "groesster Start: " + Math.max(0, ...expfarmExecs.map((e) => e.threads)));

console.log("");
console.log("-- der Ofen wird zwischen den Runden beendet (RAM-Freigabe) --");
const expfarmKills = m.zustand.getoetet.filter((g) => g.filename === "worker/expfarm.js");
pruefe("worker/expfarm.js wird wiederholt beendet, nicht nur einmal am Ende",
  expfarmKills.length >= RUNDEN - 1,
  "beendet: " + expfarmKills.length + " von erwartet mindestens " + (RUNDEN - 1));

console.log("");
console.log("-- geldziel wird vom Ofen NICHT verhungert --");
const geldRuns = m.zustand.gestartet.filter((g) => g.args[0] === "geldziel");
pruefe("geldziel bekommt ueber mehrere Runden hinweg Faeden",
  geldRuns.length >= RUNDEN - 2,
  "Starts fuer geldziel: " + geldRuns.length + " (" +
    geldRuns.map((g) => g.datei).join(", ") + ")");
pruefe("kein Start auf geldziel wird abgelehnt (kein RAM-Engpass durch den Ofen)",
  !m.zustand.abgelehnt.some((a) => a.host === "geldziel"),
  JSON.stringify(m.zustand.abgelehnt.filter((a) => a.host === "geldziel")));

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
