# Awesome Idea: The Automated Stronghold & NPC-Driven Logistics

## Concept

This system marks the player's transition from an adventurer who crafts their own gear to a leader who designs and manages the engine of their entire realm. Inspired by factory automation games, this system allows the player to set up complex production chains that are carried out automatically by their NPCs and camp facilities. The challenge shifts from resource gathering to systems design, logistics, and optimization.

## Core Mechanics

### 1. The Planner Mode & Blueprints

*   Instead of placing individual structures, the player enters a "Planner Mode" overlay for their camp/stronghold.
*   In this mode, they design **Blueprints** for industrial wings (e.g., a `Forge District`, a `Farming Complex`). They don't place the buildings themselves; they designate the area and the layout.
*   **NPC Builders** are then assigned to the blueprint. They will automatically gather the required wood and stone from the camp bank and construct the buildings over time.

### 2. Production Chains & Work Orders

*   The player doesn't craft individual swords. They create **Work Orders** at a `Command Table` structure.
*   **Example Work Order:** `Produce 10 Iron Longswords`.
*   The system then automatically generates a list of required materials (`100 Iron Bars`, `20 Leather Strips`).
*   **NPC-driven Logic:**
    1.  The **Blacksmith NPC** receives the order.
    2.  They check the camp bank for `Iron Bars`.
    3.  If there aren't enough, they automatically create a sub-order for the **Smelter NPC** to produce `100 Iron Bars`.
    4.  The Smelter NPC checks for `Iron Ore`. If there isn't enough, a warning is flagged to the player: `"Stall: Iron Ore reserves empty."`

### 3. NPC-Driven Logistics (The "Conveyor Belts")

This is how resources move at scale, replacing manual transport.

*   **Internal Logistics:**
    *   The player assigns **Hauler NPCs** to the camp.
    *   Their job is to move finished goods to the correct storage. E.g., move `Iron Bars` from the Smelter's output to the main bank, or move `Cooked Meals` from the Kitchen to the Granary.
*   **External Logistics:**
    *   The player establishes **Supply Routes** on the world map.
    *   **Example Route:** `Assign "Mining Crew Alpha" to the Iron Peak Mine.` -> `Assign "Caravan Beta" to run between Iron Peak Mine and The Stronghold.`
    *   This creates a steady, automated inflow of `Iron Ore` to the camp, which then feeds the production chains.
    *   These routes are vulnerable to ambushes and require guards!

### 4. The Logistics Map

*   A new UI screen that shows a schematic of your entire production network.
*   It visualizes the flow of resources, from remote mines to caravans to workshops to storage.
*   It highlights **bottlenecks** (e.g., not enough smelters to keep up with ore inflow), **stalls** (missing resources), and **inefficiencies** (haulers have to walk too far).
*   The player's job is to look at this map and solve these logistical puzzles.

## Gameplay & Narrative Impact

*   **Shift in Scale:** The player truly feels like a leader. Their focus moves from their own inventory to the entire supply chain of their kingdom.
*   **Deep Endgame Puzzle:** Optimizing production chains becomes a deeply engaging endgame activity. Building a perfectly efficient, self-sustaining stronghold is a victory in itself.
*   **Real Strategic Consequences:** A well-designed war machine can autonomously outfit armies. A poorly designed one will grind to a halt, leaving your soldiers without swords or food.
*   **Makes NPCs Essential:** This system gives a clear and vital purpose to every NPC in the camp. They are the cogs in the machine you have designed.

## Implementation Sketch

*   **Data:**
    *   `structures.toml`: Defines buildings, their function (`smelter`, `forge`), their production speed, and their NPC slot capacity.
    *   `chains.toml`: Defines the steps for complex items (e.g., a `Steel Sword` requires `Steel Bars`, which requires `Iron Bars` and `Coal`).
*   **Systems:**
    *   A `ProductionManagerSystem` runs on a slow tick. It checks active Work Orders and assigns tasks to available, idle NPCs with the correct role (`Smith`, `Smelter`).
    *   A `LogisticsSystem` manages Haulers and Caravans, moving items between designated storage containers based on supply and demand.
*   **UI:** The Logistics Map is the key UI component. It needs to be a clear, node-based diagram showing the flow of goods and highlighting problems.
