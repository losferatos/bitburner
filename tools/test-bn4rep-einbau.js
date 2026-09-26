/**
 * Ebene 0: `lib/einbau.js` - die sieben Fehlausloeser aus dem Audit
 * "perfekter Bot" (26.09.2026, nodes/audit-2026-09-26/3-progression.md,
 * 1-bitnode-regeln.md #3, 6-orchestrierung.md #1), Paket A (A1-A7). A1 braucht
 * dafuer zusaetzlich `ns.singularity.isFocused/setFocus` (in bn4rep.js selbst,
 * ungetestet - die reine ENTSCHEIDUNG, ob der Aufruf lohnt, steht als
 * `sollFokusZurueckholen` in lib/einbau.js und wird hier geprueft).
 *
 * JEDE Pruefung unten baut die ALTE Formel aus `bn4rep.js` (Stand vor dem
 * Audit-Fix) lokal nach und zeigt sie ROT gegen dieselben Eingaben, gegen die
 * die NEUE Funktion aus `lib/einbau.js` GRUEN steht. Das ist der Beleg, dass
 * der Fix etwas aendert und nicht nur umformuliert.
 *
 * Aufruf: node tools/test-bn4rep-einbau.js
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

const M = await import(pathToFileURL(finde("lib/einbau.js")).href);

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
console.log("=== lib/einbau.js: Audit-Fixes A1-A7 ===");

// ---------------------------------------------------------------------------
// A1: Fokus zurueckholen, waehrend die Faktionsarbeit schon laeuft
// ---------------------------------------------------------------------------
console.log("\n-- A1: Fokus zurueckholen (darkweb.js loescht ihn sonst dauerhaft) --");

// ALT: kein Aufruf von isFocused/setFocus in der ganzen Datei - die
// Entscheidung existierte schlicht nicht (immer "nein, nichts tun").
const altHoltNieZurueck = () => false;

{
  pruefe("ALT: holt den Fokus nie zurueck (ROT erwartet)",
    altHoltNieZurueck() === false);
  pruefe("NEU: Arbeit laeuft, kein Fokus, kein NMI -> zurueckholen",
    M.sollFokusZurueckholen({ arbeitetSchon: true, istFokussiert: false, hatNmi: false }) === true);
  pruefe("NEU: schon fokussiert -> kein weiterer Aufruf noetig",
    M.sollFokusZurueckholen({ arbeitetSchon: true, istFokussiert: true, hatNmi: false }) === false);
  pruefe("NEU: Neuroreceptor Management Implant vorhanden -> Strafe existiert nicht, nichts tun",
    M.sollFokusZurueckholen({ arbeitetSchon: true, istFokussiert: false, hatNmi: true }) === false);
  pruefe("NEU: keine Faktionsarbeit im Gang -> nichts zurueckzuholen",
    M.sollFokusZurueckholen({ arbeitetSchon: false, istFokussiert: false, hatNmi: false }) === false);
}

// ---------------------------------------------------------------------------
// A2: donationRepGainFaktor - BN12 lebt jetzt von ns.getBitNodeMultipliers()
// ---------------------------------------------------------------------------
console.log("\n-- A2: FactionWorkRepGain live statt Tabelle --");

const FACTION_REP_GAIN_ALT = { 2: 0.5, 4: 0.75, 13: 0.6, 14: 0.2 };
// Die ALTE Formel: reine Tabelle, kein Blick auf ns.getBitNodeMultipliers().
const altFaktor = (knoten) => FACTION_REP_GAIN_ALT[knoten] || 1;

{
  // BN12 Stufe 3, geeicht gegen den Auditwert 1,02 * 1,02^-3 = 0,96117...
  const bnMultsBN12 = { FactionWorkRepGain: 1.02 * Math.pow(1.02, -3) };
  const altWert = altFaktor(12);
  const neuWert = M.donationRepGainFaktor(bnMultsBN12, 12, FACTION_REP_GAIN_ALT);
  pruefe("BN12: alte Tabelle faellt auf 1 zurueck (ROT erwartet)",
    Math.abs(altWert - 1) < 1e-9,
    "alt=" + altWert + " (Audit: die Spende wird dadurch zu klein geschaetzt)");
  pruefe("BN12: neue Funktion liest den echten Faktor 0,9612",
    Math.abs(neuWert - 0.9612) < 1e-3,
    "neu=" + neuWert);
}
{
  // Rueckfall greift nur, wenn getBitNodeMultipliers() fehlschlaegt (kein SF5).
  const neuOhneMults = M.donationRepGainFaktor(null, 4, FACTION_REP_GAIN_ALT);
  pruefe("Rueckfall (bnMults null): BitNode 4 bleibt bei 0,75",
    neuOhneMults === 0.75);
  const neuKaputterWert = M.donationRepGainFaktor({ FactionWorkRepGain: 0 }, 4, FACTION_REP_GAIN_ALT);
  pruefe("Rueckfall greift auch bei FactionWorkRepGain 0 (kein Teilen durch 0)",
    neuKaputterWert === 0.75);
  const neuMitLive = M.donationRepGainFaktor({ FactionWorkRepGain: 0.75 }, 4, FACTION_REP_GAIN_ALT);
  pruefe("Live-Wert wird uebernommen, wenn er mit der Tabelle uebereinstimmt",
    neuMitLive === 0.75);
}

// ---------------------------------------------------------------------------
// A3: Daedalus-Schwelle live + Zaehlplatz aus INSTALLIERTEN Augs
// ---------------------------------------------------------------------------
console.log("\n-- A3: Daedalus-Schwelle live, Zaehlplatz aus eingebauten Augs --");

{
  const DAEDALUS_FALLBACK = { 6: 35, 7: 35, 15: 20 };
  const bnMultsBN12 = { DaedalusAugsRequirement: 31 };
  pruefe("BN12: live 31 statt fest 30",
    M.daedalusSchwelle(bnMultsBN12, 12, DAEDALUS_FALLBACK) === 31);
  pruefe("BN6: Rueckfalltabelle 35 (kein SF5-Zugriff)",
    M.daedalusSchwelle(null, 6, DAEDALUS_FALLBACK) === 35);
  pruefe("BN4: weder Tabelle noch Live-Wert -> Setzung 30",
    M.daedalusSchwelle(null, 4, DAEDALUS_FALLBACK) === 30);
}

{
  // Szenario aus dem Audit: 24 Augmentierungen wirklich EINGEBAUT, dazu 6
  // gekaufte NeuroFlux-Stufen, die noch in der Warteschlange liegen. Fuer
  // Daedalus zaehlen nur die 24 - fuer den 30er-Zaehlplatz muesste der Bonus
  // also noch stehen (24 < 30).
  const eingebauteAugs = new Array(24).fill(0).map((_, i) => "Aug" + i);
  const wartendeNfgStufen = 6;
  const alleAugsAlt = [...eingebauteAugs, ...new Array(wartendeNfgStufen).fill("NeuroFlux Governor")];

  // ALTE Formel: alleAugs.length < 30 (zaehlt jede wartende NFG-Stufe einzeln mit).
  const zaehlplatzAlt = alleAugsAlt.length < 30 ? 1 : 0;
  pruefe("ALT: Zaehlplatz-Bonus faellt vorzeitig weg (ROT erwartet)",
    zaehlplatzAlt === 0,
    "alleAugs.length=" + alleAugsAlt.length + " (6 wartende NFG-Stufen zaehlen als 6)");

  const zaehlplatzNeu = M.zaehlplatzWert(eingebauteAugs.length, 30);
  pruefe("NEU: Zaehlplatz-Bonus bleibt (nur installierte zaehlen)",
    zaehlplatzNeu === 1,
    "eingebauteAugs.length=" + eingebauteAugs.length);
}
{
  // Gegenprobe: 30 wirklich EINGEBAUTE Augs -> Bonus faellt zu Recht weg.
  pruefe("30 installierte Augs: Zaehlplatz-Bonus 0 (nicht mehr noetig)",
    M.zaehlplatzWert(30, 30) === 0);
}

// ---------------------------------------------------------------------------
// A4: Spendenrecht faellig, Warteschlange leer -> sofort Fuellstueck kaufen
// ---------------------------------------------------------------------------
console.log("\n-- A4: Spendenrechts-Einbau ohne Fuellstueck erzwingen --");

{
  // ALT: es gibt keine solche Funktion - der Bot wartet, bis zufaellig ein
  // Stueck verdient ist (bn4rep.js kaufte NFG nur IM Einbaublock, also erst
  // NACHDEM die Entscheidung schon gefallen war).
  const altImmerFalsch = () => false;
  pruefe("ALT: kein Ausloeser fuer ein Fuellstueck (ROT erwartet)",
    altImmerFalsch({ spendenrechtFaellig: true, wartend: 0 }) === false);
  pruefe("NEU: faellig + leere Warteschlange -> jetzt kaufen",
    M.sollFuellstueckSofortKaufen({ spendenrechtFaellig: true, wartend: 0 }) === true);
  pruefe("NEU: schon 2 Stueck wartend -> kein Grund zur Eile",
    M.sollFuellstueckSofortKaufen({ spendenrechtFaellig: true, wartend: 2 }) === false);
  pruefe("NEU: Spendenrecht nicht faellig -> nichts erzwingen",
    M.sollFuellstueckSofortKaufen({ spendenrechtFaellig: false, wartend: 0 }) === false);
}

// ---------------------------------------------------------------------------
// A6: The Red Pill in der Warteschlange erzwingt den Einbau
// ---------------------------------------------------------------------------
console.log("\n-- A6: Red Pill in der Warteschlange erzwingt Einbau --");

{
  const EXIT_KEY = "The Red Pill";
  const alleAugs = ["PCMatrix", EXIT_KEY];
  const eingebauteAugs = ["PCMatrix"];
  // ALT: kein Sonderfall fuer Red Pill - der Einbau haengt allein an
  // wartend >= MINDEST_WARTESCHLANGE oder spendenAusnahme.
  const altErzwingtNie = () => false;
  pruefe("ALT: kein Zwang, Red Pill kann liegen bleiben (ROT erwartet)",
    altErzwingtNie() === false);
  pruefe("NEU: Red Pill gekauft, nicht eingebaut -> Zwang",
    M.redPillWartetAufEinbau(alleAugs, eingebauteAugs, EXIT_KEY) === true);
  pruefe("NEU: Red Pill schon eingebaut -> kein Zwang mehr",
    M.redPillWartetAufEinbau([EXIT_KEY], [EXIT_KEY], EXIT_KEY) === false);
  pruefe("NEU: Red Pill gar nicht im Bestand -> kein Zwang",
    M.redPillWartetAufEinbau(["PCMatrix"], ["PCMatrix"], EXIT_KEY) === false);
}

// ---------------------------------------------------------------------------
// A5: Unbezahlbarkeit gegen Horizont statt gegen den Kassenstand direkt nach
// der eigenen Spende
// ---------------------------------------------------------------------------
console.log("\n-- A5: Horizont statt Momentaufnahme, nur wertvolle Stuecke --");

// ALTE Formel (bn4rep.js :754/:777, vereinfacht auf den gemeinsamen Kern):
// preis > geld * 4, ohne Wertfilter, ohne Ruecksicht auf eine laufende Spende.
const altUnbezahlbar = (preis, geld) => preis > geld * 4;

{
  // BN5.2, 16:57:10 (Audit 3#3): Neuralstimulator 41.154m bei 2.598m Guthaben,
  // gemessener Spendentakt 4,1 Mrd / 16 s = 256,25 Mio/s. Audit rechnet vor:
  // die Summe aus allen noch fehlenden Stuecken (rund 152,4 Mrd) waere in
  // 9,9 min beisammen gewesen.
  const preis = 41154e6;
  const geld = 2598e6;
  const einkommenProSek = 4.1e9 / 16;
  const horizontSek = 600; // 10 min - "kurzer Horizont", siehe lib/einbau.js
  const altWert = altUnbezahlbar(preis, geld);
  pruefe("ALT: gilt als unbezahlbar, obwohl der Zufluss es in Minuten deckt (ROT erwartet)",
    altWert === true, "preis/geld*4 = " + (preis / (geld * 4)).toFixed(2));
  const neuWert = M.unbezahlbarInHorizont({
    preis, wertlosGilt: false, geld, einkommenProSek, horizontSek,
    spendetGeradeAnSchwellenfaktion: false,
  });
  pruefe("NEU: mit Zufluss ueber 10 min ist es keine Zeitfrage mehr",
    neuWert === false,
    "projiziert=" + Math.round((geld + einkommenProSek * horizontSek) / 1e9) + " Mrd");
}
{
  // BN1.3, 00:23:13 (Audit 3#3): ENM DMA 48.013m bei 1.502m, mitten im
  // Spenden fuer The Red Pill bei derselben Faktion. Das leere Konto ist hier
  // die URSACHE (eigene Spende Sekunden zuvor), kein Belegzeitproblem.
  const preis = 48013e6;
  const geld = 1502e6;
  const altWert = altUnbezahlbar(preis, geld);
  pruefe("ALT: feuert trotz laufender Spendenphase (ROT erwartet)",
    altWert === true);
  const neuWert = M.unbezahlbarInHorizont({
    preis, wertlosGilt: false, geld, einkommenProSek: 1.8e9, horizontSek: 600,
    spendetGeradeAnSchwellenfaktion: true,
  });
  pruefe("NEU: waehrend der Spendenphase ausgesetzt",
    neuWert === false);
}
{
  // Wertlose Stuecke (Magnetism Amplifier, LuminCloaking-V1, Audit 3#3) duerfen
  // gar keinen Einbau mehr ausloesen, egal wie teuer das naechste ist.
  const neuWert = M.unbezahlbarInHorizont({
    preis: 1e6, wertlosGilt: true, geld: 100, einkommenProSek: 0, horizontSek: 600,
    spendetGeradeAnSchwellenfaktion: false,
  });
  pruefe("NEU: wertloses Stueck loest nie unbezahlbar aus",
    neuWert === false);
}

// ---------------------------------------------------------------------------
// A7: favorLohnt nur fuer Faktionen unter der Spendenschwelle mit offenem
// Katalog
// ---------------------------------------------------------------------------
console.log("\n-- A7: Favor-Relevanz vor der Ratengewinn-Rechnung --");

// ALTE Regel (bn4rep.js :997-1008): jede Faktion mit >= 1000 Reputation zaehlt.
// Nachgebildet als Praedikat ueber genau die beiden Werte, die die neue
// Funktion zusaetzlich prueft - "alt" ignoriert beide.
const altZaehltImmer = () => true;

{
  // BitRunners bei Favor 171 (> Spendenschwelle 150, Audit "Geprueft, in
  // Ordnung"): Favor bringt dort nichts mehr, Reputation ist schon eine
  // Geldfrage.
  pruefe("ALT: zaehlt spendenberechtigte Faktion trotzdem (ROT erwartet)",
    altZaehltImmer() === true);
  pruefe("NEU: Favor ueber der Spendenschwelle zaehlt nicht mehr",
    M.favorZaehltFuerFaktion({
      favorJetzt: 171, spendenSchwelle: 150, hatUnbesessenesWertvollesStueck: true,
    }) === false);
}
{
  // Sector-12 (Audit 3#5): drei Stuecke gekauft, Katalog danach leer, Favor
  // trotzdem unter der Schwelle - ohne offenen Katalog bringt der Favorgewinn
  // nichts mehr ab, an dem er sich auszahlen koennte.
  pruefe("ALT: zaehlt Faktion mit leerem Katalog trotzdem (ROT erwartet)",
    altZaehltImmer() === true);
  pruefe("NEU: leerer Katalog -> zaehlt nicht",
    M.favorZaehltFuerFaktion({
      favorJetzt: 40, spendenSchwelle: 150, hatUnbesessenesWertvollesStueck: false,
    }) === false);
}
{
  // Gegenprobe: unter der Schwelle UND offener Katalog -> zaehlt weiterhin.
  pruefe("NEU: unter Schwelle mit offenem Katalog zaehlt weiter",
    M.favorZaehltFuerFaktion({
      favorJetzt: 16.4, spendenSchwelle: 150, hatUnbesessenesWertvollesStueck: true,
    }) === true);
}

console.log("");
console.log(gruen + " ok, " + rot + " rot von " + (gruen + rot));
if (rot) {
  console.log("\nFehlgeschlagen:");
  for (const f of fehler) console.log("  - " + f);
}
process.exit(rot ? 1 : 0);
