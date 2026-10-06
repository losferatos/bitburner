/**
 * CORP-GELD IN BN3: DIE BOT-SEITE (06.10.2026, nodes/corp-2026-10-05/bot/).
 *
 * WAS DAS LOEST. In BN3 baut src/corp.js eine Corporation, die nach ihrer
 * Zuendung (Bewertung >= 1e15, geglaettet) Anteile verkauft und Faktionen
 * besticht - aber NUR auf Anforderung (data/corp-geld.txt, verbindliche
 * Schnittstelle des Koordinators vom 06.10.). Ohne Gang lief bn4rep.js bisher
 * im Modus "alles sofort, teuerste zuerst" (gateBuyMode "normal") und haette
 * das Corp-Geld ueber die x1,9-Kette verbrannt (geldwert.md Abschnitt 1).
 * Mit Corp-Signal verhaelt sich die Kaufschleife jetzt wie mit Gang:
 * Kaufaufschub bis zum Einbau-Tor, dann die geplante Runde.
 *
 * DER RUF IST DER ENGPASS, NICHT DAS GELD (geldwert.md Abschnitt 1). Die
 * Bestechung kauft Ruf fuer 1e9 $ je Punkt aus der Corp-Kasse
 * (Corporation/Actions.ts:667, Constants.ts:62), ohne Ruf-Multiplikatoren -
 * aber nur bei Faktionen, deren Mitglied man ist und die Arbeit anbieten
 * (Actions.ts:652-664; Bladeburners nicht, FactionInfo.tsx:711-713). Die
 * Planung behandelt fehlenden Ruf solcher Faktionen deshalb als kaufbar und
 * meldet genau den Ruf, den die geplante Runde braucht.
 *
 * Gerechnet mit der echten Rundenwahl (rechnung/rundenplan.mjs, Stufen BN3.1
 * 17:10, Bladeburners-Ruf 60k): ohne Bestechung k 1,50 (10 Stuecke), mit
 * Bestechung der beigetretenen Faktionen k 2,17 (17 Stuecke, 8,1 Bio $ +
 * 6,7e14 $ Bestechung), mit The Syndicate / Speakers / Dark Army k 7,5
 * (28 Stuecke, 1,1e16 $ + 7e15 $ Bestechung).
 *
 * Rein: kein ns, keine Importe, keine Uhr - bn4rep.js reicht alles herein,
 * tests/test-corpgeld.js prueft jede Funktion einzeln. ACHTUNG RAM: tools/ram.js
 * zaehlt BEZEICHNER, nicht Aufrufe - kein Name dieser Datei darf wie eine
 * ns-Funktion heissen (Corp-Funktionen wie Bestechen oder Verkaufen heissen
 * deshalb hier deutsch).
 */

/** In welchen Knoten das Corp-Geld gilt (Koordinator 06.10.: "nicht BN3: alles wie heute"). */
export const CORP_MONEY_NODES = [3];

/** Telemetrie des Corp-Gewerks (src/corp.js TELEMETRY_PATH). */
export const CORP_TEL_FILE = "data/corp.json";

/** Die Anforderung an das Corp-Gewerk (verbindliche Schnittstelle 06.10.). */
export const CORP_REQ_FILE = "data/corp-geld.txt";

/** Wartezustand am Tor, ueberlebt einen Neustart von bn4rep.js. */
export const CORP_WAIT_FILE = "data/torrunde-corpwait.json";

/**
 * corp.js handelt nur auf eine Anforderung, die juenger als 20 min ist; dieselbe
 * Grenze gilt hier fuer seine Telemetrie: aelter heisst, es kommt kein Nachschub,
 * und am Tor wird nicht darauf gewartet.
 */
export const CORP_TEL_FRESH_MS = 20 * 60000;

/**
 * Budget des Bedarfsplans. Die Rundenwahl ist gierig nach log-Competence je
 * Dollar; mit unbegrenztem Budget nimmt sie alles mit Zuwachs > 0. Gerechnet:
 * das ganze Angebot inklusive Syndicate/Speakers/Dark Army/Covenant kostet
 * 1,1e16 bzw. 3,9e16 $ (Kette x1,9 eingerechnet) - 1e18 schneidet also nichts
 * Erreichbares ab, sondern nur einen Ausreisser (ein 1,9^40-Schwanz).
 */
