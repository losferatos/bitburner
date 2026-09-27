/**
 * Was ein Sleeve in einem Hackingknoten (V1: BN1/5/8/12) am meisten bringt -
 * GERECHNET aus dem Spielquellcode, GEEICHT gegen Spielstaende.
 *
 * WARUM (27.09.2026)
 *
 * sleeve.js setzte die Sleeves in V1-Knoten auf `sleeveMin < 40 ? "Shoplift"
 * : "Mug"`. sleeveMin ist das Minimum aller vier Kampfwerte, Shoplift
 * trainiert aber nur dex/agi - str/def bleiben bei 1, also ewig Shoplift.
 * Im BN5-Lauf 3 standen die drei Sleeves damit 20 Stunden lang auf einem
 * Verbrechen, das bei $19 Mrd Kontostand nichts mehr bedeutet. Bevor das
 * umgebaut wird, steht hier, WAS stattdessen traegt - mit Zahlen.
 *
 * NACHGEBAUT (reference/bitburner-src/src, Version 3.0.2):
 *   - Sleeve/Work/SleeveFactionWork.ts    Rate = calculateFactionRep * shockBonus
 *   - formulas/reputation.ts              getHackingWorkRepGain, Security, Field
 *   - Work/Formulas.ts                    calculateFactionExp, calculateClassEarnings,
 *                                         calculateCrimeWorkStats
 *   - Sleeve/Work/Work.ts                 applySleeveGains: eigene Exp voll, Spieler
 *                                         mal sync, ANDERE Sleeves mal sync*ihr shock
 *   - Sleeve/Sleeve.ts:263-275            process: max 15 Zyklen, Schock sinkt
 *                                         0,0001*intBonus(int,0.75) je Zyklus
 *   - Sleeve/Work/SleeveRecoveryWork.ts   zusaetzlich 0,0002*intBonus je Zyklus
 *   - Sleeve/Work/SleeveSynchroWork.ts    sync += 0,0002*intBonus(SPIELER-int,0.5)
 *   - Crime/Crime.ts:120-136              successRate
 *   - formulas/skill.ts                   calculateSkill
 *   - BitNode/BitNode.tsx                 Multiplikatoren fuer BN1, 5, 8, 12
 *
 * WICHTIG, AUS DEM QUELLCODE UND AUS DEN BACKUPS BELEGT: Ein Aug-Einbau des
 * Spielers setzt die Sleeves NICHT zurueck. `prestigeAugmentation`
 * (PlayerObjectGeneralMethods.ts:118) setzt nur die AUFGABE (Recovery bzw.
 * Synchronize); Exp, Schock und Sync bleiben. Zurueckgesetzt wird erst beim
 * Knotenwechsel (`prestigeSourceFile` -> `sleeve.prestige()`, Schock 100,
 * Exp 0, sync = memory). Beleg: Backup 15:32 pre-install Schock 65,06 /
 * dex-Exp 11.430, Backup 16:08 nach dem Einbau Schock 63,96 / dex-Exp 12.176.
 * Der Horizont fuer Sleeve-Investitionen ist also der ganze Knoten (12-24 h
 * in V1, INDEX.tsv), nicht der Einbauzyklus (2-3,4 h).
 *
 * Aufruf:
 *   node tools/sleeve-rechnung.js            Eichung + Vergleich
 *   node tools/sleeve-rechnung.js --eichen   nur die Eichung
 */

import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

// --- Konstanten und Formeln, 1:1 aus dem Quellcode -------------------------

const MAX_SKILL = 975;            // Constants.ts:16
const INT_CRIME_WEIGHT = 0.025;   // Constants.ts:50
const CPS = 5;                    // 1000 / MilliPerCycle

export const intBonus = (int, w = 1) => 1 + (w * Math.pow(int, 0.8)) / 600;
export const skillAusExp = (exp, mult = 1) =>
  mult === 0 ? 1 : Math.max(1, Math.floor(mult * (32 * Math.log(exp + 534.6) - 200)));

