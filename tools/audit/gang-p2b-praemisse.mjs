// P2b Praemissen-Skeptiker (04.10.2026): greift die Fragestellung der Berichte
// verify-p2b-gang.md (A) und verify-p2b-geldwert.md (B) an.
//
// Streng lesend: Spielstaende aus backups/, Live-Telemetrie NUR ueber getFile
// (Bruecke Port 8795, instance=LIVE), die echte Rundenwahl waehleTorRunde aus
// src/lib/einbau.js (ueber gang-p2b-lib.mjs, rein, ohne ns). Schreibt nichts.
//
// Abschnitte:
//   1  BN2.1: kommt der Ausgang vor dem Tor 19:13? (Live: data/blade.json,
//      data/aktionen.txt; Eichung: Rueckrechnung 09:17 -> jetzt)
//   2  Ruf-Ziel R im frischen Knoten: Formel aus A gegen den Rufbedarf der
//      tatsaechlich geplanten Runde (echte waehleTorRunde), Kosten in Stunden
//      und Mrd am Tor (Rufkurve des echten Gangs aus den Backups)
//   3  Torfrequenz: eine Runde mit M gegen zwei Runden mit M/2 (Preisfaktor
//      1,9^i beginnt nach jedem Einbau neu) - nur die Competence-Seite
//   4  Ruecklage: geldbedarf.txt = Kosten der Planrunde <= Konto; wie gross ist
//      die Luecke, die sechs Ausgeber abschoepfen duerfen?
//
// Aufruf: node tools/audit/gang-p2b-praemisse.mjs [--abschnitt N] [--offline]
//   --offline: Abschnitt 1 ohne Bruecke (dann nur aus Backups)
import fs from "node:fs";
import path from "node:path";
import {
  loadBot, loadState, buildCandidates, planRound, makeRoundModel, multsProduct,
  AUGS, STEP, ROOT, mrd, pad, padR,
} from "./gang-p2b-lib.mjs";
import { exactGangOffer } from "./gang-augs.mjs";

const args = process.argv.slice(2);
const only = args.includes("--abschnitt") ? Number(args[args.indexOf("--abschnitt") + 1]) : null;
const offline = args.includes("--offline");
const show = (n) => only === null || only === n;
const hr = (t) => "\n" + "=".repeat(96) + "\n" + t + "\n" + "=".repeat(96);
const bot = await loadBot();

// ---------------------------------------------------------------------------
// Live lesen (nur getFile)
// ---------------------------------------------------------------------------
async function getFile(name) {
  const u = "http://localhost:8795/api/rpc?" + new URLSearchParams({ method: "getFile", instance: "LIVE", filename: name, server: "home" });
  const r = await (await fetch(u)).json();
  return r.result ?? null;
}

// Schwelle der letzten Black Ops im Endspiel, wie blade.js sie rechnet:
// einsatzSchwelle = min(0,95, rankLoss/(rankGain*BB_RANK_MULT + rankLoss) + 0,25)
// (src/blade.js:2320-2327, EINSATZ_ABSTAND 0,25 :2275), Boden 0,35/0,40
// (:541-543), vor Rang 400.000 Boden 0,90 (:2350). BN2: BladeburnerRank nicht
// gesetzt (BitNode.tsx:569-591) -> 1. Werte rankGain/rankLoss aus
// Bladeburner/data/BlackOperations.ts:567-711.
const LAST_OPS = {
  "Operation Annihilus": { reqdRank: 200e3, rankGain: 7.5e3, rankLoss: 1e3 },
  "Operation Ultron": { reqdRank: 250e3, rankGain: 10e3, rankLoss: 2e3 },
  "Operation Centurion": { reqdRank: 300e3, rankGain: 15e3, rankLoss: 5e3 },
  "Operation Vindictus": { reqdRank: 350e3, rankGain: 20e3, rankLoss: 20e3 },
  "Operation Daedalus": { reqdRank: 400e3, rankGain: 40e3, rankLoss: 10e3 },
};
const einsatz = (o) => Math.min(0.95, o.rankLoss / (o.rankGain * 1 + o.rankLoss) + 0.25);
const endThreshold = (o) => Math.max(0.40, einsatz(o));

