# Oberflaechen-Ablaeufe fuer den unbeaufsichtigten Automaten

Zweck: alles, was ohne Source File 4 (Singularity) kein Netscript-Skript kann und
deshalb ueber Browser-Automation der Spieloberflaeche laufen muss.

Quellenstand: **Bitburner v3.0.1**, geprueft im geklonten Quellcode unter
`reference/v301` (`git describe --tags` = `v3.0.1`, Commit `3162fd2`,
`package.json` Version `3.0.1`). Alle Zeilennummern beziehen sich auf **diesen**
Stand. Der `dev`-Zweig weicht ab, dort gelten andere Zeilen.

Jede Behauptung hat eine Fundstelle `src/Pfad/Datei.tsx:Zeile`. Wo ich unsicher
bin, steht das ausdruecklich als **UNSICHER** dabei. Abschnitt 11 sammelt alles
Offene.

Schwesterdokument: `doku/oberflaeche.md`. Das deckt zusaetzlich TOR-Kauf,
home-RAM/Kerne, Verbrechen und die ASCII-Karte ab. Wo beide Dokumente dasselbe
behandeln, gilt **dieses hier**, weil ich die Zeilen neu gegen den Quellcode
geprueft habe (drei kleine Abweichungen sind in Abschnitt 12 benannt).

---

## 0. Grundregeln, die fuer alle Ablaeufe gelten

### 0.1 Vollstaendiges `isTrusted`-Inventar

`grep -rn isTrusted src/` ueber den gesamten Quellbaum liefert genau diese
Stellen. Das ist die **komplette** Liste, es gibt keine weiteren:

| Fundstelle | Was |
|---|---|
| `src/Faction/ui/FactionsRoot.tsx:89` | **Faktion beitreten** ueber `Join!` auf der Factions-Seite |
| `src/Programs/ui/ProgramsRoot.tsx:96` | **`Resume focus`** beim Programmschreiben |
| `src/Programs/ui/ProgramsRoot.tsx:108` | **`Create program`** |
| `src/Locations/ui/SlumsLocation.tsx:25` | Verbrechen starten |
| `src/Locations/ui/CompanyLocation.tsx:62, 71` | Job annehmen / Firmenarbeit |
| `src/Locations/ui/HospitalLocation.tsx:23` | Heilen |
| `src/Casino/Blackjack.tsx:143, 160, 241`, `src/Casino/utils.ts:5` | Casino |
| `src/Infiltration/ui/InfiltrationRoot.tsx:74` | Infiltration (Tastatur) |
| `src/Arcade/ui/BBCabinet.tsx:17` | Arcade-Automat (`postMessage`) |
| `src/Exploits/Unclickable.tsx:11` | Exploit-Achievement, irrelevant |

**Nicht** geprueft und damit auch mit einem synthetischen `element.click()`
bedienbar:

- Augmentations kaufen (`Buy`) und der Bestaetigungsknopf `Purchase`
- Augmentations installieren (`Install Augmentations`) und `Confirm`
- Faktionsarbeit starten (`Hacking Contracts`, `Field Work`, `Security Work`)
- Faktionsarbeit beenden (`Stop Faction work`, `Do something else simultaneously`)
- Reisen (`Travel to <Stadt>`) und die Bestaetigung `Travel`
- TOR-Router kaufen, home-RAM, home-Kerne
- **die Faktionseinladung im Popup** (siehe 3.2 — das ist der wichtigste Punkt
  dieses Abschnitts)
- alle Navigationsknoepfe der Seitenleiste

Konsequenz: Fuer `Join!` auf der Factions-Seite und fuer `Create program`
braucht es echte Browser-Eingaben (CDP `Input.dispatchMouseEvent`, also die
normalen Klick-Werkzeuge der Fernsteuerung, **nicht** `evaluate_script` mit
`.click()`). Alles andere geht auch per JavaScript.

> **UNSICHER:** Ob die konkret eingesetzte Fernsteuerung `isTrusted === true`
> erzeugt, habe ich nicht gemessen. Bei CDP-Eingabeereignissen ist das der
> Normalfall. Das gehoert einmal geprueft, bevor die Nacht davon abhaengt.
> Billigster Test: `Create program` auf `BruteSSH.exe` klicken — wenn die Seite
> auf `Work` springt, war der Klick trusted; wenn nichts passiert, nicht.

### 0.2 Navigation ohne Maus — synthetische Tastenereignisse reichen

Die Seitenleiste haengt einen `keydown`-Handler direkt an `document`
(`src/Sidebar/ui/SidebarRoot.tsx:303`). Der Handler prueft **kein** `isTrusted`
(`SidebarRoot.tsx:279-301`). Ein

```js
document.dispatchEvent(new KeyboardEvent("keydown", { key: "t", altKey: true, bubbles: true }))
```

navigiert also zuverlaessig. Die Umsetzung des Ereignisses in eine
Tastenkombination liest nur `ctrlKey`, `altKey`, `shiftKey`, `metaKey` und
`key.toUpperCase()` (`src/utils/KeyBindingUtils.ts:350-362`).

Standardbelegung (aus `DefaultKeyBindings`, `src/utils/KeyBindingUtils.ts:65ff`,
maschinell ausgelesen):

| Taste | Seite | Taste | Seite |
|---|---|---|---|
| `Alt+T` | Terminal | `Alt+W` | City |
| `Alt+E` | Script Editor | `Alt+R` | Travel |
| `Alt+S` | Active Scripts | `Alt+J` | Job |
| `Alt+P` | Create Program | `Alt+B` | Bladeburner |
| `Alt+C` | Stats | `Alt+G` | Gang |
| `Alt+F` | Factions | `Alt+H` | Hacknet |
| `Alt+A` | Augmentations | `Alt+U` | Documentation |
| `Alt+O` | Options | | |

Ohne Belegung: Stanek, Sleeves, Grafting, Stock Market, Corporation, IPvGO,
Dark Net, Milestones, Achievements.

Drei Sperren, die der Automat kennen muss (`SidebarRoot.tsx:279-301`):

1. `Settings.DisableHotkeys` schaltet alles ab (`:280`).
2. **Solange fokussierte Arbeit laeuft** (`Player.currentWork && Player.focus`)
   oder man auf der BitVerse-Seite ist, tut **keine** Taste etwas (`:290`).
   Wer arbeitet, muss erst `Stop Faction work` oder
   `Do something else simultaneously` klicken.
3. `canGoToPage` (`:202-235`): `Factions` funktioniert nur bei
   `canOpenFactions`, `Augmentations` nur bei `canOpenAugmentations`
   (Bedingungen `:157-169`). Vorher passiert nichts — auch kein Fehler.

Terminal, Script Editor, Active Scripts, Create Program, Stats, Hacknet, City,
Travel, Milestones, Documentation, Achievements und Options sind immer erlaubt
(`:205-217`).

### 0.3 Dialoge

Alle Modale kommen aus `src/ui/React/Modal.tsx`. Oben rechts sitzt ein
`IconButton` mit `<CloseIcon />` ohne Beschriftung (`Modal.tsx:95-97`).
Bei `canBeDismissedEasily` (Vorgabe `true`, `Modal.tsx:61`) schliessen
zusaetzlich `Escape` und ein Klick auf den Hintergrund (`Modal.tsx:77-82`).

**Wichtig:** Die einfachen Meldungen ueber `dialogBoxCreate` haben **keinen
OK-Knopf**. Der `AlertManager` rendert ihn nur, wenn `canBeDismissedEasily`
falsch ist (`src/ui/React/AlertManager.tsx:88-93`), und `dialogBoxCreate`
setzt die Vorgabe auf `true` (`src/ui/React/DialogBox.tsx:8`). Wer auf `OK`
wartet, wartet ewig. `Escape` ist der Weg.

> **UNSICHER:** MUI v5 setzt bei `createSvgIcon` normalerweise ein
> `data-testid="CloseIcon"` — auch im Produktionsbau. Ich konnte das hier nicht
> belegen, weil `node_modules` im Klon nicht vorhanden ist. Nicht darauf bauen,
> `Escape` benutzen.

MUI haengt den `Escape`-Handler an den Modal-Wurzelknoten, nicht an `document`.
Ein synthetisches `KeyboardEvent` auf `document` schliesst den Dialog deshalb
**vermutlich nicht** — hier eine echte Tastatureingabe der Fernsteuerung nehmen.
**UNSICHER**, nicht nachgemessen.

### 0.4 Einstellungen, die vor dem Nachtlauf gesetzt gehoeren

Alle unter `Alt+O` -> Reiter links. Reiternamen exakt:
`System`, `Interface`, `Numeric Display`, `Gameplay`, `Misc`, `Remote API`,
`Key Binding` (`src/GameOptions/ui/GameOptionsRoot.tsx:13-20`).

| Reiter | Schaltertext (exakt) | Fundstelle | Warum |
|---|---|---|---|
| `Interface` | `Disable ASCII art` | `src/GameOptions/ui/InterfacePage.tsx:20` | macht aus Stadt- und Weltkarte beschriftete Knoepfe statt einzelner Buchstaben |
| `Interface` | `Disable text effects` | `src/GameOptions/ui/InterfacePage.tsx:31` | sonst flackern Ortsueberschriften mit Backdoor zufaellig |
| `Gameplay` | `Suppress travel confirmations` | `src/GameOptions/ui/GameplayPage.tsx:40` | Reisen ohne Rueckfrage |
| `Gameplay` | `Suppress augmentations confirmation` | `src/GameOptions/ui/GameplayPage.tsx:51` | Kauf **und** Installation ohne Rueckfrage (ein Schalter fuer beides) |

**Nicht setzen:** `Suppress faction invites`
(`src/GameOptions/ui/GameplayPage.tsx:29`). Das Popup ist der einzige Weg, eine
Faktion **ohne** trusted Klick beizutreten (siehe 3.2).

Ausserdem: In `Numeric Display` steht ein `Locale`-Auswahlfeld
(`src/GameOptions/ui/NumericDisplayOptions.tsx:102`), Vorgabe `"en"`
(`src/Settings/Settings.ts:35`). Alle Zahlen laufen durch
`new Intl.NumberFormat([Settings.Locale, "en"], ...)`
(`src/ui/formatNumber.ts:35, 52`). Steht das auf `de`, wird aus `1,234.56`
plotzlich `1.234,56` und jedes DOM-Parsen von Zahlen kippt. **Vor dem Lauf auf
`en` festnageln.**

### 0.5 Terminal bedienen

- Eingabefeld: `<input id="terminal-input">`
  (`src/Terminal/ui/TerminalInput.tsx:450`, im Code steht daneben der Kommentar
  `// for players to hook in`). Ausgabe: `<ul id="terminal">`
  (`src/Terminal/ui/TerminalRoot.tsx:85`). Das sind die einzigen beiden
  ausdruecklich angebotenen DOM-Anker im Spiel.
- Das Feld ist `disabled`, solange `Terminal.action !== null`
  (`TerminalInput.tsx:442`) — also waehrend `hack`, `grow`, `weaken`, `analyze`
  und **`backdoor`**.
