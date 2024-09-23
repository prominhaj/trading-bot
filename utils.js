import { coinDecimal, stopLossPercentage, triggerPriceUp } from './bot.js';

// Function to handle delta updates and maintain top 20 orders
const handleDelta = (data) => {
    // Apply bid deltas
    data.b.forEach(([price, qty]) => {
        const index = currentOrderBook.bids.findIndex(([existingPrice]) => existingPrice === price);
        if (qty === '0') {
            // Remove zero quantity
            if (index !== -1) {
                currentOrderBook.bids.splice(index, 1);
            }
        } else {
            if (index !== -1) {
                // Update existing bid
                currentOrderBook.bids[index][1] = qty;
            } else {
                // Insert new bid
                currentOrderBook.bids.push([price, qty]);
            }
            // Sort and keep only top 20 bids
            currentOrderBook.bids
                .sort(([price1], [price2]) => parseFloat(price2) - parseFloat(price1))
                .slice(0, 20);
        }
    });

    // Apply ask deltas
    data.a.forEach(([price, qty]) => {
        const index = currentOrderBook.asks.findIndex(([existingPrice]) => existingPrice === price);
        if (qty === '0') {
            // Remove zero quantity
            if (index !== -1) {
                currentOrderBook.asks.splice(index, 1);
            }
        } else {
            if (index !== -1) {
                // Update existing ask
                currentOrderBook.asks[index][1] = qty;
            } else {
                // Insert new ask
                currentOrderBook.asks.push([price, qty]);
            }
            // Sort and keep only top 20 asks
            currentOrderBook.asks
                .sort(([price1], [price2]) => parseFloat(price1) - parseFloat(price2))
                .slice(0, 20);
        }
    });
};

export const trackBidsOrderBook = (data, currentOrderBook) => {
    // Apply bid deltas
    data?.b?.forEach(([price, qty]) => {
        const index = currentOrderBook.findIndex(([existingPrice]) => existingPrice === price);
        if (qty === '0') {
            // Remove zero quantity
            if (index !== -1) {
                currentOrderBook.splice(index, 1);
            }
        } else {
            if (index !== -1) {
                // Update existing bid
                currentOrderBook[index][1] = qty;
            } else {
                // Insert new bid
                currentOrderBook.push([price, qty]);
            }
        }
    });
};

function calculateOrderPercentage(orderBook) {
    let totalBidQty = 0,
        totalAskQty = 0;

    // Sum up all bid quantities
    orderBook.bids.forEach(([_, qty]) => (totalBidQty += parseFloat(qty)));

    // Sum up all ask quantities
    orderBook.asks.forEach(([_, qty]) => (totalAskQty += parseFloat(qty)));

    // Calculate total volume
    const totalVolume = totalBidQty + totalAskQty;

    // Calculate percentages
    const bidPercentage = (totalBidQty / totalVolume) * 100;
    const askPercentage = (totalAskQty / totalVolume) * 100;

    return {
        buyPercentage: parseInt(bidPercentage),
        sellPercentage: parseInt(askPercentage)
    };
}

export const calculateStopLoss = (price) => {
    return parseFloat(price * (1 - stopLossPercentage / 100)).toFixed(coinDecimal);
};

export const calculateTriggerPrice = (price) => {
    console.log({ triggerPriceUp, price });

    const updatedPrice = price * (1 + triggerPriceUp);
    console.log({ updatedPrice });

    return parseFloat(updatedPrice).toFixed(coinDecimal);
};
