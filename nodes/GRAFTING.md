# Grafting in BitNode 10 - die geeichte Rechnung

*30.08.2026, 16:40. Quelle: `reference/bitburner-src/src/`, gegengeprueft am
laufenden Spiel ueber `src/bbgraft.js` -> `data/bbgraft.json`.*

Grafting ist in diesem Knoten verfuegbar (`zugang: true`, vom Spiel bestaetigt).
Es ist **kein Einbau**: `GraftingWork.finish` ruft `applyAugmentation` direkt,
es gibt kein Prestige, keinen Reset, keinen Verlust der Kampfwerte. Der
ENTSCHIEDEN-Eintrag "Einbau vor dem Divisionsbeitritt: nie" gilt hier **nicht**
und darf nicht dagegen ins Feld gefuehrt werden.

## Was geeicht wurde, und woran

Vier Eichungen, jede gegen einen unabhaengig bekannten Wert:

| Modell | Geeicht gegen | Ergebnis |
|---|---|---|
| Preis `= baseCost x 3` | 99 Werte aus `ns.grafting.getAugmentationGraftPrice` | Abweichung **0,000000 %** |
| Zeit `= (1h x log2(Summe der Multiplikatoren) + 30min) / 2 / Intelligenzbonus` | 99 Werte aus `getAugmentationGraftTime` | 96 exakt, **3 weichen ab** (siehe unten) |
| Multiplikatoren sind ein reines Produkt | 14 Felder aus `p.mults` im Spielstand | Restfaktor **ueberall identisch** 1,6019918 = NFG^24 x SF1 (1,16) x SF6 (1,08) |
| Skill `= floor(mult x nodeMult x (32 ln(exp+534,6) - 200))` | str/def/dex/agi/hacking im Spielstand | **alle fuenf exakt** |

**Die Referenzfassung stimmt nicht ueberall mit dem laufenden Spiel ueberein.**
Drei von 98 Augmentierungen weichen ab - `Synthetic Heart` (charisma 1,3 im
Spiel gegen 1,15 in der Referenz), `DermaForce Particle Barrier`,
`The Illustrated Primer` (8,3 %). Alle drei betreffen charisma, nicht die
Kampfwerte, aber der Befund ist allgemein: **wer aus `reference/` rechnet,
sollte das Ergebnis am laufenden Spiel gegenpruefen.** `src/bbgraft.js` holt
die Multiplikatoren deshalb ueber `ns.singularity.getAugmentationStats`.

## Die drei Regeln, die Grafting von jedem Kauf unterscheiden

1. **Preis = `baseCost x 3`.** Kein `AugmentationMoneyCost` des Knotens (der
   waere x5), keine `1,9^k`-Treppe fuer bereits gekaufte, **keine Reputation**
   (`GraftableAugmentation.ts:21`). Eine Augmentierung, die gekauft 12.500
   Reputation bei einer Faktion verlangt, kostet gegraftet nur Geld.
2. **Die Bladeburner-Sonderaugmentierungen sind graftbar** - aber nur, weil der
   Spieler Mitglied ist. `GraftingHelpers.ts:8-21` ueberspringt `isSpecial` nur
   dann, wenn die Augmentierung **nicht** zur Bladeburners-Faktion gehoert. Das
   Spiel bestaetigt 17 Stueck, darunter `The Blade's Simulacrum`.
3. **Jedes Graft kostet 1 Entropie** = `x0,98` auf **alle** Multiplikatoren
   (`GraftingWork.tsx:60-63`, `Constants.ts:104`). Das laesst sich nur mit
   `CongruityImplant` abstellen, und die ist nicht graftbar (Church of the
   Machine God, nicht Bladeburners). Schwelle: eine Augmentierung lohnt erst
   ab einem Nutzen ueber `1/0,98 = 1,0204`.

## Die Voraussetzung, ohne die alles andere sinnlos ist

**`The Blade's Simulacrum`: $450 Mrd, 14 Minuten, muss zuerst.**

`Bladeburner.ts:1354` bricht die laufende Bladeburner-Aktion ab und **schaltet
die Automatik aus**, sobald `Player.currentWork` gesetzt ist - ausser man hat
diese Augmentierung. Grafting *ist* `currentWork`. Ohne sie kosten die
42 Stunden Graft-Zeit 42 Stunden Rangfortschritt; mit ihr kosten sie nichts.

