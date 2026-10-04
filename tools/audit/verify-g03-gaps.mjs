// Gegenpruefung G03 (Doppelbestellung): Ereignisse aus allen BN2-Spielstaenden.
// Liest data/bn4net-log.txt und data/shop-log.txt aus jedem Spielstand (Ringpuffer,
// ueberlappend), fuehrt die Zeilen zusammen und wertet je Fenster aus:
//  - Ausbau-Bestellungen, Ergebnisse, Doppelbestellungen (gleicher Host+Ziel binnen 60 s)
//  - Abstand zwischen ausgefuehrten Ausbauten
//  - Geld zum Bestellzeitpunkt (aus den Spielstaenden, linear) gegen 2 x Kosten
// Aufruf: node tools/audit/verify-g03-gaps.mjs
import fs from "node:fs";
import { readSave, infraFacts } from "./infra-save.mjs";

const dir = "backups";
const files = fs.readdirSync(dir).filter((f) => /_BN2L[12]_/.test(f) && f.endsWith(".json.gz")).sort();

function stamp(f) {
  const m = f.match(/_BN2L(\d)_(\d{4})-(\d\d)-(\d\d)T(\d\d)-(\d\d)_/);
  return { lauf: Number(m[1]), d: new Date(Number(m[2]), Number(m[3]) - 1, Number(m[4]), Number(m[5]), Number(m[6]), 0) };
}

const lineMap = new Map();      // key = "YYYY-MM-DD HH:MM:SS text" -> {t, text}
const saves = [];
for (const f of files) {
  const { lauf, d } = stamp(f);
  let servers, facts;
  try { ({ servers } = readSave(dir + "/" + f)); facts = infraFacts(dir + "/" + f); } catch (e) { continue; }
  saves.push({ f, lauf, t: d.getTime(), money: facts.money, park: facts.purchasedRamTotal,
    tBN: facts.sinceBitnodeH, augs: facts.augsInstalled, hackInc: facts.moneySourceB.hacking || 0,
    parkList: facts.purchased.map((p) => p.maxRam) });
  for (const [name, tf] of servers.home.data.textFiles.data) {
    if (name !== "data/bn4net-log.txt" && name !== "data/shop-log.txt") continue;
    const text = (tf.data || tf).text || "";
    for (const l of text.split("\n")) {
      const m = l.match(/^(\d\d):(\d\d):(\d\d)\s+(.*)$/);
      if (!m) continue;
      const t = new Date(d.getTime());
      t.setHours(Number(m[1]), Number(m[2]), Number(m[3]), 0);
      if (t.getTime() > d.getTime() + 120000) t.setDate(t.getDate() - 1);   // Zeile aus dem Vortag
      const key = (name.includes("shop") ? "S|" : "K|") + t.getTime() + "|" + m[4];
      if (!lineMap.has(key)) lineMap.set(key, { t: t.getTime(), src: name.includes("shop") ? "shop" : "kern", text: m[4] });
    }
  }
}
const lines = [...lineMap.values()].sort((a, b) => a.t - b.t);
const fmt = (t) => new Date(t).toLocaleString("sv-SE").slice(5, 19);

// Ereignisse
const ev = [];
for (const l of lines) {
  let m;
  if (l.src !== "kern") continue;
  if ((m = l.text.match(/^(werk-\d+): (\d+) -> (\d+) GB bestellt fuer rund ([\d.]+)m(?:, amortisiert in (\d+) s| - ein Werkzeug)/)))
    ev.push({ t: l.t, k: "up", host: m[1], from: Number(m[2]), to: Number(m[3]), cost: Number(m[4]) * 1e6, amort: m[5] ? Number(m[5]) : null });
  else if ((m = l.text.match(/^Rechner bestellt: (\d+) GB/))) ev.push({ t: l.t, k: "kauf", gb: Number(m[1]) });
  else if ((m = l.text.match(/^Auftrag (\S+): erledigt \((\S+)\)/))) ev.push({ t: l.t, k: "ok", host: m[2] });
  else if ((m = l.text.match(/^Auftrag (\S+): nicht ausgefuehrt \((\S+)\)/))) ev.push({ t: l.t, k: "nok", why: m[2] });
}
// Installationen: Spielstand-Anlass pre-install / Knotenwechsel -> Fenstergrenzen aus den Spielstaenden
const cuts = saves.filter((s) => /pre-install|pre-jump/.test(s.f)).map((s) => s.t);
console.log("Spielstaende:", saves.length, " Zeilen:", lines.length, " Ereignisse:", ev.length);
console.log("Schnitte (Einbau/Sprung):", cuts.map(fmt).join(", "));

const wins = [];
let cur = { from: -Infinity, to: Infinity, ev: [] };
const bounds = [...cuts, Infinity].sort((a, b) => a - b);
let lo = -Infinity;
for (const b of bounds) { wins.push({ from: lo, to: b, ev: ev.filter((e) => e.t > lo && e.t <= b) }); lo = b; }

function moneyAt(t) {
  const s = saves.filter((x) => x.lauf >= 0).sort((a, b) => a.t - b.t);
  if (!s.length) return NaN;
  if (t <= s[0].t) return s[0].money;
  for (let i = 1; i < s.length; i++) if (t <= s[i].t) {
    const a = s[i - 1], b = s[i];
    return a.money + (b.money - a.money) * (t - a.t) / (b.t - a.t);
  }
  return s[s.length - 1].money;
}

