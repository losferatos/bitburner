// Rechner Bereich NETZ (Audit 03.10.2026): Coding Contracts, Infiltration, DarkNet.
// Formeln als Code aus reference/bitburner-src/src (3.0.2), Eingaben aus einem
// Spielstand (backups/*.json.gz). Nur lesen, nichts schreiben.
//
// Aufruf: node tools/audit/netz-calc.mjs [muster]   (Default: juengster BN2L1-Stand)
//
// Teil A  Coding Contracts: gainCodingContractReward nachgebaut
//         (PersonObjects/Player/PlayerObjectGeneralMethods.ts:501-567) und
//         GEEICHT gegen jede GELOEST-Zeile im Spielprotokoll data/contracts.txt.
// Teil B  Infiltration: formulas/game.ts + formulas/victory.ts nachgebaut,
//         Standorte aus Locations/data/LocationsMetadata.ts geparst.
//         UNGEEICHT (kein Spielstand enthaelt eine Infiltration).
// Teil C  DarkNet ohne SF15: Cache-Geld (cacheFiles.ts:110-122), Phishing
//         (phishing.ts:12-68), Server-RAM (DarknetServerOptions.ts:206-211).
//         UNGEEICHT (kein Spielstand enthaelt DarkNet-Ertrag).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSave, pickFile } from "./netz-save.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = path.join(root, "reference", "bitburner-src", "src");

// ---------------------------------------------------------------------------
// Gemeinsame Spielkonstanten
// ---------------------------------------------------------------------------
// Constants.ts:91-93
const CC_FACTION = 2500;
const CC_COMPANY = 4000;
const CC_MONEY = 75e6;

// BitNode-Multiplikatoren der Restroute, abgeschrieben aus BitNode/BitNode.tsx:563-1124
// (nur die Felder dieses Bereichs; fehlend = 1). Stufe 1 bzw. die erste Stufe des Laufs.
const BN = {
  2: { CodingContractMoney: 1, InfiltrationMoney: 3, InfiltrationRep: 1, DarknetMoneyMultiplier: 1, FactionWorkRepGain: 0.5 },
  3: { CodingContractMoney: 1, InfiltrationMoney: 1, InfiltrationRep: 1, DarknetMoneyMultiplier: 0.4, FactionWorkRepGain: 1 },
  11: { CodingContractMoney: 0.25, InfiltrationMoney: 2.5, InfiltrationRep: 2.5, DarknetMoneyMultiplier: 1, FactionWorkRepGain: 1 },
  6: { CodingContractMoney: 1, InfiltrationMoney: 0.75, InfiltrationRep: 1, DarknetMoneyMultiplier: 1, FactionWorkRepGain: 1 },
  7: { CodingContractMoney: 1, InfiltrationMoney: 0.75, InfiltrationRep: 1, DarknetMoneyMultiplier: 1, FactionWorkRepGain: 1 },
  14: { CodingContractMoney: 1, InfiltrationMoney: 0.75, InfiltrationRep: 1, DarknetMoneyMultiplier: 1, FactionWorkRepGain: 0.2 },
  13: { CodingContractMoney: 0.4, InfiltrationMoney: 1, InfiltrationRep: 1, DarknetMoneyMultiplier: 0.1, FactionWorkRepGain: 0.6 },
  15: { CodingContractMoney: 1, InfiltrationMoney: 1, InfiltrationRep: 1, DarknetMoneyMultiplier: 1, FactionWorkRepGain: 1 },
  8: { CodingContractMoney: 0, InfiltrationMoney: 0, InfiltrationRep: 1, DarknetMoneyMultiplier: 0, FactionWorkRepGain: 1 },
};

// ---------------------------------------------------------------------------
// Teil A - Coding Contracts
// ---------------------------------------------------------------------------
// Schwierigkeit je Typ: CodingContract/contracts/*.ts (difficulty:)
const DIFF = {
  "Find Largest Prime Factor": 1, "Subarray with Maximum Sum": 1, "Total Ways to Sum": 1,
  "Total Ways to Sum II": 2, "Spiralize Matrix": 2, "Array Jumping Game": 2, "Array Jumping Game II": 3,
  "Merge Overlapping Intervals": 3, "Generate IP Addresses": 3, "Algorithmic Stock Trader I": 1,
  "Algorithmic Stock Trader II": 2, "Algorithmic Stock Trader III": 4, "Algorithmic Stock Trader IV": 8,
  "Minimum Path Sum in a Triangle": 5, "Unique Paths in a Grid I": 3, "Unique Paths in a Grid II": 5,
  "Shortest Path in a Grid": 7, "Sanitize Parentheses in Expression": 10, "Find All Valid Math Expressions": 10,
  "HammingCodes: Integer to Encoded Binary": 6, "HammingCodes: Encoded Binary to Integer": 9,
  "Proper 2-Coloring of a Graph": 7, "Compression I: RLE Compression": 2, "Compression II: LZ Decompression": 4,
  "Compression III: LZ Compression": 10, "Encryption I: Caesar Cipher": 1, "Encryption II: Vigenère Cipher": 2,
  "Square Root": 5, "Total Number of Primes": 2, "Largest Rectangle in a Matrix": 6,
};

