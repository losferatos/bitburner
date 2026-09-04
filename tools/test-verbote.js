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
 * DIE REGISTRY IST DIE POSITIVLISTE (seit dem Merge am 04.09.2026 15:13).
 *
 * Vorher stand hier eine handgepflegte Liste, und der Kommentar sagte selbst:
 * "sie kommt spaeter aus src/registry.json". Das "spaeter" war heute, und
 * solange es nicht kam, hatte der Befund "unregistriert" einen falschen
 * Nenner: `punish.js`, `export.js`, `graftauto.js` und `boerse.js` standen
 * darin, obwohl sie in der Registry stehen - also ausgerechnet die neu
 * gebauten Gewerke.
 *
 * Das ist nicht nur unsauber, es ist gefaehrlich: Auftrag 6.1 verlangt, dass
 * unregistrierte Dateien nach `archiv/` wandern. Wer diese Liste als
 * Loeschliste benutzt haette, haette den neuen Bot archiviert.
 *
 * Die Handliste bleibt als ERGAENZUNG stehen (nicht als Ersatz): sie enthaelt
 * Dateien, die der Auftrag in 1.3 als "bewaehrt" fuehrt und die noch kein
 * Registry-Eintrag hat. Vereinigt werden beide.
 */
const REGISTRY_DATEI = path.join(SRC, "registry.json");
const AUS_REGISTRY = (() => {
  try {
    const r = JSON.parse(fs.readFileSync(REGISTRY_DATEI, "utf8"));
    const raus = new Set();
    for (const e of r.eintraege || []) {
      // Der Schluessel heisst `name`, nicht `datei` - beim ersten Anlauf
      // lieferte die Registry deshalb nur elf statt fuenfundzwanzig Namen.
      if (e.name) raus.add(e.name);
      for (const l of e.needsLibs || []) raus.add(l);
      // Eine Vorbedingung ist eine Abhaengigkeit. `graftauto.js` startet gar
      // nicht erst ohne `graftplan.json` (registry.json, precondition) - eine
      // Datei, die eine Startbedingung IST, ist nicht tot.
      const vor = e.precondition && e.precondition.requiresFile;
      // ABER NUR QUELLDATEIEN. `data/…` entsteht zur Laufzeit IM SPIEL und
      // liegt nie unter src/ - als Positivlisteneintrag erzeugte sie prompt
      // ein "FEHLT data/cantwort.json".
      if (vor && !vor.startsWith("data/")) raus.add(vor);
    }
    // Die Registry selbst und die Daten, die sie beschreibt, gehoeren dazu -
    // sie stehen naturgemaess nicht als Eintrag in sich selbst.
    raus.add("registry.json");
    return [...raus];
  } catch {
    console.log("  HINWEIS: src/registry.json nicht lesbar - nur die Handliste gilt");
    return [];
  }
})();

