/**
 * Gemeinsamer Ablauf der Einmal-Skripte corp-act-*.js und corp-tick.js.
 *
 * Auftrag kommt als JSON in ns.args[0]: {job, ops: [[code, ...args], ...]}.
 * Jede Op laeuft in try/catch; ein Fehler stoppt die uebrigen NICHT (der
 * Koordinator plant jeden Zyklus aus dem echten Zustand neu, Fehler heilen
 * sich so selbst). Ergebnis geht als JSON auf RESULT_PORT (writePort 0 GB,
 * Ports sind netzweit - das Skript darf auf jedem Wirt laufen).
 *
 * KEIN Corp-Funktionsname in dieser Datei (RAM, siehe corplib.js).
 */
import { RESULT_PORT } from "lib/corplib.js";

/**
 * @param {NS} ns
 * @param {Record<string, Function>} table Kurzcode -> Funktion
 */
export function runAct(ns, table) {
  let job = "?";
  const out = { job, ok: 0, err: [], ret: [] };
  try {
    const order = JSON.parse(String(ns.args[0] || "{}"));
    job = order.job;
    out.job = job;
    for (const op of order.ops || []) {
      const fn = table[op[0]];
      if (!fn) {
        out.ret.push({ error: "unbekannter Code" });
        out.err.push(op[0] + ": unbekannter Code");
        continue;
      }
      try {
        const r = fn(...op.slice(1));
        out.ret.push(r === undefined ? null : r);
        out.ok++;
      } catch (e) {
        out.ret.push({ error: String(e && e.message ? e.message : e).slice(0, 160) });
        out.err.push(op.join("/") + ": " + String(e && e.message ? e.message : e).slice(0, 160));
      }
    }
  } catch (e) {
    out.err.push("Auftrag: " + String(e).slice(0, 160));
  }
  sendResult(ns, out);
}

/** Ergebnis auf den Port; bei vollem Port (50 Eintraege) das Aelteste verwerfen */
export function sendResult(ns, out) {
  ns.writePort(RESULT_PORT, JSON.stringify(out));
}
