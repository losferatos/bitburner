// Pruefauftrag TORFREQUENZ (04.10.2026): Ist im V2-Kampfknoten (BN2, Bladeburner-Ausgang mit
// 21 Black Ops) ein haeufigeres Einbau-Tor schneller bis zum Ausgang als das heutige 12-h-Tor?
//
// Das Tor oeffnet heute `fertig + max(12 h, 2 x Wiederaufbau)` (src/lib/endspurt.js:322-331,
// bn4rep.js:1176-1205). Der Preisfaktor 1,9^q beginnt nach jedem Einbau bei 0; dafuer kostet jeder
// Einbau etwas. Dieses Werkzeug rechnet BEIDE Seiten aus der Quelle und eicht sie an BN2.1.
//
// ABSCHNITTE (--abschnitt <name>, ohne Angabe alle):
//   eichung   Wiederaufbau-Zeiten je Zyklus aus den Spielstaenden, Rangkonstante kappa je Zyklus,
//             Gegenprobe des Gesamtmodells an BN2.1 Zyklus 2 und 3 (Rueckrechnung)
//   kosten    Was setzt ein Einbau zurueck (Prestige.ts:55-199) und was kostet das in Stunden
//   lauf      BN2.2 vom Live-Stand aus vorwaerts: Stunden bis zum Ausgang je Torregel, mit Spanne
//   frist     Wie spaet darf ein Bau live gehen (Ausgang gegen Einspielzeit)
//
// MODELL (alles Spielzeit in Stunden; Fundstellen im Code an jeder Stelle):
//   Rang      dR/dt = kappa * C * Schub(C), gedeckelt auf hmax * R. C ist die Black-Op-Competence
//             (Action.ts:169-196) mit ALLEN Chance-Multiplikatoren der Faehigkeiten; die Rang-
//             Konstante kappa ist an BN2.1 geeicht (Abschnitt eichung), nicht uebernommen.
//   Faehigk.  Stufen aus den Skillpunkten (maxRank/3, Bladeburner.ts:1285-1292) ueber die
//             gemessene Verteilung der Bot-Kaeufe in BN2.1 (Tabelle aus den Spielstaenden)
//   Kampfwerte Stufe = floor(mult * (32 ln(exp + 534,6) - 200)) (skill.ts), Erfahrung aus den
//             Aktionen (Bladeburner.ts:704-733: Zeit x Schwierigkeitsfaktor), beim Einbau auf 0
//             (PlayerObjectGeneralMethods.ts:80-100), danach Gym bis Tiefstand 100
//   Gang      Motor und Regler von gang-p2b-sim.mjs (an der echten Gang geeicht), Einbau wie
//             Prestige.ts:129-143 + Faction.ts:77-86 (applyInstall)
//   Runde     die ECHTE waehleTorRunde (src/lib/einbau.js), Kandidaten der Gang-Faktion und der
//             Bladeburner-Faktion mit dem jeweils vorhandenen Ruf
//   Geld      Bot-Einkommen exogen (Parameter), Gang-Geld aus dem Motor; beim Einbau wird das
//             Konto auf 1000 gesetzt (PlayerObjectGeneralMethods.ts:111) - uebrig gebliebenes Geld
//             verfaellt
//
// Aufruf: node tools/audit/tor-frequenz.mjs [--abschnitt eichung|kosten|lauf|frist] [--schnell]
// Nur lesen: Spielstaende (backups/), Spielquelle (reference/), Bot-Quelle (src/, importiert,
// nie veraendert) und - fuer den Live-Stand - getSaveFile ueber die Bruecke (Port 8795, LIVE).
// Schreibt nichts ausser auf stdout.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import * as S from "./gang-p2b-sim.mjs";
import * as F from "./gang-formulas.mjs";
import { snapshot, loadBackup, loadLive } from "./gang-p2b-live.mjs";
import { loadAugs } from "./aug-data.mjs";
import { waehleTorRunde, bladeEffFactors, effectiveLevels, gatePriceStep } from "../../src/lib/einbau.js";
import { COMBAT_AUGS } from "../../src/lib/hackaugs.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const BACKUPS = path.join(ROOT, "backups");
const args = (() => { const a = {}; const v = process.argv.slice(2); for (let i = 0; i < v.length; i++) if (v[i].startsWith("--")) a[v[i].slice(2)] = v[i + 1] && !v[i + 1].startsWith("--") ? v[++i] : true; return a; })();
const f1 = (x, d = 1) => (Number.isFinite(x) ? x.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d }) : String(x));
const mrd = (x, d = 1) => f1(x / 1e9, d);

// ============================================================================
// 0. SPIELSTAENDE LESEN
// ============================================================================
const unwrap = (x) => (x && typeof x === "object" && "ctor" in x && "data" in x ? x.data : x);
export function flat(x) {
  if (Array.isArray(x)) return x.map(flat);
  if (x && typeof x === "object") {
    if ("ctor" in x && "data" in x && Object.keys(x).length === 2) return flat(x.data);
    const o = {};
    for (const [k, v] of Object.entries(x)) o[k] = flat(v);
    return o;
  }
  return x;
}
export function loadSaveFile(name) {
  const file = path.isAbsolute(name) ? name : path.join(BACKUPS, name);
  const save = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
  return decodeSave(save);
}
export function decodeSave(save) {
  const p = JSON.parse(save.data.PlayerSave).data;
  const servers = JSON.parse(save.data.AllServersSave);
  const factions = JSON.parse(save.data.FactionsSave);
  const bb = p.bladeburner ? flat(p.bladeburner) : null;
  return { save, p, servers, factions, bb };
}
export function homeFile(servers, name) {
  const home = flat(servers.home);
  const tf = home.textFiles;
  if (!tf) return null;
  const list = Array.isArray(tf) ? tf : (tf.data || Object.entries(tf));
  for (const e of list) {
    const [fn, obj] = Array.isArray(e) ? e : [e.filename, e];
    if (fn === name || fn === "/" + name) return (obj && (obj.text ?? obj.data?.text)) ?? null;
  }
  return null;
}
const runFiles = (run) => fs.readdirSync(BACKUPS).filter((f) => f.endsWith(".json.gz") && f.includes("_" + run + "_")).sort();
const stamp = (f) => f.replace(/^LIVE_[0-9a-f]+_/, "").replace(".json.gz", "");

// ============================================================================
// 1. RANG-MODELL
// ============================================================================
// Black-Op-Competence der ersten Black Op (Typhoon): Action.ts:169-196, Gewichte BlackOperations.ts:7-31.
const W = { hacking: 0.1, strength: 0.2, defense: 0.2, dexterity: 0.2, agility: 0.2 };
const DEC = { hacking: 0.6, strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8 };
const SKN = ["Overclock", "Reaper", "Evasive System", "Blade's Intuition", "Digital Observer", "Short-Circuit", "Cloak", "Tracer", "Cyber's Edge", "Datamancer", "Hyperdrive"];
// BlackOperations.ts: reqdRank / rankGain der 21 Black Ops
const BO = [[2.5e3, 50], [5e3, 60], [7.5e3, 75], [10e3, 100], [12.5e3, 125], [15e3, 200], [20e3, 300], [25e3, 500], [30e3, 750], [40e3, 1e3],
  [50e3, 1.5e3], [75e3, 2e3], [100e3, 2.5e3], [125e3, 3e3], [150e3, 4e3], [175e3, 5e3], [200e3, 7.5e3], [250e3, 10e3], [300e3, 15e3], [350e3, 20e3], [400e3, 40e3]];
