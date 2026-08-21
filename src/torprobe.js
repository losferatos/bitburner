/**
 * Diagnose fuer den TOR-Kauf.
 *
 * darkweb.js klickt den Knopf seit einer Stunde und meldet jedes Mal
 * "geklickt, er zeigt aber weiter einen Preis". Der Knopf ist ein
 * gewoehnlicher MUI-Button mit onClick={buy} (Locations/ui/TorButton.tsx),
 * es sollte also gehen. Diese Datei schaut nach, statt weiter zu raten:
 * Wie heisst der Knopf genau, ist er gesperrt, was passiert beim Klick?
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const doc = document;
  const zeilen = [];
  const sag = (t) => {
    zeilen.push(t);
    ns.write("data/torprobe.txt", zeilen.join("\n") + "\n", "w");
    if (ns.getHostname() !== "home") ns.scp("data/torprobe.txt", "home", ns.getHostname());
  };
  const knoepfe = () => [...doc.querySelectorAll("button")];
  const text = (b) => (b.innerText || b.textContent || "").trim();

  sag("Geld: " + ns.formatNumber(ns.getServerMoneyAvailable("home")));

  // Zur Stadt
  doc.dispatchEvent(new KeyboardEvent("keydown", { key: "o", altKey: true, bubbles: true }));
  await ns.sleep(1500);

  const treffer = knoepfe().filter((b) => /TOR/i.test(text(b)));
  sag("Knoepfe mit 'TOR': " + treffer.length);
  for (const b of treffer) {
    sag("  [" + text(b).replace(/\s+/g, " ") + "]"
      + " disabled=" + b.disabled
      + " tag=" + b.tagName
      + " klassen=" + (b.className || "").slice(0, 60));
  }
  if (!treffer.length) {
    // Vielleicht ist die Stadtseite gar nicht offen. Was steht da?
    sag("Seitentext (Anfang): " + (doc.body.innerText || "").slice(0, 300).replace(/\s+/g, " "));
    return;
  }

  const k = treffer[0];
  sag("--- Klickversuch 1: einfaches click() ---");
  k.click();
  await ns.sleep(1500);
  sag("danach: [" + text(knoepfe().find((b) => /TOR/i.test(text(b))) || {}).replace(/\s+/g, " ") + "]");

  // Zweiter Versuch: ueber die React-Props, wie joinfac.js es macht. Ein
  // gewoehnlicher Klick scheitert dort an der isTrusted-Sperre; vielleicht
  // gilt das hier auch.
  sag("--- Klickversuch 2: React-Handler direkt ---");
  const schluessel = Object.keys(k).find((s) => s.startsWith("__reactProps$"));
  if (!schluessel) {
    sag("Kein __reactProps$-Schluessel am Knopf gefunden.");
    return;
  }
  const props = k[schluessel];
  sag("Props: " + Object.keys(props).join(", "));
  if (typeof props.onClick === "function") {
    try {
      props.onClick({ isTrusted: true, preventDefault() {}, stopPropagation() {} });
      await ns.sleep(1500);
      sag("danach: [" + text(knoepfe().find((b) => /TOR/i.test(text(b))) || {}).replace(/\s+/g, " ") + "]");
    } catch (e) {
      sag("onClick warf: " + e.message);
    }
  } else {
    sag("props.onClick ist keine Funktion: " + typeof props.onClick);
  }
}
