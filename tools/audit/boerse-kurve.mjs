// Vermoegenskurve mit 4S ab Start (Regel aus src/lib/handel.js): Stunden bis zu
// einer Schwelle, Median und p75 ueber Seeds. Grundlage fuer den BN8-Routenrechner.
// Aufruf: node tools/audit/boerse-kurve.mjs [--seeds N] [--start 250e6] [--ohne4s]
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HIER = path.dirname(fileURLToPath(import.meta.url));
const { run } = await import(pathToFileURL(path.join(HIER, "boerse-sim.mjs")).href);
// BN_SRC=<Verzeichnis> rechnet gegen einen anderen Stand von src (Vergleich alt/neu).
const H = await import(pathToFileURL(path.join(process.env.BN_SRC || path.join(HIER, "..", "..", "src"), "lib", "handel.js")).href);
const a = process.argv.slice(2);
const SEEDS = a.includes("--seeds") ? Number(a[a.indexOf("--seeds") + 1]) : 24;
const START = a.includes("--start") ? Number(a[a.indexOf("--start") + 1]) : 250e6;
const MIT4S = !a.includes("--ohne4s");
const ZIELE = [1e9, 3e9, 10e9, 26e9, 45e9, 100e9, 200e9, 300e9, 500e9, 1e12, 1.5e12, 2e12, 3e12, 4e12, 5e12];

// Schaetzung ohne 4S wie in src/boerse.js: f aus dem Kursfilter, mv aus dem Fenster. Kennt das
// geladene handel.js den Filter nicht (alter Stand, BN_SRC), gilt das Fenster allein.
function schaetzer(fenster) {
  const st = { hist: new Map(), filter: new Map(), schritte: 0 };
  return {
    tick(m) {
      for (const s of m.stocks) {
        let h = st.hist.get(s.symbol); if (!h) { h = []; st.hist.set(s.symbol, h); }
        const davor = h.length ? h[h.length - 1] : null;
        h.push(s.price); while (h.length > fenster + 1) h.shift();
        if (H.filterNeu) { if (!st.filter.has(s.symbol)) st.filter.set(s.symbol, H.filterNeu()); if (davor !== null) H.filterSchritt(st.filter.get(s.symbol), Math.sign(s.price - davor)); }
      }
      st.schritte++;
    },
    von(sym) {
      const e = H.schaetze(st.hist.get(sym), fenster);
      return H.filterNeu ? { f: H.filterMittel(st.filter.get(sym)), mv: e.mv, ticks: st.schritte - 1 } : e;
    },
  };
}

function lib() {
  const st = { hat4S: MIT4S };
  const sch = schaetzer(H.REGEL.fenster);
  const lageVon = (m) => m.stocks.map((s) => {
    const e = st.hat4S ? { f: s.forecast(), mv: s.mv, ticks: 999 } : sch.von(s.symbol);
    return { sym: s.symbol, f: e.f, mv: e.mv, ticks: e.ticks, quelle: st.hat4S ? "4S" : "Historie", lang: s.playerShares, ask: s.getAskPrice(), bid: s.getBidPrice(), maxStueck: s.maxShares };
  });
  return { state: st, act(m, acc) {
    sch.tick(m);
    let lage = lageVon(m);
    if (!st.hat4S && H.kauf4SFaellig(acc.cash + H.depotwert(lage), false)) {
      for (const v of H.freimachen(lage, acc.cash, H.KOSTEN_4S)) acc.sell(m.bySym[v.sym], v.stueck);
      if (acc.cash >= H.KOSTEN_4S) { acc.cash -= H.KOSTEN_4S; st.hat4S = true; lage = lageVon(m); }
    }
    for (const sym of H.verkaufsliste(lage)) acc.sell(m.bySym[sym], m.bySym[sym].playerShares);
    lage = lageVon(m);
    const res = st.hat4S ? H.BETRIEBSANTEIL * (acc.cash + H.depotwert(lage)) : 0;
    for (const k of H.kaufliste(lage, acc.cash, res)) acc.buy(m.bySym[k.sym], k.stueck);
  } };
}
const zeiten = ZIELE.map(() => []);
for (let seed = 1; seed <= SEEDS; seed++) {
  const erreicht = ZIELE.map(() => Infinity);
  run({ seed: 9000 + seed, cash: START, ticks: 40 * 600, strategy: lib(), onTick: (m, acc, t) => {
    const w = acc.wealth(m);
    ZIELE.forEach((z, i) => { if (erreicht[i] === Infinity && w >= z) erreicht[i] = t / 600; });
  } });
  erreicht.forEach((h, i) => zeiten[i].push(h));
}
const q = (arr, p) => { const s = arr.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const f = (x) => (Number.isFinite(x) ? x.toFixed(2) : "nie");
console.log("Start " + START / 1e6 + " Mio, " + (MIT4S ? "4S ab Start" : "ohne 4S, Kauf ab Schwelle") + ", " + SEEDS + " Seeds");
const tab = [];
ZIELE.forEach((z, i) => { tab.push([z, q(zeiten[i], 0.5), q(zeiten[i], 0.75)]); console.log((z / 1e9 + " Mrd").padStart(10), "Median", f(q(zeiten[i], 0.5)).padStart(6), "h  p75", f(q(zeiten[i], 0.75)).padStart(6), "h"); });
console.log(JSON.stringify(tab.map((r) => [r[0], Number(f(r[1])), Number(f(r[2]))])));
