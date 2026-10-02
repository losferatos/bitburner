"""Zugriffs-Spike: Welcher Weg zu den Truth-Social-Daten funktioniert von diesem Rechner aus?

Geprüft wird in der Reihenfolge aus SPEC.md:

a) JSON-API direkt per ``curl_cffi`` mit Chrome-Impersonation.
b) Echter Browser (Opera, Chrome oder Edge) mit eigenem, dauerhaftem Profil und sichtbarem
   Fenster. Erst wird die Profilseite geöffnet und mitgeschnitten, welche JSON-Antworten die
   Web-App selbst lädt (b1). Danach ruft das Skript dieselben API-Pfade aus der geöffneten
   Seite heraus auf (b2), also mit den Cookies und dem Netzwerkstapel des Browsers.
c) HTML wird nicht geparst; der Spike zählt nur, ob die Seite ``<time>``-Elemente enthält,
   falls a) und b) scheitern.

Der Bericht enthält ausschließlich Statuscodes, Kopfzeilen aus einer festen Liste,
Feldnamen mit Typen und Häufigkeiten, Zählwerte und Zeitspannen. Keine Texte, keine
Medien, keine Medien-URLs. Antworten werden nur im Speicher ausgewertet und verworfen.

Schonend: höchstens rund ein Dutzend eigene Anfragen pro Weg, zufällige Pausen von
10–15 s (ohne Login wurden etwa 6 Anfragen pro Minute vor einem 429 beobachtet), nichts
parallel. Bei Challenge, Sperre oder 429 bricht der jeweilige Weg sofort ab.
"""

from __future__ import annotations

import argparse
import json
import platform
import random
import re
import sys
import time
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse

from truthtracker import __version__, browser, cloudflare, pfade, temp
from truthtracker.transport import FETCH_JS, Pausierer, seite_zeigt_challenge, seite_zeigt_sperre
from truthtracker.feldkatalog import Feldkatalog

# Ein Zeitpunkt vor dem Start von Truth Social (Februar 2022) als Snowflake-ID: so eine ID
# kann es nicht geben, die Antwort zeigt also, wie der Server "nicht gefunden" meldet.
GARANTIERT_FEHLENDE_ID = str(int(datetime(2020, 1, 1, tzinfo=UTC).timestamp() * 1000) << 16)

KOPFZEILEN_WERTE = (
    "content-type",
    "server",
    "cf-cache-status",
    "cf-mitigated",
    "retry-after",
    "x-ratelimit-limit",
    "x-ratelimit-remaining",
    "x-ratelimit-reset",
    "cache-control",
    "vary",
)

STATUSES_PFAD = re.compile(r"^/api/v\d+/accounts/\d+/statuses$")
LOOKUP_PFAD = re.compile(r"^/api/v\d+/accounts/lookup$")


class Abbruch(Exception):
    def __init__(self, bewertung: cloudflare.Bewertung, schritt: str):
        super().__init__(f"{schritt}: {cloudflare.melde(bewertung)}")
        self.bewertung = bewertung
        self.schritt = schritt


@dataclass
class Einstellungen:
    basis_url: str = "https://truthsocial.com"
    konto: str = "realDonaldTrump"
    seiten: int = 5
    limit: int = 40
    pause_min: float = 10.0
    pause_max: float = 15.0
    wege: tuple[str, ...] = ("a", "b")
    browser: str = "auto"
    headless: bool = False
    browser_argumente: tuple[str, ...] = ()
    warte_challenge_s: float = 300.0
    warte_webapp_s: float = 45.0
    impersonate: str = "chrome"
    ausgabe: Path | None = None


@dataclass
class Bericht:
    start: str
    einstellungen: dict[str, Any]
    umgebung: dict[str, Any]
    wege: dict[str, dict[str, Any]] = field(default_factory=dict)
    kataloge: dict[str, Feldkatalog] = field(default_factory=dict)
    ende: str = ""
    dauer_s: float = 0.0
    fazit: dict[str, Any] = field(default_factory=dict)
    aufraeumen: dict[str, Any] = field(default_factory=dict)

    def katalog(self, name: str) -> Feldkatalog:
        return self.kataloge.setdefault(name, Feldkatalog())

    def als_dict(self) -> dict[str, Any]:
        return {
            "werkzeug": f"truthtracker-spike {__version__}",
            "start": self.start,
            "ende": self.ende,
            "dauer_s": round(self.dauer_s, 1),
            "einstellungen": self.einstellungen,
            "umgebung": self.umgebung,
            "wege": self.wege,
            "feldkataloge": {name: k.als_dict() for name, k in sorted(self.kataloge.items())},
            "aufraeumen": self.aufraeumen,
            "fazit": self.fazit,
        }


def jetzt_utc() -> datetime:
    return datetime.now(UTC)


def _iso(dt: datetime) -> str:
    return dt.isoformat(timespec="seconds").replace("+00:00", "Z")


