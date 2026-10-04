/**
 * Erzeugt die Referenzkurve des Bladeburner-Rangs aus den Rohdaten.
 *
 * WARUM ERZEUGT UND NICHT ABGESCHRIEBEN (Befund 04.09.2026)
 * Die erste Fassung der Kurve stand als Zahlenliste im Modul, von Hand aus den
 * Daten uebertragen. Ein Skeptiker fand dort einen Zeilenversatz: der
 * Stuetzpunkt {h 21,39 / Rang 903} war falsch - bei h 21,39 stand der Rang bei
 * 713, Rang 903 wurde erst bei h 25,14 erreicht. Die Stunde stammte aus einer
 * Zeile, der Rang aus einer anderen.
 *
 * Die Folge war kein Rundungsfehler, sondern ein eingebauter Fehlalarm: die
 * daraus gerechnete "falsifizierbare Probe" verlangte 169 Rang/h, wo in
 * Wirklichkeit 45/h zu erwarten sind. Beim naechsten Check-in haette der Bericht
 * einen gesunden Lauf als Befund gemeldet.
 *
 * Dieselbe Lehre wie bei der RAM-Tabelle am selben Tag: was aus den Rohdaten
 * ERZEUGT wird, kann nicht abweichen. Von Hand uebertragene Zahlen koennen es
 * immer.
 *
 * Aufruf: node tools/rangkurve-bauen.js [--knoten 10] [--out <datei>] [--mit-sicherungen]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

function flagZahl(name, ersatz) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? Number(process.argv[i + 1]) : ersatz;
}
function flagText(name, ersatz) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : ersatz;
}

const KNOTEN = flagZahl("--knoten", 10);
const ZIEL = flagText("--out", path.join(ROOT, "doku", "rangkurve-bn" + KNOTEN + ".json"));

// --- Rohdaten einsammeln ----------------------------------------------------

const punkte = [];

const verlaufDatei = path.join(ROOT, "data", "verlauf-strategie.json");
if (fs.existsSync(verlaufDatei)) {
  const p = JSON.parse(fs.readFileSync(verlaufDatei, "utf8")).punkte || [];
  for (const e of p) {
    if (e.knoten !== KNOTEN) continue;
    if (!/Rang/i.test(e.traeger || "")) continue;
    if (!Number.isFinite(e.spielzeit) || !Number.isFinite(e.wert)) continue;
    punkte.push({ spielzeit: e.spielzeit, rang: e.wert, aktion: e.aktion || null, quelle: "verlauf" });
  }
}

const checkinDatei = path.join(ROOT, "data", "checkin.json");
if (fs.existsSync(checkinDatei)) {
  const p = JSON.parse(fs.readFileSync(checkinDatei, "utf8")).punkte || [];
  for (const e of p) {
    if (e.knoten !== KNOTEN) continue;
    if (!Number.isFinite(e.spielzeit) || !Number.isFinite(e.rang)) continue;
    // Punkte ohne Spielzeit sind wertlos - das Feld fehlt in aelteren Zeilen.
    if (e.spielzeit === 0) continue;
    punkte.push({ spielzeit: e.spielzeit, rang: e.rang, lauf: e.lauf ?? null, quelle: "checkin" });
  }
}

// DIE SPIELSTAENDE SIND DIE DICHTESTE QUELLE (04.10.2026). Check-ins gibt es
// nur, wenn Eric /bb aufruft - fuer BN2.1 waren es fuenf, der letzte bei Rang
// 48.635, knapp vier Stunden VOR dem Sprung. Die Kurve hielt diesen Punkt fuer
// das Knotenende, und die ETA fuer BN2.2 lag um diese vier Stunden zu frueh.
// Die Brueckensicherungen (backups/INDEX.tsv) kommen stuendlich und vor jedem
// Sprung; jede enthaelt Rang (bladeburner.data.rank) und totalPlaytime - die
// Uhr, in der auch die Check-ins zaehlen. Sie gehen hier mit ein.
// NUR AUF ANFORDERUNG (--mit-sicherungen): Fuer BN10 zerfiel der Referenzlauf
// beim Mischen (alte Check-in-Punkte vom September stehen offenbar nicht in
// totalPlaytime) - von 76 Punkten bis 4,56 Mio auf 18 bis 250.309. Fuer Laeufe
// ab dem 27.09. (BN2 und spaeter) passen beide Uhren zusammen.
const MIT_SICHERUNGEN = process.argv.includes("--mit-sicherungen");
const indexDatei = path.join(ROOT, "backups", "INDEX.tsv");
if (MIT_SICHERUNGEN && fs.existsSync(indexDatei)) {
  const { gunzipSync } = await import("node:zlib");
  for (const zeile of fs.readFileSync(indexDatei, "utf8").split(/\r?\n/)) {
    const c = zeile.split("\t");
    if (c.length < 10 || Number(c[4]) !== KNOTEN) continue;
    const datei = [c[10], c[9]].find((d) => d && fs.existsSync(d));
    if (!datei) continue;
    try {
      let o = JSON.parse(gunzipSync(fs.readFileSync(datei)).toString());
      if (o.data && o.data.PlayerSave) o = o.data;
      const ps = typeof o.PlayerSave === "string" ? JSON.parse(o.PlayerSave) : o.PlayerSave;
      const p = ps && ps.data;
      const rang = p && p.bladeburner && p.bladeburner.data && p.bladeburner.data.rank;
      if (!p || p.bitNodeN !== KNOTEN || !Number.isFinite(rang) || !(p.totalPlaytime > 0)) continue;
      punkte.push({ spielzeit: p.totalPlaytime, rang, lauf: Number(c[5]) || null, quelle: "sicherung:" + c[7] });
    } catch {
      // unlesbare Sicherung: tools/backup-check.js meldet das, hier zaehlt sie nicht
    }
  }
}

punkte.sort((a, b) => a.spielzeit - b.spielzeit);

// --- Laeufe trennen ---------------------------------------------------------
//
// Ein neuer Lauf beginnt, wenn der Rang FAELLT. Das ist verlaesslicher als das
// `lauf`-Feld, das in aelteren Zeilen fehlt: ein Filter allein auf den Knoten
// zoege die Lauf-2-Punkte (Rang 35, 41) mit herein und zerstoerte das untere
// Ende der Kurve.
const laeufe = [];
let aktuell = [];
let letzterRang = -1;
for (const p of punkte) {
  if (p.rang < letzterRang * 0.5 && aktuell.length) {
    laeufe.push(aktuell);
    aktuell = [];
  }
  aktuell.push(p);
  letzterRang = p.rang;
}
if (aktuell.length) laeufe.push(aktuell);

/**
 * Der Referenzlauf ist der laengste ABGESCHLOSSENE.
 *
 * Abgeschlossen ist ein Lauf, wenn ihm ein weiterer im selben Knoten folgt ODER
 * wenn der Bot inzwischen in einem anderen Knoten steht. Der zweite Fall fehlte
 * zuerst und kostete die gesamte BitNode-6-Kurve: 87 Messpunkte aus einem
 * vollstaendig gefahrenen Knoten wurden als "laeuft noch" verworfen, obwohl der
 * Bot seit dem 01.09. in BitNode 10 sitzt.
 *
 * BN6 ist die wichtigste Referenz ueberhaupt: es ist der einzige gefahrene
 * Bladeburner-Knoten mit Rangfaktor 1,0, und 30 der 40 Restlaeufe sind
 * Bladeburner-Laeufe.
 */
