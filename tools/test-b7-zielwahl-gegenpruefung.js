/**
 * Gegenpruefung Skeptiker B (26.09.2026) - Zielwahl und Anlauf.
 *
 * Die Befunde stammen aus einer Nachspielung des ECHTEN bn4net.js ueber
 * 540-1.080 Runden gegen die Spielstaende 18:04, 19:03, 19:04 und einen
 * daraus gebauten Knotenwechsel (skeptiker-B.md, Abschnitt Gegenpruefung).
 * Dieser Test prueft jeden Befund einzeln gegen den echten Code:
 *
 *   A. lib/calc.js targetMetrics: das Wachsen geht in Wellen in die
 *      Vorbereitungszeit ein. Vorher stand pauschal EINE grow/weaken-Dauer -
 *      hong-fang-tea nach einem Knotenwechsel (2 % Guthaben, 8,7 TB grow in
 *      einem 1-TB-Netz) galt mit 47 s als "vorbereitet".
 *   B. Einteilung vorbereitet/unvorbereitet nach effectivePrepSec: ein
 *      laufendes Stapelziel, dessen Sicherheit zwischen zwei landenden
 *      weaken-Wellen kurz ueber Minimum + 1 steht, belegt keinen der acht
 *      Plaetze fuer unvorbereitete Ziele. Vorher pendelte der achte Platz
 *      jede Runde (Nachspielung 19:03: 746 Ein-/Austritte in 90 min).
 *   C. Anlauffrist ueber eine Stapelphase hinweg: ein Ziel, das nach kurzem
 *      Anlauf 25 min Stapelziel war und zurueck in den offenen Betrieb
 *      faellt, wird NICHT sofort "nach 25 min ohne Erfolg" gesperrt.
 *      Gegenprobe: ununterbrochener Anlauf und Pendeln im Rundentakt werden
 *      weiterhin nach 20 min gesperrt.
 *
 * Kern im Mock: tools/mock/lader.js, getHackTime nach der Spielformel
 * (Hacking.ts calculateHackingTime), Arbeiter "landen" am Rundenende (sonst
 * zaehlte der Kern sie ewig als fliegend und haette nie neuen Bedarf).
 *
 * Aufruf: node tools/test-b7-zielwahl-gegenpruefung.js
 */

import path from "node:path";
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
console.log("=== Gegenpruefung Skeptiker B - Zielwahl und Anlauf ===");

const C = await import(pathToFileURL(path.join(ROOT, "src", "lib", "calc.js")).href);

// ---------------------------------------------------------------------------
// A. Wachsen in Wellen
// ---------------------------------------------------------------------------
console.log("");
console.log("-- A. targetMetrics: grow geht in Wellen in die Vorbereitung ein --");
{
  // hong-fang-tea aus dem Spielstand 19:04 (req 30, min 10, wachstum 20,
  // moneyMax 7,5e7), frisch nach einem Knotenwechsel in BN5: Guthaben
  // 7,5e7 x 0,5 / 25 = 2 % (Server.ts:76-77), Sicherheit schon am Minimum
  // (in der Nachspielung nach 29 min erreicht). Stand der Nachspielung nach
  // 45 min: Level 250, Netz 884 GB -> die Anlaufphase rechnet mit 30 % =
  // 265 GB je Welle. Quelldateien SF1.3 x SF5.2 = 1,4336, Intelligenz 146.
  const SP = { skill: 250, int: 146, multMoney: 1.4336, multChance: 1.4336, multGrow: 1.4336, multSpeed: 1.4336 };
  const HFT = {
    hostname: "hong-fang-tea", hackDifficulty: 10, minDifficulty: 10, requiredHackingSkill: 30,
    serverGrowth: 20, moneyMax: 7.5e7, moneyAvailable: 1.5e6, hasAdminRights: true,
  };
  const CFG = {
    ramHackT: 1.75, ramGrowT: 1.8, ramWeakenT: 1.8, bnScriptHackMoney: 0.15, bnServerGrowthRate: 1,
    mixMoneyHigh: 0.95, kapAbzug: 0.2, secOk: 1.0, moneyLow: 0.75, prepRamGb: 0.3 * 884,
  };
  const tIst = C.hackTime({ reqSkill: 30, sec: 10 }, SP);
  const kz = C.targetMetrics(HFT, SP, tIst, CFG);
  // Erwartung von Hand: k am Minimum, Faeden bis 95 %, 0,08 weaken je Faden.
  const k = C.growthLogPerThread({ sec: 10, growth: 20 }, SP.multGrow, 1, 1);
  const faeden = Math.log(0.95 / 0.02) / k;
  const gb = faeden * (1.8 + 0.08 * 1.8);
  const wellen = Math.ceil(gb / CFG.prepRamGb);
  pruefe("hong-fang-tea: " + Math.round(faeden) + " grow-Faeden = " + Math.round(gb) + " GB -> "
    + wellen + " Wellen x 4 hackTime (" + (wellen * 4 * tIst).toFixed(0) + " s)",
    Math.abs(kz.prepSec - wellen * 4 * tIst) < 1e-6, "prepSec " + kz.prepSec.toFixed(1)
      + " (eine Welle waere " + (4 * tIst).toFixed(1) + " s)");
  pruefe("hong-fang-tea gilt NICHT als vorbereitet (> 60 s)", kz.prepSec > 60, "prepSec " + kz.prepSec.toFixed(1));
  pruefe("als neues Ziel: Rang 0 (> 20 min Vorbereitung, sonst Anlauf, Frist, Sperre)",
    C.targetRank(kz, { horizonSec: 1800, prepMaxSec: 1200 }, null) === 0,
    "Rang " + C.targetRank(kz, { horizonSec: 1800, prepMaxSec: 1200 }, null));
  // Viel Speicher (hohes Level, grosses Netz): weiterhin genau eine Welle.
  const kzGross = C.targetMetrics(HFT, SP, tIst, { ...CFG, prepRamGb: 1e9 });
  pruefe("grosses Netz: eine grow-Welle wie bisher", Math.abs(kzGross.prepSec - 4 * tIst) < 1e-6,
    "prepSec " + kzGross.prepSec);
  // Volles Guthaben: kein grow-Anteil.
  const kzVoll = C.targetMetrics({ ...HFT, moneyAvailable: HFT.moneyMax }, SP, tIst, CFG);
  pruefe("volles Guthaben, Sicherheit am Minimum: Vorbereitung 0", kzVoll.prepSec === 0, "prepSec " + kzVoll.prepSec);
}

