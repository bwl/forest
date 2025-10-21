# Town layout algorithm

**Created:** 8/21/2025 16:04  
**Updated:** 8/24/2025 23:20  
**Exported:** 8/24/2025 23:31  
**Link:** [https://chatgpt.com/c/68a77b53-e3e8-8333-866a-3b6a737b80c2](https://chatgpt.com/c/68a77b53-e3e8-8333-866a-3b6a737b80c2)  

## Prompt:
![Uploaded image](https://chatgpt.com/backend-api/estuary/content?id=file-67MXSNaNji3AX7DMtaMtNu&ts=487803&p=fs&cid=1&sig=3f106a820a147691dbbfc1d2bd5a818627262abdccb438021a8dde3d024a2f54)

Drawing upon your expertise terminal classic rogue developer please recommend an algorithm to generate a town layout that feels spiritually like angband, but takes advantage of a larger 100x63 landscape. Attached is a typical Angband town

## Response:
Thought for 24s

The user wants an algorithm to generate a town layout like Angband, but larger. I’ll focus on procedural generation—using blueprints, Poisson disk sampling, and L-systems. We can define components like perimeter walls, gates, roads, and shops in a central plaza. I'll suggest a seeded PRNG for deterministic results and provide pseudocode for districts, blocks, and interiors.

For the 100x63 map, I’ll first initialize the outer wall with bastions and gates, placing a central fountain. Then, I'll generate primary roads with A\* or jittered straight paths by carving out corridor shapes. For blocks, I'll use a grid-based BSP or Voronoi, aligned with Angband’s aesthetic—robust building lots and alleys. I'll cluster shops near the center.

Done

awesome — love this brief. here’s a town-gen recipe that keeps the “Angband” vibe (orthogonal streets, chunky shops, a central square, 4 gates, lots of right angles), but scales cleanly to a 100×63 map and doesn’t feel copy-pasted.

* * *

High-level shape
================

*   **Perimeter wall** with 4 **cardinal gates**.
*   **Cross-axis boulevards** that meet at a **central square** (plaza).
*   A compact **shop district** around the square (Angband spirit), with named shops in fixed _relative_ slots, not fixed coords.
*   The rest is auto-subdivided into **rectangular blocks** (homes, guilds, park, ruins) with narrow alleys, occasional courtyards, and a couple of “specials”: black market, temple, dungeon stairs.

Everything is deterministic from a seed.

* * *

Tile palette (classic ASCII)
============================

```
# wall     . street    , alley      + door     = gate
% rubble   ~ water     " grass      ^ statue   * lamp
A-Z shop types (see below)          @ player start (on plaza)
```

* * *

Algorithm (step-by-step)
========================

### 0) Constants for 100×63

```text
MAP_W=100, MAP_H=63
WALL=1 tile thick
BOULEVARD_WIDTH=3
ALLEY_WIDTH=1
BLOCK_MIN=8×6, BLOCK_MAX=18×14
PLAZA=18×12   (scale with map size if you change dimensions)
SHOP_BLOCK=  (plaza-bordering ring, 2 tiles deep)
```

### 1) Seed & grid helpers

*   Use a splitmix/xoroshiro PRNG for reproducibility.
*   Define `Rect` ops, Manhattan A\*, and a grid “carver” that converts a polyline with width → tiles.

### 2) Frame & gates

*   Fill `#` around the perimeter.
*   Choose 4 gate centers: `(W/2,0)`, `(W/2,H-1)`, `(0,H/2)`, `(W-1,H/2)`.
*   Punch each gate as `=` with a **3-tile throat** (replace wall with `=` and buffer with `#` so monsters don’t flood).

### 3) Primary streets → “Angband cross”

*   Carve **N–S** and **W–E** boulevards of width 3 from each gate toward the map center using **biased Manhattan A**\*:
    *   Preferred moves are straight; allow lateral jitter with low probability to avoid laser-straight lines.
    *   Stop when within `PLAZA` radius; leave space for the square.

### 4) Central plaza

*   Center a rectangle `(PLAZA_W, PLAZA_H)`; pave with `.`.
*   Sprinkle `^` (statues) and `*` (lamps) on a low-discrepancy grid so lighting looks intentional.
*   Place `@` start anywhere on plaza edge near the north gate approach.

### 5) Shop ring (Angband spirit)

*   Create a **1-lot-thick ring** of rectangles hugging the 4 sides of the plaza, with 1-tile gaps as doors facing the plaza.
*   Assign shop glyphs with a fixed _ordering_, not fixed positions, so it “feels right”:
    *   `A` Armory, `W` Weapons, `B` Black Market, `M` Magic, `P` Provisioner, `T` Temple, `J` Jewelry, `G` General, `H` Home.
*   Ensure at least one **side street** door so there’s back-alley access (classic escapability).

### 6) Secondary street network (block plan)

*   Compute the **buildable polygon** = inside walls minus plaza and shop footprints.
*   Seed **block split lines** aligned to the two boulevards:
    *   Start with one big rect = buildable area.
    *   Perform **orthogonal BSP**, splitting the largest rect repeatedly until each rect fits `BLOCK_MIN..MAX`. Alternate split orientation; jitter split lines by ±1–2 tiles to avoid perfect symmetry.
*   Along every BSP split, with prob `p_main=0.6`, carve a **street (width 2)**; with prob `p_alley=0.3`, carve **alley (width 1)** instead. Leave some splits as hard boundaries to create dead-ends and cul-de-sacs.

### 7) Blocks → buildings

For every resulting block:

*   Shrink by 1 tile (sidewalk buffer).
*   With weighted choice:
    *   **Residential** (60%): Fill with one or two rectangles; punch 1–2 `+` doors to street/alley. 20% chance of inner courtyard (`" grass`), 10% chance of `%` rubble lot.
    *   **Public** (15%): Guild hall, library, guardhouse — pick a larger single rect; add 2 doors on different sides; consider a tiny forecourt.
    *   **Park/pond** (10%): `" grass` with meandering `~` 5–20 tiles long; fence with low walls (`#`) and 2 gates.
    *   **Market annex** (10%): Small shops (`s`) or stands on a side street (just decorate; no special rules).
    *   **Special** (5%): `>` stairs down (dungeon), `B` black market _annex_ (if the plaza B already placed, turn into “fence” stall), or a **ruin** (roofless `%` with broken walls).
*   Wherever a building edge meets a street, 10–20% chance to add a **1-tile arcade**: inset the wall one tile to form a shelter.

### 8) Connectivity & flow guarantees

*   Run a BFS from the plaza over passable tiles:
    *   Any gate not reached? **Promote** one adjacent BSP boundary to a street and carve it.
    *   Any large block without a door? Add a door on the longest edge facing a street.
*   Ensure **2 disjoint paths** from plaza to at least 2 gates:
    *   Compute edge-disjointness via simple “remove one path, check reachability”. If only one exists, carve an extra alley on a different corridor.

### 9) Dressing & Angband flavor

*   Scatter `%` rubble near walls and in 1–2 alley clusters.
*   Replace a few straight street segments with short **porticos** (2-tile roof illusion: top row `#`, bottom row `.` + `+`).
*   Lamps `*` every ~7–9 tiles along boulevards; fewer on alleys.
*   Rare (5%) **secret back door** on shop ring: door glyph still `+`, but behind a 1-tile service alley.

### 10) Final pass: smoothing

*   Convert isolated `.` pockets behind buildings into `,` (alley) for visual hierarchy.
*   Straighten single-tile nibs on walls.
*   Optional: flood-fill parks with `" grass` so they read as coherent shapes.

* * *

Pseudocode (compact)
====================

```python
def gen_town(seed, W=100, H=63):
    rng = RNG(seed)
    g = Grid(W, H, fill='#')

    # 1) walls & gates
    gates = [(W//2,0), (W//2,H-1), (0,H//2), (W-1,H/2)]
    for gx,gy in gates: carve_gate(g, gx, gy, width=3)

    # 2) boulevards
    center = (W//2, H//2)
    for gx,gy in gates:
        path = biased_manhattan_path((gx,gy), center, rng, jitter=0.15, keep_ortho=True)
        carve_polyline(g, path, width=3, tile='.')

    # 3) plaza & shop ring
    plaza = center_rect(center, w=18, h=12)
    fill_rect(g, plaza, '.'); decorate_plaza(g, plaza, rng)
    shops = ring_rects_around(plaza, depth=3, door_to='plaza', gaps=2)
    assign_shops(shops, fixed_order_list, rng)
    for r in shops: place_building(g, r, door_to='plaza_and_side')

    # 4) BSP blocks
    buildable = polygon_inside_walls_minus([plaza] + shops, W, H)
    blocks = ortho_bsp(buildable, BLOCK_MIN, BLOCK_MAX, rng)
    streets = carve_splits_as_streets(g, blocks.splits, rng)

    # 5) populate blocks
    for b in blocks.rects:
        kind = weighted_choice(rng, res=0.6, public=0.15, park=0.10, market=0.10, special=0.05)
        place_block_content(g, b, kind, rng)

    # 6) connectivity checks
    ensure_reachability(g, plaza, gates, rng)
    ensure_two_disjoint_plaza_to_gate(g, plaza, gates, rng)

    # 7) dressing & smoothing
    sprinkle_rubble(g, rng); place_lamps(g, streets, rng)
    convert_dead_pockets_to_alleys(g); straighten_walls(g)
    return g
```

* * *

Tuning knobs (to keep the feel)
===============================

*   **Orthogonality bias** (A\*): keep ≥85% orthogonal to echo Angband.
*   **Street/Alley ratio**: more alleys ⇒ grittier feel, fewer = cleaner “planned” town.
*   **Shop ring depth**: `2–3` tiles reads very Angband; >3 starts to feel like fortress blocks.
*   **Block min/max**: smaller min yields more labyrinthine neighborhoods.
*   **Lamp spacing**: shorter spacing makes it read more “civilized”.

* * *

Why this feels like Angband (but bigger)
========================================

*   Central cross + plaza + surrounding shops is the core Angband rhythm.
*   Orthogonal BSP keeps right-angled blocks and repeatable silhouettes.
*   Fixed _relative_ shop ordering triggers recognition while allowing scale/variety.
*   Alleys, rubble, and a couple of specials add roguelike texture without turning it into a dungeon.

* * *

If you want, I can drop a tiny reference implementation (Python) that spits out ASCII so you can iterate on the weights quickly.
