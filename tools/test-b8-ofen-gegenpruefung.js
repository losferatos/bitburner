/**
 * Gegenpruefung Skeptiker B (26.09.2026) - Frist des Erfahrungsofens.
 *
 * Der Ofen (worker/expfarm.js) endet seit Einwand 1 von selbst an einer
 * Frist = naechste Speicherzaehlung des Kerns minus 250 ms. Zwei Luecken,
 * beide gegen den ECHTEN bn4net.js im Mock geprueft:
 *
 *   D. Die Frist folgte dem LETZTEN gemessenen Takt. Eine einzelne lange
 *      Runde (Speicherbereinigung, 1-s-Raster eines verdeckten Tabs) machte
 *      die naechste Frist laenger als die naechste Runde: der Ofen hielt
 *      seinen Speicher ueber die Zaehlung hinweg, der wurde in dieser Runde
 *      nicht neu vergeben und lag danach fast eine Runde brach. Nachgespielt
 *      (Spielstand 18:04, echter Kern, 30 min): Takt 10 s + 0-1 s Streuung
 *      -10,6 % Erfahrung, + 0-2 s -19,6 %. Jetzt der kuerzeste der letzten
 *      sechs Takte: -1,0 % / -4,9 %.
 *   E. Ofenfaeden ohne gueltige Frist: der Kern toetet den Ofen nicht mehr,
 *      also lief ein Faden ohne Frist (die Fassung vor dem Umbau, for(;;),
 *      liegt bis zum Einspielen im Spiel) fuer immer. Jetzt raeumt der Kern
 *      jeden Ofenfaden ohne Frist oder mit einer Frist weiter als 2 x 120 s
 *      voraus; Faeden mit gueltiger Frist bleiben unangetastet.
 *
 * Aufruf: node tools/test-b8-ofen-gegenpruefung.js
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
console.log("=== Gegenpruefung Skeptiker B - Frist des Erfahrungsofens ===");

const EXPFARM = "worker/expfarm.js";
const START = 1_700_000_000_000;

function grundzustand() {
  return {
    host: "home", wall: START, knoten: 5, nodeReset: 1000, geld: 1e9,
    server: {
      home: { ram: 200000, used: 0, root: true, geld: 0, cores: 1, ports: 0, hackLevel: 1 },
      expziel: { ram: 8, used: 0, root: true, geld: 1e6, geldMax: 1e6, cores: 1, ports: 0,
        hackLevel: 1, sicherheit: 100, sicherheitMin: 1, wachstum: 50 },
      geldziel: { ram: 8, used: 0, root: true, geld: 2e9, geldMax: 2e9, cores: 1, ports: 0,
        hackLevel: 1, sicherheit: 20, sicherheitMin: 20, wachstum: 50 },
    },
    dateien: {
      home: {
        "bn4net.js": "// Platzhalter",
        "worker/hack.js": "//", "worker/grow.js": "//", "worker/weaken.js": "//",
        "worker/share.js": "//", "worker/expfarm.js": "//",
        "data/verfahren.txt": "V1 5 2",
      },
    },
  };
}
const RAM = { "worker/expfarm.js": 1.75, "worker/hack.js": 1.75,
  "worker/grow.js": 1.8, "worker/weaken.js": 1.8, "worker/share.js": 4 };

async function fahre(m) {
  // Kurze Ofenaktion wie bei hohem Level (18:04: 0,72 s).
  const w = m.ns.getWeakenTime;
  m.ns.getWeakenTime = (h) => (h === "expziel" ? 720 : w(h));
  const { modul } = await ladeAusBeiden(ROOT, "bn4net.js");
  const zurueck = m.uhrStellen();
  try {
    await modul.main(m.ns);
  } catch (e) {
    if (!e.mockAbbruch) throw e;
  } finally {
    zurueck();
  }
}

// ---------------------------------------------------------------------------
// D. Frist bei ungleich langen Runden
// ---------------------------------------------------------------------------
console.log("");
console.log("-- D. Die Frist reicht nie ueber die naechste Speicherzaehlung --");
{
  // Rundenlaengen 10 s, 12 s, 10 s, 12 s ... - die Zaehlung steht im Mock
  // am Rundenanfang (Date.now bleibt waehrend der Runde stehen).
  const LAENGEN = [10000, 12000, 10000, 12000, 10000, 12000, 10000, 12000, 10000];
  let n = 0;
  const zaehlungen = [];
  const m = neuerMock({
    ...grundzustand(), maxSchlaf: LAENGEN.length, skriptRam: RAM,
    beiSchlaf: (ms, z, vor) => {
      zaehlungen.push(z.wall);
      vor(LAENGEN[n++ % LAENGEN.length]);
      // Ofenfaeden mit abgelaufener Frist enden (kurze Aktion).
      for (let i = z.prozesse.length - 1; i >= 0; i--) {
        const p = z.prozesse[i];
        if (p.filename !== EXPFARM) continue;
        const frist = Number(p.args[1]);
        if (Number.isFinite(frist) && frist <= z.wall) {
          z.server[p.host].used -= p.gb;
          z.prozesse.splice(i, 1);
        }
      }
    },
  });
  await fahre(m);
  const starts = m.zustand.gestartet.filter((g) => g.datei === EXPFARM);
  // Je Start: Frist gegen die NAECHSTE Zaehlung (= Wanduhr der Folgerunde).
  const ueber = [];
  for (const s of starts) {
    const i = zaehlungen.indexOf(s.wall);
    if (i < 0 || i + 1 >= zaehlungen.length) continue;
    const naechste = zaehlungen[i + 1];
    if (Number(s.args[1]) > naechste - 250) ueber.push((Number(s.args[1]) - naechste) + " ms");
  }
  pruefe("es gibt Ofenstarts in mehreren Runden (sonst prueft der Fall nichts)",
    new Set(starts.map((s) => s.wall)).size >= 5, new Set(starts.map((s) => s.wall)).size + " Runden");
  pruefe("keine Frist endet nach der naechsten Zaehlung minus Rand", ueber.length === 0,
    ueber.length + " Starts zu spaet: " + ueber.slice(0, 4).join(", "));
  const t = JSON.parse(m.lies("home", "data/bn4net.json") || "null");
  pruefe("gemeldeter Takt ist der kuerzeste (10.000 ms), nicht der letzte",
    t && t.mischung && t.mischung.rundenTaktMs === 10000,
    "rundenTaktMs " + (t && t.mischung && t.mischung.rundenTaktMs));
}

// ---------------------------------------------------------------------------
// E. Ofenfaeden ohne gueltige Frist
// ---------------------------------------------------------------------------
console.log("");
console.log("-- E. Ofenfaeden ohne Frist werden geraeumt, gueltige nicht --");
{
  const z0 = grundzustand();
  const m = neuerMock({ ...z0, maxSchlaf: 2, skriptRam: RAM, beiSchlaf: (ms, z, vor) => vor(10000) });
  // Drei Faeden auf home, schon vor dem Kernstart da:
  //   alt     die Fassung vor dem Umbau: args [ziel] - laeuft sonst ewig
  //   weit    Frist 1 h voraus (Uhr zurueckgestellt)
  //   gut     Frist 5 s voraus - endet von selbst, darf nicht sterben
  const lege = (pid, args, threads) => {
    m.zustand.prozesse.push({ pid, filename: EXPFARM, host: "home", threads, args, gb: 1.75 * threads });
    m.zustand.server.home.used += 1.75 * threads;
  };
  lege(900001, ["expziel"], 1000);
  lege(900002, ["expziel", START + 3600000, 0], 1000);
  lege(900003, ["expziel", START + 5000, 0], 1000);
  m.zustand.naechstePid = 900010;
  await fahre(m);
  const tot = new Set(m.zustand.getoetet.map((g) => g.pid));
  pruefe("Ofenfaden ohne Frist (Fassung vor dem Umbau) wird geraeumt", tot.has(900001));
  pruefe("Ofenfaden mit Frist 1 h voraus wird geraeumt", tot.has(900002));
  pruefe("Ofenfaden mit gueltiger Frist bleibt (er endet selbst, ein Kill verwuerfe den Aufruf)",
    !tot.has(900003));
  const neue = m.zustand.getoetet.filter((g) => g.filename === EXPFARM && g.pid >= 900010);
  pruefe("vom Kern selbst gestartete Ofenfaeden werden nicht geraeumt", neue.length === 0,
    neue.length + " geraeumt");
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
