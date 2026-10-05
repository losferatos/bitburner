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
 *
 * DER GELDMODUS IN /bb (P2d, Skeptiker-Befund B1 vom 04.10.2026). Seit gang-3
 * schreibt gang.js mode, repNeed, repNeedWhy, repNeedNullSince, moneyGainRate und
 * equipmentBought / -Spent / -Block. Ohne Leser waere der sichere Rueckfall des
 * Geldmodus stumm: "Bedarf fehlt, Gang bleibt auf Terrorism" sieht von aussen
 * genauso aus wie "Ruf noch unter Bedarf" - und ein "/bb sieht gut aus" waere
 * kein Beleg, weil das Werkzeug den Fall gar nicht anzeigen koennte. Deshalb haengt
 * gangZeile den Modus mit Ruf und Bedarf (oder dem Grund, warum es keinen gibt),
 * das Gang-Geld und die Ausruestung an die Zeile, und gangBefunde meldet einen
 * BEFUND, wenn der Bedarf laenger als GANG_BEFUND_NULL_MS ununterbrochen fehlt.
 * Telemetrie von gang-2 (ohne Feld `mode`) bekommt nichts angehaengt.
 */

export const GANG_FRIST_MS = 10 * 60000;
// Ab so langer Zeit ohne Rufbedarf ist das ein Befund (kurze Luecken gibt es
// legitim: eine Runde ohne Gang-Stueck im Plan, der Anlauf nach einem Einbau).
export const GANG_BEFUND_NULL_MS = 30 * 60000;

const zahl = (n, k = 0) => Number(n).toLocaleString("de-DE", { maximumFractionDigits: k });
const geld = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return "?";
  for (const [t, k] of [[1e12, " Bio"], [1e9, " Mrd"], [1e6, " Mio"], [1e3, " k"]]) {
    if (Math.abs(x) >= t) return "$" + (x / t).toFixed(2).replace(".", ",") + k;
  }
  return "$" + x.toFixed(0);
};
const istBedarf = (n) => typeof n === "number" && Number.isFinite(n) && n > 0;

/**
 * Der Geldmodus-Teil der Zeile: Modus mit Ruf und Bedarf, Gang-Geld, Ausruestung.
 * Leer fuer Telemetrie ohne `mode` (gang-2).
 */
function geldTeil(tel) {
  if (!Object.prototype.hasOwnProperty.call(tel, "mode")) return "";
  const modus = tel.mode === "money" ? "MONEY" : tel.mode === "respect" ? "RESPECT" : "?";
  const ruf = Number.isFinite(tel.factionRep) ? zahl(tel.factionRep) : "?";
  const bedarf = istBedarf(tel.repNeed)
    ? "Ruf " + ruf + " / Bedarf " + zahl(tel.repNeed)
    : "kein Bedarf" + (tel.repNeedWhy ? ": " + String(tel.repNeedWhy).slice(0, 90) : "");
  let t = " Modus " + modus + " (" + bedarf + ")";
  // moneyGainRate ist je ZYKLUS (200 ms), x5 sind $/s.
  if (Number.isFinite(tel.moneyGainRate)) t += ", Gang-Geld " + geld(tel.moneyGainRate * 5) + "/s";
  if (Number.isFinite(tel.equipmentBought)) {
    t += ", Ausruestung " + zahl(tel.equipmentBought) + " Stk fuer " + geld(tel.equipmentSpent);
    if (tel.mode === "money" && tel.equipmentBlock) t += " (Block: " + String(tel.equipmentBlock).slice(0, 60) + ")";
  }
  return t + ".";
}

/**
 * Gang-Telemetrie nur aus DIESEM Knotenlauf (05.10.2026). Befund BN3.1:
 * gang.json aus BN2 lag noch auf home, der Check-in meldete "gang.js laeuft
 * nicht" und einen TORRUNDE-BEFUND "Gang laeuft" - in einem Knoten, in dem es
 * gar keine Gang gibt. Telemetrie von vor dem letzten Knotenwechsel
 * (data/bn4net.json nodeReset, Wanduhr) zaehlt wie keine Datei.
 * @param {object|null} tel geparste data/gang.json
 * @param {number} nodeReset Wanduhr des letzten Knotenwechsels
 * @returns {object|null}
 */
export function gangImKnoten(tel, nodeReset) {
  if (!tel || typeof tel !== "object") return null;
  if (!Number.isFinite(nodeReset)) return tel;
  const zeit = [tel.ts, tel.wall, tel.zeit].find((x) => Number.isFinite(x));
  return Number.isFinite(zeit) && zeit < nodeReset ? null : tel;
}

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
    + ", Aufstiege " + zahl(tel.ascensions || 0) + ", Fehler " + zahl(fehler) + "." + geldTeil(tel) + letzter;
}

/**
 * Befunde zur Gang (je Befund eine Zeile "GANG-BEFUND: ..."), leer wenn alles in
 * Ordnung ist oder die Telemetrie nichts hergibt. Tote oder stehende Steuerung
 * meldet schon gangZeile; hier steht nur, was die Zeile allein nicht zeigt.
 *
 * @param {object|null} tel geparste data/gang.json
 * @param {number} jetzt Date.now()
 * @returns {string[]}
 */
export function gangBefunde(tel, jetzt) {
  const out = [];
  if (!tel || typeof tel !== "object") return out;
  const zeit = [tel.ts, tel.wall, tel.zeit].find((x) => Number.isFinite(x));
  if (zeit === undefined || jetzt - zeit > GANG_FRIST_MS) return out;
  if (tel.inGang !== true || tel.state === "blocked" || tel.state === "done") return out;
  // Telemetrie von gang-2 kennt den Geldmodus nicht - dann gibt es nichts zu melden.
  if (!Object.prototype.hasOwnProperty.call(tel, "mode")) return out;

  if (!istBedarf(tel.repNeed)) {
    const seit = Number(tel.repNeedNullSince);
    if (Number.isFinite(seit) && seit > 0 && jetzt - seit > GANG_BEFUND_NULL_MS) {
      out.push("GANG-BEFUND: seit " + zahl((jetzt - seit) / 60000) + " min kein Rufbedarf fuer den Geldmodus ("
        + (tel.repNeedWhy ? String(tel.repNeedWhy).slice(0, 120) : "Grund unbekannt") + ") - die Gang bleibt auf Terrorism,"
        + " Gang-Geld und Ausruestung bleiben aus. Pruefen: laeuft bn4rep.js in der neuen Fassung,"
        + " meldet data/bn4rep.json torRunde.repNeed, liegt data/gang-geld-aus.txt?");
    }
  }
  return out;
}
