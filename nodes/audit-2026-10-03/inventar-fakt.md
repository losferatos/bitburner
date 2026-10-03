# Audit 03.10.2026 - Bereich FAKT: Faktionen und Firmen

Pruefer FAKT, Stand 03.10.2026 11:11 (Systemzeit). Grundlage: Spielquelle 3.0.2
(`reference/bitburner-src/src`), Bot `src/` (live, nicht geaendert), Spielstaende
`backups/*BN2L1*` (5,3 h BN2.1), `*BN12L3*`, `*BN9L3*`. Vorgaenger:
`nodes/audit-2026-09-26/3-progression.md` (V1/BN5-Sicht, A1-A9) - dort
Behandeltes wird hier nicht wiederholt.

Rechner (alle unter `tools/audit/`, Ausgabe unten unter "Rechnungen"):

- `fakt-augs.mjs` - Augmentierungskatalog aus `Augmentation/Augmentations.ts` geparst, V2-Mass je Stueck, je Faktion.
- `fakt-rep.mjs` - Favor, Faktionsarbeit, Firmenarbeit, Spende als Code; Eichung gegen BN12L3; BN2.1-Lage.
- `fakt-v2.mjs` - Wohin fliesst die Reputation im V2-Weg (BN2); Zyklus-Simulation mit und ohne Geldgrenze.
- `fakt-rang.mjs` - Rangwirkung zusaetzlicher Kampf-Augs mit dem vorhandenen Modell `tools/bbrank/sim.mjs`.

## Kurzfassung

- **Der Kernbefund ist BN2-spezifisch und neu:** In BN2 gibt es keine Passivreputation (`BitNode.tsx:581`), und bn4rep arbeitet im V2 nie fuer Faktionen (`src/bn4rep.js:496`, `:2475`). Die EINZIGE Quelle fuer Ruf ausserhalb der Bladeburners sind Coding Contracts, und die gehen nur an Faktionen mit Hacking-Arbeit, gleich verteilt (`PlayerObjectGeneralMethods.ts:514-537`). Gemessen BN2.1: 4.932 rep/h, verteilt auf 7 Faktionen, von denen 3 kein einziges offenes V2-Stueck mehr haben.
- **Beitrittspolitik ist V1-gebaut** (alle Einladungen annehmen, Sector-12 + Aevum fest, Netburners/CyberSec/BitRunners per Backdoor/Hacknet). Im V2 verduennt sie den Vertragsruf und sperrt ueber die Feindeslisten genau die drei Staedte mit eindeutigen V2-Stuecken (NutriGen, INFRARET, DermaForce). Gerechnet: naechster Einbau Kampfmultiplikator x1,26 (Ist) gegen x1,41 (nur Verduennung weg) bzw. x1,59-1,61 (plus Staedtewahl); Rangwirkung im Modell nahezu 1:1.
- **Hashes werden in BN2 fuer Geld verkauft** (1.357 Verkaeufe), "Generate Coding Contract" nie - in BN2 ist ein Vertrag Faktionsruf, nicht Geld. Frueheres Urteil (Audit 5, BAUSTELLEN :547) galt der V1-Geldsicht.
- **Speakers for the Dead / The Dark Army** scheitern an `numPeopleKilled` 0 (Kills setzt jeder Einbau auf 0, der Bot begeht im V2 keine Homicide). Erst relevant ab Kampfwerten 300.
- **FEHLER klein:** Spendenrechts- und Schwellenlogik behandelt die Bladeburners-Faktion wie eine spendenfaehige (belegt: BN9L3 `einbau.json` `spendenrechtFaellig: true` allein durch Bladeburners). **RISIKO BN8:** Begruendung fuer den Ausschluss von Fulcrum ist sachlich falsch (`bn4rep.js:232-238` gegen `FactionInfo.tsx:376-380`).
- **In Ordnung (gerechnet):** keine Firmenarbeit im V2 (300.000 Firmenruf = 26,6 h Spielerzeit in BN2), keine Sleeve-Faktionsarbeit im V2 (Schock ~100, Schockbonus ~0), Arbeitsart hacking vor security (Wendepunkt Kampfsumme > 4 x hack + 0,67 x int, BN2 jetzt 737 gegen 1.590), Spendenschwelle live (`getFavorToDonate`: BN3 75, BN8 0).

## 1. Feature-Inventar aus dem Quellcode

