// P2b / Aufgabe B: gemeinsame Helfer fuer "Was ist ein Dollar am Tor wert?".
// Nur lesen: Spielstaende (backups/*.json.gz), Spielquelle (reference/), Bot-Quelle
// (src/lib/einbau.js, src/lib/hackaugs.js - als reine Funktionen importiert, nie veraendert).
//
// Bausteine:
//   loadBot()         die ECHTE Rundenwahl des Bots (waehleTorRunde) und seine Tabellen
//   loadState(file)   Spielstand -> { p, bb, sf, factions, repOf }
//   buildCandidates   Kandidatenliste wie bn4rep.js Zeile 831-844 + 1661-1670
//   planRound         waehleTorRunde mit den Eingaben, die bn4rep.js ihr gibt
//   beamRound         Gegenprobe: Strahlsuche (Obergrenze, die der Bot nicht kennt)
//   blackOps          die 21 Black Ops aus der Spielquelle 3.0.2 (verify-g01-substanz-bb.mjs)
//
// Aufruf: nur als Bibliothek (import).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readSave } from "./gang-save.mjs";
import { loadAugs } from "./aug-data.mjs";
import { exactGangOffer } from "./gang-augs.mjs";
import { BLACKOPS, successChance as boSuccess, skillMults, actionTime as boActionTime } from "./verify-g01-substanz-bb.mjs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const BACKUPS = path.join(ROOT, "backups");
export const AUGS = loadAugs();
export { BLACKOPS, boSuccess, skillMults, boActionTime };

/** Black Ops in Spielreihenfolge (n = 0..20), Daten aus BlackOperations.ts 3.0.2. */
export const blackOps = Object.values(BLACKOPS).sort((a, b) => a.n - b.n);

/** CONSTANTS.MultipleAugMultiplier (Constants.ts:41), ohne SF11 exakt 1,9. */
export const STEP = 1.9;

let botCache = null;
/** Die echten Bot-Funktionen. Rein (kein ns, keine Imports in den Dateien). */
export async function loadBot() {
  if (botCache) return botCache;
  const e = await import(pathToFileURL(path.join(ROOT, "src", "lib", "einbau.js")).href);
  const h = await import(pathToFileURL(path.join(ROOT, "src", "lib", "hackaugs.js")).href);
  const table = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "lib", "blackops.json"), "utf8"));
  botCache = { ...e, COMBAT_AUGS: h.COMBAT_AUGS, blackopsTable: table };
  return botCache;
}

export function backupPath(name) {
  const direct = path.isAbsolute(name) ? name : path.join(BACKUPS, name);
  if (fs.existsSync(direct)) return direct;
  const hit = fs.readdirSync(BACKUPS).filter((f) => f.includes(name)).sort();
  if (!hit.length) throw new Error("kein Spielstand: " + name);
  return path.join(BACKUPS, hit[hit.length - 1]);
}

/** Spielstand -> Spieler, Bladeburner, Source Files, Faktionsruf. */
export function loadState(file) {
  const { save, p, factions } = readSave(backupPath(file));
  const bb = p.bladeburner && (p.bladeburner.data || p.bladeburner);
  const sf = Object.fromEntries((p.sourceFiles && p.sourceFiles.data) || []);
  const repOf = (f) => {
    const d = factions[f];
    const x = d && (d.data || d);
    return x && Number.isFinite(x.playerReputation) ? x.playerReputation : 0;
  };
  return { save, p, bb, sf, factions, repOf };
}

const NUM_KEYS = ["hacking", "strength", "defense", "dexterity", "agility", "bladeburner_success_chance"];

/** Produkt der fuer die Competence relevanten Faktoren einer Namensliste (wie gateMultsProduct). */
export function multsProduct(names, combatAugs) {
  const e = {};
  for (const n of names) {
    const m = combatAugs[n];
    if (!m) continue;
    for (const k of NUM_KEYS) {
      const f = Number(m[k]);
      if (Number.isFinite(f) && f > 0 && f !== 1) e[k] = (e[k] || 1) * f;
    }
  }
  return e;
}

