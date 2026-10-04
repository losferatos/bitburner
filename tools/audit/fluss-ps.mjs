// FLUSS-PS (Audit 04.10.2026): Welches Nicht-Arbeiter-Skript laeuft in einem Spielstand auf welchem Server?
//
// Frage: Die Wirtepruefung in datenfluss.mjs kennt nur die hostRule der Registry (home/werkbank/any). Welcher
// Server die "werkbank" tatsaechlich ist, steht im Spielstand (AllServersSave -> runningScripts). Ein Werkzeug,
// das auf einem fremden Wirt laeuft und eine Datei OHNE scp nach home schreibt, schreibt ins Leere.
//
// Eichung: die Zahl der Skripte muss zu data/ps.json bzw. zur Liste in der Registry passen; bn4net.js
// (hostRule home) muss auf "home" stehen.
//
// Aufruf: node tools/audit/fluss-ps.mjs [<datei.json.gz>]
import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";
import { neuesterStand } from "./fluss-save.mjs";

const datei = process.argv[2] && process.argv[2].endsWith(".gz") ? process.argv[2] : neuesterStand();
const save = JSON.parse(zlib.gunzipSync(fs.readFileSync(datei)).toString("utf8"));
const servers = JSON.parse(save.data.AllServersSave);
const un = (o) => (o && o.data !== undefined && o.ctor ? o.data : o);
console.log("Spielstand:", path.basename(datei));
const out = {};
for (const [name, s0] of Object.entries(servers)) {
  const s = un(s0);
  for (const r of s.runningScripts || []) {
    const R = un(r);
    const f = R.filename || R.scriptKey;
    if (/^worker\//.test(f)) continue;
    (out[name] ||= []).push(f + (R.args && R.args.length ? " " + JSON.stringify(R.args) : ""));
  }
}
for (const [k, v] of Object.entries(out)) console.log(k + ": " + v.join(" | "));
