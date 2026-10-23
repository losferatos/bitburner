/**
 * Ist der Tab gedrosselt? Entscheidung aus Motorrunden (23.10.2026).
 *
 * Anlass: Am 22.10.2026 um 06:38 meldete strategie-check "GEDROSSELT: 0,02
 * Motorrunden je Minute". Verglichen wurde gegen einen Verlaufspunkt vom
 * 08.10. - vierzehn Tage, mehrere Spruenge und Einbaurunden dazwischen, und
 * bei jedem Neustart von bn4net beginnt der Rundenzaehler wieder bei 0. Der
 * Bruch mass also die Neustarts, nicht das Tempo. Direkt nachgemessen lief
 * der Motor zur selben Zeit mit 6 Runden je Minute bei verdecktem Tab
 * (06:38-08:41: 735 Runden in 123 min). Aus dem Fehlalarm wurde die
 * Empfehlung "Tab in den Vordergrund" - die war falsch, der Tonanker
 * wakelock.js haelt den verdeckten Tab laengst wach.
 *
 * Deshalb zwei Stufen:
 *  1. Fenster gegen den letzten Verlaufspunkt nur, wenn er hoechstens
 *     FENSTER_MAX_MS alt ist. Laengere Spannen enthalten fast immer einen
 *     Neustart.
 *  2. Faellt das Fenster unter die Schwelle oder gibt es keins, entscheidet
 *     eine direkte Probe: bn4net.json zweimal im Abstand von PROBE_MS lesen.
 *     Auch die kann einen Neustart treffen (Zaehler sinkt) - dann wird
 *     nicht geurteilt statt falsch.
 */

export const FENSTER_MAX_MS = 3 * 3600e3;
export const FENSTER_MIN_MS = 5 * 60e3;
export const PROBE_MS = 65e3;
// Normal sind 4-6 Runden je Minute; gedrosselt (1 Wake je Minute) hoechstens
// eine, gemessen 0,93 (25.08.). Die Schwelle 2 liegt in der Luecke - bei 1
// haette eine gedrosselte Probe mit genau einer Runde als "ok" gegolten.
export const SCHWELLE_JE_MIN = 2;

/**
 * Stufe 1: Fenster gegen einen frueheren Punkt.
 * @returns {{art:"ok"|"langsam"|"keins", jeMin?:number}}
 */
export function fensterUrteil(jetzt, vorher) {
  if (!jetzt || !vorher) return { art: "keins" };
  if (!Number.isFinite(jetzt.runde) || !Number.isFinite(vorher.runde)) return { art: "keins" };
  if (!Number.isFinite(jetzt.zeit) || !Number.isFinite(vorher.netZeit)) return { art: "keins" };
  const spanne = jetzt.zeit - vorher.netZeit;
  if (!(spanne >= FENSTER_MIN_MS) || spanne > FENSTER_MAX_MS) return { art: "keins" };
  const d = jetzt.runde - vorher.runde;
  // Gesunkener Zaehler: Neustart im Fenster, nichts messbar.
  if (d < 0) return { art: "keins" };
  const jeMin = d / (spanne / 60e3);
  return { art: jeMin < SCHWELLE_JE_MIN ? "langsam" : "ok", jeMin };
}

/**
 * Stufe 2: zwei Lesungen derselben Datei (a frueher, b spaeter).
 * @returns {{art:"ok"|"gedrosselt"|"unklar", jeMin?:number, grund?:string}}
 */
export function probeUrteil(a, b) {
  if (!a || !b || !Number.isFinite(a.runde) || !Number.isFinite(b.runde)
    || !Number.isFinite(a.zeit) || !Number.isFinite(b.zeit)) {
    return { art: "unklar", grund: "Probe unlesbar" };
  }
  if (b.runde < a.runde) return { art: "unklar", grund: "bn4net neu gestartet" };
  const spanne = b.zeit - a.zeit;
  // Hat bn4net in der ganzen Probe nicht geschrieben, ist das selbst das
  // Drosselbild (gedrosselt schreibt es hoechstens einmal je Minute) - aber
  // nur, wenn wirklich eine Minute Wanduhr vergangen ist; das prueft der
  // Aufrufer ueber PROBE_MS.
  if (spanne <= 0) return { art: "gedrosselt", jeMin: 0, grund: "keine neue Runde in der Probe" };
  const jeMin = (b.runde - a.runde) / (spanne / 60e3);
  return { art: jeMin < SCHWELLE_JE_MIN ? "gedrosselt" : "ok", jeMin };
}