// ---------------------------------------------------------------------------
// 1. BN2.1: Ausgang gegen Tor
// ---------------------------------------------------------------------------
async function section1() {
  console.log(hr("1. BN2.1: KOMMT DER AUSGANG VOR DEM TOR (19:13)?"));
  if (offline) { console.log("  --offline: Abschnitt 1 braucht die Live-Telemetrie."); return; }
  const blade = JSON.parse(await getFile("data/blade.json"));
  const akt = (await getFile("data/aktionen.txt")).trim().split("\n").map((z) => { try { return JSON.parse(z); } catch { return null; } }).filter(Boolean);
  const uhr = JSON.parse(await getFile("data/einbau-uhr.json"));
  const now = blade.zeit;
  const fmt = (ms) => new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  // Tor: einbau-uhr.fertig + 12 h Spielzeit (lib/endspurt.js:322-331); Spielzeit = Wanduhr (A, Eichung E).
  const gateMs = now + (uhr.fertig + 12 * 3600e3 - blade.spielzeit);
  console.log(`  Live ${fmt(now)}: Rang ${Math.round(blade.rang)}, naechste Black Op ${blade.naechsteBlackOp}, Tor oeffnet ~${fmt(gateMs)} (einbau-uhr.fertig + 12 h).`);

  // Rangverlauf aus aktionen.txt (Rang am Ende jeder Aktion, Wanduhr)
  const pts = akt.filter((a) => Number.isFinite(a.rangBis) && Number.isFinite(a.bis)).map((a) => ({ t: a.bis, r: a.rangBis, a: a.aktion, d: a.bis - a.von, g: a.rangBis - (a.rangVon ?? a.rang) }));
  const rankAt = (t) => { let best = null; for (const p of pts) if (p.t <= t) best = p; return best ? best.r : null; };
  const windows = [[2, "2 h"], [1, "1 h"], [0.5, "30 min"]];
  console.log(`\n  Rangrate (alle Aktionen, Wanduhr = Spielzeit, aus data/aktionen.txt):`);
  const rates = {};
  for (const [h, lab] of windows) {
    const r0 = rankAt(now - h * 3600e3), r1 = rankAt(now);
    rates[lab] = (r1 - r0) / h;
    console.log(`    letzte ${padR(lab, 7)} ${pad(Math.round(r0), 8)} -> ${pad(Math.round(r1), 8)}  = ${pad(Math.round(rates[lab]), 7)} Rang/h`);
  }
  // Assassination-Bloecke (Rang je Stunde Aktionszeit)
  const blocks = pts.filter((p) => p.a === "Operations/Assassination" && p.d > 300e3 && p.t > now - 3 * 3600e3);
  console.log(`  Assassination-Bloecke > 5 min der letzten 3 h (Rang je Stunde Aktionszeit):`);
  for (const b of blocks) console.log(`    bis ${fmt(b.t)}  ${pad((b.d / 60e3).toFixed(1), 5)} min  +${pad(Math.round(b.g), 6)} Rang  = ${pad(Math.round(b.g / (b.d / 3600e3)), 7)} Rang/h`);

  // Eichung: Rate des Fensters [jetzt-2h, jetzt-1h] sagt den Rang jetzt voraus
  {
    const t0 = now - 2 * 3600e3, t1 = now - 1 * 3600e3;
    const rate = (rankAt(t1) - rankAt(t0)) / 1;
    const pred = rankAt(t1) + rate * 1, obs = rankAt(now);
    console.log(`  EICHUNG Rang: Rate ${fmt(t0)}-${fmt(t1)} (${Math.round(rate)}/h) linear fortgeschrieben auf ${fmt(now)}: ${Math.round(pred)}, beobachtet ${Math.round(obs)} (${((obs / pred - 1) * 100).toFixed(1)} %).`);
  }

  // Chance: Bot-Schaetzung boChancen. Zeitreihe Daedalus (Fremdwerte aus den Berichten + live).
  const series = [
    ["08:24", 100983, 0.0596, "B 1d"], ["08:49", 134775, 0.102, "A Abschn. 7"],
    ["08:53", 138566, 0.1087, "B 1d'"], ["09:17", 179480, 0.1713, "B 5H Backup"],
    ["09:29", 182790, 0.1828, "Live data/blade.json (Orchestrator-Abruf dieses Pruefers)"],
    [fmt(now), blade.rang, blade.boChancen["Operation Daedalus"], "Live jetzt"],
  ].filter((s) => Number.isFinite(s[2]));
  console.log(`\n  Daedalus-Chance (Bot-Schaetzung) gegen Rang:`);
  for (const s of series) console.log(`    ${s[0]}  Rang ${pad(Math.round(s[1]), 7)}  Chance ${s[2].toFixed(4)}  (${s[3]})`);
  const first = series[0], last = series[series.length - 1];
  const slope = Math.log(last[2] / first[2]) / (last[1] - first[1]); // ln-Chance je Rang
  // Eichung des Steigungsmodells: Steigung 08:24-09:17 sagt 09:29/jetzt voraus
  const s09 = series.find((s) => s[0] === "09:17");
  const slopeEarly = Math.log(s09[2] / first[2]) / (s09[1] - first[1]);
  const predLast = s09[2] * Math.exp(slopeEarly * (last[1] - s09[1]));
  console.log(`  EICHUNG Chance: Steigung 08:24-09:17 (${(slopeEarly * 1e5).toFixed(3)} ln je 100k Rang) sagt fuer Rang ${Math.round(last[1])} ${predLast.toFixed(4)} voraus, Bot jetzt ${last[2].toFixed(4)} (${((last[2] / predLast - 1) * 100).toFixed(0)} %).`);

  console.log(`\n  Was bis zum Ausgang fehlt (Schwelle ab Rang 400.000 = max(0,40, rankLoss/(rankGain+rankLoss)+0,25), blade.js:2349-2360):`);
  let worst = 1;
  for (const [n, o] of Object.entries(LAST_OPS)) {
    const c = blade.boChancen[n];
    if (!Number.isFinite(c)) { console.log(`    ${padR(n, 22)} erledigt`); continue; }
    const thrFrueh = 0.9, thrEnd = endThreshold(o);
    const need = thrEnd / c;
    if (o.reqdRank >= 300e3) worst = Math.max(worst, need);
    console.log(`    ${padR(n, 22)} Chance ${c.toFixed(3)}  Schwelle vor 400k ${thrFrueh.toFixed(2)} / ab 400k ${thrEnd.toFixed(2)}  -> Faktor ${need.toFixed(2)} noetig`);
  }
  const toGo = 400e3 - blade.rang;
  console.log(`\n  Rang bis 400.000: ${Math.round(toGo)}. Bei Fortschreibung der Chance mit der gemessenen Steigung (${(slope * 1e5).toFixed(3)} ln je 100k Rang)`);
  const gainAt400 = Math.exp(slope * toGo);
  console.log(`  waechst sie bis Rang 400k um x${gainAt400.toFixed(2)}; mit HALBER Steigung (abnehmende Skillertraege) x${Math.exp(slope * toGo / 2).toFixed(2)}; noetig fuer die schwerste (Vindictus 0,75) x${worst.toFixed(2)}.`);
  console.log(`  Zeit bis Rang 400k (Rest-Rang / Rate):`);
  for (const lab of Object.keys(rates)) {
    const h = toGo / rates[lab];
    console.log(`    Rate ${padR(lab, 7)} ${pad(Math.round(rates[lab]), 7)}/h -> ${h.toFixed(2)} h = ${fmt(now + h * 3600e3)}; Puffer zum Tor ${((gateMs - now) / 3600e3 - h).toFixed(1)} h`);
  }
  // Schlimmster Fall: halbe Rate der letzten 2 h, halbe Chancensteigung; dann Rang ueber 400k hinaus, bis Vindictus 0,75 erreicht
  const rWorst = rates["2 h"] / 2;
  const extraRank = Math.max(0, Math.log(worst) / (slope / 2) - toGo);
  const hWorst = (toGo + extraRank) / rWorst + 3 * 600 / 3600; // + je ~10 min fuer die drei letzten Ops
  console.log(`  Schlimmster gerechneter Fall (halbe Rate ${Math.round(rWorst)}/h, halbe Chancensteigung, +30 min fuer die drei letzten Ops):`);
  console.log(`    Ausgang nach ${hWorst.toFixed(1)} h = ${fmt(now + hWorst * 3600e3)} - Tor ${fmt(gateMs)}; Ausgang ${hWorst * 3600e3 < gateMs - now ? "VOR" : "NACH"} dem Tor.`);
  const crit = (toGo + Math.max(0, Math.log(worst) / (slope / 2) - toGo)) / ((gateMs - now) / 3600e3 - 0.5);
  console.log(`    Kritische Rangrate (Ausgang genau am Tor, halbe Chancensteigung): ${Math.round(crit)} Rang/h = ${(crit / rates["2 h"] * 100).toFixed(0)} % der 2-h-Rate.`);
}

