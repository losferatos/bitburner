/**
 * Ebene 0: die Registry und ihr Leser (Position C.4).
 *
 * ===========================================================================
 * DER MIGRATIONSBEWEIS
 * ===========================================================================
 *
 * Die Abnahmebedingung aus ARCHITEKTUR 9 verlangt: der Leser reproduziert fuer
 * BN10/V2 die heutige `WERKZEUGE`-Liste aus `bn4net.js`. Das ist die einzige
 * Pruefung, die den Umstieg absichert - eine Registry, die ein laufendes
 * Werkzeug vergisst, legt es beim Umstieg still, und niemand merkt es, weil
 * der Bot weiterlaeuft.
 *
 * Genau das waere am 04.09.2026 fast passiert: der Block in ARCHITEKTUR 3.3
 * war als Auszug gedacht ("zwoelf echte Eintraege") und liess NEUN heute
 * laufende Werkzeuge weg - bbtrain, sleeve, hacknet, bn4life, homegrow,
 * contracts, popups, bn4rep, bn4door. Dieser Test haette es gefunden; er ist
 * deshalb vor dem Umstieg gebaut worden, nicht danach.
 *
 * Aufruf: node tools/test-registry.js
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

function finde(rel) {
  const k = [
    path.resolve(ROOT, "..", "bitburner-bau", "src", rel),
    path.join(ROOT, "src", rel),
  ];
  const t = k.find((p) => fs.existsSync(p));
  if (!t) {
    console.log("\n  src/" + rel + " nicht gefunden.");
    process.exit(1);
  }
  return t;
}

const REG = await import(pathToFileURL(finde("lib/reg.js")).href);
const registry = JSON.parse(fs.readFileSync(finde("registry.json"), "utf8"));

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
console.log("=== Ebene 0: Registry und Leser (C.4) ===");
console.log("  " + registry.eintraege.length + " Eintraege");

console.log("");
console.log("-- der Rollen-Riegel (ARCHITEKTUR 3.2) --");
{
  const r = REG.leseRolle("V2 10 2");
  pruefe("Rolle wird gelesen", r.verfahren === "V2" && r.node === 10 && r.level === 2,
    JSON.stringify(r));

  const passt = REG.pruefeRolle(r, 10);
  pruefe("passender Knoten -> Rolle gilt", passt.gilt && passt.verfahren === "V2");

  // DER FALL, DEN DER RIEGEL ABFAENGT: boot.js loescht verfahren.txt beim
  // Neuanlauf absichtlich nicht. Nach einem Sprung steht dort einige Sekunden
  // die Rolle des ALTEN Knotens - wer da startet, startet dessen Gewerke.
  const falsch = REG.pruefeRolle(r, 4);
  pruefe("falscher Knoten -> Rolle UNBEKANNT", !falsch.gilt && falsch.verfahren === "unbekannt");
  pruefe("und der Grund nennt beide Knoten", /Knoten 10.*in 4/.test(falsch.grund), falsch.grund);

  pruefe("leere Datei -> unbekannt", !REG.pruefeRolle(REG.leseRolle(""), 10).gilt);
  pruefe("Datei ohne Knoten -> unbekannt", !REG.pruefeRolle(REG.leseRolle("V2"), 10).gilt);
}

console.log("");
console.log("-- bei unbekannter Rolle laufen NUR 'alle'-Eintraege --");
{
  const lage = { node: 10, verfahren: "unbekannt", phase: "normal", dateiDa: () => true };
  const a = REG.auswahl(registry, lage);
  const nurAlle = a.every((e) => e.verfahren === "alle");
  pruefe("keine rollengebundenen Eintraege", nurAlle,
    a.filter((e) => e.verfahren !== "alle").map((e) => e.name).join(", "));
  pruefe("aber es laeuft ueberhaupt etwas", a.length > 0, "sonst stuende der Bot still");
}

console.log("");
console.log("-- DER MIGRATIONSBEWEIS: kein laufendes Werkzeug faellt weg --");
{
  // Die heutige Liste, gelesen aus bn4net.js selbst - nicht abgeschrieben.
  const kern = fs.readFileSync(finde("bn4net.js"), "utf8");
  const i = kern.indexOf("const WERKZEUGE");
  const j = kern.indexOf("];", i);
  const block = kern.slice(i, j);
  const heute = [...block.matchAll(/\[\s*"([^"]+\.js)"/g)].map((m) => m[1]);

  pruefe("die heutige Liste ist lesbar", heute.length >= 10,
    "gefunden: " + heute.length);
  console.log("       heute in bn4net.js: " + heute.join(", "));

  const lage = { node: 10, verfahren: "V2", phase: "normal", dateiDa: () => true };
  const ausRegistry = new Set(REG.auswahl(registry, lage).map((e) => e.name));
  // Auch die Kaltstart-Eintraege gelten als "bekannt" - sie laufen nur in
  // einer anderen Phase, sind aber nicht vergessen.
  const alleNamen = new Set(registry.eintraege.map((e) => e.name));

  const vergessen = heute.filter((n) => !alleNamen.has(n));
  pruefe("KEIN heutiges Werkzeug fehlt in der Registry", vergessen.length === 0,
    vergessen.length ? "vergessen: " + vergessen.join(", ") +
      " - der Umstieg auf die Registry legt sie still" : "");

  const stillgelegt = heute.filter((n) => !ausRegistry.has(n) && alleNamen.has(n));
  if (stillgelegt.length) {
    console.log("       nur in anderer Phase/Rolle: " + stillgelegt.join(", "));
  }
  for (const n of heute) {
    const e = registry.eintraege.find((x) => x.name === n);
    if (!e) continue;
    pruefe("  " + n + " ist in BN10/V2 aktiv oder mit Grund inaktiv",
      ausRegistry.has(n) || REG.gilt(e, lage).grund.length > 0,
      "weder aktiv noch mit Grund");
  }
}

console.log("");
console.log("-- Telemetrie kommt aus derselben Quelle wie die Startliste --");
{
  const lage = { node: 10, verfahren: "V2", phase: "normal", dateiDa: () => true };
  const tab = REG.telemetrieTabelle(registry, lage);
  pruefe("die Tabelle hat Eintraege", tab.length > 0);
  const gestartet = new Set(REG.auswahl(registry, lage).map((e) => e.name));
  const ohneStart = tab.filter(([n]) => !gestartet.has(n));
  pruefe("kein Telemetrieeintrag ohne Startliste", ohneStart.length === 0,
    ohneStart.map((x) => x[0]).join(", ") + " - meldet ewig 'veraltet'");
  pruefe("jeder Eintrag nennt Datei und Frist",
    tab.every(([n, d, f]) => typeof d === "string" && Number.isFinite(f)));
}

console.log("");
console.log("-- ein nicht gebautes Gewerk ist kein Haenger (E6) --");
{
  const lage = { node: 8, verfahren: "V1", phase: "beide", dateiDa: () => true };
  const boerse = registry.eintraege.find((e) => e.name === "boerse.js");
  pruefe("boerse.js steht in der Registry", !!boerse);
  if (boerse) {
    const g = REG.gilt(boerse, lage);
    pruefe("gilt NICHT, weil noch nicht gebaut", !g.gilt);
    pruefe("und der Grund sagt genau das", /nicht gebaut/.test(g.grund), g.grund);
  }
  const z = REG.zaehlwerk(registry, lage, () => false, () => true);
  pruefe("das Zaehlwerk fuehrt es als unbuilt", z.unbuilt >= 1, JSON.stringify(z));
  pruefe("und NICHT als absent", z.absent < registry.eintraege.length);
}

console.log("");
console.log("-- Knoten- und Phasenfilter --");
{
  const hashes = registry.eintraege.find((e) => e.name === "hashes.js");
  const cdump = registry.eintraege.find((e) => e.name === "cdump.js");
  // `dateiDa: () => true` meldet AUCH die Sperrdatei als vorhanden, und cdump
  // ist dann zu Recht blockiert. Der Test muss die Sperre ausnehmen, sonst
  // prueft er die Vorbedingung statt des Phasenfilters.
  pruefe("cdump.js laeuft im Kaltstart",
    REG.gilt(cdump, { node: 10, verfahren: "V2", phase: "kaltstart",
      dateiDa: (d) => d !== "data/csolve-laeuft.txt" }).gilt);
  pruefe("cdump.js laeuft NICHT im Normalbetrieb",
    !REG.gilt(cdump, { node: 10, verfahren: "V2", phase: "normal", dateiDa: () => true }).gilt);
  if (hashes) {
    pruefe("hashes.js ist bekannt", true);
  }
  const blade = registry.eintraege.find((e) => e.name === "blade.js");
  pruefe("blade.js laeuft nicht im Kaltstart",
    !REG.gilt(blade, { node: 10, verfahren: "V2", phase: "kaltstart", dateiDa: () => true }).gilt,
    "94 GB passen nicht auf ein frisches home");
}

console.log("");
console.log("-- Vorbedingungen --");
{
  const csolve = registry.eintraege.find((e) => e.name === "csolve.js");
  const lage = (dateien) => ({
    node: 10, verfahren: "V2", phase: "kaltstart",
    dateiDa: (d) => dateien.includes(d),
  });
  pruefe("csolve wartet ohne contracts.json",
    !REG.gilt(csolve, lage(["csolve.js"])).gilt);
  pruefe("und der Grund nennt die Datei",
    /contracts\.json/.test(REG.gilt(csolve, lage(["csolve.js"])).grund));
  pruefe("mit contracts.json laeuft es",
    REG.gilt(csolve, lage(["csolve.js", "data/contracts.json"])).gilt);

  const cdump = registry.eintraege.find((e) => e.name === "cdump.js");
  pruefe("cdump laeuft nicht, solange csolve laeuft",
    !REG.gilt(cdump, lage(["cdump.js", "data/csolve-laeuft.txt"])).gilt,
    "16,85 + 24,25 GB passen nicht nebeneinander auf 32");
}

console.log("");
console.log("-- die Datei fehlt: vanished, nicht unbuilt --");
{
  const lage = { node: 10, verfahren: "V2", phase: "normal", dateiDa: () => false };
  const blade = registry.eintraege.find((e) => e.name === "blade.js");
  const g = REG.gilt(blade, lage);
  pruefe("gilt nicht", !g.gilt);
  pruefe("Grund: Datei fehlt", /liegt nicht auf home/.test(g.grund), g.grund);
  const z = REG.zaehlwerk(registry, lage, () => false, () => true);
  pruefe("das Zaehlwerk trennt vanished von unbuilt",
    z.vanished > 0 && z.unbuilt > 0, JSON.stringify(z));
}

console.log("");
console.log("-- RAM-Bedarf mit dem Singularity-Faktor --");
{
  const bn4rep = registry.eintraege.find((e) => e.name === "bn4rep.js");
  pruefe("bn4rep.js hat einen Singularity-Anteil", bn4rep && bn4rep.ramSingGb > 0);
  if (bn4rep) {
    // Die Messung: 850,75 bei SF4.1, 63,25 bei SF4.3.
    const sf1 = REG.ramBedarf(bn4rep, { node: 10, ownedSF: { 4: 1 } });
    const sf3 = REG.ramBedarf(bn4rep, { node: 10, ownedSF: { 4: 3 } });
    const inBn4 = REG.ramBedarf(bn4rep, { node: 4, ownedSF: { 4: 0 } });
    pruefe("SF4.1 ergibt 850,75", Math.abs(sf1 - 850.75) < 0.01, "erhalten " + sf1);
    pruefe("SF4.3 ergibt 63,25", Math.abs(sf3 - 63.25) < 0.01, "erhalten " + sf3);
    pruefe("in BitNode 4 gilt Faktor 1", Math.abs(inBn4 - 63.25) < 0.01, "erhalten " + inBn4);
  }
  const wakelock = registry.eintraege.find((e) => e.name === "wakelock.js");
  pruefe("wakelock.js kostet ueberall 2,25",
    Math.abs(REG.ramBedarf(wakelock, { node: 10, ownedSF: { 4: 1 } }) - 2.25) < 0.01,
    "nach dem connect-Fix vom 04.09.");
}

console.log("");
console.log("-- Sortierung nach Prioritaet --");
{
  const lage = { node: 10, verfahren: "V2", phase: "normal", dateiDa: () => true };
  const a = REG.auswahl(registry, lage);
  let sortiert = true;
  for (let i = 1; i < a.length; i++) {
    if (a[i].priority < a[i - 1].priority) sortiert = false;
  }
  pruefe("aufsteigend nach priority", sortiert,
    a.map((e) => e.name + ":" + e.priority).join(" "));
  pruefe("der Kern kommt zuerst", a[0] && a[0].name === "bn4net.js",
    a[0] ? a[0].name : "leer");
}

console.log("");
console.log("-- laden(): Ausfallverhalten --");
{
  pruefe("fehlende Datei ergibt leere Registry", REG.laden("").eintraege.length === 0);
  pruefe("und meldet den Grund", /fehlt/.test(REG.laden("").fehler || ""));
  pruefe("unlesbar ergibt leere Registry", REG.laden("{kaputt").eintraege.length === 0);
  const neuer = REG.laden(JSON.stringify({ schema: 99, eintraege: [] }));
  pruefe("neueres Schema wird gemeldet", /Schema 99/.test(neuer.fehler || ""),
    "sonst wuerde eine neuere Registry halb verstanden");
}

console.log("");
console.log("-- die Registry stimmt mit der Architektur ueberein --");
{
  // Das Werkzeug erzeugt sie; laufen beide auseinander, ist eine von Hand
  // geaendert worden - genau das, was "erzeugt, nicht abgeschrieben" verhindert.
  const { execFileSync } = await import("node:child_process");
  let ok = true;
  let aus = "";
  try {
    aus = execFileSync("node", [path.join(HIER, "registry-bauen.js"), "--pruefen"],
      { encoding: "utf8", cwd: ROOT });
  } catch (e) {
    ok = false;
    aus = (e.stdout || "") + (e.stderr || "");
  }
  pruefe("registry.json und ARCHITEKTUR.md 3.3 sind deckungsgleich", ok, aus.trim());
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
