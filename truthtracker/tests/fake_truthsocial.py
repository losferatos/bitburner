"""Lokaler Nachbau der Truth-Social-API für Tests (nur synthetische Daten).

Bildet nach, was Crawler und Spike brauchen: Konto-Lookup, Timeline mit ``max_id``-
Pagination und Link-Header, Einzelabruf mit 404-JSON für gelöschte Posts, gepinnte Posts,
Mediendateien, eine Profilseite mit kleiner "Web-App" und Störungen auf Bestellung
(Cloudflare-Challenge ohne Cookie, 429 ab der n-ten Anfrage, 503, Verbindungsabbruch).
"""

from __future__ import annotations

import json
import re
import threading
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse

from fabrik import TRUMP_ID, bild_png, konto

CHALLENGE_HTML = """<!DOCTYPE html><html><head><title>Just a moment...</title></head>
<body><div id="challenge-stage">Checking your browser</div>
<script>
setTimeout(function () {
  document.cookie = "cf_clearance=test-freigabe; path=/";
  location.reload();
}, %(verzoegerung)d);
</script></body></html>"""

WEBAPP_HTML = """<!DOCTYPE html><html><head><title>Truth Social</title></head>
<body><div id="app">lade ...</div>
<script>
(async function () {
  const k = await (await fetch('/api/v1/accounts/lookup?acct=%(handle)s')).json();
  const s = await (await fetch('/api/v1/accounts/' + k.id + '/statuses?exclude_replies=true&with_muted=true')).json();
  const p = await (await fetch('/api/v1/accounts/' + k.id + '/statuses?pinned=true&with_muted=true')).json();
  const app = document.getElementById('app');
  app.textContent = '';
  for (const post of s) {
    const t = document.createElement('time');
    t.setAttribute('title', post.created_at);
    app.appendChild(t);
  }
})();
</script></body></html>"""


@dataclass
class Zustand:
    konten: dict[str, dict[str, Any]] = field(default_factory=lambda: {"realDonaldTrump": konto()})
    posts: dict[str, dict[str, Any]] = field(default_factory=dict)
    geloescht: set[str] = field(default_factory=set)
    medien: dict[str, bytes] = field(default_factory=dict)
    seitengroesse_max: int = 40
    gepinnt_in_timeline: bool = True
    challenge_ohne_cookie: bool = False
    challenge_verzoegerung_ms: int = 800
    ratelimit_ab: int | None = None  # die n-te API-Anfrage (ab 1 gezählt) und alle weiteren bekommen 429
    fehler_pfade: dict[str, int] = field(default_factory=dict)  # Regex -> Statuscode
    abbruch_pfade: list[str] = field(default_factory=list)  # Regex -> Verbindung kappen
    challenge_pfade: list[str] = field(default_factory=list)  # Regex -> Cloudflare-Challenge, auch mit Cookie
    geoblock: bool = False
    max_seiten_ohne_login: int | None = None
    # Wie im veröffentlichten Server-Code: ohne Login Timeline nur mit exclude_replies/only_media/pinned,
    # Einzelabruf nur für Posts, die kein Reply sind.
    login_regeln: bool = True
    werbung: list[dict[str, Any]] = field(default_factory=list)  # wird auf Seite 1 eingestreut
    anfragen: list[dict[str, Any]] = field(default_factory=list)

    def setze_posts(self, posts: list[dict[str, Any]]) -> None:
        self.posts = {p["id"]: p for p in posts}

    def api_anfragen(self) -> list[dict[str, Any]]:
        return [a for a in self.anfragen if a["pfad"].startswith("/api/")]


