import { RestClientV5 } from 'bybit-api';
import { API_KEY, API_SECRET } from '../credentials.js';

const client = new RestClientV5({
    testnet: false,
    key: API_KEY,
    secret: API_SECRET
});

export const getWalletBalance = async (coin) => {
    try {
        const { result } = await client.getWalletBalance({
            accountType: 'UNIFIED',
            coin
        });
        return result?.list?.[0]?.coin;
    } catch (error) {
        console.error(error.message);
    }
};
