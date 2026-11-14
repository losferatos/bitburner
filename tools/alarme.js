/**
 * Werkzeug zur Alarmliste (B08, 14.11.2026).
 *
 * Die Bruecke fuehrt ihre Alarme in data/alarme.json (sync/alarmliste.js):
 * Klasse, Beginn, Anzahl, Ende. Dieses Werkzeug ist der Mensch-Zugang dazu und
 * raeumt EINMAL den Altbestand in `## Sofort` von nodes/BAUSTELLEN.md auf.
 *
 * AUFRUFE
 *   node tools/alarme.js --zeige
 *       Offene Alarme (aus data/alarme.json) und was `## Sofort` enthaelt.
 *   node tools/alarme.js --beende <id|schluessel> --beleg "<was wurde gemessen>"
 *       Einen Alarm von Hand beenden. Schutzalarme nur MIT Beleg (mind. 12
 *       Zeichen). Fuer Alarme, auf die die Bruecke keine eigene Messung hat.
 *   node tools/alarme.js --bereinigen [--ausfuehren]
 *       Altbestand in `## Sofort` einmal aufraeumen. OHNE --ausfuehren nur der
 *       Plan (Trockenlauf). Weitere Schalter: --messung <name>=<beleg>
 *       (wiederholbar), --wurzel <ordner>, --data <ordner>, --jetzt <iso>.
 *
 * WAS --bereinigen MACHT (je Eintrag unter `## Sofort`)
 *   - Titel beginnt mit ERLEDIGT / UEBERHOLT / ENTSCHIEDEN: nach ERLEDIGT.md.
 *   - Auto-Alarm der Bruecke, Klasse "zustand" (Tab zu, Telemetrie alt,
 *     Autosave): nach ERLEDIGT.md. Es ist eine Momentaufnahme; gilt sie noch,
 *     meldet die Bruecke neu (sie hat keinen Speicher davon).
 *   - Auto-Alarm, Klasse "vorfall": nach ERLEDIGT.md, wenn sein Alter bekannt
 *     und ueber dem Ablauf ist; sonst bleibt er und wird in alarme.json gefuehrt.
 *   - Auto-Alarm, Klasse "schutz": der JUENGSTE je Ursache bleibt und wird in
 *     alarme.json eingetragen; aeltere Wiederholungen derselben Ursache gehen
 *     nach ERLEDIGT.md. Ein Schutzalarm wird NIE ohne Messung beendet: nur mit
 *     --messung <name>=<beleg> (Namen siehe sync/alarmliste.js REGELN) gehen
 *     auch die juengsten.
 *   - Alles andere (von Hand geschriebene Arbeitspunkte, UNKLAR, ...): bleibt.
 * Das Alter eines Eintrags kommt aus der Fussnote "seit <ISO>" (Eintraege der
 * neuen Bruecke) oder aus nodes/BAU-2026-09/sofort/<zeit>-<quelle>.md (dort legt
 * die Bruecke jeden Eintrag zuerst ab). Ohne beides ist das Alter unbekannt.
 *
 * Schreibt nur mit --ausfuehren, ARCHIV ZUERST (nichts geht verloren, wenn
 * der zweite Schritt scheitert), mit Strukturpruefung wie tools/liste.js und
 * einer Sicherungskopie der Liste. Fasst nur die Dateien unter --wurzel an;
 * Vorgabe ist der Ordner, in dem dieses Werkzeug liegt.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as AL from "../sync/alarmliste.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Zerlegen (wie tools/liste.js: Abschnitte ueber Zeilennummern nach der ersten ---)
// ---------------------------------------------------------------------------

/** Text in LF-Zeilen; merkt sich die Zeilenenden fuer das Zurueckschreiben. */
function lies(datei) {
  const roh = fs.readFileSync(datei, "utf8");
  const crlf = roh.includes("\r\n");
  return { lines: roh.replace(/\r\n/g, "\n").split("\n"), crlf };
}

