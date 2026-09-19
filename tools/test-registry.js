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
    path.join(ROOT, "src", rel),
    path.resolve(ROOT, "..", "bitburner-bau", "src", rel),
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

  // `dateiDa` bildet den NORMALBETRIEB nach: die Skripte liegen, die
  // Sperrdateien nicht. Ein pauschales `() => true` meldet auch
  // data/bn4-stop.txt als vorhanden und legt damit blade.js still - das waere
  // ein Artefakt des Tests, kein Befund am Code.
  const SPERRDATEIEN = ["data/bn4-stop.txt", "data/keine-hacknet.txt",
    "data/csolve-laeuft.txt", "data/portknacker-komplett.txt"];
  const lage = { node: 10, verfahren: "V2", phase: "normal",
    dateiDa: (d) => !SPERRDATEIEN.includes(d) };
  const ausRegistry = new Set(REG.auswahl(registry, lage).map((e) => e.name));
  // Auch die Kaltstart-Eintraege gelten als "bekannt" - sie laufen nur in
  // einer anderen Phase, sind aber nicht vergessen.
  const alleNamen = new Set(registry.eintraege.map((e) => e.name));

  const vergessen = heute.filter((n) => !alleNamen.has(n));
  pruefe("KEIN heutiges Werkzeug fehlt in der Registry", vergessen.length === 0,
    vergessen.length ? "vergessen: " + vergessen.join(", ") +
      " - der Umstieg auf die Registry legt sie still" : "");

  // ZWEITE HAELFTE DES BEWEISES: was faellt beim Umstieg aus dem
  // Normalbetrieb heraus? "Steht in der Registry" genuegt nicht - ein Eintrag
  // mit phase "kaltstart" ist im Normalbetrieb genauso still wie ein
  // fehlender.
  //
  // Jede Abweichung braucht einen EINTRAG HIER. Damit ist sie eine
  // Entscheidung statt eines Versehens, und wer sie aendert, muss diese Liste
  // anfassen.
  const GEWOLLT_STILL = {
    "sleevecrime.js": "Kaltstart-Gewerk (ARCHITEKTUR 3.3, phase 'kaltstart'). Im "
      + "Normalbetrieb macht sleeve.js die Arbeit; sleevecrime verdient Geld in "
      + "der Startlage, wo es sonst keines gibt.",
    "hashes.js": "braucht Hacknet-SERVER, also BitNode 9 oder SF9 >= 1 "
      + "(ARCHITEKTUR E7). In BN10 ohne SF9 startet es heute mit und tut nichts - "
      + "die Registry ist hier STRENGER als die eingebaute Liste, und das ist "
      + "eine Verbesserung: 5,95 GB, die im Kaltstart fehlen wuerden.",
  };
  const stillgelegt = heute.filter((n) => !ausRegistry.has(n) && alleNamen.has(n));
  for (const n of stillgelegt) {
    const grund = registry.eintraege.find((e) => e.name === n);
    pruefe("  " + n + " faellt weg - und das ist eine Entscheidung",
      !!GEWOLLT_STILL[n],
      "Grund laut Registry: " + (grund ? REG.gilt(grund, lage).grund : "?") +
      " - steht das so in GEWOLLT_STILL? Wenn nicht, legt der Umstieg es"
      + " unbeabsichtigt still.");
    if (GEWOLLT_STILL[n]) console.log("       " + n + ": " + GEWOLLT_STILL[n]);
  }
  // Die Zahl der Abweichungen ist kein Guetekriterium - ihre BEGRUENDUNG ist
  // es. Zwei belegte Aenderungen sind besser als eine unbelegte.
  const unbegruendet = stillgelegt.filter((n) => !GEWOLLT_STILL[n]);
  pruefe("jede Abweichung ist begruendet", unbegruendet.length === 0,
    "ohne Eintrag in GEWOLLT_STILL: " + unbegruendet.join(", "));
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
  // DER PRUEFLING IST KUENSTLICH, NICHT REAL (04.09.2026).
  //
  // Hier stand `boerse.js` - solange es das einzige ungebaute Gewerk war,
  // ging das gut. Seit es gebaut ist (Position C.15), pruefte der Test das
  // Gegenteil dessen, was er sollte, und wurde rot. Ein Test, der an einem
  // Eintrag haengt, der sich planmaessig aendert, prueft den Zeitpunkt statt
  // der Regel.
  const lage = { node: 8, verfahren: "V1", phase: "beide", dateiDa: () => true };
  const kuenstlich = {
    name: "gibtsnochnicht.js", verfahren: "alle", knoten: "alle", phase: "beide",
    hostRule: "any", priority: 99, evictRank: 99, restartPolicy: "always",
    ramBaseGb: null,
  };
  const g = REG.gilt(kuenstlich, lage);
  pruefe("ein Eintrag ohne ramBaseGb gilt NICHT", !g.gilt);
  pruefe("und der Grund sagt genau das", /nicht gebaut/.test(g.grund), g.grund);

  const mitKuenstlich = { ...registry, eintraege: [...registry.eintraege, kuenstlich] };
  const z = REG.zaehlwerk(mitKuenstlich, lage, () => false, () => true);
  pruefe("das Zaehlwerk fuehrt ihn als unbuilt", z.unbuilt >= 1, JSON.stringify(z));
  pruefe("und NICHT als absent", z.absent < mitKuenstlich.eintraege.length);

  // Die Gegenprobe an der echten Registry: es darf KEIN Eintrag mehr ungebaut
  // sein, ohne dass jemand es merkt. Diese Zahl steht im Bericht.
  const echt = REG.zaehlwerk(registry, lage, () => false, () => true);
  console.log("       echte Registry: " + echt.unbuilt + " ungebaute Eintraege");
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
      dateiDa: (d) => d !== "data/cantwort.json" }).gilt);
  pruefe("cdump.js laeuft NICHT im Normalbetrieb",
    !REG.gilt(cdump, { node: 10, verfahren: "V2", phase: "normal", dateiDa: () => true }).gilt);
  // Hier stand `if (hashes) pruefe(..., true)` - eine Probe, die bei falsy
  // ganz entfiel und sonst nicht rot werden konnte (Skeptiker Runde 4, R28).
  // Geprueft wird jetzt die Aussage, um die es geht: hashes.js ist ein
  // Hacknet-Gewerk und darf auf einem Hacknet-Server nicht laufen.
  pruefe("hashes.js steht in der Registry", !!hashes,
    "ohne den Eintrag laeuft der Hacknet-Zweig gar nicht");
  if (hashes) {
    pruefe("und gehoert nicht auf einen Hacknet-Server",
      hashes.hostRule === "not-hacknet",
      "hostRule ist " + hashes.hostRule);
  }
  // FEATURE 9 (19.09.2026). Bis dahin lieferte der Kern kein `features`,
  // und hashes.js fiel in jedem Knoten durch - auch in BitNode 9. Die drei
  // Faelle: Feature gesetzt, Feature falsch, Feature fehlt ganz.
  if (hashes) {
    // dateiDa muss das SKRIPT bejahen (gilt() prueft, ob die Datei da ist)
    // und die Sperrdatei verneinen - sonst prueft die Probe die falsche Stelle.
    const grund = { node: 9, verfahren: "V2", phase: "normal",
      dateiDa: (d) => d !== "data/keine-hacknet.txt" };
    pruefe("hashes.js gilt mit features[9] = true",
      REG.gilt(hashes, { ...grund, features: { 9: true } }).gilt);
    pruefe("hashes.js gilt NICHT mit features[9] = false",
      !REG.gilt(hashes, { ...grund, features: { 9: false } }).gilt);
    // Ohne `features` leitet gilt() das Merkmal aus node/ownedSF ab - so
    // kann kein dritter Leser der Registry mehr still danebenliegen.
    pruefe("hashes.js gilt in Knoten 9 auch ohne features (abgeleitet)",
      REG.gilt(hashes, grund).gilt);
    pruefe("hashes.js gilt NICHT in Knoten 10 ohne SF9",
      !REG.gilt(hashes, { ...grund, node: 10 }).gilt);
    pruefe("hashes.js gilt in Knoten 10 mit SF9 (Map)",
      REG.gilt(hashes, { ...grund, node: 10, ownedSF: new Map([[9, 1]]) }).gilt);
    pruefe("hashes.js gilt in Knoten 10 mit SF9 (Objekt)",
      REG.gilt(hashes, { ...grund, node: 10, ownedSF: { 9: 1 } }).gilt);
    pruefe("und NICHT, wenn Hacknet-Server per Option abgeschaltet sind",
      !REG.gilt(hashes, { ...grund, hacknetServerAus: true }).gilt);
    pruefe("merkmaleAusReset liest bitNodeOptions.disableHacknetServer",
      REG.merkmaleAusReset({ currentNode: 9, ownedSF: new Map(),
        bitNodeOptions: { disableHacknetServer: true } })[9] === false);
    pruefe("und bleibt blockiert, solange data/keine-hacknet.txt liegt",
      !REG.gilt(hashes, { ...grund, features: { 9: true }, dateiDa: () => true }).gilt);
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
  // DIE ROTATION (Position C.8, umgebaut am 04.09.2026).
  //
  // Vorher standen hier `data/contracts.json` und `data/csolve-laeuft.txt` -
  // zwei Dateien, die KEIN Skript je schreibt. csolve.js lief damit nie, und
  // cdump.js lief immer; die ganze Kaltstart-Geldkette war eine Attrappe.
  // Gefunden hat es die neue Vorbedingungspruefung in tools/registry-bauen.js.
  //
  // Jetzt ist es eine echte Rotation ueber EINE Datei: cdump.js schreibt
  // data/cantwort.json und darf nur laufen, solange es sie nicht gibt;
  // csolve.js braucht sie und loescht sie nach dem Einreichen. So sind die
  // beiden nie zugleich auf home - zusammen waeren sie 24,85 GB.
  pruefe("csolve wartet ohne cantwort.json",
    !REG.gilt(csolve, lage(["csolve.js"])).gilt);
  pruefe("und der Grund nennt die Datei",
    /cantwort\.json/.test(REG.gilt(csolve, lage(["csolve.js"])).grund));
  pruefe("mit cantwort.json laeuft es",
    REG.gilt(csolve, lage(["csolve.js", "data/cantwort.json"])).gilt);

  const cdump = registry.eintraege.find((e) => e.name === "cdump.js");
  pruefe("cdump laeuft nicht, solange Antworten offen sind",
    !REG.gilt(cdump, lage(["cdump.js", "data/cantwort.json"])).gilt,
    "12,00 + 12,85 GB passen neben Kern, Waechter und Wachhalter nicht auf 32");
  pruefe("ohne offene Antworten laeuft cdump",
    REG.gilt(cdump, lage(["cdump.js"])).gilt);
}

