/**
 * Die Gang - in BN2 eine Kampfgang gruenden und fuehren (Audit 03.10.2026,
 * GANG-1; Betriebsgegenpruefung `nodes/audit-2026-10-03/verify-g01-betrieb.md`,
 * Paket 2).
 *
 * ===========================================================================
 * WARUM ES DIESE DATEI GIBT
 * ===========================================================================
 *
 * In BN2 ist Ruf der Engpass, nicht Geld: Passivruf 0, Arbeitsruf x0,5
 * (`BitNode.tsx` case 2), und im V2 gibt es keine Faktionsarbeit. Die Gang ist
 * der einzige Rufkanal ohne Spielerzeit: `Gang/Gang.ts:144-155` schreibt
 * `faction_rep * respekt * (1 + favor/100) / 75` auf die Gang-Faktion, und die
 * verkauft in BN2 alle 36 nicht-speziellen Kampf-Augs
 * (`Faction/FactionHelpers.tsx:172-200`), die der Bot im V2 sonst nie
 * erreicht. Der Zugang ist in BN2 frei von der Karmaschwelle
 * (`PersonObjects/Player/PlayerObjectGangMethods.ts:16-17`).
 *
 * Gerechnet ist die Rufkurve in `tools/audit/gang-sim.mjs` (Einzelformeln
 * 86.360-fach gegen den Originalquelltext, Dynamik UNGEEICHT - es gibt in
 * keinem Backup eine echte Gang): Kampfgang mit diesem Regler erreicht
 * 1,25 Mio Faktionsruf nach 8,6 h, 2,5 Mio nach 11,7 h. Gegenprobe der
 * Reglerwahl (03.10.2026, `gang-sim.mjs --trainset "Train Combat"`): nur
 * 'Train Combat' statt der gierigen Wahl aus drei Trainingsaufgaben liegt bei
 * 8,55 h gegen 8,59 h bis 1,25 Mio - gleichwertig, deshalb die einfache
 * Fassung.
 *
 * ===========================================================================
 * WAS DIESE DATEI NICHT TUT (und warum)
 * ===========================================================================
 *
 * - NIE `setTerritoryWarfare(true)`. Ohne Warfare bleibt `territoryClashChance`
 *   0 (`Gang/Gang.ts:210-216`), die eigene Gang wird in keinem Clash gezogen,
 *   und Mitglieder sterben nur in der Aufgabe "Territory Warfare"
 *   (`Gang.ts:281-303`). Die Sim-Annahme "Territorium fest 1/7" ist damit
 *   exakt. Tote Mitglieder kosten 5 % des Gesamtrespekts plus ihren eigenen.
 * - KEINE Ausruestung. Sie kostet Geld, das in BN2 die Spieler-Augs brauchen
 *   (Befund GANG-1), und die Sim hat sie bewusst weggelassen.
 * - KEIN Kauf von Spieler-Augs und keine Einbau-Entscheidung. Das ist
 *   Sache von bn4rep.js (Paket 0 UND Paket 1): erst wenn dort die TRP-Falle
 *   geschlossen ist (Paket 0, GANG-2) UND der Kauf bis zum Tor aufgeschoben
 *   wird (Paket 1, AUG-4), darf die Gang gegruendet werden. Beides prueft
 *   gang.js MASCHINELL vor `createGang` (Abschnitt DIE VORAUSSETZUNGSSPERRE).
 *
 * ===========================================================================
 * DER SCHALTER
 * ===========================================================================
 *
 * `data/gang-an.txt` liegt NICHT im Repo. Die Registry fuehrt ihn als
 * Vorbedingung (`requiresFile`), der Kern startet gang.js also nur, wenn er
 * auf home liegt. Zusaetzlich prueft gang.js ihn in JEDER Runde selbst: der
 * Kern beendet ein laufendes Werkzeug nicht, wenn die Vorbedingung nachtraeglich
 * wegfaellt, und "Datei loeschen = Gang-Steuerung aus" soll auch fuer eine
 * laufende Instanz gelten. Die Gang selbst laeuft danach mit den zuletzt
 * gesetzten Aufgaben weiter (Wanted waechst dann unkontrolliert - der Schalter
 * ist eine Notbremse fuer die Steuerung, kein Gang-Stopp).
 *
 * Der Schalter allein genuegt NICHT als Schutz: er haengt an einem Handgriff,
 * und die Gruendung (wie jeder spaetere TRP-Kauf) ist bis zum Knotenende nicht
 * rueckgaengig zu machen. Deshalb die Sperre darunter.
 *
 * ===========================================================================
 * DIE VORAUSSETZUNGSSPERRE (Skeptiker-Auflage 1, 03.10.2026)
 * ===========================================================================
 *
 * Ohne Paket 1 kauft die Kaufschleife von bn4rep.js jedes Gang-Stueck sofort,
 * sobald sein Ruf erreicht ist (Neurotrainer I bei 1.000 Ruf, Wired Reflexes
 * bei 1.250 ...), und jedes Stueck macht die folgenden um den Faktor 1,9
 * teurer: Zyklus 1 bringt dann x1,24 statt x2,6 bis x3,9
 * (verify-g01-betrieb.md Abschnitt 2). Ohne Paket 0 kauft sie in der Runde, in
 * der der Gang-Ruf 2,5 Mio erreicht, The Red Pill - nicht umkehrbar und mit
 * Dauersperre jedes weiteren Einbaus. Die harte Reihenfolge "P0 und P1 vor P2"
 * stand bisher nur auf Papier; jetzt prueft gang.js sie selbst.
 *
 * Vor JEDEM `createGang` liest foundGang() `data/bn4rep.json` (Telemetrie von
 * bn4rep.js) und gruendet nur, wenn ALLES zutrifft (`checkPrereq`, rein und
 * getestet):
 *
 *   1. die Datei ist lesbar und juenger als PREREQ_MAX_AGE_MS (30 min = die
 *      Frist des bn4rep-Eintrags in der Registry): bn4rep.js lebt;
 *   2. sie gehoert zu DIESEM Knoteneintritt: `knoten` UND `nodeReset` gleich
 *      `getResetInfo().currentNode/lastNodeReset` (die Nummer allein trennt
 *      Level 1 von Level 2 desselben Knotens nicht);
 *   3. PAKET 0 live: das Feld `v1Positiv` (PREREQ_P0_FIELD) ist ein Boolean
 *      UND false. Das Feld schreibt nur die neue bn4rep.js - ein noch
 *      laufender alter Prozess schreibt es nicht, auch wenn die Datei auf der
 *      Platte schon neu ist. `true` hiesse "The Red Pill ist hier Kaufkandidat"
 *      (die Marke nennt V1 fuer diesen Knoten): dann ist die Falle offen;
 *   4. PAKET 1 live: das Feld `gateBuy` (PREREQ_P1_FIELD) ist true.
 *
 * VERTRAG MIT bn4rep.js: Paket 0 liefert `v1Positiv` (so gebaut am 03.10.2026,
 * Worktree bb-p0-bau: Boolean im Telemetrieblock am Rundenende, beim Warten am
 * Tor aus dem Block der letzten Runde uebernommen). Paket 1 MUSS `gateBuy:
 * true` in denselben Block schreiben, sobald die Kaufsperre bis zum Tor im Code
 * ist. Heisst das Feld bei der Uebernahme anders, ist es EINE Zeile hier
 * (PREREQ_P1_FIELD) und der Satz in ARCHITEKTUR.md - bis dahin gruendet gang.js
 * NICHT (fail closed, blockedReason "prereq_missing", Einzelheiten in
 * `prereq.missing` der Telemetrie und als eine Logzeile je Aenderung).
 * tools/test-gang.js (Abschnitt S13) prueft, sobald die Felder in bn4rep.js
 * stehen, dass sie wirklich im Telemetrieblock liegen.
 *
 * Fehlt etwas, wird NICHT gegruendet und der Versuch NICHT gezaehlt (keine
 * 10-Minuten-Pause): sobald die Voraussetzung da ist, geht es im naechsten
 * 30-s-Takt los. Wer schon in einer Gang ist (von Hand gegruendet, frueherer
 * Lauf), wird von der Sperre nicht beruehrt - sie schuetzt allein den
 * unumkehrbaren Schritt.
 *
 * ===========================================================================
 * SO WIRD EINGESCHALTET (Reihenfolge, Skeptiker-Auflage 2)
 * ===========================================================================
 *
 *   1. Paket 0 und Paket 1 sind im Spiel (Hash im Spiel = Repo) und
 *      `data/bn4rep.json` zeigt `v1Positiv: false` und `gateBuy: true`.
 *   2. src/registry.json mit dem gang.js-Eintrag ist im Spiel, UND der Kern
 *      wurde DANACH neu gestartet. bn4net.js liest registry.json genau EINMAL
 *      beim Start (`bn4net.js:95-108`, die Schleife beginnt erst bei :888);
 *      ein laufender Kern kennt gang.js nicht, und der Schalter bliebe bis zum
 *      naechsten Kernneustart (im heutigen BN2.1 der Einbau ~So 07:04, also
 *      ~7 h Gang-Zeit) wirkungslos. Neustart: `node tools/neustart.js
 *      bn4net.js` (waehlt selbst den Kanal `SELBST bn4net.js` und belegt den
 *      Neustart per PID-Vergleich; ein `tools/hand.js reload` gibt es nicht,
 *      siehe Kopf von tools/neustart.js).
 *   3. Im bn4net-Log steht `gang.js wartet: wartet auf data/gang-an.txt.`
 *      (alle 30 Runden, also hoechstens alle 5 min). Steht es nicht, kennt der
 *      Kern den Eintrag nicht - dann Schritt 2 wiederholen, NICHT den
 *      Schalter legen.
 *   4. ERST JETZT `data/gang-an.txt` legen.
 *
 * ===========================================================================
 * ABLAUF
 * ===========================================================================
 *
 * 1. `ns.gang.inGang()` (0 GB) zuerst - jede andere Gang-Funktion wirft sonst.
 * 2. Keine Gang: unter den BEIGETRETENEN Kampf-Gang-Faktionen (Slum Snakes,
 *    Tetrads, The Syndicate, Speakers for the Dead, The Dark Army - NIE
 *    NiteSec/The Black Hand, das waeren Hacking-Gangs mit 8.114/872 Rep Verlust
 *    und 13,1 h statt 8,6 h bis 1,25 Mio) die mit dem kleinsten Ruf waehlen.
 *    Die Gruendung setzt den Ruf dieser Faktion auf 0
 *    (`PlayerObjectGangMethods.ts:67`) - bei Ruf 0 geht also nichts verloren
 *    (live 03.10. 21:17: Slum Snakes 0, Tetrads 0, The Syndicate 2.082).
 *    `createGang` wird je Versuch genau EINMAL gerufen; schlaegt es fehl, folgt
 *    eine Pause von 10 Minuten (Wanduhr: die Pause soll das Haemmern bremsen,
 *    nicht Spielzeit messen). Die Pause ueberlebt einen Neustart, weil
 *    `lastCreateAt` in der Telemetrie steht. Ohne beigetretene Kampf-Faktion
 *    wird gar nicht gegruendet.
 * 3. Die Schleife haengt am Gang-Takt `await ns.gang.nextUpdate()`. Das ist
 *    keine Stilfrage: die Gang holt Offline-Zeit mit bis zu 25 Zyklen je Takt
 *    nach (`Gang/data/Constants.ts:28-31`, `Gang.ts:99-121`), also 250 s
 *    Gang-Zeit je 10 s Echtzeit. Ein Regler auf `ns.sleep` saehe davon nichts,
 *    und der Wanted-Level liefe ihm davon. Gegen ein Spiel, das den Takt
 *    anhaelt (gedrosselter Tab, Pause), steht ein Rueckfall daneben:
 *    `Promise.race` mit `ns.asleep` (laeuft nebenher und blockiert keinen
 *    weiteren ns-Aufruf, `NetscriptHelpers.tsx:455` nimmt `asleep` aus der
 *    Nebenlaeufigkeitspruefung aus).
 * 4. Rekrutieren, solange `canRecruitMember()` (12 Mitglieder, ab dem 4. kostet
 *    jedes 5^n Respekt).
 * 5. Aufgaben je Mitglied (Regler wie die Sim "bester Regler"):
 *      - 'Train Combat', bis die mit den Terrorism-Gewichten gewichtete Stufe
 *        500 erreicht (Phase ist zustandslos aus den Stufen abgeleitet - ein
 *        Neustart verliert nichts);
 *      - danach 'Terrorism' als Respekt-Aufgabe;
 *      - 'Vigilante Justice' fuer die Arbeitenden mit dem kleinsten
 *        Respektbeitrag, solange wantedLevel > 1 und wantedPenalty < 0,95 und
 *        die gerechnete Wanted-Summe positiv ist.
 * 6. Aufstieg (`ascendMember`), wenn der Faktor aus `getAscensionResult`
 *    (gewichtetes geometrisches Mittel ueber die Stat-Gewichte der
 *    Respektaufgabe Terrorism) in der Trainingsphase >= 1,3 und in der
 *    Arbeitsphase >= 2 ist. Die Gewichte sind die der Sim; ein Faktor nur ueber
 *    die vier Kampfwerte lag in der Sim bei gleicher Schwelle schlechter
 *    (9,3 h statt 8,6 h bis 1,25 Mio, `gang-sim.mjs --combatonly`).
 *
 * ===========================================================================
 * FEHLER WERDEN GEZAEHLT, NICHT GESCHLUCKT
 * ===========================================================================
 *
 * Am 03.10.2026 lagen vier Black-Op-Aufrufe in blade.js seit Wochen tot, weil
 * ein try/catch den Fehler verschluckte. Deshalb: jeder Aufruf, der werfen
 * kann, laeuft ueber `tryCall()`, zaehlt in `errors.total`/`errors.byCall`,
 * setzt `lastError` und landet im Log. Eine Ausnahme der Rundenfunktion oder
 * des Wartens erhoeht `errStreak`; nach MAX_ERR_STREAK Runden in Folge beendet
 * sich das Werkzeug mit state "blocked" (der Kern startet es neu), statt
 * endlos weiterzufehlern.
 *
 * ===========================================================================
 * SCHLEIFENGRENZEN
 * ===========================================================================
 *
 * Am 03.10.2026 fror eine unbegrenzte `while`-Schleife den Spiel-Tab ein.
 * Hier hat jede Schleife eine feste Obergrenze: die Hauptschleife MAX_ROUNDS
 * (danach beendet sich das Werkzeug, der Kern startet es neu, die Gang bleibt
 * unberuehrt), das Rekrutieren MAX_MEMBERS, die Namenssuche 2 x MAX_MEMBERS.
 *
 * ===========================================================================
 * ABBRUCHKRITERIEN FUER DEN LIVEBETRIEB (verify-g01-betrieb.md, Paket 2)
 * ===========================================================================
 *
 *   vor dem Zuenden  Paket 0 (TRP-Falle) UND Paket 1 (Kauf am Tor) im Spiel,
 *                    Tests S1-S3 (P0) und S4-S6 (P1) in
 *                    tools/test-bn4rep-ebene2.js gruen, der Kern kennt
 *                    gang.js (Log "gang.js wartet: wartet auf
 *                    data/gang-an.txt", siehe SO WIRD EINGESCHALTET)
 *                    -> sonst KEIN data/gang-an.txt. Ein zu frueh gelegter
 *                    Schalter richtet nichts an (Sperre), aber er taeuscht
 *                    ueber den Stand.
 *   +10 min          data/gang.json frisch, inGang true, 3 Mitglieder,
 *                    createGang 1x im Log (data/gang-log.txt)
 *                    -> fehlt data/gang.json ganz: der Kern kennt gang.js
 *                       nicht, Kern neu starten (NICHT den Schalter wegnehmen);
 *                    -> blockedReason "prereq_missing": `prereq.missing` nennt
 *                       die fehlende Voraussetzung, Schalter bleibt liegen;
 *                    -> sonst Schalter weg, Log lesen.
 *   +2 h             >= 6 Mitglieder, Respekt steigt, penalty >= 0,9,
 *                    errors.total 0
 *                    -> penalty < 0,5 ueber 30 min oder errors.total > 0:
 *                       Schalter weg.
 *   bis zum Tor      bn4rep-Log ohne "GEKAUFT" bei aktiver Sperre
 *                    -> Kauf trotz Sperre: Paket 1 zurueck.
 *   am Tor           TRP nie in der Warteschlange; erstes Stueck = Planstueck;
 *                    Kosten <= Konto; Einbau binnen 2 Runden
 *                    -> TRP in der Schlange: sofort melden (nicht entfernbar).
 *   nach dem Einbau  gang.js binnen 5 min neu gestartet, Favor Slum Snakes > 0
 *                    -> Registry/Prioritaet pruefen.
 *
 * ===========================================================================
 * TELEMETRIE `data/gang.json`
 * ===========================================================================
 *
 * Pflichtfelder wie ARCHITEKTUR 4.1 (ts/wall, round, okRound, errStreak,
 * lastError, host, version, state, blockedReason) plus: inGang, faction,
 * isHacking, members, respect, factionRep, wanted, penalty, territory,
 * warfare, taskCounts, ascensions, recruits, errors {total, byCall},
 * createAttempts, lastCreateAt, lastCreate, updates, timeouts, prereq {ok,
 * missing[], at} (Ergebnis der letzten Voraussetzungspruefung; null, solange
 * nie geprueft wurde, etwa weil schon eine Gang da war). Der Kern
 * erschlaegt ein Werkzeug, dessen Telemetrie aelter als freshnessMs ist - sie
 * wird deshalb auch in den Warte- und Pausenzustaenden geschrieben (Rundentakt
 * hoechstens IDLE_SLEEP_MS bzw. UPDATE_TIMEOUT_MS). Leser: tools/checkin.js
 * ueber tools/lib/gangzeile.js (eine Zeile "GANG: ...").
 *
 * Feldnamen sind englisch (Projektregel). Die Namen aus der Bauvorgabe vom
 * 03.10.2026 heissen hier: zeit = ts/wall, mitglieder = members, faktionsRuf =
 * factionRep, aufgabenVerteilung = taskCounts, aufstiege = ascensions,
 * fehler = errors, gruendungVersuche = createAttempts, faktion = faction,
 * respekt = respect; inGang, wanted und penalty heissen unveraendert so.
 *
 * ===========================================================================
 * OFFENE PUNKTE (bewusst nicht entschieden, Skeptiker 03.10.2026)
 * ===========================================================================
 *
 * - Der Regler zielt allein auf RESPEKT. verify-g01-betrieb.md Abschnitt 6
 *   sagt aber, dass in Zyklus 1 das GELD bindet. Sim (Train Combat, 500/1,3/2,
 *   12 h): Respektmodus 2,67 Mio Ruf und 0 Geld, Mischmodus 0,38 Mio Ruf und
 *   132 Mrd Geld. Der Mittelweg "Respekt bis zum Rufbedarf der geplanten Runde
 *   (~1,25-1,6 Mio, nach ~8,6-9,6 h), danach Geldaufgaben" ist NICHT gerechnet
 *   und deshalb nicht gebaut. Er wuerde nebenbei die TRP-Schwelle (2,5 Mio)
 *   spaeter erreichen.
 * - Die Rufkurve ist ungeeicht (in keinem Backup gibt es eine echte Gang), RAM
 *   und createGang sind im Spiel noch nicht beobachtet.
 * - Nach einem Augmentierungs-Einbau sinken die Aufstiegspunkte auf 95 %
 *   (`Prestige.ts:130-143`), die Stufen also leicht: ein Arbeiter knapp ueber
 *   TRAIN_UNTIL kann kurz in die Trainingsphase zurueckfallen. Folgenlos, aber
 *   nicht gemessen.
 * - Der Leser fuer data/gang.json ist tools/lib/gangzeile.js (eine Zeile in
 *   tools/checkin.js, also in /bb); es gibt keinen weiteren Leser, etwa im
 *   Dashboard.
 *
 * @param {NS} ns
 */

