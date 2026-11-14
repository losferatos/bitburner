/**
 * Kaltstart-Lauefer fuer Lauf 2: BN1.1 ohne Source-Files, home 8 GB.
 *
 * ============================================================================
 * WARUM ES DIESE DATEI GIBT
 * ============================================================================
 *
 * Der Kern (bn4net.js 10,8 GB) und der Waechter (6,1 GB) passen nicht auf ein
 * home mit 8 GB. boot.js (5,5 GB) startet nur den Kern und wartet dann
 * vergeblich (Befund A1, nodes/audit-lauf2/5a-kaltstart.md). Zwischen dem
 * ersten Start und 16/32 GB home braucht es etwas, das mit unter 5 GB auskommt,
 * Geld verdient und Hacking-Level aufbaut. Das ist diese Datei.
 *
 * Sie ist die Fortsetzung des alten Autopiloten (Commit 7ebf2a4, gemessen
 * 7,10 GB mit tools/ram.js; Zahlen im Kopf von doku/lauf2-bn11-start.md),
 * auf die Haelfte gekuerzt:
 *   - kein Fenster, kein getPlayer (0,5 GB), kein killall, keine Telemetrie
 *   - Spielerwerte nur aus dem Hacking-Level, Multiplikatoren 1 angenommen
 *     (in BN1.1 ohne Augmentierungen stimmt das; spaeter rechnet es zu
 *     vorsichtig, nicht zu knapp)
 *   - der Mietrechner-Einkaeufer ist ausgelagert (coldbuy.js, laeuft auf einem
 *     fremden Rechner, weil purchaseServer allein 2,25 GB kostet)
 *
 * ============================================================================
 * WAS ES TUT
 * ============================================================================
 *
 * Jede Runde: Netz abgehen, knacken, Arbeiter (worker/*.js) ausliefern,
 * Ziele nach Ertrag ordnen, vorbereiten oder ernten. Dazu schreibt es
 * data/coldstart.txt (Stand und der naechste Handschritt) und legt den
 * Betrag fuer den naechsten Handkauf auf RESERVE_PORT, damit coldbuy.js ihn
 * nicht wegkauft.
 *
 * WAS ES NICHT KANN (ohne Singularity, ohne DOM): TOR, Portknacker kaufen,
 * home-RAM kaufen. Das steht in doku/lauf2-bn11-start.md als Handanleitung;
 * darkweb.js (2,65 GB, DOM-Griff ueber globalThis) uebernimmt es auf Wunsch:
 *
 *   run coldstart.js               startet darkweb.js, sobald das Geld reicht
 *   run coldstart.js ohne-darkweb  nur Status, Kaeufe von Hand
 *
 * SEIT 14.11.2026 STANDARDMAESSIG AN: Lauf 2 startete per Autoexec (ohne
 * Argument), und im Kaltstart nimmt kein Skript Auftraege an - ohne diesen
 * Standard haette der Bot bis zum naechsten Handgriff bei TOR gewartet.
 * darkweb.js klickt durch die Spieloberflaeche (wechselt die Spielseite).
 *
 * ============================================================================
 * UEBERGABE
 * ============================================================================
 *
 * Ab HANDOFF_GB (32) startet es boot.js und beendet sich. Bei 16 GB bleibt es
 * Absicht liegen: dort passen Kern (10,8) und Waechter (6,1) nicht zusammen
 * (16,9 > 16), boot.js wuerde den Waechter starten und dann auf den Kern
 * warten. Auf 16 GB traegt coldstart.js also weiter, bis die 32 stehen.
 *
 * ============================================================================
 * RAM
 * ============================================================================
 *
 * Grenze 5 GB, gemessen mit `node tools/ram.js coldstart.js` (nicht
 * geschaetzt). Wer hier eine ns-Funktion ergaenzt, misst neu. Achtung
 * Namensfalle: der Rechner zaehlt JEDEN Bezeichner, der wie eine ns-Funktion
 * heisst, auch `obj.hack`. Deshalb heissen die Felder unten hackT/growT/
 * weakenT und `ernte`/`wuchs` statt hack/grow, und kein Feld heisst `scan`.
 *
 * Argumente: "darkweb" (siehe oben).
 *
 * @param {NS} ns
 */
