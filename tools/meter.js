/**
 * Messwerkzeug fuer den BitNode-4-Bot: Netto-Geldrate und RAM-Verteilung.
 *
 * WARUM NICHT tools/bn4watch.js
 *
 * Der Waechter misst die Geldrate als Differenz des KONTOSTANDS. Das ist fuer
 * Stagnationserkennung genug, fuer eine Hebelmessung aber unbrauchbar: Der
 * Kontostand steigt auch durch Verbrechen (bn4life.js) und durch geloeste
 * Vertraege, und er faellt durch Rechnerkaeufe, home-Ausbau und
 * Augmentierungen. Ein Umbau am Hacking-Netz waere darin nicht zu sehen.
 *
 * Hier wird stattdessen `Player.scriptProdSinceLastAug` gelesen - der
 * Zaehler, den NetscriptHelpers.tsx:655 bei JEDEM erfolgreichen hack um den
 * erbeuteten Betrag erhoeht, und sonst niemand ausser dem Aktienhandel
 * (BuyingAndSelling.tsx:176,365 - laeuft hier nicht). Ausgaben ruehren ihn
 * nicht an, Verbrechen auch nicht. Die Differenz zweier Messungen ist damit
 * genau das, was die Arbeiter verdient haben.
 *
 * Und die Zeitbasis ist `Player.playtimeSinceLastAug`, nicht die Wanduhr.
 * Das ist wichtig, weil ein verborgener Browsertab gedrosselt wird
 * (siehe doku/schlupfloecher.md): Waehrend die Wanduhr weiterlaeuft, steht
 * die Spielzeit fast still. Eine Rate je Wandsekunde wuerde in so einem
 * Fenster einen Einbruch zeigen, den es gar nicht gibt.
 *
 * Die RAM-Verteilung kommt aus demselben Spielstand: jeder laufende Prozess
 * kennt seinen ramUsage und seine Fadenzahl. Ueber viele Proben gemittelt
 * ergibt das den RAM-Sekunden-Anteil je Aktion und je Ziel - die Zahl, an der
 * sich ein Verteilungsumbau messen laesst.
 *
 * Aufruf:
 *   node tools/meter.js start <name>    Grundlinie beginnen (Datei anlegen)
 *   node tools/meter.js run <name> <min> [--every <s>]   messen, dann Bericht
 *   node tools/meter.js report <name>   Bericht aus vorhandenen Proben
 */

import zlib from "node:zlib";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const BASE = "http://localhost:8795";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, "data", "meter");

async function fetchSave() {
  const res = await fetch(BASE + "/api/rpc?method=getSaveFile");
  const body = await res.json();
  if (body.error) throw new Error(body.error);
  return JSON.parse(zlib.gunzipSync(Buffer.from(body.result.save, "latin1")).toString("utf8"));
}

