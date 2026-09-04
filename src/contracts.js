/**
 * contracts.js - loest die Coding Contracts im gesamten Netz.
 *
 * Aufruf (ueber den Auftragslaeufer des Autopiloten):
 *     node tools/task.js contracts.js --dry
 *     node tools/task.js contracts.js
 *
 * Weitere Schalter:
 *     --loop <sekunden>   nach jedem Durchlauf warten und erneut suchen
 *     --host <rechner>    nur diesen Rechner absuchen
 *     --type <name>       nur Vertraege dieses Typs anfassen
 *     --max <anzahl>      hoechstens so viele Vertraege je Durchlauf
 *
 * Speicherbedarf: 17.65 GB (1.6 Grundkosten + getContract 15 + scan 0.2
 * + ls 0.2 + scp 0.6 + getHostname 0.05, RamCostGenerator.ts:11,22,28,31,388).
 * getContract statt getContractType+getData+attempt einzeln, weil das 15 statt
 * 20 GB kostet und dieselbe Auskunft gibt. `submit` und `numTriesRemaining`
 * sind Abschluesse aus getContract und deshalb gratis mitgekauft.
 *
 * ---------------------------------------------------------------------------
 * Warum die Loeser so gebaut sind, wie sie gebaut sind
 *
 * Das Spiel prueft eine Antwort nicht anhand der Aufgabenbeschreibung, sondern
 * mit einer Funktion `solver(state, answer)` aus dem Quelltext. Die 30 Typen
 * zerfallen in drei Gruppen:
 *
 *   20 Typen: `solver` ist `getAnswer(data) === answer`. Es gibt genau EINE
 *      richtige Antwort, naemlich die von `getAnswer`.
 *    5 Typen: `solver` vergleicht element- oder mengenweise (Spiralize Matrix,
 *      Merge Overlapping Intervals, Generate IP Addresses, Sanitize
 *      Parentheses, Find All Valid Math Expressions). Auch hier ist die Menge
 *      eindeutig, nur die Reihenfolge ist frei.
 *    5 Typen: `solver` akzeptiert eine ganze FAMILIE von Antworten (Shortest
 *      Path in a Grid, Proper 2-Coloring of a Graph, Square Root,
 *      Compression III: LZ Compression, Largest Rectangle in a Matrix).
 *
 * Fuer die ersten 27 Typen (alle mit echtem `getAnswer`) sind die Loeser
 * WOERTLICHE Uebertragungen von `getAnswer` aus
 * reference/v301/src/CodingContract/contracts/*.ts, nicht Eigenbau. Eine
 * eigene, "auch richtige" Loesung waere strikt schlechter: sie kann von
 * getAnswer abweichen, und jede Abweichung kostet einen unwiederbringlichen
 * Versuch.
 *
 * Drei Typen haben `getAnswer: () => null` (Shortest Path in a Grid,
 * Proper 2-Coloring of a Graph, Square Root). Dort prueft das Spiel die
 * Antwort selbst; die Loeser sind eigene Implementierungen, die genau die
 * Bedingung des jeweiligen `solver` erfuellen.
 *
 * Zusaetzlich hat jeder Typ ein `verify(data, answer)`. Vor jedem Absenden
 * laeuft die Antwort durch diese Pruefung; schlaegt sie fehl, bleibt der
 * Vertrag unangetastet. Das ist die Umsetzung von "kein Rateversuch".
 *
 * Bei 29 Typen ist `verify` eine woertliche Uebertragung des SPIEL-`solver`.
 * AUSNAHME "Square Root": dessen solver vergleicht mit dem gespeicherten n
 * (SquareRoot.ts:40-42), und dieses n bekommt ein Skript nie zu sehen -
 * ns.codingcontract.getData liefert nur n^2+offset. `verify` prueft dort
 * ersatzweise das Fenster [n^2-n+1, n^2+n]. Das ist gleichwertig, SOLANGE das
 * Spiel den Versatz auf [1-n, n] beschraenkt (SquareRoot.ts:24-29). Ein
 * Spielstand mit einem Zustand ausserhalb dieses Fensters wuerde hier
 * durchrutschen; aus `data` allein laesst sich das nicht besser pruefen.
 *
 * Grenze dieser Zusage allgemein: `verify` ist eine eingefrorene Abschrift von
 * v3.0.1. Aendert das Spiel eine Regel, sagt `verify` weiter "richtig". Dagegen
 * hilft nur die Kanarienvogel-Pruefung beim Start (getContractTypes) und der
 * harte Abbruch nach einer Ablehnung - beides weiter unten.
 * ---------------------------------------------------------------------------
 */