// Nachbau von gainCodingContractReward fuer einen Spieler OHNE Job.
// Rueckgabe: Liste moeglicher Ergebnisse {kind, perFaction|single|money}.
// Achtung Falle (sequenzielle Mutation): der Firmenzweig ohne Job ruft die
// Funktion mit dem SCHON GEDRITTELTEN Skalierungsfaktor erneut auf und
// drittelt ein zweites Mal -> 1/9 (PlayerObjectGeneralMethods.ts:511, :541-552).
export function ccReward(type, difficulty, rewardScaling, nFactions, moneyMult) {
  const adj = rewardScaling / 3;
  switch (type) {
    case "FR": return { kind: "single", rep: CC_FACTION * difficulty * adj };
    case "FRA": return { kind: "each", rep: Math.floor((CC_FACTION * difficulty * adj) / nFactions) };
    case "CR": return [ccReward("FR", difficulty, adj, nFactions, moneyMult), ccReward("FRA", difficulty, adj, nFactions, moneyMult)];
    case "M": return { kind: "money", money: CC_MONEY * difficulty * moneyMult * adj };
  }
  throw new Error("typ " + type);
}

function homeText(servers, name) {
  const home = servers.home.data || servers.home;
  const e = home.textFiles.data.find(([k]) => k === name);
  return e ? (e[1].data || e[1]).text : "";
}

// Eichung: jede GELOEST-Zeile seit dem letzten "Start", der im aktuellen Knoten liegt.
function calibrateContracts(servers, startMarker, moneyMult) {
  const lines = homeText(servers, "data/contracts.txt").split("\n");
  let from = 0;
  for (let i = 0; i < lines.length; i++) if (lines[i].includes(startMarker)) from = i;
  const res = { checked: 0, ok: 0, fail: [], money: 0, rep: 0, count: 0 };
  for (const l of lines.slice(from)) {
    const m = l.match(/GELOEST\s+\S+\s+\[([^\]]+)\].*Lohn: (.*)$/);
    if (!m) continue;
    const typ = m[1];
    const lohn = m[2];
    const d = DIFF[typ];
    res.count++;
    let soll = [];
    let ist = null;
    let mm;
    if ((mm = lohn.match(/Gained \$([\d.]+)m/))) {
      ist = Number(mm[1]) * 1e6;
      soll = [ccReward("M", d, 1, 1, moneyMult).money];
      res.money += ist;
    } else if ((mm = lohn.match(/Gained ([\d.]+) faction reputation for/))) {
      ist = Number(mm[1]);
      soll = [ccReward("FR", d, 1, 1, moneyMult).rep, ccReward("CR", d, 1, 1, moneyMult)[0].rep];
      res.rep += ist;
    } else if ((mm = lohn.match(/Gained (\d+) reputation for each of the following factions: (.*)$/))) {
      ist = Number(mm[1]);
      const n = mm[2].split(", ").length;
      soll = [ccReward("FRA", d, 1, n, moneyMult).rep, ccReward("CR", d, 1, n, moneyMult)[1].rep];
      res.rep += ist * n;
    }
    res.checked++;
    const treffer = soll.some((s) => Math.abs(s - ist) <= Math.max(1e-6 * Math.abs(s), 0.6e-3 * (ist > 1e6 ? ist : 0) + 1e-9));
    if (treffer) res.ok++;
    else res.fail.push(typ + " d=" + d + " ist=" + ist + " soll=" + soll.join("/"));
  }
  return res;
}

