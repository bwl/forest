# Awesome Idea: Diablo-Style Loot & Affix System

## Concept

This system transforms loot from simple, static items into a deep, procedural, and exciting part of the game loop. Inspired by ARPGs like Diablo, items can be generated with a wide variety of magical properties, creating a nearly infinite pool of potential gear. The goal is to make every monster kill a tiny lottery, where the next drop could fundamentally change your character's build and capabilities.

## Core Mechanics

### 1. Item Rarity Tiers

Items can drop in several tiers of quality, each with a different color and potential for power.

*   **Normal (White):** A standard, non-magical item. A basic `Iron Sword`.
*   **Magic (Blue):** The item has 1-2 magical properties, composed of a prefix and/or a suffix. `Savage Iron Sword of Haste`.
*   **Rare (Yellow):** A powerful item with 3-6 randomly rolled magical properties from the affix pool. These items are given a procedurally generated, evocative name. `Eagle Grasp, the Vicious Iron Sword of the Leech`.
*   **Legendary / Unique (Orange/Gold):** A hand-crafted item with a fixed name, art, and a powerful, unique property that cannot be found on other items. `The Bloodletter, a sword that causes enemies to explode on death, healing the wielder.`

### 2. The Affix System

This is the heart of the system. Affixes are the building blocks of magical items.

*   **Prefixes:** Typically grant offensive or utility properties. Examples:
    *   `Savage`: +X% Increased Physical Damage
    *   `Glacial`: Adds Cold Damage
    *   `Vampiric`: X% of Damage Leeched as Life
    *   `Swift`: +X% Attack Speed
*   **Suffixes:** Typically grant defensive or attribute properties. Examples:
    *   `of the Mammoth`: +X to Strength
    *   `of the Sentinel`: +X% to Armor
    *   `of Alacrity`: +X% Movement Speed
    *   `of Resistance`: +X% to a specific resistance (Fire, Cold, etc.)

*   **Affix Pools & Tiers:**
    *   Affixes are organized into pools based on item type (e.g., `+Armor` can only roll on armor, not weapons).
    *   Each affix has multiple tiers. A `Sturdy` prefix on a level 5 item might grant `+10 Armor`, while the `Impregnable` prefix on a level 50 item grants `+200 Armor`.

### 3. Legendary & Unique Properties

These are the true build-defining items. Their unique affixes break the normal rules of the game.

*   **Skill-Altering:** `Your "Cleave" ability now strikes in a 360-degree circle.`
*   **Resource-Changing:** `Your spells consume Health instead of Mana.`
*   **Proc-Based:** `20% chance on hit to summon a friendly Ghostly Wolf.`
*   **Rule-Bending:** `You can no longer be frozen. Instead, you gain 25% movement speed when hit with a cold attack.`

### 4. Loot Generation Flow

When a monster dies, the `LootDropSystem` runs:

1.  **Roll for Drop:** Does this monster drop anything?
2.  **Choose Base Type:** If yes, pick a base item from its loot table (e.g., `Iron Sword`, `Leather Gloves`).
3.  **Roll for Rarity:** Determine the item's quality (e.g., 70% Normal, 20% Magic, 9% Rare, 1% Legendary).
4.  **Generate Affixes:**
    *   If **Magic**, roll 1-2 affixes (one prefix, one suffix).
    *   If **Rare**, roll 3-6 random affixes from valid pools.
    *   If **Legendary**, pick a specific, pre-designed Legendary item from the loot table.
5.  **Roll Stat Ranges:** Each affix has a range (e.g., `+10-15 Strength`). The system rolls a value within this range. This creates the hunt for a "perfectly rolled" item.

## Gameplay & Narrative Impact

*   **The Loot Hunt:** This system is the engine of long-term player motivation. The desire for a better-rolled Rare or a specific Legendary will keep players engaged for hundreds of hours.
*   **Build Diversity:** Legendary items can enable entirely new ways to play a character, encouraging experimentation.
*   **Excitement & Surprise:** Every kill, every chest, could be *the one*. This creates a powerful feedback loop.
*   **A Living Economy:** In a world with factions and trade, well-rolled Rare items and sought-after Legendaries become incredibly valuable commodities.

## Implementation Sketch

*   **Data (`affixes.toml`):**
    ```toml
    [[prefix]]
    id = "savage"
    name = "Savage"
    item_types = ["weapon"]
    [[prefix.tiers]]
    level_req = 1
    stat = "increased_physical_damage"
    range = [5, 10] # +5-10%
    [[prefix.tiers]]
    level_req = 20
    stat = "increased_physical_damage"
    range = [11, 20]

    [[suffix]]
    id = "of_the_mammoth"
    # ... etc
    ```
*   **Data (`legendaries.toml`):**
    ```toml
    [[legendary]]
    id = "the_bloodletter"
    name = "The Bloodletter"
    base_item = "iron_sword"
    unique_property = "enemies_explode_on_death_heal_player"
    flavor_text = "'Let the feast begin.'"
    ```
*   **Systems:** A `LootGenerationSystem` that contains the logic for rolling rarity and affixes. The `PowerBundle` system we designed earlier can be used to apply the stat modifications from these affixes to the character.
