/**
 * archiv/entwurf/join/probe.js — misst nach, ob der Beitrittsweg aus join.js traegt.
 *
 * ============================================================================
 * WAS DU DAMIT MACHST
 * ============================================================================
 *
 *   1. Datei nach `home` bringen (z.B. ueber die Bruecke als `probe.js`).
 *   2. Damit die Messung 2 etwas findet: einmal Alt+F druecken, damit die
 *      Faktionsseite offen ist. Am besten zu einem Zeitpunkt, an dem
 *      mindestens EINE offene Einladung ansteht — sonst gibt es keinen
 *      Join!-Knopf zu vermessen und Messung 2 meldet "nichts gefunden".
 *   3. Im Spielterminal:  run probe.js
 *      Das Ergebnis steht im Terminal UND in `data/join-probe.txt`, also auch
 *      ueber die Bruecke lesbar.
 *
 * Es wird NICHTS im Spiel ausgeloest: kein Spielknopf wird geklickt, kein
 * Handler aufgerufen. Die Negativproben laufen auf einem eigenen, nach der
 * Messung wieder entfernten Knopf.
 *
 * Wer den scharfen Test will:  run probe.js --join "Tian Di Hui"
 * Das ruft join.js wirklich auf und TRITT BEI. Nur mit voller Absicht.
 *
 * WICHTIG: Dieses Skript importiert `join.js` FEST. Bitburner loest Importe
 * beim Uebersetzen auf; den JavaScript-Ausdruck `import(...)` gibt es in
 * Netscript nicht (fuer Nachladen zur Laufzeit gaebe es `ns.dynamicImport`,
 * NetscriptFunctions.ts:1514 — hier unnoetig). Beide Dateien muessen also auf
 * demselben Rechner liegen, am besten `home`, sonst startet das Skript gar
 * nicht erst.
 *
 * @param {NS} ns
 */
import { joinFaction } from "join.js";

