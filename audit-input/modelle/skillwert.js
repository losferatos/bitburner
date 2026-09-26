// Nachbau Action.getSuccessChance (Actions/Action.ts:169-196) fuer Daedalus
// und Vergleich: wahrer Grenznutzen je Skillpunkt vs. relNutzen aus blade.js.
// Eichung: Skill-Kosten gegen Skill.ts:76-80 (calculateCost) - Beispiel
// Hyperdrive St.219 -> 549 (Kommentar blade.js:1391) muss herauskommen.
const SKILL = {
  "Blade's Intuition": { base: 3, inc: 2.1 },
  "Digital Observer": { base: 2, inc: 2.1 },
  "Reaper": { base: 2, inc: 2.1 },
  "Evasive System": { base: 2, inc: 2.1 },
  "Hyperdrive": { base: 1, inc: 2.5 },
  "Overclock": { base: 3, inc: 1.4 },
  "Cyber's Edge": { base: 1, inc: 3 },
};
const cost = (n, L, m = 1) => Math.round(1 * m * (SKILL[n].base + SKILL[n].inc * (L + 0)));
console.log('Eichung Hyperdrive L219:', cost('Hyperdrive', 219), '(erwartet 549)');
console.log('Eichung DO L43:', cost('Digital Observer', 43), '(erwartet 92)');
console.log('Eichung BI L65:', cost("Blade's Intuition", 65), '(erwartet 140)');

const W = { hacking: 0.1, strength: 0.2, defense: 0.2, dexterity: 0.2, agility: 0.2, intelligence: 0.1 };
const D = { hacking: 0.6, strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, intelligence: 0.75 };
function comp(sk, lv, team = 0) {
  const effStr = (1 + 0.02 * lv.R), effDex = (1 + 0.02 * lv.R) * (1 + 0.04 * lv.E);
  const eff = { hacking: sk.hacking, strength: sk.str * effStr, defense: sk.def * effStr, dexterity: sk.dex * effDex, agility: sk.agi * effDex, intelligence: sk.int };
  let c = 0; for (const s of Object.keys(W)) c += W[s] * Math.pow(eff[s], D[s]);
  c *= 1 + 0.75 * Math.pow(sk.int, 0.8) / 600;
  c *= Math.pow(team + 1, 0.05);
  c *= (1 + 0.03 * lv.BI) * (1 + 0.04 * lv.DO);
  return c;
}
// Stand BN6 28.08. 16:08 (ERLEDIGT.md:3843): DO 104, BI 99, Evasive 93, Reaper 90;
// Kampfwerte grob aus ERLEDIGT.md (str 387) - dex/agi hoeher angesetzt.
const sk = { str: 387, def: 387, dex: 450, agi: 420, hacking: 300, int: 150 };
const lv = { BI: 99, DO: 104, R: 90, E: 93 };
const c0 = comp(sk, lv);
console.log('Daedalus p =', Math.min(1, c0 / 80000).toFixed(4));
const wahr = {
  "Blade's Intuition": comp(sk, { ...lv, BI: lv.BI + 1 }) / c0 - 1,
  "Digital Observer": comp(sk, { ...lv, DO: lv.DO + 1 }) / c0 - 1,
  "Reaper": comp(sk, { ...lv, R: lv.R + 1 }) / c0 - 1,
  "Evasive System": comp(sk, { ...lv, E: lv.E + 1 }) / c0 - 1,
};
// relNutzen aus blade.js:1019-1037 (additiv, nur Kampfterme, ohne hack/int)
function botRE(name) {
  const r = lv.R, e = lv.E;
  const f = (rr, ee) => { const a = 1 + rr * 0.02, b = 1 + rr * 0.02 + ee * 0.04; return Math.pow(sk.str * a, 0.8) + Math.pow(sk.def * a, 0.8) + Math.pow(sk.dex * b, 0.8) + Math.pow(sk.agi * b, 0.8); };
  const j = f(r, e); const d = name === 'Reaper' ? f(r + 1, e) : f(r, e + 1); return d / j - 1;
}
const bot = {
  "Blade's Intuition": ((1 + 0.03 * (lv.BI + 1)) / (1 + 0.03 * lv.BI) - 1),
  "Digital Observer": ((1 + 0.04 * (lv.DO + 1)) / (1 + 0.04 * lv.DO) - 1),
  "Reaper": botRE('Reaper'),
  "Evasive System": botRE('Evasive System'),
};
const L = { "Blade's Intuition": lv.BI, "Digital Observer": lv.DO, "Reaper": lv.R, "Evasive System": lv.E };
console.log('\nSkill                 Preis   wahr %    wahr/Pkt     bot %     bot/Pkt');
for (const n of Object.keys(wahr)) {
  const p = cost(n, L[n]);
  console.log(n.padEnd(20), String(p).padStart(5), (100 * wahr[n]).toFixed(4).padStart(8), (100 * wahr[n] / p).toExponential(3).padStart(11), (100 * bot[n]).toFixed(4).padStart(9), (100 * bot[n] / p).toExponential(3).padStart(11));
}
// Greedy-Ausbau bis Daedalus 0,90: wahr vs. bot-Sortierung, Kosten in SP
function greedy(bewertung) {
  const l = { ...lv }; let sp = 0; let n = 0;
  const key = { "Blade's Intuition": 'BI', "Digital Observer": 'DO', "Reaper": 'R', "Evasive System": 'E' };
  while (comp(sk, l) / 80000 < 0.9 && n < 100000) {
    let best = null, bw = -1;
    for (const nm of Object.keys(key)) {
      const w = bewertung(nm, l) / cost(nm, l[key[nm]]);
      if (w > bw) { bw = w; best = nm; }
    }
    sp += cost(best, l[key[best]]); l[key[best]]++; n++;
  }
  return { sp, l };
}
const wahrB = (nm, l) => { const c = comp(sk, l); const k = { "Blade's Intuition": 'BI', "Digital Observer": 'DO', "Reaper": 'R', "Evasive System": 'E' }[nm]; return comp(sk, { ...l, [k]: l[k] + 1 }) / c - 1; };
const botB = (nm, l) => {
  if (nm === "Blade's Intuition") return (1 + 0.03 * (l.BI + 1)) / (1 + 0.03 * l.BI) - 1;
  if (nm === "Digital Observer") return (1 + 0.04 * (l.DO + 1)) / (1 + 0.04 * l.DO) - 1;
  const f = (rr, ee) => { const a = 1 + rr * 0.02, b = 1 + rr * 0.02 + ee * 0.04; return Math.pow(sk.str * a, 0.8) + Math.pow(sk.def * a, 0.8) + Math.pow(sk.dex * b, 0.8) + Math.pow(sk.agi * b, 0.8); };
  const j = f(l.R, l.E); return (nm === 'Reaper' ? f(l.R + 1, l.E) : f(l.R, l.E + 1)) / j - 1;
};
const g1 = greedy(wahrB), g2 = greedy(botB);
console.log('\nGreedy bis Daedalus 0,90 (ohne Trupp):');
console.log('  wahre Sortierung   SP', g1.sp, JSON.stringify(g1.l));
console.log('  blade.js-Sortierung SP', g2.sp, JSON.stringify(g2.l));
console.log('  Mehrkosten', g2.sp - g1.sp, 'SP =', 3 * (g2.sp - g1.sp), 'Rang', ((g2.sp - g1.sp) / g1.sp * 100).toFixed(1) + '%');
