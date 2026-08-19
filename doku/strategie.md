# Fahrplan BitNode 1 (v3.0.1, ohne Source Files)

**Ausgangslage:** Hacking ~40, ~$200.000, 130 GB Netzspeicher, 18 von 80 Servern gerootet.
**Ziel:** Backdoor auf `w0r1d_d43m0n`.
**Harte Randbedingung:** kein SF4, also **keine Singularity-API**. Alles, was mit Faktionen,
Firmen, Reisen, Programmen-Kaufen, Programmen-Schreiben und Augmentations zu tun hat, muss
ueber die Oberflaeche geklickt werden.

Quellen: `doku/formeln-progression.md`, `doku/formeln-wirtschaft.md`, `doku/bitnode-und-server.md`,
`doku/formeln-hacking.md`, `doku/api-aenderungen-v3.md`. Wo ich selbst gerechnet oder im
Quellcode unter `reference/v301` nachgeschlagen habe, steht die Fundstelle dabei. Alles, was
Annahme ist, ist als **Annahme** gekennzeichnet.

---

## 0. Die drei Engpaesse, in dieser Reihenfolge

Bevor die Phasen kommen, die Kurzdiagnose. BN1 hat **keinen einzigen BitNode-Multiplikator**
(`src/BitNode/BitNode.tsx:572-574`), also gelten die reinen Grundformeln. Damit sind die
Engpaesse eindeutig:

1. **Der `hacking`-Level-Multiplikator.** Exp fuer Level L bei Multiplikator m ist
   `e^((L/m + 200)/32) - 534.6`. Fuer Level 3000 heisst das:
   m = 1 → 2,7e43 Exp (unmoeglich), m = 4 → 7,9e12, m = 6 → 3,2e9, m = 8 → 6,4e7.
   **Ohne einen `hacking`-Multiplikator von mindestens rund 4 bis 6 ist BN1 nicht zu beenden.**
   Der Multiplikator kommt ausschliesslich aus Augmentations, und Augmentations wirken erst
   nach einer Installation. Also: **resetten ist der Kern der Strategie, nicht ihr Nebeneffekt.**

2. **Faction Reputation.** Rep pro Sekunde bei Hacking Contracts ist
   `5 * hacking/975 * faction_rep * (1 + favor/100) * focus`
   (`src/PersonObjects/formulas/reputation.ts:16-24`). Bei Hacking 1000 und ohne Boni sind das
   5,13 Rep/s. Der Rep-Bedarf ueber den ganzen Lauf liegt bei ueber 8 Millionen, davon allein
   2,5 Millionen fuer The Red Pill. Das ist die groesste Zeitsenke des BitNodes.

3. **Geld** ist der schwaechste Engpass. Gekaufte Server kosten in BN1 exakt `ram * 55.000`
   ohne jede Progression (`src/Server/ServerPurchases.ts:23-41`, `CloudServerSoftcap = 1`), und
   ein batchendes Hacking-Setup wandelt RAM praktisch linear in Einkommen um. Ab einem gewissen
   Punkt ist Geld beliebig verfuegbar und nur noch die Rep zaehlt.

**Merksatz:** Hacking-Level und Geld kommen von selbst, sobald Skripte laufen. Multiplikator und
Reputation kommen nur durch Klicken. Der Automat muss deshalb den Klickpfad optimieren, nicht
den Skriptpfad.

---

## 1. Kurzfassung: Phasentabelle

| Phase | Ausloeser (skriptpruefbar) | Ziel | Aktionen (S = Skript, K = Klick) |
|---|---|---|---|
| **P0 Sofort** | jetzt | Weichen stellen | K: Options setzen (ASCII aus, Bestaetigungen aus). S: Hacknet-Kaeufe einstellen. S: Root-Skript auf alle 0-Port-Server. |
| **P1 Erster Portknacker** | `hacking >= 50` | BruteSSH.exe | K: Create Program → BruteSSH.exe (10 min). Alternativ ab $700k: K: TOR + `buy BruteSSH.exe`. |
| **P2 CyberSec** | `getServer("CSEC").hasAdminRights` | Backdoor auf CSEC, Faktion beitreten | K: Terminal `connect`-Kette, `run BruteSSH.exe`, `run NUKE.exe`, `backdoor`. K: Factions → Join! |
| **P3 Tian Di Hui** | `hacking >= 50 && money >= 1.2e6` | S.N.A. sichern | K: Travel to Ishima → Join Tian Di Hui → Travel to Sector-12. **Keine Stadtfaktion beitreten.** |
| **P4 Erste Serverfarm** | `money >= 11e6` | 25 gekaufte Server | S: `ns.cloud.purchaseServer` 25x, danach nur noch `upgradeServer`. K: TOR ($200k), `buy FTPCrack.exe`. |
| **P5 NiteSec** | `hacking >= 220` | Backdoor `avmnite-02h` | K: Backdoor-Prozedur. K: Factions → Join! |
| **P6 Erster Reset** | `hacking`-Mult der gekauften Augs >= 1,3 | Multiplikator einsammeln | K: Augmentations teuerste zuerst kaufen, NFG zuletzt, dann Install. Vorher: Restgeld in Heim-RAM. |
| **P7 Ausbaurunden** | je Lauf | Black Hand → BitRunners → Sector-12 → Megakonzern | K: Backdoors `I.I.I.I` (340-365), `run4theh111z` (505-550). K: Job bei Clarke/NWO/OmniTek, 300-400k Firmen-Rep. Reset je Runde. |
| **P8 Daedalus-Runde** | `ownedAugs >= 30 && money >= 100e9 && hacking >= 2500` | The Red Pill | K: Join Daedalus. Hacking auf 4000+ treiben, **dann** 2,5e6 Rep farmen. K: Red Pill kaufen (kostet $0). Install. |
| **P9 Endspiel** | Red Pill installiert | `w0r1d_d43m0n` | S: Hacking auf 3000. K: alle 5 Portknacker beschaffen. K: `connect` bis `The-Cave`, dann `w0r1d_d43m0n`, `run NUKE.exe`, `backdoor`. |

---

## 2. Meilensteinkette mit Zahlen und Erkennungsmerkmalen

### 2.1 Hacking-Level-Schwellen

| Level | Was es freischaltet | Quelle |
|---:|---|---|
| 50 | `BruteSSH.exe` selbst schreiben; Server `neo-net` | `src/Programs/Programs.ts:82` |
| 51-60 | Backdoor auf `CSEC` moeglich → **CyberSec** (pro Lauf ausgewuerfelt) | `bitnode-und-server.md` Servertabelle |
| 75 | `DeepscanV1.exe`, `ServerProfiler.exe`; `zer0` | `Programs.ts:206,233` |
| 100 | `FTPCrack.exe` selbst schreiben; `iron-gym`, `phantasy` | `Programs.ts:107` |
| 202-220 | Backdoor auf `avmnite-02h` → **NiteSec** | Servertabelle |
| 250 | `relaySMTP.exe` selbst schreiben | `Programs.ts:132` |
| 340-365 | Backdoor auf `I.I.I.I` → **The Black Hand** | Servertabelle |
| 400 | `DeepscanV2.exe` | `Programs.ts:219` |
| 500 | `HTTPWorm.exe` selbst schreiben | `Programs.ts:157` |
| 505-550 | Backdoor auf `run4theh111z` → **BitRunners** | Servertabelle |
| 750 | `SQLInject.exe` selbst schreiben; erste 5-Port-Server (`zb-institute`) | `Programs.ts:182` |
| 925 | `The-Cave` (5 Ports) — der Weg zum Endgegner | Servertabelle |
| 1000 | `Formulas.exe` selbst schreiben | `Programs.ts:296` |
| 1100-1600 | Backdoor auf `fulcrumassets` → **Fulcrum Secret Technologies** | Servertabelle |
| **2500** | **Daedalus-Einladung** (zusammen mit 30 Augs und $100e9) | `src/Faction/FactionInfo.tsx:141-145` |
| **3000** | **`w0r1d_d43m0n`** (5 Ports, `WorldDaemonDifficulty = 1` in BN1) | `src/Server/data/servers.ts:1530-1539` |

### 2.2 Geldschwellen

| Betrag | Wofuer | Quelle |
|---:|---|---|
| $200.000 | TOR Router; ein Reiseticket | `src/Constants.ts:44`, `:28` |
| $1.000.000 | Beitrittsbedingung Tian Di Hui | `FactionInfo.tsx:683-687` |
| $11.000.000 | 25 gekaufte Server a 8 GB | gerechnet: `25 * 8 * 55.000` |
| $15.000.000 | Beitrittsbedingung Sector-12 | `FactionInfo.tsx:540` |
| $40.000.000 | Beitrittsbedingung Aevum | `FactionInfo.tsx:498` |
| $88.000.000 | 25 Server a 64 GB | gerechnet |
| $200.000.000 | WSE Account | `src/StockMarket/data/Constants.ts:7` |
| $704.000.000 | 25 Server a 512 GB | gerechnet |
| $5.000.000.000 | TIX API | `Constants.ts:8` |
| $5.632.000.000 | 25 Server a 4096 GB | gerechnet |
| $45.056.000.000 | 25 Server a 32768 GB | gerechnet |
| **$100.000.000.000** | **Beitrittsbedingung Daedalus** | `FactionInfo.tsx:143` |
| $1.441.792.000.000 | 25 Server am RAM-Maximum (2^20 GB) | gerechnet |

### 2.3 Reputationsschwellen (die wirklich wichtigen)

| Rep | Wofuer | Quelle |
|---:|---|---|
| 6.250 | S.N.A. bei Tian Di Hui (`faction_rep` 1,15) | `Augmentations.ts:1483` |
| 18.750 | Cranial Signal Processors Gen II — hoechste CyberSec-Anforderung | `Augmentations.ts:430` |
| 50.000 | Cranial Signal Processors Gen III (NiteSec) | `Augmentations.ts:444` |
| 75.000 | Neuroreceptor Management Implant (Tian Di Hui) — hebt die Fokus-Strafe auf | `Augmentations.ts:1229` |
| 112.500 | DataJack (NiteSec/Black Hand/BitRunners) | `Augmentations.ts:496` |
| 125.000 | Cranial Signal Processors Gen IV (Black Hand) | `Augmentations.ts:458` |
| 250.000 | Cranial Signal Processors Gen V (BitRunners, `hacking` 1,30) | `Augmentations.ts:476` |
| 437.500 | nextSENS (Clarke Inc., alle Skills 1,20) | `Augmentations.ts:1320` |
| **462.490** | **150 Favor** — ab hier darf man bei der Faktion spenden | `src/Faction/formulas/favor.ts`, `src/Constants.ts:31` |
| 875.000 | Xanipher (NWO, alle Skills 1,20 + alle Exp 1,15) und BitRunners Neurolink | `Augmentations.ts:2047`, `:1203` |
| 1.750.000 | ENM Core V3 Upgrade | `Augmentations.ts:636` |
| **2.500.000** | **The Red Pill (Daedalus)** — kostet $0, nur Rep | `Augmentations.ts:1946` |

