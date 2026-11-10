// Schwanzrisiko der Regel: schlechtester Verlauf je Seed.
import path from "node:path";
import { pathToFileURL } from "node:url";
const { run, makeBotStrategy } = await import(pathToFileURL("C:/Users/erche/Desktop/claude_projecto/bitburner/tools/audit/boerse-sim.mjs").href);
const H = await import(pathToFileURL("C:/Users/erche/Desktop/claude_projecto/bitburner/src/lib/handel.js").href);
const SEEDS = 60, START = Number(process.argv[2] || 250e6);
function lib(opts) {
  const regel = { ...H.REGEL, ...(opts.regel || {}) };
  const st = { hat4S: false, hist: new Map() };
  const lageVon = (m) => m.stocks.map((s) => { const e = st.hat4S ? { f: s.forecast(), mv: s.mv, ticks: 999 } : H.schaetze(st.hist.get(s.symbol), regel.fenster);
    return { sym: s.symbol, f: e.f, mv: e.mv, ticks: e.ticks, quelle: st.hat4S ? "4S" : "Historie", lang: s.playerShares, ask: s.getAskPrice(), bid: s.getBidPrice(), maxStueck: s.maxShares }; });
  return { state: st, act(m, acc) {
    for (const s of m.stocks) { let h = st.hist.get(s.symbol); if (!h) { h = []; st.hist.set(s.symbol, h); } h.push(s.price); while (h.length > regel.fenster + 1) h.shift(); }
    let lage = lageVon(m);
    if (opts.schwelle4S && H.kauf4SFaellig(acc.cash + H.depotwert(lage), st.hat4S, opts.schwelle4S)) {
      for (const v of H.freimachen(lage, acc.cash, H.KOSTEN_4S)) acc.sell(m.bySym[v.sym], v.stueck);
      if (acc.cash >= H.KOSTEN_4S) { acc.cash -= H.KOSTEN_4S; st.hat4S = true; lage = lageVon(m); }
    }
    for (const sym of H.verkaufsliste(lage, regel)) acc.sell(m.bySym[sym], m.bySym[sym].playerShares);
    lage = lageVon(m);
    const res = st.hat4S && opts.betrieb ? opts.betrieb * (acc.cash + H.depotwert(lage)) : 0;
    for (const k of H.kaufliste(lage, acc.cash, res, regel)) acc.buy(m.bySym[k.sym], k.stueck);
  } };
}
function messe(name, mk) {
  const tief = [], t1 = [], tBio = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    let min = Infinity, h1 = Infinity, hB = Infinity;
    run({ seed: 5000 + seed, cash: START, ticks: 36 * 600, strategy: mk(), onTick: (m, acc, t) => { const w = acc.wealth(m); if (w < min) min = w; if (h1 === Infinity && w >= 4 * START) h1 = t / 600; if (hB === Infinity && w >= 1e12) hB = t / 600; } });
    tief.push(min / START); t1.push(h1); tBio.push(hB);
  }
  const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  const f = (x) => (Number.isFinite(x) ? x.toFixed(1) : "nie");
  console.log(name.padEnd(34), "| Tiefpunkt/Start: min", q(tief, 0).toFixed(2), "p5", q(tief, 0.05).toFixed(2), "p50", q(tief, 0.5).toFixed(2),
    "| x4: p50", f(q(t1, 0.5)), "p95", f(q(t1, 0.95)), "max", f(q(t1, 0.999)), "| 1 Bio: p50", f(q(tBio, 0.5)), "p95", f(q(tBio, 0.95)), "max", f(q(tBio, 0.999)));
}
console.log("Start", START / 1e6, "Mio,", SEEDS, "Seeds, 36 h");
messe("alt (boerse.js)", () => makeBotStrategy({ fourS: false, buy4S: true }));
for (const maxAnteil of [1, 0.5, 0.34, 0.25]) messe("lib maxAnteil " + maxAnteil, () => lib({ schwelle4S: 45e9, regel: { maxAnteil } }));
messe("lib maxAnteil 1, Betrieb 2 %", () => lib({ schwelle4S: 45e9, betrieb: 0.02 }));
messe("lib maxAnteil 0.5, Betrieb 2 %", () => lib({ schwelle4S: 45e9, betrieb: 0.02, regel: { maxAnteil: 0.5 } }));
