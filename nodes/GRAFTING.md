# Grafting in BitNode 10 - die geeichte Rechnung

> **GESPERRT (30.08., 17:05).** Nicht ausfuehren, bevor die drei Codeaenderungen
> unter "Was gebaut sein muss" drin sind. In der urspruenglich hier
> beschriebenen Reihenfolge waere das erste Graft binnen Sekunden abgebrochen
> worden und $450 Mrd waeren weg gewesen.

*Erste Fassung 30.08.2026, 16:40. Nach zwei Skeptiker-Laeufen ueberarbeitet
17:25 - sechs Zahlen der ersten Fassung waren falsch, sie sind unten einzeln
benannt. Quelle: `reference/bitburner-src/src/`, gegengeprueft am laufenden
Spiel ueber `src/bbgraft.js` -> `data/bbgraft.json`.*

Grafting ist in diesem Knoten verfuegbar (`zugang: true`, vom Spiel bestaetigt).
Es ist **kein Einbau**: `GraftingWork.finish` ruft `applyAugmentation` direkt,
es gibt kein Prestige, keinen Reset, keinen Verlust der Kampfwerte. Der
ENTSCHIEDEN-Eintrag "Einbau vor dem Divisionsbeitritt: nie" gilt hier **nicht**
und darf nicht dagegen ins Feld gefuehrt werden.

## Was geeicht wurde, und woran

| Modell | Geeicht gegen | Ergebnis |
|---|---|---|
| Preis `= baseCost x 3` | 99 Werte aus `ns.grafting.getAugmentationGraftPrice` | **98 von 99 exakt** (die 99. hat dynamische Kosten) |
| Graft-Zeit | 99 Werte aus `getAugmentationGraftTime` | 96 exakt, 3 weichen ab (Versionsunterschied, siehe unten) |
| Multiplikatoren sind ein reines Produkt | 14 Felder aus `p.mults` im Spielstand | Restfaktor **ueberall identisch** 1,6019918 = NFG^24 x SF1 (1,16) x SF6 (1,08) |
| Skill `= floor(mult x nodeMult x (32 ln(exp+534,6) - 200))` | alle sechs Skills im Spielstand | **exakt** |
| `getSuccessChance` (`Action.ts:169-196`) | fuenf im Spiel gemessene Black-Op-Chancen | **Abweichung unter 0,1 %** |

Die letzte Zeile ist die wichtigste: Das Chancenmodell wurde unabhaengig
nachgebaut und trifft die real gemessenen Werte (Typhoon 4,165 % gerechnet
gegen 4,16 % gemessen, Zero 2,852 gegen 2,85, X 2,776 gegen 2,78, Titan 2,082
gegen 2,08, Ares 1,771 gegen 1,77).

**Die Referenzfassung stimmt nicht ueberall mit dem laufenden Spiel ueberein.**
Drei von 98 Augmentierungen weichen ab - `Synthetic Heart` (charisma 1,3 im
Spiel gegen 1,15 in der Referenz), `DermaForce Particle Barrier`,
`The Illustrated Primer`. Alle drei betreffen charisma, aber der Befund ist
allgemein: **wer aus `reference/` rechnet, prueft am laufenden Spiel nach.**

## Die drei Regeln, die Grafting von jedem Kauf unterscheiden

1. **Preis = `baseCost x 3`.** Kein `AugmentationMoneyCost` des Knotens (der
   waere x5), keine `1,9^k`-Treppe, **keine Reputation**
   (`GraftableAugmentation.ts:21`).
2. **Die 17 Bladeburner-Sonderaugmentierungen sind graftbar** - aber nur, weil
   der Spieler Mitglied ist (`GraftingHelpers.ts:11-18`). Vom Spiel bestaetigt.
3. **Jedes Graft kostet 1 Entropie** = `x0,98` auf **alle** Multiplikatoren,
   inklusive der vier `bladeburner_*` (`EntropyAccumulation.ts:7-46`).

## Entropie ist ein Preisschild, kein Naturgesetz

