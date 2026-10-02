"""Klassifikation: aus einem Status-Objekt der API wird ein ``PostDaten``-Objekt (nur Metadaten).

Regeln in docs/architektur.md, Abschnitt "Klassifikation (Regeln)". Texte, HTML, Medien-URLs,
Alt-Texte und Kartentitel werden hier nur gelesen, um Zahlen und Hashes zu berechnen; sie
gelangen weder in das Ergebnis noch in Fehlermeldungen.

Das API-Objekt ist fremde Eingabe: Jedes Feld kann fehlen, ``null`` sein oder einen
unerwarteten Typ haben. Nur ohne gültige ``id`` oder ``created_at`` gibt es einen ``ValueError``.
"""

from __future__ import annotations

import hashlib
import math
import re
from collections.abc import Iterable
from typing import TYPE_CHECKING, Any
from urllib.parse import urlsplit

from truthtracker import text as text_modul
from truthtracker import zeit
from truthtracker.modelle import (
    FORMAT_LEER,
    FORMAT_MEDIEN_TEXT,
    FORMAT_NUR_LINK,
    FORMAT_NUR_MEDIEN,
    FORMAT_NUR_TEXT,
    FORMAT_TEXT_LINK,
    HASH_FEHLER,
    HASH_OFFEN,
    HASH_UEBERSPRUNGEN,
    MEDIUM_AUDIO,
    MEDIUM_BILD,
    MEDIUM_GIF,
    MEDIUM_SONSTIG,
    MEDIUM_VIDEO,
    REPLY_FREMD,
    REPLY_THREAD,
    ROLLE_QUOTE,
    ROLLE_REPLY,
    ROLLE_RETRUTH,
    TYP_EIGEN,
    TYP_RETRUTH,
    TYP_SELBST_RETRUTH,
    MedienDaten,
    PostDaten,
    QuellKonto,
    Zaehler,
)

if TYPE_CHECKING:
    from truthtracker.medien import MedienErfasser

_ID = re.compile(r"^[0-9]{1,24}$")
_MEDIEN_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
_HANDLE = re.compile(r"^[A-Za-z0-9_.-]{1,64}(?:@[A-Za-z0-9.-]{1,253})?$")
_SICHTBARKEIT = re.compile(r"^[a-z_]{1,20}$")
_GROESSE = re.compile(r"^([0-9]{1,6})x([0-9]{1,6})$")
_WEITERER_ZAEHLER = re.compile(r"^[a-z][a-z0-9_]{0,58}_count$")
_STANDARD_ZAEHLER = ("replies_count", "reblogs_count", "favourites_count")
_PLATZHALTER_ID = "-99"

_MEDIENARTEN = {
    "image": MEDIUM_BILD,
    "video": MEDIUM_VIDEO,
    "tv": MEDIUM_VIDEO,
    "gifv": MEDIUM_GIF,
    "audio": MEDIUM_AUDIO,
}


# ---------------------------------------------------------------------------
# Kleine, typsichere Zugriffe auf fremde JSON-Daten


def _dict(wert: object) -> dict[str, Any]:
    return wert if isinstance(wert, dict) else {}


def _liste(wert: object) -> list[Any]:
    return wert if isinstance(wert, list) else []


def _id(wert: object) -> str | None:
    """Numerische ID als Text; alles andere (auch der Platzhalter -99) wird ``None``."""
    if isinstance(wert, bool):
        return None
    if isinstance(wert, int):
        return str(wert) if wert >= 0 else None
    if isinstance(wert, str) and _ID.match(wert.strip()):
        return wert.strip()
    return None


def _medien_id(wert: object) -> str | None:
    if isinstance(wert, int) and not isinstance(wert, bool):
        return str(wert)
    if isinstance(wert, str) and _MEDIEN_ID.match(wert.strip()):
        return wert.strip()
    return None


def _nicht_negativ(wert: object) -> int | None:
    if isinstance(wert, int) and not isinstance(wert, bool) and wert >= 0:
        return wert
    return None


