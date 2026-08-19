# Bitburner: Formeln des Hacking-Kernsystems

**Quelle: Release v3.0.1** unter
`C:\Users\erche\Desktop\claude_projecto\bitburner\reference\v301`

Bestaetigt durch `src/Constants.ts:7-8`: `VersionString: "3.0.1"`, `isDevBranch: false`,
`VersionNumber: 51`.

**Alle Zeilenangaben in diesem Dokument beziehen sich auf `reference\v301`, nicht auf den
dev-Branch.** Ein Abschnitt am Ende listet die gefundenen Unterschiede zwischen dev (3.0.2)
und v3.0.1 auf.

Alle Formeln sind aus dem Code abgeschrieben, nicht rekonstruiert. Wo etwas nicht auffindbar
war, steht das ausdruecklich dabei.

**Notationskonvention in diesem Dokument**

| Symbol | Bedeutung | Code-Feld |
|---|---|---|
| `sec` | aktuelle Server-Security | `server.hackDifficulty` |
| `secMin` | minimale Security | `server.minDifficulty` |
| `secBase` | Start-Security | `server.baseDifficulty` |
| `reqSkill` | benoetigtes Hacking-Level | `server.requiredHackingSkill` |
| `skill` | Hacking-Level des Spielers | `person.skills.hacking` |
| `int` | Intelligence des Spielers | `person.skills.intelligence` |
| `g` | Wachstumsparameter | `server.serverGrowth` |
| `cores` | CPU-Kerne des **ausfuehrenden** Hosts | `scripthost.cpuCores` |

---

## 0. Gemeinsame Hilfsformeln

### Intelligence-Bonus

```ts
export function calculateIntelligenceBonus(intelligence: number, weight = 1): number {
  return 1 + (weight * Math.pow(intelligence, 0.8)) / 600;
}
```

`intBonus(int, w) = 1 + w * int^0.8 / 600`

Im gesamten Hacking-System wird immer mit `weight = 1` aufgerufen.

Quelle: `src/PersonObjects/formulas/intelligence.ts:1`

### Core-Bonus

```ts
export function getCoreBonus(cores = 1): number {
  const coreBonus = 1 + (cores - 1) / 16;
  return coreBonus;
}
```

`coreBonus(cores) = 1 + (cores - 1) / 16`

Wirkt **nur** auf `grow()` und `weaken()`, nicht auf `hack()`.

Quelle: `src/Server/ServerHelpers.ts:287`

### Skill aus Erfahrung

```ts
export function calculateSkill(exp: number, mult = 1): number {
  if (mult === 0) return 1;
  const value = Math.floor(mult * (32 * Math.log(exp + 534.6) - 200));
  return clampNumber(value, 1);
}
```

`skill = floor( mult * (32 * ln(exp + 534.6) - 200) )`, mindestens 1

Umkehrung: `exp = e^((skill/mult + 200)/32) - 534.6` (mit Nachkorrektur gegen
Rundungsfehler).

Beim Hacking-Skill ist `mult = person.mults.hacking * currentNodeMults.HackingLevelMultiplier`.

Quellen: `src/PersonObjects/formulas/skill.ts:7`, `src/PersonObjects/formulas/skill.ts:17`,
`src/PersonObjects/Person.ts:60`

### clampNumber

`clampNumber(v, min, max) = max(min(v, max), min)`.

In v3.0.1 ist `isDevBranch = false`, deshalb liefert `clampNumber(NaN, ...)` still `min`
zurueck, statt eine Exception zu werfen (`src/utils/helpers/clampNumber.ts:10-13`).

Quelle: `src/utils/helpers/clampNumber.ts:9`

---

## 1. hack()

### 1.1 Erfolgschance (hackChance)

```ts
export function calculateHackingChance(server: IServer, person: IPerson): number {
  const hackDifficulty = server.hackDifficulty ?? 100;
  const requiredHackingSkill = server.requiredHackingSkill ?? 1e9;
  // Unrooted or unhackable server
  if (!server.hasAdminRights || hackDifficulty >= 100) return 0;
  const hackFactor = 1.75;
  const difficultyMult = (100 - hackDifficulty) / 100;
  const skillMult = clampNumber(hackFactor * person.skills.hacking, 1);
  const skillChance = (skillMult - requiredHackingSkill) / skillMult;
  const chance =
    skillChance * difficultyMult * person.mults.hacking_chance *
    calculateIntelligenceBonus(person.skills.intelligence, 1);
  return clampNumber(chance, 0, 1);
}
```

Mathematisch:

```
skillMult      = max(1.75 * skill, 1)
skillChance    = (skillMult - reqSkill) / skillMult
difficultyMult = (100 - sec) / 100

chance = clamp( skillChance * difficultyMult
                * mults.hacking_chance
                * (1 + int^0.8 / 600),
                0, 1 )
```

Sonderfaelle im Code:
- **kein Root-Zugriff (`!hasAdminRights`) => chance = 0** (das ist die "unrooted"-Sperre)
- `sec >= 100` => chance = 0

Konstante: `hackFactor = 1.75` (`src/Hacking.ts:14`).

Quelle: `src/Hacking.ts:9`

### 1.2 Gestohlener Geldanteil (percentMoneyHacked)

```ts
export function calculatePercentMoneyHacked(server: IServer, person: IPerson): number {
  const hackDifficulty = server.hackDifficulty ?? 100;
  if (hackDifficulty >= 100) return 0;
  const requiredHackingSkill = server.requiredHackingSkill ?? 1e9;
  const balanceFactor = 240;

  const difficultyMult = (100 - hackDifficulty) / 100;
  const skillMult = (person.skills.hacking - (requiredHackingSkill - 1)) / person.skills.hacking;
  const percentMoneyHacked =
    (difficultyMult * skillMult * person.mults.hacking_money * currentNodeMults.ScriptHackMoney) / balanceFactor;

  return Math.min(1, Math.max(percentMoneyHacked, 0));
}
```

Mathematisch:

```
difficultyMult = (100 - sec) / 100
skillMult      = (skill - (reqSkill - 1)) / skill

p = clamp( difficultyMult * skillMult * mults.hacking_money * BN.ScriptHackMoney / 240 , 0, 1 )
```

`balanceFactor = 240` (`src/Hacking.ts:49`). **Kein Intelligence-Bonus hier.**
Anders als bei `hackChance` wird `hasAdminRights` hier *nicht* geprueft.

Wichtig: `p` ist der Anteil **pro Thread**. Der tatsaechlich gezogene Betrag ist linear in
den Threads (siehe 1.5), nicht kompoundierend.

Quelle: `src/Hacking.ts:44`

### 1.3 Hacking-Zeit

```ts
export function calculateHackingTime(server: IServer, person: IPerson): number {
  if (server instanceof DarknetServer) return 16;
  const { hackDifficulty, requiredHackingSkill } = server;
  if (typeof hackDifficulty !== "number" || typeof requiredHackingSkill !== "number") return Infinity;
  const difficultyMult = requiredHackingSkill * hackDifficulty;

  const baseDiff = 500;
  const baseSkill = 50;
  const diffFactor = 2.5;
  let skillFactor = diffFactor * difficultyMult + baseDiff;
  skillFactor /= person.skills.hacking + baseSkill;

  const hackTimeMultiplier = 5;
  const hackingTime =
    (hackTimeMultiplier * skillFactor) /
    (person.mults.hacking_speed *
      currentNodeMults.HackingSpeedMultiplier *
      calculateIntelligenceBonus(person.skills.intelligence, 1));

  return hackingTime;
}
```

Mathematisch (Ergebnis in **Sekunden**):

```
skillFactor = (2.5 * reqSkill * sec + 500) / (skill + 50)

t_hack = 5 * skillFactor
         / ( mults.hacking_speed * BN.HackingSpeedMultiplier * (1 + int^0.8 / 600) )
```

Konstanten: `baseDiff = 500`, `baseSkill = 50`, `diffFactor = 2.5`, `hackTimeMultiplier = 5`
(`src/Hacking.ts:66-72`).

Sonderfall: fuer `DarknetServer` (3.0-Mechanik) ist die Hackzeit fest **16 Sekunden**
(`src/Hacking.ts:61`).

Quelle: `src/Hacking.ts:60`

### 1.4 XP-Gewinn

```ts
export function calculateHackingExpGain(server: IServer, person: IPerson): number {
  const baseDifficulty = server.baseDifficulty;
  if (!baseDifficulty) return 0;
  const baseExpGain = 3;
  const diffFactor = 0.3;
  let expGain = baseExpGain;
  expGain += baseDifficulty * diffFactor;
  return expGain * person.mults.hacking_exp * currentNodeMults.HackExpGain;
}
```

