"""HTTP-Zugriff auf Truth Social: direkt per curl_cffi oder über einen echten Browser.

Gemeinsame Regeln für alle Wege:

* Vor jeder API-Anfrage außer der ersten eine zufällige Pause (``[pausen] api_*``), vor
  jedem Medienabruf eine eigene, kürzere (``[pausen] medien_*``). Nie parallel.
* Challenge, Cloudflare-Block, Regionssperre, 403 und 429 beenden den Lauf: ``Abbruch``.
  Danach wird nichts mehr angefragt.
* Netzwerk- und Serverfehler kommen als ``Bewertung`` zurück; der Crawler entscheidet.
* Medien: Eine Sperre auf dem Medienweg stoppt nur die weiteren Medienabrufe dieses Laufs,
  die API-Abfragen laufen weiter (anderer Host, siehe docs/entscheidungen.md).
* Fehlertexte enthalten nie URLs von Medien oder Inhalte, nur Fehlerklassen und Statuscodes.

``AutoTransport`` beginnt direkt und wechselt bei der ersten Cloudflare-Prüfung einmalig in
den Browser: Das Fenster öffnet sich, der Mensch löst die Prüfung, der Lauf geht dort weiter.
"""

from __future__ import annotations

import logging
import os
import random
import time
from collections.abc import Callable
from typing import Any, Protocol
from urllib.parse import urlencode, urlparse

from truthtracker import browser, cloudflare, pfade
from truthtracker.db import LaufZaehler
from truthtracker.konfig import Konfig

log = logging.getLogger(__name__)

API_ACCEPT = "application/json, text/plain, */*"
BILD_ACCEPT = "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
MAX_MEDIEN_BYTES = 20_000_000

_SPERR_ARTEN = frozenset({cloudflare.BLOCKIERT, cloudflare.GEOBLOCK, cloudflare.VERWEIGERT})


class Abbruch(Exception):
    """Der Lauf muss enden; es darf nichts mehr angefragt werden."""

    def __init__(self, bewertung: cloudflare.Bewertung):
        super().__init__(cloudflare.melde(bewertung))
        self.bewertung = bewertung


class TransportFehler(RuntimeError):
    """Ein Zugriffsweg lässt sich gar nicht erst herstellen (z. B. kein Browser installiert)."""


def _medien_fehler(meldung: str) -> Exception:
    from truthtracker.medien import MedienFehler

    return MedienFehler(meldung)


class Transport(Protocol):
    weg: str

    def hole_json(self, pfad: str, params: dict[str, Any] | None = None) -> cloudflare.Bewertung: ...

    def hole_bytes(self, url: str) -> bytes: ...

    def schliessen(self) -> None: ...


class Pausierer:
    """Zufällige Pause vor jeder Anfrage außer der allerersten."""

    def __init__(self, minimum: float, maximum: float, schlafen: Callable[[float], None] = time.sleep):
        self.minimum = minimum
        self.maximum = maximum
        self._schlafen = schlafen
        self._erste = True

    def __call__(self) -> None:
        if self._erste:
            self._erste = False
            return
        if self.maximum > 0:
            self._schlafen(random.uniform(self.minimum, self.maximum))


def _pruefe_abbruch(bewertung: cloudflare.Bewertung, zaehler: LaufZaehler) -> None:
    if bewertung.art == cloudflare.CHALLENGE:
        zaehler.cloudflare_challenges += 1
    elif bewertung.art in _SPERR_ARTEN:
        zaehler.cloudflare_blocks += 1
    if bewertung.abbruch:
        raise Abbruch(bewertung)


def _ist_http_url(url: str) -> bool:
    return urlparse(url).scheme in ("http", "https")


# ---------------------------------------------------------------------------
# curl_cffi


