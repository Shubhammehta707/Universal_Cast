import * as mediasoup from 'mediasoup';
import type * as mediasoupTypes from 'mediasoup/types';
import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { createLogger } from '../utils/logger.js';
import { clampMaxReceivers, HARD_MAX_RECEIVERS } from '../utils/validation.js';
import {
  ISfuService,
  SfuConsumerParams,
  SfuHealthMetrics,
  SfuProducerSummary,
  SfuServiceError,
  SfuTransportParams,
} from './types.js';

const log = createLogger('mediasoup-sfu');

const MEDIA_CODECS: mediasoupTypes.RouterRtpCodecCapability[] = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: 'video',
    mimeType: 'video/H264',
    clockRate: 90000,
    parameters: {
      'packetization-mode': 1,
      'profile-level-id': '42e01f',
      'level-asymmetry-allowed': 1,
      'x-google-start-bitrate': 1200,
    },
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {
      'x-google-start-bitrate': 1200,
    },
  },
  {
    kind: 'video',
    mimeType: 'video/VP9',
    clockRate: 90000,
    parameters: {
      'profile-id': 0,
      'x-google-start-bitrate': 1200,
    },
  },
];

interface ReceiverRoomState {
  receiverId: string;
  transport: mediasoupTypes.WebRtcTransport;
  consumers: Map<string, mediasoupTypes.Consumer>;
}

interface SessionRouterRoom {
  sessionId: string;
  senderId: string | null;
  maxReceivers: number;
  router: mediasoupTypes.Router;
  senderTransport: mediasoupTypes.WebRtcTransport | null;
  producers: Map<mediasoupTypes.MediaKind, mediasoupTypes.Producer>;
  receivers: Map<string, ReceiverRoomState>;
}

export interface MediasoupSfuConfig {
  rtcMinPort?: number;
  rtcMaxPort?: number;
  listenIp?: string;
  announcedIp?: string;
  workerBin?: string;
}

function detectDefaultAnnouncedIp(): string {
  const ifaces = os.networkInterfaces();
  for (const entries of Object.values(ifaces)) {
    if (!entries) continue;
    for (const info of entries) {
      if (info.family === 'IPv4' && !info.internal) {
        return info.address;
      }
    }
  }
  return '127.0.0.1';
}

export class MediasoupSfuService implements ISfuService {
  private worker: mediasoupTypes.Worker | null = null;
  private initPromise: Promise<void> | null = null;
  private readonly rooms = new Map<string, SessionRouterRoom>();
  private readonly startedAt = Date.now();
  private readonly rtcMinPort: number;
  private readonly rtcMaxPort: number;
  private readonly listenIp: string;
  private readonly announcedIp: string;
  private readonly workerBin?: string;

  constructor(config: MediasoupSfuConfig = {}) {
    this.rtcMinPort = config.rtcMinPort ?? (Number(process.env.MEDIASOUP_RTC_MIN_PORT) || 40000);
    this.rtcMaxPort = config.rtcMaxPort ?? (Number(process.env.MEDIASOUP_RTC_MAX_PORT) || 40199);
    this.listenIp = config.listenIp ?? (process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0');
    this.announcedIp = config.announcedIp ?? (process.env.MEDIASOUP_ANNOUNCED_IP || detectDefaultAnnouncedIp());
    this.workerBin = config.workerBin ?? process.env.MEDIASOUP_WORKER_BIN;
  }

  async init(): Promise<void> {
    if (this.worker && !this.worker.closed) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const execFileAsync = promisify(execFile);
      const defaultWorkerBin = path.resolve(
        process.cwd(),
        'node_modules/mediasoup/worker/out/Release/mediasoup-worker'
      );
      const ensureScript = path.resolve(process.cwd(), 'scripts/ensure-mediasoup-worker.mjs');

      if (!this.workerBin && !fs.existsSync(defaultWorkerBin) && fs.existsSync(ensureScript)) {
        log.warn('mediasoup-worker binary missing; provisioning prebuilt binary automatically');
        await execFileAsync(process.execPath, [ensureScript], { cwd: process.cwd() });
      }

      const workerOptions: mediasoupTypes.WorkerSettings = {
        logLevel: (process.env.MEDIASOUP_LOG_LEVEL as mediasoupTypes.WorkerLogLevel) || 'warn',
        logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
        rtcMinPort: this.rtcMinPort,
        rtcMaxPort: this.rtcMaxPort,
      };
      if (this.workerBin && fs.existsSync(this.workerBin)) {
        workerOptions.workerBin = this.workerBin;
      }

      const worker = await mediasoup.createWorker(workerOptions);
      worker.on('died', (error) => {
        log.error('mediasoup Worker died unexpectedly', {
          pid: worker.pid,
          error: error.message,
        });
        this.worker = null;
        this.rooms.clear();
      });

      this.worker = worker;
      log.info('mediasoup Worker initialized', {
        pid: worker.pid,
        rtcMinPort: this.rtcMinPort,
        rtcMaxPort: this.rtcMaxPort,
        announcedIp: this.announcedIp,
      });
    })();

    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  private async ensureWorker(): Promise<mediasoupTypes.Worker> {
    await this.init();
    if (!this.worker || this.worker.closed) {
      throw new SfuServiceError(503, 'SFU worker is unavailable');
    }
    return this.worker;
  }

