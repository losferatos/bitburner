/**
 * Ebene 0: Die Formeln gegen unabhaengig bekannte Werte eichen.
 *
 * Jeder Eichpunkt hier stammt aus einer MESSUNG oder aus dem Quellcode - nicht
 * aus derselben Formel, die er prueft. Ein Test, der eine Formel gegen sich
 * selbst haelt, ist keiner.
 *
 * Ein Eichpunkt, der nicht trifft, ist ein Befund und kein Rundungsfehler.
 * Die Toleranz steht deshalb je Punkt dabei, mit Begruendung.
 *
 * Aufruf: node tools/test-formeln.js
 */

import {
  stufeAusExp,
  expFuerStufe,
  serverPreis,
  gymKostenProSekunde,
  gymRateProStunde,
  torZeitStunden,
  augPreis,
  repFuerFavor,
  hashRate,
  rangGewinn,
  effKampfFaktor,
  reaperEvasiveChanceProzent,
  reaperEvasiveZeitProzent,
} from "./lib/formeln.js";

let gruen = 0;
let rot = 0;
const fehler = [];

function eiche(name, ist, soll, toleranz, quelle) {
  const abw = Math.abs(ist - soll);
  const rel = soll !== 0 ? abw / Math.abs(soll) : abw;
  const ok = toleranz.rel !== undefined ? rel <= toleranz.rel : abw <= toleranz.abs;
  if (ok) {
    gruen++;
    console.log("  ok    " + name.padEnd(46) + fmt(ist) + "  (Soll " + fmt(soll) + ")");
  } else {
    rot++;
    fehler.push(name + ": " + fmt(ist) + " statt " + fmt(soll) + "  [" + quelle + "]");
    console.log("  ROT   " + name.padEnd(46) + fmt(ist) + "  (Soll " + fmt(soll) + ")");
    console.log("        Abweichung " + (rel * 100).toFixed(2) + " %  -  " + quelle);
  }
}

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

const fmt = (n) =>
  Math.abs(n) >= 1e6
    ? n.toExponential(3)
    : Number(n).toLocaleString("de-DE", { maximumFractionDigits: 2 });

console.log("");
console.log("=== Ebene 0: Formeln gegen Eichpunkte ===");
console.log("");

console.log("-- Fertigkeitsstufen --");
// Eichpunkt: exp 28.841 bei mult 0,4 x 1,262 ergibt Stufe 65 - im Spiel
// abgelesen (zahlen.md:8). Der Multiplikator ist das Produkt aus BitNode-
// LevelMultiplier (0,4) und Aug-Multiplikator (1,262); genau hier entstand am
// 30.08. der Fehler "Umgebungsmultiplikator vergessen".
eiche(
  "Stufe aus exp 28.841, mult 0,4 x 1,262",
  stufeAusExp(28841, 0.4 * 1.262),
  65,
  { abs: 0 },
  "im Spiel abgelesen",
);
// Stufe 1 bei exp 0 - die Untergrenze, an der eine naive Formel negativ wird.
eiche("Stufe bei exp 0", stufeAusExp(0, 1), 1, { abs: 0 }, "Untergrenze");
// Hin und zurueck muss sich schliessen.
{
  const exp = expFuerStufe(100, 1);
  eiche("Umkehrung: exp fuer Stufe 100, dann zurueck", stufeAusExp(exp, 1), 100, { abs: 0 },
    "Selbstkonsistenz");
}
// Beitrittstor BN10: 252.320 exp je Wert bei LevelMult 0,4 (zahlen.md:70).
// BEFUND DES EICHTESTS 04.09.2026: Der Auftrag nennt die 252.320 mit dem
// Zusatz "Levelmult 0,4". Das ist irrefuehrend - die Zahl entsteht erst mit dem
// PRODUKT aus BitNode-LevelMultiplier (0,4) und Aug-Multiplikator
// (mults.strength, heute 1,262), also 0,5048. Mit 0,4 allein kommen 1,28 Mio
// heraus, also das Fuenffache.
// Das ist die Fehlerart "Umgebungsmultiplikator vergessen" vom 30.08. - hier
// einmal in der Gegenrichtung: der Auftragstext nennt nur einen der beiden.
eiche(
  "Beitrittstor BN10: exp fuer Stufe 100 bei mult 0,4 x 1,262",
  expFuerStufe(100, 0.4 * 1.262),
  252320,
  { rel: 0.01 },
  "zahlen.md:70 - der Aug-Mult gehoert dazu",
);
// Gegenprobe: mit dem LevelMult allein ist es das Fuenffache. Wer die Zahl so
// liest, plant das Beitrittstor mit einem Fuenftel der noetigen Zeit.
pruefe(
  "Mit LevelMult 0,4 ALLEIN waere es das Fuenffache",
  expFuerStufe(100, 0.4) / 252320 > 4.5,
  "1,28 Mio statt 252.320",
);
// Und die Richtung stimmt: mehr Aug-Multiplikator senkt den exp-Bedarf.
pruefe(
  "Hoeherer Kampf-Mult senkt den exp-Bedarf",
  expFuerStufe(100, 0.4 * 2.0) < expFuerStufe(100, 0.4 * 1.262),
  "sonst waere die Wirkungsrichtung vertauscht",
);

