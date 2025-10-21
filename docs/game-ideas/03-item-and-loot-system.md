## Prompt:
Could you please describe a robust loot system -- wherein like classic rogue games potions and scrolls are unidentified on first find. We need a way to attach powers to potions and scrolls in a modular fashion so the main structure doesn't get overloaded with per potion specifics. We are using ECS. Weapons and Armor should be considered as well because their powers would probably best be integrated in the same Powers system that the potions and scrolls use

## Response:
Thought for 5s

I need to focus on creating a concrete loot system design, incorporating unidentified items, modular powers, weapons, and armor. I should include systems for generation, identification, randomization, and modifiers like affixes or curses. I'll provide pseudocode, example schemas, and ECS components like LootGenerationSystem and IdentificationSystem. Also, handling item effects with a power archetype and interactions with UI—while keeping things concise but clear.

Done

got it—here’s a clean, ECS-friendly loot/ID system that covers potions, scrolls, weapons, and armor with the same modular **Power** model, including Angband/roguelike identification.

Goals
=====

*   Unidentified until learned per-run; names/colors scrambled each run.
*   One **Power** model reused by consumables and equipment.
*   Data-driven; item archetypes contain **no hardcoded behavior**—only components and parameters.
*   Supports stacking, charges, cursed items, appraisal, partial identification.

Core ideas
==========

1.  **Power** is a data object + executor. Items don’t “do” things; powers do.
2.  **Delivery** describes _how_ a power is applied (drink, read, hit, worn, aura, trap, etc.).
3.  **Trigger** describes _when_ the power fires (onUse, onEquip, onHit, onTurn, onKill…).
4.  **Identification** is a player-knowledge mapping from _skin_ (e.g., “ochre potion”) ⇄ _power bundle_.
5.  **Affixes** (prefix/suffix) are just power bundles attached to equipment with triggers.

* * *

ECS components
==============

**Common**

*   `Item`: { weight, valueBase, stackable, slot? }
*   `Rarity`: { tier, weight }
*   `Appearance`: { category: Potion/Scroll/Weapon/Armor, skinId } // “ochre potion”, “rune-etched scroll”
*   `KnownBy`: { set<PlayerId> } // who fully knows this item’s mapping
*   `IdentifyProgress`: { hints:\[Hint\], progress:0..1 } // appraisal, partial ID
*   `Cursed`: { severity, sticky:boolean } // if present, blocks unequip or adds side effects
*   `Charges`: { current, max } // for wands/staves/charged gear
*   `Stack`: { keyHash } // items stack when keyHash equal (see below)
*   `GeneratedWithSeed`: { seed } // reproducibility

**Power model**

*   `PowerBundle`: { bundleId, powers:\[PowerRef\] } // 1..N powers
*   `PowerRef`: { powerArchetypeId, params, tags } // e.g., Heal{amount:20}, Teleport{range:30}
*   `Delivery`: { method, castTime, consumesItem? } // Drink/Read/Activate/OnHit/OnEquip/Passive
*   `Trigger`: { kind, filter?, cooldown? } // onUse/onEquip/onHit/onTurn/onKill/etc.
*   `Requires`: { conditions } // e.g., Requires{lineOfSight:true}
*   `Targeting`: { self|single|radius, shape, range }

**Equipment**

*   `Equip`: { slot:"Weapon"/"Body"/"Head"/…, twoHanded? }
*   `Affixes`: { list<PowerBundleRef>, nameParts } // prefix/suffix naming & UI
*   `Durability` (optional)

**Identification knowledge (not a component)**

*   `RunIdentityTable` (per run):  
    `PotionSkin → BundleId`, `ScrollSkin → BundleId` (a permutation sealed at run start)  
    `PlayerKnowledge`: { discoveredBundles:Set<BundleId>, seenSkins:Set<SkinId>, namedSkins:Map<SkinId,String> }

* * *

Data assets (all external / JSON, ScriptableObject, etc.)
=========================================================

