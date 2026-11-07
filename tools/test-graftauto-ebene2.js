/**
 * Ebene 2: die Grafting-Automatik gegen den ns-Mock (Position C.14).
 *
 * ===========================================================================
 * WARUM EBENE 2 UND NICHT EBENE 0
 * ===========================================================================
 *
 * Die ENTSCHEIDUNG steckt in `lib/graftwahl.js` und ist dort ohne Spiel
 * geprueft (33 Proben, `tools/test-graftwahl.js`). Was hier geprueft wird, ist
 * das Drumherum, und das ist der Teil, an dem am 04.09. schon zweimal etwas
 * gebrochen ist:
 *
 *   - Liest das Gewerk seine Dateien richtig? (`ns.read` hat keinen
 *     Host-Parameter - eine Zeile mit `ns.read(datei, "home")` liefert still
 *     einen leeren String.)
 *   - Zaehlt es die Beschaeftigungsquote in der richtigen Uhr?
 *   - Erkennt es einen ABGEBROCHENEN Graft - die Zahl, die laut Abnahme null
 *     sein muss?
 *   - Startet es `graft.js` mit dem richtigen Argument?
 *
 * Keine dieser Fragen laesst sich an einer reinen Funktion stellen.
 *
 * Aufruf: node tools/test-graftauto-ebene2.js
 */

import fs from "node:fs";
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

const PLAN = {
  vorzug: { name: "Violet Congruity Implant", regel: "so frueh wie bezahlbar, VOR der Liste" },
  reihenfolge: ["Aug A", "Aug B", "Aug C"],
  anzahl: 3,
};
const MRD = 1e9;

/**
 * Faehrt `graftauto.js` eine begrenzte Zahl von Runden.
 *
 * Die Begrenzung geschieht ueber `ns.sleep`: nach N Aufrufen wirft es, und der
 * Wurf verlaesst die Endlosschleife. Das ist derselbe Griff wie in den
 * anderen Ebene-2-Tests - ein Gewerk, das `for(;;)` laeuft, laesst sich sonst
 * nicht aus Node heraus fahren.
 */
async function fahre(mock, modul, runden, jeRunde = null) {
  let n = 0;
  const echterSchlaf = mock.ns.sleep;
  mock.ns.sleep = async (ms) => {
    n++;
    if (jeRunde) jeRunde(n, mock);
    if (n >= runden) throw new Error("__ENDE__");
    return echterSchlaf(ms);
  };
  const zurueck = mock.uhrStellen();
  try {
    await modul.main(mock.ns);
  } catch (e) {
    if (!String(e.message).includes("__ENDE__")) throw e;
  } finally {
    zurueck();
  }
  return n;
}

console.log("");
console.log("=== Ebene 2: die Grafting-Automatik (C.14) ===");

const { modul, pfad } = await ladeAusBeiden(ROOT, "graftauto.js");
console.log("    " + path.relative(ROOT, pfad).replace(/\\/g, "/"));
pruefe("graftauto.js laesst sich laden", typeof modul.main === "function");

console.log("");
console.log("-- ohne Plan tut es gar nichts --");
{
  const m = neuerMock({});
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); } finally { zurueck(); }
  // `pruefe(..., true)` STAND HIER UND KONNTE NICHT ROT WERDEN (Skeptiker
  // Runde 4, R28). Haenge `main()`, wuerde der Test haengen statt zu
  // scheitern - die Probe erhoehte nur den Gruen-Zaehler.
  //
  // Was sich wirklich pruefen laesst: das Gewerk hat NICHT geschlafen. Ein
  // Einmallaeufer ohne Plan muss zurueckkehren, nicht in seine Rundenschleife
  // gehen.
  pruefe("es beendet sich sofort, ohne eine Runde zu schlafen",
    m.zustand.schlafZeiten.length === 0,
    m.zustand.schlafZeiten.length + " Schlafaufruf(e) - ohne Plan gibt es nichts zu warten");
  pruefe("kein graft.js gestartet", m.zustand.gestartet.length === 0);
  const t = JSON.parse(m.lies("home", "data/graftauto.json") || "{}");
  pruefe("und meldet den Grund", t.blockedReason === "kein Plan", t.blockedReason);
  pruefe("state ist 'done', nicht 'work'", t.state === "done", t.state);
}

