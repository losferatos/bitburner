/**
 * Wiederanlauf nach einem BitNode-Wechsel.
 *
 * WARUM ES DIESE DATEI GIBT
 *
 * `prestigeSourceFile` ruft `prestigeWorkerScripts()` - beim Knotenwechsel
 * stirbt JEDES laufende Skript, auch die beiden Steuerhaelften, die sonst
 * aufeinander aufpassen. Ohne einen Wiederanlauf steht der Bot am Uebergang
 * tot, bis ein Mensch eingreift. Bei einem Ziel von Stufe 3 in allen 15
 * Knoten sind das 45 Uebergaenge, also 45 moegliche Totalausfaelle - und sie
 * treffen genau die unbeaufsichtigten Nachtlaeufe.
 *
 * Der einzige Weg, im neuen Knoten ueberhaupt etwas zu starten, ist der
 * callbackScript-Parameter von `destroyW0r1dD43m0n` beziehungsweise
 * `b1tflum3` (NetscriptFunctions/Singularity.ts:1153-1161). Diese Datei ist
 * dieser Rueckruf. `src/exit.js` uebergibt sie.
 *
 * WAS IM NEUEN KNOTEN ANDERS IST
 *
 * - home ist auf 32 GB und einen Kern zurueckgesetzt
 * - Geld steht bei 1.000 Dollar, Mietrechner und Programme sind weg
 * - die SKRIPTE ueberleben (ServerHelpers.ts:226-239 loescht nur programs
 *   und messages), nur laufen tut nichts
 * - und der Fallstrick: `SF4Cost` gibt den Singularity-Rabatt NUR in
 *   BitNode 4 (RamCostGenerator.ts:82-96). In jedem anderen Knoten kostet
 *   mit SF4.1 jeder Singularity-Aufruf das SECHZEHNFACHE. bn4rep.js ist
 *   damit dort mehrere hundert GB gross und auf 32 GB home nicht startbar.
 *
 * Deshalb startet diese Datei bn4net.js zuerst und allein: Es braucht kein
 * Singularity, baut das Netz und damit den Speicher auf, und holt die
 * uebrigen Werkzeuge selbst nach, sobald Platz ist. bn4life.js kommt dazu,
 * sobald es passt - die beiden beleben sich danach gegenseitig.
 *
 * Diese Datei muss selbst winzig bleiben. Kein Singularity, keine
 * Bibliotheken, keine Schleife ueber das Netz.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");

  const log = [];
  const sag = (t) => {
    log.push(new Date().toLocaleTimeString() + "  " + t);
    ns.write("data/boot.txt", log.join("\n") + "\n", "w");
  };

  sag("Wiederanlauf im neuen BitNode. home hat "
    + ns.getServerMaxRam("home") + " GB.");

  // Eine gewollte Bremse aus dem alten Knoten darf nicht mitwandern - sie
  // wuerde bn4life sofort wieder anhalten.
  if (ns.fileExists("data/bn4-stop.txt", "home")) {
    ns.rm("data/bn4-stop.txt", "home");
    sag("Alte Stoppdatei entfernt.");
  }
  // Dasselbe fuer die Einbausperre und die Beitrittsmarke: beide sind
  // Zustaende des alten Knotens.
  // Namen exakt so, wie die schreibenden Skripte sie verwenden - ein Tippfehler
  // hier raeumt nichts weg und faellt nie auf. data/geldbedarf.txt gehoert
  // dazu: dort steht der Ruecklagenbedarf des alten Knotens, und solange er
  // steht, kauft bn4life.js kein Portprogramm - genau im Fenster, in dem es
  // am noetigsten waere.
  // data/reload.txt gehoert AUSDRUECKLICH dazu (25.08.2026). Dort steht ein
  // Fernbefehl der Form "WERKZEUG <name>", und bn4net beendet das genannte
  // Werkzeug ueberall - auch sich selbst, wenn es sich selbst nennt.
  //
  // Am 25.08. um 05:59 hat genau das den Wiederanlauf verschluckt: boot.js
  // startete bn4net, bn4net las in seiner ersten Runde einen zehn Minuten
  // alten "WERKZEUG bn4net.js"-Befehl, beendete sich selbst und war wieder
  // weg. Aus dem Protokoll sah der Start erfolgreich aus. Ein Fernbefehl aus
  // der Zeit VOR dem Neuanlauf ist immer veraltet.
  for (const datei of ["data/install-sperre.txt", "data/beitritt-erledigt.txt",
                       "data/rep-modus.txt", "data/company-order.txt",
                       "data/geldbedarf.txt", "data/reload.txt"]) {
    if (ns.fileExists(datei, "home")) { ns.rm(datei, "home"); sag("Entfernt: " + datei); }
  }

  // Bis zu zwanzig Minuten lang versuchen. So lange braucht es nie, aber ein
  // stiller Abbruch nach drei Fehlversuchen waere genau der Ausfall, den
  // diese Datei verhindern soll.
  for (let runde = 0; runde < 240; runde++) {
    const frei = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");

    for (const datei of ["bn4net.js", "bn4life.js"]) {
      if (ns.ps("home").some((p) => p.filename === datei)) continue;
      if (!ns.fileExists(datei, "home")) { sag("FEHLT: " + datei); continue; }
      const braucht = ns.getScriptRam(datei, "home");
      // getScriptRam gibt bei nicht uebersetzbarer Datei still 0 zurueck -
      // bekannte Falle in diesem Projekt. Dann lieber warten als blind
      // starten.
      if (!(braucht > 0)) { sag(datei + ": getScriptRam gibt 0, warte."); continue; }
      if (braucht > frei) {
        if (runde % 12 === 0) {
          sag(datei + " braucht " + braucht.toFixed(1) + " GB, frei sind "
            + frei.toFixed(1) + " - warte auf Speicher.");
        }
        continue;
      }
      const pid = ns.exec(datei, "home");
      sag(pid ? datei + " gestartet (pid " + pid + ")."
        : datei + " liess sich nicht starten (exec gab 0).");
    }

    // ABBRUCHBEDINGUNG: bn4net allein genuegt (23.08.2026).
    //
    // Vorher wurde auf BEIDE Steuerhaelften gewartet. Das konnte im neuen
    // Knoten nie eintreten: bn4life.js ist voller Singularity-Aufrufe, und
    // SF4Cost (RamCostGenerator.ts:82-96) gibt den Rabatt nur in BitNode 4 -
    // ausserhalb ist die Datei mehrere hundert GB gross, home aber 32
    // (Prestige.ts:241-247). boot.js haette zwanzig Minuten gewartet und dann
    // "hier muss ein Mensch nachsehen" gemeldet, obwohl der Bot laengst lief.
    // Genau diese Fehlmeldung waere im Nachtlauf als Ausfall gelesen worden.
    //
    // bn4net.js kommt seit demselben Tag ohne Singularity aus (16,25 GB,
    // knotenunabhaengig) und passt immer. Es holt bn4life ueber seine
    // Werkzeugliste nach, sobald eine Werkbank steht.
    if (ns.ps("home").some((p) => p.filename === "bn4net.js")) {
      sag("bn4net.js laeuft. bn4life.js holt es sich selbst, sobald eine"
        + " Werkbank mit genug Speicher steht. Fertig.");
      return;
    }
    await ns.sleep(5000);
  }
  sag("ABBRUCH nach zwanzig Minuten: bn4net.js liess sich nicht starten."
    + " Hier muss ein Mensch nachsehen.");
}
