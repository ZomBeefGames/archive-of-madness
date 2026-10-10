# Game Design Document: The Archives of Madness
**A Retro-FPS Psychological Survival Game Inspired by Jorge Luis Borges’ *The Library of Babel***
*A standalone ZomBeef Games title, with its own card in the ZomBeef game hub alongside WEIGHTS and Torsion*

*Revision 2, 10 October 2026: browser raycaster engine, paper cut-out style, floating interface, game modes, multiplayer, cross-game unlocks, and hosting.*
*Revision 3, 10 October 2026: the Archives is a standalone game, no longer the game-over mode of WEIGHTS. Cross-game links through the hub stay.*

---

## 🧭 Project Overview
* **Genre:** Retro-FPS ("Boomer Shooter") / Psychological Survival Horror, with social-deduction multiplayer
* **Aesthetic:** Early 1990s faux-3D (classic *Doom*, *Wolfenstein 3D*) drawn by a raycaster, with pixel-art textures and characters as **paper cut-outs** standing in the world. Comic-book touches: inked edges, sound-effect bursts, and story moments framed like panels.
* **Platform:** Runs in the web browser on desktop and phone. No install, no GPU needed on our side; the player's own device draws the game.
* **Core Concept:** You are a nameless librarian trapped in an infinite universe of identical hexagonal rooms containing every book that could ever be written. You must manage your fading sanity while avoiding zealot factions, fighting for resources, and searching for the legendary book that contains your exact personal biography.
* **Place in the ZomBeef universe:** A standalone game with its own card in the hub. It shares one save with the other ZomBeef games, and unlocks travel between them (see Cross-Game Unlocks).

---

## 🎨 Visual Aesthetic & Interface

### The Environment
The world consists of endless, towering hexagonal chambers connected by narrow doorways. Walls are entirely lined with massive, dark oak bookshelves stretching into pitch-black ceilings. Everything uses chunky pixel-art textures. Rooms are lit only by the player's flickering oil lantern, so light falls off fast and the far side of a room is in darkness. Through each doorway you can see the next hexagon, and the next, repeating into the dark.

* **Shelf walls** are 32×32 pixel textures generated from each wall's coordinates, so every shelf is slightly different but the same wall always looks the same.
* **Burned shelves** are a separate blackened texture with glowing embers. Once a wall burns, it stays burned.
* **Floors** are dark oak planks with the same pixel treatment.

### Paper Cut-Out Characters
Every character and object is a flat pixel-art card with a white paper border, standing in the 3D room. Unlike classic raycaster sprites, the cards do **not** always turn to face you:

* Walk around a character and its card thins to a sliver edge-on, then shows its plain paper back with a strip of tape.
* Characters flip like paper when they turn, bob as they walk, flash white when hit, and crumple when killed.
* Each card casts a flat shadow on the floor.
* Sound effects pop up as comic bursts ("FWOOSH!", "KRAK!", "SNATCH!").

### The Floating Interface (VR style)
There is no flat dashboard. The interface floats in the room as paper panels, drawn by the same raycaster as everything else:

* **Three panels hover low in front of you:** health and sanity dials on the left, a mirror with your face in the middle, lantern oil and hexagon number on the right.
* **They drift after you.** Turn quickly and the panels lag behind, then swing back into place. Catch one from the side and it thins out like paper.
* **Books fly off the shelf.** Reading pulls the book out of the wall; it spins to face you and hangs at eye level with the room visible behind it. Turning a page makes it twist.
* **The journal** (J key) floats up as a small open book with your stats, your burned-in phrase, and every real sentence you have found.
* **Your hands** stay at the bottom of the screen: the oil lantern on the left, your weapon on the right.

### The Dynamic Portrait
A 16×16 pixel face of your character, shown in the floating mirror.
* **High Sanity (above 50%):** Focused, determined expression, blinking.
* **Medium Sanity (25–50%):** Darting eyes, sweating, twitching mouth.
* **Low Sanity (below 25%):** Pale skin, bleeding eyes, jaw hanging open in a silent scream. The screen warps and turns purple at the edges.

---

## 🎮 Core Mechanics & Gameplay Loop

### 1. The Dread & Sanity System
Opening books is the core interaction, but it is a psychological gamble.
* **The Noise:** Almost every book is complete, randomized gibberish. Opening a new book of pure nonsense drains **2 Sanity**; turning to another page of noise drains **1**.
* **The Clues:** A page with a coherent sentence restores **6 Sanity**, gives **Index XP**, and is copied into your journal.
* **Your Phrase:** A page containing your own burned-in phrase restores **20 Sanity** and counts as a biography fragment.
* **Rereading** a page you have already read costs nothing and gives nothing.
* **Zero Sanity Status:** At 0% the player enters a **Psychosis State**. The room warps, phantom Purifiers flicker in and out, and health drains slowly until the player finds meaningful text or uses a sanity item like *Sect Incense*.

