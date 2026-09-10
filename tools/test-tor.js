/**
 * tools/tor.js gegen praeparierte Spielstaende (10.09.2026).
 *
 * ===========================================================================
 * WARUM ES DIESEN TEST GIBT
 * ===========================================================================
 *
 * `tor.js` war bis zum 10.09. nur in genau der Lage pruefbar, in der der Bot
 * gerade stand - und das ist meistens die falsche. Waehrend des Umbaus an dem
 * Tag trat der Bot in die Bladeburner-Division ein; ab diesem Augenblick war
 * der gesamte Rechenweg unerreichbar, weil das Werkzeug vorher abbricht.
 *
 * Genau in dieser Blindheit sind die Fehler gewachsen, die drei Skeptiker am
 * 10.09. gefunden haben - allen voran einer, der NIE gegriffen hat:
 *
 *   `verlauf[0]` statt `verlauf[verlauf.length - 1]`. Der Kommentar sagte
 *   "aeltester brauchbarer Eintrag traegt die Ratenmessung", der Code nahm
 *   den juengsten. Ergebnis: das Messfenster war immer der Abstand zum
 *   vorigen Aufruf, fiel damit unter die 20-Minuten-Schwelle und die
 *   gemessene Rate kam nie zustande. `data/tor.json` stand ueber alle Laeufe
 *   hinweg auf "Formel (keine zweite Messung)" - und niemand hat es gemerkt,
 *   weil es aussah wie ein normaler Rueckfall.
 *
 * Die Klappe `TOR_LAGE_DATEI` in tor.js macht diese Pfade erreichbar.
 *
 * Aufruf: node tools/test-tor.js
 */

import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const TOR = path.join(ROOT, "tools", "tor.js");
const VERLAUF = path.join(ROOT, "data", "tor-verlauf.json");
const AUSGABE = path.join(ROOT, "data", "tor.json");

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

// Die echten Dateien werden beiseitegelegt und am Ende zurueckgestellt - der
// Test darf den laufenden Bot nicht um seinen Verlauf bringen.
const sicherung = new Map();
for (const p of [VERLAUF, AUSGABE]) {
  if (fs.existsSync(p)) sicherung.set(p, fs.readFileSync(p, "utf8"));
}
function aufraeumen() {
  for (const p of [VERLAUF, AUSGABE]) {
    if (sicherung.has(p)) fs.writeFileSync(p, sicherung.get(p));
    else if (fs.existsSync(p)) fs.rmSync(p);
  }
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "tor-test-"));

/** Ein Spielstand, wie ihn `save.js --json` liefert. */
function lage(u = {}) {
  const kampfExp = u.kampfExp ?? { str: 0, def: 0, dex: 0, agi: 0 };
  const kampf = u.kampf ?? { str: 1, def: 1, dex: 1, agi: 1 };
  return {
    wall: u.wall ?? 1_789_000_000_000,
    spielzeitMs: u.spielzeitMs ?? 3_600_000,
    spielzeitSeitAugMs: u.spielzeitSeitAugMs ?? 3_600_000,
    knoten: u.knoten ?? 4,
    stadt: u.stadt ?? "Sector-12",
    geld: u.geld ?? 50e6,
    inBladeburner: u.inBladeburner ?? false,
    kampf, kampfExp,
    tiefstand: Math.min(kampf.str, kampf.def, kampf.dex, kampf.agi),
    expMult: u.expMult ?? { str: 1.2616, def: 1.2616, dex: 1.2616, agi: 1.2616 },
    levelMult: u.levelMult ?? { str: 1.2616, def: 1.2616, dex: 1.2616, agi: 1.2616 },
  };
}

let n = 0;
/** Laesst tor.js mit dieser Lage laufen und gibt Ausgabe plus tor.json. */
function lauf(l, verlaufVorher = null) {
  const datei = path.join(TMP, "lage-" + (++n) + ".json");
  fs.writeFileSync(datei, JSON.stringify(l));
  if (verlaufVorher === null) { if (fs.existsSync(VERLAUF)) fs.rmSync(VERLAUF); }
  else fs.writeFileSync(VERLAUF, JSON.stringify(verlaufVorher));
  let aus = "";
  let code = 0;
  try {
    aus = execFileSync("node", [TOR], {
      cwd: ROOT, encoding: "utf8", timeout: 30000,
      env: { ...process.env, TOR_LAGE_DATEI: datei },
    });
  } catch (e) {
    code = e.status ?? 1;
    aus = String(e.stdout || "") + String(e.stderr || "");
  }
  let json = null;
  try { json = JSON.parse(fs.readFileSync(AUSGABE, "utf8")); } catch { /* keins */ }
  return { aus, code, json };
}

console.log("");
console.log("=== tools/tor.js gegen praeparierte Spielstaende ===");

