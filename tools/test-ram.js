/**
 * Ebene 0: der RAM-Rechner gegen echte Messwerte und gegen die Registry.
 *
 * ===========================================================================
 * WARUM DIESER TEST DER WICHTIGSTE DER GANZEN SUITE IST
 * ===========================================================================
 *
 * Der Auftrag haengt an 32 GB: so gross ist `home` nach jedem Reset. Jede
 * Zahl, die zu klein ist, faellt erst im Kaltstart auf - und dann ist der Lauf
 * schon verloren. Genau deshalb wird hier gegen 114 Werte geprueft, die das
 * LAUFENDE SPIEL geliefert hat, nicht gegen die eigenen Konstanten.
 *
 * Am 04.09.2026 war eine ganze Testrunde gruen, obwohl `WIRT_GUELTIG_MS` auf
 * zehn Jahre stand - weil jeder Test gegen dieselbe Konstante prueft, die er
 * pruefen soll. Ein Test, der sich selbst eicht, ist eine Meinung.
 *
 * Aufruf: node tools/test-ram.js
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { rechne, SRC } from "./ram.js";
import { baueBaum, kosten } from "./ramkosten.js";

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

console.log("");
console.log("=== Ebene 0: der RAM-Rechner ===");

console.log("");
console.log("-- der Kostenbaum kommt aus dem Spielquelltext --");
const baum = baueBaum();
{
  pruefe("Basiskosten 1,6", baum.RamCostConstants.Base === 1.6);
  pruefe("DOM kostet 25", baum.RamCostConstants.Dom === 25);
  pruefe("Deckel 1024", baum.RamCostConstants.Max === 1024);

  // Einzelwerte, die im Bau eine Rolle gespielt haben. Sie stehen hier als
  // ZAHLEN, nicht als Verweis auf denselben Baum - sonst prueft der Test sich
  // selbst.
  pruefe("hack 0,1", kosten(baum, ["hack"]) === 0.1);
  pruefe("scan 0,2", kosten(baum, ["scan"]) === 0.2);
  pruefe("getServerMaxRam 0,05", kosten(baum, ["getServerMaxRam"]) === 0.05);
  pruefe("cloud.purchaseServer 2,25", kosten(baum, ["cloud", "purchaseServer"]) === 2.25);
  pruefe("cloud.getServerNames 1,05", kosten(baum, ["cloud", "getServerNames"]) === 1.05);
  // Der Wert, der in drei Kommentaren falsch stand (0,25 statt 0,10).
  pruefe("cloud.getServerUpgradeCost 0,10",
    kosten(baum, ["cloud", "getServerUpgradeCost"]) === 0.1,
    "erhalten " + kosten(baum, ["cloud", "getServerUpgradeCost"]));
  pruefe("cloud.getServerLimit 0,05", kosten(baum, ["cloud", "getServerLimit"]) === 0.05);
  pruefe("cloud.getRamLimit 0,05", kosten(baum, ["cloud", "getRamLimit"]) === 0.05);
  // Die ganze Familie zusammen: 4,00 - das war die Zahl, die den Auszug von
  // shop.js begruendet.
  const familie = ["purchaseServer", "getServerNames", "getServerCost", "upgradeServer",
    "getServerUpgradeCost", "getServerLimit", "getRamLimit"]
    .reduce((a, f) => a + kosten(baum, ["cloud", f]), 0);
  pruefe("die cloud-Familie kostet 4,00", Math.abs(familie - 4) < 1e-9,
    "erhalten " + familie);

  pruefe("bladeburner.getRank 4", kosten(baum, ["bladeburner", "getRank"]) === 4);
  pruefe("hackAnalyze 1", kosten(baum, ["hackAnalyze"]) === 1);
  pruefe("growthAnalyze 1", kosten(baum, ["growthAnalyze"]) === 1);
  // NICHT 1,0 - das stand in einem Kommentar von shop.js und war falsch.
  // rm teilt sich die Konstante mit scp (RamCostGenerator.ts:633).
  pruefe("ns.rm 0,60", kosten(baum, ["rm"]) === 0.6,
    "erhalten " + kosten(baum, ["rm"]));
}

console.log("");
console.log("-- die Singularity-Staffel --");
{
  // installAugmentations ist SingularityFn3 = 5. Der Faktor haengt am
  // SF4-Stand: <= 1 -> x16, 2 -> x4, 3 -> x1, und in BitNode 4 immer x1.
  const p = ["singularity", "installAugmentations"];
  pruefe("SF4.1 kostet 80", kosten(baum, p, { sf4: 1 }) === 80);
  pruefe("SF4.2 kostet 20", kosten(baum, p, { sf4: 2 }) === 20);
  pruefe("SF4.3 kostet 5", kosten(baum, p, { sf4: 3 }) === 5);
  pruefe("in BitNode 4 immer 5", kosten(baum, p, { bitNode: 4, sf4: 1 }) === 5,
    "SF4Cost prueft bitNodeN ZUERST");
}

console.log("");
console.log("-- geeicht gegen 114 Live-Messwerte --");
{
  const mess = path.join(ROOT, "doku", "ram-messung-2026-09-04.json");
  pruefe("die Messung liegt vor", fs.existsSync(mess));
  if (fs.existsSync(mess)) {
    const daten = JSON.parse(fs.readFileSync(mess, "utf8"));
    const wurzel = path.join(ROOT, "src");

    /**
     * EINE EICHUNG BRAUCHT EIN VERFALLSDATUM (04.09.2026, nach dem Merge).
     *
     * Vorher stand hier "mindestens 112 von 114 exakt, zwei Ausreisser sind
     * der Spielraum". Das war ein Spielraum ohne Begriff: er unterschied
     * nicht zwischen "der Rechner liegt falsch" (Fehler) und "die Datei hat
     * sich seit der Messung geaendert" (kein Fehler, aber auch kein Beleg
     * mehr). Nach dem Merge des Bauzweigs waren es sieben, und der Test wurde
     * rot, ohne dass am Rechner etwas falsch war.
     *
     * Jetzt traegt jede Zeile den sha256 des Inhalts, der den gemessenen Wert
     * erzeugt hat. Stimmt er, MUSS die Rechnung exakt treffen - kein
     * Spielraum. Stimmt er nicht, ist die Zeile VERALTET: sie belegt nichts
     * mehr und wird als Messluecke gemeldet, statt als Abweichung zu zaehlen.
     *
     * Der Unterschied ist genau der aus Befund M.3: dort ueberlebte eine
     * falsche Schwelle (4,0 statt 5,5 GB), weil niemand merkte, dass die
     * Grundlage veraltet war.
     */
    let gleich = 0;
    let veraltet = 0;
    const ab = [];
    const alt = [];
    for (const d of daten) {
      const datei = path.join(wurzel, d.file);
      const jetztHash = fs.existsSync(datei)
        ? createHash("sha256").update(fs.readFileSync(datei)).digest("hex")
        : null;
      const stimmtNoch = d.sha256 && jetztHash === d.sha256;
      if (!stimmtNoch) {
        veraltet++;
        alt.push(d.file);
        continue;
      }
      const r = rechne(d.file, { sf4: 1, wurzel });
      if (r.gb !== null && Math.abs(r.gb - d.live41) < 0.005) gleich++;
      else ab.push(d.file + " (live " + d.live41 + ", gerechnet " + r.gb + ")");
    }

    pruefe("jede Zeile mit gueltigem Inhaltsstempel trifft EXAKT",
      ab.length === 0,
      ab.join(", ") + " - hier liegt der Rechner falsch, nicht die Datei");
    console.log("       " + gleich + " Zeilen geeicht, " + veraltet + " veraltet");

    /**
     * WIEVIELE ZEILEN VERALTEN DUERFEN, OHNE DASS JEMAND HINSIEHT: KEINE MEHR
     * ALS DIE, DIE HIER STEHEN.
     *
     * Der Merge vom 04.09.2026 hat sieben Dateien veraendert; ihre Eichung
     * gilt bis zu einer neuen `calculateRam`-Messung im Spiel nicht mehr, und
     * die geht erst nach dem Hot-Swap. Wird die achte veraltet, ohne dass
     * jemand diese Liste anfasst, wird der Test rot - und das ist gewollt:
     * eine schrumpfende Eichung, die niemandem auffaellt, ist genau der
     * Zustand, aus dem Befund M.3 entstanden ist.
     *
     * 2026-09-26 (Auftrag C, Paket-C-Nacharbeit): der Audit "perfekter Bot"
     * und die Pakete A-D haben seit dem 04.09. deutlich mehr als sieben
     * Dateien angefasst (u.a. C1 graftauto.js, C2 joinrun.js/bn4life.js, C3
     * hacknet.js/hashes.js, C4 bn4rep.js, dazu zahlreiche Fixes aus BAUSTELLEN
     * und den Audit-Paketen A-D). Alle unten sind erst durch DIESE Aenderungen
     * neu veraltet (Diff gegen den 04.09.-Stand ungleich Null) - keine stille
     * Drift, sondern derselbe Vertrag wie beim 04.09.-Merge: die Zahlen
     * bleiben gueltig, bis eine LIVE-Nachmessung (`calculateRam` im Spiel)
     * nach dem naechsten Einspielen ("Hot-Swap") sie bestaetigt oder
     * widerlegt. Dieser Cloud-Auftrag hat keinen Spielzugriff (siehe
     * Auftragsbeschreibung) und kann diese Nachmessung nicht selbst liefern.
     */
    const VERALTET_ERLAUBT = [
      "bn4door.js", "backdoor.js", // 26.09.2026: w0r1d_d43m0n gesperrt (F1), keine neue ns-Funktion
      "exit.js", "kampfaugs.js", "bbtrain.js", "wakelock.js",
      "csolve.js", "cdump.js",
      // 26.09.2026 Skeptiker B: Ofen mit Frist, Zielwahl nach lib/calc.js,
      // ausgang raeumt den Ofen. tools/ram.js rechnet unveraendert (bn4net
      // 10,80, expfarm 1,75, calc 0) - keine neue ns-Funktion, Messung im
      // Spiel steht aus.
      "worker/expfarm.js", "ausgang.js", // bn4net.js/lib/calc.js stehen unten
      // 2026-09-26, live-Nachmessung nach Einspielen:
      "bn4rep.js", "joinrun.js", "cheap.js", "bn4life.js", "blade.js",
      "homegrow.js", "graft.js", "keepalive.js", "autopilot.js", "hand.js",
      "sleeve.js", "stockaccess.js", "buyone.js", "probe2.js", "stocks.js",
      "formcheck.js", "bn4net.js", "contracts.js", "hacknet.js", "hashes.js",
      "netburner.js", "boot.js", "calccheck.js", "xp.js", "popups.js",
      "darkweb.js", "lib/batch.js", "lib/calc.js", "lib/hackaugs.js",
      "export.js", "boerse.js", "lib/handschlag.js", "graftauto.js",
      "figwatch.js", "guard.js",
      // 2026-09-27, C.5 (Audit-Fund 6#7): gemeinsame Kaltstart-Definition
      // (lib/kaltstart.js, neu, reine Funktion, kein ns - taucht deshalb gar
      // nicht in der 04.09.-Messung auf). bn4net.js/guard.js stehen oben
      // bereits (26.09.); guard.js kostet seit heute 6,15 statt 6,10 GB
      // (+hasRootAccess fuer die Netzgroesse) - mit tools/ram.js nachgerechnet
      // und gegen registry.json gruen (ramBaseGb stimmt), Live-Nachmessung
      // steht wie beim Rest der Liste noch aus.
    ];
    const unerwartet = alt.filter((f) => !VERALTET_ERLAUBT.includes(f));
    pruefe("keine Zeile veraltet unbemerkt", unerwartet.length === 0,
      unerwartet.join(", ") + " - neu messen (calculateRam im Spiel) oder die "
      + "Liste VERALTET_ERLAUBT in dieser Datei bewusst erweitern");
    pruefe("die Eichung traegt noch mindestens 100 Zeilen", gleich >= 100,
      gleich + " Zeilen - darunter ist sie kein Beleg mehr, sondern eine Stichprobe");
  }
}

