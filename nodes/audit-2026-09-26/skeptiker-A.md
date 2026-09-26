# Skeptiker Paket A (bn4rep, A1-A7) - 26.09.2026

Geprueft: `origin/worktree-agent-a835831a3142b1944` (da1a8ce, caa4091, 6a75289) gegen
`origin/master`. Spielquelle: Tag v3.0.2 existiert nicht (`git ls-remote --tags`: nur bis
v3.0.1), `stable` steht auf 3.0.1 - geprueft wurde deshalb `dev` (package.json 3.0.2,
6f930b5, 24.09.2026). Zeilen ohne Pfadpraefix beziehen sich auf `src/bn4rep.js` im Branch.
Spielstaende: `audit-input/backups` (8 Staende BN1.3/BN5.2), dekodiert und nachgerechnet
mit Skripten (nicht committet): Einkommen = `moneySourceA.hacking / playtimeSinceLastAug`,
Preise = Basis x AugmentationMoneyCost x 1,9^q (kein SF11 im Bestand), `levelNutzen` direkt
aus `src/lib/hackaugs.js` aufgerufen, `unbezahlbarInHorizont` direkt aus `src/lib/einbau.js`.

Tests: `node tools/test-bn4rep-einbau.js` 34/34 gruen. `node tools/test-alles.js --schnell`:
2 rote Dateien (test-ram.js "Zeile veraltet" ueber 34 Dateien, test-boerse.js BN8-Shorts) -
beide unabhaengig vom Branch (Eichung gegen v301, Cloud-Umgebung ohne `reference/v301`).

---

## Einwaende

### 1. BLOCKER - A5 feuert in der ERSTEN Runde nach jedem (Neu)Start schaerfer als die alte Regel

- **Code:** `:398-403` `geldVorherRunde = null`, `einkommenProSek = 0`, `letzteSpendeRunde = -10`;
  `:593-603` aktualisiert die Rate erst ab der zweiten Runde. In Runde 1 ist also
  `einkommenProSek = 0` und `spendetGeradeAnSchwellenfaktion = false` (1 - (-10) = 11),
  `unbezahlbarInHorizont` reduziert sich auf `preis > geld` - strenger als das alte
  `preis > 4 * geld`, das der Fix entschaerfen sollte.
- **Nachgerechnet mit `src/lib/einbau.js`** (naechstes wertvolles Stueck nach `hatEchtenWert`):

  | Stand | Stueck | Preis | Geld | ALT (4x) | NEU Runde 1 (inc=0) | NEU eingeschwungen |
  |---|---|---|---|---|---|---|
  | BN5.2 16:57:10 | Neuralstimulator q=3 | 41,15 Mrd (= Logpreis) | 2,60 Mrd | feuert | **feuert** | nein (354 M/s) |
  | BN5.2 19:03:08 | PCMatrix q=3 | 27,44 Mrd | 13,81 Mrd | nein | **feuert** | nein (1040 M/s) |
  | BN1.3 00:23:13 | PCMatrix q=3 | 13,72 Mrd | 1,50 Mrd | feuert | **feuert** | nein (750 M/s) |

  Bei 19:03 feuert die NEUE Fassung, wo selbst die alte nicht gefeuert haette.
- **Wann tritt Runde 1 mitten im Zyklus auf:** `return` in main bei Graft/Interlock/Handschlag
  (`:1484`, `:1508`, `:1529`, siehe Einwand 5) mit Neustart durch bn4net
  (`restartPolicy: always`), Wirtswechsel der Strafleiter Sprosse 2 (`bn4net.js:3699ff`),
  Ausweichen auf home ("bn4rep.js passt nicht auf I.I.I.I (63.3 GB) - weiche auf home aus",
  bn4net-log 18:56:50) - und `tools/neustart.js` direkt nach dem Einspielen dieses Branches
  (PAUSE-Plan). Mit `wartend >= 3` (15:12: 10, 17:19: 9 wartend) baut der Bot dann sofort ein.