import { liesVonHome, haengeAnHome } from "lib/hostdatei.js";

// --- Dateien und Namen --------------------------------------------------------
export const SWITCH_FILE = "data/gang-an.txt";
export const TELEMETRY_FILE = "data/gang.json";
export const LOG_FILE = "data/gang-log.txt";
const LOG_MAX_LINES = 300;

// --- Voraussetzungssperre (siehe Kopf: DIE VORAUSSETZUNGSSPERRE) ---------------
export const BN4REP_FILE = "data/bn4rep.json";
// 30 min = freshnessMs des bn4rep-Eintrags in der Registry: aelter gilt der
// Kern selbst bn4rep.js als tot.
export const PREREQ_MAX_AGE_MS = 30 * 60000;
// Felder, die NUR die neuen Fassungen von bn4rep.js in ihre Telemetrie schreiben.
export const PREREQ_P0_FIELD = "v1Positiv";   // Paket 0: Boolean, MUSS false sein
export const PREREQ_P1_FIELD = "gateBuy";     // Paket 1: Boolean, MUSS true sein
const VERSION = "gang-2";

/**
 * Kampf-Gang-Faktionen in Tie-Break-Reihenfolge (`Gang/data/Constants.ts:20-27`,
 * ohne NiteSec und The Black Hand - die gruenden Hacking-Gangs).
 */