Mathematisch, XP **pro Thread**:

```
xp_pro_thread = (3 + 0.3 * secBase) * mults.hacking_exp * BN.HackExpGain
```

Wichtig: Es zaehlt `baseDifficulty` (Start-Security des Servers), **nicht** die aktuelle
Security. XP haengen also nicht davon ab, ob der Server geweakent ist.

Verwendung:
- `hack()` Erfolg: `xp_pro_thread * threads` (`src/Netscript/NetscriptHelpers.tsx:564`)
- `hack()` Misserfolg: **ein Viertel** davon (`src/Netscript/NetscriptHelpers.tsx:565`)
- `grow()`: `xp_pro_thread * threads` (`src/NetscriptFunctions.ts:295`)
- `weaken()`: `xp_pro_thread * threads` (`src/NetscriptFunctions.ts:373`)

Also: grow und weaken geben **dieselbe** XP pro Thread wie ein erfolgreicher hack.

Quelle: `src/Hacking.ts:30`

### 1.5 Ablauf und Auszahlung von ns.hack()

Kern der Implementierung (gekuerzt):

```ts
return helpers.netscriptDelay(ctx, hackingTime * 1000).then(function () {
  const hackChance = calculateHackingChance(server, Player);
  const rand = Math.random();
  let expGainedOnSuccess = calculateHackingExpGain(server, Player) * threads;
  const expGainedOnFailure = expGainedOnSuccess / 4;
  if (rand < hackChance) {
    const percentHacked = calculatePercentMoneyHacked(server, Player);
    let maxThreadNeeded = Math.ceil(1 / percentHacked);
    if (isNaN(maxThreadNeeded)) maxThreadNeeded = 1e6;

    let moneyDrained = server.moneyAvailable * percentHacked * threads;
    if (moneyDrained < 0) moneyDrained = 0;
    if (moneyDrained > server.moneyAvailable) moneyDrained = server.moneyAvailable;
    if (moneyDrained === 0) expGainedOnSuccess = expGainedOnFailure;

    server.moneyAvailable -= moneyDrained;
    if (server.moneyAvailable < 0) server.moneyAvailable = 0;

    let moneyGained = moneyDrained * currentNodeMults.ScriptHackMoneyGain;
    if (manual) moneyGained = moneyDrained * currentNodeMults.ManualHackMoney;
    ...
    server.fortify(ServerConstants.ServerFortifyAmount * Math.min(threads, maxThreadNeeded));
    ...
    return moneyGained;
  } else {
    Player.gainHackingExp(expGainedOnFailure);
    return 0;
  }
});
```

Merkposten:
- Chance, Anteil und Security-Zuwachs werden **erst beim Landen** berechnet, nicht beim Start.
  Die Laufzeit dagegen wird **beim Start** festgelegt
  (`src/Netscript/NetscriptHelpers.tsx:544` vs. `:562`, `:568`).
- `moneyDrained = moneyAvailable * p * threads`, gedeckelt auf `moneyAvailable`
  (`src/Netscript/NetscriptHelpers.tsx:575-583`).
  Der Anteil ist also **additiv** ueber Threads, nicht multiplikativ. `threads = ceil(1/p)`
  leert den Server komplett.
- `ns.hack()` liefert `moneyGained` zurueck, bei Fehlschlag `0`.
- Der Security-Zuwachs ist auf `maxThreadNeeded = ceil(1/p)` Threads gedeckelt --
  Ueberhacken kostet also kein zusaetzliches Security, aber die Threads sind verschwendet.
- Es gibt zwei separate BitNode-Multiplikatoren: `ScriptHackMoney` (wieviel dem Server
  entzogen wird, in `calculatePercentMoneyHacked`) und `ScriptHackMoneyGain` (wieviel davon
  beim Spieler ankommt). Beide sind im Standard-BitNode `1`.
- Manuelles Hacken im Terminal nutzt `ManualHackMoney` statt `ScriptHackMoneyGain`, gibt
  `0.005` Intelligence-XP und setzt `backdoorInstalled = true`
  (`src/Netscript/NetscriptHelpers.tsx:596`, `:604`, `:618`).

Quelle: `src/Netscript/NetscriptHelpers.tsx:537` bis `:638`;
NS-Einsprung `src/NetscriptFunctions.ts:196`

Vorbedingung fuer `ns.hack`: nicht eigener Server, `hasAdminRights`, und
`requiredHackingSkill <= skill` (`src/Hacking/netscriptCanHack.ts:32`).

---

## 2. grow()

### 2.1 Wachstumsformel (Logarithmus-Form)

```ts
export function calculateServerGrowthLog(server: IServer, threads: number, p: IPerson, cores = 1): number {
  if (!server.serverGrowth) return -Infinity;
  const hackDifficulty = server.hackDifficulty ?? 100;
  const numServerGrowthCycles = Math.max(threads, 0);

  let adjGrowthLog = Math.log1p(ServerConstants.ServerBaseGrowthIncr / hackDifficulty);
  if (adjGrowthLog >= ServerConstants.ServerMaxGrowthLog) {
    adjGrowthLog = ServerConstants.ServerMaxGrowthLog;
  }

  const serverGrowthPercentage = server.serverGrowth / 100;
  const serverGrowthPercentageAdjusted = serverGrowthPercentage * currentNodeMults.ServerGrowthRate;

  const coreBonus = getCoreBonus(cores);
  return adjGrowthLog * serverGrowthPercentageAdjusted * p.mults.hacking_grow * coreBonus * numServerGrowthCycles;
}

export function calculateServerGrowth(server, threads, p, cores = 1): number {
  if (!server.serverGrowth) return 0;
  return Math.exp(calculateServerGrowthLog(server, threads, p, cores));
}
```

Mathematisch:

```
adjGrowthLog = min( ln(1 + 0.03 / sec) , 0.00349388925425578 )

k = adjGrowthLog * (g/100) * BN.ServerGrowthRate * mults.hacking_grow * coreBonus
    (das ist calculateServerGrowthLog fuer threads = 1)

growthMultiplier(threads) = exp( k * threads )
```

Der Multiplikator ist also **rein exponentiell in den Threads**: `growth(n) = growth(1)^n`.

**Security-Deckel beim Wachstum:** `ServerMaxGrowthLog = log1p(0.0035)`. Der Deckel greift,
sobald `0.03 / sec >= 0.0035`, also bei `sec <= 8.571428...`. Unterhalb dieser Security
bringt weiteres Weakenen fuer `grow()` **nichts mehr**. (Fuer `hack()` und die Laufzeiten
bringt es weiterhin etwas.)

Verifiziert durch den Test `test/jest/Grow.test.ts:6` (in v3.0.1 und dev identisch):
mit `hackDifficulty = 5, serverGrowth = 100` ist `calculateServerGrowth(server, 1) === 1.0035`
und `(…, 2) === 1.00701225`; mit `hackDifficulty = 10` ist `(…, 1) === 1.003`,
`(…, 2) === 1.006009`, `(…, 3) === 1.009027027`, `(…, 4) === 1.012054108081`.

Quellen: `src/Server/formulas/grow.ts:8`, `src/Server/formulas/grow.ts:31`,
`src/Server/data/Constants.ts:7-8`

### 2.2 Der additive Anteil: calculateGrowMoney

Es gibt **beides**, additiv und multiplikativ:

```ts
export function calculateGrowMoney(server: IServer, threads: number, p: IPerson, cores = 1): number {
  let serverGrowth = calculateServerGrowth(server, threads, p, cores);
  if (serverGrowth < 1) { console.warn(...); serverGrowth = 1; }

  let moneyAvailable = server.moneyAvailable ?? Number.NaN;
  moneyAvailable += threads;          // It can be grown even if it has no money
  moneyAvailable *= serverGrowth;

  if (server.moneyMax !== undefined && isValidNumber(server.moneyMax) &&
      (moneyAvailable > server.moneyMax || isNaN(moneyAvailable))) {
    moneyAvailable = server.moneyMax;
  }
  return moneyAvailable;
}
```

Mathematisch:

```
moneyNeu = min( (moneyAlt + threads) * exp(k * threads) , moneyMax )
```

Der additive Term ist **genau $1 pro Thread**, und er wird **vor** der Multiplikation
addiert. Deshalb kann ein Server mit $0 ueberhaupt wachsen.

Quelle: `src/Server/formulas/grow.ts:38`, additive Zeile `src/Server/formulas/grow.ts:46`

