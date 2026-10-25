# The Collective · 3D-website: overdracht

Stand: 25 oktober 2026. Dit pakket bevat alles om verder te gaan met het 3D-model, de website en de verhaallijn, ook in een ander Claude-account.

## Snel bekijken

De website staat online op https://maartenleon.github.io/the-collective-3d/ (de hoofd-URL, zonder tussenpagina). Scroll, swipe of gebruik de pijltjestoetsen. Het oude adres `site/3d.html` stuurt door naar de hoofd-URL.

Lokaal bekijken kan alleen via een kleine webserver, niet door `index.html` te dubbelklikken: de muzikanten en het publiek staan in aparte bestanden (`site/orchestra.glb` en `site/audience.glb`) en een browser laadt die niet vanaf een losse schijf. Zo start je een server: open Terminal, typ `cd ~/Downloads && python3 -m http.server 8099` en ga naar http://127.0.0.1:8099/the-collective-3d/. De site heeft internet nodig voor three.js.

`site/orkest-model.html` is alleen het 3D-model, waarin je vrij kunt rondkijken en onderdelen los kunt bekijken. De website linkt er niet naar; het adres is https://maartenleon.github.io/the-collective-3d/site/orkest-model.html.

## Verder werken met Claude

1. Maak in het nieuwe Claude-account een project (of een Claude Code-sessie) en upload deze hele map, of zet hem in een GitHub-repository en koppel die.
2. Zeg tegen Claude: "Lees eerst CLAUDE.md." Daarin staan de context, de afspraken, hoe je bouwt en test, en wat nog open staat.
3. Na een wijziging bouwt Claude de site opnieuw met `python3 bron/build.py` (maakt `index.html`) en het model met `python3 bron/build.py model`.
4. Veranderen de mensen zelf (houdingen, kleding, kleuren, gezichten of de zitplaatsen), dan moeten ze eerst opnieuw gebakken worden: `python3 bron/bake/bake.py`. Dat bouwt alle muzikanten en het publiek één keer in Chrome en schrijft `bron/assets/baked/orchestra.glb` en `audience.glb`; daarna gewoon opnieuw bouwen.

## Wat zit erin

| Map of bestand | Wat |
| --- | --- |
| `CLAUDE.md` | Startinstructie voor Claude (Engels): context, besluiten, werkwijze, bestanden, bouwen en testen |
| `index.html` | De gebouwde website (de hoofd-URL) |
| `site/` | De stylesheet, icoontjes en mensen (`orchestra.glb`, `audience.glb`) van de website, het losse 3D-model en een doorverwijzing van het oude adres `site/3d.html` |
| `bron/` | De broncode en de muzikanten (Microsoft Rocketbox, MIT-licentie), plus testscripts |
| `docs/verhaallijn-v3.md` | De volledige verhaallijn zoals hij nu op de site staat |
| `docs/aanpassingen-na-de-scan.md` | Wat er na de scan is aangepast en wat nog open staat |
| `docs/scan-3d-site-suggesties.md` | De scan met alle suggesties en codes (V1, T1 enzovoort) |
| `docs/deel4-the-collective.md` | De goedgekeurde tekst van deel 4 |
| `docs/modellen-kopen.md` | Onderzoek naar betaalde muzikanten en instrumenten, met licentie-aandachtspunten |
| `docs/blueprint-concept.md` | Het oorspronkelijke concept voor de 3D-scène |
| `docs/inputs/` | Kai's Art Direction v3 en "Plannen - The Collective" |
| `docs/claude-geheugen/` | De notities die de vorige Claude bijhield (besluiten, versies, tekstkeuzes) |
| `beelden/` | Recente schermafbeeldingen ter referentie |

## Belangrijkste open punten

1. Klantcitaat en één resultaat met een getal in deel 4.
2. Definitief e-mailadres (nu soundcheck@thecollective.nu) en waar "Let's talk" heen gaat.
3. Snelheid: de mensen worden vooraf gebakken (`site/orchestra.glb`, `site/audience.glb`), de schaduw wordt alleen bijgewerkt als er iets verandert, en de site start zodra het orkest er is; zie `docs/perf.md`. Nog open: minder draw calls (fase 4).
4. Tekst op het programmabord in frame 4 kiezen.
5. Telefoon: overlappende sectienamen bij Means, en de probleemlijst in frame 10 over het podium.
6. De 8 probleemkaarten zijn nog tijdelijke tekst; de routes na frame 10 staan in de wacht.

## Let op

- Koop je later betaalde modellen: mail de verkoper vooraf, en zet gekochte bronbestanden nooit in een openbare GitHub-repository. Publiceer alleen de gebouwde versie.
- De links naar Claude-documenten en de online site in het oude account werken niet voor een ander account. Alle inhoud staat daarom ook als bestand in dit pakket.
