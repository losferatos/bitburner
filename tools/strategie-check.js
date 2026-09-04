/**
 * Der Strategiepruefer.
 *
 * WARUM DIESES SKRIPT EXISTIERT
 *
 * Es gibt bereits tools/wache.js. Die fragt: "Lebt der Bot?" - und sie fragt
 * es gut. Am 25.08.2026 hat sie sieben Stunden lang wahrheitsgemaess "laeuft"
 * gemeldet, waehrend der Bot in BitNode 6 in eine Richtung arbeitete, die
 * diesen Knoten nie oeffnet: Netz 91/91 gerootet, Geld im zweistelligen
 * Millionenbereich - und drei von vier Kampfwerten auf 1, obwohl der Ausgang
 * hier ueber 21 Black Operations fuehrt.
 *
 * Ein Pulspruefer kann diesen Fehler nicht finden. Er misst Bewegung, nicht
 * Richtung. Dieses Skript misst die Richtung.
 *
 * WARUM ES EIN SKRIPT IST UND KEIN PROMPT
 *
 * Es wird aus einem wiederkehrenden Loop gerufen, und ein Loop hat kein
 * Gedaechtnis: Die Sitzung dahinter wird zusammengefasst, neu angemeldet oder
 * fuellt ihren Kontext. Ein Pruefer, der "vergleiche mit dem letzten Mal"
 * verlangt, prueft irgendwann gegen eine Erinnerung, die es nicht mehr gibt.
 * Deshalb liegt der Verlauf in einer Datei, nicht im Kopf.
 *
 * AUSGABE
 *
 * Wenige Zeilen Klartext plus ein Urteil in der letzten Zeile:
 *   URTEIL: SPUR         alles laeuft in Richtung Knotenausgang
 *   URTEIL: STAGNATION   der Traeger bewegt sich nicht mehr
 *   URTEIL: BLIND        die Lage ist nicht messbar (Bruecke/Spiel/Telemetrie)
 *   URTEIL: STOERUNG     der Bot hat selbst um Hilfe gerufen
 *   URTEIL: RESET        der Traeger ist gefallen - Einbau oder Knotenwechsel;
 *                        kein Fehler, aber der Wiederanlauf gehoert geprueft
 *
 * Aufruf:  node tools/strategie-check.js [--json]
 */

const BRIDGE = "http://localhost:8795";
const VERLAUF = "data/verlauf-strategie.json";
// So lange darf der Traeger stehen, bevor es Stagnation heisst. Grosszuegig
// gewaehlt: Kampfwerttraining und Rangaufbau sind langsam, und ein Fehlalarm
// kostet mehr Vertrauen als eine halbe Stunde spaetere Meldung.
const STILLSTAND_MS = 75 * 60000;
// Aelter als das, und die Telemetrie beschreibt nicht mehr die Gegenwart.
const FRISCH_MS = 6 * 60000;

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// DIESELBE Auswahl, die der Kern benutzt - nicht eine zweite daneben.
import { auswahl } from "../src/lib/reg.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(HIER, "..");
const verlaufPfad = path.join(WURZEL, VERLAUF);

async function rpc(params) {
  const url = new URL("/api/rpc", BRIDGE);
  // Schreibende Methoden verlangen seit f6a61e5 die Instanz (Schreibschranke
  // der Bruecke). Ohne sie antwortet sie mit 403.
  url.searchParams.set("instance", "LIVE");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    const b = await r.json();
    if (b.error) return null;
    return b.result;
  } catch { return null; }
  finally { clearTimeout(t); }
}

const liesJson = async (name) => {
  const roh = await rpc({ method: "getFile", filename: name, server: "home" });
  if (typeof roh !== "string" || !roh.trim()) return null;
  try { return JSON.parse(roh); } catch { return null; }
};

/** Rohinhalt statt JSON - die Knotenmarken sind blanke Zahlen, kein JSON. */
const liesDatei = async (name) => {
  const roh = await rpc({ method: "getFile", filename: name, server: "home" });
  return typeof roh === "string" ? roh : null;
};

const schlaf = (ms) => new Promise((r) => setTimeout(r, ms));

// Der BN6-Steckbrief wird nicht dauernd geschrieben - er ist ein Auftrag, kein
// Dauerlaeufer. Also erst anstossen, dann lesen. Der Auftragskanal wird nur
// belegt, wenn er frei ist: Eine fremde Zeile darf nicht ueberschrieben werden.
async function frischerSteckbrief() {
  const belegt = await rpc({ method: "getFile", filename: "data/task.txt", server: "home" });
  if (typeof belegt === "string" && belegt.trim()) {
    // BELEGTER KANAL IST KEIN AUSFALL (25.08.2026, 18:53).
    //
    // Vier Loops greifen ueber denselben Ein-Leser-Kanal ins Spiel. Trifft ein
    // Pruflauf einen fremden Auftrag an, bekommt er die alte Datei - und die
    // Alterspruefung weiter unten machte daraus BLIND. Bei der Wache loest das
    // eine Push-Nachricht aus, obwohl Bruecke, Spiel und Motor einwandfrei
    // laufen. Gemessen: Bruecke 200, Motortelemetrie 5 Sekunden alt, Kanal
    // inzwischen wieder frei - der Prueflauf unmittelbar danach ergab SPUR.
    //
    // Der Unterschied gehoert markiert, nicht verwischt: Ein alter Steckbrief
    // bei belegtem Kanal heisst "gerade nicht messbar", ein alter Steckbrief
    // bei freiem Kanal heisst "etwas ist kaputt".
    const alt = await liesJson("data/bblage.json");
    if (alt) alt.__kanalBelegt = true;
    return alt;
  }
  await rpc({ method: "pushFile", filename: "data/task.txt",
    content: JSON.stringify(["bblage.js"]), server: "home" });
  for (let i = 0; i < 12; i++) {
    await schlaf(4000);
    const d = await liesJson("data/bblage.json");
    if (d && Date.now() - d.zeit < 90000) return d;
  }
  return await liesJson("data/bblage.json");
}

function ladeVerlauf() {
  try { return JSON.parse(fs.readFileSync(verlaufPfad, "utf8")); }
  catch { return { punkte: [] }; }
}

function speichereVerlauf(v) {
  // Nur die letzten 200 Messpunkte. Der Verlauf ist ein Gedaechtnis, kein
  // Archiv - wer weiter zurueck will, liest die Commits.
  v.punkte = v.punkte.slice(-200);
  fs.mkdirSync(path.dirname(verlaufPfad), { recursive: true });
  fs.writeFileSync(verlaufPfad, JSON.stringify(v, null, 1));
}

/**
 * Der TRAEGER ist die eine Zahl, an der dieser Knoten haengt.
 *
 * Sie ist knotenabhaengig, und genau darin lag der Fehler vom 25.08.: In
 * BitNode 5 war es das Hackniveau, in BitNode 6 ist es der Bladeburner-Rang -
 * ueberwacht wurde weiter das Hackniveau. Wer den Traeger nicht mit dem Knoten
 * wechselt, ueberwacht ab dem Knotenwechsel das falsche Ding.
 */
