# The Archives of Madness

A retro raycaster psychological survival game in the browser, set in Borges' *Library of Babel*. A standalone ZomBeef Games title.

You wake as a copy of yourself shelved in an endless library of hexagonal rooms. A phrase is burned into your mind. Find the page that contains it before your sanity, lantern oil or health run out.

## Play

The whole game is one self-contained file, `index.html`. Open it in a browser on desktop or phone; there is no build step and nothing to install.

To serve it locally:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Title screen & cinematic scenes

A new illustrated **ZomBeef Games** title screen opens before the Library. It uses the game's own pixel-paper, ink, brass and lantern palette, with animated archive shelves and a responsive **Begin Your Story / How to Play / Sound** menu. Use W/S or the arrow keys and Enter on desktop, or tap a menu choice on mobile.

Beginning a new run now plays a four-shot opening sequence before the familiar "burned into your mind" introduction. The first nearby Purifier triggers a two-shot warning; your first interaction with the Index triggers another two-shot reveal. Daybreak and finding your page have animated book-and-parchment interludes. All story scenes pause active combat and game time, then return to the original action. **E / Enter / Space or tap to advance; Escape, X or the top-right SKIP label to skip**. Scene reveals occur once per run, and the animation respects reduced-motion preferences.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Title menu | W/S or arrows, Enter to select | Tap menu choices |
| Advance a cinematic | E, Enter or Space | Tap screen |
| Skip a cinematic | Escape or X | Tap SKIP (top right) |
| Walk / turn | W A S D or arrows | Thumbstick (bottom left) |
| Look around, up and down | Drag, or R / F | Drag |
| Read shelves, search bodies, or use what is in front of you | E or Enter | Read button |
| Attack with your weapon (or throw oil) | Space | Swing button |
| Switch weapon: bookpress, shelf rod, oil flask, recovered torch | Q, or 1 2 3 4 | Tap your weapon hand |
| Burn sect incense | I | Tap your face in the mirror |
| Sound on / off | M | Tap the bottom of the journal |
| Third / first person | V | — |
| Journal | J or Tab | Journal button |
| Turn pages | Left / Right | Tap the page edges |
| Shelf above / below (in a book) | W / S | Tap the top / bottom edge |
| Climb / descend (at the stair) | W / S | Tap the upper / lower page |
| Order bread / soup (at the food hatch) | W / S | Tap the upper / lower page |

## The Library

The rooms follow Borges' story; the space between them is open air:

- Every gallery is a hexagon with twenty shelves (five on each of four walls) of thirty-two books; every book has 410 pages of 40 lines of 80 characters. A vast air shaft with a low railing sits in the middle, two spherical lamps hang overhead, and the two free sides have doorways facing east and west.
- The galleries stand apart on a square grid, separated by open air. Railed catwalks run north-south and east-west between them, and a short landing joins each doorway to the catwalk beside it. Each crossing of two catwalks has a small lamp.
- The community areas form an **evenly spaced 3-D grid**. They start **3 crossings apart east/west and north/south, and 3 floors apart up/down**. There is no random assignment of community floors. A full communal platform appears when its east/west crossing, north/south crossing, and floor are all multiples of the same interval. Full hubs contain a spiral stair, sleeping closet, necessities closet, mirror, and food hatch.
- **Stairs continue between hub floors.** On the intervening levels, each hub's stair location remains a bare transit landing with rails and a spiral stair, but **no community amenities**. You can still climb or descend one floor at a time. The journal map marks full hubs separately from stair-only landings.
- The food hatch is a dumbwaiter: order bread and water (+20 health, quick) or lentil soup (+45 health, slow), wait for the bell, and eat at the hatch. Food is the only way to get health back.
- A day still takes eight in-game minutes. The player blacks out at midnight and wakes at six each morning, but **not every dawn resets the Library**. The first two full resets are each **two days apart**; every second reset lengthens the wait by another day, giving intervals of **2, 2, 3, 3, 4, 4, ... days**. On an ordinary dawn, burned shelves, found/looted bodies, fire, and unfinished business remain. At an actual reset, the world is restocked and repaired, while found sentences, quest progress, and things you carry persist. The HUD/journal shows the next scheduled reset day.
- **Every newly discovered real sentence adds one gallery of distance between communal hubs in both horizontal directions AND one floor in the vertical direction.** The hub interval therefore progresses from 3×3×3 to 4×4×4, 5×5×5, and so on. Sentence discovery is counted once per distinct source, including readable sentences, other lives, conversations, and loot; an Index key's doubled fragment reward does not double the spacing, and spending fragments does not shrink the Library.
- A gallery keeps its hexagonal floorplan and deterministic book addresses, but its **environmental condition is unique per location and Library reset**. Ordinary libraries mix with completely burned-out rooms, actively burning rooms, barricaded rooms and rare hidden refuges. The same shelf address always refers to the same books, unless they are destroyed by fire during the current reset.
- Full hubs have their own persistent variants: **ordinary, barricaded, scorched or vigil**. Non-hub floors retain the stair but can be **plain, ashen, barricaded, watched, collapsed or shrine-like transit landings**. Barricaded community services cannot be used until their checkpoint is cleared, but the **stair remains available**.
- Each damaged or unusual location has illustrated, pixel-paper **room dressing**: charred bookcases, ash piles, ember-lit smoke, barricade planks, warning notes, supply crates, hanging chains, watch posts and candle shrines. Burning galleries have flickering firelight and damage near shelves; destroyed galleries have unreadable books and scavengable ash relics. Barricaded galleries close only one door, leaving the opposite door accessible; approach the blocked entrance and press **Read** to pry it open.
- Hidden supplies and checkpoint clearances can be collected **only once per true Library reset**. Room variants, broken barricades, searched stashes, and fire all persist across ordinary dawns; the reset epoch regenerates them. Read prompts appear near searchable caches, barricades and special landing props on desktop and touch.
- The journal (J) shows nearby special room conditions and hub/transit variants using distinct colors, plus the current zone name, grid interval, sentences discovered, and next Library reset. Once the Index has told you, a red cross marks the gallery of your page.

## What is in the prototype

