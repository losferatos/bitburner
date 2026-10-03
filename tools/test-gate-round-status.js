/**
 * Ebene 0: der Leser der Torrunden-Telemetrie fuer den Check-in
 * (tools/lib/gate-round-status.js, gelesen von tools/checkin.js).
 *
 * Skeptiker-Auflage 1 zu P1 / AUG-4 (03.10.2026): bn4rep.js zaehlt die Fehler
 * der Torrunde und schreibt den Modus, aber fuer data/bn4rep.json -> torRunde
 * gab es keinen Leser. Wirft der Block in jeder Runde, faellt bn4rep.js still
 * auf die alte Kaufschleife zurueck, die trotz Einbausperre alles Verdiente
 * kauft - P1 waere aus, und niemand saehe es.
 *
 * Geprueft wird hier die Funktion einzeln; das Zusammenspiel Schreiber
 * (bn4rep.js im Nachbau) und Leser steht in tools/test-bn4rep-ebene2.js (S12
 * bis S16). Ebenso wichtig wie jeder Befund: KEIN Befund, solange alles in
 * Ordnung ist - ein Leser, der immer etwas meldet, wird nicht mehr gelesen.
 *
 * Aufruf: node tools/test-gate-round-status.js
 */

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));

let gruen = 0;
let rot = 0;
const fehler = [];
function pruefe(name, bedingung, hinweis = "") {
  if (bedingung) { gruen++; console.log("  ok    " + name); return; }
  rot++;
  fehler.push(name + (hinweis ? " - " + hinweis : ""));
  console.log("  ROT   " + name + (hinweis ? " - " + hinweis : ""));
}

const { gateRoundStatus, GATE_STATUS_FRESH_MS } = await import(pathToFileURL(path.join(HIER, "lib", "gate-round-status.js")).href);

const NOW = 1_790_000_000_000;
const MIN = 60000;
const gesund = (extra = {}) => ({
  mode: "locked", gateOpen: false, reason: "Wiederaufbau noch nicht bezahlt gemacht", bonusMs: null, bonusNote: "",
  plan: { n: 7, cost: 54.7e9, gain: 1.584, first: "SPTN-97 Gene Modification", candidates: 20 },
  skills: { source: "blade.json", reaper: 12, evasive: 13, strengthFactor: 1.24, dexterityFactor: 1.8848 },
  wait: { min: null, seit: null, zuletzt: null }, abortStreak: 0, installHeld: false,
  bought: 0, boughtTotal: 0, lastRound: null, buyFailures: 0, planDrift: 0, gangErrors: 0, lastGangError: "",
  ...extra,
});
const tele = (torRunde, zeit = NOW - 20000) => ({ zeit, torRunde });
const lage = (t, extra = {}) => gateRoundStatus({ tele: t, blade: null, nowMs: NOW, before: null, ...extra });
const alles = (r) => r.lines.concat(r.findings).join(" | ");

console.log("");
console.log("=== Torrunden-Leser fuer den Check-in ===");

console.log("\n-- ohne Gang oder ohne Telemetrie: nichts zu sagen --");
{
  const a = lage(null);
  const b = lage(tele(null));
  const c = lage({ zeit: NOW });
  pruefe("keine Telemetrie / torRunde null / Feld fehlt: keine Zeilen, kein Befund, data null",
    [a, b, c].every((r) => r.lines.length === 0 && r.findings.length === 0 && r.data === null), alles(b));
  const d = gateRoundStatus({ tele: tele(null), blade: { skillLevelsError: "Bladeburner nicht verfuegbar" }, nowMs: NOW });
  pruefe("torRunde null, aber blade.js meldet einen Fehler bei den Faehigkeitsstufen: ein Befund",
    d.findings.length === 1 && /Faehigkeitsstufen/.test(d.findings[0]) && /nicht verfuegbar/.test(d.findings[0]), alles(d));
  const e = gateRoundStatus({ tele: null, blade: { skillLevelsError: "x" }, nowMs: NOW });
  pruefe("ganz ohne bn4rep-Telemetrie kein Befund (das ist eine andere Meldung)", e.findings.length === 0);
}

