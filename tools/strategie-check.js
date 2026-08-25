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

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(HIER, "..");
const verlaufPfad = path.join(WURZEL, VERLAUF);

async function rpc(params) {
  const url = new URL("/api/rpc", BRIDGE);
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

const schlaf = (ms) => new Promise((r) => setTimeout(r, ms));

// Der BN6-Steckbrief wird nicht dauernd geschrieben - er ist ein Auftrag, kein
// Dauerlaeufer. Also erst anstossen, dann lesen. Der Auftragskanal wird nur
// belegt, wenn er frei ist: Eine fremde Zeile darf nicht ueberschrieben werden.
async function frischerSteckbrief() {
  const belegt = await rpc({ method: "getFile", filename: "data/task.txt", server: "home" });
  if (typeof belegt === "string" && belegt.trim()) return await liesJson("data/bblage.json");
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
function traeger(knoten, bb, rep) {
  const bladeKnoten = knoten === 6 || knoten === 7;
  if (bladeKnoten) {
    if (!bb) return null;
    if (!bb.inBladeburner) {
      // 100 Kampfwert in einer knappen Stunde - gemessen am 25.08.: von 1 auf
      // 98 in 25 Minuten im Powerhouse Gym.
      return { name: "Kampfwert-Tiefstand", wert: bb.tiefstand, ziel: 100,
        phase: "Tor zur Division", sollRate: 1.7 };
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
  if (!rep) return null;
  return { name: "Hackniveau", wert: rep.hacking, ziel: rep.zielLevel || null,
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
  if (aktion.startsWith("Contracts/")) {
    return { wert: +(1.7 * chance).toFixed(2), grund: aktion
      + " bei " + Math.round(chance * 100) + " % Erfolgschance" };
  }
  if (aktion.startsWith("Operations/")) {
    // Raid ist der Ausreisser: rankGain 55 gegen 2,2 bei Investigation. Genau
    // diese Zeile meint der Kontrollpunkt in nodes/ROUTE.md mit "6.000 mit
    // Raid" - und genau sie verlangt city.comms >= 1.
    const brutto = aktion.includes("Raid") ? 60 : 4;
    return { wert: +(brutto * chance).toFixed(2), grund: aktion
      + " bei " + Math.round(chance * 100) + " % Erfolgschance" };
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
function stecktInLeerlauf(frueher, blade, jetzt) {
  const GRENZE_MIN = 40;
  if (!blade || !blade.aktion) return null;
  const aktion = String(blade.aktion);
  if (!aktion.startsWith("General/")) return null;
  if (aktion.includes("Regeneration")) {
    const [ist, max] = String(blade.ausdauer || "0/1").split("/").map(Number);
    if (max > 0 && ist / max < 0.9) return null;
  }
  // Wie lange steht der Rang schon? Der Verlauf ist das einzige Gedaechtnis.
  const still = [...frueher].reverse();
  let seit = jetzt;
  const wertJetzt = still.length ? still[0].wert : null;
  for (const p of still) {
    if (p.wert !== wertJetzt) break;
    seit = p.zeit;
  }
  const min = (jetzt - seit) / 60000;
  if (min < GRENZE_MIN) return null;
  return aktion + " laeuft, der Rang steht seit " + Math.round(min) + " min";
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
    process.exit(urteil === "SPUR" ? 0 : 1);
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
  const rep = await liesJson("data/bn4rep.json");
  const blade = await liesJson("data/blade.json");
  let bb = await frischerSteckbrief();
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
    sag("Steckbrief ist " + Math.round((jetzt - bb.zeit) / 60000)
      + " min alt - kein Urteil auf dieser Grundlage.");
    bb = null;
    urteil = "BLIND";
  }
  const knoten = (bb && bb.knoten) || (rep && rep.knoten) || null;

  if (!knoten) {
    sag("BitNode nicht bestimmbar - weder Steckbrief noch Reputationsmelder da.");
    urteil = "BLIND";
    return aus();
  }

  const t = traeger(knoten, bb, rep);
  sag("BitNode " + knoten + ", Netz " + net.gerootet + "/" + net.netz
    + ", Geld " + (bb ? Math.round(bb.geld / 1e6) + "m" : "?"));

  if (!t) {
    sag("Der Traeger dieses Knotens ist nicht messbar - Steckbrief fehlt.");
    urteil = "BLIND";
    return aus();
  }

  sag("Phase: " + t.phase);
  sag("Traeger: " + t.name + " = " + t.wert + (t.ziel ? " von " + t.ziel : ""));
  if (bb && (knoten === 6 || knoten === 7)) {
    sag("  Kampf str " + bb.kampf.str + " def " + bb.kampf.def
      + " dex " + bb.kampf.dex + " agi " + bb.kampf.agi
      + "  Stadt " + bb.stadt
      + "  Arbeit " + (bb.arbeit ? (bb.arbeit.klasse || bb.arbeit.typ)
        + (bb.arbeit.ort ? " @ " + bb.arbeit.ort : "") : "keine"));
  }

  // --- 4. Bewegt sich der Traeger? ----------------------------------------
  const v = ladeVerlauf();
  const frueher = v.punkte.filter((x) => x.knoten === knoten && x.traeger === t.name);
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
  const leerlauf = stecktInLeerlauf(frueher, blade, jetzt);
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
      const min = (jetzt - vorher.zeit) / 60000;
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
    // Die Rundenzahl des Motors ist das einzige Mass fuer die
    // SPIELGESCHWINDIGKEIT. Ein verborgener Browsertab laeuft 16-fach
    // langsamer; wakelock.js haelt ihn wach, kann aber lautlos ausfallen
    // (AudioContext auf suspended nach einem Reload). Dann schreibt bn4net
    // alle drei Minuten statt alle zehn Sekunden - beide Frischegrenzen
    // bleiben unterschritten, und alles sieht normal aus. Nur diese Zahl
    // verraet es.
    runde: Number.isFinite(net.runde) ? net.runde : null });
  speichereVerlauf(v);

  return aus();
})();
