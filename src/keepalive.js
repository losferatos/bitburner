/**
 * Wiederanlauf-Waechter - der einzige Teil des Bots, der einen Reset ueberlebt.
 *
 * ============================================================================
 * WARUM ES IHN GIBT
 * ============================================================================
 *
 * `installAugmentations` beendet JEDES laufende Skript. Danach liegt der
 * Autopilot als Datei auf home und tut nichts, weil ihn niemand startet - die
 * Seite laedt dabei nicht neu, es gibt also auch keinen Startvorgang, an den
 * sich etwas haengen koennte. Genau dieser Zustand hat in der Nacht zum
 * 20.08. fuenf Stunden gekostet: alles sah in Ordnung aus, nur lief nichts.
 *
 * Ein Netscript-Skript kann das nicht abfangen, weil es selbst mit beendet
 * wird. Ein `setInterval` im Seitenkontext ueberlebt dagegen - geprueft:
 * `AugmentationHelpers.ts:69-113` ruft prestigeWorkerScripts(),
 * prestigeAugmentation() und Router.toPage(Page.Terminal), aber kein
 * location.reload und kein clearInterval.
 *
 * ============================================================================
 * WAS DIE ERSTE FASSUNG FALSCH MACHTE
 * ============================================================================
 *
 * Sie war gefaehrlicher als gar kein Waechter. Eine Skeptikerrunde hat drei
 * Fehler gefunden, die alle in dieselbe Richtung wirkten - der Waechter haette
 * einen GESUNDEN Bot fuer tot gehalten und im Vierminutentakt einen zweiten
 * Autopiloten gestartet, ueber eine Nacht rund 120 Stueck:
 *
 *  - Sie las die letzten Zeilen von `document.body.innerText` statt des
 *    Terminals. Hinter dem Terminal stehen im Baum noch Tail-Fenster, Meldungen
 *    und Modals (ui/GameRoot.tsx:558-564); ein einziges aufgeklapptes
 *    Log-Fenster - der Autopilot oeffnet selbst eines - haette die gesuchte
 *    Zeile fuer immer verdeckt.
 *  - Sie wertete FALLENDES Guthaben als Stillstand. Geld ausgeben kann aber
 *    nur, wer laeuft; jede Einkaufsphase sah damit wie ein Todesfall aus.
 *  - Sie loeschte bei jedem Eingriff die Sperrkasse - eine Datei, die nur von
 *    Hand wieder zu setzen ist, und die bei totem Autopiloten ohnehin niemanden
 *    blockiert.
 *
 * Daraus die Bauregeln dieser Fassung: nur das Terminal lesen, `ps --grep`
 * statt `ps`, nach dem Start ein zweites Mal nachsehen statt Erfolg zu
 * behaupten, und im Zweifel NICHTS tun. Ein Waechter, der irrt, muss in
 * Richtung Untaetigkeit irren.
 *
 * ============================================================================
 * WARUM ER STUR ALLE ZEHN MINUTEN NACHSIEHT
 * ============================================================================
 *
 * Die zweite Fassung war zweistufig: billiger Blick aufs Guthaben je Minute,
 * teurer Blick ans Terminal erst bei Verdacht. Beide Haelften dieser Idee
 * haben sich als falsch erwiesen.
 *
 * Der teure Blick sollte selten sein, weil jede Navigation `stopFocusing()`
 * ausloest (ui/GameRoot.tsx:271-272) und das 20 % Reputation kostet
 * (Constants.ts:87). Nur kommt der Fokus von selbst NIE zurueck: Alle zwanzig
 * Aufrufer von `startFocusing()` sind Mausklicks oder Singularity-Funktionen,
 * und Singularity gibt es ohne SF4 nicht. Ein Blick pro Nacht kostet also
 * genau so viel wie einer pro Minute - Sparen kauft nichts. Es kommt darauf
 * an, den Fokus DANACH zurueckzugeben, und das kann diese Datei jetzt.
 *
 * Der billige Blick wiederum wird blind, je erfolgreicher der Bot ist. Das
 * Guthaben wird auf drei Stellen gerundet (ui/formatNumber.ts:214,
 * Settings.ts:135); der kleinste sichtbare Schritt ist ein Tausendstel der
 * Suffixgroesse und springt an jeder Grenze um Faktor 1000. Im
 * Milliardenbereich genuegen 17 k$/s, damit sich die Anzeige bewegt, im
 * Billionenbereich braucht es 17 M$/s. Ein Netz, das eben noch sauber als
 * "arbeitend" erkannt wurde, sieht bei gleichem Ertrag ploetzlich tot aus -
 * der Waechter waere genau dann zum Schaedling gekippt, wenn es gut laeuft.
 *
 * Also: kein Indikator, keine Zweistufigkeit, ein fester Takt. Zehn Minuten
 * Blindflug im schlimmsten Fall sind nichts gegen die fuenf Stunden, um die
 * es hier geht.
 *
 * Aufruf:  node tools/task.js keepalive.js
 *          node tools/task.js keepalive.js --stop
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const doc = document;
  const fenster = doc.defaultView;
  const melde = (t) => {
    ns.tprint(t);
    ns.write("data/keepalive.txt", new Date().toLocaleTimeString() + "  " + t + "\n", "a");
    if (ns.getHostname() !== "home") ns.scp("data/keepalive.txt", "home", ns.getHostname());
  };

  try {
    const alt = fenster.__keepalive;
    if (alt && alt.timer) {
      fenster.clearInterval(alt.timer);
      melde("Alter Waechter abgeloest (Eingriffe bisher: " + (alt.eingriffe || 0) + ").");
    }
  } catch (e) {
    melde("Alter Waechter liess sich nicht ablesen: " + (e && e.message ? e.message : String(e)));
  }
  if (ns.args.map(String).includes("--stop")) {
    fenster.__keepalive = null;
    return melde("Waechter gestoppt.");
  }

  // Der Taktgeber laeuft im Seitenkontext, nicht in Netscript. Alles, was er
  // braucht, muss er selbst mitbringen - nach dem Reset gibt es kein Skript
  // und keine Datei mehr, auf die er zugreifen koennte.
  const W = {
    timer: null,
    busy: false,
    eingriffe: 0,
    log: [],
    notiz(t) {
      this.log.push(new Date().toLocaleTimeString() + "  " + t);
      if (this.log.length > 60) this.log.shift();
      // Sichtbar machen: ein stummer Waechter ist kein Sicherheitsnetz,
      // sondern nur das Gefuehl eines Sicherheitsnetzes - und genau dieses
      // Gefuehl hat am 20.08. die fuenf Stunden gekostet. Das Tail-Fenster des
      // Autopiloten steht hier nicht zur Verfuegung, also in die Konsole.
      try { console.log("[keepalive] " + t); } catch (e) { /* egal */ }
    },
    schlaf: (ms) => new Promise((ok) => setTimeout(ok, ms)),

    terminal(befehl) {
      const el = document.getElementById("terminal-input");
      // Waehrend einer laufenden Terminalaktion ist das Feld gesperrt
      // (Terminal/ui/TerminalInput.tsx). Blind hineinschreiben hiesse, den
      // Befehl zu verlieren und den Verlust nicht zu merken.
      if (!el || el.disabled) return false;
      const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, "value").set;
      setter.call(el, befehl);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
      return true;
    },

    /** NUR die Terminalzeilen, nicht das ganze Dokument. */
    terminalText() {
      const t = document.getElementById("terminal");
      if (!t) return "";
      return [...t.querySelectorAll("li")].slice(-12).map((x) => x.innerText || "").join("\n");
    },

    /**
     * Laeuft er zwar, tut aber nichts? Der Autopilot legt seinen Herzschlag
     * jede Runde in den Seitenkontext; steht der, ist er in einer Ausnahme
     * haengengeblieben. Diese Auskunft kostet nichts: kein Terminal, kein
     * Seitenwechsel, kein Fokus.
     *
     * Fehlt der Puls ganz, wird NICHT von Stillstand ausgegangen - das waere
     * auch bei einer aelteren Autopilotfassung ohne Herzschlag der Fall, und
     * ein Waechter, der irrt, muss in Richtung Untaetigkeit irren.
     */
    haengt() {
      try {
        const p = window.__autopilotPuls;
        if (!p || !p.at) return false;
        return Date.now() - p.at > 180000;
      } catch (e) {
        return false;
      }
    },

    /** Laeuft der Autopilot? null heisst "nicht feststellbar" - nicht "nein". */
    async autopilotLaeuft() {
      if (!this.terminal("home")) return null;
      await this.schlaf(700);
      // `ps --grep` filtert im Spiel selbst (Terminal/commands/ps.ts:9-27).
      // Damit steht die Antwort auf genau EINER Zeile, statt in einer Liste
      // unterzugehen, die bei ausgelastetem home leicht dreissig Zeilen lang
      // ist.
      if (!this.terminal("ps --grep autopilot")) return null;
      await this.schlaf(1000);
      // Auf "(PID - " pruefen und nicht auf den Dateinamen: der steht auch im
      // Echo des eigenen Befehls, und daran schlaegt jede Textpruefung an.
      return /\(PID - \d+\)/.test(this.terminalText());
    },

    /** Teurer Blick: kostet den Fokus, deshalb nur bei begruendetem Verdacht. */
    async pruefeUndBelebe() {
      const raus = [...document.querySelectorAll("button")]
        .find((b) => (b.innerText || "").trim() === "Do something else simultaneously");
      if (raus) { raus.click(); await this.schlaf(1000); }
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "t", altKey: true, bubbles: true }));
      await this.schlaf(900);
      if (!document.getElementById("terminal-input")) {
        this.notiz("kein Terminal erreichbar - Sonderseite? (Recovery, BitVerse, Infiltration)");
        return;
      }

      const laeuft = await this.autopilotLaeuft();
      if (laeuft === null) { this.notiz("Terminal antwortete nicht - kein Eingriff"); return; }
      if (laeuft && !this.haengt()) { this.notiz("Autopilot laeuft und arbeitet - nichts zu tun"); return; }
      if (laeuft) {
        // Lebender Prozess ohne Fortschritt. Der gefaehrlichste Zustand
        // ueberhaupt, weil jede Lebendpruefung ihn fuer gesund haelt - genau
        // so stand der Bot am 20.08. mit einer verschluckten Ausnahme still,
        // waehrend die Prozessliste ihn brav auflistete. Erschlagen und
        // neu starten.
        this.notiz("Autopilot LAEUFT, aber sein Puls steht - wird erschlagen");
        if (!this.terminal("kill autopilot.js")) { this.notiz("Terminal gesperrt - kein kill"); return; }
        await this.schlaf(2000);
      }

      // Die Sperrkasse wird ABSICHTLICH nicht angeruehrt. Sie ist nur von Hand
      // wieder zu setzen, und bei totem Autopiloten blockiert sie niemanden -
      // der Fall, um den es hier geht, ist in autopilot.js:342-348 ohnehin
      // behandelt.
      if (!this.terminal("run autopilot.js")) { this.notiz("Terminal gesperrt - kein Start"); return; }
      await this.schlaf(2000);

      // Erfolg NICHT behaupten, sondern nachsehen.
      const jetzt = await this.autopilotLaeuft();
      if (jetzt === true) {
        this.eingriffe++;
        this.notiz("Autopilot war tot - neu gestartet und bestaetigt (Eingriff " + this.eingriffe + ")");
      } else {
        this.notiz("Start abgesetzt, aber NICHT bestaetigt - naechster Takt sieht erneut nach");
      }
    },

    /**
     * Der Fokus ist nach jedem teuren Blick weg, und er kommt von SELBST nie
     * wieder: Es gibt im ganzen Spiel keinen Pfad, der `focus` im laufenden
     * Betrieb zurueckschaltet - alle zwanzig Aufrufer von `startFocusing()`
     * sind Mausklicks oder Singularity-Funktionen, und Singularity gibt es
     * ohne SF4 nicht. Der Knopf "Focus" im Uebersichtsfenster wird
     * ausschliesslich gerendert, wenn Arbeit laeuft UND der Fokus aus ist
     * (ui/React/CharacterOverview.tsx:293) - sein Dasein ist der Befund, sein
     * Klick die Reparatur (:248-251).
     */
    async fokusZurueck() {
      for (let i = 0; i < 3; i++) {
        const k = [...document.querySelectorAll("button")].find((b) => (b.innerText || "").trim() === "Focus");
        if (!k) return true;
        k.click();
        await this.schlaf(900);
      }
      this.notiz("Fokus liess sich nicht zurueckgeben - Arbeit laeuft mit 80 %");
      return false;
    },

    async tick() {
      // Ohne diese Sperre feuert der naechste Takt in einen laufenden Blick
      // hinein. Unter der Hintergrunddrosselung des Browsers dauert eine
      // Pruefung leicht ein Vielfaches ihrer vier Sekunden.
      if (this.busy) return;
      this.busy = true;
      try {
        await this.pruefeUndBelebe();
        await this.fokusZurueck();
      } catch (e) {
        this.notiz("Ausnahme: " + (e && e.message ? e.message : String(e)));
      } finally {
        this.busy = false;
      }
    },
  };

  // Tonanker gegen die Hintergrunddrosselung. Verborgene Tabs bekommen nach
  // etwa fuenf Minuten nur noch einen Timer je Minute - und davon ist JEDES
  // `ns.sleep` betroffen. Ein Skript, das rechnerisch 2,7 Sekunden zwischen
  // zwei Klicks wartet, steht dann zwei Minuten, und von aussen sieht es aus,
  // als haenge es. Genau daran sind am 20.08. reihenweise Oberflaechenlaeufe
  // gescheitert, nachdem der Nachtdienst - der diesen Anker mitbrachte -
  // stillgelegt wurde.
  //
  // Ein Ton mit Pegel 0,0001 ist unhoerbar, zaehlt aber als "audible" und
  // nimmt den Tab damit aus der Drosselung. Exakt 0 zaehlt in manchen
  // Browsern als still und wirkt nicht.
  try {
    if (!fenster.__tonanker) {
      const ctx = new (fenster.AudioContext || fenster.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      osc.connect(g).connect(ctx.destination);
      osc.start();
      fenster.__tonanker = { ctx, osc };
      melde("Tonanker gesetzt - der Tab wird nicht mehr gedrosselt.");
    } else {
      melde("Tonanker lief bereits.");
    }
  } catch (e) {
    melde("Tonanker liess sich nicht setzen: " + (e && e.message ? e.message : String(e))
      + " - Oberflaechenskripte laufen im Hintergrund dann sehr langsam.");
  }

  W.timer = fenster.setInterval(() => W.tick(), 600000);
  fenster.__keepalive = W;
  melde("Waechter steht. Blick je 10 Minuten, danach Fokus zurueck. "
    + "Zustand jederzeit lesbar ueber window.__keepalive.log in der Browserkonsole.");
}
