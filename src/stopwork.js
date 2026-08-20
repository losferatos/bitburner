/**
 * Laufende Faktionsarbeit ganz beenden - nicht nur entfokussieren.
 *
 * Der Unterschied ist der Grund fuer dieses Skript. "Do something else
 * simultaneously" nimmt nur den Fokus weg; die angezeigte Seite BLEIBT
 * Page.Work, und solange sie das ist, blendet GameRoot.tsx:328-330 die
 * Seitenleiste aus und alle Alt-Tastenkuerzel sind tot. buyaugs.js ist daran
 * am 20.08. in seiner ersten Runde haengengeblieben: Es konnte vier von fuenf
 * Faktionen nicht lesen, sah nur die Netburners und kaufte folgerichtig eine
 * Hacknet-Augmentierung, die uns nichts nuetzt.
 *
 * "Stop working" beendet die Arbeit und navigiert weg. Danach ist die
 * Oberflaeche frei.
 *
 * Faktionsreputation wird laufend gutgeschrieben (Work/FactionWork.tsx), es
 * geht also kein Teilfortschritt verloren - anders als bei Firmenarbeit.
 *
 * Aufruf:  node tools/task.js stopwork.js
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const doc = document;
  const zeilen = [];
  const sag = (t) => {
    zeilen.push(new Date().toLocaleTimeString() + "  " + t);
    ns.write("data/stopwork.txt", zeilen.join("\n") + "\n", "w");
    if (ns.getHostname() !== "home") ns.scp("data/stopwork.txt", "home", ns.getHostname());
  };

  const alle = () => [...doc.querySelectorAll("button,[role='button']")];
  const text = (b) => (b.innerText || "").trim();

  for (let versuch = 0; versuch < 4; versuch++) {
    const stop = alle().find((b) => /^Stop working$/i.test(text(b)));
    if (stop) {
      stop.click();
      await ns.sleep(1200);
      sag("Arbeit beendet (Versuch " + (versuch + 1) + ").");
      break;
    }
    // Noch nicht sichtbar? Vielleicht steht die Arbeit fokussiert und die
    // Seite zeigt etwas anderes - dann erst entfokussieren.
    const raus = alle().find((b) => text(b) === "Do something else simultaneously");
    if (raus) { raus.click(); await ns.sleep(1000); continue; }
    await ns.sleep(800);
  }

  // Beweis: Ist die Seitenleiste wieder da? Sie ist der eigentliche Zweck.
  await ns.sleep(800);
  const seitenleiste = alle().some((b) => text(b) === "Factions");
  sag(seitenleiste
    ? "Seitenleiste ist wieder da - die Oberflaeche ist frei."
    : "Seitenleiste fehlt weiterhin - die Navigation bleibt blockiert.");
}
