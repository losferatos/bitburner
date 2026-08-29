# Hebel — das Optimierungsprotokoll

**Diese Datei ist die Verlustfunktion des Optimierungs-Loops.** Ohne sie wäre er
ein Bastler: Er würde alle drei Stunden etwas ändern, und niemand wüsste
hinterher, welche Änderung getragen hat und welche geschadet.

Jeder Eintrag braucht drei Zahlen — vorher, nachher, und wie lange dazwischen
gemessen wurde. Ein Eintrag ohne Nachher-Messung ist kein Ergebnis, sondern eine
offene Wette.

## Der Trupp wurde rekrutiert, aber nie eingesetzt (29.08.2026, 18:50)

**Befund.** `blade.js` fuellt den Trupp auf `TRUPP_ZIEL = 6` auf
(`src/blade.js:2097-2104`) und rechnet den Truppbonus in die Erfolgschance
ein (`src/blade.js:1776`). Aufgerufen wurde `setTeamSize` aber **nie** - an
keiner Stelle der Datei. Damit blieb `action.teamCount` auf seinem Startwert
0 (`Actions/Operation.ts:23`), und `getTeamSize(typ, name)` gab konsequent 0
zurueck.

Die Chancenrechnung war dadurch nicht falsch - sie spiegelte die Realitaet
korrekt mit `1^0,05 = 1`. Falsch war die **Realitaet**: Jede Rekrutierung
kostete 284 s Spielerzeit (`data/GeneralActions.ts:24-27`, Charisma 1) fuer
einen Bonus, der nie zur Anwendung kam.

**Was der Bonus wert ist.** `(teamCount+1)^0,05`
(`Actions/Operation.ts:96-98`), angewendet als `competence *=
getTeamSuccessBonus` (`Actions/Action.ts:178`). Bei sechs Mann sind das
`7^0,05 = 1,1006`, also **+10,1 Prozent competence**. Kontrakte und General
Actions bekommen ihn nicht - `getTeamSize` gibt fuer beide hart 0 zurueck
(`NetscriptFunctions/Bladeburner.ts:262-265`).

**Warum nur Black Ops, nicht Operationen.** Truppmitglieder sterben:
`0..ceil(n/2)` bei Erfolg, `0..n` bei Fehlschlag
(`Actions/TeamCasualties.ts:36-38`), bei sechs Mann also im Mittel rund 1,5
je Operation. Ersatz kostet 284 s Recruitment je Mann - bei der Rangrate
kurz nach dem Beitritt rund 3,8 Rang je Mann, gegen +10 Prozent auf eine
einzelne Operation, die selbst nur wenige Rang bringt. Operationen laufen
laufend, Black Ops einmal: Dort ist die Chance der Engpass (Typhoon steht
bei 0,0194), sie tragen den Knotenausgang, und die Feuerschwelle 0,35 wird
mit +10 Prozent frueher erreicht.

**Eingebaut** vor `startAction` (`src/blade.js:3104-3125`): bei `wahl.typ === B`
wird `setTeamSize(B, name, getTeamSize())` gesetzt, sonst nichts. Wirkung
messbar erst ab Rang 2500 (erste Black Op) - bis dahin ist die Aenderung
folgenlos, aber die Rekrutierungszeit ist ab jetzt keine verlorene Zeit mehr.

## Regeln

- **Eine Änderung je Lauf.** Zwei gleichzeitig sind nicht mehr auseinanderzuhalten.
- **Vorher messen, ändern, nachher messen.** Mindestens 20 Minuten Abstand,
  sonst misst man Rauschen.
- **Wird die Zahl schlechter, wird zurückgenommen** — `git revert`, und der
  Eintrag bleibt trotzdem stehen. Eine widerlegte Hypothese ist wertvoll: Sie
  verhindert, dass jemand dieselbe in zwei Wochen noch einmal probiert.
- **Kein Hebel ohne Zahl.** „Fühlt sich besser an" ist kein Ergebnis.

## Was ein guter Hebel ist

Der Engpass, nicht das Naheliegende. In BitNode 6 hängt alles am
Bladeburner-Rang; eine Verbesserung der Hackrate ist dort messbar richtig und
strategisch wertlos. Die Frage lautet immer: **Welche Zahl bringt den Knoten
näher an seinen Ausgang, und was begrenzt sie gerade?**

Quellen, in dieser Reihenfolge:
1. `data/*.json` über die Brücke — was der Bot tatsächlich tut
2. `doku/formeln-*.md` — was daran schon verstanden ist
3. `reference/bitburner-src/` — der Spielquellcode selbst, wenn die Doku
   schweigt oder veraltet ist

---

## Protokoll

*Neueste zuoberst.*

### Chaos-Zuschlag gilt erst nahe der Schwelle - Raid war ausgeschaltet (29.08., 16:50)

Engpass:   Ab 18:04 der Rang. `blade.js:2246` schlug bei chaoserzeugenden
           Aktionen **unbedingt** Diplomacy-Zeit auf die Dauer auf. Mit
           charisma 1 (gemessen 16:15) sind das 3 Laeufe zu 60 s = **180 s**
           je Raid.

Hypothese: Raid steigt von 0,0118 auf **0,0437 Rang/s** - Faktor 3,7 - und
           wird damit zur besten Aktion des Knotens statt zur schlechtesten.

Beleg:     Drei Fundstellen, alle drei sprechen dagegen, den Zuschlag bei
           niedrigem Chaos zu rechnen:

             - Chaos schadet erst **ueber 50**. `getChaosSuccessFactor`
               (`Actions/Action.ts:94-103`) gibt darunter glatt 1 zurueck;
               `ChaosThreshold: 50` in `data/Constants.ts:31`.
             - Raid erhoeht Chaos **prozentual** (+1 bis 5 %,
               `Bladeburner.ts:844`, `City.ts:31-33`). Von einem niedrigen
               Stand aus ist das absolut fast nichts - von **null** aus, wie
               nach dem Knotenwechsel, ist es exakt null.
             - Passiv faellt Chaos um 0,0001 je Sekunde
               (`Bladeburner.ts:1397`), also 0,36 je Stunde.

           Rang je Sekunde mit den Werten von 16:15, Raid: rankGain 55,
           chance 5,3 %, Dauer nackt 66,8 s -> **0,0437**. Mit 180 s Zuschlag
           246,8 s -> **0,0118**, also unter Tracking (0,0135).

**Der Zuschlag selbst war richtig, nur seine Unbedingtheit nicht.** Der
Grenzzyklus, gegen den er am 28.08. eingebaut wurde, war echt - aber er
entstand bei Chaos um 38, nicht bei 0. Er bleibt deshalb erhalten und
verblasst linear: voll ab 50, null bei 40 und darunter
(`CHAOS_ZUSCHLAG_AB = 40`). Das ist bewusst **keine** Ruecknahme der
Entscheidung von gestern, sondern ihre Begrenzung auf den Bereich, fuer den
sie hergeleitet wurde.

Vorher:    Raid 0,0118 Rang/s (rechnerisch, Chaos noch nicht messbar).
Nachher:   (offen - misst der naechste Lauf nach 18:04 an `data/blade.json`:
           taucht Raid in der Aktionsverteilung auf?)
Umsetzung: `src/blade.js`, `getCityChaos`-Abfrage plus lineare Verblassung.
           `node --check` sauber, Pruefer SPUR. **Im Spiel und neu gestartet,
           verifiziert 16:44:01** - alte Instanz beendet, neue **pid 239674
           auf werk-0**, Motor-Log bestaetigt.

### Sleeve probiert alle drei Kontraktarten statt einer (29.08., 16:25)

Engpass:   Ab 18:04 der Rang. `sleeve.js` setzte den Sleeve auf
           `KONTRAKTE[i % 3]` - bei **einem** Sleeve also immer nur
           `Tracking`. Ist der ausverkauft, gab `setToBladeburnerAction`
           false zurueck und der Sleeve fiel in den Gym-Zweig. Das Gym bringt
           nach dem Beitritt **null Rang**.

Hypothese: Ausverkauft ist der Regelfall. Nachschub 30 Stueck je Stunde und
           Art (`Bladeburner.ts:1387`, `Constants.ts:39`), Verbrauch von
           Spieler und Sleeve zusammen rund 400. Mit Rueckfallkette faellt der
           Sleeve statt auf 0 auf **0,0108 Rang/s** (Retirement) bzw. 0,0104
           (BountyHunter) zurueck.

Beleg:     Alle neun Aktionen mit den echten Spielerwerten von 16:15
           durchgerechnet (`Action.ts:169-196`, Gewichte und Zerfaelle aus
           `data/Contracts.ts` und `data/Operations.ts`). Skills gemessen:
           str/def/dex/agi 97, hacking 163, **charisma 1**, **intelligence 94**.

               KON  Tracking            diff  125  chance 47,1 %  0,01353 Rang/s
               KON  Retirement          diff  200  chance 30,1 %  0,01081
               KON  BountyHunter        diff  250  chance 24,1 %  0,01038
               OP   Raid                diff  800  chance  5,3 %  0,04372
               OP   StealthRetirement   diff 1000  chance  4,3 %  0,01119
               OP   Undercover          diff  500  chance 10,2 %  0,01073
               OP   Assassination       diff 1500  chance  2,6 %  0,00907
               OP   Investigation       diff  400  chance 13,0 %  0,00858
               OP   Sting               diff  650  chance  6,9 %  0,00699

**Damit ist mein eigener Eintrag von 16:00 zu korrigieren.** Dort stand, der
Ausweichpfad auf Operationen sei unproblematisch, weil sie "das 7- bis
180-fache je Aktion" bringen. Je **Aktion** stimmt das, je **Sekunde** nicht:
Die Erfolgschance faellt mit der Schwierigkeit, und die Dauer steigt mit ihr.
**Tracking schlaegt jede Operation ausser Raid.** Der Kontrakttopf ist also
kein Randthema, sondern die Hauptquelle - und Raid der einzige echte Sprung
(0,0437 Rang/s, dreimal Tracking, wegen rankGain 55 trotz 5,3 Prozent).

           Zwei Groessen sind Annahmen und gehoeren nach dem Beitritt geprueft:
           `skillFac` = 1 (noch keine Bladeburner-Faehigkeiten gekauft) und
           `popFac` = 1 (Bevoelkerung genau auf der Schwelle 1e9). Beide
           verschieben alle Zeilen gleichsinnig, die **Reihenfolge** aendern
           sie nicht.

Vorher:    Sleeve faellt bei ausverkauftem Tracking auf 0 Rang/s (Gym).
Nachher:   (offen - misst der naechste Lauf nach 18:04)
Umsetzung: `src/sleeve.js:121-145`, Schleife ueber `KONTRAKTE` mit Versatz `i`,
           damit zwei Sleeves nicht kollidieren (`Sleeve.ts:282-292` verbietet
           dieselbe Art). `node --check` sauber, Pruefer SPUR.
           **Im Spiel angekommen und neu gestartet, verifiziert 16:17:**
           alte Instanz (pid 161300, alter Code) per `WERKZEUG` beendet, neue
           **pid 223447 auf werk-0**, Motor-Log: "sleeve.js laeuft auf werk-0".
           Der Nachstart hat diesmal also funktioniert - der Ausfall von 12:53
           bleibt ein Einzelfall, den die neue Diagnosezeile beim naechsten Mal
           aufklaert.

### Sleeve-Kontraktwahl gegengerechnet - Tracking ist belegt richtig (29.08., 16:00)

Engpass:   Ab dem Beitritt (18:04) der Bladeburner-Rang. Offen war, ob der
           Sleeve die richtige Kontraktart faehrt - `sleeve.js:83` setzt ihn
           auf `Tracking`, den Kontrakt mit dem **niedrigsten** Rangertrag.

Hypothese: Bounty Hunter (rankGain 0,9) bringt mehr als Tracking (0,3).
           **Widerlegt.**

Beleg:     `Bladeburner/data/Contracts.ts` und `Operations.ts`, dazu
           `Action.ts:195` (Chance = `min(1, competence/difficulty)`) und
           `Action.ts:108` (Dauer proportional zu `difficulty/10`).

               Kontrakt        rankGain  difficulty  Chance*  Rang/Aktion  Rang/s
               Tracking            0,30         125    0,310        0,093  0,0088
               Retirement          0,60         200    0,194        0,116  0,0068
               Bounty Hunter       0,90         250    0,155        0,140  0,0066
                                                   * mit Sleeve-Stats um 72

           Der hoehere Ertrag wird von zwei Seiten aufgefressen: Die Chance
           faellt linear mit der Schwierigkeit, **und** die Aktion dauert
           laenger. Tracking bleibt um ein Drittel besser. Ein Fehlschlag ist
           dabei gratis - Kontrakte haben keinen `rankLoss`.

**Mitgenommen, und wichtiger als die Rechnung: Der Sleeve kann keine
Operationen.** `PersonObjects/Sleeve/Sleeve.ts:488-540` und
`Bladeburner/Enums.ts:17-21` lassen genau drei Sonderfaelle zu - `Infiltrate
Synthoids`, `Support main sleeve`, `Take on contracts` - plus die sechs
General Actions. Operationen sind **dem Spieler vorbehalten**.

Damit ist die Arbeitsteilung ab 18:04 vorgezeichnet und der Vorratskonflikt
aus `nodes/BAUSTELLEN.md` (15:45) entschaerft: Frisst der Sleeve die Kontrakte
leer, weicht der Spieler auf Operationen aus - und die bringen je Aktion das
**7- bis 180-fache** (Investigation 2,2 bis Raid 55 gegen Tracking 0,3).
Gegengeprueft: Operationen haben **keinen `reqdRank`** (nur Black Ops haben
einen, `BlackOperation.ts:47`), stehen also ab Rang 0 offen. Der befuerchtete
Durchfall auf Training oder Diplomacy setzt damit erst ein, wenn **beide**
Toepfe leer sind.

Vorher:    Sleeve auf `Tracking` (Stand 13:00).
Nachher:   unveraendert - **keine Aenderung, die Wahl war schon richtig.**
Commit:    nur dieser Eintrag.

### Der Sleeve faehrt ab dem Beitritt Kontrakte statt Gym (29.08., 13:00)

Engpass:    Der Spieler arbeitet nach dem Beitritt nur **18 Prozent** der
            Zeit (Eintrag 10:00). Der Sleeve stand bisher im Gym - nach Tor 1
            ist Kampferfahrung aber nicht mehr die Leitgroesse.

Hypothese:  Ein Sleeve auf Kontrakten bringt **25,2 Rang je Stunde** gegen
            6,6 des Spielers - Faktor 3,8. Der Gesamtzuwachs steigt damit von
            6,6 auf 31,8 je Stunde, also um **+382 Prozent**.

Beleg:      `SleeveBladeburnerWork.ts:54` ruft
            `completeAction(sleeve, actionId, false)`; `Bladeburner.ts:948-950`
            vergibt `changeRank(person, gain)`, und `changeRank` (`:1265-1292`)
            erhoeht `this.rank` - den Spieler-Rang. Der Ausdauerabzug steht
            hinter `if (isPlayer)` (`:921`), der Sleeve verbraucht also keine.
            Vertraege haben **keinen `rankLoss`** (`data/Contracts.ts`, kein
            Treffer) - ein Fehlschlag kostet nichts ausser Zeit.

Gerechnet mit den Werten von 12:50 (Sleeve 72/72/69/71, Spieler 91/91/91/90),
Tracking Stufe 1, `getSuccessChance` mit den Gewichten aus
`data/Contracts.ts:21-38` und `calculateIntelligenceBonus(int, 0,75)`:

    Spieler   Kompetenz 55,61   Chance 0,445   Dauer 10,5 s   Anteil  18 %
    Sleeve    Kompetenz 38,70   Chance 0,310   Dauer 10,6 s   Anteil 100 %

Die niedrigere Chance des Sleeves faellt kaum ins Gewicht, weil sein
Arbeitsanteil fuenfeinhalb Mal so hoch ist. Gedaempft wird beides von
`calculateStaminaPenalty()` (`:167-169`): Sie haengt an der SPIELER-Ausdauer
und senkt auch die Sleeve-Chance, solange diese unter der Haelfte steht - ein
weiterer Grund, warum Cyber's Edge in dieser Phase wichtig ist.

Umgesetzt in `src/sleeve.js`: Ist `inBladeburner` true, wird
`setToBladeburnerAction(i, "Take on contracts", KONTRAKTE[i % 3])` versucht;
schlaegt das fehl, bleibt es beim Gym. Je Sleeve ein eigener Kontrakt, weil
zwei denselben nicht fahren duerfen (`NetscriptFunctions/Sleeve.ts:283-293`).
Der Sleeve steht also nie still.

Vorher:     Sleeve im Gym, Rangbeitrag 0. Tiefstand 91 um 12:51,
            `inBladeburner` noch false.
Nachher:    (offen - misst der erste Lauf nach dem Beitritt, ETA 18:15).
            Pruefung: `data/sleeve.json` muss `contract:Tracking` zeigen, und
            die Rangrate der ersten Stunde gegen die 6,6 des Spielers allein.
Commit:     siehe unten.

*Warum trotz der eigenen Regel "vor dem Beitritt nichts am Motor aendern":
Die Aenderung greift erst, wenn `inBladeburner` true ist, und faellt sonst
auf das bisherige Verhalten zurueck. Sie kann den Trainingsbetrieb also nicht
stoeren - und haette man sie erst danach eingebaut, waeren die ersten Stunden
der Rangphase mit einem Viertel der moeglichen Rate gelaufen.*

### Kein Hebel, aber die wichtigste Zahl fuer die naechste Phase (29.08., 10:00)

Engpass:    Noch der Kampfwert-Tiefstand (82 von 100 um 09:51), aber der
            faellt in rund 8 Stunden weg. Dieser Lauf hat deshalb nach vorn
            geschaut: auf die 89-185 Stunden, die danach kommen.

