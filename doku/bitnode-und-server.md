# BitNodes, Source Files und die Serverliste

**Quellstand:** Bitburner Release **v3.0.1**, Baum `reference\v301`.
Alle Zeilenverweise `src/Datei.ts:Zeile` beziehen sich auf diesen Stand, nicht auf den
dev-Branch. Unterschiede zu dev stehen ganz am Ende.

---

## 0. Vorab: Ersetzt das DarkNet-System die feste Serverliste? — NEIN

Das ist die strategisch wichtigste Frage, deshalb steht sie zuerst.

**Die klassische Netztopologie wird in v3.0.1 unveraendert aus `src/Server/data/servers.ts`
erzeugt. Das DarkNet ersetzt nichts. Es ist ein zweites, zusaetzliches Netz, das an
`darkweb` haengt und fuer die normale Geldbeschaffung per hack/grow/weaken irrelevant ist.**

Belege im Einzelnen:

1. **`initForeignServers` iteriert weiterhin ueber `serverMetadata`.**
   `src/Server/ServerHelpers.ts:342` (Funktionsbeginn), `:355`
   (`for (const metadata of serverMetadata)`). Der Baumbau ist Zeile fuer Zeile derselbe
   Code wie in aelteren Fassungen. Das DarkNet wird erst **danach** angehaengt:
   `src/Server/ServerHelpers.ts:408-412`
   ```ts
   initDarkwebServer();
   if (hasDarknetAccess()) {
     getTorRouter();
     populateDarknet();
   }
   ```

2. **DarkNet-Server sind eine eigene Klasse ohne Hacking-Eigenschaften.**
   `src/Server/DarknetServer.ts:29` — `class DarknetServer extends BaseServer`.
   Diese Klasse hat **kein** `requiredHackingSkill`, **kein** `moneyMax`, **kein**
   `moneyAvailable`, **kein** `hackDifficulty`, **kein** `minDifficulty`, **kein**
   `serverGrowth`, **kein** `numOpenPortsRequired`. Alle diese Felder sitzen in
   `class Server` (`src/Server/Server.ts:32-57`), einer Schwesterklasse.
   Stattdessen hat ein DarknetServer `password`, `modelId`, `staticPasswordHint`,
   `difficulty`, `depth`, `leftOffset`, `blockedRam`, `requiredCharismaSkill`
   (`src/Server/DarknetServer.ts:36-58`).
   **Folge: Man kann DarkNet-Server nicht hacken, growen oder weaken. Es gibt dort kein
   Geld zu holen.** Sie werden per Passwort-Raetsel geknackt und liefern dann nutzbares
   RAM sowie `.cache`-Dateien.

3. **Das DarkNet ist gesperrt, solange man es nicht freischaltet.**
   `src/DarkNet/utils/darknetAuthUtils.ts:6-8`
   ```ts
   export const hasDarknetAccess = () => {
     return canAccessBitNodeFeature(15) || Player.hasProgram(CompletedProgramName.darkscape);
   };
   ```
   Also: BitNode 15, oder SF15 auf mindestens Stufe 1, oder das gekaufte Programm
   `DarkscapeNavigator.exe` (`src/Programs/Programs.ts:354`). Kostet 50 Mio ueber den
   Darkweb bzw. 30 Mio im Shadowed Walkway
   (`src/DarkNet/Constants.ts:6-8`). Ohne das laeuft `populateDarknet()` nie und es
   existiert schlicht kein DarkNet.

4. **Selbst wenn es existiert, taucht es in der Serverliste ueber die Remote File API
   nicht auf.** `GetAllServers()` filtert DarknetServer standardmaessig heraus
   (`src/Server/AllServers.ts:58-67`, Parameter `showDarkweb = false`), und die
   RFA-Methode `getAllServers` ruft es ohne Argument auf
   (`src/RemoteFileAPI/MessageHandlers.ts:255`).

**Fazit fuer die Zielauswahl: die Tabelle in Abschnitt 4 ist und bleibt die vollstaendige
Liste aller Geldziele.** Prozedural erzeugt wird nur ein Parallelnetz mit ganz anderer
Spielmechanik.

### Was das DarkNet stattdessen ist (Kurzabriss)

Erzeugt in `src/DarkNet/controllers/NetworkGenerator.ts:91-111` (`populateDarknet`):
ein Raster aus Reihen mal Spalten mit den Konstanten aus `src/DarkNet/Enums.ts:4-11`:

| Konstante | Wert | Bedeutung |
| --- | --- | --- |
| `NET_WIDTH` | 8 | Server je Reihe |
| `MAX_NET_DEPTH` | 40 | Hoechstzahl Reihen |
| `SERVER_DENSITY` | 0.6 | Belegungsgrad |
| `HORIZONTAL_CONNECTION_CHANCE` | 0.5 | Wahrscheinlichkeit fuer Querverbindungen |
| `VERTICAL_CONNECTION_CHANCE` | 0.3 | Wahrscheinlichkeit fuer Verbindungen nach oben/unten |
| `AIR_GAP_DEPTH` | 8 | — |
| `MS_PER_MUTATION_PER_ROW` | 30000 | das Netz baut sich laufend um |

Die tatsaechliche Tiefe richtet sich nach dem gerade offenen Labyrinth
(`getNetDepth()`, `src/DarkNet/effects/labyrinth.ts:393-396`, Rueckfallwert 10).

Fest sind nur die acht Labyrinth-Server (`src/Server/data/SpecialServers.ts:13-20`):
`th3_l4byr1nth`, `cru3l_l4byr1nth`, `m3rc1l3ss_l4byr1nth`, `ub3r_l4byr1nth`,
`et3rn4l_l4byr1nth`, `end13ss_l4byr1nth`, `f1n4l_l4byr1nth`, `b0nus_l4byr1nth`
(Kennwerte in `src/DarkNet/effects/labyrinth.ts:37-110`). Alle anderen DarkNet-Server
bekommen zufaellige Namen und zufaellige Passwort-Raetsel
(`src/DarkNet/controllers/ServerGenerator.ts:18-66`, 24 verschiedene Raetseltypen in
`ModelIds`, `src/DarkNet/Enums.ts:15-41`).

Auch `darkweb` selbst ist in v3.0.1 ein `DarknetServer` geworden
(`src/DarkNet/controllers/NetworkGenerator.ts:52-89`), mit `maxRam = 16` und
`hasAdminRights = true` von Anfang an. Es haengt an `home`, sobald man den TOR-Router hat
(`src/Server/ServerHelpers.ts:326`, `getTorRouter()`).

---

## 1. BitNode 1 — alle Multiplikatoren

BitNode 1 setzt **keinen einzigen Multiplikator um**. Der Code ist
`src/BitNode/BitNode.tsx:572-574`:

```ts
case 1: {
  return new BitNodeMultipliers();
}
```

Das heisst: BitNode 1 ist exakt die Vorgabekonfiguration aus
`src/BitNode/BitNodeMultipliers.ts:8-185`. Genau zwei Felder haben dort einen anderen
Startwert als 1. Vollstaendige Liste (54 Felder):

| Multiplikator | Wert in BN1 | Zeile | Wirkung |
| --- | ---: | ---: | --- |
| `AgilityLevelMultiplier` | 1 | `:10` | wie schnell Agility-Level (nicht exp) steigt |
| `AugmentationMoneyCost` | 1 | `:13` | Grundpreis von Augmentierungen |
| `AugmentationRepCost` | 1 | `:16` | benoetigte Fraktionsreputation fuer Augs |
| `BladeburnerRank` | 1 | `:19` | Rangzuwachs bei Bladeburner |
| `BladeburnerSkillCost` | 1 | `:22` | Kosten der Bladeburner-Faehigkeiten |
| `CharismaLevelMultiplier` | 1 | `:25` | Charisma-Levelskalierung |
| `ClassGymExpGain` | 1 | `:28` | exp aus Uni und Gym |
| `CodingContractMoney` | 1 | `:31` | Geld aus Coding Contracts |
| `CompanyWorkExpGain` | 1 | `:34` | exp aus Firmenarbeit |
| `CompanyWorkMoney` | 1 | `:37` | Gehalt aus Firmenarbeit |
| `CompanyWorkRepGain` | 1 | `:40` | Firmenreputation |
| `CorporationDivisions` | 1 | `:43` | Zahl moeglicher Konzernsparten |
| `CorporationSoftcap` | 1 | `:46` | Dividenden und Aktienverkauf im Konzern |
| `CorporationValuation` | 1 | `:49` | Konzernbewertung |
| `CrimeExpGain` | 1 | `:52` | exp aus Verbrechen |
| `CrimeMoney` | 1 | `:55` | Geld aus Verbrechen |
| `CrimeSuccessRate` | 1 | `:58` | Erfolgsquote bei Verbrechen |
| **`DaedalusAugsRequirement`** | **30** | `:61` | Zahl installierter Augs fuer die Daedalus-Einladung |
| `DarknetLabyrinthRewardsTheRedPill` | 1 | `:64` | ob The Red Pill im Labyrinth liegen kann |
| `DarknetMoneyMultiplier` | 1 | `:67` | Geld aus Darknet-Mechaniken (Phishing, Caches) |
| `DefenseLevelMultiplier` | 1 | `:70` | Defense-Levelskalierung |
| `DexterityLevelMultiplier` | 1 | `:73` | Dexterity-Levelskalierung |
| `FactionPassiveRepGain` | 1 | `:76` | passive Fraktionsreputation |
| `FactionWorkExpGain` | 1 | `:79` | exp aus Fraktionsarbeit |
| `FactionWorkRepGain` | 1 | `:82` | Reputation aus Fraktionsarbeit und Spenden |
| `FourSigmaMarketDataApiCost` | 1 | `:85` | Preis der 4S-Market-Data-API |
| `FourSigmaMarketDataCost` | 1 | `:88` | Preis der 4S Market Data |
| `GangSoftcap` | 1 | `:91` | Respekt- und Geldzuwachs der Gang |
| `GangUniqueAugs` | 1 | `:94` | Anteil gang-exklusiver Augmentierungen |
| `GoPower` | 1 | `:97` | Wirkung der IPvGO-Belohnungen |
| `HackExpGain` | 1 | `:100` | Hacking-exp beim Hacken eines Servers |
| `HackingLevelMultiplier` | 1 | `:103` | Hacking-Levelskalierung (nicht exp) |
| `HackingSpeedMultiplier` | 1 | `:106` | Tempo von hack(), grow(), weaken() |
| `HacknetNodeMoney` | 1 | `:112` | Ertrag der Hacknet Nodes bzw. Hashrate der Hacknet Server |
| `HomeComputerRamCost` | 1 | `:115` | Preis fuer RAM-Ausbau von `home` |
| `InfiltrationMoney` | 1 | `:118` | Geld aus Infiltration |
| `InfiltrationRep` | 1 | `:121` | Reputation aus verkauften Dokumenten |
| `ManualHackMoney` | 1 | `:128` | Geldgewinn beim Hacken **ueber das Terminal** |
| `CloudServerCost` | 1 | `:131` | Preis eines gekauften Servers |
| `CloudServerSoftcap` | 1 | `:134` | Preisdaempfung gekaufter Server |
| `CloudServerLimit` | 1 | `:137` | Hoechstzahl gekaufter Server |
| `CloudServerMaxRam` | 1 | `:140` | maximales RAM eines gekauften Servers |
| `FavorToDonateToFaction` | 1 | `:143` | noetige Gunst, um spenden zu duerfen |
| `ScriptHackMoney` | 1 | `:146` | Geld, das ein Skript-`hack()` vom Server abzieht |
| `ScriptHackMoneyGain` | 1 | `:153` | Anteil davon, den der Spieler tatsaechlich bekommt |
| `ServerGrowthRate` | 1 | `:156` | Wachstumsrate je grow()-Zyklus |
| `ServerMaxMoney` | 1 | `:159` | Hoechstgeld eines Servers |
| `ServerStartingMoney` | 1 | `:162` | Startgeld eines Servers |
| `ServerStartingSecurity` | 1 | `:165` | Startsicherheit eines Servers |
| `ServerWeakenRate` | 1 | `:168` | Wirkung von weaken() |
| `StrengthLevelMultiplier` | 1 | `:171` | Strength-Levelskalierung |
| `StaneksGiftPowerMultiplier` | 1 | `:174` | Staerke von Staneks Gabe |
| **`StaneksGiftExtraSize`** | **0** | `:177` | Zusatzgroesse von Staneks Gabe (additiv) |
| `WorldDaemonDifficulty` | 1 | `:180` | Faktor auf das noetige Hacking-Level von `w0r1d_d43m0n` |

