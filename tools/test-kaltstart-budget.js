/**
 * Ebene 0: passt der Kaltstart auf 32 GB?
 *
 * ===========================================================================
 * DIE ZAHL, AN DER DER GANZE AUFTRAG HAENGT
 * ===========================================================================
 *
 * DREI KORREKTUREN AM 04.09.2026 (Skeptiker Runde 4, Substanz 13-16). Hier
 * stand: "Nach jedem BitNode-Sprung und nach jedem Augmentierungs-Einbau hat
 * `home` genau 32 GB", und `HOME_GB = 32` trug den Zusatz "nicht
 * verhandelbar, nicht konfigurierbar". Alle drei Teile waren falsch:
 *
 *   (1) Der AUGMENTIERUNGS-EINBAU setzt den Heimspeicher NICHT zurueck.
 *       `prestigeAugmentation` ruft `prestigeHomeComputer`
 *       (`Prestige.ts:60-110`), und das leert in `Server/ServerHelpers.ts:224-238`
 *       nur Programme, Nachrichten und `ramUsed` - `setMaxRam` steht dort
 *       nicht. Gekaufter Heimspeicher ueberlebt einen Einbau. Nur der
 *       BitNode-Wechsel setzt zurueck.
 *
 *   (2) Der BitNode-Wechsel gibt 32 GB nur, solange SF9 unter Stufe 2 liegt
 *       (`Prestige.ts:246-252`): ab SF9 Stufe 2 sind es 128, ohne SF1 waeren
 *       es 8. `route.json` hat BN9 Level 2 als Eintrag 6 von 40 - ab Eintrag 7
 *       startet `home` also mit 128 GB, fuer 34 der 40 Restlaeufe. Bei 128 GB
 *       passt die ganze Kaltstart-Auswahl gleichzeitig, und die
 *       Platzreservierung, um die es hier geht, ist gegenstandslos.
 *
 *   (3) `sf4: 1` war fest verdrahtet. Die Route spielt BN4 Level 2 und 3 als
 *       Eintraege 3 und 4 - ab Eintrag 5 ist SF4 = 3 und der
 *       Singularity-Faktor 1 statt 16. Fuer `homegrow.js` ist das der
 *       Unterschied zwischen 148,50 und 13,50 GB.
 *
 * Der Test bleibt trotzdem wichtig, aber sein Gegenstand ist enger, als er
 * behauptet hat: die ENGE Startlage betrifft die ersten Laeufe der Route, und
 * genau die stehen als naechste an. Die Tabelle unten sagt jetzt je Eintrag,
 * mit welchen Zahlen gerechnet wird.
 *
 * Unveraendert richtig: es gibt nach dem Sprung keinen einzigen Mietrechner
 * (`Prestige.ts:73`) und 1.262 Dollar auf dem Konto
 * (`PlayerObjectGeneralMethods.ts:102`, `1000 + Donations` mit Donations = 262).
 *
 * ===========================================================================
 * WAS DIESER TEST TUT UND WAS NICHT
 * ===========================================================================
 *
 * Er rechnet die Reihenfolge nach, in der der Kern die Gewerke startet
 * (`lib/reg.js`, `auswahl` - nach `priority`, bei Gleichstand nach der
 * Reihenfolge in der Registry), legt sie auf ein leeres 32-GB-`home` und sagt,
 * wer Platz findet und wer wartet.
 *
 * Er kann NICHT sagen, ob das reicht - dafuer braucht es den echten Kaltstart
 * (Ebene 3). Er kann aber sagen, ob die BEIDEN Gewerke, die im Kaltstart Geld
 * bringen, ueberhaupt gleichzeitig laufen koennen. Genau das ist die Frage,
 * die bisher niemand gestellt hat: die Summe aller Kaltstart-Eintraege liegt
 * bei ueber hundert Gigabyte.
 *
 * Aufruf: node tools/test-kaltstart-budget.js
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { rechne, SRC } from "./ram.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

const REG = JSON.parse(fs.readFileSync(path.join(SRC, "registry.json"), "utf8"));
const reg = await import(pathToFileURL(path.join(SRC, "lib", "reg.js")).href);

/**
 * home nach einem BitNode-Wechsel - abhaengig von SF9 und SF1
 * (`Prestige.ts:246-252`).
 *
 *   SF9 >= 2  ->  128 GB
 *   SF1 >  0  ->   32 GB      <- der Stand dieses Spielstands
 *   sonst     ->    8 GB
 */