function traeger(knoten, bb, rep, net, bladeKnoten, tiefstand) {
  if (bladeKnoten) {
    // VOR DEM BEITRITT GIBT ES KEINEN STECKBRIEF (28.08.2026, 19:15).
    //
    // `bb` kommt von `bblage.js` und setzt eine Bladeburner-Division voraus.
    // In BitNode 10 gibt es die zu Knotenbeginn nicht - der Traeger ist dort
    // trotzdem der Kampfwert-Tiefstand, denn das erste Tor ist der Beitritt
    // mit allen vier Werten >= 100
    // (`NetscriptFunctions/Bladeburner.ts:356`). Ohne diesen Zweig meldete
    // der Pruefer ersatzweise "Hacking-Weg" und ueberwachte damit genau die
    // Groesse, die der Kurs vom 18:55 als rechnerisch tot ausgewiesen hat.
    if (!bb && Number.isFinite(tiefstand)) {
      return { name: "Kampfwert-Tiefstand", wert: tiefstand, ziel: 100,
        phase: "Tor zur Division", sollRate: 1.7 };
    }
    if (!bb) return null;
    if (!bb.inBladeburner) {
      // 100 Kampfwert in einer knappen Stunde - gemessen am 25.08.: von 1 auf
      // 98 in 25 Minuten im Powerhouse Gym.
      return { name: "Kampfwert-Tiefstand", wert: bb.tiefstand, ziel: 100,
        phase: "Tor zur Division", sollRate: 1.7 };
    }
    // NACH EINEM EINBAU TRAEGT WIEDER DAS TRAINING (25.08.2026, 22:12).
    //
    // Ein Augmentierungs-Einbau setzt alle Kampfwerte auf 1 zurueck, laesst
    // aber die Mitgliedschaft in der Division und den Rang bestehen. Der Rang
    // bleibt also stehen, waehrend bbtrain stundenlang die Kampfwerte
    // wiederaufbaut - voellig regelkonform.
    //
    // Ohne diese Unterscheidung meldet der Pruefer die gesamte Trainingsphase
    // als STAGNATION, weil er den Rang als Traeger misst. Genau das ist um
    // 22:08 passiert. In dieser Phase ist der Kampfwert-Tiefstand der Traeger,
    // nicht der Rang - blade.js weicht dann ohnehin zurueck (blade.js:304).
    if (Number.isFinite(bb.tiefstand) && bb.tiefstand < 100) {
      return { name: "Kampfwert-Tiefstand", wert: bb.tiefstand, ziel: 100,
        phase: "Wiederaufbau nach Einbau", sollRate: 1.7 };
    }
    // KEINE FESTE SOLLRATE (25.08.2026, korrigiert nach Fremdpruefung).
    //
    // Hier stand 29 je Minute, hergeleitet aus dem Kontrollpunkt in
    // nodes/ROUTE.md: 3.500 Rang nach zwei Stunden. Diese Herleitung ist eine
    // Kategorienverwechslung, und sie hat den Pruefer eine Stunde lang
    // durchgehend STAGNATION melden lassen, waehrend der Bot nahe am
    // Moeglichen arbeitete.
    //
    // Der Rangzuwachs in Bladeburner ist nicht linear, sondern haengt an der
    // gerade laufenden Aktion (Formulas.ts: rankGain * rewardFac^(level-1)):
    //   Field Analysis   rankGain 0,1    rund 0,2 je Minute
    //   Tracking         rankGain 0,3    rund 1,7
    //   Retirement       rankGain 0,6    rund 2,1
    //   Bounty Hunter    rankGain 0,9    rund 2,6
    //   Investigation    rankGain 2,2    rund 4
    //   Raid             rankGain 55     rund 60
    //
    // Kein einziger Vertrag erreicht auch nur ein Zehntel von 29. Die Zahl aus
    // ROUTE.md stammt aus der ROADMAP-Zeile MIT Raid - und Raid verlangt
    // `city.comms >= 1` (Operations.ts:147-150), was in der Anfangsphase nicht
    // erfuellbar ist. Beim Uebertragen in den Pruefer ist die Fussnote
    // verlorengegangen.
    //
    // Die Sollrate wird deshalb unten aus der laufenden Aktion bestimmt, nicht
    // hier festgeschrieben.
    return { name: "Bladeburner-Rang", wert: bb.rang, ziel: null,
      phase: "Black Operations" };
  }
  // JEDE QUELLE WIRD AUF DEN KNOTEN GEPRUEFT (28.08.2026, 17:38).
  //
  // Hier stand schlicht `rep.hacking`. `data/bn4rep.json` ueberlebt aber den
  // Knotenwechsel auf home, waehrend `bn4rep.js` es nicht tut - es ist voller
  // Singularity-Aufrufe und passt ausserhalb von BitNode 4 nicht auf ein
  // frisches home mit 32 GB. Gemessen 17:32, eine halbe Stunde nach dem
  // Wechsel nach BitNode 10: Der Pruefer meldete "Hackniveau = 100 von 6000"
  // aus einer Datei vom 25.08., waehrend `bn4net.json` frisch 16 auswies.
  //
  // Eine Zahl, die sich nie bewegt, ist per Definition stagnierend - der
  // Pruefer haette also ab jetzt bei jedem Lauf Alarm geschlagen und dabei
  // echten Fortschritt verdeckt.
  //
  // `bn4net.json` ist die verlaessliche Quelle: bn4net.js ist das Skript, das
  // `boot.js` nach jedem Wechsel als erstes startet, und es ist
  // singularityfrei. Es kennt aber kein `zielLevel` - das bleibt bei
  // bn4rep.json, und zwar nur, wenn die Datei zum aktuellen Knoten gehoert.
  const repGilt = rep && rep.knoten === knoten;
  const wert = (net && Number.isFinite(net.hacking)) ? net.hacking
    : (repGilt ? rep.hacking : null);
  if (!Number.isFinite(wert)) return null;
  return { name: "Hackniveau", wert,
    ziel: (repGilt && rep.zielLevel) ? rep.zielLevel : null,
    phase: "Hacking-Weg" };
}

/**
 * Was ist von der GERADE LAUFENDEN Aktion an Rangzuwachs zu erwarten?
 *
 * Die Zahlen stammen aus dem Spielquellcode (Formulas.ts:9-27, Action.ts:105-121,
 * Constants.ts DifficultyToTimeFactor) und sind bewusst grob - sie sollen eine
 * Groessenordnung setzen, keine Prognose sein. Verglichen wird ohnehin nur
 * gegen ein Zehntel davon.
 */
function sollRate(t, blade) {
  if (t.name !== "Bladeburner-Rang") return null;
  const aktion = blade && blade.aktion ? String(blade.aktion) : "";
  if (!aktion) return null;
  // General umfasst Training, Field Analysis und die Regenerationskammer.
  // Alle drei bringen so gut wie keinen Rang - das ist kein Fehler, sondern
  // ihr Zweck. Eine Erwartung an den Rang waere hier sinnlos; ob der Motor zu
  // LANGE darin steckt, prueft der Block darunter gesondert.
  if (aktion.startsWith("General/")) return null;
  // BRUTTOERTRAG MAL ERFOLGSCHANCE (25.08.2026, 18:42).
  //
  // Die Zahlen unten sind Bruttowerte: was eine Aktion einbringt, WENN sie
  // gelingt. blade.js faehrt aber alles ab einer Chance von 0,45 - und ein
  // Fehlschlag bringt null Rang. Gemessen um 18:21: Retirement mit 0,493
  // Chance lieferte 0,15 je Minute, waehrend der Pruefer 1,7 erwartete und
  // STAGNATION meldete, obwohl der Motor genau das Richtige tat.
  //
  // Ohne die Chance ist die Erwartung fuer Tracking (0,678) knapp daneben und
  // fuer Retirement (0,493) um Faktor zwei zu hoch. Fehlt sie in der Datei -
  // aeltere Fassung von blade.js -, wird konservativ mit der Haelfte
  // gerechnet: lieber ein verpasster Alarm als ein taeglicher Fehlalarm.
  const chance = Number.isFinite(blade.chance) ? blade.chance : 0.5;
  // DER LEVELFAKTOR WAR DER FEHLENDE FAKTOR 6 (26.08.2026, 06:16).
  //
  // Gemessen ueber 84 saubere Abschnitte (tools/ratencheck.js): Tracking
  // bringt 1,994 Rang je Minute. Erwartet wurden 0,35 - der Bruttoertrag
  // rankGain 0,3 mal Erfolgschance durch Dauer.
  //
  // Formulas.ts:9-23 rechnet aber
  //   rankGain * rewardFac^(level-1) * currentNodeMults.BladeburnerRank
  // und jede Aktion hat ihren eigenen rewardFac (Contracts.ts:18, 52, 85;
  // Operations.ts:18, 52, 88, 123, 163, 201). Die Stufe steigt mit jedem
  // zehnten Erfolg, in einem langen Lauf also betraechtlich - genau deshalb
  // wuchs die Luecke mit der Zeit.
  const REWARD_FAC = {
    "Tracking": 1.041, "Bounty Hunter": 1.085, "Retirement": 1.065,
    "Investigation": 1.07, "Undercover Operation": 1.09,
    "Sting Operation": 1.095, "Raid": 1.1,
    "Stealth Retirement Operation": 1.11, "Assassination": 1.14,
  };
  const levelFaktor = (name) => {
    const fac = REWARD_FAC[name];
    const stufe = Number.isFinite(blade.stufe) ? blade.stufe : 1;
    if (!fac || stufe <= 1) return 1;
    return Math.pow(fac, stufe - 1);
  };
  // DIE PAUSCHALE 1,7 WAR ZUFAELLIG BOUNTY HUNTER (27.08.2026, 00:20).
  //
  // Hier stand `1,7 * chance * levelFaktor` fuer ALLE Vertraege. Gegen 406
  // gemessene Abschnitte (`tools/ratencheck.js`, 26.08. 23:18) traf das nur
  // bei einem:
  //
  //   Aktion                    gemessen   Pauschale   rankGain/Dauer
  //   Contracts/Tracking           3,438       5,45           3,21
  //   Contracts/Retirement         2,938       3,91           3,19
  //   Contracts/Bounty Hunter      2,279       2,50           2,48
  //
  // Der Grund: `rankGain` ist 0,3 / 0,9 / 0,6 (`data/Contracts.ts:19,53,86`)
  // und die Dauer 18 / 32 / 26 Sekunden. Die 1,7 entspricht ungefaehr
  // `0,9 / 0,53 min` - also genau Bounty Hunter, und daneben liegt sie um bis
  // zu 59 Prozent.
  //
  // Richtig ist `rankGain * rewardFac^(stufe-1) * chance / dauerMinuten`.
  // `blade.js` meldet die Dauer seit dem 26.08., 23:30 mit (`getActionTime`,
  // in Millisekunden); fehlt sie - aeltere Fassung -, bleibt die Pauschale
  // als Rueckfall stehen, damit ein Versionsunterschied keinen Fehlalarm
  // ausloest.
  const RANK_GAIN = {
    "Tracking": 0.3, "Bounty Hunter": 0.9, "Retirement": 0.6,
    "Investigation": 2.2, "Undercover Operation": 4.4,
    "Sting Operation": 5.5, "Raid": 55,
    "Stealth Retirement Operation": 22, "Assassination": 44,
  };
  const dauerMin = Number.isFinite(blade.dauer) && blade.dauer > 0
    ? blade.dauer / 60000 : null;

  if (aktion.startsWith("Contracts/") || aktion.startsWith("Operations/")) {
    const name = aktion.slice(aktion.indexOf("/") + 1);
    const f = levelFaktor(name);
    const gain = RANK_GAIN[name];
    if (dauerMin && gain) {
      return { wert: +(gain * f * chance / dauerMin).toFixed(2), grund: aktion
        + " bei " + Math.round(chance * 100) + " % Erfolgschance, Stufe "
        + (blade.stufe || 1) + ", " + Math.round(blade.dauer / 1000) + " s" };
    }
    // Rueckfall ohne gemeldete Dauer.
    const brutto = aktion.startsWith("Operations/")
      ? (aktion.includes("Raid") ? 60 : 4) : 1.7 * f;
    return { wert: +(brutto * chance).toFixed(2), grund: aktion
      + " bei " + Math.round(chance * 100) + " % Erfolgschance (ohne Dauer)" };
  }
  if (aktion.startsWith("Black Operations/")) return null;
  return null;
}

/**
 * Steckt der Motor zu lange in einer Aktion, die keinen Rang bringt?
 *
 * Das ist der Fall vom 25.08. um 17:00: Die Vertragsschwelle stand zu hoch,
 * kein Vertrag kam darueber, und blade.js fiel auf "Training" durch. Dort blieb
 * es. Training hebt Kampfwerte, bringt aber keinen Rang - von aussen sah das
 * aus wie Arbeit.
 *
 * Die Regenerationskammer ist ausgenommen, solange die Ausdauer wirklich
 * niedrig ist: Ruhen ist dann richtig und keine Sackgasse.
 */
