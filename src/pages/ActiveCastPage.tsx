import React, { useEffect, useRef, useState } from 'react';
import {
  Monitor,
  Film,
  Image as ImageIcon,
  Music,
  Radio,
  Tv,
  Users,
  Mic,
  MicOff,
  Pause,
  Play,
  Square,
  Maximize2,
  Copy,
  Check,
  Trash2,
  Plus,
  Cpu,
  Wifi,
  ChevronRight,
  AlertTriangle,
  QrCode,
  Smartphone,
  Tablet,
  ExternalLink,
} from 'lucide-react';
import { CastSession, SessionReceiver, DeviceType } from '../types/cast';
import { QRCodeDisplay } from '../components/QRCodeDisplay';

interface ActiveCastPageProps {
  session: CastSession;
  activeReceivers: SessionReceiver[];
  localStream: MediaStream | null;
  isStreaming: boolean;
  onStartScreenCapture: () => Promise<MediaStream>;
  onStartMediaElementCapture: (el: HTMLVideoElement | HTMLAudioElement, type: 'video' | 'music') => Promise<MediaStream>;
  onDisconnectReceiver: (id: string) => void;
  onStopStream?: () => void;
  onEndSession: () => void;
  onShowPairingModal: () => void;
}

export const ActiveCastPage: React.FC<ActiveCastPageProps> = ({
  session,
  activeReceivers,
  localStream,
  isStreaming,
  onStartScreenCapture,
  onStartMediaElementCapture,
  onDisconnectReceiver,
  onStopStream,
  onEndSession,
  onShowPairingModal,
}) => {
  const [duration, setDuration] = useState(0);
  const [audioMuted, setAudioMuted] = useState(false);
  const [streamPaused, setStreamPaused] = useState(false);
  const [activeMediaTab, setActiveMediaTab] = useState<'screen' | 'video' | 'photo' | 'music'>(session.mediaType);
  const [copiedPin, setCopiedPin] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  // Video casting state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const localPreviewRef = useRef<HTMLVideoElement | null>(null);

  // Photo casting state
  const [photoIndex, setPhotoIndex] = useState(0);
  const samplePhotos = [
    { title: 'Project Architecture Diagram', url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&auto=format&fit=crop&q=80' },
    { title: 'Quarterly Metric Analytics', url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&auto=format&fit=crop&q=80' },
    { title: 'Product Showcase 4K', url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&auto=format&fit=crop&q=80' },
  ];

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Bind localStream to preview element
  useEffect(() => {
    if (localPreviewRef.current && localStream) {
      localPreviewRef.current.srcObject = localStream;
      localPreviewRef.current.play().catch((e) => console.log('Autoplay handled:', e));
    }
  }, [localStream]);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleToggleScreenShare = async () => {
    setCaptureError(null);
    try {
      await onStartScreenCapture();
      setActiveMediaTab('screen');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Screen capture was cancelled';
      setCaptureError(msg);
    }
  };

  const handleToggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = audioMuted;
      });
      setAudioMuted(!audioMuted);
    }
  };

  const handleTogglePause = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = streamPaused;
      });
      setStreamPaused(!streamPaused);
    }
  };

  const copyPin = () => {
    navigator.clipboard.writeText(session.pin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  const getDeviceIcon = (type: DeviceType) => {
    switch (type) {
      case 'tv':
        return Tv;
      case 'tablet':
        return Tablet;
      case 'mobile':
        return Smartphone;
      default:
        return Monitor;
    }
  };

  return (
    <div className="space-y-6 py-4">
      {/* Top Session Control Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-11 h-11 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 flex items-center justify-center">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900 animate-ping"></span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white truncate max-w-xs sm:max-w-md">
                {session.title}
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 text-[10px] font-bold uppercase tracking-wide">
                Live Broadcast
              </span>
            </div>
            <div className="flex items-center space-x-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                ⏱ {formatTime(duration)}
              </span>
              <span>•</span>
              <span className="capitalize">{activeMediaTab} Source</span>
              <span>•</span>
              <span className="text-emerald-500 font-medium">H.264 WebRTC</span>
            </div>
          </div>
        </div>

        {/* Pairing info & End button */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div
            onClick={copyPin}
            className="cursor-pointer flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 transition"
            title="Click to copy 6-digit PIN"
          >
            <span className="text-[10px] text-slate-400 font-semibold uppercase">PIN:</span>
            <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">
              {session.pin}
            </span>
            {copiedPin ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
          </div>

          <button
            onClick={onShowPairingModal}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition border border-indigo-200 dark:border-indigo-900"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Pairing QR</span>
          </button>

          <div className="flex items-center space-x-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold">
            <Users className="w-3.5 h-3.5 text-indigo-500" />
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
              {activeReceivers.length}
            </span>
            <span className="text-slate-400">/ 10</span>
          </div>

          <a
            href={`${window.location.origin}?tab=receiver&pin=${session.pin}&session=${session.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition border border-emerald-200 dark:border-emerald-900 shadow-xs"
            title="Open receiver in a new window or tab to test screen mirroring"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Test Receiver (New Tab)</span>
            <span className="sm:hidden">Receiver</span>
          </a>

          <button
            onClick={onEndSession}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/30 transition active:scale-98"
          >
            <Square className="w-3.5 h-3.5" />
            <span>End Session</span>
          </button>
        </div>
      </div>

      {captureError && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>{captureError}</span>
        </div>
      )}

      {/* Main Broadcast Studio Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Real Live Stream Monitor */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl aspect-video flex items-center justify-center group">
            {/* Real Screen/Video preview */}
            {localStream ? (
              <video
                ref={localPreviewRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain bg-black"
              />
            ) : activeMediaTab === 'photo' ? (
              <div className="relative w-full h-full flex flex-col items-center justify-center p-4">
                <img
                  src={samplePhotos[photoIndex].url}
                  alt={samplePhotos[photoIndex].title}
                  className="max-h-[85%] max-w-full object-contain rounded-xl shadow-2xl transition-all"
                />
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl text-white text-xs">
                  <span>{samplePhotos[photoIndex].title}</span>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setPhotoIndex((p) => (p > 0 ? p - 1 : samplePhotos.length - 1))}
                      className="px-2 py-1 rounded bg-white/20 hover:bg-white/30"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setPhotoIndex((p) => (p + 1) % samplePhotos.length)}
                      className="px-2 py-1 rounded bg-white/20 hover:bg-white/30"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            ) : activeMediaTab === 'music' ? (
              <div className="text-center p-8 space-y-4">
                <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-xl shadow-emerald-500/25 animate-pulse">
                  <Music className="w-10 h-10" />
                </div>
                <h3 className="text-white font-bold text-lg">UniversalCast Audio Stream</h3>
                <p className="text-slate-400 text-xs">Broadcasting Opus lossless audio stream to all 10 receivers</p>
                {/* Visualizer bars */}
                <div className="flex items-end justify-center space-x-1.5 h-16 pt-4">
                  {[40, 75, 30, 90, 60, 85, 45, 95, 70, 50, 80, 65, 90, 40].map((h, i) => (
                    <div
                      key={i}
                      className="w-2 bg-gradient-to-t from-emerald-500 to-cyan-400 rounded-full animate-bounce"
                      style={{ height: `${h}%`, animationDelay: `${i * 0.08}s` }}
                    ></div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center p-8 max-w-md space-y-4">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-400 flex items-center justify-center">
                  <Monitor className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base">Ready to Mirror Screen</h3>
                  <p className="text-slate-400 text-xs mt-1">
                    Click "Start Screen Capture" to broadcast your screen, app window, or browser tab via WebRTC.
                  </p>
                </div>
                <button
                  onClick={handleToggleScreenShare}
                  className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition active:scale-98"
                >
                  Start Screen Capture
                </button>
              </div>
            )}

            {/* In-Monitor Controls Overlay */}
            <div className="absolute top-4 left-4 flex items-center space-x-2">
              <span className="px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-md text-white text-[11px] font-mono border border-white/10">
                1080p @ 60 FPS
              </span>
              {streamPaused && (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/80 text-white text-[10px] font-bold uppercase">
                  Paused
                </span>
              )}
            </div>

            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-white">
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleToggleScreenShare}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>{localStream ? 'Switch Screen' : 'Capture Screen'}</span>
                </button>

                {localStream && onStopStream && (
                  <button
                    onClick={onStopStream}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-xs"
                    title="Stop screen sharing"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Stop Sharing</span>
                  </button>
                )}

                {localStream && (
                  <>
                    <button
                      onClick={handleTogglePause}
                      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                      title={streamPaused ? 'Resume video' : 'Pause video'}
                    >
                      {streamPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={handleToggleAudio}
                      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                      title={audioMuted ? 'Unmute microphone/audio' : 'Mute audio'}
                    >
                      {audioMuted ? <MicOff className="w-4 h-4 text-rose-400" /> : <Mic className="w-4 h-4" />}
                    </button>
                  </>
                )}
              </div>

              <div className="flex items-center space-x-3 text-xs text-slate-300">
                <span className="font-mono text-[11px]">Bitrate: ~4.1 Mbps</span>
                <button
                  onClick={() => {
                    if (localPreviewRef.current?.requestFullscreen) {
                      localPreviewRef.current.requestFullscreen();
                    }
                  }}
                  className="p-1.5 hover:text-white"
                  title="Fullscreen preview"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Media Switcher Tabs */}
          <div className="flex items-center space-x-2 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
            {[
              { id: 'screen' as const, label: 'Screen Mirror', icon: Monitor },
              { id: 'photo' as const, label: 'Photo Slides', icon: ImageIcon },
              { id: 'music' as const, label: 'Music Stream', icon: Music },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeMediaTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveMediaTab(tab.id);
                    if (tab.id === 'screen' && !localStream) {
                      handleToggleScreenShare();
                    }
                  }}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-xl text-xs font-bold transition ${
                    active
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Col: 10-Receiver Fleet Matrix */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                  <Tv className="w-4 h-4 text-indigo-500" />
                  <span>Receiver Fleet Matrix</span>
                </h3>
                <p className="text-[11px] text-slate-400">10 Receiver Hardware Limit</p>
              </div>
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900">
                {activeReceivers.length} / 10
              </span>
            </div>

            {/* 10 Receiver Slots Grid */}
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {/* Connected Receivers */}
              {activeReceivers.map((rec, idx) => {
                const DeviceIcon = getDeviceIcon(rec.deviceType);
                return (
                  <div
                    key={rec.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between group hover:border-indigo-400 transition"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                          <DeviceIcon className="w-4 h-4" />
                        </div>
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-800"></span>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[120px]">
                          {rec.deviceName}
                        </h4>
                        <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono">
                          <span className="text-emerald-500 font-semibold">{rec.latencyMs || 15}ms</span>
                          <span>•</span>
                          <span>{rec.fps || 60}fps</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onDisconnectReceiver(rec.id)}
                      title="Disconnect this receiver"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}

              {/* Empty Slots up to 10 */}
              {Array.from({ length: Math.max(0, 10 - activeReceivers.length) }).map((_, i) => {
                const slotNum = activeReceivers.length + i + 1;
                return (
                  <div
                    key={`empty_${i}`}
                    onClick={onShowPairingModal}
                    className="cursor-pointer p-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800 flex items-center justify-between text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
                  >
                    <div className="flex items-center space-x-2.5 text-xs">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-mono font-bold">
                        #{slotNum}
                      </div>
                      <span className="text-[11px]">Available Slot • Tap to Pair</span>
                    </div>
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                );
              })}
            </div>

            {/* Quick Stream Telemetry */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex justify-between">
                <span>Signaling:</span>
                <span className="text-emerald-500 font-medium">WebSocket Live</span>
              </div>
              <div className="flex justify-between">
                <span>STUN Relay:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">Google STUN Active</span>
              </div>
              <div className="flex justify-between">
                <span>Peer Protocol:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">mediasoup SFU</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