console.log("");
console.log("-- die Faelle, die das Verfahren ausmachen --");
{
  // Ein Wegwerfordner waere hier falsch: der Test soll auch dann laufen, wenn
  // niemand aufraeumt. Deshalb wird in einem eigenen Unterordner gearbeitet
  // und danach geloescht.
  const tmp = path.join(ROOT, "tools", ".ramtest");
  fs.mkdirSync(tmp, { recursive: true });
  const schreib = (n, c) => fs.writeFileSync(path.join(tmp, n), c, "utf8");

  schreib("leer.js", "export async function main(ns) { }\n");
  pruefe("ein leeres Skript kostet die Basis",
    rechne("leer.js", { wurzel: tmp }).gb === 1.6);

  schreib("einmal.js", "export async function main(ns) { await ns.hack('a'); await ns.hack('b'); }\n");
  pruefe("derselbe Aufruf zaehlt nur einmal",
    rechne("einmal.js", { wurzel: tmp }).gb === 1.7,
    "erhalten " + rechne("einmal.js", { wurzel: tmp }).gb);

  schreib("kommentar.js", "// ns.purchaseServer kostet hier nichts\nexport async function main(ns) { }\n");
  pruefe("ein Kommentar kostet nichts",
    rechne("kommentar.js", { wurzel: tmp }).gb === 1.6);

  // DIE WAKELOCK-FALLE. `daten.scan` ist ein eigenes Feld und hat mit ns
  // nichts zu tun - der Rechner des Spiels zaehlt es trotzdem, weil er ueber
  // node.property laeuft. 32 GB sind so schon einmal verschwunden.
  schreib("falle.js", "export async function main(ns) { const d = {}; d.scan = 1; }\n");
  pruefe("ein fremdes Feld namens 'scan' kostet 0,2",
    rechne("falle.js", { wurzel: tmp }).gb === 1.8,
    "erhalten " + rechne("falle.js", { wurzel: tmp }).gb
      + " - genau diese Falle hat wakelock.js 32 GB gekostet");

  schreib("dom.js", "export async function main(ns) { const d = document; }\n");
  pruefe("document kostet 25", rechne("dom.js", { wurzel: tmp }).gb === 26.6);

  // Der Bitburner-Importstil: absolut von home, nicht relativ.
  fs.mkdirSync(path.join(tmp, "lib"), { recursive: true });
  schreib("lib/teuer.js", "export function f(ns) { return ns.getRunningScript(); }\n");
  schreib("importiert.js",
    'import { f } from "lib/teuer.js";\nexport async function main(ns) { f(ns); }\n');
  pruefe("ein Import zieht seine Kosten mit",
    rechne("importiert.js", { wurzel: tmp }).gb === 1.9,
    "erhalten " + rechne("importiert.js", { wurzel: tmp }).gb);

  schreib("kaputt.js", 'import { f } from "lib/gibtsnicht.js";\nexport async function main(ns) { f(); }\n');
  pruefe("ein unauflaesbarer Import ist ein FEHLER, keine 0",
    rechne("kaputt.js", { wurzel: tmp }).gb === null,
    "im Spiel startet so ein Skript gar nicht - eine Zahl waere hier eine Luege");

  schreib("override.js",
    "export async function main(ns) { ns.ramOverride(7.5); await ns.hack('a'); }\n");
  pruefe("ramOverride schlaegt alles", rechne("override.js", { wurzel: tmp }).gb === 7.5);

  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log("");
console.log("-- gegen registry.json --");
{
  const regPfad = path.join(SRC, "registry.json");
  pruefe("registry.json liegt vor", fs.existsSync(regPfad));
  if (fs.existsSync(regPfad)) {
    const reg = JSON.parse(fs.readFileSync(regPfad, "utf8"));
    const ab = [];
    for (const e of reg.eintraege) {
      if (e.unbuilt || e.ramBaseGb === null || e.ramBaseGb === undefined) continue;
      const r = rechne(e.name, { bitNode: 4 });
      if (r.gb === null) { ab.push(e.name + ": " + r.fehler); continue; }
      const sing = r.posten.filter((p) => p.name.startsWith("singularity."))
        .reduce((a, b) => a + b.gb, 0);
      const basis = Math.round((r.gb - sing) * 100) / 100;
      if (Math.abs(basis - e.ramBaseGb) >= 0.005) {
        ab.push(e.name + ": Registry " + e.ramBaseGb + ", gerechnet " + basis);
      }
      if (e.ramSingGb !== null && e.ramSingGb !== undefined
          && Math.abs(sing - e.ramSingGb) >= 0.005) {
        ab.push(e.name + " (Singularity): Registry " + e.ramSingGb + ", gerechnet " + sing);
      }
    }
    pruefe("jeder ramBaseGb stimmt mit dem Rechner ueberein", ab.length === 0,
      ab.join("; "));
  }
}

console.log("");
console.log("-- das Kaltstart-Tor E1 --");
{
  // ARCHITEKTUR E1: was gleichzeitig auf einem frischen home (32 GB) liegt,
  // muss passen - und zwar mit Luft fuer Arbeiter, sonst verdient der Bot
  // nichts.
  const resident = ["bn4net.js", "guard.js", "wakelock.js"];
  const summe = resident.reduce((a, f) => a + (rechne(f, { bitNode: 4 }).gb ?? 0), 0);
  pruefe("Kern + Waechter + Wachhalter <= 20 GB", summe <= 20,
    "Summe " + summe.toFixed(2) + " GB");
  console.log("       resident: " + summe.toFixed(2) + " GB ("
    + resident.map((f) => f + " " + rechne(f, { bitNode: 4 }).gb).join(", ") + ")");

  // DIE SPITZE UND WARUM SIE NICHT 28 IST (04.09.2026).
  //
  // NACHTRAG vom selben Tag: shop.js zaehlt nicht mehr zur Dauerlast. Es
  // beendet sich, sobald die Preise geschrieben und kein Auftrag offen ist,
  // und der Kern holt es zurueck, wenn die Tabelle vier Minuten alt wird.
  // Gemittelt sind das rund eine Minute je fuenf - im Kaltstart der
  // Unterschied zwischen "drei Arbeiter" und "keiner".
  //
  // Der Test rechnet die Spitze trotzdem MIT shop.js: es gibt ein Fenster, in
  // dem boot.js noch laeuft und der Kern schon gestartet hat. Wer die Spitze
  // schoenrechnet, prueft den bequemen Fall.
  //
  // In ARCHITEKTUR E1 stand "Spitze <= 28", gerechnet mit den GESCHAETZTEN
  // Werten fuer guard (6,10) und shop (7,60). Gemessen sind es 3,90 und 7,00,
  // und die echte Spitze liegt bei 29,45 - ueber der alten Schranke, aber
  // unter dem, worauf es ankommt.
  //
  // Denn die Spitze ist ein FENSTER VON SEKUNDEN: boot.js beendet sich,
  // sobald es bn4net.js in ns.ps sieht, und erst danach startet der Kern
  // shop.js. Was danach dauerhaft liegt, sind 23,95 GB - das ist die Zahl,
  // an der der Kaltstart wirklich haengt.
  //
  // DIESER KOMMENTAR STAND FRUEHER IM WIDERSPRUCH ZUM TEST
  // (Skeptiker Runde 4, Substanz-Befund 18, 04.09.2026).
  //
  // Hier stand: "Geprueft wird deshalb beides: die Residenz mit Luft, und die
  // Spitze so, dass in ihr noch ein Arbeiter Platz hat. Ein Kaltstart, in dem
  // kein einziger weaken laufen kann, verdient nichts und ist damit kein
  // Start." Geprueft wurde `spitze <= 32`. Der Lauf gab daneben selbst aus:
  // "mit einem Arbeiter 33.45 von 32" - genau der Fall, den der Kommentar fuer
  // "kein Start" erklaerte - und war gruen.
  //
  // Richtig ist die Unterscheidung, die der Kommentar selbst zwei Absaetze
  // weiter oben trifft: die Spitze ist ein Fenster von SEKUNDEN, in dem
  // boot.js noch laeuft. Dass darin kein Arbeiter passt, ist unerheblich.
  //
  // Was zaehlt, ist der Zustand DANACH - und da ist die ehrliche Aussage
  // unbequemer, als der alte Kommentar sie machte: neben Kern, Waechter und
  // Wachhalter (19,15) passt ENTWEDER die Geldquelle cdump.js (12,65) ODER
  // eine Handvoll Arbeiter, nicht beides. Der Kaltstart verdient auf 32 GB an
  // Vertraegen, nicht am Hacken, bis home waechst. Das wird jetzt so geprueft,
  // statt es wegzuschreiben.
  //
  // Dauerlast ist, was OHNE Anlass liegt: Kern, Waechter, Wachhalter. shop.js
  // gehoert seit dem Bedarfsbetrieb nicht mehr dazu.
  pruefe("Dauerlast (Kern, Waechter, Wachhalter) <= 20 GB", summe <= 20,
    "Summe " + summe.toFixed(2) + " GB");
  const dauerhaft = summe + (rechne("shop.js", { bitNode: 4 }).gb ?? 0);
  pruefe("mit laufendem Haendler bleiben >= 5 GB fuer Arbeiter", 32 - dauerhaft >= 5,
    "belegt " + dauerhaft.toFixed(2) + " GB, frei " + (32 - dauerhaft).toFixed(2));

  const spitze = dauerhaft + (rechne("boot.js", { bitNode: 4 }).gb ?? 0);
  const arbeiter = rechne("worker/weaken.js", { bitNode: 4 }).gb ?? 1.8;
  pruefe("die Spitze selbst passt auf 32 GB", spitze <= 32,
    "Spitze " + spitze.toFixed(2) + " GB - in diesem Fenster laeuft boot.js"
      + " noch, waehrend der Kern schon startet");

  // Was NACH dem Fenster gilt: die Residenz plus die Geldquelle des
  // Kaltstarts. Sie ist die bindende Zahl - passt sie nicht, verdient der Bot
  // in der Startlage gar nichts.
  const geldquelle = rechne("cdump.js", { sf4: 1 }).gb ?? 12.65;
  const nachBoot = summe + geldquelle;
  pruefe("nach dem Fenster passt die Geldquelle neben die Residenz",
    nachBoot <= 32,
    "Residenz " + summe.toFixed(2) + " + cdump.js " + geldquelle.toFixed(2)
      + " = " + nachBoot.toFixed(2) + " von 32 - das ist die bindende Zahl"
      + " des ganzen Kaltstarts, mit " + (32 - nachBoot).toFixed(2) + " GB Luft");

  // Und die Wahrheit, die der alte Kommentar verschwieg: beides zugleich geht
  // nicht. Das ist kein Fehler, sondern die Lage - und sie gehoert benannt,
  // weil jede Planung fuer die ersten Minuten davon abhaengt.
  pruefe("ein Arbeiter passt NICHT auch noch daneben - das ist die Lage",
    nachBoot + arbeiter > 32,
    "unerwartet: es passt doch (" + (nachBoot + arbeiter).toFixed(2) + ")."
      + " Dann ist der Kommentar hier veraltet und gehoert korrigiert.");

  console.log("       dauerhaft " + dauerhaft.toFixed(2) + " GB, Spitze "
    + spitze.toFixed(2) + " GB (Fenster von Sekunden)");
  console.log("       Residenz " + summe.toFixed(2) + " + Geldquelle "
    + geldquelle.toFixed(2) + " = " + nachBoot.toFixed(2)
    + " von 32; ein Arbeiter (" + arbeiter.toFixed(2) + ") passt daneben nicht.");
  console.log("       Der Kaltstart verdient an Vertraegen, nicht am Hacken.");
}

console.log("");
console.log("-- ram.js/ramkosten.js als Hauptmodul (26.09.2026, Nacharbeit Auftrag C) --");
{
  /**
   * DIE ALTE HAUPTMODUL-ERKENNUNG LIEF UNTER POSIX NIE.
   *
   * `import.meta.url === "file:///" + process.argv[1].replace(...)` baut
   * unter POSIX vier Slashes ("file:////home/...", weil `process.argv[1]`
   * dort schon mit einem fuehrenden Slash beginnt), `import.meta.url` liefert
   * aber drei ("file:///home/..."). Der ganze CLI-Block in beiden Dateien lief
   * dadurch NIE - und zwar STUMM: kein Fehler, keine Ausgabe, exit 0. Genau
   * das ist der gefaehrliche Fall: `node tools/ram.js --registry` sah aus wie
   * ein Aufruf, lieferte aber nichts, und ohne diesen Test waere das erst
   * aufgefallen, wenn jemand die (leere) Ausgabe tatsaechlich brauchte.
   *
   * Reine Funktionspruefung reicht hier nicht, weil der Fehler GENAU im
   * `if`, das den CLI-Block betritt, sass - ein echter Subprozess-Aufruf ist
   * der einzige Weg, das zu pruefen (dasselbe Muster wie
   * tools/test-ram-namen.js und tools/test-lader.js).
   */
  const laufe = (datei, args) => {
    try {
      return { code: 0, aus: execFileSync("node", [path.join(ROOT, "tools", datei), ...args],
        { encoding: "utf8", cwd: ROOT }) };
    } catch (e) {
      return { code: e.status ?? 1, aus: (e.stdout || "") + (e.stderr || "") };
    }
  };

  const reg = laufe("ram.js", ["--registry"]);
  pruefe("ram.js --registry gibt etwas aus (Hauptmodul-Erkennung greift)",
    reg.aus.includes("registry.json gegen den Rechner"),
    "Ausgabe war leer oder unerwartet: " + JSON.stringify(reg.aus.slice(0, 200)));
  pruefe("und meldet Erfolg (exit 0)", reg.code === 0, "exit " + reg.code);

  const kosten2 = laufe("ramkosten.js", ["hack"]);
  pruefe("ramkosten.js hack gibt etwas aus (Hauptmodul-Erkennung greift)",
    kosten2.aus.includes("hack"),
    "Ausgabe war leer oder unerwartet: " + JSON.stringify(kosten2.aus.slice(0, 200)));
  pruefe("und meldet Erfolg (exit 0)", kosten2.code === 0, "exit " + kosten2.code);
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