**Praktisch heisst das:** In BitNode 1 gelten die reinen Grundformeln. Kein Faktor
verzerrt Geld, Sicherheit, exp oder Preise. Wer hier eine Strategie kalibriert,
kalibriert am unverfaelschten Modell — muss sie aber fuer jeden weiteren BitNode neu
rechnen.

**Anwendungspunkt:** `initBitNodeMultipliers()` (`src/BitNode/BitNode.tsx:1126`) ruft
`getBitNodeMultipliers(Player.bitNodeN, Player.activeSourceFileLvl(Player.bitNodeN) + 1)`.
Der zweite Parameter `lvl` wird ausschliesslich in BitNode 12 ausgewertet.

---

## 2. BitNode 2 bis 15 — Kurzuebersicht

Funktion: `getBitNodeMultipliers(n, lvl)` in `src/BitNode/BitNode.tsx:570`.
Nur genannte Felder weichen von 1 ab; alles Uebrige bleibt auf dem BN1-Wert.

### BN2 — "Rise of the Underworld" (`src/BitNode/BitNode.tsx:575`)

Neue Mechanik: eigene **Gang**. Sieben Fraktionen bieten sie an; die Gang-Fraktion hat
mehr Augmentierungen als andere und bietet in BN2 auch **The Red Pill**.

Mults: `HackingLevelMultiplier 0.8`, `ServerGrowthRate 0.8`, `ServerMaxMoney 0.08`,
`ServerStartingMoney 0.4`, `CloudServerSoftcap 1.3`, `CrimeMoney 3`,
`FactionPassiveRepGain 0`, `FactionWorkRepGain 0.5`, `CorporationSoftcap 0.9`,
`CorporationDivisions 0.9`, `InfiltrationMoney 3`, `StaneksGiftPowerMultiplier 2`,
`StaneksGiftExtraSize -6`, `WorldDaemonDifficulty 5`.

Merke: `ServerMaxMoney 0.08` — Hacken ist hier fast wertlos, Verbrechen und Infiltration
sind es dreifach wert. Und `w0r1d_d43m0n` braucht **15000** Hacking.

**SF2:** Gangs in anderen BitNodes (ab einem bestimmten negativen Karma). Zusaetzlich
Crime-Erfolgsquote, Crime-Geld und Charisma-Mults +24 % / +36 % / +42 %.

### BN3 — "Corporatocracy" (`:599`)

Neue Mechanik: eigener **Konzern**.

Mults: `HackingLevelMultiplier 0.8`, `ServerGrowthRate 0.2`, `ServerMaxMoney 0.04`,
`ServerStartingMoney 0.2`, `HomeComputerRamCost 1.5`, `CloudServerCost 2`,
`CloudServerSoftcap 1.3`, `CompanyWorkMoney 0.25`, `CrimeMoney 0.25`,
`HacknetNodeMoney 0.25`, `ScriptHackMoney 0.2`, `FavorToDonateToFaction 0.5`,
`AugmentationMoneyCost 3`, `AugmentationRepCost 3`, `GangSoftcap 0.9`,
`GangUniqueAugs 0.5`, `StaneksGiftPowerMultiplier 0.75`, `StaneksGiftExtraSize -2`,
`DarknetMoneyMultiplier 0.4`, `WorldDaemonDifficulty 2`.

**SF3:** Konzerne in anderen BitNodes, Stufe 3 schaltet die volle Corporation-API
dauerhaft frei. Charisma und Firmengehalt +8 % / +12 % / +14 %.

### BN4 — "The Singularity" (`:633`)

Neue Mechanik: die **Singularity-API** — Skripte koennen Fraktionsarbeit, Firmenarbeit,
Augmentierungskauf, Programmerstellung usw. steuern.

Mults: `ServerMaxMoney 0.1125`, `ServerStartingMoney 0.75`, `CloudServerSoftcap 1.2`,
`CompanyWorkMoney 0.1`, `CrimeMoney 0.2`, `HacknetNodeMoney 0.05`, `ScriptHackMoney 0.2`,
`ClassGymExpGain 0.5`, `CompanyWorkExpGain 0.5`, `CrimeExpGain 0.5`,
`FactionWorkExpGain 0.5`, `HackExpGain 0.4`, `FactionWorkRepGain 0.75`,
`GangUniqueAugs 0.5`, `StaneksGiftPowerMultiplier 1.5`, `StaneksGiftExtraSize 0`,
`DarknetMoneyMultiplier 0.4`, `WorldDaemonDifficulty 3`.

**SF4:** Singularity ausserhalb von BN4. Details in Abschnitt 3.

### BN5 — "Artificial Intelligence" (`:663`)

Mults: `ServerStartingSecurity 2`, `ServerStartingMoney 0.5`, `CloudServerSoftcap 1.2`,
`CrimeMoney 0.5`, `HacknetNodeMoney 0.2`, `ScriptHackMoney 0.15`, `HackExpGain 0.5`,
`AugmentationMoneyCost 2`, `InfiltrationMoney 1.5`, `InfiltrationRep 1.5`,
`CorporationValuation 0.75`, `CorporationDivisions 0.75`, `GangUniqueAugs 0.5`,
`StaneksGiftPowerMultiplier 1.3`, `StaneksGiftExtraSize 0`, `DarknetMoneyMultiplier 0.7`,
`WorldDaemonDifficulty 1.5`.

**SF5:** neuer, dauerhafter Wert **Intelligence**; `ns.getBitNodeMultipliers()`;
dauerhafter Zugang zu `Formulas.exe`; BitNode-Multiplikatoren auf der Stats-Seite.
Alle Hacking-Mults +8 % / +12 % / +14 %. Details in Abschnitt 3.

### BN6 — "Bladeburners" (`:694`)

Mults: `HackingLevelMultiplier 0.35`, `ServerMaxMoney 0.2`, `ServerStartingMoney 0.5`,
`ServerStartingSecurity 1.5`, `CloudServerSoftcap 2`, `CompanyWorkMoney 0.5`,
`CrimeMoney 0.75`, `HacknetNodeMoney 0.2`, `ScriptHackMoney 0.75`, `HackExpGain 0.25`,
`InfiltrationMoney 0.75`, `CorporationValuation 0.2`, `CorporationSoftcap 0.9`,
`CorporationDivisions 0.8`, `GangSoftcap 0.7`, `GangUniqueAugs 0.2`,
**`DaedalusAugsRequirement 35`**, `StaneksGiftPowerMultiplier 0.5`,
`StaneksGiftExtraSize 2`, `WorldDaemonDifficulty 2`.

**SF6:** Bladeburner in anderen BitNodes. Level **und** exp-Rate aller Kampfwerte
+8 % / +12 % / +14 %.

### BN7 — "Bladeburners 2079" (`:728`)

Wie BN6, aber mit Bladeburner-Straffaktoren: zusaetzlich `ScriptHackMoney 0.5` statt 0.75,
`AugmentationMoneyCost 3`, `FourSigmaMarketDataCost 2`, `FourSigmaMarketDataApiCost 2`,
`BladeburnerRank 0.6`, `BladeburnerSkillCost 2`, `StaneksGiftPowerMultiplier 0.9`,
`StaneksGiftExtraSize -1`. `DaedalusAugsRequirement 35`, `WorldDaemonDifficulty 2`.

**SF7:** Bladeburner in anderen BitNodes. Alle Bladeburner-Mults +8 % / +12 % / +14 %;
Stufe 3 gibt zusaetzlich sofort die Augmentierung "The Blade's Simulacrum" beim Beitritt.

### BN8 — "Ghost of Wall Street" (`:770`)

Startgeld 250 Mio, WSE-Mitgliedschaft und TIX-API von Anfang an, Shorts und
Limit/Stop-Orders erlaubt.

Mults: `CloudServerSoftcap 4`, **`CompanyWorkMoney 0`, `CrimeMoney 0`,
`HacknetNodeMoney 0`, `ManualHackMoney 0`, `ScriptHackMoneyGain 0`,
`CodingContractMoney 0`, `InfiltrationMoney 0`**, `ScriptHackMoney 0.3`,
`FavorToDonateToFaction 0`, `CorporationValuation 0`, `CorporationSoftcap 0`,
`CorporationDivisions 0`, `BladeburnerRank 0`, **`DarknetLabyrinthRewardsTheRedPill 0`**,
`DarknetMoneyMultiplier 0`, `GangSoftcap 0`, `GangUniqueAugs 0`,
`StaneksGiftExtraSize -99`.

Merke: Jede Geldquelle ausser der Boerse ist auf null gestellt. `ScriptHackMoney 0.3`
zieht zwar Geld vom Server ab, aber `ScriptHackMoneyGain 0` heisst, der Spieler bekommt
davon nichts — hack() ist hier nur noch ein Werkzeug zur Kursmanipulation.
BN8 ist ausserdem der **einzige** BitNode in v3.0.1, in dem The Red Pill nicht im
Labyrinth liegen kann.

