import { WebSocket } from 'ws';
import { authenticate } from './credentials.js';
import { placeLimitOrderWithSL, updateTPSLOrder } from './oparation/wsOparation.js';
import { subscribeCandleAndOrderBook, subscribeToOrderAndWallet } from './subscribe/subscribe.js';
import { isGreenCandle } from './strategy/strategy.js';
import { calculateStopLoss, trackBidsOrderBook } from './utils.js';
import { getWalletBalance } from './oparation/bybit-api.js';

// WebSocket URLs
const wsURL = 'wss://stream.bybit.com/v5/private';
const wsTradeURL = 'wss://stream.bybit.com/v5/trade';
const wsPublicURL = 'wss://stream.bybit.com/v5/public/spot';

// Trade Settings
const tradeCoin = 'SOL';
const symbol = `${tradeCoin}USDC`;
export const stopLossPercentage = 0.05;
export const triggerPriceUp = 0.01;
export const coinDecimal = 2;
const qtyDecimal = 3;

// Variables to track orders
let lastOrderBook = [];
let limitOrderId = null;
let limitOrderPrice = null;
let unTriggerOrderId = null;
let orderStatus = null;
let is1minGreenCandle = null;
let is15minGreenCandle = null;
let lastPrice = null;
let isOrderPlaced = false;

let ws, wsTrade, wsPublic;

const reconnectDelay = 5000;

// Reconnection logic for WebSocket
const reconnectWebSocket = (wsUrl, wsType) => {
    console.log(`Attempting to reconnect ${wsType} WebSocket...`);
    setTimeout(() => {
        if (wsType === 'Private') {
            ws = new WebSocket(wsUrl);
            initializePrivateWebSocket(ws);
        } else if (wsType === 'Trade') {
            wsTrade = new WebSocket(wsUrl);
            initializeTradeWebSocket(wsTrade);
        } else if (wsType === 'Public') {
            wsPublic = new WebSocket(wsUrl);
            initializePublicWebSocket(wsPublic);
        }
    }, reconnectDelay);
};

// Function to handle order updates
const handleOrderUpdate = (orders) => {
    orders.forEach((order) => {
        switch (order?.orderStatus) {
            case 'New':
                limitOrderId = order?.orderId;
                limitOrderPrice = order?.price;
                orderStatus = order?.orderStatus;
                isOrderPlaced = false;
                break;
            case 'Untriggered':
                unTriggerOrderId = order?.orderId;
                orderStatus = order?.orderStatus;
                break;
            case 'Filled':
                if (order?.side === 'Sell') {
                    console.log(`SL Hit at Price: ${order?.price}`);
                    resetOrderTracking();
                }
                break;
        }
    });
};

// Reset tracking variables after an order is completed or cancelled
const resetOrderTracking = () => {
    limitOrderId = null;
    unTriggerOrderId = null;
    orderStatus = null;
    isOrderPlaced = false;
};

// Handle candle data and check for conditions to place an order
const handleCandleData = async (candle) => {
    if (candle?.interval === '1') is1minGreenCandle = isGreenCandle(candle);
    if (candle?.interval === '15') is15minGreenCandle = isGreenCandle(candle);

    // Update Stop-Loss when conditions are met
    if (unTriggerOrderId && orderStatus === 'Untriggered' && limitOrderPrice < lastPrice) {
        const stopLossPrice = calculateStopLoss(lastPrice);
        const triggerPrice = (parseFloat(stopLossPrice) + triggerPriceUp).toFixed(coinDecimal);
        updateTPSLOrder({
            ws: wsTrade,
            orderId: unTriggerOrderId,
            symbol,
            stopLossPrice,
            triggerPrice
        });
        limitOrderPrice = lastPrice;
        console.log(`Updated Stop Loss to ${stopLossPrice}`);
    }

    // Place a buy limit order if both candle conditions are green and no order is placed
    if (
        is1minGreenCandle &&
        is15minGreenCandle &&
        !orderStatus &&
        !limitOrderId &&
        !isOrderPlaced
    ) {
        isOrderPlaced = true;
        await placeBuyLimitOrder();
    }
};

