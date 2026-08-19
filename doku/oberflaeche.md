# Landkarte der Bitburner-Oberflaeche

Fuer alles, was ein Skript ohne Source File 4 (Singularity) nicht kann.
Stand: Spielversion 3.0.1, gelesen im Quellcode unter `reference/v301/src`.
Jede Angabe hat eine Fundstelle. Wo etwas unsicher ist, steht das ausdruecklich dabei.

Gegenstueck in Code: `tools/ui.js` liefert dieselben Ablaeufe als maschinenlesbare
Schrittfolge. Diese Datei ist die Begruendung dazu.

---

## 0. Grundlagen, die fuer alle Aufgaben gelten

### 0.1 Zwei DOM-Anker, die das Spiel ausdruecklich anbietet

| Anker | Element | Fundstelle |
|---|---|---|
| `#terminal-input` | das Eingabefeld des Terminals | `Terminal/ui/TerminalInput.tsx:450` — im Code steht daneben der Kommentar "for players to hook in" |
| `#terminal` | die `<ul>` mit der Terminalausgabe | `Terminal/ui/TerminalRoot.tsx:85` |

Ausserdem gibt es vier leere Haken in der Seitenleiste: `#sidebar-extra-hook-0`
bis `-3` (`Sidebar/ui/SidebarRoot.tsx:361, 388, 415, 433`). Die sind fuer eigene
Einbauten gedacht, nicht fuer uns noetig.

Sonst gibt es **keine** IDs, keine `data-testid`, keine stabilen Klassennamen —
die Oberflaeche ist MUI mit `tss-react`, die Klassennamen sind generiert.
Geklickt wird deshalb ueber **sichtbaren Text**.

### 0.2 Das `isTrusted`-Problem — der wichtigste Punkt dieses Dokuments

Einige Knoepfe pruefen `event.isTrusted` und tun bei einem per JavaScript
erzeugten Klick schlicht gar nichts — ohne Fehlermeldung.

Betroffen (`grep isTrusted` ueber `src/`):

| Datei:Zeile | Was |
|---|---|
| `Faction/ui/FactionsRoot.tsx:89` | **Faktion beitreten** (`Join!`) |
| `Locations/ui/SlumsLocation.tsx:25` | **Verbrechen starten** |
| `Locations/ui/CompanyLocation.tsx:62, 71` | Job annehmen / arbeiten |
| `Locations/ui/HospitalLocation.tsx:23` | Heilen |
| `Programs/ui/ProgramsRoot.tsx:96, 108` | Programm selbst schreiben |
| `Casino/*`, `Infiltration/*`, `Arcade/*` | Casino, Infiltration |

**Nicht** betroffen und damit auch per Skript-Klick bedienbar: Reisen,
home-RAM/Cores, TOR-Kauf, Augmentations kaufen und installieren, Faktionsarbeit
starten und stoppen, alle Navigationsknoepfe.

Konsequenz fuer den Automaten: Klicks muessen als echte Browser-Eingaben laufen
(CDP `Input.dispatchMouseEvent`, also die normalen Klick-Werkzeuge der
Browser-Fernsteuerung). Ein `element.click()` aus einer JS-Auswertung heraus
scheidet fuer die betroffenen Knoepfe aus.

> Unsicher: Ich habe nicht nachgemessen, ob die konkret eingesetzte
> Browser-Fernsteuerung `isTrusted === true` erzeugt. Bei CDP-Eingabeereignissen
> ist das der Normalfall, aber das gehoert einmal im Betrieb geprueft — am
> billigsten am Verbrechen-Knopf, weil der Fehlschlag dort folgenlos ist:
> klicken, und wenn die Seite nicht auf `Work` springt, ist der Weg falsch.

### 0.3 Die Oberflaeche vor dem ersten Lauf automatentauglich machen

Drei Einstellungen ersparen viel Arbeit. Alle unter Sidebar `Options`
(Hotkey `Alt+O`), links die Reiter `System`, `Interface`, `Numeric Display`,
`Gameplay`, `Misc`, `Remote API`, `Key Binding`
(`GameOptions/ui/GameOptionsRoot.tsx:14-20`, gerendert als Text in
`GameOptions/ui/GameOptionsSidebar.tsx:51`).

| Reiter | Schalter (exakter Text) | Warum |
|---|---|---|
| `Interface` | `Disable ASCII art` | Macht aus der ASCII-Stadtkarte und der ASCII-Weltkarte **beschriftete Knoepfe**. Ohne das ist jeder Ort nur ein einzelner Buchstabe. Fundstelle `GameOptions/ui/InterfacePage.tsx:20`, Wirkung `Locations/ui/City.tsx:155` und `Locations/ui/TravelAgencyRoot.tsx:61` |
| `Gameplay` | `Suppress travel confirmations` | Reisen ohne Bestaetigungsdialog. `GameOptions/ui/GameplayPage.tsx:40` |
| `Gameplay` | `Suppress augmentations confirmation` | Kauf **und** Installation von Augmentations ohne Rueckfrage. `GameOptions/ui/GameplayPage.tsx:49` |
| `Interface` | `Disable text effects` | Sonst flackert die Ueberschrift jeder Location-Seite, deren Server eine Backdoor hat, mit zufaelligen Zeichen (siehe 0.6). `GameOptions/ui/InterfacePage.tsx:31` |

Der Schalter ist ein MUI-`Switch` mit dem Text als Label
(`ui/React/OptionSwitch.tsx:35-43`) — geklickt wird auf den Text oder den
Schalter daneben.

**Nicht** empfohlen: `Suppress faction invites`. Der unterdrueckt nur das
Popup, die Einladung bleibt; er nimmt uns aber nichts ab.

Abwaegung: Die beiden Suppress-Schalter machen die Ablaeufe kuerzer, kosten
aber die Erfolgsdialoge als Rueckmeldung. `You are now in Aevum!` und
`You purchased X ...` entfallen dann. Wer lieber am Dialog prueft, laesst sie
aus und klickt eben `Travel` bzw. `Purchase`. `tools/ui.js` deckt beide
Varianten ab (Feld `optional: true` an den Bestaetigungsschritten).

### 0.4 Navigation: Hotkeys statt Klicks

Die Seitenleiste hat Tastenkuerzel, die auf `document` haengen
(`Sidebar/ui/SidebarRoot.tsx:277-300`, Belegung in
`utils/KeyBindingUtils.ts:66ff`):

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

Fallstricke:
- Die Hotkeys werden **ignoriert**, solange fokussierte Arbeit laeuft
  (`Player.currentWork && Player.focus`) oder man auf der BitVerse-Seite ist
  (`SidebarRoot.tsx:287`). Wer also gerade arbeitet oder ein Verbrechen begeht,
  muss erst `Stop ...` klicken oder `Do something else simultaneously`.
