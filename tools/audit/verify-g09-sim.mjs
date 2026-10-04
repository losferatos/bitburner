// G09: Ereignissimulation Spieler + 3 Sleeves in der Raid-Phase (Bladeburner V2), Regeln aus dem
// Spielquellcode (siehe verify-g09-model.mjs). Zeigt Rang, Krankenhauskosten, Chaos, Vorrat je Belegung.
// Aufruf: import { simulate, startFromSave } oder node verify-g09-sim.mjs (Selbsttest/Eichung).
import { ACT, K, skillMults, chance, actionTime, stamCost, damage, rankGain, rankLossAt, diffMult, diffAt, succNeeded,
  maxStaminaOf, regenPerSec, eff, ctxOf } from "./verify-g09-model.mjs";

const fmt0 = (x) => (x / 60).toFixed(1) + "min";
const isAuto = (s) => s.role === "auto" || s.role === "autod";
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const PLAYER_ACTS = ["Raid", "Retirement", "Bounty Hunter", "Tracking", "Stealth Retirement Operation", "Assassination"];
const growthMean = (n) => ACT[n].growth;     // Mittel je 480 s (data/Operations.ts, Contracts.ts)

// Startzustand aus einem Spielstand. opts.statGrowthPerH: Wachstum der Kampfwerte je Stunde (Gym/Aktions-Exp).
export function startFromSave(p, sleeveSk) {
  const { ctx, bb, levels } = ctxOf(p);
  const st = {
    t: 0, sk0: { ...ctx.sk }, skm: ctx.skm, bbSucc: ctx.bbSucc, bbMax: ctx.bbMaxStamMult, bbGain: ctx.bbStamGainMult,
    staminaBonus: bb.staminaBonus || 0, stamina: bb.stamina, hp: { current: p.hp.current, max: p.hp.max }, money: p.money,
    city: { ...ctx.city }, rank: bb.rank, team: 0,
    act: {}, sleeveSk: sleeveSk || { strength: 40, defense: 40, dexterity: 40, agility: 40, hacking: 1, charisma: 2, intelligence: 1 },
    moneyLost: 0, hosp: 0,
  };
  for (const n of PLAYER_ACTS) {
    const l = levels[n];
    st.act[n] = { count: l.count, level: l.level, maxLevel: l.maxLevel, succ: l.successes, fail: l.failures };
  }
  return st;
}

let STATPATH = null;   // [{h, str, def, dex, agi}] absolute Knotenstunden (aus Spielstaenden), optional
export function setStatPath(path, t0h) { STATPATH = path ? { path, t0h } : null; }
function statsAt(st, growth) {
  if (!STATPATH) { const f = 1 + growth * st.t / 3600; return { strength: st.sk0.strength * f, defense: st.sk0.defense * f, dexterity: st.sk0.dexterity * f, agility: st.sk0.agility * f }; }
  const h = STATPATH.t0h + st.t / 3600, P = STATPATH.path;
  const pick = (q) => ({ strength: q.str, defense: q.def, dexterity: q.dex, agility: q.agi, hacking: q.hack ?? st.sk0.hacking, charisma: q.cha ?? st.sk0.charisma });
  let a = P[0], b = P[P.length - 1];
  if (h <= a.h) return pick(a);
  if (h >= b.h) { const f = 1 + growth * (h - b.h); const q = pick(b); return { ...q, strength: q.strength * f, defense: q.defense * f, dexterity: q.dexterity * f, agility: q.agility * f }; }
  for (let i = 1; i < P.length; i++) if (h <= P[i].h) { a = P[i - 1]; b = P[i]; break; }
  const w = (h - a.h) / (b.h - a.h), qa = pick(a), qb = pick(b), o = {};
  for (const k of Object.keys(qa)) o[k] = qa[k] + (qb[k] - qa[k]) * w;
  return o;
}
let SKILLPATH = null;
export function setSkillPath(path, t0h) { SKILLPATH = path ? { path, t0h } : null; }
function skmAt(st) {
  if (!SKILLPATH) return st.skm;
  const h = SKILLPATH.t0h + st.t / 3600, P = SKILLPATH.path;
  if (h <= P[0].h) return skillMults(P[0].lv);
  if (h >= P[P.length - 1].h) return skillMults(P[P.length - 1].lv);
  let a = P[0], b = P[1];
  for (let i = 1; i < P.length; i++) if (h <= P[i].h) { a = P[i - 1]; b = P[i]; break; }
  const w = (h - a.h) / (b.h - a.h), lv = {};
  for (const k of new Set([...Object.keys(a.lv), ...Object.keys(b.lv)])) lv[k] = (a.lv[k] || 0) + ((b.lv[k] || 0) - (a.lv[k] || 0)) * w;
  return skillMults(lv);
}
function ctxAt(st, growth, who = "player") {
  const sk = who === "player" ? { ...st.sk0, ...statsAt(st, growth) } : st.sleeveSk;
  const f = 1;
  const c = { sk, skm: skmAt(st), bbSucc: who === "player" ? st.bbSucc : 1, bbMaxStamMult: st.bbMax, bbStamGainMult: st.bbGain,
    stamina: st.stamina, maxStamina: 1, city: st.city, team: 0 };
  // Hoechstausdauer und Regeneration des SPIELERS (auch fuer die Strafe, die Sleeves mittragen)
  const pc = who === "player" ? c : { ...c, sk: { ...st.sk0, ...statsAt(st, growth) } };
  const mx = maxStaminaOf(pc, st.staminaBonus);
  c.maxStamina = mx;
  c.regen = regenPerSec(pc);
  return c;
}