| # | Feature | Wo im Quellcode | Wirkt in welchen BN (Restroute 2,3,11,6,7,14,13,15,8) | Ertrag / Hebel |
|---|---|---|---|---|
| 1 | Einladung + Beitritt | `Faction/FactionInfo.tsx` inviteReqs je Faktion; `FactionHelpers.tsx:25-52`; `Singularity.ts:742-768` (checkFactionInvitations, joinFaction, +Int-Exp) | alle | Zugang zum Katalog; Beitritt bannt Feinde (`FactionHelpers.tsx:46`) |
| 2 | Feindschaften | `FactionInfo.tsx:498,508,520,530,540,552`; Bann bis zum Einbau (`Faction.ts:77-85` setzt isBanned zurueck) | alle | Sector-12+Aevum sperren Chongqing/NewTokyo/Ishima/Volhaven; Asien-Trio vertraeglich; Volhaven sperrt alle fuenf |
| 3 | Faktionsarbeit hacking/field/security | `PersonObjects/formulas/reputation.ts:16-52`; `Work/Formulas.ts:82-97`; `Work/FactionWork.tsx:37-39`; `Singularity.ts:770-855` | alle; FactionWorkRepGain BN2 0,5 (`BitNode.tsx:582`), BN13 0,6 (`:1018`), BN14 0,2 (`:1065`), BN12 1/1,02^n | rep/Zyklus = Basis/975 x faction_rep x intBonus x (1+Favor/100) x FWRG (x share bei hacking) |
| 4 | Fokus-Malus | `PlayerObjectGeneralMethods.ts:622-628`, `Constants.ts:87` (0,8), Ausnahme NMI | alle | x0,8 ohne Fokus (Firmen-Teilzeit ausgenommen, `CompanyWork.tsx:36`) |
| 5 | Passivruf | `FactionHelpers.tsx:132-170` | alle ausser BN2 (FactionPassiveRepGain 0, `BitNode.tsx:581`, Abbruch `:134`); in BN14 x0,2 ueber FWRG im Rechenweg | je Mitgliedsfaktion max(h,s,f-Rate) x min(0,1; Favor/1000+0,01) - NICHT verduennt durch weitere Mitgliedschaften |
| 6 | Favor | `Faction/formulas/favor.ts:12-24`; `Faction.ts:77-85` (beim Einbau); Knotenwechsel nullt (`Faction.ts:68-75`) | alle | Arbeitsrate x(1+Favor/100); Passiv 1 % -> 10 %; Spendenrecht |
| 7 | Spenden | `Faction/formulas/donation.ts:8-35`; `Singularity.ts:894-932` (offersWork-Pruefung `:907`) | Schwelle floor(150 x FavorToDonateToFaction): BN3 75 (`:611`), BN8 0 (`:776`), BN12 steigend, sonst 150 | rep = $/1e6 x faction_rep x FWRG; Bladeburners/Kirche/SoA nie (keine Arbeit) |
| 8 | Coding-Contract-Ruf | `PlayerObjectGeneralMethods.ts:501-557`; Typen `CodingContract/ContractGenerator.ts:179-189`; Takt `:16-66` (3 Versuche/10 min, ~25 %) | alle; CodingContractMoney 0 in BN8 nimmt nur den Geldtyp heraus | je Vertrag 2.500 x Schwierigkeit/3 (Mittel 4,23 -> 3.528) an Hacking-Arbeit-Faktionen: zufaellig EINE oder gleich verteilt; Firmentyp ohne Job -> Faktionsruf |
| 9 | Hash "Generate Coding Contract" | `Hacknet/data/HashUpgradesMetadata.tsx:108-114` (25 x Stufe), `HacknetHelpers.tsx:556-560`, Stufen beim Einbau 0 (`HashManager.ts:80-88`) | alle mit SF9 (vorhanden SF9.3) | zusaetzliche Vertraege -> Faktionsruf |
| 10 | Share-Bonus | `NetworkShare/Share.ts:46-60` | alle | x(1+ln(Faeden)/25) auf hacking-Ruf und den Hack-Anteil von security/field |
| 11 | Bladeburners-Faktion | `FactionInfo.tsx:698-713` (SF6/7 + Rang 25), Ruf aus Rang `Bladeburner/Formulas.ts:46-49`, `Bladeburner.ts:1276-1279`; Wiedereintritt beim Einbau `Bladeburner.ts:259-273` | V2-Knoten | 2 x Rangzuwachs x faction_rep x (1+Favor/100), OHNE FactionWorkRepGain; keine Spende, keine Passivrate (special) |
| 12 | Karma fuer Kriminelle | `Bladeburner.ts:964-969` (-1 je erfolgreicher Toetungsaktion), `:1043-1049` (Black Op -15) | V2 | Syndicate -90, Speakers/Dark Army -45 kommen im V2 gratis |
| 13 | Kills (numPeopleKilled) | `Work/CrimeWork.ts:72`, `Sleeve/Work/SleeveCrimeWork.ts:47`; Einbau nullt `PlayerObjectGeneralMethods.ts:83` | alle | Speakers 30 Kills (`FactionInfo.tsx:564-570`), Dark Army 5 Kills + Chongqing (`:581-589`) |
| 14 | Kampf-Faktionen | Syndicate `FactionInfo.tsx:601-621` (Kampf 200, Ort Aevum/S12), Speakers `:561-576` (Kampf 300), Dark Army `:578-599` (Kampf 300), Tetrads `:645-660`, Slum Snakes `:662-670` (beide OHNE Hacking-Arbeit) | V2 | reichste Kampf-Leitern unter 50k Ruf (Syndicate 14 V2-Stuecke bis 45k) |
| 15 | Firmenarbeit + Stellen | `Company/CompanyPosition.ts:156-172`; `Work/Formulas.ts:124-158`; `Company/data/CompanyPositionsMetadata.ts`; jobStatReqOffset `CompaniesMetadata.ts` | alle; CompanyWorkRepGain nur BN14 0,2 (`BitNode.tsx:1066`) | rep/Zyklus = Leistung x company_rep x (1+Firmenfavor/100) x CWRG; KEIN FWRG, kein share |
| 16 | Bewerbung/Befoerderung | `Singularity.ts:690-707`, `PlayerObjectGeneralMethods.ts:300-352` (klettert selbst, keine Stadtpruefung) | alle | - |
| 17 | Firmenfaktionen | `FactionInfo.tsx:182-386`, 400k Firmenruf `Constants.ts:25`, Rabatt x0,75 mit Backdoor auf dem Firmenserver `Company/utils.ts:15-19`, `Constants.ts:110`; Einladung ueberlebt Einbau `Prestige.ts:59-66,118-121`; Fulcrum braucht Job + Firmenruf + Backdoor fulcrumassets `:376-380` | alle | grosse Kataloge (KuaiGong 13, Blade 12 V2-Stuecke) |
| 18 | Firmenruf aus Vertraegen | `PlayerObjectGeneralMethods.ts:539-557` (4.000 x Schw./3 an zufaellige Firma aus jobs) | alle | nur mit Anstellung |
| 19 | Firmenfavor | Einbau (`Company.ts`), Hash "Company Favor" +5 (`HashUpgradesMetadata.tsx:115-121`), SF11-Lohn (`Work/Formulas.ts:131-132`) | alle / SF11 | Firmenarbeit x(1+Favor/100) |
| 20 | Sleeve-Faktionsarbeit | `Sleeve/Work/SleeveFactionWork.ts:35-37` (x Schockbonus `Sleeve.ts:173-175`) | alle | gleiche Formel, mal (100-Schock)/100 |
| 21 | Gang-Faktion als Augquelle | `FactionHelpers.tsx:172-206` (BN2: fast alle Augs + TRP, GangUniqueAugs), Ruf aus Respekt `Gang/Gang.ts:144-155` | BN2 voll; sonst GangUniqueAugs 0,1-0,75 | Gang-Bereich |
| 22 | Endspiel-Faktionen | Daedalus `FactionInfo.tsx:138-149` (Kampf 1500 als Alternative), Covenant `:151-180`, Illuminati `:118-136` | alle; Daedalus 35 in BN6/7, 20 in BN15 | V2: SPTN-97, Graphene Bone Lacings - Schwellen 850/1200 Kampf |
| 23 | Covenant-Sleeves | `Faction/ui/CovenantCampaign.tsx:49-63`, `SleeveCovenantPurchases.tsx:13-26` | NUR BN10 | nicht auf der Restroute |
| 24 | Kirche / Shadows of Anarchy | `FactionInfo.tsx:725-818` | SF13 / Infiltration | Stanek- bzw. Infiltrationsbereich |
| 25 | Silhouette | `FactionInfo.tsx:623-643` (CTO/CFO/CEO, Karma -22) | alle | keine V2-Stuecke (Parser) |
| 26 | Faction-/Company-Abfragen | `Singularity.ts:633-932` (getFactionRep/Favor/FavorGain/Enemies/WorkTypes/InviteRequirements, getCompanyRep/Favor/FavorGain/Positions/PositionInfo, quitJob) | alle | Information |

