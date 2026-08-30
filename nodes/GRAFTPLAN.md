# Die Graft-Reihenfolge

**Diese Liste ist die Arbeitsanweisung fuer `tools/graftnext.js`.** Sie steht
hier und nicht unter `data/`, weil `data/` in `.gitignore` liegt - eine
Reihenfolge, die einen Rechnerverlust nicht ueberlebt, ist keine.

Hergeleitet am 30.08.2026 (`nodes/GRAFTING.md`): greedy nach Zuwachs der
Erfolgschance je Stunde, Voraussetzungsketten eingerechnet, Preise und Zeiten
aus dem laufenden Spiel. Bereits installierte Stuecke werden von
`graftnext.js` uebersprungen - die Liste muss also nicht gepflegt werden,
wenn etwas fertig ist.

**Nicht in der Liste:** `The Blade's Simulacrum`, `Neuroreceptor Management
Implant` und `Combat Rib I` (alle drei am 30.08. gegraftet).

## `violet Congruity Implant` - so frueh wie bezahlbar, nicht am Ende

**$150 Bio, 14,1 Minuten, graftbar** (kein `isSpecial`, `factions: []`,
`Augmentations.ts:391-399`; kaufen geht wegen `repCost: Infinity` nicht).

`AugmentationHelpers.ts:45-49` setzt beim Anwenden `Player.entropy = 0` und
ruft `applyEntropy(0)` - **die Entropie ist damit rueckwirkend geloescht**.
Und `GraftingWork.tsx:61-64` prueft den Besitz, bevor es einen Stapel bucht:
**nach Congruity erzeugt kein Graft mehr Entropie.**

**Deshalb so frueh wie moeglich, nicht als letztes.** Das Endergebnis ist in
beiden Faellen null Entropie - aber wer es zuerst graftet, arbeitet die
restlichen Stuecke mit vollen Multiplikatoren ab statt mit `0,98^n`. Nach 38
Grafts stuenden sonst `bladeburner_success_chance` bei x0,822 statt x1,771,
`faction_rep` bei x0,888 statt x1,912 und `hacking_money` bei der Haelfte -
und die Geldrate, aus der die $150 Bio kommen, haengt an genau diesem
`hacking_money`.

**Also:** Das Paket abarbeiten, und sobald $150 Bio auf dem Konto stehen,
Congruity dazwischenschieben. Bei der vor dem Einbau gemessenen Nettorate von
$4,43 Bio je Stunde sind das rund 34 Stunden - waehrend das Paket 42 braucht.

*Gefunden von einem Skeptiker-Lauf am 30.08. um 23:25, nachdem
`nodes/GRAFTING.md` es als "eigene Entscheidung" beiseitegeschoben hatte.*

## Reihenfolge

```
SPTN-97 Gene Modification
Bionic Legs
Graphene Bionic Legs Upgrade
Bionic Spine
Graphene Bionic Spine Upgrade
Synthetic Heart
Photosynthetic Cells
CordiARC Fusion Reactor
Hyperion Plasma Cannon V1
Hyperion Plasma Cannon V2
Graphene Bone Lacings
NEMEAN Subdermal Weave
Neotra
Bionic Arms
Graphene Bionic Arms Upgrade
Synfibril Muscle
BrachiBlades
Graphene BrachiBlades Upgrade
nextSENS Gene Modification
Nanofiber Weave
DermaForce Particle Barrier
Combat Rib I
Combat Rib II
Combat Rib III
BLADE-51b Tesla Armor
BLADE-51b Tesla Armor: Unibeam Upgrade
BLADE-51b Tesla Armor: Omnibeam Upgrade
Xanipher
BLADE-51b Tesla Armor: Energy Shielding Upgrade
ORION-MKIV Shoulder
HemoRecirculator
The Black Hand
GOLEM Serum
BLADE-51b Tesla Armor: Power Cells Upgrade
Vangelis Virus
Vangelis Virus 3.0
Power Recirculation Core
LuminCloaking-V2 Skin Implant
```

**Voraussetzungsketten**, die die Reihenfolge erzwingen und nicht getauscht
werden duerfen: Bionic Legs vor Graphene Bionic Legs Upgrade, Bionic Spine vor
Graphene Bionic Spine Upgrade, Bionic Arms vor Graphene Bionic Arms Upgrade,
BrachiBlades vor Graphene BrachiBlades Upgrade, Combat Rib I vor II vor III,
BLADE-51b Tesla Armor vor allen vier Upgrades, Unibeam vor Omnibeam,
Hyperion V1 vor V2, Vangelis Virus vor Vangelis Virus 3.0,
LuminCloaking-V1 (installiert) vor V2.
