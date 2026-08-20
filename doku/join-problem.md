# Faktionsbeitritt ohne Mensch

Untersucht am 20.08.2026 gegen `reference/v301` (Tag v3.0.1).
Alle Zeilenangaben beziehen sich auf diesen Stand.

**Ergebnis vorweg: es traegt.** Der Weg ist nicht, ein vertrauenswuerdiges
Ereignis zu erzeugen — das geht nicht und wird auch nie gehen. Der Weg ist,
das Ereignis wegzulassen: der `onClick`-Handler des Join!-Knopfes liegt als
gewoehnliche JavaScript-Funktion offen im DOM und laesst sich mit einem
selbstgebauten Objekt aufrufen. Fertige Funktion: `entwurf/join/join.js`.

**Stand der Pruefung:** alles unten ist am Quellcode hergeleitet und gegen die
echten Fassungen von `react-dom@17.0.2` und `@mui/material@5.18.0` gegengelesen.
Am LAUFENDEN Spiel gemessen ist es noch nicht — dafuer ist
`entwurf/join/probe.js` da. Bis diese Messung vorliegt, gilt der Weg als
belegt, aber nicht bewiesen.

Dieser Abschnitt loest ausserdem die Schlussfolgerung aus
`doku/oberflaeche.md` Abschnitt 0.2 ab. Dort steht, geschuetzte Knoepfe
brauchten zwingend echte Browsereingaben ueber CDP. Das stimmt fuer alle
Knoepfe, die man wirklich KLICKEN muss — aber der Join!-Knopf muss nicht
geklickt werden.

---

## 0. Der Befund in drei Saetzen

`acceptInvitation` (`src/Faction/ui/FactionsRoot.tsx:88-94`) liest aus dem
uebergebenen Ereignis **ausschliesslich** `event.isTrusted` (hier und im
Folgenden sind Codebloecke um Typangaben gekuerzt, nicht woertlich zitiert):

```js
function acceptInvitation(event, factionName) {
  if (!event.isTrusted || !Factions[factionName].alreadyInvited || Factions[factionName].isBanned) return;
  joinFaction(Factions[factionName]);
  props.rerender();
}
```

MUI reicht `onClick` **unveraendert** an das echte `<button>` durch
(`@mui/material@5.18.0`, `ButtonBase/ButtonBase.js`: die Wurzel bekommt
woertlich `onClick: onClick`, kein Wrapper, kein `useEventCallback`), und
React 17 (`package.json:42` — `"react": "^17.0.2"`) legt die Props eines
Host-Elements als gewoehnliche, aufzaehlbare Eigenschaft auf dem DOM-Knoten
ab (`react-dom@17`, `ReactDOMComponentTree.js`, Schluessel
`__reactProps$<zufall>`).

Damit ist der Knopf von innen bedienbar, ohne je ein Ereignis abzuschicken:

```js
const key = Object.keys(btn).find((k) => k.startsWith("__reactProps$"));
btn[key].onClick({ isTrusted: true });
```

Das ruft dieselbe Funktion auf, die auch der echte Klick aufruft —
`joinFaction(Factions[name])` in `src/Faction/FactionHelpers.tsx:35`. Es wird
nichts am Spielstand vorbeigeschrieben, nichts nachtraeglich gepatcht und
nichts neu geladen.

---

## 1. Das Popup zuverlaessig erwischen

**Urteil: traegt als Ergaenzung, nicht als alleinige Loesung.**

Wie es funktioniert:

- `inviteToFaction` (`src/Faction/FactionHelpers.tsx:25-33`) setzt
  `alreadyInvited = true`, `discovery = known`, haengt den Namen an
  `Player.factionInvitations` und sendet **nur dann** ein Ereignis, wenn
  `Settings.SuppressFactionInvites` aus ist (`:30-32`).
- Ausgeloest wird das aus der Spielschleife: `Engine.checkCounters` ruft
  `Player.checkForFactionInvitations()` und danach `inviteToFaction` fuer jede
  Faktion (`src/engine.tsx:177-182`); der Zaehler wird auf 10 Zyklen gesetzt
  (`:182`), bei 200 ms je Zyklus also **alle 2 Sekunden**.
- Der Manager (`src/Faction/ui/FactionInvitationManager.tsx:25-49`) haelt eine
  **Warteschlange** `factions: FactionName[]`. `"New"` haengt hinten an
  (`:35-40`), `"ClearAll"` leert sie (`:31-33`).

