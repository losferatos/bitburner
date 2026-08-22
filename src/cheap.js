/**
 * Billige Augmentierungen fuer die 30er-Schwelle.
 *
 * Die Daedalus-Bedingung verlangt 30 VERSCHIEDENE eingebaute Augmentierungen.
 * Fuer diese Zaehlung ist gleichgueltig, ob eine Augmentierung einen
 * hacking-Multiplikator traegt - eine billige Kampf-Aug zaehlt genauso wie
 * eine teure Hacking-Aug. Der Abschlussplan (Fassung 3) behauptet, rund 25
 * Stueck seien unter 25.000 Rep zu haben; das entkoppelt das Daedalus-Tor vom
 * Multiplikatoraufbau. Dieses Skript prueft die Behauptung am laufenden Spiel.
 *
 * Aufruf: node tools/task.js cheap.js
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");
  const s = ns.singularity;
  const zeilen = [];

  try {
    const eingebaut = new Set(s.getOwnedAugmentations(false));
    const gekauft = new Set(s.getOwnedAugmentations(true));
    const wartend = [...gekauft].filter((a) => !eingebaut.has(a));
    const meine = ns.getPlayer().factions;

    zeilen.push(`Eingebaut ${eingebaut.size} | wartend ${wartend.length} | zusammen ${gekauft.size} | bis 30 fehlen ${Math.max(0, 30 - gekauft.size)}`);
    zeilen.push(`Meine Faktionen: ${meine.join(", ")}`);

    // Nicht nur die eigenen Faktionen: die billigen Augmentierungen liegen
    // gerade bei denen, in die man noch eintreten muesste. getAugmentationsFromFaction
    // beantwortet das auch fuer Faktionen ohne Mitgliedschaft.
    const ALLE_FAKTIONEN = [
      "Illuminati", "Daedalus", "The Covenant", "ECorp", "MegaCorp", "Bachman & Associates",
      "Blade Industries", "NWO", "Clarke Incorporated", "OmniTek Incorporated",
      "Four Sigma", "KuaiGong International", "Fulcrum Secret Technologies",
      "BitRunners", "The Black Hand", "NiteSec", "CyberSec", "Aevum", "Chongqing",
      "Ishima", "New Tokyo", "Sector-12", "Volhaven", "Speakers for the Dead",
      "The Dark Army", "The Syndicate", "Silhouette", "Tetrads", "Slum Snakes",
      "Netburners", "Tian Di Hui", "Bladeburners", "Church of the Machine God",
      "Shadows of Anarchy",
    ];
    const alle = ALLE_FAKTIONEN.slice();
    zeilen.push(`Offene Einladungen: ${s.checkFactionInvitations().join(", ") || "keine"}`);
    zeilen.push("");

    const kand = [];
    for (const f of alle) {
      const rep = meine.includes(f) ? s.getFactionRep(f) : 0;
      for (const a of s.getAugmentationsFromFaction(f)) {
        if (gekauft.has(a)) continue;
        const rr = s.getAugmentationRepReq(a);
        if (rr > 25000) continue;
        const luecke = Math.max(0, rr - rep);
        const vorh = kand.find((k) => k.name === a);
        if (vorh) { if (luecke < vorh.luecke) { vorh.faktion = f; vorh.luecke = luecke; vorh.drin = meine.includes(f); } continue; }
        kand.push({ name: a, faktion: f, repReq: rr, luecke, preis: s.getAugmentationPrice(a), drin: meine.includes(f) });
      }
    }

    kand.sort((a, b) => a.luecke - b.luecke || a.preis - b.preis);
    const sofort = kand.filter((k) => k.luecke === 0);
    zeilen.push(`Kandidaten unter 25.000 Rep: ${kand.length}, davon SOFORT verdient: ${sofort.length}`);
    zeilen.push("");
    for (const k of kand) {
      zeilen.push(`${k.luecke === 0 ? "JETZT " : "fehlt " + ns.format.number(k.luecke)} | ${k.name} | ${k.faktion}${k.drin ? "" : " (NICHT DRIN)"} | Rep ${ns.format.number(k.repReq)} | ${ns.format.number(k.preis)}`);
    }
    zeilen.push("");
    zeilen.push(`Grundpreis sofort verdienter: ${ns.format.number(sofort.reduce((x, k) => x + k.preis, 0))} (ohne 1,9-Aufschlag je Kauf)`);
    zeilen.push(`Geld: ${ns.format.number(ns.getPlayer().money)}`);
  } catch (e) {
    zeilen.push("FEHLER: " + String(e && e.message ? e.message : e));
  }

  const text = zeilen.join("\n");
  // Laeuft das Skript auf einem Mietrechner, schreibt ns.write lokal - ohne
  // scp waere die Ausgabe von aussen nicht auffindbar.
  ns.write("data/cheap.txt", text, "w");
  if (ns.getHostname() !== "home") ns.scp("data/cheap.txt", "home", ns.getHostname());
  ns.tprint("\n" + text);
}