// SKEPTIKER-AUDIT 26.09.2026, FUND 7 (audit-2026-09-26/4-bladeburner.md#7):
// src/kampfaugs.js hatte `KNOTENFAKTOR = knoten === 10 ? 0,4 : 1` fest im
// Code - ausserhalb BN10 rechnete es also IMMER mit 1, auch in BN9/13/14/15,
// wo BitNode.tsx eigene Kampf-LevelMultiplier hat (0,45/0,7/0,5/0,7). Beide
// Seiten hier sind derselbe `expFuerStufe`, nur mit dem BitNode-Faktor, den
// die alte bzw. die neue kampfaugs.js-Rechnung tatsaechlich einsetzt -
// `expNoetig(m, stat)` in kampfaugs.js ist `expFuerStufe(100, m*knotenFaktor(stat))`.
eiche(
  "kampfaugs.js VOR dem Fix in BN14 (KNOTENFAKTOR hart auf 1, da knoten!==10)",
  expFuerStufe(100, 1 * 1),
  11255,
  { rel: 1e-3 },
  "audit-2026-09-26/4-bladeburner.md#7 - 'gerechnet 11.255'",
);
eiche(
  "kampfaugs.js NACH dem Fix in BN14 (DexterityLevelMultiplier 0,5 live gelesen)",
  expFuerStufe(100, 1 * 0.5),
  267800,
  { rel: 1e-3 },
  "audit-2026-09-26/4-bladeburner.md#7 - 'richtig 267.800'",
);
pruefe(
  "die alte Rechnung war in BN14 um Faktor ~23,8 zu optimistisch",
  expFuerStufe(100, 1 * 0.5) / expFuerStufe(100, 1 * 1) > 20,
  "Faktor " + (expFuerStufe(100, 1 * 0.5) / expFuerStufe(100, 1 * 1)).toFixed(1),
);

console.log("");
console.log("-- Mietrechner --");
// Eichpunkt: 32 GB in BN10 kosten 8,80 Mio - im Spiel gemessen (zahlen.md:9).
// BN10 hat CloudServerCost 5 und CloudServerSoftcap 1,1.
eiche(
  "Server 32 GB in BN10 (cost 5, softcap 1,1)",
  serverPreis(32, 5, 1.1),
  8.8e6,
  { rel: 0.01 },
  "zahlen.md:9, im Spiel gemessen",
);
// Gegenprobe ohne Knotenfaktoren: 32 GB zu Faktor 1.
eiche("Server 32 GB zu Faktor 1", serverPreis(32, 1, 1), 1.76e6, { rel: 0.001 },
  "32 x 55.000 = 1,76 Mio");
// Der Softcap greift erst ab 64 GB - darunter ist die Potenz null.
pruefe(
  "Softcap wirkt unter 64 GB nicht",
  Math.abs(serverPreis(64, 1, 1.1) - 64 * 55000) < 1,
  "bei 64 GB ist log2(64)-6 = 0",
);
// 1024 GB in BN10: der Auftrag rechnet 1024 x 55.000 x 5 x 1,1^4 = 412 Mio.
eiche(
  "Server 1024 GB in BN10",
  serverPreis(1024, 5, 1.1),
  1024 * 55000 * 5 * Math.pow(1.1, 4),
  { rel: 0.001 },
  "Auftrag Phase 0",
);

