# Offene Baustellen

**Diese Datei ist die Arbeitsliste des Vorankommens-Loops.** Sie existiert, weil
Befunde sonst in Prosa verschwinden: Am 24.08.2026 sind drei von fuenf
Pruefbefunden untergegangen, weil sie in einem Fliesstext standen statt in einer
Liste, die man abhaken kann.

## ENTSCHIEDEN - nicht wieder aufmachen

**Vor jeder Aenderung diese Liste lesen.** Wer etwas aendern will, das hier
steht, braucht eine **neue Messung oder eine neue Fundstelle** - nicht ein
neues Argument. Steht beides nicht zur Verfuegung, wird nicht angefasst.

*Warum die Liste existiert (29.08.2026, 09:00, auf Erics Ansage):* Die
Begruendungen lagen verstreut in `nodes/HEBEL.md` und `nodes/ERLEDIGT.md` und
wurden nur gefunden, wenn jemand zufaellig danach greppte. Zweimal binnen
24 Stunden wurde eine erledigte Frage neu aufgerollt und erst beim
Nachrechnen wieder verworfen - die Feuerschwelle um 03:45 und Raid mehrfach.
Beide Male ging es gut, aber Nachrechnen ist Zufall, kein Mechanismus.

| Entschieden | Wert | Beleg | Wann |
|---|---|---|---|
| Feuerschwelle Black Ops | **0,35**, nicht 0,90 | Rangverlust ist Zeit, kein Bestand (`Bladeburner.ts:1273,1283-1291`); Kosten `T_op + L/(m*Rangrate)` = 6,8 min gegen 80 min Warten | 28.08. 16:00, bestaetigt 29.08. 03:55 und 07:20 |
| Bevoelkerungs-Horizont in `beste()` | **1 Stunde**, nicht die Restlaufzeit | Black Ops ignorieren pop (`BlackOperation.ts:55`), Chance bei 1 gedeckelt (`Action.ts:195`), Ereignisse driftfrei (-0,0016/Ereignis) | 29.08. 08:20 |
| Einbau vor dem Divisionsbeitritt | **nie** | Prestige setzt Kampfwerte auf 1; am 29.08. 04:15 kostete es netto 90.810 Erfahrung = 6,6 h | 25.08., erzwungen 29.08. 04:25 und 06:20 |
| Augmentierungsrunde vor Tor 1 | **verworfen** | Gym allein 18,6 h gegen 20,3 h; nur Combat Rib I hebt str/def, der Rest wirkt auf dex/agi | 28.08. 22:52 |
| Sleeve: sync hochziehen | **verworfen** | 20,2 h Stillstand = 236.285 Erfahrung, mehr als der ganze Restweg | 29.08. 06:55 |
| Gym und Bladeburner parallel | **unmoeglich** | gemessen und per `git revert` zurueckgenommen | 28.08. 07:34 |
| Ausgang aus BitNode 10 | **nur Bladeburner** | Hacking-Weg braucht Level 6.000 = 10^175 Erfahrung | 29.08. 07:20 |
| Reihenfolge der BitNodes | **fest** | `nodes/AUDIT-ROADMAP-2026-08-24.md` | 24.08. |
| Kampfknoten-Bedingung | **`BLADE_KNOTEN`**, nie eine Nummer im Code | derselbe Fehler an sieben Stellen; die 10 fehlte ueberall | 29.08. 09:15 |
| EditSaveFile im laufenden Spiel | **nein**, erst beim naechsten Reset | Remote-API kann Spielstaende nur lesen; IndexedDB-Schreiben riskiert den ganzen Lauf fuer 0,1 % | 29.08. 09:45 |
| Beitritt zur Division | **sofort bei Kampfwert 100** | Kampfwerte 100 -> 300 bringen nur +46 % Rang nach 10 h, kosten aber Tage Gym (Simulation 29.08., `nodes/KURS.md` 10:20) | 29.08. 10:20 |
| Verbrechen statt Gym zum Kampftraining | **verworfen** | Gym Powerhouse 10 exp/s in einem Stat gegen bestenfalls 3,0 exp/s ueber alle vier (Mug 12 exp/4 s, Heist 1800/600 s); BN10 hat keinen Gym-Malus, nur `CrimeMoney: 0,5` | 29.08. 13:25 |

Regeln:
- **Ein Arbeitspunkt ist eine Zeile, die mit `### ` beginnt.** Nur solche Zeilen
  zaehlen. Steht unter einer Ueberschrift keine `### `-Zeile, ist der Abschnitt
  leer - Erklaerungen und Fliesstext sind keine Arbeit.
- **`## Sofort` hat Vorrang vor `## Offen`**, ohne Abwaegung. Dort tragen der
  Reportloop und die Wache ein, was sie kaputt vorfinden aber nicht selbst
  beheben. Abgeraeumtes wandert nach "Erledigt".
- **Die Reihenfolge in der Datei IST die Rangfolge.** Nicht neu bewerten, nicht
  umsortieren. Ein Punkt, dessen Ueberschrift mit "Wartet bis <Uhrzeit>"
  beginnt, wird uebersprungen statt angefangen.
- Ein Punkt je Lauf. Wer fuenf Punkte gleichzeitig anfaengt, schliesst keinen.
- **Erledigtes wandert nach `nodes/ERLEDIGT.md`, nicht nach unten** (seit
  27.08.2026, 18:35). Es wird nie geloescht - der Verlauf ist die Begruendung
  fuer das, was heute steht -, aber er gehoert nicht in die Arbeitsliste: Sie
  stand bei 1.777 Zeilen, davon 81 Prozent Archiv, und das Read-Werkzeug
  schneidet bei 2.000 stumm ab. Im Archiv wird **gegrept, nicht gelesen**:
  `grep -n -A12 "<stichwort>" nodes/ERLEDIGT.md`.
- Was hier nicht steht, wird nicht bearbeitet. Neue Befunde kommen zuerst hierher.
- **Diese Datei wird mit `tools/liste.js` bearbeitet, nicht von Hand
  geschnitten** (seit 28.08.2026, 23:18):

      node tools/liste.js                                  Abschnitte + Punkte
      node tools/liste.js --sofort-leeren [--vermerk "..."]
      node tools/liste.js --eintragen sofort|offen --datei <pfad>
      node tools/liste.js --erledigen "<anfang>" --datei <pfad>

  Es grenzt Abschnitte ueber Zeilennummern ab, erkennt eine Ueberschrift nur
  NACH der ersten `---`-Trennlinie, und schreibt nur, wenn die Gliederung
  danach unveraendert ist - sonst bleibt der alte Stand stehen. Der Eintrags-
  text kommt aus einer Datei, damit Umlaute und Backticks die Shell ueberleben.

  *Warum es das Werkzeug gibt:* Eine Suche nach `## Sofort` oder `## Offen`
  trifft die erste Fundstelle - also den Fliesstext in diesem Regelkopf, wo
  beide Zeichenketten ebenfalls stehen. Am 28.08.2026 hat das die Datei
  zweimal zerlegt (14:08 und 22:47): Eintraege landeten mitten im Kopf,
  Abschnittsueberschriften existierten doppelt, ein abgeraeumter Punkt stand
  wieder in der Liste. Beide Male stand die Warnung davor **hier**. Ein
  Hinweis in dem Text, den man gerade umschreibt, wird nicht gelesen.

  Wer die Datei doch von Hand aendert, prueft danach `node tools/liste.js` -
  die Gliederung muss lauten: ein `## Sofort`, ein
  `## Offen, nach Dringlichkeit

*Der Beitritt selbst ist geprueft und braucht keinen Punkt (29.08., 11:15).*
*`bbtrain.js:257-272` haelt bei ZIEL 100 an, ruft `stopAction()` und dann*
*`joinBladeburnerDivision()`; bei Ablehnung schreibt es `data/hilfe.txt`, was*
*der Pruefer als STOERUNG meldet. Der Beitrittszeitpunkt geht nach*
*`data/bbjoin.txt` und wird nach home kopiert - wichtig, weil bbtrain auf der*
*Werkbank laeuft. Alle vier Spielbedingungen (`NetscriptFunctions/Bladeburner.ts:335-352`)*
*sind erfuellt: `disableBladeburner` ist false (Spielstand 11:14),*
*`BladeburnerRank` ist 0,8 und damit ungleich 0, `Player.bladeburner` ist noch*
*null, und die vier Kampfwerte stehen bei 86-87 von 100.*
`, ein `## Erledigt`.
- **Ein alter Zeitstempel ist KEIN Stillstand.** Mehrere Skripte steigen vor
  ihrer Telemetriezeile aus der Runde aus und arbeiten trotzdem einwandfrei.
  Die Lebenszeichen stehen woanders und sind bedingungslos:
  `data/hb-rep.txt` fuer `bn4rep.js` (Puls), `data/rep-ziel.txt` fuer sein
  aktuelles Ziel samt Rangliste, `data/wache-zustand.json` fuer den Waechter.
  `data/bn4rep.json` und `data/ps.json` sind Momentaufnahmen, keine Pulse.
  *In der Nacht zum 28.08. hat diese Falle einen Sofort-Punkt erzeugt, der
  komplett falsch war - die Warnung stand seit dem 24.08. in `bn4rep.js:389`,
  nur nicht dort, wo jemand sie sucht.*
- **Die Loops entscheiden selbst. "Wartet bis Eric" ist kein Ablageort fuer
  unbequeme Entscheidungen** (Eric, 26.08.2026, 16:05). Aus einer belegten
  Erkenntnis wird ein **unmittelbarer Arbeitsauftrag**, nicht ein Wartestatus.
  Wer eine Zahl gemessen hat, die eine Aenderung rechtfertigt, setzt sie um und
  misst nach - und nimmt sie zurueck, wenn sie nicht traegt.
  **Seit dem 27.08.2026, 05:00 ohne Ausnahme.** Eric hat den Vorbehalt fuer
  `src/bn4net.js` und `src/boot.js` aufgehoben - mit der Auflage, dort **jede
  Aenderung einzeln zu committen**, damit sie sich einzeln zurueckdrehen
  laesst. Sein Ziel: "Ich will das Projekt hier nahezu vollstaendig durch
  Loops laufen und entscheiden lassen, so dass ich eigentlich nicht noetig
  bin."
  **Die Reihenfolge der BitNodes bleibt unangetastet** - nicht als Vorbehalt,
  sondern weil sie feststeht (Fables Analyse,
  `nodes/AUDIT-ROADMAP-2026-08-24.md`). Auch Eric will dort nicht mehr
  dazwischenfunken.
  *Anlass: Der Raid-Befund vom 26.08. stand vier Laeufe lang auf "Wartet bis
  Eric entscheidet", obwohl jede Zahl dafuer gemessen war. Das kostete den
  groessten offenen Hebel des Knotens einen halben Nachmittag.*

---

## Sofort

### Chaos in Aevum steht bei 41,3 von 50 - zwei Incite-Laeufe kippen es (30.08., 14:25)

Gemessen: Aevum (die Bladeburner-Stadt) **41,3**, Ishima **46,4**. Die
          Schwelle ist **50** (`data/Constants.ts:31`, `ChaosThreshold`).

Wirkung bei Ueberschreitung: `getChaosSuccessFactor` multipliziert die
          Schwierigkeit mit `sqrt(1 + chaos - 50)` (`Actions/Action.ts:94-101`).
          Ein Pruefagent hat es durchgerechnet: Chaos 60 statt 41 senkt die
          Rangrate von 50,1 auf **15,1 je Stunde - Faktor 0,30**.

Der Ausloeser ist der Bot selbst: `Incite Violence` addiert `+10` **und**
          `+chaos/log10(chaos)` auf **jede** der sechs Staedte
          (`Bladeburner.ts:1229-1233`). Bei Chaos 41 sind das **+35,6 je
          Ausfuehrung** - ein einziger Lauf reisst die Schwelle.

Der Rueckweg ist teuer: Diplomacy senkt bei Charisma 46 nur **1,23 Prozent
          je 60-Sekunden-Aktion** (`getDiplomacyPercentage`,
          `Bladeburner.ts:735-743`). Eine einzige Incite-Ausfuehrung
          zurueckzunehmen kostet rund **51 Minuten ohne Rangertrag**.

Der Riegel im Bot steht auf `chaosJetzt < 25` (`src/blade.js:2746`) und
          haelt damit heute - aber die Rechnung dahinter war falsch, siehe den
          korrigierten Punkt vom 12:40: Der hoechste sichere Startwert ist
          **19**, nicht 23 und nicht 25. Bei einem Startwert von 20 landet ein
          Durchlauf auf 50,31.

Zu tun:   Den Riegel von 25 auf 19 senken. Das ist eine Zahl, exakt
          hergeleitet, und sie steht seit 12:55 zweifach belegt in der Liste.
          Danach messen, ob Incite ueberhaupt noch ausgeloest wird - falls
          nein, ist der Vorratsnachschub neu zu betrachten.

Dringlichkeit: **hoch.** Kein Schaden solange unter 50, aber der Abstand
          betraegt 8,7 Punkte und ein einzelner Lauf kostet 35,6.

### Die Einbau-Sperre in `bn4rep.js:683` greift nicht (30.08., 14:25)

Gemessen: Um **09:21** hat `bn4rep.js` einen Augmentierungs-Einbau
          ausgeloest. Der Einbau setzte die Kampfwerte auf 1, und der Bot hat
          **drei Stunden** im Gym zurueckgebaut (`data/verlauf-strategie.json`,
          Tiefstand 1 um 09:21, 99 um 12:24).

Erwartet: Der Einbau haette nicht stattfinden duerfen. Die Sperre fuer
          Kampfknoten wurde am 29.08. um 04:22 auf `n === 10` erweitert
          (`src/bn4rep.js:683`) - genau fuer diesen Fall.

