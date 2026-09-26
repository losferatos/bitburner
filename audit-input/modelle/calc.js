// Nachbau der Spielformeln (v3.0.2) mit Eichung gegen Spielstaende.
const log102 = 0.019802627296179712;
const favorToRep = (f) => Math.max(0, 25000 * Math.expm1(log102 * f));
const repToFavor = (r) => Math.log1p(r / 25000) / log102;
const addRepToFavor = (f, r) => repToFavor(favorToRep(f) + r);
const skill = (exp, mult) => Math.floor(mult * (32 * Math.log(exp + 534.6) - 200));
const expFor = (lvl, mult) => Math.exp((lvl / mult + 200) / 32) - 534.6;
const out = (k, v) => console.log(k.padEnd(62), v);

console.log("=== EICHUNG ===");
// 1) Favor: BitRunners 16:37 favor 140.678..., rep 251792 -> nach Einbau; 16:57 rep?; 17:19 favor 209.1288 rep 1030505 -> 18:04 favor 234.59
out("BitRunners 17:19 favor 209.12883815559482 + 1030505 rep ->", addRepToFavor(209.12883815559482, 1030505).toFixed(4) + " (Spielstand 18:04: 234.59)");
out("Spendenschwelle-Rest bei favor 140.6780966081174 ->", (favorToRep(150) - favorToRep(140.6780966081174)).toFixed(0) + " (Log 15:15: 82172)");
out("favorToRep(150) ->", favorToRep(150).toFixed(0) + " (Log: 462490)");
out("Daedalus favor 3.00 -> Schwelle-Rest", (favorToRep(150) - favorToRep(3.0)).toFixed(0) + " (Log 17:26: 460961 bei favor ~3)");
// 2) Skill: 17:19 hack 2871, exp 142367274.77237964, mult 7.16552645088455 (BN5 HackingLevelMultiplier 1)
out("skill(1.4237e8, 7.16553) ->", skill(142367274.77237964, 7.16552645088455) + " (Spielstand: 2871)");
out("skill(3.66714e8, 9.03649) ->", skill(366714363.0775504, 9.036485297927909) + " (Spielstand 18:04: 3895)");

console.log("\n=== BEFUND A: Einbau nach Spenden-Leerung (16:57 BN5.2) ===");
const BN5_MONEY = 2;
const price = (base, q) => base * BN5_MONEY * Math.pow(1.9, q);
out("ENM Core V2 bei q=3 (statt q=1 im naechsten Zyklus)", (price(4.5e9, 3) / 1e9).toFixed(2) + " Mrd  (gezahlt 17:10 bei q=1: " + (price(4.5e9, 1) / 1e9).toFixed(2) + ")");
out("Neuralstimulator bei q=4", (price(3e9, 4) / 1e9).toFixed(2) + " Mrd (Log: 41154m bei q=3 -> " + (price(3e9, 3) / 1e9).toFixed(2) + ")");
// Einkommen aus dem Log 16:48-16:55: ~4.1 Mrd je 16 s
const inc = 4.1e9 / 16;
out("Einkommen aus Spendentakt (4,1 Mrd / 16 s)", (inc / 1e6).toFixed(0) + " Mio/s");
const fr1657 = 1e6 * 272466 / 51643e6; // nicht exakt, grob
const needRepV2 = 122372; // 16:57:09 "12484m fuer 122372 fehlende"
const frEff = (122372 - 0) ; // placeholder
out("Restbedarf ENM Core V2 16:57:09: Spende 12484m deckt 122372 rep (Log)", "");
const tWait = (12.484e9 + price(4.5e9, 3) + price(3e9, 4)) / inc;
out("Wartezeit fuer Spende + ENM V2 (q3) + Neuralstimulator (q4)", (tWait / 60).toFixed(1) + " min");
out("Tatsaechlich: Folgezyklus 16:57 -> 17:19", "22 min, plus zweiter Levelverlust");

