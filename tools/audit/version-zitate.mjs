// VERSION-ZITATE (Audit 03.10.2026, Robustheit "Version 3.0.1 -> 3.0.2").
//
// Der Bot und die Audit-Berichte belegen Spielregeln mit Fundstellen "Datei.ts:Zeile". Die Fundstellen
// stammen aus reference/bitburner-src (dev, 3.0.2) ODER reference/v301. Das LAUFENDE Spiel ist 3.0.1
// (Spielstand: RunningScript.scriptKey vorhanden, SettingsSave ohne EnableSaveDataBackupReminder).
// Dieses Werkzeug fragt fuer jede Fundstelle: liegt sie in einem Bereich, den dev gegenueber v301
// GEAENDERT hat? Dann ist die Aussage dahinter fuer das laufende Spiel zu pruefen. Ausserdem
// "Zeilenversatz": die Zeilennummer zeigt in der anderen Fassung auf eine andere Stelle.
//
// Aufruf: node tools/audit/version-zitate.mjs [--bericht] [--json datei]
//   ohne --bericht: nur src/ (der laufende Bot); mit --bericht: zusaetzlich nodes/audit-*/ *.md
// Selbstprobe: eine bekannte geaenderte Stelle (Augmentations.ts, Synthetic Heart charisma) MUSS
// als geaendert erkannt werden, eine bekannt unveraenderte (Hacking.ts) NICHT.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..", "..");
const DEV = path.join(ROOT, "reference", "bitburner-src", "src");
const LIVE = path.join(ROOT, "reference", "v301", "src");
const argv = process.argv.slice(2);
const MIT_BERICHT = argv.includes("--bericht");

function walk(dir, rel = "", out = []) {
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? rel + "/" + e.name : e.name;
    if (e.isDirectory()) walk(dir, r, out);
    else out.push(r);
  }
  return out;
}

// Index: Basisname -> relative Pfade (nur Quelltexte)
const idx = new Map();
for (const side of [DEV, LIVE]) {
  for (const f of walk(side)) {
    if (!/\.(ts|tsx)$/.test(f)) continue;
    const b = path.basename(f);
    if (!idx.has(b)) idx.set(b, new Set());
    idx.get(b).add(f);
  }
}

// Hunks je Datei: Liste {liveStart, liveLen, devStart, devLen}
const hunkCache = new Map();
function hunks(rel) {
  if (hunkCache.has(rel)) return hunkCache.get(rel);
  const a = path.join(LIVE, rel);
  const b = path.join(DEV, rel);
  let res;
  if (!fs.existsSync(a) && !fs.existsSync(b)) res = { fehlt: "beide" };
  else if (!fs.existsSync(a)) res = { fehlt: "live" };
  else if (!fs.existsSync(b)) res = { fehlt: "dev" };
  else {
    const r = spawnSync("git", ["diff", "--no-index", "--no-color", "--unified=0", "--ignore-space-change", a, b], { encoding: "utf8", maxBuffer: 1 << 28 });
    const list = [];
    for (const l of (r.stdout || "").split("\n")) {
      const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(l);
      if (m) list.push({ ls: +m[1], ll: m[2] === undefined ? 1 : +m[2], ds: +m[3], dl: m[4] === undefined ? 1 : +m[4] });
    }
    res = { list };
  }
  hunkCache.set(rel, res);
  return res;
}

// Zeilenversatz: Summe (dl - ll) aller Hunks, die vor Zeile n der JEWEILIGEN Fassung liegen
function versatz(h, n, seite) {
  let s = 0;
  for (const k of h.list) {
    const start = seite === "dev" ? k.ds : k.ls;
    if (start < n) s += seite === "dev" ? k.dl - k.ll : k.ll - k.dl;
  }
  return s;
}
function trifft(h, n, m, seite) {
  for (const k of h.list) {
    const s = seite === "dev" ? k.ds : k.ls;
    const l = seite === "dev" ? k.dl : k.ll;
    const e = l === 0 ? s : s + l - 1; // reine Loeschung: Stelle zwischen s und s+1
    if (!(m < s || n > e + (l === 0 ? 1 : 0))) return true;
  }
  return false;
}

const RE = /((?:[A-Za-z0-9_]+\/)*[A-Za-z0-9_]+\.(?:ts|tsx)):(\d+)(?:-(\d+))?/g;

