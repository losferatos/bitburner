"""Echter Browser (Opera, Chrome oder Edge) mit eigenem, dauerhaftem Tracker-Profil.

Der Browser wird ganz normal als Programm gestartet, nur mit eigenem Profilordner und
einem lokalen DevTools-Port. Playwright verbindet sich danach über CDP. Dadurch läuft der
Browser ohne Playwrights Automatisierungsschalter, so wie ein Mensch ihn öffnet, und eine
von Hand gelöste Cloudflare-Prüfung bleibt als Cookie im Profil.

Das Profil ist *nicht* das Alltagsprofil des Nutzers: Chromium erlaubt die Fernsteuerung
des Standardprofils nicht mehr, der Alltagsbrowser müsste dafür geschlossen sein, und die
Datenschutz-Regel verlangt, nach jedem Lauf alles außer Cookies zu löschen.

``raeume_profil_auf`` arbeitet mit einer Positivliste: Erhalten bleiben nur Cookies, der
Schlüssel zu ihrer Entschlüsselung (``Local State``) und die Einstellungsdateien. Cache,
Verlauf, Sitzungswiederherstellung, Local Storage, IndexedDB, Service Worker usw. werden
gelöscht, denn dort könnten Seiteninhalte oder Medien liegen.
"""

from __future__ import annotations

import json
import os
import re
import socket
import subprocess
import sys
import time
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

from truthtracker.temp import loesche_baum

BROWSER_REIHENFOLGE = ("opera", "opera_gx", "chrome", "edge")
BROWSER_NAMEN = {
    "opera": "Opera",
    "opera_gx": "Opera GX",
    "chrome": "Google Chrome",
    "edge": "Microsoft Edge",
    "eigener": "Browser (eigener Pfad)",
}


class BrowserFehler(RuntimeError):
    pass


@dataclass(frozen=True)
class BrowserFund:
    art: str
    pfad: Path

    @property
    def name(self) -> str:
        return BROWSER_NAMEN.get(self.art, self.art)


def _umgebung(name: str) -> Path | None:
    wert = os.environ.get(name)
    return Path(wert) if wert else None


def _versionsschluessel(ordner: Path) -> tuple[int, ...]:
    return tuple(int(t) for t in ordner.name.split("."))


def _opera_im_ordner(basis: Path) -> Path | None:
    """Bevorzugt die versionierte opera.exe statt des Startprogramms.

    ``<basis>\\opera.exe`` ist bei Opera ein Launcher, der die eigentliche Programmdatei in
    ``<basis>\\<version>\\opera.exe`` startet und sich dann beendet. Der Launcher kann nebenbei
    ein Update anstoßen; die versionierte Datei startet direkt.
    """
    if not basis.is_dir():
        return None
    versionen = [
        d for d in basis.iterdir() if d.is_dir() and re.fullmatch(r"\d+(\.\d+)+", d.name) and (d / "opera.exe").is_file()
    ]
    if versionen:
        return max(versionen, key=_versionsschluessel) / "opera.exe"
    launcher = basis / "opera.exe"
    return launcher if launcher.is_file() else None


def _app_path_aus_registry(exe: str) -> Path | None:
    if sys.platform != "win32":
        return None
    import winreg

    for wurzel in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
        try:
            with winreg.OpenKey(wurzel, rf"Software\Microsoft\Windows\CurrentVersion\App Paths\{exe}") as schluessel:
                wert, _ = winreg.QueryValueEx(schluessel, None)
        except OSError:
            continue
        pfad = Path(str(wert).strip('"'))
        if pfad.is_file():
            return pfad
    return None


def kandidaten(art: str) -> list[Path]:
    """Mögliche Installationsorte unter Windows, in Suchreihenfolge."""
    lokal = _umgebung("LOCALAPPDATA")
    prog = _umgebung("ProgramFiles")
    prog86 = _umgebung("ProgramFiles(x86)")
    orte: list[Path] = []
    if art == "opera":
        for basis in (lokal and lokal / "Programs" / "Opera", prog and prog / "Opera", prog86 and prog86 / "Opera"):
            if basis:
                gefunden = _opera_im_ordner(basis)
                if gefunden:
                    orte.append(gefunden)
        registry = _app_path_aus_registry("opera.exe")
        if registry and "gx" not in str(registry).lower():
            orte.append(registry)
    elif art == "opera_gx":
        for basis in (lokal and lokal / "Programs" / "Opera GX", prog and prog / "Opera GX"):
            if basis:
                gefunden = _opera_im_ordner(basis)
                if gefunden:
                    orte.append(gefunden)
    elif art == "chrome":
        for basis in (prog, prog86, lokal):
            if basis:
                orte.append(basis / "Google" / "Chrome" / "Application" / "chrome.exe")
        registry = _app_path_aus_registry("chrome.exe")
        if registry:
            orte.append(registry)
    elif art == "edge":
        for basis in (prog86, prog):
            if basis:
                orte.append(basis / "Microsoft" / "Edge" / "Application" / "msedge.exe")
        registry = _app_path_aus_registry("msedge.exe")
        if registry:
            orte.append(registry)
    return orte


