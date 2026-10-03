// VERSION-TSC (Audit 03.10.2026, Robustheit "Version 3.0.1 -> 3.0.2").
//
// Frage: Ruft der Bot (src/) ns-Funktionen auf, die es in der LAUFENDEN Spielfassung nicht gibt
// oder die dort anders heissen/andere Argumente haben? scope-alle.mjs prueft gegen
// src/NetscriptDefinitions.d.ts - und diese Datei ist byte-gleich zu reference/bitburner-src
// (3.0.2-dev, Stand 13.08.2026), NICHT zur laufenden Fassung. Der Spielstand beweist 3.0.1
// (RunningScript traegt "scriptKey", SettingsSave hat kein EnableSaveDataBackupReminder).
//
// Vorgehen: dieselbe tsc-Kopie wie scope-alle (ns-Parameter wird typisiert), einmal gegen die
// d.ts von reference/v301 (LIVE), einmal gegen reference/bitburner-src (dev). Gemeldet werden
// Diagnosen, die NUR gegen v301 auftreten (= Fehler im Live-Spiel, in dev unsichtbar), plus
// die Gegenprobe (nur gegen dev) und eine SELBSTPROBE: ein erfundener dev-only Aufruf
// (ns.ui.renderPage) MUSS gegen v301 rot und gegen dev gruen sein.
//
// Aufruf: node tools/audit/version-tsc.mjs [--json datei]
// src/ wird nur gelesen. Kopien liegen in os.tmpdir().
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..", "..");
const SRC = path.join(ROOT, "src");
const require = createRequire(import.meta.url);
const V301N = path.join(ROOT, "reference", "v301", "node_modules");
const ts = require(path.join(V301N, "typescript"));
const acorn = await import(pathToFileURL(path.join(V301N, "acorn", "dist", "acorn.mjs")).href);
const parseOpt = { ecmaVersion: "latest", sourceType: "module", locations: true };

const D_TS = {
  live: path.join(ROOT, "reference", "v301", "src", "ScriptEditor", "NetscriptDefinitions.d.ts"),
  dev: path.join(ROOT, "reference", "bitburner-src", "src", "ScriptEditor", "NetscriptDefinitions.d.ts"),
};

function sammle(dir, rel = "") {
  const out = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? rel + "/" + e.name : e.name;
    if (e.isDirectory()) out.push(...sammle(dir, r));
    else out.push(r);
  }
  return out;
}
const alle = sammle(SRC).filter((f) => f !== "NetscriptDefinitions.d.ts");
const quellen = new Map(alle.filter((f) => f.endsWith(".js")).map((f) => [f, fs.readFileSync(path.join(SRC, f), "utf8")]));

// Kopie aus scope-alle.mjs:81-106 (ns-Parameter bekommt den Typ NS)
function nsEinfuegepunkte(code) {
  const ast = acorn.parse(code, parseOpt);
  const punkte = new Set();
  const hatNs = (fn) => fn.params.some((p) => (p.type === "Identifier" && p.name === "ns")
    || (p.type === "AssignmentPattern" && p.left.type === "Identifier" && p.left.name === "ns"));
  const walk = (node, stmt) => {
    if (!node || typeof node.type !== "string") return;
    let s = stmt;
    if (/Statement$|Declaration$/.test(node.type) && node.type !== "VariableDeclarator") s = node;
    if (node.type === "Property" || node.type === "MethodDefinition" || node.type === "PropertyDefinition") s = node;
    const fn = node.type === "FunctionDeclaration" || node.type === "FunctionExpression"
      || node.type === "ArrowFunctionExpression";
    if (fn && hatNs(node)) {
      const ziel = node.type === "FunctionDeclaration"
        ? (stmt && /^Export/.test(stmt.type) ? stmt : node) : (s ?? node);
      punkte.add(ziel.start);
    }
    for (const k of Object.keys(node)) {
      if (k === "loc" || k === "start" || k === "end") continue;
      const v = node[k];
      if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === "string") walk(c, s); }
      else if (v && typeof v.type === "string") walk(v, s);
    }
  };
  walk(ast, null);
  return [...punkte].sort((a, b) => b - a);
}

const PROBE_DATEI = "zz_versionsprobe.js";
// Selbstprobe: jede Zeile nutzt etwas, das NUR dev kennt (Zeile 3-8) bzw. beide kennen (Zeile 9)
const PROBE_CODE = [
  "export async function main(ns) {",
  "  ns.ui.renderPage(null);",
  "  ns.format.money(5);",
  "  ns.singularity.hasExportGameBonus();",
  "  ns.isFullPort(1);",
  "  ns.dnet.freezeServer('x');",
  "  ns.ui.openCodeEditor('a.js');",
  "  ns.ls();",
  "  ns.getServerMaxRam('home');",
  "}",
].join("\n");