## 2. Abdeckungsmatrix

| Feature | Bot Datei:Zeile | BN/Phasen aktiv | Kategorie | Urteil |
|---|---|---|---|---|
| Einladungen annehmen | `src/bn4life.js:274-291` | alle, Normalbetrieb | GENUTZT-SUBOPTIMAL (V2/BN2) | nimmt jede an; in BN2 verduennt jede Hacking-Faktion ohne V2-Stueck den einzigen Rufzufluss -> **FAKT-1** |
| Staedtewahl / Feinde | `src/bn4life.js:289` (Liste fest), `:301-310` (Aevum-Reise) | alle | GENUTZT-SUBOPTIMAL (V2) | V1-Begruendung (Hack-Stuecke); im V2 haben S12/Aevum kein eigenes Kampfstueck -> **FAKT-2** |
| Hackergruppen-Backdoors | `src/bn4door.js:69-71` | alle | OPTIMAL (V1) / Teil FAKT-1 (BN2) | Einladung ist keine Beitrittspflicht; das Annehmen ist der Hebel |
| Beitrittslauf Slum Snakes/Tetrads/TDH, Netburners | `src/bn4life.js:226-244`, `src/joinrun.js` | alle, nach Einbau | GENUTZT-SUBOPTIMAL (BN2) | Slum Snakes/Tetrads bekommen in BN2 NIE Ruf (keine Hacking-Arbeit, kein Passiv), Netburners hat kein V2-Stueck; Gym-Konflikt durch PRIO geloest (blade 20 < beitritt 25) -> Teil FAKT-1 |
| Bladeburners-Faktion | `src/bn4life.js:276-291` (Einladung) | V2 | OPTIMAL | Einladung bei Rang 25 + SF6, binnen 30 s angenommen |
| Ruf aus Rang | (kein Bot-Code noetig) | V2 | OPTIMAL | - |
| Syndicate (Kampf 200) | `src/bn4life.js:276-291`; Ort durch `src/bbtrain.js:217` meist Sector-12 | V2 | OPTIMAL | Karma kommt aus Bladeburner gratis (-145 in BN2.1) |
| Speakers / Dark Army (Kills) | fehlt (bn4life-Verbrechen nur ausserhalb der Division, `src/bn4life.js:537`, `:582`, `:600`) | V2 | NICHT GENUTZT | **FAKT-4**, erst ab Kampf 300 |
| Faktionsarbeit Spieler V1 | `src/bn4rep.js:2425-2515` | V1 | OPTIMAL | Paket A erledigt |
| Faktionsarbeit Spieler V2 | `src/bn4rep.js:496`, `:2475` (gesperrt) | V2 | GENUTZT-SUBOPTIMAL? (Kandidat) | Begruendung stammt aus BN10 VOR dem Beitritt; grob gerechnet Gleichstand bis positiv nur fuer die Syndicate-Leiter -> **FAKT-5** (needs_calc) |
| Arbeitsart-Wahl | `src/bn4rep.js:2188-2198`, `:2452-2455` | V1 | OPTIMAL | feste Folge hacking>security>field; security gewinnt erst ab Kampfsumme > 4 x hack + 0,67 x int (BN2 jetzt 737 gegen 1.590). In V1 nie erreicht. Hinweis: Bot-Formel zaehlt cha bei security mit (Spiel nicht) - nur Rangfolge |
| Fokus zurueckholen | `src/bn4rep.js:2516-2580` | V1 | OPTIMAL | A1 erledigt |
| Sleeve-Faktionsarbeit | `src/sleeve.js:369`, `:508` (nur V1) | V1 | OPTIMAL (V2 bewusst nicht) | V2: Schock 93-100 in BN2.1 -> Schockbonus 0-0,07, Abbau 1,7/h gemessen; Ruf praktisch 0 |
| Passivrate in der Rangfolge | `src/bn4rep.js:2199-2203` | V1 | bekannt (A9) | nicht wiederholt |
| Favor-Einbau | `src/bn4rep.js:1112-1142` | alle | OPTIMAL (V1) / GENUTZT-SUBOPTIMAL (V2, klein) | im V2 misst `favorGewinn` die Arbeitsrate, die es nicht gibt; in BN2 hat Nicht-Bladeburner-Favor gar keinen Wert -> in **FAKT-6** |
| Spendenrecht / Schwellenziel | `src/bn4rep.js:1154-1167`, `:2279-2294` | alle | FEHLER (V2) | zaehlt Bladeburners, die nie Spenden annimmt -> **FAKT-6** |
| Spenden Hauptweg | `src/bn4rep.js:2398-2423` | alle | OPTIMAL | Schwelle live (`getFavorToDonate`), FWRG live (`src/lib/einbau.js:53-57`). BN8: Mindestspende 1 Mrd (`:2413`) laesst Ziele unter ~1.000 Ruf zur Arbeit - klein |
| NFG-Spende / Fuellstueck | `src/bn4rep.js:1655-1690`, `:1770-1806` | V1 | OPTIMAL | A2/A4 |
| Coding Contracts loesen | `src/contracts.js` (Registry `--loop 300`) | alle | OPTIMAL | 30 Typen (Audit 5) |
| Hash -> Coding Contract | `src/hashes.js` (verkauft; V2-Rang 5x) | BN2 | NICHT GENUTZT | **FAKT-3** |
| Firmenphase V1 | `src/bn4rep.js:251-252`, `:713-737`, `:1830-1945` | V1 | OPTIMAL | Audit 3: harmlos |
| Firmenarbeit V2 | (aus: `src/bn4rep.js:716`) | V2 | OPTIMAL (nicht nutzen) | BN2: IT Intern 11.265 rep/h -> 300k = 26,6 h Spielerzeit, ein ganzer BN2-Lauf |
| Firmenfaktion keepOnInstall | `src/bn4rep.js:725-736` | V1 | OPTIMAL | - |
| Backdoor-Rabatt Firmenserver | `src/bn4rep.js:266-278`, `src/bn4door.js:69-71` | V1 | OPTIMAL | - |
| Fulcrum | `src/bn4rep.js:232-238` (ausgeschlossen) | BN8 | RISIKO | Begruendung falsch -> **FAKT-7** |
| Befoerderung | `src/bn4rep.js:1872` (jede Runde applyToCompany) | V1 | OPTIMAL | CompanyWork liest Player.jobs je Zyklus |
| Kuendigen ohne Phase | `src/bn4rep.js:749-754` | alle | OPTIMAL | haelt Vertrags-Firmenruf als Faktionsruf |
| Firmenfavor (Einbau, Hash, SF11) | - | - | NICHT ANWENDBAR | keine Firmenarbeit im V2; SF11-Lohn ohne Belang |
| Silhouette | - | - | NICHT ANWENDBAR | 0 V2-Stuecke |
| Daedalus | `src/joinrun.js` (Schwelle), `src/bn4rep.js` (A3/H2) | V1 | OPTIMAL | V2 nicht noetig |
| Covenant / Illuminati | - | - | NICHT ANWENDBAR | Kampf 850/1200 im V2 nie erreicht (BN9L3 Ende 184-279) |
| Covenant-Sleeves | - | - | NICHT ANWENDBAR | nur BN10 |
| Gang-Faktion | - | BN2 | NICHT GENUTZT | Gang-Bereich (Querverweis; BRIEFING nennt es) |
| Kirche / SoA / Infiltration | - | - | NICHT ANWENDBAR (hier) | andere Bereiche |
| ns.formulas.reputation/work | eigene Formeln `src/bn4rep.js:2199-2218` | alle | OPTIMAL | Favor/Firma hier geeicht |
| getFactionEnemies / InviteRequirements | fest verdrahtet | alle | OPTIMAL | Feindeslisten stimmen |

