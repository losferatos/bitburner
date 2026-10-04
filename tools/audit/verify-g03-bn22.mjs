// Gegenpruefung G03: B-Teil in BN2.2 - was haette der Kern mit seinen EIGENEN Regeln
// (kleinster zuerst, amort <= Deckel 1800 s, 2 x Kosten <= Geld - Ruecklage) ohne die Sperre
// bis zum letzten Spielstand (13:17) gebaut, mit Geld-Rueckkopplung?
// Eingaben (alles aus Spielstaenden): Geldkurve, Ruecklage, realer Park (Log-Ausbauten, Eichung exakt),
// Ertrag je GB*s je Intervall (gemessen), Bot-Grenzertrag (Telemetrie mischung.grenz).
// Ungeeicht ist allein der Grenzertrag fuer zusaetzliches RAM: Annahme = gemessener Durchschnitt
// (BN2.1-Fenster W2 zeigt Grenz >= Durchschnitt, siehe verify-g03-yield.mjs); Band 0,5x..1,0x.
// Aufruf: node tools/audit/verify-g03-bn22.mjs [ertragsfaktor=1.0] [takt=40] [cap=512] [W3|W4]
import { loadAll, cloudCost, interp, fmt } from "./verify-g03-lib.mjs";

const fac = Number(process.argv[2] || 1.0);
const takt = Number(process.argv[3] || 40);
const cap = Number(process.argv[4] || 512);
const WIN = process.argv[5] || "W4";   // W4 = BN2.2 (10:38-13:17), W3 = BN2.1 nach Einbau 07:05-10:38 (Ruecklage-Regime)   // Obergrenze je Rechner im Gegenlauf (Kapazitaetsbremse des Kerns nicht nachgebaut, siehe Kopf)
const { saves, executed } = loadAll();
const ws = (WIN === "W3" ? saves.filter((s) => s.lauf === 1 && s.t >= new Date(2026, 9, 4, 7, 17).getTime() && s.t <= new Date(2026, 9, 4, 10, 39).getTime())
  : saves.filter((s) => s.lauf === 2)).sort((a, b) => a.t - b.t);
const tStart = WIN === "W3" ? new Date(2026, 9, 4, 7, 5, 0).getTime() : new Date(2026, 9, 4, 10, 38, 34).getTime();
const tEnd = ws[ws.length - 1].t;
const seqReal = executed.filter((u) => u.order >= tStart && u.done <= tEnd + 60000).sort((a, b) => a.done - b.done);
const t0 = seqReal[0].order;

const mp = [{ t: tStart, v: 0 }, ...ws.map((s) => ({ t: s.t, v: s.money }))];
const rp = [{ t: tStart, v: 0 }, ...ws.map((s) => ({ t: s.t, v: s.reserved }))];
const g1 = ws.map((s) => ({ t: s.t, v: s.tel.mischung.grenz[0] }));
const g4 = ws.map((s) => ({ t: s.t, v: s.tel.mischung.grenz[1] }));
const g16 = ws.map((s) => ({ t: s.t, v: s.tel.mischung.grenz[2] }));
const eff = ws.map((s) => ({ t: s.t, v: s.tel.mischung.effFlotte }));
// gemessener Ertrag je GB*s je Intervall
const ys = [];
for (let i = 1; i < ws.length; i++) {
  const a = ws[i - 1], b = ws[i];
  if ((b.tBN - a.tBN) * 3600 < 600) continue;
  const ram = ((a.ramHome + a.park + a.foreign) + (b.ramHome + b.park + b.foreign)) / 2;
  ys.push({ a: a.t, b: b.t, y: (b.hackInc - a.hackInc) / ((b.tBN - a.tBN) * 3600) / ram });
}
const yAt = (t) => { for (const y of ys) if (t <= y.b) return y.y; return ys[ys.length - 1].y; };
console.log("Gemessener Ertrag je GB*s (Intervalle):", ys.map((y) => fmt(y.a).slice(6, 11) + "-" + fmt(y.b).slice(6, 11) + ": " + y.y.toFixed(0)).join(" | "));
console.log("Bot-Modell effFlotte je Stand:", ws.map((s) => s.tel.mischung.effFlotte).join(" "), " -> Verhaeltnis gemessen/Modell:", ys.map((y, i) => (y.y / ws[i + 1].tel.mischung.effFlotte).toFixed(2)).join(" "));

