export const subscribeToOrderAndWallet = (ws) => {
    const orderPayload = {
        op: 'subscribe',
        args: ['order']
    };

    ws.send(JSON.stringify(orderPayload));
};

export const subscribeCandleAndOrderBook = (ws, symbol) => {
    if (!ws) {
        console.error('WebSocket is not defined');
        return;
    }

    ws.send(
        JSON.stringify({
            op: 'subscribe',
            args: [
                `kline.1.${symbol}`,
                `kline.15.${symbol}`,
                `tickers.${symbol}`,
                `orderbook.1.${symbol}`
            ]
        })
    );
};