class CurlTransport:
    weg = "curl"

    def __init__(self, konfig: Konfig, zaehler: LaufZaehler, *, schlafen: Callable[[float], None] = time.sleep):
        from curl_cffi import requests as cffi_requests

        self._basis = konfig.basis_url.rstrip("/")
        self._referer = f"{self._basis}/@{konfig.konto.handle}"
        self._zaehler = zaehler
        self._api_pause = Pausierer(konfig.pausen.api_min_s, konfig.pausen.api_max_s, schlafen)
        self._medien_pause = Pausierer(konfig.pausen.medien_min_s, konfig.pausen.medien_max_s, schlafen)
        self._sitzung = cffi_requests.Session(impersonate=konfig.zugriff.impersonate, timeout=30)
        self._medien_gesperrt: str | None = None

    def hole_json(self, pfad: str, params: dict[str, Any] | None = None) -> cloudflare.Bewertung:
        self._api_pause()
        self._zaehler.anfragen_api += 1
        try:
            antwort = self._sitzung.get(
                self._basis + pfad, params=params, headers={"Accept": API_ACCEPT, "Referer": self._referer}
            )
        except Exception as fehler:  # noqa: BLE001 - jede Störung der Verbindung zählt gleich
            return cloudflare.Bewertung(cloudflare.NETZWERKFEHLER, None, hinweis=type(fehler).__name__)
        bewertung = cloudflare.bewerte(antwort.status_code, antwort.headers, antwort.content)
        _pruefe_abbruch(bewertung, self._zaehler)
        return bewertung

    def hole_bytes(self, url: str) -> bytes:
        if self._medien_gesperrt:
            raise _medien_fehler(f"Medienabruf in diesem Lauf gestoppt ({self._medien_gesperrt})")
        if not _ist_http_url(url):
            raise _medien_fehler("Medienadresse ist keine http(s)-Adresse")
        self._medien_pause()
        self._zaehler.anfragen_medien += 1
        teile: list[bytes] = []
        groesse = 0
        try:
            antwort = self._sitzung.request(
                "GET", url, headers={"Accept": BILD_ACCEPT, "Referer": self._basis + "/"}, stream=True
            )
            try:
                status = antwort.status_code
                kopf = cloudflare.kopfzeilen(antwort.headers)
                for teil in antwort.iter_content():
                    groesse += len(teil)
                    if groesse > MAX_MEDIEN_BYTES:
                        raise _medien_fehler("Mediendatei größer als erlaubt")
                    teile.append(teil)
            finally:
                antwort.close()
        except Exception as fehler:  # noqa: BLE001
            from truthtracker.medien import MedienFehler

            if isinstance(fehler, MedienFehler):
                raise
            raise _medien_fehler(f"Netzwerkfehler beim Medienabruf ({type(fehler).__name__})") from None
        daten = b"".join(teile)
        return self._bewerte_medien(status, kopf, daten)

    def _bewerte_medien(self, status: int, kopf: dict[str, str], daten: bytes) -> bytes:
        if status == 200 and kopf.get("content-type", "").lower().startswith("image/"):
            return daten
        bewertung = cloudflare.bewerte(status, kopf, daten)
        if bewertung.art in (cloudflare.CHALLENGE, cloudflare.RATELIMIT) or bewertung.art in _SPERR_ARTEN:
            if bewertung.art == cloudflare.CHALLENGE:
                self._zaehler.cloudflare_challenges += 1
            elif bewertung.art in _SPERR_ARTEN:
                self._zaehler.cloudflare_blocks += 1
            self._medien_gesperrt = bewertung.art
            log.warning("Medienabruf gestoppt: %s", cloudflare.melde(bewertung))
        raise _medien_fehler(f"Medienabruf fehlgeschlagen (HTTP {status}, {bewertung.art})")

    def schliessen(self) -> None:
        try:
            self._sitzung.close()
        except Exception:  # noqa: BLE001
            pass


# ---------------------------------------------------------------------------
# Echter Browser


FETCH_JS = """async (url) => {
  const antwort = await fetch(url, {credentials: 'include', headers: {'Accept': 'application/json, text/plain, */*'}});
  const text = await antwort.text();
  const kopf = {};
  antwort.headers.forEach((wert, name) => { kopf[name] = wert; });
  return {status: antwort.status, kopf: kopf, text: text};
}"""

_CHALLENGE_SELEKTOR = (
    "iframe[src*='challenges.cloudflare.com'], #challenge-form, #challenge-stage, #cf-challenge-running, "
    "#turnstile-wrapper, script[src*='/cdn-cgi/challenge-platform/']"
)


def seite_zeigt_challenge(seite) -> bool:
    try:
        titel = (seite.title() or "").lower()
    except Exception:  # noqa: BLE001 - während einer Navigation wirft title()
        return True
    if any(m in titel for m in browser.CHALLENGE_TITEL):
        return True
    try:
        return seite.locator(_CHALLENGE_SELEKTOR).count() > 0
    except Exception:  # noqa: BLE001
        return True