Zaehlung (36 Zeilen): OPTIMAL 20, GENUTZT-SUBOPTIMAL 8 (inkl. FEHLER FAKT-6, RISIKO FAKT-7, Kandidat FAKT-5 und das bekannte A9), NICHT GENUTZT 3, TOT 0, NICHT ANWENDBAR 5.

## 3. Befunde

### FAKT-1 (SUBOPTIMAL, P2) - V2/BN2: Beitrittspolitik verduennt die einzige Rufquelle

- **Bot:** `src/bn4life.js:274-291` nimmt jede Einladung an (ausser vier Staedten); `src/bn4door.js:69-71` erzeugt Einladungen fuer CyberSec, NiteSec, The Black Hand, BitRunners; `src/bn4life.js:226-244` startet nach jedem Einbau joinrun (Slum Snakes, Tetrads, Tian Di Hui) und netburn (Netburners); `src/bn4life.js:301-310` reist nach Aevum. Kein Zweig fragt `data/verfahren.txt` oder den Knoten.
- **Spiel:** BN2 `FactionPassiveRepGain: 0` (`BitNode.tsx:581`, Abbruch `FactionHelpers.tsx:134`); im V2 keine Faktionsarbeit (`src/bn4rep.js:496`, `:2475`), keine Sleeve-Faktionsarbeit (`src/sleeve.js:508`), keine Infiltration. Vertragsruf geht nur an `offerHackingWork`-Faktionen (`PlayerObjectGeneralMethods.ts:515`, `:525`), Erwartungswert je Faktion = Zufluss / Anzahl. Slum Snakes und Tetrads bieten keine Hacking-Arbeit (`FactionInfo.tsx:662-670`, `:645-660`) - sie bekommen in BN2 NIE Ruf.
- **Gemessen (BN2.1, `fakt-rep.mjs`/`fakt-v2.mjs`):** 26.085 Ruf in 5,29 h = 4.932 rep/h auf 7 Hacking-Faktionen. Aevum, CyberSec, Netburners haben kein offenes V2-Stueck mehr (Neurotrainer I und Wired Reflexes liegen in der Warteschlange) -> **43 %** des Vertragsrufs ohne V2-Wert.
- **Gerechnet (naechster 12-h-Zyklus, Geldgrenze 35 Mrd, Bladeburners-Ruf 13.000):** Ist 4 Stuecke, Kampfmass ln 0,232 (x1,26). Nur Faktionen mit offenen V2-Stuecken (S12, NiteSec, TDH): 6 Stuecke, ln 0,347 (x1,41). Rangwirkung im Bladeburner-Modell (`fakt-rang.mjs`): Kampfwerte x1,40 -> Rang x1,41 in 10 h, also Elastizitaet ~1. **Ertrag: ~+12 % Rang/h nach dem naechsten Einbau**; bei 10-16 h Restlauf nach dem ersten Einbau eines BN2-Laufs (Roadmap 22-29 h je Lauf) **~1,1-1,7 h je Lauf**, mit Syndicate ab Zyklusbeginn deutlich mehr (ln 0,232 -> 0,542).
- **Betroffen:** BN2.1-2.3 voll; BN14.1-3 fast genauso (FactionWorkRepGain 0,2 drueckt auch die Passivrate, `reputation.ts:8-14` steckt im Passivweg; Vertragsruf ist ungedaempft). In den Passiv-Knoten (3, 11, 6, 7, 13, 15) NICHT uebertragen: dort bringt jede Mitgliedschaft eigenen, unverduennten Passivruf.
- **Fix:** Im V2 und wenn `getBitNodeMultipliers().FactionPassiveRepGain === 0` (oder FactionWorkRepGain <= 0,2): eine Einladung nur annehmen, wenn die Faktion ein unbesessenes Stueck mit `kampfknotenNuetzlich` hat (oder Bladeburners ist). Die Einladung verfaellt nicht vor dem Einbau, das Ablehnen ist also umkehrbar. joinrun/netburn in diesem Fall nicht starten.

