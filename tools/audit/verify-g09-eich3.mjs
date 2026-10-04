// G09: Eichung 3 - Krankenhaus je Raid-Fehlschlag (E5), Infiltrate-Zufluss in den Raid-Vorrat (E6), Chaos je Raid (E7).
import { listRun, readSave, fmt, mapEntries, bbOf } from "./verify-g09-lib.mjs";
import { ACT, ctxOf, damage, K } from "./verify-g09-model.mjs";
const files = listRun("BN2L1");
const pts = files.map((f) => { const { p } = readSave(f); const c = ctxOf(p); return { f, h: p.playtimeSinceLastBitnode / 3.6e6, p, c, bb: c.bb, lv: c.levels,
  tasks: (p.sleeves || []).map((s) => { const d = s.data || s; const w = d.currentWork; return w ? w.ctor : "-"; }) }; });
console.log("== E5: Krankenhauskosten je Raid-Fehlschlag (Fenster, in denen alle numHosp-Zuwaechse Raid-Fehlschlaege des Spielers sind)");
for (let i = 1; i < pts.length; i++) {
  const A = pts[i - 1], Z = pts[i];
  const dH = Z.bb.numHosp - A.bb.numHosp, dF = Z.lv["Raid"].failures - A.lv["Raid"].failures;
  if (dH <= 0 || Math.abs(dH - dF) > 0 || Z.h - A.h > 2) continue;
  const dM = Z.bb.moneyLost - A.bb.moneyLost;
  // Modell: Schaden bei Stufe L (Mittel der Stufen am Anfang/Ende), HP max des Spielers
  const L = (A.lv["Raid"].level + Z.lv["Raid"].level) / 2, hpMax = A.p.hp.max;
  const dmg = damage(ACT["Raid"], L);
  const cost = (hpMax - (hpMax - dmg)) * K.hospPerHp;   // aus vollen HP: (max - (hp - dmg)) = dmg
  const money = A.p.money;
  const capped = Math.min(0.1 * money, cost);
  console.log(`h${fmt(A.h, 2)}-${fmt(Z.h, 2)}: ${dF} Fehlschlaege, moneyLost Soll ${fmt(dM / dF / 1e6, 2)} Mio je Stueck, Ist-Modell ${fmt(capped / 1e6, 2)} Mio (Stufe ${fmt(L, 1)}, Schaden ${fmt(dmg, 0)} HP, Konto ${fmt(money / 1e9, 2)} Mrd)`);
}
console.log("\n== E6: Raid-Vorrat Zufluss: Soll = Vorrat0 + natuerlich 15,75/h*dt + Infiltrate-Ereignisse - Raid-Versuche; Ist = Vorrat1");
for (let i = 1; i < pts.length; i++) {
  const A = pts[i - 1], Z = pts[i];
  const dt = Z.h - A.h; if (dt < 0.5 || dt > 1.2) continue;
  const nA = A.tasks.filter((t) => t === "SleeveInfiltrateWork").length, nZ = Z.tasks.filter((t) => t === "SleeveInfiltrateWork").length;
  if (nA !== nZ) continue;
  const n = nA; const att = (Z.lv["Raid"].successes + Z.lv["Raid"].failures) - (A.lv["Raid"].successes + A.lv["Raid"].failures);
  const inflow = 2.1 / 480 * 3600 * dt + (n > 0 ? (dt * 3600 / 61) * n * Math.pow(n, -0.5) / 2 : 0);
  const soll = A.lv["Raid"].count + inflow - att;
  console.log(`h${fmt(A.h, 2)}-${fmt(Z.h, 2)}: Sleeves auf Infiltrate ${n}, Versuche ${att}, Soll ${fmt(soll, 1)} Ist ${fmt(Z.lv["Raid"].count, 1)} (Diff ${fmt(Z.lv["Raid"].count - soll, 1)}; Streuung des Wachstums ~ +-${fmt(Math.sqrt(dt * 3600 / 480 * 0.8 + 0.01), 1)})`);
}
console.log("\n== E7: Chaos je Raid: Soll ln(chaos1/chaos0) = n * E[ln(1+U(1..5)/100)] (+ Vertrags-Zaehlwerte), Ist aus Staenden (Sector-12 bis h5,3)");
let lnMean = 0; for (let k = 1; k <= 5; k++) lnMean += Math.log(1 + k / 100) / 5;
for (let i = 1; i < pts.length; i++) {
  const A = pts[i - 1], Z = pts[i];
  if (Z.h > 5.4 || A.bb.city !== "Sector-12" || Z.bb.city !== "Sector-12") continue;
  const n = (Z.lv["Raid"].successes + Z.lv["Raid"].failures) - (A.lv["Raid"].successes + A.lv["Raid"].failures);
  const c0 = A.c.ctx.city.chaos, c1 = Z.c.ctx.city.chaos;
  const add = 0.04 * (Z.lv["Retirement"].successes - A.lv["Retirement"].successes) + 0.02 * (Z.lv["Bounty Hunter"].successes - A.lv["Bounty Hunter"].successes);
  console.log(`h${fmt(A.h, 2)}-${fmt(Z.h, 2)}: ${n} Raids, chaos ${fmt(c0, 2)} -> Soll ${fmt(c0 * Math.exp(n * lnMean) + add, 2)} Ist ${fmt(c1, 2)}`);
}
