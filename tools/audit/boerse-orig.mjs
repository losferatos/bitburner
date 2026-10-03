// Audit 03.10.2026, Bereich BOERSE: laedt den ORIGINALEN Quelltext des
// Aktienmarkts (Spiel 3.0.2) und macht ihn ausfuehrbar - ohne Abschreiben.
//
// Weg: node:module stripTypeScriptTypes (mode "transform", kann auch enums)
// auf die Originaldateien, Importzeilen raus, die wenigen Fremdabhaengigkeiten
// durch neutrale Stubs ersetzt:
//   processOrders            -> no-op (Limit-/Stop-Orders gibt es ausserhalb
//                               BN8/SF8.3 nicht, NetscriptFunctions/StockMarket.ts:183)
//   getDarknetVolatilityMult -> 1 (ohne Darknet-Werbung, DarkNet/effects/effects.ts:218-222)
//   scaleDarknetVolatilityIncreases -> no-op
//   Generic_toJSON/fromJSON  -> nur fuer Speichern, hier ungenutzt
// Math.random wird vom Aufrufer gesetzt (seeded), damit Original und
// Nachbau (boerse-sim.mjs) denselben Zufallsstrom sehen.
//
// Benutzte Originaldateien (reference/bitburner-src/src):
//   StockMarket/Stock.ts                  vollstaendig
//   StockMarket/StockMarketHelpers.ts     vollstaendig
//   StockMarket/StockMarket.ts            ab `function stockMarketCycle` (Z. 223-327)
//   StockMarket/data/Constants.ts         Konstanten
//   StockMarket/Enums.ts                  OrderType, PositionType
//   utils/helpers/getRandomIntInclusive.ts
//   Constants.ts                          MilliPerCycle
import fs from "node:fs";
import path from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = path.join(root, "reference", "bitburner-src", "src");
const rd = (p) => fs.readFileSync(path.join(SRC, p), "utf8");

function strip(code) {
  let js = stripTypeScriptTypes(code, { mode: "transform" });
  // Importe (auch mehrzeilig) entfernen
  js = js.replace(/^import[\s\S]*?from\s*["'][^"']+["'];?[ \t]*$/gm, "");
  js = js.replace(/^export\s+(?=(const|let|var|function|class|async))/gm, "");
  return js;
}

export function loadOriginal() {
  // Konstanten
  const consts = rd("StockMarket/data/Constants.ts");
  const constBody = /=\s*(\{[\s\S]*?\});/.exec(consts)[1];
  const milli = Number(/MilliPerCycle:\s*([0-9.e]+)/.exec(rd("Constants.ts"))[1]);
  // Enums (nur die beiden reinen enums aus Enums.ts)
  const enums = rd("StockMarket/Enums.ts");
  const enumSrc = [...enums.matchAll(/export enum (OrderType|PositionType) \{[\s\S]*?\n\}/g)].map((m) => m[0]).join("\n");
  // Teile
  const rnd = strip(rd("utils/helpers/getRandomIntInclusive.ts"));
  const stock = strip(rd("StockMarket/Stock.ts"));
  const helpers = strip(rd("StockMarket/StockMarketHelpers.ts"));
  const sm = rd("StockMarket/StockMarket.ts");
  const from = sm.indexOf("function stockMarketCycle");
  if (from < 0) throw new Error("stockMarketCycle nicht gefunden");
  const tickPart = strip(sm.slice(from));

  const src = [
    '"use strict";',
    "const StockMarketConstants = " + constBody + ";",
    "const CONSTANTS = { MilliPerCycle: " + milli + " };",
    strip(enumSrc),
    "const processOrders = () => {};",
    "const scaleDarknetVolatilityIncreases = () => {};",
    "const getDarknetVolatilityMult = () => 1;",
    "const StockMarketPromise = { promise: null, resolve: null };",
    "const SymbolToStockMap = {};",
    "const Generic_toJSON = () => null, Generic_fromJSON = () => null, constructorsForReviver = {};",
    "let StockMarket = { lastUpdate: 0, Orders: {}, storedCycles: 0, ticksUntilCycle: 0 };",
    rnd,
    stock,
    helpers,
    tickPart,
    "return { Stock, StockForecastInfluenceLimit, getBuyTransactionCost, getSellTransactionGain,",
    "  processTransactionForecastMovement, calculateBuyMaxAmount, forecastChangePerPriceMovement,",
    "  getRandomIntInclusive, stockMarketCycle, processStockPrices, cyclesPerStockUpdate, PositionType, OrderType,",
    "  StockMarketConstants, market: () => StockMarket, setMarket: (m) => { StockMarket = m; } };",
  ].join("\n");
  const mod = new Function(src)();
  // Ein Kursschritt: die Wanduhr-Sperre (StockMarket.ts:251-252, 4 s) wird
  // durch lastUpdate = 0 geoeffnet, storedCycles bekommt genau einen Schritt.
  mod.tick = () => {
    mod.market().lastUpdate = 0;
    mod.processStockPrices(mod.cyclesPerStockUpdate);
  };
  return mod;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const o = loadOriginal();
  console.log("geladen:", Object.keys(o).join(", "));
  console.log("cyclesPerStockUpdate =", o.cyclesPerStockUpdate, "Konstanten:", JSON.stringify(o.StockMarketConstants));
}
