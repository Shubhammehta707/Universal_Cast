export const HARD_MAX_RECEIVERS = 10;
const ID_REGEX = /^[a-zA-Z0-9_\-]{1,128}$/;
const PIN_REGEX = /^[0-9]{6}$/;
const ALLOWED_MEDIA_TYPES = new Set(['screen', 'video', 'photo', 'music']);
const ALLOWED_DEVICE_TYPES = new Set(['tv', 'browser', 'monitor', 'tablet', 'mobile']);
export function isValidId(value) {
    return typeof value === 'string' && ID_REGEX.test(value);
}
export function isValidPin(value) {
    return typeof value === 'string' && PIN_REGEX.test(value);
}
export function sanitizeString(value, maxLength, fallback = '') {
    if (typeof value !== 'string')
        return fallback;
    const trimmed = value.trim();
    if (!trimmed)
        return fallback;
    return trimmed.slice(0, maxLength);
}
export function clampMaxReceivers(value) {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num))
        return HARD_MAX_RECEIVERS;
    return Math.min(HARD_MAX_RECEIVERS, Math.max(1, Math.floor(num)));
}
export function normalizeMediaType(value) {
    if (typeof value === 'string' && ALLOWED_MEDIA_TYPES.has(value)) {
        return value;
    }
    return 'screen';
}
export function normalizeDeviceType(value) {
    if (typeof value === 'string' && ALLOWED_DEVICE_TYPES.has(value)) {
        return value;
    }
    return 'browser';
}
export function recordPinAttempt(attempts, now, windowMs = 5 * 60 * 1000, limit = 25) {
    const recent = attempts.filter((attempt) => now - attempt < windowMs);
    recent.push(now);
    return { allowed: recent.length <= limit, attempts: recent };
}
export function validateCreateSessionBody(body) {
    if (!body || typeof body !== 'object') {
        return { ok: false, error: 'Request body must be a JSON object' };
    }
    const obj = body;
    if (!isValidId(obj.sessionId)) {
        return { ok: false, error: 'Invalid sessionId format (1-128 alphanumeric, underscore, or hyphen characters)' };
    }
    if (!isValidPin(obj.pin)) {
        return { ok: false, error: 'PIN must be a 6-digit numeric string' };
    }
    const title = sanitizeString(obj.title, 100, 'Live Cast Session');
    if (title.length === 0) {
        return { ok: false, error: 'Session title is required' };
    }
    return {
        ok: true,
        data: {
            sessionId: obj.sessionId,
            pin: obj.pin,
            title,
            mediaType: normalizeMediaType(obj.mediaType),
            maxReceivers: clampMaxReceivers(obj.maxReceivers),
        },
    };
}
export function validatePinBody(body) {
    if (!body || typeof body !== 'object') {
        return { ok: false, error: 'Request body must be a JSON object' };
    }
    const obj = body;
    if (!isValidPin(obj.pin)) {
        return { ok: false, error: 'PIN must be a 6-digit numeric string' };
    }
    const rawSessionId = obj.sessionId;
    let sessionId;
    if (rawSessionId !== undefined && rawSessionId !== null && rawSessionId !== '' && rawSessionId !== 'lookup') {
        if (!isValidId(rawSessionId)) {
            return { ok: false, error: 'Invalid sessionId format' };
        }
        sessionId = rawSessionId;
    }
    return { ok: true, sessionId, pin: obj.pin };
}
export function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function isValidDtlsParameters(value) {
    if (!isPlainObject(value))
        return false;
    if (!Array.isArray(value.fingerprints) || value.fingerprints.length === 0)
        return false;
    return value.fingerprints.every((fp) => isPlainObject(fp) && typeof fp.algorithm === 'string' && typeof fp.value === 'string');
}
export function isValidRtpCapabilities(value) {
    if (!isPlainObject(value))
        return false;
    return Array.isArray(value.codecs) && value.codecs.length > 0;
}
export function isValidRtpParameters(value) {
    if (!isPlainObject(value))
        return false;
    return Array.isArray(value.codecs) && value.codecs.length > 0 && Array.isArray(value.encodings);
}
//# sourceMappingURL=validation.js.map