- `Settings.DisableHotkeys` schaltet sie ganz ab (`SidebarRoot.tsx:280`).
- Im Terminal-Eingabefeld belegen `Alt+F`, `Alt+B`, `Alt+D` zusaetzlich
  Cursorbewegungen (`Terminal/ui/TerminalInput.tsx:395-425`). Beide Handler
  feuern. `Alt+F` bei fokussiertem Terminal springt also auf Factions **und**
  verschiebt vorher den Cursor — harmlos, aber gut zu wissen.
- `Factions` und `Augmentations` gibt es nur, wenn `canOpenFactions` bzw.
  `canOpenAugmentations` gilt (`SidebarRoot.tsx:157-169`); vorher tut die Taste
  nichts.

Alternativ per Klick: Die Eintraege heissen genau so wie die Seiten, weil das
Label der Enum-Wert selbst ist (`Sidebar/ui/SidebarItem.tsx:44`,
`ui/Enums.ts:13-59`). Sie liegen in vier aufklappbaren Gruppen —
`Hacking`, `Character`, `World`, `Help` (`SidebarRoot.tsx:342, 366, 394, 420`).
Die Gruppen sind per Vorgabe offen (`SidebarAccordion.tsx:59`), aber der
Collapse hat `unmountOnExit` (`:81`): eine zugeklappte Gruppe hat ihre
Eintraege **gar nicht im DOM**. Also erst die Gruppenzeile klicken.

### 0.5 Dialoge schliessen

Alle Modale kommen aus `ui/React/Modal.tsx`. Oben rechts sitzt immer ein
`IconButton` mit `CloseIcon` (`:95-97`), ohne Beschriftung. Bei
`canBeDismissedEasily` (Vorgabe: ja) gehen zusaetzlich `Escape` und ein Klick
auf den Hintergrund (`:77-82`).

Wichtig: Die einfachen Meldungen ueber `dialogBoxCreate` haben **keinen
OK-Knopf**. Der AlertManager rendert ihn nur, wenn `canBeDismissedEasily`
falsch ist (`ui/React/AlertManager.tsx:89-93`). Erwartungshaltung "auf OK
klicken" geht also ins Leere — `Escape` ist der sichere Weg.

> Unsicher: Ob das X-Icon im DOM ein `data-testid="CloseIcon"` traegt, habe ich
> nicht geprueft (MUI setzt so etwas, aber das haengt an der Bauart des Pakets).
> `Escape` umgeht die Frage.

### 0.6 Die Falle mit den verfremdeten Ueberschriften

`Locations/ui/GenericLocation.tsx:117-127` rendert den Ortsnamen als h4 —
aber **nicht** als schlichten Text, sobald der zum Ort gehoerende Server eine
Backdoor hat. Dann laeuft er durch `ui/React/CorruptibleText.tsx`, das im
Sekundentakt zufaellige Zeichen austauscht und kurz danach zuruecksetzt
(`:41-53`).

Das trifft **alle acht** TechVendor, weil hinter jedem ein Server steht
(`Server/data/servers.ts`, Feld `specialName`): `ecorp`, `fulcrumtech`,
`omnitek`, `stormtech`, `alpha-ent`, `the-hub` (CompuTek), `netlink`,
`omega-net`. Sobald der Automat dort Backdoors gesetzt hat, ist der
Textvergleich auf die Ueberschrift sporadisch falsch — ein Fehler, der erst
spaet im Spiel auftaucht und dann schwer zuzuordnen ist.

Zwei Gegenmittel:
1. `Disable text effects` einschalten (`InterfacePage.tsx:31`). Dann prueft
   `CorruptibleText` gleich am Anfang und laesst den Text in Ruhe (`:35-37`).
2. Nicht an der Ueberschrift festmachen, sondern an etwas Ortstypischem —
   beim TechVendor an `"More RAM means more scripts on 'home'"`, in den Slums an
   den Verbrechen-Knoepfen, und ueberall am Knopf `Return to World`
   (`GenericLocation.tsx:116`).

`The Slums` hat keinen Server und ist deshalb nie betroffen.

### 0.7 Terminal bedienen

- Befehle koennen mit `;` verkettet werden
  (`Terminal/Parser.ts:13-25`, `Terminal/Terminal.ts:691-692`).
  `connect a; connect b; backdoor` ist eine einzige Eingabe.
- Das Eingabefeld ist `disabled`, solange eine Aktion laeuft
  (`TerminalInput.tsx:441`, Bedingung `Terminal.action !== null`) — also
  waehrend `hack`, `grow`, `weaken`, `analyze` und **`backdoor`**. Solange steht
  darunter ein Fortschrittsbalken (`Terminal/ui/TerminalActionTimer.tsx:10`,
  50 Zeichen breit).
- Das Feld ist ein kontrolliertes React-`TextField`. Echtes Tippen plus `Enter`
  funktioniert immer. Ein `input.value = "..."` aus JavaScript heraus wuerde von
  React **nicht** bemerkt; dafuer braeuchte es den nativen Value-Setter plus ein
  `input`-Event. Empfehlung: tippen.
- Beim Tippen kann ein Autovervollstaendigungs-Popup aufgehen
  ("Possible autocomplete candidates:", `TerminalInput.tsx:478`). Es stoert
  `Enter` nicht, verdeckt aber Bildschirmflaeche.

---

## 1. TOR-Router kaufen und danach Programme im Darkweb

### 1.1 Der TOR-Router — das ist ein Knopf, kein Terminalbefehl

**Weg:** `Alt+W` (City) -> Ort mit einem TechVendor anklicken -> Knopf
`Purchase TOR router`.

Der Knopf steckt in `Locations/ui/TorButton.tsx:44-49` und wird von
`Locations/ui/TechVendorLocation.tsx:59` gerendert. Sichtbarer Text:

```
Purchase TOR router - $200.000k
```

(nach dem Kauf: `Purchase TOR router - Purchased`, und der Knopf ist disabled).
Das Trennzeichen ist ein geschuetztes Leerzeichen (`&nbsp;`, also ` `) —
beim Textvergleich nur auf den Anfang `Purchase TOR router` pruefen.

- **Preis:** 200.000 $ (`CONSTANTS.TorRouterCost = 200e3`, `Constants.ts:44`).
- **Disabled**, wenn man es nicht bezahlen kann oder ihn schon hat
  (`TorButton.tsx:45`).