Die drei Punkte, auf die es ankommt:

1. **Es gibt keinen Zeitablauf.** Gerendert wird
   `<Modal open={!hidden && faction !== null}>` (`:63`). Nichts schliesst das
   Fenster von selbst — es steht, bis jemand es schliesst. Die Annahme
   "es erscheint nur im Moment des Eintreffens" stimmt also **nicht**; ein
   Abtasten alle paar Sekunden reicht voellig.
2. **Gerendert wird nur `factions[0]`** (`:51`). Die uebrigen warten. `close()`
   macht `slice(1)` (`:46-48`) und schaltet damit weiter. Von aussen laesst
   sich die Schlange also durchaus weiterdrehen — `Decide later` (`:86`) und
   das X im Rahmen (`src/ui/React/Modal.tsx:95`) rufen beide `close()`.
3. **Aber: `close()` verwirft den Eintrag endgueltig.** Es gibt keinen Weg
   zurueck in die Schlange. `inviteToFaction` steigt beim zweiten Anlauf
   sofort aus (`FactionHelpers.tsx:26`: `if (faction.alreadyInvited ...) return`),
   also wird nie erneut gesendet. Und weil `canBeDismissedEasily` in
   `Modal.tsx:61` standardmaessig `true` ist, reicht ein Escape oder ein
   Klick auf den Hintergrund, um eine Einladung dauerhaft aus dem Popup-Weg
   zu entfernen.

Der Join-Knopf im Fenster ist **ungeschuetzt**: `join()`
(`FactionInvitationManager.tsx:54-60`) nimmt gar kein Ereignis entgegen. Ein
schlichtes `.click()` genuegt.

**Warum das trotzdem nicht die Loesung ist:** der Weg haengt an einem
fluechtigen Zustand, den ein einziger versehentlicher Escape oder ein
`Decide later` fuer immer zerstoert — und genau das ist passiert. Er wird in
`entwurf/join/join.js` als *Weg A* mitgenommen (billiger, kein Seitenwechsel),
aber Weg B faengt ihn ab.

---

## 2. Den React-Zustand direkt setzen

**Urteil: traegt — aber in einer viel einfacheren Form als gefragt.**

Zur Frage wie gestellt (den `setFactions`-Setzer des Managers finden und die
Warteschlange von aussen fuellen):

- Der Manager ist tatsaechlich **dauerhaft eingehaengt**
  (`src/ui/GameRoot.tsx:561`, `<FactionInvitationManager hidden={hidePopups} />`),
  unabhaengig davon, ob das Fenster sichtbar ist. Sein Zustand ueberlebt also
  Seitenwechsel.
- Erreichbar ist er trotzdem schlecht. Bei geschlossenem Fenster hat er
  **keinen DOM-Knoten**: `Modal.tsx:70-101` setzt kein `keepMounted`, MUI
  haengt die Kinder also aus. Man muesste vom Wurzelknoten
  (`__reactContainer$...`) durch den ganzen Fiber-Baum laufen und die
  Komponente identifizieren — und im Auslieferungsbau sind die Funktionsnamen
  weg (`webpack.config.js:168`, `minimize: !isDevelopment`). Uebrig bliebe
  eine Erkennung nach Form, und `{hidden: boolean}` als Props haben fuenf
  Komponenten nebeneinander (`GameRoot.tsx:557-564`). Machbar, aber bruechig.

Der einfachere Zugriff auf denselben Baum ist der oben beschriebene: **die
Props des Join!-Knopfes lesen und `onClick` selbst aufrufen.** Der Knopf ist
ueber `span.factions-invites` (`FactionsRoot.tsx:265`) und die Beschriftung
`Join!` (`:122`) eindeutig zu finden, die Props liegen direkt auf dem
DOM-Knoten, und das Ereignis wird schlicht nicht gebraucht.

Belegt ist das an drei Stellen:

| Behauptung | Beleg |
|---|---|
| Handler liest nur `isTrusted` | `FactionsRoot.tsx:89` |
| MUI reicht `onClick` unveraendert durch | `@mui/material@5.18.0 ButtonBase.js`, Wurzel: `onClick: onClick`; die Tastaturpfade rufen `onClick` nur bei `isNonNativeButton()` |
| React 17 legt Props am DOM-Knoten ab | `package.json:42`; `react-dom@17 ReactDOMComponentTree.js`, `__reactProps$` |

