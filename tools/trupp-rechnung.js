/**
 * Lohnt ein Sleeve auf Recruitment, und wann? - GERECHNET aus dem
 * Spielquellcode, GEEICHT gegen die BN2L1-Spielstaende.
 *
 * WARUM (03.10.2026)
 *
 * Seit D1 (26.09.) rekrutiert die Spielfigur nicht mehr selbst. blade.js
 * schrieb stattdessen `truppAnfrage` nach data/blade.json - aber niemand las
 * das Feld, und es stand praktisch immer auf true (Pool unter TRUPP_ZIEL).
 * Bevor ein Sleeve darauf reagiert, steht hier, WAS ein Mann bringt und WAS
 * er kostet.
 *
 * NACHGEBAUT (reference/bitburner-src/src):
 *   - Bladeburner/data/GeneralActions.ts:22-31  Recruitment: Dauer
 *       max(10, round(300 - (effCha^0,81 + effCha/90))), Chance
 *       cha^0,45 / (teamSize - sleeveSize + 1). Chance mit den ROHEN
 *       skills.charisma, Dauer mit getEffectiveSkillLevel (EffCha - keine
 *       Bladeburner-Fertigkeit hebt EffCha, data/Skills.ts).
 *   - Bladeburner/Bladeburner.ts:1152-1180      Recruitment-Abschluss: +1 Mann,
 *       Charisma-Exp 60*(1-exp(-(exp/216000)^1,3)), mindestens 1 je Sekunde,
 *       bei Fehlschlag die Haelfte.
 *   - Sleeve/Work/SleeveBladeburnerWork.ts      Sleeve ruft completeAction(sleeve)
 *       - es zaehlt SEIN Charisma; Exp mal shockBonus (Work.ts:17-25).
 *   - Bladeburner/Actions/Operation.ts:96-98    Truppbonus (teamCount+1)^0,05,
 *       gilt auch fuer Black Ops (BlackOperation.ts:67).
 *   - Bladeburner/Actions/Action.ts:169-196     getSuccessChance (Black Op:
 *       Bevoelkerung und Chaos fest 1, BlackOperation.ts:55-61).
 *   - Bladeburner/Actions/TeamCasualties.ts     Verluste: Black Op mindestens 1,
 *       bei Erfolg bis ceil(n/2), bei Fehlschlag bis n (gleichverteilt).
 *   - PersonObjects/formulas/skill.ts           calculateSkill.
 *
 * GEEICHT (siehe Abschnitt 1 der Ausgabe):
 *   - Stufe aus Exp: Spieler-Charisma und Sleeve-Kampfwerte exakt.
 *   - Black-Op-Chance (Typhoon) aus dem Spielstand gegen den Wert, den
 *     blade.js im selben Backup nach data/blade.json geschrieben hat - zwei
 *     unabhaengig gebaute Rechnungen; die blade.js-Rechnung ist seit dem
 *     27.08. gegen das API-Paar des Spiels geprueft (max deckungsgleich).
 *
 * NICHT GEEICHT, NUR GELESEN: die Recruitment-Dauer und -Chance. Kein Backup
 * zeigt einen einzelnen Recruitment-Abschluss mit Zeitstempel; die Formel ist
 * aber eine einzige Zeile ohne verdeckten Zustand (sleeveSize ist 0, dieser
 * Bot setzt keinen Sleeve auf "Support main sleeve").
 *
 * Aufruf:  node tools/trupp-rechnung.js [backup.json.gz]
 *          (ohne Argument: neuestes BN2L1-Backup aus backups/ oder
 *          C:\Users\erche\bitburner-backups)
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

// --- Reine Formeln (exportiert: tools/test-trupp-sleeve.js vergleicht sie mit
// den Kopien in src/sleeve.js) -----------------------------------------------

/** GeneralActions.ts:24-28 - Sekunden je Versuch. */
export function rekrutierZeitS(effCha) {
  return Math.max(10, Math.round(300 - (Math.pow(effCha, 0.81) + effCha / 90)));
}
/** GeneralActions.ts:29-31 - sleeveSize ist hier 0 (kein Support-Sleeve). */
export function rekrutierChance(cha, trupp, sleeveSize = 0) {
  return Math.min(1, Math.max(0, Math.pow(cha, 0.45) / (trupp - sleeveSize + 1)));
}
/** Erwartete Sekunden bis zum naechsten Mann (geometrisch: Dauer/Chance). */
export function naechsterMannS(cha, trupp) {
  const c = rekrutierChance(cha, trupp);
  return c > 0 ? rekrutierZeitS(cha) / c : Infinity;
}
/** Operation.ts:96-98 */
export function truppBonus(n) { return Math.pow(n + 1, 0.05); }
/**
 * Zeit, um die eine Black Op mit einem Mann mehr (trupp -> trupp+1) FRUEHER
 * feuert: der Bonus hebt die Chance um den Faktor ((k+2)/(k+1))^0,05, und
 * ohne ihn muesste die Chance diesen Faktor selbst erwachsen. Bei
 * exponentiellem Wachstum mit Rate g (je Stunde) dauert das ln(Faktor)/g.
 */