def finde_browser(wunsch: str = "auto") -> BrowserFund | None:
    """``wunsch``: ``auto``, einer aus ``BROWSER_REIHENFOLGE`` oder ein Pfad zur Programmdatei."""
    wunsch = (wunsch or "auto").strip()
    if wunsch.lower() not in ("auto", *BROWSER_REIHENFOLGE):
        pfad = Path(wunsch)
        return BrowserFund("eigener", pfad) if pfad.is_file() else None
    arten = BROWSER_REIHENFOLGE if wunsch.lower() == "auto" else (wunsch.lower(),)
    for art in arten:
        for pfad in kandidaten(art):
            if pfad.is_file():
                return BrowserFund(art, pfad)
    return None


# ---------------------------------------------------------------------------
# Profil aufräumen


def _behalten(relativ: Path) -> bool:
    teile = relativ.parts
    name = teile[-1]
    if name in ("Cookies", "Cookies-journal"):
        # Chrome/Edge: Default/Network/Cookies, Opera: Network/Cookies, ältere Fassungen ohne Network/.
        return (len(teile) >= 2 and teile[-2] == "Network") or len(teile) <= 2
    if name in ("Local State", "First Run", "Last Version", "Last Browser"):
        return len(teile) == 1
    if name in ("Preferences", "Secure Preferences"):
        return len(teile) <= 2
    return False


@dataclass
class Aufraeumbericht:
    geloescht: int = 0
    behalten: list[str] = field(default_factory=list)
    nicht_loeschbar: list[str] = field(default_factory=list)

    def als_dict(self) -> dict:
        return {"geloescht": self.geloescht, "behalten": self.behalten, "nicht_loeschbar": self.nicht_loeschbar}


def raeume_profil_auf(profil: Path) -> Aufraeumbericht:
    """Löscht im Profil alles außer Cookies und Einstellungen. Nur bei geschlossenem Browser aufrufen."""
    bericht = Aufraeumbericht()
    if not profil.exists():
        return bericht
    for wurzel, ordner, dateien in os.walk(profil, topdown=False):
        wurzel_pfad = Path(wurzel)
        for datei in dateien:
            pfad = wurzel_pfad / datei
            relativ = pfad.relative_to(profil)
            if _behalten(relativ):
                bericht.behalten.append(relativ.as_posix())
                continue
            try:
                pfad.unlink(missing_ok=True)
                bericht.geloescht += 1
            except OSError:
                bericht.nicht_loeschbar.append(relativ.as_posix())
        for name in ordner:
            unterordner = wurzel_pfad / name
            if unterordner.is_symlink():
                try:
                    unterordner.unlink()
                except OSError:
                    bericht.nicht_loeschbar.append(unterordner.relative_to(profil).as_posix())
                continue
            try:
                unterordner.rmdir()  # nur leere Ordner; Ordner mit behaltenen Dateien bleiben stehen
            except OSError:
                pass
    bericht.behalten.sort()
    return bericht


def profil_in_benutzung(profil: Path) -> bool:
    """Läuft bereits ein Browser mit diesem Profil?"""
    if sys.platform == "win32":
        sperre = profil / "lockfile"
        if not sperre.exists():
            return False
        try:
            sperre.unlink()  # gelingt nur, wenn kein Browser die Datei offen hält
            return False
        except PermissionError:
            return True
        except OSError:
            return False
    sperre = profil / "SingletonLock"
    if not os.path.lexists(sperre):
        return False
    try:
        ziel = os.readlink(sperre)
        pid = int(ziel.rsplit("-", 1)[-1])
        os.kill(pid, 0)
        return True
    except (OSError, ValueError):
        return False


# ---------------------------------------------------------------------------
# Starten, verbinden, beenden


