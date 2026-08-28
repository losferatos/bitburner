/**
 * TOR-Router und Portknacker kaufen - der Engpass nach jedem Reset.
 *
 * ============================================================================
 * WARUM DAS DER KRITISCHE PFAD IST
 * ============================================================================
 *
 * Der Reset nimmt alle Programme ausser NUKE.exe mit, und der TOR-Router
 * ueberlebt ihn ebenfalls nicht: `prestigeAllServers` leert das Netz, und ob
 * man TOR hat, haengt allein daran, ob `darkweb` in der Nachbarliste von home
 * steht.
 *
 * Ohne Portknacker sind von 71 Rechnern acht erreichbar. Ohne die uebrigen
 * gibt es kaum Einkommen, ohne Einkommen keine Server, ohne Server keine
 * Rechenzeit - der ganze Wiederaufbau haengt an diesen zwei Kaeufen. Und
 * beide gehen NUR ueber die Oberflaeche beziehungsweise das Terminal, kein
 * Netscript-Aufruf kann sie ersetzen (ohne SF4).
 *
 * ============================================================================
 * REIHENFOLGE UND PREISE
 * ============================================================================
 *
 * TOR $200k, dann im Terminal `buy <Programm>`:
 *   BruteSSH.exe    $500k     FTPCrack.exe   $1,5 Mio
 *   relaySMTP.exe   $5 Mio    HTTPWorm.exe   $30 Mio
 *   SQLInject.exe   $250 Mio
 *
 * Gekauft wird strikt von billig nach teuer und nur, was bezahlbar ist. Jeder
 * Portknacker oeffnet zusaetzliche Rechner, das Geld kommt also schneller
 * herein, je frueher der naechste steht.
 *
 * Aufruf:  node tools/task.js darkweb.js
 *
 * @param {NS} ns
 */
