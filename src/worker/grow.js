/**
 * Ein-Zweck-Arbeiter: laesst das Zielguthaben einmal wachsen.
 * Kosten: 1.60 GB Grundlast + 0.15 GB fuer grow + 0.05 GB fuer getGrowTime
 * = 1.80 GB.
 *
 * args: [ziel, verzoegerungMs, landeZeit, aktionsDauerMs, kennung]
 * Zur Begruendung der Terminrechnung und der Selbstmessung der Dauer siehe
 * den ausfuehrlichen Kopf von worker/hack.js.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  await ns.grow(ns.args[0], { additionalMsec: verzoegerung(ns) });
}

function verzoegerung(ns) {
  const landeZeit = Number(ns.args[2]);
  let dauer = Number(ns.args[3]);
  try {
    const gemessen = ns.getGrowTime(ns.args[0]);
    if (Number.isFinite(gemessen) && gemessen > 0) dauer = gemessen;
  } catch { /* Ziel nicht lesbar - mitgegebene Dauer behalten */ }
  let ms = Number(ns.args[1]) || 0;
  if (Number.isFinite(landeZeit) && landeZeit > 0 && Number.isFinite(dauer) && dauer > 0) {
    ms = landeZeit - Date.now() - dauer;
  }
  if (!(ms > 0)) return 0;
  return Math.min(1e9, Math.round(ms));
}
