// Die Handelsregel aus lib/handel.js gegen das nachgebaute Marktmodell.
// Aufruf: node boerse-regel.mjs <pfad/zu/handel.js> [--seeds N] [--start 250e6]
import path from "node:path";
import { pathToFileURL } from "node:url";

const a = process.argv.slice(2);
const SIM = a.includes("--sim") ? a[a.indexOf("--sim") + 1] : "C:/Users/erche/Desktop/claude_projecto/bitburner/tools/audit/boerse-sim.mjs";
const { run, makeBotStrategy } = await import(pathToFileURL(path.resolve(SIM)).href);
const H = await import(pathToFileURL(path.resolve((a[0] && !a[0].startsWith("--") ? a[0] : "C:/Users/erche/Desktop/claude_projecto/bitburner/src/lib/handel.js"))).href);
const SEEDS = a.includes("--seeds") ? Number(a[a.indexOf("--seeds") + 1]) : 24;
const START = a.includes("--start") ? Number(a[a.indexOf("--start") + 1]) : 250e6;
const STUNDEN = 48;

export function makeLibStrategy(opts = {}) {
  const regel = { ...H.REGEL, ...(opts.regel || {}) };
  const st = { hat4S: !!opts.fourS, boughtAtTick: null, hist: new Map() };
  const lageVon = (m) => m.stocks.map((s) => {
    let h = st.hist.get(s.symbol);
    const e = st.hat4S ? { f: s.forecast(), mv: s.mv, ticks: 999 } : H.schaetze(h, regel.fenster);
    return { s, sym: s.symbol, f: e.f, mv: e.mv, ticks: e.ticks, quelle: st.hat4S ? "4S" : "Historie",
      lang: s.playerShares, ask: s.getAskPrice(), bid: s.getBidPrice(), maxStueck: s.maxShares };
  });
  return {
    name: "lib", state: st,
    act(m, acc) {
      for (const s of m.stocks) {
        let h = st.hist.get(s.symbol);
        if (!h) { h = []; st.hist.set(s.symbol, h); }
        h.push(s.price);
        while (h.length > regel.fenster + 1) h.shift();
      }
      let lage = lageVon(m);
      if (opts.schwelle4S && H.kauf4SFaellig(acc.cash + H.depotwert(lage), st.hat4S, opts.schwelle4S)) {
        for (const v of H.freimachen(lage, acc.cash, H.KOSTEN_4S)) acc.sell(m.bySym[v.sym], v.stueck);
        if (acc.cash >= H.KOSTEN_4S) {
          acc.cash -= H.KOSTEN_4S; acc.spent += H.KOSTEN_4S; st.hat4S = true; st.boughtAtTick = m.tickNo;
          lage = lageVon(m);
        }
      }
      for (const sym of H.verkaufsliste(lage, regel)) acc.sell(m.bySym[sym], m.bySym[sym].playerShares);
      lage = lageVon(m);
      for (const k of H.kaufliste(lage, acc.cash, opts.reserve || 0, regel)) acc.buy(m.bySym[k.sym], k.stueck);
    },
  };
}

function messe(name, mk, ziele) {
  const zeiten = ziele.map(() => []);
  for (let seed = 1; seed <= SEEDS; seed++) {
    const strat = mk();
    const erreicht = ziele.map(() => null);
    run({ seed: 1000 + seed, cash: START, ticks: STUNDEN * 600, strategy: strat, sampleEvery: 600, onTick: (m, acc, t) => {
      const w = acc.wealth(m);
      ziele.forEach((z, i) => { if (erreicht[i] === null && w >= z) erreicht[i] = t / 600; });
    } });
    erreicht.forEach((h, i) => zeiten[i].push(h === null ? Infinity : h));
  }
  const q = (arr, p) => { const s = arr.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  const f = (x) => (Number.isFinite(x) ? x.toFixed(1) : "nie");
  console.log(name.padEnd(46) + ziele.map((z, i) => (" | " + (z / 1e9) + " Mrd: " + f(q(zeiten[i], 0.5)) + " h (" + f(q(zeiten[i], 0.25)) + "-" + f(q(zeiten[i], 0.75)) + ")")).join(""));
}

const modus = a.includes("--4s") ? "4s" : a.includes("--hist") ? "hist" : "alle";
console.log("Start " + START / 1e6 + " Mio, " + SEEDS + " Seeds, Median (p25-p75)");
if (modus === "alle" || modus === "hist") {
  console.log("\n-- Phase 1 ohne 4S, kein 4S-Kauf --");
  const Z = [1e9, 26e9, 55e9];
  messe("alt (boerse.js)", () => makeBotStrategy({ fourS: false, buy4S: false }), Z);
  for (const fenster of [30, 40]) for (const einstiegHistorie of [0.05, 0.075, 0.1, 0.125, 0.15]) {
    messe("lib fenster " + fenster + " einstieg " + einstiegHistorie, () => makeLibStrategy({ regel: { fenster, einstiegHistorie } }), Z);
  }
}
if (modus === "alle") {
  console.log("\n-- mit 4S von Anfang an --");
  const Z = [26e9, 100e9, 1e12];
  messe("alt (boerse.js) 4S", () => makeBotStrategy({ fourS: true }), Z);
  for (const einstieg4S of [0.02, 0.05, 0.08]) messe("lib 4S einstieg " + einstieg4S, () => makeLibStrategy({ fourS: true, regel: { einstieg4S } }), Z);
}
if (modus === "alle" || modus === "4s") {
  console.log("\n-- ganzer Lauf: ohne 4S starten, 4S ab Vermoegensschwelle --");
  const Z = [100e9, 1e12, 3e12];
  messe("alt (boerse.js, Kauf bei 26 Mrd BAR)", () => makeBotStrategy({ fourS: false, buy4S: true }), Z);
  for (const s of [26e9, 35e9, 45e9, 55e9, 70e9, 90e9, 120e9]) messe("lib, 4S ab Vermoegen " + s / 1e9 + " Mrd", () => makeLibStrategy({ schwelle4S: s }), Z);
}
