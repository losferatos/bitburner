"""Tests für text.py: sichtbarer Text, Graphem-Zählung, URLs, Mentions, Hashtags, Text-Hash.

Alle Texte sind synthetisch und tragen, wo es um Datenschutz geht, den Marker ``SYNTHETIK``.
"""

from __future__ import annotations

import dataclasses
import hashlib
import json
import unicodedata

import pytest
from fabrik import MARKER

from truthtracker import text
from truthtracker.text import (
    analysiere,
    bereinige_unicode,
    kuerze,
    normalisiere_fuer_hash,
    sichtbarer_text,
    text_hash,
    zaehle_grapheme,
)

ORIGINAL_ID = "114000000000000001"
ORIGINAL = f"https://truthsocial.com/@jemand/{ORIGINAL_ID}"


def link(url: str, *, sichtbar_von: int = 8, sichtbar_bis: int = 30) -> str:
    """Link so, wie Mastodon/Truth Social ihn rendert: Schema unsichtbar, Rest gekürzt mit Ellipse."""
    anfang, mitte, ende = url[:sichtbar_von], url[sichtbar_von:sichtbar_bis], url[sichtbar_bis:]
    return (
        f'<a href="{url}" rel="nofollow noopener noreferrer" target="_blank">'
        f'<span class="invisible">{anfang}</span><span class="ellipsis">{mitte}</span>'
        f'<span class="invisible">{ende}</span></a>'
    )


def mention(handle: str, basis: str = "https://truthsocial.com") -> str:
    return (
        f'<span class="h-card"><a href="{basis}/@{handle}" class="u-url mention">@<span>{handle}</span></a></span>'
    )


def hashtag(name: str) -> str:
    return f'<a href="https://truthsocial.com/tags/{name}" class="mention hashtag" rel="tag">#<span>{name}</span></a>'


# ---------------------------------------------------------------------------
# Graphem-Zählung


@pytest.mark.parametrize(
    ("zeichenkette", "erwartet"),
    [
        ("\U0001f468\u200d\U0001f469\u200d\U0001f467\u200d\U0001f466", 1),  # Familie mit ZWJ
        ("\U0001f1e9\U0001f1ea\U0001f1fa\U0001f1f8", 2),  # Flaggen DE und US
        ("\U0001f44d\U0001f3fd", 1),  # Daumen mit Hautfarbe
        ("\U0001f3f3\ufe0f\u200d\U0001f308", 1),  # Regenbogenflagge (ZWJ-Sequenz mit Variationsselektor)
        ("e\u0301", 1),  # e + kombinierender Akut
        ("Cafe\u0301", 4),
        ("日本語テキスト", 7),
        ("\r\n", 1),
        ("", 0),
        ("abc", 3),
    ],
)
def test_zaehle_grapheme(zeichenkette, erwartet):
    assert zaehle_grapheme(zeichenkette) == erwartet


def test_emojis_im_html_zaehlen_als_ein_zeichen():
    familie = "\U0001f468\u200d\U0001f469\u200d\U0001f467\u200d\U0001f466"
    analyse = analysiere(f"<p>{MARKER} {familie}\U0001f1fa\U0001f1f8</p>")
    assert analyse.metriken.zeichen == len(MARKER) + 1 + 1 + 1


def test_numerische_entity_fuer_emoji():
    assert analysiere("<p>&#x1F600;&#128512;</p>").metriken.zeichen == 2


# ---------------------------------------------------------------------------
# Sichtbarer Text


def test_entities_werden_dekodiert():
    assert sichtbarer_text("<p>A &amp; B &#39;C&#39; &lt;b&gt; &quot;D&quot;</p>") == "A & B 'C' <b> \"D\""
    assert analysiere("<p>A &amp; B</p>").metriken.zeichen == 5


