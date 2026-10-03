import json

import pytest

from truthtracker import cloudflare as cf


def test_json_200_mit_challenge_woertern_im_inhalt_ist_ok():
    # Ein Post darf "Just a moment" enthalten, ohne dass das als Cloudflare zählt.
    body = json.dumps([{"content": "<p>Just a moment, checking your browser cdn-cgi/challenge-platform</p>"}])
    assert cf.bewerte(200, {"content-type": "application/json"}, body).art == cf.OK


def test_cf_mitigated_header_ist_challenge():
    assert cf.bewerte(403, {"cf-mitigated": "challenge"}, b"<html></html>").art == cf.CHALLENGE


def test_challenge_seite_ohne_header():
    html = b"<html><head><title>Just a moment...</title></head><script src='/cdn-cgi/challenge-platform/x'></script>"
    assert cf.bewerte(503, {}, html).art == cf.CHALLENGE


def test_404_mit_json_fehler_ist_eindeutig_nicht_gefunden():
    bew = cf.bewerte(404, {"content-type": "application/json"}, b'{"error":"Record not found"}')
    assert bew.art == cf.NICHT_GEFUNDEN


def test_404_als_html_ist_nicht_eindeutig():
    assert cf.bewerte(404, {}, b"<html>Not found</html>").art == cf.UNERWARTET


def test_404_json_ohne_error_feld_ist_nicht_eindeutig():
    assert cf.bewerte(404, {}, b"{}").art == cf.UNERWARTET


def test_429_ist_ratelimit_mit_retry_after():
    bew = cf.bewerte(429, {"Retry-After": "120"}, b'{"error":"Too many requests"}')
    assert bew.art == cf.RATELIMIT and bew.abbruch and bew.hinweis == "120"


def test_geoblock_als_html_und_als_json():
    assert cf.bewerte(403, {}, b"<html>Truth Social is unavailable in your area.</html>").art == cf.GEOBLOCK
    assert cf.bewerte(403, {}, b'{"error":"Truth Social is unavailable in your area."}').art == cf.GEOBLOCK


def test_cloudflare_block():
    html = b"<html><title>Attention Required! | Cloudflare</title>Sorry, you have been blocked</html>"
    assert cf.bewerte(403, {}, html).art == cf.BLOCKIERT


def test_403_json_ohne_merkmale_ist_verweigert():
    bew = cf.bewerte(403, {}, b'{"error":"This method requires an authenticated user"}')
    assert bew.art == cf.VERWEIGERT and bew.abbruch


def test_5xx_und_netzwerk():
    assert cf.bewerte(502, {}, b"<html>bad gateway</html>").art == cf.SERVERFEHLER
    assert cf.bewerte(None, {}, None).art == cf.NETZWERKFEHLER
    assert not cf.bewerte(502, {}, b"").abbruch


def test_kopfzeilen_mehrfachwerte():
    class Mehrfach:
        def multi_items(self):
            return [("Set-Cookie", "a=1"), ("set-cookie", "b=2"), ("X-Test", "y")]

    h = cf.kopfzeilen(Mehrfach())
    assert h["set-cookie"] == "a=1, b=2" and h["x-test"] == "y"


def test_melde_ist_deutsch_und_nennt_status_einmal():
    satz = cf.melde(cf.Bewertung(cf.RATELIMIT, 429, hinweis="60"))
    assert satz == "Zu viele Anfragen (HTTP 429). Der Server bittet um 60 s Pause."
    assert cf.melde(cf.Bewertung(cf.VERWEIGERT, 403)).count("403") == 1
    assert cf.melde(cf.Bewertung(cf.CHALLENGE, None)) == "Cloudflare verlangt eine Browser-Prüfung (Challenge)."


@pytest.mark.parametrize("code", ["1005", "1006", "1007", "1008", "1009", "1010", "1012", "1020"])
def test_cloudflare_klartextsperren_sind_blockiert(code):
    assert cf.bewerte(403, {"content-type": "text/plain"}, f"error code: {code}".encode()).art == cf.BLOCKIERT


def test_rate_limit_seite_1015_ist_ratelimit():
    html = b"<html><title>Access denied | truthsocial.com used Cloudflare to restrict access</title>Error 1015</html>"
    assert cf.bewerte(403, {}, html).art == cf.RATELIMIT


def test_401_ist_login_noetig_und_kein_abbruch():
    bew = cf.bewerte(401, {}, b'{"error":"This method requires an authenticated user"}')
    assert bew.art == cf.LOGIN_NOETIG and not bew.abbruch
    assert cf.bewerte(401, {}, b"<html>Unauthorized</html>").art == cf.LOGIN_NOETIG


def test_cloudflare_1015_ist_ratelimit():
    html = b"<html><title>Access denied | truthsocial.com used Cloudflare to restrict access</title>Error 1015</html>"
    assert cf.bewerte(429, {}, html).art == cf.RATELIMIT
    assert cf.bewerte(403, {}, html).art == cf.RATELIMIT
