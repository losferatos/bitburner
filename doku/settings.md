# Einstellungen des Live-Spielstands (`SettingsSave`)

Vollständige Aufnahme aller 66 Felder aus dem laufenden Spiel, jedes gegen die
Bedeutung in `reference/v301/src/Settings/Settings.ts` gestellt.

**Messung:** `getSaveFile` über die laufende Brücke (Dashboard 8795),
ausgewertet in einem `node`-Einzeiler nach dem Muster von
`sync/backup.js` (`holeSpielstand` :63, `lesenKennwerte` :93).
Zeitpunkt der Antwort **2026-09-03T23:37:28.957Z** = 04.09.2026 01:37:29
Ortszeit (`date`: `Fri Sep 4 01:37:29 2026`).
Spielstand `identifier 197f4d61481686`, BN10 Lauf 2, roh 661.039 B gzip,
4.118.009 Zeichen Klartext, `save.data` hat 15 Schlüssel, `SettingsSave`
enthält **66 Felder** — exakt die 66, die `Settings.ts` definiert, keins mehr
und keins weniger.

Die Feldbedeutungen stammen aus `reference/v301/src/Settings/Settings.ts`
(145 Zeilen, Zeilennummer je Feld unten). Die Wirkungsangaben stammen aus den
tatsächlichen Verwendungsstellen im selben Baum, nicht aus dem Kommentar über
dem Feld.

---

## Drei Befunde vorweg

### B1 — `SaveGameOnBeforeUnload` existiert in v3.0.1 nicht

Der Auftragstext verlangt eine Beurteilung von `SaveGameOnBeforeUnload`.
**Dieses Feld gibt es nicht** — weder im Spielstand (66 Felder, keins heißt so)
noch irgendwo im Quellbaum:

```
grep -rn "SaveGameOnBeforeUnload" reference/v301/src/   ->  exit 1, keine Treffer
```

Was es stattdessen gibt, ist ein festverdrahteter Handler ohne jede
Einstellung, `reference/v301/src/index.tsx:53-58`:

```
(function () {
  if (process.env.NODE_ENV === "development" || location.href.startsWith("file://")) return;
  window.onbeforeunload = function () {
    return "Your work will be lost.";
  };
})();
```

Der Handler **speichert nicht**. Er gibt nur einen String zurück, worauf der
Browser den „Seite verlassen?"-Dialog zeigt. Das hat zwei Folgen, die genau
gegenläufig sind:

- Ein Schließen oder Neuladen des Tabs speichert **nicht**. Alles seit dem
  letzten Autosave ist weg — bei `AutosaveInterval 60` also bis zu 60 s
  Spielzeit, bei einem gedrosselten Tab entsprechend mehr.
- Ein Reload aus einem Skript heraus (Sprosse 4a im Auftrag, Abschnitt 227)
  läuft in genau diesen Dialog, solange `window.onbeforeunload` gesetzt ist.
  Der im Auftrag vorgesehene Handgriff `globalThis["window"].onbeforeunload = null`
  ist deshalb nicht optional, sondern die einzige Umgehung — und er ist
  wirkungslos, wenn das Spiel unter `file://` läuft, weil der Handler dann von
  vornherein nie gesetzt wurde.

Es gibt also **keine Einstellung, mit der man „beim Schließen speichern"
einschalten könnte.** Wer das im Auftragstext als vorhandenes Feld führt, plant
gegen eine Sicherheit, die nicht existiert.

### B2 — Es gibt kein einziges `*SecurityLevel`-Feld in den Einstellungen

Der Auftragstext verlangt „alle `*SecurityLevel`-Felder". In `Settings` kommt
die Zeichenfolge `SecurityLevel` nicht vor:

```
grep -rn "SecurityLevel" reference/v301/src/Settings/   ->  exit 1, keine Treffer
```

`securityLevel` ist eine **Server-Eigenschaft** des Spiels (`hackDifficulty` /
`minDifficulty` an `Server`), keine Spielereinstellung. Es gibt hier nichts zu
prüfen und nichts einzustellen; jede Planung, die eine Sicherheitsstufe über
die Optionen erreichen will, greift ins Leere.

### B3 — `SaveGameOnFileSave` betrifft die Brücke NICHT

