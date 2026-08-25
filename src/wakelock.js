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
 * DER PEGEL WAR ZWEIMAL ZU LEISE (nachgerechnet 25.08.2026)
 *
 * Chromium entscheidet die Hoerbarkeit nicht am Zustand des AudioContext,
 * sondern misst die LEISTUNG des tatsaechlich gerenderten Stroms gegen
 * kSilenceThresholdDBFS = -72,247 dBFS (services/audio/output_stream.cc).
 * Fuer einen Sinus ist die Leistung 20*log10(a) - 3 dB, also 3 dB unter der
 * Amplitude - genau diese drei Dezibel wurden bisher uebersehen:
 *
 *   0,00002  ->  -97,0 dBFS  weit unter der Schwelle, wirkungslos (Versuch 1)
 *   0,0005   ->  -69,0 dBFS  nur 3,2 dB Reserve - ein Grenzfall (Versuch 2)
 *   0,005    ->  -49,0 dBFS  23 dB Reserve
 *   0,01     ->  -43,0 dBFS  29 dB Reserve   <- jetzt eingestellt
 *
 * Das erklaert zwanglos, warum der Kniff am 21.08. wirkte und am 25.08. nicht:
 * Bei 3,2 dB Reserve kippt das Urteil mit dem Ausgabegeraet, dem Mixerpfad
 * oder einer kurzen suspended-Phase zwischen zwei Kontrollen.
 *
 * Unhoerbar bleibt der Ton durch die TONHOEHE, nicht durch den Pegel - 19,5
 * kHz liegt oberhalb dessen, was Erwachsene ueblicherweise hoeren. Bei -43
 * dBFS koennen Haustiere und sehr junge Ohren ihn allerdings wahrnehmen; wer
 * das vermeiden will, geht auf 0,005 zurueck und behaelt 23 dB Reserve.
 *
 * Mitgeloggt wird jetzt ctx.sampleRate: 19,5 kHz verlangt eine Ausgaberate von
 * mindestens 44,1 kHz. Laeuft der Kontext nach einem Geraetewechsel auf einem
 * 16-kHz-Headsetprofil, liegt der Ton ueber Nyquist und es kommt gar nichts
 * an - ohne dass am Zustand etwas auffiele.
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
    gain.gain.value = 0.01;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    w.__wakelock = { ctx, osc, gain };
    sag("Tonanker laeuft: " + osc.frequency.value + " Hz bei Verstaerkung "
      + gain.gain.value + ", Ausgaberate " + ctx.sampleRate + " Hz."
      + " Ob der Tab dadurch als hoerbar gilt, zeigt erst die Rundenrate oder"
      + " das Lautsprechersymbol am Tab - diese Meldung ist kein Beleg dafuer.");
  } catch (e) {
    return sag("Tonanker fehlgeschlagen: " + e.message
      + "  (Browser verlangen dafuer meist eine vorherige Nutzerinteraktion im Tab.)");
  }

  // WACHEN, NICHT NUR ANWERFEN (25.08.2026).
  //
  // Bis hierher lief die Schleife nur mit, ohne je nachzusehen. Das war der
  // teuerste blinde Fleck des Tages: Am 25.08. stand der Tonanker als
  // "laeuft" in der Prozessliste, waehrend der Tab fuenffach gedrosselt lief -
  // 1 Motorrunde je Minute statt 4 bis 6, ueber Stunden, auf alles.
  //
  // Ein AudioContext kann jederzeit still in den Zustand "suspended" fallen:
  // nach einem Reload (Browser verlangen fuer Tonausgabe eine vorherige
  // Nutzerinteraktion), bei einem Wechsel des Audiogeraets, nach dem
  // Aufwachen aus dem Ruhezustand. Das Skript merkte davon nichts, weil es
  // seinen eigenen Zustand nie las.
  //
  // Jetzt: jede Minute nachsehen, resume() versuchen, und den Zustand nach
  // draussen schreiben. resume() gelingt ohne Nutzerinteraktion oft nicht -
  // aber dann steht wenigstens in der Datei, woran es liegt, statt dass die
  // Drosselung nur an der Rundenrate zu erahnen waere.
  let letzterZustand = "";
  for (;;) {
    let zustand = "unbekannt";
    try {
      const anker = w.__wakelock;
      if (!anker || !anker.ctx) {
        zustand = "weg";
      } else {
        zustand = anker.ctx.state;
        if (zustand === "suspended") {
          // Der Rueckgabewert ist ein Promise; wir warten nicht darauf,
          // sondern lesen den Zustand in der naechsten Runde erneut.
          try { anker.ctx.resume(); } catch (e) { /* Browser verweigert */ }
        }
      }
    } catch (e) {
      zustand = "fehler:" + e.message;
    }

    let rate = "?";
    try { rate = w.__wakelock?.ctx?.sampleRate ?? "?"; } catch (e) { /* egal */ }
    ns.write("data/wakelock.txt", Date.now() + "|" + zustand + "|" + rate, "w");
    if (ns.getHostname() !== "home") {
      try { ns.scp("data/wakelock.txt", "home", ns.getHostname()); } catch (e) { /* egal */ }
    }
    if (zustand !== letzterZustand) {
      sag("Tonanker jetzt: " + zustand
        + (zustand === "running" ? "" : " - der Tab wird gedrosselt, bis das"
          + " wieder 'running' ist. Ein Klick ins Spielfenster hilft."));
      letzterZustand = zustand;
    }
    await ns.sleep(60000);
  }
}
