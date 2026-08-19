# Bitburner v3.0.1 — Formeln der Geld- und Nebensysteme

Quelle: `C:\Users\erche\Desktop\claude_projecto\bitburner\reference\v301\src\...`
Alle Zeilenangaben `src/Datei.ts:Zeile` beziehen sich auf **Release v3.0.1** (`src/Constants.ts:7` → `VersionString: "3.0.1"`).

Alle Zahlen sind direkt aus dem Quellcode gelesen. Wo etwas gerechnet und nicht gelesen ist, steht das ausdruecklich dabei.

## Grundlagen, die ueberall hineinspielen

| Groesse | Wert | Quelle |
|---|---|---|
| Game-Cycle | 200 ms | `src/Constants.ts:19` (`MilliPerCycle: 200`) |
| MaxSkillLevel | 975 | `src/Constants.ts:16` |
| Offline-Hacking-Ertrag | 75 % | `src/Constants.ts:22` (`OfflineHackingIncome: 0.75`) |
| Fokus-Malus ohne Fokus | 0.8 | `src/Constants.ts:87` (`BaseFocusBonus`), Anwendung `src/PersonObjects/Player/PlayerObjectGeneralMethods.ts:622-628` |
| Heim-PC Start | 8 GB RAM, 1 Kern | `src/PersonObjects/Player/PlayerObjectGeneralMethods.ts:70` |

**BitNode 1 hat KEINE Multiplikatoren.** `src/BitNode/BitNode.tsx:572-574`:

```ts
case 1: {
  return new BitNodeMultipliers();
}
```

Alle Felder der Klasse stehen auf `1` (`src/BitNode/BitNodeMultipliers.ts:8-185`). Fuer einen BN1-Durchlauf duerfen also saemtliche `currentNodeMults.*` in den folgenden Formeln als **1** eingesetzt werden. Das gilt auch fuer `GangSoftcap` (`:91`), `CorporationSoftcap` (`:46`) und `BladeburnerRank` (`:19`) — BN1 ist fuer diese drei Systeme der guenstigste Node im ganzen Spiel.

---

## 1. Gekaufte Server (Cloud Server) und Heim-PC

### 1.1 Preis eines gekauften Servers

`src/Server/ServerPurchases.ts:23-41`:

```ts
const upg = Math.max(0, Math.log(sanitizedRam) / Math.log(2) - 6);
return (
  sanitizedRam *
  ServerConstants.BaseCostFor1GBOfRamServer *
  currentNodeMults.CloudServerCost *
  Math.pow(currentNodeMults.CloudServerSoftcap, upg)
);
```

Konstanten (`src/Server/data/Constants.ts:1-14`):

| Konstante | Wert | Zeile |
|---|---|---|
| `BaseCostFor1GBOfRamServer` | 55 000 | `:4` |
| `BaseCostFor1GBOfRamHome` | 32 000 | `:3` |
| `HomeComputerMaxRam` | 1 073 741 824 (2^30) | `:6` |
| `CloudServerLimit` | 25 | `:12` |
| `CloudServerMaxRam` | 1 048 576 (2^20) | `:13` |

**In BN1 vereinfacht sich das zu:**

```
Preis(ram) = ram * 55_000
```

Der `CloudServerSoftcap`-Term wird in BN1 zu `1^upg = 1`. Der Preis ist also **exakt linear in RAM** — 2x RAM kostet 2x so viel, es gibt keine Progressionsstrafe. RAM muss eine Zweierpotenz sein (`isPowerOfTwo`-Pruefung `:26`), sonst `Infinity`.

| RAM | Preis pro Server | 25 Server (Vollausbau) |
|---:|---:|---:|
| 8 GB | $440 000 | $11 000 000 |
| 64 GB | $3 520 000 | $88 000 000 |
| 512 GB | $28 160 000 | $704 000 000 |
| 4 096 GB | $225 280 000 | $5 632 000 000 |
| 32 768 GB | $1 802 240 000 | $45 056 000 000 |
| 262 144 GB | $14 417 920 000 | $360 448 000 000 |
| **1 048 576 GB (Max)** | **$57 671 680 000** | **$1 441 792 000 000** |

(gerechnet aus der Formel oben)

### 1.2 Limits

`src/Server/ServerPurchases.ts:96-101`:

```ts
export function getCloudServerLimit(): number {
  return Math.round(ServerConstants.CloudServerLimit * currentNodeMults.CloudServerLimit);
}
export function getCloudServerMaxRam(): number {
  const ram = Math.round(ServerConstants.CloudServerMaxRam * currentNodeMults.CloudServerMaxRam);
  return 1 << (31 - Math.clz32(ram));   // auf naechste Zweierpotenz abrunden
}
```

**BN1: 25 Server, je maximal 1 048 576 GB (2^20).** Gesamt-RAM-Deckel aus gekauften Servern: 26 214 400 GB.

### 1.3 Upgrade eines bestehenden Servers

`src/Server/ServerPurchases.ts:44-53`: Differenzpreis, kein Aufschlag.

```ts
return getCloudServerCost(ram) - getCloudServerCost(server.maxRam);
```

**Folge (BN1):** Es ist wirtschaftlich voellig egal, ob man klein kauft und spaeter hochruestet oder gleich gross kauft. Kein Nachteil beim schrittweisen Ausbau. Das ist ein Unterschied zu aelteren Bitburner-Versionen, wo man loeschen und neu kaufen musste.

### 1.4 Heim-PC: RAM

`src/PersonObjects/Player/PlayerObjectServerMethods.ts:30-40`:

```ts
const currentRam = this.getHomeComputer().maxRam;
const numUpgrades = Math.log2(currentRam);
const mult = Math.pow(1.58, numUpgrades);
const cost = currentRam * ServerConstants.BaseCostFor1GBOfRamHome * mult * currentNodeMults.HomeComputerRamCost;
```

**BN1:** `Kosten = ram * 32_000 * 1.58^log2(ram)`. Jedes Upgrade verdoppelt den RAM (`src/Server/ServerPurchases.ts:184`: `homeComputer.maxRam *= 2`).

Da `1.58^log2(ram) = ram^log2(1.58) = ram^0.6601`, gilt geschlossen:

```
Kosten(ram -> 2*ram) = 32_000 * ram^1.6601
```

| von → nach | Kosten |
|---|---:|
| 8 → 16 GB | $1 009 744 |
| 16 → 32 GB | $3 190 791 |
| 32 → 64 GB | $10 082 898 |
| 64 → 128 GB | $31 861 959 |
| 128 → 256 GB | $100 683 790 |
| 512 → 1 024 GB | $1 005 388 057 |
| 8 192 → 16 384 GB | $100 249 462 404 |
| 536 870 912 → 1 073 741 824 GB | $9.91e18 |
| **Summe 8 GB → 2^30 GB** | **≈ $1.45e19** |

(gerechnet). Der Maximalwert ist `HomeComputerMaxRam = 2^30` (`src/Server/ServerPurchases.ts:178`).

**Merke:** Der Faktor pro Verdopplung ist `2 * 1.58 = 3.16`. Jede Verdopplung kostet also gut das Dreifache der vorigen. Gekaufte Server sind pro GB dagegen **linear** und mit 55 000 $/GB zwar teurer als der Basiswert des Heim-PCs (32 000 $/GB), aber ohne Progression — ab ca. 64 GB Heim-RAM ist gekauftes RAM billiger pro GB.

Rechnung dazu: Heim-Upgrade auf 128 GB kostet $31.86M fuer +64 GB → 497 812 $/GB. Gekaufter Server: 55 000 $/GB. Ab dem Sprung 64→128 GB ist gekauftes RAM also rund **9x guenstiger pro GB**.

### 1.5 Heim-PC: Kerne

`src/PersonObjects/Player/PlayerObjectServerMethods.ts:42-44`:

```ts
export function getUpgradeHomeCoresCost(this: PlayerObject): number {
  return 1e9 * Math.pow(7.5, this.getHomeComputer().cpuCores);
}
```

Kein BitNode-Multiplikator. Maximum **8 Kerne** (`src/Locations/ui/CoresButton.tsx:18` und `:24`: `homeComputer.cpuCores >= 8`).

| von → nach | Kosten |
|---|---:|
| 1 → 2 | $7 500 000 000 |
| 2 → 3 | $56 250 000 000 |
| 3 → 4 | $421 875 000 000 |
| 4 → 5 | $3 164 062 500 000 |
| 5 → 6 | $23 730 468 750 000 |
| 6 → 7 | $177 978 515 625 000 |
| 7 → 8 | $1 334 838 867 187 500 |
| **Summe 1 → 8** | **≈ $1.54e15** |

(gerechnet). Kerne wirken auf `grow()`/`weaken()`-Effektivitaet und auf Grafting/Corporation, **nicht** auf `hack()`-Ertrag. Fuer ein reines Hacking-Setup sind sie ein schlechter Kauf, solange RAM noch fehlt.

---

## 2. Hacknet

Zwei Varianten. Welche aktiv ist, entscheidet `src/Hacknet/HacknetHelpers.tsx:34-36`:

```ts
export function hasHacknetServers(): boolean {
  return canAccessBitNodeFeature(9) && !Player.bitNodeOptions.disableHacknetServer;
}
```

`canAccessBitNodeFeature(9)` = `bitNodeN === 9 || activeSourceFileLvl(9) > 0` (`src/BitNode/BitNodeUtils.ts:17-19`).

**In BN1 ohne Source-File 9 spielt man also die Node-Variante (Geld direkt). Mit SF9 spielt man auch in BN1 die Server-Variante (Hashes).**

### 2.1 Hacknet Nodes (BN1-Variante, ohne SF9)

Konstanten `src/Hacknet/data/Constants.ts:1-17`:

| Konstante | Wert | Zeile |
|---|---|---|
| `MoneyGainPerLevel` | 1.5 | `:2` |
| `BaseCost` | 1 000 | `:4` |
| `LevelBaseCost` | 500 | `:5` |
| `RamBaseCost` | 30 000 | `:6` |
| `CoreBaseCost` | 500 000 | `:7` |
| `PurchaseNextMult` | 1.85 | `:9` |
| `UpgradeLevelMult` | 1.04 | `:10` |
| `UpgradeRamMult` | 1.28 | `:11` |
| `UpgradeCoreMult` | 1.48 | `:12` |
| `MaxLevel` | 200 | `:14` |
| `MaxRam` | 64 | `:15` |
| `MaxCores` | 16 | `:16` |

**Produktion (Geld pro Sekunde)** — `src/Hacknet/formulas/HacknetNodes.ts:4-11`:

```ts
const levelMult = level * 1.5;
const ramMult   = Math.pow(1.035, ram - 1);
const coresMult = (cores + 5) / 6;
return levelMult * ramMult * coresMult * mult * currentNodeMults.HacknetNodeMoney;
```

BN1, ohne Aug-Multiplikator:

```
$/s = 1.5 * level * 1.035^(ram-1) * (cores+5)/6
```

Verrechnung: `src/Hacknet/HacknetNode.ts:76-85` — `gain = moneyGainRatePerSecond * (numCycles * 200 / 1000)`, ausgezahlt in `src/Hacknet/HacknetHelpers.tsx:394-398`.

- frischer Node (1/1/1): **1.5 $/s**
- Maximalnode (200/64/16): `1.5*200 * 1.035^63 * 21/6` = **9 171.31 $/s**
  (`1.035^63 = 8.7346`, `coresMult = 3.5`)

**Kaufpreis des n-ten Nodes** — `src/Hacknet/formulas/HacknetNodes.ts:87-92`:

```
Preis(n) = 1000 * 1.85^(n-1)
```

**Es gibt KEINE Obergrenze fuer die Node-Anzahl** — `purchaseHacknet()` prueft bei Nodes nur `canAfford` (`src/Hacknet/HacknetHelpers.tsx:65-72`); der `MaxServers`-Check gilt nur fuer die Server-Variante (`:56`).

| Node # | Preis | Amortisation (bei 1.5 $/s) |
|---:|---:|---:|
| 1 | $1 000 | 11 min |
| 3 | $3 423 | 38 min |
| 5 | $11 714 | 2.2 h |
| 8 | $74 166 | 13.7 h |
| 10 | $253 832 | 47 h |
| 12 | $868 738 | 161 h |
| 15 | $5 500 526 | 1 019 h |
| 20 | $119 196 318 | 22 073 h |

(gerechnet). Die Amortisation bezieht sich auf den Node im Auslieferungszustand; ein bereits ausgebauter Node verdient natuerlich mehr, aber der **Neukauf** liefert immer nur 1.5 $/s.

**Upgrade-Kosten** — `src/Hacknet/formulas/HacknetNodes.ts:13-85`:

```
Level L -> L+1 :  500 * 1.04^(L-1)          (:23-31, Summenschleife ab currLevel = startingLevel-1)
RAM   R -> 2R  :  R * 30_000 * 1.28^log2(R) (:48-56)
Cores C -> C+1 :  500_000 * 1.48^(C-1)      (:73-80)
```

**Grenzertrag beim frischen Node (1/1/1):**

| Upgrade | Kosten | Zugewinn | Amortisation |
|---|---:|---:|---:|
| Level 1→2 | $500 | +1.50 $/s | **333 s** |
| RAM 1→2 GB | $30 000 | +0.0525 $/s | 159 h |
| Cores 1→2 | $500 000 | +0.25 $/s | 556 h |

(gerechnet). **Level ist am Anfang das mit weitem Abstand beste Upgrade** — RAM und Cores lohnen erst, wenn das Level schon hoch ist, weil sie multiplikativ auf den Levelanteil wirken.

**Vollausbau eines Nodes** (gerechnet):

| Posten | Kosten |
|---|---:|
| Level 1 → 200 | $30 645 550 |
| RAM 1 → 64 GB | $5 393 750 |
| Cores 1 → 16 | $371 911 671 |
| **Summe** | **$407 950 971** |

Bei 9 171 $/s amortisiert sich ein vollausgebauter Node in **12.4 Stunden**. Der Loewenanteil sind die Cores — 91 % der Kosten fuer einen Faktor 3.5.

**Zwischenbilanz Hacknet Nodes:** Die ersten paar hundert Dollar sind extrem gut angelegt (Node 1 zahlt sich in 11 Minuten zurueck), aber die Sache stirbt sehr schnell ab. Ein voll ausgebautes Netz aus z. B. 12 Maximalnodes bringt 110 000 $/s bei ~$5.7 Mrd Investition — und dahinter ist Schluss, weil weitere Nodes 1.85^n kosten.

### 2.2 Hacknet Server (SF9/BN9-Variante)

Konstanten `src/Hacknet/data/Constants.ts:32-52`:

| Konstante | Wert | Zeile |
|---|---|---|
| `HashesPerLevel` | 0.001 | `:33` |
| `BaseCost` | 50 000 | `:35` |
| `RamBaseCost` | 200 000 | `:36` |
| `CoreBaseCost` | 1 000 000 | `:37` |
| `CacheBaseCost` | 10 000 000 | `:38` |
| `PurchaseMult` | 3.2 | `:40` |
| `UpgradeLevelMult` | 1.1 | `:41` |
| `UpgradeRamMult` | 1.4 | `:42` |
| `UpgradeCoreMult` | 1.55 | `:43` |
| `UpgradeCacheMult` | 1.85 | `:44` |
| `MaxServers` | 20 | `:46` |
| `MaxLevel` / `MaxRam` / `MaxCores` / `MaxCache` | 300 / 8192 / 128 / 15 | `:48-51` |

**Produktion (Hashes pro Sekunde)** — `src/Hacknet/formulas/HacknetServers.ts:4-17`:

```ts
const baseGain      = 0.001 * level;
const ramMultiplier = Math.pow(1.07, Math.log2(maxRam));
const coreMultiplier= 1 + (cores - 1) / 5;
const ramRatio      = 1 - ramUsed / maxRam;
return baseGain * ramMultiplier * coreMultiplier * ramRatio * mult * currentNodeMults.HacknetNodeMoney;
```

**Wichtig: `ramRatio`.** Hacknet Server sind gleichzeitig echte Server, auf denen Skripte laufen koennen. Jedes GB belegtes RAM senkt die Hash-Produktion anteilig. Wer die Server als Rechenkapazitaet nutzt, halbiert bei 50 % Auslastung die Hash-Rate.

**Hashes → Geld:** Upgrade `Sell for Money` (`src/Hacknet/data/HashUpgradesMetadata.tsx:9-24`) hat einen **Festpreis** `cost: 4` (`:10`) und `value: 1e6` (`:23`). Weil `cost` gesetzt ist, greift in `getCost()` der Fixpreis-Zweig (`src/Hacknet/HashUpgrade.ts:72-75`) und der Preis steigt **nie**.

```
1 Hash = 1_000_000 / 4 = $250_000
```

Ueberlaufende Hashes werden automatisch zu diesem Kurs verkauft (`src/Hacknet/HacknetHelpers.tsx:419-429`).

| Zustand | Hash-Rate | $/s |
|---|---:|---:|
| frischer Server (1/1/1) | 0.001 h/s | **$250/s** |
| Maximalserver (300/8192/128, ramUsed 0) | 19.086 h/s | **$4 771 493/s** |
| 20 Maximalserver | 381.7 h/s | **$95 429 862/s** |

(gerechnet; `1.07^13 = 2.4098`, `coreMult = 1 + 127/5 = 26.4`)

**Kaufpreis** — `src/Hacknet/formulas/HacknetServers.ts:112-118`: `50_000 * 3.2^(n-1)`, hart gedeckelt bei 20 Servern.

| Server # | Preis | Amortisation (bei $250/s) |
|---:|---:|---:|
| 1 | $50 000 | 3.3 min |
| 3 | $512 000 | 34 min |
| 5 | $5 242 880 | 5.8 h |
| 7 | $53 687 091 | 60 h |
| 10 | $1 759 218 604 | 1 955 h |
| 15 | $590 295 810 359 | 655 884 h |
| 20 | $198 070 406 285 661 | — |
| **Summe 1–20** | **$288 102 409 120 052** | |

**Upgrade-Kosten** — `src/Hacknet/formulas/HacknetServers.ts:19-110`:

```
Level L -> L+1 :  10 * 50_000 * 1.1^L      = 500_000 * 1.1^L     (:29-37, currLevel startet bei startingLevel)
RAM   R -> 2R  :  R * 200_000 * 1.4^log2(R)                      (:50-61)
Cores C -> C+1 :  1_000_000 * 1.55^(C-1)                         (:77-84)
Cache K -> K+1 :  10_000_000 * 1.85^(K-1)                        (:100-107)
```

Cache steuert nur die Speicherkapazitaet: `hashCapacity = 32 * 2^cache` (`src/Hacknet/HacknetServer.ts:121-123`), also 64 bis 1 048 576 Hashes. Fuer reines Geldverdienen ist Cache **irrelevant**, weil ueberlaufende Hashes ohnehin automatisch zu $250k verkauft werden. Cache braucht man nur, um teure Upgrades (Bladeburner-Rang 250 Hashes, Coding Contract 25 Hashes) ansparen zu koennen.

**Grenzertrag beim frischen Server (1/1/1):**

| Upgrade | Kosten | Zugewinn | Amortisation |
|---|---:|---:|---:|
| Level 1→2 | $550 000 | +$250/s | 0.61 h |
| RAM 1→2 GB | $200 000 | +$17.50/s | 3.2 h |
| Cores 1→2 | $1 000 000 | +$50/s | 5.6 h |

(gerechnet)

**Kosten fuer den Vollausbau EINES Servers** (gerechnet):

| Posten | Kosten |
|---|---:|
| Level 1 → 300 | ≈ $1.31e19 |
| RAM 1 → 8192 GB | $72 245 571 361 |
| Cores 1 → 128 | ≈ $2.7e30 |
| Cache 1 → 15 | $64 700 302 275 |

Der Vollausbau ist also **voellig unerreichbar** — `1.55^127` und `1.1^300` sprengen jede Geldmenge, die man in BN1 je haben wird. Praktisch relevant ist nur der billige Anfangsbereich.

### 2.3 Die weiteren Hash-Upgrades

`src/Hacknet/data/HashUpgradesMetadata.tsx`, Preisformel `src/Hacknet/HashUpgrade.ts:72-82`:

```ts
// steigende Preise: (currentLevel + 1) * costPerLevel, aufsummiert
const collapsedSum = 0.5 * count * (count + 2 * currentLevel + 1);
return this.costPerLevel * collapsedSum;
```

| Upgrade | Kosten (Hashes) | Wirkung | Zeile |
|---|---|---|---|
| Sell for Money | **4, fix** | $1 000 000 | `:9-24` |
| Sell for Corporation Funds | 100, steigend | $1e9 Corp-Funds | `:25-39` |
| Reduce Minimum Security | 50, steigend | Ziel-Server `minDifficulty *= 0.98` | `:40-49` |
| Increase Maximum Money | 50, steigend | Ziel-Server `moneyMax *= 1.02` | `:52-62` |
| Improve Studying | 50, steigend | +20 % pro Level | `:63-71` |
| Improve Gym Training | 50, steigend | +20 % pro Level | `:72-80` |
| Exchange for Corporation Research | 200, steigend | 1 000 Research | `:81-89` |
| Exchange for Bladeburner Rank | 250, steigend | 100 Rang | `:90-98` |
| Exchange for Bladeburner SP | 250, steigend | 10 Skillpunkte | `:99-107` |
| Generate Coding Contract | 25, steigend | 1 Contract | `:108-114` |
| Company Favor | 200, steigend | +5 Favor | `:115-122` |

**`Increase Maximum Money` und `Reduce Minimum Security` sind der eigentliche Grund, warum Hacknet Server mit SF9 stark sind:** sie verbessern dauerhaft das Hacking-Ziel. Beide Upgrades verteuern sich linear (50, 100, 150, 200 … Hashes), waehrend `Sell for Money` fix bei 4 bleibt. Der Wert des n-ten `Increase Maximum Money` in Geld ausgedrueckt: `50*n * $250 000 = $12.5M * n` — dafuer gibt es +2 % `moneyMax` (multiplikativ).

Ein Coding Contract kostet `25*n` Hashes; der erste also 25 Hashes = $6.25M, und liefert im Schnitt Geld/Rep in der Groessenordnung `CodingContractBaseMoneyGain: 75e6` (`src/Constants.ts:93`). Das ist ein sehr guter Tausch, solange n klein ist.

### 2.4 Antwort: Lohnt Hacknet gegenueber Hacking?

**Hacking-Vergleichsbasis** (`src/Hacking.ts:44-57` und `:60-80`):

```ts
// Anteil des Server-Geldes pro erfolgreichem hack()
percentMoneyHacked = ((100 - hackDifficulty)/100 * (hacking - (reqSkill-1))/hacking
                      * mults.hacking_money * currentNodeMults.ScriptHackMoney) / 240;
// Dauer
hackingTime = 5 * (2.5 * reqSkill * hackDifficulty + 500) / (hacking + 50)
              / (mults.hacking_speed * currentNodeMults.HackingSpeedMultiplier * intBonus);
```

RAM-Kosten: `hack()` 0.10 GB, `grow()` 0.15 GB, `weaken()` 0.15 GB, Script-Grundlast 1.6 GB (`src/Netscript/RamCostGenerator.ts:11,16,18,20`).

Der entscheidende Unterschied ist **struktureller Art, nicht bloss quantitativer**:

- **Hacknet Node** produziert einen festen Geldstrom, der pro investiertem Dollar mit `1.85^n` (Anzahl) bzw. `1.04^L` (Level) verfaellt. Es gibt eine harte Obergrenze bei ca. 9 171 $/s je Node.
- **Hacking** skaliert mit dem Produkt aus RAM (linear kaufbar, 55 000 $/GB, bis 26 Mio GB) und Hacking-Level (waechst durch Spielen von selbst) und Server-`moneyMax`. Ein einziger gut gehackter Server aus dem Mittelfeld liefert bereits Millionen pro Sekunde, wenn genug RAM fuer die Threads da ist.

**Praktische Schwelle:** Ein Hacknet-Node-Netz amortisiert sich, solange der Grenznode unter etwa 1 Stunde Rueckzahldauer liegt — das ist bis ungefaehr **Node 6-7** der Fall ($21 670 bzw. $74 166). Danach ist derselbe Dollar in gekauftem Server-RAM besser aufgehoben:

- $74 166 in Hacknet-Node #8 → +1.5 $/s
- $74 166 in Server-RAM → 1.34 GB, d. h. rund 13 `hack()`-Threads. Schon bei $10 000 Ertrag pro Thread und 10 s Zykluszeit sind das 13 000 $/s.

**Fazit BN1 ohne SF9: Hacknet Nodes sind ein Anschubfinanzierer fuer die allererste Stunde und danach eine Geldvernichtung.** Konkret: 5-8 Nodes kaufen, jeweils das Level hochziehen (333 s Amortisation!), RAM und Cores ignorieren, ab dem ersten gekauften Server nicht mehr anfassen.

**Mit SF9 in BN1 kippt das Urteil.** Die Server-Variante gibt einem ueber `Increase Maximum Money` und `Reduce Minimum Security` einen dauerhaften Hebel auf das Hacking-Einkommen, den es sonst nirgends gibt, und der erste Server amortisiert sich in 3.3 Minuten. Aber auch hier gilt: ab Server ~7 ist Schluss.

---

## 3. Stock Market

### 3.1 Zugangskosten

`src/StockMarket/data/Constants.ts:3-12` und `src/StockMarket/StockMarketCosts.ts:4-18`:

| Posten | Kosten | Was es freischaltet | Zeile |
|---|---:|---|---|
| WSE Account | **$200 000 000** | Handel ueber die UI | `Constants.ts:7` |
| TIX API | **$5 000 000 000** | `ns.stock.*` Handel per Skript | `Constants.ts:8` |
| 4S Market Data | **$1 000 000 000** | Forecast/Volatilitaet in der UI sichtbar | `Constants.ts:9` |
| 4S Market Data TIX API | **$25 000 000 000** | `ns.stock.getForecast()` / `getVolatility()` | `Constants.ts:10` |
| Commission je Transaktion | **$100 000** | — | `Constants.ts:11` |

In BN1 sind `FourSigmaMarketDataCost` und `FourSigmaMarketDataApiCost` gleich 1 (`src/BitNode/BitNodeMultipliers.ts:88`, `:85`), die Preise gelten also unveraendert. **Voller Ausbau: $31.2 Mrd.**

Reihenfolge-Zwang: 4S Data braucht ein WSE-Konto (`src/NetscriptFunctions/StockMarket.ts:259-262`), 4S TIX API braucht die TIX API (`:280`).

`ns.stock.buyShort` / `sellShort` verlangen zusaetzlich BN8 oder SF8 Level 2, `placeOrder`/`cancelOrder`/`getOrders` SF8 Level 3 (`src/NetscriptFunctions/StockMarket.ts:151-153`, `:163-165`, `:178-180`, `:192-194`, `:204-206`). **In BN1 ohne SF8 sind Short-Positionen und Limit-/Stop-Orders per Skript also gesperrt.** Ueber die UI: `src/StockMarket/BuyingAndSelling.tsx:215` (`shortStock`) existiert, die UI-Sichtbarkeit haengt ebenfalls an SF8 — siehe Luecke unten.

### 3.2 Kursbewegung

**Tick-Rhythmus** (`src/StockMarket/data/Constants.ts:4-6`):

| Konstante | Wert |
|---|---|
| `msPerStockUpdate` | 6 000 ms |
| `msPerStockUpdateMin` | 4 000 ms |
| `TicksPerCycle` | 75 |

`src/StockMarket/StockMarket.ts:234-255`: Cycles werden gesammelt (`cyclesPerStockUpdate = 6000/200 = 30`), ein Update passiert erst, wenn genug Cycles da sind **und** seit dem letzten Update mindestens 4 s vergangen sind. Im Normalbetrieb also **ein Tick alle 6 Sekunden = 600 Ticks pro Stunde**.

**Pro Tick** (`src/StockMarket/StockMarket.ts:260-320`):

```ts
const v = Math.random();                      // :260  EINMAL fuer ALLE Aktien
for (jede Aktie) {
  const volatility = stock.mv * getDarknetVolatilityMult(stock.symbol);   // :264
  let av = (v * volatility) / 100;            // :265

  let chc = 50;
  chc = stock.b ? (chc + stock.otlkMag)/100 : (chc - stock.otlkMag)/100;  // :271-275
  if (stock.price >= stock.cap) { chc = 0.1; stock.b = false; }           // :276-279

  const c = Math.random();                    // :284
  if (c < chc) stock.changePrice(stock.price * (1 + av));                 // :290
  else         stock.changePrice(stock.price / (1 + av));                 // :296
  ...
  stock.cycleForecast(otlkMagChange);         // :311
  stock.cycleForecastForecast(otlkMagChange/2);
  stock.shareTxUntilMovement = Math.min(stock.shareTxUntilMovement + 10, stock.shareTxForMovement); // :315
}
```

Zwei Dinge sind hier fuer einen Optimierer wichtig:

1. **`v` wird EINMAL pro Tick fuer alle 33 Aktien gezogen** (`:260`, ausserhalb der Schleife). Die Bewegungsgroesse ist also ueber alle Aktien perfekt korreliert; nur die Richtung (`c`) ist je Aktie unabhaengig. Wer die Bewegung einer Aktie beobachtet, kennt `av/mv` fuer alle anderen im selben Tick.
2. **Auf- und Abbewegung sind nicht symmetrisch, sondern exakt reziprok**: `*(1+av)` gegen `/(1+av)`. In Log-Koordinaten ist es ein sauberer Random Walk mit Drift.

