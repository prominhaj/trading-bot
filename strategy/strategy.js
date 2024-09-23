export function checkConditionsAndPlaceOrder() {
    if (isGreenCandle() && isBuyOrderDominant()) {
        const topBuyPrice = getTopBuyPrice();
        placeBuyLimitOrder(topBuyPrice);
    }
}

// Function to check if the current candle is green
export function isGreenCandle(lastCandle) {
    if (!lastCandle) return false;

    const openPrice = parseFloat(lastCandle?.open);
    const closePrice = parseFloat(lastCandle?.close);

    return closePrice > openPrice;
}

// Function to check if buy orders account for 40% or more of the total order volume
function isBuyOrderDominant() {
    const totalBuyVolume = orderBook.buy.reduce((sum, order) => sum + order[1], 0);
    const totalSellVolume = orderBook.sell.reduce((sum, order) => sum + order[1], 0);
    const totalVolume = totalBuyVolume + totalSellVolume;

    if (totalVolume === 0) return false;

    const buyPercentage = (totalBuyVolume / totalVolume) * 100;
    console.log({ buyPercentage });

    return buyPercentage >= 40; // True if buy volume is 40% or more
}