// Park real zur Zeit t
const parkReal = (t) => 1600 + seqReal.filter((u) => u.done <= t).reduce((a, u) => a + (u.to - u.from), 0)
  + (seqReal.length && seqReal[0].from === 32 ? 0 : 0);
// Anker: erster Stand 11:17 hat park 1792 -> Start 25x64 + 192 (3 Ausbauten 64->128) = 1792: stimmt mit 1600 + 3x64
const grenzModell = (t, gb) => {
  const a = interp(g1, t), b = interp(g4, t), c = interp(g16, t);
  if (gb <= 1024) return a;
  if (gb <= 4096) return a + (b - a) * Math.log(gb / 1024) / Math.log(4);
  return b + (c - b) * Math.min(1, Math.log(gb / 4096) / Math.log(4));
};

// Gegenlauf mit Rueckkopplung (Schritt 10 s)
const hosts = Array(25).fill(64);
let spentCf = 0, extraIncome = 0, nextAllowed = t0;
const cfUp = [];
let tPrev = t0;
for (let t = t0; t <= tEnd; t += 10000) {
  const dt = 10;
  // Mehrertrag aus zusaetzlichem RAM (cf-Park minus realer Park)
  const parkCf = hosts.reduce((a, b) => a + b, 0);
  const pr = parkReal(t);
  extraIncome += Math.max(0, parkCf - pr) * yAt(t) * fac * dt;
  // reale Ausbauten bis t: ihr Geld ist im realen Verlauf schon weg
  const spentReal = seqReal.filter((u) => u.done <= t).reduce((a, u) => a + (cloudCost(u.to) - cloudCost(u.from)), 0);
  if (t < nextAllowed) continue;
  // kleinster Rechner
  let si = 0;
  hosts.forEach((g, i) => { if (g < hosts[si]) si = i; });
  const from = hosts[si], to = from * 2;
  if (to > cap) continue;
  const c = cloudCost(to) - cloudCost(from), zus = to - from;
  const model = grenzModell(t, zus);
  const amort = c / (zus * model);
  const free = interp(mp, t) - interp(rp, t) - (spentCf - spentReal) + extraIncome;
  if (amort <= 1800 && 2 * c <= free) {
    hosts[si] = to; spentCf += c; cfUp.push({ t, host: si, from, to, amort: Math.round(amort) });
    nextAllowed = t + takt * 1000;
  }
}
const parkCfEnd = hosts.reduce((a, b) => a + b, 0);
const parkRealEnd = parkReal(tEnd);
const rateExtra = (parkCfEnd - parkRealEnd) * yAt(tEnd) * fac;
console.log("\nGegenlauf BN2.2 (Takt " + takt + " s, cap " + cap + ", Ertragsfaktor " + fac + "): " + cfUp.length + " Ausbauten bis " + fmt(tEnd) + ", Park " + parkCfEnd + " GB (real " + parkRealEnd + " GB)");
console.log("  Verlauf Park cf:", [11.5, 12, 12.5, 13, 13.28].map((h) => { const tt = new Date(2026, 9, 4, Math.floor(h), Math.round((h % 1) * 60)).getTime(); return fmt(tt).slice(6, 11) + "=" + (25 * 64 + cfUp.filter((u) => u.t <= tt).reduce((a, u) => a + (u.to - u.from), 0)); }).join(" "));
console.log("  aufsummierter Mehrertrag bis " + fmt(tEnd).slice(6, 11) + ": " + (extraIncome / 1e9).toFixed(2) + " Mrd $ (gemessener Gesamtertrag Hacking bis dahin " + (ws[ws.length - 1].hackInc / 1e9).toFixed(2) + " Mrd $)");
console.log("  Mehrertrag-Rate am Ende: " + (rateExtra / 1e6).toFixed(2) + " M$/s = " + (rateExtra * 3.6 / 1e6).toFixed(2) + " Mrd $/h (Ist-Rate letzte Stunde " + ((ws[ws.length - 1].hackInc - ws[ws.length - 2].hackInc) / 1e9 / ((ws[ws.length - 1].t - ws[ws.length - 2].t) / 3.6e6)).toFixed(2) + " Mrd $/h)");
const last = cfUp[cfUp.length - 1];
console.log("  letzter Ausbau im Gegenlauf:", last ? fmt(last.t).slice(6, 14) + " " + last.from + "->" + last.to + " amort " + last.amort + " s" : "-");
const ends = {};
hosts.forEach((g) => { ends[g] = (ends[g] || 0) + 1; });
console.log("  Rechnergroessen am Ende:", JSON.stringify(ends));
