# Skeptiker A1-A3: Substanz (Geld, RAM, Rechnung) - 02.09.2026, 18:18-18:45

Grundlage: `git diff` (uncommitted), Spielstand ueber die Bruecke (`getSaveFile`,
nur gelesen, 18:29), `data/bn4net-log.txt` von 18:13-18:16, Spielquellcode
`reference/v301/src`. Alle Zahlen als Python nachgerechnet
(`scratchpad/substanz-rechnung.py`, `scratchpad/kaltstart-crime.py`).

## Eichung (bevor mit den Formeln argumentiert wird)

| Formel | Quelle | Nachgerechnet | Live |
|---|---|---|---|
| `cost(r) = r * 55000 * 5 * 1.1^max(0, log2 r - 6)`, Ausbau = cost(neu) - cost(alt) | ServerPurchases.ts:23-53, BitNode.tsx:855-856 | 128->256 **46.5m**, 256->512 **102.2m**, 512->1024 **224.9m**, 1024->2048 **494.7m** | Log 18:14: 46.5m / 102.2m / 224.9m / 494.7m - exakt |
| `level = floor(0.4 * 1.2616 * (32 ln(exp+534.6) - 200))` | formulas/skill.ts, BN10 StrengthLevelMultiplier 0.4, Spieler-Mults 1.2616 | str-exp 74581.6 -> **80**, dex-exp 71760.6 -> **79** | Spielstand: 80 / 79 |
| Gym-Rate Spieler = 1 * (10/5) * 5 * 1.2616 | Formulas.ts:108-120, Powerhouse expMult 10, costMult 20 | **12.616 exp/s**, **480 $/Zyklus = 2400 $/s** | currentWork: 755 Zyklen -> 1905.0 dex-exp, -362.400 $ = 2.523/Zyklus, 480 $/Zyklus |
| Sleeve-Level mit Mult 0.4 (eigene Mults 1) | Sleeve exp 94040.8 | **66** | Spielstand: 66 |
| Sleeve-Gym an Spieler = 10 * sync 0.25 | Work.ts:17-25 | **2.5 exp/s je Sleeve** | - |
| Nachholbetrieb: je Engine-Tick (200 ms) `min(stored, 15)` Zyklen | Sleeve.ts:263-275 | 75 Zyklen/s = **15x**; 10 h Rueckstand (180.000 Zyklen) in **40 min** | Audit: 73.000 $/s gemessen = 2*15*2400+2400 |

Alle vier Eichpunkte stimmen. Mit diesen Formeln ist unten gerechnet.

---

### 1. A3 kuriert 2,7 von 13,5 Stunden - die anderen 10 sind die Sleeves, die im Kaltstart gar nicht laufen
Schwere: HOCH
Beleg: Prestige.ts:247-251 (home nach Knotenwechsel 32 GB bei SF1), bn4net.js:643-666 (bn4net 16,25 GB, 15,75 frei), sleeve.js braucht ~28 GB (9 verschiedene ns-Funktionen a 4 GB: getSleeve, getTask, setToBladeburnerAction, setToCommitCrime, setToGymWorkout, getActionCountRemaining + getPlayer/getResetInfo/scp + 1,6 Basis) - passt im Kaltstart nirgends; PlayerObjectGeneralMethods.ts:145-155 (Sleeves nach dem Sprung: Skill 1, shock 25, sync 25, Aufgabe ShockRecovery = Leerlauf); Simulation `kaltstart-crime.py`.
Was passiert: Der Faktor 1,0 statt 1,25 senkt die Schwelle fuer den 32-GB-Rechner von 11,0 auf 8,8 Mio. Aus "13,5 h bis 11 Mio" folgt eine Rate von 226 $/s, also **10,8 h statt 13,5 h** - gewonnen sind 2,7 Stunden. In denselben 10,8 Stunden stehen zwei Sleeves still, weil kein Sleeve-Skript in 15,75 GB passt. Ein Sleeve auf Verbrechen (Skill 1, shock 25, mit Aufstieg gerechnet) bringt bei wachem Tab:

    Stunde   Mug kumuliert   Shoplift kumuliert   (je Sleeve, CrimeMoney 0,5)
      1         1,4 m            3,6 m
      2         5,2 m           13,0 m
      3        10,7 m           23,7 m
     12       111,7 m          131,2 m