def _ganzzahl(wert: object) -> int | None:
    if isinstance(wert, bool):
        return None
    if isinstance(wert, float) and wert.is_integer():
        wert = int(wert)
    return wert if isinstance(wert, int) and wert > 0 else None


def _masse_aus_groesse(wert: object) -> tuple[int | None, int | None]:
    """``size`` im Format ``"1200x800"``: beide Werte oder keiner."""
    treffer = _GROESSE.match(wert.strip().lower()) if isinstance(wert, str) else None
    if treffer is None:
        return None, None
    breite, hoehe = _ganzzahl(int(treffer.group(1))), _ganzzahl(int(treffer.group(2)))
    return (breite, hoehe) if breite is not None and hoehe is not None else (None, None)


def _dauer(wert: object) -> float | None:
    if isinstance(wert, (int, float)) and not isinstance(wert, bool) and math.isfinite(wert) and wert >= 0:
        return float(wert)
    return None


def _text(wert: object) -> str | None:
    if isinstance(wert, str) and wert.strip():
        return wert.strip()
    return None


def _handle(konto: dict[str, Any]) -> str | None:
    for schluessel in ("acct", "username"):
        wert = _text(konto.get(schluessel))
        if wert and _HANDLE.match(wert):
            return wert
    return None


def _http_url(wert: object) -> str | None:
    url = _text(wert)
    if url is None or any(z.isspace() for z in url):
        return None
    try:
        teile = urlsplit(url)
    except ValueError:
        return None
    if teile.scheme.lower() not in ("http", "https") or not teile.netloc:
        return None
    return url


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Öffentliche Bausteine


def ist_werbung(status: object, trump_id: str) -> bool:
    """Werbung in der Timeline: ``sponsored: true`` oder ein Post eines fremden Kontos."""
    s = _dict(status)
    if s.get("sponsored") is True:
        return True
    return _id(_dict(s.get("account")).get("id")) != str(trump_id)


def zaehler_aus(status: object) -> Zaehler:
    """Engagement-Zähler auf oberster Ebene. Negative Werte (Platzhalter ``-1``) gelten als unbekannt."""
    s = _dict(status)
    weitere = {
        schluessel: wert
        for schluessel, wert in s.items()
        if isinstance(schluessel, str)
        and schluessel not in _STANDARD_ZAEHLER
        and _WEITERER_ZAEHLER.match(schluessel)
        and _nicht_negativ(wert) is not None
    }
    return Zaehler(
        replies=_nicht_negativ(s.get("replies_count")),
        retruths=_nicht_negativ(s.get("reblogs_count")),
        likes=_nicht_negativ(s.get("favourites_count")),
        weitere=dict(sorted(weitere.items())),
    )


def bestimme_format(*, n_medien: int, hat_text: bool, hat_text_ohne_urls: bool, hat_link: bool) -> str:
    """Formatkategorie nach der Tabelle in docs/architektur.md; die Fälle schließen sich aus."""
    if n_medien > 0:
        return FORMAT_MEDIEN_TEXT if hat_text else FORMAT_NUR_MEDIEN
    if hat_link:
        return FORMAT_TEXT_LINK if hat_text_ohne_urls else FORMAT_NUR_LINK
    if hat_text:
        return FORMAT_NUR_TEXT
    return FORMAT_LEER


def beschreibe_anhang(anhang: object, position: int) -> MedienDaten:
    """Metadaten eines Anhangs ohne Download: Art, Abmessungen, Dauer, ob ein Hash möglich ist."""
    a = _dict(anhang)
    typ = a.get("type")
    art = _MEDIENARTEN.get(typ.strip().lower(), MEDIUM_SONSTIG) if isinstance(typ, str) else MEDIUM_SONSTIG
    original = _dict(_dict(a.get("meta")).get("original"))
    hat_original = _text(a.get("url")) is not None
    hat_vorschau = _text(a.get("preview_url")) is not None
    if art == MEDIUM_AUDIO:
        hashbar = False
    elif art == MEDIUM_BILD:
        hashbar = hat_original or hat_vorschau
    else:
        # Von Videos, GIFs und Unbekanntem wird nur das Vorschaubild geladen, nie die Datei selbst.
        hashbar = hat_vorschau
    breite, hoehe = _ganzzahl(original.get("width")), _ganzzahl(original.get("height"))
    if breite is None or hoehe is None:
        breite, hoehe = _masse_aus_groesse(original.get("size"))
    return MedienDaten(
        position=position,
        medien_id=_medien_id(a.get("id")),
        art=art,
        breite=breite,
        hoehe=hoehe,
        dauer_s=_dauer(original.get("duration")),
        hash_status=HASH_OFFEN if hashbar else HASH_UEBERSPRUNGEN,
    )


