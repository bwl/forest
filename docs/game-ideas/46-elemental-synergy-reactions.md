# Awesome Idea: Elemental Synergy & Reactions

## Concept

This system transforms elemental damage from a simple resistance check into a deep, tactical web of combinations and reactions. Inspired by games like *Divinity: Original Sin* and *Genshin Impact*, this system allows different elements to interact with each other, creating powerful and often explosive secondary effects. Applying one element can "prime" a target, setting them up for a devastating "detonation" from another.

## Core Mechanics

### 1. Elemental Status Effects

Instead of just dealing damage, elemental attacks apply a corresponding status effect for a short duration.

*   **Fire Attack:** Applies `Burning` (deals damage over time).
*   **Frost Attack:** Applies `Chilled` (slows movement and attack speed). Multiple stacks can lead to `Frozen`.
*   **Lightning Attack:** Applies `Zapped` (reduces resistance to stuns).
*   **Water/Poison Attack:** Applies `Wet` or `Oiled`.
*   **Earth Attack:** Applies `Unsteady` (reduces poise/stagger resistance).

### 2. Elemental Reactions

This is the heart of the system. When a target with one elemental status is hit with a different, reactive element, a special **Reaction** occurs.

*   **Vaporize (`Wet` + `Fire`):** Consumes both effects, deals a massive burst of single-target fire damage.
*   **Ignite (`Oiled` + `Fire`):** Consumes both effects, creates a large, long-lasting pool of fire on the ground.
*   **Electro-Charged (`Wet` + `Lightning`):** Creates a chain lightning effect that arcs to nearby enemies, dealing damage and applying `Wet` to them as well.
*   **Shatter (`Frozen` + `Blunt/Heavy Attack`):** Instantly destroys the `Frozen` status, dealing massive area-of-effect physical damage.
*   **Superconduct (`Frozen` + `Lightning`):** Consumes both effects, applies a powerful debuff that significantly lowers the target's physical damage resistance.
*   **Melt (`Frozen` + `Fire`):** Consumes both effects, deals a massive burst of single-target fire damage (even more than Vaporize).

### 3. Environmental Interaction

This system naturally integrates with the **Environmental & Prop-Based Combat** system.

*   Casting a water spell on the ground creates a `Wet` surface. Any enemy walking through it becomes `Wet`.
*   Casting a lightning spell into that water will electrocute everyone standing in it.
*   A `Rainstorm` (from the Seasons & Events system) will make *all* outdoor combatants permanently `Wet`, making lightning-focused builds incredibly powerful.

## Gameplay & Narrative Impact

*   **Deep Tactical Combat:** Players are constantly thinking about spell order and party composition. "My mage can apply `Wet` with her water spell, which will set up my rogue's `Lightning-enchanted Dagger` for a huge Electro-Charged attack."
*   **Rewards Experimentation:** Players will be driven to discover all the possible elemental reactions. The system encourages creative problem-solving.
*   **Makes Gear Choices More Meaningful:** An item with `+Adds Fire Damage` is no longer just a simple damage boost. It's a tool that enables a whole new set of elemental reactions.
*   **Visually Spectacular:** The reactions should be accompanied by satisfying visual effects—bursts of steam, arcs of lightning, shattering ice—making combat feel powerful and dynamic.

## Implementation Sketch

*   **Data:**
    *   `elements.toml`: Defines each element and its corresponding status effect.
    *   `reactions.toml`: A table that defines all possible elemental reactions. `reaction(element_A, element_B) -> effect`.
*   **Systems:**
    *   When an entity is hit by an elemental attack, the `CombatSystem` applies the corresponding `ElementalStatus` component.
    *   After damage is calculated, a `ReactionSystem` checks the target's active statuses. If a valid combination for a reaction is found, it consumes the required statuses and triggers the reaction effect (e.g., `SpawnAoE`, `ApplyDebuff`, `DealBonusDamage`).
*   **UI:** The UI needs to clearly display the elemental statuses currently affecting a target. This could be a series of small icons next to their health bar.