`SaveGameOnFileSave` steht auf `true`, und der Name legt nahe, dass jedes
Nachschieben der Brücke einen vollen Spielstand-Schreibvorgang auslöst. Das ist
falsch. Die einzige Verwendungsstelle ist der **Skripteditor im Spiel**:

- `reference/v301/src/ScriptEditor/ui/utils.ts:97` — `if (Settings.SaveGameOnFileSave)`

Der RFA-Pfad geht daran vorbei. `pushFile` ruft ausschließlich
`server.writeToContentFile(...)` auf und gibt `OK` zurück
(`reference/v301/src/RemoteFileAPI/MessageHandlers.ts:88-99`); kein
`saveObject.saveGame`, kein `Player.lastSave`.

Praktische Folge, und die ist unangenehm: **ein Hot-Swap der Brücke ist nach
einem Absturz des Browsers nicht persistent.** Der Code liegt bis zum nächsten
Autosave nur im Hauptspeicher des Spiels. Der Schutz dagegen ist das
`pre-hotswap`-Backup vor dem Schieben, nicht diese Einstellung.

Gegenprobe für `getSaveFile`: es ruft `saveObject.getSaveData()`
(`MessageHandlers.ts:222-223`), nicht `saveGame()`. Das Lesen des Spielstands
über die Brücke **verändert den Spielstand nicht** und setzt `Player.lastSave`
nicht — die Annahme in `sync/backup.js:14-17` ist damit am Quellcode bestätigt.

---

## Die Uhr, an der `AutosaveInterval` hängt

Weil im Projekt schon einmal Echtzeit gegen Spielzeit verwechselt wurde, hier
die Kette vollständig belegt:

- `Engine.Counters.autoSaveCounter` startet bei **300**
  (`reference/v301/src/engine.tsx:147`), Einheit: Spielzyklen à 200 ms
  (`src/Constants.ts:19`, `MilliPerCycle: 200`; Kommentar `engine.tsx:141-144`).
- Bei jedem Durchlauf sinkt er um `numCycles`
  (`engine.tsx:135` → `decrementAllCounters`, `:162-169`).
- `numCycles` ist die **Wanduhr-Differenz geteilt durch 200 ms**, ungedeckelt:
  `diff = Math.floor((now - _lastUpdate) / MilliPerCycle)` (`engine.tsx:417-427`).
- Bei `<= 0` wird gespeichert und auf `AutosaveInterval * 5` zurückgesetzt
  (`engine.tsx:225-236`).

**Antwort auf die drei Verifikationsfragen:**

1. **Welche Uhr?** Wanduhr, gemessen zum Zeitpunkt des Schleifendurchlaufs.
   `AutosaveInterval 60` heißt: gespeichert wird beim ersten Durchlauf, bei dem
   seit dem letzten Speichern ≥ 60 s Wanduhr vergangen sind. Nicht Spielzeit,
   nicht Motorzeit.
2. **Stillstand und Nachholen?** Der Offline-Nachholblock beim Laden
   (`engine.tsx:258-345`) ruft `updateGame` **nicht** auf und dekrementiert die
   Zähler daher nicht; `_lastUpdate` wird vorher auf „jetzt" gesetzt
   (`:258`). Eine Offline-Nacht verbraucht also kein Autosave-Guthaben, und der
   erste Autosave nach dem Laden kommt ~60 s später. **Bei einem gedrosselten,
   verdeckten Tab** (1 Timer-Wake/min) läuft die Schleife einmal je Minute mit
   `diff ≈ 300` — der Zähler fällt in einem Sprung unter 0, es wird gespeichert.
   Autosave bleibt also auch im gedrosselten Tab wirksam; was fehlt, ist nicht
   der Speichervorgang, sondern die Auflösung.
3. **Rate oder Bestand?** Weder. Es ist eine Schwelle in Zyklen. Das
   „Sicherungsalter" in `data/bridge-heartbeat.json` ist dagegen ein Bestand
   (Alter der jüngsten Datei) — die beiden nicht verwechseln.

---

## Alle 66 Felder

Spalte „Std." = Vorgabe in `Settings.ts` (Zeile in Klammern).
**Fett** = weicht vom Standard ab. „Bot" = Wirkung auf den autonomen Betrieb.