Kosten:   Der Ertrag war praktisch null. Die Kampf-Multiplikatoren aenderten
          sich kaum (str/def 1,597 -> 1,602, agi 1,677 -> 1,766), die
          Bladeburner-Multiplikatoren gar nicht (alle vier stehen weiter auf
          1,000). Bezahlt wurden dafuer drei Stunden Wiederaufbau plus der
          Ratenverlust danach - ein Pruefagent beziffert den Gesamtposten auf
          **5 bis 7 Stunden**.

          `nodes/ERLEDIGT.md:1608-1640` hat denselben Fall am 29.08. schon
          einmal gerechnet: **netto minus 90.810 Erfahrung = minus 6,6
          Stunden**, mit dem Fazit "der Bot hat die schlechtere Option
          gewaehlt". Es ist also der **zweite** Fehleinbau derselben Art -
          und beim ersten Mal wurde eine Sperre eingebaut, die jetzt nicht
          gegriffen hat.

Verdacht: `src/bn4rep.js:683` und die Ausloeserkette bei `:1035-1040`. Die
          Kette ist rein boolesch:

              !ausgangSteht && wiederaufbauHilfe
              && (wartend >= MINDEST_WARTESCHLANGE || spendenAusnahme)
              && (kleinsteLuecke > lueckeZuGross || nichtsMehrOffen || ...)
              && !gesperrt

          Zu pruefen ist, welches Glied durchgelassen hat - und ob `gesperrt`
          ueberhaupt gesetzt war. **Der Auslöser kennt seinen Preis nicht:**
          In der ganzen Datei steht kein einziger Aufruf, der den Rang oder
          die Rangrate liest (`ns.bladeburner.*` kommt genau einmal vor, als
          `inBladeburner()` in Zeile 714). `MINDEST_WARTESCHLANGE = 3` ist
          eine **Stueckzahl** - drei beliebig schwache Augmentierungen loesen
          aus, eine sehr starke nicht.

Zu tun:   Erst messen, welches Glied der Kette am 09:21 wahr war (das
          Protokoll steht in `data/bn4rep-log.txt` ueber die Bruecke). Dann
          die Sperre reparieren - und getrennt davon pruefen, ob der
          Ausloeser einen Preisterm bekommen sollte statt einer Stueckzahl.

Dringlichkeit: **hoch.** Der naechste Fehleinbau kostet wieder 5 bis 7
          Stunden, und er kann jederzeit kommen.

### Beide Ausgaenge gegeneinander gerechnet: Bladeburner bleibt der schnellere (30.08., 14:20)

**Ergebnis der Alternativenpruefung, die Eric um 13:50 verlangt hat.** Drei
Agenten, drei Winkel. Das Ergebnis ist: **der bisherige Kurs stimmt** - aber
nicht aus den Gruenden, aus denen er gewaehlt wurde, und die Zahl, mit der er
in Frage gestellt wurde, war meine eigene falsche.

**Der Vergleich, bereinigt:**

    Bladeburner   30-110 h, Erwartungswert 50-70 h
                  (Verdopplungszeitmodell, aus BN6 UND BN10 gemessen)
    Hacking      150-250 h
                  (Agentenrechnung, sechs Etappen, mehrere ungemessene Posten)

**Faktor 2 bis 4 zugunsten Bladeburner.**

**Warum der dritte Agent das Gegenteil berichtet hat:** Ich habe ihn mit
"gemessene Rangrate 42,5/h, also 334 Tage" beauftragt. Das war die lineare
Fortschreibung eines Post-Reset-Lochs auf einer Exponentialkurve - derselbe
Fehler, den ich heute schon zweimal gemacht hatte. Er hat korrekt gegen die
falsche Vorgabe gerechnet. **Ein Auftrag, der eine Zahl vorgibt, vererbt
seinen Fehler an den Bericht** - das gehoert in die Auftragsregeln fuer
Subagenten.

**Was aus den Berichten trotzdem bleibt, verifiziert:**

**1. Reputation wird beim Kauf nicht abgezogen.** `FactionHelpers.tsx:118-120`
ruft ausschliesslich `Player.loseMoney(augCosts.moneyCost)`. Rep ist eine
**Schwelle, keine Waehrung** - wer 5 Mio Rep hat, kauft damit beliebig viele
Augmentierungen, solange das Geld reicht. Nur die teuerste Stufe je Charge
zaehlt, nicht die Summe.

**2. The Red Pill kostet in BN10 fuenf Millionen Rep, nicht 2,5.**
`Augmentations.ts:1954` gibt `repCost: 2.5e6`, und `getAugCost` multipliziert
mit `AugmentationRepCost: 2`. Der Wert stand in mehreren Projektdateien
falsch.

**3. Der Labyrinth-Weg ist tot.** Das siebte Labor gaebe TRP an Daedalus
vorbei (`labyrinth.ts:403-429`), aber `FinalLab` verlangt **Charisma 4000**.
Bei `CharismaLevelMultiplier: 0.4` sind das 1,1e68 Erfahrung. Der
Labyrinth-Punkt aus dem 24.08.-Audit ist damit erledigt, ohne dass jemand ihn
weiter untersuchen muss.

**4. NeuroFlux gibt 1,0198 je Stufe, nicht 1,01.** Empirisch aus dem
laufenden Spielstand geklammert (`hacking_grow` 1,60199 ueber 24 Stufen). Der
Referenzquellcode weicht hier von der laufenden Fassung ab - ueber 60 Stufen
macht das Faktor 2,4. **Wer mit NFG rechnet, misst am Spielstand, nicht am
Quellcode.**

**Und die eigentliche Erkenntnis: Die Wege schliessen sich nicht aus.**
`Bladeburner.prestigeAugmentation()` (`Bladeburner.ts:259-263`) setzt nur die
laufende Aktion zurueck - **der Rang ueberlebt jeden Augmentierungs-Einbau**.
Mit `The Blade's Simulacrum` bricht Fraktionsarbeit den Bladeburner nicht ab
(`Bladeburner.ts:178-180`, `:1354-1360`). Der Aug-Aufbau kann also
**nebenherlaufen**, ohne den Rangweg zu kosten.

Damit ist die Frage nicht "welcher Weg", sondern: **Wie macht man den
Bladeburner-Weg schneller, ohne ihn zu unterbrechen?** Und dafuer liefern die
Berichte drei konkrete Posten - siehe die Punkte zu Fahigkeitspunkten, zum
ueberfluessigen Einbau und zum Chaos-Risiko.

**Grafting bleibt wertvoll, aber mit anderer Begruendung.** Nicht als Ausweg
aus dem Bladeburner-Weg, sondern als einziger Kanal, der die in BN10 hart
gedeckelten **Kampfwerte** hebt (`StrengthLevelMultiplier: 0.4`) - ohne
Reputation und ohne den fuenffachen Geldaufschlag. Die Erfolgschance jeder
Bladeburner-Aktion haengt daran.

Offen und ungeprueft bleibt die Graft-Rechnung selbst (welche Augs, welcher
Multiplikator, welche Zeit) - sie gehoert nachgerechnet und geeicht, bevor
irgendein Werkzeug gebaut wird.

### Grafting ist der ungenutzte Kanal - Augmentierungen ohne Reputation und ohne BitNode-Aufschlag (30.08., 14:10)

**Die Antwort auf Erics Frage nach einer Alternative.** Ein Suchagent hat den
Mechanismus gefunden, zwei Kernbehauptungen habe ich selbst am Quellcode
nachgeprueft - eine haelt, eine nicht.

**VERIFIZIERT: Der Preisunterschied ist real und gross.**

    Grafting:  cost = augmentation.baseCost * AugmentationGraftingCostMult
               (`Grafting/GraftableAugmentation.ts:20-22`, `Constants.ts:96` = 3)

    Kaufen:    moneyCost = baseCost * multiplier * AugmentationMoneyCost
                           * getGenericAugmentationPriceMultiplier()
               repCost   = baseRepRequirement * AugmentationRepCost
               (`AugmentationHelpers.ts:135-136,157-158`)

Grafting kennt **weder** den Knotenfaktor (in BN10 **x5** aufs Geld, **x2**
auf die Rep) **noch** die Stapeltreppe `1,9^k` **noch ueberhaupt eine
Reputationsanforderung**. Es kostet schlicht das Dreifache des Basispreises.

**VERIFIZIERT: Gegraftete Augmentierungen zaehlen voll.** `GraftingWork.tsx:51`
ruft `applyAugmentation({name, level: 1})` - dieselbe Funktion wie beim Kauf.
Sie landen also in `Player.augmentations` und zaehlen fuer
`haveAugmentations(30)`, das Tor zu Daedalus.

Voraussetzungen: `Player.city === NewTokyo` und SF10 >= 1 **oder** BitNode 10
(`PlayerObjectGeneralMethods.ts:577-579`) - beides erfuellt, der Bot steht in
BN10. Vollstaendig skriptbar ueber `NetscriptFunctions/Grafting.ts`.
Entropie (0,98 je Graft, `GraftingWork.tsx:62`) wird beim naechsten Einbau auf
0 zurueckgesetzt (`AugmentationHelpers.ts:47`) - mehrere Graft-Einbau-Zyklen
sind verlustfrei.

**Die Rechnung des Agenten** (von mir nicht nachgerechnet, als offen
markiert): 23 Hacking-Augmentierungen graften kostet **$0,18 Bio** und hebt
`mults.hacking` von 1,4 auf **13,08**. Mit QLink (Basis $25 Bio, also $75 Bio
gegraftet statt 3,75 Mio Illuminati-Rep plus $125 Bio gekauft) auf **22,89**.
Der Erfahrungsbedarf fuer Hacking 6000 faellt damit von 10^160 auf
**7,5 * 10^12**. Grafting-Zeit fuer die 24 Stueck: 25 bis 35 Stunden,
parallel zu allem anderen.

**WIDERLEGT: "The Red Pill wird nicht gebraucht."** Der Agent schrieb,
`ns.nuke("w0r1d_d43m0n")` funktioniere ohne TRP, weil `getNormalServer` per
Hostname aufloese. Selbst nachgesehen - `NetscriptHelpers.tsx`, `getServer`:

    const server = GetServer(host);
    if (server != null && (server.serversOnNetwork.length > 0 || ...)) {
      return [server, host];
    }
    ...
    throw errorMessage(ctx, `Invalid host: ${str}`);

Ohne TRP hat der WD-Server **keine** Netzkante - `Prestige.ts:173-181` haengt
ihn erst bei installiertem TRP an Daedalus. `serversOnNetwork.length === 0`,
die Bedingung ist falsch, es faellt durch bis zum `throw`. **TRP bleibt
Pflicht**, und `nodes/KNOTEN-VORBEREITUNG.md` ist an dieser Stelle richtig.

**Was der Fund strategisch bedeutet:** Grafting loest die teuerste Huerde des
Hacking-Weges - die 30 Augmentierungen fuer Daedalus, bisher gedacht als
30 mal Fraktionsreputation in einem Knoten mit `AugmentationRepCost: 2`.
Uebrig bleiben dann `haveMoney(100e9)` (erfuellt), Hacking 2500 oder
Kampfwerte 1500 (mit dem gegrafteten Multiplikator in Reichweite) und
2,5 Mio Daedalus-Rep fuer TRP selbst.

**Und: Der Mechanismus war bekannt, nur falsch einsortiert.**
`nodes/ROADMAP.md:407` beschreibt ihn exakt richtig - "Augmentierungen **ohne
jede Reputation**, `baseCost x 3`" - aber als **"das Werkzeug fuer BN8"**.
Dass er den laufenden Knoten selbst verbilligt, stand nirgends. Im Code gibt
es dazu passend **kein einziges Werkzeug**: `src/buyaugs.js:291,586` kennt
Grafting nur als Kategorie "ueber den normalen Kauf nicht erreichbar" und
uebergeht solche Augmentierungen.

**Zweiter Fund desselben Agenten, ungeprueft:** The Covenant (dauerhafte
Sleeves, +5 moeglich, ueberlebt jedes Prestige) gilt in `## ENTSCHIEDEN` als
unerreichbar, weil Kampfwert 850 bei festem Multiplikator 2,06e23 Erfahrung
braucht. Der Agent rechnet vor, dass 22 gegraftete Kampf-Augs (26 h,
$154 Mrd) den Multiplikator so heben, dass 850 in **0,15 h Gym** erreichbar
waeren. **Das ist derselbe Fehlertyp wie in drei anderen Faellen heute: ein
Multiplikator wurde als Konstante behandelt.** Wenn es traegt, ist BN10 die
einzige Gelegenheit im ganzen Projekt - Sleeve-Memory und Covenant-Sleeves
sind nur hier kaufbar und ueberleben alle Folgelaeufe.

Zu tun, in dieser Reihenfolge:
1. Die Graft-Rechnung nachrechnen und **eichen** (welche Augs, welcher
   Multiplikator, welcher Preis, welche Zeit) - bevor irgendetwas gebaut wird.
2. Den ENTSCHIEDEN-Eintrag zu Covenant pruefen: Er steht auf einer Rechnung
   mit festem Multiplikator.
3. Erst dann ein Graft-Werkzeug. Es gibt heute keines.

Dringlichkeit: **hoch.** Grafting ist an BN10 gebunden; nach dem
Knotenwechsel braucht es SF10, das erst der Abschluss liefert.

---

## Offen, nach Dringlichkeit

### Operationen freigeben: verworfen, aber drei echte Fehler dabei gefunden (30.08., 13:35)

