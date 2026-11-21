import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { MediasoupSfuService } from './MediasoupSfuService.js';
import { SfuServiceError } from './types.js';
import { createLogger } from '../utils/logger.js';
import { isValidDtlsParameters, isValidId, isValidRtpCapabilities, isValidRtpParameters } from '../utils/validation.js';

dotenv.config();

const log = createLogger('sfu-server');

export function createSfuApp(sfu: MediasoupSfuService, internalSecret?: string): express.Express {
  const app = express();
  app.use(express.json({ limit: '512kb' }));

  const requireSfuSecret = (req: Request, res: Response, next: NextFunction): void => {
    if (!internalSecret) {
      next();
      return;
    }
    const provided = req.header('x-sfu-secret') || '';
    const a = Buffer.from(provided);
    const b = Buffer.from(internalSecret);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      res.status(401).json({ error: 'Unauthorized SFU internal call' });
      return;
    }
    next();
  };

  app.get('/health', async (_req: Request, res: Response) => {
    const metrics = await sfu.getHealthMetrics();
    res.status(metrics.status === 'ok' ? 200 : 503).json(metrics);
  });

  app.use('/sfu', requireSfuSecret);

  app.post('/sfu/sessions/:sessionId/router', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      if (!isValidId(sessionId)) throw new SfuServiceError(400, 'Invalid sessionId');
      const rtpCapabilities = await sfu.getRouterRtpCapabilities(sessionId, req.body?.maxReceivers);
      res.json({ rtpCapabilities });
    } catch (err) {
      next(err);
    }
  });

  app.post('/sfu/sessions/:sessionId/sender-transport', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const { senderId, maxReceivers } = req.body || {};
      if (!isValidId(sessionId) || !isValidId(senderId)) throw new SfuServiceError(400, 'Invalid sessionId or senderId');
      const transport = await sfu.createSenderTransport(sessionId, senderId, maxReceivers);
      res.json(transport);
    } catch (err) {
      next(err);
    }
  });

  app.post('/sfu/sessions/:sessionId/sender-transport/connect', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const { senderId, transportId, dtlsParameters } = req.body || {};
      if (!isValidId(sessionId) || !isValidId(senderId) || typeof transportId !== 'string' || !isValidDtlsParameters(dtlsParameters)) {
        throw new SfuServiceError(400, 'Invalid sender transport connect payload');
      }
      await sfu.connectSenderTransport(sessionId, senderId, transportId, dtlsParameters);
      res.json({ connected: true });
    } catch (err) {
      next(err);
    }
  });

  app.post('/sfu/sessions/:sessionId/produce', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const { senderId, transportId, kind, rtpParameters, appData } = req.body || {};
      if (
        !isValidId(sessionId) ||
        !isValidId(senderId) ||
        typeof transportId !== 'string' ||
        (kind !== 'video' && kind !== 'audio') ||
        !isValidRtpParameters(rtpParameters)
      ) {
        throw new SfuServiceError(400, 'Invalid produce payload');
      }
      const producer = await sfu.produce(sessionId, senderId, transportId, kind, rtpParameters, appData);
      res.json(producer);
    } catch (err) {
      next(err);
    }
  });

  app.post('/sfu/sessions/:sessionId/producers/close', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      if (!isValidId(sessionId)) throw new SfuServiceError(400, 'Invalid sessionId');
      const closedIds = await sfu.closeSenderProducers(sessionId, req.body?.senderId);
      res.json({ closedIds });
    } catch (err) {
      next(err);
    }
  });

  app.get('/sfu/sessions/:sessionId/producers', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      if (!isValidId(sessionId)) throw new SfuServiceError(400, 'Invalid sessionId');
      const producers = await sfu.getActiveProducers(sessionId);
      res.json({ producers });
    } catch (err) {
      next(err);
    }
  });

  app.post('/sfu/sessions/:sessionId/receiver-transport', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const { receiverId, maxReceivers } = req.body || {};
      if (!isValidId(sessionId) || !isValidId(receiverId)) throw new SfuServiceError(400, 'Invalid sessionId or receiverId');
      const transport = await sfu.createReceiverTransport(sessionId, receiverId, maxReceivers);
      res.json(transport);
    } catch (err) {
      next(err);
    }
  });

  app.post('/sfu/sessions/:sessionId/receiver-transport/connect', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const { receiverId, transportId, dtlsParameters } = req.body || {};
      if (!isValidId(sessionId) || !isValidId(receiverId) || typeof transportId !== 'string' || !isValidDtlsParameters(dtlsParameters)) {
        throw new SfuServiceError(400, 'Invalid receiver transport connect payload');
      }
      await sfu.connectReceiverTransport(sessionId, receiverId, transportId, dtlsParameters);
      res.json({ connected: true });
    } catch (err) {
      next(err);
    }
  });

  app.post('/sfu/sessions/:sessionId/consume', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const { receiverId, producerId, rtpCapabilities } = req.body || {};
      if (!isValidId(sessionId) || !isValidId(receiverId) || typeof producerId !== 'string' || !isValidRtpCapabilities(rtpCapabilities)) {
        throw new SfuServiceError(400, 'Invalid consume payload');
      }
      const consumer = await sfu.consume(sessionId, receiverId, producerId, rtpCapabilities);
      res.json(consumer);
    } catch (err) {
      next(err);
    }
  });

  app.post('/sfu/sessions/:sessionId/consumers/:consumerId/resume', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId, consumerId } = req.params;
      const { receiverId } = req.body || {};
      if (!isValidId(sessionId) || !isValidId(receiverId) || !consumerId) {
        throw new SfuServiceError(400, 'Invalid consumer resume payload');
      }
      await sfu.resumeConsumer(sessionId, receiverId, consumerId);
      res.json({ resumed: true });
    } catch (err) {
      next(err);
    }
  });

  app.post('/sfu/sessions/:sessionId/consumers/:consumerId/pause', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId, consumerId } = req.params;
      const { receiverId } = req.body || {};
      if (!isValidId(sessionId) || !isValidId(receiverId) || !consumerId) {
        throw new SfuServiceError(400, 'Invalid consumer pause payload');
      }
      await sfu.pauseConsumer(sessionId, receiverId, consumerId);
      res.json({ paused: true });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/sfu/sessions/:sessionId/receivers/:receiverId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId, receiverId } = req.params;
      if (!isValidId(sessionId) || !isValidId(receiverId)) throw new SfuServiceError(400, 'Invalid sessionId or receiverId');
      await sfu.disconnectReceiver(sessionId, receiverId);
      res.json({ disconnected: true });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/sfu/sessions/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      if (!isValidId(sessionId)) throw new SfuServiceError(400, 'Invalid sessionId');
      await sfu.closeSession(sessionId);
      res.json({ closed: true });
    } catch (err) {
      next(err);
    }
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof SfuServiceError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    log.error('Unhandled SFU HTTP error', {
      error: err instanceof Error ? err.message : 'unknown error',
    });
    res.status(500).json({ error: 'Internal SFU error' });
  });

  return app;
}