console.log("\n-- gesunde Torrunde: Zeilen, aber KEIN Befund --");
{
  const modi = [
    ["locked", gesund()],
    ["bonus", gesund({ mode: "bonus", gateOpen: true, bonusMs: 600000, bonusNote: "Gang-Vorrat 600 s wird noch nachgeholt (wartet seit 12 min)",
      wait: { min: 600000, seit: NOW - 12 * MIN, zuletzt: NOW - 20000 }, installHeld: true })],
    ["round", gesund({ mode: "round", gateOpen: true, bonusMs: 0 })],
  ];
  for (const [name, t] of modi) {
    const r = lage(tele(t));
    pruefe("Modus " + name + ": mindestens eine Zeile, kein Befund, data traegt Modus und Zaehler",
      r.lines.length >= 1 && r.findings.length === 0 && r.data && r.data.mode === name && r.data.gangErrors === 0, alles(r));
  }
  const bonus = lage(tele(modi[1][1]));
  pruefe("bonus: die Zeile nennt Vorrat (600 s), Wartedauer (12 min) und die Grenze (30 min)",
    /600 s Vorrat/.test(bonus.lines[0]) && /wartet seit 12 min/.test(bonus.lines[0]) && /Grenze 30 min/.test(bonus.lines[0]), bonus.lines[0]);
  const locked = lage(tele(modi[0][1]));
  pruefe("locked: die Zeile nennt den Grund und den Plan (7 Stuecke, $54,70 Mrd, x1,584)",
    /nicht bezahlt/.test(locked.lines[0]) && /7 Stuecke/.test(locked.lines[0]) && /\$54,70 Mrd/.test(locked.lines[0]) && /x1,584/.test(locked.lines[0]), locked.lines[0]);
  pruefe("Faehigkeiten eingerechnet: eigene Zeile mit Reaper, Evasive und Faktoren",
    locked.lines.some((z) => /Reaper 12, Evasive System 13/.test(z) && /x1,240/.test(z) && /x1,885/.test(z)), alles(locked));
}

console.log("\n-- die letzte Runde --");
{
  const r = lage(tele(gesund({ boughtTotal: 7, lastRound: { zeit: NOW - 3 * 60 * MIN, n: 7, geplant: 8, first: "SPTN-97 Gene Modification", cost: 54e9, gain: 1.58 } })));
  pruefe("Zeile: vor 180 min, 7 von 8 Stuecken, erstes Stueck, Kosten, Zuwachs, Summe",
    r.lines.some((z) => /vor 180 min: 7 von 8 Stuecken \(erstes SPTN-97 Gene Modification\), \$54,00 Mrd, Competence x1,580; insgesamt gekauft: 7/.test(z)), alles(r));
}

console.log("\n-- Befunde --");
{
  const err = lage(tele({ mode: "error", gangErrors: 41, lastGangError: "Torrunde-Block: x is not defined" }));
  pruefe("mode error: Befund 'P1 IST AUS', nennt die alte Kaufschleife, den letzten Fehler und die Zahl",
    err.findings.length === 1 && /P1 IST AUS/.test(err.findings[0]) && /alte\s+Kaufschleife/.test(err.findings[0])
    && /x is not defined/.test(err.findings[0]) && /41/.test(err.findings[0]) && err.findings[0].startsWith("TORRUNDE-BEFUND: "), alles(err));
  pruefe("mode error: auch eine Zeile (FEHLER-RUECKFALL) und data.mode error", err.lines.some((z) => /FEHLER-RUECKFALL/.test(z)) && err.data.mode === "error");

  const normal = lage(tele({ mode: "normal", gangErrors: 3, lastGangError: "ns.gang.inGang: kaputt" }));
  pruefe("mode normal mit Fehlern (inGang schlug fehl): Befund nennt, dass die alte Schleife ohne Aufschub lief",
    normal.findings.length === 1 && /ohne Aufschub/.test(normal.findings[0]) && /inGang/.test(normal.findings[0]), alles(normal));

  const fehler = lage(tele(gesund({ gangErrors: 2, lastGangError: "getAugmentationPrereq X: boom" })));
  pruefe("gangErrors > 0 in gesundem Modus: ein Befund mit letztem Fehler",
    fehler.findings.length === 1 && /2 Fehler in der Torrunde/.test(fehler.findings[0]) && /boom/.test(fehler.findings[0]), alles(fehler));

  const kauf = lage(tele(gesund({ buyFailures: 4 })));
  pruefe("buyFailures > 0: Befund 'vom Spiel abgelehnt'", kauf.findings.length === 1 && /4 Kaeufe der Runde vom Spiel abgelehnt/.test(kauf.findings[0]), alles(kauf));

  const drift = lage(tele(gesund({ planDrift: 2 })));
  pruefe("planDrift > 0: Befund 'Preisabweichung'", drift.findings.length === 1 && /Preisabweichung/.test(drift.findings[0]) && /2 Runden/.test(drift.findings[0]), alles(drift));

  const alle = lage(tele(gesund({ gangErrors: 1, buyFailures: 1, planDrift: 1, lastGangError: "e" })));
  pruefe("alle drei Zaehler: drei getrennte Befunde", alle.findings.length === 3, alles(alle));

  const halt = lage(tele(gesund({ mode: "round", gateOpen: true, abortStreak: 12, installHeld: true, buyFailures: 12 })));
  pruefe("abortStreak >= 10: Befund, dass der Einbau zurueckgehalten wird, dazu die Zeile 'Der Einbau haelt zurueck'",
    halt.findings.some((z) => /seit 12 Runden schon beim ersten Stueck ab/.test(z)) && halt.lines.some((z) => /Der Einbau haelt zurueck/.test(z)), alles(halt));
  const kurz = lage(tele(gesund({ mode: "round", gateOpen: true, abortStreak: 3, installHeld: true })));
  pruefe("abortStreak 3: noch kein Befund (nur die Zeile)", kurz.findings.length === 0 && kurz.lines.some((z) => /haelt zurueck/.test(z)), alles(kurz));
}