// Ausgangsbedingung: Rang 400.000 (BlackOperations.ts:704-710) UND genug Competence fuer die letzten drei
// Black Ops (blade.js:2349-2360: Centurion 0,50, Vindictus 0,75, Daedalus 0,45). Die Zahl 1,6e5 kommt aus
// BN2.1 (verify-p2b-praemisse.md E1: Chancen 0,293/0,273/0,256 bei Competence ~5,8e4 -> Vindictus braucht x2,75),
// gegengeprueft an Zyklus 3 (Ausgang 3,55 h; C 1,08e5 bei 3,20 h, 4,2e5 bei 3,55 h).
export const C_EXIT = 1.6e5;
export const EXIT_RANK = 400e3;
export const EXIT_TAIL_H = 0.15;               // Ausfuehrung der letzten drei Black Ops (Zyklus 3: 0,2 h)

// Skillverteilung: Stufen je Skillpunkt-Summe, gemessen in BN2.1 + BN2.2 (Staende der Zyklen 1-3).
let ALLOC_TAB = null;
function allocTable() {
  if (ALLOC_TAB) return ALLOC_TAB;
  const tab = [];
  for (const run of ["BN2L1", "BN2L2"]) for (const f of runFiles(run)) {
    const { bb } = loadSaveFile(f);
    if (bb && bb.totalSkillPoints >= 30) tab.push({ sp: bb.totalSkillPoints, k: { ...bb.skills } });
  }
  tab.sort((a, b) => a.sp - b.sp);
  for (const n of SKN) { let m = 0; for (const x of tab) { m = Math.max(m, x.k[n] || 0); x.k[n] = m; } }   // monoton: gekaufte Stufen gehen nie zurueck
  ALLOC_TAB = tab;
  return tab;
}
export function alloc(sp) {
  const tab = allocTable();
  const last = tab[tab.length - 1];
  if (sp <= tab[0].sp) { const f = sp / tab[0].sp; return Object.fromEntries(SKN.map((n) => [n, (tab[0].k[n] || 0) * f])); }
  if (sp >= last.sp) return Object.fromEntries(SKN.map((n) => [n, last.k[n] || 0]));
  let i = 1; while (tab[i].sp < sp) i++;
  const a = tab[i - 1], b = tab[i];
  const f = (Math.log(sp) - Math.log(a.sp)) / (Math.log(b.sp) - Math.log(a.sp));
  return Object.fromEntries(SKN.map((n) => [n, (a.k[n] || 0) + f * ((b.k[n] || 0) - (a.k[n] || 0))]));
}

// skill.ts: Stufe aus Erfahrung und Multiplikator; BN2: HackingLevelMultiplier 0,8 (BitNode.tsx case 2), Kampf 1
const lvl = (E, m) => Math.max(1, Math.floor(m * (32 * Math.log(E + 534.6) - 200)));
const E100 = (m) => Math.max(0, Math.exp((100 / m + 200) / 32) - 534.6);
// Reaper/Evasive/Chance-Faehigkeiten: Skills.ts, Bladeburner.ts:757-784; Action.ts:169-196
export function competence(L, bbs, bbAug) {
  const g = (n) => bbs[n] || 0;
  const rp = 1 + 2 * g("Reaper") / 100, ev = 1 + 4 * g("Evasive System") / 100;
  const eff = { hacking: L.hacking, strength: L.strength * rp, defense: L.defense * rp, dexterity: L.dexterity * rp * ev, agility: L.agility * rp * ev };
  let C = 0;
  for (const st of Object.keys(W)) C += W[st] * Math.pow(eff[st], DEC[st]);
  const chm = (1 + 0.03 * g("Blade's Intuition")) * (1 + 0.055 * g("Short-Circuit")) * (1 + 0.04 * g("Digital Observer"));
  return C * chm * bbAug;
}
// Hacking-Stufe nach einem Einbau (gemessen BN2.1 Zyklus 2/3: 247 -> 336 nach 1,2 h, danach +45 je ln-Stunde)
const hackLevel = (tau) => (tau < 1.2 ? 230 + 106 * tau / 1.2 : 336 + 45 * Math.log(tau / 1.2));

export const PARAMS = {
  kappa: 3.3,         // Rang je Stunde je Competence-Einheit (Gittersuche an Zyklus 2+3, Abschnitt eichung C; Zyklus 2 allein 3,2)
  kappaLow: 0.35,     // Zuschlag fuer kleinen Rang: kappa * (1 + kappaLow * exp(-R / kappaR)); frische Fenster messen 4,4-4,5 gegen 3,2-3,4
  kappaR: 4000,
  capFloor: 20000,    // der Deckel hmax * R gilt erst ab diesem Rang (darunter hmax * capFloor): bei Rang 6 ist er kein Gesetz
  hmax: 0.55,         // Deckel: e-Faltungsrate des Rangs im gesaettigten Bereich (Zyklus 3 gemessen 0,57-0,65 je Stunde, Gitter 0,55)
  boost: 1.8,         // Schub der Rangrate, wenn die Competence die Schwelle von Zyklus 3 ueberschreitet (Overclock/Hyperdrive-Kaeufe)
  boostLo: 3000, boostHi: 6000,
  g0: 100, g1: 1.0,   // Erfahrung je Stunde: expm * (max(gFloor, g0 * sqrt(R)) + g1 * rate) fuer Geschicklichkeit/Beweglichkeit (Eichung: Zyklus 1-3)
  gFloor: 2900,       // Sockel: in frischen Knoten 4,2-4,5k/h bei Exp-Mult 1,434, unabhaengig vom Rang (Zyklus 1, BN2.2)
  strShare: 0.55,     // Staerke/Verteidigung bekommen diesen Anteil
  gymMin: 6,          // Minuten Gym bis Tiefstand 100 nach einem Einbau (gemessen 3,2 / 8,1; frischer Knoten 18)
};
const smooth = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

