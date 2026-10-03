"""HTTP-Zugriff auf Truth Social: direkt per curl_cffi oder über einen echten Browser.

Gemeinsame Regeln für alle Wege:

* Vor jeder API-Anfrage außer der ersten eine zufällige Pause (``[pausen] api_*``), vor
  jedem Medienabruf eine eigene, kürzere (``[pausen] medien_*``). Nie parallel.
* Challenge, Cloudflare-Block, Regionssperre, 403 und 429 beenden den Lauf: ``Abbruch``.
  Danach wird nichts mehr angefragt.
* Netzwerk- und Serverfehler kommen als ``Bewertung`` zurück; der Crawler entscheidet.
* Medien: Challenge, 429, Cloudflare-Block oder Regionssperre auf dem Medienweg stoppen sofort
  alle weiteren Medienabrufe und stehen danach in ``medien_abbruch``. Der Crawler speichert die
  laufende Seite zu Ende (ohne weitere Anfrage) und bricht vor der nächsten API-Anfrage ab. Ein
  schlichter 403 ohne Cloudflare-Merkmale (Objektspeicher: AccessDenied) betrifft nur das eine
  Medium.
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
from typing import Any, NoReturn, Protocol
from urllib.parse import urlencode, urlparse

from truthtracker import browser, cloudflare, pfade
from truthtracker.db import LaufZaehler
from truthtracker.konfig import Konfig

log = logging.getLogger(__name__)

API_ACCEPT = "application/json, text/plain, */*"
BILD_ACCEPT = "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
MAX_MEDIEN_BYTES = 20_000_000

_SPERR_ARTEN = frozenset({cloudflare.BLOCKIERT, cloudflare.GEOBLOCK, cloudflare.VERWEIGERT})
# Auf dem Medienweg beenden nur eindeutige Cloudflare- bzw. Regionsbefunde den Lauf.
_MEDIEN_STOPP = frozenset({cloudflare.CHALLENGE, cloudflare.RATELIMIT, cloudflare.BLOCKIERT, cloudflare.GEOBLOCK})


class Abbruch(Exception):
    """Der Lauf muss enden; es darf nichts mehr angefragt werden."""

    def __init__(self, bewertung: cloudflare.Bewertung, wo: str = ""):
        super().__init__(cloudflare.melde(bewertung))
        self.bewertung = bewertung
        self.wo = wo


class TransportFehler(RuntimeError):
    """Ein Zugriffsweg lässt sich nicht herstellen oder ist weggebrochen (z. B. kein Browser installiert)."""


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

    def markiere_angefragt(self) -> None:
        """Eine Anfrage ging an diesem Pausierer vorbei raus (z. B. die Startseite des Browsers)."""
        self._erste = False

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


def _medien_stopp(bewertung: cloudflare.Bewertung, zaehler: LaufZaehler) -> cloudflare.Bewertung | None:
    """Cloudflare-Hürde auf dem Medienweg zählen und als Abbruchgrund zurückgeben."""
    if bewertung.art not in _MEDIEN_STOPP:
        return None
    if bewertung.art == cloudflare.CHALLENGE:
        zaehler.cloudflare_challenges += 1
    elif bewertung.art in _SPERR_ARTEN:
        zaehler.cloudflare_blocks += 1
    log.warning("Medienabruf gestoppt: %s Der Lauf endet nach der aktuellen Seite.", cloudflare.melde(bewertung))
    return bewertung


def _ist_http_url(url: str) -> bool:
    return urlparse(url).scheme in ("http", "https")


def _laenge(kopf: dict[str, str]) -> int:
    try:
        return int(kopf.get("content-length", "0") or 0)
    except ValueError:
        return 0


def _lies_begrenzt(antwort, grenze: int, *, abbrechen: bool) -> bytes:
    """Liest höchstens ``grenze`` Bytes. Mit ``abbrechen`` ist mehr ein Fehler, sonst wird gekürzt."""
    teile: list[bytes] = []
    groesse = 0
    for teil in antwort.iter_content():
        groesse += len(teil)
        if groesse > grenze:
            if abbrechen:
                raise _medien_fehler("Mediendatei größer als erlaubt")
            teile.append(teil[: grenze - (groesse - len(teil))])
            break
        teile.append(teil)
    return b"".join(teile)


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
        self.medien_abbruch: cloudflare.Bewertung | None = None

    def pause_vor_anfrage(self) -> None:
        """Die API-Pause dieses Wegs, z. B. bevor der Browser für dieselbe Abfrage startet."""
        self._api_pause()

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
        if self.medien_abbruch is not None:
            raise _medien_fehler(f"Medienabruf in diesem Lauf gestoppt ({self.medien_abbruch.art})")
        if not _ist_http_url(url):
            raise _medien_fehler("Medienadresse ist keine http(s)-Adresse")
        self._medien_pause()
        self._zaehler.anfragen_medien += 1
        try:
            antwort = self._sitzung.request(
                "GET", url, headers={"Accept": BILD_ACCEPT, "Referer": self._basis + "/"}, stream=True
            )
            try:
                status = antwort.status_code
                kopf = cloudflare.kopfzeilen(antwort.headers)
                # Erst die Kopfzeilen prüfen: Ein Video oder eine zu große Datei wird gar nicht erst gelesen.
                if _laenge(kopf) > MAX_MEDIEN_BYTES:
                    raise _medien_fehler("Mediendatei größer als erlaubt")
                ist_bild = status == 200 and kopf.get("content-type", "").lower().startswith("image/")
                if status == 200 and not ist_bild:
                    raise _medien_fehler("Antwort ist kein Bild")
                daten = _lies_begrenzt(antwort, MAX_MEDIEN_BYTES if ist_bild else 65_536, abbrechen=ist_bild)
            finally:
                antwort.close()
        except Exception as fehler:  # noqa: BLE001
            from truthtracker.medien import MedienFehler

            if isinstance(fehler, MedienFehler):
                raise
            raise _medien_fehler(f"Netzwerkfehler beim Medienabruf ({type(fehler).__name__})") from None
        return self._bewerte_medien(status, kopf, daten)

    def _bewerte_medien(self, status: int, kopf: dict[str, str], daten: bytes) -> bytes:
        if status == 200 and kopf.get("content-type", "").lower().startswith("image/"):
            return daten
        bewertung = cloudflare.bewerte(status, kopf, daten)
        self.medien_abbruch = self.medien_abbruch or _medien_stopp(bewertung, self._zaehler)
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


SEITE_JS = """() => {
  const n = performance.getEntriesByType('navigation')[0];
  const pre = document.querySelector('body > pre');
  const quelle = pre || document.body;
  return {
    status: n && n.responseStatus ? n.responseStatus : 0,
    titel: document.title || '',
    text: quelle ? quelle.innerText.slice(0, 200000) : '',
    cf_fehlerseite: !!document.querySelector('#cf-error-details, .cf-error-code, #cf-wrapper, .cf-error-overview'),
  };
}"""

_CF_FEHLER_TITEL = ("attention required", "access denied", "| cloudflare", "rate limited")


def bewerte_seite(seite, status: int | None = None) -> cloudflare.Bewertung:
    """Bewertet das im Tab geladene Dokument, ohne etwas neu anzufragen.

    Maßgeblich ist der HTTP-Status der Hauptantwort: vom Aufrufer (Antwort von ``goto``) oder aus
    der Navigation-Timing-API des Browsers. Ein Dokument mit 2xx-Status ist nie eine Sperre, auch
    wenn Post-Texte darin „you have been blocked“ oder „unavailable in your area“ enthalten. Die
    Textmarker aus ``cloudflare.bewerte`` gelten nur bei Fehlerstatus oder auf einer erkennbaren
    Cloudflare-Fehlerseite; JSON wird wie überall nie anhand seines Texts eingestuft.
    """
    try:
        roh = seite.evaluate(SEITE_JS)
    except Exception as fehler:  # noqa: BLE001 - während einer Navigation wirft evaluate()
        return cloudflare.Bewertung(cloudflare.NETZWERKFEHLER, status, hinweis=type(fehler).__name__)
    status = status or int(roh.get("status") or 0) or None
    titel = str(roh.get("titel") or "")
    text = str(roh.get("text") or "")
    cf_seite = bool(roh.get("cf_fehlerseite")) or any(m in titel.lower() for m in _CF_FEHLER_TITEL)
    if status is not None and 200 <= status < 300 and not cf_seite:
        bewertung = cloudflare.bewerte(status, {}, text)
        return bewertung if bewertung.ok else cloudflare.Bewertung(cloudflare.KEIN_JSON, status)
    if status is None and not cf_seite:
        # Status unbekannt und keine Cloudflare-Seite: Freitext entscheidet nichts.
        bewertung = cloudflare.bewerte(200, {}, text)
        return bewertung if bewertung.ok else cloudflare.Bewertung(cloudflare.KEIN_JSON, None)
    return cloudflare.bewerte(status or 403, {}, f"{titel}\n{text}")


def seite_zeigt_sperre(seite, status: int | None = None) -> str | None:
    """Art der Sperre (Block, Regionssperre, 403, Rate-Limit), wenn das Dokument eine Fehlerseite ist."""
    art = bewerte_seite(seite, status).art
    return art if art in _SPERR_ARTEN or art == cloudflare.RATELIMIT else None


def _fenster_geschlossen() -> NoReturn:
    raise TransportFehler(
        "Das Browserfenster des Trackers wurde geschlossen oder ist abgestürzt; der Lauf endet hier. "
        "Bis dahin Gesammeltes ist gespeichert."
    )


class BrowserTransport:
    """Opera/Chrome/Edge mit eigenem Profil; API-Aufrufe per ``fetch`` aus der geöffneten Seite.

    Ablauf: Browser normal starten, direkt mit der Konto-Abfrage als Startseite (eine API-Adresse,
    damit eine Prüfung genau dort erscheint, wo später abgefragt wird, und die Web-App mit ihren
    Bildern gar nicht erst lädt). Solange Cloudflare prüft, hängt sich nichts an den Browser; nur die
    Tab-Titel werden über den lokalen DevTools-Endpunkt gelesen. Erst nach der Freigabe verbindet
    sich Playwright, schaltet den Cache ab, sperrt Bilder und Videos und bewertet die Startseite
    (429, Sperre → Abbruch, ohne neue Anfrage). Taucht später erneut eine Prüfung auf, trennt sich
    Playwright wieder, bis der Mensch sie gelöst hat.
    """

    weg = "browser"
    # Unter Windows gibt der Browser die Sperrdatei des Profils mitunter verzögert frei.
    PROFIL_NACHWARTEN_S = 5.0

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
        self.medien_abbruch: cloudflare.Bewertung | None = None
        # Nach schliessen(): Profil noch belegt bzw. Zahl der nicht löschbaren Dateien (fürs Laufprotokoll).
        self.profil_belegt = False
        self.profil_reste = 0
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
        except browser.BrowserFehler as fehler:
            self.schliessen()
            raise TransportFehler(str(fehler)) from None
        except BaseException:
            self.schliessen()
            raise

    # -- Start, Anhängen, Prüfung ----------------------------------------------

    def _starte(self, fund: browser.BrowserFund) -> None:
        self._lauf = browser.starte_browser(
            fund,
            self._profil,
            self._cache,
            start_url=self._start_url,
            headless=self._konfig.zugriff.headless,
            zusatz_argumente=tuple(self._konfig.zugriff.browser_argumente),
        )
        # Die Startseite ist eine Anfrage an Truth Social: Der erste fetch danach bekommt die volle Pause.
        self._zaehler.anfragen_api += 1
        self._api_pause.markiere_angefragt()
        log.info("Browser gestartet: %s %s", fund.name, self._lauf.version)
        freigabe = self._warte_auf_menschen()
        if freigabe.challenge_gesehen:
            self._zaehler.cloudflare_challenges += 1
        self._anhaengen()
        self._seite_freigeben(schon_gezaehlt=freigabe.challenge_gesehen)

    def _warte_auf_menschen(self) -> browser.Freigabe:
        """Wartet ohne angehängtes Playwright (nur Tab-Titel über /json/list), bis die Prüfung gelöst ist."""
        assert self._lauf is not None
        freigabe = browser.warte_auf_freigabe(
            self._lauf, self._host, timeout_s=self._konfig.zugriff.warte_challenge_s, melden=self._melden
        )
        if freigabe.browser_beendet:
            _fenster_geschlossen()
        if not freigabe.geloest and not freigabe.sperrseite:
            raise Abbruch(cloudflare.Bewertung(cloudflare.CHALLENGE, None, hinweis="nicht gelöst"))
        return freigabe

    def _anhaengen(self) -> None:
        from playwright.sync_api import sync_playwright

        assert self._lauf is not None
        if self._pw is None:
            self._pw = sync_playwright().start()
        self._pw_browser = self._pw.chromium.connect_over_cdp(self._lauf.cdp_url)
        if self._lauf.browser_pid is None:
            self._lauf.browser_pid = browser.ermittle_browser_pid(self._pw_browser)
        kontext = self._pw_browser.contexts[0] if self._pw_browser.contexts else self._pw_browser.new_context()
        passende = [s for s in kontext.pages if self._host in s.url]
        self._seite = passende[0] if passende else (kontext.pages[0] if kontext.pages else kontext.new_page())
        self._cache_aus(kontext, self._seite)
        self._seite.route("**/*", self._sperre_medien)

    def _abhaengen(self) -> None:
        """Playwright trennen, ohne den Browser zu schließen; der Tab bleibt offen."""
        for aufraeumen in (
            lambda: self._seite.unroute("**/*"),
            lambda: self._medien_seite.close(),
            # Bei einem per CDP verbundenen Browser trennt close() nur die Verbindung.
            lambda: self._pw_browser.close(),
        ):
            try:
                aufraeumen()
            except Exception:  # noqa: BLE001 - z. B. keine Medienseite offen
                pass
        self._pw_browser = None
        self._seite = None
        self._medien_seite = None

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

    def _seite_freigeben(self, *, status: int | None = None, schon_gezaehlt: bool = False) -> None:
        """Bewertet das Dokument im Tab nach dem Anhängen bzw. Neuladen, ohne neue Anfrage.

        Sperre, 403 oder 429 → Abbruch. Zeigt der Tab noch eine Prüfung, trennt sich Playwright,
        der Mensch löst sie, danach wird erneut angehängt und bewertet. Kreist die Prüfung, endet
        der Lauf.
        """
        gezaehlt = schon_gezaehlt
        for _ in range(3):
            bewertung = bewerte_seite(self._seite, status)
            if bewertung.art != cloudflare.CHALLENGE and not seite_zeigt_challenge(self._seite):
                if bewertung.abbruch:
                    _pruefe_abbruch(bewertung, self._zaehler)
                return
            if not gezaehlt:
                self._zaehler.cloudflare_challenges += 1
                gezaehlt = True
            self._abhaengen()
            self._warte_auf_menschen()
            self._anhaengen()
            status = None
        raise Abbruch(cloudflare.Bewertung(cloudflare.CHALLENGE, None, hinweis="Prüfung kreist"))

    def _oeffne_startseite(self) -> None:
        """Freigabe abgelaufen: Startseite im Tab neu laden; die Prüfung löst der Mensch ohne Playwright."""
        self._api_pause()
        self._zaehler.anfragen_api += 1
        status: int | None = None
        try:
            antwort = self._seite.goto(self._start_url, wait_until="commit", timeout=60_000)
            if antwort is not None:
                status = antwort.status
                if cloudflare.bewerte(status, antwort.headers, None).art == cloudflare.CHALLENGE:
                    # Sofort trennen, damit die Prüfung ohne angehängtes Playwright läuft.
                    self._abhaengen()
                    self._warte_auf_menschen()
                    self._anhaengen()
                    status = None
            self._seite.wait_for_load_state("domcontentloaded", timeout=60_000)
        except (Abbruch, TransportFehler):
            raise
        except Exception as fehler:  # noqa: BLE001
            log.warning("Startseite ließ sich nicht öffnen (%s)", type(fehler).__name__)
            if self._lauf is not None and not browser.laeuft(self._lauf):
                _fenster_geschlossen()
        self._seite_freigeben(status=status, schon_gezaehlt=True)

    # -- Anfragen ------------------------------------------------------------

    def hole_json(self, pfad: str, params: dict[str, Any] | None = None) -> cloudflare.Bewertung:
        self._api_pause()
        url = self._basis + pfad + (f"?{urlencode(params)}" if params else "")
        self._zaehler.anfragen_api += 1
        try:
            roh = self._seite.evaluate(FETCH_JS, url)
        except Exception as fehler:  # noqa: BLE001
            if self._lauf is not None and not browser.laeuft(self._lauf):
                _fenster_geschlossen()
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
        if self.medien_abbruch is not None:
            raise _medien_fehler(f"Medienabruf in diesem Lauf gestoppt ({self.medien_abbruch.art})")
        if not _ist_http_url(url):
            raise _medien_fehler("Medienadresse ist keine http(s)-Adresse")
        self._medien_pause()
        self._zaehler.anfragen_medien += 1
        if self._medien_seite is None:
            kontext = self._seite.context
            self._medien_seite = kontext.new_page()
            self._cache_aus(kontext, self._medien_seite)
            # Spielt eine Adresse doch ein Video ab, lädt es nicht nach.
            self._medien_seite.route(
                "**/*", lambda route: route.abort() if route.request.resource_type == "media" else route.continue_()
            )
        try:
            # Als eigenes Dokument geöffnet, gilt keine CORS-Beschränkung; der Netzwerkstapel ist der des Browsers.
            antwort = self._medien_seite.goto(url, wait_until="commit", timeout=60_000)
            if antwort is None:
                raise _medien_fehler("Medienabruf ohne Antwort")
            status = antwort.status
            kopf = cloudflare.kopfzeilen(antwort.headers)
            if _laenge(kopf) > MAX_MEDIEN_BYTES:
                raise _medien_fehler("Mediendatei größer als erlaubt")
            ist_bild = status == 200 and kopf.get("content-type", "").lower().startswith("image/")
            if status == 200 and not ist_bild:
                raise _medien_fehler("Antwort ist kein Bild")
            antwort.finished()
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
        if ist_bild:
            return daten
        bewertung = cloudflare.bewerte(status, kopf, daten[:65_536])
        self.medien_abbruch = self.medien_abbruch or _medien_stopp(bewertung, self._zaehler)
        raise _medien_fehler(f"Medienabruf fehlgeschlagen (HTTP {status}, {bewertung.art})")

    # -- Ende ------------------------------------------------------------------

    def _verbinde_zum_schliessen(self):
        """Für ``Browser.close`` eine CDP-Verbindung, auch wenn Playwright gerade nicht angehängt ist."""
        if self._pw_browser is not None or self._lauf is None or not browser.laeuft(self._lauf):
            return self._pw_browser
        try:
            from playwright.sync_api import sync_playwright

            if self._pw is None:
                self._pw = sync_playwright().start()
            self._pw_browser = self._pw.chromium.connect_over_cdp(self._lauf.cdp_url, timeout=15_000)
            if self._lauf.browser_pid is None:
                self._lauf.browser_pid = browser.ermittle_browser_pid(self._pw_browser)
        except Exception:  # noqa: BLE001 - dann bleibt nur das harte Beenden
            log.warning("Keine CDP-Verbindung zum Schließen des Browsers")
        return self._pw_browser

    def schliessen(self) -> None:
        try:
            if self._lauf is not None:
                try:
                    if self._seite is not None:
                        self._seite.unroute("**/*")
                except Exception:  # noqa: BLE001
                    pass
                try:
                    if not browser.beende_browser(self._lauf, self._verbinde_zum_schliessen()):
                        log.warning("Der Tracker-Browser ließ sich nicht sicher beenden.")
                except Exception:  # noqa: BLE001 - das Aufräumen darf nie davon abhängen
                    log.exception("Fehler beim Beenden des Browsers")
                self._lauf = None
        finally:
            if self._pw is not None:
                try:
                    self._pw.stop()
                except Exception:  # noqa: BLE001
                    pass
                self._pw = None
            self._raeume_auf()

    def _raeume_auf(self) -> None:
        ende = time.monotonic() + self.PROFIL_NACHWARTEN_S
        while time.monotonic() < ende and browser.profil_in_benutzung(self._profil):
            time.sleep(0.5)
        self.profil_belegt = browser.profil_in_benutzung(self._profil)
        if self.profil_belegt:
            log.warning("Der Tracker-Browser läuft noch; sein Profil wurde nicht aufgeräumt.")
        else:
            self.profil_reste = len(browser.raeume_profil_auf(self._profil).nicht_loeschbar)
            if self.profil_reste:
                log.warning("Im Browserprofil ließen sich %d Dateien nicht löschen.", self.profil_reste)
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
    def medien_abbruch(self) -> cloudflare.Bewertung | None:
        return self._curl.medien_abbruch or getattr(self._browser, "medien_abbruch", None)

    @property
    def profil_belegt(self) -> bool:
        return bool(getattr(self._browser, "profil_belegt", False))

    @property
    def profil_reste(self) -> int:
        return int(getattr(self._browser, "profil_reste", 0))

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
        # Die Startseite des Browsers ist die nächste Anfrage: vorher die übliche Pause.
        self._curl.pause_vor_anfrage()
        self._browser = self._browser_fabrik()
        return self._browser.hole_json(pfad, params)

    def hole_bytes(self, url: str) -> bytes:
        if self.medien_abbruch is not None:
            raise _medien_fehler(f"Medienabruf in diesem Lauf gestoppt ({self.medien_abbruch.art})")
        return self._aktiv.hole_bytes(url)

    def schliessen(self) -> None:
        try:
            self._curl.schliessen()
        finally:
            if self._browser is not None:
                self._browser.schliessen()


def erstelle_transport(konfig: Konfig, zaehler: LaufZaehler, *, melden: Callable[[str], None] = print) -> Transport:
    weg = konfig.zugriff.weg
    if weg == "curl":
        return CurlTransport(konfig, zaehler)
    if weg == "browser":
        return BrowserTransport(konfig, zaehler, melden=melden)
    return AutoTransport(konfig, zaehler, melden=melden)