export async function main(ns) {
  ns.disableLog("ALL");
  const doc = document;
  const win = doc.defaultView;
  const out = [];
  const say = (s) => {
    out.push(s);
    ns.tprint(s);
  };

  const wantJoin = ns.args[0] === "--join" ? String(ns.args[1] || "") : "";

  say("=== join-probe " + new Date().toISOString() + " ===");

  // --------------------------------------------------------------------
  // 1. Legt React 17 die Props wirklich auf dem DOM-Knoten ab?
  //    Erwartung: ja, unter "__reactProps$<zufall>" und "__reactFiber$<zufall>".
  //    Gemessen an irgendeinem Knopf der Seite, damit die Messung auch dann
  //    laeuft, wenn gerade keine Einladung offen ist.
  // --------------------------------------------------------------------
  const anyBtn = doc.querySelector("button");
  if (!anyBtn) {
    say("1. KEIN Knopf auf der Seite — Messung nicht moeglich.");
  } else {
    const keys = Object.keys(anyBtn).filter((k) => k.startsWith("__react"));
    say("1. React-Schluessel am DOM-Knopf: " + (keys.join(", ") || "KEINE — React-Fassung geaendert?"));
    const pk = keys.find((k) => k.startsWith("__reactProps$"));
    if (pk) {
      const p = anyBtn[pk];
      say("   Props-Objekt vorhanden, Felder: " + Object.keys(p).slice(0, 12).join(", "));
      say("   typeof props.onClick = " + typeof p.onClick);
    }
  }

  // --------------------------------------------------------------------
  // 2. Der Join!-Knopf selbst. Das ist die Kernmessung.
  //    Erwartung: props.onClick ist eine Funktion mit einem Parameter, und
  //    ihr Quelltext enthaelt einen Aufruf mit zwei Argumenten — die
  //    minifizierte Fassung von `(e) => acceptInvitation(e, props.faction.name)`.
  // --------------------------------------------------------------------
  const label = (el) => (el.innerText || el.textContent || "").trim();
  const scope = doc.querySelector("span.factions-invites") || doc;
  const joinBtns = [...scope.querySelectorAll("button")].filter((b) => label(b) === "Join!");
  say("2. Join!-Knoepfe auf der Seite: " + joinBtns.length);
  if (!doc.querySelector("span.factions-invites") && !doc.querySelector("span.factions-joined")) {
    say("   HINWEIS: Die Faktionsseite ist nicht offen. Alt+F druecken und erneut messen.");
  }
  if (joinBtns.length) {
    const b = joinBtns[0];
    const card = b.closest(".MuiPaper-root");
    say("   erste Karte: " + JSON.stringify((card?.innerText || "").replace(/\n/g, " | ").slice(0, 90)));
    const pk = Object.keys(b).find((k) => k.startsWith("__reactProps$"));
    const oc = pk ? b[pk].onClick : undefined;
    say("   typeof onClick = " + typeof oc + ", Parameterzahl = " + (typeof oc === "function" ? oc.length : "-"));
    if (typeof oc === "function") {
      say("   Quelltext: " + String(oc).replace(/\s+/g, " ").slice(0, 200));
    }

    // Die Fiber-Kette darueber: sitzt derselbe Handler auch weiter oben?
    // Wenn ja, ist die Rueckfallebene in join.js belegt.
    const fk = Object.keys(b).find((k) => k.startsWith("__reactFiber$"));
    let f = fk ? b[fk] : null;
    const chain = [];
    for (let i = 0; f && i < 10; i++) {
      const t = typeof f.type === "function" ? f.type.name || "(anonym)" : String(f.type);
      const h = f.memoizedProps && typeof f.memoizedProps.onClick === "function";
      chain.push(`${i}:${t}${h ? (f.memoizedProps.onClick === oc ? "[onClick=gleich]" : "[onClick=anders]") : ""}`);
      f = f.return;
    }
    say("   Fiber-Kette: " + chain.join(" -> "));
  }

  // --------------------------------------------------------------------
  // 3. Steht das Einladungsfenster gerade offen?
  //    Erwartung: nur, wenn eine Einladung frisch eingetroffen und noch nicht
  //    weggeklickt wurde. Es hat KEINEN Zeitablauf.
  // --------------------------------------------------------------------
  const modals = [...doc.querySelectorAll(".MuiModal-root, [role='presentation']")].filter((m) =>
    (m.innerText || "").includes("You received a faction invitation"),
  );
  say("3. Einladungsfenster offen: " + (modals.length ? "JA" : "nein"));
  if (modals.length) {
    say("   Text: " + (modals[0].innerText || "").replace(/\n/g, " | ").slice(0, 120));
  }

  // --------------------------------------------------------------------
  // 4. Negativproben — auf einem EIGENEN Knopf, nie auf einem Spielknopf.
  //    Erwartung durchgehend: kein Weg erzeugt isTrusted === true.
  // --------------------------------------------------------------------
  const probe = doc.createElement("button");
  probe.id = "join-probe-button";
  probe.textContent = "probe";
  probe.style.cssText = "position:fixed;top:-500px;left:-500px;width:10px;height:10px;";
  doc.body.appendChild(probe);
  const seen = [];
  const listener = (e) => {
    seen.push(e.type + ":isTrusted=" + e.isTrusted);
    e.stopPropagation();
    e.preventDefault();
  };
  for (const t of ["click", "keydown", "keyup"]) probe.addEventListener(t, listener, true);

  try {
    // 4a: element.click()
    seen.length = 0;
    probe.click();
    say("4a. element.click(): " + (seen.join(", ") || "kein Ereignis"));

    // 4b: dispatchEvent mit MouseEvent
    seen.length = 0;
    probe.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    say("4b. dispatchEvent(MouseEvent): " + (seen.join(", ") || "kein Ereignis"));

    // 4c: isTrusted an der Instanz ueberschreiben
    let msg = "kein Fehler — DAS WAERE NEU";
    try {
      const ev = new MouseEvent("click");
      Object.defineProperty(ev, "isTrusted", { value: true });
      msg = "ging durch, isTrusted=" + ev.isTrusted;
    } catch (e) {
      msg = e.name + ": " + e.message;
    }
    say("4c. defineProperty(ev,'isTrusted'): " + msg);

    // 4d: Tastatur auf fokussiertem Knopf — erzeugt der Browser einen Klick?
    //     Erwartung: NEIN. Die Umsetzung Taste->Klick ist eine
    //     Voreinstellungshandlung des Browsers und laeuft nur fuer echte
    //     Tastenereignisse.
    seen.length = 0;
    probe.focus();
    for (const k of ["Enter", " "]) {
      probe.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
      probe.dispatchEvent(new KeyboardEvent("keyup", { key: k, bubbles: true, cancelable: true }));
    }
    await ns.sleep(200);
    const gotClick = seen.some((s) => s.startsWith("click"));
    say("4d. synthetisches Enter/Leertaste auf fokussiertem <button>: " + (seen.join(", ") || "nichts"));
    say("    -> Klick daraus entstanden: " + (gotClick ? "JA (unerwartet!)" : "nein (erwartet)"));
  } finally {
    for (const t of ["click", "keydown", "keyup"]) probe.removeEventListener(t, listener, true);
    probe.remove();
    say("4z. Messknopf entfernt: " + (doc.getElementById("join-probe-button") ? "NEIN" : "ja"));
  }

  // --------------------------------------------------------------------
  // 5. Rueckfallebenen: gibt es einen Zugang zur Modulregistrierung?
  //    Nur zur Information — join.js braucht das nicht.
  // --------------------------------------------------------------------
  say("5. window.webpackChunkbitburner: " + typeof win.webpackChunkbitburner);
  say("   window.Bitburner (nur im Entwicklerbau): " + typeof win.Bitburner);

  // --------------------------------------------------------------------
  // 6. Spielstand als Gegenprobe — das ist die einzige Wahrheit.
  // --------------------------------------------------------------------
  const p = ns.getPlayer();
  say("6. Player.factions = " + JSON.stringify(p.factions));

  // --------------------------------------------------------------------
  // 7. Scharfer Test, nur auf ausdrueckliche Ansage.
  // --------------------------------------------------------------------
  if (wantJoin) {
    say("7. SCHARFER TEST: trete '" + wantJoin + "' bei ...");
    const res = await joinFaction({
      doc,
      factionName: wantJoin,
      sleep: (ms) => ns.sleep(ms),
      isMember: () => ns.getPlayer().factions.includes(wantJoin),
      allowUnfocus: true,
      returnToTerminal: false,
    });
    say("   Ergebnis: ok=" + res.ok + " weg=" + res.how + " grund=" + (res.reason || "-"));
    for (const z of res.log) say("   | " + z);
    say("   Player.factions danach = " + JSON.stringify(ns.getPlayer().factions));
  } else {
    say("7. scharfer Test nicht angefordert (dafuer: run probe.js --join \"<Faktion>\").");
  }

  // ns.write schreibt IMMER auf dem Rechner, auf dem das Skript laeuft. Wenn
  // das nicht home ist, liest die Bruecke die Datei sonst nie. Derselbe
  // Fallstrick wie in src/hand.js.
  const here = ns.getHostname();
  ns.write("data/join-probe.txt", out.join("\n"), "w");
  if (here !== "home") ns.scp("data/join-probe.txt", "home", here);
  ns.tprint("--> auch geschrieben nach data/join-probe.txt (home)");
}
