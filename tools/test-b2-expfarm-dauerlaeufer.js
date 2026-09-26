/**
 * B2 (Audit 26.09.2026, 2#1) und Skeptiker B, Einwaende 1, 2, 7 - der
 * Erfahrungsofen: Dauerlaeufer mit Frist, kein Kill, Freiraum.
 *
 * DER BEFUND DES SKEPTIKERS: Der erste Dauerlaeufer wurde jede Runde von
 * bn4net getoetet. Erfahrung gibt es aber nur beim ABSCHLUSS eines Aufrufs
 * (NetscriptFunctions.ts:354-374); dauert weaken laenger als die Runde
 * (~10 s), lieferte der ganze Ofen null - nach einem Einbau die ersten ~41 s,
 * nach einem Knotenwechsel stundenlang. Der alte Test zaehlte nur Starts und
 * Kills und sah das nicht; seine Probe "kein Start auf geldziel abgelehnt"
 * pruefte den ausfuehrenden Rechner statt des Ziels.
 *
 * DIESER TEST prueft beide Seiten gegen den echten Code:
 *   A. bn4net.js im Mock (tools/mock/lader.js), sechs Runden, Wanduhr +10 s je
 *      Runde. Ofenfaeden, deren Frist abgelaufen ist, enden (so verhaelt sich
 *      worker/expfarm.js bei kurzer Aktion, siehe B). Geprueft: Frist im
 *      Argument, KEIN Kill, Geldziel jede Runde bedient, kein abgelehnter
 *      exec, Freiraum auf dem groessten Rechner.
 *   B. worker/expfarm.js selbst mit einer vorgetaeuschten Uhr: weaken dauert
 *      T, die Runde R = 10,02 s (expmodel.mjs), die Frist R - 250 ms. Die
 *      Kill-Politik des Kerns kommt aus A (toetet er, dann bei R). T aus den
 *      echten Spielstaenden (skeptiker-B.md): 0,72 s (18:04, Level 3895),
 *      41,2 s (frisch nach Einbau, Level 10), 138,1 s (nach Knotenwechsel,
 *      Level 1, Mult 1,43). Mindestens so viele Abschluesse wie die alte
 *      Einwegwelle, und der Faden endet von selbst.
 *
 * Aufruf: node tools/test-b2-expfarm-dauerlaeufer.js
 */

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
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
console.log("=== B2 - Erfahrungsofen: Frist statt Kill ===");

const EXPFARM = "worker/expfarm.js";
const RUNDE_MS = 10000;

function grundzustand() {
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
    // Eindeutig bestes Erfahrungsziel: expValue = (3+0.3*100)/((2.5+500)/150) = 9.85.
    expziel: {
      ram: 8, used: 0, root: true, geld: 1e6, geldMax: 1e6, cores: 1, ports: 0,
      hackLevel: 1, sicherheit: 100, sicherheitMin: 1, wachstum: 50,
    },
    geldziel: {
      ram: 8, used: 0, root: true, geld: 2e9, geldMax: 2e9, cores: 1, ports: 0,
      hackLevel: 1, sicherheit: 20, sicherheitMin: 20, wachstum: 50,
    },
  };
  return { host: "home", wall: 1_700_000_000_000, knoten: 5, nodeReset: 1000, geld: 1e9, server, dateien };
}

// ---------------------------------------------------------------------------
// A. Der Kern
// ---------------------------------------------------------------------------
const RUNDEN = 6;
const proRunde = [];
const m = neuerMock({
  ...grundzustand(), maxSchlaf: RUNDEN,
  skriptRam: {
    "worker/expfarm.js": 1.75, "worker/hack.js": 1.75,
    "worker/grow.js": 1.8, "worker/weaken.js": 1.8, "worker/share.js": 4,
  },
  beiSchlaf: (ms, z, vor) => {
    const home = z.server.home;
    proRunde.push({ homeFrei: home.ram - home.used, wall: z.wall });
    vor(RUNDE_MS);
    // Ofenfaeden mit abgelaufener Frist enden (kurze Aktion, siehe Teil B).
    // Ein Faden ohne Frist endet im Mock nie - genau wie ein endloser
    // Dauerlaeufer im Spiel. Eine Frist ist ein Zeitstempel (> 1e12); die
    // Fassung vor dem Fix gab an dieser Stelle die Verzoegerung 0 mit.
    for (let i = z.prozesse.length - 1; i >= 0; i--) {
      const p = z.prozesse[i];
      if (p.filename !== EXPFARM) continue;
      const frist = Number(p.args[1]);
      if (Number.isFinite(frist) && frist > 1e12 && frist <= z.wall) {
        z.server[p.host].used -= p.gb;
        z.prozesse.splice(i, 1);
      }
    }
  },
});
// Kurze Ofenaktion wie bei hohem Level (18:04: 0,72 s) - dann gilt der Freiraum.
const mockWeaken = m.ns.getWeakenTime;
m.ns.getWeakenTime = (h) => (h === "expziel" ? 720 : mockWeaken(h));
const { modul } = await ladeAusBeiden(ROOT, "bn4net.js");
const zurueck = m.uhrStellen();
try {
  await modul.main(m.ns);
} catch (e) {
  if (!e.mockAbbruch) throw e;
} finally {
  zurueck();
}

