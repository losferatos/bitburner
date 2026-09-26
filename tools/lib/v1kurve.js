/**
 * Referenzkurve fuer den Hackingweg (V1) - die Fertig-Schaetzung, die
 * tools/checkin.js dort bisher nie geben konnte (BAUSTELLEN 25.09.2026).
 *
 * WARUM NICHT DAS LEVEL DIREKT
 *
 * Im V1-Knoten baut der Bot alle ein bis drei Stunden ein, und jeder Einbau
 * wirft das Hacking-Level auf wenige Punkte zurueck. Eine Rate aus zwei
 * Messpunkten ist deshalb Zufall. Monoton ist nur der HOECHSTSTAND des
 * Laufs: BN1.2 kam vor den Einbauten auf 164, 368, 432, 567, 796 ... 4115.
 *
 * ZWEI UHREN, EINE SPANNE (Skeptiker 25.09.2026)
 *
 * In BN1.2 war das Spiel 388 min getrennt. Das Level kam dabei nur von 871
 * auf 946 - aber die Nacht war NICHT leer: Ruf x9, Geld +2,4 Billionen,
 * Hacking-Erfahrung 20 -> 50 Mio (Offline-Fortschritt des Spiels). Wie viel
 * davon den Lauf verkuerzt hat, ist nicht geeicht. Deshalb zwei Uhren:
 *   - online: Wanduhr minus die Fenster, in denen die Bruecke "Spielverbindung
 *     getrennt" meldet (wie tools/rueckstand.js) - zaehlt die Nacht als null;
 *   - Wanduhr: zaehlt die Nacht voll.
 * Die wahre Restzeit liegt dazwischen; checkin nennt beide.
 * Grenze: eine tote Bruecke bei ausgeschaltetem Rechner schreibt kein
 * "getrennt" - solche Zeit zaehlt auch auf der Online-Uhr mit.
 *
 * WAS DIE ZAHL IST
 *
 * Die Restzeit des Referenzlaufs ab der Stelle, an der er denselben
 * Hoechststand hatte. Die Schlussphase (Daedalus-Ruf, The Red Pill,
 * w0r1d_d43m0n) steckt im Kurvenende, weil das Ende der Sprung selbst ist.
 * Direkt nach einem Einbau steht der Hoechststand bis zu einer Stunde still;
 * die Restzeit bleibt dann stehen, das Datum wandert mit der Uhr.
 *
 * Die Sicherungen eines Laufs rotieren nach etwa 48 h (hourly: 48,
 * sync/instanz.js) - checkin baut die Kurve deshalb selbst, sobald der
 * naechste Lauf desselben Knotens begonnen hat (baueKurve unten).
 */

import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";

/** Offline-Fenster [von, bis] in ms aus dem Brueckenprotokoll. */
export function offlineFenster(logText) {
  const fenster = [];
  let offen = null;
  for (const zeile of String(logText || "").split("\n")) {
    const tab = zeile.indexOf("\t");
    if (tab < 0) continue;
    const t = Date.parse(zeile.slice(0, tab));
    if (!Number.isFinite(t)) continue;
    if (/Spielverbindung getrennt/.test(zeile)) { if (offen === null) offen = t; }
    else if (/Spiel verbunden/.test(zeile) && offen !== null) { fenster.push([offen, t]); offen = null; }
  }
  if (offen !== null) fenster.push([offen, Infinity]);
  return fenster;
}

/** Online-Stunden zwischen a und b (ms), Offline-Fenster abgezogen. */
export function onlineStunden(a, b, fenster) {
  if (!(b > a)) return 0;
  let ms = b - a;
  for (const [x, y] of fenster || []) {
    const lo = Math.max(a, x), hi = Math.min(b, y);
    if (hi > lo) ms -= hi - lo;
  }
  return ms / 3600000;
}

/** Zeilen aus backups/INDEX.tsv: {ts, datei, knoten, lauf, anlass}. */
export function indexZeilen(tsvText) {
  const out = [];
  for (const z of String(tsvText || "").split("\n")) {
    const s = z.split("\t");
    if (s.length < 8 || s[0] === "ts") continue;
    const ts = Date.parse(s[0]);
    if (!Number.isFinite(ts)) continue;
    out.push({ ts, datei: s[1], knoten: Number(s[4]), lauf: Number(s[5]), anlass: s[7] });
  }
  return out.sort((a, b) => a.ts - b.ts);
}

/** Beginn (Sprung hinein) und Ende (Sprung hinaus) eines Laufs, ms oder null. */
export function laufGrenzen(zeilen, knoten, lauf) {
  const eigene = zeilen.filter((z) => z.knoten === knoten && z.lauf === lauf);
  if (!eigene.length) return { start: null, ende: null };
  const erste = eigene[0].ts;
  // Beginn = die letzte pre-jump-Sicherung des VORIGEN Laufs vor dem ersten
  // eigenen Eintrag. Fehlt sie, gilt der erste eigene Eintrag (spaeter als der
  // echte Beginn - die Online-Zeit wird dann unterschaetzt, nie ueberschaetzt).
  // Massgeblich ist die LETZTE fremde Zeile vor dem ersten eigenen Eintrag:
  // nur wenn sie ein pre-jump ist, markiert sie den Sprung. Ein aelterer
  // pre-jump weiter zurueck gehoert zu einem frueheren Wechsel (BN5.3 haette
  // sonst ab dem BN1.3-Sprung gezaehlt, weil BN5.2 ohne pre-jump endete).
  const vorher = zeilen.filter((z) => z.ts <= erste && !(z.knoten === knoten && z.lauf === lauf)).pop();
  const sprungHinein = vorher && vorher.anlass === "pre-jump" ? vorher : null;
  const sprungHinaus = eigene.filter((z) => z.anlass === "pre-jump").pop();
  // Ohne pre-jump (BN5.2, 26.09.2026: Sprung ueber die BitVerse-Auswahl von
  // Hand, keine Sicherung): gilt der Lauf als beendet, sobald ein SPAETERER
  // Lauf im Index steht, und sein Ende ist die letzte eigene Sicherung. Das
  // ueberschaetzt die Laufzeit um hoechstens den Abstand zur letzten Sicherung.
  const letzte = eigene[eigene.length - 1].ts;
  const spaeter = zeilen.some((z) => z.ts > letzte && !(z.knoten === knoten && z.lauf === lauf));
  const ende = sprungHinaus ? sprungHinaus.ts : (spaeter ? letzte : null);
  return { start: sprungHinein ? sprungHinein.ts : erste, ende };
}