`entwurf/join/join.js` nimmt zusaetzlich die Fiber-Kette oberhalb des Knopfes
als Rueckfallebene mit, falls eine spaetere MUI-Fassung den Handler doch
einpackt. Messung dazu: `entwurf/join/probe.js`, Punkt 2.

---

## 3. Den Spielzustand direkt aendern

**Urteil: nicht noetig — Weg 2 ruft bereits genau `joinFaction` auf.**

Vollstaendigkeitshalber die geprueften Zugaenge zum Modulinneren:

- **`globalThis.Bitburner`** mit `Player`, `Factions` und `SaveObject` gibt es,
  aber nur im Entwicklerbau: `src/engine.tsx:395-410` steht in
  `if (process.env.NODE_ENV === "development")`. Im Auslieferungsbau ist der
  Block wegoptimiert. Nicht verfuegbar.
- **`globalThis.React` / `globalThis.ReactDOM`** setzt `src/index.tsx:15-16`
  auch im Auslieferungsbau — nuetzlich fuer Fiber-Arbeit, gibt aber keinen
  Zugang zu Spielobjekten.
- **`webpackChunkbitburner`** existiert im Prinzip (`package.json` Name
  `bitburner`, kein eigener `chunkLoadingGlobal` in `webpack.config.js`), und
  ueber einen untergeschobenen Chunk kaeme man an `__webpack_require__` und
  damit an die Modulregistrierung. Nur sind die **Exportnamen minifiziert**
  (`webpack.config.js:168`). Man muesste nach Form suchen: `Factions` waere an
  einem Objekt mit den ~40 Faktionsnamen als Schluesseln erkennbar,
  `joinFaction` an seinem Quelltext (`String(fn)` enthaelt `isMember`,
  `alreadyInvited`, `isBanned` — Objekt-Eigenschaftsnamen mangelt Terser nicht
  an). Das ist machbar, aber deutlich bruechiger als Weg 2 und wird nicht
  gebraucht. Die Messung `probe.js` Punkt 5 sagt, ob der Zugang ueberhaupt da
  ist.
- **Spielstand von aussen aendern und neu laden** — ausgeschlossen, wie
  beauftragt: es waere Schummeln und wuerde alle laufenden Skripte toeten.

Nebenbefund fuer genau eine Faktion: `ns.stanek.acceptGift()` ruft
`joinFaction(cotmgFaction)` direkt aus Netscript
(`src/NetscriptFunctions/Stanek.ts:126`) — ohne SF4, ohne Klick. Gilt nur fuer
Church of the Machine God und nur mit Stanek-Zugang.

---

## 4. Einen echten Klick im Seitenkontext erzeugen

**Urteil: traegt nicht. Es gibt keine solche Schnittstelle.**

- `isTrusted` ist im DOM-Standard als `[LegacyUnforgeable]` deklariert. In
  WebIDL heisst das: eine **eigene, nicht konfigurierbare** Eigenschaft jeder
  Ereignisinstanz. `Object.defineProperty(ev, "isTrusted", ...)` wirft
  deshalb — live geprueft, und `probe.js` Punkt 4c misst es erneut.
  Ueberschatten ueber `Event.prototype` hilft nicht, weil die Eigenschaft auf
  der Instanz sitzt, nicht auf dem Prototyp.
- `HTMLElement.click()` ist im HTML-Standard ausdruecklich so definiert, dass
  das Ereignis **mit gesetztem "not trusted"-Flag** ausgeloest wird. Es gibt
  keinen Kontext, in dem es `true` liefert. (`probe.js` Punkt 4a.)
- `dispatchEvent` setzt `isTrusted` immer auf `false` — das ist der Zweck der
  Unterscheidung. (`probe.js` Punkt 4b.)
- **Benutzergesten lassen sich nicht weiterreichen.** "User activation" ist im
  HTML-Standard ein eigener, an das Fenster gebundener Zustand mit eigenem
  Ablauf; er steuert, ob z.B. `window.open` oder die Vollbildumschaltung
  erlaubt sind. Er faerbt keine spaeter abgeschickten Ereignisse ein. Ein
  echter Klick des Nutzers irgendwo auf der Seite macht ein direkt danach per
  `dispatchEvent` verschicktes Ereignis nicht vertrauenswuerdig.