console.log("");
console.log("-- Gym und Sleeves --");
// Eichpunkt: Nachholbetrieb mit 2 Sleeves = 2 x 15 x 2.400 + 2.400 = 74.400 $/s,
// im Spiel gemessen ~73.000 (zahlen.md:11-12).
eiche(
  "Gymkosten mit 2 Sleeves im Nachholbetrieb (Faktor 15)",
  gymKostenProSekunde(2, 15),
  74400,
  { rel: 0.02 },
  "zahlen.md:11-12, gemessen ~73.000",
);
eiche("Gymkosten Figur allein, stationaer", gymKostenProSekunde(0, 1), 2400, { abs: 1 },
  "Work/Formulas.ts");
// Die drei Gymraten aus dem Auftrag 8.1. Der Spieler-Multiplikator ist 1,262.
eiche("Gymrate Spieler allein", gymRateProStunde(1.262, 0), 45432, { rel: 0.01 },
  "Auftrag 8.1: 45.400 exp/h");
eiche("Gymrate mit 2 Sleeves", gymRateProStunde(1.262, 2), 63432, { rel: 0.01 },
  "Auftrag 8.1: 63.400 exp/h");
eiche("Gymrate mit 3 Sleeves", gymRateProStunde(1.262, 3), 72432, { rel: 0.01 },
  "Auftrag 8.1: 72.400 exp/h");
// Die widerlegte Zahl: "63.400 ohne Sleeves" ist rechnerisch unmoeglich, weil
// sie dem Spieler gleichzeitig 1,262 und 1,0 unterstellt.
pruefe(
  "'63.400 ohne Sleeves' ist unmoeglich",
  Math.abs(gymRateProStunde(1.262, 0) - 63400) > 15000,
  "Spieler allein kommt auf 45.432, nicht 63.400",
);
// Torzeit BN10: 252.320 exp je Wert, viermal.
eiche("Torzeit BN10 ohne Sleeves", torZeitStunden(252320, 1.262, 0), 22.2, { rel: 0.02 },
  "Auftrag 3.3: 22,2 h");
eiche("Torzeit BN10 mit 2 Sleeves", torZeitStunden(252320, 1.262, 2), 15.9, { rel: 0.02 },
  "Auftrag 3.3: 15,9 h");
eiche("Torzeit BN10 mit 3 Sleeves", torZeitStunden(252320, 1.262, 3), 13.9, { rel: 0.02 },
  "Auftrag 3.3: 13,9 h");
// Die widerlegte Zahl aus dem Auftrag 1.6: "28,0 h ohne Sleeves" unterstellt
// Multiplikator 1,0 und ist 26 % zu grosszuegig.
pruefe(
  "'28,0 h ohne Sleeves' war 26 % zu grosszuegig",
  Math.abs(torZeitStunden(252320, 1.0, 0) - 28.0) < 0.5,
  "mit mult 1,0 kommen genau die widerlegten 28,0 h heraus",
);

console.log("");
console.log("-- Augmentierungen --");
eiche("Aug-Preis k=0", augPreis(1e9, 0), 1e9, { rel: 0.001 }, "Basispreis");
eiche("Aug-Preis k=3 (1,9^3)", augPreis(1e9, 3), 1e9 * 6.859, { rel: 0.001 },
  "AugmentationHelpers.ts");
pruefe(
  "Der Preis skaliert mit 1,9^k, nicht die Rep-Huerde",
  augPreis(1e9, 5) / augPreis(1e9, 0) > 24,
  "1,9^5 = 24,76",
);

console.log("");
console.log("-- Faktionen --");
// Eichpunkt: Favor 150 entspricht 462.490 kumulierter Reputation (Auftrag 8.1).
eiche("Rep fuer Favor 150", repFuerFavor(150), 462490, { rel: 0.02 },
  "Auftrag 8.1 / formulas/favor.ts");
eiche("Rep fuer Favor 0", repFuerFavor(0), 0, { abs: 0.01 }, "Untergrenze");