Zwei Sleeves auf Shoplift erreichen die 8,8 Mio nach **~1,3 h**, auf Mug nach **~2,2 h** - gegen 10,8 h mit dem Faktor allein. Ein Minimalskript (`setToCommitCrime` 4 GB + 1,6 Basis = **5,6 GB**, genau die Bauform aus dem sleeve.js-Dateikopf) passt in die 15,75 GB, auch neben dem jetzt residenten boot.js (4 GB, B3).
Vorbehalt: Bei gedrosseltem Tab (wakelock.js 34 GB passt im Kaltstart ebenfalls nicht) laeuft die Sleeve-Arbeit auf 5 % und holt erst beim Aufwachen mit 15x nach - dieselbe Einschraenkung gilt fuer die 13,5-h-Messung.
Fix: Eigenes `sleevecrime.js` (nur `setToCommitCrime`, 5,6 GB) in die WERKZEUGE-Liste, das bn4net im Kaltstart auf home startet und das sich beendet, sobald sleeve.js laeuft (Pruefung ueber `ns.ps` kostet 0,2 GB). Shoplift bis Skill ~40, dann Mug (siehe Befund 4). A3 selbst ist richtig, nur klein.

### 2. A2 Geldboden zaehlt vier Koerper, wo zwei zahlen - Schwelle 2,1-fach zu hoch
Schwere: MITTEL
Beleg: sleeve.js:352-353 (`koerper = MAX + 1` = 4; MAX ist die Schleifengrenze, nicht die Anzahl - im Spielstand sind es 2 Sleeves); engine.tsx:280-282 (`Player.processWork(numCyclesOffline)` beim Laden, ClassWork.tsx:105-110 + WorkStats.ts:64-82: `gainMoney(-480 * cycles)` ohne Deckel).
Was passiert: Der Spieler hat KEINEN 15x-Nachholbetrieb. Seine gesamte Offline-Gymrechnung wird beim Laden in einem Schritt abgebucht (10 h = 86,4 Mio), bevor irgendein Skript einen Tick bekommt - kein Geldboden in sleeve.js kann das verhindern, und darum gehoert er nicht in die Formel. Nachgerechnet:

    offline   Schwelle im Code   echter Bedarf (2 Sleeves)   Spieler-Klumpen (schon weg)
     4,2 h       165,7 m               72,6 m                     36,3 m
    10,0 h       366,2 m              172,8 m                     86,4 m
    24,0 h       850,0 m              414,7 m                    207,4 m

Im Fenster 173-366 Mio nach einer 10-h-Nacht schickt der Bot beide Sleeves fuer 40 min auf Mug statt ins Gym. Was das kostet und bringt (Mug-Chance der Sleeves heute 1,0 bei 66/68/64/64): Mug im Nachholbetrieb **+67.500 $/s je Sleeve**, 9.000 Mugs = **+162 Mio je Sleeve**, 27.000 Sleeve-Exp je Stat (6.750 beim Spieler); Gym im Nachholbetrieb -86,4 Mio je Sleeve, 360.000 Exp auf EINEM Stat (90.000 beim Spieler). Der Spieler braucht bis Stufe 100 ~179.000 Exp je Stat; das Fenster kostet ihn also 2 x 83.000 Exp = **~3,7 h Torfortschritt je Nacht** und bringt +324 Mio statt -173 Mio. Kein Dauerlock: Nach 40 min ist der Rueckstand aufgebraucht, die Schwelle faellt auf 20,6 Mio (`2400*60*4+20e6`), das Gym laeuft wieder. Nebenpunkt: Der `TAKT/1000`-Term (60 s) rechnet mit 1x, im Nachholbetrieb kostet ein Takt Latenz aber 15 x 60 x 2400 = 2,16 Mio je Sleeve - die 20-Mio-Reserve deckt das, der Term ist Kosmetik.
Fix: `koerper` = Zahl der tatsaechlich vorhandenen Sleeves (der Index, bei dem `getSleeve` wirft, steht ohnehin fest), ohne `+1`. Wer das Fenster bewusst auf Mug lassen will (der Geldschwung ist real), soll es so kommentieren - dann ist es Absicht, nicht Rechenfehler.