- A new responsive animated ZomBeef Games title/menu: parchment and brass lettering, receding bookshelf theatre, embossed studio crest, controls panel and a sound toggle. Animated cutscenes at opening, first Purifier encounter, first Index interaction, dawn and the finale, with tap/keyboard advance and skip.
- Adaptive pixel-art raycaster (about 192,000 scene pixels on desktop and 112,000 on touch devices) that steps across the grid and through the doorways and follows each ray up and down through the open air, so other storeys show past the catwalks and down the shafts and stairwells; mirror reflections (you see yourself) and railings.
- Deterministic pages: every page is calculated from its address (hexagon, floor, wall, shelf, book and page) (FNV-1a + mulberry32), so the same shelf always reads the same on every device.
- Sanity, health and lantern oil; psychosis at zero sanity with phantom Purifiers. Sleeping in the closet restores sanity at the cost of oil.
- Purifiers (patrol, chase, burn shelves) and Seekers (charge to steal oil when startled).
- Search fallen Purifiers, Seekers and librarians by standing near a body, facing it and pressing Read (E/Enter on desktop, Read button on mobile). An on-screen prompt appears when a body is within reach. Corpses can only be searched once per **Library reset**, even if you leave, revisit or wake on an ordinary dawn. Search results appear in the in-world book UI.
- Purifiers always have a recoverable torch (plus occasional incense or type); Seekers may have oil, type or sentences; dead librarians may have oil, incense, type, useful text or nothing. Burned corpses often carry only ash. You can carry up to five torches, keeping extras through the dawn.
- Recovered Purifier torches can be equipped as a fourth weapon: the first is automatically selected. Torches provide light when the lantern is empty and can strike nearby enemies. Each burns for 75 seconds while equipped; unused torches remain in your inventory and automatically replace spent ones.
- Your biography page clusters around one hexagon and floor tied to your phrase and favours two walls, so it can be learned.
- The Index, a brass machine at some railings: feed it coherent sentences you find and it tells you the floor, the hexagon (marked on your map), then the walls of your page.
- Weapons: the heavy bookpress (slow, three hits fell a Purifier), the sharpened shelf rod (fast, long reach; pry one loose from a burned shelf), and lantern oil thrown and lit (a fire that blocks the way, scorches Purifiers and costs 2 oil). Oil splashed on a bookcase burns the whole wall.
- Sect incense, left on floors and dropped by fallen Purifiers: +30 sanity over six seconds and the phantoms go.
- The Prophecy Trap: kill a Seeker (and take their oil) or burn a wall of books, and the next coherent page you find tells you what you did, in the past tense. −30 sanity, but each one wakes a dark power: harder hits, and the Seekers flee from you.
- Sound, synthesised in the browser with the Web Audio API: the Library's hum, footsteps, pages, weapons, fire, screams, a heartbeat when your mind is going.
- Finding your page wins the run.
- Paper cut-out characters and a floating, layered 3D-style interface. Detailed book bindings, oak shelves and nailed floorboards, softer light highlights, depth-tested amber lamp halos and subtle edge shading preserve the retro look.
- Distinct hand-pixelled character portraits: the counter’s spectacles, the peddler’s cap and pouch, Rose’s grey hair and shawl, and different sleeping, laughing and weeping expressions. Purifiers have ash-grey robes with stitched trim and brass details; the player wears a tailored coat with a leather strap.
- Paper puppets: Purifiers, Seekers, and librarians are jointed paper figures with **camera-aligned front/rear cards** so their bodies remain fully readable through 360° of motion. Painted collars, sleeve shoulders and waist seams now overlap the torso without disconnected joints; two-bone arm reach attaches torches, weapons, lanterns, and books to the **visible palms**. Shoes use the actual cutout sole for floor placement, and the pelvis settles enough for planted feet to remain grounded during high-bob walks.
- Third person: the camera follows over your right shoulder and slides in when a wall or the mirror is behind you. You are a jointed paper librarian too, with painted backs to the coat and head, a swinging lantern, and your weapon wound up and struck out into the room. V switches back to first person.
- Other lives: some pages hold the stories of other librarians (six of them, five pages each, found in order, highlighted in green). Each page is a comfort (+8 sanity, and the Index takes it like a sentence), but it settles into you and your own words fade: the journal shows your phrase losing letters and the HUD counts how faded you are (out of 6). The fifth page is an ending, and the book asks before you read it. Read it with your words still holding and you let that life go (+25 sanity, some of your words come back); read it when they are 5 of 6 faded and its ending becomes yours, and the game is over. Each new day gives two letters back.
- The way to your page: your page is no longer scattered near its hexagon by chance. It is page one of one book, and it is not on the shelf until six steps are done, in order (the journal shows what you know and the next step):
  1. The floor: feed the Index a real sentence.
  2. The hexagon: feed the Index two more sentences at once, on day 2 or later.
  3. The wall: stand in your hexagon at night.
  4. The shelf: buy the shelf-mark slip at a food hatch (12 type, from day 3).
  5. The book: let another life go (read an ending while your words still hold).
  6. Shelved: at the next dawn on day 5 or later the page is put on its shelf. Before then your book is there but page one is blank.