def test_nbsp_zaehlt_als_ein_zeichen_und_wird_am_rand_getrimmt():
    assert sichtbarer_text("<p>&nbsp;a&nbsp;b&nbsp;</p>") == "a\xa0b"
    assert analysiere("<p>&nbsp;a&nbsp;b&nbsp;</p>").metriken.zeichen == 3


def test_absaetze_sind_leerzeilen_und_br_zeilenumbrueche():
    assert sichtbarer_text("<p>a</p><p>b</p>") == "a\n\nb"
    assert sichtbarer_text("<p>a<br>b<br/>c<br />d</p>") == "a\nb\nc\nd"
    assert sichtbarer_text("<p>a<br><br>b</p>") == "a\n\nb"
    assert analysiere("<p>ab</p><p>cd<br>ef</p>").metriken.zeichen == len("ab\n\ncd\nef")


def test_leerraum_zwischen_absaetzen_und_leere_absaetze_zaehlen_nicht():
    assert sichtbarer_text("<p>a</p>\n<p></p><p> </p>\n<p>b</p>") == "a\n\nb"
    assert sichtbarer_text("<p>a<br></p><p>b</p>") == "a\n\nb"


def test_leerraum_am_zeilenrand_zaehlt_nicht_innen_schon():
    assert sichtbarer_text("<p>  a  b <br> c </p>") == "a  b\nc"


def test_ohne_absatz_und_text_vor_dem_ersten_absatz():
    assert sichtbarer_text("lose<p>im Absatz</p>danach") == "lose\n\nim Absatz\n\ndanach"
    assert sichtbarer_text("nur Text") == "nur Text"


def test_quote_fallback_wird_entfernt():
    absatz = '<p class="quote-inline">RE: <a href="https://truthsocial.com/@x/1">https://truthsocial.com/@x/1</a></p>'
    assert sichtbarer_text(f"<p>{MARKER}</p>{absatz}") == MARKER
    spanne = '<span class="quote-inline"><br/><br/>RE: <a href="https://truthsocial.com/@x/1">x</a></span>'
    assert sichtbarer_text(f"<p>{MARKER}{spanne}</p>") == MARKER
    analyse = analysiere(f"<p>{MARKER}</p>{absatz}")
    assert analyse.metriken.n_urls == 0
    assert analyse.metriken.link_domains == []


def test_unsichtbare_elemente_und_kommentare():
    assert sichtbarer_text("<p>a<script>var x = '<p>b</p>';</script><style>p{}</style><!-- c -->d</p>") == "ad"


def test_kaputtes_html_wirft_nicht():
    for html in ["<p>a", "</p>b</div>", "<p><a href='https://example.com'>x</p>y", "<![foo[ x ]]>z", "a < b", "<"]:
        sichtbarer_text(html)
        analysiere(html)
    assert sichtbarer_text("<p>a") == "a"
    assert sichtbarer_text("a < b") == "a < b"


@pytest.mark.parametrize("wert", [None, "", 5, b"<p>a</p>", ["<p>a</p>"], {"x": 1}])
def test_keine_zeichenkette_ergibt_leeren_text(wert):
    analyse = analysiere(wert)
    assert sichtbarer_text(wert) == ""
    assert analyse.metriken.zeichen == 0
    assert analyse.metriken.text_hash is None
    assert not analyse.hat_text


def test_nur_leerzeichen_und_nbsp_ist_leer():
    analyse = analysiere("<p> &nbsp; &nbsp;</p><p>\u3000</p>")
    assert analyse.metriken.zeichen == 0
    assert analyse.metriken.text_hash is None
    assert not analyse.hat_text and not analyse.hat_text_ohne_urls


# ---------------------------------------------------------------------------
# URLs


