# The Archives of Madness

A retro raycaster psychological survival game in the browser, set in Borges' *Library of Babel*. A standalone ZomBeef Games title.

You wake as a copy of yourself shelved in an endless library of hexagonal rooms. A phrase is burned into your mind. Find the page that contains it before your sanity, lantern oil or health run out.

## Play

The single-player client remains contained in `index.html`: open it in a browser on desktop or phone for offline solo play. **Multiplayer requires the online Node server** (`server.mjs` and `multiplayer.mjs`) because your other players and placed barricades are synchronized over WebSockets.

To serve it locally:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Title screen & cinematic scenes

The illustrated **ZomBeef Games** title screen uses pixel-paper, ink, brass and lantern motifs, with a responsive **Begin / Game Type / Character / Players / Difficulty / How to Play / Sound** menu. The Character row opens an illustrated character creator with a live 3D-style paper-puppet preview. Players cycles through **Single Player**, **Create Co-op Room**, and **Join Co-op Room**. Game Type cycles through the original campaign, **The False Scribe**, and **The Last Shelf**. W/S selects a row; A/D or Left/Right cycles modes or settings; Enter confirms. On phones, tap each setting directly before starting the story.

Beginning a new run now plays a four-shot opening sequence before the familiar "burned into your mind" introduction. The first nearby Purifier triggers a two-shot warning; your first interaction with the Index triggers another two-shot reveal. Daybreak and finding your page have animated book-and-parchment interludes. All story scenes pause active combat and game time, then return to the original action. **E / Enter / Space or tap to advance; Escape, X or the top-right SKIP label to skip**. Scene reveals occur once per run, and the animation respects reduced-motion preferences.

## Two alternative game modes

The title screen now has three distinct **game types**, all using the same five-floor renderer, character designs, real galleries, bridges, weapons, and barricades. The original story is the default and retains its existing endings and difficulty requirements.

**The False Scribe (hidden-traitor, 3–8 online players)** — Takes place in **The Redacted Annex**, its own 5×5 fortified district with guarded bridges, secluded mirror galleries, trial chambers and a locked inner archive. One secret traitor is chosen on the server. Everyone else receives three privately assigned maintenance tasks scattered across six different galleries, including catalogue, lamp, folio and observatory stations. The traitor can secretly eliminate nearby readers and sabotage the lights or catalogue. Crew members repair sabotage, report bodies, call an emergency assembly near the catalogue, and vote to exile a suspect. Crew wins by completing all assigned tasks or ejecting the traitor; the traitor wins when the surviving crew no longer outnumbers them. Eliminated players become non-interacting observers. The server checks distance, floor, role, task ownership, and voting eligibility; secret assignments are delivered only to their owners. Choose **Game Type: The False Scribe**, host a room, invite at least two friends, and press **Y / START**. Friends joining an ongoing round spectate until the next round.

**The Last Shelf (zombie horde, solo or 1–8 online players)** — Takes place in **The Dead Letter Depot**, its own 7×7 ruined arsenal of burning shelves, fortified catwalks, specimen rooms, exposed bridges and six purchasable weapon shrines. Defend the Library through **ten increasingly large and resilient zombie waves**. This is a first-person shooter with a library twist: **your gun is an open book, and every shot is an actual word** that flies toward the dead. Different books have individual words, power, shot rates, magazine sizes, reload times, range and piercing ability. A worn Pocket Primer comes free. Earn **verse points** for striking and killing zombies, buy new books in different galleries, buy replacement ammunition, and visit the central press to rewrite your books for **+50% damage**.

The armory includes the fast **Index of Ash**, piercing **Redaction Codex**, rapid-fire **Choir of Cinders**, powerful **Atlas of Splinters**, and legendary **Book of Last Words**. Mutants include runners and tougher brutes; hordes follow you when you flee to another room. Between waves, survivors receive healing, verse points, ammunition, salvage wood and oil. Reinforce barricades, push enemies, and revive a nearby fallen friend with **U** (2 boards). Multiplayer health, wave kills, ammunition, purchases, damage and upgrades are **server authoritative**. Survive wave ten to win. Solo mode runs in the browser without a network session.

