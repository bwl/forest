# Awesome Idea: Telegraphing & Predictable AI

## Concept

This combat system is designed to be **fair, readable, and tactical**. Instead of relying on pure statistics or random chance, enemies clearly signal their intentions for powerful attacks, giving the player a turn to anticipate and react. This transforms combat from a simple damage race into a turn-based puzzle where observation and positioning are the keys to victory. It's a "cozy" system because it empowers the player through knowledge, reducing frustration from unexpected, high-damage attacks.

## Core Mechanics

### 1. The Telegraph Turn

*   When an enemy decides to use a special or powerful ability, it doesn't happen instantly. Instead, the enemy enters a **"Charging"** or **"Winding Up"** state for one full turn.
*   This state is clearly communicated to the player through multiple channels:
    *   **Visual Cue:** The enemy's ASCII art or sprite might change color (e.g., glow red), or a special icon (like a charging sword 🗡️ or a casting spell ✨) appears over its head.
    *   **Text Log:** The combat log explicitly states the enemy's intent: `The Goblin Bruiser winds up for a Power Attack!`
    *   **Tooltip:** Examining the enemy during this turn shows a status effect: `Status: Power Attack (Deals 200% damage in a 3-tile line next turn).`

### 2. A Vocabulary of Intentions

Different types of attacks have different, easily recognizable telegraphs.

*   **Heavy Melee Attack:** The enemy might glow red. The tooltip shows the exact tiles that will be affected (e.g., a straight line, a cone).
*   **Area of Effect (AoE) Spell:** The ground tiles that will be affected by the spell next turn are highlighted with a faint, colored overlay.
*   **Summoning Spell:** A ghostly, half-formed image of the creature to be summoned appears in the target location.
*   **Debuff Curse:** A purple, swirling icon appears over the enemy, and the player might see a `Targeted by Curse` status in their own UI.

### 3. The Player's Counter-Play

The telegraph turn gives the player a clear set of choices, all of which feel smart and tactical.

*   **Move:** The most basic counter is to simply move out of the telegraphed area of effect.
*   **Interrupt:** Hitting the charging enemy with a specific type of attack (e.g., a `Shield Bash` or a stunning spell) can interrupt the ability, canceling it entirely and possibly staggering the enemy.
*   **Defend:** If moving or interrupting isn't an option, the player can use a defensive ability (`Block`, `Parry`, `Magic Shield`) to mitigate the incoming damage.
*   **Go All-In:** If the player is confident they can kill the enemy before its next turn, they can ignore the telegraph and unleash a full offensive assault.

## Gameplay & Narrative Impact

*   **Reduces Frustration:** This system dramatically reduces the feeling of being unfairly one-shotted by a random critical hit. Death feels earned and is usually the result of a mistake the player can learn from.
*   **Empowers the Player:** It makes the player feel intelligent. Successfully dodging a telegraphed attack or interrupting a powerful spell is incredibly satisfying.
*   **Creates Tactical Depth:** Combat becomes a dance of positioning, timing, and resource management. It's less about your gear's stats and more about your decisions turn-by-turn.
*   **Highlights Enemy Design:** Each enemy can have a unique set of telegraphed moves, giving them a distinct personality and tactical challenge. Learning an enemy's "move set" becomes a core part of the gameplay loop.

## Implementation Sketch

*   **AI Behavior Trees:** An enemy's AI doesn't just have an `AttackPlayer` state. It has a `BeginPowerAttack` state (which applies the telegraph effect) followed by an `ExecutePowerAttack` state on the next turn.
*   **Status Effects:** The telegraph itself is just a temporary status effect (`Winding Up`) that stores the information about the upcoming attack.
*   **UI System:** A dedicated `TelegraphRenderer` system is responsible for drawing the visual cues (highlighted tiles, overhead icons) based on the data stored in the enemy's status effect.