def test_url_mit_invisible_spannen_zaehlt_vollstaendig():
    url = "https://www.example.com/ein/ziemlich/langer/pfad?mit=parameter"
    analyse = analysiere(f"<p>{link(url)}</p>")
    assert sichtbarer_text(f"<p>{link(url)}</p>") == url
    assert analyse.metriken.zeichen == len(url)
    assert analyse.metriken.zeichen_ohne_urls == 0
    assert analyse.metriken.n_urls == 1
    assert analyse.hat_link_im_text and analyse.hat_text and not analyse.hat_text_ohne_urls


def test_zeichen_ohne_urls_fasst_leerzeichen_zusammen():
    html = f"<p>Hallo {link('https://example.com/a')} Welt {link('https://example.org/b')}</p>"
    analyse = analysiere(html)
    assert analyse.metriken.zeichen_ohne_urls == len("Hallo Welt")
    assert analyse.metriken.n_urls == 2


def test_zeichen_ohne_urls_ueber_absaetze():
    html = f"<p>{MARKER}</p><p>{link('https://example.com/a')}</p><p>Ende</p>"
    analyse = analysiere(html)
    assert analyse.metriken.zeichen == len(f"{MARKER}\n\nhttps://example.com/a\n\nEnde")
    assert analyse.metriken.zeichen_ohne_urls == len(f"{MARKER}\n\nEnde")


def test_nackte_url_ohne_link_element():
    analyse = analysiere("<p>siehe https://News.Example.org/x/(y). und http://www.beispiel.de)</p>")
    assert analyse.metriken.n_urls == 2
    assert analyse.metriken.link_domains == ["beispiel.de", "news.example.org"]
    # Satzzeichen und eine schließende Klammer ohne Gegenstück gehören nicht zur URL.
    assert analyse.metriken.zeichen_ohne_urls == len("siehe . und )")


def test_nackte_url_endet_vor_cjk_satzzeichen():
    m = analysiere("<p>見てhttps://example.com/a。次の文</p>").metriken
    assert m.n_urls == 1 and m.link_domains == ["example.com"]
    assert m.zeichen_ohne_urls == len("見て。次の文")


@pytest.mark.parametrize(
    "html",
    [
        "<p>Satz eins.  Satz zwei.</p>",
        "<p>a&nbsp;&nbsp;b</p>",
        '<p>a <img src="x" alt=":x:"> b</p>',
        "<p>a\tb\u3000\u3000c</p>",
        f"<p>{MARKER}</p><p> </p><p>b<br><br>c<br> <br>d</p>",
        f"<p>{MARKER} &amp;  {mention('x')}  {hashtag('a')}</p>",
    ],
)
def test_ohne_urls_gleich_viele_zeichen(html):
    """Leerraum wird nur dort zusammengefasst, wo eine URL wegfällt; ohne URLs sind beide Zählungen gleich."""
    m = analysiere(html).metriken
    assert m.n_urls == 0
    assert m.zeichen == m.zeichen_ohne_urls > 0


def test_leerraum_wird_nur_an_der_nahtstelle_eins():
    m = analysiere(f"<p>a  b {link('https://example.com/x')}  c  d</p>").metriken
    assert m.zeichen_ohne_urls == len("a  b c  d")
    html = f"<p>a{link('https://example.com/x')}b {link('https://example.org/y')} {link('https://e.example/')} c</p>"
    m = analysiere(html).metriken
    assert m.zeichen_ohne_urls == len("ab c") and m.n_urls == 3


def test_zeile_nur_aus_url_faellt_samt_umbruch_weg():
    url = link("https://example.com/x")
    assert analysiere(f"<p>A<br>{url}<br>B</p>").metriken.zeichen_ohne_urls == len("A\nB")
    assert analysiere(f"<p>A</p><p>{url}<br>B</p>").metriken.zeichen_ohne_urls == len("A\n\nB")
    assert analysiere(f"<p>A<br>{url}</p><p>B</p>").metriken.zeichen_ohne_urls == len("A\n\nB")
    assert analysiere(f"<p>{url}</p><p>B</p>").metriken.zeichen_ohne_urls == 1
    assert analysiere(f"<p>A<br>{url} {url}<br>B</p>").metriken.zeichen_ohne_urls == len("A\nB")
    # Im sichtbaren Text bleibt die Zeile mit der URL natürlich stehen.
    assert analysiere(f"<p>A<br>{url}<br>B</p>").metriken.zeichen == len("A\nhttps://example.com/x\nB")


