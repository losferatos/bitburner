#!/usr/bin/env bash
# Pruefungen Etappe 2 (je Lauf 1 Kern, 14-24 h Corp-Zeit = ~1-3 min). Aufruf aus beliebigem Ordner.
cd "$(dirname "$0")/../../../../reference/v301" || exit 1
J="node node_modules/jest/bin/jest.js -c ../../nodes/corp-2026-10-05/bau/tests/jest.config.cjs -i botsim"
run() { local name=$1; shift; env "$@" $J > /dev/null 2>&1 && echo "PASS $name" || echo "FAIL $name"; }
# (1) Uebergang live Etappe 1 -> 2: Schalter bei 1,5 h; "strip" = Neustart mit Zustand ohne Etappe-2-Felder
run "U1 Schalter live"            CORP_TAG=U1live  CORP_SWITCH=1.5,live  CORP_HOURS=14 CORP_EXPECT_ROUND=4 CORP_EXPECT_IGNITION=14
run "U1 Schalter + Neustart/alt"  CORP_TAG=U1strip CORP_SWITCH=1.5,strip CORP_HOURS=14 CORP_EXPECT_ROUND=4 CORP_EXPECT_IGNITION=14
# (2) Neustart im Ausgabenstopp vor Runde 2 und kurz vor Runde 4
run "N2 Neustart vor Runde 2"     CORP_TAG=N2c CORP_CFG='{"etappe":2}' CORP_RESTART=3.0005,3.05 CORP_HOURS=14 CORP_EXPECT_ROUND=4 CORP_EXPECT_IGNITION=14
run "N4 Neustart vor Runde 4"     CORP_TAG=N4c CORP_CFG='{"etappe":2}' CORP_RESTART=9.06,9.1 CORP_HOURS=14 CORP_EXPECT_ROUND=4 CORP_EXPECT_IGNITION=14
# (3) 3 Saaten 24 h
run "E2 Saaten 1-3, 24 h"         CORP_TAG=E2F CORP_CFG='{"etappe":2}' CORP_SEEDS=1,2,3 CORP_HOURS=24 CORP_EXPECT_ROUND=4 CORP_EXPECT_IGNITION=12
# Skeptiker-Fixes Etappe 2 (rot ohne Fix / gruen mit Fix)
run "F5 Grenze haengt nicht, mit Fix (erwartet PASS)"   CORP_TAG=K5 CORP_CFG='{"etappe":2,"forceFill":0.9}' CORP_HOURS=8 CORP_EXPECT_NOSTUCK=1
run "F5 Grenze haengt nicht, ohne Fix (erwartet FAIL)"  CORP_TAG=K5old CORP_CFG='{"etappe":2,"forceFill":0.9,"noFix":["limit"]}' CORP_HOURS=8 CORP_EXPECT_NOSTUCK=1
run "F1 Neustart im Stopp R2 >= 350 Mrd, mit Fix (erwartet PASS)"  CORP_TAG=K1 CORP_CFG='{"etappe":2}' CORP_RESTART=3.0005,3.05 CORP_HOURS=14 CORP_EXPECT_ROUND=4 CORP_EXPECT_R2MIN=350e9
run "F1 Neustart im Stopp R2 >= 350 Mrd, ohne Fix (erwartet FAIL)" CORP_TAG=K1old CORP_CFG='{"etappe":2,"noFix":["bestOffer"]}' CORP_RESTART=3.0005,3.05 CORP_HOURS=14 CORP_EXPECT_ROUND=4 CORP_EXPECT_R2MIN=350e9
run "N4 Neustart im Stopp vor Runde 4 (8,69-8,74 h)"   CORP_TAG=N4d CORP_CFG='{"etappe":2}' CORP_RESTART=8.69,8.74 CORP_HOURS=14 CORP_EXPECT_ROUND=4 CORP_EXPECT_IGNITION=14