```json
// Example power archetypes (reusable everywhere)
{ "id":"Heal", "params":{"amount": "int"}, "tags":["positive","recover"], "exec":"Heal" }
{ "id":"Teleport", "params":{"range":"int"}, "tags":["mobility"], "exec":"Teleport" }
{ "id":"DetectTraps", "params":{"radius":"int","duration":"turns"}, "exec":"ApplyAura" }
{ "id":"FireBrand", "params":{"bonus":"int"}, "tags":["offense"], "exec":"AddDamageType" }
{ "id":"ACBoost", "params":{"amount":"int","duration":"turns"}, "exec":"ModifyStat" }
```

```json
// Bundles (what a “mystery item” actually does)
{ "id":"BND_Potion_Healing_S", "powers":[{"powerArchetypeId":"Heal","params":{"amount":25}}] }
{ "id":"BND_Scroll_Teleport", "powers":[{"powerArchetypeId":"Teleport","params":{"range":30}}] }
{ "id":"BND_Weapon_FlameBrand_1",
  "powers":[{"powerArchetypeId":"FireBrand","params":{"bonus":1}}],
  "delivery":{"method":"OnHit"} }
```

```json
// Item skins (visuals/lore only)
{ "id":"SKN_Potion_Ochre",  "category":"Potion", "adjectives":["ochre","muddy"], "glyph":"!" }
{ "id":"SKN_Scroll_Runes",  "category":"Scroll", "adjectives":["rune-etched"], "glyph":"?" }
```

* * *

Generation flow
===============

1.  **At run start**
    *   Build a **permutation**: shuffle `PotionSkins` and assign to `PotionBundles` by rarity buckets; same for scrolls.
    *   Optionally bias so early floors expose a helpful subset (healing, light, detect).
    *   Initialize `PlayerKnowledge` empty.
2.  **When generating loot entity**
    *   Choose `category` → roll table by rarity/branch.
    *   If Potion/Scroll: pick a **skin**; look up **bundleId** from the `RunIdentityTable`; attach `PowerBundle{bundleId}`, `Delivery{Drink/Read}`, `Trigger{onUse}`.
    *   If Weapon/Armor: pick a base item (size/slot/dice), then roll 0–2 **Affixes** (prefix/suffix); each affix is a `PowerBundle` with `Trigger{OnHit/OnEquip/Passive}`.
    *   Compute `Stack.keyHash = hash(category, bundleId, potencyTier, skinId?)`.  
        (Use **bundleId** and **potency** so items stack even if skins differ—optional; classic roguelikes usually require identical _appearance_ to stack. Pick your rule.)
3.  **Seed**
    *   Store `GeneratedWithSeed` for reproducibility and debugging.

* * *

Identification flow
===================

*   **Observation hints** (optional): add to `IdentifyProgress` when player _sees_ an effect (e.g., “you feel lighter” → +0.25 toward knowing “Speed”).
*   **Explicit identification**:
    *   Using the item (drink/read) **consumes** it and **reveals** its `BundleId` to `PlayerKnowledge`, which also reveals **all items sharing that bundle** (every ochre potion this run becomes “Potion of Healing”).
    *   Scrolls of Identify: a power that marks `KnownBy` for a target item’s bundle.
    *   Appraisal skill: background system increments `IdentifyProgress`; at threshold reveal full name or partial (“probably a healing potion”).
*   **UI naming**
    *   If unknown: show skin (“ochre potion”) and add a letter tag (a–z).
    *   If known: replace with revealed name (“Potion of Healing”) everywhere.
    *   Partial: “ochre potion (warm and soothing?)”.

* * *

Using items (systems)
=====================

**ItemUseSystem**

*   On `UseRequest(entity)`:
    1.  Validate `Delivery` + `Requires` + `Targeting`.
    2.  Dispatch to **PowerExecutionSystem** passing the _list of PowerRefs_ from `PowerBundle`.
    3.  If `Delivery.consumesItem`: decrement `Stack` or destroy entity.
    4.  Emit `IdentificationEvent{bundleId, cause:Use}`.