import * as calc from "lib/calc";

// Auf home bleibt mindestens so viel frei: Platz fuer darkweb.js (2,65 GB) und
// fuer boot.js (5,5 GB) bei der Uebergabe. Auf 8 GB home bedeutet das: home
// arbeitet nicht mit, die Arbeiter laufen auf den fremden Rechnern.
const HOME_FREI_GB = 6;
// Ab dieser home-Groesse wird an den Kern uebergeben (siehe Kopf).
const HANDOFF_GB = 32;
// Ziel gilt als bereit bei Sicherheit <= Minimum + SEC_TOL und Geld >= READY.
const SEC_TOL = 3;
const MONEY_READY = 0.9;
// Anteil des Guthabens, den eine Erntewelle holt. Niedrig, weil grow
// multiplikativ skaliert und ein halb geleerter Server billig nachwaechst.
const HACK_ANTEIL = 0.3;
// Zugleich vorbereitete / abgeerntete Ziele. Konzentration schlaegt Breite.
const MAX_ERNTE = 4;
const MAX_VORBEREITUNG = 1;
// Handkauf-Reserve (siehe naechsterSchritt): TOR und BruteSSH werden immer
// zurueckgehalten, die teureren Posten erst, wenn so viel Mietrechner-RAM
// steht. Davor ist Rechner mieten (55k je GB) billiger als home-RAM (126k).
const MIET_ZUERST_GB = 64;
const RESERVE_PORT = 3032;
const STATUS_DATEI = "data/coldstart.txt";

const ARBEITER = { w: "worker/weaken.js", g: "worker/grow.js", h: "worker/hack.js" };
// Arbeiter-RAM fest eingetragen statt getScriptRam (0,1 GB): gemessen mit
// tools/ram.js, test-coldstart.js prueft, dass die Werte nicht zu klein sind.
// Zu gross waere harmlos, zu klein liesse exec fehlschlagen (gibt 0 zurueck).
const KOSTEN = { w: 1.8, g: 1.8, h: 1.75 };
const KAUFER = "coldbuy.js";
// Der Einkaeufer braucht (ram.js): 5,75 GB. Nur als Untergrenze fuer die Wirtswahl.
const KAUFER_GB = 5.75;
const DARKWEB = "darkweb.js";

