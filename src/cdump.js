/**
 * Vertraege auslesen UND loesen - die schlanke Haelfte der Kaltstart-Geldkette.
 *
 * ===========================================================================
 * WARUM GETRENNT VON contracts.js
 * ===========================================================================
 *
 * `contracts.js` loest im Spiel und braucht dafuer 17,65 GB (`getContract`
 * allein kostet 15). Nach einem BitNode-Wechsel hat `home` 32 GB, davon
 * belegen Kern, Waechter und Wachhalter 19,15 - es bleiben 12,85, und das
 * reicht nicht. Ausgerechnet in der Phase, in der Vertraege die mit Abstand
 * schnellste Geldquelle sind (ARCHITEKTUR E9): Das Netz haengt dann an sechs
 * Servern ohne Portbedarf, und ohne Geld gibt es weder TOR noch Portprogramme
 * noch Mietrechner.
 *
 * Deshalb hier nur `getContractType` und `getData` - je 5 GB, zusammen 10
 * statt der 15 von `getContract`. Mit dem Grundpreis sind es 12,00 GB, und die
 * passen.
 *
 * ===========================================================================
 * ES LOEST JETZT SELBST (Position C.8, 04.09.2026)
 * ===========================================================================
 *
 * Bis heute schrieb diese Datei nur eine Liste, und ein MENSCH loeste sie
 * ausserhalb - `tools/csolve.js` ueber die Bruecke, auf Zuruf. Damit war die
 * einzige Geldquelle des Kaltstarts von jemandem abhaengig, der hinsieht. In
 * einem Auftrag, dessen erste Zeile "maximal autonom" lautet, war das die
 * zweitgroesste Luecke nach dem Grafting.
 *
 * Die Loeser stehen in `lib/loeser.js` und rechnen nur - als eigenes Modul
 * kosten sie NULL Gigabyte. Diese Datei ist damit genauso gross wie vorher und
 * kann trotzdem alles.
 *
 * ===========================================================================
 * DIE ROTATION
 * ===========================================================================
 *
 * `cdump.js` schreibt `data/cantwort.json` und beendet sich. `csolve.js`
 * reicht ein (`attempt`, 10 GB) und LOESCHT die Datei. Erst danach laeuft
 * `cdump.js` wieder - so sind nie beide zugleich auf `home`, und zusammen
 * waeren sie 24,25 GB.
 *
 * Die Kopplung steht in der Registry als Vorbedingung: `cdump.js` verlangt,
 * dass `data/cantwort.json` NICHT existiert, `csolve.js` verlangt, dass sie
 * existiert. Beide Dateien haben damit einen echten Schreiber - anders als in
 * der ersten Fassung, wo `data/contracts.json` und `data/csolve-laeuft.txt` in
 * der Registry standen und niemand sie je schrieb.
 *
 * ===========================================================================
 * WAS DIESES GEWERK MELDET
 * ===========================================================================
 *
 * `data/cdump-stand.json` (seit 04.09.2026, R27): gefunden, geloest,
 * ausgelassen, die Gruende nach Haeufigkeit - und `stummeRunden`. Das ist der
 * Zaehler fuer den einzigen Fehlermodus, den man sonst nicht sieht: es findet
 * Vertraege, loest keinen davon, und stuerzt dabei nicht ab. Siehe unten.
 *
 * ===========================================================================
 * WAS NICHT GERATEN WIRD
 * ===========================================================================
 *
 * Ein Versuch ist unwiederbringlich. Deshalb wird jede Antwort vor dem
 * Aufschreiben gegengeprueft (`verify` in `lib/loeser.js`), und ein Vertrag,
 * dessen Typ unbekannt ist oder dessen Probe nicht aufgeht, wird NICHT
 * eingereicht - er wandert mit Grund in die Liste der ausgelassenen.
 *
 * @param {NS} ns
 */

import { SOLVERS } from "lib/loeser.js";

