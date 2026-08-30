# Grafting in BitNode 10 - die geeichte Rechnung

> **GESPERRT (30.08., 17:05).** Die Rechnung unten haelt - ein Skeptiker-Lauf
> hat Preise, Zeiten, Entropie, Skill-Formel und die Simulacrum-Mechanik
> unabhaengig nachgerechnet und bestaetigt. Gekippt ist ihre **betriebliche
> Folge**: In der hier beschriebenen Reihenfolge wuerde das erste Graft binnen
> Sekunden abgebrochen und $450 Mrd waeren weg. Siehe den Abschnitt
> "Warum nicht gegraftet werden darf" am Ende. **Nicht ausfuehren, bevor die
> drei dort genannten Codeaenderungen drin sind.**


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

## Warum nicht gegraftet werden darf (Nachtrag 17:05)

Drei Befunde aus dem Skeptiker-Lauf, jeder selbst am Quellcode nachgeprueft.

**1. `blade.js` vernichtet das erste Graft in Sekunden.**
`Bladeburner.startAction` ruft `Player.finishWork(true)` **unbedingt** und noch
vor der Verfuegbarkeitspruefung, solange das Simulacrum nicht installiert ist
(`Bladeburner.ts:177-180`). `src/blade.js:3285` ruft `startAction` im
Sekundentakt. Das Geld fuer ein abgebrochenes Graft kommt nicht zurueck
(`Work/GraftingWork.tsx:75-83`). `blade.js` abschalten hilft nicht -
`src/bn4net.js:253` startet es jede Motorrunde nach.

Das ist der Denkfehler in der urspruenglichen Fassung: Ich habe geprueft, ob
das Simulacrum die Bladeburner-Aktion **schuetzt** (`Bladeburner.ts:1354`,
tut es), aber nicht, was der Bot **selbst** tut, waehrend er sie noch nicht hat.

**2. Das 99er-Fenster.** Das Simulacrum bringt keinen Kampfmultiplikator, seine
Entropie senkt aber alles um 2 %: Tiefstand 101 -> **99**. Damit verlaesst
`src/bbtrain.js:117` seine Warteschleife, reist nach Sector-12 (`:162`),
startet Gym-Arbeit (`:244`) und ruft am Ende unbedingt
`ns.singularity.stopAction()` (`:258`). Jedes davon killt ein laufendes Graft.
`src/blade.js:3072` parkt zusaetzlich die Bladeburner-Aktion bei Tiefstand
unter 100 - die Aussage "42 h Graft-Zeit kosten keinen Rang" gilt fuer dieses
Fenster **nicht**.

**3. Offline-Zeit verfaellt.** `engine.tsx:281-283` ruft `Player.processWork`
mit den Nachholzyklen in **einem einzigen Aufruf**. `GraftingWork.process`
meldet einmal fertig, der Ueberschuss verfaellt ersatzlos. Pro Offline-Block
landet hoechstens **eine** Augmentierung. Ein 42-h-Plan ueberspannt zwei
Naechte. (Gedrosselter Tab ist dagegen unkritisch - Grafting hat keinen
Pro-Tick-Deckel wie Bladeburner. Ein Reload ueberlebt ein Graft:
`GraftingWork` hat `toJSON`/`fromJSON`.)

### Was gebaut sein muss, bevor das erste Graft startet

Jedes Stueck laeuft unbeaufsichtigt, also jedes mit Skeptiker vor dem Commit.

1. `src/blade.js`: Riegel gegen `startAction`, solange ein Graft laeuft und das
   Simulacrum fehlt. Und die Tiefstandssperre (`:3072`) muss ein laufendes
   Graft kennen.
2. `src/bbtrain.js`: muss `type === "GRAFTING"` kennen - Warteschleife halten,
   nicht reisen, `stopAction()` in `:258` nicht unbedingt rufen.
3. `tools/wache.js:830-861`: unterscheidet `GRAFTING` nicht von "bbtrain
   fehlt" und startet `bbtrain.js` alle 15 Minuten nach, samt Push an Eric.

### Korrigierte Reihenfolge

**`Neuroreceptor Management Implant` zuerst** ($1,6 Mrd, 14 min). Ohne sie
kostet jeder Verlust des Fokus 20 % Grafttempo
(`focusPenalty`, `PlayerObjectGeneralMethods.ts:622-628`) - aus 42,4 h werden
53 h. Danach das Simulacrum und die erste Kampf-Augmentierung als **Paar**,
weil das 99er-Fenster dazwischen der gefaehrlichste Moment des Laufs ist.

### Was geprueft und nicht beanstandet wurde

`bn4rep.js` startet in BitNode 10 weder Faktions- noch Firmenarbeit
(`BLADE_KNOTEN = [6, 7, 10]`, `:70`, `:389`). `bn4life.js` begeht in der
Division keine Verbrechen (`:369`). `blade.js` kann waehrend eines Grafts
weder das Gym greifen noch den Spieler bewegen (`:1042-1047` prueft
`type !== "CLASS"` vor der Reise). `sleeve.js` fasst `currentWork` nie an.
Eine Reise bricht ein laufendes Graft **nicht** ab - New Tokyo ist nur fuer den
Start noetig. Das Geldbudget ist unkritisch: $0,42 Bio sind bei der aktuellen
Einnahmerate rund sechs Minuten.
