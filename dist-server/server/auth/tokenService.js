import crypto from 'crypto';
import { logger } from '../utils/logger.js';
const DEFAULT_TTL_SECONDS = 60 * 60 * 6; // 6 hours
let ephemeralSecret = null;
function getSigningSecret() {
    const configured = process.env.SESSION_TOKEN_SECRET;
    if (configured && configured.length >= 16 &&
        !/^(CHANGE_ME|MY_|<)/i.test(configured)) {
        return configured;
    }
    if (process.env.NODE_ENV === 'production') {
        throw new Error(configured
            ? 'SESSION_TOKEN_SECRET still contains a placeholder value'
            : 'SESSION_TOKEN_SECRET is required in production');
    }
    if (!ephemeralSecret) {
        ephemeralSecret = crypto.randomBytes(32).toString('hex');
        if (process.env.NODE_ENV === 'production') {
            logger.warn('SESSION_TOKEN_SECRET is not set in production; using ephemeral process secret');
        }
    }
    return ephemeralSecret;
}
function base64UrlEncode(input) {
    return Buffer.from(input)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}
function base64UrlDecode(input) {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
    return Buffer.from(normalized + pad, 'base64');
}
export function issueReceiverToken(sessionId, receiverId, ttlSeconds = DEFAULT_TTL_SECONDS) {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        sessionId,
        receiverId,
        iat: now,
        exp: now + ttlSeconds,
    };
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signature = crypto
        .createHmac('sha256', getSigningSecret())
        .update(encodedPayload)
        .digest();
    return `${encodedPayload}.${base64UrlEncode(signature)}`;
}
export function verifyReceiverToken(token) {
    if (!token || typeof token !== 'string')
        return null;
    const parts = token.split('.');
    if (parts.length !== 2)
        return null;
    const [encodedPayload, encodedSig] = parts;
    if (!encodedPayload || !encodedSig)
        return null;
    const expectedSig = crypto
        .createHmac('sha256', getSigningSecret())
        .update(encodedPayload)
        .digest();
    let actualSig;
    try {
        actualSig = base64UrlDecode(encodedSig);
    }
    catch {
        return null;
    }
    if (actualSig.length !== expectedSig.length) {
        return null;
    }
    if (!crypto.timingSafeEqual(actualSig, expectedSig)) {
        return null;
    }
    try {
        const parsed = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8'));
        if (!parsed ||
            typeof parsed.sessionId !== 'string' ||
            typeof parsed.receiverId !== 'string' ||
            typeof parsed.exp !== 'number') {
            return null;
        }
        const now = Math.floor(Date.now() / 1000);
        if (parsed.exp < now) {
            return null;
        }
        return parsed;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=tokenService.js.map