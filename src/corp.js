/**
 * corp.js - Koordinator des Corporation-Gewerks in BitNode 3 (Plan C).
 *
 * ===========================================================================
 * WAS ES TUT (Etappe 1)
 * ===========================================================================
 * Gruendung (createCorporation(name, false), F1) -> Agriculture in 6 Staedten
 * -> fester Ausbau (Smart Storage 2, Smart Factories bis 13, Werbung bis 6,
 * Rest Boost-Material) -> Runde 1 nach ~0,5 h (11 Zyklen vorher keine
 * Langfrist-Ausgabe, F3) -> Export-Freischaltung -> Tobacco (Hauptbuero Aevum
 * 15 Koepfe, 5 Nebenbueros) -> Agri-Bueros auf 8. Danach wartet es auf
 * Etappe 2 (Produkte, Runden 2-4).
 *
 * Vorbild ist der Simulator-Treiber nodes/corp-2026-10-05/sim/corpsim.ts,
 * Szenario C4B_KF (agriFixed, lagK, Reihenfolge Export -> Tobacco ->
 * Agri-Bueros 8 -> Chemical). Abweichungen sind im Kopf von corplib.js bzw.
 * corp-tick.js begruendet (Preis aus gemessenem Absatz statt Interna).
 *
 * ===========================================================================
 * ARCHITEKTUR (RAM)
 * ===========================================================================
 * Dieser Koordinator liest nur (getCorporation, getDivision, getOffice,
 * getWarehouse, getUpgradeLevel = 5 x 10 GB) und plant. Jede AKTION laeuft in
 * einem Einmal-Skript (corp-act-*.js, corp-tick.js, je <= 81,6 GB), gestartet
 * per ns.exec auf einem Wirt mit freiem RAM - zuerst dem eigenen (die Werkbank
 * haelt laut bn4net.js:1631-1648 mindestens das groesste Registry-Werkzeug
 * frei), dann home, dann jedem anderen. Ergebnis kommt ueber Port 3031 zurueck.
 * Kosten werden lokal aus den Spielformeln gerechnet (corplib.js, im
 * Simulator gegen die echten get*Cost-Funktionen geeicht) - das spart die
 * Getter.
 *
 * ===========================================================================
 * NEUSTART-FEST
 * ===========================================================================
 * Skripte sterben bei jedem Augmentierungs-Einbau (F8). Der ganze Plan-Zustand
 * steht in data/corp-state.txt (home); jeder Zyklus plant aus dem ECHTEN
 * Spielzustand neu (Soll gegen Ist), es gibt keine "halb erledigten" Schritte.
 * Ein Knotenwechsel (neues BN3.x) loescht die Corp; der Zustand haengt an
 * getResetInfo().lastNodeReset und wird dann verworfen.
 * Uhr: Corp-Zyklen (je START), nicht Wanduhr - Offline-Nachholen (K5) und
 * gedrosselter Tab (F14) laufen so in derselben Uhr wie die Corp selbst.
 * Zyklen, die verstreichen, waehrend das Skript tot ist, zaehlen nicht mit;
 * das verschiebt Zeitschwellen nur nach hinten (sicher).
 *
 * Telemetrie: data/corp.json (Herzschlag v2 + Corp-Felder), Ereignisse:
 * data/corp-log.txt (letzte 300 Zeilen).
 */
import {
  CORP_VERSION, CITIES, MAIN_CITY, JOBS, RESULT_PORT, STATE_FILE, TELEMETRY_FILE, EVENT_FILE,
  FAMILY, TICK_SCRIPT, TICKP_SCRIPT, LIBS, INDUSTRY, UPGRADES, UNLOCK_COST, OFFICE_INITIAL_COST, WAREHOUSE_INITIAL_COST,
  RESEARCH, RESEARCH_ORDER, researchMults, CHEM_MIX,
  upgradeCost, officeUpCost, warehouseUpCost, adCost, officeProductivity, agriMix, TOB_MAIN_MIX, TOB_SUP_MIX,
  officeOps, liquidationValue, fmt, ignitedSmooth, publicValuationEstimate,
} from "lib/corplib.js";
import { block, fehler } from "lib/herzschlag.js";
import { liesVonHome, nachHome, haengeAnHome } from "lib/hostdatei.js";

const CORP_NAME = "Losferatos";
const AGRI = "Agri";
const TOB = "Tob";
const CHEM = "Chem";
// Geld-Schnittstelle zum restlichen Bot (Etappe 3, Einzelheiten im Kopf von financeWork):
const MONEY_REQUEST_FILE = "data/corp-geld.txt"; // {"betrag": $, "ts": ms, "von": "..."} - Anforderung, 2 h gueltig
const MONEY_RESERVE_FILE = "data/geldbedarf.txt"; // Ruecklage von bn4rep.js (Torrunde), Zahl in $
const BN4REP_FILE = "data/bn4rep.json"; // ziel/preis/offen/offenJeFaktion fuer Vorgabe und Bestechung
/** Optionale Stellschrauben (JSON auf home), z. B. {"maxRound":4,"shares":{...},"taMult":1} - ohne Datei gelten die Vorgaben */
const CONFIG_FILE = "data/corp-config.txt";
/** Zeitpunkte der Runden in Stunden Corp-Zeit (strategie.md Abschnitt 5 + Skeptiker-Korrektur 2) */
const ROUND_HOURS = [0.5, 2.5, 4.5, 8.5];
/** Mindestbetrag je Runde, darunter wird gewartet (Runde 1: Simulator 131-134 Mrd) */
const ROUND_MIN_FUNDS = [100e9, 250e9, 500e9, 5e12];
/** Etappe 2: alle vier Runden (IPO/Verkauf ist Etappe 3) */
const MAX_ROUND = 4;
/** Vorgabe-Etappe ohne Konfigurationsdatei: 1 = nach Tobacco + Agri-Bueros 8 warten */
const ETAPPE = 1;
const CYCLES_PER_HOUR = 360;
const AGRI_RESERVE = 2e9;

/** @param {NS} ns */
// Woertlich hier, damit tools/registry-bauen.js (Schreiberprobe) den
// Schreiber der Telemetrie findet; gleich lib/corplib.js TELEMETRY_FILE.
const TELEMETRY_PATH = "data/corp.json";

export async function main(ns) {
  ns.disableLog("ALL");
  const c = ns.corporation;
  const host = ns.getHostname();
  const tele = { round: 0, okRound: 0, errStreak: 0, lastError: null, state: "work", blockedReason: null };
  const ri = ns.getResetInfo();
  if (ri.currentNode !== 3) {
    // Nur BN3: ausserhalb kostet die Gruendung 150 Mrd Spielergeld (helpers.ts:30-44)
    writeTele(ns, host, ri, tele, { state: "done", blockedReason: "not_executable" }, null);
    return;
  }
  let st = loadState(ns, ri);
  // Nach einem Neustart (Einbau, Kern) sind Zyklen unbeobachtet vergangen, Preise/Einkauf standen still.
  // Die Bewertung ist ein 10-Zyklen-Mittel (Corporation.ts:226-232) - vor einer Runde deshalb wieder
  // 11 beobachtete Zyklen abwarten (Neustart-Probe 06.10.: sofortige Annahme brachte 325 statt 393 Mrd).
  st.lastLT = Math.max(st.lastLT, st.cycle);
  // ... und das 30-Zyklen-Fenster des Stopps in BEOBACHTETEN Zyklen neu zaehlen
  if (st.freeze) st.freezeAt = st.cycle;
  // Herzschlag (Skeptiker E1 #3): bn4net.js:3627-3662 beendet Werkzeuge nach dem Wanduhr-Alter ihrer
  // Telemetrie. Im verdeckten Tab dauert ein Corp-Zyklus Minuten (F14); deshalb schreibt corp.js auch
  // WAEHREND des Wartens auf nextUpdate und waehrend der Einmal-Skripte alle 30 s.
  const rt = { jobSeq: 0, hosts: null, hostsAt: -1, failStreak: 0, failReason: null, lastBeat: 0 };
  rt.beat = (force) => {
    if (!force && Date.now() - rt.lastBeat < 30000) return;
    rt.lastBeat = Date.now();
    writeTele(ns, host, ri, tele, rt.failStreak >= 3 ? { state: "blocked", blockedReason: rt.failReason } : {}, st);
  };

  while (true) {
    tele.round++;
    try {
      if (!c.hasCorporation()) {
        const r = await runOps(ns, rt, [["cc", CORP_NAME]]);
        // nur den ersten Fehlschlag protokollieren (sonst flutet der 10-s-Takt das Protokoll)
        if (!rt.foundLogged) logEvent(ns, st, `Gruendung: ${JSON.stringify(r.ret)} ${r.err.join("; ")}`);
        rt.foundLogged = true;
        if (!c.hasCorporation()) {
          tele.state = "blocked";
          tele.blockedReason = "no_corp";
          writeTele(ns, host, ri, tele, {}, st);
          await ns.sleep(10000);
          continue;
        }
        st = freshState(ri);
        saveState(ns, st);
      }
      // nextUpdate gegen einen 60-s-Schlaf: dazwischen Herzschlag, das Versprechen bleibt dasselbe.
      // ns.asleep, NICHT ns.sleep: sleep markiert das Skript als beschaeftigt (runningFn), und jeder
      // ns-Aufruf nach dem frueher fertigen nextUpdate wuerde mit "Concurrent calls" das Skript toeten
      // (NetscriptHelpers.tsx:398-416); asleep ist davon ausgenommen (NetscriptFunctions.ts:259-265).
      const upd = c.nextUpdate();
      let prev = null;
      if (noFix(st, "beat")) prev = await upd;
      else for (;;) {
        prev = await Promise.race([upd, ns.asleep(60000).then(() => null)]);
        if (prev !== null) break;
        rt.beat(true);
      }
      if (prev !== "START") continue;
      st.cycle++;
      await cycleWork(ns, rt, st);
      tele.okRound++;
      tele.errStreak = 0;
      tele.state = st.waiting ? "wait" : "work";
      tele.blockedReason = null;
    } catch (e) {
      tele.errStreak++;
      tele.lastError = { ...fehler(e), at: Date.now() };
      await ns.sleep(1000);
    }
    saveState(ns, st);
    // dauerhaft kein Platz / exec scheitert -> sichtbar als blocked (Skeptiker E1 #10)
    rt.beat(true);
  }
}

