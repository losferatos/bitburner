/**
 * nightshift/selftest.js — prueft die Transportschicht, ohne im Spiel etwas
 * zu veraendern.
 *
 * Was hier NICHT passiert, und zwar mit Absicht:
 *   - keine Kaeufe, keine Faktionsbeitritte, keine Verbrechen
 *   - kein Klick auf irgendeinen Knopf der Spieloberflaeche
 *   - kein `run`, kein `kill`, kein Seitenwechsel im Spiel
 *
 * Der einzige Eingriff ist der Terminalbefehl `help`. Der gibt eine Liste
 * aus und sonst nichts.
 *
 * Aufruf:  node nightshift/selftest.js
 * Rueckgabe: Beendigungscode 0 wenn alles gruen, sonst 1.
 */

import { BitburnerTab, TabGuardError, writeLog } from "./cdp.js";

const checks = [];
let tab = null;

function record(name, ok, detail) {
  checks.push({ name, ok, detail });
  const mark = ok ? "OK  " : "FEHL";
  console.log(`  [${mark}] ${name}${detail ? " — " + detail : ""}`);
}

async function step(name, fn) {
  try {
    const detail = await fn();
    record(name, true, detail);
    return true;
  } catch (e) {
    record(name, false, `${e.name}: ${e.message}`);
    return false;
  }
}

console.log("Selbsttest der Nachtdienst-Transportschicht");
console.log("(veraendert nichts im Spiel; einziger Befehl ist `help`)\n");

await writeLog("info", "selftest.start", "Selbsttest beginnt", { echoLog: false });

// ---------------------------------------------------------------------------
// 1. Verbindung und Tab
// ---------------------------------------------------------------------------

tab = new BitburnerTab();

const connected = await step("1. Bitburner-Tab gefunden und angehaengt", async () => {
  await tab.connect();
  return `Ziel ${tab.targetId} ueber ${tab.endpoint}`;
});