def parse_zeit(wert: Any) -> datetime | None:
    if not isinstance(wert, str):
        return None
    try:
        dt = datetime.fromisoformat(wert.replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def pfad_vorlage(url: str) -> str:
    """URL ohne Host und mit IDs als Platzhalter; Parameter nur mit Namen."""
    teile = urlparse(url)
    pfad = re.sub(r"/\d+(?=/|$)", "/{id}", teile.path)
    namen = sorted({k for k, _ in parse_qsl(teile.query, keep_blank_values=True)})
    return pfad + (f"?{'&'.join(namen)}" if namen else "")


def kopf_auszug(headers: Any) -> dict[str, Any]:
    h = cloudflare.kopfzeilen(headers)
    auszug: dict[str, Any] = {name: h[name][:120] for name in KOPFZEILEN_WERTE if name in h}
    auszug["cf-ray_vorhanden"] = "cf-ray" in h
    if "link" in h:
        auszug["link_rels"] = sorted(set(re.findall(r'rel="([^"]+)"', h["link"])))
    if "set-cookie" in h:
        # Nur die Cookie-Namen, nie die Werte.
        auszug["set-cookie_namen"] = sorted(set(re.findall(r"(?:^|,\s*)([A-Za-z0-9_\-.]+)=", h["set-cookie"])))
    return auszug


def link_next_max_id(headers: Any) -> str | None:
    h = cloudflare.kopfzeilen(headers)
    for teil in h.get("link", "").split(","):
        if 'rel="next"' in teil:
            treffer = re.search(r"[?&]max_id=(\d+)", teil)
            if treffer:
                return treffer.group(1)
    return None


def analysiere_seite(posts: list[dict], vorige_ids: set[str], headers: Any, jetzt: datetime) -> dict[str, Any]:
    """Zählwerte einer Timeline-Seite. Keine Inhalte, nur Struktur und Zeitspannen."""
    ids = [str(p.get("id", "")) for p in posts]
    nicht_gepinnt = [p for p in posts if not p.get("pinned")]
    # Gepinnte Posts stehen oben außer der Reihe; die Ordnung zählt nur für die übrigen.
    numerisch = [int(p["id"]) for p in nicht_gepinnt if str(p.get("id", "")).isdigit()]
    zeiten = [z for z in (parse_zeit(p.get("created_at")) for p in nicht_gepinnt) if z]
    min_id = min((int(p["id"]) for p in nicht_gepinnt if str(p.get("id", "")).isdigit()), default=None)
    naechste = link_next_max_id(headers)
    return {
        "anzahl": len(posts),
        "ids_absteigend": numerisch == sorted(numerisch, reverse=True),
        "gepinnt_positionen": [i for i, p in enumerate(posts) if p.get("pinned")],
        "reblogs": sum(1 for p in posts if p.get("reblog")),
        "replies": sum(1 for p in posts if p.get("in_reply_to_id")),
        "quotes": sum(1 for p in posts if p.get("quote") or p.get("quote_id")),
        "mit_medien": sum(1 for p in posts if (p.get("reblog") or p).get("media_attachments")),
        "mit_card": sum(1 for p in posts if (p.get("reblog") or p).get("card")),
        "editiert": sum(1 for p in posts if p.get("edited_at")),
        "zeitspanne_h": round((max(zeiten) - min(zeiten)).total_seconds() / 3600, 2) if len(zeiten) > 1 else None,
        "aeltester_post_alter_h": round((jetzt - min(zeiten)).total_seconds() / 3600, 1) if zeiten else None,
        "ueberlappung_mit_vorseite": len(set(ids) & vorige_ids),
        "link_next_vorhanden": naechste is not None,
        "link_next_gleich_kleinster_id": (naechste == str(min_id)) if (naechste and min_id is not None) else None,
    }


def timeline_parameter(limit: int, max_id: str | None) -> dict[str, Any]:
    """Parameter wie in der Web-App. Ohne Login erlaubt Truth Social die Timeline nur mit
    ``exclude_replies=true`` (Threads, also Antworten an sich selbst, bleiben enthalten)."""
    params: dict[str, Any] = {"exclude_replies": "true", "with_muted": "true", "limit": limit}
    if max_id:
        params["max_id"] = max_id
    return params


def katalogisiere_posts(bericht: Bericht, posts: list[dict]) -> None:
    bericht.katalog("status").aufnehmen_alle(posts)


def erster_medienanhang(posts: list[dict]) -> dict | None:
    for post in posts:
        quelle = post.get("reblog") or post
        for anhang in quelle.get("media_attachments") or []:
            if isinstance(anhang, dict) and anhang.get("preview_url"):
                return anhang
    return None


# ---------------------------------------------------------------------------
# Weg a: curl_cffi


def weg_a(einst: Einstellungen, bericht: Bericht) -> None:
    from curl_cffi import requests as cffi_requests

    weg: dict[str, Any] = {"name": "JSON-API per curl_cffi", "schritte": [], "anfragen": 0, "ergebnis": "unvollstaendig"}
    bericht.wege["a"] = weg
    start = time.monotonic()
    pause = Pausierer(einst.pause_min, einst.pause_max)
    sitzung = cffi_requests.Session(impersonate=einst.impersonate, timeout=30)
    basis = einst.basis_url.rstrip("/")

    referer = f"{basis}/@{einst.konto}"

    def hole(schritt: str, pfad: str, params: dict | None = None, accept: str = "application/json, text/plain, */*"):
        pause()
        url = basis + pfad
        t0 = time.monotonic()
        try:
            antwort = sitzung.get(url, params=params, headers={"Accept": accept, "Referer": referer})
        except Exception as fehler:  # noqa: BLE001 - jede Netzwerkstörung zählt hier gleich
            weg["anfragen"] += 1
            bewertung = cloudflare.Bewertung(cloudflare.NETZWERKFEHLER, None, hinweis=type(fehler).__name__)
            weg["schritte"].append(
                {"schritt": schritt, "pfad": pfad_vorlage(url + ("?" + urlencode(params) if params else "")),
                 "art": bewertung.art, "fehlerklasse": type(fehler).__name__, "dauer_s": round(time.monotonic() - t0, 2)}
            )
            raise Abbruch(bewertung, schritt) from None
        weg["anfragen"] += 1
        bewertung = cloudflare.bewerte(antwort.status_code, antwort.headers, antwort.content)
        weg["schritte"].append(
            {
                "schritt": schritt,
                "pfad": pfad_vorlage(url + ("?" + urlencode(params) if params else "")),
                "status": antwort.status_code,
                "art": bewertung.art,
                "http_version": str(getattr(antwort, "http_version", "")),
                "dauer_s": round(time.monotonic() - t0, 2),
                "kopfzeilen": kopf_auszug(antwort.headers),
                "bytes": len(antwort.content or b""),
            }
        )
        if bewertung.abbruch:
            raise Abbruch(bewertung, schritt)
        return bewertung, antwort

    try:
        # 1. Konto nachschlagen
        bew, _ = hole("konto_lookup", "/api/v1/accounts/lookup", {"acct": einst.konto})
        if not bew.ok or not isinstance(bew.daten, dict) or "id" not in bew.daten:
            weg["ergebnis"] = "lookup_fehlgeschlagen"
            weg["lookup_art"] = bew.art
            return
        bericht.katalog("konto").aufnehmen(bew.daten)
        konto_id = str(bew.daten["id"])
        weg["konto_id_ziffern"] = len(konto_id)
        weg["konto_id"] = konto_id  # öffentliche Konto-ID, kein Inhalt

        # 2. Timeline-Seiten
        seiten = []
        alle_ids: set[str] = set()
        alle_posts: list[dict] = []
        max_id: str | None = None
        for nummer in range(1, einst.seiten + 1):
            params: dict[str, Any] = timeline_parameter(einst.limit, max_id)
            bew, antwort = hole(f"timeline_seite_{nummer}", f"/api/v1/accounts/{konto_id}/statuses", params)
            if not bew.ok or not isinstance(bew.daten, list):
                seiten.append({"seite": nummer, "art": bew.art, "status": bew.status})
                break
            posts = [p for p in bew.daten if isinstance(p, dict)]
            analyse = analysiere_seite(posts, alle_ids, antwort.headers, jetzt_utc())
            analyse["seite"] = nummer
            seiten.append(analyse)
            katalogisiere_posts(bericht, posts)
            alle_ids.update(str(p.get("id")) for p in posts)
            alle_posts.extend(posts)
            kandidaten = [int(p["id"]) for p in posts if not p.get("pinned") and str(p.get("id", "")).isdigit()]
            if not kandidaten:
                break
            max_id = str(min(kandidaten))
        weg["timeline"] = seiten
        weg["posts_gesamt"] = len(alle_ids)

        if not alle_posts:
            weg["ergebnis"] = "timeline_leer_oder_fehlgeschlagen"
            return

        # 3. Gepinnte Posts (so fragt die Web-App sie ab)
        bew, _ = hole("gepinnt", f"/api/v1/accounts/{konto_id}/statuses", {"pinned": "true", "with_muted": "true"})
        if bew.ok and isinstance(bew.daten, list):
            weg["gepinnt"] = {
                "anzahl": len(bew.daten),
                "auch_in_timeline": sum(1 for p in bew.daten if isinstance(p, dict) and str(p.get("id")) in alle_ids),
            }
            bericht.katalog("status_gepinnt").aufnehmen_alle([p for p in bew.daten if isinstance(p, dict)])

        # 4. Einzelner Post per ID
        eigener = next((p for p in alle_posts if not p.get("reblog") and not p.get("pinned")), alle_posts[0])
        bew, _ = hole("einzelpost", f"/api/v1/statuses/{eigener['id']}")
        if bew.ok and isinstance(bew.daten, dict):
            timeline_schluessel = set(eigener)
            einzel_schluessel = set(bew.daten)
            weg["einzelpost"] = {
                "ok": True,
                "nur_im_einzelabruf": sorted(einzel_schluessel - timeline_schluessel),
                "nur_in_timeline": sorted(timeline_schluessel - einzel_schluessel),
                "zaehler_gleich": all(
                    eigener.get(k) == bew.daten.get(k) for k in ("replies_count", "reblogs_count", "favourites_count")
                ),
            }
            bericht.katalog("status_einzeln").aufnehmen(bew.daten)
        else:
            weg["einzelpost"] = {"ok": False, "art": bew.art, "status": bew.status}

        # 4b. Gibt es Replies an andere ohne Login? (laut Server-Code: nein, HTTP 401)
        bew, antwort = hole(
            "probe_mit_replies", f"/api/v1/accounts/{konto_id}/statuses", {"limit": einst.limit, "exclude_replies": "false"}
        )
        probe: dict[str, Any] = {"art": bew.art, "status": bew.status}
        if bew.ok and isinstance(bew.daten, list):
            posts = [p for p in bew.daten if isinstance(p, dict)]
            probe["anzahl"] = len(posts)
            probe["replies_an_andere"] = sum(
                1 for p in posts if p.get("in_reply_to_id") and str(p.get("in_reply_to_account_id")) != konto_id
            )
        weg["probe_mit_replies"] = probe

        # 5. Wie sieht "nicht gefunden" aus?
        bew, _ = hole("nicht_gefunden_probe", f"/api/v1/statuses/{GARANTIERT_FEHLENDE_ID}")
        weg["nicht_gefunden_probe"] = beschreibe_nicht_gefunden(bew)

        # 6. Lässt sich ein Vorschaubild laden (nötig für den pHash)?
        anhang = erster_medienanhang(alle_posts)
        if anhang:
            vorschau = urlparse(str(anhang["preview_url"]))
            original = urlparse(str(anhang.get("url") or ""))
            pause()
            t0 = time.monotonic()
            try:
                antwort = sitzung.get(anhang["preview_url"], headers={"Accept": "image/avif,image/webp,image/*,*/*;q=0.8"})
                weg["anfragen"] += 1
                inhaltstyp = cloudflare.kopfzeilen(antwort.headers).get("content-type", "")
                medien = {
                    "host": vorschau.hostname,
                    "original_gleicher_host": original.hostname == vorschau.hostname if original.hostname else None,
                    "status": antwort.status_code,
                    "content_type": inhaltstyp[:60],
                    "bytes": len(antwort.content or b""),
                    "dauer_s": round(time.monotonic() - t0, 2),
                    "art": "ok" if antwort.status_code == 200 and inhaltstyp.startswith("image/")
                    else cloudflare.bewerte(antwort.status_code, antwort.headers, antwort.content).art,
                }
                del antwort  # Bilddaten sofort verwerfen
            except Exception as fehler:  # noqa: BLE001
                weg["anfragen"] += 1
                medien = {"host": vorschau.hostname, "art": cloudflare.NETZWERKFEHLER, "fehlerklasse": type(fehler).__name__}
            weg["medien_vorschau"] = medien
        else:
            weg["medien_vorschau"] = {"art": "kein_medium_in_stichprobe"}

        weg["ergebnis"] = "funktioniert" if len([s for s in seiten if s.get("anzahl")]) >= min(2, einst.seiten) else "teilweise"
    except Abbruch as abbruch:
        weg["ergebnis"] = "abgebrochen"
        weg["abbruch"] = {"schritt": abbruch.schritt, "art": abbruch.bewertung.art, "meldung": cloudflare.melde(abbruch.bewertung)}
    finally:
        sitzung.close()
        weg["dauer_s"] = round(time.monotonic() - start, 1)


def beschreibe_nicht_gefunden(bew: cloudflare.Bewertung) -> dict[str, Any]:
    beschreibung: dict[str, Any] = {"status": bew.status, "art": bew.art}
    if isinstance(bew.daten, dict):
        beschreibung["json_schluessel"] = sorted(k for k in bew.daten if isinstance(k, str))[:20]
        fehler = bew.daten.get("error")
        # Die Fehlermeldung des Servers ist kein Post-Inhalt; kurz und nur ASCII übernehmen.
        if isinstance(fehler, str) and len(fehler) <= 80 and fehler.isascii():
            beschreibung["error_text"] = fehler
    return beschreibung


# ---------------------------------------------------------------------------
# Weg b: echter Browser über CDP


def weg_b(einst: Einstellungen, bericht: Bericht) -> None:
    weg: dict[str, Any] = {"name": "Echter Browser über CDP", "anfragen": 0, "ergebnis": "unvollstaendig"}
    bericht.wege["b"] = weg
    start = time.monotonic()
    fund = browser.finde_browser(einst.browser)
    weg["gefundene_browser"] = [z.split(":", 1)[0] for z in browser.browser_verfuegbar()]
    if fund is None:
        weg["ergebnis"] = "kein_browser_gefunden"
        weg["dauer_s"] = 0.0
        return
    weg["browser"] = fund.name
    profil = pfade.profil_ordner()
    vorher = browser.raeume_profil_auf(profil)
    weg["profil_vorher_aufgeraeumt"] = vorher.geloescht
    cache = pfade.temp_ordner() / f"browser-cache-{int(time.time())}"
    lauf: browser.LaufenderBrowser | None = None
    pw_browser = None
    basis = einst.basis_url.rstrip("/")
    host = urlparse(basis).hostname or ""
    try:
        # Wie von Hand: Browser mit der Profilseite starten. Solange Cloudflare prüft, hängt sich
        # nichts an den Browser (nur die Tab-Titel werden gelesen), damit die Prüfung nicht kreist.
        lauf = browser.starte_browser(
            fund, profil, cache, start_url=f"{basis}/@{einst.konto}", headless=einst.headless,
            zusatz_argumente=einst.browser_argumente,
        )
        weg["anfragen"] += 1
        weg["browser_version"] = lauf.version
        freigabe = browser.warte_auf_freigabe(
            lauf, host, timeout_s=einst.warte_challenge_s, melden=lambda text: print(text, flush=True)
        )
        weg["challenge"] = {
            "gesehen": freigabe.challenge_gesehen,
            "geloest": freigabe.geloest,
            "sperrseite": freigabe.sperrseite,
            "wartezeit_s": round(freigabe.wartezeit_s, 1),
        }
        if not freigabe.geloest and not freigabe.sperrseite:
            raise Abbruch(cloudflare.Bewertung(cloudflare.CHALLENGE, None), "startseite")
        from playwright.sync_api import sync_playwright

        with sync_playwright() as pw:
            pw_browser = pw.chromium.connect_over_cdp(lauf.cdp_url)
            lauf.browser_pid = browser.ermittle_browser_pid(pw_browser)
            kontext = pw_browser.contexts[0] if pw_browser.contexts else pw_browser.new_context()
            passende = [s for s in kontext.pages if host in s.url]
            seite = passende[0] if passende else (kontext.pages[0] if kontext.pages else kontext.new_page())
            try:
                cdp = kontext.new_cdp_session(seite)
                cdp.send("Network.enable")
                cdp.send("Network.setCacheDisabled", {"cacheDisabled": True})
                weg["cache_deaktiviert"] = True
            except Exception:  # noqa: BLE001
                weg["cache_deaktiviert"] = False

            def sperre_medien(route) -> None:
                anfrage = route.request
                ziel = urlparse(anfrage.url).hostname or ""
                if anfrage.resource_type in ("image", "media") and "cloudflare" not in ziel:
                    route.abort()
                else:
                    route.continue_()

            seite.route("**/*", sperre_medien)
            try:
                _weg_b_ablauf(einst, bericht, weg, seite)
            finally:
                try:
                    seite.unroute("**/*")
                except Exception:  # noqa: BLE001
                    pass
                browser.beende_browser(lauf, pw_browser)
    except browser.BrowserFehler as fehler:
        weg["ergebnis"] = "browser_start_fehlgeschlagen"
        weg["fehler"] = str(fehler)
    except Abbruch as abbruch:
        weg["ergebnis"] = "abgebrochen"
        weg["abbruch"] = {"schritt": abbruch.schritt, "art": abbruch.bewertung.art, "meldung": cloudflare.melde(abbruch.bewertung)}
    finally:
        if lauf is not None and (lauf.prozess.poll() is None or (lauf.browser_pid and browser._pid_lebt(lauf.browser_pid))):
            browser.beende_browser(lauf, None, timeout_s=5)
        nachher = browser.raeume_profil_auf(profil)
        cache_weg = browser.raeume_cache_ordner_auf(cache)
        bericht.aufraeumen["browser_profil"] = nachher.als_dict()
        bericht.aufraeumen["browser_cache_ordner_geloescht"] = cache_weg
        weg["dauer_s"] = round(time.monotonic() - start, 1)


def _weg_b_ablauf(einst: Einstellungen, bericht: Bericht, weg: dict[str, Any], seite) -> None:
    basis = einst.basis_url.rstrip("/")
    mitgeschnitten: list = []

    def merke(antwort) -> None:
        if urlparse(antwort.url).path.startswith("/api/"):
            mitgeschnitten.append(antwort)

    sperre = seite_zeigt_sperre(seite)
    if sperre:
        raise Abbruch(cloudflare.Bewertung(sperre, None), "profilseite")
    if seite_zeigt_challenge(seite):
        # Ältere Captcha-Variante unter "Attention Required": angehängt weiter auf den Menschen warten.
        print("\n>>> Cloudflare-Prüfung im Browserfenster. Bitte dort lösen.\n", flush=True)
        ende = time.monotonic() + einst.warte_challenge_s
        while time.monotonic() < ende and seite_zeigt_challenge(seite):
            seite.wait_for_timeout(2000)
        if seite_zeigt_challenge(seite):
            raise Abbruch(cloudflare.Bewertung(cloudflare.CHALLENGE, None), "profilseite")
        weg["challenge"]["geloest"] = True

    # b1: Profilseite neu laden, diesmal mit Mitschnitt der API-Antworten der Web-App.
    seite.on("response", merke)
    t0 = time.monotonic()
    weg["anfragen"] += 1
    try:
        hauptantwort = seite.reload(wait_until="domcontentloaded", timeout=60_000)
        weg["profilseite_status"] = hauptantwort.status if hauptantwort else None
        if hauptantwort is not None:
            weg["profilseite_kopfzeilen"] = kopf_auszug(hauptantwort.headers)
    except Exception as fehler:  # noqa: BLE001
        weg["profilseite_fehler"] = type(fehler).__name__
    sperre = seite_zeigt_sperre(seite)
    if sperre:
        raise Abbruch(cloudflare.Bewertung(sperre, weg.get("profilseite_status")), "profilseite")

    # Warten, bis die Web-App ihre Timeline geladen hat.
    ende = time.monotonic() + einst.warte_webapp_s
    while time.monotonic() < ende:
        if any(STATUSES_PFAD.match(urlparse(a.url).path) for a in mitgeschnitten):
            seite.wait_for_timeout(2000)  # Nachzügler (gepinnte Posts, Konto) mitnehmen
            break
        seite.wait_for_timeout(500)
    weg["profilseite_dauer_s"] = round(time.monotonic() - t0, 1)

    try:
        weg["html_time_elemente"] = seite.locator("time").count()
    except Exception:  # noqa: BLE001
        weg["html_time_elemente"] = None

    endpunkte: dict[str, dict[str, Any]] = {}
    for antwort in list(mitgeschnitten):
        vorlage = pfad_vorlage(antwort.url)
        try:
            koerper = antwort.body()
        except Exception:  # noqa: BLE001 - nach einer Navigation sind ältere Körper weg
            koerper = None
        bew = cloudflare.bewerte(antwort.status, antwort.headers, koerper)
        eintrag = endpunkte.setdefault(vorlage, {"aufrufe": 0, "status": {}, "arten": {}})
        eintrag["aufrufe"] += 1
        eintrag["status"][str(antwort.status)] = eintrag["status"].get(str(antwort.status), 0) + 1
        eintrag["arten"][bew.art] = eintrag["arten"].get(bew.art, 0) + 1
        pfad = urlparse(antwort.url).path
        if bew.ok and STATUSES_PFAD.match(pfad) and isinstance(bew.daten, list):
            bericht.katalog("status_webapp").aufnehmen_alle([p for p in bew.daten if isinstance(p, dict)])
            eintrag["posts"] = eintrag.get("posts", 0) + len(bew.daten)
        elif bew.ok and LOOKUP_PFAD.match(pfad) and isinstance(bew.daten, dict):
            bericht.katalog("konto_webapp").aufnehmen(bew.daten)
    weg["webapp_endpunkte"] = dict(sorted(endpunkte.items()))
    weg["webapp_api_antworten"] = len(mitgeschnitten)
    seite.remove_listener("response", merke)
    passiv_ok = any(STATUSES_PFAD.match(urlparse(a.url).path) and 200 <= a.status < 300 for a in mitgeschnitten)
    weg["b1_passiv"] = "funktioniert" if passiv_ok else "keine_timeline_antwort"
    mitgeschnitten.clear()

    # b2: dieselbe API aus der Seite heraus aufrufen (Cookies und Netzwerkstapel des Browsers).
    pause = Pausierer(einst.pause_min, einst.pause_max)
    pause()  # erster Aufruf ohne Pause ...
    schritte: list[dict[str, Any]] = []
    weg["b2_schritte"] = schritte

    letzte_kopfzeilen: dict[str, str] = {}

    def hole(schritt: str, pfad: str) -> cloudflare.Bewertung:
        pause()
        letzte_kopfzeilen.clear()
        t1 = time.monotonic()
        weg["anfragen"] += 1
        try:
            roh = seite.evaluate(FETCH_JS, basis + pfad)
        except Exception as fehler:  # noqa: BLE001
            bewertung = cloudflare.Bewertung(cloudflare.NETZWERKFEHLER, None, hinweis=type(fehler).__name__)
            schritte.append({"schritt": schritt, "pfad": pfad_vorlage(pfad), "art": bewertung.art,
                             "fehlerklasse": type(fehler).__name__})
            raise Abbruch(bewertung, schritt) from None
        bewertung = cloudflare.bewerte(roh["status"], roh["kopf"], roh["text"])
        letzte_kopfzeilen.update(roh["kopf"])
        schritte.append({
            "schritt": schritt,
            "pfad": pfad_vorlage(pfad),
            "status": roh["status"],
            "art": bewertung.art,
            "dauer_s": round(time.monotonic() - t1, 2),
            "kopfzeilen": kopf_auszug(roh["kopf"]),
        })
        if bewertung.abbruch:
            raise Abbruch(bewertung, schritt)
        return bewertung

    pause()  # ... aber vor dem ersten eigenen Aufruf nach dem Seitenaufbau doch eine Pause
    bew = hole("konto_lookup", f"/api/v1/accounts/lookup?{urlencode({'acct': einst.konto})}")
    if not bew.ok or not isinstance(bew.daten, dict) or "id" not in bew.daten:
        weg["b2_fetch"] = "lookup_fehlgeschlagen"
        weg["ergebnis"] = "funktioniert_passiv" if passiv_ok else "fehlgeschlagen"
        return
    bericht.katalog("konto").aufnehmen(bew.daten)
    konto_id = str(bew.daten["id"])
    weg["konto_id"] = konto_id
    seiten = []
    alle_ids: set[str] = set()
    max_id: str | None = None
    for nummer in range(1, min(einst.seiten, 2) + 1):
        params = timeline_parameter(einst.limit, max_id)
        bew = hole(f"timeline_seite_{nummer}", f"/api/v1/accounts/{konto_id}/statuses?{urlencode(params)}")
        if not bew.ok or not isinstance(bew.daten, list):
            seiten.append({"seite": nummer, "art": bew.art, "status": bew.status})
            break
        posts = [p for p in bew.daten if isinstance(p, dict)]
        analyse = analysiere_seite(posts, alle_ids, dict(letzte_kopfzeilen), jetzt_utc())
        analyse["seite"] = nummer
        seiten.append(analyse)
        bericht.katalog("status").aufnehmen_alle(posts)
        alle_ids.update(str(p.get("id")) for p in posts)
        kandidaten = [int(p["id"]) for p in posts if not p.get("pinned") and str(p.get("id", "")).isdigit()]
        if not kandidaten:
            break
        max_id = str(min(kandidaten))
    weg["b2_timeline"] = seiten
    bew = hole("nicht_gefunden_probe", f"/api/v1/statuses/{GARANTIERT_FEHLENDE_ID}")
    weg["b2_nicht_gefunden_probe"] = beschreibe_nicht_gefunden(bew)
    b2_ok = sum(1 for s in seiten if s.get("anzahl")) >= 1
    weg["b2_fetch"] = "funktioniert" if b2_ok else "fehlgeschlagen"
    if b2_ok:
        weg["ergebnis"] = "funktioniert"
    elif passiv_ok:
        weg["ergebnis"] = "funktioniert_passiv"
    else:
        weg["ergebnis"] = "fehlgeschlagen"


# ---------------------------------------------------------------------------
# Fazit und Ausgabe


def ziehe_fazit(bericht: Bericht) -> dict[str, Any]:
    a = bericht.wege.get("a", {})
    b = bericht.wege.get("b", {})
    fazit: dict[str, Any] = {
        "weg_a": a.get("ergebnis", "nicht_geprueft"),
        "weg_b": b.get("ergebnis", "nicht_geprueft"),
    }
    if a.get("ergebnis") == "funktioniert":
        fazit["empfehlung"] = "a"
        fazit["begruendung"] = "Die JSON-API antwortet direkt per curl_cffi; kein Browser nötig."
    elif b.get("ergebnis") == "funktioniert":
        fazit["empfehlung"] = "b2"
        fazit["begruendung"] = (
            "Direkter Zugriff scheitert, aber der echte Browser kommt durch; der Crawler ruft die API "
            "aus der geöffneten Seite heraus auf."
        )
    elif b.get("ergebnis") == "funktioniert_passiv":
        fazit["empfehlung"] = "b1"
        fazit["begruendung"] = "Nur das Mitschneiden der Web-App-Antworten funktioniert."
    else:
        fazit["empfehlung"] = "keiner"
        fazit["begruendung"] = "Kein Weg hat Timeline-Daten geliefert. Siehe Abbruchgründe."
    pfade_status = bericht.kataloge.get("status")
    if pfade_status:
        p = pfade_status.pfade()
        fazit["felder_vorhanden"] = {
            name: name in p
            for name in (
                "created_at", "edited_at", "pinned", "reblog", "quote", "quote_id", "in_reply_to_id",
                "in_reply_to_account_id", "replies_count", "reblogs_count", "favourites_count",
                "upvotes_count", "downvotes_count", "quotes_count", "sponsored", "editable", "version",
                "in_reply_to", "tombstone", "media_attachments[].meta.original.duration",
                "media_attachments[].meta.original.width", "media_attachments[].blurhash", "card",
                "account.verified", "account.followers_count", "mentions", "tags", "url", "uri",
            )
        }
    return fazit


def als_markdown(daten: dict[str, Any]) -> str:
    z: list[str] = []
    z.append(f"# Zugriffs-Spike – Messung {daten['start']}")
    z.append("")
    z.append("Automatisch erzeugt von `run_spike.bat`. Enthält nur Statuscodes, Feldnamen, Typen und Zählwerte, keine Inhalte.")
    z.append("")
    f = daten["fazit"]
    z.append("## Fazit")
    z.append("")
    z.append(f"- Weg a (curl_cffi): **{f.get('weg_a')}**")
    z.append(f"- Weg b (Browser): **{f.get('weg_b')}**")
    z.append(f"- Empfehlung: **{f.get('empfehlung')}** – {f.get('begruendung')}")
    z.append(f"- Dauer gesamt: {daten['dauer_s']} s")
    z.append("")
    z.append("## Umgebung")
    z.append("")
    for k, v in daten["umgebung"].items():
        z.append(f"- {k}: `{v}`")
    z.append("")
    for kennung, weg in daten["wege"].items():
        z.append(f"## Weg {kennung}: {weg.get('name', '')}")
        z.append("")
        z.append(f"- Ergebnis: **{weg.get('ergebnis')}**, eigene Anfragen: {weg.get('anfragen')}, Dauer: {weg.get('dauer_s')} s")
        if "abbruch" in weg:
            z.append(f"- Abbruch bei `{weg['abbruch']['schritt']}`: {weg['abbruch']['meldung']}")
        for schluessel in ("browser", "browser_version", "challenge", "profilseite_status", "b1_passiv", "b2_fetch",
                           "html_time_elemente", "lookup_art", "posts_gesamt", "gepinnt", "einzelpost",
                           "probe_mit_replies", "nicht_gefunden_probe", "b2_nicht_gefunden_probe", "medien_vorschau",
                           "fehler"):
            if schluessel in weg:
                z.append(f"- {schluessel}: `{json.dumps(weg[schluessel], ensure_ascii=False)}`")
        schritte = weg.get("schritte") or weg.get("b2_schritte") or []
        if schritte:
            z.append("")
            z.append("| Schritt | Pfad | Status | Art | Dauer s | Kopfzeilen |")
            z.append("|---|---|---|---|---|---|")
            for s in schritte:
                kopf = json.dumps(s.get("kopfzeilen", {}), ensure_ascii=False).replace("|", "\\|")
                z.append(f"| {s['schritt']} | `{s.get('pfad')}` | {s.get('status', '–')} | {s['art']} | {s.get('dauer_s', '–')} | `{kopf}` |")
        seiten = weg.get("timeline") or weg.get("b2_timeline") or []
        if seiten:
            z.append("")
            z.append("Timeline-Seiten:")
            z.append("")
            for s in seiten:
                z.append(f"- `{json.dumps(s, ensure_ascii=False)}`")
        if weg.get("webapp_endpunkte"):
            z.append("")
            z.append("Von der Web-App geladene API-Pfade:")
            z.append("")
            for pfad, info in weg["webapp_endpunkte"].items():
                z.append(f"- `{pfad}`: `{json.dumps(info, ensure_ascii=False)}`")
        z.append("")
    if f.get("felder_vorhanden"):
        z.append("## Wichtige Felder vorhanden?")
        z.append("")
        for name, da in f["felder_vorhanden"].items():
            z.append(f"- `{name}`: {'ja' if da else 'nein'}")
        z.append("")
    for name, katalog in daten["feldkataloge"].items():
        z.append(f"## Feldkatalog `{name}` ({katalog['objekte']} Objekte)")
        z.append("")
        z.append("| Pfad | Vorkommen | Typen | Werte/Muster |")
        z.append("|---|---|---|---|")
        for pfad, info in katalog["felder"].items():
            extra = info.get("werte") or info.get("muster") or ""
            if info.get("max_laenge"):
                extra = f"max. Länge {info['max_laenge']}"
            z.append(
                f"| `{pfad}` | {info['vorkommen']} | {', '.join(f'{t}:{n}' for t, n in info['typen'].items())} | "
                f"{json.dumps(extra, ensure_ascii=False) if extra else ''} |"
            )
        z.append("")
    if daten.get("aufraeumen"):
        z.append("## Aufräumen")
        z.append("")
        z.append(f"`{json.dumps(daten['aufraeumen'], ensure_ascii=False)}`")
        z.append("")
    return "\n".join(z)


def umgebung() -> dict[str, Any]:
    try:
        import curl_cffi

        cffi_version = curl_cffi.__version__
    except Exception:  # noqa: BLE001
        cffi_version = "nicht installiert"
    try:
        from importlib.metadata import version

        pw_version = version("playwright")
    except Exception:  # noqa: BLE001
        pw_version = "nicht installiert"
    return {
        "betriebssystem": f"{platform.system()} {platform.release()}",
        "python": platform.python_version(),
        "curl_cffi": cffi_version,
        "playwright": pw_version,
    }


def fuehre_aus(einst: Einstellungen) -> dict[str, Any]:
    reste = temp.raeume_temp_auf()
    start = jetzt_utc()
    t0 = time.monotonic()
    bericht = Bericht(
        start=_iso(start),
        einstellungen={
            "basis_url": einst.basis_url,
            "konto": einst.konto,
            "seiten": einst.seiten,
            "limit": einst.limit,
            "pausen_s": [einst.pause_min, einst.pause_max],
            "wege": list(einst.wege),
            "browser_wunsch": einst.browser,
            "impersonate": einst.impersonate,
        },
        umgebung=umgebung(),
    )
    if reste:
        bericht.aufraeumen["temp_reste_nicht_loeschbar"] = reste
    try:
        if "a" in einst.wege:
            print("Weg a: JSON-API per curl_cffi ...", flush=True)
            weg_a(einst, bericht)
            print(f"  -> {bericht.wege['a']['ergebnis']}", flush=True)
        if "b" in einst.wege:
            print("Weg b: echter Browser ...", flush=True)
            weg_b(einst, bericht)
            print(f"  -> {bericht.wege['b']['ergebnis']}", flush=True)
    except KeyboardInterrupt:
        bericht.fazit["unterbrochen"] = True
        print("Abgebrochen; der Bericht wird mit dem bisherigen Stand geschrieben.", flush=True)
    finally:
        bericht.ende = _iso(jetzt_utc())
        bericht.dauer_s = time.monotonic() - t0
        bericht.fazit.update(ziehe_fazit(bericht))
        if "a" in bericht.wege or "b" in bericht.wege:
            anfragen = sum(w.get("anfragen", 0) for w in bericht.wege.values())
            bericht.fazit["eigene_anfragen_gesamt"] = anfragen
        daten = bericht.als_dict()
        schreibe(daten, einst.ausgabe)
    return daten


def schreibe(daten: dict[str, Any], ausgabe: Path | None) -> tuple[Path, Path]:
    ordner = ausgabe or (pfade.docs_ordner() / "zugriff-messungen")
    ordner.mkdir(parents=True, exist_ok=True)
    stempel = daten["start"].replace(":", "").replace("-", "").replace("Z", "")
    json_pfad = ordner / f"messung-{stempel}.json"
    md_pfad = ordner / f"messung-{stempel}.md"
    json_pfad.write_text(json.dumps(daten, ensure_ascii=False, indent=2), encoding="utf-8")
    md_pfad.write_text(als_markdown(daten), encoding="utf-8")
    print(f"\nBericht geschrieben:\n  {md_pfad}\n  {json_pfad}", flush=True)
    return json_pfad, md_pfad


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Zugriffs-Spike für Truth Social (nur Metadaten).")
    parser.add_argument("--konto", default="realDonaldTrump")
    parser.add_argument("--seiten", type=int, default=5, help="Timeline-Seiten für Weg a (Standard 5)")
    parser.add_argument("--limit", type=int, default=40, help="Posts pro Seite anfragen (Standard 40)")
    parser.add_argument("--nur", choices=["a", "b"], help="nur einen Weg prüfen")
    parser.add_argument("--browser", default="auto", help="auto, opera, opera_gx, chrome, edge oder Pfad zur .exe")
    parser.add_argument("--pause-min", type=float, default=10.0, help="Sekunden (Standard 10)")
    parser.add_argument("--pause-max", type=float, default=15.0, help="Sekunden (Standard 15)")
    parser.add_argument("--warte-challenge", type=float, default=300.0, help="Sekunden für das Lösen der Prüfung")
    parser.add_argument("--impersonate", default="chrome", help="curl_cffi-Ziel, Standard: neueste Chrome-Fassung")
    parser.add_argument("--basis-url", default="https://truthsocial.com", help=argparse.SUPPRESS)
    parser.add_argument("--headless", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--browser-arg", action="append", default=[], help=argparse.SUPPRESS)
    parser.add_argument("--ausgabe", type=Path, help=argparse.SUPPRESS)
    args = parser.parse_args(argv)
    if args.pause_min < 0 or args.pause_max < args.pause_min:
        parser.error("Pausen: 0 <= --pause-min <= --pause-max")
    einst = Einstellungen(
        basis_url=args.basis_url,
        konto=args.konto,
        seiten=max(1, args.seiten),
        limit=max(1, min(args.limit, 80)),
        pause_min=args.pause_min,
        pause_max=args.pause_max,
        wege=(args.nur,) if args.nur else ("a", "b"),
        browser=args.browser,
        headless=args.headless,
        browser_argumente=tuple(args.browser_arg),
        warte_challenge_s=args.warte_challenge,
        impersonate=args.impersonate,
        ausgabe=args.ausgabe,
    )
    daten = fuehre_aus(einst)
    fazit = daten["fazit"]
    print(f"\nEmpfehlung: {fazit.get('empfehlung')} – {fazit.get('begruendung')}")
    return 0 if fazit.get("empfehlung") != "keiner" else 2


if __name__ == "__main__":
    sys.exit(main())
