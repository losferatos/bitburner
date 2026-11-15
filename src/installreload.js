/**
 * Einbaurunde OHNE SF4 und ohne Browser-Fernsteuerung (15.11.2026, BN1.1 Lauf 2).
 *
 * Ablauf, der am 14./15.11. von Hand ueber Opera funktioniert hat:
 *   Install Augmentations -> SPEICHERN (Knopf "save game") -> Spielstand in
 *   IndexedDB pruefen -> Seite neu laden (Autoexec coldstart.js -> boot.js).
 *
 * Warum aus dem Spiel heraus: Am 15.11. um 12:38 blieb das Neuladen an der
 * Rueckfrage "Seite verlassen?" haengen (window.onbeforeunload, vom Spiel
 * gesetzt), und die Opera-Fernsteuerung fror danach ganz ein. Ohne sie gab es
 * keinen Weg mehr zum Einbau.
 *
 * Der Einbau beendet JEDES Skript, auch dieses. Deshalb haengt der zweite Teil
 * (speichern, pruefen, neu laden) an einem setTimeout im Seitenkontext - der
 * ueberlebt das Skriptende (AugmentationHelpers.ts: prestige ruft kein
 * clearTimeout und kein reload; Begruendung wie in keepalive.js).
 *
 * Sicherungen:
 *   - Neu geladen wird NUR, wenn der gespeicherte Stand den Einbau zeigt
 *     (Warteschlange leer, Hacking 1). Sonst bleibt die Seite stehen und
 *     localStorage "installreload" sagt warum - lieber ein stehender Bot als
 *     ein Reload, der den Einbau verwirft (passiert 14.11. 17:12).
 *   - onbeforeunload wird erst unmittelbar vor dem Reload geleert.
 *
 * Aufruf:  node tools/task.js installreload.js --dry
 *          node tools/task.js installreload.js
 * Bericht: data/installreload.txt (bis zum Einbau), danach localStorage.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const doc = document;
  const win = doc.defaultView;
  const trocken = ns.args.map(String).includes("--dry");
  const zeilen = [];
  const sag = (t) => {
    zeilen.push(new Date().toLocaleTimeString() + "  " + t);
    ns.write("data/installreload.txt", zeilen.join("\n") + "\n", "w");
    if (ns.getHostname() !== "home") ns.scp("data/installreload.txt", "home", ns.getHostname());
  };
  const knoepfe = () => [...doc.querySelectorAll("button")];
  const text = (b) => (b.innerText || "").trim();

  // Arbeitsseite verlassen, sonst fehlt die Seitenleiste (GameRoot.tsx:328-330).
  const raus = knoepfe().find((b) => text(b) === "Do something else simultaneously");
  if (raus) { raus.click(); await ns.sleep(1000); }
  doc.dispatchEvent(new KeyboardEvent("keydown", { key: "a", altKey: true, bubbles: true }));
  await ns.sleep(1400);

  const installKnopf = knoepfe().find((b) => text(b) === "Install Augmentations");
  if (!installKnopf) return sag("ABBRUCH: Knopf 'Install Augmentations' nicht gefunden.");
  if (installKnopf.disabled) return sag("ABBRUCH: Warteschlange leer (Knopf deaktiviert).");
  const speichern = doc.querySelector('[aria-label="save game"]');
  if (!speichern) return sag("ABBRUCH: Speicherknopf [aria-label=\"save game\"] nicht gefunden.");
  if (trocken) return sag("Trockenlauf: Install- und Speicherknopf gefunden, nichts geklickt.");

  // --- Teil 2 vorbereiten: laeuft im Seitenkontext weiter ------------------
  const melde = (t) => {
    try { win.localStorage.setItem("installreload", new Date().toISOString() + " " + t); } catch { /* egal */ }
  };
  const lies = () => new Promise((res, rej) => {
    const q = win.indexedDB.open("bitburnerSave");
    q.onerror = () => rej(q.error);
    q.onsuccess = () => {
      try {
        const t = q.result.transaction("savestring", "readonly").objectStore("savestring").get("save");
        t.onerror = () => rej(t.error);
        t.onsuccess = () => res(t.result);
      } catch (e) { rej(e); }
    };
  });
  const pruefe = async () => {
    const v = await lies();
    let roh = v;
    if (v instanceof Uint8Array || v instanceof ArrayBuffer) {
      const s = new win.Blob([v]).stream().pipeThrough(new win.DecompressionStream("gzip"));
      roh = await new win.Response(s).text();
    }
    let j = JSON.parse(roh);
    if (typeof j === "string") j = JSON.parse(j);
    const pl = JSON.parse(j.data.PlayerSave).data;
    return { queued: (pl.queuedAugmentations || []).length, hack: pl.skills.hacking, inst: (pl.augmentations || []).length };
  };
  const teil2 = async (versuch) => {
    try {
      const k = doc.querySelector('[aria-label="save game"]');
      if (k) k.click();
      await new Promise((r) => win.setTimeout(r, 3000));
      const s = await pruefe();
      if (s.queued === 0 && s.hack <= 1) {
        melde("ok: gespeichert (installiert " + s.inst + "), lade neu");
        win.onbeforeunload = null;
        win.location.reload();
        return;
      }
      melde("Versuch " + versuch + ": Stand zeigt den Einbau nicht (queued " + s.queued + ", hack " + s.hack + ")");
    } catch (e) {
      melde("Versuch " + versuch + ": Fehler " + String(e));
    }
    if (versuch < 3) win.setTimeout(() => teil2(versuch + 1), 5000);
    else melde("AUFGEGEBEN: nicht neu geladen - Bot steht, Seite von Hand neu laden nach Pruefung");
  };

  sag("INSTALLIERE. Danach speichert und laedt ein Seiten-Timer neu (localStorage 'installreload').");
  melde("Einbau ausgeloest");
  win.setTimeout(() => teil2(1), 4000);
  installKnopf.click();
  await ns.sleep(1200);
  const confirm = knoepfe().find((b) => text(b) === "Confirm");
  if (confirm) confirm.click();
  await ns.sleep(3000);
}
