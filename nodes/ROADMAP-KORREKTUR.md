# Korrektur der Route - 23.08.2026

Drei Kritiker haben am 23.08.2026 die Route aus `ROADMAP.md` angegriffen. Ein
Befund traegt: **die Kernentscheidung "Bladeburner statt Hacking" steht auf
einem Rechenfehler.** Diese Datei haelt fest, was faellt und was bleibt.
`ROADMAP.md` ist damit in Abschnitt 4.1 und 6 ueberholt.

## Der Fehler

Abschnitt 4.1 extrapoliert die gemessene Erfahrungsrate **nur ueber RAM** und
haelt dabei `hacking_exp` bei 1,39 und `hacking_speed` bei 1,0 fest - waehrend
dieselbe Tabelle `mults.hacking` auf 26,8 hochzieht. Beides kommt aber aus
DENSELBEN Augmentierungen: der m=26,8-Satz traegt `hacking_exp` **15,32** und
`hacking_speed` **3,63**.

`calculateHackingExpGain` (Hacking.ts:30-38) haengt an `hacking_exp`,
`calculateHackingTime` (Hacking.ts:59-79) an `hacking_speed` UND an
`(skills.hacking + 50)`. Dieselbe Farm leistet damit rund **3,1e8 EXP/s statt
der angesetzten 1e5 bis 1e6** - Faktor 300 bis 3.000 auf jede Zeile.

Zweiter Fehler: NeuroFlux wird als Fussnote abgeschrieben. Reputation ist
aber ein **Bestand, keine Summe** - fuer Stufe N braucht es einmal
`500 * 1,14^(N-1)`, nicht deren Summe (AugmentationHelpers.ts:133-139). Mit
Spendenrecht ist das eine Geldfrage, und NFG hebt `faction_rep` selbst mit.
Die echte Schranke ist der Chargenpreis `1,9^queuedAugmentations`, und der
wird bei jedem Einbau zurueckgesetzt.

## Was daraus folgt

| BitNode | ROADMAP 4.1 | korrigiert |
|---|---|---|
| BN2 | 4.400 h | 1,7 h |
| BN6 / BN7 | 670 h | 1,9 h |
| BN9 | 33 h | 1,9 h (aber 9,5 d Geldbeschaffung - der einzige echte Engpass) |
| BN10 | 670 h | 1,7 h |
| BN13 / BN14 | aussichtslos | 1,7 / 1,8 h |

**Kein BitNode ist unter dem Hacking-Weg unerreichbar.** Damit faellt die
Begruendung fuer die V2-Route, und BN6 verliert seinen Platz 2 - es stand
dort ausschliesslich, weil SF6 Bladeburner fuer zwoelf Folgeknoten
freischaltet.

## Die Gegenkorrektur: die Roadmap war auch zu optimistisch

Ihre Spalte m=25/26,8 ist fuer diesen Bot unerreichbar. QLink (x1,75,
Illuminati) und SPTN-97 (x1,15, The Covenant) verlangen **alle vier**
Kampfwerte bei 1.200 beziehungsweise 850, als UND-Bedingung
(FactionJoinCondition.ts:158). Die Figur hat 2. Realistische Obergrenze ohne
Kampftraining: **11,375 statt 22,89**. Der Ratenfehler ist der groessere, aber
beide gehoeren in dieselbe Rechnung.

## Was bleibt

1. **BN4 zuerst.** Unberuehrt, SF4 traegt die ganze Steuerung.
2. **BN8 zuletzt.** Sogar staerker als bisher begruendet: `BladeburnerRank: 0`
   laesst `calculateActionRankGain` fuer jede Aktionsart 0 zurueckgeben, der
   Rang steigt nie ueber null - dort gibt es keinen V2-Weg, auch nicht mit
   SF6. Und `FavorToDonateToFaction: 0` erlaubt Spenden ab Favor 0.
