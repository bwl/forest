# Awesome Idea: The Taming System & The Bestiary

## Concept

This system provides a compelling alternative to simply killing every creature the player encounters. It introduces a deep mechanic for capturing and taming the world's wild beasts. Every creature tamed becomes a permanent companion that can be used for labor or combat, and every successful capture contributes to filling out the pages of an in-game Bestiary, creating a satisfying "gotta catch 'em all" loop of discovery.

## Core Mechanics

### 1. The Taming Process

Taming is an active, skill-based process, not just a random roll.

*   **Weakening the Beast:** A creature must be weakened (e.g., below 25% health) before a taming attempt can be made.
*   **Crafted Traps & Lures:** The player must use items crafted via their Survival or Crafting skills.
    *   `Snare Trap:` A simple trap for small, low-level creatures.
    *   `Cage Trap:` A heavy, resource-intensive trap for larger beasts.
    *   `Elemental Lure:` A special bait that is more effective against creatures of a specific type (e.g., a `Frost-Laced Lure` for taming ice-based creatures).
*   **The Taming Skill:** A new `Animal Husbandry` or `Taming` skill influences the success chance. Higher skill allows the player to tame stronger creatures and reduces the chance of the trap breaking.
*   **The Capture:** Once a weakened beast triggers a trap, a taming mini-game or a quick-time event might occur. Success means the beast is pacified and instantly transported to the player's camp.

### 2. The Bestiary

The Bestiary is an in-game encyclopedia that the player fills out over time. It's the ultimate record of their mastery over the natural world.

*   **Unlocking Entries:** A creature's entry is only unlocked after the player successfully tames it for the first time.
*   **Detailed Pages:** Each entry contains rich information:
    *   An ASCII portrait of the creature.
    *   **Lore & Behavior:** Flavor text describing the creature's habits and place in the ecosystem.
    *   **Habitat:** A list of known biomes and dungeons where this creature can be found.
    *   **Combat Stats:** Once researched (tying into the Research System), this section fills out with detailed stats, weaknesses, and resistances.
    *   **Utility Skills:** A list of the tasks the creature can perform at the camp (e.g., `Farming: Tier 2`, `Mining: Tier 1`).
*   **Completion Rewards:** Completing a whole category of the Bestiary (e.g., taming all wolf-type creatures) might grant the player a permanent passive bonus or a unique crafting recipe.

## Gameplay & Narrative Impact

*   **A New Way to Play:** This system allows for a completely different playstyle. A `Tamer` character might focus on stealth, traps, and non-lethal takedowns, viewing the world as a living collection rather than a series of threats.
*   **Drives Exploration:** The desire to "complete the Bestiary" is a powerful motivator for players to seek out every biome and dungeon in the world to find rare creatures.
*   **Knowledge is Power:** The Bestiary is not just a sticker book. It is a vital source of tactical information. A player who has tamed and studied a creature will have a significant advantage when fighting it in the future.
*   **Creates a Collector's Loop:** The hunt for a rare, elusive beast to complete a section of the Bestiary is a classic and incredibly compelling gameplay loop.

## Implementation Sketch

*   **Data:**
    *   `creatures.toml`: Each creature has a `tameable = true` flag, a `taming_difficulty` score, and a list of `preferred_lures`.
    *   `bestiary.toml`: Contains all the lore, stats, and utility information for each creature. This data is locked until the player meets the unlock conditions.
*   **Systems:**
    *   A `TamingSystem` handles the logic for capture attempts, checking the creature's health, the trap's strength, and the player's skill level.
    *   The `BestiarySystem` tracks which creatures have been tamed and reveals the corresponding entries in the UI.
*   **UI:** A beautiful, well-organized Bestiary screen is essential. It should feel like flipping through the pages of a real naturalist's journal, with sketches, handwritten notes, and detailed diagrams.