const HOME_GB = 32;

/**
 * Der Stand der Source-Files je Routeneintrag.
 *
 * Aus `route.json` abgeleitet, nicht behauptet: ein abgeschlossener Eintrag
 * hebt sein Source-File auf die gespielte Stufe. `RedPill.tsx:60-77` vergibt
 * es VOR `prestigeSourceFile`, der neue Stand gilt also sofort beim Sprung.
 */
function standVorEintrag(route, index) {
  const sf = { 1: 1, 4: 1, 5: 1, 6: 1, 10: 1 };   // Stand 04.09.2026, gemessen
  for (let i = 0; i < index; i++) {
    const e = route[i];
    sf[e.node] = Math.max(sf[e.node] || 0, e.level);
  }
  return {
    sf4: sf[4] || 0,
    homeGb: (sf[9] || 0) >= 2 ? 128 : ((sf[1] || 0) > 0 ? 32 : 8),
    sf9: sf[9] || 0,
  };
}

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

/**
 * Der gerechnete Bedarf eines Eintrags im gegebenen BitNode.
 *
 * `sf4` wird jetzt DURCHGEREICHT statt fest auf 1 zu stehen (Skeptiker Runde
 * 4, Substanz 15). Ab Routeneintrag 5 ist SF4 = 3, und dann kostet die
 * Singularity-Familie den Grundpreis statt das Sechzehnfache - fuer 32
 * Dateien ein Unterschied bis Faktor 16.
 */
function bedarf(name, bitNode, sf4 = 1) {
  const r = rechne(name, bitNode === 4 ? { bitNode: 4 } : { sf4 });
  return r.gb;
}

/**
 * Die Startlage durchspielen.
 *
 * `dateiDa` sagt, welche Marker liegen. Im frischen Knoten liegt fast nichts:
 * boot.js raeumt beim Knotenwechsel `keine-hacknet.txt`, `keine-sleeves.txt`,
 * `task.txt` und seit heute auch `preise.json` weg. `contracts.json` entsteht
 * erst, wenn `contracts.js` einmal gelaufen ist - im ersten Moment gibt es sie
 * also nicht, und `csolve.js` wartet zu Recht.
 */
function startlage(bitNode, verfahren, extraDateien = [], schonBelegt = 0,
  homeGb = HOME_GB, sf4 = 1, sf9 = 0) {
  const da = new Set(["registry.json", "route.json", "graftplan.json",
    ...extraDateien]);
  const lage = {
    node: bitNode,
    verfahren,
    phase: "kaltstart",
    dateiDa: (d) => da.has(d) || /\.js$/.test(d),
    // Feature 9 = Hacknet-Server: in BitNode 9 selbst und ab dem ersten
    // SF9 in jedem Knoten. Bis 19.09. stand hier `features: {}` - hashes.js
    // fiel damit in allen 40 Routeneintraegen aus dem Test (Skeptiker).
    ownedSF: { 9: sf9 },
  };
  const auswahl = reg.auswahl(REG, lage);
  let frei = homeGb - schonBelegt;
  const laufen = [];
  const warten = [];
  // DIE RESERVIERUNG NACHBILDEN (bn4net.js, Werkzeugstarter).
  //
  // Passt ein Eintrag nicht, wird der Platz fuer ihn freigehalten - alles
  // dahinter wartet. Ohne diese Regel entsteht eine Prioritaetsinversion, und
  // genau die hat dieser Test am 04.09.2026 aufgedeckt: drei billige
  // Hilfsgewerke belegten den Platz, und keine der drei Geldquellen des
  // Kaltstarts fand je welchen.
  //
  // Der Test bildet die Regel nach, statt sie zu glauben. Waere sie im Kern
  // anders, faende dieser Test es nicht - dafuer gibt es den Ebene-2-Lauf.
  let reserviert = null;
  for (const e of auswahl) {
    if (e.name.startsWith("worker/")) continue;   // Arbeiter kommen zuletzt
    const gb = bedarf(e.name, bitNode, sf4);
    if (gb === null) { warten.push([e.name, null, "nicht rechenbar"]); continue; }
    if (reserviert) {
      warten.push([e.name, gb, "wartet: " + reserviert + " haelt Platz frei"]);
      continue;
    }
    if (gb <= frei) { laufen.push([e.name, gb]); frei -= gb; }
    else {
      warten.push([e.name, gb, "passt nicht (" + frei.toFixed(2) + " GB frei)"]);
      reserviert = e.name;
    }
  }
  return { laufen, warten, frei, auswahl, reserviert };
}

