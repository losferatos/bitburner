/**
 * Ebene 2: der Werkzeugstarter des Kerns raeumt auch den Erfahrungsofen
 * (Integrationspruefung 27.09.2026, Paket B gegen den Kern).
 *
 * ===========================================================================
 * WARUM
 * ===========================================================================
 *
 * Bis Paket B lief der Ofen als Einwegwelle mit `expScript` (worker/weaken.js
 * bzw. grow.js) - beide stehen in WORKER, also zaehlte der Werkzeugstarter
 * ihren Speicher als raeumbar (`arbeiterGbAuf`) und beendete sie, wenn ein
 * Werkzeug Platz brauchte (bn4net.js, Raeumung der Werkbank und beide
 * Ausweichwege). Paket B hat den Ofen auf `worker/expfarm.js` umgestellt -
 * bewusst NICHT in WORKER (Flugzaehlung der Geldziele) - und ausgang.js
 * nachgezogen (Einwand 6), die drei Raeumlisten und `arbeiterGbAuf` im Kern
 * aber nicht. Folge: haelt der Ofen die Werkbank (lange Aktion nach einem
 * Sprung, bis Level ~612-654 laut Bericht B), gilt ein fehlendes Werkzeug
 * dort als "passt nie", und nichts raeumt den Ofen weg.
 *
 * Aufruf: node tools/test-ofen-raeumung.js
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neuerMock } from "./mock/ns.js";
import { ladeAusBeiden } from "./mock/lader.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const SRC = path.join(ROOT, "src");

let gruen = 0;
let rot = 0;
const fehler = [];
function pruefe(name, bedingung, hinweis = "") {
  if (bedingung) { gruen++; console.log("  ok    " + name); }
  else {
    rot++;
    fehler.push(name + (hinweis ? " - " + hinweis : ""));
    console.log("  ROT   " + name + (hinweis ? " - " + hinweis : ""));
  }
}

const REGISTRY = fs.readFileSync(path.join(SRC, "registry.json"), "utf8");
const ROUTE = fs.readFileSync(path.join(SRC, "route.json"), "utf8");
const EXPFARM = "worker/expfarm.js";
const START = 1_700_000_000_000;

console.log("");
console.log("=== Ebene 2: Werkzeugstarter gegen einen vollen Erfahrungsofen ===");

const m = neuerMock({
  knoten: 10,
  geld: 1e9,
  wall: START,
  // 60 Runden: der Starter meldet und raeumt nicht in jeder Runde.
  maxSchlaf: 60,
  beiSchlaf: (ms, z, vor) => vor(Math.min(ms || 10000, 10000)),
  server: {
    // home voll: kein Ausweichwirt.
    home: { ram: 1048576, used: 1048576 - 1, root: true, geld: 1e9, cores: 1, ports: 0, hackLevel: 1 },
    // Die Werkbank ist voll mit Ofenfaeden - gueltige Frist (lange Aktion).
    "werk-0": { ram: 1024, used: 0, root: true, geld: 0, cores: 1, ports: 0, hackLevel: 1 },
  },
});
m.zustand.netz = { home: ["werk-0"] };
m.lege("home", "registry.json", REGISTRY);
m.lege("home", "route.json", ROUTE);
m.lege("home", "data/verfahren.txt", "V2 10 2");
for (const w of ["worker/hack.js", "worker/grow.js", "worker/weaken.js", "worker/share.js", EXPFARM]) {
  m.lege("home", w, "//");
}
for (const e of JSON.parse(REGISTRY).eintraege) {
  m.lege("home", e.name, "// Platzhalter\nexport async function main(ns){}\n");
}
// 580 Faeden x 1,75 GB = 1015 GB: 9 GB frei, zu wenig fuer jedes Werkbank-Werkzeug.
const FAEDEN = 580;
m.zustand.prozesse.push({ pid: 900001, filename: EXPFARM, host: "werk-0", threads: FAEDEN,
  args: ["n00dles", START + 200000, 0], gb: 1.75 * FAEDEN });
m.zustand.server["werk-0"].used += 1.75 * FAEDEN;
m.zustand.naechstePid = 900010;

const { modul } = await ladeAusBeiden(ROOT, "bn4net.js");
const zurueck = m.uhrStellen();
try { await modul.main(m.ns); }
catch (e) { if (!e.mockAbbruch) throw e; }
finally { zurueck(); }

const ofenTot = m.zustand.getoetet.some((g) => g.pid === 900001);
const aufWerk0 = m.zustand.gestartet.filter((g) => g.host === "werk-0" && !g.datei.startsWith("worker/"))
  .map((g) => g.datei);
pruefe("der Ofen auf der Werkbank wird fuer ein fehlendes Werkzeug geraeumt", ofenTot,
  "getoetet: " + m.zustand.getoetet.map((g) => g.filename + "@" + g.host).join(", "));
// darkweb.js (2,65 GB) passt in die 9 GB Rest auch ohne Raeumung - der
// Beleg ist ein Werkbank-Werkzeug, das nur NACH der Raeumung Platz hat.
pruefe("und danach startet dort ein Werkbank-Werkzeug (contracts.js, 17,65 GB)",
  aufWerk0.includes("contracts.js"),
  "gestartet auf werk-0: " + (aufWerk0.join(", ") || "nichts"));

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) { console.log(""); for (const f of fehler) console.log("  ROT: " + f); }
console.log("");
process.exit(rot ? 1 : 0);
