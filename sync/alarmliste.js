/**
 * Die maschinengefuehrte Alarmliste der Bruecke (B08, 14.11.2026).
 *
 * WARUM ES SIE GIBT
 * `## Sofort` in nodes/BAUSTELLEN.md war ein Archiv: Auto-Alarme ohne Ablauf,
 * dieselbe Meldung alle sechs Stunden und nach jedem Brueckenneustart neu,
 * "Telemetrie veraltet" vom 08.11. stand am 12.11. noch da (5b, Muster 1).
 * Ein Kanal, in dem alles stehen bleibt, wird nicht mehr gelesen - und dann
 * faellt der echte Alarm mit durch.
 *
 * DER ZUSTAND GEHOERT IN EINE DATEI (data/alarme.json), nicht in eine Map im
 * Speicher und nicht in Fliesstext. Jeder Alarm hat:
 *   - einen Schluessel (dieselbe Ursache = derselbe Alarm, auch bei anderer
 *     Zahl im Titel), Beginn, letzte Wiederholung, Anzahl;
 *   - eine KLASSE, und die entscheidet, wie er endet:
 *       zustand  Momentaufnahme (Tab zu, Telemetrie alt). Endet durch Messung
 *                ODER durch Ablauf (24 h ohne Wiederholung).
 *       vorfall  einmaliges Ereignis ohne messbare Ursache. Endet durch Ablauf.
 *       schutz   ein Riegel hat gegriffen (Sicherung rot, fremdes Spiel,
 *                Zweit-Tab, Schub verweigert). Endet NUR durch eine MESSUNG
 *                (die Ursache ist nachweislich weg) oder von Hand MIT Beleg.
 *                Zeit allein beendet ihn nie: ein Schutzalarm, der nach 24 h
 *                still verschwindet, ist ein abgeschalteter Riegel.
 *
 * Reines Modul: keine Bruecke, kein Spiel. `melde`, `messe`, `verfalle`,
 * `beende` arbeiten auf einem Objekt im Speicher; `lade`/`speichere` sind die
 * einzigen Stellen, die Platte anfassen (atomar, kaputte Datei wird
 * beiseitegelegt statt ueberschrieben).
 */
import { readFile, writeFile, rename, mkdir, copyFile } from "node:fs/promises";
import path from "node:path";

export const SCHEMA = 1;
export const STUNDE_MS = 3600000;
/** Wie viele beendete Alarme die Datei behaelt (die offenen immer alle). */
export const HISTORIE_MAX = 100;
/** Mindestlaenge eines Belegs fuer das Beenden eines Schutzalarms von Hand. */
export const BELEG_MIN = 12;

/**
 * Was die Bruecke und das Spiel an Titeln melden, und wie jeder endet.
 * Reihenfolge zaehlt: der erste Treffer gilt. `messung` nennt die Messung,
 * die ihn beendet (Haken in sync/bridge.js: alarmMessung). Ohne `messung` und
 * mit klasse "schutz" gibt es nur das Beenden von Hand mit Beleg.
 */
export const REGELN = [
  { muster: /^Spiel-Tab nicht verbunden/, name: "tab", klasse: "zustand", ablaufH: 24, messung: "tab-verbunden" },
  { muster: /^Telemetrie veraltet/, name: "telemetrie", klasse: "zustand", ablaufH: 24, messung: "telemetrie-frisch" },
  { muster: /^Autosave steht/, name: "autosave", klasse: "zustand", ablaufH: 24, messung: "autosave-frisch" },

  { muster: /^Sicherung (ausgefallen|abgelehnt)/, name: "sicherung", klasse: "schutz", messung: "sicherung-gruen" },
  // Endet erst, wenn der Rueckstau wirklich geschoben ist (schub-ok), nicht mit
  // irgendeiner gruenen Sicherung (Skeptiker 14.11.2026).
  { muster: /^Sicherung vor Codeschub fehlgeschlagen/, name: "sicherung-codeschub", klasse: "schutz", messung: "schub-ok" },
  { muster: /^Bruecke ohne Sicherung/, name: "ohne-sicherung", klasse: "schutz", messung: "sicherung-gruen" },
  { muster: /^Kein pushAll/, name: "kein-pushall", klasse: "schutz", messung: "sicherung-gruen" },
  { muster: /^Schub verworfen/, name: "schub-verworfen", klasse: "schutz", messung: "schub-ok" },
  { muster: /^Schub verweigert - Zweit-Tab/, name: "schub-zweittab", klasse: "schutz", messung: "zweittab-frei" },
  { muster: /^Grosser Schub verweigert/, name: "schub-gross", klasse: "schutz", messung: "schub-ok" },
  { muster: /^Schub verweigert/, name: "schub-master", klasse: "schutz", messung: "schub-ok" },
  // Die alte Verbindung schwieg (Reconnect-Verdacht): es wird KEINE Sperrdatei
  // gesetzt, also kann "Sperrdatei weg" auch nichts beenden - die Messung waere
  // trivial wahr und loeschte den Verdacht binnen einer Minute (Skeptiker
  // 14.11.2026). Vorfall mit Ablauf statt Schutzalarm mit leerer Messung.
  { muster: /^Zweite RFA-Verbindung - alte stumm/, name: "zweittab-stumm", klasse: "vorfall", ablaufH: 24, messung: null },
  { muster: /^Zweite RFA-Verbindung/, name: "zweittab", klasse: "schutz", messung: "zweittab-frei" },
  { muster: /^(Socket abgewiesen|Fremde Spielverbindung abgewiesen|Verifikation fehlgeschlagen|Freigabe verweigert)/,
    name: "socket", klasse: "schutz", messung: "socket-verifiziert" },
  { muster: /^Verbindung ohne Anker/, name: "ohne-anker", klasse: "schutz", messung: "verbindung-mit-anker" },
  { muster: /^Master-Riegel blind/, name: "master-blind", klasse: "schutz", messung: "master-index-ok" },
  { muster: /^Ausgang blockiert/, name: "ausgang", klasse: "schutz", messung: null },

  { muster: /^Spielstand kam als Base64/, name: "base64", klasse: "vorfall", ablaufH: 72, messung: null },
];

