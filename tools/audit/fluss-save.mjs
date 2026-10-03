// Datenfluss-Eichung (Audit 03.10.2026): liest aus einem Spielstand die TEXTDATEIEN von home
// (data/*.json, data/*.txt) und gibt Name, Groesse, Alter (falls im Inhalt) und bei JSON die
// Schluessel aus. Damit wird die statische Tabelle aus datenfluss.mjs gegen den echten Zustand
// geeicht: existiert die Datei im Spiel wirklich, und stimmen die geschriebenen Felder?
//
// Aufruf: node tools/audit/fluss-save.mjs [<datei.json.gz>] [--liste] [--zeige <name>] [--json]
import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..", "..");

export function neuesterStand() {
  // Jueengster Eintrag aus backups/INDEX.tsv (Spalte 2 = Dateiname). Namenssortierung taugt nicht:
  // "save-..." sortiert hinter "LIVE_...".
  const dir = path.join(ROOT, "backups");
  const zeilen = fs.readFileSync(path.join(dir, "INDEX.tsv"), "utf8").trim().split(/\r?\n/);
  for (let i = zeilen.length - 1; i >= 0; i--) {
    const f = zeilen[i].split(/\t/)[1];
    if (f && fs.existsSync(path.join(dir, f))) return path.join(dir, f);
  }
  throw new Error("kein Spielstand in backups/INDEX.tsv gefunden");
}

const unwrap = (o) => (o && o.data !== undefined && o.ctor ? o.data : o);

/** Liefert Map name -> Inhalt der Textdateien von home. */
export function homeTextdateien(datei) {
  const text = zlib.gunzipSync(fs.readFileSync(datei)).toString("utf8");
  const save = JSON.parse(text);
  const servers = JSON.parse(save.data.AllServersSave);
  const home = unwrap(servers.home);
  const tf = home.textFiles;
  const out = new Map();
  if (!tf) return out;
  // textFiles ist eine JSONMap {ctor:"JSONMap", data:[[name, TextFile], ...]} oder ein Objekt
  const eintraege = tf.ctor === "JSONMap" ? tf.data : Object.entries(tf);
  for (const [name, f] of eintraege) {
    const t = unwrap(f);
    out.set(name, typeof t === "string" ? t : (t && (t.text ?? t.content ?? t.data)) ?? "");
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const datei = args[0] && args[0].endsWith(".gz") ? args[0] : neuesterStand();
  const tf = homeTextdateien(datei);
  console.log("Spielstand:", path.basename(datei), "- Textdateien auf home:", tf.size);
  const zeige = process.argv.indexOf("--zeige");
  if (zeige >= 0) {
    const n = process.argv[zeige + 1];
    const t = tf.get(n);
    console.log(t === undefined ? "(nicht im Spiel)" : t.slice(0, 4000));
  } else {
    for (const [n, t] of [...tf.entries()].sort()) {
      let schl = "";
      try { const j = JSON.parse(t); if (j && typeof j === "object" && !Array.isArray(j)) schl = Object.keys(j).join(","); else if (Array.isArray(j)) schl = "[" + j.length + " Eintraege]"; } catch { /* kein JSON */ }
      console.log(n.padEnd(40), String(t.length).padStart(8), schl.slice(0, 160));
    }
  }
}
