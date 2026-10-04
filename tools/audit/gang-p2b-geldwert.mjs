// P2b / Aufgabe B: Was ist ein Dollar am Tor wert?
//
// Frage: Das Einbau-Tor (bn4rep.js Block 1c) kauft EINE Runde mit dem Geld, das dann
// auf dem Konto liegt (lib/einbau.js waehleTorRunde). Wie viel Black-Op-Competence
// bringt ein zusaetzlicher Dollar dort, und wie viele Stunden bis zum Bladeburner-
// Ausgang sind das?
//
// Die Rundenwahl ist NICHT nachgebaut, sondern die echte Funktion des Bots wird
// importiert (src/lib/einbau.js, rein, nur gelesen). Eichung (Abschnitt 1):
//   - Preisformel gegen die gemessenen 70,2 Mrd der Runde vom 04.10. 07:04
//   - Rundenwahl gegen die 7 tatsaechlich gekauften Stuecke (Menge, Kosten)
//   - Rundenwahl gegen die Live-Telemetrie 08:19 (n, Kosten auf den Dollar, Zuwachs)
//   - Black-Op-Chancen gegen die Bot-Werte, Gang-Formeln gegen den Live-Spielstand
//
// Aufruf: node tools/audit/gang-p2b-geldwert.mjs [--abschnitt N] [--live [Sekunden]]
//   1 Eichung   2 Geld->Competence-Kurven   3 Rueckblick 07:04   4 Einkommen
//   5 Competence->Stunden   6 andere Geldsenken
// Nur lesen: backups/, reference/, src/ (importiert), Bruecke nur mit --live (getSaveFile).
import fs from "node:fs";
import zlib from "node:zlib";
import {
  loadBot, loadState, buildCandidates, planRound, makeRoundModel, beamRound, multsProduct, sequenceCost,
  AUGS, STEP, blackOps, boSuccess, skillMults, ROOT, mrd, pad, padR, backupPath,
} from "./gang-p2b-lib.mjs";
import { SNAP } from "./gang-p2b-snapshot.mjs";
import { forwardSim, freshNodeSaving, totalPoints, levelOf } from "./gang-p2b-stunden.mjs";
import { TASKS, respectGain, moneyGain, wantedGain } from "./gang-formulas.mjs";
import { exactGangOffer } from "./gang-augs.mjs";
import { graftTimeH, competence as gComp } from "./aug-graft.mjs";
import { loadSave } from "./aug-save.mjs";
import { loadAugs } from "./aug-data.mjs";
import { computeMults } from "./aug-mults.mjs";

const args = process.argv.slice(2);
const only = args.includes("--abschnitt") ? Number(args[args.indexOf("--abschnitt") + 1]) : null;
const liveIdx = args.indexOf("--live");
const liveSec = liveIdx >= 0 ? (Number(args[liveIdx + 1]) || 120) : 0;
const show = (n) => only === null || only === n;

// ---- Eingaben (alle mit Fundstelle) ----------------------------------------
const F = {
  c1End: "2026-10-03T19-01_pre-install", c2Start: "2026-10-03T19-17_hourly",
  h0617: "2026-10-04T06-17_hourly", pre0705: "2026-10-04T07-05_pre-install",
  h0717: "2026-10-04T07-17_hourly", h0817: "2026-10-04T08-17_hourly",
};
// Die fuenf Stuecke, die vor dem Kaufaufschub (04.10. 01:01) in der Warteschlange lagen
// (Spielstand 06:17 = Warteschlange vor der Torrunde).
const Q5 = ["Augmented Targeting II", "Hyperion Plasma Cannon V1", "BLADE-51b Tesla Armor",
  "BLADE-51b Tesla Armor: IPU Upgrade", "Combat Rib I"];
// Die sieben Stuecke der Torrunde 07:04 (Differenz der Warteschlangen 06:17 -> 07:05).
const BOUGHT7 = ["Bionic Arms", "Bionic Spine", "Augmented Targeting III", "DermaForce Particle Barrier",
  "HemoRecirculator", "INFRARET Enhancement", "LuminCloaking-V1 Skin Implant"];
// data/bn4rep.json -> torRunde.plan am 04.10. 08:19:11 lokal (06:19:11Z), geld aus demselben Satz.
const TELE0819 = { geld: 6376212743.595005, reaper: 56, evasive: 57, opName: "OperationK",
  n: 5, cost: 6017688000, gain: 1.697, first: "Graphene Bionic Arms Upgrade", candidates: 31 };
// data/einbau-uhr.json am 04.10. 08:24 (Spielzeit in ms): Einbau, Ende des Wiederaufbaus.
const EINBAU_UHR = { playtime: 3933032200, fertig: 3933518800 };
// Gang-Telemetrie 08:21:13 -> 08:24:57 (data/gang.json ts/playtime): Rate je SPIELsekunde.
const GANG_POLL = { dtPlaytime: 226.0, dtWall: 226.0, respectPerS: 4958, factionRepPerS: 232.7 };