def medien_schluessel(medium: MedienDaten) -> str | None:
    """Vergleichsschlüssel eines Mediums; ``None``, solange der Hash fehlt (offen oder Fehler)."""
    if medium.hash_status == HASH_UEBERSPRUNGEN:
        return f"{medium.art}:ohne-hash:{medium.medien_id}"
    if medium.hash_status in (HASH_FEHLER, HASH_OFFEN):
        return None
    return medium.exakt_schluessel


def medien_hash(medien: list[MedienDaten]) -> tuple[str | None, bool]:
    """(``medien_hash``, ``medien_vollstaendig``). Ohne Medien: (None, True)."""
    schluessel = [medien_schluessel(m) for m in medien]
    if any(s is None for s in schluessel):
        return None, False
    if not schluessel:
        return None, True
    return _sha256("\n".join(sorted(s for s in schluessel if s is not None))), True


def fingerabdruck(
    text_hash: str | None, medien_hash_wert: str | None, quote_id: str | None, *, medien_vollstaendig: bool
) -> str | None:
    """Inhalts-Fingerabdruck; ``None`` bei leerem Inhalt oder unvollständigen Medien."""
    if not medien_vollstaendig or (text_hash is None and medien_hash_wert is None):
        return None
    return _sha256(f"t={text_hash or ''}|m={medien_hash_wert or ''}|q={quote_id or ''}")


# ---------------------------------------------------------------------------
# Quell-Konten


def _quellkonto(konto: dict[str, Any], rolle: str, trump_id: str) -> QuellKonto:
    konto_id = _id(konto.get("id"))
    verifiziert = konto.get("verified")
    anzeigename = konto.get("display_name")
    return QuellKonto(
        rolle=rolle,
        konto_id=konto_id,
        handle=_handle(konto),
        anzeigename=anzeigename.strip() if isinstance(anzeigename, str) else None,
        verifiziert=verifiziert if isinstance(verifiziert, bool) else None,
        follower=_nicht_negativ(konto.get("followers_count")),
        ist_trump=konto_id is not None and konto_id == trump_id,
    )


def _reply_quelle(quelle: dict[str, Any], trump_id: str) -> QuellKonto:
    eingebettet = _dict(_dict(quelle.get("in_reply_to")).get("account"))
    if _id(eingebettet.get("id")) is not None:
        return _quellkonto(eingebettet, ROLLE_REPLY, trump_id)
    konto_id = _id(quelle.get("in_reply_to_account_id"))
    handle = None
    if konto_id is not None:
        for erwaehnung in _liste(quelle.get("mentions")):
            erwaehnung = _dict(erwaehnung)
            if str(erwaehnung.get("id")) != _PLATZHALTER_ID and _id(erwaehnung.get("id")) == konto_id:
                handle = _handle(erwaehnung)
                break
    return QuellKonto(rolle=ROLLE_REPLY, konto_id=konto_id, handle=handle, ist_trump=konto_id == trump_id)


