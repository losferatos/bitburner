# Die Hintergrund-Drosselung des Bitburner-Tabs

Stand 25.08.2026. Grundlage ist eine unabhaengige Pruefung gegen den
Chromium-Quellcode (Spiegel `chromium/chromium` @ main), die offiziellen
Chrome-Dokumentationen, das Bitburner-Repo (`bitburner-official/bitburner-src`
@ dev) und die eigenen Messwerte aus `src/wakelock.js` und `tools/wache.js`.

Diese Datei existiert, weil das Thema an einem einzigen Tag **drei falsche
Diagnosen** hervorgebracht hat: "der Kauflauf haengt" (21.08.), "der Tonanker
ist ausgefallen" (25.08., 17:48 - er lief) und "es gibt eine zweite,
audio-resistente Drosselung fuer verdeckte Fenster" (25.08., 19:24 - es gibt
sie nicht). Jede kostete Stunden.

---

## 1. Was die eigenen Zahlen sagen

| Datum | Vordergrund | verdeckt | vermeintlicher Faktor |
|---|---|---|---|
| 21.08. | 16 Runden/min | 1,0 | 16 |
| 25.08. | 4,59 Runden/min | 0,93 | 5 |

Beide Messungen landen verdeckt bei **rund einer Runde je Minute, absolut** -
bei voellig verschiedenen Vordergrundraten. Ein proportionaler Mechanismus kann
das nicht erzeugen; ein **Deckel von einem Timer-Aufwachen je Minute** erzeugt
es exakt: Jede Motorrunde von `bn4net.js` enthaelt mindestens ein `await`,
dessen `setTimeout` auf die naechste Minutengrenze ausgerichtet wird - egal ob
die Runde wach 3,75 s oder 13 s dauert.

Gegenprobe: Die Basisstufe (1-Sekunden-Raster) haette am 21.08. aus einer
3,75-s-Runde hoechstens 5-10 s gemacht, also 6-12 Runden je Minute, nie eine.

**Der "Faktor 5" war ein Artefakt der damaligen Vordergrundrate. Die Kenngroesse
ist "ein Aufwachen je Minute" - die intensive Stufe.**

Einordnung: Die Spielengine holt verpasste Zyklen nach (`src/engine.tsx`
rechnet die echte Zeitdifferenz in Zyklen um). Nur Netscript-Wartezeiten
(`netscriptDelay`, `ns.sleep/hack/grow/weaken`) holen nichts nach. "Es trifft
alles" gilt also fuer alles Skriptgetriebene; Engine-Systeme laufen wertmaessig
gedaempft weiter.

---

## 2. Die Mechanik hat drei unabhaengige Ebenen

### Ebene 1 - Sichtbarkeit (Browserprozess)

Ein vollstaendig verdecktes Fenster wird OCCLUDED und der Seite als `hidden`
gemeldet (`content/browser/web_contents/web_contents_impl.cc`,
`ui/aura/native_window_occlusion_tracker_win.cc`).

- Schon **ein sichtbarer Pixelstreifen** macht das Fenster VISIBLE.
- Minimiert = HIDDEN. Anderer virtueller Desktop = OCCLUDED.
- **Sperrbildschirm macht ALLE nicht-minimierten Fenster OCCLUDED**
  (`MarkNonIconicWindowsOccluded`) - das ist der Nachtfall "Bildschirm aus".
- Die Einstufung folgt der Fensterlage nach 16-100 ms, ohne Karenz.
- **Audio spielt hier keine Rolle** (negativ belegt: kein Audio-Kriterium in
  `CalculatePageVisibilityState`).

### Ebene 2 - Timer-Drosselung (Blink-Scheduler im Renderer)

Die Bedingung ist **nur** "hidden UND nicht hoerbar"; die Ursache des
Versteckens ist egal:

```
PageSchedulerImpl::IsBackgrounded(): return !IsPageVisible() && !IsAudioPlaying()
```

Hoerbares Audio (samt 30 s Nachlauf, `kRecentAudioDelay`) erzwingt
`ThrottlingType::kNone` und hebt damit **beide** Stufen auf.

| Stufe | Raster | Bedingung |
|---|---|---|
| Basis | 1 s | hidden, nicht hoerbar |
| Intensiv | 1 min | zusaetzlich Timerketten mit Verschachtelung >= 5, nach Karenz |

Die Karenz betraegt bei fertig geladenen Seiten 10-60 s - fuer einen dauerhaft
offenen Tab also praktisch sofort.

**Zwei verbreitete Annahmen sind widerlegt:**
- Eine offene **WebSocket**-Verbindung (die Remote-API des Spiels!) schuetzt
  seit Maerz 2021 nicht mehr vor der intensiven Stufe.
