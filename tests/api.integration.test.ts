import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import WebSocket from 'ws';
import { createAppServer, AppServerContext } from '../server/createAppServer.js';
import { MediasoupSfuService } from '../server/sfu/MediasoupSfuService.js';
import { setCustomTokenVerifier } from '../server/auth/firebaseAuth.js';

function connectWs(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

function nextMessage(ws: WebSocket, filterType?: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for WS message ${filterType || ''}`)), 5000);
    const handler = (raw: WebSocket.RawData) => {
      const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
      if (!filterType || msg.type === filterType) {
        clearTimeout(timer);
        ws.off('message', handler);
        resolve(msg);
      }
    };
    ws.on('message', handler);
  });
}

describe('Signaling + REST API + SFU Authorization Integration', () => {
  let ctx: AppServerContext;
  let baseUrl: string;
  let wsUrl: string;

  beforeAll(async () => {
    setCustomTokenVerifier(async (token) => {
      if (token === 'host-token') {
        return { uid: 'host_1', email: 'host@example.com', name: 'Host User', emailVerified: true };
      }
      if (token === 'other-token') {
        return { uid: 'other_2', email: 'other@example.com', name: 'Other User', emailVerified: true };
      }
      throw new Error('Unauthorized token');
    });

    const sfu = new MediasoupSfuService({
      rtcMinPort: 41200,
      rtcMaxPort: 41250,
      listenIp: '127.0.0.1',
      announcedIp: '127.0.0.1',
    });
    ctx = createAppServer({ sfu, disableRateLimit: true });
    await ctx.sfu.init();

    await new Promise<void>((resolve) => {
      ctx.httpServer.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = ctx.httpServer.address();
    if (!addr || typeof addr === 'string') throw new Error('Expected address object');
    baseUrl = `http://127.0.0.1:${addr.port}`;
    wsUrl = `ws://127.0.0.1:${addr.port}/ws`;
  }, 15000);

  afterAll(async () => {
    setCustomTokenVerifier(null);
    await ctx.shutdown();
  });

  beforeEach(() => {
    for (const sid of ctx.sessionManager.listSessionIds()) {
      ctx.sessionManager.endSession(sid);
    }
  });

  it('serves /api/health and /api/health/sfu with live worker status', async () => {
    const h1 = await fetch(`${baseUrl}/api/health`);
    expect(h1.status).toBe(200);
    const body1 = await h1.json();
    expect(body1.status).toBe('ok');

    const h2 = await fetch(`${baseUrl}/api/health/sfu`);
    expect(h2.status).toBe(200);
    const body2 = await h2.json();
    expect(body2.status).toBe('ok');
    expect(typeof body2.workerPid).toBe('number');
    const ready = await fetch(`${baseUrl}/api/ready`);
    expect(ready.status).toBe(200);
    expect((await ready.json()).status).toBe('ready');
  });

  it('enforces Firebase auth on session creation, validates PIN securely, and blocks unauthorized WS controls', async () => {
    // Unauthenticated session creation fails
    const unauthRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'uc_int_1', pin: '123456', title: 'Test', maxReceivers: 2 }),
    });
    expect(unauthRes.status).toBe(401);

    // Authenticated host creates session with maxReceivers=2
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer host-token',
      },
      body: JSON.stringify({
        sessionId: 'uc_int_1',
        pin: '123456',
        title: 'Integration Cast',
        mediaType: 'screen',
        maxReceivers: 2,
      }),
    });
    expect(createRes.status).toBe(201);

    // Nonexistent PIN must NOT return valid: true
    const missingPinRes = await fetch(`${baseUrl}/api/sessions/validate-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'lookup', pin: '999999' }),
    });
    expect(missingPinRes.status).toBe(404);

    // Valid PIN issues receiverToken
    const validPinRes = await fetch(`${baseUrl}/api/sessions/validate-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'lookup', pin: '123456' }),
    });
    expect(validPinRes.status).toBe(200);
    const pinData = await validPinRes.json();
    expect(pinData.valid).toBe(true);
    expect(pinData.receiverToken).toBeTruthy();

    // Connect host WS
    const hostWs = await connectWs(wsUrl);
    const ackPromise = nextMessage(hostWs, 'sender-ready-ack');
    hostWs.send(
      JSON.stringify({
        type: 'sender-ready',
        sessionId: 'uc_int_1',
        idToken: 'host-token',
        pin: '123456',
      })
    );
    const ack = await ackPromise;
    expect(ack.type).toBe('sender-ready-ack');

    // SFU sender transport creation is available only after sender authorization completes.
    const transportPromise = nextMessage(hostWs, 'sfu:response');
    hostWs.send(JSON.stringify({
      type: 'sfu:create-transport',
      sessionId: 'uc_int_1',
      role: 'sender',
      requestId: 'screen-share-transport-test',
    }));
    const transportResponse = await transportPromise;
    expect(transportResponse.requestId).toBe('screen-share-transport-test');
    expect((transportResponse.data as { id?: string }).id).toBeTruthy();

    // Receiver #1 joins with issued receiverToken
    const recv1Ws = await connectWs(wsUrl);
    const joined1Promise = nextMessage(recv1Ws, 'joined-success');
    recv1Ws.send(
      JSON.stringify({
        type: 'join-session',
        sessionId: 'uc_int_1',
        pin: '123456',
        receiverToken: pinData.receiverToken,
        deviceName: 'TV 1',
      })
    );
    const joined1 = await joined1Promise;
    expect(joined1.type).toBe('joined-success');

    // Receiver #1 MUST NOT be allowed to end the host's session!
    const recvErrPromise = nextMessage(recv1Ws, 'signal-error');
    recv1Ws.send(JSON.stringify({ type: 'session-ended', sessionId: 'uc_int_1' }));
    const recvErr = await recvErrPromise;
    expect(String(recvErr.error)).toMatch(/Unauthorized/i);

    // Receiver MUST NOT be able to send invalid media state values
    const invalidMediaPromise = nextMessage(recv1Ws, 'signal-error');
    recv1Ws.send(JSON.stringify({
      type: 'media-state-changed',
      sessionId: 'uc_int_1',
      mediaState: 'invalid',
    }));
    const invalidMedia = await invalidMediaPromise;
    expect(String(invalidMedia.error)).toMatch(/Unauthorized|Invalid mediaState/i);

    // Other authenticated user MUST NOT be able to kick receiver via REST
    const evilKick = await fetch(`${baseUrl}/api/session/uc_int_1/disconnect-receiver`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer other-token',
      },
      body: JSON.stringify({ receiverId: pinData.receiverId }),
    });
    expect(evilKick.status).toBe(403);

    // Host CAN kick receiver via REST
    const hostKick = await fetch(`${baseUrl}/api/session/uc_int_1/disconnect-receiver`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer host-token',
      },
      body: JSON.stringify({ receiverId: pinData.receiverId }),
    });
    expect(hostKick.status).toBe(200);

    hostWs.close();
    recv1Ws.close();
  });
});
