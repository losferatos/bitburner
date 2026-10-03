// Audit 03.10.2026, Gruppe BN14-13: Dauer der bisherigen V2-Laeufe aus den
// Spielstaenden (backups/*.json.gz, nur lesen) und Hochrechnung auf BN13/BN14.
//
// Teil 1 (gemessen): je V2-Lauf Beitrittszeit (erster Stand mit
// bladeburner != null), Spielzeit bis Knotenende (letzter Stand, pre-jump wenn
// vorhanden), Black-Op-Fortschritt, Rang-Zeitpunkte 10k/100k/400k.
// Teil 2 (Modell): Knotenfaktoren aus BitNode.tsx (bn1413-mults.mjs) und eine
// Stundenschaetzung je Phase. Das Modell ist ungeeicht (es gibt keinen Lauf in
// BN13/BN14); geeicht ist nur, dass es die gemessenen Laeufe in der richtigen
// Reihenfolge wiedergibt - die Abweichung je Lauf steht in der Ausgabe.
//
// Aufruf: node tools/audit/bn1413-eta.mjs [--neu]   (--neu: Cache verwerfen)
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { zeile } from "./bn67-kurven.mjs";
import { full } from "./bn1413-mults.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = path.join(root, "backups");
const CACHE = path.join(os.tmpdir(), "bn1413-eta-cache.json");

const V2 = ["BN10L2", "BN10L3", "BN4L2", "BN4L3", "BN9L1", "BN9L2", "BN9L3", "BN2L1"];

export function sammeln(neu = false) {
  if (!neu && fs.existsSync(CACHE)) {
    const c = JSON.parse(fs.readFileSync(CACHE, "utf8"));
    if (c.anzahl === fs.readdirSync(dir).length) return c.rows;
  }
  const idx = fs.readFileSync(path.join(dir, "INDEX.tsv"), "utf8").trim().split(/\r?\n/).slice(1);
  const rows = [];
  for (const l of idx) {
    const t = l.split("\t");
    const key = "BN" + t[4] + "L" + t[5];
    if (!V2.includes(key)) continue;
    const f = path.join(dir, t[1]);
    if (!fs.existsSync(f)) continue;
    try {
      const z = zeile(f);
      delete z.skills;
      rows.push({ key, ts: t[0], anlass: t[7], ...z });
    } catch (e) { rows.push({ key, ts: t[0], fehler: String(e).slice(0, 60) }); }
  }
  fs.writeFileSync(CACHE, JSON.stringify({ anzahl: fs.readdirSync(dir).length, rows }));
  return rows;
}

// Erster Zeitpunkt, an dem eine Groesse eine Schwelle erreicht (lineare
// Interpolation zwischen zwei Staenden, nur innerhalb desselben Knotenlaufs).
function erreicht(rs, feld, schwelle) {
  for (let i = 0; i < rs.length; i++) {
    const v = rs[i][feld];
    if (v != null && v >= schwelle) {
      if (i === 0) return rs[i].t_h;
      const a = rs[i - 1];
      const va = a[feld] ?? 0;
      if (va >= schwelle || v === va) return rs[i].t_h;
      return a.t_h + (rs[i].t_h - a.t_h) * (schwelle - va) / (v - va);
    }
  }
  return null;
}

