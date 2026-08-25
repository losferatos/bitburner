/** Der BitNode-6-Steckbrief: Kampfwerte, Beitritt, Rang, laufende Arbeit.
 *
 * WOZU EIN EIGENES SKRIPT
 *
 * bn4rep.json beschreibt den Hacking-Weg - Reputation, Augmentierungen,
 * Hackniveau. In BitNode 6 fuehrt der Ausgang aber ueber 21 Black Ops, und
 * ueber diesen Weg sagt keine der bestehenden Telemetriedateien etwas. Am
 * 25.08.2026 lief der Bot deshalb siebeneinhalb Stunden, ohne dass irgendwo
 * ablesbar gewesen waere, ob die Kampfwerte ueberhaupt steigen.
 *
 * Ergebnis nach data/bblage.json. Start ueber data/task.txt.
 * @param {NS} ns */
export async function main(ns) {
  const p = ns.getPlayer();
  let drin = false, rang = 0, stamina = null;
  try { drin = ns.bladeburner.inBladeburner(); } catch { drin = false; }
  if (drin) {
    try { rang = ns.bladeburner.getRank(); } catch { rang = 0; }
    try { stamina = ns.bladeburner.getStamina(); } catch { stamina = null; }
  }
  let arbeit = null;
  try { arbeit = ns.singularity.getCurrentWork(); } catch { arbeit = null; }

  ns.write("data/bblage.json", JSON.stringify({
    zeit: Date.now(),
    knoten: ns.getResetInfo().currentNode,
    stadt: p.city,
    geld: Math.round(p.money),
    kampf: {
      str: p.skills.strength, def: p.skills.defense,
      dex: p.skills.dexterity, agi: p.skills.agility,
    },
    kampfExp: {
      str: Math.round(p.exp.strength), def: Math.round(p.exp.defense),
      dex: Math.round(p.exp.dexterity), agi: Math.round(p.exp.agility),
    },
    // Der Engpass ist das MINIMUM ueber alle vier - das Tor ist ein Minimum
    // (NetscriptFunctions/Bladeburner.ts:356), kein Durchschnitt.
    tiefstand: Math.min(p.skills.strength, p.skills.defense,
      p.skills.dexterity, p.skills.agility),
    inBladeburner: drin,
    rang: Math.round(rang),
    ausdauer: stamina ? Math.round(stamina[0]) + "/" + Math.round(stamina[1]) : null,
    arbeit: arbeit ? { typ: arbeit.type, klasse: arbeit.classType || null,
      ort: arbeit.location || null } : null,
  }), "w");
  if (ns.getHostname() !== "home") ns.scp("data/bblage.json", "home", ns.getHostname());
}
