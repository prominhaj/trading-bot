import { OrderBookLevel, OrderBooksStore } from 'orderbooks';

// Initialize the OrderBooksStore
export const OrderBooks = new OrderBooksStore({
    checkTimestamps: false,
    maxDepth: 50
});

// Helper to process both bid and ask levels
const processOrderLevels = (levels, symbol, side) => {
    const upsertLevels = [];
    const deleteLevels = [];

    for (let i = 0; i < levels.length; i++) {
        const [price, amount] = levels[i];
        const level = OrderBookLevel(symbol, +price, side, +amount);

        // If amount is 0, mark for deletion; otherwise, mark for insertion/updating
        if (amount === 0) {
            deleteLevels.push(level);
        } else {
            upsertLevels.push(level);
        }
    }
    return { upsertLevels, deleteLevels };
};

export function handleOrderbookUpdate(message) {
    const { topic, type, data, cts } = message;
    const [_, symbol] = topic.split('.');

    // Process bid and ask levels separately
    const { upsertLevels: upsertBids, deleteLevels: deleteBids } = processOrderLevels(
        data.b,
        symbol,
        'Buy'
    );
    const { upsertLevels: upsertAsks, deleteLevels: deleteAsks } = processOrderLevels(
        data.a,
        symbol,
        'Sell'
    );

    const upsertLevels = [...upsertBids, ...upsertAsks];
    const deleteLevels = [...deleteBids, ...deleteAsks];

    if (type === 'snapshot') {
        // Handle the initial snapshot of the order book
        OrderBooks.handleSnapshot(symbol, upsertLevels, cts);
    } else if (type === 'delta') {
        // Handle incremental changes (delta updates)
        OrderBooks.handleDelta(symbol, deleteLevels, upsertLevels, [], cts);
    } else {
        console.error('Unhandled orderbook update type:', type);
    }
}
