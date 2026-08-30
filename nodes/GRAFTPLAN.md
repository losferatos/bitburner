# Die Graft-Reihenfolge

**Diese Liste ist die Arbeitsanweisung fuer `tools/graftnext.js`.** Sie steht
hier und nicht unter `data/`, weil `data/` in `.gitignore` liegt - eine
Reihenfolge, die einen Rechnerverlust nicht ueberlebt, ist keine.

Hergeleitet am 30.08.2026 (`nodes/GRAFTING.md`): greedy nach Zuwachs der
Erfolgschance je Stunde, Voraussetzungsketten eingerechnet, Preise und Zeiten
aus dem laufenden Spiel. Bereits installierte Stuecke werden von
`graftnext.js` uebersprungen - die Liste muss also nicht gepflegt werden,
wenn etwas fertig ist.

**Nicht in der Liste:** `The Blade's Simulacrum` und
`Neuroreceptor Management Implant` (beide am 30.08. gegraftet, sie mussten
zuerst) und `violet Congruity Implant` ($150 Bio, eigene Entscheidung, siehe
`nodes/GRAFTING.md`).

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
