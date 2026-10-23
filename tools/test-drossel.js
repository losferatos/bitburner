/**
 * Drosselbefund aus Motorrunden (23.10.2026).
 *
 * 22.10.2026 06:38: strategie-check meldete "GEDROSSELT 0,02 je Minute",
 * weil es gegen einen Verlaufspunkt vom 08.10. rechnete (Zaehler nach
 * Neustarts wieder bei 0). Direkt gemessen liefen 6 je Minute. Die alte
 * Regel (min >= 5, drunden >= 0, drunden/min < 1) ist hier als altUrteil
 * nachgebaut - gegen sie ist der Fall ROT.
 *
 * Aufruf: node tools/test-drossel.js
 */
import { fensterUrteil, probeUrteil, FENSTER_MAX_MS, PROBE_MS } from "./lib/drossel.js";

let gruen = 0, rot = 0;
const pruefe = (name, ok, info = "") => {
  if (ok) { gruen++; console.log("  ok    " + name + (info ? "  (" + info + ")" : "")); }
  else { rot++; console.log("  ROT   " + name + (info ? " - " + info : "")); }
};

// Die Regel bis 23.10., als Vergleich.
const altUrteil = (net, vorher) => {
  const min = (net.zeit - vorher.netZeit) / 60000;
  const d = net.runde - vorher.runde;
  return min >= 5 && d >= 0 && d / min < 1 ? "gedrosselt" : "ok";
};

console.log("\n=== Drosselbefund ===\n");

// Echte Werte aus data/verlauf-strategie.json.
const p0810 = { runde: 2759, netZeit: Date.parse("2026-10-08T04:01:03Z") };
const n2210 = { runde: 3232, zeit: Date.parse("2026-10-22T04:38:41Z") };
const p2210 = { runde: 3232, netZeit: n2210.zeit };
const n2210b = { runde: 3967, zeit: Date.parse("2026-10-22T06:41:22Z") };

pruefe("alte Regel meldet am 22.10. faelschlich Drosselung (Nachbau stimmt)",
  altUrteil(n2210, p0810) === "gedrosselt",
  ((n2210.runde - p0810.runde) / ((n2210.zeit - p0810.netZeit) / 60000)).toFixed(3) + " je min");
const f = fensterUrteil(n2210, p0810);
pruefe("14-Tage-Spanne ist kein Fenster", f.art === "keins", f.art);
const g = fensterUrteil(n2210b, p2210);
pruefe("06:38-08:41 ist ein Fenster mit voller Fahrt", g.art === "ok" && g.jeMin > 5, g.jeMin && g.jeMin.toFixed(2));
pruefe("Fenster knapp ueber 3 h zaehlt nicht",
  fensterUrteil({ runde: 2000, zeit: FENSTER_MAX_MS + 60e3 }, { runde: 0, netZeit: 0 }).art === "keins");
pruefe("gesunkener Zaehler im Fenster: keins",
  fensterUrteil({ runde: 10, zeit: 3600e3 }, { runde: 500, netZeit: 0 }).art === "keins");
pruefe("echtes Drosselbild im Fenster (0,93 je min, 25.08.): langsam",
  fensterUrteil({ runde: 56, zeit: 3600e3 }, { runde: 0, netZeit: 0 }).art === "langsam");
pruefe("Neustart im Fenster mit kleinem Zuwachs: langsam, also Probe noetig",
  fensterUrteil({ runde: 30, zeit: 7200e3 }, { runde: 20, netZeit: 0 }).art === "langsam");

// Probe ueber PROBE_MS.
const a = { runde: 4944, zeit: 0 };
pruefe("Probe 13:06 (6 je min): ok", probeUrteil(a, { runde: 4950, zeit: 60e3 }).art === "ok");
pruefe("Probe mit einer Runde in 60 s: gedrosselt",
  probeUrteil(a, { runde: 4945, zeit: 60e3 }).art === "gedrosselt");
pruefe("Probe ohne neue Datei: gedrosselt", probeUrteil(a, { runde: 4944, zeit: 0 }).art === "gedrosselt");
pruefe("Probe ueber Neustart: unklar", probeUrteil(a, { runde: 3, zeit: 60e3 }).art === "unklar");
pruefe("Probe unlesbar: unklar", probeUrteil(a, null).art === "unklar");
pruefe("Probe dauert mindestens eine Minute", PROBE_MS >= 60e3);

console.log("\n=== " + gruen + " gruen, " + rot + " rot ===\n");
process.exit(rot ? 1 : 0);