// BitNode.tsx getBitNodeMultipliers - nur die Felder, die hier zaehlen.
// BN12 Stufe 1 (noch keine SF12): dec = 1/1,02.
export function bnMults(n, lvl = 1) {
  const d = { HackingLevelMultiplier: 1, StrengthLevelMultiplier: 1, DefenseLevelMultiplier: 1,
    DexterityLevelMultiplier: 1, AgilityLevelMultiplier: 1, FactionWorkRepGain: 1,
    FactionWorkExpGain: 1, CrimeMoney: 1, CrimeExpGain: 1, CrimeSuccessRate: 1 };
  if (n === 5) return { ...d, CrimeMoney: 0.5 };
  if (n === 8) return { ...d, CrimeMoney: 0 };
  if (n === 12) {
    const dec = 1 / Math.pow(1.02, lvl);
    return { ...d, HackingLevelMultiplier: dec, StrengthLevelMultiplier: dec,
      DefenseLevelMultiplier: dec, DexterityLevelMultiplier: dec, AgilityLevelMultiplier: dec,
      FactionWorkRepGain: dec, FactionWorkExpGain: dec, CrimeMoney: dec, CrimeExpGain: dec };
  }
  return d;
}

// Sleeve ohne Augs: alle Personen-Multiplikatoren 1. Der Share-Bonus
// (NetworkShare/Share.ts, 1 + ln(Faeden)/25) ist global und wirkt auf Spieler
// und Sleeve gleich - bei hacking auf alles, bei security/field nur auf den
// (hacking+int)-Teil. Er steht nicht im Spielstand; die Eichung unten liest
// ihn aus der gemessenen Spielerrate zurueck (~1,28 in BN5L3).
export function skills(sl, bn) {
  return {
    hacking: skillAusExp(sl.exp.hacking, bn.HackingLevelMultiplier),
    strength: skillAusExp(sl.exp.strength, bn.StrengthLevelMultiplier),
    defense: skillAusExp(sl.exp.defense, bn.DefenseLevelMultiplier),
    dexterity: skillAusExp(sl.exp.dexterity, bn.DexterityLevelMultiplier),
    agility: skillAusExp(sl.exp.agility, bn.AgilityLevelMultiplier),
    charisma: 1,
    intelligence: sl.int,
  };
}

// reputation.ts - je Zyklus, ohne shock
export function repJeZyklus(sk, typ, favor, bn, factionRepMult = 1, share = 1) {
  const favorMult = (1 + favor / 100) * bn.FactionWorkRepGain;
  const ib = intBonus(sk.intelligence, 1);
  if (typ === "hacking") {
    return ((sk.hacking + sk.intelligence / 3) / MAX_SKILL) * factionRepMult * ib * favorMult * share;
  }
  if (typ === "security") {
    const t = (0.9 * (sk.strength + sk.defense + sk.dexterity + sk.agility
      + (sk.hacking + sk.intelligence) * share)) / MAX_SKILL / 4.5;
    return t * factionRepMult * favorMult * ib;
  }
  // field
  const t = (0.9 * (sk.strength + sk.defense + sk.dexterity + sk.agility + sk.charisma
    + (sk.hacking + sk.intelligence) * share)) / MAX_SKILL / 5.5;
  return t * factionRepMult * favorMult * ib;
}

// Work/Formulas.ts FactionWorkStats / CPS * FactionWorkExpGain
const FAKTION_EXP = {
  hacking: { hacking: 2 },
  field: { hacking: 1, strength: 1, defense: 1, dexterity: 1, agility: 1, charisma: 1 },
  security: { hacking: 0.5, strength: 1.5, defense: 1.5, dexterity: 1.5, agility: 1.5 },
};

// Crime/Crimes.ts
export const VERBRECHEN = {
  Shoplift: { zeit: 2, geld: 15e3, schwer: 1 / 20, w: { dexterity: 1, agility: 1 },
    exp: { dexterity: 2, agility: 2 } },
  Mug: { zeit: 4, geld: 36e3, schwer: 1 / 5, w: { strength: 1.5, defense: 0.5, dexterity: 1.5, agility: 0.5 },
    exp: { strength: 3, defense: 3, dexterity: 3, agility: 3 } },
};

export function crimeChance(sk, name, bn, crimeSuccess = 1) {
  const c = VERBRECHEN[name];
  let chance = 0;
  for (const [k, v] of Object.entries(c.w)) chance += v * sk[k];
  chance += INT_CRIME_WEIGHT * sk.intelligence;
  chance = chance / MAX_SKILL / c.schwer * crimeSuccess * bn.CrimeSuccessRate * intBonus(sk.intelligence, 1);
  return Math.min(chance, 1);
}

