import crypto from 'crypto';
import 'dotenv/config';

export const API_KEY = process.env.API_KEY;
export const API_SECRET = process.env.API_SECRET;

// Generate the correct expires timestamp and signature
const generateSignature = (expires) => {
    const preHashString = `GET/realtime${expires}`;
    return crypto.createHmac('sha256', API_SECRET).update(preHashString).digest('hex');
};

// Function to authenticate WebSocket connection
export const authenticate = (ws) => {
    const expires = Date.now() + 10000;
    const signature = generateSignature(expires);

    const authPayload = {
        op: 'auth',
        args: [API_KEY, expires, signature]
    };

    ws.send(JSON.stringify(authPayload));
};