console.log("");
console.log("=== Ebene 0: das Kaltstart-Budget ===");
console.log("    home nach einem Reset: " + HOME_GB + " GB");

console.log("");
console.log("-- die Startlage in BitNode 10, Verfahren V2 --");
{
  // Der naechste Sprung der Route geht nach BN10 Lauf 3. boot.js startet
  // zuerst guard.js, dann bn4net.js; bn4net beendet sich nicht, boot schon.
  const feste = ["boot.js", "guard.js", "bn4net.js", "wakelock.js"];
  let belegt = 0;
  for (const f of feste) {
    const gb = bedarf(f, 10);
    belegt += gb ?? 0;
    console.log("       " + String(gb).padStart(7) + " GB  " + f);
  }
  console.log("       " + belegt.toFixed(2).padStart(7) + " GB  in der Startspitze");
  pruefe("die Startspitze passt", belegt <= HOME_GB,
    belegt.toFixed(2) + " von " + HOME_GB);

  const ohneBoot = belegt - (bedarf("boot.js", 10) ?? 0);
  console.log("       " + ohneBoot.toFixed(2).padStart(7) + " GB  danach (boot.js beendet sich)");
  // Die Zahl, die wirklich zaehlt: was bleibt fuer Geldarbeit uebrig, sobald
  // boot.js weg ist?
  // DIE BINDENDE ZAHL IST cdump.js, NICHT 12 (Substanz 17). Frei sind 12,85,
  // gebraucht 12,65 - die Luft betraegt 0,20 GB. Eine Schwelle bei 12 haette
  // ein Wachstum von 0,85 GB durchgewinkt, obwohl schon 0,21 GB die einzige
  // Geldquelle des Kaltstarts aussperren.
  const cdumpGb = bedarf("cdump.js", 10, 1);
  pruefe("danach bleibt Platz fuer die Geldquelle",
    HOME_GB - ohneBoot >= cdumpGb,
    "frei " + (HOME_GB - ohneBoot).toFixed(2) + " GB, cdump.js braucht "
    + cdumpGb.toFixed(2) + " - Luft: "
    + (HOME_GB - ohneBoot - cdumpGb).toFixed(2) + " GB");
}

console.log("");
console.log("-- wer findet Platz, wer wartet --");
{
  const s = startlage(10, "V2");
  console.log("       laeuft:");
  for (const [n, gb] of s.laufen) console.log("         " + String(gb).padStart(7) + " GB  " + n);
  if (s.warten.length) {
    console.log("       wartet:");
    for (const [n, gb, grund] of s.warten) {
      console.log("         " + String(gb ?? "?").padStart(7) + " GB  " + n + "   " + grund);
    }
  }
  console.log("       frei: " + s.frei.toFixed(2) + " GB");

  // DIE EINE FRAGE, DIE ZAEHLT: kommt in der Startlage ueberhaupt Geld herein?
  //
  // Der Auftrag nennt in E9 zwei Quellen fuer die Positionen 2 bis 4:
  // Programmiervertraege (cdump/csolve) und Sleeve-Verbrechen. Faellt beides
  // aus, verdient der Bot in der Startlage gar nichts und wartet auf ein
  // Hacking-Einkommen, das ohne Rechner nicht entsteht.
  const geldquellen = ["cdump.js", "csolve.js", "sleevecrime.js"];
  const laufenNamen = s.laufen.map(([n]) => n);
  const habenPlatz = geldquellen.filter((g) => laufenNamen.includes(g));
  pruefe("mindestens eine Geldquelle findet Platz", habenPlatz.length >= 1,
    "keine von " + geldquellen.join(", ") + " passt - der Kaltstart haette"
      + " kein Einkommen");
  console.log("       Geldquellen mit Platz: "
    + (habenPlatz.length ? habenPlatz.join(", ") : "KEINE"));

  // Der Kern selbst muss laufen, sonst startet niemand irgendetwas.
  pruefe("der Kern laeuft", laufenNamen.includes("bn4net.js"));
  pruefe("der Waechter laeuft", laufenNamen.includes("guard.js"),
    "ohne ihn merkt niemand, wenn der Kaltstart haengt");
}