// ---------------------------------------------------------------------------
// gemeinsamer Zustand fuer 2-4: frischer Knoten = BN2.1 03.10. 19:01 (wie B 2C)
// ---------------------------------------------------------------------------
const s1901 = loadState("2026-10-03T19-01_pre-install");
const JOINED = s1901.p.factions.concat(s1901.p.factions.includes("Slum Snakes") ? [] : ["Slum Snakes"]);
function freshState(rep, ownedExtra = [], opName = "OperationTyphoon") {
  const owned = new Set(ownedExtra);
  const cands = buildCandidates({ joined: JOINED, repOf: (f) => (f === "Slum Snakes" ? rep : 0), owned, queued: 0,
    combatAugs: bot.COMBAT_AUGS, sfLevel2: s1901.sf[2] });
  return { cands, owned, skills: s1901.p.skills, reaper: s1901.bb.skills.Reaper, evasive: s1901.bb.skills["Evasive System"],
    opName, startMults: multsProduct(ownedExtra, bot.COMBAT_AUGS), step: STEP };
}
const planOf = (s, money) => planRound(bot, { ...s, money });
const maxRepOfPlan = (p) => Math.max(0, ...p.seq.map((n) => AUGS[n].repCost));

// Rufkurve des echten Gangs (Favor 0, gegruendet 04.10. 01:01:41) aus den Backups
function repCurve() {
  const founded = Date.parse("2026-10-04T01:01:41+02:00");
  const files = ["2026-10-04T02-17_hourly", "2026-10-04T03-17_hourly", "2026-10-04T04-17_hourly", "2026-10-04T05-17_hourly", "2026-10-04T06-17_hourly", "2026-10-04T07-05_pre-install"];
  const out = [];
  for (const f of files) {
    const st = loadState(f);
    const t = Date.parse(f.slice(0, 10) + "T" + f.slice(11, 13) + ":" + f.slice(14, 16) + ":00+02:00");
    out.push({ f, h: (t - founded) / 3600e3, rep: st.repOf("Slum Snakes"), frm: st.p.mults.faction_rep });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2. Ruf-Ziel R im frischen Knoten
// ---------------------------------------------------------------------------
function section2() {
  console.log(hr("2. RUF-ZIEL R IM FRISCHEN KNOTEN: A-FORMEL GEGEN DEN RUFBEDARF DER GEPLANTEN RUNDE"));
  // A-Formel (verify-p2b-gang.md Abschnitt 3/8): 1,02 x max(repReq) der unbesessenen Kampfstuecke
  // der Gang-Faktion, ohne The Red Pill, ohne Stuecke > 100 Mrd Grundpreis.
  const offer = exactGangOffer(2, s1901.sf[2] || 0, 1, "Slum Snakes");
  const pool = offer.filter((n) => bot.COMBAT_AUGS[n] && n !== "The Red Pill" && n !== "NeuroFlux Governor" && AUGS[n] && AUGS[n].moneyCost <= 100e9);
  const top = pool.map((n) => [n, AUGS[n].repCost]).sort((a, b) => b[1] - a[1]);
  const rA = 1.02 * top[0][1];
  console.log(`  A-Formel, frischer Knoten (nichts besessen): max repReq = ${top[0][1]} (${top[0][0]}) -> R = ${Math.round(rA)}.`);
  console.log(`  Naechste: ${top.slice(1, 5).map(([n, r]) => n + " " + r).join(", ")}.`);

  console.log(`\n  Rufbedarf der GEPLANTEN Runde (echte waehleTorRunde, Ruf unbegrenzt) je Budget und Black-Op-Gewichten:`);
  const budgets = [20, 36, 50, 75, 100, 150, 200, 300, 400, 600, 1000, 2000];
  console.log(`    ${padR("Gewichte", 22)}${budgets.map((b) => pad(b, 9)).join("")}   (Mrd)`);
  for (const op of ["OperationTyphoon", "OperationRedDragon", "OperationDaedalus"]) {
    const s = freshState(1e9, [], op);
    console.log(`    ${padR(op, 22)}${budgets.map((b) => pad((maxRepOfPlan(planOf(s, b * 1e9)) / 1e6).toFixed(3), 9)).join("")}   (Mio Ruf)`);
  }
  // Competence mit R-Deckel 1,25 Mio gegen 1,6575 Mio bei denselben Budgets
  console.log(`\n  Competence-Zuwachs der Runde mit Ruf 1,275 Mio (= 1,25 Mio + 2 %) gegen 1,6575 Mio (Typhoon):`);
  const sLo = freshState(1.275e6), sHi = freshState(1.6575e6);
  console.log(`    ${budgets.map((b) => `${b}: x${planOf(sLo, b * 1e9).gain.toFixed(2)}/x${planOf(sHi, b * 1e9).gain.toFixed(2)}`).join("  ")}`);

  // Rufkurve -> Umschaltzeit fuer beide R, Geld am Tor
  const curve = repCurve();
  console.log(`\n  Rufkurve des echten Gangs (Favor 0, Backups, Stunden ab Gruendung 01:01:41):`);
  for (const c of curve) console.log(`    ${padR(c.f, 30)} ${pad(c.h.toFixed(2), 6)} h  Ruf ${pad(Math.round(c.rep), 8)}  faction_rep ${c.frm.toFixed(4)}`);
  const a = curve[curve.length - 2], b = curve[curve.length - 1], c0 = curve[curve.length - 3];
  const r1 = (b.rep - a.rep) / (b.h - a.h), r0 = (a.rep - c0.rep) / (a.h - c0.h);
  console.log(`  Rate zuletzt ${Math.round(r0)}/h (${c0.h.toFixed(2)}-${a.h.toFixed(2)} h) und ${Math.round(r1)}/h (${a.h.toFixed(2)}-${b.h.toFixed(2)} h).`);
  // Fortschreibung: Rate(t) = r1 + g (t - tb), g aus {0, 40k, 80k}/h^2 (B: "+40k/h je Stunde")
  const tAt = (target, g) => {
    let t = b.h, rep = b.rep, dt = 0.001;
    while (rep < target && t < 40) { rep += (r1 + g * (t - b.h)) * dt; t += dt; }
    return t;
  };
  const HT = 4.051289e6; // $/s, B 5F (12 Mitglieder 08:24, alle Human Trafficking)
  const base = 36e9;
  // Gang-Alter am ersten Tor: B nimmt 13 h (Gruendung = Knotenstart). Gemessen BN2.1 Zyklus 1:
  // Kampfwerte >= 100 schon bei 0,85 h (Backup 05:33: 119/119/120/120) -> Tor = fertig + 12 h
  // (lib/endspurt.js:322-331) ~ 12,5-12,9 h Knotenzeit; Slum Snakes erst zwischen 0,85 h
  // (Karma -6,2, nicht beigetreten) und 1,85 h (Karma -9,2, beigetreten) -> Gang-Alter am Tor 10,7-12,0 h.
  for (const gateH of [11.0, 12.0, 13.0]) {
  console.log(`\n  Umschaltzeit und Geld am Tor (Tor ${gateH} h nach Gruendung, Basisgeld ${mrd(base, 0)} Mrd, HT ${(HT / 1e6).toFixed(2)} M$/s, Typhoon):`);
  console.log(`    ${padR("g [Ruf/h^2]", 14)}${padR("R=1,275 Mio: t / Geld / x", 34)}${padR("R=1,6575 Mio: t / Geld / x", 34)} Differenz`);
  const p0 = planOf(freshState(1.275e6), base);
  console.log(`    ohne Gang-Geld: ${mrd(base, 0)} Mrd -> x${p0.gain.toFixed(2)}`);
  for (const g of [0, 40e3, 80e3]) {
    const tLo = tAt(1.275e6, g), tHi = tAt(rA, g);
    const mLo = base + HT * 3600 * Math.max(0, gateH - tLo), mHi = base + HT * 3600 * Math.max(0, gateH - tHi);
    const pLo = planOf(freshState(1.275e6 + 11 * 3600 * Math.max(0, gateH - tLo)), mLo);
    const pHi = planOf(freshState(rA + 11 * 3600 * Math.max(0, gateH - tHi)), mHi);
    console.log(`    ${padR(Math.round(g), 14)}${padR(`${tLo.toFixed(2)} h / ${mrd(mLo, 1)} Mrd / x${pLo.gain.toFixed(2)}`, 34)}${padR(`${tHi.toFixed(2)} h / ${mrd(mHi, 1)} Mrd / x${pHi.gain.toFixed(2)}`, 34)} ${(tHi - tLo).toFixed(2)} h, ${mrd(mLo - mHi, 1)} Mrd, ln ${Math.log(pLo.gain / pHi.gain).toFixed(3)}`);
  }
  }
  // Vorkaeufe vor der Gruendung (BN2.1 Zyklus 1: Wired Reflexes + Neurotrainer I schon bei 0,85 h,
  // EsperTech Eyewear bei 2,85 h) - der Kaufaufschub (bn4rep.js Block 1c) greift erst mit inGang.
  console.log(`\n  Vorkaeufe vor der Gruendung: Runde mit q0 wartenden Stuecken (Preis x1,9^q0), Ruf 1,275 Mio, Typhoon:`);
  const preNames = ["Wired Reflexes", "Neurotrainer I", "EsperTech Bladeburner Eyewear"];
  for (const M of [36, 63, 100]) {
    const cells = [];
    for (let q = 0; q <= 3; q++) {
      const owned = preNames.slice(0, q);
      const s = freshState(1.275e6, owned);
      const cands = buildCandidates({ joined: JOINED, repOf: (f) => (f === "Slum Snakes" ? 1.275e6 : 0), owned: new Set(owned), queued: q,
        combatAugs: bot.COMBAT_AUGS, sfLevel2: s1901.sf[2] });
      const p = planOf({ ...s, cands }, M * 1e9);
      // Competence inkl. der Vorkaeufe (sie wirken ja mit), gegen "nichts gekauft"
      const allCands = buildCandidates({ joined: JOINED, repOf: () => 1e9, owned: new Set(), queued: 0, combatAugs: bot.COMBAT_AUGS, sfLevel2: s1901.sf[2] });
      const model = makeRoundModel(bot, allCands, new Set(), freshState(1e9));
      cells.push(`q0=${q}: x${(model.comp(new Set(owned.concat(p.seq))) / model.base).toFixed(2)}`);
    }
    console.log(`    Geld ${pad(M, 4)} Mrd   ${cells.join("   ")}`);
  }
  // Faktionsruf-Mult im frischen Knoten: die NFG-Stufen fallen auf die SF12-Stufe zurueck
  // (Prestige.ts:255-256, SF12.3 -> 3 Stufen); in BN2.1 waren es bis 07:05 sechs (B 1e').
  console.log(`  Faktionsruf-Mult im frischen Knoten: NFG 6 -> 3 Stufen (SF12.3, Prestige.ts:255), faction_rep 1,3683 / 1,01^3 = ${(1.3683 / Math.pow(1.01, 3)).toFixed(4)} -> Rate ~3 % tiefer, t eher spaeter.`);
}

// ---------------------------------------------------------------------------
// 3. Torfrequenz (nur Competence; Preisfaktor 1,9^i beginnt nach jedem Einbau neu)
// ---------------------------------------------------------------------------
function section3() {
  console.log(hr("3. TORFREQUENZ: EINE RUNDE MIT M GEGEN ZWEI MIT M/2 (echte waehleTorRunde, frischer Knoten, Ruf unbegrenzt)"));
  console.log(`  Competence = Black-Op-Competence (Typhoon-Gewichte) mit ALLEN gekauften Stuecken / ohne, gleicher Ausgangszustand.`);
  console.log(`  Runde 2 plant mit den Stuecken aus Runde 1 als besessen (startMults = ihre Faktoren, Preisstufe q0 = 0 nach dem Einbau).`);
  const model = makeRoundModel(bot, freshState(1e9).cands, new Set(), freshState(1e9));
  const total = (names) => model.comp(new Set(names)) / model.base;
  const rows = [];
  for (const M of [20, 36, 50, 75, 100, 150, 300]) {
    const one = planOf(freshState(1e9), M * 1e9);
    let owned = [], cost = 0;
    for (let k = 0; k < 2; k++) { const p = planOf(freshState(1e9, owned), M / 2 * 1e9); owned = owned.concat(p.seq); cost += p.cost; }
    const two = { names: owned, cost };
    owned = []; cost = 0;
    for (let k = 0; k < 3; k++) { const p = planOf(freshState(1e9, owned), M / 3 * 1e9); owned = owned.concat(p.seq); cost += p.cost; }
    const three = { names: owned, cost };
    rows.push([M, one, two, three]);
  }
  console.log(`    ${padR("Geld M", 9)}${padR("1 Runde: n / x", 22)}${padR("2 x M/2: n / x", 22)}${padR("3 x M/3: n / x", 22)}  1 Runde braeuchte fuer x(2xM/2)`);
  for (const [M, one, two, three] of rows) {
    const x2 = total(two.names);
    // welches Budget braucht EINE Runde fuer dieselbe Competence?
    let need = M * 1e9;
    while (planOf(freshState(1e9), need).gain < x2 && need < 1e15) need *= 1.05;
    console.log(`    ${padR(M + " Mrd", 9)}${padR(`${one.seq.length} / x${total(one.seq).toFixed(2)}`, 22)}${padR(`${two.names.length} / x${x2.toFixed(2)}`, 22)}${padR(`${three.names.length} / x${total(three.names).toFixed(2)}`, 22)}  ${need >= 1e15 ? "> 1e6 Mrd" : mrd(need, 0) + " Mrd"}`);
  }
  // Mit Rufdeckel: Runde 1 bei 1,275 Mio, Runde 2 nach dem Einbau (Ruf wieder ab 0, Favor gestiegen) nur 0,25 / 0,5 Mio
  console.log(`\n  Mit Rufdeckel (Runde 1: 1,275 Mio; Runde 2 nach dem Einbau nur R2, weil der Faktionsruf bei 0 beginnt):`);
  console.log(`    ${padR("Geld M", 9)}${padR("1 Runde (1,275 Mio)", 22)}${padR("2 x M/2, R2 0,25 Mio", 24)}${padR("2 x M/2, R2 0,5 Mio", 24)} Rufbedarf Runde 2 ohne Deckel`);
  for (const M of [36, 75, 100, 150]) {
    const one = planOf(freshState(1.275e6), M * 1e9);
    const res = [];
    for (const r2 of [0.25e6, 0.5e6]) {
      const p1 = planOf(freshState(1.275e6), M / 2 * 1e9);
      const p2 = planOf(freshState(r2, p1.seq), M / 2 * 1e9);
      res.push(`${p1.seq.length}+${p2.seq.length} / x${total(p1.seq.concat(p2.seq)).toFixed(2)}`);
    }
    const p1 = planOf(freshState(1.275e6), M / 2 * 1e9);
    const p2u = planOf(freshState(1e9, p1.seq), M / 2 * 1e9);
    console.log(`    ${padR(M + " Mrd", 9)}${padR(`${one.seq.length} / x${total(one.seq).toFixed(2)}`, 22)}${padR(res[0], 24)}${padR(res[1], 24)} ${(maxRepOfPlan(p2u) / 1e6).toFixed(3)} Mio`);
  }
  console.log(`  Kontrolle: x(1 Runde) aus total() = gain der Planung? ${(() => { const p = planOf(freshState(1e9), 75e9); return total(p.seq).toFixed(4) + " / " + p.gain.toFixed(4); })()}`);
  console.log(`  NICHT gerechnet: Kosten eines zusaetzlichen Einbaus (Wiederaufbau: frischer Knoten Zyklus 1 3,1 h, BN2.1 Zyklus 3 486 s;`);
  console.log(`  Hacking- und Parkneuaufbau; Faktionsruf auf 0, Favor steigt; Gang-Aufstiegspunkte x0,95, GangConstants InstallAscensionPenalty).`);
}

// ---------------------------------------------------------------------------
// 4. Ruecklage: Luecke zwischen Konto und Planrunde
// ---------------------------------------------------------------------------
function section4() {
  console.log(hr("4. RUECKLAGE = KOSTEN DER PLANRUNDE (bn4rep.js:2288-2291): FREIES GELD UEBER DER RUECKLAGE"));
  const s = freshState(3e6);
  console.log(`  frischer Knoten (Ruf 3 Mio, Typhoon): Konto M -> Planrunde P(M), frei M - P(M), und P(P(M)) (Fixpunkt?)`);
  for (const M of [10, 20, 36, 50, 75, 100, 150, 200, 300, 400, 600]) {
    const p = planOf(s, M * 1e9);
    const pp = planOf(s, p.cost);
    console.log(`    M ${pad(M, 4)} Mrd  P ${pad(mrd(p.cost, 1), 7)}  frei ${pad(mrd(M * 1e9 - p.cost, 1), 6)} Mrd (${pad(((1 - p.cost / (M * 1e9)) * 100).toFixed(0), 3)} %)  P(P(M)) ${pad(mrd(pp.cost, 1), 7)} ${Math.abs(pp.cost - p.cost) < 1 ? "Fixpunkt" : "KEIN Fixpunkt"}`);
  }
}

if (show(1)) await section1();
if (show(2)) section2();
if (show(3)) section3();
if (show(4)) section4();
