const fs = require('fs');
const z = fs.readFileSync('C:/Users/erche/Desktop/claude_projecto/bitburner/archiv/aktionen-2026-09-04/aktionen.txt', 'utf8').split('\n').filter((x) => x.trim()).map((x) => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean);
for (const [a, b, name] of [['2026-08-31T14:54:00Z', '2026-08-31T18:34:00Z', 'Op-Phase 31.08.'], ['2026-09-01T03:22:00Z', '2026-09-01T03:47:30Z', 'Endspiel 01.09.']]) {
  const A = Date.parse(a), B = Date.parse(b);
  const m = new Map(); let ges = 0, rang = 0;
  for (const e of z) {
    if (e.von < A || e.von > B) continue;
    const k = e.aktion.startsWith('Operations/Stealth') ? (String(e.grund).startsWith('Chaos') ? 'SR (Chaos)' : 'SR (Ertrag)') : e.aktion;
    const d = (e.bis - e.von) / 60000; ges += d;
    const r = (e.rangBis ?? e.rangVon) - e.rangVon; rang += r;
    const x = m.get(k) || { d: 0, r: 0 }; x.d += d; x.r += r; m.set(k, x);
  }
  console.log('\n' + name, 'Minuten', ges.toFixed(1), 'Rang', rang.toFixed(0));
  for (const [k, x] of [...m].sort((p, q) => q[1].d - p[1].d)) console.log('  ', k.padEnd(45), x.d.toFixed(1).padStart(6), (100 * x.d / ges).toFixed(1).padStart(5) + '%', 'Rang/min', (x.r / x.d).toFixed(0).padStart(7));
}