def test_link_domains_normalisiert_sortiert_eindeutig():
    html = "<p>" + " ".join(
        link(u)
        for u in [
            "https://www.Zeitung.example/a",
            "https://zeitung.example/b",
            "https://NEWS.zeitung.example/c",
            "http://alpha.example:8080/d",
            "https://truthsocial.com/@jemand/123",
            "https://static-assets-1.truthsocial.com/x.png",
            "https://www.truthsocial.com/x",
        ]
    ) + "</p>"
    analyse = analysiere(html)
    assert analyse.metriken.link_domains == ["alpha.example", "news.zeitung.example", "zeitung.example"]
    assert analyse.metriken.n_urls == 7


def test_eigene_hosts_aus_dem_aufrufer():
    analyse = analysiere(f"<p>{link('http://127.0.0.1:8000/x')}</p>", eigene_hosts=("127.0.0.1", "truthsocial.com"))
    assert analyse.metriken.link_domains == []
    assert analyse.metriken.n_urls == 1


def test_ungueltige_hosts_werden_keine_domain():
    analyse = analysiere(
        '<p><a href="http://[::1">a</a> <a href="mailto:x@example.com">b</a> <a href="http://ex ample.com/">c</a></p>'
    )
    assert analyse.metriken.n_urls == 3
    assert analyse.metriken.link_domains == []


def test_einzelnes_wort_hinter_http_ist_keine_domain():
    analyse = analysiere("<p>Wir sehen uns auf http://Freiheit und http://localhost:8080/x</p>")
    assert analyse.metriken.n_urls == 2
    assert analyse.metriken.link_domains == []


@pytest.mark.parametrize(
    ("url", "domain"),
    [
        ("http://192.0.2.7/x", "192.0.2.7"),
        ("https://xn--mller-kva.example/", "xn--mller-kva.example"),
        ("https://müller.example/", "xn--mller-kva.example"),
        ("https://beispiel.xn--p1ai/", "beispiel.xn--p1ai"),
        ("https://a.b.c.example.co/", "a.b.c.example.co"),
        ("http://[2001:db8::1]/x", None),
        ("http://1.2.3/x", None),
        ("http://example.123/x", None),
        ("http://intranet/x", None),
        (f"https://{'a' * 63}.example/", f"{'a' * 63}.example"),
        (f"https://{'a' * 64}.example/", None),
        (f"https://{'.'.join(['abcdefghi'] * 26)}.example/", None),
    ],
)
def test_domain_braucht_tld_oder_ipv4(url, domain):
    m = analysiere(f"<p>{link(url)}</p>").metriken
    assert m.n_urls == 1
    assert m.link_domains == ([domain] if domain else [])


def test_link_auf_zitiertes_original_zaehlt_nicht():
    html = f'<p>{MARKER} <a href="{ORIGINAL}/">{ORIGINAL}</a></p>'
    analyse = analysiere(html, ausgeschlossene_links=[ORIGINAL])
    assert analyse.metriken.n_urls == 0
    assert analyse.metriken.zeichen == len(MARKER)
    ohne_ausschluss = analysiere(html)
    assert ohne_ausschluss.metriken.n_urls == 1


def test_nackte_url_auf_zitiertes_original_zaehlt_nicht():
    html = f"<p>Text {ORIGINAL}</p>"
    for ausschluss in ({"ausgeschlossene_links": [ORIGINAL]}, {"ausgeschlossene_ids": [ORIGINAL_ID]}):
        m = analysiere(html, **ausschluss).metriken
        assert (m.zeichen, m.zeichen_ohne_urls, m.n_urls) == (4, 4, 0), ausschluss
    assert analysiere(html).metriken.n_urls == 1


