/**
 * Ebene 0: Verbotsgrep und Selbstblockade-Muster.
 *
 * WARUM UEBER EINE POSITIVLISTE UND NICHT UEBER src/ PAUSCHAL
 * Ein Grep ueber den ganzen Ordner ist ab dem ersten Lauf rot und damit
 * nutzlos: src/NetscriptDefinitions.d.ts enthaelt `b1tflum3(`, `softReset(`,
 * `ns.prompt(` und `nextPortWrite(` als offizielle Typdeklarationen und muss
 * liegen bleiben; src/exploit3.js enthaelt `bitburnerSave`. Ein Pruefer, der
 * immer rot ist, wird abgeschaltet - und dann faengt er gar nichts mehr.
 *
 * Geprueft werden deshalb nur Dateien der Positivliste. Eine src/-Datei, die
 * weder in der Liste noch in der Registry steht, ist tot und gehoert nach
 * archiv/ - der Grep meldet sie als eigenen Befund "unregistriert", nicht als
 * Musterverstoss.
 *
 * DIE SELBSTBLOCKADE-MUSTER
 * `ns.prompt(` und `nextPortWrite(` haengen ewig, wenn niemand antwortet.
 * `while (true)` ohne `await` in derselben Funktion friert den Tab ein - das
 * stopFlag des Spiels wirkt erst beim naechsten ns-Aufruf. Solche Haenger
 * heilt keine Sprosse der Strafleiter, weil sie nach jedem Neustart sofort
 * wiederkehren.
 *
 * Die Einschraenkung "ohne await in derselben Funktion" ist tragend, nicht
 * kosmetisch: ausgang.js, popups.js und worker/share.js haben allesamt eine
 * `while (true)`-Schleife mit await darin, stehen im Auftrag unter "bewaehrt,
 * behalten" und muessen gruen bleiben. Sie sind die Regressionsprobe.
 *
 * Aufruf: node tools/test-verbote.js [--alle]
 * Exit 0 = kein Treffer.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const SRC = path.join(ROOT, "src");

/**
 * Die Positivliste. Sie kommt spaeter aus src/registry.json; bis die Registry
 * gebaut ist, steht sie hier - mit dem Datum, an dem sie zuletzt gegen den
 * Ordner abgeglichen wurde.
 *
 * Stand 04.09.2026: die Dateien, die der Auftrag in 1.3 unter "bewaehrt" oder
 * in 4.1/4.3 als Gewerk fuehrt.
 */
const POSITIVLISTE = [
  "boot.js",
  "bn4net.js",
  "exit.js",
  "ausgang.js",
  "route.json",
  "blade.js",
  "bn4rep.js",
  "bn4life.js",
  "bn4door.js",
  "contracts.js",
  "cdump.js",
  "csolve.js",
  "popups.js",
  "darkweb.js",
  "graft.js",
  "hashes.js",
  "hacknet.js",
  "sleeve.js",
  "sleevecrime.js",
  "homegrow.js",
  "bbtrain.js",
  "wakelock.js",
  "sonde.js",
  "hacktimer.js",
  "worker/hack.js",
  "worker/grow.js",
  "worker/weaken.js",
  "worker/share.js",
  "worker/expfarm.js",
  // ERGAENZT 04.09.2026 nach dem Lauf von tools/archivliste.js.
  // Diese Dateien werden von lebenden Modulen aufgerufen - blade.js allein ruft
  // sechs davon -, standen aber nicht auf der Liste. Der Grep prueft sie
  // seither mit. Die Richtung ist Absicht: lieber eine tote Datei mitpruefen
  // als eine lebende auslassen, denn nur die zweite Sorte kann ein Muster
  // verstecken, das den Bot zum Stillstand bringt.
  "astufe.js", "bbgraft.js", "bblage.js", "bbspann.js", "bitverse.js",
  "bodauer.js", "chance.js", "geld.js", "join.js", "joinrun.js",
  "knoten.js", "lage.js", "lib/hackaugs.js", "netburn.js", "ps.js",
  "share.js", "skillcheck.js", "sr.js", "werkbank.js", "work.js",
  // Phase C, Position C.1 - die Kontrakte. Reine Datenmodule ohne ns-Aufrufe;
  // sie stehen hier, damit der Grep sie mitliest, wenn spaeter doch einer
  // dazukommt.
  "lib/motorzeit.js", "lib/herzschlag.js", "lib/kpi.js", "lib/events.js",
  // Phase C, Stand 04.09.2026 - die neuen Gewerke und Module. `kampfaugs.js`
  // stand nie auf der Liste, obwohl es `workForFaction` ruft: es war damit
  // genau die Sorte Datei, gegen die die Figur-Regel gebaut ist.
  "guard.js", "shop.js", "figwatch.js", "kampfaugs.js",
  "lib/reg.js", "lib/leiter.js", "lib/uhren.js", "lib/eta.js",
  "lib/endspurt.js", "lib/route.js", "lib/graftwahl.js", "lib/figur.js",
  "lib/figurns.js", "lib/calc.js", "lib/batch.js",
];

