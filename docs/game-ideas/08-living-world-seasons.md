# Awesome Idea: The Living World - Seasons and Events

## Concept

The game world is not a static map; it's a living environment that changes over time. The world cycles through distinct seasons (spring, summer, autumn, winter), each bringing tangible changes to gameplay. This is further enhanced by periodic, random world events that can create new opportunities and threats.

## Core Mechanics

### 1. Seasonal Cycle

Each season lasts for a set number of in-game days (e.g., 30 days) and has a distinct feel and mechanical impact.

*   **Spring:**
    *   **Gameplay:** Increased rainfall, rivers swell (may be harder to cross). Plant life is abundant, making foraging easier. Young, aggressive animals are more common.
    *   **Flavor:** The world feels fresh and full of life. NPCs talk about planting and rebuilding.

*   **Summer:**
    *   **Gameplay:** Long days, short nights. Increased risk of wildfires in forests or drought affecting farms. Some creatures might be less active in the heat of the day.
    *   **Flavor:** A time of vibrant activity. Faction trade caravans are most active.

*   **Autumn:**
    *   **Gameplay:** Harvest time. Food is plentiful from farms and foraging. Nights grow longer. Some animals begin to hibernate, while others become more aggressive as they prepare for winter.
    *   **Flavor:** A sense of urgency and preparation. NPCs talk about stocking up for the winter.

*   **Winter:**
    *   **Gameplay:** Snow blankets the landscape. Rivers and lakes freeze over, creating new paths. Hunger depletes faster due to the cold (requires warmer clothing or campfires). Many creatures are hibernating, but dangerous winter predators (like Yetis or Ice Wolves) emerge.
    *   **Flavor:** A quiet, dangerous, and beautiful world. Travel is difficult, and survival is a key focus.

### 2. World Events

These are rare, random events that can occur at the start of a new season or based on other triggers. They act as temporary world modifiers.

*   **Meteor Shower:** A meteor strikes a region, creating a new, temporary mini-dungeon (a crater) filled with strange creatures and rare, star-metal ore.
*   **The Great Hunt:** A legendary beast is sighted. All factions might compete to hunt it, offering the player a large reward for participating.
*   **The Blight:** A magical plague affects a region. Crops wither, animals become sick and aggressive, and a miasma makes travel dangerous without a special amulet or potion.
*   **The Blood Moon:** For one night, undead creatures rise from their graves all over the world, making travel exceptionally dangerous but offering rare loot for those brave enough to venture out.
*   **The Traveling Merchant:** A mysterious, faction-less merchant appears at your camp, offering exotic goods from faraway lands for a limited time.

## Gameplay & Narrative Impact

*   **Dynamic Strategy:** The player has to adapt their plans to the seasons. A winter campaign against an Emberkin fortress is a very different challenge from a summer one.
*   **World Feels Alive:** The changing seasons and unexpected events prevent the game from feeling static or predictable. The world has its own rhythm, independent of the player.
*   **Emergent Opportunities:** A frozen river might let the player bypass a heavily guarded bridge. A meteor shower might provide the ore needed to craft a legendary weapon.
*   **Resource Management:** The player must think long-term. Stockpiling food in autumn is critical for surviving winter. Building a greenhouse might be the only way to grow herbs year-round.

## Implementation Sketch

*   **Data:**
    *   A global `WorldState` entity tracks the current `season` and `day_in_season`.
    *   `events.toml` file defines possible world events, their triggers, duration, and effects.
    *   Tile data can have seasonal variants (e.g., `grass`, `grass_snow`).
*   **Systems:**
    *   `SeasonalSystem`: Runs once per in-game day. On season change, it applies global modifiers (e.g., `hunger_rate_multiplier`, `frozen_river_tiles`).
    *   `WorldEventSystem`: Rolls for a new event at the start of each season. If an event is triggered, it applies its modifiers and spawns any necessary entities (like a meteor crater POI).
*   **UI:** The main HUD should have a small indicator for the current season (e.g., 🌸, ☀️, 🍂, ❄️). Event notifications would appear in the main log.
