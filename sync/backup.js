/**
 * Sicherung des Spielstands - die erste Baumassnahme des Umbaus (Auftrag 7.2).
 *
 * WARUM ZUERST
 * Erics einzige absolute Bedingung lautet: "mein savegame darf nicht zerstoert
 * werden. Das ist extrem wichtig - das ist die live file!" (03.09.2026). Am
 * 04.09.2026 gab es dafuer genau EINE Sicherung, und die stammte aus BitNode 6
 * vom 28.08. - der gesamte BN10-Fortschritt von 57 Stunden hatte keine.
 * Jede weitere Zeile dieses Projekts setzt voraus, dass diese Datei laeuft.
 *
 * WOHER DIE DATEN KOMMEN
 * Ueber die Remote-File-API-Methode `getSaveFile`. Sie serialisiert den
 * HAUPTSPEICHER des laufenden Spiels, nicht die IndexedDB - deshalb sieht sie
 * auch dann einen gueltigen Stand, wenn das Schreiben in die Datenbank
 * fehlschlaegt. Genau das ist der Fall, den `Player.lastSave` NICHT anzeigt:
 * das Feld wird vor dem Schreiben gesetzt, ein fehlgeschlagenes Schreiben
 * bleibt darin unsichtbar.
 *
 * ZWEI FORMATE, BEIDE MUESSEN GEHEN
 * - binary === true: `save` ist die gzip-Bytefolge als latin1-String. Sie wird
 *   UNVERAENDERT als .json.gz abgelegt - exakt das Format, das der Import des
 *   Spiels erwartet. Klartext weist der Import ab.
 * - binary === false: der Browser hat keine Compression Streams; `save` ist
 *   dann Base64 des Klartexts. Diese Datei bekommt "-b64" im Namen und die
 *   Endung .json, und der Fall ist zusaetzlich ein Befund - er trat hier noch
 *   nie auf, und ein nie erprobter Zweig ist eine Behauptung.
 *
 * FALLE BEIM LESEN (selbst erlebt 03.09.2026)
 * Wer die HTTP-Antwort als String zusammensetzt (b += chunk), zerreisst an der
 * UTF-8-Grenze das latin1-Gzip, und gunzip wirft "incorrect data check". Hier
 * laeuft alles ueber Buffer beziehungsweise ueber res.json() der fetch-API,
 * die die Grenze korrekt behandelt.
 */

import zlib from "node:zlib";
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import {
  ANLAESSE,
  BACKUP_BUDGET_BYTES,
  BACKUP_PRIMAER,
  BACKUP_SPIEGEL,
  INDEX_NAME,
  RAEUM_REIHENFOLGE,
} from "./instanz.js";

/** Gzip beginnt immer mit diesen drei Bytes. */
const MAGIC = [31, 139, 8];
/** Der entpackte Klartext beginnt genau so - alles andere ist kein Spielstand. */
const KLARTEXT_ANFANG = '{"ctor":"BitburnerSaveObject"';

// ---------------------------------------------------------------------------
// Holen
// ---------------------------------------------------------------------------

/**
 * Zieht den Spielstand ueber die Bruecke.
 * @param {number} dashPort Dashboard-Port der zustaendigen Bruecke.
 * @param {number} timeoutMs
 */