### FAKT-2 (SUBOPTIMAL, P3) - V2: Staedtewahl fest Sector-12 + Aevum

- **Bot:** `src/bn4life.js:289` schliesst Chongqing, New Tokyo, Ishima, Volhaven immer aus; `:301-310` reist nach Aevum ("drei Augmentierungen mit Hacking-Multiplikator").
- **Spiel:** Feindeslisten `FactionInfo.tsx:498-552`. V2-Stuecke nur in dieser Stadt (`fakt-v2.mjs`): Sector-12 0, Aevum 0, New Tokyo NutriGen Implant (6,25k, Kampf-Erfahrung x1,2 -> Wiederaufbau nach jedem Einbau -16,7 %), Ishima INFRARET (7,5k), Volhaven DermaForce (15k, def x1,4).
- **Gerechnet (ohne Syndicate, Geldgrenze):** S12/NiteSec/TDH ln 0,347 gegen New Tokyo/Ishima/NiteSec/TDH ln 0,464 bzw. Volhaven/NiteSec/TDH ln 0,475 -> **weitere ~+12-13 % Rang/h** nach dem Einbau (Modell-Elastizitaet 1). Der Wiederaufbau-Effekt von NutriGen ist im Kampfmass nur halb gewichtet.
- **Betroffen:** alle V2-Knoten (in den Passiv-Knoten fliesst der Ruf dieser Staedte zusaetzlich passiv).
- **Fix:** Im V2 die Stadtliste aus dem V2-Katalog waehlen (Asien-Trio oder Volhaven), Aevum-Reise nur im V1. Tetrads/TDH/Dark Army verlangen nur den Aufenthalt, nicht die Mitgliedschaft; Syndicate nur Aufenthalt in Aevum/S12 (bbtrain reist ohnehin nach Sector-12).

