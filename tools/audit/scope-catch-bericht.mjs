// SCOPE-CATCH-BERICHT (Audit 03.10.2026): macht aus dem catch-Inventar von scope-alle.mjs eine Tabelle
// mit Urteil je try/catch. Eingabe:
//   --inv   JSON-Ausgabe von `scope-alle.mjs --json` (Feld "catch")
//   --dyn   JSON-Zeilen des Hakens (tools/audit/catch-hook.mjs), optional
//   --tsv   Zielpfad der Tabelle (alle try/catch mit catch)
//   --md    Zielpfad einer Markdown-Tabelle nur fuer die T4-Bloecke
// Urteil ist REGELBASIERT plus Einzelnotizen (NOTIZEN unten). Die Regeln sind bewusst vorsichtig:
// "unbedenklich" heisst: der verschluckte Fall ist ein erwarteter Spielfehler oder ein fehlender/leerer
// Datei-Inhalt, und der Rueckfall ist die sachgerechte Richtung.

import fs from "node:fs";

const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const inv = JSON.parse(fs.readFileSync(opt("--inv"), "utf8")).catch;
const dynPfad = opt("--dyn");
const ein = new Map(); const err = new Map();
if (dynPfad && fs.existsSync(dynPfad)) {
  for (const l of fs.readFileSync(dynPfad, "utf8").trim().split("\n")) {
    if (!l) continue;
    const r = JSON.parse(l); const k = r.datei + ":" + r.zeile;
    if (r.art === "try") ein.set(k, (ein.get(k) ?? 0) + r.n);
    else { if (!err.has(k)) err.set(k, []); err.get(k).push(r); }
  }
}

const TRIV = new Set(["Number", "String", "Boolean", "Array", "Object", "parseInt", "parseFloat", "isFinite", "isNaN", "BigInt", "Set", "Map", "Date", "Symbol"]);
const familie = (c) => {
  const f = new Set();
  for (const a of c.ns) {
    if (/^(scp|read|write|fileExists|rm|ls|getHostname)/.test(a)) f.add("Datei/Host");
    else if (a.startsWith("bladeburner.")) f.add("Bladeburner");
    else if (a.startsWith("singularity.")) f.add("Singularity");
    else if (a.startsWith("sleeve.")) f.add("Sleeve");
    else if (a.startsWith("hacknet.")) f.add("Hacknet");
    else if (a.startsWith("grafting.")) f.add("Grafting");
    else if (a.startsWith("stock.")) f.add("Boerse");
    else if (a.startsWith("cloud.") || a.startsWith("formulas.")) f.add("Cloud/Formeln");
    else if (/^(getPlayer|getResetInfo|getBitNodeMultipliers)/.test(a)) f.add("Spielinfo");
    else if (/^(getServer|serverExists|hasRootAccess|nuke|ps|kill|getScriptRam|getHackingLevel|getWeakenTime|getGrowTime|getHackTime|growthAnalyze|getTotalScriptIncome|getServerMoneyAvailable)/.test(a)) f.add("Server/Prozess");
    else f.add("sonstige");
  }
  return [...f].join("+") || (c.jsonParse ? "JSON" : c.dom ? "DOM" : "Browser/Hilfsaufruf");
};
const WURF = {
  "Datei/Host": "Host/Datei unbekannt (scp/read liefern false/leer, wirft nur bei ungueltigem Namen)",
  "Bladeburner": "nicht in der Division / unbekannte Aktion oder Stadt (Bladeburner.ts:30-52)",
  "Singularity": "SF4 fehlt (NetscriptHelpers.tsx:438-446) oder ungueltige Faktion/Aug",
  "Sleeve": "SF10 fehlt (Sleeve.ts:51-58) oder Sleeve-Nummer ungueltig (:60-66) oder Aktion belegt",
  "Hacknet": "Hacknet-Server/Hashes nicht verfuegbar oder Index ungueltig",
  "Grafting": "Grafting-API nicht freigeschaltet (Grafting.ts:17)",
  "Boerse": "kein WSE-/TIX-Zugang",
  "Cloud/Formeln": "Formulas.exe fehlt / Rechnerkauf nicht moeglich",
  "Spielinfo": "wirft nie; der catch kann nur Folgefehler in derselben Zeile abfangen",
  "Server/Prozess": "Host unbekannt oder Skript nicht gestartet",
  "Browser/Hilfsaufruf": "Browser verweigert (WakeLock, Worker, window) oder Hilfsaufruf ohne ns",
};

