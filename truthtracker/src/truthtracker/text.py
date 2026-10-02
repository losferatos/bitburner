"""Text-Metadaten aus dem ``content``-HTML eines Posts: Länge, URLs, Mentions, Hashtags, Hash.

Der Text existiert nur im Speicher dieses Moduls. Heraus gehen ausschließlich Zahlen,
Link-Domains und der SHA-256 des normalisierten Texts (für Duplikate und Edits).

Regeln (docs/architektur.md, Abschnitt "Text"):

* ``<p>`` und andere Blockelemente trennen Absätze (Leerzeile), ``<br>`` und ``<li>`` Zeilen.
  Leerraum am Rand eines Absatzes oder einer Zeile zählt nicht.
* Elemente mit der Klasse ``quote-inline`` (Quote-Fallback "RE: …") fallen ganz weg, ebenso
  Links auf das zitierte Original (``ausgeschlossene_links``).
* Spannen mit ``invisible``/``ellipsis`` bleiben vollständig: Ein Link zählt mit seiner ganzen URL.
* Gezählt wird in Graphem-Clustern (``regex``, ``\\X``): ein Emoji mit ZWJ, eine Flagge oder
  ein Buchstabe mit kombinierendem Akzent ist je ein Zeichen.
"""

from __future__ import annotations

import hashlib
import html as html_modul
import re
import unicodedata
from collections.abc import Iterable
from dataclasses import dataclass, field
from html.parser import HTMLParser
from urllib.parse import urlsplit

import regex

from truthtracker.modelle import TextMetriken

_GRAPHEM = regex.compile(r"\X")
_LEERRAUM = re.compile(r"\s+")
_LEERRAUM_OHNE_ZEILENUMBRUCH = re.compile(r"[^\S\n]+")
_NACKTE_URL = re.compile(r"https?://[^\s<>\"']+", re.IGNORECASE)
_URL_ENDZEICHEN = ".,;:!?)]}\u00bb\u2026\u201c\u201d\u2018\u2019"  # auch » … und typografische Anführungszeichen
_KLAMMERN = {")": "(", "]": "[", "}": "{"}
_HOST = re.compile(r"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$")
_PROFILPFAD = re.compile(r"^/@[^/]+/?$")
_DEKLARATION = re.compile(r"<[!?][^>]*>")
_TAG = re.compile(r"<[^>]*>")

