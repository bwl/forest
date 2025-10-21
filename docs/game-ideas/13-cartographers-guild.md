# Awesome Idea: The Cartographer's Guild

## Concept

The Cartographer's Guild is a neutral, scholarly faction obsessed with a single goal: to create a perfect, complete map of the world. They are not interested in the petty squabbles of the other factions, only in exploration and discovery. The player can sell their map data to the Guild, turning the very act of exploration into a rewarding and viable progression path.

## Core Mechanics

1.  **The Guild Hall:**
    *   The Guild has a small, neutral outpost in a central location, or they might have representatives in major faction hubs.
    *   This is where the player interacts with them, turns in maps, and buys specialized gear.

2.  **Selling Map Data:**
    *   As the player explores, their personal map fills out. The `MapData` they uncover is a resource.
    *   The player can visit a Guild representative and "Sell Cartographic Data." The system calculates the value based on:
        *   **New Tiles Explored:** A small payment for each new tile revealed.
        *   **POIs Discovered:** A larger bonus for discovering new dungeons, ruins, faction camps, or rare biomes.
        *   **Dungeon Depth:** A multiplier for data from deeper, more dangerous dungeon levels.
        *   **Completeness Bonus:** A huge reward for turning in a 100% complete map of a specific dungeon or region.

3.  **Guild Currency & Rewards:**
    *   The Guild pays in a unique, non-gold currency: **Surveyor's Marks**.
    *   Marks can be used to purchase exclusive, exploration-themed gear from the Guild's quartermaster:
        *   **Climbing Gear:** Unlocks access to mountain passes or lets the player create shortcuts.
        *   **Grappling Crossbow:** Allows crossing small chasms or reaching high ledges.
        *   **Ever-burning Torches:** A permanent, magical light source.
        *   **Maps to the Unknown:** The Guild sells expensive, fragmented maps that hint at the location of hidden treasures, rare resource nodes, or secret dungeons.
        *   **Surveyor's Eyeglass:** A tool that reveals more detailed information about a tile when examining it.

4.  **Guild Reputation:**
    *   Selling data increases the player's reputation with the Guild.
    *   Higher ranks unlock access to better gear, more detailed treasure maps, and unique quests.
    *   **Quests:** The Guild might ask the player to:
        *   "Verify the location of the Sunken Crypt."
        *   "Chart a safe passage through the Emberkin-controlled Badlands."
        *   "Plant a surveyor's beacon on the highest peak in the Frostfang Mountains."

## Gameplay & Narrative Impact

*   **Rewards Exploration:** This system directly rewards a core roguelike activity. Players who love to explore and meticulously clear every corner of the map now have a dedicated progression path.
*   **Alternative Playstyle:** It provides a viable alternative to grinding combat or crafting for income. A stealthy, survival-focused character could make a living as a Guild-affiliated explorer.
*   **Creates New Goals:** The desire for Surveyor's Marks and the gear they unlock gives players new, self-directed goals. "I need 50 more Marks to afford that climbing gear, so I'm going to go map the Whispering Fen."
*   **Neutral Hub:** The Guild Hall can serve as a safe, neutral meeting place, and a source of lore and rumors about the world from a non-partisan perspective.
*   **Faction Interaction:** The other factions might view the Guild with suspicion or try to use them. The Emberkin might try to steal maps of Verdant territory, creating new quest opportunities for the player.

## Implementation Sketch

*   **Data:**
    *   The player entity has a `KnownTiles` component that tracks every tile they have visited.
    *   The `CartographersGuild` world entity tracks which tiles have already been "sold" to them.
*   **Systems:**
    *   When the player interacts with a Guild NPC, the `MapSellingSystem` compares the player's `KnownTiles` with the Guild's `KnownTiles`.
    *   It calculates the value of the new data, awards Surveyor's Marks, and updates the Guild's map.
*   **UI:**
    *   A dedicated vendor screen for the Guild Quartermaster, using Marks as currency.
    *   The world map UI could have a filter to show which areas have been fully explored and sold.