// ======================================================================== Zustand
function freshState(ri) {
  return {
    v: 1,
    nodeReset: ri.lastNodeReset,
    cycle: 0,
    foundCycle: 0,
    lastLT: -999,
    freeze: false,
    roundsDone: 0,
    rounds: [],
    stage: "agri0",
    unlocks: [],
    boost: {},
    price: {},
    errors: [],
    events: 0,
    next: "",
    waiting: false,
    snap: null,
  };
}
function loadState(ns, ri) {
  try {
    const s = JSON.parse(liesVonHome(ns, STATE_FILE) || "null");
    if (s && s.v === 1 && s.nodeReset === ri.lastNodeReset) return s;
  } catch {
    /* kaputt -> neu */
  }
  return freshState(ri);
}
function saveState(ns, st) {
  nachHome(ns, STATE_FILE, JSON.stringify(st));
}
function logEvent(ns, st, text) {
  const h = ((st.cycle - st.foundCycle) / CYCLES_PER_HOUR).toFixed(2);
  st.events++;
  haengeAnHome(ns, EVENT_FILE, `${new Date().toISOString()} z${st.cycle} ${h}h ${text}\n`, 300);
}
function writeTele(ns, host, ri, tele, over, st) {
  const extra = {};
  if (st && st.snap) Object.assign(extra, st.snap);
  if (st) {
    extra.stage = st.stage;
    extra.cycle = st.cycle;
    extra.corpHours = +((st.cycle - st.foundCycle) / CYCLES_PER_HOUR).toFixed(3);
    extra.fundingRounds = st.roundsDone;
    extra.roundLog = st.rounds;
    extra.next = st.next;
    extra.errors = st.errors.slice(-5);
  }
  const b = block({
    wall: Date.now(),
    round: tele.round,
    okRound: tele.okRound,
    errStreak: tele.errStreak,
    lastError: tele.lastError,
    nodeReset: ri.lastNodeReset,
    augReset: ri.lastAugReset,
    host,
    version: CORP_VERSION,
    state: over.state || tele.state,
    blockedReason: over.blockedReason !== undefined ? over.blockedReason : tele.blockedReason,
    extra,
  });
  nachHome(ns, TELEMETRY_PATH, JSON.stringify(b));
}

// ======================================================================== Ausfuehrung
/** Wirte fuer Einmal-Skripte: eigener zuerst, dann home, dann der Rest (BFS ueber scan) */
function hostList(ns, rt) {
  if (rt.hosts && rt.jobSeq - rt.hostsAt < 500) return rt.hosts;
  const seen = new Set(["home"]);
  const queue = ["home"];
  while (queue.length) {
    const h = queue.shift();
    for (const n of ns.scan(h)) {
      if (seen.has(n)) continue;
      seen.add(n);
      queue.push(n);
    }
  }
  const self = ns.getHostname();
  const rest = [...seen].filter((h) => h !== self && h !== "home" && ns.hasRootAccess(h));
  rest.sort((a, b) => ns.getServerMaxRam(b) - ns.getServerMaxRam(a));
  rt.hosts = [self, ...(self === "home" ? [] : ["home"]), ...rest];
  rt.hostsAt = rt.jobSeq;
  return rt.hosts;
}
function pickHost(ns, rt, need) {
  for (const h of hostList(ns, rt)) {
    const free = ns.getServerMaxRam(h) - ns.getServerUsedRam(h);
    // home behaelt 16 GB fuer die Kernwerkzeuge (Waechter, Wachhalter)
    if (free - (h === "home" ? 16 : 0) >= need) return h;
  }
  return null;
}
async function runScript(ns, rt, script, order) {
  // Job-ID mit eigener PID: Ergebnisse eines frueheren corp.js-Laufs auf dem Port passen nie (Skeptiker E1 #6)
  order.job = `${ns.pid}:${++rt.jobSeq}`;
  const r = await runScriptInner(ns, rt, script, order);
  const hard = (r.err || []).find((e) => /^(no_space|exec |scp |timeout )/.test(e));
  if (hard) {
    rt.failStreak++;
    rt.failReason = hard.startsWith("no_space") ? "no_space" : hard.split(" ")[0];
  } else rt.failStreak = 0;
  return r;
}
async function runScriptInner(ns, rt, script, order) {
  rt.execs = (rt.execs || 0) + 1;
  const need = ns.getScriptRam(script, "home");
  if (!(need > 0)) return { ok: 0, err: [`${script} fehlt auf home`], ret: [] };
  const h = pickHost(ns, rt, need);
  if (!h) return { ok: 0, err: [`no_space ${script} ${need} GB`], ret: [] };
  // scp WIRFT NICHT bei Fehler, nur der Rueckgabewert zaehlt (lib/hostdatei.js Fallstrick 1, Skeptiker E1 #7)
  if (h !== "home" && ns.scp([script, ...LIBS], h, "home") !== true) return { ok: 0, err: [`scp ${script}->${h} fehlgeschlagen`], ret: [] };
  const pid = ns.exec(script, h, 1, JSON.stringify(order));
  if (!pid) return { ok: 0, err: [`exec ${script}@${h} fehlgeschlagen`], ret: [] };
  // Frist nach Wanduhr, nicht nach Schleifenzahl: im gedrosselten Tab dauert ein sleep(20) eine Sekunde+
  const t0 = Date.now();
  for (;;) {
    for (;;) {
      const raw = ns.readPort(RESULT_PORT);
      if (raw === "NULL PORT DATA") break;
      try {
        const r = JSON.parse(String(raw));
        if (r.job === order.job) return r;
      } catch {
        /* fremd/kaputt */
      }
    }
    if (Date.now() - t0 > 180000) break;
    rt.beat(false);
    await ns.sleep(20);
  }
  return { ok: 0, err: [`timeout ${script} job ${order.job}`], ret: [] };
}
/** Ops der Reihe nach; aufeinanderfolgende Ops derselben Familie in EINEM Skriptlauf */
async function runOps(ns, rt, ops) {
  const all = { ok: 0, err: [], ret: [] };
  let i = 0;
  while (i < ops.length) {
    const script = FAMILY[ops[i][0]];
    let j = i;
    while (j < ops.length && FAMILY[ops[j][0]] === script) j++;
    const r = await runScript(ns, rt, script, { ops: ops.slice(i, j) });
    all.ok += r.ok || 0;
    all.err.push(...(r.err || []));
    // je Op genau ein Ergebnis, auch wenn das Skript gar nicht lief (Ausrichtung fuer applyResults)
    const ret = r.ret || [];
    for (let k = 0; k < j - i; k++) all.ret.push(k < ret.length ? ret[k] : { error: (r.err && r.err[0]) || "kein Ergebnis" });
    i = j;
  }
  return all;
}