- Befehle lassen sich mit `;` verketten (`src/Terminal/Parser.ts`), also
  `home; connect a; connect b; backdoor` in einer Zeile.
- Beim Tippen kann ein Popup `Possible autocomplete candidates:`
  aufgehen (`TerminalInput.tsx:477`). Es stoert `Enter` nicht.

---

## 1. DARKWEB: Programme kaufen

### 1.1 Geht das vollstaendig ueber das Terminal? — Ja.

Bestaetigt: Es gibt **keine** Darkweb-Seite und keine Kaufknoepfe. Der komplette
Handel laeuft ueber den Terminalbefehl `buy`
(`src/Terminal/commands/buy.ts`, Logik in `src/DarkWeb/DarkWeb.tsx`).

`connect darkweb` ist **nicht noetig**. Das sagt das Spiel selbst:
"You can use the 'buy' command anywhere, not only when connecting to the
'darkweb' server." (`src/DarkWeb/DarkWeb.tsx:20-21`).

Damit ist Aufgabe 1 komplett mausfrei — die sichere Variante.

### 1.2 Befehle

```
buy -l          # Liste (auch: -1, --list)   -> src/Terminal/commands/buy.ts:20
buy -a          # alles Fehlende (auch: --all) -> :21
buy <Programm>  # einzeln                     -> :22
```

`buy` mit einer anderen Argumentzahl als 1 gibt nur den Hilfetext aus
(`buy.ts:12-18`).

Der Programmname wird kleingeschrieben verglichen
(`src/DarkWeb/DarkWeb.tsx:45, 52`), Gross-/Kleinschreibung ist also egal.

### 1.3 Sortiment und Preise

`src/DarkWeb/DarkWebItems.ts:5-21`, Reihenfolge exakt wie dort. Die kanonischen
Namen stehen in `src/Programs/Enums.ts:1-17`.

| Programm | Preis | Beschreibung im Spiel | Fundstelle |
|---|---|---|---|
| `BruteSSH.exe` | 500.000 | Opens up SSH Ports. | `DarkWebItems.ts:6` |
| `FTPCrack.exe` | 1.500.000 | Opens up FTP Ports. | `:7` |
| `relaySMTP.exe` | 5.000.000 | Opens up SMTP Ports. | `:8` |
| `HTTPWorm.exe` | 30.000.000 | Opens up HTTP Ports. | `:9` |
| `SQLInject.exe` | 250.000.000 | Opens up SQL Ports. | `:10` |
| `ServerProfiler.exe` | 500.000 | Displays detailed server information. | `:11` |
| `DeepscanV1.exe` | 500.000 | Enables 'scan-analyze' with a depth up to 5. | `:12` |
| `DeepscanV2.exe` | 25.000.000 | Enables 'scan-analyze' with a depth up to 10. | `:13` |
| `AutoLink.exe` | 1.000.000 | Enables direct connect via 'scan-analyze'. | `:14` |
| `DarkscapeNavigator.exe` | 50.000.000 | Unlock access to the Dark Net. | `:15-19`, Preis `src/DarkNet/Constants.ts:8` |
| `Formulas.exe` | 5.000.000.000 | Unlock access to the formulas API. | `:20` |

Schreibweisen, die man leicht falsch macht: `relaySMTP.exe` faengt **klein** an,
`SQLInject.exe` hat drei Grossbuchstaben vorn, `DeepscanV1.exe` hat ein kleines
`s` in "scan".

### 1.4 Fehlermeldungen im Terminal

| Lage | Ausgabe | Fundstelle |
|---|---|---|
| Erfolg | `You have purchased the BruteSSH.exe program. The new program can be found on your home computer.` | `DarkWeb.tsx:84-86` |
| schon vorhanden | `You already have the BruteSSH.exe program` | `DarkWeb.tsx:65` |
| **zu wenig Geld** | `Not enough money to purchase BruteSSH.exe` (rot, `Terminal.error`) | `DarkWeb.tsx:71` |
| Name unbekannt | `Unrecognized item: xyz` (rot; **kleingeschrieben**, weil der Name vorher durch `toLowerCase()` ging) | `DarkWeb.tsx:59` |
| kein TOR-Router | `You need to be able to connect to the Dark Web to use the "buy" command. (Maybe there's a TOR router you can buy somewhere)` | `buy.ts:7-9` |
| `buy -a`, zu wenig Geld | `Need $X more to purchase HTTPWorm.exe` (rot) | `DarkWeb.tsx:101` |
| `buy -a`, alles da | `All available programs have been purchased already.` | `DarkWeb.tsx:110` |
| `buy -a`, fertig | `All programs have been purchased.` | `DarkWeb.tsx:115` |

Gegenprobe jederzeit mit `buy -l`: gekaufte Posten zeigen `[OWNED]` in gruen
statt des Preises (`DarkWeb.tsx:30-34`).

### 1.5 Zwei Fallen bei `buy -a`

1. **`buy -a` bricht beim ersten unbezahlbaren Posten komplett ab.** In
   `buyAllDarkwebItems` steht `return` statt `continue`
   (`src/DarkWeb/DarkWeb.tsx:100-103`). Die Liste wird in der Reihenfolge aus
   1.3 abgearbeitet — wer 300 Mio hat, kauft BruteSSH, FTPCrack, relaySMTP,
   HTTPWorm, SQLInject und dann **nichts mehr**, obwohl `ServerProfiler.exe`
   fuer 500k noch drin waere. **Empfehlung: einzeln kaufen, aufsteigend nach
   Preis.**
2. **`buy -a` kauft auch `DarkscapeNavigator.exe`.** Das ruft
   `getDarkscapeNavigator()` auf (`DarkWeb.tsx:88-90`), was `populateDarknet()`
   ausloest (`src/DarkNet/effects/effects.ts:264-273`) und damit **neue Server
   ins Netzwerk haengt**. Ein Skript, das blind alles nuked oder Routen per
   Breitensuche baut, bekommt danach ein anderes Netz vorgesetzt. Fuer den
   Nachtlauf: nicht kaufen, solange der Automat den Dark Net nicht kennt.

### 1.6 Vorbedingungen

- **TOR-Router.** Ohne den geht `buy` gar nicht (`buy.ts:6`). Der Router ist
  ein Knopf, kein Terminalbefehl: `Alt+W` (City) -> TechVendor ->
  `Purchase TOR router - $200.000k`
  (`src/Locations/ui/TorButton.tsx:44-49`; Preis `CONSTANTS.TorRouterCost = 200e3`,
  `src/Constants.ts:44`). Der Knopf prueft **kein** `isTrusted`. Das Trennzeichen
  ist ein `&nbsp;` — beim Textvergleich nur auf den Praefix
  `Purchase TOR router` pruefen. Nach dem Kauf steht dort
  `Purchase TOR router - Purchased` und der Knopf ist disabled
  (`TorButton.tsx:45, 47`).
- **Genug Geld.** Ein Hacking-Level braucht es zum Kaufen nicht — nur beim
  Selberschreiben (Abschnitt 8).

---

## 2. BACKDOOR setzen

Laeuft vollstaendig ueber das Terminal.

### 2.1 Ablauf

```
home
connect <nachbar1>
connect <nachbar2>
...
connect <ziel>
backdoor
```

oder in einer Zeile: `home; connect a; connect b; backdoor`.

`connect` akzeptiert nur (`src/Terminal/commands/connect.ts`):

1. einen **direkten Nachbarn** des aktuellen Servers (`:23-37`), oder
2. einen Server, der **schon eine Backdoor hat** oder einem selbst gehoert
   (`:43-46`) — deshalb funktioniert `connect home` immer.

Fehlermeldungen:

| Lage | Ausgabe | Fundstelle |
|---|---|---|
| unbekannter Name | `Invalid hostname: '<host>'` | `connect.ts:18` |
| nicht erreichbar | `Cannot directly connect to <host>. Make sure the server is backdoored or adjacent to your current server` | `connect.ts:48-50` |
| falsche Argumentzahl | `Incorrect usage of connect command. Usage: connect [hostname]` | `connect.ts:10` |

Die Route findet man nicht durch Raten. Sauberster Weg: im Spiel per Skript
`ns.scan()` als Breitensuche ab `home` rechnen und die Route ueber die
RFA-Bruecke nach draussen geben. Im Terminal ginge auch `scan` (Nachbarn) und
`scan-analyze <tiefe>` (Baum, Tiefe ohne Programme 3, mit `DeepscanV1.exe` 5,
mit `DeepscanV2.exe` 10).

### 2.2 Vorbedingungen, in genau dieser Reihenfolge geprueft

`src/Terminal/commands/backdoor.ts`:

| Bedingung | Ausgabe (alle rot ueber `Terminal.error`) | Zeile |
|---|---|---|
| Argumente uebergeben | `Incorrect usage of backdoor command. Usage: backdoor` | `:9` |
| kein normaler Server | `Can only install a backdoor on normal servers` | `:14` |
| eigener Server / `home` | `Cannot install a backdoor on your own machines! You are currently connected to your home PC or one of your cloud servers.` | `:18-20` |
| **kein Root** | `You do not have admin rights for this machine!` | `:24` |
| **Hacking-Level zu klein** | `Your hacking skill is not high enough to install a backdoor on this machine. Try analyzing the machine to determine the required hacking skill.` | `:28-30` |
| schon vorhanden | `You have already installed a backdoor on this server. You can check the "Backdoor" status via the "analyze" command.` — nur `Terminal.warn`, **die Aktion laeuft trotzdem los** | `:35-37` |

Zum Hacking-Level: geprueft wird `server.requiredHackingSkill > Player.skills.hacking`
(`:27`) — dieselbe Schwelle wie beim Hacken, **ohne** Intelligenz-Bonus. Root
muss vorher ein Skript per `nuke()` besorgen.

### 2.3 Dauer und Abschlusserkennung

`backdoor` startet eine Terminalaktion mit **einem Viertel der Hackdauer**:
`this.startAction(calculateHackingTime(server, Player) / 4, "b", server)`
(`src/Terminal/Terminal.ts:242`).

Solange die Aktion laeuft:

- ist `#terminal-input` **disabled** (`src/Terminal/ui/TerminalInput.tsx:442`)
- steht darunter ein 50 Zeichen breiter Fortschrittsbalken
  (`src/Terminal/ui/TerminalActionTimer.tsx:10`, Breite
  `src/Terminal/Terminal.ts:879-882`)

**Der Automat soll auf `#terminal-input:not([disabled])` warten, nicht auf eine
feste Zeit.** Eine Zahl kann ich nicht nennen — die Dauer haengt an Serverwerten
und Spielerlevel. Bei `CSEC` sind das frueh im Spiel Sekunden bis Minuten, bei
Endgame-Zielen deutlich mehr.

Abschluss (`src/Terminal/Terminal.ts:373-395`):

1. zuerst wird der volle Fortschrittsbalken als Zeile ausgegeben (`:449`)
2. dann `Backdoor on 'CSEC' successful!` (`:393`)
3. bei Abbruch statt dessen `Cancelled` (`:471`)