def _quellen(
    reblog: dict[str, Any] | None, quelle: dict[str, Any], *, ist_quote: bool, ist_reply: bool, trump_id: str
) -> list[QuellKonto]:
    quellen: list[QuellKonto] = []
    if reblog is not None:
        quellen.append(_quellkonto(_dict(reblog.get("account")), ROLLE_RETRUTH, trump_id))
    if ist_quote:
        zitiert = _dict(_dict(quelle.get("quote")).get("account"))
        if zitiert:
            quellen.append(_quellkonto(zitiert, ROLLE_QUOTE, trump_id))
        else:
            quellen.append(QuellKonto(rolle=ROLLE_QUOTE, konto_id=None))
    if ist_reply:
        quellen.append(_reply_quelle(quelle, trump_id))
    return quellen


# ---------------------------------------------------------------------------
# Extraktion


def _eigene_url(wert: object, eigene_hosts: tuple[str, ...]) -> str | None:
    """http(s)-URL auf Truth Social selbst. Fremde Post-URLs (föderierte Originale) können
    Titel im Pfad tragen und gelten der Inhaltsprüfung als Inhaltsrest; sie werden ersetzt."""
    url = _http_url(wert)
    if url is None:
        return None
    try:
        host = (urlsplit(url).hostname or "").rstrip(".").lower().removeprefix("www.")
    except ValueError:
        return None
    return url if any(host == e or host.endswith("." + e) for e in eigene_hosts) else None


def _post_url(
    objekt: dict[str, Any], objekt_id: str | None, basis_url: str, eigene_hosts: tuple[str, ...]
) -> str | None:
    url = _eigene_url(objekt.get("url"), eigene_hosts)
    if url is not None:
        return url
    handle = _handle(_dict(objekt.get("account")))
    if handle is not None and objekt_id is not None:
        return f"{basis_url}/@{handle}/{objekt_id}"
    return _eigene_url(objekt.get("uri"), eigene_hosts)


def _quote_links(quelle: dict[str, Any], quote_id: str | None, basis_url: str) -> list[str]:
    """Alle Schreibweisen der URL des zitierten Originals, damit sie nicht als Link zählen."""
    zitat = _dict(quelle.get("quote"))
    links = [u for u in (_http_url(zitat.get("url")), _http_url(zitat.get("uri"))) if u]
    handle = _handle(_dict(zitat.get("account")))
    if quote_id is not None and handle is not None:
        links.append(f"{basis_url}/@{handle}/{quote_id}")
        links.append(f"{basis_url}/users/{handle}/statuses/{quote_id}")
    return links


def _gepinnt(status: dict[str, Any], post_id: str, gepinnte_ids: Iterable[object] | None) -> bool | None:
    if gepinnte_ids is not None:
        return post_id in {str(i) for i in gepinnte_ids}
    pinned = status.get("pinned")
    return pinned if isinstance(pinned, bool) else None