/** Unbekannte Titel: nicht ewig stehen lassen, aber auch nicht nach einem Tag. */
export const UNBEKANNT_ABLAUF_H = 168;

/** Titel -> Regel. Unbekannt: Klasse "vorfall", Schluessel aus dem Titel ohne Ziffern. */
export function klassifiziere(titel) {
  const t = String(titel || "").trim();
  for (const r of REGELN) {
    if (r.muster.test(t)) {
      return {
        name: r.name, klasse: r.klasse, messung: r.messung || null,
        ablaufMs: r.klasse === "schutz" ? null : r.ablaufH * STUNDE_MS,
        bekannt: true,
      };
    }
  }
  return {
    name: "u:" + t.replace(/\d+/g, "#").slice(0, 80).toLowerCase(),
    klasse: "vorfall", messung: null, ablaufMs: UNBEKANNT_ABLAUF_H * STUNDE_MS, bekannt: false,
  };
}

export function leereListe() {
  return { schema: SCHEMA, alarme: [] };
}

/** Offene Alarme, juengste Wiederholung zuerst. */
export function offene(liste) {
  return liste.alarme.filter((a) => a.status === "offen")
    .sort((x, y) => y.zuletzt - x.zuletzt);
}

/**
 * Einen Alarm melden. Derselbe Schluessel, solange offen = derselbe Alarm:
 * `anzahl` und `zuletzt` steigen, der Ablauf rueckt nach (eine Ursache, die
 * sich wiederholt, ist nicht abgelaufen). Ein beendeter Alarm gleichen
 * Schluessels wird nicht wiederbelebt, sondern beginnt neu.
 *
 * Rueckgabe: { eintrag, neu } - `neu` heisst: dieser Aufruf hat ihn eroeffnet.
 * `opt.seitMs` setzt den Beginn (Altbestand einlesen), sonst jetzt.
 */
export function melde(liste, { titel, text = "", quelle = "bruecke" }, jetzt = Date.now(), opt = {}) {
  const k = klassifiziere(titel);
  const schluessel = k.name;
  let e = liste.alarme.find((a) => a.status === "offen" && a.schluessel === schluessel);
  if (e) {
    e.anzahl += 1;
    e.zuletzt = jetzt;
    e.text = text;
    e.titel = titel;
    if (e.ablaufAm !== null) e.ablaufAm = jetzt + k.ablaufMs;
    return { eintrag: e, neu: false };
  }
  const seit = Number.isFinite(opt.seitMs) ? opt.seitMs : jetzt;
  e = {
    id: schluessel + "#" + seit,
    schluessel,
    titel,
    text,
    quelle,
    klasse: k.klasse,
    messung: k.messung,
    status: "offen",
    seit,
    zuletzt: seit,
    anzahl: 1,
    ablaufAm: k.ablaufMs === null ? null : Math.max(seit, jetzt) + k.ablaufMs,
    sofortTitel: opt.sofortTitel || null,
    beendetAm: null,
    beendetDurch: null,
    beleg: null,
  };
  liste.alarme.push(e);
  kuerze(liste);
  return { eintrag: e, neu: true };
}

function schliesse(e, jetzt, durch, beleg) {
  e.status = "beendet";
  e.beendetAm = jetzt;
  e.beendetDurch = durch;
  e.beleg = beleg || null;
  return e;
}

/**
 * Eine MESSUNG meldet: die Ursache ist weg. Beendet alle offenen Alarme, die
 * auf diese Messung warten. Ohne Beleg (nichts Gemessenes) passiert nichts -
 * "ich glaube, es ist weg" beendet keinen Schutzalarm.
 * Rueckgabe: die beendeten Eintraege.
 */