**Erwartete Log-Rendite pro Tick:**

```
E[ln r] = (2*chc - 1) * ln(1 + av)     mit  E[av] = mv / 200   (v ~ U(0,1))
```

`mv` liegt laut `src/StockMarket/data/InitStockMetadata.ts` zwischen **0.40 und 4.00** (alle Eintraege mit `divisor: 100`; kleinster Bereich `min:40,max:50`, groesster `min:200,max:400`).

Kursfaktor pro Stunde (600 Ticks), gerechnet:

| `mv` | E[av] | f=0.55 | f=0.60 | f=0.65 | f=0.70 |
|---:|---:|---:|---:|---:|---:|
| 0.40 | 0.0020 | 1.13x | 1.27x | 1.43x | 1.62x |
| 0.90 | 0.0045 | 1.31x | 1.71x | 2.24x | 2.94x |
| 1.75 | 0.0088 | 1.69x | 2.85x | 4.80x | 8.09x |
| 4.00 | 0.0200 | 3.28x | 10.77x | 35.3x | 115.9x |

Das sind Momentaufnahmen bei konstantem Forecast — der Forecast wandert (siehe unten), aber die Groessenordnung stimmt: **volatile Aktien mit gutem Forecast sind der mit Abstand steilste Geldhebel im Spiel.**

**Forecast-Dynamik** (`src/StockMarket/Stock.ts:174-217`, `:234-239`):

```ts
getAbsoluteForecast() { return this.b ? 50 + this.otlkMag : 50 - this.otlkMag; }   // :220-222
getForecastIncreaseChance() {
  const diff = this.otlkMagForecast - this.getAbsoluteForecast();
  return (50 + Math.min(Math.max(diff, -45), 45)) / 100;                            // :236-238
}
cycleForecast(changeAmt) {  // :174-196
  // mit getForecastIncreaseChance() steigt der Forecast (Richtung je nach b), sonst faellt er
  this.otlkMag = Math.min(this.otlkMag, 50);
  if (this.otlkMag < 0) { this.otlkMag *= -1; this.b = !this.b; }
}
```

Es gibt also einen **zweistufigen Forecast**: `otlkMag` (0..50) ist der eigentliche Kurstreiber, `otlkMagForecast` (0..100) ist ein Ziel, auf das sich `otlkMag` zubewegt. Das erzeugt Trendpersistenz.

**Markt-Zyklus** (`src/StockMarket/StockMarket.ts:219-232`): Alle `TicksPerCycle = 75` Ticks (= 7.5 Minuten) laeuft `stockMarketCycle()`; jede Aktie **einzeln** hat dann **45 % Chance**, dass `b` gekippt und `otlkMagForecast` gespiegelt wird (`:224-228`). Der erste Zyklus kommt nach `getRandomIntInclusive(1, 75)` Ticks (`:204`).

**Das ist die eigentliche Risikoquelle:** Alle 7.5 Minuten kann sich die Richtung einer Position mit 45 % Wahrscheinlichkeit umdrehen. Eine Strategie, die nur den aktuellen Forecast liest und stur haelt, faengt sich diese Umkehr voll ein.

### 3.3 Spread, Commission, Price Impact

**Spread** — `src/StockMarket/Stock.ts:225-232`:

```ts
getAskPrice() { return this.price * (1 + this.spreadPerc / 100); }   // Kaufpreis fuer dich
getBidPrice() { return this.price * (1 - this.spreadPerc / 100); }   // Verkaufspreis fuer dich
```

`spreadPerc` je Aktie zwischen **0.1 % und 2.0 %** (`src/StockMarket/data/InitStockMetadata.ts`, alle mit `divisor: 10`, Bereiche von `min:1,max:5` bis `min:5,max:20`). Roundtrip-Verlust = `2 * spreadPerc`.

**Commission** — `src/StockMarket/StockMarketHelpers.ts:15-61`:

```ts
// Kauf
return shares * stock.getAskPrice() + 100_000;     // Long,  :28
return shares * stock.getBidPrice() + 100_000;     // Short, :30
// Verkauf Long
return shares * stock.getBidPrice() - 100_000;     // :53
// Verkauf Short
const origCost = shares * stock.playerAvgShortPx;
const profit = (stock.playerAvgShortPx - stock.getAskPrice()) * shares - 100_000;
return origCost + profit;                          // :56-59
```

$100 000 pro Transaktion, also **$200 000 pro Roundtrip**. Ab einer Positionsgroesse von ~$100M ist das mit 0.2 % vernachlaessigbar; bei $1M sind es 20 % und damit toedlich.

**Wie lange muss man halten, um den Spread zu verdienen?** (gerechnet, `mv = 0.9`)

| Spread | f=0.55 | f=0.60 | f=0.65 |
|---:|---:|---:|---:|
| 0.1 % | 0.4 min | 0.2 min | 0.1 min |
| 0.5 % | 2.2 min | 1.1 min | 0.7 min |
| 1.0 % | 4.5 min | 2.2 min | 1.5 min |
| 2.0 % | 9.1 min | 4.5 min | 3.0 min |

**Price Impact grosser Kaeufe — und hier liegt eine haeufige Fehlannahme:**

Es gibt **keine Preis-Slippage**. Der Kaufpreis ist unabhaengig von der Menge exakt `shares * askPrice` (`src/StockMarket/StockMarketHelpers.ts:28`). Was grosse Transaktionen bewirken, ist etwas anderes: sie **daempfen den Forecast in Richtung neutral**.

`src/StockMarket/StockMarketHelpers.ts:70-109` (`processTransactionForecastMovement`, aufgerufen bei jedem Kauf/Verkauf, `src/StockMarket/BuyingAndSelling.tsx:109,184,284,372`):

```ts
const firstShares = stock.shareTxUntilMovement;
...
let numIterations = 1 + Math.ceil(remainingShares / stock.shareTxForMovement);   // :94
const forecastChange = forecastChangePerPriceMovement * (numIterations - 1);     // :105
const forecastForecastChange = forecastChange * (stock.mv / 100);                // :106
stock.influenceForecast(forecastChange);
stock.influenceForecastForecast(forecastForecastChange);
```

mit `forecastChangePerPriceMovement = 0.006` (`src/StockMarket/StockMarketHelpers.ts:6`).

`influenceForecast` (`src/StockMarket/Stock.ts:246-250`) zieht `otlkMag` in Richtung `StockForecastInfluenceLimit = 5` (`src/StockMarket/Stock.ts:5`) — **aber nur nach unten und nur bis 5**:

```ts
if (this.otlkMag > 5) this.otlkMag = Math.max(5, this.otlkMag - change);
```

`shareTxForMovement` liegt je Aktie zwischen **12 000 und 216 000** Aktien (`src/StockMarket/data/InitStockMetadata.ts`) und regeneriert um **10 pro Tick** (`src/StockMarket/StockMarket.ts:315`).

**Rechenbeispiel:** Eine Aktie mit `shareTxForMovement = 50 000`. Ein Kauf von 1 Mio Aktien loest ca. 21 Bewegungen aus → `forecastChange = 0.006 * 20 = 0.12`. Bei einem `otlkMag` von 15 (Forecast 65 %) sinkt der auf 14.88 (Forecast 64.88 %). **Der Effekt ist winzig.** Selbst der Kauf der kompletten `maxShares` verschiebt den Forecast um deutlich weniger als einen Prozentpunkt.

**Praktische Konsequenz:** Man kann bedenkenlos maximal gross einsteigen. Der einzige echte Deckel ist `maxShares` = 20 % der `totalShares` (`src/StockMarket/Stock.ts:148-150`), abfragbar mit `ns.stock.getMaxShares()` (`src/NetscriptFunctions/StockMarket.ts:93-99`). Long- und Short-Positionen teilen sich dieses Kontingent (`src/StockMarket/BuyingAndSelling.tsx:84`).

**Der Spieler kann den Forecast auch ueber Hacking beeinflussen** (`src/StockMarket/PlayerInfluencing.ts`):

```ts
export const forecastForecastChangeFromHack = 0.1;                  // :12
export const forecastForecastChangeFromCompanyWork = 0.001;         // :15
// hack(): mit Wahrscheinlichkeit moneyHacked/moneyMax  ->  otlkMagForecast -= 0.1   :34-37
// grow(): mit Wahrscheinlichkeit moneyGrown/moneyMax   ->  otlkMagForecast += 0.1   :57-60
```

Wirkt nur auf Server, deren `organizationName` einem Aktien-Namen entspricht. Der Effekt geht auf den **Zweitforecast**, nicht direkt auf `otlkMag` — also traege, aber steuerbar. Das ist die Grundlage der bekannten "Stock Manipulation"-Strategien und macht den Aktienmarkt zum Verstaerker einer bereits laufenden Hacking-Infrastruktur.

### 3.4 Was liefert 4S-Data genau, und wie zuverlaessig ist es?

`src/NetscriptFunctions/StockMarket.ts:238-247`:

```ts
getForecast: (ctx) => (_symbol) => {
  if (!Player.has4SDataTixApi) throw ...;
  const stock = getStockFromSymbol(ctx, symbol);
  let forecast = 50;
  stock.b ? (forecast += stock.otlkMag) : (forecast -= stock.otlkMag);
  return forecast / 100;
}
```

Und im Tick (`src/StockMarket/StockMarket.ts:271-275`):

```ts
let chc = 50;
chc = stock.b ? (chc + stock.otlkMag)/100 : (chc - stock.otlkMag)/100;
```

**Das ist bitweise dieselbe Rechnung.** `ns.stock.getForecast()` liefert also **exakt die Wahrscheinlichkeit, mit der der Kurs im naechsten Tick steigt** — kein Schaetzwert, kein Rauschen, keine Verzoegerung. Die einzige Ausnahme: wenn `stock.price >= stock.cap`, wird `chc` intern auf 0.1 gesetzt (`:276-279`), waehrend `getForecast()` weiter den alten Wert meldet. Der `cap` liegt bei `getRandomIntInclusive(price*1e3, price*25e3)` (`src/StockMarket/Stock.ts:139`) und wird praktisch nie erreicht.

`getVolatility()` (`src/NetscriptFunctions/StockMarket.ts:228-236`) liefert `mv * darknetMult / 100`, also die Obergrenze von `av` — ebenfalls exakt.

**Bewertung:** 4S-Data ist keine "Prognose", sondern ein **Blick auf die internen Wuerfelgewichte**. Zuverlaessiger geht es nicht. Der Restrisiko liegt ausschliesslich in (a) der Varianz des Einzelwurfs und (b) dem 45%-Richtungswechsel alle 75 Ticks. Eine Strategie, die jeden Tick den Forecast neu liest und bei Unterschreiten von ~0.5 sofort verkauft, hat praktisch kein Modellrisiko mehr — nur Transaktionskosten.

**Ohne 4S** muss man `otlkMag` aus der beobachteten Kurshistorie schaetzen. Da alle Aktien pro Tick dasselbe `v` benutzen, ist die Richtung des Ticks pro Aktie ein sauberer Bernoulli-Zug mit Parameter `chc` — nach n beobachteten Ticks ist der Standardfehler des geschaetzten Forecasts `sqrt(p(1-p)/n)`, bei n=100 also rund 5 Prozentpunkte. Das reicht fuer eine grobe Long/Short-Entscheidung, aber nicht fuer feines Timing.

**Wirtschaftlichkeit der 4S-Kaeufe:** $26 Mrd fuer 4S Data + 4S TIX API. Bei einer Kapitalbasis von $1 Mrd und einem realistischen Faktor von 1.3x/h (mv 0.9, f 0.6) sind das $300M/h — die $26 Mrd sind in unter vier Stunden drin. Bei einer Kapitalbasis unter ~$500M lohnt sich der Kauf dagegen nicht, weil die 4S-Kosten selbst dann mehr als die halbe Kriegskasse fressen.

---

## 4. Crime

### 4.1 Erfolgsformel

`src/Crime/Crime.ts:120-136`:

```ts
let chance =
  this.hacking_success_weight   * p.skills.hacking +
  this.strength_success_weight  * p.skills.strength +
  this.defense_success_weight   * p.skills.defense +
  this.dexterity_success_weight * p.skills.dexterity +
  this.agility_success_weight   * p.skills.agility +
  this.charisma_success_weight  * p.skills.charisma +
  CONSTANTS.IntelligenceCrimeWeight * p.skills.intelligence;   // 0.025, src/Constants.ts:50
chance /= CONSTANTS.MaxSkillLevel;      // 975
chance /= this.difficulty;
chance *= p.mults.crime_success;
chance *= currentNodeMults.CrimeSuccessRate;                   // BN1: 1
chance *= calculateIntelligenceBonus(p.skills.intelligence, 1);
return Math.min(chance, 1);
```

mit `calculateIntelligenceBonus(int, w) = 1 + w * int^0.8 / 600` (`src/PersonObjects/formulas/intelligence.ts:1-3`).

Wurf: `Math.random() <= chance` (`src/Crime/CrimeHelpers.ts:7-11`).

### 4.2 Auszahlung und Karma

`src/Work/CrimeWork.ts:56-86`:

```ts
const focusBonus = Player.focusPenalty();              // 1 mit Fokus, 0.8 ohne
let gains = scaleWorkStats(this.earnings(), focusBonus, false);
let karma = crime.karma;
const success = determineCrimeSuccess(crime.type);
if (success) {
  Player.gainMoney(gains.money, "crime");
  Player.numPeopleKilled += crime.kills;
  Player.gainIntelligenceExp(gains.intExp);
} else {
  gains = scaleWorkStats(gains, 0.25);
  karma /= 4;
}
// ... EXP wird immer vergeben (bei Misserfolg zu 25 %)
Player.karma -= karma * focusBonus;
```

Wichtig:
- **Geld gibt es nur bei Erfolg.** Erwartetes Geld pro Versuch = `p * crime.money`.
- **Karma gibt es immer**, bei Misserfolg zu einem Viertel. Erwartetes Karma = `karma * (0.25 + 0.75*p)`.
- Der dritte Parameter `false` in `scaleWorkStats` heisst `scaleMoney = false` — der Fokus-Malus trifft also EXP und Karma, **nicht** das Geld.

Geld-Multiplikatoren (`src/Work/Formulas.ts:58-79`):

```ts
multWorkStats(newWorkStats({money: crime.money, ...}), person.mults,
              person.mults.crime_money * currentNodeMults.CrimeMoney)   // BN1: CrimeMoney = 1
```

Der Crime-Timer laeuft in `src/Work/CrimeWork.ts:35-50`: die Dauer ist eine feste Konstante pro Verbrechen, **unabhaengig von Stats**. Es gibt keinen Weg, Verbrechen zu beschleunigen.