**Geprueft und weiterhin verworfen: Overclock in der Fruehphase.** Die
Ablehnung von 26.08. beruhte auf gemessenen Werten aus dem BitNode-6-
Spaetspiel (Verbrauch 2,7 gegen Regeneration 1,2 je Minute). Ob sie bei Rang
0 und frisch 100er Kampfwerten auch gilt, war offen. Sie gilt - und deutlich:

    maxStamina        agi^0,8 = 100^0,8            = 39,8
    Regeneration      (0,0085 + 39,8/70000) * 100^0,17 * 60
                                                   = **1,19 je Minute**
    Aktionsdauer      (125/10) / statFac 1,1986    = 10,4 s   (Tracking Lvl 1)
    Verlust je Aktion 0,285 * (125^0,28 + 125/650) = 1,156
    Verbrauch         1,156 * 60/10,4              = **6,65 je Minute**

**Der Arbeitsanteil ist damit R/V = 1,19/6,65 = 18 Prozent.** Overclock
verkuerzt die Aktion und hebt den Verbrauch im gleichen Verhaeltnis - bei
Stufe 30 auf 9,50/min, bei Stufe 90 auf 66,5/min. Es macht den Engpass
schlimmer, nicht besser. Die Ablehnung von 26.08. gilt also von Rang 0 bis
zum Knotenende.

