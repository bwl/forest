# Expanded Design: Procedural & Lore-Driven Loot

This document expands on `17-diablo-style-loot.md` to detail the procedural generation system and its hooks into the game world's lore.

## 1. The Core Problem: Scalability & Context

The challenge is twofold:
1.  **Scalability:** How to generate millions of item variations without defining millions of TOML files.
2.  **Context:** How to make a procedurally generated `Savage Iron Sword of Haste` feel like a unique artifact of *this* world, not a generic fantasy item.

The solution is a **multi-layered compositional system**. We define the ingredients and the recipes, not the finished products.

## 2. The Generation Engine: Layers of Composition

An item is not a single entity, but a composition of several data layers:

**`Item = Base Type + Material + [Affixes] + Quality + Name`**

### Layer 1: Base Types (`basetypes.toml`)

This file defines the fundamental, non-magical item templates.

*   **What it is:** The platonic ideal of an item (`Longsword`, `Leather Tunic`, `Iron Kite Shield`).
*   **Key Attributes:**
    *   `id`: `longsword`
    *   `equip_slot`: `main_hand`
    *   `base_stats`: `{ "damage": 10, "speed": 1.1 }`
    *   `item_class`: `["weapon", "sword", "one_handed"]` (Tags for affix eligibility)
    *   `material_tags`: `["metal", "wood"]` (What can it be made of?)

```toml
# data/basetypes.toml

[[item]]
id = "longsword"
name = "Longsword"
equip_slot = "main_hand"
base_stats = { damage = 10, speed = 1.1 }
item_class = ["weapon", "sword", "one_handed"]
material_tags = ["metal", "wood"]

[[item]]
id = "leather_tunic"
name = "Leather Tunic"
equip_slot = "chest"
base_stats = { armor = 15 }
item_class = ["armor", "light_armor"]
material_tags = ["cloth", "leather"]
```

### Layer 2: Materials (`materials.toml`)

Materials add inherent properties and lore context. The *type* of iron or wood matters.

*   **What it is:** The substance the `Base Type` is crafted from (`Iron`, `Steel`, `Blightwood`, `Glimmerweave`).
*   **Key Attributes:**
    *   `id`: `blightwood`
    *   `applies_to_tags`: `["wood"]`
    *   `stat_modifiers`: `{ "damage_mult": 1.05, "speed_mult": 0.95 }` (Slightly more damage, but slower)
    *   `inherent_affix_pools`: `["gloomwood_rot", "primal_growth"]` (Favors rolling affixes from these lore-specific pools)
    *   `name_fragment`: "Blightwood" (e.g., "Blightwood Longsword")

```toml
# data/materials.toml

[[material]]
id = "iron"
applies_to_tags = ["metal"]
name_fragment = "Iron"

[[material]]
id = "blightwood"
applies_to_tags = ["wood"]
stat_modifiers = { damage_mult = 1.05, speed_mult = 0.95 }
inherent_affix_pools = ["gloomwood_rot"]
name_fragment = "Blightwood"
```

### Layer 3: Affixes & Affix Pools (`affixes.toml`)

This is the heart of the magic. We introduce **Affix Pools** to tie them to lore.

*   **What it is:** Magical properties (Prefixes & Suffixes) grouped into thematic pools.
*   **Affix Pools:** A monster, region, or event determines which pools are used.
    *   A Gloomwood Wolf drops loot using the `primal_beast` and `gloomwood_rot` pools.
    *   A Dwarven ruin might use `dwarven_craftsmanship` and `ancient_runes` pools.
*   **Key Affix Attributes:**
    *   `id`: `savage`
    *   `pool`: `primal_beast`
    *   `type`: `prefix`
    *   `name`: "Savage"
    *   `valid_item_classes`: `["weapon"]`
    *   `effects`: `[{ stat = "physical_damage_percent", range = [10, 20] }]` (Tiers are handled by having different affixes, e.g., `savage` (10-20%), `ferocious` (21-30%))

```toml
# data/affixes.toml

# A prefix from a lore-specific pool
[[prefix]]
id = "savage"
pool = "primal_beast"
name = "Savage"
valid_item_classes = ["weapon"]
effects = [{ stat = "physical_damage_percent", range = [10, 20] }]

# A suffix from a different pool
[[suffix]]
id = "of_the_sentinel"
pool = "dwarven_craftsmanship"
name = "of the Sentinel"
valid_item_classes = ["armor", "shield"]
effects = [{ stat = "block_chance_percent", range = [5, 10] }]
```

### Layer 4: Procedural Naming (`names.toml`)

For Rare (Yellow) items, we generate evocative names that feel part of the world.

*   **What it is:** A collection of name fragments and patterns tied to lore themes.
*   **Key Attributes:**
    *   `patterns`: `["{Title}'s {Concept}", "{Adjective} {Noun}"]`
    *   `fragments`: Lists of words for each category, potentially tied to `affix_pools`. If an item rolls affixes from the `dwarven_craftsmanship` pool, its name can pull from a list of dwarven-sounding fragments.

```toml
# data/names.toml

[[rule]]
pools = ["dwarven_craftsmanship"]
patterns = ["{Clan}'s {Noun}", "{Adjective} {Noun}"]
fragments = {
  Clan = ["Stonehand", "Ironbeard", "Deepdelve"],
  Noun = ["Verdict", "Grasp", "Bulwark", "Resolve"],
  Adjective = ["Adamant", "Unyielding", "Sturdy"]
}

[[rule]]
pools = ["primal_beast"]
patterns = ["{Beast}'s {Part}", "{Adjective} {Noun}"]
fragments = {
  Beast = ["Wolf", "Bear", "Gryphon"],
  Part = ["Claw", "Fang", "Hide"],
  Adjective = ["Wild", "Untamed", "Bloody"],
  Noun = ["Fury", "Rage", "Hunt"]
}
```

