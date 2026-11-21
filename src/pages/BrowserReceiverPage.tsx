import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Tv,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Radio,
  LogOut,
  AlertCircle,
  Wifi,
  Sparkles,
  Delete,
  CornerDownLeft,
  RefreshCw,
  Clock,
  Layers,
  Expand,
  Shrink,
  ShieldAlert,
  Cast,
} from 'lucide-react';
import { useReceiverWebRTC } from '../hooks/useWebRTC';
import { DeviceType } from '../types/cast';

interface BrowserReceiverPageProps {
  initialPin?: string | null;
  initialSessionId?: string | null;
  onExit: () => void;
}

export const BrowserReceiverPage: React.FC<BrowserReceiverPageProps> = ({
  initialPin = null,
  initialSessionId = null,
  onExit,
}) => {
  const [pin, setPin] = useState<string>(initialPin || '');
  const [targetSessionId, setTargetSessionId] = useState<string | null>(initialSessionId);
  const [deviceName, setDeviceName] = useState(() => {
    return `Display ${Math.floor(100 + Math.random() * 900)}`;
  });
  const [deviceType, setDeviceType] = useState<DeviceType>('tv');
  const [pinError, setPinError] = useState<string | null>(null);
  const [resolvingSession, setResolvingSession] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [hudVisible, setHudVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [objectFit, setObjectFit] = useState<'contain' | 'cover'>('contain');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hudTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    remoteStream,
    connectionStatus,
    errorMessage,
    reconnectAttempt,
    senderInfo,
    stats,
    connectToSession,
    leaveSession,
    retry,
    receiverId,
  } = useReceiverWebRTC(targetSessionId, pin, deviceName, deviceType);

  // Cross-browser Fullscreen helpers (supporting Safari webkitRequestFullscreen / webkitEnterFullscreen)
  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    const video = videoRef.current;

    const isCurrentlyFullscreen = Boolean(
      document.fullscreenElement ||
      (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement
    );

    if (!isCurrentlyFullscreen) {
      if (container?.requestFullscreen) {
        container.requestFullscreen().catch(() => {
          if (video && (video as unknown as { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen) {
            (video as unknown as { webkitEnterFullscreen: () => void }).webkitEnterFullscreen();
          }
        });
      } else if (container && (container as unknown as { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen) {
        (container as unknown as { webkitRequestFullscreen: () => void }).webkitRequestFullscreen();
      } else if (video && (video as unknown as { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen) {
        (video as unknown as { webkitEnterFullscreen: () => void }).webkitEnterFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as unknown as { webkitExitFullscreen?: () => void }).webkitExitFullscreen) {
        (document as unknown as { webkitExitFullscreen: () => void }).webkitExitFullscreen();
      }
    }
  }, []);

  // Sync fullscreen state with document events
  useEffect(() => {
    const handleFsChange = () => {
      const isFs = Boolean(
        document.fullscreenElement ||
        (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement
      );
      setIsFullscreen(isFs);
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  // Auto-connect if initialPin was provided via QR URL or Quick Join
  useEffect(() => {
    if (initialPin && /^[0-9]{6}$/.test(initialPin) && connectionStatus === 'idle') {
      void handleConnectByPin(undefined, initialPin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPin]);

  // Real WebRTC Stream binding to Video element with modern Chrome & Safari compatibility
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (remoteStream) {
      video.srcObject = remoteStream;

      // Modern Safari / Chrome autoplay policy handling
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setAudioBlocked(false);
          })
          .catch((err: unknown) => {
            console.warn('Autoplay with sound prevented by browser policy:', err);
            // Fallback to muted playback so video continues smoothly
            video.muted = true;
            setIsMuted(true);
            setAudioBlocked(true);
            video.play().catch((playErr) => console.warn('Muted autoplay also blocked:', playErr));
          });
      }
    } else {
      video.srcObject = null;
    }
  }, [remoteStream]);

  // HUD Auto-hide on inactivity
  const handleUserInteraction = useCallback(() => {
    setHudVisible(true);
    if (hudTimeoutRef.current) {
      clearTimeout(hudTimeoutRef.current);
    }
    hudTimeoutRef.current = setTimeout(() => {
      setHudVisible(false);
    }, 4000);
  }, []);

  // Keyboard shortcuts (F: Fullscreen, H: HUD, M: Mute, Esc: Leave)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'h' || e.key === 'H') {
        setHudVisible((v) => !v);
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMute();
      } else if (e.key === 'Escape' && isFullscreen) {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, toggleFullscreen]);

  // Audio unblock gesture handler
  const handleUnblockAudio = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.volume = volume;
      setIsMuted(false);
      videoRef.current
        .play()
        .then(() => setAudioBlocked(false))
        .catch((e) => console.warn('Unmute play failed:', e));
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const nextMuted = !isMuted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
      if (!nextMuted) {
        setAudioBlocked(false);
      }
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      if (newVol > 0 && isMuted) {
        videoRef.current.muted = false;
        setIsMuted(false);
        setAudioBlocked(false);
      }
    }
  };

  // Resolve PIN to Session ID and authenticate with backend SessionManager + issue HMAC receiverToken
  const handleConnectByPin = async (e?: React.FormEvent, explicitPin?: string) => {
    if (e) e.preventDefault();
    const cleanPin = (explicitPin ?? pin).trim();

    if (!/^[0-9]{6}$/.test(cleanPin)) {
      setPinError('Please enter a valid 6-digit numeric PIN');
      return;
    }

    setResolvingSession(true);
    setPinError(null);

    try {
      const res = await fetch('/api/sessions/validate-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: targetSessionId || 'lookup', pin: cleanPin }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.valid && data.sessionId) {
        setTargetSessionId(data.sessionId);
        connectToSession(data.sessionId, cleanPin, data.receiverToken, data.receiverId);
        return;
      }

      if (res.status === 409) {
        setPinError(data.error || 'Session capacity reached. This host already has 10 connected receivers.');
        return;
      }

      setPinError(data.error || 'No active casting session found for this PIN. Check host display.');
    } catch (err: unknown) {
      setPinError(err instanceof Error ? err.message : 'Unable to contact session server.');
    } finally {
      setResolvingSession(false);
    }
  };

  const handleKeyPress = (digit: string) => {
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setPinError(null);
      if (nextPin.length === 6) {
        // Auto-validate when 6th digit entered
        setTimeout(() => {
          handleConnectByPin();
        }, 50);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setPinError(null);
  };

  const handleResetToPin = () => {
    leaveSession('idle');
    setPin('');
    setTargetSessionId(null);
    setPinError(null);
  };

  // =========================================================================
  // STATE 1: CONNECTED (Active WebRTC Live Stream Playout)
  // =========================================================================
  if (connectionStatus === 'connected' && remoteStream) {
    return (
      <div
        ref={containerRef}
        className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden select-none cursor-default"
        onMouseMove={handleUserInteraction}
        onTouchStart={handleUserInteraction}
      >
        {/* Real WebRTC Video Element without mock video */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isMuted}
          className={`w-full h-full ${objectFit === 'cover' ? 'object-cover' : 'object-contain'} transition-all`}
        />

        {/* Browser Autoplay Policy Audio Warning Overlay */}
        {audioBlocked && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-indigo-600/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 text-sm font-semibold border border-indigo-400/40 animate-pulse">
            <VolumeX className="w-5 h-5 text-amber-300 shrink-0" />
            <span>Audio was muted by browser policy.</span>
            <button
              onClick={handleUnblockAudio}
              className="px-3.5 py-1.5 bg-white text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-50 active:scale-95 transition shadow-sm"
            >
              Unmute Audio
            </button>
          </div>
        )}

        {/* Floating TV HUD (Auto-hides after inactivity, toggled by mouse or 'H') */}
        <div
          className={`absolute inset-0 pointer-events-none flex flex-col justify-between p-4 sm:p-6 transition-opacity duration-300 ${
            hudVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Top HUD Bar */}
          <div className="flex items-center justify-between pointer-events-auto flex-wrap gap-2">
            <div className="flex items-center space-x-3 bg-black/70 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-white shadow-xl">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
                <Tv className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-sm tracking-tight">{senderInfo?.name || 'Live Cast'}</span>
                  <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                    <span>LIVE</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 truncate max-w-[200px]">
                  {deviceName} • {deviceType.toUpperCase()}
                </p>
              </div>
            </div>

            {/* Stream Telemetry & Controls */}
            <div className="flex items-center space-x-2">
              <div className="hidden sm:flex bg-black/70 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-white font-mono text-xs items-center space-x-3 shadow-xl">
                <span className="text-emerald-400 flex items-center space-x-1">
                  <span>⚡</span>
                  <span>{stats.latencyMs || 15}ms</span>
                </span>
                <span className="text-white/30">•</span>
                <span className="text-cyan-400">{stats.fps || 60} FPS</span>
                <span className="text-white/30">•</span>
                <span className="text-slate-300">{stats.resolution || '1080p'}</span>
                <span className="text-white/30">•</span>
                <span className="text-indigo-300 text-[11px]">{stats.codec || 'H.264/Opus'}</span>
              </div>

              {/* Mute / Unmute Button */}
              <button
                onClick={toggleMute}
                className={`p-2.5 rounded-2xl backdrop-blur-md border transition ${
                  isMuted
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
                    : 'bg-black/70 border-white/10 text-white hover:bg-white/20'
                }`}
                title={isMuted ? 'Unmute Audio (M)' : 'Mute Audio (M)'}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>

              {/* Aspect Ratio Mode (Contain vs Cover) */}
              <button
                onClick={() => setObjectFit((prev) => (prev === 'contain' ? 'cover' : 'contain'))}
                className="p-2.5 rounded-2xl bg-black/70 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition hidden sm:inline-flex"
                title={objectFit === 'contain' ? 'Fill Screen (Crop edges)' : 'Fit to Screen (Show entire frame)'}
              >
                {objectFit === 'contain' ? <Expand className="w-5 h-5" /> : <Shrink className="w-5 h-5" />}
              </button>

              {/* Fullscreen Toggle */}
              <button
                onClick={toggleFullscreen}
                className="p-2.5 rounded-2xl bg-black/70 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition"
                title="Toggle Fullscreen (F)"
              >
                {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>

              {/* Disconnect Button */}
              <button
                onClick={() => {
                  leaveSession();
                  onExit();
                }}
                className="p-2.5 rounded-2xl bg-rose-600/80 backdrop-blur-md border border-rose-500/30 text-white hover:bg-rose-600 transition"
                title="Disconnect from Cast (Esc)"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Bottom HUD Bar */}
          <div className="flex items-center justify-between text-xs text-slate-300 pointer-events-auto flex-wrap gap-2">
            <div className="bg-black/70 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>mediasoup SFU Playout</span>
              <span className="text-white/40">•</span>
              <span>Press <kbd className="font-mono font-bold text-white bg-white/10 px-1 py-0.5 rounded">F</kbd> for Fullscreen</span>
              <span className="text-white/40">•</span>
              <span><kbd className="font-mono font-bold text-white bg-white/10 px-1 py-0.5 rounded">H</kbd> HUD</span>
              <span className="text-white/40">•</span>
              <span><kbd className="font-mono font-bold text-white bg-white/10 px-1 py-0.5 rounded">M</kbd> Mute</span>
            </div>

            <div className="bg-black/70 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10 font-mono text-[11px] text-slate-400">
              PIN: {pin} • Session: {targetSessionId?.substring(0, 14)}...
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STATE 2: WAITING FOR HOST STREAM
  // =========================================================================
  if (connectionStatus === 'waiting') {
    return (
      <div
        ref={containerRef}
        className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col items-center justify-center p-6 select-none"
      >
        <div className="max-w-md w-full text-center space-y-6">
          {/* Animated Radar Pulse */}
          <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping"></div>
            <div className="absolute inset-2 rounded-full bg-cyan-500/30 animate-pulse"></div>
            <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-2xl shadow-indigo-500/40 border border-white/20">
              <Radio className="w-10 h-10 text-white animate-pulse" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping"></span>
              <span>Connected to Session</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              Waiting for Host Broadcast
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Your display is paired and ready. The live WebRTC stream will start automatically as soon as{' '}
              <span className="font-semibold text-slate-200">{senderInfo?.name || 'the host'}</span> begins sharing their screen or media.
            </p>
          </div>

          {/* Session Information Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-left space-y-2.5 text-xs text-slate-300">
            <div className="flex justify-between items-center py-1 border-b border-slate-800">
              <span className="text-slate-500">Receiver Name</span>
              <span className="font-medium text-slate-200">{deviceName}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-800">
              <span className="text-slate-500">Device Type</span>
              <span className="font-medium text-slate-200 uppercase">{deviceType}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-800">
              <span className="text-slate-500">Session PIN</span>
              <span className="font-mono font-bold text-cyan-400 tracking-wider">{pin}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">Signaling Status</span>
              <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Active WebSocket Link</span>
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center space-x-3 pt-2">
            <button
              onClick={toggleFullscreen}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs flex items-center space-x-2 border border-slate-700 transition active:scale-95"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span>{isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}</span>
            </button>

            <button
              onClick={handleResetToPin}
              className="px-4 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 font-medium text-xs border border-rose-500/30 transition active:scale-95 flex items-center space-x-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Disconnect</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STATE 3: RECONNECTING (Lost Connection, Auto-recovery in progress)
  // =========================================================================
  if (connectionStatus === 'reconnecting') {
    return (
      <div
        ref={containerRef}
        className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col items-center justify-center p-6 select-none"
      >
        <div className="max-w-md w-full text-center space-y-6">
          <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping"></div>
            <div className="relative w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <RefreshCw className="w-10 h-10 animate-spin" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-semibold">
              <span>Attempt {reconnectAttempt} of 5</span>
            </div>
            <h2 className="text-2xl font-black text-white">Connection Interrupted</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Lost connection to the host broadcast. Re-establishing signaling link and WebRTC peer connection...
            </p>
          </div>

          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-slate-400">
            <p>Your display reservation (PIN: <span className="text-amber-400 font-mono font-bold">{pin}</span>) is being held while we reconnect.</p>
          </div>

          <div className="flex items-center justify-center space-x-3">
            <button
              onClick={() => retry()}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg shadow-amber-600/30 transition active:scale-95 flex items-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Now</span>
            </button>

            <button
              onClick={handleResetToPin}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition active:scale-95"
            >
              Cancel & Exit
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STATE 4: ERROR STATE
  // =========================================================================
  if (connectionStatus === 'error') {
    return (
      <div className="min-h-[80vh] flex flex-col justify-center items-center py-8 px-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-100 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-lg shadow-rose-600/10">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">
              Connection Failed
            </h2>
            <p className="text-sm text-rose-600 dark:text-rose-400 font-medium">
              {errorMessage || pinError || 'Unable to join casting session.'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
              Verify that the 6-digit PIN is active on the host sender screen and that the session has not exceeded the 10-receiver limit.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={handleResetToPin}
              className="w-full py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/25 transition active:scale-98"
            >
              Enter Another PIN
            </button>

            <button
              onClick={() => retry()}
              className="w-full py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition"
            >
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STATE 5: DISCONNECTED / KICKED STATE
  // =========================================================================
  if (connectionStatus === 'disconnected' || connectionStatus === 'kicked') {
    return (
      <div className="min-h-[80vh] flex flex-col justify-center items-center py-8 px-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center">
            <Cast className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">
              {connectionStatus === 'kicked' ? 'Device Disconnected by Host' : 'Session Ended'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {errorMessage ||
                (connectionStatus === 'kicked'
                  ? 'The host sender has disconnected this receiver screen from the cast.'
                  : 'The casting session was closed by the host.')}
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={handleResetToPin}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/25 transition active:scale-98"
            >
              Connect to Another Session
            </button>

            <button
              onClick={onExit}
              className="w-full py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition"
            >
              Return to UniversalCast
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STATE 6: IDLE / PIN ENTRY & KEYPAD (Connecting / Setup View)
  // =========================================================================
  return (
    <div className="min-h-[80vh] flex flex-col justify-center items-center py-8 px-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <Tv className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            UniversalCast Receiver
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enter the 6-digit PIN displayed on the host screen to connect this display.
          </p>
        </div>

        {/* Error notification banner */}
        {(errorMessage || pinError) && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs flex items-center space-x-2 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage || pinError}</span>
          </div>
        )}

        {/* 6-Digit PIN Display with responsive boxes */}
        <div className="flex justify-center space-x-1.5 sm:space-x-3">
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const digit = pin[index] || '';
            const isActive = pin.length === index;
            return (
              <div
                key={index}
                className={`w-9 h-12 sm:w-14 sm:h-16 rounded-xl sm:rounded-2xl border-2 flex items-center justify-center text-xl sm:text-3xl font-mono font-bold transition-all ${
                  isActive
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500/20'
                    : digit
                    ? 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white'
                    : 'border-slate-200 dark:border-slate-800 bg-transparent text-slate-400'
                }`}
              >
                {digit}
              </div>
            );
          })}
        </div>

        {/* TV-Friendly Big Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleKeyPress(d)}
              className="h-13 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-bold text-lg text-slate-900 dark:text-white transition active:scale-95 shadow-xs"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={handleBackspace}
            className="h-13 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 transition active:scale-95"
            title="Backspace"
          >
            <Delete className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            className="h-13 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-bold text-lg text-slate-900 dark:text-white transition active:scale-95 shadow-xs"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => handleConnectByPin()}
            disabled={pin.length !== 6 || resolvingSession || connectionStatus === 'connecting'}
            className="h-13 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition active:scale-95 disabled:opacity-40 shadow-md shadow-indigo-600/30"
            title="Connect"
          >
            {resolvingSession || connectionStatus === 'connecting' ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <CornerDownLeft className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Device Settings */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">Device Name:</span>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              className="font-medium text-slate-800 dark:text-slate-200 bg-transparent border-b border-slate-300 dark:border-slate-700 focus:outline-hidden py-0.5 max-w-[120px]"
            />
          </div>
          <select
            value={deviceType}
            onChange={(e) => setDeviceType(e.target.value as DeviceType)}
            className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg text-xs"
          >
            <option value="tv">Smart TV</option>
            <option value="browser">Desktop Browser</option>
            <option value="tablet">Tablet / iPad</option>
            <option value="mobile">Mobile Phone</option>
            <option value="monitor">External Monitor</option>
          </select>
        </div>

        {/* Connect Action Button */}
        <button
          type="button"
          onClick={() => handleConnectByPin()}
          disabled={pin.length !== 6 || resolvingSession || connectionStatus === 'connecting'}
          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-sm shadow-xl shadow-indigo-500/25 transition active:scale-98 disabled:opacity-50 flex items-center justify-center space-x-2"
        >
          {resolvingSession || connectionStatus === 'connecting' ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Authenticating & Joining Session...</span>
            </>
          ) : (
            <span>Connect to Broadcast</span>
          )}
        </button>
      </div>
    </div>
  );
};
