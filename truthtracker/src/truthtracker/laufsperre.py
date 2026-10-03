"""Sperre gegen zwei gleichzeitige Läufe (Crawl oder Spike).

Ein zweites Fenster mit ``run_crawl.bat`` würde sonst parallel bei Truth Social anfragen, den
laufenden Lauf als abgestürzt markieren und dessen Temp-Ordner löschen. Die Sperre hält das
Betriebssystem auf einer offenen Datei; es gibt sie bei Prozessende auch nach einem Absturz
frei, eine verwaiste Sperre kann also nicht liegen bleiben. Die Datei selbst ist leer.
"""

from __future__ import annotations

import contextlib
import os
import sys
from collections.abc import Iterator
from pathlib import Path

from truthtracker import pfade

DATEINAME = "crawl.lock"

MELDUNG_BELEGT = (
    "Es läuft bereits ein Lauf des Trackers (Crawl oder Spike, vermutlich in einem anderen Fenster). "
    "Dieser Start wurde ohne Anfragen beendet."
)


def pfad() -> Path:
    return pfade.laufzeit() / DATEINAME


class Laufsperre:
    def __init__(self, datei: Path | None = None):
        self.datei = datei or pfad()
        self._fd: int | None = None

    def nehmen(self) -> bool:
        """Versucht die Sperre ohne Warten zu nehmen. False: ein anderer Lauf hält sie."""
        if self._fd is not None:
            return True
        self.datei.parent.mkdir(parents=True, exist_ok=True)
        fd = os.open(self.datei, os.O_RDWR | os.O_CREAT, 0o644)
        try:
            if sys.platform == "win32":
                import msvcrt

                os.lseek(fd, 0, os.SEEK_SET)
                msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
            else:
                import fcntl

                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            os.close(fd)
            return False
        self._fd = fd
        return True

    def freigeben(self) -> None:
        fd, self._fd = self._fd, None
        if fd is None:
            return
        try:
            if sys.platform == "win32":
                import msvcrt

                os.lseek(fd, 0, os.SEEK_SET)
                msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
            else:
                import fcntl

                fcntl.flock(fd, fcntl.LOCK_UN)
        except OSError:
            pass  # os.close gibt die Sperre ohnehin frei
        finally:
            os.close(fd)


@contextlib.contextmanager
def gehalten(datei: Path | None = None) -> Iterator[bool]:
    """``with gehalten() as frei:``; ``frei`` ist False, wenn schon ein anderer Lauf aktiv ist."""
    sperre = Laufsperre(datei)
    frei = sperre.nehmen()
    try:
        yield frei
    finally:
        if frei:
            sperre.freigeben()
