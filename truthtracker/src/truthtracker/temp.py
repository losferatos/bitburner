"""Temp-Ordner für Inhalte, die nur während eines Laufs existieren dürfen.

Ein Lauf bekommt einen eigenen Unterordner, der im ``finally`` gelöscht wird. Stürzt
der Prozess trotzdem ab (Stromausfall, Task-Manager), räumt ``raeume_temp_auf`` beim
nächsten Start alles weg, was noch unter ``laufzeit/tmp`` liegt.
"""

from __future__ import annotations

import os
import shutil
import stat
import time
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from truthtracker import pfade


def _schreibschutz_aufheben(funktion, pfad, _info) -> None:
    # Windows verweigert das Löschen schreibgeschützter Dateien; einmal entsperren, dann nochmal.
    try:
        os.chmod(pfad, stat.S_IWRITE)
        funktion(pfad)
    except OSError:
        pass


def loesche_baum(ordner: Path) -> bool:
    """Löscht einen Ordner samt Inhalt. Gibt zurück, ob er danach wirklich weg ist."""
    if not ordner.exists():
        return True
    for _ in range(3):
        shutil.rmtree(ordner, onexc=_schreibschutz_aufheben)
        if not ordner.exists():
            return True
        # Virenscanner und Indexdienst halten Dateien unter Windows gern kurz fest.
        time.sleep(0.5)
    return not ordner.exists()


def raeume_temp_auf() -> list[str]:
    """Entfernt Reste früherer Läufe. Gibt die Namen zurück, die sich nicht löschen ließen."""
    basis = pfade.temp_ordner()
    if not basis.exists():
        return []
    reste = []
    for eintrag in basis.iterdir():
        if eintrag.is_dir():
            ok = loesche_baum(eintrag)
        else:
            try:
                eintrag.unlink()
                ok = True
            except OSError:
                ok = False
        if not ok:
            reste.append(eintrag.name)
    return reste


@contextmanager
def temp_arbeitsordner(praefix: str) -> Iterator[Path]:
    """Eigener Temp-Ordner für die Dauer eines ``with``-Blocks, danach garantiert gelöscht."""
    ordner = pfade.temp_ordner() / f"{praefix}-{os.getpid()}-{time.time_ns()}"
    ordner.mkdir(parents=True, exist_ok=False)
    try:
        yield ordner
    finally:
        loesche_baum(ordner)