function stecktInLeerlauf(frueher, blade, jetzt, wertJetzt) {
  if (!blade || !blade.aktion) return null;
  const aktion = String(blade.aktion);
  if (!aktion.startsWith("General/")) return null;

  // DEN GRUND LESEN, STATT IHN ZU ERRATEN (26.08.2026, 00:15).
  //
  // Hier stand eine Heuristik: Steht die Ausdauer unter 90 Prozent, gilt die
  // Regenerationskammer als legitim - egal wie lange. Zwei Dinge stimmen daran
  // nicht mehr. Erstens arbeitet blade.js seit dem 25.08. schon ab 60 Prozent
  // weiter, die 90 stammen aus der alten Hysterese. Zweitens ruht der Motor
  // inzwischen meist wegen der TREFFERPUNKTE, und dann ist die Ausdauer voll -
  // die Ausnahme greift also ausgerechnet im haeufigsten Fall nicht.
  //
  // blade.js schreibt den Grund seit 20:46 selbst mit ("ruht bis Ausdauer 33",
  // "ruht bis HP 17"). Den zu lesen ist genauer als jede Schaetzung ueber die
  // Ausdauer - und eine Ruhe MIT Grund darf trotzdem nicht ewig dauern.
  //
  // Zwanzig Minuten sind grosszuegig: Die Kammer heilt zwei Trefferpunkte je
  // Durchlauf und die Ausdauer regeneriert rund 1,2 je Minute passiv - beide
  // Schwellen sind in wenigen Minuten erreicht. Wer nach zwanzig Minuten noch
  // ruht, ruht nicht, sondern steckt fest.
  const grund = String(blade.grund || "");
  const ruhtMitGrund = grund.startsWith("ruht bis");
  const GRENZE_MIN = ruhtMitGrund ? 20 : 40;
  // Wie lange steht der Rang schon? Der Verlauf ist das einzige Gedaechtnis.
  //
  // DER VERGLEICHSWERT IST DER AKTUELLE, NICHT DER LETZTE GESPEICHERTE
  // (25.08.2026, 22:43).
  //
  // Hier stand `still[0].wert`, also der letzte Eintrag im Verlauf. Das ging
  // gut, solange der Prueferlauf lueckenlos war. Nach dem Einbau um 22:01 war
  // er es nicht mehr: Waehrend des Wiederaufbaus trug der Kampfwert-Tiefstand,
  // die Rang-Punkte brachen ab. Der letzte gespeicherte Rang war 131, der
  // tatsaechliche 137 - und die Kette der 131er reichte bis 22:01 zurueck.
  // Ergebnis: "der Rang steht seit 40 min", waehrend er in Wahrheit gerade um
  // sechs gestiegen war.
  const still = [...frueher].reverse();
  let seit = jetzt;
  if (!Number.isFinite(wertJetzt)) return null;
  for (const p of still) {
    if (p.wert !== wertJetzt) break;
    seit = p.zeit;
  }
  const min = (jetzt - seit) / 60000;
  if (min < GRENZE_MIN) return null;
  return aktion + " laeuft" + (ruhtMitGrund ? " (" + grund + ")" : "")
    + ", der Rang steht seit " + Math.round(min) + " min";
}

