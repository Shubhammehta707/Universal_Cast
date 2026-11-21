import React, { useEffect, useState } from 'react';
import {
  Monitor,
  Film,
  Image as ImageIcon,
  Music,
  PlusCircle,
  Tv,
  ArrowRight,
  Radio,
  Users,
  Clock,
  Sparkles,
  Wifi,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  Maximize2,
  Square,
  QrCode,
  Shield,
  Smartphone,
  Tablet,
  CheckCircle2,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CastSession, SessionReceiver, RegisteredDevice, SessionHistoryItem, MediaType, DeviceType } from '../types/cast';
import { getRegisteredDevices, getUserSessionHistory } from '../firebase/services';
import { QRCodeDisplay } from '../components/QRCodeDisplay';

interface SenderDashboardProps {
  activeSession: CastSession | null;
  activeReceivers: SessionReceiver[];
  onStartSession: (mediaType: MediaType) => void;
  onNavigate: (tab: string) => void;
  onDisconnectReceiver: (id: string) => void;
  onEndSession: () => void;
  onShowPairingModal: () => void;
  onQuickJoinReceiver: (pin: string) => void;
}

export const SenderDashboard: React.FC<SenderDashboardProps> = ({
  activeSession,
  activeReceivers,
  onStartSession,
  onNavigate,
  onDisconnectReceiver,
  onEndSession,
  onShowPairingModal,
  onQuickJoinReceiver,
}) => {
  const { user } = useAuth();
  const [devices, setDevices] = useState<RegisteredDevice[]>([]);
  const [history, setHistory] = useState<SessionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedPin, setCopiedPin] = useState(false);
  const [quickPin, setQuickPin] = useState('');
  const [quickPinError, setQuickPinError] = useState('');
  const [activeDuration, setActiveDuration] = useState(0);

  // Active broadcast timer
  useEffect(() => {
    if (!activeSession) {
      setActiveDuration(0);
      return;
    }
    const started = new Date(activeSession.createdAt).getTime();
    const updateTime = () => {
      const now = Date.now();
      setActiveDuration(Math.max(0, Math.floor((now - started) / 1000)));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const loadData = async () => {
    setLoading(true);
    if (user?.uid && !user.uid.startsWith('guest_')) {
      try {
        const [userDevices, userHistory] = await Promise.all([
          getRegisteredDevices(user.uid),
          getUserSessionHistory(user.uid),
        ]);
        setDevices(userDevices || []);
        setHistory(userHistory || []);
      } catch (e) {
        console.warn('Dashboard data fetch notice:', e);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const formatSeconds = (total: number) => {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}h ${m < 10 ? '0' : ''}${m}m ${s < 10 ? '0' : ''}${s}s`;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const copyPin = () => {
    if (!activeSession) return;
    navigator.clipboard.writeText(activeSession.pin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  const handleQuickJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[0-9]{6}$/.test(quickPin.trim())) {
      setQuickPinError('Enter a valid 6-digit numeric PIN');
      return;
    }
    setQuickPinError('');
    onQuickJoinReceiver(quickPin.trim());
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

  const receiverUrl = activeSession
    ? `${window.location.origin}?tab=receiver&pin=${activeSession.pin}&session=${activeSession.id}`
    : '';

  const castModes = [
    {
      id: 'screen' as const,
      title: 'Screen Mirroring',
      desc: 'Real-time desktop, application window, or browser tab streaming.',
      icon: Monitor,
      color: 'from-blue-600 to-indigo-600',
      badge: 'Up to 4K 60fps',
      highlight: 'Ultra-Low Latency',
    },
    {
      id: 'video' as const,
      title: 'Video Stream',
      desc: 'Broadcast 1080p/4K synchronized video files across all screens.',
      icon: Film,
      color: 'from-purple-600 to-pink-600',
      badge: 'H.264 Accelerated',
      highlight: 'Synchronized Buffer',
    },
    {
      id: 'photo' as const,
      title: 'Photo Slideshow',
      desc: 'High-resolution photo galleries and slide presentations.',
      icon: ImageIcon,
      color: 'from-amber-500 to-orange-600',
      badge: 'Lossless Visuals',
      highlight: 'Zero Artifacts',
    },
    {
      id: 'music' as const,
      title: 'Audio & Music',
      desc: 'Lossless audio streaming with real-time waveform visualizers.',
      icon: Music,
      color: 'from-emerald-600 to-teal-600',
      badge: 'Opus Stereo',
      highlight: 'Live Spectrum',
    },
  ];

  const totalAirtimeSeconds = history.reduce((acc, h) => acc + (h.durationSeconds || 0), 0);
  const peakHistoryReceivers = history.reduce((max, h) => Math.max(max, h.receiverCount || 0), 0);

  return (
    <div className="space-y-8 py-6">
      {/* Top Welcome / Hero Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-indigo-900/50">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] uppercase font-bold text-indigo-400 tracking-wider">
              UniversalCast Command Hub
            </span>
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
              WebRTC SFU Ready
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome, {user?.displayName || user?.email?.split('@')[0] || 'Broadcaster'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Broadcast high-framerate screens and media to up to 10 independent receiver devices simultaneously with sub-second latency and zero extensions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {activeSession ? (
            <button
              onClick={() => onNavigate('active-cast')}
              className="flex items-center space-x-2 px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition animate-pulse active:scale-98"
            >
              <Radio className="w-4 h-4" />
              <span>Resume Live Broadcast</span>
            </button>
          ) : (
            <button
              onClick={() => onStartSession('screen')}
              className="flex items-center space-x-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition active:scale-98"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create New Broadcast</span>
            </button>
          )}

          <button
            onClick={() => onNavigate('receiver')}
            className="flex items-center space-x-2 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs transition"
          >
            <Tv className="w-4 h-4" />
            <span>Open Receiver View</span>
          </button>
        </div>
      </div>

      {/* ACTIVE SESSION COMMAND CARD (When a broadcast is active) */}
      {activeSession && (
        <section className="bg-white dark:bg-slate-900 border-2 border-indigo-500/50 dark:border-indigo-500/40 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center space-x-3.5">
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 flex items-center justify-center">
                  <Radio className="w-6 h-6 animate-pulse" />
                </div>
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900 animate-ping"></span>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                    {activeSession.title}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 text-[10px] font-bold uppercase tracking-wider">
                    Broadcasting Live
                  </span>
                </div>
                <div className="flex items-center space-x-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                    ⏱ {formatSeconds(activeDuration)}
                  </span>
                  <span>•</span>
                  <span className="capitalize">{activeSession.mediaType} Stream</span>
                  <span>•</span>
                  <span className="text-emerald-500 font-semibold">WebRTC Active</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => onNavigate('active-cast')}
                className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition active:scale-98"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Open Live Studio</span>
              </button>

              <button
                onClick={onShowPairingModal}
                className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Pairing QR</span>
              </button>

              <a
                href={receiverUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 font-bold text-xs transition border border-cyan-200 dark:border-cyan-800"
                title="Open secondary receiver tab to test multi-screen casting instantly"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Launch Test Receiver Tab</span>
              </a>

              <button
                onClick={onEndSession}
                className="flex items-center space-x-1 px-3.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 font-bold text-xs transition border border-rose-200 dark:border-rose-900"
              >
                <Square className="w-3.5 h-3.5" />
                <span>End</span>
              </button>
            </div>
          </div>

          {/* Active Session Stats & Quick PIN row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* PIN Card */}
            <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                  Receiver Pairing PIN
                </span>
                <div className="font-mono text-3xl font-black tracking-widest text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {activeSession.pin}
                </div>
              </div>
              <button
                onClick={copyPin}
                className="p-2.5 rounded-xl bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shadow-xs hover:bg-indigo-50 transition"
                title="Copy 6-digit PIN"
              >
                {copiedPin ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* Capacity Progress Gauge */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">Receiver Capacity</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {activeReceivers.length} / {activeSession.maxReceivers} Connected
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden my-2">
                <div
                  className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${(activeReceivers.length / activeSession.maxReceivers) * 100}%` }}
                ></div>
              </div>
              <span className="text-[10px] text-slate-400">
                Hard-enforced 10-receiver backend ceiling
              </span>
            </div>

            {/* Real-time Codec & Signaling */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Signaling Socket:</span>
                <span className="text-emerald-500 font-semibold font-mono">Connected</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Video Transport:</span>
                <span className="text-slate-800 dark:text-slate-200 font-mono font-medium">H.264 / STUN</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Audio Codec:</span>
                <span className="text-slate-800 dark:text-slate-200 font-mono font-medium">Opus 48kHz</span>
              </div>
            </div>
          </div>

          {/* Receiver Fleet Matrix (Up to 10 slots) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500" />
                <span>Connected Receiver Fleet ({activeReceivers.length} of 10)</span>
              </h3>
              <button
                onClick={onShowPairingModal}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                + Pair Another Device
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Connected receiver cards */}
              {activeReceivers.map((rec) => {
                const DeviceIcon = getDeviceIcon(rec.deviceType);
                return (
                  <div
                    key={rec.id}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-2 group hover:border-indigo-400 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <DeviceIcon className="w-4 h-4" />
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 font-mono font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        {rec.latencyMs || 15}ms
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {rec.deviceName}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {rec.deviceType.toUpperCase()} • {rec.fps || 60}fps
                      </p>
                    </div>

                    <button
                      onClick={() => onDisconnectReceiver(rec.id)}
                      className="w-full py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 text-[10px] font-bold transition flex items-center justify-center space-x-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Disconnect</span>
                    </button>
                  </div>
                );
              })}

              {/* Empty available slots */}
              {Array.from({ length: Math.max(0, 10 - activeReceivers.length) })
                .slice(0, 5 - (activeReceivers.length % 5 || 0))
                .map((_, i) => {
                  const slotIndex = activeReceivers.length + i + 1;
                  return (
                    <div
                      key={`empty_slot_${i}`}
                      onClick={onShowPairingModal}
                      className="cursor-pointer p-3.5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-400 flex flex-col items-center justify-center text-center space-y-1.5 text-slate-400 hover:text-indigo-500 transition min-h-[110px]"
                    >
                      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-mono font-bold text-xs">
                        #{slotIndex}
                      </div>
                      <span className="text-[11px] font-medium">Available Slot</span>
                      <span className="text-[9px] text-slate-400">Click to Pair</span>
                    </div>
                  );
                })}
            </div>
          </div>
        </section>
      )}

      {/* Media Cast Mode Starter Cards */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>Initiate Multi-Screen Cast</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select your media type to generate a session PIN and broadcast to up to 10 receivers.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">Max 10 Receivers</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {castModes.map((mode) => {
            const Icon = mode.icon;
            return (
              <div
                key={mode.id}
                onClick={() => onStartSession(mode.id)}
                className="group cursor-pointer bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-3xl p-5 shadow-xs hover:shadow-xl transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-11 h-11 rounded-2xl bg-gradient-to-tr ${mode.color} text-white flex items-center justify-center shadow-md group-hover:scale-110 transition`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {mode.badge}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 dark:text-white text-base group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                    {mode.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                    {mode.desc}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  <span>Start Broadcast</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Two Column Section: Registered Displays & Quick Join */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Registered Hardware Displays */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Tv className="w-5 h-5 text-indigo-500" />
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Registered Receiver Displays
                </h3>
                <p className="text-[11px] text-slate-400">
                  Target fixed displays saved in Cloud Firestore
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('register-device')}
              className="flex items-center space-x-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register Display</span>
            </button>
          </div>

          {devices.length === 0 ? (
            <div className="text-center py-10 px-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
              <Tv className="w-9 h-9 mx-auto text-slate-400" />
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                No permanent displays registered yet
              </h4>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Save Living Room Smart TVs, office displays, or browser kiosks to stream to them instantly with 1 click.
              </p>
              <button
                onClick={() => onNavigate('register-device')}
                className="mt-2 inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-100 transition"
              >
                <span>+ Register First Screen</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {devices.map((dev) => {
                const Icon = getDeviceIcon(dev.type);
                return (
                  <div
                    key={dev.id}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[130px]">
                          {dev.name}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {dev.type.toUpperCase()} • {dev.resolution}
                        </p>
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Online
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => onStartSession('screen')}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition"
                    >
                      Cast
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Col: Quick Join Keypad & Metrics */}
        <div className="space-y-6">
          {/* Quick Join Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center space-x-2">
              <Tv className="w-5 h-5 text-cyan-500" />
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Join as Receiver
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Entering someone else's presentation? Connect this screen as a receiver with a 6-digit PIN.
            </p>

            <form onSubmit={handleQuickJoin} className="space-y-3">
              <input
                type="text"
                maxLength={6}
                value={quickPin}
                onChange={(e) => {
                  setQuickPin(e.target.value.replace(/[^0-9]/g, ''));
                  setQuickPinError('');
                }}
                placeholder="6-Digit PIN (e.g. 849201)"
                className="w-full text-center font-mono font-bold text-lg py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:border-cyan-500 tracking-widest"
              />
              {quickPinError && <p className="text-xs text-rose-500 font-medium">{quickPinError}</p>}
              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md shadow-cyan-600/30 transition active:scale-98"
              >
                Connect This Display
              </button>
            </form>
          </div>

          {/* Quick Firestore Metrics */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-500" />
                <span>Airtime Analytics</span>
              </span>
              <button
                onClick={() => onNavigate('history')}
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Full History
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center pt-1">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                <span className="text-[10px] text-slate-400 uppercase">Sessions</span>
                <div className="text-base font-extrabold text-slate-900 dark:text-white">
                  {history.length}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                <span className="text-[10px] text-slate-400 uppercase">Peak Fans</span>
                <div className="text-base font-extrabold text-slate-900 dark:text-white">
                  {peakHistoryReceivers} / 10
                </div>
              </div>
            </div>

            <div className="pt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Persisted across sessions via Cloud Firestore</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