// BN2-Multiplikatoren direkt aus der Spielquelle (BitNode.tsx case 2, BitNodeMultipliers.ts Vorgaben)
function parseBn2() {
  const src = ROOT + "/reference/bitburner-src/src/BitNode/";
  const bn = fs.readFileSync(src + "BitNode.tsx", "utf8");
  const m = bn.match(/case 2: \{\s*return new BitNodeMultipliers\(\{([\s\S]*?)\}\);/);
  const set = {};
  for (const z of m[1].matchAll(/(\w+):\s*([^,\n]+),/g)) set[z[1]] = Number(z[2]);
  const def = {};
  const d = fs.readFileSync(src + "BitNodeMultipliers.ts", "utf8");
  for (const z of d.matchAll(/^\s{2}(\w+) = (-?[\d.]+);/gm)) def[z[1]] = Number(z[2]);
  return { set, def };
}

const hr = (t) => "\n" + "=".repeat(100) + "\n" + t + "\n" + "=".repeat(100);
const bot = await loadBot();
const A = (st) => (st.p.moneySourceA.data || st.p.moneySourceA);
const B = (st) => (st.p.moneySourceB.data || st.p.moneySourceB);

const exactGangOffer2 = (sf2) => exactGangOffer(2, sf2, 1, "Slum Snakes");

// ---- Zustand des Tors ---------------------------------------------------------
function gateState(st, { queuedNames, otherRepZero = false, ssRep, opName, reaper, evasive, skills }) {
  const owned = new Set([...st.p.augmentations.map((a) => a.name), ...queuedNames]);
  const repOf = (f) => (f === "Slum Snakes" ? ssRep : (otherRepZero ? 0 : st.repOf(f)));
  const cands = buildCandidates({
    joined: st.p.factions, repOf, owned, queued: queuedNames.length, combatAugs: bot.COMBAT_AUGS, sfLevel2: st.sf[2],
  });
  return {
    cands, owned, skills: skills || st.p.skills, reaper: reaper ?? (st.bb.skills.Reaper || 0),
    evasive: evasive ?? (st.bb.skills["Evasive System"] || 0), opName,
    startMults: multsProduct(queuedNames, bot.COMBAT_AUGS), step: STEP,
  };
}
const planOf = (s, money) => planRound(bot, { ...s, money });
const beamOf = (s, money) => beamRound(makeRoundModel(bot, s.cands, s.owned, s), money, 40);
const sameSet = (a, b) => a.length === b.length && b.every((x) => a.includes(x));

// =========================================================================================
// 1. EICHUNG
// =========================================================================================
async function abschnitt1() {
  console.log(hr("1. EICHUNG (Soll = unabhaengig bekannter Wert, Ist = Rechner)"));
  const s0617 = loadState(F.h0617), s0705 = loadState(F.pre0705), s0817 = loadState(F.h0817);

  // 1a Preisformel
  const measured = Math.abs(A(s0705).augmentations) - Math.abs(A(s0617).augmentations);
  const bases = BOUGHT7.map((n) => AUGS[n].moneyCost);
  const model = sequenceCost(bases, 5);
  console.log(`1a Preisformel Grundpreis x 1,9^(q0+i), teuerste zuerst, q0 = 5 wartende Stuecke`);
  console.log(`   Soll (moneySourceA.augmentations 07:05 minus 06:17): ${mrd(measured, 4)} Mrd`);
  console.log(`   Ist  (Summe ueber die 7 Stuecke)                   : ${mrd(model, 4)} Mrd   Abweichung ${((model / measured - 1) * 100).toExponential(2)} %`);
  const first5 = Q5.map((n) => AUGS[n].moneyCost);
  const lo = sequenceCost(first5, 0);
  const hi = first5.sort((a, b) => a - b).reduce((s, b, i) => s + b * Math.pow(STEP, i), 0);
  console.log(`   erste fuenf Stuecke (Kaufreihenfolge unbekannt): gemessen ${mrd(Math.abs(A(s0617).augmentations), 4)} Mrd, `
    + `Modell teuerste zuerst ${mrd(lo, 2)} bis billigste zuerst ${mrd(hi, 2)} Mrd - liegt dazwischen: ${Math.abs(A(s0617).augmentations) >= lo && Math.abs(A(s0617).augmentations) <= hi}`);
  const { set: bn2set, def: bn2def } = parseBn2();
  console.log(`   BN2 AugmentationMoneyCost: ${bn2set.AugmentationMoneyCost ?? "nicht gesetzt -> Vorgabe " + bn2def.AugmentationMoneyCost}; `
    + `AugmentationRepCost: ${bn2set.AugmentationRepCost ?? "Vorgabe " + bn2def.AugmentationRepCost}; SF11-Stufe ${s0705.sf[11] || 0} -> Preisfaktor ${bot.gatePriceStep(s0705.sf[11] || 0)}`);

  // 1b Rundenwahl 07:04
  const q5 = Q5;
  const ssRepAt = (s) => s.repOf("Slum Snakes");
  const base1b = gateState(s0705, { queuedNames: q5, ssRep: ssRepAt(s0705) - 190 * 100, opName: "OperationArchangel",
    reaper: s0705.bb.skills.Reaper, evasive: s0705.bb.skills["Evasive System"] });
  console.log(`\n1b Rundenwahl 04.10. 07:04 (q0 = 5, Slum-Snakes-Ruf ${Math.round(ssRepAt(s0705) - 19000)}, Gewichte Archangel, Reaper ${base1b.reaper} Evasive ${base1b.evasive})`);
  const scan = [];
  for (let g = 40; g <= 90; g += 0.05) scan.push([g, planOf(base1b, g * 1e9)]);
  const hit = scan.filter(([, p]) => sameSet(p.seq, BOUGHT7)).map(([g]) => g);
  const m0 = (s0705.p.money + measured) / 1e9;
  console.log(`   Soll: gekauft wurden ${BOUGHT7.length} Stuecke: ${BOUGHT7.join(" | ")}`);
  console.log(`   Ist : dieselbe Menge, sobald das Geld am Tor in [${hit[0]?.toFixed(2)}, ${hit[hit.length - 1]?.toFixed(2)}] Mrd liegt `
    + `(darunter/darueber andere Menge); Geld 07:05 ${mrd(s0705.p.money)} + Ausgabe ${mrd(measured)} = ${m0.toFixed(2)} Mrd ist die OBERE Grenze fuer das Geld am Tor`);
  const p1b = planOf(base1b, m0 * 1e9 - 0.1e9);
  console.log(`   Plan bei ${(m0 - 0.1).toFixed(2)} Mrd: ${p1b.seq.length} Stuecke, Kosten ${mrd(p1b.cost, 4)} Mrd, Zuwachs x${p1b.gain.toFixed(4)}; Menge == Soll: ${sameSet(p1b.seq, BOUGHT7)}`);

  // 1c Rundenwahl 08:19 gegen Live-Telemetrie
  const base1c = gateState(s0817, { queuedNames: [], ssRep: s0817.repOf("Slum Snakes"), opName: TELE0819.opName,
    reaper: TELE0819.reaper, evasive: TELE0819.evasive });
  const p1c = planOf(base1c, TELE0819.geld);
  console.log(`\n1c Rundenwahl 04.10. 08:19:11 gegen data/bn4rep.json -> torRunde.plan (Geld ${mrd(TELE0819.geld, 4)} Mrd, q0 = 0)`);
  console.log(`   Soll: n ${TELE0819.n}  Kosten ${TELE0819.cost}  Zuwachs ${TELE0819.gain}  erstes ${TELE0819.first}  Kandidaten ${TELE0819.candidates}`);
  console.log(`   Ist : n ${p1c.seq.length}  Kosten ${p1c.cost}  Zuwachs ${p1c.gain.toFixed(4)}  erstes ${p1c.seq[0]}  Kandidaten ${p1c.candidates}`);
  console.log(`   -> Kosten ${p1c.cost === TELE0819.cost ? "auf den Dollar gleich" : "ABWEICHUNG"}, Zuwachs ${Math.abs(p1c.gain - TELE0819.gain) < 0.001 ? "gleich" : "ABWEICHUNG"}, `
    + `Menge ${p1c.seq.join(" | ")}`);

  // 1c' Zwei weitere Planzeilen aus data/bn4rep-log.txt (Soll = Bot-Log), Zustand dazwischen NICHT als Spielstand vorhanden:
  //      Stufen linear zwischen 07:17 und 08:17 interpoliert, Ruf/Reaper/Evasive als Spannen - gesucht wird, ob EIN plausibler Zustand die Zeile erzeugt.
  console.log(`
1c' Planzeilen im Bot-Log (Zustand interpoliert: das Soll ist die Kostenzahl, nicht die Stufen)`);
  {
    const sA = loadState(F.h0717), sB = loadState(F.h0817);
    const lerp = (a, b, x) => Math.round(a + (b - a) * x);
    const skAt = (x) => ({ ...sB.p.skills, strength: lerp(sA.p.skills.strength, sB.p.skills.strength, x), defense: lerp(sA.p.skills.defense, sB.p.skills.defense, x),
      dexterity: lerp(sA.p.skills.dexterity, sB.p.skills.dexterity, x), agility: lerp(sA.p.skills.agility, sB.p.skills.agility, x), hacking: lerp(sA.p.skills.hacking, sB.p.skills.hacking, x) });
    const trial = (st, x, rep, re, ev, op, lo, hi, accept) => {
      const owned = new Set(st.p.augmentations.map((a) => a.name));
      const cands = buildCandidates({ joined: st.p.factions, repOf: (fa) => (fa === "Slum Snakes" ? rep : st.repOf(fa)), owned, queued: 0, combatAugs: bot.COMBAT_AUGS, sfLevel2: st.sf[2] });
      for (let M = lo; M <= hi; M += 0.01e9) {
        const p = planRound(bot, { cands, owned, skills: skAt(x), reaper: re, evasive: ev, opName: op, startMults: {}, money: M, step: STEP });
        if (accept(p)) return { M, p };
      }
      return null;
    };
    const r1 = trial(sA, 0.3, 300e3, 40, 42, "OperationArchangel", 0.5e9, 1.5e9, (p) => Math.abs(p.cost - 625.8e6) < 2e4);
    console.log(`   07:35  Soll: "3 Stuecke fuer $625.80m, Competence x1.20 (Archangel)"   Ist: ${r1 ? r1.p.seq.length + " Stuecke, Kosten " + (r1.p.cost / 1e6).toFixed(2) + "m (" + r1.p.seq.join(" | ") + "), Zuwachs x" + r1.p.gain.toFixed(3) : "KEIN Treffer"}`);
    const r2 = trial(sB, 0.8, 600e3, 50, 52, "OperationRedDragon", 3.5e9, 7e9, (p) => p.seq.length === 6 && p.cost > 3.995e9 && p.cost < 4.025e9);
    console.log(`   08:05  Soll: "6 Stuecke fuer $4.02b, Competence x1.35 (Red Dragon)"      Ist: ${r2 ? r2.p.seq.length + " Stuecke, Kosten " + (r2.p.cost / 1e6).toFixed(2) + "m (" + r2.p.seq.join(" | ") + "), Zuwachs x" + r2.p.gain.toFixed(3) : "KEIN Treffer"}`);
  }

  // 1d Black-Op-Chancen gegen die Bot-Telemetrie (blade.json boChancen, 08:24:25)
  console.log(`\n1d Black-Op-Chance (Action.ts:169-196, Black Op: Bevoelkerung/Chaos = 1) gegen blade.json boChancen 08:24:25`);
  const stSnap = { skills: SNAP.skills, m: skillMults(SNAP.bb.skills), stamina: SNAP.bb.maxStamina, maxStamina: SNAP.bb.maxStamina,
    bbSucc: SNAP.mults.bladeburner_success_chance, teamCount: 0 };
  let maxDev = 0;
  for (const [name, soll] of Object.entries(SNAP.sollBotBoChancen)) {
    const op = blackOps.find((o) => o.name === name);
    const ist = boSuccess(op, 1, stSnap).p;
    maxDev = Math.max(maxDev, Math.abs(ist - soll));
    console.log(`   ${padR(name, 30)} Soll ${soll.toFixed(4)}  Ist ${ist.toFixed(4)}`);
  }
  console.log(`   groesste Abweichung ${maxDev.toExponential(2)} (Bot-Telemetrie ist auf 3-4 Stellen gerundet). Hinweis: Soll ist die Bot-Nachrechnung`
    + ` blackOpChance(), kein Spielwert - die Formel selbst steht in Action.ts:169-196.`);

  // 1e Stufen aus exp, Skillpunkte
  console.log(`\n1e Stufe = floor(mult x (32 ln(exp + 534,6) - 200)) (skill.ts), BN2: Hacking x0,8; Skillpunkte = floor((maxRank-3)/3+1) (Bladeburner.ts:1285-1292)`);
  for (const sk of ["strength", "defense", "dexterity", "agility", "hacking"]) {
    const ist = levelOf(SNAP.exp[sk], SNAP.mults[sk], sk === "hacking" ? 0.8 : 1);
    console.log(`   ${padR(sk, 10)} Soll ${pad(SNAP.skills[sk], 5)}  Ist ${pad(ist, 5)}  ${ist === SNAP.skills[sk] ? "OK" : "ABWEICHUNG"}`);
  }
  console.log(`   Skillpunkte gesamt Soll ${SNAP.bb.totalSkillPoints}  Ist ${totalPoints(SNAP.bb.maxRank)}`);

  // 1f Gang-Formeln gegen den Live-Stand
  const G = { respect: SNAP.gang.respect, wantedLevel: SNAP.gang.wanted, territory: SNAP.gang.territory };
  let r = 0, w = 0;
  for (const m of SNAP.gang.members) { r += respectGain(G, m, TASKS[m.task]); w += wantedGain(G, m, TASKS[m.task]); }
  const favMult = 1 + SNAP.slumSnakes.favor / 100;
  const repPerS = r * 5 * SNAP.mults.faction_rep * favMult / 75;
  console.log(`\n1f Gang-Formeln (gang-formulas.mjs, 86.360-fach gegen den Quelltext) gegen den Live-Stand 08:24:25`);
  console.log(`   Respekt je Zyklus  Soll ${SNAP.gang.respectGainRate.toFixed(3)}  Ist ${r.toFixed(3)}  Verhaeltnis ${(r / SNAP.gang.respectGainRate).toFixed(6)}`);
  console.log(`   Wanted je Zyklus   Soll ${SNAP.gang.wantedGainRate.toFixed(4)}  Ist ${w.toFixed(4)}`);
  {
    const { set: bset, def: bdef } = parseBn2();
    console.log(`   BN2: GangSoftcap ${bset.GangSoftcap ?? "nicht gesetzt -> Vorgabe " + bdef.GangSoftcap} (die Formeln rechnen mit 1 und treffen den Live-Wert); FactionWorkRepGain ${bset.FactionWorkRepGain} (nur Arbeitsruf, nicht der Gang-Ruf)`);
  }
  console.log(`   Faktionsruf je Spielsekunde: Soll (gemessen 08:21->08:24, ${GANG_POLL.dtPlaytime} s Spielzeit = ${GANG_POLL.dtWall} s Wanduhr) ${GANG_POLL.factionRepPerS}`
    + `  Ist (5 x Respekt x faction_rep ${SNAP.mults.faction_rep.toFixed(3)} x (1+Favor ${SNAP.slumSnakes.favor}/100) / 75) ${repPerS.toFixed(1)}`);
  console.log(`   Respekt je Spielsekunde: Soll ${GANG_POLL.respectPerS}  Ist ${(r * 5).toFixed(0)}`
    + `  -> Spielzeit = Wanduhr (kein Nachholen im Gang: storedCycles klein), die Rate ist keine Bestandsentleerung`);

  // 1g Tabellen des Bots gegen die Spielquelle
  const srcTxt = fs.readFileSync(`${ROOT}/src/blade.js`, "utf8");
  const i0 = srcTxt.indexOf("const BLACKOP_DATEN = {");
  let depth = 0, i1 = -1;
  for (let i = srcTxt.indexOf("{", i0); i < srcTxt.length; i++) {
    if (srcTxt[i] === "{") depth++;
    else if (srcTxt[i] === "}") { depth--; if (depth === 0) { i1 = i; break; } }
  }
  const botTable = new Function("return (" + srcTxt.slice(srcTxt.indexOf("{", i0), i1 + 1) + ");")();
  let diffs = 0;
  for (const op of blackOps) {
    const b = botTable[op.name];
    if (!b) { diffs++; console.log("   fehlt im Bot:", op.name); continue; }
    if (b.baseDifficulty !== op.baseDifficulty || !!b.isKill !== !!op.isKill || !!b.isStealth !== !!op.isStealth) { diffs++; console.log("   Abweichung Grunddaten", op.name); }
    for (const st of ["hacking", "strength", "defense", "dexterity", "agility", "intelligence"]) {
      if ((b.weights[st] || 0) !== (op.weights[st] || 0)) { diffs++; console.log("   Abweichung Gewicht", op.name, st, b.weights[st], op.weights[st]); }
      if ((op.weights[st] || 0) > 0 && b.decays[st] !== op.decays[st]) { diffs++; console.log("   Abweichung Abklingen", op.name, st); }
    }
  }
  const jt = bot.blackopsTable.ops;
  let jdiff = 0;
  for (const o of jt) {
    const key = blackOps.find((x) => x.name.replace(/[^A-Za-z0-9]/g, "").toLowerCase() === o.name.toLowerCase());
    if (!key) { jdiff++; continue; }
    for (const st of Object.keys(o.weights)) if ((o.weights[st] || 0) !== (key.weights[st] || 0)) jdiff++;
  }
  console.log(`\n1g Bot-Tabellen gegen Spielquelle 3.0.2: BLACKOP_DATEN (blade.js) ${diffs} Abweichungen; lib/blackops.json (Gewichte) ${jdiff} Abweichungen`);
  let cdiff = 0;
  for (const [n, m] of Object.entries(bot.COMBAT_AUGS)) {
    const a = AUGS[n]; if (!a || n.startsWith("Stanek")) continue;
    for (const k of ["hacking", "strength", "defense", "dexterity", "agility", "bladeburner_success_chance"]) if (Math.abs((m[k] ?? 1) - (a.mults[k] ?? 1)) > 1e-9) cdiff++;
  }
  console.log(`   COMBAT_AUGS (hackaugs.js) gegen Augmentations.ts: ${cdiff} Abweichungen bei Hacking/Kampf/Erfolgschance (Stanek ausgenommen)`);
}

// =========================================================================================
// 2. GELD -> COMPETENCE
// =========================================================================================
const MULTS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 100];
function curveRows(s, bases, label) {
  console.log(`\n${label}`);
  console.log(`${padR("Geld am Tor", 20)}${pad("Mrd", 10)}${pad("Stuecke", 9)}${pad("Kosten Mrd", 12)}${pad("Zuwachs", 10)}${pad("ln-Zuwachs", 12)}${pad("Strahl-Zuwachs", 16)}  letztes Stueck`);
  const out = [];
  for (const [lab, M] of bases) {
    const p = planOf(s, M);
    const bm = p.seq.length ? beamOf(s, M) : { gain: 1 };
    out.push({ lab, M, p, bm });
    console.log(`${padR(lab, 20)}${pad(mrd(M, 1), 10)}${pad(p.seq.length, 9)}${pad(mrd(p.cost, 2), 12)}${pad("x" + p.gain.toFixed(3), 10)}${pad(Math.log(p.gain).toFixed(3), 12)}${pad("x" + bm.gain.toFixed(3), 16)}  ${p.seq[p.seq.length - 1] || "-"}`);
  }
  return out;
}

