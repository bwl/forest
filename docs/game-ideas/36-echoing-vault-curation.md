# Awesome Idea: The Echoing Vault & Procedural Curation

## Concept

This system allows your procedural generator to learn and improve over time. When the game generates a particularly unique, challenging, or aesthetically pleasing area—a room, a series of corridors, a small dungeon level—it can be saved as a **"Vault."** This library of curated, high-quality "good stuff" is then used by the world generator in the future. It can intelligently place these Vaults into new dungeons, creating moments that feel hand-crafted and special amidst the procedural chaos.

## Core Mechanics

### 1. Identifying "Good Stuff"

How does the game know a generated section is "good"? There are several methods:

*   **Manual Curation (Developer-led):** During development, when you encounter a perfectly generated room, you can press a hotkey to save it as a Vault. This is the most reliable method.
*   **Player-Flagged (Community-led):** Allow players to flag a room or area they found particularly cool. If a specific layout gets flagged by multiple players, it can be added to the official Vault library in a future update.
*   **Heuristic Analysis (Advanced):** The game could analyze generated sections based on certain metrics (e.g., high density of tactical options, unique combination of features, a high number of player deaths/memorable events) and automatically suggest them for Vault status.

### 2. The Vault Library

*   A Vault is a saved blueprint. It stores the tile layout, object placements, and potentially even monster spawn patterns.
*   Each Vault is given tags that describe its properties: `size: small`, `type: library`, `features: fountain, secret_door`, `faction: Emberkin`.

### 3. Intelligent Placement

*   When the main dungeon generator is building a new level, it can decide to place a Vault instead of generating a section from scratch.
*   It uses the tags to find an appropriate Vault. If it's generating a Verdant League outpost, it will look for Vaults with the `Verdant` and `outpost` tags.
*   The system then seamlessly stitches the Vault into the surrounding procedural map, connecting its entrances and exits to the main corridors.

### 4. The "Echo" Effect (Using Player History)

This is where the system becomes truly innovative. It doesn't just reuse developer-made Vaults; it reuses the player's own history.

*   **Saving Player-Altered Vaults:** When a player has a particularly memorable battle in a Vault, the system can save a *modified* version of it. It might save the scorch marks on the floor, the broken pillars, and the scattered remains of the enemies.
*   **The Echoing Encounter:** In a future dungeon, the player might stumble upon a familiar room. They recognize the layout, but it's different—it's filled with the ghostly echoes of their previous battle. The scorch marks are still there. Spectral versions of the enemies they fought might appear. It feels like they are walking through a memory of their own past deeds.

## Gameplay & Narrative Impact

*   **Improved Quality of Generation:** Over time, the quality of the procedural generation will naturally increase as the Vault library grows with high-quality, curated content. It smooths out the rough edges of pure procedural generation.
*   **A Sense of History:** The Echoing Vault mechanic makes the world feel deeply personal and historic. The player isn't just exploring dungeons; they are exploring the echoes of their own past adventures.
*   **Familiarity and Surprise:** Stumbling upon a familiar Vault in a new context is a delightful experience for the player. It provides a moment of recognition and mastery, followed by the tension of seeing how it has changed this time around.
*   **Community-Sourced Content:** The player-flagging system allows the community to participate in the ongoing design of the game, making them feel more invested.

## Implementation Sketch

*   **Data:** A `vaults/` directory filled with files (`library_of_whispers.vault`, `goblin_throne_room.vault`). Each file is a serialized representation of a map section.
*   **Systems:**
    *   The `DungeonGenerator` is modified to include a `VaultPlacementSystem`.
    *   This system has a certain probability (e.g., 10% per level) of trying to place a Vault.
    *   It queries the Vault library for a suitable blueprint based on the current dungeon's tags.
    *   A `VaultStitchingSystem` handles the logic of connecting the Vault's doorways to the main dungeon path.
*   **The Echo System:** Requires a more complex `EventLogger` to track significant player actions within Vaults and a `VaultSerializationSystem` that can save the modified state.