## 3. The Generation Flow: A Worked Example

A level 10 player kills a "Gloomfang Wolf" (a monster tagged with `primal_beast` and `gloomwood_rot` loot pools).

1.  **Roll for Drop:** Success!
2.  **Choose Base Type:** The wolf's loot table includes `longsword`. The system picks it.
3.  **Choose Material:** The region is the Gloomwood, so `blightwood` is a possible material for a `longsword` (which has the `wood` tag). The system selects it. The item is now a `Blightwood Longsword` with slightly modified base stats.
4.  **Roll for Rarity:** The dice land on **Rare (Yellow)**. The system decides to roll 4 affixes.
5.  **Generate Affixes:**
    *   The generator consults the monster's pools (`primal_beast`, `gloomwood_rot`) and the material's inherent pool (`gloomwood_rot`).
    *   It randomly picks 2 prefixes and 2 suffixes from these pools that are valid for a `one_handed` `weapon`.
    *   *Roll 1 (Prefix):* `Savage` (+15% Physical Damage) from `primal_beast`.
    *   *Roll 2 (Prefix):* `Corrosive` (+8 Acid Damage) from `gloomwood_rot`.
    *   *Roll 3 (Suffix):* `of Speed` (+7% Attack Speed) from `primal_beast`.
    *   *Roll 4 (Suffix):* `of Rot` (5% chance to apply Decay) from `gloomwood_rot`.
6.  **Generate Name:**
    *   The item has affixes from `primal_beast` and `gloomwood_rot`. The naming rule for `primal_beast` is chosen.
    *   The pattern `{Beast}'s {Part}` is selected.
    *   The generator picks `Wolf` and `Fang`.
    *   The final item name is **"Wolf's Fang"**.
7.  **Final Item Instance (in memory):**
    *   **Name:** "Wolf's Fang"
    *   **Display Name:** `Rare Blightwood Longsword`
    *   **Base Type:** `longsword`
    *   **Material:** `blightwood`
    *   **Stats:** A combination of the base sword stats, modified by the material, plus all four affix effects.
    *   **Flavor:** The combination of the name and the stats tells a story. It's a weapon made from the corrupted wood of the forest, imbued with the savage, acidic nature of the beasts within it.

## 4. Summary: Answering the Core Questions

*   **How to generate a trillion variations?** By composing a few hundred `base types`, a dozen `materials`, and a few hundred `affixes` in different combinations. The math works out: `BaseTypes * Materials * (Affixes^NumAffixes)` is a massive number.
*   **How to make it contextual?**
    *   **Affix Pools:** Loot is tied to the monster that drops it and the region it's in.
    *   **Materials:** The environment influences what items are made of.
    *   **Procedural Naming:** Names are generated from thematic, lore-specific word lists.
    *   **Legendaries:** Remain hand-crafted, serving as fixed narrative anchors and build-defining cornerstones in a sea of procedural variety. They are the historical artifacts of the world.


## 5. The Blacksmith & The Economy of Scarcity

If powerful items can be found anywhere, they shouldn't be sold everywhere. This reinforces the core loop: **adventure and kill for loot**. The blacksmith and town vendors are not magical shops; they are artisans who provide services.

### The Blacksmith: A Player-Driven Artisan

The blacksmith is not a store, but a crafting station. Their primary role is to provide services that allow players to **invest in the gear they've found**, rather than just replacing it.

**Core Blacksmith Services:**

*   **Upgrading:** Improve the base stats of an item (the damage of a sword, the armor of a chest piece). This costs gold and raw materials (e.g., `Iron Ingots`, `Blightwood Planks`). This allows a low-level `Rare` item with great affixes to remain viable at higher levels.
*   **Repair:** Items have durability and must be repaired. This is a basic gold sink.
*   **Socketing:** Add a socket to an item for a high cost. This opens the door for a future gem/rune system and provides a powerful customization goal.
*   **Affix Crafting (The End-Game Sink):**
    *   **Extraction:** Destroy an item to have a chance of extracting one of its affixes into a usable "Essence" or scroll. This makes items with one great affix (but otherwise bad stats) valuable.
    *   **Modification:** Use rare, high-level materials to re-roll the numeric values of an affix on an item, or even attempt to replace one affix with another random one.

### The Economy: Services, Not Items

Vendors should primarily sell services and consumables, not powerful equipment.

*   **What Blacksmiths Sell:**
    *   Their services (as above).
    *   A small selection of `Normal` (white) quality base items.
    *   Crafting materials.
*   **What other Vendors Sell:**
    *   **Alchemists:** Potions, elixirs, reagents for affix extraction.
    *   **Scribes:** Scrolls of identification, portal scrolls.
    *   **Gamblers:** A key gold sink. Players can pay a high price for an unidentified item of a specific base type (e.g., a random `sword`). It could be a basic `Magic` item or a perfectly-rolled `Rare`.

This creates a powerful and rewarding gameplay loop:

1.  **Adventure:** Kill monsters, get procedural loot.
2.  **Salvage:** Sell unwanted `Magic` and `Rare` items back to vendors, but instead of just gold, you get **crafting materials**.
3.  **Invest:** Use those materials and gold at the Blacksmith to upgrade, socket, and perfect your best-found items.

This makes every drop potentially valuable, either as an upgrade, a source for a powerful affix, or as raw material for improving your existing gear.