console.log("");
console.log("-- A. bn4net.js startet den Ofen mit Frist und toetet ihn nicht --");
const expfarmExecs = m.zustand.gestartet.filter((g) => g.datei === EXPFARM);
pruefe("worker/expfarm.js wird gestartet, auf expziel", expfarmExecs.length > 0
  && expfarmExecs.every((e) => e.args[0] === "expziel"),
  "Starts: " + expfarmExecs.length);
pruefe("es sind spuerbar viele Faeden (der Ueberschuss ist gross)",
  expfarmExecs.some((e) => e.threads > 1000));
const fristen = expfarmExecs.map((e) => Number(e.args[1]) - e.wall);
const ab2 = expfarmExecs.filter((e) => e.wall > expfarmExecs[0].wall).map((e) => Number(e.args[1]) - e.wall);
pruefe("jeder Start traegt eine Frist in der Zukunft (args[1])",
  fristen.length > 0 && fristen.every((d) => Number.isFinite(d) && d > 0), JSON.stringify(fristen.slice(0, 6)));
pruefe("ab Runde 2 liegt die Frist einen gemessenen Takt minus Rand voraus (9.750 ms)",
  ab2.length > 0 && ab2.every((d) => d === RUNDE_MS - 250), JSON.stringify(ab2.slice(0, 6)));
const kills = m.zustand.getoetet.filter((g) => g.filename === EXPFARM);
const killsGesamt = kills.length;
pruefe("der Kern toetet keinen Ofenfaden (Erfahrung gibt es nur beim Abschluss)", killsGesamt === 0,
  killsGesamt + " Kills");
pruefe("der Ofen wird jede Runde neu ausgelegt (die alten Faeden sind zur Frist fertig)",
  new Set(expfarmExecs.map((e) => e.wall)).size >= RUNDEN - 1,
  "Runden mit Ofenstart: " + new Set(expfarmExecs.map((e) => e.wall)).size);
// Im Mock enden Einwegarbeiter nie; das Geldziel ist nach der ersten Runde
// also an seiner Kapazitaet und braucht nichts mehr. Geprueft wird deshalb
// die Reihenfolge: das Geldziel wird bedient, BEVOR der Ofen den Rest nimmt.
const g = m.zustand.gestartet;
const ersteGeld = g.findIndex((x) => x.args[0] === "geldziel");
const ersteOfen = g.findIndex((x) => x.datei === EXPFARM);
pruefe("geldziel wird bedient, bevor der Ofen den Rest nimmt (Ziel = args[0], nicht der Wirt)",
  ersteGeld >= 0 && ersteGeld < ersteOfen, "Index Geld " + ersteGeld + ", Ofen " + ersteOfen);
pruefe("kein exec wird mangels Speicher abgelehnt", m.zustand.abgelehnt.length === 0,
  JSON.stringify(m.zustand.abgelehnt.slice(0, 3)));
pruefe("Freiraum: auf home bleiben nach der Verteilung >= 64 GB frei (Fremdstarter)",
  proRunde.length > 0 && proRunde.every((r) => r.homeFrei >= 64),
  JSON.stringify(proRunde.map((r) => Math.round(r.homeFrei))));