**PowerExecutionSystem**

*   For each `PowerRef` in bundle:
    *   Lookup `exec` function by `powerArchetypeId`.
    *   Apply with `params` and current `context` (user, target, position).
*   This system also services equipment triggers:
    *   Subscribes to global events (`OnTurn`, `OnHit`, `OnKill`, `OnEquip/Unequip`), filters by `Trigger` and `tags`, executes powers.

**IdentificationSystem**

*   Listens to `IdentificationEvent` and appraisal ticks; updates `PlayerKnowledge`, `KnownBy`, `IdentifyProgress`.

* * *

Weapons/Armor via the same model
================================

*   A **base sword** entity has: `Item`, `Equip{slot:Weapon}`, maybe `Damage{dice}`.
*   Affixes attach **PowerBundles**:
    *   `Flaming` prefix → `Delivery:OnHit`, `Trigger:onHit(weapon)`, `Power:FireBrand{+1}`.
    *   `Of Speed` suffix → `Delivery:OnEquip`, `Trigger:onEquip`, `Power:Haste{duration:whileEquipped}`.
*   Curses are simply bundles with bad powers, often `Delivery:OnEquip` + `Cursed{sticky:true}` (blocks unequip until remove-curse power fires).

* * *

Triggers (suggested set)
========================

*   `OnUse`, `OnEquip`, `OnUnequip`, `OnHit`, `OnCrit`, `OnKill`, `OnHurt`, `OnTurn`, `OnMove`, `OnBlock`, `OnCast`, `OnLowHP`, `OnIdentify` (meta), `WhileEquipped` (stat auras).

Each trigger is **data**, so new affixes/consumables don’t add code—only new `powerArchetype` executors when truly new behavior appears.

* * *

Example: three items using the same Power system
================================================

**Ochre Potion (unknown at drop)**

```yaml
Appearance:  { category:Potion, skinId:SKN_Potion_Ochre }
PowerBundle: { bundleId:BND_Potion_Healing_S }
Delivery:    { method:Drink, consumesItem:true }
Trigger:     { kind:OnUse }
```

**Rune-etched Scroll**

```yaml
Appearance:  { category:Scroll, skinId:SKN_Scroll_Runes }
PowerBundle: { bundleId:BND_Scroll_Teleport }
Delivery:    { method:Read, consumesItem:true }
Trigger:     { kind:OnUse }
```

**Longsword of the Flame**

```yaml
Equip:       { slot:Weapon }
Affixes:
  - { bundleId:BND_Weapon_FlameBrand_1 }    # applies on hit
Trigger:     (on the bundle) { kind:OnHit }
```

* * *

Balancing knobs
===============

*   **Rarity buckets** per branch/depth; permutation is done _within_ buckets, so “Healing” stays common but changes skin each run.
*   **Potency tiers** (`_S/_M/_L` bundles) allow depth scaling without new code.
*   **Safety**: First three floors whitelist a subset; later floors unlock harmful bundles.
*   **Affix weights** by slot + mutual exclusion tags (e.g., no `FireBrand` + `IceBrand` together unless `Hybrid` ok).

* * *

Stacking & identity rules
=========================

Pick one and be consistent:

*   **Strict visual stacking** (classic): stack only if `skinId` _and_ `bundleId` _and_ `potency` match. Unknown but different skins never stack.
*   **Functional stacking** (modern): stack if `bundleId` + `potency` match; skin is a label.

* * *

Pseudocode (systems skeleton)
=============================