export const COMBAT_FACTIONS = [
  "Slum Snakes",
  "Tetrads",
  "The Syndicate",
  "Speakers for the Dead",
  "The Dark Army",
];

export const TASK_TRAIN = "Train Combat";
export const TASK_WORK = "Terrorism";
export const TASK_JUSTICE = "Vigilante Justice";

// --- Regler-Parameter (Sim "bester Regler", gang-sim.mjs) ----------------------
export const TRAIN_UNTIL = 500;      // gewichtete Stufe, ab der gearbeitet wird
export const ASC_TRAIN = 1.3;        // Aufstiegsschwelle in der Trainingsphase
export const ASC_WORK = 2;           // Aufstiegsschwelle in der Arbeitsphase
export const WANTED_FLOOR = 0.95;    // darunter hilft Vigilante

// --- Takte und Grenzen ----------------------------------------------------------
export const CREATE_PAUSE_MS = 10 * 60000;  // Pause nach einem Gruendungsversuch (Wanduhr)
const IDLE_SLEEP_MS = 30000;         // Takt ohne Gang
const UPDATE_TIMEOUT_MS = 20000;     // Rueckfall, wenn nextUpdate nicht kommt
const ERROR_BACKOFF_MS = 5000;       // Pause nach einem Fehler beim Warten
const TELEMETRY_EVERY_MS = 10000;
export const MAX_ROUNDS = 20000;
export const MAX_ERR_STREAK = 30;
export const MAX_MEMBERS = 12;       // Gang/data/Constants.ts:12

