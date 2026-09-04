/**
 * archiv/entwurf/join/join.js — Faktionsbeitritt ohne menschlichen Klick.
 *
 * ============================================================================
 * WARUM DAS GEHT
 * ============================================================================
 *
 * Der Join!-Knopf verwirft synthetische Klicks (FactionsRoot.tsx:88-94,
 * hier gekuerzt wiedergegeben):
 *
 *     function acceptInvitation(event, factionName) {
 *       if (!event.isTrusted || !Factions[factionName].alreadyInvited
 *           || Factions[factionName].isBanned) return;
 *       joinFaction(Factions[factionName]);
 *       props.rerender();
 *     }
 *
 * `isTrusted` laesst sich nicht faelschen — es ist per DOM-Spezifikation
 * [LegacyUnforgeable], also eine nicht konfigurierbare EIGENE Eigenschaft
 * jeder Ereignisinstanz. Das ist live geprueft und bleibt so.
 *
 * ABER: Der Knopf ruft nicht das Ereignis auf, sondern der Browser ruft den
 * Handler MIT einem Ereignis auf. Und dieser Handler liegt offen im DOM:
 *
 *   1. MUI leitet `onClick` UNVERAENDERT an das echte <button>-Element durch
 *      (@mui/material 5.18.0, ButtonBase.js: die Wurzel ist
 *      `styled("button")` und bekommt woertlich `onClick: onClick` — anders
 *      als onBlur/onFocus/onMouseDown, die durch useEventCallback laufen).
 *   2. React 17 (package.json:42) legt die Props eines Host-Elements als
 *      gewoehnliche, aufzaehlbare Eigenschaft auf dem DOM-Knoten ab:
 *      `node["__reactProps$<zufall>"] = props`
 *      (react-dom 17.0.2, ReactDOMComponentTree.js, `updateFiberProps` —
 *      aufgerufen bei createInstance UND bei jedem commitUpdate, der Wert
 *      ist also nie veraltet).
 *   3. `acceptInvitation` liest aus dem Ereignis AUSSCHLIESSLICH `isTrusted`.
 *
 * Also: Props vom Knopf holen, `onClick` mit einem selbstgebauten Objekt
 * `{ isTrusted: true, ... }` aufrufen. Damit laeuft exakt derselbe Pfad wie
 * bei einem echten Klick — dieselbe Funktion `joinFaction(Factions[name])`
 * (FactionHelpers.tsx:35), dieselbe Neuzeichnung. Es wird nichts am
 * Spielstand vorbeigeschrieben und nichts nachtraeglich gepatcht.
 *
 * ============================================================================
 * WAS DIESE DATEI NICHT MACHT
 * ============================================================================
 *
 * - Sie glaubt keinem Bildschirmtext. Der Erfolg wird ausschliesslich am
 *   Spielerzustand geprueft (`ns.getPlayer().factions`, Kopie von
 *   `Player.factions` — NetscriptFunctions.ts:1431). Genau dieses Feld wird
 *   beim Speichern mitgeschrieben: `SaveObject.ts:209` legt den ganzen
 *   Spieler als `PlayerSave = JSON.stringify(Player)` ab.
 * - Sie schreibt nichts in den Spielstand und laedt nichts neu.
 *
 * ============================================================================
 * EINBAU IN src/hand.js
 * ============================================================================
 *
 *   import { joinFaction } from "join.js";   // ganz oben, Netscript loest
 *                                            // Importe beim Uebersetzen auf
 *
 *   if (/^!join\s+/i.test(b)) {
 *     const faction = b.replace(/^!join\s+/i, "").trim();
 *     const res = await joinFaction({
 *       doc,
 *       factionName: faction,
 *       sleep: (ms) => ns.sleep(ms),
 *       isMember: () => ns.getPlayer().factions.includes(faction),
 *       allowUnfocus: true,
 *       returnToTerminal: true,
 *     });
 *     protokoll.push("> !join " + faction + ": " + (res.ok ? "BEIGETRETEN" : "gescheitert: " + res.reason));
 *     for (const z of res.log) protokoll.push("  " + z);
 *     continue;
 *   }
 *
 * Der Faktionsname muss EXAKT der Spielname sein ("Tian Di Hui", nicht
 * "TianDiHui"). Bei einem Tippfehler klickt der Code nichts, meldet aber
 * sauber, welche Einladungen die Seite tatsaechlich zeigt.
 *
 * Diese Datei kostet keinen zusaetzlichen Netscript-Speicher: der Bezeichner
 * `document` kommt hier nicht vor (das Dokument wird als Parameter `doc`
 * hereingereicht), und der RAM-Rechner des Spiels bucht rein namensbasiert
 * (RamCalculations.ts:185-192).
 */