/** Ein Schritt (dt Stunden). S: { R, boDone, E, m, bbAug, expm, tau, gymLeft, intel }. */
export function rankStep(S, P, dt) {
  const sp = Math.floor(S.R / 3);
  const bbs = alloc(sp);
  const L = { hacking: hackLevel(S.tau), strength: lvl(S.E.strength, S.m.strength), defense: lvl(S.E.defense, S.m.defense),
    dexterity: lvl(S.E.dexterity, S.m.dexterity), agility: lvl(S.E.agility, S.m.agility) };
  const C = competence(L, bbs, S.bbAug);
  let r = 0;
  if (S.gymLeft > 0) S.gymLeft -= dt;
  else {
    const boost = 1 + (P.boost - 1) * smooth((C - P.boostLo) / (P.boostHi - P.boostLo));
    const kap = P.kappa * (1 + P.kappaLow * Math.exp(-S.R / P.kappaR));
    r = Math.min(kap * C * boost, P.hmax * Math.max(S.R, P.capFloor));
    // Gegenprobe (Annahme "Anfangsphase haengt NICHT an der Competence", z. B. weil Raid-Vorrat/Ausdauer bindet): Rang waechst unabhaengig von C,
    // bis die Competence die Schubschwelle erreicht.
    if (P.indepA !== undefined && C < P.boostLo) r = P.indepA + P.indepB * S.R;
  }
  S.R += r * dt;
  while (S.boDone < BO.length && S.R >= BO[S.boDone][0]) { S.R += BO[S.boDone][1]; S.boDone++; }
  if (S.gymLeft <= 0) {
    const G = S.expm * (Math.max(P.gFloor, P.g0 * Math.sqrt(Math.max(S.R, 1))) + P.g1 * r) * dt;
    S.E.dexterity += G; S.E.agility += G; S.E.strength += P.strShare * G; S.E.defense += P.strShare * G;
  }
  S.tau += dt;
  return { C, L, r, bbs };
}
export const exitReached = (S, C) => S.R >= EXIT_RANK && C >= C_EXIT;

// ============================================================================
// 2. EICHUNG
// ============================================================================
let CYCLES = null;
function cycleStates() {
  if (CYCLES) return CYCLES;
  // alle Staende von BN2L1/BN2L2, gruppiert nach lastAugReset (= Zyklus)
  const cyc = new Map();
  for (const run of ["BN2L1", "BN2L2"]) for (const f of runFiles(run)) {
    const d = loadSaveFile(f);
    const key = d.p.lastAugReset;
    if (!cyc.has(key)) cyc.set(key, []);
    cyc.get(key).push({ f, d, t: d.p.playtimeSinceLastAug / 3.6e6, R: d.bb.rank, pt: d.p.totalPlaytime });
  }
  const keys = [...cyc.keys()].sort((a, b) => a - b);
  CYCLES = keys.map((k) => ({ aug: k, pts: cyc.get(k).sort((a, b) => a.t - b.t) }));
  return CYCLES;
}

function sectionEichung() {
  console.log("=== EICHUNG A: Wiederaufbau je Zyklus (data/einbau-uhr.json aus den Spielstaenden) ===");
  console.log("Wiederaufbau = Zeit vom ersten Blick nach dem Einbau (`playtime`) bis alle vier Kampfwerte >= 100 (`fertig`), bn4rep.js:1176-1205.");
  const cycles = cycleStates();
  const names = ["Zyklus 1 (frischer Knoten BN2.1)", "Zyklus 2 (Einbau 03.10. 19:01)", "Zyklus 3 (Einbau 04.10. 07:05)", "BN2.2 (frischer Knoten)"];
  cycles.forEach((c, i) => {
    const last = c.pts[c.pts.length - 1];
    const uhr = JSON.parse(homeFile(last.d.servers, "data/einbau-uhr.json") || "null");
    const mults = last.d.p.mults;
    const rebuild = uhr && Number.isFinite(uhr.fertig) ? (uhr.fertig - uhr.playtime) / 60000 : null;
    console.log(`  ${names[i].padEnd(36)} Wiederaufbau ${rebuild === null ? "-" : f1(rebuild, 1) + " min"}`
      + `  Kampf-Mult str ${f1(mults.strength, 3)} dex ${f1(mults.dexterity, 3)} agi ${f1(mults.agility, 3)}  Exp-Mult ${f1(mults.strength_exp, 3)}`
      + `  Tor = fertig + 12 h = Zyklusstunde ${rebuild === null ? "-" : f1(rebuild / 60 + 12, 2)}`);
  });
  console.log("  HINWEIS: der Frischknoten-Wert 18,4 min (BN2.1) gegen 6,2 min (BN2.2) ist ein Messartefakt - bn4rep.js beginnt die Uhr beim ersten Blick.");
  console.log("  In BN2.2 lag der erste Blick 15,8 min nach dem Knotenstart (Uhr 10:54:25 gegen Reset 10:38:37, aus totalPlaytime/lastNodeReset); die Kampfwerte waren");
  console.log("  bei +22,0 min (11:00:33) auf 100 - wie BN2.1 (18,4 min) und die Formel. Gym 10 Erf./s x Exp-Mult je Wert, E100 = exp((100/m+200)/32) - 534,6:");
  for (const [nm, m, em] of [["Zyklus 1/BN2.2 (m 1,434)", [1.434, 1.434, 1.434, 1.434], 1.434], ["Zyklus 2 (m 1,55/1,55/1,88/1,55)", [1.552, 1.552, 1.882, 1.552], 1.869], ["Zyklus 3 (m 2,90/3,12/5,48/2,13)", [2.895, 3.117, 5.477, 2.126], 1.888]]) {
    const need = m.reduce((s, x) => s + E100(x), 0);
    console.log(`    ${nm.padEnd(38)} E100 je Wert ${m.map((x) => f1(E100(x), 0)).join("/")}  Summe ${f1(need, 0)} -> ${f1(need / (10 * em) / 60, 1)} min bei vier Werten nacheinander`);
  }
  console.log("  Die oft genannten 3,1 h (HEBEL.md, kpi.json t_rebuild_h soll) gehoeren zu BN6/7 am 30.08.2026, NICHT zu BN2.1.\n");

  console.log("=== EICHUNG B: Rangkonstante kappa = dRang / Integral(C dt) je Zyklus (C = Typhoon-Competence mit allen Chance-Faehigkeiten) ===");
  const rows = [];
  cycles.forEach((c, i) => {
    let dR = 0, I = 0;
    for (let k = 1; k < c.pts.length; k++) {
      const a = c.pts[k - 1], b = c.pts[k]; const dt = b.t - a.t; if (dt <= 0.01) continue;
      const ca = competenceOfSave(a.d), cb = competenceOfSave(b.d);
      dR += b.R - a.R;
      I += (ca === cb ? ca : (cb - ca) / Math.log(cb / ca)) * dt;
    }
    rows.push({ i, dR, I, kappa: dR / I, t0: c.pts[0].t, t1: c.pts[c.pts.length - 1].t });
    console.log(`  ${names[i].padEnd(36)} t ${f1(c.pts[0].t, 2)}..${f1(c.pts[c.pts.length - 1].t, 2)} h  dRang ${f1(dR, 0).padStart(9)}  Integral C dt ${f1(I, 0).padStart(9)}  kappa ${f1(dR / I, 2)}`);
  });
  console.log("  Zyklus 1 enthaelt eine Stillstandsphase (5,3 h -> 14,0 h: Rang 1.734 -> 2.191, Bot-Pause); sauberes Fenster 0,85-5,29 h: kappa 4,4.");
  console.log("  Alle Staende zusammen (27 Intervalle aus BN2/4/9/10): ln(r) = 0,87 + 1,03 ln(C), R^2 0,80 -> Elastizitaet 1,0; Rang und Overclock-Stufe erklaeren nichts dazu.\n");
  return rows;
}

function competenceOfSave(d) {
  const p = d.p, bb = d.bb;
  return competence(p.skills, bb.skills || {}, p.mults.bladeburner_success_chance);
}

