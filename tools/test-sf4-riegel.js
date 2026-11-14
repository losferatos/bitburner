/**
 * Ebene 0 + 2: der SF4-Riegel (K09) und der Mock-Teil von K10.
 *
 * ===========================================================================
 * WAS HIER AUF DEM SPIEL STEHT
 * ===========================================================================
 *
 * Singularity-Gewerke (Registry `singularity: true`) werfen ausserhalb von
 * BitNode 4 ohne Source-File 4: `checkSingularityAccess`
 * (`NetscriptHelpers.tsx:388-396`) prueft `canAccessBitNodeFeature(4)` =
 * `bitNodeN === 4 || activeSourceFileLvl(4) > 0` (`BitNodeUtils.ts:17-19`).
 * Lauf 2 startet in BN1.1 OHNE SF4 - dort duerfen diese Gewerke nicht starten.
 *
 * Die wichtigste Pruefung (SPEC Grenze 7): mit dem heutigen SF-Bestand (SF4
 * vorhanden, Lauf 1) startet EXAKT dieselbe Menge wie vorher. Dafuer steht
 * unten eine eingefrorene Kopie der Auswahllogik VOR K09; sie wird mit der
 * neuen ueber alle Registry-Eintraege und ein breites Lagenraster verglichen.
 *
 * Aufruf: node tools/test-sf4-riegel.js
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { neuerMock } from "./mock/ns.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const REG = await import(pathToFileURL(path.join(ROOT, "src", "lib", "reg.js")).href);
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "registry.json"), "utf8"));

let gruen = 0;
let rot = 0;
const fehler = [];
function pruefe(was, bedingung, zusatz = "") {
  if (bedingung) { gruen++; console.log("  ok    " + was); }
  else {
    rot++;
    fehler.push(was + (zusatz ? " - " + zusatz : ""));
    console.log("  ROT   " + was + (zusatz ? " - " + zusatz : ""));
  }
}

// ---------------------------------------------------------------------------
// Eingefrorene Kopie von `gilt()` aus lib/reg.js VOR K09 (Stand master 294b593).
// Nicht nachziehen: sie ist der Massstab fuer "heute".
// ---------------------------------------------------------------------------
function merkmaleAlt(lage) {
  if (lage && lage.features && typeof lage.features === "object") return lage.features;
  const o = lage && lage.ownedSF;
  let sf9 = 0;
  try {
    sf9 = (o && typeof o.get === "function") ? Number(o.get(9) || 0) : Number((o || {})[9] || 0);
  } catch { sf9 = 0; }
  const node = Number(lage && lage.node) || 0;
  const aus = !!(lage && lage.hacknetServerAus);
  return { 9: !aus && (node === 9 || sf9 > 0) };
}
function giltAlt(e, lage) {
  if (!e || !e.name) return { gilt: false, grund: "Eintrag ohne Namen" };
  if (e.unbuilt || e.ramBaseGb === null || e.ramBaseGb === undefined) {
    return { gilt: false, grund: "noch nicht gebaut" };
  }
  if (typeof lage.dateiDa === "function" && !lage.dateiDa(e.name)) {
    return { gilt: false, grund: "Datei liegt nicht auf home" };
  }
  if (Array.isArray(e.knoten)) {
    if (!e.knoten.includes(lage.node)) {
      return { gilt: false, grund: "gilt nur in Knoten " + e.knoten.join("/") };
    }
  } else if (e.knoten !== "alle" && Number(e.knoten) !== lage.node) {
    return { gilt: false, grund: "gilt nur in Knoten " + e.knoten };
  }
  if (e.verfahren !== "alle") {
    if (lage.verfahren === "unbekannt") {
      return { gilt: false, grund: "Rolle unbekannt, nur 'alle' laeuft" };
    }
    const erlaubt = Array.isArray(e.verfahren) ? e.verfahren : [e.verfahren];
    if (!erlaubt.includes(lage.verfahren)) {
      return { gilt: false, grund: "gilt nur fuer " + erlaubt.join("/") };
    }
  }
  if (e.phase !== "beide" && e.phase !== lage.phase) {
    return { gilt: false, grund: "gilt nur in Phase " + e.phase };
  }
  const p = e.precondition || {};
  if (typeof lage.dateiDa === "function") {
    if (p.requiresFile && !lage.dateiDa(p.requiresFile)) {
      return { gilt: false, grund: "wartet auf " + p.requiresFile };
    }
    if (p.forbidsFile && lage.dateiDa(p.forbidsFile)) {
      return { gilt: false, grund: "blockiert durch " + p.forbidsFile };
    }
  }
  if (p.requiresFeature) {
    const f = merkmaleAlt(lage)[p.requiresFeature];
    if (!f) return { gilt: false, grund: "Freischaltung fehlt: " + p.requiresFeature };
  }
  return { gilt: true, grund: "" };
}
function auswahlAlt(reg, lage) {
  const mit = [];
  (reg.eintraege || []).forEach((e, i) => { if (giltAlt(e, lage).gilt) mit.push({ e, i }); });
  mit.sort((a, b) => (a.e.priority - b.e.priority) || (a.i - b.i));
  return mit.map((x) => x.e);
}

const SING = registry.eintraege.filter((e) => e.singularity === true);
const NICHT_SING = registry.eintraege.filter((e) => e.singularity !== true);
const nameN = (l) => l.map((e) => e.name).join(",");

console.log("-- die Registry: Kennzeichnung und RAM-Anteil stimmen ueberein --");
{
  pruefe("es gibt Singularity-Eintraege", SING.length > 0, "gefunden " + SING.length);
  const abw = registry.eintraege.filter((e) => (e.singularity === true) !== (Number(e.ramSingGb) > 0))
    .map((e) => e.name);
  pruefe("`singularity` ist genau dann wahr, wenn ramSingGb > 0", abw.length === 0, abw.join(", "));
  pruefe("jeder Eintrag traegt das Feld ausdruecklich als Wahrheitswert",
    registry.eintraege.every((e) => typeof e.singularity === "boolean"));
}

// Raster: Knoten x Verfahren x Phase x Dateistand x Features-Variante.
const KNOTEN = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const VERF = ["V1", "V2", "V1b", "unbekannt"];
const PHASEN = ["kaltstart", "normal"];
const DATEI = {
  alle: () => true,
  ohneSperre: (d) => !/^data\//.test(d) || d === "data/gang-an.txt",
  keine: () => false,
};
function lagenRaster(extra) {
  const l = [];
  for (const node of KNOTEN) for (const verfahren of VERF) for (const phase of PHASEN)
    for (const [dn, dateiDa] of Object.entries(DATEI)) {
      l.push({ node, verfahren, phase, dateiDa, _dn: dn, ...extra(node) });
    }
  return l;
}

console.log("");
console.log("-- HEUTE: mit SF4 startet exakt dieselbe Menge wie vor K09 --");
{
  // SF4 in allen Formen, in denen Leser die Lage heute bauen.
  const formen = {
    "ownedSF-Objekt {4:1}": () => ({ ownedSF: { 1: 1, 4: 1, 5: 1, 6: 1, 10: 1 } }),
    "ownedSF-Objekt {4:3}": () => ({ ownedSF: { 4: 3, 9: 1 } }),
    "ownedSF-Map {4:2}": () => ({ ownedSF: new Map([[4, 2], [9, 1]]) }),
    "ownedSF-Map {4:3}": () => ({ ownedSF: new Map([[4, 3]]) }),
    "features von merkmaleAusReset (Kern/Waechter)": (node) => ({
      features: REG.merkmaleAusReset({ currentNode: node, ownedSF: new Map([[1, 1], [4, 3], [5, 1]]) }) }),
    "Zahl sf4": () => ({ sf4: 3 }),
  };
  let faelle = 0;
  for (const [fn, extra] of Object.entries(formen)) {
    let abw = 0;
    let erstes = "";
    for (const lage of lagenRaster(extra)) {
      for (const e of registry.eintraege) {
        faelle++;
        const a = giltAlt(e, lage), n = REG.gilt(e, lage);
        if (a.gilt !== n.gilt || a.grund !== n.grund) {
          abw++;
          if (!erstes) erstes = e.name + " node " + lage.node + " " + lage.verfahren + " " + lage.phase
            + ": alt " + JSON.stringify(a) + " neu " + JSON.stringify(n);
        }
      }
      if (nameN(auswahlAlt(registry, lage)) !== nameN(REG.auswahl(registry, lage))) {
        abw++;
        if (!erstes) erstes = "auswahl node " + lage.node;
      }
    }
    pruefe("SF4 als " + fn + ": gilt() und auswahl() unveraendert", abw === 0, abw + " Abweichungen, z. B. " + erstes);
  }
  console.log("       " + faelle + " Einzelvergleiche");

  // Dasselbe in BN4 selbst, mit und ohne SF4 (dort war und ist alles frei).
  let abw = 0;
  for (const sf of [0, 1, 3]) {
    for (const lage of lagenRaster(() => ({ ownedSF: { 4: sf } })).filter((l) => l.node === 4)) {
      if (nameN(auswahlAlt(registry, lage)) !== nameN(REG.auswahl(registry, lage))) abw++;
    }
  }
  pruefe("BitNode 4 selbst: auch ohne SF4 unveraendert (Singularity ist dort frei)", abw === 0, abw + " Abweichungen");

  // Der unbekannte Fall: eine Lage ohne jede SF-Auskunft (alte Aufrufer, Tests).
  let abw2 = 0;
  for (const lage of lagenRaster(() => ({}))) {
    if (nameN(auswahlAlt(registry, lage)) !== nameN(REG.auswahl(registry, lage))) abw2++;
  }
  pruefe("Lage OHNE SF-Auskunft: heutiger Pfad (Singularity-Gewerke bleiben in der Auswahl)", abw2 === 0,
    abw2 + " Abweichungen");
}

console.log("");
console.log("-- LAUF 2: ohne SF4 ausserhalb von BN4 starten Singularity-Gewerke nicht --");
{
  const OHNE = {
    "ownedSF leeres Objekt": () => ({ ownedSF: {} }),
    "ownedSF {4:0}": () => ({ ownedSF: { 4: 0, 9: 0 } }),
    "ownedSF leere Map": () => ({ ownedSF: new Map() }),
    "ownedSF Map mit anderen SF": () => ({ ownedSF: new Map([[1, 1], [5, 1]]) }),
    "Zahl sf4 = 0": () => ({ sf4: 0 }),
    "features aus merkmaleAusReset ohne SF4": (node) => ({
      features: REG.merkmaleAusReset({ currentNode: node, ownedSF: new Map() }) }),
  };
  for (const [fn, extra] of Object.entries(OHNE)) {
    let schlecht = 0, zuViel = 0, erstes = "";
    for (const lage of lagenRaster(extra)) {
      if (lage.node === 4) continue;
      const alt = auswahlAlt(registry, lage);
      const neu = REG.auswahl(registry, lage);
      // Erwartung: alt ohne die Singularity-Eintraege, Reihenfolge erhalten.
      const soll = alt.filter((e) => e.singularity !== true);
      if (nameN(soll) !== nameN(neu)) {
        zuViel++;
        if (!erstes) erstes = "node " + lage.node + " " + lage.verfahren + " " + lage.phase + ": soll " + nameN(soll) + " | ist " + nameN(neu);
      }
      if (neu.some((e) => e.singularity === true)) schlecht++;
    }
    pruefe("ohne SF4 (" + fn + "): kein Singularity-Gewerk, alles andere unveraendert",
      schlecht === 0 && zuViel === 0, schlecht + " Singularity-Treffer, " + zuViel + " Abweichungen; " + erstes);
  }

  // Jeder einzelne Singularity-Eintrag, der heute in BN1.1 starten wuerde.
  const lage11 = { node: 1, verfahren: "V1", phase: "kaltstart", dateiDa: () => true, ownedSF: {} };
  const beiheute = auswahlAlt(registry, lage11).filter((e) => e.singularity === true).map((e) => e.name);
  const neu11 = REG.auswahl(registry, lage11).filter((e) => e.singularity === true).map((e) => e.name);
  console.log("       BN1.1/V1/Kaltstart ohne Riegel waeren Singularity-Gewerke: " + (beiheute.join(", ") || "keine"));
  pruefe("BN1.1: in der Auswahl steht kein Singularity-Gewerk mehr", neu11.length === 0, neu11.join(", "));
  pruefe("BN1.1: der Riegel ist wirksam (ohne ihn waere mindestens eines dabei)", beiheute.length > 0,
    "sonst prueft der Test nichts");

  const hg = registry.eintraege.find((e) => e.name === "homegrow.js");
  const g = REG.gilt(hg, lage11);
  pruefe("der Grund nennt SF4", !g.gilt && /SF4|Source-File 4/i.test(g.grund), JSON.stringify(g));

  // BN4 ohne SF4 (BN4.1 in Lauf 2): frei.
  const lage4 = { node: 4, verfahren: "V1", phase: "normal", dateiDa: () => true, ownedSF: {} };
  const in4 = REG.auswahl(registry, lage4).filter((e) => e.singularity === true).length;
  const in4alt = auswahlAlt(registry, lage4).filter((e) => e.singularity === true).length;
  pruefe("BitNode 4 ohne SF4: Singularity-Gewerke gelten (BN4.1 in Lauf 2)", in4 === in4alt && in4 > 0,
    in4 + " statt " + in4alt);

  // Erste Stufe SF4 genuegt (canAccessBitNodeFeature: Stufe > 0).
  const mit1 = REG.auswahl(registry, { ...lage11, node: 1, verfahren: "V2", phase: "normal", ownedSF: { 4: 1 } });
  pruefe("SF4 Stufe 1 genuegt", mit1.some((e) => e.singularity === true));

  // Die Quelle der Wahrheit: ein ausdrueckliches features[4] schlaegt nichts, was node/SF sagt,
  // ausser dass node 4 immer frei ist.
  const hl = { node: 1, verfahren: "V1", phase: "kaltstart", dateiDa: () => true };
  const f1 = REG.gilt(hg, { ...hl, features: { 4: true } });
  const f0 = REG.gilt(hg, { ...hl, features: { 4: false } });
  pruefe("features[4] = true laesst durch, false sperrt", f1.gilt && !f0.gilt,
    JSON.stringify([f1, f0]));
}

console.log("");
console.log("-- merkmaleAusReset: Kern und Waechter bekommen SF4 mit, ohne dass sie umgebaut werden --");
{
  const a = REG.merkmaleAusReset({ currentNode: 1, ownedSF: new Map() });
  const b = REG.merkmaleAusReset({ currentNode: 4, ownedSF: new Map() });
  const c = REG.merkmaleAusReset({ currentNode: 10, ownedSF: new Map([[4, 1]]) });
  const d = REG.merkmaleAusReset({ currentNode: 10, ownedSF: new Map([[4, 3], [9, 1]]) });
  pruefe("BN1 ohne SF4 -> features[4] falsch", a[4] === false, JSON.stringify(a));
  pruefe("BN4 ohne SF4 -> features[4] wahr", b[4] === true, JSON.stringify(b));
  pruefe("BN10 mit SF4.1 -> features[4] wahr", c[4] === true, JSON.stringify(c));
  pruefe("features[9] bleibt wie vorher", a[9] === false && b[9] === false && c[9] === false && d[9] === true);
  const ohneRi = REG.merkmaleAusReset(undefined);
  pruefe("ohne getResetInfo-Antwort: SF4 unbestimmt (nicht 'falsch') und 9 wie vorher",
    ohneRi[4] === undefined && ohneRi[9] === false, JSON.stringify(ohneRi));
  // Der Kern kennt ownedSF nur als Map aus getResetInfo - die Rechnung gleicht der des Spiels.
  const wirft = REG.merkmaleAusReset({ currentNode: 1, ownedSF: { get() { throw new Error("x"); } } });
  pruefe("ein werfendes ownedSF ergibt 'falsch', nicht einen Absturz", wirft[4] === false, JSON.stringify(wirft));
}

console.log("");
console.log("-- Zaehlwerk: ein gesperrtes Gewerk ist weder absent noch vanished noch wartet es auf RAM --");
{
  const lage = { node: 1, verfahren: "V1", phase: "normal", dateiDa: () => true, ownedSF: {} };
  const lageSf = { ...lage, ownedSF: { 4: 1 } };
  const z = REG.zaehlwerk(registry, lage, () => false);
  const zs = REG.zaehlwerk(registry, lageSf, () => false);
  const nMitSing = REG.auswahl(registry, lageSf).filter((e) => e.singularity === true).length;
  pruefe("ohne SF4 zaehlen die Singularity-Eintraege nicht als `gilt`", zs.gilt - z.gilt === nMitSing,
    "mit SF4 " + zs.gilt + ", ohne " + z.gilt + ", Singularity " + nMitSing);
  pruefe("und nicht als `absent`", zs.absent - z.absent === nMitSing);
  pruefe("und nicht als `vanished`", z.vanished === zs.vanished);
  pruefe("und treiben wartetGb nicht an", z.wartetGb < zs.wartetGb, z.wartetGb + " vs " + zs.wartetGb);
  const keinDa = REG.zaehlwerk(registry, { ...lage, dateiDa: (d) => d !== "bn4life.js" }, () => false);
  pruefe("fehlt die Datei eines gesperrten Gewerks, ist das kein `vanished`",
    keinDa.vanished === z.vanished, keinDa.vanished + " vs " + z.vanished);
}

console.log("");
console.log("-- ramBedarf bleibt unveraendert (Lauf-1-Verhalten des Kerns, wartetGb) --");
{
  const e = registry.eintraege.find((x) => x.name === "bn4rep.js");
  // Der Kern reicht keine ownedSF an ramBedarf; der Wert 16 gilt dort seit jeher.
  pruefe("ramBedarf ohne ownedSF rechnet weiter mit Faktor 16",
    Math.abs(REG.ramBedarf(e, { node: 10 }) - (e.ramBaseGb + 16 * e.ramSingGb)) < 1e-9);
  pruefe("features[4] beeinflusst ramBedarf nicht",
    REG.ramBedarf(e, { node: 10, features: { 4: true } }) === REG.ramBedarf(e, { node: 10 }));
}

console.log("");
console.log("-- Quelle der Wahrheit: NetscriptHelpers.tsx:388-396 + BitNodeUtils.ts:17-19 --");
{
  const q = "C:/Users/erche/Desktop/claude_projecto/bb-lauf2/reference/v301/src";
  let helpers = "", utils = "";
  try {
    helpers = fs.readFileSync(path.join(ROOT, "reference", "v301", "src", "Netscript", "NetscriptHelpers.tsx"), "utf8");
    utils = fs.readFileSync(path.join(ROOT, "reference", "v301", "src", "BitNode", "BitNodeUtils.ts"), "utf8");
  } catch { /* reference/ fehlt - dann ueberspringen */ }
  if (!helpers) console.log("       UEBERSPRUNGEN: reference/v301 nicht gefunden (" + q + ")");
  else {
    pruefe("checkSingularityAccess prueft canAccessBitNodeFeature(4)",
      /function checkSingularityAccess[\s\S]{0,200}canAccessBitNodeFeature\(4\)/.test(helpers));
    pruefe("canAccessBitNodeFeature = bitNodeN === n || activeSourceFileLvl(n) > 0",
      /bitNodeN === bitNode \|\| Player\.activeSourceFileLvl\(bitNode\) > 0/.test(utils));
  }
}