/**
 * Kandidaten wie bn4rep.js sie der Rundenwahl gibt (Z. 831-844, 1661-1670):
 * je beigetretener Faktion jede Aug, die sie anbietet, ausser NFG, schon
 * Besessenen, The Red Pill (v1Positiv false) und allem ohne COMBAT_AUGS-Eintrag.
 * Preis = Grundpreis x 1,9^q (getAugCost, AugmentationHelpers.ts:123-158,
 * BN2: AugmentationMoneyCost = Vorgabe 1, SF11 = 0).
 *
 * @param {object} o
 * @param {string[]} o.joined      beigetretene Faktionen
 * @param {(f:string)=>number} o.repOf  Ruf je Faktion
 * @param {Set<string>} o.owned    installiert ODER schon gekauft
 * @param {number} o.queued        wartende Stuecke (q)
 * @param {object} o.combatAugs    COMBAT_AUGS des Bots
 * @param {number} [o.sfLevel2]    SF2-Stufe (nur fuer die Gang-Angebotsreihenfolge)
 * @param {number} [o.step]        Preisfaktor je wartendem Stueck
 */
export function buildCandidates({ joined, repOf, owned, queued, combatAugs, sfLevel2 = 0, step = STEP }) {
  const gangOffer = new Set(exactGangOffer(2, sfLevel2, 1, "Slum Snakes"));
  const out = [];
  for (const f of joined) {
    const names = f === "Slum Snakes"
      ? [...gangOffer]
      : Object.values(AUGS).filter((a) => a.factions.includes(f)).map((a) => a.name);
    for (const n of names) {
      const a = AUGS[n];
      if (!a || n === "NeuroFlux Governor" || owned.has(n) || n === "The Red Pill") continue;
      const mults = combatAugs[n];
      if (!mults) continue;
      out.push({
        aug: n, faktion: f, rep: repOf(f), repReq: a.repCost,
        preis: a.moneyCost * Math.pow(step, queued), prereq: a.prereqs, mults,
      });
    }
  }
  return out;
}

/** Zusammenfassung der Black-Op-Gewichte wie der Bot sie waehlt (blackOpWeights). */
export function weightsFor(bot, opName) {
  return bot.blackOpWeights(bot.blackopsTable, opName);
}

/**
 * Die Rundenwahl des Bots, mit genau den Eingaben von bn4rep.js:1675-1678.
 * @param {object} s
 * @param {object[]} s.cands   buildCandidates
 * @param {number} s.money     Geld am Tor
 * @param {Set<string>} s.owned
 * @param {object} s.skills    Spielerstufen { hacking, strength, ... }
 * @param {number} s.reaper    Stufe Reaper
 * @param {number} s.evasive   Stufe Evasive System
 * @param {string} s.opName    naechste Black Op (fuer die Gewichte)
 * @param {object} s.startMults Faktoren der wartenden Stuecke
 */
export function planRound(bot, s) {
  const bo = weightsFor(bot, s.opName);
  const eff = bot.bladeEffFactors(s.reaper, s.evasive);
  return bot.waehleTorRunde(s.cands, s.money, s.owned, {
    skills: bot.effectiveLevels(s.skills, eff), weights: bo.weights, decays: bo.decays,
    startMults: s.startMults || {}, priceStep: s.step ?? STEP,
  });
}

// ---------------------------------------------------------------------------
// Gegenprobe: Strahlsuche ueber Mengen mit derselben Kosten- und Zielfunktion
// ---------------------------------------------------------------------------

/**
 * Kosten und Kaufreihenfolge einer Menge exakt wie order() in waehleTorRunde
 * (src/lib/einbau.js:848-864): Wurzeln teuerste zuerst, jede Voraussetzung
 * unmittelbar vor ihrem Nachfolger, Position i kostet Preis x step^i.
 */