Gegenprobe jederzeit: `analyze` zeigt `Backdoor: YES` bzw. `NO`.

### 2.4 Zwei Nebenwirkungen

- **Faktionseinladungen werden sofort nachgeprueft.** `finishBackdoor` setzt
  `Engine.Counters.checkFactionInvitations = 0` und ruft `Engine.checkCounters()`
  (`Terminal.ts:390-391`). Deshalb ist Abschnitt 3 typischerweise der naechste
  Schritt nach einer Backdoor auf `CSEC`, `avmnite-02h`, `I.I.I.I`,
  `run4theh111z`, `.`, `The-Cave` oder `fulcrumassets`.
- **`w0r1d_d43m0n` beendet den BitNode.** `finishBackdoor` springt dann sofort
  auf die BitVerse-Seite (`Terminal.ts:381-386`). Nicht versehentlich ausloesen.

---

## 3. FAKTIONSEINLADUNG annehmen

Es gibt **zwei** Wege mit **unterschiedlichen Knopftexten** und
**unterschiedlichem `isTrusted`-Verhalten**. Das ist der wichtigste Unterschied
im ganzen Dokument.

### 3.1 Weg A: Factions-Seite — Knopf `Join!`, braucht einen echten Klick

`Alt+F` -> in der Karte der Faktion der Knopf `Join!`
(`src/Faction/ui/FactionsRoot.tsx:122` — **mit Ausrufezeichen**).

Der Knopf existiert nur bei offener Einladung; ohne Einladung ist er **gar nicht
im DOM**, nicht etwa disabled (`FactionsRoot.tsx:120-124`). Bei bereits
beigetretenen Faktionen stehen an derselben Stelle `Details` (`:117`) und
`Augments` (`:118`).

Der Handler (`FactionsRoot.tsx:88-94`):

```js
if (!event.isTrusted || !Factions[factionName].alreadyInvited || Factions[factionName].isBanned) {
  return;
}
```

Also: **`isTrusted` wird geprueft**, und in allen drei Faellen passiert
kommentarlos nichts.

### 3.2 Weg B: das Einladungs-Popup — Knopf `Join`, **kein** `isTrusted`

`src/Faction/ui/FactionInvitationManager.tsx`. Das Popup geht auf, sobald eine
Einladung eintrifft, sofern `Suppress faction invites` **aus** ist
(`src/Faction/FactionHelpers.tsx:30-32`).

Inhalt:

- h4 `You received a faction invitation.` (`:64`)
- `Would you like to join <Name>?`, Name fett in `<b>` (`:65-67`)
- bei verfeindeten Faktionen zusaetzlich
  `Joining this faction will prevent you from joining its enemies until your next augmentation.`
  und `<Name> is enemies with:` mit Liste (`:68-81`)
- Knopf `Join` (**ohne** Ausrufezeichen, `:83-85`)
- Knopf `Decide later` (`:86`)

Die `join`-Funktion (`:54-60`) nimmt **gar kein Event entgegen**:

```js
function join(): void {
  if (faction === null || !faction.alreadyInvited || faction.isBanned) { return; }
  joinFaction(faction);
  close();
}
```

**Damit ist das Popup der einzige Weg, ohne einen trusted Klick beizutreten.**
Deshalb `Suppress faction invites` ausgeschaltet lassen.

Einschraenkungen des Popup-Wegs:

- Es erscheint **nur einmal, im Moment des Eintreffens** der Einladung
  (`FactionHelpers.tsx:31`). Fuer alte, bereits weggeklickte Einladungen kommt
  es nicht wieder.
- Es arbeitet eine **Warteschlange** ab: `close()` schiebt die naechste Faktion
  nach (`:45-49`). Welche Faktion gerade angeboten wird, muss der Automat aus
  dem `<b>`-Namen im Satz lesen — nicht raten.
- Beim Installieren von Augmentations wird die Warteschlange geleert
  (`{ type: "ClearAll" }`, `src/PersonObjects/Player/PlayerObjectGeneralMethods.ts:113`).

**Empfehlung fuer die Nacht:** Popup-Weg als Regelfall, `Join!` auf der
Factions-Seite als Nachzuegler-Weg mit echtem CDP-Klick. Beides einbauen.

### 3.3 Offene Einladungen zuverlaessig auslesen

Die Factions-Seite hat **echte, feste Klassennamen** — keine generierten:

| Marker | Inhalt | Fundstelle |
|---|---|---|
| `span.factions-invites` | Block `Faction Invitations` mit allen offenen Einladungen | `src/Faction/ui/FactionsRoot.tsx:265` |
| `span.factions-joined` | `Your Gang` (falls vorhanden) und `Your Factions` | `:280` |
| `span.factions-rumors` | `Rumors` | `:312` |

Das ist der stabilste Zugriff auf der ganzen Seite. Der Automat liest die
Faktionsnamen aus `span.factions-invites` und weiss damit genau, was offen ist.

Ueberschriften auf der Seite:

| Text | Variante | Bedingung | Zeile |
|---|---|---|---|
| `Factions` | h4 | immer | `:236` |
| `Faction Invitations` | h5 | nur bei offenen Einladungen | `:269` |
| `Your Gang` | h5 | nur mit Gang | `:284` |
| `Your Factions` | h5 | immer | `:292` |
| `Share RAM` | h5 | immer | `:308` |
| `Rumors` | h5 | nur wenn vorhanden | `:316` |

Ohne Mitgliedschaft steht unter `Your Factions` der Satz
`You have not yet joined any Factions.` (`:301`).

**Der rote Zaehler an der Seitenleiste taugt nicht.** Er zaehlt nur *ungesehene*
Einladungen (`src/Sidebar/ui/SidebarRoot.tsx:153`, `InvitationsSeen`) und
verschwindet, sobald die Factions-Seite einmal offen war — die Einladung bleibt
aber bestehen.

### 3.4 Erfolg erkennen

Die Karte wandert von `span.factions-invites` nach `span.factions-joined`,
`Join!` wird durch `Details` und `Augments` ersetzt, und rechts erscheinen zwei
Zeilen `0 favor` und `0 rep` (`FactionsRoot.tsx:205-212`). Sind alle Einladungen
abgearbeitet, ist `span.factions-invites` leer und die Ueberschrift
`Faction Invitations` verschwindet.

---

## 4. FAKTIONSARBEIT starten und beenden

### 4.1 Starten — kein `isTrusted`, kein Bestaetigungsdialog

Weg: `Alt+F` -> `Details` bei der Faktion -> Knopf `Hacking Contracts`.
(Der Faktionsname selbst ist kein Knopf, nur Text.)

Seite `src/Faction/ui/FactionRoot.tsx`, Reihenfolge im DOM:

1. Knopf `Back` (`:108`)
2. h4 mit dem Faktionsnamen (`:109-111`)
3. Infoblock (`src/Faction/ui/Info.tsx`) mit Reputation und Favor
4. Erklaerungsabsatz, beginnt mit
   `Perform work/carry out assignments for your faction to help further its cause!` (`:116-123`)
5. Arbeitsknoepfe, je nach Angebot der Faktion:
   - `Hacking Contracts` (`:125-131`, nur bei `offerHackingWork`)
   - `Field Work` (`:132-134`, nur bei `offerFieldWork`)
   - `Security Work` (`:135-141`, nur bei `offerSecurityWork`)
6. Spendenbereich (nur bei `offersWork()`, `:142-144`)
7. Knopf `Purchase Augmentations` (`:147`)

Jeder dieser Knoepfe ist ein schlichtes MUI-`<Button>` mit dem Text als Inhalt
(`src/Faction/ui/Option.tsx:22`). Darunter steht jeweils ein Erklaertext, der
sich ebenfalls als Anker eignet, etwa
`Complete hacking contracts for your faction. ...` (`FactionRoot.tsx:30-34`).

Bietet eine Faktion eine Arbeitsart nicht an, **fehlt der Knopf ganz** — er ist
nicht disabled. Bei der eigenen Gang-Faktion fallen alle Arbeitsknoepfe und die
Spende weg (`:99, :113`); es bleiben `Back`, Info und `Purchase Augmentations`.

Ist man nicht Mitglied, zeigt die Seite nur `You have not joined <Name> yet!`
und den Knopf `Back to Factions` (`:155-164`).

Nach dem Klick (`:75-84`): `Player.startWork(...)`, `Player.startFocusing()`,
`Router.toPage(Page.Work)`. **Kein Bestaetigungsdialog**, auch nicht, wenn schon
eine andere Arbeit lief — die wird stillschweigend ersetzt.

Keine der drei Funktionen prueft `isTrusted` (bestaetigt durch das Inventar in
0.1). Synthetische Klicks reichen.

### 4.2 Die laufende Arbeit erkennen

Seite `src/ui/WorkInProgressRoot.tsx`, Faction-Zweig ab `:356`.

- h6-Titel: `You are currently carrying out hacking contracts for <Name>`
  (Vorlage `:389-393`). Die Mitte ist eine von drei Zeichenketten (`:372-374`):
  - `carrying out hacking contracts` (hacking)
  - `carrying out field missions` (field)
  - `performing security detail` (security)
- darunter `Current Faction Reputation: <Wert> (<Rate>)` (`:395-400`)
- Tabelle mit `Hacking Exp`, `Strength Exp`, ... jeweils `X / sec`
- Fortschritt: nur `1 minutes 12 seconds elapsed` (`:510`), **kein**
  Prozentbalken — Faktionsarbeit hat keine feste Dauer.

### 4.3 Beenden — zwei Knoepfe mit sehr verschiedener Wirkung

| Text | Wirkung | Fundstelle |
|---|---|---|
| `Stop Faction work` | beendet die Arbeit wirklich (`Player.finishWork(true)`) und springt auf die Faktionsseite | `:406` (Text), `:381-384` (Handler), gerendert `:528`/`:531` |
| `Do something else simultaneously` | beendet **nichts**. Springt nur auf die Faktionsseite; `GameRoot` ruft dabei `Player.stopFocusing()` (`src/ui/GameRoot.tsx:273-274`). Die Arbeit laeuft **unfokussiert mit Abschlag weiter** | `:534` (Text), `:385-387` (Handler) |

**Fuer den Nachtlauf ist `Do something else simultaneously` der richtige Knopf.**
Solange `Player.currentWork && Player.focus` gilt, sind naemlich **alle
Navigations-Hotkeys gesperrt** (`src/Sidebar/ui/SidebarRoot.tsx:290`). Einmal
Arbeit starten, dann Fokus loesen — danach ist die Oberflaeche wieder bedienbar
und die Reputation laeuft trotzdem.

Der Stop-Text ist arbeitsartabhaengig. In derselben Datei stehen
`Stop committing crime` (`:245`), `Stop training at gym` (`:254`),
`Stop taking course` (`:256`), `Stop creating program` (`:317`),
`Stop grafting` (`:347`) und `Stop working` (`:468`, das ist **Firmenarbeit**).
Wer blind nach `Stop working` sucht, findet die Faktionsarbeit nicht.

