/**
 * Daedalus-Bereitschaft: was fehlt noch, und was kostet es?
 *
 * Daedalus ist das Tor zu The Red Pill und damit zu w0r1d_d43m0n. Die
 * Bedingung steht in FactionInfo.tsx: 30 verschiedene Augmentierungen,
 * 100 Mrd Geld, und ENTWEDER Hacking 2500 ODER alle Kampfwerte 1500.
 *
 * Der Hackingweg ist der einzige realistische - Kampfwert 1500 kostet laut
 * Abschlussplan rund 1.590 Stunden je Wert. Dieses Skript misst, wie weit
 * das Level noch ist und wie schnell es bei der aktuellen Erfahrungsrate
 * und dem aktuellen Multiplikator waechst.
 *
 * Aufruf: node tools/task.js daedalus.js
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");
  const z = [];
  try {
    const p = ns.getPlayer();
    const s = ns.singularity;
    const eingebaut = s.getOwnedAugmentations(false).length;
    const gekauft = s.getOwnedAugmentations(true).length;

    z.push(`Augmentierungen: ${eingebaut} eingebaut, ${gekauft} zusammen (Schwelle 30 zaehlt die EINGEBAUTEN nach dem naechsten Reset)`);
    z.push(`Geld: ${ns.format.number(p.money)} von 100b`);
    z.push(`Hacking: ${p.skills.hacking} von 2500`);
    z.push(`Kampfwerte: ${p.skills.strength}/${p.skills.defense}/${p.skills.dexterity}/${p.skills.agility} von je 1500`);
    z.push(`Multiplikator hacking: ${p.mults.hacking.toFixed(4)} | hacking_exp: ${p.mults.hacking_exp.toFixed(4)}`);
    z.push("");

    // Erfahrung messen statt schaetzen: zwei Proben mit Abstand.
    const exp0 = p.exp.hacking;
    const t0 = Date.now();
    await ns.sleep(30000);
    const p1 = ns.getPlayer();
    const rate = (p1.exp.hacking - exp0) / ((Date.now() - t0) / 1000);
    z.push(`Erfahrungsrate gemessen: ${ns.format.number(rate)} exp/s ueber 30 s`);

    // skill = floor(mult * (32*ln(exp+534.6) - 200))  (skill.ts:13)
    // Nach exp aufgeloest: exp = e^((ziel/mult + 200)/32) - 534.6
    const noetig = (ziel, mult) => Math.exp((ziel / mult + 200) / 32) - 534.6;
    const expJetzt = p1.exp.hacking;
    for (const ziel of [1000, 1500, 2000, 2500]) {
      const brauch = noetig(ziel, p1.mults.hacking);
      const fehlt = Math.max(0, brauch - expJetzt);
      const std = rate > 0 ? fehlt / rate / 3600 : Infinity;
      z.push(`  Level ${ziel}: braucht ${ns.format.number(brauch)} exp, fehlen ${ns.format.number(fehlt)} -> ${std < 1e6 ? std.toFixed(1) + " h" : "unerreichbar"}`);
    }
    z.push("");
    // Was waere bei besserem Multiplikator? Der kommt nur aus Augmentierungen.
    for (const m of [2, 3, 5, 8]) {
      const brauch = noetig(2500, p1.mults.hacking * m);
      const std = rate > 0 ? Math.max(0, brauch - expJetzt) / rate / 3600 : Infinity;
      z.push(`  Level 2500 bei ${m}x heutigem Multiplikator (${(p1.mults.hacking * m).toFixed(2)}): ${std < 1e6 ? std.toFixed(1) + " h" : "unerreichbar"}`);
    }
  } catch (e) {
    z.push("FEHLER: " + String(e && e.message ? e.message : e));
  }
  const t = z.join("\n");
  ns.write("data/daedalus.txt", t, "w");
  if (ns.getHostname() !== "home") ns.scp("data/daedalus.txt", "home", ns.getHostname());
  ns.tprint("\n" + t);
}
