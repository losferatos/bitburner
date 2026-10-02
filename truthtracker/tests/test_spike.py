import json
from datetime import timedelta

import pytest

from conftest import browser_argumente_fuer_tests, chromium_pfad, finde_marker
from fabrik import JETZT, MARKER, karte, konto, medium, retruth, status
from fake_truthsocial import FakeTruthSocial, Zustand
from truthtracker import pfade, spike


def _zustand_mit_posts(anzahl: int = 100) -> Zustand:
    z = Zustand()
    fremd = konto("108000000000000001", "jemand", "Jemand Anders", verifiziert=False, follower=1234)
    posts = []
    for i in range(anzahl):
        zeit = JETZT - timedelta(hours=2 * i)
        if i % 5 == 1:
            posts.append(retruth(zeit, status(zeit - timedelta(hours=3), autor=fremd)))
        elif i % 7 == 2:
            posts.append(status(zeit, medien=[medium("image")]))
        elif i % 11 == 3:
            posts.append(status(zeit, karte_=karte()))
        else:
            posts.append(status(zeit))
    posts.append(status(JETZT - timedelta(days=60), gepinnt=True))
    z.setze_posts(posts)
    return z


def _einstellungen(url, **extra):
    werte = dict(basis_url=url, pause_min=0, pause_max=0, seiten=3, limit=40)
    werte.update(extra)
    return spike.Einstellungen(**werte)


def test_weg_a_funktioniert_und_bericht_ohne_inhalte(eigene_laufzeit):
    with FakeTruthSocial(_zustand_mit_posts()) as fake:
        daten = spike.fuehre_aus(_einstellungen(fake.url, wege=("a",)))
        anfragen = list(fake.zustand.anfragen)
    a = daten["wege"]["a"]
    assert a["ergebnis"] == "funktioniert"
    assert daten["fazit"]["empfehlung"] == "a"
    # lookup + 3 Seiten + gepinnt + einzelpost + Replies-Probe + 404-Probe + Vorschaubild
    assert a["anfragen"] == 9 == len(anfragen)
    assert a["probe_mit_replies"] == {"art": "login_noetig", "status": 401}
    timeline = [x for x in anfragen if x["pfad"].endswith("/statuses") and "max_id" not in x["params"]]
    assert timeline[0]["params"]["exclude_replies"] == "true"
    seiten = a["timeline"]
    # Seite 1 mit gepinntem Post oben; derselbe Post steht zusätzlich an seiner zeitlichen Stelle (Seite 3).
    assert [s["anzahl"] for s in seiten] == [41, 40, 21]
    assert seiten[0]["gepinnt_positionen"] == [0]
    assert seiten[2]["gepinnt_positionen"] == [20]
    assert seiten[1]["ueberlappung_mit_vorseite"] == 0
    assert seiten[0]["link_next_gleich_kleinster_id"] is True
    assert a["nicht_gefunden_probe"] == {
        "status": 404, "art": "nicht_gefunden", "json_schluessel": ["error"], "error_text": "Record not found"
    }
    assert a["medien_vorschau"]["art"] == "ok" and a["medien_vorschau"]["content_type"] == "image/png"
    assert a["gepinnt"] == {"anzahl": 1, "auch_in_timeline": 1}
    felder = daten["fazit"]["felder_vorhanden"]
    assert felder["reblog"] and felder["quote_id"] and felder["edited_at"]
    # Weder JSON- noch Markdown-Bericht enthalten Inhalte oder Medienpfade.
    ausgabe = pfade.docs_ordner() / "zugriff-messungen"
    assert finde_marker(ausgabe) == []
    for datei in ausgabe.iterdir():
        text = datei.read_text(encoding="utf-8")
        assert "/media/" not in text and "example.com" not in text
    assert len(list(ausgabe.glob("messung-*.md"))) == 1


def test_weg_a_bricht_bei_challenge_sofort_ab(eigene_laufzeit):
    z = _zustand_mit_posts(10)
    z.challenge_ohne_cookie = True
    with FakeTruthSocial(z) as fake:
        daten = spike.fuehre_aus(_einstellungen(fake.url, wege=("a",)))
        assert len(fake.zustand.anfragen) == 1
    a = daten["wege"]["a"]
    assert a["ergebnis"] == "abgebrochen"
    assert a["abbruch"]["art"] == "challenge" and a["abbruch"]["schritt"] == "konto_lookup"
    assert daten["fazit"]["empfehlung"] == "keiner"
    assert list((pfade.docs_ordner() / "zugriff-messungen").glob("*.json"))


