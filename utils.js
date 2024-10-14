export const calculateStopLoss = (price, stopLossPercentage, coinDecimal) => {
    return parseFloat(price * (1 - stopLossPercentage / 100)).toFixed(coinDecimal);
};

export const calculateProfit = (buyPrice, sellPrice, qty) => {
    const profitOrLossPerUnit = sellPrice - buyPrice;
    const totalProfitOrLoss = profitOrLossPerUnit * qty;
    return totalProfitOrLoss.toFixed(4);
};