Firmen-Rep: **400.000** fuer eine Megakonzern-Faktion, **300.000** wenn auf dem Firmenserver ein
Backdoor liegt (`src/Constants.ts:25`, `src/Company/utils.ts:15-19`,
`CompanyRequiredReputationMultiplier = 0.75`).

### 2.4 Was das Skript pruefen kann — und was nicht

Ohne SF4 ist der Sichtbereich eines Skripts begrenzt. Das ist fuer die Arbeitsteilung
zwischen Skript und Browser-Automat entscheidend.

**Skriptpruefbar:**

| Meilenstein | Abfrage | RAM |
|---|---|---|
| Hacking-Level | `ns.getHackingLevel()` | 0,05 GB |
| Geld | `ns.getPlayer().money` | 0,5 GB |
| Alle Multiplikatoren (inkl. `hacking`) | `ns.getPlayer().mults` | 0,5 GB |
| Faktionsmitgliedschaft | `ns.getPlayer().factions` enthaelt `"CyberSec"` | 0,5 GB |
| Aktuelle Stadt | `ns.getPlayer().city` | 0,5 GB |
| Aktueller Job | `ns.getPlayer().jobs` | 0,5 GB |
| **Zahl installierter Augs** | `ns.getResetInfo().ownedAugs.size` | 1 GB |
| Backdoor gesetzt? | `ns.getServer(host).backdoorInstalled` | 2 GB |
| Root vorhanden? | `ns.hasRootAccess(host)` | 0,05 GB |
| Portknacker vorhanden? | `ns.fileExists("BruteSSH.exe", "home")` | 0,1 GB |
| Boersenzugang | `ns.stock.hasWSEAccount()` / `has4SDataTIXAPI()` | — |
| Heim-RAM | `ns.getServerMaxRam("home")` | 0,05 GB |
| Gekaufte Server | `ns.cloud.getServerNames()` | — |

Belegt in `src/NetscriptFunctions.ts:1417-1436` (`getPlayer`), `:1486-1500` (`getResetInfo`),
`:963` (`backdoorInstalled` in `ns.getServer`).

**Nicht skriptpruefbar ohne SF4** — der Browser-Automat muss diese Werte von der Oberflaeche
ablesen:

- **Faction Reputation** und **Company Reputation** (keine Non-Singularity-API dafuer).
- **Offene Faktions-Einladungen**.
- **Preise und Kaufbarkeit einzelner Augmentations**.
- **Faction Favor** (`ns.getFavorToDonate()` liefert nur die Schwelle 150, nicht den eigenen Stand).

**Praktische Folgerung:** Der Automat liest Rep und Favor per DOM-Auslesen von der
Faction-Detailseite (`Faction`-Page) und legt sie in einer Datei auf `home` ab, damit das
Skript sie mitbenutzen kann. Das ist die einzige Bruecke ueber die Luecke.

---

## 3. Phasen im Einzelnen

### P0 — Sofortmassnahmen (0 bis 15 Minuten)

**Oberflaeche zuerst konfigurieren.** Drei Optionen entscheiden darueber, ob der Automat
ueberhaupt zuverlaessig klicken kann (Sidebar → Help → Options):

1. **Disable ASCII art** (Interface). Ohne das rendert die City-Seite ASCII-Kunst, in der die
   Locations nur einzelne Buchstaben mit `aria-label` sind (`src/Locations/ui/City.tsx:47-65`).
   Mit der Option gibt es stattdessen echte Buttons mit dem vollen Namen (`City.tsx:137-148`).
   Dasselbe gilt fuer die Travel-Seite.
2. **Suppress travel confirmations** (Gameplay) — spart je Reise einen Modal-Schritt.
3. **Suppress faction invites** (Gameplay) — sonst stiehlt ein Einladungs-Modal unvorhersehbar
   den Fokus. Die Einladung bleibt in der Factions-Liste stehen und kann dort in Ruhe
   angenommen werden.

Optional: **Suppress augmentations confirmation** spart je Aug-Kauf und beim Install einen
Bestaetigungsdialog. Fuer einen Automaten sinnvoll, kostet aber das Sicherheitsnetz.

**Hacknet sofort einstellen.** Das ist die erste Sparmassnahme. Rechnung: Node Nr. 1 kostet
$1.000 und bringt 1,5 $/s, also 0,0015 $/s je Dollar. Gekauftes Server-RAM kostet $55.000/GB,
bringt also `Einkommen_pro_GB / 55.000` $/s je Dollar. Gleichstand bei **$82,5/s pro GB**. Bei
130 GB Netzspeicher heisst das: **sobald das Hacking-Einkommen ueber rund $10.700/s liegt, ist
jeder Hacknet-Dollar verschenkt.** Bei $200.000 auf dem Konto und 130 GB laufender Infrastruktur
ist dieser Punkt bereits ueberschritten. Node Nr. 8 kostet $74.166 fuer +1,5 $/s — 13,7 Stunden
Amortisation (`formeln-wirtschaft.md`, Abschnitt 2.1).

**Rooten und Ernten.** Das Skript rootet alle Server, deren `numOpenPortsRequired` mit den
vorhandenen Programmen erreichbar ist, und faehrt HWGW-Batches. Zielwahl nach der Formel aus
`formeln-hacking.md` 8.5:

```
score ~ moneyMax * (100 - secMin)/100 * (skill - reqSkill + 1)/skill * (skill + 50)
        / (2.5 * reqSkill * secMin + 500)
```

Wichtig: `moneyMax` und `minDifficulty` werden **pro Spielstand ausgewuerfelt**
(`src/Server/ServerHelpers.ts:350-353`). Nie hart eintragen, immer live mit
`ns.getServerMaxMoney()` und `ns.getServerMinSecurityLevel()` abfragen.

### P1 — BruteSSH.exe (Hacking 50)

Zwei Wege, siehe Abschnitt 5 im Detail. Bei $200.000 Kontostand ist die Antwort eindeutig:
**selbst schreiben.** 10 Minuten bei Hacking exakt 50, und in dieser Zeit laufen die Skripte
ungestoert weiter. Der Kaufweg kostet $200.000 (TOR) + $500.000 (BruteSSH) = $700.000, die man
noch nicht hat.

### P2 — CyberSec (Hacking 51-60)

`CSEC` braucht 1 offenen Port und ein Hacking-Level zwischen 51 und 60 (pro Lauf ausgewuerfelt).
Ablauf im Terminal, danach ein Klick in der Factions-Liste. Genaue Folge in Abschnitt 9.2.

CyberSec bietet fuenf Augmentations mit einer Hoechstanforderung von 18.750 Rep. Das ist die
erste Faktion und in jedem Lauf die billigste.

**Wichtig fuer die Zeitplanung:** Rep-Rate ist **linear im Hacking-Level**. Bei Hacking 100 sind
das 0,51 Rep/s, also 10,2 Stunden fuer 18.750 Rep. Bei Hacking 300 sind es 1,54 Rep/s, also
3,4 Stunden. **Also nicht sofort Rep farmen, sondern erst das Hacking-Level hochziehen** — das
passiert nebenbei, weil die Skripte laufen. Rep-Farmen ist die einzige Taetigkeit, die den
Spieler blockiert; sie gehoert ans Ende einer Levelphase, nicht an den Anfang.

### P3 — Tian Di Hui, und warum sie vor Sector-12 kommt

Bedingungen: in Chongqing, New Tokyo **oder** Ishima sein, Hacking >= 50, >= $1e6
(`FactionInfo.tsx:683-687`). Reisekosten $200.000 je Richtung (`src/Constants.ts:28`).

Der Grund ist **S.N.A. (Social Negotiation Assistant)**: 6.250 Rep, $30 Mio,
`faction_rep` 1,15 (`Augmentations.ts:1483`). Das ist die billigste Rep-Beschleunigung im Spiel
und wirkt auf **jede** spaetere Faktion. Spaeter dazu das
**Neuroreceptor Management Implant** (75.000 Rep, $550 Mio), das die Fokus-Strafe von 0,8
aufhebt (`PlayerObjectGeneralMethods.ts:622-628`) — das sind pauschal +25 % auf jede Arbeit,
bei der der Automat nicht dauerhaft fokussiert bleiben kann.

**Reihenfolgezwang:** Die Stadtfaktionen sind untereinander verfeindet
(`FactionHelpers.tsx:44-46`). Sector-12 und Aevum sperren Chongqing, New Tokyo, Ishima und
Volhaven. Tian Di Hui ist **keine** Stadtfaktion und wird davon nicht gesperrt — man muss aber
in einer der drei Ost-Staedte **sein**, um die Einladung zu bekommen. Also: hinreisen,
Tian Di Hui beitreten, zurueckreisen, und dabei **auf keinen Fall** die Einladung von
Chongqing/New Tokyo/Ishima annehmen.

### P4 — Die Serverfarm

Ab hier geht jeder freie Dollar in gekaufte Server. Begruendung mit Zahlen in Abschnitt 4.

Vorgehen: 25 Server der groessten bezahlbaren Zweierpotenz kaufen, danach **nur noch
hochruesten**. Das Upgrade ist ein reiner Differenzpreis ohne Aufschlag
(`src/Server/ServerPurchases.ts:44-53`), es gibt also keinen Nachteil gegenueber "gleich gross
kaufen". Grenzen in BN1: 25 Server, je maximal 2^20 = 1.048.576 GB.

Parallel: TOR Router kaufen ($200.000) und `FTPCrack.exe` beschaffen.

### P5 — NiteSec (Hacking 202-220)

`avmnite-02h`, 2 Ports. Kern-Augmentations: Cranial Signal Processors Gen III (50.000 Rep,
`hacking` 1,09), CRTX42-AA (45.000 Rep, `hacking` 1,08), Neural-Retention Enhancement
(20.000 Rep, `hacking_exp` 1,25), Artificial Synaptic Potentiation, Neurotrainer II.
Dazu das **Embedded Netburner Module** (15.000 Rep, $250 Mio, `hacking` 1,08) — das ist der
Prereq der ganzen ENM-Kette, die spaeter bei den Megakonzernen weitergeht.

### P6 — Der erste Reset

Das Produkt der `hacking`-Level-Multiplikatoren aus CyberSec + NiteSec + ENM:

```
BitWire 1,05 * CSP I 1,05 * CSP II 1,07 * CSP III 1,09 * ENM 1,08 * CRTX42-AA 1,08 = 1,50
```

(gerechnet aus `formeln-progression.md`, Abschnitt 2.5)

Was das bringt, steht in Abschnitt 6.3. Kurz: der Wiederaufbau bis Level 500 geht danach
**183-mal schneller**.

### P7 — Ausbaurunden (2 bis 3 Laeufe)

Je Lauf: Programme wieder beschaffen, Serverfarm wieder aufbauen, die naechste Faktion
freischalten, Augs kaufen, resetten.

Reihenfolge der neu zu erschliessenden Faktionen:

1. **The Black Hand** (`I.I.I.I`, Hacking 340-365, 3 Ports) — CSP Gen IV, DataJack,
   Enhanced Myelin Sheathing.
