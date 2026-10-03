// Audit 03.10.2026, Gruppe BN6-7. Nur lesen.
//
// Was BN7 (BladeburnerRank 0,6, BladeburnerSkillCost 2) gegen BN6 (1/1)
// an Knotenzeit kostet, und was die SF6/SF7-Reihenfolge wert ist.
//
// 1. Black-Op-Summen und "Zaehlwerk-Faktor": Rang, den Vertraege/Operationen
//    bis zur Daedalus-Schranke liefern muessen, in Basiseinheiten (Rang/m).
//    Quelle: Bladeburner/data/BlackOperations.ts (rankGain/reqdRank),
//    Formulas.ts:22-25 (Gewinn x BladeburnerRank), :39-40 (Verlust ohne).
// 2. Beobachtete Fenster 20.000 -> 400.000 Rang aus den Spielstaenden
//    (backups/), exponentiell zwischen den Stuetzpunkten interpoliert, gegen
//    die Klammer [Zaehlwerk-Faktor, Zaehlwerk-Faktor x SkillCost].
// 3. Skillbudget-Wirkung im BN2L1-Stand (geeichte Formeln aus
//    blade-formeln.mjs): Typhoon-/Raid-Chance mit dem heutigen Skillsatz
//    gegen denselben Satz mit BN7-Budget (gleiche Zeit: SP x0,6, Kosten x2;
//    gleicher Rang: Kosten x2). Verschiebung = ln(Verhaeltnis)/g mit dem
//    gemessenen Chancenwachstum g = 0,115/h (src/sleeve.js:108).
// 4. Reihenfolge BN6.2/6.3 vor BN7 (Route) gegen umgekehrt: SF6.3 statt
//    SF6.1 in drei BN7-Laeufen gegen SF7.3 (+Simulacrum) in zwei BN6-Laeufen.
// 5. Daedalus-Fuellstueck (bn4rep.js:1552-1608) in BN6/7 (Schwelle 35):
//    wie oft landete ein V2-Einbau bei genau Schwelle-1 Stuecken?
// 6. Hash-Rang aus dem SF9.3-Gratisserver in BN6/7 (HacknetNodeMoney 0,2).
//
// Aufruf: node tools/audit/bn67-zeit.mjs
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { AKTIONEN, SKILLS, successChance, actionTime, rankGain } from "./blade-formeln.mjs";
import { calculateSkill } from "./bn67-mults.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = path.join(root, "reference", "bitburner-src", "src");
const backups = path.join(root, "backups");

const flach = (x) => {
  if (Array.isArray(x)) return x.map(flach);
  if (x && typeof x === "object") {
    if ("ctor" in x && "data" in x && Object.keys(x).length === 2) return flach(x.data);
    const o = {};
    for (const [k, v] of Object.entries(x)) o[k] = flach(v);
    return o;
  }
  return x;
};
const lade = (f) => {
  const save = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(backups, f))).toString("utf8"));
  return JSON.parse(save.data.PlayerSave).data;
};

// --- 1. Black Ops ------------------------------------------------------------
function blackOps() {
  const t = fs.readFileSync(path.join(SRC, "Bladeburner", "data", "BlackOperations.ts"), "utf8");
  const req = [...t.matchAll(/reqdRank:\s*([\d.e]+)/g)].map((m) => Number(m[1]));
  const gain = [...t.matchAll(/rankGain:\s*([\d.e]+)/g)].map((m) => Number(m[1]));
  const loss = [...t.matchAll(/rankLoss:\s*([\d.e]+)/g)].map((m) => Number(m[1]));
  return req.map((r, i) => ({ reqdRank: r, rankGain: gain[i], rankLoss: loss[i] }));
}

const KNOTEN = { 6: [1, 1], 7: [0.6, 2], 2: [1, 1], 3: [1, 1], 11: [1, 1], 14: [0.6, 2], 13: [0.45, 2], 15: [0.2, 3], 4: [1, 1], 9: [0.9, 1.2], 10: [0.8, 1] };

