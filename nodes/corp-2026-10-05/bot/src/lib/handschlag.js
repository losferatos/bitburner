/**
 * Der Handschlag vor Einbau und Sprung.
 *
 * ===========================================================================
 * WOZU
 * ===========================================================================
 *
 * Zwei Handlungen dieses Bots sind unwiderruflich: der Augmentierungs-Einbau
 * (`installAugmentations`) und der Knotenwechsel (`exec("exit.js")`). Beide
 * setzen den Spielstand zurueck. Geht dabei etwas schief, ist der einzige Weg
 * zurueck eine Sicherung - und die muss VON DIESEM Augenblick sein, nicht von
 * der letzten vollen Stunde.
 *
 * Auftrag 7.2 verlangt dafuer einen Handschlag: das Skript im Spiel legt
 * `data/backup-request.txt` ab, die Bruecke sichert, prueft und antwortet mit
 * `data/backup-ok.txt`. Das Skript wartet hoechstens 90 Sekunden darauf.
 *
 * DIE BRUECKENSEITE STAND SEIT DEM 04.09.2026 FRUEH (`sync/bridge.js`,
 * `pruefeHandschlag`), die SPIELSEITE NICHT. Ein Skeptiker hat es gefunden:
 * `grep -rn "backup-request" src/` war leer. Damit entstanden die beiden
 * Sicherungsklassen, die als einzige NIE rotiert werden - `pre-install` und
 * `pre-jump` -, ueberhaupt nie. Die drei unwiderruflichen Stellen feuerten
 * ungesichert.
 *
 * ===========================================================================
 * WAS BEI EINEM FEHLSCHLAG GILT - UND WARUM ES SICH UNTERSCHEIDET
 * ===========================================================================
 *
 * Kommt keine Antwort, entscheidet das Alter der letzten gruenen Sicherung
 * (`data/bridge.json`, `lastVerifiedBackup`):
 *
 *   juenger als 6 h  ->  beide handeln, mit einem Vermerk im Ereignisstrom.
 *   aelter oder weg  ->  DER SPRUNG HANDELT TROTZDEM, DER EINBAU NICHT.
 *
 * Das ist keine Inkonsequenz, sondern die Rechnung dahinter: Ein offener
 * Ausgang kostet laufend Zeit - der Knoten ist erledigt, jede weitere Stunde
 * darin ist verloren. Ein Einbau dagegen ist beliebig oft nachholbar; er
 * wartet nichts weg. Der Verlust bei einem Fehlgriff betraegt in beiden
 * Faellen Tage.
 *
 * Deshalb setzt der Einbau `data/install-sperre.txt` und wartet, der Sprung
 * geht.
 *
 * ===========================================================================
 * KOSTEN
 * ===========================================================================
 *
 * GEMESSEN AM 22.09.2026 mit tools/ram.js, nicht geschaetzt:
 *
 *     lib/handschlag.js isoliert   2,35 GB
 *       davon baseCost             1,60
 *       getHostname                0,05
 *       scp                        0,60
 *       fileExists                 0,10
 *     ------------------------------------
 *     eigener ns-Anteil            0,75 GB
 *
 * ABER: der AUFSCHLAG in den Gewerken ist NULL. Gemessen, indem der
 * handschlag-Import durch Stubs ersetzt und neu gerechnet wurde:
 *
 *     ausgang.js   8,15 -> 8,15    Delta 0,00
 *     bn4rep.js  850,75 -> 850,75  Delta 0,00
 *     punish.js   83,35 -> 83,35   Delta 0,00
 *
 * Der Grund steht in lib/hostdatei.js:61-63: Bitburner bildet die
 * Vereinigungsmenge ueber den Modulgraphen, und alle drei Gewerke rufen
 * fileExists, scp und getHostname ohnehin selbst auf. Wer dieses Modul
 * einbindet, zahlt dafuer also nichts extra.
 *
 * `ns.read` und `ns.write` kosten null.
 *
 * HIER STAND BIS ZUM 22.09.2026 das Gegenteil: fileExists werde nicht
 * benutzt, das Modul sei gratis. Seit dem 04.09. kommt es ueber
 * lib/hostdatei.js herein, der Satz war also stale. Der erste Versuch,
 * ihn zu berichtigen, nannte 0,70 GB (getHostname vergessen) und
 * behauptete, bei bn4rep.js sei das kein Detail - auch das war falsch,
 * der Aufschlag ist dort exakt null. Beide Zahlen stehen jetzt gemessen
 * da. Wer sie aendert, misst vorher.
 */

