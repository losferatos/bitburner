/**
 * Erzeugt `src/lib/bitnodes.json` aus dem Spielquelltext.
 *
 * WOZU: Der Kern rechnet heute mit `ns.hackAnalyze` und Verwandten - drei
 * Funktionen zu je 1 GB. Dieselben Werte lassen sich aus `lib/calc.js`
 * rechnen, ABER dessen Formeln kennen die BitNode-Multiplikatoren nicht
 * (`bn4net.js:3404-3410` warnt ausdruecklich davor: ein naiver Import haette
 * eine stille Verfuenffachung der Beute je Faden bedeutet, weil BitNode 4
 * ScriptHackMoney auf 0,2 setzt).
 *
 * Diese Tabelle liefert die fehlenden Faktoren - erzeugt aus
 * `BitNodeMultipliers.ts` und `BitNode.tsx`, nicht abgeschrieben.
 *
 * QUELLE 3.0.2, NICHT v301 (Fix B6, Audit 26.09.2026 2#6/1#4). Hier stand
 * `reference/v301` - das Spiel laeuft auf 3.0.2. Der Unterschied zwischen
 * beiden betrifft laut Audit nur BN12 (DarknetLabyrinthRewardsTheRedPill)
 * und BN13 (Charisma), aber die Quelle soll die sein, die auch laeuft.
 *
 * BN12 IST LEVELABHAENGIG, KEIN FESTER SATZ ZAHLEN (Fix B6). Alle anderen
 * BitNodes tragen in `BitNode.tsx` Zahlenliterale je Feld
 * ("ScriptHackMoney: 0.2,"). BN12 dagegen deklariert im Fall-Block zwei
 * lokale Konstanten (`inc = 1.02^lvl`, `dec = 1/inc`) und setzt fast jedes
 * Feld auf `dec`, `inc` oder einen Ausdruck darueber - `lvl` ist die Stufe
 * des Knotens (SF12-Stand + 1). Die alte Regex `[\d.]+` erfasste nur
 * Zahlenliterale: JEDES BN12-Feld mit `dec`/`inc` fiel durch, negative
 * Literale (z. B. `StaneksGiftExtraSize: -6`) ebenso, weil das Minuszeichen
 * fehlte. Ergebnis: `knoten["12"]` enthielt nur die vier echten Konstanten
 * (ServerStartingSecurity, CorporationSoftcap, CorporationDivisions,
 * GangSoftcap) - ScriptHackMoney, ServerGrowthRate, ServerWeakenRate & Co.
 * fehlten komplett, und ein Leser, der ein fehlendes Feld als 1 nimmt (wie
 * der Kommentar unten es vorschreibt), rechnete in BN12 mit den falschen
 * Standardwerten statt mit 0,98 (Stufe 1) bis 0,94 (Stufe 3).
 *
 * DER FIX: Zahlenliterale (jetzt MIT Vorzeichen) werden wie bisher direkt
 * uebernommen. Nicht-literale Felder werden nur fuer BN12 ausdruecklich
 * behandelt - die zwei lokalen Konstanten werden ausgewertet und jedes
 * Feld fuer die Stufen 1-3 (die einzigen, die die Route tatsaechlich
 * durchlaeuft, `route.json`: BN12.1-12.3) konkret berechnet. Taucht ein
 * nicht-literales Feld in einem ANDEREN Knoten auf (heute keiner, siehe
 * "geprueft" oben), bricht der Generator LAUT ab, statt das Feld still
 * wegzulassen - eine Tabelle, die "erzeugt, nicht abgeschrieben" verspricht,
 * darf nie schweigend luecken.
 *
 * SCHEMA-ERWEITERUNG: `knoten["12"]` bleibt ein flaches Objekt (Stufe-1-
 * Werte, damit ein Leser, der Knoten nicht levelt - heute bn4net.js -,
 * wenigstens die Stufe-1-Zahlen bekommt statt der falschen 1,0). Zusaetzlich
 * traegt `knotenLevel["12"]` alle drei Stufen einzeln, fuer einen Leser, der
 * `ownedSF[12]+1` kennt. bn4net.js liest heute noch nicht `knotenLevel` -
 * das ist eine offene Anschlussarbeit (Audit 1#4 nennt den vollstaendigen
 * Fix: `ns.getBitNodeMultipliers()` zur Laufzeit lesen und diese Tabelle
 * ganz ablösen). Diese Datei behebt nur den Erzeugungsfehler, nicht die
 * fehlende Level-Anbindung im Leser - siehe Bericht.
 *
 * Aufruf: node tools/bitnodes-tabelle.js
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const REF = path.join(ROOT, "reference", "bitburner-src", "src", "BitNode");

const datei = (n) => path.join(REF, n);
for (const n of ["BitNode.tsx", "BitNodeMultipliers.ts"]) {
  if (!fs.existsSync(datei(n))) {
    console.log("nicht gefunden: " + datei(n));
    console.log("(reference/bitburner-src liegt ausserhalb des Worktrees - "
      + "dieses Werkzeug braucht die Haupt-Arbeitskopie.)");
    process.exit(1);
  }
}

const tsx = fs.readFileSync(datei("BitNode.tsx"), "utf8");

// Die Standardwerte stehen als Klassenfelder in BitNodeMultipliers.ts:
//   AgilityLevelMultiplier = 1;
// Ein Feld, das ein Knoten nicht ueberschreibt, hat diesen Wert.
const mults = fs.readFileSync(datei("BitNodeMultipliers.ts"), "utf8");
const standard = {};
for (const m of mults.matchAll(/^\s*(\w+)\s*=\s*(-?[\d.]+)\s*;/gm)) {
  standard[m[1]] = Number(m[2]);
}

/**
 * Zerlegt den Objektinhalt von `new BitNodeMultipliers({ ... })` in
 * {name, wert}-Paare, klammertreu - im Gegensatz zu einer reinen Regex auf
 * ",". Noetig fuer BN12: `DaedalusAugsRequirement: Math.floor(Math.min(...,
 * 40))` traegt selbst ein Komma, eine naive Regex haette den Ausdruck an der
 * falschen Stelle abgeschnitten.
 */
