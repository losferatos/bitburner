"""Synthetische API-Objekte in der Struktur echter Truth-Social-/Mastodon-Antworten.

Alle Texte sind erfunden und tragen den Marker ``SYNTHETIK``, damit Tests prüfen können,
dass kein Inhalt in DB, Logs oder Berichten landet. Keine echten Inhalte im Repo.
"""

from __future__ import annotations

import io
import itertools
from datetime import UTC, datetime, timedelta
from typing import Any

MARKER = "SYNTHETIK"
TRUMP_ID = "107780257626128497"
BASIS = "https://truthsocial.com"

_zaehler = itertools.count(1)


def snowflake(zeit: datetime, folge: int = 0) -> str:
    """Mastodon-ID: Millisekunden seit 1970 << 16 plus Folgenummer."""
    return str((int(zeit.timestamp() * 1000) << 16) | (folge & 0xFFFF))


def iso(zeit: datetime) -> str:
    return zeit.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.") + f"{zeit.microsecond // 1000:03d}Z"


def konto(
    konto_id: str = TRUMP_ID,
    handle: str = "realDonaldTrump",
    anzeigename: str = "Donald J. Trump",
    verifiziert: bool = True,
    follower: int = 11_000_000,
    folgt: int = 70,
    posts: int = 30_000,
) -> dict[str, Any]:
    return {
        "id": konto_id,
        "username": handle,
        "acct": handle,
        "display_name": anzeigename,
        "locked": False,
        "bot": False,
        "discoverable": True,
        "group": False,
        "created_at": "2022-02-11T16:16:57.705Z",
        "note": f"<p>{MARKER} Profiltext {handle}</p>",
        "url": f"{BASIS}/@{handle}",
        "avatar": f"https://static-assets-1.truthsocial.com/tmtg:prime-ts-assets/accounts/avatars/{konto_id}.jpg",
        "avatar_static": f"https://static-assets-1.truthsocial.com/tmtg:prime-ts-assets/accounts/avatars/{konto_id}.jpg",
        "header": "",
        "header_static": "",
        "followers_count": follower,
        "following_count": folgt,
        "statuses_count": posts,
        "last_status_at": "2026-10-02",
        "verified": verifiziert,
        "location": "",
        "website": "",
        "unauth_visibility": True,
        "emojis": [],
        "fields": [],
    }


def medium(
    art: str = "image",
    medien_id: str | None = None,
    breite: int = 1200,
    hoehe: int = 800,
    dauer: float | None = None,
    datei: str | None = None,
) -> dict[str, Any]:
    medien_id = medien_id or str(next(_zaehler) + 114_000_000_000_000_000)
    datei = datei or f"{medien_id}.png"
    original: dict[str, Any] = {"width": breite, "height": hoehe, "size": f"{breite}x{hoehe}", "aspect": breite / hoehe}
    if dauer is not None:
        original["duration"] = dauer
        original["frame_rate"] = "30/1"
    return {
        "id": medien_id,
        "type": art,
        "url": f"{BASIS}/media/original/{datei}",
        "preview_url": f"{BASIS}/media/small/{datei}",
        "external_video_id": None,
        "remote_url": None,
        "preview_remote_url": None,
        "text_url": None,
        "meta": {"original": original, "small": {"width": 400, "height": 266, "size": "400x266", "aspect": 1.5}},
        "description": f"{MARKER} Alternativtext",
        "blurhash": "UFHx",
    }


def karte(url: str = "https://example.com/artikel") -> dict[str, Any]:
    return {
        "url": url,
        "title": f"{MARKER} Kartentitel",
        "description": f"{MARKER} Kartenbeschreibung",
        "type": "link",
        "author_name": "",
        "author_url": "",
        "provider_name": "",
        "provider_url": "",
        "html": "",
        "width": 0,
        "height": 0,
        "image": None,
        "embed_url": "",
        "blurhash": None,
        "links": None,
        "group": None,
    }


def status(
    zeit: datetime,
    text: str | None = None,
    *,
    status_id: str | None = None,
    autor: dict[str, Any] | None = None,
    medien: list[dict[str, Any]] | None = None,
    reblog: dict[str, Any] | None = None,
    quote: dict[str, Any] | None = None,
    antwort_auf: tuple[str, str] | None = None,
    karte_: dict[str, Any] | None = None,
    erwaehnungen: list[dict[str, Any]] | None = None,
    hashtags: list[str] | None = None,
    zaehler: tuple[int, int, int] = (10, 20, 30),
    gepinnt: bool = False,
    editiert: datetime | None = None,
) -> dict[str, Any]:
    autor = autor or konto()
    status_id = status_id or snowflake(zeit, next(_zaehler))
    if text is None:
        text = f"{MARKER} Beitrag {status_id}"
    inhalt = "" if reblog is not None else (f"<p>{text}</p>" if text else "")
    return {
        "id": status_id,
        "created_at": iso(zeit),
        "in_reply_to_id": antwort_auf[0] if antwort_auf else None,
        "quote_id": quote["id"] if quote else None,
        "in_reply_to_account_id": antwort_auf[1] if antwort_auf else None,
        "sensitive": False,
        "spoiler_text": "",
        "visibility": "public",
        "language": "en",
        "uri": f"{BASIS}/users/{autor['username']}/statuses/{status_id}",
        "url": f"{BASIS}/@{autor['username']}/{status_id}",
        "content": inhalt,
        "account": autor,
        "media_attachments": medien or [],
        "mentions": erwaehnungen or [],
        "tags": [{"name": h, "url": f"{BASIS}/tags/{h}"} for h in (hashtags or [])],
        "card": karte_,
        "group": None,
        "quote": quote,
        "in_reply_to": None,
        "reblog": reblog,
        "sponsored": False,
        "replies_count": zaehler[0],
        "reblogs_count": zaehler[1],
        "favourites_count": zaehler[2],
        "upvotes_count": zaehler[2],
        "downvotes_count": 0,
        "favourited": False,
        "reblogged": False,
        "muted": False,
        "pinned": gepinnt,
        "bookmarked": False,
        "poll": None,
        "emojis": [],
        "edited_at": iso(editiert) if editiert else None,
    }


def retruth(zeit: datetime, original: dict[str, Any], *, zaehler: tuple[int, int, int] = (0, 0, 0)) -> dict[str, Any]:
    return status(zeit, text="", reblog=original, zaehler=zaehler)


def bild_png(saat: int, groesse: tuple[int, int] = (64, 48)) -> bytes:
    """Ein deterministisches Testbild (Farbverläufe), unterscheidbar je Saat."""
    from PIL import Image

    breite, hoehe = groesse
    bild = Image.new("RGB", groesse)
    pixel = bild.load()
    for x in range(breite):
        for y in range(hoehe):
            pixel[x, y] = ((x * 4 + saat * 37) % 256, (y * 5 + saat * 91) % 256, ((x + y) * 3 + saat * 13) % 256)
    puffer = io.BytesIO()
    bild.save(puffer, format="PNG")
    return puffer.getvalue()


def zeitreihe(start: datetime, anzahl: int, abstand: timedelta) -> list[datetime]:
    return [start - abstand * i for i in range(anzahl)]


JETZT = datetime(2026, 10, 2, 12, 0, 0, tzinfo=UTC)