@pytest.mark.parametrize(
    "pfad",
    [
        f"/@jemand/{ORIGINAL_ID}",
        f"/@Jemand/{ORIGINAL_ID}/",
        f"/@jemand/posts/{ORIGINAL_ID}",
        f"/users/jemand/statuses/{ORIGINAL_ID}",
        f"/statuses/{ORIGINAL_ID}",
    ],
)
@pytest.mark.parametrize(
    "basis", ["https://truthsocial.com", "https://www.truthsocial.com", "http://truthsocial.com", ""]
)
def test_link_auf_zitiertes_original_ueber_die_id(pfad, basis):
    url = basis + pfad
    # Fallback-Absatz ohne die Klasse quote-inline: Der Link fällt weg, "RE:" bleibt Text.
    m = analysiere(f'<p>{MARKER}</p><p>RE: <a href="{url}">{url}</a></p>', ausgeschlossene_ids=[ORIGINAL_ID]).metriken
    assert (m.n_urls, m.zeichen) == (0, len(f"{MARKER}\n\nRE:"))
    htmls = [f'<p>{MARKER} <a href="{url}">{url}</a></p>']
    if basis:
        htmls.append(f"<p>{MARKER} {url}</p>")  # ein relativer Pfad wäre als nackter Text keine URL
    for html in htmls:
        m = analysiere(html, ausgeschlossene_ids=[ORIGINAL_ID]).metriken
        assert (m.n_urls, m.zeichen, m.zeichen_ohne_urls) == (0, len(MARKER), len(MARKER)), html


def test_id_ausschluss_nur_fuer_eigene_hosts_und_dieselbe_id():
    for url in (
        f"https://fern.example/@jemand/{ORIGINAL_ID}",
        "https://truthsocial.com/@jemand/114000000000000002",
        f"https://truthsocial.com/@jemand/{ORIGINAL_ID}/embed",
        f"https://truthsocial.com/@jemand/{ORIGINAL_ID}0",
    ):
        m = analysiere(f'<p>{MARKER} <a href="{url}">{url}</a></p>', ausgeschlossene_ids=[ORIGINAL_ID]).metriken
        assert m.n_urls == 1, url


def test_ausgeschlossener_link_mitten_im_satz():
    html = f'<p>a <a href="{ORIGINAL}">{ORIGINAL}</a> b</p>'
    m = analysiere(html, ausgeschlossene_ids=[ORIGINAL_ID]).metriken
    assert (m.zeichen, m.zeichen_ohne_urls, m.n_urls) == (3, 3, 0)
    # Eine Zeile, die nur aus dem Link bestand, fällt samt Umbruch weg.
    html = f'<p>A<br><a href="{ORIGINAL}">{ORIGINAL}</a><br>B</p>'
    assert analysiere(html, ausgeschlossene_ids=[ORIGINAL_ID]).metriken.zeichen == len("A\nB")


def test_ausgeschlossene_ids_mit_unerwarteten_werten():
    unerwartet = [None, 5, -1, 10**5000, "abc", "-99", True, "1" * 25, 1.5]
    m = analysiere(f'<p><a href="{ORIGINAL}">x</a></p>', ausgeschlossene_ids=unerwartet)
    assert m.metriken.n_urls == 1
    assert analysiere(f'<p><a href="{ORIGINAL}">x</a></p>', ausgeschlossene_ids=[int(ORIGINAL_ID)]).metriken.n_urls == 0


def test_link_auf_eigenen_post_ist_url_link_auf_profil_ist_mention():
    analyse = analysiere(
        '<p><a href="https://truthsocial.com/@jemand/123">a</a> <a href="https://truthsocial.com/@jemand">@jemand</a>'
        ' <a href="/tags/abc">#abc</a></p>'
    )
    assert analyse.metriken.n_urls == 1
    assert analyse.metriken.n_mentions == 1
    assert analyse.metriken.n_hashtags == 1
    assert analyse.metriken.link_domains == []


