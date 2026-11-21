import { describe, it, expect } from 'vitest';
import {
  clampMaxReceivers,
  HARD_MAX_RECEIVERS,
  isValidDtlsParameters,
  isValidId,
  isValidPin,
  validateCreateSessionBody,
  validatePinBody,
  recordPinAttempt,
} from '../server/utils/validation.js';
import { redactValue } from '../server/utils/logger.js';

describe('Input Validation & Sanitization', () => {
  it('validates IDs and 6-digit PINs strictly', () => {
    expect(isValidId('uc_m1a2b3_xyz')).toBe(true);
    expect(isValidId('bad/id/traversal')).toBe(false);
    expect(isValidId('')).toBe(false);
    expect(isValidId('a'.repeat(129))).toBe(false);

    expect(isValidPin('123456')).toBe(true);
    expect(isValidPin('000000')).toBe(true);
    expect(isValidPin('12345')).toBe(false);
    expect(isValidPin('12345a')).toBe(false);
    expect(isValidPin(123456)).toBe(false);
  });

  it('clamps maxReceivers between 1 and HARD_MAX_RECEIVERS (10)', () => {
    expect(HARD_MAX_RECEIVERS).toBe(10);
    expect(clampMaxReceivers(99)).toBe(10);
    expect(clampMaxReceivers(0)).toBe(1);
    expect(clampMaxReceivers(-4)).toBe(1);
    expect(clampMaxReceivers(5)).toBe(5);
    expect(clampMaxReceivers('bad')).toBe(10);
  });

  it('validates create session payloads', () => {
    const ok = validateCreateSessionBody({
      sessionId: 'uc_test_1',
      pin: '482910',
      title: 'Team Demo',
      mediaType: 'screen',
      maxReceivers: 25,
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.data.maxReceivers).toBe(10);
    }

    const badPin = validateCreateSessionBody({
      sessionId: 'uc_test_1',
      pin: 'abc',
      title: 'Demo',
    });
    expect(badPin.ok).toBe(false);
  });

  it('validates PIN lookup payloads', () => {
    expect(validatePinBody({ sessionId: 'lookup', pin: '123456' }).ok).toBe(true);
    expect(validatePinBody({ sessionId: '../evil', pin: '123456' }).ok).toBe(false);
    expect(validatePinBody({ pin: '12' }).ok).toBe(false);
  });

  it('rate limits only 25 PIN join attempts within 5 minutes', () => {
    let attempts: number[] = [];
    let result = { allowed: true, attempts };
    for (let i = 0; i < 25; i++) {
      result = recordPinAttempt(result.attempts, 1000 + i);
    }
    expect(result.allowed).toBe(true);
    result = recordPinAttempt(result.attempts, 3000);
    expect(result.allowed).toBe(false);

    const expired = recordPinAttempt([1], 5 * 60 * 1000 + 2);
    expect(expired.allowed).toBe(true);
  });

  it('validates DTLS parameters structure', () => {
    expect(
      isValidDtlsParameters({
        role: 'client',
        fingerprints: [{ algorithm: 'sha-256', value: 'AA:BB:CC' }],
      })
    ).toBe(true);
    expect(isValidDtlsParameters({ fingerprints: [] })).toBe(false);
    expect(isValidDtlsParameters(null)).toBe(false);
  });

  it('redacts sensitive tokens, secrets, and SDPs from logs', () => {
    const cleaned = redactValue({
      authorization: 'Bearer secret-jwt-token',
      receiverToken: 'abc.def',
      sessionTokenSecret: 'top-secret',
      pin: '123456',
      sdp: 'v=0\r\no=- 123 2 IN IP4 127.0.0.1...',
      sessionId: 'uc_123',
    }) as Record<string, unknown>;

    expect(cleaned.authorization).toBe('[REDACTED]');
    expect(cleaned.receiverToken).toBe('[REDACTED]');
    expect(cleaned.sessionTokenSecret).toBe('[REDACTED]');
    expect(cleaned.pin).toBe('[REDACTED]');
    expect(String(cleaned.sdp)).toContain('[SDP:');
    expect(cleaned.sessionId).toBe('uc_123');
  });
});
