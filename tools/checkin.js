/**
 * Der Check-in: die vier Fragen, die man alle paar Tage stellt.
 *
 * WARUM ES DIESES WERKZEUG GIBT
 *
 * Bis zum 31.08.2026 lief der Bot unter sechs Claude-Loops, die rund um die
 * Uhr prueften, optimierten und eingriffen. Das war teuer und setzte voraus,
 * dass eine Sitzung dauerhaft offen steht. Erics Umstellung an dem Tag:
 * Bitburner laeuft, wenn er am Rechner sitzt, und er kommt alle paar Tage mit
 * einer Frage vorbei - nicht mit einem Loop.
 *
 * Damit dieser Besuch billig bleibt, rechnet dieses Werkzeug, was sich
 * rechnen laesst, und ueberlaesst der KI nur das Urteil. Alles hier ist
 * deterministisch und kostet keine Token.
 *
 * DIE UHR IST DIE SPIELZEIT, NICHT DIE WANDUHR
 *
 * Das ist der Grund, warum dieses Werkzeug ueberhaupt eigenen Code braucht.
 * Steht der Rechner nachts aus, vergehen zwoelf Kalenderstunden, in denen der
 * Bot nichts tut. Eine Rate aus `Date.now()` waere dann um Faktor drei zu
 * niedrig und meldete "off track", wo in Wahrheit nur niemand gespielt hat.
 * `ns.getPlayer().totalPlaytime` (in `data/blade.json` als `spielzeit`) laeuft
 * nur, solange das Spiel laeuft - alle Raten hier haengen daran.
 *
 * Aufruf:  node tools/checkin.js            Bericht im Klartext
 *          node tools/checkin.js --json     dasselbe als JSON
 *          node tools/checkin.js --kein-stand   Verlauf nicht fortschreiben
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { restzeitAusKurve, naechsterMeilenstein, vergleichMitReferenz } from "./lib/rangkurve.js";

const BRIDGE = "http://localhost:8795";
const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const STAND_DATEI = path.join(ROOT, "data", "checkin.json");

// Der Ausgang aus einem Kampfknoten: 21 Black Ops, die letzte ist Operation
// Daedalus mit reqdRank 400.000 (`Bladeburner/data/BlackOperations.ts:708`).
const BLACKOPS_GESAMT = 21;
const DAEDALUS_RANG = 400000;
// Was unterwegs aus den rankGain-Werten der ersten zwanzig Black Ops anfaellt
// und deshalb nicht erarbeitet werden muss (Summe aller 21 = 113.660, davon
// Daedalus selbst 40.000).
const RANG_UNTERWEGS = 73660;
// Der Rang je Aktion skaliert mit BladeburnerRank des Knotens
// (Bladeburner/Formulas.ts:22-25), die 400.000 von Daedalus NICHT. Die
// 73.660 aus den Black Ops kommen also nur mit diesem Faktor an
// (BitNode.tsx: BN7 0,6, BN8 0, BN9 0,9, BN10 0,8, BN13 0,45, BN14 0,6,
// BN15 0,2; alle anderen 1). Ohne den Faktor war die ETA in BN10 um
// 14.732 Rang zu optimistisch (Zahlen-Skeptiker 02.09.).
const BB_RANK_MULT = { 7: 0.6, 8: 0, 9: 0.9, 10: 0.8, 13: 0.45, 14: 0.6, 15: 0.2 };
// Aelter als das, und die Telemetrie beschreibt nicht die Gegenwart. Grosszuegig,
// weil ein gedrosselter Tab die Schreibtakte streckt.
const FRISCH_MS = 8 * 60000;
// Kuerzeste Spanne, aus der eine Rangrate gerechnet werden darf - in SPIELZEIT.
// Die Rangrate schwankt mit dem Ausdauerzyklus; ein kurzes Fenster misst dessen
// Phase, nicht die Rate. Ohne diese Schranke lieferte ein Testlauf am 31.08.
// aus 0 Minuten Abstand eine Rate von 3.287/h - plausibel aussehender Unsinn.
const MIN_FENSTER_MS = 45 * 60000;

const args = process.argv.slice(2);
const alsJson = args.includes("--json");
const standSchreiben = !args.includes("--kein-stand");

async function hole(datei) {
  const url = new URL("/api/rpc", BRIDGE);
  url.searchParams.set("method", "getFile");
  url.searchParams.set("filename", datei);
  url.searchParams.set("server", "home");
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    const j = await r.json();
    if (typeof j.result !== "string" || j.result === "") return null;
    return j.result;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function holeJson(datei) {
  const roh = await hole(datei);
  if (!roh) return null;
  try { return JSON.parse(roh); } catch { return null; }
}

const std = (ms) => ms / 3600000;
const zahl = (n, k = 0) => Number(n).toLocaleString("de-DE", { maximumFractionDigits: k });
const dauer = (h) => {
  if (!Number.isFinite(h) || h < 0) return "?";
  if (h < 1) return Math.round(h * 60) + " min";
  if (h < 48) return h.toFixed(1) + " h";
  return (h / 24).toFixed(1) + " Tage";
};

function liesStand() {
  try { return JSON.parse(fs.readFileSync(STAND_DATEI, "utf8")); } catch { return { punkte: [] }; }
}

async function main() {
  const zeilen = [];
  const sag = (t) => zeilen.push(t);
  const bericht = { zeit: Date.now() };

  // --- 1. Ist ueberhaupt etwas zu sehen? -----------------------------------
  const blade = await holeJson("data/blade.json");
  const lage = await holeJson("data/bblage.json");
  const netz = await holeJson("data/bn4net.json");
  const hilfe = await hole("data/hilfe.txt");
  // Seit dem 02.09.2026 entscheidet ausgang.js ueber den Sprung; seine
  // Telemetrie ist die erste Quelle fuer "wo stehen wir" und "ist der
  // Ausgang offen". data/verfahren.txt sagt, ob der Knoten ueber Bladeburner
  // (V2) oder Hacking (V1) laeuft - in V1-Knoten gibt es keinen Rang.
  const ausgang = await holeJson("data/ausgang.json");
  // Sleeves holen einen Rueckstand mit 15-facher Geschwindigkeit nach
  // (Sleeve.ts:263-275). Waehrenddessen ist jede gemessene Rate ein
  // Bestand, keine Rate - sleeve.js schreibt den Rueckstand je Sleeve.
  const sleeveDatei = await holeJson("data/sleeve.json");
  const sleeveRueckstandS = (() => {
    try {
      if (!sleeveDatei || Date.now() - Number(sleeveDatei.zeit || 0) > 10 * 60000) return 0;
      return Math.max(0, ...(sleeveDatei.sleeves || []).map((x) => Number(x.stored || 0) / 5));
    } catch { return 0; }
  })();
  const ausgangTxt = (await hole("data/ausgang.txt")) || "";
  const verfahrenTxt = ((await hole("data/verfahren.txt")) || "").trim().split(/\s+/);

  if (!blade && !lage && !netz && !ausgang) {
    sag("Keine Telemetrie. Entweder laeuft die Bruecke nicht (node sync/bridge.js)");
    sag("oder das Spiel ist zu. Beides ist von hier aus nicht zu unterscheiden.");
    sag("URTEIL: BLIND");
    return ausgeben(zeilen, { ...bericht, urteil: "BLIND" });
  }

  // DIE FRISCHESTE QUELLE ENTSCHEIDET, NICHT DIE ERSTE (01.09.2026).
  //
  // Hier stand `blade || lage || netz`. Nach dem BitNode-Wechsel um 15:59
  // schrieb blade.js nicht mehr - `prestigeSourceFile` beendet jedes Skript -,
  // aber seine letzte Datei war vier Minuten alt und galt damit als frisch.
  // Der Bericht meldete Rang 4.561.258 und den alten Knoten, waehrend der
  // Motor drueben laengst bei Geld $1.262 und Runde 27 stand. Wer die alte
  // Datei liest, sieht den alten Knoten - und haelt einen geglueckten Wechsel
  // fuer einen gescheiterten.
  const alterVon = (d) => (d ? Date.now() - Number(d.zeit || 0) : Infinity);
  const quelle = [blade, lage, netz, ausgang].filter(Boolean)
    .sort((a, b) => alterVon(a) - alterVon(b))[0];
  const alter = alterVon(quelle);
  const knoten = Number((ausgang || netz || lage || {}).knoten) || null;

  // Einzelne Dateien koennen weit aelter sein als die frischeste. Sie dann
  // stillschweigend mitzulesen erzeugt genau den Mischbericht von oben:
  // Rang aus gestern, Geld von heute.
  const VERALTET_MS = 3 * 60000;
  const bladeFrisch = alterVon(blade) <= Math.max(VERALTET_MS, alter * 3);
  if (blade && !bladeFrisch) {
    sag("Hinweis: data/blade.json ist " + dauer(std(alterVon(blade)))
      + " alt und wird ignoriert (laeuft blade.js?). Rang und Black-Ops-Liste"
      + " stehen deshalb nicht zur Verfuegung.");
  }
  bericht.knoten = knoten;
  bericht.telemetrieAlterMin = +(alter / 60000).toFixed(1);

  if (alter > FRISCH_MS) {
    sag("Telemetrie ist " + dauer(std(alter)) + " alt (Knoten " + (knoten ?? "?") + ").");
    sag("Das Spiel lief zuletzt vor " + dauer(std(alter)) + " - vermutlich einfach zu.");
    sag("Zum Weiterspielen: Bitburner-Tab oeffnen, der Bot laeuft von selbst an.");
    sag("URTEIL: SPIEL ZU");
    return ausgeben(zeilen, { ...bericht, urteil: "SPIEL ZU" });
  }

  // --- 1b. Der Ausgang: laeuft ausgang.js, und was sagt es? ---------------
  const ausgangGut = ausgang && alterVon(ausgang) <= Math.max(VERALTET_MS, alter * 3) ? ausgang : null;
  const verfahren = (Number(verfahrenTxt[1]) === knoten && ["V1", "V1b", "V2"].includes(verfahrenTxt[0]))
    ? verfahrenTxt[0] : (ausgangGut ? ausgangGut.verfahren : null);
  const hackingweg = verfahren === "V1" || verfahren === "V1b";
  bericht.verfahren = verfahren;
  if (ausgangGut) {
    const l = ausgangGut.lauf, z = ausgangGut.ziel;
    sag("BitNode " + knoten + (l ? " Lauf " + l.level : "") + (verfahren ? " (" + verfahren + ")" : "")
      + (z ? ", Ziel danach BitNode " + z.node + " Stufe " + z.level : ", kein Ziel mehr in der Route") + ".");
    for (const u of ausgangGut.uebersprungen || []) {
      sag("Hinweis: BitNode " + u.node + " Stufe " + u.level + " wird uebersprungen - " + u.braucht + " fehlt auf home.");
    }
    bericht.ausgang = { offen: ausgangGut.offen, ziel: z, letzterStart: ausgangGut.letzterStart, status: ausgangGut.status };
  } else {
    sag("ACHTUNG: data/ausgang.json ist " + (ausgang ? dauer(std(alterVon(ausgang))) + " alt" : "nicht da")
      + " - ausgang.js laeuft nicht. Ohne dieses Skript springt am Ende des Knotens NIEMAND."
      + " Starten: node tools/task.js ausgang.js");
    bericht.ausgangFehlt = true;
  }

  // --- 2. Hat der Bot selbst um Hilfe gerufen? -----------------------------
  if (hilfe && hilfe.trim()) {
    sag("Der Bot hat data/hilfe.txt geschrieben:");
    for (const z of hilfe.trim().split("\n").slice(0, 6)) sag("  " + z);
    bericht.hilfe = hilfe.trim();
  }

  // --- 3. Steht der Ausgang offen? -----------------------------------------
  //
  // Im Kampfknoten fuehrt er ueber 21 Black Ops. `boChancen` listet die noch
  // OFFENEN - ist die Liste leer, sind alle durch und der Knoten ist fertig.
  // Beide werden schon vom Reset-Zweig weiter unten gebraucht (ueber
  // `ausgeben`), muessen also VOR ihm stehen - sonst greift die Funktion in
  // die temporale Todeszone und stuerzt genau im wichtigsten Fall ab.
  const bladeGut = bladeFrisch ? blade : null;
  const spielzeit = Number((bladeGut || {}).spielzeit);
  const stand = liesStand();
  const punkte = Array.isArray(stand.punkte) ? stand.punkte : [];

  const rang = Number((bladeGut || {}).rang ?? (alterVon(lage) <= VERALTET_MS ? lage.rang : NaN));
  // `naechsteBlackOp === null` ist das eigentliche Signal: `getNextBlackOp()`
  // gibt null zurueck, wenn keine offene mehr da ist. Die Liste `boChancen`
  // taugt dafuer NICHT - blade.js schreibt bei null offenen Ops ebenfalls
  // `null` statt eines leeren Objekts (`blade.js:1857`), also konnte
  // `offeneBo === 0` nie eintreten. Am 01.09. fing nur das Sicherheitsnetz
  // den fertigen Knoten ab; ohne das waere er unbemerkt geblieben.
  const offeneBo = bladeGut && bladeGut.boChancen
    ? Object.keys(bladeGut.boChancen).length : null;
  const alleBoDurch = bladeGut ? bladeGut.naechsteBlackOp === null : null;
  const inBb = alterVon(lage) <= VERALTET_MS ? lage.inBladeburner === true : null;
  bericht.rang = Number.isFinite(rang) ? rang : null;
  bericht.offeneBlackOps = offeneBo;

  let resetBereit = false;
  if (bladeGut && alleBoDurch && Number.isFinite(rang) && rang > 0) resetBereit = true;

  // SICHERHEITSNETZ (31.08.2026). `boChancen` ist auch dann null, wenn
  // `blade.js` gerade nicht laeuft - direkt nach einem Augmentierungs-Einbau
  // etwa, wo genau das beobachtet wurde. Ein fertiger Knoten saehe dann aus
  // wie ein unbekannter, und der teuerste Moment des Laufs ginge stillschweigend
  // vorbei. Der Rang laesst sich nicht wegdiskutieren: Wer die 400.000 von
  // Daedalus hat, ist am Ausgang oder einen Schritt davor.
  const rangReicht = Number.isFinite(rang) && rang >= DAEDALUS_RANG;
  if (rangReicht && !resetBereit) {
    sag("ACHTUNG: Rang " + zahl(rang) + " liegt ueber den " + zahl(DAEDALUS_RANG)
      + " von Operation Daedalus, aber die Liste der offenen Black Ops ist"
      + " nicht lesbar (laeuft blade.js?). Der Knoten koennte fertig sein -"
      + " im Spiel nachsehen, bevor du weiterspielst.");
    bericht.rangReichtOhneListe = true;
  }

  // DER SPRUNG IST SACHE VON ausgang.js (02.09.2026). Hier wird nur noch
  // gelesen, ob er laeuft, klemmt oder an einem fehlenden Gewerk haengt.
  const letzteAusgangZeile = ausgangTxt.trim().split("\n").pop() || "";
  if (ausgangGut && ausgangGut.offen) {
    // EIN ABGELEHNTER SPRUNG IST KEIN LAUFENDER (Skeptiker 04.09.2026).
    //
    // Seit exit.js sein Ziel gegen die Route prueft, kann es den Sprung
    // ABLEHNEN - und tut das dann alle 15 Minuten aufs Neue. `letzterStart`
    // wird bei jedem dieser Versuche gesetzt, auch wenn das Skript sofort
    // wieder aussteigt. Ohne die Unterscheidung meldete diese Stelle einen
    // Bot, der seit Tagen nicht vom Fleck kommt, als "URTEIL: SPRINGT".
    if (Number.isFinite(ausgangGut.exit_abgelehnt) && ausgangGut.exit_abgelehnt > 0) {
      sag("AUSGANG OFFEN, ABER exit.js LEHNT AB - " + ausgangGut.exit_abgelehnt
        + " Mal in Folge.");
      sag("Grund: " + (ausgangGut.exit_ablehnung_grund || letzteAusgangZeile));
      sag("Das ist KEIN laufender Sprung. Entweder passen route.json und der"
        + " Spielstand nicht zusammen, oder eine Datei fehlt auf dem Wirt.");
      sag("");
      sag("FERTIG VORAUSSICHTLICH: gar nicht, solange die Ablehnung steht.");
      sag("URTEIL: BLOCKIERT");
      return ausgeben(zeilen, { ...bericht, urteil: "BLOCKIERT" });
    }
    if (ausgangGut.letzterStart > 0) {
      sag("AUSGANG OFFEN (" + ausgangGut.status + ") - exit.js gestartet vor "
        + dauer(std(Date.now() - ausgangGut.letzterStart)) + ". Letzte Zeile: " + letzteAusgangZeile);
      sag("In einer Minute erneut messen: steht dann der neue Knoten, ist der Wechsel geglueckt.");
      sag("");
      sag("FERTIG VORAUSSICHTLICH: jetzt - der Sprung laeuft.");
      sag("URTEIL: SPRINGT");
      return ausgeben(zeilen, { ...bericht, urteil: "SPRINGT" });
    }
    if (!ausgangGut.ziel) {
      sag("AUSGANG OFFEN, aber kein Ziel: " + letzteAusgangZeile);
      sag("");
      sag("FERTIG VORAUSSICHTLICH: der Knoten ist fertig - es fehlt das Gewerk fuer den naechsten.");
      sag("URTEIL: GEWERK FEHLT");
      return ausgeben(zeilen, { ...bericht, urteil: "GEWERK FEHLT" });
    }
    sag("AUSGANG OFFEN (" + ausgangGut.status + "), aber exit.js ist nicht gestartet. Letzte Zeile: " + letzteAusgangZeile);
    if (ausgangGut.wirtFehlt) sag("Kein Rechner fuer exit.js (" + Number(ausgangGut.wirtFehlt.braucht).toFixed(1)
      + " GB): bester Wirt " + ausgangGut.wirtFehlt.besterWirt + " mit "
      + Number(ausgangGut.wirtFehlt.moeglich || 0).toFixed(1) + " GB. Groesserer Rechner oder home-Ausbau noetig.");
    sag("");
    sag("FERTIG VORAUSSICHTLICH: jetzt - sobald exit.js Platz findet.");
    sag("URTEIL: SPRUNG KLEMMT");
    return ausgeben(zeilen, { ...bericht, urteil: "SPRUNG KLEMMT" });
  }
  if (resetBereit && !ausgangGut) {
    sag("AUSGANG OFFEN: alle " + BLACKOPS_GESAMT + " Black Ops sind durch"
      + (Number.isFinite(rang) ? " (Rang " + zahl(rang) + ")" : "") + " - aber ausgang.js laeuft nicht, also springt niemand.");
    sag("");
    sag("FERTIG VORAUSSICHTLICH: jetzt - sobald ausgang.js laeuft (node tools/task.js ausgang.js).");
    sag("URTEIL: AUSGANG FEHLT");
    return ausgeben(zeilen, { ...bericht, urteil: "AUSGANG FEHLT" });
  }

  // --- 4. Wie weit ist es noch, gemessen in Spielzeit? ---------------------
  // Nur Punkte aus demselben Knotenlauf vergleichen - nach einem Knotenwechsel
  // faengt der Rang wieder bei null an, und eine Rate darueber hinweg waere
  // Unsinn.
  // Der juengste Punkt, der WEIT GENUG zurueckliegt - nicht einfach der
  // juengste. Sonst vergleicht ein zweiter Aufruf kurz nach dem ersten gegen
  // ein Fenster von Sekunden.
  // DERSELBE KNOTEN IST NICHT DERSELBE LAUF (03.09.2026): BN10 wird dreimal
  // gespielt; ohne den Lauf im Punkt rechnete die Schlusszeile mit der Rate
  // aus Lauf 1 und meldete "fertig in 1,6 h" bei Rang 35.
  const laufJetzt = ausgangGut && ausgangGut.lauf ? Number(ausgangGut.lauf.level) : null;
  const gleicherLauf = (p) => p.knoten === knoten && (laufJetzt === null || p.lauf === laufJetzt);
  const vorher = [...punkte].reverse().find((p) =>
    gleicherLauf(p) && Number.isFinite(p.rang) && Number.isFinite(p.spielzeit)
    && spielzeit - p.spielzeit >= MIN_FENSTER_MS && p.rang <= rang);
  // Gibt es Punkte, aber keinen alten genug, ist das eine andere Aussage als
  // "erster Check-in" - und Eric soll den Unterschied sehen.
  const juengster = [...punkte].reverse().find((p) =>
    gleicherLauf(p) && Number.isFinite(p.spielzeit) && Number.isFinite(p.rang));

  // FRISCHER KNOTEN: noch kein Bladeburner, also auch kein Rang (01.09.2026).
  // Direkt nach einem Knotenwechsel steht der Spieler bei Hacking 8 und $1.262;
  // die Division ist erst nach dem Kampfwerttraining offen. Ohne diesen Zweig
  // rechnete die Schlusszeile mit `restNetto = NaN` und stuerzte in
  // `new Date(NaN).toISOString()` ab - ausgerechnet im ersten Lauf des neuen
  // Knotens.
  // HACKINGWEG (V1): kein Rang, der Traeger ist das Hacking-Level gegen
  // w0r1d_d43m0n. ausgang.js liefert den Stand in `status`.
  if (hackingweg) {
    sag("Hackingweg: " + (ausgangGut ? ausgangGut.status : "kein Stand (ausgang.js laeuft nicht)")
      + (netz && Number.isFinite(Number(netz.hacking)) ? "; Hacking laut Netz " + netz.hacking : "") + ".");
    if (netz) sag("Netz: " + (netz.gerootet ?? "?") + "/" + (netz.netz ?? "?")
      + " gerootet, Runde " + (netz.runde ?? "?") + ", Geld $" + zahl(netz.geld ?? 0) + ".");
    sag("");
    sag("FERTIG VORAUSSICHTLICH: noch nicht schaetzbar - fuer den Hackingweg gibt es hier"
      + " noch keine Rate (Level gegen Ziel steht oben).");
    const u = bericht.hilfe ? "HILFE" : bericht.ausgangFehlt ? "AUSGANG FEHLT" : "HACKINGWEG";
    sag("URTEIL: " + u);
    return ausgeben(zeilen, { ...bericht, urteil: u });
  }

  if (!Number.isFinite(rang)) {
    sag("BitNode " + (knoten ?? "?") + ": kein Bladeburner-Rang messbar - der"
      + " Knoten ist frisch, die Division noch nicht offen.");
    if (netz) sag("Netz: " + (netz.gerootet ?? "?") + "/" + (netz.netz ?? "?")
      + " gerootet, Runde " + (netz.runde ?? "?") + ", Geld $" + zahl(netz.geld ?? 0) + ".");
    sag("");
    sag("FERTIG VORAUSSICHTLICH: noch nicht schaetzbar - bis zur Aufnahme in die"
      + " Bladeburner-Division traegt das Kampfwerttraining, nicht der Rang."
      + " `node tools/tor.js` rechnet diese Phase aus; danach steht die Zahl"
      + " hier wieder.");
    const u = bericht.hilfe ? "HILFE" : bericht.ausgangFehlt ? "AUSGANG FEHLT" : "ANLAUF";
    sag("URTEIL: " + u);
    return ausgeben(zeilen, { ...bericht, urteil: u });
  }

  sag("BitNode " + (knoten ?? "?") + ", Rang " + zahl(rang) + " von " + zahl(DAEDALUS_RANG)
    + " = " + (rang / DAEDALUS_RANG * 100).toFixed(2) + " %"
    + (offeneBo !== null ? ", " + offeneBo + " von " + BLACKOPS_GESAMT + " Black Ops offen" : ""));

  // BitNode 12 skaliert mit der Stufe: 1/1,02^Stufe (BitNode.tsx:924-926, 984).
  const bn12Stufe = knoten === 12 && ausgangGut && ausgangGut.lauf ? Number(ausgangGut.lauf.level) : 1;
  const unterwegs = RANG_UNTERWEGS * (knoten === 12 ? 1 / Math.pow(1.02, bn12Stufe) : (BB_RANK_MULT[knoten] ?? 1));
  const restNetto = Math.max(0, DAEDALUS_RANG - rang - unterwegs);
  let rate = null;

  if (sleeveRueckstandS > 1800) {
    sag("Hinweis: Die Sleeves holen " + dauer(sleeveRueckstandS / 3600) + " Rueckstand mit 15-facher"
      + " Geschwindigkeit nach - die Rangrate ist gerade ein Bestand, keine Rate."
      + " Sie wird fuer diesen Besuch nicht gewertet.");
    bericht.sleeveRueckstandS = sleeveRueckstandS;
  }
  if (vorher && Number.isFinite(spielzeit) && !(sleeveRueckstandS > 1800)) {
    const dRang = rang - vorher.rang;
    const dSpiel = std(spielzeit - vorher.spielzeit);
    const dEcht = std(Date.now() - vorher.ts);
    rate = dSpiel > 0 ? dRang / dSpiel : null;
    sag("Seit dem letzten Check-in: +" + zahl(dRang) + " Rang in "
      + dauer(dSpiel) + " Spielzeit (" + dauer(dEcht) + " Kalenderzeit"
      + (dEcht > 0 ? ", also " + (dSpiel / dEcht * 100).toFixed(0) + " % der Zeit gespielt" : "")
      + ").");
    if (rate) sag("Rate: " + zahl(rate) + " Rang je Spielstunde.");
    bericht.rate = rate;
    bericht.gespieltAnteil = dEcht > 0 ? dSpiel / dEcht : null;
  } else if (juengster && Number.isFinite(spielzeit) && spielzeit - juengster.spielzeit < MIN_FENSTER_MS) {
    sag("Der letzte Check-in liegt erst "
      + dauer(std(spielzeit - juengster.spielzeit)) + " Spielzeit zurueck - fuer eine"
      + " belastbare Rate braucht es " + (MIN_FENSTER_MS / 60000) + " Minuten. Komm spaeter"
      + " wieder, oder lies die Zahlen unten als Momentaufnahme.");
  } else {
    sag("Erster Check-in in diesem Knotenlauf - eine Rate gibt es erst beim naechsten Mal.");
  }

  bericht.restNetto = restNetto;

  let urteil = "AUF KURS";

  /**
   * DIE RESTZEIT KOMMT AUS DER REFERENZKURVE, NICHT AUS DER RATE.
   *
   * Bis zum 04.09.2026 stand hier `restNetto / rate` - eine lineare
   * Fortschreibung. Fuer BitNode 10 ergab das 430,7 Tage bei einem Urteil
   * "AUF KURS", waehrend derselbe Knoten im vorigen Lauf ab derselben
   * Rangstelle noch 28 bis 50 Stunden brauchte. Fehlfaktor 208.
   *
   * Der Grund ist nicht Schlamperei, sondern die Groesse selbst: die Rangrate
   * waechst im Lauf um mehr als Faktor 5.000, weil sie an der Aktionsstufe
   * haengt und nicht am Rang. Eine im Anlauf gemessene Rate beschreibt den
   * Startblock, nicht die Strecke.
   *
   * Derselbe Fehler steht schon in nodes/ERLEDIGT.md vom 30.08.2026 - er kam
   * zurueck, weil er damals im Bericht korrigiert wurde und nicht im Werkzeug.
   *
   * Die lineare Zahl bleibt sichtbar, aber als das, was sie ist: eine untere
   * Schranke der Fahrweise, kein Termin.
   */
  const kurve = restzeitAusKurve(knoten, rang);
  let etaSpiel = null;

  if (kurve) {
    sag("Rest: " + zahl(restNetto) + " Rang netto (nach Abzug der " + zahl(Math.round(unterwegs))
      + ", die aus den Black Ops selbst kommen).");
    // Bezugsgroesse ist das gemessene KNOTENENDE des Referenzlaufs, nicht der
    // Zeitpunkt der Rangschwelle. Zwischen Rang 17.594 und 4,54 Mio liegen im
    // Referenzlauf 22 Stunden ohne Messpunkt; wann die 400.000 fielen, ist
    // unbekannt, wann der Lauf endete, ist gemessen. Die Zahl enthaelt damit
    // den Nachlauf nach der Schwelle - die richtige Richtung fuer eine Planung.
    sag("ETA aus dem eigenen vorigen Lauf: " + dauer(kurve.restH) + " Spielzeit bis zum"
      + " Knotenende.");
    sag("  Der Referenzlauf stand bei Rang " + zahl(rang) + " nach "
      + kurve.hJetzt.toFixed(1) + " h und endete nach " + kurve.ende.h.toFixed(1) + " h"
      + " bei Rang " + zahl(kurve.ende.rang) + ".");
    if (kurve.luecke) {
      sag("  ACHTUNG: dieser Rang liegt in einer MESSLUECKE des Referenzlaufs (h "
        + kurve.luecke.vonH.toFixed(1) + " bis " + kurve.luecke.bisH.toFixed(1)
        + ", Rang " + zahl(kurve.luecke.vonRang) + " bis " + zahl(kurve.luecke.bisRang)
        + "). Die Zahl ist dort interpoliert, nicht gemessen.");
    }
    etaSpiel = kurve.restH;
    bericht.etaSpielstunden = etaSpiel;
    bericht.etaQuelle = "referenzkurve";
    bericht.etaInMessluecke = !!kurve.luecke;

    if (rate && rate > 0) {
      const linear = restNetto / rate;
      sag("  Zum Vergleich linear fortgeschrieben: " + dauer(linear)
        + " - das ist KEIN Termin, sondern der Startblock hochgerechnet."
        + " Die Rangrate waechst im Referenzlauf von 12 auf 207.111 Rang/h.");
    }

    /**
     * DIE EIGENTLICH WICHTIGE ZAHL. Die Restzeit oben ist eine reine Funktion
     * des Rangs - ein Lauf, der zehnmal langsamer ist, bekaeme exakt dieselbe
     * gemeldet. Erst der Gleichstandsvergleich merkt, dass etwas nicht stimmt.
     * (Ein Skeptiker fand am 04.09., dass diese Funktion gebaut, aber nirgends
     * aufgerufen war.)
     */
    // Die Spielzeit seit dem Knotenstart. netz.nodeReset ist ein Wanduhr-
    // Zeitstempel, spielzeit ist Spielzeit - die Differenz taugt also nicht.
    // Stattdessen die im Knoten verbrachte Spielzeit aus dem Spielstand, die
    // ausgang.js bzw. der Motor mitfuehrt.
    const hSeitKnoten = Number.isFinite(netz && netz.spielzeitImKnoten)
      ? std(netz.spielzeitImKnoten)
      : (Number.isFinite(bericht.spielzeitImKnotenH) ? bericht.spielzeitImKnotenH : null);
    if (Number.isFinite(hSeitKnoten) && hSeitKnoten > 0) {
      const v = vergleichMitReferenz(knoten, rang, hSeitKnoten);
      if (v) {
        const proz = Math.abs((v.faktor - 1) * 100);
        sag("  Gleichstand: dieser Lauf braucht bis Rang " + zahl(rang) + " "
          + v.hJetzt.toFixed(1) + " h, der Referenzlauf brauchte " + v.hReferenz.toFixed(1)
          + " h - also " + proz.toFixed(0) + " % "
          + (v.faktor < 1 ? "SCHNELLER" : "langsamer") + ".");
        bericht.gleichstandFaktor = v.faktor;
        if (v.faktor > 1.5) {
          urteil = "ZAEH";
          sag("  BEFUND: mehr als 50 % langsamer als der eigene vorige Lauf.");
        }
      }
    }

    // Eine falsifizierbare Vorhersage schlaegt jede Beschwichtigung.
    const ziel = naechsterMeilenstein(knoten, rang);
    if (ziel && ziel.rateDorthin) {
      sag("  Naechste Probe: bis Rang " + zahl(ziel.rang) + " (" + ziel.inH.toFixed(1)
        + " h) lief die Referenz mit " + zahl(Math.round(ziel.rateDorthin)) + " Rang/h."
        + " Bleibt die Rate beim naechsten Besuch deutlich darunter, ist DAS ein Befund.");
    }
  } else if (rate && rate > 0) {
    etaSpiel = restNetto / rate;
    sag("Rest: " + zahl(restNetto) + " Rang netto (nach Abzug der " + zahl(Math.round(unterwegs))
      + ", die aus den Black Ops selbst kommen).");
    sag("ETA: " + dauer(etaSpiel) + " reine Spielzeit - LINEAR fortgeschrieben.");
    sag("  Achtung: fuer BitNode " + knoten + " gibt es keine Referenzkurve aus einem"
      + " frueheren Lauf. Die Rangrate waechst im Lauf stark; diese Zahl ist eine"
      + " obere Schranke, kein Termin.");
    bericht.etaSpielstunden = etaSpiel;
    bericht.etaQuelle = "linear";
  }

  if (etaSpiel !== null) {
    if (bericht.gespieltAnteil) {
      sag("  Bei zuletzt " + (bericht.gespieltAnteil * 100).toFixed(0)
        + " % gespielter Zeit sind das rund " + dauer(etaSpiel / bericht.gespieltAnteil)
        + " Kalenderzeit.");
    }

    // Vergleich mit dem vorigen Check-in: steigt die ETA, laeuft etwas falsch.
    const letzteEta = [...punkte].reverse().find((p) =>
      gleicherLauf(p) && Number.isFinite(p.etaSpielstunden));
    if (letzteEta) {
      /**
       * NUR VERGLEICHEN, WAS MIT DERSELBEN METHODE GERECHNET WURDE.
       *
       * Am 04.09.2026 wurde die ETA von linearer Fortschreibung auf die
       * Referenzkurve umgestellt, und beim naechsten Lauf sprang das Urteil auf
       * ZAEH - weil die neue Zahl groesser war als die alte. Der Bot war nicht
       * langsamer geworden, die Rechnung war anders. Ein Methodenwechsel darf
       * keinen Befund erzeugen; sonst misstraut man beim naechsten Mal dem
       * Urteil und nicht der Zahl.
       */
      const gleicheMethode = (letzteEta.etaQuelle || "linear") === (bericht.etaQuelle || "linear");
      const delta = etaSpiel - letzteEta.etaSpielstunden;
      if (!gleicheMethode) {
        sag("Vorlauf-ETA: " + dauer(letzteEta.etaSpielstunden)
          + " - nicht vergleichbar, sie stammt aus einer anderen Rechenart ("
          + (letzteEta.etaQuelle || "linear") + " gegen " + (bericht.etaQuelle || "linear")
          + "). Der Vergleich beginnt beim naechsten Besuch neu.");
      } else {
        sag("Vorlauf-ETA: " + dauer(letzteEta.etaSpielstunden)
          + (delta > 0 ? "  (+" + dauer(delta) + " - die Strecke ist LAENGER geworden)"
            : "  (" + dauer(Math.abs(delta)) + " kuerzer)"));
        // Erst eine deutliche Verlaengerung ist ein Befund. Die Referenzkurve
        // hat Stuetzpunkte in unterschiedlichem Abstand; kleine Sprunge sind
        // Interpolation, kein Fortschrittsverlust.
        if (delta > Math.max(2, letzteEta.etaSpielstunden * 0.15)) urteil = "ZAEH";
        bericht.etaDelta = delta;
      }
    }
  }

  if (rate !== null && rate <= 0) {
    sag("Der Rang steht seit dem letzten Check-in still - hier stimmt etwas nicht.");
    urteil = "STEHT";
  }
  if (bericht.ausgangFehlt) urteil = "AUSGANG FEHLT";
  if (bericht.hilfe) urteil = "HILFE";

  // --- 5. Was der Bot gerade tut -------------------------------------------
  if (bladeGut && bladeGut.aktion) {
    sag("Aktion: " + bladeGut.aktion + " (Chance " + ((bladeGut.chance ?? 0) * 100).toFixed(1)
      + " %, Ausdauer " + (bladeGut.ausdauer ?? "?") + ", Chaos " + (bladeGut.chaos ?? 0).toFixed(1) + ")");
  }
  if (netz) sag("Netz: " + (netz.gerootet ?? "?") + "/" + (netz.netz ?? "?")
    + " gerootet, Runde " + (netz.runde ?? "?") + ".");

  // --- 5b. Das Betriebsbild (Auftrag 11) -----------------------------------
  //
  // Der Auftrag nennt fuenf Quellen, die hier gelesen werden sollen:
  // kpi.json, penalties.json, bridge-heartbeat.json, bridge-alarm.json und das
  // Alter der letzten Sicherung, dazu die Instanz. Sie standen bis zum
  // 04.09.2026 nicht drin - ein Check-in, das den Fortschritt meldet und die
  // Aufsicht verschweigt, meldet die haelfte.
  //
  // Gedruckt wird nur, was etwas zu sagen hat. Eine Zeile "keine Strafen" in
  // jedem Aufruf stumpft ab; eine Zeile, die nur bei Strafen erscheint, wird
  // gelesen.
  {
    const kpi = await holeJson("data/kpi.json");
    const strafen = await holeJson("data/penalties.json");
    const wd = await holeJson("data/watchdog.json");

    if (wd && wd.modus) {
      // Der Modus gehoert immer hin: eine Leiter im Beobachtungsmodus meldet
      // dieselben Befunde und handelt nicht. Wer das verwechselt, haelt einen
      // stehenden Bot fuer bewacht.
      sag("Waechter: " + wd.modus
        + (wd.modus === "observe" ? " (beobachtet nur - er greift NICHT ein)" : " (scharf)")
        + (Number.isFinite(wd.okRound) ? ", " + zahl(wd.okRound) + " Runden" : "")
        + (wd.sichtbar === false ? ", Tab verdeckt" : ""));
    }

    // Strafen der letzten 24 Stunden, nach Sprosse. Sprossen ab 3 sind laut
    // Architektur "jede ist ein Befund" - sie werden einzeln genannt.
    if (strafen && Array.isArray(strafen.eintraege)) {
      const seit = Date.now() - 24 * 3600000;
      const jung = strafen.eintraege.filter((e) => Number(e.wall) >= seit);
      if (jung.length) {
        const nachSprosse = {};
        for (const e of jung) nachSprosse[e.rung] = (nachSprosse[e.rung] || 0) + 1;
        sag("Strafen (24 h): " + Object.entries(nachSprosse)
          .sort((a, b) => a[0] - b[0])
          .map(([r, n]) => n + "x Sprosse " + r).join(", "));
        for (const e of jung.filter((x) => Number(x.rung) >= 3)) {
          sag("  Sprosse " + e.rung + " auf " + e.target + " (" + e.reason + ") um "
            + new Date(Number(e.wall)).toLocaleTimeString("de-DE")
            + " - " + (e.result || "?"));
        }
      }
    }

    // Die drei Autonomie-Kennzahlen, sobald sie einen Wert haben. Sie sind
    // seit dem 04.09. ueberhaupt erst messbar - vorher schrieb niemand die
    // Ereignisse, aus denen sie sich rechnen.
    if (kpi) {
      const teile = [];
      if (Number.isFinite(kpi.jump_latency_min)) teile.push("Sprung " + kpi.jump_latency_min.toFixed(1) + " min");
      if (Number.isFinite(kpi.boot_latency_min)) teile.push("Anlauf " + kpi.boot_latency_min.toFixed(1) + " min");
      if (Number.isFinite(kpi.ladder_rungs_ge3_per_week)) teile.push("Sprossen ab 3 diese Woche: " + kpi.ladder_rungs_ge3_per_week);
      if (Number.isFinite(kpi.idle_ram_pct)) teile.push("brach " + kpi.idle_ram_pct.toFixed(0) + " %");
      if (teile.length) sag("Autonomie: " + teile.join(", "));
      if (kpi.exhausted) {
        sag("ERSCHOEPFT: " + kpi.exhausted.signal + " auf Sprosse "
          + kpi.exhausted.lastRung + " - die Leiter hat nichts mehr uebrig.");
      }
    }

    // Die Bruecke und die Sicherungen. Beides liest sich am besten aus ihrem
    // eigenen Zustand, nicht aus dem Spiel - deshalb ueber /api/state.
    try {
      const r = await fetch(new URL("/api/state", BRIDGE));
      const st = await r.json();
      const alter = st.backupAgeMin;
      const zeilenteile = ["Instanz " + st.instance];
      if (Number.isFinite(alter)) {
        zeilenteile.push("juengste Sicherung " + alter.toFixed(0) + " min alt"
          + (alter > 90 ? " - ZU ALT" : ""));
      } else {
        zeilenteile.push("Sicherungsalter unbekannt");
      }
      if (st.alarm) zeilenteile.push("ALARM: " + (st.alarm.titel || st.alarm));
      sag("Bruecke: " + zeilenteile.join(", "));
    } catch { /* die Bruecke antwortet nicht - das steht schon oben */ }
  }

  // --- 6. Die Schlusszeile: wann ist der Knoten fertig? --------------------
  //
  // Eric am 31.08.2026: "am Ende vom /bb soll die aktuelle Schaetzung kommen,
  // wann der BN fertig sein wird." Sie steht deshalb IMMER da, auch wenn das
  // Fenster fuer eine frische Rate nicht reicht - dann eben mit der letzten
  // bekannten Rate und einem ausdruecklichen Vermerk. Eine fehlende Zeile
  // waere keine ehrlichere Antwort, sondern nur eine unbequemere.
  sag("");
  sag(fertigZeile());

  sag("URTEIL: " + urteil);
  return ausgeben(zeilen, { ...bericht, urteil });

  function fertigZeile() {
    /**
     * DIESE ZEILE IST DIE EINE ZAHL, DIE ERIC LIEST.
     *
     * Bis zum 04.09.2026 rechnete sie `restNetto / rate` und meldete fuer
     * BitNode 10 den 06.11. - 428 Tage entfernt, waehrend der vorige Lauf
     * desselben Knotens ab derselben Rangstelle noch 28 bis 50 Stunden
     * brauchte. Eine Planung auf dieser Grundlage waere um Faktor 200 falsch
     * gewesen, und das Urteil daneben lautete "AUF KURS".
     *
     * Die Referenzkurve hat Vorrang. Nur wenn es fuer den Knoten keine gibt,
     * wird linear gerechnet - und dann steht das ausdruecklich dabei.
     */
    let etaSpiel = null;
    let herkunft;
    let spanne = null;

    if (kurve) {
      etaSpiel = kurve.restH;
      spanne = kurve;
      herkunft = "aus dem eigenen vorigen Lauf dieses Knotens";
    } else {
      // Die Rate: frisch gemessen, sonst die letzte bekannte aus diesem
      // Knotenlauf.
      let r = rate;
      herkunft = "linear fortgeschrieben, gemessen seit dem letzten Besuch";
      if (!r || r <= 0) {
        const alt = [...punkte].reverse().find((p) =>
          gleicherLauf(p) && Number.isFinite(p.rate) && p.rate > 0);
        if (alt) {
          r = alt.rate;
          herkunft = "linear fortgeschrieben mit der Rate vom "
            + new Date(alt.ts).toLocaleDateString("de-DE");
        }
      }
      if (!r || r <= 0) {
        return "FERTIG VORAUSSICHTLICH: noch nicht schaetzbar - es fehlt eine"
          + " Rangrate. Beim naechsten Besuch (mindestens "
          + (MIN_FENSTER_MS / 60000) + " min Spielzeit spaeter) steht sie hier.";
      }
      etaSpiel = restNetto / r;
    }

    if (!Number.isFinite(etaSpiel)) {
      return "FERTIG VORAUSSICHTLICH: noch nicht schaetzbar - der Restweg ist"
        + " gerade nicht bezifferbar.";
    }
    // Vom Spielstunden-Bedarf auf ein Kalenderdatum: wie viel des Tages wird
    // tatsaechlich gespielt? Frisch gemessen, sonst der letzte bekannte Wert.
    let anteil = bericht.gespieltAnteil;
    let anteilHerkunft = "aus diesem Besuch";
    if (!(anteil > 0)) {
      const alt = [...punkte].reverse().find((p) =>
        gleicherLauf(p) && Number.isFinite(p.gespieltAnteil) && p.gespieltAnteil > 0);
      if (alt) { anteil = alt.gespieltAnteil; anteilHerkunft = "aus einem frueheren Besuch"; }
    }
    if (!(anteil > 0)) {
      return "FERTIG VORAUSSICHTLICH: noch " + dauer(etaSpiel) + " reine Spielzeit"
        + " (" + herkunft + "). Wann das im Kalender liegt, haengt daran, wie viel"
        + " du spielst - dafuer fehlt noch ein Vergleichswert.";
    }

    const etaEcht = etaSpiel / anteil;
    const ziel = new Date(Date.now() + etaEcht * 3600000);
    const wann = ziel.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" })
      + ", " + ziel.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    bericht.fertigAm = ziel.toISOString();
    bericht.fertigInKalenderstunden = etaEcht;

    // Die Spanne wird mitgenannt, nicht weggerundet. Zwischen dem letzten
    // Messpunkt unter der Schwelle und dem ersten darueber liegen im
    // Referenzlauf 22 Stunden, in denen niemand gemessen hat. Eine Klammer,
    // die das zugibt, ist ehrlicher als ein Termin, der es verschweigt.
    const spannenText = spanne
      ? (spanne.luecke
          ? " Der Rang liegt in einer Messluecke des Referenzlaufs - die Zahl ist dort interpoliert."
          : " Frueheste Schwelle nach " + dauer(spanne.bisSchwelleFruehestensH) + ".")
      : "";

    return "FERTIG VORAUSSICHTLICH: " + wann + " (noch " + dauer(etaSpiel)
      + " Spielzeit; bei " + (anteil * 100).toFixed(0) + " % gespielter Zeit "
      + anteilHerkunft + " sind das " + dauer(etaEcht) + " Kalenderzeit."
      + spannenText + " " + herkunft + ".)";
  }

  function ausgeben(z, b) {
    if (standSchreiben && b.urteil !== "BLIND" && b.urteil !== "SPIEL ZU") {
      punkte.push({
        ts: Date.now(), knoten: b.knoten, lauf: laufJetzt, rang: b.rang,
        spielzeit: Number.isFinite(spielzeit) ? spielzeit : null,
        etaSpielstunden: b.etaSpielstunden ?? null, urteil: b.urteil,
        // Rate und Spielanteil gehoeren mit in den Stand: Kommt Eric zweimal
        // kurz hintereinander, reicht das Fenster nicht fuer eine neue Rate -
        // dann rechnet die Schlusszeile mit der letzten bekannten weiter,
        // statt gar nichts zu sagen.
        rate: b.rate ?? null, gespieltAnteil: b.gespieltAnteil ?? null,
        etaQuelle: b.etaQuelle ?? null,
      });
      // Nur die letzten 50 behalten - laenger zurueck braucht niemand.
      try {
        fs.writeFileSync(STAND_DATEI,
          JSON.stringify({ punkte: punkte.slice(-50) }, null, 1));
      } catch { /* nicht schreibbar - der Bericht gilt trotzdem */ }
    }
    if (alsJson) console.log(JSON.stringify(b, null, 1));
    else console.log(z.join("\n"));
    process.exitCode = ["AUF KURS", "ANLAUF", "HACKINGWEG", "SPRINGT"].includes(b.urteil) ? 0 : 1;
  }
}

main();
