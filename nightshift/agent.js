/**
 * Der Nachtdienst - vollstaendiger Kreislauf.
 *
 * Laeuft IM Seitenkontext des Spiels, nicht als eigener Prozess. Das ist keine
 * Bequemlichkeit, sondern Notwendigkeit: Opera haelt zwar Port 9222, liefert
 * aber auf jeden Discovery-Pfad 404 - eine Fernsteuerung von aussen ist damit
 * unmoeglich. Ein setInterval in der Seite laeuft dagegen weiter, solange der
 * Tab offen ist, und braucht keinerlei Zugriff von aussen. Damit loest es auch
 * KEINE Freigabeabfrage im Browser aus, was fuer den unbeaufsichtigten Betrieb
 * der eigentliche Punkt ist.
 *
 * Der Kreislauf:
 *   Reputation sammeln -> Augmentations kaufen -> installieren (Reset)
 *   -> wiederaufbauen -> von vorn, diesmal mit besseren Multiplikatoren.
 *
 * Zwei Eigenheiten des Spiels tragen das Ganze:
 *  - Die Seitenleiste haengt ihren Tastaturhandler an `document` und prueft die
 *    Echtheit des Ereignisses nicht. Alt+T/F/A/O navigieren also synthetisch.
 *    ABER: solange FOKUSSIERTE Arbeit laeuft, reagiert keine Taste. Nach jedem
 *    Start einer Faktionsarbeit muss deshalb sofort entfokussiert werden.
 *  - Der Install laedt die Seite NICHT neu. Es ist ein reiner
 *    React-Zustandswechsel, der auf der Terminal-Seite endet - dieser Dienst
 *    ueberlebt den Reset also.
 *
 * Was er bewusst NICHT tut: keine Stadtfaktion betreten. Sie sperrt bis zur
 * naechsten Augmentation die uebrigen Staedte, und in Ishima sitzt Tian Di Hui
 * mit S.N.A.
 *
 * Injektion: der gesamte Inhalt als ein Ausdruck. Mehrfaches Einspielen ist
 * unschaedlich - ein vorhandener Taktgeber wird abgeraeumt, Journal und
 * Erledigtliste werden uebernommen.
 */
