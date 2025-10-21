# Awesome Idea: The Companion Squad

## Concept

This system allows the player to leverage their growing collection of tamed beasts in a more direct, tactical way. The player can assemble a **Companion Squad**, a secondary party composed entirely of their tamed creatures. This squad can be given high-level commands to act as an autonomous unit, allowing the player to delegate tasks, automate resource gathering, or bring a specialized combat force into the field.

## Core Mechanics

### 1. Forming the Squad

*   At the `Menagerie` or a `Command Post` in the camp, the player can access the Companion Squad interface.
*   They can select up to 4-6 of their tamed beasts to form the active squad.
*   The composition of the squad is key. A player might create:
    *   **A Foraging Squad:** Composed of beasts with high `Transport` and `Foraging` utility skills.
    *   **A Combat Squad:** Composed of tough, aggressive beasts with complementary abilities.
    *   **A Specialized Squad:** A team of all `Fire-Resistant` beasts for delving into a volcanic dungeon.

### 2. The Command System

The player does not control each beast individually. Instead, they issue high-level commands to the squad as a whole. The squad's AI then handles the micromanagement.

*   **`Follow Me:`** The squad follows the player at a safe distance, acting as bodyguards. They will automatically engage any enemies that attack the player.
*   **`Guard This Area:`** The squad will patrol a designated radius around a point, defending it from any hostile incursions. This is perfect for securing a dungeon entrance or protecting the camp while the player is away.
*   **`Forage for Resources:`** If in a resource-rich area, the squad will autonomously seek out and gather basic resources (e.g., `Wood`, `Stone`, `Herbs`). The resources are added to a shared squad inventory.
*   **`Go Feral (Combat Tactic):`** The player gives up direct control, and the beasts use their abilities with maximum aggression. Their damage is increased, but they may act recklessly.

### 3. The Squad in Dungeons

*   The player can choose to bring their Companion Squad with them into a dungeon instead of their usual NPC party.
*   This provides a completely different tactical experience. An NPC party might have a healer, a rogue, and a warrior. A beast squad might have a `Giant Beetle` that acts as a tank, two `Wolves` that act as fast flankers, and a `Fire Salamander` that provides ranged fire support.
*   The beasts act on their own AI based on the current command, but the player can issue new commands on the fly to adapt to new threats.

## Gameplay & Narrative Impact

*   **The Beast Master Fantasy:** This system is the ultimate fulfillment of the "Beast Master" character fantasy. The player isn't just a tamer; they are a pack leader, a commander.
*   **Automation & Delegation:** It allows the player to automate the more routine aspects of the game, like gathering basic resources, freeing them up to focus on more important objectives.
*   **Deep Tactical Variety:** It dramatically increases the number of strategic options available to the player. The choice of which squad to bring to which dungeon is a major tactical decision.
*   **Creates New Risks:** Your Companion Squad is a powerful asset, but it's also vulnerable. If the squad is wiped out in a difficult fight, the player will have lost valuable, carefully-bred companions.

## Implementation Sketch

*   **Data:**
    *   The `Player` entity has a `companion_squad_id`.
    *   A `Squad` entity contains a list of the beast members.
*   **Systems:**
    *   A `SquadCommandSystem` takes the player's high-level command and translates it into individual AI goals for each beast in the squad.
    *   The `BeastAI` system needs to be able to handle these goals (e.g., `Goal: Patrol Radius`, `Goal: Attack Player's Target`).
*   **UI:**
    *   A simple UI element on the main HUD to show the status of the squad members.
    *   A radial menu or hotbar for issuing squad commands quickly and efficiently.