// ---------------------------------------------------------------------------
// A2. Die Wartungswelle auf dem Erfahrungsziel hackt es nicht leer
// ---------------------------------------------------------------------------
// Skeptiker B, Einwand 2: pickScript waehlte bei vollem Guthaben hack.js; 180
// Faeden nahmen foodnstuff 117-129 % (18:04: 0,0 % Geld), die grow-Auffuellung
// hob die Sicherheit um 37,7. Hier ein volles Erfahrungsziel knapp ueber dem
// Minimum (Sicherheit 6, min 5): der Ternaer haette hack gewaehlt.
console.log("");
console.log("-- A2. Wartungswelle auf dem Erfahrungsziel: nur weaken --");
{
  const z = grundzustand();
  z.server.expziel = { ...z.server.expziel, sicherheit: 6, sicherheitMin: 5 };
  // Geldziel mit hoeherem Level, damit expziel das Erfahrungsziel bleibt:
  // expValue 4,8/3,4 = 1,4 gegen 9/33 = 0,27.
  z.server.geldziel = { ...z.server.geldziel, hackLevel: 90 };
  const m2 = neuerMock({ ...z, maxSchlaf: 2,
    skriptRam: { "worker/expfarm.js": 1.75, "worker/hack.js": 1.75,
      "worker/grow.js": 1.8, "worker/weaken.js": 1.8, "worker/share.js": 4 },
    beiSchlaf: (ms, zz, vor) => vor(RUNDE_MS) });
  const { modul: modul2 } = await ladeAusBeiden(ROOT, "bn4net.js");
  const zur2 = m2.uhrStellen();
  try { await modul2.main(m2.ns); } catch (e) { if (!e.mockAbbruch) throw e; } finally { zur2(); }
  const t2 = JSON.parse(m2.lies("home", "data/bn4net.json") || "null");
  pruefe("expziel ist das Erfahrungsziel (sonst prueft der Fall nichts)", t2 && t2.expZiel === "expziel",
    "expZiel=" + (t2 && t2.expZiel));
  const aufExp = m2.zustand.gestartet.filter((x) => x.args[0] === "expziel" && x.datei !== EXPFARM);
  pruefe("Wartungswelle auf expziel ist ausschliesslich weaken.js",
    aufExp.length > 0 && aufExp.every((x) => x.datei === "worker/weaken.js"),
    JSON.stringify([...new Set(aufExp.map((x) => x.datei))]));
}

// ---------------------------------------------------------------------------
// B. Der Arbeiter
// ---------------------------------------------------------------------------
console.log("");
console.log("-- B. worker/expfarm.js gegen Aktionsdauer und Rundentakt --");
const worker = await import(pathToFileURL(path.join(ROOT, "src", "worker", "expfarm.js")).href);
const R = 10020;                  // gemessene Rundendauer (expmodel.mjs)
const FRIST = R - 250;            // wie bn4net: naechste Zaehlung minus Rand
const KILL_BEI = killsGesamt > 0 ? R : Infinity;   // Politik des Kerns aus Teil A

async function fahreWorker(T) {
  let jetzt = 0;
  const offen = [];
  const aufrufe = [];
  let fertig = false, fertigUm = null, getoetet = false;
  const ns = {
    args: ["expziel", FRIST, 1],
    disableLog: () => {},
    weaken: () => new Promise((res) => {
      const a = { start: jetzt, ende: jetzt + T };
      aufrufe.push(a);
      offen.push({ ...a, res });
    }),
  };
  const echt = Date.now;
  Date.now = () => jetzt;
  try {
    worker.main(ns).then(() => { fertig = true; fertigUm = jetzt; });
    for (let i = 0; i < 5000; i++) {
      await new Promise((r) => setImmediate(r));
      if (fertig || !offen.length) break;
      offen.sort((a, b) => a.ende - b.ende);
      const n = offen.shift();
      if (n.ende > KILL_BEI) { getoetet = true; break; }
      jetzt = n.ende;
      n.res(0.05);
    }
  } finally {
    Date.now = echt;
  }
  const abschluesse = aufrufe.filter((a) => a.ende <= jetzt && (!getoetet || a.ende <= KILL_BEI)).length;
  return { abschluesse, fertig, fertigUm, getoetet, aufrufe };
}

for (const [name, T] of [["18:04, Level 3895", 716], ["frisch nach Einbau, Level 10", 41200],
  ["nach Knotenwechsel, Level 1", 138100]]) {
  const r = await fahreWorker(T);
  // Die alte Einwegwelle: genau ein Aufruf je Start, ungetoetet.
  const soll = T < R ? Math.floor(FRIST / T) : 1;
  pruefe(name + " (weaken " + (T / 1000).toFixed(2) + " s): >= " + soll
    + " Abschluesse je Start (alte Einwegwelle: 1)", r.abschluesse >= soll,
    r.abschluesse + " Abschluesse" + (r.getoetet ? ", vom Kern getoetet" : ""));
  pruefe(name + ": der Faden endet von selbst", r.fertig,
    r.getoetet ? "getoetet, bevor er endete" : "laeuft nach " + r.abschluesse + " Aufrufen noch");
  const spaete = r.aufrufe.slice(1).filter((a) => a.ende > FRIST);
  pruefe(name + ": kein Folgeaufruf endet nach der Frist (Speicher frei zur Zaehlung)",
    spaete.length === 0, spaete.length + " spaete Aufrufe");
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