### 2. The Personal Narrative Quest
At the start of the game, a random 3-word phrase is burned into your mind (e.g., *"yesterday i wept"*).
* As you explore, you find rare fragments of text. Slotting these into a hexagon's central terminal filters the library's coordinates, pointing toward your next biography fragment.
* **Learnable placement:** Biography fragments are not scattered by pure chance. They follow a hidden pattern tied to your phrase (for example, favoring certain wall numbers and growing denser in one direction). Players can sense it over time, and the Fly companion can actually learn it (see Cross-Game Unlocks).
* **The Prophecy Trap:** If you commit an action, like killing a neutral NPC or stealing supplies, the next coherent book you find describes your exact action in past tense. Reading your own sins written by an infinite universe causes massive Sanity damage but unlocks dark combat abilities.

### 3. Lantern Oil
Oil is your light and your ammo.
* The lantern slowly burns oil. Less oil means a smaller circle of light.
* At zero oil the flame goes dull and the rooms fall nearly dark.
* Oil flasks lying in rooms give **+3 oil**. Seekers can steal oil from you.

---

## 👥 Factions & Combat

Combat is fast-paced but resource-scarce. You are not a space marine; you defend yourself with improvised structural tools.

### Weapon Toolkit
1. **The Heavy Bookpress (Melee):** A slow, crushing iron tool. Three hits destroy a Purifier.
2. **Sharpened Shelf Rod (Spear):** Fast melee weapon with long range, perfect for poking enemies around tight hexagonal corners.
3. **Flintlock Tinderbox / Lantern Oil:** A ranged option. Throwing oil flasks and igniting them creates pixelated fire hazards that block narrow doorways, at the cost of your light.

### Enemy Roster (Paper Cut-Out Sprites)
All enemies are pixel-art paper cards, about 18×22 pixels, with 4-frame walk animations. Full sprite sheet: the *Archives Sprite Sheet* page.

* **The Purifiers (Zealots):**
  * *Visual:* Heavy, ash-grey hooded robes with glowing orange eyes, carrying a flickering torch and an iron brand.
  * *Behavior:* They believe the library must be cleansed of its nonsense. They patrol rooms, sprint at you when close, and burn you and the surrounding bookshelves. A burned wall's books are lost to ash forever, including any biography fragment it held.
* **The Wandering Seekers (The Lost):**
  * *Visual:* Emaciated, wild-eyed, wearing tattered rags covered in scribbled notes.
  * *Behavior:* Desperate librarians driven completely mad. They wander and weep. If you open a book near them or hit them, they scream, which alerts every Purifier, and then charge to steal your oil. Hitting a Seeker costs you sanity.

---

## 🕹️ Game Modes

One library, one engine, one sprite set. Each mode is a new set of rules on the same game.

### Single Player
1. **The Search:** The full solo game. A nameless librarian, a random phrase, endless rooms, Purifiers and Seekers, and a long hunt for your complete biography.
2. **Daily Hexagon:** Everyone gets the same library and the same phrase each day. Fastest find goes on a leaderboard.

### Multiplayer
4. **Imposter:** Social deduction, 5–10 players with 1–2 hidden cultists.
   * Everyone looks like the same paper librarian in different robe colors.
   * **Librarians** find coherent pages and bring them to the central terminal. Index enough pages and the library opens an exit.
   * **Cultists** secretly burn shelves, snuff lanterns to darken rooms, plant fake pages that drain sanity, and take out librarians who wander off alone.
   * **Meetings:** Finding ash or a body, or ringing the reading-room bell, calls everyone to the terminal to talk and vote. The voted player's card burns, revealing whether they were a cultist.
   * **Paranoia:** Low-sanity players see phantom figures and fake burn marks, so their evidence can't be fully trusted.
   * **The library is evidence:** Burned shelves stay burned and every page always reads the same, so alibis can be checked ("I read wall 3 in hexagon 12, go look").
   * The map is limited to a cluster of hexagons so players keep crossing paths.
5. **Cults vs Librarians:** Open teams. The cult burns and hunts; the librarians search, share oil, and hold doorways. A shelf that held someone's page is a big win for the cult when it burns.
6. **Co-op Search:** 2–4 friends against computer-run Purifiers, sharing clues and oil.
7. **Conversion:** Everyone starts as a librarian except one cultist. Anyone who breaks at zero sanity joins the cult. The last sane librarian wins.

---

## 🔗 Cross-Game Unlocks

All ZomBeef games share **one save** through the hub. Sign in once; each game reports what you unlocked, and other games react.

### The Fly (Torsion → Archives)
* **Unlock:** Collect all fly nodes in Torsion.
* **In the Archives:** A fruit fly joins you as a tiny paper-cut-out companion that buzzes around your lantern.
* **It really learns.** The fly watches where you walk, where Purifiers patrol, which shelves you have read, and where your fragments turned up. Over time it starts guiding you: toward unread walls, away from danger, and toward rooms that fit the hidden pattern of your biography.
* A trained fly is genuinely useful because fragment placement is learnable (see The Personal Narrative Quest), not just decoration.
* **In Imposter mode:** A fly gets nervous around cultists, which makes it evidence that other players can argue about.

