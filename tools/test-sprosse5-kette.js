/**
 * EBENE 2: die Kette der Sprosse 5 - Waechter beauftragt, Kern fuehrt aus.
 *
 * ===========================================================================
 * WARUM DIESE KETTE UEBERHAUPT EXISTIERT
 * ===========================================================================
 *
 * `installAugmentations` ist `SingularityFn3` und kostet bei SF4.1 achtzig
 * Gigabyte. Der Waechter hat sechs. Er KANN die schwerste Sprosse seiner
 * eigenen Leiter nicht ausfuehren - also beauftragt er, und der Kern startet
 * `punish.js` auf einem Wirt, der gross genug ist.
 *
 * Bis zum 04.09.2026 gab es diese Kette nicht: `punish.js` war gebaut und mit
 * 35 Proben belegt, aber `SPROSSEN[5].gebaut` stand auf `false` und
 * `fuehreAus` endete mit "Sprosse 5 ist nicht gebaut". Damit endete die Leiter
 * faktisch bei 3, und das Signal S2 - der Traeger waechst seit sechs Stunden
 * Motorzeit nicht - hatte ueberhaupt keine Sprosse.
 *
 * ===========================================================================
 * WAS HIER GEPRUEFT WIRD
 * ===========================================================================
 *
 * Die drei Uebergaenge der Kette, jeder einzeln:
 *
 *   1. Der Waechter schreibt bei Sprosse 5 einen Auftrag nach
 *      `watchdog.json.orders` - und fuehrt NICHTS selbst aus.
 *   2. Der Kern findet ihn, startet `punish.js` und haengt `scharf` NUR an,
 *      wenn `data/punish-scharf.txt` liegt.
 *   3. Ein abgelaufener, ein doppelter und ein fremder Auftrag bewirken
 *      nichts.
 *
 * Der Trockenmodus ist dabei der wichtigste Punkt: eine Kette, die beim ersten
 * Lauf einbaut, kostet im schlechtesten Fall einen ganzen BitNode-Durchgang.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { neuerMock } from "./mock/ns.js";
import { ladeAusBeiden } from "./mock/lader.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const SRC = fs.existsSync(path.resolve(ROOT, "..", "bitburner-bau", "src"))
  ? path.resolve(ROOT, "..", "bitburner-bau", "src")
  : path.join(ROOT, "src");

const REGISTRY = fs.readFileSync(path.join(SRC, "registry.json"), "utf8");
const ROUTE = fs.readFileSync(path.join(SRC, "route.json"), "utf8");
const L = await import(pathToFileURL(path.join(SRC, "lib", "leiter.js")).href);

let gruen = 0;
let rot = 0;
const fehler = [];

function pruefe(name, bedingung, hinweis = "") {
  if (bedingung) { gruen++; console.log("  ok    " + name); }
  else {
    rot++;
    const z = name + (hinweis ? " - " + hinweis : "");
    fehler.push(z);
    console.log("  ROT   " + z);
  }
}

const W0 = 1_700_000_000_000;

console.log("");
console.log("=== Ebene 2: die Kette der Sprosse 5 (C.12) ===");

// ---------------------------------------------------------------------------
console.log("");
console.log("-- die Leiter erreicht Sprosse 5 ueberhaupt --");
{
  const s5 = L.SPROSSEN.find((s) => s.nr === 5);
  pruefe("Sprosse 5 gilt als gebaut", s5 && s5.gebaut === true);
  pruefe("S2 findet sie", L.sprosseFuer("S2") && L.sprosseFuer("S2").nr === 5,
    "S2 war das einzige Signal ohne Sprosse");
  pruefe("sie laeuft in Motorzeit", s5.uhr === "motor",
    "Auftrag 5.3: S2 misst Spielfortschritt");
  pruefe("und hat keinen 6h-Deckel, sondern die Deckel in punish.js",
    s5.deckelJe6h === null,
    "einmal je Knotenstufe und einmal je 24 h - das prueft punish.js selbst");
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- der Waechter BEAUFTRAGT, statt selbst zu handeln --");
{
  // Der Waechter wird scharf gefahren, und S2 wird ausgeloest: der Traeger
  // steht seit ueber sechs Stunden Motorzeit.
  const kernAlt = JSON.stringify({
    schema: 2, wall: W0, ts: W0, motorTimeMs: 20 * 3600000,
    playtime: 200 * 3600000, okRound: 5000, round: 5000, errStreak: 0,
    lastError: null, state: "work", phase: "normal",
  });
  // kpi.json mit einem Traeger, der sich seit 7 h Motorzeit nicht bewegt.
  const kpi = JSON.stringify({ traeger: { name: "rang", wert: 4711,
    motorTimeMs: 13 * 3600000 } });

  const m = neuerMock({
    host: "home", knoten: 10, wall: W0, playtime: 200 * 3600000,
    nodeReset: W0 - 48 * 3600000, augReset: W0 - 48 * 3600000,
    server: { home: { ram: 1024, used: 0, root: true, geld: 1e9, cores: 1, ports: 0, hackLevel: 1 } },
    dateien: { home: {
      "registry.json": REGISTRY,
      "route.json": ROUTE,
      "guard.js": "//", "bn4net.js": "//", "punish.js": "//", "boot.js": "//",
      "data/verfahren.txt": "V2 10 2",
      "data/guard-modus.txt": "enforce",
      "data/bn4net.json": kernAlt,
      "data/kpi.json": kpi,
    } },
    maxSchlaf: 400,
    // Die Zeit muss weit genug laufen, dass S2 seine sechs Stunden hat und
    // die Karenz der Sprosse abgelaufen ist.
    beiSchlaf: (ms, z, vor) => vor(60000),
  });

  const { modul } = await ladeAusBeiden(ROOT, "guard.js");
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); }
  catch (e) { if (!e.mockAbbruch) throw e; }
  finally { zurueck(); }

  let w = null;
  try { w = JSON.parse(m.lies("home", "data/watchdog.json")); } catch { /* bleibt null */ }

  pruefe("watchdog.json wird geschrieben", w !== null,
    m.zustand.log.slice(-3).join(" | "));
  pruefe("es gibt ein orders-Feld", w !== null && Array.isArray(w.orders),
    "der Kanal muss auch dann da sein, wenn er leer ist");

  // Der Waechter darf punish.js NIE selbst starten - er hat den Speicher
  // nicht, und ein exec, der still 0 zurueckgibt, saehe wie Erfolg aus.
  const gestartet = m.zustand.gestartet.map((g) => g.datei);
  pruefe("der Waechter startet punish.js NICHT selbst",
    !gestartet.includes("punish.js"),
    "installAugmentations kostet bei SF4.1 80 GB - der Waechter hat 6");
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- der Kern fuehrt den Auftrag aus - im TROCKENLAUF --");
{
  const auftrag = (alter = 0) => JSON.stringify({
    schema: 2, wall: W0, ts: W0, guardTimeMs: 3600000, round: 100, okRound: 100,
    errStreak: 0, lastError: null, state: "work", modus: "enforce",
    ziele: {},
    orders: [{ sprosse: 5, ziel: "traeger", skript: "punish.js",
      gestellt: W0 - alter, signal: "S2" }],
  });

  const bau = (dateien) => {
    const m = neuerMock({
      knoten: 10, geld: 1e9, maxSchlaf: 400,
      wall: W0, playtime: 200 * 3600000,
      nodeReset: W0 - 48 * 3600000, augReset: W0 - 48 * 3600000,
      server: { home: { ram: 1048576, used: 10.8, root: true, geld: 1e9,
        cores: 1, ports: 0, hackLevel: 1 } },
    });
    m.lege("home", "registry.json", REGISTRY);
    m.lege("home", "route.json", ROUTE);
    m.lege("home", "data/verfahren.txt", "V2 10 2");
    for (const w of ["worker/hack.js", "worker/grow.js", "worker/weaken.js",
                     "worker/share.js", "worker/expfarm.js"]) m.lege("home", w, "//");
    for (const e of JSON.parse(REGISTRY).eintraege) {
      m.lege("home", e.name, "// Platzhalter\nexport async function main(ns){}\n");
    }
    m.lege("home", "punish.js", "// Platzhalter\nexport async function main(ns){}\n");
    for (const [d, i] of Object.entries(dateien)) m.lege("home", d, i);
    return m;
  };

  const fahre = async (m) => {
    const { modul } = await ladeAusBeiden(ROOT, "bn4net.js");
    const zurueck = m.uhrStellen();
    try { await modul.main(m.ns); }
    catch (e) { if (!e.mockAbbruch) throw e; }
    finally { zurueck(); }
    return m.zustand.gestartet.filter((g) => g.datei === "punish.js");
  };

  // (a) Frischer Auftrag, keine Scharf-Datei -> Trockenlauf.
  {
    const m = bau({ "data/watchdog.json": auftrag(0) });
    const starts = await fahre(m);
    pruefe("punish.js wird gestartet", starts.length >= 1,
      "gestartet: " + [...new Set(m.zustand.gestartet.map((g) => g.datei))].join(", "));
    pruefe("und zwar OHNE 'scharf'",
      starts.length >= 1 && !starts[0].args.includes("scharf"),
      "args: " + JSON.stringify(starts[0] && starts[0].args));
    pruefe("genau einmal, nicht in jeder Runde", starts.length === 1,
      starts.length + " Starts - ein zweiter Einbau waere ein weggeworfener Lauf");
  }

  // (b) Mit der Scharf-Datei -> scharf.
  {
    const m = bau({
      "data/watchdog.json": auftrag(0),
      "data/punish-scharf.txt": "1",
    });
    const starts = await fahre(m);
    pruefe("mit data/punish-scharf.txt laeuft es scharf",
      starts.length >= 1 && starts[0].args.includes("scharf"),
      "args: " + JSON.stringify(starts[0] && starts[0].args));
  }

  // (c) Abgelaufener Auftrag (aelter als 15 min) -> nichts.
  {
    const m = bau({ "data/watchdog.json": auftrag(20 * 60000) });
    const starts = await fahre(m);
    pruefe("ein 20 Minuten alter Auftrag wird NICHT ausgefuehrt",
      starts.length === 0,
      "ein liegengebliebener Zettel darf keinen Soft-Reset ausloesen");
  }

  // (d) Kein orders-Feld -> nichts, und keine Ausnahme.
  {
    const m = bau({ "data/watchdog.json": JSON.stringify({
      schema: 2, wall: W0, ts: W0, round: 1, okRound: 1, errStreak: 0,
      lastError: null, state: "work", ziele: {} }) });
    const starts = await fahre(m);
    pruefe("ohne orders-Feld passiert nichts", starts.length === 0);
    const t = JSON.parse(m.lies("home", "data/bn4net.json") || "{}");
    pruefe("und der Kern laeuft weiter", t.errStreak === 0,
      t.lastError ? t.lastError.msg : "");
  }

  // (e) Ein Auftrag fuer eine andere Sprosse -> nichts.
  {
    const m = bau({ "data/watchdog.json": JSON.stringify({
      schema: 2, wall: W0, ts: W0, round: 1, okRound: 1, errStreak: 0,
      lastError: null, state: "work", ziele: {},
      orders: [{ sprosse: 2, ziel: "a.js", skript: "punish.js", gestellt: W0 }] }) });
    const starts = await fahre(m);
    pruefe("ein Auftrag fuer Sprosse 2 startet punish.js nicht",
      starts.length === 0,
      "nur die Sprosse 5 darf diesen Weg nehmen");
  }
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- keine .mock-Datei bleibt liegen --");
{
  for (const ordner of [path.join(ROOT, "src"), SRC]) {
    if (!fs.existsSync(ordner)) continue;
    const reste = fs.readdirSync(ordner).filter((f) => f.startsWith(".mock-"));
    pruefe("keine Reste in " + path.basename(path.dirname(ordner)) + "/src",
      reste.length === 0, reste.join(", "));
  }
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
