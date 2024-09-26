export function isGreenCandle(lastCandle) {
    if (!lastCandle) return false;

    const openPrice = parseFloat(lastCandle?.open);
    const closePrice = parseFloat(lastCandle?.close);

    return closePrice > openPrice;
}

// Perform Order Flow Imbalance Analysis, Wall Detection, and Arbitrage
export function performStrategyAnalysis(orderBook) {
    let totalBidQty = 0,
        totalAskQty = 0;

    // Calculate total bid and ask volumes in a single pass
    orderBook.forEach((order) => {
        if (order.side === 'Buy') {
            totalBidQty += order.size;
        } else if (order.side === 'Sell') {
            totalAskQty += order.size;
        }
    });

    // analyzeMarketVolatility(orderBook);

    // Calculate total volume
    const totalVolume = totalBidQty + totalAskQty;
    if (totalVolume === 0) return; // Avoid division by zero

    // Calculate bid/ask percentages
    const bidPercentage = (totalBidQty / totalVolume) * 100;
    const askPercentage = (totalAskQty / totalVolume) * 100;

    // console.log({ bidPercentage, askPercentage });

    // Determine market signal based on order flow imbalance
    const { spread, highestBid, lowestAsk } = calculateSpread(orderBook);
    if (bidPercentage <= 40) {
        return {
            highestOrder: highestBid,
            signal: 'Buy'
        };
    } else if (askPercentage <= 40) {
        return {
            signal: 'Sell',
            highestOrder: highestBid
        };
    } else {
        return {
            signal: 'Hold',
            highestOrder: highestBid
        };
    }
}

// Helper function to get orders by side (Buy or Sell) and optionally sort
export function getOrdersBySide(orderBook, side, sort = false) {
    const filteredOrders = orderBook.filter((order) => order.side === side);

    // Sort only if needed
    if (sort) {
        return filteredOrders.sort((a, b) =>
            side === 'Buy' ? b.price - a.price : a.price - b.price
        );
    }

    return filteredOrders;
}

// Function to calculate the bid-ask spread
const calculateSpread = (orderBook) => {
    const highestBid = Math.max(
        ...orderBook
            .filter((order) => order.side === 'Buy' && order.size)
            .map((order) => order.price)
    );
    const lowestAsk = Math.min(
        ...orderBook
            .filter((order) => order.side === 'Sell' && order.size)
            .map((order) => order.price)
    );
    const spread = lowestAsk - highestBid;
    return { spread, highestBid, lowestAsk };
};

// Function to assess buy/sell imbalance
const assessImbalance = (orderBook) => {
    const totalBuyVolume = orderBook
        .filter((order) => order.side === 'Buy')
        .reduce((sum, order) => sum + order.size, 0);
    const totalSellVolume = orderBook
        .filter((order) => order.side === 'Sell')
        .reduce((sum, order) => sum + order.size, 0);

    const imbalanceRatio = totalBuyVolume / totalSellVolume;
    return { imbalanceRatio, totalBuyVolume, totalSellVolume };
};

// Function to monitor large orders
const monitorLargeOrders = (orderBook) => {
    const largeOrderThreshold = 10;
    const largeBuys = orderBook.filter(
        (order) => order.side === 'Buy' && order.size >= largeOrderThreshold
    );
    const largeSells = orderBook.filter(
        (order) => order.side === 'Sell' && order.size >= largeOrderThreshold
    );

    return { largeBuys, largeSells };
};

// Analyze market volatility
const analyzeMarketVolatility = (orderBook) => {
    const { spread, highestBid, lowestAsk } = calculateSpread(orderBook);
    const { imbalanceRatio, totalBuyVolume, totalSellVolume } = assessImbalance(orderBook);
    const { largeBuys, largeSells } = monitorLargeOrders(orderBook);

    // console.log(`Current Spread: ${spread}`);
    // console.log(`Highest Bid: ${highestBid}`);
    // console.log(`Lowest Ask: ${lowestAsk}`);
    console.log(`Buy/Sell Imbalance Ratio: ${imbalanceRatio}`);
    console.log(`Total Buy Volume: ${totalBuyVolume}`);
    console.log(`Total Sell Volume: ${totalSellVolume}`);

    if (spread > 0) {
        console.log('Market is active, potential volatility detected.');
    }

    if (largeBuys.length > 0) {
        console.log('Large Buy Orders Detected', largeBuys);
    }
    if (largeSells.length > 0) {
        console.log('Large Sell Orders Detected', largeSells);
    }
};
