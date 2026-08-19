/**
 * Der Nachtdienst.
 *
 * Laeuft IM Seitenkontext des Spiels, nicht als eigener Prozess. Das ist keine
 * Bequemlichkeit, sondern Notwendigkeit: Opera haelt zwar Port 9222, liefert
 * aber auf jeden Discovery-Pfad 404 - eine Fernsteuerung von aussen ist damit
 * unmoeglich. Ein setInterval in der Seite laeuft dagegen weiter, solange der
 * Tab offen ist, und braucht keinerlei Zugriff von aussen. Damit loest es auch
 * KEINE Freigabeabfrage im Browser aus, was fuer den unbeaufsichtigten Betrieb
 * der eigentliche Punkt ist.
 *
 * Was der Dienst BEWUSST NICHT tut:
 *  - keine Augmentation kaufen, keinen Reset ausloesen. Ein Install setzt Geld
 *    auf 1262 zurueck, loescht alle Programme ausser NUKE.exe, alle gekauften
 *    Server und alle laufenden Skripte. Das unbeaufsichtigt zu starten hiesse,
 *    morgens vielleicht vor einem Scherbenhaufen zu stehen.
 *  - keine Stadtfaktion betreten. Sie sperrt bis zur naechsten Augmentation die
 *    uebrigen Staedte, und in Ishima sitzt Tian Di Hui mit S.N.A.
 *  - die laufende Faktionsarbeit nicht antasten. Sie ist ueber Nacht die
 *    einzige Reputationsquelle und laesst sich ohne echten Mausklick nicht
 *    wieder in Gang setzen - der Knopf dafuer prueft die Echtheit des Klicks.
 *
 * Injektion: der gesamte Inhalt als ein Ausdruck. Mehrfaches Einspielen ist
 * unschaedlich - ein vorhandener Taktgeber wird abgeraeumt, Journal und
 * Erledigtliste werden uebernommen.
 */