async function abschnitt2() {
  console.log(hr("2. GELD AM TOR -> COMPETENCE-ZUWACHS DER RUNDE (echte Rundenwahl des Bots, Zuwachs = Verhaeltnis der Daedalus-aehnlichen Black-Op-Competence)"));
  const s0705 = loadState(F.pre0705), s1901 = loadState(F.c1End), s0817 = loadState(F.h0817);
  const M0 = (s0705.p.money + (Math.abs(A(s0705).augmentations) - Math.abs(A(loadState(F.h0617)).augmentations))) - 0.1e9;
  const sA = gateState(s0705, { queuedNames: Q5, ssRep: s0705.repOf("Slum Snakes") - 19000, opName: "OperationArchangel",
    reaper: s0705.bb.skills.Reaper, evasive: s0705.bb.skills["Evasive System"] });
  console.log(`Basis "heutiger Stand" = Geld am Tor 04.10. 07:04 = ${mrd(M0, 1)} Mrd (obere Grenze aus Konto + Ausgabe, siehe 1b).`);
  const rowsA = curveRows(sA, MULTS.map((m) => ["x" + m, M0 * m]),
    "2A  Zustand 07:04 WIE ER WAR: 5 Vorkaeufe in der Warteschlange (Preisfaktor 1,9^5 = 24,76), Slum-Snakes-Ruf ~0,49 Mio, naechste Black Op Archangel");
  console.log(`    Tatsaechlich gekauft: x1 -> 7 Stuecke, 70,20 Mrd, Zuwachs ${rowsA.find((r) => r.lab === "x1").p.gain.toFixed(3)}.`);

  // 2B: dieselben Stuecke, aber OHNE die fuenf Vorkaeufe (Kaufaufschub von Anfang an); Geld = 74,4 + 18,1
  const vor = Math.abs(A(loadState(F.h0617)).augmentations);
  const sB = gateState(s0705, { queuedNames: [], ssRep: s0705.repOf("Slum Snakes") - 19000, opName: "OperationArchangel",
    reaper: s0705.bb.skills.Reaper, evasive: s0705.bb.skills["Evasive System"] });
  const rowsB = curveRows(sB, [["x1 + 18,1 (ohne Vorkauf)", M0 + vor], ...MULTS.filter((m) => m !== 1).map((m) => ["x" + m + " + 18,1", M0 * m + vor])],
    "2B  Derselbe Zeitpunkt OHNE die fuenf Vorkaeufe (q0 = 0, Geld = Konto + die 18,09 Mrd, die sie gekostet haben). Zuwachs gegenueber 'nichts gekauft'");
  const all12 = multsProduct([...Q5, ...BOUGHT7], bot.COMBAT_AUGS);
  const pA1 = rowsA.find((r) => r.lab === "x1").p;
  // Zuwachs der echten zwoelf Stuecke gegenueber "nichts" (gleiche Gewichte und Stufen wie 2B)
  const modelB = makeRoundModel(bot, sB.cands, sB.owned, sB);
  const compAll = (() => {
    const eff = bot.bladeEffFactors(sB.reaper, sB.evasive);
    const lv = bot.effectiveLevels(sB.skills, eff);
    const bo = bot.blackOpWeights(bot.blackopsTable, "OperationArchangel");
    let c = 0;
    for (const st of Object.keys(bo.weights)) { const w = bo.weights[st]; if (w > 0) c += w * Math.pow((lv[st] || 0) * (all12[st] || 1), bo.decays[st]); }
    return (c * (all12.bladeburner_success_chance || 1)) / modelB.base;
  })();
  const clean = rowsB.find((r) => r.lab.startsWith("x1 +")).p;
  console.log(`    Die zwoelf tatsaechlichen Stuecke (5 Vorkaeufe + 7 Runde) zusammen: x${compAll.toFixed(3)} fuer 88,29 Mrd.`
    + ` Ohne Vorkaeufe haette dasselbe Geld (${mrd(M0 + vor, 1)} Mrd) x${clean.gain.toFixed(3)} gebracht (${clean.seq.length} Stuecke).`);

  // 2E: Preisfaktor 1,9^q - dasselbe Gesamtgeld, aber q0 Stuecke vorher gekauft (Praefixe der fuenf tatsaechlichen Vorkaeufe, teuerste zuerst)
  console.log(`
2E  Preisstufe: Gesamtgeld ${mrd(M0 + vor, 1)} Mrd (Konto + Vorkaeufe), davon q0 der fuenf Vorkaeufe VOR dem Tor gekauft (in der billigsten Reihenfolge, teuerste zuerst: alle fuenf haetten so 9,93 statt der tatsaechlichen 18,09 Mrd gekostet), Rest am Tor; Zuwachs = alle Stuecke zusammen gegen nichts`);
  console.log(`    ${pad("q0", 3)}${pad("Vorkauf Mrd", 13)}${pad("Rest am Tor", 13)}${pad("Stuecke am Tor", 16)}${pad("Gesamtzuwachs", 15)}`);
  const q5sorted = [...Q5].sort((a, b) => AUGS[b].moneyCost - AUGS[a].moneyCost);
  for (let q0 = 0; q0 <= 5; q0++) {
    const pre = q5sorted.slice(0, q0);
    const preCost = sequenceCost(pre.map((n) => AUGS[n].moneyCost), 0);
    const sq = gateState(s0705, { queuedNames: pre, ssRep: s0705.repOf("Slum Snakes") - 19000, opName: "OperationArchangel",
      reaper: s0705.bb.skills.Reaper, evasive: s0705.bb.skills["Evasive System"] });
    const left = M0 + vor - preCost;
    const p = planOf(sq, left);
    const all = multsProduct([...pre, ...p.seq], bot.COMBAT_AUGS);
    const eff = bot.bladeEffFactors(sq.reaper, sq.evasive), lv = bot.effectiveLevels(sq.skills, eff);
    const bo = bot.blackOpWeights(bot.blackopsTable, "OperationArchangel");
    const comp = (ex) => { let c = 0; for (const st of Object.keys(bo.weights)) { const w = bo.weights[st]; if (w > 0) c += w * Math.pow((lv[st] || 0) * (ex[st] || 1), bo.decays[st]); } return c * (ex.bladeburner_success_chance || 1); };
    console.log(`    ${pad(q0, 3)}${pad(mrd(preCost, 2), 13)}${pad(mrd(left, 1), 13)}${pad(p.seq.length, 16)}${pad("x" + (comp(all) / comp({})).toFixed(3), 15)}`);
  }

  // 2C: frischer Knoten, Tor 1 (Analogon: Stand BN2.1 am Ende von Zyklus 1, 03.10. 19:01, vor der Gang)
  console.log(`\n2C  FRISCHER KNOTEN (BN2.2/2.3), erstes Tor ~13 h nach Knotenstart: Stand als Analogon = BN2.1 19:01 am 03.10.`
    + ` (Kampfwerte 213/205/205/205, Hacking 383, Reaper ${s1901.bb.skills.Reaper}, Evasive ${s1901.bb.skills["Evasive System"]}), keine Augs installiert, q0 = 0,`
    + ` nur die Gang-Faktion hat Ruf (andere Faktionen 0 - vorsichtig), Gewichte Operation Typhoon.`);
  const repGrid = [1e5, 2.5e5, 5e5, 7.5e5, 1.25e6, 2.5e6, 5e6];
  const mGrid = [5, 10, 20, 40, 75, 150, 300, 600, 1200];
  const fresh = (rep) => {
    const owned = new Set();
    const cands = buildCandidates({ joined: s1901.p.factions.concat(s1901.p.factions.includes("Slum Snakes") ? [] : ["Slum Snakes"]),
      repOf: (f) => (f === "Slum Snakes" ? rep : 0), owned, queued: 0, combatAugs: bot.COMBAT_AUGS, sfLevel2: s1901.sf[2] });
    return { cands, owned, skills: s1901.p.skills, reaper: s1901.bb.skills.Reaper, evasive: s1901.bb.skills["Evasive System"],
      opName: "OperationTyphoon", startMults: {}, step: STEP };
  };
  console.log(`    Zuwachs x (Stuecke) je Geld [Mrd] und Slum-Snakes-Ruf:`);
  console.log(`    ${padR("Ruf \\ Geld", 12)}${mGrid.map((m) => pad(m, 14)).join("")}`);
  for (const rep of repGrid) {
    const s = fresh(rep);
    console.log(`    ${padR((rep / 1e6).toFixed(2) + " Mio", 12)}${mGrid.map((m) => { const p = planOf(s, m * 1e9); return pad("x" + p.gain.toFixed(2) + " (" + p.seq.length + ")", 14); }).join("")}`);
  }
  // Grenzwert: kein Geld- und kein Ruflimit
  const sInf = fresh(1e9);
  const pInf = planOf(sInf, 1e18);
  console.log(`    Sättigung (unbegrenztes Geld, Ruf 1e9): x${pInf.gain.toFixed(2)} mit ${pInf.seq.length} Stuecken, Kosten ${(pInf.cost / 1e9).toExponential(2)} Mrd.`);
  // Grenzertrag je Mrd
  console.log(`\n    Grenzertrag bei Ruf 3 Mio: d ln(Zuwachs) je zusaetzlicher Mrd`);
  const s3 = fresh(3e6);
  let prev = null;
  for (const m of [5, 10, 20, 40, 75, 150, 300, 600, 1200, 2400]) {
    const p = planOf(s3, m * 1e9);
    const l = Math.log(p.gain);
    console.log(`      ${pad(m, 5)} Mrd: ln = ${l.toFixed(3)}${prev ? `   Grenzertrag ${((l - prev.l) / (m - prev.m) * 1000).toFixed(2)} je 1000 Mrd-Stufe -> ${((l - prev.l) / (m - prev.m)).toFixed(4)} ln je Mrd` : ""}`);
    prev = { m, l };
  }

  // 2F: Rufbedarf der Kampfstuecke im Gang-Angebot (Augmentations.ts repCost, BN2: AugmentationRepCost 1)
  console.log(`
2F  Rufbedarf der wichtigsten Gang-Stuecke (Grundpreis in Mrd, vor dem Faktor 1,9^i):`);
  const gangNames = new Set(exactGangOffer2(s1901.sf[2] || 0));
  const lst = Object.keys(bot.COMBAT_AUGS).map((n) => ({ n, a: AUGS[n], m: bot.COMBAT_AUGS[n] })).filter((r) => r.a && gangNames.has(r.n) && !r.a.isSpecial);
  const stat4 = (m) => ["strength", "defense", "dexterity", "agility"].map((k) => m[k] || 1);
  const big = lst.filter((r) => Math.max(...stat4(r.m)) >= 1.3 || (r.m.bladeburner_success_chance || 1) >= 1.08).sort((x, y) => x.a.repCost - y.a.repCost);
  // kleinstes Geld am Tor, ab dem die Rundenwahl (Ruf 3 Mio, q0 = 0, Analogon 19:01) das Stueck kauft
  const firstM = new Map();
  {
    const owned3 = new Set();
    const c3 = buildCandidates({ joined: s1901.p.factions.concat(s1901.p.factions.includes("Slum Snakes") ? [] : ["Slum Snakes"]), repOf: (fa) => (fa === "Slum Snakes" ? 3e6 : 0),
      owned: owned3, queued: 0, combatAugs: bot.COMBAT_AUGS, sfLevel2: s1901.sf[2] });
    for (let M = 1e9; M < 2e13; M *= 1.04) {
      const p = planOf({ cands: c3, owned: owned3, skills: s1901.p.skills, reaper: s1901.bb.skills.Reaper, evasive: s1901.bb.skills["Evasive System"], opName: "OperationTyphoon", startMults: {}, step: STEP }, M);
      for (const n of p.seq) if (!firstM.has(n)) firstM.set(n, M);
    }
  }
  console.log(`    ${pad("Ruf", 9)}  ${pad("Grund Mrd", 8)}  ${padR("Stueck", 44)} ${padR("Wirkung", 36)}${pad("gekauft ab Geld", 18)}`);
  for (const r of big) {
    const fm = firstM.get(r.n);
    console.log(`    ${pad(r.a.repCost, 9)}  ${pad(mrd(r.a.moneyCost, 3), 8)}  ${padR(r.n, 44)} ${padR(stat4(r.m).map((x) => x.toFixed(2)).join("/") + (r.m.hacking ? " h" + r.m.hacking : "") + (r.m.bladeburner_success_chance ? " c" + r.m.bladeburner_success_chance : ""), 36)}${pad(fm ? mrd(fm, 0) + " Mrd" : "> 20000 Mrd", 18)}`);
  }
  console.log(`    Hoechster Rufbedarf aller ${lst.length} Kampf-/Chance-Stuecke ohne The Red Pill: ${Math.max(...lst.map((r) => r.a.repCost))} (Graphene Bionic Spine Upgrade); siehe Spalte 'gekauft ab Geld' (unter diesem Geld ist ein Ruf ueber seinem Bedarf wertlos).`);

  // 2G: Empfindlichkeit des Zuwachses gegen die Kampfwerte am Tor
  console.log(`
2G  Empfindlichkeit (frischer Knoten, Ruf 3 Mio): Zuwachs bei Geld 10 / 36 / 75 / 150 Mrd, wenn die Stufen am Tor anders sind als im Analogon 19:01`);
  {
    const owned2 = new Set();
    const c2 = buildCandidates({ joined: s1901.p.factions.concat(s1901.p.factions.includes("Slum Snakes") ? [] : ["Slum Snakes"]), repOf: (fa) => (fa === "Slum Snakes" ? 3e6 : 0),
      owned: owned2, queued: 0, combatAugs: bot.COMBAT_AUGS, sfLevel2: s1901.sf[2] });
    const b = s1901.p.skills;
    for (const [lab, fc, hk, re, ev] of [["Kampfwerte x0,5", 0.5, 1, 7, 6], ["Analogon 19:01", 1, 1, 7, 6], ["Kampfwerte x2", 2, 1, 7, 6], ["Kampfwerte x4", 4, 1, 7, 6], ["Reaper/Evasive 30/30", 1, 1, 30, 30], ["Hacking x0,5", 1, 0.5, 7, 6], ["Hacking x2", 1, 2, 7, 6]]) {
      const sk = { ...b, strength: Math.round(b.strength * fc), defense: Math.round(b.defense * fc), dexterity: Math.round(b.dexterity * fc), agility: Math.round(b.agility * fc), hacking: Math.round(b.hacking * hk) };
      const cells = [10, 36, 75, 150].map((m) => "x" + planOf({ cands: c2, owned: owned2, skills: sk, reaper: re, evasive: ev, opName: "OperationTyphoon", startMults: {}, step: STEP }, m * 1e9).gain.toFixed(2));
      console.log(`    ${padR(lab, 24)}${cells.map((c) => pad(c, 9)).join("")}`);
    }
  }

  // 2D: BN2.1 jetzt (Live-Stand), Tor-2-Proxy
  console.log(`\n2D  BN2.1 JETZT (Live 08:24, q0 = 0, Ruf ${Math.round(SNAP.slumSnakes.rep)} -> bis Tor 2 ~8 Mio, Gewichte Operation Deckard): Zuwachs der Runde je Geld`);
  const ownedNow = new Set(s0817.p.augmentations.map((a) => a.name));
  const candsNow = buildCandidates({ joined: s0817.p.factions, repOf: (f) => (f === "Slum Snakes" ? 8e6 : s0817.repOf(f)), owned: ownedNow, queued: 0,
    combatAugs: bot.COMBAT_AUGS, sfLevel2: s0817.sf[2] });
  const sNow = { cands: candsNow, owned: ownedNow, skills: SNAP.skills, reaper: SNAP.bb.skills.Reaper, evasive: SNAP.bb.skills["Evasive System"],
    opName: "OperationDeckard", startMults: {}, step: STEP };
  curveRows(sNow, [5, 10, 25, 50, 75, 150, 400, 1000].map((m) => [m + " Mrd", m * 1e9]), "    (Tor-2-Proxy; Ausgang kommt vorher, siehe 5A)");
}