**Zwei unabhaengige Skeptiker sagen BRICHT.** Die Aenderung (Ausnahmetabelle
fuer Investigation und Undercover auf Schwelle 0,30) war gebaut, nie aktiv,
und ist per `git checkout` verworfen. Die Praemisse dahinter war falsch.

**Mein Fehler 1: Nur den Erfolgszweig gelesen.** Behauptet war "kein
Bevoelkerungsverbrauch, `Bladeburner.ts:803-819` ruft nur
`improvePopulationEstimateByPercentage`". Das gilt fuer `if (success)`. Der
`else`-Zweig steht direkt daneben (`:809` und `:818`) und ruft
`triggerPotentialMigration(this.city, 0.1)` bzw. `0.15`.

`triggerMigration` (`:564-587`) schiebt `getRandomIntInclusive(3,15)/100` der
Bevoelkerung weg, mit 5 Prozent Chance zusaetzlich mal 2 bis 4 - **und
dekrementiert `sourceCity.comms`**, also genau die Gemeinden, die Raid
braucht. Erwartungswert 9,9 Prozent je Migration, und `popEst` bleibt stehen:
der Bot merkt es nicht einmal.

Erwartete Bevoelkerungskosten je Versuch, aus dem Quellcode gerechnet:

    Undercover Operation   (1-0,355) * 0,15 * 0,099 = 0,959 %
    Raid                   0,182*1 % + 0,818*0,75 % = 0,796 %
    Investigation          (1-0,492) * 0,10 * 0,099 = 0,503 %
    Stealth Retirement     0,165 * 0,5 %             = 0,082 %
    Sting                  0,251 * 0,1 %             = 0,025 %

**Undercover ist die bevoelkerungsteuerste Aktion des ganzen Knotens** -
teurer als Raid, das die Aenderung genau deshalb gesperrt liess. Ausgerechnet
sie sollte freigegeben werden.

**Mein Fehler 2: Die Kernbehauptung "der Vorrat ist der Engpass" ist falsch.**
Der Nachschub liegt bei 90 Vertraegen je Stunde (drei Arten a 30,
`Bladeburner.ts:1387`), der maximale Verbrauch bei **43 bis 61 Aktionen je
Stunde** - begrenzt durch die Ausdauer (Gewinn 78,4/h plus hoechstens 28,2 aus
der Kammer, Verbrauch 1,36 bis 1,84 je Aktion). Der Vorrat kann strukturell
nicht leerlaufen.

Und der Messwert, auf den ich mich berufen habe, sagt es selbst:
`data/bbspann.json` um 13:09 zeigt `ausdauer: [22,74, 45,80]` = **49,6
Prozent**, knapp unter `AUSDAUER_RUHE = 0,51`. Die Kammer lief mit
`grund: "Ausdauer"`, nicht mangels Auftraegen - und 42 Vertraege lagen im
Regal (Bounty Hunter 23, Retirement 19). Leergefahren war nur **Tracking**,
die schnellste und ausdauerbilligste Aktion. Ich habe "Tracking: 0" gesehen
und daraus "keine Arbeit" geschlossen.

Ausdauerkorrigierte Rangraten (Zyklusrate = netto je Minute mal
Arbeitsanteil):

    Bounty Hunter   1,099        Undercover     0,922
    Retirement      0,994        Tracking       0,790
                                 Investigation  0,753

Die Freigabe haette 0,99 bis 1,10 gegen 0,75 bis 0,92 getauscht.

**Beide Skeptiker haben ihre Modelle geeicht**, bevor sie gerechnet haben -
einer reproduziert sechs von neun Aktionszeiten auf die Sekunde und alle neun
Chancen auf einem gemeinsamen Faktor 1,11 (das Statwachstum seit der
Momentaufnahme). Genau das Verfahren, das die neue Regel in der globalen
CLAUDE.md vorschreibt.

---

**Drei echte Fehler, die dabei herausgefallen sind. Sie bleiben als Arbeit
stehen:**

**A) `src/bbspann.js:171` laesst den Schwierigkeitsfaktor weg.** Es rechnet
`hpJeMisserfolg = (1 - min) * HP_VERLUST[name]` - den **Rohwert**. Der echte
Schaden ist `action.hpLoss * difficultyMultiplier` mit
`difficultyMultiplier = d^0,28 + d/650` (`Bladeburner.ts:981-983`,
`data/Constants.ts:16-17`). Undercover bei d=500: 6,466 mal 2 = **12,93 HP**,
nicht 1,4. Das Werkzeug meldet die HP-Kosten um **Faktor 6,5 bis 9,3 zu
klein** - und jede HP-Debatte, die es als Beleg zitiert, steht auf falschen
Zahlen. (Diese hier auch: Die Sperre fuer Raid war zufaellig richtig, aber
falsch begruendet.)

Nebenbefund dazu: **HP ist ohnehin kein ernsthafter Kostenposten.**
`blade.js:3141-3148` ruft `ns.singularity.hospitalize()` ab 75 Prozent, und
das kostet `min(money*0,1, fehlendeHP*100e3)` (`Hospital/Hospital.ts:8`) - bei
20 maximalen HP also hoechstens 2 Mio gegen 197 Mrd Guthaben. Der Spielstand
zeigt 394 Krankenhausaufenthalte fuer zusammen 215,8 Mio.

**B) `POP_JE_ERFOLG` (`blade.js:2381-2384`) kennt Investigation und Undercover
nicht.** Beide stehen dort auf 0, waehrend Raid einen Zuschlag von 20 Sekunden
bekommt. Traegt man ihre Migrationskosten konsequent ein (`0,7 * popKost *
3600`), faellt Investigation auf 1,287 und Undercover auf 1,199 Rang je
Minute - **und `beste()` entscheidet dann von selbst richtig, ohne dass an
einer Schwelle gedreht werden muss.** Das ist der eigentliche Fix.

**C) `blade.js:2716-2720` bietet Operationen nicht an, es erzwingt sie.**

    const op = beste(OPERATIONEN, O, SICHER_OPERATION);
    if (op) return { typ: O, name: op.name, grund: "Operation" };
    const vt = beste(VERTRAEGE, V, SICHER_VERTRAG);

Die Operation kehrt **unbedingt** zurueck, es gibt keinen Vergleich mit den
Vertraegen. Sobald eine Operation die Schwelle reisst, faehrt der Motor nur
noch sie - auch wenn sein eigenes Mass (`ertrag`, Zeile 2444) die Vertraege
klar vorne sieht. Heute folgenlos, weil keine Operation die 0,85 erreicht;
beim naechsten Schwellenversuch ist es die Falle.

Der Umbau waere `max(op.ertrag, vt.ertrag)` statt der Reihenfolge. Zusammen
mit (B) ist das der Weg, Operationen sauber zugaenglich zu machen - nicht
ueber eine Ausnahmetabelle.

**Nachrangig:** `SICHER_OPERATION` wird an fuenf weiteren Stellen geprueft
(`:220`, `:2102`, `:2821`, `:2940`, `:3011`). Eine Ausnahmetabelle, die nur in
`beste()` wirkt, laesst den Zustand inkonsistent - `etwasFahrbarJetzt` (`:220`)
speist die Chaos- und Diplomacy-Entscheidung.

**A ist behoben und verifiziert (30.08., 13:45).**

`src/bbspann.js` rechnet den `difficultyMultiplier` jetzt einmal je Aktion
(`d = baseDifficulty * difficultyFac^(stufe-1)`, dann `d^0,28 + d/650`) und
nutzt ihn fuer **beide** Groessen - Ausdauer je Lauf wie bisher, HP je
Misserfolg neu. Der doppelte Rechenblock weiter unten ist damit weg.

*Geeicht vor dem Einbau*, wie es die Regel verlangt: Undercover Stufe 1,
d = 500 (`data/Operations.ts:50`) ergibt 500^0,28 = 5,6976 plus 0,7692 =
**6,4671** - der Skeptiker kam unabhaengig auf 6,4668. Abweichung in der
vierten Nachkommastelle.

**Verifiziert 13:41:46** (`node tools/spann.js`, frisch geschriebene
`data/bbspann.json`):

    Aktion                  vorher   nachher
    Raid                      41,6     315,8      <- bei 20 HP Maximum
    Stealth Retirement         8,5      70,6
    Assassination              4,5      45,3
    Sting Operation            1,9      13,3
    Undercover Operation       1,4       8,3
    Bounty Hunter              0,5       3,0
    Tracking                   0,1       0,1

Damit ist auch belegt, was vorher nur zufaellig richtig war: **Ein einziger
Raid-Fehlschlag kostet mehr als das Fuenfzehnfache der maximalen
Trefferpunkte.** Die Sperre fuer Raid stand auf einer Zahl, die um Faktor 7,6
zu klein war - richtig, aber falsch begruendet.

Kein `[skeptiker]`-Marker im Commit: `bbspann.js` laeuft nur auf Abruf, nicht
unbeaufsichtigt, also greift die Skeptiker-Pflicht nicht. Loop 6 darf es
trotzdem pruefen.

**B und C bleiben offen** - sie sind der eigentliche Hebel und ein Umbau der
Bewertungsfunktion, kein Einzeiler.

Dringlichkeit: **A hoch** (ein Messwerkzeug, das um Faktor 8 daneben liegt,
vergiftet jede kuenftige Rechnung). **B mittel** und der eigentliche Hebel.
**C mittel**, heute folgenlos, aber eine gestellte Falle.

### Elf Fehler in der eigenen Dokumentation, gepruefte Liste (30.08., 13:05)

Ein Doku-Pruefer hat die `## ENTSCHIEDEN`-Tabelle Zeile fuer Zeile, die
neuen Punkte, `nodes/KURS.md` und die vier `doku/`-Formeldateien gegen
`reference/bitburner-src/src/` geprueft. **Zwei der Fehler betrafen Eintraege
von heute und sind bereits korrigiert** (Chaos-Deckel 23 statt 19,
Shock-Recovery Faktor 2 statt 3). Die uebrigen stehen hier, schwerste zuerst.

**1. `doku/auffaellige-werte.md` ist eine BN1-Momentaufnahme vom 20.08. ohne
Warnhinweis im Kopf.** In BN10 geht jede Zahl darin durch einen
BitNode-Multiplikator: Hacking-Ziel **6000** statt 3000
(`ServerHelpers.ts:423` mal `WorldDaemonDifficulty` 2); Level 2500 kostet
~3,5e19 Erfahrung statt 4,0e8 (`Person.ts:62` mal
`HackingLevelMultiplier` 0,35); Rep-Summe **7.850.000** statt 3.925.000 und
Aug-Runden **1.325 Mrd** statt 265 Mrd (`AugmentationHelpers.ts:158-159`);
15 Server a 2^19 GB statt 25 a 2^20. Und die Datei behauptet "Bladeburner ist
in BN1 gesperrt" - das gilt fuer BN1, nicht fuer den laufenden Knoten.
**Zu tun: Warnkopf einsetzen.** Wer sie als aktuelle Grundlage liest, plant
auf Zahlen, die um Faktor 2 bis 10^11 danebenliegen.

**2. Die Aug-Kostentabelle im Punkt von 09:40 fuehrt rohe Basiswerte.**
"EsperTech 1,3k Rep / 165 Mio" sind die Werte aus `Augmentations.ts:711-713`
ohne `AugmentationRepCost` (2) und `AugmentationMoneyCost` (5). Real: **2.500
Rep / 825 Mio**; Blade-Runners **40.000 Rep / 41,25 Mrd** statt 20k/8,3b. Der
neuere Punkt von 12:58 benennt den Mechanismus richtig, die falsche Tabelle
steht unveraendert daneben und traegt weiterhin "Dringlichkeit: hoch".

**3. `doku/formeln-hacking.md` §8.4 verliert einen Faktor.** Die Formel fuer
den Geldanteil je Thread laesst `currentNodeMults.ScriptHackMoney`
(`Hacking.ts:53-54`) weg. In BN10 ist der 0,5, also p = **0,202 %** statt
0,404 und **496 Threads** statt 248. §1.2 derselben Datei hat den Faktor
korrekt - §8.4 liefert aber die Zahlen, mit denen gerechnet wird.

**4. Der Hash-Punkt "Wartet bis SF9" rechnet mit einem Festpreis, den es
nicht gibt.** `HashUpgrade.ts:72-81` rechnet `(currentLevel+1) * costPerLevel`
je Stufe. 4.000 Stufen "Exchange for Bladeburner Rank" kosten **2,0 Mrd
Hashes**, nicht 1 Mio - Faktor 2.000. Der Punkt wuerde nach SF9 zum "Hebel"
hochgestuft; er ist keiner. Nur `Improve Gym Training` (erste Stufe 50) ist
real billig.

