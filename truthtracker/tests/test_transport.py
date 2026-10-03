"""Transport: Abbruchregeln, Pausen, Medienabruf mit Kopfprüfung, automatischer Browser-Wechsel."""

from __future__ import annotations

import pytest

from fake_truthsocial import FakeTruthSocial, Zustand
from truthtracker import cloudflare, transport
from truthtracker.db import LaufZaehler
from truthtracker.konfig import Konfig, PausenKonfig
from truthtracker.medien import MedienFehler


def _konfig(url: str) -> Konfig:
    k = Konfig()
    k.basis_url = url
    k.pausen = PausenKonfig(2.0, 6.0, 1.0, 3.0)
    return k


class Schlaf:
    def __init__(self):
        self.pausen: list[float] = []

    def __call__(self, sekunden: float) -> None:
        self.pausen.append(sekunden)


def test_pause_vor_jeder_anfrage_ausser_der_ersten():
    with FakeTruthSocial(Zustand()) as fake:
        schlaf = Schlaf()
        t = transport.CurlTransport(_konfig(fake.url), LaufZaehler(), schlafen=schlaf)
        for _ in range(4):
            assert t.hole_json("/api/v1/accounts/lookup", {"acct": "realDonaldTrump"}).ok
        t.schliessen()
    assert len(schlaf.pausen) == 3 and all(2.0 <= p <= 6.0 for p in schlaf.pausen)


@pytest.mark.parametrize(
    ("einstellen", "art", "zaehler_feld"),
    [
        (lambda z: setattr(z, "challenge_ohne_cookie", True), cloudflare.CHALLENGE, "cloudflare_challenges"),
        (lambda z: setattr(z, "geoblock", True), cloudflare.GEOBLOCK, "cloudflare_blocks"),
        (lambda z: setattr(z, "ratelimit_ab", 1), cloudflare.RATELIMIT, None),
    ],
)
def test_abbruch_bei_sperren(einstellen, art, zaehler_feld):
    z = Zustand()
    einstellen(z)
    zaehler = LaufZaehler()
    with FakeTruthSocial(z) as fake:
        t = transport.CurlTransport(_konfig(fake.url), zaehler, schlafen=lambda _s: None)
        with pytest.raises(transport.Abbruch) as info:
            t.hole_json("/api/v1/accounts/lookup", {"acct": "realDonaldTrump"})
    assert info.value.bewertung.art == art
    assert zaehler.anfragen_api == 1
    if zaehler_feld:
        assert getattr(zaehler, zaehler_feld) == 1


def test_404_und_401_und_netzwerkfehler_sind_kein_abbruch():
    z = Zustand()
    z.abbruch_pfade = [r"^/api/v1/statuses/1$"]
    with FakeTruthSocial(z) as fake:
        t = transport.CurlTransport(_konfig(fake.url), LaufZaehler(), schlafen=lambda _s: None)
        assert t.hole_json("/api/v1/statuses/999").art == cloudflare.NICHT_GEFUNDEN
        assert t.hole_json("/api/v1/accounts/1/statuses").art == cloudflare.LOGIN_NOETIG
        assert t.hole_json("/api/v1/statuses/1").art == cloudflare.NETZWERKFEHLER


def test_medien_bild_wird_geladen():
    with FakeTruthSocial(Zustand()) as fake:
        zaehler = LaufZaehler()
        t = transport.CurlTransport(_konfig(fake.url), zaehler, schlafen=lambda _s: None)
        daten = t.hole_bytes(f"{fake.url}/media/original/a.png")
    assert daten.startswith(b"\x89PNG") and zaehler.anfragen_medien == 1


@pytest.mark.parametrize("pfad", ["/media/original/film.mp4", "/media/riesig.png", "/gibtsnicht.png"])
def test_medien_ablehnung_ohne_sperre(pfad):
    with FakeTruthSocial(Zustand()) as fake:
        t = transport.CurlTransport(_konfig(fake.url), LaufZaehler(), schlafen=lambda _s: None)
        with pytest.raises(MedienFehler) as info:
            t.hole_bytes(fake.url + pfad)
        assert "127.0.0.1" not in str(info.value) and pfad not in str(info.value)
        # danach geht ein Bild weiterhin
        assert t.hole_bytes(f"{fake.url}/media/original/b.png").startswith(b"\x89PNG")


