# Awesome Idea: History Simulation & Procedural Ruins

## Concept

This system generates compelling ruins and dungeons by first simulating a brief, abstract history of the location. Instead of using simple pre-made templates like "a ruined tower," the generator layers a series of historical events on top of a base structure. The player then explores the logical aftermath of this simulated history, resulting in unique, story-rich environments where every detail feels like it has a purpose.

## Core Mechanics

### 1. The Base Structure

The generator starts by placing a simple, intact base structure. This could be a `Small Fort`, a `Library`, a `Mining Outpost`, or a `Temple`.

### 2. The Historical Event Simulation

Next, the system applies one or more **Historical Event Modifiers** to the structure. Each modifier is a function that alters the map and places specific items and clues.

*   **Event: `Goblin Raid`**
    *   **Effect:** Breaches outer walls, scatters crude barricades, leaves behind goblin wargear, and adds `graffiti` and `skulls on pikes`.
*   **Event: `Arcane Explosion`**
    *   **Effect:** Creates a central crater, transforms walls into `glass` or `crystal`, scatters `magical dust`, and spawns mutated, magical creatures.
*   **Event: `Sudden Flood`**
    *   **Effect:** Fills lower levels with water, leaves behind `silt` and `waterlogged chests`, and spawns amphibious monsters.
*   **Event: `Plague Outbreak`**
    *   **Effect:** Litters the area with skeletons, `desperate notes` (`"Don't drink the water!"`), and abandoned medical supplies.
*   **Event: `Civil War`**
    *   **Effect:** Divides the location with internal barricades, creates weapon caches for two opposing sides, and leaves behind propaganda leaflets for each faction.
*   **Event: `Decay Over Time`**
    *   **Effect:** Crumbles walls, creates holes in the roof that let in light (and vegetation), and covers everything in `dust` and `cobwebs`.

### 3. Layering Events

The real power of this system comes from layering multiple events. The order matters.

*   **Example 1: A Story of Desperate Defense**
    1.  Base: `Small Fort`
    2.  Event 1: `Goblin Raid` (breaches the walls).
    3.  Event 2: `Plague Outbreak` (the goblins brought a disease).
    4.  Event 3: `Decay Over Time` (the fort has been abandoned for years).
    *   **Result:** The player explores a crumbling, vine-choked fort with goblin skeletons lying next to human ones, and finds notes about a two-front war against invaders and a sickness.

*   **Example 2: A Magical Catastrophe**
    1.  Base: `Library`
    2.  Event 1: `Arcane Explosion` (a ritual gone wrong).
    3.  Event 2: `Sudden Flood` (the explosion ruptured a nearby aquifer).
    *   **Result:** The player finds a flooded, crystalline library filled with magical mutants, where waterlogged books float through shimmering, unstable portals.

## Gameplay & Narrative Impact

*   **Environmental Storytelling:** Every ruin tells a unique, coherent story. The player acts as a forensic archaeologist, piecing together what happened from the environmental clues.
*   **Infinite Variety:** The combinatorial nature of the event system can produce a virtually endless supply of unique dungeons.
*   **Logical Layouts:** The dungeons feel more logical and less random. A barricade is there for a reason. A flooded room makes sense in the context of the location's history.
*   **Drives Exploration:** The desire to see what unique story the next ruin tells becomes a powerful motivator for exploration.

## Implementation Sketch

*   **Data:**
    *   `base_structures.toml`: Contains the blueprints for the initial, intact locations.
    *   `historical_events.toml`: Defines each event modifier, including the changes it makes to tiles, the items it places, and the monsters it spawns.
*   **Systems:**
    *   The `DungeonGenerator` is structured as a pipeline.
    *   First, it calls the `StructurePlacementSystem` to place the base blueprint.
    *   Then, it iterates through a randomly selected list of 1-3 historical events, calling an `EventApplicationSystem` for each one.
    *   This system modifies the map data in place, layering the changes on top of each other.
*   **The Chronicle:** The simulated history of a ruin can be recorded in the **Chronicle System**, providing a written history that the player can discover, confirming the story they pieced together from the environment.
