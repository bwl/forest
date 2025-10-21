# Awesome Idea: The Mount System

## Concept

This system allows the player to turn their larger tamed beasts into loyal mounts for overworld travel. By crafting a saddle and training a suitable creature, the player can gain a significant boost to their exploration speed, carry more loot, and even traverse terrain that would be impassable on foot. Finding, taming, and raising the perfect mount becomes a major mid-game objective and a huge quality-of-life reward.

## Core Mechanics

### 1. Mountable Creatures

*   Only a specific subset of tamable beasts can be used as mounts. These are typically large, sturdy, and fast creatures.
*   **Examples:**
    *   `Great Boar:` Fast on flat land, can charge through small obstacles.
    *   `Giant Wolf:` Very fast, excels in forests and plains.
    *   `Riding Lizard:` Slower, but has the unique ability to cross shallow rivers and swamps.
    *   `Mountain Goat:` Slower on flat land, but can climb steep hills and mountainsides, opening up new areas.
*   Each potential mount has stats for `Speed`, `Stamina`, and `Carry Capacity`.

### 2. Taming & Training

*   The process starts with the **Taming System**. The player must first capture a wild, mountable beast.
*   Next, the player must craft a **Saddle** specific to that creature type (e.g., `Boar Saddle`, `Wolf Saddle`) at a `Tannery` or `Leatherworking Station`.
*   Finally, the beast must be "trained." This could involve a short series of quests, a resource investment, or simply assigning the beast to a `Training Post` at the camp for a period of time.

### 3. Overworld Travel

*   The player can summon their active mount in the overworld.
*   **Increased Speed:** The player's movement speed on the world map is significantly increased, reducing travel time between locations.
*   **Saddlebags:** The mount provides a separate inventory, allowing the player to haul more resources back from long expeditions.
*   **Mounted Combat (Optional/Lite):** While on a mount in the overworld, the player might be able to perform a basic `Charge` attack to break through weak enemies or initiate combat with an advantage. Tactical, grid-based combat would still occur on foot.

### 4. Unique Traversal Abilities

This is what makes different mounts strategically interesting.

*   A `Riding Lizard` allows you to access the resources of a swamp without building a bridge first.
*   A `Mountain Goat` lets you explore high-altitude regions and find shortcuts, bypassing a long and dangerous canyon.
*   A late-game `Gryphon` mount might even allow for limited flight between high peaks.

## Gameplay & Narrative Impact

*   **A Major Quality-of-Life Upgrade:** The world feels much larger and more accessible once the player gets their first mount. It's a significant and memorable power spike.
*   **Drives New Exploration Goals:** The desire for a specific mount with a unique traversal ability becomes a powerful motivator. "I need to find and tame a Mountain Goat so I can finally explore the Dragon's Tooth peaks."
*   **Makes Taming More Rewarding:** It adds another layer of utility and excitement to the taming system. You're not just capturing a worker; you're capturing a potential steed.
*   **Personal Connection:** Players often form a strong bond with their mount. It's their trusted companion on long journeys, and the idea of protecting it from harm adds an emotional stake to travel.

## Implementation Sketch

*   **Data:**
    *   In `creatures.toml`, mountable beasts have a `[mount_stats]` table with `speed_bonus`, `inventory_slots`, and `special_traversal` (e.g., `river_walking`).
*   **Systems:**
    *   The `OverworldMovementSystem` checks if the player is mounted and applies the speed bonus.
    *   The `InventorySystem` needs to be able to access both the player's and the mount's inventory.
    *   The `MapSystem` checks the player's `special_traversal` abilities against the terrain type of a tile to determine if they can enter it.
*   **UI:** When on the world map, a small UI element showing the current mount and its stamina/health should be visible. The inventory screen should have a clear tab to switch between the player's pack and the mount's saddlebags.
