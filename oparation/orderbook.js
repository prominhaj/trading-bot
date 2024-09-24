import { OrderBookLevel, OrderBooksStore } from 'orderbooks';

// Initialize the OrderBooksStore
export const OrderBooks = new OrderBooksStore({
    checkTimestamps: false,
    maxDepth: 50
});

export function handleOrderbookUpdate(message) {
    const { topic, type, data, cts } = message;
    const [topicKey, symbol] = topic.split('.');

    const bidsArray = data.b.map(([price, amount]) => {
        return OrderBookLevel(symbol, +price, 'Buy', +amount);
    });

    const asksArray = data.a.map(([price, amount]) => {
        return OrderBookLevel(symbol, +price, 'Sell', +amount);
    });

    const allBidsAndAsks = [...bidsArray, ...asksArray];

    if (type === 'snapshot') {
        // Store initial snapshot
        const storedOrderbook = OrderBooks.handleSnapshot(symbol, allBidsAndAsks, cts);
        return;
    }

    if (type === 'delta') {
        const upsertLevels = [];
        const deleteLevels = [];

        // Separate "deletes" from "updates/inserts"
        allBidsAndAsks.forEach((level) => {
            const [_, price, side, qty] = level;

            if (qty === 0) {
                deleteLevels.push(level);
            } else {
                upsertLevels.push(level);
            }
        });

        // Feed delta into orderbook store
        const storedOrderbook = OrderBooks.handleDelta(symbol, deleteLevels, upsertLevels, [], cts);
        return;
    }

    console.error('unhandled orderbook update type: ', type);
}
