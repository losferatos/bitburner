// H3-Bau 06.10.2026: Einbausperre 6 h statt 12 h fuer die Corp-Torrunde - schadet das dem Schutzzweck?
// Erweitert h3.mjs um (a) die Lieferzeit Tc des Corp-Geldes als Variable, (b) den Rang vor dem Einbau als
// Funktion der Zeit (BN2.3 Zyklus 1, wie h3.mjs), (c) die Frage, ob eine ZWEITE Corp-Runde nach 6 h noch
// in den laufenden Knoten faellt. Laufzeit nach dem Einbau: lauf.mjs tPost (GESCHAETZT, geeicht dort).
// k je Bladeburners-Ruf: GERECHNET mit der echten Rundenwahl (rechnung/rundenplan.mjs, wie h3.mjs),
// hier als Tabelle, weil rundenplan.mjs reference/bitburner-src braucht (fehlt in Worktrees):
//   node -e "..." mit cands/plan aus rundenplan.mjs, Budget 1e15, Bestechung an, 06.10.2026 19:10
// Aufruf: node nodes/corp-2026-10-05/hebel/h3sperre.mjs   (< 1 s, 1 Kern)
import { tPost } from "./lauf.mjs";

const KTAB = {
  ohne: [[20e3, 1.717], [40e3, 1.931], [54e3, 1.970], [67e3, 2.316], [82e3, 2.501], [103e3, 2.845], [130e3, 2.987]],
  syn: [[20e3, 3.010], [40e3, 3.388], [54e3, 3.455], [67e3, 4.049], [82e3, 4.287], [103e3, 4.651], [130e3, 4.700]],
};
// Stufenfunktion wie die echte Rundenwahl (ein Stueck wird erst mit vollem Ruf kaufbar): der Wert der
// naechstniedrigeren Stuetzstelle - vorsichtig, nie interpoliert nach oben.
const kOf = (bb, syn) => { let k = KTAB[syn ? "syn" : "ohne"][0][1]; for (const [b, kk] of KTAB[syn ? "syn" : "ohne"]) if (bb >= b) k = kk; return k; };

// Rang vor dem Einbau, BN3.2 Zyklus 1 wie BN2.3 Zyklus 1 (h3.mjs): 15,5k@9,8 h ... 28,8k@12,4 h.
const PTS = [[9.8, 15500], [10.8, 19053], [11.8, 23399], [12.4, 28767]];
// Ausserhalb der Messpunkte mit dem Ratengesetz, Exponent E_PRE = 1,4: nur er trifft die Messung (Eichung unten,
// e 1,0/1,2 schiessen um 47-126 % ueber - das Gesetz ist bei 152k geeicht, nicht bei 15-30k).
const E_PRE = 1.4;
const rankAt = (t, e = E_PRE) => {
  const c = 84000 / Math.pow(152000, e);   // lauf.mjs: K=1, 152k -> 84k/h
  if (t <= PTS[0][0]) {                    // rueckwaerts integriert
    let R = PTS[0][1]; for (let s = PTS[0][0]; s > t; s -= 0.01) R -= c * Math.pow(R, e) * 0.01; return Math.max(1000, R);
  }
  for (let i = 1; i < PTS.length; i++) {
    const [t0, r0] = PTS[i - 1], [t1, r1] = PTS[i];
    if (t <= t1) return r0 * Math.pow(r1 / r0, (t - t0) / (t1 - t0));
  }
  let R = PTS[PTS.length - 1][1]; for (let s = PTS[PTS.length - 1][0]; s < t; s += 0.01) R += c * Math.pow(R, e) * 0.01; return R;
};
const BB_PER_RANK = 2.86;   // Zyklus 1, Favor 0 (h3.mjs)

const bands = [];
for (const e of [1.0, 1.2, 1.4]) for (const b of [1.0, 1.35, 1.7]) for (const beta of [0.65, 0.8]) for (const early of [0.7, 1, 1.3]) bands.push({ e, b, beta, early });
const exitAt = (T, syn, o) => { const R = rankAt(T); const K = kOf(BB_PER_RANK * R, syn); return T + tPost(K, { ...o, R0: R }); };