- **Erfolg:** ein Dialog mit dem Text
  `You have purchased a TOR router!\nYou now have access to the dark web from your home computer.\nUse the "buy" command in the terminal to purchase programs.`
  (`TorButton.tsx:25-29`). Kein OK-Knopf, mit `Escape` schliessen.
- Technisch verbindet der Kauf `home` mit dem Server `darkweb`
  (`Server/ServerHelpers.ts:326-328`).

Fehlerfaelle (beide als Dialog, `TorButton.tsx:13-21`):
`You already have a TOR Router!` / `You cannot afford to purchase the TOR router!`
Ueber die Oberflaeche erreicht man sie kaum, weil der Knopf vorher sperrt.

### 1.2 Programme kaufen — das laeuft ueber das Terminal, nicht ueber Knoepfe

Bestaetigt: es gibt **keine** Darkweb-Seite und keine Kaufknoepfe. Der
`buy`-Befehl ist in `Terminal/commands/buy.ts` implementiert, die Logik in
`DarkWeb/DarkWeb.tsx`.

```
buy -l          # Liste aller Posten (auch: -1, --list)
buy -a          # alle noch fehlenden kaufen (auch: --all)
buy <Programm>  # einzeln
```

- Der Befehl funktioniert **von ueberall**, man muss sich nicht erst
  `connect darkweb`. Das sagt das Spiel selbst, wenn man sich verbindet
  (`DarkWeb.tsx:18-22`).
- Der Name wird klein geschrieben verglichen (`DarkWeb.tsx:46, 52`), also ist
  `buy bruteSSH.exe` ebenso gut wie `buy BruteSSH.exe`. Die kanonischen Namen
  stehen in `Programs/Enums.ts`.

Sortiment und Preise (`DarkWeb/DarkWebItems.ts`, Reihenfolge wie dort):

| Programm | Preis | Beschreibung im Spiel |
|---|---|---|
| `BruteSSH.exe` | 500.000 | Opens up SSH Ports. |
| `FTPCrack.exe` | 1.500.000 | Opens up FTP Ports. |
| `relaySMTP.exe` | 5.000.000 | Opens up SMTP Ports. |
| `HTTPWorm.exe` | 30.000.000 | Opens up HTTP Ports. |
| `SQLInject.exe` | 250.000.000 | Opens up SQL Ports. |
| `ServerProfiler.exe` | 500.000 | Displays detailed server information. |
| `DeepscanV1.exe` | 500.000 | Enables 'scan-analyze' with a depth up to 5. |
| `DeepscanV2.exe` | 25.000.000 | Enables 'scan-analyze' with a depth up to 10. |
| `AutoLink.exe` | 1.000.000 | Enables direct connect via 'scan-analyze'. |
| `DarkscapeNavigator.exe` | 50.000.000 | Unlock access to the Dark Net. |
| `Formulas.exe` | 5.000.000.000 | Unlock access to the formulas API. |

Achtung bei Gross- und Kleinschreibung: `relaySMTP.exe` faengt klein an,
`SQLInject.exe` hat drei Grossbuchstaben vorn.

**`buy -a` ist eine Falle.** `buyAllDarkwebItems` laeuft die Liste in der oben
gezeigten Reihenfolge ab und **bricht beim ersten unbezahlbaren Posten
komplett ab** (`DarkWeb.tsx:100-103`, `return` statt `continue`). Wer 300 Mio
hat, kauft also BruteSSH, FTPCrack, relaySMTP, HTTPWorm, SQLInject — und dann
gar nichts mehr, obwohl ServerProfiler fuer 500k noch drin waere. Deshalb:
einzeln kaufen, aufsteigend nach Preis.

Rueckmeldungen im Terminal (`DarkWeb.tsx`):

| Lage | Ausgabe |
|---|---|
| Erfolg | `You have purchased the BruteSSH.exe program. The new program can be found on your home computer.` (`:84-86`) |
| schon vorhanden | `You already have the BruteSSH.exe program` (`:65`) |
| zu wenig Geld | `Not enough money to purchase BruteSSH.exe` (`:71`, rot) |
| Name falsch | `Unrecognized item: xyz` (`:59`, rot) |
| kein TOR | `You need to be able to connect to the Dark Web to use the "buy" command. (Maybe there's a TOR router you can buy somewhere)` (`buy.ts:7-9`) |
| `buy -a`, alles da | `All available programs have been purchased already.` (`:110`) |
| `buy -a`, zu wenig | `Need $X more to purchase HTTPWorm.exe` (`:101`) |

Gegenprobe: `buy -l` zeigt gekaufte Posten mit `[OWNED]` in gruen statt dem
Preis (`DarkWeb.tsx:30-34`).

**Vorbedingungen:** TOR-Router (sonst geht `buy` gar nicht), genug Geld.
Ein Hacking-Level braucht es zum Kaufen nicht — nur beim Selberschreiben.

---

## 2. home-RAM und Kerne aufruesten

**Weg:** `Alt+W` (City) -> TechVendor anklicken -> Knopf
`Upgrade 'home' RAM` bzw. `Upgrade 'home' cores`. Kein Bestaetigungsdialog.

### 2.1 Welcher Laden — es ist egal

Wichtige Richtigstellung: `techVendorMinRam`/`techVendorMaxRam` steuern
**nur** die Knoepfe fuer Cloud-Server. Die Knoepfe fuer home-RAM und home-Cores
rendert `TechVendorLocation.tsx:61, 63` bei **jedem** TechVendor gleich und
ohne Beschraenkung. Man kann home also beim billigsten Laden in der eigenen
Stadt beliebig weit hochziehen.

Alle TechVendor (`Locations/data/LocationsMetadata.ts`, Namen aus
`Locations/Enums.ts`):

| Ort | Stadt | Cloud-Server-RAM (nur dafuer relevant) |
|---|---|---|
| `Alpha Enterprises` | Sector-12 | 2 – 8 GB |
| `NetLink Technologies` | Aevum | 8 – 64 GB |
| `Omega Software` | Ishima | 4 – 128 GB |
| `CompuTek` | Volhaven | 8 – 256 GB |
| `Storm Technologies` | Ishima | 32 – 512 GB |
| `ECorp` | Aevum | 128 – 512 GB |
| `OmniTek Incorporated` | Volhaven | 128 – 1024 GB |
| `Fulcrum Technologies` | Aevum | 256 – 1024 GB |

Chongqing und New Tokyo haben keinen TechVendor. In der Startstadt Sector-12
ist `Alpha Enterprises` der einzige.

### 2.2 Die Knoepfe

`Locations/ui/RamButton.tsx:49-59`:

```
Upgrade 'home' RAM (8.00GB -> 16.00GB) - $1.032m
Upgrade 'home' RAM - Max                          (wenn Maximum erreicht)
```

