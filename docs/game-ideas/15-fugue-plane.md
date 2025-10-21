# Awesome Idea: The Fugue Plane

## Concept

The Fugue Plane is a surreal, temporary dungeon that the player can access only while sleeping at a safe camp. It is not a physical place, but a manifestation of the player's own psyche: their memories, fears, and aspirations. It's a place for introspection and a source of unique, reality-bending rewards, but it comes with its own set of risks.

## Core Mechanics

1.  **Entering the Fugue:**
    *   When the player chooses to "Rest for the night" at a camp, there is a small chance they will enter the Fugue Plane in their dreams.
    *   This chance can be increased by certain factors: high stress, recent trauma (like a near-death experience), or consuming rare, dream-inducing herbs.

2.  **A Shifting, Personal Landscape:**
    *   The Fugue Plane is procedurally generated, but its theme is drawn from the player's recent experiences.
    *   **Memory of a Forest:** If the player recently spent a lot of time in a forest, the Fugue might be a twisted, nightmarish version of that forest, with whispering trees and shadowy beasts.
    *   **Memory of a Nemesis:** If the player has a powerful Nemesis, the Fugue might be a hunting ground where they are stalked by a spectral version of that foe.
    *   **Memory of a Faction:** If the player is deeply embroiled in faction conflict, the Fugue might be a surreal battlefield where ghostly armies clash.

3.  **Dream Logic & Rules:**
    *   Normal combat rules are warped. A player's "Willpower" or "Sanity" stat might be more important than their Strength.
    *   Enemies are not physical beings but manifestations of fear, doubt, or regret. They might be defeated not by HP damage, but by solving a riddle or confronting a past failure.
    *   The goal is not to reach the "end" of the dungeon, but to find a "Lucid Moment"—a special room or object that allows the player to wake up.

4.  **Consequences of the Fugue:**
    *   **Dying in the Fugue:** The player doesn't die in the real world. Instead, they wake up abruptly, having had a nightmare. They might suffer a temporary "Sanity" debuff, making them more vulnerable to fear-based attacks, or they might be "Exhausted," reducing their stamina for the next day.
    *   **Success in the Fugue:** Reaching a Lucid Moment and waking up peacefully can grant significant rewards:
        *   **Insight:** A permanent boost to a skill or attribute.
        *   **Clarity:** The player might identify a previously unknown item from their inventory.
        *   **Dream-Forged Items:** The player might wake up with a new, unique item that they found in the dream. These items have strange properties (e.g., a sword that does more damage to enemies you are afraid of, an amulet that lets you understand the speech of a certain animal).

## Gameplay & Narrative Impact

*   **Psychological Depth:** The Fugue Plane adds a layer of psychological depth to the character. It's a space to explore the *internal* consequences of the player's journey.
*   **Unique Rewards:** Dream-forged items are a source of unique, hard-to-find gear that can enable new playstyles.
*   **Risk vs. Reward:** The player might be tempted to intentionally seek out the Fugue for its rewards, but the potential debuffs make it a risky proposition.
*   **Narrative Reflection:** The Fugue acts as a dynamic summary of the player's recent adventures, re-contextualizing them in a surreal and often unsettling way.

## Implementation Sketch

*   **Data:**
    *   A `PlayerStateLog` tracks recent significant events (e.g., `last_biome_visited`, `active_nemesis_id`).
    *   `fugue_themes.toml` defines the different dreamscapes, the events that can trigger them, and the monsters/challenges within.
*   **Systems:**
    *   When the player sleeps, the `FugueSystem` rolls a chance to enter the dream state.
    *   If successful, it reads the `PlayerStateLog` to select a theme and generates a temporary, single-level dungeon.
    *   It applies a special set of `FugueRules` (e.g., modified combat, sanity checks) for the duration of the dream.
    *   The outcome (peaceful awakening or nightmare) determines the buffs or debuffs applied to the player upon waking.
