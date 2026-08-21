/**
 * Stagnationswaechter fuer den BitNode-4-Bot.
 *
 * Anders als bn4.js (Momentaufnahme, nichts wird gespeichert) haengt dieses
 * Skript bei jedem Aufruf einen Zeitstempel-Eintrag an data/watch-verlauf.json
 * an (LOKAL im Projektordner, keine Spieldatei) und vergleicht den neuen
 * Stand mit einem mindestens 10 Minuten alten Eintrag. So faellt ein Bot auf,
 * der zwar noch laeuft (Telemetrie frisch), aber nirgends mehr vorankommt -
 * das ist eine andere Falle als der komplette Stillstand, den tools/watch.js
 * per Endlosschleife erkennt. Hier reicht ein einzelner Aufruf, z.B. aus einer
 * geplanten Aufgabe alle paar Minuten.
 *
 * Aufruf:  node tools/bn4watch.js          (Textzeile)
 *          node tools/bn4watch.js --json   (maschinenlesbar)
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const BASE = "http://localhost:8795";
const PROJECT_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const HISTORY_FILE = path.join(PROJECT_ROOT, "data", "watch-verlauf.json");

const STALE_MS = 180_000;
const BASELINE_MIN_AGE_MS = 10 * 60_000;
const MAX_HISTORY_ENTRIES = 500;

async function rpc(method, params = {}) {
  const r = await fetch(BASE + "/api/rpc?" + new URLSearchParams({ method, ...params }));
  const b = await r.json();
  if (b.error) throw new Error(b.error);
  return b.result;
}

async function readJsonFile(filename, server = "home") {
  try {
    const raw = await rpc("getFile", { filename, server });
    return JSON.parse(raw);
  } catch {
    // Bruecke tot, Datei fehlt, oder kaputtes JSON - fuer diesen Waechter
    // alles derselbe Fall: kein verwertbares Lebenszeichen.
    return null;
  }
}

async function loadHistory() {
  try {
    const raw = await readFile(HISTORY_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Erster Lauf oder Datei beschaedigt - dann faengt der Verlauf neu an,
    // statt das Skript abstuerzen zu lassen.
    return [];
  }
}

async function saveHistory(history) {
  await mkdir(path.dirname(HISTORY_FILE), { recursive: true });
  await writeFile(HISTORY_FILE, JSON.stringify(history), "utf8");
}

function buildRecord(now, net, life, rep) {
  return {
    ts: now,
    net: net ? {
      zeit: net.zeit ?? null,
      hacking: net.hacking ?? null,
      geld: net.geld ?? null,
      gerootet: net.gerootet ?? null,
      vertraege: net.vertraege ?? 0,
      fehlstart: net.fehlstart ?? 0,
    } : null,
    life: life ? {
      zeit: life.zeit ?? null,
      geld: life.geld ?? null,
    } : null,
    rep: rep ? {
      zeit: rep.zeit ?? null,
      rep: (rep.repGesamt ?? rep.rep) ?? null,
      repReq: rep.repReq ?? null,
      ziel: rep.ziel ?? null,
      zielFaktion: rep.zielFaktion ?? null,
    } : null,
  };
}

// Sucht in der (chronologisch aufsteigenden) Historie den aeltesten Eintrag,
// der schon mindestens BASELINE_MIN_AGE_MS alt ist. Ein frisch begonnener
// Verlauf liefert dann bewusst keine Basis - lieber gar keine Rate als eine
// aus zwei Minuten Abstand hochgerechnete.
function findBaseline(historyBeforePush, now) {
  if (historyBeforePush.length === 0) return null;
  const oldest = historyBeforePush[0];
  if (now - oldest.ts >= BASELINE_MIN_AGE_MS) return oldest;
  return null;
}

function perMinute(current, base, minutesElapsed) {
  if (current == null || base == null || minutesElapsed <= 0) return null;
  return (current - base) / minutesElapsed;
}

function staleFiles(now, record) {
  const stale = [];
  const check = (label, entry) => {
    if (!entry || entry.zeit == null) { stale.push(label + " (kein Lebenszeichen)"); return; }
    if (now - entry.zeit > STALE_MS) stale.push(label + " (" + Math.round((now - entry.zeit) / 1000) + "s alt)");
  };
  check("bn4net.json", record.net);
  check("bn4life.json", record.life);
  check("bn4rep.json", record.rep);
  return stale;
}

function money(n) {
  if (!Number.isFinite(n)) return "?";
  const steps = [[1e12, "t"], [1e9, "b"], [1e6, "m"], [1e3, "k"]];
  for (const [div, suffix] of steps) {
    if (Math.abs(n) >= div) return "$" + (n / div).toFixed(2) + suffix;
  }
  return "$" + n.toFixed(0);
}

async function main() {
  const jsonMode = process.argv.includes("--json");
  const now = Date.now();

  const net = await readJsonFile("data/bn4net.json");
  const life = await readJsonFile("data/bn4life.json");
  const rep = await readJsonFile("data/bn4rep.json");

  const record = buildRecord(now, net, life, rep);

  let history = await loadHistory();

  // Nach einem Augmentierungs-Einbau faellt das Hacking-Level auf 1 zurueck.
  // Ein Verlauf, der ueber diesen Bruch hinweg vergleicht, liefert
  // zwanzig Minuten lang unbrauchbare Raten - und genau in dieser Zeit waere
  // ein echter Stillstand nicht zu erkennen. Faellt das Level um mehr als die
  // Haelfte, beginnt die Messung deshalb neu.
  const zuletzt = history.length ? history[history.length - 1] : null;
  const levelJetzt = record && record.net ? record.net.hacking : null;
  const levelVorher = zuletzt && zuletzt.net ? zuletzt.net.hacking : null;
  if (levelJetzt != null && levelVorher != null && levelJetzt < levelVorher / 2) {
    history = [];
  }

  const baseline = findBaseline(history, now);

  history.push(record);
  if (history.length > MAX_HISTORY_ENTRIES) history.splice(0, history.length - MAX_HISTORY_ENTRIES);
  await saveHistory(history);

  const warnings = [];

  const stale = staleFiles(now, record);
  if (stale.length > 0) warnings.push("Veraltete Meldung(en): " + stale.join(", "));

  if (net === null && life === null && rep === null) {
    warnings.push("Bruecke antwortet gar nicht - Port 8795 pruefen.");
  }

  let rates = { hacking: null, geld: null, rep: null, gerootet: null };
  let minutesElapsed = null;

  if (baseline) {
    minutesElapsed = (now - baseline.ts) / 60_000;

    const curHacking = record.net?.hacking ?? null;
    const baseHacking = baseline.net?.hacking ?? null;
    rates.hacking = perMinute(curHacking, baseHacking, minutesElapsed);

    const curGeld = record.life?.geld ?? record.net?.geld ?? null;
    const baseGeld = baseline.life?.geld ?? baseline.net?.geld ?? null;
    rates.geld = perMinute(curGeld, baseGeld, minutesElapsed);

    const curRep = record.rep?.rep ?? null;
    const baseRep = baseline.rep?.rep ?? null;
    rates.rep = perMinute(curRep, baseRep, minutesElapsed);

    const curGerootet = record.net?.gerootet ?? null;
    const baseGerootet = baseline.net?.gerootet ?? null;
    rates.gerootet = perMinute(curGerootet, baseGerootet, minutesElapsed);

    // Hacking-Level steigt im Spiel praktisch nie von selbst zurueck - bleibt
    // es ueber die Vergleichsspanne exakt gleich, lernt der Bot gerade nicht.
    if (curHacking != null && baseHacking != null && curHacking === baseHacking) {
      warnings.push("Hacking-Skill unveraendert seit " + Math.round(minutesElapsed) + " min (" + curHacking + ").");
    }

    // Rep-Stillstand ist nur ein Alarm, wenn ueberhaupt ein Ziel verfolgt
    // wird - ohne Ziel gibt es nichts zu erarbeiten, das ist dann normal.
    if (record.rep?.ziel && curRep != null && baseRep != null && curRep === baseRep) {
      warnings.push("Reputation fuer '" + record.rep.ziel + "' unveraendert seit " + Math.round(minutesElapsed) + " min (" + curRep + ").");
    }
  }

  if ((record.net?.fehlstart ?? 0) > 0) {
    warnings.push("Fehlstarts: " + record.net.fehlstart + " (Arbeiter ohne Speicher).");
  }
  if ((record.net?.vertraege ?? 0) > 2) {
    warnings.push("Vertraege liegen ungeloest: " + record.net.vertraege + ".");
  }

  if (jsonMode) {
    console.log(JSON.stringify({
      ts: now,
      warnings,
      ratesPerMinute: rates,
      minutesSinceBaseline: minutesElapsed,
      current: record,
      baselineTs: baseline ? baseline.ts : null,
      historyEntries: history.length,
    }, null, 2));
    return;
  }

  if (warnings.length > 0) {
    console.log(new Date(now).toLocaleTimeString() + "  STAGNATION/WARNUNG:");
    for (const w of warnings) console.log("  - " + w);
  } else if (baseline) {
    console.log(new Date(now).toLocaleTimeString()
      + "  ok  Hacking " + (rates.hacking?.toFixed(2) ?? "?") + "/min"
      + "  Geld " + money(rates.geld) + "/min"
      + "  Rep " + (rates.rep?.toFixed(2) ?? "?") + "/min"
      + "  Gerootet " + (rates.gerootet?.toFixed(3) ?? "?") + "/min");
  } else {
    console.log(new Date(now).toLocaleTimeString()
      + "  ok, aber noch keine 10 Minuten Verlauf fuer eine Rate ("
      + history.length + " Eintraege gespeichert).");
  }
}

main().catch((e) => {
  console.log("bn4watch abgestuerzt: " + e.message);
  process.exitCode = 1;
});
