/**
 * Erzeugt `src/graftplan.json` aus `nodes/GRAFTPLAN.md`.
 *
 * ===========================================================================
 * WARUM DER PLAN NACH INNEN MUSS
 * ===========================================================================
 *
 * Heute liest `tools/graftnext.js` die Reihenfolge ueber die Bruecke aus einer
 * Markdown-Datei und legt einen Auftrag ab - von aussen, auf Zuruf. Damit ist
 * Grafting das einzige Gewerk, das einen Menschen braucht, und es steht still,
 * sobald niemand hinsieht.
 *
 * Der Auftrag nennt Grafting den groessten Posten nach der Route: Faktor 10
 * bis 20 auf den Rangweg, wirksam in 30 der 40 Restlaeufe.
 *
 * ===========================================================================
 * DIE REIHENFOLGE BLEIBT, WO SIE IST
 * ===========================================================================
 *
 * `nodes/GRAFTPLAN.md` bleibt die Quelle - dort steht die Herleitung neben der
 * Liste, und sie liegt im Repo statt unter `data/` (das ist gitignoriert; eine
 * Reihenfolge, die einen Rechnerverlust nicht ueberlebt, ist keine).
 *
 * Diese Datei erzeugt daraus die maschinenlesbare Fassung. Erzeugt, nicht
 * abgeschrieben - zum vierten Mal an diesem Tag dieselbe Lehre.
 *
 * Aufruf: node tools/graftplan-bauen.js
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const QUELLE = path.join(ROOT, "nodes", "GRAFTPLAN.md");

if (!fs.existsSync(QUELLE)) {
  console.log("GRAFTPLAN.md nicht gefunden: " + QUELLE);
  process.exit(1);
}

const md = fs.readFileSync(QUELLE, "utf8");

// Die Reihenfolge steht im ersten Codeblock nach der Ueberschrift "Reihenfolge".
const i = md.indexOf("## Reihenfolge");
if (i === -1) {
  console.log("Abschnitt 'Reihenfolge' nicht gefunden.");
  process.exit(1);
}
const m = /```\r?\n([\s\S]*?)\r?\n```/.exec(md.slice(i));
if (!m) {
  console.log("Kein Codeblock unter 'Reihenfolge'.");
  process.exit(1);
}

const namen = m[1].split("\n").map((z) => z.trim()).filter((z) => z.length > 0);

if (namen.length < 10) {
  console.log("Nur " + namen.length + " Eintraege gefunden - das sieht nach einem");
  console.log("Formatwechsel aus. Die Datei wird NICHT geschrieben.");
  process.exit(1);
}

// Doppelte Namen waeren ein Fehler in der Vorlage: der Bot graftete dasselbe
// Stueck zweimal und wartete beim zweiten Mal auf etwas, das er schon hat.
const gesehen = new Set();
const doppelt = [];
for (const n of namen) {
  if (gesehen.has(n)) doppelt.push(n);
  gesehen.add(n);
}
if (doppelt.length) {
  console.log("Doppelte Eintraege in GRAFTPLAN.md: " + doppelt.join(", "));
  console.log("Die Datei wird NICHT geschrieben.");
  process.exit(1);
}

/**
 * DIE VORAUSSETZUNGSKETTEN, aus dem Spielquelltext gelesen.
 *
 * `getGraftableAugmentations` filtert NICHT nach Voraussetzungen - das tut
 * erst `graftAugmentation`, und zwar still mit `return false`
 * (`Grafting.ts:76-79` -> `FactionHelpers.tsx:56-58`). Ein Stueck, dessen
 * Vorgaenger fehlt, steht also auf der Liste und laesst sich trotzdem nicht
 * graften.
 *
 * Das faellt im Betrieb nicht auf: das Gewerk meldete "Graft gestartet",
 * `graft.js` gaebe still `false` zurueck, und die Runde begaenne von vorn.
 *
 * Und der Vorgaenger fehlt nach JEDEM Knotensprung:
 * `PlayerObjectGeneralMethods.ts:143-175` setzt `this.augmentations = []`.
 * Der Plan enthielt `LuminCloaking-V2 Skin Implant` mit dem Kommentar
 * "V1 (installiert)" - das galt fuer den Lauf, in dem der Plan entstand, und
 * fuer keinen der 39 danach.
 *
 * Deshalb wird die Kette hier geprueft, nicht kommentiert.
 */