/** Eine Probe: alles, was der Bericht spaeter braucht, schon verdichtet. */
function sample(save) {
  const p = JSON.parse(save.data.PlayerSave).data;
  const servers = JSON.parse(save.data.AllServersSave);

  const byScript = {};
  const byTarget = {};
  let ramTotal = 0, ramWorker = 0, ramTool = 0, ramFree = 0;
  // Summe der Offline-Gutschriften aller gerade laufenden Skripte. Das ist der
  // Zeuge fuer Falle 1 (siehe Kopfkommentar): ScriptHelpers.ts:67 erhoeht
  // scriptProdSinceLastAug beim Laden der Engine um einen Klumpen und schreibt
  // denselben Betrag zusaetzlich in runningScript.offlineMoneyMade. Solange
  // irgendein Skript mit offlineMoneyMade > 0 laeuft, hat es in diesem Lauf
  // einen Seitenneuladevorgang gegeben.
  let offlineMoney = 0;
  const hostFree = {};

  for (const [name, wrapper] of Object.entries(servers)) {
    const d = wrapper.data;
    if (!d.hasAdminRights) continue;
    const max = d.maxRam || 0;
    ramTotal += max;
    let used = 0;
    for (const entry of d.runningScripts || []) {
      const r = entry.data;
      const ram = r.ramUsage * r.threads;
      used += ram;
      offlineMoney += r.offlineMoneyMade || 0;
      if (r.filename.startsWith("worker/")) {
        ramWorker += ram;
        byScript[r.filename] = (byScript[r.filename] || 0) + ram;
        // args[0] ist bei allen Arbeitern das Ziel; worker/share.js hat keins.
        const target = r.filename === "worker/share.js" ? "(share)" : String(r.args[0] ?? "?");
        byTarget[target] = (byTarget[target] || 0) + ram;
      } else {
        ramTool += ram;
      }
    }
    const free = max - used;
    ramFree += free;
    if (free >= 4) hostFree[name] = Math.round(free);
  }

  return {
    wall: Date.now(),
    playtime: p.playtimeSinceLastAug,
    scriptProd: p.scriptProdSinceLastAug,
    money: p.money,
    hackExp: p.exp ? p.exp.hacking : null,
    hackLevel: p.skills ? p.skills.hacking : null,
    // Zeuge fuer Falle 2: PlayerObjectGeneralMethods.ts:127 setzt
    // scriptProdSinceLastAug beim Einbau auf 0 - und lastAugReset auf die
    // aktuelle Zeit. Der Zaehlerstand allein wuerde das nur als Ruecksprung
    // zeigen; lastAugReset benennt die Ursache eindeutig.
    lastAugReset: p.lastAugReset ?? null,
    augCount: Array.isArray(p.augmentations) ? p.augmentations.length : null,
    offlineMoney: +offlineMoney.toFixed(1),
    ramTotal, ramWorker: +ramWorker.toFixed(1), ramTool: +ramTool.toFixed(1),
    ramFree: +ramFree.toFixed(1),
    byScript, byTarget, hostFree,
  };
}

const file = (name) => path.join(DIR, name + ".json");

async function load(name) {
  try { return JSON.parse(await readFile(file(name), "utf8")); }
  catch { return []; }
}
async function save(name, rows) {
  await mkdir(DIR, { recursive: true });
  await writeFile(file(name), JSON.stringify(rows), "utf8");
}

function fmtMoney(n) {
  if (!Number.isFinite(n)) return "?";
  for (const [div, suf] of [[1e12, "t"], [1e9, "b"], [1e6, "m"], [1e3, "k"]]) {
    if (Math.abs(n) >= div) return "$" + (n / div).toFixed(2) + suf;
  }
  return "$" + n.toFixed(1);
}

