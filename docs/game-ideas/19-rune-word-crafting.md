# Awesome Idea: Rune Word Crafting System

## Concept

This system adds a deep, knowledge-based crafting endgame that goes beyond simple enchanting. Instead of just adding a `+5 Strength` bonus, players can transform mundane items into legendary artifacts by socketing runes in the correct order to form powerful "Rune Words." This creates a dual hunt: one for the perfect base item with the right number of sockets, and another for the rare runes needed to complete the ultimate recipe.

## Core Mechanics

### 1. Socketed Items

*   Normal, Magic, and Rare items can randomly drop with 1-6 empty sockets. `[ ]`
*   The number of sockets is a crucial property. A `3-Socket Longsword` is a potentially valuable crafting base.
*   Finding a high-quality, non-magical base item with many sockets is a major discovery.

### 2. Runes

*   Runes are a rare type of currency/crafting material dropped from monsters, especially in high-level areas or from bosses.
*   There are ~20-30 different runes in the game (e.g., `EL`, `ELD`, `TIR`, `NEF`, `ITH`, `TAL`, `RAL`... up to `ZOD`).
*   Each rune, when socketed by itself, provides a small, simple bonus:
    *   `RAL` Rune: `+15% Fire Resistance`
    *   `TIR` Rune: `+2 to Mana after each Kill`
*   Players can socket individual runes for minor upgrades, but this is not their true purpose.

### 3. Rune Words

*   A Rune Word is a specific sequence of runes placed in a specific type of item with the exact number of sockets.
*   **Recipe Example:** The Rune Word **"Steel"**
    *   **Runes:** `TIR` + `EL`
    *   **Item Type:** Sword, Axe, or Mace
    *   **Sockets:** Exactly 2
*   **The Transformation:** If a player sockets a `TIR` rune, then an `EL` rune, into a `2-Socket Scimitar`, the item is permanently transformed:
    *   The name changes from `2-Socket Scimitar` to **"Steel Scimitar"**.
    *   The individual rune bonuses are *removed*.
    *   A powerful set of pre-designed magical properties are applied:
        *   `+25% Increased Attack Speed`
        *   `+20% Enhanced Damage`
        *   `+50 to Attack Rating`
        *   `50% Chance of Open Wounds`

### 4. Discovering Recipes

*   Rune Word recipes are not given to the player. They must be discovered.
*   **Discovery Methods:**
    *   Rare lore drops from libraries or ancient ruins.
    *   Hints from the Whispering Companion or other mysterious NPCs.
    *   Completing quests for the Cartographer's Guild or a Faction.
    *   Community effort: players sharing their discoveries online (a key part of the Diablo 2 experience).

## Gameplay & Narrative Impact

*   **The Ultimate Treasure Hunt:** This creates a multi-layered endgame. The player needs the recipe, the right base item, and the specific runes. This is far more engaging than just finding a single drop.
*   **Knowledge is Power:** A player who knows a powerful Rune Word recipe has a huge advantage. It makes finding lore and paying attention to hints a core part of progression.
*   **Meaningful Crafting:** This isn't just incremental stat boosts. Completing a Rune Word is a moment of massive power gain, transforming a plain item into a legendary artifact.
*   **Economic Depth:** High-level runes and perfect socketed bases become the most valuable currency in the game for player-to-player or faction-to-faction trade.

## Implementation Sketch

*   **Data (`runes.toml`):**
    ```toml
    [[rune]]
    id = "TIR"
    level_req = 13
    bonus_weapon = "+2 Mana after each Kill"
    bonus_armor = "+2 Mana after each Kill"
    ```
*   **Data (`runewords.toml`):**
    ```toml
    [[runeword]]
    id = "steel"
    name = "Steel"
    runes = ["TIR", "EL"]
    item_types = ["sword", "axe", "mace"]
    sockets = 2
    properties = [
        { stat = "ias", value = 25 },
        { stat = "enhanced_damage", value = 20 },
        # ... etc
    ]
    ```
*   **Systems:**
    *   When a player sockets a rune into an item, an `OnSocket` event is fired.
    *   A `RuneWordSystem` listens for this event. It checks the item's socketed runes against the list of known `runewords.toml` recipes.
    *   If a match is found, it replaces the item's base properties and individual rune bonuses with the powerful Rune Word properties.
*   **UI:** The socketing interface needs to be clear, showing the item, its sockets, and the runes the player has available. When a Rune Word is successfully made, a special UI flourish (a flash of light, a sound effect) should occur to signify the transformation.