Wer nur die Seite wechselt (Hotkey), beendet die Arbeit ebenfalls nicht —
`GameRoot.tsx:273-274` loest nur den Fokus.

### 4.4 Erfolg messen

Reputation ist im DOM nur auf 3 Nachkommastellen mit Suffix formatiert
(`formatReputation = formatBigNumber`, `src/ui/formatNumber.ts:181, 168`), also
z. B. `62.500k`. Fuer eine genaue Zahl siehe Abschnitt 10.

---

## 5. AUGMENTATIONS kaufen

### 5.1 Weg und Seitenaufbau

`Alt+F` -> `Augments` bei der Faktion (`FactionsRoot.tsx:118`) **oder**
`Details` -> `Purchase Augmentations` (`FactionRoot.tsx:147`). Beides landet auf
`src/Faction/ui/AugmentationsPage.tsx`.

Kopfbereich:

- Knopf `Back` (`:188`)
- h4 `Faction Augmentations - <Faktionsname>` (`:189`)
- Erklaerzeile
  `The price of every Augmentation increases for every queued Augmentation and it is reset when you install them.` (`:148-150`)
- `Price multiplier: x 1.900` — `Price multiplier:` fett, dann ` x `, dann die
  Zahl (`:154`)
- vier Sortierknoepfe: `Sort by Cost` (`:212`), `Sort by Reputation` (`:213-215`),
  `Sort by Default Order` (`:216-218`), `Sort by Purchasable` (`:219-221`)
- Filterfeld mit `placeholder="Filter augmentations"` und `autoFocus`
  (`:223-233`), filtert ueber Name, Info und Stats (`:28-38`)

**Es gibt keinen "Buy all"-Knopf.** Jede Aug einzeln.

Fuer den Automaten ist das Filterfeld das beste Werkzeug: Namen eintippen, dann
bleibt genau eine Zeile stehen, und der Buy-Knopf ist eindeutig.

### 5.2 Der Kaufknopf

`src/Augmentation/ui/PurchasableAugmentations.tsx:194-204`. Ein Text-Knopf, kein
Icon, ohne eigenen Tooltip:

```jsx
<Button
  onClick={...}
  disabled={!props.parent.canPurchase(aug) || props.owned}
  sx={{ width: "48px", height: "36px", ... }}
>
  {props.owned ? "Owned" : "Buy"}
</Button>
```

Beschriftung also exakt **`Buy`** oder **`Owned`**. Der Tooltip in der Zeile
haengt am Aug-**Namen**, nicht am Knopf (`:207-232`).

`canPurchase` ist (`AugmentationsPage.tsx:240-247`):

```js
hasAugmentationPrereqs(aug) &&
faction.playerReputation >= costs.repCost &&
(costs.moneyCost === 0 || Player.money >= costs.moneyCost)
```

**Kein `isTrusted`** — bestaetigt durch das Inventar in 0.1.

### 5.3 Die vier Zustaende im DOM unterscheiden

Die Liste wird in zwei Toepfe geteilt (`AugmentationsPage.tsx:137-142`):
`purchasable` (NeuroFlux immer, sonst alles, was weder installiert noch in der
Warteschlange steht) und `owned` (alles andere).

| Zustand | Sichtbar | Knopf |
|---|---|---|
| **installiert** | Zeile im `owned`-Topf, `opacity: 0.75` (`PurchasableAugmentations.tsx:188`), **Geld- und Rep-Zeile fehlen komplett** (`:240`: `props.owned \|\| (...)`) | `Owned`, disabled |
| **gekauft, noch nicht installiert** | **exakt gleich** wie installiert — derselbe Topf, dieselbe Beschriftung. Es gibt **keine** eigene Zeichenkette "Purchased" | `Owned`, disabled |
| **zu wenig Rep** | Zeile im `purchasable`-Topf. Rep-Anforderung als `Requirement` mit `<CheckBoxOutlineBlank>`-Icon in Fehlerfarbe, Text `62.500k rep` (`:248-255`). Aug-Name in `Settings.theme.disabled` (`:226`) | `Buy`, disabled |
| **zu wenig Geld** | dito, aber die Geldzeile hat das leere Kaestchen (`:242-247`) | `Buy`, disabled |
| **Voraussetzungs-Augs fehlen** | `PreReqs`-Tooltip mit `Missing N pre-requisite(s)` bzw. `Pre-requisites Owned` (`:24-71`) | `Buy`, disabled |

Erfuellt/nicht erfuellt unterscheidet nur das Icon (`<CheckBox>` gegen
`<CheckBoxOutlineBlank>`, `src/ui/Components/Requirement.tsx:21`) und die Farbe.
**Es gibt keinen erklaerenden Text am Knopf.**

**Praktische Regel fuer den Automaten:**

- `Owned` vs. `Buy` am Knopftext.
- kaufbar vs. gesperrt am `disabled`-Attribut, **nicht** am Text.
- installiert vs. nur gekauft geht aus dieser Seite **gar nicht** hervor. Dafuer
  die Augmentations-Seite (`Alt+A`) nehmen: dort listet
  `src/Augmentation/ui/PurchasedAugmentations.tsx` genau die Warteschlange.

Sonderfall **NeuroFlux Governor**: bleibt immer im `purchasable`-Topf
(`AugmentationsPage.tsx:139`), zeigt also dauerhaft `Buy`. Der angezeigte Level
ist der **naechste**, nicht der aktuelle (`PurchasableAugmentations.tsx:213, 230`
rendern `augLevel + 1`).

### 5.4 Bestaetigungsdialog

Wird nur gezeigt, wenn `Suppress augmentations confirmation` **aus** ist. Sonst
kauft der Klick sofort (`AugmentationsPage.tsx:248-255`), und die Modal-Komponente
wird gar nicht erst eingehaengt (`PurchasableAugmentations.tsx:259`).

`src/Augmentation/ui/PurchaseAugmentationModal.tsx`:

- h4 mit dem reinen Aug-Namen (`:27`)
- Info- und Stats-Text
- `Would you like to purchase the <Name> Augmentation for $70.000m?` (`:35-36`)
- **ein einziger Knopf: `Purchase`** (`:47`, mit `autoFocus`)
- **kein Cancel** — Abbruch nur ueber X, Escape oder Hintergrundklick

Erfolgsmeldung danach (`src/Faction/FactionHelpers.tsx:122-128`, ebenfalls nur
ohne den Suppress-Schalter):

> `You purchased <Name>. Its enhancements will not take effect until they are installed. To install your augmentations, go to the 'Augmentations' tab on the left-hand navigation menu. Purchasing additional augmentations will now be more expensive.`

Diese Meldung hat **keinen OK-Knopf** (siehe 0.3) — `Escape`.

Fehlermeldungen als Dialog (`FactionHelpers.tsx:60-107`), u. a.:
`You don't have enough money to purchase <Name>.`,
`You don't have enough faction reputation to purchase <Name>.`,
`You already purchased the '<Name>' augmentation.`,
`You must first purchase or install <A>,<B> before you can purchase this one.`

### 5.5 Preissteigerung — die genaue Formel

Das ist die Frage, die im Betrieb am meisten kostet. Antwort:

**Geld skaliert. Reputation skaliert nicht** (ausser bei zwei Sonderfaellen).

Grundmultiplikator (`src/Augmentation/AugmentationHelpers.ts:29-31`):

```js
CONSTANTS.MultipleAugMultiplier * [1, 0.96, 0.94, 0.93][Player.activeSourceFileLvl(11)]
```

`MultipleAugMultiplier = 1.9` (`src/Constants.ts:41`). Ohne Source File 11 ist
der Grundmultiplikator also **1,9**; mit SF11 Stufe 1/2/3 sind es 1,824 / 1,786 / 1,767.

Exponent ist die Anzahl der **gekauften, noch nicht installierten** Augmentations
ohne die SoA-Augs (`AugmentationHelpers.ts:32-37`):

```js
Math.pow(getBaseAugmentationPriceMultiplier(), queuedNonSoAAugmentationList.length)
```

**Normale Augmentation, N-te im Durchgang (N = 1 bei leerer Warteschlange)**
(`AugmentationHelpers.ts:157-158`):

```
moneyCost(N) = baseCost * (1.9 * SF11-Faktor)^(N-1) * BitNode.AugmentationMoneyCost
repCost      = baseRepRequirement * BitNode.AugmentationRepCost        <- KEIN N
```

Die Rep-Anforderung steht in `:158` ohne den Multiplikator. **Beleg dafuer, dass
Rep nicht mitwaechst:** `getGenericAugmentationPriceMultiplier()` taucht in der
ganzen Funktion nur in Zeile `:157` (normal) und `:137` (NeuroFlux) auf — beide
Male auf der Geldzeile, nie auf einer Rep-Zeile.

**NeuroFlux Governor** (`AugmentationHelpers.ts:133-139`) — der einzige Fall, in
dem Reputation mitwaechst, und der einzige mit **doppelter** Geldskalierung:

```
mult          = 1.14^L                       (L = getLevel(), CONSTANTS.NeuroFluxGovernorLevelMult, src/Constants.ts:36)
repCost(L)    = 500    * mult * BitNode.AugmentationRepCost
moneyCost(L)  = 750e3  * mult * BitNode.AugmentationMoneyCost * (1.9*SF11)^(Warteschlange ohne SoA)
```

Basiswerte `baseRepRequirement = 500`, `baseCost = 750e3`
(`src/Augmentation/Augmentations.ts:1160-1161`, vom Subagenten belegt,
**von mir nicht gegengelesen**). `getLevel()` ist besessene Stufe plus Anzahl der
in der Warteschlange stehenden NFG-Eintraege (`src/Augmentation/Augmentation.ts:237-250`);
NFG wird pro Stufe einmal eingereiht.

**Shadows-of-Anarchy-Augs** (`AugmentationHelpers.ts:141-154`) — hier skaliert
Rep, aber nach einer eigenen Regel und **ohne** BitNode-Multiplikator:

```
n            = Anzahl bereits besessener SoA-Augs (queued zaehlt sofort mit)
moneyCost    = baseCost * 7^n              (CONSTANTS.SoACostMult = 7,   src/Constants.ts:100)
repCost      = baseRepRequirement * 1.3^n  (CONSTANTS.SoARepMult = 1.3,  src/Constants.ts:101)
```

Der SoA-Multiplikator wird beim Installieren **nicht** zurueckgesetzt — das sagt
die Seite selbst: `The multiplier is NOT reset when installing augmentations.`
(`AugmentationsPage.tsx:158-163`). SoA-Augs zaehlen ausserdem **nicht** in den
Exponenten der normalen Augs (`AugmentationHelpers.ts:33-35`).

**Konsequenz fuer die Einkaufsreihenfolge:** Weil der Multiplikator auf alles
Folgende wirkt, kauft man **absteigend nach Grundpreis** — teuerste zuerst. Wer
umgekehrt vorgeht, zahlt fuer die teuerste Aug den hoechsten Multiplikator.

### 5.6 Erfolg erkennen

