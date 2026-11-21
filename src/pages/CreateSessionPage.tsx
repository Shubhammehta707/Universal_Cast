import React, { useState } from 'react';
import {
  Monitor,
  Film,
  Image,
  Music,
  RefreshCw,
  ArrowRight,
  Layers,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CastSession, MediaType } from '../types/cast';
import { createSessionInFirestore } from '../firebase/services';

interface CreateSessionPageProps {
  initialMediaType?: MediaType;
  onSessionCreated: (session: CastSession) => void;
  onCancel: () => void;
  onNavigate?: (tab: string) => void;
}

export const CreateSessionPage: React.FC<CreateSessionPageProps> = ({
  initialMediaType = 'screen',
  onSessionCreated,
  onCancel,
  onNavigate,
}) => {
  const { user, signInWithGoogle } = useAuth();
  const [mediaType, setMediaType] = useState<MediaType>(initialMediaType);
  const [title, setTitle] = useState(
    `Broadcast ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  );
  const [maxReceivers, setMaxReceivers] = useState<number>(10);
  const [quality, setQuality] = useState<'auto' | '1080p' | '720p' | '4k'>('1080p');
  const [fps, setFps] = useState<30 | 60>(60);
  const [pin, setPin] = useState(() => Math.floor(100000 + Math.random() * 900000).toString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateNewPin = () => {
    setPin(Math.floor(100000 + Math.random() * 900000).toString());
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError('Please sign in with Google before launching a casting session.');
      return;
    }

    setLoading(true);

    try {
      const idToken = await user.getIdToken();
      const sessionId = `uc_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
      const senderId = user.uid;
      const senderName = user.displayName || user.email?.split('@')[0] || 'UniversalCast Host';
      const clampedMaxReceivers = Math.min(Math.max(1, maxReceivers), 10);
      const cleanTitle = (title.trim() || 'Live Cast Session').slice(0, 100);

      // 1. Register authoritative session on backend signaling & SFU coordinator
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          sessionId,
          pin,
          title: cleanTitle,
          mediaType,
          maxReceivers: clampedMaxReceivers,
        }),
      });

      const backendData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(backendData.error || 'Backend rejected session creation');
      }

      const session: CastSession = {
        id: sessionId,
        pin,
        senderId,
        senderName,
        title: cleanTitle,
        mediaType,
        status: 'active',
        maxReceivers: clampedMaxReceivers,
        receiverCount: 0,
        activeReceiverIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 2. Persist metadata to Cloud Firestore
      await createSessionInFirestore(session);

      onSessionCreated(session);
    } catch (err) {
      console.error('Session creation error:', err);
      let displayError = 'Failed to create casting session';
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message);
          displayError = parsed.error || err.message;
        } catch {
          displayError = err.message;
        }
      }
      setError(displayError);
    } finally {
      setLoading(false);
    }
  };

  const mediaOptions: { id: MediaType; title: string; desc: string; icon: typeof Monitor }[] = [
    {
      id: 'screen',
      title: 'Screen Mirroring',
      desc: 'Native browser screen capture (Full Desktop, Window, or Tab)',
      icon: Monitor,
    },
    {
      id: 'video',
      title: 'Video File',
      desc: 'Play video streams synchronized across all receiver screens',
      icon: Film,
    },
    {
      id: 'photo',
      title: 'Photo Slideshow',
      desc: 'Broadcast galleries and high-resolution slides',
      icon: Image,
    },
    {
      id: 'music',
      title: 'Music & Audio',
      desc: 'High-fidelity audio streaming with real-time waveform',
      icon: Music,
    },
  ];

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div>
          <span className="text-xs uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">
            Step 1 of 2 • Configure Broadcast
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            Create Casting Session
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Set up pairing PIN, media source, and SFU receiver limits before launching the live stream.
          </p>
        </div>

        {/* Broadcaster Identity / Auth Guard Banner */}
        {user ? (
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[11px]">
                {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <span className="font-bold text-slate-900 dark:text-white block">
                  {user.displayName || user.email}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  Verified Google Host
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start space-x-2.5 text-amber-900 dark:text-amber-200">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Google Sign-In Required to Host</span>
                <span className="text-[11px] opacity-90">
                  Hosting requires verified authentication so your session and Cloud Firestore records stay protected.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => (onNavigate ? onNavigate('signin') : signInWithGoogle())}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shrink-0 transition"
            >
              Sign In
            </button>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-6">
          {/* Media Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Select Media Source
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mediaOptions.map((opt) => {
                const Icon = opt.icon;
                const selected = mediaType === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => setMediaType(opt.id)}
                    className={`cursor-pointer p-3.5 rounded-2xl border transition-all ${
                      selected
                        ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 dark:border-indigo-500 shadow-xs ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          selected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">{opt.title}</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{opt.desc}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Session Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Session Title
            </label>
            <input
              type="text"
              required
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 Design Review / Living Room Movie"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          {/* 6-Digit PIN Generator */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Temporary 6-Digit Pairing PIN
              </label>
              <button
                type="button"
                onClick={generateNewPin}
                className="flex items-center space-x-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Re-roll PIN</span>
              </button>
            </div>
            <div className="flex items-center justify-center py-2">
              <span className="font-mono text-3xl font-extrabold tracking-widest text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 px-6 py-2 rounded-xl border border-indigo-200 dark:border-indigo-900 shadow-inner">
                {pin}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center mt-1">
              Receivers enter this PIN or scan the session QR code on the next screen to join.
            </p>
          </div>

          {/* Max Receivers Slider (1 to 10) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-500" />
                <span>Receiver Device Capacity</span>
              </label>
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {maxReceivers} / 10 Max
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={maxReceivers}
              onChange={(e) => setMaxReceivers(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>1 screen</span>
              <span>5 screens</span>
              <span>10 screens (SFU Limit)</span>
            </div>
          </div>

          {/* Quality & Frame Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Resolution Target
              </label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as 'auto' | '1080p' | '720p' | '4k')}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
              >
                <option value="auto">Adaptive Auto</option>
                <option value="1080p">1080p Full HD (Recommended)</option>
                <option value="720p">720p HD (Low Bandwidth)</option>
                <option value="4k">4K Ultra HD (High Bitrate)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Frame Rate Target
              </label>
              <div className="flex space-x-2">
                {[60, 30].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setFps(rate as 30 | 60)}
                    className={`flex-1 py-2 rounded-xl border text-xs font-bold transition ${
                      fps === rate
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {rate} FPS
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3 pt-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !user}
              className="flex-2 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition active:scale-98 disabled:opacity-50"
            >
              <span>{loading ? 'Creating...' : 'Launch Session & Pair'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