export const STATS = ["hack", "str", "def", "dex", "agi", "cha"];

// --- Aufgabendaten (Gang/data/tasks.ts, Parameter wortgleich) ------------------
// w = Gewichte in Prozent. Nur die drei Aufgaben, die dieses Werkzeug setzt.
export const TASKS = {
  [TASK_TRAIN]: {
    baseRespect: 0, baseWanted: 0, difficulty: 100,
    w: { hack: 0, str: 25, def: 25, dex: 25, agi: 25, cha: 0 },
    territory: { respect: 1, wanted: 1 },
  },
  [TASK_WORK]: {
    baseRespect: 0.01, baseWanted: 6, difficulty: 36,
    w: { hack: 20, str: 20, def: 20, dex: 20, agi: 0, cha: 20 },
    territory: { respect: 2, wanted: 2 },
  },
  [TASK_JUSTICE]: {
    baseRespect: 0, baseWanted: -0.001, difficulty: 1,
    w: { hack: 20, str: 20, def: 20, dex: 20, agi: 20, cha: 0 },
    territory: { respect: 1, wanted: 0.9 },
  },
};

// ===========================================================================
// REINE FUNKTIONEN (ohne ns - testbar)
// ===========================================================================

/** Gewichtete Stufe nach den Gewichten einer Aufgabe. `lvl` = {hack, str, ...}. */
export function weightedLevel(task, lvl) {
  let sum = 0;
  for (const s of STATS) sum += (task.w[s] / 100) * (lvl[s] || 0);
  return sum;
}

/**
 * Trainings- oder Arbeitsphase, rein aus den Stufen (zustandslos).
 *
 * In der Sim ist `phase` ein Merker am Mitglied, der bei Erreichen der Stufe
 * auf "work" springt und nach einem Aufstieg zurueck auf "train". Der Merker
 * ist aus den Stufen ableitbar: Stufen sinken nur durch einen Aufstieg (die
 * Erfahrung wird geleert, die Stufe faellt auf ~den Aufstiegsmultiplikator),
 * und genau dann soll die Phase wieder "train" sein. Ableiten statt merken
 * heisst: ein Neustart von gang.js oder ein Handgriff im Spiel verliert nichts.
 */
export function phaseOf(lvl) {
  return weightedLevel(TASKS[TASK_WORK], lvl) >= TRAIN_UNTIL ? "work" : "train";
}

/**
 * Faktor des Aufstiegs: gewichtetes geometrisches Mittel der Einzelfaktoren
 * aus `getAscensionResult` ueber die Stat-Gewichte der Respektaufgabe
 * (gang-sim.mjs:56-59). Ungueltige Werte ergeben NaN - und NaN >= Schwelle
 * ist falsch, es wird also nicht aufgestiegen.
 */
export function ascensionFactor(result) {
  if (!result || typeof result !== "object") return NaN;
  const w = TASKS[TASK_WORK].w;
  let logSum = 0;
  let weightSum = 0;
  for (const s of STATS) {
    if (!(w[s] > 0)) continue;
    const r = Number(result[s]);
    if (!(r > 0) || !Number.isFinite(r)) return NaN;
    logSum += w[s] * Math.log(r);
    weightSum += w[s];
  }
  return weightSum > 0 ? Math.exp(logSum / weightSum) : NaN;
}

/** Soll aufgestiegen werden? Schwelle je Phase. */
export function shouldAscend(phase, result) {
  const factor = ascensionFactor(result);
  const threshold = phase === "train" ? ASC_TRAIN : ASC_WORK;
  return factor >= threshold;
}

/**
 * Respektgewinn je Zyklus (`Gang/formulas/formulas.ts:15-31`). `g` = {respect,
 * wantedLevel, territory}. Der Softcap des Knotens (BN2: 1) bleibt aussen vor:
 * er ist ein Exponent auf alle Mitglieder gleichermassen und aendert die
 * RANGFOLGE nicht, die hier allein gebraucht wird.
 */
export function respectGain(task, lvl, g) {
  if (task.baseRespect === 0) return 0;
  const sw = weightedLevel(task, lvl) - 4 * task.difficulty;
  if (sw <= 0) return 0;
  const territoryMult = Math.max(0.005, Math.pow(g.territory * 100, task.territory.respect) / 100);
  const penalty = g.respect / (g.respect + g.wantedLevel);
  const exponent = 0.2 * g.territory + 0.8;
  return Math.pow(11 * task.baseRespect * sw * territoryMult * penalty, exponent);
}