/** Zustand eines Zyklus ab dem Einbau (Mults NACH dem Einbau, Rang aus dem Vorgaengerzyklus). */
function cycleStart(cycles, idx, P, gymMin) {
  const c = cycles[idx];
  const a0 = c.pts[0].d.p;
  const m = { strength: a0.mults.strength, defense: a0.mults.defense, dexterity: a0.mults.dexterity, agility: a0.mults.agility };
  const prev = idx > 0 ? cycles[idx - 1].pts[cycles[idx - 1].pts.length - 1] : null;
  const R = prev ? prev.R : c.pts[0].R;
  const boDone = prev ? prev.d.bb.numBlackOpsComplete : c.pts[0].d.bb.numBlackOpsComplete;
  const S = { R, boDone, E: { strength: E100(m.strength), defense: E100(m.defense), dexterity: E100(m.dexterity), agility: E100(m.agility) }, m,
    bbAug: a0.mults.bladeburner_success_chance, expm: a0.mults.strength_exp, tau: 0, gymLeft: gymMin / 60 };
  return S;
}


/** Zustand direkt aus einem Spielstand (gemessene Erfahrung und Mults). */
export function stateFromSave(d, intel) {
  const p = d.p, bb = d.bb;
  return { R: bb.rank, boDone: bb.numBlackOpsComplete,
    E: { strength: p.exp.strength, defense: p.exp.defense, dexterity: p.exp.dexterity, agility: p.exp.agility },
    m: { strength: p.mults.strength, defense: p.mults.defense, dexterity: p.mults.dexterity, agility: p.mults.agility },
    bbAug: p.mults.bladeburner_success_chance, expm: p.mults.strength_exp, tau: p.playtimeSinceLastAug / 3.6e6, gymLeft: 0, intel: intel ?? p.skills.intelligence };
}

/** Rueckrechnung der frischen Fenster (Zyklus 1 bis 5,3 h, BN2.2 bis zum letzten Stand) ab dem ersten Stand mit Rang > 0. */
export function hindcastFresh(P, verbose = false) {
  const cycles = cycleStates();
  const out = [];
  for (const [idx, tEnd, label] of [[0, 5.3, "BN2.1 Zyklus 1 (0,85-5,3 h)"], [cycles.length - 1, 99, "BN2.2 (ab 0,65 h)"]]) {
    const c = cycles[idx];
    const pts = c.pts.filter((x) => x.t <= tEnd);
    const S = stateFromSave(pts[0].d);
    const dt = 1 / 60; let ai = 1; const rec = [];
    while (ai < pts.length) {
      rankStep(S, P, dt);
      while (ai < pts.length && S.tau >= pts[ai].t) { rec.push({ t: pts[ai].t, real: pts[ai].R, model: S.R }); ai++; }
    }
    out.push({ label, rec });
    if (verbose) console.log(`  ${label.padEnd(30)} ` + rec.map((r) => `${f1(r.t, 2)} h: ${f1(r.real, 0)}/${f1(r.model, 0)} (${f1(r.model / r.real, 2)})`).join("  "));
  }
  return out;
}

export function hindcast(P, verbose = false) {
  const cycles = cycleStates();
  const out = [];
  for (const idx of [1, 2]) {
    const c = cycles[idx];
    const S = cycleStart(cycles, idx, P, idx === 1 ? 3.2 : 8.1);
    const dt = 1 / 60;
    let ai = 1; const rec = [];
    let exitT = null;
    while (S.tau < c.pts[c.pts.length - 1].t + 4 && ai <= c.pts.length) {
      const o = rankStep(S, P, dt);
      while (ai < c.pts.length && S.tau >= c.pts[ai].t) { rec.push({ t: c.pts[ai].t, real: c.pts[ai].R, model: S.R }); ai++; }
      if (exitT === null && exitReached(S, o.C)) { exitT = S.tau + EXIT_TAIL_H; }
      if (exitT !== null && ai >= c.pts.length) break;
    }
    out.push({ idx, rec, exitT, realExit: idx === 2 ? c.pts[c.pts.length - 1].t : null });
    if (verbose) {
      console.log(`  Zyklus ${idx + 1}: Rang echt/Modell (Verhaeltnis) ` + rec.map((r) => `${f1(r.t, 2)} h: ${f1(r.real, 0)}/${f1(r.model, 0)} (${f1(r.model / r.real, 2)})`).join("  "));
      if (idx === 2) console.log(`           Ausgang Modell ${exitT === null ? "nicht erreicht" : f1(exitT, 2) + " h"} gegen echt ${f1(c.pts[c.pts.length - 1].t, 2)} h`);
    }
  }
  return out;
}


// ============================================================================
// 3. KNOTEN-SIMULATION: Rang + Kampfwerte + Gang + Runde + Einbau
// ============================================================================
const AUGDB = loadAugs();
const W_ALL = ["Weapon", "Armor", "Vehicle", "Rootkit"];
const OP = () => S.opWeights("OperationTyphoon");

/** Wirtschaftsparameter (exogen, mit Spanne gerechnet). */
export const ECON = {
  botInc1: 1.2e9,     // $/h Bot-Einkommen im ersten Zyklus eines frischen Knotens (BN2.2 gemessen 1,0-1,2 Mrd/h; BN2.1 Zyklus 1: 2,4-3,8)
  botIncN: 3.0e9,     // $/h in den Zyklen danach (BN2.1 Zyklus 2: 3,1; Zyklus 3: 5,0 - dort mit Hacknet-Augs, die der Bot jetzt erst NACH dem Einbau kauft)
  frmInstall: S.FRM_INSTALL,   // faction_rep je Einbau (NFG-Stufen, gemessen)
  priceStep: gatePriceStep(0),  // 1,9 (kein SF11)
};

/** Kandidaten der Runde: Gang-Faktion mit dem Ruf der Gang, Bladeburner-Faktion mit ihrem Ruf. */
function candidates(node, gangRep) {
  const c = S.gangCandidates(node.owned, gangRep, {});
  for (const a of Object.values(AUGDB)) {
    if (!a.factions.includes("Bladeburners") || node.owned.has(a.name) || !COMBAT_AUGS[a.name] || a.name === "The Blade's Simulacrum") continue;
    c.push({ aug: a.name, faktion: "Bladeburners", rep: node.repBB, repReq: a.repCost, preis: a.moneyCost, prereq: a.prereqs || [], mults: COMBAT_AUGS[a.name] });
  }
  return c;
}

function effLevels(node) {
  const sp = Math.floor(node.S.R / 3);
  const bbs = alloc(sp);
  const sk = { hacking: hackLevel(node.S.tau), strength: lvl(node.S.E.strength, node.S.m.strength), defense: lvl(node.S.E.defense, node.S.m.defense),
    dexterity: lvl(node.S.E.dexterity, node.S.m.dexterity), agility: lvl(node.S.E.agility, node.S.m.agility), intelligence: node.intel };
  const eff = bladeEffFactors(Math.floor(bbs["Reaper"]), Math.floor(bbs["Evasive System"]));
  return effectiveLevels(sk, eff);
}

