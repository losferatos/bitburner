// P2b Skeptiker Substanz (04.10.2026): Gang im FRISCHEN Knoten (BN2.2/2.3).
//
// Die beiden Berichte rechnen die Gang-Strategien nur fuer BN2.1 (reife Gang, Favor 155,
// Tor 1 um 19:13, verify-p2b-gang.md) bzw. mit einem festen Momentwert von 4,05 M$/s und
// ohne Gang-Dynamik (verify-p2b-geldwert.md 5E/5G). Fuer den Nutzen in BN2.2/2.3 fehlt
// eine Rechnung ab der Gruendung. Dieses Skript baut sie AUF dem Motor von
// gang-p2b-sim.mjs (an der echten Gang geeicht) auf und prueft zuerst, ob dieser Motor
// den Lauf AB DER GRUENDUNG traegt (die Eichung des Pruefers beginnt erst 03:17).
//
// K  Eichung ab Gruendung: echte Gang BN2.1, gegruendet 04.10. 01:01:41 (gang.json
//    lastCreateAt 1791068501929), Favor 0, faction_rep 1,3683 (Spielstand 19:17..07:05).
//    Echter Regler (src/gang.js per data-URL), Start mit 0 Mitgliedern, respect 1, wanted 1
//    (Gang.ts:64-88). Vergleich mit den Backups 01:17 .. 07:05 (pre-install).
// F  Frischer Knoten: faction_rep 1,3281 (BN2.1 03.10. 05:33 und 19:01: NFG 3 aus SF12),
//    Favor 0, Gang ab Knoten +0,5 h, Tor bei Gang-Alter 13 h / 14 h (BN2.1 Zyklus 1: Tor
//    bei Knoten +14,32 h). Bot-Kasse linear 36 Mrd bis Knoten +14,3 h (BN2.1 Zyklus 1 netto
//    mit Kaufaufschub, verify-p2b-geldwert.md 4). Strategien:
//      S0   gebaut (Terrorism/Vigilante)
//      S1   Terrorism bis R, dann beste Geldaufgabe (R = 1,275 Mio bzw. 1,6575 Mio)
//      S3   S1 + Ausruestung w/a/v/r in der Geldphase (Regel des Pruefers: holdH 3, minRatio 1,5)
//      S5   S3 + Ausruestung w/a/v/r auch in der RESPEKT-Phase fuer arbeitende Mitglieder
//           ab Gang-Alter eqH (aufsteigend nach Preis, solange Kasse >= Preis + Reserve)
//    Torrunde: ECHTER Planer waehleTorRunde (src/lib/einbau.js), nichts besessen, Gewichte
//    Operation Typhoon (erste Black Op), Spielerstufen und Reaper/Evasive aus dem Spielstand
//    BN2.1 03.10. 19:01 (pre-install, Analogon des ersten Tors).
// H  Stunden: (i) Modell freshNodeSaving des Geldwert-Pruefers (gang-p2b-stunden.mjs),
//    (ii) Skalierung an der BEOBACHTETEN BN2.1-Strecke Tor 19:01 -> Rang 25.000 (03:17, 8,27 h)
//    mit der tatsaechlichen Runde 19:01 (k_obs), T(k) = T_fix + T_sc x (k_obs/k)^beta.
//
// Aufruf: node tools/audit/gang-p2b-frisch.mjs [--only K|F|H] [--gate 13,14] [--eqh 3,5]
// Nur lesen. Schreibt nichts.
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as S from "./gang-p2b-sim.mjs";
import * as F from "./gang-formulas.mjs";
import { snapshot, loadBackup } from "./gang-p2b-live.mjs";
import { freshNodeSaving } from "./gang-p2b-stunden.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const BK = (k) => path.join(ROOT, "backups", "LIVE_197f4d61481686_BN2L1_" + k + ".json.gz");
const args = (() => { const a = {}; const v = process.argv.slice(2); for (let i = 0; i < v.length; i++) if (v[i].startsWith("--")) a[v[i].slice(2)] = v[i + 1] && !v[i + 1].startsWith("--") ? v[++i] : true; return a; })();
const f2 = (x, d = 2) => (Number.isFinite(x) ? x.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d }) : String(x));
const pct = (a, b) => (b ? f2((a / b - 1) * 100, 2) + " %" : "-");

function freshSnap(frm, cash0 = 0) {
  return { totalPlaytime: 0, money: cash0, factionRepMult: frm, slumSnakes: { playerReputation: 0, favor: 0 },
    gang: { respect: 1, wanted: 1, territoryWarfareEngaged: false, territoryClashChance: 0, storedTerritoryAndPowerCycles: 0 },
    members: [], allGangs: null, skills: {}, augNames: [], queuedNames: [] };
}

