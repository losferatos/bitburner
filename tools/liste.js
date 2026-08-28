/** Die Arbeitsliste bearbeiten, ohne sie zu zerlegen.
 *
 * WOZU
 *
 * `nodes/BAUSTELLEN.md` wird von fuenf Loops beschrieben, immer programmatisch.
 * Jeder von ihnen sucht die Stelle, an die er schreiben will - und trifft dabei
 * regelmaessig die falsche: Die Zeichenketten `## Sofort` und `## Offen` stehen
 * auch im Regelkopf, wo die Datei ihre eigenen Regeln erklaert. Eine Suche nach
 * `## Sofort` findet den Fliesstext, nicht die Ueberschrift.
 *
 * Am 28.08.2026 ist das zweimal passiert: um 14:08 landeten drei Eintraege
 * mitten im Kopf und zwei Abschnittsueberschriften existierten danach doppelt;
 * um 22:47 wurde beim Abraeumen eines Sofort-Punkts der halbe Kopf ersetzt.
 * Beide Male stand die Warnung davor bereits IN der Datei - ein Hinweis im
 * Text, den man gerade umschreibt, traegt offensichtlich nicht.
 *
 * Dieses Werkzeug macht den Fehler unmoeglich, statt vor ihm zu warnen:
 *
 *   - Abschnitte werden ueber ZEILENNUMMERN abgegrenzt, nie ueber Textsuche.
 *   - Als Abschnittsueberschrift gilt nur eine `## `-Zeile NACH der ersten
 *     `---`-Trennlinie. Alles davor ist Regelkopf und unantastbar.
 *   - Nach jedem Schreiben laeuft eine Strukturpruefung. Schlaegt sie fehl,
 *     wird NICHT geschrieben und der alte Stand bleibt stehen.
 *
 * AUFRUFE
 *
 *   node tools/liste.js                       Abschnitte und Punkte zeigen
 *   node tools/liste.js --sofort-leeren [--vermerk "..."]
 *   node tools/liste.js --eintragen sofort|offen --datei <pfad>
 *   node tools/liste.js --erledigen "<anfang der ueberschrift>" --datei <pfad>
 *
 * `--datei` erwartet eine Datei, deren erste Zeile mit `### ` beginnt. So
 * bleibt der Eintragstext ausserhalb der Kommandozeile - Umlaute, Backticks
 * und mehrzeilige Rechnungen ueberleben keine Shell.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const LIST = path.join(ROOT, "nodes", "BAUSTELLEN.md");
const ARCHIVE = path.join(ROOT, "nodes", "ERLEDIGT.md");

/** Zerlegt eine Liste in Kopf und Abschnitte - ueber Zeilennummern.
 *
 * Rueckgabe: { lines, headEnd, sections: [{title, start, end}] }
 * `start` ist die Zeile der `## `-Ueberschrift, `end` die erste Zeile des
 * naechsten Abschnitts (exklusiv). Beides 0-basiert.
 */
function parse(file) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const headEnd = lines.findIndex((l) => l.trim() === "---");
  if (headEnd < 0) throw new Error(file + ": keine ---Trennlinie, Kopf nicht abgrenzbar");
  const heads = [];
  for (let i = headEnd + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) heads.push(i);
  }
  const sections = heads.map((start, n) => ({
    title: lines[start].slice(3).trim(),
    start,
    end: n + 1 < heads.length ? heads[n + 1] : lines.length,
  }));
  return { lines, headEnd, sections };
}

/** Findet einen Abschnitt ueber den Anfang seines Titels. */
function section(parsed, prefix) {
  const s = parsed.sections.find((x) => x.title.toLowerCase().startsWith(prefix.toLowerCase()));
  if (!s) {
    throw new Error("Abschnitt '" + prefix + "' nicht gefunden. Vorhanden: "
      + parsed.sections.map((x) => x.title).join(" | "));
  }
  return s;
}

/** Die Punkte eines Abschnitts - nur `### `-Zeilen zaehlen. */
function items(parsed, s) {
  const out = [];
  for (let i = s.start + 1; i < s.end; i++) {
    if (parsed.lines[i].startsWith("### ")) out.push({ line: i, title: parsed.lines[i].slice(4) });
  }
  return out;
}

/** Schreibt nur, wenn die Struktur danach noch stimmt.
 *
 * Geprueft wird gegen den Zustand VOR der Aenderung: dieselben Abschnitte in
 * derselben Reihenfolge, und der Regelkopf unveraendert. Alles andere ist ein
 * Zeichen dafuer, dass an der falschen Stelle geschnitten wurde.
 */