// ---------------------------------------------------------------------------
// B. Einteilung nach der verbleibenden Vorbereitung
// ---------------------------------------------------------------------------
console.log("");
console.log("-- B. effectivePrepSec: laufende Ziele belegen keinen Unvorbereitet-Platz --");
const hatEff = typeof C.effectivePrepSec === "function";
pruefe("lib/calc.js exportiert effectivePrepSec", hatEff);
if (hatEff) {
  pruefe("neues Ziel: die geschaetzte Vorbereitung", C.effectivePrepSec(111, null) === 111);
  pruefe("amtierend, Eintrittsschaetzung abgelaufen: 0", C.effectivePrepSec(111, { restSec: -40 }) === 0);
  pruefe("amtierend, noch 50 s Rest: 50", C.effectivePrepSec(111, { restSec: 50 }) === 50);
  pruefe("amtierend, Zustand verlangt weniger als der Rest: der Zustand",
    C.effectivePrepSec(20, { restSec: 50 }) === 20);
  pruefe("targetRank rechnet mit derselben Zahl",
    Math.abs(C.targetRank({ steadyEff: 100, prepSec: 900 }, { horizonSec: 1800, prepMaxSec: 1200 },
      { restSec: 450, bonus: 1.3 }) - 100 * 1.3 * (1 - C.effectivePrepSec(900, { restSec: 450 }) / 1800)) < 1e-9);
}

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
const EXPZIEL = {
  ram: 8, used: 0, root: true, geld: 1e6, geldMax: 1e6, cores: 1, ports: 0,
  hackLevel: 1, sicherheit: 100, sicherheitMin: 1, wachstum: 50,
};
const ARBEITER = new Set(["worker/hack.js", "worker/grow.js", "worker/weaken.js", "worker/expfarm.js"]);

/**
 * Faehrt den echten Kern `runden` Runden. beiRunde(m, rundeNr) laeuft nach
 * jeder Runde (Zustand aendern, Dateien legen). Arbeiter enden am
 * Rundenende. Liefert je Runde die Ziele, auf die Arbeiter gestartet wurden.
 */
async function fahre(server, level, runden, beiRunde = null) {
  const jeRunde = [];
  let rundeNr = 0;
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
      rundeNr++;
      const wall = z.wall;
      jeRunde.push(new Set(z.gestartet.filter((g) => g.wall === wall).map((g) => String(g.args[0]))));
      // Arbeiter landen: Speicher frei, Prozess weg.
      for (let i = z.prozesse.length - 1; i >= 0; i--) {
        const p = z.prozesse[i];
        if (!ARBEITER.has(p.filename)) continue;
        z.server[p.host].used = Math.max(0, z.server[p.host].used - p.gb);
        z.prozesse.splice(i, 1);
      }
      vor(10000);
      if (beiRunde) beiRunde(m, rundeNr);
    },
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
  return { m, jeRunde };
}

