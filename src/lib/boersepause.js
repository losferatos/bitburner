/**
 * Ausverkauf des Depots vor dem Einbau (BN8-1, Audit 07.11.2026).
 *
 * `installAugmentations` -> `prestigeAugmentation` ruft in JEDEM Knoten mit
 * Boersenzugang `initStockMarket()` (Prestige.ts:169-172): jede Position ist
 * danach weg, ohne Auszahlung. In BitNode 8 setzt derselbe Aufruf das Geld
 * auf 250 Mio (Prestige.ts:160-163) - verkauft man erst NACH dem Geldausgeben,
 * ist der Erloes trotzdem verloren. Der Verkauf muss also VOR den letzten
 * Kaeufen (Fuellstueck, NeuroFlux) liegen.
 *
 * Ablauf: bn4rep legt data/boerse-pause.txt ({id, bis}) auf home. boerse.js
 * sieht die Pause, verkauft alles, kauft bis `bis` nichts mehr und meldet in
 * data/boerse.json `verkauftFuer: id`. bn4rep wartet hoechstens WARTE_MAX_MS
 * auf diese Quittung. boot.js raeumt die Datei nach dem Einbau weg.
 *
 * Kein Geld wird hier bewegt: das Modul entscheidet nur. Damit kostet es
 * bn4rep kein RAM fuer die Boersen-API.
 */

export const PAUSE_FILE = "data/boerse-pause.txt";
export const TEL_FILE = "data/boerse.json";

/** So lange kauft boerse.js nach der Anfrage nichts (deckt NFG-Schleife + Tore). */
export const PAUSE_MS = 10 * 60000;

/** Laenger wartet bn4rep nicht: boerse.js tickt alle 6 s. */
export const WARTE_MAX_MS = 45000;

/** Aelter als das heisst: boerse.js laeuft nicht (mehr). */
export const TEL_FRISCH_MS = 120000;

export function pauseAnlegen(jetzt) {
  return JSON.stringify({ id: "p" + jetzt, ts: jetzt, bis: jetzt + PAUSE_MS });
}

/**
 * Liest die Pausendatei. Kaputt oder abgelaufen heisst: keine Pause.
 * @returns {{aktiv:boolean, id:string|null}}
 */
export function pauseLesen(roh, jetzt) {
  if (typeof roh !== "string" || roh.trim() === "") return { aktiv: false, id: null };
  let p;
  try { p = JSON.parse(roh); } catch { return { aktiv: false, id: null }; }
  if (!p || typeof p.id !== "string" || !Number.isFinite(p.bis)) return { aktiv: false, id: null };
  return { aktiv: jetzt < p.bis, id: p.id, restMs: p.bis - jetzt };
}

/**
 * Darf bn4rep weitermachen?
 *  "quittiert"  boerse.js hat fuer diese id verkauft
 *  "keinhandel" boerse.js laeuft nicht, ist beendet oder hat kein Depot
 *  "warten"     noch keine Quittung, Frist laeuft
 *  "zeitueber"  Frist vorbei ohne Quittung - einbauen ist nicht schlechter als vorher
 */
export function freigabe(telRoh, id, jetzt, seit) {
  let tel = null;
  try { tel = telRoh ? JSON.parse(telRoh) : null; } catch { tel = null; }
  if (tel && tel.verkauftFuer === id) return "quittiert";
  if (!tel || !Number.isFinite(tel.ts) || jetzt - tel.ts > TEL_FRISCH_MS) return "keinhandel";
  if (tel.state === "done") return "keinhandel";
  // Nur eine Quittung, die NACH der Anfrage geschrieben wurde, zeigt ein leeres
  // Depot; ein alter Herzschlag mit posten 0 kann vor einem Kauf liegen.
  if (tel.ts >= seit && tel.posten === 0 && !(tel.depotWert > 0)) return "keinhandel";
  if (jetzt - seit >= WARTE_MAX_MS) return "zeitueber";
  return "warten";
}

// ---------------------------------------------------------------------------
// Bargeld auf Abruf (BN8-2) und die Sicht von bn4rep auf das Vermoegen
// ---------------------------------------------------------------------------

export const ABRUF_FILE = "data/boerse-abruf.txt";

/** So lange haelt boerse.js den Betrag bar. bn4rep erneuert je Runde. */
export const ABRUF_MS = 3 * 60000;

/**
 * Im Lauf wird nur gekauft, was hoechstens ein Zehntel des Vermoegens kostet.
 * Das Vermoegen waechst exponentiell; ein Kauf von W/10 kostet 0,15
 * Verdopplungen (rund 10 min mit 4S), einer von W/1 das ganze Kapital. Alles
 * Teurere kauft die Einbaurunde - dort ist das Depot ohnehin verkauft.
 */
