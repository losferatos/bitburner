"""Klassifikation: aus einem Status-Objekt der API wird ein ``PostDaten``-Objekt (nur Metadaten).

Regeln in docs/architektur.md, Abschnitt "Klassifikation (Regeln)". Texte, HTML, Medien-URLs,
Alt-Texte und Kartentitel werden hier nur gelesen, um Zahlen und Hashes zu berechnen; sie
gelangen weder in das Ergebnis noch in Fehlermeldungen.

Das API-Objekt ist fremde Eingabe: Jedes Feld kann fehlen, ``null`` sein oder einen
unerwarteten Typ haben. Nur ohne gültige ``id`` oder ``created_at`` gibt es einen ``ValueError``.
Was herausgeht, passt zu den Positivlisten des Prüfskripts (``pruefung.py``): IDs nur aus
Ziffern und im 64-Bit-Bereich, Post-URLs nur als ``{basis}/@name/ID``, Handles nur aus
Buchstaben, Ziffern und ``_`` (plus ``@domain``), Anzeigenamen einzeilig, Zeitpunkte ab 1970.
"""

from __future__ import annotations

import hashlib
import math
import re
import unicodedata
from collections.abc import Iterable
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any
from urllib.parse import SplitResult, urlsplit

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

STANDARD_BASIS_URL = "https://truthsocial.com"

_MAX_INT64 = 2**63 - 1  # SQLite INTEGER
_MAX_REVISION = 999_999_999
_MAX_KANTE_PX = 100_000  # wie in medien.py
_MAX_ANZEIGENAME = 100  # Prüfskript: höchstens 100 Zeichen, eine Zeile
_FRUEHESTE_ZEIT = datetime(1970, 1, 1, tzinfo=UTC)

_ID = re.compile(r"[0-9]{1,19}")
_REVISION = re.compile(r"[0-9]{1,9}")
_HANDLE = re.compile(r"[A-Za-z0-9_]{1,64}(?:@[A-Za-z0-9.-]{1,253})?")
_LOKALER_HANDLE = re.compile(r"[A-Za-z0-9_]{1,64}")
_GROESSE = re.compile(r"([0-9]{1,6})x([0-9]{1,6})")
_WEITERER_ZAEHLER = re.compile(r"[a-z][a-z0-9_]{0,58}_count")
_LEERRAUM = re.compile(r"\s+")
# Anzeigenamen, die das Prüfskript für HTML- oder Link-Reste hielte.
_MARKUP_ODER_LINK = re.compile(
    r"://|<\s*/?\s*[A-Za-z][^<>]*>|&(?:#[0-9]+|#x[0-9a-f]+|[a-z]+);|\b(?:class|href|src|rel|target)\s*=\s*[\"']",
    re.IGNORECASE,
)
# Post-Seite (``/@name/ID``) oder ActivityPub-Adresse (``/users/name/statuses/ID``) auf Truth Social.
_POST_PFAD = re.compile(
    r"/@(?P<name>[A-Za-z0-9_]{1,64})/(?P<id>[0-9]{1,19})/?"
    r"|/users/(?P<name2>[A-Za-z0-9_]{1,64})/statuses/(?P<id2>[0-9]{1,19})/?"
)
_STANDARD_ZAEHLER = ("replies_count", "reblogs_count", "favourites_count")
_PLATZHALTER_ID = "-99"
_SICHTBARKEITEN = frozenset({"public", "unlisted", "private", "direct", "limited", "self", "group"})
_STANDARD_PORTS = {"http": 80, "https": 443}

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


def _ganze_zahl(wert: object, ziffern: re.Pattern[str]) -> int | None:
    """Eine ``int`` (kein ``bool``) oder eine Folge von ASCII-Ziffern als Zahl."""
    if isinstance(wert, bool):
        return None
    if isinstance(wert, int):
        return wert
    if isinstance(wert, str) and ziffern.fullmatch(wert.strip()):
        return int(wert.strip())
    return None