export async function main(ns) {
  ns.disableLog("ALL");
  const mitDarkweb = !ns.args.includes("ohne-darkweb");
  const gestartet = Date.now();
  let runde = 0;
  let darkwebZuletzt = 0;
  let ziel = null;

  while (true) {
    // EINE RUNDE DARF DAS SKRIPT NICHT BEENDEN (14.11.2026). Am ersten
    // Lauf-2-Tag endete coldstart.js nach 262 s still (Runde 26); im
    // Kaltstart startet es niemand neu - der Bot stand bis zum naechsten
    // Neuladen. Jetzt: Fehler fangen, nach data/coldstart-fehler.txt
    // schreiben, naechste Runde.
    try {
    runde++;
    const homeGb = ns.getServerMaxRam("home");
    const geld = ns.getServerMoneyAvailable("home");
    const skill = ns.getHackingLevel();
    const spieler = { skill, int: 0, multMoney: 1, multChance: 1, multSpeed: 1, multGrow: 1 };

    // --- Uebergabe an den Kern ------------------------------------------------
    if (homeGb >= HANDOFF_GB && ns.fileExists("boot.js", "home")) {
      // exec gibt 0 zurueck, wenn boot.js (5,5 GB) nicht passt - dann naechste Runde.
      if (ns.exec("boot.js", "home")) {
        schreibe(ns, { runde, homeGb, geld, skill, schritt: "Uebergabe an boot.js", ende: true });
        return;
      }
    }

    // --- Netz abgehen, knacken -------------------------------------------------
    const hosts = netzAbgehen(ns);
    // Knacker je Runde einmal zaehlen. Die Aufrufe stehen ausgeschrieben da:
    // ein dynamischer Zugriff (ns[name]) wuerde der statische RAM-Rechner nicht
    // zaehlen, das Spiel aber zur Laufzeit - und das Skript abbrechen.
    const hatSsh = ns.fileExists("BruteSSH.exe", "home");
    const hatFtp = ns.fileExists("FTPCrack.exe", "home");
    const hatSmtp = ns.fileExists("relaySMTP.exe", "home");
    // Nur BruteSSH, FTPCrack und relaySMTP: HTTPWorm (30M) und SQLInject
    // (250M) liegen jenseits der 32 GB, bis zu denen dieses Skript traegt, und
    // jeder Aufruf kostet RAM. Ob die Ports reichen, entscheidet nuke selbst:
    // es wirft bei zu wenig offenen Ports (try/catch), das spart
    // getServerNumPortsRequired (0,1 GB). Das Level-Gate braucht nuke nicht -
    // nur hack, und das prueft die Zielwahl unten.
    for (const h of hosts) {
      if (h === "home" || ns.hasRootAccess(h)) continue;
      if (hatSsh) ns.brutessh(h);
      if (hatFtp) ns.ftpcrack(h);
      if (hatSmtp) ns.relaysmtp(h);
      try { ns.nuke(h); } catch { /* zu wenig Ports - naechste Runde */ }
    }

    // --- Lage aufnehmen ----------------------------------------------------------
    const server = [];
    for (const h of hosts) {
      const root = ns.hasRootAccess(h);
      const ram = ns.getServerMaxRam(h);
      const moneyMax = ns.getServerMaxMoney(h);
      server.push({
        host: h, root, ram,
        // Auf home bleibt Platz fuer Handwerkzeug und die Uebergabe frei.
        frei: Math.max(0, ram - ns.getServerUsedRam(h) - (h === "home" ? HOME_FREI_GB : 0)),
        moneyMax,
        moneyNow: moneyMax > 0 ? ns.getServerMoneyAvailable(h) : 0,
        sec: ns.getServerSecurityLevel(h),
        secMin: ns.getServerMinSecurityLevel(h),
        growth: moneyMax > 0 ? ns.getServerGrowth(h) : 0,
        reqSkill: ns.getServerRequiredHackingLevel(h),
      });
    }
    const arbeitskraft = server.filter((s) => s.root && s.ram > 0);

    // --- Arbeiter und Einkaeufer ausliefern ---------------------------------------
    for (const s of arbeitskraft) {
      if (s.host !== "home" && !ns.fileExists(ARBEITER.w, s.host)) {
        ns.scp([ARBEITER.w, ARBEITER.g, ARBEITER.h, KAUFER], s.host, "home");
      }
    }

    // Wer arbeitet schon wofuer? Vor jeder neuen Entscheidung zaehlen, sonst
    // schickt jede Runde eine volle Welle los, obwohl die vorige noch laeuft.
    const busy = new Map();
    let kaeuferLaeuft = false;
    for (const s of arbeitskraft) {
      for (const p of ns.ps(s.host)) {
        if (p.filename === KAUFER) { kaeuferLaeuft = true; continue; }
        const art = Object.keys(ARBEITER).find((k) => ARBEITER[k] === p.filename);
        if (!art) continue;
        const t = String(p.args[0]);
        if (!busy.has(t)) busy.set(t, { w: 0, g: 0, h: 0 });
        busy.get(t)[art] += p.threads;
      }
    }

    // Einkaeufer: kleinster fremder Rechner, auf den er passt. Er laeuft vor
    // den Arbeitern, damit deren Fuellung ihm den Platz nicht wegnimmt.
    if (!kaeuferLaeuft && ns.fileExists(KAUFER, "home")) {
      const wirt = arbeitskraft
        .filter((s) => s.host !== "home" && s.frei >= KAUFER_GB)
        .sort((a, b) => a.ram - b.ram)[0];
      if (wirt && ns.exec(KAUFER, wirt.host)) wirt.frei -= KAUFER_GB;
    }

    // --- Ziele ordnen --------------------------------------------------------------
    const gesamtRam = Math.max(2, arbeitskraft.reduce((a, s) => a + s.ram, 0));
    const kandidaten = server
      .filter((s) => s.root && s.moneyMax > 0 && s.reqSkill <= skill)
      .map((s) => ({ ...s, wert: calc.targetScore(s, spieler), busy: busy.get(s.host) ?? { w: 0, g: 0, h: 0 } }))
      .filter((s) => s.wert > 0);
    const bereit = (s) => s.sec <= s.secMin + SEC_TOL && s.moneyNow >= s.moneyMax * MONEY_READY;
    for (const s of kandidaten) {
      s.rest = bereit(s) ? 0 : Math.max(1,
        calc.weakenThreads(Math.max(0, s.sec - s.secMin))
        + (s.moneyNow < s.moneyMax * MONEY_READY
          ? Math.min(1e6, calc.growThreads(s, s.moneyMax, Math.max(1, s.moneyNow), spieler, 1)) : 0));
    }
    kandidaten.sort((a, b) => {
      if (bereit(a) !== bereit(b)) return bereit(a) ? -1 : 1;
      if (bereit(a)) return b.wert - a.wert;
      return b.wert / b.rest - a.wert / a.rest;
    });
    const aktiv = [
      ...kandidaten.filter(bereit).slice(0, MAX_ERNTE),
      ...kandidaten.filter((s) => !bereit(s)).slice(0, MAX_VORBEREITUNG),
    ];

    // --- Wellen losschicken ---------------------------------------------------------
    const einsatz = (art, n, t) => verteile(ns, arbeitskraft, ARBEITER[art], KOSTEN[art], n, t);

    for (const t of aktiv) {
      if (t.sec > t.secMin + SEC_TOL) {
        const need = calc.weakenThreads(t.sec - t.secMin) - t.busy.w;
        einsatz("w", need, t.host);
      } else if (t.moneyNow < t.moneyMax * MONEY_READY) {
        const voll = calc.growThreads(t, t.moneyMax, t.moneyNow, spieler, 1);
        const gNeed = Number.isFinite(voll) ? voll - t.busy.g : 0;
        const gN = einsatz("g", gNeed, t.host);
        // Jeder grow-Thread hebt die Sicherheit: gleich mit ausgleichen.
        einsatz("w", calc.weakenThreads((t.busy.g + gN) * calc.GROW_FORTIFY_AMOUNT) - t.busy.w, t.host);
      } else {
        const pro = calc.hackPercent({ ...t, sec: t.secMin }, spieler);
        const voll = pro > 0 ? Math.floor(HACK_ANTEIL / pro) : 0;
        const hN = einsatz("h", voll - t.busy.h, t.host);
        einsatz("w", calc.weakenThreads((t.busy.h + hN) * calc.SERVER_FORTIFY_AMOUNT) - t.busy.w, t.host);
      }
    }
    ziel = aktiv[0]?.host ?? ziel;

    // --- Handschritte und Reserve -----------------------------------------------------
    const miet = server.filter((s) => /^werk-/.test(s.host)).reduce((a, s) => a + s.ram, 0);
    const schritt = naechsterSchritt(ns, homeGb, geld, miet);
    // Port leeren und neu beschreiben: es soll immer genau EIN Wert dort stehen.
    ns.clearPort(RESERVE_PORT);
    ns.writePort(RESERVE_PORT, schritt.reserve);

    // darkweb.js nur auf Ansage und hoechstens alle 10 Minuten, nie doppelt.
    if (mitDarkweb && schritt.darkweb && geld >= schritt.preis
        && Date.now() - darkwebZuletzt > 600000 && ns.fileExists(DARKWEB, "home")) {
      if (ns.exec(DARKWEB, "home")) darkwebZuletzt = Date.now();
    }

    // Zustand alle 5 Runden ablegen (ns.write kostet keinen RAM).
    if (runde % 5 === 1) {
      schreibe(ns, {
        runde, laufzeitS: Math.round((Date.now() - gestartet) / 1000), homeGb, geld, skill,
        gerootet: server.filter((s) => s.root).length, von: server.length,
        mietGb: miet, arbeitskraftGb: gesamtRam, ziel,
        ziele: aktiv.map((t) => ({ host: t.host, geld: Math.round(t.moneyNow), max: t.moneyMax,
          sec: Math.round(t.sec * 10) / 10, min: t.secMin })),
        schritt: schritt.text, reserve: schritt.reserve,
      });
    }
    } catch (e) {
      const text = String(e && e.stack ? e.stack : e).slice(0, 1500);
      ns.write("data/coldstart-fehler.txt", new Date().toISOString() + " Runde " + runde + ": " + text + "\n", "a");
    }

    await ns.sleep(2000);
  }
}