// ======================================================================== Lesen
function readSnapshot(ns) {
  const c = ns.corporation;
  const corp = c.getCorporation();
  const snap = { corp, div: {}, up: {}, dummies: 0 };
  for (const dn of corp.divisions) {
    // Dummy-Divisionen (Bewertungshebel vor Runden) werden nicht gelesen: 6 Getter je Stadt fuer nichts
    if (dn.startsWith("Dummy")) {
      snap.dummies++;
      continue;
    }
    const d = c.getDivision(dn);
    const o = {}, w = {}, pr = {};
    for (const city of d.cities) {
      o[city] = c.getOffice(dn, city);
      try {
        w[city] = c.getWarehouse(dn, city);
      } catch {
        w[city] = null;
      }
    }
    if (d.makesProducts && d.cities.includes(MAIN_CITY)) for (const p of d.products) pr[p] = c.getProduct(dn, MAIN_CITY, p);
    snap.div[dn] = { info: d, office: o, wh: w, products: pr };
  }
  for (const u of Object.keys(UPGRADES)) snap.up[u] = c.getUpgradeLevel(u);
  // Die Rundenzahl kommt aus dem SPIEL, nicht aus der Zustandsdatei (Skeptiker E1 #2):
  // getInvestmentOffer().round = fundingRound + 1 (Corporation.ts:333-354)
  snap.offer = c.getInvestmentOffer();
  return snap;
}
function readConfig(ns, st) {
  if (st.cfgAt !== undefined && st.cycle - st.cfgAt < 30) return;
  st.cfgAt = st.cycle;
  try {
    st.cfg = JSON.parse(liesVonHome(ns, CONFIG_FILE) || "{}") || {};
  } catch {
    st.cfg = {};
  }
}

// ======================================================================== Planung
async function cycleWork(ns, rt, st) {
  readConfig(ns, st);
  rt.cycles = (rt.cycles || 0) + 1;
  const execs0 = rt.execs || 0;
  const snap = readSnapshot(ns);
  const corp = snap.corp;
  const gameRounds = Math.min(4, Math.max(0, snap.offer.round - 1));
  if (gameRounds !== st.roundsDone && !noFix(st, "round")) {
    logEvent(ns, st, `Rundenzahl aus dem Spiel: ${gameRounds} (Zustand hatte ${st.roundsDone})`);
    st.roundsDone = gameRounds;
    st.freeze = false;
  }
  const P = new Planner(st, snap);

  // --- Runden (setzt ggf. den Ausgabenstopp und plant Dummies)
  const roundOps = P.tryRound();
  // --- Belegschaft: Tee/Feier unter Schwelle (F12: nicht jeden Zyklus, kostet 500k/Kopf).
  // Im Ausgabenstopp vor einer Runde erst ab 15 Punkten Abfall: eine Tee-/Feierrunde fuer alle
  // Bueros kostet mehr als ein Zyklus Gewinn, assetDelta faellt auf ~0 und die Zyklusbewertung auf
  // ~10 Mrd + Fonds/3 (Corporation.ts:209-216). Gemessen 06.10. (Neustart-Probe vor Runde 2):
  // nach 18 unbeobachteten Zyklen tranken alle Bueros gleichzeitig, Runde 2 fiel von 393 auf 261 Mrd.
  // Erster Zyklus nach einem Start: immer Schwelle 2 - nach unbeobachteten Zyklen (Einbau) ist die Energie
  // abgesunken; mit Schwelle 15 bliebe sie im Stopp niedrig und das Angebot dauerhaft schlechter
  // (Neustart-Probe 06.10.: 321 statt 393 Mrd). Das Tee-Loch faellt per LT aus dem Annahme-Mittel (F2).
  const slack = st.freeze && rt.cycles > 1 ? 15 : 2;
  let careInFreeze = false;
  for (const [dn, d] of Object.entries(snap.div)) {
    // AutoBrew/AutoPartyManager halten Energie/Moral selbst (ResearchMap.ts AutoBrew/AutoPartyManager, Skeptiker E2 F6)
    const rs = (st.rsDone || {})[dn] || [];
    for (const [city, o] of Object.entries(d.office)) {
      if (o.numEmployees === 0) continue;
      if (!rs.includes("AutoBrew") && o.avgEnergy < o.maxEnergy - slack) P.ops.push(["te", dn, city]);
      if (!rs.includes("AutoPartyManager") && o.avgMorale < o.maxMorale - slack) P.ops.push(["pa", dn, city, 2e5]);
      careInFreeze ||= (st.freeze || rt.cycles === 1) && P.ops.length > 0;
    }
  }
  // Tee/Feier im Stopp: das Loch muss aus dem 10-Zyklen-Mittel der Annahme heraus (Skeptiker E2 F2)
  if (careInFreeze && !noFix(st, "careLT")) P.LT();
  // --- Aufbau / Wachstum
  if (!st.freeze) {
    if (!snap.div[AGRI] || P.agriIncomplete()) P.setupAgri();
    else if (st.roundsDone === 0) P.growAgriFixed(AGRI_RESERVE);
    else P.phase2();
  }
  // --- Reihenfolge (Skeptiker E2 F4): Takt-Skripte ZUERST (im verdeckten Tab ist jedes exec teuer und
  // der Takt ist das Zeitkritische), danach die Struktur-Ops nach Familie gebuendelt.
  // --- Takt Material + Boosts (Agri, Chem, Tob)
  const tick = P.tickOrder();
  let routeOps = [], book = {};
  if (tick.divs.length) {
    const r = await runScript(ns, rt, TICK_SCRIPT, tick);
    noteErrors(st, r.err);
    if (r.price) st.price = r.price;
    if (r.boost) for (const [dn, b] of Object.entries(r.boost)) st.boost[dn] = b;
    if (r.diag) {
      st.flow = summarizeFlow(r.diag);
      ({ ops: routeOps, book } = P.routeOps(r.diag));
    }
  }
  // --- Takt Produkte
  const tob = snap.div[TOB];
  if (tob) {
    // in diesem Zyklus eingestellte Produkte nicht mehr anfassen (getProduct wuerde werfen)
    const gone = new Set(P.ops.filter((o) => o[0] === "dp").map((o) => o[2]));
    const fin = Object.entries(tob.products).filter(([n, p]) => p.developmentProgress >= 100 && !gone.has(n)).map(([n]) => n);
    if (fin.length) {
      const ta2 = (st.rsDone[TOB] || []).includes("Market-TA.II") && st.cfg.ta2 !== false;
      const fill = {};
      for (const city of tob.info.cities) fill[city] = st.cfg.forceFill ?? (tob.wh[city] ? tob.wh[city].sizeUsed / tob.wh[city].size : 0);
      const r = await runScript(ns, rt, TICKP_SCRIPT, { div: TOB, cities: tob.info.cities, products: fin, ta2, fill, price: st.pprice || {}, noFixLimit: noFix(st, "limit") });
      noteErrors(st, r.err);
      if (r.price) st.pprice = r.price;
    }
  }
  if (routeOps.length) {
    const rr = await runOps(ns, rt, routeOps);
    noteErrors(st, rr.err);
    // erst nach erfolgreichem exportMaterial als gesetzt buchen (Skeptiker E1 #8)
    routeOps.forEach((op, i) => {
      if (op[0] !== "ex" || (rr.ret[i] && rr.ret[i].error)) return;
      const b = book[i];
      (st.routes[b.city] ??= {})[b.key] = b.w;
    });
  }
  if (P.ops.length) {
    const ordered = noFix(st, "bundle") ? P.ops : bundleOps(P.ops);
    const r = await runOps(ns, rt, ordered);
    noteErrors(st, r.err);
    P.applyResults(r, ordered);
  }
  if (roundOps.length) {
    const r = await runOps(ns, rt, roundOps);
    noteErrors(st, r.err);
    const res = r.ret[0];
    if (res && res.accepted) {
      st.roundsDone = Math.max(st.roundsDone, res.offer.round);
      st.freeze = false;
      st.rounds.push({ k: st.roundsDone, h: +P.hours.toFixed(3), funds: res.offer.funds, shares: res.offer.shares, valuation: corp.valuation });
      P.events.push(`Runde ${res.offer.round}: ${fmt(res.offer.funds)} fuer ${fmt(res.offer.shares)} Anteile (Bewertung ${fmt(corp.valuation)})`);
    } else if (res && res.offer) {
      st.next = `Runde ${st.roundsDone + 1}: Angebot ${fmt(res.offer.funds)} (Runde ${res.offer.round}) abgelehnt, warte`;
    }
  }
  for (const e of P.events) logEvent(ns, st, e);
  // --- Etappe 3: Zuendung, Boersengang, Verkauf nach Bedarf, Bestechung - nur mit {"etappe":3}
  if (P.etappe() >= 3) await financeWork(ns, rt, st, snap, P);

  // --- Kennzahlen
  st.execHist ??= [];
  st.execHist.push((rt.execs || 0) - execs0);
  if (st.execHist.length > 60) st.execHist.shift();
  st.snap = {
    execsPerCycle: +(st.execHist.reduce((a, b) => a + b, 0) / st.execHist.length).toFixed(2),
    funds: corp.funds,
    valuation: corp.valuation,
    revenue: corp.revenue,
    expenses: corp.expenses,
    public: corp.public,
    owned: corp.numShares / corp.totalShares,
    liquidation: liquidationValue(corp.valuation, corp.numShares, corp.totalShares),
    divisions: corp.divisions.length,
    dummies: snap.dummies,
    products: tob ? Object.entries(tob.products).map(([n, p]) => `${n}:${p.developmentProgress >= 100 ? Math.round(p.rating) : Math.round(p.developmentProgress) + "%"}`) : [],
    wilson: snap.up["Wilson Analytics"],
    tobAds: tob ? tob.info.numAdVerts : 0,
    tobMain: tob && tob.office[MAIN_CITY] ? tob.office[MAIN_CITY].size : 0,
    rsDone: st.rsDone,
    finance: st.fin ? { phase: st.fin.phase, need: st.fin.need, target: st.fin.target, targetWhy: st.fin.targetWhy, sales: (st.fin.sales || []).slice(-5), soldTotal: st.fin.soldTotal, bribedTotal: st.fin.bribedTotal, ignitedAt: st.fin.ignitedAt, ipo: st.fin.ipo, cooldownSec: corp.shareSaleCooldown / 5 } : null,
  };
}
/** Nur fuer den Testnachweis (rot ohne Fix): data/corp-config.txt {"noFix":["freeze","round","beat"]} */
function noFix(st, name) {
  return !!(st && st.cfg && Array.isArray(st.cfg.noFix) && st.cfg.noFix.includes(name));
}
// ======================================================================== Etappe 3: Geld an den Spieler
/**
 * ZUENDUNG: Minimum der letzten 30 Zyklus-Bewertungen >= 1e15 (corplib.ignitedSmooth) und alle vier
 * Runden durch. Notausgang: {"ipoEarly":true} erlaubt den Boersengang schon nach Runde 3, sobald Geld
 * angefordert ist (Skeptiker-Korrektur 2).
 *
 * WIEVIEL: Ziel = groesster Wert aus
 *   (1) data/corp-geld.txt  {"betrag": $, "ts": ms}  - ANFORDERUNG, 2 h gueltig (bn4rep/graft koennen schreiben)
 *   (2) data/geldbedarf.txt - Ruecklage, die bn4rep.js fuer die Torrunde haelt
 *   (3) Vorgabe aus data/bn4rep.json: Preis des naechsten Ziels x (1 + 1,9 + ... + 1,9^(k-1)), k = offene
 *       Stuecke (hoechstens 10), plus {"graftGeld"} - gedeckelt auf {"defaultCap"} (Vorgabe 1e15). GESCHAETZT:
 *       bn4rep meldet nur den Preis des naechsten Ziels, nicht aller offenen Stuecke.
 * Verkauft wird Bedarf = Ziel - Spielergeld (x1,1), wenn > {"minSale"} (1e9). Sperre 1 h je Verkauf
 * (Constants.ts:50) -> Tranchen hoechstens stuendlich. Nie alle: {"keepFrac"} (5 %) der Anteile beim
 * Boersengang bleiben, je Verkauf hoechstens {"maxPart"} (10 %) der Anteile, hoechstens 1e14.
 * WARUM NUR 10 %: Nach dem Boersengang folgt der Kurs dem Ziel nur um ~0,5 %/Zyklus (x6/h,
 * Corporation.ts:264-274), die Bewertung waechst nach der Zuendung aber x1000 in 2 h. Ein grosser
 * Verkauf im IPO-Zyklus verschenkt die spaeteren Kurse (Simulator 06.10., Saat 3: 50 % beim IPO
 * brachten 34 Bio, der Rest waere Stunden spaeter ein Vielfaches wert gewesen).
 *
 * BESTECHUNG: erst nach dem ersten Verkauf (senkt die Bewertung, Skeptiker-Korrektur 4), Bewertung
 * >= 1e14 (Constants.ts:61), Kasse >= {"bribeMinFunds"} (1e15; vorher kostet jede Bestechung Wachstum,
 * strategie.md E), nie Bladeburners (FactionInfo.tsx:711-713), je Faktion der fehlende Ruf aus
 * bn4rep.json offenJeFaktion[f].fehlt x 1e9 $, je Durchgang hoechstens {"bribeShare"} (5 %) der Kasse,
 * dieselbe Faktion fruehestens nach 20 min wieder (bn4rep muss den neuen Ruf erst sehen).
 */
