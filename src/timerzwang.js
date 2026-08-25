/**
 * Schaltet den Worker-Timer-Ersatz von Hand ein oder aus.
 *
 * Der Patch in hacktimer.js haengt sich normalerweise nur ein, wenn der Tab
 * versteckt ist. Damit er sich pruefen laesst, ohne auf diesen Zustand zu
 * warten, gibt es diesen Schalter.
 *
 * Aufruf:  node tools/task.js timerzwang.js an
 *          node tools/task.js timerzwang.js aus
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const arg = ns.args.map(String)[0] || "";
  const w = globalThis["window"];
  const h = w && w.__hacktimer;
  let ergebnis;
  if (!h) {
    ergebnis = { zeit: Date.now(), fehler: "hacktimer laeuft nicht" };
  } else if (arg === "an") {
    ergebnis = { zeit: Date.now(), befehl: "an", aktiv: h.einhaengen() };
  } else if (arg === "aus") {
    ergebnis = { zeit: Date.now(), befehl: "aus", aktiv: h.aushaengen("Pruefung beendet") };
  } else {
    ergebnis = { zeit: Date.now(), fehler: "Argument fehlt: an oder aus", aktiv: h.istAktiv() };
  }
  ns.write("data/timerzwang.json", JSON.stringify(ergebnis), "w");
  if (ns.getHostname() !== "home") {
    try { ns.scp("data/timerzwang.json", "home", ns.getHostname()); } catch (e) { /* egal */ }
  }
}
