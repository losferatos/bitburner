"""Feste Orte des Projekts.

Alles, was zur Laufzeit entsteht (Browserprofil, Temp-Ordner, Logs), liegt unter
``laufzeit/``. Für Tests lässt sich der Ort über ``TRUTHTRACKER_LAUFZEIT`` umlenken,
damit kein Test das echte Profil anfasst.
"""

from __future__ import annotations

import os
from pathlib import Path

PROJEKT = Path(__file__).resolve().parents[2]


def laufzeit() -> Path:
    basis = os.environ.get("TRUTHTRACKER_LAUFZEIT")
    return Path(basis) if basis else PROJEKT / "laufzeit"


def temp_ordner() -> Path:
    return laufzeit() / "tmp"


def profil_ordner() -> Path:
    return laufzeit() / "browser-profil"


def docs_ordner() -> Path:
    basis = os.environ.get("TRUTHTRACKER_DOCS")
    return Path(basis) if basis else PROJEKT / "docs"
