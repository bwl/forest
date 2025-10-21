# Awesome Idea: Physical, Minted Currencies & A Real Economy

## Concept

This system completely overhauls the idea of in-game currency. "Gold" is no longer an abstract number. It is a physical resource that must be discovered, processed, and legitimized. Currencies have weight, origin, and fluctuating value, making the economy a deep, interactive system that is intertwined with exploration, crafting, and faction politics.

## Core Mechanics

### 1. From Ore to Coin: The Minting Process

*   **Raw Materials:** Gold and Silver do not exist as coins in the wild. Players find `Gold Ore` and `Silver Ore` in deep, dangerous mines.
*   **Smelting:** The ore must be smelted at a high-tier `Smelter` with `Coal` to create `Gold Bars` and `Silver Bars`. These bars are heavy and inefficient for trade, but are the required material for minting.
*   **The Mint:** To create currency, the player must build a `Mint` structure in their stronghold. This is a late-game (Chapter 4+) building that requires significant resources and skilled labor (an assigned `Mint Master` NPC).
*   **Minting:** The player can issue a work order at the Mint: `"Mint 100 Gold Bars into Gold Coins." ` This process takes time and consumes a small amount of coal.

### 2. The Seal of the Kingdom

*   When a coin is minted, it is stamped with the player's custom **Kingdom Heraldry**. A coin is not just a `Gold Coin`; it is a `Coin of the Ironwood Hold` or a `Dragon-Stamped Ducat`.
*   Other factions also mint their own currency: `Emberkin Solar`, `Verdant Florin`, `Tideborn Kraken`.
*   This means the world is filled with multiple, competing currencies.

### 3. Fluctuating Value & Exchange Rates

*   **No Universal Value:** A coin is only worth what someone is willing to pay for it. The value of a currency is tied to the perceived strength and stability of its issuing kingdom.
*   **The Exchange Rate:** A `Currency Exchange` screen (available at faction banks or trade hubs) shows the current exchange rates.
    *   `1 Emberkin Solar = 1.2 Ironwood Coins` (The Emberkin are currently powerful).
    *   `1 Verdant Florin = 0.8 Ironwood Coins` (The Verdant League just lost a major battle).
*   **Player Impact:** The player's actions directly influence the value of their own currency. Winning a major war, securing a new resource, or forming a powerful alliance will strengthen your coin. Losing territory or suffering a famine will devalue it.
*   **Ancient Currencies:** Players might find `Ancient Imperial Solars` in ruins. These are no longer in circulation but are immensely valuable to collectors, the Cartographer's Guild, or as a source of pure, high-quality gold.

### 4. Physicality and Weight

*   Coins have weight. Carrying thousands of coins is not feasible. This makes the **Camp Bank** system essential for storing wealth.
*   It also makes `Gold Bars` a useful way to transport large amounts of value, though many merchants may not have the means to break them down into usable currency.

## Gameplay & Narrative Impact

*   **Economic Warfare:** This is the ultimate expression of a dynamic economy. A player could theoretically defeat a rival faction not with armies, but by crashing their economy. Forge their currency to cause inflation, raid their gold mines to cut off their supply, or form a trade bloc with other factions to refuse their coin.
*   **Deep Immersion:** The economy feels real and grounded. Wealth is not a given; it is created through effort and protected by strength.
*   **Makes Factions Matter:** The rise and fall of factions has a direct, tangible impact on the player's wallet. The player will find themselves watching the global political situation as closely as their own inventory.
*   **New Strategic Choices:** Is it better to trade in your own, weaker currency and take a loss, or to use a stable foreign currency? Do you invest in your own Mint, or try to acquire a large stockpile of a powerful rival's coins?

## Implementation Sketch

*   **Data:** Items are now `item.ore.gold`, `item.bar.gold`, `item.coin.ironwood`, `item.coin.emberkin`, etc.
*   **Systems:**
    *   A `CurrencySystem` tracks the exchange rates between all major currencies. This rate is updated on a slow tick based on a `FactionPower` score (calculated from territory held, army strength, etc.).
    *   Vendor and trade UIs must be updated to handle multiple currencies and display exchange rates.
    *   The `Mint` structure has its own crafting/production logic.