// ---------------------------------------------------------------------------
// Mock
// ---------------------------------------------------------------------------
console.log("");
console.log("-- Mock: SF4-Faktor kommt aus der Lage, nicht starr 16 --");
{
  const e = registry.eintraege.find((x) => x.name === "bn4life.js");   // 18 GB Singularity-Anteil
  const gb = (o) => {
    const m = neuerMock(o);
    m.lege("home", "bn4life.js", "");
    return m.ns.getScriptRam("bn4life.js", "home");
  };
  const erw = (f) => e.ramBaseGb + f * e.ramSingGb;
  const nah = (a, b) => Math.abs(a - b) < 1e-9;
  pruefe("Vorgabe (keine SF-Angabe): 16 wie bisher", nah(gb({}), erw(16)), "erhalten " + gb({}));
  pruefe("BN10 mit SF4.1: 16", nah(gb({ knoten: 10, ownedSF: new Map([[4, 1]]) }), erw(16)));
  pruefe("BN10 mit SF4.2: 4", nah(gb({ knoten: 10, ownedSF: new Map([[4, 2]]) }), erw(4)));
  pruefe("BN10 mit SF4.3: 1", nah(gb({ knoten: 10, ownedSF: new Map([[4, 3]]) }), erw(1)));
  pruefe("BN4 ohne SF4: 1", nah(gb({ knoten: 4, ownedSF: new Map() }), erw(1)));
  pruefe("BN1 ohne SF4: 16 (Preis ohne Zugriff, wie SF4Cost)", nah(gb({ knoten: 1, ownedSF: new Map() }), erw(16)));
  pruefe("ownedSF als Objekt wirkt wie die Map", nah(gb({ knoten: 10, ownedSF: { 4: 3 } }), erw(1)));
  pruefe("sf4 als Zahl wirkt", nah(gb({ knoten: 10, sf4: 2 }), erw(4)));
  // Ein Eintrag ohne Singularity-Anteil ist von der Lage unabhaengig.
  const w = registry.eintraege.find((x) => x.name === "wakelock.js");
  const m = neuerMock({ knoten: 10, ownedSF: new Map([[4, 3]]) });
  m.lege("home", "wakelock.js", "");
  pruefe("wakelock.js bleibt bei " + w.ramBaseGb + " GB", Math.abs(m.ns.getScriptRam("wakelock.js", "home") - w.ramBaseGb) < 1e-9);
  // Der Faktor folgt einer Aenderung der Lage im laufenden Test (Einbau -> neuer Knoten).
  const m2 = neuerMock({ knoten: 1, ownedSF: new Map() });
  m2.lege("home", "bn4life.js", "");
  const vorher = m2.ns.getScriptRam("bn4life.js", "home");
  m2.zustand.resetInfo.currentNode = 4;
  const nachher = m2.ns.getScriptRam("bn4life.js", "home");
  pruefe("der Faktor wird bei jedem Aufruf aus der Lage gelesen", nah(vorher, erw(16)) && nah(nachher, erw(1)),
    vorher + " -> " + nachher);
}

