import { WebSocket } from 'ws';
import { authenticate } from './credentials.js';
import { placeLimitOrderWithSL, updateTPSLOrder } from './oparation/wsOparation.js';
import { subscribeCandleAndOrderBook, subscribeToOrderAndWallet } from './subscribe/subscribe.js';
import { isGreenCandle } from './strategy/strategy.js';
import { calculateStopLoss, trackBidsOrderBook } from './utils.js';
import { getWalletBalance } from './oparation/bybit-api.js';

// WS API URL
const wsURL = 'wss://stream.bybit.com/v5/private';
const wsTradeURL = 'wss://stream.bybit.com/v5/trade';
const wsPublicURL = 'wss://stream.bybit.com/v5/public/spot';

// WebSocket connection
const ws = new WebSocket(wsURL);
const wsTrade = new WebSocket(wsTradeURL);
const wsPublic = new WebSocket(wsPublicURL);

// Trade Settings
const tradeCoin = 'SOL';
const symbol = `${tradeCoin}USDC`;
export const stopLossPercentage = 0.1;
export const triggerPriceUp = 0.01;
export const coinDecimal = 2;

// No Change Variables
let lastOrderBook = [];
let limitOrderId = null;
let limitOrderPrice = null;
let unTriggerOrderId = null;
let orderStatus = null;
let is1minGreenCandle = null;
let is15minGreenCandle = null;
let lastPrice = null;

const webSocketOrder = () => {
    // Track order
    ws.on('open', () => {
        console.log('WebSocket connection opened');
        authenticate(ws);
    });

    ws.on('message', (data) => {
        const response = JSON.parse(data);

        // Check if authentication was successful
        if (response.op === 'auth') {
            subscribeToOrderAndWallet(ws);
        }

        // Handle order updates
        if (response.topic === 'order') {
            const orders = response.data;
            orders.forEach((order) => {
                if (order?.orderStatus === 'New') {
                    limitOrderId = order?.orderId;
                    limitOrderPrice = order?.price;
                    orderStatus = order?.orderStatus;
                }
                if (order?.orderStatus === 'Untriggered') {
                    unTriggerOrderId = order?.orderId;
                    orderStatus = order?.orderStatus;
                }
                if (order?.orderStatus === 'Filled' && order?.side === 'Sell') {
                    console.log(`SL Hit Price in ${order?.price}`);

                    limitOrderId = null;
                    unTriggerOrderId = null;
                    orderStatus = null;
                }
            });
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket Error:', error);
    });

    ws.on('close', () => {
        console.log('WebSocket connection closed');
    });

    // Public WS connection
    wsPublic.on('open', () => {
        console.log('Public WebSocket connection opened');
        subscribeCandleAndOrderBook(wsPublic, symbol);
    });

    wsPublic.on('message', async (data) => {
        const response = JSON.parse(data);

        // Last Candle Data
        if (response?.topic?.startsWith('kline')) {
            const candle = response.data?.[0];

            if (candle?.interval === '1') {
                is1minGreenCandle = isGreenCandle(candle);
            }
            if (candle?.interval === '15') {
                is15minGreenCandle = isGreenCandle(candle);
            }

            // Track Limit Order Price And Current Order Price
            if (unTriggerOrderId && orderStatus === 'Untriggered') {
                const stopLossPrice = calculateStopLoss(lastPrice);
                const triggerPrice = (parseFloat(stopLossPrice) + triggerPriceUp).toFixed(
                    coinDecimal
                );
                if (limitOrderPrice < lastPrice) {
                    updateTPSLOrder({
                        ws: wsTrade,
                        orderId: unTriggerOrderId,
                        symbol,
                        stopLossPrice: stopLossPrice,
                        triggerPrice: triggerPrice
                    });
                    limitOrderPrice = lastPrice;
                    console.log(`Update Stop Loss Price ${stopLossPrice}`);
                }
            }

            if (is1minGreenCandle && is15minGreenCandle && !orderStatus && !limitOrderId) {
                const slPrice = calculateStopLoss(parseFloat(lastPrice));
                const triggerPrice = (parseFloat(slPrice) + triggerPriceUp).toFixed(coinDecimal);
                const fetchWalletBalance = await getWalletBalance('USDC');
                const walletBalance = Math.floor(
                    parseFloat(fetchWalletBalance?.[0]?.availableToWithdraw).toFixed(2)
                );
                const qty = (parseFloat(walletBalance) / parseFloat(lastPrice)).toFixed(3);

                // Place Buy Limit Order
                placeLimitOrderWithSL({
                    ws: wsTrade,
                    symbol,
                    qty,
                    side: 'Buy',
                    price: lastPrice,
                    triggerPrice: triggerPrice,
                    slLimitPrice: slPrice
                });

                console.log(`Limit Order Place Price in ${lastPrice}`);
            }
        }

        // Track market price
        if (response?.topic?.startsWith('tickers')) {
            lastPrice = response?.data?.lastPrice;
        }

        // Order Book Data
        if (response?.topic?.startsWith('orderbook')) {
            trackBidsOrderBook(response?.data, lastOrderBook);
        }
    });

    wsPublic.on('error', (error) => {
        console.error('Public WebSocket Error:', error);
    });

    wsPublic.on('close', () => {
        console.log('Public WebSocket connection closed');
    });

    // Trade WS connection
    wsTrade.on('open', () => {
        console.log('Trade WebSocket connection opened');
        authenticate(wsTrade);
    });

    wsTrade.on('message', async (data) => {
        const response = JSON.parse(data);
        // Check if authentication was successful
        if (response?.op === 'auth') {
            console.log(`Trade authentication successful`);
        }

        // Check Trade Response
        if (response?.op === 'order.create') {
            if (response.retCode === 0) {
                limitOrderId = response?.data?.orderId;
                console.log(`Order Place Id: ${response?.data?.orderId}`);
            } else {
                console.error(response?.retMsg);
            }
        }
    });

    wsTrade.on('error', (error) => {
        console.error('Trade WebSocket Error:', error);
    });

    wsTrade.on('close', () => {
        console.log('Trade WebSocket connection closed');
    });
};

webSocketOrder();
