import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { createServer, IncomingMessage, Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { SessionManager, SessionAuthError } from './auth/SessionManager.js';
import { extractBearerToken } from './auth/firebaseAuth.js';
import { MediasoupSfuService } from './sfu/MediasoupSfuService.js';
import { RemoteSfuClient } from './sfu/RemoteSfuClient.js';
import { ISfuService, SfuServiceError } from './sfu/types.js';
import { createLogger } from './utils/logger.js';
import {
  isValidDtlsParameters,
  isValidId,
  isValidRtpCapabilities,
  isValidRtpParameters,
  recordPinAttempt,
  validateCreateSessionBody,
  validatePinBody,
} from './utils/validation.js';

const log = createLogger('signaling-server');

interface HeartbeatSocket extends WebSocket {
  isAlive?: boolean;
}

export interface AppServerContext {
  app: express.Express;
  httpServer: HttpServer;
  wss: WebSocketServer;
  sessionManager: SessionManager;
  sfu: ISfuService;
  shutdown: () => Promise<void>;
}

export function createSfuAdapter(): ISfuService {
  const remoteUrl = process.env.SFU_SERVICE_URL?.trim();
  if (remoteUrl) {
    const secret = process.env.SFU_INTERNAL_SECRET || '';
    if (!secret) {
      throw new Error('SFU_INTERNAL_SECRET is required when SFU_SERVICE_URL is configured');
    }
    if (/^(CHANGE_ME|MY_|<)/i.test(secret)) {
      throw new Error('SFU_INTERNAL_SECRET still contains a placeholder value');
    }
    log.info('Configuring remote mediasoup SFU adapter', { remoteUrl });
    return new RemoteSfuClient(remoteUrl, secret);
  }
  return new MediasoupSfuService();
}

export function createAppServer(options?: {
  sfu?: ISfuService;
  sessionManager?: SessionManager;
  disableRateLimit?: boolean;
}): AppServerContext {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '256kb' }));

  const sessionManager = options?.sessionManager ?? new SessionManager();
  const sfu = options?.sfu ?? createSfuAdapter();

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: options?.disableRateLimit ? 10000 : 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please slow down.' },
  });

  const pinBruteForceLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: options?.disableRateLimit ? 10000 : 25,
    standardHeaders: true,
    legacyHeaders: false,
    message: { valid: false, error: 'Too many PIN validation attempts. Please wait a few minutes.' },
  });

  app.use('/api', apiLimiter);

  // Health check endpoints
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      activeSessions: sessionManager.getActiveSessionCount(),
      totalReceivers: sessionManager.getTotalReceiverCount(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/health/sfu', async (_req: Request, res: Response) => {
    try {
      await sfu.init();
      const metrics = await sfu.getHealthMetrics();
      res.status(metrics.status === 'ok' ? 200 : 503).json(metrics);
    } catch (err) {
      res.status(503).json({
        status: 'error',
        error: err instanceof Error ? err.message : 'SFU unavailable',
      });
    }
  });

  app.get('/api/ready', async (_req: Request, res: Response) => {
    try {
      await sfu.init();
      const metrics = await sfu.getHealthMetrics();
      if (metrics.status !== 'ok') {
        res.status(503).json({ status: 'not-ready', reason: 'SFU unavailable' });
        return;
      }
      res.json({ status: 'ready', timestamp: new Date().toISOString() });
    } catch (err) {
      res.status(503).json({
        status: 'not-ready',
        reason: err instanceof Error ? err.message : 'SFU unavailable',
      });
    }
  });

  // Create/Register authenticated host session
  app.post('/api/sessions', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idToken = extractBearerToken(req.header('authorization'));
      if (!idToken) {
        res.status(401).json({ error: 'Authentication required (Bearer ID token)' });
        return;
      }

      const parsed = validateCreateSessionBody(req.body);
      if (!parsed.ok) {
        res.status(400).json({ error: parsed.error });
        return;
      }

      const session = await sessionManager.createOrVerifyHostSession({
        idToken,
        sessionId: parsed.data.sessionId,
        pin: parsed.data.pin,
        title: parsed.data.title,
        mediaType: parsed.data.mediaType,
        maxReceivers: parsed.data.maxReceivers,
      });

      res.status(201).json({
        sessionId: session.sessionId,
        senderId: session.senderId,
        maxReceivers: session.maxReceivers,
        status: 'active',
      });
    } catch (err) {
      next(err);
    }
  });

  // REST PIN & Capacity Pre-validation + Receiver HMAC Token issuance
  app.post('/api/sessions/validate-pin', pinBruteForceLimiter, (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = validatePinBody(req.body);
      if (!parsed.ok) {
        res.status(400).json({ valid: false, error: parsed.error });
        return;
      }

      const { session, receiverId, receiverToken } = sessionManager.validatePinAndIssueReceiverToken({
        sessionId: parsed.sessionId,
        pin: parsed.pin,
      });

      res.json({
        valid: true,
        live: Boolean(session.senderWs && session.senderWs.readyState === WebSocket.OPEN),
        sessionId: session.sessionId,
        mediaType: session.mediaType,
        senderName: session.senderName,
        currentReceivers: session.receivers.size,
        maxReceivers: session.maxReceivers,
        receiverId,
        receiverToken,
      });
    } catch (err) {
      next(err);
    }
  });

  // Sender disconnects a specific receiver via REST (requires Firebase ID token ownership)
  app.post('/api/session/:id/disconnect-receiver', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id: sessionId } = req.params;
      const { receiverId } = req.body || {};

      const idToken = extractBearerToken(req.header('authorization'));
      if (!idToken) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      if (!isValidId(sessionId) || !isValidId(receiverId)) {
        res.status(400).json({ error: 'Invalid sessionId or receiverId' });
        return;
      }

      const room = await sessionManager.assertSenderTokenForSession(sessionId, idToken);
      const removed = sessionManager.removeReceiver(sessionId, receiverId, true);
      if (!removed?.receiver) {
        res.status(404).json({ error: 'Receiver not connected' });
        return;
      }

      await sfu.disconnectReceiver(sessionId, receiverId).catch(() => {});

      if (removed.receiver.ws && removed.receiver.ws.readyState === WebSocket.OPEN) {
        removed.receiver.ws.send(
          JSON.stringify({
            type: 'disconnect-receiver',
            sessionId,
            receiverId,
            reason: 'Sender disconnected this receiver',
          })
        );
        removed.receiver.ws.close();
      }

      if (room.senderWs && room.senderWs.readyState === WebSocket.OPEN) {
        room.senderWs.send(
          JSON.stringify({
            type: 'receiver-left',
            sessionId,
            receiverId,
            receiverCount: room.receivers.size,
          })
        );
      }

      res.json({ success: true, remaining: room.receivers.size });
    } catch (err) {
      next(err);
    }
  });

  // Sender ends an entire session via REST
  app.delete('/api/sessions/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id: sessionId } = req.params;
      const idToken = extractBearerToken(req.header('authorization'));
      if (!idToken) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      if (!isValidId(sessionId)) {
        res.status(400).json({ error: 'Invalid sessionId' });
        return;
      }

      await sessionManager.assertSenderTokenForSession(sessionId, idToken);
      const endedRoom = sessionManager.endSession(sessionId);
      await sfu.closeSession(sessionId).catch(() => {});

      if (endedRoom) {
        endedRoom.receivers.forEach((client) => {
          if (client.ws && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(
              JSON.stringify({
                type: 'session-ended',
                sessionId,
                message: 'Casting session was ended by the host',
              })
            );
            client.ws.close();
          }
        });
      }

      res.json({ success: true, sessionId });
    } catch (err) {
      next(err);
    }
  });

  // Structured REST error handler
  app.use('/api', (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof SessionAuthError || err instanceof SfuServiceError) {
      res.status(err.statusCode).json({ valid: false, error: err.message });
      return;
    }
    log.error('Unhandled API error', {
      error: err instanceof Error ? err.message : 'unknown error',
    });
    res.status(500).json({ error: 'Internal server error' });
  });

  const httpServer = createServer(app);
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws',
    maxPayload: 256 * 1024, // 256KB max signaling frame
  });

  function sendWs(ws: WebSocket, payload: Record<string, unknown>): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  function sendSfuReply(ws: WebSocket, requestId: unknown, ok: boolean, data?: unknown, error?: string): void {
    if (!requestId) return;
    sendWs(ws, {
      type: ok ? 'sfu:response' : 'sfu:error',
      requestId,
      ...(ok ? { data } : { error: error || 'SFU request failed' }),
    });
  }

  // Heartbeat reaper for dead/half-open receiver and sender connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((client) => {
      const sock = client as HeartbeatSocket;
      if (sock.isAlive === false) {
        sock.terminate();
        return;
      }
      sock.isAlive = false;
      sock.ping();
    });
  }, 20_000);

  const pruneInterval = setInterval(() => {
    sessionManager.pruneStaleUnattachedSessions();
    const now = Date.now();
    for (const [address, attempts] of wsPinAttempts.entries()) {
      const recent = attempts.filter((attempt) => now - attempt < 5 * 60 * 1000);
      if (recent.length === 0) {
        wsPinAttempts.delete(address);
      } else {
        wsPinAttempts.set(address, recent);
      }
    }
  }, 60_000);
  const wsPinAttempts = new Map<string, number[]>();

  wss.on('connection', (rawWs: WebSocket, req: IncomingMessage) => {
    const ws = rawWs as HeartbeatSocket;
    const wsAddress = req.socket.remoteAddress || 'unknown';
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    let boundSessionId: string | null = null;
    let boundReceiverId: string | null = null;
    let isSender = false;

    ws.on('message', async (raw: Buffer | string) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf-8')) as Record<string, unknown>;
      } catch {
        sendWs(ws, { type: 'signal-error', error: 'Malformed JSON signaling frame' });
        return;
      }

      const type = typeof msg.type === 'string' ? msg.type : '';
      const sessionId = typeof msg.sessionId === 'string' ? msg.sessionId : '';
      const requestId = msg.requestId;

      if (type === 'ping') {
        sendWs(ws, { type: 'pong', timestamp: Date.now() });
        return;
      }

      if (!sessionId) {
        sendSfuReply(ws, requestId, false, undefined, 'sessionId is required');
        return;
      }

      try {
        switch (type) {
          case 'sender-ready': {
            const idToken = typeof msg.idToken === 'string' ? msg.idToken : '';
            if (!idToken) {
              sendWs(ws, { type: 'sender-error', sessionId, error: 'Firebase ID token is required to host' });
              return;
            }
            const room = await sessionManager.attachSenderSocket({
              idToken,
              sessionId,
              pin: typeof msg.pin === 'string' ? msg.pin : undefined,
              senderName: typeof msg.senderName === 'string' ? msg.senderName : undefined,
              mediaType: msg.mediaType,
              maxReceivers: msg.maxReceivers,
              ws,
            });

            boundSessionId = room.sessionId;
            isSender = true;

            await sfu.init();
            await sfu.getRouterRtpCapabilities(room.sessionId, room.maxReceivers);

            const existingReceivers = Array.from(room.receivers.values()).map((r) => ({
              id: r.receiverId,
              sessionId: room.sessionId,
              senderId: room.senderId,
              deviceName: r.deviceName,
              deviceType: r.deviceType,
              joinedAt: r.joinedAt,
              lastPing: new Date().toISOString(),
              status: 'connected' as const,
              latencyMs: r.latencyMs ?? 15,
              fps: r.fps ?? 60,
            }));

            sendWs(ws, {
              type: 'sender-ready-ack',
              sessionId: room.sessionId,
              activeReceivers: room.receivers.size,
              maxReceivers: room.maxReceivers,
              receivers: existingReceivers,
            });
            break;
          }

          case 'join-session': {
            if (!options?.disableRateLimit) {
              const now = Date.now();
              const result = recordPinAttempt(wsPinAttempts.get(wsAddress) || [], now);
              wsPinAttempts.set(wsAddress, result.attempts);
              if (!result.allowed) {
                throw new SessionAuthError(429, 'Too many join attempts. Please wait before trying again.');
              }
            }
            const { session, receiver, issuedToken } = sessionManager.joinReceiver({
              sessionId,
              pin: typeof msg.pin === 'string' ? msg.pin : undefined,
              receiverToken: typeof msg.receiverToken === 'string' ? msg.receiverToken : undefined,
              receiverId: typeof msg.receiverId === 'string' ? msg.receiverId : undefined,
              deviceName: typeof msg.deviceName === 'string' ? msg.deviceName : undefined,
              deviceType: msg.deviceType,
              ws,
            });

            isSender = false;
            boundSessionId = session.sessionId;
            boundReceiverId = receiver.receiverId;

            await sfu.init();
            const activeProducers = await sfu.getActiveProducers(session.sessionId);

            sendWs(ws, {
              type: 'joined-success',
              sessionId: session.sessionId,
              receiverId: receiver.receiverId,
              receiverToken: issuedToken,
              mediaType: session.mediaType,
              senderName: session.senderName,
              receiverCount: session.receivers.size,
              maxReceivers: session.maxReceivers,
              activeProducers,
            });

            if (session.senderWs) {
              sendWs(session.senderWs, {
                type: 'receiver-joined',
                sessionId: session.sessionId,
                receiverId: receiver.receiverId,
                senderId: session.senderId,
                deviceName: receiver.deviceName,
                deviceType: receiver.deviceType,
                joinedAt: receiver.joinedAt,
                receiverCount: session.receivers.size,
              });
            }
            break;
          }

          case 'sfu:get-router-rtp-capabilities': {
            const room = sessionManager.getSession(sessionId);
            if (!room) throw new SessionAuthError(404, 'Session not found');
            const isHost = isSender && room.senderWs === ws;
            const isJoinedRecv = !isSender && boundReceiverId && room.receivers.get(boundReceiverId)?.ws === ws;
            if (!isHost && !isJoinedRecv) {
              throw new SessionAuthError(403, 'Unauthorized signaling client for router capabilities');
            }
            const rtpCapabilities = await sfu.getRouterRtpCapabilities(sessionId, room.maxReceivers);
            const activeProducers = await sfu.getActiveProducers(sessionId);
            sendSfuReply(ws, requestId, true, { rtpCapabilities, activeProducers });
            break;
          }

          case 'sfu:create-transport': {
            const role = msg.role === 'sender' ? 'sender' : 'receiver';
            if (role === 'sender') {
              const room = sessionManager.assertSenderAuthorizedForRoom(sessionId, ws);
              const transport = await sfu.createSenderTransport(sessionId, room.senderId, room.maxReceivers);
              sendSfuReply(ws, requestId, true, transport);
            } else {
              const recId = typeof msg.receiverId === 'string' ? msg.receiverId : boundReceiverId || '';
              const { session } = sessionManager.assertReceiverInRoom(sessionId, recId, ws);
              const transport = await sfu.createReceiverTransport(sessionId, recId, session.maxReceivers);
              sendSfuReply(ws, requestId, true, transport);
            }
            break;
          }

          case 'sfu:connect-transport': {
            const role = msg.role === 'sender' ? 'sender' : 'receiver';
            const transportId = typeof msg.transportId === 'string' ? msg.transportId : '';
            const dtlsParameters = msg.dtlsParameters;
            if (!transportId || !isValidDtlsParameters(dtlsParameters)) {
              throw new SessionAuthError(400, 'Invalid transportId or dtlsParameters');
            }
            if (role === 'sender') {
              const room = sessionManager.assertSenderAuthorizedForRoom(sessionId, ws);
              await sfu.connectSenderTransport(sessionId, room.senderId, transportId, dtlsParameters as never);
            } else {
              const recId = typeof msg.receiverId === 'string' ? msg.receiverId : boundReceiverId || '';
              sessionManager.assertReceiverInRoom(sessionId, recId, ws);
              await sfu.connectReceiverTransport(sessionId, recId, transportId, dtlsParameters as never);
            }
            sendSfuReply(ws, requestId, true, { connected: true });
            break;
          }

          case 'sfu:produce': {
            const room = sessionManager.assertSenderAuthorizedForRoom(sessionId, ws);
            const transportId = typeof msg.transportId === 'string' ? msg.transportId : '';
            const kind = msg.kind === 'audio' ? 'audio' : msg.kind === 'video' ? 'video' : null;
            if (!transportId || !kind || !isValidRtpParameters(msg.rtpParameters)) {
              throw new SessionAuthError(400, 'Invalid produce parameters');
            }

            const producer = await sfu.produce(
              sessionId,
              room.senderId,
              transportId,
              kind,
              msg.rtpParameters as never,
              typeof msg.appData === 'object' && msg.appData !== null ? (msg.appData as Record<string, unknown>) : undefined
            );

            sendSfuReply(ws, requestId, true, { id: producer.producerId, kind: producer.kind });

            // Fan-out notification to all connected receivers in this room so they consume from SFU
            room.receivers.forEach((client) => {
              if (client.ws) {
                sendWs(client.ws, {
                  type: 'sfu:new-producer',
                  sessionId,
                  producerId: producer.producerId,
                  kind: producer.kind,
                });
              }
            });
            break;
          }

          case 'sfu:consume': {
            const recId = typeof msg.receiverId === 'string' ? msg.receiverId : boundReceiverId || '';
            sessionManager.assertReceiverInRoom(sessionId, recId, ws);
            const producerId = typeof msg.producerId === 'string' ? msg.producerId : '';
            if (!producerId || !isValidRtpCapabilities(msg.rtpCapabilities)) {
              throw new SessionAuthError(400, 'Invalid consume parameters');
            }
            const consumerParams = await sfu.consume(sessionId, recId, producerId, msg.rtpCapabilities as never);
            sendSfuReply(ws, requestId, true, consumerParams);
            break;
          }

          case 'sfu:resume-consumer': {
            const recId = typeof msg.receiverId === 'string' ? msg.receiverId : boundReceiverId || '';
            sessionManager.assertReceiverInRoom(sessionId, recId, ws);
            const consumerId = typeof msg.consumerId === 'string' ? msg.consumerId : '';
            if (!consumerId) throw new SessionAuthError(400, 'consumerId is required');
            await sfu.resumeConsumer(sessionId, recId, consumerId);
            sendSfuReply(ws, requestId, true, { resumed: true });
            break;
          }

          case 'sfu:pause-consumer': {
            const recId = typeof msg.receiverId === 'string' ? msg.receiverId : boundReceiverId || '';
            sessionManager.assertReceiverInRoom(sessionId, recId, ws);
            const consumerId = typeof msg.consumerId === 'string' ? msg.consumerId : '';
            if (!consumerId) throw new SessionAuthError(400, 'consumerId is required');
            await sfu.pauseConsumer(sessionId, recId, consumerId);
            sendSfuReply(ws, requestId, true, { paused: true });
            break;
          }

          case 'stats-update': {
            const recId = typeof msg.receiverId === 'string' ? msg.receiverId : boundReceiverId || '';
            const { session, receiver } = sessionManager.assertReceiverInRoom(sessionId, recId, ws);
            const stats = msg.stats as { latencyMs?: unknown; fps?: unknown } | undefined;
            if (stats && typeof stats === 'object') {
              if (typeof stats.latencyMs === 'number' && Number.isFinite(stats.latencyMs)) {
                receiver.latencyMs = Math.max(0, Math.min(60000, Math.round(stats.latencyMs)));
              }
              if (typeof stats.fps === 'number' && Number.isFinite(stats.fps)) {
                receiver.fps = Math.max(0, Math.min(240, Math.round(stats.fps)));
              }
              if (session.senderWs) {
                sendWs(session.senderWs, {
                  type: 'stats-update',
                  sessionId,
                  receiverId: recId,
                  stats: {
                    latencyMs: receiver.latencyMs ?? 15,
                    fps: receiver.fps ?? 60,
                  },
                });
              }
            }
            break;
          }

          case 'disconnect-receiver': {
            const room = sessionManager.assertSenderAuthorizedForRoom(sessionId, ws);
            const targetRecvId = typeof msg.receiverId === 'string' ? msg.receiverId : '';
            if (!isValidId(targetRecvId)) throw new SessionAuthError(400, 'Invalid receiverId');

            const removed = sessionManager.removeReceiver(sessionId, targetRecvId, true);
            await sfu.disconnectReceiver(sessionId, targetRecvId).catch(() => {});

            if (removed?.receiver?.ws) {
              sendWs(removed.receiver.ws, {
                type: 'disconnect-receiver',
                sessionId,
                receiverId: targetRecvId,
                reason: 'Disconnected by sender host',
              });
              removed.receiver.ws.close();
            }
            if (room.senderWs) {
              sendWs(room.senderWs, {
                type: 'receiver-left',
                sessionId,
                receiverId: targetRecvId,
                receiverCount: room.receivers.size,
              });
            }
            break;
          }

          case 'receiver-left': {
            const recId = boundReceiverId;
            if (!recId) return;
            const { session } = sessionManager.assertReceiverInRoom(sessionId, recId, ws);
            sessionManager.removeReceiver(sessionId, recId, false);
            await sfu.disconnectReceiver(sessionId, recId).catch(() => {});
            boundReceiverId = null;
            if (session.senderWs) {
              sendWs(session.senderWs, {
                type: 'receiver-left',
                sessionId,
                receiverId: recId,
                receiverCount: session.receivers.size,
              });
            }
            break;
          }

          case 'media-state-changed': {
            const room = sessionManager.assertSenderAuthorizedForRoom(sessionId, ws);
            if (typeof msg.mediaState !== 'string' ||
                !['playing', 'paused', 'stopped'].includes(msg.mediaState)) {
              throw new SessionAuthError(400, 'Invalid mediaState');
            }
            if (msg.mediaTime !== undefined &&
                (typeof msg.mediaTime !== 'number' || !Number.isFinite(msg.mediaTime) || msg.mediaTime < 0)) {
              throw new SessionAuthError(400, 'Invalid mediaTime');
            }
            room.receivers.forEach((client) => {
              if (client.ws) {
                sendWs(client.ws, {
                  type: 'media-state-changed',
                  sessionId,
                  mediaState: msg.mediaState,
                  mediaTime: msg.mediaTime,
                });
              }
            });
            break;
          }

          case 'stream-stopped': {
            const room = sessionManager.assertSenderAuthorizedForRoom(sessionId, ws);
            await sfu.closeSenderProducers(sessionId, room.senderId);
            room.receivers.forEach((client) => {
              if (client.ws) {
                sendWs(client.ws, {
                  type: 'stream-stopped',
                  sessionId,
                });
              }
            });
            break;
          }

          case 'session-ended': {
            const room = sessionManager.assertSenderAuthorizedForRoom(sessionId, ws);
            sessionManager.endSession(sessionId);
            await sfu.closeSession(sessionId).catch(() => {});
            room.receivers.forEach((client) => {
              if (client.ws) {
                sendWs(client.ws, {
                  type: 'session-ended',
                  sessionId,
                  message: 'Casting session was ended by the host',
                });
                client.ws.close();
              }
            });
            break;
          }

          default: {
            sendSfuReply(ws, requestId, false, undefined, `Unsupported signaling type: ${type}`);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Signaling error';
        if (requestId) {
          sendSfuReply(ws, requestId, false, undefined, message);
        } else if (type === 'join-session') {
          sendWs(ws, { type: 'join-error', sessionId, error: message });
        } else if (type === 'sender-ready') {
          sendWs(ws, { type: 'sender-error', sessionId, error: message });
        } else {
          sendWs(ws, { type: 'signal-error', sessionId, error: message });
        }
      }
    });

    ws.on('close', () => {
      if (!boundSessionId) return;
      const room = sessionManager.getSession(boundSessionId);
      if (!room) return;

      if (isSender) {
        // Race-safe check: only clean up if THIS ws is still the active senderWs
        if (room.senderWs !== ws) return;

        const closingSessionId = boundSessionId;
        sessionManager.endSession(closingSessionId);
        sfu.closeSession(closingSessionId).catch(() => {});
        room.receivers.forEach((client) => {
          if (client.ws && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(
              JSON.stringify({
                type: 'session-ended',
                sessionId: closingSessionId,
                message: 'Host has disconnected',
              })
            );
            client.ws.close();
          }
        });
      } else if (boundReceiverId) {
        const existingRecv = room.receivers.get(boundReceiverId);
        // Race-safe check: only delete if THIS ws is still the active receiver ws
        if (!existingRecv || existingRecv.ws !== ws) return;

        const leavingRecvId = boundReceiverId;
        sessionManager.removeReceiver(boundSessionId, leavingRecvId, false);
        sfu.disconnectReceiver(boundSessionId, leavingRecvId).catch(() => {});

        if (room.senderWs && room.senderWs.readyState === WebSocket.OPEN) {
          room.senderWs.send(
            JSON.stringify({
              type: 'receiver-left',
              sessionId: boundSessionId,
              receiverId: leavingRecvId,
              receiverCount: room.receivers.size,
            })
          );
        }
      }
    });
  });

  const shutdown = async () => {
    clearInterval(heartbeatInterval);
    clearInterval(pruneInterval);
    wss.clients.forEach((c) => c.terminate());
    await new Promise<void>((resolve) => wss.close(() => resolve()));
    await sfu.shutdown();
    if (httpServer.listening) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  };

  return { app, httpServer, wss, sessionManager, sfu, shutdown };
}
