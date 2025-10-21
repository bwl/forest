# Awesome Idea: Living Characters - Idle Animations & Camp Chores

## Concept

This system breathes life into the player character and NPCs by eliminating moments of static stillness. It introduces a rich set of contextual idle animations that make characters feel like they are present in the world. Furthermore, it adds a productive "AFK Mode" that allows the player to assign their character to perform daily chores, creating a sense of continuous life at the camp even when the player isn't actively adventuring.

## Core Mechanics

### 1. Contextual Idle Animations

When the player or an NPC stands still for more than a few seconds, instead of being frozen, they play a short, looping animation based on their context.

*   **Player Character:**
    *   **In a dungeon:** Paces nervously, checks their map, sharpens their sword on a pauldron, tightens their grip on their shield.
    *   **In camp:** Stretches, sits by the fire, pets a camp animal.
    *   **In a town:** Leans against a wall, observes passersby.
    *   **Low Health:** Slumps over, breathing heavily.
*   **NPCs:**
    *   **Blacksmith:** Hammers rhythmically at an anvil, wipes sweat from their brow.
    *   **Scholar:** Paces while reading a book, adjusts their spectacles.
    *   **Guard:** Scans the horizon, stands at attention, polishes their spearhead.
    *   **Generic Villager:** Sweeps the storefront, chats with another villager.

These are simple, 2-3 frame ASCII/sprite animations that add an enormous amount of personality.

### 2. AFK Mode: Camp Chores

This system gives players a meaningful way to log off or step away from the game.

*   **Activating AFK Mode:** The player interacts with their bedroll or a `Chore Board` in the camp.
*   **Assigning a Chore:** A menu appears with a list of available chores. The chosen chore determines the resources or buffs generated while AFK.
    *   `"Tend the Farm"`: Slowly generates a small amount of `Food`.
    *   `"Chop Firewood"`: Generates `Wood` for the camp.
    *   `"Maintain Equipment"`: Provides a small, temporary `Durability+` buff to the player's equipped gear upon their return.
    *   `"Stand Guard Duty"`: Increases the camp's `Defense` rating, reducing the chance of an offline raid event.
    *   `"Rest & Recuperate"`: Slowly regenerates health and removes negative status effects.
*   **Offline Progression:** The game calculates the time the player was away and grants a corresponding amount of resources or buffs when they log back in. The rewards are modest to prevent it from being the optimal way to play, but significant enough to feel rewarding.

## Gameplay & Narrative Impact

*   **A Living, Breathing World:** Idle animations are a subtle but incredibly powerful tool for immersion. They make the world feel constantly in motion and give characters a sense of presence and personality.
*   **Productive Downtime:** The Camp Chores system respects the player's time. It allows them to feel like they are still contributing to their camp's growth even when they can't be actively playing.
*   **Reinforces Character Roles:** The specific animations and chores reinforce the roles of the NPCs. The blacksmith feels like a blacksmith because you see them working at their forge.
*   **Reduces Grind:** The system can alleviate some of the more repetitive aspects of resource gathering, allowing the player to focus on the more exciting parts of the game, like exploration and combat.

## Implementation Sketch

*   **Idle Animations:**
    *   An `IdleAnimationSystem` checks if an entity has been stationary for a certain duration.
    *   If so, it looks at the entity's `context` tags (`in_dungeon`, `at_camp`, `role:blacksmith`) and plays a random, appropriate animation from a list defined in a TOML file.
*   **Camp Chores:**
    *   When the player logs off via the Chore Board, the game saves the current timestamp and the selected `chore_id`.
    *   When they log back in, the `AFKProgressSystem` compares the saved timestamp to the current time.
    *   It calculates the elapsed time and uses a formula defined in `chores.toml` to determine the rewards (`resources_per_hour`, `buff_duration`, etc.) and adds them to the player's camp.
