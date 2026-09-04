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
    // Gedeckelt (02.09.2026): die Schleife unten endet nicht mehr von selbst,
    // und ein Protokoll, das alle 5 s komplett neu in den Spielstand
    // geschrieben wird, darf nicht wachsen.
    while (log.length > 200) log.shift();
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
  //   data/portknacker-komplett.txt: die Marke, die darkweb.js ruhen laesst.
  //     Sie MUSS hier stehen und nicht unten bei den knotengebundenen Dateien
  //     (Skeptiker Fehlermodi, 04.09.2026): `prestigeHomeComputer` leert die
  //     Programmliste und legt nur NUKE zurueck
  //     (`Server/ServerHelpers.ts:224-234`), und es wird von BEIDEN Prestiges
  //     gerufen - vom Augmentierungs-Einbau wie vom Knotenwechsel
  //     (`Prestige.ts:55,74` und `:203,225`). Textdateien auf home ueberleben
  //     dagegen alles.
  //
  //     Ohne diese Zeile liefe darkweb.js nach dem ersten Knoten, in dem es
  //     die fuenf Knacker vollmacht, in ALLEN rund vierzig Restlaeufen nie
  //     wieder - und es ist die einzige kaltstartfaehige Knackerquelle
  //     (2,65 GB; bn4life.js braucht ausserhalb BN4 bei SF4.1 293,85 GB, also
  //     eine gekaufte Werkbank, also Geld, also das Netz, das die Knacker erst
  //     aufschliessen). Genau dieser Zirkel hat am 25.08. dreizehneinhalb
  //     Stunden gekostet.
  //   data/blocked-hosts.json: die Wirtsperren des Waechters (Skeptiker
  //     Runde 3, K2). Sie stand in keiner Raeumliste. Nach einem Reset heisst
  //     `werk-0` ein voellig anderer Rechner - der alte ist geloescht
  //     (prestigeAllServers), der neue bekommt denselben Namen beim naechsten
  //     Kauf. Eine Sperre aus dem alten Lauf haette also bis zu eine Stunde
  //     lang (bis zum Verfall) einen unschuldigen Rechner ausgeschlossen,
  //     und zwar den einzigen, den es in der Startlage gibt.
  //   data/preise.json, data/kaufauftrag.json, data/kaufergebnis.json:
  //     der Rechnerpark und die offenen Auftraege. Sie standen bis zum
  //     04.09.2026 unten bei den knotengebundenen Dateien - das war falsch
  //     (Skeptiker Runde 3, K5). `prestigeAugmentation` ruft
  //     `prestigeAllServers()` und setzt `purchasedServers = []`
  //     (Prestige.ts:55-75); nach einem Augmentierungs-Einbau ist der Park
  //     also genauso weg wie nach einem Sprung.
  //
  //     Die Folge des alten Standes: `shop.js` merkt sich ueber den Neustart
  //     nur ERFOLGREICHE Auftraege. Ein auf Geld wartender Auftrag ueberlebte
  //     den Einbau und wurde danach ausgefuehrt - mit dem Geld der neuen
  //     Startlage, fuer einen Rechner, den der Kern in der neuen Lage
  //     vielleicht gar nicht mehr so bestellt haette. Und die Preistabelle
  //     beschrieb einen Park, den es nicht mehr gab.
  for (const datei of ["data/install-sperre.txt", "data/beitritt-erledigt.txt",
                       "data/rep-modus.txt", "data/company-order.txt",
                       "data/geldbedarf.txt", "data/reload.txt", "data/hilfe.txt",
                       "data/portknacker-komplett.txt",
                       "data/preise.json", "data/kaufauftrag.json",
                       "data/kaufergebnis.json",
                       "data/blocked-hosts.json"]) {
    if (ns.fileExists(datei, "home")) { ns.rm(datei, "home"); sag("Entfernt: " + datei); }
  }
  // KNOTENGEBUNDENE DATEIEN NUR NACH EINEM KNOTENWECHSEL (02.09.2026).
  //
  // boot.js ist auch der Rueckruf von installAugmentations (bn4rep.js). Ein
  // Auftrag in data/task.txt aus der Minute vor einem Einbau ist danach noch
  // gueltig - nach einem Knotenwechsel nicht (derselbe Mechanismus wie
  // reload.txt oben). Deshalb hier die Unterscheidung ueber lastNodeReset.
  //   data/exit-ziel.txt: hat keinen Schreiber mehr, das Ziel rechnet
  //     ausgang.js aus route.json.
  //   data/simulacrum.txt: Augmentierungen sind beim Wechsel weg, der Marker
  //     wuerde blade.js den Graft-Riegel loesen lassen.
  //   data/exit.txt: Protokoll des alten Sprungs, sonst liest ausgang.js
  //     eine fremde "letzte Zeile".
  // data/verfahren.txt wird ABSICHTLICH nicht geloescht: alle Leser
  // (bn4net, bn4rep, sleeve, ausgang) pruefen den Knoten in der Datei, und
  // ausgang.js ueberschreibt sie in seiner ersten Runde. Eine Loeschung
  // hier haette nach jedem Einbau in einem Hackingknoten blade.js und
  // bbtrain.js in derselben synchronen bn4net-Runde gestartet, in der
  // ausgang.js die Datei noch nicht geschrieben hatte (Skeptiker 02.09.).
  let nachKnotenwechsel = true;
  try { nachKnotenwechsel = Date.now() - ns.getResetInfo().lastNodeReset < 300000; }
  catch { /* kein Zugriff - im Zweifel wie nach einem Wechsel raeumen */ }
  if (nachKnotenwechsel) {
    // Die drei Kaufdateien standen hier bis zum 04.09.2026. Sie sind nach
    // OBEN gewandert, in die unbedingte Liste - die Begruendung steht dort
    // (K5): beide Prestiges loeschen den Park, nicht nur der Sprung.
    for (const datei of ["data/task.txt", "data/exit-ziel.txt",
                         "data/simulacrum.txt", "data/exit.txt",
                         "data/keine-hacknet.txt", "data/keine-sleeves.txt"]) {
      if (ns.fileExists(datei, "home")) { ns.rm(datei, "home"); sag("Entfernt (Knotenwechsel): " + datei); }
    }
  }

  // Bis zu zwanzig Minuten lang versuchen. So lange braucht es nie, aber ein
  // stiller Abbruch nach drei Fehlversuchen waere genau der Ausfall, den
  // diese Datei verhindern soll.
  // NIE AUFGEBEN (02.09.2026). Hier stand `runde < 240` und danach "Hier muss
  // ein Mensch nachsehen". Der Fall, in dem bn4net zwanzig Minuten nicht
  // startet, ist genau der, in dem der Rueckruf gebraucht wird - ein
  // liegengebliebenes Skript belegt home. Deshalb: nach fuenf Minuten alles
  // auf home beenden ausser dieser Datei, und weiter versuchen, solange das
  // Spiel laeuft.
  for (let runde = 0; ; runde++) {
    if (runde > 0 && runde % 60 === 0) {
      // DIE SCHONLISTE (Position C.6, 04.09.2026).
      //
      // Hier stand nur "ausser boot.js selbst". Das beendete auch den
      // Waechter - also genau die Instanz, die einen nicht startenden Kern
      // ueberhaupt bemerken und melden wuerde. Ein Aufraeumen, das seine
      // eigene Aufsicht wegraeumt, macht den Fall unsichtbar, fuer den es
      // gebaut ist.
      //
      // Die Namen stehen NICHT als Literal hier, sondern kommen aus
      // registry.json: `killSafe: false` heisst "nicht beenden". Ein
      // zweiter Ort fuer dieselbe Liste liefe unweigerlich auseinander.
      // Faellt die Registry aus, greift die eingebaute Notliste - lieber ein
      // Prozess zu viel als der Waechter zu wenig.
      const NOTLISTE = ["boot.js", "guard.js", "ausgang.js"];
      let schonliste = NOTLISTE;
      try {
        const roh = ns.fileExists("registry.json", "home") ? ns.read("registry.json") : null;
        const reg = roh ? JSON.parse(roh) : null;
        if (reg && Array.isArray(reg.eintraege)) {
          const ausReg = reg.eintraege
            .filter((e) => e.killSafe === false)
            .map((e) => e.name);
          // Die Notliste bleibt immer dabei: boot.js darf sich nie selbst
          // beenden, und der Waechter ist der Grund fuer diese Aenderung.
          schonliste = [...new Set([...NOTLISTE, ...ausReg])];
        }
      } catch { /* Registry unlesbar - die Notliste traegt */ }

      let beendet = 0;
      for (const p of ns.ps("home")) {
        if (schonliste.includes(p.filename)) continue;
        ns.kill(p.pid); beendet++;
      }
      sag("Nach fuenf Minuten ohne bn4net: " + beendet + " Prozess(e) auf home beendet."
        + " Geschont: " + schonliste.join(", ") + ".");
    }
    const frei = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");

    // DER WAECHTER ZUERST (04.09.2026).
    //
    // Er steht vor dem Kern, weil genau der Fall, den nur er bemerken kann,
    // hier passiert: bn4net startet nicht. Laeuft der Waechter erst, wenn der
    // Kern ihn startet, ist er im einzigen Fall abwesend, fuer den er gebaut
    // wurde.
    //
    // Danach uebernimmt der Kern: guard.js steht in seiner Werkzeugliste und
    // wird von dort neu gestartet, wenn es ausfaellt. Hier wird es nur
    // angeworfen, nicht ueberwacht - boot.js beendet sich, sobald der Kern
    // laeuft.
    // DER MODUS BRAUCHT EINEN SCHREIBER (Skeptiker Runde 3, W10, 04.09.2026).
    //
    // `guard.js` liest `data/guard-modus.txt` je Runde und faellt ohne die
    // Datei auf "observe" zurueck. Geschrieben hat sie niemand. Damit hat die
    // ganze C.9/C.10-Maschinerie im ausgelieferten Zustand nur protokolliert -
    // kein Neustart, keine Wirtsperre, kein Ausweichzweig. Der Commit-Betreff
    // "die Strafleiter ist scharf" stimmte fuer das, was lief, nicht.
    //
    // Scharf ist die Vorgabe, denn der Auftrag verlangt maximale Autonomie und
    // eine Leiter, die nur zusieht, ist keine. Die HANDBREMSE bleibt:
    // `data/guard-observe.txt` haelt sie im Beobachtungsmodus - eine Datei,
    // die ein Mensch anlegt und die kein Skript je schreibt. Sie ueberlebt
    // Resets absichtlich (Textdateien auf home ueberleben beide Prestiges),
    // damit ein gezogener Riegel gezogen bleibt.
    //
    // Nicht ueberschrieben wird der Modus, wenn schon "enforce" drinsteht -
    // sonst schriebe boot.js in jeder seiner Runden dieselbe Datei neu.
    {
      const gewollt = ns.fileExists("data/guard-observe.txt", "home") ? "observe" : "enforce";
      const jetzt = ns.fileExists("data/guard-modus.txt", "home")
        ? ns.read("data/guard-modus.txt").trim() : "";
      if (jetzt !== gewollt) {
        ns.write("data/guard-modus.txt", gewollt, "w");
        sag("Waechtermodus gesetzt: " + gewollt
          + (gewollt === "observe" ? " (data/guard-observe.txt liegt)" : ""));
      }
    }

    if (!ns.ps("home").some((p) => p.filename === "guard.js")
        && ns.fileExists("guard.js", "home")) {
      const brauchtW = ns.getScriptRam("guard.js", "home");
      if (brauchtW > 0 && brauchtW <= ns.getServerMaxRam("home") - ns.getServerUsedRam("home")) {
        const pidW = ns.exec("guard.js", "home");
        if (pidW) sag("guard.js gestartet (pid " + pidW + ").");
      }
    }

    for (const datei of ["bn4net.js", "bn4life.js"]) {
      if (ns.ps("home").some((p) => p.filename === datei)) continue;
      if (!ns.fileExists(datei, "home")) { sag("FEHLT: " + datei); continue; }
      const braucht = ns.getScriptRam(datei, "home");
      // getScriptRam gibt bei nicht uebersetzbarer Datei still 0 zurueck -
      // bekannte Falle in diesem Projekt. Dann lieber warten als blind
      // starten.
      if (!(braucht > 0)) { if (runde % 12 === 0) sag(datei + ": getScriptRam gibt 0, warte."); continue; }
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
}
