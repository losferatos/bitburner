/**
 * Laufzeit je Knoten: Lauf 2 gegen Lauf 1 (14.11.2026, Erics Wunsch:
 * "die aktuelle BN-Laufzeit mit der im vorigen Lauf vergleichen, auch fuer
 * BNs, die wir im zweiten Run schon erledigt haben").
 *
 * Schreibt dashboard/laufvergleich.json; das Dashboard liest die Datei ueber
 * die Bruecke (statische Auslieferung aus dashboard/) und rechnet die Laufzeit
 * des aktuellen Knotens live weiter.
 *
 * Quellen:
 *   Lauf 1  nodes/audit-lauf2/chronik.json (Teil 1 des Audits; Wanduhr je
 *           Knoten, Online-Zeit ab 03.09.2026). BN8.3 fehlt dort und wird aus
 *           dem Archiv backups/lauf1 ergaenzt.
 *   Lauf 2  backups/INDEX.tsv der laufenden Epoche: je Knoten und Stufe die
 *           erste Sicherung, daraus lastNodeReset aus dem Spielstand (der
 *           sekundengenaue Knotenbeginn). Ende = Beginn des naechsten Knotens.
 *
 * Uhr: Wanduhr in beiden Laeufen (Online-Zeit gibt es fuer Lauf 1 nicht
 * durchgehend; sie steht zusaetzlich drin, wo bekannt).
 *
 * Aufruf: node tools/laufvergleich.js   (checkin.js ruft es bei jedem Besuch)
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function liesSicherung(datei) {
  let roh = zlib.gunzipSync(fs.readFileSync(datei));
  let save;
  try { save = JSON.parse(roh.toString("utf8")); } catch { save = JSON.parse(zlib.gunzipSync(roh).toString("utf8")); }
  if (typeof save === "string") save = JSON.parse(save);
  return JSON.parse(save.data.PlayerSave).data;
}

function indexZeilen(pfad) {
  if (!fs.existsSync(pfad)) return [];
  const [kopf, ...zeilen] = fs.readFileSync(pfad, "utf8").split(/\r?\n/).filter(Boolean);
  const k = kopf.split("\t");
  return zeilen.map((z) => Object.fromEntries(z.split("\t").map((v, i) => [k[i], v])));
}

/** Knotenbeginne einer Sicherungskette: [{key, node, level, startMs}] in Reihenfolge. */
export function knotenAusKette(ordner) {
  const zeilen = indexZeilen(path.join(ordner, "INDEX.tsv"))
    .filter((z) => z.datei && z.bitNode && z.lauf)
    .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  const out = [];
  for (const z of zeilen) {
    const key = Number(z.bitNode) + "." + Number(z.lauf);
    if (out.length && out[out.length - 1].key === key) continue;
    let startMs = Date.parse(z.ts); // Rueckfall: Zeitpunkt der Sicherung
    try {
      const pl = liesSicherung(path.join(ordner, z.datei));
      if (Number.isFinite(pl.lastNodeReset) && pl.lastNodeReset > 0) startMs = pl.lastNodeReset;
    } catch { /* Datei rotiert oder unlesbar - dann der Zeitstempel der Zeile */ }
    out.push({ key, node: Number(z.bitNode), level: Number(z.lauf), startMs });
  }
  return out;
}

export function baueVergleich(root = ROOT, jetzt = Date.now()) {
  const lauf1 = {};
  try {
    for (const c of JSON.parse(fs.readFileSync(path.join(root, "nodes", "audit-lauf2", "chronik.json"), "utf8"))) {
      lauf1[c.node + "." + c.level] = { wallH: c.wallH ?? null, onlineH: c.onlineH ?? null };
    }
  } catch { /* ohne Chronik kein Lauf-1-Vergleich */ }
  // BN8.3 (und alles nach dem Audit) aus dem Lauf-1-Archiv ergaenzen.
  const archiv = knotenAusKette(path.join(root, "backups", "lauf1"));
  for (let i = 0; i < archiv.length; i++) {
    const k = archiv[i];
    if (lauf1[k.key] || i === archiv.length - 1) continue;
    lauf1[k.key] = { wallH: +((archiv[i + 1].startMs - k.startMs) / 3600000).toFixed(2), onlineH: null };
  }
  // Der letzte Archiv-Knoten (BN1-Landeplatz) ist kein Lauf; BN8.3 endete mit ihm.
  if (archiv.length >= 2 && !lauf1["8.3"]) {
    const a = archiv.findIndex((k) => k.key === "8.3");
    if (a >= 0 && a + 1 < archiv.length) lauf1["8.3"] = { wallH: +((archiv[a + 1].startMs - archiv[a].startMs) / 3600000).toFixed(2), onlineH: null };
  }

  const kette = knotenAusKette(path.join(root, "backups"));
  const lauf2 = kette.map((k, i) => ({
    key: k.key, node: k.node, level: k.level, startMs: k.startMs,
    endMs: i + 1 < kette.length ? kette[i + 1].startMs : null,
    wallH: i + 1 < kette.length ? +((kette[i + 1].startMs - k.startMs) / 3600000).toFixed(2) : null,
    lauf1: lauf1[k.key] || null,
  }));
  return { erzeugt: jetzt, uhr: "Wanduhr", lauf2, lauf1 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const v = baueVergleich();
  fs.writeFileSync(path.join(ROOT, "dashboard", "laufvergleich.json"), JSON.stringify(v, null, 1));
  for (const k of v.lauf2) {
    const l2 = k.wallH ?? (Date.now() - k.startMs) / 3600000;
    console.log("BN" + k.key + ": Lauf 2 " + l2.toFixed(1) + " h" + (k.wallH === null ? " (laeuft)" : "")
      + " | Lauf 1 " + (k.lauf1 && k.lauf1.wallH !== null ? k.lauf1.wallH.toFixed(1) + " h" : "?"));
  }
}
