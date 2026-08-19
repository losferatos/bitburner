/**
 * Telemetrie-Sender.
 *
 * Laeuft dauerhaft im Spiel und schreibt den Spielzustand in eine Datei.
 * Die Bridge auf dem Rechner liest diese Datei per Remote API aus und
 * schickt sie ans Dashboard. Das ist der einzige Weg nach draussen -
 * Netscript-Skripte koennen selbst keine Netzwerkverbindungen aufbauen.
 *
 * Bewusst sparsam mit RAM: am Anfang hat home nur wenige GB, und jedes
 * Gigabyte, das hier liegt, fehlt beim Hacken.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");

  const OUT = "data/telemetry.txt";
  const INTERVAL = 1000;
  const startedAt = Date.now();
  let cycle = 0;

  while (true) {
    cycle++;

    const player = ns.getPlayer();
    const hosts = scanAll(ns);

    let ramUsed = 0;
    let ramMax = 0;
    let rooted = 0;
    let backdoored = 0;

    for (const host of hosts) {
      // getServerMaxRam/UsedRam kosten je 0.05 GB - das ist bezahlbar.
      ramMax += ns.getServerMaxRam(host);
      ramUsed += ns.getServerUsedRam(host);
      if (ns.hasRootAccess(host)) rooted++;
    }

    // Die Datei, die der Autopilot ueber seine eigene Lage schreibt.
    // Fehlt sie, laeuft der Autopilot noch nicht - kein Problem.
    let brain = null;
    if (ns.fileExists("data/brain.txt", "home")) {
      try {
        brain = JSON.parse(ns.read("data/brain.txt"));
      } catch {
        brain = null;
      }
    }

    const payload = {
      t: Date.now(),
      uptime: (Date.now() - startedAt) / 1000,
      cycle,
      phase: brain?.phase ?? "nur Telemetrie",
      action: brain?.action ?? null,
      reason: brain?.reason ?? "Der Autopilot ist noch nicht gestartet.",
      player: {
        money: player.money,
        hackLevel: player.skills.hacking,
        str: player.skills.strength,
        def: player.skills.defense,
        dex: player.skills.dexterity,
        agi: player.skills.agility,
        cha: player.skills.charisma,
        karma: ns.heart.break(),
        city: player.city,
      },
      income: {
        scriptIncome: ns.getTotalScriptIncome()[0],
        scriptExpGain: ns.getTotalScriptExpGain(),
      },
      ram: { used: ramUsed, max: ramMax },
      network: { total: hosts.length, rooted, backdoored },
      targets: brain?.targets ?? [],
    };

    ns.write(OUT, JSON.stringify(payload), "w");
    await ns.sleep(INTERVAL);
  }
}

/**
 * Alle erreichbaren Server einsammeln, home eingeschlossen.
 * @param {NS} ns
 * @returns {string[]}
 */
function scanAll(ns) {
  const seen = new Set(["home"]);
  const queue = ["home"];
  while (queue.length) {
    for (const next of ns.scan(queue.pop())) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return [...seen];
}