### FAKT-3 (NICHT_GENUTZT, P3) - BN2: Hashes als Vertragsquelle statt Verkauf

- **Bot:** `src/hashes.js` verkauft im V2 (BN2.1: "Sell for Money" 1.357, "Exchange for Bladeburner Rank" 5, "Generate Coding Contract" 0 - Spielstand 09:59).
- **Spiel:** `HashUpgradesMetadata.tsx:108-114` (25 x Stufe Hashes), `HacknetHelpers.tsx:556-560`, Stufen je Zyklus zurueck (`HashManager.ts:80-88`).
- **Gerechnet:** BN2.1 ~1.700 Hashes/h -> 39 Vertraege je 12 h -> +42.800 Ruf (mit der gemessenen Ausbeute 41 % der Formel), Zufluss 4.932 -> 8.500 rep/h. Mit der heutigen Beitrittspolitik: ln 0,232 -> 0,347 (dieselben +12 % wie FAKT-1), Preis 5 Mrd Verkaufserloes. Bei bereinigter Beitrittspolitik in 12 h kein Zusatzstueck (naechste Leiterstufen zu weit) - beide Hebel ersetzen sich teilweise.
- **known_before:** `nodes/audit-2026-09-26/5-nebensysteme.md:120` und `nodes/BAUSTELLEN.md:547` bewerteten den Vertrag als GELDquelle (V1). In BN2 ist er die einzige Nicht-Bladeburner-Rufquelle; neue Bewertung.
- **Offen:** Vergleich mit "Exchange for Bladeburner Rank" (250 x Stufe je 100 Rang) gehoert in den Hash-Bereich - needs_calc.

### FAKT-4 (NICHT_GENUTZT, P3) - Kills fuer Speakers for the Dead und The Dark Army

- **Bot:** Homicide nur in `src/bn4life.js:537` und nur ausserhalb der Division (`:582`); im V2 nach dem Beitritt nie. `numPeopleKilled` in allen BN2-Sicherungen 0 (auch BN9L3 Ende 0).
- **Spiel:** Speakers 30 Kills, Dark Army 5 Kills + Aufenthalt Chongqing, beide Kampf 300 (`FactionInfo.tsx:564-570`, `:581-589`); Kills nur aus Verbrechen (`CrimeWork.ts:72`, `SleeveCrimeWork.ts:47`), Einbau nullt (`PlayerObjectGeneralMethods.ts:83`). Bladeburner zaehlt keine Kills, senkt aber Karma (`Bladeburner.ts:964-969`) - Karma ist also schon da.
- **Kosten:** Homicide 3 s, bei Kampf ~190 Erfolg gedeckelt 1 -> 30 Kills ~90 s Spielerzeit oder ein Sleeve.
- **Gerechnet:** Dark Army zusaetzlich zur Syndicate-Konzentration ln 0,542 -> 0,607 (+0,065, ~+7 % Rang/h); beide haben Hacking-Arbeit, nehmen also Vertragsruf auf. Kampf 300 war in BN9L3 nie ganz erreicht (Ende 184/202/279/222), in BN2 (StrengthLevelMultiplier 1) offen -> erst messen, ob 300 im Zyklus faellt.

### FAKT-5 (SUBOPTIMAL-Kandidat, P3, needs_calc) - V2: Spieler-Faktionsarbeit pauschal gesperrt

- **Bot:** `src/bn4rep.js:493-496` ("In einem Kampfknoten wird also gar nicht mehr fuer Faktionen gearbeitet - weder vor noch nach dem Beitritt"), `:2475`. Die Begruendung zitiert BN10 VOR dem Beitritt (Gym-Exp 22/min statt 230/min); ENTSCHIEDEN deckt nur "Augmentierungsrunde vor Tor 1" ab, nicht die Zeit nach dem Beitritt.
- **Gerechnet (grob):** BN2 hacking-Arbeit 5.669 rep/h (fokussiert, Favor 0) - mehr als der gesamte Vertragszufluss. 3 h fuer die naechste Leiterstufe (z. B. Nanofiber 37,5k bei TDH) kosten ~1.200 Rang (Modell ~360-400 Rang/h jetzt) und bringen +9,5 % Rang/h nach dem Einbau (~500-1.500 Rang je nach spaeterer Rate) - Gleichstand. Fuer die Syndicate-Leiter (14 Stuecke bis 45k, ln 0,83) positiver, aber geldbegrenzt.
- **Spezifikation:** siehe Rechnungen, needs_calc.

