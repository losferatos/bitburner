/**
 * Haelt den Bitburner-Tab wach.
 *
 * DAS PROBLEM
 *
 * Browser drosseln die Timer verborgener Tabs. In der Nacht zum 21.08.2026
 * gemessen, nachdem der Bildschirm aus war: **eine Spielrunde pro Minute statt
 * sechzehn**. Die Engine selbst faengt das grossenteils ab - sie rechnet die
 * verstrichene Zeit nach (engine.tsx:421-424 teilt die echte Zeitdifferenz
 * durch MilliPerCycle und ruft updateGame mit der Zyklenzahl), weshalb
 * Reputation und Einkommen weiterlaufen, wenn auch gedaempft.
 *
 * Netscript-Skripte holen nichts nach. Ihr `ns.sleep()` haengt am selben
 * gedrosselten Timer, und damit kriecht jedes Oberflaechenskript. Ein
 * Kauflauf, der wach fuenf Minuten braucht, braucht schlafend ueber eine
 * Stunde - gemessen in derselben Nacht, samt der falschen Diagnose "der
 * Kauflauf haengt".
 *
 * DIE LOESUNG
 *
 * Ein Tab, der Ton ausgibt, gilt als "audible" und wird von der Drosselung
 * ausgenommen. Der alte Nachtdienst (nightshift/agent.js:632-642) hat das
 * bereits so geloest; diese Datei holt den Kniff zurueck, nachdem er mit ihm
 * stillgelegt wurde.
 *
 * ZUR LAUTSTAERKE
 *
 * 19.500 Hz liegt oberhalb dessen, was Erwachsene ueblicherweise hoeren - die
 * Hoerschwelle faellt bei den meisten schon ab 17 kHz weg. Die Tonhoehe ist
 * deshalb der eigentliche Schutz, nicht der Pegel.
 *
 * Der erste Versuch nahm 0,00002 (rund -94 dB) und blieb wirkungslos: Der
 * AudioContext lief nachweislich ("running"), die Drosselung aber auch. Der
 * Verdacht faellt auf die Amplitude - Browser stufen einen Tab erst ab einem
 * messbaren Pegel als "audible" ein, und der alte Nachtdienst notierte genau
 * das ("nicht exakt 0 - das zaehlt teilweise als still"). Jetzt 0,0005, also
 * rund -66 dB und fuenfmal lauter als der alte Nachtdienst, aber bei einer
 * Tonhoehe, die er nicht hatte: Er nahm 440 Hz, mitten im Hoerbereich.
 *
 * Aufruf:  node tools/task.js wakelock.js          starten
 *          node tools/task.js wakelock.js --stop   Ton beenden
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const stop = ns.args.map(String).includes("--stop");
  const sag = (t) => {
    ns.write("data/wakelock.txt", new Date().toLocaleTimeString() + "  " + t + "\n", "w");
    if (ns.getHostname() !== "home") ns.scp("data/wakelock.txt", "home", ns.getHostname());
  };

  const w = globalThis["window"];
  if (!w) return sag("Kein Fensterobjekt erreichbar - Tonanker nicht moeglich.");

  // Eine alte Instanz immer zuerst abraeumen, auch beim Start: Zwei
  // Oszillatoren waeren doppelt so laut, und "doppelt so leise wie unhoerbar"
  // ist keine Groesse, auf die man sich verlassen sollte.
  const alt = w.__wakelock;
  if (alt) {
    try { alt.osc.stop(); } catch (e) { /* schon gestoppt */ }
    try { alt.ctx.close(); } catch (e) { /* egal */ }
    w.__wakelock = null;
  }
  if (stop) return sag("Tonanker beendet." + (alt ? "" : " (Es lief keiner.)"));

  try {
    const ctx = new (w.AudioContext || w.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 19500;
    gain.gain.value = 0.0005;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    w.__wakelock = { ctx, osc, gain };
    sag("Tonanker laeuft: " + osc.frequency.value + " Hz bei Verstaerkung "
      + gain.gain.value + ". Ob der Tab dadurch als hoerbar gilt, zeigt erst"
      + " die Rundenrate - diese Meldung ist kein Beleg dafuer.");
  } catch (e) {
    return sag("Tonanker fehlgeschlagen: " + e.message
      + "  (Browser verlangen dafuer meist eine vorherige Nutzerinteraktion im Tab.)");
  }

  // Am Leben bleiben. Der AudioContext gehoert dem Fenster und liefe zwar auch
  // ohne dieses Skript weiter - aber ein laufender Prozess ist der einzige
  // Beleg von aussen, dass der Anker steht. Er kostet nichts: ein Faden, der
  // fast immer schlaeft.
  for (;;) await ns.sleep(60000);
}
