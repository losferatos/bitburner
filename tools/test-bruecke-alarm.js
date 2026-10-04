/**
 * Zwei Anzeigefehler im Check-in (04.10.2026).
 *
 * 1. Sicherungsalarm erlischt nie: sync/bridge.js `alarm()` setzte
 *    state.alarm, nichts nahm ihn zurueck. Ein HTTP 502 am 03.10. 18:17 stand
 *    20 h als "ALARM: Sicherung ausgefallen (hourly)" im Check-in, obwohl jede
 *    Sicherung danach gruen war. Jetzt traegt jeder Alarm eine Quelle; die
 *    naechste gruene Sicherung hebt nur Alarme der Quelle "sicherung" auf, und
 *    ein Sicherungsalarm verdraengt keinen anderen Alarm (Skeptiker 04.10.).
 *    Ausfaelle werden 24 h lang gezaehlt.
 * 2. tools/checkin.js druckte `chance` aus blade.json als Chance der Aktion,
 *    ohne zu sagen, dass es die UNTERGRENZE ist (blade.js meldeLage(s.min)).
 *    Jetzt "Chance ab", und die naechste Black Op steht getrennt dabei.
 *
 * alarm() wird aus dem Quelltext geloest und isoliert ausgefuehrt.
 *
 * Aufruf: node tools/test-bruecke-alarm.js [repo-verzeichnis]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let gruen = 0, rot = 0;
const pruefe = (name, ok, info = "") => {
  if (ok) { gruen++; console.log("  ok    " + name); }
  else { rot++; console.log("  ROT   " + name + (info ? " - " + info : "")); }
};

const bruecke = fs.readFileSync(path.join(ROOT, "sync", "bridge.js"), "utf8");

// Die Erfolgsstrecke von sichereJetzt: von der "gruen"-Logzeile bis zum return true.
const start = bruecke.indexOf('"Sicherung " + anlass + " gruen: "');
const ende = start >= 0 ? bruecke.indexOf("return true;", start) : -1;
const erfolg = start >= 0 && ende > start ? bruecke.slice(start, ende) : "";
pruefe("sichereJetzt hat eine Erfolgsstrecke", erfolg.length > 0);
pruefe("Erfolgsstrecke setzt state.alarm = null", /state\.alarm\s*=\s*null/.test(erfolg));
pruefe("Erfolgsstrecke raeumt bridge-alarm.json", /bridge-alarm\.json/.test(erfolg));
pruefe("Aufhebung nur fuer Alarme mit quelle 'sicherung'",
  erfolg.includes('state.alarm.quelle === "sicherung"'));
pruefe("Sicherungsalarme werden mit Quelle 'sicherung' gemeldet",
  (bruecke.match(/"sicherung"\);/g) || []).length >= 2);

// alarm() herausloesen und gegen die Faelle des Skeptikers fahren.
const a0 = bruecke.indexOf("async function alarm(");
const a1 = a0 >= 0 ? bruecke.indexOf("\n}\n", a0) : -1;
let state = null, fn = null;
if (a0 >= 0 && a1 > a0) {
  const rumpf = bruecke.slice(a0, a1 + 2).replace("async function alarm(", "return async function alarm(");
  try {
    const fabrik = new Function("state", "log", "mkdir", "writeFile", "path", "DATA_DIR", rumpf);
    state = { alarm: null };
    fn = fabrik(state, () => {}, async () => {}, async () => {}, { join: (...x) => x.join("/") }, "d");
  } catch { fn = null; }
}
pruefe("alarm() laesst sich isoliert ausfuehren", typeof fn === "function");
if (typeof fn === "function") {
  await fn("Zweite RFA-Verbindung", "x");
  await fn("Sicherung ausgefallen (hourly)", "HTTP 502", "sicherung");
  pruefe("Sicherungsalarm verdraengt 'Zweite RFA-Verbindung' NICHT",
    !!state.alarm && state.alarm.titel === "Zweite RFA-Verbindung");
  pruefe("Ausfall wird trotzdem gezaehlt", (state.sicherungAusfaelle || []).length === 1);
  state.alarm = null;
  await fn("Sicherung ausgefallen (hourly)", "HTTP 502", "sicherung");
  pruefe("ohne anderen Alarm steht der Sicherungsalarm",
    !!state.alarm && state.alarm.quelle === "sicherung");
  pruefe("zwei Ausfaelle in 24 h gezaehlt", (state.sicherungAusfaelle || []).length === 2);
}

// Jede in der Bruecke benutzte fs-Funktion muss importiert sein - ein
// fehlender Import im try/catch waere wieder ein stiller toter Aufruf.
const imp = (bruecke.match(/import \{([^}]*)\} from "node:fs\/promises"/) || [])[1] || "";
const importiert = new Set(imp.split(",").map((s) => s.trim()).filter(Boolean));
for (const f of ["unlink", "rm", "writeFile", "readFile"]) {
  if (new RegExp("await " + f + "\\(").test(bruecke)) {
    pruefe("fs-Funktion " + f + " ist importiert", importiert.has(f));
  }
}

const checkin = fs.readFileSync(path.join(ROOT, "tools", "checkin.js"), "utf8");
pruefe("checkin.js nennt die blade.json-chance 'Chance ab' (Untergrenze)",
  checkin.includes('(Chance ab '));
pruefe("checkin.js holt die Black-Op-Chance aus boChancen[naechsteBlackOp]",
  checkin.includes("bladeGut.boChancen[bo]"));
pruefe("checkin.js meldet Sicherungsausfaelle 24 h", checkin.includes("sicherungAusfaelle"));

console.log("\n=== " + gruen + " gruen, " + rot + " rot ===\n");
process.exit(rot ? 1 : 0);