console.log("");
console.log("-- der Vorzug kommt zuerst --");
{
  const m = neuerMock({
    geld: 500 * MRD,
    graftbar: ["Aug A", "Aug B", "Aug C", "Violet Congruity Implant"],
    graftPreise: { "Aug A": 1 * MRD, "Aug B": 2 * MRD, "Aug C": 3 * MRD,
      "Violet Congruity Implant": 150 * MRD },
    graftDauern: { "Aug A": 600000, "Aug B": 600000, "Aug C": 600000,
      "Violet Congruity Implant": 846000 },
  });
  m.lege("home", "graftplan.json", JSON.stringify(PLAN));
  // `ns.exec` gibt im Mock wie im Spiel 0 zurueck, wenn die Datei nicht auf
  // dem Zielrechner liegt. Ohne diese Zeile prueft der Test nicht die
  // Entscheidung, sondern die Ablage.
  m.lege("home", "graft.js", "// Platzhalter");
  await fahre(m, modul, 1);
  const start = m.zustand.gestartet.find((g) => g.datei === "graft.js");
  pruefe("graft.js wurde gestartet", !!start);
  pruefe("mit dem Vorzug als Argument",
    !!start && start.args[0] === "Violet Congruity Implant",
    start ? String(start.args[0]) : "gar nicht gestartet");
  pruefe("und auf home", !!start && start.host === "home",
    "graft.js braucht die Singularity-Familie, und im Kaltstart gibt es keine Werkbank");
}

console.log("");
console.log("-- bei zu wenig Geld GEHT ES WEITER, statt zu warten --");
{
  // KORRIGIERT am 04.09.2026 (Skeptiker Substanz). Hier stand das Gegenteil.
  //
  // Die alte Begruendung ("wer weitergeht, nimmt die Entropie fuer alle 38
  // Stuecke mit") ist falsch: applyEntropy rechnet ueber
  // reapplyAllAugmentations jedes Mal von Grund auf neu
  // (PlayerObjectAugmentationMethods.ts:8-25), das Endergebnis haengt nicht an
  // der Reihenfolge. Und Congruity kostet als Graft 150 Billionen gegen 0,42
  // Billionen fuer alle anderen zusammen - die alte Regel haette das Gewerk ab
  // der ersten Runde stillgelegt.
  const m = neuerMock({
    geld: 10 * MRD,
    graftbar: ["Aug A", "Violet Congruity Implant"],
    graftPreise: { "Aug A": 1 * MRD, "Violet Congruity Implant": 150 * MRD },
    graftDauern: { "Aug A": 600000, "Violet Congruity Implant": 846000 },
  });
  m.lege("home", "graftplan.json", JSON.stringify(PLAN));
  m.lege("home", "graft.js", "// Platzhalter");
  await fahre(m, modul, 1);
  const start = m.zustand.gestartet.find((g) => g.datei === "graft.js");
  pruefe("Aug A wird gestartet", !!start && start.args[0] === "Aug A",
    start ? String(start.args[0]) : "gar nicht gestartet");
  const t = JSON.parse(m.lies("home", "data/graftauto.json") || "{}");
  pruefe("state ist 'wait', nicht 'blocked'", t.state === "wait", t.state);
  pruefe("und der Grund nennt trotzdem, warum der Vorzug ausfiel",
    /Violet Congruity/.test(t.grund || ""), t.grund);
}

console.log("");
console.log("-- ein laufender Graft wird nicht gestoert --");
{
  const m = neuerMock({
    geld: 500 * MRD,
    graftbar: ["Aug A", "Violet Congruity Implant"],
    graftPreise: { "Aug A": 1 * MRD, "Violet Congruity Implant": 150 * MRD },
    graftDauern: { "Aug A": 600000, "Violet Congruity Implant": 846000 },
    arbeit: { type: "GRAFTING", augmentation: "Aug A" },
  });
  m.lege("home", "graftplan.json", JSON.stringify(PLAN));
  await fahre(m, modul, 1);
  pruefe("nichts Neues gestartet",
    m.zustand.gestartet.filter((g) => g.datei === "graft.js").length === 0);
  const t = JSON.parse(m.lies("home", "data/graftauto.json") || "{}");
  pruefe("state ist 'work'", t.state === "work", t.state);
  pruefe("und das laufende Stueck steht drin", t.laeuft === "Aug A", String(t.laeuft));
}

