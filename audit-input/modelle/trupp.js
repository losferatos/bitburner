// Recruitment nach data/GeneralActions.ts:22-31, Casualties nach Actions/TeamCasualties.ts:29-62
const T = (c) => Math.max(10, Math.round(300 - (Math.pow(c, 0.81) + c / 90)));
const P = (c, team) => Math.min(1, Math.pow(c, 0.45) / (team + 1));
console.log('Eichung cha 264: T', T(264), '(Kommentar blade.js:2670: 206), cha^0,45', Math.pow(264, 0.45).toFixed(2), '(12,29)');
console.log('Truppbonus 6 Mann: ', Math.pow(7, 0.05).toFixed(4));
// Erwartete Verluste je Black Op mit 6 Mann
const mean = (a, b) => (a + b) / 2;
console.log('Verluste je BO-Erfolg (1..ceil(3)):', mean(1, 3), ' je Fehlschlag (1..6):', mean(1, 6));
for (const c of [1, 4, 20, 50, 100, 264, 309, 1000]) {
  // Nachfuellen von 4 auf 6 (Erfolg) bzw. 2,5 auf 6 (Fehlschlag, gerundet 3->6)
  let t46 = 0; for (let k = 4; k < 6; k++) t46 += T(c) / P(c, k);
  let t06 = 0; for (let k = 0; k < 6; k++) t06 += T(c) / P(c, k);
  console.log('cha', String(c).padStart(4), 'T', String(T(c)).padStart(3), 's  4->6:', (t46 / 60).toFixed(1).padStart(5), 'min   0->6:', (t06 / 60).toFixed(1).padStart(6), 'min');
}
