/**
 * Die eine Zeile, mit der /bb (tools/checkin.js) die Gang meldet.
 *
 * WARUM ES DIESE DATEI GIBT (Skeptiker-Hinweis 03.10.2026: "kein /bb-Leser fuer
 * gang.json"). gang.js schreibt data/gang.json mit allem, was ein Besuch
 * braucht - und bis heute las es niemand. Ein Befund, den niemand abholt, ist
 * so stumm wie einer, den niemand schreibt. Rein und ohne Netz, damit
 * tools/test-gang.js sie pruefen kann (checkin.js selbst laeuft beim Import
 * los und ist so nicht testbar).
 *
 * Gedruckt wird immer genau EINE Zeile oder gar keine (Telemetrie fehlt =
 * gang.js lief nie = nichts zu sagen). Die Frist ist die freshnessMs des
 * gang.js-Eintrags in der Registry (10 min).
 */

export const GANG_FRIST_MS = 10 * 60000;

const zahl = (n, k = 0) => Number(n).toLocaleString("de-DE", { maximumFractionDigits: k });

/**
 * @param {object|null} tel geparste data/gang.json
 * @param {number} jetzt Date.now()
 * @returns {string|null}
 */
export function gangZeile(tel, jetzt) {
  if (!tel || typeof tel !== "object") return null;
  const zeit = [tel.ts, tel.wall, tel.zeit].find((x) => Number.isFinite(x));
  if (zeit === undefined) return "GANG: data/gang.json ohne Zeitstempel - nicht lesbar.";
  const alterMin = (jetzt - zeit) / 60000;
  if (alterMin > GANG_FRIST_MS / 60000) {
    return "GANG: data/gang.json ist " + zahl(alterMin) + " min alt - gang.js laeuft nicht"
      + " (Schalter weg? Kern ohne Registry-Eintrag? Neustart: node tools/neustart.js bn4net.js).";
  }
  const fehler = tel.errors && Number.isFinite(tel.errors.total) ? tel.errors.total : 0;
  const letzter = tel.lastError && tel.lastError.call
    ? " Letzter Fehler: " + tel.lastError.call + " - " + String(tel.lastError.msg || "").slice(0, 80) + "." : "";

  if (!tel.inGang) {
    if (tel.blockedReason === "prereq_missing") {
      const fehlt = tel.prereq && Array.isArray(tel.prereq.missing) ? tel.prereq.missing.join("; ") : "Grund unbekannt";
      return "GANG: noch keine Gang - Gruendung GESPERRT, bis Paket 0 und Paket 1 live sind: " + fehlt + ".";
    }
    return "GANG: noch keine Gang (" + (tel.blockedReason || tel.state || "?") + "), Gruendungsversuche "
      + (Number.isFinite(tel.createAttempts) ? tel.createAttempts : "?") + "." + letzter;
  }
  if (tel.state === "blocked" || tel.state === "done") {
    return "GANG: Steuerung steht (" + tel.state + ": " + (tel.blockedReason || "?") + "), "
      + zahl(tel.members) + " Mitglieder." + letzter;
  }
  return "GANG: " + (tel.faction || "?") + ", " + zahl(tel.members) + " Mitglieder, Respekt " + zahl(tel.respect)
    + ", Ruf " + (Number.isFinite(tel.factionRep) ? zahl(tel.factionRep) : "?")
    + ", Strafe " + (Number.isFinite(tel.penalty) ? tel.penalty.toFixed(2) : "?")
    + ", Aufstiege " + zahl(tel.ascensions || 0) + ", Fehler " + zahl(fehler) + "." + letzter;
}
