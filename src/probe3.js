/**
 * Diagnose: Was passiert beim Klick auf den TOR-Knopf wirklich?
 *
 * darkweb.js meldet seit dem Reset "TOR-Knopf geklickt, aber darkweb bleibt
 * unerreichbar". Der Knopf wird also gefunden und ist nicht gesperrt - und
 * trotzdem passiert nichts. Zwei Vermutungen sind schon widerlegt (eine
 * Tooltip-Huelle wie bei der Boerse gibt es hier nicht, und work.js ist
 * stillgelegt). Statt einer dritten: nachsehen.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const doc = document;
  const zeilen = [];
  const sag = (t) => {
    zeilen.push(t);
    ns.write("data/probe3.txt", zeilen.join("\n") + "\n", "w");
    if (ns.getHostname() !== "home") ns.scp("data/probe3.txt", "home", ns.getHostname());
  };
  const alle = () => [...doc.querySelectorAll("button,[role='button']")];
  const text = (b) => (b.innerText || "").replace(/\s+/g, " ").trim();

  sag("Guthaben: $" + Math.round(ns.getServerMoneyAvailable("home")));
  sag("darkweb in scan(home) vorher: " + ns.scan("home").includes("darkweb"));

  const raus = alle().find((b) => text(b) === "Do something else simultaneously");
  if (raus) { raus.click(); await ns.sleep(1000); sag("entfokussiert"); }

  doc.dispatchEvent(new KeyboardEvent("keydown", { key: "w", altKey: true, bubbles: true }));
  await ns.sleep(1800);
  const ort = alle().find((b) => text(b) === "Alpha Enterprises");
  sag("Alpha Enterprises: " + (ort ? "gefunden" : "NICHT gefunden"));
  if (!ort) return;
  ort.click();
  await ns.sleep(2500);

  const finde = () => alle().find((b) => /^Purchase TOR router/i.test(text(b)));
  const vorher = finde();
  if (!vorher) {
    sag("TOR-Knopf NICHT auf der Seite. Sichtbare Knoepfe:");
    for (const b of alle()) { const t = text(b); if (t && t.length < 60) sag("  " + JSON.stringify(t)); }
    return;
  }
  sag("TOR-Knopf vorher: " + JSON.stringify(text(vorher))
    + "  tag=" + vorher.tagName + "  disabled=" + !!vorher.disabled);

  // Drei Klickarten nacheinander - die erste, die wirkt, gewinnt.
  vorher.click();
  await ns.sleep(2000);
  let jetzt = finde();
  sag("nach .click():   " + (jetzt ? JSON.stringify(text(jetzt)) : "Knopf weg")
    + "  scan: " + ns.scan("home").includes("darkweb"));

  if (jetzt && !/Purchased/i.test(text(jetzt))) {
    // Echtes Mausereignis statt der Kurzform - manche Handler haengen an
    // mousedown/mouseup statt an click.
    for (const art of ["pointerdown", "mousedown", "mouseup", "click"]) {
      jetzt.dispatchEvent(new MouseEvent(art, { bubbles: true, cancelable: true, view: doc.defaultView }));
      await ns.sleep(120);
    }
    await ns.sleep(2000);
    jetzt = finde();
    sag("nach MouseEvent: " + (jetzt ? JSON.stringify(text(jetzt)) : "Knopf weg")
      + "  scan: " + ns.scan("home").includes("darkweb"));
  }

  if (jetzt && !/Purchased/i.test(text(jetzt))) {
    // React haengt seinen Handler an die Props des Elements, nicht ans DOM.
    // Genau das ist der Weg, mit dem join.js die isTrusted-Sperre umgeht.
    const schluessel = Object.keys(jetzt).find((k) => k.startsWith("__reactProps$"));
    sag("reactProps-Schluessel: " + (schluessel || "KEINER"));
    if (schluessel) {
      const props = jetzt[schluessel];
      sag("onClick vorhanden: " + typeof (props && props.onClick));
      try {
        if (props && typeof props.onClick === "function") {
          props.onClick({ isTrusted: true, preventDefault() {}, stopPropagation() {} });
          await ns.sleep(2000);
          jetzt = finde();
          sag("nach onClick():  " + (jetzt ? JSON.stringify(text(jetzt)) : "Knopf weg")
            + "  scan: " + ns.scan("home").includes("darkweb"));
        }
      } catch (e) { sag("onClick warf: " + e); }
    }
  }
  sag("ENDE. darkweb erreichbar: " + ns.scan("home").includes("darkweb"));
}