export const CORP_PLAN_BUDGET = 1e18;

/** Faktionen, deren Ruf sich nicht kaufen laesst (keine Arbeit, Actions.ts:658-664). */
export const CORP_UNBUYABLE_REP = ["Bladeburners", "Church of the Machine God", "Shadows of Anarchy"];

/**
 * Warten am offenen Tor auf Geld und Bestechung der Corp, hoechstens so lange
 * AKTIVE Zeit (Wandzeit, in der bn4rep.js lief; Pausen ueber CORP_WAIT_GAP_MS
 * zaehlen nicht). Verkaeufe kommen stuendlich (Sperre 1 h, <= 10 % Anteile),
 * der Kurs steigt nach dem Boersengang um bis zu x6/h - vier Tranchen sind die
 * Obergrenze, die sich gegen einen spaeteren Einbau noch lohnt
 * (rechnung/einbauzeit.mjs: jede Stunde Einbauverzug kostet ~1 h Laufzeit).
 */
export const CORP_WAIT_MAX_MS = 4 * 3600000;

/** Ohne Fortschritt (Fehlbetrag faellt nicht um 10 %) so lange: dann wird gekauft. Eine Tranche je Stunde. */
export const CORP_WAIT_NOPROGRESS_MS = 90 * 60000;

/** Zwischen zwei Runden mehr als das: Pause (Ruhezustand, Neustart) - zaehlt nicht als Wartezeit. */
export const CORP_WAIT_GAP_MS = 10 * 60000;

/** Gewartet wird nur, wenn die volle Runde die Competence um mehr als 5 % ueber die jetzt kaufbare hebt. */
export const CORP_WAIT_MIN_GAIN = 1.05;