// ===========================================================================
console.log("");
console.log("-- Der Multiplikator am unteren Rand --");
{
  // Im frischen Knoten: exp 0, Skill 1. Die alte Rueckrechnung kam hier auf
  // m = 1,517 statt 1,2616, weil `calculateSkill` bei 1 klemmt.
  const r = lauf(lage());
  // Erwartet: expFuer(100, 1.2616) = 5632,6 je Wert.
  const proWert = /str 1 fehlt (\d+)/.exec(r.aus);
  pruefe("frischer Knoten: Bedarf je Wert stimmt (5633)",
    proWert && Math.abs(Number(proWert[1]) - 5633) <= 1,
    "gemeldet: " + (proWert ? proWert[1] : r.aus.trim()));
  pruefe("frischer Knoten: kein Absturz", r.code === 0, "exit " + r.code);
}
{
  // BitNode 10, derselbe Aug-Stand: Faktor 0,4 -> m = 0,50464. Der Bedarf
  // muss um Faktor 44,9 groesser sein als in BitNode 4.
  const r = lauf(lage({ knoten: 10 }));
  const proWert = /str 1 fehlt (\d+)/.exec(r.aus);
  pruefe("BitNode 10: Bedarf je Wert stimmt (252817)",
    proWert && Math.abs(Number(proWert[1]) - 252817) <= 30,
    "gemeldet: " + (proWert ? proWert[1] : r.aus.trim()));
}
{
  // BitNode 12 hat keinen Tabellenfaktor (er haengt vom SF12-Level ab) und im
  // frischen Knoten zu wenig Erfahrung fuer die Rueckrechnung. Dann sagt das
  // Werkzeug BLIND, statt eine Zahl zu erfinden.
  const r = lauf(lage({ knoten: 12 }));
  pruefe("BitNode 12 ohne Erfahrung: BLIND statt Fantasiezahl",
    r.aus.includes("URTEIL: BLIND") && r.code === 1, r.aus.trim());
}

// ===========================================================================
console.log("");
console.log("-- Der Verlauf: der AELTESTE Eintrag traegt die Messung --");
{
  // Zwei brauchbare Eintraege: einer 30 min alt, einer 90 min alt. Gemessen
  // werden muss gegen den AELTEREN (90 min), nicht gegen den juengeren.
  // Der Bug bis zum 10.09. nahm verlauf[0] - und das ist der juengste.
  const jetzt = lage({ spielzeitMs: 7_200_000, spielzeitSeitAugMs: 7_200_000,
    kampfExp: { str: 30000, def: 30000, dex: 30000, agi: 30000 },
    kampf: { str: 60, def: 60, dex: 60, agi: 60 } });
  const v = [
    // unshift-Reihenfolge: vorn der juengste.
    { spielzeitMs: 5_400_000, spielzeitSeitAugMs: 5_400_000, knoten: 4,
      wall: 1, summe: 96000 },
    { spielzeitMs: 1_800_000, spielzeitSeitAugMs: 1_800_000, knoten: 4,
      wall: 1, summe: 24000 },
  ];
  const r = lauf(jetzt, v);
  // Gegen den aelteren: (120000-24000) exp / 5400 s = 17,78 exp/s ueber 90 min.
  pruefe("gemessen wird ueber das GROESSTE Fenster (90 min)",
    r.aus.includes("90 min Spielzeit"), r.aus.trim());
  pruefe("die gemessene Rate ersetzt die Formel",
    r.json && Math.abs(r.json.rate - 17.78) < 0.1,
    "rate: " + (r.json ? r.json.rate : "-"));
}
{
  // Ein Eintrag aus einem ANDEREN Knoten darf nicht zaehlen. Genau dieser
  // Fall lag am 10.09. wirklich vor: data/tor-verlauf.json trug
  // `spielzeitMs 6613200, summe 0` aus BitNode 4 und haette im naechsten
  // Knoten eine vierfach zu hohe Rate ergeben.
  const jetzt = lage({ knoten: 10, spielzeitMs: 10_800_000,
    spielzeitSeitAugMs: 10_800_000,
    kampfExp: { str: 50000, def: 50000, dex: 50000, agi: 50000 },
    kampf: { str: 40, def: 40, dex: 40, agi: 40 } });
  const v = [{ spielzeitMs: 6_613_200, spielzeitSeitAugMs: 6_613_200,
    knoten: 4, wall: 1, summe: 0 }];
  const r = lauf(jetzt, v);
  pruefe("Eintrag aus dem Vorknoten wird verworfen",
    r.aus.includes("keine zweite Messung"), r.aus.trim());
}
{
  // Ein Eintrag von VOR einem Augmentierungs-Einbau darf nicht zaehlen: der
  // Einbau nullt die Erfahrung, laesst die Knotenuhr aber weiterlaufen.
  // Kennzeichen ist die Uhr seit dem Einbau - sie ist beim alten Eintrag
  // GROESSER als beim neuen.
  const jetzt = lage({ spielzeitMs: 10_000_000, spielzeitSeitAugMs: 600_000,
    kampfExp: { str: 8000, def: 8000, dex: 8000, agi: 8000 },
    kampf: { str: 40, def: 40, dex: 40, agi: 40 } });
  const v = [{ spielzeitMs: 5_000_000, spielzeitSeitAugMs: 5_000_000,
    knoten: 4, wall: 1, summe: 0 }];
  const r = lauf(jetzt, v);
  pruefe("Eintrag von vor dem Einbau wird verworfen",
    r.aus.includes("keine zweite Messung"), r.aus.trim());
}
{
  // Ein Verlauf im ALTEN Format (nur Wanduhr, kein knoten/spielzeitSeitAug)
  // darf nicht stillschweigend mitgerechnet werden.
  const r = lauf(lage({ spielzeitMs: 9_000_000, spielzeitSeitAugMs: 9_000_000,
    kampfExp: { str: 20000, def: 20000, dex: 20000, agi: 20000 },
    kampf: { str: 50, def: 50, dex: 50, agi: 50 } }),
    [{ zeit: 1_788_000_000_000, summe: 0 }]);
  pruefe("alter Verlauf (nur Wanduhr) wird verworfen",
    r.aus.includes("keine zweite Messung"), r.aus.trim());
}