**Shooter controls:** aim with mouse/drag, **hold Space or left-click to fire words**, **R** reloads, **Q** cycles owned books, **1–6** equips a particular owned book, **E** buys a nearby book or refills its ammunition, and **K** upgrades all books at the central press. Mobile players get **FIRE WORD**, **RELOAD PAGE** and contextual purchase/upgrade buttons. Waves begin with **Y / START**; the original Story and The False Scribe retain their own controls.

Both alternative modes use completely separate, spatially bounded maps and a dedicated on-screen status panel with context-sensitive mouse/touch buttons. Title cinematics and the campaign's Index quest remain separate. Server restarts preserve the selected room type and normal co-op construction, but active hidden-role rounds restart in a fresh lobby to avoid exposing secret assignments.

## Character creation

Select **Character** on the title screen before beginning a run. Personalize your librarian using eight fields: **name**, **male / female / nonbinary presentation**, **age (18–90)**, **clothing style**, **coat color**, **trouser color**, **skin tone**, and **hair color**. The four outfit silhouettes are **long coat**, **hooded coat**, **waistcoat**, and **archive robe**. There are eight coat colors, six trouser colors, six skin tones, and seven hair colors.

The character preview is composed from the same hand-painted, jointed front/back paper-puppet components used in the game. Different clothing styles change the character silhouette, colors change the actual costume and head pixels, and age changes hair highlights and facial marks. Age and presentation are cosmetic and do **not** change health, damage, or difficulty.

On desktop, use **W/S** to select a field, **A/D** or **Left/Right** to change it, **Enter** to edit or advance, and **Escape** to finish. On phones, tap a row's arrows to change an attribute; tapping **Name** opens the phone keyboard. Press **Finish Character** to return to the title screen. Your appearance is saved locally in the browser for subsequent runs.

Co-op characters send their chosen name and appearance to the multiplayer server. Other readers see the correct clothing, face, hair and age-dependent art instead of a generic NPC costume; names are also visible in the co-op HUD. The server validates appearance values before sharing them. Changing clothes remains a cosmetic, pre-run action.

## Difficulty and playthrough length

Difficulty affects **how long the story takes to complete**, not simply damage numbers. Harder modes begin farther from the target, require more distinct true sentences for the Index, demand more archive proofs, unlock the shelf-mark ledger later, and cannot shelve the final page until a later in-game day. New choices and special rooms give you several ways to earn proofs.

| Mode | Earliest final shelving | Distinct sentences | Archive proofs | Second Index payment | Shelf-mark access |
| --- | ---: | ---: | ---: | ---: | --- |
| **Reader** (short story) | Day 3 | 2 | 1 | 1 fragment | Day 2 |
| **Archivist** (standard) | Day 5 | 3 | 2 | 2 fragments | Day 3 |
| **Lost** (long) | Day 8 | 5 | 4 | 3 fragments | Day 5 |
| **Condemned** (longest) | Day 12 | 7 | 6 | 4 fragments | Day 7 |

A day takes eight in-game minutes and resets still follow the existing 2, 2, 3, 3, ... interval. The listed days are **earliest possible ending days**, not guaranteed playtime. If a proof or sentence is still missing on the required day, the page remains unshelved until those requirements are met and another dawn arrives. The journal tracks current proofs, true sentences, the selected difficulty and the earliest ending day. The difficulty is chosen **before beginning a new run**.

Archive proofs are unique discoveries. Recover them by clearing a gallery barricade, opening a hidden stash or unusual landing, or making certain meaningful choices in an encounter. Duplicate evidence from the same scene category during one Library reset does not count again; newly discovered locations always have their own evidence IDs. Collected proofs survive normal dawns and full resets.

## Live co-op multiplayer (up to 8 readers)

This update supports real **invite-code multiplayer** on the same Railway deployment. One reader opens the title menu, selects **Create Co-op Room**, and chooses **Enter the Shared Library**. The game shows a six-character room code. Tap the CO-OP panel or press **C** to share a link. Your friend opens that link, chooses **Enter the Shared Library**, and joins the same session. Alternatively select **Join Co-op Room** and enter the code manually. You can see other readers moving in the Library as distinct paper-puppet librarians, and write short messages with **T** on desktop.