### 4.3 Vollstaendige Verbrechenstabelle

Alle Werte aus `src/Crime/Crimes.ts`:

| Verbrechen | Zeile | Dauer | Geld | Difficulty | Karma | Kills | Erfolgs-Gewichte |
|---|---|---:|---:|---:|---:|---:|---|
| shoplift | `:6-21` | 2 s | $15 000 | 0.05 | 0.1 | 0 | dex 1, agi 1 |
| mug | `:44-63` | 4 s | $36 000 | 0.20 | 0.25 | 0 | str 1.5, def 0.5, dex 1.5, agi 0.5 |
| homicide | `:139-160` | 3 s | $45 000 | 1.00 | 3.0 | 1 | str 2, def 2, dex 0.5, agi 0.5 |
| dealDrugs | `:86-94` | 10 s | $120 000 | 1.00 | 0.5 | 0 | cha 3, dex 2, agi 1 |
| traffickArms | `:116-137` | 40 s | $600 000 | 2.00 | 1.0 | 0 | cha 1, str 1, def 1, dex 1, agi 1 |
| robStore | `:23-42` | 60 s | $400 000 | 0.20 | 0.5 | 0 | hack 0.5, dex 2, agi 1 |
| grandTheftAuto | `:162-185` | 80 s | $1 600 000 | 8.00 | 5.0 | 0 | hack 1, str 1, dex 4, agi 2, cha 2 |
| larceny | `:65-84` | 90 s | $800 000 | 0.333 | 1.5 | 0 | hack 0.5, dex 1, agi 1 |
| kidnap | `:187-209` | 120 s | $3 600 000 | 5.00 | 6.0 | 0 | cha 1, str 1, dex 1, agi 1 |
| bondForgery | `:96-114` | 300 s | $4 500 000 | 0.50 | 0.1 | 0 | hack 0.05, dex 1.25 |
| assassination | `:211-233` | 300 s | $12 000 000 | 8.00 | 10.0 | 1 | str 1, dex 2, agi 1 |
| heist | `:235-260` | 600 s | $120 000 000 | 18.00 | 15.0 | 0 | hack 1, str 1, def 1, dex 1, agi 1, cha 1 |

EXP-Ertraege (dieselben Zeilen): shoplift 2 dex/agi; mug 3 str/def/dex/agi; homicide 2 str/def/dex/agi; dealDrugs 5 dex/agi, 10 cha; robStore 30 hack, 45 dex/agi; larceny 45 hack, 60 dex/agi; traffickArms 20 str/def/dex/agi, 40 cha; bondForgery 100 hack, 150 dex, 15 cha; grandTheftAuto 20 str/def/dex, 80 agi, 40 cha; kidnap 80 auf alle fuenf; assassination 300 str/def/dex/agi; heist 450 auf alle sechs.

Intelligenz-EXP = `Faktor * CONSTANTS.IntelligenceCrimeBaseExpGain (0.05)`: robStore 7.5, larceny 15, bondForgery 60, grandTheftAuto 16, kidnap 26, assassination 65, heist 130.

### 4.4 Was ist wann optimal?

Gerechnet aus obiger Tabelle, BN1, keine Augmentations (`mults.crime_success = 1`, `mults.crime_money = 1`), Intelligenz 0, alle Stats gleich hoch, mit Fokus.

**Geld pro Sekunde** (`p * money / Dauer`):

| alle Stats | bestes Verbrechen | $/s | zweitbestes |
|---:|---|---:|---|
| 10 | shoplift | 3 077 | mug 1 846 |
| 50 | mug | 9 000 | shoplift 7 500 |
| 100 | mug | 9 000 | homicide 7 692 |
| 200 | homicide | 15 000 | heist 13 675 |
| 400 | heist | 27 350 | traffickArms / bondForgery / homicide je 15 000 |
| 800 | heist | 54 701 | grandTheftAuto 20 000 |
| 975 | heist | 66 667 | kidnap 24 000 |

**Karma pro Sekunde** (`karma * (0.25 + 0.75p) / Dauer`):

| alle Stats | bestes | karma/s | zweitbestes |
|---:|---|---:|---|
| 10 | homicide | 0.289 | shoplift 0.028 |
| 50 | homicide | 0.442 | mug 0.063 |
| 100 | homicide | 0.635 | grandTheftAuto 0.022 |
| ≥200 | **homicide** | **1.000** | mug / grandTheftAuto 0.063 |

**Homicide ist fuer Karma nicht bloss das beste, sondern um den Faktor 16 besser als alles andere.** Grund: 3 Karma bei nur 3 s Dauer und Difficulty 1. Ab etwa 195 in allen Kampfstats (`(2+2+0.5+0.5)*X/975/1 >= 1` → `X >= 195`) ist die Erfolgschance 100 % und die Rate bei genau 1.0 Karma/s eingefroren.

**Praktische Regel:**

- **Anfang (Stats < 50):** shoplift oder mug. Beide sind schnell, billig und trainieren dex/agi bzw. alle vier Kampfstats.
- **Karma-Farmen fuer die Gang:** immer **homicide**, ohne Ausnahme. Von 0 auf −54 000 Karma braucht es bei 1.0 karma/s exakt **54 000 Sekunden = 15 Stunden** reine Spielzeit (gerechnet, `GangKarmaRequirement: -54000` in `src/Gang/data/Constants.ts:27`). Mit Sleeves parallel geht es entsprechend schneller, siehe Abschnitt 5.
- **Geld-Farmen mit hohen Stats:** heist, sobald die Stats ueber ~350 liegen. Darunter ist homicide besser, weil heist bei Difficulty 18 lange unter 20 % Erfolgschance bleibt.
- **Ohne Fokus** (z. B. weil parallel gearbeitet wird): Geld bleibt voll, Karma und EXP fallen auf 80 %. Die Augmentation NeuroreceptorManager hebt das auf (`src/PersonObjects/Player/PlayerObjectGeneralMethods.ts:624`).

**Wichtiger Vorbehalt:** Crime skaliert nicht mit Investition. Der Deckel liegt bei $66 667/s (heist bei Maximalstats) und ist damit gegenueber jedem ernsthaften Hacking-Setup irrelevant. Crime ist ein **Stat-Trainer und Karma-Generator**, keine Geldquelle im mittleren oder spaeten Spiel.

---

## 5. Sleeves

### 5.1 Verfuegbarkeit

`src/PersonObjects/Sleeve/SleeveCovenantPurchases.tsx:62-63`:

```ts
const numSleeves =
  Math.min(3, Player.sourceFileLvl(10) + (Player.bitNodeN === 10 ? 1 : 0)) + Player.sleevesFromCovenant;
```

| Situation | Sleeves |
|---|---:|
| BN1, kein SF10 | **0** |
| BN1, SF10 Level 1 / 2 / 3 | 1 / 2 / 3 |
| BN10, SF10 Level 0 / 1 / 2+ | 1 / 2 / 3 |
| plus gekaufte Covenant-Sleeves | bis zu +5 |

**Maximum insgesamt: 8** (`MaxSleevesFromCovenant = 5`, `src/PersonObjects/Sleeve/SleeveCovenantPurchases.tsx:13`; bestaetigt durch Achievement `src/Achievements/Achievements.ts:543`).

**In BN1 sind Sleeves ohne SF10 also gar nicht vorhanden.** Die Sidebar blendet den Reiter aus (`src/Sidebar/ui/SidebarRoot.tsx:171`), die NS-API wirft (`src/NetscriptFunctions/Sleeve.ts:35-40`).

`sourceFileLvl` (nicht `activeSourceFileLvl`) heisst: ein SF-10-Override in den BitNode-Optionen aendert die Sleeve-Anzahl **nicht** (Kommentar `SleeveCovenantPurchases.tsx:59-61`).

SF-10 hat **keinen** Multiplikator-Effekt, es gewaehrt ausschliesslich Sleeves (`src/SourceFile/applySourceFile.ts:148-152`).

### 5.2 Was Sleeves koennen

Enum `SleeveWorkType`, `src/PersonObjects/Sleeve/Work/Work.ts:41-51` — 9 Typen:

| Typ | Datei | Kern |
|---|---|---|
| `COMPANY` | `Work/SleeveCompanyWork.ts:40-48` | Geld + Firmen-Reputation |
| `FACTION` | `Work/SleeveFactionWork.ts:45-52` | hacking / field / security, Rep an die Fraktion |
| `CRIME` | `Work/SleeveCrimeWork.ts:37-53` | Geld + Karma + Kampf-EXP |
| `CLASS` | `Work/SleeveClassWork.ts:39-42` | Uni-Kurse und Gym |
| `RECOVERY` | `Work/SleeveRecoveryWork.ts:12-18` | Shock abbauen |
| `SYNCHRO` | `Work/SleeveSynchroWork.ts:13-19` | Sync aufbauen |
| `BLADEBURNER` | `Work/SleeveBladeburnerWork.ts:41-61` | General Actions + Contracts |
| `INFILTRATE` | `Work/SleeveInfiltrateWork.ts:20-28` | Infiltrate Synthoids, 300 Cycles = 60 s je Durchlauf |
| `SUPPORT` | `Work/SleeveSupportWork.ts:10-20` | `teamSize += 1` in Bladeburner |

Einschraenkungen (`src/PersonObjects/Sleeve/ui/TaskSelector.tsx:65-93`): nur **ein** Sleeve pro Firma bzw. Fraktion; die Gang-Fraktion, Bladeburners und Shadows of Anarchy sind gesperrt. Reisen bricht die Arbeit ab (`src/PersonObjects/Sleeve/Sleeve.ts:542-548`).

### 5.3 Shock und Sync

Startwerte: `memory = 1` (`src/PersonObjects/Sleeve/Sleeve.ts:59`), `shock = 100` (`:68`), `sync = 1` (`:78`).

```ts
shockBonus() { return (100 - this.shock) / 100; }   // :173-175
syncBonus()  { return this.sync / 100; }            // :177-179
```

**Passiver Shock-Abbau** (`src/PersonObjects/Sleeve/Sleeve.ts:263-275`):

```ts
if (this.storedCycles < 5 || !this.currentWork) return;      // ein untaetiger Sleeve regeneriert NICHT
const cyclesUsed = Math.min(this.storedCycles, 15);
this.shock = Math.max(0, this.shock - 0.0001 * calculateIntelligenceBonus(this.skills.intelligence, 0.75) * cyclesUsed);
```

**Shock Recovery zusaetzlich** (`src/PersonObjects/Sleeve/Work/SleeveRecoveryWork.ts:13-17`): weitere `0.0002` pro Cycle → insgesamt **0.0003/Cycle**.

**Sync-Aufbau** (`src/PersonObjects/Sleeve/Work/SleeveSynchroWork.ts:14-18`): `0.0002 * calculateIntelligenceBonus(Player.skills.intelligence, 0.5)` pro Cycle. Achtung: hier zaehlt die **Intelligenz des Spielers**, beim Shock die des Sleeves.

Bei 5 Cycles/s und Intelligenz 0 (gerechnet):

| Vorgang | Rate | Dauer |
|---|---|---|
| Shock passiv | 1.8 Punkte/h | — |
| Shock Recovery | 5.4 Punkte/h | 100 → 0 in **≈ 18.5 h** |
| Synchronize | 3.6 Punkte/h | 1 → 100 in **≈ 27.5 h** |

**Wo Shock und Sync wirken** (`src/PersonObjects/Sleeve/Work/Work.ts:17-25`):

```ts
applyWorkStatsExp(sleeve, shockedStats, mult);                    // Sleeve selbst: 100 %
Player.gainMoney(shockedStats.money * mult, "sleeves");           // Geld: 100 %
const sync = sleeve.syncBonus();
applyWorkStatsExp(Player, shockedStats, mult * sync);             // Spieler-EXP: sync-Anteil
```

Da alle Work-Klassen `scaleWorkStats(..., shockBonus(), false)` mit `scaleMoney = false` aufrufen (`src/Work/WorkStats.ts:49-62`):

- **Geld: immer 100 % an den Spieler, weder von Shock noch von Sync gemindert.**
- **EXP an den Spieler: `roh * shockBonus * sync/100`.**
- **Reputation: nur shock-skaliert, nicht sync-skaliert** (`SleeveFactionWork.ts:50-51`, `SleeveCompanyWork.ts:46`).
- **Karma bei Crime: `crime.karma * syncBonus()`** (`SleeveCrimeWork.ts:46`).

Das ist strategisch entscheidend: **ein frisch gekaufter Sleeve mit Shock 100 verdient sofort vollen Geldbetrag** und braucht nur fuer EXP und Karma die 18.5 Stunden Shock-Abbau.

Schaden: `shock = Math.min(100, shock + 0.5)` bei HP ≤ 0 (`src/PersonObjects/Sleeve/Sleeve.ts:559-573`).

BitNode-Wechsel (`Sleeve.prestige()`, `:228-256`): Augs weg, EXP 0, `shock = 100`, `sync = Math.max(memory, 1)`. Bei blossem Aug-Install bleiben Sleeves erhalten (`src/PersonObjects/Player/PlayerObjectGeneralMethods.ts:120`).

### 5.4 Memory

**Wirkung:** ausschliesslich der Sync-Startwert nach einem BitNode-Wechsel (`src/PersonObjects/Sleeve/Sleeve.ts:253`: `this.sync = Math.max(this.memory, 1)`). Memory selbst ueberlebt den Reset.

**Maximum 100** (`src/PersonObjects/Sleeve/Sleeve.ts:403`).

**Preisformel** (`src/PersonObjects/Sleeve/Sleeve.ts:198-213`):

```ts
const mult = 1.02;  const baseCost = 1e12;
let currCost = 0;  let currMemory = this.memory - 1;
for (let i = 0; i < n; ++i) { currCost += Math.pow(mult, currMemory); ++currMemory; }
return currCost * baseCost;
```

→ ein Punkt bei Memory `m` kostet `1e12 * 1.02^(m-1)`. Erster Punkt: **$1 Billion**. Von 1 auf 100: `1e12 * (1.02^99 - 1)/0.02` ≈ **$305 Billionen pro Sleeve** (gerechnet).

**Kaufbar nur in BN10** und nur als Mitglied von The Covenant (`src/PersonObjects/Sleeve/SleeveCovenantPurchases.tsx:86-113`).

**Covenant-Sleeve-Preise** (`src/PersonObjects/Sleeve/SleeveCovenantPurchases.tsx:14,26`): `Math.pow(10, sleevesFromCovenant) * 10e12` → $10 Bio, $100 Bio, $1 Brd, $10 Brd, $100 Brd; Summe ≈ $1.11e17 (gerechnet). Ebenfalls nur in BN10.

### 5.5 Sleeve-Augmentations

