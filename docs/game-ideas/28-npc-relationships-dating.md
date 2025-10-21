# Awesome Idea: NPC Relationships & Dating

## Concept

This system transforms key NPCs from static, functional entities into dynamic characters with their own lives, preferences, and feelings about the player. By engaging in meaningful dialogue, giving thoughtful gifts, and helping them with their personal struggles, the player can build deep friendships and even pursue romantic relationships. This adds a powerful emotional layer to the game, making the characters and the world feel more real and consequential.

## Core Mechanics

### 1. The Friendship & Romance Meter

*   Key NPCs (both in the player's camp and in faction capitals) have a hidden relationship score with the player, represented by a heart meter or a similar UI element that becomes visible after a certain level of interaction.
*   The score is influenced by dialogue choices, gifts, and quest outcomes.

### 2. Refined Dialogue System

*   **Not just exposition:** Dialogue is the primary way to build relationships. The system goes beyond simple quest-giving.
*   **Player Voice:** The player can often choose a "tone" for their response (e.g., `[Joking]`, `[Serious]`, `[Flirtatious]`, `[Curious]`), which affects the relationship score differently depending on the NPC's personality.
*   **Personal Topics:** As friendship grows, new dialogue topics unlock. The player can ask NPCs about their past, their dreams, and their opinion on world events.
*   **Dynamic Portraits:** The NPC's ASCII portrait changes expression based on the flow of the conversation (e.g., smiling, frowning, surprised).

### 3. Gift-Giving

*   A classic relationship mechanic. Every NPC has a list of loved, liked, neutral, disliked, and hated gifts.
*   **Figuring it out:** The player learns an NPC's preferences through dialogue hints (`"I could really go for a spicy pepper popper right now"`) or by observing their routines.
*   **Thoughtful gifts matter:** Giving a blacksmith a rare piece of ore is far more effective than giving them a flower.

### 4. Heart Events & Personal Quests

*   Reaching certain relationship milestones (e.g., 2, 4, 6, 8, 10 hearts) triggers a unique, scripted "Heart Event."
*   These are short, personal cutscenes or quests that reveal more about the NPC's backstory and personality.
*   **Examples:**
    *   Helping the camp's blacksmith find a legendary hammer they thought was lost.
    *   Accompanying the shy scholar on a dangerous field expedition to a ruin.
    *   Confronting a Nemesis from an NPC's past.

### 5. Romance & Marriage

*   For a select pool of romanceable NPCs, reaching a high level of friendship unlocks the option to pursue a romantic relationship.
*   This requires giving a special item (like a `Lover's Amulet`).
*   Marriage is a major milestone. The player's spouse will move into their home, help around the camp, and provide unique daily buffs or occasional gifts.

## Gameplay & Narrative Impact

*   **Emotional Investment:** This system is designed to make the player *care* about the characters. Defending the camp feels more urgent when your spouse and best friends live there.
*   **Character-Driven Stories:** It provides a source of intimate, character-driven stories that run parallel to the epic, world-saving main quest.
*   **Meaningful Choices:** Dialogue choices are no longer just about getting a quest; they are about shaping a relationship.
*   **Adds a New Dimension to NPCs:** A character who is a gruff Emberkin general on the battlefield might reveal a softer, more vulnerable side in their personal quests.

## Implementation Sketch

*   **Data:**
    *   `npcs.toml`: Each key NPC has a `personality` profile, a list of `gift_preferences`, and a tree of `dialogue_nodes`.
    *   `heart_events.toml`: Defines the triggers and scripted sequences for each personal quest.
*   **Systems:**
    *   A `RelationshipSystem` tracks the friendship score for all key NPCs.
    *   A `DialogueManager` presents the player with choices and updates the relationship score based on their selection.
    *   A `QuestSystem` triggers the Heart Events when the required relationship level is reached.
*   **UI:** A clean, engaging dialogue UI is critical. It should show the NPC's portrait, the dialogue text, and the player's choices in a clear and readable format.
