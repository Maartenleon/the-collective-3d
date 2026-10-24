# Orkest in 3D: aanpak en blueprint (concept v2)

Status: concept om samen te bespreken. De getekende versie (boven- en vooraanzichten RUN en CHANGE) staat in `blueprint.html`, gepubliceerd op https://claude.ai/artifact/BGANN9vp9AC9xGvFNabLnC en gegenereerd met `blueprint-tekeningen.py`. Alleen een ruwe stijlproef is gebouwd (`stijlproef-v0.html`), de echte scène nog niet.

## 0. Uitgangspunten (besloten met Kai, 16-10-2026)

- **Het 3D-model is de basis, het verhaal komt later.** Het model moet elk verhaal kunnen vertellen. Daarom moet elk onderdeel los aan te spreken zijn: tonen, verbergen, uitlichten, inzoomen.
- **Twee dimensies van het framework:** RUN / VANDAAG (het concert) en CHANGE / MORGEN (de repetitie voor de symfonie van volgend jaar). Beide worden in deze blueprint ontworpen; RUN bouwen we eerst.
- **Alles in code (three.js), geen Blender.** Eerst alleen gratis of zelfgemaakte modellen. Lopen we vast, dan bespreken we de betaalde opties.
- **Compositie en aanzicht** zoals het huidige beeld (`world.jpg`): podium met gebogen wand in glooiende heuvels. **Stijl, kleuren en licht** komen uit de art direction (v3, oktober 2026): aarde #5C2414, schaduw #1A0E0A, graan #A9824F, lucht #8A9CB0, podium #F6F2EC, alleen de dirigent #D9452B. Geen verzadigd blauw of groen, lichtend podium, diepe schaduw, laag strijklicht.
- **Samengevoegd beeld (akkoord Kai, 16-10-2026):** gebogen achterwand blijft (in podiumkleur); heuvels rondom in de vorm van het huidige beeld maar in aardetinten; orkest van 40 tot 50 muzikanten, klein in beeld met veel ruimte; laag goudlicht met diepe schaduwen; strook graan op de voorgrond.
- Mobiel krijgt een lichtere versie. Hosting blijft GitHub Pages met vanilla three.js.

## 1. Isoleren: wat het model moet kunnen

Elk onderstaand element is een eigen *group* met een vaste naam, zodat het verhaal ernaar kan verwijzen:

| Wat Kai wil kunnen | Hoe het model dat mogelijk maakt |
|---|---|
| Een groep muzikanten inzoomen en isoleren | Elke sectie (bijv. Eerste violen) is een eigen group; de rest vervaagt |
| De bladmuziek per muzikant isoleren | Lessenaars zijn een **eigen hoofdgroep**, los van muzikanten en dirigent; elke lessenaar weet bij wie hij hoort |
| De dirigent isoleren | Dirigent is een eigen hoofdgroep (met eigen lessenaar in de lessenaar-groep) |
| Laten zien wat er gespeeld wordt | Een **Bord** als eigen hoofdgroep, met tekst die we per hoofdstuk kunnen wisselen |
| Rond het concert draaien | Echte 3D-scène met vrije camera plus vaste camerastandpunten per onderdeel |

"Isoleren" betekent concreet: de rest wordt bijna doorzichtig of donkerder, de camera beweegt naar het gekozen deel, eventueel een licht erop. Zie de stijlproef.

## 2. Hiërarchie (groups > objects > sub-objects > geometries > materials)

```
Scene
├── Wereld: RUN / VANDAAG (group)
│   ├── Omgeving (group)       Lucht, Heuvels, Licht
│   ├── Podium (group)         Vloer, Treden, Achterwand, Dirigentenbok
│   ├── Orkest (group)
│   │   ├── Strijkers (group)
│   │   │   ├── Eerste violen (group) → Muzikant ×N
│   │   │   ├── Tweede violen (group) → Muzikant ×N
│   │   │   ├── Altviolen (group)     → Muzikant ×N
│   │   │   ├── Cello's (group)       → Muzikant ×N
│   │   │   └── Contrabassen (group)  → Muzikant ×N
│   │   ├── Houtblazers (group)
│   │   ├── Koperblazers (group)
│   │   ├── Slagwerk (group)
│   │   └── Harp / Piano (group)
│   ├── Dirigent (group)       eigen hoofdgroep, los te isoleren
│   ├── Lessenaars (group)     eigen hoofdgroep
│   │   ├── Lessenaar dirigent (partituur: alle partijen)
│   │   └── Lessenaar per muzikant (eigen partij) ×N
│   ├── Bord (group)           "wat er gespeeld wordt", tekst wisselbaar
│   └── Verhaal-hulpmiddelen (group)  hotspots, labels, geluidsgolven
│
└── Wereld: CHANGE / MORGEN (group)   ontwerp volgt, zie §4

Muzikant (herbruikbaar object)
├── Stoel          geometries: boxen, cilinders     material: zwart
├── Lichaam        capsules, bol                    material: pak (kleur uit art direction), huid
└── Instrument     per type uit eenvoudige vormen    material: hout / messing / koper

Lessenaar (herbruikbaar object)
├── Paal + voet    cilinders                         material: zwart
├── Plank          box                               material: zwart
└── Bladmuziek     vlak met getekende noten          material: papier; inhoud per partij wisselbaar
```

Elk object krijgt een naam en een paar eigenschappen (sectie, partij, plek), zodat we later in code kunnen zeggen: "isoleer de lessenaars van de cello's".

## 3. Bovenaanzicht en vooraanzicht (RUN)