def test_medien_challenge_stoppt_alle_medien_und_nennt_den_grund():
    z = Zustand()
    z.challenge_pfade = [r"^/media/"]
    zaehler = LaufZaehler()
    with FakeTruthSocial(z) as fake:
        t = transport.CurlTransport(_konfig(fake.url), zaehler, schlafen=lambda _s: None)
        with pytest.raises(MedienFehler):
            t.hole_bytes(f"{fake.url}/media/original/a.png")
        vorher = len(z.anfragen)
        with pytest.raises(MedienFehler):
            t.hole_bytes(f"{fake.url}/media/original/b.png")
        assert len(z.anfragen) == vorher  # keine weitere Medienanfrage
    # Den Lauf beendet der Crawler vor seiner nächsten API-Anfrage (siehe test_crawler).
    assert t.medien_abbruch is not None and t.medien_abbruch.art == cloudflare.CHALLENGE
    assert zaehler.cloudflare_challenges == 1 and zaehler.anfragen_medien == 1


@pytest.mark.parametrize(
    ("antwort", "stopp", "blocks"),
    [
        ((429, "text/plain", b"Too Many Requests"), cloudflare.RATELIMIT, 0),
        ((403, "text/plain; charset=UTF-8", b"error code: 1010"), cloudflare.BLOCKIERT, 1),
        ((403, "text/html", b"<html><title>Access denied | x used Cloudflare to restrict access</title></html>"),
         cloudflare.BLOCKIERT, 1),
        ((403, "application/xml", b"<?xml version='1.0'?><Error><Code>AccessDenied</Code></Error>"), None, 0),
    ],
)
def test_medien_sperren_und_einzelne_kaputte_medien(antwort, stopp, blocks):
    z = Zustand()
    z.antwort_pfade = {r"/kaputt\.png$": antwort}
    zaehler = LaufZaehler()
    with FakeTruthSocial(z) as fake:
        t = transport.CurlTransport(_konfig(fake.url), zaehler, schlafen=lambda _s: None)
        with pytest.raises(MedienFehler):
            t.hole_bytes(f"{fake.url}/media/original/kaputt.png")
        if stopp is None:
            # Ein 403 ohne Cloudflare-Merkmale (Objektspeicher) betrifft nur dieses Medium.
            assert t.medien_abbruch is None
            assert t.hole_bytes(f"{fake.url}/media/original/gut.png").startswith(b"\x89PNG")
        else:
            assert t.medien_abbruch.art == stopp
            with pytest.raises(MedienFehler):
                t.hole_bytes(f"{fake.url}/media/original/gut.png")
            assert not any(a["pfad"].endswith("gut.png") for a in z.anfragen)
    assert zaehler.cloudflare_blocks == blocks


def test_pausierer_zaehlt_eine_fremde_erste_anfrage():
    schlaf = Schlaf()
    pause = transport.Pausierer(2.0, 6.0, schlaf)
    pause.markiere_angefragt()
    pause()
    assert len(schlaf.pausen) == 1 and 2.0 <= schlaf.pausen[0] <= 6.0


def test_medien_nur_http():
    t = transport.CurlTransport(_konfig("http://127.0.0.1:9"), LaufZaehler(), schlafen=lambda _s: None)
    with pytest.raises(MedienFehler):
        t.hole_bytes("file:///etc/passwd")


class FalscherBrowser:
    weg = "browser"

    def __init__(self):
        self.anfragen: list[str] = []
        self.geschlossen = False

    def hole_json(self, pfad, params=None):
        self.anfragen.append(pfad)
        return cloudflare.Bewertung(cloudflare.OK, 200, {"id": "1"})

    def hole_bytes(self, url):
        return b""

    def schliessen(self):
        self.geschlossen = True


