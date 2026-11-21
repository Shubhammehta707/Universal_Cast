export const HARD_MAX_RECEIVERS = 10;

const ID_REGEX = /^[a-zA-Z0-9_\-]{1,128}$/;
const PIN_REGEX = /^[0-9]{6}$/;
const ALLOWED_MEDIA_TYPES = new Set(['screen', 'video', 'photo', 'music']);
const ALLOWED_DEVICE_TYPES = new Set(['tv', 'browser', 'monitor', 'tablet', 'mobile']);

export function isValidId(value: unknown): value is string {
  return typeof value === 'string' && ID_REGEX.test(value);
}

export function isValidPin(value: unknown): value is string {
  return typeof value === 'string' && PIN_REGEX.test(value);
}

export function sanitizeString(value: unknown, maxLength: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

export function clampMaxReceivers(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return HARD_MAX_RECEIVERS;
  return Math.min(HARD_MAX_RECEIVERS, Math.max(1, Math.floor(num)));
}

export function normalizeMediaType(value: unknown): 'screen' | 'video' | 'photo' | 'music' {
  if (typeof value === 'string' && ALLOWED_MEDIA_TYPES.has(value)) {
    return value as 'screen' | 'video' | 'photo' | 'music';
  }
  return 'screen';
}

export function normalizeDeviceType(value: unknown): 'tv' | 'browser' | 'monitor' | 'tablet' | 'mobile' {
  if (typeof value === 'string' && ALLOWED_DEVICE_TYPES.has(value)) {
    return value as 'tv' | 'browser' | 'monitor' | 'tablet' | 'mobile';
  }
  return 'browser';
}

export function recordPinAttempt(
  attempts: number[],
  now: number,
  windowMs = 5 * 60 * 1000,
  limit = 25
): { allowed: boolean; attempts: number[] } {
  const recent = attempts.filter((attempt) => now - attempt < windowMs);
  recent.push(now);
  return { allowed: recent.length <= limit, attempts: recent };
}

export interface CreateSessionInput {
  sessionId: string;
  pin: string;
  title: string;
  mediaType: 'screen' | 'video' | 'photo' | 'music';
  maxReceivers: number;
}

export function validateCreateSessionBody(body: unknown): { ok: true; data: CreateSessionInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object' };
  }
  const obj = body as Record<string, unknown>;
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

export function validatePinBody(body: unknown): { ok: true; sessionId?: string; pin: string } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object' };
  }
  const obj = body as Record<string, unknown>;
  if (!isValidPin(obj.pin)) {
    return { ok: false, error: 'PIN must be a 6-digit numeric string' };
  }
  const rawSessionId = obj.sessionId;
  let sessionId: string | undefined;
  if (rawSessionId !== undefined && rawSessionId !== null && rawSessionId !== '' && rawSessionId !== 'lookup') {
    if (!isValidId(rawSessionId)) {
      return { ok: false, error: 'Invalid sessionId format' };
    }
    sessionId = rawSessionId;
  }
  return { ok: true, sessionId, pin: obj.pin };
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isValidDtlsParameters(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  if (!Array.isArray(value.fingerprints) || value.fingerprints.length === 0) return false;
  return value.fingerprints.every(
    (fp) => isPlainObject(fp) && typeof fp.algorithm === 'string' && typeof fp.value === 'string'
  );
}

export function isValidRtpCapabilities(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  return Array.isArray(value.codecs) && value.codecs.length > 0;
}

export function isValidRtpParameters(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  return Array.isArray(value.codecs) && value.codecs.length > 0 && Array.isArray(value.encodings);
}