/** Die Torrunde, die der Planer mit Geld `budget` und den vorhandenen Rufen kaufen wuerde. */
export function planRound(node, budget, o = {}) {
  const bo = OP();
  const cands = candidates(node, o.gangRep ?? node.w.rep);
  return waehleTorRunde(cands, budget, node.owned, { skills: effLevels(node), weights: bo.weights, decays: bo.decays, startMults: {}, priceStep: ECON.priceStep });
}

/** Rufbedarf der Gang wie bn4rep.js ihn meldet (einbau.js gangRepNeed / repNeedKandidaten): 1,02 x hoechster Bedarf im Plan mit dem vierfachen Konto. */
function repNeedOf(node) {
  const bo = OP();
  const raw = candidates(node, Infinity);
  const plan = waehleTorRunde(raw, Math.max(4 * node.w.cash, 1e6), node.owned, { skills: effLevels(node), weights: bo.weights, decays: bo.decays, startMults: {}, priceStep: ECON.priceStep });
  let max = 0;
  for (const s of plan.steps) if (s.faktion === "Slum Snakes") max = Math.max(max, AUGDB[s.aug].repCost);
  return max > 0 ? 1.02 * max : null;
}

/** Knoten aus einem Live-/Backup-Stand + Gang-Schnappschuss. */
export function makeNode(init, P, econ, seed = 1) {
  const node = { S: JSON.parse(JSON.stringify(init.S)), P, econ, intel: init.intel, tNode: init.tNode, owned: new Set(init.owned || []), repBB: init.repBB || 0, favBB: init.favBB || 0,
    cycle: init.cycle || 0, fertigNode: init.fertigNode ?? (init.tNode - init.S.tau + P.gymMin / 60), installs: [], repNeed: null, reserve: 0,
    nextPlanMin: 0, lastR: init.S.R, gainCache: null };
  const snap = JSON.parse(JSON.stringify(init.gangSnap));
  if (!snap.slumSnakes || !Number.isFinite(snap.slumSnakes.playerReputation)) snap.slumSnakes = { playerReputation: 0, favor: 0 };
  node.w = S.makeWorld(snap, { seed, cash0: init.cash ?? snap.money });
  node.w.owned = node.owned;
  const eq = { types: W_ALL, holdH: 3, minRatio: 1.5, horizonH: 1e4 };
  Object.defineProperty(eq, "keepCash", { get: () => node.reserve });
  node.ctrl = S.makeController({ impl: "local", workMode: "switch", repTargetFn: () => (node.repNeed === null ? Infinity : node.repNeed), equip: eq }, null);
  return node;
}

function botIncPerH(node) { return node.cycle === 0 ? node.econ.botInc1 : node.econ.botIncN; }

/** Einbau: Runde kaufen, Konto auf 0 (1000), Erfahrung 0, Gym, Gang- und Faktionsstand wie das Spiel (Prestige.ts). */
export function install(node, plan) {
  const S0 = node.S;
  const before = { tNode: node.tNode, R: S0.R, cash: node.w.cash, gangRep: node.w.rep, repBB: node.repBB, plan: { n: plan.seq.length, cost: plan.cost, gain: plan.gain, seq: plan.seq.slice() } };
  for (const n of plan.seq) {
    node.owned.add(n);
    const m = COMBAT_AUGS[n] || {};
    for (const k of ["strength", "defense", "dexterity", "agility"]) if (m[k]) S0.m[k] *= m[k];
    if (m.bladeburner_success_chance) S0.bbAug *= m.bladeburner_success_chance;
  }
  before.leftover = node.w.cash - plan.cost;
  node.w.cash = 0;                                   // PlayerObjectGeneralMethods.ts:111 money = 1000 + Donations
  const favKeep = node.w.favor;
  S.applyInstall(node.w);                            // Prestige.ts:129-143 + Faction.ts:77-86
  if (node.P.noFavor) node.w.favor = favKeep;        // nur fuer die Zerlegung: Favor-Gewinn aus
  node.w.frm *= node.econ.frmInstall;
  node.favBB = S.repToFavor(S.favorToRep(node.favBB) + node.repBB);
  node.repBB = 0;
  for (const k of Object.keys(S0.E)) S0.E[k] = E100(S0.m[k]);
  S0.gymLeft = node.P.gymMin / 60; S0.tau = 0;
  node.cycle++;
  node.fertigNode = node.tNode + node.P.gymMin / 60;
  node.repNeed = null; node.reserve = 0; node.nextPlanMin = 0;
  before.favorAfter = node.w.favor;
  node.installs.push(before);
  return before;
}

/** Eine Minute Spielzeit. Gibt { C, r, L } zurueck. */
export function stepMinute(node) {
  const w = node.w, dtH = 1 / 60;
  const perTick = botIncPerH(node) / S.TICKS_PER_H;
  const gm0 = w.gangMoney;
  for (let k = 0; k < 30; k++) {
    w.cash += perTick;
    S.tick(w, k % 5 === 0 ? node.ctrl : null);
  }
  if (node.P.gangMoneyScale !== undefined && node.P.gangMoneyScale !== 1) w.cash -= (1 - node.P.gangMoneyScale) * (w.gangMoney - gm0);   // Unsicherheit der noch nie live gemessenen Geldterme
  const R0 = node.S.R;
  const o = rankStep(node.S, node.P, dtH);
  node.repBB += 2 * w.frm * Math.max(0, node.S.R - R0) * (1 + node.favBB / 100);   // Formulas.ts:46-48
  node.tNode += dtH;
  if (node.tNode * 60 >= node.nextPlanMin) {                                       // alle 5 Minuten: Rufbedarf und Ruecklage neu rechnen
    node.nextPlanMin = node.tNode * 60 + 5;
    node.repNeed = repNeedOf(node);
    node.reserve = planRound(node, w.cash).cost;
  }
  return o;
}

/** Tor-Regeln. `deploy` = Knotenstunde, ab der die Regel gilt; davor gilt das Tor von heute (12 h). */
export const RULES = {
  base: () => ({ name: "heute (12 h)", deploy: 0, base: true, t: 12, gainMin: 0, kind: "T", rStop: Infinity }),
  T: (h, deploy = 0, gainMin = 1.15, rStop = 40e3) => ({ name: "Tor " + h + " h (Faktor >= " + gainMin + ")", deploy, t: h, gainMin, kind: "T", rStop }),
  F: (x, tmin, tmax = 12, deploy = 0, rStop = 40e3) => ({ name: "Faktor >= " + x + " (frueh. " + tmin + " h, spaet. " + tmax + " h)", deploy, tmin, tmax, x, kind: "F", rStop }),
};

