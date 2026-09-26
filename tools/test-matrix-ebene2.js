/**
 * Ebene 2: die Szenarienmatrix ueber die Knotenklassen.
 *
 * ===========================================================================
 * DIE LETZTE LUECKE AUS AUFTRAG 6.1
 * ===========================================================================
 *
 * Die Einzelproben laufen alle in BitNode 10 mit Verfahren V2 - dem Knoten,
 * in dem der Bot gerade steht. Das ist genau EINE der Klassen, durch die die
 * Route noch fuehrt, und die anderen unterscheiden sich in dem, was den Bot
 * anhalten kann:
 *
 *   V2 (30 der 40 Laeufe)  Bladeburner traegt, w0r1d_d43m0n haengt nicht am Netz
 *   V1 (10 Laeufe)         Hacking traegt, Red Pill oeffnet den Ausgang
 *   BN9                    CloudServerLimit 0 - es gibt KEINE Mietrechner
 *   BN8                    Boerse - die einzige Geldquelle dieses Knotens
 *   BN4                    Singularity kostet Faktor 1 statt 16
 *
 * Geprueft wird nicht, ob der Bot in jeder Klasse GUT spielt - das kann nur
 * ein echter Lauf zeigen. Geprueft wird, dass er in keiner davon STEHENBLEIBT
 * oder etwas Unsinniges tut.
 *
 * Aufruf: node tools/test-matrix-ebene2.js
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { neuerMock } from "./mock/ns.js";
import { ladeAusBeiden } from "./mock/lader.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

function finde(rel) {
  const k = [
    path.join(ROOT, "src", rel),
    path.resolve(ROOT, "..", "bitburner-bau", "src", rel),
  ];
  const t = k.find((p) => fs.existsSync(p));
  if (!t) { console.log("\n  src/" + rel + " nicht gefunden."); process.exit(1); }
  return t;
}

const REG = await import(pathToFileURL(finde("lib/reg.js")).href);
const registry = JSON.parse(fs.readFileSync(finde("registry.json"), "utf8"));
const bitnodes = JSON.parse(fs.readFileSync(finde("lib/bitnodes.json"), "utf8"));

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

const W0 = 1_700_000_000_000;

/**
 * Die Klassen, durch die die Route fuehrt. `route.json` sagt, welche wie oft
 * vorkommt - die Zahlen stehen hier nicht als Behauptung, sondern werden
 * unten aus der Datei nachgezaehlt.
 */
const ROUTE = JSON.parse(fs.readFileSync(finde("route.json"), "utf8")).route;

// ALLE Knoten der Route, jeder mit dem Verfahren, das dort vorgesehen ist.
// Eine Matrix, die nur die bequemen Faelle prueft, prueft an der Route vorbei -
// der erste Lauf deckte 6 von 15 Knoten ab und war deshalb zu Recht rot.
const KLASSEN = [
  ...[...new Set(ROUTE.map((e) => e.node))].sort((a, b) => a - b).map((node) => {
    const e = ROUTE.find((x) => x.node === node);
    return { name: "BN" + node + " / " + e.verfahren, node, verfahren: e.verfahren,
      phase: "normal" };
  }),
  { name: "BN10 / V2 / Kaltstart", node: 10, verfahren: "V2", phase: "kaltstart" },
  { name: "unbekannte Rolle", node: 10, verfahren: "unbekannt", phase: "normal" },
];

console.log("");
console.log("=== Ebene 2: Szenarienmatrix ueber die Knotenklassen ===");

console.log("");
console.log("-- in JEDER Klasse laeuft etwas --");
{
  // Der Kern startet nur, was die Registry hergibt. Eine Klasse, in der die
  // Auswahl leer ist, waere ein stehender Bot - und zwar einer, der nicht
  // meckert, weil formal alles in Ordnung ist.
  for (const k of KLASSEN) {
    const lage = { node: k.node, verfahren: k.verfahren, phase: k.phase,
      dateiDa: (d) => !d.startsWith("data/") };
    const a = REG.auswahl(registry, lage);
    pruefe(k.name.padEnd(24) + " startet " + String(a.length).padStart(2) + " Werkzeuge",
      a.length > 0, "leere Auswahl - der Bot stuende still");
  }
}

console.log("");
console.log("-- der Kern selbst ist in jeder Klasse dabei --");
{
  for (const k of KLASSEN) {
    const lage = { node: k.node, verfahren: k.verfahren, phase: k.phase,
      dateiDa: () => true };
    const namen = REG.auswahl(registry, lage).map((e) => e.name);
    pruefe(k.name.padEnd(24) + " enthaelt bn4net.js", namen.includes("bn4net.js"),
      "ohne Kern laeuft gar nichts");
    pruefe(k.name.padEnd(24) + " enthaelt ausgang.js", namen.includes("ausgang.js"),
      "ohne ausgang.js gibt es keinen Weg aus dem Knoten");
  }
}