**Preis = `aug.baseCost`, voellig ungeskaliert.** `src/PersonObjects/Sleeve/Sleeve.ts:372` (Pruefung) und `:397` (`Player.loseMoney(aug.baseCost, "sleeves")`).

Das ist der bemerkenswerte Punkt: Es greift **weder** der Multi-Aug-Multiplikator (`getGenericAugmentationPriceMultiplier`, `src/Augmentation/AugmentationHelpers.ts:29-37`) **noch** ein BitNode-Kostenmultiplikator. Sleeve-Augs kosten immer den nackten Grundpreis, egal wie viele man schon gekauft hat.

Voraussetzungen (`src/PersonObjects/Sleeve/Sleeve.ts:356-361`): **Shock muss exakt 0 sein**, und die Fraktions-Reputation muss ueber `getAugCost(aug).repCost` liegen (`:142`, `:158`).

Nebeneffekt: Der Install setzt **alle EXP des Sleeves auf 0** (`:215-225`).

### 5.6 Bewertung fuer BN1

Ohne SF10 gibt es in BN1 keine Sleeves. Mit SF10 sind sie fuer BN1 in dieser Reihenfolge nuetzlich:

1. **Karma parallel farmen.** Jeder Sleeve auf homicide erzeugt `3 * syncBonus` Karma je 3 s. Bei sync 100 also volle 1.0 karma/s je Sleeve — 3 Sleeves plus Spieler bringen die 15-Stunden-Gang-Wartezeit auf unter 4 Stunden.
2. **Geld nebenbei.** Geld ist nicht shock-gemindert; ein Sleeve auf einem Geldverbrechen zahlt ab Sekunde 1 voll aus.
3. **Fraktions-Reputation.** Mehrere Fraktionen parallel bearbeiten, ohne den eigenen Charakter zu binden.

Kaufen und aufwerten kann man Sleeves in BN1 **nicht** — das geht nur in BN10 (`src/BitNode/BitNode.tsx:371-372`).

---

## 6. Gang

### 6.1 Voraussetzungen

`src/PersonObjects/Player/PlayerObjectGangMethods.ts:12-30`:

```ts
if (this.bitNodeOptions.disableGang) { ... }                   // :13
if (this.bitNodeN === 2) return { success: true };              // :16-18  BN2: sofort, ohne alles
if (this.activeSourceFileLvl(2) === 0) { ... }                  // :19-21  sonst SF2 noetig
if (this.karma > GangConstants.GangKarmaRequirement) { ... }    // :22-27  karma <= -54000
```

**Fuer BN1 heisst das: Source-File 2 (mindestens Level 1) UND Karma ≤ −54 000.** Der SF-2-Level aendert die Karma-Schwelle nicht; es gibt keinen BitNode-Multiplikator darauf.

`GangKarmaRequirement: -54000` — `src/Gang/data/Constants.ts:27`.

Zusaetzlich (`src/Gang/helpers.ts:6-26`): `Player.gang` muss `null` sein (eine Gang pro BitNode) und **der Spieler muss bereits Mitglied der gewaehlten Fraktion sein** (`:22`).

Nebeneffekt der Gruendung: laufende Faction-Work wird abgebrochen und **`fac.playerReputation = 0` gesetzt** (`src/PersonObjects/Player/PlayerObjectGangMethods.ts:67`). Also vorher keine Reputation bei der Zielfraktion ansparen.

**Gang-faehige Fraktionen** (`src/Gang/data/Constants.ts:18-26`):

| Fraktion | Typ |
|---|---|
| Slum Snakes | Combat |
| Tetrads | Combat |
| The Syndicate | Combat |
| The Dark Army | Combat |
| Speakers for the Dead | Combat |
| **NiteSec** | **Hacking** |
| **The Black Hand** | **Hacking** |

Hacking-Bestimmung: `src/NetscriptFunctions/Gang.ts:49`.

### 6.2 Kernformeln

Alle in `src/Gang/formulas/formulas.ts`. Vorab der gemeinsame Stat-Term:

```ts
statWeight = (task.hackWeight/100)*member.hack + (task.strWeight/100)*member.str
           + (task.defWeight/100)*member.def  + (task.dexWeight/100)*member.dex
           + (task.agiWeight/100)*member.agi  + (task.chaWeight/100)*member.cha;
```

Die Gewichte summieren sich pro Task auf 100 (Pruefung `src/Gang/GangMemberTask.ts:48-54`).

**Wanted-Penalty** (`:11-13`):

```ts
return gang.respect / (gang.respect + gang.wantedLevel);
```

**Respekt pro Member und Cycle** (`:15-31`):

```ts
statWeight -= 4 * task.difficulty;                                                         // :24
if (statWeight <= 0) return 0;
const territoryMult   = Math.max(0.005, Math.pow(gang.territory * 100, task.territory.respect) / 100);  // :26
const territoryPenalty= (0.2 * gang.territory + 0.8) * currentNodeMults.GangSoftcap;       // :27
return Math.pow(11 * task.baseRespect * statWeight * territoryMult * wantedPenalty, territoryPenalty); // :30
```

**Geld pro Cycle** (`:56-73`):

```ts
statWeight -= 3.2 * task.difficulty;                                                       // :66
const territoryMult = Math.max(0.005, Math.pow(gang.territory * 100, task.territory.money) / 100);      // :68
return Math.pow(5 * task.baseMoney * statWeight * territoryMult * wantedPenalty, territoryPenalty);    // :72
```

**Wanted pro Cycle** (`:33-54`):

```ts
statWeight -= 3.5 * task.difficulty;                                                       // :42
if (task.baseWanted < 0) return 0.4 * task.baseWanted * statWeight * territoryMult;         // :46-48
const calc = (7 * task.baseWanted) / Math.pow(3 * statWeight * territoryMult, 0.8);         // :49
return Math.min(100, calc);                                                                // :53
```

Zwei Beobachtungen mit direkter Spielrelevanz:

1. **`GangSoftcap` wirkt als Exponent, nicht als Faktor** — in BN1 ist er 1 (`src/BitNode/BitNodeMultipliers.ts:91`, bestaetigt durch `case 1: return new BitNodeMultipliers()` in `src/BitNode/BitNode.tsx:572-574`). BN1 ist damit der beste Gang-Node ueberhaupt.
2. **Wanted-Zuwachs skaliert INVERS mit statWeight** (`^-0.8`), Wanted-Reduktion dagegen linear. Starke Member erzeugen also weniger Wanted und raeumen es schneller weg. Das begruendet die uebliche Strategie: erst Member trainieren, dann Geldtasks.

Auszahlung: `Player.gainMoney(moneyGainPerCycle * numCycles, "gang")` (`src/Gang/Gang.ts:168`) — der Rueckgabewert ist **Geld pro Cycle (200 ms)**, nicht pro Sekunde.

Fraktions-Reputation (`src/Gang/Gang.ts:152-155`):

```ts
const favorMult = 1 + gangFaction.favor / 100;
gangFaction.playerReputation += (Player.mults.faction_rep * respectGainsTotal * favorMult) / 75;
```

mit `GangRespectToReputationRatio: 75` (`src/Gang/data/Constants.ts:10`).

**Wanted-Update pro Tick** (`src/Gang/Gang.ts:157-167`): `this.wanted = newWanted * (1 - justice * 0.001)`, wobei `justice` die Anzahl der Member mit negativem `baseWanted` ist (`:136`). Untergrenze `wanted = 1`.

### 6.3 Tick, Mitglieder, Kosten

**Tick** (`src/Gang/Gang.ts:99-121`, Konstanten `src/Gang/data/Constants.ts:29-31`): `minCyclesToProcess = 10` Cycles → die Gang rechnet **alle 2 s**; `maxCyclesToProcess = 25` → max. 5 s Bonus-Time pro Batch. Territory/Power alle 100 Cycles = **20 s** (`src/Gang/data/Constants.ts:12`).

Alle Raten werden **einmal pro Batch** mit dem Zustand zu Batch-Beginn berechnet und mit `numCycles` multipliziert — kein Zinseszins innerhalb eines Batches.

**Rekrutierung** (`src/Gang/Gang.ts:316-323`):

```ts
if (this.members.length < 3) return 0;
if (this.members.length >= 12) return Infinity;
return Math.pow(5, this.members.length - 3 + 1);
```

Member 1–3 gratis; danach 5, 25, 125, 625, 3 125, 15 625, 78 125, 390 625 und **1 953 125 Respekt fuer den 12. und letzten Member**.

**Ausruestung und Augmentations:** Fixpreise, **keine Steigerung pro Kauf** (`src/Gang/data/upgrades.ts:34-227`). Jedes Item ist pro Member nur einmal kaufbar (`src/Gang/GangMember.ts:356`). Der effektive Preis sinkt nur ueber einen globalen Rabatt (`src/Gang/Gang.ts:407-416`):

```ts
const discount = Math.pow(respect, 0.01) + respect/5e6 + Math.pow(power, 0.01) + power/1e6 - 1;
return Math.max(1, discount);
// getUpgradeCost(upg) = upg.cost / getDiscount()     :429-434
```

| Kategorie | billigstes | teuerstes |
|---|---|---|
| Equipment | Baseball Bat $1 000 000 (`:35-40`) | Techtronika-SPT32 $225 000 000 (`:77-82`) |
| Augmentations (`upgType: "g"`) | BitWire $5 000 000 000 (`:203-208`) | Graphene Bone Lacings $50 000 000 000 (`:221-226`) |

**Wichtig:** Augmentations ueberleben Ascension, Equipment nicht (`src/Gang/GangMember.ts:309-319`).

**Ascension** (`src/Gang/formulas/formulas.ts:75-81`):

```ts
calculateAscensionPointsGain(exp) = Math.max(exp - 1000, 0);
calculateAscensionMult(points)    = Math.max(Math.pow(points / 2000, 0.5), 1);
```

Der Multiplikator wird erst > 1 ab `points > 2000`, also **ab exp > 3000 pro Stat**. Skill aus EXP (`src/Gang/GangMember.ts:70-72`):

```ts
Math.max(Math.floor(mult * (32 * Math.log(exp + 534.5) - 200)), 1)
```

### 6.4 Bewertung fuer BN1

Die Gang ist in BN1 verfuegbar, sobald SF2 vorhanden ist und man 15 Stunden homicide gefahren hat (siehe Abschnitt 4.4). Danach ist sie eine **passive Geld- und Reputationsquelle ohne RAM-Verbrauch**, die auch offline weiterlaeuft. Sie konkurriert nicht mit Hacking um Ressourcen, sondern kommt obendrauf.

Der eigentliche Wert liegt bei einem BN1-Durchlauf aber weniger im Geld als in der **Reputation**: Respekt/75 fliesst dauerhaft in die Fraktions-Reputation, und die Gang-Fraktion bietet mehr Augmentations als jede andere.

---

## 7. Corporation und Bladeburner (grob)

### 7.1 Corporation

**Zugang:** `canAccessBitNodeFeature(3)` — also **Source-File 3 mindestens Level 1** ausserhalb von BN3 (`src/PersonObjects/Player/PlayerObjectCorporationMethods.ts:8-10`).

**Gruendungskosten** (`src/Corporation/helpers.ts:46-51`):

```ts
export function costOfCreatingCorporation(restart: boolean): number {
  if (restart && !Player.corporation?.seedFunded) return 50e9;
  return 150e9;
}
```

**$150 Mrd selbstfinanziert.** Startkapital der Corp ist ebenfalls 150e9 (`src/Corporation/Corporation.ts:41`).

**Seed Money (0 Kosten, dafuer 500 Mio Investorenanteile) gibt es ausschliesslich in BN3** (`src/Corporation/helpers.ts:37-39`). In BN1 also nicht.

**Erste Division** — Auszug aus `src/Corporation/data/IndustryData.ts`:

| Industrie | Startkosten | Zeile |
|---|---:|---|
| Restaurant | $10 Mrd | `:96` |
| Tobacco | $20 Mrd | `:268` |
| Software | $25 Mrd | `:241` |
| **Agriculture** | **$40 Mrd** | `:9` |
| Chemical | $70 Mrd | `:39` |
| Real Estate | $600 Mrd | `:188` |
| Robotics | $1 Bio | `:214` |

Ein Office (Groesse 3) und ein Warehouse (Groesse 100) in Sector-12 sind darin bereits enthalten (`src/Corporation/Division.ts:93-101`); jede weitere Stadt kostet zusaetzlich $4 Mrd Office und $5 Mrd Warehouse (`src/Corporation/data/Constants.ts:58`, `:55`).

**Tick:** 1 State-Tick = 2 s, ein voller Marktzyklus (5 States) = 10 s (`src/Corporation/data/Constants.ts:52-54`, `src/Corporation/Corporation.ts:109-116`).

**Einschraenkung in BN1, die man leicht uebersieht:** Die Office-/Warehouse-Netscript-API ist nur freigeschaltet bei `bitNodeN === 3` **oder** `activeSourceFileLvl(3) === 3` (`src/PersonObjects/Player/PlayerObjectCorporationMethods.ts:21-24`). Mit SF3 Level 1 oder 2 laesst sich die Corporation in BN1 also nur ueber die UI steuern — fuer einen Skript-Optimierer ein K.-o.-Kriterium.

**Positiv:** `CorporationSoftcap = 1` in BN1 (`src/BitNode/BitNodeMultipliers.ts:46`), damit `tributeModifier = 1 - 1 + 0.15 = 0.15` (`src/Corporation/Corporation.ts:54`, angewandt als `Math.pow(dividends, 1 - tributeModifier)` in `:195`) — die guenstigste Dividendenbesteuerung im ganzen Spiel.

**Relevanz fuer einen BN1-Durchlauf: gering bis null.** Man braucht $150 Mrd Eigenkapital, um ueberhaupt anzufangen — an dem Punkt ist der BitNode mit Hacking laengst zu Ende zu spielen. Ohne SF3 Level 3 fehlt zudem die Skript-Steuerung. Corporation ist eine Sache fuer BN3 und fuer spaetere Durchlaeufe mit vorhandenen Source-Files.

### 7.2 Bladeburner

**Zugang zur Division:** alle vier Kampfstats ≥ **100** (`src/Locations/ui/SpecialLocation.tsx:68-76`, NS-Variante `src/NetscriptFunctions/Bladeburner.ts:349-360`). Kein Geld, kein Rang, keine Fraktion.

**Node-Zugang:** `(canAccessBitNodeFeature(6) || canAccessBitNodeFeature(7)) && !disableBladeburner` (`src/PersonObjects/Player/PlayerObjectBladeburnerMethods.ts:6-8`) — in BN1 also **SF6 oder SF7 noetig**.

**BitNode-Sperre:** `BladeburnerRank` ist nur in **BN8 gleich 0** (`src/BitNode/BitNode.tsx:790`). In BN1 ist der Multiplikator 1 (`src/BitNode/BitNodeMultipliers.ts:19`), also der Bestwert.

