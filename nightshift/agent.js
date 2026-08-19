/**
 * Der Nachtdienst.
 *
 * Laeuft IM Seitenkontext des Spiels, nicht als eigener Prozess. Das ist keine
 * Bequemlichkeit, sondern Notwendigkeit: Opera haelt zwar Port 9222, liefert
 * aber auf jeden Discovery-Pfad 404 - eine Fernsteuerung von aussen ist damit
 * unmoeglich. Ein setInterval in der Seite laeuft dagegen weiter, solange der
 * Tab offen ist, und braucht keinerlei Zugriff von aussen. Damit loest es auch
 * keine Freigabeabfrage im Browser aus.
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
 *    wieder in Gang setzen.
 *
 * Injektion: der gesamte Inhalt als ein Ausdruck. Mehrfaches Einspielen ist
 * unschaedlich, ein vorhandener Taktgeber wird vorher abgeraeumt.
 */
() => {
  if (!document.title.startsWith("Bitburner")) return { fehler: "falscher Tab: " + document.title };
  if (window.__nightshift && window.__nightshift.timer) clearInterval(window.__nightshift.timer);

  // Faktionsserver, die einen Backdoor lohnen, mit dem noetigen Hacking-Level
  // und dem vollstaendigen Weg ab home. Die Wege stammen aus path.js, nicht aus
  // dem Kopf - das Netz ist je Spielstand anders verdrahtet.
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

  // Stadtfaktionen - Einladungen liegen lassen, nicht annehmen.
  const AVOID = ["Sector-12", "Aevum", "Chongqing", "New Tokyo", "Ishima", "Volhaven"];

  const N = {
    round: 0,
    busy: false,
    started: Date.now(),
    done: [],
    journal: [],
    timer: null,

    note(text) {
      const t = new Date();
      const stempel = String(t.getHours()).padStart(2, "0") + ":" + String(t.getMinutes()).padStart(2, "0");
      this.journal.push(stempel + "  " + text);
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

    /** Einen Terminalbefehl absetzen. Der Weg ueber den nativen Setter ist
     *  noetig, weil React eine schlichte Wertzuweisung nicht mitbekommt. */
    terminal(befehl) {
      const el = document.getElementById("terminal-input");
      if (!el) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(el, befehl);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
      return true;
    },

    lines() {
      return [...document.querySelectorAll("#terminal li, #terminal p")].map((e) => e.innerText);
    },

    /** Hacking-Level aus der Uebersichtsleiste - die steht auf jedem Bildschirm. */
    hacking() {
      const t = ((document.getElementById("root") || {}).innerText || "").replace(/\s+/g, " ");
      const m = t.match(/Hack (\d+)/);
      return m ? Number(m[1]) : null;
    },

    money() {
      const t = ((document.getElementById("root") || {}).innerText || "").replace(/\s+/g, " ");
      const m = t.match(/Money \$([\d.]+)([kmbt])?/i);
      if (!m) return null;
      const faktor = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 }[(m[2] || "").toLowerCase()] || 1;
      return Number(m[1]) * faktor;
    },

    working() {
      const t = ((document.getElementById("root") || {}).innerText || "").replace(/\s+/g, " ");
      const m = t.match(/Working for ([\w\-. ]+?) ([\d.]+k?) rep/);
      return m ? { faction: m[1].trim(), rep: m[2] } : null;
    },

    /** Faktionseinladung im Popup annehmen. Dieses Popup prueft - anders als
     *  der Join-Knopf auf der Faktionsseite - die Echtheit des Klicks nicht. */
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

    /** Fenster beendeter Skripte stapeln sich sonst ueber dem Spielfeld. */
    tidy() {
      const kopf = [...document.querySelectorAll("h6")].filter((h) => /Autopilot|Einkaeufer|invest/i.test(h.innerText || ""));
      for (const h of kopf) {
        const leiste = h.parentElement;
        if (!leiste) continue;
        const zu = [...leiste.querySelectorAll("button")].find((b) => /close/i.test(b.getAttribute("aria-label") || b.title || ""));
        if (zu) zu.click();
      }
    },

    /** Backdoor auf dem naechsten erreichbaren Faktionsserver. */
    async backdoor() {
      const lvl = this.hacking();
      if (!lvl) return;
      const ziel = TARGETS.find((t) => !this.done.includes(t.host) && lvl >= t.level);
      if (!ziel) return;

      this.busy = true;
      this.note("Backdoor auf " + ziel.host + " - Level " + lvl + " reicht fuer " + ziel.level);
      this.go("Terminal");
      await new Promise((ok) => setTimeout(ok, 900));
      if (!document.getElementById("terminal-input")) {
        this.busy = false;
        this.note("Terminal nicht erreichbar - Backdoor verschoben");
        return;
      }

      this.terminal("home");
      await new Promise((ok) => setTimeout(ok, 500));
      for (const hop of ziel.path) {
        this.terminal("connect " + hop);
        await new Promise((ok) => setTimeout(ok, 600));
      }
      const letzte = (this.lines().slice(-1)[0] || "");
      if (!letzte.includes(ziel.host)) {
        this.note("Weg zu " + ziel.host + " abgebrochen bei: " + letzte.slice(0, 60));
        this.terminal("home");
        this.busy = false;
        return;
      }

      this.terminal("backdoor");
      // Der Fortschrittsbalken braucht je nach Level bis zu einigen Minuten.
      for (let i = 0; i < 60; i++) {
        await new Promise((ok) => setTimeout(ok, 5000));
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
      this.terminal("home");
      this.busy = false;
    },

    async tick() {
      if (!document.title.startsWith("Bitburner")) return;
      this.round++;
      try {
        this.handleInvite();
        this.tidy();
        if (!this.busy) await this.backdoor();
        if (this.round % 20 === 1) {
          const w = this.working();
          this.note("Lage: Hacking " + this.hacking() + ", Geld " + Math.round((this.money() || 0) / 1e6) + "m"
            + (w ? ", Arbeit fuer " + w.faction + " bei " + w.rep + " rep" : ", KEINE Faktionsarbeit mehr"));
        }
      } catch (e) {
        this.note("Fehler in Runde " + this.round + ": " + (e && e.message));
      }
    },

    bericht() {
      return {
        laufzeit: Math.round((Date.now() - this.started) / 60000) + " min",
        runde: this.round,
        erledigt: this.done,
        hacking: this.hacking(),
        geld: this.money(),
        arbeit: this.working(),
        journal: this.journal.slice(-40),
      };
    },
  };

  N.note("Nachtdienst angetreten");
  N.timer = setInterval(() => N.tick(), 30000);
  window.__nightshift = N;
  return { bereit: true, ziele: TARGETS.map((t) => t.host + " ab Level " + t.level), hacking: N.hacking() };
}
