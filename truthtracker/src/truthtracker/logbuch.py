"""Logdateien unter ``laufzeit/logs``. Meldungen enthalten nur IDs, Zähler und Statuscodes."""

from __future__ import annotations

import logging
import sys
from datetime import UTC, datetime
from pathlib import Path

from truthtracker import pfade

FORMAT = "%(asctime)s %(levelname)-7s %(name)s: %(message)s"


def log_ordner() -> Path:
    return pfade.laufzeit() / "logs"


def richte_ein(name: str, *, konsole: bool = True, stufe: int = logging.INFO) -> Path:
    """Schreibt nach ``laufzeit/logs/<name>-JJJJ-MM-TT.log`` (UTF-8) und optional auf die Konsole."""
    ordner = log_ordner()
    ordner.mkdir(parents=True, exist_ok=True)
    datei = ordner / f"{name}-{datetime.now(UTC):%Y-%m-%d}.log"
    wurzel = logging.getLogger()
    for handler in list(wurzel.handlers):
        if getattr(handler, "_truthtracker", False):
            wurzel.removeHandler(handler)
            handler.close()
    datei_handler = logging.FileHandler(datei, encoding="utf-8")
    datei_handler.setFormatter(logging.Formatter(FORMAT))
    datei_handler._truthtracker = True  # type: ignore[attr-defined]
    wurzel.addHandler(datei_handler)
    if konsole:
        konsolen_handler = logging.StreamHandler(sys.stdout)
        konsolen_handler.setFormatter(logging.Formatter("%(message)s"))
        konsolen_handler.setLevel(logging.INFO)
        konsolen_handler._truthtracker = True  # type: ignore[attr-defined]
        wurzel.addHandler(konsolen_handler)
    wurzel.setLevel(stufe)
    # Fremdbibliotheken stumm halten: ihre Meldungen könnten URLs von Medien enthalten.
    for fremd in ("urllib3", "asyncio", "PIL", "curl_cffi", "playwright", "streamlit"):
        logging.getLogger(fremd).setLevel(logging.ERROR)
    return datei
