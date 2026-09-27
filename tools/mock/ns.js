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
    hacknet: {
      hashes: (o.hacknet || {}).hashes ?? 0,
      kapazitaet: (o.hacknet || {}).kapazitaet ?? 0,
      serverModus: (o.hacknet || {}).serverModus ?? true,
      stufen: { ...((o.hacknet || {}).stufen || {}) },
      ausgegeben: [],
      // Optional: einzelne Server {cache, ram, cores, level}. Sind sie
      // gesetzt, ergibt sich die Kapazitaet aus den Caches (32*2^c,
      // HacknetServer.ts:121-122) statt aus "kapazitaet" (23.09.2026).
      server: ((o.hacknet || {}).server || null),
      kaeufe: [],
    },
    resetInfo: {
      lastNodeReset: Number.isFinite(o.nodeReset) ? o.nodeReset : 0,
      lastAugReset: Number.isFinite(o.augReset) ? o.augReset : 0,
      currentNode: Number.isFinite(o.knoten) ? o.knoten : 10,
      ownedSF: o.ownedSF || new Map(),
    },
    /**
     * DIE KOERPER UND IHR RUECKSTAND (04.09.2026).
     *
     * `storedCycles` ist der Nachholklumpen: das Spiel legt jeden nicht
     * verarbeiteten Zyklus dort ab (`Sleeve.ts:267`) und arbeitet ihn mit
     * HOECHSTENS 15 je Aufruf wieder ab (`Sleeve.ts:269`). Bei 300 Zyklen in
     * einem Nachholschub sind das 5 Prozent - der Rest bleibt liegen.
     *
     * Warum das im Mock stehen MUSS: `sleeve.js` rechnet seinen Geldboden
     * genau daraus (`2.400 $/s x (storedCycles / 5 + Takt)`). Ohne das Feld
     * war der Nachholklumpen nur als Sprung der Spielzeit modelliert - also
     * als meine Vorstellung von dem, was storedCycles bewirkt, statt als das
     * Feld selbst. Auftrag 6.1 nennt es namentlich.
     *
     * 20 Zyklen je Sekunde Spielzeit (`MilliPerCycle = 200`, 5 je Sekunde
     * Echtzeit x 4 - nein: 1000/200 = 5 je Sekunde). Der Mock rechnet mit
     * `CyclesPerSecond = 5` wie das Spiel.
     */
    koerper: (o.koerper || []).map((k, i) => ({
      nr: i,
      storedCycles: Number.isFinite(k.storedCycles) ? k.storedCycles : 0,
      shock: Number.isFinite(k.shock) ? k.shock : 0,
      sync: Number.isFinite(k.sync) ? k.sync : 100,
      skills: k.skills || { strength: 10, defense: 10, dexterity: 10, agility: 10 },
      aufgabe: k.aufgabe || null,
    })),
    /**
     * DER SEED (Auftrag 6.1, namentlich gefordert).
     *
     * Alles Zufaellige im Mock kommt hierher. Ein Test, der einmal gruen und
     * einmal rot ist, weil sich eine Zufallszahl geaendert hat, ist kein
     * Test - und ein Fehler, der nur bei einem bestimmten Wurf auftritt,
     * laesst sich ohne Seed nicht nachstellen.
     *
     * mulberry32, dieselbe Funktion wie im Vertragsgenerator - damit beide
     * Pruefstandshaelften denselben Zufall sprechen.
     *
     * EHRLICH GESAGT: heute ist im Mock nichts zufaellig. Der Seed steht
     * trotzdem hier, und zwar mit einem Waechter (`test-sleeve-ebene2.js`
     * prueft, dass kein `Math.random` im Mock steht). Der Grund ist die
     * Reihenfolge: wer das erste zufaellige Verhalten einbaut, greift zum
     * naechstliegenden Werkzeug. Liegt der gesaete Zufall schon da und ist
     * `Math.random` verboten, wird es der richtige.
     */
    seed: Number.isFinite(o.seed) ? o.seed : 1,
    /** Rueckstand der Division in Millisekunden - siehe getBonusTime. */
    bonusMs: Number.isFinite(o.bonusMs) ? o.bonusMs : 0,
    /**
     * DIE DIVISION (04.09.2026).
     *
     * `blade.js` ist das Traegergewerk fuer 30 der 40 Laeufe und hatte keine
     * Ebene-2-Probe - der Namensraum warf schlicht "nicht gebaut". Das war die
     * groesste verbliebene Luecke des Pruefstands.
     *
     * Nachgebaut sind die 31 Funktionen, die `blade.js`, `bbtrain.js` und
     * `sleeve.js` wirklich rufen. Bewusst nicht mehr: ein Mock, der eine
     * Schnittstelle vollstaendig nachbaut statt der benutzten Teilmenge, wird
     * ein zweites Spiel mit eigenen Fehlern.
     *
     * Die Zahlen sind FREI WAEHLBAR und haben keine Spielmechanik dahinter -
     * der Mock rechnet keine Erfolgschancen aus Kampfwerten. Das ist Absicht:
     * geprueft wird die ENTSCHEIDUNG von blade.js (welche Aktion bei welcher
     * Lage), nicht die Formel des Spiels. Die Formeln haben ihren eigenen
     * Test, `tools/test-formeln.js`, gegen den Quelltext geeicht.
     */
    blade: {
      drin: o.blade ? o.blade.drin !== false : false,
      rang: (o.blade && Number.isFinite(o.blade.rang)) ? o.blade.rang : 0,
      punkte: (o.blade && Number.isFinite(o.blade.punkte)) ? o.blade.punkte : 0,
      ausdauer: (o.blade && o.blade.ausdauer) ? o.blade.ausdauer : [100, 100],
      stadt: (o.blade && o.blade.stadt) || "Sector-12",
      truppe: (o.blade && Number.isFinite(o.blade.truppe)) ? o.blade.truppe : 0,
      aktion: (o.blade && o.blade.aktion) || null,
      // Je Stadt: chaos, comms, pop.
      staedte: (o.blade && o.blade.staedte) || {},
      // Je "Typ/Name": vorrat, stufe, maxStufe, chance, dauer.
      aktionen: (o.blade && o.blade.aktionen) || {},
      fertigkeiten: (o.blade && o.blade.fertigkeiten) || {},
      blackOps: (o.blade && o.blade.blackOps) || [],
      gestartet: [],      // was blade.js gestartet hat - fuer Zusicherungen
      gekauft: [],        // welche Fertigkeiten es hochgezogen hat
      gereist: [],        // wohin es gereist ist
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

  /**
   * Der Zufall des Mocks - mulberry32, aus dem Seed.
   *
   * Er wird HIER erzeugt und nirgends sonst. Wer `Math.random` benutzt, macht
   * den Test unreproduzierbar, und ein Fehler, der nur bei einem bestimmten
   * Wurf auftritt, laesst sich dann nicht nachstellen.
   */
  /** Ein Aktionseintrag, immer ein Objekt - nie undefined. */
  const aktion = (typ, name) => zustand.blade.aktionen[typ + "/" + name] || {};

  let saat = zustand.seed >>> 0;
  const zufall = () => {
    saat = (saat + 0x6D2B79F5) >>> 0;
    let t = saat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  /** Laesst Zeit vergehen. Beide Uhren, oder gezielt nur eine. */
  const vor = (wallMs, playtimeMs = null) => {
    zustand.wall += wallMs;
    const p = playtimeMs === null ? wallMs : playtimeMs;
    /**
     * DER RUECKSTAND WAECHST UND SCHRUMPFT WIE IM SPIEL.
     *
     * Zugang: ein Zyklus je 200 ms Spielzeit (`CONSTANTS.MilliPerCycle`).
     * Abgang: hoechstens 15 je Verarbeitungsschritt, und ein Schritt findet
     * je Sekunde Spielzeit statt (`Sleeve.ts:263-275`).
     *
     * Das ergibt genau die Asymmetrie, um die es geht: eine Stunde
     * verdeckter Tab legt 18.000 Zyklen an, und die braucht der Koerper
     * 20 Minuten Spielzeit lang zum Abbau - nicht eine Sekunde.
     */
    if (zustand.koerper.length && p > 0) {
      const zugang = p / 200;
      const schritte = Math.floor(p / 1000);
      for (const k of zustand.koerper) {
        k.storedCycles += zugang;
        k.storedCycles = Math.max(0, k.storedCycles - schritte * 15);
      }
    }
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
      // GENAUE ARGUMENTLISTE, AUCH WENN LEER (27.09.2026, Audit G1).
      //
      // Hier stand `args.length === 0 || args.every(...)` - ohne Argumente
      // galt das als Treffer auf JEDEN laufenden Prozess mit passendem Namen
      // und Wirt, egal mit welchen Argumenten er lief. Das Spiel prueft anders
      // (NetscriptHelpers.tsx, scriptIdentifier: `_args === undefined ? [] :
      // ...` - keine Argumente heisst LEERE Liste, nicht "beliebig"). Ein
      // Skript, das mit einem Argument laeuft (`ns.exec("joinrun.js","home",
      // 1,80)`), wird von `ns.isRunning("joinrun.js","home")` im echten Spiel
      // NIE gefunden - genau der Fehler, den bn4life.js hatte (Audit G1: zwei
      // gleichzeitige joinrun.js-Prozesse auf home, belegt im Spielstand der
      // 09:08-Sicherung vom 27.09.2026). Ein Mock, der das glaettet, haette
      // diesen Fehler nie zeigen koennen.
      return zustand.prozesse.some((p) => p.filename === was &&
        (host === undefined || p.host === host) &&
        p.args.length === args.length &&
        args.every((a, i) => String(p.args[i]) === String(a)));
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
      /**
       * Beendet die laufende Arbeit der Figur. `bbtrain.js` ruft es vor dem
       * Beitritt, um die Gym-Arbeit zu beenden - und tut das ausdruecklich
       * NICHT, wenn gerade gegraftet wird (`Singularity.ts:562`:
       * `stopAction` ist `finishWork(true)` und wuerde den Graft toeten).
       */
      stopAction: () => { zustand.arbeit = null; zustand.gestoppt = true; return true; },
      /** Die Gym-Arbeit selbst - der Mock merkt sich nur, was gewaehlt wurde. */
      gymWorkout: (ort, stat) => {
        zustand.arbeit = { type: "CLASS", classType: stat, location: ort };
        return true;
      },
      travelToCity: (stadt) => { zustand.stadt = stadt; return true; },
    }, {
      get: (ziel, n) => (n in ziel
        ? ziel[n]
        : () => nichtGebaut("singularity." + String(n))),
    }),
    /**
     * DIE KOERPER. Fuenf Funktionen - genau die, die `src/sleeve.js` ruft.
     *
     * Bewusst NICHT mehr: ein Mock, der eine Schnittstelle vollstaendig
     * nachbaut, statt die benutzte Teilmenge, wird zu einem zweiten Spiel mit
     * eigenen Fehlern. Was fehlt, wirft - und faellt damit auf.
     */
    sleeve: {
      getNumSleeves: () => zustand.koerper.length,
      getSleeve: (i) => {
        const k = zustand.koerper[i];
        if (!k) return undefined;
        return {
          storedCycles: k.storedCycles,
          shock: k.shock,
          sync: k.sync,
          skills: { ...k.skills },
          hp: { current: 100, max: 100 },
          city: "Sector-12",
        };
      },
      getTask: (i) => (zustand.koerper[i] ? zustand.koerper[i].aufgabe : null),
      setToGymWorkout: (i, ort, stat) => {
        const k = zustand.koerper[i];
        if (!k) return false;
        k.aufgabe = { type: "CLASS", classType: stat, location: ort };
        return true;
      },
      setToCommitCrime: (i, was) => {
        const k = zustand.koerper[i];
        if (!k) return false;
        k.aufgabe = { type: "CRIME", crimeType: was };
        return true;
      },
      setToBladeburnerAction: (i, art, name) => {
        const k = zustand.koerper[i];
        if (!k) return false;
        // Wie im Spiel (NetscriptFunctions/Sleeve.ts:283-293, 22.09.2026 in
        // den Mock uebernommen): zwei Sleeves duerfen nicht denselben Vertrag
        // fahren - der Aufruf WIRFT.
        if (art === "Take on contracts") {
          for (const andere of zustand.koerper) {
            if (andere === k || !andere.aufgabe) continue;
            if (andere.aufgabe.type === "BLADEBURNER" && andere.aufgabe.actionName === name) {
              throw new Error("Sleeve " + i + " cannot take on contracts because Sleeve "
                + andere.nr + " is already performing that action.");
            }
          }
        }
        k.aufgabe = { type: "BLADEBURNER", actionType: art, actionName: name };
        return true;
      },
    },
    bladeburner: new Proxy({
      /**
       * Die Bladeburner-Eigenzeit. Sie ist die Uhr, in der `T2_h` und die
       * Vorratsdeckung gemessen werden (`lib/kpi.js`: "NICHT Motorzeit -
       * Delta getBonusTime()").
       *
       * Das Spiel legt nicht verarbeitete Zyklen in `storedCycles` ab
       * (`Bladeburner.ts:276`) und arbeitet HOECHSTENS 25 je Aufruf ab
       * (`Bladeburner.ts:1377-1380`: 5 Sekunden a 5 Zyklen). Bei 300 Zyklen
       * im Nachholschub sind das 8 Prozent.
       */
      getBonusTime: () => zustand.bonusMs,

      // --- Mitgliedschaft ---------------------------------------------------
      inBladeburner: () => zustand.blade.drin,
      joinBladeburnerDivision: () => {
        // Das Spiel verlangt 100 in allen vier Kampfwerten
        // (`Bladeburner.ts:1613-1620`). Der Mock prueft dieselbe Schwelle -
        // sonst koennte ein Test einen Beitritt zeigen, den es nicht gibt.
        const k = zustand.spieler.skills;
        if (Math.min(k.strength, k.defense, k.dexterity, k.agility) < 100) return false;
        zustand.blade.drin = true;
        return true;
      },

      // --- Zustand ----------------------------------------------------------
      getRank: () => zustand.blade.rang,
      getSkillPoints: () => zustand.blade.punkte,
      getStamina: () => [...zustand.blade.ausdauer],
      getCity: () => zustand.blade.stadt,
      getTeamSize: () => zustand.blade.truppe,
      setTeamSize: (typ, name, n) => { zustand.blade.truppe = n; return n; },
      switchCity: (stadt) => {
        zustand.blade.stadt = stadt;
        zustand.blade.gereist.push(stadt);
        return true;
      },
      nextUpdate: async () => { await ns.sleep(200); return 200; },

      // --- Staedte ----------------------------------------------------------
      getCityChaos: (stadt) => (zustand.blade.staedte[stadt] || {}).chaos ?? 0,
      getCityCommunities: (stadt) => (zustand.blade.staedte[stadt] || {}).comms ?? 0,
      getCityEstimatedPopulation: (stadt) => (zustand.blade.staedte[stadt] || {}).pop ?? 1e9,

      // --- Aktionen ---------------------------------------------------------
      getContractNames: () => ["Tracking", "Bounty Hunter", "Retirement"],
      getOperationNames: () => ["Investigation", "Undercover Operation",
        "Sting Operation", "Raid", "Stealth Retirement Operation", "Assassination"],
      getBlackOpNames: () => zustand.blade.blackOps.map((b) => b.name),
      getBlackOpRank: (name) => {
        const b = zustand.blade.blackOps.find((x) => x.name === name);
        return b ? b.rank : Infinity;
      },
      getNextBlackOp: () => {
        const b = zustand.blade.blackOps.find((x) => !x.erledigt);
        return b ? { name: b.name, rank: b.rank } : null;
      },
      getCurrentAction: () => (zustand.blade.aktion
        ? { type: zustand.blade.aktion.type, name: zustand.blade.aktion.name }
        : null),
      startAction: (typ, name) => {
        zustand.blade.aktion = { type: typ, name };
        zustand.blade.gestartet.push({ typ, name, wall: zustand.wall });
        return true;
      },
      stopBladeburnerAction: () => { zustand.blade.aktion = null; },

      getActionCountRemaining: (typ, name) => aktion(typ, name).vorrat ?? 0,
      getActionCurrentLevel: (typ, name) => aktion(typ, name).stufe ?? 1,
      getActionMaxLevel: (typ, name) => aktion(typ, name).maxStufe ?? 15,
      getActionTime: (typ, name) => aktion(typ, name).dauer ?? 30000,
      getActionCurrentTime: () => zustand.blade.aktionZeitMs ?? 0,
      /**
       * Das Spiel liefert hier fuer Black Ops einen BEREICH, dessen eine
       * Grenze mit `pop/popEst` verzerrt ist (`Actions/Action.ts:144-167`);
       * welche die wahre ist, laesst sich von aussen nicht sagen. Der Mock
       * gibt deshalb ebenfalls ein Paar zurueck - ein Gewerk, das die Spanne
       * ignoriert, faellt damit auf.
       */
      getActionEstimatedSuccessChance: (typ, name) => {
        const a = aktion(typ, name);
        const c = a.chance ?? 0.5;
        const spanne = a.spanne ?? 0;
        return [Math.max(0, c - spanne), Math.min(1, c + spanne)];
      },

      // --- Fertigkeiten -----------------------------------------------------
      getSkillNames: () => ["Blade's Intuition", "Cloak", "Short-Circuit",
        "Digital Observer", "Tracer", "Overclock", "Reaper", "Evasive System",
        "Datamancer", "Cyber's Edge", "Hands of Midas", "Hyperdrive"],
      getSkillLevel: (name) => zustand.blade.fertigkeiten[name] ?? 0,
      getSkillUpgradeCost: (name, n = 1) => {
        // Die echte Formel steht in `Skill.ts:70-75` und ist in
        // `tools/lib/formeln.js` nachgebaut und geeicht. Hier genuegt ein
        // monotoner Preis - geprueft wird, WELCHE Fertigkeit blade.js kauft,
        // nicht was sie kostet.
        const stufe = zustand.blade.fertigkeiten[name] ?? 0;
        return Math.round(n * (stufe + 1) * 3);
      },
      upgradeSkill: (name, n = 1) => {
        const kosten = n * ((zustand.blade.fertigkeiten[name] ?? 0) + 1) * 3;
        if (zustand.blade.punkte < kosten) return false;
        zustand.blade.punkte -= kosten;
        zustand.blade.fertigkeiten[name] = (zustand.blade.fertigkeiten[name] ?? 0) + n;
        zustand.blade.gekauft.push({ name, n });
        return true;
      },
    }, {
      get: (ziel, n) => (n in ziel
        ? ziel[n]
        : () => nichtGebaut("bladeburner." + String(n))),
    }),
    // HACKNET-SERVER UND HASHES (19.09.2026, fuer hashes.js).
    // Option `hacknet: { hashes, kapazitaet, serverModus, stufen }`. Preise
    // nach HashUpgrade.ts:72-81 (costPerLevel * (Stufe+1)), Sell for Money
    // konstant 4 (HashUpgradesMetadata.tsx:11). Ohne Option: kapazitaet 0,
    // maxNumNodes 20 (Server-Modus) - so sieht ein frischer BN9 aus.
    hacknet: new Proxy({
      numHashes: () => zustand.hacknet.hashes,
      hashCapacity: () => (zustand.hacknet.server
        ? zustand.hacknet.server.reduce((a, x) => a + 32 * Math.pow(2, x.cache), 0)
        : zustand.hacknet.kapazitaet),
      numNodes: () => (zustand.hacknet.server ? zustand.hacknet.server.length : 0),
      getNodeStats: (i) => {
        const x = (zustand.hacknet.server || [])[i];
        if (!x) throw new Error("kein Hacknet-Server " + i);
        return { name: "hacknet-server-" + i, cache: x.cache, ram: x.ram ?? 1,
          cores: x.cores ?? 1, level: x.level ?? 1, hashCapacity: 32 * Math.pow(2, x.cache) };
      },
      // Cache-Preis nach formulas/HacknetServers.ts:90-110 (Basis 10 Mio,
      // Faktor 1,85, Deckel 15). Die anderen Ausbauten kosten im Mock
      // unendlich - wer sie pruefen will, baut sie nach.
      getCacheUpgradeCost: (i, n = 1) => {
        const x = (zustand.hacknet.server || [])[i];
        if (!x || x.cache + n > 15) return Infinity;
        let k = 0;
        for (let j = 0; j < n; j++) k += Math.pow(1.85, x.cache + j - 1);
        return k * 10e6;
      },
      upgradeCache: (i, n = 1) => {
        const x = (zustand.hacknet.server || [])[i];
        const k = ns.hacknet.getCacheUpgradeCost(i, n);
        if (!x || !(k < Infinity) || zustand.spieler.money < k) return false;
        zustand.spieler.money -= k;
        x.cache += n;
        zustand.hacknet.kaeufe.push({ art: "cache", i, kosten: k });
        return true;
      },
      getPurchaseNodeCost: () => Infinity,
      purchaseNode: () => -1,
      getRamUpgradeCost: () => Infinity,
      upgradeRam: () => false,
      getCoreUpgradeCost: () => Infinity,
      upgradeCore: () => false,
      getLevelUpgradeCost: () => Infinity,
      upgradeLevel: () => false,
      maxNumNodes: () => (zustand.hacknet.serverModus ? 20 : 30),
      getHashUpgradeLevel: (n) => zustand.hacknet.stufen[n] || 0,
      hashCost: (n, count = 1) => {
        const je = { "Sell for Money": null, "Exchange for Bladeburner Rank": 250,
          "Exchange for Bladeburner SP": 250, "Improve Gym Training": 50, "Improve Studying": 50 };
        if (!(n in je)) throw new Error("unbekanntes Hash-Upgrade: " + n);
        if (je[n] === null) return 4 * count;
        const l = zustand.hacknet.stufen[n] || 0;
        return je[n] * 0.5 * count * (count + 2 * l + 1);
      },
      spendHashes: (n) => {
        const preis = ns.hacknet.hashCost(n);
        if (zustand.hacknet.hashes < preis) return false;
        zustand.hacknet.hashes -= preis;
        zustand.hacknet.stufen[n] = (zustand.hacknet.stufen[n] || 0) + 1;
        zustand.hacknet.ausgegeben.push(n);
        return true;
      },
    }, { get: (ziel, n) => (n in ziel ? ziel[n] : () => nichtGebaut("hacknet." + String(n))) }),
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
    /**
     * Der gesaete Zufall des Mocks. Nach aussen gereicht, damit ein Test
     * dieselbe Folge erzeugen kann wie der Mock selbst - und damit ein
     * Gewerk, das kuenftig Zufall braucht, ihn hier holt statt bei
     * `Math.random`.
     */
    zufall,
  };
}
