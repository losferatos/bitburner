/**
 * Die Strafleiter: Signale, Zustandsautomat, Sprossen.
 *
 * ===========================================================================
 * DER WAECHTER IRRT IN RICHTUNG UNTAETIGKEIT
 * ===========================================================================
 *
 * Das ist der Satz, an dem sich jede Entscheidung hier ausrichtet
 * (ARCHITEKTUR 5.4 woertlich). Eine Fehlstrafe kostet mehr als ein verpasster
 * Haenger: ein Haenger wird beim naechsten Durchgang erkannt, eine Fehlstrafe
 * toetet ein gesundes Werkzeug und erzeugt genau den Zustand, den sie heilen
 * sollte.
 *
 * Praktisch heisst das: jedes Signal braucht seine Karenz, jede Sprosse ihre
 * Wirkungspruefung, und jeder Verdacht wird geschrieben - auch der, der zu
 * nichts fuehrt.
 *
 * ===========================================================================
 * BEOBACHTUNGSMODUS
 * ===========================================================================
 *
 * Im Modus "observe" laeuft der ganze Automat, aber keine Sprosse wird
 * ausgefuehrt: die Eintraege in `penalties.json` tragen `result:
 * "would-execute"`. Das ist Position C.6 und ausdruecklich der erste Schritt -
 * ein Waechter, der zuerst zuschlaegt, kostet im schlechtesten Fall einen
 * ganzen Lauf, und die Abnahme verlangt `false_penalty_count = 0`, eine Zahl,
 * die nur VOR dem Scharfstellen guenstig zu bekommen ist.
 */

export const LEITER_VERSION = 1;

/** Die Zustaende des Automaten (ARCHITEKTUR 5.2). */
export const ZUSTAENDE = ["HEALTHY", "SUSPECT", "EXECUTED", "VERIFY",
  "NOT_EXECUTABLE", "EXHAUSTED"];

/**
 * Die Sprossen. `wirkung` sagt, woran der Erfolg gemessen wird, `uhr`, in
 * welcher Zeit die Fristen dieser Sprosse laufen.
 *
 * Sprosse 4a steht mit `gebaut: false` drin: sie wird laut Architektur NUR
 * gebaut, wenn ein Prüfstandslauf zeigt, dass ein skriptausgeloester Reload
 * keinen beforeunload-Dialog stehen laesst. Ohne diesen Beleg endet die Leiter
 * bei 3. Das als Datenfeld zu fuehren statt als Kommentar heisst: der Code
 * kann es pruefen.
 */
export const SPROSSEN = [
  { nr: 0, name: "Umgebung", uhr: "guard", gebaut: true, strafe: false,
    ausloeser: ["S4", "S5"], karenzMs: 60000, wirkungMs: 180000,
    deckelJe6h: null, wirkung: "Umgebung wieder in Ordnung" },
  { nr: 1, name: "Werkzeug neu starten", uhr: "guard", gebaut: true, strafe: true,
    ausloeser: ["S1"], karenzMs: 120000, wirkungMs: 180000,
    deckelJe6h: 6, wirkung: "Telemetrie wird wieder frisch" },
  { nr: 2, name: "Anderer Wirt", uhr: "guard", gebaut: true, strafe: true,
    ausloeser: ["S1"], karenzMs: 300000, wirkungMs: 300000,
    deckelJe6h: 6, wirkung: "Werkzeug laeuft auf einem anderen Wirt" },
  { nr: 3, name: "Alles killen, boot.js", uhr: "guard", gebaut: true, strafe: true,
    ausloeser: ["S3a", "S6"], karenzMs: 600000, wirkungMs: 600000,
    deckelJe6h: 2, wirkung: "round waechst UND errStreak == 0" },
  { nr: 4, name: "Reload von innen", uhr: "engine", gebaut: false, strafe: true,
    ausloeser: ["S3b"], karenzMs: 300000, wirkungMs: 180000,
    deckelJe6h: 1, wirkung: "Engine-Puls > 0,9 ueber 3 min",
    bedingung: "nur nach Pruefstandsbeleg, dass kein beforeunload-Dialog stehen bleibt" },
  { nr: 5, name: "Soft-Reset durch Einbau", uhr: "motor", gebaut: false, strafe: true,
    ausloeser: ["S2"], karenzMs: 6 * 3600000, wirkungMs: 600000,
    deckelJe6h: null, wirkung: "lastAugReset gesprungen und Konto > 0" },
];

