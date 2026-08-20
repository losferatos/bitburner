/**
 * Ein-Zweck-Arbeiter: laesst das Zielguthaben einmal wachsen.
 * Kosten: 1.60 GB Grundlast + 0.15 GB fuer grow = 1.75 GB.
 *
 * args: [ziel, verzoegerungMs, landeZeit, aktionsDauerMs, kennung]
 * Zur Begruendung der Terminrechnung siehe worker/hack.js.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  await ns.grow(ns.args[0], { additionalMsec: verzoegerung(ns) });
}

function verzoegerung(ns) {
  const landeZeit = Number(ns.args[2]);
  const dauer = Number(ns.args[3]);
  let ms = Number(ns.args[1]) || 0;
  if (Number.isFinite(landeZeit) && landeZeit > 0 && Number.isFinite(dauer) && dauer > 0) {
    ms = landeZeit - Date.now() - dauer;
  }
  if (!(ms > 0)) return 0;
  return Math.min(1e9, Math.round(ms));
}