def test_link_ohne_ziel_oder_ohne_text():
    analyse = analysiere('<p><a>Text</a><a href="https://example.com/"></a></p>')
    assert analyse.metriken.n_urls == 0
    assert analyse.metriken.zeichen == 4


# ---------------------------------------------------------------------------
# Mentions und Hashtags


def test_mentions_und_hashtags_im_html():
    html = f"<p>{mention('eins')} {mention('zwei', 'https://andere.example')} {MARKER} {hashtag('Thema')}</p>"
    analyse = analysiere(html, mentions=[{"id": "1"}], tags=[])
    assert analyse.metriken.n_mentions == 2
    assert analyse.metriken.n_hashtags == 1
    assert analyse.metriken.n_urls == 0
    assert analyse.metriken.link_domains == []
    # Mentions und Hashtags sind Text, keine URLs.
    assert analyse.metriken.zeichen == analyse.metriken.zeichen_ohne_urls == len(f"@eins @zwei {MARKER} #Thema")


def test_fallback_auf_mentions_und_tags_liste():
    analyse = analysiere(
        f"<p>{MARKER}</p>",
        mentions=[{"id": "1", "acct": "a"}, {"id": "-99", "acct": "platzhalter"}, {"id": "2"}, "kaputt"],
        tags=[{"name": "a"}, {"name": "b"}, 7],
    )
    assert analyse.metriken.n_mentions == 2
    assert analyse.metriken.n_hashtags == 2


@pytest.mark.parametrize("liste", [None, "x", 5, {"id": "1"}])
def test_fallback_mit_unerwarteten_typen(liste):
    analyse = analysiere(f"<p>{MARKER}</p>", mentions=liste, tags=liste)
    assert analyse.metriken.n_mentions == 0
    assert analyse.metriken.n_hashtags == 0


def test_mentions_im_quote_fallback_zaehlen_nicht():
    html = f'<p>{MARKER}</p><p class="quote-inline">RE: {mention("x")}</p>'
    assert analysiere(html).metriken.n_mentions == 0


# ---------------------------------------------------------------------------
# Text-Hash


def test_text_hash_nfc_komponiert_und_zerlegt_gleich():
    komponiert = unicodedata.normalize("NFC", f"{MARKER} Café Müller")
    zerlegt = unicodedata.normalize("NFD", komponiert)
    assert komponiert != zerlegt
    assert text_hash(komponiert) == text_hash(zerlegt)
    assert analysiere(f"<p>{komponiert}</p>").metriken.text_hash == analysiere(f"<p>{zerlegt}</p>").metriken.text_hash


def test_text_hash_normalisiert_leerraum():
    erwartet = hashlib.sha256(f"{MARKER} a b c".encode()).hexdigest()
    varianten = [
        f"<p>{MARKER} a b c</p>",
        f"<p>{MARKER}  a\tb   c</p>",
        f"<p>{MARKER}</p><p>a<br>b</p><p>c</p>",
        f"<p>&nbsp;{MARKER}&nbsp;a&nbsp;b c </p>",
    ]
    for html in varianten:
        assert analysiere(html).metriken.text_hash == erwartet, html


def test_text_hash_unterscheidet_inhalt():
    assert text_hash(f"{MARKER} a") != text_hash(f"{MARKER} b")


@pytest.mark.parametrize("leer", ["", " ", "\n\n", "\xa0\u2003"])
def test_text_hash_leer_ist_none(leer):
    assert text_hash(leer) is None


def test_normalisiere_fuer_hash():
    assert normalisiere_fuer_hash("  a \n\n b\u00a0\u2003c ") == "a b c"
    assert normalisiere_fuer_hash("e\u0301") == "\u00e9"


