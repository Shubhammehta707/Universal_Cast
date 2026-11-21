import { useState, useRef, useCallback, useEffect } from 'react';
import { Device, types as mediasoupClientTypes } from 'mediasoup-client';
import { auth } from '../firebase/config';
import { SignalMessage, SessionReceiver, DeviceType, SfuProducerSummary } from '../types/cast';
import {
  getScreenCaptureDiagnostics,
  getScreenCaptureErrorMessage,
  getScreenCaptureUnavailableMessage,
} from '../utils/screenCapture';

function getConfiguredIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  try {
    const raw = localStorage.getItem('uc_settings');
    if (raw) {
      const parsed = JSON.parse(raw) as { stunServer?: string; turnServer?: string };
      if (parsed.stunServer && typeof parsed.stunServer === 'string' && parsed.stunServer.startsWith('stun:')) {
        servers.unshift({ urls: parsed.stunServer });
      }
      if (parsed.turnServer && typeof parsed.turnServer === 'string' && parsed.turnServer.trim()) {
        servers.push({ urls: parsed.turnServer.trim() });
      }
    }
  } catch {
    // Use defaults
  }
  return servers;
}

function getWsUrl(): string {
  const loc = window.location;
  const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${loc.host}/ws`;
}

function createRequestHelper(wsRef: React.MutableRefObject<WebSocket | null>) {
  const pending = new Map<
    string,
    { resolve: (data: unknown) => void; reject: (err: Error) => void; timer: ReturnType<typeof setTimeout> }
  >();

  const request = <T = unknown>(payload: Record<string, unknown>, timeoutMs = 12000): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket signaling is not connected'));
        return;
      }

      const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error(`Signaling timeout waiting for ${String(payload.type)}`));
      }, timeoutMs);

      pending.set(requestId, {
        resolve: resolve as (data: unknown) => void,
        reject,
        timer,
      });

      ws.send(JSON.stringify({ ...payload, requestId }));
    });
  };

  const handleReply = (msg: SignalMessage): boolean => {
    if (!msg.requestId) return false;
    const entry = pending.get(msg.requestId);
    if (!entry) return false;

    clearTimeout(entry.timer);
    pending.delete(msg.requestId);

    if (msg.type === 'sfu:error') {
      entry.reject(new Error(msg.error || 'SFU request error'));
    } else {
      entry.resolve(msg.data);
    }
    return true;
  };

  const rejectAll = (reason: string) => {
    pending.forEach((entry) => {
      clearTimeout(entry.timer);
      entry.reject(new Error(reason));
    });
    pending.clear();
  };

  return { request, handleReply, rejectAll };
}

// ---------------- SENDER SFU HOOK ----------------

export function useSenderWebRTC(sessionId: string, pin: string, senderName: string, maxReceivers = 10) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [activeReceivers, setActiveReceivers] = useState<SessionReceiver[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'screen' | 'video' | 'photo' | 'music'>('screen');

  const wsRef = useRef<WebSocket | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<mediasoupClientTypes.Transport | null>(null);
  const sendTransportPromiseRef = useRef<Promise<mediasoupClientTypes.Transport> | null>(null);
  const producersRef = useRef<Map<'audio' | 'video', mediasoupClientTypes.Producer>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const rpcRef = useRef(createRequestHelper(wsRef));
  const senderConfigRef = useRef({ pin, senderName, mediaType, maxReceivers });
  const senderReadyRef = useRef(false);
  const senderReadyWaitersRef = useRef<Array<{
    resolve: () => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>>([]);

  const settleSenderReadyWaiters = useCallback((error?: Error) => {
    senderReadyRef.current = !error;
    const waiters = senderReadyWaitersRef.current.splice(0);
    for (const waiter of waiters) {
      clearTimeout(waiter.timer);
      if (error) waiter.reject(error);
      else waiter.resolve();
    }
  }, []);

  const waitForSenderReady = useCallback(() => {
    if (senderReadyRef.current) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          senderReadyWaitersRef.current = senderReadyWaitersRef.current.filter((entry) => entry !== waiter);
          reject(new Error('Sender signaling did not become ready. Check the server connection and sign-in state.'));
        }, 12_000),
      };
      senderReadyWaitersRef.current.push(waiter);
    });
  }, []);

  useEffect(() => {
    senderConfigRef.current = { pin, senderName, mediaType, maxReceivers };
  }, [pin, senderName, mediaType, maxReceivers]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  const cleanupSenderTransport = useCallback(() => {
    sendTransportPromiseRef.current = null;
    producersRef.current.forEach((p) => {
      try {
        p.close();
      } catch {
        // Ignore already closed
      }
    });
    producersRef.current.clear();

    if (sendTransportRef.current) {
      try {
        sendTransportRef.current.close();
      } catch {
        // Ignore already closed
      }
      sendTransportRef.current = null;
    }
    deviceRef.current = null;
  }, []);

  const ensureSendTransport = useCallback(async (): Promise<mediasoupClientTypes.Transport> => {
    if (sendTransportRef.current && !sendTransportRef.current.closed) {
      return sendTransportRef.current;
    }
    if (sendTransportPromiseRef.current) {
      return sendTransportPromiseRef.current;
    }

    const promise = (async () => {
      await waitForSenderReady();
      const { rtpCapabilities } = await rpcRef.current.request<{
        rtpCapabilities: mediasoupClientTypes.RtpCapabilities;
      }>({
        type: 'sfu:get-router-rtp-capabilities',
        sessionId,
      });

      const device = new Device();
      await device.load({ routerRtpCapabilities: rtpCapabilities });
      deviceRef.current = device;

      const transportOptions = await rpcRef.current.request<mediasoupClientTypes.TransportOptions>({
        type: 'sfu:create-transport',
        sessionId,
        role: 'sender',
      });

      const sendTransport = device.createSendTransport({
        ...transportOptions,
        iceServers: getConfiguredIceServers(),
      });

      sendTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
        rpcRef.current
          .request({
            type: 'sfu:connect-transport',
            sessionId,
            role: 'sender',
            transportId: sendTransport.id,
            dtlsParameters,
          })
          .then(() => callback())
          .catch((err) => errback(err instanceof Error ? err : new Error('Transport connect failed')));
      });

      sendTransport.on('produce', ({ kind, rtpParameters, appData }, callback, errback) => {
        rpcRef.current
          .request<{ id: string }>({
            type: 'sfu:produce',
            sessionId,
            transportId: sendTransport.id,
            kind,
            rtpParameters,
            appData,
          })
          .then(({ id }) => callback({ id }))
          .catch((err) => errback(err instanceof Error ? err : new Error('Produce failed')));
      });

      sendTransport.on('connectionstatechange', (state) => {
        console.info('[ScreenShare] SFU send transport state changed', { state });
        if (state === 'failed') {
          setError('SFU upstream transport failed. Check network or TURN/UDP settings.');
        }
      });

      sendTransportRef.current = sendTransport;
      return sendTransport;
    })();

    sendTransportPromiseRef.current = promise;
    try {
      return await promise;
    } finally {
      if (sendTransportPromiseRef.current === promise) {
        sendTransportPromiseRef.current = null;
      }
    }
  }, [sessionId, waitForSenderReady]);

  const publishStreamToSfu = useCallback(
    async (stream: MediaStream) => {
      const sendTransport = await ensureSendTransport();

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const existingVideo = producersRef.current.get('video');
        if (existingVideo && !existingVideo.closed) {
          await existingVideo.replaceTrack({ track: videoTrack });
        } else {
          const videoProducer = await sendTransport.produce({
            track: videoTrack,
            encodings: [{ maxBitrate: 3_500_000 }],
            codecOptions: {
              videoGoogleStartBitrate: 1200,
            },
          });
          producersRef.current.set('video', videoProducer);
        }
      }

      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        const existingAudio = producersRef.current.get('audio');
        if (existingAudio && !existingAudio.closed) {
          await existingAudio.replaceTrack({ track: audioTrack });
        } else {
          const audioProducer = await sendTransport.produce({
            track: audioTrack,
          });
          producersRef.current.set('audio', audioProducer);
        }
      }
    },
    [ensureSendTransport]
  );

  // Stop active media stream without terminating session or disconnecting receivers
  const stopStream = useCallback(() => {
    producersRef.current.forEach((p) => {
      try {
        p.close();
      } catch {
        // ignore
      }
    });
    producersRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
      localStreamRef.current = null;
    }
    setIsStreaming(false);

    if (wsRef.current?.readyState === WebSocket.OPEN && sessionId) {
      wsRef.current.send(
        JSON.stringify({
          type: 'stream-stopped',
          sessionId,
        })
      );
    }
  }, [sessionId]);

  // End entire cast session
  const stopCasting = useCallback(() => {
    cleanupSenderTransport();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
      localStreamRef.current = null;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN && sessionId) {
      wsRef.current.send(
        JSON.stringify({
          type: 'session-ended',
          sessionId,
        })
      );
    }

    setIsStreaming(false);
    setActiveReceivers([]);
  }, [cleanupSenderTransport, sessionId]);

  const startScreenCapture = useCallback(async () => {
    setError(null);
    const diagnostics = getScreenCaptureDiagnostics();
    console.info('[ScreenShare] browser capability diagnostics', diagnostics);

    if (
      !diagnostics.secureContext ||
      !diagnostics.hasMediaDevices ||
      !diagnostics.hasGetDisplayMedia ||
      (diagnostics.isIframe && diagnostics.displayCaptureAllowed === false)
    ) {
      const message = getScreenCaptureUnavailableMessage(diagnostics);
      setError(message);
      console.warn('[ScreenShare] capture unavailable in this browser context', diagnostics);
      throw new Error(message);
    }

    let stream: MediaStream;
    try {
      console.info('[ScreenShare] requesting display capture', {
        ...diagnostics,
      });
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          frameRate: { ideal: 60, max: 60 },
        },
        audio: true,
      });
    } catch (err: unknown) {
      const msg = getScreenCaptureErrorMessage(err, diagnostics);
      console.warn('[ScreenShare] browser capture request failed', {
        errorName: err instanceof DOMException ? err.name : 'UnknownError',
        ...diagnostics,
      });
      setError(msg);
      throw new Error(msg);
    }

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      stream.getTracks().forEach((track) => track.stop());
      const message = 'The browser returned no screen video track. Choose a screen, window, or tab and try again.';
      setError(message);
      console.warn('[ScreenShare] browser capture returned no video track');
      throw new Error(message);
    }

    console.info('[ScreenShare] browser capture started', {
      videoTrackState: videoTrack.readyState,
      audioTrackCount: stream.getAudioTracks().length,
    });
    videoTrack.onended = () => {
      console.info('[ScreenShare] browser capture track ended');
      stopStream();
    };

    setLocalStream(stream);
    localStreamRef.current = stream;
    setMediaType('screen');
    setIsStreaming(true);

    try {
      await publishStreamToSfu(stream);
      console.info('[ScreenShare] screen track published to SFU');
      return stream;
    } catch (err: unknown) {
      console.error('[ScreenShare] SFU publish failed', {
        errorName: err instanceof Error ? err.name : 'UnknownError',
      });
      stopStream();
      cleanupSenderTransport();
      const message = err instanceof Error
        ? `Screen was captured, but could not be sent to the SFU: ${err.message}`
        : 'Screen was captured, but could not be sent to the SFU.';
      setError(message);
      throw new Error(message);
    }
  }, [cleanupSenderTransport, publishStreamToSfu, stopStream]);

  const startMediaElementCapture = useCallback(
    async (element: HTMLVideoElement | HTMLAudioElement, type: 'video' | 'music') => {
      try {
        setError(null);
        // @ts-expect-error captureStream is standard on HTMLMediaElement in modern browsers
        const stream: MediaStream = element.captureStream
          ? // @ts-expect-error browser extension
            element.captureStream()
          : // @ts-expect-error mozCaptureStream legacy Firefox
            element.mozCaptureStream();

        setLocalStream(stream);
        localStreamRef.current = stream;
        setMediaType(type);
        setIsStreaming(true);

        await publishStreamToSfu(stream);
        return stream;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Media element capture failed';
        setError(msg);
        throw err;
      }
    },
    [publishStreamToSfu]
  );

  const handleSignalingMessage = useCallback(
    (msg: SignalMessage) => {
      if (rpcRef.current.handleReply(msg)) return;

      switch (msg.type) {
        case 'sender-ready-ack': {
          console.info('[ScreenShare] sender session authorized and ready');
          settleSenderReadyWaiters();
          if (Array.isArray(msg.receivers)) {
            setActiveReceivers(msg.receivers);
          }
          break;
        }
        case 'sender-error': {
          settleSenderReadyWaiters(new Error(msg.error || 'Sender authentication or signaling error'));
          setError(msg.error || 'Sender authentication or signaling error');
          break;
        }
        case 'signal-error': {
          setError(msg.error || 'Signaling error');
          break;
        }
        case 'receiver-joined': {
          if (!msg.receiverId) return;
          const receiverId = msg.receiverId;
          setActiveReceivers((prev) => {
            if (prev.some((r) => r.id === receiverId)) return prev;
            return [
              ...prev,
              {
                id: receiverId,
                sessionId,
                senderId: msg.senderId,
                deviceName: msg.deviceName || 'Browser Receiver',
                deviceType: msg.deviceType || 'browser',
                status: 'connected',
                joinedAt: new Date().toISOString(),
                lastPing: new Date().toISOString(),
                latencyMs: 15,
                fps: 60,
              },
            ];
          });
          break;
        }
        case 'receiver-left': {
          if (!msg.receiverId) return;
          setActiveReceivers((prev) => prev.filter((r) => r.id !== msg.receiverId));
          break;
        }
        case 'stats-update': {
          if (!msg.receiverId || !msg.stats) return;
          const stats = msg.stats;
          setActiveReceivers((prev) =>
            prev.map((r) =>
              r.id === msg.receiverId
                ? { ...r, latencyMs: stats.latencyMs, fps: stats.fps, lastPing: new Date().toISOString() }
                : r
            )
          );
          break;
        }
      }
    },
    [sessionId, settleSenderReadyWaiters]
  );

  const connectSignaling = useCallback(async () => {
    if (!sessionId) return;
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    settleSenderReadyWaiters(new Error('Sender signaling is reconnecting.'));
    senderReadyRef.current = false;

    const currentUser = auth.currentUser;
    if (!currentUser) {
      const error = new Error('Sign in with Google to initialize SFU host signaling.');
      settleSenderReadyWaiters(error);
      setError(error.message);
      return;
    }

    try {
      const idToken = await currentUser.getIdToken();
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
        console.info('[ScreenShare] signaling WebSocket opened');
        const cfg = senderConfigRef.current;
        ws.send(
          JSON.stringify({
            type: 'sender-ready',
            sessionId,
            idToken,
            pin: cfg.pin,
            senderName: cfg.senderName,
            mediaType: cfg.mediaType,
            maxReceivers: Math.min(Math.max(1, cfg.maxReceivers), 10),
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg: SignalMessage = JSON.parse(event.data);
          handleSignalingMessage(msg);
        } catch (e) {
          console.error('Failed to parse sender signaling message:', e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        settleSenderReadyWaiters(new Error('Sender signaling closed before the session became ready.'));
        console.warn('[ScreenShare] signaling WebSocket closed');
        rpcRef.current.rejectAll('Sender signaling closed');
      };

      ws.onerror = () => {
        console.error('[ScreenShare] signaling WebSocket error');
        setError('Signaling server connection error');
      };
    } catch (e) {
      const error = e instanceof Error ? e : new Error('Signaling authentication error');
      settleSenderReadyWaiters(error);
      setError(error.message);
    }
  }, [sessionId, handleSignalingMessage, settleSenderReadyWaiters]);

  const disconnectReceiver = useCallback(
    (receiverId: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'disconnect-receiver',
            sessionId,
            receiverId,
          })
        );
      }
      setActiveReceivers((prev) => prev.filter((r) => r.id !== receiverId));
    },
    [sessionId]
  );

  const broadcastMediaState = useCallback(
    (state: 'playing' | 'paused' | 'stopped', time?: number) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'media-state-changed',
            sessionId,
            mediaState: state,
            mediaTime: time,
          })
        );
      }
    },
    [sessionId]
  );

  useEffect(() => {
    if (sessionId) {
      connectSignaling();
    }
    return () => {
      cleanupSenderTransport();
      settleSenderReadyWaiters(new Error('Sender signaling was closed.'));
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [sessionId, connectSignaling, cleanupSenderTransport]);

  return {
    localStream,
    activeReceivers,
    isConnected,
    isStreaming,
    error,
    mediaType,
    startScreenCapture,
    startMediaElementCapture,
    disconnectReceiver,
    stopStream,
    stopCasting,
    broadcastMediaState,
    connectSignaling,
  };
}

// ---------------- RECEIVER SFU HOOK ----------------

export type ReceiverConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'waiting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'kicked'
  | 'error';

export interface ReceiverStats {
  latencyMs: number;
  fps: number;
  resolution?: string;
  codec?: string;
}

export function useReceiverWebRTC(
  sessionId: string | null,
  pin: string | null,
  deviceName: string,
  deviceType: DeviceType = 'browser',
  initialReceiverToken: string | null = null,
  initialReceiverId: string | null = null
) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ReceiverConnectionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState<number>(0);
  const [senderInfo, setSenderInfo] = useState<{ name: string; mediaType: string; title?: string } | null>(null);
  const [stats, setStats] = useState<ReceiverStats>({
    latencyMs: 0,
    fps: 0,
    resolution: '1080p',
    codec: 'H.264 / Opus',
  });

  const wsRef = useRef<WebSocket | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const recvTransportRef = useRef<mediasoupClientTypes.Transport | null>(null);
  const recvTransportPromiseRef = useRef<Promise<{ device: Device; transport: mediasoupClientTypes.Transport }> | null>(null);
  const consumersRef = useRef<Map<string, mediasoupClientTypes.Consumer>>(new Map());
  const receiverIdRef = useRef<string>(
    initialReceiverId || `recv_${Math.random().toString(36).substring(2, 10)}`
  );
  const receiverTokenRef = useRef<string | null>(initialReceiverToken);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isIntentionalCloseRef = useRef<boolean>(false);
  const currentSessionIdRef = useRef<string | null>(sessionId);
  const currentPinRef = useRef<string | null>(pin);
  const rpcRef = useRef(createRequestHelper(wsRef));

  useEffect(() => {
    currentSessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    currentPinRef.current = pin;
  }, [pin]);

  useEffect(() => {
    if (initialReceiverToken) receiverTokenRef.current = initialReceiverToken;
  }, [initialReceiverToken]);

  useEffect(() => {
    if (initialReceiverId) receiverIdRef.current = initialReceiverId;
  }, [initialReceiverId]);

  const cleanupReceiverTransport = useCallback(() => {
    recvTransportPromiseRef.current = null;
    consumersRef.current.forEach((consumer) => {
      try {
        consumer.close();
      } catch {
        // Ignore already closed
      }
    });
    consumersRef.current.clear();

    if (recvTransportRef.current) {
      try {
        recvTransportRef.current.close();
      } catch {
        // Ignore already closed
      }
      recvTransportRef.current = null;
    }
    deviceRef.current = null;
  }, []);

  const triggerReconnectRef = useRef<() => void>(() => {});

  const ensureRecvTransport = useCallback(
    async (activeSessionId: string): Promise<{ device: Device; transport: mediasoupClientTypes.Transport }> => {
      if (deviceRef.current && recvTransportRef.current && !recvTransportRef.current.closed) {
        return { device: deviceRef.current, transport: recvTransportRef.current };
      }
      if (recvTransportPromiseRef.current) {
        return recvTransportPromiseRef.current;
      }

      const promise = (async () => {
        const { rtpCapabilities } = await rpcRef.current.request<{
          rtpCapabilities: mediasoupClientTypes.RtpCapabilities;
        }>({
          type: 'sfu:get-router-rtp-capabilities',
          sessionId: activeSessionId,
        });

        const device = new Device();
        await device.load({ routerRtpCapabilities: rtpCapabilities });
        deviceRef.current = device;

        const transportOptions = await rpcRef.current.request<mediasoupClientTypes.TransportOptions>({
          type: 'sfu:create-transport',
          sessionId: activeSessionId,
          role: 'receiver',
          receiverId: receiverIdRef.current,
        });

        const recvTransport = device.createRecvTransport({
          ...transportOptions,
          iceServers: getConfiguredIceServers(),
        });

        recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
          rpcRef.current
            .request({
              type: 'sfu:connect-transport',
              sessionId: activeSessionId,
              role: 'receiver',
              receiverId: receiverIdRef.current,
              transportId: recvTransport.id,
              dtlsParameters,
            })
            .then(() => callback())
            .catch((err) => errback(err instanceof Error ? err : new Error('Recv transport connect failed')));
        });

        recvTransport.on('connectionstatechange', (state) => {
          if (state === 'connected') {
            setReconnectAttempt(0);
          } else if (state === 'disconnected' || state === 'failed') {
            if (!isIntentionalCloseRef.current) {
              triggerReconnectRef.current();
            }
          }
        });

        recvTransportRef.current = recvTransport;
        return { device, transport: recvTransport };
      })();

      recvTransportPromiseRef.current = promise;
      try {
        return await promise;
      } finally {
        if (recvTransportPromiseRef.current === promise) {
          recvTransportPromiseRef.current = null;
        }
      }
    },
    []
  );

  const consumeProducer = useCallback(
    async (activeSessionId: string, producerId: string) => {
      const { device, transport } = await ensureRecvTransport(activeSessionId);

      const consumerParams = await rpcRef.current.request<{
        id: string;
        producerId: string;
        kind: 'audio' | 'video';
        rtpParameters: mediasoupClientTypes.RtpParameters;
      }>({
        type: 'sfu:consume',
        sessionId: activeSessionId,
        receiverId: receiverIdRef.current,
        producerId,
        rtpCapabilities: device.rtpCapabilities,
      });

      // Replace any previous consumer of the same kind cleanly
      const oldConsumer = consumersRef.current.get(consumerParams.kind);
      if (oldConsumer && !oldConsumer.closed) {
        oldConsumer.close();
      }

      const consumer = await transport.consume({
        id: consumerParams.id,
        producerId: consumerParams.producerId,
        kind: consumerParams.kind,
        rtpParameters: consumerParams.rtpParameters,
      });

      consumersRef.current.set(consumer.kind, consumer);

      await rpcRef.current.request({
        type: 'sfu:resume-consumer',
        sessionId: activeSessionId,
        receiverId: receiverIdRef.current,
        consumerId: consumer.id,
      });

      const tracks: MediaStreamTrack[] = [];
      consumersRef.current.forEach((c) => {
        if (!c.closed && c.track) {
          tracks.push(c.track);
        }
      });

      if (tracks.length > 0) {
        setRemoteStream(new MediaStream(tracks));
        setConnectionStatus('connected');
      }
    },
    [ensureRecvTransport]
  );

  const connectToSession = useCallback(
    (
      overrideSessionId?: string,
      overridePin?: string,
      overrideToken?: string,
      overrideReceiverId?: string
    ) => {
      const targetSessionId = overrideSessionId || currentSessionIdRef.current;
      const targetPin = overridePin || currentPinRef.current;
      if (overrideToken) receiverTokenRef.current = overrideToken;
      if (overrideReceiverId) receiverIdRef.current = overrideReceiverId;

      if (!targetPin && !receiverTokenRef.current) {
        setConnectionStatus('error');
        setErrorMessage('Please enter a 6-digit PIN');
        return;
      }

      if (overrideSessionId) currentSessionIdRef.current = overrideSessionId;
      if (overridePin) currentPinRef.current = overridePin;

      isIntentionalCloseRef.current = false;
      setConnectionStatus('connecting');
      setErrorMessage(null);

      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      cleanupReceiverTransport();

      try {
        const ws = new WebSocket(getWsUrl());
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: 'join-session',
              sessionId: targetSessionId || 'lookup',
              pin: targetPin,
              receiverId: receiverIdRef.current,
              receiverToken: receiverTokenRef.current || undefined,
              deviceName,
              deviceType,
            })
          );
        };

        ws.onmessage = async (event) => {
          try {
            const msg: SignalMessage = JSON.parse(event.data);
            if (rpcRef.current.handleReply(msg)) return;

            switch (msg.type) {
              case 'joined-success': {
                if (msg.sessionId) currentSessionIdRef.current = msg.sessionId;
                if (msg.receiverId) receiverIdRef.current = msg.receiverId;
                if (msg.receiverToken) receiverTokenRef.current = msg.receiverToken;

                setReconnectAttempt(0);
                setSenderInfo({
                  name: msg.senderName || 'UniversalCast Sender',
                  mediaType: msg.mediaType || 'screen',
                });

                const resolvedSessionId = msg.sessionId || targetSessionId || '';
                const producers: SfuProducerSummary[] = Array.isArray(msg.activeProducers)
                  ? msg.activeProducers
                  : [];

                if (producers.length > 0 && resolvedSessionId) {
                  for (const prod of producers) {
                    await consumeProducer(resolvedSessionId, prod.producerId);
                  }
                } else {
                  setConnectionStatus('waiting');
                }
                break;
              }

              case 'join-error': {
                isIntentionalCloseRef.current = true;
                setConnectionStatus('error');
                setErrorMessage(msg.error || 'Failed to join session');
                ws.close();
                break;
              }

              case 'sfu:new-producer': {
                const activeSid = msg.sessionId || currentSessionIdRef.current;
                if (activeSid && msg.producerId) {
                  await consumeProducer(activeSid, msg.producerId);
                }
                break;
              }

              case 'stream-stopped': {
                consumersRef.current.forEach((c) => {
                  try {
                    c.close();
                  } catch {
                    // ignore
                  }
                });
                consumersRef.current.clear();
                setRemoteStream(null);
                setConnectionStatus('waiting');
                break;
              }

              case 'disconnect-receiver': {
                isIntentionalCloseRef.current = true;
                setConnectionStatus('kicked');
                setErrorMessage('The sender host has disconnected this device.');
                cleanupReceiverTransport();
                setRemoteStream(null);
                break;
              }

              case 'session-ended': {
                isIntentionalCloseRef.current = true;
                setConnectionStatus('disconnected');
                setErrorMessage('The casting session was ended by the host.');
                cleanupReceiverTransport();
                setRemoteStream(null);
                break;
              }
            }
          } catch (e) {
            console.error('Receiver SFU signaling error:', e);
          }
        };

        ws.onclose = () => {
          rpcRef.current.rejectAll('Receiver signaling closed');
          if (!isIntentionalCloseRef.current) {
            triggerReconnectRef.current();
          }
        };

        ws.onerror = () => {
          if (!isIntentionalCloseRef.current) {
            triggerReconnectRef.current();
          }
        };
      } catch (e) {
        setConnectionStatus('error');
        setErrorMessage(e instanceof Error ? e.message : 'Connection failed');
      }
    },
    [deviceName, deviceType, cleanupReceiverTransport, consumeProducer]
  );

  const triggerReconnect = useCallback(() => {
    if (isIntentionalCloseRef.current) return;

    setConnectionStatus('reconnecting');
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    setReconnectAttempt((prev) => {
      const nextAttempt = prev + 1;
      const maxAttempts = 5;

      if (nextAttempt > maxAttempts) {
        setConnectionStatus('error');
        setErrorMessage(
          'Connection to the host broadcast was lost. Unable to reconnect after 5 attempts. Please check your network and retry.'
        );
        return prev;
      }

      const backoffDelay = Math.min(1000 * Math.pow(1.5, nextAttempt - 1), 6000);
      reconnectTimeoutRef.current = setTimeout(() => {
        connectToSession();
      }, backoffDelay);

      return nextAttempt;
    });
  }, [connectToSession]);

  useEffect(() => {
    triggerReconnectRef.current = triggerReconnect;
  }, [triggerReconnect]);

  // Real telemetry collection from mediasoup Consumer stats
  useEffect(() => {
    if (connectionStatus !== 'connected' && connectionStatus !== 'waiting') return;

    const interval = setInterval(async () => {
      let currentLatency = 15;
      let currentFps = 60;
      let currentResolution = '1080p';
      let currentCodec = 'H.264 / Opus';

      const videoConsumer = consumersRef.current.get('video');
      if (videoConsumer && !videoConsumer.closed) {
        try {
          const statsReport = await videoConsumer.getStats();
          statsReport.forEach((report) => {
            if (report.type === 'inbound-rtp' && report.kind === 'video') {
              if (report.framesPerSecond) currentFps = Math.round(report.framesPerSecond);
              if (report.frameWidth && report.frameHeight) {
                currentResolution = `${report.frameWidth}x${report.frameHeight}`;
              }
              if (report.jitter) currentLatency = Math.max(1, Math.round(report.jitter * 1000));
            }
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              if (report.currentRoundTripTime) {
                currentLatency = Math.max(1, Math.round(report.currentRoundTripTime * 1000));
              }
            }
            if (report.type === 'codec' && report.mimeType) {
              currentCodec = report.mimeType.replace('video/', '').toUpperCase();
            }
          });
        } catch {
          // Ignore getStats error during transient track switches
        }
      }

      if (remoteStream) {
        const videoTrack = remoteStream.getVideoTracks()[0];
        if (videoTrack) {
          const settings = videoTrack.getSettings();
          if (settings.width && settings.height) {
            currentResolution = `${settings.width}x${settings.height}`;
          }
          if (settings.frameRate) {
            currentFps = Math.round(settings.frameRate);
          }
        }
      }

      setStats({
        latencyMs: currentLatency,
        fps: currentFps,
        resolution: currentResolution,
        codec: currentCodec,
      });

      if (wsRef.current?.readyState === WebSocket.OPEN && currentSessionIdRef.current) {
        wsRef.current.send(
          JSON.stringify({
            type: 'stats-update',
            sessionId: currentSessionIdRef.current,
            receiverId: receiverIdRef.current,
            stats: {
              latencyMs: currentLatency,
              fps: currentFps,
            },
          })
        );
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [connectionStatus, remoteStream]);

  const leaveSession = useCallback((nextStatus: 'disconnected' | 'idle' = 'disconnected') => {
    isIntentionalCloseRef.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    cleanupReceiverTransport();

    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN && currentSessionIdRef.current) {
        wsRef.current.send(
          JSON.stringify({
            type: 'receiver-left',
            sessionId: currentSessionIdRef.current,
            receiverId: receiverIdRef.current,
          })
        );
      }
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    receiverTokenRef.current = null;
    setRemoteStream(null);
    setConnectionStatus(nextStatus);
    setErrorMessage(null);
    setReconnectAttempt(0);
  }, [cleanupReceiverTransport]);

  const retry = useCallback(() => {
    setReconnectAttempt(0);
    connectToSession();
  }, [connectToSession]);

  useEffect(() => {
    return () => {
      isIntentionalCloseRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      cleanupReceiverTransport();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [cleanupReceiverTransport]);

  return {
    remoteStream,
    connectionStatus,
    errorMessage,
    reconnectAttempt,
    senderInfo,
    stats,
    connectToSession,
    leaveSession,
    retry,
    receiverId: receiverIdRef.current,
  };
}
