#!/usr/bin/env bash
# Pruefungen Etappe 3, Fassung corp-e3b (Schnittstelle data/corp-geld.txt, siehe Kopf von financeWork in corp.js).
# Je Lauf 1 Kern; bis zu 2 Laeufe parallel. Aufruf aus beliebigem Ordner.
cd "$(dirname "$0")/../../../../reference/v301" || exit 1
J="node node_modules/jest/bin/jest.js -c ../../nodes/corp-2026-10-05/bau/tests/jest.config.cjs -i botsim"
BASE="CORP_SPEND=1 CORP_FACTIONS=Sector-12,Aevum,Bladeburners CORP_HOURS=16 CORP_SEEDS=1"
G_FRESH='{"from":0,"betrag":5e13,"bestechung":{"Sector-12":5e5,"Aevum":2e5,"Bladeburners":1e6},"mode":"fresh"}'
G_FIXED='{"from":12.6,"betrag":5e13,"bestechung":{"Sector-12":5e5,"Aevum":2e5},"mode":"fixedts"}'
G_PRE='{"from":0,"betrag":5e13,"bestechung":{},"mode":"preinstall"}'
G_R4='{"from":8.55,"betrag":5e13,"bestechung":{},"mode":"fresh"}'
run() { local name=$1; shift; env $BASE "$@" $J > /dev/null 2>&1 && echo "PASS $name" || echo "FAIL $name"; }
run "Grundlauf echte Schnittstelle (PASS)" CORP_TAG=H0 CORP_CFG='{"etappe":3}' CORP_GELD="$G_FRESH" CORP_EXPECT_SALES=4 CORP_EXPECT_CALIB=0.001 CORP_EXPECT_NOBB=1 CORP_EXPECT_BRIBEMAX=1.05 CORP_EXPECT_NOBRIBEBEFORE=1 CORP_EXPECT_SMOOTH=1e15 CORP_EXPECT_QUIRK=3
run "F1 gleiche Anforderung nur einmal bestechen, mit Fix (PASS)"  CORP_TAG=H1 CORP_CFG='{"etappe":3}' CORP_GELD="$G_FIXED" CORP_EXPECT_BRIBEMAX=1.05
run "F1 gleiche Anforderung nur einmal bestechen, ohne Fix (FAIL)" CORP_TAG=H1old CORP_CFG='{"etappe":3,"noFix":["bribeTs"]}' CORP_GELD="$G_FIXED" CORP_EXPECT_BRIBEMAX=1.05
run "F2 keine Vorgabe ohne Anforderung, mit Fix (PASS)"  CORP_TAG=H2 CORP_CFG='{"etappe":3}' CORP_NEEDS=0:5e12 CORP_BN4REP='{"preis":2e12,"offen":5}' CORP_EXPECT_NOSALE=1
run "F2 keine Vorgabe ohne Anforderung, ohne Fix (FAIL)" CORP_TAG=H2old CORP_CFG='{"etappe":3,"noFix":["default"]}' CORP_NEEDS=0:5e12 CORP_BN4REP='{"preis":2e12,"offen":5}' CORP_EXPECT_NOSALE=1
run "F3 ipoEarly nie im Stopp vor Runde 4, mit Fix (PASS)"  CORP_TAG=H3 CORP_CFG='{"etappe":3,"ipoEarly":true}' CORP_GELD="$G_R4" CORP_HOURS=10 CORP_EXPECT_ROUND=4
run "F3 ipoEarly nie im Stopp vor Runde 4, ohne Fix (FAIL)" CORP_TAG=H3old CORP_CFG='{"etappe":3,"ipoEarly":true,"noFix":["early"]}' CORP_GELD="$G_R4" CORP_HOURS=10 CORP_EXPECT_ROUND=4
# (G_R4: Anforderung erscheint im Stopp vor Runde 4, Saat 1: Stopp 8,544-8,569 h)
# Bestechungs-Anforderung erscheint 7 Zyklen vor dem 2. Verkauf (Saat 1: Verkauf bei 10,139 h)
G_WIN='{"from":0,"betrag":5e13,"bestechung":{"Sector-12":100},"bribeFrom":10.12,"mode":"fresh"}'
run "F5 keine Bestechung 11 Zyklen vor Verkauf, mit Fix (PASS)"  CORP_TAG=H5 CORP_CFG='{"etappe":3,"bribeMinFunds":1e11}' CORP_GELD="$G_WIN" CORP_HOURS=11 CORP_EXPECT_NOBRIBEBEFORE=1 CORP_EXPECT_BRIBEMAX=1.05
run "F5 keine Bestechung 11 Zyklen vor Verkauf, ohne Fix (FAIL)" CORP_TAG=H5old CORP_CFG='{"etappe":3,"bribeMinFunds":1e11,"noFix":["bribeOrder"]}' CORP_GELD="$G_WIN" CORP_HOURS=11 CORP_EXPECT_NOBRIBEBEFORE=1
run "Neustart nach IPO mit Zustandsverlust (PASS)" CORP_TAG=H8 CORP_CFG='{"etappe":3}' CORP_GELD="$G_FRESH" CORP_RESTART=10.0,10.05 CORP_STATELOSS=1 CORP_EXPECT_SALE_AFTER=10.1 CORP_EXPECT_NOBB=1 CORP_EXPECT_CALIB=0.001
run "Fremde Anforderung (alter augReset) nach Einbau -> kein Verkauf (PASS)" CORP_TAG=H4 CORP_CFG='{"etappe":3}' CORP_GELD="$G_PRE" CORP_INSTALL=11 CORP_EXPECT_SALES=1 CORP_EXPECT_NOSALE_AFTER=11.01
run "Einbau, frische Anforderung -> Verkauf geht weiter (PASS)" CORP_TAG=H4b CORP_CFG='{"etappe":3}' CORP_GELD="$G_FRESH" CORP_INSTALL=11,13.3 CORP_EXPECT_SALE_AFTER=11.01
run "F9 maxRound 3 ohne ipoEarly -> blocked (PASS)" CORP_TAG=H9 CORP_CFG='{"etappe":3,"maxRound":3}' CORP_GELD="$G_FRESH" CORP_HOURS=8 CORP_EXPECT_BLOCKED=no_ipo_path
run "Glaettung ohne Fix (FAIL)" CORP_TAG=H7old CORP_CFG='{"etappe":3,"noFix":["smooth"]}' CORP_GELD="$G_FRESH" CORP_EXPECT_SMOOTH=1e15
# --- corp-e3c (Nachpruefer ERNST-1): Schreiber vergibt ts je Schreibvorgang neu und sieht den Ruf erst 3 min spaeter
G_LAG='{"from":0,"betrag":5e13,"bestechung":{"Sector-12":5e5,"Aevum":2e5},"mode":"fresh","lagMin":3}'
run "E1a neues ts je Schreibvorgang + Verzug, mit Fix (PASS)"  CORP_TAG=J1 CORP_CFG='{"etappe":3}' CORP_GELD="$G_LAG" CORP_EXPECT_BRIBEMAX=1.05
run "E1a neues ts je Schreibvorgang + Verzug, ohne Fix (FAIL)" CORP_TAG=J1old CORP_CFG='{"etappe":3,"noFix":["ledger"]}' CORP_GELD="$G_LAG" CORP_EXPECT_BRIBEMAX=1.05
run "E1b Tod waehrend Bestechung, write-ahead (PASS)"          CORP_TAG=J2 CORP_CFG='{"etappe":3}' CORP_GELD="$G_LAG" CORP_DROPBRIBE=1 CORP_EXPECT_BRIBEMAX=1.05
run "E1b Tod waehrend Bestechung, ohne write-ahead (FAIL)"     CORP_TAG=J2old CORP_CFG='{"etappe":3,"noFix":["writeAhead"]}' CORP_GELD="$G_LAG" CORP_DROPBRIBE=1 CORP_EXPECT_BRIBEMAX=1.05
run "K1 keine Bestechung privat vor Zuendung, mit Fix (PASS)"  CORP_TAG=J3 CORP_CFG='{"etappe":3,"bribeMinFunds":1e11}' CORP_GELD="$G_LAG" CORP_HOURS=10 CORP_EXPECT_NOBRIBE_BEFORE_H=9.0
run "K1 keine Bestechung privat vor Zuendung, ohne Fix (FAIL)" CORP_TAG=J3old CORP_CFG='{"etappe":3,"bribeMinFunds":1e11,"noFix":["bribePhase"]}' CORP_GELD="$G_LAG" CORP_HOURS=10 CORP_EXPECT_NOBRIBE_BEFORE_H=9.0
run "K2 maxRound 2 + ipoEarly -> blocked (PASS)"               CORP_TAG=J4 CORP_CFG='{"etappe":3,"maxRound":2,"ipoEarly":true}' CORP_GELD="$G_LAG" CORP_HOURS=5 CORP_EXPECT_BLOCKED=no_ipo_path
G_FUT='{"from":0,"betrag":5e13,"bestechung":{},"mode":"fresh","tsOffsetMin":30}'
run "K4 ts in der Zukunft -> kein Verkauf (PASS)"              CORP_TAG=J5 CORP_CFG='{"etappe":3}' CORP_GELD="$G_FUT" CORP_HOURS=12 CORP_EXPECT_NOSALE=1
# Zusatz Skeptiker Runde 3: erloesAug + Ruecklage
run "R3 erloesAug + geldbedarf angehoben, Einbau 11 h (PASS)"   CORP_TAG=J6 CORP_CFG='{"etappe":3}' CORP_GELD="$G_FRESH" CORP_INSTALL=11 CORP_EXPECT_ERLOES=1
run "R3 Ruecklage ohne Fix (FAIL)"                               CORP_TAG=J6old CORP_CFG='{"etappe":3,"noFix":["reserve"]}' CORP_GELD="$G_FRESH" CORP_INSTALL=11 CORP_EXPECT_ERLOES=1