const HANDLISTE = [
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
  /**
   * DATENDATEIEN, DIE LEBENDER CODE LIEST (Kritikerrunde zum Aufraeumen,
   * 04.09.2026).
   *
   * Sie standen auf der Archivliste, obwohl der Bot ohne sie nicht arbeitet -
   * und zwar deshalb, weil der Kandidaten-Grep nach `exec|run|import` sucht.
   * Eine Datei, die per `ns.read` GELESEN wird, taucht darin nie auf. Das ist
   * genau die Sorte Ausschluss, vor der CLAUDE.md warnt: das Werkzeug konnte
   * den Fall nicht anzeigen, also galt er als nicht vorhanden.
   *
   * Zwei der drei liegen NICHT im Spiel. Ein Verschieben nach `archiv/` haette
   * sie endgueltig aus der Reichweite der Bruecke genommen.
   */
  // `src/bn4net.js:116` - ns.read("lib/bitnodes.json"), die BitNode-Tabelle
  // des Motors. Liegt nicht im Spiel.
  "lib/bitnodes.json",
  // `src/ausgang.js:164` - ns.read("lib/blackops.json"). `src/bn4net.js:3791`
  // nennt sie ausserdem als Abhaengigkeit von blade.js, wo sie in needsLibs
  // fehlt.
  "lib/blackops.json",
  // Sprosse 5 der Strafleiter. Gestartet von `src/bn4net.js:4069 ff.` und
  // beauftragt von `src/guard.js:1087`; sie steht in KEINER Registry, weil
  // der Kern sie ad hoc startet. Liegt nicht im Spiel - aus archiv/ waere sie
  // gebaut, getestet und dauerhaft tot gewesen.
  "punish.js",
  // Bewusst sichtbar gehaltene Totdatei: `tools/ram-namen.js:105-110` fuehrt
  // sie als Beispiel, und `tools/test-ram-namen.js:118-120` prueft, dass sie
  // in der Ausgabe erscheint. Verschieben macht test-ram-namen.js rot und
  // damit Stufe A unerreichbar.
  "keepalive.js",
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

/**
 * BENANNTE AUSNAHMEN - eine Datei, ein Muster, ein Grund.
 *
 * Keine Wildcards, keine Ordner, kein "ab hier ist alles erlaubt". Wer eine
 * Zeile hinzufuegt, schreibt daneben, warum ausgerechnet diese Datei dieses
 * Wort tragen darf; sonst waechst hier die Liste, die den Grep entwertet.
 *
 * `export.js` ist der zweite, brueckenfreie Sicherungsweg (Auftrag 7.2). Er
 * ruft `ns.singularity.exportGame()`, und das Spiel legt die Datei unter
 * `bitburnerSave_<epoch>_BN<n>x<level>.json.gz` ab. Die Meldung an den
 * Menschen nennt diesen Namen, damit er sie im Downloads-Ordner findet - das
 * ist der Zweck der Meldung. Das Muster `bitburnerSave` faengt sonst Code,
 * der an der Spielstand-Datenbank herumschreibt; eine Zeichenkette in einem
 * Meldetext ist das Gegenteil davon.
 */
const AUSNAHMEN_MUSTER = [
  {
    datei: "export.js",
    muster: "bitburnerSave",
    grund: "nennt den Dateinamen in der Meldung an Eric - das IST der Zweck "
      + "des brueckenfreien Sicherungswegs (Auftrag 7.2)",
  },
];

function istAusnahme(datei, musterName) {
  return AUSNAHMEN_MUSTER.some((a) => a.datei === datei && a.muster === musterName);
}

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

const POSITIVLISTE = [...new Set([...HANDLISTE, ...AUS_REGISTRY])];
const zuPruefen = process.argv.includes("--alle") ? alleDateien : POSITIVLISTE;
console.log("  Positivliste: " + HANDLISTE.length + " von Hand + "
  + AUS_REGISTRY.length + " aus der Registry = " + POSITIVLISTE.length);

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
      //
      // DAS HAT BIS ZUM 04.09.2026 NICHT FUNKTIONIERT, und zwar in KEINER
      // Datei. `.` trifft in JavaScript keine Zeilenendezeichen - und `\r`
      // ist eines. Jede Datei dieses Repos steht unter CRLF (git schreibt sie
      // beim Auschecken so), also endete jede Zeile auf `\r`, `.*$` traf
      // nicht bis zum Ende, und der Ausdruck ersetzte gar nichts.
      //
      // Die Richtung war harmlos - der Grep war STRENGER als gedacht, nicht
      // schwaecher -, aber die Zusicherung im Kommentar war schlicht falsch,
      // und aufgefallen ist es erst, als `export.js` dazukam: eine Datei,
      // deren Aufgabe der Spielstand-Export ist und die den Dateinamen
      // deshalb in der Dokumentation nennt.
      const z = zeilen[i].replace(/\r$/, "");
      const ohneKommentar = z.replace(/^\s*(\*|\/\/|\/\*).*$/, "");
      if (v.muster.test(ohneKommentar) && !istAusnahme(rel, v.name)) {
        melde(v.name, rel, i + 1, z, v.grund);
      }
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

  /**
   * DER KOMMENTAR-STRIPPER, MIT UND OHNE CARRIAGE RETURN.
   *
   * Er war seit dem ersten Entwurf wirkungslos, und niemand hat es gemerkt:
   * `.` trifft in JavaScript kein `\r`, jede Datei dieses Repos steht unter
   * CRLF, also traf `.*$` nie bis zum Zeilenende und der Ausdruck ersetzte
   * nichts. Der Grep war dadurch strenger als dokumentiert - die harmlose
   * Richtung, aber die Zusicherung im Kommentar war falsch.
   *
   * Die zweite Zeile hier ist die eigentliche Probe. Ohne sie faellt die
   * naechste Fassung wieder in dieselbe Falle.
   */
  {
    const strippe = (z) => z.replace(/\r$/, "").replace(/^\s*(\*|\/\/|\/\*).*$/, "");
    const faelle = [
      [" * const k = " + JSON.stringify("bitburnerSave"), "Kommentar ohne CR"],
      [" * const k = " + JSON.stringify("bitburnerSave") + "\r", "Kommentar MIT CR (der Normalfall hier)"],
      ["// indexedDB.open(x)\r", "Zeilenkommentar mit CR"],
    ];
    for (const [zeile, was] of faelle) {
      if (strippe(zeile) === "") {
        console.log("  ok    Kommentar-Stripper: " + was);
      } else {
        probeFehler++;
        console.log("  ROT   Kommentar-Stripper laesst stehen (" + was + "): "
          + JSON.stringify(strippe(zeile)));
      }
    }
    // Und die Gegenprobe: echter Code darf NICHT gestrippt werden.
    const echt = "const k = " + JSON.stringify("bitburnerSave") + ";\r";
    if (strippe(echt).includes("bitburnerSave")) {
      console.log("  ok    echter Code bleibt stehen");
    } else {
      probeFehler++;
      console.log("  ROT   der Stripper frisst echten Code: " + JSON.stringify(strippe(echt)));
    }
  }

  /**
   * DIE AUSNAHMEN MUESSEN AUF ETWAS ZEIGEN.
   *
   * Eine Ausnahme fuer eine Datei, die es nicht mehr gibt, oder fuer ein
   * Muster, das nicht mehr existiert, ist ein stiller Freibrief: sie faellt
   * niemandem auf und deckt beim naechsten Umbau womoeglich etwas ganz
   * anderes zu.
   */
  {
    const alleNamen = [...VERBOTE, ...BLOCKADEN].map((v) => v.name);
    for (const a of AUSNAHMEN_MUSTER) {
      const dateiDa = fs.existsSync(path.join(SRC, a.datei))
        || fs.existsSync(path.join(WORKTREE, a.datei));
      const musterDa = alleNamen.includes(a.muster);
      if (dateiDa && musterDa) {
        console.log("  ok    Ausnahme " + a.datei + " / " + a.muster + " zeigt auf etwas");
      } else {
        probeFehler++;
        console.log("  ROT   Ausnahme ins Leere: " + a.datei + " / " + a.muster
          + (dateiDa ? "" : " - Datei fehlt")
          + (musterDa ? "" : " - Muster gibt es nicht mehr"));
      }
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
