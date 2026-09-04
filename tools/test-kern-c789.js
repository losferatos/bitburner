/**
 * Ebene 2: die neuen Kernzweige aus C.7, C.8, C.9 und C.13 am echten Code.
 *
 * ===========================================================================
 * WARUM DIESE VIER ZUSAMMEN
 * ===========================================================================
 *
 * Sie sitzen alle im selben Abschnitt des Kerns - dem Werkzeugstarter - und
 * greifen ineinander. Ein Test je Position wuerde dreimal dieselbe Runde
 * fahren und die Wechselwirkungen trotzdem nicht sehen:
 *
 *   C.7  die Platzreservierung (gegen die Prioritaetsinversion)
 *   C.8  der Bedarfsbetrieb von shop.js
 *   C.9  die Wirtsperren des Waechters
 *   C.13 shop.js in BitNode 9, wo es nie etwas zu kaufen gibt
 *
 * Und alle vier sind Regeln, die man nicht ansieht: sie zeigen sich nur
 * daran, WAS der Kern in einer Runde startet und was nicht.
 *
 * Aufruf: node tools/test-kern-c789.js
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
  if (bedingung) { gruen++; console.log("  ok    " + name); }
  else {
    rot++;
    fehler.push(name + (hinweis ? " - " + hinweis : ""));
    console.log("  ROT   " + name + (hinweis ? " - " + hinweis : ""));
  }
}

const { modul, pfad } = await ladeAusBeiden(ROOT, "bn4net.js");
console.log("");
console.log("=== Ebene 2: die Kernzweige aus C.7/C.8/C.9/C.13 ===");
console.log("    " + path.relative(ROOT, pfad).replace(/\\/g, "/"));

/**
 * Ein home mit den Dateien, die der Kern zum Anlaufen braucht.
 *
 * Die Registry kommt aus dem echten Worktree - eine nachgebaute waere genau
 * die Sorte Pruefstand, die den Prueflingsgegenstand veraendert.
 */
import fs from "node:fs";
import { SRC } from "./ram.js";
const REGISTRY = fs.readFileSync(path.join(SRC, "registry.json"), "utf8");
const ROUTE = fs.readFileSync(path.join(SRC, "route.json"), "utf8");

function bauMock(o = {}) {
  const m = neuerMock({
    knoten: o.knoten ?? 10,
    geld: o.geld ?? 1e9,
    // Der Mock bricht selbst ab, wenn genug geschlafen wurde. Der Kern ruft
    // `ns.sleep` NICHT nur am Rundenende - ein eigener Zaehler in `runden()`
    // haette die Runde mitten drin abgeschnitten, und der Herzschlag steht am
    // Ende (04.09.2026, erster Lauf dieses Tests).
    maxSchlaf: o.maxSchlaf ?? 400,
    // SPEICHER KOSTET SEIT DEM 04.09.2026 ETWAS (Skeptiker Runde 3, W5).
    //
    // Der Mock bucht `exec` jetzt gegen `used`. Damit stellt sich hier eine
    // Frage, die vorher gar nicht existierte: wieviel home hat dieser Test?
    //
    // 32 GB waeren der Kaltstart - und dort passt nach dem Kern (10,80),
    // Waechter (6,10) und Wachhalter (2,25) fast nichts mehr. Diese Datei
    // prueft aber NICHT die Knappheit, sondern die Kernzweige C.7 bis C.13:
    // ob shop.js bei fehlender Tabelle geholt wird, ob eine Wirtsperre wirkt.
    // Sie an der Speichergrenze zu fahren hiesse, jeden dieser Zweige hinter
    // einer zweiten, unbeabsichtigten Bedingung zu verstecken.
    //
    // Also 1 TB - ein home im Spaetspiel - und die Knappheit hat ihren
    // eigenen Test (tools/test-kaltstart-budget.js, Abschnitt "die
    // ALLERERSTE Kernrunde"). `used` startet bei 10,80: den Platz belegt der
    // Kern selbst, und den bucht der Mock nicht ab, weil er nicht per exec
    // gestartet wurde.
    server: {
      home: { ram: o.homeRam ?? 1048576, used: o.homeUsed ?? 10.8, root: true,
        geld: o.geld ?? 1e9, cores: 1, ports: 0, hackLevel: 1 },
      ...(o.server || {}),
    },
    ...o.mock,
  });
  m.lege("home", "registry.json", REGISTRY);
  m.lege("home", "route.json", ROUTE);
  // Das Format ist "V<n> <knoten> <lauf>" - eine JSON-Zeile liest der
  // Rollenleser NICHT, und dann gilt die Rolle als unbekannt: es starten nur
  // Eintraege mit verfahren "alle", und der halbe Test liefe ins Leere.
  m.lege("home", "data/verfahren.txt", "V2 " + (o.knoten ?? 10) + " 2");
  // Die Arbeiterskripte. Ohne sie bricht der Kern die Runde frueh ab
  // ("worker-Skript nicht lesbar, Runde uebersprungen") und kommt nie bis zum
  // Werkzeugstarter - das war beim ersten Lauf dieses Tests der Grund, warum
  // gar nichts gestartet wurde (04.09.2026).
  for (const w of ["worker/hack.js", "worker/grow.js", "worker/weaken.js",
                   "worker/share.js", "worker/expfarm.js"]) {
    m.lege("home", w, "//");
  }
  // Alle Werkzeugdateien ablegen, sonst gilt jeder Eintrag als "verschwunden"
  // und der Starter hat gar nichts zu tun.
  for (const e of JSON.parse(REGISTRY).eintraege) {
    m.lege("home", e.name, "// Platzhalter\nexport async function main(ns){}\n");
  }
  for (const [d, i] of Object.entries(o.dateien || {})) m.lege("home", d, i);
  return m;
}