### 2.3 Threads fuer ein Ziel-Geld (growThreads)

`numCycleForGrowthCorrected(server, targetMoney, startMoney, cores, person)` loest die
Gleichung `n = (o + x) * exp(k*x)` nach `x` (Threads) auf. Da `x` sowohl im Exponenten als
auch ausserhalb steht, gibt es keine geschlossene Loesung; der Code nutzt **Newton-Raphson in
Log-Form**:

```
f(x)  = log((o + x)/n) + k*x           (Nullstelle gesucht)
f'(x) = 1/(o + x) + k

Update:  x_neu = (x - (o+x) * log((o+x)/n)) / (1 + (o+x) * k)

Startwert: x_0 = (n - o) / (1 + (n/16 + 15*o/16) * k)
```

Iteriert wird, bis `|diff| <= 1`; danach wird auf die naechste ganze Zahl aufgerundet und
mit bis zu zwei Korrekturpruefungen exakt gemacht. Ergebnis ist **immer eine ganze Zahl**.

Schutzklauseln: `startMoney < 0 => 0`, `targetMoney > moneyMax => moneyMax`,
`targetMoney <= startMoney => 0`.

Quelle: `src/Server/ServerHelpers.ts:90` (ausfuehrliche Herleitung als Kommentar im Code)

### 2.4 numCycleForGrowth (nur fuer ns.growthAnalyze)

```ts
export function numCycleForGrowth(server: IServer, growth: number, cores = 1): number {
  if (!server.serverGrowth) return Infinity;
  return Math.log(growth) / calculateServerGrowthLog(server, 1, Player, cores);
}
```

`threads = ln(gewuenschterMultiplikator) / k`

**Ignoriert den additiven $1/Thread-Term** und rundet nicht. Der Kommentar im Code sagt das
ausdruecklich: "Does not account for the additive $1/thread. Only used for growthAnalyze."
(`src/Server/ServerHelpers.ts:69`). Fuer exaktes Batching ist
`formulas.hacking.growThreads` (= `numCycleForGrowthCorrected`) die richtige Funktion.

Quelle: `src/Server/ServerHelpers.ts:75`

### 2.5 Anwendung im Spiel: processSingleServerGrowth

```ts
export function processSingleServerGrowth(server: Server, threads: number, cores = 1): number {
  const oldMoneyAvailable = server.moneyAvailable;
  server.moneyAvailable = calculateGrowMoney(server, threads, Player, cores);

  if (oldMoneyAvailable !== server.moneyAvailable) {
    let usedCycles = numCycleForGrowthCorrected(server, server.moneyAvailable, oldMoneyAvailable, cores);
    // Growing increases server security twice as much as hacking
    usedCycles = Math.min(Math.max(0, Math.ceil(usedCycles)), threads);
    server.fortify(2 * ServerConstants.ServerFortifyAmount * usedCycles);
  }
  if (server.moneyAvailable === 0 && oldMoneyAvailable === 0) return 1;
  if (oldMoneyAvailable === 0) return server.moneyAvailable;
  return server.moneyAvailable / oldMoneyAvailable;
}
```

Merkposten:
- Der Security-Zuwachs zaehlt nur die **tatsaechlich benoetigten** Threads. Wer mit 1000
  Threads growt, obwohl 200 gereicht haetten, bekommt nur den Security-Zuwachs fuer 200.
  Das ist die grow-Entsprechung zum `maxThreadNeeded`-Deckel beim hacken.
- Wenn der Server schon auf `moneyMax` steht, aendert sich nichts => **kein** Security-Zuwachs.
- `ns.grow()` gibt den Faktor `moneyNachher / moneyVorher` zurueck, bzw. `0` wenn
  `server.moneyMax === 0` (`src/NetscriptFunctions.ts:308`).

Quelle: `src/Server/ServerHelpers.ts:202`, Fortify-Zeile `src/Server/ServerHelpers.ts:211`

### 2.6 Wachstumszeit

```ts
export function calculateGrowTime(server: IServer, person: IPerson): number {
  const growTimeMultiplier = 3.2; // Relative to hacking time. 16/5 = 3.2
  return growTimeMultiplier * calculateHackingTime(server, person);
}
```

`t_grow = 3.2 * t_hack`

Quelle: `src/Hacking.ts:83`

### 2.7 Frage "unrooted growth"

Im Code von v3.0.1 ist Wachstum **ohne Root nicht moeglich**:

```ts
export function netscriptCanGrow(server: Server): IReturnStatus {
  return baseCheck(server, "grow");
}
```

und `baseCheck` verlangt `server.hasAdminRights` (und dass der Server nicht dem Spieler
gehoert). Ein Hacking-Level-Check findet bei grow und weaken **nicht** statt -- nur `hack()`
prueft `requiredHackingSkill <= skill`.

Quelle: `src/Hacking/netscriptCanHack.ts:12`, `:49`, `:53`

Die einzige Stelle, an der "unrooted" in den Hacking-Formeln auftaucht, ist der frueh
zurueckkehrende Zweig in `calculateHackingChance` (`src/Hacking.ts:12-13`,
Kommentar "Unrooted or unhackable server").

---

## 3. weaken()

### 3.1 Wirkung pro Thread

```ts
export function getWeakenEffect(threads: number, cores: number): number {
  const coreBonus = getCoreBonus(cores);
  return ServerConstants.ServerWeakenAmount * threads * coreBonus * currentNodeMults.ServerWeakenRate;
}
```

```
weakenEffect = 0.05 * threads * (1 + (cores - 1)/16) * BN.ServerWeakenRate
```

Also **0.05 Security pro Thread** bei 1 Kern im Standard-BitNode.

Quelle: `src/Server/ServerHelpers.ts:292`, Konstante `src/Server/data/Constants.ts:10`

### 3.2 Anwendung

```ts
const weakenAmt = getWeakenEffect(threads, scripthost.cpuCores);
const securityBeforeWeaken = server.hackDifficulty;
server.weaken(weakenAmt);
const securityAfterWeaken = server.hackDifficulty;
const securityReduction = securityBeforeWeaken - securityAfterWeaken;
...
return Promise.resolve(securityReduction);
```

`ns.weaken()` gibt die **tatsaechlich** erreichte Security-Senkung zurueck, also gedeckelt
durch `minDifficulty`. Ueberschuessige Weaken-Threads sind verloren.

Quelle: `src/NetscriptFunctions.ts:342` bis `:386`; Kernzeilen `:367`, `:371`, `:384`

### 3.3 Weaken-Zeit

```ts
export function calculateWeakenTime(server: IServer, person: IPerson): number {
  const weakenTimeMultiplier = 4; // Relative to hacking time
  return weakenTimeMultiplier * calculateHackingTime(server, person);
}
```

`t_weaken = 4 * t_hack`

Quelle: `src/Hacking.ts:90`

### 3.4 Security-Grenzen

```ts
capDifficulty(): void {
  if (this.hackDifficulty < this.minDifficulty) this.hackDifficulty = this.minDifficulty;
  if (this.hackDifficulty < 1) this.hackDifficulty = 1;
  if (this.hackDifficulty > 100) this.hackDifficulty = 100;
}
```

`fortify(amt)` addiert, `weaken(amt)` subtrahiert, danach immer `capDifficulty()`.
Untergrenze: `max(minDifficulty, 1)`. Obergrenze: 100.

Quelle: `src/Server/Server.ts:91`, `:137`, `:143`

---

## 4. Security-Zuwachs pro Thread

| Aktion | Zuwachs pro Thread | Deckel | Quelle |
|---|---|---|---|
| `hack()` (Erfolg) | `+0.002` | `min(threads, ceil(1/p))` | `src/Netscript/NetscriptHelpers.tsx:613` |
| `hack()` (Fehlschlag) | **0** | -- | `src/Netscript/NetscriptHelpers.tsx:624` |
| `grow()` | `+0.004` (= `2 * 0.002`) | `min(threads, ceil(benoetigteThreads))` | `src/Server/ServerHelpers.ts:211` |
| `weaken()` | `-0.05 * coreBonus * BN.ServerWeakenRate` | Untergrenze `minDifficulty` | `src/Server/ServerHelpers.ts:292` |

Die Analyse-Funktionen spiegeln das:

```ts
// hackAnalyzeSecurity(threads, host?)
if (percentHacked > 0) threads = Math.min(threads, Math.ceil(1 / percentHacked));
return ServerConstants.ServerFortifyAmount * threads;             // 0.002 * threads

// growthAnalyzeSecurity(threads, host?, cores?)
const maxThreadsNeeded = Math.ceil(numCycleForGrowthCorrected(server, server.moneyMax, server.moneyAvailable, cores));
threads = Math.min(threads, maxThreadsNeeded);
return 2 * ServerConstants.ServerFortifyAmount * threads;         // 0.004 * threads
```