Zweite Bedingung: Grafting startet nur in **New Tokyo**
(`NetscriptFunctions/Grafting.ts:59`). Die Bladeburner-Stadt ist davon
unabhaengig.

## Das Paket

38 Augmentierungen, **$0,42 Bio von $5,2 Bio** (8 % des Vermoegens),
**42,4 Stunden** Graft-Zeit, 38 Entropiestapel (`x0,4641` auf alles).
Preise und Zeiten stammen aus dem laufenden Spiel, nicht aus einer Rechnung.

Reihenfolge nach Nutzen je Stunde, Voraussetzungsketten eingerechnet:
`SPTN-97` zuerst (allein x9,4 auf die Kampfwerte), dann die Bionic-Ketten,
zuletzt die Bladeburner-Sonderaugmentierungen.

Nach Abzug der Entropie:

| | Multiplikator | Skill vorher | Skill nachher |
|---|---|---|---|
| strength | x218,9 | 101 | 22.304 |
| defense | x187,7 | 101 | 19.025 |
| dexterity | x10,6 | 121 | 1.294 |
| agility | x33,9 | 108 | 3.669 |
| hacking | x0,89 | 368 | 327 |

`bladeburner_success_chance` x1,771. Hacking faellt, weil keine der 38
Augmentierungen darauf einzahlt und die Entropie es mit herunterzieht - fuer
den Ausgang aus diesem Knoten ist das gleichgueltig (der Hacking-Weg ist
laengst verworfen, `BAUSTELLEN.md`).

## Was es fuer den Ausgang bedeutet

Die Erfolgschance-Kennzahl (`competence`, `Action.ts:169-195`) fuer Operation
Daedalus steigt um **Faktor 27,4**. Auf die am 30.08. um 16:24 gemessenen
Black-Op-Chancen hochgerechnet:

| Black Op | jetzt | danach |
|---|---|---|
| Operation Typhoon | 4,16 % | 100 % (gedeckelt) |
| Operation Zero | 2,85 % | 78,0 % |
| Operation X | 2,77 % | 75,8 % |
| Operation Titan | 2,08 % | 56,9 % |
| Operation Ares | 1,77 % | 48,4 % |
| Operation Daedalus | 0,08 % | 2,2 % |

Der Rang bleibt die zweite Bindung - Daedalus verlangt 400.000
(`BlackOperations.ts:708`), Stand 16:24 waren es 743. Aber die Rangrate haengt
selbst an der Erfolgschance, und die Kampfwerte heben zusaetzlich die maximalen
Trefferpunkte (`hp.max = 10 + defense/10`): aus 20 HP werden rund 1.900. Der am
30.08. gemessene Befund, dass ein einziger fehlgeschlagener Raid 315,8 HP
kostet (`bbspann.js`), verliert damit seine Schaerfe.

## Was noch offen ist

- **Die Rangrate ist nicht durchgerechnet.** Faktor 27,4 auf die Erfolgschance
  ist nicht Faktor 27,4 auf den Rang: Vertraege und Operationen haben schon
  jetzt hohe Chancen, dort bringt es wenig. Der Gewinn liegt bei den Black Ops
  und beim Wegfall der Fehlschlaege. Bevor eine ETA daraus wird, muss das
  gerechnet werden.
- **Die Voraussetzungen kommen noch aus `reference/`**, nicht aus
  `ns.singularity.getAugmentationPrereq`. Bei drei abweichenden
  Augmentierungen von 98 ist das ein Restrisiko.
- **Ein Werkzeug gibt es nicht.** `src/buyaugs.js:291,586` kennt Grafting nur
  als Kategorie "ueber den normalen Kauf nicht erreichbar" und uebergeht solche
  Augmentierungen.

## Reproduzieren

```
node tools/task.js bbgraft.js      # schreibt data/bbgraft.json im Spiel
```

Die Auswertung liegt als Wegwerfskript im Scratchpad und ist bewusst nicht
eingecheckt - sie ist eine Momentaufnahme, kein Werkzeug. Wer sie neu braucht,
baut sie aus den vier Eichungen oben neu auf.
