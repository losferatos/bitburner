// TOR.JS - wie lange noch bis Kampfwert 100 (Tor zur Bladeburner-Division)?
//
// WARUM ES DAS GIBT (29.08.2026, 13:30): Die ETA zum Beitritt wurde bis dahin
// linear aus dem Skill-Zuwachs hochgerechnet ("+1 in 6 min mal 36 Punkte").
// Das ist systematisch zu optimistisch, weil die Erfahrung je Skillpunkt
// exponentiell steigt: Die Rechnung von 12:53 kam auf 5,3 h, die exakte auf
// 8,4 h - 3 Stunden Unterschied in einer Zahl, die Eric stuendlich bekommt.
//
// Gerechnet wird stattdessen mit der Umkehrung der Spielformel
// (`PersonObjects/formulas/skill.ts:13`):
//
//     skill = floor(m * (32*ln(exp + 534.6) - 200))
//     exp(z) = e^((z/m + 200)/32) - 534.6
//
// Der Multiplikator m ist der Augmentierungs-Multiplikator aus dem laufenden
// Spielstand mal dem festen Kampf-Faktor des BitNodes. Zurueckgerechnet wird
// er nur noch als Gegenprobe - siehe den Block bei `BN_KAMPF_FAKTOR`, warum
// die Rueckrechnung am unteren Rand nicht traegt.
//
// Aufruf: node tools/tor.js
// Schreibt data/tor.json und gibt zwei Zeilen aus.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(HIER, "..");
const VERLAUF = path.join(WURZEL, "data", "tor-verlauf.json");
const AUSGABE = path.join(WURZEL, "data", "tor.json");
const ZIEL = 100;
const STATS = ["str", "def", "dex", "agi"];

// DIE FORMELRATE, wenn keine zweite Messung vorliegt: 1 exp je Cycle mal
// Ortsfaktor, 5 Cycles je Sekunde (`Work/Formulas.ts:116`, `gameCPS`) - **mal
// dem Erfahrungs-Multiplikator der Figur**, den `calculateClassEarnings` als
// letzten Schritt anwendet (`multWorkStats(..., person.mults)`, dort :117).
// Die erste Fassung vom 29.08. hatte diesen Faktor vergessen und die ETA
// dadurch um 29 Prozent zu lang geschaetzt; eine spaetere schrieb ihn mit
// 1,287 fest, worauf er nach dem naechsten Einbau (1,548) wieder um 20
// Prozent danebenlag. Er kommt deshalb aus dem laufenden Spielstand.
//
// DER ORTSFAKTOR IST NICHT IMMER 10 (10.09.2026, nach dem Skeptiker-Lauf).
//
// Hier stand fest `10 * mults.strength_exp`. Die 10 gehoeren dem Powerhouse
// Gym in Sector-12 (`Locations/data/LocationsMetadata.ts`), und `bbtrain.js`
// steuert es auch an - aber nur, wenn die Reise gelingt. Schlaegt sie fehl,
// trainiert es dort, wo die Figur steht: Snap Fitness in Aevum gibt 5,
// Millenium Fitness in Volhaven 4 (`src/bbtrain.js:59-61`). Die Rate ist dann
// um Faktor 2 bis 2,5 zu hoch, und die ETA entsprechend zu kurz.
//
// Ebenso stand die Erfahrungs-Multiplikator von STAERKE fuer alle vier Werte.
// Die vier haben eigene (`mults.defense_exp` und so weiter); dass sie heute
// gleich sind, ist eine Eigenschaft dieses Spielstands, keine Regel.
const GYM_ORTSFAKTOR = {
  "Sector-12": 10,      // Powerhouse Gym
  Aevum: 5,             // Snap Fitness
  Volhaven: 4,          // Millenium Fitness
};
// Steht die Figur in einer Stadt ohne Gym, reist bbtrain.js nach Sector-12 -
// wenn das Geld dafuer reicht. Der vorsichtige Wert ist trotzdem der
// kleinste: eine zu lange ETA aergert, eine zu kurze taeuscht.
const GYM_UNBEKANNT = 4;