`Locations/ui/CoresButton.tsx:43-52`:

```
Upgrade 'home' cores (1 -> 2) - $7.500b
Upgrade 'home' cores - Max
```

Achtung: `RAM` gross, `cores` klein. Die Trenner sind wieder `&nbsp;`.
Beim Textvergleich auf den Praefix pruefen.

Ueber den Knoepfen stehen Kursivzeilen, die als zusaetzliche Anker taugen:
`"More RAM means more scripts on 'home'"` (`RamButton.tsx:46`) und
`"Cores increase the effectiveness of grow() and weaken() on 'home'"`
(`CoresButton.tsx:40`).

Reihenfolge im DOM auf der TechVendor-Seite: Cloud-Server-Knoepfe, Kursivtext,
TOR, RAM, Cores (`TechVendorLocation.tsx:50-64`).

### 2.3 Preise, Grenzen, Fehlerfaelle

- RAM verdoppelt sich pro Kauf. Kosten:
  `ram * 32000 * 1.58^log2(ram) * HomeComputerRamCost`
  (`PersonObjects/Player/PlayerObjectServerMethods.ts:30-40`,
  `ServerConstants.BaseCostFor1GBOfRamHome = 32000`).
- Cores: `1e9 * 7.5^cpuCores`, Maximum 8 Kerne (`CoresButton.tsx:18`).
- RAM-Maximum: `2^30` GB (`Server/data/Constants.ts:6`). Mit der BitNode-Option
  `restrictHomePCUpgrade` schon bei 128 GB (`RamButton.tsx:23-25`).
- **Beide Knoepfe sind disabled**, wenn das Geld fehlt oder das Maximum steht.
  Es gibt in der Oberflaeche also keine Fehlermeldung zu sehen; die Texte
  `You do not have enough money to purchase additional RAM for your home computer`
  und `You cannot upgrade your home computer RAM because it is at its maximum possible value`
  (`Server/ServerPurchases.ts:171, 180`) erreicht man nur ueber Skriptwege.
  Bei den Kernen gibt es gar keine Meldung, nur einen stillen Abbruch
  (`CoresButton.tsx:22-33`).

### 2.4 Erfolg erkennen

Kein Dialog, kein Toast. Der Knopftext selbst rueckt eine Stufe weiter:
aus `(8.00GB -> 16.00GB)` wird `(16.00GB -> 32.00GB)`, aus `(1 -> 2)` wird
`(2 -> 3)`, und der Preis steigt. Zweiter Beleg: das Geld links oben in der
Uebersicht sinkt. Dritter, unabhaengiger Beleg: im Terminal `free` bzw.
`home; analyze`.

---

## 3. Einer Faktion beitreten

**Weg:** `Alt+F` (Factions) -> Knopf `Join!` in der Karte der Faktion.

Seite: `Faction/ui/FactionsRoot.tsx`. Aufbau:

| Ueberschrift | Bedingung | Zeile |
|---|---|---|
| `Factions` (h4) | immer | :236 |
| `Faction Invitations` (h5) | nur wenn Einladungen offen | :268 |
| `Your Gang` (h5) | nur mit Gang | :283 |
| `Your Factions` (h5) | immer | :291 |
| `Share RAM` (h5) | immer | :307 |
| `Rumors` (h5) | nur wenn vorhanden | :315 |

Steht keine Mitgliedschaft an, steht unter `Your Factions` der Satz
`You have not yet joined any Factions.` (:301). Zusaetzlich gibt es
Container-Marker im DOM: `span.factions-invites`, `span.factions-joined`,
`span.factions-rumors` (:265, :280, :312).

**Der Knopf heisst `Join!` — mit Ausrufezeichen** (`:122`). Er existiert nur bei
offener Einladung; ohne Einladung ist er nicht disabled, sondern gar nicht im
DOM (`:124`). Bei bereits beigetretenen Faktionen stehen an der Stelle die
beiden Knoepfe `Details` (:117) und `Augments` (:118).

**`Join!` prueft `isTrusted`** (`:89`) — siehe Abschnitt 0.2. Ausserdem prueft
er `alreadyInvited` und `isBanned`; in allen drei Faellen passiert nichts,
kommentarlos.

Zusaetzlich gibt es ein Einladungs-Popup, das beim Eintreffen der Einladung
aufgeht (`Faction/ui/FactionInvitationManager.tsx`), sofern
`Suppress faction invites` aus ist:
- h4 `You received a faction invitation.` (:64)
- `Would you like to join <Name>?` (:65-67)
- bei verfeindeten Faktionen zusaetzlich
  `Joining this faction will prevent you from joining its enemies until your next augmentation.`
  und `<Name> is enemies with:` mit Liste (:68-81)
- Knoepfe `Join` (**ohne** Ausrufezeichen) und `Decide later` (:83-86)

Also zwei verschiedene Knopftexte fuer dieselbe Sache, je nach Weg. Der
Automat sollte den Weg ueber die Faktionsseite nehmen und `Join!` suchen; das
Popup taucht nur zufaellig auf und wuerde die Suche stoeren.

**Vorbedingung:** Es muss eine Einladung vorliegen. Einladungen kommen vom
Spiel selbst, wenn die Bedingungen erfuellt sind (Backdoor auf `CSEC`,
Geldschwelle, Stadt, Firmen-Reputation und so fort). Nach einem Backdoor prueft
das Spiel sofort nach (`Terminal/Terminal.ts:391-393`). Die Bedingungen je
Faktion stehen als Checkliste im Tooltip auf dem Faktionsnamen
(`FactionsRoot.tsx:50-59`, Quelle `Faction/FactionJoinCondition.ts`).

**Erfolg erkennen:** die Karte wandert von `Faction Invitations` nach
`Your Factions`, `Join!` wird durch `Details` und `Augments` ersetzt, und
rechts erscheinen zwei Zeilen `0 favor` und `0 rep` (`:205-212`). Sind alle
Einladungen abgearbeitet, verschwindet die Ueberschrift `Faction Invitations`
ganz.

Nebenbemerkung: Der rote Zaehler am Sidebar-Eintrag `Factions` zaehlt nur
**ungesehene** Einladungen (`SidebarRoot.tsx:153`). Er verschwindet, sobald die
Faktionsseite einmal offen war — die Einladung bleibt aber. Der Zaehler taugt
also nicht als Pruefung, ob noch etwas offen ist.

---

## 4. Fuer eine Faktion arbeiten und die Arbeit beenden

### 4.1 Arbeit starten

**Weg:** `Alt+F` -> `Details` bei der gewuenschten Faktion ->
Knopf `Hacking Contracts`.