/** { lines, headEnd, sections: [{title, start, end}] } - 0-basiert, end exklusiv. */
export function zerlege(lines) {
  const headEnd = lines.findIndex((l) => l.trim() === "---");
  if (headEnd < 0) throw new Error("keine ---Trennlinie, Kopf nicht abgrenzbar");
  const heads = [];
  for (let i = headEnd + 1; i < lines.length; i++) if (lines[i].startsWith("## ")) heads.push(i);
  const sections = heads.map((start, n) => ({
    title: lines[start].slice(3).trim(),
    start,
    end: n + 1 < heads.length ? heads[n + 1] : lines.length,
  }));
  return { lines, headEnd, sections };
}

/** Die `### `-Punkte eines Abschnitts: { start, end, titel, text }. */
function punkte(z, s) {
  const out = [];
  for (let i = s.start + 1; i < s.end; i++) {
    if (z.lines[i].startsWith("### ")) out.push({ start: i, titel: z.lines[i].slice(4).trim() });
  }
  out.forEach((p, n) => {
    p.end = n + 1 < out.length ? out[n + 1].start : s.end;
    p.text = z.lines.slice(p.start, p.end).join("\n").trimEnd();
  });
  return out;
}

// ---------------------------------------------------------------------------
// Alter eines Eintrags
// ---------------------------------------------------------------------------

/** "seit 2026-11-14T01:02:03.000Z" aus der Fussnote der neuen Bruecke. */
function stempelAusFussnote(text) {
  const m = /\*Alarm \S+ \(\w+\) seit (\d{4}-\d\d-\d\dT[\d:.]+Z)/.exec(text);
  return m ? Date.parse(m[1]) : null;
}

/** Dateiname der Bruecke: 2026-09-04T02-27-11-123Z-bruecke.md -> ms. */
function stempelAusDateiname(name) {
  const m = /^(\d{4}-\d\d-\d\d)T(\d\d)-(\d\d)-(\d\d)-(\d{3})Z/.exec(name);
  return m ? Date.parse(m[1] + "T" + m[2] + ":" + m[3] + ":" + m[4] + "." + m[5] + "Z") : null;
}

/**
 * Die Ablagedateien der Bruecke lesen: titel -> [ms, neueste zuerst].
 * Fehlender Ordner = keine Altersangaben (kein Fehler).
 */