```python
# On run start
RunIdentityTable = permute_by_bucket(PotionSkins, PotionBundles, seed)
RunIdentityTable.update(permute_by_bucket(ScrollSkins, ScrollBundles, seed))

# Loot generation
def make_potion(skinId):
    bundle = RunIdentityTable.potion_bundle_for(skinId)
    return Entity(
        Item(...), Appearance(category="Potion", skinId=skinId),
        PowerBundle(bundleId=bundle), Delivery(method="Drink", consumesItem=True),
        Trigger(kind="OnUse"))

# Use → execute powers
def on_use(entity, user, target):
    bundle = entity.get(PowerBundle)
    for pref in bundle.powers:
        exec_power(pref, context(user, target))
    if entity.get(Delivery).consumesItem: consume(entity)
    events.emit(IdentificationEvent(bundle.bundleId, cause="Use"))

# Identify
def on_identify(evt, player):
    player.knowledge.discoveredBundles.add(evt.bundleId)
    mark_all_items_with_bundle_as_known(evt.bundleId, player)
```

* * *

Testing checklist
=================

*   Drinking two different “ochre” potions in different runs yields different effects.
*   Identifying “Teleport” via scroll reveals _all_ rune-etched scrolls this run.
*   OnEquip curses apply instantly; Remove Curse scroll lifts `Cursed.sticky`.
*   Affix powers fire via triggers without special-case weapon code.
*   Save/load restores RunIdentityTable and PlayerKnowledge.

* * *

If you want, I can convert this into concrete TypeScript/Bevy/Rust ECS components and a tiny reference dataset you can drop in to validate flows (gen → use → reveal → affix triggers).

## Prompt:
i have an Adom type overworld with multiple dungeons — maybe i could scope item drops by floor and poi?

## Response:
yes—scoping drops by **floor** and **point-of-interest (POI)** works great for an ADOM-style overworld, and it plugs neatly into the modular Power/Bundles model we set up. Here’s a pragmatic design you can ship.

Core idea
=========

Every drop is drawn from a **LootContext** built from:

```
{ region, biome, dungeonId, floor, poiTags[], dangerTier, worldState }
```

This context selects/weights **LootTables** (data assets) and applies **Modifiers**. The leaf entries are **ItemArchetypes** (weapons/armor bases) and **BundleArchetypes** (potions/scrolls/affixes) — i.e., the same Power bundles used everywhere.

* * *

Data model (lean)
=================

**LootTable**

*   `id`
*   `scope`: predicates over context (e.g., `dungeonId=="Tomb" && floor 5..9`)
*   `entries`: list of `{ kind:"Item"|"Bundle"|"Currency", refId, weight, minFloor?, maxFloor?, tags? }`
*   `rolls`: `Dice` (e.g., `1d2`) — how many times to roll this table
*   `budget?`: optional EV control (see below)
*   `exclusions?`: tag filters (“no fire”)
*   `mutators?`: list of `LootModifierRef` (applied if table chosen)

**LootModifier**

*   `id`, `scope`, `ops[]`
*   ops include: `weight+=x%` for entries with tag, `injectEntry(ref,weight)`, `retag`, `rarityClamp(min,max)`, `curseRate=…`, `potencyBias=…`

**POI**

*   owns `poiTags[]` (e.g., `"undead"`, `"library"`, `"forge"`, `"spring"`, `"bandit"`, `"boss"`, `"quest"`)

**Region/Biome**

*   similar tags, plus **identity partition** options (explained below).

* * *

Selection algorithm (per drop)
==============================

1.  **Assemble active tables**  
    `active = { tables where table.scope(context)=true }`
2.  **Apply table-level weights**  
    Optional parent tables like “GlobalDungeonFloor” (broad) and “Tomb\_F5\_9” (specific). You can either sum all or pick best-match first; I recommend **layered rolling**:
    *   Roll 1 from “broad tier” (e.g., GlobalDungeonFloor)
    *   Roll 0–2 from “region tier”
    *   Roll 1 from “POI tier”  
        This mixes identity without losing baseline supplies.
3.  **Merge & modify**  
    Combine entries from selected tables; apply `LootModifiers` from region + POI + worldState (e.g., winter event).
4.  **Budget/EV guard (optional)**  
    Each floor may carry a **loot budget** (gold value, power score). Keep sampling until budget consumed or rolls exhausted. This tames streaks without feeling like a pity timer.
