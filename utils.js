import { coinDecimal, stopLossPercentage, triggerPriceUp } from './bot.js';

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

export const calculateStopLoss = (price) => {
    return parseFloat(price * (1 - stopLossPercentage / 100)).toFixed(coinDecimal);
};

export const calculateTriggerPrice = (price) => {
    console.log({ triggerPriceUp, price });

    const updatedPrice = price * (1 + triggerPriceUp);
    console.log({ updatedPrice });

    return parseFloat(updatedPrice).toFixed(coinDecimal);
};

export const calculateProfit = (buyPrice, sellPrice, qty) => {
    if (buyPrice <= 0 || qty <= 0) {
        console.log('Buy price and quantity must be greater than zero.');
    }

    const profitOrLossPerUnit = sellPrice - buyPrice;
    const totalProfitOrLoss = profitOrLossPerUnit * qty;

    return totalProfitOrLoss.toFixed(4);
};

// Update order book based on your custom format
export function updateOrderBook(updates) {
    return updates?.map((order) => {
        const [id, price, side, size] = order;
        return { id, price, side, size };
    });
}