**Die Zahl selbst ist der Ertrag dieses Laufs.** In BitNode 6 lag der
Arbeitsanteil bei rund 50 Prozent (gemessen 26.08., "rund die Haelfte der
Zeit in der Regenerationskammer"). Nach dem Beitritt in BitNode 10 sind es
**18 Prozent** - der Motor wird vier Fuenftel der Zeit ruhen. Grund ist nicht
der Knoten, sondern der Neuanfang: Ausdauer haengt an `agi^0,8`, und agi
steht bei 100 statt bei mehreren hundert.

Zwei Folgerungen, beide ohne Codeaenderung:

1. **Cyber's Edge ist in der Fruehphase die mit Abstand wichtigste
   Faehigkeit.** Ihr Nutzen ist mit `(1 - ausdauerLuft())` gewichtet
   (`blade.js:831`), und die Luft ist bei 18 Prozent Arbeitsanteil nahe null.
   Die Sortierung erkennt das von selbst - hier ist nichts zu tun ausser
   nachzusehen, ob sie es dann auch tut.
2. **Die ETA-Spanne 89-185 h im Kurs stammt aus BitNode-6-Raten und ist
   damit optimistisch.** Sie gehoert ersetzt, sobald die erste echte Rangrate
   nach dem Beitritt vorliegt - das steht dort schon als naechste Pruefung.

Hypothese:  keine - kein Hebel gefunden, der Plan macht bereits das Richtige.
Beleg:      `Bladeburner.ts:1317-1343` (Ausdauerformeln), `:921` (Verlust je
            Aktion), `Actions/Action.ts:104-121` (Dauer), `data/Constants.ts`
            (BaseStaminaLoss 0,285, StaminaGainPerSecond 0,0085),
            `data/Contracts.ts:16` (Tracking baseDifficulty 125).
Vorher:     Tiefstand 82 um 09:51.
Nachher:    entfaellt, keine Aenderung.
Commit:     nur dieser Protokolleintrag.

*Korrektur an mir selbst: Der Lauf startete mit der Vermutung, Overclock
stehe gar nicht im `SKILL_PLAN`. Es steht dort, ganz am Ende mit Deckel 90 -
ich hatte die Liste abgeschnitten gelesen. Die Vermutung war falsch, die
Rechnung daraus trotzdem nuetzlich.*

### Kein Hebel, sechster Winkel: der Sleeve (29.08., 06:55)

Engpass:    Unveraendert der Kampfwert-Tiefstand, 63 von 100 um 06:51. In
            Erfahrung 19.241 von 223.671 je Wert. Rate geglaettet ueber 47
            Minuten: 301 Erfahrung/min je Wert, ETA rund 11 h.

Diesmal nicht am Gym des Spielers gesucht (das ist seit dem 01:00-Lauf
erschoepft), sondern am zweiten Traeger: dem Sleeve. Drei Kandidaten, alle
aus dem Quellcode gerechnet, alle verworfen.

**1. Zusaetzliche Sleeves kaufen.** BitNode 10 ist der einzige Knoten, in dem
das geht (`Faction/ui/CovenantCampaign.tsx:48`). Preis:
`Math.pow(10, gekaufte) * 10e12` (`SleeveCovenantPurchases.tsx:13-27`), also
**10 Billionen Dollar** fuer den ersten - bei aktuell 4,2 Milliarden. Dazu
Mitgliedschaft in The Covenant. Ausser Reichweite, und zwar um drei
Groessenordnungen.

**2. Shock des Sleeves senken.** Der Sleeve-Ertrag wird mit
`(100 - shock)/100` skaliert (`Sleeve.ts:173`), und BitNode 10 setzt beim
Prestige `shock <= 25`. Gemessen aus dem Spielstand um 06:53: **shock = 0**.
Es gibt nichts zu holen, der Sleeve arbeitet bereits ungedaempft.

**3. Sync des Sleeves heben - der einzige, der wehtut.** Der Spieler
bekommt `sync/100` der Sleeve-Erfahrung (`Sleeve/Work/Work.ts:20-22`).
Gemessen: **sync = 25**, also drei Viertel des Sleeve-Ertrags verfallen.
Sync 100 wuerde den Sleeve-Beitrag vervierfachen - aus 3,25 Erfahrung/s
wuerden 13, die Gesamtrate stiege von 13,25 auf 26/s, also **+96 Prozent**.

Der Preis macht es kaputt. `SleeveSynchroWork.process` hebt sync um
`0,0002 * calculateIntelligenceBonus(int, 0.5)` je Cycle, bei 5 Cycles je
Sekunde (`Work/Formulas.ts:38`) und Intelligenz 94 (Bonus 1,0316):

    0,0002 * 1,0316 * 5 = 0,0010316 sync/s
    75 Punkte / 0,0010316 = 72.703 s = **20,2 Stunden**

Waehrend dieser 20,2 Stunden trainiert der Sleeve nicht. Verlust:
3,25/s * 72.703 s = **236.285 Erfahrung** - mehr als der ganze Restweg von
204.430. Selbst wenn man nur bis sync 50 ginge (6,7 h, Verlust 78.500),
brachte die Restzeit danach keinen Ausgleich mehr: Der Gewinn von +3,25/s
holt 78.500 Erfahrung erst in 6,7 weiteren Stunden ein, und so lange dauert
Tor 1 nach der Investition nicht mehr.

Und nach dem Tor traegt es nichts: Dann ist die Leitgroesse der
Bladeburner-Rang, und `sync` beruehrt die Bladeburner-Arbeit des Sleeves
nicht (`SleeveBladeburnerWork.ts:55` skaliert nur mit shock).

Hypothese:  keine - alle drei Kandidaten sind vor der Umsetzung gefallen.
Beleg:      `SleeveCovenantPurchases.tsx:13-27`, `Sleeve.ts:173-179`,
            `Sleeve/Work/Work.ts:20-22`, `SleeveSynchroWork.ts:14-18`,
            `PersonObjects/formulas/intelligence.ts`, `Work/Formulas.ts:38`.
Vorher:     Tiefstand 63 um 06:51, Rate 301/min je Wert.
Nachher:    entfaellt, keine Aenderung.
Commit:     nur dieser Protokolleintrag.

**Nebenbefund fuer spaeter:** sync bleibt der groesste ungenutzte Faktor am
Sleeve (Faktor 4 auf seinen Beitrag). Er lohnt in einem Knoten, dessen
Leitgroesse ueber viele Tage an Erfahrung haengt - nicht in diesem, wo Tor 1
in 11 Stunden faellt und danach der Rang zaehlt. Wer in einem V1-Knoten
landet, rechnet ihn neu.

### Eine eigene Empfehlung widerlegt, bevor sie umgesetzt wurde (29.08., 03:55)

Engpass:    Unveraendert der Kampfwert-Tiefstand (87 von 100 um 03:39). Der
            Knoten selbst gibt in dieser Phase keinen Hebel her - das haben die
            Laeufe von 22:05 und 01:00 aus zwei Richtungen gezeigt. Also nach
            vorn geschaut: auf `blade.js`, das in rund vier Stunden den Knoten
            uebernimmt.

Der Vorankommenslauf hat um 03:45 einen richtigen Befund eingetragen: In
BitNode 10 wird der Rang**gewinn** mit `BladeburnerRank: 0.8` multipliziert
(`Bladeburner/Formulas.ts:8-26`), der Rang**verlust** nicht, und `reqdRank`
ist ohnehin fest. Netto sind 309.072 Rang zu erarbeiten statt 286.340 in
BitNode 6 - 25 Prozent mehr Zeit. Das steht.

**Die daraus abgeleitete Empfehlung war falsch.** Sie wollte die Feuerschwelle
fuer Black Ops ueber den Erwartungswert neu setzen:

    p * G * 0,8 - (1-p) * L   ->   Break-even  p = L / (L + 0,8 G)

und kam damit bei Vindictus auf 0,556 - also weit ueber die geltenden 0,35.
Wer das umsetzt, dreht den groessten Hebel des Vortags zurueck.

Beleg:      `changeRank` vergibt Skillpunkte gegen `maxRank`, und `maxRank`
            faellt nie (`Bladeburner.ts:1273,1283-1291`). **Ein Fehlschlag
            kostet keinen Skillpunkt**, er verzoegert nur die
            `reqdRank`-Freigabe. Rangverlust ist damit kein Verlust, sondern
            Zeit, und die richtige Rechnung lautet

                Kosten eines Fehlschlags = T_op + L / (m * Rangrate)

            In BitNode 10 wird dieser Posten mit m = 0,8 um ein Viertel
            teurer: bei Daedalus von 5,4 auf 6,8 Minuten. Dem stehen die 78 bis
            86 Minuten gegenueber, die Warten am 28.08. gekostet haette. **1,4
            Minuten gegen achtzig - die 0,35 bleiben richtig.**

Vorher:     Schwelle 0,35 (seit 28.08., 16:00).
Nachher:    Schwelle 0,35 - unveraendert, jetzt aber auch fuer BitNode 10
            geprueft statt uebernommen.

**Warum das hier steht, obwohl nichts geaendert wurde:** Der Prompt dieses
Loops verlangt, eine Hypothese am Quellcode zu pruefen, *bevor* sie umgesetzt
wird. Hier war die Hypothese die eigene aus dem Lauf zwei Stunden davor - und
das falsche Modell (Rang als Bestand statt als Zeit) haette sich ohne diesen
Eintrag im naechsten Lauf als "belegter Befund aus BAUSTELLEN.md" durchgesetzt.
Der Eintrag in BAUSTELLEN.md traegt die Korrektur jetzt an derselben Stelle.

### Kein Hebel, fuenfter Winkel: die Gym-Formel selbst (29.08., 01:00)

Engpass:    Unveraendert der Kampfwert-Tiefstand (`nodes/KURS.md`, 21:45):
            **81 von 100** um 00:51, in Erfahrung rund 55.000 von 252.795.

Der Lauf von 22:05 hat vier Kandidaten rund um Gym und Sleeve verworfen. Um
nicht denselben Gradienten ein zweites Mal abzulaufen, hier ein anderer
Ansatz: **nicht die Umstaende des Trainings, sondern seine Formel.**

`calculateClassEarnings` (`Work/Formulas.ts:108-116`):

    scaleWorkStats(classInfo.earnings, (location.expMult / gameCPS) * hashMult)
    hashMult = isMember("GymType", type)
             ? hashManager.getTrainingMult()      // Gym
             : hashManager.getStudyMult()         // Universitaet

Drei Faktoren, mehr gibt es nicht. `classInfo.earnings` ist fest,
`location.expMult` ist mit Powerhouse Gym bereits maximal (10) - bleibt
`hashMult`. Er kommt aus dem Hash-Upgrade **Improve Gym Training**: 50 Hashes
je Stufe, **+20 Prozent je Stufe**, und der Effekt haelt bis zum naechsten
Augmentierungs-Einbau (`Hacknet/data/HashUpgradesMetadata.tsx:72-80`). Bei der
gemessenen Rate von 13,25 Erfahrung je Sekunde waeren zwei Stufen +40 Prozent,
also rund **vier Stunden weniger** auf den Restweg.

**Verworfen, und zwar hart: Hashes gibt es hier nicht.** Sie entstehen nur auf
Hacknet-SERVERN, und die verlangen SF9. Aus dem Spielstand um 00:58 gelesen:

    sourceFiles  {1:1, 4:1, 5:1, 6:1}      - kein 9
    hashManager  capacity 0, hashes 0, alle Upgrades auf 0
    hacknetNodes 0

Damit ist `hashMult` in diesem Knoten fest 1, und die Gym-Formel hat keinen
freien Parameter mehr. Der Bot faehrt sie optimal.

**Der Fund gehoert trotzdem festgehalten**, denn dieselbe Tabelle enthaelt
zwei Eintraege, die einen Bladeburner-Knoten direkt betreffen:

    Exchange for Bladeburner Rank   250 Hashes  ->  100 Rang
    Exchange for Bladeburner SP     250 Hashes  ->   10 Faehigkeitspunkte

Bei einem Ausgang von 400.000 Rang ist das eine eigene Waehrung neben der
Aktionswahl. Sobald SF9 vorliegt, gehoert sie in die Kursrechnung jedes
Kampfknotens - als Offen-Punkt eingetragen (01:02).

Vorher:     Tiefstand 81 um 00:51, Rate 13,25/s.
Nachher:    (keine Aenderung - Nullergebnis, wie 22:05, aber aus anderer
            Richtung)

### Kein Hebel gefunden - vier Kandidaten gerechnet und verworfen (28.08., 22:05)

Engpass:    Laut `nodes/KURS.md` (21:45) der **Kampfwert-Tiefstand, 68 von
            100**, in Erfahrung 34.419 von 252.817. Die Rate ist **13,25
            Erfahrung je Sekunde** - Spieler 10 im Gym, Sleeve 2,77 ueber
            `sync/100` (gemessen, nicht die frueher geschaetzten 3,25:
            `shockBonus` ist (100-14,76)/100 = 0,8524 und `sync` 25).

Vier Kandidaten geprueft, **alle vier verworfen**:

**1. Besseres Gym.** Verworfen, weil schon getan. `bbtrain.js:65` faehrt
   `Powerhouse Gym` in Sector-12, und das ist mit `expMult 10` das beste im
   Spiel (`Locations/data/LocationsMetadata.ts:325`; Iron Gym 1, Snap
   Fitness 2, Millenium 4).

**2. Sleeve synchronisieren.** `SleeveSynchroWork.ts:14-18`:
   `sync += calculateIntelligenceBonus(int, 0,5) * 0,0002 * cycles`. Mit
   Intelligenz 93 sind das 0,00103 je Sekunde - von 25 auf 100 also **20,2
   Stunden**, mehr als der ganze Restweg von 18,6. Auch teilweise lohnt es
   kaum: Eine Stunde Synchronisation kostet 9.970 Erfahrung und bringt
   danach 0,41 je Sekunde mehr, amortisiert sich also erst nach 6,75
   Stunden.

**3. Shock abbauen.** `SleeveRecoveryWork.ts:13-16`, dieselbe Konstante mit
   Gewicht 0,75 - aber die Intelligenz des SLEEVES zaehlt, und die ist 1.
   0,00100 je Sekunde, von 14,76 auf 0 also 4,09 Stunden. Das hebt den
   Beitrag von 2,77 auf 3,25 je Sekunde (+0,48), kostet aber 40.800
   Erfahrung - Amortisation **23,6 Stunden**, mehr als der Restweg.

**4. Weitere Sleeves kaufen.** `SleeveCovenantPurchases.tsx:28-46`:
   `purchaseSleeve` verlangt Mitgliedschaft in **The Covenant**. Dieselbe
   Sperre gilt fuer `purchaseSleeveMemoryUpgrade` - und `memory` waere
   sonst der eigentliche Fund gewesen, denn `Sleeve.ts:253` setzt bei jedem
   Prestige `sync = Math.max(memory, 1)`. Ein Sleeve mit Memory 100 startet
   also bei Sync 100. Fuer spaetere BitNode-10-Laeufe vormerken; in diesem
   ist The Covenant nicht erreichbar.

Vorher:     Kampfwert-Tiefstand 68 um 21:41, Rate 13,25/s.
Nachher:    (keine Aenderung - dies ist ein Nullergebnis, kein Hebel)

**Das ist ein gueltiges Ergebnis.** Der Bot faehrt in diesem Knoten die beste
bekannte Strategie: bestes Gym, Sleeve im selben Gym, niemand jagt
Reputation (das war die Korrektur von 21:45). Der naechste echte Hebel liegt
nicht in dieser Phase, sondern hinter Tor 1 - dann traegt wieder der
Bladeburner-Rang, und dafuer gibt es aus BitNode 6 einen fertigen Motor.

### Kurs fuer BitNode 10 hergeleitet (28.08., 18:55)

Engpass:    **Es gab keinen gueltigen Kurs.** `nodes/KURS.md` trug als
            obersten Eintrag "28.08., 07:15 - BitNode 6", waehrend der Knoten
            seit 17:05 BitNode 10 ist. Ein Kurs fuer den falschen Knoten ist
            schlechter als keiner: Er nennt eine Leitgroesse, die es hier
            nicht gibt. Der Kursloop haette um 18:44 feuern sollen und hat
            nichts geliefert.

Hypothese:  Keine Aenderung am Bot, sondern die fehlende Grundlage. Die
            Leitgroesse ist herleitbar, nicht messbar - also wurde sie
            hergeleitet.

Beleg:      Das Modell ist an zwei unabhaengigen Werten geeicht:
            `calculateSkill` (`PersonObjects/formulas/skill.ts:13`) rechnet
            mit `mults.hacking` 1,2616 x `HackingLevelMultiplier` 0,35 aus
            42.542 Erfahrung **Level 62** (gemessen 62) und mit Kampffaktor
            0,4 aus 2.613 Erfahrung **29** (gemessen 29).

            Weg A, Hacking auf 6.000 (3.000 x `WorldDaemonDifficulty` 2):

                mults.hacking  1,26 -> 2,3e187 Erfahrung
                mults.hacking    20 -> 2,2e14
                mults.hacking    40 -> 339.456.229    <- erst hier realistisch

            Der eigene BitNode-5-Lauf zeigt den Unterschied: Dort stand
            `HackingLevelMultiplier` auf 1,0, und Level 4.500 kostete bei
            mult 20 nur 585.568 Erfahrung. Nicht die Erfahrung ist das
            Problem, sondern der Faktor 0,35 - und BitNode 10 verteuert genau
            den Ausweg (`AugmentationMoneyCost` 5, `AugmentationRepCost` 2).

            Weg B, 21 Black Ops: Tor 1 ist der Beitritt (alle vier Kampfwerte
            >= 100, `NetscriptFunctions/Bladeburner.ts:356`) und kostet bei
            Faktor 0,4 **252.822 Erfahrung je Wert** gegen 5.633 in BitNode 6
            - das 45-fache, aber Gym-Zeit und Geld sind da. Tor 2 ist Daedalus
            mit `reqdRank` 400.000; die Schwelle ist knotenunabhaengig,
            gedaempft wird der Ertrag (`BladeburnerRank` 0,8,
            `Bladeburner/Formulas.ts:13, 22, 25`).

Vorher:     Kampfwert-Tiefstand **27 von 100** um 18:52, Hacking 62.
Nachher:    (offen - der naechste Lauf misst, ob bbtrain.js laeuft und der
            Tiefstand steigt)

Folge fuer die anderen Loops: Der Traeger dieses Knotens ist bis auf Weiteres
der **Kampfwert-Tiefstand**, nicht das Hackniveau - `tools/strategie-check.js`
meldet aber "Phase: Hacking-Weg", weil seine `traeger()`-Funktion nur
BitNode 6 und 7 als Kampfknoten kennt. Das ist der naechste Hebel.

### Feuerschwelle fuer Black Ops von 0,90 auf 0,35 (28.08., 16:00)

Engpass:    **Nicht mehr der Rang, sondern die erwartete Zeit bis Daedalus
            faellt.** Offen sind noch drei Black Ops (Centurion, Vindictus,
            Daedalus); hinter Daedalus ist der Knoten zu Ende, Rang danach ist
            wertlos. Gemessen 15:51: Daedalus 0,2296, Rang 344.123 von
            400.000, Rate 1.846/min.

Hypothese:  Die erwartete Zeit bis Daedalus faellt sinkt von **119 auf 64
            Minuten**, weil ein Fehlschlag viel billiger ist als die alte
            Schwelle unterstellt.

Beleg:      Drei Fundstellen, alle im Quellcode:
            1. `changeRank` vergibt Skillpunkte gegen `maxRank`
               (`Bladeburner.ts:1283-1291`), und `maxRank` faellt nie
               (`:1273`). **Ein verlorener Rang kostet keinen Skillpunkt** -
               er verzoegert nur die `reqdRank`-Freigabe. Die 10.000 rankLoss
               von Daedalus sind bei 1.846/min genau 5,4 Minuten.
            2. Die Dauer steht in `Action.ts:105-121`: mit Reaper 90,
               Evasive 93 und Overclock 90 sind es Centurion 484 s,
               Vindictus 518 s, Daedalus 553 s - gut neun Minuten, nicht die
               zwei Stunden der rohen Tabelle.
            3. Krankenhaus `min(Geld * 0,1, ...)` (`Hospital.ts:4-10`) =
               640 Mio je Fehlschlag bei 6,4 Mrd. Kein Traeger des Ausgangs.

            Erwartete Zeit bis Daedalus faellt, gerechnet ueber die
            Chancenbahn (615 Skillpunkte/min in Blade's Intuition, Digital
            Observer, Reaper, Evasive System):

                ab 0,25   57 min       ab 0,75   101 min
                ab 0,35   57 min       ab 0,85   113 min
                ab 0,45   64 min       ab 0,90   119 min   <- bisher
                ab 0,55   77 min       ab 1,00   130 min

            Die Kurve ist unter 0,45 flach. 0,35 laesst `einsatzSchwelle()`
            die Fuehrung (Centurion 0,50, Vindictus 0,75, Daedalus 0,45) -
            die alte begruendete Regel bleibt, nur der pauschale Boden faellt.

Vorher:     Daedalus 0,2571 um 15:55 (Spielzeit), Schwelle 0,90,
            Aktion Operations/Assassination.
Nachher:    **Getragen, und deutlich.** Die drei letzten Black Ops fielen
            zwischen 16:10 und 17:00:

                16:10  Centurion feuert bei Chance 0,405 gegen Schwelle 0,35
                       ("Black Op (Chance 0.405 gerechnet, Schwelle 0.35)")
                16:38  Vindictus feuert bei 0,390 - mit der alten Regel haette
                       der Bot dort bis 0,75 gewartet
                17:00  Daedalus gefallen, 21 von 21, BitNode 6 zu

            Die Rechnung sagte 27 bis 29 Minuten je Aktion beim Feuern ab
            0,35 gegen 78 bis 86 bei 0,90. Gemessen wurden fuer alle drei
            zusammen **50 Minuten** - im Rahmen. Ein Fehlschlag kam vor
            (Rang 400.234 auf 395.033 um 16:15, Centurions 5.000 rankLoss)
            und kostete wie vorhergesagt nur Zeit, keine Skillpunkte.

Naechster Kandidat, bewusst NICHT mitgeaendert: `EINSATZ_ABSTAND = 0.25`.
Der Zuschlag stammt aus derselben Rang-je-Minute-Herleitung; die Rechnung oben
sagt, dass das Optimum bei 0,25 bis 0,35 flach liegt, also unter allen drei
`einsatzSchwelle`-Werten. Eine Aenderung je Lauf.

### Der Chaos-Zuschlag galt erst ueber `CHAOS_AUS` (28.08., 13:05)

Engpass:    **Ein Grenzzyklus aus Raid und Diplomacy**, nicht eine Stoerung.
            Gemessen ueber `data/aktionen.txt` (08:12 bis 12:35, 125
            protokollierte Minuten): Diplomacy hatte **56,8 Prozent** der Zeit
            und brachte null Rang; die Ausdauerkammer nur 2,3 Prozent.

            Der Zuschlag in `beste()` rechnet die Diplomacy-Laeufe, die eine
            Aktion durch ihren Chaos-Anstieg erzwingt, in ihre Dauer ein - aber
            nur `if (c > CHAOS_AUS)`, also ab Chaos 47. Darunter galt Chaos als
            gratis.

            Das stimmt fuer die SCHWIERIGKEIT: `sqrt(1 + chaos - 50)` ist unter
            50 exakt 1 (`Actions/Operation.ts:52-61`). Fuer die ZEIT stimmt es
            nicht, denn `chaosAufraeumen` schaltet bei 50 ein und erst unter 47
            wieder aus - der Motor kehrt **immer** zu 47 zurueck. Jedes Prozent
            Chaos wird also bezahlt; nur der Zeitpunkt verschiebt sich. Gratis
            ist allein der passive Abbau, `chaos -= 0,0001 * seconds`
            (`Bladeburner.ts:1397`), also 0,36 Punkte je Stunde.

Hypothese:  Der Zyklus, den die Bedingung baut, ist durchrechenbar (Charisma
            309, Diplomacy -1,603 % je 60 s, `Bladeburner.ts:735-743`):

                Chaos 47 -> 50   +6,4 %  = 2,13 Raids a 11 s  =  23 s, 538 Rang
                Diplomacy zurueck ln(50/47)/0,01616 = 3,83 Laeufe = 230 s, 0
                Zyklus           253 s fuer 538 Rang         = **128 Rang/min**

            Das ist auf zwei Prozent genau die Rate, die den ganzen Vormittag
            gemessen wurde: 118,4/min ueber 61 Minuten, 130,7 ueber 121
            (`data/verlauf-strategie.json`, 12:34). Mit unbedingtem Zuschlag
            steht Raid bei 252,7 Rang je 123 s = **123/min** gegen
            Assassination **1.097/min** (chaosneutral, `Bladeburner.ts:859`) -
            der Zyklus entsteht nicht mehr, Diplomacy faellt weg.

            Erwartet: geglaettete Rate ueber 45 Minuten **mindestens
            1.000/min**, Diplomacy-Anteil **null**.

Beleg:      `Actions/Operation.ts:52-61` (Chaos wirkt erst ab 50 auf die
            Schwierigkeit), `Bladeburner.ts:1397` (passiver Abbau 0,0001/s),
            `:844` (Raid +1 bis +5 %), `:859` (Assassination -5 bis +5 %, im
            Mittel null), `:735-743` und `:1185-1187` (Diplomacy prozentual
            ueber Charisma), `src/blade.js` `CHAOS_EIN`/`CHAOS_AUS` 50/47.

Vorher:     **1.137 Rang/min** von 12:47 bis 12:56 (`data/aktionen.txt`:
            Assassination 86,8 %, Raid 13,2 %, Diplomacy 0 %) - aber das war
            der Transient nach dem Wegfall des Raid-Vorrangs, mit Chaos bei
            45,3 und noch unbezahlter Schuld. Die Fenster davor: 118,4/min
            (61 min) und 130,7 (121 min).
Nachher:    (offen - naechster Lauf misst ueber mindestens 45 Minuten. Zu
            pruefen: Diplomacy-Anteil in `data/aktionen.txt` = 0, und Chaos in
            New Tokyo bleibt unter 47.)
Commit:     siehe `git log src/blade.js`

---

### Datamancer - die Faehigkeit, die in blade.js nirgends vorkam (28.08., 09:55)

Engpass:    **Die Bevoelkerungsschaetzung, nicht die Kampfwerte.** Gemessen
            09:40 (`src/bbspann.js`), Division in Chongqing: ALLE SECHS
            Operationen standen bei **[0,000 - 1,000]**. Der Motor entscheidet
            an `s.min`, und `s.min` war null. Er hat von 08:40 bis 09:42
            **87 Minuten** nichts verdient - im Gym, weil `lohntSich` nie
            wahr wurde.

            Der Grund steht in `Actions/Action.ts`: `low = real - diff`, und
            `diff` uebersteigt `real`, sobald `popEst` weit von `pop`
            entfernt ist. Nach einem Stadtwechsel der Division ist das der
            Normalfall.

Hypothese:  `Datamancer` wird von der dynamischen Sortierung **sofort und
            weit** gekauft, weil sein Nutzen je Punkt die Konkurrenz um rund
            **Faktor 250** schlaegt:

                Datamancer Stufe 0    5,00 Nutzen / 3 Punkte  = 1,67 je Punkt
                Blade's Intuition 65  (Klemmfaktor)           = 0,0066 je Punkt

            Und damit faellt die breiteste Spanne im Feld von **1,000** auf
            unter **0,500**, weil alle vier Wege zur besseren Schaetzung mit
            demselben Multiplikator skalieren.

Beleg:      `data/Skills.ts:73-83` - `Datamancer`,
            `mults: { SuccessChanceEstimate: 5 }`, also fuenf Prozent je
            Stufe. `baseCost 3, costInc 1`, Stufe n kostet also `3 + n`
            (`Skill.ts:37-41`) - Stufe 13 zusammen 117 Punkte. Zum Vergleich
            kostet Blade's Intuition die naechste Stufe allein 140.

            Der Multiplikator greift an **vier** Stellen (`Bladeburner.ts`):

                :806   Investigation gelungen   +0,4 % Schaetzung
                :815   Undercover gelungen      +0,8 %
                :875   Tracking (Vertrag)       +100 bis 1.000 Zaehlwerte
                :1140  Field Analysis           + eff Prozent

            **Sie kam in `src/blade.js` nirgends vor** - weder im Plan noch in
            `DYNAMISCH`. Seit dem ersten Tag auf Stufe 0, waehrend genau die
            Groesse, die sie hebt, den Motor heute anderthalb Stunden
            blockiert hat.

            Der Nutzen ist situativ und haengt deshalb an `schaetzNot()` -
            der breitesten Spanne im Feld, normiert auf `SPANNE_ZU_BREIT`.
            Ist die Schaetzung scharf, faellt er auf null. Dasselbe Muster wie
            bei Overclock und Cyber's Edge.

Vorher:     Datamancer Stufe 0 (fehlt in `bbspann.json`, das ueber
            `getSkillNames()` ALLE Faehigkeiten fuehrt und nur Stufe > 0
            anzeigt). Breiteste Spanne 1,000 um 09:40.
Nachher:    **Stufe weiterhin 0 - und das ist richtig so** (nachgemessen
            28.08., 12:56). `schaetzNot()` normiert auf die breiteste Spanne im
            Feld, und die steht bei **null**: alle sechs Operationen und alle
            drei Vertraege melden `min 1, max 1` (`data/bbspann.json`, 12:56).
            Eine schaerfere Schaetzung kann dort nichts mehr freigeben, also
            ist der Nutzen null und die Faehigkeit zu Recht unten in der
            Sortierung. Der Hebel ist damit **eingebaut und schlafend**, nicht
            wirkungslos - er greift beim naechsten Stadtwechsel.

            Nebenbefund, der die urspruengliche Diagnose stuetzt: Die
            Bevoelkerungsschaetzung liegt um **Faktor acht** daneben (pop
            1.126 Mio, popEst 141 Mio, Spielstand 12:53) und richtet trotzdem
            keinen Schaden an, weil die Chancen ohnehin bei 1 klemmen.
Commit:     (siehe git log)

**Nachmessung des Hebels von 09:42 - er traegt:** Der Gym-Zweig verdraengte
Field Analysis; seit der Korrektur laeuft der Motor wieder. **Operation Red
Dragon ist um 09:55 gefallen** (naechste Black Op ist jetzt Operation K, Rang
30.000), der Rang stieg von 82.299 auf **82.770**. Das sind **8 von 21** Black
Operations.

---

### WIDERLEGT und zurueckgenommen: Gym und Bladeburner laufen NICHT parallel (28.08., 07:34)

**Der Hebel von 07:00 ruhte auf einer falschen Annahme, und er war nicht nur
wirkungslos, sondern schaedlich.** Er ist mit `git revert` zurueckgenommen
(`9703d3c` nimmt `41fa473` zurueck).

Die Annahme war: "Der Arbeitskanal laeuft parallel zur Bladeburner-Aktion -
eine Gym-Einheit kostet den Motor keine Sekunde." Der Quellcode sagt das
Gegenteil, an zwei Stellen:

    Bladeburner.ts:178-180   startAction():
      if (!Player.hasAugmentation(AugmentationName.BladesSimulacrum, true))
        Player.finishWork(true);

    Bladeburner.ts:1353-1360  process():
      if (!hasAugmentation(BladesSimulacrum) && Player.currentWork)
        -> "Your Bladeburner action was cancelled because you started
            doing something else."

**Ohne die Augmentierung `The Blade's Simulacrum` schliessen die beiden
einander aus, und zwar in beide Richtungen.** Jeder Aktionswechsel von
`blade.js` beendet die Gym-Arbeit; jede Gym-Arbeit bricht die laufende
Bladeburner-Aktion ab. Die beiden Skripte haben sich eine halbe Stunde lang
im Minutentakt gegenseitig unterbrochen.

**Nachgemessen 07:33, und die Zahlen sind eindeutig:**

    Kampfwert-Tiefstand   195 -> 222 in 28 min   =  0,96/min
    davor, ohne Gym       169 -> 195 in 27 min   =  0,96/min
    Rangrate (45 min)                               49,0/min
    davor (55 min)                                  49,1/min

**Kein einziger Messwert hat sich bewegt.** Und "Arbeit keine" stand um 07:08,
07:14 und 07:33 in der Pruefzeile - das Gym lief nur in kurzen Stoessen,
bevor `blade.js` es wieder abraeumte.

**Was der Befund von 07:00 richtig gesehen hat:** Der Wiederaufbau nach einem
Einbau IST der Engpass (53,8/min gegen 442), und die Aktionsstufe ueberlebt
den Einbau, waehrend die Kampfwerte fallen. Das bleibt stehen. Falsch war nur
der vorgeschlagene Ausweg.

**Der echte Hebel liegt eine Ebene tiefer - und er ist kaufbar:**

    The Blade's Simulacrum    repCost  1.250      moneyCost  1,5e11
    (Augmentations.ts:284-297, Faktion Bladeburners, isSpecial)
    "allows you to perform Bladeburner actions and other actions
     (such as working, committing crimes, etc.) at the same time."

Die Reputation ist kein Thema (1.250 gegen einen Rang von 81.935, bei
`RankToFactionRepFactor` 2). **Geld ist das Tor: 150 Milliarden gegen einen
Kontostand von 1,81 Milliarden.** Damit waere der Wiederaufbau nach jedem
kuenftigen Einbau tatsaechlich parallelisierbar - genau das, was der Hebel von
07:00 gewollt und nicht bekommen hat.

Vorher:     Tiefstand +0,96/min, Rang 49,1/min  (07:05)
Nachher:    Tiefstand +0,96/min, Rang 49,0/min  (07:33) - **unveraendert**
Commit:     41fa473 eingebaut, 9703d3c zurueckgenommen

**Lehre, die ueber diesen Fall hinausgeht:** Der Befund von 07:00 hat den
Arbeitskanal als "leer" gelesen und daraus "ungenutzt" geschlossen. Er war
aber nicht ungenutzt, sondern **gesperrt** - und die Sperre stand im
Quellcode, zwei `grep` entfernt. Die Prompt-Regel "Nachschlagen schlaegt
raten" wurde hier auf die Wirkung angewandt (Gym-Multiplikator 10 gegen 1) und
nicht auf die Voraussetzung (darf das ueberhaupt gleichzeitig laufen?).

---

### Die Chaos-Folgekosten gehoeren in die Dauer (28.08., 03:42)

Engpass:    `beste()` verglich die **nackte** Aktionsdauer. Aktionen, die
            das Chaos heben, laden ihre Kosten damit bei der naechsten
            Diplomacy-Phase ab - und die taucht in keiner Rechnung auf.

Hypothese:  Die Rangrate steigt von **35,4/min** zurueck auf die **86,4**,
            die Assassination allein gebracht hat, weil Raid mit seinen
            Folgekosten bewertet wird statt ohne.

Beleg:      Drei Aktionen aendern das Chaos (`Bladeburner.ts:836-859`):
            Raid +1 bis +5 Prozent, Stealth Retirement -1 bis -3,
            Assassination -5 bis +5 (Mittel null). Ueber Chaos 50 schlaegt
            das mit `sqrt(1+chaos-50)` auf die Schwierigkeit **jeder**
            Aktion (`Action.ts:94-100`).

            **Gemessen in zwei Fenstern**, beide 40 bis 49 Minuten
            (`data/verlauf-strategie.json`):

                02:04 - 02:53   nur Assassination     86,4 Rang/min
                02:53 - 03:33   Raid und Diplomacy    35,4

            Der Wechsel kam, als Assassination Stufe 12 erreichte und die
            Anlaufregel abschaltete. `beste()` rechnete dann Raid auf Stufe
            12 mit 157 Rang je 59 Sekunden = 159 je Minute gegen
            Assassination mit 186 je 108 Sekunden = 103 - und waehlte Raid.
            Mit den zwei Diplomacy-Laeufen, die jeder Raid nach sich zieht,
            sind es real **52,6 gegen 103**.

            Der Zuschlag rechnet die noetigen Diplomacy-Laeufe: 60 Sekunden
            fest (`data/GeneralActions.ts:39`), Senkung
            `charisma^0,045 + charisma/1000` Prozent
            (`Bladeburner.ts:735-743`). Beide Richtungen sind prozentual,
            das Chaos-Niveau kuerzt sich heraus. Unter `CHAOS_AUS` ist der
            Zuschlag null - dort ist Platz nach oben.

Vorher:     35,4 Rang/min (02:53 bis 03:33), Aktion Raid im Wechsel mit
            Diplomacy.
Nachher:    **BESTAETIGT. 86,9 Rang/min ueber 45 Minuten** (Messung 03:51),
            gegen die 35,4 vorher und die geforderten 70. Im kurzen Fenster
            seit dem Neustart sind es sogar 190,5 - dort wirkt zusaetzlich
            Overclock, das inzwischen auf **Stufe 69** steht.
            Verifiziert 03:39, 16 Sekunden nach dem Neustart: `blade.json`
            meldete `"aktion":"Operations/Assassination"`, wo unmittelbar
            davor Raid lief.

            Raid taucht weiterhin auf (einmal seit 03:40) - das ist richtig
            so: Der Zuschlag greift nur ueber `CHAOS_AUS`, und unterhalb ist
            Raid tatsaechlich guenstig.

Commit:     (folgt)

### Overclock in die dynamische Sortierung (28.08., 00:58)

Engpass:    Die Faehigkeitspunkte stauten sich: **84 unverbraucht** um 00:53,
            waehrend der teuerste Kandidat 98 kostete. Gekauft wurde Blade's
            Intuition auf Stufe 45 - eine reine Chance-Faehigkeit, waehrend
            die Operationschancen bei **1,00** klemmen.

Hypothese:  Die Rangrate steigt, weil Overclock die Dauer JEDER Aktion senkt
            statt eine Chance zu heben, die nicht mehr steigen kann. Von
            Stufe 14 auf 30 waeren das `(100-30)/(100-14)` = Faktor 0,814
            auf die Dauer, also **plus 23 Prozent** auf die Rate.

Beleg:      `data/Skills.ts:44-53`: `mults: { ActionTime: -1 }`, maxLvl 90,
            "decreases the time it takes to attempt a Contract, Operation,
            and BlackOp by 1%". `getSkillMult` macht daraus `1 - stufe/100`,
            und `Action.ts:108,119` multipliziert die Dauer direkt damit
            (`baseTime * skillFac`, im Quellcode als "Always < 1"
            kommentiert). Der Rangertrag je Aktion bleibt unberuehrt.

            Nutzen je Punkt, gerechnet auf dem Stand von 00:53:

                Overclock          Stufe 14   1,176 %   23 Punkte   0,0511
                Blade's Intuition  Stufe 44   1,293     95          0,0136
                Hyperdrive         Stufe 13   0,452     34          0,0133

            **Faktor 3,8 gegenueber dem bisher Besten.** Overclock stand
            ausserhalb von `DYNAMISCH` und wurde deshalb nie verglichen -
            derselbe Fehler wie bei den Deckeln am 27.08. um 20:33, nur
            andersherum.

Vorher:     Overclock Stufe 14, 84 Punkte unverbraucht, 00:53.
Nachher:    **Verifiziert 00:56: Stufe 16, um 01:39 bereits Stufe 30.**
            Die Wirkung ist an der Aktionsdauer ablesbar: Assassination
            braucht auf Stufe 11 nur **102 Sekunden** statt der aus
            `difficultyFac` gerechneten 173 - rund 30 Prozent weniger,
            genau der Overclock-Faktor. Die Rangrate steht bei **78,8/min**
            (02:05 bis 02:38) gegen 52,7 des Raid-Zyklus.
            Zwei Kaeufe binnen einer Minute,
            nachdem die Sortierung sie sah. Die Rangrate misst der naechste
            Lauf ueber 45 Minuten - sie ist derzeit vom laufenden
            Assassination-Stufenaufbau ueberlagert (38,1/min seit 23:39,
            Stufe 7 von 12 um 00:53, planmaessig).

Commit:     (folgt)

### Black Ops erst ab Chance 0,90 statt 0,40 (27.08., 21:55)

Engpass:    Der Anteil der Zeit, den der Motor NICHT in Raid steckt. In der
            Stunde bis 21:51 lief kein einziger Raid - 55 % Stealth
            Retirement, 45 % Black Operations. Raid gibt 98,3 Rang/min, eine
            fruehe Black Op rund 8.

Hypothese:  Die Rangrate steigt von **29,3/min** (geglättet über 45 min,
            `data/verlauf-strategie.json`, 21:35) auf mindestens **45/min**,
            weil die Black-Op-Zeit durch Raid ersetzt wird, bis die Chance
            hoch genug ist.

Beleg:      `src/bodauer.js` um 21:52, Rang 13.209:

                Operation Ares         469 s   Chance 0,405 - 0,637
                Operation Archangel    703 s          0,289 - 0,455
                Operation Juggernaut   938 s          0,202 - 0,318
                Operation Red Dragon  1172 s          0,154 - 0,242
                Raid                    72 s   118 Rang = 98,3 Rang/min

            Eine Black Op kostet erwartet `Dauer / p`. Ares bei p = 0,52:
            902 s fuer `rankGain` 125 (`data/BlackOperations.ts:152`) -
            in derselben Zeit brachte Raid 1.475 Rang. **Nettokosten 1.350.**
            Bei p = 0,95 nur 681. Bei Red Dragon steht 5.860 s gegen 1.234 s,
            also **7.577 Rang Unterschied.**

            Warum Warten nichts kostet: Die Gesamtzeit ist
            `(400.000 - 73.660)/Raidrate + Summe(Dauer_i / p_i)`. Der erste
            Term haengt nicht davon ab, WANN die Black Ops fallen - ihre
            73.660 Rang zaehlen zum selben Ziel. Der zweite wird kleiner, je
            hoeher p ist. Und p steigt von allein, weil
            `skillPoints = floor(maxRank/3)` bei linear steigenden
            Faehigkeitskosten (`Skill.ts:37-41`) den Rang in Chance
            uebersetzt.

Vorher:     29,3 Rang/min um 21:35, kein Raid in der Stunde davor.
Nachher:    **52,7 Rang/min** ueber das Fenster 21:56 bis 23:39 (97 Minuten,
            `data/verlauf-strategie.json`). Die Hypothese verlangte
            mindestens 45 - **bestaetigt, plus 80 Prozent gegen vorher.**
            Verifiziert 21:55, dass die Regel greift: `data/blade.json`
            meldet `"aktion":"Operations/Raid"`, wo vorher Operation Ares
            lief.

**Was dabei geprueft und VERWORFEN wurde** - damit es niemand ein zweites Mal
aufmacht:

  - **Die Chaos-Hysterese enger stellen** (`CHAOS_AUS` 47 -> 49). Gerechnet:
    ab 47 sind es 2 Raids bis ueber 50 und 3,2 SR zurueck = 51,8 Rang/min;
    ab 49 ein Raid und 1,5 SR = 53,0. **Plus 2,3 Prozent** - unter der
    Messgenauigkeit. Der einzige echte Verlust ist der einmalige Anlauf nach
    einem Stadtwechsel (Chongqing kam mit Chaos 66), und der betrifft sechs
    Staedte einmal.
  - **Stealth Retirement wegen der Bevoelkerung begrenzen.** SR senkt sie um
    0,5 % je Erfolg, und sie wirkt mit `(pop/1e9)^0,7` auf die competence.
    Aber: Auf Black Ops wirkt sie **gar nicht**
    (`Actions/BlackOperation.ts:55-61` gibt fest 1), und bei den Operationen
    klemmt die Chance ohnehin bei 1,00 - Raid steht bei 1,0 bis 1,0. Die
    bestehende Grenze `SR_POP_MIN` = 0,8e9 deckt den Fall ab, in dem es
    anfaengt zu kosten. Kein Handlungsbedarf.

Commit:     (folgt)

---

### Feste Deckel raus, wo die Sortierung greift (27.08., 20:33)

Engpass: Zum **fuenften Mal an einem Tag** lag die beste Faehigkeit gedeckelt
daneben. Gemessen um 20:33 mit `src/skillcheck.js`:

    Faehigkeit         Stufe  Preis  Nutzen   Wert je Punkt
    Hyperdrive             7     19   0,738   0,0388  <- gedeckelt
    Digital Observer      15     34   1,100   0,0324     wurde gekauft
    Evasive System        17     38   1,035   0,0272  <- gedeckelt
    Reaper                16     36   0,944   0,0262  <- gedeckelt
    Blade's Intuition     30     66   1,579   0,0239     wurde gekauft
    Short-Circuit         30     65   1,142   0,0176  <- gedeckelt

Hypothese: Ohne die Deckel kauft der Motor sofort Hyperdrive statt Digital
Observer, und die Faehigkeitspunkte fliessen dauerhaft dorthin, wo der
Grenznutzen am hoechsten ist - statt dorthin, wo zufaellig kein Deckel steht.

Beleg: Die Sortierung in `faehigkeitenKaufen()` rechnet den Grenznutzen bei
der AKTUELLEN Stufe. Ein Deckel bildet dasselbe grob nach und ist damit
ueberfluessig - aber er ueberstimmt die Sortierung, weil ein Eintrag am
Deckel auf `-1` faellt. Zwei Mechanismen fuer dieselbe Frage, und der
groebere gewinnt.

**Das Muster war der Fehler, nicht die einzelne Zahl.** 12:52 Hyperdrive,
13:19 Short-Circuit, 15:53 Reaper und Evasive System, 18:55 Digital Observer -
jedes Mal wurde ein Deckel einzeln hochgesetzt, und beim naechsten Lauf stand
das naechste Deckel-Problem an.

Vorher: Hyperdrive **Stufe 7** (Deckel 7) seit 12:52, Cloak 3, Rang 10.398
Nachher: **Hyperdrive 8, Cloak 15** binnen 13 Minuten (20:20) - beide vorher
blockiert. Rang 10.505.

Bleibende Deckel, jeder mit Grund: Cyber's Edge 5 (Arbeitsanteil ist bei 1,00
angekommen), Tracer 14 (Vertragschancen klemmen bei 0,92-1,00), Overclock 90
(Maximum des Spiels).