() => {
  if (!document.title.startsWith("Bitburner")) return { fehler: "falscher Tab: " + document.title };
  const alt = window.__nightshift;
  if (alt && alt.timer) clearInterval(alt.timer);

  // Backdoor-Ziele mit noetigem Level und vollstaendigem Weg ab home. Die Wege
  // stammen aus src/path.js, nicht aus dem Kopf - das Netz ist je Spielstand
  // anders verdrahtet. Nach einem Reset sind auch CSEC und avmnite wieder
  // faellig, darum stehen sie mit drin.
  const TARGETS = [
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
  ];

  // Reihenfolge der Faktionsarbeit. Das Repziel ist die hoechste
  // Rep-Anforderung unter den Augmentations der jeweiligen Faktion.
  const PLAN = [{ faction: "CyberSec", repZiel: 12500 }, { faction: "NiteSec", repZiel: 45000 }];

  const PROGRAMME = [
    { name: "BruteSSH.exe", preis: 500e3 },
    { name: "FTPCrack.exe", preis: 1.5e6 },
    { name: "relaySMTP.exe", preis: 5e6 },
    { name: "HTTPWorm.exe", preis: 30e6 },
    { name: "SQLInject.exe", preis: 250e6 },
  ];

  const AVOID = ["Sector-12", "Aevum", "Chongqing", "New Tokyo", "Ishima", "Volhaven"];
  const schlaf = (ms) => new Promise((ok) => setTimeout(ok, ms));

  const N = {
    round: 0,
    busy: false,
    aufbauNoetig: false,
    started: Date.now(),
    resets: (alt && alt.resets) || 0,
    done: (alt && alt.done) || [],
    journal: (alt && alt.journal) || [],
    timer: null,
    wiederbelebt: 0,
    gekauft: 0,

    note(t) {
      const d = new Date();
      this.journal.push(String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + "  " + t);
      if (this.journal.length > 500) this.journal.shift();
    },

    key(k) { document.dispatchEvent(new KeyboardEvent("keydown", { key: k, altKey: true, bubbles: true })); },

    text() { return ((document.getElementById("root") || {}).innerText || "").replace(/\s+/g, " "); },

    hacking() { const m = this.text().match(/Hack (\d+)/); return m ? Number(m[1]) : null; },

    money() {
      const m = this.text().match(/Money \$([\d.]+)([kmbt])?/i);
      return m ? Number(m[1]) * ({ k: 1e3, m: 1e6, b: 1e9, t: 1e12 }[(m[2] || "").toLowerCase()] || 1) : null;
    },

    working() {
      const m = this.text().match(/Working for ([\w\-. ]+?) ([\d.]+)(k?) rep/);
      return m ? { faction: m[1].trim(), rep: Number(m[2]) * (m[3] ? 1000 : 1) } : null;
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

    /** Terminal sicher oeffnen. Das Spiel wechselt gelegentlich von sich aus
     *  den Bildschirm - blind zu tippen ginge dann ins Leere. */
    async amTerminal() {
      if (document.getElementById("terminal-input")) return true;
      this.key("t");
      await schlaf(800);
      return !!document.getElementById("terminal-input");
    },

    async befehle(liste, pause) { for (const b of liste) { this.terminal(b); await schlaf(pause || 700); } },

    lines() { return [...document.querySelectorAll("#terminal li, #terminal p")].map((e) => e.innerText); },

    /** Das Einladungs-Popup prueft die Echtheit des Klicks nicht, der
     *  Join-Knopf auf der Faktionsseite dagegen schon. */
    handleInvite() {
      const dlg = document.querySelector("[role='dialog']");
      if (!dlg) return;
      const t = (dlg.innerText || "").replace(/\s+/g, " ");
      if (!/invit/i.test(t)) return;
      const stadt = AVOID.find((f) => t.includes(f));
      if (stadt) { this.note("Einladung von " + stadt + " liegen gelassen (Stadtfaktion)"); return; }
      const j = [...dlg.querySelectorAll("button,[role='button']")].find((b) => /^join/i.test((b.innerText || "").trim()));
      if (j) { j.click(); this.note("Einladung angenommen: " + t.slice(0, 50)); }
    },

    /** Nur Knoepfe anfassen, die eindeutig ein Skriptfenster schliessen. Ein zu
     *  weiter Griff wuerde nachts blind in der Oberflaeche herumklicken. */
    tidy() {
      for (const b of document.querySelectorAll("button[aria-label='Close window']")) {
        const k = b.closest("div");
        if (k && /Autopilot|invest/i.test(k.innerText || "")) b.click();
      }
    },

    /** Reputation aller eigenen Faktionen von der Uebersichtsseite. */
    async repStand() {
      this.key("f");
      await schlaf(800);
      const t = this.text();
      const ab = t.indexOf("Your Factions");
      if (ab < 0) return {};
      const raus = {};
      const re = /Details Augments ([\w\-. ]+?) \d+ Augmentations left ([\d.]+) favor ([\d.]+)(k?) rep/g;
      let m;
      while ((m = re.exec(t.slice(ab))) !== null) raus[m[1].trim()] = Number(m[3]) * (m[4] ? 1000 : 1);
      return raus;
    },

    /** Auf der Faktionsseite den benannten Knopf einer bestimmten Faktion. */
    oeffne(faction, welcher) {
      const b = [...document.querySelectorAll("button")]
        .filter((x) => new RegExp("^" + welcher + "$").test((x.innerText || "").trim()))
        .find((x) => new RegExp(faction.replace(/\./g, "\\.")).test((x.parentElement.parentElement || {}).innerText || ""));
      if (!b) return false;
      b.click();
      return true;
    },

    /** Die Faktionsarbeit ist ueber Nacht die einzige Reputationsquelle. Sie zu
     *  starten prueft die Echtheit des Klicks nicht - anders als der Join-Knopf.
     *  Nach dem Start ist der Fokus an, und solange er an ist, reagiert keine
     *  Taste mehr: also sofort wieder entfokussieren. */
    async arbeitSicherstellen() {
      const w = this.working();
      const rep = await this.repStand();
      const ziel = PLAN.find((p) => rep[p.faction] !== undefined && rep[p.faction] < p.repZiel);
      if (!ziel) { if (!w) this.note("Kein Repziel offen und keine Arbeit - warte auf Install"); return; }
      if (w && w.faction === ziel.faction) return;
      if (!this.oeffne(ziel.faction, "Details")) { this.note("Faktion " + ziel.faction + " nicht auf der Seite"); return; }
      await schlaf(800);
      const hc = this.knopf(/^Hacking Contracts$/, true);
      if (!hc) { this.note("Kein Hacking-Contracts-Knopf bei " + ziel.faction); return; }
      hc.click();
      await schlaf(900);
      const raus = this.knopf(/^Do something else simultaneously$/, true);
      if (raus) raus.click();
      this.note("Faktionsarbeit gestartet fuer " + ziel.faction + (w ? " (vorher " + w.faction + ")" : ""));
    },

    /** Wie viele normale Augmentations sind auf der Seite noch offen? NeuroFlux
     *  zaehlt nicht mit, der ist beliebig oft kaufbar und waere nie "fertig". */
    offeneAugs() {
      return [...document.querySelectorAll("button")].filter((b) => {
        if ((b.innerText || "").trim() !== "Buy") return false;
        let z = b.parentElement;
        for (let k = 0; k < 3 && z && (z.innerText || "").length < 40; k++) z = z.parentElement;
        return !/NeuroFlux/i.test((z ? z.innerText : ""));
      }).length;
    },

    /** Alles kaufen, was kaufbar ist - teuerste zuerst, weil jeder Kauf den
     *  Preis aller folgenden um Faktor 1.9 hebt. Die Reputationsanforderung
     *  steigt dagegen NICHT mit. */
    async augsKaufen(faction) {
      this.key("f");
      await schlaf(800);
      if (!this.oeffne(faction, "Augments")) return 0;
      await schlaf(1000);
      let n = 0;
      for (let i = 0; i < 12; i++) {
        const kandidaten = [...document.querySelectorAll("button")]
          .filter((b) => (b.innerText || "").trim() === "Buy" && !b.disabled)
          .map((b) => {
            let z = b.parentElement;
            for (let k = 0; k < 3 && z && (z.innerText || "").length < 40; k++) z = z.parentElement;
            const txt = (z ? z.innerText : "").replace(/\s+/g, " ");
            const m = txt.match(/\$([\d.]+)([kmbt])?/);
            const preis = m ? Number(m[1]) * ({ k: 1e3, m: 1e6, b: 1e9, t: 1e12 }[(m[2] || "").toLowerCase()] || 1) : 0;
            return { b, preis, neuroflux: /NeuroFlux/i.test(txt), name: txt.slice(4, 44) };
          })
          .filter((x) => !x.neuroflux)
          .sort((a, b) => b.preis - a.preis);
        if (!kandidaten.length) break;
        kandidaten[0].b.click();
        n++;
        this.gekauft++;
        this.note("Gekauft: " + kandidaten[0].name);
        await schlaf(1400);
        if (document.querySelector("[role='dialog']")) document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        await schlaf(400);
      }
      return n;
    },

    /** NeuroFlux Governor, solange Geld und Reputation reichen. Das lohnt sich
     *  ausgerechnet KURZ VOR dem Install: beim Installieren faellt das Guthaben
     *  ohnehin auf 1262 zurueck, jeder nicht ausgegebene Dollar ist also
     *  verschenkt. Jede Stufe gibt ein Prozent auf alle Multiplikatoren. */
    async neurofluxKaufen() {
      let n = 0;
      for (let i = 0; i < 15; i++) {
        const b = [...document.querySelectorAll("button")].find((x) => {
          if ((x.innerText || "").trim() !== "Buy" || x.disabled) return false;
          let z = x.parentElement;
          for (let k = 0; k < 3 && z && (z.innerText || "").length < 40; k++) z = z.parentElement;
          return /NeuroFlux/i.test((z ? z.innerText : ""));
        });
        if (!b) break;
        b.click();
        n++;
        await schlaf(1200);
        if (document.querySelector("[role='dialog']")) document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        await schlaf(300);
      }
      if (n) this.note("NeuroFlux Governor " + n + "x gekauft");
      return n;
    },

    /** Kaufen, sobald das Reputationsziel steht - und installieren, sobald
     *  nichts Normales mehr offen ist. Erst dann lohnt der Reset wirklich:
     *  jede Augmentation verteuert die naechste, also holt man in einem
     *  Durchgang so viele wie moeglich. */
    async pruefeAugs() {
      const rep = await this.repStand();
      const ziel = PLAN[0];
      if ((rep[ziel.faction] || 0) < ziel.repZiel) return;
      const gekauft = await this.augsKaufen(ziel.faction);
      const offen = this.offeneAugs();
      if (gekauft) this.note("Kaufdurchgang: " + gekauft + " Stueck, noch offen: " + offen);
      if (offen === 0) {
        await this.neurofluxKaufen();
        await this.installieren();
      }
    },

    /** Der Reset. Die Seite laedt dabei NICHT neu - dieser Dienst ueberlebt ihn. */
    async installieren() {
      this.key("a");
      await schlaf(900);
      const b = this.knopf(/^Install Augmentations$/, true);
      if (!b) { this.note("Install-Knopf nicht bereit"); return false; }
      this.note("=== INSTALL: Reset Nr. " + (this.resets + 1) + " bei Hacking " + this.hacking() + " ===");
      b.click();
      await schlaf(2500);
      if (document.querySelector("[role='dialog']")) {
        const c = this.knopf(/^Confirm$/, true);
        if (c) { c.click(); await schlaf(2000); }
      }
      // Meldungsfenster ohne OK-Knopf wegdruecken
      for (let i = 0; i < 3; i++) {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        await schlaf(500);
      }
      this.resets++;
      this.done = []; // Backdoors sind weg, alles noch einmal
      this.aufbauNoetig = true;
      this.note("Reset vollzogen - Wiederaufbau beginnt");
      await schlaf(3000);
      await this.wiederaufbau();
      return true;
    },

    /** Nach dem Reset laeuft NICHTS mehr: alle Skripte gekillt, alle Programme
     *  ausser NUKE.exe geloescht, alle gekauften Server verschwunden.
     *  Skriptdateien, home-RAM und home-Kerne bleiben - darauf baut das auf.
     *  Der Verwalter braucht 10.75 GB und kann deshalb nicht auf home laufen;
     *  foodnstuff hat 16 GB und null noetige Ports, ist also sofort da. */
    async wiederaufbau() {
      if (!(await this.amTerminal())) return;
      // Die Sperrkasse MUSS weg. Sie steht bei 4 Milliarden, damit das Geld vor
      // dem Reset in Augmentations statt in brachliegenden Speicher fliesst -
      // danach wuerde sie den Verwalter dauerhaft blockieren, denn mit 1262
      // Dollar Startkapital wird diese Schwelle nie wieder erreicht. Fehlt die
      // Datei, liest der Autopilot eine Sperre von null.
      await this.befehle(["home", "rm data/reserve.txt"], 800);
      this.note("Sperrkasse aufgehoben - der Verwalter darf wieder kaufen");
      await this.befehle(["run autopilot.js"], 1200);
      this.note("Autopilot nach Reset gestartet");
      await schlaf(20000);
      await this.befehle(["home", "scp invest.js foodnstuff", "connect foodnstuff", "killall", "run invest.js", "home"], 900);
      this.note("Verwalter auf foodnstuff gesetzt");
      this.aufbauNoetig = false;
    },

    /** Fehlende Portknacker nachkaufen. Nur ueber das Terminal - das prueft die
     *  Echtheit von Eingaben nicht. Der doppelte Preis als Schwelle laesst dem
     *  Verwalter Luft, sonst kauft einer dem anderen das Geld weg. */
    async programmeNachkaufen() {
      const geld = this.money();
      if (!geld) return;
      if (!(await this.amTerminal())) return;
      await this.befehle(["home", "ls"], 800);
      const daheim = this.lines().slice(-6).join(" ");
      for (const p of PROGRAMME) {
        if (daheim.includes(p.name)) continue;
        if (geld < p.preis * 2) continue;
        await this.befehle(["buy " + p.name], 900);
        const antwort = this.lines().slice(-2).join(" ");
        if (/purchased/i.test(antwort)) this.note("Nachgekauft: " + p.name);
        else if (/TOR/i.test(antwort)) { this.note("TOR-Router fehlt - Portknacker unerreichbar!"); break; }
        break; // einer je Durchgang, dann neu bewerten
      }
    },

    /** Halten sich Autopilot und Verwalter gegenseitig am Leben? Faellt der
     *  Verwalter, bleibt der Autopilot auf einer veralteten Fassung stehen und
     *  niemand kauft mehr Speicher - das kostet ueber Nacht alles. Genau das
     *  ist am 19.08. zweimal passiert. */
    async keepAlive() {
      if (!(await this.amTerminal())) return;
      await this.befehle(["home", "ps"], 700);
      if (!/autopilot\.js/.test(this.lines().slice(-8).join(" "))) {
        await this.befehle(["run autopilot.js"], 900);
        this.wiederbelebt++;
        this.note("Autopilot war tot - neu gestartet");
      }
      await this.befehle(["connect bot-1", "ps"], 700);
      if (!/invest\.js/.test(this.lines().slice(-8).join(" "))) {
        await this.befehle(["home", "scp invest.js bot-1", "connect bot-1", "run invest.js"], 800);
        this.wiederbelebt++;
        this.note("Verwalter war tot - neu ausgeliefert");
      }
      await this.befehle(["home"], 400);
    },

    async backdoor() {
      const lvl = this.hacking();
      if (!lvl) return;
      const ziel = TARGETS.find((t) => !this.done.includes(t.host) && lvl >= t.level);
      if (!ziel) return;
      this.note("Backdoor auf " + ziel.host + " - Level " + lvl + " reicht fuer " + ziel.level);
      if (!(await this.amTerminal())) { this.note("Terminal zu - Backdoor verschoben"); return; }
      await this.befehle(["home", ...ziel.path.map((h) => "connect " + h)], 600);
      if (!(this.lines().slice(-1)[0] || "").includes(ziel.host)) {
        this.note("Weg zu " + ziel.host + " abgebrochen");
        await this.befehle(["home"]);
        return;
      }
      this.terminal("backdoor");
      for (let i = 0; i < 90; i++) {
        await schlaf(4000);
        const txt = this.lines().slice(-3).join(" ");
        if (/successful/i.test(txt)) {
          this.done.push(ziel.host);
          this.note("Backdoor auf " + ziel.host + " gesetzt - " + ziel.faction + " sollte einladen");
          break;
        }
        if (/cannot|denied|not have enough/i.test(txt)) {
          this.done.push(ziel.host);
          this.note("Backdoor auf " + ziel.host + " abgelehnt");
          break;
        }
      }
      await this.befehle(["home"]);
    },

    async tick() {
      if (!document.title.startsWith("Bitburner")) return;
      this.round++;
      if (this.busy) return;
      this.busy = true;
      try {
        this.handleInvite();
        this.tidy();
        if (this.aufbauNoetig) { await this.wiederaufbau(); this.busy = false; return; }
        if (this.round % 10 === 0) await this.keepAlive();
        if (this.round % 4 === 2) await this.arbeitSicherstellen();
        await this.backdoor();
        if (this.round % 6 === 3) await this.pruefeAugs();
        if (this.round % 10 === 5) await this.programmeNachkaufen();
        if (this.round % 20 === 1) {
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
        wiederbelebt: this.wiederbelebt,
        gekauft: this.gekauft,
        resets: this.resets,
        hacking: this.hacking(),
        geld: this.money(),
        arbeit: this.working(),
        journal: this.journal.slice(-30),
      };
    },
  };

  N.note("Nachtdienst angetreten - voller Kreislauf");
  N.timer = setInterval(() => N.tick(), 30000);
  window.__nightshift = N;
  return { bereit: true, hacking: N.hacking(), geld: N.money(), arbeit: N.working() };
}
