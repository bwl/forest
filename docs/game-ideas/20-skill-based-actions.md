# Awesome Idea: Skill-Based Action System

## Concept

This system evolves your Runescape-style skills from passive, background grinds into active, engaging gameplay loops. As a player levels up a skill, they don't just get faster or more efficient; they unlock a small set of **active abilities** related to that skill. This makes the act of gathering and crafting more tactical and gives players more to *do* than just click on a rock.

## Core Mechanics

### 1. Unlocking Active Abilities

*   Abilities are unlocked at specific skill level milestones (e.g., Level 20, 50, 80).
*   These abilities consume Stamina, a special resource (`Focus`), or have a long cooldown, so they can't be spammed.
*   They are activated via a hotbar or a contextual menu when interacting with a resource node.

### 2. Example Skill Abilities

#### **Mining Abilities:**

*   **Power Strike (Lvl 20):** (High Stamina Cost) A single, powerful swing that has a high chance to yield double ore but also a chance to damage your pickaxe.
*   **Geological Survey (Lvl 50):** (Long Cooldown) For the next 60 seconds, all rare ore veins within a 20-tile radius are revealed on your minimap.
*   **Shatterpoint (Lvl 80):** (High Cost, Cooldown) Instantly depletes a resource node, yielding all of its remaining resources at once. Has a small chance to create a cave-in.

#### **Woodcutting Abilities:**

*   **For the Trees (Lvl 20):** A focused chop that guarantees a drop of rare materials (like resin or bird's nests) in addition to logs.
*   **Controlled Fall (Lvl 50):** Allows you to choose the direction a tree falls. A falling tree can form a temporary bridge across a chasm or deal massive damage to enemies it lands on.
*   **Heartwood Strike (Lvl 80):** A single, precise strike that yields a rare "Heartwood" log, a key component for legendary bows and staves.

#### **Fishing Abilities:**

*   **Bait Bomb (Lvl 20):** (Consumes special bait) Temporarily increases the chance of catching rare fish in a small area.
*   **Patience of the Heron (Lvl 50):** (Channeled ability) For the next 30 seconds, your hook will not be triggered by common fish, guaranteeing that the next bite will be from a rare or large one.
*   **Depths Lure (Lvl 80):** (High Cost) Lure a powerful, boss-level "leviathan" to your fishing spot for a unique fight that requires both fishing skill and combat prowess to win.

### 3. Synergies with Other Systems

*   **Combat:** The `Controlled Fall` woodcutting ability is a perfect example of a non-combat skill having a direct, creative impact on a combat encounter.
*   **Crafting:** Abilities that yield rare components (`Heartwood Strike`) are essential for high-level crafting, creating a tight loop between gathering and making.
*   **Exploration:** `Geological Survey` and other similar abilities reward players for actively using their skills while exploring, rather than just passively grinding in one spot.

## Gameplay & Narrative Impact

*   **Engaging Grind:** This system breaks the monotony of traditional gathering loops. Instead of just clicking and waiting, the player is making active choices: "Do I use Power Strike for a chance at double ore, or save my stamina?"
*   **Sense of Mastery:** Unlocking a new ability feels like a significant power spike. It shows that the player is not just getting better at numbers, but is truly becoming a master of their craft.
*   **Creative Problem Solving:** Players can use these abilities in unexpected ways. A `Controlled Fall` could block a patrol route. A `Bait Bomb` could be used to distract a riverside monster.
*   **Reinforces Player Fantasy:** A master miner *should* be able to do more than just swing a pickaxe. This system lets the player live that fantasy.

## Implementation Sketch

*   **Data (`skills.toml`):**
    ```toml
    [[skill.mining.abilities]]
    id = "power_strike"
    unlock_level = 20
    stamina_cost = 50
    cooldown_sec = 10
    description = "A powerful swing that can yield double ore."
    ```
*   **Systems:**
    *   The `PlayerInputSystem` needs to handle the activation of these abilities from a hotbar or menu.
    *   The `SkillActionSystem` would apply the specific effects of the ability (e.g., doubling the loot yield, applying a status effect to the player, starting a cooldown timer).
*   **UI:** A small, contextual ability bar could appear whenever the player interacts with a resource node, showing them their available special moves.
