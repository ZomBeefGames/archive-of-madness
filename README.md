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
| Look | Drag | Drag |
| Read a shelf | E or Enter | Read button |
| Swing the bookpress | Space | Swing button |
| Journal | J or Tab | Journal button |
| Turn pages | Left / Right | Tap the page edges |

## What is in the prototype

- Raycaster at roughly 320×200 through hexagonal rooms with doorways; you can see several rooms deep.
- Deterministic pages: every page is calculated from hexagon, wall, shelf, book and page (FNV-1a + mulberry32), so the same shelf always reads the same on every device.
- Sanity, health and lantern oil; psychosis at zero sanity with phantom Purifiers.
- Purifiers (patrol, chase, burn shelves) and Seekers (charge to steal oil when startled).
- Biography pages follow a learnable pattern tied to your phrase: two favoured walls, denser in one direction.
- Finding your page wins the run and returns you to WEIGHTS.
- Paper cut-out characters and a floating, layered 3D-style interface.

## Design

The full game design document is in [`docs/GDD.md`](docs/GDD.md), including planned modes, multiplayer, cross-game unlocks and the production roadmap.