// Geld je Sekunde (Geld ist NICHT geschockt: scaleWorkStats(..., false)).
export const crimeGeldJeSek = (sk, name, bn) =>
  crimeChance(sk, name, bn) * VERBRECHEN[name].geld * bn.CrimeMoney / VERBRECHEN[name].zeit;

// ClassWork.tsx Algorithms (hackExp 4, 320 $), Rothman costMult 3 expMult 2
const UNI = { hackExp: 4, geld: 320, expMult: 2, costMult: 3 };
// ZB Institute of Technology, Volhaven: expMult 4, costMult 5
// (LocationsMetadata.ts:421-426) - braucht eine Reise (ns.sleeve.travel, +4 GB).
const UNI_ZB = { hackExp: 4, geld: 320, expMult: 4, costMult: 5 };

// --- Simulation -------------------------------------------------------------
//
// Alle Sleeves tun dasselbe (symmetrisch). Je Sekunde 5 Zyklen, wie
// Sleeve.process ohne Rueckstand. Exp je Zyklus eines Sleeves:
//   eigen:   rate*shock
//   fremd:   (n-1) * rate*shock_andere * sync * shock_eigen   (Work.ts:24)
// Bei symmetrischen Sleeves ist shock_andere = shock_eigen.

function neu(start) {
  return { exp: { hacking: 0, strength: 0, defense: 0, dexterity: 0, agility: 0, ...start.exp },
    int: start.int, shock: start.shock, sync: start.sync };
}

function zyklusExp(sl, typ, bn, uni = UNI) {
  if (typ === "uni") return { hacking: uni.hackExp * uni.expMult / CPS };
  if (typ.startsWith("crime:")) return null;   // stueckweise, siehe unten
  const e = {};
  for (const [k, v] of Object.entries(FAKTION_EXP[typ])) e[k] = v * bn.FactionWorkExpGain / CPS;
  return e;
}

/**
 * policy(t, sl, sk) -> "hacking" | "security" | "field" | "uni" | "recovery"
 *                      | "sync" | "crime:Shoplift" | "crime:Mug" | "best"
 * "best" = die Faktionsart mit der hoechsten Rate jetzt (so baut es sleeve.js).
 */
export function simuliere({ start, policy, bn, stunden, n = 3, favor = 0, arten = ["hacking", "security", "field"], spielerInt = 147, share = 1, uni = UNI }) {
  const sl = neu(start);
  let rep = 0, geld = 0, crimeRest = 0;
  const schritte = Math.round(stunden * 3600);
  for (let s = 0; s < schritte; s++) {
    const sk = skills(sl, bn);
    let typ = policy(s / 3600, sl, sk);
    if (typ === "best") {
      typ = arten.slice().sort((a, b) => repJeZyklus(sk, b, favor, bn, 1, share) - repJeZyklus(sk, a, favor, bn, 1, share))[0];
    }
    const zyk = 5;
    const shockB = (100 - sl.shock) / 100;
    // Schockabbau aus Sleeve.process (jede Arbeit), plus Recovery.
    sl.shock = Math.max(0, sl.shock - 0.0001 * intBonus(sl.int, 0.75) * zyk);
    if (typ === "recovery") {
      sl.shock = Math.max(0, sl.shock - 0.0002 * intBonus(sl.int, 0.75) * zyk);
      continue;
    }
    if (typ === "sync") {
      sl.sync = Math.min(100, sl.sync + intBonus(spielerInt, 0.5) * 0.0002 * zyk);
      continue;
    }
    const teiler = 1 + (n - 1) * (sl.sync / 100) * shockB;   // eigen + fremd
    if (typ.startsWith("crime:")) {
      const name = typ.slice(6);
      const c = VERBRECHEN[name];
      crimeRest += zyk;
      const noetig = c.zeit * CPS;
      while (crimeRest > noetig) {
        crimeRest -= noetig;
        const p = crimeChance(sk, name, bn);
        geld += p * c.geld * bn.CrimeMoney;
        const f = p + (1 - p) * 0.25;   // Fehlschlag: Exp mal 0,25
        for (const [k, v] of Object.entries(c.exp)) sl.exp[k] += v * bn.CrimeExpGain * shockB * f * teiler;
      }
      continue;
    }
    const e = zyklusExp(sl, typ, bn, uni);
    for (const [k, v] of Object.entries(e)) sl.exp[k] += v * shockB * zyk * teiler;
    if (typ === "uni") { geld -= uni.geld * uni.costMult / CPS * zyk; continue; }
    rep += repJeZyklus(sk, typ, favor, bn, 1, share) * shockB * zyk;
  }
  return { repJeStunde: rep / stunden, geldJeStunde: geld / stunden, ende: { ...skills(sl, bn), shock: sl.shock, sync: sl.sync } };
}

