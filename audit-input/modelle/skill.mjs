const skill = (exp, mult) => Math.max(Math.floor(mult * (32 * Math.log(exp + 534.6) - 200)), 1);
const expFor = (lvl, mult) => Math.exp((lvl / mult + 200) / 32) - 534.6;
// Eichung: Spielstand 17:19 exp 1.4236727e8, mult hacking 7.16552645088455 * BN 1 -> Spiel sagt 2871
console.log("Eichung", skill(142367274.77237964, 7.16552645088455), "(Spiel: 2871)");
for (const m of [7.17, 8, 9, 10]) console.log("m", m, "exp fuer 4500", expFor(4500, m).toExponential(3), "fuer 3000", expFor(3000,m).toExponential(3), "fuer 3183.6", expFor(3183.6, m/1.0612).toExponential(3));
