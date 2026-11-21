export type MediaType = 'screen' | 'video' | 'photo' | 'music';
export type SessionStatus = 'active' | 'paused' | 'ended';
export type DeviceType = 'tv' | 'browser' | 'monitor' | 'tablet' | 'mobile';
export type ReceiverStatus = 'connected' | 'reconnecting' | 'disconnected' | 'kicked';

export interface CastSession {
  id: string;
  pin: string;
  senderId: string;
  senderName: string;
  title: string;
  mediaType: MediaType;
  status: SessionStatus;
  maxReceivers: number;
  receiverCount: number;
  activeReceiverIds: string[];
  createdAt: string;
  updatedAt: string;
  endedAt?: string;
  mediaUrl?: string;
  mediaName?: string;
}

export interface SessionReceiver {
  id: string;
  sessionId: string;
  senderId?: string;
  deviceName: string;
  deviceType: DeviceType;
  status: ReceiverStatus;
  latencyMs?: number;
  fps?: number;
  resolution?: string;
  joinedAt: string;
  lastPing: string;
  ipAddress?: string;
}

export interface RegisteredDevice {
  id: string;
  ownerId: string;
  name: string;
  type: DeviceType;
  resolution: string;
  status: 'online' | 'offline';
  lastSeen: string;
  createdAt: string;
  location?: string;
}

export interface SessionHistoryItem {
  id: string;
  sessionId: string;
  senderId: string;
  title: string;
  mediaType: MediaType;
  receiverCount: number;
  durationSeconds: number;
  startedAt: string;
  endedAt: string;
}

export interface CastSettings {
  preferredCodec: 'H264' | 'VP8' | 'VP9';
  preferredResolution: 'auto' | '1080p' | '720p' | '4k';
  preferredFps: 30 | 60;
  maxReceiversDefault: number;
  stunServers: string[];
  enableAudio: boolean;
  lowLatencyMode: boolean;
  turnServerUrl: string;
}

export interface SfuProducerSummary {
  producerId: string;
  kind: 'audio' | 'video';
}

export type SignalMessageType =
  | 'join-session'
  | 'joined-success'
  | 'join-error'
  | 'sender-ready'
  | 'sender-ready-ack'
  | 'sender-error'
  | 'receiver-joined'
  | 'receiver-left'
  | 'disconnect-receiver'
  | 'session-ended'
  | 'ping'
  | 'pong'
  | 'stats-update'
  | 'stream-stopped'
  | 'media-state-changed'
  | 'signal-error'
  | 'sfu:get-router-rtp-capabilities'
  | 'sfu:create-transport'
  | 'sfu:connect-transport'
  | 'sfu:produce'
  | 'sfu:consume'
  | 'sfu:resume-consumer'
  | 'sfu:pause-consumer'
  | 'sfu:new-producer'
  | 'sfu:response'
  | 'sfu:error';

export interface SignalMessage {
  type: SignalMessageType;
  sessionId?: string;
  requestId?: string;
  senderId?: string;
  senderName?: string;
  receiverId?: string;
  receiverToken?: string;
  pin?: string;
  deviceName?: string;
  deviceType?: DeviceType;
  error?: string;
  receiverCount?: number;
  activeReceivers?: number;
  maxReceivers?: number;
  receivers?: SessionReceiver[];
  mediaType?: MediaType;
  mediaState?: 'playing' | 'paused' | 'stopped';
  mediaTime?: number;
  producerId?: string;
  kind?: 'audio' | 'video';
  activeProducers?: SfuProducerSummary[];
  data?: unknown;
  stats?: {
    latencyMs: number;
    fps: number;
    bitrate?: number;
  };
}