def test_weg_a_bricht_bei_429_ab_und_behaelt_bisheriges(eigene_laufzeit):
    z = _zustand_mit_posts(100)
    z.ratelimit_ab = 3  # die dritte API-Anfrage bekommt 429; Lookup und erste Seite gehen durch
    with FakeTruthSocial(z) as fake:
        daten = spike.fuehre_aus(_einstellungen(fake.url, wege=("a",)))
        assert len(fake.zustand.api_anfragen()) == 3
    a = daten["wege"]["a"]
    assert a["ergebnis"] == "abgebrochen" and a["abbruch"]["art"] == "ratelimit"
    assert "status" in daten["feldkataloge"]  # erste Seite wurde erfasst
    assert daten["feldkataloge"]["status"]["objekte"] == 41


def test_weg_a_geoblock(eigene_laufzeit):
    z = _zustand_mit_posts(5)
    z.geoblock = True
    with FakeTruthSocial(z) as fake:
        daten = spike.fuehre_aus(_einstellungen(fake.url, wege=("a",)))
    assert daten["wege"]["a"]["abbruch"]["art"] == "geoblock"


def test_weg_a_netzwerkfehler(eigene_laufzeit):
    z = _zustand_mit_posts(5)
    z.abbruch_pfade = [r"/statuses$"]
    with FakeTruthSocial(z) as fake:
        daten = spike.fuehre_aus(_einstellungen(fake.url, wege=("a",)))
    assert daten["wege"]["a"]["abbruch"]["art"] == "netzwerkfehler"


def test_garantiert_fehlende_id_liegt_vor_dem_start_von_truth_social():
    # Snowflake von 2020-01-01: kleiner als jede echte ID (die erste ist von 2022).
    assert int(spike.GARANTIERT_FEHLENDE_ID) < int("107780257626128497")


def test_pfad_vorlage_ersetzt_ids_und_entfernt_werte():
    assert spike.pfad_vorlage("https://x/api/v1/accounts/123/statuses?max_id=99&limit=40") == (
        "/api/v1/accounts/{id}/statuses?limit&max_id"
    )


def test_kopf_auszug_ohne_cookie_werte():
    auszug = spike.kopf_auszug({"set-cookie": "__cf_bm=GEHEIM; path=/, _cfuvid=AUCHGEHEIM; path=/", "cf-ray": "1"})
    assert auszug["set-cookie_namen"] == ["__cf_bm", "_cfuvid"]
    assert "GEHEIM" not in json.dumps(auszug)


@pytest.mark.browser
@pytest.mark.parametrize("mit_challenge", [False, True])
def test_weg_b_mit_echtem_chromium(eigene_laufzeit, mit_challenge):
    exe = chromium_pfad()
    if exe is None:
        pytest.skip("kein Chromium vorhanden")
    z = _zustand_mit_posts(60)
    z.challenge_ohne_cookie = mit_challenge
    z.challenge_verzoegerung_ms = 4000  # lange genug, dass die Prüfung sichtbar ist
    with FakeTruthSocial(z) as fake:
        daten = spike.fuehre_aus(
            _einstellungen(
                fake.url, wege=("b",), browser=str(exe), headless=True,
                browser_argumente=tuple(browser_argumente_fuer_tests()), warte_challenge_s=30, warte_webapp_s=20,
            )
        )
    b = daten["wege"]["b"]
    assert b["ergebnis"] == "funktioniert", json.dumps(b, indent=1)
    assert b["b1_passiv"] == "funktioniert"
    assert b["challenge"]["gesehen"] is mit_challenge
    if mit_challenge:
        assert b["challenge"]["geloest"] is True
    assert "/api/v1/accounts/{id}/statuses?exclude_replies&with_muted" in b["webapp_endpunkte"]
    assert b["b2_nicht_gefunden_probe"]["art"] == "nicht_gefunden"
    assert b["html_time_elemente"] >= 1
    assert "status_webapp" in daten["feldkataloge"]
    # Profil: nur noch Cookies und Einstellungen, kein Cache, und der Cache-Ordner ist weg.
    profil = pfade.profil_ordner()
    uebrig = sorted(p.relative_to(profil).as_posix() for p in profil.rglob("*") if p.is_file())
    erlaubt = {"Cookies", "Cookies-journal", "Local State", "Preferences", "Secure Preferences", "First Run",
               "Last Version", "Last Browser"}
    assert all(p.split("/")[-1] in erlaubt for p in uebrig), uebrig
    assert daten["aufraeumen"]["browser_cache_ordner_geloescht"] is True
    assert not any(pfade.temp_ordner().glob("browser-cache-*"))
    assert finde_marker(pfade.laufzeit(), pfade.docs_ordner()) == []
    if mit_challenge:
        # Die gelöste Prüfung bleibt als Cookie im Profil erhalten.
        assert any(p.endswith("Cookies") for p in uebrig)


def test_main_rueckgabecode(eigene_laufzeit):
    z = _zustand_mit_posts(10)
    z.challenge_ohne_cookie = True
    with FakeTruthSocial(z) as fake:
        code = spike.main(["--basis-url", fake.url, "--nur", "a", "--pause-min", "0", "--pause-max", "0"])
    assert code == 2


def test_marker_ist_in_fixtures():
    assert MARKER in status(JETZT)["content"]