/** Ein frischer Leiterzustand. */
export function neu(nodeReset = null) {
  return {
    version: LEITER_VERSION,
    nodeReset,
    /** Je Ziel (Werkzeugname oder "kern"): {zustand, sprosse, seit, versuche} */
    ziele: {},
    /** Ausgefuehrte Sprossen mit Zeitstempel - fuer die Deckel. */
    verlauf: [],
    /** Wirte, die fuer ein Ziel gesperrt sind: {ziel: {host: bisWall}} */
    blockedHosts: {},
    exhausted: null,
  };
}

/**
 * Wertet die Signale aus. ALLE Eingaben kommen von aussen - diese Funktion
 * liest nichts und rechnet nichts nach, damit sie ohne Spiel testbar ist.
 *
 * @param {object} e Eingaben
 * @param {Array}  e.eintraege Registry-Auswahl mit {name, freshnessMs, telemetrie}
 * @param {object} e.kern Telemetrie des Kerns (data/bn4net.json)
 * @param {number} e.motorTimeMs vom Kern veroeffentlicht
 * @param {number} e.guardTimeMs eigene Uhr
 * @param {number} e.wall Date.now()
 * @param {number|null} e.puls Engine-Puls oder null
 * @param {object|null} e.kpi data/kpi.json
 * @param {boolean} e.sichtbar visibilityState === "visible"
 * @param {object|null} e.bridge data/bridge.json
 * @returns {Array} [{sig, ziel, grund, schwere}]
 */
