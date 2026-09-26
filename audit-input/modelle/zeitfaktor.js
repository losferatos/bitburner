// Action.getActionTime (Actions/Action.ts:105-122): Wirkung von Reaper/Evasive auf die DAUER
const statFac = (agi, dex) => 0.5 * (Math.pow(agi, 0.04) + Math.pow(dex, 0.035) + agi / 1e4 + dex / 1e4);
const sk = { dex: 450, agi: 420 };
const eff = (R, E) => (1 + 0.02 * R) * (1 + 0.04 * E);
const f0 = statFac(sk.agi * eff(90, 93), sk.dex * eff(90, 93));
const fE = statFac(sk.agi * eff(90, 94), sk.dex * eff(90, 94));
const fR = statFac(sk.agi * eff(91, 93), sk.dex * eff(91, 93));
console.log('statFac', f0.toFixed(4), ' Evasive+1: Dauer', (100 * (f0 / fE - 1)).toFixed(3) + '%', ' Reaper+1: Dauer', (100 * (f0 / fR - 1)).toFixed(3) + '%');
// Max-Ausdauer (Bladeburner.ts:1327-1335) ~ effAgi^0.8
console.log('maxStamina-Zuwachs Evasive+1:', (100 * (Math.pow(eff(90, 94) / eff(90, 93), 0.8) - 1)).toFixed(3) + '%');
