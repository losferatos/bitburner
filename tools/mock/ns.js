/**
 * Ein ns-Mock fuer Ebene 2 - genug Spiel, um Gewerke ohne Browser zu fahren.
 *
 * ===========================================================================
 * WOZU
 * ===========================================================================
 *
 * Ebene 0 prueft reine Funktionen, Ebene 3 den echten Prüfstand mit Browser.
 * Dazwischen fehlte alles: der Motorzeit-Einbau in `bn4net.js`, die
 * Registry-Aufloesung, der Strafleiter-Automat. Alle drei stehen als offene
 * Luecken in `tools/test-alles.js`, und Stufe A verlangt eine leere Liste.
 *
 * ===========================================================================
 * DIE UHR IST DER PUNKT
 * ===========================================================================
 *
 * Ein Mock, der nur Funktionen nachbaut, spart Tipparbeit. Wertvoll wird er
 * erst durch die STEUERBARE ZEIT: `mock.vor(8 * 3600000)` laesst acht Stunden
 * vergehen, ohne acht Stunden zu warten. Damit lassen sich genau die Faelle
 * pruefen, die im echten Betrieb Tage brauchen und deshalb nie geprueft
 * werden - eine Offline-Nacht, ein gedrosselter Tab, ein Nachholklumpen.
 *
 * Und beide Uhren laufen getrennt: `wall` (Date.now) und `playtime`
 * (totalPlaytime). Genau ihr Auseinanderlaufen ist der Fall, den die Motorzeit
 * erkennen muss - eine Nacht mit ausgeschaltetem Rechner bewegt beide, ein
 * Nachholklumpen nur eine.
 *
 * ===========================================================================
 * WAS ER NICHT IST
 * ===========================================================================
 *
 * Keine Nachbildung der Spiellogik. Er rechnet nicht, wie schnell ein Server
 * waechst, und er kennt keine Bladeburner-Wahrscheinlichkeiten. Er bildet die
 * SCHNITTSTELLE nach, damit Code laeuft - was der Code daraus macht, ist der
 * Prueflingsgegenstand.
 *
 * Wo er raet, sagt er es: jede nicht implementierte Funktion wirft mit einer
 * Meldung, die den Namen nennt. Ein stiller `undefined`-Rueckgabewert waere
 * schlimmer als ein Fehler - er faelscht das Ergebnis, statt es zu verhindern.
 */

// DER SPEICHER KOSTET JETZT ETWAS (Skeptiker Runde 3, W5, 04.09.2026).
//
// Bis hierher gab `getScriptRam` jedem Skript pauschal 2,4 GB zurueck, und
// `exec` buchte gar nichts ab. Damit prueften alle Ebene-2-Tests eine Welt, in
// der Speicher unbegrenzt ist - ausgerechnet die Tests zur Platzreservierung
// und zur Verdraengung, deren ganzer Gegenstand die Knappheit ist. Der Zweig,
// um den es ging, war praktisch unerreichbar.
//
// Die Zahlen kommen aus derselben Registry, die auch der Kern liest. Ein
// zweiter Ort fuer dieselbe Tabelle liefe unweigerlich auseinander, und die
// Registry ist ihrerseits aus ARCHITEKTUR.md erzeugt und gegen tools/ram.js
// geeicht.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MOCK_HIER = path.dirname(fileURLToPath(import.meta.url));
const RAM_TABELLE = (() => {
  const t = Object.create(null);
  for (const kandidat of [
    path.resolve(MOCK_HIER, "..", "..", "..", "bitburner-bau", "src", "registry.json"),
    path.resolve(MOCK_HIER, "..", "..", "src", "registry.json"),
  ]) {
    if (!fs.existsSync(kandidat)) continue;
    try {
      const reg = JSON.parse(fs.readFileSync(kandidat, "utf8"));
      // DER SF4-FAKTOR GEHOERT DAZU. `ramSingGb` ist der Preis bei SF4.3;
      // bei SF4.1 - dem Stand dieses Spielstands - kostet die
      // Singularity-Familie das SECHZEHNFACHE (`SF4Cost` in
      // `RamCostGenerator.ts`). Wer ihn weglaesst, misst bn4life.js mit
      // 23,85 GB statt 293,85 und haelt ein 32-GB-home fuer geraeumig.
      const SF4 = 16;
      for (const e of reg.eintraege || []) {
        if (Number.isFinite(e.ramBaseGb)) {
          t[e.name] = e.ramBaseGb + SF4 * (Number.isFinite(e.ramSingGb) ? e.ramSingGb : 0);
        }
      }
      break;
    } catch { /* dann die naechste Quelle */ }
  }
  // Was nicht in der Registry steht, weil es kein Gewerk ist. Gemessen mit
  // tools/ram.js am 04.09.2026.
  t["worker/weaken.js"] = 1.8;
  t["worker/grow.js"] = 1.8;
  t["worker/hack.js"] = 1.75;
  t["boot.js"] = 5.5;
  t["graft.js"] = 17.15;
  return t;
})();

