# Awesome Idea: The Combo Point System

## Concept

This system introduces a resource-management layer to combat that creates a satisfying rhythm of building and spending power. Instead of every attack being equal, some abilities act as **"Builders,"** generating a resource called **Combo Points** on a target. The player can then unleash a powerful **"Finisher"** ability, which consumes these points to produce a devastating, scalable effect. This encourages sustained engagement and rewards players for setting up tactical takedowns.

## Core Mechanics

### 1. Generating Combo Points

*   The player has a special UI element that shows 1-5 empty "pips" or dots when they target an enemy.
*   **Builder** abilities are typically fast, low-cost attacks that add one or more Combo Points to the target upon a successful hit.
    *   `Quick Stab:` A fast dagger attack that generates 1 Combo Point.
    *   `Expose Weakness:` A utility move that deals no damage but generates 2 Combo Points and applies a minor defense debuff.
    *   `Shield Slam:` A defensive move that generates 1 Combo Point if it successfully staggers an enemy.
*   Combo Points are stored *on the target*. If the player switches targets, they lose the points they have built up on the previous enemy.

### 2. Spending Combo Points

*   **Finisher** abilities are powerful moves that have a dramatic effect based on the number of Combo Points consumed.
*   The player can choose to use a Finisher with as little as 1 point, or save up for a massive 5-point effect.
*   **Example Finishers:**
    *   **`Eviscerate (Damage):`** Deals a large amount of physical damage that scales per Combo Point. A 5-point Eviscerate is a massive single-target nuke.
    *   **`Kidney Shot (Stun):`** Stuns the target for a duration that scales per Combo Point. A 5-point Kidney Shot could take a dangerous enemy out of the fight for several turns.
    *   **`Rupture (Damage over Time):`** Applies a powerful Bleed effect whose duration scales per Combo Point.
    *   **`Slice and Dice (Self-Buff):`** Consumes points on a target to grant the player a significant attack speed buff whose duration scales per Combo Point.

### 3. Class & Weapon Integration

*   This system is perfect for specific character archetypes like Rogues, Duelists, or Monks, but can be adapted for others.
*   **Rogues:** The classic example. Builds points with daggers, spends them on stuns and bleeds.
*   **Warriors:** Might build points with shield slams and defensive moves, then spend them on a powerful `Execution` finisher.
*   **Mages:** Could build points with quick frost spells, then spend them on a massive `Glacial Spike` finisher that freezes the target solid.

## Gameplay & Narrative Impact

*   **Creates a Satisfying Rhythm:** The `build, build, build -> SPEND` loop is a core part of what makes many action and MMO combat systems feel so good. It creates a natural cadence to a fight.
*   **Meaningful Choices:** The player is constantly making interesting decisions. "Do I spend my 3 points now for a guaranteed kill on this goblin, or do I save them and try to build to 5 for the Orc Warlord he's guarding?"
*   **Scalable Power:** It gives the player a feeling of control over their own power level. They are not just using abilities; they are actively building up to a climactic moment that they unleash.
*   **Highlights Target Priority:** Because points are stored on the target, the system forces the player to focus down one enemy at a time, a key tactical skill in roguelikes.

## Implementation Sketch

*   **Data:**
    *   In `skills.toml`, abilities are tagged as `type = "Builder"` or `type = "Finisher"`.
    *   Builder abilities have a `generates_combo_points = 1` field.
    *   Finisher abilities have a `consumes_combo_points = true` field and their effects are defined with a formula that scales with the number of points spent (e.g., `damage = 10 * combo_points`).
*   **Systems:**
    *   When an enemy is attacked, a `ComboPoints` component is added to it, or its existing count is incremented.
    *   The `AbilitySystem` checks for this component when a Finisher is used, calculates the effect based on the point count, and then removes the component from the target.
*   **UI:** A clear, simple display of Combo Points on the current target is essential. This could be a series of dots or pips directly under the enemy's health bar.
