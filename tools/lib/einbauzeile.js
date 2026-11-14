/**
 * Einbau-Lage fuer den Check-in (B07, 14.11.2026): "Einbau faellig / steht"
 * samt Sperrgrund. NUR ANZEIGE - nichts hier schreibt, loescht oder startet.
 *
 * WARUM
 *
 * Am 11.11.2026 sperrte die Firmenphase die faellige Einbaurunde ueber
 * install-sperre.txt, und von Hand fiel es erst spaeter auf: der Check-in
 * sagte "AUF KURS", weil kein Rang-Befund vorlag. Die Pruefliste fuer BN8
 * (Boerse gesamt, 4S, Casino-Phase) stand nur im Memory.
 *
 * QUELLEN (alle schon vorhanden, kein neuer Schreiber noetig)
 *
 *   data/bn4rep.json   wartend, state/blockedReason/warteGrund (amTorWarten:
 *                      "Einbau faellig, aber ausgesetzt"), bn8.faellig/grund,
 *                      knoten, zeit
 *   data/install-sperre.txt  gleiche Lesart wie bn4rep.js (INSTALL_LOCK_MAX_AGE
 *                      = 5 min): JSON mit `bis`, JSON mit `ts` oder "TAG|ms"
 *                      gelten befristet; alles andere ist unlesbar und gilt
 *                      NICHT (bn4rep raeumt es weg)
 *   data/rep-modus.txt "<ziel>|<ms>" - nur Info (Bremse fuer bn4life)
 *   data/boerse.json, data/casino.json - nur in BN8, nur Info
 *
 * ZUSTAENDE (zustand)
 *
 *   KEIN        nichts in der Warteschlange oder nichts faellig
 *   FAELLIG     der Plan (BN8) oder bn4rep sagt "faellig", der Einbau laeuft an
 *   GESPERRT    eine gueltige install-sperre.txt haelt wartende Augmentierungen
 *   STEHT       faellig, aber ausgesetzt (Tor zu / Sperre) - oder faellig seit
 *               mehr als STEHT_NACH_MS laut frueheren Check-in-Staenden
 *   UNBEKANNT   bn4rep.json fehlt, ist alt oder stammt aus einem anderen Knoten
 *
 * WELCHE UHR (Lehre 30.08.2026): "faellig seit" wird in ONLINE-Zeit gemessen -
 * Stunden, in denen die Bruecke das Spiel verbunden sah (offlineFenster aus
 * data/bridge.log, wie die V1-Kurve). Eine Offline-Nacht mit stehendem Spiel ist
 * kein "es passiert nichts": der Bot konnte nicht einbauen. Ohne Fenster-Angabe
 * (e.offline fehlt) gilt die Wanduhr - dann nur fuer den Test.
 */

import { onlineStunden } from "./v1kurve.js";

export const INSTALL_LOCK_MAX_AGE_MS = 300000;
// bn4rep schreibt im Wartezustand alle 15 s; die Registry nennt 30 min Frische.
export const TELEMETRIE_FRISCH_MS = 30 * 60000;
// Ab dieser Dauer im Zustand FAELLIG/STEHT laut Check-in-Staenden heisst
// "faellig, aber nichts passiert" - ein Einbau dauert Minuten, nicht Stunden.
export const STEHT_NACH_MS = 90 * 60000;

const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : null);
const dauerMin = (ms) => {
  const m = Math.max(0, Math.round(ms / 60000));
  return m < 90 ? m + " min" : (m / 60).toFixed(1) + " h";
};

/**
 * install-sperre.txt lesen wie bn4rep.js (Zeilen ~1460-1480).
 * roh = Dateitext oder null/"" (Datei fehlt). Rueckgabe null = keine Datei.
 */
export function sperreLesen(roh, jetztMs) {
  if (roh === null || roh === undefined || String(roh).trim() === "") return null;
  const t = String(roh).trim();
  let bis = NaN, grund = "", art = "unlesbar";
  if (t.startsWith("{")) {
    try {
      const j = JSON.parse(t);
      bis = Number.isFinite(Number(j.bis)) ? Number(j.bis)
        : Number.isFinite(Number(j.ts)) ? Number(j.ts) + INSTALL_LOCK_MAX_AGE_MS : NaN;
      grund = [j.reason, j.text].filter(Boolean).join(": ");
      art = "json";
    } catch { bis = NaN; }
  } else {
    const teile = t.split("|");
    const stempel = Number(teile[1]);
    if (Number.isFinite(stempel)) { bis = stempel + INSTALL_LOCK_MAX_AGE_MS; grund = teile[0]; art = "tag"; }
  }
  const gilt = Number.isFinite(bis) && jetztMs < bis;
  return { gilt, bis: Number.isFinite(bis) ? bis : null, grund: grund || (art === "unlesbar" ? "unlesbar: " + t.slice(0, 40) : ""), art };
}