export function makeRoundModel(bot, cands, owned, s) {
  const bo = weightsFor(bot, s.opName);
  const eff = bot.bladeEffFactors(s.reaper, s.evasive);
  const levels = bot.effectiveLevels(s.skills, eff);
  const step = s.step ?? STEP;
  const byName = new Map();
  for (const k of cands) {
    if (owned.has(k.aug) || byName.has(k.aug)) continue;
    if (!(k.rep >= k.repReq) || !(Number(k.preis) > 0)) continue;
    byName.set(k.aug, k);
  }
  const closure = (name) => {
    const out = new Set(); let ok = true;
    const add = (n, d) => {
      if (!ok || out.has(n)) return;
      if (d > 32) { ok = false; return; }
      out.add(n);
      for (const pr of byName.get(n).prereq) {
        if (owned.has(pr)) continue;
        if (!byName.has(pr)) { ok = false; return; }
        add(pr, d + 1);
      }
    };
    add(name, 0);
    return ok ? out : null;
  };
  const order = (set) => {
    const names = [...set];
    const roots = names.filter((n) => !names.some((m) => byName.get(m).prereq.includes(n)))
      .sort((a, b) => byName.get(b).preis - byName.get(a).preis);
    const seq = [];
    const push = (n, d) => {
      if (seq.includes(n) || d > 32) return;
      for (const pr of byName.get(n).prereq) if (set.has(pr)) push(pr, d + 1);
      seq.push(n);
    };
    for (const n of roots) push(n, 0);
    for (const n of names) push(n, 0);
    let cost = 0;
    seq.forEach((n, i) => { cost += byName.get(n).preis * Math.pow(step, i); });
    return { seq, cost };
  };
  const start = s.startMults || {};
  const extraOf = (set) => bot.gateMultsProduct([start, ...[...set].map((n) => byName.get(n).mults)]);
  const comp = (set) => {
    const extra = extraOf(set);
    let c = 0;
    for (const stat of Object.keys(bo.weights)) {
      const w = bo.weights[stat];
      if (!(w > 0)) continue;
      const d = bo.decays && Number.isFinite(bo.decays[stat]) ? bo.decays[stat] : 1;
      c += w * Math.pow((Number(levels[stat]) || 0) * (extra[stat] || 1), d);
    }
    return c * (extra.bladeburner_success_chance || 1);
  };
  return { byName, closure, order, comp, base: comp(new Set()) };
}

/** Beste Menge mit Kosten <= money nach Competence (Strahlbreite width). */
export function beamRound(model, money, width = 40) {
  let beam = [{ set: new Set(), gain: model.base, cost: 0 }];
  let best = beam[0];
  for (let depth = 0; depth < model.byName.size + 2; depth++) {
    const next = new Map();
    for (const st of beam) {
      for (const name of model.byName.keys()) {
        if (st.set.has(name)) continue;
        const add = model.closure(name);
        if (!add) continue;
        const set = new Set([...st.set, ...add]);
        const key = [...set].sort().join("|");
        if (next.has(key)) continue;
        const { cost } = model.order(set);
        if (cost > money) continue;
        next.set(key, { set, cost, gain: model.comp(set) });
      }
    }
    if (!next.size) break;
    beam = [...next.values()].sort((a, b) => b.gain - a.gain).slice(0, width);
    if (beam[0].gain > best.gain) best = beam[0];
  }
  const { seq, cost } = model.order(best.set);
  return { seq, cost, gain: best.gain / model.base };
}

/** Kosten einer Reihenfolge von Grundpreisen (teuerste zuerst), q0 wartende. */
export function sequenceCost(bases, q0 = 0, step = STEP) {
  const sorted = [...bases].sort((a, b) => b - a);
  return sorted.reduce((s, b, i) => s + b * Math.pow(step, q0 + i), 0);
}

export const mrd = (x, d = 2) => (x / 1e9).toFixed(d);
export const pad = (s, n) => String(s).padStart(n);
export const padR = (s, n) => String(s).padEnd(n);