- **Fix:** Rate nicht selbst aus Rundendifferenzen schaetzen, sondern
  `ns.getTotalScriptIncome()[0]` lesen (0,1 GB, `RamCostGenerator.ts:652`,
  `NetscriptFunctions.ts:1240-1250`: Summe `onlineMoneyMade/onlineRunningTime` aller
  laufenden Skripte, sofort gueltig, ohne Aufwaermphase). Zusaetzlich die Regel nie
  strenger als vorher machen:
  `return preis > Math.max(4 * geld, geld + Math.max(0, einkommenProSek) * horizontSek);`
  und einen Test "inc = 0 -> Verhalten wie alt".

### 2. SHOULD-FIX - "nur wertvolle Stuecke" filtert Magnetism Amplifier NICHT und DMA faelschlich

- **Code:** `:827-829` `hatEchtenWert` = `levelNutzen(...) > 0`; `lib/hackaugs.js:184-185`
  zaehlt `company_rep` mit halbem Gewicht. Der Kommentar `:821-824` und `lib/einbau.js:132-135`
  behaupten, Magnetism Amplifier werde damit ausgeschlossen.
- **Gerechnet (levelNutzen, mult 9,98, Ziel 4500):** Magnetism Amplifier **0,0477 > 0**
  (gilt als wertvoll), PCMatrix 0,0748, Neuralstimulator 0,1331, dagegen ENM Direct Memory
  Access **0,0000**, NMI 0,0000, LuminCloaking-V1 0,0000. Der vom Audit zuerst genannte
  Fehlausloeser (BN1.3 21:54, Magnetism) bleibt also Kandidat fuer `naechstes`; DMA
  (hacking_money 1,4, hacking_chance 1,2) wird fuer `naechstes`, `geldWegZu` UND A7
  (`:1114-1115`) wertlos - reserviert aber weiter Geld (`teuerstesVerdiente` ungefiltert,
  `:863-864`, Spendenweg `:2208`) und wird gekauft. Dieselbe Sache ist damit gleichzeitig
  "wertlos" und "vorrangig bezahlen".
- **Fix:** eigenes Wertmass fuer Einbauentscheidungen, das `company_rep` ignoriert
  (`HACK_AUGS[name]` ohne company_rep-Term) und die Geld-/Chance-Werte des Hackingknotens
  mitzaehlt; Reservierung und Kaufschleife mit demselben Mass filtern oder den Kommentar
  korrigieren. Test mit den echten Namen (Magnetism, DMA, PCMatrix), nicht mit `wertlosGilt`
  (der Parameter ist an beiden Aufrufstellen `:842`, `:875` fest `false` - toter Zweig).

### 3. SHOULD-FIX - A4 kauft die NFG-Stufe auch dort, wo danach kein Einbau folgen darf

- **Code:** `:1580` prueft nur `!gesperrt && spendenrechtFaellig && wartend === 0`. Der Einbau
  verlangt dagegen zusaetzlich `!ausgangSteht`, `wiederaufbauHilfe` und im Kampfknoten
  `wartend >= MINDEST_WARTESCHLANGE` (`:1236-1237`, `:1348-1350`).
- **Folge:** Im Kampfknoten (BN6/7, 30 von 40 Laeufen) macht die eine Stufe `wartend = 1`,
  `spendenAusnahme` bleibt falsch (braucht 3), NFG hilft dem Wiederaufbau nicht
  (`WIEDERAUFBAU_MULTS` erfuellt, aber nur zusammen mit 2 weiteren Stuecken) - jedes weitere
  Stueck des Zyklus kostet x1,9 (`AugmentationHelpers.ts:29-37`), ohne dass ein Einbau kommt.
  Nach eingebautem Red Pill (Aufstieg, `ausgangSteht`, Level < Ziel) wird eine nie
  einzubauende Stufe gekauft (klein).
- **Fix:** `sollFuellstueckSofortKaufen` die Einbau-Vorbedingungen mitgeben:
  `!ausgangSteht && wiederaufbauHilfe && !kampfKnotenEinbau` (im Kampfknoten ist die
  Einzelstufe per Definition nutzlos) und einen Test je Fall.

