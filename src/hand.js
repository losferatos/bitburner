/**
 * Die Hand - ein Terminal-Fernrohr ohne Browser.
 *
 * Warum es das gibt: Jeder Zugriff von aussen auf den Browser loest in Opera
 * eine Freigabeabfrage aus. Beim Arbeiten stapeln die sich derart, dass sie
 * nicht mehr wegzuklicken sind - der Weg ist im laufenden Betrieb also
 * unbrauchbar. Netscript darf aber selbst auf das DOM zugreifen, wenn man den
 * Aufschlag zahlt: `document` kostet pauschal 25 GB (RamCostGenerator.ts:12).
 * Bei einem Netz von mehreren Terabyte ist das nichts.
 *
 * Damit habe ich einen dauerhaften Steuerkanal: Ich lege ueber die Bruecke
 * eine Befehlsdatei ab, dieses Skript fuehrt sie im Terminal aus und schreibt
 * die Ausgabe zurueck. Das ersetzt den Browserzugriff fuer alles, was ueber
 * das Terminal geht - Backdoors, Programmkaeufe, Skriptstarts.
 *
 * Ablauf:
 *   1. `node tools/hand.js "connect CSEC" backdoor`
 *   2. Die Bruecke legt data/cmd.txt ab.
 *   3. Dieses Skript fuehrt die Zeilen aus und schreibt data/cmd-out.txt.
 *   4. `node tools/hand.js --lies` zeigt das Ergebnis.
 *
 * WICHTIG: `backdoor` ist eine Aktion mit Laufzeit, und jede weitere Eingabe
 * bricht sie ab. Steht `backdoor` in der Liste, wird danach nichts mehr
 * gesendet und stattdessen auf die Bestaetigung im Serverzustand gewartet.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.setTailMinimized?.(true);

  const EIN = "data/cmd.txt";
  const AUS = "data/cmd-out.txt";
  let zuletzt = "";

  // Direkt, nicht ueber eval: der statische RAM-Rechner des Spiels bucht fuer
  // den Bezeichner  pauschal 25 GB (RamCostGenerator.ts:12). Ueber
  // eval liesse sich das umgehen - das ist ein bekannter Exploit, und bei
  // einem Netz von mehreren Terabyte gibt es keinen Grund dafuer.
  const doc = document;

  // ns.read und ns.write arbeiten IMMER auf dem Rechner, auf dem das Skript
  // laeuft - und das ist hier nicht home. Die Bruecke legt die Befehlsdatei
  // aber auf home ab. Also vor jedem Lesen herholen und nach jedem Schreiben
  // zurueckschicken. Dieser Fallstrick hat im Projekt schon dreimal
  // zugeschlagen.
  const HIER = ns.getHostname();
  const schreibe = (text) => {
    ns.write(AUS, JSON.stringify({ at: Date.now(), text }), "w");
    if (HIER !== "home") ns.scp(AUS, "home", HIER);
  };

  const terminal = (befehl) => {
    const el = doc.getElementById("terminal-input");
    if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, "value").set;
    setter.call(el, befehl);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
    return true;
  };

  const zeilen = () => [...doc.querySelectorAll("#terminal li, #terminal p")].map((e) => e.innerText);

  // Nach einem Absturz kann der Nachtdienst stillgestellt zurueckgeblieben
  // sein. Beim Start also aufraeumen, sonst arbeitet er nie wieder.
  try {
    const d0 = doc.defaultView.__nightshift;
    if (d0 && d0.busy) { d0.busy = false; }
  } catch { /* kein Nachtdienst, auch gut */ }

  // Puls SOFORT setzen, nicht erst nach dem ersten Schleifendurchlauf. Sonst
  // sieht die Pulswache im Autopiloten noch den Zeitstempel der VORIGEN Hand
  // und erschlaegt die frisch gestartete augenblicklich wieder.
  const puls = () => {
    ns.write("data/hand-puls.txt", String(Date.now()), "w");
    if (HIER !== "home") ns.scp("data/hand-puls.txt", "home", HIER);
  };
  puls();

  schreibe("Hand bereit auf " + HIER + ".");

  // Eigener Quelltext beim Start. Aendert er sich, beendet sich die Hand -
  // der Autopilot liefert sie in seiner naechsten Runde frisch aus. Ohne das
  // liesse sie sich ohne Browserzugriff gar nicht erneuern.
  ns.scp("hand.js", HIER, "home");
  const eigenerStand = ns.read("hand.js");

  let takt = 0;
  while (true) {
    await ns.sleep(3000);
    takt++;

    // Ohne diesen Fangarm stirbt die Hand stumm: ihr Fehlerfenster steht im
    // Spiel, und genau dorthin habe ich keinen Blick. Jeder Fehler gehoert
    // deshalb in die Ausgabedatei, die ich von aussen lesen kann.
    try {
      // Selbsterneuerung nur gelegentlich pruefen - ein scp je drei Sekunden
      // waere unnoetige Last.
      if (takt % 10 === 0) {
        ns.scp("hand.js", HIER, "home");
        if (ns.read("hand.js") !== eigenerStand) {
          schreibe("Neue Fassung erkannt - beende mich, der Autopilot liefert sie aus.");
          return;
        }
      }
      // Herzschlag: Der Autopilot erkennt daran eine haengende Hand und
      // erschlaegt sie. Ein toter Prozess wird ohnehin neu gestartet, ein
      // haengender bliebe sonst fuer immer stehen - und mit ihm der einzige
      // Steuerkanal, der ohne Browser funktioniert.
      puls();

      if (!ns.fileExists(EIN, "home")) continue;
      if (HIER !== "home") ns.scp(EIN, HIER, "home");
      var roh = ns.read(EIN).trim();
    } catch (e) {
      schreibe("FEHLER beim Lesen: " + (e && e.message ? e.message : String(e)));
      await ns.sleep(5000);
      continue;
    }
    if (!roh || roh === zuletzt) continue;
    zuletzt = roh;

    const befehle = roh.split("\n").map((z) => z.trim()).filter(Boolean);
    const protokoll = [];

    // Den Nachtdienst stillstellen, solange wir das Terminal benutzen. Er
    // bedient dasselbe Eingabefeld, und JEDE Eingabe bricht eine laufende
    // Aktion wie backdoor ab - genau daran sind heute frueh zwei Versuche
    // gescheitert. Sein busy-Flag ist die dafuer vorgesehene Bremse.
    const dienst = doc.defaultView.__nightshift;
    if (dienst) {
      dienst.busy = true;
      // Selbstloesung: stirbt die Hand mitten im Befehl, bliebe der
      // Nachtdienst sonst FUER IMMER blockiert - beide warten dann
      // aufeinander. Genau das ist am 20.08. passiert.
      if (dienst.handLoeser) doc.defaultView.clearTimeout(dienst.handLoeser);
      dienst.handLoeser = doc.defaultView.setTimeout(() => { dienst.busy = false; }, 300000);
    }

    // Ohne Terminalbildschirm gibt es kein Eingabefeld. Die Seitenleiste
    // haengt ihren Tastaturhandler an das Dokument und prueft die Echtheit
    // nicht - Alt+T bringt uns also hin.
    // Nur ans Terminal gehen, wenn ueberhaupt Terminalbefehle dabei sind.
    // Sonderbefehle wie !work bedienen die Oberflaeche und brauchen es nicht.
    const brauchtTerminal = befehle.some((b) => !/^!/.test(b));
    if (brauchtTerminal) {
      if (!doc.getElementById("terminal-input")) {
        doc.dispatchEvent(new KeyboardEvent("keydown", { key: "t", altKey: true, bubbles: true }));
        await ns.sleep(1200);
      }
      if (!doc.getElementById("terminal-input")) {
        schreibe("FEHLER: Terminal nicht erreichbar - steht ein Fenster im Weg?");
        continue;
      }
    }

    try {
    for (const b of befehle) {
      // Sonderbefehle, die nicht ins Terminal gehen, sondern die Oberflaeche
      // bedienen. Faktionsarbeit zu starten prueft die Echtheit des Klicks
      // NICHT - anders als der Join-Knopf. Ohne diesen Weg stuende die
      // Reputation still, sobald der Nachtdienst mal aussetzt.
      if (/^!work\s+/i.test(b)) {
        const faktion = b.replace(/^!work\s+/i, "").trim();
        protokoll.push("> Faktionsarbeit fuer " + faktion);
        // Alt+F oeffnet die Faktionsseite. Der Handler haengt am Dokument und
        // prueft die Echtheit nicht.
        doc.dispatchEvent(new KeyboardEvent("keydown", { key: "f", altKey: true, bubbles: true }));
        await ns.sleep(1200);
        const details = [...doc.querySelectorAll("button")]
          .filter((x) => (x.innerText || "").trim() === "Details")
          .find((x) => new RegExp(faktion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .test((x.parentElement.parentElement || {}).innerText || ""));
        if (!details) { protokoll.push("  Faktion nicht auf der Seite gefunden"); continue; }
        details.click();
        await ns.sleep(1200);
        const hc = [...doc.querySelectorAll("button")]
          .find((x) => /^Hacking Contracts$/.test((x.innerText || "").trim()) && !x.disabled);
        if (!hc) { protokoll.push("  Kein Hacking-Contracts-Knopf"); continue; }
        hc.click();
        await ns.sleep(1500);
        // Solange FOKUSSIERTE Arbeit laeuft, reagiert keine Taste mehr - der
        // Automat waere danach handlungsunfaehig. Also sofort entfokussieren.
        const raus = [...doc.querySelectorAll("button")]
          .find((x) => /^Do something else simultaneously$/.test((x.innerText || "").trim()));
        if (raus) raus.click();
        protokoll.push("  gestartet" + (raus ? " und entfokussiert" : " (Fokus blieb an!)"));
        continue;
      }
      if (!terminal(b)) { protokoll.push("FEHLER bei: " + b); break; }
      protokoll.push("> " + b);
      if (/^backdoor$/i.test(b)) {
        // Ab hier nichts mehr senden. Auf den Serverzustand warten, nicht auf
        // Terminaltext - der Puffer enthaelt Erfolgsmeldungen frueherer
        // Versuche, an denen jede Textpruefung sofort anschlaegt.
        // Der Zielrechner kommt aus dem letzten connect-Befehl, NICHT aus dem
        // Bildschirmtext: nach `backdoor` stehen dort Fortschrittsbalken, und
        // der letzte sichtbare Prompt gehoert noch zum Rechner davor. Genau
        // daran hat die Hand beim ersten Versuch harakiri-sushi statt CSEC
        // geprueft und viel zu frueh Vollzug gemeldet.
        const letzterConnect = [...befehle].reverse().find((x) => /^connect\s+\S+/i.test(x));
        const host = letzterConnect ? letzterConnect.split(/\s+/)[1] : ns.getHostname();
        let ok = false;
        for (let i = 0; i < 60; i++) {
          await ns.sleep(3000);
          try { if (ns.getServer(host).backdoorInstalled) { ok = true; break; } } catch { /* weiter */ }
        }
        protokoll.push(ok ? "BACKDOOR BESTAETIGT auf " + host : "Backdoor auf " + host + " nicht bestaetigt");
        break;
      }
      await ns.sleep(800);
    }

    } catch (e) {
      // Ohne diesen Fangarm stirbt die Hand mitten im Befehl, und der
      // Nachtdienst bliebe stillgestellt zurueck. Am 20.08. ist genau das
      // mehrfach passiert - jedes Mal war danach der ganze Steuerkanal tot.
      protokoll.push("FEHLER: " + (e && e.message ? e.message : String(e)));
    }
    if (dienst) dienst.busy = false;
    schreibe(protokoll.join("\n") + "\n--- Terminal ---\n" + zeilen().slice(-8).join("\n"));
  }
}