async function financeWork(ns, rt, st, snap, P) {
  const corp = snap.corp;
  const cfg = (k, d) => (st.cfg && st.cfg[k] !== undefined ? st.cfg[k] : d);
  st.fin ??= { phase: "halten", sales: [], soldTotal: 0, bribed: {}, bribeFail: {}, bribedTotal: 0, vHist: [] };
  const fin = st.fin;
  fin.vHist.push(corp.valuation);
  if (fin.vHist.length > 60) fin.vHist.shift();
  const smoothN = noFix(st, "smooth") ? 1 : 30;
  const ignited = ignitedSmooth(fin.vHist, cfg("igniteV", 1e15), smoothN);
  if (ignited && !fin.ignitedAt) {
    fin.ignitedAt = +P.hours.toFixed(3);
    logEvent(ns, st, `Zuendung erkannt: Bewertung ${fmt(corp.valuation)} seit ${smoothN} Zyklen >= ${fmt(cfg("igniteV", 1e15))}`);
  }
  const mayIpo = (st.roundsDone >= 4 && ignited) || (cfg("ipoEarly", false) && st.roundsDone >= 3);
  fin.phase = corp.public ? "oeffentlich" : mayIpo ? "zuendbereit" : "halten";
  const canSell = corp.public ? corp.shareSaleCooldown <= 0 : mayIpo;
  // Bedarf nur lesen, wenn verkauft werden koennte (spart scp je Zyklus)
  if (canSell && st.cycle % 3 === 0) {
    const tg = moneyTarget(ns, cfg);
    const money = ns.getServerMoneyAvailable("home");
    fin.target = tg.value;
    fin.targetWhy = tg.why;
    fin.need = Math.max(0, tg.value - money);
    if (fin.need > cfg("minSale", 1e9)) {
      const ipo = !corp.public;
      let keep = fin.keep || 1;
      if (ipo) {
        keep = Math.max(1, Math.ceil(cfg("keepFrac", 0.05) * corp.numShares));
        fin.keep = keep;
        // Liquidationswert-Vergleich: privat (Verkauf im IPO-Zyklus) gegen geschaetzt oeffentlich
        let ow = 12 * snap.dummies;
        for (const d of Object.values(snap.div)) ow += Object.keys(d.office).length + Object.values(d.wh).filter(Boolean).length;
        const vPub = publicValuationEstimate(corp.funds, corp.revenue - corp.expenses, ow);
        fin.ipo = { h: +P.hours.toFixed(3), vPriv: corp.valuation, vPubEst: vPub, liqPriv: liquidationValue(corp.valuation, corp.numShares, corp.totalShares), liqPubEst: liquidationValue(vPub, corp.numShares, corp.totalShares) };
      }
      const r = await runOps(ns, rt, [["sl", fin.need * 1.1, keep, ipo, cfg("maxPart", 0.1)]]);
      noteErrors(st, r.err);
      const res = r.ret[0];
      if (res && !res.error && res.n > 0) {
        fin.soldTotal += res.got;
        fin.sales.push({ h: +P.hours.toFixed(3), wall: Date.now(), n: res.n, got: res.got, pred: res.pred, need: fin.need, ipo: !!res.ipo });
        if (fin.sales.length > 50) fin.sales.shift();
        logEvent(ns, st, `${res.ipo ? "BOERSENGANG + " : ""}Verkauf ${fmt(res.n)} Anteile -> ${fmt(res.got)} an den Spieler (Bedarf ${fmt(fin.need)}, ${tg.why}; vorhergesagt ${fmt(res.pred)})` +
          (res.ipo ? ` | Vergleich privat ${fmt(fin.ipo.vPriv)} / oeffentlich geschaetzt ${fmt(fin.ipo.vPubEst)}` : ""));
      } else if (res && res.ipo) logEvent(ns, st, `Boersengang ohne Verkauf: ${JSON.stringify(res)}`);
    }
  }
  // --- Bestechung (nach dem ersten Verkauf)
  const afterSale = noFix(st, "bribeOrder") || (corp.public && fin.sales.length);
  if (afterSale && corp.valuation >= 1e14 && corp.funds >= cfg("bribeMinFunds", 1e15) && st.cycle % 30 === 0 && cfg("bribe", true) !== false) {
    const rep = readJson(ns, BN4REP_FILE);
    const offen = rep && rep.offenJeFaktion;
    if (offen && Date.now() - (rep.ts || rep.wall || 0) < 30 * 60000) {
      let budget = cfg("bribeShare", 0.05) * corp.funds;
      const ops = [];
      for (const [f, e] of Object.entries(offen).sort((a, b) => b[1].fehlt - a[1].fehlt)) {
        if ((f === "Bladeburners" && !noFix(st, "bb")) || !(e.fehlt > 0)) continue;
        const last = fin.bribed[f];
        if (last && Date.now() - last.wall < 20 * 60000) continue;
        const fail = fin.bribeFail[f];
        if (fail && fail.n >= 3 && Date.now() - fail.wall < 2 * 3600000) continue;
        const amt = Math.min(e.fehlt * 1e9 * 1.02, budget);
        if (!(amt >= 1e9)) break;
        ops.push(["bb", f, amt]);
        budget -= amt;
      }
      if (ops.length) {
        const r = await runOps(ns, rt, ops);
        ops.forEach((op, i) => {
          const ok = r.ret[i] === true;
          if (ok) {
            fin.bribed[op[1]] = { wall: Date.now(), rep: op[2] / 1e9, total: ((fin.bribed[op[1]] || {}).total || 0) + op[2] / 1e9 };
            fin.bribedTotal += op[2];
            logEvent(ns, st, `Bestechung ${op[1]}: ${fmt(op[2] / 1e9)} Ruf fuer ${fmt(op[2])}`);
          } else {
            const f0 = fin.bribeFail[op[1]] || { n: 0 };
            fin.bribeFail[op[1]] = { n: f0.n + 1, wall: Date.now() };
          }
        });
      }
    }
  }
}
function readJson(ns, file) {
  try {
    return JSON.parse(liesVonHome(ns, file) || "null");
  } catch {
    return null;
  }
}
function moneyTarget(ns, cfg) {
  const out = { value: 0, why: "kein Bedarf" };
  const take = (v, why) => {
    if (Number.isFinite(v) && v > out.value) {
      out.value = v;
      out.why = why;
    }
  };
  const req = readJson(ns, MONEY_REQUEST_FILE);
  if (req && typeof req === "object" && Date.now() - (req.ts || 0) < 2 * 3600000) take(Number(req.betrag), `Anforderung ${req.von || "?"}`);
  else if (typeof req === "number") take(req, "Anforderung (Zahl)");
  take(Number(liesVonHome(ns, MONEY_RESERVE_FILE) || 0), "geldbedarf.txt");
  const rep = readJson(ns, BN4REP_FILE);
  if (rep && rep.preis > 0) {
    const k = Math.min(10, Math.max(1, rep.offen || 1));
    let sum = 0;
    for (let i = 0; i < k; i++) sum += rep.preis * Math.pow(1.9, i);
    take(Math.min(cfg("defaultCap", 1e15), sum + cfg("graftGeld", 0)), `Vorgabe ${k} Stuecke ab ${rep.ziel || "?"}`);
  }
  return out;
}
/** Struktur-Ops nach Familie buendeln, Reihenfolge innerhalb einer Familie bleibt (stabil). Rang folgt
 *  den Abhaengigkeiten: Division/Stadt/Lager vor Buero, Buero vor Werbung/Tee, Produkte zuletzt. */