**5. `doku/formeln-boerse.md` §6 steht genau falschherum.** Behauptet: "Ein
vollstaendiger grow auf einen Server mit vollem Geldstand trifft fast
sicher." `NetscriptFunctions.ts:302` uebergibt die **Differenz**, und
`PlayerInfluencing.ts:57-58` rechnet `moneyGrown / server.moneyMax` - ein
voller Server liefert 0, die Trefferwahrscheinlichkeit ist **null**. Der
Bauplan im Punkt "Boersen-Bot fuer BitNode 8" ("der Bot muss den Forecast
nicht schaetzen, er setzt ihn") haengt daran.

**6. `doku/formeln-hacking.md` §7.3 rechnet die Worker-Groesse zu klein.**
`RamCalculations.ts:218-222` dedupliziert ueber den **Bezeichnernamen**,
nicht ueber die Konstante - die vier `getServer*`-Aufrufe sind vier
verschiedene Refs a 0,1 GB. Korrekt **2,40 GB** statt 2,10. Das RAM-Budget je
Worker ist 14 Prozent zu niedrig; die letzte Batch-Charge bekommt kein RAM.

**7. Der Boersen-Punkt nennt `stocks.js` "wiederverwendbar".** Der Wachhund
`StockMarket.ts:47` macht Shorts und Limit-Orders **nur in BN8** frei;
`src/stocks.js:83,150` ruft `ns.stock.sellShort` und wirft in BN10 eine
Exception. Der Vermerk gehoert auf Long und Marktorder eingeschraenkt.

**8. Der Darknet-Punkt zitiert den falschen Zweig.** `labyrinth.ts:424-427`
ist der Zweig fuer **andere** BitNodes mit SF15; in BN15 selbst greift
`:419-422`, und die Red Pill faellt schon beim **fuenften** Labor, nicht beim
sechsten. Ein Einbauzyklus und rund vier Raetselloeser zuviel eingeplant.

**9. `nodes/KURS.md`, Eintrag 30.08. 07:20: `a = 0,5` ist angenommen, nicht
hergeleitet.** Beide Kanaele, ueber die der Multiplikator wirken soll, sind
gedeckelt: Die Erfolgschance klemmt bei `min(1, competence/difficulty)`
(`Actions/Action.ts:195`), und Overclock hat `maxLvl: 90`
(`data/Skills.ts:51`) - die 90 Stufen kosten 5.877 Skillpunkte, also Rang
**17.631**, vier Prozent des Weges. Danach waechst nur noch der Aktionslevel.
**Die ETA von 77 h und die daran haengende Entscheidung "Einbau nicht jetzt"
stehen auf einem Mechanismus, der ab Rang 17.600 nicht mehr existiert.** Der
Kursloop muss das beim naechsten Lauf neu rechnen.

**Kleinere, ebenfalls belegte Abweichungen:** `formeln-boerse.md` §5 rechnet
den Rundlauf-Spread halb so gross wie `Stock.ts:224-232`; §4 setzt `otlkMag`
auf "1 bis 10", `InitStockMetadata.ts` vergibt bis **19**. Der
Darknet-Volatilitaetsmultiplikator erreicht 2,5 bei rund 2.350 Ladungen,
nicht 4.600. Im 09:40-Punkt steht `rankLoss` "spaeter bis 10.000" - das
Maximum ist Operation Vindictus mit **20.000** (`BlackOperations.ts:678`).
Die Fussnote zum Divisionsbeitritt nennt vier Bedingungen; es sind fuenf, die
SF6/SF7-Pruefung bei `:331` fehlt.

**Geprueft und korrekt - nicht erneut anfassen:** die Feuerschwellen-
Begruendung, Black-Ops-Immunitaet gegen Bevoelkerung und Chaos,
`RankToFactionRepFactor 2`, die Summe der 21 `rankGain` = 113.660 und die
Rechnung auf 58.928, `reqdRank: 400e3`, Gym 10 exp/s gegen Verbrechen 3,0,
natuerlicher Vorratszuwachs 30/h, Incite als einziger Spielerweg,
Sleeve-Infiltrate 0,5 je 60 s, Stealth-Retirement-Chaossenkung ausserhalb der
Erfolgspruefung, alle BN8-Startbedingungen - und die beiden Punkte von
12:55/12:58.

Dringlichkeit: Punkt 1 und 9 hoch (beide koennen falsche Entscheidungen
ausloesen), der Rest mittel. **Ein Punkt je Lauf.**

### `tools/augplan.js` rechnet die BitNode-Multiplikatoren nicht - und die Aug-Strategie steht (30.08., 12:58)

Aus einem vollstaendigen Audit der Bladeburner-Augmentierungen gegen den
Quellcode, geeicht am laufenden Spielstand (das Modell des Auditors trifft
`maxStamina` auf 45,44 gegen echte 45,4359 und die Tracking-Aktionszeit auf
17 s genau).

**Zwei Fehler in `tools/augplan.js`:**

1. Der schon bekannte: `GEWICHT` (Zeile ~110) kennt nur `hacking*`,
   `faction_rep`, `crime`/`work`. Die vier `bladeburner_*` **und alle
   Kampfwert-Multiplikatoren** fallen auf 0. Passende Gewichte fuer BN10, aus
   den Elastizitaeten hergeleitet: `success_chance 1,00`,
   `stamina_gain 0,74`, `max_stamina 0,20`, `analysis 0,00`,
   `strength/defense/dexterity/agility je 0,25`.
2. **Der schwerere, bisher unbenannte:** `augplan` vergleicht `a.rep <= rep`
   und `a.money <= p.money` gegen die **rohen Basiskosten**.
   `currentNodeMults.AugmentationRepCost` (2) und `AugmentationMoneyCost` (5)
   fehlen, ebenso der Warteschlangenfaktor `1,9^k`
   (`AugmentationHelpers.ts:157-158`). In BN10 meldet das Werkzeug damit
   "KAUFBAR" bei **halber Rep-Anforderung und einem Fuenftel des Preises**,
   und der Fehler waechst mit jedem Aug in der Warteschlange. Nebenbei:
   Bladeburners hat 18 Augs, die Ausgabe schneidet bei 12 ab.

**Die Wirkungskette, gemessen statt vermutet:**

    success_chance   Elastizitaet 1,00   (linear, `Actions/Action.ts:190`)
    stamina_gain                  0,74
    max_stamina                   0,20   (der Aug-Mult wirkt NUR in
                                          calculateMaxStamina, nicht doppelt
                                          wie der Skill-Mult)
    bladeburner_analysis          0,00   wirkt ausschliesslich auf die
                                          Genauigkeit der Bevoelkerungs-
                                          schaetzung in FieldAnalysis
                                          (`Bladeburner.ts:1128`), und fuer
                                          Black Ops ist der Kanal per
                                          `getPopulationSuccessFactor(): 1`
                                          hart abgeklemmt

Damit sind BLADE-51b IPU und Vangelis Virus deutlich schlechter, als ihr
Datenblatt suggeriert. Und **GOLEM Serum ist das staerkste Aug im Feld**
(+11,7 % Rang/h) obwohl sein einziger `bladeburner_*`-Wert `gain 1,05` ist -
die Kampfwert-Multiplikatoren gehen ueber `getEffectiveSkillLevel` in
dieselbe `competence` ein. Ein Schema, das nur `bladeburner_*` gewichtet,
waere der naechste Fehler nach dem jetzigen.

**Rep je Rangpunkt, aus dem Live-Stand: 3,831** (`faction_rep` 1,8764,
Gunst 2,080). Contracts haben `rankLoss = 0`, brutto ist also netto.

**Die Strategie, gerechnet:**

*Jetzt ist nichts zu kaufen.* Rep steht bei 490, das billigste Aug kostet in
BN10 2.500 Rep - erreichbar ab **Rang 1.101**.

*Danach genau EIN Einbau, im Fenster Rang 11.000 bis 17.000.* Nicht frueher,
nicht in Scheiben. Die Gruende:

- Der Wiederaufbau kostet ~3 h, die Amortisation ist **ratenunabhaengig**:
  `3/X` Stunden bei X Prozent Zuwachs. Fuer das 10-Aug-Paket (X = 0,64) sind
  das **4,7 Stunden**.
- Der teure Teil ist nicht der Kampfwert-Reset, sondern dass
  `Faction.prestigeAugmentation()` die **Bladeburners-Reputation auf 0**
  setzt. Deshalb nicht bei Rang 1.101 fuer ein 4,4-%-Aug einbauen -
  Amortisation 68 h, und 2.500 Rep waeren verbrannt.
- Was ueberlebt, spricht fuer den Einbau: `Bladeburner.prestigeAugmentation()`
  macht nur `resetAction()` und `joinFaction()`. **Rang, Skillpunkte,
  Skillstufen, Aktionsstufen und Stadtdaten bleiben vollstaendig.** Es geht
  kein Rangpunkt verloren, nur die 3 h.
- Die verbrannte Rep kommt als **Gunst** teilweise zurueck: Einbau bei 42.500
  Rep ergibt Gunst 50,9, und Rep je Rang steigt von 3,831 auf **5,664
  (+48 %)**.
- Zwei Einbauten gegen einen durchgerechnet: in Rangzeit praktisch identisch
  (213.320 gegen 214.512), aber einer spart 3 h Wiederaufbau.

**Konkret: Bei Rep 42.500 / Rang ~11.500 zehn Augs fuer $1,59t kaufen**
(+64 % Rang/h). Wichtig - die **Geldreihenfolge innerhalb eines Einbaus ist
absteigend nach Basispreis**, weil `1,9^k` nur aufs Geld wirkt, nicht auf die
Rep. Bei falscher Reihenfolge kostet derselbe Satz das Vierfache.

Nutzenreihenfolge je 1000 Rep: EsperTech Eyewear (1,767) - EMS-4 (0,904) -
ORION-MKIV (0,549) - Tesla Armor (0,366) - Hyperion V1 (0,240) - Power Cells
(0,202) - Blade's Runners (0,189) - GOLEM Serum (0,188) - Hyperion V2 (0,160).
Omnibeam (Rang 33.080) und Vangelis 3.0 gehoeren nicht in diesen Einbau.

**Nebenbefund fuer die Black Ops:** `BlackOperation` erbt `getSuccessChance`
unveraendert; nur Bevoelkerung und Chaos sind auf 1 gesetzt, Zeitstrafe 1,5,
Teambonus `(n+1)^0,05`. `bladeburner_success_chance` wirkt dort also **voll
multiplikativ und linear** (p ~ 0,03 bis 0,25, weit vom Deckel). Produkt
aller 13 success_chance-Augs: **x1,9161**. Operation Typhoon heute 0,0398 ->
0,0762; bei Rang 2.500 mit Kampfwert 300: 0,2416 -> 0,4629.

Dringlichkeit: mittel. Nichts davon ist heute kaufbar - aber `augplan.js`
wuerde bei Rang 1.101 falsche Preise melden und einen verfruehten Einbau
ausloesen.

### Field Analysis statt Regenerationskammer: +80 Prozent auf die Rangrate (30.08., 12:55)

Aus einem vollstaendigen Parameter-Audit von `src/blade.js` gegen den
Spielquellcode. **Der groesste einzelne Hebel im aktuellen Zustand.**

IST: Im Ausdauer-Band (`AUSDAUER_RUHE` 0,51 / `AUSDAUER_WEITER` 0,56,
     `blade.js:404-405`, Rueckgabe `:1450`) faehrt der Bot
     `General/Hyperbolic Regeneration Chamber`.

SOLL: Im **Ausdauer**-Band `General/Field Analysis`. Die Kammer bleibt fuer
     den HP-Zweig.

Die Rechnung, alle Groessen belegt:

    Kammer gibt maxStamina * 1/100 je 60-s-Lauf = 0,395/min ZUSAETZLICH
      (`data/Constants.ts:52` HrcStaminaGain 1, `Bladeburner.ts:1199-1202`)
    Die passive Regeneration (1,188/min) laeuft bei JEDER Aktion weiter
      (`Bladeburner.ts:1382`)
    Field Analysis kostet null Ausdauer, dauert fest 30 s und bringt
      0,1 * BladeburnerRank = 0,08 Rang -> 0,16 Rang/min
      (`data/GeneralActions.ts:13-21`, `Formulas.ts:12-14`)

Zyklusrechnung mit Bounty Hunter:

    Kammer-Politik  w = 0,3475            -> 0,151 Rang/min
    FA-Politik      w = 1,188/4,160=0,2856 -> 0,124 (Vertrag)
                                            + 0,714*0,16 = 0,114 (FA)
                                            = **0,238 Rang/min**

Gleichstand erst bei Erfolgschance p ~ 0,88. **+80 Prozent** (0,130 -> 0,235).

Der Bot steht derzeit rechnerisch 77 Prozent der Zeit in der Kammer und
verdient dort **exakt null**; sie kauft nur 33 Prozent mehr
Ausdauerdurchsatz.

Aus demselben Audit, in absteigender Wirkung und alle mit Fundstelle:

2. **`TRUPP_ZIEL = 6`** (`blade.js:370`, Sperrzweig `:2108-2114`) ist bei
   reinen Vertraegen wertlos: `ActionClass.getTeamSuccessBonus` gibt fuer
   Vertraege fest 1 zurueck (`Actions/Action.ts:124-126`), der Bonus
   `(teamCount+1)^0,05` existiert nur in `Operation` und `BlackOperation`.
   Kosten: rund 21 Rekrutierungsversuche a ~300 s = **1,7 h Nullertrag**.
3. **`CHANCE_SKILLS`-Abdeckungen** (`blade.js:737-751`) gewichten nach dem
   Black-Op-Feld. Bei Vertraegen ist **Digital Observer 0** statt 1,0
   (`SuccessChanceOperation` wirkt nur auf Operationen, Vertraege holen ihren
   Bonus aus `SuccessChanceContract`, `Actions/Contract.ts:30-32`), und
   **Cloak 1,0** statt 0,17 (Tracking ist `isStealth`, `data/Contracts.ts:41`).
   Nutzen je Punkt beim Erstkauf: Cloak 2,75 gegen Digital Observer 0 -
   **Faktor 7,6** in der falschen Reihenfolge.
4. **`lvlPlus` bei Hyperdrive** (`blade.js:759`) laesst den
   BN10-Levelmultiplikator 0,4 weg (`BitNode.tsx:841-845`) - Hyperdrive ist
   damit **2,5-fach ueberbewertet** und gewinnt die Sortierung unverdient.
   Genau der am 28.08. protokollierte Ausfall (Hyperdrive Stufe 219).
5. **`chaosJetzt < 25`** (`blade.js:2746`) muesste **19** sein, nicht 23 wie
   heute um 12:40 geschaetzt: Aus 20 wird 30, dann 30/1,4771 = 20,31, also
   **50,31** - ueber der Schwelle. Stetig geloest liegt die Grenze bei 19,78.
6. **`stern` in `einsatzSchwelle()`** (`blade.js:1736`) muss
   `rankLoss / (BladeburnerRank * rankGain + rankLoss)` lauten - der
   Knotenfaktor 0,8 steht nur auf dem Gewinn (`Formulas.ts:22`), nicht auf
   dem Verlust (`:40-41`). Bei Vindictus 0,556 statt 0,500; mit der
   gesetzten Schwelle liegt der Erwartungswert dort **im Minus**.
7. **`feldErtrag`** (`blade.js:2699,2702`) vergisst denselben Faktor: 0,16
   statt 0,2 in BN10.
8. **`wert(stadt)`** (`blade.js:1956-1961`) laesst die Bevoelkerung linear
   eingehen; richtig ist `(pop/1e9)^0,7` (`Actions/Action.ts:88-92`). Ein
   gesetzter Vorsprung von 2,0 entspricht real nur 1,62.

**Tote Parameter** (werden nirgends gelesen): `RAID_GELD_MIN`,
`RAID_CHAOS_MAX`, `RAID_CHANCE_MIN`, `RAID_CHARISMA_MIN` (`blade.js:148-156`).

**Geprueft und als richtig bestaetigt:** `CHAOS_EIN = 50`, Overclock-Deckel
90, `BBTRAIN_ZIEL = 100`, `RANG_JE_ERFOLG`, `REWARD_FAC`, `BLACKOP_DATEN`
(alle 21), `CHAOS_JE_LAUF`, `POP_JE_ERFOLG` inklusive Raid-Fehlschlagrate,
der Diplomacy-Term und `blackOpChance()` Term fuer Term.

**Die Einordnung des Auditors gehoert dazu:** Alle zehn Punkte zusammen heben
die Rangrate von ~14 auf ~30 je Stunde. Der Restweg betraegt 399.440 Rang.
Der eigentliche Hebel in diesem Zustand sind die **Kampfwerte**, nicht die
Aktionsauswahl - die Erfolgschance skaliert mit `stat^0,91`, die
Ausdauerkosten je Aktion sind stat-unabhaengig.

Dringlichkeit: hoch fuer Punkt 1 bis 4, mittel fuer den Rest. **Ein Punkt je
Lauf**, mit Nachmessung - nicht alle auf einmal.

### `tools/tor.js` steigt in der Division aus, obwohl es dort gebraucht wird (30.08., 12:52)

Gemessen: `node tools/tor.js` antwortet seit dem Divisionsbeitritt nur noch
          *"Bereits in der Division - dieses Werkzeug ist hier fertig."*
          (`tools/tor.js:86`, Bedingung `lage.inBladeburner`).

Erwartet: Das Werkzeug beherrscht genau die Rechnung, die nach **jedem**
          Augmentierungs-Einbau gebraucht wird: Es kehrt die Skillformel um
          (`PersonObjects/formulas/skill.ts`), leitet den Multiplikator aus
          dem laufenden Stand zurueck und holt die Gym-Rate aus dem
          Spielstand statt aus einem Zeitfenster.

          Nach einem Einbau fallen die Kampfwerte auf 1 und werden im Gym
          wieder aufgebaut - dieselbe Rechnung, dieselbe Formel. Weil das
          Werkzeug hier aussteigt, musste die Dauer am 30.08. von Hand
          geschaetzt werden, und die Schaetzung war falsch (siehe
          `nodes/HEBEL.md`, Eintrag 12:30 und seine Korrektur 12:52).

Zu tun:   Die Bedingung in `tools/tor.js:86` so aendern, dass das Werkzeug
          auch in der Division rechnet, **solange der Tiefstand unter 100
          liegt**. Oberhalb bleibt die bisherige Meldung richtig.

          Die vollstaendige Formel steht inzwischen belegt in
          `nodes/HEBEL.md`:

              T = SUMME ueber str,def,dex,agi von
                  [ e^((Ziel / (mult_stat * BN_LevelMult) + 200) / 32) - 534,6 ]
                  geteilt durch (10 * exp_mult)

          mit `BN_LevelMult` = 0,4 in BitNode 10 (`BitNode/BitNode.tsx:841-845`).
          Wichtig: Der **Level**-Multiplikator (`mults.strength` usw.) gehoert
          in die Formel, nicht `strength_exp` - der geht nur linear in die
          Rate, waehrend der Level-Mult exponentiell im Bedarf steht. Genau
          diese Verwechslung hat am 30.08. den Fehlschluss erzeugt.

          Gegenprobe fuer die Umsetzung: Fuer den Einbau vom 30.08. 09:21
          muss das Werkzeug **3,07 h** ausgeben; gemessen wurden 3,1 h, und
          das Teilsegment Tiefstand 60 auf 99 sagt das Modell mit 148,2 min
          gegen gemessene 149 voraus.

Dringlichkeit: mittel. Es ist kein Fehler im Bot, sondern eine Luecke in der
          Diagnose - aber sie faellt bei jedem Einbau an, und der kommt
          regelmaessig.

### `tools/rueckstand.js` kann einen Spielausfall nicht sehen (30.08., 12:52)

Gemessen: Das Spiel war in der Nacht vom 29. auf den 30.08. zwischen rund
          **01:30 und 06:12 aus** - belegt aus drei eigenen Protokollen:

              data/aufsicht.log  letzte Zeile 01:28:51, naechste 06:01:36
                                 ("Loops stehen seit 282 min")
              data/wache.log:4   06:04:39 PUSH "Bitburner-Tab zu oder abgestuerzt"
              data/wache.log:8   06:13:42 PUSH "Spiel haengt wieder an der Bruecke"

          `node tools/rueckstand.js` meldete um 12:26 trotzdem: *Tempo 1,000,
          Rueckstand 0,0 min, Trend +0,0 min je Stunde ueber 26,3 h.*

Erwartet: Ein Ausfall von 4,5 Stunden muesste sichtbar sein.

Ursache:  **Konstruktionsbedingt blind.** Die Spiel-Engine rechnet die
          gesamte Ausfallzeit in `numCyclesOffline`
          (`reference/bitburner-src/src/engine.tsx:265`), traegt die laufende
          Arbeit damit nach (`:283`, `Player.processWork`) und schreibt die
          **volle Ausfallzeit in `totalPlaytime`** (`:345-351`). Genau dieses
          Feld liest `tools/rueckstand.js:111`. Nach einem Ausfall meldet das
          Werkzeug deshalb zwangslaeufig Tempo 1,000.

          Nebenbefund, der beruhigt: Weil `processWork` offline nachgetragen
          wird, ging die Gym-Zeit vermutlich gar nicht verloren - sie wurde
          beim Laden auf einen Schlag gutgeschrieben.

Folge:    Der Test ist als Ausschlusskriterium wertlos. Am 30.08. um 12:30
          wurde mit ihm die Tab-Drosselung "ausgeschlossen" und daraus ein
          falscher Schluss auf die Wiederaufbaudauer gezogen
          (`nodes/HEBEL.md`, inzwischen korrigiert). Das Werkzeug wird von
          allen fuenf Loops als erste Diagnose bei Stagnation benutzt - es
          wird also weiter falsch beruhigen, solange es so bleibt.

Zu tun:   Eine **zweite, unabhaengige Quelle** fuer Ausfaelle. Die Wanduhr-
          Luecke steht bereits in `data/aufsicht.log` und `data/bridge.log`
          auf der Platte: Wo zwischen zwei Zeilen mehr Zeit liegt als der
          Takt, war das Spiel oder der Rechner weg. `rueckstand.js` muesste
          das mitlesen und getrennt ausweisen - "Tempo 1,000, aber 4,5 h
          Luecke seit 01:28" ist die ehrliche Auskunft.

Dringlichkeit: mittel-hoch. Kein Schaden am Bot, aber das Werkzeug erzeugt
          falsche Sicherheit an genau der Stelle, wo die Loops sie am
          wenigsten gebrauchen koennen.

### Zwischen Chaos 25 und 50 gibt es kein Zurueck - der Bot sitzt bei 41,37 (30.08., 12:40)

Gemessen (Spielstand direkt, 12:35): Der Bladeburner operiert in **Aevum**
(der Spieler-Avatar steht in Sector-12 fuers Gym - das ist korrekt und
gewollt, Aevum hat mit 2.157 Mio die groesste Bevoelkerung).

    Aevum      chaos 41,37   pop 2157M   comms 126   <- Bladeburner-Stadt
    Ishima     chaos 46,82   pop 1085M
    Chongqing  chaos 28,25   pop 1755M
    New Tokyo  chaos 28,23   pop  828M
    Sector-12  chaos 21,56   pop 1564M
    Volhaven   chaos 20,01   pop 1831M

**Kein akuter Schaden.** `getChaosSuccessFactor` gibt unterhalb von
`ChaosThreshold = 50` exakt **1** zurueck (`Actions/Action.ts:94-101`,
`data/Constants.ts:31`). Bei 41,37 kostet das Chaos also nichts.

**Die Luecke.** Zwei Grenzen im Bot lassen ein Band offen, in dem es keinen
billigen Weg zurueck gibt:

    Incite Violence gesperrt ab   chaos >= 25   (`src/blade.js:2746`)
    Diplomacy startet erst ab     chaos >= 50   (`CHAOS_EIN`, `blade.js:93`)

Bei 41,37 ist Incite Violence gesperrt - und Incite ist der **einzige Weg des
Spielers**, Kontrakt- und Operationsvorraete aufzufuellen
(`Bladeburner.ts:1219-1225`). Faellt der Vorrat leer, bleibt nur der
natuerliche Zuwachs von rund 30 Stueck je Stunde und Art.

**Wie der Bot hierher kam - und das ist eine Folge des Fixes von 07:55.**
Vorher lief kein einziger Incite-Durchlauf zu Ende (18 Abbrueche zwischen 11
und 46 Sekunden), das Chaos blieb deshalb bei 7,7. Seit dem Fix laeuft die
Aktion durch - und ein Durchlauf hebt das Chaos um `10 + chaos/log10(chaos)`
in **jeder** Stadt (`Bladeburner.ts:1229-1233`). Rueckgerechnet: von rund 17
auf 41,3. Der Fix ist richtig, die Nebenwirkung war nicht bedacht.

**KORREKTUR (30.08., 13:05, durch einen Doku-Pruefer): Die Nachrechnung
unten ist falsch - der hoechste sichere Startwert ist 19, nicht 23.**

`Bladeburner.ts:1229-1233` ruft `changeChaosByCount(10)` und **danach**
`changeChaosByCount(city.chaos / Math.log10(city.chaos))`. `City.ts:88-90`
mutiert sofort - der zweite Aufruf liest also das **bereits erhoehte**
Chaos. Richtig ist:

    c_neu = (c + 10) + (c + 10) / log10(c + 10)

    c = 19  ->  29 + 29/1,4624 = 48,83   sicher
    c = 20  ->  30 + 30/1,4771 = 50,31   REISST DIE SCHWELLE

Wer 23 setzt, treibt das Chaos genau ueber `ChaosThreshold` - also in den
Zustand, den dieser Punkt verhindern soll. Der Parameter-Audit von 12:55
nennt unabhaengig dieselbe 19. **Es gilt die 19.** Auch die Rueckrechnung
unten stimmt nicht: 41,37 entsteht aus rund 14, nicht aus 17.

Die falsche Rechnung bleibt zur Warnung stehen:

**Der Deckel 25 ist zu hoch.** Der Kommentar an `blade.js:2746` rechnet: "Ein
Durchlauf bringt es auf etwa 35, ein zweiter darueber - deshalb die Grenze
bei 25." Nachgerechnet mit der echten Formel:

    chaos 20  ->  20 + 10 + 20/1,301  =  45,4   noch unter 50
    chaos 22  ->  22 + 10 + 22/1,342  =  48,4   noch unter 50
    chaos 23  ->  23 + 10 + 23/1,362  =  49,9   knapp drunter
    chaos 24  ->  24 + 10 + 24/1,380  =  51,4   REISST DIE SCHWELLE

Der hoechste sichere Startwert ist **23**, nicht 25.

**Diplomacy ist als Rueckweg zu teuer.** `getDiplomacyPercentage` ist
`charisma^0,045 + charisma/1000` (`Bladeburner.ts:735-743`). Bei Charisma 30
sind das **1,20 Prozent je 60 Sekunden**. Von 41,37 auf unter 25:

    41,37 * 0,988^n < 25   ->   n = 42 Durchlaeufe = **42 Minuten ohne Rang**

**Der billigere Rueckweg steht schon im Code, wird hier aber nicht genutzt:**
Stealth Retirement senkt das Chaos um 1 bis 3 Prozent und zwar **auch bei
Fehlschlag** - `changeChaosByPercentage` steht ausserhalb der
Erfolgspruefung (`Bladeburner.ts:846-854`, im Bot bei `blade.js:100-110`
korrekt hergeleitet). Es bringt dabei Rang. Der Bot fuehrt es aber nur unter
`SPIEL_CHAOS_AN` als Senker, wenn `CHAOS_EIN = 50` erreicht ist.

Zu tun (nicht in diesem Lauf, weil parallel ein Parameter-Audit von
`blade.js` laeuft):
1. Deckel von 25 auf **23** - exakt hergeleitet, eine Zahl.
2. Pruefen, ob die Chaos-Senkung frueher anspringen sollte, wenn der
   Vorrat knapp wird: Solange Chaos > 23 ist, kann der Spieler nicht
   nachfuellen. Die Frage ist, ob das je bindet - dafuer muss gemessen
   werden, wie schnell der Vorrat im Vollbetrieb faellt.

Dringlichkeit: mittel. Kein Schaden solange chaos < 50 und der Vorrat haelt.
Wird akut, sobald beides zusammenkommt.

### Sleeve-Shock steht nach dem Einbau auf 99,9 - Recovery lohnt trotzdem nicht (30.08., 12:15)

Gemessen: `data/sleevediag.json` um 09:56: **shock 99,9**. Gestern vor dem
          Einbau waren es 82,2.

Ursache:  Kein Fehler, sondern Mechanik. Die Reset-Routine des Sleeve setzt
          `this.shock = 100` (`PersonObjects/Sleeve/Sleeve.ts:251`). Jeder
          Augmentierungs-Einbau wirft den Sleeve also auf Vollschock zurueck.

Wirkung:  `shockBonus() = (100 - shock) / 100` (`Sleeve.ts:173-175`), bei 99,9
          also **0,001**. Der Sleeve bekommt ein Promille seiner
          Erfahrungsgewinne - seine Kampfwerte stagnieren praktisch, und damit
          auch seine Erfolgschance.

          **Wichtig, damit niemand falsch schliesst:** Der Rang fuer den
          Spieler haengt NICHT am Shock. `SleeveBladeburnerWork.process:53`
          ruft `Player.bladeburner.completeAction(...)` ungedaempft; nur die
          Zeile danach skaliert die Gewinne des Sleeve mit `shockBonus()`.
          Der Sleeve liefert also weiter vollen Rang - er entwickelt sich nur
          nicht mehr.

**Shock Recovery ist gerechnet und verworfen (12:15).**

**KORREKTUR (30.08., 13:05, durch einen Doku-Pruefer):** Der Faktor ist
**3, nicht 2**, und Recovery dauert **18,5 h, nicht 28**.
`Sleeve.ts:269-272` zieht die 0,0001 je Zyklus bei **jeder** Arbeit ab -
auch waehrend Recovery. `SleeveRecoveryWork.ts:13-16` kommt also obendrauf:
0,0003 je Zyklus = 5,4 Shock je Stunde. Die Schlussfolgerung "nicht machen"
traegt trotzdem, aber die Gegenrechnung unten ist falsch beziffert. Sie
bleibt stehen, damit ein spaeterer Vergleich sie nicht ungeprueft uebernimmt.

Die beiden Abbauraten stehen im Quellcode und unterscheiden sich um **genau
Faktor 2**:

    Arbeiten (jede Aufgabe)   shock -= 0,0001 * intBonus * cyclesUsed   (`Sleeve.ts:269-272`)
    Shock Recovery            shock -= 0,0002 * intBonus * cycles       (`SleeveRecoveryWork.ts:13-16`)

Bei rund 5 Zyklen je Sekunde (`CyclesPerSecond = 1000 / MilliPerCycle`,
`Sleeve.ts:265`) sind das 1,8 gegen 3,6 Shock je Stunde. Von 99,9 auf 0:

    arbeitend    55 h   - nebenbei, kostet nichts
    Recovery     28 h   - und in der Zeit **kein Rang**

Recovery spart 27 Stunden Shock, kostet aber 28 Stunden Rangarbeit. Bei der
im Vollbetrieb gemessenen Sleeve-Leistung ist das ein vierstelliger
Rangverlust fuer einen Vorteil, den der Sleeve beim Arbeiten ohnehin
einsammelt. **Nicht machen** - der Shock baut sich von allein ab, nur halb so
schnell, und Arbeiten bringt zusaetzlich Rang.

Das passt zur bereits entschiedenen Frage "Sleeve: sync hochziehen -
verworfen" (`## ENTSCHIEDEN`, 29.08. 06:55): Stillstand kostet mehr als der
Zustand wert ist.

Offen bleibt eine kleinere Frage: **`takeDamage` erhoeht den Shock um 0,5,
wenn die HP des Sleeve auf 0 fallen** (`Sleeve.ts:565-568`). Gegen 1,8 Abbau
je Stunde heisst das: Stirbt der Sleeve oefter als **3,6 mal je Stunde**,
steigt sein Shock netto an statt zu fallen. Der Sleeve hat 10/10 HP. Zu
messen, sobald `blade.js` wieder traegt: Wie oft faellt er? Steht die Rate
darueber, ist die Kontraktwahl fuer den Sleeve zu riskant - dann waere eine
Schwelle auf die Erfolgschance faellig, nicht auf den Vorrat.

Dringlichkeit: niedrig fuer den Shock selbst (er baut sich ab), mittel fuer
          die Todesrate - die ist ungemessen und koennte den Abbau umkehren.

### Sleeve stand still, weil die Vorratsschwelle keinen Abschluss ueberlebt (30.08., 10:00)

Eric hat es zweimal im Spiel gesehen (09:53 und 09:56) - beide Male meldete
`data/sleeve.json` brav `gesetzt: true, contract:Retirement`, waehrend
`ns.sleeve.getTask(0)` **null** zurueckgab.

Gemessen (`data/sleevediag.json`, 09:53:59):

    task    null
    skills  str 45  def 45  dex 57  agi 48     (ueber KONTRAKT_MIN_KAMPF 40)
    shock   98,7
    vorrat  Tracking 3,41   Bounty Hunter 5,69   Retirement 1,93

Ursache: **Zwei Fehler, die sich gegenseitig verdeckt haben.**

  1. **Die Schwelle war 1, nicht 2.** `sleeve.js` liess Retirement mit 1,93
     durch. Der Sleeve schloss einen Kontrakt ab, der Stand fiel auf 0,93,
     und `SleeveBladeburnerWork.process` stoppte ihn im selben Takt
     (`if (action.count < 1) return sleeve.stopWork()`, Zeile 44-47). Jedes
     Setzen war also sofort tot - und `setToBladeburnerAction` gab trotzdem
     `true` zurueck (`Sleeve.ts`, `bladeburner()` ruft `startWork`
     bedingungslos), weshalb die Rueckfallkette nie griff.

     Verschaerfend: Die Sortierung nach Vorrat waehlte zwar die ergiebigste
     Art, aber `sleeve.json` zeigte Retirement - die knappste. Der Grund ist
     derselbe: Bei einer Schwelle von 1 kam auch die knappste durch.

  2. **In der Wiederaufbauphase fuellt niemand den Vorrat nach.** Der Spieler
     faehrt Gym (`blade.json`: `grund: "weicht bbtrain, Kampfwerte 1, nichts
     ueber Schwelle"`) und damit kein Incite Violence. Der Sleeve frisst den
     Restvorrat auf und steht danach - zehn Stunden lang, bis der
     Wiederaufbau durch ist.

Eingebaut: **`src/sleeve.js`, zwei Aenderungen.**

  1. `if (vorrat < 2) continue;` statt `< 1` - die Schwelle muss einen
     Abschluss ueberleben.
  2. Neuer Rueckfall vor dem Gym: `Infiltrate Synthoids`. Es legt
     `Math.pow(infilSleeves, -0.5) / 2` auf **jede** Kontraktart und **jede**
     Operation (`Bladeburner.ts`, `infiltrateSynthoidCommunities`), bei einem
     Sleeve also 0,5 je 60 Sekunden. Nach zwei Minuten ist jede Art wieder
     ueber der Schwelle, dann greift oben der Kontraktzweig - selbstbegrenzend.
     Besser als das Gym, weil der Sleeve mit 45/45/57/48 laengst ueber
     `KONTRAKT_MIN_KAMPF` liegt und Training den Vorrat nicht fuellt.

**Verifiziert 09:56:48.** Nach dem Neustart:

    task    {"actionName": "Bounty Hunter", "tasksCompleted": 3,
             "cyclesWorked": 15, "cyclesNeeded": 175}
    vorrat  Tracking 4,63   Bounty Hunter 4,02   Retirement 1,75

Der Sleeve arbeitet, hat drei Kontrakte abgeschlossen - und Retirement mit
1,75 wird jetzt korrekt uebersprungen. Genau der Fall, der ihn vorher toetete.

Offen: Der **Infiltrate-Rueckfall ist noch ungetestet** - er greift erst, wenn
alle drei Arten unter 2 fallen. Beim naechsten Lauf in `data/sleeve.json`
nachsehen, ob `aufgabe: "infiltrate"` je auftaucht, und ob der Vorrat danach
wieder steigt.

### Bladeburner-Augmentierungen sind ungenutzt und werden mit 0,00 bewertet (30.08., 09:40)

Gemessen: Nach dem Einbau von 09:2x stehen **alle vier Bladeburner-
          Multiplikatoren auf 1,000** (`node tools/save.js`), obwohl 17
          Augmentierungen installiert sind:

              Bladeburner-Mult  chance 1.000  ausdauer 1.000
                                regen 1.000   analyse 1.000

          `node tools/augplan.js` zeigt 18 Bladeburner-Augmentierungen, **alle
          mit Nutzen 0.00** und dem Vermerk "zaehlt nur als Kopf fuer die
          30er-Schwelle".

Erwartet: In einem Knoten, dessen Ausgang ueber 400.000 Bladeburner-Rang
          laeuft (`nodes/KURS.md`, 30.08. 07:20), sind das die wertvollsten
          Multiplikatoren ueberhaupt - und der Bot bewertet sie mit null.

          **Die Reputation faellt kostenlos an.**
          `Bladeburner/Formulas.ts:46-49`:

              Rep = RankToFactionRepFactor * rankGain * mults.faction_rep
                    * (1 + favor/100)

          mit `RankToFactionRepFactor = 2` (`data/Constants.ts:41`). Jeder
          erarbeitete Rangpunkt bringt also **rund zwei Reputationspunkte**,
          solange die Mitgliedschaft steht (`Bladeburner.ts:1277-1280`,
          `isMember` - geprueft, `p.factions` enthaelt "Bladeburners").

          Damit sind die Anforderungen klein gegen den Restweg:

              EsperTech Bladeburner Eyewear    1,3k Rep =    650 Rang  $165m
              EMS-4 Recombination              2,5k     =  1.250       $275m
              ORION-MKIV Shoulder              6,3k     =  3.150       $550m
              BLADE-51b Tesla Armor           12,5k     =  6.250       $1,4b
              Hyperion Plasma Cannon V1       12,5k     =  6.250       $2,8b
              Blade's Runners                 20,0k     = 10.000       $8,3b

          Die teuerste liegt bei **2,5 Prozent** des Weges zu Rang 400.000.
          Der Rang muss ohnehin erarbeitet werden - die Rep ist ein
          Nebenprodukt, kein Umweg.

          **Warum es dringend ist:** `data/blade.json` fuehrt die
          Erfolgschancen der Black Ops. Die erste, Operation Typhoon bei Rang
          2.500, steht bei **0,0326**. Ohne `bladeburner_success_chance`
          scheitert der Bot dort systematisch - und jeder Fehlschlag kostet
          `rankLoss` (Typhoon: 10, spaeter bis 10.000).

Verdacht: Zwei Luecken, beide belegt:

          1. **`tools/augplan.js`** bewertet nur Hacking und Reputation. Die
             `bladeburner_*`-Multiplikatoren fallen durch das Raster und
             landen bei 0,00 - in einem Kampfknoten ist das die falsche
             Rangfolge.
          2. **`src/kampfaugs.js`** deckt ausschliesslich str/def/dex/agi ab
             (`KAMPF_MULT`, Zeile 55 ff.). Es war fuer das Beitritts-Tor
             gebaut und ist dort fertig. Fuer `bladeburner_*` gibt es **kein
             Werkzeug**.

          Zu tun ist damit nicht "kaufen" - das geht erst mit Rep und Geld -,
          sondern die **Bewertung** in Ordnung bringen, damit die richtigen
          Augmentierungen in der Warteschlange stehen, wenn der naechste
          Einbau ansteht.

Dringlichkeit: hoch. Der naechste Einbau ist der naechste Hebel, und bis
          dahin entscheidet die Bewertung, was gekauft wird.

**Nebenbefund behoben (09:35).** `tools/save.js` zeigte fuer Bladeburners
"NaN rep". Ursache: Das Spiel laesst `playerReputation` beim Serialisieren
weg, wenn es 0 ist (im Spielstand hat CyberSec das Feld, Bladeburners nicht).
`Math.round(d.playerReputation || 0)` behebt es - **verifiziert 09:36:
"Bladeburners 0 rep, 2.1 favor"**.

### Wartet bis SF9: Hash-Upgrades sind eine ungenutzte Waehrung fuer Kampfknoten

Gemessen: Spielstand 29.08. um 00:58 - `sourceFiles {1,4,5,6}`, kein SF9,
          `hashManager` mit capacity 0 und allen Upgrades auf 0. In diesem
          Knoten ist die Sache also tot; der Eintrag ist fuer die Route.

Erwartet: `Hacknet/data/HashUpgradesMetadata.tsx` fuehrt drei Upgrades, die
          direkt auf unsere Engpaesse zielen:

              Improve Gym Training           50 Hashes  ->  +20 % Gym-Erfahrung
              Exchange for Bladeburner Rank 250 Hashes  ->  100 Rang
              Exchange for Bladeburner SP   250 Hashes  ->   10 Faehigkeitspunkte

          Die ersten beiden Groessen sind genau die, an denen ein Kampfknoten
          haengt: Tor 1 ist Gym-Erfahrung, Tor 2 sind 400.000 Rang. Das
          Gym-Upgrade haelt ausserdem bis zum naechsten Augmentierungs-Einbau,
          ist also je Lauf einmal zu kaufen und wirkt durchgehend.

Verdacht: Kein Fehler, eine fehlende Route. Hashes entstehen nur auf
          Hacknet-SERVERN, und die verlangen SF9. Zu klaeren, sobald BitNode 9
          gefahren ist: Wieviele Hashes je Minute traegt eine gekaufte
          Serverflotte, und wie verhaelt sich das zu 250 Hashes je 100 Rang?
          Bei 400.000 Rang waeren das 1 Mio Hashes - die Zahl entscheidet, ob
          es ein Hebel oder eine Randnotiz ist.

Dringlichkeit: niedrig, aber nicht vergessen. Die BitNode-Reihenfolge steht
          fest; dieser Punkt wird geprueft, wenn SF9 vorliegt.


**Nachmessung 12:10 - der Rueckfall wurde nicht ausgeloest, und das ist
selbst ein Befund.** `sleeve.json` meldet um 12:09:41 `contract:Tracking`,
der Vorrat reicht also. Grund: Der Spieler ist seit dem Einbau im Gym und
verbraucht **keine** Kontrakte - der Sleeve allein leert den Vorrat nicht.
Der natuerliche Zuwachs (rund 30 je Stunde und Art) traegt ihn.

Damit ist die Ausgangsannahme des Punktes zu praezisieren: Der Engpass
entsteht erst, wenn Spieler **und** Sleeve gleichzeitig fressen - also nach
dem Wiederaufbau, sobald `blade.js` wieder traegt. Bis dahin bleibt der
Rueckfall ungetestet. Naechste Gelegenheit ist der Moment, in dem der
Kampfwert-Tiefstand 100 erreicht.

### Wartet bis BitNode 7: Diplomacy frisst 28,7 Prozent der Zeit fuer einen Schaden, den es nicht gibt (13:33)

Gemessen: `data/aktionen.txt`, alle Abschnitte ab 13:05 (14,7 protokollierte
          Minuten):

              Operations/Assassination   10,5 min   71,3 %   12.626 Rang
              General/Diplomacy           4,2 min   28,7 %        0 Rang

          Raid kam nicht mehr vor - der Chaos-Zuschlag von 13:00 wirkt. Das
          Chaos steigt jetzt **exogen**: `randomEvent` alle 240 bis 600
          Sekunden, davon 20 Prozent Synthoid-Riots mit `+1` Zaehlwert und
          `+5 bis +20 %` (`Bladeburner.ts:679-684`), Stadt zufaellig aus
          sechs. Das trifft die eigene Stadt rund alle 35 Minuten und kostet
          bei Charisma 309 (Diplomacy -1,603 % je 60 s) rund 7,3 Minuten
          Aufraeumen - also etwa ein Fuenftel der Zeit, und der Rest ist die
          Streuung von Assassination (`-5 bis +5 %`, `:859`).

Erwartet: **Null Minuten Diplomacy.** Chaos schadet nur ueber
          `difficulty *= sqrt(1 + chaos - 50)` (`Actions/Operation.ts:52-61`),
          und die Erfolgschance ist `Math.min(1, competence/difficulty)`
          (`Actions/Action.ts:196`) - sie klemmt. Solange sie klemmt, ist der
          Chaos-Aufschlag **wirkungslos**, und jede Minute Diplomacy ist
          bezahlter Leerlauf.

          Der Beleg, dass die Reserve gross ist: In Sector-12 stand das Chaos
          um 12:40 bei **101,67** - Faktor 7,26 auf die Schwierigkeit - und
          Raid trotzdem bei **0,997** (`data/bbspann.json`, Block `staedte`).
          In New Tokyo stehen bei Chaos um 50 alle sechs Operationen und alle
          drei Vertraege auf **1,000**.

Verdacht: `src/blade.js`, `CHAOS_EIN = 50` / `CHAOS_AUS = 47`. Die Schwellen
          sind absolut gesetzt, obwohl der Schaden relativ ist. Sauber waere,
          `chaosAufraeumen` erst einzuschalten, wenn das Chaos eine Aktion
          tatsaechlich unter ihre Schwelle drueckt - messbar daran, dass
          `s.min` der besten Aktion unter `SICHER_OPERATION` faellt. Solange
          die beste Aktion bei 1,000 steht, wird nicht aufgeraeumt.

          Zweitlinie, falls die Schwelle doch gebraucht wird: Ein Stadtwechsel
          kostet nichts und setzt das Chaos-Konto auf das der neuen Stadt -
          Diplomacy ist die teuerste aller Moeglichkeiten, das Chaos
          loszuwerden.

Dringlichkeit: **hoch.** 28,7 Prozent der Leitgroesse, bei einem Restweg von
          185.215 Rang und einer gemessenen Rate von 858/min sind das rund
          62 Minuten reiner Leerlauf bis zum Knotenausgang.

**Geaendert 13:40, Wirkung noch nicht vollstaendig gemessen.** `chaosAufraeumen`
schaltet jetzt nur noch ein, wenn das Chaos ueber `CHAOS_EIN` liegt **und**
keine Operation ueber `SICHER_OPERATION` und kein Vertrag ueber
`SICHER_VERTRAG` steht - und es schaltet sofort ab, sobald wieder etwas fahrbar
ist. Die Fundstellen sind nachgeschlagen und decken den ganzen Effekt ab: Chaos
kommt im Bladeburner-Quellcode ausser beim passiven Abbau (`:1397`) und den
`changeChaosBy*`-Setzern **nur** in `Action.ts:96` und `Operation.ts:54` vor;
Black Ops sind immun (`BlackOperation.ts:59-61` gibt fest 1 zurueck).

Was gemessen ist: Die drei neuen Telemetriefelder in `data/blade.json` stehen
und liefern - **13:42:51 `chaos 39.84, fahrbar true, aufraeumen false`**. Ohne
sie liesse sich "es wird nicht aufgeraeumt" nicht von "es gab nichts
aufzuraeumen" unterscheiden.

Was **nicht** gemessen ist: Genau dieser Fall - und bis 15:45 war er auch
gar nicht messbar. `chaosStand` und `fahrbarStand` wurden erst tief in
`waehle()` gesetzt, im Block hinter `if (SPIEL_CHAOS_AN)`. Faellt die Wahl
vorher auf eine Black Op, kehrt `waehle()` vorher zurueck. Gemessen 15:38
waehrend Operation Annihilus: `chaos null, fahrbar null` - seit dem Neustart
um 15:25 war der Block kein einziges Mal erreicht worden. Je besser der Motor
laeuft, desto weniger war zu sehen.

**Geaendert 15:45:** `chaosMessen()` laeuft jetzt am Kopf von `waehle()`, vor
jeder Verzweigung, und fuehrt zusaetzlich eine Hochwassermarke `chaosMax` -
den hoechsten Chaosstand, der je bei `fahrbar: true` und `aufraeumen: false`
gemessen wurde. Damit muss niemand mehr den richtigen Augenblick treffen.

Verifiziert 15:39 bis 15:41, waehrend Operation Ultron lief:
`chaos 33.82, fahrbar true, aufraeumen false, chaosMax 33.82` - vorher stand
dort dreimal `null`. Die **Messluecke** ist damit geschlossen.

Der Punkt selbst bleibt offen - **und er ist in BitNode 6 nicht mehr zu
schliessen.** Gemessen 16:08: `chaosMax 34.52` nach 43 Minuten Laufzeit der
Marke. Das Chaos steigt in der eigenen Stadt nur durch `randomEvent`
(alle 240-600 s, davon 20 Prozent Riots, Stadt zufaellig aus sechs -
`Bladeburner.ts:107, 679-684`), also rund alle 35 Minuten um 5 bis 20
Prozent; von 34,5 auf ueber 50 waeren das mehrere Stunden. Der Knoten endet
vorher: Rang 400.234 um 16:10, Centurion laeuft, danach zwei Aktionen.

**Beim BitNode-Wechsel ist die Bladeburner-Division weg** (Prestige), und mit
ihr das Chaos-Konto. Der Nachweis muss deshalb in **BitNode 7** gefuehrt
werden - dem zweiten Kampfknoten der Route. `chaosMax` steht dafuer bereit
und braucht dort nur abgelesen zu werden.

Der Punkt wandert damit nach `## Offen`; er ist nicht erledigt, aber in
diesem Knoten nicht mehr bearbeitbar.

---

### Wartet bis V1-Knoten: Der Erfahrungsofen (Befund B1 aus dem Bot-Audit)

Der Umbau wurde am 25.08. per `git checkout` zurueckgenommen, weil die
Skeptiker-Runde vier Konstruktionsfehler fand: Das "Ventil" mass Fragmentierung
statt Bedarf, hebelte die Kaufbremse aus, vertrat den Stapelbetrieb gar nicht
und hatte eine katastrophale Kill-Granularitaet.

`src/worker/expfarm.js` liegt fertig und unverdrahtet im Baum (1,75 GB je Faden
statt 1,80 beim Einwegarbeiter). Was fehlt, ist die Zuteilung:
- Ofenbudget aus den Bedarfen DERSELBEN Runde ableiten, nicht aus der vorigen
- Raeumen nach dem share-Muster (bn4net.js:1565)
- Lease im Arbeiter gegen Waisen
- `ramJeSkript` um `worker/expfarm.js` ergaenzen
- danach den Einweg-Pfad (bn4net.js ~1596-1622) streichen

**Dringlichkeit:** niedrig in BitNode 6 - der Ofen beschleunigt den
Hacking-Weg, und der traegt diesen Knoten nicht. Vor dem naechsten V1-Knoten
wieder hochstufen.

### 3. Boersen-Bot fuer BitNode 8

BitNode 8 steht ganz am Ende der Route (Platz 42-44) und ist der einzige Knoten
ohne Bladeburner, Gang, Corporation und Skript-Hackgeld. Reputation ist dort
eine reine Geldfrage - und Geld kommt nur aus dem Aktienmarkt. Den Bot gibt es
noch nicht.

**Dringlichkeit:** niedrig, aber nicht null: Er ist die einzige Voraussetzung
auf der ganzen Route, die noch gar nicht existiert.

**Grundlage gelegt 29.08. um 01:50: `doku/formeln-boerse.md`.** Die Mechanik
ist jetzt aus `StockMarket/` gelesen statt vermutet. Die drei Zahlen, an denen
der Bot haengt:

- **Zyklus 7,5 Minuten** (`TicksPerCycle: 75` a 6 s). Jede Aktie kippt dabei
  mit 45 Prozent ihre Richtung. Ein Schaetzfenster laenger als ein Zyklus
  mittelt ueber den Wechsel und liefert systematisch 50 Prozent - also nichts.
- **Ohne 4S ist die Richtung kaum messbar.** `chc = (50 ± otlkMag)/100` mit
  otlkMag zwischen 1 und 10; der Standardfehler eines Anteils aus n Ticks ist
  `0,5/sqrt(n)`, ein Signal von 5 Punkten braucht also n = 100 Ticks = 10
  Minuten - laenger als der Zyklus. Die 4S-API (25 Mrd) ist damit kein Luxus,
  sondern der Unterschied zwischen Rechnen und Raten.
- **Provision 100.000 je Richtung**, unabhaengig von der Groesse. Bei einem
  Prozent erwartetem Gewinn deckt erst ein Einsatz von 20 Mio die Gebuehr.

**Nicht gekauft, nichts ausgegeben.** Der Zugang kostet 5 Mrd (TIX) plus 25 Mrd
(4S-API); der Spielstand hatte um 01:43 vier Mrd, und in diesem Knoten traegt
Geld den Fortschritt ohnehin nicht - der Traeger ist die Kampferfahrung. Ein
Kauf hier waere nur fuer einen Test, und beim Knotenwechsel ist er wieder weg.

**Nachgelegt 29.08. um 02:20 - und es kippt die Bauart des Bots.**
`PlayerInfluencing.ts` war als Randnotiz vermerkt und ist der Hauptweg:

- `ns.grow(host, {stock: true})` hebt das Forecast-ZIEL `otlkMagForecast` einer
  Aktie um 0,1, `ns.hack(..., {stock: true})` senkt es - mit einer
  Wahrscheinlichkeit gleich dem bewegten Anteil des Servergeldes.
- Der Forecast wandert je Tick auf dieses Ziel zu, mit bis zu **95 Prozent**
  Wahrscheinlichkeit (`getForecastIncreaseChance`, `Stock.ts:235-239`).
- Ein WSE-Konto wird dabei **nicht** geprueft, nur die `stock`-Option des
  Aufrufs (`validateHGWOptions`, `NetscriptFunctions.ts:411`).

**Der Bot muss den Forecast also nicht schaetzen, er setzt ihn.** Damit ist die
4S-API (25 Mrd) ein Komfortkauf statt eines Nadeloehrs - die Rechnung aus
`doku/formeln-boerse.md` Abschnitt 4 gilt nur noch fuer einen rein
beobachtenden Bot.

**Und fuer BitNode 8 geht es auf.** Dort ist `ScriptHackMoneyGain: 0` - Hacken
bringt dem Spieler nichts -, aber `ScriptHackMoney: 0.3` ist nicht null: Dem
Server wird weiterhin Geld entnommen, und genau diese Menge treibt die
Manipulation. Im einzigen Knoten ohne Einnahmequelle bleibt das Hacknetz die
Einnahmequelle, nur ueber den Umweg des Kurses.

Grenze: `stockMarketCycle` kippt alle 7,5 Minuten mit 45 Prozent auch das Ziel
(`flipForecastForecast`: `100 - otlkMagForecast`). Aufbau und Haltedauer
muessen in einen Zyklus passen.

**Beide offenen Fragen sind beantwortet (29.08., 08:50), aus dem Quellcode.**

**1. Der Darknet-Volatilitaetsmultiplikator ist gedeckelt bei 4.**
`DarkNet/effects/effects.ts:218-222`:

    mult(c) = 1 + (1 - e^(-0,001 c)) + 2 * (1 - e^(-0,00015 c))

mit c = `DarknetState.stockPromotions[symbol]`. Fuer c gegen unendlich laeuft
das gegen **4**, und die Haelfte des Wegs (Faktor 2,5) liegt bei rund 4.600
Ladungen. Er wirkt an **genau einer** Stelle: `StockMarket.ts:268`,
`const volatility = stock.mv * getDarknetVolatilityMult(stock.symbol)` - also
auf die **Preisbewegung**, nicht auf die Manipulation. Fuer den Bot heisst
das: mehr Amplitude je Tick, gleiche Steuerbarkeit. Nuetzlich, aber kein
Hebel, den man vor dem Bot bauen muesste.

**2. Limit-Orders koennen mehr - und sie sind in BitNode 8 gratis dabei.**
`NetscriptFunctions/StockMarket.ts:183` verlangt `checkSFAccess(ctx, 3)`, und
der Wachhund lautet (Zeile 47):

    if (Player.bitNodeN !== 8 && Player.activeSourceFileLvl(8) < sfLevel)

**Im Knoten selbst greift die Sperre nie.** In BitNode 8 stehen damit ohne
jedes Source-File offen: Shorts (Level 2, Zeilen 160/170) und Limit-/
Stop-Orders (Level 3, Zeilen 183/195/205). Der Bot darf also von Anfang an mit
dem vollen Werkzeugkasten rechnen - die bisherige Annahme, er muesse mit
Marktorders auskommen, war zu vorsichtig.

**3. Nebenbefund, der die Positionsgroesse begrenzt.** Der eigene Handel
schiebt den Forecast gegen einen: `StockMarketHelpers.ts:86` und `:106` rufen
`influenceForecastForecast(forecastChange * (stock.mv / 100))` - je Paket, das
eine Preisbewegung ausloest. Wer zu gross kauft, verdirbt sich das Ziel, das
er per `grow(host, {stock:true})` gerade aufgebaut hat. Die Positionsgroesse
gehoert also an `shareTxForMovement` gekoppelt, nicht ans verfuegbare Geld.

Damit ist die Vorarbeit fuer den Bot abgeschlossen; was fehlt, ist der Bot
selbst - und der wird erst in BitNode 8 gebraucht (Route Platz 42-44).


**Bestandsaufnahme und zwei Korrekturen (30.08., 00:55).**

**1. "Den Bot gibt es noch nicht" stimmt nur halb.** Im Baum liegen
`src/stocks.js` (208 Zeilen) und `src/stockaccess.js` (130 Zeilen). Der
vorhandene Bot ist aber ein **beobachtender**: Er entscheidet ueber
`ns.stock.getForecast`, und das wirft ohne 4S-Daten
(`NetscriptFunctions/StockMarket.ts:237-241`, `if (!Player.has4SDataTixApi)
throw`). In BitNode 8 ist er damit erst nach dem 25-Mrd-Kauf lauffaehig. Was
fehlt, ist der **manipulierende** Bot - und der braucht `getForecast` gar
nicht, weil er die Richtung selbst setzt.

**2. Die Zugangskosten sind falsch beziffert - in BitNode 8 ist der Handel
gratis.** Der Eintrag oben nennt "5 Mrd (TIX) plus 25 Mrd (4S-API)". Fuer
BitNode 8 gilt das nicht: `Prestige.ts:156-163` schenkt beides beim Betreten,

    if (Player.bitNodeN === 8) Player.money = BitNode8StartingMoney;   // 250 Mio
    if (canAccessBitNodeFeature(8)) {
      Player.hasWseAccount = true;
      Player.hasTixApiAccess = true;
    }

und `canAccessBitNodeFeature(8)` ist im Knoten selbst immer wahr
(`BitNode/BitNodeUtils.ts:17-19`). **Startkapital 250 Mio, TIX-API frei.**

**Das war die entscheidende Frage, und sie war offen.** In BitNode 8 stehen
saemtliche Geldquellen auf null (`BitNode.tsx:765-780`):

    CompanyWorkMoney 0   CrimeMoney 0        HacknetNodeMoney 0
    ManualHackMoney 0    ScriptHackMoneyGain 0   CodingContractMoney 0
    InfiltrationMoney 0  DarknetMoneyMultiplier 0

Waere die TIX-API zu kaufen, gaebe es keinen Weg, die 5 Mrd zu verdienen -
der Knoten waere verschlossen. Er ist es nicht, weil der Zugang zum Start
gehoert. `ScriptHackMoney: 0.3` bleibt dabei ungleich null: Dem Server wird
weiter Geld entnommen, was die Manipulation ueber `grow(host, {stock:true})`
antreibt, auch wenn der Spieler davon nichts bekommt.

**Damit steht die Bauart fest:** Startkapital 250 Mio, kein 4S, Richtung per
Hacknetz gesetzt, Positionsgroesse an `shareTxForMovement` gekoppelt
(Nebenbefund 3 oben), Shorts und Limit-Orders frei
(`checkSFAccess` greift in BN8 nie). Von `stocks.js` wiederverwendbar sind
Kauf-, Verkaufs- und Positionslogik; die Entscheidungsregel ueber
`getForecast` muss durch die eigene Manipulationsabsicht ersetzt werden.

### Wartet bis BitNode 15: Darknet-Labyrinth-Gewerk (V1b)

`labyrinth.ts:424-427` legt The Red Pill ins sechste Darknet-Labor, aber nur bei
`hasFullDarknetAccess()` - also in BitNode 15 oder mit SF15. Jeder
Augmentierungs-Einbau wuerfelt das Darknet neu (Prestige.ts:76), es braucht also
je Labor einen Einbauzyklus und rund 24 Raetselloeser.

**Dringlichkeit:** niedrig. Erst vor BitNode 15 relevant.

---

### Source-File -1: die letzten vier Exploits (Stand 29.08., 02:45 - 7 von 11)

Eingesammelt: `UndocumentedFunctionCall`, `INeedARainbow`, `Bypass`
(`src/exploit.js`), `TimeCompression` (`src/exploit2.js`), `TrueRecursion`
und `N00dles` (`src/exploit3.js`). `PrototypeTampering` haengt am
15-Minuten-Zeitgeber und sollte kurz nach 07:57 fallen - nachsehen mit
`node tools/lage.js | grep Exploits`.

**Der Ertrag ist bewusst klein**: `applyExploits.ts` multipliziert alle
Multiplikatoren mit `1,001^n`. Von 7 auf 11 sind das 1,007 auf 1,011, also
**+0,4 %**. Dafuer permanent und ueber jeden Reset hinweg - bei 45 geplanten
Laeufen ist das kein Nichts, aber es hat keine Dringlichkeit.

**Nachgemessen 29.08. um 02:44** (`node tools/lage.js | grep Exploits`):
`PrototypeTampering` **ist da** - der Zeitgeber ist wie erwartet gefallen. Die
Liste steht jetzt bei sieben:

    UndocumentedFunctionCall, INeedARainbow, Bypass, TimeCompression,
    TrueRecursion, N00dles, PrototypeTampering

Damit ist alles eingesammelt, was ein Skript allein erreichen kann. Die
verbleibenden vier brauchen etwas, das kein Loop hat: zwei einen echten
Mausklick beziehungsweise den Debugger ueber die Opera-Verbindung
(`Unclickable`, `RealityAlteration`), einer ist im ausgelieferten Spiel gar
nicht erreichbar (`YoureNotMeantToAccessThis`), und `EditSaveFile` verlangt,
den Spielstand zu exportieren, zu veraendern und zurueckzuspielen.

**`EditSaveFile` wird nachts nicht angefasst.** Der Ertrag ist 0,1 Prozent auf
alle Multiplikatoren; der Einsatz ist ein Import ueber einen laufenden Bot,
der jeden Fortschritt seit dem Export verwirft. Das gehoert in einen Moment
mit Aufsicht, nicht in einen unbeaufsichtigten Nachtlauf - so steht es auch
schon im Absatz darueber ("nur mit Sicherung und nicht im laufenden Betrieb").

**1. `YoureNotMeantToAccessThis` - im ausgelieferten Spiel NICHT erreichbar.**
`ns.openDevMenu()` oeffnet nur den April-Scherz (`Extra.ts:19` zeigt auf
`Apr1Events`, `ui/Apr1.tsx:41`). Den Exploit vergibt `DevMenuRoot`
(`DevMenu.tsx:41-43`), und dorthin fuehrt einzig der Sidebar-Eintrag unter
`process.env.NODE_ENV === "development"` (`SidebarRoot.tsx:436`). Ohne
Zugriff auf das `Router`-Modul aus der Seite heraus gibt es keinen Weg.
**Nur ueber React-Interna (Fiber-Baum nach dem Router absuchen) - fragil,
lohnt fuer 0,1 Prozent nicht.**

**2. `Unclickable` - loesbar, braucht aber einen ECHTEN Mausklick.**
`Exploits/Unclickable.tsx:11` prueft `event.isTrusted`, und
`element.click()` aus einem Skript ist unwahr. Der Rest ist geloest:

    const getComputedStyle = window.getComputedStyle;   // Zeile 5, beim Laden
                                                        // des Moduls gefangen

Ein spaeteres Ueberschreiben von `window.getComputedStyle` greift also nicht.
**Aber die zurueckgegebene `CSSStyleDeclaration` gehorcht ihrem Prototyp** -
werden dort die Lesefunktionen fuer `display` und `visibility` auf "none"
und "hidden" festgenagelt, darf das Element in Wahrheit sichtbar und
anklickbar sein. Also: Prototyp verbiegen, `#unclickable` per Inline-Stil
gross und sichtbar machen, klicken lassen, alles zuruecksetzen.

Der Klick selbst geht entweder per CDP (`Input.dispatchMouseEvent` erzeugt
vertrauenswuerdige Ereignisse) ueber die Opera-Verbindung - oder Eric klickt
einmal hin. **Vorsicht:** `<Unclickable/>` haengt in `GameRoot`
(`ui/GameRoot.tsx:558`) und wird oft neu gezeichnet; React setzt den
Inline-Stil dann zurueck. Der Stil muss also kurz vor dem Klick gesetzt
werden.

**3. `RealityAlteration` - braucht den Debugger, nichts anderes.**

    let x = false;
    const recur = function (depth) { if (depth === 0) return; x = !x; recur(depth - 1); };
    recur(2);                          // zwei Umschaltungen -> x bleibt false
    if (x) giveExploit(RealityAlteration);

`x` ist eine Abschlussvariable, `recur` ruft sich ueber den eigenen Namen
auf, und `depth === 0` wie `depth - 1` sind strikte Operationen auf
Zahl-Primitiven - an keiner Stelle greift ein Prototyp. Der Kommentar der
Entwickler sagt es selbst: "a variable that is guaranteed to be false **(and
doesn't use prototypes)**". Der Weg ist ein Haltepunkt in `alterReality` und
`Debugger.setVariableValue` - per CDP machbar, von einem Skript aus nicht.

**4. `EditSaveFile` - kein Ausloeser im Spiel, nur der Spielstand selbst.**
Ausser der Achievement-Pruefung kommt der Name nirgends vor. Er entsteht
allein dadurch, dass `"EditSaveFile"` in der Exploit-Liste des Standes steht.
Also: exportieren, entpacken, Eintrag setzen, packen, importieren. **Nur mit
Sicherung und nicht im laufenden Betrieb** - eine Sicherung liegt seit 07:37
unter `backups/` (nicht im Repo, siehe `.gitignore`).

**Entschieden 29.08., 09:45: alle vier bleiben liegen, drei davon endgueltig.**

Die Frage war, ob ein Loop wenigstens `EditSaveFile` allein schafft. Antwort:
nein - und der Beleg ist knapp. `RemoteFileAPI/MessageHandlers.ts` hat elf
Handler, darunter `getSaveFile` (Zeile 226), aber **kein Gegenstueck zum
Schreiben**. Der Spielstand ist ueber die Bruecke lesbar und nicht
schreibbar. Opera antwortet nicht auf Port 9222 (geprueft 09:43, HTTP 000),
also faellt auch der CDP-Weg weg - und mit ihm `Unclickable` und
`RealityAlteration`.

Bleibt ein dritter Weg, den ein Skript IM Spiel haette: IndexedDB direkt
schreiben und die Seite neu laden. **Wird nicht gemacht.** Der Ertrag ist
0,1 Prozent auf die Multiplikatoren; der Einsatz ist der laufende Spielstand
mit 237.533 Erfahrung, 85 Servern und dem halben Weg zum Divisionsbeitritt.
Ein Schreibfehler an dieser Stelle kostet den ganzen Lauf. Das Verhaeltnis
stimmt nicht, und zwar nicht knapp.

**Der richtige Moment dafuer ist ein Reset, der ohnehin kommt.** Beim
naechsten BitNode-Wechsel steht der Stand ohnehin auf Anfang - dann kostet
ein misslungener Versuch nichts. Bis dahin ruht der Punkt; er steht nicht
unter "Wartet bis Eric", weil hier nichts zu entscheiden ist, sondern eine
Gelegenheit abzuwarten.

**Dringlichkeit: niedrig.** Nichts davon bewegt den Knotenausgang. Der Punkt
steht hier, damit die Arbeit von heute frueh nicht verlorengeht.

## Erledigt

Ausgelagert nach [`nodes/ERLEDIGT.md`](ERLEDIGT.md) - dort steht das Archiv
mit allen Nachmessungen, neueste zuerst.

**Ein abgeraeumter Punkt wandert dorthin, nicht hierher.** Oben in die Datei,
mit Datum und der Zeile `Verifiziert: <Zahl> um <HH:MM>`.

**Vor dem Anlegen eines neuen Punktes dort nachsehen** - aber gezielt, nicht
durch Volllesung:

```bash
grep -n -A12 "<stichwort>" nodes/ERLEDIGT.md
```