function zaehlwerk(m, bo) {
  const ziel = bo[bo.length - 1].reqdRank;              // Daedalus 400.000
  const ohneLetzte = bo.slice(0, -1).reduce((s, b) => s + b.rankGain, 0);
  return (ziel - m * ohneLetzte) / m;                     // Basiseinheiten aus Vertraegen/Ops
}

// --- 2. Fenster aus Spielstaenden --------------------------------------------
function laufPunkte(lauf) {
  const files = fs.readdirSync(backups).filter((f) => f.includes("_" + lauf + "_") && f.endsWith(".json.gz")).sort();
  const pts = [];
  for (const f of files) {
    try {
      const p = lade(f);
      const b = p.bladeburner ? flach(p.bladeburner) : null;
      pts.push({ t: p.playtimeSinceLastBitnode / 3.6e6, r: b ? b.maxRank : 0, bo: b ? b.numBlackOpsComplete : 0 });
    } catch { /* Datei kaputt - weg */ }
  }
  return pts.sort((a, b) => a.t - b.t);
}
function zeitBei(pts, ziel) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (a.r > 0 && a.r < ziel && b.r >= ziel) {
      const g = Math.log(b.r / a.r) / (b.t - a.t);
      return { t: a.t + Math.log(ziel / a.r) / g, spanne: b.t - a.t };
    }
    if (a.r >= ziel) return { t: a.t, spanne: 0 };
  }
  return null;
}

// --- 3./4. Chance im BN2L1-Stand ---------------------------------------------
function kumKosten(name, L) {
  const s = SKILLS[name];
  let k = 0;
  for (let l = 0; l < L; l++) k += s.baseCost + s.costInc * l;
  return k;
}
function stufeFuer(name, budget) {
  let L = 0;
  while (kumKosten(name, L + 1) <= budget + 1e-9) L++;
  return L;
}
function skalierteSkills(skills, faktor) {
  // je Skill denselben Anteil des (umgerechneten) Budgets: kum(L') = faktor * kum(L)
  const o = {};
  for (const [n, L] of Object.entries(skills)) { if (SKILLS[n]) o[n] = stufeFuer(n, faktor * kumKosten(n, L)); }
  return o;
}

