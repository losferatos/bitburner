/**
 * Ebene 0: der Figur-Vergabepunkt (Position C.11).
 *
 * ===========================================================================
 * WAS AUF DEM SPIEL STEHT
 * ===========================================================================
 *
 * Ein laufender Graft, den ein anderes Skript mit `stopAction()` unterbricht,
 * ist NICHT pausiert - er ist weg, samt bezahltem Geld. Bei Violet Congruity
 * sind das 14,63 Milliarden.
 *
 * Sieben Dateien greifen heute auf dieselbe Figur zu. Das dokumentierte
 * Ping-Pong: `bbtrain` ruft `stopAction()` bei Konto unter 5 Mio, `joinrun`
 * meldet "kein Kurs" und schickt sie ins Gym, `bbtrain` stoppt wieder.
 *
 * Aufruf: node tools/test-figur.js
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
  if (!t) { console.log("\n  src/" + rel + " nicht gefunden."); process.exit(1); }
  return t;
}

const F = await import(pathToFileURL(finde("lib/figur.js")).href);

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
const NR = 999;   // nodeReset

const uhren = (wall) => ({ wall, motorTimeMs: 0, nodeReset: NR });

console.log("");
console.log("=== Ebene 0: Figur-Vergabepunkt (C.11) ===");

console.log("");
console.log("-- die Rangfolge --");
{
  pruefe("Graft schlaegt Bladeburner", F.PRIO.graft < F.PRIO.bladeburner);
  pruefe("Bladeburner schlaegt Faktionsarbeit", F.PRIO.bladeburner < F.PRIO.faktion);
  pruefe("Faktionsarbeit schlaegt Gym", F.PRIO.faktion < F.PRIO.gym);
  pruefe("Gym schlaegt Verbrechen", F.PRIO.gym < F.PRIO.verbrechen);
  pruefe("der Geld-Deadlock schlaegt ALLES", F.PRIO.deadlock < F.PRIO.graft,
    "Sprosse 0 mit prio 0 - sonst muesste sie die Figur entreissen");
}

console.log("");
console.log("-- eine einfache Vergabe --");
{
  const a = [F.antrag("graft.js", F.PRIO.graft, "graft", { aug: "Violet Congruity" },
    "graftplan Position 1", uhren(W0))];
  const r = F.vergib(a, null, W0, NR);
  pruefe("der einzige Antrag gewinnt", r.vergabe && r.vergabe.owner === "graft.js");
  pruefe("die Handlung steht drin", r.vergabe.action === "graft");
  // ZWEI STUNDEN FUER EINEN GRAFT, nicht fuenfzehn Minuten (04.09.2026,
  // Skeptiker Fehlermodi). Die Graftdauer ist
  // (3600000 * log2(Summe der Multiplikatoren) + 1800000) / 2 geteilt durch
  // den Intelligenzbonus (GraftableAugmentation.ts:25-29) - das MINIMUM sind
  // 15 Minuten, gemessen wurden 17,6 bis 88. Der alte Lease lief damit bei
  // JEDEM Graft mitten drin ab.
  pruefe("die Lease fuer einen Graft laeuft zwei Stunden",
    r.vergabe.leaseBis === W0 + F.LEASE_GRAFT_MS,
    "erhalten " + (r.vergabe.leaseBis - W0) / 60000 + " min");
  pruefe("und sie ist laenger als das laengste gemessene Graft",
    F.LEASE_GRAFT_MS > 88 * 60000);

  // Fuer alles andere bleibt es bei fuenfzehn Minuten: ein toter Besitzer
  // parkt die Figur genau so lange, und Gym oder Faktionsarbeit lassen sich
  // ohne Verlust unterbrechen.
  const bb = [F.antrag("bbtrain.js", F.PRIO.gym, "gym", "str", "Kampfwerte",
    uhren(W0))];
  const rb = F.vergib(bb, null, W0, NR);
  pruefe("fuer alles andere gelten 15 Minuten",
    rb.vergabe.leaseBis === W0 + F.LEASE_MS,
    "erhalten " + (rb.vergabe.leaseBis - W0) / 60000 + " min");
  pruefe("die Folgenummer beginnt bei 1", r.vergabe.seq === 1);
  pruefe("es ist ein Wechsel", r.wechsel === true);
}

console.log("");
console.log("-- DER FALL, UM DEN ES GEHT: der Graft wird nicht unterbrochen --");
{
  const graft = F.antrag("graft.js", F.PRIO.graft, "graft", { restMs: 846000 },
    "laeuft seit 14 min", uhren(W0));
  const vergabe = F.vergib([graft], null, W0, NR).vergabe;

  // bbtrain will ins Gym - dieselbe Figur, niedrigere Prioritaet.
  const gym = F.antrag("bbtrain.js", F.PRIO.gym, "gym", null, "Kampfwerte", uhren(W0 + 1000));
  const r = F.vergib([graft, gym], vergabe, W0 + 1000, NR);
  pruefe("der Graft behaelt die Figur", r.vergabe.owner === "graft.js", r.grund);
  pruefe("kein Wechsel", r.wechsel === false);

  // Und der Zugriffstest, den bbtrain vor stopAction machen muss.
  const darf = F.darfFigur(r.vergabe, "bbtrain.js", W0 + 1000, NR);
  pruefe("bbtrain darf die Figur NICHT anfassen", !darf.darf);
  pruefe("und erfaehrt, wer sie hat", /graft\.js/.test(darf.grund), darf.grund);
  const darfGraft = F.darfFigur(r.vergabe, "graft.js", W0 + 1000, NR);
  pruefe("graft.js darf", darfGraft.darf);
}

console.log("");
console.log("-- der Geld-Deadlock bricht die Lease --");
{
  const graft = F.antrag("graft.js", F.PRIO.graft, "graft", null, "laeuft", uhren(W0));
  const vergabe = F.vergib([graft], null, W0, NR).vergabe;

  // Konto negativ: Sprosse 0 beantragt mit prio 0.
  const notfall = F.antrag("guard.js", F.PRIO.deadlock, "verbrechen", null,
    "Konto negativ", uhren(W0 + 5000));
  const r = F.vergib([graft, notfall], vergabe, W0 + 5000, NR);
  pruefe("der Notfall gewinnt", r.vergabe.owner === "guard.js", r.grund);
  pruefe("der Grund nennt die Prioritaeten", /0 vor 10/.test(r.grund), r.grund);
  pruefe("die Folgenummer waechst", r.vergabe.seq === vergabe.seq + 1);
  pruefe("es gilt als Wechsel", r.wechsel === true);
}

console.log("");
console.log("-- bei Gleichstand gewinnt der AELTERE Antrag --");
{
  // Nach Zufall oder Dateireihenfolge zu entscheiden erzeugt genau das
  // Ping-Pong, das hier aufhoeren soll: zwei Gewerke gleicher Prioritaet
  // wechselten sich sonst im Sekundentakt ab.
  const a1 = F.antrag("blade.js", F.PRIO.bladeburner, "action", null, "aelter", uhren(W0));
  const a2 = F.antrag("bbtrain.js", F.PRIO.bladeburner, "action", null, "juenger",
    uhren(W0 + 5000));
  const r1 = F.vergib([a1, a2], null, W0 + 6000, NR);
  const r2 = F.vergib([a2, a1], null, W0 + 6000, NR);
  pruefe("der aeltere gewinnt", r1.vergabe.owner === "blade.js", r1.vergabe.owner);
  pruefe("unabhaengig von der Reihenfolge der Liste",
    r2.vergabe.owner === "blade.js", r2.vergabe.owner);
}

console.log("");
console.log("-- die Lease laeuft ab, wenn niemand sie erneuert --");
{
  // Ein toter Besitzer hielte die Figur sonst bis zum naechsten Reset - und
  // "tot" ist der Normalfall, wenn ein Werkzeug weggeraeumt wurde.
  const a = F.antrag("blade.js", F.PRIO.bladeburner, "action", null, "x", uhren(W0));
  const vergabe = F.vergib([a], null, W0, NR).vergabe;
  pruefe("kurz danach gilt sie", F.vergabeGilt(vergabe, W0 + 60000, NR));
  pruefe("nach 15 Minuten nicht mehr", !F.vergabeGilt(vergabe, W0 + F.LEASE_MS + 1, NR));

  // Und dann faellt die Figur an die Rangfolge zurueck.
  const gym = F.antrag("bbtrain.js", F.PRIO.gym, "gym", null, "y",
    uhren(W0 + F.LEASE_MS + 1000));
  const r = F.vergib([gym], vergabe, W0 + F.LEASE_MS + 2000, NR);
  pruefe("der naechste bekommt sie", r.vergabe.owner === "bbtrain.js", r.grund);
}

console.log("");
console.log("-- eine auslaufende Lease wird nicht vorzeitig entzogen --");
{
  // Ein Gewerk, das gerade arbeitet und den Antrag eine Runde zu spaet
  // erneuert, verliert die Figur sonst mitten im Zug.
  const a = F.antrag("graft.js", F.PRIO.graft, "graft", null, "x", uhren(W0));
  const vergabe = F.vergib([a], null, W0, NR).vergabe;
  const r = F.vergib([], vergabe, W0 + 60000, NR);   // kein Antrag mehr
  pruefe("die Vergabe bleibt bestehen", r.vergabe && r.vergabe.owner === "graft.js",
    r.grund);
  pruefe("aber die Lease wird nicht verlaengert", r.vergabe.leaseBis === vergabe.leaseBis,
    "sie laeuft aus, statt entzogen zu werden");
}

console.log("");
console.log("-- die Folgenummer schuetzt vor veralteten Dateien --");
{
  const a = F.antrag("graft.js", F.PRIO.graft, "graft", null, "x", uhren(W0));
  const v1 = F.vergib([a], null, W0, NR).vergabe;
  const v2 = { ...v1, seq: v1.seq + 5 };

  // Das Werkzeug hat schon seq 6 gesehen und liest jetzt seq 1 - die Datei
  // stammt aus dem Rennen zwischen Werkbank und home.
  const alt = F.darfFigur(v1, "graft.js", W0 + 1000, NR, v2.seq);
  pruefe("eine kleinere Folgenummer wird abgelehnt", !alt.darf);
  pruefe("und als veraltet gekennzeichnet", alt.veraltet === true);
  pruefe("der Grund nennt beide Nummern", /seq 1 nach 6/.test(alt.grund), alt.grund);

  const aktuell = F.darfFigur(v2, "graft.js", W0 + 1000, NR, v1.seq);
  pruefe("eine groessere ist in Ordnung", aktuell.darf);
}

console.log("");
console.log("-- nach einem Knotenwechsel gilt keine Vergabe mehr --");
{
  // figure.txt steht NICHT in den Raeumlisten von boot.js; der Stempel
  // ersetzt das Loeschen. Er ueberlebt auch den Einbau, nach dem genau ein
  // Skript ins Gym will.
  const a = F.antrag("graft.js", F.PRIO.graft, "graft", null, "x", uhren(W0));
  const vergabe = F.vergib([a], null, W0, NR).vergabe;
  pruefe("im selben Lauf gilt sie", F.vergabeGilt(vergabe, W0 + 1000, NR));
  pruefe("im neuen Lauf nicht", !F.vergabeGilt(vergabe, W0 + 1000, NR + 1));
  const darf = F.darfFigur(vergabe, "graft.js", W0 + 1000, NR + 1);
  pruefe("auch der Besitzer darf dann nicht", !darf.darf, darf.grund);

  // Antraege aus dem alten Knoten ebenso.
  pruefe("ein alter Antrag gilt nicht mehr", !F.antragGilt(a, W0 + 1000, NR + 1));
}

console.log("");
console.log("-- Antraege verfallen --");
{
  const a = F.antrag("blade.js", F.PRIO.bladeburner, "action", null, "x", uhren(W0));
  pruefe("frisch gilt er", F.antragGilt(a, W0 + 30000, NR));
  pruefe("nach der TTL nicht mehr", !F.antragGilt(a, W0 + F.ANTRAG_TTL_MS + 1000, NR));

  // Ohne Verfall haelt ein toter Antragsteller die Figur besetzt - und das
  // ist genau der Zustand, den die Lease verhindern soll.
  const r = F.vergib([a], null, W0 + F.ANTRAG_TTL_MS + 1000, NR);
  pruefe("und wird nicht mehr vergeben", r.vergabe === null, r.grund);
  pruefe("der Grund sagt es", /kein geltender Antrag/.test(r.grund));
}

console.log("");
console.log("-- die Laufzeitpruefung: tut die Figur, was vergeben wurde? --");
{
  const a = F.antrag("graft.js", F.PRIO.graft, "graft", null, "x", uhren(W0));
  const v = F.vergib([a], null, W0, NR).vergabe;

  pruefe("passende Handlung ist in Ordnung", F.pruefeHandlung(v, "graft").stimmt);

  // DAS IST DER FALL, DER 14,63 MILLIARDEN KOSTET: die Figur ist fuer einen
  // Graft vergeben, tut aber etwas anderes - jemand hat ihn abgeraeumt.
  const abweichend = F.pruefeHandlung(v, "gym");
  pruefe("eine abweichende Handlung faellt auf", !abweichend.stimmt);
  pruefe("und der Grund nennt beide", /graft.*gym/.test(abweichend.grund), abweichend.grund);

  const nichts = F.pruefeHandlung(v, null);
  pruefe("gar keine Handlung faellt auch auf", !nichts.stimmt);
  pruefe("und wird erklaert", /tut aber nichts/.test(nichts.grund), nichts.grund);

  const ohneVergabe = F.pruefeHandlung(null, "gym");
  pruefe("Handlung ohne Vergabe faellt auf", !ohneVergabe.stimmt, ohneVergabe.grund);
  pruefe("keine Vergabe und keine Handlung ist in Ordnung",
    F.pruefeHandlung(null, null).stimmt);
}

console.log("");
console.log("-- der Dateiname des Antrags --");
{
  pruefe("wird aus dem Werkzeugnamen gebildet",
    F.antragsDatei("graft.js") === "data/figure-request-graft.js.json");
  // Der Werkzeugname kommt aus einer Datei, die ein Gewerk schreibt - er darf
  // nicht aus data/ herausfuehren. Geprueft wird der Namensteil, nicht der
  // feste Ordner davor.
  const boese = F.antragsDatei("../../boese.js");
  pruefe("und fuehrt nicht aus data/ heraus",
    boese.startsWith("data/") && !boese.slice(5).includes("/") && !boese.includes("\\"),
    boese);
}

console.log("");
console.log("-- ein TOTER Besitzer haelt die Figur nicht (W9) --");
{
  // Der Anlass: eine Lease laeuft immer bis zum Zeitablauf, auch wenn der
  // Besitzer laengst weg ist (Absturz, verdraengt, gekillt). Bei 15 Minuten
  // war das eine Viertelstunde Stillstand; bei der Graft-Lease von zwei
  // Stunden waeren es zwei Stunden.
  const a = [F.antrag("graftauto.js", F.PRIO.graft, "graft", {},
    "graftplan", uhren(W0))];
  const v = F.vergib(a, null, W0, NR).vergabe;
  pruefe("Ausgangslage: graftauto.js hat die Figur", v.owner === "graftauto.js");

  // Fuenf Minuten spaeter: der Besitzer laeuft nicht mehr, ein anderer will.
  const W5 = W0 + 5 * 60000;
  const spaeter = [F.antrag("blade.js", F.PRIO.bladeburner, "bladeburner", {},
    "Feldarbeit", uhren(W5))];

  // OHNE Lebendpruefung bleibt es beim alten Verhalten - das ist die
  // Rueckfallgarantie fuer Aufrufer ohne Prozessliste.
  const ohne = F.vergib(spaeter, v, W5, NR);
  pruefe("ohne Lebendpruefung haelt die Lease weiter",
    ohne.vergabe && ohne.vergabe.owner === "graftauto.js",
    "Besitzer: " + (ohne.vergabe && ohne.vergabe.owner));

  // MIT Lebendpruefung geht sie an den naechsten Antragsteller.
  const lebt = (t) => t !== "graftauto.js";
  const mit = F.vergib(spaeter, v, W5, NR, lebt);
  pruefe("mit Lebendpruefung geht sie weiter",
    mit.vergabe && mit.vergabe.owner === "blade.js",
    "Besitzer: " + (mit.vergabe && mit.vergabe.owner));
  pruefe("und der Grund nennt den toten Besitzer",
    /graftauto\.js/.test(mit.grund) && /laeuft nicht mehr/.test(mit.grund),
    mit.grund);
  pruefe("es ist ein Wechsel", mit.wechsel === true);

  // Kein Nachfolger da: dann wird die Figur FREI, nicht an den Toten vergeben.
  const leer = F.vergib([], v, W5, NR, lebt);
  pruefe("ohne Nachfolger wird die Figur frei", leer.vergabe === null, leer.grund);

  // Und die Gegenprobe, damit die Regel nicht zu scharf ist: ein LEBENDER
  // Besitzer mit erneuertem Antrag behaelt sie gegen einen schlechteren.
  const eigen = [F.antrag("graftauto.js", F.PRIO.graft, "graft", {}, "weiter", uhren(W5)),
    ...spaeter];
  const bleibt = F.vergib(eigen, v, W5, NR, () => true);
  pruefe("ein lebender Besitzer behaelt sie",
    bleibt.vergabe && bleibt.vergabe.owner === "graftauto.js",
    "Besitzer: " + (bleibt.vergabe && bleibt.vergabe.owner));
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