export function leseAblage(ordner) {
  const nachTitel = new Map();
  let namen = [];
  try { namen = fs.readdirSync(ordner); } catch { return nachTitel; }
  for (const n of namen) {
    const ms = stempelAusDateiname(n);
    if (ms === null) continue;
    let inhalt;
    try { inhalt = fs.readFileSync(path.join(ordner, n), "utf8"); } catch { continue; }
    const t = inhalt.replace(/\r\n/g, "\n").split("\n")[0];
    if (!t.startsWith("### ")) continue;
    const titel = t.slice(4).trim();
    if (!nachTitel.has(titel)) nachTitel.set(titel, []);
    nachTitel.get(titel).push(ms);
  }
  for (const l of nachTitel.values()) l.sort((a, b) => b - a);
  return nachTitel;
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

const MARKIERT = /^(ERLEDIGT|UEBERHOLT|ENTSCHIEDEN)\b/;

/**
 * Plan fuer `## Sofort`. Reine Funktion.
 * messungen: { "<messungsname>": "<beleg>" } - was der Mensch gemessen hat.
 * Rueckgabe: { archiv: [{titel, text, grund}], bleibt: [{titel, art, grund}],
 *              eintragen: [{titel, text, schluessel, seitMs, klasse, messung}] }
 */
export function plane(z, { ablage = new Map(), messungen = {}, jetzt = Date.now() } = {}) {
  const s = z.sections.find((x) => x.title.toLowerCase().startsWith("sofort"));
  if (!s) throw new Error("Abschnitt 'Sofort' nicht gefunden.");
  const items = punkte(z, s);
  const plan = { archiv: [], bleibt: [], eintragen: [], punkte: items };
  const gruppen = new Map(); // regel.name -> [item], Dateireihenfolge = juengste zuerst
  const mitAlter = (it, nummerInGruppe) => {
    const f = stempelAusFussnote(it.text);
    if (f !== null) return f;
    const l = ablage.get(it.titel);
    return l && l[nummerInGruppe] !== undefined ? l[nummerInGruppe] : null;
  };

  for (const it of items) {
    if (MARKIERT.test(it.titel)) {
      plan.archiv.push({ item: it, grund: "als erledigt/ueberholt/entschieden markiert" });
      continue;
    }
    const k = AL.klassifiziere(it.titel);
    if (!k.bekannt) {
      plan.bleibt.push({ titel: it.titel, art: "hand", grund: "kein Auto-Alarm der Bruecke - von Hand geschriebener Punkt, braucht eine Entscheidung" });
      continue;
    }
    if (!gruppen.has(k.name)) gruppen.set(k.name, { k, liste: [] });
    gruppen.get(k.name).liste.push(it);
  }

  for (const { k, liste } of gruppen.values()) {
    // Titel kommen mit wechselnden Zahlen vor; die Ablage kennt den genauen Titel.
    const zaehler = new Map();
    liste.forEach((it, i) => {
      const n = zaehler.get(it.titel) || 0;
      zaehler.set(it.titel, n + 1);
      it.alterMs = mitAlter(it, n);
      it.nummer = i;
    });
    const beleg = k.messung ? messungen[k.messung] : null;
    for (const it of liste) {
      if (k.klasse === "zustand") {
        plan.archiv.push({ item: it, grund: "Momentaufnahme (" + k.name + "); gilt sie noch, meldet die Bruecke neu" });
      } else if (k.klasse === "vorfall") {
        if (it.alterMs !== null && jetzt - it.alterMs > k.ablaufMs) {
          plan.archiv.push({ item: it, grund: "Vorfall, ueber dem Ablauf (" + Math.round(k.ablaufMs / 3600000) + " h)" });
        } else {
          plan.bleibt.push({ titel: it.titel, art: "vorfall", grund: it.alterMs === null ? "Alter unbekannt - bleibt" : "noch nicht abgelaufen" });
          plan.eintragen.push({ item: it, k, seitMs: it.alterMs });
        }
      } else if (beleg) {
        plan.archiv.push({ item: it, grund: "Schutzalarm, Messung '" + k.messung + "': " + beleg });
      } else if (it.nummer > 0) {
        plan.archiv.push({ item: it, grund: "aeltere Wiederholung derselben Ursache (" + k.name + "); der juengste bleibt" });
      } else {
        plan.bleibt.push({
          titel: it.titel, art: "schutz",
          grund: "Schutzalarm - endet nur durch Messung" + (k.messung ? " '" + k.messung + "'" : "") + " oder von Hand mit Beleg",
        });
        plan.eintragen.push({ item: it, k, seitMs: it.alterMs });
      }
    }
  }
  return plan;
}

// ---------------------------------------------------------------------------
// Ausfuehren
// ---------------------------------------------------------------------------

function pruefeStruktur(vorher, nachherLines, name) {
  let danach;
  try { danach = zerlege(nachherLines); } catch (e) { throw new Error(name + ": Ergebnis unlesbar (" + e.message + ") - nichts geschrieben."); }
  const alt = vorher.sections.map((s) => s.title).join(" | ");
  const neu = danach.sections.map((s) => s.title).join(" | ");
  if (alt !== neu) throw new Error(name + ": Abschnitte haetten sich geaendert - nichts geschrieben.");
  if (vorher.lines.slice(0, vorher.headEnd + 1).join("\n") !== nachherLines.slice(0, danach.headEnd + 1).join("\n")) {
    throw new Error(name + ": Der Regelkopf haette sich geaendert - nichts geschrieben.");
  }
}

function schreibe(datei, lines, crlf) {
  const text = lines.join("\n").replace(/\n/g, crlf ? "\r\n" : "\n");
  const tmp = datei + ".tmp";
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, datei);
}

/**
 * Den Plan anwenden. Archiv zuerst, dann Liste, dann alarme.json.
 * Rueckgabe: { archiviert, bleibt, eingetragen, sicherung }.
 */