**SF8:** Stufe 1 dauerhafter Zugang zu WSE und TIX-API, Stufe 2 Shorts, Stufe 3
Limit/Stop-Orders. Hacking-Growth-Mults +12 % / +18 % / +21 %.

### BN9 — "Hacktocracy" (`:801`)

Neue Mechanik: **Hacknet Server** statt Hacknet Nodes; erzeugen Hashes statt Geld.

Mults: `HackingLevelMultiplier 0.5`, alle fuenf uebrigen Levelmults `0.45`,
`ServerMaxMoney 0.01`, `ServerStartingMoney 0.1`, `ServerStartingSecurity 2.5`,
`HomeComputerRamCost 5`, **`CloudServerLimit 0`**, `CrimeMoney 0.5`,
`ScriptHackMoney 0.1`, `HackExpGain 0.05`, `FourSigmaMarketDataCost 5`,
`FourSigmaMarketDataApiCost 4`, `CorporationValuation 0.5`, `CorporationSoftcap 0.75`,
`CorporationDivisions 0.8`, `BladeburnerRank 0.9`, `BladeburnerSkillCost 1.2`,
`GangSoftcap 0.8`, `GangUniqueAugs 0.25`, `StaneksGiftPowerMultiplier 0.5`,
`StaneksGiftExtraSize 2`, `DarknetMoneyMultiplier 0.05`, `WorldDaemonDifficulty 2`.

`CloudServerLimit 0` heisst: **keine gekauften Server**. Das gesamte RAM muss aus `home`,
aus gehackten Fremdservern und aus Hacknet-Servern kommen.

**SF9:** Details in Abschnitt 3.

### BN10 — "Digital Carbon" (`:844`)

Neue Mechanik: **Sleeves** und **Grafting**.

Mults: `HackingLevelMultiplier 0.35`, uebrige Levelmults `0.4`, `HomeComputerRamCost 1.5`,
`CloudServerCost 5`, `CloudServerSoftcap 1.1`, `CloudServerLimit 0.6`,
`CloudServerMaxRam 0.5`, `CompanyWorkMoney 0.5`, `CrimeMoney 0.5`, `HacknetNodeMoney 0.5`,
`ManualHackMoney 0.5`, `ScriptHackMoney 0.5`, `CodingContractMoney 0.5`,
`AugmentationMoneyCost 5`, `AugmentationRepCost 2`, `InfiltrationMoney 0.5`,
`CorporationValuation 0.5`, `CorporationSoftcap 0.9`, `CorporationDivisions 0.9`,
`BladeburnerRank 0.8`, `GangSoftcap 0.9`, `GangUniqueAugs 0.25`,
`StaneksGiftPowerMultiplier 0.75`, `StaneksGiftExtraSize -3`,
`DarknetMoneyMultiplier 0.4`, `WorldDaemonDifficulty 2`.

**SF10:** Sleeve- und Grafting-API in anderen BitNodes. **Jede Stufe gibt einen
zusaetzlichen Sleeve.**

### BN11 — "The Big Crash" (`:889`)

Mults: `HackingLevelMultiplier 0.6`, `ServerGrowthRate 0.2`, `ServerMaxMoney 0.01`,
`ServerStartingMoney 0.1`, **`ServerWeakenRate 2`**, `CloudServerSoftcap 2`,
`CompanyWorkMoney 0.5`, **`CrimeMoney 3`**, `HacknetNodeMoney 0.1`,
`CodingContractMoney 0.25`, `HackExpGain 0.5`, `AugmentationMoneyCost 2`,
**`InfiltrationMoney 2.5`, `InfiltrationRep 2.5`**, `FourSigmaMarketDataCost 4`,
`FourSigmaMarketDataApiCost 4`, `CorporationValuation 0.1`, `CorporationSoftcap 0.9`,
`CorporationDivisions 0.9`, `GangUniqueAugs 0.75`, `WorldDaemonDifficulty 1.5`.

**SF11:** Firmengunst erhoeht **sowohl** Gehalt **als auch** Reputationsrate um 1 % je
Gunstpunkt (sonst nur Reputation). Firmengehalt und Firmenreputation
+32 % / +48 % / +56 %. Preisaufschlag je gekaufter Augmentierung -4 % / -6 % / -7 %.

### BN12 — "The Recursion" (`:924`)

Der einzige BitNode ohne Stufenobergrenze. Jeder Durchgang macht ihn haerter.

```ts
src/BitNode/BitNode.tsx:925-926
const inc = Math.pow(1.02, lvl);
const dec = 1 / inc;
```

`lvl` ist `activeSourceFileLvl(12) + 1`. Damit skalieren praktisch **alle** Werte:
`DaedalusAugsRequirement = floor(min(30 + inc, 40))`, alle sechs Levelmults `dec`,
`ServerGrowthRate dec`, **`ServerMaxMoney dec*dec`**, `ServerStartingMoney dec`,
`ServerWeakenRate dec`, `ServerStartingSecurity 1.5` (bewusst **nicht** skaliert, sonst
starteten Server jenseits 300 Sicherheit — Kommentar im Code bei `:938`),
`HomeComputerRamCost inc`, alle vier Cloud-Server-Werte, alle Geldquellen `dec`,
alle exp-Quellen `dec`, `FavorToDonateToFaction inc`, `AugmentationMoneyCost inc`,
`AugmentationRepCost inc`, `FourSigmaMarketData*Cost inc`, `CorporationValuation dec`,
`CorporationSoftcap 0.8`, `CorporationDivisions 0.5`, `BladeburnerRank dec`,
`BladeburnerSkillCost inc`, `GangSoftcap 0.8`, `GangUniqueAugs dec`,
`StaneksGiftPowerMultiplier inc`, `StaneksGiftExtraSize inc`, `WorldDaemonDifficulty inc`.

**SF12:** Man startet jeden BitNode mit so vielen Stufen NeuroFlux Governor, wie das
Source File hat. Kein Maximallevel.

### BN13 — "They're lunatics" (`:996`)

Neue Mechanik: **Church of the Machine God**, Staneks Gabe.

Mults: `HackingLevelMultiplier 0.25`, uebrige Kampf-Levelmults `0.7`,
`CloudServerSoftcap 1.6`, `ServerMaxMoney 0.3375`, `ServerStartingMoney 0.75`,
`ServerStartingSecurity 3`, `CompanyWorkMoney 0.4`, `CrimeMoney 0.4`,
`HacknetNodeMoney 0.4`, `ScriptHackMoney 0.2`, `CodingContractMoney 0.4`,
`ClassGymExpGain 0.5`, `CompanyWorkExpGain 0.5`, `CrimeExpGain 0.5`,
`FactionWorkExpGain 0.5`, `HackExpGain 0.1`, `FactionWorkRepGain 0.6`,
`FourSigmaMarketDataCost 10`, `FourSigmaMarketDataApiCost 10`,
**`CorporationValuation 0.001`**, `CorporationSoftcap 0.4`, `CorporationDivisions 0.4`,
`BladeburnerRank 0.45`, `BladeburnerSkillCost 2`, `GangSoftcap 0.3`,
`GangUniqueAugs 0.1`, `StaneksGiftPowerMultiplier 2`, `StaneksGiftExtraSize 1`,
`DarknetMoneyMultiplier 0.1`, `WorldDaemonDifficulty 3`.

**Achtung:** BN13 setzt in v3.0.1 **kein** `CharismaLevelMultiplier`. Im dev-Branch steht
dort zusaetzlich `CharismaLevelMultiplier: 0.7` — siehe Abschnitt "Abweichungen".

**SF13:** Die Church erscheint in anderen BitNodes. Jede Stufe vergroessert Staneks Gabe.
Hinweis im Spieltext: Wer SF7.3 hat, muss die Gabe **vor** dem Bladeburner-Beitritt
annehmen.

### BN14 — "IPvGO Subnet Takeover" (`:1044`)

Mults: **`GoPower 4`**, `HackingLevelMultiplier 0.4`, **`HackingSpeedMultiplier 0.3`**,
`ServerMaxMoney 0.7`, `ServerStartingMoney 0.5`, `ServerStartingSecurity 1.5`,
`CrimeMoney 0.75`, **`CrimeSuccessRate 0.4`**, `HacknetNodeMoney 0.25`,
`ScriptHackMoney 0.3`, vier Kampf-Levelmults `0.5`, `AugmentationMoneyCost 1.5`,
`InfiltrationMoney 0.75`, `FactionWorkRepGain 0.2`, `CompanyWorkRepGain 0.2`,
`CorporationValuation 0.4`, `CorporationSoftcap 0.9`, `CorporationDivisions 0.8`,
`BladeburnerRank 0.6`, `BladeburnerSkillCost 2`, `GangSoftcap 0.7`, `GangUniqueAugs 0.4`,
`StaneksGiftPowerMultiplier 0.5`, `StaneksGiftExtraSize -1`,
**`WorldDaemonDifficulty 5`**.

`HackingSpeedMultiplier 0.3` ist der einzige Ort ausser BN15, an dem dieser Faktor
ueberhaupt gesetzt wird — hack/grow/weaken laufen hier gut dreimal so lange.

**SF14:** Stufe 1 +100 % Statmultiplikatoren aus Node Power, Stufe 2 dauerhaft die
`go.cheat`-API, Stufe 3 zusaetzlich +25 Prozentpunkte Erfolgsquote fuer `go.cheat`.
Ausserdem hoehere Gunstobergrenzen aus Siegesserien (200k / 300k / 400k Rep-Aequivalent)
und mehr Rep je Doppelsieg (1000 / 1500 / 2000).

### BN15 — "The Secrets of the Dark Net" (`:1089`)

Neue Mechanik: das volle **DarkNet** (siehe Abschnitt 0). In BN15 hat Daedalus The Red
Pill **nicht**; sie liegt stattdessen im Labyrinth.

Mults: `HackingLevelMultiplier 0.6`, `HackingSpeedMultiplier 0.6`, Kampf-Levelmults `0.7`,
**`CharismaLevelMultiplier 1.1`** (der einzige Levelmult ueber 1 im ganzen Spiel),
`ServerMaxMoney 0.8`, `ServerStartingMoney 0.5`, `ServerStartingSecurity 1.5`,
`AugmentationMoneyCost 3`, `CorporationValuation 0.2`, `CorporationSoftcap 0.4`,
`CorporationDivisions 0.4`, **`DaedalusAugsRequirement 20`**, `BladeburnerRank 0.2`,
`BladeburnerSkillCost 3`, `GangUniqueAugs 0.3`, `StaneksGiftPowerMultiplier 0.7`,
`StaneksGiftExtraSize -2`, `WorldDaemonDifficulty 2`.

**SF15:** Stufe 1 dauerhaft TOR-Router und `DarkscapeNavigator.exe` sowie das volle
Darkweb in allen BitNodes. Stufe 2 Charisma erhoeht Gehalt und Firmenreputation, dazu
+20 % Authentifizierungstempo. Stufe 3 Charisma erhoeht auch Fraktionsreputation, dazu
+50 % exp und Geld aus `.cache`-Dateien.