// Eigener Lauf (statt S.run), damit die Respekt-Phasen-Ausruestung eingehaengt werden kann.
function simulate(snap, cfg, o) {
  const w = S.makeWorld(snap, { seed: 1, cash0: snap.money });
  w.owned = new Set();
  const ctrl = S.makeController(cfg, o.real);
  const steps = Math.round(o.hours * S.TICKS_PER_H);
  const botPerTick = (o.botPerH ?? 0) / S.TICKS_PER_H;
  const marks = (o.marksH || []).map((h) => Math.round(h * S.TICKS_PER_H));
  const out = { marks: [], tR: null, spentResp: 0, spentMoney: 0, moneyStartH: null };
  const W_ALL = ["Weapon", "Armor", "Vehicle", "Rootkit"];
  const eqUp = S.UPGRADES.filter((u) => W_ALL.includes(u.type)).sort((a, b) => a.cost - b.cost);
  for (let i = 0; i < steps; i++) {
    const tH = i / S.TICKS_PER_H;
    w.cash += botPerTick;
    const spent0 = w.spent;
    ctrl.decide(w);
    out.spentMoney += w.spent - spent0;
    // S5: Ausruestung in der Respekt-Phase (nur arbeitende Terrorism-Mitglieder)
    if (o.respEquip && tH >= o.respEquip.fromH && i % 15 === 0 && w.rep < o.respEquip.untilRep) {
      const disc = S.discountOf(w);
      for (const u of eqUp) {
        for (const m of w.members) {
          if (m.task !== "Terrorism") continue;
          if (m.upgrades.includes(u.name)) continue;
          const c = u.cost / disc;
          if (w.cash - c < (o.respEquip.reserve ?? 0)) continue;
          const s0 = w.spent;
          if (S.buyUpgrade(w, m, u)) out.spentResp += w.spent - s0;
        }
      }
    }
    // ein Takt Gang (ohne decide, das lief oben)
    S.tick(w, null);
    if (out.tR === null && cfg.repTarget && w.rep >= cfg.repTarget) out.tR = (i + 1) / S.TICKS_PER_H;
    if (out.moneyStartH === null && w.members.some((m) => (F.TASKS[m.task] || {}).baseMoney > 0)) out.moneyStartH = tH;
    if (marks.includes(i + 1)) {
      out.marks.push({ h: (i + 1) / S.TICKS_PER_H, members: w.members.length, respect: w.respect, rep: w.rep, wanted: w.wanted,
        gangMoney: w.gangMoney, cash: w.cash, spent: w.spent, asc: w.ascensions,
        moneyPerH: w.lastMoneyPC * 5 * 3600, respPerS: w.lastRespPC * 5,
        strSum: w.members.reduce((a, m) => a + m.lvl.str, 0), tasks: w.members.reduce((x, m) => { x[m.task] = (x[m.task] || 0) + 1; return x; }, {}) });
    }
  }
  out.w = w;
  return out;
}

const real = await S.loadRealController();

// ============================================================================
// K  Eichung ab Gruendung
// ============================================================================
if (!args.only || args.only === "K") {
  const CREATE_WALL = 1791068501929;
  const pts = ["2026-10-04T01-17_hourly", "2026-10-04T02-17_hourly", "2026-10-04T03-17_hourly", "2026-10-04T04-17_hourly",
    "2026-10-04T05-17_hourly", "2026-10-04T06-17_hourly", "2026-10-04T07-05_pre-install"].map((k) => ({ k, s: snapshot(loadBackup(BK(k))) }));
  // Spielzeit der Gruendung: Backup 01:17 (pt) minus Wanduhr-Abstand (Wanduhr = Spielzeit, Eichung E des Pruefers)
  const s0117wall = Date.parse("2026-10-03T23:17:31.984Z");
  const pt0 = pts[0].s.totalPlaytime - (s0117wall - CREATE_WALL);
  const marksH = pts.map((p) => (p.s.totalPlaytime - pt0) / 3.6e6);
  const frm = pts[0].s.factionRepMult;
  const r = simulate(freshSnap(frm), { impl: "real", workMode: "respect" }, { real, hours: marksH[marksH.length - 1] + 0.01, marksH });
  console.log("=== K. Eichung ab Gruendung (echte Gang BN2.1, Favor 0, faction_rep " + f2(frm, 4) + ", Gruendung pt " + pt0 + ")");
  console.log("Stand".padEnd(30), "Alter h", "Mitgl Mod|echt", "Respekt Mod|echt|Abw", "Ruf Mod|echt|Abw", "Wanted Mod|echt", "Summe str Mod|echt");
  pts.forEach((p, i) => {
    const m = r.marks[i]; const g = p.s.gang; const strE = p.s.members.reduce((a, x) => a + x.lvl.str, 0);
    console.log(p.k.padEnd(30), f2(marksH[i], 3).padStart(7), (m.members + "|" + p.s.members.length).padStart(14),
      (f2(m.respect, 0) + "|" + f2(g.respect, 0) + "|" + pct(m.respect, g.respect)).padStart(34),
      (f2(m.rep, 0) + "|" + f2(p.s.slumSnakes.playerReputation, 0) + "|" + pct(m.rep, p.s.slumSnakes.playerReputation)).padStart(30),
      (f2(m.wanted, 0) + "|" + f2(g.wanted, 0)).padStart(16), (m.strSum + "|" + strE).padStart(14));
  });
}

