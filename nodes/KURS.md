# Kurs

**Die Leitgröße, aus dem Quellcode hergeleitet.** Der Optimierloop liest den
obersten Eintrag und richtet sich danach; alle anderen Loops arbeiten darauf
zu. Geschrieben wird hier nur vom Kursloop (`loops/loop-kurs.md`, alle 12 h).

**Warum die Datei existiert:** Bis zum 27.08.2026 bekam der Optimierloop seine
Leitgröße im Prompt vorgeschrieben und las zur Bestätigung `nodes/HEBEL.md` —
wo derselbe Satz stand. Er las als Quelle seine eigene Ausgabe. Die Größe war
zufällig richtig, wurde aber nie hergeleitet und deshalb auch nie
durchgerechnet: Optimiert wurde auf den nächsten Meilenstein statt auf den
Ausgang. Diese Datei bricht den Kreis, indem sie nur aus
`reference/bitburner-src/` gespeist wird.

**Wie man einen Eintrag herleitet**, wenn der Kursloop nicht gelaufen ist:

1. `NetscriptFunctions/Singularity.ts`, `destroyW0r1dD43m0n` — was genau muss
   erfüllt sein? Es gibt meist **mehrere** Wege; alle durchrechnen.
2. `BitNode/BitNode.tsx` — die Multiplikatoren des Knotens. Sie entscheiden,
   welcher Weg überhaupt in Frage kommt.
3. Den Engpass **absolut** beziffern (X von Y), und abziehen, was unterwegs
   ohnehin anfällt.
4. Prüfen, ob die Rate sich selbst beschleunigt — eine lineare Fortschreibung
   ist fast immer falsch.

---

## 28.08., 07:15 - BitNode 6

Ausgangsbedingung: **21 Black Operations.** `destroyW0r1dD43m0n` prueft
                   `numBlackOpsComplete >= numberOfBlackOperations`
                   (`NetscriptFunctions/Singularity.ts:1154-1158`); die letzte
                   (Daedalus) verlangt `reqdRank` **400.000**
                   (`Bladeburner/data/BlackOperations.ts:708`).
                   Der zweite Weg - Hacking >= `wd.requiredHackingSkill`
                   (6.000) MIT `hasAdminRights` - bleibt verworfen: bei
                   `HackingLevelMultiplier` 0,35 verlangt
                   `level = floor(mult*(32*ln(exp)-200))` ein `exp` von e^184.

Engpass:           Bladeburner-Rang. **80.706 von 400.000 = 20,2 %.**
                   Aussagekraeftiger ist der Anteil an der ARBEIT, weil die
                   Black Ops sich selbst mitfinanzieren: Von den 400.000 kommen
                   **73.660** aus den `rankGain`-Werten der ersten zwanzig
                   Operationen, es bleiben also **326.340** aus gewoehnlichen
                   Aktionen. Davon sind 79.796 verdient - **24,5 %.**

Restweg:           **246.544 netto.** 400.000 minus 80.706 Rang minus die
                   **72.750**, die die Black Ops 8 bis 20 unterwegs noch selbst
                   einbringen (aus der Tabelle erzeugt, nicht geschaetzt).

Rate:              **226,5 Rang je Minute**, geglaettet ueber **229 Minuten**
                   (`data/verlauf-strategie.json`, 03:25-07:14, 28.876 auf
                   80.706). Das Fenster schliesst den Augmentierungs-Einbau von
                   05:53 samt Wiederaufbau **ein** - genau deshalb ist es das
                   richtige. Zum Vergleich, dieselbe Reihe:

                       229 min   226,5/min   (mit Einbau)
                       132 min   224,6/min   (mit Einbau)
                        41 min    34,5/min   (nur Wiederaufbau)
                       Nacht     442,0/min   (nur Spitzenphase)

                   **Eine Rate ohne Einbaupause ueberschaetzt den Fortschritt
                   um Faktor 8.** Die 442 der Nacht sind keine Reisegeschwindig-
                   keit, sondern eine Momentaufnahme zwischen zwei Einbauten.

