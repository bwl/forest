# Awesome Idea: Synergistic Skill Trees

## Concept

This system replaces a simple, linear perk list with branching skill trees that encourage creative character builds. While each tree is powerful on its own, the most exciting abilities—"Synergy Perks"—only become available when a player invests in perks from multiple, seemingly unrelated trees. This rewards thoughtful character planning and allows for a vast number of unique, hybrid playstyles.

## Core Mechanics

### 1. Branching Skill Trees

*   Upon leveling up, the player gains a skill point to invest in one of several main skill trees. Examples:
    *   **Warrior Tree:** Focuses on melee combat, defense, and stamina.
    *   **Mage Tree:** Focuses on elemental spells, mana, and magical effects.
    *   **Ranger Tree:** Focuses on archery, traps, and survival.
    *   **Alchemist Tree:** Focuses on potions, poisons, and explosives.
*   Each tree has multiple branches. For example, the Mage tree might split into `Pyromancy`, `Cryomancy`, and `Arcane` branches.

### 2. Standard Perks

*   Most nodes in the trees are standard perks that provide clear, incremental bonuses.
*   **Warrior Perk:** `+10% Sword Damage`
*   **Mage Perk:** `+15% Fire Spell Area of Effect`
*   **Ranger Perk:** `Your arrows have a 10% chance to slow enemies.`

### 3. Synergy Perks

These are special perks that appear on the branches between the main trees. They have multiple prerequisites.

*   **Prerequisite:** To unlock a Synergy Perk, the player must have invested a certain number of points in the two (or more) connected trees.
*   **Example Synergies:**
    *   **Spellblade (Warrior + Mage):**
        *   *Requires:* 5 points in Warrior, 5 points in Mage.
        *   *Effect:* `When you cast a spell, your next melee attack deals bonus elemental damage.`
    *   **Explosive Trap (Ranger + Alchemist):**
        *   *Requires:* 5 points in Ranger, 5 points in Alchemist.
        *   *Effect:* `Your traps now explode on trigger, dealing fire damage to all nearby enemies.`
    *   **Iceblood Hunter (Ranger + Mage/Cryomancy):**
        *   *Requires:* 5 points in Ranger, 5 points in Cryomancy.
        *   *Effect:* `You deal 20% more damage to frozen or chilled enemies.`
    *   **Battle Alchemist (Warrior + Alchemist):**
        *   *Requires:* 5 points in Warrior, 5 points in Alchemist.
        *   *Effect:* `Drinking a potion also grants you a temporary armor buff.`

## Gameplay & Narrative Impact

*   **Deep Character Customization:** This system moves beyond the simple archetypes of "warrior," "mage," etc. Players can create a `Pyromaniac Berserker`, a `Trap-setting Poison-Master`, or a `Frost-Archer`.
*   **Rewards Planning:** Players are encouraged to look ahead and plan their builds to unlock powerful synergies. The choice at level 5 might be made with a level 20 synergy in mind.
*   **High Replayability:** The sheer number of possible hybrid builds provides a strong incentive for multiple playthroughs.
*   **Emergent Gameplay:** Synergies can lead to powerful and sometimes unexpected combinations of abilities, which is a joy for players to discover.

## Implementation Sketch

*   **Data (`skill_trees.toml`):**
    ```toml
    [tree.warrior]
    name = "Warrior"

    [[tree.warrior.perks]]
    id = "sword_damage_1"
    name = "Honed Blade"
    description = "+10% Sword Damage"
    cost = 1
    requires = []

    [tree.mage]
    # ...

    [[synergy_perk]]
    id = "spellblade"
    name = "Spellblade"
    description = "Your next melee attack after casting a spell deals bonus elemental damage."
    cost = 2
    requires = [{ tree = "warrior", points = 5 }, { tree = "mage", points = 5 }]
    ```
*   **Systems:**
    *   A `SkillSystem` manages the player's skill points and tracks which perks they have unlocked.
    *   The `PowerBundle` or a similar character stat system would be responsible for applying the passive effects of these perks.
    *   For active abilities unlocked via perks, the `SkillActionSystem` from the previous idea would handle their execution.
*   **UI:**
    *   A dedicated, graphical skill tree screen is essential. It should clearly show the different trees, the connections between them, and the Synergy Perks that bridge them.
    *   The UI should make it easy to see the prerequisites for each perk and plan out future builds.