Gueltige BitNode-Nummern: 1 bis 15 (`src/BitNode/Constants.ts:1`).

---

## 3. Einen BitNode gewinnen — The Red Pill und w0r1d_d43m0n

### 3.1 Der Zielserver

Statische Daten, `src/Server/data/servers.ts:1530-1539`:

```ts
{
  hackDifficulty: 0,
  hostname: SpecialServers.WorldDaemon,   // "w0r1d_d43m0n"
  moneyAvailable: 0,
  numOpenPortsRequired: 5,
  organizationName: SpecialServers.WorldDaemon,
  requiredHackingSkill: 3000,
  serverGrowth: 0,
  specialName: SpecialServers.WorldDaemon,
},
```

**Kein `networkLayer`.** Der Server wird also nie in eine Netzebene einsortiert und haengt
nach der Netzerzeugung an gar nichts (`src/Server/ServerHelpers.ts:386-388`).

Das noetige Hacking-Level wird beim Aufbau mit dem BitNode-Faktor multipliziert,
`src/Server/ServerHelpers.ts:383-385`:

```ts
if (server.hostname === SpecialServers.WorldDaemon) {
  server.requiredHackingSkill *= currentNodeMults.WorldDaemonDifficulty;
}
```

**Benoetigtes Hacking-Level je BitNode:**

| BitNode | `WorldDaemonDifficulty` | Quelle | Hacking-Level |
| ---: | ---: | --- | ---: |
| 1 | 1 (Vorgabe) | `src/BitNode/BitNodeMultipliers.ts:180` | **3000** |
| 2 | 5 | `src/BitNode/BitNode.tsx:596` | 15000 |
| 3 | 2 | `:630` | 6000 |
| 4 | 3 | `:660` | 9000 |
| 5 | 1.5 | `:691` | 4500 |
| 6 | 2 | `:725` | 6000 |
| 7 | 2 | `:767` | 6000 |
| 8 | 1 (nicht gesetzt) | — | 3000 |
| 9 | 2 | `:841` | 6000 |
| 10 | 2 | `:886` | 6000 |
| 11 | 1.5 | `:921` | 4500 |
| 12 | `1.02^lvl` | `:993` | 3000 · 1.02^lvl |
| 13 | 3 | `:1041` | 9000 |
| 14 | 5 | `:1085` | 15000 |
| 15 | 2 | `:1120` | 6000 |

Ausserdem: **5 offene Ports** (also alle fuenf Port-Cracker: BruteSSH, FTPCrack,
relaySMTP, HTTPWorm, SQLInject) und `NUKE.exe` fuer Root.

### 3.2 Der Weg dorthin

**Schritt 1 — Daedalus beitreten.** `src/Faction/FactionInfo.tsx:138-149`:

```ts
inviteReqs: [
  delayedCondition(() => haveAugmentations(currentNodeMults.DaedalusAugsRequirement)),
  haveMoney(100e9),
  someCondition([haveSkill("hacking", 2500), haveCombatSkills(1500)]),
],
```

Also **gleichzeitig**:
- N **installierte** Augmentierungen — `haveAugmentations` prueft `p.augmentations.length`
  (`src/Faction/FactionJoinCondition.ts:116-132`), also nur installierte, keine
  vorgemerkten. N = `DaedalusAugsRequirement`: **30** in den meisten BitNodes, 35 in BN6
  und BN7, 20 in BN15, `floor(min(30 + 1.02^lvl, 40))` in BN12.
- **100 Mrd. Geld** (`haveMoney(100e9)`).
- **entweder** Hacking >= 2500 **oder** alle vier Kampfwerte >= 1500
  (`someCondition` = ODER, `src/Faction/FactionJoinCondition.ts:360`;
  `haveCombatSkills` prueft Strength, Defense, Dexterity, Agility zugleich, `:158-166`).

Nebenbei: `fl1ght.exe` zeigt den Fortschritt an, ist aber **nicht** die eigentliche
Bedingung und verlangt strenger Hacking >= 2500 ohne Kampf-Alternative
(`src/Programs/Programs.ts:324-353`). Nicht danach richten.

**Schritt 2 — The Red Pill kaufen.** `src/Augmentation/Augmentations.ts:1946-1953`:

```ts
[AugmentationName.TheRedPill]: {
  repCost: 2.5e6,
  moneyCost: 0,
  info: "It's time to leave the cave.",
  stats: "",
  isSpecial: true,
  factions: [FactionName.Daedalus],
},
```

**2,5 Mio Reputation bei Daedalus, kostenlos in Geld, ohne Statwirkung.**

**Schritt 3 — installieren.** Erst beim Prestige-Vorgang wird `w0r1d_d43m0n` ans Netz
gehaengt, `src/Prestige.ts:174-182`:

```ts
if (Player.hasAugmentation(AugmentationName.TheRedPill, true)) {
  const WorldDaemon = GetServer(SpecialServers.WorldDaemon);
  const DaedalusServer = GetServer(SpecialServers.DaedalusServer);
  if (WorldDaemon && DaedalusServer) {
    WorldDaemon.serversOnNetwork.push(DaedalusServer.hostname);
    DaedalusServer.serversOnNetwork.push(WorldDaemon.hostname);
  }
}
```

Der Server haengt also an **`The-Cave`** (Hacking 925, 5 Ports, Netzebene 15,
`src/Server/data/servers.ts:1518`). Ohne installierte Red Pill ist `w0r1d_d43m0n`
unerreichbar und wird ausserdem aus allen Serverauswahlen gefiltert
(`src/Server/ServerHelpers.ts:313-315`) sowie von der Coding-Contract-Vergabe
ausgenommen (`src/CodingContract/ContractGenerator.ts:206`).

**Schritt 4 — Backdoor setzen.** Vier Wege setzen `backdoorInstalled = true` und leiten
zur BitVerse-Seite:

| Weg | Quelle |
| --- | --- |
| Terminal `backdoor` | `src/Terminal/Terminal.ts:373-388` |
| Terminal `hack` (manuell, bei Erfolg) | `src/Terminal/Terminal.ts:270-276` |
| `ns.singularity.installBackdoor()` | `src/NetscriptFunctions/Singularity.ts:550-554` |
| letzte Bladeburner-BlackOp | `src/Bladeburner/ui/BlackOpPage.tsx:46` |

Der Zustand "BitNode geschafft" ist genau das: `wd.backdoorInstalled`
(`src/BitNode/BitNodeUtils.ts:9-15`).

**Skriptweg ohne Terminal:** `ns.singularity.destroyW0r1dD43m0n(nextBN)`
(`src/NetscriptFunctions/Singularity.ts:1153`). Die Pruefung dort ist bemerkenswert
(`:1170-1186`): sie verlangt `Player.skills.hacking >= wd.requiredHackingSkill` **und**
`wd.hasAdminRights` — **nicht** `backdoorInstalled` und **nicht** die Red-Pill-Augmentierung.
Alternativ genuegt die volle Bladeburner-BlackOp-Reihe.
In v3.0.1 ist `nextBN` **Pflichtargument**.

**Schritt 5 — Belohnung.** `src/RedPill.tsx:16-51` (`giveSourceFile`) und `:53`
(`enterBitNode`): man erhaelt das Source File des zerstoerten BitNodes, bzw. eine
Stufe mehr. Obergrenze Stufe 3, ausser BN12 (`src/RedPill.tsx:28`).
Anschliessend `prestigeSourceFile` (`src/Prestige.ts:203`): alles wird zurueckgesetzt,
das Netz neu erzeugt, Home-RAM nach SF1/SF9 gesetzt (`:246-253`), Source-File-Boni neu
angewandt (`:270-271`), bei SF5 zusaetzlich 300 Intelligence-exp, sofern kein Bitflume
benutzt wurde (`:363-365`).

### 3.3 The Red Pill auch ohne Daedalus

**Zwei weitere Wege, beide in v3.0.1 vorhanden:**

**(a) Gang in BN2.** `src/Faction/FactionHelpers.tsx:172-183` — die Gang-Fraktion bietet
alle nicht-speziellen Augmentierungen an und in BN2 zusaetzlich The Red Pill.

**(b) Darknet-Labyrinth.** Gesteuert vom Multiplikator
`DarknetLabyrinthRewardsTheRedPill` (Vorgabe 1, `src/BitNode/BitNodeMultipliers.ts:63-64`).
**Der einzige BitNode, der ihn in v3.0.1 auf 0 setzt, ist BN8**
(`src/BitNode/BitNode.tsx:792`). In allen anderen, **auch in BN1**, liegt The Red Pill
im Labyrinth.

Auswahl in `src/DarkNet/effects/labyrinth.ts:403-430`:
- **BN15:** The Red Pill ist die fuenfte Cache-Belohnung, im `et3rn4l_l4byr1nth`.
- **Alle anderen ausser BN8:** siebte Belohnung, nach den sechs Labor-Augmentierungen
  (The Broken Wings, The Boots, The Hammer, The Staff, The Law, The Sword), im
  `f1n4l_l4byr1nth` (Tiefe 36, Charisma 4000, `src/DarkNet/effects/labyrinth.ts:92-100`).
- Vergeben wird sie direkt in die Warteschlange, ohne Fraktion, ohne Reputation, ohne
  Geld (`src/DarkNet/effects/cacheFiles.ts:173-180`, `Player.queueAugmentation(reward)`).

**Harte Voraussetzung fuer das Labyrinth:** `hasFullDarknetAccess()`
(`src/DarkNet/effects/effects.ts:280`) — `Player.bitNodeN === 15 || activeSourceFileLvl(15) > 0`.
Das gekaufte `DarkscapeNavigator.exe` reicht dafuer **nicht**; es oeffnet nur das
allgemeine DarkNet, nicht die Labore.

Praktisch heisst das: **In BN1 ohne SF15 fuehrt kein Weg an Daedalus vorbei.**
Mit SF15 aus einem frueheren Durchlauf gibt es die Abkuerzung ueber das Labyrinth,
die 30 Augmentierungen und 100 Mrd. spart.

---

## 4. Source Files 1, 4, 5 und 9 im Detail

Angewandt werden Source Files in `src/SourceFile/applySourceFile.ts`, aufgerufen aus
`src/PersonObjects/Player/PlayerObjectGeneralMethods.ts:432-447`
(`reapplyAllSourceFiles`). **Wichtig: Source Files veraendern `Player.mults`, niemals
`currentNodeMults`.** Es sind also Spielerboni, keine BitNode-Regeln.