Quellen: `src/NetscriptFunctions.ts:230` (hackAnalyzeSecurity, Rueckgabe `:243`),
`src/NetscriptFunctions.ts:325` (growthAnalyzeSecurity, Rueckgabe `:340`)

Daraus die klassischen Weaken-Verhaeltnisse bei **1 Kern**:

```
Weaken-Threads pro Hack-Thread  = 0.002 / 0.05 = 1/25    -> ceil(H / 25)
Weaken-Threads pro Grow-Thread  = 0.004 / 0.05 = 2/25    -> ceil(G / 12.5)
```

Bei `cores` Kernen auf dem Weaken-Host teilt sich das noch durch `1 + (cores-1)/16`.

---

## 5. Konstanten mit Zahlenwerten

### 5.1 src/Server/data/Constants.ts

```ts
export const ServerConstants = {
  BaseCostFor1GBOfRamHome: 32000,
  BaseCostFor1GBOfRamServer: 55000,
  HomeComputerMaxRam: 1073741824,          // 2^30
  ServerBaseGrowthIncr: 0.03,              // Unadjusted growth increment
  ServerMaxGrowthLog: 0.00349388925425578, // log1p(.0035)
  ServerFortifyAmount: 0.002,
  ServerWeakenAmount: 0.05,
  CloudServerLimit: 25,
  CloudServerMaxRam: 1048576,              // 2^20
} as const;
```

Diese Datei ist in v3.0.1 und dev **byte-identisch**.

Quelle: `src/Server/data/Constants.ts:1`

### 5.2 Inline-Konstanten in src/Hacking.ts

`src/Hacking.ts` ist in v3.0.1 und dev **byte-identisch**.

| Konstante | Wert | Verwendung | Zeile |
|---|---|---|---|
| `hackFactor` | `1.75` | hackChance | `src/Hacking.ts:14` |
| `baseExpGain` | `3` | XP | `src/Hacking.ts:33` |
| `diffFactor` (XP) | `0.3` | XP | `src/Hacking.ts:34` |
| `balanceFactor` | `240` | percentMoneyHacked | `src/Hacking.ts:49` |
| `baseDiff` | `500` | hackTime | `src/Hacking.ts:66` |
| `baseSkill` | `50` | hackTime | `src/Hacking.ts:67` |
| `diffFactor` (Zeit) | `2.5` | hackTime | `src/Hacking.ts:68` |
| `hackTimeMultiplier` | `5` | hackTime | `src/Hacking.ts:72` |
| `growTimeMultiplier` | `3.2` | growTime | `src/Hacking.ts:84` |
| `weakenTimeMultiplier` | `4` | weakenTime | `src/Hacking.ts:91` |
| Darknet-Hackzeit | `16` (Sekunden) | hackTime bei `DarknetServer` | `src/Hacking.ts:61` |

### 5.3 Server-Erzeugung (Server.ts, Konstruktor)

```ts
const baseMoney = params.moneyAvailable ?? 0;
this.moneyAvailable = baseMoney * currentNodeMults.ServerStartingMoney;
this.moneyMax = 25 * baseMoney * currentNodeMults.ServerMaxMoney;

const realDifficulty = params.hackDifficulty != null ? params.hackDifficulty * currentNodeMults.ServerStartingSecurity : 1;
this.hackDifficulty = Math.min(realDifficulty, 100);
this.baseDifficulty = this.hackDifficulty;
this.minDifficulty = Math.min(Math.max(1, Math.round(realDifficulty / 3)), 100);
```

Also:
- `moneyMax = 25 * moneyAvailable_basis * BN.ServerMaxMoney`
- `minDifficulty = clamp( round(hackDifficulty_basis / 3), 1, 100 )` -- **Minimum-Security
  ist rund ein Drittel der Start-Security**
- `baseDifficulty == hackDifficulty` beim Anlegen; `baseDifficulty` bleibt danach konstant
  und ist die Basis der XP-Formel.

`src/Server/Server.ts` ist in v3.0.1 und dev **byte-identisch**.

Quelle: `src/Server/Server.ts:74` bis `:87`

### 5.4 src/Constants.ts (allgemein, hacking-relevanter Auszug)

| Konstante | Wert | Zeile |
|---|---|---|
| `VersionString` | `"3.0.1"` | `src/Constants.ts:7` |
| `isDevBranch` | `false` | `src/Constants.ts:8` |
| `VersionNumber` | `51` | `src/Constants.ts:10` |
| `MaxSkillLevel` | `975` | `src/Constants.ts:16` |
| `MilliPerCycle` | `200` (ms pro Spielzyklus) | `src/Constants.ts:19` |
| `OfflineHackingIncome` | `0.75` | `src/Constants.ts:22` |
| `NumNetscriptPorts` | `Number.MAX_SAFE_INTEGER` | `src/Constants.ts:38` |

`src/Constants.ts` enthaelt **keine** Hacking-Formel-Konstanten. Die stehen alle in
`src/Server/data/Constants.ts` oder inline in `src/Hacking.ts`.

### 5.5 BitNode-Multiplikatoren (Standardwerte = 1)

`src/BitNode/BitNodeMultipliers.ts` ist in v3.0.1 und dev **byte-identisch**.
Alle hacking-relevanten BitNode-Multiplikatoren stehen im Basis-BitNode auf `1`:

| Multiplikator | Standard | Zeile |
|---|---|---|
| `HackExpGain` | `1` | `src/BitNode/BitNodeMultipliers.ts:100` |
| `HackingLevelMultiplier` | `1` | `src/BitNode/BitNodeMultipliers.ts:103` |
| `HackingSpeedMultiplier` | `1` | `src/BitNode/BitNodeMultipliers.ts:106` |
| `ManualHackMoney` | `1` | `src/BitNode/BitNodeMultipliers.ts:128` |
| `ScriptHackMoney` | `1` | `src/BitNode/BitNodeMultipliers.ts:146` |
| `ScriptHackMoneyGain` | `1` | `src/BitNode/BitNodeMultipliers.ts:153` |
| `ServerGrowthRate` | `1` | `src/BitNode/BitNodeMultipliers.ts:156` |
| `ServerMaxMoney` | `1` | `src/BitNode/BitNodeMultipliers.ts:159` |
| `ServerStartingMoney` | `1` | `src/BitNode/BitNodeMultipliers.ts:162` |
| `ServerStartingSecurity` | `1` | `src/BitNode/BitNodeMultipliers.ts:165` |
| `ServerWeakenRate` | `1` | `src/BitNode/BitNodeMultipliers.ts:168` |

Die abweichenden Werte pro BitNode habe ich nicht ausgelesen -- sie stehen in derselben
Datei weiter unten in den BitNode-Definitionen und lassen sich zur Laufzeit ueber
`ns.getBitNodeMultipliers()` (4 GB RAM) abfragen.

### 5.6 Spieler-Multiplikatoren

Namen der relevanten Felder in `person.mults`: `hacking`, `hacking_exp`, `hacking_chance`,
`hacking_speed`, `hacking_money`, `hacking_grow`. Standardwert je `1`.

Quelle: `src/PersonObjects/Multipliers.ts:2-7`, `:37-42` (in v3.0.1 und dev identisch)

---

## 6. Die formulas.exe-API

Zugangspruefung bei **jeder** Funktion (ausser den drei Mock-Funktionen):

```ts
const checkFormulasAccess = function (ctx: NetscriptContext): void {
  if (!Player.hasProgram(CompletedProgramName.formulas)) {
    throw helpers.errorMessage(ctx, `Requires Formulas.exe to run.`);
  }
};
```

Quelle: `src/NetscriptFunctions/Formulas.ts:61`

Formulas.exe kostet im Darkweb **$5.000.000.000** (`5e9`).
Quelle: `src/DarkWeb/DarkWebItems.ts:20`

**RAM-Kosten: alle `ns.formulas.*`-Funktionen kosten 0 GB.**
Quelle: `src/Netscript/RamCostGenerator.ts:669` bis `:738` (der komplette `formulas`-Teilbaum
ist mit `0` belegt).

### 6.1 ns.formulas.hacking.*