function gymRate(stadt, expMult) {
  const faktor = GYM_ORTSFAKTOR[stadt] ?? GYM_UNBEKANNT;
  const m = Number(expMult);
  if (Number.isFinite(m) && m > 0) return faktor * m;
  return 12.87;
}
// Aeltere Messungen sind fuer die Rate wertvoller (glaettet Gym-Pausen),
// aber nicht aelter als das hier - sonst steckt ein Reset darin.
const VERLAUF_MAX_MS = 6 * 3600 * 1000;

const expFuer = (z, m) => Math.exp((z / m + 200) / 32) - 534.6;

// DIE LAGE KOMMT AUS DEM SPIELSTAND, NICHT AUS bblage.json (10.09.2026).
//
// Hier stand `brueckeLies("data/bblage.json")`. Diese Datei schreibt
// `src/bblage.js`, und das steht in keiner Registry - der Kern startet es
// nie. Am 10.09. war sie 48 h alt und stammte aus dem VORIGEN Lauf: sie
// meldete `inBladeburner: true` und Rang 5837, waehrend im frischen BitNode 4
// die Kampfwerte auf 1 standen. Dieses Werkzeug brach daraufhin mit "Bereits
// in der Division - dieses Werkzeug ist hier fertig" ab - in genau der Phase,
// fuer die es gebaut ist, und aufgerufen von genau dem Skill (/bb, Urteil
// ANLAUF), der die Zahl braucht.
//
// `tools/save.js --json` liest denselben Spielstand, den dieses Werkzeug fuer
// die Gym-Rate ohnehin schon anfasst. Diese Quelle KANN nicht veralten.
// TESTKLAPPE: `TOR_LAGE_DATEI` ersetzt den Spielstand durch eine Datei.
//
// Ohne sie ist dieses Werkzeug nur in genau der Lage pruefbar, in der der Bot
// gerade steht - und das ist meistens die falsche. Am 10.09. trat der Bot
// waehrend des Umbaus in die Division ein; ab da war der ganze Rechenweg
// unerreichbar, weil oben `inBladeburner` abbricht. Die Klappe kostet drei
// Zeilen und macht `tools/test-tor.js` moeglich.
//
// Sie wirkt NUR, wenn die Umgebungsvariable gesetzt ist; im Normalbetrieb
// aendert sich nichts.
const lage = (() => {
  const testDatei = process.env.TOR_LAGE_DATEI;
  if (testDatei) {
    try { return JSON.parse(fs.readFileSync(testDatei, "utf8")); } catch (e) {
      console.log("TOR_LAGE_DATEI unlesbar: " + (e && e.message ? e.message : e));
      process.exit(1);
    }
  }
  let roh;
  try {
    roh = execSync("node tools/save.js --json", {
      cwd: WURZEL, timeout: 20000, encoding: "utf8" });
  } catch (e) {
    console.log("Spielstand nicht lesbar: " + (e && e.message ? e.message : e));
    console.log("URTEIL: BLIND");
    process.exit(1);
  }
  try { return JSON.parse(roh); } catch {
    console.log("save.js --json lieferte kein JSON.");
    console.log("URTEIL: BLIND");
    process.exit(1);
  }
})();
if (!lage || !lage.kampfExp || !Number.isFinite(lage.spielzeitMs)) {
  console.log("Keine Lage - Bruecke tot oder Spiel zu.");
  console.log("URTEIL: BLIND");
  process.exit(1);
}
// IN DER DIVISION IST DAS WERKZEUG NUR FERTIG, WENN DIE KAMPFWERTE STEHEN
// (22.09.2026, BAUSTELLEN Zeile 1851). Nach einem Augmentierungs-Einbau
// bleibt die Mitgliedschaft erhalten, die Kampfwerte fallen auf 1 - und
// blade.js weicht bbtrain.js, bis der Tiefstand wieder 100 erreicht. Genau
// diese Phase rechnet dieses Werkzeug; am 22.09. stieg es darin aus
// ("Bereits in der Division"), und data/tor.json blieb vom Vormittag stehen.
if (lage.inBladeburner && Number.isFinite(lage.tiefstand) && lage.tiefstand >= ZIEL) {
  console.log("In der Division, Kampfwerte >= " + ZIEL + " - dieses Werkzeug ist hier fertig.");
  process.exit(0);
}
if (lage.inBladeburner) {
  console.log("In der Division, aber Tiefstand " + lage.tiefstand
    + " < " + ZIEL + " - Wiederaufbau nach einem Einbau, gerechnet wird weiter.");
}