// ============================================================================
// F  Frischer Knoten
// ============================================================================
const FRM_FRESH = 1.3281; // BN2.1 03.10. 05:33 und 19:01 (NFG 3 aus SF12), gerundet
const GANG_START_NODE_H = 0.5;
const BOT_PER_H = 36e9 / 14.3;
const s1901 = snapshot(loadBackup(BK("2026-10-03T19-01_pre-install")));
const SK1901 = s1901.skills;
const RE1901 = (s1901.bbSkills && s1901.bbSkills["Reaper"]) || 0, EV1901 = (s1901.bbSkills && s1901.bbSkills["Evasive System"]) || 0;
const TOR = { op: "OperationTyphoon", reaper: RE1901, evasive: EV1901 };
const W_ALL = ["Weapon", "Armor", "Vehicle", "Rootkit"];

function gateRound(budget, rep) {
  const p = S.torRound(budget, rep, new Set(), SK1901, TOR);
  return { n: p.seq.length, cost: p.cost, gain: p.gain, maxRep: p.maxRep, seq: p.seq };
}

// k_obs: die tatsaechliche Runde 19:01 (11 Stuecke) unter Typhoon-Gewichten, gegen "nichts gekauft"
const ACTUAL_1901 = ["Wired Reflexes", "Neurotrainer I", "EsperTech Bladeburner Eyewear", "EMS-4 Recombination", "ORION-MKIV Shoulder",
  "Neurotrainer II", "Hacknet Node Kernel Direct-Neural Interface", "Augmented Targeting I", "Hacknet Node CPU Architecture Neural-Upload",
  "Hacknet Node Cache Architecture Neural-Upload", "Hacknet Node NIC Architecture Neural-Upload"];
const K_OBS = S.opRatios(SK1901, ACTUAL_1901, { reaper: RE1901, evasive: EV1901 })["operationtyphoon"];
const T_OBS = (3919347400 - 3889583000) / 3.6e6; // Tor 19:01 (pre-install pt 3.889.583.000) -> 03:17 Rang 24.930 (pt 3.919.347.400)
function hoursScaled(k, Tfix, beta) { return Tfix + (T_OBS - Tfix) * Math.pow(K_OBS / k, beta); }

