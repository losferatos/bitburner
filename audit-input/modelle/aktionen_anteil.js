// Zeitanteile je Aktion aus dem archivierten Aktionsprotokoll (read-only).
const fs = require('fs');
const roh = fs.readFileSync('C:/Users/erche/Desktop/claude_projecto/bitburner/archiv/aktionen-2026-09-04/aktionen.txt', 'utf8');
const zeilen = roh.split('\n').filter((z) => z.trim()).map((z) => { try { return JSON.parse(z); } catch { return null; } }).filter(Boolean);
console.log('Zeilen', zeilen.length, 'von', new Date(zeilen[0].von).toISOString(), 'bis', new Date(zeilen[zeilen.length - 1].bis).toISOString());
// Fenster nach Tagen, Anteile je Aktion
const proTag = new Map();
for (const z of zeilen) {
  const tag = new Date(z.von).toISOString().slice(0, 10);
  if (!proTag.has(tag)) proTag.set(tag, new Map());
  const m = proTag.get(tag);
  const d = (z.bis - z.von) / 60000;
  const e = m.get(z.aktion) || { min: 0, rang: 0, n: 0 };
  e.min += d; e.n++;
  if (Number.isFinite(z.rangBis) && Number.isFinite(z.rangVon)) e.rang += z.rangBis - z.rangVon;
  m.set(z.aktion, e);
}
for (const [tag, m] of proTag) {
  const gesamt = [...m.values()].reduce((s, e) => s + e.min, 0);
  const rang = [...m.values()].reduce((s, e) => s + e.rang, 0);
  console.log('\n==', tag, 'Minuten', gesamt.toFixed(0), 'Rang', rang.toFixed(0));
  for (const [a, e] of [...m.entries()].sort((x, y) => y[1].min - x[1].min)) {
    console.log('  ', a.padEnd(48), (e.min).toFixed(1).padStart(7), 'min', (100 * e.min / gesamt).toFixed(1).padStart(5) + '%', 'Rang', e.rang.toFixed(0).padStart(8), 'n', e.n);
  }
}