// Die Formelrate steht erst jetzt fest - sie braucht Stadt und
// Erfahrungs-Multiplikator aus der Lage. Genommen wird der KLEINSTE der vier
// Multiplikatoren: die vier Werte werden nacheinander trainiert, und der
// langsamste bestimmt, wann der letzte die Schwelle erreicht.
const expMultMin = Math.min(...STATS.map((k) =>
  Number((lage.expMult || {})[k]) || 0)) || undefined;
const RATE_NOTFALL = gymRate(lage.stadt, expMultMin);

// BBTRAIN TRAINIERT UNTER 5 MIO GAR NICHT (10.09.2026, Skeptiker-Befund).
//
// `src/bbtrain.js:263` (`GYM_MIN_GELD = 5e6`) laesst das Gym aus und beendet
// sogar laufende Gym-Arbeit, solange das Konto darunter liegt - Gym kostet
// Geld, und ein leeres Konto bricht den Rest des Bots. Eine ETA, die stur mit
// der Gym-Rate rechnet, verspricht dann ein Training, das nicht stattfindet.
// Im frischen Knoten ist genau das der Normalfall.
const GYM_MIN_GELD = 5e6;
const kontoWarnung = Number(lage.geld) < GYM_MIN_GELD
  ? "bbtrain.js trainiert erst ab $5 Mio (bbtrain.js:263), das Konto steht bei $"
    + Math.round(Number(lage.geld) || 0).toLocaleString("de-DE")
    + " - bis dahin laeuft die Uhr, aber kein Gym."
  : null;

let verlauf = [];
try { verlauf = JSON.parse(fs.readFileSync(VERLAUF, "utf8")); } catch { /* erster Lauf */ }
if (!Array.isArray(verlauf)) verlauf = [];
const summeJetzt = STATS.reduce((s, k) => s + lage.kampfExp[k], 0);