Der Faktionsname selbst ist kein Knopf, sondern nur Text
(`FactionsRoot.tsx:127ff`). Der Einstieg ist `Details` (:117).

Auf der Faktionsseite (`Faction/ui/FactionRoot.tsx`, Reihenfolge im DOM):

1. Knopf `Back` (:108)
2. h4 mit dem Faktionsnamen (:109-111)
3. Infoblock (`Faction/ui/Info.tsx`) mit `Reputation: ` (:36) und `Favor: ` (:38)
4. Erklaerungsabsatz, beginnt mit
   `Perform work/carry out assignments for your faction to help further its cause!` (:116-123)
5. Arbeitsknoepfe, je nach Angebot der Faktion:
   - `Hacking Contracts` (:125-131, nur bei `offerHackingWork`)
   - `Field Work` (:132-134, nur bei `offerFieldWork`)
   - `Security Work` (:135-141, nur bei `offerSecurityWork`)
6. Spendenbereich mit Knopf `donate` (klein geschrieben,
   `Faction/ui/DonateOption.tsx:73`)
7. Knopf `Purchase Augmentations` (:147)

Bietet eine Faktion eine Arbeitsart nicht an, fehlt der Knopf **ganz** — er ist
nicht disabled. Bei der eigenen Gang-Faktion fallen alle Arbeitsknoepfe und die
Spende weg (`:99, :113`); es bleiben `Back`, Info und `Purchase Augmentations`.

Ist man nicht Mitglied, zeigt die Seite nur
`You have not joined <Name> yet!` und den Knopf `Back to Factions` (:155-164).

Nach dem Klick: `Player.startWork(...)`, `startFocusing()`, Sprung auf
`Page.Work` (:59-95). **Kein Bestaetigungsdialog**, auch nicht, wenn schon eine
andere Arbeit lief — die wird stillschweigend ersetzt
(`PersonObjects/Player/PlayerObjectWorkMethods.ts:5-10`). Lief vorher eine
andere Faktionsarbeit, poppt allerdings deren Abschlussmeldung hoch (siehe 4.3).

### 4.2 Die laufende Arbeit

Seite `ui/WorkInProgressRoot.tsx`, Faction-Zweig ab :356.

- h6: `You are currently carrying out hacking contracts for CyberSec`
  (Template :389-393; die Mitte ist `carrying out hacking contracts` /
  `carrying out field missions` / `performing security detail`, :371-375)
- darunter: `Current Faction Reputation: 1.234k (0.123 / sec)` (:395-400)
- Tabelle mit `Hacking Exp`, `Strength Exp`, `Defense Exp`, `Dexterity Exp`,
  `Agility Exp`, `Charisma Exp`, jeweils `X / sec` (:54-117)
- Fortschritt: nur `1 minutes 12 seconds elapsed` (:509-517), **kein**
  Prozentbalken — Faktionsarbeit hat keine feste Dauer.

### 4.3 Arbeit beenden

Zwei Knoepfe am Fuss der Seite:

| Text | Wirkung |
|---|---|
| `Stop Faction work` (:406, gerendert :528/531) | beendet die Arbeit wirklich, springt zurueck auf die Faktionsseite |
| `Do something else simultaneously` (:534) | beendet **nichts**, hebt nur den Fokus auf; die Arbeit laeuft mit Abschlag weiter |

Der Text ist faktionsspezifisch. Zum Vergleich in derselben Datei:
`Stop committing crime` (:245), `Stop training at gym` (:254),
`Stop taking course` (:256), `Stop creating program` (:317),
`Stop grafting` (:347), `Stop working` (:468 — das ist **Firmenarbeit**, nicht
Faktionsarbeit). Wer blind nach `Stop working` sucht, findet die Faktionsarbeit
nicht.

Nach dem Stoppen kommt ein Dialog (`Work/FactionWork.tsx:58-69`):
`You worked for CyberSec.` / `They now have a total of X reputation.`
Kein OK-Knopf, mit `Escape` weg.

Wer nur die Seite verlaesst (Hotkey, Sidebar), beendet die Arbeit **nicht** —
`GameRoot.tsx:273` ruft beim Verlassen von `Page.Work` lediglich
`Player.stopFocusing()`. Die Arbeit laeuft unfokussiert weiter, sichtbar in der
Uebersicht links: `Working for <Name>`, `Doing hacking work`, `X rep`, plus
Knopf `Focus` (`ui/React/CharacterOverview.tsx:274-347`).

**Erfolg messen:** Reputation auf der Faktionsseite (`Reputation: `) oder in der
Uebersicht in der Faktionsliste (`X rep`).

---

## 5. Augmentations kaufen und installieren

### 5.1 Kaufen

**Weg:** `Alt+F` -> Knopf `Augments` bei der Faktion (Abkuerzung,
`FactionsRoot.tsx:118`) oder `Details` -> `Purchase Augmentations`
(`FactionRoot.tsx:147`). Beides landet auf `Faction/ui/AugmentationsPage.tsx`.

Kopfbereich der Seite:
- Knopf `Back` (:188)
- h4 `Faction Augmentations - CyberSec` (:189)
- `Price multiplier: x 1.900` (:154) — steigt mit jeder gekauften, noch nicht
  installierten Aug
- Sortierknoepfe `Sort by Cost`, `Sort by Reputation`, `Sort by Default Order`,
  `Sort by Purchasable` (:212-221)
- Filterfeld mit Platzhalter `Filter augmentations` (:223-233)

Fuer den Automaten ist das Filterfeld nuetzlich: Namen eintippen, dann bleibt
genau eine Zeile stehen.

Jede Zeile (`Augmentation/ui/PurchasableAugmentations.tsx`):
- **links** ein kleiner Knopf mit `Buy` bzw. `Owned` (:203)
- disabled, wenn `!canPurchase(aug) || owned` (:200). `canPurchase` ist
  Voraussetzungs-Augs vorhanden **und** genug Reputation **und** genug Geld
  (`AugmentationsPage.tsx:240-247`)
- rechts der Name, bei NeuroFlux mit Levelzusatz
  `NeuroFlux Governor - Level 12` (:230)
- darunter die Anforderungszeilen: der Geldbetrag (z. B. `$1.750b`) und
  `62.500k rep` (:240-256). Erfuellt oder nicht erkennt man am Icon
  (`CheckBox` gegen `CheckBoxOutlineBlank`, `ui/Components/Requirement.tsx:21`)
  und an der Farbe — **es gibt keinen erklaerenden Text am Knopf**.
- fehlende Voraussetzungs-Augs: `Missing 1 pre-requisite(s)` bzw.
  `Pre-requisites Owned` (:57-67)