import { liesVonHome, nachHome } from "lib/hostdatei.js";


/** Wo die beiden Dateien liegen. Beide auf home, beide vom Kern geraeumt. */
export const ANFRAGE = "data/backup-request.txt";
export const ANTWORT = "data/backup-ok.txt";

/** Wie lange gewartet wird. Auftrag 7.2: hoechstens 90 s. */
export const WARTE_MAX_MS = 90000;

/** Ab wann eine vorhandene Sicherung als zu alt gilt. */
export const SICHERUNG_MAX_MS = 6 * 3600000;

/**
 * Die Anfrage stellen.
 *
 * @param {NS} ns
 * @param {"install"|"jump"} reason
 * @param {string} target was danach passiert - fuer das Protokoll
 * @param {number} nodeReset damit eine Anfrage aus einem anderen Lauf auffaellt
 * @returns {number} der Zeitstempel der Anfrage
 */
export function stelle(ns, reason, target, nodeReset) {
  const ts = Date.now();
  // NACH HOME, NICHT LOKAL (22.09.2026). Die Bruecke liest die Anfrage mit
  // server: "home" (sync/bridge.js:1874). ausgang.js laeuft aber fast nie
  // auf home - am 22.09. lag es auf fulcrumtech, und dort lag auch die
  // Anfrage. Die Bruecke hat sie deshalb NIE gesehen: im Brueckenlog steht
  // seit Bestehen kein einziger "jump"-Handschlag, und eine pre-jump-
  // Sicherung gab es nie - genau die Klasse, die nie rotiert wird.
  // Der Einbau lief nur dann, wenn sein Gewerk GERADE auf home sass -
  // bn4rep.js hat hostRule "werkbank" und wandert ebenfalls. Beim letzten
  // geglueckten install-Handschlag (22.09. 02:14) lag es auf home,
  // seither auf fulcrumtech, und seither steht auch kein install-
  // Handschlag mehr im Brueckenlog. Es sind also nicht 26 gelungene
  // Einbau-Handschlaege gegen 0 Sprung-Handschlaege, weil der Einbau
  // anders gebaut waere - beide haengen am selben Zufall.
  nachHome(ns, ANFRAGE, JSON.stringify({ reason, target, ts, nodeReset }));
  return ts;
}

/**
 * Liegt eine Antwort vor, die zu DIESER Anfrage gehoert?
 *
 * Der Vergleich ist `>=`, nicht `>`: die Bruecke setzt ihren eigenen
 * Zeitstempel beim Antworten, und der liegt immer nach der Anfrage. Ein
 * `>` waere trotzdem richtig - aber eine Antwort mit exakt gleichem
 * Millisekundenwert waere ein Fehlschlag ohne Grund.
 *
 *
 * DER ANLASS MUSS PASSEN (22.09.2026).
 *
 * install (bn4rep) und jump (ausgang) teilen sich dieselben zwei
 * Dateien. Geprueft wurde nur der Zeitstempel - eine pre-install-Antwort
 * galt damit auch als Beleg fuer eine pre-jump-Sicherung - ein Sprung
 * haette sich an einer Sicherung festgehalten, die fuer einen Einbau
 * gemacht wurde, mit anderem Zeitpunkt und anderem Zweck. (Die fruehere
 * Begruendung, sync/backup.js mache pre-jump bei wartenden Augs rot, gilt
 * seit dem 22.09. abends nicht mehr - die Regel ist gestrichen.) Die
 * Bruecke prueft den Anlass inzwischen auch auf ihrer Seite.
 *
 * Seit dem 22.09. landet die Anfrage ueberhaupt erst zuverlaessig auf
 * home - vorher lag sie auf dem Wirt und die Bruecke sah sie nie. Damit
 * wird diese Verwechslung von einer Theorie zu einer Moeglichkeit.
 *
 * @param {NS} ns
 * @param {number} anfrageTs
 * @param {"install"|"jump"} [reason] wenn gesetzt, muss die Antwort dazu passen
 * @returns {object|null} die Antwort, oder null
 */
