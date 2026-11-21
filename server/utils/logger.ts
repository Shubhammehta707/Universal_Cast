type LogLevel = 'debug' | 'info' | 'warn' | 'error';

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

function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[MaxDepth]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (value.startsWith('Bearer ')) return 'Bearer [REDACTED]';
    if (value.length > 512) return `${value.slice(0, 64)}...[truncated:${value.length}]`;
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => redactValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const normalized = k.toLowerCase();
      if (REDACTED_KEYS.has(normalized) || normalized.includes('secret') || normalized.includes('token')) {
        out[k] = '[REDACTED]';
      } else if (normalized === 'sdp' && typeof v === 'string') {
        out[k] = `[SDP:${v.length}chars]`;
      } else {
        out[k] = redactValue(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

class StructuredLogger {
  private readonly serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  private emit(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
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
    } else if (level === 'warn') {
      console.warn(serialized);
    } else if (process.env.NODE_ENV !== 'test' || process.env.LOG_TESTS === 'true') {
      console.log(serialized);
    }
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (process.env.LOG_LEVEL === 'debug') {
      this.emit('debug', message, meta);
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.emit('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.emit('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.emit('error', message, meta);
  }
}

export const logger = new StructuredLogger('universalcast-signaling');
export function createLogger(serviceName: string): StructuredLogger {
  return new StructuredLogger(serviceName);
}
export { redactValue };