/** Wanted-Gewinn je Zyklus (`Gang/formulas/formulas.ts:33-54`). */
export function wantedGain(task, lvl, g) {
  if (task.baseWanted === 0) return 0;
  const sw = weightedLevel(task, lvl) - 3.5 * task.difficulty;
  if (sw <= 0) return 0;
  const territoryMult = Math.max(0.005, Math.pow(g.territory * 100, task.territory.wanted) / 100);
  if (!(territoryMult > 0)) return 0;
  if (task.baseWanted < 0) return 0.4 * task.baseWanted * sw * territoryMult;
  const calc = (7 * task.baseWanted) / Math.pow(3 * sw * territoryMult, 0.8);
  return Math.min(100, calc);
}

/**
 * Welche Faktion gruendet die Gang?
 *
 * @param {string[]} joined beigetretene Faktionen (`getPlayer().factions`)
 * @param {Object<string, number|null>} reps Ruf je Faktion; null/NaN = nicht lesbar
 * @returns {{faction: string|null, reason: string, candidates: string[]}}
 *   reason: "ok" | "no_faction" | "rep_unreadable"
 */
export function chooseFounder(joined, reps) {
  const joinedSet = new Set(Array.isArray(joined) ? joined : []);
  const candidates = COMBAT_FACTIONS.filter((f) => joinedSet.has(f));
  if (!candidates.length) return { faction: null, reason: "no_faction", candidates };
  let best = null;
  for (const f of candidates) {
    const rep = reps ? reps[f] : null;
    // Unlesbarer Ruf zaehlt NICHT als 0: eine Gruendung ist unumkehrbar, und
    // sie nullt den Ruf der gewaehlten Faktion. Im Zweifel nicht gruenden -
    // und zwar auch dann nicht, wenn ein ANDERER Kandidat lesbar ist: die
    // unlesbare Faktion koennte die mit dem kleinsten Ruf sein, und die
    // lesbare koennte viel Ruf haben, der mit der Gruendung verfaellt
    // (Skeptiker 03.10.2026: Kommentar und Code sagten Verschiedenes, der
    // Code uebersprang nur die betroffene Faktion).
    if (typeof rep !== "number" || !Number.isFinite(rep)) {
      return { faction: null, reason: "rep_unreadable", candidates, unreadable: f };
    }
    if (best === null || rep < best.rep) best = { f, rep };
  }
  return { faction: best.f, reason: "ok", candidates };
}

/**
 * Sind Paket 0 (TRP-Falle zu) und Paket 1 (Kauf bis zum Tor aufgeschoben) im
 * Spiel LIVE? Die maschinelle Sperre vor `createGang` (siehe Kopf).
 *
 * Reine Funktion: alles Gelesene kommt als Argument, damit sie ohne ns testbar
 * ist. Sie sammelt ALLE Maengel in `missing` (nicht beim ersten Halt), damit die
 * Telemetrie dem Menschen auf einen Blick sagt, was fehlt.
 *
 * @param {object|null} tel geparste data/bn4rep.json; null = fehlt/unlesbar
 * @param {number} nowMs Wanduhr (Date.now)
 * @param {{currentNode:number, lastNodeReset:number}|null} reset getResetInfo
 * @returns {{ok:boolean, missing:string[]}}
 */
export function checkPrereq(tel, nowMs, reset) {
  if (!tel || typeof tel !== "object" || Array.isArray(tel)) {
    return { ok: false, missing: [BN4REP_FILE + " fehlt oder ist unlesbar (bn4rep.js laeuft nicht?)"] };
  }
  const missing = [];

  // 1. Frische. Dieselbe Zeitfeld-Reihenfolge wie der Kern (bn4net.js, Zaehlwerk
  //    der Registry): bn4rep.js schreibt `zeit`, Herzschlagbloecke `ts`/`wall`.
  const at = [tel.zeit, tel.ts, tel.wall].find((x) => Number.isFinite(x));
  if (at === undefined) {
    missing.push(BN4REP_FILE + " ohne Zeitstempel");
  } else {
    const age = nowMs - at;
    if (age < -60000) missing.push(BN4REP_FILE + " stammt aus der Zukunft (" + Math.round(-age / 1000) + " s) - Uhrensprung?");
    else if (age > PREREQ_MAX_AGE_MS) missing.push(BN4REP_FILE + " veraltet (" + Math.round(age / 60000) + " min, Grenze "
      + Math.round(PREREQ_MAX_AGE_MS / 60000) + ") - bn4rep.js laeuft nicht");
  }

  // 2. Gehoert die Datei zu DIESEM Knoteneintritt? Die Knotennummer allein
  //    reicht nicht (Level 2 desselben Knotens), `nodeReset` trennt die Eintritte.
  if (!reset || !Number.isFinite(reset.currentNode) || !Number.isFinite(reset.lastNodeReset)) {
    missing.push("getResetInfo nicht lesbar - Knoteneintritt nicht pruefbar");
  } else if (tel.knoten !== reset.currentNode || tel.nodeReset !== reset.lastNodeReset) {
    missing.push(BN4REP_FILE + " gehoert nicht zu diesem Knoteneintritt (knoten " + String(tel.knoten)
      + " gegen " + reset.currentNode + ", nodeReset " + String(tel.nodeReset) + " gegen " + reset.lastNodeReset + ")");
  }

  // 3. Paket 0. Ein fehlendes Feld heisst: die alte bn4rep.js laeuft noch.
  const p0 = tel[PREREQ_P0_FIELD];
  if (typeof p0 !== "boolean") {
    missing.push("Paket 0 nicht live: Feld " + PREREQ_P0_FIELD + " fehlt in " + BN4REP_FILE);
  } else if (p0 === true) {
    missing.push("Paket 0 greift hier nicht: " + PREREQ_P0_FIELD + " ist true (The Red Pill waere Kaufkandidat)");
  }

  // 4. Paket 1.
  if (tel[PREREQ_P1_FIELD] !== true) {
    missing.push("Paket 1 nicht live: Feld " + PREREQ_P1_FIELD + " fehlt oder ist nicht true in " + BN4REP_FILE);
  }

  return { ok: missing.length === 0, missing };
}

/**
 * Uhrzeit in ORTSZEIT (HH:MM:SS) fuer die Logzeilen. Hier stand
 * `toISOString().slice(11, 19)` - das ist UTC und weicht in Erics Zeitzone um
 * zwei Stunden von der Uhr ab, nach der er das Log liest.
 */
export function localStamp(d) {
  const p = (n) => String(n).padStart(2, "0");
  return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
}