function zerlegeFelder(inhalt) {
  const felder = [];
  let tiefe = 0;
  let start = 0;
  for (let i = 0; i < inhalt.length; i++) {
    const c = inhalt[i];
    if (c === "(" || c === "[" || c === "{") tiefe++;
    else if (c === ")" || c === "]" || c === "}") tiefe--;
    else if (c === "," && tiefe === 0) {
      felder.push(inhalt.slice(start, i));
      start = i + 1;
    }
  }
  felder.push(inhalt.slice(start));
  const paare = [];
  for (const roh of felder) {
    const m = /^\s*(\/\/[^\n]*\n\s*)*(\w+)\s*:\s*([\s\S]+?)\s*$/.exec(roh);
    if (m) paare.push({ name: m[2], wert: m[3].trim() });
  }
  return paare;
}

/** Findet den Inhalt von `new BitNodeMultipliers({ ... })`, klammertreu. */
function findeMultiplierObjekt(block) {
  const anker = block.indexOf("new BitNodeMultipliers(");
  if (anker === -1) return null;
  const offen = block.indexOf("{", anker);
  if (offen === -1) return null;
  let tiefe = 0;
  for (let i = offen; i < block.length; i++) {
    if (block[i] === "{") tiefe++;
    else if (block[i] === "}") {
      tiefe--;
      if (tiefe === 0) return block.slice(offen + 1, i);
    }
  }
  return null;
}