// Erwartungswert je Vertrag fuer N Hacking-Faktionen, ohne Job.
// Gleichverteilt ueber die gueltigen Belohnungstypen (ContractGenerator.ts:179-189),
// gleichverteilt ueber die 30 Typen (getRandomProblemType, maxDif = 2*SF+1 >= 10).
export function ccExpected(moneyMult) {
  const ds = Object.values(DIFF);
  const meanD = ds.reduce((a, b) => a + b, 0) / ds.length;
  const types = moneyMult > 0 ? ["FR", "FRA", "CR", "M"] : ["FR", "FRA", "CR"];
  let rep = 0, money = 0;
  for (const t of types) {
    if (t === "FR") rep += CC_FACTION * meanD / 3;
    if (t === "FRA") rep += CC_FACTION * meanD / 3; // Summe ueber alle Faktionen (floor vernachlaessigt)
    if (t === "CR") rep += CC_FACTION * meanD / 9;
    if (t === "M") money += CC_MONEY * meanD * moneyMult / 3;
  }
  return { meanD, rep: rep / types.length, money: money / types.length };
}
// Erzeugungstakt: 3 Versuche je 10 min (engine.tsx:204-207), p = 100/(399+e^(0,0012 n)) (ContractGenerator.ts:62)
const CC_PER_HOUR = 6 * 3 * (100 / (399 + Math.exp(0)));

// ---------------------------------------------------------------------------
// Teil B - Infiltration
// ---------------------------------------------------------------------------
export function parseLocations() {
  const txt = fs.readFileSync(path.join(SRC, "Locations", "data", "LocationsMetadata.ts"), "utf8");
  const out = [];
  let cur = {};
  for (const line of txt.split("\n")) {
    if (/^  \{/.test(line)) cur = {};
    let m;
    if ((m = line.match(/city: CityName\.(\w+)/))) cur.city = m[1];
    if ((m = line.match(/maxClearanceLevel: ([\d.]+)/))) cur.maxLevel = Number(m[1]);
    if ((m = line.match(/startingSecurityLevel: ([\d.]+)/))) cur.sec = Number(m[1]);
    if ((m = line.match(/name: LocationName\.(\w+)/))) {
      cur.name = m[1];
      if (cur.sec != null) out.push({ ...cur });
    }
  }
  return out;
}

const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);
// formulas/game.ts:41-57
const rawDiff = (stats, startSec, int) => clamp(startSec - Math.pow(stats, 0.9) / 250 - int / 1600, 0, Infinity);
export const infilDifficulty = (skills, startSec) =>
  rawDiff(skills.strength + skills.defense + skills.dexterity + skills.agility + skills.charisma, startSec, skills.intelligence);
export const infilReward = (startSec, int) => clamp(rawDiff(465, startSec, int), 0, 3);
// formulas/victory.ts:8-63 (ohne WKSharmonizer)
export function sellCash(reward, maxLevel, sec, demand, bnMoney) {
  return Math.pow(reward + 1, 2) * Math.pow(sec, 3) * demand * 3e3 * maxLevel * Math.pow(1.01, maxLevel) * bnMoney;
}
export function tradeRep(reward, maxLevel, sec, demand, bnRep) {
  let bal;
  if (sec < 4) bal = 0.45; else if (sec < 5) bal = 0.4; else if (sec < 7) bal = 0.35; else if (sec < 12) bal = 0.3;
  else if (sec < 14) bal = 0.26; else if (sec < 15) bal = 0.25; else bal = 0.2;
  return Math.pow(reward + 1, 1.1) * Math.pow(sec, 1.1) * bal * demand * 30 * maxLevel * Math.pow(1.005, maxLevel) * bnRep;
}

// Zeitmodell eines Laufs mit perfekter Steuerung (direkter onKey-Aufruf, keine Fehler):
// Countdown 3 x 300 ms (CountdownModel.ts:10); Slash wartet die Wachphase ab
// (SlashModel.ts: guardingTime = U*3250+1500-(window+250), Mittel 3125-(window+250)),
// Minesweeper 2 s Gedaechtnisphase (MinesweeperModel.ts:102), die sechs anderen
// sind sofort loesbar (Annahme 0,2 s fuer Neuzeichnen). Spielwahl gleichverteilt ueber 8
// (Infiltration.ts:194-203, ohne Wiederholung der letzten zwei - Mittel bleibt).
function slashWindow(diff) {
  const S = { Trivial: 800, Normal: 500, Hard: 350, Brutal: 250 };
  if (diff < 1) return S.Trivial + (S.Normal - S.Trivial) * diff;
  if (diff < 2) return S.Normal + (S.Hard - S.Normal) * (diff - 1);
  if (diff < 3) return S.Hard + (S.Brutal - S.Hard) * (diff - 2);
  return S.Brutal;
}
export function runSeconds(maxLevel, startDiff, overhead = 6) {
  let t = overhead;
  for (let lvl = 1; lvl <= maxLevel; lvl++) {
    const d = startDiff + lvl / 50; // Infiltration.ts:91-93
    const slash = (3125 - (slashWindow(d) + 250)) / 1000 + 0.05;
    const games = (slash + 2.0 + 6 * 0.2) / 8;
    t += 0.9 + games;
  }
  return t;
}