/** Genaue Beschriftung des geschuetzten Knopfes auf der Faktionsseite. */
const PAGE_JOIN_LABEL = "Join!";
/** Beschriftung im Einladungsfenster — OHNE Ausrufezeichen. */
const MODAL_JOIN_LABEL = "Join";

/**
 * Liefert die React-Props, die an diesen DOM-Knoten uebergeben wurden.
 * React 17 legt sie als gewoehnliche, aufzaehlbare Eigenschaft ab, deren Name
 * mit "__reactProps$" beginnt; der Rest ist ein je Seitenladung neuer
 * Zufallsschluessel, deshalb wird er gesucht statt fest verdrahtet.
 */
function reactProps(node) {
  if (!node) return null;
  const key = Object.keys(node).find((k) => k.startsWith("__reactProps$"));
  return key ? node[key] : null;
}

/** Der Fiber-Knoten zu einem DOM-Element (React 17: "__reactFiber$..."). */
function reactFiber(node) {
  if (!node) return null;
  const key = Object.keys(node).find((k) => k.startsWith("__reactFiber$"));
  return key ? node[key] : null;
}

/**
 * Sammelt alle unterschiedlichen onClick-Handler, die an diesem Knopf oder an
 * einem seiner Vorfahren im Fiber-Baum haengen.
 *
 * Der direkte Weg ueber `reactProps(btn).onClick` reicht bei MUI 5.18.0 aus.
 * Diese Sammlung ist die Rueckfallebene fuer den Fall, dass eine spaetere
 * MUI-Fassung den Handler doch einpackt — in ButtonBase.js laufen mehrere
 * andere Handler bereits durch `useEventCallback`, `onClick` ist dort heute
 * die Ausnahme. Packt MUI ihn eines Tages ein, sitzt der echte Handler weiter
 * oben, naemlich an dem <Button>-Element aus FactionsRoot. Die Liste ist nach
 * Naehe zum Knopf sortiert.
 */
function collectClickHandlers(btn, maxDepth = 12) {
  const found = [];
  const seen = new Set();
  const add = (fn) => {
    if (typeof fn === "function" && !seen.has(fn)) {
      seen.add(fn);
      found.push(fn);
    }
  };
  const props = reactProps(btn);
  if (props) add(props.onClick);
  let fiber = reactFiber(btn);
  for (let i = 0; fiber && i < maxDepth; i++) {
    if (fiber.memoizedProps) add(fiber.memoizedProps.onClick);
    fiber = fiber.return;
  }
  return found;
}

/**
 * Ein Ereignisobjekt, wie der Handler es erwartet.
 *
 * `acceptInvitation` liest nur `isTrusted`. Die uebrigen Felder sind fuer den
 * Fall da, dass die Rueckfallebene versehentlich einen MUI-eigenen Handler
 * erwischt — der fasst `target`, `currentTarget`, `key` und
 * `defaultPrevented` an und wuerde sonst mit einem TypeError abbrechen.
 */
