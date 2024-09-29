export function isGreenCandle(lastCandle) {
    if (!lastCandle) return false;

    const openPrice = parseFloat(lastCandle?.open);
    const closePrice = parseFloat(lastCandle?.close);

    return closePrice > openPrice;
}

// Perform Order Flow Imbalance Analysis, Wall Detection, and Arbitrage
export function performStrategyAnalysis(orderBook) {
    let totalBidQty = 0,
        totalAskQty = 0,
        highestBid = -Infinity,
        lowestAsk = Infinity;

    // Single-pass loop for all calculations
    for (let i = 0; i < orderBook.length; i++) {
        const order = orderBook[i];
        const size = order[3];

        // Skip invalid or zero-size orders immediately
        if (size <= 0) continue;

        const price = order[1];
        const side = order[2];

        // Aggregate quantities and find highest bid and lowest ask in one pass
        if (side === 'Buy') {
            totalBidQty += size;
            if (price > highestBid) highestBid = price;
        } else if (side === 'Sell') {
            totalAskQty += size;
            if (price < lowestAsk) lowestAsk = price;
        }
    }

    // Avoid division by zero
    const totalVolume = totalBidQty + totalAskQty;
    if (totalVolume === 0) return;

    // Calculate percentages in a single pass
    const bidPercentage = (totalBidQty / totalVolume) * 100;
    const askPercentage = 100 - bidPercentage; // Since it's just the complement

    // Calculate spread
    const spread = lowestAsk - highestBid;

    // Determine signal based on the order flow imbalance
    let signal;
    if (bidPercentage <= 40) {
        signal = 'Buy';
    } else if (askPercentage <= 40) {
        signal = 'Sell';
    } else {
        signal = 'Hold';
    }

    return {
        highestOrder: highestBid,
        signal,
        spread
    };
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
    let highestBid = -Infinity;
    let lowestAsk = Infinity;

    for (const order of orderBook) {
        if (order.size) {
            if (order.side === 'Buy') {
                highestBid = Math.max(highestBid, order.price);
            } else if (order.side === 'Sell') {
                lowestAsk = Math.min(lowestAsk, order.price);
            }
        }
    }

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
