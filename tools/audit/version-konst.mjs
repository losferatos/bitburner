// VERSION-KONST (Audit 03.10.2026, Robustheit "Version 3.0.1 -> 3.0.2").
//
// Tabellengetriebene Pruefung der HART KODIERTEN Spielkonstanten im Bot (src/, src/lib/) gegen den
// Spielquelltext beider Fassungen: v3.0.1 = LAUFENDES Spiel, dev = "3.0.2" (Stand 13.08.2026).
// Jede Zeile: Wert im Bot (per Regex aus der Bot-Datei gelesen, damit eine Aenderung im Bot auffaellt),
// Wert in reference/v301 und in reference/bitburner-src (per Regex aus dem Quelltext).
//
// SELBSTPROBE: Die letzten zwei Zeilen sind absichtlich falsch (Bot-Regex trifft eine andere Zahl):
// sie MUESSEN als ABWEICHUNG erscheinen, sonst ist die Pruefung blind.
//
// Aufruf: node tools/audit/version-konst.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..", "..");
const BOT = (f) => fs.readFileSync(path.join(ROOT, "src", f), "utf8");
const LIVE = (f) => fs.readFileSync(path.join(ROOT, "reference", "v301", "src", f), "utf8");
const DEV = (f) => fs.readFileSync(path.join(ROOT, "reference", "bitburner-src", "src", f), "utf8");

const zahl = (s) => {
  const t = String(s).replace(/_/g, "").trim();
  // nur Zahlenausdruecke zulassen
  if (!/^[0-9eE.+\-*/() ]+$/.test(t)) throw new Error("kein Zahlenausdruck: " + t);
  return Function("return (" + t + ")")();
};
const holen = (text, re, label) => {
  const m = re.exec(text);
  if (!m) throw new Error("Muster nicht gefunden: " + label + " " + re);
  return zahl(m[1]);
};
const ZEILEN = [];
// c(id, botDatei, botRegex, spielDatei, spielRegex, fn?)  fn rechnet den Spielwert aus dem Treffer um
function c(id, botDatei, botRe, spielDatei, spielRe, opt = {}) {
  ZEILEN.push({ id, botDatei, botRe, spielDatei, spielRe, opt });
}

// --- Server- und Hackformeln (lib/calc.js) --------------------------------------------------------
const SC = "Server/data/Constants.ts";
c("ServerBaseGrowthIncr", "lib/calc.js", /SERVER_BASE_GROWTH_INCR = ([0-9.]+)/, SC, /ServerBaseGrowthIncr: ([0-9.]+)/);
c("ServerMaxGrowthLog", "lib/calc.js", /SERVER_MAX_GROWTH_LOG = ([0-9.]+)/, SC, /ServerMaxGrowthLog: ([0-9.]+)/);
c("ServerFortifyAmount", "lib/calc.js", /SERVER_FORTIFY_AMOUNT = ([0-9.]+)/, SC, /ServerFortifyAmount: ([0-9.]+)/);
c("ServerWeakenAmount", "lib/calc.js", /SERVER_WEAKEN_AMOUNT = ([0-9.]+)/, SC, /ServerWeakenAmount: ([0-9.]+)/);
c("GrowTimeFactor", "lib/calc.js", /GROW_TIME_FACTOR = ([0-9.]+)/, "Hacking.ts", /growTimeMultiplier = ([0-9.]+)/);
c("WeakenTimeFactor", "lib/calc.js", /WEAKEN_TIME_FACTOR = ([0-9.]+)/, "Hacking.ts", /weakenTimeMultiplier = ([0-9.]+)/);
c("Fortify bn4net FORTIFY_HACK", "bn4net.js", /FORTIFY_HACK = ([0-9.]+)/, SC, /ServerFortifyAmount: ([0-9.]+)/);
c("Fortify bn4net FORTIFY_GROW = 2x", "bn4net.js", /FORTIFY_GROW = ([0-9.]+)/, SC, /ServerFortifyAmount: ([0-9.]+)/, { faktor: 2 });
c("Wachstum Hackzeit-Basis 5 (hackTimeMultiplier)", "lib/calc.js", /hackTimeMultiplier = ([0-9.]+)|HACK_TIME_BASE = ([0-9.]+)|\* ?(5) \* ?skillFactor/, "Hacking.ts", /hackTimeMultiplier = ([0-9.]+)/, { optional: true });