export function signale(e) {
  const s = [];

  // --- S1: ein Werkzeug meldet sich nicht mehr ------------------------------
  //
  // DIE UHR RICHTET SICH NACH DEM SCHREIBER (04.09.2026, Skeptiker Fehlermodi).
  //
  // Hier stand fest `e.motorTimeMs - t.telemetrie.motorTimeMs`. Motorzeit
  // schreibt aber NUR der Kern: shop.js und figwatch.js tragen dort eine
  // ehrliche 0 ein, und die zwoelf gewachsenen Werkzeuge kennen das Feld gar
  // nicht. Mit `?? 0` wurde daraus "die gesamte Motorzeit dieses Knotens" -
  // also immer mehr als jede Frist. S1 haette fuer JEDES Werkzeug dauerhaft
  // gefeuert, vom ersten Moment an.
  //
  // Deshalb drei Uhren, in dieser Reihenfolge:
  //   1. Motorzeit, wenn das Werkzeug sie WIRKLICH fuehrt (> 0).
  //   2. Enginezeit (`playtime`) - die schreibt jeder Herzschlag v2, und sie
  //      steht bei gedrosseltem Tab genauso still wie das Spiel selbst.
  //   3. Wanduhr, nur als letzter Ausweg fuer die alten Werkzeuge - und dann
  //      NUR bei sichtbarem Tab. Im verdeckten Tab laeuft sie weiter,
  //      waehrend das Spiel auf einen Zeitgeber je Minute gedrosselt ist;
  //      eine Frist in dieser Uhr waere dort reine Fehlmeldung.
  for (const t of e.eintraege || []) {
    if (!t.telemetrie) continue;
    if (t.telemetrie.state === "wait") continue;      // wartet, arbeitet nicht
    if (t.telemetrie.state === "done") continue;
    if (t.telemetrie.state === "blocked") continue;   // kann nicht, nicht: tut nicht

    const frist = t.freshnessMs ?? 600000;
    const tm = t.telemetrie;
    let alter = null;
    let uhr = null;

    if (Number.isFinite(tm.motorTimeMs) && tm.motorTimeMs > 0
        && Number.isFinite(e.motorTimeMs)) {
      alter = e.motorTimeMs - tm.motorTimeMs; uhr = "Motorzeit";
    } else if (Number.isFinite(tm.playtime) && tm.playtime > 0
        && Number.isFinite(e.playtime)) {
      alter = e.playtime - tm.playtime; uhr = "Enginezeit";
    } else if (e.sichtbar !== false) {
      // `zeit` ist die Schreibweise der alten Werkzeuge, `ts`/`wall` die des
      // Herzschlags v2.
      const w = [tm.ts, tm.wall, tm.zeit].find((x) => Number.isFinite(x));
      if (Number.isFinite(w) && Number.isFinite(e.wall)) {
        alter = e.wall - w; uhr = "Wanduhr";
      }
    }

    if (alter === null || !Number.isFinite(alter)) continue;
    // Eine negative Differenz heisst: die Telemetrie ist NEUER als die
    // Referenzuhr des Waechters. Das ist kein Haenger, sondern ein Vorlauf.
    if (alter < 0) continue;
    if (alter > frist) {
      s.push({ sig: "S1", ziel: t.name, schwere: 1,
        grund: "Telemetrie " + Math.round(alter / 60000) + " min " + uhr + " alt" });
    }
  }

  // --- S3a: der Kern selbst haengt ------------------------------------------
  //
  // In GUARD-Zeit. Eine Frist in Motorzeit liefe hier nie ab: haengt der Kern,
  // steht seine Uhr.
  if (e.kern && Number.isFinite(e.kern.wall)) {
    const alter = e.wall - e.kern.wall;
    if (alter > 600000) {
      s.push({ sig: "S3a", ziel: "kern", schwere: 3,
        grund: "Kern-Herzschlag " + Math.round(alter / 60000) + " min alt" });
    }
  }

  // --- S3b: die Engine tickt nicht mehr -------------------------------------
  if (e.puls !== null && Number.isFinite(e.puls) && e.puls < 0.2) {
    s.push({ sig: "S3b", ziel: "engine", schwere: 4,
      grund: "Engine-Puls " + e.puls.toFixed(2) + " unter 0,2" });
  }

  // --- S6: der Kern wirft in jeder Runde ------------------------------------
  //
  // Ein BESTAND, keine Rate - deshalb keine Uhr. Das ist der Fall, den `round`
  // allein nicht sieht: der Motor zaehlt weiter und sieht frisch aus.
  if (e.kern && Number.isFinite(e.kern.errStreak) && e.kern.errStreak >= 5) {
    s.push({ sig: "S6", ziel: "kern", schwere: 3,
      grund: e.kern.errStreak + " Ausnahmen in Folge" });
  }

  // --- S4: der Tab ist verdeckt ---------------------------------------------
  //
  // SCHALTET NICHTS AB. S4 laesst ruhen, was von der Wanduhr abhaengt, und
  // verlaengert Wirkungspruefungen. Alle Fristen laufen in Eigenzeit weiter -
  // sonst waere "Sprossen >= 2: null" in Stufe B trivial erfuellt.
  if (e.sichtbar === false) {
    s.push({ sig: "S4", ziel: "umgebung", schwere: 0,
      grund: "Tab verdeckt - Wanduhr-Fristen ruhen" });
  }

  // --- S5: die Bruecke meldet etwas -----------------------------------------
  if (e.bridge && e.bridge.problem) {
    s.push({ sig: "S5", ziel: "umgebung", schwere: 0,
      grund: String(e.bridge.problem).slice(0, 120) });
  }

  // --- S2: kein Fortschritt -------------------------------------------------
  //
  // Der Traeger wird GELESEN, nie gerechnet: ihn selbst zu ermitteln kostete
  // allein fuer getRank 4 GB und spraengte den 8-GB-Deckel des Waechters.
  // Erwuenschte Nebenwirkung: haengt der Kern, laeuft S2 nicht mehr - und
  // genau dann greifen S3a und S6, die den Kern meinen.
  if (e.kpi && e.kpi.traeger && Number.isFinite(e.kpi.traeger.wert)) {
    const t = e.kpi.traeger;
    // Stumm bei fertiger Route und bei ungeeichtem Bestwert (ARCHITEKTUR 5.1).
    const stumm = (e.kpi.route_state && e.kpi.route_state !== "open")
      || e.kpi.bestwertStatus === "ungeeicht";
    if (!stumm && Number.isFinite(e.letzterTraegerWert)
        && Number.isFinite(e.letzterTraegerMotorMs)) {
      const dMotor = e.motorTimeMs - e.letzterTraegerMotorMs;
      if (dMotor >= 45 * 60000 && t.wert <= e.letzterTraegerWert) {
        s.push({ sig: "S2", ziel: "fortschritt", schwere: 2,
          grund: "Traeger '" + t.name + "' seit " + Math.round(dMotor / 60000) +
            " min Motorzeit nicht gewachsen" });
      }
    }
  }

  return s;
}