### 4. SHOULD-FIX - A1 wertet ein nur GEKAUFTES NMI als Strafbefreiung; das Spiel nicht

- **Code:** `:2351-2353` `hatNmi: besitz.has(...)`, `besitz = new Set(alleAugs)` = inkl.
  Warteschlange. Kommentar `:2331-2335` und `lib/einbau.js:163-166`: "`true` zaehlt auch die
  Warteschlange".
- **Spiel:** `PlayerObjectGeneralMethods.ts:622-628` ruft `hasAugmentation(NMI, true)`;
  `Person.ts:232-239`: der zweite Parameter heisst `ignoreQueued` - `true` ignoriert die
  Warteschlange. Gekauft-nicht-eingebaut zaehlt NICHT.
- **Folge:** Sobald NMI gekauft ist (Kaufschleife `:1553-1560` kauft jedes verdiente Stueck,
  NMI hat levelNutzen 0 und wird nie Ziel, aber mitgenommen), hoert die Fokus-Rueckholung
  fuer den Rest des Zyklus auf, die Strafe x0,8 gilt weiter. In den Staenden nie aufgetreten
  (NMI nirgends besessen), also latent.
- **Fix:** `hatNmi: eingebauteAugs.includes("Neuroreceptor Management Implant")`, Kommentare
  korrigieren.

### 5. SHOULD-FIX - Begleitdefekt: `return` in main beendet bn4rep (bestaetigt, drei Stellen)

- **Bestaetigt:** master `:1397` (Branch `:1529`) `return` nach `!hs.darf` liegt in
  `for (;;) { try { ... } }` direkt in `async function main` - der Prozess endet. Dasselbe bei
  Graft (`:1484`, master `:1352`) und Ausgangs-Interlock (`:1508`, master `:1376`). Der Text
  "Naechste Runde erneut" (`:1483`) stimmt nicht: es gibt keine naechste Runde, nur einen
  Neustart durch bn4net - und der loest Einwand 1 aus.
- **Verschaerfend:** Die NFG-Schleife (`:1421-1443`, bis zu 40 Stufen, mit Spenden) laeuft VOR
  Graft-, Interlock- und Handschlagpruefung. Bei offenem Ausgang (Black-Ops-Weg, wo kein
  `ausgangSteht`-Riegel greift) kauft jeder Anlauf NFG mit genau dem Geld, das der Interlock
  fuer exit.js schuetzen soll (Kommentar `:1487-1501`), dann `return`, Neustart, erneut.
  `handschlag` schreibt `data/install-sperre.txt` LOKAL (`lib/handschlag.js:283-303`, dort
  selbst als wirkungslos vermerkt); bn4rep liest sie `liesVonHome` (`:897`) - auf der Werkbank
  greift die 1-h-Sperre nie. `einbauErlaubt(lg, ..., lg.offenSeit ?? null)` (`:1506`):
  `lage()` liefert kein `offenSeit` (`lib/endspurt.js:114-122`), die Aufgabe-Klausel nach
  `SPERRE_HOECHSTENS_MS` ist tot.
- **Patch (Branch-Zeilen):**
  1. Graft- und Interlockpruefung (`:1478-1510`) VOR die NFG-Schleife (`:1419`) ziehen, beide
     mit `await ns.sleep(15000); continue;` statt `return;`.
  2. Handschlag (`:1524-1531`):
     ```js
     if (!hs.darf) {
       sag("Einbau ausgesetzt: " + hs.grund);
       // handschlag.js schreibt die Sperre lokal - auf der Werkbank saehe
       // liesVonHome sie nie. Hier auf home spiegeln; das JSON mit `bis` liest
       // der Sperrblock (:1043-1047) korrekt, sie laeuft nach 1 h ab.
       try {
         schreibNachHome(INSTALL_LOCK_FILE, JSON.stringify({
           ts: Date.now(), reason: "handschlag", bis: Date.now() + 3600000,
         }));
       } catch { /* lokaler Eintrag bleibt */ }
       await ns.sleep(15000);
       continue;   // main nicht verlassen: Kauf, Spende, Arbeit, Telemetrie laufen weiter
     }
     ```
  3. Die Graft-Nachpruefung nach der NFG-Schleife behalten, ebenfalls mit `continue`.

