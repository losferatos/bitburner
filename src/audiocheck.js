/**
 * Prueft, ob der Tonanker ueberhaupt klingt.
 *
 * Ein AudioContext startet in modernen Browsern als "suspended", solange im
 * Tab noch nicht geklickt wurde (Autoplay-Richtlinie). Er laeuft dann nicht -
 * und ein Tab ohne Ton bleibt gedrosselt. Genau das ist der Verdacht, nachdem
 * wakelock.js zwar meldete "Tonanker laeuft", die Rundenrate aber bei 1,6 je
 * Minute blieb statt auf 16 zu springen.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const w = globalThis["window"];
  const sag = (t) => {
    ns.write("data/audiocheck.txt", new Date().toLocaleTimeString() + "  " + t + "\n", "w");
    if (ns.getHostname() !== "home") ns.scp("data/audiocheck.txt", "home", ns.getHostname());
  };
  const a = w && w.__wakelock;
  if (!a) return sag("Kein Tonanker vorhanden.");

  let zustand = a.ctx.state;
  // Ein Aufwachversuch kostet nichts. Gelingt er, war die Autoplay-Sperre die
  // Ursache; bleibt es bei "suspended", liegt es nicht am Ton.
  if (zustand !== "running") {
    try {
      await a.ctx.resume();
      await ns.sleep(500);
    } catch (e) { /* erwartbar ohne Nutzerinteraktion */ }
  }
  const d = globalThis["document"];
  sag("AudioContext: " + zustand + " -> " + a.ctx.state
    + " | Verstaerkung " + a.gain.gain.value
    + " | Seite sichtbar: " + (d ? d.visibilityState : "?")
    + " | Fokus: " + (d ? d.hasFocus() : "?"));
}