### 3. A1 greift nur bei vollem Park - in der Aufbauphase gilt weiter die 4x-Leiter ohne Blick auf das wartende Werkzeug
Schwere: MITTEL
Beleg: bn4net.js:640-697 (`if (eigene.length < getServerLimit()) { Leiter } else { A1 + Amortisation }`); A1 steht im else-Zweig.
Was passiert: Nach jedem Knotenwechsel ist der Park leer (BN10: 15 Plaetze). Solange er nicht voll ist, kauft die Leiter die groesste Stufe, die das VIERFACHE ihres Preises unter dem Konto hat; `werkzeugWartetGb` wird dort nicht gelesen. bbtrain.js (94,75 GB, das Tor-Werkzeug) braucht einen 128-GB-Wirt: ueber die Leiter 4 x 35,2 = **140,8 Mio** auf einmal; ueber A1 (32 -> 128 = 26,4 Mio, Regel 2x) **52,8 Mio** - aber A1 kommt erst dran, wenn 15 Rechner stehen, bei 32-GB-Stufen also nach 15 x 35,2 = 528 Mio Leiterkaeufen. Mit dem Kaltstart-Einkommen aus Befund 1 (1-10 Mio/h) sind das Stunden bis Tage Unterschied je Lauf. Der 26-h-Stillstand von heute war ein voller Park; die Aufbauphase hat dieselbe Luecke mit anderem Vorzeichen.
Fix: Den A1-Block vor die if/else-Weiche ziehen (er braucht nur `eigene`, `maxGb`, `reserviert`) und ihn bei nicht vollem Park zusaetzlich als Kauf zulassen: wenn kein eigener Rechner das Werkzeug fassen kann, die kleinste Stufe >= noetig zum Preis x2 kaufen statt x4.

### 4. Mug als Armuts-Rueckfall ist bei frischen Sleeves das schlechtere Geld
Schwere: NIEDRIG
Beleg: sleeve.js:363 (`was = (keinGym || !gymGeldReicht) ? "Mug" : VERBRECHEN`); Crime.ts:120-136, Crimes.ts:6-63; Simulation oben.
Was passiert: Die Chance haengt an den Sleeve-Skills. Heute (66/68/64/64) ist Mug 1,0 und mit 4.500 $/s um 20 % besser als Shoplift (3.750). Nach einem Knotenwechsel (Skill 1) ist Mug 0,021 und Shoplift 0,042: in Stunde 1 bringt Shoplift 2,5-mal so viel, ueber 12 h noch 17 % mehr; Mug hebt dafuer alle vier Stats (47 nach 12 h), Shoplift nur dex/agi. Kreuzungspunkt fuers Geld: Skill ~40. Nach einem Augmentierungs-EINBAU passiert dagegen nichts - Prestige.ts nullt Sleeves nicht, nur der Knotenwechsel (`sleeve.prestige()`), und `Sleeve.installAugmentation` betrifft Sleeve-Augs.
Fix: `getSleeve(i).skills` liegt fuer `storedCycles` ohnehin vor: `min(str,def,dex,agi) < 40 ? "Shoplift" : "Mug"`.

### 5. Telemetrie-Label "arm" ist tot
Schwere: NIEDRIG
Beleg: sleeve.js:354 setzt `was = "arm"`, :363 ueberschreibt es mit `"Mug"`.
Was passiert: sleeve.json zeigt fuer "Mug wegen Geld" und "Mug wegen Hackingknoten" dasselbe. Beim naechsten Check-in ist nicht erkennbar, ob der Geldboden gegriffen hat - genau der Fall, den man nach einer Nacht sehen will.
Fix: `stand.push({ ..., grund: keinGym ? "hackingweg" : (!gymGeldReicht ? "arm" : "") })`.

