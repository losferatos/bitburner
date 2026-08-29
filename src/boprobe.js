/** Einmalige Messung: Was rechnet der Motor fuer die naechste Black Op? */
export async function main(ns) {
  const o = { zeit: Date.now() };
  try {
    const bo = ns.bladeburner.getNextBlackOp();
    o.name = bo ? bo.name : null;
    o.reqRang = bo ? bo.rank : null;
    o.rang = ns.bladeburner.getRank();
    if (bo) {
      const s = ns.bladeburner.getActionEstimatedSuccessChance("Blackops", bo.name);
      o.spanne = [Number(s[0].toFixed(4)), Number(s[1].toFixed(4))];
      o.zeitMs = ns.bladeburner.getActionTime("Blackops", bo.name);
    }
    let comms = 0;
    for (const st of ["Aevum", "Chongqing", "Sector-12", "New Tokyo", "Ishima", "Volhaven"]) {
      try { comms += ns.bladeburner.getCityCommunities(st); } catch { }
    }
    o.commsGesamt = comms;
    o.stadt = ns.bladeburner.getCity();
    o.chaos = ns.bladeburner.getCityChaos(o.stadt);
  } catch (e) { o.fehler = String(e); }
  ns.write("data/boprobe.json", JSON.stringify(o), "w");
  ns.tprint("[boprobe] " + JSON.stringify(o));
}
