// G09-Betrieb, Teil A: Eichung des Raid-Vorrat-Modells gegen echte Spielstaende.
//   Soll(Ende) = Anfang + g*dt/480*... - Versuche + Infiltrate-Zufluss
//   Versuche = Differenz (Erfolge + Fehlschlaege) der Raid-Zaehler im Spielstand (exakt, nicht geschaetzt)
//   g = 2,1 je 480 s (Mittel von getRandomIntInclusive(2,40)/10, data/Operations.ts: Raid growthFunction)
//   Infiltrate: je Sleeve auf INFILTRATE amt = N^-0,5/2 je 61 s (Bladeburner.ts:1251-1263), N = Anzahl
// Aufruf: node tools/audit/verify-g09-betrieb-vorrat.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stateOf } from "./sleeve-bb.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const B = (n) => path.join(root, "backups", "LIVE_197f4d61481686_" + n + ".json.gz");
const f = (x, n = 2) => (Number.isFinite(x) ? x.toFixed(n) : String(x));

const serie = [
  ["BN2.1", ["BN2L1_2026-10-03T05-33_hourly", "BN2L1_2026-10-03T06-33_hourly", "BN2L1_2026-10-03T07-33_hourly", "BN2L1_2026-10-03T08-33_hourly", "BN2L1_2026-10-03T09-19_pre-hotswap", "BN2L1_2026-10-03T09-33_hourly", "BN2L1_2026-10-03T09-46_connect", "BN2L1_2026-10-03T09-59_pre-hotswap"]],
  ["BN2.2", ["BN2L2_2026-10-04T11-17_hourly", "BN2L2_2026-10-04T12-17_hourly", "BN2L2_2026-10-04T13-17_hourly"]],
];
const G = 2.1 / 480;  // Raid je Spielsekunde
const nInf = (s) => s.sleeves.filter((x) => x.work && x.work.ctor === "SleeveInfiltrateWork").length;
console.log("=== Eichung Raid-Vorrat: Soll = Anfang + g*dt - Versuche + Infiltrate; Ist = Spielstand ===");
const stats = [];
for (const [tag, namen] of serie) {
  const S = namen.map((n) => stateOf(B(n)));
  for (let i = 1; i < S.length; i++) {
    const A = S[i - 1], Z = S[i];
    const dt = Z.play - A.play;
    const versuche = (Z.sc.Raid.s + Z.sc.Raid.f) - (A.sc.Raid.s + A.sc.Raid.f);
    // Infiltrate-Zufluss: Mittel der Sleeve-Zahl am Anfang und am Ende (grob; die Sleeves wechseln nur an Taktgrenzen)
    const nA = nInf(A), nZ = nInf(Z), n = (nA + nZ) / 2;
    const inf = n > 0 ? n * Math.pow(n, -0.5) / 2 * (dt / 61) : 0;
    const soll = A.count.Raid + G * dt - versuche + inf;
    const ist = Z.count.Raid;
    stats.push({ tag, dt, versuche, soll, ist, A: A.count.Raid, nA, nZ });
    console.log(`${tag} ${namen[i - 1].slice(-22, -9)}->${namen[i].slice(-22, -9)}: dt ${f(dt / 3600, 2)} h, Versuche ${versuche}, Infiltrate N ${nA}/${nZ} (+${f(inf, 1)}), Anfang ${f(A.count.Raid, 1)} -> Soll ${f(soll, 1)} Ist ${f(ist, 1)} (Abw ${f(ist - soll, 1)})`);
  }
}
// Verbrauch je Stunde im Vorratsbetrieb (Versuche/h), nur Intervalle mit Anfangsvorrat > 20 (nicht leergefahren)
console.log("\n=== Verbrauch (Versuche/h) in Intervallen ohne Mangel (Anfangsvorrat > 20, Ende > 5) ===");
for (const s of stats) if (s.A > 20 && s.ist > 5) console.log(`${s.tag}: ${f(s.versuche / (s.dt / 3600), 1)} Raid-Versuche/h  (dt ${f(s.dt / 3600, 2)} h)`);
console.log("\nNetto-Abfluss Vorrat/h (Ist) in diesen Intervallen:");
for (const s of stats) if (s.A > 20 && s.ist > 5) console.log(`${s.tag}: ${f((s.A - s.ist) / (s.dt / 3600), 1)} /h`);
