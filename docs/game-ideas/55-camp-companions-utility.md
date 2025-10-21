# Awesome Idea: Camp Companions & Utility Roles

## Concept

This system gives a clear and powerful purpose to the creatures captured via the Taming System. Tamed beasts are not just pets or combatants; they are an essential part of your stronghold's workforce. Each creature has a set of innate **Utility Skills**, and they can be assigned to specific camp structures to automate production, provide passive buffs, and contribute to the growth of your realm.

## Core Mechanics

### 1. Creature Utility Skills

Every tamable creature has one or more Utility Skills, rated by tier (1-3).

*   **Examples of Skills:**
    *   `Mining`: Can be assigned to a quarry to generate stone or ore.
    *   `Lumbering`: Can be assigned to a logging camp to generate wood.
    *   `Farming`: Can be assigned to a farm to plant and harvest crops.
    *   `Transport`: Increases the efficiency of internal camp logistics (acts as a Hauler).
    *   `Kindling`: Can be assigned to a forge or kiln to reduce fuel costs or speed up smelting.
    *   `Medicine`: Can be assigned to an infirmary to speed up the healing of injured NPCs.
    *   `Cooling`: Can be assigned to a granary to slow food spoilage.

*   **Creature Specialization:** Different creatures excel at different tasks.
    *   A `Giant Beetle` might have `Mining: Tier 2` but no other skills.
    *   A `Fire Salamander` would have `Kindling: Tier 3`.
    *   A gentle, ox-like creature might have `Farming: Tier 2` and `Transport: Tier 1`.

### 2. The Assignment System

*   The player manages their tamed beasts from a `Menagerie` or `Pasture` structure in their camp.
*   This UI shows a list of all captured creatures and a list of all available work slots in the camp's structures.
*   The player can drag and drop a creature into a valid work slot. For example, you can assign a `Fire Salamander` to the `Forge`, but not to the `Farm`.
*   The efficiency of the structure is then boosted based on the assigned creature's skill tier.

### 3. Passive Generation & Buffs

*   Once assigned, the creature works automatically in the background.
*   **Resource Generation:** A `Giant Beetle` with `Mining: Tier 2` assigned to the `Quarry` might passively generate `10 Stone` every in-game day.
*   **Process Enhancement:** A `Fire Salamander` with `Kindling: Tier 3` assigned to the `Forge` might make smelting `Iron Bars` 50% faster.
*   **Camp-wide Buffs:** Some creatures might provide a passive aura. A `Glow-Moth` assigned to the camp center could provide a small, camp-wide morale boost at night.

## Gameplay & Narrative Impact

*   **Makes Taming Strategic:** The player isn't just catching creatures they think are cool; they are actively hunting for beasts with the specific Utility Skills needed to optimize their production chains.
*   **A Living, Working Camp:** This system makes the camp feel incredibly alive. The player can see their tamed creatures moving around, performing their assigned tasks. The Fire Salamander is curled up by the forge; the Giant Beetle is hauling rocks from the quarry.
*   **Deepens Economic Gameplay:** Optimizing your workforce of tamed beasts becomes a core economic puzzle. Do you use your best miner to get more raw ore, or your best kindler to process that ore into bars faster?
*   **Creates a New Progression Vector:** Finding and taming a creature with a Tier 3 Utility Skill is a massive upgrade for your entire settlement, and feels just as significant as finding a legendary sword.

## Implementation Sketch

*   **Data:**
    *   In `creatures.toml`, each creature has a `utility_skills` table: `utility_skills = { Mining = 2, Transport = 1 }`.
    *   In `structures.toml`, each building has a list of `accepted_utility_skills` and a number of `work_slots`.
*   **Systems:**
    *   A `CampWorkforceSystem` runs on a daily tick.
    *   It iterates through all assigned creatures and applies their effects (e.g., adds resources to the camp bank, applies a temporary buff to a crafting station).
*   **UI:** The Menagerie UI is the central hub for this system. It needs to clearly show each creature's skills and allow for easy assignment to open work slots.