// Marktnachfrage: floors klingen mit e^(-2e-5 * ms) ab (Tau 50 s), jeder Lauf legt
// maxLevel nach, Stempel = Laufbeginn (formulas/game.ts:5-39, Victory.tsx:42-45).
// Bei Periode T (Beginn zu Beginn) gilt im Gleichgewicht f = L q/(1-q), q = e^(-T/50).
export function bestPeriod(maxLevel, runS) {
  let best = null;
  for (let T = Math.ceil(runS); T <= 3600; T += 1) {
    const q = Math.exp(-T / 50);
    const f = (maxLevel * q) / (1 - q);
    const demand = clamp(1 - 1e-3 * f * f, 0, 1);
    const perH = (demand * 3600) / T;
    if (!best || perH > best.perH) best = { T, demand, perH };
  }
  return best;
}

// ---------------------------------------------------------------------------
// Teil C - DarkNet ohne SF15 (Netztiefe 5, labyrinth.ts:486-497)
// ---------------------------------------------------------------------------
export function cacheMoney(difficulty, p, dnetMult) {
  // cacheFiles.ts:110-122, ohne SF15.3
  return Math.pow(1.2, difficulty) * 1e7 * ((200 + p.skills.charisma) / 200) * p.mults.crime_money * (p.mults.dnet_money ?? 1) * dnetMult;
}
export function phishing(p, threads, depth, dnetMult) {
  // phishing.ts:12-68
  const cha = p.skills.charisma;
  const waitS = Math.max(10000 * (400 / (400 + cha)), 200) / 1000;
  const cacheChance = Math.min(1, 0.005 * p.mults.crime_success * threads * ((400 + cha) / 400));
  const moneyChance = 0.05 * p.mults.crime_success * ((200 + cha) / 200);
  const moneyEach = 500 * p.mults.crime_money * (p.mults.dnet_money ?? 1) * (0.1 + depth * 0.05) * threads * ((400 + cha) / 400) * 1.05 * dnetMult;
  // Cache hoechstens alle 3 min (phishing.ts:70-73): erwartete Zeit bis Cache = 180 s + Wartezeit nach Ablauf
  const cacheEveryS = 180 + waitS / cacheChance;
  const attemptsPerH = 3600 / waitS;
  const moneyPerH = attemptsPerH * (1 - Math.min(1, waitS / cacheEveryS)) * moneyChance * moneyEach;
  return { waitS, cacheChance, moneyChance, moneyEach, cachesPerH: 3600 / cacheEveryS, moneyPerH };
}
// Erwartetes Geld je Cache: 4 Belohnungsarten bei Phishing-Cache ohne CCT-Abkuehlung,
// 5 mit (cacheFiles.ts:59-69). Programme/Konto/Aktien/Datei fallen bei Sattheit auf Geld
// zurueck - Obergrenze: jede Ziehung = Geld; Untergrenze: nur der direkte Geldzweig.
export function cacheExpectation(difficulty, p, dnetMult) {
  const m = cacheMoney(difficulty, p, dnetMult);
  return { low: m / 5, high: m };
}

// ---------------------------------------------------------------------------
function fmt(x, d = 3) {
  if (x == null || !Number.isFinite(x)) return String(x);
  const a = Math.abs(x);
  if (a >= 1e9) return (x / 1e9).toFixed(d) + " Mrd";
  if (a >= 1e6) return (x / 1e6).toFixed(d) + " Mio";
  if (a >= 1e3) return (x / 1e3).toFixed(d) + " k";
  return x.toFixed(d);
}