function gateOpens(node, rule) {
  const active = node.tNode >= rule.deploy;
  const since = node.tNode - node.fertigNode;
  if (node.S.gymLeft > 0) return null;
  if (active && node.S.R >= rule.rStop) return null;      // im Deckelbereich bringt mehr Competence nichts mehr, ein Einbau kostet nur
  if (active && node.installs.length >= (rule.maxInst ?? Infinity)) return null;
  if (!active || rule.kind === "T") {
    const t = active ? rule.t : 12;
    if (since < t) return null;
    const plan = planRound(node, node.w.cash);
    if (!active) return plan.seq.length >= 3 ? plan : null;   // heutige Regel: mindestens drei wartende Stuecke (MINDEST_WARTESCHLANGE, bn4rep.js:1316)
    return plan.gain >= (rule.gainMin || 1) && plan.seq.length > 0 ? plan : null;
  }
  if (since < rule.tmin) return null;
  const plan = planRound(node, node.w.cash);
  if (since >= rule.tmax) return plan.seq.length > 0 ? plan : null;
  return plan.gain >= rule.x && plan.seq.length > 0 ? plan : null;
}

/** Laeuft bis zum Ausgang (oder maxH Knotenstunden). */
export function runNode(init, rule, P, econ, o = {}) {
  const node = makeNode(init, P, econ, o.seed ?? 1);
  const maxMin = Math.round(((o.maxH ?? 60) - node.tNode) * 60);
  let exit = null;
  const series = [];
  for (let i = 0; i < maxMin; i++) {
    const out = stepMinute(node);
    if (exitReached(node.S, out.C)) { exit = node.tNode + EXIT_TAIL_H; break; }
    if (node.tNode * 60 % 30 < 1 && o.series) series.push({ t: node.tNode, R: node.S.R, C: out.C, cash: node.w.cash, rep: node.w.rep });
    if (i % 5 === 0) {
      const plan = gateOpens(node, rule);
      if (plan) install(node, plan);
    }
  }
  return { exit, node, series };
}

/** Anfangszustand aus dem Live-Stand (oder dem neuesten BN2L2-Backup). */
export async function liveInit(P) {
  let d, src;
  try { d = decodeSave(await loadLive()); src = "live"; } catch { const f = runFiles("BN2L2").pop(); d = loadSaveFile(f); src = f; }
  const snap = snapshot(d.save);
  const S0 = stateFromSave(d);
  const tNode = d.p.playtimeSinceLastBitnode / 3.6e6;
  const bbF = flat(d.factions)["Bladeburners"] || {};
  const owned = (d.p.augmentations || []).map((a) => a.name);
  // Zeit, zu der alle vier Kampfwerte >= 100 waren (data/einbau-uhr.json: `fertig` ist totalPlaytime), in Knotenstunden.
  // Das Tor von heute oeffnet 12 h danach (endspurt.js:322-331). bn4rep beginnt die Uhr beim ERSTEN Blick nach dem Knotenstart,
  // der Frischknoten-Wiederaufbau steht deshalb zu kurz in der Datei - `fertig` selbst ist ein absoluter Zeitpunkt und stimmt.
  let fertigNode = 0.1;
  try {
    const uhr = JSON.parse(homeFile(d.servers, "data/einbau-uhr.json") || "null");
    const nodeStartPT = d.p.totalPlaytime - d.p.playtimeSinceLastBitnode;
    if (uhr && Number.isFinite(uhr.fertig) && uhr.augReset === d.p.lastAugReset) fertigNode = (uhr.fertig - nodeStartPT) / 3.6e6;
  } catch { /* dann gilt der Naeherungswert */ }
  return { S: S0, intel: d.p.skills.intelligence, tNode, owned, repBB: bbF.playerReputation || 0, favBB: bbF.favor || 0, cycle: 0,
    fertigNode, gangSnap: snap, cash: d.p.money, src, wall: Date.now(), nodeStartWall: Date.now() - tNode * 3.6e6 };
}

// ============================================================================
// 4. KOSTEN EINES EINBAUS
// ============================================================================
const clockOf = (init, tNodeH) => {
  const d = new Date(init.nodeStartWall + tNodeH * 3.6e6);
  return d.toLocaleString("de-DE", { weekday: "short", hour: "2-digit", minute: "2-digit" });
};

/** Zwei Knoten im Gleichschritt: A laeuft durch, B bekommt bei txH einen Einbau ohne Kauf (reiner Reset-Preis). */
function pureResetCost(init, P, econ, txH, hook) {
  const never = { name: "nie", deploy: 0, kind: "T", t: 1e9, gainMin: 99, rStop: Infinity };
  const A = makeNode(init, P, econ), B = makeNode(init, P, econ);
  const out = { A: {}, B: {} };
  let tA = null, tB = null;
  for (let i = 0; i < 60 * 60; i++) {
    const oa = stepMinute(A), ob = stepMinute(B);
    if (!B.didReset && B.tNode >= txH) { B.didReset = true; const fn = B.fertigNode; install(B, { seq: [], cost: 0, gain: 1 }); B.fertigNode = fn; }   // die 12-h-Uhr bleibt wie in A: gemessen wird nur der Reset
    if (hook) hook(A, B, oa, ob);
    // gleiches Gate-Verhalten wie "heute" in beiden: erst nach 12 h Einbau mit der Planrunde
    if (i % 5 === 0) {
      for (const nd of [A, B]) {
        const rule = RULES.base();
        const plan = gateOpens(nd, rule);
        if (plan && nd.installs.filter((x) => x.plan.n > 0).length === 0) { const rst = nd.didReset; install(nd, plan); nd.didReset = rst; }
      }
    }
    if (tA === null && exitReached(A.S, oa.C)) tA = A.tNode + EXIT_TAIL_H;
    if (tB === null && exitReached(B.S, ob.C)) tB = B.tNode + EXIT_TAIL_H;
    if (tA !== null && tB !== null) break;
  }
  return { tA, tB };
}