function makeTrustedLikeEvent(node) {
  return {
    isTrusted: true,
    type: "click",
    target: node,
    currentTarget: node,
    relatedTarget: null,
    bubbles: true,
    cancelable: true,
    eventPhase: 2,
    defaultPrevented: false,
    timeStamp: Date.now(),
    button: 0,
    buttons: 0,
    detail: 1,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    key: undefined,
    nativeEvent: null,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {},
    stopImmediatePropagation() {},
    persist() {},
    isDefaultPrevented() {
      return this.defaultPrevented;
    },
    isPropagationStopped() {
      return false;
    },
  };
}

/** Sichtbarer Text eines Knopfes, robust gegen Leerraum und Icons. */
function labelOf(el) {
  return (el.innerText || el.textContent || "").trim();
}

/** Die Faktionskarte (MUI Paper) oberhalb eines Knopfes. */
function cardOf(btn) {
  // Die Verschachtelung ist <Paper><Box display="flex"> ... <Button/> ...
  // (FactionsRoot.tsx:96-124), vom Knopf also GENAU zwei Schritte nach oben.
  // Der Ersatzweg darf nicht weiter gehen: eine Ebene hoeher liegt der
  // Container mit ALLEN Karten, und der Teilstringvergleich unten wuerde dann
  // auf jede Faktion passen.
  return btn.closest(".MuiPaper-root") || btn.parentElement?.parentElement || null;
}

/**
 * Gehoert die Karte zur gesuchten Faktion?
 *
 * Zuerst wird auf einen Spannenknoten geprueft, dessen Text GENAU der Name
 * ist — so steht der Name in FactionsRoot.tsx:145. Eine eingeladene Faktion
 * ist dort nie verzerrt dargestellt: `receiveInvite` setzt im selben Moment
 * `discovery = known` (PlayerObjectGeneralMethods.ts:176-182), und
 * `CorruptibleText` greift nur bei unbekannten.
 */
function cardMatchesFactionExactly(card, factionName) {
  for (const s of card.querySelectorAll("span")) {
    if ((s.textContent || "").trim() === factionName) return true;
  }
  return false;
}

/**
 * Sucht den Join!-Knopf der genannten Faktion auf der Faktionsseite.
 *
 * Gesucht wird zuerst nur innerhalb von `span.factions-invites`
 * (FactionsRoot.tsx:265). Nur dort kann der Knopf ueberhaupt stehen: die
 * Geruechteliste filtert eingeladene Faktionen heraus (:232) und Mitglieder
 * bekommen statt "Join!" die Knoepfe "Details" und "Augments" (:117-118).
 *
 * @returns {{btn: Element|null, offered: string[], note: string}}
 */
function findPageJoinButton(doc, factionName) {
  const scope = doc.querySelector("span.factions-invites") || doc;
  const buttons = [...scope.querySelectorAll("button")].filter((b) => labelOf(b) === PAGE_JOIN_LABEL);

  const offered = [];
  const exact = [];
  const loose = [];
  for (const b of buttons) {
    const card = cardOf(b);
    if (!card) continue;
    const text = (card.innerText || "").split("\n").map((z) => z.trim()).filter(Boolean);
    offered.push(text[1] || text[0] || "?");
    if (cardMatchesFactionExactly(card, factionName)) exact.push(b);
    else if ((card.innerText || "").includes(factionName)) loose.push(b);
  }

  if (exact.length === 1) return { btn: exact[0], offered, note: "" };
  if (exact.length > 1) return { btn: exact[0], offered, note: `${exact.length} Karten passen exakt — die erste genommen` };

  // Ersatzweg nur, wenn er EINDEUTIG ist. Ein Fehlgriff waere teuer: der
  // Beitritt sperrt sofort alle Feinde der getroffenen Faktion
  // (FactionHelpers.tsx:44-47), und das laesst sich bis zur naechsten
  // Augmentierung nicht zuruecknehmen.
  if (loose.length === 1) return { btn: loose[0], offered, note: "ueber Teilstring gefunden (Struktur geaendert?)" };
  if (loose.length > 1) return { btn: null, offered, note: `${loose.length} mehrdeutige Teilstringtreffer — nichts angeklickt` };
  return { btn: null, offered, note: "" };
}