if (process.argv[1] && process.argv[1].endsWith("bn1413-eta.mjs")) {
  const rows = sammeln(process.argv.includes("--neu")).filter((r) => !r.fehler);
  const lauf = {};
  for (const r of rows) (lauf[r.key] ||= []).push(r);
  console.log("Lauf    BN-Faktoren (Rang/Skill/KampfLM)  Staende  Beitritt_h  BO1_h  Rang10k_h Rang100k_h Rang400k_h  Ende_h  BO_Ende  Rang_Ende  letzter Anlass");
  const mess = {};
  for (const k of V2) {
    const rs = (lauf[k] || []).sort((a, b) => a.t_h - b.t_h || a.ts.localeCompare(b.ts));
    if (!rs.length) continue;
    // Knotenwechsel innerhalb eines Laufschluessels gibt es nicht; ein Einbau
    // setzt t_h nicht zurueck (playtimeSinceLastBitnode).
    const n = rs[0].bn;
    const m = full(n, 1);
    const join = rs.find((r) => r.rank != null);
    const bo1 = rs.find((r) => (r.bo || 0) >= 1);
    const last = rs[rs.length - 1];
    const f = (x) => (x == null ? "-" : x.toFixed(1));
    mess[k] = { bn: n, join: join ? join.t_h : null, ende: last.t_h, bo: last.bo, rang: last.maxRank, anlass: last.anlass,
      r400: erreicht(rs, "maxRank", 400000), r100: erreicht(rs, "maxRank", 100000), r10: erreicht(rs, "maxRank", 10000) };
    console.log(k.padEnd(8) + ("  " + m.BladeburnerRank + "/" + m.BladeburnerSkillCost + "/" + m.StrengthLevelMultiplier).padEnd(35)
      + String(rs.length).padStart(5) + f(join && join.t_h).padStart(12) + f(bo1 && bo1.t_h).padStart(7)
      + f(mess[k].r10).padStart(10) + f(mess[k].r100).padStart(11) + f(mess[k].r400).padStart(11)
      + f(last.t_h).padStart(8) + String(last.bo).padStart(9) + String(Math.round(last.maxRank || 0)).padStart(11) + "  " + last.anlass);
  }
  console.log("\n(Beitritt_h = erster Stand MIT Division - obere Schranke; der Stand davor ist die untere.)");
  for (const k of V2) {
    const rs = (lauf[k] || []).sort((a, b) => a.t_h - b.t_h);
    const i = rs.findIndex((r) => r.rank != null);
    if (i > 0) console.log("  " + k + ": Beitritt zwischen " + rs[i - 1].t_h.toFixed(2) + " h und " + rs[i].t_h.toFixed(2) + " h"
      + "  (Kampf davor " + [rs[i - 1].str, rs[i - 1].def, rs[i - 1].dex, rs[i - 1].agi].join("/") + ", Geld "
      + Number(rs[i - 1].money).toExponential(2) + ")");
    else if (i === 0) console.log("  " + k + ": Beitritt vor dem ersten Stand (" + rs[0].t_h.toFixed(2) + " h)");
  }
  fs.writeFileSync(path.join(os.tmpdir(), "bn1413-eta-mess.json"), JSON.stringify(mess, null, 1));

  // Spaetphase: Wachstumsrate g = ln(400k/100k) / (t400 - t100), aus den
  // interpolierten Zeitpunkten. Ein konstanter Rangfaktor k (BladeburnerRank)
  // verschiebt bei exponentiell wachsender Rate die Ankunft um ln(1/k)/g.
  // Das gilt NUR fuer die rangbegrenzte Spaetphase (ENTSCHIEDEN-Tabelle: vor
  // 400.000 ist der Rang der Engpass); die chancebegrenzte Vorphase und der
  // doppelte Skillpreis sind darin nicht enthalten.
  console.log("\nSpaetphase 100k -> 400k Rang (rangbegrenzt):");
  const gs = [];
  for (const k of V2) {
    const x = mess[k];
    if (!x || x.r100 == null || x.r400 == null) continue;
    const g = Math.log(4) / (x.r400 - x.r100);
    gs.push(g);
    console.log("  " + k + ": " + x.r100.toFixed(1) + " h -> " + x.r400.toFixed(1) + " h, g = " + g.toFixed(3) + " /h");
  }
  const gLo = Math.min(...gs), gHi = Math.max(...gs);
  for (const [lab, kRef, k] of [["BN14 gegen BN9", 0.9, 0.6], ["BN13 gegen BN9", 0.9, 0.45], ["BN14 gegen BN2/4", 1, 0.6], ["BN13 gegen BN2/4", 1, 0.45]]) {
    console.log("  Verschiebung " + lab + " (Rang " + k + " statt " + kRef + "): +" + (Math.log(kRef / k) / gHi).toFixed(1)
      + " .. +" + (Math.log(kRef / k) / gLo).toFixed(1) + " h");
  }
}