Die erste Fassung behauptete, `CongruityImplant` sei nicht graftbar. **Das war
falsch.** Sie heisst im Spiel `violet Congruity Implant`, hat `factions: []`
und kein `isSpecial` (`Augmentations.ts:391-399`), faellt also durch keinen
Filter - und **steht in der Liste, die das laufende Spiel zurueckgibt**:

    violet Congruity Implant    $150.000 Mrd = $150 Bio    0,23 h

Kaufen geht nicht (`repCost: Infinity`), graften schon. Und sie kostet **selbst
keine Entropie**: `GraftingWork.finish` ruft `applyAugmentation` in Zeile 51,
die Entropie-Erhoehung steht erst in Zeile 60-63 und prueft dann bereits die
frisch installierte Augmentierung.

Was das aendert, wenn sie **zuerst** gegraftet wird: alle 0,98-Faktoren unten
fallen weg. Statt competence x26,8 waeren es **x106,7**, Operation Daedalus
ginge von 0,08 % auf **8,7 %** statt auf 2,1 %, und die Kampfmultiplikatoren
lieferten str x471,8 statt x214,6.

$150 Bio sind bei der am 30.08. gemessenen Einnahmerate (rund $1,25 Mrd/s)
etwa **33 Stunden**. Das ist kein Ausschlusskriterium, sondern eine
Abwaegung - und sie ist noch nicht gerechnet.

**Zweiter Grund, warum das zaehlt:** Entropie ueberlebt einen
Augmentierungs-Einbau. `Prestige.ts:127-128` wendet `Player.entropy`
unveraendert wieder an; zurueckgesetzt wird sie nur beim BitNode-Wechsel
(`PlayerObjectGeneralMethods.ts:144`). Die -54,5 % auf alle Multiplikatoren
begleiten also auch die spaeter geplante Augmentierungsrunde.

## Das Paket - korrigierte Zahlen

**40 Grafts** (38 Kampf- und Bladeburner-Augmentierungen, dazu
`The Blade's Simulacrum` und `Neuroreceptor Management Implant`),
**$0,87 Bio von $5,2 Bio = 15 %** des Vermoegens, **42,4 Stunden** bei
durchgehendem Fokus, **39-40 Entropiestapel**.

*Korrektur der ersten Fassung: dort standen 38 Stapel und $0,42 Bio (8 %) -
das Simulacrum war als Voraussetzung genannt, aber nicht mitgerechnet.*

Nach Abzug der Entropie (39 Stapel, `x0,4548`):

| | Multiplikator | Skill vorher | Skill nachher |
|---|---|---|---|
| strength | x214,6 | 101 | ~22.300 |
| defense | x184,0 | 101 | ~19.000 |
| dexterity | x10,4 | 122 | ~1.300 |
| agility | x33,2 | 108 | ~3.670 |
| hacking | x0,87 | 369 | 321 |

**Und die vier Bladeburner-Felder, die in der ersten Fassung fehlten oder
brutto standen - alle vier gehen NACH UNTEN:**

| | brutto aus den Augs | netto nach Entropie |
|---|---|---|
| `bladeburner_success_chance` | x1,771 | **x0,822** |
| `bladeburner_max_stamina` | x1,05 | **x0,487** |
| `bladeburner_stamina_gain` | x1,09 | **x0,507** |
| `bladeburner_analysis` | x1,26 | **x0,587** |

Ein Nettowert ueber 1 waere bei `success_chance` gar nicht erreichbar: das
Produkt ueber **alle** 99 graftbaren Augmentierungen ist nur 1,9161. Die erste
Fassung schrieb "x1,771" unter die Ueberschrift "nach Abzug der Entropie" -
das war der Bruttowert.

## Was es fuer den Ausgang bedeutet

Der competence-Faktor fuer Operation Daedalus ist **x26,8**, nicht x27,4. Und
er darf **nicht** pauschal auf jede Black Op angewandt werden: die Operationen
haben unterschiedliche `weights` und `decays` (`data/BlackOperations.ts`).
Operation Zero gewichtet Hacking mit 0,2 statt 0,1 - und Hacking *faellt* durch
das Paket. Operation Ares hat `hacking: 0` und `intelligence: 0`, dort ist der
Faktor groesser.