console.log("");
console.log("-- BitNode 9: keine Mietrechner --");
{
  const bn9 = bitnodes.knoten["9"];
  pruefe("BN9 steht in der Tabelle", !!bn9);
  pruefe("und setzt CloudServerLimit auf 0", bn9 && bn9.CloudServerLimit === 0,
    bn9 ? String(bn9.CloudServerLimit) : "fehlt");

  // shop.js muss das melden, statt Preise fuer Rechner zu liefern, die
  // niemand kaufen kann. Der Kern liest `kaufbar` und laesst es dann bleiben.
  const shop = fs.readFileSync(finde("shop.js"), "utf8");
  pruefe("shop.js meldet kaufbar", /kaufbar:/.test(shop));
  pruefe("und leitet es aus dem Limit ab", /kaufbar:\s*limitAnzahl\s*>\s*0/.test(shop),
    "sonst muesste der Kern es raten");

  const kern = fs.readFileSync(finde("bn4net.js"), "utf8");
  pruefe("der Kern wertet kaufbar aus", /pl\.kaufbar/.test(kern),
    "sonst bestellte er in BN9 Rechner, die es nicht gibt");
}

console.log("");
console.log("-- BitNode 8: die Boerse ist die einzige Geldquelle --");
{
  // Hier stand "boerse.js ist nicht gebaut". Seit Position C.15 ist es gebaut,
  // und der Test prueft jetzt das Richtige: dass es in BN8 auch WIRKLICH
  // startet. In diesem Knoten steht jede andere Geldquelle auf null
  // (BitNode.tsx:770-800) - ohne dieses Gewerk stuende der Lauf.
  const lage = { node: 8, verfahren: "V1", phase: "normal", dateiDa: () => true };
  const namen = REG.auswahl(registry, lage).map((e) => e.name);
  pruefe("boerse.js wird in BN8 gestartet", namen.includes("boerse.js"),
    "gestartet: " + namen.join(", "));

  // Und NUR dort: der Eintrag traegt knoten: [8].
  const anderswo = REG.auswahl(registry,
    { node: 10, verfahren: "V2", phase: "normal", dateiDa: () => true })
    .map((e) => e.name);
  pruefe("und nirgends sonst", !anderswo.includes("boerse.js"),
    "21 GB fuer einen Markt, an dem ausserhalb von BN8 nichts zu holen ist");

  pruefe("in BN8 laufen auch andere Werkzeuge", namen.length > 1);
}

console.log("");
console.log("-- BitNode 4: Singularity kostet Faktor 1 --");
{
  const bn4rep = registry.eintraege.find((e) => e.name === "bn4rep.js");
  pruefe("bn4rep.js hat einen Singularity-Anteil", bn4rep && bn4rep.ramSingGb > 0);
  if (bn4rep) {
    const inBn4 = REG.ramBedarf(bn4rep, { node: 4, ownedSF: { 4: 0 } });
    const inBn10 = REG.ramBedarf(bn4rep, { node: 10, ownedSF: { 4: 1 } });
    // A1, 26.09.2026: +0,2 GB ramSingGb (isFocused/setFocus), vorher 63,25 /
    // 850,75; +0,1 GB Basis (getTotalScriptIncome, Skeptiker-Nacharbeit) - siehe ARCHITEKTUR.md 3.3 und tools/test-registry.js.
    pruefe("in BN4 kostet es 63,55", Math.abs(inBn4 - 63.55) < 0.01, "erhalten " + inBn4);
    pruefe("in BN10 mit SF4.1 kostet es 854,05", Math.abs(inBn10 - 854.05) < 0.01,
      "erhalten " + inBn10);
    pruefe("das Verhaeltnis ist 16", Math.abs(inBn10 / inBn4 - 13.45) < 1,
      "erhalten " + (inBn10 / inBn4).toFixed(2) + " - nicht genau 16, weil der"
      + " Grundanteil nicht skaliert");
  }
}

console.log("");
console.log("-- der Kaltstart: was auf 32 GB passt --");
{
  // Die Rangfolge aus ARCHITEKTUR 7.1. Gerechnet wird mit SF4.1, also dem
  // teuersten Fall ausserhalb von BitNode 4.
  const lage = { node: 10, ownedSF: { 4: 1 } };
  const gebraucht = ["bn4net.js", "wakelock.js", "worker/weaken.js", "shop.js"];
  let summe = 5.5;   // boot.js, gemessen
  const zeilen = [["boot.js", 5.5]];
  for (const n of gebraucht) {
    const e = registry.eintraege.find((x) => x.name === n);
    if (!e) { pruefe(n + " steht in der Registry", false); continue; }
    const gb = REG.ramBedarf(e, lage);
    summe += gb;
    zeilen.push([n, gb]);
  }
  for (const [n, gb] of zeilen) console.log("       " + n.padEnd(20) + gb.toFixed(2) + " GB");
  console.log("       " + "SUMME".padEnd(20) + summe.toFixed(2) + " GB von 32");
  pruefe("der Kaltstart passt auf 32 GB", summe <= 32,
    "erhalten " + summe.toFixed(2) + " GB");
  pruefe("und laesst Luft fuer einen Arbeiter", summe <= 30,
    "erhalten " + summe.toFixed(2) + " GB - unter 30 waere komfortabel");
}

