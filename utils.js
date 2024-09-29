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