### 6. A1-Praemisse im Kommentar stimmt nicht - der Kreis war das veraltete bn4rep.json, nicht die Amortisation
Schwere: NIEDRIG
Beleg: bn4net.js:835-853 (`wartend = 99`, wenn bn4rep.json aelter als 5 min -> Deckel 600 s); Log 18:14:11 "128 -> 256 GB ... amortisiert in 627 s".
Was passiert: 627 s > 600 s. Solange bn4rep nicht lief, war sein JSON alt, der Deckel stand auf 600 s, und schon die billigste Stufe fiel durch - bn4rep passte nirgends, also blieb das JSON alt: ein Kreis. Zehn Sekunden nachdem A1 bn4rep gestartet hatte, war das JSON frisch (Deckel 1800 s) und die Schleife gab in 60 Sekunden ~4,5 Mrd fuer 14 Rechner aus (Konto 5 Mrd -> 854 Mio; `reserviert` war 0, weil noch keine Augmentierung ihre Reputation hat). A1 ist als Kreisbrecher richtig; der Kommentar "die Schleife haette nie 1024 GB erreicht" beschreibt aber die falsche Ursache, und A1s Zusage "halbes Guthaben bleibt" ist im selben Durchlauf von der Schleife dahinter aufgebraucht worden. Nicht falsch (das Geld faellt beim Einbau ohnehin auf 1000), aber wer spaeter nach dem Geld fuer die 38-Mio-Augmentierung sucht, findet es hier.
Fix: Kommentar korrigieren (Ursache: `wartend = 99` bei fehlendem bn4rep). Optional: nach einem A1-Ausbau die Amortisationsschleife in derselben Runde ueberspringen (`continue` nach dem Kauf), damit bn4rep seine erste Bedarfsmeldung schreiben kann, bevor die Schleife kauft.

---

## Tragfaehig (geprueft, haelt)

- **A1 heute:** noetig = 846,8 + ~40 + 4 = 890,8 -> zielGb 1024 (512 < 890,8 <= 1024), Kosten 224,9 m, Bedingung 449,8 m <= 5 Mrd frei. Log bestaetigt: "werk-10: 512 -> 1024 GB fuer 224.9m", bn4rep.js laeuft 0 s spaeter auf werk-10 (der Ausweichwirt nimmt den Rechner mit dem meisten Platz; die Werkbank-Reserve behindert den Start nicht).
- **A1 Scope:** `reserviert` (const, :637, gleiche Rundenebene vor der Weiche), `WORKER` (:237, main), `maxGb` (:730, vor dem Block), `runde`, `sag` - alles definiert.
- **A1 "passt nie":** getRamLimit in BN10 = 2^19 = 524.288 GB (1048576 * 0,5, auf Zweierpotenz gerundet); auch BN12 (dec = 1/1,02^lvl) bleibt bei 2^19. Ein Werkzeug > 512 TB gibt es nicht. Hypothetischer Fall: zielGb bleibt bei maxGb, `zielGb > groesster.gb` ist falsch, kein weiterer Kauf, kein Log (nur "passt nie" aus 2c alle 10 Runden). Keine Endlosschleife ueber andere Rechner: es wird immer nur der GROESSTE angefasst, und der ist dann am Deckel.
- **A1 Veraltung:** `werkzeugWartetGb` wird jede Runde im `if (werkbank)`-Block genullt (:2742) und in 2c neu gesetzt; A1 liest in 1a2 den Wert der Vorrunde (10 s alt). Werkbank null bedeutet keinen Rechner >= 20 GB, also `eigene.length === 0`, also A1 inaktiv - kein Weg, auf dem ein alter Wert kauft. Ein Neustart von bn4net setzt die Modulvariable zurueck.
- **A1 in anderen Knoten** (512 -> 1024 / 1024 -> 2048): BN4 68 m / 164 m, BN2 198 m / 515 m, BN6/7 676 m / 2,7 Mrd, BN8 12,6 Mrd / 101 Mrd. In BN8 heisst A1 "warten auf 25 Mrd" mit einer Logzeile alle 10 min - kein Fehlverhalten, nur langsam. Nebenbefund: der Kommentar bn4net.js:2870 ("Ausbau auf 1024 GB kostet 897,6 Milliarden" in BN6) ist um Faktor 1000 daneben - 256 -> 1024 kostet dort 845 Millionen (Softcap 2, CloudServerCost 1).
- **A2 Einheiten:** storedCycles/5 = Sekunden Rueckstand (5 Zyklen/s), 2400 $/s je Koerper, 15x aus `min(stored, 15)` je 200-ms-Tick. Stimmt. Sperrt nicht dauerhaft: der Rueckstand wird auch als Mug in 40 min abgebaut (wacher Tab), danach Schwelle 20,6 Mio. Bei gedrosseltem Tab waechst der Rueckstand (300 Zyklen je Wake, 15 verbraucht) und die Schwelle mit ihm (~33 Mio je gedrosselter Stunde) - die Sleeves arbeiten dort ohnehin nur 5 %.
- **A2 platz (Simulation mit echten Mults, 60-s-Takt, stabile Sortierung wie JS):**

        online ab heute (80/80/79/110)   alt 8,52 h   neu 8,60 h   (+5 min, 1 %)
        online ab 79/79/79               alt 8,75 h   neu 8,83 h
        10 h offline ab heute            alt: nach dem Laden 80/80/116/110, noch 5,65 h
                                         neu: nach dem Laden 93/93/111/110, noch 3,32 h  (-2,3 h)
        10 h offline ab 79/79/79         alt noch 5,83 h   neu noch 3,53 h

  Online kostet die Verteilung 5 Minuten (wenn nur noch ein Stat unter 100 ist, trainieren die Sleeves Stats ueber 100), jede Nacht bringt sie 2,3 Stunden. Richtig gebaut. Der Spieler-Klumpen selbst (450.000 Exp auf einem Stat, 86 Mio) bleibt - dagegen hilft nur, vor einer Nacht nicht im Gym zu stehen, und das weiss niemand vorher.