Abbruchkriterium: Faellt die Rangrate ueber 45 Minuten unter 15/min oder
sammelt sich ein Faehigkeitspunktestau (`punkte` ueber 100), war die
Sortierung ohne Deckel doch nicht ausreichend.
Commit: siehe git log, blade.js 27.08. 20:33

### Raid wieder an und ein Trupp von sechs (27.08., 19:54)

Engpass: Die Rangrate. Sie stand ueber 45 Minuten bei 18 bis 32 je Minute,
waehrend `data/bbspann.json` fuer Raid **80,01** meldet - bei Chance 0,919,
794 offenen Laeufen und Arbeitsanteil 1,00 (2,2 Ausdauer je Minute gegen
3,07 Regeneration, also ohne Kammerpausen).

Hypothese: Die geglaettete Rangrate steigt von 32,75 auf **mindestens 60**
je Minute. Dazu +9,4 Prozent competence aus dem Trupp
(`(teamCount+1)^0,05`, `Actions/Operation.ts:96-98`).

Beleg: `data/Operations.ts:113-132` (Raid: baseDifficulty 800, rewardFac 1,1,
rankGain 55, aktuell Stufe 7 also 97,4 effektiv) und
`data/GeneralActions.ts:24-31` (Recruitment: Dauer
`max(10, 300-(cha^0,81+cha/90))` = 206 s, Chance `cha^0,45/(team+1)` = 1,00
bis elf Mitglieder bei Charisma 264).

**Die alte Ablehnung war doppelt falsch.** Sie stand seit 26.08., 17:20 auf
`RAID_AN = false` mit der Begruendung "bei Charisma 27 ... Gleichstand erst
bei Charisma 440". Erstens ist Charisma **264**, nicht 27. Zweitens sagt
`data/Operations.ts:120` woertlich "Unaffected by Charisma" - es wirkt auf
Raid gar nicht, sondern nur ueber die Truppkosten, und die sind bei 264
vernachlaessigbar.

Vorher: Rangrate **32,75/min** (45-min-Fenster 18:26-19:11), Trupp **0**,
Rang 9.083 um 19:10, popEst Sector-12 **1,109e9**, Chaos **48,9**

Nachher, zweiter Teil (20:40, jetzt laeuft Raid wirklich):

**Der Zyklus ist grenzwertig.** Beobachtet: Raid, dann Chaos ueber 50, dann
Diplomacy, dann wieder Raid - genau das erwartete Wechselspiel. Die Frage ist
der Preis. Gerechnet mit Chaos 49, Raid 67 s, Diplomacy 60 s und einer Senkung
von 1,563 Prozent je Lauf:

    Chaosanstieg je Raid   Diplomacy noetig   Zyklus   Rang je Minute
    1 % (+0,49 Punkte)                    1    127 s             45,8
    3 % (+1,47)                           2    187 s             31,1
    5 % (+2,45)                           4    307 s             19,0

Der Anstieg ist zufaellig zwischen 1 und 5 Prozent
(`getRandomIntInclusive(1, 5)`, `Bladeburner.ts:843`). Im Mittel bei 3 Prozent
sind das **31,1 Rang je Minute** gegen **26,9** der laufenden Arbeit - ein
Gewinn von 16 Prozent, nicht die erhofften 80.

**Der Grund liegt im Ausgangschaos, nicht in Raid.** Sector-12 stand schon bei
48,8, also direkt unter der Schwelle. Jeder Raid reisst sie, und die Hysterese
(`CHAOS_EIN 50`, `CHAOS_AUS 47`) faehrt danach bis 47 herunter - drei Punkte,
also rund vier Diplomacy-Laeufe. In einer Stadt mit Chaos 20 waere derselbe
Raid fast kostenlos.

**Nachtrag 20:47, eigene Fehlfolgerung korrigiert:** Oben stand, die Rundreise
gehoere nach dem Chaos zu sortieren statt nach der Zahl der Gemeinden. Das ist
falsch. Nach der Diplomacy-Phase stehen **alle** Staedte bei 49 - das Chaos ist
danach kein Unterscheidungsmerkmal mehr, und seine Kosten stecken bereits in
der Spalte "Rang je Diplomacy-Minute", nach der `tools/staedte.js` ohnehin
sortiert. Die comms-Sortierung ist richtig.

**Nachtrag 20:45, zweite eigene Fehlfolgerung - der CHAOS_AUS-Hebel traegt
NICHTS.** Hier stand, `CHAOS_AUS` von 47 auf 35 zu senken bringe 17 Prozent.
Das ist falsch, und der Quellcode sagt es in einer Zeile: **Beide Richtungen
sind prozentual.** Raid ruft `changeChaosByPercentage(getRandomIntInclusive(
1, 5))` (`Bladeburner.ts:844`), Diplomacy ruft
`changeChaosByPercentage(-diplomacyPct)` (`Bladeburner.ts:1187`). Das
Verhaeltnis "wieviele Diplomacy-Laeufe kostet ein Raid" ist damit vom
Chaos-Niveau **unabhaengig** - es kuerzt sich heraus. Bei Chaos 42 hebt ein
Raid um 1,26 und ein Diplomacy-Lauf senkt um 0,66; bei Chaos 48 sind es 1,45
und 0,76. Beide Male 1,9 Laeufe. Die Rechnung oben hat den Anlauf einmalig
gegen einen stationaeren Zyklus gestellt und deshalb einen Gewinn gesehen, wo
keiner ist. **Nicht umsetzen.**

**Was stattdessen traegt: Stealth Retirement statt Diplomacy** (eingebaut und
verifiziert 20:45). Beim Nachschlagen der Chaos-Zeilen fiel auf, dass es eine
zweite Aktion gibt, die das Chaos senkt - und die dabei Rang gibt:

    case StealthRetirement:
      if (success) { city.changePopulationByPercentage(-0.5, ...) }
      city.changeChaosByPercentage(getRandomIntInclusive(-3, -1));

