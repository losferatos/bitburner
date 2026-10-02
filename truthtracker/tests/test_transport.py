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


def test_medien_challenge_stoppt_nur_medien():
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
        assert t.hole_json("/api/v1/accounts/lookup", {"acct": "realDonaldTrump"}).ok  # API geht weiter
    assert zaehler.cloudflare_challenges == 1 and zaehler.anfragen_medien == 1


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