Gekaufte Augs stehen in einem zweiten, blasseren Block unter den kaufbaren, mit
`Owned` statt `Buy` (`AugmentationsPage.tsx:137-142`). Der String ist `Owned`,
nicht "Purchased".

**Bestaetigungsdialog** (`Augmentation/ui/PurchaseAugmentationModal.tsx`), nur
wenn `Suppress augmentations confirmation` aus ist:
- h4 mit dem reinen Aug-Namen (:27)
- `Would you like to purchase the <Name> Augmentation for $70.000m?` (:35-36)
- Knopf `Purchase` (:40-48), mit `autoFocus`
- **kein Cancel-Knopf** — Abbruch nur ueber X / Escape

**Erfolgsdialog** (`Faction/FactionHelpers.tsx:122-128`), ebenfalls nur ohne
Suppress-Schalter:
`You purchased <Name>. Its enhancements will not take effect until they are installed. To install your augmentations, go to the 'Augmentations' tab on the left-hand navigation menu. Purchasing additional augmentations will now be more expensive.`

Fehlermeldungen als Dialog (`FactionHelpers.tsx:60-107`), unter anderem:
`You don't have enough money to purchase <Name>.`,
`You don't have enough faction reputation to purchase <Name>.`,
`You already purchased the '<Name>' augmentation.`,
`You must first purchase or install <A>,<B> before you can purchase this one.`

**Zuverlaessigster Erfolgsbeleg** (unabhaengig von den Dialogen): der Knopf
wechselt von `Buy` auf `Owned`, der `Price multiplier:` steigt, und der rote
Zaehler am Sidebar-Eintrag `Augmentations` zaehlt hoch.

Sonderfall NeuroFlux Governor: bleibt immer in der kaufbaren Liste und zeigt
dauerhaft `Buy`, nie `Owned` (`AugmentationsPage.tsx:139`). Der angezeigte
Level ist der **naechste**, nicht der aktuelle
(`PurchasableAugmentations.tsx:213, 230`).

### 5.2 Installieren

**Weg:** `Alt+A` (Augmentations) -> Knopf `Install Augmentations`.

Seite `Augmentation/ui/AugmentationsRoot.tsx`:
- h4 `Augmentations` (:110)
- h5 `Purchased Augmentations` (:114) mit einem Info-Icon, dessen Tooltip die
  Warnliste enthaelt (`WARNING: Installing your Augmentations resets most of
  your progress, including:` ...)
- Knopf **`Install Augmentations`** (:173-175) — statisch, **ohne** Zahl in
  Klammern. Disabled, solange nichts gekauft ist. Tooltip: `'I never asked for this'`
- daneben Knopf `Backup Save (+1 favor to all factions)` bzw. nur `Backup Save`,
  je nach Bonuslage (:95-98, :179-181)
- ohne gekaufte Augs: `No Augmentations have been purchased yet` (:192)

**Bestaetigungsdialog** (`ui/React/ConfirmationModal.tsx`, aufgerufen
`AugmentationsRoot.tsx:145-169`) — **ohne Titel**, nur Text und ein einziger
Knopf `Confirm` (:20-26). Kein Cancel. Der Text beginnt mit
`Installing will reset` und listet danach `- money`, `- skill / experience`,
`- every server except home`, `- factions and reputation`,
`- current work activity`, dann `You will keep:` mit `- All scripts on home`,
`- home ram and cores`, und endet mit
`It is recommended to install several Augmentations at once.`

Es gibt **kein eigenes Setting** fuers Installieren: derselbe Schalter
`Suppress augmentations confirmation` steuert beides (`:100-106`). Ist er
gesetzt, wird ohne jede Rueckfrage installiert.

**Danach** (`Augmentation/AugmentationHelpers.ts:69-115`):
1. alle Skripte werden gekillt (`prestigeWorkerScripts`)
2. Dialog:
   `You slowly drift to sleep as scientists put you under in order to install the following Augmentations:` + Liste + `You wake up in your home...you feel different...`
3. Soft Reset (`prestigeAugmentation`)
4. **Die Seite springt auf das Terminal** (`Router.toPage(Page.Terminal)`)

**Erfolg erkennen:** der Abschlussdialog, danach die Terminal-Seite, der
Sidebar-Zaehler an `Augmentations` ist weg, und auf der Augmentations-Seite
steht `No Augmentations have been purchased yet`, waehrend die Augs unter
`Installed Augmentations` stehen (`Augmentation/ui/InstalledAugmentations.tsx:60`).

**Wichtig fuer den Automaten:** Nach dem Install ist alles weg — Skripte
laufen nicht mehr, die RFA-Bruecke muss ihre Skripte neu ausspielen und
starten. Das gehoert in den Ablauf, sonst steht das Spiel nach dem Install
still. `home`-RAM und `home`-Kerne bleiben erhalten.

---

## 6. Reisen in eine andere Stadt

**Weg:** `Alt+R` (Travel) -> Knopf `Travel to <Stadt>` -> ggf. `Travel`.

Alternativ ueber die City-Seite den Ort `Travel Agency` — landet auf derselben
Seite (`Locations/ui/City.tsx:38-39`).

Seite `Locations/ui/TravelAgencyRoot.tsx`:
- h4 `Travel Agency` (:55)
- `From Sector-12, you can travel to any other city! A ticket costs $200.000k.` (:57-60)

Die Zielauswahl haengt an `Disable ASCII art` (:61):
- **Schalter an (empfohlen):** echte Knoepfe mit `Travel to Aevum`,
  `Travel to Chongqing`, `Travel to Sector-12`, `Travel to New Tokyo`,
  `Travel to Ishima`, `Travel to Volhaven` (:71). Die eigene Stadt fehlt (:64).
- **Schalter aus (Vorgabe):** ASCII-Weltkarte. Klickbar ist **nur der erste
  Buchstabe** der Stadt in einem `<span>` (`ui/React/WorldMap.tsx:34`), mit dem
  vollen Stadtnamen als Tooltip (:32). Kein `aria-label`, kein Knopf. Fuer einen
  Automaten unangenehm, weil `A`, `C`, `S`, `N`, `I`, `V` mehrfach in der
  Karte vorkommen.

Staedtenamen exakt (`Locations/Enums.ts:70-77`): `Aevum`, `Chongqing`,
`Sector-12`, `New Tokyo`, `Ishima`, `Volhaven`. Beachte den Bindestrich bei
`Sector-12` und das Leerzeichen bei `New Tokyo`.

**Bestaetigungsdialog** (`Locations/ui/TravelConfirmationModal.tsx`), nur ohne
`Suppress travel confirmations`:
- `Would you like to travel to Aevum? The trip will cost $200.000k.` (:23-26)
- Knoepfe `Travel` (:29-31) und `Cancel` (:32)

