import { WebSocket } from 'ws';
import { authenticate } from './credentials.js';
import {
    cancelledOrder,
    placeMarketOrder,
    placeOrderWithSL,
    updatePlaceOrder,
    updateTPSLOrder
} from './oparation/wsOparation.js';
import { subscribeCandleAndOrderBook, subscribeToOrderAndWallet } from './subscribe/subscribe.js';
import { isGreenCandle, performStrategyAnalysis } from './strategy/strategy.js';
import { calculateProfit, calculateStopLoss } from './utils.js';
import { getWalletBalance } from './oparation/bybit-api.js';
import { handleOrderbookUpdate, OrderBooks } from './oparation/orderbook.js';

// WebSocket URLs
const wsURL = 'wss://stream.bybit.com/v5/private';
const wsTradeURL = 'wss://stream.bybit.com/v5/trade';
const wsPublicURL = 'wss://stream.bybit.com/v5/public/spot';

// Trade Settings
const tradeCoin = 'ETH';
const symbol = `${tradeCoin}USDC`;
const initialStopLoss = 0.03;
const stopLossPercentage = 0.005;
export const triggerPriceUp = 0.05;
export const coinDecimal = 2;
const qtyDecimal = 5;
const orderUP = 0.2;

// Variables to track orders
let limitOrderId = null;
let equityBalance = null;
let buyOrderPrice = null;
let limitOrderPrice = null;
let unTriggerOrderId = null;
let orderStatus = null;
let is1minGreenCandle = null;
let is15minGreenCandle = null;
let lastPrice = null;
let sellLimitOrderId = null;
let sellQty = null;
let sellOrderPrice = null;
let isOrderPlaced = false;
let isCancelOrder = false;
let isSellOrderCancel = false;

let ws, wsTrade, wsPublic;

const reconnectDelay = 1000;

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
                if (order?.side === 'Buy') {
                    limitOrderId = order?.orderId;
                    limitOrderPrice = order?.price;
                    buyOrderPrice = order?.price;
                    orderStatus = order?.orderStatus;
                    isOrderPlaced = false;
                }
                if (order?.side === 'Sell') {
                    sellOrderPrice = order?.price;
                    sellLimitOrderId = order?.orderId;
                    sellQty = order?.qty;
                    orderStatus = order?.orderStatus;
                }
                break;
            case 'Untriggered':
                unTriggerOrderId = order?.orderId;
                orderStatus = order?.orderStatus;
                break;
            case 'Filled':
                if (order?.side === 'Buy') {
                    limitOrderId = null;
                }
                if (order?.side === 'Sell') {
                    const profitOrLoss = parseFloat(
                        calculateProfit(
                            buyOrderPrice,
                            parseFloat(order?.price),
                            parseFloat(order?.qty)
                        )
                    );
                    console.log(`SL Hit ${profitOrLoss >= 0 ? 'Profit' : 'Loss'} $${profitOrLoss}`);
                    resetOrderTracking();
                }
                break;
        }
    });
};

// Handle Wallet Transaction
const handleWalletUpdate = (walletData) => {
    const usdcBalance = walletData?.[0]?.coin?.find(({ coin }) => coin === 'USDC');
    const availableBalance = parseFloat(usdcBalance?.availableToWithdraw);
    if (usdcBalance && availableBalance > 10) {
        equityBalance = availableBalance - 0.2;
    }
};

// Reset tracking variables after an order is completed or cancelled
const resetOrderTracking = () => {
    limitOrderId = null;
    unTriggerOrderId = null;
    orderStatus = null;
    isOrderPlaced = false;
    sellLimitOrderId = null;
    isCancelOrder = false;
    isSellOrderCancel = false;
    sellOrderPrice = null;
};

// Handle candle data and check for conditions to place an order
const handleCandleData = async (candle) => {
    if (candle?.interval === '1') is1minGreenCandle = isGreenCandle(candle);
    if (candle?.interval === '15') is15minGreenCandle = isGreenCandle(candle);
};

