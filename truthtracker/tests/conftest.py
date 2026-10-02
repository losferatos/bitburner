from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

import pytest

from fabrik import MARKER


@pytest.fixture(autouse=True)
def eigene_laufzeit(tmp_path, monkeypatch):
    """Jeder Test bekommt eigene Laufzeit- und Doku-Ordner, nie die echten."""
    monkeypatch.setenv("TRUTHTRACKER_LAUFZEIT", str(tmp_path / "laufzeit"))
    monkeypatch.setenv("TRUTHTRACKER_DOCS", str(tmp_path / "docs"))
    return tmp_path


def chromium_pfad() -> Path | None:
    """Ein Chromium für Browser-Tests: TRUTHTRACKER_TEST_CHROMIUM, Playwright-Ablage oder System."""
    kandidaten = []
    if os.environ.get("TRUTHTRACKER_TEST_CHROMIUM"):
        kandidaten.append(Path(os.environ["TRUTHTRACKER_TEST_CHROMIUM"]))
    for basis in (os.environ.get("PLAYWRIGHT_BROWSERS_PATH"), "/opt/pw-browsers"):
        if basis and Path(basis).is_dir():
            kandidaten.extend(sorted(Path(basis).glob("chromium-*/chrome-linux*/chrome"), reverse=True))
            kandidaten.extend(sorted(Path(basis).glob("chromium-*/chrome-win*/chrome.exe"), reverse=True))
    for name in ("chromium", "chromium-browser", "google-chrome"):
        gefunden = shutil.which(name)
        if gefunden:
            kandidaten.append(Path(gefunden))
    return next((k for k in kandidaten if k.is_file()), None)


def browser_argumente_fuer_tests() -> list[str]:
    argumente = []
    if sys.platform.startswith("linux") and hasattr(os, "geteuid") and os.geteuid() == 0:
        argumente.append("--no-sandbox")
    return argumente


def finde_marker(*pfade: Path) -> list[str]:
    """Dateien unter den Pfaden, die den Inhaltsmarker enthalten."""
    treffer = []
    for wurzel in pfade:
        if not wurzel.exists():
            continue
        dateien = [wurzel] if wurzel.is_file() else [p for p in wurzel.rglob("*") if p.is_file()]
        for datei in dateien:
            try:
                if MARKER.encode() in datei.read_bytes():
                    treffer.append(str(datei))
            except OSError:
                pass
    return treffer
