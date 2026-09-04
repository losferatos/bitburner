/**
 * Rechnet den RAM-Bedarf eines Skripts aus, ohne das Spiel zu fragen.
 *
 * ===========================================================================
 * WARUM DAS DAS WICHTIGSTE WERKZEUG DIESES BAUS IST
 * ===========================================================================
 *
 * Der ganze Auftrag haengt an einer Zahl: 32 GB. So gross ist `home` nach
 * jedem Reset (`Prestige.ts:241-247`), und in diese 32 GB muessen der Kern,
 * der Waechter, der Wachhalter und genug Arbeiter passen, damit der Bot
 * ueberhaupt Geld verdient. Wer hier um 2 GB danebenliegt, merkt es nicht beim
 * Speichern, sondern acht Stunden spaeter im Nachtlauf - und dann ist der Lauf
 * hin.
 *
 * Bis hierher wurde geschaetzt. Am 04.09.2026 waren alle drei Schaetzungen in
 * `registry.json` falsch: 7,60 statt 7,00, 6,10 statt 3,85, 10,75 statt 10,80.
 *
 * ===========================================================================
 * ES IST EIN NACHBAU, KEIN NACHEMPFINDEN
 * ===========================================================================
 *
 * Die Vorlage ist `reference/v301/src/Script/RamCalculations.ts`, Funktion
 * `parseOnlyRamCalculate` und `parseOnlyCalculateDeps`, mit demselben acorn
 * aus derselben Referenzkopie. Uebernommen ist auch, was ueberraschend ist:
 *
 *   - Gezaehlt wird ueber BEZEICHNER, nicht ueber Aufrufe. `MemberExpression`
 *     laeuft in `node.property` weiter, also zaehlt jedes `x.hack` - egal
 *     woran. Ein Feld `daten.scan` in einem eigenen Objekt kostet 0,2 GB.
 *     Genau daran hing die wakelock-Falle (32 GB fuer ein `connect`, das
 *     einem Ereignisnamen gehoerte).
 *   - Jeder Name zaehlt EINMAL, egal wie oft er vorkommt (`loadedFns`).
 *   - Kommentare zaehlen nicht - sie stehen nicht im Syntaxbaum.
 *   - Importe werden verfolgt, und zwar der ganze globale Bereich des
 *     importierten Moduls, nicht nur die benutzten Namen.
 *   - `document` und `window` kosten je 25 GB, und nur beim ersten Mal.
 *   - Der Deckel liegt bei 1024 GB.
 *
 * ===========================================================================
 * GEEICHT, NICHT GEGLAUBT
 * ===========================================================================
 *
 * `node tools/ram.js --eichen` rechnet gegen `doku/ram-messung-2026-09-04.json`
 * - 114 Werte, die das laufende Spiel selbst geliefert hat. Ein Rechner, der
 * nicht gegen echte Messwerte geeicht ist, ist eine vierte Meinung.
 *
 * Aufruf:
 *   node tools/ram.js                      alle Dateien in src/, sortiert
 *   node tools/ram.js bn4net.js guard.js   nur diese
 *   node tools/ram.js --eichen             gegen die Live-Messung
 *   node tools/ram.js --registry           gegen registry.json (ramBaseGb)
 *   node tools/ram.js --einzeln bn4net.js  mit Einzelposten
 *
 * Optionen:
 *   --sf4=1|2|3   Singularity-Stufe (Vorgabe 1: der teuerste Fall)
 *   --bn=4        BitNode 4 - dort kostet Singularity immer den Grundpreis
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { baueBaum, kosten, Sing } from "./ramkosten.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
export const SRC = path.join(ROOT, "src");

const acornPfad = path.join(ROOT, "reference", "v301", "node_modules", "acorn", "dist", "acorn.mjs");
const walkPfad = path.join(ROOT, "reference", "v301", "node_modules", "acorn-walk", "dist", "walk.mjs");
const acorn = await import(pathToFileURL(acornPfad).href);
const walk = await import(pathToFileURL(walkPfad).href);

const BAUM = baueBaum();
const BASIS = BAUM.RamCostConstants.Base;
const DOM = BAUM.RamCostConstants.Dom;
const MAX = BAUM.RamCostConstants.Max;

const GLOBAL = ".__GLOBAL__";
const REF_RAM = ".^SPECIAL_ramOverride";
const OBJ_PROTO = Object.getOwnPropertyNames(Object.prototype);

/**
 * Wie Bitburner Importe aufloest.
 *
 * `from "lib/x.js"` meint `lib/x.js` auf home - der Pfad gilt ABSOLUT, nicht
 * relativ zur importierenden Datei (`isAbsolutePath` in
 * `Paths/Directory.ts:46-48`: absolut ist alles, was keine "./"- oder
 * "../"-Teile enthaelt).
 *
 * KORREKTUR (Skeptiker Runde 3, C5, 04.09.2026). Hier stand: "`./lib/x.js`
 * funktioniert im Spiel NICHT". Das ist falsch. `resolveFilePath`
 * (`Paths/FilePath.ts:61-74`) loest einen relativen Pfad gegen das Verzeichnis
 * der importierenden Datei auf - fuer ein Skript auf der obersten Ebene ist
 * das die Wurzel, und `./lib/x.js` landet genau dort, wo `lib/x.js` landet.
 *
 * Folgenlos war der Fehler, weil im Projekt keine Datei die "./"-Form
 * benutzt. Aber eine Doku, die eine funktionierende Schreibweise verbietet,
 * ist ein Fallstrick fuer den naechsten, der eine Datei anlegt - und das
 * Basismodul wurde tatsaechlich ignoriert, was in einem Unterverzeichnis
 * einen falschen Namen ergeben haette.
 *
 * @param {string} rohName der Pfad, wie er im import steht
 * @param {string} basis das importierende Modul (fuer relative Pfade)
 */