console.log("\n-- Verlauf seit dem letzten Besuch --");
{
  const t = tele(gesund({ gangErrors: 5, lastGangError: "e" }));
  const neu = lage(t, { before: { gangErrors: 2, buyFailures: 0, planDrift: 0 } });
  const gleich = lage(t, { before: { gangErrors: 5, buyFailures: 0, planDrift: 0 } });
  const weniger = lage(t, { before: { gangErrors: 9, buyFailures: 0, planDrift: 0 } });
  const ohne = lage(t, { before: null });
  pruefe("Zaehler gestiegen: '+3 seit dem letzten Besuch'", /5 \(\+3 seit dem letzten Besuch\)/.test(neu.findings[0]), neu.findings[0]);
  pruefe("Zaehler gleich: 'unveraendert seit dem letzten Besuch' (der Befund bleibt stehen, ist aber als alt erkennbar)",
    /5 \(unveraendert seit dem letzten Besuch\)/.test(gleich.findings[0]), gleich.findings[0]);
  pruefe("Zaehler kleiner: 'Zaehler zurueckgesetzt' (bn4rep.js wurde neu gestartet)", /zurueckgesetzt/.test(weniger.findings[0]), weniger.findings[0]);
  pruefe("ohne letzten Besuch: nur die Zahl", /^TORRUNDE-BEFUND: 5 Fehler/.test(ohne.findings[0]), ohne.findings[0]);
}

console.log("\n-- Faehigkeiten und Alter --");
{
  const roh = lage(tele(gesund({ skills: { source: "roh", why: "blade.json ohne skillLevels (altes blade.js?)" } })));
  pruefe("Faehigkeiten nicht eingerechnet: Hinweiszeile mit Grund und der Folge (bis zu 5 %), aber kein Befund",
    roh.lines.some((z) => /NICHT eingerechnet/.test(z) && /ohne skillLevels/.test(z) && /5 %/.test(z)) && roh.findings.length === 0, alles(roh));
  const bl = gateRoundStatus({ tele: tele(gesund()), blade: { skillLevelsError: "kaputt" }, nowMs: NOW });
  pruefe("blade.js meldet skillLevelsError neben gesunder Torrunde: Befund", bl.findings.length === 1 && /kaputt/.test(bl.findings[0]), alles(bl));
  const alt = lage(tele(gesund(), NOW - GATE_STATUS_FRESH_MS - 5 * MIN));
  pruefe("Telemetrie aelter als 8 Minuten: Hinweiszeile mit dem Alter vorweg",
    /bn4rep\.json ist 13 min alt/.test(alt.lines[0]) && alt.lines.length >= 2, alt.lines[0]);
  const frisch = lage(tele(gesund(), NOW - 2 * MIN));
  pruefe("frische Telemetrie: kein Altershinweis", !frisch.lines.some((z) => /min alt/.test(z)));
}

console.log("\n-- unvollstaendige Daten werfen nie --");
{
  const muell = [
    tele({}), tele({ mode: 5 }), tele({ mode: "bonus" }), tele({ mode: "locked", plan: "x", skills: 5, wait: [], lastRound: 3 }),
    tele({ mode: "round", gangErrors: "viel", buyFailures: NaN, planDrift: null }), tele("kaputt"), { zeit: "x", torRunde: [] },
  ];
  let wirft = "";
  for (const m of muell) {
    try { lage(m); } catch (e) { wirft += String(e && e.message ? e.message : e) + "; "; }
  }
  pruefe("Muell in torRunde: keine Ausnahme", wirft === "", wirft);
}

console.log("");
console.log(gruen + " ok, " + rot + " rot von " + (gruen + rot));
if (rot) {
  console.log("\nFehlgeschlagen:");
  for (const f of fehler) console.log("  - " + f);
}
process.exit(rot ? 1 : 0);