def test_auto_wechselt_bei_challenge_einmal_in_den_browser():
    z = Zustand()
    z.challenge_ohne_cookie = True
    browser = FalscherBrowser()
    meldungen: list[str] = []
    with FakeTruthSocial(z) as fake:
        t = transport.AutoTransport(_konfig(fake.url), LaufZaehler(), browser_fabrik=lambda: browser,
                                    schlafen=lambda _s: None, melden=meldungen.append)
        assert t.weg == "curl"
        assert t.hole_json("/api/v1/accounts/lookup", {"acct": "x"}).ok
        assert t.hole_json("/api/v1/accounts/1/statuses").ok
        assert t.weg == "curl+browser"
        t.schliessen()
        assert len(z.anfragen) == 1  # nur die eine Anfrage per curl, die die Challenge bekam
    assert browser.anfragen == ["/api/v1/accounts/lookup", "/api/v1/accounts/1/statuses"]
    assert browser.geschlossen and any("Browser" in m for m in meldungen)


def test_auto_pausiert_vor_dem_browserstart():
    z = Zustand()
    z.challenge_ohne_cookie = True
    ereignisse: list[str] = []

    def schlafen(sekunden: float) -> None:
        ereignisse.append(f"pause {sekunden:.1f}")

    def fabrik():
        ereignisse.append("browser")
        return FalscherBrowser()

    with FakeTruthSocial(z) as fake:
        t = transport.AutoTransport(_konfig(fake.url), LaufZaehler(), browser_fabrik=fabrik,
                                    schlafen=schlafen, melden=lambda _m: None)
        assert t.hole_json("/api/v1/accounts/lookup", {"acct": "x"}).ok
    # Erste curl-Anfrage ohne Pause, dann Challenge, dann eine Pause, erst danach startet der Browser.
    assert len(ereignisse) == 2 and ereignisse[0].startswith("pause") and ereignisse[1] == "browser"


def test_auto_fragt_nach_medienstopp_auch_im_browser_keine_medien_an():
    z = Zustand()
    z.challenge_pfade = [r"^/media/"]
    browser_ersatz = FalscherBrowser()
    aufrufe: list[str] = []
    browser_ersatz.hole_bytes = lambda url: aufrufe.append(url) or b""
    with FakeTruthSocial(z) as fake:
        t = transport.AutoTransport(_konfig(fake.url), LaufZaehler(), browser_fabrik=lambda: browser_ersatz,
                                    schlafen=lambda _s: None, melden=lambda _m: None)
        with pytest.raises(MedienFehler):
            t.hole_bytes(f"{fake.url}/media/original/a.png")
        assert t.medien_abbruch.art == cloudflare.CHALLENGE
        z.challenge_ohne_cookie = True  # API-Challenge: Wechsel in den (falschen) Browser
        assert t.hole_json("/api/v1/accounts/lookup", {"acct": "x"}).ok
        assert t.weg == "curl+browser"
        with pytest.raises(MedienFehler):
            t.hole_bytes(f"{fake.url}/media/original/b.png")
    assert aufrufe == []
    assert len(z.medien_anfragen()) == 1


def test_auto_wechselt_bei_429_nicht():
    z = Zustand()
    z.ratelimit_ab = 1
    with FakeTruthSocial(z) as fake:
        t = transport.AutoTransport(_konfig(fake.url), LaufZaehler(), browser_fabrik=pytest.fail,
                                    schlafen=lambda _s: None, melden=lambda _m: None)
        with pytest.raises(transport.Abbruch) as info:
            t.hole_json("/api/v1/accounts/lookup", {"acct": "x"})
    assert info.value.bewertung.art == cloudflare.RATELIMIT