Unabhaengig von Dialogen: Der Knopf wechselt von `Buy` auf `Owned`, die Geld- und
Rep-Zeile der Zeile verschwindet, `Price multiplier:` steigt, und der rote
Zaehler am Seitenleisteneintrag `Augmentations` zaehlt hoch
(`src/Sidebar/ui/SidebarRoot.tsx:152`, `Player.queuedAugmentations.length`).

Zwei Betriebshinweise:

- Die Zeilen haben `minWidth: "1100px"` (`PurchasableAugmentations.tsx:189`). In
  einem schmalen Fenster muss waagerecht gescrollt werden, um den Knopf zu
  treffen. Fenster breit genug aufziehen.
- Die Seite rendert sich alle 400 ms neu (`AugmentationsPage.tsx:23`), die Zeilen
  alle 600 ms (`PurchasableAugmentations.tsx:157`). Elementreferenzen werden
  stale — **vor jedem Klick neu suchen**.

---

## 6. AUGMENTATIONS installieren (= Reset)

Die riskanteste Aktion der Nacht. Deshalb hier alles aus dem Quellcode belegt.

### 6.1 Knopf und Dialog

Weg: `Alt+A` (Augmentations).

Seite `src/Augmentation/ui/AugmentationsRoot.tsx`:

- h4 `Augmentations` (`:110`)
- h5 `Purchased Augmentations` (`:114`) mit Info-Icon; dessen Tooltip
  (`:115-143`) endet mit dem Satz
  `...you will keep any scripts and RAM/Core upgrades on your home computer (but you will lose all programs besides NUKE.exe)`
- Knopf **`Install Augmentations`** (`:171-177`) — statischer Text, **ohne** Zahl
  in Klammern. `disabled`, solange `Player.queuedAugmentations.length === 0`.
  Tooltip: `'I never asked for this'` (mit den einfachen Anfuehrungszeichen)
- daneben `Backup Save (+1 favor to all factions)` bzw. nur `Backup Save`
  (`:95-98, :179-181`)
- ohne gekaufte Augs: `No Augmentations have been purchased yet` (`:192`)

**Kein `isTrusted`** — bestaetigt durch das Inventar in 0.1.

Bestaetigungsdialog (`src/ui/React/ConfirmationModal.tsx`, aufgerufen
`AugmentationsRoot.tsx:100-106, 149-168`), nur wenn
`Suppress augmentations confirmation` aus ist. **Ohne Titel**, Text:

```
Installing will reset

- money
- skill / experience
- every server except home
- factions and reputation
- current work activity

You will keep:

- All scripts on home
- home ram and cores

It is recommended to install several Augmentations at once.
```

**Ein einziger Knopf: `Confirm`** (`ConfirmationModal.tsx:25`). **Kein Cancel** —
Abbruch nur ueber X / Escape / Hintergrund.

Es gibt **kein eigenes Setting** fuers Installieren: derselbe Schalter
`Suppress augmentations confirmation` steuert Kauf und Installation.

Nicht verwechseln mit `Soft Reset` (`src/ui/React/SoftResetButton.tsx:45-47`,
in den Options und auf der Recovery-Seite). Der ruft `installAugmentations(true)`
**erzwungen** auf, auch ohne gekaufte Augs — und hat als einziger dieser Dialoge
tatsaechlich einen `Cancel`-Knopf (`:54`). Fuer den Automaten: Finger weg.

### 6.2 Ablauf nach dem Klick

`src/Augmentation/AugmentationHelpers.ts:69-115`:

1. `:70-73` leere Warteschlange und nicht erzwungen -> Meldung
   `You have not purchased any Augmentations to install!`, Abbruch
2. `:76` **`prestigeWorkerScripts()` — alle laufenden Skripte werden gekillt,
   noch bevor irgendetwas anderes passiert**
3. `:86-102` jede Aug anwenden, `:103` Warteschlange leeren
4. `:104-111` Meldung
   `You slowly drift to sleep as scientists put you under in order to install the following Augmentations:` + Liste + `You wake up in your home...you feel different...`
   (wieder ohne OK-Knopf)
5. `:112` `prestigeAugmentation()`
6. `:113` `Router.toPage(Page.Terminal)`

**Die Seite laedt nicht neu.** In `src/Prestige.ts`, `src/Augmentation/` und
`src/ui/GameRoot.tsx` gibt es kein `location.reload()`. Es ist ein reiner
React-Zustandswechsel, der auf der Terminal-Seite endet. Der DOM bleibt stehen,
die Fernsteuerung verliert ihre Verbindung nicht.

### 6.3 Was verloren geht

`src/Prestige.ts:55-200` und
`src/PersonObjects/Player/PlayerObjectGeneralMethods.ts:80-141`.

| Verloren | Beleg |
|---|---|
| alle Skills auf 1, alle Exp auf 0 | `PlayerObjectGeneralMethods.ts:85-100` |
| **Geld -> genau 1262** (`1000 + CONSTANTS.Donations`, `Donations: 262`) | `PlayerObjectGeneralMethods.ts:102`, `src/Constants.ts:107` |
| **gekaufte Server** — Liste geleert, alle Server ausser home geloescht | `PlayerObjectGeneralMethods.ts:109`, `Prestige.ts:74` |
| **alle Programme auf home** — `programs.length = 0`, danach nur `NUKE.exe` wieder eingesetzt (plus `b1t_flum3.exe`, falls vorher da) | `src/Server/ServerHelpers.ts:224-234` |
| `.lit`/`.msg`-Dateien auf home | `src/Server/ServerHelpers.ts:236-237` |
| **Faktionsmitgliedschaft und Einladungen** (ausser Faktionen mit `keepOnInstall`) | `PlayerObjectGeneralMethods.ts:111-112`, gerettete Menge `Prestige.ts:62-67`, zurueckgesetzt `:121-124` |
| **Faktions-Reputation -> 0**, dafuer wird Favor gutgeschrieben | `src/Faction/Faction.ts` (`prestigeAugmentation`), aufgerufen `Prestige.ts:106` |
| Firmen-Reputation -> 0, Favor gutgeschrieben | `Prestige.ts:105` |
| Jobs | `PlayerObjectGeneralMethods.ts:107` |
| **Hacknet-Knoten** komplett, Hash-Manager zurueckgesetzt | `PlayerObjectGeneralMethods.ts:130-131` |
| Warteschlange der Augs | `PlayerObjectGeneralMethods.ts:116`, `AugmentationHelpers.ts:103` |
| Aktien (Markt wird neu aufgesetzt) | `Prestige.ts:169-172` |
| laufende Arbeit | `PlayerObjectGeneralMethods.ts:137` |
| Stadt -> `Sector-12`, Ort -> Travel Agency | `PlayerObjectGeneralMethods.ts:104-105` |
| `numPeopleKilled` -> 0 | `PlayerObjectGeneralMethods.ts:83` |
| Terminal-Inhalt und laufende Terminalaktion | `Prestige.ts:109-112` |
| offene Einladungs-Popups | `PlayerObjectGeneralMethods.ts:113` (`ClearAll`) |

### 6.4 Was bleibt

| Bleibt | Beleg |
|---|---|
| **alle Skriptdateien auf home** — `prestigeHomeComputer` fasst `homeComp.scripts` nicht an; nur `runningScriptMap` wird geleert (und das nur in einem Fehlerzweig) | `src/Server/ServerHelpers.ts:224-256` |
| **home-RAM und home-Kerne** — `maxRam`/`cpuCores` werden nirgends beruehrt. Gegenprobe: `prestigeSourceFile` setzt sie sehr wohl zurueck (`Prestige.ts:246-253`) | `ServerHelpers.ts:224-257` |
| das home-Serverobjekt selbst (dieselbe Instanz wird gemerkt und wieder eingehaengt) | `Prestige.ts:72, 79` |
| **Karma** — wird nur in `prestigeSourceFile` zurueckgesetzt (`PlayerObjectGeneralMethods.ts:146`), nicht in `prestigeAugmentation` | Abwesenheit in `:80-141` |
| installierte Augmentations und Source Files (werden neu angewandt) | `Prestige.ts:125-126` |
| Sleeves (nur synchronisiert/Shock-Recovery, nicht geloescht) | `PlayerObjectGeneralMethods.ts:118-120` |
| Gang (Gang-Faktion wird automatisch wieder betreten) | `Prestige.ts:133-147` |
| Corporation (in `prestigeAugmentation` gar nicht erwaehnt) | Abwesenheit in `Prestige.ts:55-200` |
| Bladeburner (nur die laufende Aktion wird abgebrochen) | `Prestige.ts:156-158` |
| Stanek's Gift | `Prestige.ts:128` |
| Entropy aus Grafting (wird neu angewandt) | `Prestige.ts:131` |
| BitNode-Multiplikatoren (neu initialisiert, gleicher BitNode) | `Prestige.ts:59` |
| `Formulas.exe`, falls BitNode-Feature 5 zugaenglich | `Prestige.ts:93-95` |
| Startgeld und Startprogramme aus installierten Augs — **oben auf** die 1262 | `Prestige.ts:86-92` |

### 6.5 Die drei Punkte, an denen der Nachtlauf hier sterben kann

1. **Alle Skripte sind tot.** `prestigeWorkerScripts()` laeuft zweimal
   (`AugmentationHelpers.ts:76` und `Prestige.ts:57`). Die **Dateien** liegen
   noch auf home, aber es laeuft nichts mehr. Der Automat muss nach dem Install
   **selbst wieder `run <skript>` im Terminal absetzen** (oder die RFA-Bruecke
   neu ausspielen lassen). Ohne diesen Schritt steht das Spiel bis zum Morgen
   still.
2. **Alle Programme ausser `NUKE.exe` sind weg.** BruteSSH, FTPCrack und der
   ganze Rest muessen neu gekauft werden — und zwar mit 1262 $ Startkapital.
   Der TOR-Router bleibt allerdings erhalten
   (`hasTorRouter` haengt an der home-Netzverbindung, die in
   `prestigeHomeComputer` mit `serversOnNetwork = []` geleert und in
   `initForeignServers` neu aufgebaut wird). **UNSICHER** — das habe ich nicht
   bis zum Ende verfolgt. Der Automat sollte nach dem Install `buy -l` absetzen:
   kommt die TOR-Fehlermeldung, muss der Router neu gekauft werden.
3. **Alle gekauften Server sind weg.** Jede Skript-Verteilung, die von
   pserv-Namen ausgeht, muss nach dem Install neu aufgebaut werden.

---

## 7. REISEN in eine andere Stadt

Weg: `Alt+R` (Travel) -> Knopf `Travel to <Stadt>` -> ggf. `Travel`.
Alternativ ueber die City-Seite den Ort `Travel Agency` — landet auf derselben
Seite (`src/Locations/ui/City.tsx:37-39`).

Seite `src/Locations/ui/TravelAgencyRoot.tsx`:

- h4 `Travel Agency` (`:55`)
- `From Sector-12, you can travel to any other city! A ticket costs $200.000k.`
  (`:57-60`)

Zielauswahl haengt an `Disable ASCII art` (`:61`):