**Kosten:** 200.000 $ (`CONSTANTS.TravelCost`, `Constants.ts:28`).

**Zu wenig Geld:** Der Knopf ist **nicht** disabled, und es kommt **keine**
Meldung. `startTravel` macht einen stillen `return` (:41-44). Einziges Signal:
der Geldbetrag im Einleitungssatz ist ausgegraut (`ui/React/Money.tsx:23`,
Klasse `unbuyable`). Der Automat muss den Kontostand also **vorher** pruefen,
sonst haelt er einen stillen Fehlschlag fuer Erfolg.

**Erfolg erkennen:**
1. Dialog `You are now in Aevum!` (:31) — entfaellt bei gesetztem Suppress-Schalter
2. die Seite wechselt auf `City`, und dort steht der Stadtname als eigene Zeile
   (`Locations/ui/City.tsx:154`, `<Typography>{city.name}</Typography>`). Das ist
   der verlaessliche Marker, weil er unabhaengig vom Setting ist.
3. der Einleitungssatz auf der Reiseseite beginnt danach mit `From Aevum,`

Die Stadt steht **nicht** in der Uebersicht links.

---

## 7. Ein Verbrechen begehen

**Weg:** `Alt+W` (City) -> Ort `The Slums` -> Knopf mit dem Verbrechen.

`The Slums` gibt es in **allen sechs Staedten** (`Locations/Locations.ts:211-215`,
Metadaten mit `city: null`). Der sichtbare Ortsname ist `The Slums`
(`Locations/Enums.ts:62`); der interne Typ heisst nur `Slums` (:83) — nicht
verwechseln.

Auf der City-Seite:
- mit `Disable ASCII art`: ein Knopf mit dem Text `The Slums`
  (`Locations/ui/City.tsx:141`)
- ohne: ein `<span>` mit dem Buchstaben `S`, aber mit
  **`aria-label="The Slums"`** (`City.tsx:61`). Das aria-Attribut ist hier der
  stabile Zugriff, falls man die ASCII-Karte behalten will.

Seite `Locations/ui/SlumsLocation.tsx:35-37`. Knopftext-Template:

```
{crime.type} ({formatPercent(chance)} chance of success)
```

also z. B. `Shoplift (100.00% chance of success)` oder
`Heist (0.31% chance of success)`. Zum Suchen taugt nur der Praefix.

Die zwoelf Verbrechen (`Crime/Enums.ts:1-14`, Reihenfolge wie auf der Seite):

| Knopftext-Praefix | Tooltip | Schwierigkeit |
|---|---|---|
| `Shoplift` | Attempt to shoplift from a low-end retailer | 1/20 |
| `Rob Store` | Attempt to commit armed robbery on a high-end store | 1/5 |
| `Mug` | Attempt to mug a random person on the street | 1/5 |
| `Larceny` | Attempt to rob property from someone's house | 1/3 |
| `Deal Drugs` | Attempt to deal drugs | 1 |
| `Bond Forgery` | Attempt to forge corporate bonds | 1/2 |
| `Traffick Arms` | Attempt to smuggle illegal arms into the city | 2 |
| `Homicide` | Attempt to murder a random person on the street | 1 |
| `Grand Theft Auto` | Attempt to commit grand theft auto | 8 |
| `Kidnap` | Attempt to kidnap and ransom a high-profile-target | 5 |
| `Assassination` | Attempt to assassinate a high-profile target | 8 |
| `Heist` | Attempt to pull off the ultimate heist | 18 |

Gaengige Fehlannahmen aus dem Gedaechtnis, die hier **falsch** sind:
es heisst `Mug`, nicht "Mug someone"; `Traffick Arms`, nicht "Traffick Illegal
Arms"; `Kidnap`, nicht "Kidnap and Ransom"; `Assassination`, nicht "Assassinate".

**Der Klick prueft `isTrusted`** (`SlumsLocation.tsx:25`) — siehe 0.2.

**Vorbedingungen: keine.** Kein Stat-Minimum, kein disabled. Auch mit 0.00 %
Chance kann man starten. Fuer Karma ist `Homicide` das uebliche Mittel, fuer
frueh im Spiel `Shoplift` oder `Mug`.

**Nach dem Klick:** Sprung auf `Page.Work` mit `Player.focus = true`.
Auf `ui/WorkInProgressRoot.tsx` (Crime-Zweig :209-247):
- h6 `You are attempting to shoplift` — Achtung, hier steht `crime.workName`,
  **nicht** `crime.type` (:224). Die Werte lauten `to shoplift`,
  `to rob a store`, `to mug`, `larceny`, `to deal drugs`, `to forge bonds`,
  `to traffic arms`, `homicide`, `grand theft auto`, `to kidnap`,
  `to assassinate`, `a heist`.
- `Success chance: 34.12%` (:229), `Gains (on success)` (:230), Geld- und
  Exp-Zeilen
- Fortschritt: `12 seconds remaining` und `43.21% done` mit Balken (:509-521)

**Das Verbrechen wiederholt sich von selbst, endlos**, bis man abbricht
(`Work/CrimeWork.ts:35-50`, `while`-Schleife mit erneutem `commit()`). Es gibt
kein Setting dafuer. Das ist praktisch: einmal starten, laufen lassen.

**Abbrechen:** Knopf `Stop committing crime` (:245) — springt zurueck auf die
Slums-Seite. `Do something else simultaneously` (:534) beendet nichts, hebt nur
den Fokus auf; das Verbrechen laeuft mit Abschlag weiter
(`Player.focusPenalty()`).

**Bei Fehlschlag** passiert sichtbar nichts: kein Toast, keine Meldung. Es gibt
kein Geld, die Exp-Gewinne werden geviertelt, und der naechste Durchgang
beginnt (`CrimeWork.ts:70-77`).

---

## 8. Backdoor auf einem Server setzen

Das laeuft komplett ueber das Terminal.

### 8.1 Der Ablauf

```
home
connect <nachbar1>
connect <nachbar2>
...
connect <ziel>
backdoor
```

oder in einer Zeile: `home; connect a; connect b; backdoor`.

`connect` akzeptiert nur:
1. einen **direkten Nachbarn** des aktuellen Servers
   (`Terminal/commands/connect.ts:23-37`), oder
2. einen Server, der **bereits eine Backdoor hat** oder einem selbst gehoert
   (`:43-46`) — daher `home` immer.

Sonst: `Cannot directly connect to <host>. Make sure the server is backdoored or adjacent to your current server` (:48-50).
Bei unbekanntem Namen: `Invalid hostname: '<host>'` (:18).