| Black Op | jetzt | erste Fassung | **korrekt** | echter Faktor |
|---|---|---|---|---|
| Typhoon | 4,16 % | 100 % | 100 % | x25,9 |
| Zero | 2,85 % | 78,0 % | **59,6 %** | x20,9 |
| X | 2,77 % | 75,8 % | 71,8 % | x25,9 |
| Titan | 2,08 % | 56,9 % | 53,9 % | x25,9 |
| Ares | 1,77 % | 48,4 % | **53,6 %** | x30,3 |
| Daedalus | 0,08 % | 2,2 % | 2,11 % | x25,9 |

Was sich dabei **nicht** mitaendert (und wo die Hochrechnung zulaessig ist):
Bevoelkerung und Chaos sind fuer Black Ops fest auf 1
(`BlackOperation.ts:55-61`), das Team ist leer, die Ausdauerstrafe bleibt 1.

**Fuer Vertraege und Operationen - die heutige Rangquelle - gilt der Faktor
gar nicht.** Dort gehen `popEst` und Chaos ein, und `bladeburner_analysis`
netto 0,587 **verschlechtert** die Schaetzung, aus der der Bot seine
Entscheidungen liest.

Ausdauer: `maxStamina` steigt trotz des halbierten Multiplikators von 51,5 auf
421,6 (die Agilitaet dominiert ueber `effAgi^0,8`), die Regeneration aber nur
von 0,0223 auf 0,0324/s. Die Zeit bis zur 50-%-Schwelle waechst von 0,32 h auf
1,8 h. Netto bleibt ein Gewinn - nachhaltige Aktionsrate rund **x1,46** -, aber
weit weniger, als die Kampfwerte suggerieren.

Trefferpunkte: `hp.max = floor(10 + defense/10)` = **1.912** statt 20. Der
Befund vom 30.08., dass ein fehlgeschlagener Raid 315,8 HP kostet
(`bbspann.js`), verliert damit seine Schaerfe.

## Warum nicht gegraftet werden darf

**1. `blade.js` vernichtet das erste Graft in Sekunden.**
`Bladeburner.startAction` ruft `Player.finishWork(true)` **unbedingt** und noch
vor der Verfuegbarkeitspruefung, solange das Simulacrum nicht installiert ist
(`Bladeburner.ts:177-180`). `src/blade.js:3285` ruft `startAction` im
Sekundentakt. Das Geld fuer ein abgebrochenes Graft kommt nicht zurueck
(`GraftingWork.tsx:75-83`). `blade.js` abschalten hilft nicht -
`src/bn4net.js:253` startet es jede Motorrunde nach.

*Der Denkfehler der ersten Fassung:* Ich habe geprueft, ob das Simulacrum die
Bladeburner-Aktion **schuetzt** (`Bladeburner.ts:1354`, tut es), aber nicht,
was der Bot **selbst** tut, solange er sie noch nicht hat.

**2. Das 99er-Fenster.** Das Simulacrum bringt keinen Kampfmultiplikator, seine
Entropie senkt aber alles um 2 %: Tiefstand 101 -> **99**. Damit verlaesst
`src/bbtrain.js:117` seine Warteschleife, reist nach Sector-12 (`:162`),
startet Gym-Arbeit (`:244`) und ruft am Ende unbedingt
`ns.singularity.stopAction()` (`:258`). Jedes davon killt ein laufendes Graft.
`src/blade.js:3072` parkt zusaetzlich die Bladeburner-Aktion bei Tiefstand
unter 100 - "42 h kosten keinen Rang" gilt fuer dieses Fenster **nicht**.

**3. Offline-Zeit verfaellt.** `engine.tsx:281-283` ruft `Player.processWork`
mit den Nachholzyklen in **einem einzigen Aufruf**. `GraftingWork.process`
meldet einmal fertig, der Ueberschuss verfaellt. Pro Offline-Block landet
hoechstens **eine** Augmentierung. Ein 42-h-Plan ueberspannt zwei Naechte.
(Gedrosselter Tab ist unkritisch - Grafting hat keinen Pro-Tick-Deckel wie
Bladeburner. Ein Reload ueberlebt: `GraftingWork` hat `toJSON`/`fromJSON`.)