def _id(wert: object) -> str | None:
    """Numerische ID (1 bis 2⁶³−1) als Text; alles andere (auch der Platzhalter -99) wird ``None``."""
    zahl = _ganze_zahl(wert, _ID)
    return str(zahl) if zahl is not None and 1 <= zahl <= _MAX_INT64 else None


def _revision(wert: object) -> int | None:
    """Feld ``version``: 1 = unbearbeitet, 2 = einmal bearbeitet … (live als Text ``"1"``)."""
    zahl = _ganze_zahl(wert, _REVISION)
    return zahl if zahl is not None and 1 <= zahl <= _MAX_REVISION else None


def _nicht_negativ(wert: object) -> int | None:
    if isinstance(wert, int) and not isinstance(wert, bool) and 0 <= wert <= _MAX_INT64:
        return wert
    return None


def _kante(wert: object) -> int | None:
    if isinstance(wert, bool):
        return None
    if isinstance(wert, float) and wert.is_integer():
        wert = int(wert)
    return wert if isinstance(wert, int) and 0 < wert <= _MAX_KANTE_PX else None


def _masse_aus_groesse(wert: object) -> tuple[int | None, int | None]:
    """``size`` im Format ``"1200x800"``: beide Werte oder keiner."""
    treffer = _GROESSE.fullmatch(wert.strip().lower()) if isinstance(wert, str) else None
    if treffer is None:
        return None, None
    breite, hoehe = _kante(int(treffer.group(1))), _kante(int(treffer.group(2)))
    return (breite, hoehe) if breite is not None and hoehe is not None else (None, None)


def _dauer(wert: object) -> float | None:
    if isinstance(wert, (int, float)) and not isinstance(wert, bool) and math.isfinite(wert) and wert >= 0:
        return float(wert)
    return None


def _text(wert: object) -> str | None:
    if isinstance(wert, str) and wert.strip():
        return wert.strip()
    return None


def _zeit(wert: object) -> datetime | None:
    """UTC-Zeitpunkt; ``None`` bei unlesbaren Werten und bei Zeitpunkten vor 1970.

    ``zeit.parse_utc`` wirft bei Randdaten mit Offset (Jahr 1 oder 9999) einen ``OverflowError``;
    Jahre unter 1000 schriebe ``strftime`` ohne führende Nullen in die Datenbank.
    """
    try:
        dt = zeit.parse_utc(wert)
    except (OverflowError, ValueError):
        return None
    return dt if dt is not None and dt >= _FRUEHESTE_ZEIT else None


def _handle(konto: dict[str, Any]) -> str | None:
    """``acct``; nur wenn es fehlt, ``username``. Ein ungültiges ``acct`` ergibt keinen Handle."""
    acct = _text(konto.get("acct"))
    if acct is None:
        acct = _text(konto.get("username"))
    return acct if acct is not None and _HANDLE.fullmatch(acct) else None


def _lokaler_handle(konto: dict[str, Any]) -> str | None:
    """Handle eines Kontos auf Truth Social selbst (ohne ``@domain``), tauglich für eine Post-URL."""
    handle = _handle(konto)
    return handle if handle is not None and _LOKALER_HANDLE.fullmatch(handle) else None


def _anzeigename(wert: object) -> str | None:
    """Eine Zeile ohne Steuerzeichen, höchstens 100 Codepunkte; ``None``, wenn er wie HTML oder ein Link aussieht."""
    if not isinstance(wert, str):
        return None
    name = _LEERRAUM.sub(" ", text_modul.bereinige_unicode(wert))
    name = "".join(z for z in name if unicodedata.category(z) != "Cc").strip()
    if not name or _MARKUP_ODER_LINK.search(name):
        return None
    return text_modul.kuerze(name, _MAX_ANZEIGENAME).strip() or None


