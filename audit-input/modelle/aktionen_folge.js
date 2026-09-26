// Abschnittsfolge 31.08.-01.09. mit Grund - warum Undercover statt Assassination?
const fs = require('fs');
const roh = fs.readFileSync('C:/Users/erche/Desktop/claude_projecto/bitburner/archiv/aktionen-2026-09-04/aktionen.txt', 'utf8');
const z = roh.split('\n').filter((x) => x.trim()).map((x) => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean);
const von = Date.parse(process.argv[2] || '2026-08-31T00:00:00Z');
const bis = Date.parse(process.argv[3] || '2026-09-02T00:00:00Z');
for (const e of z) {
  if (e.von < von || e.von > bis) continue;
  const d = ((e.bis - e.von) / 60000).toFixed(1);
  console.log(new Date(e.von).toISOString().slice(5, 19), d.padStart(6), 'min', String(e.aktion).padEnd(44), 'Rang', String(e.rangVon).padStart(8), '->', String(e.rangBis).padStart(8), 'Aus', e.ausdauerVon, '->', e.ausdauerBis, '|', (e.grund || '').slice(0, 70));
}