/**
 * Der naechste Schritt, den nur die Hand machen kann, samt Preis.
 * Reihenfolge: TOR (200k), BruteSSH (500k), home 16 GB, FTPCrack (1,5M),
 * home 32 GB. Der Preis fuer home-RAM ist die Spielformel
 * `Player.getUpgradeHomeRamCost` (ram * 32000 * 1,58^log2(ram)), geeicht in
 * tools/test-coldstart.js gegen 1,01 M (8 -> 16) und 3,19 M (16 -> 32).
 *
 * @returns {{text: string, preis: number, reserve: number, darkweb: boolean}}
 */
function naechsterSchritt(ns, homeGb, geld, mietGb) {
  const hat = (datei) => ns.fileExists(datei, "home");
  const posten = [];
  if (!ns.scan("home").includes("darkweb")) {
    posten.push({ text: "TOR-Router kaufen (200k)", preis: 200e3, immer: true, darkweb: true });
  }
  if (!hat("BruteSSH.exe")) {
    posten.push({ text: "BruteSSH.exe kaufen (500k)", preis: 500e3, immer: true, darkweb: true });
  }
  if (homeGb < 16) {
    posten.push({ text: "home-RAM auf 16 GB (Alt+W, Alpha Enterprises, Upgrade 'home' RAM)",
      preis: heimPreis(homeGb), immer: false, darkweb: false });
  }
  if (!hat("FTPCrack.exe")) {
    posten.push({ text: "FTPCrack.exe kaufen (1,5M)", preis: 1.5e6, immer: false, darkweb: true });
  }
  if (homeGb < 32) {
    posten.push({ text: "home-RAM auf 32 GB (Alpha Enterprises)", preis: heimPreis(homeGb < 16 ? 16 : homeGb),
      immer: false, darkweb: false });
  }
  const p = posten[0];
  if (!p) return { text: homeGb >= 32 ? "Uebergabe an boot.js" : "nichts offen", preis: 0, reserve: 0, darkweb: false };
  const reserviert = p.immer || mietGb >= MIET_ZUERST_GB;
  return { text: p.text + (geld >= p.preis ? " - JETZT moeglich" : ""), preis: p.preis,
    reserve: reserviert ? p.preis : 0, darkweb: p.darkweb };
}