  private async getOrCreateRoom(sessionId: string, maxReceivers = HARD_MAX_RECEIVERS): Promise<SessionRouterRoom> {
    const existing = this.rooms.get(sessionId);
    if (existing && !existing.router.closed) {
      return existing;
    }

    const worker = await this.ensureWorker();
    const router = await worker.createRouter({ mediaCodecs: MEDIA_CODECS });
    const room: SessionRouterRoom = {
      sessionId,
      senderId: null,
      maxReceivers: clampMaxReceivers(maxReceivers),
      router,
      senderTransport: null,
      producers: new Map(),
      receivers: new Map(),
    };
    this.rooms.set(sessionId, room);
    log.info('Created mediasoup Router for session', {
      sessionId,
      routerId: router.id,
      maxReceivers: room.maxReceivers,
    });
    return room;
  }

  private async createWebRtcTransport(router: mediasoupTypes.Router, appData: Record<string, unknown>): Promise<mediasoupTypes.WebRtcTransport> {
    const listenInfos: mediasoupTypes.TransportListenInfo[] = [
      {
        protocol: 'udp',
        ip: this.listenIp,
        announcedAddress: this.announcedIp,
      },
      {
        protocol: 'tcp',
        ip: this.listenIp,
        announcedAddress: this.announcedIp,
      },
    ];

    const transport = await router.createWebRtcTransport({
      listenInfos,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: 1_500_000,
      maxIncomingBitrate: 6_000_000,
      appData,
    });

    return transport;
  }

  async getRouterRtpCapabilities(sessionId: string, maxReceivers = HARD_MAX_RECEIVERS): Promise<mediasoupTypes.RtpCapabilities> {
    const room = await this.getOrCreateRoom(sessionId, maxReceivers);
    return room.router.rtpCapabilities;
  }