### Other Links
* **Archives → Torsion:** a Purifier or Librarian skin, or a library-themed track.
* **Archives → WEIGHTS:** found pages can reveal hidden WEIGHTS chapters or lore.
* **WEIGHTS → Archives:** how far you got in WEIGHTS can change which phrase and starting hexagon you get.
* **Soundtrack:** ZomBeef tracks unlocked in any game can play in all of them.

---

## 💻 Technical Logic

### Engine
* **Raycaster in the browser** (plain JavaScript and the 2D canvas), rendering at 320×200 and scaled up with crisp pixels.
* **Hexagon rooms:** Rays are tested against the six angled wall segments of a hexagon rather than a square grid. Two opposite walls have doorways; a ray passing through a doorway continues into the neighboring hexagon, so you can see several rooms deep.
* **Paper cards** are drawn as flat segments in the world with their own facing direction, so they thin out edge-on and show a back side.
* **Floating panels** use the same card drawing at higher resolution, so the interface sits in the room with depth and shadows.
* The prototype runs at full speed on ordinary phones and laptops. No GPU is needed for development.

### The Pseudo-Random Page Generator
The game does not store infinite text. Each page is calculated instantly from its coordinates: **hexagon, wall, shelf, book, page**. Backtracking to the same shelf always shows the exact same text, on every device, forever. A page is 3,200 characters (40 lines of 80) from Borges' 29-character alphabet.

> **Bug fixed from revision 1:** the original C# used `HashCode.Combine`, which in .NET gives **different results each time the game launches**. The same room would show different text after a restart, breaking the backtracking rule. The current version uses a fixed hash (FNV-1a) and a fixed random generator (mulberry32), so results never change.

### Reference Implementation (JavaScript, as used in the prototype)

```javascript
const ALPHABET = "abcdefghijklmnopqrstuvwxyz, .";   // Borges' 29 characters
const PAGE_LENGTH = 3200;                            // 40 lines x 80 characters

// FNV-1a: a fixed hash, identical on every device and every launch
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// mulberry32: a small fixed random generator seeded from the hash
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makePage(hex, wall, shelf, book, page, phrase, sentences) {
  const key = `${hex}|${wall}|${shelf}|${book}|${page}`;
  const h = hashStr(key), rnd = prng(h);
  const chars = new Array(PAGE_LENGTH);
  for (let i = 0; i < PAGE_LENGTH; i++) chars[i] = ALPHABET[Math.floor(rnd() * ALPHABET.length)];

  // Rare pages hide something readable at a random spot
  let kind = "noise", insert = null;
  if (h % 151 === 0)      { kind = "phrase";   insert = phrase; }          // your biography
  else if (h % 19 === 0)  { kind = "sentence"; insert = sentences[h % sentences.length]; }

  let at = -1;
  if (insert) {
    at = Math.floor(rnd() * (PAGE_LENGTH - insert.length));
    for (let i = 0; i < insert.length; i++) chars[at + i] = insert[i];
  }
  return { chars, kind, at, len: insert ? insert.length : 0, key };
}
```

*Next step for this code:* replace the `h % 151` rule for biography pages with the learnable pattern tied to the player's phrase, so the Fly has something real to learn.

### Multiplayer
* A small game server on Railway shares only what changes: player positions, burned shelves, hits, votes, and meetings.
* **Book text is never sent.** Every player's device calculates the same pages from the same coordinates.
* Rooms are generated the same way, so the server only needs to remember what players have changed.

---

## 🌐 Hosting & the ZomBeef Hub
* **The hub** is a new Railway service with a front page in the WEIGHTS style: a cover card for each game, plus room for the ZomBeef music player and news.
* **WEIGHTS** and **Archives of Madness** live inside the hub, since they are browser games that need no server of their own.
* **Torsion** stays its own Railway service, linked from its hub card.
* **Multiplayer server** and the **shared save** run as a small Railway service with a database.
* **One domain** later, such as a games address for the hub and a torsion address for Torsion, so it all feels like one site.
* Every change pushed to GitHub redeploys automatically.

---

## 🛠️ Production Steps
1. **The Prototype — done.** A playable hexagon room in the browser: raycaster, endless rooms through doorways, readable deterministic books, sanity, health, oil, Purifier and Seeker cut-outs, burned shelves, psychosis, death, and the WEIGHTS intro. *(See the "Archives of Madness" test room page.)*
2. **The Look — done.** Pixel-art sprite sheet, paper cut-out cards, floating VR-style interface. *(See the "Archives Sprite Sheet" page.)*
3. **Move to GitHub and the hub.** Put the prototype in a repo, build the hub page, and deploy on Railway.
4. **The Search (solo).** Central terminals, biography fragments with the learnable pattern, the shelf rod and oil fire, Sect Incense, the Prophecy Trap, and sound.
5. **Cross-game links.** The Archives reports its unlocks to the shared save and reacts to what WEIGHTS and Torsion report.
6. **Shared save.** Sign-in and one save across the hub, and the first cross-game unlocks.
7. **The Fly.** Companion that learns from your searching, unlocked from Torsion.
8. **Co-op Search.** The first multiplayer mode, which builds the server basics.
9. **Imposter, Cults vs Librarians, Conversion.** Built on top of the co-op server.
10. **Daily Hexagon** and leaderboards.