**Geld:** Nur Contracts zahlen; Operations und BlackOps zahlen nichts (`src/Bladeburner/Bladeburner.ts:936-943`).

```
moneyGain = 250_000 * rewardFac^(level-1) * skillMult(Money)
```

`ContractBaseMoneyGain = 250e3` (`src/Bladeburner/data/Constants.ts:49`), `rewardMultiplier = Math.pow(action.rewardFac, action.level - 1)` (`src/Bladeburner/Bladeburner.ts:919`), Skill "Hands of Midas" +10 %/Level (`src/Bladeburner/data/Skills.ts:93-96`).

`rewardFac` (`src/Bladeburner/data/Contracts.ts`): Tracking 1.041, Retirement 1.065, Bounty Hunter 1.085. Level-Aufstieg nach 3 Erfolgen (`src/Bladeburner/data/Constants.ts:44`).

**Auf Level 1 also exakt $250 000 pro erfolgreichem Contract**, unabhaengig vom Typ.

**Tick:** 1 Sekunde = 5 Game-Cycles (`src/Bladeburner/data/Constants.ts:2`). Aktionsdauer (`src/Bladeburner/Actions/Action.ts:105-122`):

```
baseTime = difficulty / 10                          // DifficultyToTimeFactor = 10
statFac  = 0.5 * (agi^0.04 + dex^0.035 + agi/10000 + dex/10000)
time     = ceil( max(1, baseTime * skillMult(ActionTime) / statFac) * penalty )   // BlackOps: penalty 1.5
```

Basisschwierigkeiten: Tracking 125, Retirement 200, Bounty Hunter 250 → 12.5 s / 20 s / 25 s vor `statFac`.

**Durchsatzdeckel:** Contracts haben eine endliche `count`, die mit `growthFunction() / ActionCountGrowthPeriod` nachwaechst, `ActionCountGrowthPeriod = 480` s (`src/Bladeburner/data/Constants.ts:39`, `src/Bladeburner/Bladeburner.ts:1389-1392`). Das begrenzt den Geldstrom staerker als die Aktionsdauer.

**Bladeburner ist ein alternativer BitNode-Ausstieg.** Nach Abschluss aller **21** Black Operations (`src/Bladeburner/data/BlackOperations.ts:735`) erscheint der Knopf "Destroy w0r1d_d43m0n" (`src/Bladeburner/ui/BlackOpPage.tsx:39-52`). Die letzte BlackOp (Operation Daedalus) verlangt Rang **400 000** (`src/Bladeburner/data/BlackOperations.ts:704-711`).

**Relevanz fuer einen BN1-Durchlauf: keine, ohne SF6/SF7.** Mit SF6/SF7 ist es eine zusaetzliche Geldquelle in der Groessenordnung von $250k pro ~15 s, also grob **$16 000/s** — vergleichbar mit Crime und damit fuer die Geldbeschaffung uninteressant. Der Wert liegt woanders: es ist ein Ausstiegspfad, der komplett ohne Hacking-Level auskommt.

---

## 8. DarkNet

Neues System, das es in aelteren Bitburner-Versionen nicht gab (`src/DarkNet/`, 33 Dateien).

### 8.1 Was es ist

Ein **zweites, paralleles Servernetz** mit Passwort-Raetseln statt Portknacken. Struktur: ein Gitter `Network[MAX_NET_DEPTH=40][NET_WIDTH=8]` (`src/DarkNet/models/DarknetState.ts:40`), Konstanten in `src/DarkNet/Enums.ts:4-11` (`SERVER_DENSITY = 0.6`, `AIR_GAP_DEPTH = 8`). Nutzbare Tiefe ist die Tiefe des aktuellen Labyrinths, 7 bis 36 (`src/DarkNet/effects/labyrinth.ts:393-396`). Reihe 0 haengt am Server `darkweb`, die letzte Reihe am Labyrinth (`src/DarkNet/controllers/NetworkGenerator.ts:219-231`).

Vier Eigenheiten, die das System praegen:

1. **`ns.scan` sieht Darknet-Server nicht** (`src/NetscriptFunctions.ts:187`) — man braucht `ns.dnet.probe()`, und fast jede API verlangt eine **direkte Verbindung** (`src/DarkNet/effects/offlineServerHandling.ts:82-97`). Man muss seine Skripte also Server fuer Server per `scp`/`exec` weiterreichen; das Skript selbst ist der Bewegungsapparat.
2. **Das Netz mutiert dauernd.** `getDarknetCyclesPerMutation = (rateMult * 150) / depth` Cycles (`src/DarkNet/utils/darknetNetworkUtils.ts:9-14`, `rateMult = 2` ausserhalb BN15) — bei Tiefe 30 also alle 10 Cycles = **2 Sekunden**. Server bewegen sich, starten neu oder verschwinden; laufende Skripte werden dabei gekillt (`src/DarkNet/controllers/NetworkMovement.ts:175`).
3. **Webstorms** loeschen 60 % aller beweglichen Server auf einen Schlag (`src/DarkNet/effects/webstorm.ts:25-79`).
4. **Der relevante Skill ist Charisma, nicht Hacking.** Jeder Server hat `requiredCharismaSkill` (`src/DarkNet/models/DarknetServerOptions.ts:67-72`); die Labyrinth-Stufen verlangen 300 / 600 / 1500 / 2500 / 3000 / 3500 / 4000 Charisma (`src/DarkNet/effects/labyrinth.ts:41,51,59,67,77,86,95,104`).

### 8.2 Freischaltung

Genau eine Bedingung — `src/DarkNet/utils/darknetAuthUtils.ts:6-8`:

```ts
export const hasDarknetAccess = () => {
  return canAccessBitNodeFeature(15) || Player.hasProgram(CompletedProgramName.darkscape);
};
```

| Weg | Kosten | Quelle |
|---|---:|---|
| Darkweb `buy DarkscapeNavigator.exe` (braucht TOR, $200 000) | **$50 000 000** | `src/DarkWeb/DarkWebItems.ts:15-19`, `src/DarkNet/Constants.ts:8` |
| Chongqing → "Shadowed Walkway" | **$30 000 000** | `src/Locations/ui/SpecialLocation.tsx:342-390`, `src/DarkNet/Constants.ts:6` |
| BN15 oder SF15 Level 1 | gratis, permanent | `src/BitNode/BitNode.tsx:551-552` |

**Kein Hacking-Level-Gate, kein Karma-Gate, kein Fraktions-Gate.** Der Walkway-Kauf schliesst den TOR-Router implizit mit ein (`src/DarkNet/effects/effects.ts:264-273`). Damit ist das DarkNet in **BN1 ohne jedes Source-File fuer $30 Mio erreichbar** — das ist der entscheidende Punkt.

Eine zweite Stufe, "Full Darknet Access" (`src/DarkNet/effects/effects.ts:280`), verlangt `bitNodeN === 15 || activeSourceFileLvl(15) > 0` und schaltet das Labyrinth ueberhaupt erst frei (`src/DarkNet/effects/labyrinth.ts:486-497`). **In BN1 ohne SF15 gibt es also kein Labyrinth und keine Labyrinth-Augmentations.**

### 8.3 Darknet-Server gegen normale Server

`DarknetServer` erbt von `BaseServer`, **nicht** von `Server` (`src/Server/DarknetServer.ts:29`). Daraus folgt fast alles:

| Eigenschaft | Normaler Server | Darknet-Server |
|---|---|---|
| `moneyAvailable` / `moneyMax` | ja | **existiert nicht** |
| `hackDifficulty` / Security | ja | **existiert nicht** |
| `requiredHackingSkill` | ja | **existiert nicht**, stattdessen `requiredCharismaSkill` (`:56`) |
| `ns.hack/grow/weaken` | ja | **wirft** — `src/Netscript/NetscriptHelpers.tsx:521-535` |
| Hack-Zeit | Formel `src/Hacking.ts:59-79` | **fix 16 s** — `src/Hacking.ts:61` |
| Backdoor-Zeit | `hackTime/4` | **4 s**, ohne Hacking-Level-Pruefung (`src/Terminal/Terminal.ts:240-242`) |
| Root | NUKE + Ports | `ns.dnet.authenticate` mit korrektem Passwort |
| Persistenz | permanent | **kann jederzeit verschwinden** |
| `cpuCores` | variabel | fix 1 (`:60`) |
| RAM | fest | `16 * 2^floor(difficulty/6) * [0.5, 1, 1, 1.15, 1.4]`, min 16 (`src/DarkNet/models/DarknetServerOptions.ts:206-211`) |

**Darknet-Server haben also weder Geld noch Security.** Sie sind reine RAM-Farmen und Loot-Container. Und weil `hack`/`grow`/`weaken` dort verboten sind, laesst sich das DarkNet-RAM nur nutzen, indem man **Worker dort startet, die auf normale Server zielen** — mit dem Risiko, dass jede Mutation die Skripte killt.

### 8.4 Geldformeln

**A) Cache-Geld** — `src/DarkNet/effects/cacheFiles.ts:90-102`:

```ts
const sf15_3Factor = Player.activeSourceFileLvl(15) >= 3 ? 1.5 : 1;
const reward =
  1.2 ** difficulty *
  1e7 *
  ((200 + Player.skills.charisma) / 200) *
  sf15_3Factor *
  Player.mults.crime_money *
  Player.mults.dnet_money *
  currentNodeMults.DarknetMoneyMultiplier;    // TODO: adjust balance
```

Das ist **exponentiell in der Server-Difficulty** und linear in Charisma. In BN1 ist `DarknetMoneyMultiplier = 1` (`src/BitNode/BitNodeMultipliers.ts:67`, Default; BN1 hat keinen Override).

Gerechnet, ohne Augmentations und ohne SF15:

| Difficulty | 1.2^d | cha 200 | cha 1000 | cha 2000 | cha 3000 |
|---:|---:|---:|---:|---:|---:|
| 0 | 1.00 | $20 Mio | $60 Mio | $110 Mio | $160 Mio |
| 10 | 6.19 | $124 Mio | $372 Mio | $681 Mio | $991 Mio |
| 20 | 38.34 | $767 Mio | $2.30 Mrd | $4.22 Mrd | $6.13 Mrd |
| 28 | 164.84 | $3.30 Mrd | $9.89 Mrd | $18.1 Mrd | $26.4 Mrd |

**Ein einziger tiefer Cache bringt mehr Geld als der gesamte Hacknet-Ausbau.**

Wichtig: `getMoneyReward` ist nur **einer von vier bzw. fuenf gleichverteilten Reward-Zweigen** (`src/DarkNet/effects/cacheFiles.ts:48-58`). Erwartungswert also 1/4 (bzw. 1/5 bei `.d.cache`) des Tabellenwerts.

Cache-Spawnrate: `0.1 * 1.05^difficulty` beim ersten erfolgreichen Auth (`src/DarkNet/effects/effects.ts:42-45`), **garantiert** bei vollstaendig befreitem Blocked RAM (`src/DarkNet/effects/ramblock.ts:50-53`). Kosten: `difficulty + 1` **Karma** pro geoeffnetem Cache (`src/DarkNet/effects/cacheFiles.ts:37-38`) — fuer ein Gang-Vorhaben ist das erwuenscht, nicht schaedlich.

**B) Phishing** — `src/DarkNet/effects/phishing.ts:33-47`:

```ts
moneyRewardChance = 0.05 * mults.crime_success * ((200 + cha) / 200);          // :19
moneyReward = 500 * mults.crime_money * mults.dnet_money
            * (0.1 + server.depth * 0.05)      // depthFactor
            * threads * ((400 + cha) / 400)
            * (hasDarknetBonusTime() ? 1.3 : 1)
            * (0.9 + Math.random() * 0.3)
            * currentNodeMults.DarknetMoneyMultiplier;
```

Intervall: `max(10000 * (400/(400+cha)), 200)` ms (`:12`).

Gerechnet, 1 Thread, ohne Augmentations:

| Charisma | Tiefe | Trefferchance | $/Treffer | Intervall | $/s je Thread |
|---:|---:|---:|---:|---:|---:|
| 200 | 5 | 0.10 | $276 | 6.67 s | **$4** |
| 1 000 | 10 | 0.30 | $1 102 | 2.86 s | **$116** |
| 2 000 | 20 | 0.55 | $3 465 | 1.67 s | **$1 143** |
| 4 000 | 30 | 1.00 | $9 240 | 0.91 s | **$10 164** |

Phishing kostet 2 GB RAM je Thread (`ns.dnet.phishingAttack`, `src/Netscript/RamCostGenerator.ts`) plus 1.6 GB Grundlast. Bei 500 GB Darknet-RAM und Charisma 4000 waeren das grob $2.5 Mio/s — respektabel, aber gegen ein ausgebautes Hacking-Setup nicht konkurrenzfaehig.

**C) BitNode-Multiplikator** `DarknetMoneyMultiplier` (`src/BitNode/BitNodeMultipliers.ts:67`, Default 1). Overrides in `src/BitNode/BitNode.tsx`: BN3 0.4 (`:628`), BN4 0.4 (`:658`), BN5 0.7 (`:689`), **BN8 0** (`:792`, Geld-Zweig komplett deaktiviert), BN9 0.05 (`:839`), BN10 0.4 (`:884`), BN13 0.1 (`:1039`). **BN1 und BN15: 1.**

**D) Spieler-Multiplikator `dnet_money`** (`src/PersonObjects/Multipliers.ts:28,63`) kommt ausschliesslich aus den Labyrinth-Augmentations (`src/Augmentation/Augmentations.ts`): TheBrokenWings 1.30 (`:1862`), TheHammer 1.10 (`:1892`), TheStaff 1.10 (`:1907`), TheLaw 1.15 (`:1923`), TheSword 1.10 (`:1941`) → maximal **x1.99**. In BN1 ohne SF15 nicht erreichbar, weil das Labyrinth fehlt.

### 8.5 Der eigentliche Wert: Gratis-Programme und Gratis-Marktzugang

`src/DarkNet/effects/cacheFiles.ts:130-171` — `getProgramAndStockMarketRelatedRewards` arbeitet eine **feste Reihenfolge** ab und gibt das jeweils erste Fehlende:

```
ServerProfiler -> BruteSSH -> DeepScanV1 -> FTPCrack -> AutoLink -> RelaySMTP
  -> DeepScanV2 -> HTTPWorm -> SQLInject -> Formulas.exe
  -> WSE Account -> TIX API -> 4S Market Data
  -> danach Geld (getMoneyReward)
```

Marktwerte dieser Kette (`src/DarkWeb/DarkWebItems.ts`, `src/StockMarket/data/Constants.ts`):