def seite_zeigt_sperre(seite) -> str | None:
    try:
        text = (seite.locator("body").inner_text(timeout=3000) or "").lower()
    except Exception:  # noqa: BLE001
        return None
    if "unavailable in your area" in text:
        return cloudflare.GEOBLOCK
    if "you have been blocked" in text or "error 1020" in text:
        return cloudflare.BLOCKIERT
    return None


class BrowserTransport:
    """Opera/Chrome/Edge mit eigenem Profil; API-Aufrufe per ``fetch`` aus der geöffneten Seite.

    Ablauf: Browser normal starten, direkt mit der Konto-Abfrage als Startseite (eine API-Adresse,
    damit eine Prüfung genau dort erscheint, wo später abgefragt wird, und die Web-App mit ihren
    Bildern gar nicht erst lädt). Solange Cloudflare prüft, hängt sich nichts an den Browser; nur die
    Tab-Titel werden über den lokalen DevTools-Endpunkt gelesen. Erst nach der Freigabe verbindet
    sich Playwright, schaltet den Cache ab und sperrt Bilder und Videos.
    """

    weg = "browser"

    def __init__(
        self,
        konfig: Konfig,
        zaehler: LaufZaehler,
        *,
        schlafen: Callable[[float], None] = time.sleep,
        melden: Callable[[str], None] = print,
    ):
        self._konfig = konfig
        self._zaehler = zaehler
        self._melden = melden
        self._basis = konfig.basis_url.rstrip("/")
        self._host = urlparse(self._basis).hostname or ""
        self._start_url = f"{self._basis}/api/v1/accounts/lookup?{urlencode({'acct': konfig.konto.handle})}"
        self._api_pause = Pausierer(konfig.pausen.api_min_s, konfig.pausen.api_max_s, schlafen)
        self._medien_pause = Pausierer(konfig.pausen.medien_min_s, konfig.pausen.medien_max_s, schlafen)
        self._medien_gesperrt: str | None = None
        self._lauf: browser.LaufenderBrowser | None = None
        self._pw = None
        self._pw_browser = None
        self._seite = None
        self._medien_seite = None
        self._challenge_wiederholt = False

        fund = browser.finde_browser(konfig.zugriff.browser)
        if fund is None:
            raise TransportFehler(
                "Kein Browser gefunden. Installiert sein muss Opera, Chrome oder Edge, oder in config.toml "
                "unter [zugriff] browser der Pfad zur .exe stehen."
            )
        self._profil = pfade.profil_ordner()
        if not browser.profil_in_benutzung(self._profil):
            browser.raeume_profil_auf(self._profil)
        self._cache = pfade.temp_ordner() / f"browser-cache-{os.getpid()}-{time.time_ns()}"
        try:
            self._starte(fund)
        except BaseException:
            self.schliessen()
            raise

    def _starte(self, fund: browser.BrowserFund) -> None:
        from playwright.sync_api import sync_playwright

        self._lauf = browser.starte_browser(
            fund,
            self._profil,
            self._cache,
            start_url=self._start_url,
            headless=self._konfig.zugriff.headless,
            zusatz_argumente=tuple(self._konfig.zugriff.browser_argumente),
        )
        self._zaehler.anfragen_api += 1  # die Startseite ist die erste Anfrage an Truth Social
        log.info("Browser gestartet: %s %s", fund.name, self._lauf.version)
        freigabe = browser.warte_auf_freigabe(
            self._lauf, self._host, timeout_s=self._konfig.zugriff.warte_challenge_s, melden=self._melden
        )
        if freigabe.challenge_gesehen:
            self._zaehler.cloudflare_challenges += 1
        if not freigabe.geloest and not freigabe.sperrseite:
            raise Abbruch(cloudflare.Bewertung(cloudflare.CHALLENGE, None, hinweis="nicht gelöst"))

        self._pw = sync_playwright().start()
        self._pw_browser = self._pw.chromium.connect_over_cdp(self._lauf.cdp_url)
        self._lauf.browser_pid = browser.ermittle_browser_pid(self._pw_browser)
        kontext = self._pw_browser.contexts[0] if self._pw_browser.contexts else self._pw_browser.new_context()
        passende = [s for s in kontext.pages if self._host in s.url]
        self._seite = passende[0] if passende else (kontext.pages[0] if kontext.pages else kontext.new_page())
        self._cache_aus(kontext, self._seite)
        self._seite.route("**/*", self._sperre_medien)
        self._pruefe_seite()

    @staticmethod
    def _cache_aus(kontext, seite) -> None:
        try:
            cdp = kontext.new_cdp_session(seite)
            cdp.send("Network.enable")
            cdp.send("Network.setCacheDisabled", {"cacheDisabled": True})
        except Exception:  # noqa: BLE001 - ohne CDP bleibt das Aufräumen nach dem Lauf
            log.warning("Browser-Cache ließ sich nicht abschalten; er wird nach dem Lauf gelöscht.")

    @staticmethod
    def _sperre_medien(route) -> None:
        # Seiten von Truth Social würden sonst Bilder und Videos laden, die niemand braucht.
        anfrage = route.request
        host = urlparse(anfrage.url).hostname or ""
        if anfrage.resource_type in ("image", "media") and "cloudflare" not in host:
            route.abort()
        else:
            route.continue_()

    def _pruefe_seite(self) -> None:
        """Nach dem Anhängen: Sperrseite → Abbruch; noch eine Prüfung sichtbar → weiter warten."""
        sperre = seite_zeigt_sperre(self._seite)
        if sperre:
            self._zaehler.cloudflare_blocks += 1
            raise Abbruch(cloudflare.Bewertung(sperre, None))
        if not seite_zeigt_challenge(self._seite):
            return
        warte = self._konfig.zugriff.warte_challenge_s
        self._melden(
            "\n>>> Cloudflare-Prüfung im Browserfenster. Bitte dort lösen "
            f"(höchstens {warte / 60:.0f} Minuten). Der Lauf wartet.\n"
        )
        ende = time.monotonic() + warte
        while time.monotonic() < ende:
            self._seite.wait_for_timeout(2000)
            if not seite_zeigt_challenge(self._seite):
                self._melden("Prüfung gelöst, der Lauf geht weiter.")
                return
        raise Abbruch(cloudflare.Bewertung(cloudflare.CHALLENGE, None, hinweis="nicht gelöst"))

    def _oeffne_startseite(self) -> None:
        """Freigabe abgelaufen: Startseite im angehängten Tab neu laden und auf den Menschen warten."""
        self._zaehler.anfragen_api += 1
        try:
            self._seite.goto(self._start_url, wait_until="domcontentloaded", timeout=60_000)
        except Exception as fehler:  # noqa: BLE001
            log.warning("Startseite ließ sich nicht öffnen (%s)", type(fehler).__name__)
        self._seite.wait_for_timeout(1500)
        self._pruefe_seite()

    def hole_json(self, pfad: str, params: dict[str, Any] | None = None) -> cloudflare.Bewertung:
        self._api_pause()
        url = self._basis + pfad + (f"?{urlencode(params)}" if params else "")
        self._zaehler.anfragen_api += 1
        try:
            roh = self._seite.evaluate(FETCH_JS, url)
        except Exception as fehler:  # noqa: BLE001
            return cloudflare.Bewertung(cloudflare.NETZWERKFEHLER, None, hinweis=type(fehler).__name__)
        bewertung = cloudflare.bewerte(roh["status"], roh["kopf"], roh["text"])
        if bewertung.art == cloudflare.CHALLENGE and not self._challenge_wiederholt:
            # Freigabe abgelaufen: Startseite neu öffnen, Mensch löst erneut, einmal wiederholen.
            self._challenge_wiederholt = True
            self._zaehler.cloudflare_challenges += 1
            self._oeffne_startseite()
            return self.hole_json(pfad, params)
        _pruefe_abbruch(bewertung, self._zaehler)
        return bewertung

    def hole_bytes(self, url: str) -> bytes:
        if self._medien_gesperrt:
            raise _medien_fehler(f"Medienabruf in diesem Lauf gestoppt ({self._medien_gesperrt})")
        if not _ist_http_url(url):
            raise _medien_fehler("Medienadresse ist keine http(s)-Adresse")
        self._medien_pause()
        self._zaehler.anfragen_medien += 1
        if self._medien_seite is None:
            kontext = self._seite.context
            self._medien_seite = kontext.new_page()
            self._cache_aus(kontext, self._medien_seite)
        try:
            # Als eigenes Dokument geöffnet, gilt keine CORS-Beschränkung; der Netzwerkstapel ist der des Browsers.
            antwort = self._medien_seite.goto(url, wait_until="load", timeout=60_000)
            if antwort is None:
                raise _medien_fehler("Medienabruf ohne Antwort")
            status = antwort.status
            kopf = cloudflare.kopfzeilen(antwort.headers)
            laenge = int(kopf.get("content-length", "0") or 0)
            if laenge > MAX_MEDIEN_BYTES:
                raise _medien_fehler("Mediendatei größer als erlaubt")
            daten = antwort.body()
        except Exception as fehler:  # noqa: BLE001
            from truthtracker.medien import MedienFehler

            if isinstance(fehler, MedienFehler):
                raise
            raise _medien_fehler(f"Fehler beim Medienabruf ({type(fehler).__name__})") from None
        finally:
            try:
                self._medien_seite.goto("about:blank")
            except Exception:  # noqa: BLE001
                pass
        if len(daten) > MAX_MEDIEN_BYTES:
            raise _medien_fehler("Mediendatei größer als erlaubt")
        if status == 200 and kopf.get("content-type", "").lower().startswith("image/"):
            return daten
        bewertung = cloudflare.bewerte(status, kopf, daten)
        if bewertung.art in (cloudflare.CHALLENGE, cloudflare.RATELIMIT) or bewertung.art in _SPERR_ARTEN:
            self._medien_gesperrt = bewertung.art
            log.warning("Medienabruf gestoppt: %s", cloudflare.melde(bewertung))
        raise _medien_fehler(f"Medienabruf fehlgeschlagen (HTTP {status}, {bewertung.art})")

    def schliessen(self) -> None:
        if self._lauf is not None:
            try:
                if self._seite is not None:
                    self._seite.unroute("**/*")
            except Exception:  # noqa: BLE001
                pass
            browser.beende_browser(self._lauf, self._pw_browser)
            self._lauf = None
        if self._pw is not None:
            try:
                self._pw.stop()
            except Exception:  # noqa: BLE001
                pass
            self._pw = None
        if not browser.profil_in_benutzung(self._profil):
            bericht = browser.raeume_profil_auf(self._profil)
            if bericht.nicht_loeschbar:
                log.warning("Im Browserprofil ließen sich %d Dateien nicht löschen.", len(bericht.nicht_loeschbar))
        browser.raeume_cache_ordner_auf(self._cache)


