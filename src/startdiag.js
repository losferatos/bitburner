/**
 * Warum startet ein Werkzeug nicht? - die Frage aus dem Spiel heraus
 * beantwortet.
 *
 * ===========================================================================
 * DER ANLASS
 * ===========================================================================
 *
 * Am 04.09.2026 wurde `ausgang.js` bei der Einspielung neu gestartet. Der
 * Kern hat es gekillt, quittiert - und nie wieder gestartet. Von aussen war
 * nicht zu entscheiden, woran es lag: Uebersetzungsfehler, Speichermangel,
 * Startbedingung, oder ein Werkzeug, das sich sofort selbst beendet. Jede
 * dieser Ursachen sieht in der Prozessliste gleich aus, naemlich nach nichts.
 *
 * Der Kern selbst kennt die Antwort - er ruft `ns.getScriptRam` auf und
 * springt bei 0 weiter (`if (!(braucht > 0)) ... continue`). Ein
 * Uebersetzungsfehler ist damit von aussen NICHT von "passt nirgends hin" zu
 * unterscheiden, und beides nicht von "laeuft und beendet sich sofort".
 *
 * Dieses Skript fragt dieselben Funktionen und schreibt die Antwort nach
 * `data/startdiag.json`, wo die Bruecke sie lesen kann.
 *
 * ===========================================================================
 * WAS DIE ZAHLEN BEDEUTEN
 * ===========================================================================
 *
 *   ramGb === 0     Die Datei ist NICHT UEBERSETZBAR. Entweder ein
 *                   Syntaxfehler, oder ein Import, der auf diesem Rechner
 *                   nicht liegt - Bitburner loest Importe beim Uebersetzen
 *                   auf und braucht die Datei auf DEMSELBEN Host.
 *   ramGb > frei    Es passt hier nicht hin. Dann sagt `passtAuf`, wo sonst.
 *   passtAuf leer   Es passt NIRGENDS. Warten hilft nicht.
 *
 * Es wird nichts gestartet, nichts beendet, nichts geschrieben ausser der
 * Ergebnisdatei. Reine Messung.
 *
 * Aufruf:  node tools/task.js startdiag.js
 *          (danach data/startdiag.json ueber die Bruecke lesen)
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");

  // Die Liste steht als Vorgabe hier, laesst sich aber ueberschreiben:
  //   node tools/task.js startdiag.js ausgang.js blade.js
  const VORGABE = [
    "ausgang.js", "exit.js", "popups.js", "blade.js", "bbtrain.js",
    "bn4life.js", "bn4rep.js", "contracts.js", "figwatch.js", "graftauto.js",
    "guard.js", "boot.js", "wakelock.js", "shop.js", "punish.js",
  ];
  const ziele = ns.args.length ? ns.args.map(String) : VORGABE;

  // Alle Rechner einsammeln - ein Werkzeug muss nicht auf home passen.
  const alle = [];
  {
    const offen = ["home"], bekannt = new Set(["home"]);
    while (offen.length) {
      const h = offen.pop();
      alle.push(h);
      for (const n of ns.scan(h)) if (!bekannt.has(n)) { bekannt.add(n); offen.push(n); }
    }
  }
  const frei = (h) => ns.getServerMaxRam(h) - ns.getServerUsedRam(h);

  const laufend = new Map();
  for (const h of alle) {
    if (!ns.hasRootAccess(h)) continue;
    for (const pr of ns.ps(h)) {
      if (!laufend.has(pr.filename)) laufend.set(pr.filename, []);
      laufend.get(pr.filename).push({ host: h, pid: pr.pid });
    }
  }

  const zeilen = [];
  for (const z of ziele) {
    const daHome = ns.fileExists(z, "home");
    // WICHTIG: gegen "home" messen. `getScriptRam` braucht die Datei auf dem
    // gefragten Rechner; auf einem Rechner ohne die Datei kaeme 0 heraus und
    // saehe aus wie ein Uebersetzungsfehler.
    let ramGb = 0;
    try { ramGb = daHome ? ns.getScriptRam(z, "home") : 0; } catch { ramGb = 0; }

    const passtAuf = [];
    if (ramGb > 0) {
      for (const h of alle) {
        if (!ns.hasRootAccess(h)) continue;
        if (frei(h) >= ramGb) passtAuf.push({ host: h, freiGb: Math.round(frei(h) * 10) / 10 });
      }
      passtAuf.sort((a, b) => b.freiGb - a.freiGb);
    }

    zeilen.push({
      datei: z,
      aufHome: daHome,
      ramGb: Math.round(ramGb * 100) / 100,
      uebersetzbar: ramGb > 0,
      laeuft: laufend.get(z) || [],
      passtAufAnzahl: passtAuf.length,
      passtAuf: passtAuf.slice(0, 5),
      urteil: !daHome ? "liegt nicht auf home"
        : ramGb === 0 ? "NICHT UEBERSETZBAR (Syntax oder fehlender Import auf home)"
          : (laufend.get(z) || []).length ? "laeuft"
            : passtAuf.length ? "uebersetzbar und passt - startet also nicht aus einem anderen Grund"
              : "passt NIRGENDS (" + ramGb.toFixed(1) + " GB)",
    });
  }

  ns.write("data/startdiag.json", JSON.stringify({
    zeit: Date.now(),
    freiHomeGb: Math.round(frei("home") * 10) / 10,
    maxHomeGb: ns.getServerMaxRam("home"),
    zeilen,
  }), "w");
  if (ns.getHostname() !== "home") ns.scp("data/startdiag.json", "home", ns.getHostname());

  for (const z of zeilen) ns.tprint(z.datei + ": " + z.urteil);
}