function loeseModul(rohName, basis = "") {
  let n = String(rohName);
  if (n.startsWith("/")) return endung(n.slice(1));
  if (!/(^|\/)\.{1,2}\//.test(n)) return endung(n);   // absolut - so wie das Spiel es sieht
  // Relativ: gegen das VERZEICHNIS des importierenden Moduls aufloesen.
  const ordner = String(basis).replace(/[^/]+$/, "");
  const teile = (ordner + n).split("/");
  const raus = [];
  for (const t of teile) {
    if (t === "." || t === "") continue;
    if (t === "..") { raus.pop(); continue; }
    raus.push(t);
  }
  return endung(raus.join("/"));
}

function endung(n) {
  return /\.(js|jsx|ts|tsx)$/.test(n) ? n : n + ".js";
}

/** Der Abhaengigkeitsgraph eines Moduls, nach parseOnlyCalculateDeps. */
function abhaengigkeiten(ast, modul) {
  const globalKey = modul + GLOBAL;
  const karte = { [globalKey]: new Set() };
  const internNachExtern = {};
  const weitereModule = [];

  const addRef = (key, name, wo = modul) => {
    const s = karte[key] || (karte[key] = new Set());
    const extern = internNachExtern[name];
    if (extern !== undefined) s.add(extern);
    s.add(wo + "." + name);
    s.add(name);                       // fuer eingebaute wie `hack`
  };

  /**
   * Der syntaktische RAM-Deckel: steht als ERSTE Anweisung in `main` ein
   * `ns.ramOverride(<Zahl>)`, gilt diese Zahl statt der Rechnung.
   *
   * Der Nachbau ist noetig, weil Werkzeuge dieses Projekts ihn benutzen
   * koennen - und ein Rechner, der ihn uebersieht, meldet fuer genau diese
   * Dateien einen zu hohen Wert und loest eine Diaet aus, die nichts bringt.
   */
  const pruefeOverride = (body) => {
    if (!body || !body.body || !body.body.length) return;
    const st = body.body[0];
    if (st.type !== "ExpressionStatement") return;
    const expr = st.expression;
    if (expr.type !== "CallExpression") return;
    if (!expr.arguments || expr.arguments.length !== 1) return;
    let k = expr.callee;
    for (;;) {
      if (k.type === "ParenthesizedExpression" || k.type === "ChainExpression") k = k.expression;
      else if (k.type === "MemberExpression") k = k.property;
      else break;
    }
    if (k.type !== "Identifier" || k.name !== "ramOverride") return;
    const lit = expr.arguments[0];
    if (lit.type !== "Literal" || typeof lit.value !== "number") return;
    if (!isFinite(lit.value) || lit.value < BASIS) return;
    karte[modul + REF_RAM] = new Set([String(Math.round(lit.value * 100) / 100)]);
  };

  const gemeinsam = () => ({
    Identifier: (node, st) => {
      if (OBJ_PROTO.includes(node.name)) return;
      addRef(st.key, node.name);
    },
    WhileStatement: (node, st, tiefer) => {
      addRef(st.key, "__SPECIAL_referenceWhile");
      if (node.test) tiefer(node.test, st);
      if (node.body) tiefer(node.body, st);
    },
    DoWhileStatement: (node, st, tiefer) => {
      addRef(st.key, "__SPECIAL_referenceWhile");
      if (node.test) tiefer(node.test, st);
      if (node.body) tiefer(node.body, st);
    },
    ForStatement: (node, st, tiefer) => {
      addRef(st.key, "__SPECIAL_referenceFor");
      if (node.init) tiefer(node.init, st);
      if (node.test) tiefer(node.test, st);
      if (node.update) tiefer(node.update, st);
      if (node.body) tiefer(node.body, st);
    },
    IfStatement: (node, st, tiefer) => {
      addRef(st.key, "__SPECIAL_referenceIf");
      if (node.test) tiefer(node.test, st);
      if (node.consequent) tiefer(node.consequent, st);
      if (node.alternate) tiefer(node.alternate, st);
    },
    // DIE STELLE, AUF DIE ES ANKOMMT: der Besuch laeuft in die PROPERTY
    // weiter. Deshalb kostet `irgendwas.scan` genauso viel wie `ns.scan`.
    MemberExpression: (node, st, tiefer) => {
      if (node.object) tiefer(node.object, st);
      if (node.property) tiefer(node.property, st);
    },
  });

  walk.recursive(ast, { key: globalKey }, Object.assign({
    ImportDeclaration: (node, st) => {
      const name = loeseModul(node.source.value, modul);
      weitereModule.push(name);
      karte[st.key].add(name + GLOBAL);
      for (const spec of node.specifiers) {
        if (spec.type === "ImportSpecifier" && spec.imported.type === "Identifier") {
          internNachExtern[spec.local.name] = name + "." + spec.imported.name;
        } else {
          karte[st.key].add(name + ".*");
        }
      }
    },
    FunctionDeclaration: (node) => {
      if (node.id && node.id.name === "main") pruefeOverride(node.body);
      const key = modul + "." + (node.id === null ? "__SPECIAL_DEFAULT_EXPORT__" : node.id.name);
      walk.recursive(node, { key }, gemeinsam());
    },
    ExportNamedDeclaration: (node, st, tiefer) => {
      if (node.declaration != null) { tiefer(node.declaration, st); return; }
      for (const spec of node.specifiers) {
        if (spec.exported.type === "Literal") continue;
        const exportName = modul + "." + spec.exported.name;
        if (node.source != null && typeof node.source.value === "string"
            && spec.local.type === "Identifier") {
          addRef(exportName, spec.local.name, loeseModul(node.source.value, modul));
          weitereModule.push(loeseModul(node.source.value, modul));
        } else if (spec.local.type === "Identifier" && spec.exported.name !== spec.local.name) {
          addRef(exportName, spec.local.name);
        }
      }
    },
  }, gemeinsam()));

  return { karte, weitereModule };
}

/** Sucht einen Namen im Kostenbaum - auch in den Namensraeumen. */
function findeKosten(obj, ref, praefix = "") {
  if (!obj) return undefined;
  const treffer = Object.entries(obj).find(([k]) => k === ref);
  if (treffer !== undefined
      && (typeof treffer[1] === "number" || typeof treffer[1] === "function"
          || treffer[1] instanceof Sing)) {
    return { wert: treffer[1], name: praefix + ref };
  }
  for (const [k, v] of Object.entries(obj)) {
    if (!v || typeof v !== "object" || v instanceof Sing) continue;
    const gefunden = findeKosten(v, ref, k + ".");
    if (gefunden) return gefunden;
  }
  return undefined;
}

function preis(wert, lage) {
  if (wert instanceof Sing) return wert.wert(lage);
  if (typeof wert === "function") return wert();
  return typeof wert === "number" ? wert : 0;
}

/**
 * Der RAM-Bedarf einer Datei.
 *
 * @param {string} datei   Pfad relativ zu SRC oder absolut
 * @param {{sf4?: number, bitNode?: number, wurzel?: string}} lage
 * @returns {{gb: number, posten: Array, fehler: string|null}}
 */
export function rechne(datei, lage = {}) {
  const wurzel = lage.wurzel || SRC;
  const start = path.isAbsolute(datei)
    ? path.relative(wurzel, datei).replace(/\\/g, "/")
    : datei.replace(/\\/g, "/");

  const lies = (modul) => {
    const p = path.join(wurzel, modul);
    return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
  };
  if (lies(start) === null) return { gb: null, posten: [], fehler: "Datei fehlt: " + start };

  let karte = {};
  const fertig = new Set();
  const schlange = [start];

  while (schlange.length) {
    const modul = schlange.shift();
    if (fertig.has(modul)) continue;
    const code = lies(modul);
    if (code === null) {
      return { gb: null, posten: [], fehler: "Import nicht auflaesbar: " + modul };
    }
    let ast;
    try {
      ast = acorn.parse(code, { ecmaVersion: 2023, sourceType: "module",
        allowAwaitOutsideFunction: true });
    } catch (e) {
      return { gb: null, posten: [], fehler: "Syntaxfehler in " + modul + ": " + e.message };
    }
    const r = abhaengigkeiten(ast, modul);
    fertig.add(modul);
    for (const m of r.weitereModule) {
      if (!fertig.has(m) && !schlange.includes(m)) schlange.push(m);
    }
    karte = Object.assign(karte, r.karte);
  }

  let gb = BASIS;
  const posten = [{ art: "basis", name: "baseCost", gb: BASIS }];
  const offen = Object.keys(karte).filter((s) => s.startsWith(start));
  const erledigt = new Set();
  const gezaehlt = {};

  while (offen.length) {
    const ref = offen.shift();
    if (ref === undefined) continue;

    if (ref.endsWith(REF_RAM)) {
      if (ref !== start + REF_RAM) continue;
      const [erster] = karte[ref];
      const wert = Number(erster);
      return { gb: wert, posten: [{ art: "override", name: "ramOverride", gb: wert }], fehler: null };
    }
    if (ref === "document" && !erledigt.has("document")) {
      gb += DOM; posten.push({ art: "dom", name: "document", gb: DOM });
    }
    if (ref === "window" && !erledigt.has("window")) {
      gb += DOM; posten.push({ art: "dom", name: "window", gb: DOM });
    }
    erledigt.add(ref);

    if (ref.endsWith(".*")) {
      const praefix = ref.slice(0, -2);
      for (const ident of Object.keys(karte).filter((k) => k.startsWith(praefix))) {
        for (const dep of karte[ident] || []) if (!erledigt.has(dep)) offen.push(dep);
      }
    } else {
      for (const dep of karte[ref] || []) if (!erledigt.has(dep)) offen.push(dep);
    }

    if (gezaehlt[ref]) continue;
    gezaehlt[ref] = true;
    const gefunden = findeKosten(BAUM.RamCosts, ref);
    const p = preis(gefunden ? gefunden.wert : 0, lage);
    if (p > 0) {
      gb += p;
      posten.push({ art: "fn", name: gefunden ? gefunden.name : ref, gb: p });
    }
  }

  if (gb > MAX) {
    gb = MAX;
    posten.push({ art: "deckel", name: "Max Ram Cap", gb: MAX });
  }
  // Bitburner rundet auf zwei Stellen (roundToTwo).
  return { gb: Math.round(gb * 100) / 100, posten, fehler: null };
}

// ===========================================================================
// Kommandozeile
// ===========================================================================

if (import.meta.url === "file:///" + process.argv[1].replace(/\\/g, "/")) {
  const args = process.argv.slice(2);
  const sf4Arg = args.find((a) => a.startsWith("--sf4="));
  const bnArg = args.find((a) => a.startsWith("--bn="));
  const lage = {
    sf4: sf4Arg ? Number(sf4Arg.split("=")[1]) : 1,
    bitNode: bnArg ? Number(bnArg.split("=")[1]) : undefined,
  };
  const einzeln = args.includes("--einzeln");
  const dateien = args.filter((a) => !a.startsWith("--"));

  if (args.includes("--eichen")) {
    const mess = path.join(ROOT, "doku", "ram-messung-2026-09-04.json");
    if (!fs.existsSync(mess)) {
      console.log("Keine Live-Messung gefunden: " + mess);
      process.exit(1);
    }
    // Die Messung stammt aus dem HAUPTBAUM zum Messzeitpunkt. Gegen den
    // Worktree zu eichen hiesse, Aenderungen als Rechenfehler zu lesen.
    const wurzel = path.join(ROOT, "src");
    const daten = JSON.parse(fs.readFileSync(mess, "utf8"));
    let gleich = 0; const ab = [];
    for (const d of daten) {
      const r = rechne(d.file, { sf4: 1, wurzel });
      if (r.gb === null) { ab.push([d.file, d.live41, "FEHLER: " + r.fehler]); continue; }
      if (Math.abs(r.gb - d.live41) < 0.005) gleich++;
      else ab.push([d.file, d.live41, r.gb]);
    }
    console.log("");
    console.log("=== Eichung gegen die Live-Messung vom 04.09.2026 ===");
    console.log("  " + gleich + " von " + daten.length + " auf 0,00 GB gleich");
    if (ab.length) {
      console.log("");
      console.log("  Abweichungen (Datei / live / gerechnet):");
      for (const [f, l, g] of ab) console.log("    " + f.padEnd(22) + String(l).padStart(9) + "   " + g);
      console.log("");
      console.log("  Eine Abweichung ist NICHT automatisch ein Rechenfehler: die");
      console.log("  Messung ist vom 04.09., und der Hauptbaum hat sich seither");
      console.log("  geaendert. Zu pruefen ist, ob die Datei seit der Messung");
      console.log("  angefasst wurde (git log).");
    }
    console.log("");
    process.exit(ab.length > 2 ? 1 : 0);
  }

  if (args.includes("--registry")) {
    const reg = JSON.parse(fs.readFileSync(path.join(SRC, "registry.json"), "utf8"));
    let rot = 0;
    console.log("");
    console.log("=== registry.json gegen den Rechner ===");
    console.log("  (ramBaseGb ist der knotenunabhaengige Teil, also OHNE Singularity)");
    console.log("");
    for (const e of reg.eintraege) {
      if (e.unbuilt || e.ramBaseGb === null) {
        console.log("  " + e.name.padEnd(20) + "     -        (noch nicht gebaut)");
        continue;
      }
      // ramBaseGb ist ohne Singularity. Den Anteil bekommt man, indem man in
      // BitNode 4 rechnet (dort ist der Faktor 1) und den Singularity-Anteil
      // abzieht - oder direkt: die Differenz zwischen SF4.3 und dem
      // Nicht-Singularity-Teil ist genau ramSingGb.
      const bn4 = rechne(e.name, { bitNode: 4 });
      if (bn4.gb === null) { console.log("  " + e.name.padEnd(20) + "  FEHLER  " + bn4.fehler); rot++; continue; }
      const sing = bn4.posten.filter((p) => p.name.startsWith("singularity."))
        .reduce((a, b) => a + b.gb, 0);
      const basis = Math.round((bn4.gb - sing) * 100) / 100;
      const okB = Math.abs(basis - e.ramBaseGb) < 0.005;
      const okS = e.ramSingGb === undefined || e.ramSingGb === null
        || Math.abs(sing - e.ramSingGb) < 0.005;
      if (!okB || !okS) rot++;
      console.log("  " + (okB && okS ? "ok   " : "ROT  ") + e.name.padEnd(20)
        + " Basis " + String(basis).padStart(7) + " (Registry " + String(e.ramBaseGb).padStart(7) + ")"
        + "   Sing " + String(sing).padStart(6) + " (Registry "
        + String(e.ramSingGb ?? "-").padStart(6) + ")");
    }
    console.log("");
    console.log("=== " + (rot ? rot + " Abweichung(en)" : "alle Werte stimmen") + " ===");
    console.log("");
    process.exit(rot ? 1 : 0);
  }

  const sammle = (ordner) => {
    const raus = [];
    for (const e of fs.readdirSync(ordner, { withFileTypes: true })) {
      const p = path.join(ordner, e.name);
      if (e.isDirectory()) raus.push(...sammle(p));
      else if (e.name.endsWith(".js")) raus.push(path.relative(SRC, p).replace(/\\/g, "/"));
    }
    return raus;
  };
  const liste = dateien.length ? dateien : sammle(SRC).sort();

  const ergebnisse = liste.map((f) => ({ f, r: rechne(f, lage) }));
  ergebnisse.sort((a, b) => (b.r.gb ?? -1) - (a.r.gb ?? -1));

  console.log("");
  console.log("=== RAM-Bedarf (SF4." + (lage.bitNode === 4 ? "x, BitNode 4" : lage.sf4) + ") ===");
  console.log("    " + SRC);
  console.log("");
  for (const { f, r } of ergebnisse) {
    if (r.gb === null) { console.log("  FEHLER  " + f.padEnd(22) + r.fehler); continue; }
    const marke = r.gb <= 32 ? " " : "!";
    console.log("  " + marke + " " + String(r.gb).padStart(8) + " GB  " + f);
    if (einzeln) {
      for (const p of r.posten.filter((x) => x.gb > 0)) {
        console.log("             " + String(p.gb).padStart(7) + "  " + p.name);
      }
    }
  }
  console.log("");
  console.log("  ! = passt nicht allein auf ein frisches home (32 GB)");
  console.log("");
}
