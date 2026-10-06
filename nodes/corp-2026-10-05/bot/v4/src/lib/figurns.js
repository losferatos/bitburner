/**
 * Die Figur beantragen und nachsehen, ob man darf - die Seite mit `ns`.
 *
 * ===========================================================================
 * WARUM ES ZWEI MODULE SIND
 * ===========================================================================
 *
 * `lib/figur.js` ist absichtlich frei von `ns`: dort steht die Entscheidung,
 * und die laesst sich vollstaendig ohne Spiel pruefen (47 Proben in
 * `tools/test-figur.js`). Hier steht nur das Lesen und Schreiben - der Teil,
 * den man ohne Spiel nicht prueft, weil es an ihm nichts zu entscheiden gibt.
 *
 * ===========================================================================
 * WAS EIN GEWERK TUN MUSS
 * ===========================================================================
 *
 *   import { beantrage, darf } from "lib/figurns.js";
 *   import { PRIO } from "lib/figur.js";
 *
 *   beantrage(ns, "blade.js", PRIO.bladeburner, "bladeburner",
 *             "Operation Undercover", "Rangaufbau");
 *   const w = darf(ns, "blade.js");
 *   if (!w.darf) { sag("Figur nicht frei: " + w.grund); await ns.sleep(TAKT); continue; }
 *
 * Zwei Aufrufe, in JEDER Runde. Der Antrag laeuft nach einer Minute ab; wer
 * ihn nicht erneuert, gibt die Figur frei, sobald seine Lease endet.
 *
 * ===========================================================================
 * KEIN getResetInfo
 * ===========================================================================
 *
 * Der Knotenstempel wird gebraucht - ein Antrag aus dem alten Knoten darf
 * nach dem Sprung nicht mehr gelten. `ns.getResetInfo` kostet aber 1 GB, und
 * das je Gewerk. Stattdessen wird der Wert aus `data/bn4net.json` gelesen, wo
 * der Kern ihn ohnehin schreibt: 0 GB.
 *
 * Fehlt die Datei, gilt 0. Das ist die sichere Seite: ein Antrag mit
 * nodeReset 0 gegen eine Vergabe mit echtem Stempel faellt durch, das Gewerk
 * handelt also NICHT. Untaetigkeit ist hier der richtige Irrtum - ein
 * abgebrochener Graft kostet bis zu 14,63 Mrd.
 */

import { antrag, antragsDatei, darfFigur } from "lib/figur.js";
import { liesVonHome } from "lib/hostdatei.js";

/**
 * Die Kerndatei lesen - von JEDEM Wirt aus.
 *
 * VORFALL 06.09.2026, 05:50 bis 10:40: Die beiden Leser darunter prueften die
 * Datei auf home und lasen sie dann LOKAL (`ns.read` hat keinen
 * Host-Parameter). Auf home ist das dasselbe; auf der Werkbank gibt es die
 * Datei nicht, also kamen nodeReset 0 und motorTimeMs 0 zurueck. Solange
 * blade.js auf home lief, fiel das nie auf. Um 05:50 beendete der Waechter
 * blade.js (Sprosse 4.5), der Kern startete es auf der Werkbank neu - und ab
 * da trug jeder Antrag den Stempel 0, den `antragGilt` gegen den echten
 * Knotenstempel verwirft. 575 verworfene Antraege in 4,5 h, die Figur ohne
 * Besitzer auf "Recruitment", die letzten zwei Black Ops standen still, und
 * blade.json zeigte trotzdem "Operation Vindictus", weil es die gewuenschte
 * Aktion meldet. Genau die Fehlerklasse, die lib/hostdatei.js am 04.09. fuer
 * neun andere Gewerke abgeraeumt hat - dieses Modul fehlte in der Liste.
 *
 * @param {NS} ns
 * @returns {object|null}
 */
function kerndatei(ns) {
  try {
    const roh = liesVonHome(ns, "data/bn4net.json");
    return roh ? JSON.parse(roh) : null;
  } catch { return null; }
}

/**
 * Der Knotenstempel, wie ihn der Kern schreibt.
 *
 * @param {NS} ns
 * @returns {number} lastNodeReset, oder 0 wenn unbekannt
 */
export function knotenStempel(ns) {
  const d = kerndatei(ns);
  return d && Number.isFinite(d.nodeReset) ? d.nodeReset : 0;
}

/**
 * Die Motorzeit des Kerns - die Uhr, in der die Antraege datiert sind.
 *
 * @param {NS} ns
 */
export function motorzeit(ns) {
  const d = kerndatei(ns);
  return d && Number.isFinite(d.motorTimeMs) ? d.motorTimeMs : 0;
}

/**
 * Einen Antrag stellen. In jeder Runde neu - er laeuft nach einer Minute ab.
 *
 * @param {NS} ns
 * @param {string} werkzeug   der eigene Dateiname, z. B. "blade.js"
 * @param {number} prio       aus PRIO in lib/figur.js, kleiner gewinnt
 * @param {string} action     "bladeburner" | "graft" | "faktion" | "gym" | ...
 * @param {string|null} detail
 * @param {string} grund      geht in den Bericht, wenn die Vergabe wechselt
 */
export function beantrage(ns, werkzeug, prio, action, detail, grund) {
  const a = antrag(werkzeug, prio, action, detail, grund, {
    wall: Date.now(),
    motorTimeMs: motorzeit(ns),
    nodeReset: knotenStempel(ns),
  });
  const datei = antragsDatei(werkzeug);
  try {
    ns.write(datei, JSON.stringify(a), "w");
    // Der Vergabepunkt sitzt im Kern auf home. Ein Antrag, der auf der
    // Werkbank liegen bleibt, wird nie gelesen - und das Gewerk wartet
    // stumm auf eine Antwort, die niemand geben kann.
    if (ns.getHostname() !== "home") ns.scp(datei, "home", ns.getHostname());
  } catch { /* dann gibt es diese Runde keinen Antrag */ }
  return a;
}

/**
 * Darf dieses Gewerk gerade handeln?
 *
 * `letzteSeq` gehoert dem Aufrufer: er merkt sich die zuletzt gesehene
 * Folgenummer ueber die Runden. Ohne sie faellt die Veraltungspruefung aus -
 * das Rennen zwischen Werkbank und home ist real, und wer auf einer alten
 * figure.txt handelt, handelt auf einem Stand, den es nicht mehr gibt.
 *
 * @param {NS} ns
 * @param {string} werkzeug
 * @param {number|null} letzteSeq
 * @returns {{darf: boolean, grund: string, veraltet: boolean, seq: number|null}}
 */
export function darf(ns, werkzeug, letzteSeq = null) {
  let v = null;
  try {
    if (ns.fileExists("data/figure.txt", "home")) {
      // Auf der Werkbank muss die Datei erst herbeigeholt werden - `ns.read`
      // hat KEINEN Host-Parameter (NetscriptFunctions.ts:1120-1122) und liest
      // immer lokal. Ohne das scp bekaeme ein Gewerk auf der Werkbank still
      // einen leeren String und damit "keine Vergabe".
      if (ns.getHostname() !== "home") ns.scp("data/figure.txt", ns.getHostname(), "home");
      v = JSON.parse(ns.read("data/figure.txt"));
    }
  } catch { v = null; }

  const u = darfFigur(v, werkzeug, Date.now(), knotenStempel(ns), letzteSeq);
  return { ...u, seq: v && Number.isFinite(v.seq) ? v.seq : null };
}
