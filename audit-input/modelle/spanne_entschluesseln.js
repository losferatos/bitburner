// Nachbau Action.getSuccessRange / getSuccessChance (Actions/Action.ts:88-196)
// und BlackOperation (pop/chaos = 1). Frage: laesst sich aus dem API-Paar der
// naechsten Black Op das Verhaeltnis r = pop/popEst zurueckrechnen - und
// damit die WAHRE Chance jeder Operation/jedes Vertrags?
const clamp01 = (x) => Math.max(0, Math.min(x, 1));
function chance(compBase, diff, pop, isBO) {
  // compBase = competence ohne Bevoelkerungsfaktor
  const popF = isBO ? 1 : Math.pow(pop / 1e9, 0.7);
  return Math.min(1, compBase * popF / diff);
}
function range(compBase, diff, city, isBO) {
  const est = chance(compBase, diff, city.popEst, isBO);
  const real = chance(compBase, diff, city.pop, isBO);
  const d = Math.abs(real - est);
  let low = real - d, high = real + d;
  let r = city.pop / city.popEst; if (Number.isNaN(r)) r = 0;
  if (r < 1) low *= r; else high *= r;   // clampNumber(r) ohne Grenzen = r
  return { low: clamp01(low), high: clamp01(high), real };
}
// Rueckrechnung: r aus Black-Op-Paar und gerechneter BO-Chance (blackOpChance)
function rAusBO(bo, boReal) {
  if (bo.low < boReal - 1e-12) return { r: bo.low / boReal, sicher: true };
  if (bo.high > boReal + 1e-12 && bo.high < 1) return { r: bo.high / boReal, sicher: true };
  if (bo.high >= 1 && boReal < 1) return { r: 1 / boReal, sicher: false, untergrenze: true };
  return { r: 1, sicher: true };
}
let maxFehler = 0;
const faelle = [];
for (const [pop, popEst] of [[1.2e9, 1.6e9], [0.9e9, 1.4e9], [1.3e9, 0.8e9], [1.1e9, 1.1e9], [0.5e9, 1.5e9], [0.3e9, 1.5e9]]) {
  const city = { pop, popEst };
  // Black Op: Daedalus-artig, reale Chance 0,4
  const boComp = 0.4 * 80000, bo = range(boComp, 80000, city, true);
  const rr = rAusBO(bo, 0.4);
  // Operation: Assassination-artig, wahre Chance bei pop
  for (const zielReal of [0.5, 0.8, 0.95]) {
    const diff = 4541;
    const compBase = zielReal * diff / Math.pow(pop / 1e9, 0.7);
    const op = range(compBase, diff, city, false);
    // Bot entscheidet an op.low; Rueckrechnung: popGeschaetzt = r*popEst
    const popR = rr.r * popEst;
    const est = chance(compBase, diff, popEst, false);
    const rueck = Math.min(1, est * Math.pow(popR / popEst, 0.7));
    maxFehler = Math.max(maxFehler, Math.abs(rueck - op.real));
    faelle.push({ pop: pop / 1e9, popEst: popEst / 1e9, r: +(pop / popEst).toFixed(3), BO: [bo.low.toFixed(3), bo.high.toFixed(3)], rRueck: +rr.r.toFixed(3), sicher: rr.sicher, opWahr: op.real.toFixed(3), opMinBot: op.low.toFixed(3), opMax: op.high.toFixed(3), rueck: rueck.toFixed(3) });
  }
}
console.table(faelle);
console.log('max. Rueckrechnungsfehler (nur sichere Faelle zaehlen):', maxFehler.toExponential(2));