/**
 * Welche Sprosse gehoert zu einem Signal?
 * Gibt null, wenn keine gebaute Sprosse zustaendig ist.
 */
export function sprosseFuer(sig) {
  const s = SPROSSEN.find((x) => x.ausloeser.includes(sig) && x.gebaut);
  return s || null;
}

/**
 * Der Zustandsautomat. Er entscheidet, ob eine Sprosse FAELLIG ist - ausgefuehrt
 * wird sie vom Aufrufer, und im Beobachtungsmodus gar nicht.
 *
 * @returns {{handlung: string, sprosse: object|null, ziel: string, grund: string}}
 */
export function schritt(z, sig, jetztGuardMs, jetztWall) {
  // ZUSTANDSSIGNALE SPEISEN DIE LEITER NICHT (04.09.2026, Skeptiker Fehlermodi).
  //
  // S4 (Tab verdeckt) und S5 (die Bruecke meldet etwas) beschreiben die
  // UMGEBUNG, nicht eine Stoerung des Bots. Sie tragen `schwere: 0` und ein
  // Ziel "umgebung", fuer das es keine Handlung gibt: kein Neustart, kein
  // Kill, nichts, was ein verdecktes Browserfenster wieder sichtbar macht.
  //
  // Liefen sie trotzdem durch den Automaten, waere die Kette zwangslaeufig:
  // HEALTHY -> SUSPECT -> ausfuehren (es gibt nichts auszufuehren) -> VERIFY
  // -> die Wirkungspruefung kann nie gruen werden -> EXHAUSTED. Und
  // EXHAUSTED ist eine Sackgasse: danach nimmt die Leiter fuer dieses Ziel
  // gar nichts mehr an. Ein verdecktes Fenster - der Normalfall im
  // Nachtlauf - haette den Waechter also nach einer Stunde stillgelegt.
  //
  // Sie werden weiterhin ERZEUGT und protokolliert; sie sind Kontext fuer den
  // Bericht und fuer die Fristenverlaengerung, aber kein Anlass zu handeln.
  if (sig.schwere === 0) {
    return { handlung: "nichts", sprosse: null, ziel: sig.ziel,
      grund: "Zustandssignal (" + sig.sig + "), keine Handlung: " + sig.grund };
  }

  const ziel = sig.ziel;
  if (!z.ziele[ziel]) {
    z.ziele[ziel] = { zustand: "HEALTHY", sprosse: 0, seit: jetztGuardMs, versuche: 0 };
  }
  const s = z.ziele[ziel];

  // EXHAUSTED ist eine Sackgasse mit Ausgang: keine weitere Sprosse, aber der
  // Kern laeuft unveraendert weiter. Er endet erst, wenn Fortschritt messbar
  // ist oder ein Reset passiert.
  if (s.zustand === "EXHAUSTED") {
    return { handlung: "nichts", sprosse: null, ziel,
      grund: "erschoepft seit " + Math.round((jetztGuardMs - s.seit) / 60000) + " min" };
  }

  // WELCHE SPROSSE IST DRAN? (Skeptiker Fehlermodi, 04.09.2026)
  //
  // Hier stand nur `sprosseFuer(sig.sig)` - und das liefert fuer S1 IMMER
  // Sprosse 1. `verifiziert` zaehlt `s.sprosse` zwar brav auf 2 und 3 hoch,
  // aber niemand las den Wert: die naechste Runde begann wieder bei 1, die
  // Wirkungspruefung scheiterte wieder, und nach drei Durchlaeufen fand
  // `verifiziert` keine hoehere gebaute Sprosse mehr und setzte EXHAUSTED.
  //
  // Gemessen im Trockenlauf: Sprosse 1 bei 2, 7 und 12 Minuten, dann
  // EXHAUSTED nach 15 Minuten Guard-Zeit. Sprosse 2 feuerte NIE - und damit
  // war die ganze C.9-Maschinerie tot: die Wirtsperren, `blocked-hosts.json`
  // und der Ausweichzweig im Kern.
  //
  // Richtig ist: `sprosseFuer` bestimmt den EINSTIEG, der Zustand die
  // Fortsetzung. Ein Ziel, das schon auf Sprosse 2 steht, faellt nicht auf 1
  // zurueck, nur weil dasselbe Signal noch einmal kommt.
  const einstieg = sprosseFuer(sig.sig);
  const kandidat = (s.sprosse > 0 && s.zustand !== "HEALTHY")
    ? (SPROSSEN.find((x) => x.nr === s.sprosse && x.gebaut) || einstieg)
    : einstieg;
  if (!kandidat) {
    return { handlung: "nichts", sprosse: null, ziel,
      grund: "keine gebaute Sprosse fuer " + sig.sig };
  }

  if (s.zustand === "HEALTHY") {
    s.zustand = "SUSPECT";
    s.sprosse = kandidat.nr;
    s.seit = jetztGuardMs;
    return { handlung: "verdacht", sprosse: kandidat, ziel,
      grund: sig.grund + " - Karenz " + Math.round(kandidat.karenzMs / 60000) + " min" };
  }

  if (s.zustand === "SUSPECT") {
    const wartet = jetztGuardMs - s.seit;
    if (wartet < kandidat.karenzMs) {
      return { handlung: "wartet", sprosse: kandidat, ziel,
        grund: "noch " + Math.round((kandidat.karenzMs - wartet) / 1000) + " s Karenz" };
    }
    // Deckel pruefen, BEVOR ausgefuehrt wird.
    if (kandidat.deckelJe6h !== null) {
      const seit6h = jetztWall - 6 * 3600000;
      const zahl = z.verlauf.filter((v) => v.ziel === ziel && v.sprosse === kandidat.nr
        && v.wall >= seit6h).length;
      if (zahl >= kandidat.deckelJe6h) {
        return { handlung: "deckel", sprosse: kandidat, ziel,
          grund: "Deckel erreicht: " + zahl + " von " + kandidat.deckelJe6h + " in 6 h" };
      }
    }
    s.zustand = "EXECUTED";
    s.seit = jetztGuardMs;
    s.versuche++;
    return { handlung: "ausfuehren", sprosse: kandidat, ziel, grund: sig.grund };
  }

  if (s.zustand === "EXECUTED") {
    const wartet = jetztGuardMs - s.seit;
    if (wartet < kandidat.wirkungMs) {
      return { handlung: "wartet", sprosse: kandidat, ziel,
        grund: "Wirkung wird geprueft in " + Math.round((kandidat.wirkungMs - wartet) / 1000) + " s" };
    }
    s.zustand = "VERIFY";
    return { handlung: "pruefen", sprosse: kandidat, ziel, grund: kandidat.wirkung };
  }

  return { handlung: "nichts", sprosse: kandidat, ziel, grund: "Zustand " + s.zustand };
}

