/**
 * Stellt fest, welche Dateien unter src/ tot sind - mit Begruendung je Datei.
 *
 * WARUM DAS EIN EIGENES WERKZEUG IST UND KEINE HANDLISTE
 * Unter src/ liegen 114 Skripte. Auftrag 1.5 nennt einen Teil davon namentlich
 * als tot, aber der Verbotsgrep meldet 86 als "weder auf der Positivliste noch
 * in der Registry". Zwischen beiden Zahlen liegt die eigentliche Arbeit, und
 * eine von Hand gepflegte Liste waere beim naechsten Umbau sofort veraltet.
 *
 * Jede Datei bekommt hier ein Urteil aus BELEGEN, nicht aus Erinnerung:
 *   - steht sie im Auftrag unter 1.3 (bewaehrt) oder 1.4 (Zielliste)?
 *   - steht sie im Auftrag unter 1.5 (tot)?
 *   - ruft eine andere lebende Datei sie auf?
 *   - liegt sie im Spiel? (Leichen dort muessen per deleteFile weg)
 *   - wann wurde sie zuletzt geaendert?
 *
 * Das Verschieben selbst macht dieses Werkzeug NICHT. Es schreibt nur die
 * Liste. Ein Werkzeug, das 86 Dateien von selbst verschiebt, ist genau ein
 * Tippfehler von einem Schaden entfernt, und die Checkliste aus Auftrag 9
 * gehoert dazwischen.
 *
 * Aufruf: node tools/archivliste.js [--json]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const SRC = path.join(ROOT, "src");
const AUFTRAG = path.join(ROOT, "nodes", "AUFTRAG-BAU-2026-09.md");

/** Aus Auftrag 1.3 und 1.4 - bewaehrt oder auf der Zielliste. */
const LEBEND = new Set([
  "boot.js", "bn4net.js", "exit.js", "ausgang.js", "route.json",
  "blade.js", "bn4rep.js", "bn4life.js", "bn4door.js",
  "contracts.js", "cdump.js", "csolve.js", "popups.js", "darkweb.js",
  "graft.js", "hashes.js", "hacknet.js", "sleeve.js", "sleevecrime.js",
  "homegrow.js", "bbtrain.js", "wakelock.js", "sonde.js", "hacktimer.js",
  "worker/hack.js", "worker/grow.js", "worker/weaken.js", "worker/share.js",
  "worker/expfarm.js",
  "NetscriptDefinitions.d.ts",
]);

/** Aus Auftrag 1.5 - namentlich als tot gefuehrt. */
const TOT_LAUT_AUFTRAG = new Set([
  "autopilot.js", "buyaugs.js", "travel.js", "homeram.js", "hand.js",
  "install.js", "keepalive.js", "telemetry.js", "stocks.js", "stockaccess.js",
  "lib/calc.js", "lib/batch.js",
]);

function sammle(dir, prefix = "") {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? prefix + "/" + e.name : e.name;
    if (e.isDirectory()) {
      if (e.name === "archiv") continue;
      out.push(...sammle(path.join(dir, e.name), rel));
    } else out.push(rel);
  }
  return out;
}

const dateien = sammle(SRC);
const inhalte = new Map();
for (const f of dateien) {
  try {
    inhalte.set(f, fs.readFileSync(path.join(SRC, f), "utf8"));
  } catch {
    inhalte.set(f, "");
  }
}

const auftragText = fs.existsSync(AUFTRAG) ? fs.readFileSync(AUFTRAG, "utf8") : "";

/**
 * Wer ruft diese Datei auf? Gesucht wird der Dateiname in allen ANDEREN
 * Dateien - im Spiel startet ein Skript ein anderes nur ueber seinen Namen.
 * Auch tools/ und sync/ zaehlen: ein Werkzeug von aussen kann eine Datei
 * ueber data/task.txt starten.
 */