if (!connected) {
  console.log("\nOhne Verbindung sind die weiteren Pruefungen sinnlos. Abbruch.");
  await tab.close().catch(() => {});
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Titel und URL
// ---------------------------------------------------------------------------

await step("2. Titel und URL stimmen", async () => {
  const info = await tab.info();
  if (!info.title.startsWith("Bitburner")) throw new Error(`Titel ist "${info.title}"`);
  if (!info.href.includes("bitburner-official.github.io")) throw new Error(`URL ist "${info.href}"`);
  return `"${info.title}" <${info.href}>`;
});

// ---------------------------------------------------------------------------
// 3. eval liefert etwas Sinnvolles
// ---------------------------------------------------------------------------

await step("3. eval liefert Auskunft aus dem Spiel", async () => {
  // Bitburner hat keinen Spielernamen. Was es gibt: Titel samt Version und
  // die Uebersichtsleiste. Alles nur gelesen.
  const data = await tab.eval(`() => {
    const overview = document.querySelector("table") ? document.body.innerText.slice(0, 200) : "";
    const grab = (label) => {
      const m = document.body.innerText.match(new RegExp(label + "\\\\s*\\\\n+\\\\s*([^\\\\n]+)"));
      return m ? m[1].trim() : null;
    };
    return {
      title: document.title,
      money: grab("Money"),
      hack: grab("Hack"),
      hasOverview: overview.length > 0,
    };
  }`);
  if (!data || !data.title) throw new Error("kein Ergebnis");
  const extra = [data.money ? `Money ${data.money}` : null, data.hack ? `Hack ${data.hack}` : null]
    .filter(Boolean)
    .join(", ");
  return `${data.title}${extra ? " | " + extra : ""}`;
});

// ---------------------------------------------------------------------------
// 4. Fehler aus dem Seitenkontext kommen als Fehler zurueck
// ---------------------------------------------------------------------------

await step("4. Fehler im Seitenkontext werden nicht verschluckt", async () => {
  let thrown = null;
  try {
    await tab.eval(`() => { throw new Error("Absichtlicher Testfehler"); }`);
  } catch (e) {
    thrown = e;
  }
  if (!thrown) throw new Error("kein Fehler durchgereicht — das waere schlimm");
  if (!/Absichtlicher Testfehler/.test(thrown.message)) {
    throw new Error(`Fehlertext kam nicht durch: ${thrown.message}`);
  }
  return `als ${thrown.name} durchgereicht`;
});

// ---------------------------------------------------------------------------
// 5. Elementsuche funktioniert (nur suchen, NICHT klicken)
// ---------------------------------------------------------------------------

await step("5. Elementsuche findet den Seitenleisten-Eintrag (ohne Klick)", async () => {
  const found = await tab.find({ text: "Terminal", exact: true });
  if (!found.found) throw new Error(`nicht gefunden: ${found.reason}`);
  if (!found.visible) throw new Error("gefunden, aber unsichtbar");
  if (!found.hitOk) throw new Error(`verdeckt: am Punkt liegt <${found.hitTag}>`);
  return `<${found.tag}> bei (${found.x}, ${found.y}), ${found.matchCount} Treffer, Klickpunkt frei`;
});

// ---------------------------------------------------------------------------
// 6. Waechter verweigert den Dienst bei falschem Tab
// ---------------------------------------------------------------------------

await step("6. Waechter verweigert bei falschem Titel den Dienst", async () => {
  // Gleicher Tab, aber wir verlangen einen Titel, den er nicht hat. Wenn die
  // Sicherung greift, kommt hier ein TabGuardError statt eines Ergebnisses.
  const strict = new BitburnerTab({ titlePrefix: "NEONBREAK" });
  let thrown = null;
  try {
    await strict.eval("document.title");
  } catch (e) {
    thrown = e;
  } finally {
    await strict.close().catch(() => {});
  }
  if (!thrown) throw new Error("der Waechter hat den falschen Tab durchgelassen");
  if (!(thrown instanceof TabGuardError)) {
    throw new Error(`falsche Fehlerart: ${thrown.name}: ${thrown.message}`);
  }
  return "Dienst korrekt verweigert";
});

// ---------------------------------------------------------------------------
// 7. Wiederverbinden nach abgerissener Leitung
// ---------------------------------------------------------------------------

await step("7. Verbindung reisst ab und wird selbst wieder aufgebaut", async () => {
  const before = tab.sessionId;
  tab.ws.terminate(); // Leitung hart kappen, wie bei einem Browser-Neustart
  await new Promise((r) => setTimeout(r, 300));
  const title = await tab.eval("document.title");
  if (!title) throw new Error("nach dem Abriss kam nichts zurueck");
  const after = tab.sessionId;
  return `neue Sitzung ${after === before ? "(gleiche Kennung)" : "aufgebaut"}, eval liefert wieder "${title}"`;
});

// ---------------------------------------------------------------------------
// 8. Terminal: `help` absetzen und Ausgabe zurueckbekommen
// ---------------------------------------------------------------------------

const terminalOk = await step("8. Terminalbefehl `help` liefert Ausgabe zurueck", async () => {
  const state = await tab.terminalState();
  if (!state.present) {
    throw new Error(
      "Terminal ist nicht offen (das Spiel steht auf einer anderen Seite). " +
        "Der Selbsttest wechselt absichtlich nicht die Seite — bitte im Spiel auf Terminal stellen.",
    );
  }
  const result = await tab.terminal("help");
  if (result.lines.length === 0) throw new Error("keine neuen Zeilen");
  if (!result.echoFound) throw new Error("die Echo-Zeile des Befehls wurde nicht gefunden");
  const joined = result.text.toLowerCase();
  if (!joined.includes("alias") && !joined.includes("connect") && !joined.includes("scan")) {
    throw new Error(`Ausgabe sieht nicht nach der Hilfe aus: ${result.text.slice(0, 120)}`);
  }
  return `${result.lines.length} Zeilen in ${result.durationMs} ms, erste: "${result.lines[0].slice(0, 60)}"`;
});

if (terminalOk) {
  const tail = await tab.terminalTail(6);
  console.log("\n  Letzte Terminalzeilen zur Ansicht:");
  for (const line of tail.lines) console.log("    | " + line.replace(/\n/g, " "));
}

// ---------------------------------------------------------------------------
// Abschluss
// ---------------------------------------------------------------------------

await tab.close().catch(() => {});

const failed = checks.filter((c) => !c.ok);
console.log("");
console.log(`Ergebnis: ${checks.length - failed.length} von ${checks.length} Pruefungen gruen.`);
await writeLog("info", "selftest.end", `${checks.length - failed.length}/${checks.length} gruen`);

if (failed.length > 0) {
  console.log("Fehlgeschlagen:");
  for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
  process.exit(1);
}
process.exit(0);