// --- Eichung gegen Spielstaende --------------------------------------------

function ladeSave(datei) {
  let s = JSON.parse(zlib.gunzipSync(fs.readFileSync(datei)).toString("utf8"));
  if (typeof s === "string") s = JSON.parse(s);
  const p = JSON.parse(s.data.PlayerSave).data;
  const facs = JSON.parse(s.data.FactionsSave);
  return { p, facs };
}

function backupDir() {
  // Der Worktree hat keine backups/ (gitignored) - dann die Hauptarbeitskopie.
  for (const d of [path.join(ROOT, "backups"), path.resolve(ROOT, "..", "..", "..", "backups")]) {
    if (fs.existsSync(path.join(d, "INDEX.tsv"))) return d;
  }
  return null;
}

export function eichen() {
  const dir = backupDir();
  if (!dir) { console.log("  UEBERSPRUNGEN: backups/ nicht gefunden"); return null; }
  const namen = [
    "LIVE_197f4d61481686_BN5L3_2026-09-27T15-08_hourly.json.gz",
    "LIVE_197f4d61481686_BN5L3_2026-09-27T15-32_pre-install.json.gz",
    "LIVE_197f4d61481686_BN5L3_2026-09-27T16-08_hourly.json.gz",
  ].map((n) => path.join(dir, n));
  if (!namen.every((n) => fs.existsSync(n))) { console.log("  UEBERSPRUNGEN: Eichbackups fehlen"); return null; }
  const [a, b, c] = namen.map(ladeSave);
  const bn = bnMults(5);
  const out = {};

  // 1. Stufe aus Exp - exakt (ganzzahlig), Spieler UND Sleeve.
  const p = c.p;
  const hackRechnung = skillAusExp(p.exp.hacking, p.mults.hacking * bn.HackingLevelMultiplier);
  const dexSleeve = skillAusExp(p.sleeves[0].data.exp.dexterity, 1);
  console.log("  Stufe aus Exp: Spieler hacking " + hackRechnung + " (Spielstand " + p.skills.hacking
    + "), Sleeve 0 dex " + dexSleeve + " (Spielstand " + p.sleeves[0].data.skills.dexterity + ")");
  out.stufe = hackRechnung === p.skills.hacking && dexSleeve === p.sleeves[0].data.skills.dexterity;

  // 2. Schockabbau: Delta / (0,0001 * intBonus(int, 0,75)) muss fuer ALLE
  //    drei Sleeves dieselbe GANZE Zyklenzahl ergeben (sie laufen im selben
  //    Takt). Das prueft Formel, intBonus-Gewicht und Exponent zugleich.
  for (const [x, y, name] of [[a, b, "15:08->15:32"], [b, c, "15:32->16:08 (ueber den Einbau)"]]) {
    const zyk = x.p.sleeves.map((s, i) => {
      const d0 = s.data, d1 = y.p.sleeves[i].data;
      return (d0.shock - d1.shock) / (0.0001 * intBonus(d0.skills.intelligence, 0.75));
    });
    const spiel = (y.p.totalPlaytime - x.p.totalPlaytime) / 200;
    console.log("  Schock " + name + ": Zyklen je Sleeve " + zyk.map((z) => z.toFixed(9)).join(" / ")
      + "  (Spielzeit/200 = " + spiel.toFixed(1) + ")");
    out["schock " + name] = zyk.every((z) => Math.abs(z - Math.round(z)) < 1e-6 && Math.round(z) === Math.round(zyk[0]));
  }

  // 3. Spieler-Faktionsrate BitRunners (hacking), 15:08 -> 15:32: gemessen
  //    ueber cyclesWorked der laufenden Arbeit. Hacking stieg dabei von 831
  //    auf 846. Ohne Share-Bonus liegt die Messung 27-29 % UEBER der Formel
  //    - das ist der Share-Bonus (share.js laeuft), und er steht nirgends im
  //    Spielstand. Also wird er hier zurueckgerechnet (Intervall aus beiden
  //    Enden) und an einer ZWEITEN, unabhaengigen Stelle gegengeprueft:
  //    security-Arbeit fuer Slum Snakes um 16:08, bei der der Bonus nur auf
  //    den (hacking+int)-Teil wirkt - eine andere Formel, dieselbe Zahl.
  const wa = a.p.currentWork.data, wb = b.p.currentWork.data;
  const fa = a.facs.BitRunners.data || a.facs.BitRunners, fb = b.facs.BitRunners.data || b.facs.BitRunners;
  const gemessen = (fb.playerReputation - fa.playerReputation) / (wb.cyclesWorked - wa.cyclesWorked);
  const pm = a.p.mults;
  const r = (h) => repJeZyklus({ hacking: h, intelligence: a.p.skills.intelligence }, "hacking", fa.favor, bn, pm.faction_rep);
  const lo = r(a.p.skills.hacking), hi = r(b.p.skills.hacking);
  const shareLo = gemessen / hi, shareHi = gemessen / lo;
  console.log("  Spieler BitRunners/hacking: gemessen " + gemessen.toFixed(5) + " rep/Zyklus = "
    + Math.round(gemessen * 5 * 3600) + " rep/h; Formel ohne Share " + lo.toFixed(5) + " (hack "
    + a.p.skills.hacking + ") bis " + hi.toFixed(5) + " (hack " + b.p.skills.hacking + ")"
    + " -> Share-Bonus " + shareLo.toFixed(4) + " .. " + shareHi.toFixed(4));
  // Gegenprobe security: bn4rep.json im Backup 16:08 traegt rep (gerundet)
  // und seine Uhrzeit, der Spielstand die genaue rep und lastUpdate. Die
  // Zeitdifferenz ist Wanduhr (Tab im Vordergrund, 5 Zyklen/s) - grob, aber
  // unabhaengig. Der Spieler hat sich in den 12 s nicht verbessert.
  let share = (shareLo + shareHi) / 2;
  try {
    const srv = JSON.parse(zlib.gunzipSync(fs.readFileSync(namen[2])).toString("utf8"));
    const s2 = typeof srv === "string" ? JSON.parse(srv) : srv;
    const home = JSON.parse(s2.data.AllServersSave).home.data;
    const eintraege = home.textFiles.ctor === "JSONMap" ? home.textFiles.data : Object.entries(home.textFiles);
    const txt = eintraege.find(([n]) => n === "data/bn4rep.json")[1];
    const j = JSON.parse(txt.data ? txt.data.text : txt.text);
    const fs16 = c.facs["Slum Snakes"].data || c.facs["Slum Snakes"];
    const zyk = (c.p.lastUpdate - j.zeit) / 200;
    const gem = (fs16.playerReputation - j.rep) / zyk;
    const sec = repJeZyklus(c.p.skills, "security", fs16.favor, bn, c.p.mults.faction_rep, share);
    const sec1 = repJeZyklus(c.p.skills, "security", fs16.favor, bn, c.p.mults.faction_rep, 1);
    console.log("  Gegenprobe Slum Snakes/security 16:08: gemessen " + gem.toFixed(4) + " rep/Zyklus (+-"
      + (0.5 / zyk).toFixed(4) + " Rundung, " + zyk.toFixed(1) + " Zyklen), Formel mit Share "
      + share.toFixed(3) + ": " + sec.toFixed(4) + ", ohne Share: " + sec1.toFixed(4));
    out.shareGegenprobe = Math.abs(gem - sec) < Math.abs(gem - sec1) && Math.abs(gem - sec) / sec < 0.02;
  } catch (err) { console.log("  Gegenprobe security nicht moeglich: " + err.message); }
  out.spielerRate = shareHi - shareLo < 0.03;
  out.share = share;
  out.spielerRepJeStunde = gemessen * 5 * 3600;
  out.sleeveJetzt = { exp: { ...c.p.sleeves[0].data.exp }, int: c.p.sleeves[0].data.skills.intelligence,
    shock: c.p.sleeves[0].data.shock, sync: c.p.sleeves[0].data.sync };
  return out;
}

