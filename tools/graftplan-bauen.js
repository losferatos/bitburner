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