### 6. SHOULD-FIX - Horizontregel ist bei hohem Kontostand strenger als die alte

- **Rechnung:** NEU feuert bei `preis > geld + 600 x inc`, ALT bei `preis > 4 x geld`. NEU ist
  strenger, sobald `geld > 200 s x inc`. BN5.2 15:12 (41,12 Mrd, 96,8 M/s seit Einbau):
  Schwelle NEU **99,2 Mrd**, ALT **164,5 Mrd** - fuer Preise dazwischen baut NEU ein, wo ALT
  hoechstens **21,2 min** gewartet haette. Der Audit (3#3) wollte weniger vorzeitige
  Einbauten, nicht mehr; die 600 s sind nicht begruendet (Kommentar `:837`: "deckt den
  belegten Fall knapp") und kuerzer als der dort genannte Wiederaufbau (7-20 min Beitritt).
- **Fix:** siehe Einwand 1 (`Math.max(4 * geld, ...)`), Horizont als benannte Konstante mit
  Begruendung aus Wiederaufbauzeit.

### 7. SHOULD-FIX - Tests pruefen die Fixes nicht, sondern Einzeiler und Attrappen

- `tools/test-bn4rep-einbau.js`: 5 der 34 Pruefungen vergleichen eine lokale Attrappe mit
  sich selbst (`altHoltNieZurueck = () => false` ... `=== false`, A4 `altImmerFalsch`,
  A6 `altErzwingtNie`, A7 2x `altZaehltImmer`) - "ROT erwartet" steht dran, gruen sind sie
  immer. Die neuen Funktionen sind Einzeiler (`&&`/`<`).
- **Ungeprueft** ist alles, was entscheidet: der Einkommensschaetzer (`:593-603`, Einwand 1),
  der Rundenzaehler/Spendenmerker (`:1437`, `:1595`, `:2212`), `hatEchtenWert` mit echten
  Namen (Einwand 2), die A4-Kaufschleife und ihre Vorbedingungen (Einwand 3), `hatNmi`
  (Einwand 4), die Reihenfolge Kaufblock -> A4 -> `continue`, die Einbaubedingung mit
  `redPillWartet` (`:1348-1353`). Der A5-Test setzt das Einkommen von aussen (4,1e9/16) statt
  es durch den Schaetzer zu schicken.
- **Fix:** Den Schaetzer als reine Funktion (`schaetzeEinkommen(zustand, geld, jetzt)`) nach
  `lib/einbau.js`, Rundenfolgen aus den Logs (16:57, 19:03, 00:23, Neustart) als Test,
  `hatEchtenWert` gegen `HACK_AUGS` mit Magnetism/DMA/PCMatrix.

### 8. MINOR - A1: der "geprueft, stoert kein UI-Skript"-Kommentar ist falsch; Wettlauf mit darkweb.js

- **Kommentar `:2322-2327`:** "alt+w/alt+t feuern unabhaengig von der aktuell offenen Seite".
  **Spiel:** `Sidebar/ui/SidebarRoot.tsx:285-306` verwirft Tastenkuerzel bei
  `Player.currentWork && Player.focus`, und auf `Page.Work` ist die Seitenleiste gar nicht
  gerendert (`ui/GameRoot.tsx:328-331`, `withSidebar = false`). darkweb.js sagt das selbst
  (`darkweb.js:91-94`).
- **Wettlauf (Zeitplan aus darkweb.js):** "raus"-Klick t=0, alt+t bei 1,0 s,
  `getElementById("terminal-input")` bei 2,0 s, "home" +0,6 s, je Kauf 1,4 s. `setFocus(true)`
  (`:2354`, Rundenabstand ~16 s) faellt mit p = (2,6 + 1,4n)/16 in dieses Fenster: n=1 25 %,
  n=5 60 % - dann "ABBRUCH: Terminal nicht erreichbar" bzw. "Terminal gesperrt". Folgen klein
  (naechster Anlauf nach 5 min, bn4life kauft per Singularity; B3 stellt darkweb ohnehin ab).
  Dasselbe trifft die Hand-Werkzeuge ueber den Auftragskanal (`exportbonus.js:43-63`,
  travel.js, join.js, homeram.js, stockaccess.js - alle klicken zuerst "Do something else").
  popups.js ist seitenunabhaengig (Escape am document, Modalknoepfe) - kein Konflikt.
- **Fix:** vor `setFocus` pruefen, ob ein UI-Skript laeuft (`ns.isRunning` fuer darkweb.js und
  die Hand-Werkzeuge auf home und Werkbank) oder eine Marke `data/ui-belegt.txt` (< 60 s alt)
  respektieren; Kommentar korrigieren. Nebenbei: `:2308` zitiert `Singularity.ts:533-551` fuer
  `workForFaction` - das sind `isFocused`/`setFocus`.

### 9. MINOR - A5-Aussetzung "< 2 Runden" ist in Wandzeit 1-3 s und greift nur zufaellig

- Spendenrunden enden mit `sleep(1000); continue` (`:2216-2217`), Kaufrunden mit
  `sleep(2000); continue` (`:1561`) - beide ueberspringen den 15-s-Schlaf (`:2426`). Log 19:03:
  Spende 19:02:50 (D), stille Folgerunde ~19:02:51 (D+1), Kauf 19:03:06 (D+2), Einbau-Runde
  19:03:08 = D+3 -> **nicht** ausgesetzt. 16:57:10 und 00:23:13 lagen je 1 s nach einer Spende
  und waeren ausgesetzt - das ist Zufall der Rundenfolge, nicht die Regel. Tragend ist der
  Horizont (steht, wenn Einwand 1 behoben ist).
- **Fix:** zeitbasiert (`Date.now() - letzteSpendeMs < 60000`) oder weglassen und ehrlich
  dokumentieren, dass der Horizont traegt.

### 10. MINOR - A4 ist nicht "IMMER erreichbar"; im belegten BN5.2-Fall fehlen weiter 18 min

- Kommentar `:1571-1574`. Vor dem 16:37-Einbau hatte keine Faktion Favor >= 150 (BitRunners
  erst danach 165,1; Stand 16:57). A4 kann also erst kaufen, wenn eine Faktion den NFG-Bedarf
  hat: Stufe 44 = 139.920 Rep (Audit), bei BitRunners gegen 16:00 statt an der Schwelle 15:42.
  Gewinn real 37 min, nicht 55. Solange A4 nicht kaufen kann, schreibt es nichts ins Log.
- **Fix:** Kommentar korrigieren; bei `spendenrechtFaellig && wartend === 0` das Arbeitsziel auf
  den NFG-Repbedarf der besten Faktion setzen und den Fehlschlag gedrosselt melden.

### 11. MINOR - Telemetrie nennt weiter den falschen Einbaugrund

- `:1360-1362` `geldWegZu` meldet `teuerstesVerdiente` (ungefiltert), ausgeloest hat
  `teuerstesVerdienteWertvoll`. `spendenrechtFaellig` hat keinen eigenen Text und faellt auf
  "naechste Huerde erst in ..." (`:1367`) - bei `kleinsteLuecke === null` "in 0". Der Audit
  (3#5 Nebenbefund) hatte genau das verlangt.
- **Fix:** Grundtext je wahrer Bedingung, `teuerstesVerdienteWertvoll` melden.

### 12. MINOR - A6 verliert verdiente, knapp unbezahlte Stuecke; Graft kann A6 beliebig aufschieben

- Kaufschleife `:1553-1560` prueft den Preis vom Rundenbeginn (nach dem ersten Kauf x1,9 zu
  niedrig); die Spendenreserve deckt nur das teuerste verdiente Stueck (`:2208`). Wird Red
  Pill per Spende erreicht, bleibt das zweitteuerste verdiente Stueck liegen, und A6 baut in
  der Folgerunde ein. Fuer den Aufstieg meist wertlos (DMA), im BN5-Fall Minuten. Ein
  laufender Graft sperrt A6 (`:947`), und graftauto startet ohne V1-Tor (Audit C1) den
  naechsten - dann wartet Red Pill beliebig.
- **Fix:** A6 erst, wenn kein verdientes Stueck binnen ~2 min bezahlbar wird; graftauto bei
  `redPillWartet` nicht starten lassen (Marke in data/einbau.json lesen).

### 13. MINOR - Dokumentation widerspricht sich / ist veraltet

- `lib/einbau.js:28-32`: "Rueckfall 1 macht die Spende ZU GROSS geschaetzt ... liefert zu wenig
  Reputation" - richtig ist: zu KLEIN (`donation.ts:12-14`, Division durch FactionWorkRepGain
  < 1). Der Test (`test-bn4rep-einbau.js`) sagt es richtig.
- `:1754-1778` sprechen weiter von "30 VERSCHIEDENEN" fuer Daedalus.

---

## Gehalten

- **A2:** Spendenformel `donation.ts:8-14` enthaelt `FactionWorkRepGain`; live gelesen einmal je
  Runde (`:642`), an allen drei Stellen genutzt (grobRate, NFG-Einbau, Hauptweg, dazu A4).
  SF5.1 steht in allen 8 Staenden; `getBitNodeMultipliers` (4 GB) lief schon auf master
  (`:178` master), keine neue RAM-Last.
- **A3:** `FactionJoinCondition.ts:116-131` zaehlt `p.augmentations.length` (nur installiert),
  NFG ist dort genau ein Eintrag (`AugmentationHelpers.ts:55-58`); `getOwnedAugmentations(false)`
  = genau diese Liste (`Singularity.ts:79-91`). Echter Beleg: BN5.2 15:12 hatte 25 installiert,
  aber `getOwned(true)` = 35 (7 NFG-Stufen + 3 Stuecke) - die alte Zaehlung strich den
  Zaehlplatz-Bonus zu Unrecht. In der Live-Logik steht keine feste 30 mehr (nur Kommentare).
- **A1-Grundmechanik:** `setFocus` ist bei schon gesetztem Fokus ein No-op, wirft ohne Arbeit
  (`Singularity.ts:537-553`, abgefangen); nur bei eigener Zielfaktion (`arbeitetSchon`,
  `:2223`); RAM +0,2 GB (`SF4Cost(0.1)` x2) korrekt in der Registry. popups.js stoert es nicht.
  BitVerse-Seite: bn4rep steht dann bereits im Riegel `:1207-1210` und ruft nichts.
- **A5 eingeschwungen:** mit realem Einkommen feuert die neue Regel in keinem der drei Vorfaelle
  (16:57, 19:03 - ein vierter, vom Audit vorhergesagter Vorfall im Stand, DMA 96 Mrd -, 00:23);
  19:03: kleinste Luecke DMA 69.726 < lueckeZuGross 165.545, Favorgewinn max 1,048 (Aevum).
  Kein Stillstand im fruehen Zyklus: 19:04 `wartend = 0`, und bei kleinem Einkommen feuert die
  Regel eher mehr als die alte.
- **A6:** keine Firmenphasen-Verklemmung (Sperre wird bei `!companyTarget` geloescht `:744-750`,
  Einbauprobe liegt vor dem Firmenblock); keine Einbauschleife mit A4 (`ausgangSteht` sperrt
  nach Red Pill); Interlock und A6 treffen im V1-Weg nicht zusammen (w0r1d_d43m0n erst nach
  Red-Pill-Einbau am Netz, `ausgang.js:252-263`).
- **A7:** schliesst die belegten Faelle aus (Daedalus Favor 150,5/150,6 in 00:23/19:03,
  BitRunners 165,1; leerer Black-Hand-Katalog).
- **A4 im Hackingknoten:** q = 0 beim Kauf, Einbau folgt in der naechsten Runde ueber
  `spendenAusnahme`; keine Kollision mit der Red-Pill-Reserve (A4 nur bei leerer Warteschlange).
