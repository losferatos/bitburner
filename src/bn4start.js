/**
 * Startskript fuer BitNode 4 - der Wiederanlauf ohne DOM.
 *
 * WARUM ES DAS BRAUCHT
 *
 * autopilot.js braucht 34,15 GB, home hat nach dem BitNode-Wechsel 32. Es
 * passt nicht - und der Grund ist der Bezeichner `document`, den der
 * RAM-Rechner pauschal mit 25 GB bucht (RamCostGenerator.ts:12), egal wie
 * selten er benutzt wird.
 *
 * In BitNode 4 braucht ihn niemand mehr. Die Singularity-Funktionen tun
 * dasselbe ueber die API, und sie kosten hier den vollen Rabatt:
 * `if (Player.bitNodeN === 4) return cost` (RamCostGenerator.ts:84). Zwei
 * Gigabyte fuer purchaseTor statt fuenfundzwanzig fuer das Dokument.
 *
 * Diese Datei ist bewusst das Minimum: Netz aufschliessen, Arbeiter
 * ausbringen, home ausbauen. Sobald genug Speicher da ist, uebernimmt ein
 * richtiger Singularity-Autopilot.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");

  const knacker = [
    ["BruteSSH.exe", ns.brutessh],
    ["FTPCrack.exe", ns.ftpcrack],
    ["relaySMTP.exe", ns.relaysmtp],
    ["HTTPWorm.exe", ns.httpworm],
    ["SQLInject.exe", ns.sqlinject],
  ];

  const scanAll = () => {
    const gesehen = new Set(["home"]);
    const schlange = ["home"];
    while (schlange.length) {
      for (const nachbar of ns.scan(schlange.shift())) {
        if (gesehen.has(nachbar)) continue;
        gesehen.add(nachbar);
        schlange.push(nachbar);
      }
    }
    return [...gesehen];
  };

  const sag = (t) => ns.print(t);

  for (let runde = 1; ; runde++) {
    const hosts = scanAll();

    // --- 1. Aufschliessen, was aufzuschliessen ist ---------------------------
    const offen = knacker.filter(([datei]) => ns.fileExists(datei, "home"));
    let neuGerootet = 0;
    for (const host of hosts) {
      if (host === "home" || ns.hasRootAccess(host)) continue;
      const s = ns.getServer(host);
      if (s.numOpenPortsRequired > offen.length) continue;
      if (s.requiredHackingSkill > ns.getHackingLevel()) continue;
      for (const [, fn] of offen) { try { fn(host); } catch { /* schon offen */ } }
      try { ns.nuke(host); neuGerootet++; } catch { /* Ports fehlen doch */ }
    }
    if (neuGerootet) sag("Runde " + runde + ": " + neuGerootet + " Rechner gerootet.");

    // --- 2. Ein Ziel waehlen -------------------------------------------------
    // Schlicht der lohnendste erreichbare Rechner: viel Geld, niedrige
    // Sicherheit. Fuer den Anfang reicht das; Feinsteuerung kommt spaeter.
    let ziel = null, bester = 0;
    for (const host of hosts) {
      if (!ns.hasRootAccess(host)) continue;
      const s = ns.getServer(host);
      // NICHT durch zwei teilen. Die Faustregel "nur Ziele bis zum halben
      // Level" stammt aus dem Spaetspiel mit hunderten Zielen. Beim Neustart
      // mit Hacking 1 ergibt sie die Schwelle 0,5 - und selbst n00dles
      // (verlangt 1) faellt durch. Es gibt dann NIE ein Ziel, nie einen
      // Arbeiter, nie Erfahrung, und weil das Level nicht steigt, wird die
      // Schranke auch nie milder. Eine perfekte Selbstblockade: Der Bot stand
      // damit zwanzig Minuten bei Hacking 1 und $1k.
      if (!s.moneyMax || s.requiredHackingSkill > ns.getHackingLevel()) continue;
      const wert = s.moneyMax / s.minDifficulty;
      if (wert > bester) { bester = wert; ziel = host; }
    }
    if (!ziel) { await ns.sleep(5000); continue; }

    // --- 3. Arbeiter ausbringen ---------------------------------------------
    // Der einfachste tragfaehige Kreislauf: erst absenken, dann aufpumpen,
    // dann ernten. Kein Stapelbetrieb - der braucht mehr Speicher, als hier
    // vorhanden ist.
    const s = ns.getServer(ziel);
    const skript = s.hackDifficulty > s.minDifficulty + 5 ? "worker/weaken.js"
      : s.moneyAvailable < s.moneyMax * 0.9 ? "worker/grow.js"
        : "worker/hack.js";

    for (const host of hosts) {
      if (!ns.hasRootAccess(host)) continue;
      // Auf home eine Reserve lassen. Wer allen Speicher belegt, hungert den
      // naechsten Auftrag aus - und ns.exec gibt dann still 0 zurueck, ohne
      // Absturz und ohne Meldung. Dasselbe Muster, das in BitNode 1 achtmal
      // zugeschlagen hat: ausgeloest, gemeldet, nie geprueft.
      const RESERVE = host === "home" ? 16 : 0;
      const frei = ns.getServerMaxRam(host) - ns.getServerUsedRam(host) - RESERVE;
      const braucht = ns.getScriptRam(skript, "home");
      const faeden = Math.floor(frei / braucht);
      if (faeden < 1) continue;
      if (host !== "home") ns.scp(["worker/weaken.js", "worker/grow.js", "worker/hack.js"], host, "home");
      ns.exec(skript, host, faeden, ziel, Date.now());
    }

    // --- 4. home ausbauen, sobald es bezahlbar ist ---------------------------
    // Der einzige Posten, der den naechsten Reset ueberlebt - und die
    // Voraussetzung dafuer, dass hier ueberhaupt ein richtiger Autopilot
    // laufen kann.
    const kosten = ns.singularity.getUpgradeHomeRamCost();
    if (ns.getServerMoneyAvailable("home") > kosten * 2) {
      if (ns.singularity.upgradeHomeRam()) {
        sag("home-Speicher verdoppelt auf " + ns.getServerMaxRam("home") + " GB.");
      }
    }

    await ns.sleep(10000);
  }
}
