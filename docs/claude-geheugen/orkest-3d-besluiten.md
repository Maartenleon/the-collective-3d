---
name: orkest-3d-besluiten
description: Decisions for The Collective's 3D orchestra scene (scope, stack, isolation needs, RUN/CHANGE dimensions)
metadata:
  type: project
  modified: 2026-10-16T19:03:58.183Z
---
Decided with Kai on 2026-10-16 (thread "Aanpak orkest-3D"):
- 3D model first, story later; the model must support any story, so every group must be isolatable (section, conductor, music stands, board).
- Music stands (lessenaars, incl. conductor's) are a separate top-level group, not part of musicians. A "Bord" group shows what is being played.
- Framework has two dimensions: RUN/VANDAAG (concert, build first) and CHANGE/MORGEN (rehearsal for next year's symphony), sharing building blocks.
- Kai has no Blender: everything in three.js code. Free/self-made models first; discuss paid options only when stuck.
- CHANGE/MORGEN: Kai rejected 'room behind the RUN stage' (odd); location being re-decided. Core difference: RUN is organised by functional role (sections together); CHANGE is multidisciplinary teams of mixed instruments working on an end-to-end melody line.
- Conductor = Orchestration, NOT The Collective (Kai, 2026-10-16; art direction is wrong on this point). The Collective is NOT in the picture: it is the party that helps with the orchestra's problems (translated to companies).
- RUN extras (Kai, 2026-10-16): piano + extra percussion (bass drum, cymbals, xylophone) = 49 musicians; audience in 4 rows of chairs on the grain field, backs only, revealed when camera pulls back; no lamps.
- Lighter mobile version; GitHub Pages + vanilla three.js.
- Artifact pages: inline models as base64 + loader.parse; no data: URIs inside glTF (CSP).
- Site test (2026-10-16): Kai wants the 3D scene with the site's scroll story on a NEW page next to the current site (3d.html in repo kjvcs/The_Collective, Kai uploads it himself; GitHub not linked to Claude). Ending: 3D audience instead of drawn observers. Page: https://claude.ai/artifact/8iDYjBHng1eNwUhUx7n9uU, file /mnt/project-files/orkest/site/3d.html, sources bron/story-*.
- 2026-10-17 Kai: no free scroll: one scroll/swipe/arrow key = one scene (STOPS in story.js), plus dots on the right to jump. Chosen over buttons-only and autoplay.
Versions, links and build history: [[orkest-3d-voortgang]].
- 2026-10-18 Kai zoekt zelf betaalde modellen/instrumenten. Licentie: verkoper vooraf mailen; gekochte bronbestanden nooit in de openbare GitHub-repo, alleen verpakte/versleutelde build publiceren.
- 2026-10-17/18 AD-pass: donker, laag strijklicht, ploegvoren, 3-4 berglagen in nevel, 49 muzikanten zo divers mogelijk, dirigent lange rode jas.
- 2026-10-19 Kai (v7): podium = minimalistische witte pleisterbak, lagen volgen de secties; wit blijft belangrijk voor de aandacht. Graan oker met salie-groen. Filmlook overal. Orkest: stoelen zwart, mannen rokkostuum, vrouwen jurk/rok/pantalon in zwart. Gezichten Rocketbox; betaalde mensen later.
- 2026-10-19 Maarten/Kai (v10, vervangt v8-keuzes): rode aarde glad zonder lijnen; camera 1 laag en frontaal (foto-referentie), podium in onderste deel, vlakke rode rand met lage glooiende heuvels in blauw-lavendel + perzik erboven, geen graan in beeld; bord = klassiek v9-bord met perzik papier (v11); heuvels v9-vorm in donker lavendel (v11); podiumrug glad, laag, 2 lagen met textuur; publiek op rode aarde (iets lichter stoffig rood), zwarte stoelen, geen grind (v12); podium helder wit met textuur en schaduw, lichte kleine verre heuvels, lange schaduw over voorkant kom zoals Maartens foto (v13); eerst proefbeelden tonen, dan pas publiceren; dirigent ook naast bord 2 (zelfde jas). Lader: rustige lijn in site-stijl, wacht op alles.
- 2026-10-19 verhaalpagina (doc https://claude.ai/code/artifact/c46861cd-bbd6-4c72-913b-728a4ac5fa27): melodielijnen (2, value streams) bij Blueprint, niet bij It isn't; "The Score"; 2e bord "Next Season's Symphony / The Next Episode"; concertwoorden in zinnen, Run/Change als label; Means max 15 s, mensen + middelen; repetitiehoek (Change) niet in openingsbeeld; publiek Rocketbox-niveau, alleen rijen zichtbaar bij camera 2, avondkleding gedempt + granaat/oker, levendige houding.
