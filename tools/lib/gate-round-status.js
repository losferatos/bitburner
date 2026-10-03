/**
 * Die Lage der Torrunde im Kampfknoten mit Gang - der LESER fuer die
 * Telemetrie, die bn4rep.js schreibt (data/bn4rep.json -> torRunde).
 *
 * WARUM ES DIESEN LESER GIBT (Skeptiker-Auflage 1 zu P1 / AUG-4, 03.10.2026)
 *
 * bn4rep.js zaehlt die Fehler der Torrunde (gangErrors, buyFailures,
 * planDrift) und schreibt den Modus. Wirft der Block in jeder Runde, schaltet
 * bn4rep.js still auf die ALTE Kaufschleife zurueck, und die kauft trotz
 * Einbausperre alles Verdiente - P1 waere unbemerkt aus, und jedes Stueck
 * verteuert die Gang-Runde um den Faktor 1,9. Genau diese Fehlerklasse (Fehler
 * gezaehlt, aber von niemandem gelesen) war die Lehre vom 03.10.2026, als vier
 * Black-Op-Aufrufe in blade.js seit Wochen tot waren. Dieser Leser macht aus
 * den Zaehlern Zeilen im Check-in (/bb).
 *
 * Rein: kein Dateizugriff, keine Uhr - tools/checkin.js reicht die Daten und
 * die Zeit herein, tools/test-tor-runde.js prueft die Funktion einzeln.
 */

/** Aelter als das, und data/bn4rep.json beschreibt nicht die Gegenwart. */
export const GATE_STATUS_FRESH_MS = 8 * 60000;

/** Ab so vielen abgebrochenen Runden ohne Kauf in Folge ist das ein Befund (Grenze: 20, lib/einbau.js). */
const ABORT_STREAK_FINDING = 10;

const minutes = (ms) => Math.max(0, Math.round(ms / 60000));
const money = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return "?";
  for (const [t, k] of [[1e12, " Bio"], [1e9, " Mrd"], [1e6, " Mio"], [1e3, " k"]]) {
    if (Math.abs(x) >= t) return "$" + (x / t).toFixed(2).replace(".", ",") + k;
  }
  return "$" + x.toFixed(0);
};
const factor = (n) => "x" + Number(n).toFixed(3).replace(".", ",");

/**
 * Ein Zaehler mit seinem Verlauf seit dem letzten Besuch.
 * @param {number} n aktueller Stand
 * @param {number|undefined|null} before Stand beim letzten Besuch (gleicher Lauf)
 */
function counterText(n, before) {
  if (!Number.isFinite(before)) return String(n);
  if (n > before) return n + " (+" + (n - before) + " seit dem letzten Besuch)";
  if (n < before) return n + " (Zaehler zurueckgesetzt: bn4rep.js wurde neu gestartet)";
  return n + " (unveraendert seit dem letzten Besuch)";
}

/**
 * @param {object} p
 * @param {object|null} p.tele       geparstes data/bn4rep.json
 * @param {object|null} p.blade      geparstes data/blade.json (fuer skillLevelsError)
 * @param {number} p.nowMs           Date.now()
 * @param {object|null} [p.before]   Zaehler beim letzten Besuch { gangErrors, buyFailures, planDrift }
 * @returns {{lines: string[], findings: string[], data: object|null}}
 *   lines     Klartextzeilen fuer den Bericht (leer ohne Gang)
 *   findings  Befunde, jede mit "TORRUNDE-BEFUND: " davor
 *   data      was der Check-in als Verlauf ablegt, null ohne Torrunde
 */
