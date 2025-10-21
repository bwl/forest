# Awesome Idea: The Living Camp & Homesteading

## Concept

This system transforms the player's camp from a functional, strategic base into a personalized, living homestead. It integrates mechanics for farming, interior and exterior design, and NPC life simulation. The goal is to create a strong emotional anchor for the player—a home that they have built and shaped themselves, making it a place truly worth defending.

## Core Mechanics

### 1. Advanced Farming

This expands on the basic farming loop from Chapter 2.

*   **Crop Variety:** Introduce dozens of crops, including staples (wheat, potatoes), luxury goods (grapes for wine, rare flowers for dyes), and magical plants (for alchemy and rituals).
*   **Soil & Seasons:** Different crops grow best in different soil types and seasons. Crop rotation becomes important to maintain soil fertility.
*   **Animal Husbandry:** Players can build pens and raise animals. Chickens for eggs, sheep for wool, giant beetles for chitin plating.
*   **Automation:** In later chapters, Verdant League NPCs can be assigned as `Farmers` to automate planting, watering, and harvesting, turning the farm into a key part of your logistics network.

### 2. Interior & Exterior Design

This allows for deep cosmetic customization of the camp and its buildings.

*   **Placeable Furniture:** The player can craft or buy a huge variety of cosmetic items: beds, tables, chairs, bookshelves, rugs, paintings, potted plants.
*   **No Grid-Snapping (Stardew-style):** Furniture can be placed freely within buildings, allowing for organic, personalized layouts.
*   **Exterior Decor:** The player can place paths, fences, gardens, statues, and decorative trees to design the layout of their entire village.
*   **NPC Homes:** As new NPCs join, the player can design and furnish their individual homes. An NPC's happiness or productivity might be subtly influenced by how well-appointed their living space is.

### 3. NPC Life Simulation

NPCs are not just static quest-givers or workers; they have their own lives.

*   **Daily Schedules:** NPCs have routines. The blacksmith goes to the forge in the morning, eats in the mess hall at lunch, and socializes at the campfire in the evening. The world feels alive even when the player is just observing.
*   **Dynamic Interactions:** NPCs will occasionally interact with each other, their dialogue reflecting their relationship and recent world events. `"Arlen's forge is running low on coal again," says Mira to another NPC.`
*   **Home & Ownership:** NPCs will use the furniture the player places. They will sleep in their assigned beds, sit at tables, and read from bookshelves. This makes the player's design choices feel meaningful.

### 4. Creating a Village

As the camp grows, it graduates from a "stronghold" to a "village" and finally a "capital."

*   The player places new housing plots, and new, generic "Villager" NPCs can move in, paying a small amount of tax and adding to the life of the town.
*   The player can designate zones: a `Market District`, a `Residential Quarter`, a `Crafting District`.
*   The overall "Appeal" of the village, based on its decoration and layout, can provide small morale bonuses to the entire realm.

## Gameplay & Narrative Impact

*   **Emotional Anchor:** The homestead becomes the player's emotional core. The abstract goal of "saving the realm" is reinforced by the very concrete goal of "protecting my home and the people in it."
*   **Creative Expression:** It provides a powerful outlet for player creativity and personalization. Every player's village will look and feel unique.
*   **Downtime Activity:** It creates a relaxing, low-stakes gameplay loop that provides a perfect contrast to the high-stakes tension of dungeon delving and faction warfare.
*   **Makes NPCs Matter:** Seeing an NPC you rescued now living happily in a home you designed for them is an incredibly rewarding experience.

## Implementation Sketch

*   **Data:** A huge library of `furniture.toml` and `decor.toml` files, defining craftable/buyable cosmetic items.
*   **Systems:**
    *   An `ObjectPlacementSystem` handles the Stardew-like placement of items in the world.
    *   An `NPCScheduleSystem` moves NPCs between designated points of interest (`Forge`, `MessHall`, `Home`) based on the in-game time.
*   **UI:** The core of this is keeping it out of complex menus. The player should be able to select an item from their inventory and place it directly in the world.