// =========================================================================================
// 3. RUECKBLICK 07:04
// =========================================================================================
async function abschnitt3() {
  console.log(hr("3. RUECKBLICK: DIE RUNDE VOM 04.10. 07:04"));
  const s0617 = loadState(F.h0617), s0705 = loadState(F.pre0705), s0717 = loadState(F.h0717);
  const spent = Math.abs(A(s0705).augmentations) - Math.abs(A(s0617).augmentations);
  console.log(`Geld nach der Runde (Konto 07:05): ${mrd(s0705.p.money)} Mrd; Ausgabe der Runde ${mrd(spent, 3)} Mrd; Geld am Tor <= ${mrd(s0705.p.money + spent)} Mrd.`);
  console.log(`Warteschlange vorher: ${Q5.length} Stuecke (18,09 Mrd, vor dem Kaufaufschub 04.10. 01:01 gekauft), danach 12.`);
  const e7 = multsProduct(BOUGHT7, bot.COMBAT_AUGS), e5 = multsProduct(Q5, bot.COMBAT_AUGS);
  const f = (e) => ["strength", "defense", "dexterity", "agility", "bladeburner_success_chance"].map((k) => `${k.slice(0, 4)} x${(e[k] || 1).toFixed(3)}`).join(", ");
  console.log(`Mults der 7 Rundenstuecke: ${f(e7)}`);
  console.log(`Mults der 5 Vorkaeufe    : ${f(e5)}`);
  // Eichung der Mults: Faktor 07:17/07:05 = Produkt der 12 Stuecke x 1,01000262^(neue NFG-Stufen)
  const nfgLv = (s) => ((s.p.augmentations.find((a) => a.name === "NeuroFlux Governor") || {}).level || 0);
  const dNfg = nfgLv(s0717) - nfgLv(s0705);
  console.log(`Eichung der Mults gegen den Einbau 07:05 -> 07:17 (NFG-Stufe ${nfgLv(s0705)} -> ${nfgLv(s0717)}, also +${dNfg} Stufen mit je x1,01000262):`);
  for (const k of ["strength", "defense", "dexterity", "agility", "bladeburner_success_chance"]) {
    const soll = s0717.p.mults[k] / s0705.p.mults[k];
    const stueck = (e7[k] || 1) * (e5[k] || 1);
    const nfg = k === "bladeburner_success_chance" ? 1 : Math.pow(1.01000262, dNfg);
    console.log(`   ${padR(k, 28)} Soll (gemessen) ${soll.toFixed(5)}   Ist (12 Stuecke x NFG) ${(stueck * nfg).toFixed(5)}   Abweichung ${((stueck * nfg / soll - 1) * 100).toExponential(2)} %`);
  }

  console.log(`   Der Einbau fuegt die NFG-Stufen hinzu, die der Bot mit dem Restgeld kauft (Preis x1,14 je Stufe); die Stuecke selbst sind exakt das Produkt der Tabellenwerte.`);
  console.log(`\nWas haetten mehr Geld bzw. kein Vorkauf gebracht - Abschnitt 2A/2B. Menge je Geld im Zustand 07:04 (q0 = 5):`);
  await abschnitt2Kurz();
}
async function abschnitt2Kurz() {
  const s0617 = loadState(F.h0617), s0705 = loadState(F.pre0705);
  const spent = Math.abs(A(s0705).augmentations) - Math.abs(A(s0617).augmentations);
  const M0 = s0705.p.money + spent - 0.1e9;
  const sA = gateState(s0705, { queuedNames: Q5, ssRep: s0705.repOf("Slum Snakes") - 19000, opName: "OperationArchangel",
    reaper: s0705.bb.skills.Reaper, evasive: s0705.bb.skills["Evasive System"] });
  console.log(`${padR("Geld am Tor (q0=5)", 22)}${pad("Mrd", 10)}${pad("Stuecke", 9)}${pad("Kosten Mrd", 12)}${pad("Zuwachs", 10)}   Menge`);
  for (const m of [1, 2, 5, 10, 100]) {
    const p = planOf(sA, M0 * m);
    console.log(`${padR("x" + m, 22)}${pad(mrd(M0 * m, 1), 10)}${pad(p.seq.length, 9)}${pad(mrd(p.cost, 2), 12)}${pad("x" + p.gain.toFixed(3), 10)}   ${p.seq.join(", ")}`);
  }
}