// --- Allgemeine Konstanten ------------------------------------------------------------------------
c("TravelCost", "travel.js", /TRAVEL_COST = ([0-9e.]+)/, "Constants.ts", /TravelCost: ([0-9e.]+)/);
c("MultipleAugMultiplier", "buyaugs.js", /QUEUE_MULT = ([0-9.]+)/, "Constants.ts", /MultipleAugMultiplier: ([0-9.]+)/);
c("NeuroFluxGovernorLevelMult", "buyaugs.js", /NFG_LEVEL_MULT = ([0-9.]+)/, "Constants.ts", /NeuroFluxGovernorLevelMult: ([0-9.]+)/);
c("HospitalCostPerHp", "blade.js", /HOSPITAL_KOSTEN_JE_HP = ([0-9e.]+)/, "Constants.ts", /HospitalCostPerHp: ([0-9e.]+)/);
c("TorRouterCost (darkweb.js:102)", "darkweb.js", /geld\(\) < ([0-9e.]+)\)/, "Constants.ts", /TorRouterCost: ([0-9e.]+)/);
c("BaseFavorToDonate (donate/bn4rep)", "donate.js", /BaseFavorToDonate|150/, "Constants.ts", /BaseFavorToDonate: ([0-9]+)/, { optional: true });

// --- Aktienmarkt ----------------------------------------------------------------------------------
const SMC = "StockMarket/data/Constants.ts";
c("StockMarketCommission boerse", "boerse.js", /KOMMISSION = ([0-9e.]+)/, SMC, /StockMarketCommission: ([0-9e.]+)/);
c("StockMarketCommission stocks", "stocks.js", /KOMMISSION = ([0-9e.]+)/, SMC, /StockMarketCommission: ([0-9e.]+)/);
c("msPerStockUpdate (boerse TAKT_MS)", "boerse.js", /TAKT_MS = ([0-9]+)/, SMC, /msPerStockUpdate: ([0-9e.]+)/);

// --- Heimrechner ----------------------------------------------------------------------------------
c("HomeComputerMaxRam", "homeram.js", /HOME_MAX_RAM = ([0-9]+)/, SC, /HomeComputerMaxRam: ([0-9]+)/);
c("BaseCostFor1GBOfRamHome", "homeram.js", /BASE_COST_PER_GB_HOME = ([0-9]+)/, SC, /BaseCostFor1GBOfRamHome: ([0-9]+)/);
c("Heim-RAM-Exponent 1.58", "homeram.js", /Math\.pow\(([0-9.]+), Math\.log2\(currentRam\)\)/, "PersonObjects/Player/PlayerObjectServerMethods.ts", /Math\.pow\(([0-9.]+), numUpgrades\)/);
c("Heim-Kerne 7.5", "homeram.js", /1e9 \* Math\.pow\(([0-9.]+), currentCores\)/, "PersonObjects/Player/PlayerObjectServerMethods.ts", /1e9 \* Math\.pow\(([0-9.]+), this\.getHomeComputer\(\)\.cpuCores\)/);

// --- Hashes (Hacknet/data/HashUpgradesMetadata.tsx) -----------------------------------------------
const HU = "Hacknet/data/HashUpgradesMetadata.tsx";

// --- Faktionen / Favor -----------------------------------------------------------------------------
c("log(1.02) Favor-Formel", "bn4rep.js", /LOG_1_02 = ([0-9.]+)/, "Faction/formulas/favor.ts", /const log1point02 = ([0-9.]+)/);

// ------------------------------------------------------------------------------------------------------
function laufe() {
  const aus = [];
  for (const z of ZEILEN) {
    let bot, live, dev, fehler = null;
    try {
      const bt = BOT(z.botDatei);
      const mb = z.botRe.exec(bt);
      if (!mb) throw new Error("Bot-Muster nicht gefunden");
      bot = zahl(mb.slice(1).find((x) => x !== undefined));
    } catch (e) { fehler = String(e.message); }
    try {
      live = holen(LIVE(z.spielDatei), z.spielRe, z.id + " live");
      dev = holen(DEV(z.spielDatei), z.spielRe, z.id + " dev");
    } catch (e) { fehler = (fehler ? fehler + "; " : "") + String(e.message); }
    const f = z.opt.faktor || 1;
    const sollL = live === undefined ? undefined : live * f;
    const sollD = dev === undefined ? undefined : dev * f;
    const ok = (a, b) => a !== undefined && b !== undefined && Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(b));
    aus.push({ id: z.id, bot, live: sollL, dev: sollD, okLive: ok(bot, sollL), okDev: ok(bot, sollD), gleichLD: ok(sollL, sollD), fehler, optional: !!z.opt.optional, botDatei: z.botDatei });
  }
  return aus;
}