export function messe(liste, messung, beleg, jetzt = Date.now()) {
  if (!messung || typeof beleg !== "string" || !beleg.trim()) return [];
  const weg = [];
  for (const e of liste.alarme) {
    if (e.status === "offen" && e.messung === messung) weg.push(schliesse(e, jetzt, "messung:" + messung, beleg.trim()));
  }
  kuerze(liste);
  return weg;
}

/**
 * Ablauf. Beendet NUR Alarme, die ablaufen duerfen (`ablaufAm` gesetzt) -
 * Schutzalarme haben keinen. Rueckgabe: die beendeten Eintraege.
 */
export function verfalle(liste, jetzt = Date.now()) {
  const weg = [];
  for (const e of liste.alarme) {
    if (e.status === "offen" && e.klasse !== "schutz" && Number.isFinite(e.ablaufAm) && jetzt >= e.ablaufAm) {
      weg.push(schliesse(e, jetzt, "ablauf", "kein erneutes Auftreten seit " + new Date(e.zuletzt).toISOString()));
    }
  }
  kuerze(liste);
  return weg;
}

/**
 * Von Hand beenden. Schutzalarme nur mit Beleg (>= BELEG_MIN Zeichen: was
 * wurde gemessen?). Wirft, wenn der Alarm fehlt oder der Beleg zu duenn ist.
 */
export function beende(liste, idOderSchluessel, { beleg = "" } = {}, jetzt = Date.now()) {
  const e = liste.alarme.find((a) => a.status === "offen"
    && (a.id === idOderSchluessel || a.schluessel === idOderSchluessel));
  if (!e) throw new Error("Kein offener Alarm '" + idOderSchluessel + "'.");
  const b = String(beleg || "").trim();
  if (e.klasse === "schutz" && b.length < BELEG_MIN) {
    throw new Error("'" + e.schluessel + "' ist ein Schutzalarm: Beenden nur mit Beleg (mind. "
      + BELEG_MIN + " Zeichen - was wurde gemessen?).");
  }
  const zu = schliesse(e, jetzt, "hand", b || null);
  kuerze(liste);
  return zu;
}

/** Beendete Alarme begrenzen: die letzten HISTORIE_MAX, offene immer alle. */
function kuerze(liste) {
  const zu = liste.alarme.filter((a) => a.status !== "offen");
  if (zu.length <= HISTORIE_MAX) return;
  const behalten = new Set(zu.sort((x, y) => y.beendetAm - x.beendetAm).slice(0, HISTORIE_MAX));
  liste.alarme = liste.alarme.filter((a) => a.status === "offen" || behalten.has(a));
}

/** Pruefen, dass eine eingelesene Datei die Form hat, auf die der Rest baut. */
export function istListe(x) {
  return !!x && x.schema === SCHEMA && Array.isArray(x.alarme)
    && x.alarme.every((a) => a && typeof a.schluessel === "string" && typeof a.status === "string");
}

/**
 * Laden. Fehlt die Datei: leere Liste. Ist sie unlesbar oder falsch geformt:
 * die Datei wird BEISEITEGELEGT (alarme.json.kaputt-<ms>), nicht ueberschrieben
 * - sonst waeren offene Schutzalarme still verloren - und `kaputt` meldet es.
 */
export async function lade(datei) {
  let roh;
  try {
    roh = await readFile(datei, "utf8");
  } catch (e) {
    if (e && e.code === "ENOENT") return { liste: leereListe(), kaputt: null };
    return { liste: leereListe(), kaputt: "nicht lesbar: " + (e && (e.code || e.message)), beiseite: null };
  }
  try {
    const x = JSON.parse(roh);
    if (!istListe(x)) throw new Error("Form passt nicht (schema/alarme)");
    return { liste: x, kaputt: null };
  } catch (e) {
    const ziel = datei + ".kaputt-" + Date.now();
    try { await copyFile(datei, ziel); } catch { /* dann eben ohne Kopie, Meldung bleibt */ }
    return { liste: leereListe(), kaputt: "ungueltig: " + e.message, beiseite: ziel };
  }
}

/** Atomar schreiben: erst daneben, dann umbenennen. */
export async function speichere(datei, liste) {
  await mkdir(path.dirname(datei), { recursive: true });
  const tmp = datei + ".tmp";
  await writeFile(tmp, JSON.stringify(liste, null, 1), "utf8");
  await rename(tmp, datei);
}

/** Kurzfassung fuer Dashboard und Anzeige (offene, ohne Volltext). */
export function uebersicht(liste, max = 20) {
  return offene(liste).slice(0, max).map((a) => ({
    id: a.id, titel: a.titel, klasse: a.klasse, seit: new Date(a.seit).toISOString(),
    zuletzt: new Date(a.zuletzt).toISOString(), anzahl: a.anzahl,
    endetDurch: a.messung ? "messung:" + a.messung : a.klasse === "schutz" ? "nur von Hand mit Beleg" : "ablauf",
    ablaufAm: Number.isFinite(a.ablaufAm) ? new Date(a.ablaufAm).toISOString() : null,
  }));
}
