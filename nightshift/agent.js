/**
 * Der Nachtdienst - vollstaendiger Kreislauf.
 *
 * Laeuft IM Seitenkontext des Spiels als `setInterval`. Ein externer Prozess
 * WAERE moeglich (siehe `nightshift/cdp.js`: die 404 auf /json betreffen nur
 * die HTTP-Erkundung, der Browser-Endpunkt steht in Operas DevToolsActivePort,
 * und CDP-Klicks erzeugen nachweislich `isTrusted: true`). Fuer den
 * unbeaufsichtigten Nachtlauf ist der Weg in der Seite trotzdem der bessere:
 * Opera drosselt neue CDP-Verbindungen und verlangt fuer jede eine Freigabe im
 * Browser - reisst die Leitung nachts ab, wartet der Dienst auf eine
 * Bestaetigung, die niemand geben kann. Ein Taktgeber in der Seite braucht
 * dagegen gar keinen Zugriff von aussen.
 *
 * Preis dieser Wahl: kein `isTrusted`. Damit sind genau zwei Dinge unerreichbar
 * - der `Join!`-Knopf auf der Faktionsseite und `Create program`. Fuer den
 * Beitritt gibt es das Einladungs-Popup als Ersatzweg, dessen `join()` gar kein
 * Event entgegennimmt.
 *
 * Der Kreislauf:
 *   Reputation sammeln -> Augmentations kaufen -> installieren (Reset)
 *   -> wiederaufbauen -> von vorn mit besseren Multiplikatoren.
 *
 * Zwei Eigenheiten des Spiels tragen das Ganze:
 *  - Die Seitenleiste haengt ihren Tastaturhandler an `document` und prueft die
 *    Echtheit nicht. Alt+T/F/A/O/W navigieren also synthetisch. ABER: solange
 *    FOKUSSIERTE Arbeit laeuft, reagiert keine Taste. Nach jedem Start einer
 *    Faktionsarbeit muss deshalb sofort entfokussiert werden.
 *  - Der Install laedt die Seite NICHT neu. Es ist ein reiner
 *    React-Zustandswechsel, der auf der Terminal-Seite endet - dieser Dienst
 *    ueberlebt seinen eigenen Reset.
 *
 * Aus zwei Pruefberichten vom 19.08.2026 korrigiert (die Befunde stehen als
 * Kommentar an der jeweiligen Stelle):
 *  - Das Spiel vergibt NIRGENDS `role="dialog"` (live nachgemessen: 0 Treffer).
 *  - Synthetisches Escape wirkt nicht, weil der Handler `event.code` prueft.
 *  - Ab Level 1000 rendert das Spiel `Hack 1,234` mit Tausendertrenner.
 *  - Bei vollstaendig gekaufter Faktion steht "No Augmentations left".
 *  - Cranial Signal Processors Gen II verlangt 18.750 Rep, nicht 12.500.
 *  - Der TOR-Router ueberlebt den Reset NICHT.
 */
