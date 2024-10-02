import { WebSocket } from 'ws';
import { authenticate } from './credentials.js';
import {
    cancelledOrder,
    placeMarketOrder,
    placeOrderWithSL,
    updateTPSLOrder
} from './operation/wsOperation.js';
import { subscribeCandleAndOrderBook, subscribeToOrderAndWallet } from './subscribe/subscribe.js';
import { isGreenCandle, performStrategyAnalysis } from './strategy/strategy.js';
import { calculateProfit, calculateStopLoss } from './utils.js';
import { getWalletBalance } from './operation/bybit-api.js';
import { handleOrderbookUpdate, OrderBooks } from './operation/orderbook.js';

// WebSocket URLs
const wsURLs = {
    private: 'wss://stream.bybit.com/v5/private',
    trade: 'wss://stream.bybit.com/v5/trade',
    public: 'wss://stream.bybit.com/v5/public/spot'
};

// Trade Settings
export const tradeSettings = {
    coin: 'ETH',
    symbol: 'ETHUSDC',
    initialStopLoss: 0.02,
    stopLossPercentage: 0.003,
    triggerPriceUp: 0.05,
    coinDecimal: 2,
    qtyDecimal: 5,
    orderUp: 0.2
};

// Order Tracking Variables
export let orderTracking = {
    limitOrderId: null,
    equityBalance: null,
    buyOrderPrice: null,
    limitOrderPrice: null,
    unTriggerOrderId: null,
    orderStatus: null,
    isOrderPlaced: false,
    isCancelOrder: false,
    sellOrder: {
        id: null,
        qty: null,
        price: null,
        isCancel: false
    },
    isGreenCandle: {
        '1min': null,
        '15min': null
    },
    lastPrice: null
};

let orderBooks = [];
const reconnectDelay = 1000;
export let wsConnections = {};

// Reconnection logic for WebSocket
const reconnectWebSocket = (wsUrl, wsType) => {
    console.log(`Reconnecting ${wsType} WebSocket...`);
    setTimeout(() => initializeWebSocket(wsUrl, wsType), reconnectDelay);
};

// // Handle order updates
const handleOrderUpdate = (orders) => {
    orders.forEach((order) => {
        const { orderId, price, qty, orderStatus, side } = order;
        const { sellOrder } = orderTracking;

        switch (orderStatus) {
            case 'New':
                if (side === 'Buy') {
                    Object.assign(orderTracking, {
                        limitOrderId: orderId,
                        limitOrderPrice: price,
                        buyOrderPrice: price,
                        orderStatus
                    });
                } else if (side === 'Sell') {
                    Object.assign(sellOrder, { id: orderId, price, qty });
                    Object.assign(orderTracking, {
                        orderStatus
                    });
                }
                break;
            case 'Untriggered':
                orderTracking.unTriggerOrderId = orderId;
                orderTracking.orderStatus = orderStatus;
                break;
            case 'Cancelled':
                if (side === 'Sell') {
                    placeMarketOrder({
                        ws: wsConnections.trade,
                        symbol: tradeSettings.symbol,
                        qty,
                        side: 'Sell'
                    });
                    resetOrderTracking();
                }
                break;
            case 'Filled':
                if (side === 'Buy') orderTracking.limitOrderId = null;
                if (side === 'Sell') {
                    const profitOrLoss = calculateProfit(orderTracking.buyOrderPrice, price, qty);
                    resetOrderTracking();
                    console.log(`SL Hit ${profitOrLoss >= 0 ? 'Profit' : 'Loss'} $${profitOrLoss}`);
                }
                break;
        }
    });
};

// Handle Wallet updates
const handleWalletUpdate = (walletData) => {
    const usdcBalance = walletData?.[0]?.coin?.find(({ coin }) => coin === 'USDC');
    const availableBalance = parseFloat(usdcBalance?.availableToWithdraw);
    if (availableBalance > 10) {
        orderTracking.equityBalance = availableBalance - 0.2;
    }
};

// Handle Candle Data
const handleCandleData = (candle) => {
    const interval = candle?.interval;
    if (interval === '1') orderTracking.isGreenCandle['1min'] = isGreenCandle(candle);
    if (interval === '15') orderTracking.isGreenCandle['15min'] = isGreenCandle(candle);
};

// Reset tracking variables after an order is completed or cancelled
const resetOrderTracking = () => {
    orderTracking = {
        ...orderTracking,
        limitOrderId: null,
        unTriggerOrderId: null,
        orderStatus: null,
        isOrderPlaced: false,
        isCancelOrder: false,
        sellOrder: {
            id: null,
            qty: null,
            price: null,
            isCancel: false
        }
    };
};

// Update Stop-Loss when conditions are met
const updateStopLoss = async () => {
    const { unTriggerOrderId, orderStatus, limitOrderPrice, lastPrice } = orderTracking;
    const { symbol, stopLossPercentage, coinDecimal } = tradeSettings;

    if (
        unTriggerOrderId &&
        orderStatus === 'Untriggered' &&
        parseFloat(limitOrderPrice) < parseFloat(lastPrice)
    ) {
        orderTracking.limitOrderPrice = lastPrice;
        const stopLossPrice = calculateStopLoss(lastPrice, stopLossPercentage, coinDecimal);
        const triggerPrice = (parseFloat(stopLossPrice) + tradeSettings.triggerPriceUp).toFixed(
            coinDecimal
        );

        await updateTPSLOrder({
            ws: wsConnections.trade,
            orderId: unTriggerOrderId,
            slOrderType: 'Limit',
            symbol,
            stopLossPrice,
            triggerPrice
        });
        console.log(`Updated Stop Loss to ${stopLossPrice}`);
    }
};