export async function holeSpielstand(dashPort, timeoutMs = 20000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  const begonnen = Date.now();
  try {
    const res = await fetch(`http://127.0.0.1:${dashPort}/api/rpc?method=getSaveFile`, {
      signal: ctl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (body.error) throw new Error(String(body.error));
    const r = body.result;
    if (!r || typeof r.save !== "string") throw new Error("Antwort ohne save-Feld");
    const binary = r.binary !== false;
    const roh = binary ? Buffer.from(r.save, "latin1") : Buffer.from(r.save, "base64");
    return { identifier: r.identifier, binary, roh, dauerMs: Date.now() - begonnen };
  } finally {
    clearTimeout(t);
  }
}

// ---------------------------------------------------------------------------
// Auswerten
// ---------------------------------------------------------------------------

/**
 * Entpackt und liest die Kennwerte, an denen sich ein Spielstand erkennen laesst.
 * Wirft, wenn die Datei kein Spielstand ist - das ist Absicht: eine unlesbare
 * Sicherung ist keine Sicherung, und ein Pruefer, der nie rot wird, ist keiner.
 */
export function lesenKennwerte(roh, binary = true) {
  let text;
  if (binary) {
    if (roh.length < 3 || roh[0] !== MAGIC[0] || roh[1] !== MAGIC[1] || roh[2] !== MAGIC[2]) {
      throw new Error(
        `Magic-Bytes falsch: ${[...roh.slice(0, 3)].join(",")} statt ${MAGIC.join(",")}`,
      );
    }
    text = zlib.gunzipSync(roh).toString("utf8");
  } else {
    text = roh.toString("utf8");
  }
  if (!text.startsWith(KLARTEXT_ANFANG)) {
    throw new Error(`Klartext beginnt nicht mit ${KLARTEXT_ANFANG}`);
  }

  const save = JSON.parse(text);
  const p = JSON.parse(save.data.PlayerSave).data;
  const st = JSON.parse(save.data.SettingsSave);

  // sourceFiles ist eine JSONMap: {"ctor":"JSONMap","data":[[n,stufe],...]}.
  // Der LAUF eines Knotens ist die vorhandene SF-Stufe plus eins - BN10 mit
  // SF10 auf Stufe 1 ist Lauf 2. Gemessen 04.09.2026: SF {1:1,4:1,5:1,6:1,10:1}
  // bei bitNodeN 10 ergibt Lauf 2, was mit dem protokollierten Stand
  // uebereinstimmt.
  const sfRoh = p.sourceFiles && p.sourceFiles.data ? p.sourceFiles.data : [];
  const sf = {};
  for (const [n, stufe] of sfRoh) sf[n] = stufe;
  const bitNodeN = p.bitNodeN;
  const lauf = (sf[bitNodeN] || 0) + 1;

  // Bladeburner liegt IM PlayerSave, nicht in einem eigenen Save-Schluessel
  // (gemessen 04.09.2026: save.data hat 15 Schluessel, keiner heisst
  // BladeburnerSave). Wer nach save.data.BladeburnerSave greift, bekommt
  // undefined und meldet stumm "kein Bladeburner" - in einem Knoten, dessen
  // einziger Ausgang die Division ist.
  const bb = p.bladeburner && (p.bladeburner.data || p.bladeburner);

  return {
    identifier: p.identifier,
    bitNodeN,
    lauf,
    sourceFiles: sf,
    hacking: p.skills ? p.skills.hacking : null,
    money: p.money,
    totalPlaytime: p.totalPlaytime,
    playtimeSinceLastBitnode: p.playtimeSinceLastBitnode,
    playtimeSinceLastAug: p.playtimeSinceLastAug,
    lastSave: p.lastSave,
    augs: (p.augmentations || []).length,
    queuedAugs: (p.queuedAugmentations || []).length,
    queuedAugNamen: (p.queuedAugmentations || []).map((a) => a.name || a),
    sleeves: (p.sleeves || []).length,
    city: p.city,
    factions: p.factions || [],
    bladeburnerRank: bb ? bb.rank : null,
    blackOpsComplete: bb ? bb.numBlackOpsComplete : null,
    remoteFileApiPort: st.RemoteFileApiPort,
    autosaveInterval: st.AutosaveInterval,
    excludeRunningScriptsFromSave: st.ExcludeRunningScriptsFromSave,
    autoexecScript: st.AutoexecScript,
    rohBytes: roh.length,
    klartextZeichen: text.length,
  };
}

// ---------------------------------------------------------------------------
// Index
// ---------------------------------------------------------------------------

const INDEX_SPALTEN = [
  "ts",
  "datei",
  "sha256",
  "identifier",
  "bitNode",
  "lauf",
  "totalPlaytime",
  "anlass",
  "bytes",
  "primaer",
  "spiegel",
];

export function indexPfad(ort) {
  return path.join(ort, INDEX_NAME);
}

export function leseIndex(ort) {
  const p = indexPfad(ort);
  if (!fs.existsSync(p)) return [];
  const zeilen = fs.readFileSync(p, "utf8").split("\n").filter((z) => z.trim());
  if (!zeilen.length) return [];
  const kopf = zeilen[0].split("\t");
  return zeilen.slice(1).map((z) => {
    const f = z.split("\t");
    const o = {};
    kopf.forEach((k, i) => (o[k] = f[i]));
    return o;
  });
}

export function schreibeIndexZeile(ort, eintrag) {
  const p = indexPfad(ort);
  if (!fs.existsSync(p)) {
    fs.mkdirSync(ort, { recursive: true });
    fs.writeFileSync(p, INDEX_SPALTEN.join("\t") + "\n", "utf8");
  }
  fs.appendFileSync(
    p,
    INDEX_SPALTEN.map((k) => String(eintrag[k] ?? "")).join("\t") + "\n",
    "utf8",
  );
}

/**
 * Der letzte Eintrag mit dem gegebenen Praefix - Grundlage fuer die
 * Rueckwaertssprung-Pruefung. Ein sinkendes totalPlaytime heisst zweiter Tab
 * oder Import und ist der einzige Detektor dafuer, dass eine fremde Instanz
 * mitschreibt.
 *
 * Sortiert wird nach totalPlaytime, nicht nach Zeilenreihenfolge: laeuft die
 * Sicherung nebenlaeufig (Bruecke stuendlich plus Werkzeug von Hand), koennen
 * zwei Zeilen in beliebiger Reihenfolge landen, und die juengere Zeile waere
 * dann zufaellig die aeltere Messung.
 */
export function letzterEintrag(ort, praefix = "LIVE_") {
  const zeilen = leseIndex(ort)
    .filter((z) => (z.datei || "").startsWith(praefix))
    .filter((z) => Number.isFinite(Number(z.totalPlaytime)));
  if (!zeilen.length) return null;
  return zeilen.reduce((a, b) =>
    Number(b.totalPlaytime) > Number(a.totalPlaytime) ? b : a,
  );
}

// ---------------------------------------------------------------------------
// Pruefen
// ---------------------------------------------------------------------------

/**
 * Harte Ablehnungsgruende nach Auftrag 7.2. Jeder einzelne macht die Sicherung
 * ungueltig; erst nach gruener Pruefung gilt ein Backup als vorhanden.
 */
export function pruefeKennwerte(k, erwartung = {}) {
  const gruende = [];

  if (erwartung.identifier && k.identifier !== erwartung.identifier) {
    gruende.push(`identifier ${k.identifier} statt ${erwartung.identifier}`);
  }
  if (erwartung.port != null && k.remoteFileApiPort !== erwartung.port) {
    gruende.push(
      `RemoteFileApiPort ${k.remoteFileApiPort} statt ${erwartung.port} - ` +
        "der Port ist der einzige Fingerabdruck, der Live von einer Kopie trennt",
    );
  }
  if (erwartung.minPlaytime != null && k.totalPlaytime < erwartung.minPlaytime) {
    gruende.push(
      `totalPlaytime ${k.totalPlaytime} kleiner als zuletzt ${erwartung.minPlaytime} - ` +
        "Rueckwaertssprung: zweiter Tab oder Import",
    );
  }
  if (erwartung.bitNode != null && k.bitNodeN !== erwartung.bitNode) {
    gruende.push(`bitNodeN ${k.bitNodeN} statt ${erwartung.bitNode}`);
  }
  if (erwartung.lauf != null && k.lauf !== erwartung.lauf) {
    gruende.push(`Lauf ${k.lauf} statt ${erwartung.lauf}`);
  }
  if (erwartung.anlass === "pre-jump" && k.queuedAugs > 0) {
    gruende.push(
      `queuedAugmentations ${k.queuedAugs} bei Anlass pre-jump - ` +
        "gekaufte, nicht eingebaute Augs verfallen beim Sprung",
    );
  }

  return { ok: gruende.length === 0, gruende };
}

export function pruefeDatei(datei, erwartung = {}) {
  const roh = fs.readFileSync(datei);
  // Der Klartextzweig ist am Namen erkennbar: -b64.json. Alles andere wird als
  // gzip gelesen und faellt an den Magic-Bytes durch, wenn es keines ist.
  const binary = !/-b64\.json$/.test(datei);
  const k = lesenKennwerte(roh, binary);
  const urteil = pruefeKennwerte(k, erwartung);
  return { ...urteil, kennwerte: k, sha256: sha(roh), binary };
}

function sha(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

// ---------------------------------------------------------------------------
// Ablegen
// ---------------------------------------------------------------------------

function zeitstempelName(d) {
  const z = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    "-" +
    z(d.getMonth() + 1) +
    "-" +
    z(d.getDate()) +
    "T" +
    z(d.getHours()) +
    "-" +
    z(d.getMinutes())
  );
}

export function dateiName(kennwerte, anlass, praefix, binary, jetzt) {
  const b64 = binary ? "" : "-b64";
  const endung = binary ? ".json.gz" : ".json";
  return (
    praefix +
    kennwerte.identifier +
    "_BN" +
    kennwerte.bitNodeN +
    "L" +
    kennwerte.lauf +
    "_" +
    zeitstempelName(jetzt) +
    "_" +
    anlass +
    b64 +
    endung
  );
}

/** Erkennt den Anlass am Dateinamen, ohne auf Teiltreffer hereinzufallen. */
function anlassVon(name) {
  const m = /_((?:pre-)?[a-z]+)(?:-b64)?\.json(?:\.gz)?$/.exec(name);
  return m ? m[1] : null;
}

/**
 * Loescht ueberzaehlige Sicherungen. Ohne Deckel schliessen sich "nie loeschen"
 * und "662 KB je Datei bei dutzenden Nachschueben je Bautag" gegenseitig aus.
 * pre-jump, pre-install und emergency werden nie geloescht.
 */
export function rotiere(ort, praefix = "LIVE_") {
  if (!fs.existsSync(ort)) return [];
  const geloescht = [];

  const listen = () =>
    fs
      .readdirSync(ort)
      .filter((f) => f.startsWith(praefix) && /\.json(\.gz)?$/.test(f))
      .map((f) => ({ f, anlass: anlassVon(f), stat: fs.statSync(path.join(ort, f)) }))
      .sort((a, b) => a.stat.mtimeMs - b.stat.mtimeMs);

  // 1. Deckel je Anlass
  const dateien = listen();
  for (const [anlass, deckel] of Object.entries(ANLAESSE)) {
    if (deckel == null) continue;
    const dieser = dateien.filter((d) => d.anlass === anlass);
    const zuviel = dieser.length - deckel;
    for (let i = 0; i < zuviel; i++) {
      fs.unlinkSync(path.join(ort, dieser[i].f));
      geloescht.push(dieser[i].f);
    }
  }

  // 2. Budget je Ort - in der festgelegten Reihenfolge, nie pre-jump/pre-install
  const rest = listen();
  let summe = rest.reduce((s, d) => s + d.stat.size, 0);
  for (const anlass of RAEUM_REIHENFOLGE) {
    if (summe <= BACKUP_BUDGET_BYTES) break;
    for (const d of rest.filter((x) => x.anlass === anlass)) {
      if (summe <= BACKUP_BUDGET_BYTES) break;
      const p = path.join(ort, d.f);
      if (!fs.existsSync(p)) continue;
      fs.unlinkSync(p);
      geloescht.push(d.f);
      summe -= d.stat.size;
    }
  }
  return geloescht;
}

/**
 * Der vollstaendige Sicherungsvorgang: holen, pruefen, ablegen, spiegeln,
 * indizieren, rotieren. Gibt ein Urteil zurueck - der Aufrufer entscheidet,
 * was er bei rot tut (die Bruecke: nicht schieben; ein Werkzeug: Exit 2).
 *
 * Geschrieben wird NUR bei gruener Pruefung. Eine abgelehnte Sicherung darf
 * nicht im Ablageort landen, sonst zaehlt sie beim naechsten Alterstest als
 * vorhandenes Netz mit.
 */
export async function sichere(opt) {
  const {
    dashPort,
    anlass = "manual",
    praefix = "LIVE_",
    erwartetIdentifier = null,
    erwartetPort = null,
    erwartetBitNode = null,
    primaer = BACKUP_PRIMAER,
    spiegel = BACKUP_SPIEGEL,
    jetzt = new Date(),
  } = opt;

  const geholt = await holeSpielstand(dashPort);
  const k = lesenKennwerte(geholt.roh, geholt.binary);

  const vorher = letzterEintrag(primaer, praefix);
  const urteil = pruefeKennwerte(k, {
    identifier: erwartetIdentifier,
    port: erwartetPort,
    minPlaytime: vorher ? Number(vorher.totalPlaytime) : null,
    bitNode: erwartetBitNode,
    anlass,
  });

  const name = dateiName(k, anlass, praefix, geholt.binary, jetzt);
  const orte = [];
  const geloescht = [];
  if (urteil.ok) {
    for (const ort of [primaer, spiegel].filter(Boolean)) {
      fs.mkdirSync(ort, { recursive: true });
      await fsp.writeFile(path.join(ort, name), geholt.roh);
      orte.push(path.join(ort, name));
    }
    const eintrag = {
      ts: jetzt.toISOString(),
      datei: name,
      sha256: sha(geholt.roh),
      identifier: k.identifier,
      bitNode: k.bitNodeN,
      lauf: k.lauf,
      totalPlaytime: k.totalPlaytime,
      anlass,
      bytes: geholt.roh.length,
      primaer: orte[0] || "",
      spiegel: orte[1] || "",
    };
    for (const ort of [primaer, spiegel].filter(Boolean)) schreibeIndexZeile(ort, eintrag);
    for (const ort of [primaer, spiegel].filter(Boolean)) {
      geloescht.push(...rotiere(ort, praefix));
    }
  }

  return {
    ok: urteil.ok,
    gruende: urteil.gruende,
    datei: name,
    orte,
    geloescht,
    kennwerte: k,
    binary: geholt.binary,
    dauerMs: geholt.dauerMs,
    b64Befund: !geholt.binary,
  };
}

/**
 * Alter der juengsten gruenen Sicherung in Minuten, aus dem Ablageort gelesen -
 * NICHT aus einem Zustand der Bruecke. Eine tote Bruecke meldet ihren Tod
 * nicht, und ein Alterswert, den sie selbst fuehrt, friert mit ihr ein.
 */
export function alterJuengsteMin(ort, praefix = "LIVE_", jetzt = Date.now()) {
  if (!fs.existsSync(ort)) return null;
  const dateien = fs
    .readdirSync(ort)
    .filter((f) => f.startsWith(praefix) && /\.json(\.gz)?$/.test(f));
  if (!dateien.length) return null;
  const juengste = dateien
    .map((f) => fs.statSync(path.join(ort, f)).mtimeMs)
    .reduce((a, b) => (b > a ? b : a));
  return (jetzt - juengste) / 60000;
}