- The Library goes on without you: every half a minute or so, somewhere you are looking (a far stretch of catwalk on your floor, or one or two floors up or down), another librarian runs across screaming, climbs the rail and jumps, is pushed off by a Purifier, or runs burning until they fall. Events are only placed where you can actually see them (a per-pixel depth buffer also hides figures behind the catwalks and floors in front of them).
- The dead stay: Purifiers and Seekers you kill remain in galleries and catwalks until the next true Library reset. Additional bodies appear as time advances through that reset epoch, sometimes burned or hanging from a railing on nearby floors; ordinary dawns no longer clean them away.
- People: every minute or two someone is standing a few steps ahead. Walk up and Read to talk. The laughing man (laugh with him for type, at a cost to your mind), the counter (ask the total and he gives up a real sentence), a weeping librarian (comfort her for sanity and incense, or rob her and it will be written down), a peddler (oil or incense for type), a sleepwalker reciting your own words (wake him, or listen and get some of your words back), and, once, from day 2, a very old woman at a railing who has been waiting 84 years.
- Scenes you stumble on, a few steps ahead, that you can walk up to and Read: a mob beating a Purifier (join in for his type, or stop them and he gives you incense); the sect at prayer, three Purifiers about to burn a kneeling librarian (attack them and they turn on you, or walk away and she burns, and her body stays); a funeral carrying someone to the drop (say a word and get some of your own words back); and a Purifier's sermon (listen for a real sentence at a cost to your mind, or heckle him and he comes for you). **Event options have their own outlined, full-row tap hitboxes on both desktop and mobile**: choosing the first row triggers choice A, the second triggers choice B, and tapping outside closes without choosing either.
- The Library is brighter: more light from the lamps and the air, a longer lantern, and less murk between floors.
- Voices: screams (near and falling away), maniacal cackling, sobbing, whispering, muttering and humming are synthesised with a small formant voice in the browser, placed in the Library (quieter and duller with distance, panned left or right). Recorded CC0 sounds can replace any of them: see `sfx/README.md`.
- Lead type and the hatch: Purifiers (3–5) and Seekers (2) drop lead type when they fall, and loose type lies on gallery floors. The food hatch is now a menu: bread (free), lentil soup and bitter tea (+30 sanity) for 3 type, three trinkets a day from the stock, and a cheaper sealed parcel holding a random one you do not have. Trinkets last the whole run: grey spectacles (noise costs no sanity), iron thimble (+1 damage), leather apron (40% less damage taken), the Index key (sentences and other lives count twice), slow wick (oil lasts twice as long), pocket mirror (once a day, survive at 30 health) and silk bookmark (each dawn your words come back in full).
- Rear-view coat tails now sit over the librarian's trousers and are depth-sorted by the actual distance of each cut-out. NPC librarians receive the same correction.
- NPC paper figures now billboard squarely to the camera without becoming a hairline from side angles, while movement orientation still selects the correct painted front or back. A small turning dead zone prevents front/back flicker. This is independent of the player's third-person/first-person camera setting.

## Design

The full game design document is in [`docs/GDD.md`](docs/GDD.md), including planned modes, multiplayer, cross-game unlocks and the production roadmap.

## Hosting

The game is the single file `index.html`. On Railway it is served by `server.mjs` (Node, no dependencies): `railway.toml` builds it with Railpack and starts `node server.mjs`, which listens on `$PORT`, serves `index.html` at `/` and the files beside it (such as `sfx/`), and refuses dotfiles and its own server files. Locally: `npm start`, then open http://localhost:3000.

## Checks

Run `npm run check` (Node 18 or newer; no dependencies). It checks server syntax, parses the inline game JavaScript, and runs focused tests for sermons, corpse loot, coat-tail ordering, cinematic menus, **NPC front/back facing, torso joints, palm-held items, grounded foot poses, event-choice click targeting in portrait/landscape, 3-D hubs, resets and environmental hazards**. GitHub Actions runs the same checks on pushes to `main` and `fix/*` branches. Tests exercise production code with rendering/audio stubbed; they do not replace visual browser playtests.

The visual presentation uses detailed jointed paper-cutout characters, engraved brass gauges, leather-bound journal covers, layered parchment pages, and illustrated lanterns and hand tools. Character textures render at twice their original sampling density while retaining their existing world size and animation pivots.
