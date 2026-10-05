// Audit geldwert BN3 (05.10.2026): Was kauft der Bot im ersten BN3-Zyklus mit/ohne Zusatzgeld, und welches k ergibt das?
// Nachgebaut: Kaufschleife "normal" (ohne Gang keine Torrunde, src/lib/einbau.js:1024-1028) =
// src/bn4rep.js:2298-2305: jede Runde Kandidaten nach Preis absteigend, kaufen wenn Ruf >= Bedarf und Geld >= Preis.
// Preis = Grundpreis x 3 (AugmentationMoneyCost BN3, BitNode.tsx:621) x 1,9^wartend; Ruf-Bedarf x3 (:622).
// Alternative "tor": optimale Runde am Tor (Strahlsuche, teuerste zuerst) mit demselben Ruf - das, was eine Torrunde ohne Gang braechte.
// Ruf-Verlauf: Bladeburners wie BN2.3 Zyklus 1 (gemessen, Spielstaende), andere Faktionen linear auf ihren BN2.3-Endwert.
// Stufen fuer k: BN2.3 pre-install 05.10. 19:26 (Analogon, gleiche Mults 1,43, gleiche 12,4 h). Nur lesen.
import { loadBot, loadState, AUGS, makeRoundModel, beamRound } from "./gang-p2b-lib.mjs";
import { kOf } from "./geld-bn3-kist.mjs";
const bot = await loadBot();
const S = loadState("LIVE_197f4d61481686_BN2L3_2026-10-05T19-26_pre-install.json.gz");
const bbs = Object.fromEntries(S.bb.skills.data || Object.entries(S.bb.skills));
const LV = S.p.skills, RE = bbs["Reaper"], EV = bbs["Evasive System"];
const OP = "OperationTyphoon";
const TGATE = 12.4;
// Bladeburners-Ruf BN2.3 Zyklus 1 (h seit Knotenstart, Ruf) - geld-bn3-verlauf.mjs 2 3
const BBREP = [[0,0],[0.8,0],[1.8,309],[2.8,2476],[3.8,3713],[4.8,6401],[5.8,8932],[6.8,13632],[7.8,17988],[8.8,28413],[9.8,43541],[10.8,53121],[11.8,64665],[12.4,79031]];
const interp = (T, t) => { for (let i = 1; i < T.length; i++) if (t <= T[i][0]) { const [a, x] = T[i-1], [b, y] = T[i]; return x + (y - x) * (t - a) / (b - a); } return T[T.length-1][1]; };
const REPF = (o) => (f, t) => {
  if (f === "Bladeburners") return interp(BBREP, t) * (o.bbScale ?? 1);
  const end = { "Sector-12": 17622, "Aevum": 21233, "Tian Di Hui": 6026, "CyberSec": 12067, "NiteSec": 15956, "The Black Hand": 11861, "Netburners": 9082, "Tetrads": 0, "Slum Snakes": 0 }[f] ?? 0;
  return end * (o.otherScale ?? 1) * Math.min(1, t / TGATE);
};
const JOINED = ["Bladeburners", "Sector-12", "Aevum", "Tian Di Hui", "CyberSec", "NiteSec", "The Black Hand", "Netburners", "Tetrads", "Slum Snakes"];
const PM = 3, RM = 3;
function cands(rep, t) {
  const out = [];
  for (const f of JOINED) for (const a of Object.values(AUGS)) {
    if (!a.factions.includes(f) || a.name === "NeuroFlux Governor" || a.name === "The Red Pill") continue;
    const m = bot.COMBAT_AUGS[a.name]; if (!m) continue;
    out.push({ aug: a.name, faktion: f, rep: rep(f, t), repReq: a.repCost * RM, base: a.moneyCost * PM, prereq: a.prereqs, mults: m });
  }
  return out;
}
// o: { base0: Netto-Geld bis zum Tor (linear), lump: [[t, Betrag]], unlimitedFrom }
function runLoop(o) {
  const rep = REPF(o);
  let cash = 0, spent = 0; const bought = []; const owned = new Set();
  const dt = 0.05;
  for (let t = 0; t <= TGATE + 1e-9; t += dt) {
    cash += o.base0 / TGATE * dt;
    for (const [tl, amt] of (o.lump || [])) if (t <= tl && tl < t + dt) cash += amt;
    if (o.unlimitedFrom != null && t >= o.unlimitedFrom) cash = Math.max(cash, 1e30);
    let again = true;
    while (again) {
      again = false;
      const C = cands(rep, t).filter(k => !owned.has(k.aug)).map(k => ({ ...k, preis: k.base * Math.pow(1.9, owned.size) }));
      // je Name die erste Faktion mit genug Ruf
      const seen = new Set();
      for (const k of C.sort((a, b) => b.preis - a.preis)) {
        if (seen.has(k.aug)) continue;
        if (k.rep < k.repReq) continue;
        if (!k.prereq.every(p => owned.has(p))) continue;   // Spiel verlangt Voraussetzung (gekauft reicht)
        seen.add(k.aug);
        if (cash < k.preis) continue;
        cash -= k.preis; spent += k.preis; owned.add(k.aug); bought.push({ t: +t.toFixed(2), aug: k.aug, preis: k.preis });
        again = true; break;   // Preise verschoben -> neu sortieren (bn4rep.js:2306 "continue")
      }
    }
  }
  const r = kOf(bot, LV, RE, EV, bought.map(b => bot.COMBAT_AUGS[b.aug]), OP);
  return { bought, spent, cash, k: r.k };
}
function gateRound(money, o) {
  const rep = REPF(o);
  const C = cands(rep, TGATE).map(k => ({ ...k, preis: k.base }));
  const model = makeRoundModel(bot, C, new Set(), { skills: LV, reaper: RE, evasive: EV, opName: OP, step: 1.9 });
  return beamRound(model, money, 30);
}
const fmt = (x) => x >= 1e12 ? (x/1e12).toFixed(2) + " Bio" : (x/1e9).toFixed(1) + " Mrd";
const SZ = [
  ["Basis 5 Mrd", { base0: 5e9 }],
  ["Basis 10 Mrd", { base0: 10e9 }],
  ["+100 Mrd nach 0,5 h", { base0: 7.5e9, lump: [[0.5, 100e9]] }],
  ["+450 Mrd nach 3 h", { base0: 7.5e9, lump: [[3, 450e9]] }],
  ["+1 Bio nach 12 h", { base0: 7.5e9, lump: [[12, 1e12]] }],
  ["unbegrenzt ab 6 h", { base0: 7.5e9, unlimitedFrom: 6 }],
  ["unbegrenzt ab 0 h", { base0: 7.5e9, unlimitedFrom: 0 }],
];
const args = process.argv.slice(2);
const o2 = { bbScale: +(args.find(a=>a.startsWith("--bb="))||"--bb=1").slice(5), otherScale: +(args.find(a=>a.startsWith("--andere="))||"--andere=1").slice(9) };
console.log(`Ruf am Tor: Bladeburners ${Math.round(79031*o2.bbScale)}, andere x${o2.otherScale}; Stufen BN2.3 19:26, Reaper ${RE}, Evasive ${EV}; Gewichte ${OP}`);
console.log("Szenario | Schleife: Stuecke, ausgegeben, k | Torrunde (gleiches Geld, ohne Vorkaeufe): Stuecke, Kosten, k");
for (const [name, o] of SZ) {
  const L = runLoop({ ...o, ...o2 });
  const money = o.unlimitedFrom != null ? 1e30 : o.base0 + (o.lump || []).reduce((s, [, a]) => s + a, 0);
  const G = gateRound(money, o2);
  console.log(`${name} | ${L.bought.length}, ${fmt(L.spent)}, k ${L.k.toFixed(3)} | ${G.seq.length}, ${fmt(G.cost)}, k ${G.gain.toFixed(3)}`);
  if (args.includes("--detail")) console.log("   Schleife: " + L.bought.map(b => `${b.t}h ${b.aug} ${fmt(b.preis)}`).join("; ") + "\n   Tor: " + G.seq.join("; "));
}