3. **Bladeburner hat einen echten strukturellen Vorteil**, der nichts mit der
   Schwelle zu tun hat: sein Fortschritt **ueberlebt den Einbau vollstaendig**
   (Bladeburner.ts:259-263 macht nur resetAction und joinFaction). Der
   Hacking-Weg verliert bei jedem Einbau Geld, Mietrechner, Mitgliedschaften,
   Reputation, Portprogramme, Backdoors und die gesamte Erfahrung. Neun
   Einbauzyklen in BN13 sind das reale Betriebsrisiko der Gegenrechnung -
   nicht die Mathematik.
4. Bladeburner zieht Bonuszeit mit bis zu 5x (`Math.min(storedCycles/5, 5)`),
   Hacking nicht.

## Neue Reihenfolge - Entwurf, noch nicht beschlossen

Massgeblich ist jetzt: **welcher SourceFile hebt den Multiplikator am
fruehesten?** Denn das Ziel ist Stufe 3 in allen 15 Knoten, also 45
Durchlaeufe - ein frueh geholter Multiplikator-SF zahlt sich 45-mal aus, ein
Freischalter wie SF6 nur dort, wo man ihn benutzt.

- **BN5** weit nach vorn: WorldDaemonDifficulty 1,5, NFG-Bedarf null, also
  Stunden. SF5 gibt +8 % je Stufe auf `hacking` UND `hacking_exp`, dazu
  dauerhafte Intelligence und `formulas.exe` zum Nulltarif.
- **BN11** frueh: senkt die Chargenbasis von 1,9 auf 1,767
  (`getBaseAugmentationPriceMultiplier`) - genau die Schranke, die den
  NFG-Kauf bindet - und gibt +56 % auf `work_money` und `company_rep`.
- **BN1 erneut**: SF1.3 ist x1,28 auf JEDEN Multiplikator, auch `hacking_exp`
  und `faction_rep`, und senkt den NFG-Bedarf in BN6/7/10 von 54 auf 42.
- **BN2 frueh statt spaet**: die Gang-Fraktion verkauft alle nicht-speziellen
  Augmentierungen und in BN2 auch The Red Pill, erzeugt Faktionsreputation
  direkt und macht den Favor-150-Grind je Faktion ueberfluessig. Die Roadmap
  nennt diesen Weg selbst einen "Beschleuniger fuer V1", nutzt ihn dann aber
  nie, weil sie BN2 ueber V2 faehrt.
- **BN13 und BN14 ans Ende** - hoechster NFG-Bedarf (125 beziehungsweise 120).
- **BN9 nach SF1.3 und SF5.3**, weil der NFG-Bedarf dort von 28 auf 6 faellt
  und BN9 der einzige Knoten mit echter Geldnot ist.
- **BN10 verliert seine Begruendung**: die 209 h Ersparnis stammten aus "ein
  Sleeve senkt jeden V2-Knoten um 40 %". Ohne V2 als Arbeitspferd bleibt
  Grafting - nuetzlich, aber keine 209 Stunden.

## Was der Kritiker NICHT belegt hat

- Die Einkommenszahlen sind theoretische Obergrenzen, mit einer geschaetzten
  Ausbeute skaliert. Einziger Pruefpunkt ist die BN4-Messung: das Modell liegt
  1,6-fach ueber der Messung, die Annahmen sind also konservativ.
- Ob der Bot die Wiederanlaufkette drei- bis neunmal je Knoten zuverlaessig
  faehrt, ist **ungetestet**. Abschnitt 7.5 der Roadmap ist fuer
  Knotenwechsel gebaut, nicht fuer diese Frequenz. Dazu kommt der Befund des
  Fehlermodi-Kritikers: nach einem BitNode-Wechsel laeuft derzeit gar nichts,
  weil `prestigeSourceFile` alle Skripte beendet und die vorgesehene
  `boot.js` nicht existiert. **Das ist die dringendste offene Baustelle.**
