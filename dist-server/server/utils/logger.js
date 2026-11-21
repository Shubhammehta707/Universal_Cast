const REDACTED_KEYS = new Set([
    'token',
    'idtoken',
    'receivertoken',
    'authorization',
    'secret',
    'sessiontokensecret',
    'sfuinternalsecret',
    'apikey',
    'password',
    'credential',
    'credentials',
    'turncredential',
    'privatekey',
    'pin',
    'jwt',
    'accesstoken',
    'refreshtoken',
]);
function redactValue(value, depth = 0) {
    if (depth > 4)
        return '[MaxDepth]';
    if (value === null || value === undefined)
        return value;
    if (typeof value === 'string') {
        if (value.startsWith('Bearer '))
            return 'Bearer [REDACTED]';
        if (value.length > 512)
            return `${value.slice(0, 64)}...[truncated:${value.length}]`;
        return value;
    }
    if (Array.isArray(value)) {
        return value.slice(0, 20).map((item) => redactValue(item, depth + 1));
    }
    if (typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            const normalized = k.toLowerCase();
            if (REDACTED_KEYS.has(normalized) || normalized.includes('secret') || normalized.includes('token')) {
                out[k] = '[REDACTED]';
            }
            else if (normalized === 'sdp' && typeof v === 'string') {
                out[k] = `[SDP:${v.length}chars]`;
            }
            else {
                out[k] = redactValue(v, depth + 1);
            }
        }
        return out;
    }
    return value;
}
class StructuredLogger {
    serviceName;
    constructor(serviceName) {
        this.serviceName = serviceName;
    }
    emit(level, message, meta) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            service: this.serviceName,
            message,
            ...(meta ? { meta: redactValue(meta) } : {}),
        };
        const serialized = JSON.stringify(entry);
        if (level === 'error') {
            console.error(serialized);
        }
        else if (level === 'warn') {
            console.warn(serialized);
        }
        else if (process.env.NODE_ENV !== 'test' || process.env.LOG_TESTS === 'true') {
            console.log(serialized);
        }
    }
    debug(message, meta) {
        if (process.env.LOG_LEVEL === 'debug') {
            this.emit('debug', message, meta);
        }
    }
    info(message, meta) {
        this.emit('info', message, meta);
    }
    warn(message, meta) {
        this.emit('warn', message, meta);
    }
    error(message, meta) {
        this.emit('error', message, meta);
    }
}
export const logger = new StructuredLogger('universalcast-signaling');
export function createLogger(serviceName) {
    return new StructuredLogger(serviceName);
}
export { redactValue };
//# sourceMappingURL=logger.js.map