() => {
  if (!document.title.includes("Bitburner")) return { fehler: "falscher Tab: " + document.title };
  const alt = window.__nightshift;
  if (alt && alt.timer) clearInterval(alt.timer);
  const schlaf = (ms) => new Promise((ok) => setTimeout(ok, ms));

  // Suffixtabelle des Spiels. q/Q und s/S unterscheiden sich NUR in der
  // Grossschreibung - deshalb nirgends /i oder toLowerCase, das waere ein
  // Faktor 1000 Unterschied.
  const SUF = { k: 1e3, m: 1e6, b: 1e9, t: 1e12, q: 1e15, Q: 1e18, s: 1e21, S: 1e24, o: 1e27, n: 1e30 };
  const zahl = (z, s) => Number(String(z).replace(/,/g, "")) * (SUF[s] || 1);

  // Stadtfaktionen: sie sperren bis zur naechsten Augmentation die uebrigen
  // Staedte, und in Ishima sitzt Tian Di Hui mit S.N.A.
  const AVOID = ["Sector-12", "Aevum", "Chongqing", "New Tokyo", "Ishima", "Volhaven"];

  const PREISE = {
    "BruteSSH.exe": 500e3, "FTPCrack.exe": 1.5e6, "relaySMTP.exe": 5e6,
    "HTTPWorm.exe": 30e6, "SQLInject.exe": 250e6,
  };

  const N = {
    round: 0,
    busy: false,
    started: Date.now(),
    resets: (alt && alt.resets) || 0,
    done: (alt && alt.done) || ["CSEC", "avmnite-02h"],
    journal: (alt && alt.journal) || [],
    fehlversuche: (alt && alt.fehlversuche) || {},
    verwalterHost: (alt && alt.verwalterHost) || "bot-1",
    aufbau: (alt && alt.aufbau) || null,
    last: (alt && alt.last) || {},
    timer: null,
    wiederbelebt: 0,
    gekauft: 0,
    zahl,

    // 18.750, nicht 12.500. Cranial Signal Processors Gen II verlangt 18.750
    // Reputation; die 12.500 waren die Anforderung einer ganz anderen
    // Augmentation (CashRoot Starter Kit bei Sector-12).
    REP_ZIEL: 18750,

    ziele: [
      { host: "CSEC", level: 53, faction: "CyberSec", path: ["harakiri-sushi", "CSEC"] },
      {
        host: "avmnite-02h", level: 202, faction: "NiteSec",
        path: ["sigma-cosmetics", "nectar-net", "phantasy", "avmnite-02h"],
      },
      {
        host: "I.I.I.I", level: 340, faction: "The Black Hand",
        path: ["harakiri-sushi", "CSEC", "omega-net", "computek", "I.I.I.I"],
      },
      {
        host: "run4theh111z", level: 505, faction: "BitRunners",
        path: ["harakiri-sushi", "CSEC", "silver-helix", "johnson-ortho", "summit-uni", "aevum-police",
          "galactic-cyber", "deltaone", "icarus", "taiyang-digital", "run4theh111z"],
      },
    ],

    plan: [{ faction: "CyberSec", repZiel: 18750 }, { faction: "NiteSec", repZiel: 45000 }],

    note(t) {
      const d = new Date();
      this.journal.push(String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + "  " + t);
      if (this.journal.length > 500) this.journal.shift();
    },

    /** Zeitgesteuert statt ueber Rundenzahlen: waehrend eines mehrminuetigen
     *  Backdoors springt die Rundenzahl weiter, ohne dass ein Takt etwas tut.
     *  Mit Modulo-Bedingungen traf danach jede Aufgabe nur noch zufaellig zu,
     *  und die Lebenswache konnte eine Stunde ausfallen - genau die ist aber
     *  der Grund, warum es diesen Dienst gibt. */
    faellig(name, ms) {
      if (Date.now() - (this.last[name] || 0) < ms) return false;
      this.last[name] = Date.now();
      return true;
    },

    key(k) { document.dispatchEvent(new KeyboardEvent("keydown", { key: k, altKey: true, bubbles: true })); },

    text() { return ((document.getElementById("root") || {}).innerText || "").replace(/\s+/g, " "); },

    /** Ab Level 1000 rendert das Spiel "Hack 1,234" mit Tausendertrenner. Ein
     *  \d+ macht daraus eine 1 - genau die spaeten Backdoor-Ziele waeren damit
     *  unerreichbar geworden. */
    hacking() {
      const m = this.text().match(/Hack ([\d,]+)/);
      return m ? Number(m[1].replace(/,/g, "")) : null;
    },

    money() {
      const m = this.text().match(/Money \$([\d.,]+)([kmbtqQsSon])?/);
      return m ? zahl(m[1], m[2]) : null;
    },

    working() {
      const m = this.text().match(/Working for ([\w\-.& ]+?) ([\d.,]+)([kmbtqQsSon]?) rep/);
      return m ? { faction: m[1].trim(), rep: zahl(m[2], m[3]) } : null;
    },

    knopf(muster, nurAktive) {
      return [...document.querySelectorAll("button")].find((b) => {
        if (nurAktive && b.disabled) return false;
        return muster.test((b.innerText || "").trim());
      });
    },

    /** Der native Setter ist noetig, weil React eine schlichte Wertzuweisung am
     *  Eingabefeld nicht mitbekommt. */
    terminal(b) {
      const el = document.getElementById("terminal-input");
      if (!el) return false;
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, b);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
      return true;
    },

    async amTerminal() {
      if (document.getElementById("terminal-input")) return true;
      this.key("t");
      await schlaf(800);
      return !!document.getElementById("terminal-input");
    },

    async befehle(liste, pause) { for (const b of liste) { this.terminal(b); await schlaf(pause || 700); } },

    lines() { return [...document.querySelectorAll("#terminal li, #terminal p")].map((e) => e.innerText); },

    // --- Dialoge ---

    /** Das Spiel vergibt nirgends role="dialog" - alle Modals laufen ueber MUI
     *  (live nachgemessen: 0 Treffer fuer role=dialog). */
    dialog() {
      for (const s of [".MuiModal-root", "[class*='MuiModal-root']", "[class*='MuiDialog-root']", "[role='dialog']", "[role='presentation']"]) {
        const w = document.querySelector(s);
        if (w && w.offsetParent !== null && (w.innerText || "").trim()) return w;
      }
      return null;
    },

    async dialogKnopf(muster, wartenMs) {
      const bis = Date.now() + (wartenMs || 3000);
      while (Date.now() < bis) {
        const d = this.dialog();
        const b = d && [...d.querySelectorAll("button")].find((x) => muster.test((x.innerText || "").trim()));
        if (b) { b.click(); await schlaf(400); return true; }
        await schlaf(250);
      }
      return false;
    },

    /** Synthetisches Escape wirkt nicht - der Handler prueft `event.code`, das
     *  bei selbst gebauten Ereignissen leer bleibt. Also ueber den
     *  Schliessknopf, der die Echtheit des Klicks nicht prueft. */
    async dialogSchliessen() {
      for (let i = 0; i < 6; i++) {
        const d = this.dialog();
        if (!d) return true;
        const k = [...d.querySelectorAll("button")];
        const zu = k.find((b) => /^(Purchase|Confirm|OK|Close|Got it|Decide later)$/i.test((b.innerText || "").trim())) || k[k.length - 1];
        if (!zu) return false;
        zu.click();
        await schlaf(500);
      }
      return !this.dialog();
    },

    /** Eine liegengelassene Stadtfaktions-Einladung verdeckt dauerhaft alle
     *  folgenden - das Popup zeigt immer nur die erste der Warteschlange. Sie
     *  muss weggeklickt werden, nicht ignoriert. */
    handleInvite() {
      const d = this.dialog();
      if (!d) return;
      const t = (d.innerText || "").replace(/\s+/g, " ");
      if (!/invit/i.test(t)) return;
      const k = [...d.querySelectorAll("button")];
      const stadt = AVOID.find((f) => t.includes(f));
      if (stadt) {
        const spaeter = k.find((b) => /decide later|later|close/i.test((b.innerText || "").trim()));
        if (spaeter) { spaeter.click(); this.note("Einladung von " + stadt + " weggeklickt (Stadtfaktion)"); }
        return;
      }
      const j = k.find((b) => /^join/i.test((b.innerText || "").trim()));
      if (j) { j.click(); this.note("Einladung angenommen: " + t.slice(0, 50)); }
    },

    /** Der Schliessknopf traegt title, nicht aria-label. */
    tidy() {
      for (const b of document.querySelectorAll("button[title='Close window'], button[aria-label='Close window']")) {
        const k = b.closest("div");
        if (k && /Autopilot|invest|xp\.js/i.test(k.innerText || "")) b.click();
      }
    },

    // --- Faktionen ---

    /** Sind alle Augmentations gekauft, steht dort "No Augmentations left"
     *  statt einer Zahl - eine Fassung, die nur \d+ akzeptiert, verliert die
     *  Faktion genau im Zielzustand aus der Liste und verklemmt lautlos. */
    async repStand() {
      this.key("f");
      await schlaf(800);
      const t = this.text();
      const ab = t.indexOf("Your Factions");
      if (ab < 0) return {};
      const raus = {};
      const re = /Details Augments ([\w\-.& ]+?) (?:[\d,]+|No) Augmentations left ([\d.,]+) favor ([\d.,]+)([kmbtqQsSon]?) rep/g;
      let m;
      while ((m = re.exec(t.slice(ab))) !== null) raus[m[1].trim()] = zahl(m[3], m[4]);
      return raus;
    },

    oeffne(faction, welcher) {
      const b = [...document.querySelectorAll("button")]
        .filter((x) => new RegExp("^" + welcher + "$").test((x.innerText || "").trim()))
        .find((x) => new RegExp(faction.replace(/\./g, "\\.")).test((x.parentElement.parentElement || {}).innerText || ""));
      if (!b) return false;
      b.click();
      return true;
    },

    async arbeitSicherstellen() {
      const w = this.working();
      const rep = await this.repStand();
      const ziel = this.plan.find((p) => rep[p.faction] !== undefined && rep[p.faction] < p.repZiel);
      if (!ziel) { if (!w) this.note("Kein Repziel offen und keine Arbeit - warte auf Kauf/Install"); return; }
      if (w && w.faction === ziel.faction) return;
      if (!this.oeffne(ziel.faction, "Details")) { this.note("Faktion " + ziel.faction + " nicht auf der Seite"); return; }
      await schlaf(800);
      const hc = this.knopf(/^Hacking Contracts$/, true);
      if (!hc) { this.note("Kein Hacking-Contracts-Knopf bei " + ziel.faction); return; }
      hc.click();
      await schlaf(900);
      // Solange FOKUSSIERTE Arbeit laeuft, reagiert keine Taste mehr. Der
      // Fokusverzicht kostet 20 Prozent Reputationstempo und ist zwingend.
      const raus = this.knopf(/^Do something else simultaneously$/, true);
      if (raus) raus.click();
      this.note("Faktionsarbeit gestartet fuer " + ziel.faction + (w ? " (vorher " + w.faction + ")" : ""));
    },

    // --- Augmentations ---

    /** NeuroFlux zaehlt nicht mit: beliebig oft kaufbar, waere nie "fertig". */
    offeneAugs() {
      return [...document.querySelectorAll("button")].filter((b) => {
        if ((b.innerText || "").trim() !== "Buy") return false;
        let z = b.parentElement;
        for (let k = 0; k < 3 && z && (z.innerText || "").length < 40; k++) z = z.parentElement;
        return !/NeuroFlux/i.test((z ? z.innerText : ""));
      }).length;
    },

    /** Teuerste zuerst, weil jeder Kauf den Preis aller folgenden um Faktor
     *  1.9 hebt; die Reputationsanforderung steigt dagegen NICHT mit. Ein Kauf
     *  gilt erst als erfolgt, wenn die Zahl offener Augmentations gesunken ist
     *  - blindes Mitzaehlen hat frueher Kaeufe gemeldet, die nie stattfanden. */
    async augsKaufen(faction) {
      this.key("f");
      await schlaf(800);
      if (!this.oeffne(faction, "Augments")) { this.note("Augments-Knopf fuer " + faction + " nicht gefunden"); return 0; }
      await schlaf(1000);
      let n = 0;
      for (let i = 0; i < 12; i++) {
        const kandidaten = [...document.querySelectorAll("button")]
          .filter((b) => (b.innerText || "").trim() === "Buy" && !b.disabled)
          .map((b) => {
            let z = b.parentElement;
            for (let k = 0; k < 3 && z && (z.innerText || "").length < 40; k++) z = z.parentElement;
            const txt = (z ? z.innerText : "").replace(/\s+/g, " ");
            const m = txt.match(/\$([\d.,]+)([kmbtqQsSon])?/);
            return { b, preis: m ? zahl(m[1], m[2]) : 0, neuroflux: /NeuroFlux/i.test(txt), name: txt.slice(4, 44) };
          })
          .filter((x) => !x.neuroflux)
          .sort((a, b) => b.preis - a.preis);
        if (!kandidaten.length) break;
        const vorher = this.offeneAugs();
        kandidaten[0].b.click();
        await schlaf(700);
        await this.dialogKnopf(/^Purchase$/, 2500);
        await this.dialogSchliessen();
        await schlaf(600);
        if (this.offeneAugs() < vorher) {
          n++; this.gekauft++;
          this.note("Gekauft: " + kandidaten[0].name);
        } else {
          this.note("Kauf von " + kandidaten[0].name + " hat nicht gegriffen - Abbruch");
          break;
        }
      }
      return n;
    },

    /** NeuroFlux erst, wenn nichts Normales mehr offen ist - und dann bis das
     *  Geld alle ist: beim Install faellt das Guthaben ohnehin auf 1262, jeder
     *  nicht ausgegebene Dollar waere verschenkt. */
    async neurofluxKaufen() {
      let n = 0;
      for (let i = 0; i < 20; i++) {
        const b = [...document.querySelectorAll("button")].find((x) => {
          if ((x.innerText || "").trim() !== "Buy" || x.disabled) return false;
          let z = x.parentElement;
          for (let k = 0; k < 3 && z && (z.innerText || "").length < 40; k++) z = z.parentElement;
          return /NeuroFlux/i.test((z ? z.innerText : ""));
        });
        if (!b) break;
        b.click();
        await schlaf(700);
        await this.dialogKnopf(/^Purchase$/, 2500);
        await this.dialogSchliessen();
        n++;
        await schlaf(500);
      }
      if (n) this.note("NeuroFlux Governor " + n + " Stufen gekauft");
      return n;
    },

    /** Reset nur im Zeitfenster: vorher lohnt der Wiederaufbau die Nacht nicht
     *  mehr, nachher stuende Eric morgens vor einem halbfertigen Neustart. */
    installFenster() {
      const h = new Date().getHours();
      return h >= 22 || h < 4;
    },

    async pruefeAugs() {
      const rep = await this.repStand();
      if ((rep.CyberSec || 0) < this.REP_ZIEL) return;
      const gekauft = await this.augsKaufen("CyberSec");
      const offen = this.offeneAugs();
      if (gekauft) this.note("Kaufdurchgang: " + gekauft + " Stueck, noch offen: " + offen);
      if (offen !== 0) return;
      await this.neurofluxKaufen();
      if (!this.installFenster()) { this.note("Alles gekauft - Install wartet auf das Zeitfenster ab 22 Uhr"); return; }
      await this.installieren();
    },

    async installieren() {
      this.key("a");
      await schlaf(900);
      const b = this.knopf(/^Install Augmentations$/, true);
      if (!b) { this.note("Install-Knopf nicht bereit (Warteschlange leer?)"); return false; }
      this.note("=== INSTALL: Reset Nr. " + (this.resets + 1) + " bei Hacking " + this.hacking() + " ===");
      b.click();
      await schlaf(1500);
      await this.dialogKnopf(/^Confirm$/, 3000);
      await schlaf(2500);
      // Nach dem Install kommt GARANTIERT eine Meldung ("You slowly drift to
      // sleep..."), die der Unterdrueckungsschalter NICHT erfasst. Bleibt sie
      // offen, ist das Terminal blockiert und der Wiederaufbau kommt nie an.
      await this.dialogSchliessen();
      this.resets++;
      this.done = [];
      this.fehlversuche = {};
      this.verwalterHost = "foodnstuff";
      this.aufbau = { schritt: 0 };
      this.note("Reset vollzogen - Wiederaufbau beginnt");
      return true;
    },

    // --- Wiederaufbau ---

    /** Der TOR-Router ueberlebt den Reset NICHT: prestigeAllServers leert das
     *  Netz, und hasTorRouter haengt allein daran, ob darkweb in home's
     *  Netzliste steht. Ohne ihn ist `buy` tot und jeder Portknacker
     *  unerreichbar - der Wiederaufbau bliebe auf 0-Port-Servern stehen. Der
     *  Kaufknopf in der Stadt prueft die Echtheit des Klicks nicht, und der
     *  Reset setzt uns ohnehin nach Sector-12, wo Alpha Enterprises steht. */
    async torKaufen() {
      this.key("w");
      await schlaf(1000);
      const ort = [...document.querySelectorAll("button,[role='button']")]
        .find((b) => /Alpha Enterprises/i.test((b.innerText || "").trim()));
      if (!ort) { this.note("Alpha Enterprises nicht auf der Stadtkarte gefunden"); return false; }
      ort.click();
      await schlaf(1000);
      const tor = [...document.querySelectorAll("button")].find((b) => /TOR/i.test(b.innerText || "") && !b.disabled);
      if (!tor) { this.note("TOR-Knopf nicht gefunden oder gesperrt"); return false; }
      tor.click();
      await schlaf(1000);
      await this.dialogSchliessen();
      this.note("TOR-Router gekauft - Darkweb wieder erreichbar");
      return true;
    },

    /** Pruefliste statt starrer Abfolge: bei jedem Takt wird geprueft, was noch
     *  fehlt. Eine feste Wartezeit waere blind - nach dem Reset haben wir 1262
     *  Dollar, und wie lange die ersten 250.000 brauchen, weiss vorher niemand. */
    async wiederaufbau() {
      if (!(await this.amTerminal())) { this.note("Wiederaufbau: kein Terminal"); return; }
      await this.dialogSchliessen();
      const a = this.aufbau || (this.aufbau = { schritt: 0 });

      // 1. Autopilot. home-RAM, home-Kerne und Skriptdateien ueberleben den Reset.
      await this.befehle(["home", "ps"], 700);
      if (!/autopilot\.js/.test(this.lines().slice(-8).join(" "))) {
        await this.befehle(["run autopilot.js"], 1000);
        this.note("Wiederaufbau: Autopilot gestartet");
        return;
      }

      // 2. Sperrkasse weg - mit 1262 Dollar wird eine Milliardenschwelle nie
      //    wieder erreicht, der Verwalter waere dauerhaft blockiert. Fehlt die
      //    Datei, liest der Autopilot eine Sperre von null.
      if (!a.reserveWeg) {
        await this.befehle(["rm data/reserve.txt"], 700);
        a.reserveWeg = true;
        this.note("Wiederaufbau: Sperrkasse aufgehoben");
      }

      // 3. TOR-Router, sobald Geld da ist.
      const geld = this.money() || 0;
      if (!a.tor && geld >= 260e3) {
        if (await this.torKaufen()) a.tor = true;
        return;
      }

      // 4. Portknacker der Reihe nach, billigster zuerst - jeder oeffnet Server.
      if (a.tor) {
        await this.befehle(["home", "ls"], 800);
        const daheim = this.lines().slice(-6).join(" ");
        for (const p of Object.keys(PREISE)) {
          if (daheim.includes(p)) continue;
          if (geld < PREISE[p] * 1.5) break;
          await this.befehle(["buy " + p], 1000);
          if (/purchased/i.test(this.lines().slice(-2).join(" "))) this.note("Wiederaufbau: " + p + " gekauft");
          return;
        }
      }

      // 5. Verwalter auf foodnstuff: 16 GB, null Ports - der Autopilot rootet
      //    ihn binnen Sekunden. killall macht Platz fuer die 10,75 GB.
      await this.befehle(["home", "connect foodnstuff", "ps"], 700);
      const dort = this.lines().slice(-8).join(" ");
      if (/foodnstuff/.test(dort) && !/invest\.js/.test(dort)) {
        await this.befehle(["home", "scp invest.js foodnstuff", "connect foodnstuff", "killall", "run invest.js"], 900);
        if (/Running script/i.test(this.lines().slice(-2).join(" "))) {
          this.note("Wiederaufbau: Verwalter laeuft auf foodnstuff");
          a.verwalter = true;
        }
      } else if (/invest\.js/.test(dort)) {
        a.verwalter = true;
      }
      await this.befehle(["home"], 400);

      if (a.tor && a.verwalter) {
        this.note("Wiederaufbau abgeschlossen - zurueck in den Normalbetrieb");
        this.aufbau = null;
      }
    },

    // --- Dauerbetrieb ---

    /** Faellt der Verwalter, bleibt der Autopilot auf einer veralteten Fassung
     *  stehen und niemand kauft mehr Speicher. Genau das ist am 19.08. zweimal
     *  passiert. Der Verwalterhost wechselt nach einem Reset auf foodnstuff -
     *  die gekauften Server sind dann alle weg. */
    async keepAlive() {
      if (!(await this.amTerminal())) { this.note("Lebenswache: kein Terminal erreichbar"); return; }
      await this.befehle(["home", "ps"], 700);
      if (!/autopilot\.js/.test(this.lines().slice(-8).join(" "))) {
        await this.befehle(["run autopilot.js"], 900);
        this.wiederbelebt++;
        this.note("Autopilot war tot - neu gestartet");
      }
      await this.befehle(["connect " + this.verwalterHost, "ps"], 700);
      const dort = this.lines().slice(-8).join(" ");
      if (!/invest\.js/.test(dort) && new RegExp(this.verwalterHost).test(dort)) {
        await this.befehle(["home", "scp invest.js " + this.verwalterHost, "connect " + this.verwalterHost, "run invest.js"], 800);
        this.wiederbelebt++;
        this.note("Verwalter war tot - neu ausgeliefert auf " + this.verwalterHost);
      }
      await this.befehle(["home", "connect bot-2", "ps"], 700);
      if (/bot-2/.test(this.lines().slice(-6).join(" ")) && !/xp\.js/.test(this.lines().slice(-8).join(" "))) {
        await this.befehle(["home", "scp xp.js bot-2", "connect bot-2", "run xp.js"], 800);
        this.note("Erfahrungsmuehle war tot - neu gestartet");
      }
      await this.befehle(["home"], 400);
    },

    /** Mit Fehlversuchszaehler: ohne ihn wiederholt der Dienst eine
     *  fehlgeschlagene Kette alle 30 Sekunden endlos und kommt zu nichts. */
    async backdoor() {
      const lvl = this.hacking();
      if (!lvl) return;
      const ziel = this.ziele.find((t) => !this.done.includes(t.host) && lvl >= t.level && (this.fehlversuche[t.host] || 0) < 3);
      if (!ziel) return;
      this.note("Backdoor auf " + ziel.host + " - Level " + lvl + " reicht fuer " + ziel.level);
      if (!(await this.amTerminal())) { this.note("Terminal zu - Backdoor verschoben"); return; }
      await this.befehle(["home", ...ziel.path.map((h) => "connect " + h)], 600);
      if (!(this.lines().slice(-1)[0] || "").includes(ziel.host)) {
        this.fehlversuche[ziel.host] = (this.fehlversuche[ziel.host] || 0) + 1;
        this.note("Weg zu " + ziel.host + " abgebrochen (Versuch " + this.fehlversuche[ziel.host] + " von 3)");
        await this.befehle(["home"]);
        return;
      }
      this.terminal("backdoor");
      let fertig = false;
      for (let i = 0; i < 90; i++) {
        await schlaf(4000);
        const txt = this.lines().slice(-3).join(" ");
        if (/successful/i.test(txt)) {
          this.done.push(ziel.host); fertig = true;
          this.note("Backdoor auf " + ziel.host + " gesetzt - " + ziel.faction + " sollte einladen");
          break;
        }
        if (/cannot|denied|not have enough/i.test(txt)) {
          this.done.push(ziel.host); fertig = true;
          this.note("Backdoor auf " + ziel.host + " abgelehnt");
          break;
        }
      }
      if (!fertig) {
        this.fehlversuche[ziel.host] = (this.fehlversuche[ziel.host] || 0) + 1;
        this.note("Backdoor auf " + ziel.host + " ohne Rueckmeldung (Versuch " + this.fehlversuche[ziel.host] + " von 3)");
      }
      await this.befehle(["home"]);
    },

    async tick() {
      if (!document.title.includes("Bitburner")) return;
      this.round++;
      if (this.busy) return;
      this.busy = true;
      try {
        this.handleInvite();
        this.tidy();
        if (this.aufbau) { await this.wiederaufbau(); this.busy = false; return; }
        if (this.faellig("keepAlive", 5 * 60e3)) await this.keepAlive();
        if (this.faellig("arbeit", 2 * 60e3)) await this.arbeitSicherstellen();
        if (this.faellig("backdoor", 60e3)) await this.backdoor();
        if (this.faellig("augs", 3 * 60e3)) await this.pruefeAugs();
        if (this.faellig("lage", 10 * 60e3)) {
          const w = this.working();
          this.note("Lage: Hacking " + this.hacking() + ", Geld " + Math.round((this.money() || 0) / 1e6)
            + "m" + (w ? ", " + w.faction + " bei " + Math.round(w.rep) + " rep" : ", KEINE Arbeit"));
        }
      } catch (e) {
        this.note("Fehler Runde " + this.round + ": " + (e && e.message));
      }
      this.busy = false;
    },

    bericht() {
      return {
        laufzeit: Math.round((Date.now() - this.started) / 60000) + " min",
        runde: this.round,
        erledigt: this.done,
        fehlversuche: this.fehlversuche,
        wiederbelebt: this.wiederbelebt,
        gekauft: this.gekauft,
        resets: this.resets,
        aufbau: this.aufbau,
        hacking: this.hacking(),
        geld: this.money(),
        arbeit: this.working(),
        journal: this.journal.slice(-30),
      };
    },
  };

  // Verborgene Tabs drosselt der Browser nach etwa fuenf Minuten auf einen
  // Timer je Minute - das traefe auch jedes schlaf(). Ein unhoerbarer Ton haelt
  // den Tab "audible" und damit von der Drosselung ausgenommen.
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator(), g = ctx.createGain();
    g.gain.value = 0.0001; // nicht exakt 0 - das zaehlt teilweise als still
    osc.connect(g).connect(ctx.destination);
    osc.start();
    N.audio = { ctx, osc };
  } catch (e) { /* ohne Tonanker laeuft es auch, nur langsamer */ }

  N.note("Nachtdienst angetreten - voller Kreislauf");
  N.timer = setInterval(() => N.tick(), 30000);
  window.__nightshift = N;
  return { bereit: true, hacking: N.hacking(), geld: N.money(), arbeit: N.working(), repZiel: N.REP_ZIEL };
}