2. **BitRunners** (`run4theh111z`, Hacking 505-550, 4 Ports) — die ergiebigste reine
   Hacking-Faktion: CSP Gen V (`hacking` 1,30), Neural Accelerator (1,10),
   Artificial Bio-neural Network (1,12), Neurolink (1,15 und gibt bei jeder Installation
   `FTPCrack.exe` + `relaySMTP.exe` gratis), ENM Core V2 (1,08).
   Produkt dieser Runde: `1,30 * 1,10 * 1,12 * 1,15 * 1,07 * 1,08 = 2,13`.
3. **Sector-12** ($15 Mio) — **CashRoot Starter Kit**: 12.500 Rep, $125 Mio, gibt bei **jeder**
   Installation $1 Mio Startgeld und `BruteSSH.exe` (`Augmentations.ts:320`). Ein Aug, das den
   Anfang jedes weiteren Laufs abkuerzt.
4. **Ein Megakonzern.** Anstellung plus 400.000 Firmen-Rep (300.000 mit Backdoor auf dem
   Firmenserver). Rangfolge nach Multiplikator pro Rep:
   - **Clarke Incorporated** — nextSENS (437.500 Rep, alle Skills 1,20) und
     Neuronal Densification (187.500 Rep, `hacking` 1,15) und ADR-V2 (62.500 Rep,
     `faction_rep` 1,20). Bestes Verhaeltnis.
   - **NWO** — Xanipher (875.000 Rep, alle Skills 1,20 **und** alle Exp 1,15).
   - **OmniTek Incorporated** — OmniTek InfoLoad (625.000 Rep, `hacking` 1,20, `hacking_exp` 1,25).
   - **Bachman & Associates** — SmartJaw (375.000 Rep, `faction_rep` 1,25, `company_rep` 1,25);
     lohnt sich, **bevor** man den Daedalus-Grind beginnt.

   Produkt der Konzernrunde: `1,20 * 1,20 * 1,20 * 1,10 (ENM Core V3) = 1,90`, mit der
   PCDNI-Kette (Fulcrum/ECorp) bis 2,48.

**Erreichbarer Gesamtmultiplikator:** `1,50 * 2,13 * 1,90 = 6,07`, mit der PCDNI-Kette bis 7,9,
dazu NeuroFlux Governor mit `1,01^Level`. Das reicht fuer Hacking 3000 (3,2e9 Exp bei m=6).

**Zeitbedarf fuer Firmen-Rep** (gerechnet aus `src/Company/CompanyPosition.ts:156-172` und
`src/Work/Formulas.ts:154-156`): Als *Software Engineering Intern* bei einem Konzern mit
`jobStatReqOffset` 224-249 (also ab Hacking 250 haltbar) ist
`performance = 0.9 * (85 * hacking/975) / 100`. Bei Hacking 2500 sind das 9,8 Rep/s, also
**8,5 Stunden fuer 300.000 Rep**. Mit `company_rep`-Augs (Nuoptimal 1,20, Speech Enhancement
1,10, SmartJaw 1,25) sinkt das auf rund 5 Stunden. Eine hoehere Position verdoppelt die Rate
maximal (Intern 0,9 gegen CTO 2,0), verlangt aber Charisma 500-750 — **das lohnt nicht**, weil
Charisma in BN1 sonst nichts bringt.

### P8 — Die Daedalus-Runde

Bedingungen **gleichzeitig** (`FactionInfo.tsx:141-145`): >= 30 **installierte** Augmentations,
>= $100e9, und (Hacking >= 2500 **oder** alle Kampfskills >= 1500). NeuroFlux Governor zaehlt als
**eine** Aug, egal wie viele Level (`AugmentationHelpers.ts:55-59`).

Dass 30 verschiedene Augs zusammenkommen, ist kein Problem: CyberSec 5 + NiteSec 5 +
Tian Di Hui 5 + Black Hand 3 + BitRunners 6 + Sector-12 2 + ENM-Kette 4 + Konzerne 6 + NFG = 36.
Ab hier werden auch billige Ein-Prozent-Augs wertvoll, weil sie den Zaehler erhoehen.

**Der Rep-Grind ist der teuerste Posten des ganzen BitNodes.** 2,5 Mio Rep bei Daedalus.
Rechnung (`reputation.ts:16-24`, gerechnet):

| Hacking | `faction_rep` | Favor | Rep/s | Zeit fuer 2,5e6 |
|---:|---:|---:|---:|---|
| 2500 | 1,00 | 0 | 12,8 | 54 h |
| 3000 | 1,90 | 0 | 29,2 | 23,8 h |
| 4000 | 1,90 | 0 | 39,0 | 17,8 h |
| 5000 | 1,90 | 0 | 48,7 | 14,3 h |
| 3000 | 1,90 | 150 | 73,1 | 9,5 h |

`faction_rep` 1,90 = S.N.A. 1,15 * ADR-V1 1,10 * ADR-V2 1,20 * SmartJaw 1,25 (gerechnet).

**Daraus zwei Regeln:**

1. **Hacking-Level erst hochtreiben, dann Rep farmen.** Von 2500 auf 5000 kostet bei
   Multiplikator 6 nur `e^((5000/6+200)/32) = 1,6e14` gegen `2,4e8` Exp — mit einer voll
   ausgebauten Farm Stunden, nicht Tage. Die Rep-Rate vervierfacht sich dabei.
2. **Zwei Wege zum Ziel, beide legitim:**
   - **Direktweg:** 2,5e6 Rep in einem Lauf durcharbeiten. Bei Hacking 5000 rund 14 Stunden.
   - **Favor-Weg:** in einem ersten Daedalus-Lauf nur 462.490 Rep sammeln (bei 39 Rep/s rund
     3,3 Stunden), **nicht** kaufen, installieren — die ungenutzte Rep wird zu 150 Favor
     (`src/Faction/Faction.ts:77-85`). Im naechsten Lauf entweder mit 2,5-facher Rate arbeiten
     (9,5 h) oder direkt spenden: 2,5e6 Rep kosten
     `2.5e6 * 1e6 / 1,90 = $1,32 Billionen` (`src/Faction/formulas/donation.ts:8-14`,
     `DonateMoneyToRepDivisor = 1e6`).

   **Empfehlung:** Direktweg, solange das Hacking-Einkommen unter etwa $100 Mio/s liegt.
   Darueber ist der Favor-Weg schneller, weil $1,32 Billionen dann in unter 4 Stunden verdient
   sind und die Wiederaufbaukosten des Zusatzlaufs kleiner sind als die eingesparten 14 Stunden.
   Der Favor-Weg kostet aber einen kompletten Wiederaufbau bis $100e9 und Hacking 2500.

**In derselben Runde** noch alles andere kaufen, was die Rep hergibt, dann installieren.
The Red Pill kostet **$0** — sie belegt also keinen Platz in der 1,9^k-Kostenkette und wird
zuletzt gekauft.

### P9 — Endspiel

Nach der Installation ist Hacking wieder 1 und alle Programme sind weg (siehe Abschnitt 7.4).
Zu tun:

1. Hacking auf 3000 treiben. Bei Multiplikator 6 sind das 3,2e9 Exp — mit der wieder
   aufgebauten Farm eine Frage von Stunden. (Beschleuniger direkt nach dem Reset: `weaken()`
   und `grow()` brauchen **kein** Hacking-Level, nur Root, und geben dieselbe Exp pro Thread wie
   ein erfolgreicher `hack()`. Also sofort alle Threads auf den 0-Port-Server mit der hoechsten
   `baseDifficulty` — `nectar-net` mit 20 gibt `3 + 0.3*20 = 9` Exp pro Thread und Durchlauf.)
2. Alle fuenf Portknacker beschaffen.
3. `connect`-Kette bis `The-Cave` (Hacking 925, 5 Ports, Netzebene 15). Der Server haengt seit
   der Red-Pill-Installation an `w0r1d_d43m0n` (`src/Prestige.ts:174-182`).
4. `connect w0r1d_d43m0n`, die fuenf Portknacker laufen lassen, `run NUKE.exe`, `backdoor`.

Die Backdoor-Dauer ist `hackTime/4` (`src/Terminal/Terminal.ts:240-242`). Fuer `w0r1d_d43m0n`
mit `hackDifficulty` 1 und `reqSkill` 3000 bei Hacking 3000:
`5*(2.5*3000*1+500)/3050 = 13,1 s`, Backdoor also **3,3 Sekunden**. Der letzte Schritt ist
trivial — der Weg dorthin ist alles.

---

## 4. Geldverwendung: Rangfolge mit Rechnung

### 4.1 Die Rangfolge

| Rang | Posten | Ab welchem Kontostand | Warum |
|---|---|---|---|
| 1 | **Gekaufte Server** | immer, sobald >= $440.000 (1 Server a 8 GB) | Einziges System mit konstantem Preis-Leistungs-Verhaeltnis ueber sechs Groessenordnungen |
| 2 | **TOR Router** | $200.000, sobald das nicht mehr weh tut | Tor zum Darkweb; ohne ihn kein Programmkauf |
| 3 | **Portknacker** | siehe Abschnitt 5 | Jeder Portknacker oeffnet neue Ziele und Faktionen |
| 4 | **Heim-RAM** | nur bis zum Bedarf des Orchestrators, ca. 128-512 GB | **Ueberlebt die Installation** — das ist der einzige Grund |
| 5 | **Augmentations** | in der Kaufrunde, teuerste zuerst | Multiplikatoren sind das Endziel |
| 6 | **Aktienmarkt** | ab ca. $25 Mrd freiem Kapital | Einziges multiplikatives System |
| — | **Hacknet** | nie mehr in diesem Spielstand | siehe Fallen |
| — | **Heim-Kerne** | nie in BN1 | $7,5 Mrd fuer den ersten, und `hack()` profitiert gar nicht davon |

### 4.2 Gekauftes RAM gegen Heim-RAM — die genaue Rechnung

Gekaufter Server: `Preis = ram * 55.000` (`src/Server/ServerPurchases.ts:23-41`, in BN1
faellt der Softcap-Term weg). Also **konstant $55.000 pro GB**, unabhaengig von der Groesse.

Heim-PC: `Kosten(ram → 2*ram) = 32.000 * ram^1,6601`
(`src/PersonObjects/Player/PlayerObjectServerMethods.ts:30-40`, umgeformt).
Preis je zusaetzlichem GB ist damit `32.000 * ram^0,6601`:

| Heim-Upgrade | Kosten | $ je zusaetzlichem GB | Faktor gegen $55.000 |
|---|---:|---:|---:|
| 8 → 16 GB | $1.009.744 | $126.218 | 2,3x teurer |
| 16 → 32 GB | $3.190.791 | $199.424 | 3,6x |
| 32 → 64 GB | $10.082.898 | $315.091 | 5,7x |
| 64 → 128 GB | $31.861.959 | $497.843 | 9,1x |
| 128 → 256 GB | $100.683.790 | $786.592 | 14,3x |
| 512 → 1024 GB | $1.005.388.057 | $1.963.648 | 35,7x |

(gerechnet)

**Heim-RAM ist also ab dem allerersten Upgrade teurer pro GB als ein gekaufter Server.**
(Die Angabe "ab ca. 64 GB ist gekauftes RAM billiger" in `formeln-wirtschaft.md` 1.4 bezieht
sich auf den Basissatz $32.000, nicht auf die tatsaechlichen Upgradekosten. Der Kreuzungspunkt
liegt rechnerisch bei 2,3 GB, also unterhalb des Startwerts von 8 GB.)