/**
 * Eine Runde des Kerns fahren und zurueckgeben, was er gestartet hat.
 *
 * Der Kern taktet mit `ns.sleep` am Rundenende; nach der gewuenschten Zahl
 * wirft der Mock, und der Wurf verlaesst die Endlosschleife.
 */
async function runden(m) {
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); }
  catch (e) {
    // MOCK_ABBRUCH ist der vorgesehene Ausgang: der Mock wirft, sobald oft
    // genug geschlafen wurde. Alles andere ist ein echter Fehler und soll
    // durchschlagen.
    if (!e.mockAbbruch) throw e;
  }
  finally { zurueck(); }
  return m.zustand.gestartet.map((g) => g.datei);
}

console.log("");
console.log("-- C.8: ohne Preistabelle wird shop.js geholt --");
{
  const m = bauMock({});
  const gestartet = await runden(m);
  pruefe("shop.js wurde gestartet", gestartet.includes("shop.js"),
    "gestartet: " + [...new Set(gestartet)].join(", "));
}

console.log("");
console.log("-- C.8: mit frischer Tabelle und vollem Park bleibt shop.js weg --");
{
  // DER PARK MUSS VOLL SEIN, sonst bestellt der Kern in derselben Runde einen
  // Rechner - und ein offener Auftrag holt shop.js voellig zu Recht zurueck.
  // Beim ersten Lauf dieses Tests war genau das der Grund fuer ein rotes
  // Ergebnis, und der Kern hatte recht (04.09.2026).
  const m = bauMock({
    dateien: {
      "data/preise.json": JSON.stringify({
        ts: 1700000000000, limitAnzahl: 1, limitRam: 1048576,
        kaufbar: true,
        park: [{ host: "werk-0", ram: 1048576 }],
        preise: { 32: 1e6 },
      }),
    },
    server: {
      "werk-0": { ram: 1048576, used: 0, root: true, geld: 0, cores: 1, ports: 0, hackLevel: 1 },
    },
  });
  // Die Mock-Wanduhr steht auf demselben Wert wie der Zeitstempel - die
  // Tabelle ist also null Sekunden alt.
  const gestartet = await runden(m);
  pruefe("shop.js bleibt aus", !gestartet.includes("shop.js"),
    "gestartet: " + [...new Set(gestartet)].join(", "));
}

console.log("");
console.log("-- C.8: ein offener Kaufauftrag holt shop.js SOFORT --");
{
  // Die Gegenprobe zur Regel oben. Ohne sie waere der Bedarfsbetrieb ein
  // Deadlock: der Kern schriebe Auftraege, die niemand ausfuehrt.
  const m = bauMock({
    dateien: {
      "data/preise.json": JSON.stringify({
        ts: 1700000000000, limitAnzahl: 25, limitRam: 1048576,
        kaufbar: true, park: [], preise: { 32: 1e6, 64: 2e6 },
      }),
    },
  });
  const gestartet = await runden(m);
  pruefe("shop.js wird geholt", gestartet.includes("shop.js"),
    "gestartet: " + [...new Set(gestartet)].join(", "));
  const auftrag = m.lies("home", "data/kaufauftrag.json");
  pruefe("und ein Auftrag liegt vor", !!auftrag, String(auftrag).slice(0, 80));
}