console.log("\n=== BEFUND A': BN1.3 00:23 (Red Pill fehlte) ===");
// 00:23:12 GESPENDET 17050m fuer ... Vorher 00:22:54 33973m fuer 1733832 fehlend, danach 1620114 fehlend
const repGained = 1733832 - 1620114; // durch 33973m-Spende (+Arbeit 18s)
out("Rep je Mrd aus Log (33973m -> " + repGained + " rep)", (repGained / 33.973).toFixed(0) + " rep/Mrd => fr ~" + (repGained / 33973).toFixed(2));
const moneyRP = 1620114 / (repGained / 33.973e9);
out("Geld fuer restliche 1620114 rep", (moneyRP / 1e9).toFixed(0) + " Mrd");
// Einkommen: Spenden 00:21:27..00:23:12 (105 s): 116693+28608+1958+40226+3599+11527+29327+33973+17050 m + Kaeufe 6000+5460+11730 m
const spent = (116693 + 28608 + 1958 + 40226 + 3599 + 11527 + 29327 + 33973 + 17050 + 6000 + 5460 + 11730) * 1e6;
out("Ausgaben 00:21:27-00:23:12 (inkl. Startguthaben)", (spent / 1e9).toFixed(0) + " Mrd");
const inc2 = (spent - 116693e6) / 105;
out("Zufluss ohne Startguthaben (105 s)", (inc2 / 1e9).toFixed(2) + " Mrd/s");
out("=> Red Pill waere bezahlt nach", (moneyRP / inc2 / 60).toFixed(1) + " min");

console.log("\n=== BEFUND C: Spendenrecht-Einbau wartet auf Nicht-NFG-Stueck (BN5.2 15:15-16:37) ===");
const rate = 3073.4 / 60; // BitRunners gemessen, rep/s (rep-ziel 16:37)
const tCross = 82172 / rate;
out("Zeit bis Schwelle 82172 bei 3073,4 rep/min", (tCross / 60).toFixed(1) + " min -> ca. 15:" + (15 + Math.round(tCross / 60)));
const nfgRep44 = 500 * Math.pow(1.14, 43);
out("NFG Stufe 44 Reputation (500*1.14^43)", nfgRep44.toFixed(0));
const tNfg = nfgRep44 / rate;
out("Zeit bis NFG-44 kaufbar", (tNfg / 60).toFixed(1) + " min ab 15:15");
out("NFG-44 Preis bei q=0 (750k*1.14^43*2)", (750e3 * Math.pow(1.14, 43) * 2 / 1e6).toFixed(0) + " Mio");
out("Tatsaechlicher Einbau", "16:37 (82 min nach 15:15)");

console.log("\n=== BEFUND E: BN12 Spendenformel ohne FactionWorkRepGain ===");
for (const lvl of [1, 2, 3]) {
  const dec = 1 / Math.pow(1.02, lvl);
  const got = 1.02 * dec; // Anteil der benoetigten Reputation, den die NFG-Spende bringt
  out(`BN12.${lvl}: Spende deckt Anteil`, got.toFixed(5) + (got < 1 ? "  -> Kauf scheitert" : "  -> gerade so"));
  const favDon = Math.floor(150 * Math.pow(1.02, lvl));
  const repCostMult = Math.pow(1.02, lvl);
  out(`BN12.${lvl}: Schwelle favorToRep(${favDon}) vs Synfibril 437.5k*${repCostMult.toFixed(4)}`, favorToRep(favDon).toFixed(0) + " vs " + (437500 * repCostMult).toFixed(0));
  out(`BN12.${lvl}: DaedalusAugsRequirement`, Math.floor(Math.min(30 + Math.pow(1.02, lvl), 40)));
}

console.log("\n=== BEFUND F: Heimspeicher 16:37 ===");
const homeCost = (ram) => ram * 32000 * Math.pow(1.58, Math.log2(ram));
out("Kosten 64 TB -> 128 TB", (homeCost(65536) / 1e12).toFixed(2) + " Bio (Guthaben 16:37: 4.41 Bio; Kaufschwelle homegrow 3x = " + (3 * homeCost(65536) / 1e12).toFixed(2) + ")");
out("Kern 6 (1e9*7.5^5)", (1e9 * Math.pow(7.5, 5) / 1e12).toFixed(2) + " Bio");

console.log("\n=== Endanstieg BN5 (Einordnung) ===");
for (const m of [9.04, 10.8, 13.0]) out(`Erfahrung fuer 4500 bei mult ${m}`, expFor(4500, m).toExponential(3));
out("Erfahrungsrate 17:04-18:04 (gemessen)", ((366714363 - 36200000) / 3600).toExponential(2) + " /s");

console.log("\n=== Fokus-Befund ===");
const fShare = 31 / 71;
out("Anteil FACTION-Snapshots ohne Fokus", (fShare * 100).toFixed(0) + " %  -> mittlerer Faktor " + (1 - fShare * 0.2).toFixed(3));
out("Daedalus-Schwelle 18:04: Rest", (460961 - 183012) + " rep bei 4791.6/min = " + ((460961 - 183012) / 4791.6).toFixed(0) + " min");