@pytest.mark.browser
def test_browser_transport_mit_echtem_chromium(eigene_laufzeit):
    from conftest import browser_argumente_fuer_tests, chromium_pfad

    exe = chromium_pfad()
    if exe is None:
        pytest.skip("kein Chromium vorhanden")
    z = Zustand()
    z.challenge_ohne_cookie = True
    z.challenge_verzoegerung_ms = 1500
    zaehler = LaufZaehler()
    with FakeTruthSocial(z) as fake:
        k = _konfig(fake.url)
        k.pausen = PausenKonfig(0, 0, 0, 0)
        k.zugriff.browser = str(exe)
        k.zugriff.headless = True
        k.zugriff.browser_argumente = browser_argumente_fuer_tests()
        k.zugriff.warte_challenge_s = 30
        t = transport.BrowserTransport(k, zaehler, melden=lambda _m: None)
        try:
            assert t.hole_json("/api/v1/accounts/lookup", {"acct": "realDonaldTrump"}).ok
            assert t.hole_bytes(f"{fake.url}/media/original/a.png").startswith(b"\x89PNG")
            with pytest.raises(MedienFehler):
                t.hole_bytes(f"{fake.url}/media/original/film.mp4")
            assert t.hole_json("/api/v1/statuses/999").art == cloudflare.NICHT_GEFUNDEN
        finally:
            t.schliessen()
    assert zaehler.cloudflare_challenges == 1
    # Vor der Freigabe hat sich nichts angehängt: die Startseite war die einzige Anfrage ohne Cookie,
    # danach kamen nur Anfragen mit Freigabe.
    ohne_cookie = [a for a in z.anfragen if not a["cookie"] and a["pfad"] != "/favicon.ico"]  # Favicon holt der Browser
    assert ohne_cookie and all(a["pfad"] == "/api/v1/accounts/lookup" for a in ohne_cookie)
    profil = eigene_laufzeit / "laufzeit" / "browser-profil"
    from truthtracker import browser

    assert all(browser.im_profil_erlaubt(p.relative_to(profil)) for p in profil.rglob("*") if p.is_file())


def _browser_konfig(fake_url: str, exe) -> Konfig:
    from conftest import browser_argumente_fuer_tests

    k = _konfig(fake_url)
    k.pausen = PausenKonfig(0, 0, 0, 0)
    k.zugriff.browser = str(exe)
    k.zugriff.headless = True
    k.zugriff.browser_argumente = browser_argumente_fuer_tests()
    k.zugriff.warte_challenge_s = 30
    return k


def _chromium():
    from conftest import chromium_pfad

    exe = chromium_pfad()
    if exe is None:
        pytest.skip("kein Chromium vorhanden")
    return exe


def _profil_sauber(eigene_laufzeit) -> bool:
    from truthtracker import browser

    profil = eigene_laufzeit / "laufzeit" / "browser-profil"
    return all(browser.im_profil_erlaubt(p.relative_to(profil)) for p in profil.rglob("*") if p.is_file())


@pytest.mark.browser
def test_browser_startseite_mit_429_bricht_ohne_zweite_anfrage_ab(eigene_laufzeit):
    exe = _chromium()
    z = Zustand()
    z.ratelimit_ab = 1
    with FakeTruthSocial(z) as fake:
        with pytest.raises(transport.Abbruch) as info:
            transport.BrowserTransport(_browser_konfig(fake.url, exe), LaufZaehler(), melden=lambda _m: None)
    assert info.value.bewertung.art == cloudflare.RATELIMIT
    assert len(z.api_anfragen()) == 1  # nur die Startseite selbst
    assert _profil_sauber(eigene_laufzeit)


@pytest.mark.browser
def test_browser_sperrwoerter_im_inhalt_sind_keine_sperre_und_erster_fetch_pausiert(eigene_laufzeit):
    from fabrik import MARKER

    exe = _chromium()
    z = Zustand()
    z.konten["realDonaldTrump"]["note"] = (
        f"<p>{MARKER} You have been blocked. Truth Social is unavailable in your area. Error 1020.</p>"
    )
    schlaf = Schlaf()
    with FakeTruthSocial(z) as fake:
        k = _browser_konfig(fake.url, exe)
        k.pausen = PausenKonfig(0.01, 0.02, 0, 0)
        t = transport.BrowserTransport(k, LaufZaehler(), schlafen=schlaf, melden=lambda _m: None)
        try:
            assert schlaf.pausen == []
            assert t.hole_json("/api/v1/accounts/lookup", {"acct": "realDonaldTrump"}).ok
            # Die Startseite war die erste Anfrage; der erste fetch danach bekommt seine Pause.
            assert len(schlaf.pausen) == 1
        finally:
            t.schliessen()


