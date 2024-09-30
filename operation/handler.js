import { orderTracking, tradeSettings, wsConnections } from '../bot.js';
import { isGreenCandle, performStrategyAnalysis } from '../strategy/strategy.js';
import { calculateProfit, calculateStopLoss } from '../utils.js';
import { getWalletBalance } from './bybit-api.js';
import { OrderBooks } from './orderbook.js';
import {
    cancelledOrder,
    placeMarketOrder,
    placeOrderWithSL,
    updateTPSLOrder
} from './wsOperation.js';

// Handle order updates
export const handleOrderUpdate = (orders) => {
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
                }
                break;
            case 'Untriggered':
                orderTracking.unTriggerOrderId = orderId;
                orderTracking.orderStatus = orderStatus;
                break;
            case 'Cancelled':
                if (side === 'Sell')
                    placeMarketOrder({
                        ws: wsConnections.trade,
                        symbol: tradeSettings.symbol,
                        qty,
                        side: 'Sell'
                    });
                break;
            case 'Filled':
                if (side === 'Buy') orderTracking.limitOrderId = null;
                if (side === 'Sell') {
                    const profitOrLoss = calculateProfit(orderTracking.buyOrderPrice, price, qty);
                    console.log(`SL Hit ${profitOrLoss >= 0 ? 'Profit' : 'Loss'} $${profitOrLoss}`);
                    resetOrderTracking();
                }
                break;
        }
    });
};

// Handle Wallet updates
export const handleWalletUpdate = (walletData) => {
    const usdcBalance = walletData?.[0]?.coin?.find(({ coin }) => coin === 'USDC');
    if (usdcBalance)
        orderTracking.equityBalance = parseFloat(usdcBalance.availableToWithdraw) - 0.2;
};

// Handle Candle Data
export const handleCandleData = (candle) => {
    const interval = candle?.interval;
    if (interval === '1') orderTracking.isGreenCandle['1min'] = isGreenCandle(candle);
    if (interval === '15') orderTracking.isGreenCandle['15min'] = isGreenCandle(candle);
};

// Handle tickers updates
export const handleChangeTickers = (price) => (orderTracking.lastPrice = price);

// Handle Orderbook changes
export const handleOrderBooksChanging = async () => {
    const { isGreenCandle, lastPrice } = orderTracking;
    const orderBookSignal = performStrategyAnalysis(OrderBooks?.books?.['50']?.book);
    const lastOrderPrice = orderBookSignal?.highestOrder;

    await updateStopLoss();

    if (
        isGreenCandle['1min'] &&
        isGreenCandle['15min'] &&
        orderBookSignal?.signal === 'Buy' &&
        !orderTracking.orderStatus &&
        !orderTracking.limitOrderId &&
        !orderTracking.isOrderPlaced
    ) {
        orderTracking.isOrderPlaced = true;
        await placeBuyLimitOrder(lastOrderPrice);
    }

    // Cancel Buy Order if necessary
    if (orderTracking.orderStatus === 'New' && orderTracking.limitOrderId) {
        const findOrder = OrderBooks?.books?.['50']?.book.findIndex(
            (order) => order[1] === parseFloat(orderTracking.buyOrderPrice) && order[2] === 'Buy'
        );
        if (findOrder >= 30 && !orderTracking.isCancelOrder) {
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
    if (orderTracking.sellOrder.id && orderTracking.orderStatus === 'New')
        handleStopLossMarketOrder();
};

export const updateStopLoss = async () => {
    const { unTriggerOrderId, orderStatus, limitOrderPrice } = orderTracking;
    const { lastPrice, symbol, stopLossPercentage, coinDecimal } = tradeSettings;

    if (unTriggerOrderId && orderStatus === 'Untriggered' && limitOrderPrice < lastPrice) {
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
        orderTracking.limitOrderPrice = lastPrice;
        console.log(`Updated Stop Loss to ${stopLossPrice}`);
    }
};

// Place Buy Limit Order
export const placeBuyLimitOrder = async (highestOrder) => {
    const { symbol, triggerPriceUp, coinDecimal, initialStopLoss, qtyDecimal } = tradeSettings;
    const orderPrice = (highestOrder + triggerPriceUp).toFixed(coinDecimal);
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

// Reset tracking variables after an order is completed or cancelled
export const resetOrderTracking = () => {
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