// ===========================================================================
console.log("");
console.log("-- Die Rate: Ort, Multiplikator und die Gym-Schwelle --");
{
  const s12 = lauf(lage({ stadt: "Sector-12" }));
  const vol = lauf(lage({ stadt: "Volhaven" }));
  const r12 = /bei ([0-9.]+) exp\/s/.exec(s12.aus);
  const rVol = /bei ([0-9.]+) exp\/s/.exec(vol.aus);
  pruefe("Powerhouse (Sector-12) gibt Ortsfaktor 10",
    r12 && Math.abs(Number(r12[1]) - 12.62) < 0.05,
    "gemeldet: " + (r12 ? r12[1] : s12.aus.trim()));
  pruefe("Millenium (Volhaven) gibt Ortsfaktor 4 - nicht auch 10",
    rVol && Math.abs(Number(rVol[1]) - 5.05) < 0.05,
    "gemeldet: " + (rVol ? rVol[1] : vol.aus.trim()));
}
{
  // Der langsamste der vier Multiplikatoren bestimmt die Rate, nicht der von
  // Staerke. Bis zum 10.09. wurde `mults.strength_exp` auf alle vier
  // angewandt.
  const r = lauf(lage({ expMult: { str: 2.0, def: 1.0, dex: 2.0, agi: 2.0 } }));
  const rate = /bei ([0-9.]+) exp\/s/.exec(r.aus);
  pruefe("der KLEINSTE Erfahrungs-Multiplikator traegt die Rate",
    rate && Math.abs(Number(rate[1]) - 10.0) < 0.05,
    "gemeldet: " + (rate ? rate[1] : r.aus.trim()));
}
{
  const arm = lauf(lage({ geld: 1.4e6 }));
  const reich = lauf(lage({ geld: 50e6 }));
  pruefe("unter $5 Mio wird gewarnt: bbtrain trainiert dann gar nicht",
    arm.aus.includes("ACHTUNG") && arm.aus.includes("5 Mio"), arm.aus.trim());
  pruefe("ueber $5 Mio keine Kontowarnung",
    !reich.aus.includes("trainiert erst ab"), reich.aus.trim());
}

// ===========================================================================
console.log("");
console.log("-- Die Gegenprobe gegen die Tabelle --");
{
  // Genug Erfahrung fuer die Rueckrechnung, aber ein Aug-Multiplikator, der
  // nicht zum Skill passt: dann muessen beide Quellen auseinanderlaufen und
  // das Werkzeug muss es SAGEN statt still zu rechnen.
  const r = lauf(lage({ knoten: 4,
    kampfExp: { str: 132745, def: 132745, dex: 132745, agi: 132745 },
    kampf: { str: 89, def: 89, dex: 89, agi: 89 },
    levelMult: { str: 1.2616, def: 1.2616, dex: 1.2616, agi: 1.2616 } }));
  pruefe("Tabelle gegen Rueckrechnung: Abweichung wird gemeldet",
    r.aus.includes("ACHTUNG") && r.aus.includes("Multiplikator"), r.aus.trim());
  pruefe("gemeldet wird JE Kampfwert, nicht nur der letzte",
    (r.aus.match(/Multiplikator/g) || []).length === 4,
    (r.aus.match(/Multiplikator/g) || []).length + " Meldungen");
}
{
  // Und der saubere Fall: Skill 89 bei m = 0,50464 ist genau BitNode 10.
  // Hier darf KEINE Warnung stehen.
  const r = lauf(lage({ knoten: 10,
    kampfExp: { str: 132745, def: 132745, dex: 132745, agi: 132745 },
    kampf: { str: 89, def: 89, dex: 89, agi: 89 } }));
  pruefe("passender Stand: keine Warnung",
    !r.aus.includes("Multiplikator"), r.aus.trim());
}

// ===========================================================================
console.log("");
console.log("-- Der Abbruch, wenn die Division schon steht --");
{
  const r = lauf(lage({ inBladeburner: true }));
  pruefe("in der Division: sauberer Abbruch mit Code 0",
    r.aus.includes("Bereits in der Division") && r.code === 0,
    "exit " + r.code + ": " + r.aus.trim());
}

aufraeumen();
fs.rmSync(TMP, { recursive: true, force: true });

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
  process.exit(1);
}
