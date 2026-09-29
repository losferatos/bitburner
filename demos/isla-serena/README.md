# Isla Serena

Echtzeit-Grafikdemo im Browser: Ein Sportwagen fährt über die Küstenstraße einer
prozedural erzeugten Mittelmeerinsel, während der Tag vom späten Nachmittag über
Sonnenuntergang und blaue Stunde in die Nacht übergeht.

**Starten:** `dist/isla-serena.html` im Browser öffnen (Chrome/Edge/Firefox mit WebGL 2).
Die Datei ist komplett eigenständig (≈6 MB, kein Server, keine Downloads).

## Was drinsteckt

- **Insel** – 4 × 4 km Heightmap (2048², 2 m Raster), auf der GPU aus Simplex-/Ridged-Rauschen
  erzeugt; Steilküste im Norden, Strände im Süden. Terrain-Chunks mit 4 LOD-Stufen,
  Höhe per `texelFetch` im Vertex-Shader, triplanare Felsen, prozedurale Gras-/Sand-/Macchia-Texturierung.
- **Küstenstraße** – 8,2 km geschlossene Catmull-Rom-Spline mit geglättetem Höhenprofil,
  Querneigung in Kurven, eingeschnittenen Böschungen, Markierungen, Leitplanken, Laternen
  (Lichtkegel analytisch im Straßen-Shader).
- **Himmel** – physikalische Rayleigh/Mie-Streuung (Cubemap, nur bei Sonnenbewegung neu),
  Umgebungslicht per PMREM, Wolkenschicht mit Selbstschattierung und Silberrand,
  Sterne, Milchstraße, Mond; Höhennebel mit sonnenabhängiger Farbe in allen Materialien.
- **Ozean** – Gerstner-Wellen, Detail-Normalen, Himmels- und Wolkenreflexion,
  Sonnenglitzern, Tiefenfarbe aus der Heightmap, Brandung und Schaumkronen.
- **Vegetation** – Schirmpinien, Zypressenalleen, Olivenbäume, Macchia, Felsen;
  Nahbereich mit Laub-/Nadelkarten (Alpha-Test, Schatten), Fernbereich als Low-Poly,
  Windbewegung und durchscheinendes Laub im Gegenlicht. GPU-Gras (bis 200 000 Halme).
- **Orte** – zwei weiße Küstendörfer mit Fensterläden und nachts beleuchteten Fenstern,
  Leuchtturm mit rotierendem Lichtkegel, Möwenschwärme.
- **Auto** – Ferrari-458-Modell mit Klarlack-Material, Fahrdynamik entlang der Spline
  (Kurvengeschwindigkeit, Wanken/Nicken, Lenkeinschlag, Raddrehung), Scheinwerfer mit
  Lichtkegeln, Bremslichter, synthetischer V8-Sound (WebAudio).
- **Regie** – acht Kameraeinstellungen mit automatischem Schnitt (Verfolgung, Straßenrand
  mit Tele, Front, Drohne, Seitenfahrt, Radkamera, Panorama, Heck); weicht Bäumen aus.
- **Nachbearbeitung** – Tiefenunschärfe, Bewegungsunschärfe (Auto bleibt scharf),
  Lichtstrahlen und Linsenreflexe, Bloom, ACES-Tonemapping, SMAA, Vignette, Körnung,
  optionale 2,35:1-Balken. Adaptive Auflösung hält die Bildrate über 30 fps.

## Bedienung

| Taste | Funktion |
|---|---|
| C / → / ← | Kamera wechseln |
| Maus ziehen, Mausrad | freie Kamera |
| A | automatische Regie an/aus |
| N | nächste Stimmung (Morgen, Mittag, Goldene Stunde, Sonnenuntergang, Blaue Stunde, Nacht) |
| T, + / − | Zeit anhalten, ±30 Minuten |
| P | Lackfarbe |
| L | Kino-Balken |
| 1 / 2 / 3 | Qualität niedrig / mittel / hoch |
| M, F, H | Ton, Vollbild, Anzeige aus |
| Leertaste | Pause |

URL-Parameter für Tests: `?q=3` (Qualität), `?t=18.2` (Uhrzeit), `?cam=1` (feste Kamera),
`?debug` (Drawcalls/Dreiecke), `?fixed` (keine adaptive Auflösung).

## Bauen

```sh
npm install
npm run build        # -> dist/isla-serena.html
npm run shot -- out.png "t=17.5&cam=0&still" 2 1280 720   # Headless-Screenshot (SwiftShader)
```

## Quellen

- Automodell: „Ferrari 458 Italia“ aus den three.js-Beispielen (Modell von vicent091036, CC BY 4.0),
  Kontaktschatten-Textur ebenfalls aus den three.js-Beispielen.
- Wasser-Normalen: `waternormals.jpg` aus den three.js-Beispielen.
- Himmelsstreuung nach *glsl-atmosphere* (Rye Terrell), Simplex-Rauschen nach Ashima Arts/Stefan Gustavson.
- Alles andere (Gelände, Vegetation, Texturen, Sound) wird zur Laufzeit prozedural erzeugt.