const FAMILY_RANK = { "corp-act-build.js": 0, "corp-act-office.js": 1, "corp-act-up.js": 2, "corp-act-care.js": 3, "corp-act-prod.js": 4, "corp-act-route.js": 5, "corp-act-cash.js": 6, "corp-act-fin.js": 7 };
function bundleOps(ops) {
  return ops.map((op, i) => ({ op, i, r: FAMILY_RANK[FAMILY[op[0]]] ?? 9 })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.op);
}
function noteErrors(st, errs) {
  for (const e of errs || []) {
    st.errors.push(`z${st.cycle} ${e}`);
    if (st.errors.length > 20) st.errors.shift();
  }
}
/** Pflanzenbedarf von Tobacco/Chem gegen Agri-Produktion (je s, Summe ueber Staedte) */
function summarizeFlow(diag) {
  const f = { tobDemand: 0, chemDemand: 0, agriPlants: 0, units: {} };
  for (const [key, d] of Object.entries(diag)) {
    const [dn] = key.split("|");
    f.units[key] = d.units;
    if (dn === TOB) f.tobDemand += d.units / 10;
    if (dn === CHEM) f.chemDemand += d.units / 10;
    if (dn === AGRI) f.agriPlants += d.plants;
  }
  return f;
}

class Planner {
  constructor(st, snap) {
    this.st = st;
    this.snap = snap;
    this.funds = snap.corp.funds;
    this.ops = [];
    this.events = [];
    this.boostOrders = {};
    this.lv = { ...snap.up };
    this.ads = {};
    this.whLv = {};
    this.officeSize = {};
    for (const [dn, d] of Object.entries(snap.div)) {
      this.ads[dn] = d.info.numAdVerts;
      this.whLv[dn] = {};
      this.officeSize[dn] = {};
      for (const [city, w] of Object.entries(d.wh)) this.whLv[dn][city] = w ? w.level : 0;
      for (const [city, o] of Object.entries(d.office)) this.officeSize[dn][city] = o.size;
    }
    st.rsDone ??= {};
    st.routes ??= {};
    st.cfg ??= {};
    st.seen ??= [];
    st.productSeq ??= 0;
    st.dummySeq ??= 0;
  }
  get hours() {
    return (this.st.cycle - this.st.foundCycle) / CYCLES_PER_HOUR;
  }
  cfg(key, dflt) {
    const v = this.st.cfg[key];
    return v === undefined ? dflt : v;
  }
  LT() {
    this.st.lastLT = this.st.cycle;
  }
  F(reserve = 0) {
    return Math.max(0, this.funds - reserve);
  }

