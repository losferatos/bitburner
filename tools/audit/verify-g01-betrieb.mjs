// Gegenpruefung G01 (Gang in BN2), Winkel BETRIEB - Audit 03.10.2026.
//
// Fragt nicht "was kann eine Gang", sondern "was tut DIESER Bot mit einer
// Gang, wenn niemand hinsieht". Sieben Abschnitte:
//   1. Eichung: Preisformel + Kaufreihenfolge gegen moneySourceA.augmentations
//      zweier echter Spielstaende (Soll/Ist).
//   2. Bonuszeit der Gang: Faktor aus GangConstants (Quelle), gegen die
//      Behauptung "2,5-fach" im Inventarbericht.
//   3. Zeitlinie BN2.1: wann kann eine gebaute Gang hier ueberhaupt laufen?
//   4. Kaufregel des Bots (bn4rep.js:1737-1745 "alles Verdiente sofort,
//      absteigend je Runde") gegen die Optimalrunde des Berichts
//      (gang-round.mjs bestRound, q0 = 0), fuer BN2.2 Zyklus 1.
//   5. Wann kauft der Bot The Red Pill (GANG-2) - Zyklus 1 oder 2?
//   6. Drei Einbauzyklen: Kaufregel heute / am Tor / optimal.
//   7. Naechstes Einbautor BN2.1 aus der Live-Telemetrie im Spielstand.
//
// Aufruf: node tools/audit/verify-g01-betrieb.mjs   (ABSCHNITT=N fuer einen Abschnitt)
// Nur lesen. Keine Schreibzugriffe ausser stdout.
import fs from "node:fs";
import path from "node:path";
import { parseAugs, gangOffer } from "./gang-augs.mjs";
import { readSave } from "./gang-save.mjs";
import { simulate } from "./gang-sim.mjs";
import { bestRound } from "./gang-round.mjs";
import { kampfknotenNuetzlich, combatNutzen } from "../../src/lib/hackaugs.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const BK = path.join(ROOT, "backups");
const SRC = path.join(ROOT, "reference", "bitburner-src", "src");
// Abschnittswahl per Umgebungsvariable ABSCHNITT: gang-round.mjs liest argv[2] als Spielstand.
const argI = -1;
const ONLY = process.env.ABSCHNITT ? Number(process.env.ABSCHNITT) : null;
const show = (n) => ONLY === null || ONLY === n;
const f2 = (x, d = 2) => Number(x).toFixed(d);

const augs = parseAugs();
const byName = Object.fromEntries(augs.map((a) => [a.name, a]));

// ---------------------------------------------------------------------------
// 1. Eichung Preisformel (AugmentationHelpers.ts:29-37, 155-158): Summe
//    base * 1,9^i ueber die Warteschlange in Speicherreihenfolge muss
//    moneySourceA.augmentations ergeben. Belegt zugleich, dass die
//    Warteschlange die Kaufreihenfolge ist (Grundlage fuer Abschnitt 4).
// ---------------------------------------------------------------------------
if (show(1)) {
  console.log("=== 1. Eichung Preisformel/Kaufreihenfolge gegen Spielstand ===");
  for (const f of ["LIVE_197f4d61481686_BN2L1_2026-10-03T17-17_hourly.json.gz",
    "LIVE_197f4d61481686_BN2L1_2026-10-03T19-01_pre-install.json.gz"]) {
    const { p } = readSave(path.join(BK, f));
    const q = p.queuedAugmentations.map((a) => a.name);
    const ist = q.reduce((s, n, i) => s + byName[n].moneyCost * Math.pow(1.9, i), 0);
    const soll = -(p.moneySourceA.data || p.moneySourceA).augmentations;
    console.log(`  ${f.slice(27, 49)}  q=${q.length}  Soll ${f2(soll / 1e9, 4)} Mrd  Ist ${f2(ist / 1e9, 4)} Mrd  `
      + (Math.abs(soll - ist) / soll < 1e-9 ? "OK" : "ABWEICHUNG"));
  }
}