// Function to place a buy limit order
const placeBuyLimitOrder = async () => {
    const slPrice = calculateStopLoss(parseFloat(lastPrice));
    const triggerPrice = (parseFloat(slPrice) + triggerPriceUp).toFixed(coinDecimal);
    const walletBalance = (await getWalletBalance('USDC'))?.[0]?.availableToWithdraw - 0.2;
    const qty = (parseFloat(walletBalance) / parseFloat(lastPrice)).toFixed(qtyDecimal);

    console.log({ walletBalance, qty });

    // Place the limit order with Stop-Loss
    placeLimitOrderWithSL({
        ws: wsTrade,
        symbol,
        qty,
        side: 'Buy',
        price: lastPrice,
        triggerPrice,
        slLimitPrice: slPrice
    });

    console.log(
        `Placed Buy Limit Order at Price: ${lastPrice} initial Stop Loss Price: ${slPrice}`
    );
};

// WebSocket Initializers with reconnect logic
const initializePrivateWebSocket = (ws) => {
    ws.on('open', () => {
        console.log('Private WebSocket connected');
        authenticate(ws);
    });

    ws.on('message', (data) => {
        const response = JSON.parse(data);
        if (response.op === 'auth') subscribeToOrderAndWallet(ws);
        if (response.topic === 'order') handleOrderUpdate(response.data);
    });

    ws.on('error', (error) => console.error('Private WebSocket Error:', error));
    ws.on('close', () => {
        console.log('Private WebSocket closed');
        reconnectWebSocket(wsURL, 'Private');
    });
};

const initializeTradeWebSocket = (wsTrade) => {
    wsTrade.on('open', () => {
        console.log('Trade WebSocket connected');
        authenticate(wsTrade);
    });

    wsTrade.on('message', (data) => {
        const response = JSON.parse(data);
        if (response?.op === 'auth') console.log('Trade WebSocket authenticated');
        if (response?.op === 'order.create') {
            if (response.retCode === 0) {
                limitOrderId = response?.data?.orderId;
                console.log(`Order Placed: ${limitOrderId}`);
            } else {
                console.error(response?.retMsg);
            }
        }
    });

    wsTrade.on('error', (error) => console.error('Trade WebSocket Error:', error));
    wsTrade.on('close', () => {
        console.log('Trade WebSocket closed');
        reconnectWebSocket(wsTradeURL, 'Trade');
    });
};

const initializePublicWebSocket = (wsPublic) => {
    wsPublic.on('open', () => {
        console.log('Public WebSocket connected');
        subscribeCandleAndOrderBook(wsPublic, symbol);
    });

    wsPublic.on('message', async (data) => {
        const response = JSON.parse(data);
        if (response?.topic?.startsWith('kline')) await handleCandleData(response.data?.[0]);
        if (response?.topic?.startsWith('tickers')) lastPrice = response?.data?.lastPrice;
        if (response?.topic?.startsWith('orderbook'))
            trackBidsOrderBook(response?.data, lastOrderBook);
    });

    wsPublic.on('error', (error) => console.error('Public WebSocket Error:', error));
    wsPublic.on('close', () => {
        console.log('Public WebSocket closed');
        reconnectWebSocket(wsPublicURL, 'Public');
    });
};

// Start the bot with automatic reconnection
const initializeWebSocketConnections = () => {
    ws = new WebSocket(wsURL);
    wsTrade = new WebSocket(wsTradeURL);
    wsPublic = new WebSocket(wsPublicURL);

    initializePrivateWebSocket(ws);
    initializeTradeWebSocket(wsTrade);
    initializePublicWebSocket(wsPublic);
};

// Start the bot
initializeWebSocketConnections();
