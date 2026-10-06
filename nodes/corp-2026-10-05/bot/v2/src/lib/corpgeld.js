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
 * tests/test-corp-torrunde.js (Teil E) prueft jede Funktion einzeln. ACHTUNG RAM: tools/ram.js
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
 * Obergrenze des Bedarfsplans. Die Rundenwahl ist gierig nach log-Competence je
 * Dollar; das ganze Angebot inklusive Syndicate/Speakers/Dark Army/Covenant
 * kostet 1,1e16 bzw. 3,9e16 $ (rechnung/rundenplan.mjs). Das echte Budget ist
 * kleiner: corpBudget (Skeptiker E6, 06.10.) - Konto plus die Tranchen, die bis
 * zum Ende des Wartens am Tor realistisch kommen.
 */
export const CORP_PLAN_BUDGET = 1e18;

/**
 * Eine Tranche: corp.js verkauft je Verkauf hoechstens 10 % der eigenen Anteile
 * (maxPart), Sperre 1 h. Erloes je Anteil = Kurs; der Zielkurs ist
 * V x (0,5 + sqrt(Eigenanteil)) / Anteile (Corporation.ts:251-262), der echte Kurs
 * laeuft nach dem Boersengang hinterher (x6/h). Vorsichtig: nur der Sockel 0,5.
 */
export const CORP_TRANCHE_PART = 0.1;
export const CORP_TRANCHE_PRICE_FLOOR = 0.5;
/** Hoechstens so viele Tranchen gehen in das Budget (12 h Vorlauf + 4 h Warten). */
export const CORP_TRANCHES_MAX = 16;

/**
 * Die volle Runde wird erst so kurz vor dem Tor als Ruecklage gemeldet
 * (Skeptiker B1): vorher reicht die kaufbare Runde (wie bei der Gang), die
 * schon bestochenen Stuecke stecken darin.
 */
export const CORP_RESERVE_LEAD_MS = 3600000;

/**
 * So viel Konto bleibt im Corp-Modus IMMER frei (Skeptiker B1: "nie RAM-/Server-
 * kaeufe blockieren"). bn4net/homegrow/bn4life rechnen Konto minus
 * data/geldbedarf.txt; 500 Mrd decken mehrere Mietrechner je Runde. Der Abfluss
 * ist endlich (Rechnerpark, home-RAM, Programme), gegen Tranchen von 1e13 und mehr
 * klein.
 */
export const CORP_FREE_HEADROOM = 5e11;

/** Nach einer Pause (Ruhezustand) so lange auf frische corp.json warten, bevor "kein Nachschub" gilt. */
export const CORP_PAUSE_GRACE_MS = 10 * 60000;

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


/** corp.js besticht je Faktion hoechstens bribeShare 25 % der Kasse, erst ab Kasse 1e15 und Bewertung 1e14 (src/corp.js financeWork, Actions.ts:644). */
export const CORP_BRIBE_SHARE = 0.25;
export const CORP_BRIBE_MIN_FUNDS = 1e15;
export const CORP_BRIBE_MIN_VALUATION = 1e14;

/**
 * Liefert die Corp Geld?
 *
 * active (Kaufaufschub, Torrunde, Anforderung): die ZUENDUNG, wie corp.js sie
 * feststellt (finance.ignitedAt) oder der Boersengang (public), aus DIESEM
 * Knoten. Eine Tatsache: bleibt an, auch wenn corp.json alt wird - die Torrunde
 * ist auch ohne Nachschub nie schlechter als die alte Schleife (geldwert.md).
 *
 * deliverable (Skeptiker E3, 06.10.): kommt WIRKLICH Nachschub? Nur wenn
 * corp.json frisch ist (<= 20 min), corp.js nicht "blocked" meldet (state,
 * finance.blocked z. B. no_ipo_path) und die Corp verkaufen DARF (public oder
 * finance.phase "zuendbereit"; ignitedAt allein setzt corp.js auch ohne Runde 4).
 * Nur dann wartet das Tor und nur dann wird die volle Runde reserviert.
 *
 * bribeCap: wie viel fehlender Ruf je Faktion die Corp JETZT bestechen kann
 * (Skeptiker E6/S1): 25 % der Kasse / 1,02e9, 0 unter Kasse 1e15 oder Bewertung 1e14.
 * tranche: vorsichtiger Erloes eines Verkaufs (10 % der Anteile zum Sockelkurs).
 */