/**
 * Ergebnis der Wirkungspruefung einarbeiten.
 *
 * Gruen setzt den Zaehler des ZIELS zurueck, nicht den globalen - ein
 * geheiltes Werkzeug soll nicht die Vorgeschichte eines anderen erben.
 */
/**
 * Ein erschoepftes Ziel wieder freigeben.
 *
 * DER AUSGANG AUS DER SACKGASSE (Skeptiker Fehlermodi, 04.09.2026). Der
 * Kommentar bei EXHAUSTED versprach ihn ("endet erst, wenn Fortschritt
 * messbar ist oder ein Reset passiert") - im Code gab es ihn nicht. Nur ein
 * Knotenwechsel setzte zurueck, ueber `laden()`.
 *
 * Das ist der Unterschied zwischen "der Waechter hoert auf zu strafen" und
 * "der Waechter ist bis zum naechsten BitNode abgeschaltet". Der Auftrag meint
 * das erste.
 *
 * @param {object} z
 * @param {string} ziel     null = alle Ziele
 * @param {number} jetztGuardMs
 * @returns {string[]} die freigegebenen Ziele
 */
export function freigeben(z, ziel, jetztGuardMs) {
  const raus = [];
  for (const [name, s] of Object.entries(z.ziele || {})) {
    if (ziel !== null && name !== ziel) continue;
    if (s.zustand !== "EXHAUSTED") continue;
    s.zustand = "HEALTHY";
    s.sprosse = 0;
    s.versuche = 0;
    s.seit = jetztGuardMs;
    raus.push(name);
  }
  if (raus.length && z.exhausted
      && (ziel === null || z.exhausted.signal === ziel)) {
    z.exhausted = null;
  }
  return raus;
}