/**
 * @param {object} e
 *   tele       data/bn4rep.json als Objekt oder null
 *   sperreRoh  Text von data/install-sperre.txt oder null
 *   repModusRoh Text von data/rep-modus.txt oder null
 *   knoten     aktueller BitNode (Zahl) oder null
 *   jetztMs    Date.now()
 *   punkte     Check-in-Staende (data/checkin.json -> punkte), optional
 *   offline    Offline-Fenster [[von,bis],...] aus offlineFenster(bridge.log), optional
 * @returns {{zustand:string, wartend:number|null, grund:string, sperre:object|null,
 *            repModus:object|null, faelligSeitMs:number|null, zeilen:string[]}}
 */
export function einbauLage(e) {
  const jetzt = e.jetztMs;
  const tele = e.tele && typeof e.tele === "object" ? e.tele : null;
  const sperre = sperreLesen(e.sperreRoh, jetzt);
  const repModus = (() => {
    const t = e.repModusRoh ? String(e.repModusRoh).trim() : "";
    if (!t) return null;
    const teile = t.split("|");
    const ts = num(teile[1]);
    return { ziel: teile[0], altMs: ts === null ? null : Math.max(0, jetzt - ts) };
  })();

  const aus = (zustand, wartend, grund, extra = {}) => {
    const zeilen = [];
    const sp = sperre && sperre.gilt
      ? " Sperre install-sperre.txt gilt noch " + dauerMin(sperre.bis - jetzt) + (sperre.grund ? " (" + sperre.grund + ")" : "") + "."
      : "";
    const rm = repModus ? " Reputationsarbeit: " + repModus.ziel
      + (repModus.altMs !== null ? " (Marke " + dauerMin(repModus.altMs) + " alt)" : "") + "." : "";
    const wart = wartend !== null ? wartend + " Augmentierung(en) in der Warteschlange" : "Warteschlange unbekannt";
    if (zustand === "KEIN") {
      zeilen.push("EINBAU: nichts faellig - " + wart + "." + sp + rm);
    } else if (zustand === "UNBEKANNT") {
      zeilen.push("EINBAU: nicht beurteilbar - " + grund + (sperre && sperre.gilt ? sp : ""));
    } else if (zustand === "STEHT") {
      zeilen.push("EINBAU STEHT: faellig, aber es passiert nichts - " + grund + ". " + wart + "." + sp + rm);
    } else if (zustand === "FAELLIG") {
      zeilen.push("EINBAU FAELLIG: " + grund + ". " + wart + "; bn4rep.js baut in der naechsten Runde ein." + sp + rm);
    } else { // GESPERRT
      zeilen.push("EINBAU GESPERRT: " + wart + ", aber " + grund + "." + sp + rm);
    }
    return { zustand, wartend, grund, sperre, repModus, faelligSeitMs: null, ...extra, zeilen };
  };

  // --- Telemetrie brauchbar? -------------------------------------------------
  if (!tele) return aus("UNBEKANNT", null, "data/bn4rep.json fehlt (laeuft bn4rep.js?)");
  const alter = jetzt - (num(tele.zeit) ?? 0);
  if (alter > TELEMETRIE_FRISCH_MS) {
    return aus("UNBEKANNT", num(tele.wartend), "data/bn4rep.json ist " + dauerMin(alter) + " alt");
  }
  if (e.knoten !== null && e.knoten !== undefined && num(tele.knoten) !== null && num(tele.knoten) !== Number(e.knoten)) {
    return aus("UNBEKANNT", null, "data/bn4rep.json stammt aus BitNode " + tele.knoten + ", jetzt ist BitNode " + e.knoten);
  }

  const wartend = num(tele.wartend);
  // amTorWarten (bn4rep.js ~2540) schreibt state "wait" + warteGrund, wenn der
  // Einbau FAELLIG war und das Tor ihn aufhaelt. Die zweite Stelle mit
  // warteGrund ("kein erarbeitbares Ziel") ist KEIN Einbau und zaehlt nicht.
  const ausgesetzt = tele.state === "wait" && tele.blockedReason === "locked"
    && typeof tele.warteGrund === "string" && tele.warteGrund !== ""
    && tele.warteGrund !== "kein erarbeitbares Ziel" && !tele.offenOhneArbeit;
  const bn8 = tele.bn8 && typeof tele.bn8 === "object" ? tele.bn8 : null;
  const bn8Faellig = !!(bn8 && bn8.faellig === true && (wartend === null || wartend > 0));

  // --- Wie lange schon faellig? (nur aus frueheren Check-in-Staenden) --------
  const istFaellig = ausgesetzt || bn8Faellig;
  let seit = null;
  if (istFaellig && Array.isArray(e.punkte)) {
    for (let i = e.punkte.length - 1; i >= 0; i--) {
      const p = e.punkte[i];
      if (!p || p.knoten !== e.knoten) break;
      if (p.einbau !== "FAELLIG" && p.einbau !== "STEHT") break;
      if (Number.isFinite(p.ts)) seit = p.ts;
    }
  }
  // Online-Zeit seit dem ersten Stand der Kette (Offline-Fenster abgezogen).
  const onlineMs = seit === null ? 0
    : Array.isArray(e.offline) ? onlineStunden(seit, jetzt, e.offline) * 3600000 : jetzt - seit;
  const seitText = seit !== null && onlineMs > 0 ? " (seit mindestens " + dauerMin(onlineMs) + " online laut Check-in-Staenden)" : "";
  const langeFaellig = seit !== null && onlineMs >= STEHT_NACH_MS;

  let r;
  if (ausgesetzt) {
    r = aus("STEHT", wartend, "ausgesetzt: " + tele.warteGrund + seitText);
  } else if (bn8Faellig && sperre && sperre.gilt) {
    r = aus("STEHT", wartend, "BN8-Plan sagt faellig (Runde " + (bn8.runde ?? "?") + "), aber die Einbausperre haelt ihn auf" + seitText);
  } else if (bn8Faellig && langeFaellig) {
    r = aus("STEHT", wartend, "BN8-Plan faellig (" + (bn8.grund || "kein Grund genannt") + ") und trotzdem kein Einbau" + seitText);
  } else if (bn8Faellig) {
    r = aus("FAELLIG", wartend, "BN8-Plan Runde " + (bn8.runde ?? "?") + ": " + (bn8.grund || "faellig"));
  } else if (sperre && sperre.gilt && wartend !== null && wartend > 0) {
    r = aus("GESPERRT", wartend, "install-sperre.txt haelt sie zurueck");
  } else {
    r = aus("KEIN", wartend, "");
  }
  r.faelligSeitMs = seit;
  return r;
}

