// Gegenpruefung G06: alle Spielstaende nach "Ausbau wartet"-Zeilen und
// "bestellt ... amortisiert in N s"-Zeilen durchsuchen (bn4net-log.txt im
// Ringpuffer). Frage: Gab es JE einen Fall, in dem der Amortisationsdeckel
// (600) einen Ausbau abgelehnt hat, obwohl Geld frei war (frei > 0)?
// Ausgabe: je Zeile Stand, Zeit, Text; am Ende Zaehlung.
import fs from "node:fs";
import { loadSave, textFile } from "./hack-save.mjs";
const files = fs.readdirSync("backups").filter((f) => f.endsWith(".json.gz") && f.startsWith("LIVE_")).sort();
const seen = new Set();
const blockedByDeckel = [], blockedByMoney = [], bought = [];
for (const f of files) {
  let servers;
  try { ({ servers } = loadSave("backups/" + f)); } catch { continue; }
  const txt = textFile(servers.home, "data/bn4net-log.txt");
  if (!txt) continue;
  const bn = f.replace("LIVE_197f4d61481686_", "").split("_")[0];
  for (const line of txt.split("\n")) {
    let m = line.match(/^(\d\d:\d\d:\d\d)\s+Ausbau wartet: (\S+) -> (\d+) GB kostet ([\d.]+)m, amortisiert in (\S+) s \(Deckel (\d+)\), frei (-?\d+)m\./);
    if (m) {
      const key = bn + "|" + line; if (seen.has(key)) continue; seen.add(key);
      const [, t, host, gb, kost, am, deckel, frei] = m;
      const rec = { bn, f, t, host, gb: +gb, kost: +kost, am: am === "?" ? Infinity : +am, deckel: +deckel, frei: +frei };
      if (rec.frei >= 2 * rec.kost && rec.am > rec.deckel) blockedByDeckel.push(rec);
      else blockedByMoney.push(rec);
      continue;
    }
    m = line.match(/^(\d\d:\d\d:\d\d)\s+(\S+): (\d+) -> (\d+) GB bestellt fuer rund ([\d.]+)m, amortisiert in (\d+) s\./);
    if (m) {
      const key = bn + "|" + line; if (seen.has(key)) continue; seen.add(key);
      bought.push({ bn, f, t: m[1], von: +m[3], zu: +m[4], kost: +m[5], am: +m[6] });
    }
  }
}
console.log("Staende:", files.length, " gekaufte Ausbauten (eindeutig):", bought.length,
  " 'Ausbau wartet' wegen Geld/Ruecklage:", blockedByMoney.length, " wegen DECKEL bei freiem Geld:", blockedByDeckel.length);
const maxAm = bought.reduce((a, b) => Math.max(a, b.am), 0);
console.log("Hoechste Amortisation eines gekauften Ausbaus:", maxAm, "s");
const byBn = {};
for (const b of bought) { (byBn[b.bn] = byBn[b.bn] || []).push(b.am); }
for (const [k, v] of Object.entries(byBn)) console.log("  ", k, "n", v.length, "min", Math.min(...v), "max", Math.max(...v));
console.log("\nDeckel-Blockaden bei freiem Geld:");
for (const r of blockedByDeckel) console.log("  ", r.bn, r.t, r.host, r.gb, "GB kostet", r.kost + "m amort", r.am, "s Deckel", r.deckel, "frei", r.frei + "m");
console.log("\nGeld-Blockaden (Auszug, Deckel/Amort):");
const g = {};
for (const r of blockedByMoney) { const k = r.bn + " Deckel " + r.deckel; g[k] = g[k] || { n: 0, minFrei: Infinity, maxAm: 0, maxKost: 0 }; g[k].n++; g[k].minFrei = Math.min(g[k].minFrei, r.frei); g[k].maxAm = Math.max(g[k].maxAm, r.am === Infinity ? 0 : r.am); }
console.log(JSON.stringify(g, null, 1));

// --- Zusatz: Aufschluesselung der Geld-Blockaden nach Vorzeichen von frei und
// ob die Amortisation unter dem Deckel lag (dann hat NICHT der Deckel geblockt).
let neg = 0, posAmUnder = 0, posAmOver = 0, inf = 0;
for (const r of blockedByMoney) {
  if (r.frei < 0) neg++;
  else if (r.am === Infinity) inf++;
  else if (r.am <= r.deckel) posAmUnder++;
  else posAmOver++;
}
console.log("\nGeld-Blockaden gesamt", blockedByMoney.length, ": frei<0 (Ruecklage > Konto):", neg,
  "| frei>=0 aber < 2x Kosten, Amort <= Deckel:", posAmUnder, "| Amort > Deckel:", posAmOver, "| Amort unendlich:", inf);

const gd = {};
for (const r of blockedByDeckel) { const k = r.bn; gd[k] = gd[k] || { n: 0, endlich: 0, unendlich: 0 }; gd[k].n++; if (r.am === Infinity) gd[k].unendlich++; else gd[k].endlich++; }
console.log("\nDeckel-/Ertrags-Blockaden bei freiem Geld je BN:", JSON.stringify(gd));