Die Chaos-Senkung steht **ausserhalb** der Erfolgspruefung. Gemessen 20:41 im
Spiel (`src/sr.js`), Charisma 287:

    Raid        lvl 9  Chance 0,900  73 s  118 Rang  Chaos +3 %
    Stealth R.  lvl 5  Chance 0,999  78 s   33 Rang  Chaos -2 %
    Diplomacy                        60 s    0 Rang  Chaos -1,58 %

Ein Raid hebt bei Chaos 50 um 1,5 Punkte; zum Ausgleich braucht es 1,5
Stealth Retirements oder 1,9 Diplomacy-Laeufe:

    Raid + 1,5 SR     190 s fuer 156 Rang  =  49,3 Rang/min
    Raid + 1,9 Dipl.  187 s fuer 106 Rang  =  34,0 Rang/min

**Plus 45 Prozent.** Diplomacy ist strikt dominiert - der Break-even liegt bei
einer Erfolgswahrscheinlichkeit von 0,083, weil ein Fehlschlag nur
`rankLoss` 2 x 1,11^4 = 3,0 Rang kostet und das Chaos trotzdem faellt.

Die Grenze ist die **Bevoelkerung**, nicht die Chance: SR senkt sie um 0,5 %
je Erfolg, und sie wirkt ueber `(pop/1e9)^0,7` auf jede Operationschance.
Unter `SR_POP_MIN` = 0,8e9 schaltet die Regel zurueck auf Diplomacy.

**Ein Fallstrick beim Einbau, gemessen 20:44:** Die erste Fassung prueft die
**Untergrenze** der geschaetzten Chance gegen 0,95. Nach dem Stadtwechsel nach
Chongqing stand die Spanne bei 0,909 bis 1,000 - die Regel legte sich still,
obwohl der Erwartungswert bei 0,95 lag. Eine breite Schaetzspanne ist in einer
frisch betretenen Stadt der Normalfall, nicht die Ausnahme. Grenze auf 0,70.

Verifiziert 20:45: `data/blade.json` meldet
`"aktion":"Operations/Stealth Retirement Operation"` bei Chaos 66,3 in
Chongqing - dort lief vorher Diplomacy.

Zu messen bleibt die Rangrate ueber 45 Minuten, sobald die Rekrutierungsphase
(20:00 bis 20:14, dabei null Rangzuwachs) aus dem Fenster gelaufen ist.

Nachher (teilweise widerlegt, 20:15 - noch bevor der erste Raid lief):

**Die 80 Rang je Minute stimmen, die Reichweite nicht.** `Raid` senkt bei
jedem Erfolg `city.comms` um eins (`Bladeburner.ts:830-844`), und
`Operation.getSuccessChance` gibt **0** zurueck, sobald `comms <= 0`
(`Actions/Operation.ts:63-68`). Raid ist also nicht dauerhaft fahrbar,
sondern **endlich** - und Sector-12 hat nur **15 comms**.

    15 Raids x 97 Rang (55 x rewardFac 1,1^6) = 1.455 Rang
    Restweg 317.000  ->  Raid deckt davon 0,46 Prozent

Dazu die zweite Grenze: Raid hebt das Chaos um **1 bis 5 Prozent je Lauf**
(`Bladeburner.ts:843`, `changeChaosByPercentage`). Sector-12 steht bei 48,9
gegen `RAID_CHAOS_MAX = 50` - nach **einem** Raid ist die Schwelle gerissen,
und der Motor schaltet Raid selbst wieder ab.

**Was ich falsch gemacht habe:** Ich habe `ertragJeMinute` aus
`data/bbspann.json` genommen und daraus einen Hebel gemacht, ohne den Vorrat
zu pruefen. Die Zahl 794 in `offen` ist der Vorrat der OPERATION, nicht die
Zahl der Gemeinden - die steht nur im Spielstand unter `cities`. Eine
Ertragsrate ohne ihre Reichweite ist keine Entscheidungsgrundlage.

**Der Schalter bleibt trotzdem an.** 1.455 Rang sind kein Hebel, aber sie
sind auch nicht falsch: Raid ist waehrend seiner fuenfzehn Laeufe die beste
verfuegbare Aktion, und der Motor waehlt ohnehin nach Ertrag je Minute. Was
faellt, ist die Erwartung - nicht die Entscheidung.

**Der Trupp bleibt richtig und unberuehrt.** `(teamCount+1)^0,05` wirkt auf
Operationen UND Black Ops, unabhaengig von comms. +9,4 Prozent fuer
siebzehn Minuten steht.

Zu messen bleibt: Rangrate ueber 45 Minuten, `popEst` und Chaos - wie unten
beschrieben. Nach fuenfzehn Raids ist der Effekt vorbei.
**Drei Zahlen gehoeren zusammen geprueft, nicht nur die erste:**
  1. Rangrate ueber 45 Minuten - traegt der Hebel? Ziel > 60/min.
  2. `popEst` in Sector-12 - Raid senkt die Bevoelkerung prozentual, und die
     steckt in `getPopulationSuccessFactor = (pop/1e9)^0,7`. **Faellt sie
     unter 1e9, dreht der Hebel ins Minus**, weil der Faktor dann unter 1
     rutscht und JEDE Aktion ausser Black Ops schwaecher macht.
  3. Chaos - Raid hebt es prozentual. Ueber 50 greift die Diplomacy-Regel und
     frisst Arbeitszeit; ueber `RAID_CHAOS_MAX` schaltet sich Raid selbst ab.

Abbruchkriterium: Faellt popEst unter 1,0e9 oder steigt das Chaos ueber 55,
gehoert `RAID_AN` zurueck auf `false` - dann kostet der Hebel mehr, als er
bringt. Bleibt die Rangrate unter 45/min, war die bbspann-Zahl irrefuehrend.
Commit: siehe git log, blade.js 27.08. 19:54

### Reaper und Evasive System dynamisch, Deckel 16 und 17 (27.08., 15:53)

Engpass: **Zum dritten und vierten Mal an einem Tag dasselbe Muster** - eine
gedeckelte Faehigkeit mit besserem Nutzen je Punkt, waehrend Blade's Intuition
mit dem schlechtesten Wert alle Punkte bekommt.

Hypothese: Die competence steigt je Punkt um **0,059 (Reaper) und 0,047
(Evasive System)** statt um 0,031 - Faktor 1,9 beziehungsweise 1,5.

Beleg: `data/Skills.ts:54-72`. Beide heben nicht die Chance, sondern den
**effektiven Kampfwert**: Reaper 2 Prozent auf alle vier, Evasive System 4 auf
dex und agi. Der wirkt ueber
`competence += weights[stat] * effSkill^decays[stat]`
(`Actions/Action.ts:173`), bei Black Ops mit Gewicht 0,2 und Decay 0,8 je
Kampfwert - also gedaempft und abhaengig vom aktuellen Stand. Gerechnet auf
str 172, def 143, dex 325, agi 168:

    Short-Circuit     St.20   41,9 Punkte   0,0642 je Punkt
    Reaper            St. 9   18,8          0,0593
    Evasive System    St.13   27,2          0,0467
    Blade's Intuition St.26   55,5          0,0309   <- bekam alles

**Nebenbefund, der eine naheliegende Idee erledigt:** Die Kampfwerte stehen
sehr ungleich (dex 325 gegen def 143). Weil der Decay 0,8 fast linear ist,
braechte eine Gleichverteilung bei gleicher Summe nur **+0,8 Prozent** - es
lohnt nicht, gezielt den Tiefstand hochzuziehen, sobald er ueber der
Beitrittsschwelle liegt.

Vorher: Reaper **Stufe 8** (Deckel 8), Evasive System **Stufe 12** (Deckel 12),
Typhoon-Chance min **0,133** um 15:51
Nachher (gemessen 16:19 mit `node tools/spann.js`, 26 Minuten spaeter):
**Reaper Stufe 8 auf 9** - die Sortierung greift, der alte Deckel haette hier
gestoppt. **Evasive System steht unveraendert auf 12**, und das ist kein
Fehlschlag, sondern der Preis: 27 Punkte bei 16 verfuegbaren. Es ist die
teuerste der vier dynamischen Faehigkeiten und liegt im Nutzen je Punkt hinten
(0,0467 gegen 0,0593), also kommt es zuletzt dran - so soll die Sortierung
arbeiten. **Typhoon-Chance 0,133 auf 0,212**, und die Schaetzspanne ist dabei
ganz zugegangen (min = max). Der Deckel wird erst dann wieder zum Thema, wenn
Reaper die 16 erreicht.

**Offen bleibt der Vergleichsmassstab.** Short-Circuit stieg im selben Fenster
von 19 auf 21, Blade’s Intuition blieb auf 25 - die Punkte gehen also
ueberwiegend an Short-Circuit, nicht an Reaper. Ob die +0,079 Chance aus der
Umlenkung kommen oder schlicht aus den gestiegenen Kampfwerten, trennt diese
Messung nicht. Dafuer braeuchte es einen Lauf mit eingefrorenen Stufen.
Commit: siehe git log, blade.js 27.08. 15:53

### Short-Circuit-Deckel von 12 auf 30 (27.08., 13:19)

Engpass: Dieselbe Luecke wie bei Hyperdrive - die Faehigkeitspunkte gingen an
Blade's Intuition, waehrend eine billigere Faehigkeit gedeckelt danebenlag.

Hypothese: Die Erfolgschance aller Kill-Aktionen steigt von Multiplikator
**1,66 auf 2,65**, also um **59 Prozent**. Dieselben Punkte reichen bei
Blade's Intuition nur fuer +36 Prozent.

Beleg: `data/Skills.ts:21-28` - Short-Circuit, baseCost 2, costInc 2,1,
`SuccessChanceKill: 5,5`. Und `data/BlackOperations.ts:35`: **Typhoon ist
`isKill: true`** - genau wie Bounty Hunter und Retirement, die zwei Vertraege,
die der Motor faehrt. Die Faehigkeit trifft also alles, was zaehlt.

    Blade's Intuition St. 26   55,5 Punkte   +1,71 %   0,031 je Punkt
    Short-Circuit     St. 13   27,2 Punkte   +3,31 %   0,122
    Short-Circuit     St. 20   41,9 Punkte   +2,69 %   0,064
    Short-Circuit     St. 30   62,9 Punkte   +2,12 %   0,034   <- Schnittpunkt

Vorher: Short-Circuit **Stufe 12**, Typhoon-Chance min **0,125** um 13:17
Nachher: **BESTAETIGT um 15:51 - Stufe 19**, und die Chance steht bei min
**0,133** (max 0,186), obwohl zwischendurch ein Augmentierungs-Einbau alle
Kampfwerte auf 1 zurueckgesetzt hat. Blade's Intuition blieb dabei
unveraendert auf 25 - die dynamische Sortierung von 13:49 lenkt die Punkte
also nachweislich um.
Commit: ac7565c

**Struktureller Befund, der aus beiden Hebeln folgt:** Ein Faehigkeitsplan mit
**festen Deckeln veraltet zwangslaeufig.** Die Kosten steigen linear mit der
Stufe, der Nutzen je Punkt faellt - also wandert die beste Faehigkeit im Lauf
der Zeit. Zweimal heute lag eine deutlich bessere Option gedeckelt daneben,
waehrend die Infinity-Eintraege alles auffrassen. Der saubere Fix waere, den
Plan durch einen Vergleich des relativen Nutzens je Punkt zu ersetzen. Eingetragen
in `nodes/BAUSTELLEN.md`.

### Hyperdrive in den Faehigkeitsplan, Deckel 7 (27.08., 12:52)

Engpass: Die Kampfwerte tragen den Knotenausgang (`competence = Sum weights *
skill^0,9`), und ihre einzige Quelle ist die Erfahrung. Die Faehigkeitspunkte
gingen bisher vollstaendig an Blade's Intuition - die steht auf **Stufe 25**,
und die naechste kostet **56 Punkte** fuer +3 Prozent.

Hypothese: Die Chance steigt je investiertem Punkt um **1,45 statt 0,054
Prozent**, also Faktor 27 auf der ersten Stufe. Der Grund ist die
Erfahrungskurve: +10 Prozent Erfahrung geben ueber
`lvl = mult * (32*ln(exp+534,6) - 200)` genau **+3,05 Levelpunkte** auf alle
vier Kampfwerte, und zwar unabhaengig vom Niveau.

Beleg: `Bladeburner/data/Skills.ts:98-104` - Hyperdrive, baseCost **1**,
costInc 2,5, `ExpGain: 10`. Gegen Blade's Intuition (`:5-10`, baseCost 3,
costInc 2,1, `SuccessChanceAll: 3`). Nutzen je Punkt:

    Blade's Intuition Stufe 26    56 Punkte   +3,00 %   0,054 % je Punkt
    Hyperdrive Stufe 1             1 Punkt    +1,45 %   1,451
    Hyperdrive Stufe 3             6 Punkte   +1,22 %   0,203
    Hyperdrive Stufe 5            11 Punkte   +1,05 %   0,096
    Hyperdrive Stufe 7            16 Punkte   +0,92 %   0,058   <- Gleichstand
    Hyperdrive Stufe 8            18,5        +0,87 %   0,047   <- schlechter

Deckel 7 ist der Schnittpunkt. Die 59,5 Punkte fuer sieben Stufen bringen
Erfahrungsfaktor **1,7**; dieselben Punkte reichen bei Blade's Intuition fuer
genau EINE Stufe.

Vorher: **84 exp/min** (def, 12:10 gegen 12:40), Hyperdrive Stufe 0
Nachher: **BESTAETIGT um 13:10.** `kampfExp.def` stieg von 38.479 (12:40) auf
41.931 (13:10), also 115 exp/min im Fenster. Der Bonus wirkte aber erst ab
12:54 - rechnet man die ersten 14 Minuten mit der alten Rate heraus, bleiben
fuer die letzten 16 Minuten **142 exp/min, Faktor 1,69**. Erwartet waren 143
bei Stufe 7, die Abbruchschwelle lag bei 110. Um 13:17 stand Hyperdrive auf
**Stufe 7**, dem Deckel.
Commit: siehe git log, blade.js 27.08. 12:52

### Geprueft und verworfen: Gym statt Bladeburner-Arbeit (27.08., 09:56)

Engpass: **Die Kampfwerte, nicht der Rang.** Rang 3476 liegt laengst ueber den
2500 fuer Operation Typhoon; was fehlt, ist die Chance (Mitte 0,104 gegen
Schwelle 0,80), und die haengt an `competence = Sum weights * skill^0,9`.

Hypothese: Powerhouse Gym hat `expMult: 10` (`Locations/data/LocationsMetadata.ts:325`)
und `costMult: 20`. Bei 10,4 Mrd auf der Hand sind die Kosten irrelevant
(480 $/s, also 361.000 Minuten Vorrat). Wenn Gym die Kampfwerte schneller
hebt als Bladeburner-Arbeit, gehoert der Motor umgestellt.

Beleg, beide Seiten gerechnet statt geschaetzt:

- **Gym**: `Classes[GymType.defense].earnings = {defExp: 1}` je Zyklus,
  skaliert mit `expMult / gameCPS` (`Work/Formulas.ts:115-118`) und mit
  `person.mults`. Bei 5 Zyklen je Sekunde sind das **600 * mult exp/min**
  fuer **einen** Wert.
- **Bladeburner**, gemessen 09:04 gegen 09:52 aus `data/bblage.json`:
  str 39.467 -> 45.935, def 18.615 -> 25.083. Beide **+6.468 in 48 Minuten**,
  also **135 exp/min je Wert** - und zwar fuer **alle vier gleichzeitig**,
  in Summe 540.
- Der Multiplikator faellt aus den Daten selbst: `lvl = mult * (32*ln(exp+534,6) - 200)`
  gibt fuer str (196 / 45.935) und def (170 / 25.083) **beide Male 1,362**.
  Gym liefert damit 817 exp/min je Wert.

Der Vergleich ueber die 101 Minuten, die ORION-MKIV Shoulder noch entfernt ist:

    Bladeburner   +13.635 exp je Wert  ->  def 170 -> 188,7   (+18,7)
                  plus ORION-MKIV (str/def/dex x1,05)          (+8,5)
                  ------------------------------------------------
                                                        SUMME  +27,2

    Gym           25 min je Wert, +20.425 exp -> def 195,6     (+25,6)

**Bladeburner gewinnt** - knapp bei den Kampfwerten, und ohne dass Rang fuer
die spaeteren Black Ops und die weiteren Augmentierungen ueberhaupt gezaehlt
sind. Der Grund ist, dass Gym nur EINEN Wert traegt: je Wert ist es Faktor
4,4 besser, in der Summe nur Faktor 1,51 - und das kauft den Verlust von
8,7 Rang und 19 Reputation je Minute nicht auf.

**Die bestehende Auslegung ist also richtig**, und die Ausnahme stimmt auch:
Nach einem Einbau stehen alle Werte auf 1, Bladeburner-Aktionen scheitern,
und dort schlaegt der Faktor 4,4 je Wert voll durch - genau dafuer gibt es
`bbtrain.js`.

Vorher: keine Aenderung
Nachher: (keine Aenderung - dies ist die Absage an den Umbau auf Gym-Betrieb)
Commit: nur dieser Eintrag

### Black-Op-Schwelle von 0,99 auf 0,80 (27.08., 06:56)

Engpass: **Nicht der Rang - die Schwelle, ab der er benutzt wird.** Der Rang
steht um 06:51 bei 2477 und faellt in Minuten unter die 2500 von Operation
Typhoon. Danach entscheidet `SICHER_BLACKOP` in `blade.js`, ob die Black Op
ueberhaupt versucht wird. Sie stand auf **0,99** - nie gerechnet, nur
vorsichtig gesetzt. Bei 21 Black Ops mit steigender Schwierigkeit heisst das
unter Umstaenden: nie.

Hypothese: Sobald die Chance 0,80 erreicht, steigt die Rangrate von **2,0**
(Bounty Hunter, gemessen 22:45) auf **13,2** je Minute.