// EICHUNG der Rangkurve vor dem Einbau: von 15,5k@9,8 h mit dem Ratengesetz nach 12,4 h integrieren
// und gegen die gemessenen 28,8k halten (die Zwischenpunkte stammen aus derselben Messung).
for (const e of [1.0, 1.2, 1.4]) {
  const c = 84000 / Math.pow(152000, e); let R = 15500; for (let s = 9.8; s < 12.4 - 1e-9; s += 0.01) R += c * Math.pow(R, e) * 0.01;
  console.log(`Eichung Rangkurve e ${e}: 9,8->12,4 h Modell ${Math.round(R)} gegen gemessen 28767 (${((R / 28767 - 1) * 100).toFixed(0)} %)`);
}

const D0 = 0.5;   // Ende des Aufbaus nach Knotenstart (vorlage.md Abschnitt 3: erste Sperre endet ~12,5 h)
console.log("\n(1) ERSTE Corp-Runde: Ausgang [h nach Knotenstart] mit 12-h- gegen 6-h-Sperre, Tc = Corp-Geld verfuegbar");
console.log("    Spalten: Tc | Einbau alt/neu | gespart min / Mitte / max ueber " + bands.length + " Baender | Anteil Baender, in denen neu schlechter ist");
for (const syn of [false, true]) {
  console.log(syn ? "  mit The Syndicate" : "  ohne The Syndicate");
  for (const Tc of [9.8, 10.8, 11.5, 12.0, 12.5, 13.5]) {
    const Talt = Math.max(Tc, D0 + 12), Tneu = Math.max(Tc, D0 + 6);
    const d = bands.map((o) => exitAt(Talt, syn, o) - exitAt(Tneu, syn, o)).sort((x, y) => x - y);
    const schlechter = d.filter((x) => x < -1e-9).length;
    console.log(`    Tc ${String(Tc).padEnd(4)} | ${Talt.toFixed(1)} / ${Tneu.toFixed(1)} | ${d[0].toFixed(2)} / ${d[Math.floor(d.length / 2)].toFixed(2)} / ${d[d.length - 1].toFixed(2)} h | ${schlechter}/${d.length}`);
  }
}

// (2) ZWEITE Corp-Runde im selben Knoten: faellt das Ende der Sperre noch in den laufenden Knoten?
// Nach dem ersten Corp-Einbau bei T1 dauert der Aufbau D1 (BN3.1 live: 5,7 min, data/einbau-uhr.json
// 06.10. 19:00); die naechste Sperre endet T1 + D1 + max(S, 2 D1). Laeuft der Knoten dann noch, steht er im
// Endspiel (Rang ~400k, Black Ops) - ein Einbau setzt die Kampfwerte auf 1, und einbauErlaubt()
// (lib/endspurt.js) haelt ihn auf dem Bladeburner-Weg nur bei `offen` auf.
const D1 = 0.1;
console.log("\n(2) ZWEITE Corp-Runde: Anteil der Baender, in denen der Knoten beim Ende der Sperre NOCH LAEUFT");
for (const syn of [false, true]) {
  for (const T1 of [10.8, 12.5]) {
    const R = () => rankAt(T1); const K = (o) => kOf(BB_PER_RANK * R(o), syn);
    const post = bands.map((o) => tPost(K(o), { ...o, R0: R(o) }));
    const n6 = post.filter((p) => p > D1 + 6).length, n12 = post.filter((p) => p > D1 + 12).length;
    const s = [...post].sort((x, y) => x - y);
    console.log(`  ${syn ? "mit " : "ohne"} Syndicate, Einbau ${T1} h (k ${K(bands[0]).toFixed(2)}): Einbau->Ausgang ${s[0].toFixed(1)}-${s[s.length - 1].toFixed(1)} h; laeuft noch nach 6 h: ${n6}/${post.length}, nach 12 h: ${n12}/${post.length}`);
  }
}
