/**
 * Favor-Weg gegen Arbeitsweg rechnen.
 *
 * Ab Favor 150 darf an eine Faktion gespendet werden, und dann gilt
 * rep = betrag / 1e6 * mults.faction_rep (Faction/formulas/donation.ts).
 * Bei 1,5 Billionen auf der Hand waeren das ueber eine Million Reputation
 * auf einen Schlag - mehr als die teuerste Augmentierung kostet.
 *
 * Favor waechst aber nur beim EINBAU, aus der bis dahin gesammelten
 * Reputation (Faction.ts:77-85 ruft addRepToFavor). Die Frage ist also:
 * lohnt es, Reputation zu sammeln, um Favor zu heben und danach zu kaufen,
 * statt die Augmentierung direkt zu erarbeiten?
 *
 * Aufruf: node tools/task.js favorweg.js
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");
  const s = ns.singularity;
  const z = [];
  try {
    const p = ns.getPlayer();
    const schwelle = ns.getFavorToDonate();
    z.push(`Spendenschwelle: Favor ${schwelle} | Geld ${ns.format.number(p.money)} | faction_rep x${p.mults.faction_rep.toFixed(3)}`);
    z.push(`Spende brachte bei diesem Guthaben: ${ns.format.number(p.money / 1e6 * p.mults.faction_rep)} Reputation`);
    z.push("");

    // Reputationsrate messen statt schaetzen.
    const f0 = p.factions[0];
    z.push("Faktion | Favor | Rep jetzt | Rep fuer Favor 150 | fehlt noch");
    for (const f of p.factions) {
      const favor = s.getFactionFavor(f);
      const rep = s.getFactionRep(f);
      // favorToRep ist im Spiel nicht als API zu haben; die Umkehrung
      // liefert ns.formulas nur mit SF5. Deshalb die bekannte Marke aus dem
      // Quelltext: Favor 150 entspricht 462.490 kumulierter Reputation
      // (favor.ts:12-15 mit Constants.ts:31). Der Anteil, der noch fehlt,
      // laesst sich daraus abschaetzen, weil Favor streng monoton in der
      // kumulierten Reputation ist.
      const ZIEL_REP = 462490;
      z.push(`${f} | ${favor.toFixed(1)} | ${ns.format.number(rep)} | ${ns.format.number(ZIEL_REP)} | ${favor >= schwelle ? "ERREICHT" : ns.format.number(Math.max(0, ZIEL_REP - rep)) + " (grob)"}`);
    }
    z.push("");

    // Was kostet das aktuelle Ziel direkt?
    const besitz = new Set(s.getOwnedAugmentations(true));
    let bestes = null;
    for (const f of p.factions) {
      const rep = s.getFactionRep(f);
      for (const a of s.getAugmentationsFromFaction(f)) {
        if (besitz.has(a) || a === "NeuroFlux Governor") continue;
        const rr = s.getAugmentationRepReq(a);
        if (rr <= rep) continue;
        if (!bestes || rr - rep < bestes.luecke) bestes = { a, f, luecke: rr - rep, rr };
      }
    }
    if (bestes) z.push(`Naechstes erreichbares Stueck: ${bestes.a} (${bestes.f}), fehlen ${ns.format.number(bestes.luecke)} Rep`);

    // Rate messen.
    const rep0 = bestes ? s.getFactionRep(bestes.f) : 0;
    const t0 = Date.now();
    await ns.sleep(60000);
    const rate = bestes ? (s.getFactionRep(bestes.f) - rep0) / ((Date.now() - t0) / 1000) : 0;
    z.push(`Reputationsrate gemessen: ${rate.toFixed(2)} rep/s ueber 60 s`);
    if (bestes && rate > 0) {
      z.push(`  -> direkt erarbeitet: ${(bestes.luecke / rate / 3600).toFixed(1)} h`);
      z.push(`  -> bis Favor 150 bei dieser Rate: ${(462490 / rate / 3600).toFixed(1)} h, danach jede Huerde per Spende sofort`);
    }
  } catch (e) {
    z.push("FEHLER: " + String(e && e.message ? e.message : e));
  }
  const t = z.join("\n");
  ns.write("data/favorweg.txt", t, "w");
  if (ns.getHostname() !== "home") ns.scp("data/favorweg.txt", "home", ns.getHostname());
  ns.tprint("\n" + t);
}
