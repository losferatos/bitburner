// Rechnung Punkt 4 (06.10.2026): Lohnt mit Corp-Geld + Bestechung ein frueher Einbau gegen die 12-h-Sperre?
// Rangmodell geld-bn3-lauf.mjs mk(a): dR/dt = A (R/24000)^a K^beta, geeicht auf BN2.3 (GESCHAETZT, +-50 %).
// Rundeninhalt je Tor: ECHTE waehleTorRunde (rundenplan.mjs), Faktionen bestochen, Bladeburners-Ruf
// = 2 x Rangzuwachs x 1,43 (faction_rep) seit dem letzten Einbau (Bladeburner/Formulas.ts:46-49; BN3.1
// Zyklus 1 gemessen 38.645 Ruf / 13.315 Rang = 2,90). Einbau setzt Bladeburners-Ruf auf 0, Rang bleibt.
// t = 0: Einbau 06.10. 17:11. Zuendung t_i = 8,6 h (~01:45). Wiederaufbau r (Rang 0). Nur lesen.
// Aufruf: node nodes/corp-2026-10-05/bot/rechnung/einbauzeit.mjs [--r=0.5] [--crime] [--ti=8.6] [--money=1.5]
import { mk } from "../../../../tools/audit/geld-bn3-lauf.mjs";
import { cands, plan } from "./rundenplan.mjs";
import { loadBot, loadState } from "../../../../tools/audit/gang-p2b-lib.mjs";
import { kOf } from "../../../../tools/audit/geld-bn3-kist.mjs";
const bot = await loadBot();
const S = loadState("BN3L1_2026-10-06T17-10_pre-install");
const bbs = Object.fromEntries(Object.entries(S.bb.skills.data ? Object.fromEntries(S.bb.skills.data) : S.bb.skills));
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith("--" + k + "=")); return a ? Number(a.split("=")[1]) : d; };
const R_REB = arg("r", 0.5), T_I = arg("ti", 8.6), T_MONEY = arg("money", 1.5);
const CRIME = process.argv.includes("--crime");
const JOINED = ["The Black Hand", "NiteSec", "Aevum", "Sector-12", "Tetrads", "Slum Snakes", "Tian Di Hui", "CyberSec"];
const FACS = CRIME ? [...JOINED, "The Syndicate", "Speakers for the Dead", "The Dark Army"] : JOINED;
const OWN0 = ["Neurotrainer I", "Wired Reflexes", "Augmented Targeting I", "LuminCloaking-V1 Skin Implant", "Augmented Targeting II"];
const K0 = kOf(bot, S.p.skills, bbs["Reaper"], bbs["Evasive System"], OWN0.map((n) => bot.COMBAT_AUGS[n]), "OperationTyphoon").k;

// lockH: Sperre nach Wiederaufbau-Ende im Corp-Modus; early: erster Corp-Einbau sofort bei Geld (Sperre ignoriert)
function run(model, { lockH = 12, early = false, minGain = 1.05 }) {
  const dt = 0.01;
  let t = 0, R = 13315, K = K0, bbRep = 0, rebuildUntil = R_REB, lockUntil = R_REB + 12;
  const owned = new Set(OWN0);
  const log = [];
  while (R < 400000 && t < 120) {
    const corpOk = t >= T_I + T_MONEY;
    const gateOpen = t >= lockUntil || (early && corpOk && log.length === 0);
    if (gateOpen && corpOk) {
      const c = cands(FACS, { bribe: true, bbRep }).filter((x) => !owned.has(x.aug));
      const p = plan(c, Infinity, owned);
      if (p.gain >= minGain) {
        // Gewinn relativ zu den schon eingebauten Stuecken: k(alle) / k(vorher)
        const before = kOf(bot, S.p.skills, bbs["Reaper"], bbs["Evasive System"], [...owned].map((n) => bot.COMBAT_AUGS[n]).filter(Boolean), "OperationTyphoon").k;
        p.steps.forEach((s) => owned.add(s.aug));
        const after = kOf(bot, S.p.skills, bbs["Reaper"], bbs["Evasive System"], [...owned].map((n) => bot.COMBAT_AUGS[n]).filter(Boolean), "OperationTyphoon").k;
        K *= after / before;
        log.push(`t=${t.toFixed(1)} h: ${p.steps.length} Stuecke, BB-Ruf ${Math.round(bbRep)}, K ${K.toFixed(2)}, Rang ${Math.round(R)}`);
        bbRep = 0; rebuildUntil = t + R_REB; lockUntil = t + R_REB + lockH;
      } else if (t >= lockUntil) lockUntil = t + 0.25;   // Runde zu klein: weiter warten, Viertelstunde
    }
    if (t >= rebuildUntil) {
      const dR = model.A * Math.pow(R / 24000, model.a) * Math.pow(K, model.beta) * dt;
      R += dR; bbRep += 2.9 * dR;
    }
    t += dt;
  }
  return { tExit: t, log };
}
const AS = arg("ascale", 1);
const models = [0.5, 0.6, 0.7].map(mk).map((m) => ({ ...m, A: m.A * AS }));
console.log(`A x${AS}, K0 = ${K0.toFixed(3)}, Wiederaufbau ${R_REB} h, Zuendung ${T_I} h, Geld+Bestechung ${T_MONEY} h danach, Faktionen: ${CRIME ? "beigetreten + Syndicate/Speakers/Dark Army" : "beigetreten"}`);
const sc = [
  ["heute: 12-h-Sperre", { lockH: 12 }],
  ["frueh: erster Corp-Einbau sofort, danach 12 h", { lockH: 12, early: true }],
  ["frueh + Sperre 6 h im Corp-Modus", { lockH: 6, early: true }],
  ["frueh + Sperre 3 h im Corp-Modus", { lockH: 3, early: true }],
  ["Sperre 6 h (ohne Sofort)", { lockH: 6 }],
];
for (const [name, o] of sc) {
  const r = models.map((m) => run(m, o));
  console.log(`${name.padEnd(46)} Rang 400k nach ${r.map((x) => x.tExit.toFixed(1)).join(" / ")} h (a 0,5/0,6/0,7)`);
  if (process.argv.includes("--log")) console.log("   " + r[1].log.join("\n   "));
}