// DIE RATE WIRD IN SPIELZEIT GEMESSEN, NICHT AN DER WANDUHR (10.09.2026).
//
// Erfahrung waechst in Spielzeit. Erics Rechner laeuft nicht durch - am 07.,
// 08. und 09.09. war er beim Check-in jeweils aus gewesen. Eine an der
// Wanduhr gemessene Rate teilt den Zuwachs dann durch eine Zeit, in der das
// Spiel gar nicht lief, und faellt beliebig zu niedrig aus. Die Restzeit
// waechst entsprechend ins Absurde.
//
// Alte Verlaufseintraege tragen nur die Wanduhr und werden verworfen; das
// kostet einmalig eine gemessene Rate (der Rueckfall auf die Formel greift so
// lange) und ist einer Migration vorzuziehen, die stillschweigend falsche
// Fenster weiterrechnet.
//
// DER VERLAUF GILT NUR INNERHALB EINES KNOTENS UND EINES EINBAUSTANDS
// (10.09.2026, nach dem Skeptiker-Lauf).
//
// Zwei Ereignisse setzen die Kampf-Erfahrung auf null, ohne dass die
// Spielzeit springt - und ein Eintrag von davor macht die Rate dann sinnlos:
//
//   Knotenwechsel        `playtimeSinceLastBitnode` faengt neu an. Ein alter
//                        Eintrag hat DEUTLICH mehr Spielzeit - aber genau der
//                        Fall, den dieses Werkzeug erlebt, ist der umgekehrte:
//                        es laeuft im neuen Knoten frueh (exp 0, Spielzeit
//                        klein) und beendet sich im alten Knoten sofort, sobald
//                        die Division steht. Der zurueckbleibende Eintrag ist
//                        also IMMER ein frueher mit `summe 0` - und der
//                        passiert jede Groessenpruefung. Gemessen an der
//                        wirklich vorliegenden Datei: `spielzeitMs 6613200,
//                        summe 0` haette im naechsten Knoten bei 3 h Spielzeit
//                        rund 48 exp/s ergeben statt 12,6.
//   Augmentierungs-Einbau  `installAugmentations` nullt exp, die Knotenuhr
//                        laeuft weiter. Ein Eintrag mit `summe 0` von vor dem
//                        Einbau ueberlebt jede Summenpruefung und macht die
//                        Rate bis zu zwoelfmal zu klein.
//
// Groessenvergleiche fangen beides NICHT. Es braucht die Kennung selbst:
// Knotennummer und die Uhr seit dem letzten Einbau.
verlauf = verlauf.filter((e) => e && Number.isFinite(e.spielzeitMs)
  && e.knoten === lage.knoten
  // Seit dem Einbau ist die Uhr neu gestartet: ein Eintrag von davor hat eine
  // GROESSERE Zahl als der jetzige Stand.
  && Number.isFinite(e.spielzeitSeitAugMs)
  && e.spielzeitSeitAugMs <= lage.spielzeitSeitAugMs
  && lage.spielzeitSeitAugMs - e.spielzeitSeitAugMs < VERLAUF_MAX_MS
  && e.summe !== undefined && e.summe <= summeJetzt);

// DER AELTESTE EINTRAG TRAEGT DIE MESSUNG, NICHT DER JUENGSTE (10.09.2026).
//
// Hier stand `verlauf[0]`. Geschrieben wird aber mit `unshift`, also steht an
// Position 0 der Eintrag des VORIGEN Laufs - bei zwei Aufrufen kurz
// hintereinander liegt das Fenster unter zwanzig Minuten und die Messung
// faellt durch. Der Kommentar direkt darueber sagt "aeltester brauchbarer
// Eintrag traegt die Ratenmessung"; der Code tat das Gegenteil.
//
// Beleg, dass es nie gegriffen hat: `data/tor.json` stand ueber alle
// Laeufe hinweg auf "Formel (keine zweite Messung)".
const alt = verlauf[verlauf.length - 1];
let rate = RATE_NOTFALL, quelle = "Formel (keine zweite Messung)";
// Mindestens 20 Minuten Fenster. Kuerzere Fenster messen nicht die Rate,
// sondern die Tab-Drosselung: Ein gedrosselter Tab holt schubweise nach, und
// ein 18-Minuten-Fenster ergab am 29.08. einmal 9,10 und einmal 15,37 exp/s -
// beide Male denselben Bot, beide Male neben dem Formelwert 12,87.
if (alt && lage.spielzeitSeitAugMs > alt.spielzeitSeitAugMs + 1200000) {
  const fensterMs = lage.spielzeitSeitAugMs - alt.spielzeitSeitAugMs;
  const r = (summeJetzt - alt.summe) / (fensterMs / 1000);
  if (r > 0.1) {
    rate = r;
    quelle = "gemessen ueber " + (fensterMs / 60000).toFixed(0) + " min Spielzeit";
  }
}

