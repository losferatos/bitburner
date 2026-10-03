// Audit 03.10.2026, Bereich BOERSE: liest StockMarketSave und die
// Boersen-Felder des Spielers aus allen Spielstaenden unter backups/.
// Nur lesen, nichts schreiben.
//
// Aufruf:
//   node tools/audit/boerse-save.mjs            Uebersicht je Spielstand
//   node tools/audit/boerse-save.mjs --stocks F Aktienliste eines Spielstands
//
// Spalten: Zugang (WSE/TIX/4S/4S-API), moneySourceA/B.stock, ob der Markt
// initialisiert ist (lastUpdate > 0, StockMarket.ts:171-173), Zahl der
// Aktien, Summe der Spielerpositionen.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = path.join(root, "backups");

export function readSave(file) {
  const buf = fs.readFileSync(file);
  let txt;
  try {
    txt = zlib.gunzipSync(buf).toString("utf8");
  } catch {
    txt = zlib.gunzipSync(Buffer.from(buf.toString("latin1"), "latin1")).toString("utf8");
  }
  let obj = JSON.parse(txt);
  if (typeof obj === "string") obj = JSON.parse(obj);
  return obj;
}

export function parseMaybe(s) {
  if (typeof s !== "string") return s;
  try { return JSON.parse(s); } catch { return s; }
}

export function playerOf(save) {
  const d = save.data ?? save;
  const ps = parseMaybe(d.PlayerSave);
  return ps?.data ?? ps;
}

// Liefert {meta, stocks[]} aus dem StockMarketSave (Stock-Objekte sind
// {ctor:"Stock", data:{...}} - Generic_toJSON, Stock.ts:268-275).
export function stockMarketOf(save) {
  const d = save.data ?? save;
  const sm = parseMaybe(d.StockMarketSave);
  if (!sm || typeof sm !== "object") return { meta: null, stocks: [] };
  const stocks = [];
  const meta = {};
  for (const [k, v] of Object.entries(sm)) {
    if (v && typeof v === "object" && v.ctor === "Stock") stocks.push({ key: k, ...v.data });
    else meta[k] = v;
  }
  return { meta, stocks };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();

function main() {
  const iStocks = process.argv.indexOf("--stocks");
  if (iStocks > 0) {
    const f = process.argv[iStocks + 1];
    const save = readSave(path.isAbsolute(f) ? f : path.join(dir, f));
    const { meta, stocks } = stockMarketOf(save);
    console.log("meta", JSON.stringify({ lastUpdate: meta.lastUpdate, storedCycles: meta.storedCycles, ticksUntilCycle: meta.ticksUntilCycle }));
    for (const s of stocks) {
      console.log([s.symbol, s.name, "p=" + s.price.toFixed(2), "mv=" + s.mv, "otlk=" + s.otlkMag.toFixed(3),
        "b=" + s.b, "ff=" + s.otlkMagForecast.toFixed(2), "spr=" + s.spreadPerc, "tx=" + s.shareTxForMovement,
        "tot=" + s.totalShares, "max=" + s.maxShares, "cap=" + s.cap, "pl=" + s.playerShares,
        "ps=" + s.playerShortShares].join(" "));
    }
    return;
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json.gz")).sort();
  for (const f of files) {
    let save;
    try { save = readSave(path.join(dir, f)); } catch (e) { console.log(f, "LESEFEHLER", e.message); continue; }
    const p = playerOf(save);
    const { meta, stocks } = stockMarketOf(save);
    const acc = [p?.hasWseAccount ? "W" : "-", p?.hasTixApiAccess ? "T" : "-", p?.has4SData ? "4" : "-", p?.has4SDataTixApi ? "A" : "-"].join("");
    const msA = p?.moneySourceA?.data?.stock ?? p?.moneySourceA?.stock;
    const msB = p?.moneySourceB?.data?.stock ?? p?.moneySourceB?.stock;
    const pos = stocks.reduce((a, s) => a + (s.playerShares || 0) + (s.playerShortShares || 0), 0);
    console.log(f.replace("LIVE_197f4d61481686_", "").padEnd(52), "BN" + p?.bitNodeN, "acc=" + acc,
      "srcA.stock=" + (msA ?? "-"), "srcB.stock=" + (msB ?? "-"),
      "init=" + (meta && meta.lastUpdate > 0), "n=" + stocks.length, "pos=" + pos,
      "money=" + (p?.money ? p.money.toExponential(3) : "-"));
  }
}
