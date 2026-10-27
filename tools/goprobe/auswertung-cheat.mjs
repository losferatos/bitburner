// Liest die JSON-Zeilen von play-cheat.mjs (stdin) und fasst sie zusammen.
// Verhaeltnisschaetzer NP/Aktion mit Delta-Methode; Siegquote mit Binomialfehler.
let s = ""; process.stdin.on("data", (d) => s += d).on("end", () => {
  const r = s.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const L = r.flatMap((x) => x.liste); // [np, akt, schwarz, win, cheats]
  const n = L.length;
  const sum = (f) => L.reduce((a, x) => a + f(x), 0);
  const mean = (f) => sum(f) / n;
  const se = (f) => { const m = mean(f); return Math.sqrt(L.reduce((a, x) => a + (f(x) - m) ** 2, 0) / (n - 1) / n); };
  const SNP = sum((x) => x[0]), SA = sum((x) => x[1]);
  const R = SNP / SA;
  // Delta-Methode fuer R = sum(np)/sum(akt)
  const ma = SA / n;
  const seR = Math.sqrt(L.reduce((a, x) => a + (x[0] - R * x[1]) ** 2, 0) / (n - 1) / n) / ma;
  const win = mean((x) => x[3]);
  const f2 = (v) => +v.toFixed(2);
  console.log(JSON.stringify({
    opt: process.argv[2], datei: process.argv[3].split(/[\/]/).slice(-2).join("/"), partien: n,
    siege: f2(win), seSiege: +Math.sqrt(win * (1 - win) / n).toFixed(3),
    schwarz: f2(mean((x) => x[2])), seSchwarz: f2(se((x) => x[2])),
    aktJePartie: f2(mean((x) => x[1])), seAkt: f2(se((x) => x[1])),
    npJePartie: f2(mean((x) => x[0])), seNp: f2(se((x) => x[0])),
    npJeAktion: f2(R), seNpJeAktion: f2(seR),
    cheatsJePartie: f2(mean((x) => x[4])), cheatPartienAnteil: f2(mean((x) => (x[4] > 0 ? 1 : 0))),
    versucht: r.reduce((a, x) => a + x.cheatsVersucht, 0), erfolg: r.reduce((a, x) => a + x.cheatsErfolg, 0),
    niederlagen: r.reduce((a, x) => a + x.niederlagen, 0), fehler: r.reduce((a, x) => a + x.fehler, 0),
  }));
});