**Trotzdem Heim-RAM kaufen — aber nur aus drei Gruenden:**

1. **Es ueberlebt die Installation.** `prestigeHomeComputer` (`src/Server/ServerHelpers.ts:224`)
   setzt `programs`, `messages` und `serversOnNetwork` zurueck, aber **nicht** `maxRam` und
   **nicht** `cpuCores`. Gekaufte Server werden dagegen komplett geloescht
   (`src/Prestige.ts:75`, `prestigeAllServers`). Heim-RAM ist damit das einzige
   reset-feste Kapital im Spiel.
2. **Kerne.** `coreBonus = 1 + (cores-1)/16` wirkt auf `grow()` und `weaken()` des
   **ausfuehrenden** Hosts (`src/Server/ServerHelpers.ts:287,294`). Gekaufte Server haben immer
   1 Kern.
3. **Der Orchestrator braucht Platz.** Ein einzelnes Skript kann nie mehr als 1024 GB kosten
   (`src/Script/RamCalculations.ts:255`), aber Controller plus Tail-Fenster plus
   Contract-Loeser summieren sich.

**Konkrete Empfehlung:** Heim-RAM in jedem Lauf so weit hochziehen, wie die Verdopplung unter
etwa 5 % des aktuellen Vermoegens kostet, aber **nicht ueber 1024 GB hinaus**. Danach ist der
Faktor 36 gegenueber gekauftem RAM nicht mehr zu rechtfertigen. Und: **Restgeld unmittelbar vor
einer Installation immer in Heim-RAM stecken** — es ist der einzige Weg, Geld ueber den Reset
zu retten.

### 4.3 Die Serverleiter

Weil das Upgrade differenzpreisig ist, kann man ohne Verlust klein anfangen:

| Stufe | RAM je Server | Preis je Server | 25 Stueck | Gesamt-RAM |
|---|---:|---:|---:|---:|
| 1 | 8 GB | $440.000 | $11.000.000 | 200 GB |
| 2 | 64 GB | $3.520.000 | $88.000.000 | 1.600 GB |
| 3 | 512 GB | $28.160.000 | $704.000.000 | 12.800 GB |
| 4 | 4.096 GB | $225.280.000 | $5.632.000.000 | 102.400 GB |
| 5 | 32.768 GB | $1.802.240.000 | $45.056.000.000 | 819.200 GB |
| 6 | 262.144 GB | $14.417.920.000 | $360.448.000.000 | 6.553.600 GB |
| 7 (Max) | 1.048.576 GB | $57.671.680.000 | $1.441.792.000.000 | 26.214.400 GB |

(gerechnet aus `ram * 55.000`, Limits aus `src/Server/data/Constants.ts:12-13`)

**Regel fuers Skript:** immer alle 25 Slots belegt halten und die Stufe erhoehen, sobald
`25 * (Kosten der naechsten Stufe minus Kosten der aktuellen)` unter dem verfuegbaren Geld
liegt. `ns.cloud.getServerUpgradeCost(host, ram)` liefert den Differenzpreis direkt.

**Achtung API:** In v3.0.0 wurden alle Server-Kauffunktionen nach `ns.cloud.*` verschoben.
`ns.purchaseServer` und `ns.getPurchasedServers` sind **entfernt** und werfen einen
`REMOVED FUNCTION ERROR` (`doku/api-aenderungen-v3.md`).

### 4.4 Wann hoert RAM auf zu helfen?

Ein einzelner Zielserver liefert hoechstens rund `moneyMax / t_weaken` pro Sekunde, wenn man ihn
je Batch komplett leert — und Leeren ist RAM-ineffizient, weil die noetigen Grow-Threads mit
`-ln(1-f)` gehen (`formeln-hacking.md` 8.3). Praktisch saettigt sich ein Ziel deutlich frueher.

**Der skriptpruefbare Punkt:** wenn der Batcher ueber mehrere Minuten mehr als 20 % des
Netz-RAMs ungenutzt laesst, weil ihm die Zielserver ausgehen, bringt weiteres RAM nichts mehr.
Ab da wandert das Geld in den Aktienmarkt. **Das ist meine Herleitung, keine Spielkonstante** —
im Code steht kein Saettigungskriterium.

---

## 5. Port-Programme: kaufen oder schreiben?

### 5.1 Die Zahlen

Preise im Darkweb (`src/DarkWeb/DarkWebItems.ts`), Schreibbedingungen
(`src/Programs/Programs.ts`), alle direkt aus `reference/v301` gelesen:

| Programm | Kaufpreis | TOR noetig | Hacking zum Schreiben | Basiszeit |
|---|---:|---|---:|---:|
| `BruteSSH.exe` | $500.000 | ja | 50 | 10 min |
| `FTPCrack.exe` | $1.500.000 | ja | 100 | 30 min |
| `relaySMTP.exe` | $5.000.000 | ja | 250 | 2 h |
| `HTTPWorm.exe` | $30.000.000 | ja | 500 | 4 h |
| `SQLInject.exe` | $250.000.000 | ja | 750 | 8 h |
| `DeepscanV1.exe` | $500.000 | ja | 75 | 15 min |
| `DeepscanV2.exe` | $25.000.000 | ja | 400 | 2 h |
| `ServerProfiler.exe` | $500.000 | ja | 75 | 30 min |
| `AutoLink.exe` | $1.000.000 | ja | 25 | 15 min |
| `Formulas.exe` | $5.000.000.000 | ja | 1000 | 4 h |
| `DarkscapeNavigator.exe` | $50.000.000 | ja | nicht schreibbar | — |
| TOR Router selbst | $200.000 | — | — | — |

### 5.2 Die Zeitformel

`src/Work/CreateProgramWork.ts:58-74` (selbst gelesen):

```
skillMult = (hacking / reqLevel) * calculateIntelligenceBonus(int, 3)
skillMult = 1 + (skillMult - 1) / 5
skillMult = skillMult * focusPenalty          // 1 mit Fokus, sonst 0.8
Fortschritt pro Realsekunde = 1000 * skillMult Einheiten
```

**Tatsaechliche Dauer in Sekunden = Basiszeit_ms / (1000 * skillMult).**

In BN1 ohne SF5 ist Intelligence 0, der Int-Bonus also 1. Damit:

| Hacking / reqLevel | skillMult | Dauer als Anteil der Basiszeit |
|---:|---:|---:|
| 1,0 | 1,00 | 100 % |
| 1,5 | 1,10 | 91 % |
| 2,0 | 1,20 | 83 % |
| 3,0 | 1,40 | 71 % |
| 5,0 | 1,80 | 56 % |
| 10,0 | 2,80 | 36 % |

(gerechnet) Der Hebel ist also **schwach** — selbst mit zehnfachem Level dauert es noch ein
Drittel. Ein abgebrochener Auftrag wird als Datei `Name.exe-42.13%-INC` auf `home` gesichert und
spaeter fortgesetzt (`CreateProgramWork.ts:31-47`).

### 5.3 Die Entscheidung

Der entscheidende Punkt: **Programme schreiben blockiert nur den Spieler, nicht die Skripte.**
Die Hacking-Farm laeuft weiter. Die Opportunitaetskosten sind also genau das, was der Spieler
sonst getan haette — und das ist in der Fruehphase nichts.

**Regel:**

| Programm | Empfehlung | Begruendung |
|---|---|---|
| `BruteSSH.exe` | **schreiben**, wenn Vermoegen < $2 Mio; sonst kaufen | 10 min gegen $700.000 (TOR + Programm). Bei $200.000 Kontostand gibt es keine Wahl. |
| `FTPCrack.exe` | **schreiben** im ersten Lauf, ab Lauf 2 kaufen | 30 min gegen $1,5 Mio. Ab Lauf 2 ist $1,5 Mio in Sekunden verdient. |
| `relaySMTP.exe` | **kaufen** | 2 h gegen $5 Mio. Ab dem Zeitpunkt, an dem man Hacking 250 hat, ist $5 Mio trivial. |
| `HTTPWorm.exe` | **kaufen** | 4 h gegen $30 Mio. Klarer Fall. |
| `SQLInject.exe` | **kaufen** | 8 h gegen $250 Mio. Bei einer laufenden Farm sind $250 Mio Sekunden bis Minuten. |
| `DeepscanV1/V2`, `ServerProfiler`, `AutoLink` | **gar nicht** | Reine Komfortfunktionen fuer menschliche Terminalnutzung. Ein Skript benutzt `ns.scan()` und braucht keine davon. |
| `Formulas.exe` | kaufen, sobald $5 Mrd unter 5 % des Vermoegens liegt | `ns.formulas.hacking.growThreads` liefert die exakte Thread-Zahl inklusive additivem Term; `ns.growthAnalyze` tut das nicht (`formeln-hacking.md` 8.8). Bis dahin mit Sicherheitszuschlag arbeiten. |

**Ein Punkt, der leicht untergeht:** Ab dem zweiten Lauf hat man `BruteSSH.exe` gratis, wenn
das **CashRoot Starter Kit** installiert ist (Sector-12, 12.500 Rep, $125 Mio), und
`FTPCrack.exe` + `relaySMTP.exe` gratis mit **BitRunners Neurolink** (875.000 Rep, $4,375 Mrd).
Beide Programme werden bei jedem Prestige neu auf `home` gelegt (`src/Prestige.ts:85-92`,
selbst nachgelesen). Damit reduziert sich die Programmrechnung ab Lauf 3 auf
`HTTPWorm.exe` + `SQLInject.exe` = $280 Mio.

---

## 6. Augmentations

### 6.1 Die Kostenmechanik, die alles bestimmt

`src/Augmentation/AugmentationHelpers.ts:29-37, 127-161`:

```
moneyCost = baseCost * 1.9^(Anzahl bereits in dieser Runde gekaufter Nicht-SoA-Augs)
repCost   = baseRepRequirement                 // skaliert NICHT
```

`MultipleAugMultiplier = 1.9` (`src/Constants.ts:41`). Der Zaehler wird bei der Installation auf
null gesetzt — **ueber Installationen hinweg gibt es keine Preissteigerung.**

Zwei Folgerungen, die zwingend sind:

1. **Rep sammeln kostet nichts extra.** Man kann in Ruhe die hoechste noetige Rep erreichen und
   dann alles darunter mitnehmen. Die Rep wird beim Kauf **nicht verbraucht**
   (`src/Faction/FactionHelpers.tsx:109-131`).
2. **Immer die teuerste Augmentation zuerst kaufen, dann absteigend.**

Beispiel CyberSec, alle fuenf Augs (gerechnet):

| Reihenfolge | Gesamtkosten |
|---|---:|
| teuerste zuerst (CSP II → CSP I → BitWire → Synaptic → Neurotrainer I) | **$397.500.000** |
| billigste zuerst | **$2.163.000.000** |

Faktor **5,4** allein aus der Reihenfolge. Bei acht Augs kostet die letzte das 170-fache ihres
Basispreises.