Vertrauenswuerdige Ereignisse kann nur der Browser selbst erzeugen — durch
echte Eingabe oder ueber `Input.dispatchMouseEvent` im Debug-Protokoll. Genau
dieser Weg (CDP) ist hier ausgeschlossen, weil Opera fuer jede Verbindung eine
Freigabe verlangt.

Praktisch ist das aber gleichgueltig: Weg 2 braucht gar kein Ereignis.

---

## 5. Tastatur statt Maus

**Urteil: traegt nicht.**

Der Join!-Knopf ist ein MUI-`Button` und rendert ein **natives `<button>`**
(`ButtonBase`-Vorgabe `component = "button"`). Genau daran scheitert der Weg,
gleich zweifach:

1. **MUI erzeugt fuer native Knoepfe selbst keinen Klick.** In
   `ButtonBase.js` rufen `handleKeyDown` und `handleKeyUp` `onClick` nur auf,
   wenn `isNonNativeButton()` wahr ist:

   ```js
   const isNonNativeButton = () => {
     const button = buttonRef.current;
     return component && component !== 'button' && !(button.tagName === 'A' && button.href);
   };
   ```

   Fuer ein echtes `<button>` ist das `false`. MUI ueberlaesst Enter und
   Leertaste dem Browser.

2. **Der Browser setzt eine synthetische Taste nicht in einen Klick um.** Die
   Umwandlung Taste -> Klick ist eine Voreinstellungshandlung des User Agents
   und laeuft nur fuer echte, vertrauenswuerdige Tastenereignisse. Ein per
   `dispatchEvent` verschicktes `keydown` erzeugt kein `click`.
   (`probe.js` Punkt 4d misst das — auf einem eigenen Knopf, nicht auf dem
   Spielknopf.)

3. Und selbst wenn Punkt 1 anders waere: MUI wuerde `onClick(event)` mit dem
   **React-Tastaturereignis** aufrufen, dessen `isTrusted` das des nativen
   Ereignisses spiegelt — also `false`. Der Weg fuehrt in dieselbe Wand.

Die Vermutung, das sei der aussichtsreichste Weg, traegt also nicht. Sie war
aber nah dran: die richtige Beobachtung ist nicht "MUI reagiert auch auf
Tastatur", sondern "MUI reicht `onClick` unveraendert durch" — und das ist
genau der Hebel aus Weg 2.

---

## 6. Die Einstellung `Suppress faction invites`

**Urteil: geklaert — und fuer uns eher nuetzlich als schaedlich.**

`Settings.SuppressFactionInvites` (Vorgabe `false`,
`src/Settings/Settings.ts:59`, Schalter in
`src/GameOptions/ui/GameplayPage.tsx:27-28`) wirkt an **genau einer** Stelle:

```js
// src/Faction/FactionHelpers.tsx:25-33
export function inviteToFaction(faction) {
  if (faction.alreadyInvited || faction.isMember) return;
  Player.receiveInvite(faction.name);      // <- laeuft immer
  faction.alreadyInvited = true;           // <- laeuft immer
  faction.discovery = FactionDiscovery.known;
  if (!Settings.SuppressFactionInvites) {
    FactionInvitationEvents.emit({ type: "New", factionName: faction.name });
  }
}
```

Die Einladung wird also **vollstaendig erzeugt**; unterdrueckt wird nur das
Popup. Sichtbar bleibt sie an zwei Stellen:

- auf der Faktionsseite unter `Faction Invitations` mit dem `Join!`-Knopf
  (`FactionsRoot.tsx:229`, `:265-277`), gespeist aus
  `Player.factionInvitations`;
- als Zaehler an der Seitenleiste (`src/Sidebar/ui/SidebarRoot.tsx:153`,
  ungesehene Einladungen ueber `InvitationsSeen`).

**Empfehlung:** die Einstellung **einschalten**, sobald Weg 2 eingebaut ist.
Ein Fenster, das ueber dem Spiel steht, ist fuer einen Automaten nur ein
Risiko — es kann andere Klicks verdecken und die Warteschlange kann durch
einen versehentlichen Escape Eintraege verlieren. Weg 2 braucht das Popup
nicht. Wichtig zu wissen: mit der Einstellung an ist Weg 1 **komplett tot**,
weil gar kein Ereignis mehr gesendet wird.

---

## 7. Was zu tun ist

