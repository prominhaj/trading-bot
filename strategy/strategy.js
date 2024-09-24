export function isGreenCandle(lastCandle) {
    if (!lastCandle) return false;

    const openPrice = parseFloat(lastCandle?.open);
    const closePrice = parseFloat(lastCandle?.close);

    return closePrice > openPrice;
}

// Perform Order Flow Imbalance Analysis, Wall Detection, and Arbitrage
export function performStrategyAnalysis(orderBook) {
    const bids = getOrdersBySide(orderBook, 'Buy');
    const asks = getOrdersBySide(orderBook, 'Sell');

    // 1. Order Flow Imbalance: Compare total bid/ask volumes
    const totalBidQty = bids?.reduce((sum, order) => sum + order.size, 0);
    const totalAskQty = asks?.reduce((sum, order) => sum + order.size, 0);

    // Calculate total volume
    const totalVolume = totalBidQty + totalAskQty;

    // Calculate percentages
    const bidPercentage = parseInt((totalBidQty / totalVolume) * 100);
    const askPercentage = parseInt((totalAskQty / totalVolume) * 100);

    console.log({ bidPercentage, askPercentage });

    // if (totalBids > totalAsks) {
    //     console.log('Buy signal detected based on order flow imbalance');
    //     const buyPrice = bids[0].price + 0.5;
    //     // placeLimitOrder('Buy', 1, buyPrice);
    //     lastTradeTime = now;
    // } else if (totalAsks > totalBids) {
    //     console.log('Sell signal detected based on order flow imbalance');
    //     const sellPrice = asks[0].price - 0.5;
    //     // placeLimitOrder('Sell', 1, sellPrice);
    //     lastTradeTime = now;
    // }

    // Check if any active orders need to be canceled
    // cancelOrdersIfConditionsChange(totalBids, totalAsks);
}

// Helper function to get orders by side (Buy or Sell)
export function getOrdersBySide(orderBook, side) {
    return orderBook
        ?.filter((order) => order.side === side)
        .sort((a, b) => (side === 'Buy' ? b.price - a.price : a.price - b.price));
}