function aufloesen(name) {
  const base = path.basename(name);
  const alle = [...(idx.get(base) || [])];
  if (!alle.length) return [];
  if (name.includes("/")) {
    const t = alle.filter((f) => f === name || f.endsWith("/" + name));
    if (t.length) return t;
  }
  return alle;
}

function pruefeText(text, quelle) {
  const funde = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((zeile, i) => {
    RE.lastIndex = 0;
    let m;
    while ((m = RE.exec(zeile))) {
      const n = +m[2];
      const mm = m[3] ? +m[3] : n;
      const cands = aufloesen(m[1]);
      if (!cands.length) { funde.push({ quelle, zeile: i + 1, ziel: m[1], n, m: mm, status: "unbekannt" }); continue; }
      for (const c of cands) {
        const h = hunks(c);
        if (h.fehlt) { funde.push({ quelle, zeile: i + 1, ziel: c, n, m: mm, status: "nur-eine-fassung:" + h.fehlt + " fehlt", mehrdeutig: cands.length > 1 }); continue; }
        if (!h.list.length) { funde.push({ quelle, zeile: i + 1, ziel: c, n, m: mm, status: "gleich", mehrdeutig: cands.length > 1 }); continue; }
        const trDev = trifft(h, n, mm, "dev");
        const trLive = trifft(h, n, mm, "live");
        const vDev = versatz(h, n, "dev");
        const vLive = versatz(h, n, "live");
        let status = "unberuehrt";
        if (trDev || trLive) status = "GEAENDERT";
        else if (vDev !== 0 || vLive !== 0) status = "versetzt";
        funde.push({ quelle, zeile: i + 1, ziel: c, n, m: mm, status, versatzDev: vDev, versatzLive: vLive, mehrdeutig: cands.length > 1 });
      }
    }
  });
  return funde;
}

// ---------------------------------------------------------------- Selbstprobe
{
  const p1 = pruefeText("x Augmentation/Augmentations.ts:1763", "probe"); // charisma: 1.3 (live) / 1.15 (dev)
  const p2 = pruefeText("x Hacking.ts:20", "probe");
  const p3 = pruefeText("x Bladeburner/Skill.ts:84", "probe");   // gestrichene Zeilen im dev
  const ok1 = p1.some((f) => f.status === "GEAENDERT");
  const ok2 = p2.length > 0 && p2.every((f) => f.status === "gleich");
  const ok3 = p3.some((f) => f.status === "GEAENDERT");
  console.log("SELBSTPROBE geaenderte Stelle erkannt: " + (ok1 ? "OK" : "ROT") + " | unveraenderte Datei gleich: " + (ok2 ? "OK" : "ROT") + " | geloeschte Stelle erkannt: " + (ok3 ? "OK" : "ROT"));
  if (!(ok1 && ok2 && ok3)) { console.log(JSON.stringify([p1, p2, p3])); process.exit(2); }
}

// ---------------------------------------------------------------- Lauf
const alle = [];
const srcDateien = walk(path.join(ROOT, "src")).filter((f) => f.endsWith(".js"));
for (const f of srcDateien) {
  alle.push(...pruefeText(fs.readFileSync(path.join(ROOT, "src", f), "utf8"), "src/" + f));
}
if (MIT_BERICHT) {
  for (const d of ["nodes/audit-2026-10-03", "nodes/audit-2026-09-26"]) {
    const dir = path.join(ROOT, d);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".md")) continue;
      alle.push(...pruefeText(fs.readFileSync(path.join(dir, f), "utf8"), d + "/" + f));
    }
  }
}

const proStatus = {};
for (const f of alle) proStatus[f.status.split(":")[0]] = (proStatus[f.status.split(":")[0]] || 0) + 1;
console.log("Fundstellen gesamt: " + alle.length + " " + JSON.stringify(proStatus));

