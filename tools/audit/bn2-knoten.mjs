// Audit 03.10.2026, Gruppe BN2 (BN2.1-2.3): Knotenregeln, Bot-Tabellen und
// Lage BN2.1 aus den Spielstaenden. Nur lesen - schreibt nichts ausser stdout.
//
// Abschnitte (jeder mit Eichung Soll/Ist, wo es einen Spielstandwert gibt):
//   1  BitNode.tsx case-Bloecke gegen src/lib/bitnodes.json und die
//      Handtabellen in src/bn4rep.js (FACTION_REP_GAIN, WD_DIFFICULTY)
//   2  Hacking-Fertigkeit (skill.ts) gegen Spielstand; V1-Bedarf in BN2
//   3  Aug-Kaeufe BN2.1 09:59 -> 17:16 -> 17:17 gegen moneySourceA.augmentations,
//      Gegenrechnung ohne die Hacknet-Stuecke, NFG-Stufen je Budget
//   4  Bonuszeit (storedCycles), Offline-Luecke, Einbausperre, Gym-Brand
//   5  SF2-Wirkung (Charisma) auf Vertrags- und Black-Op-Kompetenz
//   6  Rangkurven BN2.1 gegen BN4.2/4.3/BN9.3 (effektive Zeit = Spielzeit
//      minus noch nicht abgebaute Bonuszeit)
//
// Aufruf: node tools/audit/bn2-knoten.mjs [--abschnitt N]
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { loadAugs } from "./aug-data.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = path.join(ROOT, "reference", "bitburner-src", "src");
const BACKUPS = path.join(ROOT, "backups");
const args = process.argv.slice(2);
const nur = (() => { const i = args.indexOf("--abschnitt"); return i >= 0 ? Number(args[i + 1]) : null; })();
const zeigen = (n) => nur === null || nur === n;

const lade = (datei) => {
  const save = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(BACKUPS, datei))).toString("utf8"));
  const p = JSON.parse(save.data.PlayerSave).data;
  return { save, p };
};
const flach = (x) => (x && typeof x === "object" && "ctor" in x && "data" in x ? x.data : x);
const ok = (b) => (b ? "OK    " : "ABW.  ");

// ---------------------------------------------------------------------------
// 1. Multiplikatoren
// ---------------------------------------------------------------------------
// Spiel: BitNode/BitNode.tsx getBitNodeMultipliers, case-Bloecke mit Literalen.
// Ausdruecke (BN12 inc/dec) werden uebersprungen und als "ausdruck" markiert.
export function parseCases() {
  const t = fs.readFileSync(path.join(SRC, "BitNode", "BitNode.tsx"), "utf8");
  const out = {};
  const re = /case (\d+): \{\s*return new BitNodeMultipliers\(\{([\s\S]*?)\}\);/g;
  let m;
  while ((m = re.exec(t))) {
    const n = Number(m[1]);
    const o = {};
    for (const z of m[2].matchAll(/(\w+):\s*([^,\n]+),/g)) {
      const v = Number(z[2]);
      o[z[1]] = Number.isFinite(v) ? v : "ausdruck:" + z[2].trim();
    }
    out[n] = o;
  }
  return out;
}
export function parseDefaults() {
  const t = fs.readFileSync(path.join(SRC, "BitNode", "BitNodeMultipliers.ts"), "utf8");
  const o = {};
  for (const z of t.matchAll(/^\s{2}(\w+) = (-?[\d.]+);/gm)) o[z[1]] = Number(z[2]);
  return o;
}

if (zeigen(1)) {
  console.log("=== 1. BN2-Multiplikatoren: BitNode.tsx gegen src/lib/bitnodes.json ===");
  const cases = parseCases();
  const def = parseDefaults();
  const bj = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "lib", "bitnodes.json"), "utf8"));
  const c2 = cases[2];
  const j2 = bj.knoten["2"];
  let abw = 0;
  for (const k of new Set([...Object.keys(c2), ...Object.keys(j2)])) {
    const soll = c2[k] ?? def[k];
    const ist = j2[k] ?? bj.standard[k];
    if (soll !== ist) abw++;
    console.log("  " + ok(soll === ist) + k.padEnd(28) + " Spiel " + String(soll).padStart(6) + "   bitnodes.json " + String(ist).padStart(6)
      + "   Vorgabe " + def[k]);
  }
  // Standardtabelle des Bots gegen BitNodeMultipliers.ts
  let abwStd = 0;
  for (const [k, v] of Object.entries(def)) if (bj.standard[k] !== v) { abwStd++; console.log("  ABW. standard." + k, v, bj.standard[k]); }
  console.log("  -> BN2: " + Object.keys(c2).length + " gesetzte Felder, Abweichungen " + abw + "; Standardtabelle " + Object.keys(def).length + " Felder, Abweichungen " + abwStd);

  // Handtabellen in bn4rep.js
  const rep = fs.readFileSync(path.join(ROOT, "src", "bn4rep.js"), "utf8");
  const tab = (name) => {
    const m = rep.match(new RegExp("const " + name + " = \\{([\\s\\S]*?)\\};"));
    const o = {};
    if (m) for (const z of m[1].matchAll(/(\d+):\s*([\d.]+)/g)) o[Number(z[1])] = Number(z[2]);
    return o;
  };
  for (const [name, feld] of [["FACTION_REP_GAIN", "FactionWorkRepGain"], ["WD_DIFFICULTY", "WorldDaemonDifficulty"]]) {
    const t = tab(name);
    const zeilen = [];
    let a = 0;
    for (let n = 1; n <= 15; n++) {
      const soll = cases[n] && cases[n][feld] !== undefined ? cases[n][feld] : def[feld];
      const ist = t[n] !== undefined ? t[n] : (name === "FACTION_REP_GAIN" ? 1 : "fehlt");
      const gleich = typeof soll === "number" ? soll === ist : true; // BN12 Ausdruck
      if (!gleich) a++;
      zeilen.push(n + ":" + (typeof soll === "number" ? soll : "f(SF)") + "/" + ist + (gleich ? "" : "!"));
    }
    console.log("  " + name.padEnd(17) + " (Spiel/Bot) " + zeilen.join(" ") + "  -> Abweichungen " + a);
  }
}