ETA:               **13,3-18,1 h**, Mitte rund **15,4** (a = 0,6 / 0,44 / 0).
                   Vorlauf: **71-148 h**, Mitte 104. **Faktor 6,7 besser.**

                   Die Selbstbeschleunigung ist belegt, aber sie ist nicht
                   allein Rueckkopplung: 32,75/min bei Rang 9.083 gegen
                   442/min bei 51.000 waere a = 1,51 - das ist zu steil, weil
                   in dieser Zeit vier bewusste Hebel eingebaut wurden
                   (Assassination als Rangfahrzeug, Overclock, Chaos-
                   Folgekosten, Cyber's Edge). a = 0 bis 0,6 ist die
                   ehrliche Spanne.

Leitgroesse:       **Bladeburner-Rang je Minute, gemessen ueber mindestens
                   45 Minuten und EINSCHLIESSLICH der Wiederaufbaupausen nach
                   einem Einbau.** Der Zusatz ist neu und er ist der Kern
                   dieses Laufs: Wer nur die Spitzenphase misst, optimiert
                   gegen eine Zahl, die achtmal zu gross ist - und uebersieht
                   damit genau den Posten, der gerade der groesste ist.

Entscheidung:      **Weiterfahren.** Der Kurs stimmt, die ETA ist von 104 auf
                   15,4 Stunden gefallen. Kein Zwischenschritt noetig: Die
                   Augmentierungsrunde, die der Eintrag vom 27.08. vorbereiten
                   wollte, ist zweimal gelaufen (01:25 mit 25 Stueck, 05:53),
                   und der Bot loest sie selbst aus.

                   Der einzige verbliebene Bremsklotz ist die Wiederaufbau-
                   phase nach jedem Einbau. Sie wird mit jedem Einbau laenger,
                   weil die AKTIONSSTUFE ihn ueberlebt und die Kampfwerte
                   nicht - Assassination steht auf Stufe 20 und verlangt Werte,
                   die der Wiederaufbau erst wieder erreichen muss. Das ist
                   bereits als Hebel adressiert (07:00, Gym laeuft jetzt
                   parallel weiter), gehoert aber dauerhaft in die ETA.

Naechste Pruefung: Liegt die 45-Minuten-Rate wieder ueber 220/min, also ist der
                   Wiederaufbau vorbei? Faellt Operation Red Dragon (Nr. 8 von
                   21, `reqdRank` 25.000 laengst erfuellt, Chance zuletzt
                   0,780-1,000)? Und ist die ETA erneut gesunken - zweimal
                   steigend hiesse, der Knoten wird falsch gefahren.

---

## 27.08., 19:22 - BitNode 6

Ausgangsbedingung: **21 Black Operations**, die letzte (Daedalus) verlangt Rang
                   **400.000** (`Bladeburner/data/BlackOperations.ts`,
                   Freigabe über `destroyW0r1dD43m0n`,
                   `NetscriptFunctions/Singularity.ts:1148-1160`).
                   Der zweite Weg — Hacking ≥ 6.000
                   (`requiredHackingSkill 3000` × `WorldDaemonDifficulty 2`) —
                   ist **geprüft und verworfen**: bei
                   `HackingLevelMultiplier 0,35` verlangt
                   `level = floor(mult·(32·ln(exp) − 200))` ein `exp` von
                   e^184. Dazu 35 statt 30 Augmentierungen für Daedalus.

Engpass:           Bladeburner-Rang. **9.083 von 400.000 = 2,3 %**
                   (Stand 19:10). Nicht die Erfolgschance — der Rang für
                   Typhoon ist um Faktor 3,6 übererfüllt.

Restweg:           **317.257 netto.** Die ersten zwanzig Black Ops liefern
                   zusammen 73.660 Rang aus ihren eigenen `rankGain`-Werten;
                   die zählen mit und wurden vorher doppelt gerechnet.

Rate:              **32,75 Rang je Minute**, geglättet über 45 Minuten
                   (`data/wache-zustand.json`, 18:26–19:11). Über den ganzen
                   Knoten gemittelt waren es 2,3 — Faktor 14 Anstieg.

ETA:               **71–148 h**, Mitte rund 104 (a = 0,3 / 0,44 / 0,6).
                   | Vorlauf: (erster Eintrag)
                   Die Rate beschleunigt sich selbst: `skillPoints =
                   floor(maxRank/3)` bei linear steigenden Fähigkeitskosten
                   (`Bladeburner/Skill.ts:37-41`) heißt Stufe ~ √Rang, also
                   `dR/dt ~ R^a`. Eine lineare Fortschreibung (a = 0) ergäbe
                   443 h und ist durch die eigene Messreihe widerlegt.

Leitgröße:         **Bladeburner-Rang je Minute.** Jeder Hebel, der sie hebt,
                   zahlt direkt auf die 317.257 ein. Die Black-Op-Chance ist
                   ausdrücklich **nicht** die Leitgröße — sie ist über weite
                   Strecken unkritisch, weil der Rang der Engpass ist.
                   **Zweitgrößte:** Geld je Minute, weil es die
                   Augmentierungsrunde finanziert (siehe Entscheidung).

Entscheidung:      **Zwischenschritt vorbereiten: eine Augmentierungsrunde.**
                   In BitNode 6 überlebt der Bladeburner-Fortschritt einen
                   Einbau fast vollständig — `Prestige.ts:153-154` ruft
                   `Bladeburner.prestigeAugmentation()`
                   (`Bladeburner.ts:259-263`), und das macht **nur**
                   `resetAction()` + `joinFaction()`. Rang, `skillPoints`,
                   Fähigkeits- und Aktionsstufen bleiben stehen; es fallen
                   allein die Kampfwerte. Die kommen mit besseren
                   Multiplikatoren um **Faktor 17** schneller zurück, weil die
                   Stufe multiplikativ im Multiplikator, aber nur logarithmisch
                   in der Erfahrung steckt
                   (`PersonObjects/formulas/skill.ts:13`): Stufe 1.000 bei
                   mult 1,0 verlangt exp = e^37,5; bei mult 1,1 genügt e^34,6.
                   Reputation reicht (≥13.820 aus Rang 9.083 bei
                   `RankToFactionRepFactor 2`), **Geld ist der Engpass**:
                   INTERLINKED 5,5 Mrd, Golem Serum 11 Mrd, Omnibeam 27,5 Mrd
                   gegen einen Kontostand von 3,2 Mrd.

Nächste Prüfung:   Ist die ETA gesunken? Steht die Geldrate wieder über
                   10 Mio/min (um 19:11 war sie von 22,9 auf 1,3
                   eingebrochen, Ursache offen)? Reicht das Guthaben für die
                   erste Augmentierung?