| Funktion | Signatur | Berechnet exakt | Quelle |
|---|---|---|---|
| `hackChance` | `(server, player)` | `calculateHackingChance` (Abschnitt 1.1) | `src/NetscriptFunctions/Formulas.ts:168` |
| `hackExp` | `(server, player)` | `calculateHackingExpGain` (1.4), XP **pro Thread** | `:174` |
| `hackPercent` | `(server, player)` | `calculatePercentMoneyHacked` (1.2), Anteil **pro Thread** | `:180` |
| `growPercent` | `(server, threads, player, cores=1)` | `calculateServerGrowth` = `exp(k*threads)` -- **nur der multiplikative Anteil, ohne den additiven $1/Thread** | `:189` |
| `growThreads` | `(server, player, targetMoney, cores=1)` | `numCycleForGrowthCorrected(server, targetMoney, server.moneyAvailable, cores, player)` -- ganzzahlige Threadzahl, **mit** additivem Term | `:199` |
| `growAmount` | `(server, player, threads, cores=1)` | `calculateGrowMoney` = `min((money+threads)*exp(k*threads), moneyMax)` | `:210` |
| `hackTime` | `(server, player)` | `calculateHackingTime * 1000` -- **Millisekunden** | `:220` |
| `growTime` | `(server, player)` | `calculateGrowTime * 1000` = `3.2 * hackTime` | `:226` |
| `weakenTime` | `(server, player)` | `calculateWeakenTime * 1000` = `4 * hackTime` | `:232` |
| `weakenEffect` | `(threads, cores=1)` | `getWeakenEffect` = `0.05 * threads * coreBonus * BN.ServerWeakenRate` | `:238` |

Achtung bei den Einheiten: `calculateHackingTime` liefert **Sekunden**, die Formulas-API
multipliziert mit 1000 und liefert **Millisekunden**. Die NS-Funktionen `ns.getHackTime`
etc. liefern ebenfalls Millisekunden (`src/NetscriptFunctions.ts:1271`, `:1276`).

Ein `TODO`-Kommentar im Code merkt an, dass `growPercent` schlecht benannt ist und
eigentlich `growMultiplier` heissen muesste (`src/NetscriptFunctions/Formulas.ts:186`).

### 6.2 Mock-Objekte (kein Formulas.exe noetig)

| Funktion | Zweck | Quelle |
|---|---|---|
| `ns.formulas.mockServer()` | leeres Server-Objekt mit allen Feldern auf `0`/`false`/`""` | `src/NetscriptFunctions/Formulas.ts:67` |
| `ns.formulas.mockPlayer()` | Player-Objekt mit Nullwerten und `defaultMultipliers()` | `:93` |
| `ns.formulas.mockPerson()` | Person-Objekt (nur `hp`, `skills`, `exp`, `mults`, `city`) | `:110` |

Sehr nuetzlich fuers Batching: man baut sich einen `mockServer` mit
`hackDifficulty = minDifficulty` und `moneyAvailable = moneyMax` und rechnet damit die Werte
fuer den *praeparierten* Zustand aus, ohne den Server erst dorthin bringen zu muessen.

### 6.3 Uebrige Formulas-Bereiche (nicht Hacking)

Vollstaendige Liste der Teilbaeume mit ihren Funktionen, alle 0 GB:

- `formulas.reputation`: `calculateFavorToRep`, `calculateRepToFavor`, `repFromDonation`,
  `donationForRep`, `sharePower` (`src/NetscriptFunctions/Formulas.ts:117`)
- `formulas.skills`: `calculateSkill`, `calculateExp` (`:149`)
- `formulas.hacknetNodes`: `moneyGainRate`, `levelUpgradeCost`, `ramUpgradeCost`,
  `coreUpgradeCost`, `hacknetNodeCost`, `constants` (`:247`)
- `formulas.hacknetServers`: `hashGainRate`, `levelUpgradeCost`, `ramUpgradeCost`,
  `coreUpgradeCost`, `cacheUpgradeCost`, `hashUpgradeCost`, `hacknetServerCost`, `constants` (`:298`)
- `formulas.gang`: `wantedPenalty`, `respectGain`, `wantedLevelGain`, `moneyGain`,
  `ascensionPointsGain`, `ascensionMultiplier` (`:368`)
- `formulas.work`: `crimeSuccessChance`, `crimeGains`, `gymGains`, `universityGains`,
  `factionGains`, `companyGains` (`:406`)
- `formulas.bladeburner`: `skillMaxUpgradeCount` (`:460`)
- `formulas.dnet`: `getAuthenticateTime`, `getHeartbleedTime`, `getExpectedRamBlockRemoved`
  (`:482`) -- Darknet-Mechanik der 3.0-Reihe
- Entfernt: `formulas.work.classGains` seit Version 2.2.0, ersetzt durch `universityGains`
  bzw. `gymGains` (`:512`)

---

## 7. RAM-Kosten der NS-Funktionen

Basis: **jedes Skript kostet 1.6 GB Grundkosten** (`RamCostConstants.Base`), die
Gesamtkosten eines laufenden Skripts sind `ramUsage * threads`, und ein einzelnes Skript ist
auf **1024 GB** gedeckelt (`RamCostConstants.Max`).

Quellen: `src/Netscript/RamCostGenerator.ts:11`, `:15`, `src/Script/RamCalculations.ts:163`,
`src/Script/RamCalculations.ts:255`, `src/NetscriptWorker.ts:110`

### 7.1 Kostenkonstanten

Der Block `RamCostConstants` ist in v3.0.1 und dev **identisch**.

```ts
export const RamCostConstants = {
  Base: 1.6,
  Dom: 25,
  Max: 1024,
  Hack: 0.1,
  HackAnalyze: 1,
  Grow: 0.15,
  GrowthAnalyze: 1,
  Weaken: 0.15,
  WeakenAnalyze: 1,
  Scan: 0.2,
  PortProgram: 0.05,
  Run: 1.0,
  Exec: 1.3,
  Spawn: 2.0,
  Scp: 0.6,
  Kill: 0.5,
  HasRootAccess: 0.05,
  GetHostname: 0.05,
  GetHackingLevel: 0.05,
  GetServer: 0.1,
  GetServerMaxRam: 0.05,
  GetServerUsedRam: 0.05,
  FileExists: 0.1,
  IsRunning: 0.1,
  GetHackTime: 0.05,
  GetScript: 0.1,
  GetRunningScript: 0.3,
  ArbScript: 1.0,
  RecentScripts: 0.2,
  SingularityFn1: 2,
  CycleTiming: 0,
  ...
} as const;
```

Quelle: `src/Netscript/RamCostGenerator.ts:10` bis `:80`

### 7.2 Die wichtigsten Einzelkosten

| Funktion | RAM (GB) | Quelle |
|---|---|---|
| *(Grundkosten jedes Skripts)* | **1.6** | `src/Netscript/RamCostGenerator.ts:11` |
| `ns.hack` | 0.1 | `:559` |
| `ns.grow` | 0.15 | `:568` |
| `ns.weaken` | 0.15 | `:571` |
| `ns.hackAnalyzeThreads` | 1 | `:560` |
| `ns.hackAnalyze` | 1 | `:561` |
| `ns.hackAnalyzeSecurity` | 1 | `:562` |
| `ns.hackAnalyzeChance` | 1 | `:563` |
| `ns.growthAnalyze` | 1 | `:569` |
| `ns.growthAnalyzeSecurity` | 1 | `:570` |
| `ns.weakenAnalyze` | 1 | `:572` |
| `ns.getHackTime` | 0.05 | `:638` |
| `ns.getGrowTime` | 0.05 | `:639` |
| `ns.getWeakenTime` | 0.05 | `:640` |
| `ns.getServer` | **2** | `:608` |
| `ns.getServerMoneyAvailable` | 0.1 | `:609` |
| `ns.getServerSecurityLevel` | 0.1 | `:610` |
| `ns.getServerBaseSecurityLevel` | 0.1 | `:611` |
| `ns.getServerMinSecurityLevel` | 0.1 | `:612` |
| `ns.getServerRequiredHackingLevel` | 0.1 | `:613` |
| `ns.getServerMaxMoney` | 0.1 | `:614` |
| `ns.getServerGrowth` | 0.1 | `:615` |
| `ns.getServerNumPortsRequired` | 0.1 | `:616` |
| `ns.getServerMaxRam` | 0.05 | `:617` |
| `ns.getServerUsedRam` | 0.05 | `:618` |
| `ns.getHackingLevel` | 0.05 | `:604` |
| `ns.getHackingMultipliers` | 0.25 | `:605` |
| `ns.getBitNodeMultipliers` | 4 | `:607` |
| `ns.getPlayer` | **0.5** (`SingularityFn1 / 4` = `2/4`) | `:650` |
| `ns.hasRootAccess` | 0.05 | `:601` |
| `ns.getHostname` | 0.05 | `:602` |
| `ns.scan` | 0.2 | `:558` |
| `ns.nuke` / `brutessh` / `ftpcrack` / `relaysmtp` / `httpworm` / `sqlinject` | 0.05 je | `:583-588` |
| `ns.run` | 1.0 | `:589` |
| `ns.exec` | 1.3 | `:590` |
| `ns.spawn` | 2.0 | `:591` |
| `ns.kill` / `ns.killall` | 0.5 | `:593-594` |
| `ns.scp` | 0.6 | `:597` |
| `ns.rm` | 0.6 (= `Scp`, in 3.0.1 gesenkt) | `:633` |
| `ns.ls` / `ns.ps` | 0.2 | `:598-599` |
| `ns.share` | 2.4 | `:566` |
| `ns.getSharePower` | 0.2 | `:567` |
| `ns.getScriptRam` | 0.1 | `:637` |
| `ns.getRunningScript` | 0.3 | `:645` |
| `ns.getResetInfo` | 1 | `:653` |
| `ns.serverExists` | 0.1 | `:620` |
| `ns.fileExists` | 0.1 | `:621` |
| `ns.isRunning` | 0.1 | `:622` |
| `ns.formulas.*` (alle) | **0** | `:669-738` |