const aktuellerKnoten = (() => {
  // Der Motor schreibt data/bn4net.json ins SPIEL, nicht ins Projekt - von hier
  // aus ist sie nicht lesbar. Der aktuelle Knoten steht aber im Verlauf: es ist
  // der Knoten des juengsten Punktes ueberhaupt.
  let juengster = null;
  const verlauf = path.join(ROOT, "data", "verlauf-strategie.json");
  try {
    for (const e of JSON.parse(fs.readFileSync(verlauf, "utf8")).punkte || []) {
      if (!juengster || e.zeit > juengster.zeit) juengster = e;
    }
  } catch {
    // egal
  }
  const checkin = path.join(ROOT, "data", "checkin.json");
  try {
    for (const e of JSON.parse(fs.readFileSync(checkin, "utf8")).punkte || []) {
      if (!juengster || e.ts > (juengster.zeit || 0)) juengster = { zeit: e.ts, knoten: e.knoten };
    }
  } catch {
    // egal
  }
  return juengster ? Number(juengster.knoten) || null : null;
})();

const knotenVerlassen = aktuellerKnoten !== null && aktuellerKnoten !== KNOTEN;
const kandidaten = (knotenVerlassen ? laeufe : laeufe.slice(0, -1)).filter((l) => l.length >= 5);
// Referenz ist der Lauf, der am WEITESTEN kam (hoechster Rang), erst dann der
// mit den meisten Punkten. Seit die stuendlichen Sicherungen mitzaehlen
// (04.10.2026), hat ein abgebrochener, aber lange gelaufener Lauf leicht mehr
// Punkte als der fertige - nach Punktzahl gewann fuer BN10 ein Lauf, der bei
// Rang 5.297 endete, statt des Laufs bis 4,56 Mio.
const maxRang = (l) => Math.max(...l.map((p) => p.rang));
const referenz = kandidaten.sort((a, b) => (maxRang(b) - maxRang(a)) || (b.length - a.length))[0];