// v1 (Bericht 17:27) - wiederhergestellt nur als Rot-Referenz fuer die Skeptiker-Fixes.
export function corpSignal(tel, { knoten, nodeReset, nurKampfStuecke, nowMs }) {
  const off = (why, ageMs = null) => ({ active: false, fresh: false, why, ignitedAt: null, ageMs });
  if (nurKampfStuecke !== true) return off("kein V2-Kampfknoten");
  if (!CORP_MONEY_NODES.includes(Number(knoten))) return off("Knoten " + knoten + " ohne Corp-Geld");
  if (!tel || typeof tel !== "object" || Array.isArray(tel)) return off("data/corp.json fehlt oder ist unlesbar");
  if (!Number.isFinite(nodeReset) || tel.nodeReset !== nodeReset) return off("data/corp.json stammt aus einem anderen Knoten");
  const at = [tel.wall, tel.ts].find((x) => Number.isFinite(x));
  const ageMs = at === undefined ? null : nowMs - at;
  const fin = tel.finance && typeof tel.finance === "object" ? tel.finance : null;
  const ignitedAt = fin && Number.isFinite(fin.ignitedAt) ? fin.ignitedAt : null;
  if (ignitedAt === null && tel.public !== true) {
    return off("Corp noch nicht gezuendet (Bewertung " + (Number.isFinite(tel.valuation) ? tel.valuation.toExponential(2) : "?") + ")", ageMs);
  }
  const fresh = ageMs !== null && ageMs <= CORP_TEL_FRESH_MS && ageMs >= -60000;
  return {
    active: true, fresh, ignitedAt, ageMs,
    why: (ignitedAt !== null ? "Zuendung bei Corp-Stunde " + ignitedAt : "Corp ist an der Boerse")
      + (fresh ? "" : " - corp.json " + (ageMs === null ? "ohne Zeit" : Math.round(ageMs / 60000) + " min alt") + ", kein Nachschub erwartet"),
  };
}
export function corpPlanInput(eingabe, unbuyable = CORP_UNBUYABLE_REP) {
  const free = [];
  const paid = [];
  for (const k of Array.isArray(eingabe) ? eingabe : []) {
    if (!k) continue;
    if (k.rep >= k.repReq) free.push({ ...k, fehlt: 0 });
    else if (!unbuyable.includes(k.faktion) && Number.isFinite(k.repReq)) {
      paid.push({ ...k, rep: Infinity, fehlt: k.repReq - (Number(k.rep) || 0) });
    }
  }
  paid.sort((a, b) => a.fehlt - b.fehlt);
  return free.concat(paid);
}
export function corpRequest(plan, input, geld) {
  const out = { betrag: 0, bestechung: {}, ruf: 0 };
  if (!plan || !Array.isArray(plan.steps)) return out;
  const fehlt = new Map();
  for (const k of Array.isArray(input) ? input : []) {
    const key = k.aug + "|" + k.faktion;
    if (!fehlt.has(key)) fehlt.set(key, Number(k.fehlt) || 0);
  }
  for (const s of plan.steps) {
    const f = fehlt.get(s.aug + "|" + s.faktion) || 0;
    if (!(f > 0)) continue;
    const need = Math.ceil(f);
    if (!(out.bestechung[s.faktion] >= need)) out.bestechung[s.faktion] = need;
  }
  out.ruf = Object.values(out.bestechung).reduce((a, b) => a + b, 0);
  const cost = Number(plan.cost) || 0;
  out.betrag = Math.max(0, Math.ceil(cost - Math.max(0, Number(geld) || 0)));
  return out;
}
export function corpRequestText({ nowMs, nodeReset, augReset, betrag, bestechung }) {
  return JSON.stringify({
    v: 1, ts: nowMs, nodeReset, augReset,
    betrag: Math.max(0, Math.round(Number(betrag) || 0)),
    bestechung: bestechung && typeof bestechung === "object" ? bestechung : {},
    von: "bn4rep",
  });
}
export function corpWait(state, { nowMs, gateOpen, fresh, gainNow, gainFull, shortfall }) {
  const empty = { seit: null, aktivMs: 0, min: null, minSeit: null, zuletzt: null };
  if (!gateOpen) return { waits: false, state: empty, reason: "" };
  const s = state && typeof state === "object" ? { ...empty, ...state } : { ...empty };
  const gap = Number.isFinite(s.zuletzt) ? nowMs - s.zuletzt : null;
  const pause = gap !== null && gap > CORP_WAIT_GAP_MS;
  if (gap !== null && gap > 0 && !pause) s.aktivMs += gap;
  s.zuletzt = nowMs;
  if (s.seit === null) s.seit = nowMs;
  const full = Number(gainFull) || 1, now = Number(gainNow) || 1;
  if (!(full > now * CORP_WAIT_MIN_GAIN)) {
    return { waits: false, state: s, reason: "volle Runde x" + full.toFixed(2) + " kaum besser als kaufbar x" + now.toFixed(2) };
  }
  if (!fresh) return { waits: false, state: s, reason: "corp.json alt - kein Nachschub, die Runde wird gekauft" };
  const sf = Math.max(0, Number(shortfall) || 0);
  if (s.min === null || s.minSeit === null || pause || sf < s.min * 0.9) { s.min = sf; s.minSeit = nowMs; }
  if (s.aktivMs >= CORP_WAIT_MAX_MS) {
    return { waits: false, state: s, reason: "seit " + (s.aktivMs / 3600000).toFixed(1) + " h auf die Corp gewartet - die Runde wird gekauft" };
  }
  if (nowMs - s.minSeit >= CORP_WAIT_NOPROGRESS_MS) {
    return { waits: false, state: s, reason: "Fehlbetrag faellt seit " + Math.round((nowMs - s.minSeit) / 60000) + " min nicht - die Runde wird gekauft" };
  }
  return { waits: true, state: s, reason: "volle Runde x" + full.toFixed(2) + " statt x" + now.toFixed(2) + ", wartet auf Corp-Geld/Bestechung seit " + Math.round(s.aktivMs / 60000) + " min" };
}
export function readCorpWaitState(raw, nowMs, augReset) {
  if (!raw || typeof raw !== "object" || raw.augReset !== augReset) return null;
  const { seit, aktivMs, min, minSeit, zuletzt } = raw;
  const ok = (x) => x === null || (typeof x === "number" && Number.isFinite(x) && x >= 0);
  if (![seit, min, minSeit, zuletzt].every(ok) || !(Number.isFinite(aktivMs) && aktivMs >= 0)) return null;
  if (Number.isFinite(zuletzt) && zuletzt > nowMs + 60000) return null;
  return { seit, aktivMs, min, minSeit, zuletzt };
}
