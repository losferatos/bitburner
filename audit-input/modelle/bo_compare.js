const fs = require('fs');
const root = 'C:/Users/erche/Desktop/claude_projecto/bitburner/';
const src = fs.readFileSync(root + 'reference/bitburner-src/src/Bladeburner/data/BlackOperations.ts', 'utf8');
const blocks = src.split(/new BlackOperation\(/).slice(1);
const game = {};
const order = [];
for (const b of blocks) {
  const name = b.match(/BladeburnerBlackOpName\.(\w+)/)[1];
  const num = (k) => { const m = b.match(new RegExp(k + String.raw`:\s*([\d.e]+)`)); return m ? Number(m[1]) : undefined; };
  const obj = (k) => { const m = b.match(new RegExp(k + String.raw`:\s*\{([^}]*)\}`)); if (!m) return null; const o = {}; for (const mm of m[1].matchAll(/(\w+):\s*([\d.]+)/g)) o[mm[1]] = Number(mm[2]); return o; };
  game[name] = { n: num('n'), baseDifficulty: num('baseDifficulty'), reqdRank: num('reqdRank'), rankGain: num('rankGain'), rankLoss: num('rankLoss'), hpLoss: num('hpLoss'), isKill: /isKill:\s*true/.test(b), isStealth: /isStealth:\s*true/.test(b), weights: obj('weights'), decays: obj('decays') };
  order.push(name);
}
const bot = fs.readFileSync(root + 'src/blade.js', 'utf8');
const start = bot.indexOf('const BLACKOP_DATEN = {'); const end = bot.indexOf('\n    };', start);
const BD = eval('(' + bot.slice(start + 'const BLACKOP_DATEN = '.length, end + 6) + ')');
const s2 = bot.indexOf('const BLACKOP_EINSATZ = {'); const e2 = bot.indexOf('\n    };', s2) > 0 ? bot.indexOf('};', s2) : -1;
const BE = eval('(' + bot.slice(s2 + 'const BLACKOP_EINSATZ = '.length, e2 + 1) + ')');
const DEF_W = { hacking: 1 / 7, strength: 1 / 7, defense: 1 / 7, dexterity: 1 / 7, agility: 1 / 7, charisma: 1 / 7, intelligence: 1 / 7 };
const DEF_D = { hacking: .9, strength: .9, defense: .9, dexterity: .9, agility: .9, charisma: .9, intelligence: .9 };
const pretty = (k) => k.replace(/^Operation/, 'Operation ').replace('RedDragon', 'Red Dragon').replace('ShoulderOfOrion', 'Shoulder of Orion').replace('IonStorm', 'Ion Storm');
let sumGain = 0, sumLoss = 0;
for (const k of order) {
  const g = game[k];
  const nm = pretty(k);
  const b = BD[nm]; const e = BE[nm];
  const issues = [];
  if (!b) issues.push('MISSING in BLACKOP_DATEN');
  else {
    if (b.baseDifficulty !== g.baseDifficulty) issues.push('diff ' + b.baseDifficulty + ' vs ' + g.baseDifficulty);
    if (b.isKill !== g.isKill) issues.push('isKill');
    if (b.isStealth !== g.isStealth) issues.push('isStealth');
    const gw = g.weights || DEF_W, gd = g.decays || DEF_D;
    for (const s of Object.keys(DEF_W)) {
      const bw = b.weights[s] ?? 0, gww = gw[s] ?? 0;
      if (Math.abs(bw - gww) > 1e-12) issues.push('w.' + s + ' ' + bw + ' vs ' + gww);
      if (gww > 0 && Math.abs((b.decays[s] ?? NaN) - gd[s]) > 1e-12) issues.push('d.' + s + ' ' + b.decays[s] + ' vs ' + gd[s]);
    }
  }
  if (!e) issues.push('MISSING in EINSATZ'); else if (e.rankGain !== g.rankGain || e.rankLoss !== g.rankLoss) issues.push('einsatz ' + JSON.stringify(e));
  sumGain += g.rankGain; sumLoss += g.rankLoss;
  console.log(g.n, nm, 'diff', g.baseDifficulty, 'rank', g.reqdRank, 'gain', g.rankGain, 'loss', g.rankLoss, 'hp', g.hpLoss, g.isKill ? 'K' : '', g.isStealth ? 'S' : '', '|', issues.join('; ') || 'ok');
}
console.log('sumGain', sumGain, 'sumLoss', sumLoss);
fs.writeFileSync(__dirname + '/bo_game.json', JSON.stringify(game, null, 1));