if (!args.only || args.only === "F" || args.only === "H") {
  const gates = String(args.gate || "13,14").split(",").map(Number);
  const eqHs = String(args.eqh || "3,5").split(",").map(Number);
  const cash0 = BOT_PER_H * GANG_START_NODE_H;
  const hoursMax = Math.max(...gates) + 0.001;
  const marksH = gates;
  const strats = [
    { key: "S0", cfg: { impl: "real", workMode: "respect" } },
    { key: "S1 R1,275", cfg: { impl: "local", workMode: "switch", repTarget: 1.275e6 } },
    { key: "S1 R1,6575", cfg: { impl: "local", workMode: "switch", repTarget: 1.6575e6 } },
    { key: "S3 R1,275", cfg: { impl: "local", workMode: "switch", repTarget: 1.275e6, equip: { types: W_ALL, holdH: 3, minRatio: 1.5 } } },
    { key: "S3 R1,6575", cfg: { impl: "local", workMode: "switch", repTarget: 1.6575e6, equip: { types: W_ALL, holdH: 3, minRatio: 1.5 } } },
  ];
  for (const eqH of eqHs) {
    strats.push({ key: "S5 R1,275 ab " + eqH + "h", cfg: { impl: "local", workMode: "switch", repTarget: 1.275e6, equip: { types: W_ALL, holdH: 3, minRatio: 1.5 } }, respEquip: { fromH: eqH, untilRep: 1.275e6, reserve: 0 } });
    strats.push({ key: "S5 R1,6575 ab " + eqH + "h", cfg: { impl: "local", workMode: "switch", repTarget: 1.6575e6, equip: { types: W_ALL, holdH: 3, minRatio: 1.5 } }, respEquip: { fromH: eqH, untilRep: 1.6575e6, reserve: 0 } });
  }
  strats.push({ key: "S0+Ausr ab 3h", cfg: { impl: "local", workMode: "respect" }, respEquip: { fromH: 3, untilRep: 1e12, reserve: 0 } });
  console.log("\n=== F. Frischer Knoten: faction_rep " + FRM_FRESH + ", Favor 0, Gang ab Knoten +" + GANG_START_NODE_H + " h, Bot-Kasse " + f2(BOT_PER_H / 1e9, 2) + " Mrd/h (Start " + f2(cash0 / 1e9, 2) + " Mrd)");
  console.log("Torrunde: echter Planer, nichts besessen, " + TOR.op + ", Stufen 19:01 " + JSON.stringify(SK1901) + ", Reaper " + RE1901 + " Evasive " + EV1901);
  console.log("k_obs (Runde 19:01, 11 Stuecke, Typhoon) = x" + f2(K_OBS, 3) + "; beobachtet Tor -> Rang 25.000: " + f2(T_OBS, 2) + " h");
  const rows = [];
  for (const st of strats) {
    const r = simulate(freshSnap(FRM_FRESH, cash0), st.cfg, { real, hours: hoursMax, marksH, botPerH: BOT_PER_H, respEquip: st.respEquip });
    gates.forEach((gH, i) => {
      const m = r.marks[i];
      const plan = gateRound(m.cash, m.rep);
      rows.push({ key: st.key, gH, m, plan, tR: r.tR, spentResp: r.spentResp, spentMoney: r.spentMoney, moneyStartH: r.moneyStartH });
    });
  }
  console.log("Strategie".padEnd(22), "Tor h", "R erreicht h", "Ruf am Tor", "Gang-Geld Mrd", "Ausr.Resp|Geld Mrd", "Kasse Tor Mrd", "Runde n", "Kosten Mrd", "k", "maxRep", "Geld/h am Tor Mrd", "Aufst");
  for (const x of rows) {
    console.log(x.key.padEnd(22), f2(x.gH, 1).padStart(5), (x.tR === null ? "-" : f2(x.tR, 2)).padStart(12), f2(x.m.rep / 1e6, 3).padStart(10) + " Mio",
      f2(x.m.gangMoney / 1e9, 1).padStart(12), (f2(x.spentResp / 1e9, 2) + "|" + f2(x.spentMoney / 1e9, 2)).padStart(18),
      f2(x.m.cash / 1e9, 1).padStart(12), String(x.plan.n).padStart(7), f2(x.plan.cost / 1e9, 1).padStart(10), ("x" + f2(x.plan.gain, 3)).padStart(7),
      (f2(x.plan.maxRep / 1e6, 3) + " Mio").padStart(10), f2(x.m.moneyPerH / 1e9, 1).padStart(10), String(x.m.asc).padStart(5));
  }
  // H: Stunden
  console.log("\n=== H. Stunden bis Rang 25.000 nach dem Tor (gegen S0 desselben Tors)");
  console.log("Strategie".padEnd(22), "Tor h", "k", "| Modell Geldwert-Pruefer gespart min/mittel/max", "| Skalierung beobachtet: T_fix 0 / 3,1 h, beta 0,8 / 1 / 1,25 gespart");
  for (const gH of gates) {
    const base = rows.find((x) => x.key === "S0" && x.gH === gH);
    for (const x of rows.filter((y) => y.gH === gH)) {
      const a = freshNodeSaving(base.plan.gain), b = freshNodeSaving(x.plan.gain);
      const sc = [];
      for (const Tfix of [0, 3.1]) for (const beta of [0.8, 1, 1.25]) sc.push(hoursScaled(base.plan.gain, Tfix, beta) - hoursScaled(x.plan.gain, Tfix, beta));
      console.log(x.key.padEnd(22), f2(gH, 1).padStart(5), ("x" + f2(x.plan.gain, 3)).padStart(7),
        "|", f2(b.min - a.min, 2), "/", f2(b.mean - a.mean, 2), "/", f2(b.max - a.max, 2),
        "| ", sc.map((v) => f2(v, 2)).join(" "));
    }
    const bs = hoursScaled(base.plan.gain, 0, 1), bs3 = hoursScaled(base.plan.gain, 3.1, 1);
    console.log("   S0-Grundzeit Tor -> 25k nach Skalierung (beta 1): " + f2(bs, 2) + " h (T_fix 0) / " + f2(bs3, 2) + " h (T_fix 3,1)");
  }
}