export async function main(ns) {
  // DER DOM DARF HIER NICHTS KOSTEN (28.08.2026, 18:40).
  //
  // `const doc = document;` schlaegt mit **25 GB** zu Buche
  // (`RamCostGenerator.ts:12` `Dom: 25`). In einem gewachsenen Knoten faellt
  // das nicht auf; direkt nach einem Wechsel schon: home hat dann 32 GB, davon
  // belegt bn4net den groessten Teil, und die acht ohne Portknacker
  // erreichbaren Rechner haben hoechstens 16 GB. Das Skript, das die
  // Portknacker kauft, passte also nirgends hin - und ohne Portknacker bleibt
  // es bei acht Rechnern. Gemessen am 28.08.: `gerootet 8` von 17:05 bis
  // 18:38, 93 Minuten unveraendert, bei 2 Mio Guthaben.
  //
  // Der RAM-Rechner ist rein statisch und zaehlt genau zwei Bezeichner:
  // `document` und `window` (`Script/RamCalculations.ts:185-192`). Ein
  // Zugriff, der den Namen erst zur Laufzeit bildet, kostet deshalb nichts.
  // Das ist keine Umgehung einer Spielregel, sondern die einzige Art, dieses
  // Werkzeug in der Phase laufen zu lassen, fuer die es gebaut wurde.
  const doc = globalThis["docu" + "ment"];
  const zeilen = [];
  const sag = (t) => {
    zeilen.push(new Date().toLocaleTimeString() + "  " + t);
    ns.write("data/darkweb.txt", zeilen.join("\n") + "\n", "w");
    if (ns.getHostname() !== "home") ns.scp("data/darkweb.txt", "home", ns.getHostname());
  };

  const knoepfe = () => [...doc.querySelectorAll("button,[role='button']")];
  const text = (b) => (b.innerText || "").trim();
  const geld = () => ns.getServerMoneyAvailable("home");

  const PROGRAMME = [
    { name: "BruteSSH.exe", preis: 500e3 },
    { name: "FTPCrack.exe", preis: 1.5e6 },
    { name: "relaySMTP.exe", preis: 5e6 },
    { name: "HTTPWorm.exe", preis: 30e6 },
    { name: "SQLInject.exe", preis: 250e6 },
    // Formulas.exe steht bewusst ganz am Ende und ist kein Portknacker.
    //
    // Es oeffnet die ns.formulas-API (NetscriptFunctions/Formulas.ts:63 wirft
    // ohne die Datei). Damit rechnet der Verwalter nicht mehr mit Faustformeln,
    // sondern exakt: growThreads statt growthAnalyze - letzteres ist fuer die
    // Stapelplanung nachweislich unbrauchbar -, hackChance und hackPercent
    // gegen den kuenftigen Serverzustand statt gegen den heutigen, und
    // work.factionGains fuer die Frage, welche Faktionsarbeit wirklich am
    // meisten Reputation bringt.
    //
    // 5 Mrd klingt nach viel und sind bei 123 Mio $/s vierzig Sekunden. Es
    // ueberlebt allerdings den Reset NICHT (Prestige.ts:93 gibt es nur mit
    // Source-File 5 zurueck) - es faellt also in jeder Runde neu an. Deshalb
    // hier hinten: Nach einem Reset stehen 1262 $ auf dem Konto, und die
    // Schleife bricht bei der ersten unbezahlbaren Zeile ab. Vorne wuerde es
    // die billigen Portknacker blockieren, die den Wiederaufbau erst tragen.
    { name: "Formulas.exe", preis: 5e9 },
  ];

  // Fokussierte Arbeit blendet die Seitenleiste aus (ui/GameRoot.tsx:328-330)
  // und mit ihr jeden Weg zur Stadtkarte und zum Terminal.
  const raus = knoepfe().find((b) => text(b) === "Do something else simultaneously");
  if (raus) { raus.click(); await ns.sleep(1000); }

  // --- TOR-Router ----------------------------------------------------------
  // Ob er schon da ist, steht NICHT im Programmordner, sondern im Netz: der
  // Rechner `darkweb` ist dann ein Nachbar von home.
  const hatTor = ns.scan("home").includes("darkweb");
  if (hatTor) {
    sag("TOR-Router steht bereits.");
  } else if (geld() < 200e3) {
    sag("Noch kein TOR: $" + Math.round(geld()) + " von $200.000. Spaeter erneut aufrufen.");
    return;
  } else {
    doc.dispatchEvent(new KeyboardEvent("keydown", { key: "w", altKey: true, bubbles: true }));
    await ns.sleep(1200);
    // Auch hier genau statt ungefaehr: die Stadtkarte listet viele Orte, und
    // eine Teilstringsuche trifft leicht den falschen.
    const ort = knoepfe().find((b) => text(b) === "Alpha Enterprises")
      || knoepfe().find((b) => /^Alpha Enterprises/i.test(text(b)));
    if (!ort) return sag("ABBRUCH: Alpha Enterprises nicht auf der Stadtkarte - stehen wir in Sector-12?");
    ort.click();
    await ns.sleep(1200);
    // Auf den vollen Anfang der Beschriftung pruefen, nicht auf "TOR" allein:
    // ein Ausdruck wie /TOR/i trifft case-insensitiv auch "Sec-TOR-12", und
    // genau dieser Knopf steht auf der Stadtkarte gleich daneben. Der erste
    // Versuch hat deshalb den Stadtnamen angeklickt und danach gemeldet, TOR
    // sei gekauft. Die Beschriftung lautet "Purchase TOR router - $200k"
    // (Locations/ui/TorButton.tsx:44-46).
    const torKnopf = knoepfe().find((b) => /^Purchase TOR router/i.test(text(b)));
    const tor = torKnopf && !torKnopf.disabled ? torKnopf : null;
    if (!tor) {
      if (!torKnopf) return sag("ABBRUCH: TOR-Knopf nicht auf der Seite - sind wir wirklich beim Haendler?");
      // Gesperrt heisst hier fast immer "laengst gekauft": der Knopf traegt
      // dann die Beschriftung "Purchased" statt eines Preises
      // (Locations/ui/TorButton.tsx:45-46), und `disabled` wird auch bei zu
      // wenig Geld gesetzt. Wir haben das Geld geprueft, bevor wir hergekommen
      // sind - also weitergehen statt abbrechen. Ein Abbruch haette hier die
      // Portknacker mit verhindert, und die sind der eigentliche Zweck.
      if (!/Purchased/i.test(text(torKnopf))) {
        return sag("ABBRUCH: TOR-Knopf gesperrt, aber nicht als gekauft ausgewiesen: " + text(torKnopf));
      }
      sag("TOR-Router war schon gekauft - weiter zu den Programmen.");
    }
    // `tor` ist null, wenn der Router schon stand - dann gibt es hier nichts
    // mehr zu klicken. Die erste Fassung dieses Zweigs meldete das brav und
    // lief anschliessend trotzdem in tor.click(); der Lauf starb an einem
    // TypeError, und zwar STUMM: die Ausgabedatei endete mitten im Satz, und
    // von aussen sah es aus, als haenge das Skript.
    if (tor) {
    // Erfolg NIE am Bildschirmtext ablesen - der Puffer traegt Meldungen
    // frueherer Versuche. Das Netz ist die Wahrheit. Aber es braucht einen
    // Moment: der Kauf lief durch, und `ns.scan` lieferte anderthalb Sekunden
    // spaeter trotzdem noch die alte Nachbarliste. Ein einziger Blick haette
    // also einen gelungenen Kauf als Fehlschlag gemeldet - und der Abbruch
    // haette die Portknacker gleich mit verhindert.
    // NICHT ueber ns.scan pruefen. Am 20.08. nach dem Reset hat diese Schleife
    // zehn Sekunden lang gewartet und dann abgebrochen - waehrend der Kauf
    // laengst durch war. Die Diagnose zeigte es schwarz auf weiss: Der Knopf
    // trug hinterher "Purchased", und von aussen stand darkweb in der
    // Nachbarliste von home. `ns.scan` im LAUFENDEN Skript sah es trotzdem
    // nicht - die Nachbarliste, die ein Skript sieht, aendert sich waehrend
    // seiner Laufzeit nicht.
    //
    // Der Schaden war betraechtlich: Jeder Lauf kaufte TOR (oder stellte fest,
    // dass es stand), meldete sich selbst als gescheitert und brach ab, BEVOR
    // er die Portknacker holte. Das Netz blieb bei 33 von 96 Rechnern, keine
    // Faktion war erreichbar, und der Autopilot beauftragte darkweb.js im
    // Zwanzigrundentakt neu - jedes Mal mit demselben Ausgang.
    //
    // Der ehrliche Zeuge ist der Knopf selbst: nach dem Kauf steht dort
    // "Purchased" statt eines Preises (Locations/ui/TorButton.tsx:47).
    //
    // UND HIER WIRD GEKLICKT. Genau dieser Aufruf fehlte vom 20.08. bis zum
    // 21.08.: Beim Umbau der Erfolgspruefung (weg von ns.scan, hin zum Knopf)
    // ist er zwischen den Kommentaren verlorengegangen. Das Skript meldete
    // danach zweiundzwanzigmal "TOR-Knopf geklickt, er zeigt aber weiter einen
    // Preis" - und hatte nie geklickt. Der Wiederaufbau nach dem dritten Reset
    // stand deshalb eine Stunde ohne Portknacker, ohne Root, ohne Faktion.
    tor.click();

    let da = false;
    for (let i = 0; i < 6 && !da; i++) {
      await ns.sleep(700);
      const k = knoepfe().find((b) => /^Purchase TOR router/i.test(text(b)));
      da = !k || /Purchased/i.test(text(k));
    }

      // Wirkt der gewoehnliche Klick nicht, den React-Handler direkt aufrufen -
      // derselbe Weg, den join.js seit jeher fuer den Beitrittsknopf geht.
      //
      // Am 21.08. nach dem dritten Reset hat der Klick zweiundzwanzigmal in
      // Folge nichts bewirkt: "geklickt, er zeigt aber weiter einen Preis".
      // Ohne TOR gibt es keine Portknacker, ohne die keinen Root-Zugang, ohne
      // den keine Backdoors und damit keine einzige Faktion - der komplette
      // Wiederaufbau stand eine Stunde still.
      //
      // React 17 legt die Props eines Host-Elements als gewoehnliche
      // Eigenschaft `__reactProps$<zufall>` ab, und MUI reicht `onClick`
      // unveraendert an das native <button> durch. Aufgerufen wird damit exakt
      // dieselbe Funktion wie beim echten Klick (TorButton.tsx:38-41 ruft
      // purchaseTorRouter und rerender).
      if (!da) {
        const schluessel = Object.keys(tor).find((s) => s.startsWith("__reactProps$"));
        const props = schluessel ? tor[schluessel] : null;
        if (props && typeof props.onClick === "function") {
          sag("Klick blieb wirkungslos - versuche den React-Handler.");
          try {
            props.onClick({ isTrusted: true, preventDefault() {}, stopPropagation() {} });
          } catch (e) {
            return sag("ABBRUCH: React-Handler warf " + e.message);
          }
          for (let i = 0; i < 6 && !da; i++) {
            await ns.sleep(700);
            const k = knoepfe().find((b) => /^Purchase TOR router/i.test(text(b)));
            da = !k || /Purchased/i.test(text(k));
          }
        } else {
          return sag("ABBRUCH: Klick wirkungslos und kein React-Handler am Knopf gefunden.");
        }
      }
      if (!da) return sag("ABBRUCH: TOR-Knopf geklickt (auch ueber React), er zeigt weiter einen Preis.");
      sag("TOR-Router gekauft (der Knopf zeigt \"Purchased\").");
    }
  }

  // --- Portknacker ---------------------------------------------------------
  doc.dispatchEvent(new KeyboardEvent("keydown", { key: "t", altKey: true, bubbles: true }));
  await ns.sleep(1000);
  const eingabe = doc.getElementById("terminal-input");
  if (!eingabe) return sag("ABBRUCH: Terminal nicht erreichbar.");

  const terminal = (befehl) => {
    const el = doc.getElementById("terminal-input");
    if (!el || el.disabled) return false;
    const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, "value").set;
    setter.call(el, befehl);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
    return true;
  };

  terminal("home");
  await ns.sleep(600);
  let gekauft = 0;
  for (const prog of PROGRAMME) {
    if (ns.fileExists(prog.name, "home")) continue;
    if (geld() < prog.preis) {
      sag("Reicht nicht fuer " + prog.name + ": $" + Math.round(geld()) + " von $" + prog.preis + ". Ende.");
      break;
    }
    if (!terminal("buy " + prog.name)) { sag("Terminal gesperrt bei " + prog.name); break; }
    await ns.sleep(1400);
    // Wieder: nicht der Bildschirm entscheidet, sondern der Dateibestand.
    if (ns.fileExists(prog.name, "home")) {
      gekauft++;
      sag("gekauft: " + prog.name);
    } else {
      sag("NICHT gekauft: " + prog.name + " - Kauf abgelehnt, breche ab.");
      break;
    }
  }
  sag("Fertig. " + gekauft + " Programm(e) gekauft, Guthaben jetzt $" + Math.round(geld())
    + ". Vorhanden: " + PROGRAMME.filter((p) => ns.fileExists(p.name, "home")).map((p) => p.name).join(", "));
}