# ---------------------------------------------------------------------------
# Automatisch: erst direkt, bei Challenge in den Browser


class AutoTransport:
    def __init__(
        self,
        konfig: Konfig,
        zaehler: LaufZaehler,
        *,
        browser_fabrik: Callable[[], Transport] | None = None,
        schlafen: Callable[[float], None] = time.sleep,
        melden: Callable[[str], None] = print,
    ):
        self._curl = CurlTransport(konfig, zaehler, schlafen=schlafen)
        self._browser: Transport | None = None
        self._browser_fabrik = browser_fabrik or (
            lambda: BrowserTransport(konfig, zaehler, schlafen=schlafen, melden=melden)
        )
        self._melden = melden

    @property
    def weg(self) -> str:
        return "curl+browser" if self._browser is not None else "curl"

    @property
    def _aktiv(self) -> Transport:
        return self._browser if self._browser is not None else self._curl

    def hole_json(self, pfad: str, params: dict[str, Any] | None = None) -> cloudflare.Bewertung:
        try:
            return self._aktiv.hole_json(pfad, params)
        except Abbruch as abbruch:
            if abbruch.bewertung.art != cloudflare.CHALLENGE or self._browser is not None:
                raise
        self._melden("Cloudflare verlangt eine Prüfung. Der Lauf öffnet dafür den Browser.")
        log.info("Wechsel auf den Browser nach Cloudflare-Prüfung")
        self._browser = self._browser_fabrik()
        return self._browser.hole_json(pfad, params)

    def hole_bytes(self, url: str) -> bytes:
        return self._aktiv.hole_bytes(url)

    def schliessen(self) -> None:
        self._curl.schliessen()
        if self._browser is not None:
            self._browser.schliessen()


def erstelle_transport(konfig: Konfig, zaehler: LaufZaehler, *, melden: Callable[[str], None] = print) -> Transport:
    weg = konfig.zugriff.weg
    if weg == "curl":
        return CurlTransport(konfig, zaehler)
    if weg == "browser":
        return BrowserTransport(konfig, zaehler, melden=melden)
    return AutoTransport(konfig, zaehler, melden=melden)