/** Kosten, home-RAM von homeGb auf das Doppelte zu bringen (Spielformel). */
export function heimPreis(homeGb) {
  return homeGb * 32000 * Math.pow(1.58, Math.log2(homeGb));
}

/** Alle Rechner ab home, ohne Hacknet-Server (die werfen bei Einzelabfragen). */
function netzAbgehen(ns) {
  const gesehen = new Set(["home"]);
  const warte = ["home"];
  while (warte.length) {
    for (const n of ns.scan(warte.pop())) {
      if (gesehen.has(n) || n.startsWith("hacknet-")) continue;
      gesehen.add(n);
      warte.push(n);
    }
  }
  return [...gesehen];
}

/**
 * Verteilt Arbeiter ueber die Rechner mit freiem Speicher, grosse zuerst.
 * Liefert die tatsaechlich gestarteten Threads.
 */
function verteile(ns, kraft, datei, kosten, threads, ziel) {
  if (!(threads >= 1) || !Number.isFinite(threads) || !(kosten > 0)) return 0;
  let rest = Math.floor(threads);
  let gestartet = 0;
  for (const s of [...kraft].sort((a, b) => b.frei - a.frei)) {
    if (rest <= 0) break;
    const passt = Math.floor(s.frei / kosten);
    if (passt < 1) continue;
    const n = Math.min(passt, rest);
    if (ns.exec(datei, s.host, n, ziel, 0, 0, 0, Date.now() + "-" + gestartet)) {
      s.frei -= n * kosten;
      rest -= n;
      gestartet += n;
    }
  }
  return gestartet;
}

function schreibe(ns, daten) {
  ns.write(STATUS_DATEI, JSON.stringify({ t: Date.now(), ...daten }, null, 1), "w");
}
