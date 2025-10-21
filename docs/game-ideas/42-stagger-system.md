# Awesome Idea: The Stagger System

## Concept

This system adds a second resource bar to enemies, alongside their health: the **Stagger Bar**. This bar represents the enemy's poise, balance, and concentration. Instead of just whittling down HP, the player can actively work to break an enemy's stance. Filling the Stagger Bar incapacitates the enemy for a short time, creating a critical window of opportunity. This encourages an offensive, rhythmic style of play and rewards players for aggression and smart tactics.

## Core Mechanics

### 1. The Stagger Bar

*   Visible beneath the enemy's health bar, the Stagger Bar starts empty and fills up as the player lands effective hits.
*   The bar slowly drains over time if the enemy is not being attacked, preventing the player from chipping away at it too slowly.

### 2. Building Stagger

Different actions fill the Stagger Bar by different amounts. This is not about raw damage, but about the *impact* of an attack.

*   **Heavy Attacks:** Slow, powerful weapons like greatswords and hammers deal significant stagger damage.
*   **Exploiting Weaknesses:** Hitting a fire-based enemy with an ice spell deals massive stagger damage.
*   **Interrupting Telegraphs:** Successfully interrupting a telegraphed attack (from the "Telegraphing AI" system) might instantly fill a large portion of the Stagger Bar.
*   **Parrying/Blocking:** A perfectly timed block or parry can reflect stagger back onto the attacker.
*   **Light Attacks:** Fast attacks from daggers or short swords deal very little stagger damage, but can be used to keep the bar from draining between heavy hits.

### 3. The Staggered State

When the Stagger Bar is filled, the enemy enters the **Staggered** state.

*   **Action Canceled:** Whatever the enemy was doing—even a powerful telegraphed attack—is immediately canceled.
*   **Defenseless:** The enemy is unable to move, attack, or defend for 1-2 turns.
*   **Guaranteed Criticals:** All attacks against a Staggered enemy are automatic critical hits.
*   **Visual Feedback:** The enemy slumps over, their ASCII art might change to a dizzy/confused state, and a `[STAGGERED!]` text effect appears.
*   After the duration, the Stagger Bar resets to empty, and the enemy resumes fighting.

### 4. Enemy Variations

Different enemies have different Stagger Bars and resistances.

*   **Large, armored enemies (Trolls, Golems):** Have a very large Stagger Bar, making them difficult to break. The player must focus on sustained, heavy attacks.
*   **Nimble, fast enemies (Goblins, Wolves):** Have a small Stagger Bar that fills quickly, but it also drains very rapidly, requiring constant pressure.
*   **Casters & Archers:** Might have a Stagger Bar that is highly susceptible to being filled by melee attacks, encouraging the player to close the distance.
*   **Bosses:** May have multiple Stagger phases or require specific mechanics to be staggered (e.g., "You must destroy its armor plates before you can stagger it").

## Gameplay & Narrative Impact

*   **Encourages Offense:** This system rewards players for staying on the attack and pressing their advantage, rather than just passively trading blows.
*   **Creates a Combat Rhythm:** The flow of combat becomes a satisfying loop of `Pressure -> Stagger -> Punish`. Players will learn the right combinations of light and heavy attacks to efficiently stagger their foes.
*   **Tactical Variety:** It gives players another axis to think about. Sometimes, the best strategy isn't to use your highest damage attack, but the one that deals the most stagger.
*   **Impactful Feedback:** Filling the bar and landing a powerful critical hit on a defenseless enemy is an incredibly satisfying moment of power.

## Implementation Sketch

*   **Data:**
    *   In `creatures.toml`, each enemy has a `max_stagger` value and a `stagger_drain_rate`.
    *   In `items.toml` or `skills.toml`, each attack/ability has a `stagger_damage` value in addition to its normal HP damage.
*   **Systems:**
    *   The `CombatSystem` calculates both HP and stagger damage on each hit.
    *   An entity's `Stagger` component tracks its current value.
    *   If `current_stagger >= max_stagger`, the system applies a `Staggered` status effect to the enemy for a set duration.
*   **UI:** The Stagger Bar needs to be a clear, visible element, perhaps a yellow or white bar just below the red HP bar.
