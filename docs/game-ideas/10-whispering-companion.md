# Awesome Idea: The Whispering Companion

## Concept

The player is accompanied by a mysterious, non-combat entity. This "Whispering Companion" could be a glowing wisp, a sentient shadow, a small clockwork drone, or an ancient, tiny creature that rides on the player's shoulder. It cannot fight, but it provides a constant stream of cryptic advice, fragmented lore, and enigmatic warnings. Its true purpose and origin are a central mystery of the game.

## Core Mechanics

1.  **Context-Sensitive Whispers:**
    *   The companion periodically offers short, one-line messages that appear in the log or as a floating text overlay. These are triggered by context.
    *   **Location:** Entering a ruin: `...It smells of dust and regret...`
    *   **Enemy:** Facing a new monster: `...That one bleeds ichor, not blood...`
    *   **Item:** Picking up a strange relic: `...It hums with a forgotten song...`
    *   **Player State:** At low health: `...Fade not into the gray...`

2.  **A Hidden Agenda & Trust System:**
    *   The companion is not necessarily a benevolent guide. It has its own mysterious agenda.
    *   A hidden **Trust** or **Alignment** score tracks how the player's actions align with the companion's goals.
    *   **High Trust:** The whispers become clearer, more helpful, and might even reveal hidden secrets. `...The wall to your left sounds hollow...`
    *   **Low Trust:** The whispers become more cryptic, misleading, or even hostile. `...They all betray in the end...` or `...That potion looks tempting, does it not?...`
    *   The player's major choices (especially those related to factions and world-altering quests) will influence this score.

3.  **Lore & Quest Integration:**
    *   The companion is the primary vector for delivering the game's deep lore, but always in fragmented, poetic pieces.
    *   Its backstory is a major side quest. The player can find artifacts or visit ancient sites that trigger memory fragments for the companion, slowly revealing its story.
    *   In the late game, the companion's final allegiance could have a major impact on the endgame, perhaps unlocking a secret ending or a unique final boss.

4.  **Mechanical Bonuses (Optional):**
    *   While it doesn't fight, a high-trust companion could provide subtle, passive bonuses.
    *   **Wisp:** A faint, passive light source.
    *   **Shadow:** A slight bonus to stealth.
    *   **Clockwork Drone:** Occasionally points out hidden traps.

## Gameplay & Narrative Impact

*   **Atmosphere & Tone:** The constant, cryptic whispers create a unique, often melancholic or eerie atmosphere. It makes solo exploration feel less empty.
*   **Organic Guidance:** It serves as a natural, in-world hint system, guiding the player without breaking immersion with explicit tutorials or quest markers.
*   **Central Mystery:** The question of "What *is* this thing?" becomes a powerful narrative driver, encouraging the player to explore the world to find answers.
*   **Moral Ambiguity:** The fact that the companion might not be trustworthy adds a layer of tension to its advice. Should you trust the whisper that tells you to drink the strange potion?

## Implementation Sketch

*   **Data:**
    *   A series of `whisper_tables.toml` files, categorized by trigger (e.g., `on_enter_ruin`, `on_encounter_undead`, `on_low_health`).
    *   Each whisper can have an associated `alignment` (`+Verdant`, `-Emberkin`, `+Chaos`, etc.).
*   **Systems:**
    *   A `WhisperSystem` runs on a timer or on specific game events.
    *   It checks the current context, filters the appropriate whisper table based on the hidden Trust/Alignment score, and displays a message.
    *   Major player actions (like completing a key quest) can fire an event that updates the companion's internal state.
*   **UI:** Whispers should be visually distinct in the log (e.g., italicized, different color) to separate them from standard game messages.