### 6.2 Kaufreihenfolge einer Runde

1. **Rep-Multiplikatoren zuerst identifizieren**, aber nach Preis einsortieren: S.N.A. ($30 Mio),
   ADR-V1 ($17,5 Mio), ADR-V2 ($550 Mio), SmartJaw ($2,75 Mrd), The Shadow's Simulacrum
   ($400 Mio). Sie wirken erst nach der Installation, verbilligen aber jede folgende Runde
   massiv.
2. **Alle gewuenschten Augs nach Basispreis absteigend sortieren und in dieser Reihenfolge
   kaufen.**
3. **NeuroFlux Governor immer ganz zuletzt.** Jedes NFG-Level erhoeht den 1,9^k-Zaehler und
   verteuert damit alles danach. NFG gibt nur `1,000262 %` je Level
   (`Augmentations.ts:1170-1197`) — jedes Level, das den Kauf einer echten Aug verhindert, ist
   ein Verlust. Asymmetrie beachten: die **Rep**-Anforderung des NFG bekommt den 1,9^k-Faktor
   **nicht**, der Geldpreis schon (`AugmentationHelpers.ts:133-138`).
4. **The Red Pill kostet $0** und stoert die Kette nicht — trotzdem zuletzt kaufen, es aendert
   nichts.

### 6.3 Wann resetten? Die Faustregel mit Zahl

Der Reset kostet alle Skills, alles Geld, alle gekauften Server und alle Programme. Er behaelt
alle Multiplikatoren, alles Favor, das Heim-RAM und die Skripte auf `home`.

Der Wiederaufbau bis zum alten Level L wird um den Faktor

```
e^( L/32 * (1/m_alt - 1/m_neu) )
```

beschleunigt (hergeleitet aus `calculateExp`, `src/PersonObjects/formulas/skill.ts:17`).

Bei m_alt = 1 (gerechnet):

| Multiplikatorgewinn | Beschleunigung bei L=500 | bei L=1000 | bei L=2500 |
|---:|---:|---:|---:|
| 1,10 | 4,1x | 17x | 1.200x |
| 1,20 | 13,5x | 183x | 6,3e5x |
| **1,30** | **37x** | **1.355x** | **2,5e8x** |
| 1,50 | 183x | 3,3e4x | 3,1e11x |
| 2,00 | 2.470x | 6,1e6x | 3,5e16x |

**Faustregel: Resetten, sobald das Produkt der neu gekauften `hacking`-Level-Multiplikatoren
bei mindestens 1,30 liegt.** Bei 1,30 ist der Wiederaufbau bis Level 500 bereits 37-mal
schneller — der Verlust der laufenden Sitzung ist damit in Minuten wieder eingespielt. Unter
1,15 lohnt es nicht, weil ein Lauf-Neustart fuer den Automaten rund 30 bis 60 Minuten
Einrichtungsarbeit kostet (Programme, Serverfarm, Backdoors, Faktionsbeitritte).

**Drei Ausnahmen, in denen man trotz erfuellter Regel weiterspielt:**

1. Man steht kurz vor einem Faktions-Gate, das man in dieser Runde noch schafft (z. B. Hacking
   480 und BitRunners braucht 505-550).
2. Man steht kurz vor einer Rep-Schwelle, die eine teure Aug freischaltet. Ungenutzte Rep
   ist nicht verloren — sie wird beim Reset zu Favor (`src/Faction/Faction.ts:77-85`) — aber
   ein knapp verpasster Aug-Kauf verschiebt den Multiplikator um eine ganze Runde.
3. Man ist in der Daedalus-Runde. Dort gilt: erst Red Pill, dann Reset.

**Und eine Regel, die kein Kompromiss ist:** Ungenutzte Rep ist beim Reset **kein Verlust**.
462.490 kumulierte Rep bei einer Faktion werden zu 150 Favor, und ab 150 Favor darf man dort
spenden und braucht nie wieder Faction Work. Faktionen, bei denen man auf 150 Favor hinarbeitet,
sollte man in **jedem** Lauf mitnehmen.

### 6.4 Die wichtigsten Augmentations, nach Prioritaet

| Prioritaet | Aug | Faktion | Rep | Preis | Wirkung |
|---|---|---|---:|---:|---|
| 1 | S.N.A. | Tian Di Hui | 6.250 | $30 Mio | `faction_rep` 1,15 — beschleunigt alles Weitere |
| 2 | Cranial Signal Processors Gen V | BitRunners | 250.000 | $2,25 Mrd | `hacking` 1,30 (Prereq Gen I-IV) |
| 3 | Xanipher | NWO | 875.000 | $4,25 Mrd | alle Skills 1,20 **und** alle Exp 1,15 |
| 4 | nextSENS Gene Modification | Clarke Inc. | 437.500 | $1,925 Mrd | alle Skills 1,20 |
| 5 | OmniTek InfoLoad | OmniTek | 625.000 | $2,875 Mrd | `hacking` 1,20, `hacking_exp` 1,25 |
| 6 | Neuroreceptor Management Implant | Tian Di Hui | 75.000 | $550 Mio | hebt die Fokus-Strafe auf: +25 % auf jede Arbeit |
| 7 | BitRunners Neurolink | BitRunners | 875.000 | $4,375 Mrd | `hacking` 1,15 + gratis FTPCrack und relaySMTP je Install |
| 8 | CashRoot Starter Kit | Sector-12 | 12.500 | $125 Mio | $1 Mio + BruteSSH.exe je Install |
| 9 | SmartJaw | Bachman & Associates | 375.000 | $2,75 Mrd | `faction_rep` 1,25, `company_rep` 1,25 |
| 10 | ENM-Kette (Module → Core → V2 → V3) | diverse | 15k bis 1,75 Mio | $250 Mio bis $7,5 Mrd | zusammen `hacking` ~1,35 plus Speed und Money |
| — | **The Red Pill** | Daedalus | 2.500.000 | **$0** | schaltet `w0r1d_d43m0n` frei |

**QLink** (Illuminati, 1,875 Mio Rep, $25 Billionen, `hacking` 1,75 + `hacking_speed` 2,0 +
`hacking_chance` 2,5 + `hacking_money` 4,0) ist die staerkste Aug im Spiel, aber Illuminati
verlangt 30 Augs, $150e9, Hacking 1500 **und alle Kampfskills 1200**. Kampfskills auf 1200 zu
bringen ist ein Umweg von vielen Stunden Gym und Crime, der fuer BN1 nicht noetig ist.
**Empfehlung: QLink in BN1 auslassen.**

---

## 7. Was der Reset genau tut

Direkt aus `src/Prestige.ts:55-190` und `src/Server/ServerHelpers.ts:224` gelesen, weil das
mehrere Fallen enthaelt.

### 7.1 Bleibt erhalten

- Alle **installierten Augmentations** und damit alle Multiplikatoren.
- **Heim-RAM und Heim-Kerne** (`prestigeHomeComputer` fasst `maxRam` und `cpuCores` nicht an).
- **Alle Skripte auf `home`** (nur `programs`, `messages` und `serversOnNetwork` werden geleert).
- **Faction Favor und Company Favor**, frisch aufgestockt um die ungenutzte Rep.
- **Karma**, **NFG-Level**, **Source Files**.
- **Boersenzugaenge**: `hasWseAccount`, `hasTixApiAccess`, `has4SData`, `has4SDataTixApi` werden
  nur beim **BitNode**-Wechsel geloescht (`PlayerObjectGeneralMethods.ts:163-166`, in
  `prestigeSourceFile`), **nicht** bei der Aug-Installation.
- Einladungen von Faktionen mit `keepOnInstall`: die neun Megakonzerne und Fulcrum.

### 7.2 Ist weg

- Alle Skills auf 1, alle Exp auf 0.
- Geld auf **$1.262** (`1000 + CONSTANTS.Donations`).
- **Alle gekauften Server**, restlos.
- **Alle Programme auf `home` ausser `NUKE.exe`** (und `b1t_flum3.exe`). Zurueck kommen nur die,
  die eine installierte Aug mitbringt.
- Alle Faktionsmitgliedschaften, alle Rep, alle Jobs, alle Backdoors.
- Stadt zurueck nach Sector-12.
- **`DarkscapeNavigator.exe`** — es wird nur bei SF15 automatisch neu vergeben
  (`Prestige.ts:97-99`). Ohne SF15 muss man den DarkNet-Zugang **in jedem Lauf neu kaufen**.

### 7.3 Die stille Falle: der Aktienmarkt

`src/Prestige.ts:171` ruft in `prestigeAugmentation` unbedingt `initStockMarket()` auf. Diese
Funktion loescht alle `Stock`-Objekte und legt sie neu an, mit `playerShares = 0`
(`src/StockMarket/StockMarket.ts`, `src/StockMarket/Stock.ts:131-133`).

**Alle offenen Aktienpositionen werden bei der Installation ersatzlos vernichtet — ohne
Auszahlung.** Der Zugang bleibt, die Position nicht.

**Pflichtschritt vor jeder Installation: alle Positionen verkaufen.**

### 7.4 Checkliste vor jeder Installation

1. Alle Aktienpositionen verkaufen (`ns.stock.sellStock` fuer jedes Symbol mit `> 0` Shares).
2. Keine gekauften Server mehr aufruesten — das Geld ist verloren.
3. Augmentations kaufen, **teuerste zuerst**, NeuroFlux Governor zuletzt.
4. **Restgeld in Heim-RAM-Upgrades** — der einzige Posten, der den Reset ueberlebt.
5. Pruefen, ob eine Faktion knapp unter 462.490 kumulierter Rep steht; ein paar Minuten
   Nacharbeit koennen 150 Favor sichern.
6. Erst dann: Augmentations → **Install Augmentations**.

---

## 8. Aktienmarkt

### 8.1 Was ihn besonders macht

- **`ns.stock.getForecast()` ist exakt.** Der Rueckgabewert ist bitweise dieselbe Rechnung wie
  die interne Aufwaertswahrscheinlichkeit `chc` im Tick
  (`src/NetscriptFunctions/StockMarket.ts:238-247` gegen `src/StockMarket/StockMarket.ts:271-275`).
  Kein Schaetzwert, keine Verzoegerung.
- **Keine Preis-Slippage.** Der Kaufpreis ist streng `shares * askPrice`
  (`src/StockMarket/StockMarketHelpers.ts:28`), unabhaengig von der Menge. Grosse Kaeufe daempfen
  nur den Forecast, und zwar winzig: der Kauf von 1 Mio Aktien bei
  `shareTxForMovement = 50.000` verschiebt `otlkMag` um 0,12 Punkte.
- **Das einzige System mit echtem Zinseszins.** Alle anderen Systeme haben lineare oder
  gedeckelte Ertraege.

### 8.2 Was ihn begrenzt

- **Kosten:** WSE $200 Mio, TIX API $5 Mrd, 4S Market Data $1 Mrd, 4S Market Data TIX API
  $25 Mrd. Voller Ausbau **$31,2 Mrd** (`src/StockMarket/data/Constants.ts:3-12`).
- **In BN1 ohne SF8: keine Shorts, keine Limit-/Stop-Orders per Skript**
  (`src/NetscriptFunctions/StockMarket.ts:151-206`). Man kann nur long gehen und aussteigen.