// cfg: { sleeves: [rolle, rolle, rolle], growth, hours, lambda (Rang je Mio$, Krankenhaus im Spielerwert), k40At, noRandomEvents }
//   rolle: "gym" | "infil" | "dipl" | "contract" | "auto"   ("auto" = Bot-Verhalten sleeve.js:726-853)
export function simulate(start, cfg, seed = 1) {
  const R = rng(seed);
  const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  const st = JSON.parse(JSON.stringify(start));
  const T = cfg.hours * 3600, g = cfg.growth ?? 0.04, lam = cfg.lambda ?? 0;
  const log = { raids: 0, raidSucc: 0, kammerS: 0, dipS: 0, contracts: 0, ranks: [], infilEvents: 0, rankSleeve: 0, rankPlayer: 0, hospCost: 0, maxChaos: 0, chaosOver50S: 0 };
  const sl = cfg.sleeves.map((r) => ({ role: r, next: Infinity, task: null, k: cfg.k0 ?? 10 }));
  let playerAct = null, playerEnd = 0, resting = false, cleaning = false;
  const evNext = () => 240 + R() * 360;
  let nextEvent = evNext();
  const mean = (n) => growthMean(n) / K.growthPeriod;
  // laufende Hintergrundentwicklung: Vorrat waechst stetig (Mittel), Chaos -0,0001/s
  let tLast = 0;
  const tick = (to) => {
    const dt = to - tLast; if (dt <= 0) return;
    for (const n of PLAYER_ACTS) st.act[n].count += dt * mean(n);
    st.city.chaos = Math.max(0, st.city.chaos - 0.0001 * dt);
    st.money += (cfg.income || 0) * dt / 3600;
    if (st.city.chaos > 50) log.chaosOver50S += dt;
    tLast = to; st.t = to;
  };
  const infilCount = () => sl.filter((s) => s.task === "infil").length;
  const setSleeve = (s, task, now) => {
    s.task = task; s.cur = null;
    if (task === "infil") s.next = now + 61;
    else if (task === "dipl") s.next = now + 60;
    else if (task && task.startsWith("c:")) {
      const n = task.slice(2); const a = ACT[n]; const L = st.act[n].level;
      s.next = now + actionTime(a, L, ctxAt(st, g, "sleeve"));
    } else s.next = Infinity;       // gym
  };
  const randomEvent = () => {
    const c = st.city;
    const hitsSource = R() < 1 / 6, hitsDest = R() < 1 / 5 * (5 / 6);
    const r = R();
    if (r <= 0.05) { if (hitsSource) { c.comms++; c.pop = Math.round(c.pop * (1 + ri(10, 20) / 100)); if (c.pop < 1.5e9) c.pop += 100; } }
    else if (r <= 0.1) {
      if (hitsSource) { if (c.comms <= 0) { c.comms++; c.pop = Math.round(c.pop * (1 + ri(10, 20) / 100)); } else { c.comms--; c.pop = Math.round(c.pop * (1 - ri(10, 20) / 100)); } }
      else if (hitsDest) { c.comms++; c.pop = Math.round(c.pop * (1 + ri(10, 20) / 100)); }
    } else if (r <= 0.3) { if (hitsSource) { c.pop = Math.round(c.pop * (1 + ri(8, 24) / 100)); if (c.pop < 1.5e9) c.pop += 100; } }
    else if (r <= 0.5) { if (hitsSource) { c.pop = Math.round(c.pop * (1 - ri(3, 15) / 100)); } else if (hitsDest) { c.pop = Math.round(c.pop * (1 + ri(3, 15) / 100)); } }
    else if (r <= 0.7) { if (hitsSource) { c.chaos += 1; c.chaos *= 1 + ri(5, 20) / 100; } }
    else if (r <= 0.9) { if (hitsSource) { c.pop = Math.round(c.pop * (1 - ri(8, 20) / 100)); } }
  };
  const lvlUp = (n, spl) => { const a = st.act[n]; if (a.succ >= succNeeded(a.maxLevel, spl)) a.maxLevel++; a.level = a.maxLevel; };
  const applyCompletion = (n, who) => {
    const a = ACT[n], s = st.act[n], L = s.level;
    const c = ctxAt(st, g, who === "player" ? "player" : "sleeve");
    if (who === "player") st.stamina = Math.max(0, st.stamina - stamCost(a, L));
    c.stamina = st.stamina;
    const pr = chance(a, L, c);
    if (who === "player" && n === "Raid") { const hb = Math.floor(st.t / 3600); log.hb = log.hb || {}; const e = (log.hb[hb] = log.hb[hb] || { n: 0, p: 0, s: 0, pop: 0, chaos: 0, stock: 0 }); e.n++; e.p += pr; e.pop += st.city.pop; e.chaos += st.city.chaos; e.stock += s.count; }
    const ok = R() < pr;
    if (who === "player" && n === "Raid" && ok) { log.hb[Math.floor(st.t / 3600)].s++; }
    s.count -= 1;
    const gain = rankGain(a, L), cityObj = st.city;
    if (ok) {
      s.succ++; lvlUp(n, a.t === "O" ? K.opSpl : K.ctSpl);
      const gv = gain * (1 + (R() * 0.2 - 0.1));
      st.rank += gv;
      if (who === "player") log.rankPlayer += gv; else log.rankSleeve += gv;
      if (n === "Raid") { if (!cfg.frozenCity) { if (!cfg.noPop) { cityObj.pop = Math.max(0, Math.round(cityObj.pop - Math.max(1, Math.round(cityObj.pop * 0.01)))); cityObj.comms--; } if (!cfg.noChaos) cityObj.chaos *= 1 + ri(1, 5) / 100; } }
      else if (n === "Stealth Retirement Operation") { cityObj.pop = Math.max(0, cityObj.pop - Math.max(1, Math.round(cityObj.pop * 0.005))); cityObj.chaos *= 1 - ri(1, 3) / 100; }
      else if (n === "Assassination") { cityObj.pop = Math.max(0, cityObj.pop - 1); }
      else if (n === "Bounty Hunter") { cityObj.pop -= 1; cityObj.chaos += 0.02; }
      else if (n === "Retirement") { cityObj.pop -= 1; cityObj.chaos += 0.04; }
      if (n === "Raid") log.raidSucc++;
    } else {
      s.fail++; lvlUp(n, a.t === "O" ? K.opSpl : K.ctSpl);
      if (a.rl) { const lv = rankLossAt(a, L) * (1 + (R() * 0.2 - 0.1)); st.rank = Math.max(0, st.rank - lv); log.lossRank = (log.lossRank || 0) + lv; }
      if (who === "player" && a.hp) {
        const dmg = Math.ceil(damage(a, L) * (1 + (R() * 0.2 - 0.1)));
        st.hp.current -= dmg;
        if (st.hp.current <= 0) {
          const cost = st.money < 0 ? 0 : Math.min(st.money * 0.1, (st.hp.max - st.hp.current) * K.hospPerHp);
          st.money -= cost; st.moneyLost += cost; st.hosp++; log.hospCost += cost; st.hp.current = st.hp.max;
        }
      }
      if (n === "Raid") { if (!cfg.frozenCity) { if (!cfg.noPop) cityObj.pop = Math.max(0, Math.round(cityObj.pop * (1 - ri(5, 10) / 1000))); if (!cfg.noChaos) cityObj.chaos *= 1 + ri(1, 5) / 100; } }
      else if (n === "Stealth Retirement Operation") cityObj.chaos *= 1 - ri(1, 3) / 100;
    }
    if (n === "Assassination") cityObj.chaos = Math.max(0, cityObj.chaos * (1 + ri(-5, 5) / 100));
    if (n === "Raid" && who === "player") log.raids++;
    if (who === "player") { log.pa = log.pa || {}; log.pa[n] = (log.pa[n] || 0) + 1; }
    if (who === "player" && n === "Stealth Retirement Operation") { /* Chaos wirkt auch bei Fehlschlag, oben */ }
  };
  // Spieler-Entscheidung (Bot: Chaos-Hysterese 50/47 -> Diplomacy, Ausdauerband 51/56 %, sonst bester Ertrag je Sekunde)
  const decide = () => {
    const c = ctxAt(st, g, "player");
    if (cfg.switchChaos && st.city.chaos >= cfg.switchChaos && (cfg.switches ?? 0) > (log.switched || 0)) {
      // freie Stadt (City.ts: pop U[1,1.5] Mrd, comms U[5,150]); Chaos nahe 0 (nur Ereignisse bringen +1)
      st.city = { pop: 1e9 * (1 + R() * 0.5), popEst: 1e9 * (1 + R() * 0.5), chaos: 0.5, comms: ri(5, 150) };
      log.switched = (log.switched || 0) + 1; cleaning = false;
    }
    if (st.city.chaos > 50) cleaning = true;
    if (st.city.chaos < 47) cleaning = false;
    if (cleaning) return { n: "Diplomacy", dur: 60 };
    const lo = 0.51 * c.maxStamina, hi = 0.56 * c.maxStamina;
    if (resting && st.stamina >= hi) resting = false;
    if (resting) return { n: "Kammer", dur: 60 };
    let best = null;
    for (const n of PLAYER_ACTS) {
      const s = st.act[n]; if (s.count < 1) continue;
      const a = ACT[n]; if (n === "Raid" && st.city.comms < 1) continue;
      const L = s.level, dur = actionTime(a, L, c);
      if (a.t === "O" && n !== "Raid" && chance(a, L, { ...c, stamina: c.maxStamina }) < (cfg.opMin ?? 0.5)) continue;
      const after = st.stamina + c.regen * dur - stamCost(a, L);
      if (after < lo) continue;
      const pr = chance(a, L, { ...c, stamina: Math.max(after, 0) });
      const dm = damage(a, L);
      const cost = a.hp ? Math.min(1e12, Math.max(0, (st.hp.max - (st.hp.current - dm)) * K.hospPerHp)) : 0;
      const ev = pr * rankGain(a, L) - (1 - pr) * rankLossAt(a, L) - lam * (1 - pr) * cost / 1e6;
      let v = ev / dur;
      if (cfg.raidFirst && n === "Raid" && ev > 0) v += 1e3;   // Bot: Raid vor allem, solange Vorrat und Ertrag positiv
      if (!best || v > best.v) best = { n, dur, v, ev };
    }
    if (best && best.ev > 0) return best;
    if (st.stamina < hi) { resting = true; }
    return { n: "Kammer", dur: 60 };
  };
  // Bot-Verhalten der Sleeves (sleeve.js:726-853), Kampfwert >= 40 ab k40At
  const autoSleeve = (s, i, now) => {
    if (s.task === "infil") return;                       // bleibt (sleeve.js:749-751)
    if (s.task && s.task.startsWith("c:")) {
      const n = s.task.slice(2);
      if (st.act[n].count >= 1) return;                   // laeuft schon (sleeve.js:729-733)
    }
    if (now < (cfg.k40At ?? Infinity)) { setSleeve(s, "gym", now); return; }
    // knappeOperation: Spieler faehrt gerade eine Operation, deren Vorrat < 400 ist (sleeve.js:710-725)
    const knapp = playerAct && ACT[playerAct.n] && ACT[playerAct.n].t === "O" && st.act[playerAct.n].count < 400;
    if (!knapp) {
      const taken = new Set(sl.filter((x) => x !== s && x.task && x.task.startsWith("c:")).map((x) => x.task.slice(2)));
      const opts = ["Tracking", "Bounty Hunter", "Retirement"].filter((n) => !taken.has(n) && st.act[n].count >= 2)
        .sort((a, b) => st.act[b].count - st.act[a].count);
      if (opts.length) { setSleeve(s, "c:" + opts[0], now); return; }
    }
    setSleeve(s, "infil", now);
  };
  sl.forEach((s, i) => { if (s.role === "infil") setSleeve(s, "infil", 0); else if (s.role === "dipl") setSleeve(s, "dipl", 0); else if (s.role === "gym" || s.role === "gymthen") setSleeve(s, "gym", 0); else if (s.role && s.role.startsWith("c:")) setSleeve(s, s.role, 0); else if (isAuto(s)) autoSleeve(s, i, 0); });
  sl.forEach((s) => { if ((s.role === "gymthen" || isAuto(s)) && s.task === "gym") s.next = cfg.k40At ?? Infinity; });
  playerAct = decide(); playerEnd = playerAct.dur;
  let lastRankLog = 0;
  while (true) {
    let tNext = playerEnd, who = -1;
    sl.forEach((s, i) => { if (s.next < tNext) { tNext = s.next; who = i; } });
    if (!cfg.frozenCity && nextEvent < tNext) { tNext = nextEvent; who = -2; }
    if (tNext > T) break;
    // Ausdauer des Spielers laeuft stetig
    const dt = tNext - tLast;
    const c0 = ctxAt(st, g, "player");
    if (st.maxPrev) st.stamina *= c0.maxStamina / st.maxPrev;   // Bladeburner.ts:1332-1342: Ausdauer skaliert mit dem Maximum
    st.maxPrev = c0.maxStamina;
    st.stamina = Math.min(c0.maxStamina, st.stamina + c0.regen * dt);
    tick(tNext);
    if (who === -2) { randomEvent(); nextEvent += evNext(); continue; }
    if (who >= 0) {
      const s = sl[who];
      if (s.task === "infil") {
        const n = Math.max(1, infilCount()); const amt = Math.pow(n, -0.5) / 2;
        for (const a of PLAYER_ACTS) st.act[a].count += amt;
        log.infilEvents++;
        s.next = tNext + 61;
      } else if (s.task === "dipl") {
        const cha = st.sleeveSk.charisma; const pct = Math.pow(cha, 0.045) + cha / 1000;
        st.city.chaos = Math.max(0, st.city.chaos * (1 - pct / 100));
        s.next = tNext + 60;
      } else if (s.task && s.task.startsWith("c:")) {
        const n = s.task.slice(2);
        if (st.act[n].count < 1) { s.task = null; s.next = tNext; }
        else { applyCompletion(n, "sleeve"); log.contracts++; }
        if (isAuto(s)) autoSleeve(s, who, tNext);
        else if (s.role && s.role.startsWith("c:")) { if (st.act[s.role.slice(2)].count >= 1) setSleeve(s, s.role, tNext); else { s.task = "idle"; s.next = tNext + 60; } }
        else if (s.task && s.task.startsWith("c:")) setSleeve(s, s.task, tNext);
      } else {
        // gym: Kampfwert-Uebergang (nur "auto")
        if (isAuto(s)) autoSleeve(s, who, tNext);
        else if (s.role && s.role.startsWith("c:")) { if (st.act[s.role.slice(2)].count >= 1) setSleeve(s, s.role, tNext); else s.next = tNext + 60; }
        else if (s.role === "gymthen" && tNext >= (cfg.k40At ?? Infinity)) setSleeve(s, "infil", tNext);
        else s.next = s.role === "gymthen" ? (cfg.k40At ?? Infinity) : Infinity;
      }
      if (s.role === "autod") {
        const nd = sl.filter((x) => x !== s && x.task === "dipl").length;
        if (s.task !== "dipl" && st.city.chaos >= (cfg.diplOn ?? 40) && nd < (cfg.nDipl ?? 2) && tNext >= (cfg.k40At ?? Infinity)) setSleeve(s, "dipl", tNext);
        else if (s.task === "dipl" && st.city.chaos < (cfg.diplOff ?? 25)) { s.task = null; autoSleeve(s, who, tNext); }
      }
      // "auto"-Sleeves im Gym pruefen beim naechsten Takt (60 s)
      if (isAuto(s) && s.task === "gym") s.next = Math.min(tNext + 60, cfg.k40At ?? Infinity);
      continue;
    }
    // Spieleraktion fertig
    const pa = playerAct;
    log.tt = log.tt || {}; log.tt[pa.n] = (log.tt[pa.n] || 0) + pa.dur;
    if (pa.n === "Diplomacy") {
      const cha = ctxAt(st, g, "player").sk.charisma; const pct = Math.pow(cha, 0.045) + cha / 1000;
      st.city.chaos = Math.max(0, st.city.chaos * (1 - pct / 100)); log.dipS += 60;
    } else if (pa.n === "Kammer") {
      const cx = ctxAt(st, g, "player");
      st.stamina = Math.min(cx.maxStamina, st.stamina + cx.maxStamina * 0.01); log.kammerS += 60;
      st.hp.current = Math.min(st.hp.max, st.hp.current + 2);
    } else applyCompletion(pa.n, "player");
    playerAct = decide(); playerEnd = tNext + playerAct.dur;
    if (cfg.trace && cfg.trace > 0 && tNext >= (cfg.traceFrom || 0)) { cfg.trace--; console.log(fmt0(tNext), playerAct.n, "stam", st.stamina.toFixed(1), "max", ctxAt(st, g, "player").maxStamina.toFixed(1), "pRaid", chance(ACT.Raid, st.act.Raid.level, { ...ctxAt(st, g, "player"), stamina: ctxAt(st, g, "player").maxStamina }).toFixed(3), "pop", (st.city.pop/1e6).toFixed(0), "raidStock", st.act.Raid.count.toFixed(1), "chaos", st.city.chaos.toFixed(1)); }
    // "auto"-Sleeves reagieren auf das Spielersignal beim naechsten Takt
    if (Math.floor(tNext / 3600) > lastRankLog) { lastRankLog = Math.floor(tNext / 3600); log.ranks.push(+st.rank.toFixed(0)); }
    log.maxChaos = Math.max(log.maxChaos, st.city.chaos);
  }
  tick(T);
  log.rankEnd = st.rank; log.moneyLost = st.moneyLost; log.hosp = st.hosp; log.city = { ...st.city }; log.nSwitch = log.switched || 0;
  log.stockRaid = st.act["Raid"].count; log.levelRaid = st.act["Raid"].level; log.chaosEnd = st.city.chaos;
  return log;
}