// ---------------------------------------------------------------------------
// 2. Hacking-Fertigkeit und V1-Bedarf
// ---------------------------------------------------------------------------
// Spiel: PersonObjects/formulas/skill.ts calculateSkill(exp, mult)
//   = max(1, floor(mult * (32 * ln(exp + 534.6) - 200)))
// mult = mults.hacking * HackingLevelMultiplier (BN2 0,8, BitNode.tsx:571).
// Ziel w0r1d_d43m0n: 3000 (servers.ts:1553) x WorldDaemonDifficulty 5
// (ServerHelpers.ts:422-424, BitNode.tsx:590) = 15.000.
export const skill = (exp, mult) => Math.max(1, Math.floor(mult * (32 * Math.log(exp + 534.6) - 200)));
export const expFuer = (lvl, mult) => Math.exp((lvl / mult + 200) / 32) - 534.6;

if (zeigen(2)) {
  console.log("\n=== 2. Hacking: Eichung und V1-Bedarf in BN2 ===");
  for (const f of ["LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz", "LIVE_197f4d61481686_BN2L1_2026-10-03T17-17_hourly.json.gz"]) {
    const { p } = lade(f);
    const ist = skill(p.exp.hacking, p.mults.hacking * 0.8);
    console.log("  " + ok(ist === p.skills.hacking) + f.slice(38, 54) + " exp " + p.exp.hacking.toExponential(4) + " mult " + p.mults.hacking.toFixed(5)
      + " x 0,8 -> Soll (Spielstand) " + p.skills.hacking + " / Ist " + ist);
  }
  console.log("  Bedarf fuer Hacking 15.000 (w0r1d_d43m0n BN2) je Hacking-Mult (vor x0,8):");
  for (const m of [1.514, 3, 5, 10, 15, 20, 30]) {
    const e = expFuer(15000, m * 0.8);
    console.log("    mults.hacking " + String(m).padStart(6) + " -> Erfahrung " + e.toExponential(3)
      + (m === 1.514 ? "  (heute)" : ""));
  }
  console.log("  Vergleich: BN5.2 erreichte 4.500 bei Mult 9,04 mit 1,42e8 Erfahrung (Audit 26.09., 1-bitnode-regeln.md);"
    + " gemessene Spitzenrate ~2e6 Erfahrung/s (AUDIT-ROADMAP).");
  const e20 = expFuer(15000, 20 * 0.8);
  console.log("    -> selbst bei Mult 20: " + e20.toExponential(2) + " Erfahrung = " + (e20 / 2e6 / 3600 / 24 / 365).toFixed(1) + " Jahre bei 2e6/s");
}

