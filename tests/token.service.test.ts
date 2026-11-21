import { afterEach, describe, expect, it } from 'vitest';
import { issueReceiverToken } from '../server/auth/tokenService.js';

describe('Receiver token secret configuration', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSecret = process.env.SESSION_TOKEN_SECRET;

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalSecret === undefined) delete process.env.SESSION_TOKEN_SECRET;
    else process.env.SESSION_TOKEN_SECRET = originalSecret;
  });

  it('refuses missing or placeholder secrets in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SESSION_TOKEN_SECRET;
    expect(() => issueReceiverToken('uc_prod', 'recv_1')).toThrow(/required in production/i);

    process.env.SESSION_TOKEN_SECRET = 'CHANGE_ME_TO_A_32_BYTE_RANDOM_SECRET';
    expect(() => issueReceiverToken('uc_prod', 'recv_1')).toThrow(/placeholder/i);
  });

  it('issues and verifies tokens when configured outside production', async () => {
    process.env.NODE_ENV = 'test';
    process.env.SESSION_TOKEN_SECRET = 'a-valid-test-only-secret-32chars';
    const { verifyReceiverToken } = await import('../server/auth/tokenService.js');
    const token = issueReceiverToken('uc_test', 'recv_test');
    expect(verifyReceiverToken(token)?.sessionId).toBe('uc_test');
  });
});