console.log("");
console.log("-- ein ABBRUCH wird erkannt und gezaehlt --");
{
  // Die Abnahmebedingung lautet `graft_aborted = 0`. Eine Zahl, die niemand
  // zaehlt, ist immer null - deshalb ist dieser Test der eigentliche Zweck
  // der ganzen Datei.
  const m = neuerMock({
    geld: 500 * MRD,
    graftbar: ["Aug A", "Aug B"],
    graftPreise: { "Aug A": 1 * MRD, "Aug B": 2 * MRD },
    graftDauern: { "Aug A": 600000, "Aug B": 600000 },
    arbeit: { type: "GRAFTING", augmentation: "Aug A" },
  });
  m.lege("home", "graftplan.json", JSON.stringify({ ...PLAN, vorzug: null }));
  // Runde 1: Aug A laeuft. Runde 2: es laeuft nichts mehr, aber Aug A steht
  // noch auf der Liste der graftbaren - also wurde es abgebrochen, nicht
  // fertig. Ein fertiges Graft verschwindet aus der Liste, weil
  // hasAugmentation auch fuer eingereihte Stuecke sofort greift.
  await fahre(m, modul, 2, (n, mm) => { if (n === 1) mm.zustand.arbeit = null; });
  const t = JSON.parse(m.lies("home", "data/graftauto.json") || "{}");
  pruefe("graft_aborted ist 1", t.graft_aborted === 1, String(t.graft_aborted));

  const strom = JSON.parse(m.lies("home", "data/events.json") || '{"eintraege":[]}');
  pruefe("und es steht im Ereignisstrom",
    strom.eintraege.some((e) => /graft_aborted: Aug A/.test(e.text || "")),
    "die eigene Telemetrie wird ueberschrieben - ein Abbruch von heute Nacht"
      + " waere morgen frueh nicht mehr auffindbar");
}

console.log("");
console.log("-- ein FERTIGES Graft ist kein Abbruch --");
{
  const m = neuerMock({
    geld: 500 * MRD,
    graftbar: ["Aug A", "Aug B", "Aug C"],
    graftPreise: { "Aug A": 1 * MRD, "Aug B": 2 * MRD, "Aug C": 3 * MRD },
    graftDauern: { "Aug A": 600000, "Aug B": 600000, "Aug C": 600000 },
    arbeit: { type: "GRAFTING", augmentation: "Aug A" },
  });
  m.lege("home", "graftplan.json", JSON.stringify({ ...PLAN, vorzug: null }));
  m.lege("home", "graft.js", "// Platzhalter");
  await fahre(m, modul, 2, (n, mm) => {
    if (n === 1) {
      mm.zustand.arbeit = null;
      // Fertig heisst: es ist nicht mehr graftbar.
      mm.zustand.graftbar = ["Aug B", "Aug C"];
    }
  });
  const t = JSON.parse(m.lies("home", "data/graftauto.json") || "{}");
  pruefe("graft_aborted bleibt 0", t.graft_aborted === 0, String(t.graft_aborted));
  pruefe("und der Fortschritt zaehlt es mit", t.nichtOffen === 1, String(t.nichtOffen));

  // DIE GRENZE DIESER ZAHL, ausdruecklich geprueft: ein Stueck, das mangels
  // Fraktionsmitgliedschaft gar nicht graftbar IST, sieht von aussen genauso
  // aus wie ein fertiges. Deshalb heisst das Feld `nichtOffen` und nicht
  // `fertig` - wer es als Fortschritt liest, liest zu optimistisch.
  const m2 = neuerMock({
    geld: 500 * MRD,
    graftbar: ["Aug B"],            // A und C sind gesperrt, nicht fertig
    graftPreise: { "Aug B": 2 * MRD },
    graftDauern: { "Aug B": 600000 },
  });
  m2.lege("home", "graftplan.json", JSON.stringify({ ...PLAN, vorzug: null }));
  m2.lege("home", "graft.js", "// Platzhalter");
  await fahre(m2, modul, 1);
  const t2 = JSON.parse(m2.lies("home", "data/graftauto.json") || "{}");
  pruefe("gesperrte Stuecke zaehlen als 'nichtOffen', nicht als Fehler",
    t2.nichtOffen === 2 && t2.offen === 1,
    "nichtOffen " + t2.nichtOffen + ", offen " + t2.offen);
}