function sectionKosten(init, P, econ) {
  console.log("=== KOSTEN EINES EINBAUS (Prestige.ts:55-199, PlayerObjectGeneralMethods.ts:80-141, Bladeburner.ts:259-263) ===");
  const rows = [
    ["Kampfwerte + Hacking + Charisma", "Stufe 1, Erfahrung 0", "PlayerObjectGeneralMethods.ts:84-98", "ja (Gym bis 100, danach Wachstum)"],
    ["Geld", "1000 + Donations; Rest verfaellt", "PlayerObjectGeneralMethods.ts:111", "ja (Kasse vor dem Einbau leeren)"],
    ["Rang, Skillpunkte, Faehigkeiten, Aktionsstufen, Chaos, Ausdauer", "BLEIBEN; nur die laufende Aktion wird abgebrochen", "Bladeburner.ts:259-263", "nein"],
    ["Faktionsruf (Gang, Bladeburners)", "-> 0, aber Favor += f(Ruf)", "Faction.ts:77-86, favor.ts", "Ruf neu verdienen; Favor beschleunigt (+)"],
    ["Gang: Mitglieder, Respekt, Ausruestung, Geld", "BLEIBEN; Aufstiegspunkte x0,95", "Prestige.ts:129-143, Constants.ts:16", "klein"],
    ["Server, Hacknet, Hashes, Programme", "weg (gekaufte Server, Hacknet-Nodes, Hash-Upgrades)", "PlayerObjectGeneralMethods.ts:100-131, Prestige.ts:64-87", "Einkommen baut neu auf"],
    ["Sleeves", "Auftrag weg, Sync/Shock-Erholung", "PlayerObjectGeneralMethods.ts:122", "nicht gerechnet"],
    ["Fraktionseinladungen/-beitritte", "weg (Gang- und Bladeburner-Faktion werden neu betreten)", "Prestige.ts:129-143, Bladeburner.ts:263-272", "gedeckt (automatisch)"],
    ["Augmentierungen/Karma/Erfahrung der Gang/SF", "bleiben", "-", "nein"],
  ];
  console.log("Was wird zurueckgesetzt".padEnd(58), "Wirkung".padEnd(54), "Fundstelle".padEnd(40), "Folge fuer den Bot");
  for (const r of rows) console.log(r[0].padEnd(58), r[1].padEnd(54), r[2].padEnd(40), r[3]);

  console.log("\n-- Gemessen in BN2.1 (Spielstaende): Wiederaufbau 3,2 min (Zyklus 2), 8,1 min (Zyklus 3); Rang nach dem Einbau 12 min spaeter +842 (49.994 -> 50.836) statt ~+1.600 bei der Vorrate:");
  console.log("   -> Verlust ~6-8 min Rangfortschritt je Einbau, KEIN Rangverlust. Das Modell rechnet Gym " + P.gymMin + " min ohne Rang und Erfahrung ab 0.");

  console.log("\n-- Reiner Reset-Preis im Modell (Einbau OHNE Kauf, sonst heutiger Verlauf; Verzug des Ausgangs):");
  for (const tx of [6, 9, 14]) {
    const r = pureResetCost(init, P, econ, tx);
    console.log(`   Reset bei Knotenstunde ${tx}: Ausgang ohne ${f1(r.tA, 2)} h, mit ${f1(r.tB, 2)} h -> Verzug ${f1((r.tB - r.tA) * 60, 0)} min`);
  }

  // Gang-Ruf zurueck: wie lange bis nach dem Einbau wieder Ruf >= Bedarf?
  console.log("\n-- Gang-Ruf nach dem Einbau (Ruf -> 0): Zeit bis Ruf >= Bedarf der naechsten Runde, in Abhaengigkeit vom Favor:");
  for (const favTarget of [0, 46, 140, 224]) {
    const nd = makeNode(init, P, econ);
    // Gang bis 11 h laufen lassen, dann Ruf zuruecksetzen und Favor setzen
    while (nd.tNode < 11.0) stepMinute(nd);
    nd.w.rep = 0; nd.w.favor = favTarget;
    let tBack = null;
    for (let i = 0; i < 12 * 60 && tBack === null; i++) { stepMinute(nd); if (nd.repNeed !== null && nd.w.rep >= nd.repNeed) tBack = (i + 1) / 60; }
    console.log(`   Favor ${String(favTarget).padStart(3)}: Ruf >= Bedarf ${nd.repNeed === null ? "-" : f1(nd.repNeed / 1e6, 3) + " Mio"} nach ${tBack === null ? ">12" : f1(tBack, 2)} h`);
  }

  // Aufstiegspunkte x0,95
  console.log("\n-- Aufstiegspunkte x0,95 (Constants.ts:16): Gang-Geld/Respekt in den 6 h nach dem Einbau mit und ohne die Strafe:");
  {
    const A = makeNode(init, P, econ), Bn = makeNode(init, P, econ);
    while (A.tNode < 11.0) { stepMinute(A); stepMinute(Bn); }
    for (const m of Bn.w.members) { for (const s of F.STATS) m.ascPoints[s] *= F.GC.InstallAscensionPenalty; F.updateSkills(m); }
    const a0 = { gm: A.w.gangMoney, rs: A.w.respect }, b0 = { gm: Bn.w.gangMoney, rs: Bn.w.respect };
    for (let i = 0; i < 6 * 60; i++) { stepMinute(A); stepMinute(Bn); }
    console.log(`   Gang-Geld ${mrd(A.w.gangMoney - a0.gm)} Mrd ohne, ${mrd(Bn.w.gangMoney - b0.gm)} Mrd mit Strafe (${f1(((Bn.w.gangMoney - b0.gm) / (A.w.gangMoney - a0.gm) - 1) * 100, 2)} %); Respekt ${f1(((Bn.w.respect - b0.rs) / (A.w.respect - a0.rs) - 1) * 100, 2)} %`);
  }
  console.log("\n-- Uebrig gebliebenes Geld verfaellt: im Standardlauf je Einbau 0,5-3,9 Mrd (Planrunde schoepft das Konto nicht ganz aus, einbau.js waehleTorRunde: Zuwachs/Kosten-Abbruch).");
}

// ============================================================================
// 5. LAUF: Regeln im Standardszenario + Ensemble
// ============================================================================
function lcg(seed) { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }
const lin = (lo, hi, x) => lo + (hi - lo) * x, lg = (lo, hi, x) => Math.exp(Math.log(lo) + (Math.log(hi) - Math.log(lo)) * x);

/** Latin-Hypercube-Szenarien ueber alle unsicheren Groessen (feste Samen, reproduzierbar). */
export function scenarios(N, seed = 12345) {
  const rnd = lcg(seed);
  const D = 10;
  const perm = Array.from({ length: D }, () => { const a = Array.from({ length: N }, (_, i) => i); for (let i = N - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; });
  const u = (d, i) => (perm[d][i] + rnd()) / N;
  return Array.from({ length: N }, (_, i) => ({
    P: { ...PARAMS, kappa: lin(2.7, 4.0, u(0, i)), boost: lin(1.0, 2.2, u(1, i)), hmax: lin(0.40, 0.90, u(2, i)), capFloor: lg(1e4, 4e4, u(3, i)),
      g0: 100 * lg(0.5, 2, u(4, i)), g1: lg(0.5, 2, u(4, i)), gFloor: 2900 * lg(0.5, 2, u(4, i)), gymMin: lin(3, 20, u(5, i)), gangMoneyScale: lin(0.4, 1.0, u(8, i)), kappaLow: lin(-0.55, 0.5, u(9, i)) },
    E: { ...ECON, botInc1: lin(0.8e9, 2.0e9, u(6, i)), botIncN: lin(1.5e9, 5e9, u(7, i)) } }));
}
const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
const qnt = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; };

export const RULE_SET = () => [RULES.base(), RULES.T(4), RULES.T(6), RULES.T(8), RULES.T(3), RULES.T(2, 0, 1.3), RULES.F(1.4, 2), RULES.F(1.4, 2.5), RULES.F(1.4, 3), RULES.F(1.6, 3), RULES.F(2.0, 3)];