```
                 ACHTERWAND (gebogen, ca. 3 m hoog)
        slagwerk/pauken      koper (tuba, trombone)       ← trede 2
   harp        houtblazers (midden)          contrabassen  ← trede 1
     2e violen                         altviolen
   1e violen                               cello's         ← vloer
                    [ DIRIGENT ]
          BORD                      publiek / camera
```

Vooraanzicht: vloer op 0 m, trede 1 op ca. 0,35 m, trede 2 op ca. 0,7 m. Maten verfijnen we in de greybox.

## 4. CHANGE / MORGEN (geparkeerd: eerst RUN. Kai vond een ruimte achter het podium vreemd. Kern: RUN is per functie georganiseerd, CHANGE in gemengde teams aan één melodielijn van begin tot eind. Dirigent = Orchestration; The Collective staat niet in beeld.)

Idee: dezelfde bouwstenen (muzikant, lessenaar, bord) in een andere situatie, bijvoorbeeld een repetitieruimte achter het podium:
- minder muzikanten, in groepjes, zonder publiek;
- bladmuziek half af, met doorgestreepte noten;
- bord met "Symfonie van volgend jaar";
- dirigent aan het werk met kleine groepjes.

Omdat beide werelden dezelfde onderdelen gebruiken, ontwerpen we die onderdelen nu meteen zo dat ze in beide passen.

## 5. Stappen, en wanneer een stap af is

Per stap een korte "klaar-check" die Kai zelf kan beoordelen. Pas na Kai's akkoord gaan we door.

| Stap | Klaar als... | Waar we op letten |
|---|---|---|
| 1. Uitgangspunten | Kai heeft §0 goedgekeurd | Geen aannames die alleen in hoofden zitten; alles staat in dit document |
| 2. Blueprint | Hiërarchie, boven- en vooraanzicht en moodboard goedgekeurd, voor RUN en CHANGE | Elke "isoleer"-wens uit §1 is terug te vinden in de hiërarchie |
| 3. Greybox (blokken) | Elke group uit §2 bestaat, heeft de juiste naam en is los te isoleren met een testknop | Verhoudingen en camerastandpunten kloppen met het huidige beeld; nog geen tijd in details |
| 4. Modellen en materialen | Elk type muzikant, instrument en lessenaar is gemaakt in één consistente stijl | Kleuren uit de art direction; aantal unieke modellen klein houden; licenties per extern model genoteerd |
| 5. Scène compleet | Volledig orkest staat, laadt binnen een paar seconden, draait soepel op een gewone laptop en telefoon | Bestandsgrootte en snelheid meten, niet schatten |
| 6. Verhaalwebsite | Elk hoofdstuk werkt met scroll, klik en zoom; tekst klopt | Het verhaal gebruikt alleen namen uit de hiërarchie, zodat een nieuw verhaal geen nieuw model nodig heeft |
| 7. Testen en publiceren | Getest op telefoon en desktop, fallback naar 2D-beeld als 3D niet werkt | Eerst een testadres, pas na akkoord de echte site |

Algemene valkuilen: te vroeg mooi maken (eerst blokken), stijlen mengen, te veel unieke modellen (traag), en het verhaal in het model "inbakken" (dan is het niet meer herbruikbaar).

## 6. Modellen: wat kan gratis

- **Zelf in code** (zoals de stijlproef): volledige controle over stijl en isoleren, licht en snel. Grens: figuren blijven gestileerd; geen gezichten of realistische handen.
- **Gratis CC0-pakketten** (KayKit, Quaternius, Kenney): goed gemaakt maar in een "game"-stijl die waarschijnlijk niet bij het rustige beeld past. Gezeten muzikanten met instrument zitten er niet in.
- **Sketchfab**: soms losse instrumenten (vaak CC-BY, naamsvermelding verplicht). Bruikbaar voor bijvoorbeeld een harp of pauk, per model te beoordelen.
- **Betaald, als we vastlopen**: modellen kopen (CGTrader, TurboSquid) of een 3D-artiest inhuren voor een vaste set figuren.

## 7. Greybox RUN (stap 3, v1, 16-10-2026)

- Bestand: `greybox-run-v1.html`, gepubliceerd op https://claude.ai/artifact/Y31Vwu4YQMyhPW749ZjVkM. Alle maten staan bovenin de code in één CONFIG-blok.
- Afwijking van de tekening: het publiek zit op ca. 27 m van het podium (rijen op z 29,5 tot 33 m), zodat camera 1 ertussen past en het publiek pas bij het uitzoomen (camera 2) in beeld komt.
- v2 (Kai, 16-10-2026): publiek verder weg, op ca. 36 m (rijen op z 38 tot 41,5 m); één gedeelde lessenaar per vier muzikanten (17 in totaal, inclusief dirigent). Strijkers delen per sectie, de andere families per familie. Bestand: `greybox-run-v2.html`.

## 8. Stijl RUN (stap 4, v1, 16-10-2026)
- Bestand: run-stijl-v1.html, gepubliceerd op https://claude.ai/artifact/TkjjEdTBUkM6oXSfBZHYj2
- Kleuren uit art direction v3: oplichtend podium, aarde-heuvels, graanveld, laag goudlicht van linksvoor, alleen de dirigent in oranjerood, granaatrode stoelen.
- Alles zelf gemaakt in code (geen licenties nodig): 1 figuurmodel met varianten in huid, haar en kleding; 18 instrumenten; gedeelde lessenaars.
- Prestatie: 615 meshes, ~265k driehoeken. Op telefoon: scène bovenaan, paneel eronder, lichtere schaduwen.
- Wacht op akkoord van Kai voor stap 5.