// DER LEVEL-MULTIPLIKATOR WIRD NICHT MEHR BLIND ZURUECKGERECHNET (10.09.2026).
//
// Bisher: `m = (skill + 0.5) / (32*ln(exp + 534.6) - 200)`. Das setzt voraus,
// dass der Skill wirklich aus der Erfahrung folgt. Genau das gilt am unteren
// Rand NICHT: `calculateSkill` endet auf `clampNumber(value, 1)`
// (`PersonObjects/formulas/skill.ts:14`), der Skill ist also mindestens 1,
// auch wenn die Formel 0 ergaebe.
//
// Im frischen Knoten steht exp auf 0 und der Skill auf 1 - gemessen am
// 10.09. um 15:32 in BitNode 4. Der Nenner ist dort 32*ln(534,6) - 200 =
// 0,9887, und die Rueckrechnung liefert m = 1,5/0,9887 = 1,517 statt der
// wahren 1,262. Der Bedarf faellt damit um Groessenordnungen zu klein aus,
// und zwar ausgerechnet beim ersten Aufruf im neuen Knoten.
//
// Der wahre Multiplikator steht in zwei Teilen fest:
//   mults.<stat>            aus dem Spielstand (Augmentierungen)
//   BitNodeMultipliers      Konstante des Knotens (BitNode.tsx, case N)
//
// GEEICHT an vier unabhaengigen Punkten aus den eigenen Sicherungen des
// BitNode-10-Laufs (mults.strength 1,26160, BN10-Faktor 0,4 -> m = 0,50464):
//   exp     17 -> floor(0,50464 *   1,99) =  1   Sicherung, Skill  1  OK
//   exp 24.721 -> floor(0,50464 * 124,37) = 62   Sicherung, Skill 62  OK
//   exp 45.422 -> floor(0,50464 * 143,54) = 72   Sicherung, Skill 72  OK
//   exp 132745 -> floor(0,50464 * 177,61) = 89   Sicherung, Skill 89  OK
//
// Der erste Punkt traegt schwach (dort greift der Clamp auf 1), unterscheidet
// aber sauber gegen die blinde Rueckrechnung: die kaeme dort auf m = 1,487
// und damit auf Skill 2, was die Sicherung widerlegt.
//
// Die Rueckrechnung bleibt als Gegenprobe: wo genug Erfahrung liegt, muss
// sie zur Tabelle passen. Weicht sie deutlich ab, wird das gemeldet statt
// stillschweigend gerechnet - dann stimmt eine der beiden Quellen nicht.
//
// BitNode 12 fehlt bewusst: sein Faktor haengt vom SF12-Level ab
// (`StrengthLevelMultiplier: dec`) und ist keine Konstante. Dort greift die
// Rueckrechnung, und wenn die nicht taugt, sagt das Werkzeug es.
const BN_KAMPF_FAKTOR = {
  1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1,
  9: 0.45, 10: 0.4, 11: 1, 13: 0.7, 14: 0.5, 15: 0.7,
};

// Ab wann traegt die Rueckrechnung? Bei Skill s ist die Spanne, aus der er
// stammen kann, eine ganze Stufe breit; relativ zum Nenner wird das erst bei
// nennenswerter Erfahrung schmal - und wie schnell, haengt vom Multiplikator
// ab. Nachgerechnet (maximaler relativer Fehler bei 10.000 exp):
//
//     m = 1,26  ->  0,41 %      m = 0,40  ->  1,27 %
//     m = 0,70  ->  0,72 %      m = 0,25  ->  2,0 %
//     m = 0,50  ->  1,02 %      m = 0,10  ->  5,0 %
//
// Die Ein-Prozent-Grenze liegt bei m = 0,5 also erst bei rund 10.600 und bei
// m = 0,25 erst bei 237.000 exp. Das ist nur im Rueckfallzweig wichtig, denn
// wo die Tabelle greift, ist die Rueckrechnung blosse Gegenprobe. Der
// Rueckfall betrifft ausschliesslich BitNode 12, und dort ist m klein - ein
// Prozent Fehler im Multiplikator sind sechs bis sieben Prozent im Bedarf.
// 10.000 bleibt die Schwelle, aber sie ist eine Untergrenze fuer die
// Brauchbarkeit, keine Garantie fuer ein Prozent.
const RUECK_AB_EXP = 10000;

