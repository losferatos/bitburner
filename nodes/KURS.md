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