**4. Der Fokus traegt 20 % der Zeit.** `GraftingWork.process` multipliziert mit
`Player.focusPenalty()` = 0,8 ohne `Neuroreceptor Management Implant`
(`PlayerObjectGeneralMethods.ts:622-628`). Ohne sie werden aus 42,4 h **53,2 h**.
Und der Fokus geht verloren, sobald etwas die Seite wechselt
(`ui/GameRoot.tsx:271-272`). NMI kostet $1,65 Mrd und 14 Minuten.

## Was gebaut sein muss, bevor das erste Graft startet

Jedes Stueck laeuft unbeaufsichtigt, also jedes mit Skeptiker vor dem Commit.

1. `src/blade.js`: Riegel gegen `startAction`, solange ein Graft laeuft und das
   Simulacrum fehlt. Und die Tiefstandssperre (`:3072`) muss ein laufendes
   Graft kennen.
2. `src/bbtrain.js`: muss `type === "GRAFTING"` kennen - Warteschleife halten,
   nicht reisen, `stopAction()` in `:258` nicht unbedingt rufen.
3. `tools/wache.js:830-861`: unterscheidet `GRAFTING` nicht von "bbtrain
   fehlt" und startet `bbtrain.js` alle 15 Minuten nach, samt Push an Eric.

## Reihenfolge

Erst zu entscheiden ist die Congruity-Frage - sie aendert alles Weitere:

- **Ohne Congruity:** NMI ($1,65 Mrd) zuerst, dann Simulacrum und die erste
  Kampf-Augmentierung als **Paar** (das 99er-Fenster dazwischen ist der
  gefaehrlichste Moment des Laufs), dann die restlichen 37.
- **Mit Congruity:** sie zuerst, $150 Bio und 14 Minuten, danach ist jedes
  weitere Graft entropiefrei. Die Reihenfolge danach ist beliebig, das
  99er-Fenster entfaellt, und alle Bladeburner-Felder bleiben ueber 1.

## Was noch offen ist

- **Die Congruity-Abwaegung.** $150 Bio gegen competence x106,7 statt x26,8 -
  und gegen den Umstand, dass die Entropie sonst die Augmentierungsrunde und
  den Rest des Knotens begleitet. Noch nicht gerechnet.
- **Die Rangrate.** Faktor 26,8 auf die Erfolgschance der Black Ops ist nicht
  Faktor 26,8 auf den Rang. Fuer Vertraege und Operationen gilt er gar nicht,
  und `bladeburner_analysis` netto 0,587 wirkt dort sogar dagegen. **Bevor eine
  ETA daraus wird, muss das gerechnet werden.**
- **Die Voraussetzungen kommen aus `reference/`**, nicht aus
  `ns.singularity.getAugmentationPrereq`. Bei falscher Reihenfolge gibt
  `graftAugmentation` still `false` zurueck (`Grafting.ts:74-77`), es wirft
  nicht - ein Fehler waere also stumm.
- **Ein Werkzeug gibt es nicht.** `src/buyaugs.js:291,586` kennt Grafting nur
  als Kategorie "ueber den normalen Kauf nicht erreichbar".

## Was geprueft und nicht beanstandet wurde

`bn4rep.js` startet in BitNode 10 weder Faktions- noch Firmenarbeit
(`BLADE_KNOTEN = [6, 7, 10]`, `:70`, `:389`). `bn4life.js` begeht in der
Division keine Verbrechen (`:369`). `blade.js` kann waehrend eines Grafts
weder das Gym greifen noch den Spieler bewegen (`:1042-1047`). `sleeve.js`
fasst `currentWork` nie an. Eine Reise bricht ein laufendes Graft **nicht** ab -
New Tokyo ist nur fuer den Start noetig. `Bladeburner.ts:1354` ist tatsaechlich
die einzige Stelle, an der Bladeburner auf `currentWork` zugreift. Alle 13
Voraussetzungsketten im Paket sind in sich geschlossen. Das Geldbudget ist
in der Summe unkritisch: $0,87 Bio sind rund zwoelf Minuten Einnahmen; das
Risiko ist der Augenblick des Aufrufs, nicht das Budget.

## Reproduzieren

```
node tools/task.js bbgraft.js      # schreibt data/bbgraft.json im Spiel
```