function aufrufer(datei) {
  const basis = path.basename(datei);
  const treffer = [];
  for (const [f, inhalt] of inhalte) {
    if (f === datei) continue;
    if (inhalt.includes(basis)) treffer.push("src/" + f);
  }
  for (const ordner of ["tools", "sync", "loops"]) {
    const d = path.join(ROOT, ordner);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      if (!/\.(js|md|cmd)$/.test(f)) continue;
      // Werkzeuge, die LISTEN von Dateinamen fuehren, sind keine Aufrufer.
      // Sonst haelt sich jede Datei ueber die Liste selbst am Leben, in der
      // steht, dass sie tot ist.
      if (["archivliste.js", "test-verbote.js", "test-alles.js"].includes(f)) continue;
      try {
        if (fs.readFileSync(path.join(d, f), "utf8").includes(basis)) {
          treffer.push(ordner + "/" + f);
        }
      } catch {
        // egal
      }
    }
  }
  return treffer;
}

const zeilen = [];
for (const f of dateien) {
  const basis = path.basename(f);
  const stat = fs.statSync(path.join(SRC, f));
  const ruft = aufrufer(f);
  // Aufrufer, die selbst tot sind, zaehlen nicht - sonst haelt sich eine
  // Gruppe toter Dateien gegenseitig am Leben.
  const lebendeRufer = ruft.filter((r) => {
    if (!r.startsWith("src/")) return true;
    const rel = r.slice(4);
    return LEBEND.has(rel) && !TOT_LAUT_AUFTRAG.has(rel);
  });

  let urteil;
  let grund;
  if (LEBEND.has(f)) {
    urteil = "BLEIBT";
    grund = "Auftrag 1.3 oder 1.4, namentlich";
  } else if (TOT_LAUT_AUFTRAG.has(f)) {
    urteil = "ARCHIV";
    grund = "Auftrag 1.5, namentlich als tot gefuehrt";
  } else if (lebendeRufer.length === 0) {
    urteil = "ARCHIV";
    grund = "kein lebender Aufrufer" +
      (ruft.length ? " (genannt nur von " + ruft.length + " toten/fremden Stellen)" : " (nirgends genannt)");
  } else {
    urteil = "PRUEFEN";
    grund = "wird genannt von: " + lebendeRufer.slice(0, 3).join(", ") +
      (lebendeRufer.length > 3 ? " und " + (lebendeRufer.length - 3) + " weiteren" : "");
  }

  // Steht die Datei irgendwo im Auftragstext? Dann ist sie mindestens bekannt.
  const imAuftrag = auftragText.includes(basis);

  zeilen.push({
    datei: f,
    urteil,
    grund,
    imAuftrag,
    aufrufer: ruft.length,
    lebendeAufrufer: lebendeRufer.length,
    bytes: stat.size,
    geaendert: stat.mtime.toISOString().slice(0, 10),
  });
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(zeilen, null, 1));
  process.exit(0);
}

const zaehl = (u) => zeilen.filter((z) => z.urteil === u).length;

console.log("");
console.log("=== Archivliste fuer src/ ===");
console.log("");
console.log("  " + dateien.length + " Dateien:  " + zaehl("BLEIBT") + " BLEIBT, " +
  zaehl("ARCHIV") + " ARCHIV, " + zaehl("PRUEFEN") + " PRUEFEN");
console.log("");

for (const u of ["PRUEFEN", "ARCHIV", "BLEIBT"]) {
  const gruppe = zeilen.filter((z) => z.urteil === u).sort((a, b) => a.datei.localeCompare(b.datei));
  if (!gruppe.length) continue;
  console.log("--- " + u + " (" + gruppe.length + ") ---");
  for (const z of gruppe) {
    console.log("  " + z.datei.padEnd(24) + z.geaendert + "  " +
      String(z.bytes).padStart(7) + " B  " + (z.imAuftrag ? "[im Auftrag] " : "") + z.grund);
  }
  console.log("");
}

console.log("HINWEIS: Dieses Werkzeug verschiebt nichts. Die Liste PRUEFEN braucht");
console.log("eine Einzelentscheidung, und das Verschieben selbst laeuft ueber die");
console.log("Checkliste aus Auftrag 9 - inklusive deleteFile fuer die Leichen, die");
console.log("im Spiel liegen bleiben (die Bruecke loescht dort nichts von selbst).");
console.log("");
