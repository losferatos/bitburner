/**
 * Der residente Waechter.
 *
 * Laeuft neben der Bruecke, schaut alle paar Minuten nach dem Bot und
 * SCHWEIGT, solange alles laeuft. Nur wenn wirklich etwas steht, geht eine
 * ntfy-Nachricht ans Handy - und dann eine kurze, nicht der ganze Bericht.
 *
 * WARUM ES DIESES SKRIPT GIBT UND NICHT EINEN SCHEDULED TASK
 *
 * Vom 23. bis 24.08.2026 lief die Ueberwachung als `scheduled task`, also als
 * eigene Claude-Sitzung im Stundentakt. Eric hat sie abgeschaltet, weil sie
 * "staendig irgendwelche Freigaben wollte, ohne mir Kontext zu geben". Das war
 * kein Bedienfehler, sondern Bauart: Eine Sitzung ohne Vorgeschichte kann eine
 * Freigabefrage gar nicht begruenden. Dieses Skript loest dasselbe Problem
 * ohne Sitzung, ohne Modell, ohne Freigabe - es liest und sendet, sonst nichts.
 *
 * Aufruf:  node tools/wache.js            (Dauerbetrieb, so startet start.cmd)
 *          node tools/wache.js --einmal   (eine Pruefung, Text auf stdout)
 *          node tools/wache.js --probe    (eine Pruefung, sendet auch bei Ruhe)
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const BASE = "http://localhost:8795";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const STATE_FILE = path.join(ROOT, "data", "wache-zustand.json");

// --- Die Stellschrauben ----------------------------------------------------
//
// Alle Zeiten sind bewusst grosszuegig. Ein Waechter, der zu frueh schreit,
// wird abgeschaltet - genau das ist der Vorgaengerversion passiert.

const POLL_MS = 3 * 60_000;
// Eine Stoerung muss zwei Pruefungen in Folge ueberleben, bevor sie gemeldet
// wird. Das kostet sechs Minuten und filtert alles weg, was sich von selbst
// erledigt: ein Neuladen des Tabs, eine haengende Runde, ein Schluckauf der
// Bruecke.
const BESTAETIGUNGEN = 2;
// Dieselbe Stoerung hoechstens einmal pro Stunde. Von Eric so gewaehlt
// (24.08.2026): eine Nachricht, dann Ruhe, auch wenn es weiter klemmt.
//
// Und danach immer seltener: 1 h, 2 h, 4 h, 8 h, gedeckelt bei 12 h. Ohne
// diese Steigerung klingelt eine Stoerung, die Eric bewusst herbeigefuehrt
// hat - abends den Bitburner-Tab zu, start.cmd offen gelassen - ab 5 Uhr
// jede Stunde, Tag fuer Tag. Genau daran ist die Vorgaengerloesung gestorben.
const COOLDOWN_MS = 60 * 60_000;
const COOLDOWN_MAX_MS = 12 * 60 * 60_000;
const cooldownFuer = (stufe) =>
  Math.min(COOLDOWN_MAX_MS, COOLDOWN_MS * Math.pow(2, Math.max(0, stufe - 1)));

// bn4net.js schreibt seine Telemetrie in jeder Runde, gemessen alle 10 - 15 s.
//
// Zehn Minuten statt der urspruenglichen fuenf, und zwar wegen des Einbaus:
// prestigeAugmentation toetet zuerst alle laufenden Skripte, die JSON-Dateien
// auf home ueberleben aber mit altem Zeitstempel. Zwischen Einbau und
// Wiederanlauf durch boot.js sieht ein toter Bot genauso aus wie ein
// startender. Zehn Minuten plus zwei Bestaetigungen decken den beobachteten
// Wiederaufbau ab; ein wirklich toter Bot faellt dadurch fuenf Minuten
// spaeter auf - gegen die fuenf STUNDEN vom 20.08. ist das nichts.
const MOTOR_MAX_ALTER = 10 * 60_000;

// Wie lange der Traeger des Knotens stehen darf, bevor es ein Befund ist.
// 45 Minuten sind grosszuegig: Eine Regenerationspause dauert Minuten, eine
// lange Black Operation hoechstens eine Viertelstunde.
const TRAEGER_STILL_MS = 45 * 60_000;
// bn4rep.js meldet sich ueber data/hb-rep.txt - einen reinen Zeitstempel, den
// es ganz oben in jeder Runde schreibt.
//
// Die Telemetriedatei bn4rep.json taugt dafuer NICHT: Das Skript steigt an
// vier Stellen vor der Telemetriezeile aus der Runde aus (Firmenphase,
// "nichts mehr zu kaufen", Ausgangsphase, leere Zielliste) und arbeitet
// dabei einwandfrei. Die erste Fassung dieses Waechters prueft genau das -
// sie haette im haeufigsten Normalzustand ueberhaupt stuendlich Alarm
// geschlagen. Gefunden von einem Skeptiker-Durchgang am 24.08.2026, bevor
// der Waechter das erste Mal ueber Nacht lief.
const REP_MAX_ALTER = 10 * 60_000;

// --- Nachtruhe -------------------------------------------------------------
//
// Zwischen 23 und 5 Uhr klingelt nichts. Von Eric am 24.08.2026 gesetzt.
//
// Eine Stoerung wird in dieser Zeit trotzdem ERKANNT, nur nicht gesendet -
// und ausdruecklich auch nicht als "gemeldet" verbucht. Damit geht sie um 5
// Uhr in der ersten Pruefung raus, sofern sie dann noch besteht. Hat sie sich
// ueber Nacht von selbst erledigt, erfaehrt er gar nichts, und das ist
// richtig: Eine Push-Nachricht ueber ein Problem, das nicht mehr existiert,
// ist reiner Laerm.
const RUHE_VON = 23;
const RUHE_BIS = 5;

function nachtruhe(d = new Date()) {
  const h = d.getHours();
  // Das Fenster geht ueber Mitternacht, deshalb ODER statt UND.
  return RUHE_VON > RUHE_BIS ? (h >= RUHE_VON || h < RUHE_BIS)
                             : (h >= RUHE_VON && h < RUHE_BIS);
}

const argv = process.argv.slice(2);
const EINMAL = argv.includes("--einmal");
const PROBE = argv.includes("--probe");

// --- ntfy ------------------------------------------------------------------
//
// Gesendet wird ueber ~/.claude/notify.sh und NICHT per fetch direkt an
// ntfy.sh. Der Grund ist der Topic-Name: Er ist das einzige Geheimnis des
// Kanals, und dieses Projekt liegt in einem Repo. Im Skript im Heimatordner
// ist er richtig aufgehoben, hier waere er es nicht.
const NOTIFY = path.join(os.homedir(), ".claude", "notify.sh");
// NICHT bash aus System32 - das ist WSL und sieht den Windows-Heimatordner
// nicht so, wie notify.sh es erwartet.
const BASH_KANDIDATEN = [
  "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
  "C:\\Program Files\\Git\\bin\\bash.exe",
  "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
];

function bashPfad() {
  for (const p of BASH_KANDIDATEN) if (existsSync(p)) return p;
  return null;
}

function push(titel, text, tag = "warning", prioritaet = "default") {
  return new Promise((fertig) => {
    const bash = bashPfad();
    if (!bash || !existsSync(NOTIFY)) {
      log("PUSH NICHT MOEGLICH (" + (bash ? "notify.sh fehlt" : "kein Git-Bash") + "): " + text);
      fertig(false);
      return;
    }
    // Der Umweg ueber einen POSIX-Pfad ist noetig, weil notify.sh von
    // Git-Bash ausgefuehrt wird und einen Windows-Pfad mit Laufwerksbuchstabe
    // als Argument nicht auffasst.
    const posix = "/" + NOTIFY.replace(/\\/g, "/").replace(":", "");
    // notify.sh liefert seit dem 24.08.2026 einen echten Rueckgabewert: 0 nur
    // dann, wenn ntfy die Nachricht auch angenommen hat. Vorher schluckte es
    // jeden Netzfehler und meldete Erfolg - der Waechter verbuchte den Alarm
    // als zugestellt und schwieg danach eine Stunde.
    execFile(bash, [posix, "--title", titel, "--tag", tag,
      "--priority", prioritaet, text], { timeout: 20_000 }, (err) => {
      if (err) log("PUSH FEHLGESCHLAGEN (" + (err.code ?? err.message) + "): " + text);
      else log("PUSH: " + text);
      fertig(!err);
    });
  });
}

// --- Kleinkram -------------------------------------------------------------

const uhr = () => new Date().toTimeString().slice(0, 8);
const log = (s) => console.log("[" + uhr() + "] " + s);

function geldText(n) {
  if (!Number.isFinite(n)) return "?";
  for (const [teiler, kuerzel] of [[1e12, "t"], [1e9, "b"], [1e6, "m"], [1e3, "k"]]) {
    if (Math.abs(n) >= teiler) return "$" + (n / teiler).toFixed(1) + kuerzel;
  }
  return "$" + Math.round(n);
}

const minuten = (ms) => Math.round(ms / 60_000);

async function holeJson(pfad, timeoutMs = 8000) {
  const r = await fetch(BASE + pfad, { signal: AbortSignal.timeout(timeoutMs) });
  return await r.json();
}

async function spieldatei(name) {
  try {
    const antwort = await holeJson("/api/rpc?method=getFile&filename="
      + encodeURIComponent(name) + "&server=home");
    if (antwort.error) return null;
    if (typeof antwort.result !== "string") return null;
    return antwort.result;
  } catch {
    return null;
  }
}

// STARTEN, NICHT NUR MELDEN (25.08.2026, 23:15).
//
// Der Waechter war bisher reine Beobachtung: Er meldet aufs Handy und kann
// nichts tun. Das hat am 25.08. vier Mal Stunden gekostet - nach einem
// Augmentierungs-Einbau um 22:01 fehlten sechs Werkzeuge, darunter der Motor
// des Knotens und der Tonanker gegen die Tab-Drosselung, und bn4net hat sie
// zwanzig Minuten lang nicht nachgestartet. Am Platz lag es nicht: home hatte
// 253 GB frei. Von aussen half nur der Auftragskanal, von Hand bedient.
//
// Genau das kann der Waechter selbst. Ein Werkzeugstart ist ungefaehrlich und
// wiederholbar: bn4net erkennt laufende Skripte und startet nichts doppelt.
//
// Der Kanal hat GENAU EINEN LESER und wird beim Lesen geleert. Deshalb erst
// nachsehen, ob er frei ist - ein belegter Kanal gehoert einem der Loops, und
// dessen Auftrag zu ueberschreiben waere schlimmer als eine Runde zu warten.
async function starteWerkzeug(name) {
  try {
    const belegt = await spieldatei("data/task.txt");
    if (belegt && belegt.trim()) return false;
    const antwort = await holeJson("/api/rpc?method=pushFile&filename="
      + encodeURIComponent("data/task.txt")
      + "&content=" + encodeURIComponent(JSON.stringify([name]))
      + "&server=home");
    return !antwort || !antwort.error;
  } catch {
    return false;
  }
}

async function spielJson(name) {
  const roh = await spieldatei(name);
  if (!roh) return null;
  try { return JSON.parse(roh); } catch { return null; }
}

async function ladeZustand() {
  try {
    const z = JSON.parse(await readFile(STATE_FILE, "utf8"));
    return {
      seit: z.seit || {},
      gemeldet: z.gemeldet || {},
      stufe: z.stufe || {},
      text: z.text || {},
      verlauf: Array.isArray(z.verlauf) ? z.verlauf : [],
      gestartet: z.gestartet || {},
      knoten: z.knoten ?? null,
      homeRam: z.homeRam ?? null,
      nachtpost: Array.isArray(z.nachtpost) ? z.nachtpost : [],
    };
  } catch {
    return { seit: {}, gemeldet: {}, stufe: {}, text: {}, verlauf: [],
      knoten: null, homeRam: null, nachtpost: [] };
  }
}

async function speichereZustand(z) {
  await mkdir(path.dirname(STATE_FILE), { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(z), "utf8");
}

// --- Die eigentliche Pruefung ----------------------------------------------
//
// Gibt eine Liste von Befunden zurueck. Jeder Befund hat einen `typ` (daran
// haengen Bestaetigung, Drosselung und Entwarnung) und einen `text` (das, was
// aufs Handy geht). `ereignis: true` heisst: sofort melden, keine
// Bestaetigung abwarten und keine Entwarnung erwarten - das sind einmalige
// Vorkommnisse wie ein geschaffter BitNode.

async function pruefe(zustand, jetzt) {
  const befunde = [];
  const messwerte = { ts: jetzt };

  // 1. Lebt die Bruecke ueberhaupt?
  let brueckenZustand = null;
  try {
    brueckenZustand = await holeJson("/api/state");
  } catch {
    befunde.push({
      typ: "bruecke",
      text: "Bruecke auf Port 8795 antwortet nicht - start.cmd laeuft nicht mehr.",
    });
    return { befunde, messwerte };
  }

  // 2. Haengt das Spiel an der Bruecke?
  if (!brueckenZustand.connected) {
    befunde.push({
      typ: "spiel",
      text: "Bruecke laeuft, aber das Spiel ist nicht verbunden -"
        + " Bitburner-Tab zu oder abgestuerzt.",
    });
    return { befunde, messwerte };
  }

  // 3. Der Motor: bn4net.js schreibt in jeder Runde.
  const net = await spielJson("data/bn4net.json");
  if (!net || typeof net.zeit !== "number") {
    befunde.push({
      typ: "motor",
      text: "Keine Telemetrie von bn4net.js - der Autopilot laeuft nicht mehr.",
    });
    return { befunde, messwerte };
  }

  const motorAlter = jetzt - net.zeit;
  if (motorAlter > MOTOR_MAX_ALTER) {
    befunde.push({
      typ: "motor",
      text: "bn4net.js meldet sich seit " + minuten(motorAlter) + " min nicht mehr"
        + " (Hacking " + net.hacking + ").",
    });
  }

  messwerte.hacking = net.hacking ?? null;
  messwerte.geld = net.geld ?? null;
  messwerte.homeRam = net.homeRam ?? null;
  messwerte.runde = Number.isFinite(net.runde) ? net.runde : null;

  // 3b. LAEUFT DAS SPIEL ueberhaupt mit voller Geschwindigkeit?
  //
  // Gemessen am 25.08.2026 um 17:47: eine Motorrunde in 61 Sekunden statt der
  // ueblichen vier bis sechs. Der Browsertab war gedrosselt - verborgene Tabs
  // laufen sechzehnfach langsamer, und wakelock.js haelt sie mit einem
  // unhoerbaren Ton wach. Der Ton kann lautlos ausfallen: Nach einem Reload
  // steht der AudioContext auf "suspended", weil Browser Tonausgabe ohne
  // Nutzerinteraktion blockieren. Das Skript laeuft weiter und meldet nichts.
  //
  // Kein bestehender Pruefer konnte das sehen: bn4net schreibt dann alle drei
  // Minuten statt alle zehn Sekunden, und beide Frischegrenzen (sechs und zehn
  // Minuten) bleiben unterschritten. Alles sah normal aus, waehrend der ganze
  // Bot ein Fuenftel seiner moeglichen Arbeit leistete.
  //
  // Die Rundenzahl stand die ganze Zeit in der Telemetrie. Sie zu speichern
  // kostet nichts - sie nicht zu speichern hat Stunden gekostet.
  // Der Verlauf steht neueste-zuerst. Gesucht ist der juengste Eintrag, der
  // mindestens fuenf Minuten alt ist - bei drei Minuten Takt ist das der
  // zweite oder dritte. Kuerzere Abstaende schwanken zu stark.
  const vorigeRunde = (zustand.verlauf || []).find(
    (x) => Number.isFinite(x.runde) && jetzt - x.ts >= 5 * 60_000);
  if (vorigeRunde && Number.isFinite(messwerte.runde)) {
    const min = (jetzt - vorigeRunde.ts) / 60000;
    const drunden = messwerte.runde - vorigeRunde.runde;
    // Ein Neustart des Motors setzt den Zaehler zurueck - dann ist die
    // Differenz negativ und sagt nichts ueber die Geschwindigkeit.
    if (min >= 5 && drunden >= 0 && drunden / min < 1) {
      befunde.push({
        typ: "tempo",
        text: "Das Spiel laeuft gedrosselt: nur " + (drunden / min).toFixed(2)
          + " Motorrunden je Minute statt 4-6. Einmal in den Bitburner-Tab"
          + " klicken - der Weckton braucht eine Nutzerinteraktion.",
      });
    }
  }

  // 3c. LEBEN DIE LOOPS NOCH?
  //
  // Die drei Cron-Loops laufen in EINER Claude-Sitzung. Ein /compact, ein
  // geschlossenes Fenster, der Ablauf nach sieben Tagen - und die gesamte
  // eingreifende Ebene ist weg. Der Bot laeuft weiter, also schweigt dieser
  // Waechter voellig korrekt, waehrend niemand mehr eingreift.
  //
  // Fuenf Skeptiker-Pruefungen am 25.08.2026 haben das unabhaengig voneinander
  // als groessten Einzelfehler benannt: Es gab keine Stelle, an der Session-Tod,
  // Sieben-Tage-Ablauf und ein misslungener Cron-Umbau anders aussehen als
  // Normalbetrieb.
  //
  // DER SCHALTER MUSS VON ALLEN LOOPS BERUEHRT WERDEN (26.08.2026, 01:15).
  //
  // Hier stand `data/ziele.md`. Die schreibt aber nur der Reportloop - und der
  // pausiert planmaessig zwischen 22:30 und 5:00. Jede Nacht war die Datei
  // damit stundenlang alt, obwohl Wache und Vorankommen munter weiterliefen;
  // in der Nacht zum 26.08. hat nur die Nachtruhe die Fehlmeldung geschluckt,
  // um 5:00 waere sie rausgegangen. Ein Fehlalarm aus dem Alarmwerkzeug selbst
  // ist die teuerste Sorte: Er kommt, wenn Eric gerade aufwacht, und stumpft
  // die Meldungen ab, auf die es ankommt.
  //
  // `data/verlauf-strategie.json` ist der bessere Schalter: Sie wird von
  // `tools/strategie-check.js` bei JEDEM Lauf geschrieben, und den ruft jeder
  // der vier Loops als erstes auf. Der haeufigste ist die Wache alle zwanzig
  // Minuten - eine Stunde Stille ist also drei verpasste Laeufe und nicht
  // mehr mit Verspaetung zu erklaeren.
  try {
    const st = statSync(path.join(ROOT, "data", "verlauf-strategie.json"));
    const alter = jetzt - st.mtimeMs;
    if (alter > 60 * 60_000) {
      befunde.push({
        typ: "loops",
        text: "Die Ueberwachungs-Loops melden sich seit " + minuten(alter)
          + " min nicht mehr - Sitzung beendet oder Cron abgelaufen."
          + " In Claude Code '/bb-loops' aufrufen.",
      });
    }
  } catch {
    // Datei fehlt: Der Reportloop hat noch nie gelaufen. Das ist beim ersten
    // Start normal und kein Alarm - erst ihr Verschwinden waere einer.
  }

  // 4. Der Reputationsmotor, gemessen am Puls (data/hb-rep.txt).
  //
  // FEHLENDE DATEI IST EIN ALARM, nicht Schweigen. Die erste Fassung hatte
  // hier `if (repZeit > 0)` - fehlte die Datei, wurde die ganze Pruefung
  // uebersprungen. Genau dieser Zustand tritt nach einem Knotenwechsel ein,
  // wenn home geleert wird und bn4rep.js gar nicht erst startet: Der
  // Reputationsmotor waere dauerhaft tot gewesen, ohne einen einzigen Alarm.
  // Beim Hauptmotor war es von Anfang an richtig herum geloest; die
  // Asymmetrie war ein Versehen.
  const rep = await spielJson("data/bn4rep.json");
  const job = await spielJson("data/bn4job.json");
  const puls = Number(await spieldatei("data/hb-rep.txt"));

  // KALTSTART IST KEINE STOERUNG (24.08.2026).
  //
  // bn4rep.js braucht 768 GB. Nach einem Knotenwechsel faellt home auf 32 GB
  // zurueck (128 mit SF9.2), und im ganzen Netz gibt es zunaechst nichts
  // Groesseres. Der Reputationsmotor KANN dann nicht laufen - das ist kein
  // Ausfall, sondern der Normalzustand der ersten Stunden, und er dauert
  // genau so lange, bis der erste grosse Rechner gekauft ist.
  //
  // Ein Waechter, der das meldet, meldet eine Tatsache, an der niemand etwas
  // aendern kann. Genau daran ist die Vorgaengerloesung gestorben.
  const homeRam = net.homeRam ?? null;
  const kaltstart = Number.isFinite(homeRam) && homeRam <= 128;

  if (kaltstart) {
    // nichts pruefen - siehe oben
  } else if (!Number.isFinite(puls) || puls <= 0) {
    // FEHLENDE DATEI IST EIN ALARM, nicht Schweigen. Die erste Fassung
    // uebersprang die Pruefung, wenn die Datei fehlte - also genau dann, wenn
    // bn4rep gar nicht erst gestartet war.
    befunde.push({
      typ: "rep",
      text: "Kein Lebenszeichen von bn4rep.js - der Reputationsmotor laeuft nicht.",
    });
  } else if (jetzt - puls > REP_MAX_ALTER) {
    befunde.push({
      typ: "rep",
      text: "bn4rep.js meldet sich seit " + minuten(jetzt - puls)
        + " min nicht mehr - keine Reputationsarbeit.",
    });
  }

  // Frisch heisst: juenger als eine Waechterrunde. Nach einem Knotenwechsel
  // liegt die alte Datei noch da, sie ist dann Minuten alt.
  const repFrisch = typeof rep?.zeit === "number" && jetzt - rep.zeit < POLL_MS;

  // NUR EINE FRISCHE KNOTENNUMMER IST EINE KNOTENNUMMER (24.08.2026).
  //
  // Beim Wechsel BitNode 5 -> 6 um 21:22 meldete der Waechter "jetzt in
  // BitNode 5": Den Wechsel hatte er richtig am Einbruch des home-Speichers
  // erkannt, die Zahl aber aus einer bn4rep.json geholt, die noch aus dem
  // ALTEN Knoten stammte - die JSON-Dateien auf home ueberleben den Wechsel,
  // nur die Skripte sterben. Richtiger Befund, falsche Beschriftung.
  //
  // Lieber gar keine Zahl als eine aus dem vorigen Knoten: Ohne `knoten`
  // meldet der Waechter schlicht "BitNode geschafft", und das stimmt immer.
  if (typeof rep?.knoten === "number" && repFrisch) messwerte.knoten = rep.knoten;

  // 5a. DEN TRAEGER MESSEN, NICHT DAS NAHELIEGENDE (25.08.2026).
  //
  // Bis hierher prueft der Waechter nur Infrastruktur - Bruecke, Motor, Tempo,
  // Loops. In BitNode 6 haengt der Ausgang aber am Bladeburner-Rang, und der
  // kann stundenlang stehen, waehrend Hacking und Geld durch bn4net munter
  // weiterwachsen. Genau diesen Stillstand haette der Waechter verschwiegen -
  // gegen ihn ist er gebaut.
  //
  // Anders als die unter 5. ausgebaute Hacking-Pruefung ist das keine
  // "hat sich irgendetwas bewegt"-Frage: Der Rang hat genau eine Quelle, und
  // versiegt sie, ist der Knoten blockiert. Frisches blade.json heisst
  // Bladeburner-Knoten - damit braucht es die Knotennummer hier gar nicht.
  const blade = await spielJson("data/blade.json");
  const bladeFrisch = typeof blade?.zeit === "number" && jetzt - blade.zeit < MOTOR_MAX_ALTER;
  if (bladeFrisch && Number.isFinite(blade.rang)) {
    messwerte.rang = blade.rang;
    const vorher = (zustand.verlauf || []).find(
      (x) => Number.isFinite(x.rang) && jetzt - x.ts >= TRAEGER_STILL_MS);
    // Ist der Tab gedrosselt, steht ohnehin alles - dann nennt der Tempobefund
    // die Ursache, und eine zweite Meldung ueber dieselbe Sache waere Laerm.
    const gedrosselt = befunde.some((b) => b.typ === "tempo");
    if (vorher && !gedrosselt && blade.rang <= vorher.rang) {
      befunde.push({
        typ: "traeger",
        text: "Bladeburner-Rang steht seit " + minuten(jetzt - vorher.ts)
          + " min bei " + blade.rang + " (Aktion: " + (blade.aktion || "?")
          + "). In diesem Knoten traegt der Rang - es geht nicht voran.",
      });
    }
  }

  // 5. Eine Fortschrittspruefung stand hier und ist am 24.08.2026 wieder
  //    ausgebaut worden. Sie verlangte, dass Hacking-Level UND Guthaben ueber
  //    zwanzig Minuten unveraendert bleiben - und war damit gleichzeitig
  //    blind und falsch:
  //
  //    - Blind, weil beides gleichzeitig nur dann stillsteht, wenn ohnehin
  //      alles tot ist. Dann hat der Motorbefund oben laengst gefeuert.
  //    - Falsch, weil es legitime Zustaende gibt, die genau so aussehen:
  //      reine Faktionsarbeit ohne laufende Hack-Skripte, der Wiederaufbau
  //      nach einem Einbau (Guthaben exakt 0), und vor allem BitNode 8, wo
  //      das Spiel jede Geldquelle ausser dem Aktienmarkt auf null setzt.
  //
  //    Eine ECHTE Leistungspruefung braucht Raten gegen einen erwarteten
  //    Wert, nicht "hat sich irgendetwas bewegt". Das ist offen - lieber
  //    keine Pruefung als eine, die im falschen Moment klingelt.

  // 6. Ruft der Bot nach einem Menschen? data/hilfe.txt ist die Leitung
  //    dafuer: Ein Skript im Spiel schreibt eine Zeile hinein, wenn es allein
  //    nicht weiterkommt. Der Waechter leert sie NICHT - sie verschwindet
  //    erst, wenn die Lage bereinigt ist. Sonst haette Eric genau eine
  //    Nachricht und danach keinen Anhaltspunkt mehr, was los war.
  const hilfe = (await spieldatei("data/hilfe.txt") || "").trim();
  if (hilfe) {
    befunde.push({
      typ: "hilfe",
      text: hilfe.slice(0, 240),
      tag: "rotating_light",
      prioritaet: "high",
    });
  }

  // 7. BitNode gewechselt? Zwei unabhaengige Anzeichen, beide gratis.
  //    - `knoten` aus bn4rep.json (das Skript ruft getResetInfo ohnehin auf,
  //      die Zahl kostet dort also kein zusaetzliches Gigabyte)
  //    - der Einbruch des home-Speichers: NUR ein Knotenwechsel setzt home
  //      zurueck (prestigeSourceFile), ein Augmentierungs-Einbau laesst ihn
  //      stehen. Deshalb ist das ein eindeutiges Zeichen und kein Rauschen.
  const knotenVorher = zustand.knoten;
  const knotenJetzt = messwerte.knoten ?? null;
  const ramVorher = zustand.homeRam;
  const ramJetzt = messwerte.homeRam ?? null;
  const knotenWechsel =
    (knotenVorher != null && knotenJetzt != null && knotenJetzt !== knotenVorher)
    || (ramVorher != null && ramJetzt != null && ramVorher >= 1024 && ramJetzt <= ramVorher / 8);
  if (knotenWechsel) {
    befunde.push({
      typ: "knoten",
      ereignis: true,
      tag: "tada",
      text: "BitNode geschafft"
        + (knotenJetzt ? " - jetzt in BitNode " + knotenJetzt : "")
        + ". Der Bot baut sich gerade neu auf.",
    });
  }

  // --- 8. LEBEN DIE ZWEI WICHTIGSTEN WERKZEUGE? ---------------------------
  //
  // Ihre Telemetrie IST ihr Lebenszeichen - beide schreiben mindestens
  // minuetlich, in jedem Zweig ihrer Schleife. Eine alte Datei heisst also:
  // Das Skript laeuft nicht mehr.
  //
  //   blade.js     der Motor von BitNode 6 und 7. Ohne ihn steht der Rang.
  //   wakelock.js  der Tonanker. Ohne ihn drosselt der Browser den Tab auf
  //                ein Timer-Aufwachen je Minute - Faktor 5 bis 60 auf alles.
  //
  // Nicht geprueft wird bbtrain.js: Es schreibt nur bei Ereignissen, ein
  // Alter sagt dort nichts.
  const WERKZEUGE = [
    { datei: "data/blade.json", skript: "blade.js", json: true },
    { datei: "data/wakelock.txt", skript: "wakelock.js", json: false },
  ];
  for (const w of WERKZEUGE) {
    const roh = await spieldatei(w.datei);
    let stempel = null;
    if (roh) {
      if (w.json) {
        try { stempel = JSON.parse(roh).zeit; } catch { stempel = null; }
      } else {
        // Format "<ms>|<zustand>|<rate>"; die Klartextzeile beim Start hat
        // keinen Zeitstempel und zaehlt deshalb nicht als Lebenszeichen.
        const n = Number(String(roh).split("|")[0]);
        stempel = Number.isFinite(n) && n > 1e12 ? n : null;
      }
    }
    const alt = stempel ? jetzt - stempel : null;
    if (alt === null || alt <= 10 * 60_000) continue;

    // Hoechstens alle 15 Minuten ein Startversuch je Werkzeug. Sonst schiebt
    // der Waechter bei einem echten Problem alle drei Minuten einen Auftrag
    // nach und verstopft den Kanal fuer die Loops.
    const letzter = zustand.gestartet && zustand.gestartet[w.skript];
    if (letzter && jetzt - letzter < 15 * 60_000) continue;
    const los = await starteWerkzeug(w.skript);
    if (los) {
      zustand.gestartet = zustand.gestartet || {};
      zustand.gestartet[w.skript] = jetzt;
      log("Nachgestartet: " + w.skript + " (Telemetrie war "
        + minuten(alt) + " min alt).");
    }
    befunde.push({
      typ: "werkzeug",
      text: w.skript + " meldet sich seit " + minuten(alt) + " min nicht."
        + (los ? " Neustart ueber den Auftragskanal angestossen."
          : " Der Auftragskanal war belegt - naechster Versuch in 15 min."),
    });
  }

  return { befunde, messwerte };
}

// --- Meldelogik ------------------------------------------------------------
//
// Trennt sauber zwischen "gesehen" und "gemeldet". Ein Befund wird gesehen,
// sobald er auftritt; gemeldet wird er erst, wenn er BESTAETIGUNGEN
// Pruefungen ueberlebt hat und die Drosselung ihn durchlaesst.

async function verarbeite(zustand, ergebnis, jetzt) {
  const { befunde, messwerte } = ergebnis;
  const aktiv = new Set(befunde.filter((b) => !b.ereignis).map((b) => b.typ));
  const still = nachtruhe();

  // Alles, was in der Ruhezeit angefallen ist und sich nicht von selbst
  // wiederholt, liegt in der Nachtpost und geht jetzt in EINER Nachricht raus.
  if (!still && zustand.nachtpost.length) {
    const post = zustand.nachtpost;
    zustand.nachtpost = [];
    await push("Bitburner", "Ueber Nacht: " + post.join(" "), "bell", "default");
  }

  const zurueckstellen = (text) => {
    if (!zustand.nachtpost.includes(text)) zustand.nachtpost.push(text);
  };

  for (const b of befunde) {
    if (b.ereignis) {
      // Einmalige Vorkommnisse gehen sofort raus - sie wiederholen sich nicht,
      // also gibt es nichts zu bestaetigen und nichts zu drosseln. In der
      // Nachtruhe wandern sie in die Nachtpost, sonst waeren sie fuer immer
      // verloren. Dasselbe gilt, wenn die Zustellung scheitert: Ein Ereignis
      // kommt kein zweites Mal, ein verlorener Push waere endgueltig.
      if (still) {
        zurueckstellen(b.text);
        log("Nachtruhe - zurueckgestellt: " + b.typ);
      } else if (!await push("Bitburner", b.text, b.tag || "bell", b.prioritaet || "default")) {
        zurueckstellen(b.text);
        log("Zustellung fehlgeschlagen - in die Nachtpost: " + b.typ);
      }
      continue;
    }

    if (!zustand.seit[b.typ]) zustand.seit[b.typ] = jetzt;
    const bestehtSeit = jetzt - zustand.seit[b.typ];
    if (bestehtSeit < (BESTAETIGUNGEN - 1) * POLL_MS) {
      log("gesehen, noch nicht bestaetigt: " + b.typ);
      continue;
    }

    // DER VERGLEICH BRAUCHT EINEN STABILEN SCHLUESSEL (24.08.2026).
    //
    // Hier stand der volle Meldungstext. Der Gedanke war richtig - ein NEUER
    // Notruf soll nicht eine Stunde warten muessen, nur weil vorhin ein
    // anderer unter demselben Typ lief. Die Ausfuehrung war es nicht: In den
    // Texten steht eine hochzaehlende Zahl ("meldet sich seit 36 min nicht
    // mehr"). Damit war der Text bei JEDER Pruefung ein anderer, die
    // Drosselung griff nie, und dieselbe Stoerung ging alle drei Minuten
    // erneut raus. Gemessen am 24.08. um 21:57: Stufe 8, also achtmal
    // gesendet, wo einmal vorgesehen war.
    //
    // Verglichen werden deshalb nur noch die Ziffern-freien Anteile. Ein
    // wirklich anderer Notruf hat anderen Wortlaut und kommt weiter sofort
    // durch; ein hochzaehlender Zaehler nicht.
    const schluessel = (t) => t.replace(/[0-9]+/g, "#");
    const zuletzt = zustand.gemeldet[b.typ] || 0;
    const gleicherText = zustand.text[b.typ] === schluessel(b.text);
    const wartezeit = cooldownFuer(zustand.stufe[b.typ] || 0);
    if (gleicherText && jetzt - zuletzt < wartezeit) {
      log("gedrosselt (noch " + minuten(wartezeit - (jetzt - zuletzt)) + " min): " + b.typ);
      continue;
    }

    if (still) {
      // Bewusst OHNE zustand.gemeldet zu setzen - siehe RUHE_VON. Die Stoerung
      // meldet sich damit um 5 Uhr von selbst, sofern sie dann noch besteht.
      log("Nachtruhe - nicht gesendet: " + b.typ);
      continue;
    }

    // ERST SENDEN, DANN VERBUCHEN. Andersherum stand es bis zum 24.08.2026,
    // und der Rueckgabewert wurde ignoriert: Ein Alarm, der wegen eines
    // Netzausfalls nie ankam, galt trotzdem als zugestellt - eine Stunde
    // Funkstille, und danach womoeglich eine Entwarnung fuer etwas, wovon
    // Eric nie erfahren hatte.
    const zugestellt = await push("Bitburner", b.text,
      b.tag || "warning", b.prioritaet || "high");
    if (zugestellt) {
      zustand.gemeldet[b.typ] = jetzt;
      zustand.text[b.typ] = schluessel(b.text);
      zustand.stufe[b.typ] = (zustand.stufe[b.typ] || 0) + 1;
    }
  }

  // Entwarnung: nur fuer Stoerungen, die auch wirklich gemeldet wurden.
  // Eine Entwarnung fuer etwas, wovon Eric nie erfahren hat, ist Laerm.
  const ENTWARNUNG = {
    bruecke: "Bruecke ist wieder da.",
    spiel: "Spiel haengt wieder an der Bruecke.",
    motor: "bn4net.js meldet sich wieder.",
    rep: "bn4rep.js arbeitet wieder.",
    hilfe: "Der Bot kommt wieder allein zurecht.",
    traeger: "Der Traeger des Knotens steigt wieder.",
    werkzeug: "Das fehlende Werkzeug laeuft wieder."
  };
  for (const typ of Object.keys(zustand.seit)) {
    if (aktiv.has(typ)) continue;
    const warGemeldet = !!zustand.gemeldet[typ];
    delete zustand.seit[typ];
    delete zustand.gemeldet[typ];
    delete zustand.stufe[typ];
    delete zustand.text[typ];
    if (!warGemeldet) continue;
    const text = ENTWARNUNG[typ] || (typ + " ist behoben.");
    // IN DER NACHTRUHE IN DIE NACHTPOST, nicht in den Papierkorb. Vorher fiel
    // sie hier ersatzlos weg: Eric ging mit "Bruecke tot" ins Bett, das
    // Problem behob sich um halb eins - und weil der Zustand dabei geloescht
    // wurde, erfuhr er auch um 5 Uhr nichts mehr davon.
    if (still) { zurueckstellen(text); continue; }
    if (!await push("Bitburner", text, "white_check_mark", "default")) {
      zurueckstellen(text);
    }
  }

  // Verlauf: neueste zuerst. Er dient nur noch der Knotenerkennung, seit die
  // Fortschrittspruefung ausgebaut ist - zwei Stunden sind reichlich.
  zustand.verlauf.unshift(messwerte);
  zustand.verlauf = zustand.verlauf.filter((v) => jetzt - v.ts <= 2 * 60 * 60_000);
  if (messwerte.knoten != null) zustand.knoten = messwerte.knoten;
  if (messwerte.homeRam != null) zustand.homeRam = messwerte.homeRam;

  // Der eigene Puls - das Dashboard zeigt daran, ob die Wache ueberhaupt
  // laeuft. Ein Waechter, dessen Tod wie "alles in Ordnung" aussieht, ist
  // keiner.
  zustand.letztePruefung = jetzt;
  zustand.offeneBefunde = befunde.map((b) => b.text);
}

async function runde() {
  const jetzt = Date.now();
  const zustand = await ladeZustand();
  let ergebnis;
  try {
    ergebnis = await pruefe(zustand, jetzt);
  } catch (err) {
    // Ein Waechter, der an einem eigenen Fehler stirbt, ist schlimmer als
    // keiner: Er hinterlaesst den Eindruck, es werde geschaut.
    log("PRUEFUNG FEHLGESCHLAGEN: " + err.message);
    return null;
  }
  try {
    await verarbeite(zustand, ergebnis, jetzt);
    await speichereZustand(zustand);
  } catch (err) {
    log("MELDUNG FEHLGESCHLAGEN: " + err.message);
  }

  const m = ergebnis.messwerte;
  if (ergebnis.befunde.length === 0) {
    log("still - Hacking " + (m.hacking ?? "?") + ", " + geldText(m.geld)
      + (Number.isFinite(m.rang) ? ", Rang " + m.rang : ""));
  }
  return ergebnis;
}

async function main() {
  if (EINMAL || PROBE) {
    const e = await runde();
    if (PROBE) {
      await push("Bitburner", "Probelauf des Waechters: "
        + (e && e.befunde.length ? e.befunde.length + " Befund(e)" : "alles ruhig")
        + ".", "mag", "default");
    }
    if (e) console.log(JSON.stringify(e.befunde, null, 1));
    return;
  }

  // NUR EINER (26.08.2026, 00:45).
  //
  // Am 25.08. um 19:43 liefen ZWEI Waechter gleichzeitig (PID 24464 und
  // 19744). Beide schreiben dieselbe Datei data/wache-zustand.json, und in ihr
  // stehen die Meldesperren: gemeldet, stufe, seit. Wer zuletzt schreibt,
  // gewinnt - ein Prozess kann die Sperre des anderen ueberschreiben, sodass
  // derselbe Alarm zweimal aufs Handy geht oder eine Entwarnung eine noch
  // bestehende Stoerung aus dem Zustand loescht. Seit dem 25.08. greift der
  // Waechter ausserdem selbst ein und startet Werkzeuge nach; zwei davon
  // wuerden sich gegenseitig Auftraege ueberschreiben.
  //
  // Die Sperrdatei traegt die eigene Prozesskennung. Lebt der dort genannte
  // Prozess noch, beendet sich der neue - lieber gar kein zweiter als ein
  // zweiter, der stillschweigend dazwischenfunkt.
  const PID_DATEI = path.join(ROOT, "data", "wache.pid");
  try {
    const roh = await readFile(PID_DATEI, "utf8");
    const alt = Number(String(roh).trim());
    if (Number.isFinite(alt) && alt > 0 && alt !== process.pid) {
      let lebt = false;
      // Signal 0 sendet nichts, prueft nur die Existenz. Auf Windows wirft es
      // ESRCH, wenn der Prozess weg ist - genau das wollen wir wissen.
      try { process.kill(alt, 0); lebt = true; } catch { lebt = false; }
      if (lebt) {
        log("Es laeuft bereits ein Waechter (PID " + alt + ") - beende mich.");
        return;
      }
      log("Verwaiste Sperrdatei von PID " + alt + " gefunden, uebernehme.");
    }
  } catch { /* keine Sperrdatei: normaler Erststart */ }
  await mkdir(path.dirname(PID_DATEI), { recursive: true });
  await writeFile(PID_DATEI, String(process.pid), "utf8");

  log("Waechter laeuft (PID " + process.pid + "). Pruefung alle "
    + minuten(POLL_MS) + " min,"
    + " Meldung erst nach " + BESTAETIGUNGEN + " Pruefungen,"
    + " hoechstens einmal je Stunde und Stoerung."
    + " Nachtruhe " + RUHE_VON + "-" + RUHE_BIS + " Uhr.");
  for (;;) {
    await runde();
    await new Promise((f) => setTimeout(f, POLL_MS));
  }
}

main();