function writeChecked(file, before, lines) {
  const text = lines.join("\n");
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, text);
  let after;
  try {
    after = parse(tmp);
  } catch (e) {
    fs.unlinkSync(tmp);
    throw new Error("Ergebnis waere unlesbar (" + e.message + ") - nichts geschrieben.");
  }
  const alt = before.sections.map((s) => s.title).join(" | ");
  const neu = after.sections.map((s) => s.title).join(" | ");
  if (alt !== neu) {
    fs.unlinkSync(tmp);
    throw new Error("Abschnitte haetten sich geaendert - nichts geschrieben.\n  vorher: "
      + alt + "\n  nachher: " + neu);
  }
  const kopfAlt = before.lines.slice(0, before.headEnd + 1).join("\n");
  const kopfNeu = after.lines.slice(0, after.headEnd + 1).join("\n");
  if (kopfAlt !== kopfNeu) {
    fs.unlinkSync(tmp);
    throw new Error("Der Regelkopf haette sich geaendert - nichts geschrieben.");
  }
  fs.renameSync(tmp, file);
}

/** Text eines Eintrags aus einer Datei holen und pruefen. */
function entryFrom(file) {
  if (!file) throw new Error("--datei fehlt.");
  const t = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n").replace(/\s+$/, "");
  if (!t.startsWith("### ")) throw new Error(file + ": erste Zeile muss mit '### ' beginnen.");
  return t;
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : null;
}

const argv = process.argv.slice(2);
const parsed = parse(LIST);

try {
  if (argv.includes("--sofort-leeren")) {
    const s = section(parsed, "Sofort");
    const vermerk = arg("--vermerk");
    const body = ["", "keine", ""];
    if (vermerk) body.push("*" + vermerk + "*", "");
    const lines = [
      ...parsed.lines.slice(0, s.start + 1),
      ...body,
      ...parsed.lines.slice(s.end),
    ];
    writeChecked(LIST, parsed, lines);
    console.log("Sofort geleert (" + items(parsed, s).length + " Punkt(e) entfernt).");

  } else if (argv.includes("--eintragen")) {
    const ziel = arg("--eintragen");
    if (!["sofort", "offen"].includes(String(ziel))) {
      throw new Error("--eintragen braucht 'sofort' oder 'offen'.");
    }
    const s = section(parsed, ziel === "sofort" ? "Sofort" : "Offen");
    const text = entryFrom(arg("--datei"));
    // Neue Punkte kommen OBEN in den Abschnitt: die Reihenfolge ist die
    // Rangfolge, und ein frischer Befund ist der dringendste, bis jemand
    // etwas anderes belegt. Bei 'sofort' ersetzt er ausserdem ein "keine".
    let ab = s.start + 1;
    while (ab < s.end && (parsed.lines[ab].trim() === "" || parsed.lines[ab].trim() === "keine")) ab++;
    const lines = [
      ...parsed.lines.slice(0, s.start + 1),
      "",
      ...text.split("\n"),
      "",
      ...parsed.lines.slice(ab),
    ];
    writeChecked(LIST, parsed, lines);
    console.log("Eingetragen in '" + s.title + "': " + text.split("\n")[0].slice(4));

  } else if (argv.includes("--erledigen")) {
    const prefix = arg("--erledigen");
    if (!prefix) throw new Error("--erledigen braucht den Anfang der Ueberschrift.");
    let treffer = null;
    for (const s of parsed.sections) {
      for (const it of items(parsed, s)) {
        if (it.title.toLowerCase().startsWith(prefix.toLowerCase())) {
          if (treffer) throw new Error("'" + prefix + "' passt auf mehrere Punkte - genauer werden.");
          treffer = { s, it };
        }
      }
    }
    if (!treffer) throw new Error("Kein Punkt beginnt mit '" + prefix + "'.");
    // Ende des Punkts: die naechste `### `-Zeile im selben Abschnitt, sonst
    // das Abschnittsende. Nachlaufende Leerzeilen gehoeren dazu.
    let ende = treffer.s.end;
    for (let i = treffer.it.line + 1; i < treffer.s.end; i++) {
      if (parsed.lines[i].startsWith("### ")) { ende = i; break; }
    }
    const lines = [...parsed.lines.slice(0, treffer.it.line), ...parsed.lines.slice(ende)];
    writeChecked(LIST, parsed, lines);
    console.log("Aus '" + treffer.s.title + "' entfernt: " + treffer.it.title);

    const archivDatei = arg("--datei");
    if (archivDatei) {
      const text = entryFrom(archivDatei);
      const arch = parse(ARCHIVE);
      const neu = [
        ...arch.lines.slice(0, arch.headEnd + 1),
        "",
        ...text.split("\n"),
        "",
        "---",
        ...arch.lines.slice(arch.headEnd + 1),
      ];
      writeChecked(ARCHIVE, arch, neu);
      console.log("Ins Archiv gelegt: " + text.split("\n")[0].slice(4));
    } else {
      console.log("HINWEIS: ohne --datei wurde nichts archiviert - der Punkt ist nur weg.");
    }

  } else {
    for (const s of parsed.sections) {
      const its = items(parsed, s);
      console.log("## " + s.title + "  (Zeile " + (s.start + 1) + ", " + its.length + " Punkt(e))");
      for (const it of its) console.log("   " + String(it.line + 1).padStart(5) + "  " + it.title);
    }
    console.log("\nRegelkopf: Zeile 1 bis " + (parsed.headEnd + 1) + " - wird nie angefasst.");
  }
} catch (e) {
  console.error("FEHLER: " + (e.message || e));
  process.exit(1);
}