/**
 * Die Aufgabenwahl einer Runde.
 *
 * @param {{respect:number, wantedLevel:number, wantedPenalty:number, territory:number}} g
 * @param {{name:string, task:string, lvl:object, ascended?:boolean}[]} members
 *   `ascended`: in dieser Runde aufgestiegen - die Stufen sind veraltet, die
 *   Phase ist "train" (Stufe nach Aufstieg ~ Aufstiegsmultiplikator)
 * @returns {{assign: Object<string,string>, phases: Object<string,string>,
 *            counts: Object<string,number>, justice: number, wantedSum: number}}
 */
export function planTasks(g, members) {
  const assign = {};
  const phases = {};
  for (const m of members) {
    const phase = m.ascended ? "train" : phaseOf(m.lvl);
    phases[m.name] = phase;
    assign[m.name] = phase === "train" ? TASK_TRAIN : TASK_WORK;
  }

  // Wanted-Regler (gang-sim.mjs:84-97). Bei wanted == 1 senkt Vigilante nichts
  // (Gang.ts:157-166), und bei respect ~ 1 ist die Strafe von Haus aus 0,5 -
  // ohne die Bedingung wantedLevel > 1 liefe der Regler im Anlauf Amok.
  let justice = 0;
  let wantedSum = 0;
  if (g.wantedLevel > 1 && g.wantedPenalty < WANTED_FLOOR) {
    const working = members.filter((m) => assign[m.name] === TASK_WORK);
    for (const m of working) wantedSum += wantedGain(TASKS[TASK_WORK], m.lvl, g);
    // Die mit dem kleinsten Respektbeitrag zuerst - sie kosten am wenigsten.
    working.sort((a, b) => {
      const d = respectGain(TASKS[TASK_WORK], a.lvl, g) - respectGain(TASKS[TASK_WORK], b.lvl, g);
      return d !== 0 ? d : (a.name < b.name ? -1 : 1);
    });
    for (const m of working) {
      if (!(wantedSum > 0)) break;
      wantedSum -= wantedGain(TASKS[TASK_WORK], m.lvl, g);
      wantedSum += wantedGain(TASKS[TASK_JUSTICE], m.lvl, g);
      assign[m.name] = TASK_JUSTICE;
      justice++;
    }
  }

  const counts = {};
  for (const m of members) counts[assign[m.name]] = (counts[assign[m.name]] || 0) + 1;
  return { assign, phases, counts, justice, wantedSum };
}

/** Der erste freie Name G01..G24 (hoechstens 2 x MAX_MEMBERS Versuche). */
export function freeName(taken) {
  const set = new Set(taken);
  for (let i = 1; i <= 2 * MAX_MEMBERS; i++) {
    const name = "G" + String(i).padStart(2, "0");
    if (!set.has(name)) return name;
  }
  return null;
}

// ===========================================================================
// DAS WERKZEUG
// ===========================================================================