  async createSenderTransport(sessionId: string, senderId: string, maxReceivers = HARD_MAX_RECEIVERS): Promise<SfuTransportParams> {
    const room = await this.getOrCreateRoom(sessionId, maxReceivers);
    if (room.senderId && room.senderId !== senderId) {
      throw new SfuServiceError(403, 'Session sender transport belongs to a different host');
    }
    room.senderId = senderId;

    // Clean up stale sender transport & producers on sender reconnect
    if (room.senderTransport && !room.senderTransport.closed) {
      room.producers.forEach((p) => {
        if (!p.closed) p.close();
      });
      room.producers.clear();
      room.senderTransport.close();
    }

    const transport = await this.createWebRtcTransport(room.router, { role: 'sender', sessionId, senderId });
    room.senderTransport = transport;

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  async connectSenderTransport(
    sessionId: string,
    senderId: string,
    transportId: string,
    dtlsParameters: mediasoupTypes.DtlsParameters
  ): Promise<void> {
    const room = this.rooms.get(sessionId);
    if (!room || !room.senderTransport) {
      throw new SfuServiceError(404, 'Sender transport not found');
    }
    if (room.senderId !== senderId) {
      throw new SfuServiceError(403, 'Forbidden: sender identity mismatch');
    }
    if (room.senderTransport.id !== transportId) {
      throw new SfuServiceError(400, 'Transport ID mismatch');
    }
    await room.senderTransport.connect({ dtlsParameters });
  }

  async produce(
    sessionId: string,
    senderId: string,
    transportId: string,
    kind: mediasoupTypes.MediaKind,
    rtpParameters: mediasoupTypes.RtpParameters,
    appData?: Record<string, unknown>
  ): Promise<SfuProducerSummary> {
    const room = this.rooms.get(sessionId);
    if (!room || !room.senderTransport) {
      throw new SfuServiceError(404, 'Sender transport not initialized');
    }
    if (room.senderId !== senderId) {
      throw new SfuServiceError(403, 'Forbidden: only the host may produce streams');
    }
    if (room.senderTransport.id !== transportId) {
      throw new SfuServiceError(400, 'Sender transport ID mismatch');
    }

    // Replace existing producer of same kind cleanly (e.g. screen switch)
    const previous = room.producers.get(kind);
    if (previous && !previous.closed) {
      previous.close();
    }

    const producer = await room.senderTransport.produce({
      kind,
      rtpParameters,
      appData: { ...(appData || {}), sessionId, senderId },
    });

    room.producers.set(kind, producer);
    producer.on('transportclose', () => {
      if (room.producers.get(kind)?.id === producer.id) {
        room.producers.delete(kind);
      }
    });

    log.info('SFU sender producer created', {
      sessionId,
      producerId: producer.id,
      kind,
    });

    return { producerId: producer.id, kind: producer.kind };
  }

  async closeSenderProducers(sessionId: string, senderId?: string): Promise<string[]> {
    const room = this.rooms.get(sessionId);
    if (!room) return [];
    if (senderId && room.senderId && room.senderId !== senderId) {
      throw new SfuServiceError(403, 'Forbidden: cannot stop another host stream');
    }
    const closedIds: string[] = [];
    for (const producer of room.producers.values()) {
      closedIds.push(producer.id);
      if (!producer.closed) producer.close();
    }
    room.producers.clear();
    return closedIds;
  }

  async getActiveProducers(sessionId: string): Promise<SfuProducerSummary[]> {
    const room = this.rooms.get(sessionId);
    if (!room) return [];
    const list: SfuProducerSummary[] = [];
    for (const producer of room.producers.values()) {
      if (!producer.closed) {
        list.push({ producerId: producer.id, kind: producer.kind });
      }
    }
    return list;
  }

  async createReceiverTransport(
    sessionId: string,
    receiverId: string,
    maxReceivers = HARD_MAX_RECEIVERS
  ): Promise<SfuTransportParams> {
    const room = await this.getOrCreateRoom(sessionId, maxReceivers);
    const effectiveLimit = Math.min(room.maxReceivers, HARD_MAX_RECEIVERS);

    const existingReceiver = room.receivers.get(receiverId);
    if (!existingReceiver && room.receivers.size >= effectiveLimit) {
      throw new SfuServiceError(
        409,
        `SFU receiver limit reached (${room.receivers.size}/${effectiveLimit} max)`
      );
    }

    // Close stale transport if this receiver is recreating its transport
    if (existingReceiver) {
      existingReceiver.consumers.forEach((c) => {
        if (!c.closed) c.close();
      });
      existingReceiver.consumers.clear();
      if (!existingReceiver.transport.closed) {
        existingReceiver.transport.close();
      }
      room.receivers.delete(receiverId);
    }

    const transport = await this.createWebRtcTransport(room.router, { role: 'receiver', sessionId, receiverId });
    const recvState: ReceiverRoomState = {
      receiverId,
      transport,
      consumers: new Map(),
    };
    room.receivers.set(receiverId, recvState);

    transport.on('routerclose', () => {
      recvState.consumers.clear();
      room.receivers.delete(receiverId);
    });

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  async connectReceiverTransport(
    sessionId: string,
    receiverId: string,
    transportId: string,
    dtlsParameters: mediasoupTypes.DtlsParameters
  ): Promise<void> {
    const room = this.rooms.get(sessionId);
    const recvState = room?.receivers.get(receiverId);
    if (!room || !recvState) {
      throw new SfuServiceError(404, 'Receiver transport not found');
    }
    if (recvState.transport.id !== transportId) {
      throw new SfuServiceError(400, 'Receiver transport ID mismatch');
    }
    await recvState.transport.connect({ dtlsParameters });
  }

  async consume(
    sessionId: string,
    receiverId: string,
    producerId: string,
    rtpCapabilities: mediasoupTypes.RtpCapabilities
  ): Promise<SfuConsumerParams> {
    const room = this.rooms.get(sessionId);
    if (!room) {
      throw new SfuServiceError(404, 'SFU session room not found');
    }
    const recvState = room.receivers.get(receiverId);
    if (!recvState || recvState.transport.closed) {
      throw new SfuServiceError(404, 'Receiver transport is not ready');
    }

    const producer = Array.from(room.producers.values()).find((p) => p.id === producerId && !p.closed);
    if (!producer) {
      throw new SfuServiceError(404, 'Producer not found or closed');
    }

    if (!room.router.canConsume({ producerId, rtpCapabilities })) {
      throw new SfuServiceError(400, 'Client RTP capabilities cannot consume producer');
    }

    const consumer = await recvState.transport.consume({
      producerId,
      rtpCapabilities,
      paused: true,
      appData: { sessionId, receiverId, producerId },
    });

    recvState.consumers.set(consumer.id, consumer);

    consumer.on('transportclose', () => {
      recvState.consumers.delete(consumer.id);
    });
    consumer.on('producerclose', () => {
      recvState.consumers.delete(consumer.id);
    });

    return {
      id: consumer.id,
      producerId: consumer.producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    };
  }

  async resumeConsumer(sessionId: string, receiverId: string, consumerId: string): Promise<void> {
    const recvState = this.rooms.get(sessionId)?.receivers.get(receiverId);
    const consumer = recvState?.consumers.get(consumerId);
    if (!consumer || consumer.closed) {
      throw new SfuServiceError(404, 'Consumer not found');
    }
    await consumer.resume();
  }

  async pauseConsumer(sessionId: string, receiverId: string, consumerId: string): Promise<void> {
    const recvState = this.rooms.get(sessionId)?.receivers.get(receiverId);
    const consumer = recvState?.consumers.get(consumerId);
    if (!consumer || consumer.closed) {
      throw new SfuServiceError(404, 'Consumer not found');
    }
    await consumer.pause();
  }

  async disconnectReceiver(sessionId: string, receiverId: string): Promise<void> {
    const room = this.rooms.get(sessionId);
    if (!room) return;
    const recvState = room.receivers.get(receiverId);
    if (!recvState) return;

    // Close only this receiver's consumers and transport; sender and other receivers stay intact
    for (const consumer of recvState.consumers.values()) {
      if (!consumer.closed) consumer.close();
    }
    recvState.consumers.clear();

    if (!recvState.transport.closed) {
      recvState.transport.close();
    }
    room.receivers.delete(receiverId);
    log.info('SFU receiver isolated disconnect complete', {
      sessionId,
      receiverId,
      remainingReceivers: room.receivers.size,
    });
  }

  async closeSession(sessionId: string): Promise<void> {
    const room = this.rooms.get(sessionId);
    if (!room) return;

    for (const recvState of room.receivers.values()) {
      recvState.consumers.forEach((c) => {
        if (!c.closed) c.close();
      });
      recvState.consumers.clear();
      if (!recvState.transport.closed) {
        recvState.transport.close();
      }
    }
    room.receivers.clear();

    room.producers.forEach((p) => {
      if (!p.closed) p.close();
    });
    room.producers.clear();

    if (room.senderTransport && !room.senderTransport.closed) {
      room.senderTransport.close();
    }
    room.senderTransport = null;

    if (!room.router.closed) {
      room.router.close();
    }

    this.rooms.delete(sessionId);
    log.info('SFU session router and transports cleaned up', { sessionId });
  }

  async getHealthMetrics(): Promise<SfuHealthMetrics> {
    let activeProducers = 0;
    let activeConsumers = 0;
    let activeReceiverTransports = 0;

    for (const room of this.rooms.values()) {
      activeProducers += room.producers.size;
      activeReceiverTransports += room.receivers.size;
      for (const recv of room.receivers.values()) {
        activeConsumers += recv.consumers.size;
      }
    }

    return {
      status: this.worker && !this.worker.closed ? 'ok' : 'uninitialized',
      mode: 'embedded',
      workerPid: this.worker?.pid ?? null,
      workerClosed: this.worker ? this.worker.closed : true,
      activeRouters: this.rooms.size,
      activeProducers,
      activeConsumers,
      activeReceiverTransports,
      maxReceiversPerSession: HARD_MAX_RECEIVERS,
      rtcMinPort: this.rtcMinPort,
      rtcMaxPort: this.rtcMaxPort,
      announcedIp: this.announcedIp,
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
    };
  }

  async shutdown(): Promise<void> {
    for (const sessionId of Array.from(this.rooms.keys())) {
      await this.closeSession(sessionId);
    }
    if (this.worker && !this.worker.closed) {
      this.worker.close();
      this.worker = null;
    }
    log.info('mediasoup SFU service shut down');
  }
}
