# Awesome Idea: Bestiary & Research System

## Concept

This system transforms monster hunting from a simple act of killing into a deep, rewarding loop of harvesting, research, and strategic advantage. By studying their fallen foes, players can gain a permanent edge in combat, unlock valuable crafting recipes, and fill out a detailed in-game Bestiary, making them feel like a true master hunter and scholar.

## Core Mechanics

### 1. Harvesting Monster Parts

*   When a creature is killed, it has a chance to drop unique, non-loot body parts (e.g., `Wolf Pelt`, `Spider Venom Gland`, `Golem Core`, `Dragon Scale`).
*   The chance of a successful harvest could be tied to a "Skinning" or "Anatomy" skill, or a specific tool like a hunting knife.

### 2. The Research Facility

*   At the camp, the player can build a **Research Table**, **Tanning Rack**, or **Alchemist's Lab**.
*   The player can bring monster parts to this station to "Research" them. This process consumes the part and takes a small amount of in-game time.

### 3. The Research & Discovery Loop

*   Each creature has a **Research Level**, starting at 0.
*   Every time the player successfully researches a part from a creature, its Research Level increases.
*   Reaching certain Research Level milestones for a creature unlocks permanent rewards:
    *   **Level 1:** A new entry is created in the player's **Bestiary** with basic information (a sketch, a short description).
    *   **Level 3:** The Bestiary entry is updated to reveal the creature's **resistances and vulnerabilities** (e.g., `Weakness: Fire`, `Resists: Poison`).
    *   **Level 5:** The player gains a permanent, passive **Slayer Bonus** against this creature type (e.g., `+5% damage to all wolves`).
    *   **Level 7:** A new, unique **crafting recipe** using that creature's parts is unlocked (e.g., `Wolf-Pelt Cloak` that grants cold resistance, `Spider-Venom Oil` to apply to weapons).
    *   **Level 10 (Mastery):** The Slayer Bonus increases, and the Bestiary is filled with detailed lore and tactical advice.

### 4. The Bestiary

*   The Bestiary is an in-game book that the player can read at any time.
*   It starts mostly empty.
*   As the player encounters and researches creatures, its pages fill out with:
    *   An ASCII-art portrait of the creature.
    *   Known stats, weaknesses, and resistances.
    *   Flavor text and lore.
    *   A list of known habitats and dropped materials.

## Gameplay & Narrative Impact

*   **Makes Every Kill Potentially Valuable:** Even a common wolf is exciting to kill if it might drop the final `Wolf Pelt` needed to reach the next Research Level.
*   **Strategic Progression:** Players can choose to specialize. Do you focus on researching the wolves in your starting area to gain an early combat edge? Or do you save your research time for the more dangerous trolls you plan to hunt later?
*   **Knowledge as Power:** The system directly rewards players for learning about their enemies. Discovering that a Golem is weak to blunt damage is a tangible, powerful advantage.
*   **Drives a New Gameplay Loop:** The **Hunt -> Harvest -> Research -> Craft -> Hunt Better** loop is incredibly compelling and sits perfectly alongside the main quest and exploration loops.
*   **Organic World-Building:** The Bestiary becomes a personalized record of the player's journey and their mastery over the world's fauna.

## Implementation Sketch

*   **Data:**
    *   `creatures.toml`: Each creature definition includes a list of potential harvestable parts.
    *   `research.toml`: Defines the research tracks for each creature, including the XP required for each level and the unlocks at each milestone.
    *   `recipes_monster.toml`: Contains the crafting recipes unlocked via research.
*   **Systems:**
    *   A `HarvestingSystem` determines if a monster part drops upon death.
    *   A `ResearchSystem` manages the process at the camp facility. When the player initiates research, it consumes the item, advances a timer, and then grants research XP for that creature.
    *   When a creature's research level increases, the system checks for unlocks and applies the permanent bonuses to the player or adds new recipes to their known list.
*   **UI:** A clean, readable Bestiary interface is key. It should be easy to navigate and clearly show which information is known and which is still locked.