### Fernsteuerung (RFA) — die vier Felder, an denen die Brücke hängt

| Feld (Zeile) | Live | Std. | Bedeutung / Bot |
|---|---|---|---|
| **`RemoteFileApiPort` (47)** | **12525** | 0 | Port, zu dem das Spiel sich verbindet. **0 schaltet RFA ganz ab** (`RemoteFileAPI.ts:8`). Ohne diesen Wert gibt es keine Brücke, kein Backup, kein Nachschieben. Zusätzlich ist er der **einzige Fingerabdruck, der LIVE von einer Kopie trennt**: `sync/backup.js:243-248` und `sync/bridge.js:636-641` lehnen jeden Spielstand ab, dessen Port nicht 12525 ist. Wird er im Live-Spiel geändert, fällt danach **jede** Sicherung durch — Ausfall ohne Fehlermeldung im Spiel. |
| `RemoteFileApiAddress` (45) | `"localhost"` | `"localhost"` | Zieladresse. Leerstring wird zu `localhost` (`RemoteFileAPI.ts:10`), ungültige Werte werden beim Laden auf `localhost` zurückgesetzt (`SettingsUtils.ts:124-126`). |
| **`RemoteFileApiReconnectionDelay` (49)** | **5** | 0 | Sekunden bis zum Wiederverbinden nach einem `close`. **Bei 0 wird nie automatisch neu verbunden** (`Remote.ts:92-108`). Das ist der Grund, warum ein Neustart der Brücke heute ohne Handgriff im Spiel funktioniert: das Spiel wählt binnen 5 s neu an. Beleg im Betrieb: `data/bridge.log`, drei Brückenstarts am 04.09. (01:25:28 / 01:27:35 / 01:31:48 UTC-Zeilen 23:25/23:27/23:31), jedes Mal „Spiel verbunden" 4-5 s später. |
| `UseWssForRemoteFileApi` (51) | `false` | `false` | `ws://` statt `wss://` (`Remote.ts:42`). Muss `false` bleiben — die Brücke ist ein einfacher `ws`-Server. |

### Start und Speichern

| Feld (Zeile) | Live | Std. | Bedeutung / Bot |
|---|---|---|---|
| **`AutoexecScript` (15)** | **`"boot.js"`** | `""` | Skript, das beim Laden auf `home` gestartet wird (`NetscriptWorker.ts:186-210`, eingehängt in `loadAllRunningScripts` `:250-255`). **Das ist die gesamte Selbstheilung nach einem Neuladen.** Zwei Fallen: (a) Der Autoexec wird nur eingereiht, wenn `server.savedScripts` existiert — bei `?noscript` in der URL oder fehlendem Feld wird er **übersprungen** (`:237-247`); ein leeres Array reicht dagegen aus. (b) Ist der Name ungültig, fehlt die Datei oder hat sie Fehler, kommt statt des Starts ein **Dialogfenster** (`:192-208`), das im DOM stehen bleibt. |
| `AutosaveInterval` (17) | 60 | 60 | Sekunden bis zum nächsten Autosave, siehe Abschnitt „Die Uhr" oben. **0 schaltet Autosave ab** (`engine.tsx:229-232`) — dann verwirft jeder Reload beliebig viel Spielzeit. Der Recovery-Modus setzt genau das (`RecoveryRoot.tsx:80`), und zwar unsichtbar für alles, was im Spiel läuft. |
| `ExcludeRunningScriptsFromSave` (77) | `false` | `false` | Bei `true` werden laufende Skripte **nicht** mitgespeichert (`BaseServer.ts:302-305`) — nach einem Reload liefe dann nur noch der Autoexec an. Muss `false` bleiben. |
| `SaveGameOnFileSave` (53) | `true` | `true` | Nur Skripteditor, **nicht** die Brücke. Siehe Befund B3. |
| `SuppressSavedGameToast` (69) | `false` | `false` | Bei `false` gibt jeder Autosave einen Toast (`engine.tsx:234`). Alle 60 s ein Overlay-Element — für DOM-Werkzeuge ein Störfaktor, wenn auch ein kurzer. |
| `SuppressAutosaveDisabledWarnings` (71) | `false` | `false` | Warnt, wenn Autosave aus ist (`engine.tsx:448`). Ohne Wirkung, solange `AutosaveInterval` 60 ist — aber genau die Meldung, die den Recovery-Modus verraten würde. |