class _Handler(BaseHTTPRequestHandler):
    zustand: Zustand
    protocol_version = "HTTP/1.1"

    def log_message(self, *args) -> None:  # leise
        pass

    def _senden(self, status: int, koerper: bytes, typ: str, kopf: dict[str, str] | None = None) -> None:
        self.send_response(status)
        self.send_header("Content-Type", typ)
        self.send_header("Content-Length", str(len(koerper)))
        self.send_header("Server", "cloudflare")
        self.send_header("CF-RAY", "0000000000000000-FRA")
        for name, wert in (kopf or {}).items():
            self.send_header(name, wert)
        self.end_headers()
        self.wfile.write(koerper)

    def _json(self, status: int, daten: Any, kopf: dict[str, str] | None = None) -> None:
        # Medien-URLs auf diesen Server umbiegen: Tests dürfen nie den echten Host anfragen.
        eigen = f"http://127.0.0.1:{self.server.server_address[1]}/media/"
        text = json.dumps(daten).replace("https://truthsocial.com/media/", eigen)
        self._senden(status, text.encode("utf-8"), "application/json; charset=utf-8", kopf)

    def do_GET(self) -> None:  # noqa: N802 - von http.server vorgegeben
        z = self.zustand
        teile = urlparse(self.path)
        pfad = teile.path
        params = {k: v[-1] for k, v in parse_qs(teile.query).items()}
        cookie = self.headers.get("Cookie", "")
        z.anfragen.append({"pfad": pfad, "params": params, "cookie": "cf_clearance" in cookie})

        for muster in z.abbruch_pfade:
            if re.search(muster, pfad):
                self.close_connection = True
                try:
                    self.connection.shutdown(2)
                except OSError:
                    pass
                return

        if z.geoblock:
            self._json(403, {"error": "Truth Social is unavailable in your area."})
            return

        if any(re.search(muster, pfad) for muster in z.challenge_pfade) or (
            z.challenge_ohne_cookie and "cf_clearance" not in cookie
        ):
            koerper = (CHALLENGE_HTML % {"verzoegerung": z.challenge_verzoegerung_ms}).encode()
            self._senden(403, koerper, "text/html; charset=UTF-8", {"cf-mitigated": "challenge"})
            return

        if pfad.startswith("/api/") and z.ratelimit_ab is not None and len(z.api_anfragen()) >= z.ratelimit_ab:
            self._json(429, {"error": "Too many requests"}, {"Retry-After": "300"})
            return

        for muster, code in z.fehler_pfade.items():
            if re.search(muster, pfad):
                self._senden(code, b"<html><body>Bad gateway</body></html>", "text/html")
                return

        if pfad.startswith("/@"):
            handle = pfad[2:].split("/")[0]
            self._senden(200, (WEBAPP_HTML % {"handle": handle}).encode(), "text/html; charset=utf-8")
            return
        if pfad == "/api/v1/accounts/lookup":
            k = z.konten.get(params.get("acct", ""))
            if k is None:
                self._json(404, {"error": "Record not found"})
            else:
                self._json(200, k)
            return
        treffer = re.fullmatch(r"/api/v1/accounts/(\d+)", pfad)
        if treffer:
            k = next((k for k in z.konten.values() if k["id"] == treffer.group(1)), None)
            self._json(200, k) if k else self._json(404, {"error": "Record not found"})
            return
        treffer = re.fullmatch(r"/api/v1/accounts/(\d+)/statuses", pfad)
        if treffer:
            self._timeline(treffer.group(1), params)
            return
        treffer = re.fullmatch(r"/api/v1/statuses/(\d+)", pfad)
        if treffer:
            sid = treffer.group(1)
            if z.login_regeln and sid in z.posts and z.posts[sid].get("in_reply_to_id"):
                self._json(401, {"error": "This method requires an authenticated user"})
                return
            if sid in z.posts and sid not in z.geloescht:
                self._json(200, z.posts[sid])
            else:
                self._json(404, {"error": "Record not found"})
            return
        if pfad == "/media/riesig.png":
            # Kündigt 30 MB an, schickt aber fast nichts: Der Client muss schon am Kopf ablehnen.
            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.send_header("Content-Length", str(30_000_000))
            self.end_headers()
            self.wfile.write(b"\x89PNG")
            self.close_connection = True
            return
        treffer = re.fullmatch(r"/media/(?:original|small)/([\w.\-]+)", pfad)
        if treffer and treffer.group(1).endswith((".mp4", ".m3u8")):
            self._senden(200, b"\x00" * 200_000, "video/mp4")
            return
        if treffer:
            datei = treffer.group(1)
            if datei not in z.medien:
                saat = sum(datei.encode()) % 997
                z.medien[datei] = bild_png(saat)
            self._senden(200, z.medien[datei], "image/png")
            return
        self._senden(404, b"<html><body>Not found</body></html>", "text/html")

    def _timeline(self, konto_id: str, params: dict[str, str]) -> None:
        z = self.zustand
        if z.login_regeln and not any(params.get(k) == "true" for k in ("exclude_replies", "only_media", "pinned")):
            self._json(401, {"error": "This method requires an authenticated user"})
            return
        sichtbar = [
            p for p in z.posts.values()
            if p["id"] not in z.geloescht and p["account"]["id"] == konto_id
        ]
        if params.get("pinned") == "true":
            self._json(200, sorted((p for p in sichtbar if p.get("pinned")), key=lambda p: int(p["id"]), reverse=True))
            return
        if params.get("exclude_replies") == "true":
            # Wie Status.without_replies: Antworten an sich selbst (Threads) bleiben enthalten.
            sichtbar = [p for p in sichtbar if not p.get("in_reply_to_id") or p.get("in_reply_to_account_id") == konto_id]
        geordnet = sorted(sichtbar, key=lambda p: int(p["id"]), reverse=True)
        limit = min(int(params.get("limit", 20)), z.seitengroesse_max)
        if "max_id" in params:
            geordnet = [p for p in geordnet if int(p["id"]) < int(params["max_id"])]
            seite_nr = None
        else:
            seite_nr = 1
        if "since_id" in params:
            geordnet = [p for p in geordnet if int(p["id"]) > int(params["since_id"])]
        if "min_id" in params:
            geordnet = [p for p in geordnet if int(p["id"]) > int(params["min_id"])]
            geordnet = list(reversed(list(reversed(geordnet))[:limit]))
        seite = geordnet[:limit]
        if seite_nr == 1 and z.gepinnt_in_timeline:
            gepinnt = [p for p in sichtbar if p.get("pinned") and p not in seite]
            seite = sorted(gepinnt, key=lambda p: int(p["id"]), reverse=True) + seite
        if seite_nr == 1 and z.werbung:
            seite = seite[:1] + list(z.werbung) + seite[1:]
        if z.max_seiten_ohne_login is not None and "max_id" in params:
            tiefe = sum(1 for a in z.api_anfragen() if a["pfad"].endswith("/statuses") and "max_id" in a["params"])
            if tiefe > z.max_seiten_ohne_login:
                self._json(200, [])
                return
        kopf = {}
        normale = [p for p in seite if not p.get("pinned") and not p.get("sponsored")] or seite
        if seite:
            kleinste = min(int(p["id"]) for p in normale)
            kopf["Link"] = (
                f'<https://truthsocial.com/api/v1/accounts/{konto_id}/statuses?max_id={kleinste}>; rel="next", '
                f'<https://truthsocial.com/api/v1/accounts/{konto_id}/statuses?min_id={max(int(p["id"]) for p in normale)}>; rel="prev"'
            )
        kopf["x-ratelimit-limit"] = "300"
        kopf["x-ratelimit-remaining"] = str(max(0, 300 - len(z.api_anfragen())))
        self._json(200, seite, kopf)


class FakeTruthSocial:
    def __init__(self, zustand: Zustand | None = None):
        self.zustand = zustand or Zustand()
        handler = type("Handler", (_Handler,), {"zustand": self.zustand})
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{self.server.server_address[1]}"

    def __enter__(self) -> FakeTruthSocial:
        self.thread.start()
        return self

    def __exit__(self, *exc) -> None:
        self.server.shutdown()
        self.server.server_close()


__all__ = ["FakeTruthSocial", "Zustand", "TRUMP_ID"]
