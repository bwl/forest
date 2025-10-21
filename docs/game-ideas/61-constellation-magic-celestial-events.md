# Awesome Idea: Constellation Magic & Celestial Events

## Concept

Magic in the world is tied to the movements of celestial bodies. Players can harness the power of constellations, planetary alignments, and cosmic events to cast spells, but the effectiveness and nature of magic changes based on the current celestial configuration. This creates a dynamic magic system where timing and astronomical knowledge are as important as traditional spellcasting skills.

## Core Mechanics

### 1. Constellation Magic

*   **Celestial Map:** The night sky features a complex map of constellations, each associated with different schools of magic.
*   **Spell Casting:** Players cast spells by drawing connections between stars in the night sky (represented by a starmap UI).
*   **Constellation Powers:**
    *   `The Warrior` (Orion) - Combat and protection magic
    *   `The Healer` (Hygiea) - Restoration and blessing magic
    *   `The Trickster` (Hercules) - Illusion and deception magic
    *   `The Void` (Cthulhu's Crown) - Necromancy and forbidden magic
*   **Stellar Patterns:** More complex star patterns (triangles, squares, etc.) create more powerful effects but require greater skill to draw.

### 2. Planetary Influences

*   **Seven Planets:** Each day of the week is influenced by a different planet, subtly affecting all magic:
    *   Sunday (Sun) - All magic is slightly more effective
    *   Monday (Moon) - Illusion and transformation magic is enhanced
    *   Tuesday (Mars) - Combat magic is stronger, defensive magic is weaker
    *   Wednesday (Mercury) - Divination and communication magic is enhanced
    *   Thursday (Jupiter) - Blessing and healing magic is stronger
    *   Friday (Venus) - Charm and enchantment magic is more effective
    *   Saturday (Saturn) - Time magic and curses are more potent
*   **Planetary Hours:** Each hour of the day is also ruled by a planet, creating 168 unique magical conditions per week.

### 3. Celestial Events

*   **Rare Alignments:** Special astronomical events occur periodically, dramatically changing magical possibilities:
    *   `Blood Moon` - Necromancy is incredibly powerful but corrupting
    *   `Solar Eclipse` - All magic becomes unpredictable and dangerous
    *   `Conjunction of the Five` - Allows casting of nearly impossible spells
    *   `The Long Night` - A rare event where the sun doesn't rise for several days
*   **Event Quests:** Major celestial events trigger special quests and world changes.

### 4. Astronomer Class

*   **Specialization:** A new character class focused entirely on celestial magic and astronomical knowledge.
*   **Star Charts:** Astronomers maintain detailed star charts and can predict future celestial events.
*   **Telescope:** Special equipment that allows viewing distant stars and constellations, revealing hidden magical properties of locations.
*   **Cosmic Communion:** At the peak of their power, Astronomers can briefly commune with celestial entities for immense power.

### 5. Seasonal Constellations

*   **Changing Skies:** Different constellations are visible in different seasons, making some types of magic seasonally available.
*   **Seasonal Rituals:** Special ceremonies tied to solstices and equinoxes that amplify magical effects.
*   **Zodiac Influence:** The player's birth sign (based on game start date) provides minor bonuses to related magic.

## Gameplay & Narrative Impact

*   **Strategic Timing:** Players must consider celestial conditions when planning major magical workings, creating a time-based strategic layer.
*   **World Immersion:** The dynamic sky makes the world feel truly alive and connected to cosmic forces.
*   **Specialization:** Encourages different character builds focused on specific times or types of magic.
*   **Event-Driven Gameplay:** Celestial events create natural pacing for major game events and content releases.

## Implementation Sketch

*   **Data:** Constellations and planetary influences defined in `celestial.toml` with seasonal and hourly modifiers.
*   **Systems:** Celestial clock system tracks real-time astronomical conditions. Starmap UI for spell casting.
*   **UI:** Dynamic sky display showing current constellations. Calendar showing upcoming celestial events.