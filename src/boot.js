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
  for (const datei of ["data/install-lock.txt", "data/beitritt-erledigt.txt",
                       "data/rep-modus.txt", "data/company-order.txt"]) {
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

    const laufen = ns.ps("home").filter((p) =>
      p.filename === "bn4net.js" || p.filename === "bn4life.js").length;
    if (laufen === 2) { sag("Beide Steuerhaelften laufen. Fertig."); return; }
    await ns.sleep(5000);
  }
  sag("ABBRUCH nach zwanzig Minuten - hier muss ein Mensch nachsehen.");
}