/**
 * Sucht den Join-Knopf im Einladungsfenster, falls es gerade offen steht.
 *
 * Dieser Knopf ist ungeschuetzt: `join()` in FactionInvitationManager.tsx:54
 * nimmt gar kein Ereignis entgegen. Ein einfacher `.click()` reicht.
 * Zu bedenken: das Fenster zeigt immer nur `factions[0]` (:51) — steht eine
 * andere Faktion darin, ist dieser Weg fuer unser Ziel nicht zustaendig.
 */
function findModalJoinButton(doc, factionName) {
  const modals = doc.querySelectorAll(".MuiModal-root, [role='presentation']");
  for (const m of modals) {
    const text = m.innerText || "";
    if (!text.includes("You received a faction invitation")) continue;
    if (!text.includes(factionName)) continue;
    const btn = [...m.querySelectorAll("button")].find((b) => labelOf(b) === MODAL_JOIN_LABEL);
    if (btn) return btn;
  }
  return null;
}

/**
 * Der Eintrag "Factions" in der Seitenleiste.
 *
 * Nicht ueber den Text des ganzen Eintrags suchen: neben der Beschriftung
 * sitzt ein Badge mit der Zahl ungesehener Einladungen (SidebarItem.tsx:37,
 * gespeist aus SidebarRoot.tsx:153), der Text lautet dann z.B. "2Factions".
 * Gesucht wird deshalb der Beschriftungsknoten (SidebarItem.tsx:44) und von
 * dort aus der umgebende Listeneintrag.
 *
 * Der Eintrag steckt in der Ziehharmonika "Character" (SidebarRoot.tsx:364).
 * Ist sie zugeklappt, bleibt er trotzdem im DOM — MUIs `Collapse` haengt ohne
 * `unmountOnExit` nichts aus —, und ein direkter `.click()` erreicht ihn auch
 * unsichtbar, weil dabei nicht getroffen, sondern zugestellt wird.
 */
function findSidebarFactionsItem(doc) {
  for (const el of doc.querySelectorAll(".MuiListItemText-root p, .MuiListItemText-root span")) {
    if ((el.textContent || "").trim() !== "Factions") continue;
    const item = el.closest(".MuiListItem-root, .MuiListItemButton-root, [role='button']");
    if (item) return item;
  }
  return null;
}

/**
 * Benennt den Spielzustand, wenn die Faktionsseite unerreichbar ist.
 *
 * Sechs Seiten rendern die Seitenleiste gar nicht (GameRoot.tsx:309-334 und
 * :492-496). Damit gibt es dort AUCH KEINEN Alt+F-Handler: der haengt in
 * einem useEffect von SidebarRoot (SidebarRoot.tsx:303) und existiert nur,
 * solange die Komponente montiert ist. Beide Wege sind dann gleichzeitig tot.
 *
 * Ohne diese Erkennung meldet der Beitritt in solchen Naechten nur ein
 * nichtssagendes "nicht gefunden", und niemand weiss, wo das Spiel steht.
 */
function detectBlockedPage(doc) {
  const body = (doc.body?.innerText || "").slice(0, 4000);
  const has = (s) => body.includes(s);
  if ([...doc.querySelectorAll("button")].some((b) => labelOf(b) === "Do something else simultaneously")) {
    return "fokussierte Arbeit (Page.Work)";
  }
  if (has("Recovery Mode") || has("RECOVERY MODE")) return "Recovery-Modus — der Spielstand hat ein Problem";
  if (has("Import Save") || has("Importing this save")) return "Speicherstand-Import wartet auf eine Entscheidung";
  if (has("BitNode-1") || has("The Bitverse") || has("Which BitNode")) return "BitVerse (Reset laeuft)";
  if (has("Infiltrating") || has("Get ready") || has("Infiltration")) return "Infiltration laeuft";
  if (!doc.querySelector(".MuiDrawer-root")) return "unbekannte Sonderseite ohne Seitenleiste";
  return "";
}