if (process.argv[1] && process.argv[1].endsWith("bn67-zeit.mjs")) {
  const bo = blackOps();
  const summe = bo.reduce((s, b) => s + b.rankGain, 0);
  const ohne = summe - bo[bo.length - 1].rankGain;
  console.log("=== 1. Black Ops (BlackOperations.ts): " + bo.length + " Stueck, rankGain gesamt " + summe
    + ", ohne Daedalus " + ohne + ", Daedalus reqdRank " + bo[bo.length - 1].reqdRank + " ===");
  const z6 = zaehlwerk(1, bo);
  for (const [n, [m, c]] of Object.entries(KNOTEN)) {
    const z = zaehlwerk(m, bo);
    console.log("  BN" + String(n).padEnd(3) + " Rang " + m + " Skill x" + c + "  BO-Rang bis Daedalus " + Math.round(m * ohne)
      + "  Zaehlwerk " + Math.round(z) + " Basiseinheiten  Faktor gegen BN6 " + (z / z6).toFixed(3)
      + "  Klammer [" + (z / z6).toFixed(2) + " .. " + (c * z / z6).toFixed(2) + "]");
  }

  console.log("\n=== 2. Beobachtete Fenster 20.000 -> 400.000 Rang (maxRank, exponentiell interpoliert) ===");
  const laeufe = ["BN4L2", "BN4L3", "BN9L1", "BN9L2", "BN9L3", "BN10L2", "BN10L3"];
  const fenster = {};
  for (const l of laeufe) {
    const pts = laufPunkte(l);
    const a = zeitBei(pts, 20000), b = zeitBei(pts, 400000);
    const n = Number(l.slice(2, l.indexOf("L")));
    const [m, c] = KNOTEN[n];
    const ende = pts[pts.length - 1];
    if (a && b) {
      fenster[l] = b.t - a.t;
      console.log("  " + l.padEnd(7) + " m " + m + " c " + c + "  20k bei " + a.t.toFixed(1) + " h, 400k bei " + b.t.toFixed(1)
        + " h  Fenster " + (b.t - a.t).toFixed(1) + " h  (Stuetzabstand " + a.spanne.toFixed(1) + "/" + b.spanne.toFixed(1)
        + " h)  Knotenzeit bis letzter Stand " + ende.t.toFixed(1) + " h, BO " + ende.bo);
    } else {
      console.log("  " + l.padEnd(7) + " m " + m + " c " + c + "  Fenster nicht bestimmbar (letzter Stand " + ende.t.toFixed(1)
        + " h, Rang " + Math.round(ende.r) + ", BO " + ende.bo + ")");
    }
  }
  if (fenster.BN4L2) {
    for (const [l, w] of Object.entries(fenster)) {
      const n = Number(l.slice(2, l.indexOf("L")));
      const [m, c] = KNOTEN[n];
      const z = zaehlwerk(m, bo) / z6;
      console.log("  " + l.padEnd(7) + " Verhaeltnis zu BN4L2 " + (w / fenster.BN4L2).toFixed(2) + "  Klammer [" + z.toFixed(2) + " .. " + (c * z).toFixed(2) + "]");
    }
  }

  console.log("\n=== 3. Skillbudget BN7 gegen BN6 im BN2L1-Stand (17:17) ===");
  const p = lade("LIVE_197f4d61481686_BN2L1_2026-10-03T17-17_hourly.json.gz");
  const b = flach(p.bladeburner);
  const spieler = { skills: p.skills, mults: p.mults };
  const voll = { skills: b.skills, stamina: b.maxStamina, maxStamina: b.maxStamina };
  const typhoon = AKTIONEN["Operation Typhoon"];
  const raid = AKTIONEN.Raid;
  const stadt = { pop: 1.2e9, popEst: 1.2e9, chaos: 0, comms: 50 };   // Normstadt, nur Verhaeltnisse zaehlen
  const raidL = b.operations?.Raid?.level ?? 5;
  const c6 = successChance(typhoon, 1, spieler, voll, stadt);
  const r6 = successChance(raid, raidL, spieler, voll, stadt);
  const g = 0.115;
  console.log("  Skills heute: " + JSON.stringify(b.skills) + "  (tsp " + b.totalSkillPoints + ", maxRank " + Math.round(b.maxRank) + ")");
  console.log("  Typhoon-Chance heute (volle Ausdauer, Trupp 0): " + c6.toFixed(4) + "   Raid L" + raidL + ": " + r6.toFixed(4));
  for (const [name, faktor] of [["gleicher Rang (Kosten x2)", 0.5], ["gleiche Zeit (SP x0,6, Kosten x2)", 0.3]]) {
    const sk = skalierteSkills(b.skills, faktor);
    const bb7 = { ...voll, skills: sk };
    const c7 = successChance(typhoon, 1, spieler, bb7, stadt);
    const r7 = successChance(raid, raidL, spieler, bb7, stadt);
    const t6 = actionTime(raid, raidL, spieler, voll), t7 = actionTime(raid, raidL, spieler, bb7);
    console.log("  BN7, " + name.padEnd(34) + " Skills " + JSON.stringify(sk));
    console.log("      Typhoon " + c7.toFixed(4) + " (x" + (c7 / c6).toFixed(3) + ", Verschiebung " + (Math.log(c6 / c7) / g).toFixed(1)
      + " h bei g 0,115/h)   Raid " + r7.toFixed(4) + " (x" + (r7 / r6).toFixed(3) + "), Raid-Dauer " + t6 + " -> " + t7
      + " s, Raid-Rang je s x" + ((r7 * rankGain(raid, raidL, 0.6) / t7) / (r6 * rankGain(raid, raidL, 1) / t6)).toFixed(3));
  }

  console.log("\n=== 4. Reihenfolge: SF6.3 statt SF6.1 in BN7 gegen SF7.3 in BN6 (BN2L1-Stand) ===");
  const r = 1.14 / 1.08;   // applySourceFile.ts:93-108, Level- und Exp-Mult der Kampfwerte
  const sk63 = { ...p.skills };
  for (const st of ["strength", "defense", "dexterity", "agility"]) {
    const ist = calculateSkill(p.exp[st], p.mults[st]);
    const neu = calculateSkill(p.exp[st] * r, p.mults[st] * r);
    sk63[st] = p.skills[st] * neu / ist;
  }
  const cA = successChance(typhoon, 1, { skills: sk63, mults: p.mults }, voll, stadt);
  const cB = c6 * 1.14;
  console.log("  Kampfwerte heute " + ["strength", "defense", "dexterity", "agility"].map((s) => p.skills[s]).join("/")
    + " -> mit SF6.3 statt 6.1 " + ["strength", "defense", "dexterity", "agility"].map((s) => sk63[s].toFixed(1)).join("/"));
  console.log("  Typhoon x" + (cA / c6).toFixed(4) + " (SF6.3 statt 6.1)   gegen x1,14 (SF7.3, bladeburner_success_chance)");
  for (const gBN7 of [0.115, 0.06, 0.035]) {
    const a = 3 * Math.log(cA / c6) / gBN7;
    const bb = 2 * Math.log(1.14) / 0.115;
    console.log("  g in BN7 " + gBN7.toFixed(3) + "/h: Route (A) spart 3 x " + (Math.log(cA / c6) / gBN7).toFixed(2) + " = " + a.toFixed(2)
      + " h   Tausch (B) spart 2 x " + (Math.log(1.14) / 0.115).toFixed(2) + " = " + bb.toFixed(2) + " h (ohne Simulacrum-Nutzung, ohne Ausdauer)");
  }

  console.log("\n=== 5. Daedalus-Fuellstueck: V2-Einbauten, gezaehlt wie lib/einbau.js (installiert + wartend, NFG einmal) ===");
  const v2 = ["BN10L2", "BN10L3", "BN4L2", "BN4L3", "BN9L1", "BN9L2", "BN9L3", "BN2L1"];
  const landungen = [];
  for (const l of v2) {
    const files = fs.readdirSync(backups).filter((f) => f.includes("_" + l + "_") && f.endsWith("_pre-install.json.gz")).sort();
    const reihe = [];
    for (const f of files) {
      try {
        const q = lade(f);
        const inst = (q.augmentations || []).map((a) => a.name);
        const wart = (q.queuedAugmentations || []).map((a) => a.name);
        const distinkt = new Set([...inst, ...wart]).size;
        reihe.push(inst.length + "->" + distinkt);
        landungen.push({ l, vor: inst.length, nach: distinkt });
      } catch { /* weg */ }
    }
    console.log("  " + l.padEnd(7) + reihe.join("  "));
  }
  for (const s of [35, 20]) {
    const treffer = landungen.filter((x) => x.vor < s && x.nach === s - 1);
    const kreuz = landungen.filter((x) => x.vor < s - 1 && x.nach >= s - 1);
    console.log("  Schwelle " + s + ": Einbauten mit genau " + (s - 1) + " nach dem Einbau: " + treffer.length
      + " von " + kreuz.length + " Einbauten, die " + (s - 1) + " erreichen oder ueberspringen ("
      + treffer.map((x) => x.l).join(",") + ")");
  }

  console.log("\n=== 6. Hash-Rang aus dem SF9.3-Gratisserver in BN6/7 ===");
  // geeichte Rate BN2L1 09:59 (inventar-hash.md R1): 0,4814 Hashes/s bei HacknetNodeMoney 1
  const rate = 0.4814411330033169 * 0.2;
  for (const h of [3, 5, 10]) {
    let hashes = rate * h * 3600, stufe = 0;
    while (hashes >= 250 * (stufe + 1)) { hashes -= 250 * (stufe + 1); stufe++; }
    console.log("  erster Zyklus " + h + " h: " + Math.round(rate * h * 3600) + " Hashes -> " + stufe + " Rangstufen = "
      + 100 * stufe + " Rang (BN7 entspricht " + Math.round(100 * stufe / 0.6) + " Aktions-Basisrang)");
  }
}
