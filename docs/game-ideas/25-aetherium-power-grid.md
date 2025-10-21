# Awesome Idea: The Aetherium Power Grid

## Concept

This system introduces a magical energy resource, **Aetherium**, that functions as the "electricity" for your advanced civilization. In the late-game (Chapter 4+), the most powerful crafting stations, defensive structures, and magical devices will require a constant supply of Aetherium to operate. This creates a new strategic layer of infrastructure management: generating power, distributing it, and defending your power grid.

## Core Mechanics

### 1. Aetherium Generation

Aetherium is not mined; it is harnessed from the environment.

*   **Aetheric Siphons:** These are complex structures that can only be built on specific, rare locations on the world map:
    *   **Ley Line Nodes:** Points where magical energy naturally pools.
    *   **Ancient Ruins:** The remnants of a previous civilization's power grid.
    *   **Rifts to the Fugue Plane:** Unstable portals that leak raw magic.
*   Each Siphon generates a fixed amount of Aetherium (`A/tick`).
*   Building and defending these Siphons becomes a major strategic priority.

### 2. Aetherium Distribution

Generated Aetherium must be transported to where it's needed.

*   **Aetheric Relays:** These are smaller, cheaper structures that act as power poles. The player places them on the world map to create a grid.
*   **The Grid:** A structure is considered "powered" if it is within the radius of a Siphon or a Relay that is connected to a Siphon. The grid has a maximum range and can suffer from "power loss" over long distances, requiring booster relays.
*   **Visualizing the Grid:** In the "Planner Mode" or on the world map, the grid can be visualized as faint, glowing lines connecting the relays, with a different color for powered vs. unpowered sections.

### 3. Aetherium Consumption

Many late-game structures become consumers on the power grid.

*   **Rune Forge:** Required for the Rune Word crafting system. Consumes a large amount of Aetherium.
*   **Alchemical Engine:** Automates the creation of high-tier potions.
*   **Teleportation Circle:** Allows instant travel between two powered circles, but consumes a massive amount of Aetherium per use.
*   **Arcane Wards:** Powerful defensive structures that project a shield over your stronghold, damaging hostile units that pass through. They are a constant drain on the grid.
*   **The Amulet of Reset:** Perhaps the Amulet itself requires the camp to be powered by Aetherium to function in the late game, raising the stakes significantly.

### 4. Power Management

*   The total Aetherium consumed cannot exceed the total generated. If consumption is too high, **brownouts** occur.
*   **Brownouts:** Structures on the grid will flicker on and off, work at reduced efficiency, or shut down entirely, starting with those furthest from a power source.
*   The player must balance their power budget, deciding what to build and when to bring new Siphons online.

## Gameplay & Narrative Impact

*   **New Strategic Layer:** The game gains a new dimension beyond resource logistics and army management. The layout of your power grid is as important as the layout of your walls.
*   **Critical Vulnerabilities:** The grid creates high-value targets for enemy factions. A rival could cut off power to your entire kingdom by destroying a single, remote Siphon or a key Relay, creating a new type of quest (e.g., "Restore power to the Western Front").
*   **Drives Conflict:** The scarcity of Ley Line Nodes will make them hotly contested territories, driving major faction wars.
*   **Satisfying Growth:** Powering up a new district of your stronghold and seeing the lights turn on provides a huge sense of accomplishment and visual progress.

## Implementation Sketch

*   **Data:**
    *   `structures.toml`: Structures can have a `power_consumption` field.
    *   `map_nodes.toml`: Defines the locations of Ley Line Nodes.
*   **Systems:**
    *   A `PowerGridSystem` runs on a slow tick.
    *   It calculates the total power generation from all Siphons.
    *   It uses a graph traversal algorithm (like Breadth-First Search) starting from the Siphons to determine which Relays and structures are connected and powered.
    *   It compares generation to consumption and applies brownout effects if necessary.
*   **UI:** A dedicated "Power Grid" map overlay is essential. It should show generation, consumption, and the status of all grid structures, making it easy to identify problems.