// =========================================================================================
// 4. EINKOMMEN OHNE GANG (Spielzeit!)
// =========================================================================================
async function liveSave() {
  const res = await (await fetch("http://localhost:8795/api/rpc?" + new URLSearchParams({ method: "getSaveFile", instance: "LIVE" }))).json();
  const raw = Buffer.from(res.result.save, "latin1");
  const save = JSON.parse(zlib.gunzipSync(raw).toString("utf8"));
  const p = JSON.parse(save.data.PlayerSave).data;
  return { p, t: Date.now() };
}
const SRC_KEYS = ["hacking", "hacknet", "bladeburner", "sleeves", "codingcontract", "crime", "gang", "servers", "hospitalization", "augmentations", "other"];
async function abschnitt4() {
  console.log(hr("4. EINKOMMEN DES SPIELERS OHNE GANG (Spielzeit = playtimeSinceLastBitnode, nicht Wanduhr)"));
  const files = fs.readdirSync(`${ROOT}/backups`).filter((f) => f.includes("BN2L1") && f >= "LIVE_197f4d61481686_BN2L1_2026-10-03T19-17").sort();
  const rows = files.map((f) => { const st = loadState(f); return { f: f.slice(28, 48), t: st.p.playtimeSinceLastBitnode / 3.6e6, B: B(st), money: st.p.money }; });
  console.log("Rate je SPIELstunde zwischen zwei Spielstaenden (Quelle moneySourceB, kumuliert seit Knotenstart), Mrd/h:");
  console.log(`${padR("Fenster", 24)}${pad("dt h", 7)}${pad("hacking", 9)}${pad("hacknet", 9)}${pad("bladeb.", 9)}${pad("sleeves", 9)}${pad("codcon.", 9)}${pad("servers", 9)}${pad("hospital", 9)}${pad("Summe+", 9)}`);
  const line = (a, b, label) => {
    const dt = b.t - a.t;
    const r = (k) => (b.B[k] - a.B[k]) / dt / 1e9;
    const plus = ["hacking", "hacknet", "bladeburner", "sleeves", "codingcontract", "crime"].reduce((s, k) => s + Math.max(0, r(k)), 0);
    console.log(`${padR(label, 24)}${pad(dt.toFixed(2), 7)}${pad(r("hacking").toFixed(2), 9)}${pad(r("hacknet").toFixed(2), 9)}${pad(r("bladeburner").toFixed(2), 9)}${pad(r("sleeves").toFixed(2), 9)}${pad(r("codingcontract").toFixed(2), 9)}${pad(r("servers").toFixed(2), 9)}${pad(r("hospitalization").toFixed(2), 9)}${pad(plus.toFixed(2), 9)}`);
  };
  for (let i = 1; i < rows.length; i++) line(rows[i - 1], rows[i], rows[i - 1].f.slice(3, 14) + " -> " + rows[i].f.slice(9, 14));
  const iStart = rows.findIndex((r) => r.f.includes("19-17")), iEnd = rows.findIndex((r) => r.f.includes("06-17"));
  const iPre = rows.findIndex((r) => r.f.includes("07-05")), i0717 = rows.findIndex((r) => r.f.includes("07-17"));
  line(rows[iStart], rows[iEnd], "Zyklus 2 (19:17-06:17)");
  line(rows[iEnd], rows[iPre], "letzte 48 min vor Einbau");
  line(rows[i0717], rows[rows.length - 1], "Zyklus 3 bisher");
  const dt2 = rows[iEnd].t - rows[iStart].t;
  const hack2 = (rows[iEnd].B.hacking - rows[iStart].B.hacking) / dt2 / 3600;
  const hackEnd = (rows[iPre].B.hacking - rows[iEnd].B.hacking) / ((rows[iPre].t - rows[iEnd].t) * 3600);
  console.log(`\nMittel Zyklus 2: Hacking ${(hack2 / 1e6).toFixed(2)} M$/s je Spielsekunde; letzte 48 min vor dem Einbau ${(hackEnd / 1e6).toFixed(2)} M$/s.`);
  console.log(`Rate gegen Bestand: die Hacking-Rate WAECHST von Stunde zu Stunde (3,9 -> 15 Mrd/h) statt hoch zu starten und abzufallen - sie speist sich aus dem Fluss`
    + ` (Flotte, Hacking-Stufe), nicht aus einem Lager; der Einbau setzt sie zurueck (Park-Verlust). Der Mittelwert eines Zyklus ist also NICHT die Rate am Tor.`);
  console.log(`Geld am Tor = Einnahmen des Zyklus minus Ausgaben: Konto 19:17 ${mrd(rows[iStart].money)} -> 06:17 ${mrd(rows[iEnd].money)} Mrd (+ Runde 70,2 Mrd + 5 Vorkaeufe 18,1 Mrd bis dahin).`);

  if (liveSec > 0) {
    console.log(`\n--- LIVE-Messung (nur getSaveFile, ${liveSec} s Abstand) ---`);
    const a = await liveSave();
    await new Promise((r) => setTimeout(r, liveSec * 1000));
    const b = await liveSave();
    const dtGame = (b.p.playtimeSinceLastBitnode - a.p.playtimeSinceLastBitnode) / 1000;
    const dtWall = (b.t - a.t) / 1000;
    const Ba = a.p.moneySourceB.data || a.p.moneySourceB, Bb = b.p.moneySourceB.data || b.p.moneySourceB;
    console.log(`Spielzeit ${dtGame.toFixed(1)} s, Wanduhr ${dtWall.toFixed(1)} s`);
    for (const k of SRC_KEYS) { const d = (Bb[k] - Ba[k]) / dtGame; if (Math.abs(d) > 1) console.log(`   ${padR(k, 16)} ${(d / 1e6).toFixed(3)} M$/s  (${(d * 3600 / 1e9).toFixed(2)} Mrd/h)`); }
    console.log(`   Konto ${mrd(a.p.money)} -> ${mrd(b.p.money)} Mrd (${((b.p.money - a.p.money) / dtGame / 1e6).toFixed(3)} M$/s netto)`);
  }
}