- Das WebRTC-Opt-out haengt am **aktiven MediaStreamTrack** (Mikrofon/Kamera),
  nicht an einer blossen `RTCPeerConnection`.

### Ebene 3 - Prozess-Prioritaet (Betriebssystem)

Ohne sichtbaren Client und ohne **hoerbaren** Audio-Strom faellt der Renderer
auf `IDLE_PRIORITY_CLASS` plus EcoQoS (wirksam ab Windows 11 22H2). Ein
offener, aber als still eingestufter Strom schuetzt nicht. Das Rendern (rAF)
steht bei `hidden` ohnehin still, Ton hin oder her.

---

## 3. Warum der Tonanker versagte

Chromium entscheidet die Hoerbarkeit **nicht am Zustand des AudioContext**,
sondern misst die **Leistung des tatsaechlich gerenderten Stroms** gegen
`kSilenceThresholdDBFS = -72,24719896` dBFS
(`services/audio/output_stream.cc`, EWMA mit 10-ms-Zeitkonstante, 15-mal je
Sekunde abgetastet). Der offizielle Chrome-Blog sagt es woertlich: eine stille
Tonspur zaehlt nicht.

Fuer einen Sinus ist die Leistung `20*log10(a) - 3 dB`, also **3 dB unter der
Amplitude**. Genau diese drei Dezibel fehlten in der bisherigen Rechnung:

| Verstaerkung | Leistung | Reserve ueber der Schwelle |
|---|---|---|
| 0,00002 | -97,0 dBFS | keine - wirkungslos (Versuch 1, 21.08.) |
| 0,0005 | -69,0 dBFS | **3,2 dB - ein Grenzfall** (Versuch 2) |
| 0,005 | -49,0 dBFS | 23 dB |
| 0,01 | -43,0 dBFS | 29 dB (seit 25.08., 20:03 eingestellt) |

Ein Grenzfall kippt mit dem Ausgabegeraet, dem Mixerpfad oder einer kurzen
`suspended`-Phase zwischen zwei Kontrollen. Das erklaert zwanglos, warum der
Kniff am 21.08. wirkte (die Rate sprang nachweislich auf 59/min) und am 25.08.
nicht mehr - ohne dass sich am Code etwas geaendert haette.

**`ctx.state === "running"` heisst nur, dass der Graph rechnet. Er kann dabei
Stille rechnen.** Der direkte Test ist das **Lautsprechersymbol am Tab** (es
haengt an Chromiums eigenem Audible-Urteil, 2 s Nachlauf).

Nebenbefund: Ein **stummgeschalteter** Tab bleibt "audible" - gemessen wird vor
dem Stummschalten. Mute scheidet als Ursache aus.

Zweiter Pruefpunkt: `ctx.sampleRate`. 19,5 kHz verlangt mindestens 44,1 kHz
Ausgaberate; laeuft der Kontext nach einem Geraetewechsel auf einem
16-kHz-Headsetprofil, liegt der Ton ueber Nyquist und es kommt nichts an.
Deshalb wird die Rate seit dem 25.08. mitgeloggt.

---

## 4. Die Schalter, und was sie wirklich tun

| Schalter | Wirkung |
|---|---|
| `--disable-background-timer-throttling` | **Der wirksame.** Schaltet beide Stufen und das CPU-Budget ab, deckt alle Hidden-Ursachen ab (Tab hinter Tab, minimiert, verdeckt, Sperrbildschirm). |
| `--disable-backgrounding-occluded-windows` | Deutet OCCLUDED in VISIBLE um. Behebt Verdeckung, Sperrbildschirm und virtuelle Desktops - **nicht** Minimieren und nicht "Tab hinter Tab". |
| `--disable-renderer-backgrounding` | Nur Ebene 3 (Prioritaet/EcoQoS). Ersetzt die anderen nicht. |

Alle drei zusammen setzen. **Opera vorher komplett beenden** - eine laufende
Instanz schluckt die Flags der zweiten. Danach unter `opera://about` die
Kommandozeile kontrollieren.

---

## 5. Wege ohne Neustart des Browsers