**0 GB kosten** unter anderem: `ns.sleep`, `ns.asleep`, alle Port-Operationen (`read`,
`write`, `peek`, `clear`, `readPort`, `writePort`, `tryWritePort`, `nextPortWrite`,
`getPortHandle`, `clearPort`), alle Print-Funktionen (`print`, `printf`, `tprint`,
`tprintf`, `printRaw`, `tprintRaw`), `disableLog`/`enableLog`/`clearLog`/`isLogEnabled`/
`getScriptLogs`, sowie `flags`, `getScriptName`, `self`, `atExit`, `exit`, `ramOverride`,
`prompt`, `wget`, `toast`, `alert`, `mv`, `sprintf`, `vsprintf`, `getFunctionRamCost`,
`dynamicImport`, `getFileMetadata`
(`src/Netscript/RamCostGenerator.ts:556-667`).

*(Anmerkung: `ns.isFullPort` und `ns.isEmptyPort` existieren in v3.0.1 **nicht** -- die
wurden erst im dev-Branch ergaenzt. Siehe Abschnitt 10.)*

### 7.3 Praktische Worker-Groessen

| Worker | Inhalt | RAM pro Thread |
|---|---|---|
| Hack-Worker | `1.6 + ns.hack` | **1.70 GB** |
| Grow-Worker | `1.6 + ns.grow` | **1.75 GB** |
| Weaken-Worker | `1.6 + ns.weaken` | **1.75 GB** |

Ein `early-hack-template`-Skript, das alle drei plus `getServerSecurityLevel`,
`getServerMinSecurityLevel`, `getServerMoneyAvailable` und `getServerMaxMoney` nutzt, kommt
auf `1.6 + 0.1 + 0.15 + 0.15 + 0.1 = 2.10 GB` -- die vier `getServer*`-Aufrufe teilen sich
dieselbe `GetServer`-Kostenstelle und werden **nicht** vierfach berechnet; die
RAM-Berechnung zaehlt jede referenzierte Funktion genau einmal
(`src/Script/RamCalculations.ts:161-180`).

---

## 8. Praktische Folgerungen

### 8.1 Warum praeparieren ("prep") sich lohnt

Alle drei Kerngroessen haengen an `sec`:

- `hackChance ~ (100 - sec)`
- `percentMoneyHacked ~ (100 - sec)`
- `t_hack ~ reqSkill * sec` (naeherungsweise, plus der additive `+500`-Term)
- `growthLog ~ ln(1 + 0.03/sec)`, aber **gedeckelt ab sec <= 8.5714**

Ein Server auf `minDifficulty` mit `moneyMax` ist deshalb in jeder Hinsicht das Optimum.
Fuer `grow()` bringt Weakenen unter `sec = 8.5714...` nichts mehr, fuer `hack()` und die
Laufzeiten schon.

### 8.2 Warum HWGW-Batching funktioniert

Die drei Laufzeiten stehen in einem festen Verhaeltnis, das **unabhaengig** vom Server und
vom Spieler ist:

```
t_hack : t_grow : t_weaken = 1 : 3.2 : 4
```

(`src/Hacking.ts:72`, `:84`, `:91`)

Damit laesst sich eine Batch bauen, deren vier Aktionen in der Reihenfolge H, W, G, W
**enden**, obwohl sie zu unterschiedlichen Zeiten starten. Der Rest ist Buchhaltung:

- **Wirkungszeitpunkt vs. Startzeitpunkt.** Die Laufzeit wird beim Aufruf mit dem *damaligen*
  `sec` festgelegt (`src/Netscript/NetscriptHelpers.tsx:544`), die Wirkung aber mit dem
  `sec` **beim Landen** berechnet (`:562`, `:568`). Wenn also alle vier Aktionen in einer
  Batch bei minimalem Security starten, sind Laufzeit *und* Wirkung berechenbar.
- **Reihenfolge ist Pflicht.** Landet W vor H, hat H mit erhoehter Security gerechnet und
  klaut zu wenig. Landet G vor W, wird auf einem zu unsicheren Server gegrowt.
- **`additionalMsec` statt `sleep`.** Die HGW-Optionen erlauben eine praezise Verzoegerung,
  die *innerhalb* der Aktion liegt, statt sich auf JS-Timer zu verlassen
  (`src/Netscript/NetscriptHelpers.tsx:362`, `src/NetscriptFunctions.ts:277`, `:353`).
  Die Spieldoku empfiehlt das ausdruecklich
  (`src/Documentation/doc/en/programming/hackingalgorithms.md:112-114`).
- **Weaken ist die langsamste Aktion.** Deshalb bestimmt `t_weaken = 4 * t_hack` die
  Batch-Laenge, und der Abstand zwischen zwei Batches ist nur die gewaehlte Sicherheitsluecke
  (typisch 5-50 ms laut `hackingalgorithms.md:210`), nicht die volle Batch-Dauer.

### 8.3 Optimales Thread-Verhaeltnis

Sei `f` der Anteil des `moneyMax`, den eine Batch abschoepfen soll, und `p` der
Anteil pro Hack-Thread (`formulas.hacking.hackPercent` auf dem praeparierten Server).

```
H  = floor( f / p )                       Hack-Threads

G  = growThreads( server{money=(1-f)*moneyMax, sec=secMin}, player, moneyMax, cores )
                                          Grow-Threads (exakt, mit additivem Term)

W1 = ceil( 0.002 * H / (0.05 * coreBonus) )   Weaken nach dem Hack
W2 = ceil( 0.004 * G / (0.05 * coreBonus) )   Weaken nach dem Grow
```

Bei 1 Kern also `W1 = ceil(H/25)` und `W2 = ceil(G/12.5)`.

Wichtig: `G` haengt **nichtlinear** von `f` ab. Grow muss den Faktor `1/(1-f)`
wiederherstellen, also gilt naeherungsweise `G ~ -ln(1-f) / k`. Fuer kleine `f` ist das fast
linear, fuer `f -> 1` explodiert es. Deshalb ist ein niedriges `f` meist RAM-effizienter als
ein Server-Leerraeumen pro Batch. Das genaue Optimum ist eine Ableitung, die vom Verhaeltnis
der Worker-RAM-Kosten abhaengt -- **eine feste optimale Zahl steht nicht im Spielcode.**

Gute Nachricht fuer die Umsetzung: Ueberschuessige Hack- und Grow-Threads erzeugen **kein**
zusaetzliches Security (beide Fortify-Aufrufe sind gedeckelt, siehe Abschnitt 4). Ein
kleiner Sicherheitszuschlag bei den Weaken-Threads kostet also nur RAM, nichts anderes.

### 8.4 Was `p` und damit `H` treibt

```
p = (100 - sec)/100 * (skill - reqSkill + 1)/skill * mults.hacking_money / 240
```

Der zweite Faktor geht gegen `1`, wenn `skill >> reqSkill`. Der Maximalwert von `p` ohne
Multiplikatoren ist damit knapp `(100 - secMin)/100 / 240`, also bei `secMin = 3` etwa
`0.404 %` pro Thread. Um den Server komplett zu leeren, braeuchte man rund 248 Threads.
Das ist der Grund, warum Hack-Threads billig sind und Grow-Threads teuer: Hack skaliert
additiv, Grow multiplikativ.