const handleStopLossMarketOrder = async () => {
    const orderBooks = OrderBooks?.books?.['50']?.book;
    const findPendingOrder = orderBooks.findIndex(
        (order) => order[1] === parseFloat(sellOrderPrice) && order[2] === 'Sell'
    );

    if (findPendingOrder <= 22 && findPendingOrder > 0 && !isSellOrderCancel && sellOrderPrice) {
        isSellOrderCancel = true;
        await cancelledOrder({
            ws: wsTrade,
            symbol,
            orderId: sellLimitOrderId
        });
        await placeMarketOrder({
            ws: wsTrade,
            symbol,
            qty: sellQty,
            side: 'Sell'
        });
        console.log('Stop Loss Market Order Sell');
    }
};

const handleChangeTickers = async (price) => {
    lastPrice = price;
};

const handleOrderBooksChanging = async () => {
    const orderBooks = OrderBooks?.books?.['50']?.book;
    const orderBookSignal = performStrategyAnalysis(orderBooks);
    const lastOrderPrice = orderBookSignal?.highestOrder;

    // Update Stop-Loss when conditions are met
    if (unTriggerOrderId && orderStatus === 'Untriggered' && limitOrderPrice < lastOrderPrice) {
        const stopLossPrice = calculateStopLoss(lastOrderPrice, stopLossPercentage, coinDecimal);
        const triggerPrice = (parseFloat(stopLossPrice) + triggerPriceUp).toFixed(coinDecimal);
        await updateTPSLOrder({
            ws: wsTrade,
            orderId: unTriggerOrderId,
            slOrderType: 'Limit',
            symbol,
            stopLossPrice,
            triggerPrice
        });
        limitOrderPrice = lastOrderPrice;
        console.log(`Updated Stop Loss to ${stopLossPrice}`);
    }

    // Place a buy limit order if both candle conditions are green and no order is placed
    if (
        is1minGreenCandle &&
        is15minGreenCandle &&
        orderBookSignal?.signal === 'Buy' &&
        !orderStatus &&
        !limitOrderId &&
        !isOrderPlaced
    ) {
        isOrderPlaced = true;
        await placeBuyLimitOrder(lastOrderPrice);
    }

    if (orderStatus === 'New' && limitOrderId) {
        const findOrder = orderBooks.findIndex(
            (order) => order[1] === parseFloat(buyOrderPrice) && order[2] === 'Buy'
        );

        if (findOrder >= 28 && !isCancelOrder) {
            isCancelOrder = true;
            await cancelledOrder({ ws: wsTrade, symbol, orderId: limitOrderId });
            console.log(`Cancelled Order: ${limitOrderId}`);
            resetOrderTracking();
        }
    }
    if (sellLimitOrderId && orderStatus === 'New') {
        handleStopLossMarketOrder();
    }
};

const placeBuyLimitOrder = async (highestOrder) => {
    const slPrice = calculateStopLoss(highestOrder, initialStopLoss, coinDecimal);
    const triggerPrice = (parseFloat(slPrice) + triggerPriceUp).toFixed(coinDecimal);
    // Check available wallet balance
    const walletBalance = (
        equityBalance || (await getWalletBalance('USDC'))?.[0]?.availableToWithdraw - 0.2
    ).toFixed(2);
    // Calculate the quantity based on available balance and price
    const qty = (parseFloat(walletBalance) / parseFloat(highestOrder + triggerPriceUp)).toFixed(
        qtyDecimal
    );

    console.log(
        `Placing Buy Limit Order at Price: ${
            highestOrder + triggerPriceUp
        }, Stop Loss Price: ${slPrice}`
    );

    await placeOrderWithSL({
        ws: wsTrade,
        symbol,
        qty,
        side: 'Buy',
        orderType: 'Limit',
        price: (highestOrder + triggerPriceUp).toFixed(2),
        triggerPrice,
        slLimitPrice: slPrice
    });
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
        if (response.topic === 'wallet') handleWalletUpdate(response.data);
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
        if (response?.topic?.startsWith('kline')) handleCandleData(response.data?.[0]);
        if (response?.topic?.startsWith('tickers')) {
            await handleChangeTickers(response?.data?.lastPrice);
        }
        if (response?.topic?.startsWith('orderbook')) {
            handleOrderbookUpdate(response);
            await handleOrderBooksChanging();
        }
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

const restartBot = () => {
    console.log('Restarting bot due to error...');
    initializeWebSocketConnections();
};

// Start the bot
initializeWebSocketConnections();
