export const calculateStopLoss = (price, stopLossPercentage, coinDecimal) => {
    return parseFloat(price * (1 - stopLossPercentage / 100)).toFixed(coinDecimal);
};

export const calculateProfit = (buyPrice, sellPrice, qty) => {
    if (buyPrice <= 0 || qty <= 0) {
        console.log('Buy price and quantity must be greater than zero.');
    }

    const profitOrLossPerUnit = sellPrice - buyPrice;
    const totalProfitOrLoss = profitOrLossPerUnit * qty;

    return totalProfitOrLoss.toFixed(4);
};

export function updateOrderBook(updates) {
    const updatedOrders = new Array(updates.length);

    for (let i = 0; i < updates.length; i++) {
        const order = updates[i];
        updatedOrders[i] = {
            id: order[0],
            price: order[1],
            side: order[2],
            size: order[3]
        };
    }

    return updatedOrders;
}