| Weg | Urteil |
|---|---|
| **Pegel anheben** | Umgesetzt 25.08., 20:03. Wirkt, wenn der Ton dadurch als hoerbar gilt - und schuetzt dann auch Ebene 3. |
| **Worker-Timer-Ersatz** | Der robusteste Weg. Die Worker-Drosselung existiert nur hinter `BlinkSchedulerWorkerThrottling`, und das Merkmal ist standardmaessig **aus**. Bitburner greift `window.setTimeout` bei jedem Aufruf dynamisch ab (Engine-Loop und **alle** Netscript-Wartezeiten, `NetscriptHelpers.tsx`) - ein nachtraeglicher Patch wirkt also sofort auf Engine und Skripte. Grenze: Ebene 3 bleibt. |
| **Picture-in-Picture** | Macht die Seite zu `kHiddenButPainting`, was der Scheduler wie sichtbar behandelt. Kein offizielles Versprechen, in Opera ungeprueft. Braucht eine Nutzergeste und ein offenes Mini-Fenster. |
| **Fensterstreifen sichtbar lassen** | Verhindert OCCLUDED (1-Pixel-Regel). Nachts wertlos, wenn der Rechner sperrt. |
| **Wake Lock API** | **Nutzlos.** Der Screen Wake Lock wird laut Spezifikation freigegeben, sobald das Dokument `hidden` wird. Beruehrt Timer ohnehin nicht. |
| **Stummes Video in Schleife** | **Nutzlos.** Stumm zaehlt nicht als Geraeusch. Mit Tonspur waere es nur ein umstaendlicherer Oszillator. |

---

## 6. Wie man misst, welche Drosselung gerade greift

`src/sonde.js` (seit 25.08.) wirft eine Messschleife in die Seite und schreibt
jede Minute nach `data/sonde.json`. Der Abstand zwischen zwei Aufwachvorgaengen
eines Haupt-Thread-Timers ist der Fingerabdruck:

| `haupt.median` | Bedeutung |
|---|---|
| ~4 ms | ungedrosselt - sichtbar oder hoerbar |
| ~1.000 ms | Basisstufe |
| ~60.000 ms | intensive Stufe |

Die Sonde misst zugleich einen **Worker**-Timer. Grosse Abstaende im
Haupt-Thread bei kleinen im Worker beweisen, dass der Worker-Timer-Ersatz aus
Abschnitt 5 hier wirken wuerde.

Erste Messung 25.08., 20:10 (Fenster im Vordergrund): `haupt.median` 5 ms,
`worker.median` 5 ms, 49,9 Bilder je Sekunde, `sichtbarkeit: visible`,
`stufe: keine`. Der aussagekraeftige Fall ist der verdeckte Tab.

Ausserhalb der Seite:
- **Lautsprechersymbol am Tab** = Chromiums Audible-Urteil. Der direkte Test
  fuer den Tonanker; `state === "running"` ersetzt ihn nicht.
- Task-Manager, Details, Renderer-PID: Effizienzmodus zeigt Ebene 3.
- `opera://about`: sind die Flags aktiv?
- Opera-Einstellungen: **Battery Saver aus?** Opera dokumentiert eine eigene
  Drosselung von Hintergrund-Timern bei aktivem Sparmodus.

---

## 7. Der strukturelle Ausweg: die Steam-Fassung

`electron/gameWindow.js` setzt `backgroundThrottling: false` doppelt - die
Timer-Drosselung ist dort ab Werk aus. Kein `powerSaveBlocker`: Der
Windows-Standby stoppt auch die Steam-Fassung.

Der Spielstand zieht kostenlos um: Options, Export Game, in der Steam-Fassung
importieren. Beide Fassungen speichern in IndexedDB, der Importcode ist
identisch. Vorher pruefen, ob `ExcludeRunningScriptsFromSave` gesetzt ist -
das laesst laufende Prozesse (nicht die Dateien) aus dem Speicherstand.
Versionsparitaet beachten: kein neuerer Web-Stand in eine aeltere Steam-Fassung.

Die echten Kosten liegen in der Werkzeugkette:
- **Bruecke (Port 12525): null Aufwand.** Die Remote File API ist Spielkern und
  in beiden Fassungen identisch.
- **DOM- und CDP-Werkzeuge**: brauchen einen Debugzugang zur Electron-App
  (`--remote-debugging-port`) und eine angepasste Zielsuche; das Auslesen des
  Speicherstands muesste auf das Electron-Profil oder die Disk-Backups
  umziehen. Machbar, aber ein Nachmittag.

---

## 8. Was offen bleibt

- **Versionsdrift**: Alle Codezitate stammen aus dem Chromium-main. Die
  Opera-Basis ist aelter; die Kernmechanik ist seit Jahren stabil, abweichen
  koennen die Karenzzeit und die PiP-Behandlung.
- **Opera ist Closed Source.** Dass Opera hoerbare Tabs trotzdem drosselt,
  laesst sich nicht ausschliessen - dann helfen nur die Flags oder der
  Worker-Ersatz.
- Der Anteil von Ebene 3 (EcoQoS) an der Verlangsamung ist nicht separat
  gemessen.