function report(name, rows) {
  if (rows.length < 2) {
    console.log("Zu wenige Proben (" + rows.length + ") fuer einen Bericht.");
    return;
  }
  const a = rows[0], b = rows[rows.length - 1];

  // --- Zaehlerfallen erkennen (22.08.2026) ---------------------------------
  // Zwei Stellen im Spiel schreiben scriptProdSinceLastAug, ohne dass ein
  // Arbeiter etwas verdient haette. Bisher lief die Messung nur deshalb
  // sauber, weil beide zufaellig nicht eintraten:
  //
  //   Falle 1  ScriptHelpers.ts:67. Beim Laden der Engine wird die
  //            Offline-Produktion als KLUMPEN in den Zaehler gebucht -
  //            errechnet aus dem LEBENSDURCHSCHNITT des Skripts
  //            (onlineMoneyMade/playtimeSinceLastAug * offlineZeit * 0.75).
  //            Heimtueckisch daran: engine.tsx:350 erhoeht im selben Zug
  //            playtimeSinceLastAug um dieselbe Offline-Zeit. Die RATE bleibt
  //            damit plausibel - sie ist nur nicht mehr die des Messfensters,
  //            sondern der mit 0,75 gewichtete Lebensdurchschnitt. Ein
  //            Ausreisserfilter auf die Rate wuerde das NICHT finden.
  //            Zeuge ist deshalb offlineMoneyMade der laufenden Skripte.
  //
  //   Falle 2  PlayerObjectGeneralMethods.ts:127. Der Augmentierungs-Einbau
  //            setzt den Zaehler auf 0. Zeuge ist lastAugReset.
  //
  // Betroffene Abschnitte werden herausgeschnitten statt den ganzen Lauf zu
  // verwerfen: Bei zwanzig Proben ist eine kaputte Luecke kein Grund, die
  // uebrigen neunzehn wegzuwerfen.
  const warnungen = [];
  let prod = 0, seconds = 0, verworfen = 0;
  for (let i = 1; i < rows.length; i++) {
    const x = rows[i - 1], y = rows[i];
    const dt = (y.playtime - x.playtime) / 1000;
    const dp = y.scriptProd - x.scriptProd;
    let grund = null;
    if (y.lastAugReset !== x.lastAugReset || y.augCount !== x.augCount) {
      grund = "Augmentierungs-Einbau (Zaehler auf 0)";
    } else if (dp < 0 || dt < 0) {
      grund = "Zaehler ruecklaeufig";
    } else if (y.offlineMoney > x.offlineMoney) {
      grund = "Offline-Klumpen gebucht (+" + fmtMoney(y.offlineMoney - x.offlineMoney)
        + ", Tab neu geladen)";
    } else if (!(dt > 0)) {
      grund = "Spielzeit steht (Tab gedrosselt oder pausiert)";
    }
    if (grund) {
      warnungen.push("Probe " + i + "->" + (i + 1) + " verworfen: " + grund);
      verworfen++;
      continue;
    }
    prod += dp;
    seconds += dt;
  }
  let basis = "Spielzeit";
  if (!(seconds > 0)) {
    // Notnagel wie bisher, aber ausdruecklich gekennzeichnet.
    seconds = (b.wall - a.wall) / 1000;
    prod = b.scriptProd - a.scriptProd;
    basis = "Wanduhr (!)";
  }
  // Ein Neuladen faelscht auch alles VOR dem Fenster: Die Offline-Gutschrift
  // haengt am Lebensdurchschnitt, nicht am Fenster. Steht beim Start schon
  // ein Klumpen in den laufenden Skripten, ist zwar keine Probe kaputt, aber
  // der Lauf hat einen Neuladevorgang gesehen - das gehoert gesagt.
  if (a.offlineMoney > 0) {
    warnungen.push("Zum Messbeginn standen bereits " + fmtMoney(a.offlineMoney)
      + " Offline-Gutschrift in laufenden Skripten - der Lauf hat ein Neuladen gesehen.");
  }

  const exp = (b.hackExp != null && a.hackExp != null) ? b.hackExp - a.hackExp : null;

  // RAM-Verteilung ueber alle Proben mitteln. Jede Probe steht fuer denselben
  // Zeitabschnitt (fester Abstand), der ungewichtete Mittelwert ist also der
  // RAM-Sekunden-Anteil.
  const sum = (key) => {
    const acc = {};
    for (const r of rows) for (const [k, v] of Object.entries(r[key])) acc[k] = (acc[k] || 0) + v;
    for (const k of Object.keys(acc)) acc[k] /= rows.length;
    return acc;
  };
  const avgScript = sum("byScript");
  const avgTarget = sum("byTarget");
  const avg = (key) => rows.reduce((s, r) => s + r[key], 0) / rows.length;
  const ramTotal = avg("ramTotal"), ramWorker = avg("ramWorker");
  const ramFree = avg("ramFree"), ramTool = avg("ramTool");

  const pct = (v, ganz) => (100 * v / ganz).toFixed(1).padStart(5) + " %";

  console.log("");
  console.log("  MESSUNG  " + name + "   " + rows.length + " Proben, "
    + (seconds / 60).toFixed(1) + " min " + basis);
  console.log("  " + "-".repeat(66));
  if (warnungen.length) {
    for (const w of warnungen) console.log("  ACHTUNG  " + w);
    console.log("  " + "-".repeat(66));
  }
  console.log("  Skriptertrag         " + fmtMoney(prod / seconds).padStart(12) + "/s   (gesamt " + fmtMoney(prod) + ")");
  if (verworfen) console.log("  (" + verworfen + " von " + (rows.length - 1) + " Abschnitten herausgeschnitten)");
  if (exp != null) console.log("  Hacking-Erfahrung    " + (exp / seconds).toFixed(2).padStart(12) + "/s");
  // Das Hacking-Level gehoert in JEDEN Bericht. Der Ertrag haengt ueber
  // skillMult in calculatePercentMoneyHacked und ueber (level+50) in der
  // Aktionsdauer daran - wer zwei Fenster mit unterschiedlichem Level
  // vergleicht, schreibt dem Umbau einen Teil des Levelgewinns gut. Bei
  // Fenstern von zehn bis fuenfzehn Minuten sind das Bruchteile eines
  // Prozents; bei Vergleichen ueber Stunden nicht mehr.
  if (a.hackLevel != null) {
    console.log("  Hacking-Level        " + String(a.hackLevel + " -> " + b.hackLevel).padStart(12)
      + "   (" + (b.hackLevel - a.hackLevel >= 0 ? "+" : "") + (b.hackLevel - a.hackLevel) + ")");
  }
  console.log("  Netz-RAM             " + ramTotal.toFixed(0).padStart(12) + " GB");
  console.log("    davon Arbeiter     " + ramWorker.toFixed(0).padStart(12) + " GB  " + pct(ramWorker, ramTotal));
  console.log("    davon Werkzeuge    " + ramTool.toFixed(0).padStart(12) + " GB  " + pct(ramTool, ramTotal));
  console.log("    davon FREI         " + ramFree.toFixed(0).padStart(12) + " GB  " + pct(ramFree, ramTotal));
  // Ertrag je belegtem GB - die eigentliche Guetezahl. Ein Hebel, der nur
  // mehr Speicher belegt, muss diese Zahl nicht verbessern; ein Hebel, der
  // besser verteilt, muss es.
  console.log("  Ertrag je Arbeiter-GB" + (prod / seconds / Math.max(1, ramWorker)).toFixed(1).padStart(12) + " $/GB*s");
  console.log("");
  console.log("  Arbeiter-RAM je Aktion:");
  for (const [k, v] of Object.entries(avgScript).sort((x, y) => y[1] - x[1])) {
    console.log("    " + k.padEnd(20) + v.toFixed(0).padStart(7) + " GB  " + pct(v, ramWorker));
  }
  console.log("  Arbeiter-RAM je Ziel:");
  for (const [k, v] of Object.entries(avgTarget).sort((x, y) => y[1] - x[1])) {
    console.log("    " + k.padEnd(20) + v.toFixed(0).padStart(7) + " GB  " + pct(v, ramWorker));
  }
  console.log("");
}