5.  **Draw entries**  
    Weighted choice → produce `Item` or `Bundle` with **potency tier** chosen by the floor’s `dangerTier curve`.
6.  **Attach identity**  
    For potions/scrolls, pull the **bundleId** from the run’s identity table (global or partitioned; see next section).
7.  **Post-rules**  
    Apply curse rate, durability floors, affix counts, stack sizes by context.

* * *

Identity permutation scope (important!)
=======================================

You have 3 good options:

1.  **Global permutation (classic):**  
    One mapping for the entire run. Learn “ochre = healing” once, know it everywhere. Easiest for players.
2.  **Region-partitioned:**  
    Each _region/dungeon cluster_ has its own potion/scroll mapping; surface towns share a global mapping. Encourages re-learning per region (ADOM-ish). Implementation: `RunIdentityTable` keyed by `identityPartitionId` from context.
3.  **POI-themed overlays:**  
    Keep global mapping, but **reroll a small subset** (e.g., 10%) for special POIs (faerie groves, chaos rifts). Signals in UI (“the air shimmers strangely… your potion lore feels off”).

Pick one and commit; I’d default to **Global** + rare POI overlays.

* * *

Depth curves (simple, powerful)
===============================

Define **danger tiers** by floor:

```
tier = clamp( floor / dungeonDepth * 5 )  // 0..5
```

Use tier to:

*   Clamp **rarity** (`common..legendary`).
*   Bias **potency** (`S/M/L/XL`).
*   Set **curse rate** ramp (e.g., 5% → 20%).
*   Set **affix count** on equipment (0–2 → 1–3).

* * *

POI recipes (drop identity by place)
====================================

*   **Library (poiTags: "library", "arcane")**
    *   +weights: scroll bundles (Identify, Mapping, Teleport, Confusion)
    *   −weights: melee affixes
    *   inject: 1 guaranteed “knowledge” scroll on first visit
*   **Forge (“smithy”, “dwarf”)**
    *   ++weights: weapon/armor bases, `OnHit` brand bundles
    *   affix count +1 (up to cap)
    *   curse rate −50%
*   **Graveyard (“undead”)**
    *   ++weights: cold/turn-undead/holy bundles, anti-undead brands
    *   inject: cursed junk (broken armor), curse rate +15%
*   **Grove (“fae”, “alchemy”)**
    *   potion bundles up-weighted; 10% identity overlay reroll
    *   add rare “herb” consumables (same Power system, Delivery:Eat)

* * *

Tables & modifiers (examples)
=============================

```yaml
# Global baseline for all dungeons (floors 1..)
- id: Global_Floor
  scope: floor >= 1
  rolls: 1d2
  entries:
    - { kind: Bundle, refId: BND_Potion_Healing_S,   weight: 20, maxFloor: 12, tags:["potion","healing"] }
    - { kind: Bundle, refId: BND_Scroll_Identify_S,  weight: 12, maxFloor: 10, tags:["scroll","identify"] }
    - { kind: Item,   refId: Base_ShortSword,        weight: 10, tags:["weapon","tier1"] }
    - { kind: Item,   refId: Base_LeatherArmor,      weight: 10, tags:["armor","tier1"] }
    - { kind: Bundle, refId: BND_Wand_Light_S,       weight: 8,  tags:["wand"] }

# Region: Tomb floors 5-9 leans cold/undead
- id: Tomb_F5_9
  scope: dungeonId=="Tomb" && floor>=5 && floor<=9
  rolls: 1d1
  entries:
    - { kind: Bundle, refId: BND_Scroll_TurnUndead, weight: 12, tags:["scroll","holy"] }
    - { kind: Bundle, refId: BND_Weapon_ColdBrand_1, weight: 6, tags:["affix","cold"] }
    - { kind: Item,   refId: Base_MorningStar,      weight: 6, tags:["weapon","blunt"] }

# POI modifier: Library
- id: POI_Library_Mod
  scope: poiTags has "library"
  ops:
    - { op: "boostTag", tag:"scroll", amountPct: +100 }
    - { op: "suppressTag", tag:"affix", amountPct: -50 }
    - { op: "inject", entry:{kind:Bundle, refId:BND_Scroll_Identify_S, weight:100}, when:"firstVisit" }
```