export function antwortDa(ns, anfrageTs, reason) {
  try {
    // VON HOME, NICHT LOKAL (22.09.2026). Gegenstueck zu stelle(): die
    // Bruecke legt die Antwort auf home ab (sync/bridge.js:1899). Ein
    // ns.read haette sie auf einem Fremdwirt nie gefunden, also waere der
    // Handschlag auch mit richtiger Anfrage in die 90 s gelaufen.
    const roh = liesVonHome(ns, ANTWORT);
    if (!roh) return null;
    const a = JSON.parse(roh);
    if (!a || !Number.isFinite(a.ts) || a.ts < anfrageTs) return null;
    // Die Bruecke schreibt den Anlass, nicht den Grund: install ->
    // "pre-install", alles andere -> "pre-jump" (sync/bridge.js:1893).
    if (reason) {
      const erwartet = reason === "install" ? "pre-install" : "pre-jump";
      if (a.anlass && a.anlass !== erwartet) return null;
    }
    return a;
  } catch {
    return null;
  }
}

/**
 * Wie alt ist die letzte gruene Sicherung? In Millisekunden Wanduhr.
 *
 * @param {NS} ns
 * @returns {number|null} null heisst: die Bruecke hat es nie gemeldet
 */
export function sicherungsAlterMs(ns) {
  try {
    // ===================================================================
    // ZWEI FEHLER, DIE SICH GEGENSEITIG VERDECKT HABEN (04.09.2026)
    // ===================================================================
    //
    // (1) FALSCHES FELD. Hier stand `Date.parse(lv.zeit || lv.at)` - beide
    //     Felder gibt es nicht. Die Bruecke schreibt
    //     `{file, ts, ageMin, anlass}` mit `ts` als ISO-STRING
    //     (sync/bridge.js, `ts: new Date().toISOString()`).
    //     `Number.isFinite` auf einem String ist falsch, also lief es in
    //     den Fallback, und der bekam `undefined`. `Date.parse(undefined)`
    //     ist NaN.
    //
    // (2) FALSCHER ORT. `ns.read` liest vom EIGENEN Rechner, und
    //     `data/bridge.json` liegt nur auf home. Die Nutzer dieser
    //     Bibliothek - `bn4rep.js`, `ausgang.js`, `punish.js` - laufen
    //     auf der Werkbank.
    //
    // Beide zusammen hiessen: diese Funktion gab IMMER null zurueck. Damit
    // war `jung` in `handschlag()` immer falsch, und der Zweig "Bruecke
    // antwortet nicht, aber die Sicherung ist jung - es wird gehandelt"
    // war toter Code. Jede kurze Bruecken-Stoerung setzte stattdessen eine
    // einstuendige Einbausperre, und ein Knotensprung wurde als "ohne
    // Sicherung gesprungen" protokolliert, obwohl eine frische vorlag.
    //
    // Der zugehoerige Test konnte es nicht finden: `tools/test-punish.js`
    // setzt `{ ts: WALL - 3600000 }` - eine ZAHL. Genau der eine Fall, in
    // dem die alte Fassung richtig rechnete.
    const b = JSON.parse(liesVonHome(ns, "data/bridge.json"));
    const lv = b && b.lastVerifiedBackup;
    const ts = lv && (Number.isFinite(lv.ts) ? lv.ts : Date.parse(lv.ts || lv.zeit || lv.at));
    if (!Number.isFinite(ts)) return null;
    const alter = Date.now() - ts;
    // Ein Zeitstempel in der Zukunft ergibt ein negatives Alter - und damit
    // ginge eine beliebig alte Sicherung als frisch durch. Hier haengt der
    // Augmentierungs-Einbau daran; die sichere Seite ist "unbekannt".
    return alter >= 0 ? alter : null;
  } catch {
    return null;
  }
}

/**
 * Der ganze Ablauf, als eine Funktion.
 *
 * Der Aufrufer bekommt zurueck, was er wissen muss: darf er handeln, und was
 * gehoert darueber ins Protokoll.
 *
 * @param {NS} ns
 * @param {"install"|"jump"} reason
 * @param {string} target
 * @param {number} nodeReset
 * @param {(text: string) => void} sag
 * @returns {Promise<{darf: boolean, grund: string, wartezeitMs: number,
 *                    gesichert: boolean, alterMs: number|null}>}
 */