/** Diese Dateien sind vom Grep ausgenommen. */
const AUSNAHMEN = ["NetscriptDefinitions.d.ts"];

/** Jeder Treffer ist ein Abbruchgrund. */
const VERBOTE = [
  { muster: /b1tflum3\s*\(/, name: "b1tflum3(", grund: "verlaesst den Knoten OHNE Source-File" },
  { muster: /\bindexedDB\b/, name: "indexedDB", grund: "direkter Zugriff auf die Spielstand-Datenbank" },
  { muster: /bitburnerSave/, name: "bitburnerSave", grund: "Name der Spielstand-Datenbank" },
  { muster: /savestring/, name: "savestring", grund: "Store der Spielstand-Datenbank" },
  { muster: /deleteDatabase/, name: "deleteDatabase", grund: "loescht den Spielstand" },
  { muster: /importGame/, name: "importGame", grund: "Import auf Live ist verboten" },
  { muster: /Delete Save/, name: "Delete Save", grund: "Knopf, der den Spielstand loescht" },
  { muster: /DeleteGameButton/, name: "DeleteGameButton", grund: "derselbe Knopf" },
  { muster: /\bsoftReset\s*\(/, name: "softReset(", grund: "Reset ohne Aug - Erics Freigabe deckt nur Einbau" },
];

/** location.reload ist nur im Waechter erlaubt (Sprosse 4a). */
const RELOAD_ERLAUBT = ["waechter.js", "watchdog.js"];

/** Selbstblockade: haengt ewig, keine Sprosse heilt es. */
const BLOCKADEN = [
  { muster: /ns\.prompt\s*\(/, name: "ns.prompt(", grund: "wartet ewig auf eine Antwort, die niemand gibt" },
  { muster: /nextPortWrite\s*\(/, name: "nextPortWrite(", grund: "wartet ewig auf einen Schreibvorgang" },
];

let treffer = 0;
let unregistriert = 0;
const gebaut = [];   // Dateien, die noch im Worktree liegen
const meldungen = [];

function melde(art, datei, zeile, text, grund) {
  treffer++;
  meldungen.push({ art, datei, zeile, text: text.trim().slice(0, 100), grund });
  console.log("  ROT   " + datei + ":" + zeile + "  " + art);
  console.log("        " + text.trim().slice(0, 100));
  console.log("        " + grund);
}

/**
 * Findet `while (true)` ohne `await` in derselben Funktion.
 *
 * Bewusst grob: gezaehlt wird die Verschachtelung geschweifter Klammern ab der
 * Schleife. Findet sich bis zum Schliessen kein `await`, ist es ein Treffer.
 * Das kann eine Schleife falsch melden, deren await in einer aufgerufenen
 * Funktion steckt - dieser Fehler geht in die sichere Richtung.
 */
function pruefeEndlosschleifen(datei, inhalt) {
  const zeilen = inhalt.split("\n");
  for (let i = 0; i < zeilen.length; i++) {
    if (!/while\s*\(\s*true\s*\)/.test(zeilen[i])) continue;
    let tiefe = 0;
    let gestartet = false;
    let hatAwait = false;
    for (let j = i; j < zeilen.length; j++) {
      const z = zeilen[j];
      for (const c of z) {
        if (c === "{") {
          tiefe++;
          gestartet = true;
        } else if (c === "}") tiefe--;
      }
      if (/\bawait\b/.test(z) && j > i) hatAwait = true;
      if (gestartet && tiefe <= 0) break;
    }
    if (!hatAwait) {
      melde(
        "while(true) ohne await",
        datei,
        i + 1,
        zeilen[i],
        "friert den Tab ein - stopFlag wirkt erst beim naechsten ns-Aufruf",
      );
    }
  }
}

/**
 * DIE FIGUR-REGEL (Position C.11, 04.09.2026).
 *
 * Es gibt genau EINE Spielfigur, und sechs Gewerke wollen sie. Wer sie ohne
 * Vergabe beansprucht, bricht die Arbeit des anderen ab - und
 * `GraftingWork.finish(cancelled)` gibt das Geld NICHT zurueck
 * (Work/GraftingWork.tsx:75-83). Beim Simulacrum sind das 450 Mrd je Versuch.
 *
 * Der Vergabepunkt sitzt im Kern (bn4net.js, Abschnitt 9a). Diese Regel
 * prueft, dass jede Datei, die eine Figurhandlung ausloest, auch fragt.
 *
 * SIE PRUEFT NUR DEN IMPORT, NICHT DIE STELLE. Ob die Wache an der richtigen
 * Stelle steht und ob ihr Ergebnis beachtet wird, kann ein Grep nicht wissen -
 * das prueft `figwatch.js` im Betrieb, indem es die vergebene Handlung mit der
 * tatsaechlichen vergleicht. Der Grep faengt den haeufigen Fall: jemand baut
 * ein neues Gewerk und denkt gar nicht an die Figur.
 */
const FIGUR_HANDLUNGEN = [
  { muster: /ns\.singularity\.workForFaction\s*\(/, name: "workForFaction" },
  { muster: /ns\.singularity\.workForCompany\s*\(/, name: "workForCompany" },
  { muster: /ns\.singularity\.commitCrime\s*\(/, name: "commitCrime" },
  { muster: /ns\.singularity\.gymWorkout\s*\(/, name: "gymWorkout" },
  { muster: /ns\.singularity\.universityCourse\s*\(/, name: "universityCourse" },
  { muster: /ns\.singularity\.createProgram\s*\(/, name: "createProgram" },
  { muster: /ns\.grafting\.graftAugmentation\s*\(/, name: "graftAugmentation" },
  { muster: /ns\.bladeburner\.startAction\s*\(/, name: "startAction" },
];

/**
 * Ausnahmen mit Begruendung - keine Liste ohne Grund.
 *
 * `graft.js` wartet auf die Vergabe, statt in einer Schleife nachzufragen: es
 * laeuft einmal und beendet sich. Es steht trotzdem NICHT hier, weil es die
 * Wache hat.
 */
const FIGUR_AUSNAHMEN = {
  "exploit3.js": "Ausnutzung eines Spielfehlers, laeuft nur auf Zuruf und nie"
    + " im Automatikbetrieb - es hat keinen Antragsteller.",
};

function pruefeFigurWache(datei, inhalt) {
  const basis = path.basename(datei);
  const zeilen = inhalt.split("\n");
  const gefunden = [];
  for (const h of FIGUR_HANDLUNGEN) {
    for (let i = 0; i < zeilen.length; i++) {
      const ohneKommentar = zeilen[i].replace(/^\s*(\*|\/\/|\/\*).*$/, "");
      if (h.muster.test(ohneKommentar)) { gefunden.push([h.name, i + 1]); break; }
    }
  }
  if (!gefunden.length) return;
  if (FIGUR_AUSNAHMEN[basis]) return;
  if (inhalt.includes("lib/figurns.js")) return;
  for (const [name, zeile] of gefunden) {
    melde("Figurhandlung ohne Wache", datei, zeile, name + "(...)",
      "beansprucht die Spielfigur, importiert aber lib/figurns.js nicht -"
      + " ein laufender Graft waere damit verloren (Position C.11)");
  }
}

console.log("");
console.log("=== Ebene 0: Verbotsgrep ===");
console.log("");

const alleDateien = [];
function sammle(dir, prefix = "") {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? prefix + "/" + e.name : e.name;
    if (e.isDirectory()) {
      if (e.name === "archiv" || e.name === "node_modules") continue;
      sammle(path.join(dir, e.name), rel);
    } else if (/\.(js|json)$/.test(e.name) && !AUSNAHMEN.includes(e.name)) {
      alleDateien.push(rel);
    }
  }
}
sammle(SRC);

const zuPruefen = process.argv.includes("--alle") ? alleDateien : POSITIVLISTE;

console.log("  " + zuPruefen.length + " Datei(en) auf der Positivliste, " +
  alleDateien.length + " im Ordner");
console.log("");

// Eine Datei, die noch im Worktree gebaut wird, liegt nicht in src/ - sie soll
// aber schon geprueft werden. Sonst prueft der Grep erst, wenn der Code live
// ist, und der Befund kommt eine Einspielung zu spaet.
const WORKTREE = path.resolve(ROOT, "..", "bitburner-bau", "src");

// WELCHER BAUM ZUERST (04.09.2026).
//
// Ohne `--bau` gilt src/ - das ist der Stand, der im Spiel laeuft, und den
// muss der Grep pruefen. Mit `--bau` gilt der Worktree zuerst: dort entsteht
// die naechste Fassung, und ein Befund, der erst nach dem Einspielen kommt,
// kommt eine Einspielung zu spaet.
//
// `test-alles.js` ruft mit `--bau` auf, solange ein Worktree existiert. Der
// Unterschied ist real: die Figur-Regel unten war gegen src/ siebenfach rot
// und gegen den Worktree gruen - dieselbe Regel, zwei Staende.
const BAUZUERST = process.argv.includes("--bau") && fs.existsSync(WORKTREE);

for (const rel of zuPruefen) {
  let p = path.join(SRC, rel);
  let woher = "";
  if (BAUZUERST && fs.existsSync(path.join(WORKTREE, rel))) {
    p = path.join(WORKTREE, rel);
    woher = " [Worktree]";
  }
  if (!fs.existsSync(p)) {
    const imBau = path.join(WORKTREE, rel);
    if (fs.existsSync(imBau)) {
      p = imBau;
      woher = " [Worktree]";
    } else {
      console.log("  FEHLT " + rel + " (steht auf der Positivliste, liegt weder in src/ noch im Worktree)");
      treffer++;
      continue;
    }
  }
  const inhalt = fs.readFileSync(p, "utf8");
  if (woher) gebaut.push(rel);
  const zeilen = inhalt.split("\n");

  for (const v of [...VERBOTE, ...BLOCKADEN]) {
    for (let i = 0; i < zeilen.length; i++) {
      // Kommentarzeilen zaehlen nicht: die Vorfallsdokumentation im Code nennt
      // die verbotenen Namen absichtlich.
      const z = zeilen[i];
      const ohneKommentar = z.replace(/^\s*(\*|\/\/|\/\*).*$/, "");
      if (v.muster.test(ohneKommentar)) melde(v.name, rel, i + 1, z, v.grund);
    }
  }

  if (!RELOAD_ERLAUBT.includes(path.basename(rel))) {
    for (let i = 0; i < zeilen.length; i++) {
      const ohneKommentar = zeilen[i].replace(/^\s*(\*|\/\/|\/\*).*$/, "");
      if (/location\s*\[?["']?\s*\]?\s*\.?\s*reload\s*\(/.test(ohneKommentar) ||
          /\breload\s*\(\s*\)/.test(ohneKommentar) && /location/.test(ohneKommentar)) {
        melde("location.reload", rel, i + 1, zeilen[i],
          "nur im Waechter erlaubt (Sprosse 4a)");
      }
    }
  }

  if (/\.js$/.test(rel)) pruefeEndlosschleifen(rel, inhalt);
  if (/\.js$/.test(rel)) pruefeFigurWache(rel, inhalt);
}

// destroyW0r1dD43m0n darf nur exit.js aufrufen.
console.log("");
console.log("-- destroyW0r1dD43m0n --");
const rufer = [];
for (const rel of alleDateien) {
  const p = path.join(SRC, rel);
  if (!/\.js$/.test(rel)) continue;
  const inhalt = fs.readFileSync(p, "utf8");
  for (const z of inhalt.split("\n")) {
    const ohne = z.replace(/^\s*(\*|\/\/|\/\*).*$/, "");
    if (/destroyW0r1dD43m0n\s*\(/.test(ohne)) {
      rufer.push(rel);
      break;
    }
  }
}
const fremde = rufer.filter((r) => r !== "exit.js");
if (fremde.length) {
  treffer++;
  console.log("  ROT   ausser exit.js rufen auch auf: " + fremde.join(", "));
} else {
  console.log("  ok    einziger Aufrufer ist exit.js" +
    (rufer.includes("exit.js") ? "" : " (heute ruft es niemand)"));
}

// Unregistrierte Dateien melden - eigener Befund, kein Musterverstoss.
console.log("");
if (gebaut.length) {
  console.log("-- noch im Worktree, nicht live --");
  for (const g of gebaut) console.log("  " + g);
  console.log("");
}
console.log("-- unregistrierte Dateien --");
const bekannt = new Set([...POSITIVLISTE, ...AUSNAHMEN]);
const uebrig = alleDateien.filter((f) => !bekannt.has(f) && !AUSNAHMEN.includes(path.basename(f)));
unregistriert = uebrig.length;
console.log("  " + unregistriert + " Datei(en) stehen weder auf der Positivliste noch in der Registry.");
console.log("  Nach Auftrag 1.5 gehoeren sie nach archiv/ - das ist ein Befund, kein Fehler.");
if (unregistriert && process.argv.includes("--liste")) {
  for (const f of uebrig) console.log("     " + f);
}

/**
 * SELBSTPROBE. Ein Pruefer, der nie rot wird, prueft nichts.
 *
 * Der Grep oben ist gruen - das kann heissen, dass der Code sauber ist, oder
 * dass die Muster nicht greifen. Diese Probe entscheidet es: sie legt eine
 * Datei mit JEDEM verbotenen Muster an und verlangt, dass jedes gefunden wird.
 * Findet der Grep eines nicht, ist der gruene Lauf oben wertlos.
 *
 * Dazu die Gegenprobe: die drei bewaehrten Endlosschleifen MIT await
 * (ausgang.js, popups.js, worker/share.js) muessen gruen bleiben. Ein Muster,
 * das sie faelschlich meldet, wird abgeschaltet - und faengt dann gar nichts.
 */
console.log("");
console.log("-- Selbstprobe: findet der Grep, was er finden soll? --");

let probeFehler = 0;
{
  const probeZeilen = [
    ['ns.singularity.b1tflum3(4)', "b1tflum3("],
    ['const db = indexedDB.open("x")', "indexedDB"],
    ['const k = "bitburnerSave"', "bitburnerSave"],
    ['store.get("savestring")', "savestring"],
    ['indexedDB.deleteDatabase("x")', "deleteDatabase"],
    ['importGame(daten)', "importGame"],
    ['if (t === "Delete Save") return', "Delete Save"],
    ['const b = DeleteGameButton', "DeleteGameButton"],
    ['await ns.singularity.softReset("boot.js")', "softReset("],
    ['const a = await ns.prompt("weiter?")', "ns.prompt("],
    ['await ns.nextPortWrite(1)', "nextPortWrite("],
  ];
  for (const [zeile, name] of probeZeilen) {
    const alleMuster = [...VERBOTE, ...BLOCKADEN];
    const v = alleMuster.find((x) => x.name === name);
    const gefunden = v && v.muster.test(zeile);
    if (gefunden) {
      console.log("  ok    findet " + name);
    } else {
      probeFehler++;
      console.log("  ROT   findet " + name + " NICHT in: " + zeile);
    }
  }

  // Endlosschleife ohne await muss gefunden werden ...
  const vorher = treffer;
  pruefeEndlosschleifen("(probe-ohne-await)", [
    "export async function main(ns) {",
    "  while (true) {",
    "    ns.print('haengt');",
    "  }",
    "}",
  ].join("\n"));
  if (treffer > vorher) {
    console.log("  ok    findet while(true) ohne await");
    treffer = vorher; // Die Probe ist kein echter Befund.
    meldungen.pop();
  } else {
    probeFehler++;
    console.log("  ROT   findet while(true) OHNE await nicht");
  }

  // ... und eine MIT await darf nicht gemeldet werden.
  const vorher2 = treffer;
  pruefeEndlosschleifen("(probe-mit-await)", [
    "export async function main(ns) {",
    "  while (true) {",
    "    await ns.sleep(1000);",
    "  }",
    "}",
  ].join("\n"));
  if (treffer === vorher2) {
    console.log("  ok    meldet while(true) MIT await nicht");
  } else {
    probeFehler++;
    treffer = vorher2;
    meldungen.pop();
    console.log("  ROT   meldet while(true) MIT await faelschlich");
  }
}

// Regressionsprobe an den echten Dateien: die drei bewaehrten Schleifen.
console.log("");
console.log("-- Regressionsprobe: die drei bewaehrten Endlosschleifen --");
for (const rel of ["ausgang.js", "popups.js", "worker/share.js"]) {
  const p = path.join(SRC, rel);
  if (!fs.existsSync(p)) {
    console.log("  --    " + rel + " fehlt");
    continue;
  }
  const inhalt = fs.readFileSync(p, "utf8");
  const hatSchleife = /while\s*\(\s*true\s*\)/.test(inhalt);
  const vorher = treffer;
  pruefeEndlosschleifen(rel, inhalt);
  if (treffer === vorher) {
    console.log("  ok    " + rel + (hatSchleife ? " hat while(true) und bleibt gruen" : " (keine Schleife)"));
  } else {
    probeFehler++;
    console.log("  ROT   " + rel + " wird faelschlich gemeldet");
  }
}

console.log("");
console.log("=== " + treffer + " Musterverstoss/-verstoesse, " +
  probeFehler + " Selbstprobe-Fehler, " + unregistriert + " unregistriert ===");
console.log("");
process.exit(treffer || probeFehler ? 1 : 0);
