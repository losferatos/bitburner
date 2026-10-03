// Szenarien fuer den Gang-Bericht: Kampf- gegen Hackinggang, GangSoftcap der
// Restroute, Geldmodus. Nutzt gang-sim.mjs (ungeeicht, Formeln geprueft).
//
// Aufruf: node tools/audit/gang-scen.mjs
import { simulate } from "./gang-sim.mjs";

const best = { trainUntil: 500, ascThr: 1.3, ascWorkThr: 2 };   // bestes Raster-Ergebnis Kampfgang
const simple = { trainUntil: 300, ascThr: 1.6, ascWorkThr: 0 }; // einfacher Regler
const h = (r, x) => (r.repHit[x] === undefined ? "  -  " : r.repHit[x].toFixed(1).padStart(5));
function line(label, r) {
  const last = r.marks.length ? r.marks[r.marks.length - 1] : null;
  console.log(label.padEnd(44), "|", h(r, 1e5), h(r, 4.375e5), h(r, 7.5e5), h(r, 1.25e6), h(r, 1.625e6), h(r, 2.5e6), "|",
    (r.rep / 1e6).toFixed(2).padStart(7) + "M", last ? ("resp/s " + last.respPerS) : "");
}
console.log("Szenario".padEnd(44), "| h bis 100k 437k  750k 1.25M 1.625M 2.5M | Rep@30h (faction_rep 1,328, favor 0)");

// 1) Kampf gegen Hacking, BN2
for (const [n, p] of [["best", best], ["einfach", simple]]) {
  line(`BN2 Kampfgang ${n}`, simulate({ hours: 30, type: "combat", ...p, log: true }));
}
let bestHack = null;
for (const trainUntil of [200, 300, 500, 800]) for (const ascThr of [1.3, 1.6]) for (const ascWorkThr of [0, 2]) {
  const r = simulate({ hours: 30, type: "hacking", trainUntil, ascThr, ascWorkThr, log: true });
  if (!bestHack || r.rep > bestHack.rep) bestHack = { ...r, p: { trainUntil, ascThr, ascWorkThr } };
}
line(`BN2 Hackinggang bestes von 16 (${JSON.stringify(bestHack.p).replace(/"/g, "")})`, bestHack);

// 2) GangSoftcap der Restroute (BitNode.tsx je case): Rep-Ziele sind in diesen
//    Knoten zusaetzlich mit AugmentationRepCost zu multiplizieren (BN3: 3).
for (const [bn, sc] of [["BN3 (0,9)", 0.9], ["BN11/BN15 (1,0)", 1], ["BN6/7/14 (0,7)", 0.7], ["BN13 (0,3)", 0.3]]) {
  line(`${bn} Kampfgang best`, simulate({ hours: 30, type: "combat", ...best, gangSoftcap: sc, log: true }));
}

// 3) Geldmodus: Respekt bis 12 Mitglieder, danach alles auf Geld
const mny = simulate({ hours: 30, type: "combat", ...best, mode: "mixed", moneyFrom: 12, log: true });
console.log("\nGeldmodus (ab 12 Mitgliedern alles auf Geldaufgaben), BN2 Kampfgang best:");
for (const m of mny.marks.filter((x) => x.h % 4 === 0 || x.h >= 29.9))
  console.log(`  h ${String(m.h).padStart(4)}  Mitglieder ${m.members}  Geld kumuliert ${m.moneyB} Mrd  Rate ${(m.moneyPerS * 3600 / 1e9).toFixed(1)} Mrd/h  Rep ${m.rep}`);