### Dialoge und Modale — was dem Bot vor der Nase steht

Diese Gruppe entscheidet, ob ein Modal im DOM stehen bleibt, während ein
DOM-Werkzeug (`hand.js`, `join.js`, `buyaugs.js`, `travel.js`, `backdoor.js`,
`darkweb.js`, `homeram.js`, `keepalive.js`) klicken will.

| Feld (Zeile) | Live | Std. | Bedeutung / Bot |
|---|---|---|---|
| **`SuppressBuyAugmentationConfirmation` (55)** | **`true`** | `false` | Unterdrückt die Kaufbestätigung (`FactionHelpers.tsx:122`, `AugmentationsPage.tsx:249`, `AugmentationsRoot.tsx:101`). **Vorbedingung für `buyaugs.js`** — ohne sie käme je Kauf ein Modal. |
| **`SuppressTravelConfirmation` (63)** | **`true`** | `false` | Reise ohne Rückfrage (`TravelAgencyRoot.tsx:30,45`). Vorbedingung für `travel.js`. |
| `SuppressFactionInvites` (59) | `false` | `false` | Bei `false` **öffnet jede neue Faktionseinladung ein Modal** (`FactionHelpers.tsx:30-32`). Die Prüfung läuft alle 10 Zyklen = 2 s (`engine.tsx:150,180-186`). In einem Knoten, in dem viele Einladungen kommen, ist das der wahrscheinlichste Grund für ein stehendes Fenster über der Oberfläche. Der Bot beitritt selbst (`joinfac.js`/`join.js`), das Modal ist reiner Ballast. **Kandidat für `true` — Handgriff von Eric, nicht von der Brücke** (Änderungen an Live-Einstellungen sind nach Auftrag 344 verboten). |
| `SuppressMessages` (61) | `false` | `false` | Bei `false` öffnet jede eintreffende `.msg`-Datei ein Dialogfenster (`MessageHelpers.tsx:14-38`). Geprüft alle 150 Zyklen = 30 s (`engine.tsx:156,190-196`). Gleiche Störklasse wie oben, nur seltener. |
| `SuppressErrorModals` (57) | `false` | `false` | Bei `false` bekommt jeder Skriptfehler ein Fehlermodal (`ErrorModal.tsx:78`). Bei einem Bot mit ~110 Skripten ist das die zweite große Quelle stehender Fenster. Anmerkung: der Schalter im Modal wirkt nur 5 Minuten. |
| `SuppressBladeburnerPopup` (65) | `false` | `false` | Bei `false` erscheint ein Dialog, wenn eine Bladeburner-Aktion abgebrochen wird, weil die Figur etwas anderes anfängt (`Bladeburner.ts:1356-1366`). **In BN6/BN7 und überall, wo `blade.js`/`bbtrain.js` neben Faktionsarbeit laufen, ist das der Dauerbrenner.** Im aktuellen BN10 weniger relevant. |
| `SuppressTIXPopup` (67) | `false` | `false` | Dialoge bei Börsenaufträgen (`OrderProcessing.tsx:150`). Wird relevant, sobald das BN8-Gewerk gebaut ist. |

### Oberfläche — was DOM-Werkzeuge sehen