// --- Vergleich --------------------------------------------------------------

function vergleich(e) {
  const jetzt = e ? e.sleeveJetzt : { exp: { dexterity: 12175.58, agility: 12175.58 }, int: 24, shock: 63.96, sync: 1 };
  const bnStart = { exp: {}, int: 24, shock: 100, sync: 1 };
  const spieler = e ? e.spielerRepJeStunde : 36980;
  const f = (x) => Math.round(x).toLocaleString("de-DE");
  const k = (n) => (n.startsWith("crime") ? n : n);

  // FAVOR 0 IN DEN TABELLEN: Die Zeilen rechnen mit Favor 0. Die echten
  // Zielfaktionen haben mehr (BitRunners 53, NiteSec 81, Backup 16:08); die
  // Rep-Rate skaliert mit (1 + Favor/100), der Sleeve-Anteil ist also um den
  // Faktor 1,5-2 unterschaetzt. Eine Zeile mit Favor 53 steht zum Vergleich.
  for (const [lage, start, favor] of [["JETZT (BN5L3, Backup 16:08, Schock 64, dex/agi 102)", jetzt, 0],
    ["KNOTENSTART (Schock 100, alles 1)", bnStart, 0]]) {
    console.log("\n== " + lage + " ==");
    for (const knoten of [5, 1, 8, 12]) {
      const bn = bnMults(knoten, 1);
      console.log("  BN" + knoten + ":");
      for (const h of [3, 12, 24]) {
        const zeilen = [];
        const lauf = (name, policy, opts = {}) => {
          const r = simuliere({ start, policy, bn, stunden: h, favor, share: e ? e.share : 1.28, ...opts });
          zeilen.push([name, r]);
        };
        lauf("Shoplift", () => "crime:Shoplift");
        lauf("Mug", () => "crime:Mug");
        lauf("Faktion hacking", () => "hacking");
        lauf("Faktion security", () => "security");
        lauf("Faktion beste Art", () => "best");
        lauf("Faktion nur hacking-Art (BitRunners)", () => "best", { arten: ["hacking"] });
        // Folgepolitik ist "hacking", nicht "best": "best" ist kurzsichtig
        // (waehlt security, solange dex/agi vorn liegen) und lag selbst ueber
        // 24 h 23 % unter "immer hacking" - sie haette jede Vorphase
        // schlechtgerechnet (Skeptiker 27.09.).
        lauf("Uni Rothman 1h, dann hacking", (t) => (t < 1 ? "uni" : "hacking"));
        lauf("Uni Rothman 3h, dann hacking", (t) => (t < 3 ? "uni" : "hacking"));
        lauf("Uni ZB 1h, dann hacking (+Reise)", (t) => (t < 1 ? "uni" : "hacking"), { uni: UNI_ZB });
        lauf("Uni ZB 3h, dann hacking (+Reise)", (t) => (t < 3 ? "uni" : "hacking"), { uni: UNI_ZB });
        lauf("Recovery 2h, dann hacking", (t) => (t < 2 ? "recovery" : "hacking"));
        lauf("Recovery 4h, dann hacking", (t) => (t < 4 ? "recovery" : "hacking"));
        lauf("Recovery bis 50, dann hacking", (t, sl) => (sl.shock > 50 ? "recovery" : "hacking"));
        lauf("Recovery bis 0, dann hacking", (t, sl) => (sl.shock > 0 ? "recovery" : "hacking"));
        lauf("Synchronize 3h, dann hacking", (t) => (t < 3 ? "sync" : "hacking"));
        lauf("Faktion hacking, Favor 53 (BitRunners)", () => "hacking", { favor: 53.28 });
        console.log("    Horizont " + h + " h  (je Sleeve; Spieler BN5 gemessen " + f(spieler) + " rep/h)");
        for (const [name, r] of zeilen) {
          console.log("      " + k(name).padEnd(38) + (" rep/h " + f(r.repJeStunde)).padEnd(16)
            + (" (" + (100 * r.repJeStunde / spieler).toFixed(2) + " %)").padEnd(12)
            + " $/h " + f(r.geldJeStunde).padStart(14)
            + "   Ende: hack " + r.ende.hacking + " sec-Summe " + (r.ende.strength + r.ende.defense + r.ende.dexterity + r.ende.agility)
            + " shock " + r.ende.shock.toFixed(1));
        }
      }
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log("-- Eichung gegen Spielstaende (BN5L3, 27.09.2026) --");
  const e = eichen();
  if (e) {
    for (const [k, v] of Object.entries(e)) if (typeof v === "boolean") console.log("  " + (v ? "ok   " : "ROT  ") + k);
  }
  if (!process.argv.includes("--eichen")) vergleich(e);
}
