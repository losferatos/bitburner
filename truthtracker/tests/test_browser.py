import os
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