- **A3 Reihenfolge:** 1a (Leiter, :640) laeuft vor 2b1 (darkweb, :2715) in derselben Runde. Nach einem Knotenwechsel passt darkweb.js (27,65 GB) nicht in 15,75 GB frei - der Rechner MUSS zuerst kommen; danach TOR (200k) und BruteSSH (500k) bei 226 $/s nach 52 min, darkweb.js versucht es alle 5 min und kauft zeilenweise, was bezahlbar ist. Nach einem Einbau bleibt home-RAM erhalten (1024 GB), darkweb.js laeuft dann auf home vor jedem Rechnerkauf. `reserviert` im Kaltstart: boot.js:73-77 loescht data/geldbedarf.txt bedingungslos. Kein Puffer noetig.
- **joinrun 5 Mio / bbtrain 5 Mio:** Gleiche Schwelle, beide stoppen bzw. warten darunter - kein Gegeneinander mehr (das gab es vorher: joinrun ohne Boden startete neu, was bbtrain gestoppt hatte). Was bleibt, ist ein Zweipunktregler ohne Hysterese: bei Einkommen < 2400 $/s laeuft das Gym mit Tastverhaeltnis Einkommen/2400 um die 5 Mio herum, Neustarts kosten bei Kursarbeit nichts (Exp je Zyklus, kein Fortschrittsverlust, `singularity: true` unterdrueckt den Dialog; ClassWork hat keinen Fokus-Malus - `focusPenalty` wird nur in Company/Crime/Faction/CreateProgram/Grafting benutzt). Einzige Nebenwirkung: joinrun schreibt jede Minute "Konto unter 5 Mio" in data/joinrun.txt.
- **Karma:** Mug im Nachholbetrieb -0,0625 je Erfolg (0,25 x sync 0,25), 10-h-Rueckstand = -560; Konto steht bei -2209, Slum Snakes verlangt -9. Unkritisch.

## Nicht geprueft

- B1-B4 (anderer Winkel). Die Neustarts von sleeve/bbtrain/blade/ausgang um 18:14-18:15 im Log kamen aus dem WERKZEUG-Reload-Pfad, nicht aus B1.
- Der exakte Wert von `belegtOhneArbeiter` auf werk-10 um 18:14:01 (Prozessliste nicht erhalten); fuer das Ergebnis 1024 ist jeder Wert zwischen 0 und 173 GB gleich.
- Ob der Tab waehrend der 13,5-h-Messung wach war (bestimmt, ob die Sleeve-Rechnung in Befund 1 mit 1x oder 5 % laeuft).
- Der Home-RAM-Pfad im Kaltstart (homeram.js 30,4 GB; 32 -> 128 GB kostet in BN10 rund 63 Mio) als dritter Weg fuer bbtrain neben Leiter und A1.
- Das Rennen zwischen bn4reps erstem bn4rep.json (Deckel 1800 s) und seinem ersten geldbedarf.txt innerhalb einer bn4net-Runde (Befund 6, optionaler Teil).