console.log("");
console.log("-- C.13: in BitNode 9 wird shop.js kaum geholt --");
{
  // CloudServerLimit ist dort 0 (BitNode.tsx:816). Eine zehn Minuten alte
  // Tabelle mit `kaufbar: false` genuegt: in einem Knoten ohne Mietrechner
  // aendert sich diese Auskunft nie.
  const m = bauMock({
    knoten: 9,
    dateien: {
      "data/preise.json": JSON.stringify({
        ts: 1700000000000 - 600000, limitAnzahl: 0, limitRam: 0,
        kaufbar: false, park: [], preise: {},
      }),
    },
  });
  const gestartet = await runden(m);
  pruefe("shop.js bleibt aus", !gestartet.includes("shop.js"),
    "gestartet: " + [...new Set(gestartet)].join(", ")
      + " - 7 GB alle fuenf Minuten fuer dieselbe Null waeren in BN9 reine"
      + " Verschwendung");
}

console.log("");
console.log("-- C.13: eine ALTE Tabelle mit kaufbar:true holt shop.js doch --");
{
  const m = bauMock({
    dateien: {
      "data/preise.json": JSON.stringify({
        ts: 1700000000000 - 600000, limitAnzahl: 25, limitRam: 1048576,
        kaufbar: true, park: [], preise: { 32: 1e6 },
      }),
    },
  });
  const gestartet = await runden(m);
  pruefe("shop.js wird geholt", gestartet.includes("shop.js"),
    "sonst waere der Kern in einem Knoten MIT Mietrechnern blind");
}

console.log("");
console.log("-- C.9: ein gesperrter Wirt wird gemieden --");
{
  // Der Waechter hat werk-0 fuer bbtrain.js gesperrt. Auf einem Netz, in dem
  // werk-0 die Werkbank waere, muss der Kern ausweichen - oder es bleiben
  // lassen, wenn es keinen anderen Wirt gibt.
  const m = bauMock({
    server: {
      "werk-0": { ram: 256, used: 0, root: true, geld: 0, cores: 1, ports: 0, hackLevel: 1 },
    },
    dateien: {
      "data/blocked-hosts.json": JSON.stringify({
        version: 1, ts: 1700000000000,
        eintraege: [{ werkzeug: "bbtrain.js", host: "werk-0",
          seit: 1700000000000, bis: 1700000000000 + 3600000 }],
      }),
    },
  });
  m.zustand.netz = { home: ["werk-0"] };
  await runden(m);
  const bbAufWerk0 = m.zustand.gestartet.some(
    (g) => g.datei === "bbtrain.js" && g.host === "werk-0");
  pruefe("bbtrain.js landet NICHT auf dem gesperrten Wirt", !bbAufWerk0,
    "sonst liefe die Sprosse 2 der Strafleiter ins Leere - der Kern setzte das"
      + " Werkzeug in derselben Runde zurueck");
}

console.log("");
console.log("-- C.9: eine ABGELAUFENE Sperre gilt nicht mehr --");
{
  const m = bauMock({
    server: {
      "werk-0": { ram: 256, used: 0, root: true, geld: 0, cores: 1, ports: 0, hackLevel: 1 },
    },
    dateien: {
      "data/blocked-hosts.json": JSON.stringify({
        version: 1, ts: 1700000000000 - 7200000,
        eintraege: [{ werkzeug: "bbtrain.js", host: "werk-0",
          seit: 1700000000000 - 7200000, bis: 1700000000000 - 3600000 }],
      }),
    },
  });
  m.zustand.netz = { home: ["werk-0"] };
  await runden(m);
  // Der Test prueft hier nur, dass die abgelaufene Sperre den Starter nicht
  // dauerhaft blockiert - wohin bbtrain genau geht, entscheidet die
  // Werkbankwahl und ist nicht Gegenstand dieser Position.
  pruefe("der Starter laeuft weiter", m.zustand.gestartet.length > 0,
    "eine Sperre ohne Verfall waere eine Blockade, kein Schutz");
}

console.log("");
console.log("-- der Kern ueberlebt alle diese Runden --");
{
  const m = bauMock({});
  await runden(m);
  const t = JSON.parse(m.lies("home", "data/bn4net.json") || "{}");
  if (!Number.isFinite(t.wall)) {
    console.log("       Log des Kerns (letzte 12 Zeilen):");
    for (const l of m.zustand.log.slice(-12)) console.log("         " + l);
    console.log("       Schlafaufrufe: " + m.zustand.schlafZeiten.length);
  }
  pruefe("er schreibt seinen Herzschlag", Number.isFinite(t.wall), JSON.stringify(t).slice(0, 80));
  pruefe("ohne Fehlerserie", t.errStreak === 0,
    "letzter Fehler: " + JSON.stringify(t.lastError));
  pruefe("und die Kennzahlentafel entsteht",
    !!m.lies("home", "data/kpi.json"),
    "sie wird alle sechs Runden geschrieben - bei drei Runden noch nicht,"
      + " das ist in Ordnung");
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
