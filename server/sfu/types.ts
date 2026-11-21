import type * as mediasoupTypes from 'mediasoup/types';

export interface SfuTransportParams {
  id: string;
  iceParameters: mediasoupTypes.IceParameters;
  iceCandidates: mediasoupTypes.IceCandidate[];
  dtlsParameters: mediasoupTypes.DtlsParameters;
}

export interface SfuConsumerParams {
  id: string;
  producerId: string;
  kind: mediasoupTypes.MediaKind;
  rtpParameters: mediasoupTypes.RtpParameters;
}

export interface SfuProducerSummary {
  producerId: string;
  kind: mediasoupTypes.MediaKind;
}

export interface SfuHealthMetrics {
  status: 'ok' | 'uninitialized' | 'error';
  mode: 'embedded' | 'remote';
  workerPid: number | null;
  workerClosed: boolean;
  activeRouters: number;
  activeProducers: number;
  activeConsumers: number;
  activeReceiverTransports: number;
  maxReceiversPerSession: number;
  rtcMinPort: number;
  rtcMaxPort: number;
  announcedIp: string;
  uptimeSeconds: number;
}

export class SfuServiceError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export interface ISfuService {
  init(): Promise<void>;
  getRouterRtpCapabilities(sessionId: string, maxReceivers?: number): Promise<mediasoupTypes.RtpCapabilities>;
  createSenderTransport(sessionId: string, senderId: string, maxReceivers?: number): Promise<SfuTransportParams>;
  connectSenderTransport(
    sessionId: string,
    senderId: string,
    transportId: string,
    dtlsParameters: mediasoupTypes.DtlsParameters
  ): Promise<void>;
  produce(
    sessionId: string,
    senderId: string,
    transportId: string,
    kind: mediasoupTypes.MediaKind,
    rtpParameters: mediasoupTypes.RtpParameters,
    appData?: Record<string, unknown>
  ): Promise<SfuProducerSummary>;
  closeSenderProducers(sessionId: string, senderId?: string): Promise<string[]>;
  getActiveProducers(sessionId: string): Promise<SfuProducerSummary[]>;
  createReceiverTransport(
    sessionId: string,
    receiverId: string,
    maxReceivers?: number
  ): Promise<SfuTransportParams>;
  connectReceiverTransport(
    sessionId: string,
    receiverId: string,
    transportId: string,
    dtlsParameters: mediasoupTypes.DtlsParameters
  ): Promise<void>;
  consume(
    sessionId: string,
    receiverId: string,
    producerId: string,
    rtpCapabilities: mediasoupTypes.RtpCapabilities
  ): Promise<SfuConsumerParams>;
  resumeConsumer(sessionId: string, receiverId: string, consumerId: string): Promise<void>;
  pauseConsumer(sessionId: string, receiverId: string, consumerId: string): Promise<void>;
  disconnectReceiver(sessionId: string, receiverId: string): Promise<void>;
  closeSession(sessionId: string): Promise<void>;
  getHealthMetrics(): Promise<SfuHealthMetrics>;
  shutdown(): Promise<void>;
}
