# Awesome Idea: Beast Breeding & Trait Inheritance

## Concept

This system adds a deep, long-term progression path to the creature taming mechanic. Captured beasts are not just static workers or mounts; they are the foundation of a breeding program. At a dedicated camp structure, the player can breed two of their tamed creatures to produce an offspring that can inherit the best traits from both parents. This allows dedicated players to create a lineage of superior companions, workers, and mounts.

## Core Mechanics

### 1. The Menagerie & Breeding

*   The player must first build a **Menagerie** or **Breeding Pen** at their camp.
*   To breed, the player selects two tamed beasts of the same or a compatible species group (e.g., `Canine`, `Reptilian`, `Avian`) and assigns them to the Menagerie.
*   The process takes a significant amount of in-game time. After a set period, an egg or a newborn creature will appear.

### 2. Passive Traits

*   Every wild creature has a chance to spawn with one or more **Passive Traits**. These are small, inherent bonuses.
*   **Examples of Traits:**
    *   `Tough Hide:` +10% to Armor.
    *   `Swift:` +10% to Movement Speed.
    *   `Strong Back:` +25% Carry Capacity (for mounts).
    *   `Diligent Worker:` +15% efficiency when assigned to a camp job.
    *   `Fire-Resistant:` +50% resistance to fire damage.
    *   `Keen Senses:` Higher chance to detect hidden enemies or traps.
*   Traits come in different rarities. A wild creature might have one common trait, but finding one with two or even a rare trait is a major discovery.

### 3. Trait Inheritance

This is the core of the breeding loop.

*   When an offspring is produced, it has a chance to inherit the traits of its parents.
*   **The Rules of Inheritance:**
    *   If a parent has a trait, there is a high chance (e.g., 60%) that the offspring will inherit it.
    *   If both parents have the same trait, the chance of inheritance is even higher (e.g., 90%).
    *   There is a very small chance for a **mutation** to occur, resulting in a completely new, random trait.
    *   There is also a small chance for a **trait upgrade**, where a common trait (`Swift I`) is upgraded to a rarer, more powerful version (`Swift II`).

### 4. The Breeding Goal

*   The player's goal is to find wild beasts with the specific traits they want, and then use selective breeding over multiple generations to combine those traits into a single, "perfect" creature.
*   **Example Goal:** To breed the ultimate mount, a player might:
    1.  Capture a `Great Boar` with the `Swift` trait.
    2.  Capture another `Great Boar` with the `Strong Back` trait.
    3.  Breed them together repeatedly until they produce an offspring with *both* `Swift` and `Strong Back`.
    4.  Then, they might try to breed that new boar with another that has the `Tough Hide` trait, continuing the process.

## Gameplay & Narrative Impact

*   **A True Endgame Grind:** Breeding is the ultimate long-term goal for dedicated Tamers. It provides a deep, rewarding system that can keep players engaged for hundreds of hours.
*   **Makes Every Capture Potentially Valuable:** Even a common, low-level wolf is an exciting capture if it happens to have a rare and desirable trait that can be passed on to a new generation.
*   **Player-Driven Creation:** This system allows players to create something truly unique. The perfect mount they spent hours breeding feels like a personal, one-of-a-kind achievement.
*   **Adds a New Economic Layer:** A player who successfully breeds a creature with multiple rare traits could trade it to a faction or another player (if in a multiplayer context) for an enormous price.

## Implementation Sketch

*   **Data:**
    *   `traits.toml`: A large file defining all possible passive traits, their effects, and their rarity.
    *   In `creatures.toml`, each creature can have a list of `inherent_traits`.
*   **Systems:**
    *   The `BreedingSystem` is triggered when two compatible creatures are placed in the Menagerie.
    *   It runs the inheritance logic: for each trait on each parent, it rolls a chance to pass it to the offspring. It also rolls for mutations.
    *   It then creates a new creature entity with the inherited traits.
*   **UI:** The Menagerie UI needs to clearly show the traits of the parent creatures and provide a simple interface for initiating the breeding process. The UI for a creature's stat screen should have a dedicated section for listing its passive traits.