export function ensemble(start, cfg, n = 200, seed0 = 1) {
  const rows = [];
  for (let i = 0; i < n; i++) rows.push(simulate(start, cfg, seed0 + i * 7919));
  const avg = (f) => rows.reduce((s, r) => s + f(r), 0) / rows.length;
  const sd = (f) => { const m = avg(f); return Math.sqrt(rows.reduce((s, r) => s + (f(r) - m) ** 2, 0) / rows.length); };
  return { n, rank: avg((r) => r.rankEnd), rankSd: sd((r) => r.rankEnd), money: avg((r) => r.moneyLost), raids: avg((r) => r.raids),
    raidSucc: avg((r) => r.raidSucc), kammerMin: avg((r) => r.kammerS / 60), dipMin: avg((r) => r.dipS / 60), contracts: avg((r) => r.contracts),
    chaosEnd: avg((r) => r.chaosEnd), over50h: avg((r) => r.chaosOver50S / 3600), stockRaid: avg((r) => r.stockRaid), levelRaid: avg((r) => r.levelRaid),
    hb: (() => { const o = {}; for (const r of rows) for (const [k, e] of Object.entries(r.hb || {})) { const q = (o[k] = o[k] || { n: 0, p: 0, s: 0, pop: 0, chaos: 0, stock: 0 }); for (const f of Object.keys(q)) q[f] += e[f]; } for (const q of Object.values(o)) { q.pm = q.p / q.n; q.popm = q.pop / q.n / 1e6; q.chaosm = q.chaos / q.n; q.stockm = q.stock / q.n; q.n /= rows.length; q.s /= rows.length; } return o; })(), ranksH: [0,1,2,3,4,5,6,7,8,9,10,11].map((i) => rows.reduce((a, r) => a + (r.ranks[i] ?? NaN), 0) / rows.length), nSwitch: avg((r) => r.nSwitch || 0), rankPlayer: avg((r) => r.rankPlayer), loss: avg((r) => r.lossRank || 0), popEnd: avg((r) => r.city.pop / 1e6), commsEnd: avg((r) => r.city.comms), tt: Object.fromEntries([...new Set(rows.flatMap((r) => Object.keys(r.tt || {})))].map((k) => [k, avg((r) => (r.tt && r.tt[k]) || 0) / 60])), paRet: avg((r) => (r.pa && r.pa.Retirement) || 0), paSR: avg((r) => (r.pa && r.pa['Stealth Retirement Operation']) || 0), rankSleeve: avg((r) => r.rankSleeve), infil: avg((r) => r.infilEvents) };
}