// =========================================================================================
// 5. COMPETENCE -> STUNDEN
// =========================================================================================
function ratesFor() {
  const s0817 = loadState(F.h0817);
  const dt = (SNAP.playtimeSinceLastAug - s0817.p.playtimeSinceLastAug) / 3.6e6;
  const cur = {};
  for (const s of ["strength", "defense", "dexterity", "agility", "hacking"]) cur[s] = (SNAP.exp[s] - s0817.p.exp[s]) / dt;
  // Zyklus 2: mittlere Rate von 1,27 h bis 12,07 h nach dem Einbau (spaeterer Zyklusabschnitt)
  const c2a = loadState("2026-10-03T20-17_hourly"), c2b = loadState(F.pre0705);
  const dt2 = (c2b.p.playtimeSinceLastAug - c2a.p.playtimeSinceLastAug) / 3.6e6;
  const old = {};
  for (const s of ["strength", "defense", "dexterity", "agility", "hacking"]) old[s] = (c2b.p.exp[s] - c2a.p.exp[s]) / dt2;
  return { cur, old, dt };
}
function roundExtra(names) {
  const e = multsProduct(names, bot.COMBAT_AUGS);
  return { extra: { strength: e.strength || 1, defense: e.defense || 1, dexterity: e.dexterity || 1, agility: e.agility || 1 }, bb: e.bladeburner_success_chance || 1 };
}
async function abschnitt5() {
  console.log(hr("5. VON DER COMPETENCE ZU STUNDEN BIS ZUM BLADEBURNER-AUSGANG"));
  const R = ratesFor();
  const tNow = SNAP.playtimeSinceLastAug / 3.6e6;
  const gate2H = (EINBAU_UHR.fertig + Math.max(12 * 3600000, 2 * (EINBAU_UHR.fertig - EINBAU_UHR.playtime)) - SNAP.totalPlaytime) / 3.6e6;
  console.log(`Stand ${SNAP.label}`);
  console.log(`Rang ${Math.round(SNAP.bb.rank)}, ${SNAP.bb.numBlackOpsComplete} von 21 Black Ops, naechste ${blackOps[SNAP.bb.numBlackOpsComplete].name}; ${tNow.toFixed(2)} h seit dem Einbau.`);
  console.log(`Tor 2 oeffnet fruehestens ${gate2H.toFixed(2)} h nach dem Stand (data/einbau-uhr.json: Ende Wiederaufbau + max(12 h, 2 x Dauer); der Wiederaufbau dauerte ${((EINBAU_UHR.fertig - EINBAU_UHR.playtime) / 60000).toFixed(1)} min).`);
  const s0717 = loadState(F.h0717), s0817 = loadState(F.h0817);
  const gObs1 = Math.log(SNAP.bb.rank / s0717.bb.rank) / ((SNAP.playtimeSinceLastAug - s0717.p.playtimeSinceLastAug) / 3.6e6);
  const gObs2 = Math.log(SNAP.bb.rank / s0817.bb.rank) / ((SNAP.playtimeSinceLastAug - s0817.p.playtimeSinceLastAug) / 3.6e6);
  console.log(`Beobachtete Log-Wachstumsrate des Rangs in diesem Zyklus: ${gObs1.toFixed(2)}/h (07:17->Stand), ${gObs2.toFixed(2)}/h (08:17->Stand).`
    + ` Fruehere Knoten im Abschnitt 2: BN4.3 0,28/h (30k->210k in 7 h), BN9.3 0,27/h (24k->623k in 12 h; tools/bbrank, verify-g01-substanz).`);
  console.log(`exp-Raten (je Stunde): jetzt ${Object.entries(R.cur).map(([k, v]) => k.slice(0, 3) + " " + Math.round(v)).join(", ")}`);
  console.log(`                       Zyklus-2-Mittel ${Object.entries(R.old).map(([k, v]) => k.slice(0, 3) + " " + Math.round(v)).join(", ")}`);

  console.log(`\n5A  Vorwaertsrechnung BN2.1 (Stufen und Chancen gerechnet, Rang ANGENOMMEN = Rang0 x exp(gamma t)); Ausgang = alle 21 Black Ops. Spielstunden ab Stand.`);
  console.log(`    Black Ops feuern vor Rang 400k bei Chance >= 0,90, danach bei >= 0,40 (blade.js blackOpSchwelle: SICHER_BLACKOP_OHNE_RAID 0,40, mit Raid-Vorrat 0,35).`);
  console.log(`    Fertigkeiten: "sqrt" = Stufen wachsen mit sqrt(Skillpunkte) bei eingefrorenen Anteilen; "greedy" = neue Punkte gehen in den besten von Reaper/Evasive/BI/DO fuer Daedalus.`);
  console.log(`    ${padR("Szenario", 56)}${pad("Rang 400k", 11)}${pad("Ausgang", 10)}${pad("vor Tor 2?", 12)}`);
  const worst = { t: 0 };
  for (const gamma of [0.28, 0.5, 0.8]) for (const [rl, rates] of [["exp-Rate jetzt", R.cur], ["exp-Rate Zyklus 2", R.old]]) for (const policy of ["sqrt", "greedy"]) {
    const r = forwardSim(SNAP, { gamma, rates, policy });
    if (r.tExit !== null && r.tExit > worst.t) { worst.t = r.tExit; worst.l = `gamma ${gamma}, ${rl}, ${policy}`; }
    console.log(`    ${padR(`gamma ${gamma}/h, ${rl}, Skills ${policy}`, 56)}${pad(r.tE1 === null ? "-" : "+" + r.tE1.toFixed(1) + " h", 11)}${pad(r.tExit === null ? ">30 h" : "+" + r.tExit.toFixed(1) + " h", 10)}${pad(r.tExit !== null && r.tExit < gate2H ? "ja" : "NEIN", 12)}`);
  }
  console.log(`    Spaetester Ausgang in diesen Szenarien: +${worst.t.toFixed(1)} h (${worst.l}) gegen Tor 2 bei +${gate2H.toFixed(1)} h.`);
  let lo = 0.02, hi = 0.8;
  for (let i = 0; i < 25; i++) { const mid = (lo + hi) / 2; const r = forwardSim(SNAP, { gamma: mid, rates: R.old, policy: "sqrt", hours: 40 }); if (r.tExit !== null && r.tExit < gate2H) hi = mid; else lo = mid; }
  console.log(`    Kritische Rangwachstumsrate (schlechteste Annahmen: Zyklus-2-exp, sqrt-Skills): der Ausgang liegt vor Tor 2, sobald gamma >= ${hi.toFixed(3)}/h -`
    + ` das sind ${(hi / gObs2 * 100).toFixed(0)} % der beobachteten ${gObs2.toFixed(2)}/h und ${(hi / 0.28 * 100).toFixed(0)} % der Rate von BN4.3/BN9.3.`);

  console.log(`\n5B  Was brachte die Torrunde 07:04 fuer den Ausgang von BN2.1? (gleiche Rechnung, Mults der 7 Stuecke herausgenommen)`);
  const rnd = roundExtra(BOUGHT7);
  const inv = Object.fromEntries(Object.entries(rnd.extra).map(([k, v]) => [k, 1 / v]));
  console.log(`    ${padR("Szenario", 44)}${pad("mit Runde", 12)}${pad("ohne Runde", 12)}${pad("gespart", 10)}`);
  for (const gamma of [0.28, 0.5, 0.8]) for (const policy of ["sqrt", "greedy"]) {
    const a = forwardSim(SNAP, { gamma, rates: R.cur, policy });
    const b = forwardSim(SNAP, { gamma, rates: R.cur, policy, extra: inv, bbExtra: 1 / rnd.bb });
    console.log(`    ${padR(`gamma ${gamma}/h, exp jetzt, Skills ${policy}`, 44)}${pad("+" + a.tExit.toFixed(2) + " h", 12)}${pad("+" + b.tExit.toFixed(2) + " h", 12)}${pad((b.tExit - a.tExit).toFixed(2) + " h", 10)}`);
  }
  console.log(`    Die Rangannahme gamma bleibt in beiden Zeilen gleich: besserer Kampfwert beschleunigt in Wahrheit auch den Rang (nicht modelliert) -`
    + ` die Zahlen sind eine UNTERGRENZE. Die Runde kostete 70,2 Mrd und sparte damit 16 bis 63 Minuten = ${(0.27 * 60 / 70.2).toFixed(2)} bis ${(1.05 * 60 / 70.2).toFixed(2)} Minuten je Mrd (nur Kettenabschnitt).`);

  console.log(`\n5C  Wert eines SPAETEN Tors in BN2.1 (falls der Ausgang doch spaeter kaeme): Ausgang gespart, wenn die Kampf-Mults sofort um k^(1/0,8) steigen (ohne Wiederaufbau)`);
  console.log(`    ${padR("k (Competence)", 16)}${pad("gamma 0,28", 12)}${pad("gamma 0,5", 12)}${pad("gamma 0,8", 12)}`);
  for (const k of [1.2, 1.6, 2, 3, 5, 10]) {
    const f = Math.pow(k, 1 / 0.8);
    const cells = [0.28, 0.5, 0.8].map((gamma) => {
      const a = forwardSim(SNAP, { gamma, rates: R.cur, policy: "sqrt" });
      const b = forwardSim(SNAP, { gamma, rates: R.cur, policy: "sqrt", extra: { strength: f, defense: f, dexterity: f, agility: f } });
      return pad((a.tExit - b.tExit).toFixed(2) + " h", 12);
    });
    console.log(`    ${padR("x" + k, 16)}${cells.join("")}`);
  }
  console.log(`    Sättigung bei ~0,6 h: der Ausgang haengt am Rang 400.000 (Endspiel), nicht mehr an der Chance.`);

  console.log(`\n5D  FRISCHER KNOTEN (BN2.2/2.3), erstes Tor: gesparte Stunden bis zum Ende des kompetenzbegrenzten Abschnitts (Rang 25k bzw. 30k)`);
  console.log(`    Modell des G01-Substanz-Pruefers (verify-g01-substanz-phase1.mjs), Parameterband a 0,42-0,57, gs 0,042-0,08, beta 0,8-1,25. GESCHAETZT, nicht geeicht;`);
  console.log(`    ohne Kappung bei Chance = 1 - ueber k ~ 4 hinaus ist es eine obere Schranke, keine Vorhersage.`);
  console.log(`    ${padR("k", 8)}${pad("bis 25k min/Mittel/max", 28)}${pad("bis 30k min/Mittel/max", 28)}`);
  for (const k of [1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    const a = freshNodeSaving(k, 25000), b = freshNodeSaving(k, 30000);
    console.log(`    ${padR("x" + k, 8)}${pad(`${a.min.toFixed(1)} / ${a.mean.toFixed(1)} / ${a.max.toFixed(1)} h`, 28)}${pad(`${b.min.toFixed(1)} / ${b.mean.toFixed(1)} / ${b.max.toFixed(1)} h`, 28)}`);
  }

  const vonIdx = args.indexOf("--von"), vorIdx = args.indexOf("--vorher");
  if (vonIdx >= 0 && vorIdx >= 0) neustartVon(args[vonIdx + 1], args[vorIdx + 1]);
  const btIdx = args.indexOf("--backtest");
  const btName = btIdx >= 0 ? args[btIdx + 1] : null;
  if (btName) { const st = loadState(btName); backtest(st.p, btName); }
  await tabelleStrom();
}

function freshState(rep, s1901) {
  const owned = new Set();
  const cands = buildCandidates({ joined: s1901.p.factions.concat(s1901.p.factions.includes("Slum Snakes") ? [] : ["Slum Snakes"]),
    repOf: (f) => (f === "Slum Snakes" ? rep : 0), owned, queued: 0, combatAugs: bot.COMBAT_AUGS, sfLevel2: s1901.sf[2] });
  return { cands, owned, skills: s1901.p.skills, reaper: s1901.bb.skills.Reaper, evasive: s1901.bb.skills["Evasive System"],
    opName: "OperationTyphoon", startMults: {}, step: STEP };
}

// ---- 5H: Rueckpruefung der Vorwaertsrechnung gegen einen SPAETEREN Spielstand ----------------
// Rechnet vom Snapshot (08:24) bis zur Spielzeit des spaeteren Standes, mit dem dort BEOBACHTETEN Rang, und vergleicht Stufen, Fertigkeiten, Chance.
function backtest(p, label) {
  const R = ratesFor();
  const dt = (p.playtimeSinceLastAug - SNAP.playtimeSinceLastAug) / 3.6e6;
  const bbA = p.bladeburner.data || p.bladeburner;
  const gObs = Math.log(bbA.rank / SNAP.bb.rank) / dt;
  console.log(`
5H  RUECKPRUEFUNG der Vorwaertsrechnung gegen ${label}: ${dt.toFixed(3)} h nach dem Snapshot, Rang ${Math.round(SNAP.bb.rank)} -> ${Math.round(bbA.rank)} (beobachtetes gamma ${gObs.toFixed(2)}/h), ${SNAP.bb.numBlackOpsComplete} -> ${bbA.numBlackOpsComplete} Black Ops`);
  const sim = {};
  for (const policy of ["sqrt", "greedy"]) sim[policy] = forwardSim(SNAP, { gamma: gObs, rates: R.cur, policy, hours: dt, dt: 0.01 });
  console.log(`    exp-Rate des Snapshots (je Stunde) ${Object.entries(R.cur).map(([k, v]) => k.slice(0, 3) + " " + Math.round(v)).join(", ")}`);
  console.log(`    ${padR("Groesse", 22)}${pad("Soll (Spielstand)", 18)}${pad("Ist sqrt", 12)}${pad("Ist greedy", 12)}`);
  for (const s of ["strength", "defense", "dexterity", "agility", "hacking"]) {
    console.log(`    ${padR("Stufe " + s, 22)}${pad(p.skills[s], 18)}${pad(sim.sqrt.last.skills[s], 12)}${pad(sim.greedy.last.skills[s], 12)}`);
  }
  for (const s of ["Reaper", "Evasive System", "Blade's Intuition", "Digital Observer", "Short-Circuit"]) {
    console.log(`    ${padR("Fertigkeit " + s.slice(0, 10), 22)}${pad(bbA.skills[s] || 0, 18)}${pad(sim.sqrt.last.bbS[s], 12)}${pad(sim.greedy.last.bbS[s], 12)}`);
  }
  const stReal = { skills: p.skills, m: skillMults(bbA.skills), stamina: bbA.maxStamina, maxStamina: bbA.maxStamina, bbSucc: p.mults.bladeburner_success_chance, teamCount: 0 };
  const dReal = boSuccess(blackOps[20], 1, stReal).p;
  console.log(`    ${padR("Chance Daedalus", 22)}${pad(dReal.toFixed(4), 18)}${pad(sim.sqrt.last.daed.toFixed(4), 12)}${pad(sim.greedy.last.daed.toFixed(4), 12)}`);
  const nDone = (r) => SNAP.bb.numBlackOpsComplete + r.opLog.filter((o) => o.t <= dt + 1e-9).length;
  console.log(`    ${padR("Black Ops erledigt", 22)}${pad(bbA.numBlackOpsComplete, 18)}${pad(nDone(sim.sqrt), 12)}${pad(nDone(sim.greedy), 12)}`);
  return { gObs, dt };
}

// ---- 5A': dieselbe Vorwaertsrechnung ab einem SPAETEREN Spielstand (--von <Spielstand>, Vorgaenger fuer die exp-Rate: --vorher <Spielstand>) ----
function neustartVon(name, prevName) {
  const st = loadState(name), pv = loadState(prevName);
  const p = st.p, bb = st.bb;
  const dtPrev = (p.playtimeSinceLastAug - pv.p.playtimeSinceLastAug) / 3.6e6;
  const snap = {
    playtimeSinceLastAug: p.playtimeSinceLastAug, totalPlaytime: p.totalPlaytime, skills: p.skills, exp: p.exp,
    mults: Object.fromEntries(["hacking", "strength", "defense", "dexterity", "agility", "bladeburner_success_chance"].map((k) => [k, p.mults[k]])),
    bb: { rank: bb.rank, maxRank: bb.maxRank, skills: bb.skills, numBlackOpsComplete: bb.numBlackOpsComplete, stamina: bb.stamina, maxStamina: bb.maxStamina,
      staminaBonus: bb.staminaBonus, totalSkillPoints: bb.totalSkillPoints, skillPoints: bb.skillPoints },
  };
  const rates = {};
  for (const s of ["strength", "defense", "dexterity", "agility", "hacking"]) rates[s] = (p.exp[s] - pv.p.exp[s]) / dtPrev;
  const gate2 = (EINBAU_UHR.fertig + 12 * 3600000 - p.totalPlaytime) / 3.6e6;
  const clock = /T(\d\d)-(\d\d)/.exec(name);
  const h0 = clock ? Number(clock[1]) + Number(clock[2]) / 60 : NaN;
  const hh = (x) => { const v = (h0 + x) % 24; return String(Math.floor(v)).padStart(2, "0") + ":" + String(Math.round((v % 1) * 60)).padStart(2, "0"); };
  console.log(`
5A'  Vorwaertsrechnung NEU ab ${name} (Rang ${Math.round(bb.rank)}, ${bb.numBlackOpsComplete} Black Ops, ${(p.playtimeSinceLastAug / 3.6e6).toFixed(2)} h seit Einbau, Tor 2 in ${gate2.toFixed(1)} h = ${hh(gate2)}); exp-Raten aus ${prevName}: str ${Math.round(rates.strength)}, dex ${Math.round(rates.dexterity)}/h`);
  console.log(`     ${padR("Szenario", 40)}${pad("Rang 400k", 12)}${pad("Ausgang", 18)}`);
  for (const gamma of [0.28, 0.5, 0.8]) for (const policy of ["sqrt", "greedy"]) {
    const r = forwardSim(snap, { gamma, rates, policy });
    console.log(`     ${padR(`gamma ${gamma}/h, Skills ${policy}`, 40)}${pad(r.tE1 === null ? "-" : "+" + r.tE1.toFixed(1) + " h " + hh(r.tE1), 12)}${pad(r.tExit === null ? ">30 h" : "+" + r.tExit.toFixed(1) + " h  " + hh(r.tExit), 18)}`);
  }
}

async function tabelleStrom() {
  const s1901 = loadState(F.c1End);
  const s = freshState(3e6, s1901);
  const T = 13; // Stunden von Knotenstart bis zum ersten Tor (12 h Sperre + Wiederaufbau)
  console.log(`\n5E  STUNDEN JE ZUSAETZLICHEM GANG-DOLLAR-STROM, frischer Knoten, erstes Tor ${T} h nach Knotenstart (Ruf 3 Mio, q0 = 0, Gewichte Typhoon)`);
  const G = { respect: SNAP.gang.respect, wantedLevel: SNAP.gang.wanted, territory: SNAP.gang.territory };
  const per = (task) => SNAP.gang.members.reduce((a, m) => ({ r: a.r + respectGain(G, m, TASKS[task]) * 5, mo: a.mo + moneyGain(G, m, TASKS[task]) * 5, w: a.w + wantedGain(G, m, TASKS[task]) * 5 }), { r: 0, mo: 0, w: 0 });
  const T0 = per("Terrorism"), HT = per("Human Trafficking"), IA = per("Traffick Illegal Arms");
  const gangMax = HT.mo;
  console.log(`    Obergrenze des heutigen Gangs (12 Mitglieder, Stufen 08:24, alle auf Human Trafficking): ${(gangMax / 1e6).toFixed(2)} M$/s = ${(gangMax * 3600 / 1e9).toFixed(1)} Mrd/h;`
    + ` Stroeme ueber ${(gangMax / 1e6).toFixed(1)} M$/s sind mit diesen Mitgliedern nicht erreichbar.`);
  console.log(`    ${padR("Basisgeld am Tor", 18)}${padR("Strom", 12)}${pad("+Geld Mrd", 12)}${pad("Geld Mrd", 12)}${pad("Stuecke", 9)}${pad("k", 8)}${pad("h bis 25k (min/Mittel/max)", 30)}`);
  for (const base of [36, 75]) {
    const p0 = planOf(s, base * 1e9);
    const h0 = freshNodeSaving(p0.gain, 25000);
    console.log(`    ${padR(base + " Mrd", 18)}${padR("0", 12)}${pad("0", 12)}${pad(base.toFixed(0), 12)}${pad(p0.seq.length, 9)}${pad("x" + p0.gain.toFixed(2), 8)}${pad(`${h0.min.toFixed(1)} / ${h0.mean.toFixed(1)} / ${h0.max.toFixed(1)} h`, 30)}`);
    for (const rate of [1e6, 2e6, 4e6, 1e7, 1e8, 1e9]) {
      const extra = rate * T * 3600;
      const M = base * 1e9 + extra;
      const p = planOf(s, M);
      const h = freshNodeSaving(p.gain, 25000);
      const dh = [h.min - h0.min, h.mean - h0.mean, h.max - h0.max];
      const reach = rate <= gangMax ? "" : "  [mit heutigen Mitgliedern nicht erreichbar]";
      console.log(`    ${padR("", 18)}${padR(rate.toExponential(0) + " $/s", 12)}${pad(mrd(extra, 0), 12)}${pad(mrd(M, 0), 12)}${pad(p.seq.length, 9)}${pad("x" + p.gain.toFixed(2), 8)}${pad(`${h.min.toFixed(1)} / ${h.mean.toFixed(1)} / ${h.max.toFixed(1)} h`, 30)}   +${dh[1].toFixed(1)} h (${dh[0].toFixed(1)}..${dh[2].toFixed(1)})${reach}`);
    }
  }
  console.log(`    In BN2.1 ist der Strom fuer Tor 2 wertlos (5A: Ausgang vor Tor 2).`);

  // Tauschkurs Respekt <-> Geld im Gang
  // Ruf je Respekt: faction_rep x (1 + Favor/100) / 75 (Gang.ts:144-155). BN2.1 jetzt: Favor ~155 (der Einbau 07:05 hat Ruf in Favor gewandelt);
  // ein FRISCHER Knoten hat Favor 0 - bis zum ersten Einbau, also fuer das erste Tor.
  const repFacNow = SNAP.mults.faction_rep * (1 + SNAP.slumSnakes.favor / 100) / 75;
  const repFac = SNAP.mults.faction_rep / 75;
  console.log(`\n5F  TAUSCHKURS im Gang (12 Mitglieder, Stufen 08:24, Territorium 1/7): alle Mitglieder auf eine Aufgabe; Faktionsruf mit Favor 0 (frischer Knoten, erstes Tor) und Favor ${SNAP.slumSnakes.favor.toFixed(0)} (BN2.1 jetzt)`);
  console.log(`    ${padR("Aufgabe", 26)}${pad("Respekt/s", 12)}${pad("Ruf/s Favor 0", 15)}${pad("Ruf/s Favor 155", 17)}${pad("Geld $/s", 14)}${pad("Wanted/s", 10)}`);
  for (const [n, x] of [["Terrorism", T0], ["Human Trafficking", HT], ["Traffick Illegal Arms", IA]]) {
    console.log(`    ${padR(n, 26)}${pad(x.r.toFixed(0), 12)}${pad((x.r * repFac).toFixed(1), 15)}${pad((x.r * repFacNow).toFixed(1), 17)}${pad(x.mo.toFixed(0), 14)}${pad(x.w.toFixed(2), 10)}`);
  }
  const dRep = (T0.r - HT.r) * repFac, dMon = HT.mo - T0.mo;
  const gangRate = dMon / dRep;
  console.log(`    Terrorism -> Human Trafficking (Favor 0): ${dRep.toFixed(0)} Faktionsruf/s weniger gegen ${(dMon / 1e6).toFixed(2)} M$/s mehr  =>  1 Ruf kostet im Gang ${gangRate.toFixed(0)} $ (Tauschkurs; mit Favor 155 waeren es ${(dMon / ((T0.r - HT.r) * repFacNow)).toFixed(0)} $)`);

  // Wert eines Rufpunkts in Dollar am Tor, gegen den Tauschkurs
  console.log(`
    Wert eines Rufpunkts in Dollar am Tor (frischer Knoten): (d ln k / d Ruf) / (d ln k / d Geld). Geldableitung ueber M -> 2M (die Rundenwahl ist stufig).`);
  console.log(`    ${padR("Geld am Tor", 14)}${padR("Ruf-Intervall", 22)}${pad("Wert $ je Ruf", 16)}${pad("gegen Tauschkurs", 18)}`);
  const lnk = (rep, M) => Math.log(planOf(freshState(rep, s1901), M).gain);
  for (const M of [36e9, 75e9, 150e9]) {
    const dM = (lnk(3e6, M * 2) - lnk(3e6, M)) / M;
    for (const [a, b] of [[2.5e5, 7.5e5], [7.5e5, 1.25e6], [1.25e6, 3e6]]) {
      const dR = (lnk(b, M) - lnk(a, M)) / (b - a);
      const val = dR / dM;
      console.log(`    ${padR(mrd(M, 0) + " Mrd", 14)}${padR(`${(a / 1e6).toFixed(2)}-${(b / 1e6).toFixed(2)} Mio`, 22)}${pad(val.toFixed(0), 16)}${pad((val / gangRate).toFixed(1) + " x", 18)}`);
    }
  }
  console.log(`    Unter 1,25 Mio Ruf ist ein Rufpunkt mehr wert als die Dollar, die der Gang dafuer abgeben muesste; darueber ist er wertlos (hoechster Ruf-Bedarf aller Kampfstuecke ohne TRP).`);

  // Geldmodus ab 1,25 Mio Ruf (Kombination)
  const tRep = 8.7;
  const hMoney = Math.max(0, T - tRep);
  console.log(`\n5G  KOMBINATION: Respekt-Modus bis Ruf 1,25 Mio, danach Human Trafficking. Ruf-Kurve des echten Gangs (Slum Snakes, ab Gruendung 04.10. 01:01):`
    + ` 12,6k (2,3 h), 56k (3,3 h), 141k (4,3 h), 329k (5,3 h), 510k (6,07 h) -> 1,25 Mio nach ~${tRep} h (Extrapolation der gemessenen Kurve: Rate waechst ~+40k/h je Stunde; Sim-Wert 8,5 h).`);
  console.log(`    Geldmodus-Zeit bis zum Tor: ${T} - ${tRep} = ${hMoney.toFixed(1)} h x ${(HT.mo / 1e6).toFixed(2)} M$/s = ${(HT.mo * hMoney * 3600 / 1e9).toFixed(0)} Mrd zusaetzlich;`
    + ` Ruf waechst dabei nur noch mit ${(HT.r * repFac).toFixed(0)}/s -> am Tor ${((1.25e6 + HT.r * repFac * hMoney * 3600) / 1e6).toFixed(2)} Mio (reicht).`);
  console.log(`    ${padR("Basisgeld", 12)}${pad("Geld am Tor", 14)}${pad("Stuecke", 9)}${pad("k", 8)}${pad("h bis 25k (min/Mittel/max)", 30)}${pad("gegen Basis", 22)}`);
  for (const base of [36, 75]) {
    const p0 = planOf(s, base * 1e9), h0 = freshNodeSaving(p0.gain, 25000);
    const M = base * 1e9 + HT.mo * hMoney * 3600, p = planOf(s, M), h = freshNodeSaving(p.gain, 25000);
    console.log(`    ${padR(base + " Mrd", 12)}${pad(mrd(M, 0) + " Mrd", 14)}${pad(p.seq.length, 9)}${pad("x" + p.gain.toFixed(2), 8)}${pad(`${h.min.toFixed(1)} / ${h.mean.toFixed(1)} / ${h.max.toFixed(1)} h`, 30)}${pad(`+${(h.mean - h0.mean).toFixed(1)} h (${(h.min - h0.min).toFixed(1)}..${(h.max - h0.max).toFixed(1)})`, 22)}`);
  }
}

// =========================================================================================
// 6. ANDERE GELDSENKEN
// =========================================================================================
async function abschnitt6() {
  console.log(hr("6. ANDERE GELDSENKEN IN V2 (nur gerechnete)"));
  const s0705 = loadState(F.pre0705);
  // 6a NFG am Rand
  const nfgOwned = (s0705.p.augmentations.find((a) => a.name === "NeuroFlux Governor") || {}).level || 0;
  const q = 12;
  console.log(`6a  NeuroFlux Governor am Tor (AugmentationHelpers.ts:123-135): Preis = 750.000 x 1,14^Stufe x 1,9^wartende; Wirkung je Stufe x1,01000262 auf Hacking/Kampf (nicht auf bladeburner_success_chance)`);
  const bo = bot.blackOpWeights(bot.blackopsTable, "OperationArchangel");
  const lv = bot.effectiveLevels(s0705.p.skills, bot.bladeEffFactors(s0705.bb.skills.Reaper, s0705.bb.skills["Evasive System"]));
  const comp = (ex) => { let c = 0; for (const st of Object.keys(bo.weights)) { const w = bo.weights[st]; if (w > 0) c += w * Math.pow((lv[st] || 0) * (ex[st] || 1), bo.decays[st]); } return c; };
  const base = comp({});
  console.log(`    Stand nach der Runde 07:04 (q = ${q}, NFG-Stufe installiert ${nfgOwned}); Vergleich: letztes Rundenstueck`);
  let cum = 0;
  for (let i = 0; i < 4; i++) {
    const price = 750000 * Math.pow(1.14, nfgOwned + i) * Math.pow(STEP, q + i);
    const f = Math.pow(1.01000262, i + 1);
    const g = Math.log(comp({ strength: f, defense: f, dexterity: f, agility: f, hacking: f }) / base);
    cum += price;
    console.log(`      NFG-Stufe +${i + 1}: Preis ${mrd(price, 2)} Mrd (kumuliert ${mrd(cum, 2)}), kumuliert ln-Zuwachs ${g.toFixed(4)} => ${(g / (cum / 1e9)).toFixed(5)} ln je Mrd`);
  }
  const sA = gateState(s0705, { queuedNames: Q5, ssRep: s0705.repOf("Slum Snakes") - 19000, opName: "OperationArchangel",
    reaper: s0705.bb.skills.Reaper, evasive: s0705.bb.skills["Evasive System"] });
  const pl = planOf(sA, 74.4e9);
  const stp = pl.steps[pl.steps.length - 1];
  const lnLast = Math.log(planOf(sA, 74.4e9).gain / planOf(sA, 74.4e9 - stp.price).gain);
  console.log(`      letztes Rundenstueck (${stp.aug}): ${mrd(stp.price, 2)} Mrd, ln-Zuwachs ${lnLast.toFixed(4)} => ${(lnLast / (stp.price / 1e9)).toFixed(5)} ln je Mrd`);

  // 6b Graft
  console.log(`
6b  Grafting (GraftableAugmentation.ts:20-30): Preis = 3 x Grundpreis OHNE Warteschlangenfaktor; Zeit = (log2(Summe der Mults != 1) + 0,5)/2 h / (1 + Int^0,8/600); je Graft Entropie +1 (alle Mults x0,98, auch bladeburner_*)`);
  console.log(`    Wert je Graft auf dem Stand 04.10. 08:17 (aug-graft.mjs: competence-Index ohne Entropie-Folgekosten spaeterer Grafts; Entropie des EINEN Grafts ist enthalten):`);
  console.log(`    ${padR("Stueck", 34)}${pad("Faktor", 9)}${pad("Graft Mrd", 11)}${pad("Zeit h", 8)}${pad("ln je Mrd", 11)}${pad("ln je h", 9)}${pad("Torpreis q=0", 14)}${pad("q=5", 9)}${pad("q=12", 10)}`);
  const gs = loadSave(backupPath(F.h0817));
  const augTab = loadAugs();
  const m0 = computeMults(gs.p, augTab);
  const c0 = gComp(gs.p.exp, m0, gs.p.bitNodeN, gs.p.skills.intelligence);
  const rowsG = [];
  for (const n of Object.keys(bot.COMBAT_AUGS)) {
    const a = augTab[n];
    if (!a || n.startsWith("Stanek") || gs.p.augmentations.some((x) => x.name === n)) continue;
    const q = JSON.parse(JSON.stringify(gs.p));
    q.augmentations.push({ name: n, level: 1 });
    q.entropy = (q.entropy || 0) + 1;
    const fac = gComp(q.exp, computeMults(q, augTab), q.bitNodeN, q.skills.intelligence) / c0;
    const th = graftTimeH(a, gs.p.skills.intelligence);
    rowsG.push({ n, a, fac, th, cost: a.moneyCost * 3 });
  }
  rowsG.sort((x, y) => Math.log(y.fac) / y.cost - Math.log(x.fac) / x.cost);
  for (const r of rowsG.filter((x) => x.fac > 1.02).slice(0, 8)) {
    console.log(`    ${padR(r.n, 34)}${pad("x" + r.fac.toFixed(3), 9)}${pad(mrd(r.cost, 2), 11)}${pad(r.th.toFixed(2), 8)}${pad((Math.log(r.fac) / (r.cost / 1e9)).toFixed(4), 11)}${pad((Math.log(r.fac) / r.th).toFixed(3), 9)}${pad(mrd(r.a.moneyCost, 2), 14)}${pad(mrd(r.a.moneyCost * Math.pow(STEP, 5), 1), 9)}${pad(mrd(r.a.moneyCost * Math.pow(STEP, 12), 0), 10)}`);
  }
  console.log(`    Gate-Runde gleicher Stufe zum Vergleich (2D, q0 = 0): 10 Mrd -> ln 0,69; 50 Mrd -> ln 1,43; 150 Mrd -> ln 1,80 - Grenzertrag 0,005 bis 0,003 ln je Mrd jenseits von 50 Mrd.`);
  console.log(`    Der Graft kennt keinen 1,9-Faktor, braucht keinen Faktionsruf und wirkt sofort, kostet aber Spielerzeit (Rechnung: Stunden je Graft) und Entropie. Ein Stunden-Ertrag in Rang ist NICHT gerechnet.`);

  // 6c Cloud-RAM
  console.log(`\n6c  Cloud-RAM (tools/audit/infra-deckel.mjs, Preise geeicht; Eingaben Spielstand BN2.1 09:59 03.10.; hier nicht neu gerechnet, Ausgabe uebernommen):`);
  console.log(`    Amortisationsdeckel 600 s -> 1800 s: +3,67 bis +7,09 Mrd/h Einkommen fuer 1,14-2,15 Mrd einmalig (Amortisation der Differenz 18-19 min); freie Aufnahme der Geldziele 17.854 GB`);
  console.log(`    = Obergrenze dieser Senke (~2,7 Mrd). Das ist die einzige gefundene Senke mit Rueckfluss; sie gehoert an den KNOTENANFANG (Geld in den ersten Stunden), nicht ans Tor.`);
  console.log(`\n6d  Nicht gerechnet: Hacknet-Hashes (G02: Einbau loescht die Server), Spenden an die Gang-Faktion, Gang-Ausruestung (gang.js: bewusst aus), Casino/Boerse.`);
}

if (show(1)) await abschnitt1();
if (show(2)) await abschnitt2();
if (show(3)) await abschnitt3();
if (show(4)) await abschnitt4();
if (show(5)) await abschnitt5();
if (show(6)) await abschnitt6();