/** Hacking-Level aus einer gzip-Sicherung. */
export function levelAusSicherung(pfad) {
  let roh = zlib.gunzipSync(fs.readFileSync(pfad));
  let save;
  try { save = JSON.parse(roh.toString("utf8")); } catch { save = JSON.parse(zlib.gunzipSync(roh).toString("utf8")); }
  if (typeof save === "string") save = JSON.parse(save);
  return JSON.parse(save.data.PlayerSave).data.skills.hacking;
}

/** Punkte {h, maxLevel}: Online-Stunden seit Beginn gegen den Hoechststand bis dahin. */
export function kurvenPunkte(roh, start, fenster) {
  let max = 0;
  const pkt = [];
  for (const r of [...roh].sort((a, b) => a.ts - b.ts)) {
    if (!Number.isFinite(r.level)) continue;
    max = Math.max(max, r.level);
    pkt.push({ h: +onlineStunden(start, r.ts, fenster).toFixed(3),
      hWand: +((r.ts - start) / 3600000).toFixed(3), maxLevel: max });
  }
  return pkt;
}

/**
 * Restzeit gegen die Referenz, auf der Online-Uhr (Standard) oder der
 * Wanduhr (uhr = "wand").
 * @returns {{restH:number, refH:number, jenseits:boolean}|null}
 */
export function restzeitV1(ref, maxLevel, uhr = "online") {
  if (!ref || !Array.isArray(ref.punkte) || !ref.punkte.length) return null;
  const gesamt = uhr === "wand" ? ref.wandH : ref.gesamtH;
  if (!Number.isFinite(gesamt) || !Number.isFinite(maxLevel)) return null;
  const feld = uhr === "wand" ? "hWand" : "h";
  if (!ref.punkte.every((x) => Number.isFinite(x[feld]))) return null;
  const p = ref.punkte.map((x) => ({ h: x[feld], maxLevel: x.maxLevel }));
  let refH;
  const i = p.findIndex((x) => x.maxLevel >= maxLevel);
  if (i < 0) refH = p[p.length - 1].h;
  else if (i === 0) refH = p[0].h;
  else {
    const a = p[i - 1], b = p[i];
    // Erster Zeitpunkt, an dem die Referenz diesen Stand erreichte: linear
    // zwischen den Sicherungen (stuendlich + vor jedem Einbau).
    refH = b.maxLevel === a.maxLevel ? b.h
      : a.h + (b.h - a.h) * (maxLevel - a.maxLevel) / (b.maxLevel - a.maxLevel);
  }
  return { restH: Math.max(0, gesamt - refH), refH, jenseits: i < 0 };
}

/**
 * Baut die Kurve eines abgeschlossenen Laufs und schreibt sie nach
 * data/v1kurve-BN<knoten>.json. Liefert die Kurve oder einen Grund.
 */
export function baueKurve(root, knoten, lauf) {
  const zeilen = indexZeilen(fs.readFileSync(path.join(root, "backups", "INDEX.tsv"), "utf8"));
  const { start, ende } = laufGrenzen(zeilen, knoten, lauf);
  if (!start || !ende) return { grund: "Lauf BN" + knoten + "." + lauf + " nicht abgeschlossen oder nicht im Index" };
  const fenster = offlineFenster(fs.readFileSync(path.join(root, "data", "bridge.log"), "utf8"));
  const roh = [];
  for (const z of zeilen.filter((z) => z.knoten === knoten && z.lauf === lauf)) {
    const pfad = path.join(root, "backups", z.datei);
    if (!fs.existsSync(pfad)) continue;
    try { roh.push({ ts: z.ts, level: levelAusSicherung(pfad) }); } catch { /* unlesbar: auslassen */ }
  }
  const punkte = kurvenPunkte(roh, start, fenster);
  // Weniger als sechs lesbare Sicherungen: rotiert, keine brauchbare Kurve.
  if (punkte.length < 6) return { grund: "nur " + punkte.length + " Sicherungen von BN" + knoten + "." + lauf + " lesbar (rotiert?)" };
  const kurve = {
    knoten, lauf, start: new Date(start).toISOString(), ende: new Date(ende).toISOString(),
    gesamtH: +onlineStunden(start, ende, fenster).toFixed(3), wandH: +((ende - start) / 3600000).toFixed(3), punkte,
    quelle: "tools/lib/v1kurve.js baueKurve aus backups/INDEX.tsv und data/bridge.log",
  };
  fs.writeFileSync(path.join(root, "data", "v1kurve-BN" + knoten + ".json"), JSON.stringify(kurve, null, 1));
  return { kurve };
}
