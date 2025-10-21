# Awesome Idea: The Sanity & Horror System

## Concept

This system introduces a new resource bar for the player: **Sanity**. It exists alongside Health and Stamina and represents the character's mental fortitude. Witnessing horrifying events, fighting eldritch creatures, or delving too deep into forbidden places wears away at the player's Sanity. As it drops, the player's perception of reality begins to fray, leading to unique gameplay effects and potential long-term consequences. This system is perfect for adding a layer of cosmic horror and psychological tension to the game.

## Core Mechanics

### 1. The Sanity Meter

*   A UI element, perhaps a swirling, ethereal bar or a simple brain icon that cracks as it depletes.
*   Sanity is lost by:
    *   Being in the presence of **Horrific** enemies (e.g., `Gibbering Mouther`, `Unseen Horror`, `Faceless Stalker`).
    *   Witnessing a friendly NPC die in a particularly gruesome way.
    *   Reading forbidden lore from a cursed tome.
    *   Staying in a `Dark` or `Corrupted` environment for too long.
*   Sanity is regained by:
    *   Resting at a safe, well-lit camp.
    *   Consuming specific items like `Strong Spirits` or `Calming Incense`.
    *   Spending time near a Bard or a comforting NPC.

### 2. Perceptual Distortions (Low Sanity Effects)

As the Sanity meter drops, the game's interface and presentation begin to change in subtle, then dramatic, ways.

*   **75% Sanity:** The edges of the screen might have a slight, pulsating vignette. The ambient soundscape becomes more ominous.
*   **50% Sanity:** The combat log becomes unreliable. You might see phantom whispers or threats that aren't there: `A voice from the shadows whispers your name.` `You feel something crawling on your back.`
*   **25% Sanity:** The UI itself begins to glitch. Your health bar might flicker. Item descriptions in your inventory might temporarily change to unsettling phrases. A friendly NPC's portrait might briefly flash to a monstrous version.
*   **10% Sanity:** Hallucinations. You might see a fleeting glimpse of a monster that isn't there, or the layout of a room might appear to shift for a moment.

### 3. Hitting Zero Sanity: A Mental Break

*   Reaching zero Sanity does not kill the player. Instead, it triggers a **Mental Break**.
*   The player's screen flashes white, and they are afflicted with a new, permanent **Phobia** or **Derangement**—a negative trait that reflects the source of their trauma.
*   After the break, their Sanity is restored to 50%, but the scar remains.
*   **Examples of Phobias:**
    *   `Arachnophobia:` `-10% Accuracy and Damage against spider-type enemies.` (Acquired after a traumatic fight with a Spider Queen).
    *   `Necrophobia:` `Cannot voluntarily end your turn next to a corpse.` (Acquired after being overwhelmed by undead).
    *   `Paranoia:` `You can no longer see the health bars of friendly NPCs.`
    *   `Claustrophobia:` `Lose Sanity at an accelerated rate in tight, narrow corridors.`
*   These Phobias can only be cured by completing a difficult, personal quest or through a rare, expensive ritual.

## Gameplay & Narrative Impact

*   **Adds a New Dimension of Threat:** Some enemies become dangerous not because of their physical damage, but because of the mental toll they inflict. This requires new strategies from the player.
*   **Deepens Immersion:** The perceptual distortions are a powerful tool for creating a tense, horrifying atmosphere. The player starts to distrust what they see on screen.
*   **Creates Lasting Consequences:** Phobias are a far more interesting consequence of failure than simply losing gold. They are narrative scars that the player must learn to play around.
*   **Highlights the Danger of Knowledge:** It reinforces the classic cosmic horror theme that some things are not meant to be known. Reading that ancient book might give you great power, but it will cost you a piece of your mind.

## Implementation Sketch

*   **Data:**
    *   `creatures.toml`: Enemies can have a `sanity_damage` aura.
    *   `phobias.toml`: A list of possible permanent debuffs that can be acquired.
*   **Systems:**
    *   A `SanitySystem` tracks the player's current Sanity and applies the appropriate perceptual distortion effects based on the current level.
    *   The `UIRenderingSystem` needs hooks to allow the `SanitySystem` to modify its output (e.g., `add_glitch_effect`, `display_hallucination_text`).
    *   When Sanity hits zero, the system randomly selects a relevant Phobia from the TOML file and permanently adds it to the player's character sheet.