// ---------------------------------------------------------------------------
// 2. Bonuszeit der Gang. Gang.ts:99-121 + engine.tsx:105: process(1) je
//    Motortakt (200 ms); verarbeitet wird, sobald 10 Zyklen gesammelt sind,
//    hoechstens 25 auf einmal. Ohne Bonus also 10 Zyklen je 10 Takte
//    (1 Zyklus/Takt), mit Bonus 25 Zyklen je Takt.
// ---------------------------------------------------------------------------
if (show(2)) {
  console.log("\n=== 2. Nachholfaktor der Gang (Quelle, kein Modell) ===");
  const t = fs.readFileSync(path.join(SRC, "Gang", "data", "Constants.ts"), "utf8");
  const minC = Number(t.match(/minCyclesToProcess:\s*(\d+)\s*\//)[1]) / 200;
  const maxC = Number(t.match(/maxCyclesToProcess:\s*(\d+)\s*\//)[1]) / 200;
  const normalPerTick = minC / minC;       // 10 Zyklen alle 10 Takte
  const bonusPerTick = maxC;               // 25 Zyklen jeden Takt
  console.log(`  minCyclesToProcess ${minC}, maxCyclesToProcess ${maxC}`);
  console.log(`  ohne Bonus ${normalPerTick} Zyklus/Takt, mit Bonus ${bonusPerTick} Zyklen/Takt -> Faktor ${bonusPerTick / normalPerTick}`);
  console.log("  (GangStats.tsx:31 bonusCyclesInOneSecond = 5 * maxCyclesToProcess = 125 gegen 5 normal)");
  console.log("  Bericht inventar-gang.md Zeile 13: 'wird 2,5-fach nachgeholt' -> FALSCH, es ist 25-fach.");
  for (const off of [6.73, 18.5]) {
    console.log(`  ${off} h offline: Gang holt in ${f2(off / 24 * 60, 0)} min online nach (Bladeburner 5x: ${f2(off / 4 * 60, 0)} min Bonusabbau)`);
  }
  console.log("  Gedrosselter Tab (1 Wake/min = updateGame(300)): Gang verarbeitet 25 von 300 Zyklen,");
  console.log("  Rest wird Bonus -> kein Verlust, nur Verzug bis der Tab wieder wach ist.");
}

// ---------------------------------------------------------------------------
// 3. Zeitlinie BN2.1 aus den Spielstaenden.
// ---------------------------------------------------------------------------
if (show(3)) {
  console.log("\n=== 3. Zeitlinie BN2.1 (Spielstaende) ===");
  const rows = [];
  for (const f of ["LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz",
    "LIVE_197f4d61481686_BN2L1_2026-10-03T17-17_hourly.json.gz",
    "LIVE_197f4d61481686_BN2L1_2026-10-03T19-01_pre-install.json.gz",
    "LIVE_197f4d61481686_BN2L1_2026-10-03T20-17_hourly.json.gz",
    "LIVE_197f4d61481686_BN2L1_2026-10-03T21-17_hourly.json.gz"]) {
    const { p } = readSave(path.join(BK, f));
    const bb = p.bladeburner.data || p.bladeburner;
    const hNode = p.playtimeSinceLastBitnode / 3.6e6;
    const bonusH = bb.storedCycles / 5 / 3600;
    const hack = (p.moneySourceB.data || p.moneySourceB).hacking;
    rows.push({ f, hNode, bonusH, eff: hNode - bonusH, rank: bb.rank, lastUpdate: p.lastUpdate, hack });
    console.log(`  ${f.slice(27, 49)} Knoten ${f2(hNode)} h, BB-Bonus ${f2(bonusH)} h, effektiv ${f2(hNode - bonusH)} h,`
      + ` Rang ${f2(bb.rank, 0)}, BlackOps ${bb.numBlackOpsComplete}, Hacking-Geld ${f2(hack / 1e9)} Mrd`);
  }
  const last = rows[rows.length - 1];
  const incomeH = last.hack / last.hNode;
  console.log(`  Hacking-Einkommen BN2.1 Schnitt: ${f2(incomeH / 1e9)} Mrd/h (Grundlage Abschnitt 4)`);
  // Analogie aus bn-bn2.md Abschnitt 3 (effektive Zeit): Rang 5.000 bei
  // BN4.3 18,4 h / BN9.3 28,4 h, Ende 51,4 / 53,7 h.
  const rest = [51.4 - 18.4, 53.7 - 28.4];
  const endEff = rest.map((r) => last.eff + r);
  console.log(`  Rang ${f2(last.rank, 0)} bei ${f2(last.eff)} h effektiv -> Ende per Analogie bei ${f2(Math.min(...endEff), 1)}-${f2(Math.max(...endEff), 1)} h effektiv`);
  const wallEnd = endEff.map((e) => new Date(last.lastUpdate + (e - last.eff) * 3.6e6)).sort((a, b) => a - b);
  console.log(`  Wanduhr (Spielzeit = Wandzeit, Offline zaehlt mit): ${wallEnd.map((d) => d.toISOString().slice(0, 16)).join(" bis ")} UTC`);
  // Zwei Bautermine: heute Nacht (Gruendung Sa 23:30 MESZ) oder nach dem
  // Wochenreset (Gruendung So 16:00 MESZ = Reset 13:00 + 3 h Bau/Test/Skeptiker).
  for (const [lbl, iso] of [["Sa 23:30", "2026-10-03T21:30:00Z"], ["So 16:00", "2026-10-04T14:00:00Z"]]) {
    const hFound = last.hNode + (Date.parse(iso) - last.lastUpdate) / 3.6e6;
    const gangH = endEff.map((e) => Math.max(0, e - hFound)).sort((a, b) => a - b);
    console.log(`  Gruendung ${lbl}: Knotenzeit ${f2(hFound, 1)} h -> Gang-Laufzeit bis Knotenende ${f2(gangH[0], 1)}-${f2(gangH[1], 1)} h`
      + ` (1,25 Mio Ruf braucht 8,6-11,2 h)`);
  }
}

// ---------------------------------------------------------------------------
// 7. Naechstes Einbautor BN2.1 aus der Live-Telemetrie (data/einbau-uhr.json
//    im Spielstand, Regel lib/endspurt.js kampfEinbauSperre: Tor = fertig +
//    max(12 h, 2 x Aufbaudauer), gemessen in totalPlaytime inkl. Offline).
//    Eichung: Aufbauende "fertig" gegen den Spielstand 19:17 (Kampfwerte >= 100?).
// ---------------------------------------------------------------------------
if (show(7)) {
  console.log("\n=== 7. Naechstes Einbautor BN2.1 (Live-Telemetrie im Spielstand 21:17) ===");
  const { save } = readSave(path.join(BK, "LIVE_197f4d61481686_BN2L1_2026-10-03T21-17_hourly.json.gz"));
  const servers = JSON.parse(save.data.AllServersSave);
  const flat = (o) => (o && typeof o === "object" && "ctor" in o && "data" in o ? o.data : o);
  const home = flat(servers.home);
  const tf = home.textFiles.ctor === "JSONMap" ? home.textFiles.data : Object.entries(home.textFiles);
  const file = (n) => { const e = tf.find(([k]) => k === n); return e ? String(flat(e[1]).text ?? flat(e[1]).content) : null; };
  const uhr = JSON.parse(file("data/einbau-uhr.json"));
  const einbau = JSON.parse(file("data/einbau.json"));
  const p = JSON.parse(save.data.PlayerSave).data;
  const aufbauH = (uhr.fertig - uhr.playtime) / 3.6e6;
  const torMs = uhr.fertig + Math.max(12 * 3.6e6, 2 * (uhr.fertig - uhr.playtime));
  const restH = (torMs - p.totalPlaytime) / 3.6e6;
  console.log(`  Einbau bei totalPlaytime ${f2(uhr.playtime / 3.6e6, 3)} h, Aufbau fertig ${f2(uhr.fertig / 3.6e6, 3)} h (Dauer ${f2(aufbauH * 60, 1)} min)`);
  console.log(`  einbau.json: wartend ${einbau.wartend}, kampfZuFrueh ${einbau.kampfZuFrueh}, gesperrt-Feld ${einbau.gesperrt}`);
  console.log(`  Tor oeffnet bei totalPlaytime ${f2(torMs / 3.6e6, 3)} h; Stand ${f2(p.totalPlaytime / 3.6e6, 3)} h -> in ${f2(restH, 2)} h`
    + ` = ${new Date(p.lastUpdate + restH * 3.6e6).toISOString().slice(0, 16)} UTC (Spielzeit laeuft offline weiter)`);
  const hNodeTor = p.playtimeSinceLastBitnode / 3.6e6 + restH;
  console.log(`  Knotenzeit am Tor ${f2(hNodeTor, 1)} h; Gang-Zeit bis dahin bei Gruendung Sa 23:30: ${f2(hNodeTor - (p.playtimeSinceLastBitnode / 3.6e6 + (Date.parse("2026-10-03T21:30:00Z") - p.lastUpdate) / 3.6e6), 1)} h`);
}

// ---------------------------------------------------------------------------
// 4. Kaufregel des Bots gegen die Optimalrunde. BN2.2 Zyklus 1: Besitz leer,
//    q0 = 0, Gruendung bei t = 0, Einbau bei T (Sperre >= 12 h).
// ---------------------------------------------------------------------------
const save0959 = readSave(path.join(BK, "LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz")).p;
const L = { hacking: save0959.skills.hacking, strength: save0959.skills.strength, defense: save0959.skills.defense,
  dexterity: save0959.skills.dexterity, agility: save0959.skills.agility, intelligence: save0959.skills.intelligence };
const W = { hacking: 0.1, strength: 0.2, defense: 0.2, dexterity: 0.2, agility: 0.2, intelligence: 0.1 };
const D = { hacking: 0.6, strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, intelligence: 0.75 };
const COMBAT = ["strength", "defense", "dexterity", "agility"];
const competence = (ex) => Object.keys(W).reduce((c, s) => c + W[s] * Math.pow(L[s] * (ex[s] || 1), D[s]), 0);
const C0 = competence({});
const extraOf = (names) => { const e = {}; for (const n of names) for (const s of COMBAT) e[s] = (e[s] || 1) * (byName[n][s] || 1); return e; };

function repCurve(reg, hours) {
  const r = simulate({ hours, type: "combat", ...reg, log: true });
  const pts = r.marks.map((m) => ({ h: m.h, rep: m.rep, money: m.moneyB * 1e9 }));
  const at = (t, key) => {
    if (t <= pts[0].h) return pts[0][key];
    for (let i = 1; i < pts.length; i++) {
      if (t <= pts[i].h) {
        const a = pts[i - 1], b = pts[i];
        return a[key] + (b[key] - a[key]) * (t - a.h) / (b.h - a.h);
      }
    }
    return pts[pts.length - 1][key];
  };
  return { rep: (t) => at(t, "rep"), money: (t) => at(t, "money"), repHit: r.repHit };
}

const offerBN2 = gangOffer(augs, 2, 1).map((a) => a.name);
// Kaufregel bn4rep.js:1737-1745: je Runde absteigend nach Preis, kaufen wenn
// Ruf >= Bedarf und Geld >= Preis; purchaseAugmentation verlangt die
// Voraussetzungen besessen oder wartend. Filter bn4rep.js:672 mit
// kampfknotenNuetzlich(aug, mitHashes) aus src/lib/hackaugs.js (SF9 -> true).
function botRound({ curve, T, income, filter, stepMin = 0.25, favorMult = 1 }) {
  const cand = offerBN2.filter(filter);
  const q = [];
  let spent = 0;
  for (let t = 0; t <= T + 1e-9; t += stepMin / 60) {
    const rep = curve.rep(t) * favorMult;
    let money = income * t + curve.money(t) - spent;
    const list = cand.filter((n) => !q.includes(n)).sort((a, b) => byName[b].moneyCost - byName[a].moneyCost);
    for (const n of list) {
      const a = byName[n];
      if (rep < a.repCost) continue;
      if (!a.prereqs.every((pr) => q.includes(pr))) continue;
      const price = a.moneyCost * Math.pow(1.9, q.length);
      if (money < price) continue;
      q.push(n); spent += price; money -= price;
    }
  }
  const ex = extraOf(q);
  return { q, spent, comp: competence(ex) / C0, ex };
}

if (show(4)) {
  console.log("\n=== 4. Kaufregel des Bots gegen Optimalrunde (BN2.2 Zyklus 1, q0 = 0) ===");
  const income = 4.09e9; // Mrd/h aus Abschnitt 3 (BN2.1 Schnitt, brutto - guenstig fuer den Bericht)
  const regs = { best: { trainUntil: 500, ascThr: 1.3, ascWorkThr: 2 }, einfach: { trainUntil: 300, ascThr: 1.6, ascWorkThr: 0 } };
  const fIst = (n) => kampfknotenNuetzlich(n, true);
  const fFix = (n) => n !== "The Red Pill" && kampfknotenNuetzlich(n, false);
  const nIst = offerBN2.filter(fIst), nFix = offerBN2.filter(fFix);
  console.log(`  Gang-Angebot BN2 ${offerBN2.length}; durch den V2-Filter heute ${nIst.length}`
    + ` (davon Hacknet ${nIst.filter((n) => n.startsWith("Hacknet")).length}, TRP ${nIst.includes("The Red Pill") ? 1 : 0}), nach HASH-4+GANG-2 ${nFix.length}`);
  const cheapHacknet = nIst.filter((n) => n.startsWith("Hacknet")).map((n) => `${n.split(" ")[2]} ${byName[n].repCost}`);
  console.log(`  Hacknet-Stuecke (Ruf): ${cheapHacknet.join(", ")} -> in den ersten Minuten verdient`);
  for (const [rn, reg] of Object.entries(regs)) {
    const curve = repCurve(reg, 26);
    for (const T of [8, 12, 16]) {
      const ist = botRound({ curve, T, income, filter: fIst });
      const fix = botRound({ curve, T, income, filter: fFix });
      const budget = income * T + curve.money(T);
      const opt = bestRound(budget, 0, curve.rep(T), { owned: new Set(), offerNames: nFix });
      console.log(`  Regler ${rn.padEnd(7)} T=${String(T).padStart(2)} h  Ruf ${f2(curve.rep(T) / 1e6)} Mio  Geld ${f2(budget / 1e9, 1)} Mrd |`
        + ` Bot heute: ${String(ist.q.length).padStart(2)} Augs, x${f2(ist.comp)}${ist.q.includes("The Red Pill") ? " +TRP" : ""}`
        + ` | Bot mit HASH-4/GANG-2: ${String(fix.q.length).padStart(2)} Augs, x${f2(fix.comp)}`
        + ` | Optimal (Bericht): ${String(opt.seq.length).padStart(2)} Augs, x${f2(opt.comp)}`);
      if (rn === "best" && T === 12) {
        console.log("     Bot heute, Kaufreihenfolge:", ist.q.map((n, i) => `${i}:${n.replace(/ (Architecture|Direct-Neural|Neural-Upload|Interface)/g, "")}`).join(" | "));
        console.log("     Optimal:", opt.seq.join(" > "));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Wann kauft der Bot The Red Pill? Zyklus 1 mit Favor 0; Einbau bei T=12 h
//    nullt den Ruf, Favor aus dem kumulierten Ruf (Faction.ts:77-83,
//    favor.ts) hebt die Folgerate um (1 + favor/100) (Gang.ts:151-155).
// ---------------------------------------------------------------------------
if (show(5)) {
  console.log("\n=== 5. Zeitpunkt des TRP-Kaufs (2,5 Mio Ruf in EINEM Einbauzyklus) ===");
  const favorOf = (cum) => Math.log1p(cum / 25000) / 0.019802627296179712;
  for (const [rn, reg] of Object.entries({ best: { trainUntil: 500, ascThr: 1.3, ascWorkThr: 2 }, einfach: { trainUntil: 300, ascThr: 1.6, ascWorkThr: 0 } })) {
    const curve = repCurve(reg, 40);
    const hit1 = curve.repHit[2.5e6];
    const T1 = 12;
    if (hit1 !== undefined && hit1 <= T1) {
      console.log(`  Regler ${rn}: 2,5 Mio nach ${f2(hit1, 1)} h -> TRP noch in Zyklus 1 gekauft, Einbau bei Sperrende erzwungen`);
      continue;
    }
    const rep1 = curve.rep(T1);
    const fav = favorOf(rep1);
    const mult = 1 + fav / 100;
    // Zyklus 2: Ratenkurve ab T1 (Gang laeuft weiter, Ruf startet bei 0, mal Favor)
    let t = T1, r = 0;
    while (r < 2.5e6 && t < 40) { t += 0.05; r = (curve.rep(t) - rep1) * mult; }
    console.log(`  Regler ${rn}: Zyklus 1 endet bei ${T1} h mit ${f2(rep1 / 1e6)} Mio (Favor ${f2(fav, 0)}, x${f2(mult)}) ->`
      + ` 2,5 Mio in Zyklus 2 nach ${f2(t - T1, 1)} h -> TRP-Kauf, danach kein Einbau mehr im Knoten`);
  }
}

// ---------------------------------------------------------------------------
// 6. Ueber mehrere Einbauzyklen (BN2.2, Gruendung bei Zyklusbeginn):
//    drei Kaufregeln gegeneinander, jeweils MIT GANG-2/HASH-4-Filter.
//    a) heute:      bn4rep.js:1737-1745, alles Verdiente sofort (absteigend je Runde)
//    b) am Tor:     erst kaufen, wenn die Einbausperre offen ist, dann
//                   absteigend nach Preis, was verdient + bezahlbar ist
//    c) optimal:    gang-round.mjs bestRound (Competence je Dollar, q0 = 0)
//    Ruf je Zyklus k: (R(t) - R(Tk-1)) * (1 + favor_k/100) (Gang.ts:151-155),
//    favor_k = repToFavor(kumulierter Ruf) (favor.ts:12-24, Faction.ts:77-83).
//    Geld je Zyklus: Einkommen * T (Prestige setzt das Konto zurueck).
//    Vernachlaessigt (fuer alle drei gleich): InstallAscensionPenalty 0,95,
//    andere Faktionen in der Warteschlange (verschlechtert a) zusaetzlich).
// ---------------------------------------------------------------------------
if (show(6)) {
  console.log("\n=== 6. Drei Einbauzyklen, drei Kaufregeln (BN2.2, Gruendung bei t=0, Zyklus T) ===");
  const repToFavor = (r) => Math.log1p(r / 25000) / 0.019802627296179712;
  const income = 4.09e9;
  const fFix = (n) => n !== "The Red Pill" && kampfknotenNuetzlich(n, false);
  const nFix = offerBN2.filter(fFix);
  const prereqOk = (n, have) => byName[n].prereqs.every((pr) => have.has(pr));
  function runPolicy(policy, curveR, T, nCycles) {
    const owned = new Set();
    let cumRep = 0, t0 = 0;
    const out = [];
    for (let k = 1; k <= nCycles; k++) {
      const fav = repToFavor(cumRep);
      const fm = 1 + fav / 100;
      const repAt = (t) => (curveR.rep(t0 + t) - curveR.rep(t0)) * fm;
      const cand = nFix.filter((n) => !owned.has(n));
      const q = [];
      let spent = 0;
      const tryBuy = (t) => {
        const rep = repAt(t);
        let money = income * t - spent;
        const list = cand.filter((n) => !q.includes(n)).sort((a, b) => byName[b].moneyCost - byName[a].moneyCost);
        for (const n of list) {
          if (rep < byName[n].repCost) continue;
          if (!prereqOk(n, new Set([...owned, ...q]))) continue;
          const price = byName[n].moneyCost * Math.pow(1.9, q.length);
          if (money < price) continue;
          q.push(n); spent += price; money -= price;
        }
      };
      if (policy === "heute") { for (let t = 0; t <= T + 1e-9; t += 0.25 / 60) tryBuy(t); }
      else if (policy === "amTor") { tryBuy(T); tryBuy(T); }
      else {
        const r = bestRound(income * T, 0, repAt(T), { owned: new Set(owned), offerNames: nFix });
        for (const n of r.seq) q.push(n);
      }
      for (const n of q) owned.add(n);
      cumRep += repAt(T);
      t0 += T;
      out.push({ k, fav, n: q.length, comp: competence(extraOf([...owned])) / C0, top: q.slice(0, 3) });
    }
    return out;
  }
  for (const [rn, reg] of Object.entries({ best: { trainUntil: 500, ascThr: 1.3, ascWorkThr: 2 }, einfach: { trainUntil: 300, ascThr: 1.6, ascWorkThr: 0 } })) {
    for (const T of [12, 14]) {
      const curve = repCurve(reg, 3 * T + 1);
      const rows = {};
      for (const pol of ["heute", "amTor", "optimal"]) rows[pol] = runPolicy(pol, curve, T, 3);
      console.log(`  Regler ${rn}, T=${T} h:`);
      for (const pol of ["heute", "amTor", "optimal"]) {
        console.log(`    ${pol.padEnd(8)} ` + rows[pol].map((r) => `Z${r.k}: +${String(r.n).padStart(2)} Augs, Favor ${f2(r.fav, 0).padStart(3)}, Competence x${f2(r.comp)}`).join(" | "));
      }
      console.log(`    erstes Stueck Z1: heute ${rows.heute[0].top[0]} | amTor ${rows.amTor[0].top[0]} | optimal ${rows.optimal[0].top[0]}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 8. BN2.1 konkret: Gruendung Sa 23:30 MESZ, Tor So ~07:04 MESZ (Abschnitt 7)
//    -> 7,6 h Gang-Zeit. Besitz = installiert laut Spielstand 21:17 (q = 0),
//    Budget = Konto 21:17 + Einkommen bis zum Tor (brutto, guenstig gerechnet).
// ---------------------------------------------------------------------------
if (show(8)) {
  console.log("\n=== 8. BN2.1 Tor-Runde (Gruendung Sa 23:30, Tor nach 7,6 h Gang-Zeit) ===");
  const p21 = readSave(path.join(BK, "LIVE_197f4d61481686_BN2L1_2026-10-03T21-17_hourly.json.gz")).p;
  const owned21 = new Set([...(p21.augmentations || []), ...(p21.queuedAugmentations || [])].map((a) => a.name));
  const fFix = (n) => n !== "The Red Pill" && kampfknotenNuetzlich(n, false);
  const nFix = offerBN2.filter(fFix).filter((n) => !owned21.has(n));
  const tGang = 7.6;
  for (const budget of [30e9, 48e9]) {
    for (const [rn, reg] of Object.entries({ best: { trainUntil: 500, ascThr: 1.3, ascWorkThr: 2 }, einfach: { trainUntil: 300, ascThr: 1.6, ascWorkThr: 0 } })) {
      const curve = repCurve(reg, 12);
      const rep = curve.rep(tGang);
      const opt = bestRound(budget, 0, rep, { owned: new Set(owned21), offerNames: nFix });
      // am Tor: absteigend nach Preis, verdient + bezahlbar + Voraussetzung
      const q = []; let money = budget;
      for (let pass = 0; pass < 2; pass++) {
        for (const n of nFix.filter((x) => !q.includes(x)).sort((a, b) => byName[b].moneyCost - byName[a].moneyCost)) {
          if (rep < byName[n].repCost) continue;
          if (!byName[n].prereqs.every((pr) => owned21.has(pr) || q.includes(pr))) continue;
          const price = byName[n].moneyCost * Math.pow(1.9, q.length);
          if (money < price) continue;
          q.push(n); money -= price;
        }
      }
      console.log(`  Budget ${f2(budget / 1e9, 0)} Mrd, Regler ${rn.padEnd(7)} Ruf ${f2(rep / 1e6)} Mio | am Tor: ${q.length} Augs, x${f2(competence(extraOf(q)) / C0)}`
        + ` | optimal: ${opt.seq.length} Augs, x${f2(opt.comp)} (${opt.seq.slice(0, 4).join(", ")} ...)`);
    }
  }
  console.log("  (Competence relativ zu den Stufen des Spielstands 09:59; Gang-Augs nur Kampfwerte, BB-Faktion nicht mitgerechnet)");
}
