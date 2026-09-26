/**
 * B1 (Audit 26.09.2026, 2#2) und Skeptiker B, Einwand 3 - Zielwahl bei
 * Sicherheit 100, mit Vorbereitungszeit und Hysterese.
 *
 * WARUM DIESER TEST NEU GESCHRIEBEN IST (Skeptiker B, Einwand 10). Die erste
 * Fassung baute ALT und NEU als eigene Funktionen im Test nach und verglich
 * sie miteinander - kennzahlen() aus bn4net.js wurde nie aufgerufen, ein
 * Rueckfall im Kern waere gruen geblieben. Jetzt zwei Ebenen, beide gegen den
 * ECHTEN Code:
 *
 *   A. lib/calc.js targetMetrics / targetRank / selectMoneyTargets - genau die
 *      Funktionen, die bn4net.js aufruft (kennzahlen ist seit dem 26.09.2026
 *      eine duenne Huelle darum).
 *   B. der Kern selbst ueber den Mock (tools/mock/lader.js), mehrere Runden,
 *      mit getHackTime nach der Spielformel (Hacking.ts calculateHackingTime)
 *      statt der Mock-Konstante 5 s - sonst haette jeder Server dieselbe
 *      Vorbereitungszeit und der Test saehe nichts.
 *
 * Die Faelle sind den Nachrechnungen mit echten Spielstaenden nachgebildet
 * (nodes/audit-2026-09-26/skeptiker-B.md, Fix-Stand):
 *   B1 Knotenwechsel: Level 500, Sicherheit 100, weaken 61 min -> das Ziel
 *      darf nicht angefasst werden (sonst Anlauffrist 20 min, Sperre 30 min,
 *      und wieder von vorn).
 *   B2 Einspielen um 18:04: 30 frisch sichtbare Server auf Sicherheit 100
 *      (Vorbereitung ~17 min) neben 5 vorbereiteten, die gerade verdienen ->
 *      die vorbereiteten muessen Geldziele bleiben.
 *   B3 Hysterese: ein Herausforderer, 15 % besser und sofort bereit,
 *      verdraengt kein amtierendes Stapelziel.
 *
 * Aufruf: node tools/test-b1-security100.js
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
console.log("=== B1 - Zielwahl: Sicherheit 100, Vorbereitung, Hysterese ===");

const C = await import(pathToFileURL(path.join(ROOT, "src", "lib", "calc.js")).href);

// ---------------------------------------------------------------------------
// A. Die Funktionen, die der Kern aufruft
// ---------------------------------------------------------------------------
console.log("");
console.log("-- A. lib/calc.js: targetMetrics / targetRank / selectMoneyTargets --");
const exportiert = typeof C.targetMetrics === "function" && typeof C.targetRank === "function"
  && typeof C.selectMoneyTargets === "function";
pruefe("lib/calc.js exportiert die Zielwahl des Kerns", exportiert,
  "fehlt - dann rechnet bn4net.js mit einer Closure, die kein Test erreicht");

const CFG = {
  ramHackT: 1.75, ramGrowT: 1.8, ramWeakenT: 1.8, bnScriptHackMoney: 0.15, bnServerGrowthRate: 1,
  mixMoneyHigh: 0.95, kapAbzug: 0.2, secOk: 1.0, moneyLow: 0.75, prepRamGb: 1e9,
};
const SP = { skill: 3012, int: 146, multMoney: 12.32, multChance: 3.80, multGrow: 5.21, multSpeed: 4.087 };
// ecorp im Spielstand 19:04 (nach dem Einbau): Sicherheit 100, min 66.
const ECORP = {
  hostname: "ecorp", hackDifficulty: 100, minDifficulty: 66, requiredHackingSkill: 1117,
  serverGrowth: 99, moneyMax: 1.3e12, moneyAvailable: 0.02 * 1.3e12, hasAdminRights: true,
};
if (exportiert) {
  const tIst = C.hackTime({ reqSkill: ECORP.requiredHackingSkill, sec: 100 }, SP);
  const kz = C.targetMetrics(ECORP, SP, tIst, CFG);
  pruefe("Sicherheit 100: steadyEff > 0 (Fix B1 bleibt)", kz.steadyEff > 0, "steadyEff=" + kz.steadyEff);
  pruefe("pMin = hackPercent direkt bei minDifficulty",
    Math.abs(kz.pMin - C.hackPercent({ sec: 66, reqSkill: 1117 }, SP, 0.15)) < 1e-15);
  const tMin = tIst * (2.5 * 1117 * 66 + 500) / (2.5 * 1117 * 100 + 500);
  const soll = 4 * tIst + 4 * tMin;
  pruefe("Vorbereitung = weaken bei 100 + grow/weaken bei min (" + soll.toFixed(0) + " s)",
    Math.abs(kz.prepSec - soll) < 1e-6, "prepSec=" + kz.prepSec);
  // Kleines Netz: 680 weaken-Faeden (34 Sicherheit / 0,05) x 1,8 GB = 1.224 GB
  // passen nicht in 700 GB -> zwei Wellen hintereinander. Seit der
  // Gegenpruefung (26.09.2026) geht auch das Wachsen in Wellen: von 2 % auf
  // 95 % sind log(0,95/0,02)/kMin grow-Faeden plus 0,08 weaken je Faden -
  // bei ecorp rund 1.650 Faeden = 3,2 TB, in 700 GB also fuenf Wellen.
  const kzKlein = C.targetMetrics(ECORP, SP, tIst, { ...CFG, prepRamGb: 700 });
  const growGb = Math.log(0.95 / 0.02) / kz.kMin * (1.8 + (0.004 / 0.05) * 1.8);
  const growWellen = Math.ceil(growGb / 700);
  pruefe("kleines Netz: zwei weaken-Wellen und " + growWellen + " grow-Wellen statt je einer",
    growWellen >= 2 && Math.abs(kzKlein.prepSec - (2 * 4 * tIst + growWellen * 4 * tMin)) < 1e-6,
    "klein " + kzKlein.prepSec + " gross " + kz.prepSec + " growGb " + growGb.toFixed(0));

  const OPT = { horizonSec: 1800, prepMaxSec: 1200 };
  pruefe("neues Ziel mit Vorbereitung > 20 min: Rang 0 (Brennen-und-Sperren ausgeschlossen)",
    C.targetRank({ steadyEff: 1e9, prepSec: 1300 }, OPT, null) === 0);
  pruefe("neues Ziel: Rang = steadyEff x (1 - prep/Horizont)",
    Math.abs(C.targetRank({ steadyEff: 100, prepSec: 900 }, OPT, null) - 50) < 1e-9);
  pruefe("amtierendes Ziel: Bonus und nur die RESTLICHE Vorbereitung",
    Math.abs(C.targetRank({ steadyEff: 100, prepSec: 900 }, OPT, { restSec: 450, bonus: 1.3 }) - 97.5) < 1e-9);
  pruefe("amtierendes Ziel ist von prepMaxSec ausgenommen (es laeuft schon)",
    C.targetRank({ steadyEff: 100, prepSec: 1500 }, OPT, { restSec: 0, bonus: 1.3 }) === 130);

  const liste = [];
  for (let i = 0; i < 30; i++) liste.push({ host: "u" + i, rank: 100 - i, prepSec: 600 });
  for (let i = 0; i < 5; i++) liste.push({ host: "v" + i, rank: 10 - i, prepSec: 0 });
  const w = C.selectMoneyTargets(liste, { maxTargets: 25, maxUnprepared: 8, unpreparedSec: 60 });
  pruefe("selectMoneyTargets: alle 5 vorbereiteten bleiben", ["v0", "v1", "v2", "v3", "v4"].every((h) => w.includes(h)),
    JSON.stringify(w));
  pruefe("selectMoneyTargets: unvorbereitete bis max(8, 25-5) = 20", w.filter((h) => h[0] === "u").length === 20);
  const nachEinbau = C.selectMoneyTargets(liste.slice(0, 30), { maxTargets: 25, maxUnprepared: 8, unpreparedSec: 60 });
  pruefe("selectMoneyTargets: ohne vorbereitete (nach Einbau) alle 25 Plaetze", nachEinbau.length === 25);
}

// ---------------------------------------------------------------------------
// B. Der Kern im Mock
// ---------------------------------------------------------------------------
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

// Klares Erfahrungsziel, damit keines der Pruefziele es wird (wie test-b2).
const EXPZIEL = {
  ram: 8, used: 0, root: true, geld: 1e6, geldMax: 1e6, cores: 1, ports: 0,
  hackLevel: 1, sicherheit: 100, sicherheitMin: 1, wachstum: 50,
};

async function fahre(server, level, runden, beiRunde = null) {
  const m = neuerMock({
    host: "home", wall: 1_700_000_000_000, knoten: 5, nodeReset: 1000, geld: 1e9,
    server: { home: { ram: 200000, used: 0, root: true, geld: 0, cores: 1, ports: 0, hackLevel: 1 },
      expziel: { ...EXPZIEL }, ...server },
    dateien: grundDateien(), maxSchlaf: runden,
    skriptRam: {
      "worker/expfarm.js": 1.75, "worker/hack.js": 1.75,
      "worker/grow.js": 1.8, "worker/weaken.js": 1.8, "worker/share.js": 4,
    },
    beiSchlaf: (ms, z, vor) => {
      vor(10000);
      if (beiRunde) beiRunde(m, z);
      const t = JSON.parse(m.lies("home", "data/bn4net.json") || "null");
      if (t) rundenStand.push({ batch: t.batchZiele || [], ziele: t.zieleAnzahl });
    },
  });
  m.setze("spieler.skills.hacking", level);
  // Spielformel statt Mock-Konstante (Hacking.ts calculateHackingTime, alle
  // Mults 1, Int 0) - die Vorbereitungszeit haengt genau daran.
  const zeit = (h) => {
    const s = m.zustand.server[h];
    if (!s) return 5000;
    return 1000 * C.hackTime({ reqSkill: s.hackLevel, sec: s.sicherheit ?? 5 },
      { skill: level, int: 0, multSpeed: 1 });
  };
  m.ns.getHackTime = zeit;
  m.ns.getGrowTime = (h) => 3.2 * zeit(h);
  m.ns.getWeakenTime = (h) => 4 * zeit(h);
  const rundenStand = [];
  const { modul } = await ladeAusBeiden(ROOT, "bn4net.js");
  const zurueck = m.uhrStellen();
  try {
    await modul.main(m.ns);
  } catch (e) {
    if (!e.mockAbbruch) throw e;
  } finally {
    zurueck();
  }
  return { m, rundenStand };
}

const anZiel = (m, h) => m.zustand.gestartet.filter((g) => g.args[0] === h);

console.log("");
console.log("-- B1. Knotenwechsel: Sicherheit 100 mit einer Stunde weaken bleibt liegen --");
{
  // Level 500, req 400: weaken bei 100 = 4 x 5 x 100.500/550 s = 3.655 s.
  const { m } = await fahre({
    klein1: { ram: 0, used: 0, root: true, geld: 5e7, geldMax: 5e7, cores: 1, ports: 0,
      hackLevel: 50, sicherheit: 5, sicherheitMin: 5, wachstum: 40 },
    klein2: { ram: 0, used: 0, root: true, geld: 6e7, geldMax: 6e7, cores: 1, ports: 0,
      hackLevel: 60, sicherheit: 6, sicherheitMin: 6, wachstum: 40 },
    klein3: { ram: 0, used: 0, root: true, geld: 7e7, geldMax: 7e7, cores: 1, ports: 0,
      hackLevel: 70, sicherheit: 7, sicherheitMin: 7, wachstum: 40 },
    gross: { ram: 0, used: 0, root: true, geld: 2e9, geldMax: 1e11, cores: 1, ports: 0,
      hackLevel: 400, sicherheit: 100, sicherheitMin: 35, wachstum: 80 },
  }, 500, 4);
  const aufGross = anZiel(m, "gross");
  pruefe("kein Arbeiter auf 'gross' (Vorbereitung 61 min > 20 min)", aufGross.length === 0,
    aufGross.length + " Starts: " + [...new Set(aufGross.map((g) => g.datei))].join(","));
  pruefe("keine Anlaufsperre ausgesprochen", !m.zustand.log.concat(m.zustand.ausgabe)
    .some((z) => /gross: Anlauf nach/.test(z)));
  pruefe("die kleinen Ziele werden bedient", anZiel(m, "klein1").length > 0 && anZiel(m, "klein2").length > 0);
}

console.log("");
console.log("-- B2. Einspielen wie 18:04: vorbereitete Ziele bleiben Geldziele --");
{
  const server = {};
  // 30 Server auf Sicherheit 100, Level 3895, req 600: Vorbereitung
  // 4 x 5 x 150.500/3.945 + 4 x 5 x 53.000/3.945 = 763 + 269 = 1.032 s.
  for (let i = 0; i < 30; i++) {
    server["c" + i] = { ram: 0, used: 0, root: true, geld: 2e10, geldMax: 1e12, cores: 1, ports: 0,
      hackLevel: 600, sicherheit: 100, sicherheitMin: 35, wachstum: 80 };
  }
  for (let i = 0; i < 5; i++) {
    server["p" + i] = { ram: 0, used: 0, root: true, geld: 1e9, geldMax: 1e9, cores: 1, ports: 0,
      hackLevel: 100, sicherheit: 10, sicherheitMin: 10, wachstum: 60 };
  }
  const { m, rundenStand } = await fahre(server, 3895, 2);
  const hackP = [0, 1, 2, 3, 4].filter((i) => anZiel(m, "p" + i).some((g) => g.datei === "worker/hack.js"));
  pruefe("alle 5 vorbereiteten Ziele bekommen hack-Faeden (sie verdienen weiter)", hackP.length === 5,
    "mit hack: " + hackP.map((i) => "p" + i).join(",") + " | Geldziele " + JSON.stringify(rundenStand));
  const c = Object.keys(server).filter((h) => h[0] === "c" && anZiel(m, h).length > 0);
  pruefe("die neuen Sicherheit-100-Ziele laufen trotzdem an (B1 bleibt wirksam)", c.length >= 3,
    c.length + " angefasst");
}

console.log("");
console.log("-- B3. Hysterese: 15 % besser verdraengt kein amtierendes Stapelziel --");
{
  const gleich = { ram: 0, used: 0, root: true, cores: 1, ports: 0, hackLevel: 100,
    sicherheit: 10, sicherheitMin: 10, wachstum: 60 };
  const server = {
    s1: { ...gleich, geld: 1.0e9, geldMax: 1.0e9 },
    s2: { ...gleich, geld: 0.99e9, geldMax: 0.99e9 },
    s3: { ...gleich, geld: 0.98e9, geldMax: 0.98e9 },
    o1: { ...gleich, geld: 0.5e9, geldMax: 0.5e9 },
    o2: { ...gleich, geld: 0.4e9, geldMax: 0.4e9 },
    // Der Herausforderer: 15 % mehr Geld, sofort bereit - aber erst ab
    // Runde 2 gerootet (Portprogramm gekauft). ports 5, damit der Kern ihn
    // nicht selbst nuked (im Mock liegt kein Portprogramm).
    neu: { ...gleich, geld: 1.15e9, geldMax: 1.15e9, root: false, ports: 5 },
  };
  let gerootet = false;
  const { rundenStand } = await fahre(server, 3000, 5, (m) => {
    if (!gerootet) { m.zustand.server.neu.root = true; gerootet = true; }
  });
  const erste = (rundenStand[0] || {}).batch || [];
  const letzte = (rundenStand[rundenStand.length - 1] || {}).batch || [];
  pruefe("Runde 1: Stapel s1,s2,s3", ["s1", "s2", "s3"].every((h) => erste.includes(h)), JSON.stringify(erste));
  pruefe("'neu' ist ab Runde 2 Kandidat (ein Geldziel mehr) - sonst prueft der Fall nichts",
    (rundenStand[rundenStand.length - 1] || {}).ziele === (rundenStand[0] || {}).ziele + 1,
    JSON.stringify(rundenStand.map((r) => r.ziele)));
  pruefe("nach dem Rooten von 'neu' bleibt der Stapel s1,s2,s3",
    ["s1", "s2", "s3"].every((h) => letzte.includes(h)) && !letzte.includes("neu"),
    JSON.stringify(rundenStand.map((r) => r.batch)));
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