// Die knotenspezifischen Werte stehen in getBitNodeMultipliers() als
// switch-Faelle: `case 10: { ... return new BitNodeMultipliers({ ... }) }`.
// Der Block reicht vom `case n:` bis zum naechsten `case`.
const knoten = {};
const knotenLevel = {};
const faelle = [...tsx.matchAll(/^\s*case (\d+):\s*\{/gm)];
for (let i = 0; i < faelle.length; i++) {
  const n = Number(faelle[i][1]);
  if (!Number.isFinite(n) || n < 1 || n > 15) continue;
  const ab = faelle[i].index;
  const bis = i + 1 < faelle.length ? faelle[i + 1].index : tsx.length;
  const block = tsx.slice(ab, bis);
  const objektInhalt = findeMultiplierObjekt(block);
  if (objektInhalt === null) continue;
  const paare = zerlegeFelder(objektInhalt);

  const literale = {};
  const nichtLiteral = [];
  for (const { name, wert } of paare) {
    if (!(name in standard)) continue;
    if (/^-?[\d.]+$/.test(wert)) {
      literale[name] = Number(wert);
    } else {
      nichtLiteral.push({ name, wert });
    }
  }

  if (nichtLiteral.length && n !== 12) {
    // LAUT ABBRECHEN statt still weglassen (Fix B6) - eine erzeugte Tabelle
    // mit einer stillen Luecke ist schlimmer als ein Abbruch: sie behauptet,
    // vollstaendig zu sein, und ist es nicht.
    console.log("");
    console.log("ABBRUCH: BitNode " + n + " hat nicht-literale Felder, die dieser");
    console.log("Generator nicht kennt (bisher nur fuer BN12 gebaut):");
    for (const f of nichtLiteral) console.log("  " + f.name + ": " + f.wert);
    console.log("");
    console.log("src/lib/bitnodes.json wird NICHT geschrieben.");
    process.exit(1);
  }

  if (nichtLiteral.length && n === 12) {
    // BN12: `inc`/`dec` sind lokale Konstanten VOR dem return - sie muessen
    // ausgewertet werden, nicht als weiteres Feld gelesen werden.
    const lokale = [...block.matchAll(/const\s+(\w+)\s*=\s*([^;]+);/g)]
      .filter((m) => m.index < block.indexOf("new BitNodeMultipliers("));
    if (!lokale.length) {
      console.log("ABBRUCH: BitNode 12 hat nicht-literale Felder, aber keine");
      console.log("lokalen Konstanten (inc/dec) gefunden - das Muster in");
      console.log("BitNode.tsx hat sich veraendert. src/lib/bitnodes.json wird");
      console.log("NICHT geschrieben.");
      process.exit(1);
    }
    const NIVEAUS = [1, 2, 3];   // route.json: BN12.1, BN12.2, BN12.3
    for (const lvl of NIVEAUS) {
      // Sequenziell auswerten: `dec` haengt von `inc` ab. new Function statt
      // eval, mit einem GESCHLOSSENEN Kontext (lvl, Math, defaultMultipliers,
      // bisher ausgewertete lokale Konstanten) - der Ausdruck kommt aus dem
      // eigenen, vertrauten Referenzbaum, nicht aus Nutzereingabe.
      const ctx = { lvl, Math, defaultMultipliers: standard };
      for (const [, kName, kExpr] of lokale) {
        const namen = Object.keys(ctx);
        const werte = namen.map((k) => ctx[k]);
        ctx[kName] = new Function(...namen, "return (" + kExpr + ");")(...werte);
      }
      const stufe = { ...literale };
      for (const { name, wert } of nichtLiteral) {
        const namen = Object.keys(ctx);
        const werte = namen.map((k) => ctx[k]);
        stufe[name] = new Function(...namen, "return (" + wert + ");")(...werte);
      }
      if (!knotenLevel[12]) knotenLevel[12] = {};
      knotenLevel[12][String(lvl)] = stufe;
    }
    // Stufe 1 zusaetzlich flach ablegen - siehe Kopfkommentar: ein Leser, der
    // Knoten nicht levelt, bekommt so wenigstens die Stufe-1-Zahlen statt der
    // falschen Standardwerte 1,0.
    if (!knoten[n]) knoten[n] = { ...literale, ...knotenLevel[12]["1"] };
    continue;
  }

  // Ein Knoten kann mehrfach vorkommen (Stufen); der erste Fall gilt.
  if (!knoten[n]) knoten[n] = literale;
}

const gefunden = Object.keys(knoten).length;
if (gefunden < 10) {
  console.log("Nur " + gefunden + " Knoten gefunden - das Muster in BitNode.tsx");
  console.log("passt nicht mehr. Die Datei wird NICHT geschrieben.");
  process.exit(1);
}

const ausgabe = {
  hinweis: "ERZEUGT von tools/bitnodes-tabelle.js aus reference/bitburner-src/src/BitNode/. "
    + "Nicht von Hand pflegen.",
  erzeugtAm: new Date().toISOString(),
  warnung: "Ein Feld, das hier fehlt, ist 1 - NICHT 0. Wer fehlende Felder als 0 "
    + "liest, setzt jede Beute auf null.",
  standard,
  knoten,
  // BN12 ist levelabhaengig (siehe Kopfkommentar) - `knoten["12"]` traegt nur
  // Stufe 1. Ein Leser, der die eigene SF12-Stufe kennt, sollte
  // `knotenLevel["12"][String(stufe)]` vorziehen. Andere Knoten stehen hier
  // nicht, weil sie levelunabhaengig sind - `knoten[n]` reicht fuer sie aus.
  knotenLevel,
};

const worktree = path.resolve(ROOT, "..", "bitburner-bau", "src", "lib");
const ziel = fs.existsSync(worktree)
  ? path.join(worktree, "bitnodes.json")
  : path.join(ROOT, "src", "lib", "bitnodes.json");
fs.writeFileSync(ziel, JSON.stringify(ausgabe, null, 1), "utf8");

console.log("");
console.log("=== BitNode-Multiplikatoren ===");
console.log("  Knoten          " + gefunden);
console.log("  Standardfelder  " + Object.keys(standard).length);
console.log("  geschrieben     " + ziel);
console.log("");
for (const n of [1, 4, 8, 9, 10, 12]) {
  const k = knoten[n];
  if (!k) continue;
  const wichtig = ["ScriptHackMoney", "HackingLevelMultiplier", "ServerGrowthRate",
    "CloudServerLimit", "CloudServerCost"]
    .filter((f) => f in k)
    .map((f) => f + "=" + k[f]);
  console.log("  BN" + String(n).padEnd(3) + (wichtig.join("  ") || "(keine der wichtigen Abweichungen)"));
}
if (knotenLevel[12]) {
  console.log("");
  console.log("  BN12 je Stufe (ScriptHackMoney / ServerGrowthRate / ServerWeakenRate):");
  for (const s of Object.keys(knotenLevel[12])) {
    const v = knotenLevel[12][s];
    console.log("    Stufe " + s + "  " + v.ScriptHackMoney.toFixed(4) + " / "
      + v.ServerGrowthRate.toFixed(4) + " / " + v.ServerWeakenRate.toFixed(4));
  }
}
console.log("");