def extrahiere(
    status: object,
    *,
    trump_id: str,
    medien: MedienErfasser | None = None,
    gepinnte_ids: set[str] | None = None,
    basis_url: str = "https://truthsocial.com",
) -> PostDaten:
    """Metadaten eines Status. Ohne ``medien`` werden Anhänge nur beschrieben, nicht gehasht."""
    if not isinstance(status, dict):
        raise ValueError("Status ist kein JSON-Objekt.")
    post_id = _id(status.get("id"))
    if post_id is None:
        raise ValueError("Status ohne gültige ID.")
    created_at = zeit.parse_utc(status.get("created_at"))
    if created_at is None:
        raise ValueError(f"Status {post_id} ohne gültiges created_at.")
    trump_id = str(trump_id)
    basis_url = basis_url.rstrip("/")

    reblog = status.get("reblog") if isinstance(status.get("reblog"), dict) and status.get("reblog") else None
    quelle = reblog if reblog is not None else status
    quelle_id = _id(quelle.get("id"))
    autor_id = _id(_dict(quelle.get("account")).get("id"))

    if reblog is None:
        typ = TYP_EIGEN
    else:
        typ = TYP_SELBST_RETRUTH if autor_id is not None and autor_id == trump_id else TYP_RETRUTH

    zitat = _dict(quelle.get("quote"))
    quote_id = _id(quelle.get("quote_id")) or _id(zitat.get("id"))
    ist_quote = quote_id is not None or bool(zitat)

    in_reply_to_id = _id(quelle.get("in_reply_to_id"))
    ist_reply = in_reply_to_id is not None
    reply_art = None
    if ist_reply:
        ziel_konto = _id(quelle.get("in_reply_to_account_id")) or _id(
            _dict(_dict(quelle.get("in_reply_to")).get("account")).get("id")
        )
        reply_art = REPLY_THREAD if ziel_konto is not None and ziel_konto == autor_id else REPLY_FREMD

    original_created_at = zeit.parse_utc(reblog.get("created_at")) if reblog is not None else None
    latenz = round((created_at - original_created_at).total_seconds()) if original_created_at is not None else None

    try:
        basis_host = urlsplit(basis_url).hostname
    except ValueError:
        basis_host = None
    eigene_hosts = tuple(
        dict.fromkeys(h.lower().removeprefix("www.") for h in (basis_host, "truthsocial.com") if h)
    )
    analyse = text_modul.analysiere(
        quelle.get("content"),
        mentions=quelle.get("mentions"),
        tags=quelle.get("tags"),
        ausgeschlossene_links=_quote_links(quelle, quote_id, basis_url),
        eigene_hosts=eigene_hosts,
    )

    anhaenge = [a for a in _liste(quelle.get("media_attachments")) if isinstance(a, dict)]
    medien_daten = [
        medien.erfasse(anhang, position) if medien is not None else beschreibe_anhang(anhang, position)
        for position, anhang in enumerate(anhaenge)
    ]
    m_hash, vollstaendig = medien_hash(medien_daten)
    karte = quelle.get("card")
    hat_karte = isinstance(karte, dict) and bool(karte)

    url = _post_url(quelle, quelle_id if reblog is not None else post_id, basis_url, eigene_hosts)
    if url is None and reblog is not None:
        url = _post_url(status, post_id, basis_url, eigene_hosts)
    sichtbarkeit = status.get("visibility")
    return PostDaten(
        id=post_id,
        url=url or f"{basis_url}/statuses/{post_id}",
        created_at=created_at,
        typ=typ,
        ist_quote=ist_quote,
        ist_reply=ist_reply,
        reply_art=reply_art,
        in_reply_to_id=in_reply_to_id,
        quote_id=quote_id,
        original_id=quelle_id if reblog is not None else None,
        original_created_at=original_created_at,
        retruth_latenz_s=latenz,
        gepinnt=_gepinnt(status, post_id, gepinnte_ids),
        format=bestimme_format(
            n_medien=len(medien_daten),
            hat_text=analyse.hat_text,
            hat_text_ohne_urls=analyse.hat_text_ohne_urls,
            hat_link=analyse.hat_link_im_text or hat_karte,
        ),
        n_bilder=sum(1 for m in medien_daten if m.art == MEDIUM_BILD),
        n_videos=sum(1 for m in medien_daten if m.art == MEDIUM_VIDEO),
        n_gifs=sum(1 for m in medien_daten if m.art == MEDIUM_GIF),
        n_audio=sum(1 for m in medien_daten if m.art == MEDIUM_AUDIO),
        n_sonstige_medien=sum(1 for m in medien_daten if m.art == MEDIUM_SONSTIG),
        text=analyse.metriken,
        hat_karte=hat_karte,
        medien_hash=m_hash,
        medien_vollstaendig=vollstaendig,
        fingerabdruck=fingerabdruck(analyse.metriken.text_hash, m_hash, quote_id, medien_vollstaendig=vollstaendig),
        edited_at=zeit.parse_utc(status.get("edited_at")),
        sichtbarkeit=sichtbarkeit if isinstance(sichtbarkeit, str) and _SICHTBARKEIT.match(sichtbarkeit) else None,
        zaehler=zaehler_aus(status),
        zaehler_original=zaehler_aus(reblog) if reblog is not None else None,
        medien=medien_daten,
        quellen=_quellen(reblog, quelle, ist_quote=ist_quote, ist_reply=ist_reply, trump_id=trump_id),
    )