export function corpSignal(tel, { knoten, nodeReset, nurKampfStuecke, nowMs }) {
  const off = (why, ageMs = null) => ({ active: false, fresh: false, deliverable: false, why, ignitedAt: null, ageMs, bribeCap: 0, tranche: 0, blocked: "" });
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
  let blocked = "";
  if (tel.state === "blocked") blocked = "corp.js blockiert (" + String(tel.blockedReason || "?").slice(0, 40) + ")";
  else if (fin && fin.blocked) blocked = "corp.js: " + String(fin.blocked).slice(0, 40);
  else if (tel.public !== true && !(fin && fin.phase === "zuendbereit")) blocked = "Corp darf noch nicht verkaufen (Phase " + String(fin && fin.phase) + ")";
  const deliverable = fresh && !blocked;
  const funds = Number(tel.funds), val = Number(tel.valuation), owned = Number(tel.owned);
  const bribeCap = deliverable && funds >= CORP_BRIBE_MIN_FUNDS && val >= CORP_BRIBE_MIN_VALUATION
    ? Math.floor(CORP_BRIBE_SHARE * funds / 1.02e9) : 0;
  const tranche = deliverable && Number.isFinite(val) && owned > 0
    ? CORP_TRANCHE_PART * Math.min(1, owned) * val * CORP_TRANCHE_PRICE_FLOOR : 0;
  return {
    active: true, fresh, deliverable, ignitedAt, ageMs, bribeCap, tranche, blocked,
    why: (ignitedAt !== null ? "Zuendung bei Corp-Stunde " + ignitedAt : "Corp ist an der Boerse")
      + (!fresh ? " - corp.json " + (ageMs === null ? "ohne Zeit" : Math.round(ageMs / 60000) + " min alt") + ", kein Nachschub erwartet"
        : blocked ? " - " + blocked : ""),
  };
}

/**
 * Budget des Bedarfsplans (Skeptiker E6/S3): Konto plus die Tranchen, die bis
 * zum Ende des Wartens am Tor kommen koennen - je angefangene Stunde bis zum Tor
 * eine, dazu die Stunden Wartezeit, hoechstens CORP_TRANCHES_MAX. Ohne Lieferung
 * nur das Konto. So wird nur angefordert und bestochen, was bezahlbar wird.
 */
export function corpBudget({ geld, sig, msToGate, waitLeftMs }) {
  const g = Math.max(0, Number(geld) || 0);
  if (!sig || !sig.deliverable || !(sig.tranche > 0)) return g;
  const h = (ms) => (Number.isFinite(ms) && ms > 0 ? Math.ceil(ms / 3600000) : 0);
  const n = Math.max(1, Math.min(CORP_TRANCHES_MAX, (Number.isFinite(msToGate) ? h(msToGate) : CORP_TRANCHES_MAX) + h(waitLeftMs)));
  return Math.min(CORP_PLAN_BUDGET, g + n * sig.tranche);
}