() => {
  if (!document.title.startsWith("Bitburner")) return { fehler: "falscher Tab: " + document.title };
  const alt = window.__nightshift;
  if (alt && alt.timer) clearInterval(alt.timer);

  // Faktionsserver, die einen Backdoor lohnen, mit noetigem Hacking-Level und
  // vollstaendigem Weg ab home. Die Wege stammen aus path.js, nicht aus dem
  // Kopf - das Netz ist je Spielstand anders verdrahtet.
  const TARGETS = [
    {
      host: "I.I.I.I", level: 340, faction: "The Black Hand",
      path: ["harakiri-sushi", "CSEC", "omega-net", "computek", "I.I.I.I"],
    },
    {
      host: "run4theh111z", level: 505, faction: "BitRunners",
      path: ["harakiri-sushi", "CSEC", "silver-helix", "johnson-ortho", "summit-uni", "aevum-police",
        "galactic-cyber", "deltaone", "icarus", "taiyang-digital", "run4theh111z"],
    },
    {
      host: "The-Cave", level: 925, faction: "Daedalus",
      path: ["harakiri-sushi", "CSEC", "silver-helix", "johnson-ortho", "summit-uni", "aevum-police",
        "galactic-cyber", "deltaone", "icarus", "taiyang-digital", "run4theh111z", "helios",
        "4sigma", "blade", "The-Cave"],
    },
  ];

  // Stadtfaktionen liegen lassen.
  const AVOID = ["Sector-12", "Aevum", "Chongqing", "New Tokyo", "Ishima", "Volhaven"];
  const schlaf = (ms) => new Promise((ok) => setTimeout(ok, ms));

  const N = {
    round: 0,
    busy: false,
    started: Date.now(),
    done: (alt && alt.done) || [],
    journal: (alt && alt.journal) || [],
    timer: null,
    wiederbelebt: 0,

    note(text) {
      const t = new Date();
      this.journal.push(String(t.getHours()).padStart(2, "0") + ":" + String(t.getMinutes()).padStart(2, "0") + "  " + text);
      if (this.journal.length > 400) this.journal.shift();
    },

    /** Bildschirm ueber die linke Navigationsleiste wechseln. */
    go(name) {
      const el = [...document.querySelectorAll("[role='button']")].find((e) => {
        const t = (e.innerText || "").replace(/\s+/g, " ").trim();
        return t === name || t.endsWith(" " + name);
      });
      if (!el) return false;
      el.click();
      return true;
    },

    /** Der native Setter ist noetig, weil React eine schlichte Wertzuweisung
     *  am Eingabefeld nicht mitbekommt. */
    terminal(befehl) {
      const el = document.getElementById("terminal-input");
      if (!el) return false;
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, befehl);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
      return true;
    },

    /** Terminal sicher oeffnen. Das Spiel wechselt gelegentlich von sich aus
     *  den Bildschirm - blind zu tippen ginge dann ins Leere. */
    async amTerminal() {
      if (document.getElementById("terminal-input")) return true;
      this.go("Terminal");
      await schlaf(900);
      return !!document.getElementById("terminal-input");
    },

    async befehle(liste, pause) {
      for (const b of liste) { this.terminal(b); await schlaf(pause || 700); }
    },

    lines() { return [...document.querySelectorAll("#terminal li, #terminal p")].map((e) => e.innerText); },
    text() { return ((document.getElementById("root") || {}).innerText || "").replace(/\s+/g, " "); },

    hacking() { const m = this.text().match(/Hack (\d+)/); return m ? Number(m[1]) : null; },

    money() {
      const m = this.text().match(/Money \$([\d.]+)([kmbt])?/i);
      return m ? Number(m[1]) * ({ k: 1e3, m: 1e6, b: 1e9, t: 1e12 }[(m[2] || "").toLowerCase()] || 1) : null;
    },

    working() {
      const m = this.text().match(/Working for ([\w\-. ]+?) ([\d.]+k?) rep/);
      return m ? { faction: m[1].trim(), rep: m[2] } : null;
    },

    /** Das Einladungs-Popup prueft die Echtheit des Klicks nicht, der
     *  Join-Knopf auf der Faktionsseite dagegen schon. */
    handleInvite() {
      const dlg = document.querySelector("[role='dialog']");
      if (!dlg) return;
      const text = (dlg.innerText || "").replace(/\s+/g, " ");
      if (!/invit/i.test(text)) return;
      const stadt = AVOID.find((f) => text.includes(f));
      if (stadt) { this.note("Einladung von " + stadt + " liegen gelassen (Stadtfaktion)"); return; }
      const join = [...dlg.querySelectorAll("button,[role='button']")].find((b) => /^join/i.test((b.innerText || "").trim()));
      if (join) { join.click(); this.note("Einladung angenommen: " + text.slice(0, 60)); }
    },

    /** Nur Knoepfe anfassen, die eindeutig ein Skriptfenster schliessen. Ein zu
     *  weiter Griff wuerde nachts blind in der Oberflaeche herumklicken. */
    tidy() {
      for (const b of document.querySelectorAll("button[aria-label='Close window']")) {
        const kasten = b.closest("div");
        if (kasten && /Autopilot|invest/i.test(kasten.innerText || "")) b.click();
      }
    },

    /** Halten sich Autopilot und Verwalter gegenseitig am Leben? Faellt der
     *  Verwalter, bleibt der Autopilot auf einer veralteten Fassung stehen und
     *  niemand kauft mehr Speicher - das kostet ueber Nacht alles. Genau das
     *  ist am 19.08. einmal passiert. */
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
        this.note("Verwalter war tot - neu ausgeliefert und gestartet");
      }
      await this.befehle(["home"], 400);
    },

    /** Backdoor auf dem naechsten erreichbaren Faktionsserver. */
    async backdoor() {
      const lvl = this.hacking();
      if (!lvl) return;
      const ziel = TARGETS.find((t) => !this.done.includes(t.host) && lvl >= t.level);
      if (!ziel) return;

      this.busy = true;
      this.note("Backdoor auf " + ziel.host + " - Level " + lvl + " reicht fuer " + ziel.level);
      if (!(await this.amTerminal())) { this.busy = false; this.note("Terminal zu - Backdoor verschoben"); return; }

      await this.befehle(["home", ...ziel.path.map((h) => "connect " + h)], 600);
      if (!(this.lines().slice(-1)[0] || "").includes(ziel.host)) {
        this.note("Weg zu " + ziel.host + " abgebrochen bei: " + (this.lines().slice(-1)[0] || "").slice(0, 60));
        await this.befehle(["home"]);
        this.busy = false;
        return;
      }

      this.terminal("backdoor");
      // Der Fortschrittsbalken braucht je nach Level bis zu einigen Minuten.
      for (let i = 0; i < 60; i++) {
        await schlaf(5000);
        const txt = this.lines().slice(-3).join(" ");
        if (/successful/i.test(txt)) {
          this.done.push(ziel.host);
          this.note("Backdoor auf " + ziel.host + " gesetzt - " + ziel.faction + " sollte einladen");
          break;
        }
        if (/cannot|denied|not have enough/i.test(txt)) {
          this.done.push(ziel.host); // nicht endlos wiederholen
          this.note("Backdoor auf " + ziel.host + " abgelehnt: " + txt.slice(0, 70));
          break;
        }
      }
      await this.befehle(["home"]);
      this.busy = false;
    },

    async tick() {
      if (!document.title.startsWith("Bitburner")) return;
      this.round++;
      try {
        this.handleInvite();
        this.tidy();
        if (this.busy) return;
        if (this.round % 10 === 0) { this.busy = true; await this.keepAlive(); this.busy = false; }
        await this.backdoor();
        if (this.round % 20 === 1) {
          const w = this.working();
          this.note("Lage: Hacking " + this.hacking() + ", Geld " + Math.round((this.money() || 0) / 1e6) + "m"
            + (w ? ", Arbeit fuer " + w.faction + " bei " + w.rep + " rep" : ", KEINE Faktionsarbeit mehr"));
        }
      } catch (e) {
        this.busy = false;
        this.note("Fehler in Runde " + this.round + ": " + (e && e.message));
      }
    },

    bericht() {
      return {
        laufzeit: Math.round((Date.now() - this.started) / 60000) + " min",
        runde: this.round,
        erledigt: this.done,
        wiederbelebt: this.wiederbelebt,
        hacking: this.hacking(),
        geld: this.money(),
        arbeit: this.working(),
        journal: this.journal.slice(-40),
      };
    },
  };

  N.note("Nachtdienst angetreten (mit Lebenswache)");
  N.timer = setInterval(() => N.tick(), 30000);
  window.__nightshift = N;
  return { bereit: true, hacking: N.hacking(), geld: N.money(), arbeit: N.working(), takt: "30s, Lebenswache alle 5 min" };
}