if (!referenz) {
  console.log("Kein abgeschlossener Referenzlauf fuer BitNode " + KNOTEN + " gefunden.");
  console.log("Gefundene Laeufe: " + laeufe.map((l) => l.length + " Punkte").join(", "));
  process.exit(1);
}

const t0 = referenz[0].spielzeit;
const kurve = referenz.map((p) => ({
  h: Math.round(((p.spielzeit - t0) / 3.6e6) * 1000) / 1000,
  rang: Math.round(p.rang),
  aktion: p.aktion || undefined,
}));

// --- Kennzahlen -------------------------------------------------------------

const raten = [];
for (let i = 1; i < kurve.length; i++) {
  const dh = kurve[i].h - kurve[i - 1].h;
  if (dh > 0.2) raten.push({ h: kurve[i].h, rang: kurve[i].rang, rate: (kurve[i].rang - kurve[i - 1].rang) / dh });
}

const ausgabe = {
  knoten: KNOTEN,
  erzeugtAm: new Date().toISOString(),
  erzeugtVon: "tools/rangkurve-bauen.js",
  quellen: ["data/verlauf-strategie.json", "data/checkin.json", "backups/INDEX.tsv (Sicherungen)"],
  hinweis:
    "Diese Datei wird ERZEUGT, nicht von Hand gepflegt. Bei neuen Daten neu " +
    "erzeugen: node tools/rangkurve-bauen.js --knoten " + KNOTEN + (MIT_SICHERUNGEN ? " --mit-sicherungen" : ""),
  nullpunkt: {
    spielzeitMs: t0,
    spielzeitH: Math.round((t0 / 3.6e6) * 1000) / 1000,
    bedeutung:
      "erster Messpunkt mit Bladeburner-Rang in diesem Lauf - NICHT belegbar " +
      "der Beitrittszeitpunkt. Fuer die Restzeit ohne Belang, weil nur " +
      "Differenzen gebildet werden; fuer den Vergleich zweier Laeufe aber schon.",
  },
  punkteGesamt: punkte.length,
  laeufeErkannt: laeufe.length,
  stuetzpunkte: kurve.length,
  rangSpanne: [kurve[0].rang, kurve[kurve.length - 1].rang],
  dauerH: kurve[kurve.length - 1].h,
  ratenSpanne: raten.length
    ? [Math.min(...raten.map((r) => r.rate)), Math.max(...raten.map((r) => r.rate))]
    : null,
  punkte: kurve,
};

fs.mkdirSync(path.dirname(ZIEL), { recursive: true });
fs.writeFileSync(ZIEL, JSON.stringify(ausgabe, null, 1), "utf8");

console.log("");
console.log("=== Referenzkurve BitNode " + KNOTEN + " ===");
console.log("  Rohpunkte gesamt      " + punkte.length);
console.log("  Laeufe erkannt        " + laeufe.length + "  (" + laeufe.map((l) => l.length).join(" / ") + " Punkte)");
console.log("  Referenzlauf          " + kurve.length + " Stuetzpunkte");
console.log("  Rang von/bis          " + kurve[0].rang + " bis " + kurve[kurve.length - 1].rang);
console.log("  Dauer                 " + kurve[kurve.length - 1].h.toFixed(2) + " h ab dem ersten Rangpunkt");
if (ausgabe.ratenSpanne) {
  console.log("  Raten von/bis         " + ausgabe.ratenSpanne[0].toFixed(1) + " bis " +
    ausgabe.ratenSpanne[1].toFixed(0) + " Rang/h  (Faktor " +
    Math.round(ausgabe.ratenSpanne[1] / Math.max(1, ausgabe.ratenSpanne[0])) + ")");
}
console.log("  geschrieben nach      " + ZIEL);
console.log("");