/** Was ein Skript belegt - Registry zuerst, dann der Testwert, dann pauschal. */
function ramFuer(datei, eigene) {
  if (eigene && Number.isFinite(eigene[datei])) return eigene[datei];
  if (Number.isFinite(RAM_TABELLE[datei])) return RAM_TABELLE[datei];
  // Unbekannt heisst hier ausdruecklich "klein": ein Testskript, das die
  // Registry nicht kennt, soll nicht am Speicher scheitern. Wer Knappheit
  // pruefen will, nennt die Zahl in `skriptRam`.
  return 2.4;
}

/**
 * @param {object} o Startzustand
 * @param {string} o.host Rechner, auf dem das Skript laeuft
 * @param {number} o.wall Startzeit der Wanduhr
 * @param {number} o.playtime Start von totalPlaytime
 * @param {object} o.dateien {host: {pfad: inhalt}} - "home" wird immer angelegt
 * @param {object} o.server {name: {ram, used, root, geld, cores}}
 */
export function neuerMock(o = {}) {
  const zustand = {
    host: o.host || "home",
    wall: Number.isFinite(o.wall) ? o.wall : 1_700_000_000_000,
    playtime: Number.isFinite(o.playtime) ? o.playtime : 100 * 3600000,
    dateien: { home: {}, ...(o.dateien || {}) },
    server: {
      home: { ram: 32, used: 0, root: true, geld: 0, cores: 1, ports: 0, hackLevel: 1 },
      ...(o.server || {}),
    },
    // Grafting-Zustand, den der Test steuert.
    // Abgelehnte exec-Aufrufe (kein Platz) - fuer Tests, die genau das pruefen.
    abgelehnt: [],
    // Ausschalter fuer die Speicherbuchhaltung. Vorgabe ist AN; wer einen
    // Aspekt ohne Knappheit pruefen will, sagt es ausdruecklich.
    ramBuchen: o.ramBuchen !== false,
    // Hat sich das Skript per `ns.exit()` selbst beendet? (Testbefund 5)
    beendetSich: false,
    graftbar: o.graftbar || [],
    graftPreise: o.graftPreise || {},
    graftDauern: o.graftDauern || {},
    arbeit: o.arbeit || null,
    prozesse: [],          // {pid, filename, host, threads, args}
    naechstePid: 1,
    log: [],
    ausgabe: [],
    // Was das Skript getan hat - fuer Zusicherungen im Test.
    getoetet: [],
    gestartet: [],
    geschrieben: [],
    schlafZeiten: [],
    resetInfo: {
      lastNodeReset: Number.isFinite(o.nodeReset) ? o.nodeReset : 0,
      lastAugReset: Number.isFinite(o.augReset) ? o.augReset : 0,
      currentNode: Number.isFinite(o.knoten) ? o.knoten : 10,
      ownedSF: o.ownedSF || new Map(),
    },
    spieler: {
      totalPlaytime: Number.isFinite(o.playtime) ? o.playtime : 100 * 3600000,
      skills: { hacking: 100, strength: 100, defense: 100, dexterity: 100, agility: 100 },
      hp: { current: 100, max: 100 },
      exp: { hacking: 1000 },
      money: Number.isFinite(o.geld) ? o.geld : 1e6,
    },
  };
  if (!zustand.dateien[zustand.host]) zustand.dateien[zustand.host] = {};

  /** Laesst Zeit vergehen. Beide Uhren, oder gezielt nur eine. */
  const vor = (wallMs, playtimeMs = null) => {
    zustand.wall += wallMs;
    const p = playtimeMs === null ? wallMs : playtimeMs;
    zustand.playtime += p;
    zustand.spieler.totalPlaytime = zustand.playtime;
    return zustand.wall;
  };

  /**
   * Eine Offline-Nacht: der Rechner war aus. Beide Uhren springen - die
   * Engine rechnet die verstrichene Zeit nach und bucht sie auf totalPlaytime.
   */
  const offlineNacht = (stunden = 8) => vor(stunden * 3600000, stunden * 3600000);

  /**
   * Ein Nachholklumpen: die Engine verarbeitet Rueckstand in EINER Runde. Die
   * Wanduhr zeigt Sekunden, die Spielzeit springt um Stunden. Das ist keine
   * Arbeit des Bots, sondern Buchhaltung des Spiels.
   */
  const nachholklumpen = (stunden = 8, taktMs = 10000) => vor(taktMs, stunden * 3600000);

  /** Speicher eines beendeten Prozesses zurueckgeben. */
  const frei = (p) => {
    if (zustand.ramBuchen === false) return;
    const srv = zustand.server[p.host];
    if (srv && Number.isFinite(p.gb)) srv.used = Math.max(0, srv.used - p.gb);
  };

  const dateiHost = (h) => {
    if (!zustand.dateien[h]) zustand.dateien[h] = {};
    return zustand.dateien[h];
  };

  const nichtGebaut = (name) => {
    throw new Error("ns." + name + " ist im Mock nicht gebaut. " +
      "Entweder nachruesten oder den Test anders schneiden - ein stiller " +
      "undefined-Rueckgabewert faelscht das Ergebnis.");
  };

  const ns = {
    // --- Dateien ------------------------------------------------------------
    //
    // DIE ASYMMETRIE IST ABSICHT UND WICHTIG: `fileExists` nimmt einen Host,
    // `ns.read` NICHT - es liest immer vom Rechner des laufenden Skripts
    // (NetscriptFunctions.ts:1120-1122). Genau daran waere der Interlock am
    // 04.09.2026 fast gescheitert. Ein Mock, der das glaettet, versteckt die
    // Falle, statt sie zu zeigen.
    fileExists: (datei, host) => datei in dateiHost(host || zustand.host),
    read: (datei) => dateiHost(zustand.host)[datei] ?? "",
    write: (datei, inhalt, modus = "a") => {
      const d = dateiHost(zustand.host);
      d[datei] = modus === "w" ? String(inhalt) : (d[datei] || "") + String(inhalt);
      zustand.geschrieben.push({ datei, host: zustand.host, wall: zustand.wall });
    },
    rm: (datei, host) => {
      const d = dateiHost(host || zustand.host);
      if (!(datei in d)) return false;
      delete d[datei];
      return true;
    },
    scp: (dateien, ziel, quelle) => {
      const liste = Array.isArray(dateien) ? dateien : [dateien];
      const q = dateiHost(quelle || zustand.host);
      const z = dateiHost(ziel);
      let alle = true;
      for (const f of liste) {
        if (!(f in q)) { alle = false; continue; }
        z[f] = q[f];
      }
      return alle;   // false bei Teilausfall - wie im Spiel
    },
    ls: (host) => Object.keys(dateiHost(host || zustand.host)),

    // --- Prozesse -----------------------------------------------------------
    ps: (host) => zustand.prozesse.filter((p) => p.host === (host || zustand.host))
      .map((p) => ({ ...p })),
    exec: (datei, host, threads = 1, ...args) => {
      if (!(datei in dateiHost(host))) return 0;
      // KEIN PLATZ, KEIN START - wie im Spiel (`NetscriptFunctions.ts`, exec
      // gibt 0 zurueck). Vorher gab der Mock hier immer eine PID aus, und
      // jeder Test lief in einer Welt ohne Speichergrenze.
      const srv = zustand.server[host];
      const gb = ramFuer(datei, o.skriptRam) * Math.max(1, threads);
      if (!srv) return 0;
      // OHNE ROOT LAEUFT NICHTS (Skeptiker Runde 4, Testbefund 8, 04.09.2026).
      //
      // Das Spiel bricht vor allem anderen ab: `NetscriptWorker.ts:280`
      // (`if (!server.hasAdminRights) -> {success: false}`), und
      // `runScriptFromScript` gibt dann 0 zurueck (:324-327). Der Mock prueft
      // hier nur Datei und Speicher - und ist damit genau an der Stelle zu
      // gutmuetig, an der die Arbeiterverteilung entschieden wird. Ein Kern,
      // der Arbeiter auf nicht gerootete Wirte legt, saehe im Test wie ein
      // Erfolg aus.
      if (srv.root === false) {
        zustand.abgelehnt.push({ datei, host, gb, grund: "kein Root", wall: zustand.wall });
        return 0;
      }
      if (zustand.ramBuchen !== false && srv.used + gb > srv.ram + 1e-9) {
        zustand.abgelehnt.push({ datei, host, gb, frei: srv.ram - srv.used, wall: zustand.wall });
        return 0;
      }
      if (zustand.ramBuchen !== false) srv.used += gb;
      const pid = zustand.naechstePid++;
      zustand.prozesse.push({ pid, filename: datei, host, threads, args, gb });
      zustand.gestartet.push({ datei, host, threads, args, wall: zustand.wall });
      return pid;
    },
    kill: (pid) => {
      const i = zustand.prozesse.findIndex((p) => p.pid === pid);
      if (i === -1) return false;
      frei(zustand.prozesse[i]);
      zustand.getoetet.push({ ...zustand.prozesse[i], wall: zustand.wall });
      zustand.prozesse.splice(i, 1);
      return true;
    },
    scriptRunning: (datei, host) =>
      zustand.prozesse.some((p) => p.filename === datei && p.host === host),
    isRunning: (was, host, ...args) => {
      // Zwei Aufrufformen wie im Spiel: per PID oder per Dateiname.
      if (typeof was === "number") return zustand.prozesse.some((p) => p.pid === was);
      return zustand.prozesse.some((p) => p.filename === was &&
        (host === undefined || p.host === host) &&
        (args.length === 0 || args.every((a, i) => String(p.args[i]) === String(a))));
    },
    getRunningScript: () => null,
    getScriptRam: (datei, host) =>
      (datei in dateiHost(host || "home") ? ramFuer(datei, o.skriptRam) : 0),
    getScriptIncome: () => 0,
    getScriptExpGain: () => 0,
    // DREI FUNKTIONEN, DIE DER KERN AUFRUFT UND DER MOCK NICHT KANNTE
    // (Skeptiker Runde 4, Testbefund 5, 04.09.2026).
    //
    // `ns.scriptKill` hat acht Aufrufstellen in bn4net.js, `ns.exit` eine, und
    // `ns.share` gehoert zur Arbeitermischung. Unbekannte Top-Level-Namen sind
    // hier schlicht `undefined` (der `nichtGebaut`-Wurf deckt nur die
    // Namensraeume singularity/bladeburner/hacknet/formulas ab) - alle
    // Ebene-2-Tests waren gruen, WEIL diese Pfade nie betreten wurden.
    //
    // Betroffen waren ausgerechnet der Werkzeug-Neustart (das ist Sprosse 1
    // der Strafleiter) und der Selbstbeender fuer den Hot-Swap, also die
    // Mechanik, an der Auftrag 9 haengt.
    //
    // `scriptKill` gibt `false` zurueck, wenn nichts lief
    // (NetscriptFunctions.ts:1198-1215) - nicht `0`, nicht einen Wurf.
    scriptKill: (datei, host) => {
      const h = host || zustand.host;
      const bleibt = [];
      let getroffen = false;
      for (const p of zustand.prozesse) {
        if (p.host === h && p.filename === datei) {
          getroffen = true;
          frei(p);
          zustand.getoetet.push({ ...p, wall: zustand.wall });
        } else {
          bleibt.push(p);
        }
      }
      zustand.prozesse = bleibt;
      return getroffen;
    },

    // `ns.exit` beendet das Skript sofort. Im Mock heisst das: die Runde
    // abbrechen wie beim Schlafdeckel - der Test sieht `beendetSich`.
    exit: () => {
      zustand.beendetSich = true;
      const e = new Error("ns.exit()");
      e.mockAbbruch = true;
      throw e;
    },

    // `ns.share` laeuft im Spiel zehn Sekunden und kehrt dann zurueck. Der
    // Mock tut dasselbe wie `sleep`: er laesst die Zeit vergehen.
    share: async () => {
      await ns.sleep(10000);
      return 1;
    },

    killall: (host) => {
      const h = host || zustand.host;
      const bleibt = [];
      for (const p of zustand.prozesse) {
        if (p.host === h) { frei(p); zustand.getoetet.push({ ...p, wall: zustand.wall }); }
        else bleibt.push(p);
      }
      zustand.prozesse = bleibt;
      return true;
    },

    // --- Server -------------------------------------------------------------
    scan: (host) => Object.keys(zustand.server).filter((h) => h !== (host || zustand.host)),
    serverExists: (h) => h in zustand.server,
    hasRootAccess: (h) => !!(zustand.server[h] && zustand.server[h].root),
    getServerMaxRam: (h) => (zustand.server[h] ? zustand.server[h].ram : 0),
    getServerUsedRam: (h) => (zustand.server[h] ? zustand.server[h].used : 0),
    // `geld` im Mock-Aufruf setzt BEIDES: das Spielerkonto und das Guthaben
    // auf home. Im Spiel sind das dieselbe Zahl (Player.money), im Mock waren
    // es zwei - und ein Test, der `geld: 500e9` setzt und dann 0 misst, prueft
    // seine eigene Verdrahtung statt des Prueflings (04.09.2026).
    getServerMoneyAvailable: (h) => (h === "home"
      ? zustand.spieler.money
      : (zustand.server[h] ? zustand.server[h].geld : 0)),
    getServerRequiredHackingLevel: (h) => (zustand.server[h] ? zustand.server[h].hackLevel : 1),
    getServerNumPortsRequired: (h) => (zustand.server[h] ? zustand.server[h].ports : 0),
    getHostname: () => zustand.host,
    getServer: (h) => {
      const s = zustand.server[h || zustand.host];
      if (!s) return null;
      return {
        hostname: h || zustand.host,
        maxRam: s.ram, ramUsed: s.used, cpuCores: s.cores,
        hasAdminRights: !!s.root, backdoorInstalled: !!s.backdoor,
        moneyAvailable: s.geld, moneyMax: s.geldMax ?? s.geld * 4,
        hackDifficulty: s.sicherheit ?? 5, minDifficulty: s.sicherheitMin ?? 1,
        baseDifficulty: s.sicherheit ?? 5,
        requiredHackingSkill: s.hackLevel, numOpenPortsRequired: s.ports,
        openPortCount: s.root ? s.ports : 0,
        serverGrowth: s.wachstum ?? 50, purchasedByPlayer: (h || "").startsWith("werk-"),
      };
    },
    getServerSecurityLevel: (h) => (zustand.server[h] ? (zustand.server[h].sicherheit ?? 5) : 0),
    getServerMinSecurityLevel: (h) => (zustand.server[h] ? (zustand.server[h].sicherheitMin ?? 1) : 0),
    getServerMaxMoney: (h) => (zustand.server[h] ? (zustand.server[h].geldMax ?? zustand.server[h].geld * 4) : 0),
    getServerGrowth: (h) => (zustand.server[h] ? (zustand.server[h].wachstum ?? 50) : 0),
    getPurchasedServers: () => Object.keys(zustand.server).filter((h) => h.startsWith("werk-")),
    nuke: (h) => { if (zustand.server[h]) zustand.server[h].root = true; return true; },
    brutessh: () => true, ftpcrack: () => true, relaysmtp: () => true,
    httpworm: () => true, sqlinject: () => true,
    hackAnalyze: () => 0.01,
    hackAnalyzeChance: () => 0.8,
    growthAnalyze: () => 10,
    weakenAnalyze: (n) => 0.05 * n,
    getHackTime: () => 5000,
    getGrowTime: () => 15000,
    getWeakenTime: () => 20000,

    // --- Spieler und Zeit ---------------------------------------------------
    getPlayer: () => ({
      ...zustand.spieler,
      totalPlaytime: zustand.playtime,
      skills: { ...zustand.spieler.skills },
    }),
    getResetInfo: () => ({ ...zustand.resetInfo }),
    getHackingLevel: () => zustand.spieler.skills.hacking,

    /**
     * `sleep` laesst im Mock KEINE echte Zeit vergehen - der Test steuert die
     * Uhr selbst ueber `vor()` oder ueber `beiSchlaf`.
     *
     * ZUGLEICH IST ES DIE NOTBREMSE. Ein Gewerk laeuft in einer Endlosschleife;
     * ohne Abbruch liefe der Test ewig. Nach `maxSchlaf` Aufrufen wirft der
     * Mock einen benannten Fehler, den der Test faengt. Das ist der einzige
     * saubere Weg, eine `for(;;)`-Schleife von aussen anzuhalten, ohne den
     * Prueflingsgegenstand zu veraendern.
     */
    sleep: async (ms) => {
      zustand.schlafZeiten.push(ms);
      if (typeof o.beiSchlaf === "function") o.beiSchlaf(ms, zustand, vor);
      if (zustand.schlafZeiten.length >= (o.maxSchlaf ?? 100000)) {
        const e = new Error("MOCK_ABBRUCH");
        e.mockAbbruch = true;
        throw e;
      }
      return true;
    },
    asleep: async (ms) => { zustand.schlafZeiten.push(ms); return true; },

    // --- Ausgabe ------------------------------------------------------------
    print: (...t) => { zustand.log.push(t.join(" ")); },
    tprint: (...t) => { zustand.ausgabe.push(t.join(" ")); },
    printf: (...t) => { zustand.log.push(t.join(" ")); },
    disableLog: () => {},
    enableLog: () => {},
    clearLog: () => {},
    toast: () => {},

    // --- Mietrechner --------------------------------------------------------
    //
    // Genug, damit der Kern seinen Park verwalten kann. Die Preisformel ist
    // die echte (ServerPurchases.ts:23-42, Softcap 1,2) - ein Mock mit
    // Fantasiepreisen wuerde jede Kaufentscheidung falsch pruefen.
    cloud: {
      getServerNames: () => Object.keys(zustand.server).filter((h) => h.startsWith("werk-")),
      getServerLimit: () => (o.cloudLimit ?? 25),
      getRamLimit: () => (o.cloudRamLimit ?? 1048576),
      getServerCost: (gb) => {
        if (!Number.isFinite(gb) || gb <= 0) return Infinity;
        if ((gb & (gb - 1)) !== 0) return Infinity;          // keine Zweierpotenz
        if (gb > (o.cloudRamLimit ?? 1048576)) return Infinity;
        const basis = gb * 55000 * (o.knotenPreisFaktor ?? 5);
        return gb <= 262144 ? basis : basis * Math.pow(gb / 262144, 1.2);
      },
      purchaseServer: (name, gb) => {
        const eigene = Object.keys(zustand.server).filter((h) => h.startsWith("werk-"));
        if (eigene.length >= (o.cloudLimit ?? 25)) return "";
        const voll = "werk-" + name.replace(/^werk-/, "");
        zustand.server[voll] = { ram: gb, used: 0, root: true, geld: 0, cores: 1, ports: 0, hackLevel: 1 };
        zustand.dateien[voll] = {};
        return voll;
      },
      deleteServer: (name) => {
        if (!(name in zustand.server)) return false;
        delete zustand.server[name];
        delete zustand.dateien[name];
        return true;
      },
      upgradeServer: () => false,
    },

    // --- Grafting, so weit die Automatik es braucht ---------------------------
    //
    // NUR DIE DREI ABFRAGEN, NICHT DAS GRAFTEN SELBST. `graftauto.js`
    // entscheidet und startet `graft.js`; die Ausfuehrung liegt dort und
    // gehoert in Ebene 3. Was hier gebraucht wird, ist die Antwort auf "was
    // ist graftbar, was kostet es, wie lange dauert es".
    //
    // `getGraftableAugmentations` liefert im Spiel alles, was der Spieler noch
    // NICHT hat - einschliesslich der gekauften, noch nicht eingebauten
    // (Person.ts:233-241). Der Mock bildet das ab, indem der Test die Liste
    // direkt setzt: `o.graftbar`.
    grafting: {
      getGraftableAugmentations: () => {
        if (o.graftingZugriff === false) {
          throw new Error("You do not have grafting API access");
        }
        return [...(zustand.graftbar || [])];
      },
      getAugmentationGraftPrice: (n) => {
        const p = (zustand.graftPreise || {})[n];
        if (!Number.isFinite(p)) throw new Error("Invalid aug: " + n);
        return p;
      },
      getAugmentationGraftTime: (n) => {
        const t = (zustand.graftDauern || {})[n];
        if (!Number.isFinite(t)) throw new Error("Invalid aug: " + n);
        return t;
      },
    },

    // --- Was es im Mock nicht gibt ------------------------------------------
    singularity: new Proxy({
      // getCurrentWork ist die einzige Singularity-Abfrage, die ein Gewerk
      // ausser bn4rep braucht - und ohne sie liesse sich nicht pruefen, ob ein
      // Graft laeuft. Der Test setzt sie ueber `o.arbeit`.
      getCurrentWork: () => zustand.arbeit || null,
    }, {
      get: (ziel, n) => (n in ziel
        ? ziel[n]
        : () => nichtGebaut("singularity." + String(n))),
    }),
    bladeburner: new Proxy({}, { get: (_, n) => () => nichtGebaut("bladeburner." + String(n)) }),
    hacknet: new Proxy({}, { get: (_, n) => () => nichtGebaut("hacknet." + String(n)) }),
    formulas: new Proxy({}, { get: (_, n) => () => nichtGebaut("formulas." + String(n)) }),
    args: o.args || [],
  };

  /**
   * Stellt `Date.now()` auf die Mock-Uhr um - und gibt eine Funktion zurueck,
   * die das rueckgaengig macht.
   *
   * WARUM DAS SEIN MUSS: die Gewerke lesen die Wanduhr direkt ueber
   * `Date.now()`, nicht ueber `ns`. Ohne diesen Griff bewegt sich im Test die
   * Wanduhr gar nicht (der ganze Lauf dauert Millisekunden), waehrend die
   * Spielzeit springt - und die Motorzeit sieht in JEDER Runde einen
   * Nachholklumpen. Der erste Ebene-2-Lauf am 04.09.2026 meldete deshalb
   * "0,00 h aus 480 Runden", und das war ein Fehler des Pruefstands, nicht des
   * Kerns.
   *
   * Eine globale Mutation ist heikel; sie wird deshalb im `finally` des Tests
   * zurueckgenommen und beruehrt nur `Date.now`, nicht den Konstruktor.
   */
  const echteNow = Date.now;
  const uhrStellen = () => {
    Date.now = () => zustand.wall;
    return () => { Date.now = echteNow; };
  };

  return {
    ns,
    zustand,
    vor,
    offlineNacht,
    nachholklumpen,
    uhrStellen,
    /** Setzt einen Wert im Zustand - kuerzer als der Griff durch die Objekte. */
    setze: (pfad, wert) => {
      const teile = pfad.split(".");
      let z = zustand;
      for (let i = 0; i < teile.length - 1; i++) z = z[teile[i]];
      z[teile[teile.length - 1]] = wert;
    },
    /** Legt eine Datei auf einem Rechner ab. */
    lege: (host, datei, inhalt) => { dateiHost(host)[datei] = String(inhalt); },
    /** Liest eine Datei von einem beliebigen Rechner - fuer Zusicherungen. */
    lies: (host, datei) => dateiHost(host)[datei],
  };
}