### FAKT-6 (FEHLER, P3) - Spendenrecht- und Favor-Logik ohne Blick auf Spendenfaehigkeit und V2

- **Bot:** `src/bn4rep.js:1157-1166` (`spendenFaktion`) und `:2279-2294` (Schwellenziele) zaehlen jede Mitgliedsfaktion, auch Bladeburners; `:1128-1141` (`favorGewinn`) misst (1+Favor/100) der Arbeitsrate.
- **Spiel:** Bladeburners bietet keine Arbeit -> `donateToFaction` lehnt ab (`Singularity.ts:907`); Favor wirkt dort nur ueber `Bladeburner/Formulas.ts:46-49` (ohne Schwelle 150). In BN2 hat Favor anderer Faktionen keinen Wert (kein Passiv, keine Arbeit); in Passiv-V2-Knoten wirkt Favor ueber min(0,1; F/1000+0,01), nicht ueber (1+F/100).
- **Belegt:** BN9L3 pre-jump 24.09. 16:25, `data/einbau.json` auf home: `spendenrechtFaellig: true, spendenAusnahme: true`; einzige Faktion ueber 462.490 kumuliertem Ruf war Bladeburners (3.092.444); alle anderen 2.997-159.966 (`fakt-rep.mjs`-Rechnung im Bericht).
- **Folge:** ein falscher Einbaugrund (im V2 meist durch andere ODER-Gruende verdeckt und durch `kampfEinbauSperre` gebremst), falscher Grundtext, und ab Favor >= 150 bei Bladeburners versucht der Spendenweg (`:2398-2414`) jede Runde eine Spende, die nie angenommen wird. Klein.
- **Fix:** Faktionen ohne `getFactionWorkTypes(f).length` aus Spendenrecht/Schwellenziel/Spendenweg nehmen; im V2 den Favorgewinn ueber die Passivformel bzw. fuer Bladeburners ohne Schwelle rechnen.

### FAKT-7 (RISIKO, P3) - Fulcrum mit falscher Begruendung ausgeschlossen (BN8)

- **Bot:** `src/bn4rep.js:232-238`: "die Faktion verlangt ohnehin keine Firmenreputation, sondern eine Backdoor auf fulcrumassets"; COMPANIES `:251-252` ohne Fulcrum; `src/bn4door.js:69` setzt die Backdoor trotzdem.
- **Spiel:** `FactionInfo.tsx:376-380`: Anstellung bei Fulcrum Technologies UND 400k Firmenruf (300k mit Backdoor auf fulcrumtech) UND Backdoor fulcrumassets. Einziges nur dort erhaeltliches Stueck: PC Direct-Neural Interface NeuroNet Injector (hacking x1,1, 1,5 Mio Ruf; `fakt-augs.mjs`).
- **Folge:** nur V1, also BN8.1-8.3 (und der V1b-Hinweis BN15): ein x1,1-Hackingstueck fehlt; in BN8 ist Ruf eine Geldfrage ab Favor 0, das Stueck kostet ~1,5 Bio $ Spende. Ertrag klein (GESCHAETZT < 0,5 h je Lauf); vor BN8 die Begruendung korrigieren.

## 4. Rechnungen mit Eichung

### 4.1 Favor (favor.ts) - GEEICHT

`node tools/audit/fakt-rep.mjs`, Paare pre-install -> naechste Sicherung (BN12L3):

| Faktion | Favor vorher | Ruf vorher | Formel | Spielstand | Abw |
|---|---|---|---|---|---|
| The Black Hand | 46,9057 | 68.008,9 | 83,7567 | 83,7694 | 0,0127 |
| BitRunners | 41,5819 | 293.072,9 | 133,2724 | 133,2932 | 0,0207 |
| Sector-12 | 59,4441 | 0 | 59,4441 | 59,4441 | 0 |
| CyberSec | 112,7132 | 49.420,2 | 122,4282 | 122,4320 | 0,0038 |

Die Restabweichung ist Ruf, der zwischen Sicherung und Einbau noch hinzukam (immer positiv).

### 4.2 Firmenarbeit (Work/Formulas.ts:124-158) - GEEICHT

Clarke Incorporated, BN12L3 04:33, IT Intern, 5 Zyklen, Favor 31,8041, hack 5347, int 153, cha 4, company_rep 5,5118, CompanyWorkRepGain 1 (BN12 setzt es nicht): Formel 33,4138/Zyklus x 5 = 167,07, Spielstand 166,71 (**-0,22 %**).

### 4.3 Faktionsarbeit hacking (reputation.ts:16-24) - GERECHNET_UNGEEICHT

Zwei Stundenpaare mit durchgehender Arbeit (BN12L3): implizierter share-Bonus 1,620 (Black Hand) und 1,394 (BitRunners) - nicht deckungsgleich, weil Vertragsruf und Levelanstieg im Intervall liegen. Die Formel ist identisch mit der in Audit 3 und sleeve.js benutzten (dort share 1,27-1,29). Fuer die Befunde zaehlt nur das Verhaeltnis der Arbeitsarten und Firma/Faktion, das vom share-Bonus nur bei hacking abhaengt.