console.log("");
console.log("-- B. Kern: ein Stapelziel zwischen zwei Wellen laesst den achten Platz nicht pendeln --");
{
  // Wie 19:03, verkleinert: 3 Stapelziele ganz oben, 10 Server auf
  // Sicherheit 100 (Vorbereitung ~220 s, also "unvorbereitet"), 18
  // vorbereitete darunter. 20-21 vorbereitete Kandidaten -> hoechstens
  // max(8, 25 - 20) = 8 unvorbereitete Geldziele. b0 steht ab Runde 2 jede
  // zweite Runde 3 Punkte ueber dem Minimum, wie zwischen zwei landenden
  // weaken-Wellen eines Stapels (weaken bei req 200, Sicherheit 33, Level
  // 3000: 4 x 27,9 s = 111 s "Vorbereitung" im Augenblick).
  const server = {};
  const basis = { ram: 0, used: 0, root: true, cores: 1, ports: 0 };
  for (let i = 0; i < 3; i++) {
    server["b" + i] = { ...basis, hackLevel: 200, sicherheit: 30, sicherheitMin: 30, wachstum: 80,
      geld: 1e12 * (1 - 0.01 * i), geldMax: 1e12 * (1 - 0.01 * i) };
  }
  for (let i = 0; i < 10; i++) {
    server["u" + i] = { ...basis, hackLevel: 100, sicherheit: 100, sicherheitMin: 30, wachstum: 80,
      geld: 0.02 * 1e11 * (1 - 0.01 * i), geldMax: 1e11 * (1 - 0.01 * i) };
  }
  for (let i = 0; i < 18; i++) {
    server["p" + i] = { ...basis, hackLevel: 100, sicherheit: 30, sicherheitMin: 30, wachstum: 80,
      geld: 1e10 * (1 - 0.01 * i), geldMax: 1e10 * (1 - 0.01 * i) };
  }
  const RUNDEN = 14;
  const { jeRunde } = await fahre(server, 3000, RUNDEN, (m, n) => {
    if (n >= 1) m.zustand.server.b0.sicherheit = n % 2 === 1 ? 33 : 30;
  });
  // Ab Runde 3 (b0 wechselt ab Runde 2), bis zur vorletzten vollstaendigen.
  const folge = jeRunde.slice(2, RUNDEN - 1).map((s) => (s.has("u7") ? 1 : 0));
  let wechsel = 0;
  for (let i = 1; i < folge.length; i++) if (folge[i] !== folge[i - 1]) wechsel++;
  pruefe("u7 (achter unvorbereiteter Platz) wechselt nicht mit b0s Sicherheit", wechsel === 0,
    wechsel + " Wechsel in " + folge.length + " Runden, Folge " + folge.join(""));
  pruefe("u7 wird durchgehend bedient (b0 ist vorbereitet, 8 Plaetze fuer u0..u7)",
    folge.length > 0 && folge.every((x) => x === 1), "Folge " + folge.join(""));
  const u8 = jeRunde.slice(2, RUNDEN - 1).filter((s) => s.has("u8")).length;
  pruefe("u8 bleibt draussen (Deckel 8 wirkt weiter)", u8 === 0, u8 + " Runden mit u8");
}

// ---------------------------------------------------------------------------
// C. Anlauffrist ueber eine Stapelphase hinweg
// ---------------------------------------------------------------------------
console.log("");
console.log("-- C. Anlauffrist: nur zusammenhaengender Anlauf zaehlt --");
function anlaufServer() {
  const basis = { ram: 0, used: 0, root: true, cores: 1, ports: 0, hackLevel: 100, wachstum: 80 };
  return {
    // Sicherheit 30 bei Minimum 10: im Anlauf (> Minimum + 5), Vorbereitung
    // 1 weaken-Welle = 4 x 13,1 s = 52 s, Frist also die festen 20 min.
    x: { ...basis, sicherheit: 30, sicherheitMin: 10, geld: 1e12, geldMax: 1e12 },
    o1: { ...basis, sicherheit: 10, sicherheitMin: 10, geld: 1e10, geldMax: 1e10 },
    o2: { ...basis, sicherheit: 10, sicherheitMin: 10, geld: 0.9e10, geldMax: 0.9e10 },
  };
}
const gesperrtNach = (m) => m.zustand.log.filter((z) => /\bx: Anlauf nach/.test(z));
{
  // Runden 1-3 offen im Anlauf, 4-153 Stapelziel (25 min), danach wieder offen.
  const { m } = await fahre(anlaufServer(), 3000, 170, (mm, n) => {
    mm.lege("home", "data/batch-ziele.txt", n >= 3 && n < 153 ? "1" : "0");
  });
  const s = gesperrtNach(m);
  pruefe("nach 25 min als Stapelziel: KEINE Sperre bei der Rueckkehr in den offenen Anlauf",
    s.length === 0, s.join(" / "));
}
{
  // Gegenprobe 1: ununterbrochener Anlauf wird nach der Frist gesperrt.
  const { m } = await fahre(anlaufServer(), 3000, 130, (mm) => {
    mm.lege("home", "data/batch-ziele.txt", "0");
  });
  const s = gesperrtNach(m);
  pruefe("Gegenprobe: 21 min ununterbrochener Anlauf -> gesperrt", s.length === 1, s.join(" / ") || "keine Sperre");
}
{
  // Gegenprobe 2: Pendeln im Rundentakt (jede zweite Runde Stapelziel) setzt
  // die Frist nicht zurueck.
  const { m } = await fahre(anlaufServer(), 3000, 140, (mm, n) => {
    mm.lege("home", "data/batch-ziele.txt", n % 2 === 1 ? "1" : "0");
  });
  const s = gesperrtNach(m);
  pruefe("Gegenprobe: Pendeln im Rundentakt -> nach der Frist trotzdem gesperrt", s.length >= 1,
    s.join(" / ") || "keine Sperre");
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