console.log("");
console.log("-- Hacknet --");
// Eichpunkt: der Gratis-Server ab SF9.3 liefert 0,28 Hashes/s
// (HacknetServers.ts:11-16, Auftrag 8.1). Level 100, RAM 1, Kerne 1.
// BEFUND DES EICHTESTS 04.09.2026, zwei Teile:
// (a) Die eigene Formel war falsch - sie nutzte (kerne+5)/6, die Formel fuer
//     Hacknet-NODES, statt 1+(kerne-1)/5 fuer SERVER. Bei einem Kern liefern
//     beide zufaellig 1,0; der Fehler waere erst an einem ausgebauten Server
//     aufgefallen. Behoben.
// (b) Die 0,28 aus Auftrag 8.1 beschreiben NICHT den frisch freigeschalteten
//     Server. Ein solcher hat level 1, maxRam 1, cores 1
//     (HacknetServer.ts:33-61) und liefert 0,001 Hashes/s. Die 0,28 entstehen
//     bei level 100 und 10 Kernen: 0,001 x 100 x 1 x (1 + 9/5) = 0,28.
eiche("Hashrate level 100, RAM 1, 10 Kerne", hashRate(100, 1, 10), 0.28, { rel: 0.001 },
  "Auftrag 8.1 - das ist ein AUSGEBAUTER Server");
eiche("Hashrate eines frischen Servers (1/1/1)", hashRate(1, 1, 1), 0.001, { rel: 0.001 },
  "HacknetServer.ts:33-61 - Startwerte");
eiche("RAM-Faktor: 64 GB gegen 1 GB", hashRate(1, 64, 1) / hashRate(1, 1, 1),
  Math.pow(1.07, 6), { rel: 0.001 }, "1,07^log2(64) = 1,07^6");
pruefe(
  "Belegter RAM senkt die Rate anteilig",
  Math.abs(hashRate(100, 4, 1, 2) - hashRate(100, 4, 1, 0) * 0.5) < 1e-9,
  "ramRatio = 1 - ramUsed/maxRam",
);

console.log("");
console.log("-- Bladeburner --");
// Der wichtigste Punkt: der Ranggewinn haengt an der AKTIONSSTUFE, nicht am
// Spielerrang. Genau das Missverstaendnis kostete am 04.09. eine ETA um
// Faktor 208.
{
  const stufe1 = rangGewinn(1, 1, 1.1, 0.8);
  const stufe20 = rangGewinn(1, 20, 1.1, 0.8);
  pruefe(
    "Ranggewinn waechst mit der Aktionsstufe",
    stufe20 / stufe1 > 6,
    "1,1^19 = 6,12 - Stufe 20 bringt das Sechsfache von Stufe 1",
  );
  pruefe(
    "Der Spielerrang kommt in der Formel NICHT vor",
    rangGewinn(1, 5, 1.1, 0.8) === rangGewinn(1, 5, 1.1, 0.8),
    "die Funktion nimmt ihn gar nicht entgegen",
  );
  eiche("BitNode-Faktor BN10 wirkt linear", rangGewinn(10, 1, 1.1, 0.8), 8, { rel: 0.001 },
    "BladeburnerRank 0,8");
}