| Feld (Zeile) | Live | Std. | Bedeutung / Bot |
|---|---|---|---|
| **`DisableASCIIArt` (19)** | **`true`** | `false` | Stadt, Reisebüro, Bladeburner-Reise und **die Bitverse-Darstellung** werden als Knopfliste statt als ASCII-Bild gezeichnet (`City.tsx:155`, `TravelAgencyRoot.tsx:61`, `Bladeburner/ui/TravelModal.tsx:29`, `BitverseRoot.tsx:92,118,269`). **Verhaltensrelevant für den Sprung:** Wer den Ausgang über das DOM klickt, sieht eine andere Struktur, je nachdem wie dieses Feld steht. Ein Werkzeug, das gegen die ASCII-Variante geschrieben ist, findet in dieser Einstellung nichts. |
| **`DisableTextEffects` (23)** | **`true`** | `false` | Schaltet die „Korruptions"-Verfremdung von Text ab (`CorruptibleText.tsx:35,61`). Damit ist Text im DOM **wörtlich lesbar** — Vorbedingung für jedes Werkzeug, das Knöpfe oder Zeilen an ihrem Text erkennt. |
| **`ActiveScriptsServerPageSize` (11)** | **100** | 10 | Server je Seite auf der Active-Scripts-Ansicht (`ActiveScriptsPage.tsx:19`). Rein anzeigend; kein `src/`-Skript liest diese Seite. |
| `ActiveScriptsScriptPageSize` (13) | 10 | 10 | dito, Skripte je Seite. |
| `DisableHotkeys` (21) | `false` | `false` | Globale Tastenkürzel aktiv (`SidebarRoot.tsx:281`, `ScriptEditorRoot.tsx:257`). Der Bot tippt nicht, sondern setzt `value` und feuert Events — ohne Belang. |
| `DisableOverviewProgressBars` (25) | `false` | `false` | Fortschrittsbalken in der Übersicht. Ohne Belang. |
| `IsSidebarOpened` (79) | `true` | `true` | Seitenleiste offen (`SidebarRoot.tsx:308-311`). Ohne Belang; die Werkzeuge greifen auf benannte Elemente zu. |
| `TailRenderInterval` (81) | 1000 | 1000 | Neuzeichnung der Tail-Fenster in ms (`LogBoxManager.tsx:189`). Bei vielen offenen Tails Rechenlast, sonst ohne Belang. |
| `GoTraditionalStyle` (31) | `false` | `false` | Darstellung von IPvGO. Ohne Belang. |
| `EnableBashHotkeys` (27) | `false` | `false` | Terminal-Tastenkürzel. Ohne Belang (siehe `DisableHotkeys`). |
| `EnableHistorySearch` (29) | `false` | `false` | Terminal-Historiensuche. Ohne Belang. |

### Kapazitäten — die vier Deckel

| Feld (Zeile) | Live | Std. | Bedeutung / Bot |
|---|---|---|---|
| `MaxTerminalCapacity` (43) | 500 | 500 | Zeilen im Terminal; ältere werden abgeschnitten (`Terminal.ts:173-175`), `grep` kürzt zusätzlich (`grep.ts:32,377`). **Verhaltensrelevant:** `src/hand.js:63` liest die Terminalausgabe direkt aus dem DOM (`[...doc.querySelectorAll("#terminal li, #terminal p")]`). Was über 500 Zeilen hinausläuft, ist für die Hand **nicht mehr da** — nicht abgeschnitten, sondern nie gesehen. Ein Befehl mit langer Ausgabe (`scan-analyze -a`, `ls` auf einem vollen Rechner) kann seine eigene Antwort aus dem Puffer drücken. |
| `MaxLogCapacity` (39) | 50 | 50 | Logzeilen je laufendem Skript (`RunningScript.ts:103`). Kein `src/`-Skript ruft `getScriptLogs` auf (geprüft: nur `NetscriptDefinitions.d.ts`), die Werkzeuge schreiben in Dateien. Für die menschliche Fehlersuche im Tail-Fenster ist 50 knapp. |
| `MaxPortCapacity` (41) | 50 | 50 | Einträge je Netscript-Port; darüber wird vorn herausgeschoben (`NetscriptPort.ts:59,65,95`). Der Bot benutzt genau **einen** Port, den Sperrkassen-Port in `src/autopilot.js:4,656-657`, und der wird vor jedem Schreiben mit `clearPort` geleert — der Deckel kann dort nicht greifen. |
| `MaxRecentScriptsCapacity` (37) | 50 | 50 | Länge der Liste zuletzt beendeter Skripte (`RecentScripts.ts:19`). Reine Anzeige. |

### Zahlen- und Textdarstellung (alle auf Standard, ohne Wirkung auf den Bot)

