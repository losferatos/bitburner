// Hebel-Vorlage 06.10.2026: Zeit vom Einbau bis zum Ausgang als Funktion des Chance-Faktors K (GESCHAETZT).
// Geeicht an BN3.1 Zyklus 2 (Bladeburner-Zeit, Bonuszeit herausgerechnet, Spielstaende 17:17-18:41) und
// gegengeprueft an BN2.3 Zyklus 2 (K ~4,9, 28,8k -> Ausgang 2,13 h). Bausteine:
//   Rangrate  dR/dt = c K^beta R^e, c so, dass K=1, R=152k -> 84k/h (BN3.1 gemessen, Bonuszeit /5)
//   Daedalus-Chance p = 0,075 K (R/165,5k)^b   (BN3.1 18:41 exakt aus Spielformel: 0,075 bei 165,5k)
//   Anlauf nach Einbau bis 43,6k Rang: 5,0 h x K^-1,4 (BN3.1: 5,0 h; BN2.3: 0,55 h)
//   Ausgang: Rang >= 400k UND p >= 0,35 (Endspiel-Schwelle blade.js SICHER_BLACKOP), dann Schwanz 0,15 + 0,35/p h
//   Grafts (optional): K(t) = K0 x G(t - tg), G aus der Plan-Reihe ohne bestechliche Stuecke (graftzeit.mjs/geld-bn3-kmax.mjs)
// Aufruf: node nodes/corp-2026-10-05/hebel/lauf.mjs
const R_A = 43565;
// Graftkurve: [Zeitpunkt ab Graftbeginn in h, kumulierter k] - Simulacrum 0,23 + Neuroreceptor 0,23 vorweg, dann
// SPTN-97 1,61 / Graphene Legs 0,83 / Graphene Spine 1,45 / Photosynthetic 1,34 / CordiARC 1,80 (Int 155, fokussiert)
export const GRAFT = [[0.46, 1], [2.07, 1.51], [2.90, 2.11], [4.35, 3.02], [5.69, 3.74], [7.49, 4.68]];
const gAt = (t) => { let k = 1; for (const [h, kk] of GRAFT) if (t >= h) k = kk; return k; };
export function tPost(K0, { e = 1.2, beta = 0.7, b = 1.35, early = 1, graftStart = null, R0 = 13315, thr = 0.35 } = {}) {
  const c = 84000 / Math.pow(152000, e);
  let t = 5.0 * Math.pow(K0, -1.4) * early * (R0 > 20000 ? 0.8 : 1);
  let R = R_A, dt = 0.005;
  const K = (tt) => K0 * (graftStart === null ? 1 : gAt(tt - graftStart));
  for (;;) {
    const k = K(t); const p = 0.075 * k * Math.pow(R / 165474, b);
    if (R >= 400000 && p >= thr) return t + 0.15 + 0.35 / Math.min(1, p);
    R += c * Math.pow(k, beta) * Math.pow(R, e) * dt; t += dt;
    if (t > 80) return Infinity;
  }
}
const bands = [];
for (const e of [1.0, 1.2, 1.4]) for (const b of [1.0, 1.35, 1.7]) for (const beta of [0.65, 0.8]) for (const early of [0.7, 1, 1.3]) bands.push({ e, b, beta, early });
const band = (f) => { const v = bands.map(f).sort((x, y) => x - y); return [v[0], v[Math.floor(v.length / 2)], v[v.length - 1]]; };
const fmt = ([a, m, z]) => `${a.toFixed(1)}-${z.toFixed(1)} (Mitte ${m.toFixed(1)})`;
if ((process.argv[1] || "").endsWith("lauf.mjs")) {
  console.log("Pruefung BN2.3 (K 4,9, R0 28,8k): gemessen 2,13 h; Modell", fmt(band((o) => tPost(4.9, { ...o, R0: 28767 }))));
  console.log("Pruefung BN3.1 (K 1): Modell Einbau->Ausgang in Bladeburner-Zeit", fmt(band((o) => tPost(1, o))), "(gemessen bis 18:41: 7,5 h fuer 165k)");
  console.log("\nEinbau -> Ausgang (h Bladeburner-Zeit = Echtzeit ohne Bonus) je K, ohne / mit Grafts ab Einbau (Simulacrum zuerst):");
  for (const K of [1, 1.5, 2.17, 3.1, 3.8, 4.1, 5.5, 6.1, 7.5, 11.5]) {
    console.log(`  K ${String(K).padEnd(5)} ohne ${fmt(band((o) => tPost(K, o))).padEnd(26)} mit Grafts ${fmt(band((o) => tPost(K, { ...o, graftStart: 0 })))}`);
  }
}
