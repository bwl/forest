# Awesome Idea: The Gauntlet Dungeon

## Concept

The Gauntlet is a special, optional dungeon that offers a pure, high-stakes roguelike experience centered around a "push your luck" mechanic. It features an infinite number of procedurally generated floors, each more difficult than the last. The player can leave at designated points, securing their loot. But if they die at any point, everything they've gathered on that run is lost forever. It's the ultimate test of risk versus reward.

## Core Mechanics

1.  **The Entrance:**
    *   The Gauntlet could be a unique POI on the world map, perhaps a shimmering portal or an ominous, ever-open chasm.
    *   Entering the Gauntlet is a commitment. The player cannot leave until they reach a designated "Exit Chamber."

2.  **Infinite, Scaling Floors:**
    *   Each floor is procedurally generated with a theme that might shift every few levels (e.g., `Floors 1-5: Caverns`, `Floors 6-10: Sunken Library`, `Floors 11-15: Volcanic Forge`).
    *   Enemy difficulty, density, and complexity scale aggressively with each floor.
    *   Loot quality and rarity also scale, making deeper floors incredibly tempting.

3.  **The Exit Chamber:**
    *   Every 5th floor (or a similar interval) is a special "Exit Chamber."
    *   This is a safe room with no enemies. It contains two things:
        *   **A Portal Home:** The player can use this to leave the Gauntlet, instantly teleporting back to their camp with all the loot they have gathered *on that run*.
        *   **Stairs Deeper:** A staircase leading to the next, more dangerous set of floors.
    *   This creates a clear, agonizing decision point: Do I cash out with what I have, or do I risk it all for the promise of better rewards below?

4.  **The "All or Nothing" Rule:**
    *   This is the heart of the Gauntlet. If the player's HP drops to zero on any floor, they are immediately ejected from the dungeon.
    *   They lose **all items, gold, and resources** they collected during that specific Gauntlet run.
    *   Their Amulet of Reset still works (they respawn at camp), but the loot from the run is gone forever. This makes death inside the Gauntlet feel incredibly impactful, even in the late game.

5.  **Leaderboards & Bragging Rights:**
    *   The Gauntlet keeps track of the deepest floor the player has ever reached.
    *   This can be displayed in the player's journal or on a physical leaderboard object at the camp.
    *   This provides a powerful intrinsic motivation for players to push their limits and try to beat their own records.

## Gameplay & Narrative Impact

*   **Pure Risk/Reward:** The Gauntlet distills the roguelike experience down to its essence. It's a constant, thrilling calculation of risk.
*   **Repeatable Endgame Content:** It provides a source of infinite, challenging content for high-level players who have exhausted other parts of the game.
*   **Resource Sink & Gamble:** It's a place for players to spend their hard-earned resources (potions, scrolls, gear durability) in the hopes of getting an even greater return.
*   **Testing Ground:** The Gauntlet is the perfect place for players to test the true limits of their character builds.
*   **Lore:** The Gauntlet can be framed as a test from a god, a chaotic anomaly, or an ancient proving ground, with its own set of lore and mysteries.

## Implementation Sketch

*   **Data:**
    *   A separate set of `gauntlet_loot_tables.toml` and `gauntlet_spawn_tables.toml` that scale aggressively with a `floor_level` variable.
*   **Systems:**
    *   When the player enters the Gauntlet, a `GauntletRun` state is created, which includes a temporary, separate inventory for the loot gathered inside.
    *   The `DungeonGenerationSystem` uses the Gauntlet-specific tables.
    *   If the player uses an Exit Chamber portal, the contents of the `GauntletRun` inventory are transferred to their main inventory.
    *   If the `PlayerDeathSystem` fires while the `GauntletRun` state is active, it simply deletes the temporary inventory and ejects the player.
*   **UI:** The main HUD should have a clear indicator that the player is inside the Gauntlet and that normal death rules are suspended. A floor counter (`Gauntlet Level: 17`) is essential.