export function gateRoundStatus({ tele, blade, nowMs, before = null, gang = null }) {
  const lines = [];
  const findings = [];
  const t = tele && typeof tele === "object" ? tele.torRunde : null;

  // GANG OHNE TORRUNDE (Integrations-Skeptiker 04.10.2026, Luecke A): steht
  // die Gang, meldet bn4rep.js aber keine Torrunde, ist der Kaufaufschub aus -
  // meist weil data/verfahren.txt nicht "V2 <dieser Knoten>" nennt
  // (nurKampfStuecke false) oder eine alte bn4rep.js laeuft. Die alte
  // Kaufschleife kauft dann jedes verdiente Gang-Stueck sofort (1,9^q).
  // Ohne diesen Befund bliebe das still, weil unten "keine Torrunde" schlicht
  // keine Zeile erzeugt.
  if (gang && typeof gang === "object" && gang.inGang === true && tele && (!t || typeof t !== "object")) {
    findings.push("TORRUNDE-BEFUND: Gang laeuft (" + String(gang.faction || "?").slice(0, 40)
      + "), aber bn4rep.json meldet keine Torrunde - der Kaufaufschub ist aus (data/verfahren.txt"
      + " pruefen, laeuft die neue bn4rep.js?).");
  }

  // Ein Fehler von blade.js beim Lesen der Faehigkeitsstufen gehoert auch ohne
  // Torrunden-Telemetrie in den Bericht: ohne ihn plant die Runde mit rohen
  // Stufen und waehlt eine schlechtere (lib/einbau.js gateCompetence).
  const bladeErr = blade && typeof blade === "object" && blade.skillLevelsError
    ? String(blade.skillLevelsError).slice(0, 120) : "";

  if (!t || typeof t !== "object") {
    if (bladeErr && tele) {
      findings.push("TORRUNDE-BEFUND: blade.js kann die Faehigkeitsstufen (Reaper, Evasive System) nicht lesen: "
        + bladeErr + " - die Torrunde plant dann mit rohen Stufen.");
    }
    return { lines, findings, data: null };
  }

  const age = Number.isFinite(tele.zeit) ? nowMs - tele.zeit : null;
  if (age !== null && age > GATE_STATUS_FRESH_MS) {
    lines.push("Torrunde: data/bn4rep.json ist " + minutes(age) + " min alt (bn4rep.js laeuft nicht oder der Tab"
      + " ist gedrosselt) - der folgende Stand ist der letzte bekannte.");
  }

  const plan = t.plan && typeof t.plan === "object" ? t.plan : null;
  const planText = plan
    ? (plan.n > 0
      ? "Plan: " + plan.n + " Stuecke fuer " + money(plan.cost) + ", Competence " + factor(plan.gain)
        + (plan.first ? ", erstes " + plan.first : "")
      : "Plan: nichts kaufbar (" + (plan.candidates ?? 0) + " verdiente Kampfstuecke)")
    : "";
  const wait = t.wait && typeof t.wait === "object" ? t.wait : null;

  switch (t.mode) {
    case "locked":
      lines.push("Torrunde: Einbau gesperrt (" + (t.reason || "kein Grund gemeldet")
        + ") - aus keiner Faktion wird gekauft. " + planText + ".");
      break;
    case "bonus": {
      const waited = wait && Number.isFinite(wait.seit) && Number.isFinite(wait.zuletzt)
        ? minutes(wait.zuletzt - wait.seit) : null;
      const parts = [];
      if (t.bonusMs != null) parts.push(Math.round(t.bonusMs / 1000) + " s Vorrat");
      if (waited !== null) parts.push("wartet seit " + waited + " min, Grenze 30 min");
      lines.push("Torrunde: Tor offen, aber der Gang-Vorrat wird noch nachgeholt"
        + (parts.length ? " (" + parts.join(", ") + ")" : "") + " - weder Kauf noch Einbau. " + planText + ".");
      break;
    }
    case "round":
      lines.push("Torrunde: Tor offen, die Runde wird gekauft. " + planText + ".");
      break;
    case "normal":
      lines.push("Torrunde: Modus normal (alte Kaufschleife) - die Gang-Pruefung ist ausgefallen.");
      break;
    case "error":
      lines.push("Torrunde: FEHLER-RUECKFALL - der Block wirft, die alte Kaufschleife laeuft.");
      break;
    default:
      lines.push("Torrunde: Modus " + String(t.mode));
  }

  const last = t.lastRound && typeof t.lastRound === "object" ? t.lastRound : null;
  if (last && Number.isFinite(last.zeit)) {
    lines.push("  Letzte Runde vor " + minutes(nowMs - last.zeit) + " min: " + last.n + " von " + last.geplant
      + " Stuecken (erstes " + last.first + "), " + money(last.cost) + ", Competence " + factor(last.gain)
      + "; insgesamt gekauft: " + (t.boughtTotal ?? last.n) + ".");
  }
  if (t.installHeld && t.mode !== "bonus") {
    lines.push("  Der Einbau haelt zurueck: die Torrunde brach ab (" + (t.abortStreak ?? "?")
      + " Runden in Folge, Grenze 20).");
  }
  if (t.skills && t.skills.source === "blade.json") {
    lines.push("  Faehigkeiten eingerechnet: Reaper " + t.skills.reaper + ", Evasive System " + t.skills.evasive
      + " (Staerke/Verteidigung " + factor(t.skills.strengthFactor) + ", Geschicklichkeit/Beweglichkeit "
      + factor(t.skills.dexterityFactor) + ").");
  } else if (t.skills) {
    lines.push("  Hinweis: Faehigkeiten NICHT eingerechnet (" + (t.skills.why || "kein Grund") + ") - die Runde"
      + " plant mit rohen Stufen, bis zu 5 % schlechtere Competence.");
  }

  // --- Befunde ---------------------------------------------------------------
  const lastErr = String(t.lastGangError || "kein Text").slice(0, 140);
  const gangErrors = Number(t.gangErrors) || 0;
  const buyFailures = Number(t.buyFailures) || 0;
  const planDrift = Number(t.planDrift) || 0;

  if (t.mode === "error") {
    findings.push("TORRUNDE-BEFUND: P1 IST AUS - der Torrunden-Block wirft, bn4rep.js faellt auf die alte"
      + " Kaufschleife zurueck und kauft trotz Einbausperre alles Verdiente (jedes Stueck verteuert die"
      + " Gang-Runde um x1,9). Letzter Fehler: " + lastErr + ". Fehler gesamt: "
      + counterText(gangErrors, before && before.gangErrors) + ".");
  } else if (gangErrors > 0) {
    findings.push("TORRUNDE-BEFUND: " + counterText(gangErrors, before && before.gangErrors)
      + " Fehler in der Torrunde gezaehlt" + (t.mode === "normal"
        ? " - ns.gang.inGang schlug fehl, die alte Kaufschleife lief ohne Aufschub" : "")
      + ". Letzter: " + lastErr + ".");
  }
  if (buyFailures > 0) {
    findings.push("TORRUNDE-BEFUND: " + counterText(buyFailures, before && before.buyFailures)
      + " Kaeufe der Runde vom Spiel abgelehnt (Katalog, Vorgaenger, Geld oder Ruf stimmen nicht mit dem Plan).");
  }
  if (planDrift > 0) {
    findings.push("TORRUNDE-BEFUND: " + counterText(planDrift, before && before.planDrift)
      + " Runden wegen Preisabweichung > 1 % abgebrochen (die Warteschlange veraenderte sich unter dem Plan"
      + " oder die Preisstufe von SF11 stimmt nicht).");
  }
  if (Number(t.abortStreak) >= ABORT_STREAK_FINDING) {
    findings.push("TORRUNDE-BEFUND: die Torrunde bricht seit " + t.abortStreak + " Runden schon beim ersten"
      + " Stueck ab und haelt den Einbau zurueck (nach 20 laeuft er ohne sie).");
  }
  if (bladeErr) {
    findings.push("TORRUNDE-BEFUND: blade.js kann die Faehigkeitsstufen (Reaper, Evasive System) nicht lesen: "
      + bladeErr + " - die Torrunde plant dann mit rohen Stufen.");
  }

  return {
    lines, findings,
    data: { mode: t.mode ?? null, gangErrors, buyFailures, planDrift },
  };
}