/**
 * Kandidaten des Bedarfsplans. Eingabe wie waehleTorRunde ({aug, faktion, rep,
 * repReq, preis, prereq, mults}). Je Stueck:
 *   - genug Ruf: unveraendert, VORN (waehleTorRunde nimmt je Namen den ersten Eintrag)
 *   - Faktion mit Favor >= Spendenschwelle (donate.threshold, BN3: 75): SPENDE
 *     statt Bestechung (Skeptiker E4) - 1e6 $ je Ruf / faction_rep / FactionWorkRepGain
 *     (Faction/formulas/donation.ts:12-14) aus dem SPIELERGELD statt 1e9 $ aus der
 *     Corp-Kasse; rep = Infinity, spende = Geld, fehlt = Ruf
 *   - bestechliche Faktion und Fehlbetrag <= bribeCap: rep = Infinity, Weg "bestechung"
 *   - sonst (Bladeburners, Church, SoA; oder fuer die Corp-Kasse zu teuer): faellt weg
 * Je Name die billigere Variante zuerst (Spende vor Bestechung, kleinerer Fehlbetrag).
 *
 * @param {object[]} eingabe
 * @param {{bribeCap?:number, donate?:{threshold:number, favorOf:(f:string)=>number, geldFuerRep:(r:number)=>number}|null, unbuyable?:string[]}} [o]
 */
export function corpPlanInput(eingabe, o = {}) {
  const unbuyable = o.unbuyable || CORP_UNBUYABLE_REP;
  const cap = Number.isFinite(o.bribeCap) ? o.bribeCap : Infinity;
  const don = o.donate || null;
  const free = [];
  const paid = [];
  for (const k of Array.isArray(eingabe) ? eingabe : []) {
    if (!k) continue;
    if (k.rep >= k.repReq) { free.push({ ...k, fehlt: 0, weg: "frei" }); continue; }
    if (unbuyable.includes(k.faktion) || !Number.isFinite(k.repReq)) continue;
    const fehlt = k.repReq - (Number(k.rep) || 0);
    if (don && Number(don.favorOf(k.faktion)) >= don.threshold) {
      paid.push({ ...k, rep: Infinity, fehlt, weg: "spende", spende: don.geldFuerRep(fehlt), sortKey: 0 });
    } else if (fehlt <= cap) {
      paid.push({ ...k, rep: Infinity, fehlt, weg: "bestechung", sortKey: 1 });
    }
  }
  paid.sort((a, b) => a.sortKey - b.sortKey || a.fehlt - b.fehlt);
  return free.concat(paid);
}

/**
 * Die Anforderung aus dem Bedarfsplan.
 *   betrag      Spielergeld, das JETZT fehlt: Plankosten (Kette x1,9 in
 *               Kaufreihenfolge) + Spenden - Konto, nie negativ
 *   bestechung  je Faktion der hoechste fehlende Ruf unter den GEPLANTEN Stuecken
 *               (aufgerundet), nur Weg "bestechung"
 *   spende      je Faktion { ruf, geld } fuer den Weg "spende" (bn4rep spendet selbst)
 * fertig (Skeptiker E5): die Runde am Tor ist gekauft - bis zum Einbau nichts mehr
 * anfordern, sonst landen Tranchen und Ruf im Einbau und verfallen.
 */
export function corpRequest(plan, input, geld, fertig = false) {
  const out = { betrag: 0, bestechung: {}, spende: {}, ruf: 0, spendeGeld: 0 };
  if (fertig || !plan || !Array.isArray(plan.steps)) return out;
  const info = new Map();
  for (const k of Array.isArray(input) ? input : []) {
    const key = k.aug + "|" + k.faktion;
    if (!info.has(key)) info.set(key, k);
  }
  for (const s of plan.steps) {
    const k = info.get(s.aug + "|" + s.faktion);
    if (!k || !(k.fehlt > 0)) continue;
    const need = Math.ceil(k.fehlt);
    if (k.weg === "spende") {
      const e = out.spende[s.faktion];
      if (!e || e.ruf < need) out.spende[s.faktion] = { ruf: need, geld: Math.ceil(Number(k.spende) || 0) };
    } else if (!(out.bestechung[s.faktion] >= need)) out.bestechung[s.faktion] = need;
  }
  out.ruf = Object.values(out.bestechung).reduce((a, b) => a + b, 0);
  out.spendeGeld = Object.values(out.spende).reduce((a, e) => a + e.geld, 0);
  const cost = (Number(plan.cost) || 0) + out.spendeGeld;
  out.betrag = Math.max(0, Math.ceil(cost - Math.max(0, Number(geld) || 0)));
  return out;
}