// Selbstprobe: absichtlich falsche Zeilen
{
  const probe = { id: "SELBSTPROBE falsch", botDatei: "travel.js", botRe: /TRAVEL_COST = ([0-9e.]+)/, spielDatei: "Constants.ts", spielRe: /TorRouterCost: ([0-9e.]+)/ };
  // TravelCost und TorRouterCost sind beide 200e3 -> NICHT geeignet; stattdessen Hospital (100e3) gegen Travel (200e3)
  probe.spielRe = /HospitalCostPerHp: ([0-9e.]+)/;
  ZEILEN.push({ ...probe, opt: {} });
}
const erg = laufe();
let rot = 0;
console.log("Konstante".padEnd(50) + "Bot".padStart(16) + "live(v301)".padStart(16) + "dev".padStart(16) + "  Urteil");
for (const r of erg) {
  const f = (x) => (x === undefined ? "?" : String(x));
  let urteil;
  if (r.fehler) urteil = (r.optional ? "(optional) " : "FEHLER ") + r.fehler;
  else if (r.id.startsWith("SELBSTPROBE")) urteil = !r.okLive && !r.okDev ? "OK (Probe wurde als Abweichung erkannt)" : "ROT - Probe nicht erkannt!";
  else if (r.okLive && r.okDev) urteil = "OK (beide Fassungen)";
  else if (r.okLive) urteil = "OK live, ABWEICHUNG dev";
  else if (r.okDev) urteil = "ABWEICHUNG live, OK dev";
  else urteil = "ABWEICHUNG beide";
  if (r.id.startsWith("SELBSTPROBE") ? !( !r.okLive && !r.okDev) : (r.fehler ? !r.optional : !(r.okLive))) rot++;
  console.log(r.id.padEnd(50) + f(r.bot).padStart(16) + f(r.live).padStart(16) + f(r.dev).padStart(16) + "  " + urteil);
}