**Shared across the network:** up to eight live players and their customized characters, text chat, original barricades cleared/salvaged, and shared placed barricades (including damage, relocation and triple reinforcements). The co-op server now also controls **one Library clock/reset calendar, a pooled supply inventory, one journal quest stage, unique discovered sentences and archive proofs, and a common ending**. Purifiers and Seekers spawned for actively explored galleries have **server-owned health, positions and combat results**; enemies killed by one reader stay dead for the party until the next reset. Group encounters and NPC conversations are broadcast to the room, with a single chosen outcome.

**Still individual:** each player's health, sanity, camera, position, chosen equipment, and how the shared story is presented (books and cutscenes). Story choices retain their locally rendered consequence text; proof/quest completion and pooled oil, incense, type and fragments reconcile to the authoritative room. Combat validates the attacker’s distance, facing and weapon on the server. The shared enemy simulation is intentionally lightweight: enemies pursue nearby active readers within their own gallery instead of calculating paths across the entire infinite Library. Voice acting and side animations remain local. The game should run on **one Railway replica**; distributing players across multiple instances would require a shared event bus.

**Restart persistence:** the room server writes crash-safe JSON snapshots of invite codes, rooms, construction, enemies, story choices, the pooled inventory and shared progression. With `COOP_DATA_DIR=/data` and a **Railway persistent volume mounted at `/data`**, these snapshots survive ordinary redeployments and restarts; unused rooms expire after **seven days**. The game stores no account passwords or real-world identity data in this file. If the volume is unavailable, room state remains in memory until the server restarts. Solo play works without WebSockets.

## Reclaimable and reinforced barricades

Barricades now act as physical items you can reuse:

1. Face an existing barricaded gallery entrance or blocked checkpoint and use **Read (E)** to clear it.
2. Aim at the broken boards and use **Read (E)** again to **recover one portable barricade**.
3. Look at an open floor or catwalk section ahead and press **B** (or tap **BUILD** on mobile) to place your recovered barricade. It becomes a solid obstacle.
4. Recover more broken barricades from other rooms. Aim at your placed barricade and press **B** to reinforce it, spending one recovered barricade each time. Reinforcements 1 and 2 increase durability; **reinforcement 3 makes it immune to weapon attacks**.
5. Aim and press **Read** to pick the placement back up and recover the original barricade plus all reinforcements. Unreinforced barricades can be broken with weapon strikes; their splintered wreck can be collected again.

