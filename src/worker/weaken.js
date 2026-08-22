/**
 * Ein-Zweck-Arbeiter: senkt die Sicherheitsstufe des Ziels einmal.
 * Kosten: 1.60 GB Grundlast + 0.15 GB fuer weaken + 0.05 GB fuer
 * getWeakenTime = 1.80 GB.
 *
 * args: [ziel, verzoegerungMs, landeZeit, aktionsDauerMs, kennung]
 * Zur Begruendung der Terminrechnung und der Selbstmessung der Dauer siehe
 * den ausfuehrlichen Kopf von worker/hack.js. Fuer weaken wiegt sie am
 * schwersten: die weaken-Zeit ist das Vierfache der hack-Zeit, also geht jeder
 * relative Fehler in der Sicherheit hier vierfach in Millisekunden ein.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  await ns.weaken(ns.args[0], { additionalMsec: verzoegerung(ns) });
}

function verzoegerung(ns) {
  const landeZeit = Number(ns.args[2]);
  let dauer = Number(ns.args[3]);
  try {
    const gemessen = ns.getWeakenTime(ns.args[0]);
    if (Number.isFinite(gemessen) && gemessen > 0) dauer = gemessen;
  } catch { /* Ziel nicht lesbar - mitgegebene Dauer behalten */ }
  let ms = Number(ns.args[1]) || 0;
  if (Number.isFinite(landeZeit) && landeZeit > 0 && Number.isFinite(dauer) && dauer > 0) {
    ms = landeZeit - Date.now() - dauer;
  }
  if (!(ms > 0)) return 0;
  return Math.min(1e9, Math.round(ms));
}
