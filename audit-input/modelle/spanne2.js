// Geschlossene Rueckrechnung x aus (low, high, r) - gegen Action.ts:144-166 geeicht
const src = require('fs').readFileSync('spanne_entschluesseln.js', 'utf8').split('let maxFehler')[0];
eval(src);
let n = 0, fehler = 0, unbestimmt = 0;
for (let i = 0; i < 200000; i++) {
  const pop = 0.1e9 + Math.random() * 1.4e9, popEst = pop * (0.3 + Math.random() * 1.5);
  const city = { pop, popEst };
  const boReal = 0.02 + Math.random() * 0.9;
  const bo = range(boReal * 80000, 80000, city, true);
  const rr = rAusBO(bo, boReal);
  if (!rr.sicher) { unbestimmt++; continue; }
  const diff = 3000;
  const compBase = Math.random() * 2.5 * diff;
  const op = range(compBase, diff, city, false);
  const r = rr.r;
  let x;
  if (r < 1) x = op.low > 0 ? (op.low / r + op.high) / 2 : null;
  else x = op.high < 1 ? (op.high / r + op.low) / 2 : op.low; // high geklemmt -> x >= low
  if (x === null) { unbestimmt++; continue; }
  if (r >= 1 && op.high >= 1) { if (op.real + 1e-9 < x) fehler++; n++; continue; } // nur Untergrenze
  n++; if (Math.abs(x - op.real) > 1e-9) fehler++;
}
console.log('Faelle', n, 'Fehler', fehler, 'unbestimmt (BO geklemmt / low=0)', unbestimmt);