### 8.5 Welche Server lohnen sich

Die Spieldoku selbst formuliert die Heuristik so
(`src/Documentation/doc/en/programming/hackingalgorithms.md:12-15`):
maximales Geld gegen minimale Security abwaegen, und ein Ziel mit einem
Hacking-Level-Bedarf unter der Haelfte des eigenen Levels waehlen.

Aus den Formeln laesst sich das schaerfer fassen. Ertrag pro Zeit und Thread ist ungefaehr

```
score ~ moneyMax * p * hackChance / t_weaken
```

mit allen Groessen ausgewertet **im praeparierten Zustand** (`sec = secMin`,
`money = moneyMax`). Setzt man `t_hack` ein, ergibt sich

```
score ~ moneyMax * (100 - secMin)/100 * (skill - reqSkill + 1)/skill * (skill + 50)
        / ( 2.5 * reqSkill * secMin + 500 )
```

Daraus folgen drei Dinge:

1. **`reqSkill` steht zweimal im Nenner-Bereich** (einmal in der Laufzeit, einmal in
   `skillMult`). Ein Server mit hohem `reqSkill` ist nur dann gut, wenn das eigene Level
   deutlich darueber liegt -- genau die "Haelfte des eigenen Levels"-Regel der Doku.
2. **`secMin` ist doppelt schaedlich**: linear im Geldanteil und linear in der Laufzeit.
   Und wegen `minDifficulty = round(baseDifficulty / 3)` (`src/Server/Server.ts:83`) sind
   Server mit niedriger Start-Security dauerhaft im Vorteil.
3. **Das eigene Hacking-Level steht im Zaehler** (`skill + 50`). Alle Ziele werden mit
   steigendem Level schneller; die Rangfolge zwischen Zielen verschiebt sich zugunsten
   hoeherer `reqSkill`-Server.

Weiteres aus dem Code, das bei der Zielwahl zaehlt:
- **`hackChance` ist ohne Root-Zugriff exakt 0** (`src/Hacking.ts:13`). Nuken ist
  Voraussetzung, nicht Optimierung.
- **`grow` und `weaken` brauchen kein Hacking-Level**, nur Root
  (`src/Hacking/netscriptCanHack.ts:49`, `:53`). Ein Server kann also schon vorbereitet
  werden, bevor man ihn hacken darf.
- **XP haengen an `baseDifficulty`, nicht an `moneyMax`** (`src/Hacking.ts:31`). Fuers reine
  XP-Farmen ist ein anderer Server optimal als fuers Geld -- und `weaken`/`grow` geben
  dieselbe XP pro Thread wie ein erfolgreicher `hack`, bei 3.2- bzw. 4-facher Laufzeit.
- **Eigene gekaufte Server sind als Ziel gesperrt** (`baseCheck` in
  `src/Hacking/netscriptCanHack.ts:15`). Sie sind reine RAM-Lieferanten.

### 8.6 Server-Metadaten (Auszug, gepruefte Werte aus v3.0.1)

`src/Server/data/servers.ts` enthaelt **70 Server-Eintraege**, davon **7 mit
`moneyAvailable: 0`** (reine Story-/RAM-Server). Werte, die als `{min, max}` angegeben sind,
werden beim Anlegen des Netzwerks **einmalig gewuerfelt**
(`getRandomIntInclusive`, `src/Server/ServerHelpers.ts:350-353`) -- sie sind pro Spielstand
fest, aber zwischen Spielstaenden verschieden.

Merke: die Spalte `moneyAvailable` ist der **Basiswert**; `moneyMax = 25 x` diesen Wert.

Repraesentativer Auszug (alle Zeilen aus `reference\v301` verifiziert):

| hostname | reqSkill | moneyAvailable (Basis) | hackDiff | growth | ports | maxRamExp | Zeile |
|---|---|---|---|---|---|---|---|
| n00dles | 1 | 70 000 | 1 | **3000** | 0 | 2 | `src/Server/data/servers.ts:1163` |
| foodnstuff | 1 | 2.0M | 10 | 5 | 0 | 4 | `:1176` |
| sigma-cosmetics | 5 | 2.3M | 10 | 10 | 0 | 4 | `:1189` |
| joesguns | 10 | 2.5M | 15 | 20 | 0 | 4 | `:1200` |
| nectar-net | 20 | 2.75M | 20 | 25 | 0 | 4 | `:1223` |
| neo-net | 50 | 5.0M | 25 | 25 | 1 | 5 | `:1234` |
| silver-helix | 150 | 45M | 30 | 30 | 2 | 6 | `:1246` |
| phantasy | 100 | 24M | 20 | 35 | 2 | 5 | `:1281` |
| the-hub | 275-325 | 150M-200M | 35-45 | 45-55 | 2 | 3-6 | `:1069` |
| rho-construction | 475-525 | 500M-700M | 40-60 | 40-60 | 3 | 4-6 | `:854` |
| zb-institute | 725-775 | 800M-1.1B | 65-85 | 75-85 | 5 | 4-7 | `:964` |
| fulcrumtech | 950-1250 | 1.4B-1.8B | 83-97 | 80-99 | 5 | 7-11 | `:264` |
| blade | 900-1200 | 10B-40B | 88-97 | 55-85 | 5 | 5-9 | `:117` |
| omnitek | 900-1100 | 13B-22B | 90-99 | 95-99 | 5 | 7-9 | `:190` |
| nwo | 950-1300 | 20B-40B | 99 | 65-95 | 5 | -- | `:142` |

Story-Server ohne Geld (nur Backdoor-Ziele, aber teils gute RAM-Hosts):
`CSEC` (`:1504`), `avmnite-02h` (`:1470`), `I.I.I.I` (`:1451`), `run4theh111z` (`:1432`),
`.` (Dark Army, `:1489`), `The-Cave` (`:1520`), `w0r1d_d43m0n` (`:1532`).
Hostnamen-Zuordnung in `src/Server/data/SpecialServers.ts`.

Beobachtungen:
- **`n00dles` hat `serverGrowth: 3000`** -- ein extremer Ausreisser (alle anderen liegen im
  Bereich 1-99). Bei nur 1.75M `moneyMax` bleibt der Absolutertrag klein, aber der Server
  wird praktisch sofort wieder voll. Fuer das fruehe Spiel und fuer XP-/Testzwecke sehr
  brauchbar.
- **Die geldreichsten Ziele haben oft gar keinen `maxRamExponent`** (z. B. `nwo`, `ecorp`,
  `megacorp`, `clarkinc`, `kuai-gong`) -- sie sind reine Ziele, keine Skript-Hosts. Die
  fetten RAM-Hosts sind `fulcrumtech` (bis 2^11 = 2048 GB), `blade` und `omnitek`.
- **`fulcrumassets`** steht formal mit Geld in der Liste (1M Basis), ist aber mit
  `serverGrowth: 1` und `hackDifficulty: 99` kein sinnvolles Ziel -- es ist der
  Fulcrum-Backdoor-Server (`src/Server/data/servers.ts:289`).

### 8.7 Cores nicht vergessen

`coreBonus = 1 + (cores - 1)/16` wirkt auf `grow` und `weaken`, aber **nicht** auf `hack`
(`src/Server/ServerHelpers.ts:287`, `:294`, `src/Server/formulas/grow.ts:25`). Entscheidend
sind die Kerne des **ausfuehrenden** Hosts, nicht die des Ziels
(`src/NetscriptFunctions.ts:292`, `:367`). Gekaufte Server haben typischerweise 1 Kern, das
Home-Netz kann mehr haben -- Weaken- und Grow-Worker gehoeren also bevorzugt auf `home`.

### 8.8 Fallstricke aus dem Code

- `ns.growthAnalyze` ignoriert den additiven $1/Thread-Term und rundet nicht
  (`src/Server/ServerHelpers.ts:69`, `:75`). Fuer exakte Batches ist
  `ns.formulas.hacking.growThreads` die richtige Wahl.
- `ns.grow()` gibt `0` zurueck, wenn `moneyMax === 0` (`src/NetscriptFunctions.ts:308`) --
  kein Fehler, sondern der definierte Sonderfall.
- `ns.weaken()` gibt die **tatsaechlich** erreichte Senkung zurueck, nicht die theoretische
  (`src/NetscriptFunctions.ts:371`). Ein Rueckgabewert kleiner als erwartet heisst: Server
  war schon fast auf `minDifficulty`.