Both solo games and co-op sessions use the same interactions. An indestructible barricade can still be **deliberately dismantled** by a reader to relocate it. Collected portable barricades and placed constructions survive ordinary dawns and Library resets during your ongoing run/session, but a fresh run resets solo building inventory.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Title / character creator | W/S chooses a row; A/D changes a setting; Enter edits or confirms; Escape closes creator | Tap Character, edit name with keyboard and other rows with arrows, then tap Finish |
| Advance a cinematic | E, Enter or Space | Tap screen |
| Skip a cinematic | Escape or X | Tap SKIP (top right) |
| Walk / turn | W A S D or arrows | Thumbstick (bottom left) |
| Look around, up and down | Drag, or R / F | Drag |
| Read, clear a barricade, salvage its wood or reclaim a placement | E or Enter | Read button |
| Attack enemies or damage a placed barricade | Space | Swing button |
| Jump over a library or catwalk railing | **G** while facing a nearby railing | Tap **VAULT THE RAIL** when it appears |
| Push someone directly ahead | **P** | Tap **PUSH PERSON** when close and facing them |
| Throw someone farther, possibly over a rail | **O** | Tap **THROW PERSON** when within reach |
| Tie a nearby person or body to a railing; untie a hanging body | **H** | Tap **HANG WITH ROPE** / **RELEASE THE ROPE** |
| Open / close full keyboard map | **K** (Escape closes) | All buttons remain touch accessible |
| Select the seven title-screen buttons directly | **1–7** (in menu order) | Tap a title button |
| Start your new game mode (host / solo) | **Y** | Tap **START** on the mode panel |
| The False Scribe: use task / report body / repair | **E** | Tap **TASK / REPORT** when nearby |
| The False Scribe: eliminate / sabotage / call meeting | **X** / **U** / **M** | Contextual mode controls |
| Emergency meeting: vote for a reader or skip | **1–8** for names, **0** to skip | Tap an eligible reader or **SKIP VOTE** |
| The Last Shelf: revive nearby fallen friend (2 boards) | **U** | Tap **REVIVE ALLY** |
| The Last Shelf: shoot words from equipped book | **Hold Space** or **left mouse button** | Hold **FIRE WORD** |
| Reload pages in your magazine | **R** | Tap **RELOAD PAGE** |
| Equip a stronger purchased book | **Q** or **1–6** | Shop/equip book buttons |
| Buy a book or restock its ammunition at its shrine | **E** when nearby | Tap **BUY / REFILL** |
| Rewrite all owned books for +50% damage at the central press | **K** when nearby | Tap **REWRITE** |
| Leave a finished special-mode round | **Escape** | Tap **EXIT TO TITLE** |
| Preview the next live title-screen scene | **N** | Tap **NEXT SCENE** on the title screen |
| Place or reinforce portable barricade (3 reinforcements = indestructible) | B | BUILD / REINFORCE button |
| Share multiplayer invite | C | Tap the CO-OP room panel |
| Multiplayer chat | T | Desktop chat shortcut; invite link works on mobile |
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
- **The Library has no bottom:** face a real gallery shaft railing or catwalk guard and press **G** (or tap the context-sensitive **VAULT THE RAIL** button). Your reader falls past successive floors with no landing or damage stop. The existing clock continues running until midnight; the standard blackout follows. At dawn, the reader wakes on the nearest navigable **community hub**, measured from the place they jumped, not the depth of the fall. The spawn uses the real community lattice and checks for stairwells, solid pillars and barricades. Multiplayer follows the shared server clock, while solo play uses its local eight-minute day.
- **Five-floor view:** the raycaster still traces farther into the stacks, but now also renders the true room decorations, material variations, suspended lamps, **iron railings**, props, burning effects and visible cooperative characters on **two floors above and two below** while walking or falling. Each visible object's vertical coordinates follow its actual floor; nearby levels are culled by the camera to keep touch performance practical.
- **Physical crowd interactions:** press **P** to shove someone in front of you, or **O** to throw them farther. You can push enemies, encounter NPCs and other co-op readers. Objects and walls stop the knockback; at a genuinely unprotected edge a throw can send a character into the endless shaft. Co-op pushes are checked for range, direction and floor by the server, and shared enemies have server-owned impulses. Thrown players wake via the same midnight community-hub recovery rule.
- **Ragdoll impacts:** shoves, throws, weapon hits, and wall collisions drive linked limbs, joints and cloth; falling characters only die on collisions with an actual gallery deck or catwalk (never on an imaginary plane in the central void). A fallen body settles on its landing floor. The player's original bottomless fall and next-morning communal recovery are unchanged.
- **Ropes and hangings:** each new character begins with **two lengths of rope**. Aim at an accessible person or corpse near a real railing, then press **H** (or tap the contextual button) to suspend them; press **H** again near the knot to release and recover the rope. Jointed hanging models sway from their attachment. Co-op enemy ropes are range/angle/rail validated by the server and synchronized to everyone in the room.
- **Every newly discovered real sentence adds one gallery of distance between communal hubs in both horizontal directions AND one floor in the vertical direction.** The hub interval therefore progresses from 3×3×3 to 4×4×4, 5×5×5, and so on. Sentence discovery is counted once per distinct source, including readable sentences, other lives, conversations, and loot; an Index key's doubled fragment reward does not double the spacing, and spending fragments does not shrink the Library.
- A gallery keeps its hexagonal floorplan and deterministic book addresses, but its **environmental condition is unique per location and Library reset**. Ordinary libraries mix with completely burned-out rooms, actively burning rooms, barricaded rooms and rare hidden refuges. The same shelf address always refers to the same books, unless they are destroyed by fire during the current reset.
- Full hubs have their own persistent variants: **ordinary, barricaded, scorched or vigil**. Non-hub floors retain the stair but can be **plain, ashen, barricaded, watched, collapsed or shrine-like transit landings**. Barricaded community services cannot be used until their checkpoint is cleared, but the **stair remains available**.
- Each damaged or unusual location has illustrated, pixel-paper **room dressing**: charred bookcases, ash piles, ember-lit smoke, barricade planks, warning notes, supply crates, hanging chains, watch posts and candle shrines. Burning galleries have flickering firelight and damage near shelves; destroyed galleries have unreadable books and scavengable ash relics. Barricaded galleries close only one door, leaving the opposite door accessible; approach the blocked entrance and press **Read** to pry it open.
- Hidden supplies and checkpoint clearances can be collected **only once per true Library reset**. Room variants, broken barricades, searched stashes, and fire all persist across ordinary dawns; the reset epoch regenerates them. Read prompts appear near searchable caches, barricades and special landing props on desktop and touch.
- The journal (J) shows nearby special room conditions and hub/transit variants using distinct colors, plus the current zone name, grid interval, sentences discovered, and next Library reset. Once the Index has told you, a red cross marks the gallery of your page.

