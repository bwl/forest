# Awesome Idea: Symbiotic Biomes & Procedural Ecology

## Concept

This system treats dungeon biomes not as static, pre-defined themes, but as living ecosystems that interact with each other. Biomes have needs, produce resources, and can grow, shrink, or transform based on their neighbors. This creates a dynamic, large-scale underground world where the player can witness ecological change over time and even manipulate it to their advantage.

## Core Mechanics

### 1. Biomes as Entities

Each biome in a dungeon level is treated as a logical entity with properties.

*   **Tags:** `[Fungal, Damp, Chitinous, Magical, Volcanic]`
*   **Produces:** `[Spores, Clean Water, MonsterEggs, RawAether]`
*   **Consumes:** `[Light, CorpseMatter, MagicalEnergy]`
*   **Growth/Spread Condition:** The rules under which this biome can expand.

### 2. Symbiotic & Parasitic Relationships

The core of the system is how biomes interact with their neighbors.

*   **Symbiosis (Mutual Benefit):**
    *   A `Glow Mushroom Forest` biome (`Produces: Light`) grows next to a `Shadowbat Cavern` (`Consumes: Light`). The bats thrive in the ambient light, and their guano enriches the soil for the mushrooms. This creates a stable, combined biome.
    *   An `Underground River` biome (`Produces: Clean Water`) flowing through a `Crystal Cave` (`Requires: Clean Water`) will cause the crystals to grow larger and more valuable.

*   **Parasitism (One-sided Benefit):**
    *   A `Corrupted Blight` biome (`Spreads on: LivingMatter`) will actively grow into an adjacent `Lush Cavern` biome, converting its tiles to `Blighted` tiles and transforming its creatures into `Blighted` versions over time.
    *   A `Rust Monster Nest` (`Consumes: Metal`) will slowly degrade the quality of ore veins in an adjacent `Iron Vein` biome.

### 3. Player Intervention

The player is a major ecological force. Their actions can disrupt or encourage these relationships.

*   **Stopping a Spread:** To stop the `Corrupted Blight`, the player might need to perform a `Ritual of Cleansing` at its heart or destroy the central `Blight-Heart` creature.
*   **Cultivating a Biome:** The player could intentionally divert an `Underground River` to flow into a `Crystal Cave` to increase its yield of valuable gems.
*   **Introducing a Species:** Bringing a `Fire Beetle` (which thrives on heat) into a `Cold Cavern` might do nothing, but introducing it to a `Volcanic Fissure` biome could cause its population to explode, creating a new, dangerous ecosystem.

### 4. The Slow Tick Simulation

*   These ecological changes do not happen in real-time. They are simulated on a slow, periodic tick (e.g., once every in-game week).
*   The `BiomeSimulationSystem` checks the adjacency of all biome zones, evaluates their relationships, and applies small, incremental changes to the map.
*   The player might return to a dungeon after a month and find that the small patch of Blight they ignored has now consumed the entire first floor.

## Gameplay & Narrative Impact

*   **A Truly Living World:** The dungeon feels less like a static level and more like a real, evolving place. The world changes even when the player isn't there.
*   **Strategic Environmental Puzzles:** The player can use their knowledge of ecology to their advantage. "I need to stop this Blight, but it's too strong. Maybe if I introduce a Fire-based ecosystem nearby, it will burn it out for me?"
*   **Long-Term Consequences:** Ignoring a seemingly small environmental detail can have massive consequences down the line.
*   **Drives Re-Exploration:** Previously explored dungeons are worth returning to, because they might have changed in interesting and potentially profitable ways.

## Implementation Sketch

*   **Data:**
    *   `biomes.toml`: Defines each biome, its tags, its production/consumption, and its growth rules.
    *   The world map data needs to store not just tile types, but also the logical `biome_id` for each region of a level.
*   **Systems:**
    *   A `BiomeSimulationSystem` runs on a slow tick. It gets a list of all biome zones and their neighbors.
    *   For each pair of adjacent biomes, it checks their relationship rules and applies changes (e.g., `convert_tile`, `spawn_creature`, `modify_resource`).
*   **UI:** The world map could have an overlay that shows the current biome distribution. The player might also find a `Geologist's or Ecologist's Journal` that provides hints about how different biomes interact.