export async function main(ns) {
  const gesehen = new Set(["home"]);
  const rand = ["home"];
  while (rand.length) {
    const h = rand.pop();
    for (const n of ns.scan(h)) if (!gesehen.has(n)) { gesehen.add(n); rand.push(n); }
  }

  const antworten = [];
  const ausgelassen = [];
  const roh = [];

  for (const host of gesehen) {
    for (const datei of ns.ls(host, ".cct")) {
      let typ = null;
      let daten = null;
      try { typ = ns.codingcontract.getContractType(datei, host); }
      catch (e) { ausgelassen.push({ host, datei, grund: "Typ nicht lesbar: " + kurz(e) }); continue; }
      try { daten = ns.codingcontract.getData(datei, host); }
      catch (e) { ausgelassen.push({ host, datei, typ, grund: "Daten nicht lesbar: " + kurz(e) }); continue; }

      roh.push({ host, datei, typ, daten });

      const loeser = SOLVERS[typ];
      if (!loeser || typeof loeser.solve !== "function") {
        // Ein unbekannter Typ ist kein Fehler, sondern eine Luecke - meist ein
        // neuer Vertragstyp aus einem Spielupdate. Er bleibt liegen, statt
        // einen Versuch zu verbrennen.
        ausgelassen.push({ host, datei, typ, grund: "kein Loeser fuer diesen Typ" });
        continue;
      }

      let antwort;
      try { antwort = loeser.solve(daten); }
      catch (e) { ausgelassen.push({ host, datei, typ, grund: "Loeser warf: " + kurz(e) }); continue; }

      // DIE GEGENPROBE. Sie ist der Grund, warum diese Kette ueberhaupt
      // autonom laufen darf: ein Versuch ist unwiederbringlich, und von zehn
      // sind meist schon welche weg. Was die Probe nicht besteht, wird nicht
      // eingereicht.
      if (typeof loeser.verify === "function") {
        let ok = false;
        try { ok = loeser.verify(daten, antwort); }
        catch (e) { ok = false; }
        if (!ok) {
          ausgelassen.push({ host, datei, typ, grund: "Gegenprobe fehlgeschlagen" });
          continue;
        }
      }

      antworten.push({ host, datei, typ, antwort });
    }
  }

  // Die Rohliste bleibt - sie ist der Blick von aussen auf das, was im Netz
  // liegt, und `tools/` liest sie.
  //
  // DER ERSETZER IST NICHT ZIERDE (Skeptiker Substanz, 04.09.2026).
  //
  // `ns.codingcontract.getData` liefert bei *Square Root* einen BIGINT
  // (`SquareRoot.ts:33-36`, ueber `structuredClone` in
  // `NetscriptFunctions/CodingContract.ts:100-104`). `JSON.stringify` wirft
  // darauf "Do not know how to serialize a BigInt" - ungefangen, mitten in
  // main.
  //
  // Die Folge waere die schlimmste, die dieses Gewerk haben kann: weder
  // cdump.json noch cantwort.json wuerden geschrieben, die Rotation ruecke nie
  // vor, csolve.js liefe nie - und der Kern startete cdump.js alle fuenf
  // Minuten neu, wo es wieder stuerbe. Sobald irgendwo im Netz ein
  // Square-Root-Vertrag liegt, waere die einzige Geldquelle des Kaltstarts
  // dauerhaft tot.
  //
  // Der Vorgaenger hatte den Ersetzer (contracts.js:101). Beim Herausloesen
  // der Loeser ging er verloren - eine Zeile, die beim Lesen wie Kosmetik
  // aussieht und es nicht ist.
  const ohneBigInt = (k, v) => (typeof v === "bigint" ? String(v) : v);
  ns.write("data/cdump.json", JSON.stringify(roh, ohneBigInt), "w");
  if (ns.getHostname() !== "home") {
    ns.scp("data/cdump.json", "home", ns.getHostname());
  }

  // NUR SCHREIBEN, WENN ES ETWAS ZU TUN GIBT. Eine leere Antwortdatei wuerde
  // die Rotation blockieren: `cdump.js` darf nur laufen, solange es sie NICHT
  // gibt, und `csolve.js` startet fuer nichts.
  if (antworten.length) {
    ns.write("data/cantwort.json", JSON.stringify(antworten, ohneBigInt), "w");
    // NACH HOME KOPIEREN (Skeptiker Fehlermodi, 04.09.2026).
    //
    // Die Vorbedingung von `csolve.js` prueft `data/cantwort.json` auf HOME -
    // `dateiDa` im Kern schaut nirgends sonst hin. Legt der Starter `cdump.js`
    // auf einen Ausweichwirt (und das tut er, sobald home voll ist), bliebe
    // die Datei dort liegen: `csolve.js` liefe nie, die Rotation ruecke nicht
    // vor, und `cdump.js` loeste dieselben Vertraege endlos neu. Lautlos.
    //
    // Die Registry sagt das seit jeher (`scpToHome: true`) - nur las es
    // niemand.
    if (ns.getHostname() !== "home") {
      ns.scp("data/cantwort.json", "home", ns.getHostname());
    }
  }
  ns.write("data/cdump-log.txt",
    new Date().toLocaleTimeString() + "  " + roh.length + " Vertraege gefunden, "
    + antworten.length + " geloest und geprueft, " + ausgelassen.length + " ausgelassen.\n"
    + ausgelassen.map((a) => "  " + a.host + "/" + a.datei + " ("
      + (a.typ || "?") + "): " + a.grund).join("\n") + "\n", "w");

  // ==========================================================================
  // DER STUMME FALL (R27, Skeptiker Runde 4, 04.09.2026)
  // ==========================================================================
  //
  // Bis hierher gab es nur `data/cdump-log.txt` - Fliesstext fuer Menschen.
  // Kein Werkzeug las ihn, kein Waechter, kein Kennzahlenblock.
  //
  // Das ist genau bei diesem Gewerk gefaehrlich, weil sein haeufigster
  // Fehlermodus LEISE ist. Ist eine Gegenprobe in `lib/loeser.js` zu streng,
  // dann stuerzt nichts ab: `cdump.js` findet zehn Vertraege, laesst zehn
  // aus, schreibt keine `cantwort.json`, beendet sich mit Rueckgabewert 0 -
  // und der Kern startet es fuenf Minuten spaeter wieder. Die Telemetrie
  // bleibt frisch, S1 schweigt zu Recht, und die einzige Geldquelle des
  // Kaltstarts steht still.
  //
  // Fuenf solcher zu strengen Proben sind am 04.09.2026 wirklich gefunden
  // worden, in frisch geschriebenem Code. Der Fall ist nicht theoretisch.
  //
  // `stummeRunden` ist die Zahl, die das sichtbar macht: aufeinanderfolgende
  // Laeufe, in denen Vertraege DA waren und keiner durchkam. Sie muss ueber
  // Laeufe hinweg zaehlen, weil dieses Gewerk ein Einmallaeufer ist - also
  // wird der Vorstand gelesen. `ns.read` kostet null Gigabyte und liefert bei
  // fehlender Datei den leeren String; `ns.fileExists` (0,10 GB) waere hier
  // nicht bezahlbar - `cdump.js` hat im Kaltstart 0,20 GB Luft.
  let stummeRunden = 0;
  try {
    const vor = JSON.parse(ns.read("data/cdump-stand.json") || "{}");
    if (Number.isFinite(vor.stummeRunden)) stummeRunden = vor.stummeRunden;
  } catch { /* erster Lauf oder unlesbar - dann faengt die Zaehlung bei 0 an */ }
  stummeRunden = (roh.length > 0 && antworten.length === 0) ? stummeRunden + 1 : 0;

  // Warum welche Vertraege ausgelassen wurden, nach Grund gebuendelt. Ohne
  // das sieht man DASS nichts durchkommt, aber nicht WO es klemmt.
  const gruende = {};
  for (const a of ausgelassen) gruende[a.grund] = (gruende[a.grund] || 0) + 1;

  ns.write("data/cdump-stand.json", JSON.stringify({
    ts: Date.now(),
    gefunden: roh.length,
    geloest: antworten.length,
    ausgelassen: ausgelassen.length,
    gruende,
    stummeRunden,
  }), "w");
  if (ns.getHostname() !== "home") {
    ns.scp("data/cdump-stand.json", "home", ns.getHostname());
  }

  ns.print(roh.length + " Vertraege, " + antworten.length + " geloest, "
    + ausgelassen.length + " ausgelassen.");
}

/** Fehler und Werte kurz halten - das Protokoll wandert in den Spielstand. */
function kurz(wert, maxLaenge = 120) {
  let text;
  try {
    text = wert instanceof Error ? String(wert.message || wert) : String(wert);
  } catch { text = "?"; }
  return text.length > maxLaenge ? text.slice(0, maxLaenge) + "..." : text;
}
