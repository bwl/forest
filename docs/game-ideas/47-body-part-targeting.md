# Awesome Idea: Body Part Targeting System (Lite)

## Concept

This system adds a layer of tactical depth to encounters with large, elite, or boss-level enemies. Instead of treating the enemy as a single entity with one health bar, the player can target its individual body parts. Damaging or disabling these parts has direct, tangible effects on the enemy's abilities, turning major fights from a simple damage race into a strategic process of dismantling your opponent.

## Core Mechanics

### 1. Targetable Parts

*   Only specific, larger enemies (like Trolls, Golems, Dragons, or heavily armored Knights) have this system.
*   When the player enters a "targeting mode" (perhaps by holding a key or selecting an ability), the different targetable parts are highlighted.
*   **Examples of Targetable Parts:**
    *   `Head`
    *   `Sword Arm` / `Claw Arm`
    *   `Shield Arm`
    *   `Legs`
    *   `Wings`
    *   `Tail`
    *   `Golem's Power Core` (a specific, glowing weak point)

### 2. The Effects of Disabling a Part

*   Each body part has its own, smaller health pool. When this pool is depleted, the part becomes **"Crippled"** or **"Destroyed,"** triggering a specific mechanical effect.
*   **Crippling the `Sword Arm`:** The enemy can no longer use its powerful `Power Attack`. Its basic melee attacks deal 50% less damage.
*   **Crippling the `Shield Arm`:** The enemy's shield is destroyed. They lose a significant amount of their armor and can no longer use their `Block` ability.
*   **Crippling the `Legs`:** The enemy's movement speed is halved, and they can no longer use charge or dodge abilities.
*   **Crippling the `Wings`:** A flying enemy is brought crashing to the ground, where it is stunned for several turns and can be attacked by melee characters.
*   **Destroying the `Golem's Power Core`:** The Golem might go berserk, dealing massive damage but also taking damage itself each turn. Or, it might shut down completely.

### 3. Accuracy & Trade-offs

*   Targeting a specific part is harder than just attacking the enemy's center of mass.
*   Each part has its own accuracy modifier:
    *   **Torso:** Base accuracy.
    *   **Legs/Arms:** Slight accuracy penalty.
    *   **Head/Weak Point:** Significant accuracy penalty, but offers a higher critical hit chance or bonus damage.
*   This creates a constant tactical choice: Do you go for the reliable damage on the torso, or risk missing a few shots to disable a dangerous arm?

## Gameplay & Narrative Impact

*   **Turns Boss Fights into Puzzles:** Every boss fight becomes a unique puzzle. The player isn't just asking "How do I deal damage?" but "What part do I need to disable first to survive this fight?"
*   **Player Agency & Control:** It gives the player a huge amount of control over the flow of a difficult battle. They can proactively neutralize the most dangerous threats an enemy presents.
*   **Dynamic Fights:** The fight changes dramatically as it progresses. The first phase might be about crippling the dragon's wings to get it on the ground. The second phase might be about destroying its fire-gland to stop its breath attack.
*   **Visceral Feedback:** The system provides incredible feedback. Seeing a giant's sword arm go limp or a golem's power core crack and sputter is an immensely satisfying moment.

## Implementation Sketch

*   **Data:**
    *   In `creatures.toml`, boss-level enemies have a `body_parts` table.
    *   Each part has its own `hp`, `accuracy_modifier`, and a `on_crippled_effect` script or event ID.
*   **Systems:**
    *   The `TargetingSystem` allows the player to cycle through available body parts on a valid enemy.
    *   The `CombatSystem` directs damage to the selected part's health pool instead of the main one.
    *   When a part's HP reaches zero, the `BodyPartSystem` applies the `Crippled` status effect and triggers its unique mechanical consequence (e.g., `DisableAbility(PowerAttack)`, `ApplyDebuff(Slow)`).
*   **UI:** When targeting is active, the different parts need to be clearly highlighted on the enemy's sprite. The tooltip should show the name of the part and its current status.