## What is in the prototype

- A responsive animated ZomBeef Games title/menu uses a **live raycast of the actual Library** behind its accessible parchment-and-brass controls. A seeded director generates **20 different long-form scenes**, approximately 19–30 seconds each, with real player/enemy/reader paper-puppet rigs, gallery variants, bridges, props and the five-floor renderer. Characters fight, burn, flee, build barricades, convert, kneel, worship, go mad and hang from railings; recurring jump queues and dense falling crowds use time-based choreography. Extended camera paths track through galleries, along bridges, around community structures and through the open air; two perspectives fall through multiple floors. **N** or **NEXT SCENE** advances the preview. Title-world zone changes never touch the playable run. The opening, first Purifier encounter, Index, dawn and finale retain skippable scripted cutscenes.
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
- Other lives: some pages hold the stories of other librarians (**ten characters, five pages each**; four additional 5-page biographies of Milo, Ada, Jun and Salma), found in order and highlighted in green. Each page is a comfort (+8 sanity, and the Index takes it like a sentence), but it settles into you and your own words fade: the journal shows your phrase losing letters and the HUD counts how faded you are (out of 6). The fifth page is an ending, and the book asks before you read it. Read it with your words still holding and you let that life go (+25 sanity, some of your words come back); read it when they are 5 of 6 faded and its ending becomes yours, and the game is over. Each new day gives two letters back.
- The way to your page remains a six-step quest, with difficulty-dependent costs and evidence:
  1. The floor: feed the Index a real sentence.
  2. The hexagon: collect the mode's number of distinct sentences and pay its second Index fragment fee on the required day.
  3. The wall: stand in your hexagon at night.
  4. The shelf: buy the shelf-mark slip from the kitchen once the mode's shelf access day arrives (price rises on longer modes).
  5. The book: let another life go (read an ending while your words still hold).
  6. Shelved: at dawn on or after the mode's minimum day, with enough unique true sentences and archive proofs. Before then the page is blank.
