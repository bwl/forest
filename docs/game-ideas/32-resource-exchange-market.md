# Awesome Idea: The Resource Exchange & Commodities Market

## Concept

This system introduces a centralized, dynamic marketplace for raw materials, moving beyond simple vendor transactions. The Resource Exchange is an in-game hub where players and NPC factions can trade bulk commodities. Prices are not static; they are determined by a robust supply and demand simulation that is constantly influenced by world events. This allows the player to engage in high-level economic strategy, from cornering a market to profiting from wartime scarcity.

## Core Mechanics

### 1. The Exchange Interface

*   Accessible at faction capitals or major trade hubs.
*   The UI looks like a real-world commodities market screen:
    *   **Commodity List:** `Iron Ore`, `Oak Logs`, `Raw Fish`, `Coal`, `Stone Blocks`, etc.
    *   **Current Price:** The last traded price per unit.
    *   **Price History:** A small graph showing the price of the commodity over the last 30 days.
    *   **Order Book:** A list of active buy and sell orders posted by NPCs and other factions.

### 2. Placing Orders

*   **Sell Orders:** The player can take a stack of `100 Iron Ore` to the Exchange and post a sell order: `"Sell 100 Iron Ore at 2 Silver Coins per unit."`
*   **Buy Orders:** If the player needs a large quantity of a resource for a project, they can post a buy order: `"Buy 500 Oak Logs at 1 Silver Coin per unit."`
*   Orders are filled automatically when a matching counter-offer is found. The player can then collect their goods or payment from the Exchange clerk.

### 3. Dynamic Supply & Demand Simulation

This is the engine that makes the market feel alive. NPC factions are constantly creating their own buy and sell orders based on their needs.

*   **Supply Drivers:**
    *   A faction with many active mines will generate a large supply of `Iron Ore`, driving the price down.
    *   A bumper harvest from the Verdant League will flood the market with `Grain`.
*   **Demand Drivers:**
    *   **War:** The Emberkin Pact declaring war creates a massive demand for `Iron Ore`, `Coal`, and `Food`, causing prices to skyrocket.
    *   **Construction:** A faction building a new fortress will create high demand for `Stone Blocks`.
    *   **Winter:** In late Autumn, demand for `Firewood` and `Preserved Food` will surge.
*   **Player Influence:** The player's actions are a major market force.
    *   **Raiding a mine** or a caravan creates artificial scarcity, driving up prices.
    *   **Selling a massive haul** of a rare resource can temporarily crash its market value.

### 4. Advanced Trading (Chapter 5)

*   **Futures Contracts:** Bet on the future price of a commodity. If you think a war is coming, you can buy a contract for `Iron Ore` at today's low price, to be delivered in 30 days when the price is high.
*   **Arbitrage:** If the price of `Fish` is low in a Tideborn coastal city but high in a landlocked Emberkin fortress, the player can profit by physically transporting the goods between the two markets (if they can survive the journey).

## Gameplay & Narrative Impact

*   **Become a Tycoon:** This system provides a completely new career path. A player could become a wealthy merchant prince who wields more power through their economic influence than their sword.
*   **Strategic Market Manipulation:** The Exchange is another battlefield. Players can use it to support their allies (by selling them cheap resources) or cripple their enemies (by buying up all the food they need).
*   **Makes the World Feel Interconnected:** The system clearly shows how events in one part of the world have ripple effects everywhere else. A small skirmish on the border can cause the price of leather to change in the capital city.
*   **Drives Quests & Adventure:** Price fluctuations create opportunities. A high price for a certain resource is a clear signal to the player: "There is profit to be made by adventuring in the region where that resource is found."

## Implementation Sketch

*   **Data:**
    *   Each commodity has a `base_value`.
    *   A global `MarketState` object tracks the current `supply` and `demand` modifiers for each commodity.
*   **Systems:**
    *   A `MarketUpdateSystem` runs on a daily in-game tick.
    *   It adjusts the `supply` and `demand` modifiers based on faction states (e.g., `at_war`, `building_fortress`) and world events.
    *   The current `price` is calculated using a formula like `base_value * (demand / supply)`.
    *   An `OrderMatchingSystem` constantly scans the order book for matching buy and sell orders.
*   **UI:** A clean, data-rich Exchange interface is crucial. It needs to present a lot of information (prices, graphs, order books) in a way that is readable and not overwhelming.