  // ------------------------------------------------------------------ Runden (corpsim.ts tryRound/roundReady/beforeRound)
  tryRound() {
    const st = this.st;
    const hours = this.cfg("roundHours", ROUND_HOURS);
    const maxRound = this.etappe() >= 2 ? this.cfg("maxRound", MAX_ROUND) : 1;
    if (st.roundsDone >= maxRound || this.snap.corp.public) {
      st.freeze = false;
      return [];
    }
    const k = st.roundsDone;
    st.roundShift ??= [0, 0, 0, 0];
    const Tr = (hours[k] + st.roundShift[k]) * CYCLES_PER_HOUR;
    const cyc = st.cycle - st.foundCycle;
    // Bestes Angebot der letzten ~45 Zyklen vor dem Termin und im Stopp merken (Skeptiker E2 F1): nach
    // einem Neustart im Stopp nicht das eingebrochene Angebot nehmen, sondern auf >= 90 % davon warten.
    // Der Stopp endet trotzdem nach 30 Zyklen (dann Termin +0,25 h und Merker zurueck).
    if (cyc >= Tr - 45 && st.bestOfferRound === k) st.bestOffer = Math.max(st.bestOffer || 0, this.snap.offer.funds || 0);
    else if (cyc >= Tr - 45) {
      st.bestOfferRound = k;
      st.bestOffer = this.snap.offer.funds || 0;
    }
    if (cyc < Tr - 15) {
      st.next = `Runde ${k + 1} ab ${(Tr / CYCLES_PER_HOUR).toFixed(2)} h`;
      return [];
    }
    // Kein Ausgabenstopp, solange der Aufbau unfertig ist (Skeptiker E1 #1): sonst blockiert der Stopp
    // genau den Aufbau, der das Angebot ueber den Mindestbetrag heben wuerde
    if (k === 0 && this.agriIncomplete() && !noFix(st, "freeze")) {
      st.freeze = false;
      st.next = "Runde 1: Agri unfertig, Stopp aufgeschoben";
      return [];
    }
    if (!this.roundReady(k, hours)) {
      st.freeze = false;
      st.next = `Runde ${k + 1}: Voraussetzung fehlt (${k === 1 ? "RP Agri/Chem" : "fertige Produkte"})`;
      return [];
    }
    if (!st.freeze) {
      st.freeze = true;
      st.freezeAt = st.cycle;
      this.events.push(`Runde ${k + 1}: Ausgabenstopp (F3)`);
      this.buildDummies(this.snap.corp.valuation);
      return [];
    }
    // Der Stopp hat ein Ende: nach 30 Zyklen ohne Annahme aufheben, Runde um 0,25 h schieben (wiederholbar)
    if (st.cycle - (st.freezeAt ?? st.cycle) > 30 && !noFix(st, "freeze")) {
      st.freeze = false;
      st.roundShift[k] += 0.25;
      st.bestOffer = 0;
      st.bestOfferRound = -1;
      this.events.push(`Runde ${k + 1}: kein annehmbares Angebot, Stopp aufgehoben, neuer Termin ${(hours[k] + st.roundShift[k]).toFixed(2)} h`);
      return [];
    }
    // angenommen wird erst, wenn das 10-Zyklen-Mittel der Bewertung ganz aus Stopp-Zyklen besteht
    if (cyc >= Tr && st.cycle - st.lastLT >= 11 && (noFix(st, "bestOffer") || st.cycle - (st.freezeAt ?? 0) >= 11)) {
      st.next = `Runde ${k + 1} annehmen`;
      // Mindestbetrag; nach mehr als 1 h Verschiebung nur noch die Haelfte
      let min = this.cfg("roundMin", ROUND_MIN_FUNDS)[k];
      if (st.roundShift[k] > 1) min /= 2;
      if (!noFix(st, "bestOffer")) min = Math.max(min, 0.9 * (st.bestOffer || 0));
      return [["ai", min, noFix(st, "round") ? -1 : k + 1]];
    }
    st.next = `Runde ${k + 1}: warte auf 11 ruhige Zyklen`;
    return [];
  }
  /** Etappe 2 (Produkte, Runden 2-4) nur auf Ansage: data/corp-config.txt {"etappe":2} */
  etappe() {
    return this.cfg("etappe", ETAPPE);
  }
  roundReady(k, hours) {
    const h = this.hours;
    if (k === 1) {
      const a = this.snap.div[AGRI] ? this.snap.div[AGRI].info.researchPoints : 0;
      const ch = this.snap.div[CHEM] ? this.snap.div[CHEM].info.researchPoints : 390;
      // Doku-Regel (RP Agri >= 700, Chem >= 390); per Stellschraube "r2rp": false abschaltbar
      return this.cfg("r2rp", true) === false || (a >= 700 && ch >= 390) || h >= hours[1] + 0.5;
    }
    if (k >= 2) {
      const tob = this.snap.div[TOB];
      if (!tob) return false;
      const fin = Object.values(tob.products).filter((p) => p.developmentProgress >= 100).length;
      return fin >= (k === 2 ? 2 : 3) || h >= hours[k] + 1;
    }
    return true;
  }
  /** Restaurant-Dummies: 10 Mrd + 5 x (Buero 4 + Lager 5) = 55 Mrd, +12 Bueros/Lager -> Bewertung x1,1
   *  (Corporation.ts:211/219), solange 0,1*V > 55 Mrd/3 und < 20 Divisionen (corpsim.ts buildDummies) */
  buildDummies(V) {
    if (this.cfg("dummies", true) === false) return;
    let n = 0;
    let divs = this.snap.corp.divisions.length;
    while (divs < 20 && this.funds > 56e9 && 0.1 * V > 55e9 / 3) {
      const dn = `Dummy${++this.st.dummySeq}`;
      this.ops.push(["ei", "Restaurant", dn]);
      for (const city of CITIES) {
        if (city === "Sector-12") continue;
        this.ops.push(["ec", dn, city], ["pw", dn, city]);
      }
      this.funds -= 55e9;
      V *= 1.1;
      divs++;
      n++;
    }
    if (n) {
      this.LT();
      this.events.push(`${n} Dummy-Divisionen geplant`);
    }
  }

  // ------------------------------------------------------------------ Agriculture (Etappe 1)
  agriIncomplete() {
    const d = this.snap.div[AGRI];
    if (!d) return true;
    for (const city of CITIES) {
      if (!d.office[city] || !d.wh[city]) return true;
      if (d.office[city].size < 4 || d.office[city].numEmployees < d.office[city].size) return true;
    }
    return false;
  }
  setupAgri() {
    const d = this.snap.div[AGRI];
    if (!d) {
      this.ops.push(["ei", "Agriculture", AGRI]);
      this.funds -= INDUSTRY.Agriculture.cost;
    }
    this.expandAll(AGRI, d);
    for (const city of CITIES) {
      const o = d && d.office[city];
      const size = o ? o.size : 3;
      const emp = o ? o.numEmployees : 0;
      if (size >= 4 && emp >= size) continue;
      const target = Math.max(4, size);
      this.funds -= officeUpCost(size, target - size);
      this.ops.push(...officeOps(AGRI, city, size, emp, target, agriMix(target)));
    }
    const ads = d ? d.info.numAdVerts : 0;
    for (let i = ads; i < 2; i++) {
      this.ops.push(["ad", AGRI]);
      this.funds -= adCost(i);
    }
    this.LT();
    this.st.stage = "agri";
    this.st.next = "Agri-Ausbau";
    this.events.push(`Agri-Aufbau geplant (${this.ops.length} Ops), Fonds danach ~${fmt(this.funds)}`);
  }
  /** Staedte + Lager einer Division vervollstaendigen (Sector-12 hat beides ab Gruendung) */
  expandAll(dn, d) {
    for (const city of CITIES) {
      const hasOffice = d ? !!d.office[city] : city === "Sector-12";
      const hasWh = d ? !!d.wh[city] : city === "Sector-12";
      if (!hasOffice) {
        this.ops.push(["ec", dn, city]);
        this.funds -= OFFICE_INITIAL_COST;
      }
      if (!hasWh) {
        this.ops.push(["pw", dn, city]);
        this.funds -= WAREHOUSE_INITIAL_COST;
      }
    }
  }
  /** corpsim.ts growAgriFixed: alle 3 Zyklen */
  growAgriFixed(reserve) {
    if (this.st.cycle % 3 !== 0) return;
    const ads = () => this.ads[AGRI];
    for (let g = 0; g < 40; g++) {
      const sp = this.funds - reserve;
      if (this.lv["Smart Storage"] < 2 && upgradeCost("Smart Storage", this.lv["Smart Storage"]) < sp) { this.up("Smart Storage"); continue; }
      if (this.lv["Smart Factories"] < 13 && upgradeCost("Smart Factories", this.lv["Smart Factories"]) < sp * 0.5) { this.up("Smart Factories"); continue; }
      if (ads() < 6 && adCost(ads()) < sp * 0.3) { this.ad(AGRI); continue; }
      break;
    }
    const sp = this.funds - reserve;
    if (sp > 1e9) this.boostOrders[AGRI] = { frac: 0.75, budget: sp * 0.8 };
    const sf = upgradeCost("Smart Factories", this.lv["Smart Factories"]);
    const ad = adCost(ads());
    const wh = this.whCostAll(AGRI);
    const m = Math.min(sf, ad, wh);
    if (m < 0.1 * sp) {
      if (m === sf) this.up("Smart Factories");
      else if (m === ad) this.ad(AGRI);
      else this.whAll(AGRI);
    }
  }
  up(name) {
    this.funds -= upgradeCost(name, this.lv[name]);
    this.lv[name]++;
    this.ops.push(["lu", name]);
    this.LT();
  }
  ad(dn) {
    this.funds -= adCost(this.ads[dn]);
    this.ads[dn]++;
    this.ops.push(["ad", dn]);
  }
  whCostAll(dn) {
    let s = 0;
    for (const lvl of Object.values(this.whLv[dn])) s += warehouseUpCost(lvl);
    return s;
  }
  whAll(dn) {
    for (const city of Object.keys(this.whLv[dn])) {
      this.funds -= warehouseUpCost(this.whLv[dn][city]);
      this.whLv[dn][city]++;
      this.ops.push(["uw", dn, city, 1]);
    }
    this.LT();
  }
  /** Buero auf `size` (nur wenn kleiner), alle Staedte oder eine */
  growOffice(dn, city, size, mix) {
    const o = this.snap.div[dn].office[city];
    const cur = this.officeSize[dn][city];
    if (cur >= size && o.numEmployees >= size) return;
    this.funds -= officeUpCost(cur, Math.max(0, size - cur));
    this.ops.push(...officeOps(dn, city, cur, o.numEmployees, Math.max(size, cur), mix));
    this.officeSize[dn][city] = Math.max(size, cur);
    this.LT();
  }
  officesCost(dn, size) {
    let s = 0;
    for (const city of CITIES) s += officeUpCost(this.officeSize[dn][city], Math.max(0, size - this.officeSize[dn][city]));
    return s;
  }