async function main() {
  const [cmd, name, minutesArg] = process.argv.slice(2);
  if (!cmd || !name) {
    console.log("Aufruf: node tools/meter.js run <name> <minuten> [--every <sekunden>]");
    process.exit(1);
  }
  if (cmd === "report") { report(name, await load(name)); return; }

  const everyIdx = process.argv.indexOf("--every");
  const everyMs = (everyIdx > 0 ? Number(process.argv[everyIdx + 1]) : 20) * 1000;

  let rows = cmd === "start" ? [] : await load(name);
  const minutes = Number(minutesArg) || 0;
  const until = Date.now() + minutes * 60_000;

  // Erste Probe sofort, damit die Grundlinie steht, falls der Lauf abbricht.
  let fehler = 0;
  do {
    try {
      rows.push(sample(await fetchSave()));
      await save(name, rows);
      fehler = 0;
    } catch (e) {
      // Nicht abbrechen. Ein einzelner Aussetzer der Bruecke darf eine
      // Zehn-Minuten-Messung nicht vernichten - erst mehrere in Folge.
      if (++fehler >= 10) { console.log("Bruecke antwortet 10x nicht - Abbruch."); break; }
    }
    if (Date.now() >= until) break;
    await new Promise((r) => setTimeout(r, Math.min(everyMs, Math.max(0, until - Date.now()) + 1)));
  } while (Date.now() < until + everyMs);

  report(name, rows);
}

main().catch((e) => { console.log("meter abgestuerzt: " + e.message); process.exitCode = 1; });