const onFactionsPage = (doc) =>
  !!(doc.querySelector("span.factions-invites") || doc.querySelector("span.factions-joined"));

/**
 * Bringt das Spiel auf die Faktionsseite.
 *
 * Zwei Wege, weil beide je eine Luecke haben:
 *
 *  - Alt+F: Der Tastaturhandler haengt am Dokument und prueft die Echtheit
 *    NICHT (SidebarRoot.tsx:290-304). Er steigt aber vorzeitig aus, solange
 *    fokussierte Arbeit laeuft oder das BitVerse offen ist (:290) — und auf
 *    den sechs Seiten ohne Seitenleiste ist er gar nicht erst registriert.
 *  - Klick auf den Seitenleisteneintrag: geht auch bei laufender, nicht
 *    fokussierter Arbeit und bei abgeschalteten Tastenkuerzeln
 *    (Settings.DisableHotkeys). Ohne Seitenleiste natuerlich auch nicht.
 *
 * Deshalb wird bei fokussierter Arbeit zuerst entfokussiert, sofern erlaubt.
 */
async function goToFactionsPage(doc, sleep, log, allowUnfocus) {
  if (onFactionsPage(doc)) {
    log.push("Faktionsseite stand schon offen.");
    return "";
  }

  // Fokussierte Arbeit blockiert beide Wege. Der Ausstieg ist der Knopf
  // "Do something else simultaneously" — der prueft die Echtheit nicht.
  const unfocus = [...doc.querySelectorAll("button")].find(
    (b) => labelOf(b) === "Do something else simultaneously",
  );
  if (unfocus) {
    if (!allowUnfocus) return "fokussierte Arbeit laeuft, Entfokussieren ist nicht erlaubt";
    unfocus.click();
    log.push("Fokussierte Arbeit entfokussiert (die Arbeit laeuft weiter).");
    await sleep(600);
  }

  // Erst Alt+F: dieser Weg laeuft im Projekt seit Tagen (src/hand.js:174).
  doc.dispatchEvent(new KeyboardEvent("keydown", { key: "f", altKey: true, bubbles: true }));
  log.push("Alt+F gesendet.");
  await sleep(1200);
  if (onFactionsPage(doc)) return "";

  // Nachfassen mit dem Seitenleisteneintrag.
  const item = findSidebarFactionsItem(doc);
  if (!item) {
    const why = detectBlockedPage(doc);
    return why
      ? `Faktionsseite unerreichbar: ${why}`
      : "kein Seitenleisteneintrag Factions gefunden (Faktionen noch nicht freigeschaltet?)";
  }
  item.click();
  log.push("Seitenleisteneintrag Factions angeklickt.");
  await sleep(1200);
  if (onFactionsPage(doc)) return "";

  const why = detectBlockedPage(doc);
  return why ? `Faktionsseite unerreichbar: ${why}` : "Seitenwechsel blieb wirkungslos";
}

/**
 * Wartet, bis der Spielerzustand die Mitgliedschaft bestaetigt.
 *
 * `joinFaction` arbeitet synchron; die Verzoegerung hier faengt nur die
 * Neuzeichnung und den Netscript-Zustandsabgleich ab.
 */
async function confirmMembership(isMember, sleep, tries, waitMs) {
  for (let i = 0; i < tries; i++) {
    if (await isMember()) return true;
    await sleep(waitMs);
  }
  return false;
}

/**
 * Nimmt den Nachtdienst aus dem Verkehr, solange hier die Seite gewechselt
 * wird — er bedient dieselbe Oberflaeche im 30-Sekunden-Takt und wuerde uns
 * mitten im Ablauf die Seite unter den Fuessen wegziehen.
 *
 * Der Griff ist gegen Verschachtelung abgesichert: hat ihn schon jemand
 * (z.B. hand.js fuer den ganzen Befehlsstapel), wird er hier NICHT wieder
 * losgelassen. Sonst liefe der Dienst mitten in einem laufenden
 * Terminalbefehl wieder an.
 */
