# Awesome Idea: Terraria-Style World Progression

## Concept

This system gates player progression not just by character level or quests, but by the very materials they can harvest from the world. Inspired by Terraria, the world is stratified into tiers of resources. To access the next tier, the player must first master the current one, creating a compelling and tangible cycle of exploration, crafting, and discovery.

## Core Mechanics

### 1. Tiered Materials & Biomes

The world's resources are divided into clear tiers. Each tier is primarily found in specific biomes or at certain dungeon depths.

*   **Tier 1 (Surface / Chapter 1-2):**
    *   **Wood:** Oak, Birch
    *   **Ores:** Copper, Tin
    *   **Stone:** Basic Stone
    *   **Found:** Overworld forests, shallow caves.

*   **Tier 2 (The Deeps / Chapter 3):**
    *   **Wood:** Yew, Ironwood
    *   **Ores:** Iron, Silver
    *   **Stone:** Granite
    *   **Found:** Deeper underground, Emberkin territories, haunted forests.

*   **Tier 3 (The Core / Chapter 4):**
    *   **Wood:** Petrified Wood, Elderwood
    *   **Ores:** Gold, Mithril
    *   **Stone:** Obsidian
    *   **Found:** Near lava layers, ancient ruins, Tideborn mystical groves.

*   **Tier 4 (The Unfathomable / Chapter 5):**
    *   **Wood:** Star-Metal Infused Wood
    *   **Ores:** Adamantite, Orichalcum, Star-Metal
    *   **Stone:** Cursed Stone
    *   **Found:** In areas affected by world events (meteor craters), the deepest parts of the world, or inside legendary dungeons like Angband.

### 2. The "Pickaxe Gate"

This is the central gating mechanism. A tool's ability to harvest a resource is determined by its **Mining Power** or **Harvesting Level**.

*   A **Copper Pickaxe** (Tier 1) can mine Copper and Tin, but it will just chip uselessly against an Iron Ore vein.
*   To mine **Iron Ore** (Tier 2), you *must* first craft a **Bronze Pickaxe** (from Copper and Tin) or a better Tier 1 pickaxe.
*   This creates a clear, intuitive progression: `Explore -> Mine Tier 1 -> Craft Tier 1 Gear -> Mine Tier 2 -> Craft Tier 2 Gear -> etc.`
*   This applies to other tools as well: you might need an **Iron Axe** to chop down Ironwood trees.

### 3. Crafting as the Key

Your ability to progress is directly tied to your crafting capabilities. The crafting bench and forge become the most important places in your camp.

*   New tiers of ore unlock new sets of armor, weapons, and tools.
*   An **Iron Armor Set** provides the defense needed to survive the deeper, more dangerous areas where Tier 3 ores are found.
*   This makes the **Mining -> Smelting -> Crafting** loop the absolute core of the player's power progression.

## Gameplay & Narrative Impact

*   **Clear Goals:** The player always has a clear, tangible goal: "I need to find Silver so I can make a Silver Pickaxe, which will let me mine Gold." This is a very powerful motivator.
*   **Drives Exploration:** The need for new materials naturally pushes the player out of their comfort zone and into more dangerous territories.
*   **Sense of Accomplishment:** Breaking into a new tier of materials feels like a major achievement. Crafting your first full set of Mithril armor is a huge power spike and a memorable moment.
*   **Integrates with Factions:** Factions can control territories rich in certain materials. The Emberkin might control the only mountains with Adamantite, making diplomacy or war a necessity for endgame gear.

## Implementation Sketch

*   **Data (`materials.toml` & `nodes.toml`):**
    ```toml
    # In the ore/tree node definition
    [node.iron]
    harvest_tier_req = 2
    
    # In the tool definition
    [item.pickaxe.copper]
    harvest_tier = 1
    ```
*   **Systems:**
    *   The `MiningSystem` (or `HarvestingSystem`) is simple: `if tool.harvest_tier >= node.harvest_tier_req`, then the action succeeds. Otherwise, it fails with a message like "Your pickaxe isn't strong enough."
    *   The world generation system is responsible for placing the correct tier of nodes at the appropriate depths and in the correct biomes.
*   **UI:** The tooltip for a resource node should clearly show what tier of tool is required to harvest it, especially if the player's current tool is insufficient.