console.log("");
console.log("-- die Summe aller Kaltstart-Eintraege --");
{
  // Diese Zahl ist NICHT die Anforderung - die Gewerke laufen nicht alle
  // gleichzeitig. Sie steht hier, weil ihr Abstand zu 32 GB zeigt, wie stark
  // der Kern im Kaltstart priorisieren MUSS.
  const lage = { node: 10, verfahren: "V2", phase: "kaltstart",
    dateiDa: () => true, features: { 9: true } };
  const alle = reg.auswahl(REG, lage).filter((e) => !e.name.startsWith("worker/"));
  let summe = 0;
  for (const e of alle) summe += bedarf(e.name, 10) ?? 0;
  console.log("       " + alle.length + " Eintraege, zusammen "
    + summe.toFixed(2) + " GB - das " + (summe / HOME_GB).toFixed(1)
    + "-fache von home");
  pruefe("die Priorisierung ist noetig und der Kern hat sie", summe > HOME_GB,
    "waere die Summe kleiner, braeuchte es keine Reihenfolge");

  // Die Reihenfolge muss die Geldquellen VOR die Kuer setzen. Ein Kaltstart,
  // der zuerst hacknet.js und popups.js startet und dann keinen Platz mehr
  // fuer den Vertragsloeser hat, verdient nichts.
  // DIREKT AUS DER REGISTRY, nicht aus der gefilterten Auswahl: `cdump.js`
  // traegt `forbidsFile: data/csolve-laeuft.txt`, und mit `dateiDa: () => true`
  // gilt es als blockiert - es taucht in `alle` gar nicht auf. Der Vergleich
  // lief damit gegen `undefined` und war immer rot (04.09.2026).
  const prio = Object.fromEntries(REG.eintraege.map((e) => [e.name, e.priority]));
  pruefe("cdump.js kommt vor hacknet.js", prio["cdump.js"] < prio["hacknet.js"],
    "cdump " + prio["cdump.js"] + ", hacknet " + prio["hacknet.js"]);
  // popups.js laeuft seit dem 04.09.2026 gar nicht mehr im Kaltstart
  // (phase: "normal"). Der Grund steht in ARCHITEKTUR 3.3: mit seinen 3,30 GB
  // drueckte es cdump.js (12,00) aus dem Budget, und damit die einzige
  // Geldquelle der Startlage. Dialoge entstehen dort ohnehin kaum - sie kommen
  // von Faktionseinladungen und Augmentierungen, also aus der Spaetphase.
  const popupsEintrag = REG.eintraege.find((e) => e.name === "popups.js");
  pruefe("popups.js laeuft nicht im Kaltstart", popupsEintrag.phase === "normal",
    "sonst verdraengt es cdump.js aus den 32 GB");
  pruefe("der Kern hat die kleinste Nummer", prio["bn4net.js"] === 1);
  pruefe("der Waechter die zweitkleinste", prio["guard.js"] === 2);
}

console.log("");
console.log("-- BitNode 9: kein Mietrechner, nie --");
{
  // CloudServerLimit ist dort 0 (BitNode.tsx:816, verifiziert). Der Kaltstart
  // endet in BN9 also nicht mit dem ersten Rechnerkauf - er dauert den ganzen
  // Lauf. Umso wichtiger, dass das Budget dort aufgeht.
  const s = startlage(9, "V1");
  const laufenNamen = s.laufen.map(([n]) => n);
  pruefe("auch in BN9 laeuft der Kern", laufenNamen.includes("bn4net.js"));
  pruefe("und der Waechter", laufenNamen.includes("guard.js"));
  console.log("       frei nach der Startlage: " + s.frei.toFixed(2) + " GB");
  console.log("       (In BN9 gibt es nie eine Werkbank - CloudServerLimit 0."
    + " Position C.13 baut das Gewerk dafuer.)");
}