const LOGFILE = "data/contracts.txt";
// Wird gesetzt, sobald das Spiel eine gegengeprueft-richtige Antwort ablehnt.
// Solange die Datei auf home liegt, verweigert der Scharfmodus den Dienst -
// sonst startet der Autopilot beim naechsten Auftrag munter neu und frisst
// weiter Versuche. Loeschen erst, wenn die Ursache gefunden ist.
const HALTFILE = "data/contracts-halt.txt";

/**
 * Der Stand fuer Kern und Waechter (R27, Skeptiker Runde 4, 04.09.2026).
 *
 * Dieses Gewerk hatte in der Registry `telemetryFile: null` - es lief also
 * ausserhalb jeder Ueberwachung. Bei einem Gewerk, dessen haeufigster
 * Fehlermodus LEISE ist (eine zu strenge Gegenprobe laesst alles aus, ohne
 * dass etwas abstuerzt), ist das die falsche Einstellung.
 *
 * `data/contracts.txt` gibt es weiterhin, aber das ist Fliesstext fuer
 * Menschen. Diese Datei ist fuer Maschinen.
 */
const STANDFILE = "data/contracts.json";
// Ueber dieser Groesse wird das Protokoll vorn gekuerzt. ns.write im
// Anhaengemodus liest den Altbestand und schreibt Alt+Neu, und danach
// kopiert scp die ganze Datei - je Zeile. Ohne Deckel waechst der Aufwand
// quadratisch, und der Spielstand traegt es mit.
const LOG_MAX = 120000;

// ===========================================================================
// Die Loeser stehen seit dem 04.09.2026 in lib/loeser.js (Position C.8).
// ===========================================================================
//
// Grund: die schlanke Kaltstart-Haelfte cdump.js braucht sie ebenfalls, und
// wer contracts.js importiert, zieht dessen 17,65 GB mit - auf einem
// frischen home das Ende. Als eigenes Modul kosten sie NULL Gigabyte, weil
// dort kein Bezeichner steht, den der RAM-Rechner des Spiels kennt.

import { SOLVERS } from "lib/loeser.js";

function fehlertext(e, maxLaenge = 200) {
  const flach = String(e && e.message ? e.message : e).replace(/\s+/g, " ").trim();
  return flach.length > maxLaenge ? "..." + flach.slice(-maxLaenge) : flach;
}

/** Antwort lesbar machen, ohne das Protokoll zu sprengen. */
function kurz(wert, maxLaenge = 160) {
  let text;
  try {
    text = typeof wert === "string" ? wert : JSON.stringify(wert, (k, v) => (typeof v === "bigint" ? String(v) : v));
  } catch (e) {
    text = String(wert);
  }
  if (text === undefined) text = String(wert);
  return text.length > maxLaenge ? text.slice(0, maxLaenge) + "..." : text;
}

/** Ganzes Netz absuchen. Breitensuche ueber ns.scan, 0.2 GB. */
function alleRechner(ns) {
  const gesehen = new Set(["home"]);
  const rand = ["home"];
  while (rand.length) {
    for (const nachbar of ns.scan(rand.pop())) {
      if (!gesehen.has(nachbar)) {
        gesehen.add(nachbar);
        rand.push(nachbar);
      }
    }
  }
  return [...gesehen];
}