console.log("");
console.log("-- die Beschaeftigungsquote laeuft in MOTORZEIT --");
{
  // Im gedrosselten Tab laeuft die Wanduhr weiter, waehrend das Spiel steht.
  // Eine Quote in Wanduhr waere dort systematisch zu niedrig und saehe aus wie
  // Leerlauf - genau die Sorte Zahl, die eine Strafe ausloest, wo keine
  // hingehoert.
  const m = neuerMock({
    geld: 500 * MRD,
    graftbar: ["Aug A"],
    graftPreise: { "Aug A": 1 * MRD },
    graftDauern: { "Aug A": 600000 },
    arbeit: { type: "GRAFTING", augmentation: "Aug A" },
  });
  m.lege("home", "graftplan.json", JSON.stringify({ ...PLAN, vorzug: null }));
  m.lege("home", "data/bn4net.json", JSON.stringify({ motorTimeMs: 0 }));
  // Drei Runden: die Motorzeit waechst um je 60 s, das Graft laeuft durch.
  await fahre(m, modul, 4, (n, mm) => {
    mm.lege("home", "data/bn4net.json", JSON.stringify({ motorTimeMs: n * 60000 }));
    // Die Wanduhr springt viel weiter - so sieht ein gedrosselter Tab aus.
    mm.zustand.wall += 10 * 60000;
  });
  const t = JSON.parse(m.lies("home", "data/graftauto.json") || "{}");
  pruefe("graft_busy_pct ist 100", t.graft_busy_pct === 100,
    String(t.graft_busy_pct) + " - in Wanduhr waeren es rund 10 Prozent gewesen");
}

console.log("");
console.log("-- ohne Grafting-Zugriff ist es ein ZUSTAND, kein Fehler --");
{
  const m = neuerMock({
    geld: 500 * MRD,
    graftingZugriff: false,
  });
  m.lege("home", "graftplan.json", JSON.stringify(PLAN));
  await fahre(m, modul, 2);
  const t = JSON.parse(m.lies("home", "data/graftauto.json") || "{}");
  pruefe("state ist 'wait'", t.state === "wait", t.state);
  pruefe("errStreak bleibt 0", t.errStreak === 0,
    "kein Zugriff heisst keine Bladeburners-Mitgliedschaft - das ist normal,"
      + " und eine Fehlerserie wuerde die Strafleiter speisen");
}

// AUFLAGEN DES SKEPTIKERS VOR DER ZUENDUNG IN BN15 (07.11.2026).
const PLAN3 = { reihenfolge: ["Aug A", "Aug B", "Aug C"], anzahl: 3 };

console.log("");
console.log("-- erster Eintrag zu teuer: der naechste bezahlbare kommt dran --");
{
  const m = neuerMock({
    geld: 20 * MRD,
    graftbar: ["Aug A", "Aug B", "Aug C"],
    graftPreise: { "Aug A": 50 * MRD, "Aug B": 2 * MRD, "Aug C": 3 * MRD },
    graftDauern: { "Aug A": 600000, "Aug B": 600000, "Aug C": 600000 },
    ramBuchen: false,
  });
  m.lege("home", "graftplan.json", JSON.stringify(PLAN3));
  m.lege("home", "graft.js", "// Platzhalter");
  await fahre(m, modul, 1);
  const start = m.zustand.gestartet.find((g) => g.datei === "graft.js");
  pruefe("Aug B statt Warten auf Aug A", !!start && start.args[0] === "Aug B",
    start ? String(start.args[0]) : "gar nicht gestartet");
}

console.log("");
console.log("-- zwei Fehlversuche am ersten Eintrag: die Kette laeuft weiter --");
{
  const m = neuerMock({
    geld: 20 * MRD,
    graftbar: ["Aug A", "Aug B", "Aug C"],
    graftPreise: { "Aug A": 1 * MRD, "Aug B": 2 * MRD, "Aug C": 3 * MRD },
    graftDauern: { "Aug A": 600000, "Aug B": 600000, "Aug C": 600000 },
    ramBuchen: false,
  });
  m.lege("home", "graftplan.json", JSON.stringify(PLAN3));
  m.lege("home", "graft.js", "// Platzhalter");
  const fehl = (zeit) => m.lege("home", "data/graft.json", JSON.stringify({
    wunsch: "Aug A", getan: "NICHT gestartet", fehler: "Rueckgabe false - Voraussetzung fehlt", zeit }));
  // Die Mock-Uhr steht, solange niemand sie vorrueckt: je Runde 60 s, wie im Spiel.
  // graft.js meldet nach Runde 1 und 2 je einen Fehlversuch fuer Aug A.
  await fahre(m, modul, 6, (n) => { m.vor(60000); if (n <= 2) fehl(Date.now()); });
  const b = m.zustand.gestartet.find((g) => g.datei === "graft.js" && g.args[0] === "Aug B");
  const t = JSON.parse(m.lies("home", "data/graftauto.json") || "{}");
  pruefe("nach dem zweiten Fehlversuch wird Aug B gestartet", !!b,
    "gestartet: " + m.zustand.gestartet.map((g) => g.args[0]).join(", ") + " / Grund: " + t.grund);
}