function sectionLauf(init, P, econ, N) {
  console.log(`=== LAUF: BN2.2 vom Stand ${init.src === "live" ? "LIVE " + new Date(init.wall).toLocaleString("de-DE") : init.src} (Knotenstunde ${f1(init.tNode, 2)}, Rang ${f1(init.S.R, 0)}, Kasse ${mrd(init.cash, 2)} Mrd) ===`);
  console.log(`Knotenstart ${new Date(init.nodeStartWall).toLocaleString("de-DE")}; Kampfwerte >= 100 bei Knotenstunde ${f1(init.fertigNode, 3)} (${clockOf(init, init.fertigNode)}) -> erstes Tor nach heutiger Regel (fertig + 12 h) bei Knotenstunde ${f1(init.fertigNode + 12, 2)} = ${clockOf(init, init.fertigNode + 12)}.`);
  const rules = RULE_SET();
  console.log("-- Standardszenario (kappa " + P.kappa + ", boost " + P.boost + ", hmax " + P.hmax + ", Bot " + mrd(econ.botInc1) + "/" + mrd(econ.botIncN) + " Mrd/h, Gym " + P.gymMin + " min)");
  for (const rule of rules) {
    const r = runNode(init, rule, P, econ, { maxH: 70 });
    const inst = r.node.installs.map((i) => `${f1(i.tNode, 1)}h/${clockOf(init, i.tNode).slice(-5)} (${i.plan.n} St., ${mrd(i.plan.cost)} Mrd, x${f1(i.plan.gain, 2)})`).join(" | ");
    console.log("  " + rule.name.padEnd(38), "Ausgang Knotenstunde", f1(r.exit, 2).padStart(6), "=", clockOf(init, r.exit), "|", inst);
  }
  console.log(`\n-- Ensemble: ${N} Szenarien (Latin Hypercube ueber kappa 2,7-4,0 / Schub 1,0-2,2 / Deckel 0,40-0,90 / capFloor 10-40k / Erfahrungsrate x0,5-2 / Gym 3-20 min / Bot 0,8-2,0 und 1,5-5 Mrd/h / Gang-Geld x0,4-1,0 / kappaLow -0,55..0,5: -0,55 = die schwache Anfangsphase von BN2.2 live, kappa_eff ~1,7)`);
  const sc = scenarios(N);
  const res = rules.map(() => []);
  for (const s of sc) rules.forEach((rule, k) => { const r = runNode(init, rule, s.P, s.E, { maxH: 80 }); res[k].push({ exit: r.exit ?? 80, n: r.node.installs.length }); });
  console.log("Regel".padEnd(40), "Ausgang Median [P10..P90]".padEnd(30), "Differenz zu heute: Median [P10..P90]".padEnd(40), "schneller in", "Einbauten (Median)");
  rules.forEach((rule, k) => {
    const ex = res[k].map((x) => x.exit), df = res[k].map((x, i) => x.exit - res[0][i].exit);
    console.log(rule.name.padEnd(40), `${f1(med(ex), 2)} [${f1(qnt(ex, 0.1), 2)}..${f1(qnt(ex, 0.9), 2)}]`.padEnd(30),
      `${f1(med(df), 2)} h [${f1(qnt(df, 0.1), 2)}..${f1(qnt(df, 0.9), 2)}]`.padEnd(40), `${f1(df.filter((x) => x < -0.05).length / N * 100, 0)} %`.padEnd(12), med(res[k].map((x) => x.n)));
  });
  return { rules, res };
}

// ============================================================================
// 6. FRIST: wie spaet darf der Bau live gehen?
// ============================================================================
function sectionFrist(init, P, econ, N) {
  console.log("=== FRIST: Ausgang gegen den Zeitpunkt, ab dem die neue Regel gilt (davor gilt das Tor von heute) ===");
  const sc = scenarios(N, 777);
  const cands = [["Faktor >= 1,4 (frueh. 2,5 h)", (d) => RULES.F(1.4, 2.5, 12, d)], ["Faktor >= 1,4 (frueh. 2 h)", (d) => RULES.F(1.4, 2, 12, d)], ["Tor 3 h (Faktor >= 1,15)", (d) => RULES.T(3, d, 1.15)], ["Tor 6 h (Faktor >= 1,15)", (d) => RULES.T(6, d, 1.15)]];
  const deps = [init.tNode + 0.25, 5, 6, 7, 8, 9, 10, 11, 12.5];
  console.log("Regel / live ab".padEnd(34), deps.map((d) => (f1(d, 1) + "h " + clockOf(init, d).slice(-5)).padStart(13)).join(""), "  (Differenz zu heute in h; Median [Anzahl Szenarien schneller])");
  const baseEx = sc.map((s) => runNode(init, RULES.base(), s.P, s.E, { maxH: 80 }).exit);
  for (const [name, mk] of cands) {
    const cells = deps.map((d) => {
      const df = sc.map((s, i) => (runNode(init, mk(d), s.P, s.E, { maxH: 80 }).exit ?? 80) - baseEx[i]);
      return `${f1(med(df), 2)} [${df.filter((x) => x < -0.05).length}/${N}]`.padStart(13);
    });
    console.log(name.padEnd(34), cells.join(""));
  }
  console.log("Lesehilfe: Knotenstunde = Stunden seit dem Knotenstart 10:38; die erste Torzeit nach heutiger Regel ist Knotenstunde 12,1 (Uhr siehe oben).");
}

// ============================================================================
// 7. Aufruf
// ============================================================================
const isMain = process.argv[1] && process.argv[1].split("\\").join("/").endsWith("tools/audit/tor-frequenz.mjs");
if (isMain) {
  const which = args.abschnitt || "alle";
  const N = Number(args.n) || (args.schnell ? 6 : 12);
  if (which === "alle" || which === "eichung") {
    sectionEichung();
    console.log("=== EICHUNG C: Gesamtmodell (Rang-Gesetz + Skillverteilung + Erfahrung + Gym) gegen BN2.1 ===");
    console.log("-- Standardparameter (kappa " + PARAMS.kappa + ", kappaLow " + PARAMS.kappaLow + ", Schub " + PARAMS.boost + ", Deckel " + PARAMS.hmax + " x max(Rang, " + PARAMS.capFloor + "))");
    hindcast(PARAMS, true);
    hindcastFresh(PARAMS, true);
    const h = hindcast(PARAMS, false);
    const errs = []; for (const c of h) for (const r of c.rec) errs.push(Math.log(r.model / r.real));
    console.log(`   Streuung Zyklus 2+3: RMS ${f1(Math.sqrt(errs.reduce((s, x) => s + x * x, 0) / errs.length) * 100, 1)} % (ln), groesste Abweichung ${f1(Math.max(...errs.map(Math.abs)) * 100, 1)} %; Ausgang Zyklus 3 Modell ${f1(h[1].exitT, 2)} h gegen echt 3,55 h`);
    console.log("   ACHTUNG: kappa, Schub und Deckel sind an Zyklus 2+3 GEFITTET (drei Parameter, 17 Messpunkte) - das ist Anpassung, kein unabhaengiger Test.");
    console.log("   Unabhaengig: frische Fenster (oben, kappaLow) und die Sensitivitaeten im Abschnitt lauf. Gegen den Parameterbereich wird gerechnet, nicht gegen den Punktwert.\n");
  }
  if (which === "alle" || which === "kosten" || which === "lauf" || which === "frist") {
    const init = await liveInit(PARAMS);
    if (which === "alle" || which === "kosten") sectionKosten(init, PARAMS, ECON);
    if (which === "alle" || which === "lauf") sectionLauf(init, PARAMS, ECON, N);
    if (which === "alle" || which === "frist") sectionFrist(init, PARAMS, ECON, Math.max(4, Math.floor(N / 2)));
  }
}