Die Route findet man nicht durch Raten. Zwei Wege:
- **Empfohlen:** die Route im Spiel per Skript ueber `ns.scan()` berechnen
  (Breitensuche ab `home`) und ueber die RFA-Bruecke in eine Datei schreiben;
  `tools/ui.js` nimmt die fertige Route als Parameter entgegen.
- Im Terminal: `scan` zeigt die Nachbarn des aktuellen Servers,
  `scan-analyze <tiefe>` den Baum. Die Tiefe ist ohne Programme auf 3 begrenzt,
  mit `DeepscanV1.exe` auf 5, mit `DeepscanV2.exe` auf 10
  (`Terminal/commands/scananalyze.ts:24-34`). Mit `AutoLink.exe` sind die
  Namen in der `scan-analyze`-Ausgabe direkt anklickbar.

### 8.2 Vorbedingungen fuer `backdoor`

Der Befehl prueft der Reihe nach (`Terminal/commands/backdoor.ts`):

| Bedingung nicht erfuellt | Ausgabe (rot) |
|---|---|
| Argumente angegeben | `Incorrect usage of backdoor command. Usage: backdoor` |
| kein normaler Server | `Can only install a backdoor on normal servers` |
| eigener Server / `home` | `Cannot install a backdoor on your own machines! You are currently connected to your home PC or one of your cloud servers.` |
| **kein Root** | `You do not have admin rights for this machine!` |
| **Hacking-Level zu klein** | `Your hacking skill is not high enough to install a backdoor on this machine. Try analyzing the machine to determine the required hacking skill.` |
| schon vorhanden | `You have already installed a backdoor on this server. You can check the "Backdoor" status via the "analyze" command.` (nur Warnung, es laeuft trotzdem los) |

Root-Rechte muss also vorher ein Skript per `nuke()` besorgen. Das
Hacking-Level ist dasselbe wie fuers Hacken (`requiredHackingSkill`).

### 8.3 Dauer und Erfolg

`backdoor` startet eine Aktion mit **einem Viertel der Hackdauer**
(`Terminal/Terminal.ts:233-243`, `calculateHackingTime(server, Player) / 4`).
Solange:
- ist `#terminal-input` **disabled** (`TerminalInput.tsx:441`)
- laeuft darunter ein 50-Zeichen-Fortschrittsbalken
  (`Terminal/ui/TerminalActionTimer.tsx:10`)

Bei frueh im Spiel erreichbaren Zielen wie `CSEC` sind das Sekunden bis wenige
Minuten; bei hohen Zielen kann es lange dauern. Der Automat sollte also
**auf das Ende der Aktion warten** (Eingabefeld wieder aktiv), nicht auf eine
feste Zeit.

Erfolg: die Zeile `Backdoor on 'CSEC' successful!`
(`Terminal/Terminal.ts:392`). Gegenprobe jederzeit mit `analyze` — dort steht
`Backdoor: YES` bzw. `NO` (`Terminal.ts:411/414`).

Sonderfall: Eine Backdoor auf `w0r1d_d43m0n` beendet den BitNode und springt
auf die BitVerse-Seite (`Terminal.ts:376-380`). Nicht versehentlich ausloesen.

Nebenwirkung: Nach jeder erfolgreichen Backdoor prueft das Spiel sofort die
Faktionseinladungen nach (`Terminal.ts:391-393`) — deshalb ist Aufgabe 3
typischerweise der naechste Schritt.

Die Server, die fuer Faktionen zaehlen (`Server/data/SpecialServers.ts`):
`CSEC` (CyberSec), `avmnite-02h` (NiteSec), `I.I.I.I` (The Black Hand),
`run4theh111z` (BitRunners), `.` (The Dark Army), `The-Cave` (Daedalus),
`fulcrumassets` (Fulcrum Secret Technologies).

---

## 9. Was der Automat nicht aus dem DOM lesen sollte

Geld, Hacking-Level, Stadt, Reputation und Serverzustaende stehen alle auch im
Spiel selbst zur Verfuegung. Der billigere und genauere Weg ist die vorhandene
Bruecke: das Autopilot-Skript schreibt seinen Zustand nach `data/telemetry.txt`,
`sync/bridge.js` liest ihn, `node tools/status.js` zeigt ihn.

Also: **Vorbedingungen ueber die Bruecke pruefen, Aktionen ueber die
Oberflaeche ausfuehren, Erfolg ueber beides gegenpruefen.** Die
`pruefe`-Schritte in `tools/ui.js` nennen jeweils beides — den DOM-Marker und,
wo es sie gibt, die Groesse, die man ueber die Bruecke nachsehen kann.

---

## 10. Offene Punkte

Ehrlich benannt, statt plausibel geraten:

1. **`isTrusted` in der Praxis.** Siehe 0.2. Muss einmal gemessen werden.
2. **ASCII-Karte.** Ich habe den Zusammenhang zwischen Buchstabe in der
   ASCII-Karte und Ort nur im Prinzip nachvollzogen
   (`City.tsx:99-120` uebersetzt den Buchstaben ueber eine A–Z-Tabelle in einen
   Index in `city.locations`). Welcher Buchstabe in welcher Stadt fuer welchen
   Ort steht, habe ich **nicht** einzeln aufgelistet. Wer die ASCII-Karte
   behalten will, sollte den `aria-label`-Weg nehmen (`City.tsx:61`) statt sich
   auf Buchstaben zu verlassen. Einfacher: `Disable ASCII art` einschalten.
3. **Das X-Icon der Modale.** Ob es ein `data-testid` traegt, ist ungeprueft.
   `Escape` funktioniert in jedem Fall bei `canBeDismissedEasily`.
4. **Genaue Wartezeiten.** Fuer `backdoor` habe ich die Formel
   (`Hackdauer / 4`), aber keinen Zahlenwert — der haengt an Serverwerten und
   Spielerlevel. Deshalb ueberall "warten, bis das Eingabefeld wieder aktiv
   ist" statt einer festen Sekundenzahl.
5. **Faktions-Einladungsbedingungen.** Ich habe sie nicht ausgewertet; sie
   stehen in `Faction/FactionJoinCondition.ts` und im Tooltip auf dem
   Faktionsnamen. Der Automat kann nur reagieren, wenn eine Einladung da ist.
6. **Toasts.** Ob und wo `SnackbarEvents` bei diesen Ablaeufen feuern, habe ich
   nicht systematisch verfolgt. Fuer die acht Aufgaben oben habe ich keine
   Toasts gefunden — die Rueckmeldungen laufen ueber Dialoge oder das Terminal.