const isDirectEntry = process.argv[1] && process.argv[1].endsWith('sfuServer.ts') || process.argv[1]?.endsWith('sfuServer.js');
if (isDirectEntry) {
  const sfu = new MediasoupSfuService();
  const internalSecret = process.env.SFU_INTERNAL_SECRET;
  if (!internalSecret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SFU_INTERNAL_SECRET is required in production');
    }
    log.warn('SFU_INTERNAL_SECRET is not set; standalone SFU control plane is running without shared secret auth');
  } else if (/^(CHANGE_ME|MY_|<)/i.test(internalSecret)) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SFU_INTERNAL_SECRET still contains a placeholder value');
    }
    log.warn('SFU_INTERNAL_SECRET contains a placeholder value');
  }
  const app = createSfuApp(sfu, internalSecret);
  const port = Number(process.env.SFU_PORT) || 3001;

  sfu.init()
    .then(() => {
      const srv = app.listen(port, '0.0.0.0', () => {
        log.info('Standalone mediasoup SFU server listening', { port });
      });

      const gracefulStop = async () => {
        srv.close();
        await sfu.shutdown();
        process.exit(0);
      };
      process.on('SIGINT', gracefulStop);
      process.on('SIGTERM', gracefulStop);
    })
    .catch((err) => {
      log.error('Failed to start standalone SFU server', { error: err instanceof Error ? err.message : String(err) });
      process.exit(1);
    });
}