(async () => {
  const alsJson = process.argv.includes("--json");
  const zeilen = [];
  const sag = (t) => zeilen.push(t);
  let urteil = "SPUR";
  const jetzt = Date.now();

  const aus = () => {
    if (alsJson) {
      console.log(JSON.stringify({ urteil, zeilen, zeit: jetzt }, null, 1));
    } else {
      for (const z of zeilen) console.log(z);
      console.log("URTEIL: " + urteil);
    }
    // NICHT process.exit() (25.08.2026, 19:12).
    //
    // Der harte Ausstieg reisst Node mitten aus seiner Ereignisschleife. Bei
    // etwa jedem dritten Lauf brach das mit
    //   Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), src/win/async.c
    // ab - NACH der Urteilszeile, aber auf demselben Ausgabekanal.
    //
    // Das ist nicht kosmetisch: Der Wache-Prompt prueft ausdruecklich, ob die
    // Ausgabe auf "URTEIL:" endet, und haelt den Pruefer sonst fuer kaputt -
    // samt Push-Nachricht aufs Handy, obwohl alles laeuft. Ein Fehlalarm aus
    // dem Alarmwerkzeug selbst ist die teuerste Sorte.
    //
    // process.exitCode setzt denselben Rueckgabewert, laesst Node aber seine
    // offenen Handles selbst schliessen. Alle fetch-Aufrufe sind awaited und
    // ihre Timeouts im finally geloescht, es bleibt also nichts haengen.
    process.exitCode = urteil === "SPUR" ? 0 : 1;
  };

  // --- 1. Ist ueberhaupt etwas messbar? ------------------------------------
  const puls = await rpc({ method: "getFile", filename: "data/bn4net.json", server: "home" });
  if (puls === null) {
    sag("Bruecke oder Spiel nicht erreichbar (Port 8795 / RFA 12525).");
    urteil = "BLIND";
    return aus();
  }
  let net = null;
  try { net = JSON.parse(puls); } catch {}
  if (!net || !(jetzt - net.zeit < FRISCH_MS)) {
    const alter = net ? Math.round((jetzt - net.zeit) / 60000) + " min" : "unlesbar";
    sag("bn4net.js meldet sich nicht (Telemetrie " + alter + " alt) - der Motor steht.");
    urteil = "BLIND";
    return aus();
  }

  // --- 2. Hat der Bot selbst um Hilfe gerufen? -----------------------------
  const hilfe = await rpc({ method: "getFile", filename: "data/hilfe.txt", server: "home" });
  if (typeof hilfe === "string" && hilfe.trim()) {
    sag("NOTRUF aus dem Spiel: " + hilfe.trim().slice(0, 300));
    urteil = "STOERUNG";
  }

  // --- 3. Wo stehen wir, und ist das die richtige Richtung? ----------------
  // FEHLT EIN WERKZEUG? (29.08.2026, 14:50)
  //
  // Am 29.08. lief `sleeve.js` von 12:50 bis 14:17 nicht - 87 Minuten, in
  // denen der Pruefer durchgehend SPUR meldete. Kein Urteil schlug an, weil
  // niemand die Prozessliste gegen `WERKZEUGE` haelt: `data/ps.json` wurde
  // von keinem Werkzeug gelesen. Ein stiller Ausfall ist schlimmer als ein
  // lauter, und dieser traf ausgerechnet den groessten Hebel des Knotens.
  //
  /**
   * =========================================================================
   * DIESE PRUEFUNG WAR DOPPELT TOT (gefunden 04.09.2026 von einem Skeptiker)
   * =========================================================================
   *
   * Sie wurde nach dem Vorfall vom 29.08. gebaut und hat seither vermutlich
   * nie angeschlagen - aus zwei unabhaengigen Gruenden, von denen jeder
   * allein gereicht haette:
   *
   * (1) DIE QUELLE WAR STUMM. `data/ps.json` schreibt nur `src/ps.js`, und
   *     das ist ein Einmalskript, das ueber `data/task.txt` gestartet wird.
   *     Der einzige Starter im ganzen Baum war `loops/loop-wache.md` - der
   *     am 31.08.2026 abgeschaffte Wache-Loop. Seither steht die Datei still,
   *     das Alterstor `< 15 min` ist damit dauerhaft zu, und die Pruefung
   *     laeuft nie.
   *
   * (2) DIE SOLLLISTE WAR LEER. Gesucht wurde `const WERKZEUGE = [` in
   *     `src/bn4net.js`. Diese Zeichenkette gibt es dort nicht - der Kern
   *     fuehrt `const WERKZEUGE_FEST = [` und baut daraus zur Laufzeit
   *     `let WERKZEUGE = baueWerkzeuge(regLage)`. `indexOf` liefert also -1,
   *     `slice(-1)` das LETZTE ZEICHEN der Datei, und die Sollliste hat null
   *     Eintraege. Ohne Soll kein Fehlen, ohne Fehlen kein Alarm. Der `catch`
   *     schweigt dazu ausdruecklich ("kein Grund zu laermen").
   *
   * Das ist genau der Fall aus CLAUDE.md: *ein Ausschluss ist nur gueltig,
   * wenn das benutzte Werkzeug den ausgeschlossenen Fall ueberhaupt anzeigen
   * koennte.* Diese Pruefung konnte nie einen anzeigen und meldete
   * stattdessen Ruhe - nach einem Vorfall, bei dem 87 Minuten lang das
   * groesste Gewerk des Knotens tot war.
   *
   * BEHOBEN:
   * - Die Sollliste kommt aus `src/registry.json` (`eintraege[].name`) -
   *   maschinenlesbar, vom Generator gepflegt, und genau die Liste, nach der
   *   der Kern seine Gewerke startet.
   * - Fehlt `data/ps.json` oder ist sie alt, sagt die Pruefung das LAUT,
   *   statt still zu ueberspringen. Eine Pruefung, die schweigt, weil ihr die
   *   Daten fehlen, ist von einer bestandenen nicht zu unterscheiden.
   */
  const ps = await liesJson("data/ps.json");
  let werkzeugFehlt = null;
  let werkzeugPruefungBlind = null;

  /**
   * ===========================================================================
   * DIE SOLLLISTE IST NICHT DIE REGISTRY (04.09.2026, 18:50)
   * ===========================================================================
   *
   * Hier stand ein eigener Filter: alles ausser `restartPolicy: "once"` und
   * `phase: "kaltstart-einmal"`. Er kannte weder `knoten` noch `verfahren`
   * noch `precondition` - also genau die drei Felder, die entscheiden, ob ein
   * Eintrag in DIESEM Knoten ueberhaupt laufen soll.
   *
   * Die Folge war ein Dauerfehlalarm. Gemessen um 18:45 meldete dieser
   * Pruefer neun fehlende Werkzeuge, waehrend der Kern in derselben Minute
   * keines vermisste:
   *
   *   Pruefer: cdump, csolve, darkweb, sleevecrime, hashes, shop,
   *            worker/weaken, boerse, hacknet
   *   Kern   : registry-Zaehlwerk {gilt 16, running 14, absent 2}
   *
   * Und die Liste war in jeder Hinsicht falsch: `boerse.js` gilt nur in
   * BitNode 8, `hashes.js` und `hacknet.js` brauchen Hacknet-Server,
   * `sleevecrime.js` beendet sich planmaessig, sobald `sleeve.js` laeuft -
   * `shop.js` LIEF sogar nachweislich (Kernlog 18:31:26), und
   * `worker/weaken.js` ist ein Arbeiter, kein Werkzeug.
   *
   * Ein Alarm, der neunmal danebenliegt, wird ignoriert - und dann faellt der
   * echte Ausfall mit ihm durch. Das ist derselbe Fehler, den `export.js`
   * heute in `data/sofort.json` gemacht haette.
   *
   * Deshalb entscheidet jetzt `gilt()` aus `lib/reg.js` - dieselbe Funktion,
   * die der Kern benutzt. Sie kann nicht auseinanderlaufen, weil es nur eine
   * gibt. Die LAGE dafuer kommt so weit wie moeglich aus dem, was der Kern
   * selbst weggeschrieben hat, statt sie ein zweites Mal herzuleiten.
   */
  let soll = [];
  let kernZaehlwerk = null;
  let kpiNode = null;
  // Was ICH mit Begruendung aus der Sollliste genommen habe. Der Kern
  // zaehlt es weiterhin als "absent" - ohne diese Buchhaltung meldete die
  // Gegenprobe unten jedes Mal einen Widerspruch, den es nicht gibt.
  const ausgenommen = [];
  try {
    const reg = JSON.parse(
      fs.readFileSync(path.join(WURZEL, "src", "registry.json"), "utf8"));
    const kpi = await liesJson("data/kpi.json");
    kernZaehlwerk = kpi && kpi.registry ? kpi.registry : null;
    kpiNode = kpi && Number.isFinite(kpi.node) ? kpi.node : null;

    // Welche Dateien liegen auf home? `gilt()` braucht das fuer
    // `precondition.requiresFile` und um "verschwunden" von "nie gebaut" zu
    // trennen.
    let aufHome = null;
    try {
      const namen = await rpc({ method: "getFileNames", server: "home" });
      if (Array.isArray(namen)) aufHome = new Set(namen);
    } catch { /* dann ohne Dateipruefung - siehe unten */ }

    // home-Speicher fuer die Phase. Der Kern entscheidet mit
    // `getServerMaxRam("home") <= 64 ? "kaltstart" : "normal"`
    // (bn4net.js:571-576).
    const diag = await liesJson("data/startdiag.json");
    const homeGb = diag && Number.isFinite(diag.maxHomeGb) ? diag.maxHomeGb : null;

    const lage = {
      node: kpi && Number.isFinite(kpi.node) ? kpi.node : 0,
      verfahren: (kpi && kpi.verfahren) || "unbekannt",
      phase: homeGb === null ? "normal" : (homeGb <= 64 ? "kaltstart" : "normal"),
      dateiDa: aufHome ? ((d) => aufHome.has(d)) : undefined,
    };
    soll = auswahl(reg, lage)
      .map((e) => e.name)
      // ARBEITER SIND MIT DIESEM INSTRUMENT NICHT ZU SEHEN (04.09.2026).
      //
      // `worker/weaken.js` steht in der Registry und gilt in jedem Knoten -
      // aber `src/ps.js` blendet die Arbeiter ausdruecklich aus (ps.js:7-17):
      // "von denen laufen Zehntausende und sie sagen nichts aus". Die
      // Prozessliste kann sie also gar nicht zeigen, und ein Vergleich gegen
      // sie meldet sie zwangslaeufig als fehlend - jedes Mal, fuer immer.
      //
      // Ein Ausschluss ist nur gueltig, wenn das benutzte Werkzeug den
      // ausgeschlossenen Fall ueberhaupt anzeigen koennte. Hier kann es das
      // nicht, also gehoert der Eintrag nicht in diese Pruefung. Ob die
      // Arbeiter laufen, sagt die Netzauslastung, nicht die Prozessliste.
      .filter((n) => !n.startsWith("worker/"))
      // WER ENDEN SOLL, FEHLT NICHT, WENN ER GEENDET HAT (04.09.2026).
      //
      // `shop.js` traegt `restartPolicy: "until-done"`: es kauft, was der Kern
      // bestellt hat, und beendet sich. Gemessen am 04.09. lief es alle rund
      // viereinhalb Minuten unter neuer PID (320998, 323733, 327398, 330999,
      // 334591). Eine Momentaufnahme trifft es also meistens NICHT laufend -
      // und meldete es prompt als Ausfall.
      //
      // Ob ein solches Gewerk seine Arbeit tut, sagt seine Telemetrie
      // (`telemetryFile`, `freshnessMs`), nicht die Prozessliste.
      .filter((n) => {
        const e = (reg.eintraege || []).find((x) => x.name === n);
        const behalten = !e
          || (e.restartPolicy !== "until-done" && e.restartPolicy !== "once");
        if (!behalten) ausgenommen.push(n);
        return behalten;
      });

    if (!aufHome) {
      werkzeugPruefungBlind = "die Dateiliste von home war nicht zu bekommen -"
        + " ohne sie kann `gilt()` Vorbedingungen nicht pruefen";
    }
  } catch (e) {
    werkzeugPruefungBlind = "Sollliste nicht zu bilden (" + e.message + ")";
  }

  if (!soll.length && !werkzeugPruefungBlind) {
    werkzeugPruefungBlind = "die Sollliste aus registry.json ist leer";
  } else if (!ps || !Array.isArray(ps.gesehen)) {
    werkzeugPruefungBlind = "data/ps.json fehlt - `node tools/task.js \"ps.js\"` "
      + "absetzen und in einer Minute erneut messen";
  } else if (Date.now() - ps.zeit >= 15 * 60000) {
    werkzeugPruefungBlind = "data/ps.json ist "
      + ((Date.now() - ps.zeit) / 60000).toFixed(0) + " min alt - "
      + "`node tools/task.js \"ps.js\"` absetzen und erneut messen";
  } else {
    /**
     * DAS SOLL AUS DER REGISTRY IST DER ZIELZUSTAND, NICHT DER LAUFENDE.
     *
     * Beim ersten Lauf meldete die reparierte Pruefung dreizehn fehlende
     * Werkzeuge - und die Haelfte davon (`export.js`, `graftauto.js`,
     * `boerse.js`, `figwatch.js`, `shop.js`) liegt gar nicht im Spiel: sie
     * gehoeren zum neu gebauten Stand, der noch auf den Hot-Swap wartet.
     *
     * Ein Alarm, der die Einspielung als Ausfall meldet, wird nach dem
     * zweiten Mal ignoriert - und dann faellt der echte Ausfall mit ihm
     * durch. Deshalb zwei getrennte Listen:
     *
     *   NICHT IM SPIEL - der Hot-Swap steht aus. Das ist ein Hinweis, kein
     *                    Alarm; der Bot kann nicht starten, was nicht da ist.
     *   LIEGT, LAEUFT   - die Datei ist im Spiel und laeuft trotzdem nicht.
     *   ABER NICHT        Das ist der stille Ausfall, gegen den die Pruefung
     *                     gebaut wurde (29.08.: sleeve.js 87 Minuten tot).
     */
    const da = ps.gesehen.map((x) => x.datei);
    const fehlt = soll.filter((d) => !da.includes(d));
    let imSpiel = null;
    try {
      const namen = await rpc({ method: "getFileNames", server: "home" });
      if (Array.isArray(namen)) imSpiel = new Set(namen);
    } catch { /* dann eben ohne die Trennung */ }

    if (fehlt.length && imSpiel) {
      const nichtDa = fehlt.filter((d) => !imSpiel.has(d));
      const daAberTot = fehlt.filter((d) => imSpiel.has(d));
      if (nichtDa.length) {
        sag("NOCH NICHT IM SPIEL (" + nichtDa.length + "): " + nichtDa.join(", ")
          + " - der Hot-Swap steht aus, das ist kein Ausfall.");
      }
      if (daAberTot.length) werkzeugFehlt = daAberTot.join(", ");
    } else if (fehlt.length) {
      werkzeugFehlt = fehlt.join(", ");
    }
  }

  if (werkzeugPruefungBlind) {
    sag("WERKZEUG-PRUEFUNG BLIND: " + werkzeugPruefungBlind
      + " - sie kann einen stillen Ausfall gerade NICHT anzeigen.");
  }
  /**
   * GEGENPROBE GEGEN DEN KERN.
   *
   * Der Kern rechnet dasselbe mit derselben Funktion und schreibt das
   * Ergebnis nach `data/kpi.json` (`registry.absent`). Weichen beide
   * Zahlen ab, ist das ein Befund fuer sich: dann sieht dieser Pruefer die
   * Lage anders als der Bot, und mindestens einer von beiden irrt.
   *
   * Genau das war am 04.09. um 18:45 der Fall - hier neun, im Kern keines.
   */
  if (kernZaehlwerk && Number.isFinite(kernZaehlwerk.absent) && !werkzeugPruefungBlind) {
    // Blind heisst: dieser Pruefer hat gar nicht gezaehlt. Dann ist eine
    // Abweichung kein Befund, sondern eine Selbstverstaendlichkeit - und eine
    // Meldung darueber waere genau der Laerm, den diese Runde beseitigt.
    const hier = (werkzeugFehlt ? werkzeugFehlt.split(", ").length : 0)
      + ausgenommen.length;
    if (hier !== kernZaehlwerk.absent) {
      sag("ABWEICHUNG ZUM KERN: dieser Pruefer zaehlt " + hier
        + " fehlende Werkzeuge (davon " + ausgenommen.length
        + " mit Begruendung ausgenommen), der Kern " + kernZaehlwerk.absent
        + " (data/kpi.json registry.absent). Einer von beiden irrt -"
        + " der Kern entscheidet, dieser Pruefer meldet nur.");
    }
  }

  /**
   * DIE KNOTENMARKEN SIND EIN FILTER NEBEN `gilt()` (04.09.2026).
   *
   * `hacknet.js` und `hashes.js` gelten laut Registry ueberall - der Kern
   * ueberspringt sie aber zusaetzlich, wenn `data/keine-hacknet.txt` die
   * NUMMER DES LAUFENDEN KNOTENS enthaelt (bn4net.js:3348 und :3437). Diese
   * Pruefung steht ausserhalb von `gilt()`, weshalb sogar das Zaehlwerk des
   * Kerns sie als "absent" fuehrt, obwohl er sie mit Absicht nicht startet.
   *
   * In die Registry laesst sich das NICHT einfach als
   * `precondition.forbidsFile` schreiben: `gilt()` prueft ueber `dateiDa`,
   * und dessen Veraltungsregel (`markeVeraltet`) vergleicht ZEITSTEMPEL,
   * waehrend in dieser Marke eine KNOTENNUMMER steht. Eine Marke aus Knoten
   * 10 wuerde damit auch in Knoten 9 noch blocken - und dort ist hashes.js
   * die einzige Geldquelle. Deshalb bleibt die Registry, wie sie ist, und
   * dieser Pruefer erklaert den Fall, statt ihn zu melden.
   */
  if (werkzeugFehlt) {
    const marke = await liesDatei("data/keine-hacknet.txt");
    const knoten = kpiNode;
    if (marke !== null && knoten !== null && String(marke).trim() === String(knoten)) {
      const erklaert = ["hacknet.js", "hashes.js"];
      const rest = werkzeugFehlt.split(", ").filter((d) => !erklaert.includes(d));
      const weg = werkzeugFehlt.split(", ").filter((d) => erklaert.includes(d));
      if (weg.length) {
        ausgenommen.push(...weg);
        sag("PLANMAESSIG AUS (" + weg.length + "): " + weg.join(", ")
          + " - data/keine-hacknet.txt gilt fuer Knoten " + knoten
          + ", es gibt hier keine Hacknet-Server. Kein Ausfall.");
      }
      werkzeugFehlt = rest.length ? rest.join(", ") : null;
    }
  }

  if (werkzeugFehlt) sag("WERKZEUG FEHLT: " + werkzeugFehlt
    + " - mit 'pushFile data/task.txt [\"<name>\"]' starten"
    + " (WERKZEUG in reload.txt killt nur, es startet nicht).");

  const rep = await liesJson("data/bn4rep.json");
  let blade = await liesJson("data/blade.json");
  // Frueh lesen: Die beiden folgenden Pruefungen gelten nur in Kampfknoten.
  const ks = await liesJson("data/knoten.json");
  const knotenFrueh = (ks && typeof ks.knoten === "number") ? ks.knoten
    : (net && typeof net.knoten === "number") ? net.knoten : null;
  // BITNODE 10 IST AUCH EIN KAMPFKNOTEN (28.08.2026, 19:15).
  //
  // Der Kurs vom 18:55 hat es hergeleitet: In BitNode 10 fuehrt der Ausgang
  // ueber 21 Black Operations, nicht ueber das Hackniveau - Weg A verlangt
  // bei `HackingLevelMultiplier` 0,35 einen Augmentierungsmultiplikator um 40.
  // Der Traeger ist damit derselbe wie in BitNode 6 und 7.
  //
  // Fuer die WERKZEUGPRUEFUNGEN gilt das trotzdem nicht: `blade.js` und der
  // Bladeburner-Steckbrief kommen erst nach dem Beitritt, und der verlangt
  // alle vier Kampfwerte >= 100 (heute 41). Deshalb zwei Begriffe.
  // Die Liste steht auch in src/bn4rep.js und tools/wache.js unter demselben
  // Namen - drei Prozesse ohne gemeinsamen Modulraum, aber ein grep nach
  // BLADE_KNOTEN zeigt jede Fundstelle (29.08.2026, 09:15).
  // Seit dem 02.09.2026 sagt data/verfahren.txt (von ausgang.js), ob der
  // Knoten ueber Bladeburner (V2) oder Hacking (V1) laeuft. Die alte Liste
  // [6, 7, 10] galt fuer acht Knoten der Route nicht.
  // `hole` gab es nie (gefunden 04.09.2026). Dieses Werkzeug ist an dieser
  // Zeile bei JEDEM Aufruf mit einem ReferenceError abgestuerzt - seit dem
  // 02.09., als die Zeile hinzukam. Es war damit nicht "still", sondern tot,
  // und alles danach (Verfahren, Steckbrief, Werkzeugpruefung, Urteil) lief
  // nie. Der Leser heisst `rpc` und liefert schon ueberall sonst in dieser
  // Datei den Dateiinhalt.
  const verfahrenTxt = (await rpc({
    method: "getFile", filename: "data/verfahren.txt", server: "home",
  })) || "";
  const vt = verfahrenTxt.trim().split(/\s+/);
  const verfahrenBekannt = Number(vt[1]) === knotenFrueh && ["V1", "V1b", "V2"].includes(vt[0]);
  const bladeKnoten = verfahrenBekannt ? vt[0] === "V2" : true;
  const BLADE_KNOTEN = { includes: (k) => (Number(vt[1]) === k && verfahrenBekannt) ? vt[0] === "V2" : true };

  let bb = await frischerSteckbrief();
  const kanalWarBelegt = !!(bb && bb.__kanalBelegt);
  // ALTE DATEN SIND SCHLIMMER ALS KEINE (25.08.2026, Fremdpruefung).
  //
  // frischerSteckbrief() prueft das Alter nur INNERHALB seiner Warteschleife.
  // Beide Ausstiege - Kanal belegt, zwoelf Versuche erfolglos - liefern die
  // Datei ungeprueft zurueck. Direkt nach einem BitNode-Wechsel ist das fatal:
  // Die JSON-Dateien auf home ueberleben den Wechsel, die Skripte nicht. Der
  // Pruefer haette dann den ALTEN Knoten mit dem ALTEN Traeger gemeldet und
  // ein Urteil ueber eine Lage gefaellt, die es nicht mehr gibt.
  //
  // tools/wache.js hat gegen genau das eine Regel ("nur eine frische
  // Knotennummer uebernehmen"). Sie ist damals nur in eines der beiden
  // Bauteile eingeflossen.
  if (bb && Number.isFinite(bb.zeit) && jetzt - bb.zeit > 5 * 60000) {
    const alterMin = Math.round((jetzt - bb.zeit) / 60000);
    if (bb.__kanalBelegt) {
      // Kein Alarm: Ein anderer Loop hatte den Auftragskanal. Der naechste
      // Lauf in wenigen Minuten misst frisch.
      sag("Steckbrief " + alterMin + " min alt, Auftragskanal war belegt -"
        + " diesmal keine Traegermessung.");
      bb = null;
    } else {
      // NUR IN KAMPFKNOTEN EIN BLIND (28.08.2026, 17:30).
      //
      // Der Steckbrief kommt von `bblage.js` und beschreibt die
      // Bladeburner-Lage. In BitNode 10 gibt es zu diesem Zeitpunkt gar keine
      // Division - er FEHLT zu Recht, und ein BLIND daraus ist ein
      // Fehlalarm, der die Wache bei jedem Lauf in die Diagnose schickt.
      // VERFEINERT 29.08.2026, 05:15 - das Kriterium ist nicht der Knoten,
      // sondern ob die Division ueberhaupt existieren muesste.
      //
      // `kampfKnoten` liess BitNode 10 aussen vor. Das war richtig, solange
      // dort keine Division existiert - ab dem Beitritt aber waere ein
      // fehlender Steckbrief ein echter Ausfall von `bblage.js`, und niemand
      // haette ihn gemeldet. Umgekehrt gilt dasselbe in BitNode 6 und 7: Auch
      // dort ist der Steckbrief vor dem Beitritt zu Recht nicht da.
      //
      // Der Tiefstand entscheidet: Ab 100 verlangt das Spiel keine weiteren
      // Kampfwerte mehr (`NetscriptFunctions/Bladeburner.ts:356`), die
      // Division muesste also stehen. Faellt die Quelle aus, bleibt das alte
      // Verhalten.
      const tiefstandFrueh = ks && ks.kampf
        ? Math.min(ks.kampf.str, ks.kampf.def, ks.kampf.dex, ks.kampf.agi)
        : null;
      // Faellt die Kampfwert-Quelle aus, wissen wir nichts - und dann wird
      // NICHT gemeldet (29.08.2026, 09:20). Vorher stand hier `kampfKnoten`,
      // also "in 6 und 7 melden". Ein Fehlalarm um drei Uhr nachts kostet
      // mehr als eine Meldung, die der naechste Lauf zwanzig Minuten spaeter
      // ohnehin sieht.
      const divisionErwartet = Number.isFinite(tiefstandFrueh)
        && bladeKnoten && tiefstandFrueh >= 100;
      sag("Steckbrief ist " + alterMin + " min alt und der Auftragskanal war"
        + " frei" + (divisionErwartet ? " - der Auftragslaeufer im Spiel arbeitet"
          + " nicht." : " - in BitNode " + knotenFrueh + " noch ohne Belang, die"
          + " Division steht erst ab Kampfwert 100 (jetzt "
          + (tiefstandFrueh ?? "?") + ")."));
      bb = null;
      if (divisionErwartet) urteil = "BLIND";
    }
  }
  // DIE KNOTENNUMMER KOMMT ZUERST AUS data/knoten.json (28.08.2026, 17:25).
  //
  // Die beiden Quellen unten sind nach einem Knotenwechsel beide tot:
  // `bblage.json` schreibt blade.js (laeuft nur in Kampfknoten und erst nach
  // dem Beitritt), `bn4rep.json` schreibt bn4rep.js (voller Singularity und
  // ausserhalb BitNode 4 mehrere hundert Gigabyte gross - passt nicht auf ein
  // frisches home mit 32 GB). Nach dem Wechsel um 17:05 meldete dieser
  // Pruefer deshalb zwanzig Minuten lang "BitNode 6", obwohl der Bot laengst
  // in BitNode 10 war - also genau in dem Fenster, in dem eine falsche
  // Knotennummer die Traegerbestimmung komplett verdreht.
  //
  // `data/knoten.json` kommt seit 17:20 von `src/knoten.js` (1,6 GB, nur
  // getResetInfo) und ab dem naechsten Wechsel zusaetzlich aus
  // `data/bn4net.json` - beides laeuft ab der ersten Sekunde eines Knotens.
  const knoten = knotenFrueh || (bb && bb.knoten) || (rep && rep.knoten) || null;
  // Kampfwerte aus der knotenunabhaengigen Quelle: `knoten.js` schreibt sie
  // seit 19:12 mit (`getPlayer`, 0,5 GB), `bn4net.json` ab dem naechsten
  // Neustart ebenfalls. Vorher standen sie nur in `bblage.json` - also
  // ausgerechnet vor dem Bladeburner-Beitritt nicht, wo sie der Traeger sind.
  const kampfQuelle = (ks && ks.kampf) || (net && net.kampf) || null;
  const tiefstand = kampfQuelle
    ? Math.min(kampfQuelle.str, kampfQuelle.def, kampfQuelle.dex, kampfQuelle.agi)
    : null;

  if (!knoten) {
    sag("BitNode nicht bestimmbar - weder Steckbrief noch Reputationsmelder da.");
    urteil = "BLIND";
    return aus();
  }

  const t = traeger(knoten, bb, rep, net, bladeKnoten, tiefstand);
  sag("BitNode " + knoten + ", Netz " + net.gerootet + "/" + net.netz
    // Geld stand nur im Steckbrief - und der ist eine Bladeburner-Groesse.
    // In BitNode 10 kam deshalb "Geld ?". bn4net.json fuehrt es ohnehin mit.
    + ", Geld " + (bb ? Math.round(bb.geld / 1e6) + "m"
      : (net && Number.isFinite(net.geld)) ? Math.round(net.geld / 1e6) + "m" : "?"));

  if (!t) {
    sag("Der Traeger dieses Knotens ist nicht messbar - Steckbrief fehlt.");
    // Nur dann Alarm, wenn oben nicht schon geklaert wurde, dass bloss der
    // Kanal belegt war. Der Motor laeuft ja nachweislich, sonst waeren wir
    // hier gar nicht angekommen.
    if (urteil === "SPUR" && !kanalWarBelegt) urteil = "BLIND";
    return aus();
  }

  sag("Phase: " + t.phase);
  sag("Traeger: " + t.name + " = " + t.wert + (t.ziel ? " von " + t.ziel : ""));
  if (bb && BLADE_KNOTEN.includes(knoten)) {
    sag("  Kampf str " + bb.kampf.str + " def " + bb.kampf.def
      + " dex " + bb.kampf.dex + " agi " + bb.kampf.agi
      + "  Stadt " + bb.stadt
      + "  Arbeit " + (bb.arbeit ? (bb.arbeit.klasse || bb.arbeit.typ)
        + (bb.arbeit.ort ? " @ " + bb.arbeit.ort : "") : "keine"));
  }

  // --- 4. Bewegt sich der Traeger? ----------------------------------------
  const v = ladeVerlauf();
  let frueher = v.punkte.filter((x) => x.knoten === knoten && x.traeger === t.name);
  // DIE STILLSTANDSUHR DARF NICHT UEBER EINEN EINBAU HINWEG ZAEHLEN
  // (27.08.2026, 04:00).
  //
  // Der Rueckgangszweig weiter unten verwirft den Verlauf, wenn ein Traeger
  // FAELLT. Beim Augmentierungs-Einbau faellt er aber nicht, er WECHSELT: von
  // "Bladeburner-Rang" auf "Kampfwert-Tiefstand". Dessen alte Punkte stammen
  // aus der vorigen Wiederaufbauphase und stehen dort ebenfalls auf 1 - die
  // Uhr zaehlt also von damals durch.
  //
  // Gemessen am 27.08. um 03:52, vier Minuten nach einem Einbau:
  // "STAGNATION: Kampfwert-Tiefstand steht seit 681 min auf 1", waehrend
  // bbtrain str gerade von 51 auf 75 hochtrainierte. Die Wache waere damit
  // unmittelbar nach dem Einbau in ihren Eingriffsmodus gegangen - genau das,
  // was der Rueckgangszweig verhindern soll.
  //
  // Die Wiederaufbauphase beginnt mit jedem Einbau neu. Punkte davor
  // beschreiben einen anderen Lauf und werden fuer die Uhr ignoriert; im
  // Verlauf bleiben sie stehen, denn dort sind sie Geschichte, nicht Messwert.
  // DER SCHNITT MUSS DEN ERSTEN LAUF NACH DEM EINBAU MITNEHMEN
  // (27.08.2026, 16:49).
  //
  // Die Fassung von 04:00 suchte den Phasenwechsel im GESPEICHERTEN Verlauf.
  // Beim ersten Lauf nach einem Einbau steht dort aber noch kein Punkt der
  // neuen Wiederaufbauphase - der aktuelle Messpunkt wird erst danach
  // angehaengt. Gefunden wurde deshalb der Beginn der VORIGEN
  // Wiederaufbauphase, und genau deren Punkte blieben stehen.
  //
  // Gemessen am 27.08. um 14:40, eine Minute nach dem Einbau:
  // "STAGNATION: Kampfwert-Tiefstand steht seit 649 min auf 1" - 14:40 minus
  // 649 Minuten ist 03:51, der Wiederaufbau vom Vorlauf. Dessen Punkte stehen
  // ebenfalls auf 1, also findet die Suche nach dem letzten NIEDRIGEREN Punkt
  // keinen, faellt auf den aeltesten zurueck und zaehlt von damals durch.
  // Der 04:00-Fix half erst ab dem zweiten Lauf - und im ersten schickt die
  // Meldung die Wache in den Eingriffsmodus, waehrend bbtrain planmaessig
  // arbeitet.
  if (t.phase === "Wiederaufbau nach Einbau") {
    const alle = v.punkte.filter((x) => x.knoten === knoten);
    const letzte = alle.length ? alle[alle.length - 1].phase : null;
    if (letzte !== null && letzte !== t.phase) {
      // Die Wiederaufbauphase beginnt JETZT - alles davor ist ein anderer Lauf.
      frueher = [];
    } else {
      let schnitt = -1;
      for (let i = alle.length - 1; i > 0; i--) {
        if (alle[i].phase === t.phase && alle[i - 1].phase !== t.phase) { schnitt = i; break; }
      }
      if (schnitt >= 0) {
        const ab = alle[schnitt].zeit;
        frueher = frueher.filter((x) => x.zeit >= ab);
      }
    }
  }
  // Bezugspunkt ist der letzte Messpunkt, der NIEDRIGER lag als jetzt - also
  // der Moment, in dem zuletzt etwas vorwaerts ging. Gegen den unmittelbar
  // vorigen Punkt zu vergleichen wuerde jede langsame, aber gesunde Steigung
  // als Stillstand lesen.
  const letzterFortschritt = [...frueher].reverse().find((x) => x.wert < t.wert);
  const aeltester = frueher.length ? frueher[0] : null;

  if (frueher.length === 0) {
    sag("Erster Messpunkt fuer diesen Traeger - Stagnation erst ab dem naechsten Lauf pruefbar.");
  } else {
    const bezug = letzterFortschritt || aeltester;
    const stillMs = jetzt - bezug.zeit;
    const stillMin = Math.round(stillMs / 60000);
    const delta = t.wert - bezug.wert;
    if (delta > 0) {
      sag("Fortschritt: +" + delta + " in " + stillMin + " min.");
      // BEWEGUNG IST NICHT TEMPO (25.08.2026, 16:45).
      //
      // Der Bezugspunkt oben ist der letzte NIEDRIGERE Messpunkt - das schuetzt
      // langsame Traeger vor Fehlalarm, hat aber ein Loch: Ein einziger Schritt
      // vor einer Stunde gilt seither als "Fortschritt", fuer immer. Genau so
      // ist am 25.08. ein Rang von 0,7 nach fuenfzehn Minuten als SPUR
      // durchgewunken worden, waehrend der Motor in "Training" feststeckte und
      // gar keinen Rang mehr sammelte. Das Ziel lag bei 3.500.
      //
      // Deshalb zusaetzlich das Tempo, gemessen ueber die volle Strecke seit
      // dem ersten Punkt dieser Phase. Ein Zehntel der Sollrate ist grosszuegig
      // - es schlaegt erst an, wenn der Traeger um eine Groessenordnung zu
      // langsam ist, nicht bei einer schlechten Viertelstunde.
      // DIE ERWARTUNG HAENGT AN DER AKTION, NICHT AN DER UHR
      // (25.08.2026, korrigiert nach Fremdpruefung).
      //
      // Zwei Fehler steckten in der Vorgaengerfassung, beide haben denselben
      // Effekt: Der Alarm konnte nicht anschlagen, wenn er sollte, und kaum
      // aufhoeren, wenn er nicht mehr sollte.
      //
      //  1. Eine feste Sollrate von 29 je Minute, hergeleitet aus einem
      //     Zwei-Stunden-Ziel. Kein Vertrag der Anfangsphase erreicht davon
      //     auch nur ein Zehntel - siehe die Tabelle bei traeger(). Der Pruefer
      //     meldete deshalb eine Stunde lang durchgehend STAGNATION, waehrend
      //     der Bot nahe am Moeglichen arbeitete. Ein Alarm, der immer
      //     schrillt, ist kein Alarm.
      //  2. Gemessen wurde gegen den ERSTEN Punkt der Phase, samt Aufwaermzeit.
      //     Der Nenner waechst monoton, der Lebenszeitdurchschnitt reagiert
      //     immer traeger - selbst eine perfekte spaetere Phase haette den
      //     Alarm kaum wieder abschalten koennen.
      //
      // Jetzt: gleitendes Fenster ueber die letzten FENSTER_MIN Minuten, und
      // die Erwartung kommt aus der Aktion, die gerade tatsaechlich laeuft.
      const FENSTER_MIN = 25;
      const fenster = frueher.filter((x) => jetzt - x.zeit <= FENSTER_MIN * 60000);
      const anker = fenster.length ? fenster[0] : null;
      const soll = sollRate(t, blade);
      if (soll && anker) {
        const spanneMin = (jetzt - anker.zeit) / 60000;
        if (spanneMin >= 10) {
          const rate = (t.wert - anker.wert) / spanneMin;
          if (rate < soll.wert / 10) {
            sag("ZU LANGSAM: " + rate.toFixed(2) + " je Minute ueber "
              + Math.round(spanneMin) + " min. Fuer " + soll.grund
              + " waeren rund " + soll.wert + " zu erwarten.");
            if (urteil === "SPUR") urteil = "STAGNATION";
          }
        }
      }
    } else if (delta < 0) {
      // EIN RUECKGANG IST KEIN STILLSTAND (25.08.2026, Fremdpruefung).
      //
      // Faellt der Traeger - Kampfwerte auf 1 nach einem Augmentierungs-Einbau,
      // Rang auf 0 nach einem Knotenwechsel -, findet die Suche nach dem
      // "letzten niedrigeren Punkt" keinen mehr. Der Bezug faellt auf den
      // aeltesten Punkt zurueck, die Stillstandsdauer waechst unbegrenzt, und
      // der Pruefer meldet STAGNATION, bis der alte Hoechststand wieder
      // erreicht ist - also stundenlang.
      //
      // Ausgerechnet in der Phase, in der der Bot planmaessig arbeitet
      // (Wiederaufbau nach dem Einbau), haette die Wache damit ihren
      // Eingriffsmodus betreten. Das ist der denkbar schlechteste Zeitpunkt.
      //
      // Ein Rueckgang ist ein Ereignis, kein Fehler. Er bekommt ein eigenes
      // Urteil, und der Verlauf dieses Traegers wird verworfen - er beschreibt
      // eine Welt, die es nicht mehr gibt.
      sag("RESET: " + t.name + " ist von " + bezug.wert + " auf " + t.wert
        + " gefallen - Augmentierungs-Einbau oder Knotenwechsel.");
      urteil = "RESET";
      v.punkte = v.punkte.filter((x) => x.knoten !== knoten || x.traeger !== t.name);
    } else if (stillMs > STILLSTAND_MS) {
      sag("STAGNATION: " + t.name + " steht seit " + stillMin
        + " min auf " + t.wert + ".");
      if (urteil === "SPUR") urteil = "STAGNATION";
    } else {
      sag("Kein Fortschritt seit " + stillMin + " min - noch innerhalb der Toleranz ("
        + Math.round(STILLSTAND_MS / 60000) + " min).");
    }
  }

  // --- 5. Steckt der Motor in einer Aktion ohne Ertrag? --------------------
  // --- 4b. PHASENWECHSEL IN DEN WIEDERAUFBAU IST EIN RESET -----------------
  //
  // In BitNode 6 und 7 faellt der Traeger bei einem Augmentierungs-Einbau
  // NICHT: Der Bladeburner-Rang ueberlebt ihn, nur ein Knotenwechsel setzt ihn
  // zurueck. Die Rueckgangspruefung oben ist hier also blind, und am 25.08. um
  // 22:01 hat sie genau deshalb SPUR gemeldet, waehrend die Kampfwerte auf 1
  // standen, das Netz von 95 auf 13 gefallen war und sechs Werkzeuge fehlten.
  //
  // Der Wechsel der PHASE ist das fehlende Kennzeichen. Er tritt genau einmal
  // je Einbau auf, und danach gehoert der Wiederanlauf geprueft - dafuer hat
  // der Wache-Prompt seinen RESET-Zweig.
  // NICHT `frueher` benutzen: Das ist nach TRAEGER gefiltert, und genau der
  // wechselt hier mit. Nach einem Einbau enthielte die Liste nur Punkte aus
  // der VORIGEN Wiederaufbauphase - deren Phase ist dieselbe, und der Wechsel
  // waere unsichtbar. Gefragt ist der letzte Messpunkt ueberhaupt.
  const letzterPunkt = (v.punkte || []).filter((x) => x.knoten === knoten).pop();
  const vorigePhase = letzterPunkt ? letzterPunkt.phase : null;
  if (t.phase === "Wiederaufbau nach Einbau" && vorigePhase
      && vorigePhase !== t.phase) {
    sag("RESET: Augmentierungs-Einbau - die Kampfwerte sind auf "
      + t.wert + " zurueckgefallen, der Rang bleibt. Wiederanlauf pruefen:"
      + " Nach dem Einbau vom 25.08. fehlten sechs Werkzeuge.");
    urteil = "RESET";
    // DEN VERLAUF DES NEUEN TRAEGERS MIT VERWERFEN (27.08.2026, 03:56).
    //
    // Der Rueckgangszweig oben loescht den Verlauf, wenn ein Traeger FAELLT.
    // Beim Einbau faellt er aber nicht, er WECHSELT: von "Bladeburner-Rang"
    // auf "Kampfwert-Tiefstand". Dessen alte Punkte stammen aus der vorigen
    // Wiederaufbauphase und stehen dort ebenfalls auf 1 - die Stillstandsuhr
    // zaehlt also von damals durch.
    //
    // Gemessen am 27.08. um 03:52, vier Minuten nach dem Einbau:
    // "STAGNATION: Kampfwert-Tiefstand steht seit 681 min auf 1", waehrend
    // bbtrain gerade str von 51 auf 75 hochtrainierte. Die Wache waere damit
    // unmittelbar nach dem Einbau in ihren Eingriffsmodus gegangen - genau
    // das, was der Rueckgangszweig verhindern sollte.
    v.punkte = v.punkte.filter((x) => x.knoten !== knoten || x.traeger !== t.name);
  }

  // Nicht waehrend des Wiederaufbaus: Dort ist der Traeger das Training, und
  // die Aktion in blade.json stammt aus der Zeit VOR dem Einbau - eine
  // Leerlaufmeldung darueber waere doppelt falsch.
  const leerlauf = t.phase === "Wiederaufbau nach Einbau"
    ? null : stecktInLeerlauf(frueher, blade, jetzt, t.wert);
  if (leerlauf) {
    sag("LEERLAUF: " + leerlauf + ".");
    if (urteil === "SPUR") urteil = "STAGNATION";
  }

  // --- 6. Sammeln sich Dialogfenster im Spiel? -----------------------------
  //
  // DIE MESSGROESSE WAR DA, NUR HAT SIE NIEMAND GELESEN (25.08.2026).
  //
  // An diesem Nachmittag hat der Bot zweimal ueber Stunden Bladeburner-Aktionen
  // abgebrochen, weil andere Skripte Arbeit anfingen - das Spiel meldet das je
  // Vorfall mit einem Dialogfenster. Beide Male hat Eric es bemerkt, kein
  // Pruefer. Dabei zaehlt src/popups.js die geschlossenen Dialoge laengst und
  // schreibt sie nach data/popups.txt.
  //
  // Ein Dialog hier und da ist normal (Faktionseinladungen, Hinweise). Eine
  // steigende Rate ist es nicht: Sie heisst, dass sich zwei Teile des Bots
  // gegenseitig die Arbeit abbrechen.
  //
  // Vorbehalt, der zur Ehrlichkeit gehoert: Die Einstellung
  // SuppressBladeburnerPopup schaltet genau diesen Dialog stumm, OHNE den
  // Abbruch zu verhindern. Der Zaehler ist also ein Stellvertreter, kein
  // Beweis - er kann schweigen, waehrend der Schaden weiterlaeuft.
  const popRoh = await rpc({ method: "getFile", filename: "data/popups.txt", server: "home" });
  let popups = null;
  if (typeof popRoh === "string" && popRoh.includes("|")) {
    const teile = popRoh.split("|");
    popups = { zeit: Number(teile[0]) || 0, geschlossen: Number(teile[1]) || 0 };
    const vorher = [...v.punkte].reverse().find((x) => Number.isFinite(x.popups));
    if (vorher && Number.isFinite(vorher.popups)) {
      const zuwachs = popups.geschlossen - vorher.popups;
      const min = (jetzt - vorher.zeit) / 60000;
      // Mehr als ein Dialog je zwei Minuten ueber ein sinnvolles Fenster.
      if (min >= 5 && zuwachs / min > 0.5) {
        sag("DIALOGFLUT: " + zuwachs + " Dialoge in " + Math.round(min)
          + " min - zwei Teile des Bots brechen sich gegenseitig die Arbeit ab.");
        if (urteil === "SPUR") urteil = "STAGNATION";
      }
    }
  }

  // --- 7. Laeuft das Spiel ueberhaupt mit voller Geschwindigkeit? ----------
  if (Number.isFinite(net.runde)) {
    const vorher = [...v.punkte].reverse().find((x) => Number.isFinite(x.runde));
    if (vorher) {
      // DIE UHR DES MOTORS, NICHT DIE DES PRUEFERS (28.08.2026, 22:15).
      //
      // Hier stand `jetzt - vorher.zeit`, also die Zeit zwischen zwei
      // PRUEFLAEUFEN, verglichen mit Rundenzahlen aus `data/bn4net.json`.
      // Die Datei kann aber alt sein - und dann zaehlt der Bruch eine
      // Wallclock-Spanne gegen einen Rundenzuwachs, den es in dieser Spanne
      // gar nicht gab.
      //
      // Genau das ist um 22:00 passiert: gemeldet wurden "1,00 Motorrunden je
      // Minute", waehrend eine direkte Messung um 22:09 **6 je Minute** ergab
      // (Runde 112 auf 120 in 80 Sekunden) und `tools/rueckstand.js` das
      // Spiel mit Tempo 1,044 sogar leicht VOR der Uhr sah. Der Alarm war
      // falsch, und er haette die ganze Nacht alle zwanzig Minuten gefeuert.
      //
      // Richtig ist die Spanne zwischen den beiden Zeitstempeln DERSELBEN
      // Quelle. Fehlt der alte (Verlaufspunkte von vor dieser Aenderung),
      // wird nicht gemessen statt falsch gemessen.
      const spanneMs = (Number.isFinite(net.zeit) && Number.isFinite(vorher.netZeit))
        ? net.zeit - vorher.netZeit : null;
      const min = spanneMs === null ? 0 : spanneMs / 60000;
      const drunden = net.runde - vorher.runde;
      // Normal sind vier bis sechs Runden je Minute. Unter einer Runde je
      // Minute ist der Tab gedrosselt - das ist Faktor 16 auf ALLES, vom
      // Geldverdienen bis zum Bladeburner-Rang.
      if (min >= 5 && drunden >= 0 && drunden / min < 1) {
        sag("GEDROSSELT: nur " + (drunden / min).toFixed(2)
          + " Motorrunden je Minute (normal 4-6) - laeuft der Tab im"
          + " Hintergrund ohne wakelock?");
        if (urteil === "SPUR") urteil = "STAGNATION";
      }
    }
  }

  // --- STEHT DIE SPIELENGINE? ---------------------------------------------
  //
  // Diese Pruefung hat Vorrang vor allen anderen: Steht die Engine, sind
  // saemtliche anderen Befunde nur ihre Symptome, und keiner der ueblichen
  // Eingriffe hilft. Der einzige Ausweg ist ein Neuladen des Tabs - das kann
  // kein Loop, das muss Eric tun. Deshalb ist die Meldung so deutlich.
  // EINE ALTE DATEI IST KEIN BEWEIS (25.08.2026, 22:09).
  //
  // Der erste Entwurf verglich einfach zwei Spielzeitwerte aus dem Verlauf.
  // Um 22:08 hat das einen Fehlalarm erzeugt: Nach einem Augmentierungs-Einbau
  // lief blade.js acht Minuten nicht, also stand in blade.json zweimal
  // hintereinander DIESELBE alte Zahl - und der Pruefer meldete eine stehende
  // Engine, waehrend sie nachweislich mit 29,2 Sekunden je halber Minute lief.
  //
  // Nachts waere daraus eine Push-Nachricht geworden, die Eric weckt, fuer ein
  // Problem, das es nicht gibt. Deshalb: Erst pruefen, ob die Quelle selbst
  // frisch ist. Ist sie es nicht, steht nicht die Engine, sondern blade.js -
  // und das ist ein anderer Befund mit einer anderen Reparatur.
  const bladeAlterMs = blade && Number.isFinite(blade.zeit) ? jetzt - blade.zeit : null;
  // In der Wiederaufbauphase ist blade.js planmaessig stumm: Es tritt zurueck,
  // solange die Kampfwerte unter 100 liegen (blade.js:304), und schreibt in
  // diesem Zweig keine Telemetrie. Das ist kein Befund, sondern der Normalfall
  // nach jedem Augmentierungs-Einbau.
  const wiederaufbau = t.phase === "Wiederaufbau nach Einbau";
  // UND IN EINEM KNOTEN OHNE BLADEBURNER SCHWEIGT ES FUER IMMER
  // (28.08.2026, 17:31). `blade.js` ist der Motor von BitNode 6 und 7. In
  // BitNode 10 laeuft es nicht und soll es nicht - seine alte Telemetrie
  // ueberlebt aber den Knotenwechsel auf home, und das Alter dieser Datei
  // hat den Pruefer um 17:30 auf STAGNATION geschickt, obwohl der Bot
  // planmaessig sein Netz aufbaut. Der Puls dieses Knotens ist bn4net.json,
  // nicht blade.json.
  // KORRIGIERT 29.08.2026, 04:15 - die alte Fassung haette den Motor dieses
  // Knotens ab dem Beitritt ungeprueft laufen lassen.
  //
  // Hier stand `if (!kampfKnoten) blade = null;`, und `kampfKnoten` ist nur 6
  // oder 7. In BitNode 10 wurde die Telemetrie des Motors also IMMER
  // verworfen - der Satz oben ("in BitNode 10 laeuft es nicht und soll es
  // nicht") stimmte am 28.08. um 17:31, weil der Knoten gerade erst begonnen
  // hatte. Seit dem Kurs von 18:55 ist Bladeburner auch hier der Weg, und
  // `bladeKnoten` schliesst die 10 ein. Ab dem Beitritt haette der Pruefer
  // damit weder das Ausbleiben von `blade.json` gemeldet noch die Rate
  // geprueft - ein stiller Ausfall der gesamten Motorueberwachung.
  //
  // Der urspruengliche Grund bleibt gedeckt: Eine alte `blade.json` ueberlebt
  // den Knotenwechsel auf home. Deshalb wird sie jetzt genau dann verworfen,
  // wenn der Motor nachweislich nicht arbeitet - also ausserhalb der
  // Kampfknoten oder vor dem Beitritt zur Division.
  if (!bladeKnoten || !(bb && bb.inBladeburner)) blade = null;
  if (!wiederaufbau && blade && Number.isFinite(blade.spielzeit)
      && bladeAlterMs !== null && bladeAlterMs > 5 * 60_000) {
    sag("blade.js meldet sich seit " + Math.round(bladeAlterMs / 60000)
      + " min nicht - die Engine laesst sich damit nicht beurteilen.");
    if (urteil === "SPUR") urteil = "STAGNATION";
  } else if (!wiederaufbau && blade && Number.isFinite(blade.spielzeit)) {
    const frueher = [...(v.punkte || [])].reverse().find(
      (x) => Number.isFinite(x.spielzeit) && jetzt - x.zeit >= 4 * 60_000);
    if (frueher) {
      const stillMin = Math.round((jetzt - frueher.zeit) / 60000);
      const zuwachsSek = (blade.spielzeit - frueher.spielzeit) / 1000;
      const vergangenSek = (jetzt - frueher.zeit) / 1000;
      // Grosszuegige Grenze: Ein Zehntel der verstrichenen Zeit reicht als
      // Lebenszeichen. Gedrosselt laeuft die Engine langsamer, aber nicht
      // still - unterschieden werden soll "kriecht" von "tot".
      if (zuwachsSek < vergangenSek * 0.1) {
        sag("DIE SPIELENGINE STEHT: Spielzeit waechst seit " + stillMin
          + " min nur um " + zuwachsSek.toFixed(1) + " s statt um "
          + Math.round(vergangenSek) + " s. Netscript laeuft weiter, updateGame"
          + " nicht - Bladeburner, Reputation und Ausdauer stehen alle still."
          + " Hilft nur ein Neuladen des Tabs (F5).");
        urteil = "STAGNATION";
      }
    }
  }

  // Das URTEIL gehoert in den Verlauf, nicht nur auf den Bildschirm.
  //
  // Ohne diese Zeile bleibt von jedem Lauf nur eine Zahl uebrig, und die Frage
  // "hat ein Pruefer schon einmal SPUR gemeldet, obwohl etwas kaputt war"
  // laesst sich nicht beantworten - die Meldung selbst existiert dann nirgends.
  // Genau diese Luecke hat eine Fremdpruefung am 25.08. aufgedeckt.
  v.punkte.push({ zeit: jetzt, knoten, traeger: t.name, wert: t.wert,
    phase: t.phase, netz: net.gerootet, geld: bb ? bb.geld : null,
    urteil, aktion: blade && blade.aktion ? blade.aktion : null,
    popups: popups ? popups.geschlossen : null,
    // Der Zeitstempel des MOTORS, nicht der des Pruefers. Warum, steht bei
    // der Drosselungspruefung in Abschnitt 7.
    netZeit: Number.isFinite(net.zeit) ? net.zeit : null,
    // Die Rundenzahl des Motors ist das einzige Mass fuer die
    // SPIELGESCHWINDIGKEIT. Ein verborgener Browsertab laeuft 16-fach
    // langsamer; wakelock.js haelt ihn wach, kann aber lautlos ausfallen
    // (AudioContext auf suspended nach einem Reload). Dann schreibt bn4net
    // alle drei Minuten statt alle zehn Sekunden - beide Frischegrenzen
    // bleiben unterschritten, und alles sieht normal aus. Nur diese Zahl
    // verraet es.
    runde: Number.isFinite(net.runde) ? net.runde : null,
    // DER PULS DER SPIELENGINE (25.08.2026, 21:45).
    //
    // Netscript und die Engine sind ZWEI Schleifen. Am 25.08. stand
    // updateGame ab 20:27 still, waehrend bn4net sechs Runden je Minute
    // zaehlte und Hackgeld hereinkam - dieser Pruefer meldete 46 Minuten lang
    // SPUR. Die Rundenzahl oben kann das nicht sehen: Sie misst Netscript.
    //
    // totalPlaytime waechst ausschliesslich in updateGame. blade.js schreibt
    // die Zahl seit 21:15 mit; bleibt sie zwischen zwei Laeufen gleich, ist
    // die Engine tot, und dann hilft kein Neustart eines Werkzeugs.
    spielzeit: blade && Number.isFinite(blade.spielzeit) ? blade.spielzeit : null });
  speichereVerlauf(v);

  return aus();
})();