def _port_offen(port: int) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.5):
            return True
    except OSError:
        return False


def _hole_lokal(url: str, timeout: float = 2.0) -> dict | None:
    # Lokaler DevTools-Endpunkt: niemals über einen Proxy.
    oeffner = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with oeffner.open(url, timeout=timeout) as antwort:
            return json.loads(antwort.read().decode("utf-8"))
    except (OSError, ValueError):
        return None


@dataclass
class LaufenderBrowser:
    fund: BrowserFund
    prozess: subprocess.Popen
    port: int
    profil: Path
    version: str = ""
    browser_pid: int | None = None

    @property
    def cdp_url(self) -> str:
        return f"http://127.0.0.1:{self.port}"


def _freier_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def starte_browser(
    fund: BrowserFund,
    profil: Path,
    cache_ordner: Path,
    *,
    start_url: str = "about:blank",
    headless: bool = False,
    zusatz_argumente: tuple[str, ...] = (),
    timeout_s: float = 45.0,
) -> LaufenderBrowser:
    """Startet den Browser wie von Hand, nur mit eigenem Profil und lokalem DevTools-Port.

    Der Port ist fest gewählt (ein gerade freier), nicht 0: Mit ``--remote-debugging-port=0``
    schaltet Chromium ``navigator.webdriver`` ein, und Cloudflare lässt die Prüfung dann
    endlos kreisen. Mit festem Port verhält sich der Browser wie ein normal gestarteter.
    """
    profil.mkdir(parents=True, exist_ok=True)
    cache_ordner.mkdir(parents=True, exist_ok=True)
    if profil_in_benutzung(profil):
        raise BrowserFehler(
            "Das Tracker-Browserprofil ist noch geöffnet. Bitte das Browserfenster des Trackers schließen "
            "und erneut starten."
        )
    (profil / "DevToolsActivePort").unlink(missing_ok=True)
    port = _freier_port()
    argumente = [
        str(fund.pfad),
        f"--user-data-dir={profil}",
        f"--remote-debugging-port={port}",
        "--no-first-run",
        "--no-default-browser-check",
        f"--disk-cache-dir={cache_ordner}",
        "--disable-sync",
    ]
    if headless:
        argumente.append("--headless=new")
    argumente.extend(zusatz_argumente)
    argumente.append(start_url)

    prozess = subprocess.Popen(argumente, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, stdin=subprocess.DEVNULL)

    ende = time.monotonic() + timeout_s
    while time.monotonic() < ende:
        info = _hole_lokal(f"http://127.0.0.1:{port}/json/version")
        if info:
            return LaufenderBrowser(
                fund=fund, prozess=prozess, port=port, profil=profil, version=str(info.get("Browser", ""))
            )
        time.sleep(0.3)
    if prozess.poll() is None:
        prozess.terminate()
    raise BrowserFehler(
        f"{fund.name} hat innerhalb von {timeout_s:.0f} s keinen DevTools-Port geöffnet. "
        "Läuft vielleicht noch ein Fenster mit dem Tracker-Profil? Dann bitte schließen."
    )


CHALLENGE_TITEL = ("just a moment", "einen moment", "un instant", "un momento", "checking your browser")
SPERR_TITEL = ("attention required",)


def offene_seiten(lauf: LaufenderBrowser) -> list[dict]:
    """Titel und Adressen der offenen Tabs, gelesen über den HTTP-Endpunkt von DevTools.

    Das hängt nichts an die Seite an (kein CDP-Sitzungsaufbau); während Cloudflare prüft,
    bleibt der Browser dadurch unberührt.
    """
    seiten = _hole_lokal(f"http://127.0.0.1:{lauf.port}/json/list")
    return [s for s in seiten or [] if isinstance(s, dict) and s.get("type") == "page"]


@dataclass
class Freigabe:
    geloest: bool
    challenge_gesehen: bool
    sperrseite: bool
    wartezeit_s: float