- **Alle 75 Ticks (7,5 Minuten) kippt jede Aktie einzeln mit 45 % Wahrscheinlichkeit die
  Richtung** (`src/StockMarket/StockMarket.ts:219-232`). Eine stur haltende Strategie faengt das
  voll ein.
- **$100.000 Kommission je Transaktion**, also $200.000 je Roundtrip. Bei einer Position von
  $1 Mio sind das 20 % — toedlich. Erst ab rund $20 Mio je Position faellt es unter 1 %.
- **Positionen werden bei jeder Aug-Installation vernichtet** (siehe 7.3).

### 8.3 Wann lohnt der Einstieg? Die Rechnung

Um die Kosten K wieder hereinzuholen, braucht man bei Kapital C und Stundenfaktor g:
`T = K / (C * (g - 1))`.

Mit einem realistischen g = 1,3 (mv 0,9, Forecast 0,6, gerechnet aus
`formeln-wirtschaft.md` 3.2, dort als Obergrenze bei konstantem Forecast ausgewiesen):

| Kapital C | K = $5,2 Mrd (WSE+TIX) | K = $26 Mrd (4S komplett) |
|---:|---:|---:|
| $1 Mrd | 17,3 h | 87 h |
| $10 Mrd | 1,7 h | 8,7 h |
| $50 Mrd | 0,35 h | 1,7 h |
| $100 Mrd | 0,17 h | 0,87 h |

(gerechnet)

**Hinweis:** `formeln-wirtschaft.md` 3.4 schreibt, die $26 Mrd seien "bei $1 Mrd Kapital in
unter vier Stunden drin". Das ist rechnerisch nicht haltbar — $300 Mio/h mal 4 h sind $1,2 Mrd,
nicht $26 Mrd. Die Tabelle oben ist meine eigene Rechnung.

### 8.4 Empfehlung fuer BN1

**Der Aktienmarkt ist in BN1 optional.** Die $100 Mrd fuer Daedalus produziert eine gesaettigte
Hacking-Farm ohnehin. Sinnvoll wird er in genau zwei Faellen:

1. **Der Batcher ist gesaettigt** — mehr als 20 % des Netz-RAMs bleibt dauerhaft ungenutzt, weil
   die Zielserver ausgehen. Dann konvertiert RAM keine Dollar mehr in Einkommen, der
   Aktienmarkt schon.
2. **Man geht den Favor-Weg bei Daedalus** und braucht $1,32 Billionen fuer die Spende.

**Kaufschwellen (meine Herleitung):**

- **WSE Account + TIX API ($5,2 Mrd)** ab rund **$25 Mrd** freiem Kapital, also wenn es unter
  20 % des Vermoegens ausmacht.
- **4S Data + 4S TIX API ($26 Mrd)** ab rund **$130 Mrd** freiem Kapital. Das faellt bequem mit
  der Daedalus-Schwelle von $100 Mrd zusammen.

**Strategie ohne 4S** (zwischen TIX-Kauf und 4S-Kauf): Kurse ueber `ns.stock.getPrice()`
mitschreiben. Da alle Aktien pro Tick dasselbe `v` benutzen und nur die Richtung je Aktie
unabhaengig gezogen wird, ist die Tickrichtung ein sauberer Bernoulli-Zug mit Parameter `chc`.
Nach n = 100 beobachteten Ticks (10 Minuten) betraegt der Standardfehler des geschaetzten
Forecasts rund 5 Prozentpunkte. Das reicht fuer eine Long/Flat-Entscheidung mit Schwelle 0,60.

**Strategie mit 4S** (long only, ohne SF8):

1. Jeden Tick (alle 6 s) fuer alle 33 Symbole `getForecast()` und `getVolatility()` lesen.
2. Kaufen, wenn `forecast >= 0.60`. Positionsgroesse: Kapital gleichmaessig auf alle Kandidaten,
   aber **nie unter $20 Mio je Position** (sonst frisst die Kommission den Gewinn).
3. Verkaufen, sobald `forecast < 0.55`. Die Hysterese zwischen 0,60 und 0,55 verhindert
   Hin-und-Her-Handel, der bei $200.000 je Roundtrip teuer waere.
4. Bei gleichem Forecast die Aktie mit der hoeheren `mv` bevorzugen — die Log-Rendite pro Tick
   ist `(2f - 1) * ln(1 + av)` mit `E[av] = mv/200`, also naeherungsweise proportional zu `mv`.
5. `ns.stock.getMaxShares()` beachten: 20 % der Gesamtaktien je Symbol.

**Zusatzhebel:** `hack()` senkt und `grow()` hebt den Zweitforecast einer Aktie um 0,1 pro
erfolgreicher Aktion, wenn der `organizationName` des Servers einem Aktiennamen entspricht
(`src/StockMarket/PlayerInfluencing.ts:12-60`). Der Batcher kann seine Ziele also nach
Aktienposition sortieren. Das ist eine Feinoptimierung fuer den Schluss, kein Fundament.

---

## 9. Was der Browser-Automat klicken muss

### 9.0 Vorbedingung: `event.isTrusted`

**Das ist die wichtigste technische Einschraenkung.** Mehrere Buttons pruefen
`event.isTrusted` und tun bei synthetischen Klicks (`element.click()`, `dispatchEvent`)
**gar nichts**:

| Datei:Zeile | Knopf |
|---|---|
| `src/Faction/ui/FactionsRoot.tsx:89` | **`Join!`** (Faktion beitreten) |
| `src/Programs/ui/ProgramsRoot.tsx:96,108` | **`Create program`** / `Resume focus` |
| `src/Locations/ui/CompanyLocation.tsx:71` | **`Work`** (Firmenarbeit starten) |
| `src/Locations/ui/CompanyLocation.tsx:62` | `Infiltrate Company` |
| `src/Locations/ui/HospitalLocation.tsx:23` | Hospital heilen |
| `src/Locations/ui/SlumsLocation.tsx:25` | Crimes |

**Der Automat muss echte Eingabe-Events erzeugen** — CDP `Input.dispatchMouseEvent`,
Playwright/Puppeteer `page.click()`, oder ein entsprechender Treiber. Reines JavaScript im
Seitenkontext reicht fuer diese sechs Stellen nicht.

Nicht geschuetzt (synthetische Klicks funktionieren): TOR-Kauf, Travel, Job-Bewerbung,
Augmentation-Kauf, `Install Augmentations`, die Faction-Work-Optionen, Uni und Gym.

### 9.1 Einmalig: Optionen setzen

```
Sidebar > Help > Options
  Reiter "Interface":  "Disable ASCII art"                     -> AN
  Reiter "Gameplay":   "Suppress travel confirmations"         -> AN
  Reiter "Gameplay":   "Suppress faction invites"              -> AN
  Reiter "Gameplay":   "Suppress augmentations confirmation"   -> AN (optional)
```

Ohne "Disable ASCII art" sind die Locations auf der City-Seite nur einzelne Buchstaben mit
`aria-label` (`src/Locations/ui/City.tsx:47-65`); mit der Option sind es Buttons mit dem vollen
Namen (`City.tsx:137-148`). Dasselbe gilt fuer die Travel-Seite.

### 9.2 Backdoor auf einem Faktions-Server setzen

Beispiel `CSEC`. Der Pfad ist **pro Spielstand ausgewuerfelt** — jeder Server der Ebene n hat
genau einen zufaellig gezogenen Elternserver aus Ebene n-1
(`src/Server/ServerHelpers.ts:397-407`). Der Automat darf sich also **nie** einen festen Pfad
merken; das Skript ermittelt den Pfad mit `ns.scan()` und schreibt ihn in eine Datei, die der
Automat liest.

```
Sidebar > Hacking > Terminal
  connect <hop1>
  connect <hop2>
  ...
  connect CSEC
  run BruteSSH.exe          # so viele Portknacker wie noetig, siehe Servertabelle
  run NUKE.exe
  backdoor                  # dauert hackTime/4, danach Meldung "Backdoor on 'CSEC' successful!"
  home
```

Hinweise:
- Programmnamen sind **nicht** case-sensitiv (`src/Terminal/commands/runProgram.ts:11-15`).
- `backdoor` nimmt **keine** Argumente und braucht Root plus `hacking >= requiredHackingSkill`
  (`src/Terminal/commands/backdoor.ts:7-39`).
- Es gibt **keinen** Terminal-Befehl `nuke` — es ist `run NUKE.exe`.
- Erfolg pruefbar per Skript: `ns.getServer("CSEC").backdoorInstalled === true`.

Die vier Faktions-Server und ihre Anforderungen:

| Server | Faktion | Hacking | Ports |
|---|---|---:|---:|
| `CSEC` | CyberSec | 51-60 | 1 |
| `avmnite-02h` | NiteSec | 202-220 | 2 |
| `I.I.I.I` | The Black Hand | 340-365 | 3 |
| `run4theh111z` | BitRunners | 505-550 | 4 |
| `fulcrumassets` | Fulcrum Secret Technologies | 1100-1600 | 5 (plus Anstellung bei Fulcrum) |

### 9.3 Einer Faktion beitreten

```
Sidebar > Character > Factions
  Abschnitt "Faction Invitations"
  Knopf "Join!" neben dem gewuenschten Faktionsnamen        <- ECHTER Klick noetig
```

Erfolg pruefbar per Skript: `ns.getPlayer().factions.includes("CyberSec")`.

**Achtung:** In den Ost-Staedten stehen ab $20 Mio auch die Einladungen von Chongqing,
New Tokyo und Ishima in der Liste. **Nicht anklicken** — sie sperren Sector-12 und Aevum
dauerhaft (`src/Faction/FactionHelpers.tsx:44-46`).

### 9.4 Faction Work starten

```
Sidebar > Character > Factions
  Knopf "Details" neben der Faktion            -> Faction-Detailseite
  Knopf "Hacking Contracts"                    -> startet die Arbeit, springt auf die Work-Seite
```

Abbruch: auf der Work-Seite Knopf **`Stop Faction work`**.
Fuer Rep-Zwecke ist bei einem Hacker **immer** `Hacking Contracts` richtig — nur dort
multipliziert der Share-Bonus das gesamte Ergebnis, bei Security und Field nur den
`(hacking + intelligence)`-Anteil (`src/PersonObjects/formulas/reputation.ts:16-52`).

**Rep ablesen:** Der aktuelle Rep-Stand steht auf der Faction-Detailseite. Der Automat sollte
ihn nach jedem Besuch in eine Datei auf `home` schreiben, damit das Skript weiss, wann eine
Schwelle erreicht ist. Es gibt ohne SF4 keinen anderen Weg.

### 9.5 Programm selbst schreiben

```
Sidebar > Hacking > Create Program
  Kachel des gewuenschten Programms
  Knopf "Create program"                       <- ECHTER Klick noetig
```

Danach springt das Spiel auf die Work-Seite. Abbruch mit **`Stop creating program`**; der
Fortschritt wird als `BruteSSH.exe-42.13%-INC` auf `home` gesichert und beim naechsten Start
fortgesetzt.