# ---------------------------------------------------------------------------
# Kaputtes Unicode und K\u00fcrzen


def test_einzelne_surrogate_aus_json_werfen_nicht():
    """Ein abgeschnittenes Emoji-Escape (\\ud83d) im JSON ergibt ein einzelnes Surrogat; UTF-8 kann es nicht."""
    html = json.loads(f'"<p>{MARKER} Text \\ud83d abgeschnitten</p>"')
    analyse = analysiere(html)
    assert analyse.metriken.zeichen == len(f"{MARKER} Text \ufffd abgeschnitten")
    assert analyse.metriken.text_hash == text_hash(f"{MARKER} Text \ufffd abgeschnitten") is not None
    assert sichtbarer_text(html) == f"{MARKER} Text \ufffd abgeschnitten"
    assert text_hash("a\ud83d") == text_hash("a\ufffd")
    assert normalisiere_fuer_hash("\udc00") == "\ufffd"


def test_bereinige_unicode():
    assert bereinige_unicode("a\ud83d") == "a\ufffd"
    assert bereinige_unicode("\ude00x\ud83d") == "\ufffdx\ufffd"
    assert bereinige_unicode("\ud83d\ude00") == "\U0001f600"  # getrenntes Paar wird ein Zeichen
    assert bereinige_unicode(f"{MARKER} \U0001f600") == f"{MARKER} \U0001f600"


def test_kuerze_zerschneidet_keine_grapheme():
    familie = "\U0001f468\u200d\U0001f469\u200d\U0001f467"  # 5 Codepunkte, 1 Graphem
    assert kuerze("ab" + familie, 4) == "ab"
    assert kuerze("ab" + familie, 7) == "ab" + familie
    assert kuerze("e\u0301e\u0301", 3) == "e\u0301"
    assert kuerze("abc", 3) == "abc"
    assert kuerze("", 0) == ""


# ---------------------------------------------------------------------------
# Datenschutz


def test_analyse_enthaelt_keinen_inhalt():
    html = (
        f"<p>{MARKER} {mention('jemand')} {hashtag('Thema')} {link('https://example.com/' + MARKER)}</p>"
        f'<p class="quote-inline">RE: {MARKER}</p>'
    )
    analyse = analysiere(html, mentions=[{"id": "1", "acct": MARKER}], tags=[{"name": MARKER}])
    werte = dataclasses.asdict(analyse)
    assert MARKER not in repr(werte)
    assert MARKER.lower() not in repr(werte).lower()
    assert analyse.metriken.link_domains == ["example.com"]


@pytest.mark.parametrize(
    "html",
    [
        f"<p>http://{MARKER}</p>",
        f"<p>http://{MARKER.lower()}/pfad und https://{MARKER}:8080</p>",
        f'<p><a href="http://{MARKER}">{MARKER}</a></p>',
        f'<p><a href="https://example.com/{MARKER}">x</a> https://truthsocial.com/{MARKER}</p>',
    ],
)
def test_wort_ohne_punkt_hinter_http_landet_nirgends(html):
    """Kein Leerzeichen trennt den Marker hier ab: Er darf weder als Domain noch sonst herauskommen."""
    werte = repr(dataclasses.asdict(analysiere(html))).lower()
    assert MARKER.lower() not in werte


def test_parserfehler_geben_keinen_inhalt_preis(monkeypatch):
    """Wirft der HTML-Parser (ältere Python-Versionen), gibt es einen Ersatzweg statt einer Ausnahme."""

    def wirft(self, daten):
        raise AssertionError(f"unbekannte Deklaration in {daten}")

    monkeypatch.setattr(text._Zerleger, "feed", wirft)
    analyse = analysiere(f"<p>{MARKER} &amp; mehr</p>")
    assert analyse.metriken.zeichen == len(f"{MARKER} & mehr")