def _sichtbarkeit(wert: object) -> str | None:
    if isinstance(wert, str) and wert.strip().lower() in _SICHTBARKEITEN:
        return wert.strip().lower()
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
        and _WEITERER_ZAEHLER.fullmatch(schluessel)
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
    """Metadaten eines Anhangs ohne Download. Dieselben Regeln wie beim Hashen (``medien.beschreibe``),
    damit der Modus ohne Erfasser nie einen anderen Status liefert als der Erfasser."""
    from truthtracker import medien as medien_modul

    return medien_modul.beschreibe(anhang if isinstance(anhang, dict) else {}, position)


def medien_schluessel(medium: MedienDaten, inhalts_id: str | None = None) -> str | None:
    """Vergleichsschlüssel eines Mediums; ``None``, solange der Hash fehlt (offen oder Fehler).

    Medien ohne Hash (Audio, keine Vorschau) werden über ihre ID verglichen. Fehlt auch die ID,
    gilt das Medium nur als gleich mit sich selbst (Inhalts-ID und Position): Zwei solche Medien
    in verschiedenen Posts dürfen nicht als identisch durchgehen.
    """
    if medium.hash_status == HASH_UEBERSPRUNGEN:
        if medium.medien_id:
            return f"{medium.art}:ohne-hash:{medium.medien_id}"
        return f"{medium.art}:ohne-hash:{inhalts_id}:{medium.position}"
    if medium.hash_status in (HASH_FEHLER, HASH_OFFEN):
        return None
    return medium.exakt_schluessel


