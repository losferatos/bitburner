// Audit 03.10.2026, Bereich BOERSE: Lohnt die Boerse in einem V2-Knoten?
//
// Modell (Markt = boerse-sim.mjs, bitgleich zum Original, boerse-eich.mjs):
//   - Hackeinkommen H [$/h] fliesst je Tick (6 s) als Bargeld zu.
//   - Der Markt startet FRISCH beim Kauf der TIX-API
//     (NetscriptFunctions/StockMarket.ts:316-334: initStockMarket, wenn noch
//     nicht initialisiert). Handel per Skript braucht NUR die TIX-API
//     (checkTixApiAccess, :41-45, :139-155); das WSE-Konto (200 Mio) nicht.
//   - 4S-API: 25 Mrd x FourSigmaMarketDataApiCost (StockMarketCosts.ts:7-9,
//     BitNode.tsx: BN7 2, BN11 4, BN13 10, sonst 1).
//   - Kein Leerverkauf (SF8.2 fehlt, NetscriptFunctions/StockMarket.ts:46-53).
// Strategien:
//   keine        nur Einkommen (Vergleichsbasis)
//   tix+4s       wartet auf 5 Mrd + 4S + 1 Mrd, kauft beides, handelt mit getForecast
//   tix>hist>4s  TIX ab 6 Mrd, Schaetzung aus Kurshistorie (w=40, e=0,1), 4S aus
//                dem Vermoegen, sobald >= 1,25 x 4S-Preis (Depot wird dazu verkauft)
//   tix+hist     nur TIX, nie 4S
// Ausgabe: Stunden ab Start, bis das Vermoegen (Bargeld + Depot zum Geldkurs,
// abzgl. Kommission) eine Schwelle erreicht; Median [min-max] ueber Seeds.
//
// Aufruf: node tools/audit/boerse-v2.mjs [--seeds N] [--H 5e9] [--c4s 25e9] [--cash0 0] [--hours 24]
import { Market, Account, makeOptStrategy, makeHistStrategy } from "./boerse-sim.mjs";

const a = process.argv.slice(2);
const arg = (k, d) => (a.includes(k) ? Number(a[a.indexOf(k) + 1]) : d);
const SEEDS = arg("--seeds", 8);
const TPH = 600;

export function simulateV2({ seed, H, c4s, cash0 = 0, hours, mode }) {
  const acc = new Account(cash0);
  let m = null, strat = null, has4S = false, tixAt = null, s4At = null;
  const perTick = H / TPH;
  const trace = [];
  for (let t = 1; t <= hours * TPH; t++) {
    acc.cash += perTick;
    if (mode !== "keine") {
      if (!m) {
        const need = mode === "tix+4s" ? 5e9 + c4s + 1e9 : 6e9;
        if (acc.cash >= need) {
          acc.cash -= 5e9; acc.spent += 5e9; tixAt = t;
          m = new Market(seed);
          if (mode === "tix+4s") { acc.cash -= c4s; acc.spent += c4s; has4S = true; s4At = t; strat = makeOptStrategy({ entry: 0.05 }); }
          else strat = makeHistStrategy({ window: 40, entry: 0.1 });
        }
      } else {
        m.tick();
        if (mode === "tix>hist>4s" && !has4S && acc.wealth(m) >= 1.25 * c4s) {
          for (const s of m.stocks) if (s.playerShares > 0) acc.sell(s, s.playerShares);
          if (acc.cash >= c4s) { acc.cash -= c4s; acc.spent += c4s; has4S = true; s4At = t; strat = makeOptStrategy({ entry: 0.05 }); }
        }
        strat.act(m, acc);
      }
    }
    if (t % 60 === 0) trace.push({ h: t / TPH, w: m ? acc.wealth(m) : acc.cash });
  }
  return { trace, tixAt: tixAt && tixAt / TPH, s4At: s4At && s4At / TPH, commissions: acc.commissions };
}

const med = (x) => { const b = [...x].sort((p, q) => p - q); return b[Math.floor(b.length / 2)]; };
const fmt = (x) => { if (!Number.isFinite(x)) return "nie"; const v = Math.abs(x); if (v >= 1e12) return (x / 1e12).toFixed(2) + "T"; if (v >= 1e9) return (x / 1e9).toFixed(1) + "B"; return (x / 1e6).toFixed(0) + "M"; };

export function table({ H, c4s, cash0 = 0, hours = 24, targets = [30e9, 100e9, 417.5e9, 1e12, 1e13], at = [6, 12, 24] }) {
  console.log("\nH = " + fmt(H) + "/h, 4S-API " + fmt(c4s) + ", Startgeld " + fmt(cash0) + ", " + SEEDS + " Seeds");
  for (const mode of ["keine", "tix+4s", "tix>hist>4s", "tix+hist"]) {
    const rs = [];
    for (let s = 1; s <= SEEDS; s++) rs.push(simulateV2({ seed: 500 + s, H, c4s, cash0, hours, mode }));
    const hit = targets.map((W) => rs.map((r) => r.trace.find((p) => p.w >= W)?.h ?? Infinity));
    const wAt = at.map((h) => rs.map((r) => r.trace.find((p) => Math.abs(p.h - h) < 1e-9)?.w ?? NaN));
    const row = [mode.padEnd(12)];
    row.push("TIX@" + (rs[0].tixAt ? med(rs.map((r) => r.tixAt)).toFixed(1) + "h" : "-") + " 4S@" + (rs.some((r) => r.s4At) ? med(rs.map((r) => r.s4At ?? Infinity)).toFixed(1) + "h" : "-"));
    row.push("| h bis " + targets.map((W, i) => fmt(W) + ":" + (Number.isFinite(med(hit[i])) ? med(hit[i]).toFixed(1) : "nie") + "[" + Math.min(...hit[i]).toFixed(1) + "-" + (Number.isFinite(Math.max(...hit[i])) ? Math.max(...hit[i]).toFixed(1) : "nie") + "]").join(" "));
    row.push("| Vermoegen " + at.map((h, i) => h + "h:" + fmt(med(wAt[i]))).join(" "));
    console.log(row.join(" "));
  }
}

const isMain = process.argv[1] && process.argv[1].endsWith("boerse-v2.mjs");
if (isMain) {
  if (a.includes("--H")) {
    table({ H: arg("--H", 5e9), c4s: arg("--c4s", 25e9), cash0: arg("--cash0", 0), hours: arg("--hours", 24) });
  } else {
    // Knoten der Restroute: H grob ueber ServerMaxMoney x ScriptHackMoney
    // relativ zu BN2 (0,08) skaliert, BN2-Basis 5 Mrd/h (moneySourceA BN2.1,
    // 4,6-6,4 Mrd/h in inventar-gang/aug); das ist eine GROBE Annahme.
    table({ H: 5e9, c4s: 25e9 });            // BN2 (und BN15 0,8x1: H hoeher, 4S x1)
    table({ H: 0.5e9, c4s: 25e9 });          // BN3 (0,04x0,2 = 0,008 -> H/10)
    table({ H: 0.6e9, c4s: 100e9 });         // BN11 (0,01 -> H/8, 4S x4)
    table({ H: 6e9, c4s: 50e9 });            // BN7 (0,2x0,5 = 0,1, 4S x2)
    table({ H: 4e9, c4s: 250e9 });           // BN13 (0,3375x0,2 = 0,0675, 4S x10)
  }
}
