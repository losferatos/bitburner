#!/usr/bin/env bash
# Pruefungen Etappe 3 (Zuendung, Boersengang, Verkauf nach Bedarf, Bestechung, Einbau). Je Lauf 1 Kern, ~2-3 min.
cd "$(dirname "$0")/../../../../reference/v301" || exit 1
J="node node_modules/jest/bin/jest.js -c ../../nodes/corp-2026-10-05/bau/tests/jest.config.cjs -i botsim"
B='{"preis":2e12,"offen":5,"ziel":"X","offenJeFaktion":{"Sector-12":{"anzahl":2,"fehlt":5e5},"Aevum":{"anzahl":1,"fehlt":2e5},"Bladeburners":{"anzahl":3,"fehlt":1e6}}}'
C="CORP_SPEND=1 CORP_NEEDS=0:5e12 CORP_FACTIONS=Sector-12,Aevum,Bladeburners CORP_HOURS=16"
run() { local name=$1; shift; env CORP_BN4REP="$B" $C "$@" $J > /dev/null 2>&1 && echo "PASS $name" || echo "FAIL $name"; }
run "Z Zuendung geglaettet, mit Fix (erwartet PASS)"   CORP_TAG=F1 CORP_SEEDS=3 CORP_CFG='{"etappe":3}' CORP_EXPECT_SMOOTH=1e15 CORP_EXPECT_SALES=4
run "Z Zuendung geglaettet, ohne Fix (erwartet FAIL)"  CORP_TAG=F1old CORP_SEEDS=3 CORP_CFG='{"etappe":3,"noFix":["smooth"]}' CORP_EXPECT_SMOOTH=1e15
run "B nie Bladeburners, mit Fix (erwartet PASS)"      CORP_TAG=FB CORP_SEEDS=3 CORP_CFG='{"etappe":3}' CORP_EXPECT_NOBB=1
# (ohne den eigenen Ausschluss lehnt das SPIEL die Bladeburners-Bestechung ab, FactionInfo.tsx:711-713 -
#  ein Rot-Lauf ist deshalb nicht moeglich; der Ausschluss spart nur den Fehlversuch)
run "R Bestechung nach Verkauf, mit Fix (erwartet PASS)"  CORP_TAG=FR CORP_SEEDS=3 CORP_CFG='{"etappe":3,"bribeMinFunds":1e12}' CORP_EXPECT_BRIBEAFTER=1
run "R Bestechung nach Verkauf, ohne Fix (erwartet FAIL)" CORP_TAG=FRold CORP_SEEDS=3 CORP_CFG='{"etappe":3,"bribeMinFunds":1e12,"noFix":["bribeOrder"]}' CORP_EXPECT_BRIBEAFTER=1
run "A Anforderung data/corp-geld.txt 2e13 ab 13 h (erwartet PASS)" CORP_TAG=FA CORP_SEEDS=1 CORP_CFG='{"etappe":3}' CORP_NEEDS=0:1e9 CORP_REQ=13:2e13 CORP_EXPECT_REQ=13:2e13
run "E Einbau 11,6 h + 13,3 h (erwartet PASS)"            CORP_TAG=F3inst CORP_SEEDS=1 CORP_CFG='{"etappe":3}' CORP_INSTALL=11.6,13.3 CORP_HOURS=18 CORP_EXPECT_SALES=5 CORP_EXPECT_NOBB=1 CORP_EXPECT_SMOOTH=1e15
