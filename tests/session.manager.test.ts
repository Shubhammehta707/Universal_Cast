import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { WebSocket } from 'ws';
import { SessionManager, SessionAuthError } from '../server/auth/SessionManager.js';
import { setCustomTokenVerifier } from '../server/auth/firebaseAuth.js';
import { issueReceiverToken } from '../server/auth/tokenService.js';

function fakeWs(open = true): WebSocket {
  return { readyState: open ? 1 : 3 } as unknown as WebSocket;
}

describe('SessionManager Authorization & Capacity Enforcement', () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager();
    setCustomTokenVerifier(async (token: string) => {
      if (token === 'token-alice') {
        return { uid: 'uid_alice', email: 'alice@example.com', name: 'Alice', emailVerified: true };
      }
      if (token === 'token-bob') {
        return { uid: 'uid_bob', email: 'bob@example.com', name: 'Bob', emailVerified: true };
      }
      if (token === 'token-unverified') {
        return { uid: 'uid_unv', email: 'unv@example.com', emailVerified: false };
      }
      throw new Error('Invalid token');
    });
  });

  afterEach(() => {
    setCustomTokenVerifier(null);
  });

  it('rejects unverified or invalid Firebase tokens when creating sessions', async () => {
    await expect(
      manager.createOrVerifyHostSession({
        idToken: 'bad-token',
        sessionId: 'uc_s1',
        pin: '111222',
        title: 'Test',
        mediaType: 'screen',
        maxReceivers: 10,
      })
    ).rejects.toMatchObject({ statusCode: 401 });

    await expect(
      manager.createOrVerifyHostSession({
        idToken: 'token-unverified',
        sessionId: 'uc_s1',
        pin: '111222',
        title: 'Test',
        mediaType: 'screen',
        maxReceivers: 10,
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('prevents another user from hijacking an existing host session', async () => {
    await manager.createOrVerifyHostSession({
      idToken: 'token-alice',
      sessionId: 'uc_s1',
      pin: '111222',
      title: 'Alice Cast',
      mediaType: 'screen',
      maxReceivers: 10,
    });

    await expect(
      manager.createOrVerifyHostSession({
        idToken: 'token-bob',
        sessionId: 'uc_s1',
        pin: '111222',
        title: 'Hijack',
        mediaType: 'screen',
        maxReceivers: 10,
      })
    ).rejects.toMatchObject({ statusCode: 403 });

    await expect(
      manager.createOrVerifyHostSession({
        idToken: 'token-alice',
        sessionId: 'uc_s1',
        pin: '999999',
        title: 'PIN Change',
        mediaType: 'screen',
        maxReceivers: 3,
      })
    ).rejects.toMatchObject({ statusCode: 409 });

    const clamped = await manager.createOrVerifyHostSession({
      idToken: 'token-alice',
      sessionId: 'uc_s1',
      pin: '111222',
      title: 'Alice Cast',
      mediaType: 'screen',
      maxReceivers: 99,
    });
    expect(clamped.maxReceivers).toBe(10);
  });

  it('rejects inactive/unknown PINs and validates HMAC receiver tokens', async () => {
    expect(() => manager.validatePinAndIssueReceiverToken({ pin: '999999' })).toThrowError(SessionAuthError);

    await manager.createOrVerifyHostSession({
      idToken: 'token-alice',
      sessionId: 'uc_live_1',
      pin: '654321',
      title: 'Live Room',
      mediaType: 'screen',
      maxReceivers: 5,
    });

    expect(() => manager.validatePinAndIssueReceiverToken({ pin: '000000' })).toThrowError(SessionAuthError);

    const { receiverId, receiverToken } = manager.validatePinAndIssueReceiverToken({ pin: '654321' });
    expect(receiverId).toMatch(/^recv_/);
    expect(receiverToken.split('.')).toHaveLength(2);

    // Tampered token must be rejected
    expect(() =>
      manager.joinReceiver({
        sessionId: 'uc_live_1',
        receiverToken: `${receiverToken}tamper`,
        ws: fakeWs(),
      })
    ).toThrowError(SessionAuthError);

    // Valid token from wrong session must be rejected
    const wrongSessionToken = issueReceiverToken('uc_other', 'recv_evil');
    expect(() =>
      manager.joinReceiver({
        sessionId: 'uc_live_1',
        receiverToken: wrongSessionToken,
        ws: fakeWs(),
      })
    ).toThrowError(SessionAuthError);
  });

  it('hard-enforces max 10 receiver cap even when host requests > 10, and keeps kicked receivers out', async () => {
    const session = await manager.createOrVerifyHostSession({
      idToken: 'token-alice',
      sessionId: 'uc_cap_test',
      pin: '777888',
      title: 'Cap Test',
      mediaType: 'screen',
      maxReceivers: 99,
    });
    expect(session.maxReceivers).toBe(10);

    const joinedIds: string[] = [];
    for (let i = 0; i < 10; i++) {
      const { receiver } = manager.joinReceiver({
        sessionId: 'uc_cap_test',
        pin: '777888',
        deviceName: `Screen ${i + 1}`,
        deviceType: 'tv',
        ws: fakeWs(),
      });
      joinedIds.push(receiver.receiverId);
    }
    expect(session.receivers.size).toBe(10);

    // 11th receiver MUST fail
    expect(() =>
      manager.joinReceiver({
        sessionId: 'uc_cap_test',
        pin: '777888',
        deviceName: 'Screen 11',
        deviceType: 'tv',
        ws: fakeWs(),
      })
    ).toThrowError(/limit of 10 receivers/i);

    // Kicking receiver #1 removes only receiver #1 and blocks its reconnect
    manager.removeReceiver('uc_cap_test', joinedIds[0], true);
    expect(session.receivers.size).toBe(9);

    expect(() =>
      manager.joinReceiver({
        sessionId: 'uc_cap_test',
        pin: '777888',
        receiverId: joinedIds[0],
        ws: fakeWs(),
      })
    ).toThrowError(/disconnected by the host/i);

    // New receiver #11 can now occupy the freed slot (up to 10)
    const replacement = manager.joinReceiver({
      sessionId: 'uc_cap_test',
      pin: '777888',
      deviceName: 'Screen Replacement',
      ws: fakeWs(),
    });
    expect(replacement.session.receivers.size).toBe(10);
  });

  it('prunes abandoned unattached sessions past TTL without removing active sessions', async () => {
    const stale = await manager.createOrVerifyHostSession({
      idToken: 'token-alice',
      sessionId: 'uc_stale',
      pin: '222333',
      title: 'Abandoned',
      mediaType: 'screen',
      maxReceivers: 4,
    });
    stale.createdAt = Date.now() - 20 * 60 * 1000;

    const live = await manager.createOrVerifyHostSession({
      idToken: 'token-bob',
      sessionId: 'uc_active',
      pin: '444555',
      title: 'Live',
      mediaType: 'screen',
      maxReceivers: 4,
    });
    live.createdAt = Date.now() - 20 * 60 * 1000;
    live.senderWs = fakeWs();

    const pruned = manager.pruneStaleUnattachedSessions(15 * 60 * 1000);
    expect(pruned).toBe(1);
    expect(manager.getSession('uc_stale')).toBeUndefined();
    expect(manager.getSession('uc_active')).toBeDefined();
  });
});