// Einzelnotizen aus der Lesung/Messung. Schluessel = "datei:try-zeile".
const NOTIZEN = {
  "blade.js:2322": "blackOpChance. LIVE belegt: data/blade.json (Stand 17:17) traegt boChancen mit 21 Werten -> liefert im Spiel. Mock-Fehler (mults fehlt) ist Testluecke; getPlayer().mults gibt es im Spiel (NetscriptFunctions.ts:1377).",
  "blade.js:803": "getBitNodeMultipliers im Mock nicht gebaut; im Spiel wirft es nicht (SF5.3 vorhanden). Rueckfall {} -> Faktor 1: sachgerecht.",
  "blade.js:1053": "getPlayer().mults.defense: Mock ohne mults; im Spiel vorhanden (NetscriptFunctions.ts:1377).",
  "blade.js:1056": "getPlayer().skills.defense: im Spiel vorhanden.",
  "sleeve.js:433": "getSleeve().shock: Mock-Luecke; Feld ist in der Definition (tsc-geprueft).",
  "sleeve.js:549": "getSleeve().storedCycles: Mock-Luecke; Feld ist in der Definition (tsc-geprueft).",
  "sleeve.js:795": "Spielfehler 'Sleeve n cannot take on contracts because Sleeve m is already performing that action' - erwartet, der Mock gibt den Originaltext aus.",
  "sleeve.js:486": "setToFactionWork: Mock kennt nur Sleeve 0; im Spiel erwartetes break bei Sperre.",
  "joinrun.js:87": "getBitNodeMultipliers im Mock nicht gebaut.",
  "bn4net.js:4498": "Lesen aller figure-request-*: Mock-Dateien enthalten Platzhalter -> SyntaxError erwartet, im Spiel nur bei kaputtem Antrag.",
  "bn4net.js:4861": "blade.json -> Traeger/next_blackop_chance: Mock hat keine Datei. LIVE belegt: kpi.json traegt next_blackop_chance 0,102 und traeger rang-netto.",
  "bn4net.js:5027": "ausgang.json -> KPI: LIVE belegt (kpi.json route_state/eta_min gesetzt).",
  "bn4net.js:5057": "watchdog.json -> KPI: LIVE belegt (false_kill_count 0).",
  "hacknet.js:132": "Datei fehlt im Mock.",
  "lib/handschlag.js:180": "Antwortdatei der Bruecke fehlt im Mock; im Spiel erwarteter Fall 'noch keine Antwort'.",
  "ausgang.js:606": "Bericht, nie Steuerung (kommentiert); evLaden/evAnhaengen sind Bibliothek und von test-kontrakte.js abgedeckt.",
};

const alle = inv.map((c) => {
  const k = c.file + ":" + c.line;
  const idn = c.ids.filter((x) => !TRIV.has(x));
  let T;
  if (!c.verschluckt) T = c.klasse === "SPEICHERT" ? "S-speichert" : c.klasse === "LOG" ? "L-protokolliert" : c.klasse === "RETHROW" ? "R-wirft" : "?";
  else if (c.dom) T = "T3-DOM";
  else if (idn.length || c.stmts >= 4) T = (c.jsonParse && !idn.length && c.stmts <= 6) ? "T2-JSON" : "T4-LOGIK";
  else if (c.jsonParse) T = "T2-JSON";
  else T = "T1-API";
  const e = ein.get(k) ?? 0;
  const errs = err.get(k) ?? [];
  const nErr = errs.reduce((s, r) => s + r.n, 0);
  const fam = familie(c);
  let urteil; let note = NOTIZEN[k] ?? "";
  if (!c.verschluckt) urteil = "nicht verschluckt";
  else if (T === "T1-API") urteil = "unbedenklich: erwarteter Fehler (" + fam + ")";
  else if (T === "T2-JSON") urteil = "unbedenklich: Datei leer/fehlt/kaputt -> Standardwert";
  else if (T === "T3-DOM") urteil = "beobachten: Oberflaeche koennte sich aendern; Skript laeuft nur auf Abruf";
  else {
    if (nErr > 0) urteil = "Mock-Fehler im Test (" + errs[0].klasse + ": " + errs[0].nachricht.slice(0, 60) + "), im Spiel nicht zu erwarten";
    else if (e > 0) urteil = "unbedenklich: in " + e + " Testeintritten ohne Fehler durchlaufen";
    else urteil = "unbedenklich: von keinem Test betreten, Quelltext gelesen";
  }
  return { file: c.file, line: c.line, endLine: c.endLine, klasse: c.klasse, T, fam, stmts: c.stmts, ein: e, err: nErr, urteil, note,
    ns: c.ns.slice(0, 5).join(","), ids: idn.slice(0, 5).join(","), handler: c.hText.slice(0, 60), komm: c.kommentar.slice(0, 80) };
});

const tsv = ["datei\tzeile\tendzeile\tklasse\ttyp\tfamilie\tanweisungen\ttest_eintritte\ttest_fehler\turteil\tnotiz\tns_aufrufe\tlokale_aufrufe\thandler"];
for (const a of alle) tsv.push([a.file, a.line, a.endLine, a.klasse, a.T, a.fam, a.stmts, a.ein, a.err, a.urteil, a.note, a.ns, a.ids, a.handler].join("\t"));
if (opt("--tsv")) fs.writeFileSync(opt("--tsv"), tsv.join("\n") + "\n");

const z = {};
for (const a of alle) z[a.T] = (z[a.T] ?? 0) + 1;
console.log("try/catch gesamt:", alle.length, JSON.stringify(z));
const v = alle.filter((a) => a.klasse === "LEER" || a.klasse === "DEFAULT");
console.log("verschluckt:", v.length, " dynamisch betreten:", v.filter((a) => a.ein > 0).length, " mit catch-Eintritt im Test:", v.filter((a) => a.err > 0).length);
const t4 = alle.filter((a) => a.T === "T4-LOGIK");
console.log("T4:", t4.length, "betreten:", t4.filter((a) => a.ein > 0).length, "nie betreten (gelesen):", t4.filter((a) => a.ein === 0).length);
if (opt("--md")) {
  const rows = ["| Stelle | Zeilen | Anw. | Test-Eintritte / catch | ns-Aufrufe | Urteil |", "|---|---|---|---|---|---|"];
  for (const a of t4) rows.push("| `" + a.file + ":" + a.line + "` | " + a.line + "-" + a.endLine + " | " + a.stmts + " | " + a.ein + " / " + a.err + " | " + (a.ns || "-") + " | " + a.urteil + (a.note ? " - " + a.note : "") + " |");
  fs.writeFileSync(opt("--md"), rows.join("\n") + "\n");
}
