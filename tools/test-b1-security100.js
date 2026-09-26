/**
 * Ebene 0: B1 (Audit 26.09.2026, 2#2) - Server bei Sicherheit 100 duerfen
 * fuer die Zielwahl nicht unsichtbar sein.
 *
 * DER BEFUND: bn4net.js:kennzahlen() rechnete pMin/chanceMin frueher, indem
 * es p/chance AM IST-WERT nahm und mit einem Faktor "sauber =
 * (100-hdMin)/(100-hdIst)" auf minDifficulty hochskalierte. hackPercent und
 * hackChance geben bei sec >= 100 exakt 0 zurueck (Hacking.ts:13, :46 -
 * BN5 verdoppelt ServerStartingSecurity, Server.ts:79-83 klemmt auf 100).
 * 0 * sauber bleibt 0, egal wie klein hdMin ist - der Kandidatenfilter
 * "steadyEff > 0" wirft den Server dann fuer immer weg (null > 0 ist
 * false). Belegt in zwei BN5-Spielstaenden: 46 von 63 Geldservern (99,8 %
 * des moneyMax) dauerhaft unsichtbar.
 *
 * DIESER TEST rechnet BEIDE Fassungen (alt: skaliert vom IST-Wert; neu:
 * direkt bei minDifficulty) nach - mit genau den Formeln aus lib/calc.js,
 * derselben Datei, die bn4net.js importiert. Kein zweiter, erfundener
 * Formelsatz: nur der Auswertungspunkt (sec = hdIst vs. sec = hdMin)
 * unterscheidet sich, wie im echten kennzahlen().
 *
 * Zwei Faelle:
 *   1. hdIst = 100 (Server.ts-Klemmung): alt liefert steadyEff = null
 *      (ROT, reproduziert den Befund), neu liefert steadyEff > 0 (GRUEN).
 *   2. hdIst < 100 (Normalfall, keine Klemmung): alt und neu muessen
 *      IDENTISCH sein - hackPercent/hackChance sind linear in
 *      (100-sec)/100, die Skalierung ist dort algebraisch exakt (siehe
 *      Audit "geprueft, in Ordnung": IST->minDifficulty korrekt "ausser im
 *      Grenzfall Sicherheit 100"). Ein Fix, der Fall 1 repariert und Fall 2
 *      verschiebt, waere kein Fix.
 *
 * Aufruf: node tools/test-b1-security100.js
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
    console.log("\n  src/" + rel + " nicht gefunden. Gesucht in:");
    for (const x of k) console.log("    " + x);
    process.exit(1);
  }
  return t;
}

const C = await import(pathToFileURL(finde("lib/calc.js")).href);

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
console.log("=== Ebene 0: B1 - Zielwahl bei Sicherheit 100 ===");

// Ein plausibler BN5-Konzernserver: hoher reqSkill, viel Geld, Wachstum 60.
const SERVER = { requiredHackingSkill: 2000, serverGrowth: 60, moneyMax: 2e12 };
const SPIELER = { skill: 2871, int: 0, multMoney: 1, multChance: 1, multGrow: 1, multSpeed: 1 };
const BN_SCRIPT_HACK_MONEY = 1;   // BN5 = 1 (nur ScriptHackMoneyGain betrifft Geld, hier irrelevant)
const BN_GROWTH_RATE = 1;

/**
 * Die ALTE Fassung von kennzahlen() (vor dem Fix): p/chance am IST-Wert,
 * dann mit "sauber" auf minDifficulty hochskaliert. Wortgetreu aus
 * bn4net.js uebernommen (Stand vor diesem Commit), nur die auesseren
 * Abhaengigkeiten (ns.getServer, ns.getHackTime) durch die Testwerte
 * ersetzt.
 */
function altKennzahlen(hdIst, hdMin) {
  const p = C.hackPercent({ sec: hdIst, reqSkill: SERVER.requiredHackingSkill },
    { skill: SPIELER.skill, multMoney: SPIELER.multMoney }, BN_SCRIPT_HACK_MONEY);
  const chance = C.hackChance({ sec: hdIst, reqSkill: SERVER.requiredHackingSkill, root: true },
    SPIELER);
  const sauber = (100 - hdIst) > 0 ? (100 - hdMin) / (100 - hdIst) : 1;
  const pMin = Math.min(1, p * sauber);
  const chanceMin = Math.min(1, chance * sauber);
  const beute = pMin * chanceMin;
  const hackTimeMin = 1;   // fuer diesen Test irrelevant, nur brauchbar-Gate zaehlt
  const gbSekProEinheit = 1;
  const brauchbar = p > 0 && gbSekProEinheit > 0 && beute > 0 && hackTimeMin > 0;
  return { pMin, chanceMin, beute, steadyEff: brauchbar ? beute : null };
}