def medien_hash(medien: list[MedienDaten], inhalts_id: str | None = None) -> tuple[str | None, bool]:
    """(``medien_hash``, ``medien_vollstaendig``). Ohne Medien: (None, True)."""
    schluessel = [medien_schluessel(m, inhalts_id) for m in medien]
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
    return QuellKonto(
        rolle=rolle,
        konto_id=konto_id,
        handle=_handle(konto),
        anzeigename=_anzeigename(konto.get("display_name")),
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
# Post-URL


def _host_schluessel(teile: SplitResult) -> str | None:
    """Host klein und ohne ``www.``, mit Port nur, wenn er vom Standard des Schemas abweicht."""
    try:
        host, port = teile.hostname, teile.port
    except ValueError:
        return None
    if not host:
        return None
    host = host.rstrip(".").lower().removeprefix("www.")
    return host if port is None or port == _STANDARD_PORTS.get(teile.scheme.lower()) else f"{host}:{port}"


def _basen(basis_url: str) -> dict[str, str]:
    """Host-Schlüssel → Präfix der Post-URLs: truthsocial.com und die konfigurierte Basis."""
    basen = {"truthsocial.com": STANDARD_BASIS_URL}
    try:
        schluessel = _host_schluessel(urlsplit(basis_url))
    except ValueError:
        schluessel = None
    if schluessel is not None:
        basen[schluessel] = basis_url
    return basen


def _url_aus_feld(wert: object, objekt_id: str, basen: dict[str, str]) -> str | None:
    """``{basis}/@name/ID`` aus der Post- oder ActivityPub-Adresse des Objekts auf einem eigenen Host."""
    url = _http_url(wert)
    if url is None:
        return None
    try:
        teile = urlsplit(url)
    except ValueError:
        return None
    basis = basen.get(_host_schluessel(teile) or "")
    treffer = _POST_PFAD.fullmatch(teile.path) if basis is not None else None
    if treffer is None or _id(treffer.group("id") or treffer.group("id2")) != objekt_id:
        return None
    return f"{basis}/@{treffer.group('name') or treffer.group('name2')}/{objekt_id}"


def _post_url(objekte: list[tuple[dict[str, Any], str | None]], basis_url: str) -> str:
    """Link zum Post in der Form ``{basis}/@name/ID``, die das Prüfskript als Post-URL kennt.

    Der Reihe nach je Objekt: ``url``, ``uri``, dann lokaler Handle plus ID. Für Retruths kommt
    zuerst das Original, dann der Retruth selbst: ``/@realDonaldTrump/<Retruth-ID>`` leitet auf
    das Original weiter und hilft bei föderierten Originalen, deren Adresse fremd ist. Gibt es
    nichts Brauchbares, bleibt die URL leer statt einer Adresse, die es nicht gibt.
    """
    basen = _basen(basis_url)
    for objekt, objekt_id in objekte:
        if objekt_id is None:
            continue
        for feld in ("url", "uri"):
            url = _url_aus_feld(objekt.get(feld), objekt_id, basen)
            if url is not None:
                return url
        handle = _lokaler_handle(_dict(objekt.get("account")))
        if handle is not None:
            return f"{basis_url}/@{handle}/{objekt_id}"
    return ""


# ---------------------------------------------------------------------------
# Extraktion


def _quote_links(quelle: dict[str, Any]) -> list[str]:
    """Adressen des eingebetteten Originals, auch auf fremden Hosts (Post-Links auf Truth Social
    selbst erkennt ``text.analysiere`` über die Status-ID)."""
    zitat = _dict(quelle.get("quote"))
    return [u for u in (_http_url(zitat.get("url")), _http_url(zitat.get("uri"))) if u]


def _gepinnt(status: dict[str, Any], post_id: str, gepinnte_ids: Iterable[object] | None) -> bool | None:
    """Mit Liste: steht drin oder nicht. Ohne Liste nur ``pinned: true`` → ``True``, sonst unbekannt,
    weil ``pinned`` ausgeloggt immer ``false`` ist."""
    if gepinnte_ids is not None:
        return post_id in {_id(i) for i in gepinnte_ids}
    return True if status.get("pinned") is True else None


def extrahiere(
    status: object,
    *,
    trump_id: str,
    medien: MedienErfasser | None = None,
    gepinnte_ids: set[str] | None = None,
    basis_url: str = STANDARD_BASIS_URL,
) -> PostDaten:
    """Metadaten eines Status. Ohne ``medien`` werden Anhänge nur beschrieben, nicht gehasht."""
    if not isinstance(status, dict):
        raise ValueError("Status ist kein JSON-Objekt.")
    post_id = _id(status.get("id"))
    if post_id is None:
        raise ValueError("Status ohne gültige ID.")
    created_at = _zeit(status.get("created_at"))
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

    original_created_at = _zeit(reblog.get("created_at")) if reblog is not None else None
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
        ausgeschlossene_links=_quote_links(quelle),
        ausgeschlossene_ids=[quote_id] if quote_id is not None else [],
        eigene_hosts=eigene_hosts,
    )

    anhaenge = [a for a in _liste(quelle.get("media_attachments")) if isinstance(a, dict)]
    medien_daten = [
        medien.erfasse(anhang, position) if medien is not None else beschreibe_anhang(anhang, position)
        for position, anhang in enumerate(anhaenge)
    ]
    m_hash, vollstaendig = medien_hash(medien_daten, quelle_id or post_id)
    karte = quelle.get("card")
    hat_karte = isinstance(karte, dict) and bool(karte)

    url_objekte = [(reblog, quelle_id), (status, post_id)] if reblog is not None else [(status, post_id)]
    return PostDaten(
        id=post_id,
        url=_post_url(url_objekte, basis_url),
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
        edited_at=_zeit(status.get("edited_at")),
        revision=_revision(status.get("version")),
        sichtbarkeit=_sichtbarkeit(status.get("visibility")),
        zaehler=zaehler_aus(status),
        zaehler_original=zaehler_aus(reblog) if reblog is not None else None,
        medien=medien_daten,
        quellen=_quellen(reblog, quelle, ist_quote=ist_quote, ist_reply=ist_reply, trump_id=trump_id),
    )
