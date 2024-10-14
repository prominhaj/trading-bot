import { RestClientV5 } from 'bybit-api';
import { API_KEY, API_SECRET } from '../credentials.js';
import crypto from 'crypto';

const client = new RestClientV5({
    testnet: false,
    key: API_KEY,
    secret: API_SECRET
});

const BASE_URL = 'https://api.bybit.com';

const createSignature = (params, secret) => {
    const orderedParams = Object.keys(params)
        .sort()
        .map((key) => `${key}=${params[key]}`)
        .join('&');
    return crypto.createHmac('sha256', secret).update(orderedParams).digest('hex');
};

export const getWalletBalance = async (coin) => {
    try {
        const serverTime = await getServerTime();
        const params = {
            accountType: 'UNIFIED',
            coin: coin || '',
            api_key: API_KEY,
            timestamp: serverTime,
            recv_window: 10000
        };

        const signature = createSignature(params, API_SECRET);
        const url = `${BASE_URL}/v5/account/wallet-balance?${new URLSearchParams(
            params
        ).toString()}&sign=${signature}`;

        const response = await fetch(url);
        const { result } = await response.json();
        return result?.list?.[0]?.coin;
    } catch (error) {
        console.error('Error fetching wallet balance:', error.message);
    }
};

export const getServerTime = async () => {
    const result = await client.getServerTime();
    return result?.time;
};