- **Schalter an (empfohlen):** echte Knoepfe `Travel to Aevum`,
  `Travel to Chongqing`, `Travel to Sector-12`, `Travel to New Tokyo`,
  `Travel to Ishima`, `Travel to Volhaven` (`:70-72`). Die **eigene** Stadt
  fehlt in der Liste (`:64`).
- **Schalter aus (Vorgabe):** ASCII-Weltkarte, klickbar ist nur der erste
  Buchstabe der Stadt in einem `<span>` (`src/ui/React/WorldMap.tsx:34`). Fuer
  einen Automaten unangenehm.

Stadtnamen exakt: `Aevum`, `Chongqing`, `Sector-12`, `New Tokyo`, `Ishima`,
`Volhaven` (Bindestrich bei Sector-12, Leerzeichen bei New Tokyo).

**Kosten:** 200.000 $ (`CONSTANTS.TravelCost = 200e3`, `src/Constants.ts:28`).

**Bestaetigungsdialog** (`src/Locations/ui/TravelConfirmationModal.tsx`), nur
ohne `Suppress travel confirmations`:

- `Would you like to travel to Aevum? The trip will cost $200.000k.` (`:23-26`)
- Knopf `Travel` (`:29-31`), Knopf `Cancel` (`:32`)
- **kein `isTrusted`** in der Kette

**Zu wenig Geld: stiller Fehlschlag.** `startTravel` prueft
`Player.canAfford(CONSTANTS.TravelCost)` und macht sonst ein blankes `return`
(`TravelAgencyRoot.tsx:41-44`); auch `Person.travel` liefert nur `false`
(`src/PersonObjects/Person.ts:243-246`). **Kein Dialog, keine Meldung, der Knopf
ist nicht einmal disabled.** Der Automat muss den Kontostand **vorher** pruefen,
sonst haelt er einen Fehlschlag fuer Erfolg.

**Erfolg erkennen** — der verlaesslichste Weg ist Nummer 2, weil er nicht am
Suppress-Schalter haengt:

1. Dialog `You are now in Aevum!` (`TravelAgencyRoot.tsx:31`) — entfaellt bei
   gesetztem Suppress-Schalter
2. die Seite wechselt auf `City` (`:33`), und dort steht der Stadtname als eigene
   Zeile: `<Typography>{city.name}</Typography>`
   (`src/Locations/ui/City.tsx:154`)
3. der Einleitungssatz auf der Reiseseite beginnt danach mit `From Aevum,`

Die Stadt steht **nicht** in der Uebersicht links.

---

## 8. PROGRAMME selbst erstellen

Weg: `Alt+P` (Create Program).

Seite `src/Programs/ui/ProgramsRoot.tsx`:

- h4 **`Create program`** (`:63`, klein geschriebenes "program")
- Erklaerabsatz
  `This page displays any programs that you are able to create. ...` (`:64-68`)
- ein Kachelraster mit drei Spalten (`:70`), je Programm eine Kachel mit
  h6-Ueberschrift = Programmname plus Icon (`:84-88`)

### 8.1 Die Knoepfe — beide mit `isTrusted`

| Text | Wann | Fundstelle | isTrusted |
|---|---|---|---|
| `Create program` | Programm noch nicht vorhanden, Voraussetzung erfuellt, wird gerade nicht geschrieben | `:117` | **ja**, `:108` |
| `Resume focus` | dasselbe Programm wird gerade geschrieben | `:101` | **ja**, `:96` |

Beide Knoepfe brauchen also einen echten CDP-Klick. Das ist neben `Join!` die
zweite Stelle im Nachtlauf, an der ein `element.click()` kommentarlos versagt.

Klickfolge (`:107-115`): laufende Programmarbeit beenden, `Player.startWork(new CreateProgramWork(...))`,
`Player.startFocusing()`, `Router.toPage(Page.Work)`. Kein Bestaetigungsdialog.

### 8.2 Vorbedingungen

Der Knopf wird nur gerendert, wenn `!Player.hasProgram(name) && create.req()`
(`:89-90`). `create.req()` ist bei allen kaufbaren Programmen
`requireHackingLevel(lvl)` (`src/Programs/Programs.ts:20-23`):

```js
Player.skills.hacking >= getEffectiveHackingLevelRequirement(lvl)
// getEffectiveHackingLevelRequirement(level) = clampNumber(level - Player.skills.intelligence / 2, 1)   :26-28
```

Die Intelligenz senkt die Schwelle also um die Haelfte ihres Werts.

| Programm | Grundschwelle | Fundstelle |
|---|---|---|
| `NUKE.exe` | 1 | `src/Programs/Programs.ts:52-54` |
| `AutoLink.exe` | 25 | `:282-284` |
| `BruteSSH.exe` | 50 | `:82-84` |
| `DeepscanV1.exe` | 75 | `:206-208` |
| `ServerProfiler.exe` | 75 | `:233-235` |
| `FTPCrack.exe` | 100 | `:107-109` |
| `relaySMTP.exe` | 250 | `:132-134` |
| `DeepscanV2.exe` | 400 | `:219-221` |
| `HTTPWorm.exe` | 500 | `:157-159` |
| `SQLInject.exe` | 750 | `:184-186` |
| `Formulas.exe` | 1000 | `:296-298` |

Ist die Schwelle nicht erreicht, steht statt des Knopfes
`Unlocks at hacking level: <Zahl>` mit dem Tooltip
`Unlocks after you gain N more hacking levels` (`:120-126`).

Bei angefangenen Programmen steht `Current completion: 42.13%` (`:127-138`).

**Abwaegung:** Kaufen im Darkweb ist fuer den Automaten der bessere Weg, weil er
ohne trusted Klicks auskommt und kein Hacking-Level braucht. Selberschreiben
lohnt nur, wenn kein Geld da ist — etwa direkt nach einem Install.

Abbrechen: auf der Work-Seite der Knopf `Stop creating program`
(`src/ui/WorkInProgressRoot.tsx:317`).

---

## 9. Welcher Bildschirm ist offen?

### 9.1 Kurze Antwort: es gibt kein DOM-Merkmal fuer die Seite

Die aktuelle Seite lebt ausschliesslich im React-Zustand von `GameRoot`
(`src/ui/GameRoot.tsx:196-206`, `pageWithContext`). Der `switch` ab
`src/ui/GameRoot.tsx:308` haengt die passende Komponente in ein
`<Box className={classes.root}>` (`:551` bzw. `:554`) — **ohne** ID, ohne
`data-`-Attribut, ohne sprechenden Klassennamen. Es gibt keinen Router mit URL,
kein `location.hash`, nichts.

Der Seitenname existiert im Code als Enum
(`src/ui/Enums.ts:13-59`, `SimplePage`/`ComplexPage`), aber der Wert landet
nirgends im DOM.

### 9.2 Praktischer Weg: Inhaltsmarker

Die verlaesslichsten Marker je Seite:

| Seite | Marker | Fundstelle |
|---|---|---|
| Terminal | `ul#terminal` **und** `input#terminal-input` | `src/Terminal/ui/TerminalRoot.tsx:85`, `src/Terminal/ui/TerminalInput.tsx:450` |
| Factions | h4-Text `Factions` **und** `span.factions-joined` | `src/Faction/ui/FactionsRoot.tsx:236, 280` |
| Faction (einzeln) | Knopf `Back` **und** Knopf `Purchase Augmentations` | `src/Faction/ui/FactionRoot.tsx:108, 147` |
| Faction Augmentations | h4 beginnt mit `Faction Augmentations - ` | `src/Faction/ui/AugmentationsPage.tsx:189` |
| Augmentations | h4 `Augmentations` **und** h5 `Purchased Augmentations` | `src/Augmentation/ui/AugmentationsRoot.tsx:110, 114` |
| Create Program | h4 `Create program` | `src/Programs/ui/ProgramsRoot.tsx:63` |
| Travel | h4 `Travel Agency` | `src/Locations/ui/TravelAgencyRoot.tsx:55` |
| City | erste Zeile ist der reine Stadtname | `src/Locations/ui/City.tsx:154` |
| Work | Knopf `Do something else simultaneously` oder ein Text, der mit `Stop ` beginnt | `src/ui/WorkInProgressRoot.tsx:534, 528/531` |
| Hacknet | h4 `Hacknet Nodes` bzw. `Hacknet Servers` | `src/Hacknet/ui/HacknetRoot.tsx:102` |
| Location (Ort in der Stadt) | Knopf `Return to World` | `src/Locations/ui/GenericLocation.tsx:116` |
| BitVerse | **keine Seitenleiste** (`withSidebar = false`, `src/ui/GameRoot.tsx:315-317`) | — |

**Falle:** Die h4 auf der Location-Seite ist der Ortsname, und der laeuft durch
`CorruptibleText`, sobald der zugehoerige Server eine Backdoor hat
(`src/Locations/ui/GenericLocation.tsx:117-127`). Dann tauscht das Spiel im
Sekundentakt zufaellige Zeichen aus. Deshalb `Disable text effects` einschalten
und am Knopf `Return to World` festmachen, nicht an der Ueberschrift.

### 9.3 Zwei Wege, die theoretisch praeziser waeren

**a) Der `active`-Klassenname der Seitenleiste.** `SidebarItem` bekommt
`className={props.active ? props.classes.active : ""}`
(`src/Sidebar/ui/SidebarItem.tsx:33`); die Regel kommt aus `makeStyles` von
`tss-react` (`src/Sidebar/ui/SidebarRoot.tsx:119`). tss-react erzeugt
Klassennamen normalerweise in der Form `tss-<hash>-<regelname>`, ein Selektor
`[class*="-active"]` waere also plausibel. **UNSICHER** — ich konnte das nicht
belegen, weil `node_modules` im Klon fehlt und kein gebautes Bundle vorliegt.
Einmal im laufenden Spiel nachsehen, dann ist es entweder ein sehr guter oder
ein wertloser Selektor. Zuordnung Seite -> Eintrag ist gegeben: `Factions` ist
aktiv fuer `[Page.Factions, Page.Faction]` (`SidebarRoot.tsx:377`), `City` fuer
`[Page.City, Page.Location]` (`:404`).

**b) React-Fiber.** Das Spiel benutzt React 17 mit dem alten
`ReactDOM.render(...)` in `#root` (`src/index.tsx:17-22`, React-Version
`package.json:42`). Damit haengt am Container ein `_reactRootContainer`, und
jeder DOM-Knoten traegt einen `__reactFiber$<zufall>`-Schluessel. Ueber den
Fiber-Baum kaeme man an den `useState`-Zustand von `GameRoot` und damit an
`pageWithContext.page` heran. Ausserdem liegen `React` und `ReactDOM` global
(`src/index.tsx:15-16`) — **auch im Produktionsbau**, das ist unbedingt.
**UNSICHER**: Ich habe den konkreten Pfad im Fiber-Baum nicht ermittelt und
halte ihn fuer brechbar bei jedem Spielupdate. Fuer den Nachtlauf empfehle ich
9.2 und, wo es um Zahlen geht, Abschnitt 10.