| Feld (Zeile) | Live | Std. |
|---|---|---|
| `Locale` (35) | `"en"` | `"en"` |
| `TimestampsFormat` (33) | `""` | `""` |
| `UseIEC60027_2` (73) | `false` | `false` |
| `ShowMiddleNullTimeUnit` (75) | `false` | `false` |
| `hideTrailingDecimalZeros` (125) | `false` | `false` |
| `hideThousandsSeparator` (127) | `false` | `false` |
| `useEngineeringNotation` (129) | `false` | `false` |
| `disableSuffixes` (131) | `false` | `false` |
| `fractionalDigits` (133) | 3 | 3 |
| `CurrencySymbol` (135) | `"$"` | `"$"` |
| `CurrencySymbolAfterValue` (137) | `false` | `false` |

Diese elf Felder verändern **nur die Anzeige**. Kein `src/`-Werkzeug parst
formatierte Zahlen aus dem DOM zurück; wo Zahlen gebraucht werden, kommen sie
aus `ns.*`. Würde sich das ändern, wären `disableSuffixes`,
`useEngineeringNotation` und `hideThousandsSeparator` sofort verhaltensrelevant.

### Sortierung von Augmentierungen

| Feld (Zeile) | Live | Std. | Bedeutung |
|---|---|---|---|
| `OwnedAugmentationsOrder` (91) | `1` | `1` | `OwnedAugmentationsOrderSetting.AcquirementTime` (`SettingEnums.ts:12-15`) — Standard. |
| `PurchaseAugmentationsOrder` (93) | `1` | `1` | `PurchaseAugmentationsOrderSetting.Default` (`SettingEnums.ts:3-8`) — Standard. |

**Anmerkung:** Beides sind numerische Enums, also die Zahl `1`, nicht der Name.
Bei `PurchaseAugmentationsOrder` bedeutet `1` „Default", bei
`OwnedAugmentationsOrder` bedeutet `1` „AcquirementTime". Zwei verschiedene
Enums, zufällig gleicher Zahlenwert — wer den Wert aus einem Feld ins andere
überträgt, bekommt etwas anderes, als er denkt. Verhaltensrelevant wäre das nur
für ein Werkzeug, das die Aug-Liste über das DOM abliest und sich auf die
Reihenfolge verlässt; `buyaugs.js` tut das nicht.

### Skripteditor (13 Felder, alle ohne Wirkung auf den Bot)

Der Bot benutzt den Editor nie — Code kommt ausschließlich über `pushFile`.
Alle Werte auf Standard.

| Feld (Zeile) | Live | Std. |
|---|---|---|
| `MonacoTheme` (95) | `"monokai"` | `"monokai"` |
| `MonacoInsertSpaces` (97) | `true` | `true` |
| `MonacoTabSize` (99) | 2 | 2 |
| `MonacoDetectIndentation` (101) | `false` | `false` |
| `MonacoFontFamily` (103) | `"JetBrainsMono"` | `"JetBrainsMono"` |
| `MonacoFontSize` (105) | 20 | 20 |
| `MonacoFontLigatures` (107) | `false` | `false` |
| `MonacoDefaultToVim` (109) | `false` | `false` |
| `MonacoWordWrap` (111) | `"off"` | `"off"` |
| `MonacoBeautifyOnSave` (113) | `false` | `false` |
| `MonacoCursorStyle` (115) | `"line"` | `"line"` |
| `MonacoCursorBlinking` (117) | `"blink"` | `"blink"` |
| `MonacoStickyScroll` (119) | `{"enabled":false}` | `{enabled:false}` |
| `MonacoMinimap` (121) | `{"enabled":true}` | `{enabled:true}` |
| `MonacoAutoSaveOnFocusChange` (123) | `true` | `true` |

### Sonstiges

| Feld (Zeile) | Live | Std. | Bedeutung |
|---|---|---|---|
| `SyncSteamAchievements` (144) | `true` | `true` | Ohne Wirkung in der Webversion. |
| `KeyBindings` (142) | `{}` | `{}` | Keine eigenen Tastenbelegungen; wird beim Laden mit den Vorgaben verschmolzen (`SettingsUtils.ts:130`). |
| **`overview` (87)** | **`{"x":-3,"y":114,"opened":true}`** | `{x:0,y:0,opened:true}` | Position der Figurenübersicht. Von Hand verschoben, rein optisch. |
| `styles` (85) | `{"lineHeight":1.5,"fontSize":14,"tailFontSize":16,"fontFamily":"JetBrainsMono, \"Courier New\", monospace"}` | identisch (`Themes/Styles.ts:3-8`) | Standard. |
| `theme` (83) | 38 Farbfelder, siehe unten | Standard-Theme | Optisch. |
| `EditorTheme` (89) | 5 Zweige, siehe unten | Standard-Monaco-Theme | Optisch. |

