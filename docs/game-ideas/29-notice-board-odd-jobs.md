# Awesome Idea: The Notice Board & Odd Jobs

## Concept

This system introduces a Notice Board, a physical object in the player's camp and in faction towns, that serves as a hub for small, repeatable, procedurally generated quests. These "odd jobs" represent the everyday needs and problems of the community. They are not epic quests, but simple tasks that make the world feel more alive and provide the player with a reliable way to earn money, resources, and reputation.

## Core Mechanics

### 1. The Notice Board

*   A physical object in the world. The player interacts with it to see a list of available jobs.
*   The list of jobs is procedurally generated and refreshes every few in-game days.
*   Jobs are posted by generic, unnamed NPCs (`A Worried Villager`, `A Grateful Farmer`, `The Camp Quartermaster`).

### 2. Types of Odd Jobs

The jobs are simple and fall into a few clear categories, making them easy for the system to generate.

*   **Fetch Quests:**
    *   `"I need 10 Iron Ore to repair the town gate. - The Town Guard"`
    *   `"Looking to buy 5 Wolf Pelts for a winter cloak. - A Local Tailor"`
*   **Extermination Quests:**
    *   `"Giant spiders have infested my cellar! Please clear them out! - A Frightened Homeowner"`
    *   `"A pack of aggressive boars is ruining my crops. Thin their numbers! - A Frustrated Farmer"`
*   **Delivery Quests:**
    *   `"This package of medicine needs to get to the neighboring village by sundown. - The Camp Apothecary"`
    *   This type of quest often has a time limit, adding a layer of urgency.
*   **Bounty Quests:**
    *   `"WANTED: 'Gorn the Lone Survivor'. This Nemesis has been raiding our caravans. Last seen near the old ruins." `
    *   This ties directly into the Nemesis System, making it a source of tracking down old foes.

### 3. Rewards

*   Rewards are modest but reliable.
*   **Gold/Currency:** The most common reward.
*   **Resources:** Sometimes the reward is a bundle of useful materials (e.g., high-quality seeds, a stack of iron bars).
*   **Reputation:** Completing jobs in a faction's town always grants a small amount of reputation with that faction.
*   **Consumables:** A grateful farmer might reward you with a stack of high-quality food.

## Gameplay & Narrative Impact

*   **Grounded World:** This system makes the game world feel more real. It's not just a place of epic battles; it's a place where people have everyday problems like leaky roofs and spider infestations.
*   **Reliable Income Source:** It provides a low-stress way for players to earn money and resources, especially early in the game or if they are struggling.
*   **Player-Driven Pacing:** If the player doesn't want to engage with the main quest, they can spend a few days just doing odd jobs, fishing, and upgrading their camp. It provides a satisfying, low-stakes gameplay loop.
*   **Reinforces Other Systems:** The Notice Board naturally integrates with other systems. It can send you to a dungeon you haven't explored, ask for materials you need to craft, or point you towards a Nemesis.
*   **Flavor & Lore:** The text of the job postings can be a source of flavor and subtle world-building. `"Ever since the meteor shower, the slimes have been acting strange..."`

## Implementation Sketch

*   **Data (`odd_jobs.toml`):**
    ```toml
    [[job]]
    id = "fetch_ore"
    type = "Fetch"
    title = "Ore for the Gate"
    description = "I need [QUANTITY] [ITEM] to repair the town gate."
    item = "iron_ore"
    quantity = [5, 10] # Randomly choose between 5 and 10
    reward_gold = [20, 50]
    reward_rep_faction = "local_faction"
    reward_rep_amount = 5
    ```
*   **Systems:**
    *   A `NoticeBoardSystem` runs every few days. It clears the old jobs and generates a new list by pulling templates from the TOML file and filling in the details.
    *   When a player accepts a job, it's added to their quest log. The system is simple enough that it can reuse the main quest system's logic.
*   **UI:** The Notice Board interface should be a simple, clean list of available jobs. Clicking on a job shows the details and an "Accept" button.
