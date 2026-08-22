# BitNode-Roadmap

Stand 22.08.2026, alles aus dem Quelltext von Bitburner v3.0.1 belegt.
Erarbeitet von fünf parallelen Recherchen; die Belege stehen jeweils dabei.

## Die Abschlussbedingung ist überall dieselbe

`destroyW0r1dD43m0n` (`NetscriptFunctions/Singularity.ts:1124-1169`) akzeptiert
**zwei** Wege:

1. Hacking ≥ `3000 × WorldDaemonDifficulty` plus Root auf `w0r1d_d43m0n`
2. **Alle 21 Bladeburner-Black-Ops abgeschlossen** (`Bladeburner/Enums.ts:38-60`)

Der zweite Weg ist generisch und gilt in *jedem* BitNode, sobald Bladeburner
zugänglich ist. Es gibt keine BN8- oder BN14-Sonderbedingung — das ist ein
verbreiteter Irrtum.

## Die Hacking-Schwellen, sortiert

| Schwelle | BitNodes |
|---|---|
| 3000 | **BN1**, **BN8** |
| 3060 (wächst mit Level) | BN12 |
| 4500 | **BN5**, **BN11** |
| 6000 | BN3, BN6, BN7, BN9, BN10, BN15 |
| 9000 | **BN4** (aktuell), BN13 |
| 15000 | BN2, BN14 |

Weil `Level = mult × (32·ln(exp+534,6) − 200)` gilt, ist der Sprung von 4500
auf 9000 bei einem Multiplikator um 10 ein Erfahrungsunterschied von grob
**sechs Größenordnungen**. Die Schwelle dominiert die Spielzeit stärker als
jeder Multiplikator des BitNodes.

## Source-Files: was wirklich zählt

Die Multiplikator-Formel ist `mult = Σ base/2^i` (`applySourceFile.ts:16-19`),
also **abnehmender Ertrag**: Level 1/2/3 geben `base`, `1,5·base`, `1,75·base`.
Ein zweiter Durchgang bringt die Hälfte des ersten, ein dritter ein Viertel.

**Drei Source-Files sind qualitativ anders als Prozente:**

- **SF4 (Singularity, aus BN4)** — schaltet `ns.singularity.*` frei, also
  Fraktionsarbeit, Augmentierungskauf, Backdoors, Resets per Skript. Die
  RAM-Kosten fallen mit dem Level drastisch: Level 1 = ×16, Level 2 = ×4,
  Level 3 = ×1 (`RamCostGenerator.ts:82-92`). Das ist der Unterschied zwischen
  „per Oberfläche steuerbar" und „vollautomatisch".
- **SF12 (Recursion, aus BN12)** — **einziges Source-File ohne Level-Deckel**
  (`RedPill.tsx:29` nimmt BN12 ausdrücklich aus). Jedes Level gibt bei jedem
  Prestige einen permanenten NeuroFlux-Startlevel (`Prestige.ts:255-260`),
  also +1 % auf alles, multiplikativ, unbegrenzt.
- **SF9 Level 3 (aus BN9)** — schenkt bei *jedem* Prestige einen fertigen
  Hacknet-Server (Level 100, 10 Kerne, `Prestige.ts:329-335`). Löst das
  Anlaufproblem in jedem neuen BitNode.

Dazu die Systemfreischaltungen: Gang→SF2, Corporation→SF3, Intelligence und
`formulas.exe`→SF5, Bladeburner→SF6/7, Aktienmarkt-Ausbaustufen→SF8,
Hacknet-Server→SF9, Sleeves→SF10, Stanek→SF13, Darknet→SF15.
Zentrale Prüfung: `canAccessBitNodeFeature` (`BitNodeUtils.ts:17-19`).

## Was einen BitNode-Wechsel überlebt

Praktisch **nichts außer den Source-Files** (`Prestige.ts:202-370`). Verloren
gehen: alle Level und Erfahrung, Geld, Augmentierungen, Fraktionen, Favor,
gekaufte Rechner, home-RAM, Programme, TOR, Karma, Gang/Corp/Bladeburner.
Erhalten bleiben nur Source-Files und die Anzahl der Sleeves.

Wichtig für die Planung: **Favor überlebt den BitNode-Wechsel nicht** — der
Spendenweg (ab Favor 150) muss in jedem BitNode neu erarbeitet werden.

## Vorgeschlagene Route

Begründung: erst die Schlüssel-Fähigkeiten holen, dann die billigen Schwellen
abräumen, die teuren zuletzt.

1. **BN4** (läuft) → SF4. Teuer mit 9000, aber Singularity ist die
   Voraussetzung dafür, dass alles Weitere überhaupt automatisch läuft.
2. **BN5** (4500) → SF5. Niedrige Schwelle, moderate Dämpfung, und liefert
   Intelligence sowie `formulas.exe` — beides wirkt dauerhaft.
3. **BN1 erneut** (3000) → SF1 Level 2. Keinerlei Dämpfung, der schnellste
   Durchgang überhaupt, und SF1 wirkt auf praktisch alle Multiplikatoren.
4. **BN12** (3060) → SF12. Ab hier lohnt jede Wiederholung dauerhaft, weil
   SF12 als einziges keinen Deckel hat.
5. **BN9** (6000) → SF9, wegen des geschenkten Hacknet-Servers je Prestige.
6. **BN11** (4500) → SF11. Niedrige Schwelle, und Verbrechen sind dort
   dreifach belohnt.
7. **BN8** (3000) → SF8. Niedrigste Schwelle, aber die gesamte Wirtschaft ist
   auf den Aktienmarkt reduziert (`CrimeMoney`, `CodingContractMoney`,
   `ScriptHackMoneyGain` allesamt 0) — braucht einen funktionierenden
   Börsenbot, sonst zäh.
8. **BN3, BN6, BN7, BN10, BN15** (je 6000) in beliebiger Reihenfolge.
9. **BN13** (9000), **BN2** und **BN14** (je 15000) zuletzt.

Wiederholungen erst, wenn alle einmal durch sind — wegen des abnehmenden
Ertrags. Ausnahmen: **SF4 auf Level 3** (die RAM-Sprünge sind die stärkste
Einzelverbesserung im Spiel) und **SF12**, das unbegrenzt weiterwächst.