Stufenabfrage: `Player.sourceFileLvl(n)` bzw. `Player.activeSourceFileLvl(n)`
(`src/PersonObjects/Player/PlayerObjectGeneralMethods.ts:611-620`). `active...`
beruecksichtigt BitNode-Optionen, mit denen man Source Files absichtlich herunterstufen
kann. Der allgemeine Freischalttest ist `canAccessBitNodeFeature(n)`
(`src/BitNode/BitNodeUtils.ts:17-19`): im BitNode selbst oder SF-Stufe > 0.

### SF1 — Source Genesis

`src/SourceFile/applySourceFile.ts:14-49`:

```ts
case 1: {
  let mult = 0;
  for (let i = 0; i < lvl; ++i) {
    mult += 16 / Math.pow(2, i);
  }
  const incMult = 1 + mult / 100;
  const decMult = 1 / incMult;
```

Die Reihe ist `16 / 2^i`:

| Stufe | Summe | Aufschlag | Abschlag (`1/incMult`) |
| ---: | ---: | ---: | ---: |
| 1 | 16 | ×1,16 | ×0,8621 |
| 2 | 16 + 8 = 24 | ×1,24 | ×0,8065 |
| 3 | 16 + 8 + 4 = 28 | ×1,28 | ×0,7813 |

Erhoeht (×`incMult`, `:22-47`): `hacking_chance`, `hacking_speed`, `hacking_money`,
`hacking_grow`, `hacking`, `strength`, `defense`, `dexterity`, `agility`, `charisma`,
alle sechs `*_exp`, `company_rep`, `faction_rep`, `crime_money`, `crime_success`,
`hacknet_node_money`, `work_money`.
Gesenkt (×`decMult`): `hacknet_node_purchase_cost`, `hacknet_node_ram_cost`,
`hacknet_node_core_cost`, `hacknet_node_level_cost`.

**32 GB Home-RAM** gilt nur beim **Betreten eines BitNodes**, nicht beim Installieren von
Augmentierungen — `src/Prestige.ts:246-253`:

```ts
if (Player.activeSourceFileLvl(9) >= 2) {
  homeComp.setMaxRam(128);
} else if (Player.activeSourceFileLvl(1) > 0) {
  homeComp.setMaxRam(32);
} else {
  homeComp.setMaxRam(8);
}
```

SF9.2 sticht SF1. Ohne beides sind es 8 GB.

### SF4 — The Singularity

**SF4 gibt keinerlei Statboni**, `src/SourceFile/applySourceFile.ts:73-77`:

```ts
case 4: {
  // The Singularity
  // No effects, just gives access to Singularity functions
  break;
}
```

Es geht ausschliesslich um Zugang und RAM-Preis.

**Ohne SF4 werfen die Funktionen einen Fehler**, sie geben nicht still etwas zurueck.
`src/Netscript/NetscriptHelpers.tsx:387-396`:

```ts
function checkSingularityAccess(ctx: NetscriptContext): void {
  if (!canAccessBitNodeFeature(4)) {
    throw errorMessage(
      ctx,
      `This singularity function requires Source-File 4 to run. A power up you obtain later in the game. It will be very obvious when and how you can obtain it.`,
      "API ACCESS",
    );
  }
}
```

Jede Singularity-Umsetzung ruft das als erste Anweisung auf
(`src/NetscriptFunctions/Singularity.ts`, rund 70 Stellen).
**Merke: Das RAM wird trotzdem berechnet und muss vorhanden sein, bevor der Fehler
ueberhaupt geworfen werden kann.**

#### Die RAM-Skalierung

`src/Netscript/RamCostGenerator.ts:82-96`:

```ts
function SF4Cost(cost: number): () => number {
  return () => {
    if (Player.bitNodeN === 4) {
      return cost;
    }
    const sf4 = Player.activeSourceFileLvl(4);
    if (sf4 <= 1) {
      return cost * 16;
    }
    if (sf4 === 2) {
      return cost * 4;
    }
    return cost;
  };
}
```

Zwei Feinheiten, die man leicht uebersieht:

1. **`sf4 <= 1` — ohne SF4 und mit SF4.1 zahlt man denselben Faktor 16.** Stufe 1 macht
   die Funktionen nur *nutzbar*, nicht *billiger*.
2. **Innerhalb von BN4 ist der Faktor immer 1**, unabhaengig von der SF-Stufe.

Aufgeloest wird der Wert erst bei Bedarf (`getRamCost`,
`src/Netscript/RamCostGenerator.ts:751-772`), und der zwischengespeicherte RAM-Bedarf von
Skripten wird beim BitNode-Wechsel geleert (`src/Prestige.ts:236-237`).

Grundkosten, `src/Netscript/RamCostGenerator.ts:55-57`:
`SingularityFn1 = 2`, `SingularityFn2 = 3`, `SingularityFn3 = 5`.
Dazu kommt immer der Skript-Grundbedarf `RamCostConstants.Base = 1.6`
(`src/Netscript/RamCostGenerator.ts:11`).

#### Vollstaendige RAM-Tabelle der Singularity-API (64 Funktionen)

Quelle: `src/Netscript/RamCostGenerator.ts:157-222`.
Spalte "Basis" = Kosten in BN4 oder mit SF4.3.

| Funktion | Zeile | Ausdruck | Basis (GB) | SF4.2 (×4) | SF4.1 / kein SF4 (×16) |
| --- | ---: | --- | ---: | ---: | ---: |
| `isFocused` | 213 | 0.1 | 0,1 | 0,4 | 1,6 |
| `setFocus` | 214 | 0.1 | 0,1 | 0,4 | 1,6 |
| `cat` | 167 | Fn1/4 | 0,5 | 2 | 8 |
| `getDarkwebProgramCost` | 171 | Fn1/4 | 0,5 | 2 | 8 |
| `getDarkwebPrograms` | 172 | Fn1/4 | 0,5 | 2 | 8 |
| `hospitalize` | 173 | Fn1/4 | 0,5 | 2 | 8 |
| `isBusy` | 174 | Fn1/4 | 0,5 | 2 | 8 |
| `exportGameBonus` | 217 | Fn1/4 | 0,5 | 2 | 8 |
| `getCurrentWork` | 220 | 0.5 | 0,5 | 2 | 8 |
| `getCompanyFavorGain` | 185 | Fn2/4 | 0,75 | 3 | 12 |
| `getFactionFavorGain` | 194 | Fn2/4 | 0,75 | 3 | 12 |
| `stopAction` | 175 | Fn1/2 | 1 | 4 | 16 |
| `getCompanyRep` | 183 | Fn2/3 | 1 | 4 | 16 |
| `getCompanyFavor` | 184 | Fn2/3 | 1 | 4 | 16 |
| `getFactionWorkTypes` | 191 | Fn2/3 | 1 | 4 | 16 |
| `getFactionRep` | 192 | Fn2/3 | 1 | 4 | 16 |
| `getFactionFavor` | 193 | Fn2/3 | 1 | 4 | 16 |
| `getSaveData` | 215 | Fn1/2 | 1 | 4 | 16 |
| `exportGame` | 216 | Fn1/2 | 1 | 4 | 16 |
| `getUpgradeHomeRamCost` | 178 | Fn2/2 | 1,5 | 6 | 24 |
| `getUpgradeHomeCoresCost` | 179 | Fn2/2 | 1,5 | 6 | 24 |
| `universityCourse` | 158 | Fn1 | 2 | 8 | 32 |
| `gymWorkout` | 159 | Fn1 | 2 | 8 | 32 |
| `travelToCity` | 160 | Fn1 | 2 | 8 | 32 |
| `purchaseTor` | 162 | Fn1 | 2 | 8 | 32 |
| `purchaseProgram` | 163 | Fn1 | 2 | 8 | 32 |
| `getCurrentServer` | 164 | Fn1 | 2 | 8 | 32 |
| `getCompanyPositionInfo` | 165 | Fn1 | 2 | 8 | 32 |
| `getCompanyPositions` | 166 | Fn1 | 2 | 8 | 32 |
| `connect` | 168 | Fn1 | 2 | 8 | 32 |
| `manualHack` | 169 | Fn1 | 2 | 8 | 32 |
| `installBackdoor` | 170 | Fn1 | 2 | 8 | 32 |
| `getAugmentationPrice` | 206 | Fn3/2 | 2,5 | 10 | 40 |
| `getAugmentationBasePrice` | 207 | Fn3/2 | 2,5 | 10 | 40 |
| `getAugmentationRepReq` | 208 | Fn3/2 | 2,5 | 10 | 40 |
| `upgradeHomeRam` | 176 | Fn2 | 3 | 12 | 48 |
| `upgradeHomeCores` | 177 | Fn2 | 3 | 12 | 48 |
| `workForCompany` | 180 | Fn2 | 3 | 12 | 48 |
| `applyToCompany` | 181 | Fn2 | 3 | 12 | 48 |
| `quitJob` | 182 | Fn2 | 3 | 12 | 48 |
| `getFactionInviteRequirements` | 186 | Fn2 | 3 | 12 | 48 |
| `getFactionEnemies` | 187 | Fn2 | 3 | 12 | 48 |
| `checkFactionInvitations` | 188 | Fn2 | 3 | 12 | 48 |
| `joinFaction` | 189 | Fn2 | 3 | 12 | 48 |
| `workForFaction` | 190 | Fn2 | 3 | 12 | 48 |
| `goToLocation` | 161 | Fn3 | 5 | 20 | 80 |
| `donateToFaction` | 195 | Fn3 | 5 | 20 | 80 |
| `createProgram` | 196 | Fn3 | 5 | 20 | 80 |
| `getHackingLevelRequirementOfProgram` | 197 | Fn3 | 5 | 20 | 80 |
| `commitCrime` | 198 | Fn3 | 5 | 20 | 80 |
| `getCrimeChance` | 199 | Fn3 | 5 | 20 | 80 |
| `getCrimeStats` | 200 | Fn3 | 5 | 20 | 80 |
| `getOwnedAugmentations` | 201 | Fn3 | 5 | 20 | 80 |
| `getOwnedSourceFiles` | 202 | Fn3 | 5 | 20 | 80 |
| `getAugmentationFactions` | 203 | Fn3 | 5 | 20 | 80 |
| `getAugmentationsFromFaction` | 204 | Fn3 | 5 | 20 | 80 |
| `getAugmentationPrereq` | 205 | Fn3 | 5 | 20 | 80 |
| `getAugmentationStats` | 209 | Fn3 | 5 | 20 | 80 |
| `purchaseAugmentation` | 210 | Fn3 | 5 | 20 | 80 |
| `softReset` | 211 | Fn3 | 5 | 20 | 80 |
| `installAugmentations` | 212 | Fn3 | 5 | 20 | 80 |
| `getUnlockedAchievements` | 221 | Fn3 | 5 | 20 | 80 |
| `b1tflum3` | 218 | 16 | 16 | 64 | 256 |
| `destroyW0r1dD43m0n` | 219 | 32 | 32 | 128 | 512 |

