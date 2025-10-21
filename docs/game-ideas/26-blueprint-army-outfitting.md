# Awesome Idea: Blueprint-Based Army Outfitting

## Concept

As the player's realm grows from a small camp to a sprawling kingdom, manually crafting gear for every soldier becomes an impossible task. This system allows the player to act as a true quartermaster and general, designing standardized **Squad Loadout Blueprints**. The automated workshops in their stronghold then use these blueprints to mass-produce equipment and automatically outfit new squads, streamlining the process of raising an army.

## Core Mechanics

### 1. The Blueprint Designer

*   At a `Command Table` or `Barracks` structure, the player can access the Blueprint Designer.
*   This UI allows them to create and save a new Squad Loadout. A blueprint defines the equipment for a full squad (e.g., 6 soldiers).
*   **Example Blueprint: "Ironwood Archer Squad Mk. I"**
    *   **Name:** Ironwood Archer Squad Mk. I
    *   **Composition:** 6x Archers
    *   **Equipment List:**
        *   6x `Iron Longbow`
        *   6x `Leather Armor`
        *   6x `Standard Quiver` (filled with `Iron Arrows`)
        *   1x `Verdant League Banner` (for morale)

### 2. The Production Queue

*   Once a blueprint is saved, the player can queue it for production.
*   At the Barracks, they can place an order: `"Train 5x 'Ironwood Archer Squad Mk. I'"`.
*   This automatically generates a master work order for all the required components: `30 Iron Longbows`, `30 Leather Armors`, etc.

### 3. Automated Workshop Integration

*   This system plugs directly into the **Automated Stronghold & Logistics** system.
*   The master work order is sent to the `ProductionManager`.
*   The Fletcher's Hut gets an order for 30 longbows, the Tannery gets an order for 30 sets of leather armor, and so on.
*   The workshops will automatically pull the required raw materials (`Iron Bars`, `Leather Hides`) from the camp bank.
*   If materials are missing, a stall is flagged on the Logistics Map, alerting the player to the bottleneck (e.g., `"Stall: Iron Bar shortage is holding up Archer production."`).

### 4. Squad Mustering

*   As the gear for one full squad loadout is completed and delivered to the Barracks, a new squad of trained but un-equipped NPCs is automatically outfitted.
*   Once complete, the player is notified: `"A new 'Ironwood Archer Squad' is mustered and ready for deployment!"`
*   The fully-equipped squad now appears on the player's army roster, available for assignment.

## Gameplay & Narrative Impact

*   **Grand Strategy Focus:** This system abstracts away the tedious micromanagement of equipping individual soldiers, allowing the player to think at the level of a true general. Their job is designing the perfect army, not clicking to craft 30 identical swords.
*   **Meaningful Design Choices:** The player's decisions in the Blueprint Designer have huge consequences. Is it better to equip squads with cheaper, mass-produced gear, or expensive, high-tier equipment that will take longer to produce?
*   **Logistical Challenges:** The focus of gameplay shifts from crafting to solving supply chain problems. "My archer production has stalled. I need to either increase my iron mining output or design a new archer blueprint that uses cheaper wooden bows."
*   **Faction Identity:** Factions can provide unique blueprint options. Allying with the Emberkin might unlock a blueprint for a heavily-armored "Shock Trooper Squad," while the Tideborn might provide blueprints for amphibious skirmishers.

## Implementation Sketch

*   **Data:**
    *   `squad_blueprints.toml`: A file to store all the player-created blueprints.
    *   Each blueprint is a list of `item_id` and `quantity` pairs.
*   **Systems:**
    *   The `ProductionManagerSystem` is key. It needs to be able to handle nested work orders (e.g., the order for a `Sword` creates a sub-order for the `Iron Bars` it requires).
    *   A `MusteringSystem` at the Barracks checks for completed sets of equipment. When a full set is available, it consumes the gear and spawns a new, fully-equipped squad entity.
*   **UI:**
    *   A clean, intuitive Blueprint Designer that allows players to easily select items and quantities.
    *   The Barracks UI needs a simple interface for queuing up blueprints for production and viewing the progress.