// ---------------------------------------------------------------------------
// 3. Aug-Kaeufe BN2.1 und Hacknet-Stuecke
// ---------------------------------------------------------------------------
// Spiel: Augmentation/AugmentationHelpers.ts getAugCost: base x 1,9^q
// (getGenericAugmentationPriceMultiplier, Constants.ts:41, q = wartende
// Nicht-SoA-Stuecke), AugmentationMoneyCost BN2 = 1. NFG: base 750k x
// 1,14^Stufe (Stufe = eingebaut + wartend, Augmentation.ts:240-247) x 1,9^q.
const SPIELSTAENDE = [
  "LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz",
  "LIVE_197f4d61481686_BN2L1_2026-10-03T17-16_connect.json.gz",
  "LIVE_197f4d61481686_BN2L1_2026-10-03T17-17_hourly.json.gz",
];
const MULT = 1.9;
const istHacknet = (n) => /^Hacknet Node/.test(n);

export function nfgStufen(budget, q0, stufe0) {
  let k = 0, summe = 0;
  for (;;) {
    const preis = 750000 * Math.pow(1.14, stufe0 + k) * Math.pow(MULT, q0 + k);
    if (summe + preis > budget) break;
    summe += preis; k++;
  }
  return { k, summe };
}

if (zeigen(3)) {
  console.log("\n=== 3. Aug-Kaeufe BN2.1: Preisformel gegen moneySourceA.augmentations ===");
  const augs = loadAugs();
  const staende = SPIELSTAENDE.map((f) => {
    const { p } = lade(f);
    const ms = flach(p.moneySourceA);
    return { f, q: p.queuedAugmentations.map((a) => a.name), ausgabe: -ms.augmentations, geld: p.money,
      nfg: (p.augmentations.find((a) => a.name === "NeuroFlux Governor") || {}).level || 0 };
  });
  for (let i = 1; i < staende.length; i++) {
    const a = staende[i - 1], b = staende[i];
    let summe = 0;
    const posten = [];
    for (let j = a.q.length; j < b.q.length; j++) {
      const name = b.q[j];
      const preis = augs[name].moneyCost * Math.pow(MULT, j);
      summe += preis;
      posten.push(name + " q=" + j + " " + (preis / 1e9).toFixed(3) + " Mrd");
    }
    const soll = b.ausgabe - a.ausgabe;
    console.log("  " + a.f.slice(38, 54) + " -> " + b.f.slice(38, 54) + ": Soll (Spielstand) " + (soll / 1e9).toFixed(4)
      + " Mrd / Ist (Formel) " + (summe / 1e9).toFixed(4) + " Mrd  " + ok(Math.abs(soll - summe) / soll < 1e-6));
    for (const z of posten) console.log("      " + z);
  }
  // Gegenrechnung: dieselben echten Stuecke ohne die Hacknet-Stuecke
  const end = staende[staende.length - 1];
  const start = staende[0];
  let ist = 0, ohne = 0, qOhne = start.q.length;
  for (let j = start.q.length; j < end.q.length; j++) {
    const name = end.q[j];
    const preis = augs[name].moneyCost * Math.pow(MULT, j);
    ist += preis;
    if (!istHacknet(name)) { ohne += augs[name].moneyCost * Math.pow(MULT, qOhne); qOhne++; }
  }
  console.log("  Seit 09:59 ausgegeben " + (ist / 1e9).toFixed(2) + " Mrd; dieselben Nicht-Hacknet-Stuecke ohne die drei Hacknet-Stuecke: "
    + (ohne / 1e9).toFixed(2) + " Mrd -> Mehrkosten " + ((ist - ohne) / 1e9).toFixed(2) + " Mrd ("
    + (100 * (ist - ohne) / ist).toFixed(0) + " %)");
  // NFG-Schleife vor dem Einbau (src/bn4rep.js:1655-1691): mit q=11 gegen q=8
  const stufe0 = end.nfg;
  console.log("  NFG-Stufen vor dem Einbau (eingebaut " + stufe0 + ", Rufbedarf 500 x 1,14^L, NiteSec 16.405 reicht bis L~26):");
  for (const budget of [end.geld, end.geld + (ist - ohne), 10e9, 20e9]) {
    const mit = nfgStufen(budget, end.q.length, stufe0);
    const besser = nfgStufen(budget + (budget === end.geld ? (ist - ohne) : 0), end.q.length - 3, stufe0);
    console.log("    Budget " + (budget / 1e9).toFixed(2).padStart(6) + " Mrd: q=11 -> " + mit.k + " Stufen"
      + " | ohne Hacknet (q=8" + (budget === end.geld ? ", + Mehrkosten zurueck" : "") + ") -> " + besser.k + " Stufen");
  }
}