**Praktische Ableitung:** Mit SF4.1 auf einem 32-GB-Home-Rechner passt genau **eine**
Fn1-Funktion in ein Skript (32 GB Funktion + 1,6 GB Grundbedarf sprengt schon 32 GB —
man braucht 33,6 GB, also den naechsten Ausbau). Die billige Gruppe bei 8 GB
(`isBusy`, `getCurrentWork`, `cat`, `hospitalize`, `getDarkwebPrograms`,
`getDarkwebProgramCost`, `exportGameBonus`) und die 1,6-GB-Gruppe
(`isFocused`, `setFocus`) sind die einzigen, mit denen man frueh sinnvoll arbeiten kann.
**SF4.2 ist der eigentliche Sprung** (Faktor 16 auf 4), SF4.3 macht Singularity dann
praktisch kostenlos.

### SF5 — Artificial Intelligence

`src/SourceFile/applySourceFile.ts:78-92`: Reihe `8 / 2^i`.

| Stufe | Summe | Aufschlag |
| ---: | ---: | ---: |
| 1 | 8 | ×1,08 |
| 2 | 12 | ×1,12 |
| 3 | 14 | ×1,14 |

Betroffen sind genau sechs Werte: `hacking_chance`, `hacking_speed`, `hacking_money`,
`hacking_grow`, `hacking`, `hacking_exp`.

Freischaltungen (alle bereits ab Stufe 1):

| Sache | Quelle |
| --- | --- |
| Wert **Intelligence** wird ueberhaupt gezaehlt | `src/PersonObjects/Person.ts:154-159` (`overrideIntelligence`) und `:185-190` (`gainIntelligenceExp`) |
| `ns.getBitNodeMultipliers()` | `src/NetscriptFunctions.ts:914-919`, Fehlertext `"Requires Source-File 5 to run."` |
| `Formulas.exe` dauerhaft, bei jedem Reset | `src/Prestige.ts:93-95` (Aug-Installation) und `:277-279` (BitNode-Eintritt) |
| BitNode-Multiplikatoren auf der Stats-Seite | Spieltext `src/BitNode/BitNode.tsx:185-208` |
| +300 Intelligence-exp beim Zerstoeren eines BitNodes (kein Bitflume) | `src/Prestige.ts:363-365` |

Bemerkenswert: Die Intelligence-Pruefungen benutzen absichtlich `sourceFileLvl`, **nicht**
`activeSourceFileLvl` (Kommentar `src/PersonObjects/Person.ts:181-184`) — man kann
Intelligence also nicht per BitNode-Option wegschalten.

**Fuer die Strategie:** SF5 ist das wichtigste Werkzeug-Source-File. `Formulas.exe`
dauerhaft und `getBitNodeMultipliers()` bedeuten, dass ein Skript die eigenen Erträge
exakt vorausrechnen kann, statt sie zu messen.

### SF9 — Hacktocracy

`src/SourceFile/applySourceFile.ts:133-147`: Reihe `12 / 2^i`, aber mit **anderer**
Abschlagformel als SF1:

```ts
const incMult = 1 + mult / 100;
const decMult = 1 - mult / 100;   // SF1 benutzt hier 1 / incMult
```

| Stufe | Summe | Aufschlag | Abschlag |
| ---: | ---: | ---: | ---: |
| 1 | 12 | ×1,12 | ×0,88 |
| 2 | 18 | ×1,18 | ×0,82 |
| 3 | 21 | ×1,21 | ×0,79 |

Erhoeht: `hacknet_node_money`. Gesenkt: `hacknet_node_core_cost`,
`hacknet_node_level_cost`, `hacknet_node_purchase_cost`, `hacknet_node_ram_cost`.

Stufenwirkungen:

| Stufe | Wirkung | Quelle |
| ---: | --- | --- |
| 1 | Hacknet **Server** (statt Nodes) in anderen BitNodes dauerhaft frei | `src/Hacknet/HacknetHelpers.tsx:34-36` — `canAccessBitNodeFeature(9) && !bitNodeOptions.disableHacknetServer` |
| 2 | Start mit **128 GB** Home-RAM beim Betreten eines BitNodes | `src/Prestige.ts:246-247` |
| 3 | ein hochgeruesteter Hacknet-Server beim Betreten eines BitNodes: `level 100`, `cores 10`, `cpuCores 10`, `cache 5` | `src/Prestige.ts:336-348` |

Der Spieltext weist ausdruecklich darauf hin, dass die Stufe-3-Wirkung **nur beim Betreten
eines BitNodes** greift, nicht beim Installieren von Augmentierungen
(`src/BitNode/BitNode.tsx:336-354`).

**Fuer die Strategie:** SF9.2 (128 GB Start-RAM) ist der mit Abstand groesste
Fruehspielsprung im ganzen Spiel — Faktor 16 gegenueber den 8 GB ohne Source File und
Faktor 4 gegenueber SF1.

---

## 5. Die Serverliste — alle 70 Server

Quelle: `src/Server/data/servers.ts`, Feld `serverMetadata` ab `:63`.
Sortiert nach `requiredHackingSkill` aufsteigend.

### Wie aus den Rohdaten die Spielwerte werden

Konstruktor `src/Server/Server.ts:59-88`:

```ts
const baseMoney = params.moneyAvailable ?? 0;
this.moneyAvailable = baseMoney * currentNodeMults.ServerStartingMoney;
this.moneyMax = 25 * baseMoney * currentNodeMults.ServerMaxMoney;

const realDifficulty =
  params.hackDifficulty != null ? params.hackDifficulty * currentNodeMults.ServerStartingSecurity : 1;
this.hackDifficulty = Math.min(realDifficulty, 100);
this.baseDifficulty = this.hackDifficulty;
this.minDifficulty = Math.min(Math.max(1, Math.round(realDifficulty / 3)), 100);
```

Merksaetze:
- **`moneyMax` ist das 25-Fache des `moneyAvailable`-Werts aus den Metadaten.** Die Tabelle
  unten zeigt bereits `moneyMax`, nicht den Rohwert.
- **`minDifficulty` ist `hackDifficulty / 3`, kaufmaennisch gerundet**, mindestens 1,
  hoechstens 100.
- **Bereiche (`{min, max}`) werden beim Erzeugen einmal ausgewuerfelt**
  (`toNumber`, `src/Server/ServerHelpers.ts:350-353`, `getRandomIntInclusive`).
  Jeder neue BitNode-Durchlauf wuerfelt neu. **Die Tabelle nennt die Spannen; der konkrete
  Spielstand hat je Server einen festen Wert daraus.** Ein Skript muss die Werte also
  immer live mit `ns.getServerMaxMoney()` und `ns.getServerMinSecurityLevel()` abfragen,
  nie hart eintragen.
- **Falle mit dem Wert 0:** Die Uebernahme ist ein truthy-Test
  (`src/Server/ServerHelpers.ts:371-374`), also `if (metadata.hackDifficulty)`. Steht in
  den Metadaten eine 0, wird der Wert **nicht** uebernommen und der Server bekommt den
  Klassenstandard. Fuer alle Fraktionsserver bedeutet das: `hackDifficulty` 1 statt 0 und
  `serverGrowth` 1 statt 0. Die Tabelle zeigt die **tatsaechlichen** Spielwerte, nicht die
  Rohdaten.
- **`maxRam`** entsteht als `2^maxRamExponent` (`src/Server/ServerHelpers.ts:362-364`).
  Fehlt das Feld, ist `maxRam = 0` — der Server kann keine Skripte ausfuehren.
- **`cpuCores`** wird zufaellig aus `[ceil(layer/2), layer]` gezogen
  (`src/Server/ServerHelpers.ts:377-380`).

### Tabelle