  // ------------------------------------------------------------------ nach Runde 1 (corpsim.ts docTick Phase 2, Reihenfolge TF)
  phase2() {
    const st = this.st;
    const snap = this.snap;
    const tob = snap.div[TOB];
    const chem = snap.div[CHEM];
    const tobIncomplete = tob && CITIES.some((city) => !tob.office[city] || !tob.wh[city] || tob.office[city].numEmployees < tob.office[city].size || (city === MAIN_CITY && tob.office[city].size < 15));
    const chemIncomplete = chem && CITIES.some((city) => !chem.office[city] || !chem.wh[city] || chem.office[city].numEmployees < 3);
    const agriSmall = CITIES.some((city) => this.officeSize[AGRI][city] < 8);
    const steps = [
      { name: "Export", cond: !st.unlocks.includes("Export"), cost: () => UNLOCK_COST.Export, go: () => {
        this.ops.push(["ul", "Export"]);
        st.unlocks.push("Export");
      } },
      { name: "Tobacco", cond: !tob || tobIncomplete, cost: () => (tob ? 0 : 20e9 + 45e9) + 20e9 + 2e9, go: () => this.setupTob() },
      { name: "Agri-Bueros 8", cond: agriSmall, cost: () => this.officesCost(AGRI, 8), go: () => {
        for (const city of CITIES) this.growOffice(AGRI, city, 8, agriMix(8));
      } },
      {
        name: "Chemical",
        // nach Tobacco nur noch opportunistisch (blockiert sonst den Produktausbau stundenlang)
        cond: this.etappe() >= 2 && this.cfg("chem", true) && (!chem || chemIncomplete) && (st.stage !== "tob" || this.funds > 3 * 121e9 || chem),
        cost: () => (chem ? 0 : 70e9 + 45e9) + 6e9,
        go: () => this.setupChem(),
      },
    ];
    let reserve = AGRI_RESERVE;
    let pending = false;
    for (const s of steps) {
      if (!s.cond) continue;
      const cost = s.cost();
      if (this.funds >= cost + 1e9) {
        const before = this.funds;
        s.go();
        this.funds = before - cost;
        this.LT();
        this.events.push(`Schritt ${s.name} (${fmt(cost)}), Fonds danach ~${fmt(this.funds)}`);
        continue;
      }
      reserve = cost + 1e9;
      pending = true;
      st.next = `${s.name}: spare auf ${fmt(cost + 1e9)}`;
      break;
    }
    const tobThere = !!tob || this.ops.some((o) => o[0] === "ei" && o[2] === TOB);
    st.stage = tobThere ? "tob" : "post1";
    st.waiting = false;
    if (!tob) {
      // vor Tobacco: Agri weiter wie corpsim.ts docTick (Werbung bis 8, Ausbau)
      while (this.ads[AGRI] < 8 && adCost(this.ads[AGRI]) < (this.funds - reserve) * 0.5) this.ad(AGRI);
      this.growAgriFixed(reserve);
      return;
    }
    if (this.etappe() < 2) {
      if (!pending) {
        st.next = 'Etappe 1 fertig - warte auf Etappe 2 (data/corp-config.txt {"etappe":2})';
        st.waiting = true;
      }
      return;
    }
    // offene Schritte haben Vorrang vor dem Produktausbau
    if (!pending || this.funds > reserve) this.productTick(pending ? reserve : 0);
    if (!pending) st.next = "Produktphase";
  }
  setupTob() {
    const tob = this.snap.div[TOB];
    if (!tob) this.ops.push(["ei", "Tobacco", TOB]);
    this.expandAll(TOB, tob);
    for (const city of CITIES) {
      const o = tob && tob.office[city];
      const size = o ? o.size : 3;
      const emp = o ? o.numEmployees : 0;
      const target = city === MAIN_CITY ? Math.max(15, size) : size;
      if (emp >= target && size >= target) continue;
      this.ops.push(...officeOps(TOB, city, size, emp, target, city === MAIN_CITY ? TOB_MAIN_MIX : TOB_SUP_MIX));
    }
  }
  setupChem() {
    const chem = this.snap.div[CHEM];
    if (!chem) this.ops.push(["ei", "Chemical", CHEM]);
    this.expandAll(CHEM, chem);
    for (const city of CITIES) {
      const o = chem && chem.office[city];
      const size = o ? o.size : 3;
      const emp = o ? o.numEmployees : 0;
      if (emp >= size) continue;
      this.ops.push(...officeOps(CHEM, city, size, emp, size, CHEM_MIX));
    }
    // corpsim.ts: whAll("Chem") direkt nach dem Aufbau (Lager 100 -> 200 je Stadt)
    for (const city of CITIES) this.ops.push(["uw", CHEM, city, 1]);
  }