function voraussetzungen(root) {
  const p = path.join(root, "reference", "v301", "src", "Augmentation");
  const tsPfad = path.join(p, "Augmentations.ts");
  const enPfad = path.join(p, "Enums.ts");
  if (!fs.existsSync(tsPfad) || !fs.existsSync(enPfad)) return null;
  const ts = fs.readFileSync(tsPfad, "utf8");
  const en = fs.readFileSync(enPfad, "utf8");

  // Der Aufzaehlungstyp bildet Bezeichner auf Anzeigenamen ab; im Plan stehen
  // die Anzeigenamen.
  const enumZuName = {};
  for (const m of en.matchAll(/^\s+([A-Za-z0-9_]+)\s*=\s*"([^"]+)"/gm)) {
    enumZuName[m[1]] = m[2];
  }

  const raus = {};
  for (const m of ts.matchAll(/\[AugmentationName\.([A-Za-z0-9_]+)\]:\s*\{/g)) {
    // Klammern zaehlen statt Regex ueber den Block: die Eintraege enthalten
    // geschweifte Klammern in Zeichenketten und verschachtelte Objekte.
    let tiefe = 1;
    let i = m.index + m[0].length;
    while (i < ts.length && tiefe > 0) {
      if (ts[i] === "{") tiefe++;
      else if (ts[i] === "}") tiefe--;
      i++;
    }
    const body = ts.slice(m.index + m[0].length, i);
    const pm = /prereqs:\s*\[([^\]]*)\]/.exec(body);
    if (!pm) continue;
    const namen = [...pm[1].matchAll(/AugmentationName\.([A-Za-z0-9_]+)/g)]
      .map((x) => enumZuName[x[1]] || x[1]);
    raus[enumZuName[m[1]] || m[1]] = namen;
  }
  return raus;
}

/**
 * Violet Congruity ist der einzige Eintrag mit einer Sonderregel, und sie
 * steht ausserhalb der Liste: "so frueh wie bezahlbar, nicht am Ende".
 *
 * Der Grund ist gemessen: `AugmentationHelpers.ts:45-49` setzt beim Anwenden
 * `Player.entropy = 0`, und `GraftingWork.tsx:61-64` prueft den Besitz, bevor
 * es einen Stapel bucht - nach Congruity erzeugt kein Graft mehr Entropie.
 *
 * Das Endergebnis ist in beiden Faellen null Entropie. Wer es aber ZUERST
 * graftet, arbeitet die restlichen Stuecke mit vollen Multiplikatoren ab statt
 * mit 0,98^n. Nach 38 Grafts stuenden sonst bladeburner_success_chance bei
 * x0,822 statt x1,771.
 */
const CONGRUITY = "violet Congruity Implant";
const congruityErwaehnt = md.includes(CONGRUITY);

const ausgabe = {
  hinweis: "ERZEUGT von tools/graftplan-bauen.js aus nodes/GRAFTPLAN.md. "
    + "Nicht von Hand pflegen - die Reihenfolge und ihre Herleitung stehen dort.",
  erzeugtAm: new Date().toISOString(),
  regel: "Der erste Eintrag, den der Spieler noch nicht besitzt und der nicht "
    + "gerade laeuft, ist der naechste. Bereits eingebaute Stuecke werden "
    + "uebersprungen; die Liste muss deshalb nicht gepflegt werden, wenn etwas "
    + "fertig ist.",
  vorzug: congruityErwaehnt ? {
    name: CONGRUITY,
    regel: "so frueh wie bezahlbar, VOR der Liste",
    grund: "loescht die Entropie rueckwirkend (AugmentationHelpers.ts:45-49); "
      + "danach erzeugt kein Graft mehr welche (GraftingWork.tsx:61-64). Wer "
      + "zuerst graftet, arbeitet den Rest mit vollen Multiplikatoren ab statt "
      + "mit 0,98^n.",
  } : null,
  anzahl: namen.length,
  reihenfolge: namen,
};