function main() {
  const file = pickFile(process.argv[2] || "BN2L1");
  const { player: p, servers } = loadSave(file);
  const bnN = p.bitNodeN;
  const mults = BN[bnN] || BN[2];
  const hNode = p.playtimeSinceLastBitnode / 3.6e6;
  const ms = p.moneySourceB.data || p.moneySourceB;
  console.log("Stand:", path.basename(file), " BN" + bnN, " h im Knoten", hNode.toFixed(3));
  console.log("Skills:", JSON.stringify(p.skills));
  console.log("Geldquellen seit Knoten: hacking", fmt(ms.hacking), " codingcontract", fmt(ms.codingcontract),
    " darknet", fmt(ms.darknet ?? 0), " infiltration", fmt(ms.infiltration ?? 0));
  const hackPerH = ms.hacking / hNode;
  console.log("Hacking-Einkommen Mittel seit Knoten:", fmt(hackPerH) + "/h");

  // ---- A
  console.log("\n=== A Coding Contracts ===");
  const cal = calibrateContracts(servers, "02:43:04 === Start auf werk-0", mults.CodingContractMoney);
  console.log("Eichung gegen data/contracts.txt (BN2-Fenster):", cal.ok + "/" + cal.checked, "Zeilen exakt",
    cal.fail.length ? "ABWEICHUNG: " + cal.fail.join(" | ") : "");
  console.log("  gemessen: " + cal.count + " Vertraege in " + hNode.toFixed(2) + " h = " + (cal.count / hNode).toFixed(2) +
    "/h; Ruf " + fmt(cal.rep) + " (" + fmt(cal.rep / hNode) + "/h), Geld " + fmt(cal.money) + " (" + fmt(cal.money / hNode) + "/h)");
  console.log("  Formel-Erwartung: " + CC_PER_HOUR.toFixed(2) + " Vertraege/h");
  for (const n of [2, 3, 11, 6, 7, 14, 13, 15, 8]) {
    const e = ccExpected(BN[n].CodingContractMoney);
    console.log("  BN" + n + ": E[d]=" + e.meanD.toFixed(3) + "  je Vertrag Ruf " + fmt(e.rep) + ", Geld " + fmt(e.money) +
      "  -> je h Ruf " + fmt(e.rep * CC_PER_HOUR) + ", Geld " + fmt(e.money * CC_PER_HOUR));
  }

  // ---- B
  console.log("\n=== B Infiltration (Stand-Skills, Nachfrage optimiert) ===");
  const locs = parseLocations();
  const rows = [];
  for (const L of locs) {
    const diff = infilDifficulty(p.skills, L.sec);
    const feasible = diff < 3.5; // formulas/game.ts:4, Infiltration.ts:97-108
    const rew = infilReward(L.sec, p.skills.intelligence);
    const cash1 = sellCash(rew, L.maxLevel, L.sec, 1, 1);
    const rep1 = tradeRep(rew, L.maxLevel, L.sec, 1, 1);
    const runS = runSeconds(L.maxLevel, diff);
    const per = bestPeriod(L.maxLevel, runS);
    rows.push({ ...L, diff, feasible, rew, cash1, rep1, runS, T: per.T, demand: per.demand,
      cashPerH1: cash1 * per.perH, repPerH1: rep1 * per.perH });
  }
  rows.sort((a, b) => b.cashPerH1 - a.cashPerH1);
  console.log("Standorte gesamt:", rows.length, " machbar (Schwierigkeit < 3,5):", rows.filter((r) => r.feasible).length);
  console.log("name | city | sec | L | diff | reward | Lauf s | Periode s | Nachfrage | $ je Lauf (x1) | Ruf je Lauf (x1) | $/h (x1) | Ruf/h (x1)");
  for (const r of rows.filter((r) => r.feasible).slice(0, 12)) {
    console.log([r.name, r.city, r.sec, r.maxLevel, r.diff.toFixed(3), r.rew.toFixed(3), r.runS.toFixed(1), r.T,
      r.demand.toFixed(3), fmt(r.cash1), fmt(r.rep1), fmt(r.cashPerH1), fmt(r.repPerH1)].join(" | "));
  }
  const bestCash = rows.filter((r) => r.feasible).sort((a, b) => b.cashPerH1 - a.cashPerH1)[0];
  const bestRep = rows.filter((r) => r.feasible).sort((a, b) => b.repPerH1 - a.repPerH1)[0];
  console.log("Bester Geldort:", bestCash.name, " bester Rufort:", bestRep.name);
  for (const n of [2, 3, 11, 6, 7, 14, 13, 15, 8]) {
    console.log("  BN" + n + ": Geld/h " + fmt(bestCash.cashPerH1 * BN[n].InfiltrationMoney) +
      "  Ruf/h " + fmt(bestRep.repPerH1 * BN[n].InfiltrationRep));
  }
  console.log("Vergleich BN2 jetzt: Geld x" + ((bestCash.cashPerH1 * mults.InfiltrationMoney) / hackPerH).toFixed(2) +
    " des Hacking-Einkommens; Ruf x" + ((bestRep.repPerH1 * mults.InfiltrationRep) / (cal.rep / hNode)).toFixed(1) +
    " des gemessenen Vertragsrufs");
  // Empfindlichkeit: wenn die Steuerung doppelt so langsam ist
  const slow = bestPeriod(bestRep.maxLevel, runSeconds(bestRep.maxLevel, bestRep.diff, 12) * 2);
  console.log("Empfindlichkeit (Lauf doppelt so lang + 12 s Gemeinkosten):", bestRep.name, " Ruf/h",
    fmt(bestRep.rep1 * slow.perH * mults.InfiltrationRep), " Geld/h", fmt(bestRep.cash1 * slow.perH * mults.InfiltrationMoney));
  // Schwellen: welche Kampfsumme oeffnet welchen Ort
  const top = rows.slice().sort((a, b) => b.cash1 - a.cash1).slice(0, 6);
  console.log("Lukrativste Orte ueberhaupt (Freischaltung, wenn Kampf+cha-Summe S: S^0,9/250 > sec - 3,5 - int/1600):");
  for (const r of top) {
    const need = Math.pow(Math.max(0, (r.sec - 3.5 - p.skills.intelligence / 1600) * 250), 1 / 0.9);
    console.log("  " + r.name + " sec " + r.sec + " L " + r.maxLevel + "  $ je Lauf x1 " + fmt(r.cash1) + "  braucht Summe > " + need.toFixed(0) +
      " (jetzt " + (p.skills.strength + p.skills.defense + p.skills.dexterity + p.skills.agility + p.skills.charisma) + ")");
  }

  // ---- C
  console.log("\n=== C DarkNet ohne SF15 (Netztiefe 5) ===");
  const dm = mults.DarknetMoneyMultiplier;
  for (const d of [0, 2, 4]) {
    const c = cacheExpectation(d, p, dm);
    console.log("  Cache Schwierigkeit " + d + ": Geldzweig " + fmt(cacheMoney(d, p, dm)) + ", Erwartung " + fmt(c.low) + " .. " + fmt(c.high));
  }
  // Variante a: nur der Server darkweb (16 GB, Admin, Tiefe -1, Schwierigkeit 0; NetworkGenerator.ts:68-88)
  const thrA = Math.floor(16 / (1.6 + 2));
  const phA = phishing(p, thrA, -1, dm);
  const a = phA.moneyPerH + phA.cachesPerH * cacheExpectation(0, p, dm).high;
  console.log("  a) nur darkweb, " + thrA + " Faeden Phishing: Caches/h " + phA.cachesPerH.toFixed(2) + ", Phishing-Geld/h " + fmt(phA.moneyPerH) +
    ", gesamt hoechstens " + fmt(a) + "/h");
  // Variante b: ganzes kleines Netz geknackt: ~ 5*8*0,6-10 = 14 + Auffuellen auf je 5 in Zeile 0/1 (NetworkGenerator.ts:101-103) ~ 16-20 Server,
  // RAM 16 * 2^floor(d/6) * Mutation, mind. 16 (DarknetServerOptions.ts:206-211) -> Mittel 17,76 GB bei d<=4
  const nSrv = 18;
  const ram = nSrv * (16 + 16 + 16 + 18.4 + 22.4) / 5 + 16;
  const thrB = Math.floor(ram / 3.6);
  const phB = phishing(p, thrB, 2, dm);
  const b = phB.moneyPerH + phB.cachesPerH * cacheExpectation(2, p, dm).high;
  console.log("  b) " + nSrv + " Server geknackt (" + ram.toFixed(0) + " GB), " + thrB + " Faeden: Caches/h " + phB.cachesPerH.toFixed(2) +
    ", Phishing-Geld/h " + fmt(phB.moneyPerH) + ", gesamt hoechstens " + fmt(b) + "/h");
  console.log("  Anteil am BN2-Hacking-Einkommen: a " + ((a / hackPerH) * 100).toFixed(2) + " %, b " + ((b / hackPerH) * 100).toFixed(2) + " %");
  console.log("  Zugang: 50 Mio (Constants.ts:8) je Einbauzyklus, Programm faellt beim Einbau (Prestige.ts:72-102)");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