Erfolg pruefbar: `ns.fileExists("BruteSSH.exe", "home")`.

### 9.6 TOR Router kaufen

```
Sidebar > World > City
  Location "Alpha Enterprises"                 (Sector-12; jeder TechVendor tut es)
  Knopf "Purchase TOR router - $200.000"
  Dialog wegklicken
  Knopf "Return to World"
```

Der Knopf zeigt danach `Purchase TOR router - Purchased`
(`src/Locations/ui/TorButton.tsx:44-49`). Weitere TechVendor: `ECorp`,
`Fulcrum Technologies`, `NetLink Technologies` (Aevum), `Omega Software`,
`Storm Technologies` (Ishima), `CompuTek`, `OmniTek Incorporated` (Volhaven).

Auf derselben Seite stehen `Purchase <n> Cloud Server - <Preis>` und
**`Upgrade 'home' RAM - <Preis>`** und `Upgrade 'home' cores - <Preis>`
(`src/Locations/ui/TechVendorLocation.tsx:52-68`, `RamButton.tsx:49-50`).
**Cloud Server nicht ueber die Oberflaeche kaufen** — jede Location hat nur eine kleine
RAM-Spanne (Alpha Enterprises: 2 bis 8 GB), und das Spiel sagt es selbst: "You can order bigger
cloud servers via scripts." Das erledigt `ns.cloud.purchaseServer`. Der einzige Knopf, den der
Automat hier ausser TOR braucht, ist `Upgrade 'home' RAM`.

### 9.7 Programme im Darkweb kaufen

```
Sidebar > Hacking > Terminal
  buy -l                    # Liste mit Preisen und [OWNED]-Markierung
  buy BruteSSH.exe
  buy FTPCrack.exe
  buy relaySMTP.exe
  buy HTTPWorm.exe
  buy SQLInject.exe
```

`buy -a` kauft alles Fehlende und bricht ab, sobald das Geld nicht reicht — fuer einen
Automaten unpraktisch, weil er dann nicht steuert, was er bekommt. Besser einzeln.
Man muss **nicht** auf `darkweb` verbunden sein (`src/DarkWeb/DarkWeb.tsx:20-21`), nur den TOR
Router besitzen.

### 9.8 Reisen

```
Sidebar > World > Travel
  Knopf "Travel to Ishima"                     ($200.000)
  ggf. Dialog "Travel" bestaetigen             (entfaellt bei "Suppress travel confirmations")
```

Erfolg pruefbar: `ns.getPlayer().city === "Ishima"`.

### 9.9 Job annehmen und arbeiten

```
Sidebar > World > City
  Location der Firma anklicken                 (z. B. "Clarke Incorporated" in Aevum)
  Knopf "Apply for Software Engineering Intern Job"
  Dialog wegklicken
  Knopf "Work"                                 <- ECHTER Klick noetig
```

Danach ist die Firma auch ueber `Sidebar > World > Job` direkt erreichbar. Abbruch auf der
Work-Seite mit **`Stop working`**.

Erfolg pruefbar: `ns.getPlayer().jobs` enthaelt die Firma.
**Firmen-Rep ist nicht skriptpruefbar** — der Automat liest sie von der Location-Seite ab.

**Positionswahl:** `Software Engineering Intern` genuegt. Voraussetzung ist
`hacking 1 + jobStatReqOffset`, also 250 bei ECorp/MegaCorp/NWO und 225 bei den uebrigen
Konzernen (`src/Company/data/CompaniesMetadata.ts`). Hoehere Positionen verdoppeln die
Rep-Rate hoechstens (repMult 0,9 gegen 2,0), verlangen aber Charisma 500 bis 750 — das lohnt in
BN1 nicht.

### 9.10 Augmentations kaufen

```
Sidebar > Character > Factions
  Knopf "Augments" neben der Faktion            -> Seite "Faction Augmentations - <Name>"
  Knopf "Sort by Cost"                          -> absteigend sortieren
  fuer jede gewuenschte Aug, TEUERSTE ZUERST:
    Knopf "Buy"
    Modal-Knopf "Purchase"                      (entfaellt bei "Suppress augmentations confirmation")
  Knopf "Back"
```

**Wichtig:** Der 1,9^k-Zaehler gilt ueber **alle** Faktionen hinweg innerhalb einer Kaufrunde.
Der Automat muss also erst alle gewuenschten Augs aus allen Faktionen sammeln, global nach
Basispreis absteigend sortieren, und dann faktionsweise abarbeiten — nicht Faktion fuer Faktion
durchkaufen.

Erfolg pruefbar nach der Installation: `ns.getResetInfo().ownedAugs`.

### 9.11 Installieren

```
1. Skript: alle Aktienpositionen verkaufen
2. Skript: Restgeld in Heim-RAM (kein UI-Klick noetig? doch:)
   Sidebar > World > City > "Alpha Enterprises" > Knopf "Upgrade 'home' RAM - <Preis>"
3. Sidebar > Character > Augmentations
   Knopf "Install Augmentations"
   Bestaetigungsdialog bestaetigen              (entfaellt bei "Suppress augmentations confirmation")
```

Nach dem Reset ist der Spieler in Sector-12, hat $1.262, Hacking 1 und nur `NUKE.exe`. Die
Skripte auf `home` sind noch da und muessen von der Terminal-Seite aus neu gestartet werden:

```
Sidebar > Hacking > Terminal
  run bootstrap.js
```

### 9.12 Boersenzugaenge kaufen

```
Sidebar > World > City
  Location "World Stock Exchange"               (in jeder Stadt vorhanden)
  Knopf "Buy WSE Account - $200.000.000"
  Knopf "Buy TIX API Access - $5.000.000.000"
  Knopf "Buy 4S Market Data Access - $1.000.000.000"
  Knopf "Buy 4S Market Data TIX API Access - $25.000.000.000"
```

Nach dem Kauf wird der Knopf durch Text mit Haken ersetzt (`WSE Account ✓`,
`TIX API Access ✓`, `4S Market Data UI Access ✓`, `4S Market Data TIX API Access ✓`) — das ist
der sauberste Zustandscheck fuer den Automaten. Reihenfolgezwang: 4S Data braucht WSE, 4S TIX
API braucht TIX API.

### 9.13 Der letzte Klick

```
Sidebar > Hacking > Terminal
  connect <hop1> ... connect The-Cave
  connect w0r1d_d43m0n
  run BruteSSH.exe
  run FTPCrack.exe
  run relaySMTP.exe
  run HTTPWorm.exe
  run SQLInject.exe
  run NUKE.exe
  backdoor
```

Danach springt das Spiel automatisch auf die BitVerse-Seite
(`src/Terminal/Terminal.ts:373-388`). BitNode 1 ist geschafft, es gibt Source File 1.

---

## 10. Fallen

Der Reihe nach das, was naheliegend aussieht und laut den Zahlen Verschwendung ist.

### 10.1 Hacknet weiter ausbauen

**Der Klassiker.** Beim aktuellen Stand (130 GB, $200.000) ist der Punkt bereits ueberschritten.

- Node Nr. 8 kostet $74.166 fuer +1,5 $/s → **13,7 Stunden** Amortisation.
- Node Nr. 10 kostet $253.832 fuer +1,5 $/s → **47 Stunden**.
- RAM-Upgrade 1→2 GB am frischen Node: $30.000 fuer +0,0525 $/s → **159 Stunden**.
- Cores-Upgrade 1→2: $500.000 fuer +0,25 $/s → **556 Stunden**.

(alles aus `formeln-wirtschaft.md` 2.1)

Die harte Grenze: ein **vollstaendig** ausgebauter Node bringt 9.171 $/s und kostet $408 Mio.
Ein ausgebautes Netz aus 12 Maximalnodes bringt 110.000 $/s bei $5,7 Mrd Investition. Dieselben
$5,7 Mrd in gekauftem RAM sind 102.400 GB — bei einem batchenden Setup Groessenordnungen mehr.

**Regel:** Hacknet nur, solange das Hacking-Einkommen unter **$82,5/s pro GB Netzspeicher**
liegt. Beim aktuellen Stand entspraeche das $10.700/s Gesamteinkommen.

### 10.2 Heim-Kerne kaufen

`1e9 * 7.5^cores` (`PlayerObjectServerMethods.ts:42-44`). Der erste zusaetzliche Kern kostet
**$7,5 Milliarden**. Der Bonus ist `1 + (cores-1)/16`, also **+6,25 %** auf `grow()` und
`weaken()` **des ausfuehrenden Hosts**. Auf `hack()` wirkt er gar nicht.
Dieselben $7,5 Mrd sind 136.364 GB gekauftes RAM. **Nie kaufen in BN1.**

### 10.3 Heim-RAM als Hauptquelle fuer RAM

Siehe 4.2: bereits das erste Upgrade (8→16 GB) ist mit $126.218 pro GB **2,3-mal teurer** als
ein gekaufter Server, bei 512→1024 GB sind es **35,7-mal**. Heim-RAM ist Reset-Versicherung und
Orchestrator-Platz, keine Rechenkapazitaet.

### 10.4 Augmentations in der falschen Reihenfolge kaufen

Der 1,9^k-Faktor gilt in der Kaufreihenfolge. CyberSec-Beispiel: **$397 Mio** gegen
**$2,16 Mrd** — Faktor 5,4 fuer dieselben fuenf Augs. Bei acht Augs kostet die letzte das
170-fache. **Immer global nach Basispreis absteigend sortieren, ueber alle Faktionen hinweg.**

### 10.5 NeuroFlux Governor zu frueh kaufen

Jedes NFG-Level erhoeht den 1,9^k-Zaehler fuer **alles danach** und gibt selbst nur
`+1,000262 %`. Ein NFG-Level, das den Kauf einer echten Aug verhindert, ist ein klarer Verlust.
**Immer zuletzt.**

### 10.6 Mit offenen Aktienpositionen installieren

`initStockMarket()` in `prestigeAugmentation` (`src/Prestige.ts:171`) legt alle `Stock`-Objekte
neu an. **Alle Positionen sind ersatzlos weg, ohne Auszahlung.** Der Zugang bleibt, das Geld
nicht.

### 10.7 Mit vollem Konto installieren

Geld wird auf **$1.262** gesetzt. Alles, was nicht in Augmentations oder Heim-RAM steckt, ist
verloren. Gekaufte Server werden ebenfalls geloescht — sie kurz vor dem Reset aufzuruesten ist
dasselbe wie Geld wegwerfen.

### 10.8 Eine falsche Stadtfaktion beitreten

Die Feindschaften sind endgueltig fuer den Lauf (`FactionHelpers.tsx:44-46`):

| Faktion | sperrt |
|---|---|
| Sector-12 | Chongqing, New Tokyo, Ishima, Volhaven |
| Aevum | Chongqing, New Tokyo, Ishima, Volhaven |
| Chongqing / New Tokyo / Ishima | Sector-12, Aevum, Volhaven |
| Volhaven | alle anderen fuenf |

**Vertraeglich: Sector-12 + Aevum.** Alles andere kostet den `CashRoot Starter Kit`.
Tian Di Hui ist keine Stadtfaktion und wird nicht gesperrt — man muss nur zum Beitritt in einer
der drei Ost-Staedte sein.