export function mannGewinnS(trupp, gJeStunde) {
  return 0.05 * Math.log((trupp + 2) / (trupp + 1)) / gJeStunde * 3600;
}
/** Wie viele Maenner braucht die Chance c0 ohne Trupp, um s zu tragen? */
// Gleich wie blade.js maennerNoetig: ueber 1e6 Mann "unerreichbar" (Infinity),
// Korrekturschleifen begrenzt - die unbegrenzte Fassung lief oberhalb 2^53
// ewig, weil n-- / n++ dort den Wert nicht aendern (03.10.2026).
export function maennerNoetig(c0, s) {
  if (!(c0 > 0) || !(s > 0)) return Infinity;
  if (c0 >= s) return 0;
  const roh = Math.pow(s / c0, 20) - 1;
  if (!(roh <= 1e6)) return Infinity;
  let n = Math.max(1, Math.ceil(roh - 1e-9));
  for (let i = 0; i < 64 && n > 1 && c0 * truppBonus(n - 1) >= s; i++) n--;
  for (let i = 0; i < 64 && c0 * truppBonus(n) < s; i++) n++;
  return n;
}
/** formulas/skill.ts */
export function stufeAusExp(exp, mult = 1) {
  if (mult === 0) return 1;
  return Math.max(Math.floor(mult * (32 * Math.log(exp + 534.6) - 200)), 1);
}

// --- Spielstand ------------------------------------------------------------

function ladeSave(datei) {
  let s = JSON.parse(zlib.gunzipSync(fs.readFileSync(datei)).toString("utf8"));
  if (typeof s === "string") s = JSON.parse(s);
  const p = JSON.parse(s.data.PlayerSave).data;
  const home = JSON.parse(s.data.AllServersSave).home.data;
  const datei2 = (n) => {
    const e = (home.textFiles.data || []).find((x) => x[0] === n);
    return e ? e[1].data.text : null;
  };
  let blade = null;
  try { blade = JSON.parse(datei2("data/blade.json")); } catch { blade = null; }
  return { p, blade };
}

function backupDirs() {
  return [path.join(ROOT, "backups"), path.resolve(ROOT, "..", "..", "..", "backups"),
    "C:\\Users\\erche\\Desktop\\claude_projecto\\bitburner\\backups", "C:\\Users\\erche\\bitburner-backups"]
    .filter((d) => fs.existsSync(d));
}
function serie(muster) {
  for (const d of backupDirs()) {
    const n = fs.readdirSync(d).filter((x) => muster.test(x) && x.endsWith(".json.gz")).sort();
    if (n.length) return n.map((x) => path.join(d, x));
  }
  return [];
}

