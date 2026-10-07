// Eichung der Corp-Formeln (Nachbau aus reference/bitburner-src/src/Corporation) gegen echte Werte.
// Quellen: Corporation.ts:200-232 (Bewertung), :250-261 (Zielkurs), :333-354 (Angebot), Actions.ts:612-656 (Bestechung).
import fs from "node:fs"; import zlib from "node:zlib"; import path from "node:path";
const SPC = 10; // secondsPerMarketCycle = 50 Zyklen * 200 ms / 1000 (Constants.ts:53-55)
const ROUND_SHARES = [0.1, 0.35, 0.25, 0.2], ROUND_MULT = [3, 2, 2, 1.5]; // Constants.ts:71-72
const offer = (val, round) => val * ROUND_SHARES[round] * ROUND_MULT[round];
const bribeRep = (funds) => funds / 1e9; // Constants.ts:62
function officeCount(c){let n=0;for(const [,d] of c.divisions.data){n+=Object.keys(d.data.offices||{}).length+Object.keys(d.data.warehouses||{}).length;}return n;}
function cycleVal(c, nodeMult = 1) {
  const nOW = officeCount(c);
  let assetDelta = (c.totalAssets - c.previousTotalAssets) / SPC, val;
  if (c.public) {
    if (c.dividendRate > 0) assetDelta *= 1 - c.dividendRate;
    val = c.funds + assetDelta * 85e3;
    val *= Math.pow(1.0079741404289038, nOW);
    val = Math.max(val, 0);
  } else {
    val = 10e9 + c.funds / 3;
    if (assetDelta > 0) val += assetDelta * 315e3;
    val *= Math.pow(1.0079741404289038, nOW);
    val -= val % 1e6;
  }
  if (val < 10e9) val = 10e9;
  return val * nodeMult;
}
const targetPrice = (c) => (c.valuation * (0.5 + Math.sqrt(Math.max(0, c.numShares / c.totalShares)))) / c.totalShares;
let fehler = 0;
const pruef = (name, ist, soll, tol) => { const rel = Math.abs(ist - soll) / Math.abs(soll); const ok = rel <= tol; if (!ok) fehler++; console.log(`${ok ? "OK " : "XX "} ${name}: Formel ${ist.toPrecision(6)} / echt ${soll.toPrecision(6)} (rel ${rel.toExponential(1)})`); };
// 1. Log-Werte (data/corp-log.txt BN3.3, data/corp.json)
pruef("Runde 1 BN3.3 (Bewertung 217,1 Mrd)", offer(217.0619e9, 0), 65.1186e9, 1e-3);
pruef("Runde 2 Angebot BN3.3 (corp.json valuation 233.7539e9)", offer(233.7539e9, 1), 163.6e9, 1e-3);
pruef("Bestechung Black Hand 306 Bio", bribeRep(306e12), 306000, 1e-9);
pruef("Bestechung Slum Snakes 68,85 Bio", bribeRep(68.85e12), 68850, 1e-9);
// 2. Spielstaende: gespeicherte cycleValuation gegen Nachbau aus gespeicherten Feldern
const dir = "C:/Users/erche/Desktop/claude_projecto/bitburner/backups";
for (const f of fs.readdirSync(dir).filter(f => /BN3L[23]/.test(f))) {
  const pd = JSON.parse(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString()).data.PlayerSave).data;
  const c = pd.corporation?.data; if (!c) continue;
  if (!(c.cycleValuation > 0)) continue;
  const nach = cycleVal(c);
  const rel = Math.abs(nach - c.cycleValuation) / c.cycleValuation;
  console.log(`${rel < 1e-6 ? "OK " : "-- "} ${f.slice(23, 50)} cycleValuation echt ${c.cycleValuation.toExponential(6)} Nachbau ${nach.toExponential(6)} rel ${rel.toExponential(1)}`);
}
console.log(fehler ? fehler + " Abweichungen" : "alle Log-Eichpunkte OK");
