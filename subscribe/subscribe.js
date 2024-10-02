export const subscribeToOrderAndWallet = (ws) => {
    ws.send(
        JSON.stringify({
            op: 'subscribe',
            args: ['order', 'wallet']
        })
    );
};

export const subscribeCandleAndOrderBook = (ws, symbol) => {
    ws.send(
        JSON.stringify({
            op: 'subscribe',
            args: [
                `kline.1.${symbol}`,
                `kline.15.${symbol}`,
                `tickers.${symbol}`,
                `orderbook.50.${symbol}`
            ]
        })
    );
};