// Black-Op-Daten aus data/BlackOperations.ts, Fertigkeiten aus data/Skills.ts -
// BEWUSST hier neu abgeschrieben und nicht aus blade.js uebernommen, damit die
// Eichung zwei unabhaengige Abschriften vergleicht.
const TYPHOON = {
  baseDifficulty: 2000, isKill: true, isStealth: false,
  weights: { hacking: 0.1, strength: 0.2, defense: 0.2, dexterity: 0.2, agility: 0.2, charisma: 0, intelligence: 0.1 },
  decays: { hacking: 0.6, strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, charisma: 0, intelligence: 0.75 },
};
const SKILLS = {
  "Blade's Intuition": { SuccessChanceAll: 3 },
  "Cloak": { SuccessChanceStealth: 5.5 },
  "Short-Circuit": { SuccessChanceKill: 5.5 },
  "Digital Observer": { SuccessChanceOperation: 4 },
  "Reaper": { EffStr: 2, EffDef: 2, EffDex: 2, EffAgi: 2 },
  "Evasive System": { EffDex: 4, EffAgi: 4 },
};
function skillMults(bbSkills) {
  // Bladeburner.ts:774-784
  const m = {};
  for (const [name, lvl] of Object.entries(bbSkills || {})) {
    const w = SKILLS[name];
    if (!w || !lvl) continue;
    for (const [k, base] of Object.entries(w)) m[k] = (m[k] ?? 1) * (1 + (base * lvl) / 100);
  }
  return (k) => m[k] ?? 1;
}
export function blackOpChanceAusSave(p, op, team = 0) {
  const bb = p.bladeburner.data;
  const m = skillMults(bb.skills);
  const eff = {
    hacking: p.skills.hacking, strength: p.skills.strength * m("EffStr"),
    defense: p.skills.defense * m("EffDef"), dexterity: p.skills.dexterity * m("EffDex"),
    agility: p.skills.agility * m("EffAgi"), charisma: p.skills.charisma, intelligence: p.skills.intelligence,
  };
  let comp = 0;
  for (const k of Object.keys(eff)) comp += op.weights[k] * Math.pow(eff[k], op.decays[k]);
  comp *= 1 + (0.75 * Math.pow(p.skills.intelligence, 0.8)) / 600;
  comp *= Math.min(1, bb.stamina / (0.5 * bb.maxStamina));
  comp *= truppBonus(team);
  comp *= m("SuccessChanceAll") * m("SuccessChanceOperation");
  if (op.isStealth) comp *= m("SuccessChanceStealth");
  if (op.isKill) comp *= m("SuccessChanceKill");
  comp *= p.mults.bladeburner_success_chance;
  return Math.min(1, comp / op.baseDifficulty);
}

// --- Simulation: ein Sleeve rekrutiert, Charisma waechst mit ---------------

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/**
 * Sekunden, bis der Pool von `von` auf `bis` steht - Mittel ueber Laeufe.
 * `chaMult` muss sleeve.mults.charisma MAL CharismaLevelMultiplier des
 * Knotens sein (Person.ts:145); im BN2 ist der 1, in BN9 0,45, BN10 0,4.
 */
function simuliere({ chaExp, chaMult, shock, von, bis, laeufe = 4000, seed = 7 }) {
  const rnd = mulberry32(seed);
  let summe = 0, chaEnde = 0;
  for (let l = 0; l < laeufe; l++) {
    let exp = chaExp, t = 0, trupp = von;
    while (trupp < bis) {
      const cha = stufeAusExp(exp, chaMult);
      const dauer = rekrutierZeitS(cha);
      const ok = rnd() < rekrutierChance(cha, trupp);
      const rate = Math.max(1, 60 * (1 - Math.exp(-Math.pow(exp / 216000, 1.3))));
      exp += rate * dauer * (ok ? 1 : 0.5) * ((100 - shock) / 100);
      t += dauer;
      if (ok) trupp++;
    }
    summe += t; chaEnde += stufeAusExp(exp, chaMult);
  }
  return { s: summe / laeufe, chaEnde: chaEnde / laeufe };
}

// --- Hauptteil -------------------------------------------------------------

function f(x, n = 2) { return Number.isFinite(x) ? x.toFixed(n) : String(x); }

