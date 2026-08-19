/**
 * nightshift/trustcheck.js — misst nach, ob `clickTrusted()` wirklich einen
 * vertrauenswuerdigen Klick erzeugt, und ob die Verdeckungspruefung greift.
 *
 * Das ist die offene Frage aus `doku/oberflaeche.md`, Abschnitt 10, Punkt 1:
 * sechs Stellen im Spiel verwerfen Klicks mit `event.isTrusted === false`
 * kommentarlos. Wenn dieser Weg keinen echten Klick erzeugt, kann der
 * Nachtdienst weder Faktionen beitreten noch Verbrechen starten — und wuerde
 * es nicht einmal merken.
 *
 * WIE HIER GEMESSEN WIRD, OHNE IM SPIEL ETWAS AUSZULOESEN
 *
 * Es wird NICHT auf einen Knopf des Spiels geklickt. Stattdessen:
 *   1. eine eigene Flaeche wird ueber die Seite gelegt (`position: fixed`,
 *      hoechster z-index) — sie liegt garantiert oben, der Klick kann also
 *      kein Spielelement treffen;
 *   2. zusaetzlich faengt ein Lauscher in der Capture-Phase auf `window` jedes
 *      Zeigerereignis ab und stoppt es dort (`stopPropagation`), bevor es den
 *      React-Wurzelknoten erreichen koennte — doppelte Sicherung;
 *   3. gemessen wird nur `event.isTrusted`;
 *   4. danach werden Flaeche und Lauscher rueckstandsfrei entfernt.
 *
 * Am Spielstand aendert sich dabei nichts.
 *
 * Aufruf:  node nightshift/trustcheck.js
 */

import { BitburnerTab, ElementError } from "./cdp.js";

const PROBE_ID = "nightshift-trustprobe";
const COVER_ID = "nightshift-trustcover";

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`  [${ok ? "OK  " : "FEHL"}] ${name}${detail ? " — " + detail : ""}`);
}

const tab = new BitburnerTab();

/** Messflaeche und Lauscher einbauen. */
const install = `() => {
  const make = (id, top, left, color) => {
    const d = document.createElement("div");
    d.id = id;
    d.style.cssText = "position:fixed;top:" + top + "px;left:" + left + "px;width:160px;height:80px;" +
      "z-index:2147483647;background:" + color + ";pointer-events:auto;";
    d.textContent = id;
    document.body.appendChild(d);
    return d;
  };
  make(${JSON.stringify(PROBE_ID)}, 40, 40, "rgba(0,0,0,0.01)");

  window.__nightshiftTrust = { events: [] };
  window.__nightshiftBlocker = (e) => {
    // Nur was auf unserer Messflaeche landet, wird gemessen und geschluckt.
    const probe = document.getElementById(${JSON.stringify(PROBE_ID)});
    const cover = document.getElementById(${JSON.stringify(COVER_ID)});
    const onProbe = probe && (e.target === probe || probe.contains(e.target));
    const onCover = cover && (e.target === cover || cover.contains(e.target));
    if (!onProbe && !onCover) return;
    window.__nightshiftTrust.events.push({ type: e.type, isTrusted: e.isTrusted, x: e.clientX, y: e.clientY });
    e.stopPropagation();
    e.preventDefault();
  };
  for (const t of ["pointerdown","pointerup","mousedown","mouseup","click"]) {
    window.addEventListener(t, window.__nightshiftBlocker, true);
  }
  return true;
}`;

const cleanup = `() => {
  for (const id of [${JSON.stringify(PROBE_ID)}, ${JSON.stringify(COVER_ID)}]) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }
  if (window.__nightshiftBlocker) {
    for (const t of ["pointerdown","pointerup","mousedown","mouseup","click"]) {
      window.removeEventListener(t, window.__nightshiftBlocker, true);
    }
    delete window.__nightshiftBlocker;
  }
  delete window.__nightshiftTrust;
  return !document.getElementById(${JSON.stringify(PROBE_ID)});
}`;

