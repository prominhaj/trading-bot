import { getServerTime } from './bybit-api.js';

// Function to place a buy order using the WebSocket // Working
export const placeBuyOrder = async (ws, symbol, qty, side, type, price = '0') => {
    const timestamp = await getServerTime();
    const orderPayload = {
        header: {
            'X-BAPI-TIMESTAMP': timestamp,
            'X-BAPI-RECV-WINDOW': '8000',
            Referer: 'bot-001'
        },
        op: 'order.create',
        args: [
            {
                symbol: symbol,
                side: side,
                orderType: type,
                qty: qty,
                price: price,
                category: 'spot',
                timeInForce: 'GTC'
            }
        ]
    };

    ws.send(JSON.stringify(orderPayload));
    console.log(`Limit Buy Order Sent: ${qty} ${symbol} at ${price}`);
};

export const placeOrderWithSL = async ({
    ws,
    symbol,
    qty,
    side,
    price = '0',
    triggerPrice,
    slLimitPrice,
    orderType
}) => {
    const timestamp = await getServerTime();
    const recvWindow = '5000';
    const orderPayload = {
        header: {
            'X-BAPI-TIMESTAMP': timestamp,
            'X-BAPI-RECV-WINDOW': recvWindow
        },
        op: 'order.create',
        args: [
            {
                category: 'spot',
                symbol: symbol,
                side: side,
                orderType,
                qty: qty,
                price: price,
                timeInForce: 'GTC',
                stopLoss: triggerPrice,
                slOrderType: 'Limit',
                slLimitPrice
            }
        ]
    };

    ws.send(JSON.stringify(orderPayload));
};

export const createTPSLOrder = ({ ws, symbol, qty, type, side, price = '0', triggerPrice }) => {
    const timestamp = Date.now();
    const orderPayload = {
        header: {
            'X-BAPI-TIMESTAMP': timestamp,
            'X-BAPI-RECV-WINDOW': '60000'
        },
        op: 'order.create',
        args: [
            {
                category: 'spot',
                symbol: symbol,
                side: side,
                orderType: type,
                qty,
                price,
                timeInForce: 'GTC',
                orderFilter: 'tpslOrder',
                slOrderType: 'Limit',
                triggerPrice
            }
        ]
    };

    ws.send(JSON.stringify(orderPayload));
};

export const updateTPSLOrder = async ({
    ws,
    orderId,
    symbol,
    stopLossPrice,
    triggerPrice,
    slOrderType
}) => {
    const timestamp = await getServerTime();
    const updateOrderPayload = {
        header: {
            'X-BAPI-TIMESTAMP': timestamp,
            'X-BAPI-RECV-WINDOW': '5000'
        },
        op: 'order.amend',
        args: [
            {
                order_id: orderId,
                symbol: symbol,
                price: stopLossPrice,
                category: 'spot',
                slOrderType,
                triggerPrice
            }
        ]
    };
    ws.send(JSON.stringify(updateOrderPayload));
};

// Function to update the buy order price using the WebSocket // Working
export const updateBuyOrder = async (ws, orderId, newPrice) => {
    const timestamp = await getServerTime();
    const updateOrderPayload = {
        header: {
            'X-BAPI-TIMESTAMP': timestamp,
            'X-BAPI-RECV-WINDOW': '5000'
        },
        op: 'order.amend',
        args: [
            {
                order_id: orderId,
                symbol: 'SOLUSDC',
                price: newPrice.toString(),
                category: 'spot',
                timeInForce: 'GTC'
            }
        ]
    };

    ws.send(JSON.stringify(updateOrderPayload));
    console.log(`Buy Order Updated: Order ID ${orderId}, New Price: ${newPrice}`);
};

// Function to place a stop-loss order
export const updateSLOrder = async (ws, symbol, stopPrice, slLimitPrice) => {
    const timestamp = await getServerTime();
    const stopLossPayload = {
        header: {
            'X-BAPI-TIMESTAMP': timestamp,
            'X-BAPI-RECV-WINDOW': '5000'
        },
        op: 'order.update',
        args: [
            {
                symbol: symbol,
                category: 'spot',
                orderId: '1779123374841491200',
                stopPrice: stopPrice,
                slOrderType: 'Limit',
                slLimitPrice: slLimitPrice
            }
        ]
    };

    ws.send(JSON.stringify(stopLossPayload));
};

export const cancelledOrder = async ({ ws, symbol, orderId }) => {
    const timestamp = await getServerTime();
    const stopLossPayload = {
        header: {
            'X-BAPI-TIMESTAMP': timestamp,
            'X-BAPI-RECV-WINDOW': '5000'
        },
        op: 'order.cancel',
        args: [
            {
                symbol: symbol,
                category: 'spot',
                orderId
            }
        ]
    };
    ws.send(JSON.stringify(stopLossPayload));
};