/** Der Text fuer data/corp-geld.txt (verbindliche Schnittstelle 06.10.). */
export function corpRequestText({ nowMs, nodeReset, augReset, betrag, bestechung }) {
  return JSON.stringify({
    v: 1, ts: nowMs, nodeReset, augReset,
    betrag: Math.max(0, Math.round(Number(betrag) || 0)),
    bestechung: bestechung && typeof bestechung === "object" ? bestechung : {},
    von: "bn4rep",
  });
}

/**
 * Die Ruecklage in data/geldbedarf.txt im Corp-Modus (Skeptiker B1).
 * Grundsatz wie bei der Gang: die KAUFBARE Runde (planCost, <= Konto). Die
 * volle Runde (fullCost) nur, wenn die Corp liefert UND das Tor offen oder
 * hoechstens CORP_RESERVE_LEAD_MS entfernt ist und die Runde noch nicht gekauft
 * ist - und auch dann nie mehr als das Konto. Immer bleiben CORP_FREE_HEADROOM
 * frei (Rechner, home-RAM, Programme), soweit das Konto reicht.
 */
export function corpReserve({ planCost, fullCost, geld, deliverable, gateOpen, msToGate, fertig }) {
  const g = Math.max(0, Number(geld) || 0);
  let r = Math.max(0, Number(planCost) || 0);
  const near = gateOpen || (Number.isFinite(msToGate) && msToGate <= CORP_RESERVE_LEAD_MS);
  if (deliverable && near && !fertig) r = Math.max(r, Math.min(Number(fullCost) || 0, g));
  return Math.max(0, Math.min(r, g - CORP_FREE_HEADROOM));
}

/**
 * Hoechste Wartezeit am Tor in Abhaengigkeit vom Gewinn G = volle / kaufbare
 * Runde (Skeptiker S6): Warten lohnt bis w* ~ T_rest x (1 - G^-beta); mit
 * T_rest ~ 20 h, beta ~ 1,6 (geldwert.md) und Sicherheitsfaktor 0,5:
 * 10 h x (1 - G^-1,6), hoechstens CORP_WAIT_MAX_MS. G 1,05 -> 45 min, 1,25 -> 3 h.
 */
export function corpWaitLimitMs(gain) {
  const G = Number(gain);
  if (!(G > 1)) return 0;
  return Math.min(CORP_WAIT_MAX_MS, 10 * 3600000 * (1 - Math.pow(G, -1.6)));
}

/**
 * Wartet die offene Torrunde auf Geld/Bestechung der Corp?
 *
 * Gewartet wird, solange das Tor offen ist, die Corp liefert (deliverable),
 * die volle Runde > CORP_WAIT_MIN_GAIN x kaufbare bringt, Geld ODER Ruf binnen
 * CORP_WAIT_NOPROGRESS_MS um 10 % weniger fehlen (getrennt gemessen - Dollar und
 * Ruf sind nicht vergleichbar, Skeptiker 6) und die aktive Wartezeit unter
 * corpWaitLimitMs(G) liegt. fertig (Runde gekauft) heisst: nie mehr warten.
 *
 * WELCHE UHR. Wandzeit, aber nur die, in der bn4rep.js lief. Ein Abstand ueber
 * CORP_WAIT_GAP_MS (Ruhezustand, Rechner aus) zaehlt nicht, setzt die
 * Fortschrittsuhr neu und gibt CORP_PAUSE_GRACE_MS Karenz, in der eine alte
 * corp.json NICHT "kein Nachschub" heisst (Skeptiker 2: corp.js holt erst nach).
 * Ein geschlossenes Tor (Flackern) nullt die Uhr nicht (Skeptiker K7) - der
 * Zustand gilt je Einbau (augReset).
 */