  // ------------------------------------------------------------------ Produktphase (corpsim.ts productTick, Anteile SH_B)
  productTick(reserve) {
    const st = this.st;
    const snap = this.snap;
    const F = () => Math.max(0, this.funds - reserve);
    const tob = snap.div[TOB];
    if (!tob || !tob.office[MAIN_CITY]) return;
    // Produkte: immer eines in Entwicklung
    let developing = false;
    let worst = null;
    for (const [n, p] of Object.entries(tob.products)) {
      if (p.developmentProgress < 100) developing = true;
      else {
        if (!st.seen.includes(n)) {
          st.seen.push(n);
          this.events.push(`Produkt ${n} fertig: Rating ${Math.round(p.rating)}, eff ${Math.round(p.effectiveRating)}`);
        }
        if (!worst || p.rating < worst.rating) worst = { name: n, rating: p.rating };
      }
    }
    if (!developing) {
      const inv = Math.max(1e8, F() * 0.01);
      if (F() > 2 * inv + 1e9) {
        // erst einstellen, wenn das neue Produkt bezahlbar ist (sonst bleibt ein Platz leer, Skeptiker E2 #9)
        if (Object.keys(tob.products).length >= tob.info.maxProducts && worst) this.ops.push(["dp", TOB, worst.name]);
        this.ops.push(["mp", TOB, MAIN_CITY, `P${++st.productSeq}`, inv, inv]);
        this.funds -= 2 * inv;
        this.LT();
      }
    }
    // Forschung: RP >= Faktor x Kosten (RP-Vorrat hebt die Produktqualitaet, Product.ts:149);
    // Market-TA.I/II fuer Tobacco schon ab 1x (Skeptiker-Korrektur 5: danach rechnet das Spiel den Preis)
    for (const [dn, list] of Object.entries(RESEARCH_ORDER)) {
      const d = snap.div[dn];
      if (!d) continue;
      const done = st.rsDone[dn] || [];
      for (const r of list) {
        if (done.includes(r)) continue;
        const ta = r.startsWith("Market-TA") || (dn === TOB && r === "Hi-Tech R&D Laboratory");
        const mult = ta ? this.cfg("taMult", 1) : this.cfg("researchMult", 2);
        if (d.info.researchPoints >= mult * RESEARCH[r].cost) this.ops.push(["rs", dn, r]);
        break;
      }
    }
    // Ausbau nur jeden 3. Zyklus (wie growAgriFixed): buendelt Ops, weniger exec je Zyklus (Skeptiker E2 F4)
    if (st.cycle % 3 !== 0 && !noFix(st, "bundle")) return;
    if (F() < 2e9) return;
    const sh = { wilson: 0.2, ads: 0.15, main: 0.4, up: 0.05, sup: 0.02, agri: 0.08, tob: 0.03, ...this.cfg("shares", {}) };
    // Wilson, wenn bezahlbar (Doku general-advice.md)
    for (let g = 0; g < 5; g++) {
      if (upgradeCost("Wilson Analytics", this.lv["Wilson Analytics"]) > sh.wilson * F()) break;
      this.up("Wilson Analytics");
    }
    // Werbung Tobacco
    let adB = sh.ads * F();
    for (let g = 0; g < 300; g++) {
      const cost = adCost(this.ads[TOB]);
      if (cost > adB || cost > F()) break;
      this.ad(TOB);
      adB -= cost;
    }
    // Hauptbuero +15
    for (let g = 0; g < 3; g++) {
      const cur = this.officeSize[TOB][MAIN_CITY];
      if (officeUpCost(cur, 15) > sh.main * F()) break;
      this.growOffice(TOB, MAIN_CITY, cur + 15, TOB_MAIN_MIX);
    }
    // Corp-Upgrades, billigstes zuerst, je Stueck <= sh.up der Mittel
    const ups = ["Smart Factories", "Smart Storage", "FocusWires", "Neural Accelerators", "Speech Processor Implants", "Nuoptimal Nootropic Injector Implants", "ABC SalesBots", "Project Insight"];
    for (let g = 0; g < 40; g++) {
      let best = ups[0];
      for (const u of ups) if (upgradeCost(u, this.lv[u]) < upgradeCost(best, this.lv[best])) best = u;
      if (upgradeCost(best, this.lv[best]) > sh.up * F()) break;
      this.up(best);
    }
    // Nebenbueros Tobacco bis 60 % des Hauptbueros
    const mainSize = this.officeSize[TOB][MAIN_CITY];
    for (const city of CITIES) {
      if (city === MAIN_CITY) continue;
      const cur = this.officeSize[TOB][city];
      if (cur >= this.cfg("supRatio", 0.6) * mainSize) continue;
      if (officeUpCost(cur, 6) < sh.sup * F()) this.growOffice(TOB, city, cur + 6, TOB_SUP_MIX);
    }
    // Pflanzen: Tobacco-Bedarf gegen Agri-Produktion (letzter Takt)
    const flow = st.flow || { tobDemand: 0, agriPlants: 1 };
    if (flow.tobDemand > 0.9 * flow.agriPlants) {
      const cur = this.officeSize[AGRI]["Sector-12"];
      if (this.officesCost(AGRI, cur + 3) < sh.agri * F()) for (const city of CITIES) this.growOffice(AGRI, city, cur + 3, agriMix(cur + 3));
      this.tendSupport(AGRI, sh.agri, F);
    } else this.tendSupport(AGRI, sh.agri / 4, F);
    // Chemicals
    if (snap.div[CHEM]) {
      const cur = this.officeSize[CHEM]["Sector-12"];
      if (cur < 9 && this.officesCost(CHEM, cur + 3) < 0.02 * F()) for (const city of CITIES) this.growOffice(CHEM, city, cur + 3, CHEM_MIX);
      this.tendSupport(CHEM, 0.01, F);
    }
    // Tobacco-Lager + Boosts
    const wh = tob.wh[MAIN_CITY];
    if (wh && wh.sizeUsed > 0.7 * wh.size && this.whCostAll(TOB) < sh.tob * F()) this.whAll(TOB);
    this.boostOrders[TOB] = { frac: 0.5, budget: sh.tob * F() };
  }
  /** corpsim.ts tendSupport: Lager bei > 85 % voll, Boosts auf 60 % des Lagers */
  tendSupport(dn, frac, F) {
    const d = this.snap.div[dn];
    if (!d) return;
    const wh = d.wh[MAIN_CITY];
    if (wh && wh.sizeUsed > 0.85 * wh.size && this.whCostAll(dn) < frac * F()) this.whAll(dn);
    this.boostOrders[dn] = { frac: 0.6, budget: frac * F() };
  }
  /** Ergebnisse auswerten: Forschung als erledigt merken (research() kehrt bei "schon erforscht" still zurueck) */
  applyResults(r, ops = this.ops) {
    const st = this.st;
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      const res = r.ret[i];
      if (op[0] === "rs" && !(res && res.error)) {
        st.rsDone[op[1]] ??= [];
        if (!st.rsDone[op[1]].includes(op[2])) {
          st.rsDone[op[1]].push(op[2]);
          this.events.push(`Forschung ${op[1]}: ${op[2]}`);
        }
      }
      if (op[0] === "ul" && res && res.error && !/already|bereits/i.test(res.error)) st.unlocks = st.unlocks.filter((u) => u !== op[1]);
    }
  }

  // ------------------------------------------------------------------ Takt-Auftraege
  tickOrder() {
    const st = this.st;
    const divs = [];
    const sfMult = 1 + UPGRADES["Smart Factories"].benefit * this.lv["Smart Factories"];
    const exportOn = st.unlocks.includes("Export");
    for (const [dn, indName] of [[AGRI, "Agriculture"], [CHEM, "Chemical"], [TOB, "Tobacco"]]) {
      const d = this.snap.div[dn];
      if (!d || CITIES.some((city) => !d.office[city] || !d.wh[city])) continue;
      if (dn === AGRI && this.agriIncomplete()) continue;
      const ind = INDUSTRY[indName];
      const officeProd = {}, wh = {};
      for (const city of d.info.cities) {
        officeProd[city] = officeProductivity(d.office[city].employeeProductionByJob, ind.products);
        wh[city] = { size: d.wh[city].size, used: d.wh[city].sizeUsed };
      }
      const rmul = researchMults(st.rsDone[dn]);
      const nProducts = ind.products ? Object.values(d.products).filter((p) => p.developmentProgress >= 100).length : 0;
      const internal = [];
      if (exportOn && dn === TOB && this.snap.div[AGRI]) internal.push("Plants");
      // geplanter Export je s (Routen "X-IINV/10"), damit der Verkaufspreis das Angebot nicht ueberschaetzt
      const exportOut = {};
      for (const [city, r] of Object.entries(st.routes || {}))
        for (const [key, w] of Object.entries(r)) {
          const [src, , mat] = key.split(">");
          if (src === dn) exportOut[city + "|" + mat] = (exportOut[city + "|" + mat] || 0) + w;
        }
      divs.push({
        name: dn, ind: indName, cities: d.info.cities, wh, officeProd, exportOut,
        mult: sfMult * rmul.prod * (ind.products ? rmul.productProd : 1),
        nProducts, internal,
        boost: st.boost[dn] || {},
        boostOrder: this.boostOrders[dn] || null,
      });
    }
    return { cash: Math.max(0, this.funds), divs, price: st.price };
  }
  /** Export-Routen als stehende Ausdruecke "X-IINV/10" (je s); neu gesetzt nur bei > 10 % Aenderung.
   *  Reihenfolge Agri->Tob vor Agri->Chem (FIFO, Division.ts:727): bei jeder Aenderung alle Agri-Routen
   *  einer Stadt neu anlegen. Die Doku-Formel (IPROD+IINV/10)*(-1) laeuft nicht an (F11). */
  routeOps(diag) {
    const st = this.st;
    if (!st.unlocks.includes("Export")) return { ops: [], book: {} };
    const book = {};
    const has = (dn) => !!this.snap.div[dn];
    const routes = [];
    if (has(AGRI) && has(TOB)) routes.push([AGRI, TOB, "Plants", 1]);
    if (has(AGRI) && has(CHEM)) routes.push([AGRI, CHEM, "Plants", 1]);
    if (has(CHEM) && has(AGRI)) routes.push([CHEM, AGRI, "Chemicals", 0.2]);
    const ops = [];
    for (const city of CITIES) {
      const want = {};
      for (const [src, dst, mat, q] of routes) {
        const u = diag[dst + "|" + city];
        if (!u) continue;
        want[`${src}>${dst}>${mat}`] = (1.05 * q * u.units) / 10;
      }
      const bySrc = {};
      for (const [src, dst, mat] of routes) (bySrc[src + ">" + mat] ??= []).push([src, dst, mat]);
      for (const group of Object.values(bySrc)) {
        let change = false;
        for (const [src, dst, mat] of group) {
          const key = `${src}>${dst}>${mat}`;
          const cur = (st.routes[city] || {})[key];
          const w = want[key];
          if (w === undefined) continue;
          if (cur === undefined || Math.abs(w - cur) > 0.1 * Math.max(cur, 1e-9)) change = true;
        }
        if (!change) continue;
        for (const [src, dst, mat] of group) {
          ops.push(["cx", src, city, dst, city, mat]);
          if (st.routes[city]) delete st.routes[city][`${src}>${dst}>${mat}`];
        }
        for (const [src, dst, mat] of group) {
          const key = `${src}>${dst}>${mat}`;
          const w = want[key];
          if (w === undefined) continue;
          book[ops.length] = { city, key, w };
          ops.push(["ex", src, city, dst, city, mat, `${w.toPrecision(8)}-IINV/10`]);
        }
      }
    }
    return { ops, book };
  }
}
