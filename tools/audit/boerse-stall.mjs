// Audit 03.10.2026, Bereich BOERSE: Was passiert mit dem Depot, wenn der
// Haendler stehen bleibt (Skript tot, Bruecke weg, Rechner schlaeft und der
// Markt holt nach - StockMarket.ts:239-256 verarbeitet gespeicherte Zyklen
// mit 1 Tick je 4 s)? Ausserhalb BN8/SF8.3 gibt es keine Stop-Orders
// (NetscriptFunctions/StockMarket.ts:176-187), das Depot treibt ungeschuetzt.
// Modell: 4S-Haendler (Long) laeuft 6 h ab 10 Mrd, dann eingefroren fuer S
// Stunden; gemessen: Vermoegen nach S h relativ zum Einfrierzeitpunkt.
// Aufruf: node tools/audit/boerse-stall.mjs [--seeds N]
import { Market, Account, makeOptStrategy } from "./boerse-sim.mjs";
const a = process.argv.slice(2);
const SEEDS = a.includes("--seeds") ? Number(a[a.indexOf("--seeds") + 1]) : 40;
const TPH = 600;
const q = (x, p) => { const b = [...x].sort((u, v) => u - v); return b[Math.floor(p * (b.length - 1))]; };
for (const S of [0.25, 1, 4, 8]) {
  const rel = [];
  for (let s = 1; s <= SEEDS; s++) {
    const m = new Market(9000 + s), acc = new Account(10e9), st = makeOptStrategy({ entry: 0.05 });
    for (let t = 0; t < 6 * TPH; t++) { m.tick(); st.act(m, acc); }
    const w0 = acc.wealth(m);
    for (let t = 0; t < S * TPH; t++) m.tick();
    rel.push(acc.wealth(m) / w0);
  }
  console.log("Stillstand " + S + " h: Vermoegen relativ  Median " + q(rel, 0.5).toFixed(3) + "  10-%-Quantil " + q(rel, 0.1).toFixed(3) + "  schlechtester " + Math.min(...rel).toFixed(3) + "  bester " + Math.max(...rel).toFixed(3));
}