console.log("");
console.log("-- die ALLERERSTE Kernrunde: boot.js laeuft noch (C.7) --");
{
  // WARUM DAS EINE EIGENE PROBE BRAUCHT (Skeptiker Runde 3, C7).
  //
  // Der Test oben rechnet mit 19,15 GB Belegung - also mit einem boot.js, das
  // sich schon beendet hat. In der ersten Kernrunde ist es aber noch da:
  // boot.js startet den Kern und wartet, bis er laeuft. Dann sind 24,65 GB
  // belegt und nur 7,35 GB frei, und `cdump.js` (12,65) passt NICHT.
  //
  // Die Frage ist nicht, ob es passt - es passt nicht, das ist Arithmetik.
  // Die Frage ist, ob dieses Fenster einen SCHADEN anrichtet: naemlich ob ein
  // billigeres Gewerk den Platz nimmt und die Geldquelle danach aussperrt.
  // Genau davor schuetzt die Platzreservierung, und genau das wird hier
  // geprueft.
  // NICHT 5,5 HINSCHREIBEN (Skeptikerrunde 6).
  //
  // Hier stand ein Literal. Das ist genau die Falle, die Befund M.3 gerade
  // erst gestellt hat: der Auftrag fuehrte `boot.js` mit 4,0 GB, gemessen
  // waren 5,5 - und ein Test mit fest eingetragener Zahl waere gruen
  // geblieben, waehrend die Schwelle laengst falsch war. Waechst `boot.js`
  // morgen auf 7 GB, muss dieser Test es MERKEN, nicht nachtragen.
  const BOOT = rechne("boot.js", { bitNode: 4 }).gb;
  console.log("       boot.js: " + BOOT.toFixed(2) + " GB (gerechnet, nicht notiert)");
  const eng = startlage(10, "V2", [], BOOT);
  const engLaufen = eng.laufen.map(([n]) => n);
  for (const [n, gb] of eng.laufen) console.log("       laeuft:  " + String(gb).padStart(6) + " GB  " + n);
  console.log("       frei: " + eng.frei.toFixed(2) + " GB, reserviert fuer: " + eng.reserviert);

  pruefe("cdump.js passt in diesem Fenster nicht", !engLaufen.includes("cdump.js"),
    "7,35 GB frei, 12,65 gebraucht - das ist der Anlass der Probe");
  pruefe("und der Platz wird fuer cdump.js reserviert", eng.reserviert === "cdump.js",
    "reserviert war: " + eng.reserviert);
  pruefe("darkweb.js nimmt den Platz NICHT weg",
    !engLaufen.includes("darkweb.js"),
    "ohne die Reservierung liefe darkweb (2,65 GB) hier los und cdump waere"
    + " danach mit 10,20 GB freiem home dauerhaft ausgesperrt");
  pruefe("auch sonst startet in diesem Fenster kein Gewerk",
    engLaufen.filter((n) => !["bn4net.js", "guard.js", "wakelock.js"].includes(n)).length === 0,
    "gestartet: " + engLaufen.join(", "));

  // Und der Beleg, dass es sich von selbst aufloest: sobald boot.js weg ist,
  // passt die Geldquelle. Die Reservierung verfaellt nach 5 Minuten - sie
  // haelt also lange genug und nicht laenger.
  const weit = startlage(10, "V2", [], 0);
  pruefe("sobald boot.js weg ist, laeuft cdump.js",
    weit.laufen.map(([n]) => n).includes("cdump.js"),
    "sonst waere das Fenster kein Fenster, sondern ein Riegel");
}

