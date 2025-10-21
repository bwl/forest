# Awesome Idea: The Mole Rail Network - Discovery & Repair

## Concept

This system transforms the underground rail network from a simple fast-travel convenience into a major, game-spanning objective. The network is initially discovered in a state of disrepair and danger. The player must explore its collapsed tunnels, clear out monstrous infestations, repair its ancient machinery, and earn the trust of the reclusive Mole Guild to bring it back to life. Unlocking the full potential of the railway is a grand undertaking for the mid-game.

## Core Mechanics

### 1. The Discovery

*   The player doesn't just find a working train station. They find clues:
    *   A `Strange Metal Plate` dropped by a deep-dwelling monster.
    *   An `Old, Tattered Map` showing unknown tunnels.
    *   A collapsed section of wall in a dungeon that reveals a perfectly smooth, arched tunnel and a rusted piece of track.
*   This leads them to their first derelict, unpowered **Mole Station**.

### 2. The Restoration Arc

Restoring a section of the railway is a multi-step process, creating a satisfying progression loop.

*   **Step 1: Clear the Tunnels**
    *   Each segment of track between two stations is a unique, linear dungeon.
    *   These dungeons are filled with hazards: collapsed sections that need to be dug out, nests of creatures that have taken up residence, and broken-down machinery.
    *   The player must fight their way from one station to the next to clear the path.

*   **Step 2: Repair the Station**
    *   A cleared station is still unpowered. The player must use their crafting and resource-gathering skills to repair it.
    *   **Required Materials:** `Iron Bars` (to fix the tracks), `Copper Wire` (for the signaling), `Gears and Levers` (for the machinery), and a `Golem Core` or similar rare item to power the station's generator.
    *   This becomes a major resource sink and a great way to make the player's crafting skills feel impactful.

*   **Step 3: Earn the Mole Guild's Trust**
    *   Once a station is repaired, a representative of the neutral **Mole Guild** will appear.
    *   They are the keepers of the rails and will not allow passage until the player has proven their worth.
    *   This involves completing quests for the Guild: charting unknown tunnels, defending a station from a faction raid, or delivering rare minerals needed for their own maintenance.
    *   Only after gaining sufficient reputation does the Guild grant the player a `Rail Pass`, allowing them to use the restored section of the network.

### 3. A Network of Secrets

*   The rail network is not just a series of tubes. It's a world unto itself.
*   **Hidden Stations:** Some stations are not on any map and can only be found by discovering secret side-tunnels.
*   **Derelict Trains:** The player might find an old, abandoned cargo train filled with rare, ancient resources... and the ghosts of its crew.
*   **The Mole Capital:** The central hub of the network, `Blackden`, is a major neutral city where the player can engage in high-level trade and diplomacy.

## Gameplay & Narrative Impact

*   **A Grand, Tangible Goal:** Restoring the entire rail network is a massive, visible achievement. The player can see the world map light up with active rail lines as they progress.
*   **Integrates Core Systems:** This arc naturally combines combat (clearing tunnels), crafting (repairing stations), and diplomacy (gaining the Guild's trust).
*   **Meaningful Fast Travel:** Because the player has to work so hard to unlock it, fast travel feels earned and significant, not like a cheap convenience.
*   **A New Political Layer:** The Mole Guild becomes a key neutral faction. The player's relationship with them can determine who else gets to use the rails, giving them a powerful lever in the great faction war.

## Implementation Sketch

*   **Data:**
    *   Each `rail_segment` and `station` is a map entity with a state (`Collapsed`, `Cleared`, `Repaired`, `Active`).
    *   `repair_recipes.toml` lists the materials needed to fix each station.
*   **Systems:**
    *   The state of each rail segment is stored in the world save data.
    *   Completing a "Clear Tunnel" quest changes a segment's state from `Collapsed` to `Cleared`.
    *   Interacting with a cleared station with the right materials in your inventory allows you to repair it.
*   **UI:** The world map needs a dedicated overlay to show the rail network, with different colors or icons for active, inactive, and collapsed sections.