console.log("Messung: erzeugt clickTrusted() einen echten Klick?");
console.log("(klickt ausschliesslich auf eine eigene Flaeche, nie auf das Spiel)\n");

try {
  await tab.connect();
  await tab.eval(install);

  // -- 1. Der eigentliche Punkt: isTrusted ---------------------------------
  //
  // Zweimal gemessen, weil davon die Vorgabe fuer den Nachtdienst abhaengt:
  // einmal ohne und einmal mit `bringToFront`. Kommt der Klick nur mit
  // `bringToFront` an, muss der Dienst den Tab vor jedem Klick nach vorn
  // holen — dann ist paralleles Arbeiten mit dem zweiten Projekt im selben
  // Browser nicht folgenlos moeglich, und das muss man wissen.
  for (const bringToFront of [false, true]) {
    const label = `1${bringToFront ? "b" : "a"}. clickTrusted (bringToFront=${bringToFront})`;
    try {
      await tab.eval("() => { window.__nightshiftTrust.events = []; return true; }");
      const before = await tab.eval(
        "() => ({ focus: document.hasFocus(), vis: document.visibilityState })",
      );
      await tab.clickTrusted(`#${PROBE_ID}`, { bringToFront });
      const seen = await tab.eval("() => window.__nightshiftTrust.events");
      const click = seen.find((e) => e.type === "click");
      const down = seen.find((e) => e.type === "pointerdown");
      // `mousedown`/`mouseup` fehlen hier absichtlich: der Lauscher ruft auf
      // `pointerdown` `preventDefault()` auf, und das unterdrueckt die alten
      // Maus-Ereignisse. Das ist eine Eigenart DIESER Messung, nicht des
      // Klicks — im Spiel wird nichts unterdrueckt.
      const detail =
        `Tab-Fokus=${before.focus}, Sichtbarkeit=${before.vis} | ` +
        (seen.length ? seen.map((e) => `${e.type}:${e.isTrusted}`).join(", ") : "KEIN Ereignis angekommen");
      record(label, !!click && !!down && click.isTrusted === true && down.isTrusted === true, detail);
    } catch (e) {
      record(label, false, `${e.name}: ${e.message}`);
    }
  }

  // -- 2. Gegenprobe: element.click() ist NICHT vertrauenswuerdig ----------
  try {
    await tab.eval(`() => { window.__nightshiftTrust.events = []; document.getElementById(${JSON.stringify(PROBE_ID)}).click(); return true; }`);
    const seen = await tab.eval("() => window.__nightshiftTrust.events");
    const click = seen.find((e) => e.type === "click");
    record(
      "2. Gegenprobe: element.click() liefert isTrusted === false",
      !!click && click.isTrusted === false,
      click ? `click:${click.isTrusted}` : "kein Ereignis angekommen",
    );
  } catch (e) {
    record("2. Gegenprobe: element.click() liefert isTrusted === false", false, `${e.name}: ${e.message}`);
  }

  // -- 3. Verdeckungspruefung: verdecktes Element wird NICHT geklickt ------
  try {
    await tab.eval(`() => {
      window.__nightshiftTrust.events = [];
      const d = document.createElement("div");
      d.id = ${JSON.stringify(COVER_ID)};
      d.style.cssText = "position:fixed;top:40px;left:40px;width:160px;height:80px;z-index:2147483647;background:rgba(0,0,0,0.01);";
      document.body.appendChild(d);
      return true;
    }`);
    let thrown = null;
    try {
      await tab.clickTrusted(`#${PROBE_ID}`);
    } catch (e) {
      thrown = e;
    }
    const seen = await tab.eval("() => window.__nightshiftTrust.events");
    const ok = thrown instanceof ElementError && seen.length === 0;
    record(
      "3. verdecktes Element: Fehler statt Blindklick",
      ok,
      thrown
        ? `${thrown.name}, ${seen.length} Ereignisse abgeschickt`
        : "es wurde trotz Verdeckung geklickt — das waere schlecht",
    );
  } catch (e) {
    record("3. verdecktes Element: Fehler statt Blindklick", false, `${e.name}: ${e.message}`);
  }

  // -- 4. Die entscheidende Frage: klappt es auch im HINTERGRUND? ----------
  //
  // Im selben Browser laeuft NEONBREAK. Holt sich dieses Projekt den Fokus,
  // liegt der Bitburner-Tab im Hintergrund. Wenn Klicks dann nicht mehr
  // ankommen, muss der Nachtdienst den Tab vor jedem Klick nach vorn holen —
  // und damit dem anderen Projekt dauernd den Fokus wegnehmen.
  //
  // Gemessen wird, indem kurz ein anderer, unbeteiligter Tab nach vorn geholt
  // wird. Am Ende steht Bitburner wieder vorn, wie vorher.
  try {
    await tab.eval(`() => { document.getElementById(${JSON.stringify(COVER_ID)})?.remove(); window.__nightshiftTrust.events = []; return true; }`);

    const { targetInfos } = await tab._send("Target.getTargets", {});
    const other = targetInfos.find(
      (t) =>
        t.type === "page" &&
        t.targetId !== tab.targetId &&
        /^https?:/.test(t.url) &&
        !t.url.includes("bitburner") &&
        !t.url.includes("8785"), // NEONBREAK bleibt unangetastet
    );
    if (!other) throw new Error("kein unbeteiligter Tab zum Wegklicken gefunden");

    const { sessionId: otherSession } = await tab._send("Target.attachToTarget", {
      targetId: other.targetId,
      flatten: true,
    });
    await tab._send("Page.bringToFront", {}, { sessionId: otherSession });
    await new Promise((r) => setTimeout(r, 600));

    const state = await tab.eval("() => ({ focus: document.hasFocus(), vis: document.visibilityState })");
    await tab.clickTrusted(`#${PROBE_ID}`, { bringToFront: false });
    const seen = await tab.eval("() => window.__nightshiftTrust.events");
    const click = seen.find((e) => e.type === "click");

    // Zustand wiederherstellen: Bitburner wieder nach vorn, fremde Sitzung loesen.
    await tab._send("Page.bringToFront", {}, { sessionId: tab.sessionId }).catch(() => {});
    await tab._send("Target.detachFromTarget", { sessionId: otherSession }).catch(() => {});

    const wasBackground = state.vis === "hidden" || state.focus === false;
    record(
      "4. Klick kommt an, waehrend der Tab im Hintergrund liegt",
      !!click && click.isTrusted === true,
      `Tab war ${wasBackground ? "im Hintergrund" : "NICHT im Hintergrund (Messung nicht aussagekraeftig)"} ` +
        `(Fokus=${state.focus}, Sichtbarkeit=${state.vis}) | ` +
        (seen.length ? seen.map((e) => `${e.type}:${e.isTrusted}`).join(", ") : "KEIN Ereignis angekommen"),
    );
  } catch (e) {
    record("4. Klick kommt an, waehrend der Tab im Hintergrund liegt", false, `${e.name}: ${e.message}`);
  }
} catch (e) {
  console.log(`\nABBRUCH: ${e.name}: ${e.message}`);
  results.push({ name: "Aufbau", ok: false, detail: e.message });
} finally {
  // Aufraeumen ist Pflicht — es darf nichts von der Messung im Spiel bleiben.
  try {
    const clean = await tab.eval(cleanup);
    console.log(`\n  Messflaeche und Lauscher entfernt: ${clean ? "ja" : "NEIN — bitte nachsehen"}`);
  } catch (e) {
    console.log(`\n  ACHTUNG: Aufraeumen fehlgeschlagen (${e.message}). Ein Neuladen des Tabs raeumt es weg.`);
  }
  await tab.close().catch(() => {});
}

const failed = results.filter((r) => !r.ok);
console.log(`\nErgebnis: ${results.length - failed.length} von ${results.length} Messungen wie erwartet.`);
process.exit(failed.length ? 1 : 0);