console.log("");
console.log("-- die ganze Route, mit dem jeweils richtigen Stand (Substanz 13-16) --");
{
  // WO IST ES WIRKLICH ENG. Der Test hat bis heute vierzig Laeufe ueber einen
  // Kamm geschoren: 32 GB, SF4 = 1. Beides gilt nur fuer die ersten Eintraege.
  const route = JSON.parse(fs.readFileSync(path.join(SRC, "route.json"), "utf8")).route;
  const eng = [];
  const zeilen = [];
  for (let i = 0; i < route.length; i++) {
    const e = route[i];
    const st = standVorEintrag(route, i);
    const s2 = startlage(e.node, e.verfahren, [], 0, st.homeGb, st.sf4, st.sf9);
    const geldquellen = s2.laufen.map(([n]) => n)
      .filter((n) => ["cdump.js", "csolve.js", "sleevecrime.js"].includes(n));
    if (st.homeGb <= 32) eng.push(i + 1);
    zeilen.push({ nr: i + 1, node: e.node, level: e.level, home: st.homeGb,
      sf4: st.sf4, laufen: s2.laufen.length, frei: s2.frei,
      geld: geldquellen.length });
  }

  // Nur die ersten acht und eine Zusammenfassung - vierzig Zeilen liest niemand.
  for (const z of zeilen.slice(0, 8)) {
    console.log("       " + String(z.nr).padStart(2) + ". BN" + z.node + " L" + z.level
      + "  home " + String(z.home).padStart(3) + " GB, SF4." + z.sf4
      + " -> " + String(z.laufen).padStart(2) + " Gewerke, "
      + z.frei.toFixed(2).padStart(6) + " GB frei, "
      + z.geld + " Geldquelle(n)");
  }
  console.log("       ... (" + (zeilen.length - 8) + " weitere)");

  pruefe("die enge Startlage betrifft genau die ersten " + eng.length + " Eintraege",
    eng.length > 0 && eng.length < route.length,
    "eng (32 GB): " + eng.join(", "));
  pruefe("und sie stehen als naechste an", eng[0] === 1,
    "sonst waere dieser Test nicht der dringendste");

  // In JEDEM Eintrag muss mindestens eine Geldquelle Platz finden. Das ist die
  // Aussage, die ueber alle vierzig Laeufe gilt.
  const ohneGeld = zeilen.filter((z) => z.geld === 0);
  pruefe("in jedem der " + zeilen.length + " Laeufe findet eine Geldquelle Platz",
    ohneGeld.length === 0,
    ohneGeld.map((z) => z.nr + ". BN" + z.node).join(", "));

  // Und die Gegenprobe zur Korrektur (2): ab 128 GB ist es NICHT mehr eng.
  const weit = zeilen.find((z) => z.home === 128);
  if (weit) {
    pruefe("ab dem ersten 128-GB-Lauf ist Platz da", weit.frei > 10,
      "Lauf " + weit.nr + ": " + weit.frei.toFixed(2) + " GB frei bei "
      + weit.laufen + " Gewerken");
  }
}

console.log("");
console.log("-- BitNode 4: derselbe Speicher, andere Singularity-Preise --");
{
  // BN4 kam bisher gar nicht vor, obwohl `rechne` einen eigenen Modus dafuer
  // hat (Substanz 16). Dort kostet die Singularity-Familie den Grundpreis -
  // fuer homegrow.js ist das der Unterschied zwischen 148,50 und 13,50 GB.
  const s4 = startlage(4, "V2");
  const s10 = startlage(10, "V2");
  const n4 = s4.laufen.map(([n]) => n);
  pruefe("auch in BN4 laeuft der Kern", n4.includes("bn4net.js"));
  pruefe("und der Waechter", n4.includes("guard.js"));
  const hg4 = bedarf("homegrow.js", 4);
  const hg10 = bedarf("homegrow.js", 10, 1);
  pruefe("homegrow.js ist in BN4 um ein Vielfaches billiger", hg4 * 5 < hg10,
    "BN4 " + hg4.toFixed(2) + " GB, sonst " + hg10.toFixed(2) + " GB bei SF4.1");
  console.log("       BN4: " + s4.laufen.length + " Gewerke, "
    + s4.frei.toFixed(2) + " GB frei; BN10: " + s10.laufen.length + " Gewerke, "
    + s10.frei.toFixed(2) + " GB frei");
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