Vollständige Werte der beiden verschachtelten Felder, damit die Aufnahme
lückenlos ist:

```json
"theme": {"primarylight":"#0f0","primary":"#0c0","primarydark":"#090","successlight":"#0f0","success":"#0c0","successdark":"#090","errorlight":"#f00","error":"#c00","errordark":"#900","secondarylight":"#AAA","secondary":"#888","secondarydark":"#666","warninglight":"#ff0","warning":"#cc0","warningdark":"#990","infolight":"#69f","info":"#36c","infodark":"#039","welllight":"#444","well":"#222","white":"#fff","black":"#000","hp":"#dd3434","money":"#ffd700","hack":"#adff2f","combat":"#faffdf","cha":"#a671d1","int":"#6495ed","rep":"#faffdf","disabled":"#66cfbc","backgroundprimary":"#000","backgroundsecondary":"#000","button":"#333","maplocation":"#ffffff","bnlvl0":"#ffff00","bnlvl1":"#ff0000","bnlvl2":"#48d1cc","bnlvl3":"#0000ff"}

"EditorTheme": {
  "base": "vs-dark",
  "inherit": true,
  "common": {"accent":"B5CEA8","bg":"1E1E1E","fg":"D4D4D4"},
  "syntax": {"tag":"569CD6","entity":"569CD6","string":"CE9178","regexp":"646695","markup":"569CD6","keyword":"569CD6","comment":"6A9955","constant":"569CD6","error":"F44747"},
  "ui": {"line":"1E1E1E","panel":{"bg":"252526","selected":"252526","border":"1E1E1E"},"selection":{"bg":"ADD6FF26"}}
}
```

---

## Zusammenfassung: was den Bot steuert

**Vier Felder sind Vorbedingungen. Fällt eines, steht der autonome Betrieb:**

| Feld | Live | Was ohne es passiert |
|---|---|---|
| `RemoteFileApiPort` | 12525 | Bei 0 keine Brücke, keine Sicherung, kein Hot-Swap. Bei jedem anderen Wert lehnen `backup.js` und `bridge.js` den Spielstand ab. |
| `AutoexecScript` | `"boot.js"` | Nach einem Reload läuft **nichts** an. |
| `AutosaveInterval` | 60 | Bei 0 verwirft jeder Reload beliebig viel Spielzeit. |
| `ExcludeRunningScriptsFromSave` | `false` | Bei `true` kommt nach einem Reload nur der Autoexec zurück. |

Diese vier sind bereits die Torbedingung der Sprosse 4a im Auftrag (Zeile 227)
und stehen heute alle richtig. Sie werden von `sync/backup.js:150-153` bei
jeder Sicherung mitgelesen und liegen damit in jedem `LIVE_`-Backup.

**Drei Felder sind bereits richtig gesetzt, damit DOM-Werkzeuge arbeiten
können:** `SuppressBuyAugmentationConfirmation`, `SuppressTravelConfirmation`,
`DisableTextEffects`.

**Vier Felder stehen auf `false` und lassen Modale stehen** —
`SuppressFactionInvites`, `SuppressMessages`, `SuppressErrorModals`,
`SuppressBladeburnerPopup`. Jedes davon kann ein Fenster über die Oberfläche
legen, während ein DOM-Werkzeug klicken will. Ob das im Betrieb tatsächlich
stört, ist **nicht gemessen** und gehört gemessen, bevor jemand daran dreht;
eine Änderung an Live-Einstellungen ist ohnehin Erics Handgriff (Auftrag 344).

**Ein Feld ist verhaltensrelevant und leicht zu übersehen:**
`DisableASCIIArt = true` verändert die Bitverse-Darstellung
(`BitverseRoot.tsx:92,118,269`) — also genau die Seite, über die der Bot den
Knoten verlässt.

**Ein Deckel kann Daten fressen:** `MaxTerminalCapacity 500` gegen
`src/hand.js:63`, das die Terminalzeilen aus dem DOM liest.