| Belohnung | Normalpreis |
|---|---:|
| SQLInject.exe | $250 000 000 |
| **Formulas.exe** | **$5 000 000 000** |
| WSE Account | $200 000 000 |
| TIX API | $5 000 000 000 |
| **4S Market Data** | **$1 000 000 000** |
| (alle uebrigen Programme) | ~$60 Mio zusammen |

**Das ist der Kern der Sache.** Fuer $30 Mio Einstieg bekommt man mit hinreichend vielen Caches Programme und Marktzugaenge im Wert von ueber **$11.5 Mrd** geschenkt — darunter Formulas.exe und 4S Market Data, die man sonst erst sehr spaet bezahlen kann. Die Reihenfolge ist deterministisch, man kann also planen.

Einschraenkung: `has4SData` wird nur gesetzt, wenn `bitNodeN !== 8` und `disable4SData` nicht gesetzt ist (`:165`). Und man bekommt **4S Data**, nicht die **4S TIX API** — die $25 Mrd fuer den Skript-Zugriff bleiben.

Weitere Reward-Zweige: `getStockReward` (`:104-117`) schenkt `min(floor(1 + difficulty*5 + rand*10), maxNewShares)` Aktien; `getDataFileReward` (`:119-128`) gibt Hinweisdateien; `getCCTReward` (`:76-88`, nur bei `.d.cache` aus Phishing) gibt bis zu 3 Coding Contracts mit `rewardScaling: 1/2`.

### 8.6 Wirkung auf den Aktienmarkt

`src/DarkNet/effects/effects.ts:197-201`:

```ts
export const getDarknetVolatilityMult = (symbol: string) => {
  const charges = DarknetState.stockPromotions[symbol] ?? 0;
  const growthRate = 0.001;
  return 1 + (1 - Math.exp(-growthRate * charges) + 2 * (1 - Math.exp(-growthRate * 0.15 * charges)));
};
```

Dieser Faktor multipliziert `stock.mv` an drei Stellen: in der Kursbewegung pro Tick (`src/StockMarket/StockMarket.ts:264`), in `ns.stock.getVolatility()` (`src/NetscriptFunctions/StockMarket.ts:234`) und in der UI-Anzeige.

**Wertebereich 1.0 bis 4.0** (asymptotisch), gerechnet:

| Charges | Multiplikator |
|---:|---:|
| 100 | 1.12 |
| 500 | 1.54 |
| 1 000 | 1.91 |
| 2 000 | 2.38 |
| 5 000 | 3.05 |
| 20 000 | 3.90 |

Charges kommen aus `ns.dnet.promoteStock`: `promotionAmount = threads * ((500 + cha)/500)` je Aufruf, Wartezeit `max(8000*(600/(600+cha)), 200)` ms (`src/NetscriptFunctions/Darknet.ts:590-598`).

**Zerfall:** `scaleDarknetVolatilityIncreases(0.4)` laeuft in jedem Markt-Zyklus (`src/DarkNet/effects/effects.ts:203-209`, aufgerufen in `src/StockMarket/StockMarket.ts:231`), also alle 75 Ticks = 7.5 Minuten werden die Charges auf **40 %** gedaempft. Man muss also dauerhaft promoten.

**Der Forecast bleibt unveraendert** — es ist ein reiner Amplitudenhebel. Fuer eine 4S-gestuetzte Strategie ist das trotzdem sehr stark: die Rendite pro Tick ist `(2f - 1) * ln(1 + av)` mit `av ∝ mv`, ein Volatilitaetsfaktor von 3 verdreifacht also naeherungsweise die Log-Rendite bei unveraendertem Vorzeichen. Aus 1.71x pro Stunde (mv 0.9, f 0.6) werden so ueber 5x pro Stunde.

**Das ist die interessanteste Wechselwirkung im ganzen Spiel:** 4S liefert die exakte Richtungswahrscheinlichkeit, DarkNet liefert die Amplitude.

### 8.7 Automatisierbarkeit

22 verschiedene Passwort-Minispiele (`src/DarkNet/Enums.ts:15-41`), alle per Skript loesbar. `ns.dnet.getServerDetails()` liefert `modelId`, `passwordHint`, `data`, `passwordLength` und `passwordFormat` (`src/NetscriptFunctions/Darknet.ts:396-411`), die Feedback-Logik steht in `src/DarkNet/effects/authentication.ts:19-150` (Mastermind, Hoeher/Tiefer, Roemische Zahlen, Teilbarkeit, Buffer Overflow, Gradient Ascent, RMSD, Packet Sniffer …).

**Packet Sniffing** (`src/DarkNet/models/packetSniffing.ts:16-24`): Bei jedem *fehlgeschlagenen* Auth-Versuch liefert der Server einen 124–144 Zeichen langen Rauschstring, in dem **das echte Passwort im Klartext steckt** — bei `difficulty <= 16` als `" hostname:password "` (exakter Anker!), darueber nur nackt in Zufallsziffern. Lesbar per `ns.dnet.heartbleed()`. Voll automatisierbar.

Wichtige API-Kosten (`src/Netscript/RamCostGenerator.ts:236-261`): `authenticate` 0.4 GB, `heartbleed` 0.6 GB, `openCache` 2 GB, `probe` 0.2 GB, `phishingAttack` 2 GB, `promoteStock` 2 GB, `induceServerMigration` 4 GB, `setStasisLink` **12 GB**.

**Dauer eines Auth-Versuchs** — `src/DarkNet/effects/effects.ts:60-90`:

```ts
const threadsFactor    = 1 / (linear ? threads : 1 + 0.2 * (threads - 1));
const skillFactor      = (5 * chaRequired + (difficulty + 1) * 100) / (cha + 150);
const backdoorFactor   = getBackdoorAuthTimeDebuff();
const underleveledFactor = (cha <= chaRequired && depth > 1) ? 1.5 + (chaRequired + 50)/(cha + 50) : 1;
const hasBootsFactor   = Player.hasAugmentation(AugmentationName.TheBoots) ? 0.8 : 1;
const hasSf15_2Factor  = Player.activeSourceFileLvl(15) > 2 ? 0.8 : 1;

const time = 850 * skillFactor * backdoorFactor * underleveledFactor * hasBootsFactor * hasSf15_2Factor * threadsFactor;
return time * calculateIntelligenceBonus(person.skills.intelligence, 0.25) + sharedCharsExtraTime;   // :89
```

**Achtung, Zeile 89:** In v3.0.1 wird die Zeit mit `calculateIntelligenceBonus(...)` **multipliziert**. Da dieser Wert immer ≥ 1 ist (`1 + 0.25 * int^0.8 / 600`, `src/PersonObjects/formulas/intelligence.ts:1-3`), macht **hohe Intelligenz die Darknet-Authentifizierung langsamer**. Bei Intelligenz 1000 sind das `1 + 0.25 * 251.2 / 600 = 1.105`, also 10.5 % Aufschlag. Im dev-Branch ist das zu einer Division korrigiert. Fuer v3.0.1 gilt: Intelligenz ist im DarkNet ein leichter Nachteil.

Charisma-XP pro Auth-Versuch — `src/DarkNet/effects/effects.ts:113-121`:

```ts
xpGain = (3 + 1.1 ** server.difficulty)
       * (server.hasAdminRights ? 0.2 : 1)
       * (success && !server.hasAdminRights ? 10 : 1)
       * (hasDarknetBonusTime() ? 1.5 : 1)
       * threads * Player.mults.charisma_exp;
```

Das ist die eigentliche Charisma-Quelle: der erste Erfolg auf einem Server gibt den vollen Wert x10, jeder weitere Versuch auf demselben Server nur noch 20 %. Bei Difficulty 20 sind das `(3 + 6.73) * 10 = 97.3` XP je Erstknacken und Thread.

**Zwei Fallen im Code:**

- `getBackdoorAuthTimeDebuff` (`src/DarkNet/effects/effects.ts:92-99`): `1.07^max(0, backdoors - max(adminServers/24, 2))` — **zu viele Backdoors verlangsamen jede Authentifizierung.**
- `getTimeoutChance` (`src/DarkNet/effects/offlineServerHandling.ts:151-154`): `clamp((backdoors - 2) * 0.03, 0, 0.5)` — bis zu **50 % Timeout-Chance** beim Auth aus demselben Grund.

Wer im DarkNet gewohnheitsmaessig ueberall Backdoors setzt, sabotiert sich also selbst.

### 8.8 Lohnt es sich?

**Fuer BN1 ohne Source-Files: ja, aber nicht als Geldquelle.**

Dafuer:

- **$30 Mio Einstieg** (Chongqing) gegen eine deterministische Kette von Gratis-Programmen im Wert von **>$11.5 Mrd**, darunter Formulas.exe und 4S Market Data. Das allein rechtfertigt den Kauf um mehr als zwei Groessenordnungen.
- **Sehr viel RAM.** `16 * 2^floor(difficulty/6)` bis 1 433 GB je Server bei ~`depth * 4.8` Servern.
- **Volatilitaetshebel bis x4** auf den Aktienmarkt — verdreifacht bis vervierfacht die stuendliche Rendite einer 4S-Strategie.
- Cache-Geld skaliert `1.2^difficulty` und erreicht in der Tiefe Milliardenbetraege pro Cache.

Dagegen:

- **Phishing als Dauereinkommen ist schwach** ($116/s je Thread bei Charisma 1000).
- **Kein `hack`/`grow`/`weaken`** auf Darknet-Servern; das RAM ist nur als Worker-Standort nutzbar, und jede Mutation killt die Skripte.
- **Hoher Automatisierungsaufwand**: 22 Minispiele, Mutation alle 1–10 Sekunden, Webstorms loeschen 60 % des Netzes.
- **Ohne SF15 kein Labyrinth**, also keine `dnet_money`-Augmentations und kein x1.99-Stack.
- Charisma ist der Engpass — und Charisma bringt in BN1 sonst fast nichts. Der Aufbau auf 2000+ Charisma ist reine Vorleistung fuer dieses eine System.

**Urteil:** DarkNet ist in BN1 primaer ein **Freischalt-System**, kein Geldsystem. Man kauft es fuer $30 Mio, holt die Programmkette (vor allem Formulas.exe und 4S Data) und den Volatilitaetshebel ab, und nutzt das RAM opportunistisch. Als laufende Einnahmequelle ist es dem Hacking klar unterlegen.

---

## 9. Praktische Folgerungen — Rangfolge der Geldsysteme

Zugrunde gelegt: **BitNode 1, keine Source-Files** (der Standardfall beim ersten Durchlauf). Abweichungen bei vorhandenen SF stehen jeweils dabei.

### Phase 1: Start bis ca. $1 Mio

| Rang | System | Begruendung aus den Zahlen |
|---|---|---|
| 1 | **Hacknet Nodes (5-8 Stueck, nur Level)** | Node 1 kostet $1 000 und zahlt sich in 11 Minuten zurueck. Level 1→2 kostet $500 fuer +1.5 $/s → 333 s Amortisation. Nichts sonst ist zu diesem Zeitpunkt derart schnell. |
| 2 | **Crime: shoplift / mug** | Bei Stats um 10-50: 1 800 bis 9 000 $/s. Trainiert gleichzeitig die Kampfstats. |
| 3 | Hacking auf schwachen Servern | Braucht erst Hacking-Level und Portknacker; laeuft parallel und kostet nichts. |

**Nicht kaufen:** Hacknet-RAM (159 h Amortisation) und Hacknet-Cores (556 h). Beide sind bei niedrigem Level reine Geldvernichtung.

### Phase 2: ca. $1 Mio bis $1 Mrd

| Rang | System | Begruendung |
|---|---|---|
| 1 | **Gekaufte Server + Hacking** | Linearer Preis von 55 000 $/GB ohne Progression, 25 Server bis je 2^20 GB. Jeder investierte Dollar wird direkt in Threads umgesetzt. Das ist das einzige System im Spiel, dessen Ertrag proportional zur Investition waechst. |
| 2 | **Heim-RAM bis ca. 64 GB** | Bis dahin kostet die Verdopplung unter $10M und man braucht die Kapazitaet fuer den Orchestrator. Ab 64→128 GB ist gekauftes RAM pro GB rund 9x guenstiger. |
| 3 | Crime: homicide | 15 000 $/s ab Stats 200, und gleichzeitig 1.0 karma/s fuer die Gang-Vorbereitung. Doppelnutzen. |
| 4 | Hacknet Nodes | **Ab hier nur noch Ballast.** Node 10 kostet $253 832 fuer +1.5 $/s = 47 h Amortisation. Nicht mehr anfassen. |

**Nicht kaufen:** Heim-Kerne. $7.5 Mrd fuer den ersten zusaetzlichen Kern, und `hack()` profitiert davon gar nicht.

### Phase 2b: Sonderfall DarkNet, ab ca. $30 Mio

Das DarkNet passt in kein Phasenschema, weil es fuer $30 Mio (Chongqing "Shadowed Walkway", `src/DarkNet/Constants.ts:6`) **ohne jedes Source-File** erreichbar ist und dort eine deterministische Kette von Gratis-Programmen liegt (`src/DarkNet/effects/cacheFiles.ts:130-171`):

```
… -> SQLInject ($250 Mio) -> Formulas.exe ($5 Mrd)
   -> WSE Account ($200 Mio) -> TIX API ($5 Mrd) -> 4S Market Data ($1 Mrd)
```

**Der Kauf amortisiert sich um mehr als den Faktor 380**, sobald man genug Caches oeffnet. Vor allem verkuerzt er den Weg zum Aktienmarkt drastisch: WSE, TIX API und 4S Data gratis sparen $6.2 Mrd und verschieben Phase 3 deutlich nach vorn.

Der Preis dafuer ist Automatisierungsaufwand (22 Passwort-Minispiele, Netzmutation alle 1-10 s) und Charisma-Aufbau. Wer nicht bereit ist, dafuer Skripte zu schreiben, laesst es besser ganz.

### Phase 3: ab ca. $1 Mrd