export function corpWait(state, { nowMs, gateOpen, deliverable, gainNow, gainFull, betrag, ruf }) {
  const empty = { seit: null, aktivMs: 0, minB: null, minR: null, minSeit: null, zuletzt: null, pauseAt: null, fertig: false };
  const s = state && typeof state === "object" ? { ...empty, ...state } : { ...empty };
  if (s.fertig) return { waits: false, state: s, reason: "Runde gekauft - kein Warten bis zum Einbau" };
  if (!gateOpen) return { waits: false, state: { ...s, zuletzt: null }, reason: "" };
  const gap = Number.isFinite(s.zuletzt) ? nowMs - s.zuletzt : null;
  const pause = gap !== null && gap > CORP_WAIT_GAP_MS;
  if (gap !== null && gap > 0 && !pause) s.aktivMs += gap;
  s.zuletzt = nowMs;
  if (s.seit === null) s.seit = nowMs;
  if (pause) { s.pauseAt = nowMs; s.minB = null; s.minR = null; s.minSeit = null; }
  const full = Number(gainFull) || 1, now = Number(gainNow) || 1;
  const G = full / now;
  if (!(G > CORP_WAIT_MIN_GAIN)) {
    return { waits: false, state: s, reason: "volle Runde x" + full.toFixed(2) + " kaum besser als kaufbar x" + now.toFixed(2) };
  }
  const limit = corpWaitLimitMs(G);
  if (s.aktivMs >= limit) {
    return { waits: false, state: s, reason: "seit " + (s.aktivMs / 3600000).toFixed(1) + " h auf die Corp gewartet (Grenze " + (limit / 3600000).toFixed(1) + " h bei Gewinn x" + G.toFixed(2) + ") - die Runde wird gekauft" };
  }
  if (!deliverable) {
    if (Number.isFinite(s.pauseAt) && nowMs - s.pauseAt < CORP_PAUSE_GRACE_MS) {
      return { waits: true, state: s, reason: "nach einer Pause: wartet bis 10 min auf frische corp.json" };
    }
    return { waits: false, state: s, reason: "Corp liefert nicht (alt oder blockiert) - die Runde wird gekauft" };
  }
  const b = Math.max(0, Number(betrag) || 0), r = Math.max(0, Number(ruf) || 0);
  if (s.minSeit === null || s.minB === null || s.minR === null || b < s.minB * 0.9 || r < s.minR * 0.9) {
    s.minB = s.minB === null ? b : Math.min(s.minB, b);
    s.minR = s.minR === null ? r : Math.min(s.minR, r);
    s.minSeit = nowMs;
  }
  if (nowMs - s.minSeit >= CORP_WAIT_NOPROGRESS_MS) {
    return { waits: false, state: s, reason: "Fehlbetrag faellt seit " + Math.round((nowMs - s.minSeit) / 60000) + " min nicht - die Runde wird gekauft" };
  }
  return {
    waits: true, state: s,
    reason: "volle Runde x" + full.toFixed(2) + " statt x" + now.toFixed(2) + ", wartet auf Corp-Geld/Bestechung seit "
      + Math.round(s.aktivMs / 60000) + " min (Grenze " + Math.round(limit / 60000) + " min)",
  };
}

/** Wartezustand aus data/torrunde-corpwait.json; nur fuer denselben Einbau (augReset), sonst null. */
export function readCorpWaitState(raw, nowMs, augReset) {
  if (!raw || typeof raw !== "object" || raw.augReset !== augReset) return null;
  const ok = (x) => x === null || x === undefined || (typeof x === "number" && Number.isFinite(x) && x >= 0);
  const { seit, aktivMs, minB, minR, minSeit, zuletzt, pauseAt } = raw;
  if (![seit, minB, minR, minSeit, zuletzt, pauseAt].every(ok) || !(Number.isFinite(aktivMs) && aktivMs >= 0)) return null;
  if (Number.isFinite(zuletzt) && zuletzt > nowMs + 60000) return null;
  return { seit: seit ?? null, aktivMs, minB: minB ?? null, minR: minR ?? null, minSeit: minSeit ?? null, zuletzt: zuletzt ?? null, pauseAt: pauseAt ?? null, fertig: raw.fertig === true };
}