Beleg: `data/BlackOperations.ts:10-14` (baseDifficulty 2000, rankGain 50,
rankLoss 10, hpLoss 100), `Actions/Action.ts:105-120` (Dauer),
`Actions/BlackOperation.ts:50-52` (`getActionTimePenalty` 1,5),
`Hospital.ts:4-10` (Krankenhauskosten).

    statFac  = 0,5 * (161^0,04 + 209^0,035 + 161/1e4 + 209/1e4) = 1,234
    Dauer    = 2000/10 * 0,86 / 1,234 * 1,5 = 209 s = 3,49 min
    Ertrag/min = (chance*50 - (1-chance)*10) / 3,49

Der **Gleichstand mit Bounty Hunter liegt bei chance 0,283** - alles darueber
ist besser als weiterzufahren wie bisher. Gewaehlt wurde trotzdem 0,80, und
zwar wegen der Trefferpunkte: 100 Verlust gegen eine Hoechstgrenze um 23
heisst Krankenhaus bei JEDEM Fehlschlag, und das kostet `min(Geld * 0,1, ...)`
- bei 3,6 Milliarden also 360 Millionen je Versuch. Bei 0,80 ist jeder fuenfte
Versuch ein Fehlschlag statt jeder dritte.

Vorher: **Chance 0,062-0,075 um 06:10**, Schwelle 0,99 - die Black Op wurde
nie versucht, und bei 0,99 waere sie es womoeglich nie geworden.
Nachher: **UEBERHOLT am 27.08., 12:49 - die Begruendung war falsch.** Der Satz
"das kostet min(Geld * 0,1, ...) - bei 3,6 Milliarden also 360 Millionen" las
nur den ERSTEN Term des Minimums. Der zweite deckelt bei
`(hp.max - hp.current) * 100.000`, und mit `damage = hpLoss * difficultyMult
= 100 * (2000^0,28 + 2000/650) = 1.148` sind das **114,8 Millionen** - drei
Minuten Einkommen. Die Kosten haengen an der Schwierigkeit, nicht am
Kontostand. Schwelle steht seither auf **0,40**.
Commit: siehe git log, blade.js 27.08. 06:56

### Die Stillstandsuhr zaehlte ueber den Einbau hinweg (27.08., 04:00)

Engpass: Nicht der Bot, sondern der Pruefer. Vier Minuten nach dem
Augmentierungs-Einbau von 03:48 meldete er
**"STAGNATION: Kampfwert-Tiefstand steht seit 681 min auf 1"**, waehrend
`bbtrain` str gerade von 51 auf 75 hochtrainierte. Die Wache waere damit
unmittelbar nach dem Einbau in ihren Eingriffsmodus gegangen - im
ungeeignetsten Moment, denn dort arbeitet der Bot planmaessig.

Hypothese: Das Urteil kehrt von STAGNATION auf SPUR zurueck, und die
gemeldete Stillstandsdauer faellt von 681 auf unter 10 Minuten.

Beleg: `tools/strategie-check.js:537-556` verwirft den Verlauf, wenn ein
Traeger **faellt**. Beim Einbau faellt er aber nicht, er **wechselt** - von
"Bladeburner-Rang" auf "Kampfwert-Tiefstand". Dessen alte Punkte stammen aus
der vorigen Wiederaufbauphase (16:31 desselben Tages) und stehen dort
ebenfalls auf 1. Die Uhr zaehlte also von damals durch, quer ueber elf Stunden
Bladeburner-Arbeit hinweg.

Geaendert: Bei Phase "Wiederaufbau nach Einbau" wird der Verlauf am letzten
Phasenwechsel abgeschnitten. Die Punkte davor bleiben in der Datei - dort sind
sie Geschichte, nicht Messwert.

Vorher: **STAGNATION, 681 min** um 03:52
Nachher: **SPUR, 3 min** um 04:02 - unmittelbar verifiziert, dieselbe Lage.
Commit: siehe git log, strategie-check.js 27.08. 04:00

### Der Knotenausgang haengt an den Kampfwerten, nicht am Rang (27.08., 01:05)

Engpass: **Die Erfolgschance von Operation Typhoon steht seit zehn Stunden
still.** Gemessen 15:46 bei Rang 745: `min 0,035, max 0,042`. Gemessen 00:57
bei Rang **1528**: `min 0,035, max 0,038`. Der Rang hat sich verdoppelt, die
Kampfwerte sind von rund 115 auf 224 (dex) gestiegen - die Chance ist
unveraendert.

Beleg: `Actions/Action.ts:169-196`. Fuer Black Ops faellt alles weg, was sonst
hilft: `getPopulationSuccessFactor` gibt 1, `getChaosSuccessFactor` gibt 1
(`Actions/BlackOperation.ts:54-60`), und `getDifficulty` ist die **feste**
`baseDifficulty` 2000 (`data/BlackOperations.ts:10`) - Black Ops sind nicht
levelbar, es gibt keinen `difficultyFac`. Der **Rang geht ueberhaupt nicht in
die Chance ein**; er ist nur die Eintrittskarte (`reqdRank` 2500).

Was bleibt, ist die Kompetenz:

    competence = SUMME weights[stat] * effSkill[stat]^0,9
    chance     = competence / 2000

Mit den Gewichten von Typhoon (hacking 0,1; str/def/dex/agi je 0,2) und den
Werten von 00:57 ergibt das rund 92 roh, mit Blade's Intuition Stufe 10
(x1,30) und dem Intelligenzbonus rund 124 - also **0,062**, in derselben
Groessenordnung wie die gemessenen 0,037.

**Die Konsequenz ist unbequem und gehoert festgehalten:** Fuer eine Chance von
50 Prozent braucht es Faktor 13,5 in der Kompetenz. Weil die Werte mit
Exponent 0,9 eingehen, sind das **Faktor 19,6 in den Kampfwerten** - also dex
von 224 auf rund 4.400. Ueber Faehigkeiten allein ist das nicht zu holen:
Reaper gibt 2 Prozent je Stufe auf die effektiven Werte, Evasive System 4
Prozent auf dex und agi; selbst Stufe 50 in beiden braechte nur rund x3,5.

**Damit steht die Route des Knotens zur Ueberpruefung.** Rang 2500 ist in gut
zehn Stunden erreicht, die Kampfwerte fuer eine fahrbare Chance nicht. Was das
heisst - Gym-Training aus den 18,7 Milliarden, Augmentierungen, oder Typhoon
mit kleiner Chance wiederholt versuchen und die Rangverluste hinnehmen - ist
eine Abwaegung mit Zahlen und steht als eigener Punkt in BAUSTELLEN.md.

Vorher/Nachher: keine Aenderung. Dies ist der Befund, der die naechste
Entscheidung traegt.

### Geprueft und nichts geaendert: Raid, Cyber's Edge, Overclock (26.08., 21:55)

Engpass: Weiterhin die Ausdauer. Der Kammeranteil liegt bei 67 Prozent
(gemessen 21:45, siehe BAUSTELLEN.md), weil das Ruheband nur 3,4 Punkte breit
ist und die Regeneration 2,3 je Minute betraegt.

Vollstaendige Messung um 21:51 ueber `data/bbspann.js`, alle neun Aktionen:

    Aktion                  min   dauer  netto/min  aus/min  arbeit  zyklus
    Raid                  0,124     56s      4,980     2,36   0,901   4,486
    Bounty Hunter         0,480     32s      2,755     3,33   0,639   1,761  <- gefahren
    Tracking              0,953     18s      3,736     4,79   0,444   1,658
    Retirement            0,580     26s      2,829     3,79   0,561   1,588
    Undercover Operation  0,269     35s      1,527     3,16   0,673   1,028
    Investigation         0,328     28s      1,260     3,30   0,645   0,812

**Raid steht mit 4,486 wieder ganz oben - und bleibt trotzdem verworfen.**
Die Zahl ist die ROHE Zyklusrate ohne die Chaos-Gegenkraft. Raid erzeugt
+3,21 Prozent Chaos je Minute, Diplomacy baut bei Charisma 27 nur 1,187 ab
(siehe den Erledigt-Eintrag vom 17:20); der tragbare Raid-Anteil liegt damit
bei 27 Prozent, effektiv also **4,486 x 0,27 = 1,21** gegen 1,761 fuer Bounty
Hunter. Der Verwurf haelt auch mit den neuen Zahlen - **nachgerechnet, nicht
uebernommen.**

**Overclock ist nicht wirkungslos, sondern schaedlich** - der Kommentar in
`blade.js` untertreibt. Es kuerzt die Aktionsdauer um 1 Prozent je Stufe, und
weil der Ausdauerverlust JE AKTION anfaellt (`Bladeburner.ts:921`), steigt
`aus/min` im selben Mass. Bei Stufe 14 sind das rund 16 Prozent mehr
Verbrauch je Minute. Zurueckdrehen geht nicht, aber der letzte Platz im
Faehigkeitsplan ist damit doppelt begruendet.

**Cyber's Edge ueber Deckel 5 hinaus: gerechnet, verworfen.** Stufe 6 kostet
16 Punkte und hebt Hoechstausdauer und Regeneration um je 2 Prozent. Weil das
Band prozentual definiert ist, waechst die Arbeitsphase um 2 Prozent, die
Ruhephase bleibt gleich - Arbeitsanteil 0,3333 auf 0,3377, Zyklusrate 1,761
auf 1,784. Dieselben 16 Punkte in Tracer Stufe 8 geben +4 Prozent auf alle
Vertragschancen, also rund 1,83. **Der laufende Plan ist die bessere
Verwendung**, deshalb keine Aenderung.

Vorher/Nachher: keine Aenderung - dies ist die Absage an drei naheliegende
Griffe, damit sie niemand ein zweites Mal probiert.

### Faehigkeitsplan nach Nutzen je Punkt statt nach Rangliste (26.08., 18:52)

Engpass: **Die Erfolgschance, nicht der Vorrat.** Bounty Hunter lief mit 0,322
und dem Grund "Vertrag unter Schwelle, lohnt trotzdem"; gleichzeitig lagen 21
Faehigkeitspunkte eine Stunde lang ungenutzt herum (`data/blade.json`, Feld
`punkte`: 1 um 17:37, 11 um 18:07, 21 um 18:37).

Hypothese: Die Erfolgschance von Bounty Hunter steigt von **0,322** auf
mindestens **0,34**, wenn statt Blade's Intuition die billigen Stufe-0-
Faehigkeiten gekauft werden.

Beleg: Die Kosten sind **linear**, nicht exponentiell -
`(baseCost + level * costInc) * mult` (`Bladeburner/Skill.ts:37-41`). Damit
liefert Tracer auf Stufe 0 fuer 2 Punkte +4 Prozent auf alle Vertraege
(`data/Skills.ts`), Blade's Intuition auf Stufe 10 fuer 24 Punkte +3 Prozent
auf alles - **Faktor 16**. Der Gleichstand liegt bei
`m = (6 + 8,4n)/6,3`, fuer n=10 also Tracer-Stufe 14; daher die Deckel
Tracer 14, Short-Circuit 12, Evasive System 12, Reaper 8 vor Blade's
Intuition.

Vorher: Bounty-Hunter-Chance **0,322**, offene Punkte **21** um 18:37
Nachher: **BESTAETIGT um 19:37, deutlicher als erwartet.** Bei Tracer Stufe 4:

    Aktion           Chance 18:50 -> 19:37    Zyklusrate 18:50 -> 19:37
    Bounty Hunter    0,348 -> 0,394           0,971 -> 1,258   (+30%)
    Tracking         0,660 -> 0,771           0,904 -> 1,168   (+29%)
    Retirement       0,415 -> 0,487           0,893 -> 1,120   (+25%)

Erwartet war "ueber 1,10 bei Tracer Stufe 5" - erreicht sind 1,258 schon bei
Stufe 4, fuer insgesamt 20 Punkte. Blade's Intuition haette fuer dieselben 20
Punkte nicht einmal eine Stufe gebracht.

Der Gewinn ist breiter als gedacht, weil Tracer auf **alle** Vertraege wirkt
und der Motor ohnehin nur Vertraege faehrt. Die restlichen Deckel (Tracer bis
14, dann Short-Circuit 12, Evasive System 12, Reaper 8) stehen noch aus.
Commit: siehe git log, blade.js 26.08. 18:52

### Geprueft und verworfen: Team, Ausdauerschwelle, Punkterate (26.08., 15:57)

Kein Hebel in diesem Lauf. Drei Kandidaten am Quellcode geprueft, alle drei
tragen heute nicht - das steht hier, damit sie niemand ein zweites Mal aufruft.

**Bladeburner-Team.** `operationTeamSuccessBonus` ist
`(teamCount + 1)^0,05` (`Actions/Operation.ts:96-98`). Zwanzig Mann bringen
`21^0,05 = 1,164`, hundert Mann 1,259 - und der Bonus haengt **nur an
Operationen und Black Ops** (`Actions/Action.ts:124-126` gibt fuer alles andere
1 zurueck). Der Motor faehrt ausschliesslich Vertraege, also ist die Wirkung
derzeit **exakt null**. Rekrutierung kostet zwar keine Ausdauer, aber die
Erfolgschance ist `charisma^0,45 / (teamSize + 1)`
(`data/GeneralActions.ts:29-31`), und Charisma wurde in diesem Lauf nie
trainiert.
**Vermerk fuer spaeter:** Sobald Operationen oder Black Ops gefahren werden,
ist das Team Pflicht - dann sind es +16 Prozent auf die Erfolgschance, und
bei Raid schlaegt das wegen des Rangverlust-Terms als +25 Prozent auf den
Erwartungswert durch. `setTeamSize` wird von `blade.js` bisher nie aufgerufen,
`teamCount` steht also auf 0.

**Ausdauerschwelle senken.** Nachgerechnet mit den heutigen Zahlen
(V = 5,2 je Minute bei Tracking, R = 2,31, Maximum 79):

    Schwelle 51/56   Spanne 3,95   Arbeit 1,37 min   Ruhe 1,71   Anteil 44,5 %
    Schwelle 30/56   Spanne 20,5   Arbeit 7,10 min   Ruhe 8,90   Anteil 44,4 %

Der Anteil ist identisch - die Spanne ist symmetrisch, sie begrenzt Arbeit und
Ruhe gleichermassen. Unterhalb von 50 Prozent kaeme die Ausdauerstrafe dazu
(`min(1, stamina/(0,5*max))`, `Bladeburner.ts:167-169`), die den Ertrag der
laengeren Arbeitsphase auffrisst. **Damit ist die Verwerfung vom 08:14 zum
zweiten Mal bestaetigt, diesmal mit gemessenen statt geschaetzten Werten.**

**Punkterate getrennt heben.** Geht nicht: Faehigkeitspunkte fallen streng
linear aus dem Rang an - `RanksPerSkillPoint: 3` (`data/Constants.ts:47`),
ausgewertet in `Bladeburner.ts:1282-1289` gegen `maxRank`. Ein Punkt je drei
Rang, ohne Zwischengroesse, an der sich drehen liesse. Die Rueckkopplung ist
damit sauber: mehr Rang, mehr Punkte, bessere Faehigkeiten, mehr Rang - und
der einzige Angriffspunkt bleibt die Rangrate selbst.


### Diplomacy gegen Chaos ueber 50 (26.08., 15:26)

Engpass: Die Erfolgschancen. Sector-12 stand um 14:49 bei Chaos 53,89, und
`Actions/Action.ts:94-101` multipliziert oberhalb von 50 die SCHWIERIGKEIT mit
`sqrt(1 + (chaos - 50))`.

Hypothese: Faellt das Chaos unter 50, steigt die Tracking-Chance von 0,357 auf
mindestens 0,75, weil der Faktor `sqrt(4,89) = 2,21` auf exakt 1 zurueckfaellt.

Beleg: `Actions/Action.ts:94-101` (Schwellwert und Wurzelformel),
`Bladeburner.ts:735-743` und `:1185-1187` (Diplomacy senkt prozentual um
`charisma^0,045 + charisma/1000`), `data/GeneralActions.ts:37-44` (60 Sekunden,
keine Ausdauer).

Vorher: Tracking-Chance 0,357 um 14:49, Rangrate 0,625 je Minute.
Nachher: **Tracking-Chance 0,801 um 15:26** - Faktor 2,24 gegen den
vorhergesagten 2,21. Rangrate **1,361 je Minute** ueber die zwanzig Minuten bis
15:47, Kammeranteil 40 Prozent. Zehn Minuten Diplomacy waren dafuer noetig.

Commit: "blade: Diplomacy gegen Chaos ueber 50"

**Das war der groesste Einzelhebel des Tages** - und er lag seit gestern als
verworfener Nebensatz in einem Offen-Punkt, mit der Begruendung "Chaos unter
50 ist nutzlos". Die Begruendung stimmte, als sie geschrieben wurde. Die
Lehre: **Eine Verwerfung mit Bedingung muss die Bedingung mitpruefen.**


### Cyber's Edge vor Overclock im SKILL_PLAN (26.08., 12:22)

Engpass: Die Regeneration. Der Motor stand 62,9 Prozent der Zeit in der
Kammer und wartete auf Ausdauer.

Hypothese: Cyber's Edge hebt R um 2 Prozent je Stufe, weil
`getSkillMult(Stamina)` in BEIDEN Formeln steckt - `calculateMaxStamina`
(`Bladeburner.ts:1327-1343`) und `calculateStaminaGainPerSecond`
(`:1317-1325`). Die Ruhezeit `S/R` bleibt gleich, die Arbeitszeit `S/(V-R)`
waechst ueberproportional, weil V fest ist.

Mitgeprueft und dabei verworfen: **Overclock ist im Ausdauer-Engpass
wirkungslos.** Der Ausdauerverlust faellt je AKTION an (`Bladeburner.ts:921`),
eine um ein Prozent kuerzere Aktion heisst also auch ein Prozent mehr
Verbrauch je Minute. Nachgerechnet 0,4444 gegen 0,4445 - und es hatte bis
dahin 14 Stufen bekommen, rund 169 Punkte.