---

## 10. Maschinenlesbarer Spielerzustand

Kurzfassung: **Ja, es gibt einen exakten Weg — sogar zwei.** Drei Annahmen aus
der Aufgabenstellung muss ich dabei aber richtigstellen.

### 10.1 Drei Richtigstellungen vorweg

1. **Der Spielstand liegt nicht im `localStorage`, sondern in IndexedDB.**
   Datenbank `bitburnerSave`, Version `2`, Object Store `savestring`,
   Schluessel `save` (`src/db.ts:28, 36, 84, 120`). `localStorage` benutzt das
   Spiel fuer genau einen Zweck, und der ist irrelevant: den Schluessel
   `AutoExpandData` fuer den Zustand einer Klappliste im Dev-Menue
   (`src/ui/AutoExpand/AutoExpandContext.tsx:18`).
2. **Es ist kein lz-string und kein base64.** Der Normalfall ist **gzip** ueber
   die native `CompressionStream`-API, gespeichert als roher `Uint8Array`
   (`src/utils/SaveDataUtils.ts:18-21, 52-53`). Nur wenn der Browser
   `CompressionStream` nicht kennt, faellt das Spiel auf
   `btoa(unescape(encodeURIComponent(...)))` zurueck — dann base64, aber
   **unkomprimiert** (`:58`). Ein `grep` ueber den ganzen Baum nach `lz-string`,
   `compressToUTF16`, `compressToBase64` liefert null Treffer; die Bibliothek ist
   vor 3.0.1 herausgeflogen.
3. **`ns.getPlayer()` funktioniert ohne SF4.** Die Definition
   (`src/NetscriptFunctions.ts:1417-1436`) nimmt gar kein `ctx` entgegen und ruft
   deshalb auch kein `helpers.checkSingularityAccess`. RAM-Kosten 0,5 GB
   (`src/Netscript/RamCostGenerator.ts:650`: `SingularityFn1 / 4`, und
   `SingularityFn1 = 2`, `:55` — als **blanke Zahl**, nicht in `SF4Cost()`
   verpackt; genau das haelt sie billig und ungesperrt).

### 10.2 Weg A (beste Wahl): der RFA-Befehl `getSaveFile`

Das Projekt hat die RFA-Bruecke schon. Der Server-Handler
`getSaveFile` (`src/RemoteFileAPI/MessageHandlers.ts:223-251`) liefert auf
Zuruf den **kompletten, frisch erzeugten** Spielstand:

```json
{ "identifier": "<Player.identifier>", "binary": true, "save": "<...>" }
```

- `binary: true` heisst gzip. Weil sich ein `Uint8Array` nicht als JSON
  transportieren laesst, wird **jedes Byte einzeln in ein Zeichen umgewandelt**
  (`String.fromCharCode`, `:239-242`). Draussen also je Zeichen `charCodeAt(i)`
  nehmen, daraus ein `Uint8Array` bauen, dann gunzip.
- `binary: false` heisst: der Browser konnte kein `CompressionStream`, das Feld
  ist reines base64 (`:227-235`).
- **Nicht SF4-gesperrt, keine Spielerinteraktion, kein Autosave-Verzug** —
  `saveObject.getSaveData()` erzeugt den Stand in dem Moment neu
  (`src/SaveObject.ts:208-233`).

Voraussetzung: `RemoteFileApiPort` muss gesetzt sein. Vorgabe ist **`0`, also
aus** (`src/Settings/Settings.ts:47`), Adresse `localhost` (`:45`). Das Spiel
verbindet sich **aktiv nach draussen** zu deinem Server, 2 Sekunden nach dem
Laden der Seite (`src/index.tsx:37`, `src/RemoteFileAPI/Remote.ts:41-48`). Die
Portnummer 12525 ist reine Community-Konvention und steht **nirgends im
Quellcode**.

Weitere nuetzliche RFA-Befehle (`src/RemoteFileAPI/MessageHandlers.ts`):
`pushFile` (`:89`), `getFile` (`:100`), `getFileNames` (`:151`),
`getAllFiles` (`:163`), `getAllServers` (`:254`).

### 10.3 Weg B: IndexedDB direkt aus der Seite lesen

Wenn die Bruecke gerade nicht steht, geht es auch aus einer
`evaluate_script`-Auswertung heraus:

```
raw = IndexedDB["bitburnerSave" (Version 2)] -> Store "savestring" -> Key "save"

wenn raw ein Uint8Array ist (beginnt mit 1f 8b 08):
    json = gunzip(raw)                                  // DecompressionStream("gzip"), UTF-8
sonst (String):
    json = decodeURIComponent(escape(atob(raw)))

saveObj = JSON.parse(json)                              // {"ctor":"BitburnerSaveObject","data":{...}}
player  = JSON.parse(saveObj.data.PlayerSave)           // {"ctor":"PlayerObject","data":{...}}
felder  = player.data
```

Belege: Struktur `src/SaveObject.ts:191-233`, Praefixpruefung
`src/utils/SaveDataUtils.ts:45`, Dekodierung `src/utils/SaveDataUtils.ts:63-72`,
`PlayerObject.toJSON` `src/PersonObjects/Player/PlayerObject.ts:184-187`.
Eine fertige Lesehaelfte als Vorlage liegt im Repo: `electron/export.html:29-98`.

Wichtig: Die Datenbank **ohne** Versionsangabe oeffnen (`indexedDB.open("bitburnerSave")`),
sonst kann ein `onupgradeneeded` ausgeloest werden. Und: Wenn ein zweiter
Bitburner-Tab offen ist, blockiert das Oeffnen
(`src/db.ts` `onblocked`: `Database in use by another tab. Please close all other Bitburner tabs.`).

**Das ist der einzige Nachteil dieses Wegs: der Stand ist bis zu einem
Autosave-Intervall alt.** Vorgabe 60 Sekunden
(`Settings.AutosaveInterval = 60`, `src/Settings/Settings.ts:17`; Umsetzung
`src/engine.tsx:225-235`, `AutosaveInterval * 5` Spielzyklen a 200 ms).
Frischen Stand erzwingt der Speicherknopf in der Uebersicht
(`src/ui/GameRoot.tsx:444`) — oder man nimmt Weg A.

Alle 15 Felder des Spielstands (`src/SaveObject.ts:208-231`), jedes selbst ein
JSON-**String**, also doppelt zu parsen:

`PlayerSave`, `AllServersSave`, `CompaniesSave`, `FactionsSave`, `AliasesSave`,
`GlobalAliasesSave`, `StockMarketSave`, `SettingsSave`, `VersionSave`,
`LastExportBonus`, `StaneksGiftSave`, `GoSave`, `DarknetSave`,
`InfiltrationsSave`, `AllGangsSave` (nur mit Gang).

### 10.4 Was genau drinsteht — und wo

Fuer die Nacht sind fuenf Groessen wichtig. Hier steht jede:

| Gebraucht | Fundort im Spielstand | Beleg |
|---|---|---|
| Geld | `PlayerSave.data.money` | `src/PersonObjects/Player/PlayerObject.ts:56` |
| Hacking-Level | `PlayerSave.data.skills.hacking` | `src/PersonObjects/Person.ts:18-26` |
| Multiplikatoren | `PlayerSave.data.mults` | `src/PersonObjects/Person.ts:41` |
| installierte Augs | `PlayerSave.data.augmentations` (`[{name, level}]`) | `src/PersonObjects/Person.ts:44` |
| **gekaufte, noch nicht installierte Augs** | `PlayerSave.data.queuedAugmentations` | `src/PersonObjects/Person.ts:45` |
| beigetretene Faktionen | `PlayerSave.data.factions` | `src/PersonObjects/Player/PlayerObject.ts:43` |
| **offene Einladungen** | `PlayerSave.data.factionInvitations` | `src/PersonObjects/Player/PlayerObject.ts:44` |
| **Faktions-Reputation und Favor** | `FactionsSave["CyberSec"].playerReputation` / `.favor` | `src/Faction/Factions.ts:70-81` |
| Stadt | `PlayerSave.data.city` | `src/PersonObjects/Person.ts:48` |
| laufende Arbeit | `PlayerSave.data.currentWork`, `.focus` | `src/PersonObjects/Player/PlayerObject.ts:76-77` |
| Karma | `PlayerSave.data.karma` | `:53` |
| gekaufte Server | `PlayerSave.data.purchasedServers` | `:63` |
| Source Files | `PlayerSave.data.sourceFiles` | `:67` |
| BitNode | `PlayerSave.data.bitNodeN` | `:37` |

**Achtung bei `FactionsSave`:** Dort stehen **nur** `favor`, `playerReputation`
und `discovery`, und auch die nur, wenn mindestens einer der Werte ungleich Null
ist (`src/Faction/Factions.ts:74-78`). `isMember` und `alreadyInvited` stehen
**nicht** drin — die baut das Spiel beim Laden aus `Player.factions` bzw.
`Player.factionInvitations` wieder auf (`src/Faction/Factions.ts:54-55, 65`).
Also: Mitgliedschaft und Einladungen aus `PlayerSave` lesen, Rep und Favor aus
`FactionsSave`.

Das loest genau das Problem aus der Aufgabenstellung: Reputation ist im DOM nur
mit drei Nachkommastellen und Suffix zu sehen (`62.500k`,
`src/ui/formatNumber.ts:181, 168`), im Spielstand steht sie als exakte Zahl.

### 10.5 Weg C: was ein Netscript-Skript ohne SF4 selbst liefern kann

Falls du den Zustand lieber ueber die vorhandene Telemetrie-Datei transportierst
statt ueber den Spielstand — das geht weiter als gedacht.

**Ungesperrt** (kein `checkSingularityAccess`):

| Funktion | RAM | Liefert | Beleg |
|---|---|---|---|
| `ns.getPlayer()` | 0,5 GB | `hp`, `skills`, `exp`, `mults`, `city`, `numPeopleKilled`, `money`, `location`, `totalPlaytime`, `jobs`, `factions`, `entropy`, `karma` | `src/NetscriptFunctions.ts:1417-1436`, RAM `src/Netscript/RamCostGenerator.ts:650` |
| `ns.getResetInfo()` | 1 GB | `lastAugReset`, `lastNodeReset`, `currentNode`, **`ownedAugs`** (Map Name->Level), **`ownedSF`** (Map), `bitNodeOptions` | `src/NetscriptFunctions.ts:1486-1500`, RAM `:653` |
| `ns.getMoneySources()` | 1 GB | `sinceInstall`, `sinceStart` | `src/NetscriptFunctions.ts:1437-1440` |
| `ns.write` / `ns.read` | **0 GB** | Dateikanal | `src/Netscript/RamCostGenerator.ts:623, 625` |

**Nicht dabei** und nur ueber Spielstand oder DOM zu bekommen:
`factionInvitations`, `queuedAugmentations`, `currentWork`, Faktions-Reputation
und -Favor.

Damit ist die billige Pipeline: Skript ruft `getPlayer()` + `getResetInfo()`,
schreibt das als JSON per `ns.write()` in eine Datei, und der Automat holt sie
per RFA `getFile` ab. Kostet zusammen rund 2,5 GB RAM.