export async function fuehreAus(plan, { baustellen, archiv, datenOrdner, jetzt = Date.now(), sicherungOrdner = null }) {
  const b = lies(baustellen);
  const bz = zerlege(b.lines);
  const a = lies(archiv);
  const az = zerlege(a.lines);

  // Sicherungskopie der Liste VOR dem Schreiben.
  const sdir = sicherungOrdner || path.join(datenOrdner, "alarme-bereinigung");
  fs.mkdirSync(sdir, { recursive: true });
  const sicherung = path.join(sdir, "BAUSTELLEN-vor-" + jetzt + ".md");
  fs.copyFileSync(baustellen, sicherung);

  // 1. Archiv
  const iso = new Date(jetzt).toISOString();
  const neuesArchiv = [...az.lines.slice(0, az.headEnd + 1)];
  const neueTexte = [];
  for (const x of plan.archiv) {
    neueTexte.push(x.item.text + "\n\n*Archiviert " + iso + " von tools/alarme.js: " + x.grund + ".*");
  }
  for (const t of neueTexte) neuesArchiv.push("", ...t.split("\n"), "", "---");
  neuesArchiv.push(...az.lines.slice(az.headEnd + 1));
  pruefeStruktur(az, neuesArchiv, "ERLEDIGT.md");

  // 2. Liste: Punkte entfernen (von hinten, damit Zeilennummern stimmen)
  const s = bz.sections.find((x) => x.title.toLowerCase().startsWith("sofort"));
  const weg = plan.archiv.map((x) => x.item).sort((p, q) => q.start - p.start);
  let lines = bz.lines.slice();
  for (const it of weg) {
    if (it.start < s.start || it.start >= s.end) throw new Error("Punkt ausserhalb von Sofort: " + it.titel);
    lines.splice(it.start, it.end - it.start);
  }
  // Leerer Abschnitt: "keine" wie tools/liste.js --sofort-leeren
  const bz2 = zerlege(lines);
  const s2 = bz2.sections.find((x) => x.title.toLowerCase().startsWith("sofort"));
  if (!punkte(bz2, s2).length && weg.length) {
    lines = [...lines.slice(0, s2.start + 1), "", "keine", "", ...lines.slice(s2.end)];
  }
  pruefeStruktur(bz, lines, "BAUSTELLEN.md");

  // Archiv zuerst, dann Liste.
  schreibe(archiv, neuesArchiv, a.crlf);
  schreibe(baustellen, lines, b.crlf);

  // 3. alarme.json: die bleibenden Auto-Alarme fuehren
  const alarmDatei = path.join(datenOrdner, "alarme.json");
  const r = await AL.lade(alarmDatei);
  if (r.kaputt && !r.beiseite) throw new Error("alarme.json " + r.kaputt + " - Alarme nicht eingetragen (Liste und Archiv sind geschrieben).");
  let eingetragen = 0;
  for (const x of plan.eintragen) {
    const m = AL.melde(r.liste, { titel: x.item.titel, text: x.item.text.split("\n").slice(1).join("\n").trim(), quelle: "bereinigung" },
      jetzt, { seitMs: x.seitMs === null ? jetzt : x.seitMs, sofortTitel: x.item.titel });
    if (m.neu) eingetragen++;
  }
  await AL.speichere(alarmDatei, r.liste);
  return { archiviert: plan.archiv.length, bleibt: plan.bleibt.length, eingetragen, sicherung };
}

// ---------------------------------------------------------------------------
// Kommandozeile
// ---------------------------------------------------------------------------

function arg(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
}
function alle(argv, name) {
  const out = [];
  argv.forEach((a, i) => { if (a === name && argv[i + 1]) out.push(argv[i + 1]); });
  return out;
}