function grabNightshift(doc) {
  let service = null;
  try {
    service = doc.defaultView.__nightshift;
  } catch {
    return () => {};
  }
  if (!service || service.busy) return () => {};
  service.busy = true;
  // Selbstloesung: stuerzt der Aufrufer ab, bliebe der Dienst sonst fuer
  // immer stehen. Derselbe Fallstrick wie in src/hand.js:142.
  let timer = null;
  try {
    timer = doc.defaultView.setTimeout(() => (service.busy = false), 120000);
  } catch {
    /* kein Fenster, auch gut */
  }
  return () => {
    service.busy = false;
    if (timer !== null) {
      try {
        doc.defaultView.clearTimeout(timer);
      } catch {
        /* egal */
      }
    }
  };
}

/**
 * Tritt einer Faktion bei, ohne dass ein Mensch klickt.
 *
 * @param {object}   o
 * @param {Document} o.doc             das Dokument (in Netscript: `document`)
 * @param {string}   o.factionName     exakter Faktionsname, z.B. "Tian Di Hui"
 * @param {(ms:number)=>Promise<any>} o.sleep
 * @param {()=>boolean|Promise<boolean>} o.isMember
 *        Pruefung am SPIELSTAND, nicht am Bildschirm. In hand.js:
 *        `() => ns.getPlayer().factions.includes(factionName)`
 * @param {boolean}  [o.allowUnfocus=true]      fokussierte Arbeit unterbrechen?
 * @param {boolean}  [o.returnToTerminal=false] am Ende zum Terminal zurueck
 * @param {number}   [o.buttonWaitMs=6000]      wie lange auf den Knopf warten
 * @returns {Promise<{ok:boolean, how:string, reason:string, atTerminal:boolean|null, log:string[]}>}
 */
