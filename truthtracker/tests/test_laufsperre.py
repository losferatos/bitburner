"""Laufsperre: nur ein Lauf gleichzeitig, auch über Prozesse hinweg; ein Absturz gibt sie frei."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from truthtracker import laufsperre

SRC = Path(__file__).resolve().parents[1] / "src"


def test_zweite_sperre_im_selben_prozess_scheitert():
    erste = laufsperre.Laufsperre()
    assert erste.nehmen()
    try:
        with laufsperre.gehalten() as frei:
            assert frei is False
    finally:
        erste.freigeben()
    with laufsperre.gehalten() as frei:
        assert frei is True
    assert laufsperre.pfad().exists() and laufsperre.pfad().stat().st_size == 0


def test_sperre_eines_anderen_prozesses_und_freigabe_beim_absturz():
    umgebung = dict(os.environ, PYTHONPATH=str(SRC))
    halter = subprocess.Popen(
        [sys.executable, "-c",
         "import sys, time\n"
         "from truthtracker import laufsperre\n"
         "s = laufsperre.Laufsperre()\n"
         "print('gesperrt' if s.nehmen() else 'belegt', flush=True)\n"
         "time.sleep(60)\n"],
        stdout=subprocess.PIPE, text=True, env=umgebung,
    )
    try:
        assert halter.stdout.readline().strip() == "gesperrt"
        with laufsperre.gehalten() as frei:
            assert frei is False
    finally:
        halter.kill()  # wie ein geschlossenes Konsolenfenster: kein Aufräumen im Prozess
        halter.wait()
        halter.stdout.close()
    with laufsperre.gehalten() as frei:
        assert frei is True
