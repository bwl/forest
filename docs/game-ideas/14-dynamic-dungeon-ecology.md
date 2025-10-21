# Awesome Idea: Dynamic Dungeon Ecology

## Concept

Dungeons are not just static sets of rooms and monsters. They are dynamic ecosystems that change over time based on the player's actions and the internal logic of the dungeon's inhabitants. A dungeon you clear today might be completely different when you return in a month, creating a world that feels less like a game level and more like a real, living place.

## Core Mechanics

1.  **The Power Vacuum:**
    *   When the player clears a dungeon of its primary inhabitants (e.g., a tribe of goblins), the dungeon becomes "Unclaimed."
    *   The world simulation will periodically check for unclaimed dungeons and may trigger a "Re-population Event."
    *   **Example:** A goblin-infested cave, once cleared, might be taken over by:
        *   A colony of giant spiders attracted to the dark, empty space.
        *   A rival tribe of kobolds seeking a new lair.
        *   A band of outcasts or a hermit looking for a safe haven.
    *   The new inhabitants will re-decorate, adding their own flavor (webs, crude traps, shrines) to the existing layout.

2.  **Resource-Driven Colonization:**
    *   The resources left behind in a dungeon can influence who moves in next.
    *   **Example:** If the player leaves behind a large number of corpses, the dungeon has a higher chance of being repopulated by carrion-eaters like ghouls or giant rats.
    *   If a dungeon has a natural source of fungus, it might attract fungal creatures or even a reclusive druid.

3.  **Monster Infighting & Factionalism:**
    *   Sometimes, two or more monster factions can inhabit the same dungeon, and they will fight each other, not just the player.
    *   The player might enter a level to find a battle already in progress between orcs and trolls.
    *   This creates tactical opportunities: the player can lure one group into another, pick off the survivors, or side with one faction to gain a temporary ally.

4.  **The "Boss" Effect:**
    *   The leader of a dungeon's population has a significant effect on its ecology.
    *   **Example:** Killing a Goblin Shaman might cause the remaining goblins to lose their magical buffs and become disorganized and more prone to fleeing.
    *   Killing a Spider Queen might cause the smaller spiders to become feral and attack each other.
    *   Conversely, if a new, powerful boss emerges, it might unite disparate monster groups under a single banner.

## Gameplay & Narrative Impact

*   **Replayability:** Dungeons are not "one and done." Returning to a previously cleared area can offer a completely new challenge.
*   **Strategic Choices:** The player's actions have long-term consequences. Do you take the time to clean out every corpse to prevent a ghoul infestation? Do you intentionally leave a food source to attract a specific type of creature you need to hunt?
*   **Living World:** This system makes the world feel incredibly dynamic and alive. The world doesn't wait for the player; it evolves on its own.
*   **Emergent Narratives:** The player might clear a cave to make it safe for a nearby village, only to return later and find it infested with something far worse, creating a new, organic quest.

## Implementation Sketch

*   **Data:**
    *   Each dungeon has a `population` component that lists its current inhabitants, their leader, and their status.
    *   `repopulation_events.toml` defines which monster groups can claim which types of dungeons, and what resources attract them.
*   **Systems:**
    *   A `DungeonEcologySystem` runs on a slow tick (e.g., weekly in-game).
    *   It scans for dungeons marked as "Unclaimed" or with a dead leader.
    *   It then rolls for a repopulation or infighting event based on the dungeon's tags (e.g., `damp`, `fungus_present`) and the resources within it.
*   **Performance:** This system only needs to run on a slow, periodic basis, so it would have a minimal impact on performance. The changes are applied between the player's visits to the dungeon.