- The Library goes on without you: every half a minute or so, somewhere you are looking (a far stretch of catwalk on your floor, or one or two floors up or down), another librarian runs across screaming, climbs the rail and jumps, is pushed off by a Purifier, or runs burning until they fall. Events are only placed where you can actually see them (a per-pixel depth buffer also hides figures behind the catwalks and floors in front of them).
- The dead stay: Purifiers and Seekers you kill remain in galleries and catwalks until the next true Library reset. Additional bodies appear as time advances through that reset epoch, sometimes burned or hanging from a railing on nearby floors; ordinary dawns no longer clean them away.
- **Fourteen individual encounter characters**: the earlier readers, Cartographer, Ink Surgeon and Lantern Warden return. Five newly illustrated characters are **the Last Bookbinder** (bind a testimony or sell its ribbon), **Midnight Bellkeeper** (sound the missing bell or seek silence), **Girl With Two Titles** (recover a sentence or preserve her story), **Exiled Cataloguer** (testify to kindness or falsify a record), and **Blind Glassmaker** (polish your lantern or trade memory for comfort). Their new coat colors, embroidered badges and expressions match the existing jointed paper-figure style.
- **Fourteen group encounters**, independently animated as full paper puppets: the mob, ritual, funeral and sermon, plus the Brass Auction, Unfinished Trial, Chain of Readers, Night Watch and Paper Fire Brigade. Newly added are **Quarantine of Words** (save erased names or take their warning), **Four-Fold Council** (vote to keep a landing open or seal it), **Pilgrims of Page Zero** (trade a real question or share lamp oil), **Roof of Books** (save a family's shelter or strip the fastenings), and **Ledger on the Fire** (save the missing people's records or let them burn). These stories award evidence, true sentences, survival supplies, or recorded misdeeds. Each choice has its own desktop and mobile hitbox; tapping a choice requires pressing and releasing on the same row.
- The Library is brighter: more light from the lamps and the air, a longer lantern, and less murk between floors.
- Voices: screams (near and falling away), maniacal cackling, sobbing, whispering, muttering and humming are synthesised with a small formant voice in the browser, placed in the Library (quieter and duller with distance, panned left or right). Recorded CC0 sounds can replace any of them: see `sfx/README.md`.
- Lead type and the hatch: Purifiers (3–5) and Seekers (2) drop lead type when they fall, and loose type lies on gallery floors. The food hatch is now a menu: bread (free), lentil soup and bitter tea (+30 sanity) for 3 type, three trinkets a day from the stock, and a cheaper sealed parcel holding a random one you do not have. Trinkets last the whole run: grey spectacles (noise costs no sanity), iron thimble (+1 damage), leather apron (40% less damage taken), the Index key (sentences and other lives count twice), slow wick (oil lasts twice as long), pocket mirror (once a day, survive at 30 health) and silk bookmark (each dawn your words come back in full).
- Rear-view coat tails now sit over the librarian's trousers and are depth-sorted by the actual distance of each cut-out. NPC librarians receive the same correction.
- NPC paper figures now billboard squarely to the camera without becoming a hairline from side angles, while movement orientation still selects the correct painted front or back. A small turning dead zone prevents front/back flicker. This is independent of the player's third-person/first-person camera setting.

## Design

The full game design document is in [`docs/GDD.md`](docs/GDD.md), including planned modes, multiplayer, cross-game unlocks and the production roadmap.

## Hosting

The client remains a self-contained `index.html`. Railway runs `server.mjs`, attaching `multiplayer.mjs` and the authoritative `coop-state.mjs` simulator to the `/coop` WebSocket endpoint. The `coop-persistence.mjs` snapshot store runs with `COOP_DATA_DIR`; configure a persistent Railway service volume at `/data`. The pinned production Node dependency is `ws`. Install with `npm install` and start with `npm start` (port `$PORT` or 3000). The static server blocks private module files and dotfiles. Keep the deployment at **one replica** until shared cross-replica state is implemented.

## Checks

Run `npm install` and `npm run check` (Node 18 or newer). The Node suite checks co-op room joins, authoritative NPC combat, shared quests and proof gates, resource synchronization, construction persistence, world dawns, **restoration of a session from disk**, plus the previous gameplay, outfit, room and graphics tests. GitHub Actions additionally runs real desktop/phone Chromium smoke tests with two connected readers to check shared inventory, quests, encounters and the clock. Solo gameplay still uses no network dependency.

The visual presentation now also includes richer engraved type, detailed glass oil flasks, refined incense sticks, patterned food bowls, brighter multi-tier timber barricades with metal bracing, and collectible splinter artwork. The visual presentation continues to use detailed jointed paper-cutout characters, engraved brass gauges, leather-bound journal covers, layered parchment pages, and illustrated lanterns and hand tools. Character textures render at twice their original sampling density while retaining their existing world size and animation pivots.
