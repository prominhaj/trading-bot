import { OrderBookLevel, OrderBooksStore } from 'orderbooks';

// Initialize the OrderBooksStore
export const OrderBooks = new OrderBooksStore({
    checkTimestamps: false,
    maxDepth: 50
});

export function handleOrderbookUpdate(message) {
    const { topic, type, data, cts } = message;
    const [_, symbol] = topic.split('.');

    const upsertLevels = [];
    const deleteLevels = [];

    // Combine bid and ask levels into a single pass
    const { b: bids, a: asks } = data;

    for (let i = 0; i < bids.length; i++) {
        const [price, amount] = bids[i];
        const level = OrderBookLevel(symbol, +price, 'Buy', +amount);
        if (amount === 0) {
            deleteLevels.push(level);
        } else {
            upsertLevels.push(level);
        }
    }

    for (let i = 0; i < asks.length; i++) {
        const [price, amount] = asks[i];
        const level = OrderBookLevel(symbol, +price, 'Sell', +amount);
        if (amount === 0) {
            deleteLevels.push(level);
        } else {
            upsertLevels.push(level);
        }
    }

    if (type === 'snapshot') {
        // Store initial snapshot
        OrderBooks.handleSnapshot(symbol, [...upsertLevels, ...deleteLevels], cts);
        return;
    }

    if (type === 'delta') {
        // Feed delta into the orderbook store
        OrderBooks.handleDelta(symbol, deleteLevels, upsertLevels, [], cts);
        return;
    }

    console.error('Unhandled orderbook update type:', type);
}
