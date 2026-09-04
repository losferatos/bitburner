/**
 * Ebene 0: passt der Kaltstart auf 32 GB?
 *
 * ===========================================================================
 * DIE ZAHL, AN DER DER GANZE AUFTRAG HAENGT
 * ===========================================================================
 *
 * Nach jedem BitNode-Sprung und nach jedem Augmentierungs-Einbau hat `home`
 * genau 32 GB (`Prestige.ts:241-247`), es gibt keinen einzigen Mietrechner
 * (`Prestige.ts:73`) und 1.262 Dollar auf dem Konto
 * (`PlayerObjectGeneralMethods.ts:102`). In diese 32 GB muss alles passen, was
 * den Bot aus der Startlage heraustraegt - und was nicht passt, wartet.
 *
 * Vierzig Mal auf der Restroute. Ein Kaltstart, der eine Stunde laenger
 * dauert, kostet vierzig Stunden.
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

/** home nach einem Reset. Nicht verhandelbar, nicht konfigurierbar. */
const HOME_GB = 32;

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

/** Der gerechnete Bedarf eines Eintrags im gegebenen BitNode. */
function bedarf(name, bitNode) {
  const r = rechne(name, bitNode === 4 ? { bitNode: 4 } : { sf4: 1 });
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
function startlage(bitNode, verfahren, extraDateien = [], schonBelegt = 0) {
  const da = new Set(["registry.json", "route.json", "graftplan.json",
    ...extraDateien]);
  const lage = {
    node: bitNode,
    verfahren,
    phase: "kaltstart",
    dateiDa: (d) => da.has(d) || /\.js$/.test(d),
    features: {},
  };
  const auswahl = reg.auswahl(REG, lage);
  let frei = HOME_GB - schonBelegt;
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
    const gb = bedarf(e.name, bitNode);
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
  pruefe("danach bleiben mindestens 12 GB fuer Gewerke und Arbeiter",
    HOME_GB - ohneBoot >= 12,
    "frei " + (HOME_GB - ohneBoot).toFixed(2) + " GB");
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
  const BOOT = 5.5;
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
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
