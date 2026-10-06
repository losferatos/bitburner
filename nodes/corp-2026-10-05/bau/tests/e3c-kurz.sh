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
G_LAG='{"from":0,"betrag":5e13,"bestechung":{"Sector-12":5e5,"Aevum":2e5},"mode":"fresh","lagMin":3}'
G_FUT='{"from":0,"betrag":5e13,"bestechung":{},"mode":"fresh","tsOffsetMin":30}'
run "Grundlauf echte Schnittstelle (PASS)" CORP_TAG=H0 CORP_CFG='{"etappe":3}' CORP_GELD="$G_FRESH" CORP_EXPECT_SALES=4 CORP_EXPECT_CALIB=0.001 CORP_EXPECT_NOBB=1 CORP_EXPECT_BRIBEMAX=1.05 CORP_EXPECT_NOBRIBEBEFORE=1 CORP_EXPECT_SMOOTH=1e15 CORP_EXPECT_QUIRK=3
run "F1 gleiche Anforderung nur einmal bestechen, mit Fix (PASS)"  CORP_TAG=H1 CORP_CFG='{"etappe":3}' CORP_GELD="$G_FIXED" CORP_EXPECT_BRIBEMAX=1.05
run "Neustart nach IPO mit Zustandsverlust (PASS)" CORP_TAG=H8 CORP_CFG='{"etappe":3}' CORP_GELD="$G_FRESH" CORP_RESTART=10.0,10.05 CORP_STATELOSS=1 CORP_EXPECT_SALE_AFTER=10.1 CORP_EXPECT_NOBB=1 CORP_EXPECT_CALIB=0.001
run "E1a neues ts je Schreibvorgang + Verzug, mit Fix (PASS)"  CORP_TAG=J1 CORP_CFG='{"etappe":3}' CORP_GELD="$G_LAG" CORP_EXPECT_BRIBEMAX=1.05
run "E1a neues ts je Schreibvorgang + Verzug, ohne Fix (FAIL)" CORP_TAG=J1old CORP_CFG='{"etappe":3,"noFix":["ledger"]}' CORP_GELD="$G_LAG" CORP_EXPECT_BRIBEMAX=1.05
run "E1b Tod waehrend Bestechung, write-ahead (PASS)"          CORP_TAG=J2 CORP_CFG='{"etappe":3}' CORP_GELD="$G_LAG" CORP_DROPBRIBE=1 CORP_EXPECT_BRIBEMAX=1.05
run "E1b Tod waehrend Bestechung, ohne write-ahead (FAIL)"     CORP_TAG=J2old CORP_CFG='{"etappe":3,"noFix":["writeAhead"]}' CORP_GELD="$G_LAG" CORP_DROPBRIBE=1 CORP_EXPECT_BRIBEMAX=1.05
run "K4 ts in der Zukunft -> kein Verkauf (PASS)"              CORP_TAG=J5 CORP_CFG='{"etappe":3}' CORP_GELD="$G_FUT" CORP_HOURS=12 CORP_EXPECT_NOSALE=1
run "R3 erloesAug + geldbedarf angehoben, Einbau 11 h (PASS)"   CORP_TAG=J6 CORP_CFG='{"etappe":3}' CORP_GELD="$G_FRESH" CORP_INSTALL=11 CORP_EXPECT_ERLOES=1
run "R3 Ruecklage ohne Fix (FAIL)"                               CORP_TAG=J6old CORP_CFG='{"etappe":3,"noFix":["reserve"]}' CORP_GELD="$G_FRESH" CORP_INSTALL=11 CORP_EXPECT_ERLOES=1