// ---------------------------------------------------------------------------
// 4. Bonuszeit und Einbausperre
// ---------------------------------------------------------------------------
// Spiel: engine.tsx:333 legt Offline-Zyklen in storedCycles, Bladeburner.ts
// process() baut hoechstens 5 s je Aufruf ab (einmal je Realsekunde,
// engine.tsx:150,193-201) und laeuft auch ohne Aktion. Gym (Player.processWork)
// laeuft nur in Echtzeit. Prestige behaelt storedCycles (Bladeburner.ts:259-263).
// Bot: src/lib/endspurt.js:323-332 kampfEinbauSperre in totalPlaytime.
if (zeigen(4)) {
  console.log("\n=== 4. Bonuszeit, Offline-Luecke, Einbausperre (BN2.1) ===");
  for (const f of SPIELSTAENDE) {
    const { p } = lade(f);
    const bb = flach(p.bladeburner);
    const bonusH = bb.storedCycles * 0.2 / 3600;
    console.log("  " + f.slice(38, 54) + "  Spielzeit Knoten " + (p.playtimeSinceLastBitnode / 3.6e6).toFixed(2) + " h  Bonus " + bonusH.toFixed(2)
      + " h  effektiv " + (p.playtimeSinceLastBitnode / 3.6e6 - bonusH).toFixed(2) + " h  lastSave " + new Date(p.lastSave).toISOString().slice(11, 19)
      + "Z lastUpdate " + new Date(p.lastUpdate).toISOString().slice(11, 19) + "Z  Rang " + bb.rank.toFixed(0));
  }
  // Eichung: Offline-Dauer (lastSave 08:32:54Z bis Kernstart 15:16:44Z) gegen storedCycles
  const offlineS = (Date.parse("2026-10-03T15:16:44.782Z") - Date.parse("2026-10-03T08:32:54.940Z")) / 1000;
  const { p: p16 } = lade(SPIELSTAENDE[1]);
  const stored16 = flach(p16.bladeburner).storedCycles * 0.2;
  console.log("  Eichung Offline: lastSave 08:32:54Z -> Kernstart 15:16:44Z (events.json) = " + (offlineS / 3600).toFixed(3)
    + " h; storedCycles 17:16 = " + (stored16 / 3600).toFixed(3) + " h  " + ok(Math.abs(offlineS - stored16) < 120));
  // Einbausperre aus data/einbau-uhr.json (17:17): fertig 3.839.415.400 ms totalPlaytime
  const fertig = 3839415400, jetzt = 3883343200;
  console.log("  Einbausperre: seit Wiederaufbau-Ende " + ((jetzt - fertig) / 3.6e6).toFixed(2) + " h totalPlaytime (Schranke 12 h) -> offen;"
    + " davon offline " + (offlineS / 3600).toFixed(2) + " h, echte BB-Zeit " + ((jetzt - fertig) / 3.6e6 - offlineS / 3600).toFixed(2) + " h");
  console.log("  Gym-Brand bei Einbau mit Bonus (BB-Zeit ohne Aktion = 4 x Gym-Echtzeit, solange Bonus reicht):");
  for (const gymH of [0.2, 0.5, 0.85, 2, 5]) console.log("    Gym " + gymH.toFixed(2) + " h echt -> " + Math.min(4 * gymH, 6.68).toFixed(2) + " h BB-Zeit ohne Rang");
  console.log("  Gegenweg 'warten bis Bonus abgebaut': Einbau spaeter um 6,68 h BB-Zeit -> Kosten (g-1) x 6,68 h Rangrate;"
    + " Gleichstand bei 4 x Gym = (g-1) x Bonus, g=1,2: Gym 0,33 h");
}