console.log("");
console.log("-- die Datei fehlt: vanished, nicht unbuilt --");
{
  const lage = { node: 10, verfahren: "V2", phase: "normal", dateiDa: () => false };
  const blade = registry.eintraege.find((e) => e.name === "blade.js");
  const g = REG.gilt(blade, lage);
  pruefe("gilt nicht", !g.gilt);
  pruefe("Grund: Datei fehlt", /liegt nicht auf home/.test(g.grund), g.grund);
  // Auch hier ein KUENSTLICHER ungebauter Eintrag statt eines realen: seit
  // Position C.15 gibt es in der echten Registry keinen mehr, und der Test
  // haette den Zeitpunkt geprueft statt der Regel.
  const mit = { ...registry, eintraege: [...registry.eintraege, {
    name: "gibtsnochnicht.js", verfahren: "alle", knoten: "alle", phase: "beide",
    hostRule: "any", priority: 99, evictRank: 99, restartPolicy: "always",
    ramBaseGb: null,
  }] };
  const z = REG.zaehlwerk(mit, lage, () => false, () => true);
  pruefe("das Zaehlwerk trennt vanished von unbuilt",
    z.vanished > 0 && z.unbuilt > 0, JSON.stringify(z));
  pruefe("und beide zusammen sind alle Eintraege",
    z.vanished + z.unbuilt === mit.eintraege.length,
    JSON.stringify(z) + " bei " + mit.eintraege.length + " Eintraegen");
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
console.log("-- die Schreiberprobe selbst (R27, 04.09.2026) --");
{
  // SIE WAR BIS HEUTE UNGETESTET, und zwar aus einem strukturellen Grund:
  // sie stand mitten in `registry-bauen.js`, einem Skript, das im Hauptteil
  // schreibt. Ein Test konnte sie nicht importieren, ohne den Generator
  // laufen zu lassen. Jetzt steht sie in `tools/lib/schreiberprobe.js`.
  //
  // Die POSITIVEN Faelle sagen wenig - der Generator faehrt sie ohnehin
  // gegen 24 echte Dateien. Wichtig sind die negativen: die Probe ist das
  // einzige, was einen erfundenen Dateinamen aufhaelt, und ein erfundener
  // Name macht den Kern zum Totengraeber seines eigenen Werkzeugs.
  const { schreiberprobe } = await import(
    pathToFileURL(path.join(HIER, "lib", "schreiberprobe.js")).href);

  const F = "data/x.json";

  pruefe("Form 1: der Name steht woertlich im Aufruf",
    schreiberprobe('ns.write("data/x.json", JSON.stringify(k), "w");', F).ok);

  pruefe("Form 2: Konstante plus Aufruf mit dem Bezeichner",
    schreiberprobe('const STAND = "data/x.json";\nns.write(STAND, "a", "w");', F).form
      === "konstante");

  // ---- DIE GEFAEHRLICHE RICHTUNG: FALSCH-POSITIVE ----------------------
  //
  // Ein akzeptierter Name OHNE Schreiber ist genau der Fehler, gegen den das
  // Modul gebaut ist. Skeptikerrunde 5 hat drei davon gemessen; jeder steht
  // hier als eigene Probe.
  pruefe("eine AUSKOMMENTIERTE Schreibzeile gilt nicht",
    !schreiberprobe('// frueher: ns.write("data/x.json", d)\nlet a = 1;', F).ok,
    "gemessen als Falsch-Positiv, Skeptikerrunde 5");

  pruefe("ein Blockkommentar gilt auch nicht",
    !schreiberprobe('/* ns.write("data/x.json", d) */\nlet a = 1;', F).ok);

  pruefe("`beschreibe(...)` ist kein `schreibe(...)`",
    !schreiberprobe('beschreibe("data/x.json", 1);', F).ok,
    "der Aufrufname braucht eine Wortgrenze, sonst zaehlt jede Endung");

  pruefe("eine beschattete Konstante gilt nicht",
    !schreiberprobe('const S = "data/x.json";\nfunction f() { const S = "data/y.json";'
      + ' ns.write(S, 1); }', F).ok,
    "derselbe Bezeichner, ein anderer Wert - der Aufruf beweist nichts");

  pruefe("eine Konstante OHNE Schreibaufruf gilt nicht",
    !schreiberprobe('const STAND = "data/x.json";\nns.read(STAND);', F).ok,
    "sonst genuegte es, den Namen irgendwo hinzuschreiben");

  pruefe("ein Aufruf mit FREMDEM Bezeichner gilt nicht",
    !schreiberprobe('const STAND = "data/x.json";\nns.write(ANDERS, "a", "w");', F).ok);

  pruefe("ein anderer Dateiname gilt nicht",
    !schreiberprobe('const STAND = "data/y.json";\nns.write(STAND, "a", "w");', F).ok);

  pruefe("ein LESEN derselben Datei gilt nicht",
    !schreiberprobe('const d = ns.read("data/x.json");', F).ok);

  pruefe("leerer Quelltext gilt nicht",
    !schreiberprobe("", F).ok);

  // ---- FALSCH-NEGATIVE: ein Generator, der zu Unrecht ablehnt, wird
  //      abgeschaltet. Auch das sind gemessene Faelle.
  pruefe("`export const` gilt - das ist die uebliche Schreibweise",
    schreiberprobe('export const S = "data/x.json";\nns.write(S, 1, "w");', F).ok,
    "gemessen als Falsch-Negativ, Skeptikerrunde 5");

  pruefe("einfache Anfuehrungszeichen gelten",
    schreiberprobe("ns.write('data/x.json', 1, 'w');", F).ok);

  pruefe("ein Leerzeichen vor dem Komma aendert nichts",
    schreiberprobe('const S = "data/x.json";\nns.write(S , 1);', F).ok);

  pruefe("`let` statt `const` gilt weiterhin nicht",
    !schreiberprobe('let STAND = "data/x.json";\nns.write(STAND, "a", "w");', F).ok,
    "eine Variable, die neu zugewiesen werden kann, beweist nichts");

  // Und die beiden echten Dateien, um die es bei R27 ging.
  for (const [datei, tele] of [["cdump.js", "data/cdump-stand.json"],
                               ["contracts.js", "data/contracts.json"]]) {
    const txt = fs.readFileSync(finde(datei), "utf8");
    const r = schreiberprobe(txt, tele);
    pruefe(datei + " schreibt " + tele + " wirklich", r.ok,
      r.ok ? "Form: " + r.form + (r.bezeichner ? " (" + r.bezeichner + ")" : "") : "");
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