function laufe(name) {
  const WORK = path.join(process.env.VERSION_TSC_DIR || os.tmpdir(), "bb-version-tsc-" + name);
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.mkdirSync(WORK, { recursive: true });
  const roots = [];
  const schreibe = (rel, code) => {
    const ziel = path.join(WORK, rel);
    fs.mkdirSync(path.dirname(ziel), { recursive: true });
    const tiefe = rel.split("/").length - 1;
    const bis = tiefe === 0 ? "." : Array(tiefe).fill("..").join("/");
    const eins = nsEinfuegepunkte(code).map((p) => [p, '/** @param {import("' + bis + '/NetscriptDefinitions").NS} ns */ ']);
    eins.sort((x, y) => y[0] - x[0]);
    for (const [p, text] of eins) code = code.slice(0, p) + text + code.slice(p);
    fs.writeFileSync(ziel, code);
    roots.push(ziel);
  };
  for (const rel of alle) {
    if (rel.endsWith(".js")) schreibe(rel, quellen.get(rel));
    else {
      const ziel = path.join(WORK, rel);
      fs.mkdirSync(path.dirname(ziel), { recursive: true });
      fs.copyFileSync(path.join(SRC, rel), ziel);
    }
  }
  schreibe(PROBE_DATEI, PROBE_CODE);
  fs.copyFileSync(D_TS[name], path.join(WORK, "NetscriptDefinitions.d.ts"));
  const glob = path.join(WORK, "_globals.d.ts");
  fs.writeFileSync(glob, [
    'type NS = import("./NetscriptDefinitions").NS;',
    'type NetscriptPort = import("./NetscriptDefinitions").NetscriptPort;',
    'type Server = import("./NetscriptDefinitions").Server;',
  ].join("\n") + "\n");
  roots.push(glob);
  const optionen = {
    allowJs: true, checkJs: true, noEmit: true, strict: false, noImplicitAny: false,
    target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    baseUrl: WORK, resolveJsonModule: true, skipLibCheck: true,
    lib: ["lib.esnext.d.ts", "lib.dom.d.ts"], types: [],
  };
  const programm = ts.createProgram({ rootNames: roots, options: optionen });
  const diag = ts.getPreEmitDiagnostics(programm);
  const liste = [];
  for (const d of diag) {
    if (!d.file) continue;
    const rel = path.relative(WORK, d.file.fileName).split(path.sep).join("/");
    if (rel.endsWith(".d.ts")) continue;
    const { line, character } = d.file.getLineAndCharacterOfPosition(d.start ?? 0);
    liste.push({ file: rel, line: line + 1, col: character + 1, code: d.code,
      msg: ts.flattenDiagnosticMessageText(d.messageText, "\n").split("\n")[0] });
  }
  return liste;
}

const live = laufe("live");
const dev = laufe("dev");
const schl = (d) => d.file + ":" + d.line + ":" + d.col + ":" + d.code + ":" + d.msg;
const sLive = new Set(live.map(schl));
const sDev = new Set(dev.map(schl));

// Selbstprobe
const probeLive = live.filter((d) => d.file === PROBE_DATEI);
const probeDev = dev.filter((d) => d.file === PROBE_DATEI);
console.log("SELBSTPROBE (Probedatei, " + PROBE_DATEI + ")");
console.log("  gegen v301 (live): " + probeLive.length + " Diagnosen; erwartet >= 6 (Zeilen 2-7)");
for (const d of probeLive) console.log("    L" + d.line + " TS" + d.code + " " + d.msg);
console.log("  gegen dev: " + probeDev.length + " Diagnosen; erwartet 0 bis auf ns.ls() ohne Host? -> dev erlaubt es");
for (const d of probeDev) console.log("    L" + d.line + " TS" + d.code + " " + d.msg);
const probeOk = probeLive.length >= 6 && probeDev.length === 0;
console.log("  Selbstprobe " + (probeOk ? "OK" : "ROT - Auswertung ungueltig"));

const nurLive = live.filter((d) => d.file !== PROBE_DATEI && !sDev.has(schl(d)));
const nurDev = dev.filter((d) => d.file !== PROBE_DATEI && !sLive.has(schl(d)));
console.log("\nDiagnosen gesamt: live " + live.filter((d) => d.file !== PROBE_DATEI).length + ", dev " + dev.filter((d) => d.file !== PROBE_DATEI).length);
console.log("NUR gegen live (v301): " + nurLive.length);
for (const d of nurLive) console.log("  " + d.file + ":" + d.line + " TS" + d.code + " " + d.msg);
console.log("NUR gegen dev: " + nurDev.length);
for (const d of nurDev) console.log("  " + d.file + ":" + d.line + " TS" + d.code + " " + d.msg);
const beide = live.filter((d) => d.file !== PROBE_DATEI && sDev.has(schl(d)));
const proCode = {};
for (const d of beide) proCode[d.code] = (proCode[d.code] || 0) + 1;
console.log("In beiden gleich (Auswahl nach TS-Code): " + JSON.stringify(proCode));
const ja = process.argv.indexOf("--json");
if (ja >= 0) fs.writeFileSync(process.argv[ja + 1], JSON.stringify({ nurLive, nurDev, beide }, null, 1));