export function verifiziert(z, ziel, gruen, jetztGuardMs) {
  const s = z.ziele[ziel];
  if (!s) return { zustand: "HEALTHY", eskaliert: false };

  if (gruen) {
    s.zustand = "HEALTHY";
    s.sprosse = 0;
    s.versuche = 0;
    s.seit = jetztGuardMs;
    return { zustand: "HEALTHY", eskaliert: false };
  }

  const naechste = SPROSSEN.find((x) => x.nr > s.sprosse && x.gebaut);
  if (!naechste) {
    s.zustand = "EXHAUSTED";
    s.seit = jetztGuardMs;
    z.exhausted = { since: jetztGuardMs, lastRung: s.sprosse, signal: ziel };
    return { zustand: "EXHAUSTED", eskaliert: false };
  }
  s.zustand = "SUSPECT";
  s.sprosse = naechste.nr;
  s.seit = jetztGuardMs;
  return { zustand: "SUSPECT", eskaliert: true, sprosse: naechste.nr };
}

/**
 * Haengt einen Eintrag an `penalties.json` an - auch im Beobachtungsmodus.
 *
 * DER RINGPUFFER IST 200 GROSS und die Datei steht in keiner Raeumliste
 * (ARCHITEKTUR 5.4). Beides ist Absicht: sie ist der einzige Beleg dafuer, was
 * der Waechter getan HAETTE, und genau daran misst die Abnahme
 * `false_penalty_count`.
 */
export function protokolliere(p, eintrag) {
  if (!p.eintraege) p.eintraege = [];
  p.eintraege.push(eintrag);
  while (p.eintraege.length > 200) p.eintraege.shift();
  return p;
}

/** Zaehlt, was der Waechter im Beobachtungsmodus getan haette. */
export function zaehleWuerde(p) {
  const e = (p && p.eintraege) || [];
  const n = { gesamt: e.length, wuerde: 0, ausgefuehrt: 0, jeSprosse: {} };
  for (const x of e) {
    if (x.result === "would-execute") n.wuerde++;
    else if (x.result === "executed") n.ausgefuehrt++;
    n.jeSprosse[x.rung] = (n.jeSprosse[x.rung] || 0) + 1;
  }
  return n;
}

/** Laedt den Leiterzustand. Passt der Lauf nicht, faengt er bei null an. */
export function laden(roh, nodeReset = null) {
  if (!roh) return neu(nodeReset);
  let z;
  try {
    z = typeof roh === "string" ? JSON.parse(roh) : roh;
  } catch {
    return neu(nodeReset);
  }
  if (!z || typeof z !== "object") return neu(nodeReset);
  // Ohne diese Pruefung traegt eine Sprossenzaehlung aus dem vorigen Knoten in
  // den neuen hinein - und restartPolicy "always" sorgt dafuer, dass der
  // Waechter oft genug neu startet, damit das auffaellt.
  if (nodeReset !== null && Number.isFinite(z.nodeReset) && z.nodeReset !== nodeReset) {
    return neu(nodeReset);
  }
  const frisch = neu(nodeReset);
  return { ...frisch, ...z, version: LEITER_VERSION,
    nodeReset: nodeReset !== null ? nodeReset : z.nodeReset };
}