export async function handschlag(ns, reason, target, nodeReset, sag = () => {}) {
  const beginn = Date.now();
  const anfrageTs = stelle(ns, reason, target, nodeReset);
  sag("Handschlag gestellt (" + reason + " -> " + target + "), warte auf die Bruecke.");

  // Die Bruecke sieht die Anfrage in ihrem Sofort-Takt (60 s) und braucht
  // danach unter einer Sekunde. 90 s sind also reichlich, aber nicht
  // grosszuegig - deshalb wird alle zwei Sekunden nachgesehen.
  let antwort = null;
  while (Date.now() - beginn < WARTE_MAX_MS) {
    antwort = antwortDa(ns, anfrageTs, reason);
    if (antwort) break;
    await ns.sleep(2000);
  }
  const wartezeitMs = Date.now() - beginn;

  if (antwort) {
    sag("Sicherung gruen nach " + Math.round(wartezeitMs / 1000) + " s: "
      + (antwort.datei || antwort.anlass || "?"));
    return { darf: true, grund: "frisch gesichert", wartezeitMs,
      gesichert: true, alterMs: 0 };
  }

  // Keine Antwort. Jetzt entscheidet das Alter der letzten gruenen Sicherung.
  const alterMs = sicherungsAlterMs(ns);
  const jung = Number.isFinite(alterMs) && alterMs < SICHERUNG_MAX_MS;

  if (jung) {
    sag("Bruecke antwortet nicht, aber die letzte Sicherung ist "
      + (alterMs / 3600000).toFixed(1) + " h alt - es wird gehandelt.");
    return { darf: true, grund: "ohne frische Sicherung, aber Netz vorhanden",
      wartezeitMs, gesichert: false, alterMs };
  }

  if (reason === "jump") {
    // DER SPRUNG GEHT TROTZDEM. Ein offener Ausgang kostet laufend Zeit;
    // der Knoten ist erledigt, und jede weitere Stunde darin ist verloren.
    sag("Bruecke antwortet nicht und keine junge Sicherung - der Sprung geht "
      + "trotzdem, ein offener Ausgang kostet mehr.");
    return { darf: true, grund: "ohne Sicherung gesprungen", wartezeitMs,
      gesichert: false, alterMs };
  }

  // DER EINBAU WARTET. Er ist beliebig oft nachholbar.
  sag("Bruecke antwortet nicht und keine junge Sicherung - EINBAU WIRD "
    + "AUSGESETZT, install-sperre.txt gesetzt.");
  // JETZT nachHome, NICHT MEHR ns.write (26.09.2026, Audit-Fund 6#5,
  // Paket C.4).
  //
  // Bis zum 22.09.2026 stand hier bewusst ein lokales `ns.write`, weil
  // bn4rep.js die Datei damals nur als "TAG|<ms>" las (`String(...).split
  // ("|")[1]`) - ein per `nachHome` verteiltes JSON-Objekt haette dort NaN
  // ergeben und die Sperre unaufhebbar gemacht (schlimmer als lokal und
  // wirkungslos).
  //
  // Seit Paket A (22.09.2026, BAUSTELLEN "install-sperre.txt hat zwei
  // Vertraege") liest bn4rep.js (:942-951) BEIDE Formate: JSON mit `bis`
  // gilt bis dahin, "TAG|ms" weiterhin fuenf Minuten ab dem Stempel. Der
  // Grund fuer das lokale Schreiben ist damit entfallen - und das lokale
  // Schreiben selbst ist der Fehler, den Bericht 6#5 gemessen hat: `bn4rep`
  // hat `hostRule: "werkbank"` und sitzt fast nie auf home, `handschlag()`
  // ebenso. Ein `ns.write` ohne `scp` legt die Sperre dann nur auf dem
  // Wirt ab, auf dem `bn4rep` GERADE lief - `liesVonHome` in bn4rep.js:797
  // sieht sie auf home nie, die Stunde Sperre wirkt nie, und der Prozess
  // (der bei `!hs.darf` damals per `return` endete - seit Paket A laeuft er
  // weiter und spiegelt die Sperre zusaetzlich selbst nach home)
  // haemmert im ~100-s-Neustarttakt des Kerns gegen dieselbe tote Bruecke -
  // gemessen in der Nacht 24./25.09.2026 6,5 h lang.
  nachHome(ns, "data/install-sperre.txt", JSON.stringify({
    ts: Date.now(),
    reason: "handschlag",
    bis: Date.now() + 3600000,
    text: "Keine Sicherung vor dem Einbau - die Bruecke hat nicht geantwortet.",
  }));
  return { darf: false, grund: "keine Sicherung, Einbau ausgesetzt", wartezeitMs,
    gesichert: false, alterMs };
}
