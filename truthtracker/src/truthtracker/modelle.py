"""Datenmodelle: was aus einem API-Objekt übrig bleibt, nachdem die Inhalte weg sind.

Ein ``PostDaten``-Objekt enthält ausschließlich Metadaten (IDs, Zeiten, Zahlen, Hashes,
Link-Domains, Account-Metadaten). Es ist das Einzige, was die Extraktion an Crawler und
Datenbank weitergibt; Texte und Medien-URLs verlassen die Extraktion nie.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

# Post-Typ aus Sicht von Trumps Timeline
TYP_EIGEN = "eigen"
TYP_RETRUTH = "retruth"
TYP_SELBST_RETRUTH = "selbst_retruth"
TYPEN = (TYP_EIGEN, TYP_RETRUTH, TYP_SELBST_RETRUTH)

# Reply-Art
REPLY_THREAD = "thread"  # Antwort an sich selbst
REPLY_FREMD = "fremd"  # Antwort an jemand anderen

# Formatkategorien (schließen sich gegenseitig aus, Regeln in docs/entscheidungen.md)
FORMAT_NUR_TEXT = "nur_text"
FORMAT_NUR_MEDIEN = "nur_medien"
FORMAT_MEDIEN_TEXT = "medien_text"
FORMAT_NUR_LINK = "nur_link"
FORMAT_TEXT_LINK = "text_link"
FORMAT_LEER = "leer_sonstiges"
FORMATE = (FORMAT_NUR_TEXT, FORMAT_NUR_MEDIEN, FORMAT_MEDIEN_TEXT, FORMAT_NUR_LINK, FORMAT_TEXT_LINK, FORMAT_LEER)
FORMAT_BESCHRIFTUNG = {
    FORMAT_NUR_TEXT: "nur Text",
    FORMAT_NUR_MEDIEN: "nur Medien",
    FORMAT_MEDIEN_TEXT: "Medien + Text",
    FORMAT_NUR_LINK: "nur Link",
    FORMAT_TEXT_LINK: "Text + Link",
    FORMAT_LEER: "leer/sonstiges",
}

# Medienarten
MEDIUM_BILD = "bild"
MEDIUM_VIDEO = "video"
MEDIUM_GIF = "gif"
MEDIUM_AUDIO = "audio"
MEDIUM_SONSTIG = "sonstig"

# Status der Medien-Hashes
HASH_OK = "ok"
HASH_FEHLER = "fehler"  # Download oder Bildverarbeitung gescheitert; später erneut versuchen
HASH_UEBERSPRUNGEN = "uebersprungen"  # Art ohne Hash (Audio) oder kein Vorschaubild vorhanden
HASH_OFFEN = "offen"  # noch nicht versucht (z. B. Lauf vorher abgebrochen)

# Rollen von Quell-Accounts
ROLLE_RETRUTH = "retruth"
ROLLE_QUOTE = "quote"
ROLLE_REPLY = "reply"

# Duplikat-Arten (Reihenfolge = Stärke, 1 ist die stärkste)
DUP_GLEICHES_ORIGINAL = "gleiches_original"  # Fall 1
DUP_EXAKT = "exakt"  # Fall 2
DUP_NUR_TEXT = "nur_text"  # Fall 3a
DUP_NUR_MEDIEN = "nur_medien"  # Fall 3b
DUP_MEDIEN_AEHNLICH = "medien_aehnlich"  # Fall 4
DUP_ARTEN = (DUP_GLEICHES_ORIGINAL, DUP_EXAKT, DUP_NUR_TEXT, DUP_NUR_MEDIEN, DUP_MEDIEN_AEHNLICH)
DUP_BESCHRIFTUNG = {
    DUP_GLEICHES_ORIGINAL: "gleiches Original erneut retruthed",
    DUP_EXAKT: "exakt gleich (Text + Medien)",
    DUP_NUR_TEXT: "nur Text gleich",
    DUP_NUR_MEDIEN: "nur Medien gleich",
    DUP_MEDIEN_AEHNLICH: "Medien wahrscheinlich gleich (pHash)",
}


@dataclass
class Zaehler:
    """Engagement-Zähler eines Status-Objekts. ``None`` = Feld fehlte in der Antwort."""

    replies: int | None = None
    retruths: int | None = None
    likes: int | None = None
    weitere: dict[str, int] = field(default_factory=dict)  # z. B. upvotes_count, quotes_count


@dataclass
class QuellKonto:
    """Account-Metadaten einer Quelle (Retruth, Quote, Reply), Stand zum Zeitpunkt der Erfassung."""

    rolle: str
    konto_id: str | None
    handle: str | None = None
    anzeigename: str | None = None
    verifiziert: bool | None = None
    follower: int | None = None
    ist_trump: bool = False


@dataclass
class MedienDaten:
    position: int
    medien_id: str | None
    art: str
    breite: int | None = None
    hoehe: int | None = None
    dauer_s: float | None = None
    sha256: str | None = None
    phash: str | None = None  # 64 Bit als 16 Hex-Zeichen
    hash_quelle: str | None = None  # "original" (Bilddatei) oder "vorschau" (Vorschaubild)
    hash_status: str = HASH_OFFEN

    @property
    def exakt_schluessel(self) -> str | None:
        """Schlüssel für den exakten Medienvergleich; ``None``, solange kein Hash da ist.

        Bei Videos und GIFs gibt es nur das Vorschaubild; Dauer und Abmessungen kommen
        dazu, damit zwei verschiedene Videos mit gleichem Standbild nicht als gleich gelten.
        """
        if not self.sha256:
            return None
        if self.art in (MEDIUM_VIDEO, MEDIUM_GIF):
            dauer = f"{self.dauer_s:.1f}" if self.dauer_s is not None else "-"
            return f"{self.art}:{self.sha256}:{dauer}:{self.breite}x{self.hoehe}"
        return f"{self.art}:{self.sha256}"


@dataclass
class TextMetriken:
    zeichen: int = 0
    zeichen_ohne_urls: int = 0
    n_urls: int = 0
    n_mentions: int = 0
    n_hashtags: int = 0
    link_domains: list[str] = field(default_factory=list)  # externe Domains, sortiert, ohne Dubletten
    text_hash: str | None = None  # None bei leerem Text


@dataclass
class PostDaten:
    id: str
    url: str
    created_at: datetime
    typ: str
    ist_quote: bool = False
    ist_reply: bool = False
    reply_art: str | None = None
    in_reply_to_id: str | None = None
    quote_id: str | None = None
    original_id: str | None = None
    original_created_at: datetime | None = None
    retruth_latenz_s: int | None = None
    gepinnt: bool | None = None
    format: str = FORMAT_LEER
    n_bilder: int = 0
    n_videos: int = 0
    n_gifs: int = 0
    n_audio: int = 0
    n_sonstige_medien: int = 0
    text: TextMetriken = field(default_factory=TextMetriken)
    hat_karte: bool = False
    medien_hash: str | None = None
    medien_vollstaendig: bool = True
    fingerabdruck: str | None = None
    edited_at: datetime | None = None
    revision: int | None = None  # Feld "version" der API: 1 = unbearbeitet, 2 = einmal bearbeitet …
    sichtbarkeit: str | None = None
    zaehler: Zaehler = field(default_factory=Zaehler)
    zaehler_original: Zaehler | None = None
    medien: list[MedienDaten] = field(default_factory=list)
    quellen: list[QuellKonto] = field(default_factory=list)

    @property
    def inhalts_id(self) -> str:
        """ID des eigentlichen Inhalts: bei Retruths das Original, sonst der Post selbst."""
        return self.original_id or self.id

    @property
    def ist_retruth(self) -> bool:
        return self.typ in (TYP_RETRUTH, TYP_SELBST_RETRUTH)

    @property
    def typ_detail(self) -> str:
        """Feinere Typangabe für Filter: Retruth-Arten vor Reply vor Quote vor eigenem Post."""
        if self.ist_retruth:
            return self.typ
        if self.ist_reply:
            return "reply_thread" if self.reply_art == REPLY_THREAD else "reply_fremd"
        if self.ist_quote:
            return "quote"
        return TYP_EIGEN


TYP_DETAIL_BESCHRIFTUNG = {
    TYP_EIGEN: "eigener Post",
    TYP_RETRUTH: "Retruth",
    TYP_SELBST_RETRUTH: "Selbst-Retruth",
    "quote": "Quote",
    "reply_thread": "Reply (Thread)",
    "reply_fremd": "Reply (an andere)",
}
