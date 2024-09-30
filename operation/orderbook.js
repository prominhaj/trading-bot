import { OrderBookLevel, OrderBooksStore } from 'orderbooks';

// Initialize the OrderBooksStore
export const OrderBooks = new OrderBooksStore({
    checkTimestamps: false,
    maxDepth: 50
});

// Optimized helper function to process levels with less overhead
const processOrderLevels = (levels, symbol, side) => {
    const upsertLevels = [];
    const deleteLevels = [];

    // Avoid unnecessary conversions by parsing once and using loop efficiently
    for (let i = 0; i < levels.length; i++) {
        const price = +levels[i][0];
        const amount = +levels[i][1];

        // Skip if price is invalid (NaN) or zero, amount will be checked below
        if (!price) continue;

        // Directly create OrderBookLevel and push to the respective array
        const level = new OrderBookLevel(symbol, price, side, amount);

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

    // Combined and direct processing of both bid and ask levels
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

    // Combine bid and ask levels only once for better performance
    const upsertLevels = upsertBids.concat(upsertAsks);
    const deleteLevels = deleteBids.concat(deleteAsks);

    // Handle the message type accordingly
    switch (type) {
        case 'snapshot':
            OrderBooks.handleSnapshot(symbol, upsertLevels, cts);
            break;
        case 'delta':
            OrderBooks.handleDelta(symbol, deleteLevels, upsertLevels, [], cts);
            break;
        default:
            console.error('Unhandled orderbook update type:', type);
    }
}
