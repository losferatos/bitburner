// Hebel-Vorlage: H3 in BN3.2/3.3 - frueher Corp-Einbau (weniger Bladeburners-Ruf, also weniger BB-Stuecke) gegen spaeten.
// k aus der echten Rundenwahl (rundenplan.mjs), Laufzeit nach Einbau aus lauf.mjs (GESCHAETZT). Nur lesen.
import { cands, plan } from "../bot/rechnung/rundenplan.mjs";
import { tPost } from "./lauf.mjs";
const F0 = ["NiteSec", "Aevum", "Sector-12", "Tetrads", "Slum Snakes", "CyberSec", "The Black Hand", "Tian Di Hui"];
const k = (bb, syn, budget = 1e15) => plan(cands(syn ? [...F0, "The Syndicate"] : F0, { bribe: true, bbRep: bb }), budget).gain;
const mid = (K) => tPost(K, { e: 1.2, b: 1.35, beta: 0.7 });
const lo = (K) => tPost(K, { e: 1.4, b: 1.7, beta: 0.8, early: 0.7 });
const hi = (K) => tPost(K, { e: 1.0, b: 1.0, beta: 0.65, early: 1.3 });
// BB-Ruf Zyklus 1 ~ 2,86 x Rang (faction_rep 1,43, Favor 0); Rang BN2.3: 15,5k@9,8h, 19,1k@10,8h, 23,4k@11,8h, 28,8k@12,4h
for (const syn of [false, true]) {
  console.log(syn ? "mit The Syndicate" : "ohne The Syndicate");
  for (const [T, rank] of [[10.8, 19053], [11.8, 23399], [12.5, 28767], [13.5, 36000]]) {
    const bb = 2.86 * rank, K = k(bb, syn);
    console.log(`  Einbau ${T} h, BB-Ruf ${Math.round(bb / 1000)}k: k ${K.toFixed(2)}  Ausgang ${(T + lo(K)).toFixed(1)} / ${(T + mid(K)).toFixed(1)} / ${(T + hi(K)).toFixed(1)} h`);
  }
}