| hostname | reqHack | moneyMax (BN1) | hackDifficulty | minDifficulty | serverGrowth | Ports | maxRam GB | Layer | Organisation / Rolle |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `foodnstuff` | 1 | 50m | 10 | 3 | 5 | 0 | 16 | 1 | Firmenserver (FoodNStuff) |
| `n00dles` | 1 | 1.75m | 1 | 1 | 3000 | 0 | 4 | 1 | Firmenserver (Noodle Bar) |
| `sigma-cosmetics` | 5 | 57.50m | 10 | 3 | 10 | 0 | 16 | 1 | Sigma Cosmetics |
| `joesguns` | 10 | 62.50m | 15 | 5 | 20 | 0 | 16 | 1 | Firmenserver (Joe's Guns) |
| `nectar-net` | 20 | 68.75m | 20 | 7 | 25 | 0 | 16 | 2 | Nectar Nightclub Network |
| `hong-fang-tea` | 30 | 75m | 15 | 5 | 20 | 0 | 16 | 1 | HongFang Teahouse |
| `harakiri-sushi` | 40 | 100m | 15 | 5 | 40 | 0 | 16 | 1 | HaraKiri Sushi Bar Network |
| `neo-net` | 50 | 125m | 25 | 8 | 25 | 1 | 32 | 3 | Neo Nightclub Network |
| `CSEC` | 51-60 | 0 | 1 | 1 | 1 | 1 | 8 | 2 | Faction-Gate: CyberSec |
| `zer0` | 75 | 187.50m | 25 | 8 | 40 | 1 | 32 | 2 | ZER0 Nightclub |
| `max-hardware` | 80 | 250m | 15 | 5 | 30 | 1 | 32 | 2 | Max Hardware Store |
| `iron-gym` | 100 | 500m | 30 | 10 | 20 | 1 | 32 | 1 | Firmenserver (Iron Gym Network) |
| `phantasy` | 100 | 600m | 20 | 7 | 35 | 2 | 32 | 3 | Phantasy Club |
| `silver-helix` | 150 | 1.13b | 30 | 10 | 30 | 2 | 64 | 3 | Silver Helix |
| `omega-net` | 180-220 | 1.50b - 1.75b | 25-35 | 8-12 | 30-40 | 2 | 32 | 3 | Firmenserver (Omega Software) |
| `avmnite-02h` | 202-220 | 0 | 1 | 1 | 1 | 2 | 16-128 | 4 | Faction-Gate: NiteSec |
| `crush-fitness` | 225-275 | 1b - 1.50b | 35-45 | 12-15 | 27-33 | 2 | 0 | 4 | Firmenserver (Crush Fitness) |
| `johnson-ortho` | 250-300 | 1.75b - 2.13b | 35-65 | 12-22 | 35-65 | 2 | 0 | 4 | Johnson Orthopedics |
| `the-hub` | 275-325 | 3.75b - 5b | 35-45 | 12-15 | 45-55 | 2 | 8-64 | 4 | The Hub |
| `computek` | 300-400 | 5.50b - 6.25b | 55-65 | 18-22 | 45-65 | 3 | 0 | 4 | Firmenserver (CompuTek) |
| `I.I.I.I` | 340-365 | 0 | 1 | 1 | 1 | 3 | 16-256 | 5 | Faction-Gate: The Black Hand |
| `rothman-uni` | 370-430 | 4.38b - 6.25b | 45-55 | 15-18 | 35-45 | 3 | 16-128 | 5 | Firmenserver (Rothman University) |
| `netlink` | 375-425 | 6.88b | 60-80 | 20-27 | 45-75 | 3 | 16-128 | 4 | Firmenserver (NetLink Technologies) |
| `aevum-police` | 400-450 | 5b - 10b | 70-80 | 23-27 | 30-50 | 4 | 16-64 | 6 | Firmenserver (Aevum Police Headquarters) |
| `catalyst` | 400-450 | 7.50b - 13.75b | 60-70 | 20-23 | 25-55 | 3 | 16-128 | 5 | Catalyst Ventures |
| `summit-uni` | 425-475 | 5b - 8.75b | 45-65 | 15-22 | 40-60 | 3 | 16-64 | 5 | Firmenserver (Summit University) |
| `millenium-fitness` | 475-525 | 6.25b | 45-55 | 15-18 | 25-45 | 3 | 16-256 | 6 | Firmenserver (Millenium Fitness Network) |
| `rho-construction` | 475-525 | 12.50b - 17.50b | 40-60 | 13-20 | 40-60 | 3 | 16-64 | 6 | Firmenserver (Rho Construction) |
| `alpha-ent` | 500-600 | 15b - 18.75b | 50-70 | 17-23 | 50-60 | 4 | 16-128 | 6 | Firmenserver (Alpha Enterprises) |
| `.` | 505-550 | 0 | 1 | 1 | 1 | 4 | 16 | 13 | Story (The Dark Army, kein Invite-Req) |
| `run4theh111z` | 505-550 | 0 | 1 | 1 | 1 | 4 | 32-512 | 11 | Faction-Gate: BitRunners |
| `syscore` | 550-650 | 10b - 15b | 60-80 | 20-27 | 60-70 | 4 | 0 | 5 | Firmenserver (SysCore Securities) |
| `lexo-corp` | 650-750 | 17.50b - 20b | 60-80 | 20-27 | 55-65 | 4 | 16-128 | 6 | Firmenserver (LexoCorp) |
| `snap-fitness` | 675-800 | 11.25b | 40-60 | 13-20 | 40-60 | 4 | 0 | 7 | Firmenserver (Snap Fitness) |
| `zb-institute` | 725-775 | 20b - 27.50b | 65-85 | 22-28 | 75-85 | 5 | 16-128 | 5 | Firmenserver (ZB Institute of Technology) |
| `global-pharm` | 750-850 | 37.50b - 43.75b | 75-85 | 25-28 | 80-90 | 4 | 8-64 | 7 | Firmenserver (Global Pharmaceuticals) |
| `solaris` | 750-850 | 17.50b - 22.50b | 70-80 | 23-27 | 70-80 | 5 | 16-128 | 9 | Firmenserver (Solaris Space Systems) |
| `applied-energetics` | 775-850 | 17.50b - 25b | 60-80 | 20-27 | 70-75 | 4 | 0 | 11 | Applied Energetics |
| `nova-med` | 775-850 | 27.50b - 31.25b | 60-80 | 20-27 | 65-85 | 4 | 0 | 10 | Firmenserver (Nova Medical) |
| `unitalife` | 775-825 | 25b - 27.50b | 70-80 | 23-27 | 70-80 | 4 | 16-64 | 8 | UnitaLife Group |
| `vitalife` | 775-900 | 17.50b - 20b | 80-90 | 27-30 | 60-80 | 5 | 16-128 | 12 | Firmenserver (VitaLife) |
| `zb-def` | 775-825 | 22.50b - 27.50b | 55-65 | 18-22 | 65-75 | 4 | 0 | 10 | ZB Defense Industries |
| `deltaone` | 800-900 | 32.50b - 42.50b | 75-85 | 25-28 | 50-70 | 5 | 0 | 8 | Firmenserver (DeltaOne) |
| `helios` | 800-900 | 13.75b - 18.75b | 85-95 | 28-32 | 70-80 | 5 | 32-256 | 12 | Firmenserver (Helios Labs) |
| `microdyne` | 800-875 | 12.50b - 17.50b | 65-75 | 22-25 | 70-90 | 5 | 16-64 | 11 | Microdyne Technologies |
| `titan-labs` | 800-875 | 18.75b - 22.50b | 70-80 | 23-27 | 60-80 | 5 | 16-128 | 11 | Titan Laboratories |
| `univ-energy` | 800-900 | 27.50b - 30b | 80-90 | 27-30 | 80-90 | 4 | 16-128 | 9 | Firmenserver (Universal Energy) |
| `zeus-med` | 800-850 | 32.50b - 37.50b | 70-90 | 23-30 | 70-80 | 5 | 0 | 9 | Zeus Medical |
| `galactic-cyber` | 825-875 | 18.75b - 21.25b | 55-65 | 18-22 | 70-90 | 5 | 0 | 7 | Firmenserver (Galactic Cybersystems) |
| `aerocorp` | 850-925 | 25b - 30b | 80-90 | 27-30 | 55-65 | 5 | 0 | 7 | Firmenserver (AeroCorp) |
| `defcomm` | 850-1050 | 20b - 23.75b | 84-96 | 28-32 | 47-73 | 5 | 0 | 9 | Firmenserver (DefComm) |
| `icarus` | 850-925 | 22.50b - 25b | 85-95 | 28-32 | 85-95 | 5 | 0 | 9 | Firmenserver (Icarus Microsystems) |
| `omnia` | 850-950 | 22.50b - 25b | 85-95 | 28-32 | 60-70 | 5 | 16-64 | 8 | Firmenserver (Omnia Cybersystems) |
| `taiyang-digital` | 850-950 | 20b - 22.50b | 70-80 | 23-27 | 70-80 | 5 | 0 | 10 | Taiyang Digital |
| `infocomm` | 875-950 | 15b - 22.50b | 70-90 | 23-30 | 35-75 | 5 | 0 | 10 | InfoComm |
| `stormtech` | 875-1075 | 25b - 30b | 78-92 | 26-31 | 68-92 | 5 | 0 | 12 | Firmenserver (Storm Technologies) |
| `4sigma` | 900-1250 | 375b - 625b | 55-75 | 18-25 | 75-99 | 5 | 0 | 13 | Firmenserver (Four Sigma) |
| `b-and-a` | 900-1150 | 375b - 750b | 72-88 | 24-29 | 60-80 | 5 | 0 | 14 | Firmenserver (Bachman & Associates) |
| `blade` | 900-1200 | 250b - 1000b | 88-97 | 29-32 | 55-85 | 5 | 32-512 | 14 | Firmenserver (Blade Industries) |
| `omnitek` | 900-1100 | 325b - 550b | 90-99 | 30-33 | 95-99 | 5 | 128-512 | 13 | Firmenserver (OmniTek Incorporated) |
| `The-Cave` | 925 | 0 | 1 | 1 | 1 | 5 | 0 | 15 | Story (Daedalus / Helios) |
| `clarkinc` | 950-1250 | 375b - 625b | 45-65 | 15-22 | 45-75 | 5 | 0 | 14 | Firmenserver (Clarke Incorporated) |
| `fulcrumtech` | 950-1250 | 35b - 45b | 83-97 | 28-32 | 80-99 | 5 | 128-2048 | 12 | Firmenserver (Fulcrum Technologies) |
| `kuai-gong` | 950-1300 | 500b - 750b | 95-99 | 32-33 | 90-99 | 5 | 0 | 13 | Firmenserver (KuaiGong International) |
| `nwo` | 950-1300 | 500b - 1000b | 99 | 33 | 65-95 | 5 | 0 | 14 | Firmenserver (NWO) |
| `powerhouse-fitness` | 950-1100 | 22.50b | 55-65 | 18-22 | 50-60 | 5 | 16-64 | 14 | Firmenserver (Powerhouse Fitness) |
| `ecorp` | 1050-1400 | 750b - 1750b | 99 | 33 | 99 | 5 | 0 | 15 | Firmenserver (ECorp) |
| `fulcrumassets` | 1100-1600 | 25m | 99 | 33 | 1 | 5 | 0 | 15 | Faction-Gate: Fulcrum Secret Technologies |
| `megacorp` | 1100-1350 | 1000b - 1500b | 99 | 33 | 99 | 5 | 0 | 15 | Firmenserver (MegaCorp) |
| `w0r1d_d43m0n` | 3000 | 0 | 1 | 1 | 1 | 5 | 0 | — | Story (BitNode-Ende) |

Kuerzel: `m` = Millionen, `b` = Milliarden. `maxRam 0` heisst: kein RAM, kann keine
Skripte ausfuehren. `Layer —` heisst: keine `networkLayer` in den Metadaten, also nicht
ins Zufallsnetz eingehaengt.

### Nicht in dieser Tabelle

- **`home`** — der Rechner des Spielers, erzeugt in `src/Prestige.ts`, kein
  `serverMetadata`-Eintrag.
- **`darkweb`** — in v3.0.1 ein `DarknetServer`, erzeugt in
  `src/DarkNet/controllers/NetworkGenerator.ts:52-89`, `maxRam = 16`,
  `hasAdminRights = true`.
- **gekaufte Server** (`ServerPurchases.ts`) und **Hacknet Server**.
- **die acht Labyrinth-Server** und alle uebrigen DarkNet-Server (Abschnitt 0).

### Fraktions- und Story-Server im Ueberblick

| Server | Wofuer | Quelle |
| --- | --- | --- |
| `CSEC` | Backdoor -> Einladung **CyberSec** | `src/Faction/FactionInfo.tsx:489` |
| `avmnite-02h` | Backdoor -> Einladung **NiteSec** | `src/Faction/FactionInfo.tsx:465` |
| `I.I.I.I` | Backdoor -> Einladung **The Black Hand** | `src/Faction/FactionInfo.tsx:419` |
| `run4theh111z` | Backdoor -> Einladung **BitRunners** | `src/Faction/FactionInfo.tsx:402` |
| `fulcrumassets` | Backdoor + Anstellung bei Fulcrum -> **Fulcrum Secret Technologies** | `src/Faction/FactionInfo.tsx:379` |
| `.` | Story-Server The Dark Army, **keine** Einladungsbedingung im Code | nur `src/Server/data/servers.ts:1487` |
| `The-Cave` | Traeger von `AlphaOmega.lit`, Anknuepfungspunkt fuer `w0r1d_d43m0n` | `src/Prestige.ts:174-182` |
| `w0r1d_d43m0n` | BitNode beenden | `src/Terminal/Terminal.ts:373-388` |

Alle Server mit `specialName` gleich einem `LocationName` sind **Firmenserver**: eine
Backdoor dort gibt Boni bei der Firmenarbeit
(`isBackdoorInstalledInCompanyServer`, `src/Server/ServerHelpers.ts:278`, benutzt in
`src/Work/Formulas.ts:101`; Anzeige im Standort-UI `src/Locations/ui/GenericLocation.tsx:109`).

### Zeilennummern in `src/Server/data/servers.ts` (v3.0.1)

Zum Nachschlagen, gleiche Sortierung wie oben:

| hostname | Zeile | | hostname | Zeile | | hostname | Zeile |
| --- | ---: | --- | --- | ---: | --- | --- | ---: |
| `foodnstuff` | 1174 | | `catalyst` | 1037 | | `taiyang-digital` | 529 |
| `n00dles` | 1161 | | `summit-uni` | 986 | | `infocomm` | 347 |
| `sigma-cosmetics` | 1187 | | `millenium-fitness` | 1361 | | `stormtech` | 301 |
| `joesguns` | 1198 | | `rho-construction` | 849 | | `4sigma` | 213 |
| `nectar-net` | 1221 | | `alpha-ent` | 876 | | `b-and-a` | 89 |
| `hong-fang-tea` | 1256 | | `.` | 1487 | | `blade` | 112 |
| `harakiri-sushi` | 1268 | | `run4theh111z` | 1430 | | `omnitek` | 185 |
| `neo-net` | 1232 | | `syscore` | 1014 | | `The-Cave` | 1518 |
| `CSEC` | 1502 | | `lexo-corp` | 822 | | `clarkinc` | 161 |
| `zer0` | 1210 | | `snap-fitness` | 1410 | | `fulcrumtech` | 259 |
| `max-hardware` | 1290 | | `zb-institute` | 959 | | `kuai-gong` | 236 |
| `iron-gym` | 1349 | | `global-pharm` | 723 | | `nwo` | 140 |
| `phantasy` | 1279 | | `solaris` | 672 | | `powerhouse-fitness` | 1385 |
| `silver-helix` | 1244 | | `applied-energetics` | 650 | | `ecorp` | 55 |
| `omega-net` | 1301 | | `nova-med` | 751 | | `fulcrumassets` | 287 |
| `avmnite-02h` | 1468 | | `unitalife` | 796 | | `megacorp` | 72 |
| `crush-fitness` | 1326 | | `vitalife` | 397 | | `w0r1d_d43m0n` | 1530 |
| `johnson-ortho` | 1139 | | `zb-def` | 627 | | | |
| `the-hub` | 1064 | | `deltaone` | 700 | | | |
| `computek` | 1090 | | `helios` | 369 | | | |
| `I.I.I.I` | 1449 | | `microdyne` | 502 | | | |
| `rothman-uni` | 931 | | `titan-labs` | 475 | | | |
| `netlink` | 1114 | | `univ-energy` | 448 | | | |
| `aevum-police` | 904 | | `zeus-med` | 774 | | | |
| | | | `galactic-cyber` | 552 | | | |
| | | | `aerocorp` | 575 | | | |
| | | | `defcomm` | 324 | | | |
| | | | `icarus` | 425 | | | |
| | | | `omnia` | 599 | | | |

---

## 6. Netzwerk-Topologie

**Ja, es gibt eine feste Struktur — aber die konkreten Verbindungen sind zufaellig.**

Erzeugt in `initForeignServers` (`src/Server/ServerHelpers.ts:342-412`).

### Ablauf

1. **15 leere Ebenen anlegen** (`:345-348`). Die Zahl 15 ist fest verdrahtet.
2. **Fuer jeden Eintrag in `serverMetadata`** einen `Server` bauen (`:355-388`):
   Bereichswerte einmal auswuerfeln, RAM als `2^exponent`, `cpuCores` aus
   `[ceil(layer/2), layer]`, Literatur anhaengen, bei `w0r1d_d43m0n` das Hacking-Level mit
   `WorldDaemonDifficulty` multiplizieren.
3. **Einsortieren** in `networkLayers[networkLayer - 1]`, aber **nur wenn `networkLayer`
   gesetzt ist** (`:386-388`). Genau ein Server hat kein `networkLayer`:
   `w0r1d_d43m0n`.
4. **Verknuepfen** (`:397-407`):
   ```ts
   linkNetworkLayers(networkLayers[0], () => homeComputer);
   for (let i = 1; i < networkLayers.length; i++) {
     linkNetworkLayers(networkLayers[i], () => getRandomArrayItem(networkLayers[i - 1]));
   }
   ```
   Jeder Server der Ebene 1 wird direkt an `home` gehaengt. Jeder Server der Ebene *n*
   bekommt **genau einen** zufaellig gezogenen Elternserver aus Ebene *n-1*.
5. **Darkweb und ggf. DarkNet anhaengen** (`:408-412`).

### Was daraus folgt

- **Die Struktur ist ein Baum**, keine Masche. `connectServers`
  (`src/Server/AllServers.ts:77-84`) traegt die Verbindung beidseitig ein, aber es
  entsteht je Server nur genau **eine** Kante nach oben. Es gibt keine Querverbindungen
  innerhalb einer Ebene und keine Abkuerzungen ueber Ebenen hinweg.
- **Die Ebenenzugehoerigkeit jedes Servers ist fest** (Spalte "Layer" in der Tabelle) —
  ein Server der Ebene 9 ist immer genau 9 Sprunge von `home` entfernt.
- **Wer sein Elternteil ist, ist bei jedem BitNode-Start neu ausgewuerfelt.**
  Ein Skript darf sich also nie einen Pfad merken; es muss `ns.scan()` benutzen.
- **Die Verteilung der 69 eingehaengten Server auf die Ebenen:**
  Ebene 1: 7, Ebene 2: 4, Ebene 3: 4, Ebene 4: 6, Ebene 5: 6, Ebene 6: 5, Ebene 7: 4,
  Ebene 8: 3, Ebene 9: 5, Ebene 10: 4, Ebene 11: 4, Ebene 12: 4, Ebene 13: 4,
  Ebene 14: 5, Ebene 15: 4.
  (Zusammengezaehlt aus dem Feld `networkLayer` in `src/Server/data/servers.ts`.)
- **`w0r1d_d43m0n` ist der einzige Server ausserhalb dieses Baums** und wird erst
  nachtraeglich an `The-Cave` gehaengt, wenn The Red Pill installiert ist
  (`src/Prestige.ts:174-182`).
- **Das Netz wird bei jedem BitNode-Eintritt vollstaendig neu gebaut**
  (`prestigeSourceFile`, `src/Prestige.ts:203+`). Beim blossen Installieren von
  Augmentierungen bleibt es bestehen.

---

## Abweichungen dev vs v3.0.1

Verglichen wurde `reference\bitburner-src` (dev, Version 3.0.2) gegen `reference\v301`.
Nur die Punkte, die die Strategie beruehren:

1. **BN12 setzt in dev zusaetzlich `DarknetLabyrinthRewardsTheRedPill: 0`.**
   In v3.0.1 fehlt diese Zeile. **Folge: In v3.0.1 kann The Red Pill in BN12 aus dem
   Labyrinth kommen, im dev-Branch nicht.** In beiden Staenden ist BN8 gesperrt.

2. **BN13 setzt in dev zusaetzlich `CharismaLevelMultiplier: 0.7`.**
   In v3.0.1 bleibt Charisma in BN13 auf 1.

3. **`ns.singularity.hasExportGameBonus` gibt es in v3.0.1 nicht.** Der dev-Branch fuegt
   sie mit Kosten `SingularityFn1/4` (Basis 0,5 GB) hinzu. Die Singularity-Tabelle hat in
   v3.0.1 **64** Eintraege, in dev 65.

4. **`destroyW0r1dD43m0n(nextBN)` verlangt in v3.0.1 zwingend ein Argument** und ruft
   immer `enterBitNode` auf (`src/NetscriptFunctions/Singularity.ts:1155`). Der dev-Branch
   erlaubt `nextBN = null`, um nur die BitVerse-Seite zu oeffnen, und prueft `nextBN`
   zusaetzlich gegen `validBitNodes`.

5. **`serverMetadata` ist inhaltlich identisch.** Ich habe beide Fassungen geparst und
   Feld fuer Feld verglichen: **null Unterschiede** bei `requiredHackingSkill`,
   `moneyAvailable`, `hackDifficulty`, `serverGrowth`, `numOpenPortsRequired`,
   `maxRamExponent`, `networkLayer`, `organizationName`, `specialName`, `literature`.
   Der dev-Branch fuegt nur ein neues Feld `discoverableScripts` hinzu (vorgefertigte
   Beispielskripte auf acht Servern). **Die Tabelle oben gilt also fuer beide Staende;
   nur die Zeilennummern verschieben sich.**

6. **`initForeignServers` ist logisch identisch**, dev unterscheidet sich nur durch die
   Behandlung von `discoverableScripts` und `?? []` statt `|| []`. Die
   Topologie-Erzeugung ist Zeile fuer Zeile dieselbe.

7. **Identisch in beiden Staenden** (Zeilenverweise dort also unbedenklich):
   `src/SourceFile/*` (alle drei Dateien), `src/BitNode/BitNodeUtils.ts`,
   `src/BitNode/BitNodeMultipliers.ts`, `src/Server/Server.ts`,
   `src/Server/AllServers.ts`, `src/Server/data/SpecialServers.ts`,
   `src/Faction/FactionJoinCondition.ts`, `src/Faction/FactionHelpers.tsx`,
   `src/DarkNet/effects/labyrinth.ts`.

---

## Ausdrueckliche Luecken

Punkte, die im Auftrag angesprochen sind und die ich **nicht** aus dem Code belegen kann:

- **Die genaue Groesse von `NetscriptDefinitions.d.ts`** (relevant fuer die
  RFA-Methode `getDefinitionFile`) habe ich nicht ausgemessen, nur die
  Groessenordnung abgeschaetzt.
- **Die konkrete Anzahl DarkNet-Server je Spielstand** haengt vom laufenden
  Labyrinth-Fortschritt ab (`getNetDepth()`) und ist nicht statisch bestimmbar.
- **Wirkungen der Source Files 2, 3, 6, 7, 8, 10, 11, 12, 13, 14, 15** habe ich nur aus
  den Beschreibungstexten in `src/BitNode/BitNode.tsx` uebernommen, nicht gegen
  `src/SourceFile/applySourceFile.ts` gegengeprueft. Der Auftrag verlangte die
  Code-Verifikation nur fuer SF1, SF4, SF5 und SF9; die sind belegt.
- **Ob es weitere Verwendungen von `specialName` gibt**, ausser Firmenarbeitsbonus
  (`src/Work/Formulas.ts:101`) und Standortanzeige
  (`src/Locations/ui/GenericLocation.tsx:109`), habe ich nicht erschoepfend geprueft.
