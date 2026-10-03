// Audit 03.10.2026 (INFRA): Amortisationsdeckel des Cloud-Ausbaus
// (bn4net.js:1499-1513: 600 s bei wartend >= 2, sonst 1800 s) im
// Kampfknoten BN2.1.
//
// Frage: Welche Park-Groesse laesst die Bot-Regel bei 600 s bzw. 1800 s zu,
// und was bringt der Unterschied in $/h?
//
// Eingaben:
//  - Grenzertragskurve des Bots aus data/bn4net.json (mix.grenz = mittlerer
//    Ertrag in $/GB*s der naechsten 1024 / 4096 / 16384 GB) im Spielstand
//    BN2.1 09:59 (07:59 UTC).
//  - kapFreiGb (freie Aufnahme der Geldziele) aus derselben Datei.
//  - Preise: cloudCost aus infra-costs.mjs (geeicht, rel. Abweichung 0).
//  - Eichfaktor: gemessener Durchschnittsertrag 208 $/GB*s (infra-throttle.mjs)
//    gegen Kurvenspitze -> Kurve wird zusaetzlich skaliert gerechnet.
//
// Aufruf: node tools/audit/infra-deckel.mjs
import { readSave } from "./infra-save.mjs";
import { cloudCost } from "./infra-costs.mjs";

const f = "backups/LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz";
const { servers } = readSave(f);
const tf = servers.home.data.textFiles.data.find(([n]) => n === "data/bn4net.json")[1];
const j = JSON.parse((tf.data || tf).text);
const grenz = j.mischung.grenz;           // [A(1024), A(4096), A(16384)]
const kapFrei = j.mischung.kapFreiGb;
console.log("Bot-Kurve mix.grenz:", grenz, " kapFreiGb:", kapFrei, " Park jetzt:", j.netz);

// Grenzertrag stueckweise aus den Mittelwerten
const I1 = grenz[0] * 1024, I2 = grenz[1] * 4096, I3 = grenz[2] * 16384;
const bands = [
  { upTo: 1024, m: I1 / 1024 },
  { upTo: 4096, m: (I2 - I1) / 3072 },
  { upTo: 16384, m: (I3 - I2) / 12288 },
  { upTo: Infinity, m: 0 },
];
const marg = (x, scale) => {
  if (x >= kapFrei) return 0;
  for (const b of bands) if (x < b.upTo) return b.m * scale;
  return 0;
};
console.log("Grenzertrag-Baender $/GB*s:", bands.slice(0, 3).map((b) => b.m.toFixed(0)).join(" / "));

// Park: 4x256 + 21x128 (Spielstand). Ausbauregel: kleinsten verdoppeln, solange
// Schrittpreis/(zusatzGb * Grenzertrag) <= Deckel.
function grow(deckel, scale) {
  const park = [256, 256, 256, 256, ...Array(21).fill(128)];
  let extra = 0, cost = 0, income = 0;
  for (let guard = 0; guard < 500; guard++) {
    park.sort((a, b) => a - b);
    const r = park[0];
    if (r >= 1048576) break;
    const c = cloudCost(2 * r, 2) - cloudCost(r, 2);
    // Bot rechnet grenzErtrag(zusatzGb) = Mittel ueber die naechsten r GB
    let sum = 0;
    for (let x = extra; x < extra + r; x += 64) sum += marg(x, scale) * Math.min(64, extra + r - x);
    const ertrag = sum / r;
    const amort = ertrag > 0 ? c / (r * ertrag) : Infinity;
    if (amort > deckel) break;
    park[0] = 2 * r;
    extra += r; cost += c; income += sum;
  }
  return { extra, cost, income, park: park.reduce((a, b) => a + b, 0) };
}
for (const scale of [1, 208 / grenz[0]]) {
  const a = grow(600, scale), b = grow(1800, scale);
  console.log("\nSkalierung", scale.toFixed(3), "(1 = Bot-Kurve, <1 = auf gemessene 208 $/GB*s geeicht)");
  console.log("  Deckel  600 s: +", a.extra, "GB fuer", (a.cost / 1e9).toFixed(2), "Mrd -> +", (a.income * 3600 / 1e9).toFixed(2), "Mrd $/h");
  console.log("  Deckel 1800 s: +", b.extra, "GB fuer", (b.cost / 1e9).toFixed(2), "Mrd -> +", (b.income * 3600 / 1e9).toFixed(2), "Mrd $/h");
  console.log("  Differenz 1800 gegen 600: +", ((b.income - a.income) * 3600 / 1e9).toFixed(2), "Mrd $/h fuer",
    ((b.cost - a.cost) / 1e9).toFixed(2), "Mrd einmalig; Amortisation der Differenz",
    ((b.cost - a.cost) / Math.max(1, b.income - a.income) / 60).toFixed(0), "min");
}