async function main(argv) {
  const wurzel = path.resolve(arg(argv, "--wurzel") || path.join(HIER, ".."));
  const datenOrdner = path.resolve(arg(argv, "--data") || path.join(wurzel, "data"));
  const baustellen = path.join(wurzel, "nodes", "BAUSTELLEN.md");
  const archiv = path.join(wurzel, "nodes", "ERLEDIGT.md");
  const jetzt = arg(argv, "--jetzt") ? Date.parse(arg(argv, "--jetzt")) : Date.now();
  if (!Number.isFinite(jetzt)) throw new Error("--jetzt ist kein Zeitpunkt.");

  if (argv.includes("--beende")) {
    const wer = arg(argv, "--beende");
    if (!wer) throw new Error("--beende braucht eine id oder einen Schluessel.");
    const datei = path.join(datenOrdner, "alarme.json");
    const r = await AL.lade(datei);
    if (r.kaputt) throw new Error("alarme.json " + r.kaputt);
    const e = AL.beende(r.liste, wer, { beleg: arg(argv, "--beleg") || "" }, jetzt);
    await AL.speichere(datei, r.liste);
    console.log("Beendet: " + e.titel + " (" + e.id + ")" + (e.beleg ? " - Beleg: " + e.beleg : ""));
    console.log("Hinweis: der Eintrag in ## Sofort bleibt stehen, bis die Bruecke das naechste Mal laeuft"
      + " oder er per --bereinigen/von Hand abgeraeumt wird.");
    return 0;
  }

  if (argv.includes("--bereinigen")) {
    const messungen = {};
    for (const m of alle(argv, "--messung")) {
      const i = m.indexOf("=");
      if (i < 1 || i === m.length - 1) throw new Error("--messung erwartet <name>=<beleg>: " + m);
      const beleg = m.slice(i + 1).trim();
      if (beleg.length < AL.BELEG_MIN) throw new Error("Beleg zu duenn (mind. " + AL.BELEG_MIN + " Zeichen): " + m);
      messungen[m.slice(0, i)] = beleg;
    }
    const ablage = leseAblage(path.resolve(arg(argv, "--sofort-ordner") || path.join(wurzel, "nodes", "BAU-2026-09", "sofort")));
    const z = zerlege(lies(baustellen).lines);
    const p = plane(z, { ablage, messungen, jetzt });
    console.log("Sofort: " + p.punkte.length + " Punkt(e) in " + baustellen);
    console.log("\nNACH ERLEDIGT.md (" + p.archiv.length + "):");
    for (const x of p.archiv) console.log("  - " + x.item.titel + "\n      " + x.grund);
    console.log("\nBLEIBT (" + p.bleibt.length + "):");
    for (const x of p.bleibt) console.log("  - [" + x.art + "] " + x.titel + "\n      " + x.grund);
    if (!argv.includes("--ausfuehren")) {
      console.log("\nTROCKENLAUF - nichts geschrieben. Mit --ausfuehren anwenden.");
      return 0;
    }
    const e = await fuehreAus(p, { baustellen, archiv, datenOrdner, jetzt });
    console.log("\nGeschrieben: " + e.archiviert + " archiviert, " + e.bleibt + " bleiben, " + e.eingetragen
      + " in alarme.json eingetragen. Sicherungskopie: " + e.sicherung);
    return 0;
  }

  // --zeige (Vorgabe)
  const r = await AL.lade(path.join(datenOrdner, "alarme.json"));
  if (r.kaputt) console.log("WARNUNG alarme.json " + r.kaputt + (r.beiseite ? " (beiseitegelegt: " + r.beiseite + ")" : ""));
  const offen = AL.uebersicht(r.liste, 100);
  console.log("Offene Alarme (" + offen.length + "):");
  for (const a of offen) {
    console.log("  " + a.id + "  [" + a.klasse + "]  " + a.titel + "\n      seit " + a.seit + ", " + a.anzahl + "x, zuletzt "
      + a.zuletzt + "; endet: " + a.endetDurch + (a.ablaufAm ? " (laeuft ab " + a.ablaufAm + ")" : ""));
  }
  try {
    const z = zerlege(lies(baustellen).lines);
    const p = plane(z, { jetzt });
    console.log("\n## Sofort in BAUSTELLEN.md: " + p.punkte.length + " Punkt(e); davon abraeumbar laut --bereinigen: "
      + p.archiv.length + ", bleiben: " + p.bleibt.length);
  } catch (e) {
    console.log("\n## Sofort nicht lesbar: " + e.message);
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then((c) => process.exit(c || 0), (e) => {
    console.error("FEHLER: " + (e && e.message ? e.message : e));
    process.exit(1);
  });
}
