import os
import socket
import subprocess
import threading
import time
from pathlib import Path

import pytest

from truthtracker import browser


def _datei(pfad: Path, inhalt: bytes = b"x") -> None:
    pfad.parent.mkdir(parents=True, exist_ok=True)
    pfad.write_bytes(inhalt)


def test_profil_aufraeumen_behaelt_nur_cookies_und_einstellungen(tmp_path):
    profil = tmp_path / "profil"
    behalten = [
        "Local State",
        "First Run",
        "Default/Preferences",
        "Default/Secure Preferences",
        "Default/Network/Cookies",
        "Default/Network/Cookies-journal",
        "Network/Cookies",  # Opera-Aufbau ohne Default/
        "Preferences",
    ]
    weg = [
        "Default/Cache/Cache_Data/data_1",
        "Default/Code Cache/js/index",
        "Default/History",
        "Default/Visited Links",
        "Default/Local Storage/leveldb/000003.log",
        "Default/IndexedDB/https_truthsocial.com_0.indexeddb.leveldb/000003.log",
        "Default/Service Worker/CacheStorage/abc/index",
        "Default/Sessions/Session_1",
        "Default/Favicons",
        "Default/Top Sites",
        "GPUCache/data_0",
        "Default/Network/TransportSecurity",
        "Default/Cache/Cookies",  # gleicher Name an falscher Stelle
        "DevToolsActivePort",
    ]
    for name in behalten + weg:
        _datei(profil / name)
    bericht = browser.raeume_profil_auf(profil)
    for name in behalten:
        assert (profil / name).exists(), name
    for name in weg:
        assert not (profil / name).exists(), name
    assert not (profil / "Default" / "Cache").exists()
    assert bericht.geloescht == len(weg)
    assert sorted(bericht.behalten) == sorted(behalten)
    assert bericht.nicht_loeschbar == []


def test_profil_aufraeumen_ohne_profil(tmp_path):
    assert browser.raeume_profil_auf(tmp_path / "gibtsnicht").geloescht == 0


def test_opera_versionierte_exe_wird_dem_launcher_vorgezogen(tmp_path, monkeypatch):
    basis = tmp_path / "Programs" / "Opera"
    _datei(basis / "opera.exe")
    _datei(basis / "112.0.5197.53" / "opera.exe")
    _datei(basis / "113.0.5230.47" / "opera.exe")
    _datei(basis / "assistant" / "opera.exe")
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    monkeypatch.delenv("ProgramFiles", raising=False)
    monkeypatch.delenv("ProgramFiles(x86)", raising=False)
    fund = browser.finde_browser("opera")
    assert fund is not None and fund.art == "opera"
    assert fund.pfad == basis / "113.0.5230.47" / "opera.exe"


def test_auto_reihenfolge_opera_vor_chrome_vor_edge(tmp_path, monkeypatch):
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path / "lokal"))
    monkeypatch.setenv("ProgramFiles", str(tmp_path / "pf"))
    monkeypatch.setenv("ProgramFiles(x86)", str(tmp_path / "pf86"))
    _datei(tmp_path / "pf86" / "Microsoft" / "Edge" / "Application" / "msedge.exe")
    assert browser.finde_browser("auto").art == "edge"
    _datei(tmp_path / "pf" / "Google" / "Chrome" / "Application" / "chrome.exe")
    assert browser.finde_browser("auto").art == "chrome"
    _datei(tmp_path / "lokal" / "Programs" / "Opera" / "opera.exe")
    assert browser.finde_browser("auto").art == "opera"


def test_eigener_pfad(tmp_path):
    exe = tmp_path / "mein-browser.exe"
    _datei(exe)
    fund = browser.finde_browser(str(exe))
    assert fund.art == "eigener" and fund.pfad == exe
    assert browser.finde_browser(str(tmp_path / "fehlt.exe")) is None


@pytest.mark.skipif(os.name == "nt", reason="POSIX-Sperrdatei")
def test_profil_in_benutzung_posix(tmp_path):
    profil = tmp_path / "p"
    profil.mkdir()
    assert not browser.profil_in_benutzung(profil)
    os.symlink(f"rechner-{os.getpid()}", profil / "SingletonLock")
    assert browser.profil_in_benutzung(profil)
    (profil / "SingletonLock").unlink()
    os.symlink("rechner-999999999", profil / "SingletonLock")
    assert not browser.profil_in_benutzung(profil)


def test_pid_pruefung_unter_deutschem_windows_wirft_nicht(monkeypatch):
    # Ohne Prozess-API (hier: Linux) fällt die Prüfung auf tasklist zurück; dessen Ausgabe ist cp850.
    def ohne_api(_pid):
        raise OSError("keine kernel32")

    ausgaben = {
        4242: b'"opera.exe","4242","Console","1","123.456 K"\r\n',
        4343: b"INFORMATION: Es werden keine Aufgaben mit den angegebenen Kriterien ausgef\x81hrt.\r\n",
    }

    def tasklist(befehl, **kwargs):
        assert "text" not in kwargs and "encoding" not in kwargs  # nie als Text dekodieren
        pid = int(befehl[2].split()[-1])
        return subprocess.CompletedProcess(befehl, 0, stdout=ausgaben[pid], stderr=b"")

    monkeypatch.setattr(browser.sys, "platform", "win32")
    monkeypatch.setattr(browser, "_pid_lebt_windows", ohne_api)
    monkeypatch.setattr(browser.subprocess, "run", tasklist)
    assert browser._pid_lebt(4242) is True
    assert browser._pid_lebt(4343) is False


def _launcher_lauf(tmp_path, browser_pid):
    import sys

    launcher = subprocess.Popen([sys.executable, "-c", "pass"])  # endet sofort, wie Operas Launcher
    launcher.wait()
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]  # danach geschlossen: kein DevTools-Port mehr
    fund = browser.BrowserFund("opera", tmp_path / "launcher.exe")
    return browser.LaufenderBrowser(fund=fund, prozess=launcher, port=port, profil=tmp_path, browser_pid=browser_pid)


def test_beenden_wartet_auf_den_echten_browser_nicht_auf_den_launcher(tmp_path, monkeypatch):
    lebend = {4242}
    monkeypatch.setattr(browser, "_pid_lebt", lambda pid: pid in lebend)
    # Die Profilsperre ist schon frei; entscheidend ist hier allein der echte Browserprozess.
    monkeypatch.setattr(browser, "profil_in_benutzung", lambda _p: False)
    monkeypatch.setattr(browser, "_beende_pid", lambda pid: lebend.discard(pid))
    threading.Timer(1.0, lambda: lebend.discard(4242)).start()  # der Browser schließt sich verzögert
    beginn = time.monotonic()
    assert browser.beende_browser(_launcher_lauf(tmp_path, 4242), None, timeout_s=10) is True
    assert time.monotonic() - beginn >= 0.9


def test_beenden_ohne_pid_meldet_belegtes_profil(tmp_path, monkeypatch):
    monkeypatch.setattr(browser, "profil_in_benutzung", lambda _p: True)
    assert browser.beende_browser(_launcher_lauf(tmp_path, None), None, timeout_s=0.5) is False


def test_freigabe_endet_wenn_das_fenster_geschlossen_wird(tmp_path):
    lauf = _launcher_lauf(tmp_path, None)
    beginn = time.monotonic()
    freigabe = browser.warte_auf_freigabe(lauf, "127.0.0.1", timeout_s=60, melden=lambda _m: None)
    assert freigabe.browser_beendet and not freigabe.geloest
    assert time.monotonic() - beginn < 5
