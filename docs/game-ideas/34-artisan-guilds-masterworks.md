# Awesome Idea: Artisan Guilds & Masterwork Items

## Concept

This system adds a layer of prestige and specialization to the high-end crafting game. While the player can craft excellent gear themselves, the absolute best items in the game—**Masterworks**—can only be created by the master artisans of powerful, independent guilds. To get this gear, the player must earn the guild's respect, gather the rarest materials, and pay a significant price, making the acquisition of a Masterwork item a major achievement.

## Core Mechanics

### 1. The Artisan Guilds

*   These are neutral factions focused on a single craft. They are not interested in politics, only in perfecting their art.
*   **Examples:**
    *   `The Weaponsmiths' Guild`: Forges the best swords, axes, and armor.
    *   `The Fletcher's League`: Crafts legendary bows and crossbows.
    *   `The Alchemists' Society`: Brews unique, powerful potions and elixirs that cannot be crafted elsewhere.
    *   `The Runic Scribes`: The only source for high-level runes and Rune Word knowledge.
*   Each guild has a unique Guild Hall located in a specific part of the world.

### 2. The Commissioning Process

*   The player cannot craft Masterwork-tier items themselves. They must commission them.
*   **The Process:**
    1.  **Gain Reputation:** The player must first earn a high reputation with the guild by completing quests for them or delivering rare materials.
    2.  **Acquire the Materials:** The recipe for a commissioned item requires extremely rare components (e.g., `a Dragon's Scale`, `a Golem's Core`, `a vial of Star-Metal`).
    3.  **Pay the Fee:** The guild charges a substantial fee in currency or other resources for the services of their master artisan.
    4.  **Place the Order:** The player brings the materials and the fee to the Guild Hall to place the commission.

### 3. The Masterwork System

*   When the item is complete (after a period of in-game time), there is a **chance** for it to become a Masterwork.
*   This chance is influenced by the quality of the materials, the player's reputation with the guild, and perhaps a special, extra-rare component the player can add.
*   **A Standard Commissioned Item:** An `Adamantite Greatsword`. It's one of the best swords in the game.
*   **A Masterwork Item:** The smith might forge **`"Wyrmsbane," an Adamantite Greatsword`**. It gets a unique name and a set of slightly superior, randomly rolled properties, or even a unique bonus effect.
    *   `+15% Damage vs. Dragon-kin`
    *   `Higher base damage than the standard version`
    *   `A unique, glowing visual effect`

### 4. Guild Politics & Secrets

*   Guilds are competitive. Helping the Weaponsmiths' Guild might anger a rival guild of Armorers.
*   Master artisans are unique NPCs. They might have their own personal quests. Completing them could guarantee that the next item they forge for you is a Masterwork.
*   Guilds hold the secrets to the most powerful crafting techniques. The only way to learn how to work with `Star-Metal` is to earn the trust of the reclusive master of the Weaponsmiths' Guild.

## Gameplay & Narrative Impact

*   **A True Endgame Item Chase:** This system creates a multi-stage endgame goal for dedicated players. The hunt for materials, the reputation grind, and the RNG of the Masterwork roll make for a compelling loop.
*   **Makes Crafting Feel Prestigious:** It elevates crafting from a simple menu interaction to a meaningful engagement with the world and its characters.
*   **Adds Value to Rare Materials:** A `Dragon's Scale` is not just another crafting component; it's the key to a potential Masterwork item, making it an incredibly exciting drop.
*   **Rich Source of Quests & Lore:** The guilds can be a major source of non-combat quests, focused on discovery, crafting, and diplomacy.

## Implementation Sketch

*   **Data:**
    *   `guilds.toml`: Defines each guild, their master artisan NPC, and their reputation tracks.
    *   `commission_recipes.toml`: A list of high-end recipes that can only be crafted via commission.
*   **Systems:**
    *   A `CommissionSystem` manages the crafting process. When an order is placed, it creates a `CraftingOrder` entity with a timer.
    *   When the timer is complete, the `MasterworkSystem` rolls a chance to upgrade the item to a Masterwork, applying the extra bonuses and unique name.
*   **UI:** A dedicated UI at each Guild Hall for browsing commissionable items and viewing the required materials.