// --- Zusatz: Rechnungen, die keine Regex-Konstante sind ---------------------------------------------------
console.log("\nZUSATZ");
{
  const t = LIVE("Faction/formulas/favor.ts");
  const l1 = Number(/const log1point02 = ([0-9.]+)/.exec(t)[1]);
  const rep150 = 25000 * Math.expm1(l1 * 150);
  const bot = Number(/ZIEL_REP = ([0-9]+)/.exec(BOT("favorweg.js"))[1]);
  console.log("favorToRep(150) = 25000*expm1(log1.02*150) = " + rep150.toFixed(2) + "  | favorweg.js ZIEL_REP = " + bot + "  | Differenz " + (bot - rep150).toFixed(2) + " (Bot rundet ab; Spiel verlangt rep >= " + Math.ceil(rep150) + ")");
}
{
  // Black Ops: Raenge in src/lib/blackops.json gegen BlackOperations.ts beider Fassungen
  const j = JSON.parse(BOT("lib/blackops.json"));
  const lese = (text) => {
    const out = [];
    for (const m of text.matchAll(/\[BladeburnerBlackOpName\.(\w+)\]: new BlackOperation\(\{[^]*?reqdRank: ([0-9e.]+)/g)) out.push([m[1], zahl(m[2])]);
    return out;
  };
  const L = lese(LIVE("Bladeburner/data/BlackOperations.ts")), D = lese(DEV("Bladeburner/data/BlackOperations.ts"));
  let dif = 0;
  for (let i = 0; i < j.ops.length; i++) {
    if (!L[i] || L[i][0] !== j.ops[i].name || L[i][1] !== j.ops[i].rang) dif++;
    if (!D[i] || D[i][0] !== j.ops[i].name || D[i][1] !== j.ops[i].rang) dif++;
  }
  console.log("blackops.json: " + j.ops.length + " Operationen, Quelle live " + L.length + " / dev " + D.length + ", Abweichungen (Name oder Rang) " + dif);
}
{
  // Darkweb-Preise
  const t = BOT("darkweb.js");
  const bot = [...t.matchAll(/\{ name: "([A-Za-z]+\.exe)", preis: ([0-9e.]+) \}/g)].map((m) => [m[1], zahl(m[2])]);
  const lese = (s) => [...s.matchAll(/new DarkWebItem\(CompletedProgramName\.(\w+), ([0-9e.]+),/g)].map((m) => [m[1], zahl(m[2])]);
  const L = Object.fromEntries(lese(LIVE("DarkWeb/DarkWebItems.ts"))), D = Object.fromEntries(lese(DEV("DarkWeb/DarkWebItems.ts")));
  const map = { "BruteSSH.exe": "bruteSsh", "FTPCrack.exe": "ftpCrack", "relaySMTP.exe": "relaySmtp", "HTTPWorm.exe": "httpWorm", "SQLInject.exe": "sqlInject", "Formulas.exe": "formulas" };
  for (const [n, p] of bot) console.log("Darkweb " + n.padEnd(14) + " Bot " + p + " live " + L[map[n]] + " dev " + D[map[n]] + (p === L[map[n]] && p === D[map[n]] ? "  OK" : "  ABWEICHUNG"));
}
{
  const t = BOT("netburner.js");
  const lvl = Number(/ZIEL_LEVEL = ([0-9]+)/.exec(t)[1]), ram = Number(/ZIEL_RAM = ([0-9]+)/.exec(t)[1]), cores = Number(/ZIEL_CORES = ([0-9]+)/.exec(t)[1]);
  const lese = (s) => { const m = /totalHacknetRam\((\d+)\), totalHacknetCores\((\d+)\), totalHacknetLevels\((\d+)\)/.exec(s); return m ? [+m[1], +m[2], +m[3]] : null; };
  console.log("Netburners: Bot ram=" + ram + " cores=" + cores + " level=" + lvl + " | live " + JSON.stringify(lese(LIVE("Faction/FactionInfo.tsx"))) + " | dev " + JSON.stringify(lese(DEV("Faction/FactionInfo.tsx"))));
}
{
  // Hash-Upgrades: Bloecke der Metadatendatei parsen (cost, costPerLevel, value je HashUpgradeEnum-Name)
  const lese = (text) => {
    const out = {};
    for (const b of text.split(/\n  \{\n/).slice(1)) {
      const name = /name: HashUpgradeEnum\.(\w+)/.exec(b);
      if (!name) continue;
      const cpl = /costPerLevel: ([0-9.]+)/.exec(b);
      const cost = /\n    cost: ([0-9.]+)/.exec(b);
      const val = /\n    value: ([0-9e.]+)/.exec(b);
      out[name[1]] = { cost: cost ? +cost[1] : cpl ? +cpl[1] : null, costPerLevel: cpl ? +cpl[1] : null, value: val ? zahl(val[1]) : null };
    }
    return out;
  };
  const HU = "Hacknet/data/HashUpgradesMetadata.tsx";
  const L = lese(LIVE(HU)), D = lese(DEV(HU));
  const b = BOT("hashes.js");
  const rang = Number(/RANG_PREIS_JE_STUFE = ([0-9]+)/.exec(b)[1]);
  const rangJe = Number(/RANG_JE_STUFE = ([0-9]+)/.exec(b)[1]);
  const gym = Number(/GYM_PREIS_JE_STUFE = ([0-9]+)/.exec(b)[1]);
  const zeile = (id, bot, l, d) => console.log("Hash " + id.padEnd(46) + " Bot " + String(bot).padStart(5) + " live " + String(l).padStart(5) + " dev " + String(d).padStart(5) + (bot === l && bot === d ? "  OK" : "  ABWEICHUNG"));
  zeile("ExchangeForBladeburnerRank costPerLevel", rang, L.ExchangeForBladeburnerRank.costPerLevel, D.ExchangeForBladeburnerRank.costPerLevel);
  zeile("ExchangeForBladeburnerRank value (Rang/Stufe)", rangJe, L.ExchangeForBladeburnerRank.value, D.ExchangeForBladeburnerRank.value);
  zeile("ImproveGymTraining costPerLevel", gym, L.ImproveGymTraining.costPerLevel, D.ImproveGymTraining.costPerLevel);
  console.log("Hash SellForMoney (Bot-Kommentar: 4 Hashes je 1 Mio): live cost=" + L.SellForMoney.cost + " value=" + L.SellForMoney.value + " | dev cost=" + D.SellForMoney.cost + " value=" + D.SellForMoney.value);
}
console.log("\nrote Zeilen (Abweichung gegen LIVE, Fehler, oder Probe nicht erkannt): " + rot);
