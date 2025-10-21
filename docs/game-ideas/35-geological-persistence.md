# Awesome Idea: Geological Persistence & Cross-Z-Level Veins

## Concept

This system revolutionizes how dungeons are generated. Instead of creating each floor as an independent, random level, the world generator first establishes a **geological blueprint** for an entire multi-level region. This blueprint maps out large-scale geological features—like massive mineral veins, underground rivers, lava tubes, and giant fossils—that persist and cut across multiple Z-levels. This makes the world feel solid, logical, and deeply immersive, turning mining and exploration into a 3D puzzle.

## Core Mechanics

### 1. The Geological Blueprint

*   Before generating any individual floors, the system generates a 3D noise map (using Perlin, Simplex, or Worley noise) for the entire dungeon region (e.g., a 256x256x50 volume).
*   This noise map defines the location of large-scale features:
    *   **Mineral Veins:** Long, twisting 3D "worms" of valuable ore (`Iron`, `Mithril`, `Star-Metal`).
    *   **Underground Rivers/Aquifers:** Large bodies of water that can create waterfalls, lakes, and rivers that flow from one level down to the next.
    *   **Lava Tubes:** Channels of magma that provide light, heat, and danger across multiple floors.
    *   **Mega-Fossils:** The enormous, fossilized skeleton of a colossal, ancient creature might be embedded in the rock, and the player could find a ribcage on one level and the skull three levels deeper.

### 2. Level Generation with Persistence

*   When the game needs to generate a specific floor (e.g., `The Iron Peak Mine - Level 3`), it first carves out the standard procedural rooms and corridors.
*   Then, it **overlays the geological blueprint**. It checks if any of the pre-defined veins, rivers, or fossils intersect with this Z-level.
*   If a mineral vein passes through the level, the generator replaces the standard rock tiles with the appropriate ore tiles along the vein's path.
*   This ensures that the vein on Level 3 perfectly aligns with the vein on Level 4 below it.

### 3. Gameplay Impact: Strategic Mining & Exploration

*   **Following the Vein:** Mining is no longer a random search. If a player finds a rich vein of `Mithril`, they have a strong incentive to follow it downwards, knowing it will continue on the next level. This creates a clear, player-driven exploration goal.
*   **3D Puzzles:** An underground river might block a passage on one level, forcing the player to go down to a lower level to find a way underneath it, and then come back up.
*   **Foreshadowing:** Seeing a massive, un-mineable ribcage of some long-dead creature on one level creates a sense of awe and mystery, promising the discovery of other parts of the skeleton on deeper levels.
*   **Resource Scarcity:** Because veins are finite and persistent, a player (or a faction) could theoretically mine out an entire vein, permanently depleting that resource from the region. This makes resource nodes feel valuable and non-renewable.

## Implementation Sketch

*   **Data:** The geological blueprint can be stored as a compressed 3D array or generated deterministically from the world seed when needed.
*   **Systems:**
    *   A `GeologyGenerator` runs once when a new multi-level dungeon region is first created, populating the 3D blueprint with features.
    *   The existing `DungeonGenerator` is modified. After its standard procedural pass, it calls a `GeologyStampSystem` that overlays the persistent features for that specific Z-level.
*   **Performance:** The geological blueprint is generated only once. The per-level generation cost is just a quick lookup and tile replacement, making it very efficient.

## Example Player Experience

The player is struggling to find enough Iron to outfit their first squad. In a shallow cave, they discover a small, low-quality iron vein. Remembering a hint from an old miner's journal, they realize this small vein might be an offshoot of a much larger "motherlode." They mark the location on their map and spend the next several game sessions delving deeper and deeper into the cave system, following the trail of iron deposits. Finally, three levels down, they break through a wall into a massive cavern dominated by a colossal, glittering vein of pure iron—the heart of the vein. This discovery provides enough resources to fund their war effort for a month, and it feels earned not through random luck, but through observation, planning, and determined exploration.
