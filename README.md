# The Archives of Madness

A retro raycaster psychological survival game in the browser, set in Borges' *Library of Babel*. A ZomBeef Games title, and the game-over mode of WEIGHTS.

You wake as a copy of yourself shelved in an endless library of hexagonal rooms. A phrase is burned into your mind. Find the page that contains it before your sanity, lantern oil or health run out.

## Play

The whole game is one self-contained file, `index.html`. Open it in a browser on desktop or phone; there is no build step and nothing to install.

To serve it locally:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Walk / turn | W A S D or arrows | Thumbstick (bottom left) |
| Look around, up and down | Drag, or R / F | Drag |
| Read the shelf you aim at, or use what is in front of you | E or Enter | Read button |
| Swing the bookpress | Space | Swing button |
| Journal | J or Tab | Journal button |
| Turn pages | Left / Right | Tap the page edges |
| Shelf above / below (in a book) | W / S | Tap the top / bottom edge |
| Climb / descend (at the stair) | W / S | Tap the upper / lower page |

## The Library

The world follows Borges' story closely:

- Every gallery is a hexagon with twenty shelves (five on each of four walls) of thirty-two books; every book has 410 pages of 40 lines of 80 characters.
- The two free sides open onto a narrow hallway with two very small closets (one to sleep standing up, one for necessities), a mirror that really reflects, and a spiral stair that runs up and down without end.
- A vast air shaft with a low railing sits in the middle of every gallery. Look down or up through it to see the other floors.
- Two dim spherical lamps hang in each gallery, so the far galleries down the chain stay faintly lit.
- Each floor is a chain of galleries; the stair joins the floors. The Library is periodic: 24 galleries along the chain and 24 floors up or down, then the same books return in the same disorder.

## What is in the prototype

- Portal raycaster at roughly 320×200: doorways, hallways, mirror reflections (you see yourself), railings, and storeys seen through the shafts.
- Deterministic pages: every page is calculated from hexagon, floor, wall, shelf, book and page (FNV-1a + mulberry32), so the same shelf always reads the same on every device.
- Sanity, health and lantern oil; psychosis at zero sanity with phantom Purifiers. Sleeping in the closet restores sanity at the cost of oil.
- Purifiers (patrol, chase, burn shelves) and Seekers (charge to steal oil when startled).
- Your biography page clusters around one hexagon and floor tied to your phrase and favours two walls, so it can be learned.
- The Index, a brass machine at some railings: feed it coherent sentences you find and it tells you the floor, the hexagon, then the walls of your page.
- Finding your page wins the run and returns you to WEIGHTS.
- Paper cut-out characters and a floating, layered 3D-style interface.

## Design

The full game design document is in [`docs/GDD.md`](docs/GDD.md), including planned modes, multiplayer, cross-game unlocks and the production roadmap.
