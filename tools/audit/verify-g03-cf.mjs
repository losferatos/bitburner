// Gegenpruefung G03: Gegenlauf "dieselben ausgefuehrten Ausbauten ohne Sperre" je Fenster.
// A-Teil des Befunds (INFRA-1): nur die tatsaechlich ausgefuehrten Ausbauten werden vorgezogen,
// keine zusaetzlichen. Unterschiede zu infra-throttle.mjs:
//  - Ruecklage (data/geldbedarf.txt) wird von der Geldregel abgezogen (bn4net.js:1272, :1513)
//  - Zyklus aus verify-g03-sim.mjs (F1 = 40 s, F2/F3b = 10-20 s), nicht angenommen
//  - Ertrag je GB*s zeitabhaengig aus den Intervallen, Anlauf-Verzoegerung L waehlbar
//  - Amortisations-Pruefung des Kerns (amort <= Deckel) im Gegenlauf mit der Bot-Telemetrie (grenz)
// Aufruf: node tools/audit/verify-g03-cf.mjs [takt=40] [lag=0]
import { loadAll, cloudCost, interp, fmt } from "./verify-g03-lib.mjs";
import { readSave } from "./infra-save.mjs";

const takt = Number(process.argv[2] || 40);
const lag = Number(process.argv[3] || 0);
const { saves, ev, executed, cuts } = loadAll();

// --- Eichung 1: Preisformel gegen die vom Spiel geschriebene Preistabelle (BN2.2) -------------
{
  const f = saves.filter((s) => s.lauf === 2).pop().f;
  const { servers } = readSave("backups/" + f);
  const tf = servers.home.data.textFiles.data.find(([n]) => n === "data/preise.json")[1];
  const preise = JSON.parse((tf.data || tf).text).preise;
  let maxRel = 0;
  for (const [gb, p] of Object.entries(preise)) maxRel = Math.max(maxRel, Math.abs(cloudCost(Number(gb)) / p - 1));
  console.log("Eichung 1 (Preis, " + Object.keys(preise).length + " Groessen, Spiel " + f.slice(25, 50) + "): max rel. Abweichung Formel/Spiel =", maxRel.toExponential(2), "(Soll 0)");
}
// --- Eichung 2: Ausbaukosten gegen die im Log genannten "rund X m" -----------------------------
{
  let maxRel = 0, n = 0;
  for (const u of executed) {
    const c = cloudCost(u.to) - cloudCost(u.from);
    maxRel = Math.max(maxRel, Math.abs(c - u.costLog) / c); n++;
  }
  console.log("Eichung 2 (Ausbaukosten, " + n + " Ausbauten): max rel. Abweichung Formel/Log =", (maxRel * 100).toFixed(2), "% (Log auf 0,1 m gerundet; Soll < 1 %)");
}

// --- Fenster ---------------------------------------------------------------------------------
const L = (a, b) => saves.filter((s) => s.t >= a && s.t <= b);
const wins = [
  { name: "W1 BN2.1 03.10. (Audit-Fenster)", start: null, endSave: "BN2L1_2026-10-03T09-59", lauf: 1, saveFilter: (s) => s.lauf === 1 && s.t <= new Date(2026, 9, 3, 10, 0).getTime() },
  { name: "W2 BN2.1 03.10.19:01-04.10.07:05", lauf: 1, saveFilter: (s) => s.t >= new Date(2026, 9, 3, 19, 17).getTime() && s.t <= new Date(2026, 9, 4, 7, 6).getTime() && s.lauf === 1, startAt: new Date(2026, 9, 3, 19, 1, 0).getTime() },
  { name: "W3 BN2.1 04.10.07:05-10:38", lauf: 1, saveFilter: (s) => s.t >= new Date(2026, 9, 4, 7, 17).getTime() && s.t <= new Date(2026, 9, 4, 10, 39).getTime() && s.lauf === 1, startAt: new Date(2026, 9, 4, 7, 5, 0).getTime() },
  { name: "W4 BN2.2 04.10.10:38-13:17", lauf: 2, saveFilter: (s) => s.lauf === 2, startAt: new Date(2026, 9, 4, 10, 38, 34).getTime() },
];

const grenz1 = (s) => (s.tel && s.tel.mischung && s.tel.mischung.grenz ? s.tel.mischung.grenz[0] : NaN);

function ertragReihe(ws) {
  // Ertrag je GB*s je Intervall (Rate gegen Bestand: Zuwachs / Spielzeit / mittlerer RAM)
  const out = [];
  for (let i = 1; i < ws.length; i++) {
    const a = ws[i - 1], b = ws[i];
    if (!(b.tBN > a.tBN) || (b.tBN - a.tBN) * 3600 < 600) continue;
    const dt = (b.tBN - a.tBN) * 3600;
    const ram = ((a.ramHome + a.park + a.foreign) + (b.ramHome + b.park + b.foreign)) / 2;
    out.push({ a: a.t, b: b.t, y: (b.hackInc - a.hackInc) / dt / ram, ram });
  }
  return out;
}
const yAt = (ys, t) => {
  if (!ys.length) return NaN;
  if (t <= ys[0].a) return ys[0].y;
  for (const y of ys) if (t <= y.b) return y.y;
  return ys[ys.length - 1].y;
};

