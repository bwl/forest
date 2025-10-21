# Awesome Idea: Ritual Magic System

## Concept

Magic isn't just about quick, tactical spells cast in the heat of battle. This system introduces **Ritual Magic**, a slower, more deliberate form of spellcasting that allows the player to achieve powerful, often permanent effects on the game world. Successfully performing a ritual is a multi-step quest in itself, requiring preparation, exploration, and risk.

## Core Mechanics

1.  **The Ritual Recipe:**
    *   Rituals are learned from rare scrolls, ancient tablets, or taught by mysterious NPCs.
    *   Each ritual is a recipe with several key requirements:
        *   **Components:** A list of rare, often non-stackable ingredients (e.g., `Heart of a Mountain-Beast`, `Starlight-Forged Iron`, `Whispering Fungus Spores`).
        *   **Location:** The ritual must be performed at a specific type of location (e.g., `A stone circle`, `A river's source`, `The heart of a volcano`).
        *   **Timing:** The ritual might only work during a specific time (e.g., `During a full moon`, `At dawn on the winter solstice`, `While a magical storm rages`).
        *   **Focus:** The player may need to place the components in a specific pattern on the ground, creating a temporary ritual circle.

2.  **The Casting Process:**
    *   Once all conditions are met, the player begins the ritual, which takes a significant amount of in-game time (e.g., several hours or even a full day).
    *   During this time, the player is vulnerable. The ritual might attract hostile spirits, opportunistic rivals, or magical anomalies.
    *   The player may need to perform a series of actions or checks (e.g., a Willpower skill check, chanting the correct sequence of runes) to keep the ritual stable.

3.  **Ritual Effects (Examples):**
    *   **Consecrate Ground:** Permanently bless a region, making it resistant to undead or chaos incursions. A powerful tool for faction warfare.
    *   **Summon Rainstorm:** Induce a long-lasting rainstorm, which could put out forest fires, fill reservoirs for farming, or make mountain passes treacherous.
    *   **Awaken the Land:** Cause a dormant, resource-rich mine to reveal itself on the world map.
    *   **Scry:** Gain a vision of a rival faction's troop movements or the location of a hidden artifact.
    *   **Bind Familiar:** Bind a powerful, unique creature (that you have previously defeated and captured the essence of) as a permanent combat companion.

## Gameplay & Narrative Impact

*   **Meaningful Magic:** Rituals make magic feel powerful and world-changing, not just a source of damage points. They are strategic tools, not just tactical ones.
*   **Drives Exploration:** The need for rare components and specific locations encourages players to explore dangerous and remote corners of the world.
*   **High-Stakes Gameplay:** The vulnerability during the casting process creates tense, memorable moments. Defending a ritual circle from waves of enemies is a great set-piece.
*   **Player Agency:** Rituals give the player a way to permanently shape the world and influence the ongoing faction conflict in a very direct way.
*   **Faction Integration:** Factions would have their own unique rituals. The Verdant League might focus on growth and healing, while the Emberkin Pact might have rituals of war and domination. The player could steal ritual knowledge from rivals or trade for it.

## Implementation Sketch

*   **Data:**
    *   `rituals.toml`: Defines each ritual, its requirements (components, location tags, timing), and its effects.
    *   Items will have a `ritual_component` tag.
    *   Map locations will have tags like `stone_circle`, `river_source`.
*   **Systems:**
    *   A `RitualSystem` checks if the player has the necessary components and if the location/time conditions are met.
    *   When a ritual is active, it spawns a `RitualInProgress` entity that tracks time and stability. This entity can also act as a trigger for spawning hostile waves.
    *   Upon successful completion, the system applies the scripted effect (e.g., adds a permanent modifier to a region, spawns a new POI).
*   **UI:**
    *   A dedicated "Rituals" tab in the player's journal or spellbook.
    *   When at a valid location, a special UI widget could appear to help the player place components and begin the ritual.
