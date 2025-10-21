# Awesome Idea: The Nemesis System (Lite)

## Concept

Enemies are not just disposable mobs. When a notable enemy survives an encounter with the player (i.e., flees or is left for dead), they have a chance to come back later. They return stronger, with new abilities, a new title, and a personal grudge against the player. This system creates organic, personal rivalries and makes the world feel like it remembers your actions.

## Core Mechanics

1.  **Promotion Trigger:**
    *   When an enemy of a certain type (e.g., `Wolf`, `Bandit Captain`, `Orc Raider`) is defeated but not killed, or manages to flee the battle, a flag is set.
    *   The system rolls a chance (e.g., 15%) for this enemy to be "promoted" to a Nemesis.

2.  **The Nemesis Transformation:**
    *   If promoted, the base creature is removed and a new, unique Nemesis entity is created and stored in a `NemesisPool`.
    *   **New Title:** The Nemesis gets a descriptive title based on the last encounter. Examples:
        *   A wolf that was set on fire and fled: `Scar-Fur the Singed`
        *   A bandit who fled after their allies were killed: `Gorn the Lone Survivor`
        *   An orc that took a critical arrow shot: `Grishnak One-Eye`
    *   **Upgraded Stats & Skills:** The Nemesis gets a significant boost to HP, damage, and may gain new abilities related to their origin story.
        *   `Scar-Fur the Singed` might gain a fire-based attack or resistance to fire.
        *   `Gorn the Lone Survivor` might get bonuses when fighting alone or use traps.
        *   `Grishnak One-Eye` might have a deadly, accurate ranged attack.

3.  **The Re-Encounter:**
    *   The Nemesis is re-injected into the world for a future encounter. This isn't random; it's a scripted event.
    *   **Ambush:** The Nemesis might ambush the player on a road they frequent.
    *   **Leader:** The Nemesis might return leading a large warband of their own kind.
    *   **Quest Target:** A new procedural quest might appear: "Hunt down the infamous bandit Gorn the Lone Survivor who has been terrorizing the region."

4.  **Nemesis Dialogue:**
    *   When the player re-encounters their Nemesis, they get unique dialogue.
    *   `"You thought you had finished me in the old ruins, but you only made me stronger!"`
    *   `"I remember that arrow you gave me. I have one for you in return!"`

## Gameplay & Narrative Impact

*   **Personal Stakes:** Combat is no longer just about loot and XP. It's about personal history. Letting an enemy escape suddenly has potential long-term consequences.
*   **Dynamic Storytelling:** The player creates their own recurring villains. These aren't pre-scripted bosses; they are the direct result of the player's own actions.
*   **World Reactivity:** It makes the world feel incredibly responsive. The creatures in it don't just exist to be killed; they remember, they adapt, and they hold grudges.
*   **Satisfying Payoff:** Finally defeating a Nemesis who has hounded you for a whole chapter is immensely satisfying. They could drop a unique piece of loot named after them (e.g., "Gorn's Cowardly Cloak").

## Implementation Sketch

*   **Data:**
    *   A `NemesisPool` in the world state, which is a list of active Nemesis entities.
    *   A `nemesis_templates.toml` file that defines how a base creature can be upgraded (e.g., list of possible titles, abilities to add).
*   **Systems:**
    *   When an enemy flees or is "near death," the `NemesisPromotionSystem` runs a check.
    *   If successful, it creates a new Nemesis from the template and adds it to the pool.
    *   The `StorytellerSystem` or `WorldEventSystem` can then periodically check the `NemesisPool` and trigger a re-encounter event.
*   **Scope:** This can be kept "lite" by limiting it to a few creature types and only having 1-2 active Nemeses at a time to avoid overwhelming the player.