// ---------------------------------------------------------------------------
// 4b. Wiederaufbau nach dem anstehenden Einbau: Gym gegen Bladeburner-Training
// ---------------------------------------------------------------------------
// Gym: Work/ClassWork.tsx:53-70 (strExp 1 je Zyklus-Einheit) x expMult 10
// (Powerhouse, Locations/data/LocationsMetadata.ts:324-326) / 5 Zyklen,
// Work/Formulas.ts:108-121 -> 10 x strength_exp je Echtsekunde, EIN Wert.
// ClassGymExpGain wird in 3.0.2 nirgends gelesen (nur BitNodeMultipliers.ts:28).
// BB-Training: Bladeburner.ts:1092-1103, 30 x X_exp je 30 s auf ALLE VIER,
// mit Bonuszeit bis 5 Spielsekunden je Echtsekunde (Bladeburner.ts:1375-1378).
// Kampfmults nach dem Einbau = heute x Produkt der wartenden Stuecke
// (applyAugmentation, AugmentationHelpers.ts:39-60); Ziel Tiefstand 100.
if (zeigen(4)) {
  console.log("\n=== 4b. Wiederaufbau nach dem anstehenden Einbau (Spielstand 17:17) ===");
  const augs = loadAugs();
  const { p } = lade(SPIELSTAENDE[2]);
  const bonusH = flach(p.bladeburner).storedCycles * 0.2 / 3600;
  const werte = ["strength", "defense", "dexterity", "agility"];
  let sumGym = 0, maxBb = 0;
  const zeilen = [];
  for (const w of werte) {
    let m = p.mults[w], mx = p.mults[w + "_exp"];
    for (const q of p.queuedAugmentations) {
      const a = augs[q.name];
      if (!a) continue;
      if (a.mults[w]) m *= a.mults[w];
      if (a.mults[w + "_exp"]) mx *= a.mults[w + "_exp"];
    }
    const e = expFuer(100, m);
    const tGym = e / (10 * mx);
    const tBb = e / (1 * mx);
    sumGym += tGym;
    maxBb = Math.max(maxBb, tBb);
    zeilen.push(w.slice(0, 3) + " m " + m.toFixed(3) + " exp-m " + mx.toFixed(3) + " Bedarf " + Math.round(e) + " exp");
  }
  for (const z of zeilen) console.log("  " + z);
  // Gym nacheinander, BB-Training gleichzeitig; Bonus deckt die BB-Zeit, solange er reicht.
  const gymEchtH = sumGym / 3600;
  const bbOhneBonusH = maxBb / 3600;
  const bbMitBonusEchtH = Math.min(bbOhneBonusH / 5, bonusH / 4) + Math.max(0, bbOhneBonusH - 5 * Math.min(bbOhneBonusH / 5, bonusH / 4)) / 1;
  const brandGym = Math.min(4 * gymEchtH, bonusH);
  console.log("  Gym (Powerhouse, vier Werte nacheinander): " + (gymEchtH * 60).toFixed(1) + " min echt; BB-Zeit ohne Aktion "
    + ((gymEchtH + brandGym) * 60).toFixed(1) + " min (davon Bonus verbrannt " + (brandGym * 60).toFixed(1) + " min)");
  console.log("  BB-Training ohne Bonus: " + (bbOhneBonusH * 60).toFixed(1) + " min echt (Gym ist ohne Bonus "
    + (bbOhneBonusH / gymEchtH).toFixed(2) + "x schneller)");
  console.log("  BB-Training mit " + bonusH.toFixed(2) + " h Bonus: " + (bbMitBonusEchtH * 60).toFixed(1) + " min echt = "
    + (bbOhneBonusH * 60).toFixed(1) + " min BB-Zeit, kein Bonus verbrannt");
  console.log("  -> BB-Zeit ohne Rang: Gym " + ((gymEchtH + brandGym) * 60).toFixed(0) + " min gegen BB-Training "
    + (bbOhneBonusH * 60).toFixed(0) + " min: Ersparnis " + ((gymEchtH + brandGym - bbOhneBonusH) * 60).toFixed(0) + " min je Einbau mit Bonus");
}