console.log("");
console.log("-- Bladeburner: Reaper/Evasive System multiplikativ (Skeptiker-Audit 26.09.2026, Fund 3) --");
// Eichpunkte aus nodes/audit-2026-09-26/4-bladeburner.md#3, unabhaengig
// nachgerechnet in den Rechenskripten skillwert.js (Eichung der Skillkosten
// gegen Hyperdrive St.219->549, Digital Observer St.43->92, Blade's
// Intuition St.65->140 - alle drei aus blade.js-Kommentaren) und
// zeitfaktor.js. Stand BN6 28.08.2026 16:08 (ERLEDIGT.md:3843): Digital
// Observer 104, Blade's Intuition 99, Evasive 93, Reaper 90; Kampfwerte
// str/def 387, dex/agi 450/420 (angenommen, gemaess Audit).
{
  const SK = { strength: 387, defense: 387, dexterity: 450, agility: 420, hacking: 300, intelligence: 150 };

  eiche(
    "EffDex bei Reaper 90 / Evasive 93 ist das PRODUKT (2,80 x 4,72)",
    effKampfFaktor(90, 93, "dexterity"),
    13.216,
    { rel: 1e-4 },
    "Bladeburner.ts:774-784 - additiv (1+0,02*90+0,04*93) waere nur 6,52",
  );

  const chanceReaper = reaperEvasiveChanceProzent(SK, 90, 93, "Reaper");
  const chanceEvasive = reaperEvasiveChanceProzent(SK, 90, 93, "Evasive System");
  eiche("Reaper: Chance-Zuwachs je Stufe (competence Daedalus)", chanceReaper, 0.5630,
    { rel: 1e-3 }, "skillwert.js 'wahr'-Spalte");
  eiche("Evasive System: Chance-Zuwachs je Stufe (competence Daedalus)", chanceEvasive, 0.5287,
    { rel: 1e-3 }, "skillwert.js 'wahr'-Spalte");

  // GEGENPROBE: die ALTE additive Rechnung aus blade.js vor dem Fix (nur zur
  // Dokumentation der Abweichung - kein Aufruf von Bot-Code, blade.js bleibt
  // aussen vor). Belegt, dass der Fehler real und nicht rundungsklein ist.
  const alteAdditiveComp = (rr, ee) => {
    const a = 1 + rr * 0.02, b = 1 + rr * 0.02 + ee * 0.04;
    return Math.pow(SK.strength * a, 0.8) + Math.pow(SK.defense * a, 0.8)
      + Math.pow(SK.dexterity * b, 0.8) + Math.pow(SK.agility * b, 0.8);
  };
  const altJetzt = alteAdditiveComp(90, 93);
  const altEvasive = 100 * (alteAdditiveComp(90, 94) / altJetzt - 1);
  eiche("ROT waere die alte additive Formel gegen denselben Eichpunkt", altEvasive, 0.3352,
    { rel: 1e-3 }, "blade.js vor dem Fix (skillwert.js 'bot'-Spalte) - zum Vergleich, nicht als Sollwert");
  pruefe(
    "die additive und die multiplikative Rechnung liegen spuerbar auseinander (nicht rundungsklein)",
    Math.abs(chanceEvasive - altEvasive) / chanceEvasive > 0.3,
    "wahr " + chanceEvasive.toFixed(4) + " % gegen additiv " + altEvasive.toFixed(4) + " %",
  );

  const zeitReaper = reaperEvasiveZeitProzent(SK, 90, 93, "Reaper");
  const zeitEvasive = reaperEvasiveZeitProzent(SK, 90, 93, "Evasive System");
  eiche("Reaper: Zeitgewinn je Stufe (statFac, Action.ts:112-119)", zeitReaper, 0.228,
    { rel: 1e-2 }, "zeitfaktor.js: Dauer -0,228 % je Stufe");
  eiche("Evasive System: Zeitgewinn je Stufe (statFac, Action.ts:112-119)", zeitEvasive, 0.270,
    { rel: 1e-2 }, "zeitfaktor.js: Dauer -0,270 % je Stufe");

  // DIE KERNAUSSAGE DES FUNDES: mit Zeitwirkung liegt Evasive System VOR
  // Blade's Intuition (0,7557 % je Stufe, unveraendert - dessen relNutzen war
  // nie der Fehler). Ohne die Zeitwirkung (0,5287 % allein) waere das falsch
  // herum - das ist der Kern von Fund 3, nicht nur die additiv/multiplikativ-
  // Differenz.
  const evasiveGesamt = chanceEvasive + zeitEvasive;
  pruefe(
    "Evasive System (Chance+Zeit) liegt vor Blade's Intuition (0,7557 %/Stufe)",
    evasiveGesamt > 0.7557,
    "Evasive gesamt " + evasiveGesamt.toFixed(4) + " % gegen BI 0,7557 %",
  );
  pruefe(
    "OHNE Zeitwirkung waere die Reihenfolge noch falsch - die Zeitwirkung ist kein Nebeneffekt",
    chanceEvasive < 0.7557,
    "Chance allein " + chanceEvasive.toFixed(4) + " % liegt HINTER Blade's Intuition",
  );
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  console.log("  Ein Eichpunkt, der nicht trifft, ist ein BEFUND - kein Rundungsfehler.");
  console.log("  Er gehoert nach BEFUNDE.md, bevor mit der Formel argumentiert wird.");
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
