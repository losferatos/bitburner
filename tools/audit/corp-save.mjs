// Audit 03.10.2026, Bereich CORP: Spielstaende lesen (nur lesen, nichts schreiben).
// Zweck: Geldbedarf und Geldquellen der V2-Laeufe messen - das ist die
// "beste Alternative", gegen die eine Corporation antreten muss.
// Aufruf: node tools/audit/corp-save.mjs <backup.json.gz> [weitere ...]
// Ausgabe je Spielstand: Knoten/Lauf, Spielzeit im Knoten, Geld,
// moneySourceA (seit letztem Einbau) und moneySourceB (seit Knotenbeginn),
// installierte Augs, Bladeburner-Rang, Corporation vorhanden ja/nein.
import fs from "node:fs";
import zlib from "node:zlib";

export function loadSave(path) {
  const raw = fs.readFileSync(path);
  const text = zlib.gunzipSync(raw).toString("utf8");
  const save = JSON.parse(text);
  const p = JSON.parse(save.data.PlayerSave).data;
  return { save, p };
}

// MoneySourceTracker ist ein Generic_toJSON-Objekt {ctor, data:{...}}
function src(obj) {
  if (!obj) return {};
  const d = obj.data || obj;
  const out = {};
  for (const [k, v] of Object.entries(d)) if (typeof v === "number" && v !== 0) out[k] = v;
  return out;
}

function fmt(x) {
  if (typeof x !== "number") return String(x);
  const a = Math.abs(x);
  if (a >= 1e12) return (x / 1e12).toFixed(3) + "e12";
  if (a >= 1e9) return (x / 1e9).toFixed(3) + "e9";
  if (a >= 1e6) return (x / 1e6).toFixed(3) + "e6";
  return x.toFixed(2);
}

export function summary(path) {
  const { save, p } = loadSave(path);
  const sf = {};
  for (const [n, l] of (p.sourceFiles && p.sourceFiles.data) || []) sf[n] = l;
  const bb = p.bladeburner && (p.bladeburner.data || p.bladeburner);
  const augs = (p.augmentations || []).map((a) => a.name || a);
  const q = (p.queuedAugmentations || []).map((a) => a.name || a);
  return {
    file: path.split(/[\\/]/).pop(),
    bitNodeN: p.bitNodeN,
    lauf: (sf[p.bitNodeN] || 0) + 1,
    hInNode: p.playtimeSinceLastBitnode / 3.6e6,
    hSinceAug: p.playtimeSinceLastAug / 3.6e6,
    money: p.money,
    augsInstalled: augs.length,
    augsQueued: q.length,
    bbRank: bb ? bb.rank : null,
    blackOps: bb ? bb.numBlackOpsComplete : null,
    hasCorp: !!p.corporation,
    msA: src(p.moneySourceA),
    msB: src(p.moneySourceB),
    saveKeys: Object.keys(save.data),
  };
}

function main() {
  for (const path of process.argv.slice(2)) {
    const s = summary(path);
    console.log("== " + s.file);
    console.log(
      `BN${s.bitNodeN}.${s.lauf}  h im Knoten ${s.hInNode.toFixed(2)}  h seit Einbau ${s.hSinceAug.toFixed(2)}  ` +
        `Geld ${fmt(s.money)}  Augs ${s.augsInstalled}+${s.augsQueued}  Rang ${s.bbRank && s.bbRank.toFixed(0)}  ` +
        `BlackOps ${s.blackOps}  Corporation ${s.hasCorp}`,
    );
    const line = (o) =>
      Object.entries(o)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .map(([k, v]) => `${k}=${fmt(v)}`)
        .join("  ");
    console.log("  seit Knotenbeginn (B): " + line(s.msB));
    console.log("  seit Einbau      (A): " + line(s.msA));
  }
}

if (process.argv[1] && process.argv[1].endsWith("corp-save.mjs")) main();
