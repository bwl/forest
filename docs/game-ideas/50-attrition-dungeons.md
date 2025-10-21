# Awesome Idea: No-Heal "Attrition" Dungeons

## Concept

This system introduces a special category of high-stakes dungeons designed as the ultimate test of a player's skill. Inside an **Attrition Dungeon**, all conventional forms of healing are nullified. Healing potions are inert, regenerative spells fizzle out, and resting provides no comfort. Health becomes a finite, non-renewable resource. Every hit point lost is a permanent consequence for that run, turning the dungeon crawl into a tense, strategic battle of pure attrition.

## Core Mechanics

### 1. The Null-Healing Aura

*   Upon entering an Attrition Dungeon, the player is afflicted with a special status effect: `"Mortal Coil."`
*   This aura has one effect: `All incoming healing is reduced to zero.`
*   The UI clearly communicates this. The player's health bar might have a cracked, grayed-out appearance, and a special icon appears on the HUD.
*   The log states: `A chilling aura settles over you. You feel your connection to life-giving magic sever. You cannot heal here.`

### 2. Limited Sources of Restoration

While direct healing is impossible, there are a few, extremely limited ways to regain health, making them incredibly valuable strategic resources.

*   **Life-Siphoning Altars:** Each floor might have a single, one-time-use altar. Interacting with it might restore a percentage of your health, but at a cost (e.g., sacrificing a valuable item, gaining a temporary curse).
*   **Vampiric Gear:** The `Life Leech` affix on weapons (from the Diablo-style loot system) becomes supremely powerful in these dungeons, perhaps the only reliable way to sustain a run.
*   **Cannibalizing Monsters:** A special, rare ability or item might allow the player to consume a corpse to regain a tiny amount of health, at the cost of Sanity.

### 3. The Focus on Avoidance

Since damage is effectively permanent, the gameplay focus shifts entirely.

*   **Damage Mitigation is Key:** Armor, shields, and defensive abilities are far more valuable than raw damage output.
*   **Crowd Control is Essential:** Stunning, rooting, or slowing enemies to prevent them from ever attacking is the optimal strategy.
*   **Stealth & Avoidance:** Sneaking past a difficult encounter is always a valid and often superior choice to fighting it head-on.
*   **Environmental Kills:** Using props and hazards to kill enemies without ever entering melee range becomes a primary tactic.

## Gameplay & Narrative Impact

*   **The Ultimate Tactical Challenge:** These dungeons are the final exam for a player who has mastered the game's combat systems. They require flawless play and deep strategic thinking.
*   **Makes Every Decision Matter:** Every single step, every single turn, has immense weight. Taking 10 points of avoidable damage from a simple trap feels catastrophic.
*   **High-Tension Gameplay:** The experience of being deep in an Attrition Dungeon with only a sliver of health remaining is one of the most intense and memorable experiences a player can have.
*   **Legendary Rewards:** The rewards for successfully clearing an Attrition Dungeon must be extraordinary. This is where you would place the rarest crafting materials, the most powerful Legendary items, or major quest objectives.
*   **Lore:** These dungeons can be framed as cursed places, realms where the gods of life have no power, or the domains of entities that feed on vitality itself.

## Implementation Sketch

*   **Data:**
    *   Dungeons can have a `[properties]` table in their `toml` file.
    *   `is_attrition_dungeon = true`
*   **Systems:**
    *   A `DungeonAuraSystem` checks the properties of the current dungeon.
    *   If `is_attrition_dungeon` is true, it applies the `Mortal Coil` status effect to the player upon entry.
    *   The `HealingSystem` is modified to check for this status effect. If it's present, the system returns `0` for any healing calculation.
*   **UI:** The health bar's visual state change is critical. It needs to immediately and clearly communicate to the player that the rules have changed.