**Zusatzbefund, ungeprueft im Betrieb:** Der RAM-Aufschlag von 25 GB
(`RamCostConstants.Dom`, `src/Netscript/RamCostGenerator.ts:12`) wird nur fuer
die woertlichen Bezeichner `document` und `window` erhoben
(`src/Script/RamCalculations.ts:185-192`). `globalThis` und `self` stehen dort
**nicht**. Skripte laufen als echte ES-Module aus Blob-URLs im Realm der Seite
(`src/NetscriptJSEvaluator.ts:30-32`), ein Skript koennte also ueber
`globalThis.indexedDB` den Spielstand selbst lesen. Das Spiel behandelt diese
Klasse von Trick ausdruecklich als eingebautes Achievement, nicht als Betrug
(`src/Exploits/Exploit.ts:33` "Bypass"). Ich habe es **nicht ausprobiert** und
wuerde es fuer den Nachtlauf auch nicht als Hauptweg nehmen — Weg A ist
sauberer.

### 10.6 Was es NICHT gibt

- **Kein globales Spielobjekt im Produktionsbau.** `globalThis.Bitburner` mit
  `Player`, `Factions`, `Companies` und `SaveObject` existiert, ist aber hinter
  `if (process.env.NODE_ENV === "development")` eingesperrt
  (`src/engine.tsx:396-411`). Die offizielle Webversion ist ein
  Produktionsbau — dort ist das Objekt nicht da.
- Was **doch** global ist (unbedingt, auch in Produktion):
  `globalThis.React` und `globalThis.ReactDOM` (`src/index.tsx:15-16`) sowie
  `globalThis.openDevMenu` (`src/engine.tsx:412`). **Vorsicht, irrefuehrender
  Name:** `openDevMenu` ruft `apr1()` und oeffnet den April-Scherz-Dialog, nicht
  das Entwicklermenue.
- `window.print` und `window.prompt` werfen absichtlich Fehler
  (`src/index.tsx:61-69`). Ein Automat, der irgendwo `window.prompt` benutzt,
  bekommt eine Ausnahme.
- **Kein Speichern beim Schliessen.** `window.onbeforeunload` gibt nur den
  Warntext `Your work will be lost.` zurueck (`src/index.tsx:55-57`) und ist in
  Entwicklung und unter `file://` ganz abgeschaltet (`:54`). Fuer die
  Fernsteuerung heisst das: **ein Reload oder Tab-Schliessen loest einen
  Browser-Bestaetigungsdialog aus**, den der Automat wegklicken koennen muss,
  und der Fortschritt seit dem letzten Autosave ist weg. Vor jedem geplanten
  Reload erst speichern lassen.
- **Kein Fiber-Pfad zum `Player`-Objekt.** Jede Komponente holt sich `Player`
  ueber `import { Player } from "@player"` (Modulsingleton, `src/Player.ts:7`);
  es gibt keinen React-Context dafuer. Modulbindungen liegen in Closures, und
  die kann JavaScript nicht auslesen. Ueber Fiber erreichbar waeren nur
  *Werte* — etwa der unformatierte `Player.money` im `useState` der
  Uebersichtskomponente (`src/ui/React/CharacterOverview.tsx:36-46, 68`) — und
  echte `Faction`-Objekte ueber den Seitenkontext des Routers
  (`src/ui/Router.ts:16-19`, `src/Faction/ui/FactionRoot.tsx:26`). Braucht man
  bei Weg A und B nicht.

### 10.7 Nebenbefund: freie DOM-Anker fuer eigene Ausgaben

Das Spiel stellt leere Elemente mit festen IDs bereit, in die ein Skript per
`document.getElementById(...).textContent = ...` schreiben kann und die der
Automat von aussen liest:

- `#overview-money-hook`, `#overview-hack-hook`, `#overview-hp-hook` usw.
  (`src/ui/React/CharacterOverview.tsx:110`, Muster
  `"overview-" + name.toLowerCase() + "-hook"`)
- `#overview-extra-hook-0` bis `-2` (`src/ui/React/CharacterOverview.tsx:160, 165, 170`)
- `#sidebar-extra-hook-0` bis `-3`
  (`src/Sidebar/ui/SidebarRoot.tsx:362, 390, 416, 434`)

Kostet allerdings die 25 GB DOM-Steuer im schreibenden Skript. Nur nehmen, wenn
RFA nicht geht.

---

## 11. Was ich NICHT klaeren konnte

Ehrlich benannt, statt plausibel geraten.

1. **Ob die Fernsteuerung `isTrusted === true` erzeugt.** Nicht gemessen. Davon
   haengen genau zwei Schritte ab: `Join!` auf der Factions-Seite und
   `Create program`. Beide haben einen Ersatzweg (Einladungs-Popup bzw. Kauf im
   Darkweb), aber der Test gehoert trotzdem vor den ersten Nachtlauf.
2. **Ob `Escape` per synthetischem `KeyboardEvent` einen MUI-Dialog schliesst.**
   MUI haengt den Handler an den Modal-Knoten, nicht an `document`. Ich
   vermute nein und empfehle eine echte Tastatureingabe, habe es aber nicht
   nachgemessen. (Die Hotkeys der Seitenleiste sind ein anderer Fall — die
   haengen belegbar an `document`, `src/Sidebar/ui/SidebarRoot.tsx:303`.)
3. **Ob das Schliesskreuz der Dialoge ein `data-testid="CloseIcon"` traegt.**
   MUI v5 setzt das normalerweise auch in Produktion, aber `node_modules` fehlt
   im Klon und ein gebautes Bundle liegt nicht vor. Ungeprueft.
4. **Ob `[class*="-active"]` den aktiven Seitenleisteneintrag findet.** Haengt am
   Namensschema von `tss-react` 4.9, das ich hier nicht belegen kann. Einmal im
   laufenden Spiel nachsehen.
5. **Ob der TOR-Router einen Aug-Install ueberlebt.** Ich habe die Kette
   `prestigeHomeComputer` -> `serversOnNetwork = []` -> `initForeignServers`
   nicht bis zum Ende verfolgt. Der Automat soll nach jedem Install einmal
   `buy -l` absetzen und an der Fehlermeldung erkennen, ob er den Router neu
   kaufen muss. Kostet nichts und beantwortet die Frage im Betrieb.
6. **Konkrete Wartezeiten.** Fuer `backdoor` habe ich nur die Formel
   (Hackdauer / 4). Deshalb ueberall "warten, bis `#terminal-input` wieder
   aktiv ist" statt einer Sekundenzahl.
7. **`baseCost`/`baseRepRequirement` des NeuroFlux Governor** (750e3 / 500,
   angeblich `src/Augmentation/Augmentations.ts:1160-1161`) habe ich nicht
   selbst nachgelesen. Die Formelstruktur in `AugmentationHelpers.ts:133-139`
   habe ich dagegen im Original geprueft.
8. **Zuordnung der BitNode-Multiplikatoren.** In `src/BitNode/BitNode.tsx` gibt
   es mehrere Bloecke mit `AugmentationMoneyCost`/`AugmentationRepCost` ungleich
   1. Welcher Block zu welchem BitNode gehoert, habe ich nicht aufgeloest. Fuer
   BitNode 1 sind beide 1 (`src/BitNode/BitNodeMultipliers.ts:13, 16`).
9. **Ob eine gefaelschte User-Agent-Kennung mit `" electron/"` das Objekt
   `window.appSaveFns` freischaltet.** Die Weiche ist ein blosser
   Zeichenkettenvergleich auf `navigator.userAgent`
   (`src/Electron.tsx:46-53`), es sieht also so aus. **Nicht ausprobiert** — und
   nicht noetig, weil Weg A in 10.2 dasselbe liefert.
10. **Ob `globalThis.webpackChunkbitburner` existiert** und darueber das
    Modulregister und damit der lebende `Player` erreichbar waere. Aus
    `webpack.config.js` plausibel abgeleitet, aber ohne gebautes Bundle nicht
    pruefbar. Auch das braucht man bei Weg A nicht.
11. **Toasts.** Ob und wo `SnackbarEvents` bei diesen Ablaeufen feuern, habe ich
    nicht systematisch verfolgt. Bei den acht Ablaeufen oben habe ich keine
    gefunden — die Rueckmeldungen laufen ueber Dialoge oder das Terminal.
12. **Die ASCII-Karten.** Welcher Buchstabe in welcher Stadt fuer welchen Ort
    steht, habe ich nicht aufgelistet. Der Ausweg steht fest: `Disable ASCII art`
    einschalten, dann sind es beschriftete Knoepfe. Wer die Karte behalten will,
    nimmt das `aria-label` (`src/Locations/ui/City.tsx:61`).

---

## 12. Abweichungen gegenueber `doku/oberflaeche.md`

Vier Punkte, die ich beim Nachlesen anders gefunden habe. Die alte Datei ist
sonst stimmig; ich habe sie **nicht** geaendert, damit die Historie klar bleibt.

1. **Wichtig, mit Folgen fuer den Ablauf: Das Einladungs-Popup prueft `isTrusted`
   nicht.** `oberflaeche.md` empfiehlt in Abschnitt 3, den Weg ueber die
   Factions-Seite zu nehmen und `Join!` zu suchen. Genau der Weg ist aber der
   `isTrusted`-gesperrte. Die `join`-Funktion des Popups nimmt gar kein Event
   entgegen (`src/Faction/ui/FactionInvitationManager.tsx:54-60`). **Der
   Vorschlag dreht sich also um** — siehe Abschnitt 3.2.
2. **`oberflaeche.md` Abschnitt 9 empfiehlt, den Zustand ueber die
   Telemetrie-Bruecke zu lesen, und nennt keinen Spielstand-Weg.** Der
   RFA-Befehl `getSaveFile` und der IndexedDB-Weg (Abschnitt 10) sind genauer
   und liefern auch das, was `ns.getPlayer()` nicht hergibt: offene
   Einladungen, gekaufte Augs, Faktions-Reputation.
3. **Kleiner Zeilenversatz** an ein paar Stellen — vermutlich beim ersten
   Durchgang leicht daneben gelesen: Backdoor-Erfolgsmeldung ist
   `Terminal.ts:393` (nicht 392), `#terminal-input` disabled ist
   `TerminalInput.tsx:442` (nicht 441), der Schalter
   `Suppress augmentations confirmation` steht auf `GameplayPage.tsx:51`
   (nicht 49), und die h5-Ueberschriften in `FactionsRoot.tsx` liegen auf
   269/284/292/308/316 (nicht 268/283/291/307/315).
4. **`oberflaeche.md` 0.7 raet, im Terminal zu "tippen", weil ein
   `input.value = ...` von React nicht bemerkt wuerde.** Das stimmt fuer das
   nackte Setzen; mit dem nativen Value-Setter plus `input`-Ereignis (der Weg,
   den das Projekt bereits benutzt) funktioniert es. Beides ist gangbar, die
   Warnung war nur unvollstaendig.