for (const w of wins) {
  const ups = w.ev.filter((e) => e.k === "up");
  if (!ups.length) continue;
  console.log("\n=== Fenster", fmt(w.from === -Infinity ? ups[0].t : w.from), "->", fmt(w.to === Infinity ? ups[ups.length - 1].t : w.to));
  // Doppelbestellung = gleiche Bestellung (Host+Ziel) binnen 90 s nach vorherigem "ok"
  let dbl = 0, single = 0;
  const gaps = [];
  let lastOk = null;
  for (let i = 0; i < w.ev.length; i++) {
    const e = w.ev[i];
    if (e.k === "ok") {
      // naechste Bestellung nach dem ok
      const nx = w.ev.slice(i + 1).find((x) => x.k === "up" || x.k === "kauf");
      if (nx && nx.k === "up" && nx.t - e.t < 5000) {
        const prevUp = [...w.ev.slice(0, i)].reverse().find((x) => x.k === "up");
        if (prevUp && prevUp.host === nx.host && prevUp.to === nx.to) dbl++; else single++;
      }
      if (lastOk !== null && e.host && /werk/.test(e.host)) gaps.push((e.t - lastOk) / 1000);
      lastOk = e.t;
    }
  }
  const okUp = w.ev.filter((e) => e.k === "ok").length;
  console.log("  Ausbau-Bestellungen:", ups.length, " Ergebnisse ok:", okUp,
    " Folgebestellung direkt nach ok: gleicher Host+Ziel (Doppel):", dbl, " anderer Host:", single);
  gaps.sort((a, b) => a - b);
  if (gaps.length) console.log("  Abstand ok->ok (s): n", gaps.length, "min", gaps[0], "Median", gaps[gaps.length >> 1], "max", gaps[gaps.length - 1]);
  // Geldlage zu jeder Bestellung
  let minRatio = Infinity, rows = [];
  for (const u of ups) {
    const m = moneyAt(u.t);
    const r = m / (2 * u.cost);
    if (r < minRatio) minRatio = r;
    rows.push(fmt(u.t) + " " + u.host + " " + u.from + "->" + u.to + " amort " + u.amort + " Geld " + (m / 1e6).toFixed(0) + "M / (2xKosten " + (2 * u.cost / 1e6).toFixed(1) + "M) = " + r.toFixed(0) + "x");
  }
  console.log("  kleinstes Geld/(2xKosten) bei Bestellung:", minRatio.toFixed(1));
  if (process.argv.includes("-v")) console.log(rows.join("\n"));
}

// --- Verfeinerung: nur Ausbau-Ergebnisse, Park-Verlauf je Fenster -------------
console.log("\n##### Nur Ausbau-Ergebnisse (Ergebnis dem Typ der letzten Bestellung zugeordnet) #####");
for (const w of wins) {
  const seq = [];
  let lastOrder = null;
  for (const e of w.ev) {
    if (e.k === "up" || e.k === "kauf") lastOrder = e;
    else if (e.k === "ok" && lastOrder) { seq.push({ t: e.t, type: lastOrder.k, host: e.host, order: lastOrder }); }
  }
  const upOk = seq.filter((s) => s.type === "up");
  if (!upOk.length) continue;
  // Eindeutige Ausbauten: Ergebnis zaehlt nur einmal je Bestellung (ok folgt auf Bestellung)
  const gaps = [];
  for (let i = 1; i < upOk.length; i++) {
    const g = (upOk[i].t - upOk[i - 1].t) / 1000;
    if (g < 3600) gaps.push(g);
  }
  gaps.sort((a, b) => a - b);
  const hist = {};
  for (const g of gaps) { const b = g < 60 ? "<60" : g < 300 ? "60-300" : g < 600 ? "300-600" : g < 700 ? "600-700" : ">=700"; hist[b] = (hist[b] || 0) + 1; }
  console.log(fmt(upOk[0].t), "->", fmt(upOk[upOk.length - 1].t), " Ausbau-ok:", upOk.length, " Abstaende n", gaps.length,
    "min", gaps[0], "Median", gaps[gaps.length >> 1], "max", gaps[gaps.length - 1], JSON.stringify(hist));
}
console.log("\nPark-Verlauf aus den Spielstaenden (GB gesamt, Geld, Level-Stunde im Knoten):");
for (const s of saves) console.log(" ", fmt(s.t), s.f.match(/BN2L\d/)[0], "park", s.park, "Geld", (s.money / 1e6).toFixed(0) + "M", "tBN", s.tBN.toFixed(2) + "h", s.f.match(/_(hourly|pre-\w+|connect)/)[1]);

// --- Amortisationswerte der Bestellungen je Fenster (Gating-Pruefung des Gegenlaufs) ---
if (process.argv.includes("-amort")) {
  for (const w of wins) {
    const ups = w.ev.filter((e) => e.k === "up");
    if (!ups.length) continue;
    console.log("\nFenster", fmt(ups[0].t), "->", fmt(ups[ups.length - 1].t));
    const byStep = {};
    for (const u of ups) { const k = u.from + "->" + u.to; (byStep[k] = byStep[k] || []).push(u.amort); }
    for (const [k, a] of Object.entries(byStep)) {
      const v = a.filter((x) => x !== null);
      console.log("  ", k, "n", a.length, "amort(s) min", Math.min(...v), "max", Math.max(...v), " ohne amort (Werkzeug wartet):", a.length - v.length);
    }
  }
}