const geaendert = alle.filter((f) => f.status === "GEAENDERT");
const nachDatei = {};
for (const f of geaendert) {
  nachDatei[f.ziel] = nachDatei[f.ziel] || [];
  nachDatei[f.ziel].push(f);
}
console.log("\nGEAENDERTE Stellen nach Spieldatei:");
for (const [z, l] of Object.entries(nachDatei).sort((a, b) => b[1].length - a[1].length)) {
  console.log("  " + z + "  (" + l.length + ")");
  for (const f of l.slice(0, 40)) console.log("     " + f.quelle + ":" + f.zeile + "  -> :" + f.n + (f.m !== f.n ? "-" + f.m : "") + (f.mehrdeutig ? "  [mehrdeutig]" : ""));
}
const ja = argv.indexOf("--json");
if (ja >= 0) fs.writeFileSync(argv[ja + 1], JSON.stringify(alle, null, 1));

// ---------------------------------------------------------------- Herkunft der Zeilennummer
// Fuer Fundstellen in Dateien, die sich zwischen den Fassungen unterscheiden: aus welcher Fassung
// stammt die Zeilennummer? Methode: Bezeichner aus dem Kommentar rund um die Fundstelle (drei Zeilen)
// werden im Fenster n-2..m+2 beider Fassungen gesucht; wer mehr Treffer hat, ist die Herkunft.
// Gilt nur als Hinweis ("live"/"dev"/"beide"/"keine"), nicht als Beweis.
const STOP = new Set(["Datei", "wird", "nicht", "damit", "dieser", "diese", "dieses", "jeder", "jede", "einen", "einer",
  "wenn", "dann", "aber", "oder", "ohne", "nach", "gegen", "ueber", "unter", "zeile", "Spiel", "Quelle", "reference", "src", "bitburner"]);
const fileCache = new Map();
function zeilenVon(seite, rel) {
  const k = seite + ":" + rel;
  if (!fileCache.has(k)) {
    const p = path.join(seite === "dev" ? DEV : LIVE, rel);
    fileCache.set(k, fs.existsSync(p) ? fs.readFileSync(p, "utf8").split(/\r?\n/) : null);
  }
  return fileCache.get(k);
}
function herkunft(f, textZeilen) {
  const ctx = [textZeilen[f.zeile - 2], textZeilen[f.zeile - 1], textZeilen[f.zeile]].filter(Boolean).join(" ");
  const tokens = [...new Set((ctx.match(/[A-Za-z_][A-Za-z0-9_]{5,}/g) || []).filter((t) => !STOP.has(t) && !/^(NetscriptFunctions|Singularity|Bladeburner)$/.test(t) === true || true))]
    .filter((t) => !STOP.has(t));
  const L = zeilenVon("live", f.ziel), D = zeilenVon("dev", f.ziel);
  if (!L || !D) return "?";
  const fenster = (Z) => Z.slice(Math.max(0, f.n - 3), Math.min(Z.length, f.m + 2)).join("\n");
  const wl = fenster(L), wd = fenster(D);
  let sl = 0, sd = 0;
  for (const t of tokens) { if (wl.includes(t)) sl++; if (wd.includes(t)) sd++; }
  if (sl === 0 && sd === 0) return "keine";
  if (sl > sd) return "live";
  if (sd > sl) return "dev";
  return "beide";
}
{
  const cache = new Map();
  const textVon = (q) => {
    if (!cache.has(q)) cache.set(q, fs.readFileSync(path.join(ROOT, q), "utf8").split(/\r?\n/));
    return cache.get(q);
  };
  const tab = {};
  const devGeaendert = [];
  for (const f of alle) {
    if (f.status !== "GEAENDERT" && f.status !== "versetzt") continue;
    if (f.mehrdeutig) continue;
    const h = herkunft(f, textVon(f.quelle));
    const quellart = f.quelle.startsWith("src/") ? "src" : "bericht";
    const key = quellart + ":" + f.status + ":" + h;
    tab[key] = (tab[key] || 0) + 1;
    if (h === "dev" && f.status === "GEAENDERT") devGeaendert.push(f);
  }
  console.log("\nHERKUNFT der Zeilennummer (ohne mehrdeutige Ziele): " + JSON.stringify(tab, null, 0));
  console.log("Fundstellen mit Herkunft 'dev' in GEAENDERTEN Bereichen (gegen das laufende Spiel pruefen):");
  for (const f of devGeaendert) console.log("   " + f.quelle + ":" + f.zeile + " -> " + f.ziel + ":" + f.n + (f.m !== f.n ? "-" + f.m : ""));
}
