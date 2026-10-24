# The Collective · 3D-website: overdracht

Stand: 21 oktober 2026. Dit pakket bevat alles om verder te gaan met het 3D-model, de website en de verhaallijn, ook in een ander Claude-account.

## Snel bekijken

Open `site/3d.html` in Chrome, Edge of Safari. Dat is de website zoals hij nu is (versie 10): scroll, swipe of gebruik de pijltjestoetsen. Het bestand is ongeveer 14 MB en heeft internet nodig voor three.js.

`site/orkest-model.html` is alleen het 3D-model, waarin je vrij kunt rondkijken en onderdelen los kunt bekijken.

## Verder werken met Claude

1. Maak in het nieuwe Claude-account een project (of een Claude Code-sessie) en upload deze hele map, of zet hem in een GitHub-repository en koppel die.
2. Zeg tegen Claude: "Lees eerst CLAUDE.md." Daarin staan de context, de afspraken, hoe je bouwt en test, en wat nog open staat.
3. Na een wijziging bouwt Claude de site opnieuw met `python3 bron/build.py`.

## Wat zit erin

| Map of bestand | Wat |
| --- | --- |
| `CLAUDE.md` | Startinstructie voor Claude (Engels): context, besluiten, werkwijze, bestanden, bouwen en testen |
| `site/` | De gebouwde website en het losse 3D-model |
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
3. Kleiner bestand (nu 14 MB) door de modellen te comprimeren.
4. Tekst op het programmabord in frame 4 kiezen.
5. Telefoon: overlappende sectienamen bij Means, en de probleemlijst in frame 10 over het podium.
6. De 8 probleemkaarten zijn nog tijdelijke tekst; de routes na frame 10 staan in de wacht.

## Let op

- Koop je later betaalde modellen: mail de verkoper vooraf, en zet gekochte bronbestanden nooit in een openbare GitHub-repository. Publiceer alleen de gebouwde versie.
- De links naar Claude-documenten en de online site in het oude account werken niet voor een ander account. Alle inhoud staat daarom ook als bestand in dit pakket.