export async function main(ns) {
  ns.disableLog("ALL");

  const args = ns.args.map(String);
  const flagWert = (name) => {
    const i = args.indexOf(name);
    return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
  };
  const trockenlauf = args.includes("--dry");
  // Math.max, weil ns.sleep(negativ) auf setTimeout(fn, negativ) hinauslaeuft
  // und das sofort feuert - der Vollscan liefe dann in jeder Makrotask.
  const schleife = Math.max(0, Number(flagWert("--loop")) || 0);
  const nurRechner = flagWert("--host");
  const nurTyp = flagWert("--type");
  const hoechstens = Number(flagWert("--max")) || Infinity;

  const eigenerRechner = ns.getHostname();
  const aufHome = eigenerRechner === "home";

  // Den Altbestand von home holen, BEVOR die erste Zeile geschrieben wird.
  // Grund: ns.scp ueberschreibt das Ziel vollstaendig
  // (NetscriptFunctions.ts:811), und der Autopilot sucht sich bei jedem
  // Auftrag einen anderen Rechner. Ohne diesen Schritt macht der erste
  // Spiegelvorgang aus dem gewachsenen Protokoll auf home eine Ein-Zeilen-
  // Datei - die gesamte Historie waere weg.
  if (!aufHome) ns.scp(LOGFILE, eigenerRechner, "home");
  let bestand = ns.read(LOGFILE) || "";
  if (bestand.length > LOG_MAX) {
    bestand = "[... gekuerzt ...]\n" + bestand.slice(-LOG_MAX);
    ns.write(LOGFILE, bestand, "w");
  }

  const protokoll = (zeile) => {
    const stempel = new Date().toISOString().slice(11, 19);
    const text = stempel + " " + zeile;
    ns.print(text);
    ns.write(LOGFILE, text + "\n", "a");
    if (!aufHome) ns.scp(LOGFILE, "home");
  };

  protokoll(
    "=== Start auf " + eigenerRechner + (trockenlauf ? " [TROCKENLAUF - nichts wird abgesendet]" : " [SCHARF]") + " ===",
  );

  // --- Sperre aus einem frueheren Lauf ------------------------------------
  if (!trockenlauf && !aufHome) ns.scp(HALTFILE, eigenerRechner, "home");
  if (!trockenlauf && ns.read(HALTFILE)) {
    protokoll("ABBRUCH: " + HALTFILE + " liegt vor - ein frueherer Lauf wurde abgelehnt.");
    protokoll("         Ursache klaeren, dann die Datei auf home loeschen. Trockenlauf geht weiterhin.");
    return;
  }

  // --- Kanarienvogel: kennt das Spiel dieselben Typen wie wir? ------------
  // getContractTypes steht nicht in RamCostGenerator.ts:384-391 und kostet
  // deshalb 0 GB. Es ist die einzige Moeglichkeit, eine Regeldrift des
  // LAUFENDEN Spiels zu bemerken - `verify` ist nur eine Abschrift von
  // v3.0.1 und wuerde eine geaenderte Regel nicht bemerken.
  try {
    const imSpiel = ns.codingcontract.getContractTypes();
    const fehlen = imSpiel.filter((t) => !SOLVERS[t]);
    const zuviel = Object.keys(SOLVERS).filter((t) => !imSpiel.includes(t));
    if (fehlen.length) protokoll("HINWEIS: Spiel kennt " + fehlen.length + " Typ(en) ohne Loeser: " + fehlen.join(", "));
    if (zuviel.length) {
      // Ein Loeser fuer einen Typ, den das Spiel nicht mehr fuehrt, heisst:
      // die Uebertragung stammt aus einer anderen Fassung. Dann ist auch
      // bei den verbliebenen Typen nichts mehr garantiert.
      protokoll("ABBRUCH: Loeser fuer unbekannte Typen vorhanden (" + zuviel.join(", ") + ") - Fassung passt nicht.");
      if (!trockenlauf) return;
    }
  } catch (e) {
    protokoll("HINWEIS: getContractTypes nicht verfuegbar (" + fehlertext(e) + ")");
  }

  if (nurRechner) {
    // Ein Tippfehler im Rechnernamen wuerde sonst still zu "0 gefunden"
    // fuehren - der Lauf saehe erfolgreich aus und haette nichts getan.
    try {
      ns.ls(nurRechner);
    } catch (e) {
      protokoll("ABBRUCH: Rechner '" + nurRechner + "' gibt es nicht.");
      return;
    }
  }

  // Typen, bei denen das Spiel eine gegengeprueft-richtige Antwort abgelehnt
  // hat, und Vertraege, die das schon einmal getan haben. Beides ist noetig:
  // eine Regeldrift trifft IMMER alle Vertraege eines Typs, und ohne
  // Gedaechtnis wuerde die --loop-Fassung denselben Vertrag Durchlauf fuer
  // Durchlauf erneut angreifen, bis seine Versuche aufgebraucht sind und
  // ihn das Spiel loescht (NetscriptFunctions/CodingContract.ts:64-70).
  const gesperrteTypen = new Set();
  const abgelehnteVertraege = new Set();
  let ablehnungen = 0;
  // Aufeinanderfolgende Durchlaeufe mit Fund, aber ohne Loesung (R27).
  let stummeRunden = 0;

  for (;;) {
    const zaehler = { gefunden: 0, geloest: 0, uebersprungen: 0, fehlgeschlagen: 0 };
    const rechnerliste = nurRechner ? [nurRechner] : alleRechner(ns);
    let genug = false;

    for (const rechner of rechnerliste) {
      if (genug || ablehnungen >= 2) break;
      let dateien;
      try {
        dateien = ns.ls(rechner, ".cct");
      } catch (e) {
        continue;
      }
      for (const datei of dateien) {
        if (!datei.endsWith(".cct")) continue;
        if (ablehnungen >= 2) break;
        // Der Deckel zaehlt nur BEARBEITETE Vertraege - sonst fressen ein
        // paar uebersprungene das Budget auf, bevor einer geloest ist.
        if (zaehler.geloest >= hoechstens) {
          genug = true;
          break;
        }
        const kennung = rechner + "/" + datei;
        if (abgelehnteVertraege.has(kennung)) continue;
        zaehler.gefunden++;

        // Zwischen zwei Vertraegen einen Zug abgeben. Manche Loeser rechnen
        // spuerbar lange, und Netscript laeuft im selben Faden wie das Spiel.
        await ns.sleep(0);

        let vertrag;
        try {
          vertrag = ns.codingcontract.getContract(datei, rechner);
        } catch (e) {
          // Vertrag zwischenzeitlich geloest oder verschwunden - das ist der
          // Normalfall bei parallel laufenden Skripten, kein Fehler.
          protokoll("weg      " + kennung + "  (" + fehlertext(e) + ")");
          zaehler.uebersprungen++;
          continue;
        }

        const typ = vertrag.type;
        const versuche = vertrag.numTriesRemaining();
        const kopf = kennung + "  [" + typ + "]  Versuche=" + versuche;

        if (nurTyp && typ !== nurTyp) {
          zaehler.uebersprungen++;
          continue;
        }

        if (gesperrteTypen.has(typ)) {
          protokoll("GESPERRT " + kopf + "  -> Typ nach Ablehnung gesperrt, nicht angefasst");
          zaehler.uebersprungen++;
          continue;
        }

        const loeser = SOLVERS[typ];
        if (!loeser) {
          // Unbekannter Typ (neue Spielfassung): anfassen kaeme Raten gleich.
          protokoll("UNBEKANNT " + kopf + "  -> nicht angefasst, Loeser fehlt");
          zaehler.uebersprungen++;
          continue;
        }

        if (loeser.guard) {
          // Der Waechter selbst muss abgesichert sein. Er existiert gerade
          // fuer den Fall einer geaenderten Datenform - und genau dann kann
          // er beim Zugriff auf data[0] werfen. Ohne try/catch wuerde die
          // Ausnahme main verlassen und der Lauf mitten im Netz stumm enden.
          let einwand;
          try {
            einwand = loeser.guard(vertrag.data);
          } catch (e) {
            einwand = "Waechter warf: " + fehlertext(e);
          }
          if (einwand) {
            protokoll("GRENZE   " + kopf + "  -> nicht angefasst: " + einwand);
            zaehler.uebersprungen++;
            continue;
          }
        }

        let antwort;
        const begonnen = Date.now();
        try {
          antwort = loeser.solve(vertrag.data);
        } catch (e) {
          protokoll("FEHLER   " + kopf + "  -> Loeser warf: " + fehlertext(e));
          zaehler.uebersprungen++;
          continue;
        }
        const dauer = Date.now() - begonnen;

        // Eine leere Antwort ist bei KEINEM Typ gueltig. Ohne diese Sperre
        // koennte sie durchrutschen: bei 20 Typen ist verify als
        // `solve(data) === answer` selbstbezueglich, und `undefined ===
        // undefined` ist wahr. Eine Fehlfunktion von solve wuerde sich also
        // selbst bestaetigen.
        if (antwort === undefined || antwort === null) {
          protokoll("VERWORFEN " + kopf + "  -> Loeser lieferte nichts");
          zaehler.uebersprungen++;
          continue;
        }

        // Die Gegenprobe mit der Regel des Spiels. Nur was hier besteht,
        // darf einen Versuch kosten.
        let bestanden = false;
        try {
          bestanden = loeser.verify(vertrag.data, antwort) === true;
        } catch (e) {
          bestanden = false;
        }

        if (!bestanden) {
          protokoll("VERWORFEN " + kopf + "  -> Gegenprobe fehlgeschlagen, Antwort=" + kurz(antwort));
          zaehler.uebersprungen++;
          continue;
        }

        if (trockenlauf) {
          protokoll("trocken  " + kopf + "  ms=" + dauer + "  Zuversicht=sicher  Antwort=" + kurz(antwort));
          zaehler.geloest++;
          continue;
        }

        let belohnung;
        try {
          belohnung = vertrag.submit(antwort);
        } catch (e) {
          // Ein Wurf heisst Formatfehler - hier wird KEIN Versuch verbraucht
          // (NetscriptFunctions/CodingContract.ts:31-35 prueft vor dem
          // Zaehler). Trotzdem den Vertrag merken, sonst laeuft die Schleife
          // beim naechsten Durchlauf in denselben Fehler.
          protokoll("FEHLER   " + kopf + "  -> submit warf: " + fehlertext(e));
          abgelehnteVertraege.add(kennung);
          zaehler.fehlgeschlagen++;
          continue;
        }

        if (belohnung) {
          protokoll("GELOEST  " + kopf + "  ms=" + dauer + "  Lohn: " + belohnung);
          zaehler.geloest++;
        } else {
          // Leerer Rueckgabewert heisst laut NetscriptFunctions/CodingContract.ts:63
          // "Failure" - ein Versuch IST verbrannt. Nach bestandener Gegenprobe
          // kann das nur eine Regelaenderung des Spiels sein, und die trifft
          // dann jeden Vertrag dieses Typs. Also: Typ sperren, Vertrag merken,
          // und beim zweiten Vorfall den Lauf beenden und eine Sperre
          // hinterlassen. Ohne das wuerde --loop jeden Vertrag des Typs
          // Durchlauf fuer Durchlauf weiter angreifen, bis das Spiel ihn nach
          // dem letzten Versuch loescht - "Array Jumping Game" hat genau
          // EINEN (ArrayJumpingGame.ts:39).
          protokoll("ABGELEHNT " + kopf + "  -> Spiel hat die Antwort NICHT angenommen: " + kurz(antwort));
          gesperrteTypen.add(typ);
          abgelehnteVertraege.add(kennung);
          zaehler.fehlgeschlagen++;
          ablehnungen++;
          if (ablehnungen >= 2) {
            protokoll("NOTBREMSE: zweite Ablehnung - Lauf wird beendet, " + HALTFILE + " wird gesetzt.");
            ns.write(HALTFILE, new Date().toISOString() + " Ablehnung bei Typ " + typ + " auf " + kennung + "\n", "a");
            if (!aufHome) ns.scp(HALTFILE, "home");
          }
        }
      }
    }

    protokoll(
      "--- Durchlauf fertig: " +
        zaehler.gefunden +
        " gefunden, " +
        zaehler.geloest +
        (trockenlauf ? " loesbar" : " geloest") +
        ", " +
        zaehler.uebersprungen +
        " uebersprungen, " +
        zaehler.fehlgeschlagen +
        " abgelehnt ---",
    );

    // DEN STAND WEGSCHREIBEN - vor jedem Ausstieg aus der Schleife, sonst
    // fehlt er genau in dem Lauf, der schiefging (R27).
    //
    // `stummeRunden` zaehlt aufeinanderfolgende Durchlaeufe, in denen
    // Vertraege gefunden und KEINER geloest wurde. Der Fall sieht von aussen
    // aus wie ein gesundes Gewerk: es laeuft, es schreibt, es stuerzt nicht
    // ab. Er entsteht, wenn eine Gegenprobe in `lib/loeser.js` strenger ist
    // als das Spiel - fuenf solcher Proben wurden am 04.09.2026 gefunden.
    //
    // `uebersprungen` allein taugt dafuer nicht: es zaehlt auch Vertraege,
    // die absichtlich liegen bleiben (gesperrter Typ, schon abgelehnt,
    // Hoechstzahl erreicht). Deshalb die Bedingung auf `geloest === 0`.
    if (zaehler.gefunden > 0 && zaehler.geloest === 0) stummeRunden++;
    else stummeRunden = 0;

    try {
      ns.write(STANDFILE, JSON.stringify({
        ts: Date.now(),
        gefunden: zaehler.gefunden,
        geloest: zaehler.geloest,
        uebersprungen: zaehler.uebersprungen,
        fehlgeschlagen: zaehler.fehlgeschlagen,
        ablehnungen,
        gesperrteTypen: [...gesperrteTypen],
        stummeRunden,
        trockenlauf,
      }), "w");
      if (!aufHome) ns.scp(STANDFILE, "home");
    } catch (e) {
      // Der Stand ist Buchhaltung, keine Aufgabe. Er darf den Lauf nicht
      // beenden - aber er soll im Protokoll auftauchen, sonst ist auch sein
      // Ausfall lautlos.
      protokoll("Stand nicht schreibbar: " + kurz(e));
    }

    if (ablehnungen >= 2) {
      protokoll("=== Ende nach Notbremse. Erst pruefen, dann " + HALTFILE + " auf home loeschen. ===");
      return;
    }
    if (!schleife) break;
    await ns.sleep(schleife * 1000);
  }
}