export const KAUF_FAKTOR = 10;

/** Dasselbe fuer Spenden (Geld gegen Ruf): ein Viertel des Vermoegens ist die Grenze. */
export const SPENDEN_FAKTOR = 4;

/** Daedalus prueft 100 Mrd BARGELD (FactionJoinCondition.ts:134-145). */
export const DAEDALUS_BAR = 100e9;

export function abrufAnlegen(betrag, grund, jetzt) {
  return JSON.stringify({ id: "a" + jetzt, betrag: Math.ceil(betrag), grund: String(grund || ""), ts: jetzt, bis: jetzt + ABRUF_MS });
}

/** @returns {{betrag:number, grund:string, id:string|null}} betrag 0 heisst: kein Abruf */
export function abrufLesen(roh, jetzt) {
  const nichts = { betrag: 0, grund: "", id: null };
  if (typeof roh !== "string" || roh.trim() === "") return nichts;
  let p;
  try { p = JSON.parse(roh); } catch { return nichts; }
  if (!p || !(p.betrag > 0) || !Number.isFinite(p.bis) || jetzt >= p.bis) return nichts;
  return { betrag: p.betrag, grund: String(p.grund || ""), id: String(p.id || p.ts || "") };
}

/**
 * Verdopplungszeit des Vermoegens mit 4S und der Regel aus lib/handel.js:
 * 250 Mio -> 1 Bio in 8,0 h (tools/audit/boerse-regel.mjs), das sind 12
 * Verdopplungen, also 40 min je Verdopplung.
 */
export const VERDOPPLUNG_SEK = 2400;

/** So oft darf der 4S-Kauf scheitern, bevor bn4rep nicht mehr darauf wartet. */
export const FEHL_4S_GRENZE = 3;

/**
 * Was bn4rep von der Boerse wissen muss.
 *  aktiv      boerse.js handelt (frische Telemetrie, nicht beendet)
 *  traegt     aktiv UND 4S gekauft: ab hier rechnet bn4rep mit dem VERMOEGEN.
 *             Auch ohne 4S, wenn der Kauf dreimal gescheitert ist - sonst
 *             wartete der Einbau ewig auf eine API, die nicht kommt.
 *  depot      Depotwert zum Geldkurs (nur bei frischer Telemetrie)
 *  unklar     die Telemetrie ist ALT, stammt aber aus diesem Einbauzyklus und
 *             nennt ein Depot: boerse.js schweigt (Neustart, Drosselung), das
 *             Depot ist aber vermutlich noch da. Dann wird nicht eingebaut.
 *  depotLetzt der zuletzt gemeldete Depotwert dieses Einbauzyklus, egal wie alt
 * Vor 4S bleibt bn4rep beim Bargeld und baut nicht ein: die API kostet 25 Mrd,
 * bleibt ueber alle Einbauten und verdoppelt das Wachstum - ein Einbau davor
 * wirft das Kapital auf 250 Mio zurueck und verschiebt sie um viele Stunden.
 *
 * @param seitReset Zeitpunkt des letzten Einbaus (getResetInfo().lastAugReset);
 *                  aeltere Telemetrie beschreibt ein Depot, das es nicht mehr gibt
 */
export function boerseSicht(telRoh, jetzt, seitReset = 0) {
  const aus = { aktiv: false, traegt: false, hat4S: false, depot: 0, unklar: false, depotLetzt: 0 };
  let tel = null;
  try { tel = telRoh ? JSON.parse(telRoh) : null; } catch { tel = null; }
  if (!tel || !Number.isFinite(tel.ts) || tel.state === "done") return aus;
  if (tel.ts < seitReset) return aus;
  aus.depotLetzt = tel.depotWert > 0 ? tel.depotWert : 0;
  if (jetzt - tel.ts > TEL_FRISCH_MS) {
    aus.unklar = aus.depotLetzt > 0;
    return aus;
  }
  aus.aktiv = true;
  aus.hat4S = tel.hat4S === true;
  aus.traegt = aus.hat4S || tel.fehl4S >= FEHL_4S_GRENZE;
  aus.depot = aus.depotLetzt;
  return aus;
}

/**
 * Darf im Lauf (nicht in der Einbaurunde) aus dem Depot gekauft werden?
 * @returns {"bar"|"abruf"|"nein"} bar: Bargeld reicht; abruf: Depot anzapfen
 */
export function kaufAusDepot(preis, bar, depot, faktor = KAUF_FAKTOR) {
  if (bar >= preis) return "bar";
  if (bar + depot >= preis * faktor) return "abruf";
  return "nein";
}