1. `entwurf/join/join.js` als `join.js` **und** `entwurf/join/probe.js` als
   `probe.js` nach `home` bringen (probe.js importiert join.js fest — ein
   dynamisches `import()` gibt es in Bitburner nicht). Faktionsseite oeffnen
   (Alt+F), dann `run probe.js`. Die Punkte 1, 2 und 4 bestaetigen oder
   widerlegen die Annahmen oben in der laufenden Fassung. Am aussagekraeftigsten
   ist die Messung, wenn gerade eine Einladung offen ist — sonst gibt es
   keinen `Join!`-Knopf zu vermessen.
2. Bei gruener Messung `entwurf/join/join.js` in `src/hand.js` einbauen; der
   Einbau steht als Kopiervorlage im Kopf der Datei (`!join <Faktion>`).
3. `Suppress faction invites` einschalten.
4. Den Autopiloten nach jedem Reset einmal `!join` fuer jede offene Einladung
   fahren lassen. Die Einladungen selbst kommen von allein, alle 2 Sekunden
   geprueft (`engine.tsx:177-182`).

## 8. Fallstricke beim Einbau

- **Sechs Seiten haben gar keine Seitenleiste — und damit auch keinen
  Alt-Tastenhandler.** `withSidebar = false` gilt fuer Recovery, BitVerse,
  Infiltration, BladeburnerCinematic, Work und ImportSave
  (`GameRoot.tsx:309-334` und `:492-496`); ohne `withSidebar` wird
  `<SidebarRoot>` nicht gerendert (`:548`), und der Tastenhandler haengt in
  dessen `useEffect` (`SidebarRoot.tsx:303`). Auf diesen Seiten sind Alt+F
  UND der Seitenleistenklick gleichzeitig tot — nicht nur "der Handler steigt
  aus". Fuer `Page.Work` gibt es den Ausweg
  `Do something else simultaneously` (prueft die Echtheit nicht); `join.js`
  nutzt ihn, wenn `allowUnfocus` gesetzt ist, und benennt die uebrigen
  Zustaende im Protokoll, statt nur "nicht gefunden" zu melden.
- **Direkt nach einem Reset gibt es nichts beizutreten.**
  `prestigeAugmentation` leert `Player.factions` und
  `Player.factionInvitations` (`PlayerObjectGeneralMethods.ts:111-112`), und
  `Faction.prestigeAugmentation` setzt jedes `isMember` zurueck
  (`Faction.ts:83`). Neue Einladungen entstehen erst wieder, wenn die
  Bedingungen erfuellt sind — je nach Faktion Minuten spaeter. Ein `!join`
  unmittelbar nach dem Reset scheitert zwangslaeufig und korrekt.
- **Das Spiel bestraft so etwas nicht.** Bitburner hat ein eigenes
  Exploit-System (`src/Exploits/`, Source-File -1), das Regelbrueche belohnt
  statt sie zu ahnden. Die vorhandenen Erkennungsschleifen pruefen
  `Number.prototype`-Manipulation und Zeitraffer; DOM-Introspektion und
  direkte Handleraufrufe sind nirgends erfasst.
- **Der Nachtdienst muss stillstehen**, solange `join.js` laeuft — es wird die
  Seite gewechselt. Dafuer ist `__nightshift.busy` da, wie in `hand.js` schon
  fuer Terminalbefehle.
- **Feinde sperren Faktionen.** `joinFaction` setzt bei allen Feinden
  `isBanned = true` (`FactionHelpers.tsx:44-47`), und `acceptInvitation` prueft
  das mit (`FactionsRoot.tsx:89`). Ein stiller Fehlschlag hat also oft nichts
  mit `isTrusted` zu tun. Die Reihenfolge der Beitritte ist eine
  Strategiefrage, keine technische.
- **Nie am Bildschirmtext pruefen.** Einzige Wahrheit ist
  `ns.getPlayer().factions` (`src/NetscriptFunctions.ts:1431`, Kopie von
  `Player.factions`, das `joinFaction` in `FactionHelpers.tsx:42` neu
  aufbaut). Im Spielstand liegt dasselbe Feld: `SaveObject.ts:209` schreibt
  `this.PlayerSave = JSON.stringify(Player)`, also einen JSON-String des
  ganzen Spielerobjekts — `factions` sitzt darin unmittelbar auf oberster
  Ebene, nicht unter einem zusaetzlichen `data`.