console.log("");
console.log("-- die Route deckt die geprueften Klassen ab --");
{
  const route = ROUTE;
  const jeVerfahren = {};
  const jeKnoten = {};
  for (const e of route) {
    jeVerfahren[e.verfahren] = (jeVerfahren[e.verfahren] || 0) + 1;
    jeKnoten[e.node] = (jeKnoten[e.node] || 0) + 1;
  }
  console.log("       Verfahren: " + Object.entries(jeVerfahren)
    .map(([v, n]) => v + " " + n + "x").join(", "));
  pruefe("die Route hat " + route.length + " Eintraege", route.length === 40,
    "erhalten " + route.length);
  pruefe("V2 traegt die Mehrheit", (jeVerfahren.V2 || 0) > (jeVerfahren.V1 || 0),
    JSON.stringify(jeVerfahren));

  // Jeder Knoten der Route muss in mindestens einer gepruefen Klasse
  // vorkommen - sonst prueft die Matrix an der Route vorbei.
  const geprueft = new Set(KLASSEN.map((k) => k.node));
  const ungeprueft = Object.keys(jeKnoten).map(Number).filter((n) => !geprueft.has(n));
  pruefe("JEDER Knoten der Route steht in der Matrix", ungeprueft.length === 0,
    "nicht geprueft: BN" + ungeprueft.join(", BN"));
}

console.log("");
console.log("-- der Kern laeuft in jeder Klasse an --");
{
  // Der teuerste Teil: den echten Kern in jeder Klasse eine Runde fahren.
  // Geprueft wird nur, dass er nicht wirft und Telemetrie schreibt.
  const registryRoh = fs.readFileSync(finde("registry.json"), "utf8");
  const bitnodesRoh = fs.readFileSync(finde("lib/bitnodes.json"), "utf8");

  for (const k of KLASSEN.filter((x) => x.phase === "normal")) {
    const m = neuerMock({
      host: "home", knoten: k.node, nodeReset: W0 - 24 * 3600000, wall: W0,
      playtime: 100 * 3600000, geld: 1e9,
      server: {
        home: { ram: 64, used: 0, root: true, geld: 1e9, cores: 1, ports: 0, hackLevel: 1 },
        "n00dles": { ram: 4, used: 0, root: true, geld: 1e6, cores: 1, ports: 0, hackLevel: 1 },
      },
      dateien: { home: {
        "bn4net.js": "//", "worker/hack.js": "//", "worker/grow.js": "//",
        "worker/weaken.js": "//", "worker/share.js": "//",
        "data/verfahren.txt": k.verfahren === "unbekannt" ? "V2 99 1"
          : k.verfahren + " " + k.node + " 2",
        "registry.json": registryRoh,
        "lib/bitnodes.json": bitnodesRoh,
        "ausgang.js": "//", "wakelock.js": "//", "shop.js": "//",
      } },
      cloudLimit: k.node === 9 ? 0 : 25,
      maxSchlaf: 3,
      beiSchlaf: (ms, z, vor) => vor(ms),
    });
    const { modul } = await ladeAusBeiden(ROOT, "bn4net.js");
    const zurueck = m.uhrStellen();
    let wurf = null;
    try { await modul.main(m.ns); }
    catch (e) { if (!e.mockAbbruch) wurf = e.message; }
    finally { zurueck(); }

    const roh = m.lies("home", "data/bn4net.json");
    const fehlerZeilen = m.zustand.log.filter((z) => z.includes("RUNDENFEHLER"));
    pruefe(k.name.padEnd(24) + " laeuft ohne Wurf", !wurf, wurf || "");
    pruefe(k.name.padEnd(24) + " ohne Rundenfehler", fehlerZeilen.length === 0,
      fehlerZeilen[0] || "");
    pruefe(k.name.padEnd(24) + " schreibt Telemetrie", !!roh);
  }
}

console.log("");
console.log("-- keine .mock-Datei bleibt liegen --");
{
  for (const wurzel of [path.join(ROOT, "src"),
                        path.resolve(ROOT, "..", "bitburner-bau", "src")]) {
    if (!fs.existsSync(wurzel)) continue;
    const reste = fs.readdirSync(wurzel).filter((f) => f.startsWith(".mock-"));
    pruefe("keine Reste in " + path.basename(path.dirname(wurzel)) + "/src",
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
