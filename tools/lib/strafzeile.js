/**
 * Die Strafzeilen, mit denen /bb (tools/checkin.js) den Waechter meldet.
 *
 * WARUM ES DIESE DATEI GIBT (30.10.2026). Der Waechter schreibt in
 * data/penalties.json nicht nur Strafen, sondern seit dem 06.09.2026 auch
 * Entwarnungen (result "stood-down": ein Verdacht, dessen Signal 10 min
 * ausblieb, ohne dass eingegriffen wurde). checkin.js zaehlte beide als
 * "Strafen (24 h)" - am 30.10. stand dort "1x Sprosse 1", und der einzige
 * Eintrag war die Entwarnung fuer figwatch.js vom Vortag. Eine Entwarnung
 * ist das Gegenteil einer Strafe. Das Dashboard trennt die beiden seit dem
 * 29.10. schon; jetzt tut es /bb auch.
 *
 * Rein und ohne Netz, damit tools/test-strafzeile.js sie pruefen kann
 * (checkin.js laeuft beim Import los und ist so nicht testbar).
 *
 * Gedruckt wird nur, was etwas zu sagen hat. Entwarnungen auf Sprosse 1
 * und 2 sind der Normalfall einer funktionierenden Hysterese - sie stehen
 * nur als Nachsatz hinter echten Strafen. Alles ab Sprosse 3 wird einzeln
 * genannt ("jede ist ein Befund"), auch eine Entwarnung: ein Verdacht, der
 * bis Sprosse 3 stieg, ist eine Spur, selbst wenn nicht eingegriffen wurde
 * (Skeptiker 30.10.: 21 Entwarnungen "kern" S3a bis zum 20.10., fast
 * taeglich um 14 Uhr - der Check-in zeigte sie bisher einzeln, und das
 * soll so bleiben).
 */

export const PENALTY_WINDOW_MS = 24 * 3600000;

// Ergebnisse, die keine Strafe sind. Bewusst eine Liste statt "nur executed
// zaehlt": failed, would-execute (Beobachtungsmodus), ordered und pending
// sind Sprossen, die gegriffen haben oder greifen wollten - die gehoeren in
// die Zeile, auch wenn die Wirkung ausblieb.
const NOT_A_PENALTY = new Set(["stood-down"]);

export function isPenalty(e) {
  return !!e && !NOT_A_PENALTY.has(e.result);
}

/**
 * entries: penalties.json "eintraege"; nowMs: Wanduhr.
 * Liefert ein Array von Zeilen (leer = nichts zu sagen).
 */
export function penaltyLines(entries, nowMs, formatTime = (ms) => new Date(ms).toLocaleTimeString("de-DE")) {
  if (!Array.isArray(entries)) return [];
  const since = nowMs - PENALTY_WINDOW_MS;
  const recent = entries.filter((e) => e && Number(e.wall) >= since);
  const penalties = recent.filter(isPenalty);
  const standDowns = recent.length - penalties.length;
  const high = recent.filter((x) => Number(x.rung) >= 3);
  const lines = [];
  if (penalties.length) {
    const byRung = {};
    for (const e of penalties) byRung[e.rung] = (byRung[e.rung] || 0) + 1;
    lines.push("Strafen (24 h): " + Object.entries(byRung)
      .sort((a, b) => a[0] - b[0])
      .map(([r, n]) => n + "x Sprosse " + r).join(", ")
      + (standDowns ? " (dazu " + standDowns + (standDowns === 1 ? " Entwarnung" : " Entwarnungen") + ")" : ""));
  } else if (high.length) {
    // Keine Strafe, aber ein Verdacht ab Sprosse 3 - die Kopfzeile sagt das
    // ausdruecklich, damit niemand die Einzelzeilen fuer Strafen haelt.
    lines.push("Strafen (24 h): keine, aber Verdacht ab Sprosse 3 mit Entwarnung:");
  }
  for (const e of high) {
    lines.push("  Sprosse " + e.rung + " auf " + e.target + " (" + e.reason + ") um "
      + formatTime(Number(e.wall)) + " - " + (isPenalty(e) ? (e.result || "?") : "Entwarnung"));
  }
  return lines;
}