def warte_auf_freigabe(
    lauf: LaufenderBrowser,
    host: str,
    *,
    timeout_s: float,
    melden,
    ruhe_s: float = 3.0,
) -> Freigabe:
    """Wartet, bis der Tab auf ``host`` keine Cloudflare-Prüfung mehr zeigt.

    Gilt als frei, wenn der Titel ``ruhe_s`` lang keine Prüfung anzeigt. Eine Seite mit
    "Attention Required" (meist eine Sperre, selten eine alte Captcha-Prüfung) beendet das
    Warten; der Aufrufer prüft danach den Seitentext.
    """
    start = time.monotonic()
    gesehen = False
    gemeldet = False
    ruhig_seit: float | None = None
    while time.monotonic() - start < timeout_s:
        seiten = [s for s in offene_seiten(lauf) if host in str(s.get("url", ""))]
        titel = [str(s.get("title", "")).lower() for s in seiten]
        if any(any(m in t for m in SPERR_TITEL) for t in titel):
            return Freigabe(False, gesehen, True, time.monotonic() - start)
        if any(any(m in t for m in CHALLENGE_TITEL) for t in titel):
            gesehen = True
            ruhig_seit = None
            if not gemeldet:
                melden(
                    "\n>>> Cloudflare-Prüfung im Browserfenster. Bitte dort lösen "
                    f"(höchstens {timeout_s / 60:.0f} Minuten). Der Lauf wartet.\n"
                )
                gemeldet = True
        elif seiten:
            ruhig_seit = ruhig_seit or time.monotonic()
            if time.monotonic() - ruhig_seit >= ruhe_s:
                if gemeldet:
                    melden("Prüfung gelöst, es geht weiter.")
                return Freigabe(True, gesehen, False, time.monotonic() - start)
        time.sleep(1.0)
    return Freigabe(False, gesehen, False, time.monotonic() - start)


def beende_browser(lauf: LaufenderBrowser, playwright_browser=None, timeout_s: float = 20.0) -> bool:
    """Schließt den Browser so, dass er seine Cookies sauber auf die Platte schreibt."""
    if playwright_browser is not None:
        try:
            sitzung = playwright_browser.new_browser_cdp_session()
            sitzung.send("Browser.close")
        except Exception:  # noqa: BLE001 - die Verbindung reißt beim Schließen absichtlich ab
            pass
    ende = time.monotonic() + timeout_s
    while time.monotonic() < ende:
        prozess_weg = lauf.prozess.poll() is not None
        if not _port_offen(lauf.port) and (prozess_weg or lauf.browser_pid is None or not _pid_lebt(lauf.browser_pid)):
            return True
        time.sleep(0.3)
    # Notfall: hart beenden. Cookies der laufenden Sitzung können dabei verloren gehen.
    if lauf.prozess.poll() is None:
        lauf.prozess.kill()
    if lauf.browser_pid and _pid_lebt(lauf.browser_pid):
        _beende_pid(lauf.browser_pid)
    time.sleep(1.0)
    return not _port_offen(lauf.port)


def _pid_lebt(pid: int) -> bool:
    if sys.platform == "win32":
        ergebnis = subprocess.run(
            ["tasklist", "/FI", f"PID eq {pid}", "/NH"], capture_output=True, text=True, check=False
        )
        return str(pid) in ergebnis.stdout
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def _beende_pid(pid: int) -> None:
    if sys.platform == "win32":
        subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], capture_output=True, check=False)
    else:
        try:
            os.kill(pid, 9)
        except OSError:
            pass


def ermittle_browser_pid(playwright_browser) -> int | None:
    """PID des eigentlichen Browserprozesses (bei Opera nicht der Launcher)."""
    try:
        sitzung = playwright_browser.new_browser_cdp_session()
        info = sitzung.send("SystemInfo.getProcessInfo")
        for prozess in info.get("processInfo", []):
            if prozess.get("type") == "browser":
                return int(prozess["id"])
    except Exception:  # noqa: BLE001 - nicht jeder Browser kennt den Befehl
        return None
    return None


def raeume_cache_ordner_auf(cache_ordner: Path) -> bool:
    return loesche_baum(cache_ordner)


def browser_verfuegbar() -> list[str]:
    """Für Diagnosen: welche Browser auf diesem Rechner gefunden werden."""
    return [f"{BROWSER_NAMEN[a]}: {p}" for a in BROWSER_REIHENFOLGE for p in kandidaten(a) if p.is_file()]


__all__ = [
    "BROWSER_REIHENFOLGE",
    "BrowserFehler",
    "BrowserFund",
    "LaufenderBrowser",
    "Aufraeumbericht",
    "Freigabe",
    "beende_browser",
    "browser_verfuegbar",
    "ermittle_browser_pid",
    "finde_browser",
    "offene_seiten",
    "profil_in_benutzung",
    "raeume_cache_ordner_auf",
    "raeume_profil_auf",
    "starte_browser",
    "warte_auf_freigabe",
]