/**
 * BN8-Zeile: Boerse gesamt, 4S, Casino-Phase. boerse/casino sind die Objekte
 * aus data/boerse.json bzw. data/casino.json oder null.
 */
export function bn8Zeile(boerse, casino) {
  const mrd = (x) => (Number.isFinite(Number(x)) ? (Number(x) / 1e9).toFixed(2) + " Mrd" : "?");
  const teile = [];
  if (boerse) {
    teile.push("Boerse gesamt " + mrd(boerse.gesamt) + " (Depot " + mrd(boerse.depotWert) + ", bar " + mrd(boerse.bar) + ")"
      + ", 4S " + (boerse.hat4S ? "ja" : "nein") + ", " + (num(boerse.posten) ?? "?") + " Posten"
      + (boerse.state && boerse.state !== "work" ? " [" + boerse.state + (boerse.blockedReason ? ": " + boerse.blockedReason : "") + "]" : ""));
  } else teile.push("Boerse: keine Telemetrie");
  if (casino) {
    teile.push("Casino " + (casino.phase || casino.state || "?")
      + (Number.isFinite(Number(casino.winnings)) ? ", Gewinn " + mrd(casino.winnings) : ""));
  } else teile.push("Casino: keine Telemetrie");
  return "BN8: " + teile.join("; ") + ".";
}