export async function main(ns) {
  ns.disableLog("ALL");

  const st = {
    round: 0, okRound: 0, errStreak: 0, lastError: null,
    state: "wait", blockedReason: null,
    errors: { total: 0, byCall: {} },
    roundErrors: 0,
    prereq: null, prereqSig: null,
    createAttempts: 0, lastCreateAt: 0, lastCreate: null,
    ascensions: 0, recruits: 0, updates: 0, timeouts: 0,
    inGang: false, faction: null, isHacking: false, members: 0,
    respect: 0, factionRep: null, wanted: 0, penalty: 0, territory: 0, warfare: false,
    taskCounts: {}, playtime: 0, lastWrite: 0,
  };

  const sag = (text) => {
    ns.print(text);
    // Date.now() statt "new Date()": gleiche Uhr wie alles andere hier (und im
    // Test die gestellte). Ortszeit, nicht UTC - siehe localStamp().
    const stamp = localStamp(new Date(Date.now()));
    if (!haengeAnHome(ns, LOG_FILE, stamp + "  " + text + "\n", LOG_MAX_LINES)) {
      // Kein Rueckkanal verfuegbar: nur zaehlen, nicht erneut loggen (sonst
      // Rekursion ueber noteError).
      st.errors.total++;
      st.errors.byCall.log = (st.errors.byCall.log || 0) + 1;
    }
  };

  /** Fehler zaehlen, merken, (gedrosselt) loggen. Nie still. */
  const noteError = (label, e) => {
    const msg = String(e && e.message ? e.message : e);
    st.errors.total++;
    st.errors.byCall[label] = (st.errors.byCall[label] || 0) + 1;
    st.roundErrors++;
    st.lastError = { cls: (e && e.name) || "Error",
      msg: msg.length > 200 ? msg.slice(0, 197) + "..." : msg, at: Date.now(), call: label };
    // Das erste Auftreten je Aufruf sofort, danach jedes 50.
    const n = st.errors.byCall[label];
    if (n === 1 || n % 50 === 0) sag("FEHLER " + label + " (" + n + "x): " + msg);
  };

  /** Ein Aufruf, der werfen kann: Ergebnis oder Fehlerzaehlung. */
  const tryCall = (label, fn) => {
    try {
      return { ok: true, value: fn() };
    } catch (e) {
      noteError(label, e);
      return { ok: false, value: undefined };
    }
  };

  const switchOn = () => {
    const r = tryCall("switch", () => ns.fileExists(SWITCH_FILE, "home"));
    // Nicht lesbar heisst: weiterlaufen. Ein Lesefehler ist kein Befehl zum
    // Aufhoeren, und er ist gezaehlt.
    return r.ok ? r.value === true : true;
  };

  const writeTelemetry = (force) => {
    const now = Date.now();
    if (!force && now - st.lastWrite < TELEMETRY_EVERY_MS) return;
    st.lastWrite = now;
    const p = tryCall("player", () => ns.getPlayer());
    if (p.ok && p.value && Number.isFinite(p.value.totalPlaytime)) st.playtime = p.value.totalPlaytime;
    if (st.inGang && st.faction) {
      const r = tryCall("factionRep", () => ns.singularity.getFactionRep(st.faction));
      if (r.ok) st.factionRep = r.value;
    }
    const block = {
      schema: 2, ts: now, wall: now, playtime: st.playtime, motorTimeMs: 0,
      round: st.round, okRound: st.okRound,
      errStreak: st.errStreak, lastError: st.lastError,
      host: ns.getHostname(), version: VERSION,
      state: st.state, blockedReason: st.blockedReason,
      inGang: st.inGang, faction: st.faction, isHacking: st.isHacking,
      members: st.members, respect: st.respect, factionRep: st.factionRep,
      wanted: st.wanted, penalty: st.penalty, territory: st.territory,
      warfare: st.warfare, taskCounts: st.taskCounts,
      ascensions: st.ascensions, recruits: st.recruits,
      errors: st.errors,
      createAttempts: st.createAttempts, lastCreateAt: st.lastCreateAt,
      lastCreate: st.lastCreate,
      updates: st.updates, timeouts: st.timeouts,
      prereq: st.prereq,
    };
    // Selbst geschrieben statt `nachHome()` aus lib/hostdatei.js: dessen
    // try/catch gibt bei einer Ausnahme nur false zurueck und verliert die
    // Ursache. Hier landet sie in lastError (tryCall). Das Muster ist dasselbe:
    // lokal schreiben, von einem Fremdwirt nach home kopieren (`ns.scp` WIRFT
    // nicht, wenn die Quelle fehlt - nur der Rueckgabewert sagt etwas).
    const host = ns.getHostname();
    const done = tryCall("telemetry", () => {
      ns.write(TELEMETRY_FILE, JSON.stringify(block), "w");
      return host === "home" ? true : ns.scp(TELEMETRY_FILE, "home", host) === true;
    });
    if (done.ok && done.value !== true) {
      // Die Zaehlung selbst geht in den naechsten Block ein.
      st.errors.total++;
      st.errors.byCall.telemetry = (st.errors.byCall.telemetry || 0) + 1;
    }
  };

  // --- Die Pause nach einem Gruendungsversuch ueberlebt einen Neustart ---------
  {
    const roh = liesVonHome(ns, TELEMETRY_FILE);
    if (roh) {
      try {
        const alt = JSON.parse(roh);
        const t = Number(alt && alt.lastCreateAt);
        // Ein Zeitstempel aus der Zukunft (Uhrenwechsel, Fremdschreiber) gilt nicht.
        if (Number.isFinite(t) && t > 0 && t <= Date.now()) {
          st.lastCreateAt = t;
          st.lastCreate = alt.lastCreate || null;
        }
      } catch (e) {
        noteError("telemetry_read", e);
      }
    }
  }

  sag("gang.js gestartet auf " + ns.getHostname() + " (" + VERSION + ").");

  // --- Voraussetzungssperre ----------------------------------------------------
  /**
   * Liest data/bn4rep.json und getResetInfo und fragt checkPrereq. Das Ergebnis
   * steht in st.prereq (Telemetrie). Die Logzeile kommt nur, wenn sich der
   * Befund aendert - foundGang() laeuft im 30-s-Takt, ein Dauerlog wuerde das
   * 300-Zeilen-Log in zweieinhalb Stunden fuellen.
   * @returns {boolean} true = alle Voraussetzungen da
   */
  const prereqOk = () => {
    const roh = liesVonHome(ns, BN4REP_FILE);
    let tel = null;
    if (roh) {
      // Eine nicht lesbare Datei zaehlt als Fehler (nicht still): bn4rep.js
      // schreibt sie in einem Zug, ein halber Block waere ein Befund.
      try { tel = JSON.parse(roh); } catch (e) { noteError("bn4rep_parse", e); }
    }
    const ri = tryCall("resetInfo", () => ns.getResetInfo());
    const res = checkPrereq(tel, Date.now(), ri.ok ? ri.value : null);
    st.prereq = { ok: res.ok, missing: res.missing, at: Date.now() };
    // Die Signatur ohne Ziffern: "veraltet (31 min)" wird minuetlich zu "(32
    // min)", und das ist derselbe Befund, keine neue Zeile wert.
    const sig = res.ok ? "ok" : res.missing.map((m) => m.replace(/\d+/g, "#")).join(" | ");
    if (sig !== st.prereqSig) {
      st.prereqSig = sig;
      sag(res.ok
        ? "Voraussetzungen erfuellt (Paket 0 und Paket 1 live, " + BN4REP_FILE + " frisch)."
        : "GRUENDUNG GESPERRT: " + res.missing.join(" | "));
    }
    return res.ok;
  };

  // --- Gruendung ---------------------------------------------------------------
  /** @returns {boolean} ob jetzt eine Gang da ist */
  const foundGang = () => {
    st.state = "wait";
    const now = Date.now();
    const pauseLeft = CREATE_PAUSE_MS - (now - st.lastCreateAt);
    if (st.lastCreateAt > 0 && pauseLeft > 0) {
      st.blockedReason = "create_pause";
      return false;
    }
    // DIE SPERRE VOR DEM UNUMKEHRBAREN SCHRITT. Fehlt etwas, wird weder
    // gegruendet noch ein Versuch gezaehlt: keine Pause, die Voraussetzung
    // wird im naechsten Takt wieder geprueft.
    if (!prereqOk()) {
      st.blockedReason = "prereq_missing";
      return false;
    }
    const p = tryCall("player", () => ns.getPlayer());
    if (!p.ok || !p.value) { st.blockedReason = "player_unreadable"; return false; }
    const joined = Array.isArray(p.value.factions) ? p.value.factions : [];
    const reps = {};
    for (const f of COMBAT_FACTIONS) {
      if (!joined.includes(f)) continue;
      const r = tryCall("factionRep", () => ns.singularity.getFactionRep(f));
      reps[f] = r.ok ? r.value : null;
    }
    const pick = chooseFounder(joined, reps);
    if (!pick.faction) {
      st.blockedReason = pick.reason;
      return false;
    }
    const detail = pick.candidates.map((f) => f + "=" + reps[f]).join(", ");
    // GENAU EIN Aufruf. Zaehler und Marke stehen im Speicher VOR dem Ergebnis
    // (also auch dann, wenn createGang wirft); GESCHRIEBEN werden sie erst
    // nach dem Aufruf (writeTelemetry weiter unten) - ein Kill trifft ohnehin
    // erst am naechsten ns-Aufruf, und ein wiederholtes createGang waere
    // folgenlos (mit Gang gibt es false, ohne Gang laeuft die Pruefung neu).
    st.createAttempts++;
    st.lastCreateAt = Date.now();
    const call = tryCall("createGang", () => ns.gang.createGang(pick.faction));
    const ok = call.ok && call.value === true;
    st.lastCreate = { faction: pick.faction, ok, at: st.lastCreateAt, candidates: detail };
    sag("GRUENDUNG #" + st.createAttempts + ": Kandidaten " + detail + " -> " + pick.faction
      + "; createGang -> " + (call.ok ? String(call.value) : "Fehler"));
    if (!ok) {
      st.blockedReason = "create_failed";
      writeTelemetry(true);
      return false;
    }
    st.blockedReason = null;
    writeTelemetry(true);
    return true;
  };

  // --- Fuehrung ----------------------------------------------------------------
  const manageGang = () => {
    const infoCall = tryCall("getGangInformation", () => ns.gang.getGangInformation());
    if (!infoCall.ok || !infoCall.value) { st.blockedReason = "info_unreadable"; return; }
    const info = infoCall.value;
    st.faction = info.faction;
    st.isHacking = info.isHacking === true;
    st.respect = info.respect;
    st.wanted = info.wantedLevel;
    st.penalty = info.wantedPenalty;
    st.territory = info.territory;
    st.warfare = info.territoryWarfareEngaged === true;

    // Eine Hacking-Gang kennt 'Terrorism' nicht. setMemberTask auf einen
    // unbekannten Namen setzt das Mitglied auf "Unassigned" und MELDET DABEI
    // true (`NetscriptFunctions/Gang.ts`, setMemberTask: der Zweig "Invalid
    // task" gibt das Ergebnis von assignToTask("Unassigned") zurueck) - ohne
    // diese Sperre stuenden alle Mitglieder still untaetig. Fuehrung nur fuer
    // Kampfgangs.
    if (st.isHacking) {
      st.state = "blocked";
      st.blockedReason = "hacking_gang";
      return;
    }
    st.state = "work";
    st.blockedReason = null;

    const namesCall = tryCall("getMemberNames", () => ns.gang.getMemberNames());
    if (!namesCall.ok || !Array.isArray(namesCall.value)) return;
    const names = namesCall.value.slice(0, MAX_MEMBERS);

    // Rekrutieren, solange der Respekt reicht.
    for (let i = 0; i < MAX_MEMBERS; i++) {
      if (names.length >= MAX_MEMBERS) break;
      const can = tryCall("canRecruitMember", () => ns.gang.canRecruitMember());
      if (!can.ok || can.value !== true) break;
      const name = freeName(names);
      if (!name) break;
      const rec = tryCall("recruitMember", () => ns.gang.recruitMember(name));
      if (!rec.ok) break;
      if (rec.value !== true) {
        noteError("recruitMember", new Error("recruitMember(" + name + ") gab " + String(rec.value)));
        break;
      }
      names.push(name);
      st.recruits++;
      sag("REKRUTIERT " + name + " (" + names.length + " Mitglieder, Respekt "
        + Math.round(info.respect) + ").");
    }
    st.members = names.length;

    // Mitgliederdaten lesen; ein nicht lesbares Mitglied wird diese Runde
    // uebersprungen (keine Aufgabenaenderung auf Verdacht).
    const members = [];
    for (const name of names) {
      const mi = tryCall("getMemberInformation", () => ns.gang.getMemberInformation(name));
      if (!mi.ok || !mi.value) continue;
      const lvl = {};
      for (const s of STATS) lvl[s] = mi.value[s];
      members.push({ name, task: mi.value.task, lvl, ascended: false });
    }

    // Aufstieg. Die Phase kommt aus den Stufen VOR dem Aufstieg.
    for (const m of members) {
      const phase = phaseOf(m.lvl);
      const res = tryCall("getAscensionResult", () => ns.gang.getAscensionResult(m.name));
      if (!res.ok || !res.value) continue;       // undefined = noch nicht aufsteigbar
      if (!shouldAscend(phase, res.value)) continue;
      const asc = tryCall("ascendMember", () => ns.gang.ascendMember(m.name));
      if (!asc.ok) continue;
      m.ascended = true;
      st.ascensions++;
      sag("AUFSTIEG " + m.name + " (" + phase + ", Faktor "
        + ascensionFactor(res.value).toFixed(2) + ", #" + st.ascensions + ").");
    }

    const g = { respect: info.respect, wantedLevel: info.wantedLevel,
      wantedPenalty: info.wantedPenalty, territory: info.territory };
    const plan = planTasks(g, members);
    for (const m of members) {
      const want = plan.assign[m.name];
      if (m.task === want) continue;
      const set = tryCall("setMemberTask", () => ns.gang.setMemberTask(m.name, want));
      if (set.ok && set.value !== true) {
        noteError("setMemberTask", new Error("setMemberTask(" + m.name + ", " + want + ") gab "
          + String(set.value)));
      }
    }
    st.taskCounts = plan.counts;
  };

  // --- Warten ------------------------------------------------------------------
  const waitUpdate = async () => {
    try {
      // ns.asleep ist von der Nebenlaeufigkeitspruefung ausgenommen und setzt
      // runningFn nicht; nextUpdate setzt es ebenfalls nicht. Der Rueckfall
      // haelt die Schleife (und die Telemetrie) am Leben, wenn der Takt steht.
      const winner = await Promise.race([
        Promise.resolve(ns.gang.nextUpdate()).then(() => "update"),
        Promise.resolve(ns.asleep(UPDATE_TIMEOUT_MS)).then(() => "timeout"),
      ]);
      if (winner === "update") st.updates++; else st.timeouts++;
      return true;
    } catch (e) {
      noteError("nextUpdate", e);
      return false;
    }
  };

  // --- Hauptschleife -----------------------------------------------------------
  for (let round = 0; round < MAX_ROUNDS; round++) {
    st.round = round + 1;
    st.roundErrors = 0;

    if (!switchOn()) {
      st.state = "done";
      st.blockedReason = "switch_off";
      writeTelemetry(true);
      sag("Schalter " + SWITCH_FILE + " fehlt - beende die Steuerung (die Gang laeuft weiter).");
      return;
    }

    let threw = false;
    try {
      st.inGang = ns.gang.inGang() === true;
      if (!st.inGang) {
        st.faction = null;
        st.members = 0;
        if (foundGang()) st.inGang = ns.gang.inGang() === true;
      }
      if (st.inGang) manageGang();
    } catch (e) {
      threw = true;
      noteError("round", e);
    }

    writeTelemetry(false);

    // Warten. Mit Gang am Gang-Takt, ohne Gang im 30-s-Takt.
    let waitFailed = false;
    if (st.inGang) waitFailed = !(await waitUpdate());
    else await ns.sleep(IDLE_SLEEP_MS);

    // errStreak zaehlt Runden in Folge, in denen die Rundenfunktion ODER das
    // Warten eine Ausnahme warf. Einzelne fehlgeschlagene Aufrufe (tryCall)
    // erhoehen nur errors.* - die Steuerung laeuft mit dem Rest weiter.
    if (threw || waitFailed) st.errStreak++;
    else st.errStreak = 0;
    if (!threw && !waitFailed && st.roundErrors === 0) st.okRound++;

    if (st.errStreak >= MAX_ERR_STREAK) {
      st.state = "blocked";
      st.blockedReason = "err_streak";
      writeTelemetry(true);
      sag("ABBRUCH: " + st.errStreak + " Runden in Folge mit Ausnahme - beende mich, der Kern startet neu.");
      return;
    }
    // Nach einem fehlgeschlagenen Warten kurz atmen, statt im Fehlerfall im
    // Kreis zu rennen (nextUpdate wirft ohne Gang sofort).
    if (waitFailed) await ns.sleep(ERROR_BACKOFF_MS);
  }

  // MAX_ROUNDS erreicht: sauber beenden, der Kern startet neu.
  st.state = "done";
  st.blockedReason = "max_rounds";
  writeTelemetry(true);
  sag("MAX_ROUNDS erreicht - beende mich zum Neustart durch den Kern.");
}
