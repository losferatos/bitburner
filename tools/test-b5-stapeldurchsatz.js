/**
 * B5 (Audit 26.09.2026, 2#4) - Stapelziele nach erreichbarem Stapeldurchsatz
 * waehlen, nicht nach Rang (steadyEff/targetRank).
 *
 * DER FEHLER, DEN DIESER TEST FAENGT. bn4net.js waehlte die Stapelziele
 * bisher als die ersten BATCH_ZIELE Eintraege der nach targetRank sortierten
 * Liste - derselbe Rang, nach dem auch die offene Mischung sortiert.
 * targetRank sagt nur, wie GUT ein Ziel pro Gigabyte ist, nicht, wieviel
 * Gigabyte es als Stapelziel ueberhaupt aufnehmen kann: ein Ziel mit kurzer
 * weaken-Zeit hat wenige Kalenderplaetze (Stapel duerfen nur alle GAP_MS
 * landen) und klemmt an f=0.5 fest, egal wie viel RAM es bekaeme.
 *
 * Belegt an echten Spielstaenden (BN5L2 18:04/19:04, BN5L3, ueber
 * scratchpad/audit/b5-check.mjs gegen dieselben Exporte wie hier): +19 % bis
 * +41 % Summe $/s der drei Stapelplaetze, wenn nach batchThroughput statt
 * nach Rang gewaehlt wird.
 *
 * Zwei Ebenen, wie bei test-b1 (Skeptiker B, Einwand 10):
 *   A. lib/calc.js batchThroughput/stapelPlan/growThreadsFromK - die
 *      Funktionen, die bn4net.js jetzt fuer die Auswahl aufruft.
 *   B. der Kern selbst ueber den Mock (tools/mock/lader.js): data/bn4net.json
 *      "batchZiele" muss das durchsatzstarke Ziel enthalten, nicht nur die
 *      rang-starken.
 *
 * Aufruf: node tools/test-b5-stapeldurchsatz.js
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { neuerMock } from "./mock/ns.js";
import { ladeAusBeiden } from "./mock/lader.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

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
console.log("=== B5 - Stapelziele nach Durchsatz statt Rang ===");

const C = await import(pathToFileURL(path.join(ROOT, "src", "lib", "calc.js")).href);

// ---------------------------------------------------------------------------
// A. lib/calc.js: batchThroughput / stapelPlan / growThreadsFromK
// ---------------------------------------------------------------------------
console.log("");
console.log("-- A. lib/calc.js: batchThroughput --");

const exportiert = typeof C.batchThroughput === "function" && typeof C.stapelPlan === "function"
  && typeof C.growThreadsFromK === "function";
pruefe("lib/calc.js exportiert batchThroughput/stapelPlan/growThreadsFromK", exportiert,
  "fehlt - dann rechnet die Auswahl mit einer Closure, die kein Test erreicht");

const SP = { skill: 3000, int: 0, multMoney: 1, multChance: 1, multGrow: 1, multSpeed: 1 };
const RAM_TOTAL = 20000;
const CFG = { ramHackT: 1.75, ramGrowT: 1.8, ramWeakenT: 1.8, bnScriptHackMoney: 0.15, bnServerGrowthRate: 1,
  mixMoneyHigh: 0.95, kapAbzug: 0.2, secOk: 1.0, moneyLow: 0.75, prepRamGb: RAM_TOTAL * 0.3 };
const COSTS = { hackT: 1.75, growT: 1.8, weakenT: 1.8 };

// A: kurze weaken-Zeit (wenige Kalenderplaetze), hoher $/GB*s-Rang.
// B: lange weaken-Zeit (viele Kalenderplaetze), niedrigerer Rang, aber ein
// Vielfaches an erreichbarem Stapeldurchsatz - genau der Fall aus dem Audit
// (dort: phantasy/max-hardware gegen johnson-ortho/omega-net).
const A_KURZ = { hackDifficulty: 5, minDifficulty: 5, requiredHackingSkill: 10, serverGrowth: 30,
  moneyMax: 2e7, moneyAvailable: 1.9e7, hasAdminRights: true };
const B_LANG = { hackDifficulty: 60, minDifficulty: 60, requiredHackingSkill: 500, serverGrowth: 60,
  moneyMax: 8e9, moneyAvailable: 7.9e9, hasAdminRights: true };

if (exportiert) {
  const kzA = C.targetMetrics(A_KURZ, SP, C.hackTime({ reqSkill: 10, sec: 5 }, SP), CFG);
  const kzB = C.targetMetrics(B_LANG, SP, C.hackTime({ reqSkill: 500, sec: 60 }, SP), CFG);
  const rangA = C.targetRank(kzA, { horizonSec: 1800, prepMaxSec: 1200 }, null);
  const rangB = C.targetRank(kzB, { horizonSec: 1800, prepMaxSec: 1200 }, null);
  const btA = C.batchThroughput(kzA, A_KURZ.moneyMax, RAM_TOTAL, COSTS);
  const btB = C.batchThroughput(kzB, B_LANG.moneyMax, RAM_TOTAL, COSTS);

  pruefe("Vorbedingung: A rangiert nach targetRank VOR B (der alte Fehler waehlt A)",
    rangA > rangB, "rangA=" + rangA + " rangB=" + rangB);
  pruefe("A hat wenige Kalenderplaetze (Kalenderdeckel greift)",
    btA && btA.kalenderPlaetze <= 5, JSON.stringify(btA));
  pruefe("B hat deutlich mehr Kalenderplaetze als A",
    btB && btA && btB.kalenderPlaetze > 10 * btA.kalenderPlaetze,
    "A=" + (btA && btA.kalenderPlaetze) + " B=" + (btB && btB.kalenderPlaetze));
  pruefe("batchThroughput(B).perS > batchThroughput(A).perS, obwohl B im Rang hinten liegt"
    + " (das ist die Kennzahl, nach der B5 waehlen muss)",
    btB && btA && btB.perS > 5 * btA.perS,
    "perS A=" + (btA && btA.perS) + " B=" + (btB && btB.perS));

  pruefe("batchThroughput liefert null fuer ein unbrauchbares Ziel (kMin<=0)",
    C.batchThroughput({ pMin: 0.1, chanceMin: 1, kMin: 0, hackTimeMin: 5 }, 1e6, RAM_TOTAL, COSTS) === null);
  pruefe("batchThroughput liefert null ohne moneyMax",
    C.batchThroughput({ pMin: 0.1, chanceMin: 1, kMin: 0.01, hackTimeMin: 5 }, 0, RAM_TOTAL, COSTS) === null);

  const plan = C.stapelPlan(0.1, kzB, B_LANG.moneyMax, COSTS);
  pruefe("stapelPlan: Ertrag und Speicherbedarf sind positiv", plan.geld > 0 && plan.ram > 0,
    JSON.stringify(plan));

  // Real-Spielstand-Anker (BN5L2 19:04, Level 3012, echte Mults) - siehe
  // scratchpad/audit/b5-check.mjs. phantasy hat dort 3 Kalenderplaetze und
  // klemmt an f=0.5 fest.
  const REAL_SP = { skill: 3012, int: 146, multMoney: 12.3202412590833,
    multChance: 3.7975437264111154, multGrow: 5.757850078880675, multSpeed: 4.0865317495893345 };
  const PHANTASY_19_04 = { hackDifficulty: 40, minDifficulty: 13, requiredHackingSkill: 100,
    serverGrowth: 35, moneyMax: 6e8, moneyAvailable: 1.2e7, hasAdminRights: true };
  const kzPh = C.targetMetrics(PHANTASY_19_04, REAL_SP,
    C.hackTime({ reqSkill: 100, sec: 40 }, REAL_SP), CFG);
  const btPh = C.batchThroughput(kzPh, PHANTASY_19_04.moneyMax, 131832, COSTS);
  pruefe("real (BN5L2 19:04): phantasy klemmt bei 3 Kalenderplaetzen an f=0.5",
    btPh && btPh.kalenderPlaetze === 3 && btPh.fraction === 0.5, JSON.stringify(btPh));
}

// ---------------------------------------------------------------------------
// B. Der Kern selbst, ueber den Mock
// ---------------------------------------------------------------------------
console.log("");
console.log("-- B. Kern (bn4net.js) waehlt Stapelziele ueber batchThroughput --");

const EXPZIEL = {
  ram: 8, used: 0, root: true, geld: 1e6, geldMax: 1e6, cores: 1, ports: 0,
  hackLevel: 1, sicherheit: 100, sicherheitMin: 1, wachstum: 50,
};

function grundDateien() {
  return {
    home: {
      "bn4net.js": "// Platzhalter",
      "worker/hack.js": "//", "worker/grow.js": "//", "worker/weaken.js": "//",
      "worker/share.js": "//", "worker/expfarm.js": "//",
      "data/verfahren.txt": "V1 5 2",
    },
  };
}

async function fahre(server, level, runden) {
  const m = neuerMock({
    host: "home", wall: 1_700_000_000_000, knoten: 5, nodeReset: 1000, geld: 1e9,
    server: { home: { ram: RAM_TOTAL, used: 0, root: true, geld: 0, cores: 1, ports: 0, hackLevel: 1 },
      expziel: { ...EXPZIEL }, ...server },
    dateien: grundDateien(), maxSchlaf: runden,
    skriptRam: {
      "worker/expfarm.js": 1.75, "worker/hack.js": 1.75,
      "worker/grow.js": 1.8, "worker/weaken.js": 1.8, "worker/share.js": 4,
    },
    beiSchlaf: (ms, z, vor) => { vor(10000); },
  });
  m.setze("spieler.skills.hacking", level);
  const zeit = (h) => {
    const s = m.zustand.server[h];
    if (!s) return 5000;
    return 1000 * C.hackTime({ reqSkill: s.hackLevel, sec: s.sicherheit ?? 5 },
      { skill: level, int: 0, multSpeed: 1 });
  };
  m.ns.getHackTime = zeit;
  m.ns.getGrowTime = (h) => 3.2 * zeit(h);
  m.ns.getWeakenTime = (h) => 4 * zeit(h);
  const { modul } = await ladeAusBeiden(ROOT, "bn4net.js");
  const zurueck = m.uhrStellen();
  try {
    await modul.main(m.ns);
  } catch (e) {
    if (!e.mockAbbruch) throw e;
  } finally {
    zurueck();
  }
  return m;
}

{
  // Drei Ziele mit A_KURZ-Profil (waeren nach Rang alle drei Stapelziele),
  // eines mit B_LANG-Profil (deutlich hoeherer Durchsatz, niedrigerer Rang).
  // BATCH_ZIELE ist 3 (Vorgabe) - ohne den Fix bekaeme "lang" keinen Platz.
  const server = {};
  for (const n of ["a1", "a2", "a3"]) {
    server[n] = { ram: 0, used: 0, root: true, geld: 1.9e7, geldMax: 2e7, cores: 1, ports: 0,
      hackLevel: 10, sicherheit: 5, sicherheitMin: 5, wachstum: 30 };
  }
  server.lang = { ram: 0, used: 0, root: true, geld: 7.9e9, geldMax: 8e9, cores: 1, ports: 0,
    hackLevel: 500, sicherheit: 60, sicherheitMin: 60, wachstum: 60 };

  const m = await fahre(server, 3000, 2);
  const t = JSON.parse(m.lies("home", "data/bn4net.json") || "null");
  const batch = (t && t.batchZiele) || [];
  pruefe("'lang' (hoher Durchsatz, niedrigerer Rang) ist Stapelziel", batch.includes("lang"),
    "batchZiele=" + JSON.stringify(batch));
  pruefe("nicht alle drei rang-starken 'a*' verdraengen 'lang' aus den 3 Plaetzen",
    ["a1", "a2", "a3"].filter((h) => batch.includes(h)).length <= 2,
    "batchZiele=" + JSON.stringify(batch));
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
