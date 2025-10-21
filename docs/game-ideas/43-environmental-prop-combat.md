# Awesome Idea: Environmental & Prop-Based Combat

## Concept

This system transforms the combat environment from a static backdrop into an interactive, tactical sandbox. Dungeons are filled with a variety of props and hazards—from explosive barrels and rickety chandeliers to pools of oil and patches of slippery ice. Both the player and intelligent enemies can use these elements to their advantage, turning every fight into a dynamic, improvisational puzzle.

## Core Mechanics

### 1. Interactive Props

These are physical objects on the map that can be manipulated.

*   **Explosive Barrels:** A classic. Dealing any damage to them (e.g., with an arrow or a fire spell) causes them to explode, dealing heavy area-of-effect damage.
*   **Pillars & Statues:** Can be pushed over with a strong shove (a `Strength` check or a special ability). They fall in a line, dealing damage and creating temporary cover or an obstacle.
*   **Chandeliers & Hanging Nets:** Can be shot down with a ranged attack to fall on enemies below, dealing damage and potentially trapping or stunning them.
*   **Braziers & Campfires:** Can be kicked over to spill hot coals onto the ground, creating a temporary damaging surface.
*   **Bookshelves & Crates:** Can be pushed to block corridors or create choke points.

### 2. Environmental Surfaces

These are tile types with special properties that affect combat.

*   **Pools of Oil/Tar:** Highly flammable. A fire arrow or spell will ignite the entire pool, creating a massive wall of fire for several turns.
*   **Slippery Ice:** Any character moving onto an ice tile must make a `Dexterity` check or slide in a straight line until they hit an obstacle.
*   **Deep Water:** Small creatures might drown if pushed in. Heavy, armored characters might be slowed down.
*   **Tall Grass:** Provides a bonus to stealth and makes ranged attacks less accurate against characters standing in it.
*   **Magma/Lava:** Deals massive fire damage per turn to any character standing on it.

### 3. Enemy Interaction

This is the key to making the system feel fair and dynamic. Enemies aren't just passive victims of these interactions; they can use them too.

*   A Goblin Shaman might intentionally cast a fire spell on a pool of oil to block the player's path.
*   A clever Goblin Skirmisher might try to lure the player onto a patch of ice before attacking.
*   A large Troll might intentionally smash a pillar to try and crush the player.
*   Enemies will actively avoid walking through fire or other hazards they create.

## Gameplay & Narrative Impact

*   **Rewards Cleverness:** The system rewards players who think beyond just attacking. A well-placed push or a single arrow can be more effective than a dozen sword swings.
*   **Emergent Scenarios:** The combination of different props and surfaces can lead to chaotic and memorable chain reactions. A player pushes a pillar, which knocks over a brazier, which ignites a pool of oil, which explodes a barrel, wiping out an entire goblin patrol.
*   **Makes Every Room a Puzzle:** The player learns to scan a room for tactical opportunities before engaging in a fight. The layout of the room becomes as important as the enemies within it.
*   **Dynamic & Replayable:** Even fighting the same group of enemies in the same room can play out completely differently depending on how the environment is used.

## Implementation Sketch

*   **Data:**
    *   Props are entities with a `Health` component and a `OnDestroyed` or `OnPushed` script/event trigger.
    *   Tiles have a `SurfaceType` property (`Ice`, `Oil`, `Fire`) that the `MovementSystem` and `CombatSystem` check for.
*   **Systems:**
    *   The `PhysicsSystem` (a simplified one) handles pushing objects and falling props.
    *   The `ElementalInteractionSystem` manages effects like fire igniting oil. `Fire` + `Oil` -> `BurningSurface`.
    *   The enemy AI needs to be updated to recognize and interact with these objects. It needs a simple understanding of `HazardousTiles` to avoid and `TacticalProps` to use.
*   **UI:** Tooltips are essential. Mousing over a barrel should show `"Explosive Barrel"`. Mousing over a patch of oil should show `"Flammable Surface."`
