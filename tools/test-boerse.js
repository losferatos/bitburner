/**
 * Ebene 0 und 2: der Aktienhandel (Position C.15).
 *
 * ===========================================================================
 * WARUM HIER BESONDERS GENAU GEPRUEFT WIRD
 * ===========================================================================
 *
 * In BitNode 8 ist die Boerse die EINZIGE Geldquelle - jede andere steht auf
 * null (`BitNode.tsx:770-800`). Ein Handelsfehler ist dort kein Ertragsverlust,
 * sondern das Ende des Laufs: der Bot startet mit 250 Mio, und wenn die
 * verspielt sind, gibt es keinen zweiten Weg.
 *
 * Dazu kommt: die Kommission betraegt 100.000 Dollar JE TRANSAKTION
 * (`Constants.ts`, `StockMarketCommission`). Ein Bot, der auf Rauschen
 * handelt, verliert auch ohne einen einzigen falschen Trend.
 *
 * Aufruf: node tools/test-boerse.js
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { neuerMock } from "./mock/ns.js";
import { ladeAusBeiden } from "./mock/lader.js";
import { SRC } from "./ram.js";

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
console.log("=== Der Aktienhandel (C.15) ===");

const { modul, pfad } = await ladeAusBeiden(ROOT, "boerse.js");
console.log("    " + path.relative(ROOT, pfad).replace(/\\/g, "/"));

console.log("");
console.log("-- Ebene 0: die Trendschaetzung --");
{
  const s = modul.schaetzung;
  pruefe("sie ist exportiert", typeof s === "function");

  // ZU WENIG PUNKTE HEISST "KEINE MEINUNG". Bei zehn Ticks liegt die
  // Standardabweichung des Anteils bei 0,16 - eine geschaetzte 0,60 waere von
  // einer echten 0,44 nicht zu unterscheiden. Wer darauf handelt, handelt auf
  // Rauschen und zahlt 100.000 Kommission dafuer.
  pruefe("leere Historie ergibt 0,5", s([]) === 0.5);
  pruefe("fuenf Punkte ergeben 0,5", s([1, 2, 3, 4, 5]) === 0.5,
    "zu wenig fuer eine Aussage");
  pruefe("auch zehn Punkte noch", s([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) === 0.5);

  // Zwoelf Punkte, elf Schritte, alle aufwaerts.
  const steigend = Array.from({ length: 12 }, (_, i) => 100 + i);
  pruefe("lauter Aufwaertsticks ergeben 1,0", s(steigend) === 1,
    "erhalten " + s(steigend));

  const fallend = Array.from({ length: 12 }, (_, i) => 100 - i);
  pruefe("lauter Abwaertsticks ergeben 0,0", s(fallend) === 0);

  // Sechs hoch, fuenf runter - elf Schritte.
  const gemischt = [100, 101, 100, 101, 100, 101, 100, 101, 100, 101, 100, 101];
  pruefe("abwechselnd ergibt rund 0,55", Math.abs(s(gemischt) - 6 / 11) < 1e-9,
    "erhalten " + s(gemischt));

  // GLEICHE PREISE ZAEHLEN NICHT. Sie kommen vor, wenn die Historie schneller
  // gelesen wird, als der Markt tickt (alle 6 s). Wer sie als Abwaertstick
  // zaehlt, verkauft eine steigende Aktie.
  const mitStillstand = [100, 100, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111];
  pruefe("Stillstand zaehlt nicht mit", mitStillstand.length >= 12
    && s(mitStillstand) === 1,
    "erhalten " + s(mitStillstand) + " - gleiche Preise sind kein Abwaertstick");

  // Und die Gegenprobe: mit zu wenigen ECHTEN Schritten gilt wieder 0,5.
  const fastNurStillstand = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 101];
  pruefe("zu wenige echte Schritte ergeben 0,5", s(fastNurStillstand) === 0.5,
    "erhalten " + s(fastNurStillstand));
}

console.log("");
console.log("-- die Kommission ist eingerechnet --");
{
  // Der Code verlangt ein Budget von mindestens dem Fuenfzigfachen der
  // Kommission. Das ist keine willkuerliche Zahl: bei genau der Kommission
  // muesste ein Handel 100 Prozent gewinnen, um sie zu decken; beim
  // Fuenfzigfachen sind es vier Prozent (zweimal Kommission auf 5 Mio).
  const quelle = fs.readFileSync(path.join(SRC, "boerse.js"), "utf8");
  pruefe("die Kommission steht als Konstante drin", /KOMMISSION\s*=\s*100e3/.test(quelle));
  pruefe("sie begrenzt die Handelsgroesse", /budget < KOMMISSION \* 50/.test(quelle));
  pruefe("und sie wird vom Budget abgezogen",
    /budget - KOMMISSION/.test(quelle),
    "sonst reicht das Geld beim letzten Stueck nicht");
}

console.log("");
console.log("-- Ebene 2: ohne Boersenzugang beendet es sich --");
{
  const m = neuerMock({});
  // Der Mock hat keine stock-API - der Zugriff wirft.
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); } finally { zurueck(); }
  const t = JSON.parse(m.lies("home", "data/boerse.json") || "{}");
  pruefe("es meldet den Zustand", t.state === "done", t.state);
  pruefe("und nennt den Grund", t.blockedReason === "kein Boersenzugang",
    String(t.blockedReason));
  pruefe("errStreak bleibt 0", t.errStreak === 0,
    "kein Zugang ist ein Zustand, kein Fehler - eine Fehlerserie wuerde die"
      + " Strafleiter speisen");
}

console.log("");
console.log("-- die Schliessung vor dem Sprung --");
{
  const quelle = fs.readFileSync(path.join(SRC, "boerse.js"), "utf8");
  // Prestige.ts:171 ruft initStockMarket() - jede Position ist danach weg,
  // und mit ihr ihr Gegenwert. Das ist der teuerste einzelne Fehler, den
  // dieses Gewerk machen koennte.
  pruefe("es reagiert auf data/boerse-schliessen.txt",
    quelle.includes('data/boerse-schliessen.txt'));
  pruefe("und verkauft dann ALLES", /function alleVerkaufen/.test(quelle));
  pruefe("die Begruendung nennt Prestige.ts", /Prestige\.ts:171/.test(quelle),
    "eine Regel ohne Belegstelle ist eine Behauptung");
}

console.log("");
console.log("-- die Zahlen gegen den Spielquelltext --");
{
  // ERZEUGT, NICHT ABGESCHRIEBEN: die Konstanten kommen aus der
  // Referenzkopie, nicht aus dem Gedaechtnis.
  const kPfad = path.join(ROOT, "reference", "v301", "src", "StockMarket",
    "data", "Constants.ts");
  pruefe("die Spielkonstanten liegen vor", fs.existsSync(kPfad));
  if (fs.existsSync(kPfad)) {
    const k = fs.readFileSync(kPfad, "utf8");
    const zahl = (name) => {
      const m = new RegExp(name + ":\\s*([0-9.e+]+)").exec(k);
      return m ? Number(m[1]) : null;
    };
    pruefe("Kommission ist 100.000", zahl("StockMarketCommission") === 100e3,
      String(zahl("StockMarketCommission")));
    pruefe("die 4S-TIX-API kostet 25 Mrd",
      zahl("MarketDataTixApi4SCost") === 25e9,
      String(zahl("MarketDataTixApi4SCost")));
    pruefe("ein Kursschritt dauert 6 s", zahl("msPerStockUpdate") === 6e3,
      String(zahl("msPerStockUpdate")));

    const quelle = fs.readFileSync(path.join(SRC, "boerse.js"), "utf8");
    pruefe("der Takt im Gewerk passt dazu", /TAKT_MS\s*=\s*6000/.test(quelle));
    pruefe("die 4S-Schwelle liegt ueber dem Preis",
      /geld >= 26e9/.test(quelle),
      "25 Mrd fuer die API plus Puffer - sonst steht das Gewerk unmittelbar"
        + " nach dem Kauf ohne Handelsgeld da");
  }
}

console.log("");
console.log("-- BitNode 8: jede andere Geldquelle ist null --");
{
  // Die Begruendung fuer dieses ganze Gewerk. Wenn sie nicht stimmt, ist es
  // ueberfluessig - und wenn sie stimmt, ist es unverzichtbar.
  const bn = fs.readFileSync(path.join(ROOT, "reference", "v301", "src",
    "BitNode", "BitNode.tsx"), "utf8");
  const i = bn.indexOf("case 8: {");
  const block = bn.slice(i, bn.indexOf("case 9:", i));
  for (const feld of ["CompanyWorkMoney", "CrimeMoney", "HacknetNodeMoney",
    "ManualHackMoney", "ScriptHackMoneyGain", "CodingContractMoney"]) {
    pruefe(feld + " ist 0 in BN8",
      new RegExp(feld + ":\\s*0\\s*,").test(block),
      "der Block sagt etwas anderes");
  }
  pruefe("Shorts sind IN BitNode 8 erlaubt",
    /Player\.bitNodeN !== 8 && Player\.activeSourceFileLvl\(8\) <= 1/.test(
      fs.readFileSync(path.join(ROOT, "reference", "v301", "src",
        "NetscriptFunctions", "StockMarket.ts"), "utf8")),
    "die Sperre greift nur AUSSERHALB von BN8 - das ist der Grund, warum das"
      + " Gewerk dort spaeter shorten darf");
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