// --- Die Voraussetzungsketten pruefen, BEVOR geschrieben wird --------------
{
  const vor = voraussetzungen(ROOT);
  if (vor === null) {
    console.log("Die Referenzkopie des Spiels fehlt - die Voraussetzungsketten");
    console.log("koennen nicht geprueft werden. Das ist ein Fehler, kein Hinweis:");
    console.log("ein Plan mit einer offenen Kette laeuft im Betrieb in eine");
    console.log("Endlosschleife, die nur an einer ausbleibenden Zahl auffaellt.");
    process.exit(1);
  }
  const pos = {};
  namen.forEach((n, i) => { pos[n] = i; });
  if (congruityErwaehnt && !(CONGRUITY in pos)) pos[CONGRUITY] = -1;

  const verstoesse = [];
  for (const [stueck, brauchen] of Object.entries(vor)) {
    if (!(stueck in pos)) continue;      // steht nicht im Plan, geht uns nichts an
    for (const v of brauchen) {
      if (!(v in pos)) {
        verstoesse.push(stueck + " braucht " + v + ", das nicht im Plan steht");
      } else if (pos[v] > pos[stueck]) {
        verstoesse.push(stueck + " (Platz " + pos[stueck] + ") steht VOR seiner "
          + "Voraussetzung " + v + " (Platz " + pos[v] + ")");
      }
    }
  }
  if (verstoesse.length) {
    console.log("");
    console.log("=== Graftplan ABGELEHNT: " + verstoesse.length
      + " offene Voraussetzungskette(n) ===");
    for (const v of verstoesse) console.log("  " + v);
    console.log("");
    console.log("  Ein Stueck ohne seinen Vorgaenger laesst sich nicht graften -");
    console.log("  getGraftableAugmentations filtert das NICHT, und");
    console.log("  graftAugmentation gibt still false zurueck. Nach einem");
    console.log("  Knotensprung sind alle Augmentierungen weg");
    console.log("  (PlayerObjectGeneralMethods.ts:143-175), ein 'ist schon");
    console.log("  installiert' gilt also hoechstens fuer diesen einen Lauf.");
    console.log("");
    process.exit(1);
  }
  console.log("  Voraussetzungsketten: " + Object.keys(vor).length
    + " bekannt, keine offen.");

  // JEDER NAME MUSS ES IM SPIEL GEBEN.
  //
  // Ein Tippfehler im Plan faellt sonst nirgends auf: das Stueck steht nie auf
  // der Liste der graftbaren, wird also stillschweigend uebersprungen, und der
  // Bot graftet den Rest, als sei nichts. Beim Vorzug waere es schlimmer - er
  // kaeme nie dran, und die Regel, die ihn nach vorn holt, liefe ins Leere.
  //
  // "violet Congruity Implant" mit kleinem v ist uebrigens RICHTIG so
  // (Enums.ts:93) - genau deshalb wird hier geprueft statt korrigiert.
  const alleNamen = new Set();
  for (const m of fs.readFileSync(path.join(ROOT, "reference", "v301", "src",
    "Augmentation", "Enums.ts"), "utf8").matchAll(/=\s*"([^"]+)"/g)) {
    alleNamen.add(m[1]);
  }
  const unbekannt = [...namen, ...(congruityErwaehnt ? [CONGRUITY] : [])]
    .filter((n) => !alleNamen.has(n));
  if (unbekannt.length) {
    console.log("");
    console.log("=== Graftplan ABGELEHNT: " + unbekannt.length
      + " unbekannte(r) Name(n) ===");
    for (const n of unbekannt) console.log("  " + n);
    console.log("");
    console.log("  Diese Namen gibt es in Augmentation/Enums.ts nicht. Ein");
    console.log("  Tippfehler faellt im Betrieb NICHT auf: das Stueck steht nie");
    console.log("  auf der Liste der graftbaren und wird stillschweigend");
    console.log("  uebersprungen.");
    console.log("");
    process.exit(1);
  }
  console.log("  Namen: alle " + (namen.length + (congruityErwaehnt ? 1 : 0))
    + " in Enums.ts belegt.");
}

const worktree = path.resolve(ROOT, "..", "bitburner-bau", "src");
const ziel = fs.existsSync(worktree)
  ? path.join(worktree, "graftplan.json")
  : path.join(ROOT, "src", "graftplan.json");
fs.writeFileSync(ziel, JSON.stringify(ausgabe, null, 1), "utf8");

console.log("");
console.log("=== Graftplan ===");
console.log("  Eintraege    " + namen.length);
console.log("  Vorzug       " + (ausgabe.vorzug ? ausgabe.vorzug.name : "keiner"));
console.log("  geschrieben  " + ziel);
console.log("");
console.log("  erste fuenf: " + namen.slice(0, 5).join(", "));
console.log("  letzte drei: " + namen.slice(-3).join(", "));
console.log("");