_LEERE_ELEMENTE = frozenset(
    {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
)
_ABSATZ_ELEMENTE = frozenset({"p", "div", "blockquote", "pre", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6"})
_ZEILEN_ELEMENTE = frozenset({"li"})
_UNSICHTBARE_ELEMENTE = frozenset({"script", "style", "template", "head", "title"})
_KLASSE_QUOTE_FALLBACK = "quote-inline"

# Arten der Stücke, die der Parser liefert
_TEXT = "text"  # gewöhnlicher Text, wird nach nackten URLs durchsucht
_LINK = "link"  # ein <a>-Element, Art wird danach bestimmt
_ZEILE = "zeile"  # <br>, <li>
_ABSATZ = "absatz"  # Grenze eines Blockelements

# Arten von Links
_LINK_URL = "url"
_LINK_MENTION = "mention"
_LINK_HASHTAG = "hashtag"
_LINK_TEXT = "text"  # <a> ohne Ziel: gewöhnlicher Text
_LINK_AUSGESCHLOSSEN = "ausgeschlossen"


@dataclass
class TextAnalyse:
    metriken: TextMetriken
    hat_text: bool
    hat_text_ohne_urls: bool
    hat_link_im_text: bool


@dataclass
class _Link:
    href: str
    klassen: frozenset[str]
    rel: frozenset[str]
    teile: list[str] = field(default_factory=list)


@dataclass
class _Stueck:
    art: str
    text: str = ""
    link: _Link | None = None


@dataclass
class _Block:
    """Ein Absatz oder eine Zeile; ``stuecke`` sind (Text, ist_url)."""

    absatz_vorher: bool = False
    zeilen_vorher: int = 0
    stuecke: list[tuple[str, bool]] = field(default_factory=list)


class _Zerleger(HTMLParser):
    """Zerlegt Mastodon-HTML in Text-, Link- und Umbruch-Stücke."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.folge: list[_Stueck] = []
        self._stapel: list[tuple[str, bool]] = []  # (Element, versteckt)
        self._link: _Link | None = None

    def _versteckt(self) -> bool:
        return bool(self._stapel) and self._stapel[-1][1]

    def _link_schliessen(self) -> None:
        if self._link is not None:
            self.folge.append(_Stueck(_LINK, link=self._link))
            self._link = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in _LEERE_ELEMENTE:
            # Ein Umbruch innerhalb eines Links gehört zum Linktext, nicht zur Absatzstruktur.
            if tag == "br" and not self._versteckt() and self._link is None:
                self.folge.append(_Stueck(_ZEILE))
            return
        attribute = {name: (wert or "") for name, wert in attrs}
        klassen = frozenset(attribute.get("class", "").split())
        versteckt = self._versteckt() or tag in _UNSICHTBARE_ELEMENTE or _KLASSE_QUOTE_FALLBACK in klassen
        self._stapel.append((tag, versteckt))
        if versteckt:
            return
        if tag == "a":
            self._link_schliessen()
            self._link = _Link(
                href=attribute.get("href", "").strip(),
                klassen=klassen,
                rel=frozenset(attribute.get("rel", "").lower().split()),
            )
        elif self._link is None and tag in _ABSATZ_ELEMENTE:
            self.folge.append(_Stueck(_ABSATZ))
        elif self._link is None and tag in _ZEILEN_ELEMENTE:
            self.folge.append(_Stueck(_ZEILE))

    def handle_endtag(self, tag: str) -> None:
        for index in range(len(self._stapel) - 1, -1, -1):
            if self._stapel[index][0] == tag:
                break
        else:
            return
        while len(self._stapel) > index:
            name, versteckt = self._stapel.pop()
            if versteckt:
                continue
            if name == "a":
                self._link_schliessen()
            elif self._link is None and name in _ABSATZ_ELEMENTE:
                self.folge.append(_Stueck(_ABSATZ))

    def handle_data(self, data: str) -> None:
        if self._versteckt():
            return
        if self._link is not None:
            self._link.teile.append(data)
        else:
            self.folge.append(_Stueck(_TEXT, data))

    def close(self) -> None:
        super().close()
        self._link_schliessen()


def _zerlege(html: object) -> list[_Stueck]:
    if not isinstance(html, str) or not html:
        return []
    # Ältere html.parser-Versionen werfen bei kaputten Deklarationen AssertionErrors, deren
    # Meldung HTML-Ausschnitte enthält. Deshalb nie weiterreichen, sondern abgestuft ausweichen.
    for quelle in (html, _DEKLARATION.sub("", html)):
        zerleger = _Zerleger()
        try:
            zerleger.feed(quelle)
            zerleger.close()
        except Exception:
            continue
        return zerleger.folge
    return [_Stueck(_TEXT, html_modul.unescape(_TAG.sub(" ", html)))]


# ---------------------------------------------------------------------------
# URLs und Hosts


def _normalisiere_host(host: str) -> str:
    return host.strip().rstrip(".").lower().removeprefix("www.")


def _ist_eigener_host(host: str, eigene: tuple[str, ...]) -> bool:
    return any(host == e or host.endswith("." + e) for e in eigene)


def _domain(url: str, eigene: tuple[str, ...]) -> str | None:
    """Host einer externen URL ohne ``www.``; ``None`` bei eigenen oder unbrauchbaren Hosts."""
    try:
        host = urlsplit(url).hostname
    except ValueError:
        return None
    if not host:
        return None
    host = _normalisiere_host(host)
    if not host.isascii():
        try:
            host = host.encode("idna").decode("ascii")
        except UnicodeError:
            return None
    if not _HOST.match(host) or _ist_eigener_host(host, eigene):
        return None
    return host


def _kanonisch(url: str, eigene: tuple[str, ...]) -> str | None:
    """Vergleichsform einer URL: Host ohne ``www.``, Pfad klein und ohne Schrägstrich am Ende, Query.

    Der Pfad wird kleingeschrieben, weil Handles in Mastodon-URLs nicht auf Groß- und
    Kleinschreibung achten (``/@Jemand/1`` = ``/@jemand/1``)."""
    try:
        teile = urlsplit(url.strip())
        host = teile.hostname
    except ValueError:
        return None
    host = _normalisiere_host(host) if host else (eigene[0] if eigene else "")
    pfad = teile.path.rstrip("/").lower()
    if not host and not pfad:
        return None
    return f"{host}{pfad}" + (f"?{teile.query}" if teile.query else "")


def _link_art(link: _Link, text: str, eigene: tuple[str, ...], ausgeschlossen: set[str]) -> str:
    if not link.href:
        return _LINK_TEXT
    if _kanonisch(link.href, eigene) in ausgeschlossen:
        return _LINK_AUSGESCHLOSSEN
    if not text.strip():
        return _LINK_TEXT
    if "hashtag" in link.klassen or "tag" in link.rel:
        return _LINK_HASHTAG
    if "mention" in link.klassen:
        return _LINK_MENTION
    try:
        teile = urlsplit(link.href)
        host = teile.hostname
    except ValueError:
        return _LINK_URL
    eigener_host = not host or _ist_eigener_host(_normalisiere_host(host), eigene)
    if teile.scheme.lower() in ("", "http", "https") and eigener_host:
        # Nur Profilseiten gelten als Mention; ein Link auf einen Post (/@name/123) ist eine URL.
        if _PROFILPFAD.match(teile.path):
            return _LINK_MENTION
        if teile.path.startswith("/tags/"):
            return _LINK_HASHTAG
    return _LINK_URL


def _kuerze_url(url: str) -> str:
    """Satzzeichen am Ende gehören nicht zur nackten URL; schließende Klammern nur ohne Gegenstück."""
    while url and url[-1] in _URL_ENDZEICHEN:
        oeffnend = _KLAMMERN.get(url[-1])
        if oeffnend is not None and url.count(oeffnend) >= url.count(url[-1]):
            break
        url = url[:-1]
    return url


def _teile_nackte_urls(text: str) -> list[tuple[str, bool]]:
    teile: list[tuple[str, bool]] = []
    position = 0
    for treffer in _NACKTE_URL.finditer(text):
        url = _kuerze_url(treffer.group())
        if "://" not in url or url.endswith("://"):
            continue
        if treffer.start() > position:
            teile.append((text[position : treffer.start()], False))
        teile.append((url, True))
        position = treffer.start() + len(url)
    if position < len(text):
        teile.append((text[position:], False))
    return teile


# ---------------------------------------------------------------------------
# Zusammensetzen


@dataclass
class _Zerlegung:
    bloecke: list[_Block]
    urls: list[str]
    n_mentions: int
    n_hashtags: int


def _baue_bloecke(folge: list[_Stueck], eigene: tuple[str, ...], ausgeschlossen: set[str]) -> _Zerlegung:
    bloecke = [_Block()]
    urls: list[str] = []
    n_mentions = n_hashtags = 0
    text_puffer: list[str] = []

    def puffer_leeren() -> None:
        if text_puffer:
            for teil, ist_url in _teile_nackte_urls("".join(text_puffer)):
                bloecke[-1].stuecke.append((teil, ist_url))
                if ist_url:
                    urls.append(teil)
            text_puffer.clear()

    def umbruch(absatz: bool) -> None:
        puffer_leeren()
        if bloecke[-1].stuecke:
            bloecke.append(_Block())
        if absatz:
            bloecke[-1].absatz_vorher = True
        else:
            bloecke[-1].zeilen_vorher += 1

    for stueck in folge:
        if stueck.art == _TEXT:
            text_puffer.append(stueck.text)
        elif stueck.art == _ABSATZ:
            umbruch(absatz=True)
        elif stueck.art == _ZEILE:
            umbruch(absatz=False)
        elif stueck.link is not None:
            linktext = "".join(stueck.link.teile)
            art = _link_art(stueck.link, linktext, eigene, ausgeschlossen)
            if art == _LINK_AUSGESCHLOSSEN:
                continue
            if art == _LINK_TEXT:
                text_puffer.append(linktext)
                continue
            puffer_leeren()
            bloecke[-1].stuecke.append((linktext, art == _LINK_URL))
            if art == _LINK_URL:
                urls.append(stueck.link.href)
            elif art == _LINK_MENTION:
                n_mentions += 1
            else:
                n_hashtags += 1
    puffer_leeren()
    return _Zerlegung(bloecke, urls, n_mentions, n_hashtags)


def _verbinde(bloecke: list[_Block], *, mit_urls: bool) -> str:
    teile: list[str] = []
    absatz, zeilen = False, 0
    for block in bloecke:
        absatz = absatz or block.absatz_vorher
        zeilen += block.zeilen_vorher
        text = "".join(t for t, ist_url in block.stuecke if mit_urls or not ist_url)
        if not mit_urls:
            text = _LEERRAUM_OHNE_ZEILENUMBRUCH.sub(" ", text)
        text = text.strip()
        if not text:
            continue
        if teile:
            teile.append("\n" * max(2 if absatz else 1, zeilen))
        teile.append(text)
        absatz, zeilen = False, 0
    return "".join(teile)


# ---------------------------------------------------------------------------
# Öffentliche Funktionen


def sichtbarer_text(html: object) -> str:
    """Der Text, den ein Leser sieht: ohne HTML, Entities dekodiert, ohne Quote-Fallback, getrimmt."""
    zerlegung = _baue_bloecke(_zerlege(html), ("truthsocial.com",), set())
    return _verbinde(zerlegung.bloecke, mit_urls=True)


def zaehle_grapheme(text: str) -> int:
    return sum(1 for _ in _GRAPHEM.finditer(text))


def normalisiere_fuer_hash(text: str) -> str:
    """Unicode NFC, jede Folge von Leerraum (auch Zeilenumbrüche) zu einem Leerzeichen, getrimmt."""
    return _LEERRAUM.sub(" ", unicodedata.normalize("NFC", text)).strip()


def text_hash(text: str) -> str | None:
    normalisiert = normalisiere_fuer_hash(text)
    if not normalisiert:
        return None
    return hashlib.sha256(normalisiert.encode("utf-8")).hexdigest()


def _anzahl_mentions(mentions: object) -> int:
    if not isinstance(mentions, list):
        return 0
    # -99 ist bei Truth Social ein Platzhalter, keine erwähnte Person.
    return sum(1 for m in mentions if isinstance(m, dict) and str(m.get("id")) != "-99")


def _anzahl_tags(tags: object) -> int:
    if not isinstance(tags, list):
        return 0
    return sum(1 for t in tags if isinstance(t, (dict, str)))


def analysiere(
    html: object,
    *,
    mentions: object = None,
    tags: object = None,
    ausgeschlossene_links: Iterable[str] = (),
    eigene_hosts: Iterable[str] = ("truthsocial.com",),
) -> TextAnalyse:
    """Metriken des ``content``-HTML. ``ausgeschlossene_links``: URLs des zitierten Originals."""
    eigene = tuple(dict.fromkeys(_normalisiere_host(h) for h in eigene_hosts if isinstance(h, str) and h.strip()))
    ausgeschlossen = {
        k for k in (_kanonisch(u, eigene) for u in ausgeschlossene_links if isinstance(u, str) and u.strip()) if k
    }
    zerlegung = _baue_bloecke(_zerlege(html), eigene, ausgeschlossen)
    sichtbar = _verbinde(zerlegung.bloecke, mit_urls=True)
    ohne_urls = _verbinde(zerlegung.bloecke, mit_urls=False)
    domains = {d for d in (_domain(u, eigene) for u in zerlegung.urls) if d}
    metriken = TextMetriken(
        zeichen=zaehle_grapheme(sichtbar),
        zeichen_ohne_urls=zaehle_grapheme(ohne_urls),
        n_urls=len(zerlegung.urls),
        n_mentions=zerlegung.n_mentions or _anzahl_mentions(mentions),
        n_hashtags=zerlegung.n_hashtags or _anzahl_tags(tags),
        link_domains=sorted(domains),
        text_hash=text_hash(sichtbar),
    )
    return TextAnalyse(
        metriken=metriken,
        hat_text=metriken.zeichen > 0,
        hat_text_ohne_urls=metriken.zeichen_ohne_urls > 0,
        hat_link_im_text=metriken.n_urls > 0,
    )