Vorher: R = 2,068 Ausdauer je Minute (53 Kammerphasen, 108 min),
Hoechstausdauer 70, Rangrate 0,649 je Minute, Kammeranteil 62,9 Prozent.
Nachher: **R = 2,313** (11 Phasen, 23 min) bei Cyber's Edge Stufe 5,
Hoechstausdauer 79. Das sind 11,8 Prozent - fuenf Stufen zu je zwei Prozent
plus das Agility-Wachstum.

Commit: "blade: Cyber's Edge vor Overclock, Deckel 5"

Die Rangrate stieg im selben Zeitraum von 0,649 auf 0,842. Der Anteil, der
auf Cyber's Edge entfaellt, ist damit **nicht sauber getrennt** - der
Krankenhaus-Hebel und die schwankenden Erfolgschancen liefen mit. Belastbar
ist nur die Regeneration selbst, und die ist die Groesse, auf die der Hebel
zielt.


### bbspann.js rechnete einen irrefuehrenden Ertrag (26.08., 13:05)

Engpass: Nicht der Bot, sondern das Messwerkzeug. Der falsche Ertrag hat um
12:55 einen Auftrag mit hoher Dringlichkeit erzeugt ("Operationen bringen das
Siebenfache"), der so nicht stimmt.

Zwei Fehler, die sich gegenseitig verstaerkten:
- **Levelfaktor fehlte.** `Bladeburner.ts:917` multipliziert den Ertrag mit
  `rewardFac^(level-1)`. Tracking steht auf Stufe 29 (1,041^28 = 3,07), alle
  Operationen auf Stufe 1. Verglichen wurde eine ausgereizte Aktion mit einer
  frischen.
- **Rangverlust fehlte.** Nur Operationen haben `rankLoss` (Operations.ts:20,
  54, 90, 125, 165, 203). Bei Chancen unter 0,2 dominiert dieser Term.

Beleg: `Bladeburner.ts:917` (Levelfaktor), `:975-978` (`changeRank` mit
negativem Vorzeichen bei Misserfolg), `data/Operations.ts` (rankLoss, hpLoss).

Gemessen 13:05 mit der korrigierten Rechnung - `netto` gegen `brutto`, wie es
vorher dastand:

    Aktion                 Stufe  Chance   netto/min   brutto/min
    Tracking                  29   0,700       2,425        0,787
    Retirement                16   0,434       1,828        0,711
    Bounty Hunter             12   0,363       1,783        0,727
    Raid                       1   0,103       3,669        6,071
    Undercover Operation       1   0,225       1,166        1,697
    Investigation              1   0,271       0,965        1,277
    Sting Operation            1   0,142       0,461        1,021
    Stealth Retirement         1   0,087       0,077        1,642
    Assassination              1   0,055      -0,772        1,408

**Drei Ergebnisse:**
1. **Assassination hat einen negativen Erwartungswert**, Stealth Retirement
   einen von praktisch null. Die alte Zahl wies beiden 1,4 bis 1,6 zu.
2. **Raid ist besser, aber um Faktor 1,5 statt 7.** Der Auftrag von 12:55
   bleibt bestehen, mit korrigierter Zahl.
3. **Der Levelfaktor ist der Grund, warum Vertraege mithalten.** Tracking
   bringt roh 0,3 Rang, effektiv 0,92. Das ist kein Argument gegen
   Operationen, sondern eines dafuer, eine davon HOCHZUSPIELEN - jede
   Operationsstufe zahlt 7 bis 14 Prozent, gegen 4,1 bei Tracking.

Vorher: kein Vergleichswert - die Zahl war vorher schlicht falsch.
Nachher: Die Datei fuehrt jetzt `gewinnEff`, `rangVerlust`, `hpJeMisserfolg`,
`ertragJeMinute` (netto) und `bruttoJeMinute` (die alte Zahl, zum Vergleich).
Commit: siehe unten.

**Keine Aenderung am Bot in diesem Lauf.** Der Hebel ist gerechnet und liegt
bei Raid, aber er haengt an einer ungeklaerten Frage: Raid nimmt 50
Trefferpunkte je Misserfolg (`data/Operations.ts:126`) bei einem Maximum von
25, also **Krankenhaus bei jedem einzelnen Fehlschlag** - und ob eine
Hospitalisierung die laufende Bladeburner-Aktion abbricht, ist nicht geprueft.
Das gehoert vor jede Aenderung an `SICHER_OPERATION`.


### Die Kammerzeit ist strukturell - gerechnet, keine Aenderung (26.08., 11:45)

**Ziel dieses Laufs war die Frage, ob gegen die 55 Prozent Kammerzeit
ueberhaupt ein Hebel existiert.** Antwort: kaum. Zum ersten Mal mit echten
Zahlen statt Schaetzungen, gemessen ueber 161 Abschnitte seit 09:15:

    Regenerationskammer     +2,04 Ausdauer je Minute
    Contracts/Tracking      -4,09 je Minute netto   (2,18 Rang/min)
    Contracts/Retirement    -2,50                   (1,71)
    Contracts/Bounty Hunter -2,17                   (1,60)

Daraus folgt der Kammeranteil zwingend, denn Arbeit und Ruhe teilen sich
dieselbe Spanne:

    Anteil = (1/R) / (1/V + 1/R)

    mit Tracking        66,7 %   ->  Zyklusrate 2,18 * 0,333 = 0,726 Rang/min
    mit Bounty Hunter   51,5 %   ->              1,60 * 0,485 = 0,776

Gemessen wurden 55 Prozent - die Mischung passt.

**Zwei Ergebnisse:**

1. **Bounty Hunter ist tatsaechlich besser, aber nur um sieben Prozent** -
   nicht um die 44, die die Rechnung von 09:46 ergab. Der Unterschied
   verschwindet im Rauschen, und genau deshalb war in der Messung von
   09:57-10:14 nichts davon zu sehen. Die Umstellung bleibt zurueckgedreht;
   sieben Prozent rechtfertigen die zusaetzliche Verwicklung nicht.

2. **Die Kammerzeit laesst sich mit der Aktionsauswahl allein nicht unter
   etwa 50 Prozent druecken.** Selbst die sparsamste Aktion verbraucht mehr
   als das Doppelte dessen, was die Kammer nachliefert. Eine Aktion mit
   Verbrauch nahe 2,04 gaebe zwar wenig Kammerzeit, braechte aber auch
   entsprechend wenig Rang.

**Was den Knoten wirklich beschleunigen wuerde, haengt an
Faehigkeitspunkten** - hoehere Regeneration (Cyber's Edge), hoehere
Erfolgschancen (Blade's Intuition, Tracer), kuerzere Aktionen (Overclock).
Alle drei Multiplikatoren kosten Punkte, und die kommen aus Rangaufstiegen.
Gemessen 10:45: **null Punkte.** Der eigentliche Engpass ist damit nicht die
Kammerzeit, sondern dass nichts da ist, um die Multiplikatoren zu heben.

Vorher: 0,707 Rang je Minute, 55,9 Prozent Kammerzeit (10:49-11:15)
Nachher: (keine Aenderung - dies ist die Absage an weitere Versuche in diese
Richtung)
Commit: siehe git log, HEBEL.md 26.08. 11:45

### Incite Violence, wenn der beste Vertrag leergespielt ist (26.08., 10:49)

Engpass: **Der Vorrat, nicht die Auswahl.** Gemessen 10:45: Tracking hat noch
1,0 offene Auftraege (von ueber 200), seine Chance ist von 0,74 auf 0,525
gefallen. Bounty Hunter und Retirement liegen bei 0,273 und 0,324 - beide
unter der Sicherheitsschwelle von 0,45. Die Rangrate ist deshalb von 0,926 auf
0,60 je Minute eingebrochen.

Hypothese: `Incite Violence` fuellt ALLE Vertraege und Operationen auf einen
Schlag - es rechnet 180 Wachstumsschritte gut (`Bladeburner.ts:1219-1225`,
`60 * 3 * growthFunction()`). Es dauert 60 Sekunden und kostet **keine
Ausdauer** (`data/GeneralActions.ts:52-58`), was gerade dann zaehlt, wenn die
Ausdauer der Engpass ist. Erwartung: Die Rate kehrt auf **ueber 0,9** zurueck.

Die Rechnung: Eine Minute Incite kostet den Ertrag des Notvertrags (Bounty
Hunter, 0,567 Rang je Minute). Danach ist Tracking mit 2,2 wieder da - der
Verlust ist nach gut dreissig Sekunden eingespielt.

**Chaos geprueft, bevor es zum Problem wird:** Incite hebt das Chaos jeder
Stadt um 10 plus `chaos/log10(chaos)`. Erst ueber **50** macht Chaos die
Aktionen schwerer (`ChaosThreshold`, `Actions/Action.ts:94-101`); Sector-12
steht bei 13. Ein Durchlauf bringt es auf etwa 35, ein zweiter darueber -
deshalb greift der Block nur unter Chaos 25.

Damit ist auch der zweite Teil des alten Baustellenpunkts entschieden:
**Diplomacy braucht es vorerst nicht.** Es senkt Chaos, und Chaos schadet
unterhalb von 50 gar nicht.

Vorher: 0,602 Rang je Minute, Tracking-Vorrat 1,0 (10:16-10:44)
Nachher: **Nie ausgeloest - und heute waere er schaedlich (26.08., 18:55).**
Gemessen: Tracking-Vorrat **1,52** (von ueber 200), Chaos in Sector-12
**48,78**. Der Block greift nur unter Chaos 25, ist also gesperrt - genau in
der Lage, fuer die er gebaut wurde.

**Die Sperre ist richtig, aber der Hebel taugt heute ohnehin nichts.** Incite
wuerde Tracking auffuellen, und Tracking hat eine Zyklusrate von **0,904** -
schlechter als der gerade gefahrene Bounty Hunter mit **0,971** (587 offene
Auftraege, kein Vorratsproblem). Der Vorrat ist seit dem Einbau von 16:31
nicht mehr der Engpass; die Erfolgschance ist es.

Dazu kaeme der Schaden: Incite hebt das Chaos um 10 plus `chaos/log10(chaos)`,
von 48,78 aus also ueber 60. Ueber der Schwelle 50 werden alle Aktionen mit
`sqrt(1 + chaos - 50)` schwerer - der Block wuerde die Chancen halbieren, um
einen Vertrag aufzufuellen, den niemand fahren will.

**Der Block bleibt stehen** (er kostet nichts und greift in einem Knoten mit
niedrigem Chaos wieder), aber er zaehlt nicht mehr als offener Hebel.
Commit: siehe git log, blade.js 26.08. 10:49

### Auswahl nach Rang je Ausdauer, selbstkalibrierend (26.08., 09:57)

Engpass: 55 Prozent Kammerzeit, allein wegen Ausdauer. Die Minuten sind
reichlich da, die Ausdauer ist knapp - also zaehlt Rang je AUSDAUERPUNKT.

Hypothese und Rechnung stehen im Eintrag von 09:46: Ueber den vollen Zyklus
aus Arbeit und Ruhe gewinnt Bounty Hunter (0,989 Rang je Ausdauer) gegen
Tracking (0,533) um **Faktor 1,44**, obwohl Tracking bei Rang je Minute vorne
liegt. Erwartung: Die Rangrate steigt von **0,926 auf mindestens 1,15** je
Minute.

Umgesetzt **selbstkalibrierend**, nicht als Tabelle: `blade.js` liest alle
fuenf Minuten die juengsten dreihundert Abschnitte aus `data/aktionen.txt` -
derselben Datei, die es selbst fuellt - und rechnet daraus den Verbrauch je
Aktion. Damit passt sich die Auswahl an steigende Aktionslevel an, statt auf
den Zahlen von heute stehen zu bleiben. Aktionen mit weniger als fuenf
Abschnitten bekommen den Durchschnitt der uebrigen als Schaetzwert.

**Zwei Einheitenfehler in einem Lauf, beide selbst verursacht und behoben:**
1. 09:54: Ungemessene Aktionen fielen auf "Rang je Minute" zurueck - eine
   voellig andere Skala (0,77 gegen 0,19). Der Rueckfall gewann dadurch immer,
   und der Motor fuhr prompt Retirement, die einzige Aktion ohne Messwert.
   Behoben durch den Durchschnitts-Schaetzwert.
2. 09:55: Der Notvertrag-Zweig vergleicht gegen Field Analysis, und General-
   Aktionen kosten gar keine Ausdauer - der Vergleich geht nur ueber die Zeit.
   Der Motor landete auf Field Analysis mit 0,2 Rang je Minute. Behoben:
   `beste()` fuehrt jetzt BEIDE Zahlen mit, `ertrag` fuer die Auswahl und
   `proMinute` fuer den Vergleich mit General-Aktionen.

Wer die Bewertungsgroesse aendert, muss JEDEN Vergleich mitziehen, in dem sie
vorkommt. Das ist die Lehre.

Beleg: `Bladeburner.ts:921` (Ausdauerverlust je Aktion), `1317-1325`
(Regeneration), eigene Messung ueber 295 Abschnitte.

Vorher: 0,926 Rang je Minute, 55,5 Prozent Kammerzeit (09:19-09:45)
Nachher: **WIDERLEGT, zurueckgedreht um 10:15.**

    vorher (09:19-09:45)   55,5 % Kammer   0,926 Rang/min
    danach (09:57-10:14)   62,3 % Kammer   0,606 Rang/min

Erwartet waren mindestens 1,15. Gemessen ist ein Drittel WENIGER - und selbst
auf siebzehn Minuten Messstrecke ist das kein Rauschen mehr.

**Was die Rechnung uebersehen hat:** Bounty Hunter liegt mit 44 Prozent
Erfolgschance UNTER der Sicherheitsschwelle und lief nur ueber den
Notvertrag-Zweig. Mehr als die Haelfte der Versuche schlaegt fehl, und jeder
Fehlschlag kostet die volle Ausdauer bei null Rang. Die Kennzahl "Rang je
Ausdauer" aus `ratencheck.js` enthaelt diese Fehlschlaege zwar, aber der
Zyklus rechnet sich dadurch anders als angenommen: Die Ausdauer ist schneller
weg, ohne dass die kuerzere Arbeitsphase das ausgleicht.

Zurueckgedreht wurde NUR das Auswahlkriterium - ausgewaehlt wird wieder nach
Rang je Minute. **Die Messung bleibt** (`kostenAktualisieren` in blade.js):
Sie kostet nichts, liefert weiter Daten, und die naechste Hypothese kann
darauf aufbauen, statt bei null anzufangen.

**KORREKTUR 10:50 - die Widerlegung war selbst falsch.** Nach dem
Zurueckdrehen gemessen:

    mit neuer Auswahl (09:57-10:14)   62,3 % Kammer   0,606 Rang/min
    zurueckgedreht    (10:16-10:44)   55,7 % Kammer   0,602 Rang/min

**Die Rate blieb unten.** Die Auswahl war also nicht die Ursache - sie war
unschuldig. Gefunden 10:45 ueber `data/bbspann.json`:

    Tracking        Chance 0,525 (war 0,74)   offen  1,0   <- leergespielt
    Bounty Hunter   Chance 0,273 (war 0,44)   offen  487
    Retirement      Chance 0,324 (war 0,45)   offen  359

Der **Vorrat des besten Vertrags war erschoepft**, und der Motor fiel auf
Aktionen zurueck, deren Erfolgschance unter der Sicherheitsschwelle liegt.
Genau in dieses Loch fiel die Messung der neuen Auswahl.

Die Aenderung bleibt trotzdem zurueckgedreht: Sie ist damit weder belegt noch
widerlegt, und ohne Beleg faehrt der Motor die einfachere Regel. Wer sie
erneut probiert, braucht eine Strecke mit gefuellten Vorraeten.

Drei Lehren, alle teuer bezahlt:
1. Wer die Bewertungsgroesse aendert, muss JEDEN Vergleich mitziehen, in dem
   sie vorkommt (zwei Einheitenfehler in einem Lauf, siehe oben).
2. Eine Zyklusrechnung auf dem Papier ersetzt keine Messung. Der Faktor 1,44
   war sauber hergeleitet und trotzdem falsch.
3. **Eine Widerlegung braucht dieselbe Sorgfalt wie eine Bestaetigung.** Ich
   habe eine Aenderung fuer schuldig erklaert, ohne zu pruefen, ob die Zahl
   nach dem Zurueckdrehen wieder steigt. Sie tat es nicht.
Commit: siehe git log, blade.js 26.08. 09:57

### Die Auswahl misst die falsche Groesse - gerechnet, noch nicht umgesetzt (26.08., 09:46)

Engpass: 55 Prozent Kammerzeit, allein wegen Ausdauer. Wenn die Ausdauer der
Engpass ist, zaehlt **Rang je Ausdauerpunkt**, nicht Rang je Minute - und die
Auswahl in `blade.js` optimiert bis heute Letzteres.

Gemessen 09:45 ueber 295 Abschnitte (`tools/ratencheck.js`):

    Aktion                   Rang/min   Rang/Ausdauer   Ausdauer/Lauf   s/Lauf
    Contracts/Tracking          2,180           0,533            1,17       26
    Contracts/Bounty Hunter     1,710           0,989            1,78       48

**Die beiden Kennzahlen widersprechen sich.** Tracking ist in der Arbeitszeit
schneller, Bounty Hunter je Ausdauerpunkt fast doppelt so ergiebig.

Ueber den vollen Zyklus aus Arbeit UND Ruhe gerechnet, mit Budget B (die
Hysteresespanne) und 1,2 Ausdauer je Minute passiver Regeneration, in der
Kammer verdoppelt:

    Bounty Hunter   Verbrauch 2,22/min, netto 1,02  ->  Zyklus 1,397 B, Rang 0,989 B  =  0,708 Rang/min
    Tracking        Verbrauch 2,70/min, netto 1,50  ->  Zyklus 1,084 B, Rang 0,533 B  =  0,492 Rang/min

**Bounty Hunter gewinnt ueber den vollen Zyklus um Faktor 1,44**, obwohl die
bisherige Kennzahl Tracking vorne sieht. Die Absolutwerte des Modells passen
nicht exakt zur Messung (0,708 gegen gemessene 0,93 ueber alles) - das
Verhaeltnis ist die belastbare Aussage, nicht die Zahl.

**Bewusst NICHT in diesem Lauf umgesetzt.** Die saubere Loesung ist
selbstkalibrierend: `blade.js` liest den gemessenen Verbrauch je Aktion aus
`data/aktionen.txt` und waehlt danach. Eine hartkodierte Tabelle aus dreissig
Minuten Messung waere genau der Fehler, gegen den `tools/ratencheck.js`
ueberhaupt gebaut wurde - und Retirement fehlt in der Messung noch ganz.

Ausserdem korrigiert: Der erste Lauf um 09:18 meldete "Tracking 99,8 Rang je
Ausdauer". Diese Zahl war falsch - der Zaehler stammte aus allen Abschnitten,
der Nenner nur aus denen mit Ausdauermessung. Nach der Korrektur sind es 0,533,
und die Rangfolge kehrt sich um.

Vorher: 0,926 Rang je Minute, 55,5 Prozent Kammerzeit (09:19)
Nachher: (keine Aenderung - dies ist die Rechnung, die der Aenderung vorausgeht)
Commit: siehe git log, ratencheck.js 26.08. 09:45

### Ausdauer-Ruhespanne von 52/60 auf 51/56 Prozent (26.08., 07:46)

Engpass: Nach dem Krankenhaus-Hebel ist die Ausdauer der letzte Grund, aus dem
der Motor ruht - gemessen **33,5 Prozent der Zeit** (07:15).

Hypothese: Die Haelfte davon ist geschenkt. Die Spanne von 52 auf 60 Prozent
sind acht Prozent der Hoechstausdauer, bei 64 also gut fuenf Punkte; die
Regeneration betraegt rund 1,2 je Minute (`Bladeburner.ts:1317-1325`), macht
vier Minuten Ruhe je Zyklus. Die Strafe beginnt aber erst UNTER 50 Prozent
(`min(1, stamina/(0,5*max))`, `Bladeburner.ts:167-169`) - alles zwischen 50
und 100 ist gleich gut. 51 auf 56 haelt denselben Abstand zur Strafgrenze und
halbiert die Ruhezeit. Erwartung: Kammeranteil von 33,5 auf unter 25 Prozent,
Rangrate rund ein Zehntel hoeher.

Beleg: `Bladeburner.ts:167-169` (die Strafe und ihre Grenze), `1317-1325`
(Regeneration), `1327-1343` (Hoechstausdauer).

**Geprueft und fuer jetzt verworfen: die Faehigkeit "Cyber's Edge."** Sie hebt
die Hoechstausdauer um 2 Prozent je Stufe (`Skills.ts:84-89`) - und weil
`getSkillMult(Stamina)` in BEIDEN Formeln steckt, auch die Regeneration. Der
Ruheanteil sinkt dadurch tatsaechlich, aber nur schwach: Bei gleicher
prozentualer Steigerung von Reserve und Regeneration bleibt die Ruhezeit
gleich, waehrend die Arbeitsphase mitwaechst. Drei Stufen kosten 1+3+9 = 13
Punkte (baseCost 1, costInc 3) und braechten rund sechs Prozent laengere
Arbeitsphasen, also gut zwei Prozent Rate - dieselbe Groessenordnung wie eine
Stufe Overclock fuer zehn Punkte. Kein klarer Gewinner, deshalb keine
Aenderung am Faehigkeitsplan ohne Messung.

Vorher: 50,1 Prozent Kammerzeit, 0,888 Rang je Minute (06:55-07:46, 49 min)
Nachher: **Die Hypothese ist widerlegt.** Gemessen 08:14 ueber 26 Minuten:

    seit 07:46   26,3 min | Kammer 16,0 min = 60,7 % | 0,941 Rang/min

Die Kammerzeit ist nicht gefallen, sondern **gestiegen** - von 50,1 auf 60,7
Prozent. Die Rangrate liegt mit 0,941 gegen 0,888 leicht darueber, aber das
ist bei 26 Minuten Messstrecke nicht von Rauschen zu unterscheiden.

**Der Denkfehler, und er ist lehrreich:** Die Spanne ist SYMMETRISCH. Sie
begrenzt nicht nur, wie lange geruht wird, sondern auch, wie lange gearbeitet
werden darf - von 56 Prozent hinunter auf 51 statt von 60 auf 52. Beide
Phasen schrumpfen um denselben Anteil, das Verhaeltnis bleibt gleich, und
zusaetzlich steigt der Umschalt-Overhead: acht Kammerabschnitte in 26 Minuten
statt weniger, laengerer.

Nicht zurueckgenommen, weil die ZIELGROESSE - die Rangrate - nicht gefallen
ist. Aber der behauptete Mechanismus tritt nicht ein, und der Eintrag bleibt
als Warnung stehen: An der Hysteresespanne zu drehen bringt nichts. Wer die
Ausdauerruhe verkuerzen will, muss an den Verbrauch (leichtere Aktionen) oder
an die Regeneration heran.
Commit: siehe git log, blade.js 26.08. 07:46

### Krankenhaus statt Regenerationskammer (26.08., 06:55)

Engpass: **Der Motor stand 161 von 222 Minuten - 72,5 Prozent - in der
Regenerationskammer** (`tools/ratencheck.js`, 06:47). Die Arbeitszeit bringt
1,4 bis 2,0 Rang je Minute, ueber alles blieben **0,475**. Das ist der
groesste Einzelhebel des Knotens; bei Rang 331 von 2.500 entscheidet er ueber
Tage.

Der Ruhegrund waren fast immer die Trefferpunkte, nicht die Ausdauer. Kein
Wunder: Das Maximum ist `floor(10 + defense/10)` = 23 (`Person.ts:97`), und
die Kammer heilt **2 je Durchlauf** (`Bladeburner.ts:1198`). Von 11 auf 17
sind das drei Durchlaeufe.

Verworfen, bevor es umgesetzt wurde: **mehr Trefferpunkte durch hoeheres
Trainingsziel.** Bei doppeltem Maximum verdoppelt sich die Arbeitsspanne, aber
die Heilung bleibt bei 2 je Durchlauf - die Ruhezeit verdoppelt sich mit. Der
ANTEIL bleibt gleich, und das Training selbst kostet Stunden ohne Rang.

Hypothese: `ns.singularity.hospitalize()` setzt `hp.current` in EINEM Aufruf
auf das Maximum (`PlayerObjectGeneralMethods.ts:281-290`). Es kostet Geld und
sonst nichts - keine Zeit, keine Aktionsunterbrechung; auf das Ereignis hoert
nur die Infiltration (`Infiltration.ts:83`). Kosten:
`min(Guthaben * 0,1, fehlendeHP * 100.000)` (`Hospital.ts:4-10`), bei zwoelf
fehlenden Punkten also 1,2 Millionen gegen ein Guthaben von 7,5 Milliarden.

Erwartung: Die Kammerzeit faellt von 72,5 auf unter 25 Prozent (es bleibt nur
noch die Ausdauer-Ruhe), die Rangrate steigt von **0,475 auf mindestens 1,3**
je Minute.

Untergrenze eingebaut: Unter zehn Millionen Guthaben bleibt die Kammer. Nach
einem Augmentierungs-Einbau zaehlt jeder Euro fuer Server und Programme, und
der Deckel `Guthaben * 0,1` waere dort ein schlechter Tausch.

Vorher: 0,475 Rang je Minute, 72,5 Prozent Kammerzeit (06:47)
Nachher: **1,118 Rang je Minute, 33,5 Prozent Kammerzeit** - gemessen 07:15
ueber die 18 Minuten seit der Aenderung, gegen 229 Minuten davor:

    bis 06:55   229,0 min gesamt, 166,0 in der Kammer (72,5 %)  ->  0,484/min
    ab  06:55    18,1 min gesamt,   6,1 in der Kammer (33,5 %)  ->  1,118/min

**Faktor 2,3 - diese Zahl war zu guenstig.** Nachgemessen 07:47 ueber die
volle Strecke 06:55 bis 07:46 (49 Minuten statt 18):

    06:55-07:46   49,0 min | Kammer 50,1 % | 0,888 Rang/min

Der Hebel bringt also **72,5 auf 50,1 Prozent** und **0,484 auf 0,888** -
Faktor 1,8, nicht 2,3. Die ersten achtzehn Minuten waren ein zu guenstiger
Ausschnitt; wer auf so kurzer Strecke misst, misst Rauschen mit. Die
Erwartung von 1,3 ist damit klar verfehlt, das Ziel von unter 25 Prozent
Kammerzeit ebenso.

Was uebrig bleibt, ist ein ANDERER Engpass: Die verbliebenen 33,5 Prozent sind
Ausdauer-Ruhe, nicht Trefferpunkte. Die Ausdauer regeneriert passiv rund 1,2
je Minute (`Bladeburner.ts:1382`), die Kammer verdoppelt das nur - gegen sie
hilft kein Krankenhaus. Das ist der naechste Hebel, nicht dieser.
Commit: siehe git log, blade.js 26.08. 06:55

### Notvertrag statt Field Analysis (26.08., 00:55)

Engpass: Der Motor stand zweieinhalb Stunden auf `General/Field Analysis` und
kam auf **0,22 Rang je Minute** (Rang 143 um 22:43, 171 um 00:51 - 28 in 128
Minuten). Field Analysis gibt rankGain 0,1, also rund 0,2 je Minute; die
Messung trifft den Wert exakt.

Hypothese: Der Rueckfall ist falsch bemessen. Gemessen 00:52 ueber
`data/bbspann.json`:

    Bounty Hunter   0,381 Chance · 0,9 Rang · 21 s  ->  0,98 Rang/min
    Retirement      0,386        · 0,6      · 21 s  ->  0,70
    Field Analysis  --           · 0,1      · 30 s  ->  0,20

Beide Vertraege lagen knapp unter der Sicherheitsschwelle von 0,45 - und
brachten trotzdem das Drei- bis Fuenffache von Field Analysis. Die Schwelle
vergleicht die Chance mit einer festen Zahl, statt den Ertrag mit der
Alternative. Bei Vertraegen ist ein Misserfolg billig: etwas Ausdauer, etwas
Chaos, kein Rangverlust und kein Toter. Erwartung: mindestens 0,9 statt 0,22.

Beleg: rankGain in `reference/bitburner-src/src/Bladeburner/data/Contracts.ts`
(19, 53, 86) und `data/GeneralActions.ts`; Dauern ueber
`ns.bladeburner.getActionTime`.

Umgesetzt: Faellt kein Vertrag ueber die Schwelle, wird trotzdem der
ertragsstaerkste genommen, sofern er das Anderthalbfache von Field Analysis
bringt. Operationen (Teamverluste) und Black Ops (Tod) behalten ihre
Sicherheitsschwellen unangetastet.

Vorher: 0,22 Rang je Minute (22:43 bis 00:51)
Nachher: **gegriffen, aber selten.** In `data/aktionen.txt` steht bis 06:51
genau EIN Abschnitt mit dem Grund "Vertrag unter Schwelle, lohnt trotzdem" -
der Fall tritt nur ein, wenn gleichzeitig alle Vorraete knapp und alle Chancen
unter 0,45 sind. Der Wert des Hebels liegt darin, dass die Alternative
(Field Analysis mit 0,2 je Minute) nie wieder gewaehlt wird; als Dauerzustand
war er nie gedacht. Nicht zurueckgenommen.

**Naechster Kandidat, bewusst nicht in diesem Lauf:** Auch oberhalb der
Schwelle waehlt der Motor nicht optimal. Um 01:00 fuhr er Tracking (0,78 Rang
je Minute), waehrend Bounty Hunter 0,98 gebracht haette - der lag nur unter
der Schwelle. Konsequent waere, bei VERTRAEGEN ganz auf die Sicherheitsschwelle
zu verzichten und rein nach Ertrag zu waehlen, mit einer harten Untergrenze
gegen Unsinn. Erst messen, was der jetzige Schritt bringt.

Commit: siehe git log, blade.js 26.08. 00:55

### Aktionsauswahl nach Rangertrag je Minute statt nach Erfolgschance (25.08., 21:57)

Engpass: Der Bladeburner-Rang. Bei 129 von 2.500 fuer die erste Black Op und
0,84 Rang je Minute sind das noch **47 Stunden** - das ist die Zahl, an der
dieser Knoten haengt.

Hypothese: Der Motor fuhr die **schlechteste** Aktion der ganzen Liste.
Gemessen 21:56 ueber `data/bbspann.json`, sortiert nach Ertrag je Minute:

    Raid                          0,094 Chance ·   55 Rang ·  62 s  ->  5,00
    Stealth Retirement Operation  0,077        ·   22      ·  77 s  ->  1,32
    Undercover Operation          0,191        ·  4,4      ·  39 s  ->  1,29
    Bounty Hunter                 0,457        ·  0,9      ·  21 s  ->  1,18
    Assassination                 0,049        ·   44      · 116 s  ->  1,11
    Tracking                      0,734        ·  0,3      ·  13 s  ->  1,02
    Investigation                 0,230        ·  2,2      ·  31 s  ->  0,98
    Sting Operation               0,122        ·  5,5      ·  51 s  ->  0,79
    Retirement                    0,449        ·  0,6      ·  21 s  ->  0,77   <- gefahren

Bounty Hunter und Retirement sind gleich lang und praktisch gleich sicher,
aber der eine bringt die Haelfte mehr. Die alte Regel waehlte nach `s.min`
allein und nahm deshalb Retirement, sobald dessen Schaetzung einen Hauch
hoeher lag. Erwartung: Die Rangrate steigt von 0,84 auf mindestens 1,1 je
Minute.

Beleg: rankGain in `reference/bitburner-src/src/Bladeburner/data/`
(Contracts.ts:19, 53, 86 · Operations.ts:19, 53, 89, 124, 164, 202), Dauern
ueber `ns.bladeburner.getActionTime`.

Bewusst NICHT geaendert: die Schwelle fuer Operationen (`SICHER_OPERATION`
0,85). Raid steht mit 5,0 Rang je Minute weit oben, aber bei 9,4 Prozent
Erfolg sind das ueber neunzig Prozent Fehlschlaege - jeder kostet Ausdauer und
Trefferpunkte und erhoeht das Chaos der Stadt, was wiederum alle Chancen
senkt. Das gehoert durchgerechnet, nicht ueberstuerzt.

Vorher: 0,84 Rang je Minute (21:19 bis 21:51, Rang 102 -> 129)
Nachher: **nicht sauber messbar.** Um 22:01 kam ein Augmentierungs-Einbau
dazwischen, danach lag der Motor bis 00:51 bei 0,22 Rang je Minute - aber aus
einem anderen Grund (siehe den Eintrag darueber: Field Analysis statt
Vertraege). Die Auswahl nach Ertrag ist davon unberuehrt richtig; nachzumessen
ist sie erst auf einer Strecke ohne Einbau.
Commit: f5b7f07

### Ausdauer-Hysterese von 55/90 auf 52/60 Prozent (25.08., 20:02)

Engpass: Der Bot verbrachte den Grossteil seiner Zeit in der
Regenerationskammer statt in Vertraegen. Im Messverlauf steht der Rang
zwischen 19:40 und 19:59 unveraendert bei 73, Aktion durchgehend
`General/Hyperbolic Regeneration Chamber`, Ausdauer 29 von 53.

Hypothese: Die Ruhe war ohne Wirkung. Die Ausdauerstrafe ist
`min(1, stamina / (0,5 * maxStamina))` und wirkt an genau einer Stelle:
`competence *= inst.calculateStaminaPenalty()`. Oberhalb von 50 Prozent ist
sie exakt 1 — der Bot ruhte ab 55 Prozent, wo er noch volle Leistung hatte,
und ruhte dann bis 90, was ihm nichts brachte. Erwartung: Der Anteil der
Arbeitszeit steigt von rund 40 auf ueber 80 Prozent, der Rangzuwachs
entsprechend.

Beleg: `reference/bitburner-src/src/Bladeburner/Bladeburner.ts:167-169` (die
Strafe), `Actions/Action.ts:176` (ihre einzige Verwendung),
`Bladeburner.ts:1382` (Ausdauer regeneriert passiv weiter, auch waehrend der
Arbeit — die Kammer verdoppelt das nur).

Mitgeaendert, weil sonst ein neues Problem entstuende: Die Kammer heilte
nebenbei 2 HP je Durchlauf (`Bladeburner.ts:1198`). Bei kurzer Ruhe faellt das
weg, also ruht der Bot jetzt zusaetzlich unter 50 Prozent Trefferpunkten und
arbeitet ab 95 Prozent weiter.

Vorher: Rang 73, unveraendert ueber 19 Minuten Kammer (19:40-19:59)
Nachher: 20:02 sofort nach dem Neustart `Contracts/Tracking` bei Ausdauer
41/53 (77 Prozent) — unter der alten Regel haette er weitergeruht.

**Nachgemessen 21:51:** Auf der einzigen sauberen Strecke (21:19 bis 21:51,
nach dem Neuladen, ohne Drosselung, ohne Engine-Stillstand) stieg der Rang von
102 auf 129 — **0,84 je Minute**. Eine belastbare Vorher-Zahl gibt es nicht:
Alle Strecken davor sind durch die Tab-Drosselung oder den Engine-Ausfall
verunreinigt. Der Hebel bleibt damit **plausibel, aber nicht sauber belegt**.
Zurueckgenommen wird er nicht - die Begruendung haengt am Quellcode, nicht an
der Messung: Oberhalb von 50 Prozent Ausdauer ist die Strafe exakt 1.

Nachtrag zur HP-Schwelle: 0,95 war unerreichbar und hielt den Motor in der
Kammer fest; seit 20:47 steht sie auf 0,75.
Commit: (siehe git log, blade.js 25.08.)