- `opts.threads` in `hack`/`grow`/`weaken` darf **nicht groesser** sein als die Threadzahl
  des Skripts, sonst Exception (`src/Netscript/NetscriptHelpers.tsx:375`). Es ist eine
  Begrenzung nach unten, keine Aufstockung.
- `additionalMsec` ist auf `[0, 1e9]` begrenzt (`src/Netscript/NetscriptHelpers.tsx:363`,
  `:366`).
- Ein einzelnes Skript kann nie mehr als 1024 GB kosten (`src/Script/RamCalculations.ts:255`).

---

## 9. Was ich NICHT im Code gefunden habe

Der Vollstaendigkeit halber, damit hier nichts geraten wird:

- **Kein "optimaler" `f`-Wert (Geldanteil pro Batch) im Spielcode.** Das Optimum ist eine
  Ableitung aus den obigen Formeln plus RAM-Kosten, keine Spielkonstante.
- **Keine explizite Formel fuer eine Zielserver-Bewertung.** Die Formel in Abschnitt 8.5 ist
  aus den Kernformeln hergeleitet, kein Zitat aus dem Code. Der einzige Hinweis im Repo ist
  die Prosa-Empfehlung in `src/Documentation/doc/en/programming/hackingalgorithms.md:12-15`.
- **Die BitNode-spezifischen Multiplikatorwerte** (also die Abweichungen von `1` je BitNode)
  habe ich nicht ausgelesen. Sie stehen in `src/BitNode/BitNodeMultipliers.ts` bzw. den
  BitNode-Definitionen und sind zur Laufzeit ueber `ns.getBitNodeMultipliers()` abrufbar.
- **Die Darknet-Mechanik** (`src/DarkNet/`, `DarknetServer`, `formulas.dnet.*`) habe ich nur
  so weit angeschaut, wie sie das klassische Hacking beruehrt (feste Hackzeit 16 s). Ihre
  eigenen Formeln -- Authentifizierungszeit, Heartbleed, RAM-Block-Entfernung -- sind hier
  nicht ausgewertet.
- **Offline-Verhalten von Skripten** (`OfflineHackingIncome = 0.75`) habe ich nur als
  Konstante notiert, die zugehoerige Verrechnungslogik nicht nachverfolgt.
- **Die vollstaendige Server-Tabelle** (alle 63 Geld-Server mit exakten v301-Zeilennummern)
  habe ich nicht durchgezaehlt; Abschnitt 8.6 ist ein verifizierter Auszug. Die Zahlenwerte
  aller Server sind aber in v3.0.1 und dev identisch (siehe Abschnitt 10).

---

## 10. Abweichungen dev (3.0.2) vs v3.0.1

Ich habe alle in diesem Dokument verwendeten Dateien zwischen
`reference\bitburner-src` (dev, `VersionString "3.0.2"`, git HEAD `79e5cd8`) und
`reference\v301` verglichen.

### 10.1 Formel-Dateien: byte-identisch

Diese Dateien sind in beiden Staenden **exakt gleich** -- alle Kernformeln, alle
Konstanten, alle Zeilennummern:

- `src/Hacking.ts` (hackChance, hackExp, hackPercent, hackTime, growTime, weakenTime)
- `src/Server/data/Constants.ts` (`ServerFortifyAmount`, `ServerWeakenAmount`,
  `ServerBaseGrowthIncr`, `ServerMaxGrowthLog`)
- `src/Server/formulas/grow.ts` (Wachstumsformel inkl. additivem Term)
- `src/Server/Server.ts` (`moneyMax = 25x`, `minDifficulty = round(base/3)`, fortify/weaken)
- `src/Hacking/netscriptCanHack.ts` (Root-/Level-Pruefungen)
- `src/PersonObjects/formulas/intelligence.ts`, `.../skill.ts`
- `src/BitNode/BitNodeMultipliers.ts`, `src/PersonObjects/Multipliers.ts`
- `src/PersonObjects/Person.ts`, `src/Script/RamCalculations.ts`
- `src/DarkWeb/DarkWebItems.ts` (Formulas.exe = 5e9)
- `src/utils/helpers/clampNumber.ts`
- `test/jest/Grow.test.ts` (die exakten Testwerte 1.0035 / 1.003 gelten in beiden)
- `src/Documentation/doc/en/programming/hackingalgorithms.md`

**Damit ist die gesamte Hacking-Mathematik in v3.0.1 und dev identisch.** Die urspruenglich
aus dem dev-Branch extrahierten Formeln und Zahlen waren inhaltlich korrekt; nur die
Zeilennummern der Netscript-Dateien und ein paar API-Details unterscheiden sich.

### 10.2 Unterschiede ohne Strategie-Wirkung

- **`src/Constants.ts`**: `VersionString` `"3.0.1"` vs `"3.0.2"`, `isDevBranch` `false` vs
  `true`, unterschiedlicher `LatestUpdate`-Changelog-Text. Alle Zahlenkonstanten
  (`MaxSkillLevel: 975`, `MilliPerCycle: 200`, `OfflineHackingIncome: 0.75`, …) sind gleich.
  *Nebenwirkung:* wegen `isDevBranch = false` wirft `clampNumber(NaN)` in v3.0.1 keine
  Exception, sondern liefert still `min`. Betrifft nur das Fehlerverhalten, keine Formel.
- **`src/NetscriptFunctions.ts`, `src/NetscriptFunctions/Formulas.ts`,
  `src/Netscript/NetscriptHelpers.tsx`**: der dev-Branch hat die interne API-Signatur von
  `(ctx) => (args) => {…}` auf `(ctx, args) => {…}` umgestellt (Currying entfernt). Das ist
  ein reiner Refactor; die Rechenlogik ist Zeile fuer Zeile gleich. Folge fuer dieses
  Dokument: **alle Zeilennummern in diesen drei Dateien sind verschoben** und stehen hier in
  der v3.0.1-Fassung.
- **`src/Server/data/servers.ts`**: der dev-Branch ergaenzt ein Feld
  `discoverableScripts` (vorgefertigte Beispielskripte auf einigen Servern). **Alle
  Zahlenwerte -- `requiredHackingSkill`, `moneyAvailable`, `hackDifficulty`, `serverGrowth`,
  `numOpenPortsRequired`, `maxRamExponent` -- sind identisch**, ebenso die Gesamtzahl von 70
  Eintraegen und die 7 geldlosen Story-Server. Nur die Zeilennummern verschieben sich um
  etwa 4 bis 14 nach unten (dev) bzw. oben (v301).
- **`src/Server/ServerHelpers.ts`**: dev ergaenzt `validateConnections()` und das Aufspielen
  der `discoverableScripts`, und setzt beim Prestige zusaetzlich die Port-Flags auf `home`
  zurueck. **`numCycleForGrowth`, `numCycleForGrowthCorrected`, `processSingleServerGrowth`,
  `getCoreBonus`, `getWeakenEffect` sind unveraendert**; nur die Zeilennummern verschieben
  sich (v301 = dev minus 2).

### 10.3 NS-API-Unterschiede (nur dev, in v3.0.1 nicht vorhanden)

Diese Funktionen existieren im dev-Branch, aber **nicht in v3.0.1** -- ein Skript, das sie
nutzt, laeuft im gespielten Stand nicht:

| Funktion | Bereich | RAM (dev) |
|---|---|---|
| `ns.isFullPort` | Ports | 0 |
| `ns.isEmptyPort` | Ports | 0 |
| `ns.singularity.hasExportGameBonus` | Singularity | `SingularityFn1/4` |
| `ns.dnet.freezeServer` | Darknet | 2 |
| `ns.ui.openCodeEditor` | UI | 0 |
| `ns.ui.alias` / `unalias` / `getAllAliases` | UI | 0 |
| `ns.ui.renderPage` | UI | 0 |
| `ns.ui.createConnectLink` | UI | 5 |
| `ns.format.money` | Format | 0 |

**Keine dieser Funktionen ist fuer Hacking-Batching relevant.** Praktisch bedeutsam ist nur
das Fehlen von `ns.isFullPort` / `ns.isEmptyPort`, falls Port-basierte Kommunikation
zwischen Controller und Workern gebaut wird -- in v3.0.1 muss man dort mit `peek()` gegen
`"NULL PORT DATA"` bzw. mit `tryWritePort()`-Rueckgabewerten arbeiten.

**Keine RAM-Kosten und keine Formel-Konstante hat sich zwischen v3.0.1 und dev geaendert.**
Die einzige RAM-Aenderung der 3.0.1-Reihe (`ns.rm()` auf `Scp`-Kosten gesenkt, PR #2761) ist
in v3.0.1 bereits enthalten.