console.log("");
console.log("-- Mock: Throw ohne SF4 ausserhalb BN4 (NetscriptHelpers.tsx:388-396) --");
{
  const wirft = (o, fn = "getCurrentWork") => {
    const m = neuerMock(o);
    try { m.ns.singularity[fn](); return null; } catch (e) { return String(e && e.message || e); }
  };
  const w1 = wirft({ knoten: 1, ownedSF: new Map() });
  pruefe("BN1 ohne SF4: singularity.getCurrentWork wirft", w1 !== null);
  pruefe("mit der Meldung des Spiels", !!w1 && /requires Source-File 4/.test(w1), String(w1));
  pruefe("auch eine andere Funktion (stopAction)", wirft({ knoten: 1, ownedSF: new Map() }, "stopAction") !== null);
  pruefe("auch eine im Mock nicht gebaute Funktion wirft den Zugriffsfehler zuerst",
    /requires Source-File 4/.test(String(wirft({ knoten: 1, ownedSF: new Map() }, "purchaseTor"))));
  pruefe("BN4 ohne SF4: kein Wurf", wirft({ knoten: 4, ownedSF: new Map() }) === null);
  pruefe("BN10 mit SF4.1: kein Wurf", wirft({ knoten: 10, ownedSF: new Map([[4, 1]]) }) === null);
  pruefe("BN10 mit SF4 als Objekt: kein Wurf", wirft({ knoten: 10, ownedSF: { 4: 3 } }) === null);
  pruefe("BN10 ohne SF4 (ausdrueckliche SF-Liste ohne 4): wirft", wirft({ knoten: 10, ownedSF: new Map([[1, 1]]) }) !== null);
  pruefe("Vorgabe ohne jede SF-Angabe: wirft NICHT (alte Tests setzen SF4 stillschweigend voraus)",
    wirft({ knoten: 10 }) === null);
  pruefe("sf4: 0 ausdruecklich: wirft", wirft({ knoten: 10, sf4: 0 }) !== null);
  pruefe("getOwnedSourceFiles ist im Spiel nicht gesperrt (kein checkSingularityAccess)",
    !/requires Source-File 4/.test(String(wirft({ knoten: 1, ownedSF: new Map() }, "getOwnedSourceFiles"))));
  // Mitten im Test: SF4 gewonnen.
  const m = neuerMock({ knoten: 1, ownedSF: new Map() });
  let v = null; try { m.ns.singularity.getCurrentWork(); } catch (e) { v = e; }
  m.zustand.resetInfo.ownedSF = new Map([[4, 1]]);
  let n = null; try { m.ns.singularity.getCurrentWork(); } catch (e) { n = e; }
  pruefe("SF4 im laufenden Test gewonnen: vorher Wurf, nachher keiner", v !== null && n === null);
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