| Rang | System | Begruendung |
|---|---|---|
| 1 | **Stock Market mit 4S** | $26 Mrd fuer 4S Data + 4S TIX API (bzw. nur $25 Mrd, wenn 4S Data aus einem Darknet-Cache kam). `getForecast()` liefert **exakt** die interne Aufwaertswahrscheinlichkeit — kein Modellrisiko. Bei mv 0.9 und Forecast 0.6 sind das 1.71x pro Stunde auf das **gesamte** eingesetzte Kapital. Kein anderes System hat multiplikatives Wachstum. |
| 2 | **Stock Market + Darknet-Volatilitaet** | `getDarknetVolatilityMult` hebt `mv` bis auf **x4** (`src/DarkNet/effects/effects.ts:197-201`). Da die Log-Rendite naeherungsweise proportional zu `mv` ist, werden aus 1.71x/h ueber 5x/h — bei unveraendertem Vorzeichen, weil der Forecast unberuehrt bleibt. **Die staerkste Kombination im Spiel.** |
| 3 | Hacking mit vollem Serverpark | Der Grundstrom, der die Kriegskasse fuer den Aktienmarkt fuellt und ueber `hack()`/`grow()` den Forecast zusaetzlich steuert (`src/StockMarket/PlayerInfluencing.ts:24-61`). |
| 4 | Gang (nur mit SF2) | Laeuft passiv und offline, kostet kein RAM. In BN1 ist `GangSoftcap = 1`, der Bestwert. Braucht 15 h homicide Vorlauf. |
| 5 | Darknet-Caches | `1.2^difficulty * 1e7 * (200+cha)/200` — bei Difficulty 20 und Charisma 2000 sind das $4.2 Mrd pro Cache, aber nur in 1 von 4 Reward-Zweigen. Unregelmaessig, deshalb kein Fundament. |
| 6 | Crime / Bladeburner / Phishing | Bei maximal ~$66 667/s, ~$16 000/s bzw. ~$10 164/s je Thread hart gedeckelt. Fuer Geld irrelevant. |

### Die zentrale Begruendung in einem Satz je System

- **Hacknet Nodes:** Kostenbasis waechst mit `1.85^n` und `1.04^L`, Ertrag pro Node ist bei 9 171 $/s hart gedeckelt → **exponentiell steigende Kosten gegen konstanten Ertrag. Stirbt nach etwa 7 Nodes.**
- **Gekaufte Server:** Preis **linear** in RAM (`ram * 55_000`, `CloudServerSoftcap = 1` in BN1), Ertrag linear in Threads → **konstantes Preis-Leistungs-Verhaeltnis ueber sechs Groessenordnungen.** Das beste Investitionsziel im Mittelspiel.
- **Aktienmarkt:** Ertrag **multiplikativ** auf das eingesetzte Kapital, ohne Preis-Slippage bei grossen Positionen (`getBuyTransactionCost` ist streng linear in `shares`, `src/StockMarket/StockMarketHelpers.ts:28`) → **das einzige System mit echtem Zinseszins.** Deshalb im Spaetspiel unschlagbar, im Fruehspiel wegen $200M Einstieg und $200k Commission je Roundtrip unbrauchbar.
- **Crime:** feste Dauern, feste Betraege, Erfolgschance bei 1 gedeckelt → **harter Deckel bei $66 667/s.** Wert liegt im Karma (homicide, 1.0/s) und im Stat-Training, nicht im Geld.
- **Gang:** passiv, offline-faehig, kein RAM-Verbrauch, aber 15 h Karma-Vorlauf und SF2 noetig → **Zusatzeinkommen ohne Opportunitaetskosten**, kein Ersatz fuer Hacking.
- **Sleeves:** Geld wird **nicht** von Shock gemindert (`scaleMoney = false`, `src/Work/WorkStats.ts:49-62`) → **ab Sekunde 1 voller Ertrag**, aber nur mit SF10 vorhanden und in BN1 nicht aufwertbar.
- **Corporation:** $150 Mrd Einstieg plus SF3 Level 3 fuer die Skript-API → **fuer BN1 praktisch unerreichbar.**
- **Bladeburner:** ~$16 000/s und durch Contract-`count` zusaetzlich gedeckelt → **kein Geldsystem, sondern ein alternativer BitNode-Ausstieg.**
- **DarkNet:** Cache-Geld ist `1.2^difficulty`-exponentiell, aber nur einer von vier Zufallszweigen; Phishing ist schwach → **kein Geldsystem, sondern ein Freischalt-System.** Der Wert liegt in der Programmkette (Formulas.exe, WSE, TIX, 4S Data) und im Volatilitaetshebel auf den Aktienmarkt.

### Konkrete Kaufreihenfolge fuer BN1 ohne Source-Files

1. 5-8 Hacknet Nodes, jeweils Level hochziehen, RAM und Cores ignorieren. Stopp, sobald der naechste Node ueber $50 000 kostet.
2. TOR Router ($200 000, `src/Constants.ts:44`) und die Portknacker-Programme.
3. Heim-RAM verdoppeln bis 64 GB.
4. Ab jetzt jeder freie Dollar in gekaufte Server. Startgroesse so waehlen, dass 25 Stueck bezahlbar sind; spaeter per `getCloudServerUpgradeCost` hochruesten (Differenzpreis, kein Verlust).
5. Bei ~$30 Mio: DarkscapeNavigator in Chongqing, **wenn** man bereit ist, die Passwort-Minispiele zu automatisieren. Die Programmkette liefert SQLInject, Formulas.exe, WSE, TIX API und 4S Data gratis und ueberspringt damit Schritt 6 fast vollstaendig.
6. Andernfalls: bei ~$200 Mio WSE Account, bei ~$5 Mrd TIX API, bei ~$26 Mrd freiem Kapital 4S Data + 4S TIX API.
7. Parallel dauerhaft homicide laufen lassen, falls SF2 vorhanden ist und eine Gang das Ziel ist. Darknet-Caches senken das Karma nebenbei um `difficulty + 1` je Cache.

---

## Abweichungen dev vs v3.0.1

Der urspruenglich genannte Ordner `reference\bitburner-src` ist der dev-Branch (`VersionString: "3.0.2"`, `isDevBranch: true`). Ich habe alle in diesem Dokument verwendeten Dateien byte-verglichen. Ergebnis:

**Byte-identisch** (Zahlen und Zeilennummern gelten in beiden Staenden): `Server/data/Constants.ts`, `PersonObjects/Player/PlayerObjectServerMethods.ts`, alle `Hacknet/`-Dateien, `StockMarket/data/Constants.ts`, `StockMarket/Stock.ts`, `StockMarket/StockMarketHelpers.ts`, `StockMarket/StockMarketCosts.ts`, `StockMarket/data/InitStockMetadata.ts`, `StockMarket/PlayerInfluencing.ts`, `Crime/Crime.ts`, `Crime/CrimeHelpers.ts`, `Work/CrimeWork.ts`, `Hacking.ts`, `PersonObjects/formulas/intelligence.ts`, `PersonObjects/Sleeve/Sleeve.ts`, `PersonObjects/Sleeve/SleeveCovenantPurchases.tsx`, saemtliche `Gang/`-Dateien ausser `data/tasks.ts`, `Corporation/data/IndustryData.ts`, `Corporation/data/Constants.ts`, `Bladeburner/data/Constants.ts`, `Bladeburner/data/Contracts.ts`, `Bladeburner/Actions/Action.ts`.

**Abweichend, aber ohne Zahlen- oder Strategieauswirkung:**

| Datei | Art der Abweichung |
|---|---|
| `Constants.ts` | nur `VersionString`, `isDevBranch`, Changelog-Text. `MilliPerCycle: 200` unveraendert auf `:19`. |
| `Crime/Crimes.ts` | **Ein einziger Zeichenunterschied** in einem Tooltip (`"high-profile target"` vs `"high-profile-target"`, `:189`). **Alle Dauern, Geldbetraege, Difficulties, Karma-Werte und Gewichte sind identisch.** |
| `Server/ServerPurchases.ts` | dev fuegt 4 Zeilen fuer `workerScripts`-Hostname-Update beim Umbenennen hinzu. Preisformel identisch, Zeilennummern in v3.0.1 = dev + 1 ab `:23`. |
| `StockMarket/StockMarket.ts` | dev loescht zusaetzlich `SymbolToStockMap` beim Reset (4 Zeilen). Tick-Logik identisch, v3.0.1-Zeilennummern = dev − 4 ab `:181`. |
| `NetscriptFunctions/StockMarket.ts` | v3.0.1 nutzt curried Signaturen `(ctx) => (args) => {}`, dev `(ctx, args) => {}`; dev fasst die SF8-Checks in einen Helper. Funktional identisch. |
| `Work/Formulas.ts` | nur eine Variablenumbenennung (`classs` → `classInfo`). |
| `BitNode/BitNode.tsx` | dev extrahiert einen `upgradeTextForBN()`-Helper (Prosa). **Alle BitNode-Multiplikatoren identisch**, Zeilennummern um ~6 verschoben. |
| `Gang/data/tasks.ts` | dev nutzt `GangTaskNameEnum.X`, v3.0.1 String-Literale; dev hat 2 zusaetzliche Import-Zeilen. **Alle `baseRespect`/`baseWanted`/`baseMoney`/`difficulty`/Gewichte/`territory`-Werte identisch.** |
| `Gang/Enums.ts` | **Existiert in v3.0.1 nicht.** Task-Namen sind String-Literale aus `tasks.ts`, Lookup ueber `src/Gang/GangMemberTasks.ts:4-9`. Fuer Skripte: `ns.gang.setMemberTask()` nimmt in v3.0.1 einen plain `string` (`src/ScriptEditor/NetscriptDefinitions.d.ts:4967`). |
| `PersonObjects/Sleeve/ui/TaskSelector.tsx` | dev blendet "Take on contracts" aus, wenn keine Contracts verfuegbar sind. Reine UI. |
| `Faction/FactionInfo.tsx` | zwei Satzzeichen und ein umformulierter Bladeburner-Hinweistext. Die Covenant-`inviteReqs` (`:167`) sind identisch. |
| `Corporation/helpers.ts`, `Corporation/Actions.ts` | dev ersetzt `eval()` durch einen Ausdrucksparser (Sicherheitsfix) und verschiebt `costOfCreatingCorporation` um ~34 Zeilen nach unten. Betraege identisch. |
| `Bladeburner/data/BlackOperations.ts` | dev ersetzt Real-Ortsnamen durch Spiel-Enums. Alle `reqdRank`/`baseDifficulty`/`rankGain` identisch. |
| `Locations/ui/SpecialLocation.tsx` | dev ergaenzt erklaerende Hinweistexte bei gesperrten Systemen. Die 100er-Kampfstat-Pruefung ist funktional identisch. |
| `DarkNet/effects/cacheFiles.ts` | dev aendert den Rueckgabetyp von `string` auf ein strukturiertes `CacheReward`-Objekt (damit `ns.dnet.openCache` maschinenlesbar wird) und faellt bei leerem CCT-Ergebnis auf `getMoneyReward` zurueck. **Die Geldformel `1.2^difficulty * 1e7 * (200+cha)/200 * …` und die Reihenfolge der Programmkette sind identisch.** |
| `DarkNet/effects/ramblock.ts` | dev rundet einen RAM-Block-Startwert auf zwei Nachkommastellen. |
| `DarkNet/utils/darknetNetworkUtils.ts` | dev filtert Server ohne RAM aus den Nachbarlisten und schliesst stasis-verlinkte Server vom Backdoor-Zaehler aus. |

**Zwei echte Zahlenunterschiede im DarkNet** — hier ist der dev-Branch NICHT deckungsgleich:

| Stelle | v3.0.1 | dev (3.0.2) | Auswirkung |
|---|---|---|---|
| `DarkNet/effects/effects.ts:89` (Auth-Dauer) | `time * calculateIntelligenceBonus(int, 0.25)` | `time * (1 / calculateIntelligenceBonus(int, 0.25))` | **In v3.0.1 macht Intelligenz die Authentifizierung langsamer** (bei Int 1000 um 10.5 %); im dev-Branch ist es zur erwarteten Beschleunigung korrigiert. Wer nach dev-Wissen plant, schaetzt die Auth-Dauer in v3.0.1 zu niedrig. |
| `DarkNet/effects/effects.ts:114-115` (Charisma-XP) | `baseXpGain = 3`, `difficultyBase = 1.1` | `baseXpGain = 2.5`, `difficultyBase = 1.07` | **v3.0.1 gibt deutlich mehr Charisma-XP.** Bei Difficulty 20: `3 + 1.1^20 = 9.73` gegen `2.5 + 1.07^20 = 6.37`, also **+53 %**. Der Charisma-Aufbau im DarkNet geht in v3.0.1 spuerbar schneller als im dev-Branch. |

**Fazit: Ausserhalb des DarkNets ist der dev-Branch numerisch deckungsgleich mit v3.0.1.** Fuer Server, Hacknet, Aktienmarkt, Crime, Sleeves, Gang, Corporation und Bladeburner stimmt jede Zahl in beiden Staenden ueberein. Im DarkNet gibt es die beiden oben genannten echten Abweichungen. Der einzige weitere praktische Unterschied fuer Skripte ist der fehlende `GangTaskName`-Union-Typ in v3.0.1 (nur TS-Autocomplete, zur Laufzeit identisch).

---

## Ausdruecklich gekennzeichnete Luecken

1. **Short-Positionen ueber die UI in BN1:** `shortStock`/`sellShort` existieren in `src/StockMarket/BuyingAndSelling.tsx:215` bzw. `:316`. Die NS-API sperrt sie ohne SF8 Level 2 (`src/NetscriptFunctions/StockMarket.ts:151-153`). Ob die **UI** sie in BN1 ohne SF8 anbietet, habe ich nicht bis in die Render-Bedingung verfolgt.
2. **Limit-/Stop-Order-Verarbeitung** (`src/StockMarket/OrderProcessing.tsx`) habe ich nicht im Detail gelesen — in BN1 ohne SF8 Level 3 ohnehin nicht per Skript nutzbar.
3. **DarkNet-Detailbereiche nicht gelesen:** die Einzelkonfiguration der 22 Minispiele (`src/DarkNet/controllers/ServerGenerator.ts:90-563`), die Detaillogik von `moveDarknetServer`/`restartServer` (`src/DarkNet/controllers/NetworkMovement.ts:235-398`) und die gesamte `src/DarkNet/ui/`-Ebene. Fuer die Wirtschaftsformeln nicht noetig, fuer einen Loeser der Minispiele schon.
4. **Corporation-Einnahmenseite** (Produktionsformeln, Materialpreise, Investorenrunden, Bewertung) ist nicht erfasst — auftragsgemaess nur grob behandelt.
5. **Bladeburner-Erfolgswahrscheinlichkeiten** (`getSuccessChance` mit Population, Chaos, Teamgroesse) und die Startwerte von `count` sind nicht aufgeschluesselt. Die $250k gelten pro **erfolgreichem** Contract; der reale Stundenertrag ist damit allein nicht berechenbar.
6. **Alle Amortisations- und Stundenwerte in diesem Dokument sind aus den zitierten Formeln gerechnet**, nicht als Konstanten im Code hinterlegt. Sie setzen durchgaengig BN1, keine Augmentation-Multiplikatoren, Intelligenz 0 und Echtzeit ohne Bonus-Time voraus.
7. **Aktienmarkt-Renditetabellen** setzen einen ueber die Stunde konstanten Forecast voraus. Real wandert `otlkMag` (`cycleForecast`) und kippt alle 75 Ticks mit 45 % Wahrscheinlichkeit die Richtung. Die Tabellen sind Obergrenzen fuer eine ideal getimte Position, keine Erwartungswerte einer Buy-and-Hold-Strategie.