// ---------------------------------------------------------------------------
// 5. SF2 nach dem Abschluss: Charisma auf Kompetenz
// ---------------------------------------------------------------------------
// Spiel: SourceFile/applySourceFile.ts:50-61 (crime_money, crime_success,
// charisma x 1 + (24, 36, 42)/100); Bladeburner/Actions/Action.ts:169-178
// competence = Summe w x skill^decay; Gewichte data/Contracts.ts,
// data/BlackOperations.ts (charisma 0 bei allen 21), data/Operations.ts.
// Kampfwerte roh (ohne Reaper/Evasive), daher nur das Verhaeltnis.
if (zeigen(5)) {
  console.log("\n=== 5. SF2-Charisma auf die Kompetenz (Spielstand 17:17, Rohwerte) ===");
  const { p } = lade(SPIELSTAENDE[2]);
  const s = p.skills;
  const W = {
    Retirement: { w: [0, .2, .2, .2, .2, .1, .1], d: [0, .91, .91, .91, .91, .8, .9] },
    "Bounty Hunter": { w: [0, .15, .15, .25, .25, .1, .1], d: [0, .91, .91, .91, .91, .8, .9] },
    Tracking: { w: [0, .05, .05, .35, .35, .1, .05], d: [0, .91, .91, .91, .91, .9, 1] },
    "Black Ops (alle 21)": { w: [.1, .2, .2, .2, .2, 0, .1], d: [.6, .8, .8, .8, .8, 0, .75] },
  };
  const werte = (cha) => [s.hacking, s.strength, s.defense, s.dexterity, s.agility, cha, s.intelligence];
  const komp = (a, cha) => a.w.reduce((x, w, i) => x + w * Math.pow(werte(cha)[i], a.d[i]), 0);
  for (const [n, a] of Object.entries(W)) {
    const basis = komp(a, s.charisma);
    const z = [1.24, 1.36, 1.42].map((f) => ((komp(a, s.charisma * f) / basis - 1) * 100).toFixed(2) + " %");
    console.log("  " + n.padEnd(22) + " SF2.1/2.2/2.3: " + z.join(" / "));
  }
}

// ---------------------------------------------------------------------------
// 6. Rangkurven: BN2.1 gegen V2-Laeufe mit gleichem Bladeburner-Faktor
// ---------------------------------------------------------------------------
// BN4: BladeburnerRank 1, Kampf-LevelMult 1, ClassGymExpGain 0,5,
// FactionPassiveRepGain 1 (BitNode.tsx:627-656). BN9: Kampf 0,45, Rang 0,9,
// Skillkosten 1,2 (:795-836). BN2: Rang 1, Kampf 1, Passivruf 0 (:569-591).
function kurve(lauf) {
  const dateien = fs.readdirSync(BACKUPS).filter((d) => d.includes("_" + lauf + "_") && d.endsWith(".json.gz")).sort();
  const pkt = [];
  for (const d of dateien) {
    const { p } = lade(d);
    if (!p.bladeburner) continue;
    const bb = flach(p.bladeburner);
    const t = p.playtimeSinceLastBitnode / 3.6e6;
    const bonus = (bb.storedCycles || 0) * 0.2 / 3600;
    pkt.push({ t, teff: t - bonus, rank: bb.maxRank, augs: (p.augmentations || []).length });
  }
  return pkt.sort((a, b) => a.teff - b.teff);
}
function zeitBis(pkt, r) {
  for (let i = 1; i < pkt.length; i++) {
    const a = pkt[i - 1], b = pkt[i];
    if (a.rank < r && b.rank >= r) {
      const x = (Math.log(r) - Math.log(Math.max(a.rank, 1))) / (Math.log(b.rank) - Math.log(Math.max(a.rank, 1)));
      return a.teff + x * (b.teff - a.teff);
    }
    if (a.rank >= r) return a.teff;
  }
  return null;
}
if (zeigen(6)) {
  console.log("\n=== 6. Rangkurven (maxRank gegen effektive Knotenzeit, log-linear interpoliert) ===");
  const dauer = { BN4L2: 47.66, BN4L3: 51.36, BN9L3: 53.73 };
  const laeufe = ["BN2L1", "BN4L2", "BN4L3", "BN9L3"];
  const schwellen = [500, 1000, 2000, 2500, 5000, 10000, 25000, 100000, 400000];
  console.log("  Lauf    " + schwellen.map((s) => String(s).padStart(8)).join("") + "   Dauer (INDEX)");
  for (const l of laeufe) {
    const k = kurve(l);
    console.log("  " + l.padEnd(7) + schwellen.map((s) => { const z = zeitBis(k, s); return (z === null ? "-" : z.toFixed(1)).padStart(8); }).join("")
      + "   " + (dauer[l] ? dauer[l].toFixed(1) + " h" : "laeuft"));
  }
}