export function main() {
  const argDatei = process.argv[2];
  const bn2 = argDatei ? [argDatei] : serie(/BN2L1/);
  if (!bn2.length) { console.log("Kein BN2L1-Backup gefunden."); return 1; }
  const neu = ladeSave(bn2[bn2.length - 1]);
  const p = neu.p;
  console.log("Spielstand: " + path.basename(bn2[bn2.length - 1]));

  // 1. EICHUNG
  console.log("\n1. EICHUNG");
  let eichOk = true;
  const chaRech = stufeAusExp(p.exp.charisma, p.mults.charisma);
  console.log("   Spieler Charisma aus Exp " + f(p.exp.charisma, 1) + " x " + f(p.mults.charisma, 4)
    + " -> " + chaRech + " (Spielstand " + p.skills.charisma + ")");
  eichOk = eichOk && chaRech === p.skills.charisma;
  for (const [i, sl] of p.sleeves.entries()) {
    const d = sl.data;
    const r = ["strength", "dexterity", "charisma"].map((k) => stufeAusExp(d.exp[k], d.mults[k]));
    const ist = [d.skills.strength, d.skills.dexterity, d.skills.charisma];
    console.log("   Sleeve " + i + " str/dex/cha gerechnet " + r.join("/") + "  Spielstand " + ist.join("/"));
    eichOk = eichOk && r.every((x, j) => x === ist[j]);
  }
  for (const datei of bn2) {
    const s = ladeSave(datei);
    if (!s.blade || !s.blade.boChancen || s.blade.naechsteBlackOp !== "Operation Typhoon") continue;
    const team = s.p.bladeburner.data.blackOperations["Operation Typhoon"].data.teamCount || 0;
    const r = blackOpChanceAusSave(s.p, TYPHOON, team);
    const b = s.blade.boChancen["Operation Typhoon"];
    const ok = Math.abs(r - b) < 0.00006;   // blade.json rundet auf 4 Stellen
    eichOk = eichOk && ok;
    console.log("   Typhoon " + path.basename(datei).slice(20, 46) + ": gerechnet " + f(r, 5)
      + "  blade.json " + b + (ok ? "  ok" : "  ABWEICHUNG"));
  }
  console.log("   => Eichung " + (eichOk ? "GRUEN" : "ROT"));

  // 2. WACHSTUM DER BLACK-OP-CHANCE
  console.log("\n2. WIE SCHNELL WAECHST DIE CHANCE OHNE TRUPP? (ln-Rate je Stunde)");
  const gMess = [];
  for (const [name, muster] of [["BN2L1", /BN2L1/], ["BN9L3", /BN9L3/]]) {
    const pkt = [];
    for (const d of serie(muster)) {
      const s = ladeSave(d);
      const b = s.blade;
      if (!b || !b.boChancen || b.naechsteBlackOp !== "Operation Typhoon") continue;
      const c = b.boChancen["Operation Typhoon"];
      if (Number.isFinite(c) && c > 0) pkt.push({ t: b.zeit, c, rang: Math.round(b.rang) });
    }
    for (let i = 1; i < pkt.length; i++) {
      const h = (pkt[i].t - pkt[i - 1].t) / 3600000;
      if (h < 0.5) continue;
      const g = Math.log(pkt[i].c / pkt[i - 1].c) / h;
      gMess.push({ name, g, von: pkt[i - 1].c, bis: pkt[i].c, h });
      console.log("   " + name + "  " + f(pkt[i - 1].c, 4) + " -> " + f(pkt[i].c, 4) + " in " + f(h, 2)
        + " h  (Rang " + pkt[i - 1].rang + " -> " + pkt[i].rang + ")  g = " + f(g, 3) + "/h");
    }
  }
  // Die spaeteste und laengste Strecke ist die naechste an der Schwelle - die
  // fruehen Stunden (BN2L1, Chance 0,03-0,07) wachsen schneller, weil Rang,
  // Fertigkeiten und Kampfwerte dort noch von unten kommen.
  const G = 0.115;
  console.log("   Angesetzt: g = " + G + "/h (BN9L3, laengste und spaeteste Strecke, 0,09 -> 0,45 ueber 14 h)."
    + " Groesseres g = WENIGER Maenner lohnen - siehe Empfindlichkeit unten.");

  // 3. RECRUITMENT JE MANN
  console.log("\n3. RECRUITMENT DURCH EINEN SLEEVE (erwartete Sekunden fuer den Mann k -> k+1)");
  const chas = [1, 5, 10, 25, 52, 100, 264];
  console.log("   k   " + chas.map((c) => ("cha " + c).padStart(9)).join("") + "    Gewinn je Mann (g=" + G + ")");
  for (let k = 0; k <= 10; k++) {
    console.log("   " + String(k).padStart(2) + "  " + chas.map((c) => f(naechsterMannS(c, k), 0).padStart(9)).join("")
      + "    " + f(mannGewinnS(k, G), 0).padStart(6) + " s  (Bonus " + f((truppBonus(k + 1) - 1) * 100, 1) + " %)");
  }

  // 4. WIE VIELE MAENNER LOHNEN
  console.log("\n4. LOHNENDE TRUPPGROESSE n* = groesstes n, bei dem der n-te Mann weniger kostet, als er spart");
  for (const g of [0.06, G, 0.2, 0.3]) {
    const zeile = chas.map((c) => {
      let n = 0;
      while (n < 60 && naechsterMannS(c, n) <= mannGewinnS(n, g)) n++;
      return ("n*=" + n).padStart(9);
    }).join("");
    console.log("   g=" + f(g, 3).padEnd(6) + zeile);
  }

  // 4b. DIE REGEL, WIE SIE GEBAUT IST (nach dem Skeptiker 03.10.2026): Die
  // Sleeve-Sekunde liegt nicht auf dem kritischen Pfad - verloren ist nur
  // sein Vertragsrang (Abschnitt 7: ~2 % der Rangrate, angesetzt 5 %).
  console.log("\n4b. GEBAUTE REGEL: Sleeve-Zeit * 0,05 <= Gewinn (Kosten = entgangener Vertragsrang)");
  for (const g of [0.03, G, 0.3]) {
    const zeile = chas.map((c) => {
      let n = 0;
      while (n < 200 && naechsterMannS(c, n) * 0.05 <= mannGewinnS(n, g)) n++;
      return ("n*=" + n).padStart(9);
    }).join("");
    console.log("   g=" + f(g, 3).padEnd(6) + zeile + "   (angefragt werden hoechstens 6)");
  }

  // 5. DER ECHTE SLEEVE: Charisma waechst mit (Schock!)
  console.log("\n5. DER ECHTE SLEEVE (Monte Carlo, 4.000 Laeufe, Charisma waechst mit, Exp mal shockBonus)");
  const sl = p.sleeves.map((x, i) => ({ i, d: x.data }))
    .sort((a, b) => b.d.skills.charisma - a.d.skills.charisma)[0];
  console.log("   Sleeve " + sl.i + ": Charisma " + sl.d.skills.charisma + " (Exp " + f(sl.d.exp.charisma, 1)
    + "), Schock " + f(sl.d.shock, 1) + ", sync " + f(sl.d.sync, 1));
  for (const bis of [1, 2, 3, 4, 6, 10]) {
    const r = simuliere({ chaExp: sl.d.exp.charisma, chaMult: sl.d.mults.charisma, shock: sl.d.shock, von: 0, bis });
    let analytisch = 0;
    for (let k = 0; k < bis; k++) analytisch += naechsterMannS(sl.d.skills.charisma, k);
    let gewinn = 0;
    for (let k = 0; k < bis; k++) gewinn += mannGewinnS(k, G);
    console.log("   0 -> " + String(bis).padStart(2) + " Mann: " + f(r.s / 60, 1).padStart(6) + " min (Charisma fest: "
      + f(analytisch / 60, 1) + ")  Charisma danach " + f(r.chaEnde, 1)
      + "   Black Op frueher um " + f(gewinn / 60, 1) + " min");
  }

  // 6. VERLUSTE
  console.log("\n6. VERLUSTE JE BLACK OP (TeamCasualties.ts: Erfolg 1..ceil(n/2), Fehlschlag 1..n)");
  for (const n of [1, 2, 3, 4, 6]) {
    const erfolg = (1 + Math.ceil(n / 2)) / 2, fehl = (1 + n) / 2;
    let ersatz = 0;
    const rest = n - Math.round(erfolg);
    for (let k = Math.max(0, rest); k < n; k++) ersatz += naechsterMannS(sl.d.skills.charisma, k);
    console.log("   n=" + n + ": im Mittel " + f(erfolg, 1) + " Tote bei Erfolg, " + f(fehl, 1)
      + " bei Fehlschlag; Ersatz nach Erfolg " + f(ersatz / 60, 1) + " min (Charisma " + sl.d.skills.charisma + ")");
  }

  // 7. WAS DER SLEEVE SONST TAETE
  console.log("\n7. OPPORTUNITAETSKOSTEN: Vertrag des Sleeves gegen Rang des Spielers");
  const kampf = Math.min(sl.d.skills.strength, sl.d.skills.defense, sl.d.skills.dexterity, sl.d.skills.agility);
  console.log("   Kampfwert-Tiefstand des Sleeves " + kampf + " (sleeve.js faehrt Vertraege erst ab 40, sonst Gym)");
  if (neu.blade && /Retirement/.test(String(neu.blade.istAktion)) && Number.isFinite(neu.blade.chance)) {
    // Gleicher Vertrag, gleiche Stufe, gleiche Stadt: Chance und Dauer
    // skalieren mit der competence bzw. dem statFac (Action.ts:105-121,
    // 169-196). Bevoelkerung, Chaos und Schwierigkeit kuerzen sich heraus.
    const w = { strength: 0.2, defense: 0.2, dexterity: 0.2, agility: 0.2, charisma: 0.1, intelligence: 0.1 };
    const dcy = { strength: 0.91, defense: 0.91, dexterity: 0.91, agility: 0.91, charisma: 0.8, intelligence: 0.9 };
    const m = skillMults(p.bladeburner.data.skills);
    const effMult = { strength: m("EffStr"), defense: m("EffDef"), dexterity: m("EffDex"), agility: m("EffAgi"), charisma: 1, intelligence: 1 };
    const comp = (sk) => Object.keys(w).reduce((a, k) => a + w[k] * Math.pow(sk[k] * effMult[k], dcy[k]), 0)
      * (1 + (0.75 * Math.pow(sk.intelligence, 0.8)) / 600);
    const stat = (sk) => {
      const a = sk.agility * m("EffAgi"), d = sk.dexterity * m("EffDex");
      return 0.5 * (Math.pow(a, 0.04) + Math.pow(d, 0.035) + a / 10e3 + d / 10e3);
    };
    const cS = Math.min(1, neu.blade.chance * comp(sl.d.skills) / comp(p.skills));
    const tS = neu.blade.dauer / 1000 * stat(p.skills) / stat(sl.d.skills);
    const gain = 0.6 * Math.pow(1.065, (neu.blade.stufe || 1) - 1);
    const rangSleeveH = cS * gain / tS * 3600;
    const rangSpielerH = neu.blade.chance * gain / (neu.blade.dauer / 1000) * 3600;
    console.log("   Retirement Stufe " + neu.blade.stufe + ": Spieler Chance " + f(neu.blade.chance, 3) + " / "
      + f(neu.blade.dauer / 1000, 0) + " s, Sleeve " + f(cS, 3) + " / " + f(tS, 1) + " s");
    console.log("   => Sleeve ~" + f(rangSleeveH, 1) + " Rang/h, Spieler ~" + f(rangSpielerH, 1)
      + " Rang/h (nur dieser Vertrag)");
  }
  console.log("   Spaet im Knoten gemessen (sleeve.js, 31.08.): alle Sleeves zusammen ~43 Rang/min gegen"
    + " 1.412 Rang/min Spieler - ein Sleeve also ~1 % der Rangrate.");

  console.log("\nERGEBNIS: siehe Kommentar 'TRUPP FUER DIE BLACK OP' in src/sleeve.js.");
  return eichOk ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
