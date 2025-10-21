# Awesome Idea: Banks as a Political Faction

## Concept

This system introduces banks as a major, playable political faction. The bank is not just a passive storage building; it is an active, neutral power with its own agenda, resources, and influence. It could be run by a species known for its neutrality and meticulousness, like the Mole Guild. The bank offers services that can make or break kingdoms, but always for a price. Engaging with them is a core part of the late-game political and economic landscape.

## Core Mechanics

### 1. The Bank as a Faction

*   The "Iron Bank" is a neutral faction with whom the player can gain or lose reputation, just like the other major factions.
*   **Reputation:** High reputation unlocks better services (lower interest rates, larger loans, access to unique investments). Low reputation can lead to being blacklisted or even targeted by the bank's enforcers.
*   **Agenda:** The bank's primary goal is its own profit and stability. It is loyal to no one but its shareholders and the sanctity of its contracts.

### 2. High-Stakes Loans

*   Both players and NPC factions can take out loans from the bank.
*   **Player Loans:** Need a massive infusion of capital to build your first castle or fund a war? The bank will provide it, but at a steep interest rate. The loan is a physical contract item that tracks the principal and interest owed.
*   **Faction Loans:** The player can see which factions are indebted to the bank. A faction deep in debt is vulnerable.
*   **Defaulting:** Failure to make interest payments has severe consequences.
    *   **For the Player:** The bank will send powerful, high-level "Debt Collector" squads to seize assets from your camp or stronghold. These are not standard enemies; they are relentless and incredibly difficult to defeat.
    *   **For Factions:** A faction that defaults might have its trade routes seized by the bank, or the bank might hire mercenaries to support its enemies.

### 3. Financing Wars & Espionage

*   The bank is the ultimate war profiteer. It will happily lend money to both sides of a conflict.
*   **Strategic Denial:** If the player has extremely high reputation with the bank, they may be able to persuade the bank to deny a loan to a rival faction, crippling their war effort before it even begins.
*   **Economic Espionage:** The player can undertake quests for the bank to gather economic intelligence on other factions, which the bank can use to its advantage.

### 4. Unique Financial Services

*   **Secure Storage:** The bank offers the most secure form of item storage, completely immune to raids or world events (for a recurring fee).
*   **Investment Opportunities:** High-rep players can invest in the bank's own ventures (e.g., a new mining operation in a distant land) for a share of the profits.
*   **Currency Exchange:** The bank is the most reliable place to exchange the different kingdom currencies, though they always take a small commission.

## Gameplay & Narrative Impact

*   **A New Form of Power:** The bank introduces a form of power completely separate from military might or magical ability. Economic power becomes a viable path to victory.
*   **High-Stakes Decisions:** Taking out a massive loan is a tense, meaningful decision. It can give you the power you need to win, but the threat of the debt collectors will always be looming.
*   **Makes the World Feel Real:** The presence of a powerful financial institution that underpins the world's conflicts adds a huge layer of realism and sophistication to the simulation.
*   **New Questlines:** The bank can be a major quest giver, sending the player on missions ranging from debt collection and corporate espionage to protecting its gold shipments from bandits.

## Implementation Sketch

*   **Data:**
    *   The `BankFaction` entity tracks its own wealth, its loan book (who owes what), and its reputation with all other factions.
*   **Systems:**
    *   A `LoanSystem` manages the creation of loan contracts, calculates interest on a weekly/monthly tick, and checks for defaults.
    *   If a default occurs, it triggers the `DebtCollectorSystem`, which spawns a high-level squad with a specific objective (e.g., `Seize 1000 Gold from Player's Bank`).
*   **UI:** A dedicated Bank interface is needed, showing available services, loan terms, and the player's current standing and debts.