for (const w of wins) {
  const ws = saves.filter(w.saveFilter).sort((a, b) => a.t - b.t);
  if (ws.length < 2) continue;
  const tStart = w.startAt || (ws[0].t - ws[0].tBN * 3.6e6);
  const tEnd = ws[ws.length - 1].t;
  const seq = executed.filter((u) => u.order >= tStart && u.done <= tEnd + 60000).sort((a, b) => a.done - b.done);
  if (!seq.length) continue;
  const mp = [{ t: tStart, v: 0 }, ...ws.map((s) => ({ t: s.t, v: s.money }))];
  const rp = [{ t: tStart, v: 0 }, ...ws.map((s) => ({ t: s.t, v: s.reserved }))];
  const gp = ws.map((s) => ({ t: s.t, v: grenz1(s) })).filter((p) => Number.isFinite(p.v));
  const ys = ertragReihe(ws);
  const cost = seq.map((u) => cloudCost(u.to) - cloudCost(u.from));
  const gbOf = seq.map((u) => u.to - u.from);

  function run(useReserve, useGate) {
    const cf = [];
    let tPrev = seq[0].done - takt * 1000;
    for (let i = 0; i < seq.length; i++) {
      let t = tPrev + takt * 1000;
      const done = seq[i].done;
      const extra = (tt) => { let e = 0; for (let j = 0; j < i; j++) if (cf[j] <= tt && seq[j].done > tt) e += cost[j]; return e; };
      while (t < done) {
        const free = interp(mp, t) - (useReserve ? interp(rp, t) : 0) - extra(t);
        let gateOk = true;
        if (useGate && seq[i].amort && gp.length) {
          const scale = interp(gp, done) / interp(gp, t);          // Bot-Grenzertrag war frueher kleiner -> Amortisation laenger
          gateOk = seq[i].amort * scale <= 600 + 1e-9 || seq[i].amort > 600;   // Deckel 600 (wartend>=2); war die Bestellung ueber 600, galt 1800
          if (seq[i].amort > 600) gateOk = seq[i].amort * scale <= 1800;
        }
        if (free >= 2 * cost[i] && gateOk) break;
        t += 10000;
      }
      cf.push(Math.min(t, done));
      tPrev = cf[i];
    }
    let gbs = 0, dollars = 0, gbsNoLag = 0;
    for (let i = 0; i < seq.length; i++) {
      const a = cf[i] + lag * 1000, b = Math.min(seq[i].done + lag * 1000, tEnd);
      if (b <= a) continue;
      // Integral des Ertrags (stueckweise konstant je Intervall)
      let tt = a, acc = 0;
      while (tt < b) {
        const step = Math.min(b, tt + 60000);
        acc += yAt(ys, (tt + step) / 2) * (step - tt) / 1000;
        tt = step;
      }
      dollars += gbOf[i] * acc;
      gbs += gbOf[i] * (b - a) / 1000;
    }
    const last = seq.length - 1;
    return { cf, gbs, dollars, lastCf: cf[last], lastReal: seq[last].done };
  }
  const hackTotal = ws[ws.length - 1].hackInc;
  console.log("\n==== " + w.name + ": " + fmt(tStart) + " -> " + fmt(tEnd) + "  (" + ((tEnd - tStart) / 3.6e6).toFixed(2) + " h), ausgefuehrte Ausbauten: " + seq.length +
    ", Hacking-Einnahmen im Knoten bis Ende: " + (hackTotal / 1e9).toFixed(2) + " Mrd $");
  console.log("  Ertrag je GB*s je Intervall:", ys.map((y) => y.y.toFixed(0)).join(" "), " Ruecklage-Reihe (Mio):", ws.map((s) => (s.reserved / 1e6).toFixed(0)).join(" "));
  const hours = (tEnd - tStart) / 3.6e6;
  for (const [lab, ur, ug] of [["Geld ohne Ruecklage, ohne Amort-Pruefung (wie Bericht)", false, false], ["Geld MIT Ruecklage", true, false], ["Geld MIT Ruecklage + Amort-Pruefung (Bot-Regel)", true, true]]) {
    const r = run(ur, ug);
    console.log("  " + lab.padEnd(58), "letzter Ausbau echt", fmt(r.lastReal).slice(6), "Gegenlauf", fmt(r.lastCf).slice(6),
      " GB*s", r.gbs.toExponential(2), " Gewinn", (r.dollars / 1e9).toFixed(2), "Mrd $ =", (r.dollars / 1e9 / hours).toFixed(2), "Mrd $/h (Takt " + takt + " s, Anlauf " + lag + " s)");
  }
}

// --- Eichung 3: Park-Rekonstruktion aus den Log-Ausbauten gegen purchasedRamTotal ------------
console.log("\nEichung 3: Park aus Log-Ausbauten rekonstruiert (Anker = erster Stand des Fensters) gegen Spielstand");
for (const w of wins) {
  const ws = saves.filter(w.saveFilter).sort((a, b) => a.t - b.t);
  if (ws.length < 2) continue;
  const seq = executed.filter((u) => u.done > ws[0].t && u.done <= ws[ws.length - 1].t + 60000);
  let ok = 0, tot = 0, rows = [];
  for (let i = 1; i < ws.length; i++) {
    const add = seq.filter((u) => u.done > ws[0].t && u.done <= ws[i].t).reduce((a, u) => a + (u.to - u.from), 0);
    const soll = ws[i].park - ws[0].park, ist = add;
    tot++; if (soll === ist) ok++;
    rows.push(fmt(ws[i].t).slice(6, 11) + ":" + soll + "/" + ist);
  }
  console.log("  " + w.name.slice(0, 34).padEnd(34), "exakt", ok + "/" + tot, " Soll/Ist je Stand (Zuwachs seit Anker, GB):", rows.join(" "));
}
