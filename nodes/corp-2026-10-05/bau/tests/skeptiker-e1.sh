#!/usr/bin/env bash
# Nachweis der Skeptiker-Fixes zu Etappe 1: je Fall einmal MIT Fix (muss PASS) und einmal mit
# {"noFix":[...]} (muss FAIL). Aufruf aus beliebigem Ordner; ~1 min je Lauf, 1 Kern.
cd "$(dirname "$0")/../../../../reference/v301" || exit 1
J="node node_modules/jest/bin/jest.js -c ../../nodes/corp-2026-10-05/bau/tests/jest.config.cjs -i botsim"
run() { local name=$1; shift; env "$@" $J > /dev/null 2>&1 && echo "PASS $name" || echo "FAIL $name"; }
# 1 Ausgabenstopp ohne Ende: 0,001-0,47 h kein Platz fuer Einmal-Skripte -> Runde 1 muss trotzdem kommen
run "T1 Stopp mit Fix (erwartet PASS)"   CORP_TAG=T1fix CORP_NOSPACE=0.001,0.47 CORP_HOURS=2.5 CORP_EXPECT_MINROUND=1
run "T1 Stopp ohne Fix (erwartet FAIL)"  CORP_TAG=T1old CORP_CFG='{"noFix":["freeze"]}' CORP_NOSPACE=0.001,0.47 CORP_HOURS=2.5 CORP_EXPECT_MINROUND=1
# 2 Zustandsverlust bei 1,0 h -> es darf KEINE zweite Runde als "Runde 1" angenommen werden
run "T2 Runde mit Fix (erwartet PASS)"   CORP_TAG=T2fix CORP_RESTART=1.0,1.01 CORP_STATELOSS=1 CORP_HOURS=2.5 CORP_EXPECT_ROUND=1
run "T2 Runde ohne Fix (erwartet FAIL)"  CORP_TAG=T2old CORP_CFG='{"noFix":["round"]}' CORP_RESTART=1.0,1.01 CORP_STATELOSS=1 CORP_HOURS=2.5 CORP_EXPECT_ROUND=1
# 3 verdeckter Tab: Corp steht 10 x 60 s Wanduhr -> Telemetrie muss mindestens 9 x frisch werden
run "T3 Herzschlag mit Fix (erwartet PASS)"  CORP_TAG=T3fix CORP_PAUSE=1.0,10 CORP_HOURS=1.2 CORP_EXPECT_BEATS=9
run "T3 Herzschlag ohne Fix (erwartet FAIL)" CORP_TAG=T3old CORP_CFG='{"noFix":["beat"]}' CORP_PAUSE=1.0,10 CORP_HOURS=1.2 CORP_EXPECT_BEATS=9
# Regression Etappe 1
run "E1 4 Saaten 2,5 h (erwartet PASS)"  CORP_TAG=E1b CORP_SEEDS=1,2,3,4 CORP_HOURS=2.5 CORP_EXPECT_ROUND=1