@pytest.mark.browser
def test_browser_zweite_challenge_mitten_im_lauf(eigene_laufzeit):
    exe = _chromium()
    z = Zustand()
    z.challenge_ohne_cookie = True
    z.challenge_verzoegerung_ms = 1500
    zaehler = LaufZaehler()
    meldungen: list[str] = []
    with FakeTruthSocial(z) as fake:
        t = transport.BrowserTransport(_browser_konfig(fake.url, exe), zaehler, melden=meldungen.append)
        try:
            assert t.hole_json("/api/v1/accounts/lookup", {"acct": "realDonaldTrump"}).ok
            z.neue_freigabe_noetig()  # die Freigabe läuft ab
            assert t.hole_json("/api/v1/statuses/999").art == cloudflare.NICHT_GEFUNDEN
            assert t.hole_json("/api/v1/accounts/lookup", {"acct": "realDonaldTrump"}).ok
        finally:
            t.schliessen()
    assert zaehler.cloudflare_challenges == 2
    # Nach der zweiten Freigabe tragen alle Anfragen das neue Cookie.
    letzte = z.anfragen[-1]
    assert letzte["freigegeben"] and letzte["pfad"] == "/api/v1/accounts/lookup"
    assert _profil_sauber(eigene_laufzeit)


@pytest.mark.browser
def test_browser_geschlossenes_fenster_beendet_das_warten(eigene_laufzeit):
    import os
    import signal
    import threading
    import time

    if os.name == "nt":
        pytest.skip("POSIX-Sperrdatei zum Finden des Browserprozesses")
    exe = _chromium()
    z = Zustand()
    z.challenge_ohne_cookie = True
    z.challenge_verzoegerung_ms = 10_000_000  # wird nie gelöst
    profil = eigene_laufzeit / "laufzeit" / "browser-profil"

    def fenster_schliessen() -> None:
        ende = time.monotonic() + 30
        while time.monotonic() < ende:
            try:
                pid = int(os.readlink(profil / "SingletonLock").rsplit("-", 1)[-1])
            except (OSError, ValueError):
                time.sleep(0.2)
                continue
            time.sleep(2.0)
            os.kill(pid, signal.SIGKILL)
            return

    with FakeTruthSocial(z) as fake:
        helfer = threading.Thread(target=fenster_schliessen, daemon=True)
        helfer.start()
        beginn = time.monotonic()
        with pytest.raises(transport.TransportFehler) as info:
            transport.BrowserTransport(_browser_konfig(fake.url, exe), LaufZaehler(), melden=lambda _m: None)
        dauer = time.monotonic() - beginn
        helfer.join(5)
    assert "geschlossen" in str(info.value)
    assert dauer < 25  # nicht erst nach warte_challenge_s
    assert _profil_sauber(eigene_laufzeit)


def test_schliessen_raeumt_auf_auch_wenn_beenden_scheitert(tmp_path, monkeypatch):
    from truthtracker import browser

    profil = tmp_path / "profil"
    (profil / "Default").mkdir(parents=True)
    (profil / "Default" / "History").write_bytes(b"\x00")
    (profil / "Local State").write_bytes(b"{}")
    cache = tmp_path / "cache"
    cache.mkdir()
    (cache / "data_0").write_bytes(b"\x00")

    def scheitert(*_a, **_kw):
        raise UnicodeDecodeError("utf-8", b"\x81", 0, 1, "ungültig")

    monkeypatch.setattr(browser, "beende_browser", scheitert)
    monkeypatch.setattr(browser, "laeuft", lambda _lauf: False)
    t = object.__new__(transport.BrowserTransport)
    t._lauf, t._seite, t._pw, t._pw_browser = object(), None, None, None
    t._profil, t._cache, t.profil_belegt, t.profil_reste = profil, cache, False, 0
    t.schliessen()
    assert not (profil / "Default" / "History").exists() and (profil / "Local State").exists()
    assert not cache.exists()
    assert not t.profil_belegt and t.profil_reste == 0


def test_schliessen_meldet_profil_in_benutzung(tmp_path, monkeypatch):
    from truthtracker import browser

    profil = tmp_path / "profil"
    (profil / "Default").mkdir(parents=True)
    (profil / "Default" / "History").write_bytes(b"\x00")
    monkeypatch.setattr(browser, "profil_in_benutzung", lambda _p: True)
    t = object.__new__(transport.BrowserTransport)
    t._lauf, t._seite, t._pw, t._pw_browser = None, None, None, None
    t._profil, t._cache, t.profil_belegt, t.profil_reste = profil, tmp_path / "cache", False, 0
    t.PROFIL_NACHWARTEN_S = 0.0
    t.schliessen()
    assert t.profil_belegt
    assert (profil / "Default" / "History").exists()  # belegt: nichts angefasst
