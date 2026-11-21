import type * as mediasoupTypes from 'mediasoup/types';
import {
  ISfuService,
  SfuConsumerParams,
  SfuHealthMetrics,
  SfuProducerSummary,
  SfuServiceError,
  SfuTransportParams,
} from './types.js';

export class RemoteSfuClient implements ISfuService {
  private readonly baseUrl: string;
  private readonly secret: string;

  constructor(baseUrl: string, secret: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.secret = secret;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.secret ? { 'x-sfu-secret': this.secret } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) {
      throw new SfuServiceError(res.status, data.error || `Remote SFU HTTP ${res.status}`);
    }
    return data;
  }

  async init(): Promise<void> {
    await this.request('GET', '/health');
  }

  async getRouterRtpCapabilities(sessionId: string, maxReceivers?: number): Promise<mediasoupTypes.RtpCapabilities> {
    const res = await this.request<{ rtpCapabilities: mediasoupTypes.RtpCapabilities }>(
      'POST',
      `/sfu/sessions/${encodeURIComponent(sessionId)}/router`,
      { maxReceivers }
    );
    return res.rtpCapabilities;
  }

  async createSenderTransport(sessionId: string, senderId: string, maxReceivers?: number): Promise<SfuTransportParams> {
    return this.request<SfuTransportParams>(
      'POST',
      `/sfu/sessions/${encodeURIComponent(sessionId)}/sender-transport`,
      { senderId, maxReceivers }
    );
  }

  async connectSenderTransport(
    sessionId: string,
    senderId: string,
    transportId: string,
    dtlsParameters: mediasoupTypes.DtlsParameters
  ): Promise<void> {
    await this.request('POST', `/sfu/sessions/${encodeURIComponent(sessionId)}/sender-transport/connect`, {
      senderId,
      transportId,
      dtlsParameters,
    });
  }

  async produce(
    sessionId: string,
    senderId: string,
    transportId: string,
    kind: mediasoupTypes.MediaKind,
    rtpParameters: mediasoupTypes.RtpParameters,
    appData?: Record<string, unknown>
  ): Promise<SfuProducerSummary> {
    return this.request<SfuProducerSummary>(
      'POST',
      `/sfu/sessions/${encodeURIComponent(sessionId)}/produce`,
      { senderId, transportId, kind, rtpParameters, appData }
    );
  }

  async closeSenderProducers(sessionId: string, senderId?: string): Promise<string[]> {
    const res = await this.request<{ closedIds: string[] }>(
      'POST',
      `/sfu/sessions/${encodeURIComponent(sessionId)}/producers/close`,
      { senderId }
    );
    return res.closedIds;
  }

  async getActiveProducers(sessionId: string): Promise<SfuProducerSummary[]> {
    const res = await this.request<{ producers: SfuProducerSummary[] }>(
      'GET',
      `/sfu/sessions/${encodeURIComponent(sessionId)}/producers`
    );
    return res.producers;
  }

  async createReceiverTransport(
    sessionId: string,
    receiverId: string,
    maxReceivers?: number
  ): Promise<SfuTransportParams> {
    return this.request<SfuTransportParams>(
      'POST',
      `/sfu/sessions/${encodeURIComponent(sessionId)}/receiver-transport`,
      { receiverId, maxReceivers }
    );
  }

  async connectReceiverTransport(
    sessionId: string,
    receiverId: string,
    transportId: string,
    dtlsParameters: mediasoupTypes.DtlsParameters
  ): Promise<void> {
    await this.request('POST', `/sfu/sessions/${encodeURIComponent(sessionId)}/receiver-transport/connect`, {
      receiverId,
      transportId,
      dtlsParameters,
    });
  }

  async consume(
    sessionId: string,
    receiverId: string,
    producerId: string,
    rtpCapabilities: mediasoupTypes.RtpCapabilities
  ): Promise<SfuConsumerParams> {
    return this.request<SfuConsumerParams>(
      'POST',
      `/sfu/sessions/${encodeURIComponent(sessionId)}/consume`,
      { receiverId, producerId, rtpCapabilities }
    );
  }

  async resumeConsumer(sessionId: string, receiverId: string, consumerId: string): Promise<void> {
    await this.request('POST', `/sfu/sessions/${encodeURIComponent(sessionId)}/consumers/${encodeURIComponent(consumerId)}/resume`, {
      receiverId,
    });
  }

  async pauseConsumer(sessionId: string, receiverId: string, consumerId: string): Promise<void> {
    await this.request('POST', `/sfu/sessions/${encodeURIComponent(sessionId)}/consumers/${encodeURIComponent(consumerId)}/pause`, {
      receiverId,
    });
  }

  async disconnectReceiver(sessionId: string, receiverId: string): Promise<void> {
    await this.request('DELETE', `/sfu/sessions/${encodeURIComponent(sessionId)}/receivers/${encodeURIComponent(receiverId)}`);
  }

  async closeSession(sessionId: string): Promise<void> {
    await this.request('DELETE', `/sfu/sessions/${encodeURIComponent(sessionId)}`);
  }

  async getHealthMetrics(): Promise<SfuHealthMetrics> {
    const metrics = await this.request<SfuHealthMetrics>('GET', '/health');
    return { ...metrics, mode: 'remote' };
  }

  async shutdown(): Promise<void> {
    // Remote SFU manages its own process lifecycle
  }
}
