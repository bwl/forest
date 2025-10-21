# Awesome Idea: Stance-Based Combat

## Concept

This system introduces a layer of tactical choice to the player's every move. At any time, the player can switch between a small number of distinct **Combat Stances**. Each stance provides a unique set of passive bonuses and penalties, and grants access to a different set of special abilities. This moves combat beyond simply choosing which attack to use, and into a deeper loop of choosing your entire combat philosophy for the current situation.

## Core Mechanics

### 1. The Stances

The player can switch between 3-4 core stances. Switching stances might consume a small amount of stamina or end the player's turn to prevent rapid, consequence-free changes.

*   **Aggressive Stance (The Berserker):**
    *   **Passives:** `+20% Damage Dealt`, `-15% Armor and Evasion`.
    *   **Abilities Unlocked:**
        *   `Cleave:` A wide, sweeping attack that hits 3 tiles in front of you.
        *   `Reckless Charge:` Dash forward 3 tiles, dealing damage to the first enemy hit, but leaving you briefly vulnerable.

*   **Defensive Stance (The Guardian):**
    *   **Passives:** `+20% Armor and Block Chance`, `-15% Damage Dealt`, `Cannot be pushed`.
    *   **Abilities Unlocked:**
        *   `Shield Bash:` Deals low damage but has a high chance to Stagger an enemy.
        *   `Hunker Down:` For one turn, double your armor but you cannot move.

*   **Mobile Stance (The Skirmisher):**
    *   **Passives:** `-25% Stamina cost for movement`, `+10% Evasion`.
    *   **Abilities Unlocked:**
        *   `Disengage:` A quick hop backwards one tile, creating space.
        *   `Harrying Strike:` A quick melee attack that also applies a minor `Slow` effect.

*   **Balanced Stance (The Duelist):**
    *   **Passives:** No major bonuses or penalties.
    *   **Abilities Unlocked:**
        *   `Riposte:` If you are attacked in this stance, you have a chance to automatically counter-attack for low damage.
        *   `Feint:` A deceptive attack that has a higher chance to hit, but deals slightly less damage.

### 2. Synergy with Other Systems

Stances interact deeply with the other combat systems.

*   **Telegraphing:** See a telegraphed AoE attack coming? Switch to `Mobile Stance` to `Disengage` and get out of the way.
*   **Stagger:** Need to break a tough enemy's poise? Switch to `Defensive Stance` and use `Shield Bash`.
*   **Equipment:** Certain weapons or armor could grant bonuses to specific stances. A `Tower Shield` might increase the effectiveness of `Hunker Down`. A `Berserker's Axe` might grant a life-leech effect while in `Aggressive Stance`.

### 3. Enemy Stances

To increase tactical depth, high-level enemies and bosses can also use stances.

*   The player will see a visual indicator when an enemy switches stance.
*   `The Orc Warlord enters a Defensive Stance!` This is a clear signal to the player that direct attacks will be less effective, and they might need to switch to a different strategy, like using magic or trying to stagger him.

## Gameplay & Narrative Impact

*   **Deepens Tactical Choices:** Every turn offers a meaningful choice beyond just "attack" or "move." The core question becomes, "What is the right philosophy for this moment?"
*   **Player Expression:** The stances allow players to define their character's fighting style. A player who favors the `Aggressive Stance` will play very differently from one who masters the `Mobile Stance`.
*   **Creates a Dynamic Flow:** Combat becomes a fluid dance of switching stances to meet the demands of the battlefield. You might charge in with `Aggressive Stance`, switch to `Defensive` to weather a counter-attack, and then use `Mobile` to reposition.
*   **Readable AI:** When an enemy changes stance, it clearly communicates a shift in its strategy, allowing the player to adapt accordingly.

## Implementation Sketch

*   **Data:**
    *   `stances.toml`: Defines each stance, its passive stat modifiers, and the abilities it grants.
*   **Systems:**
    *   The player entity has a `CurrentStance` component.
    *   When the player switches stances, the `StanceSystem` removes the old passive modifiers and applies the new ones.
    *   The `AbilitySystem` checks the player's `CurrentStance` to determine which special abilities are available to use.
*   **UI:** The current stance should be clearly visible on the main HUD, perhaps as an icon next to the health bar. The hotbar for abilities should dynamically update to show the skills available in the current stance.