let fehlt = 0;
const warnungen = [];
const zeilen = [];
for (const k of STATS) {
  const e = lage.kampfExp[k];
  const bnFaktor = BN_KAMPF_FAKTOR[lage.knoten];
  const augMult = lage.levelMult ? lage.levelMult[k] : undefined;
  // Der Skill ist gerundet; die Mitte der Spanne ist der beste Schaetzer.
  const rueck = (lage.kampf[k] + 0.5) / (32 * Math.log(e + 534.6) - 200);

  let m;
  if (Number.isFinite(bnFaktor) && Number.isFinite(augMult) && augMult > 0) {
    m = augMult * bnFaktor;
    // Gegenprobe nur, wo die Rueckrechnung ueberhaupt tragen kann.
    if (e >= RUECK_AB_EXP && Math.abs(rueck - m) / m > 0.05) {
      // GESAMMELT, NICHT UEBERSCHRIEBEN: die Pruefung laeuft je Kampfwert,
      // und eine Zuweisung liesse nur den letzten Treffer stehen.
      warnungen.push(k + ": Multiplikator " + m.toFixed(4)
        + " (Tabelle) weicht um "
        + Math.round(Math.abs(rueck - m) / m * 100) + " % von der Rueckrechnung "
        + rueck.toFixed(4) + " ab - eine der beiden Quellen stimmt nicht.");
    }
  } else if (e >= RUECK_AB_EXP) {
    m = rueck;
  } else {
    console.log("Knoten " + lage.knoten + " ohne Tabellenfaktor und nur "
      + e + " exp auf " + k + " - der Multiplikator ist hier nicht bestimmbar.");
    console.log("URTEIL: BLIND");
    process.exit(1);
  }

  const noch = Math.max(0, expFuer(ZIEL, m) - e);
  fehlt += noch;
  zeilen.push(k + " " + lage.kampf[k] + " fehlt " + Math.round(noch));
}

const stunden = fehlt / rate / 3600;
// Der Zeitpunkt gilt NUR, wenn das Spiel ab jetzt durchlaeuft: `stunden` ist
// Spielzeit, die Wanduhr laeuft auch beim ausgeschalteten Rechner weiter.
const fertig = new Date(lage.wall + stunden * 3600 * 1000);
const pad = (n) => String(n).padStart(2, "0");

fs.writeFileSync(AUSGABE, JSON.stringify({
  zeit: lage.wall, spielzeitMs: lage.spielzeitMs, knoten: lage.knoten,
  tiefstand: lage.tiefstand, fehlt: Math.round(fehlt),
  rate, quelle, stunden, fertigMs: lage.wall + stunden * 3600 * 1000,
  warnungen,
}, null, 1));
verlauf.unshift({ spielzeitMs: lage.spielzeitMs,
  spielzeitSeitAugMs: lage.spielzeitSeitAugMs, knoten: lage.knoten,
  wall: lage.wall, summe: summeJetzt });
fs.writeFileSync(VERLAUF, JSON.stringify(verlauf.slice(0, 40)));

console.log(zeilen.join(" | "));
console.log("Tor in " + stunden.toFixed(1) + " h Spielzeit -> "
  + pad(fertig.getHours()) + ":" + pad(fertig.getMinutes())
  + " bei Dauerbetrieb  (" + Math.round(fehlt) + " exp bei "
  + rate.toFixed(2) + " exp/s, " + quelle + ")");
if (kontoWarnung) console.log("ACHTUNG: " + kontoWarnung);
for (const w of warnungen) console.log("ACHTUNG: " + w);