console.log("");
console.log("-- zwei Figur-Absagen ueberspringen das Stueck NICHT --");
{
  const m = neuerMock({
    geld: 20 * MRD,
    graftbar: ["Aug A", "Aug B", "Aug C"],
    graftPreise: { "Aug A": 1 * MRD, "Aug B": 2 * MRD, "Aug C": 3 * MRD },
    graftDauern: { "Aug A": 600000, "Aug B": 600000, "Aug C": 600000 },
    ramBuchen: false,
  });
  m.lege("home", "graftplan.json", JSON.stringify(PLAN3));
  m.lege("home", "graft.js", "// Platzhalter");
  const absage = (zeit) => m.lege("home", "data/graft.json", JSON.stringify({
    wunsch: "Aug A", getan: "NICHT gestartet", fehler: "Figur nicht freigegeben: Figur gehoert gerade x", zeit }));
  await fahre(m, modul, 6, (n) => { m.vor(60000); if (n <= 2) absage(Date.now()); });
  const b = m.zustand.gestartet.find((g) => g.datei === "graft.js" && g.args[0] === "Aug B");
  const a = m.zustand.gestartet.filter((g) => g.datei === "graft.js" && g.args[0] === "Aug A").length;
  pruefe("Aug A wird erneut versucht, Aug B nicht vorgezogen", !b && a >= 2,
    "gestartet: " + m.zustand.gestartet.map((g) => g.args[0]).join(", "));
}

console.log("");
console.log("-- kein Doppelstart, solange graft.js noch auf die Figur wartet --");
{
  const m = neuerMock({
    geld: 20 * MRD,
    graftbar: ["Aug A", "Aug B"],
    graftPreise: { "Aug A": 1 * MRD, "Aug B": 2 * MRD },
    graftDauern: { "Aug A": 600000, "Aug B": 600000 },
    // Im Spiel hat home Platz fuer zwei graft.js - der Mock-Standard (32 GB)
    // wuerde den zweiten Start schon am RAM scheitern lassen.
    ramBuchen: false,
  });
  m.lege("home", "graftplan.json", JSON.stringify(PLAN3));
  m.lege("home", "graft.js", "// Platzhalter");
  await fahre(m, modul, 2);
  const n = m.zustand.gestartet.filter((g) => g.datei === "graft.js").length;
  pruefe("zwei Runden ohne laufenden Graft: graft.js nur einmal gestartet", n === 1, n + " Starts");
}

console.log("");
console.log("-- Graften ohne Fokus, Neuroreceptor zuerst --");
{
  const g = fs.readFileSync(path.join(ROOT, "src", "graft.js"), "utf8");
  pruefe("graft.js startet ohne Fokus", /graftAugmentation\(wunsch, false\)/.test(g));
  const plan = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "graftplan.json"), "utf8"));
  pruefe("graftplan.json: Neuroreceptor Management Implant steht vorn",
    plan.reihenfolge[0] === "Neuroreceptor Management Implant", String(plan.reihenfolge[0]));
}

console.log("");
console.log("-- keine .mock-Datei bleibt liegen --");
{
  const src = fs.existsSync(path.resolve(ROOT, "..", "bitburner-bau", "src"))
    ? path.resolve(ROOT, "..", "bitburner-bau", "src")
    : path.join(ROOT, "src");
  const reste = fs.readdirSync(src).filter((f) => f.startsWith(".mock-"));
  pruefe("src/ ist sauber", reste.length === 0,
    "liegengeblieben: " + reste.join(", ")
      + " - so etwas ginge ueber die Bruecke ins laufende Spiel");
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
