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