/** Die NEUE Fassung (nach dem Fix): direkt bei minDifficulty gerechnet. */
function neuKennzahlen(hdIst, hdMin) {
  const pMin = C.hackPercent({ sec: hdMin, reqSkill: SERVER.requiredHackingSkill },
    { skill: SPIELER.skill, multMoney: SPIELER.multMoney }, BN_SCRIPT_HACK_MONEY);
  const chanceMin = C.hackChance({ sec: hdMin, reqSkill: SERVER.requiredHackingSkill, root: true },
    SPIELER);
  const beute = pMin * chanceMin;
  const hackTimeMin = 1;
  const gbSekProEinheit = 1;
  const brauchbar = pMin > 0 && gbSekProEinheit > 0 && beute > 0 && hackTimeMin > 0;
  return { pMin, chanceMin, beute, steadyEff: brauchbar ? beute : null };
}

console.log("");
console.log("-- Fall 1: hdIst = 100 (Server.ts-Klemmung, BN5) --");
{
  const hdMin = 35;   // typischer minDifficulty eines Konzernservers
  const alt = altKennzahlen(100, hdMin);
  const neu = neuKennzahlen(100, hdMin);
  pruefe("ALT: p am IST-Wert (100) ist 0",
    C.hackPercent({ sec: 100, reqSkill: SERVER.requiredHackingSkill },
      { skill: SPIELER.skill, multMoney: SPIELER.multMoney }, BN_SCRIPT_HACK_MONEY) === 0,
    "hackPercent muss bei sec>=100 exakt 0 sein (Hacking.ts:46) - sonst greift der Befund nicht");
  pruefe("ALT (ROT, reproduziert den Befund): steadyEff ist null trotz gutem Ziel",
    alt.steadyEff === null, "steadyEff=" + alt.steadyEff);
  pruefe("NEU (GRUEN): steadyEff ist positiv",
    neu.steadyEff !== null && neu.steadyEff > 0, "steadyEff=" + neu.steadyEff);
  pruefe("NEU: pMin entspricht hackPercent direkt bei minDifficulty",
    Math.abs(neu.pMin - C.hackPercent({ sec: hdMin, reqSkill: SERVER.requiredHackingSkill },
      { skill: SPIELER.skill, multMoney: SPIELER.multMoney }, BN_SCRIPT_HACK_MONEY)) < 1e-12);
}

console.log("");
console.log("-- Fall 2: hdIst < 100 (Normalfall, keine Klemmung) --");
{
  // Ein leicht verschmutzter Server: minDifficulty 20, IST 45.
  const hdIst = 45, hdMin = 20;
  const alt = altKennzahlen(hdIst, hdMin);
  const neu = neuKennzahlen(hdIst, hdMin);
  pruefe("beide Fassungen liefern positives steadyEff",
    alt.steadyEff > 0 && neu.steadyEff > 0,
    "alt=" + alt.steadyEff + " neu=" + neu.steadyEff);
  pruefe("ALT und NEU stimmen ueberein (die Skalierung war hier schon exakt)",
    Math.abs(alt.steadyEff - neu.steadyEff) / neu.steadyEff < 1e-9,
    "alt=" + alt.steadyEff + " neu=" + neu.steadyEff);
  pruefe("pMin stimmt ueberein",
    Math.abs(alt.pMin - neu.pMin) < 1e-9, "alt=" + alt.pMin + " neu=" + neu.pMin);
  pruefe("chanceMin stimmt ueberein",
    Math.abs(alt.chanceMin - neu.chanceMin) < 1e-9,
    "alt=" + alt.chanceMin + " neu=" + neu.chanceMin);
}

console.log("");
console.log("-- Fall 3: hdIst = 100 UND minDifficulty selbst hoch (kein Wunder erwartet) --");
{
  // Ein Server, der auch bei minDifficulty schlecht ist (z.B. reqSkill zu
  // hoch fuer die Chance) - der Fix darf so etwas nicht kuenstlich gut
  // aussehen lassen. chance faellt hier auf 0, weil reqSkill den Spieler-
  // Skill uebersteigt.
  const hoherReq = { ...SERVER, requiredHackingSkill: 999999 };
  const chanceMin = C.hackChance(
    { sec: 35, reqSkill: hoherReq.requiredHackingSkill, root: true }, SPIELER);
  pruefe("bei unerreichbarem reqSkill bleibt chance 0 (kein Kuenstlich-gut-Rechnen)",
    chanceMin === 0, "chance=" + chanceMin);
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