* * *

ECS hook-up (clean separation)
==============================

*   **LootContextComponent** on the drop spawner (room, monster, chest) or passed in the event.
*   **LootSpawnerSystem**:
    *   reads `LootContext`
    *   resolves tables + modifiers
    *   outputs a list of `LootSpec` (archetype id + potency + affix rolls)
    *   instantiates item entities (with PowerBundle/Affixes as before)
*   **FloorBudgetSystem** (optional):
    *   tracks `budgetRemaining` on each floor node
    *   after each spawn, subtract EV; if negative, future spawns downweight until reset

* * *

Practical knobs
===============

*   **Guarantees/Quotas**: per-floor “must drop 1 healing consumable within first 3 rooms”; per-run quotas for vital utilities (light, identify, food).
*   **Streak breakers**: if player used 2 Identify and hasn’t seen Teleport yet by floor 6, set weight floor for `Teleport`.
*   **Branch identity**: each dungeon gets ~3 distinctive tags (e.g., `cold`, `poison`, `ranged`) that feed table scopes and affix pools.
*   **Boss/cache rules**: boss POIs get a _separate_ “Chest\_Boss\_TierN” table with guaranteed rarity ≥ epic and affix count bias.

* * *

Pseudocode (selection)
======================

```python
def roll_loot(ctx, seed):
    rng = RNG(seed)
    tables = select_tables(ctx)           # scopes true
    bundle = merge_entries(tables)        # + apply modifiers
    entries = budget_filter(bundle, ctx)  # optional EV guard
    drops = []
    for _ in num_rolls(tables, rng):
        e = weighted_pick(entries, rng)
        drops.append(instantiate(e, ctx, rng))
    return drops

def instantiate(entry, ctx, rng):
    if entry.kind == "Bundle":
        # potions / scrolls / affixes use identity table
        bundleId = entry.refId
        if is_consumable_bundle(bundleId):
            skin = pick_skin(ctx, rng)  # visual only
            bundleId = identity_map(ctx.identityPartitionId).bundle_for_skin(skin)
            return make_consumable(skin, bundleId, ctx)
        else:
            return make_affix(bundleId) # will be attached to base if this came from an equipment table
    elif entry.kind == "Item":
        item = make_base_item(entry.refId, ctx)
        # maybe roll affixes from affix-subtable using same ctx
        for _ in range(roll_affix_count(ctx, rng)):
            aff = weighted_pick(affix_table(ctx), rng)
            attach_affix(item, aff.bundleId)
        return item
```

* * *

Scoping cheat-sheet
===================

*   **By floor** → danger tier curve, potency clamps, curse/rarity ramps.
*   **By region/biome** → thematic tags (cold, poison, fae, divine), affix availability.
*   **By dungeon** → base item lists, special bundles.
*   **By POI** → temporary, strong modifiers; guarantees on first visit.
*   **By world state** → seasonal events, quests completed (“shops stock holy water for 3 floors”).

* * *

Quick defaults (if you want to start tomorrow)
==============================================

*   Global identity mapping (per run).
*   3 loot layers per drop: Global\_Floor (1 roll), Region (0–1), POI (0–1).
*   Danger tier: `tier=floorIndex * 5 / dungeonDepth`.
*   EV budget per floor: `200 + 50 * tier` (abstract value).
*   Curse rate: `5% + 3% * tier`, halved in sanctuaries, doubled in graveyards.
*   Affixes: `min(2, 1 + tier//2)` on rares and up.

This gives you ADOM-style variety with reliable utilities and strong regional identity, all while reusing your ECS **PowerBundle** pipeline.