// Place Buy Limit Order
const placeBuyLimitOrder = async (highestOrder) => {
    const { symbol, triggerPriceUp, coinDecimal, initialStopLoss, qtyDecimal } = tradeSettings;
    const orderPrice = highestOrder.toFixed(coinDecimal);
    const slPrice = calculateStopLoss(highestOrder, initialStopLoss, coinDecimal);
    const triggerPrice = (parseFloat(slPrice) + triggerPriceUp).toFixed(coinDecimal);

    const walletBalance =
        orderTracking.equityBalance ||
        (await getWalletBalance('USDC'))?.[0]?.availableToWithdraw - 0.2;
    const qty = (parseFloat(walletBalance) / parseFloat(highestOrder + triggerPriceUp)).toFixed(
        qtyDecimal
    );

    await placeOrderWithSL({
        ws: wsConnections.trade,
        symbol,
        qty,
        side: 'Buy',
        orderType: 'Limit',
        price: orderPrice,
        triggerPrice,
        slLimitPrice: slPrice
    });
    console.log(`Placed Buy Limit Order at Price: ${orderPrice}, Stop Loss: ${slPrice}`);
};

// Handle tickers updates
const handleChangeTickers = (price) => {
    orderTracking.lastPrice = price;
};

const handleStopLossMarketOrder = async () => {
    const { sellOrder } = orderTracking;
    const findOrder = orderBooks.findIndex(
        (order) => order[1] === parseFloat(sellOrder.price) && order[2] === 'Sell'
    );

    if (findOrder === -1 || findOrder <= 15) {
        orderTracking.sellOrder.isCancel = true;
        await cancelledOrder({
            ws: wsConnections.trade,
            symbol: tradeSettings.symbol,
            orderId: sellOrder.id
        });
        console.log(`Cancelled Sell Order: ${sellOrder.id}`);
    }
};

// Handle Orderbook changes
const handleOrderBooksChanging = async () => {
    orderBooks = OrderBooks?.books?.['50']?.book;
    const { isGreenCandle, lastPrice } = orderTracking;
    const orderBookSignal = performStrategyAnalysis(orderBooks);
    const lastOrderPrice = orderBookSignal?.highestOrder;

    // Update Stop Loss if necessary
    await updateStopLoss();

    // Check if the order
    // if (
    //     isGreenCandle['1min'] &&
    //     isGreenCandle['15min'] &&
    //     orderBookSignal?.signal === 'Buy' &&
    //     !orderTracking.orderStatus &&
    //     !orderTracking.limitOrderId &&
    //     !orderTracking.isOrderPlaced
    // ) {
    //     orderTracking.isOrderPlaced = true;
    //     await placeBuyLimitOrder(lastOrderPrice);
    // }

    // Cancel Buy Order if necessary
    if (orderTracking.orderStatus === 'New' && orderTracking.limitOrderId) {
        const findOrder = orderBooks.findIndex(
            (order) => order[1] === parseFloat(orderTracking.buyOrderPrice) && order[2] === 'Buy'
        );

        if (findOrder === -1 || (findOrder >= 35 && !orderTracking.isCancelOrder)) {
            orderTracking.isCancelOrder = true;
            await cancelledOrder({
                ws: wsConnections.trade,
                symbol: tradeSettings.symbol,
                orderId: orderTracking.limitOrderId
            });
            console.log(`Cancelled Order: ${orderTracking.limitOrderId}`);
            resetOrderTracking();
        }
    }

    // Handle Stop-Loss Market Order
    if (
        orderTracking.sellOrder.id &&
        orderTracking.orderStatus === 'New' &&
        !orderTracking.sellOrder.isCancel
    ) {
        await handleStopLossMarketOrder();
    }
};

// Initialize WebSocket connections
const initializeWebSocket = (wsUrl, wsType) => {
    const ws = new WebSocket(wsUrl);
    wsConnections[wsType.toLowerCase()] = ws;

    ws.on('open', () => {
        console.log(`${wsType} WebSocket connected`);
        authenticate(ws);
        if (wsType === 'Public') subscribeCandleAndOrderBook(ws, tradeSettings.symbol);
    });

    ws.on('message', async (data) => {
        const response = JSON.parse(data);
        if (response.op === 'auth') subscribeToOrderAndWallet(ws);
        if (response?.topic === 'order') handleOrderUpdate(response.data);
        if (response?.topic === 'wallet') handleWalletUpdate(response.data);
        if (response?.topic?.startsWith('kline')) handleCandleData(response.data[0]);
        if (response?.topic?.startsWith('tickers')) handleChangeTickers(response.data.lastPrice);
        if (response?.topic?.startsWith('orderbook')) {
            handleOrderbookUpdate(response);
            await handleOrderBooksChanging();
        }
    });

    ws.on('error', (error) => console.error(`${wsType} WebSocket Error`, error));
    ws.on('close', () => reconnectWebSocket(wsUrl, wsType));
};

// Start WebSocket connections
initializeWebSocket(wsURLs.public, 'Public');
initializeWebSocket(wsURLs.private, 'Private');
initializeWebSocket(wsURLs.trade, 'Trade');