### 10.9 Reputation bei niedrigem Hacking-Level farmen

Die Rep-Rate ist **linear im Hacking-Level**. 18.750 Rep bei CyberSec kosten bei Hacking 100
zehn Stunden, bei Hacking 300 dreieinhalb. Da das Level nebenbei durch die Skripte steigt und
Faction Work den Spieler blockiert, ist es fast immer richtig, **erst zu leveln und dann zu
farmen** — solange man nicht auf eine Aug wartet, die selbst das Leveln beschleunigt.

Dieselbe Logik gilt fuer den Daedalus-Grind: von Hacking 2500 auf 5000 zu gehen kostet bei
Multiplikator 6 wenige Stunden und **vervierfacht** die Rep-Rate.

### 10.10 `fl1ght.exe` als Fortschrittsanzeige nehmen

`fl1ght.exe` verlangt Hacking >= 2500 **ohne** die Kampfskill-Alternative und ist **nicht** die
eigentliche Daedalus-Bedingung (`src/Programs/Programs.ts:324-353`,
`bitnode-und-server.md` 3.2). Die echte Bedingung ist
`30 installierte Augs UND $100e9 UND (hacking >= 2500 ODER Kampfskills >= 1500)`.

### 10.11 Auf Kampfskills, Crime oder Charisma setzen

- **Crime** ist bei $66.667/s hart gedeckelt (heist bei Maximalstats) und damit gegen jedes
  ernsthafte Hacking-Setup irrelevant. Sein Wert liegt im Karma — und Karma braucht man nur fuer
  eine Gang, die **SF2 voraussetzt**. In BN1 ohne SF2 ist Crime nach den ersten Minuten wertlos.
- **Kampfskills 1500** waeren die Alternative zu Hacking 2500 bei Daedalus, sind aber fuer einen
  Hacker ein Umweg von vielen Stunden.
- **Charisma** bringt in BN1 fast nichts: hoehere Firmenpositionen verdoppeln die Rep-Rate
  hoechstens, und das DarkNet (der einzige Ort, wo Charisma wirklich zaehlt) ist eine eigene
  Falle, siehe 10.13.

### 10.12 Universitaet und Gym fuer Erfahrung nutzen

Rothman University, Algorithms: $960/s fuer **8 Hacking-Exp/s** (nach `expMult` 2). Ein
Weaken-Worker auf einem Server mit `baseDifficulty` 20 gibt `3 + 0.3*20 = 9` Exp **pro Thread
und Durchlauf**. Mit 512 GB Heim-RAM sind das ueber 3.000 Threads. Die Universitaet ist um
Groessenordnungen unterlegen — und der Gratiskurs "Study Computer Science" gibt nur 1 Exp/s.

**Der bessere Trick direkt nach einem Reset:** `weaken()` und `grow()` brauchen **kein**
Hacking-Level, nur Root (`src/Hacking/netscriptCanHack.ts:49,53`), und geben dieselbe Exp pro
Thread wie ein erfolgreicher `hack()`. Also sofort alle Threads auf den 0-Port-Server mit der
hoechsten `baseDifficulty` (`nectar-net`, 20) legen, bis das Level fuer echtes Hacken reicht.

### 10.13 Das DarkNet in BN1 aufziehen

Es sieht extrem verlockend aus: fuer $30 Mio (Chongqing, "Shadowed Walkway") bekommt man eine
**deterministische** Kette von Gratis-Belohnungen im Wert von ueber $11,5 Mrd, darunter
`SQLInject.exe` ($250 Mio), `Formulas.exe` ($5 Mrd), WSE Account ($200 Mio), TIX API ($5 Mrd)
und 4S Market Data ($1 Mrd) (`src/DarkNet/effects/cacheFiles.ts:130-171`).

**Dagegen sprechen vier Dinge:**

1. **`DarkscapeNavigator.exe` ueberlebt die Installation nicht.** `prestigeHomeComputer` loescht
   alle Programme, und `Prestige.ts:97-99` vergibt den Navigator nur bei SF15 neu. Ohne SF15
   muss man den Zugang **in jedem Lauf** fuer $30 bis $50 Mio neu kaufen.
2. **Charisma ist der Engpass**, und Charisma bringt in BN1 sonst nichts. Phishing liefert bei
   Charisma 1000 nur $116/s je Thread.
3. **Automatisierungsaufwand:** 22 verschiedene Passwort-Minispiele, Netzmutation alle 1 bis
   10 Sekunden (laufende Skripte werden dabei gekillt), Webstorms loeschen 60 % der beweglichen
   Server auf einen Schlag.
4. **Ohne SF15 gibt es kein Labyrinth**, also auch nicht den alternativen Red-Pill-Weg
   (`src/DarkNet/effects/effects.ts:280`).

**Urteil: fuer den ersten BN1-Durchlauf auslassen.** Der Kauf lohnt erst, wenn der Automat
ohnehin einen Minispiel-Loeser hat und man SF15 besitzt.

Nebenbei: In v3.0.1 **verlangsamt** hohe Intelligence die Darknet-Authentifizierung, weil
`calculateIntelligenceBonus` dort multipliziert statt dividiert wird
(`src/DarkNet/effects/effects.ts:89`). Im dev-Branch ist das korrigiert — wer nach dev-Wissen
plant, schaetzt falsch.

### 10.14 Corporation, Bladeburner, Gang und Sleeves einplanen

Alle vier brauchen Source Files, die es nicht gibt:

| System | Voraussetzung in BN1 | Status |
|---|---|---|
| Gang | SF2 **und** Karma <= -54.000 (15 h homicide) | nicht verfuegbar |
| Corporation | SF3 fuer den Zugang, SF3 Level 3 fuer die Skript-API, $150 Mrd Eigenkapital | nicht verfuegbar |
| Sleeves | SF10 | **null Sleeves in BN1** |
| Bladeburner | SF6 oder SF7 | nicht verfuegbar |

### 10.15 Veraltete API-Namen benutzen

In v3.0.0 wurden Funktionen **entfernt**, nicht nur als veraltet markiert. Ein Aufruf bricht das
Skript mit einem Fehlerdialog ab. Betroffen sind unter anderem `ns.purchaseServer`,
`ns.getPurchasedServers`, `ns.getPurchasedServerCost`, `ns.tail`, `ns.nFormat`, `ns.formatNumber`
— neu: `ns.cloud.*`, `ns.ui.*`, `ns.format.*` (`doku/api-aenderungen-v3.md`). Fast alle
Skriptsammlungen aus dem Netz stammen aus der 2.x-Zeit und laufen nicht.

Zusaetzlich fehlen in v3.0.1 gegenueber dev: `ns.isFullPort` und `ns.isEmptyPort`. Fuer
Port-Kommunikation zwischen Controller und Workern muss man mit `peek()` gegen
`"NULL PORT DATA"` beziehungsweise mit den Rueckgabewerten von `tryWritePort()` arbeiten.

### 10.16 Server-Kennwerte hart eintragen

`moneyMax`, `minDifficulty`, `requiredHackingSkill`, `maxRam` und `cpuCores` werden bei jedem
BitNode-Start **einmalig ausgewuerfelt** (`src/Server/ServerHelpers.ts:350-380`). Auch die
Netztopologie ist jedes Mal neu: jeder Server bekommt genau einen zufaellig gezogenen
Elternserver aus der darueberliegenden Ebene. **Nie einen Pfad und nie einen Zahlenwert
speichern** — immer `ns.scan()` und `ns.getServerMaxMoney()` verwenden.

---

## 11. Annahmen und offene Punkte

Ausdruecklich gekennzeichnet, damit hier nichts geraten wird.

1. **Annahme:** Der geschaetzte Einrichtungsaufwand von 30 bis 60 Minuten je Lauf-Neustart
   (Programme, Serverfarm, Backdoors, Faktionsbeitritte) stammt aus keiner Quelle. Er begruendet
   die Untergrenze von 1,15 in der Reset-Regel; die Obergrenze 1,30 ist aus der
   Beschleunigungstabelle in 6.3 abgeleitet und damit belegt.
2. **Annahme:** Das Saettigungskriterium "mehr als 20 % des Netz-RAMs bleibt ungenutzt" ist meine
   Herleitung. Im Spielcode gibt es kein Saettigungskriterium und keinen optimalen `f`-Wert
   (`formeln-hacking.md` 9).
3. **Annahme:** Die Kaufschwellen fuer den Aktienmarkt ($25 Mrd fuer WSE+TIX, $130 Mrd fuer 4S)
   folgen aus meiner Amortisationsrechnung in 8.3 mit g = 1,3 pro Stunde. Der Wert g = 1,3 ist
   eine Obergrenze bei konstantem Forecast; real wandert `otlkMag` und kippt alle 7,5 Minuten
   mit 45 % Wahrscheinlichkeit. **Die realen Renditen liegen darunter, um wieviel steht nicht
   im Code.**
4. **Annahme:** Die Rep-Zeiten in P8 setzen durchgehende, fokussierte Faction Work ohne
   Unterbrechung voraus. Jede Unterbrechung durch den Automaten (Klicken, Kaufen, Reisen) kostet
   die entsprechende Zeit voll.
5. **Nicht geprueft:** Ob die Boersen-UI in BN1 ohne SF8 Short-Positionen anbietet. Die
   NS-API sperrt sie eindeutig (`src/NetscriptFunctions/StockMarket.ts:151-153`); die
   Render-Bedingung der UI habe ich nicht verfolgt. Fuer einen Skript-gesteuerten Handel ist das
   ohnehin irrelevant.
6. **Nicht geprueft:** Die genaue Untergrenze des passiven Rep-Gewinns. Die Formel ist
   `max(hRep*favorMult, sRep*favorMult, fRep*favorMult, 1/120)` pro Cycle
   (`src/Faction/FactionHelpers.tsx:132-170`); je nachdem, wie man `1/120` liest, sind das 30
   oder 150 Rep pro Stunde. In beiden Faellen gegenueber aktiver Arbeit vernachlaessigbar.
7. **Nicht geprueft:** Wo genau der Hacking-Level-Wurf der Backdoor-Server stattfindet. Die
   Spanne (51-60 fuer `CSEC` usw.) ist belegt, der konkrete Wert steht erst im laufenden
   Spielstand fest und muss mit `ns.getServerRequiredHackingLevel()` abgefragt werden.
8. **Coding Contracts** habe ich als Rep-Quelle geprueft und verworfen: die maximale
   Schwierigkeit ist `2 * Summe aller SF-Level + 1` (`src/CodingContract/ContractGenerator.ts:82-85`),
   in einem BN1-Erstlauf ohne Source Files also **1**. Der Rep-Ertrag ist damit
   `2500 * 1 * (1/3) = 833` Rep, bei rund 4,5 Contracts pro Stunde und nur einem von vier
   Belohnungstypen. Das ist gegenueber Faction Work Rauschen. Als **Geld**quelle im Fruehspiel
   sind Contracts dagegen brauchbar (`CodingContractBaseMoneyGain = 75e6`,
   `src/Constants.ts:93`) und per `ns.codingcontract.attempt` voll skriptbar.