### 4.4 BN2.1-Lage (Sicherung 03.10. 09:59)

hack 372, str/def/dex/agi 194/181/181/181, cha 57, int 153, faction_rep = company_rep 1,3281:

- Faktionsarbeit hacking 5.669 / security 3.383 / field 2.893 rep/h (Favor 0, fokussiert, share 1, FWRG 0,5).
- Firmenarbeit IT Intern 11.265 / IT Analyst 12.510 / Security Guard 8.031 rep/h (CWRG 1) - Firma bringt in BN2 das Doppelte, aber 300.000 Firmenruf = 26,6 h.
- Vertragsruf gemessen: 26.085 in 5,29 h = 4.932 rep/h. Formel-Erwartung: 4,5 Vertraege/h (`ContractGenerator.ts:16-66`) x 0,75 x 2.500 x 4,23/3 = 11.900 rep/h - gemessen 41 % davon (Streuung, Fehlschlaege oder Loeser-Takt; offen).

### 4.5 Zyklus-Simulation (fakt-v2.mjs) - GESCHAETZT

Annahmen offen: Zufluss 4.932 rep/h gleich verteilt; Mitgliedschaft ab Zyklusbeginn; Geld 35 Mrd/12 h (BN2.1 ~3 Mrd/h); Bladeburners-Ruf am Zyklusende 13.000; Kauf gierig nach Wert je Dollar, Preis x1,9 je Kauf.

| Szenario (12 h, mit Geldgrenze) | Stuecke | ln Kampfmass | Faktor |
|---|---|---|---|
| Ist (7 Hacking-Faktionen) | 4 (3 BB) | 0,232 | x1,26 |
| S12, NiteSec, TDH | 6 | 0,347 | x1,41 |
| New Tokyo, Ishima, NiteSec, TDH | 8 | 0,464 | x1,59 |
| Volhaven, NiteSec, TDH | 7 | 0,475 | x1,61 |
| S12, NiteSec, TDH, Syndicate | 9 | 0,542 | x1,72 |
| Syndicate, Dark Army, NiteSec | 10 | 0,607 | x1,84 |

### 4.6 Rangwirkung (fakt-rang.mjs mit tools/bbrank/sim.mjs) - GERECHNET_UNGEEICHT

- Gegenprobe 08:33 -> 09:59 BN2.1: Modell +383 Rang, real +474 (-19 %; die Sleeve-Vertraege fehlen im Modell).
- 10 h ab 09:59: Kampfwerte x1,00 -> +3.586 Rang; x1,40 -> +5.071 (x1,41); x1,75 -> +6.289 (x1,75). Elastizitaet ~1,0.

## 5. Geprueft, in Ordnung

- Bladeburners-Ruf haengt nicht an FactionWorkRepGain (`Bladeburner/Formulas.ts:46-49`); Beitritt ueber die normale Einladung (SF6 vorhanden) wird von bn4life angenommen.
- Syndicate: Karma -90 kommt im V2 aus den Toetungsaktionen (BN2.1 -145), Ort Sector-12 durch bbtrain; tritt bei Kampf 200 von selbst bei.
- Firmenphase im V2 aus (`src/bn4rep.js:716`) ist richtig: 26,6 h Spielerzeit fuer 300k Firmenruf in BN2, BN14 (CWRG 0,2) 133 h. Vertrags-Firmenruf mit Anstellung: 25 % der Vertraege x 4.000 x 4,23/3 -> 300k in 48-115 h; und er fehlt dann dem Faktionsruf. Kuendigen ohne Phase (`:749-754`) richtig.
- Sleeves im V2 nicht auf Faktionsarbeit: Schock 93-100 (Schockbonus 0-0,07), Abbau gemessen 1,7/h (Formel 1,8/h).
- Spendenschwelle und Spendenfaktor live (BN3 75, BN8 0, BN2 x0,5) - kein fester Wert mehr im Pfad.
- Feindeslisten im Bot (`src/bn4life.js:289`) stimmen mit dem Spiel; Sector-12/Aevum vertraeglich.
- Befoerderung: CompanyWork liest `Player.jobs` je Zyklus, eine Befoerderung per applyToCompany wirkt sofort.

## 6. Querverweise und offene Fragen

- Gang (BN2): Gang-Faktion fuehrt fast alle Augs inkl. TRP, Ruf aus Respekt ohne FWRG (`FactionHelpers.tsx:172-206`, `Gang/Gang.ts:144-155`) - gehoert in den Gang-Bereich, ist aber DIE Alternative zu FAKT-1 als Augquelle in BN2.
- Hash-Bereich: Rang-Tausch (250 x Stufe je 100 Rang) gegen Vertrag (25 x Stufe) gegen Verkauf in BN2.
- Warum liefert der Vertragsfluss nur 41 % der Formel-Erwartung? (contracts.js-Log im Spielstand pruefen.)
- Erreicht BN2 Kampf 300 innerhalb eines Zyklus? (fuer FAKT-4)
- Parser-Hinweis: `fakt-augs.mjs` liest 136 von 137 Eintraegen; Unstable Circadian Modulator (Funktionsparameter) fehlt - ohne Kampfwerte, fuer V2 ohne Belang.