export async function joinFaction(o) {
  const { doc, factionName, sleep, isMember } = o;
  const allowUnfocus = o.allowUnfocus !== false;
  const buttonWaitMs = o.buttonWaitMs ?? 6000;
  const log = [];

  if (typeof factionName !== "string" || !factionName) {
    return { ok: false, how: "none", reason: "kein Faktionsname uebergeben", atTerminal: null, log };
  }

  // Erst gucken, dann handeln. Spart bei einem Neustart nach Absturz den
  // ganzen Seitenwechsel.
  if (await isMember()) {
    log.push("Bereits Mitglied — nichts zu tun.");
    return { ok: true, how: "already", reason: "", atTerminal: null, log };
  }

  const release = grabNightshift(doc);
  let ok = false;
  let how = "none";
  let reason = "";

  try {
    // --- Weg A: das Einladungsfenster steht offen ------------------------
    //
    // Wenn es da ist, ist es der billigste Weg: kein Seitenwechsel, kein
    // Ereignisobjekt noetig. `join()` nimmt kein Ereignis entgegen
    // (FactionInvitationManager.tsx:54), die Echtheitspruefung greift hier
    // also gar nicht.
    const modalBtn = findModalJoinButton(doc, factionName);
    if (modalBtn) {
      modalBtn.click();
      log.push("Join im Einladungsfenster geklickt.");
      if (await confirmMembership(isMember, sleep, 8, 400)) {
        log.push("Spielerzustand bestaetigt die Mitgliedschaft.");
        ok = true;
        how = "modal";
      } else {
        log.push("Fenster geklickt, aber der Spielerzustand blieb unveraendert — weiter mit Weg B.");
      }
    }

    // --- Weg B: der geschuetzte Knopf auf der Faktionsseite ---------------
    if (!ok) {
      const navProblem = await goToFactionsPage(doc, sleep, log, allowUnfocus);
      if (navProblem) {
        reason = navProblem;
      } else {
        // Bei hoher Skriptlast ruckelt die Neuzeichnung. Deshalb wird
        // wiederholt nachgesehen statt einmal, sonst meldet der Beitritt
        // einen Fehlschlag, obwohl die Einladung da ist.
        let found = findPageJoinButton(doc, factionName);
        const until = Date.now() + buttonWaitMs;
        while (!found.btn && Date.now() < until) {
          await sleep(500);
          found = findPageJoinButton(doc, factionName);
        }
        if (found.note) log.push("Kartensuche: " + found.note);

        if (!found.btn) {
          log.push(`Offene Einladungen laut Seite: ${found.offered.join(", ") || "keine"}.`);
          reason = `keine offene Einladung fuer "${factionName}" auf der Seite`;
        } else {
          // Der eigentliche Kunstgriff. Es wird KEIN Ereignis abgeschickt —
          // der Handler wird direkt mit einem passenden Objekt aufgerufen.
          const handlers = collectClickHandlers(found.btn);
          if (handlers.length === 0) {
            reason = "am Knopf haengt kein React-onClick (React-Fassung geaendert?)";
          } else {
            log.push(`${handlers.length} onClick-Kandidat(en) am Knopf gefunden.`);
            for (let i = 0; i < handlers.length && !ok; i++) {
              try {
                handlers[i](makeTrustedLikeEvent(found.btn));
              } catch (e) {
                log.push(`Kandidat ${i} warf ${e && e.name}: ${e && e.message}`);
                continue;
              }
              if (await confirmMembership(isMember, sleep, 5, 400)) {
                log.push(`Kandidat ${i} hat gegriffen; Spielerzustand bestaetigt die Mitgliedschaft.`);
                ok = true;
                how = "reactProps";
              } else {
                log.push(`Kandidat ${i} lief durch, aber der Spielerzustand aenderte sich nicht.`);
              }
            }
            if (!ok) {
              // Der Handler wurde aufgerufen und hat nichts getan. Das hat
              // dann NICHT mit isTrusted zu tun, sondern mit den beiden
              // anderen Bedingungen in FactionsRoot.tsx:89 — die Einladung
              // ist weg, oder die Faktion ist gesperrt, weil wir schon bei
              // einem ihrer Feinde sind (FactionHelpers.tsx:44-47).
              reason = "Handler lief, aber joinFaction blieb wirkungslos (Einladung abgelaufen, Faktion gesperrt, oder Name falsch geschrieben)";
            }
          }
        }
      }
    }
  } catch (e) {
    // Kein Fehler darf nach draussen: der Aufrufer ist der einzige
    // Steuerkanal des Automaten, und der soll nicht daran sterben.
    reason = "Ausnahme: " + (e && e.message ? e.message : String(e));
    log.push(reason);
  } finally {
    release();
  }

  // --- Rueckkehr zum Terminal, nachgeprueft -------------------------------
  //
  // hand.js braucht danach das Eingabefeld. Ein blindes Alt+T reicht nicht:
  // auf den Seiten ohne Seitenleiste gibt es den Handler nicht.
  let atTerminal = null;
  if (o.returnToTerminal) {
    atTerminal = await backToTerminal(doc, sleep, log);
  }

  return { ok, how, reason, atTerminal, log };
}

/** Zurueck ans Terminal — und nachsehen, ob es geklappt hat. */
async function backToTerminal(doc, sleep, log) {
  const there = () => !!doc.getElementById("terminal-input");
  if (there()) return true;

  doc.dispatchEvent(new KeyboardEvent("keydown", { key: "t", altKey: true, bubbles: true }));
  await sleep(900);
  if (there()) return true;

  for (const el of doc.querySelectorAll(".MuiListItemText-root p, .MuiListItemText-root span")) {
    if ((el.textContent || "").trim() !== "Terminal") continue;
    el.closest(".MuiListItem-root, .MuiListItemButton-root, [role='button']")?.click();
    break;
  }
  await sleep(900);
  const done = there();
  if (!done) log.push("ACHTUNG: Rueckkehr zum Terminal misslungen — der naechste Terminalbefehl wird scheitern.");
  return done;
}
