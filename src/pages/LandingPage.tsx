import React, { useState } from 'react';
import {
  Cast,
  Tv,
  Monitor,
  Smartphone,
  Shield,
  Zap,
  Layers,
  ArrowRight,
  Sparkles,
  Wifi,
  Sliders,
  CheckCircle2,
} from 'lucide-react';

interface LandingPageProps {
  onStartCast: () => void;
  onJoinReceiver: (pin: string) => void;
  onNavigate: (tab: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStartCast, onJoinReceiver, onNavigate }) => {
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = pinInput.trim();
    if (!/^[0-9]{6}$/.test(clean)) {
      setPinError('Please enter a valid 6-digit numeric PIN');
      return;
    }
    setPinError('');
    onJoinReceiver(clean);
  };

  return (
    <div className="space-y-16 py-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-indigo-950 via-slate-900 to-slate-950 text-white px-6 py-16 sm:px-12 sm:py-24 border border-indigo-900/50 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.25),rgba(255,255,255,0))]"></div>
        <div className="relative max-w-5xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Universal Multi-Screen WebRTC Casting Platform</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Mirror One Screen. <br />
            <span className="bg-gradient-to-r from-indigo-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
              Broadcast to 10 Receivers Simultaneously.
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
            UniversalCast connects senders and receivers over local LAN or the internet. Share screens, 4K videos, photos, and music to browser receivers, smart TVs, and tablets with sub-second latency.
          </p>

          {/* Action Boxes */}
          <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 text-left">
            {/* Sender Box */}
            <div className="bg-white/5 border border-white/10 hover:border-indigo-500/50 rounded-2xl p-6 backdrop-blur-sm transition-all hover:shadow-xl group">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 mb-4 group-hover:scale-110 transition">
                <Cast className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Host a Broadcast</h3>
              <p className="text-xs text-slate-400 mb-5">
                Share your desktop screen, a browser tab, media files, or music stream. Generate a 6-digit PIN and QR code.
              </p>
              <button
                onClick={onStartCast}
                className="w-full flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition active:scale-98"
              >
                <span>Start Casting Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Receiver Box */}
            <div className="bg-white/5 border border-white/10 hover:border-cyan-500/50 rounded-2xl p-6 backdrop-blur-sm transition-all hover:shadow-xl">
              <div className="w-10 h-10 rounded-xl bg-cyan-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-300 mb-4">
                <Tv className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Quick Join with PIN</h3>
              <p className="text-xs text-slate-400 mb-3">
                Joining a presentation or TV display? Enter the host's 6-digit pairing PIN below.
              </p>
              <form onSubmit={handlePinSubmit} className="space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Enter 6-digit PIN (e.g. 583921)"
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value.replace(/[^0-9]/g, ''));
                      setPinError('');
                    }}
                    className="w-full tracking-widest text-center text-lg font-mono font-bold py-2.5 px-4 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-hidden focus:border-cyan-400"
                  />
                  {pinError && <p className="text-xs text-rose-400 mt-1">{pinError}</p>}
                </div>
                <button
                  type="submit"
                  className="w-full flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm shadow-lg shadow-cyan-600/30 transition active:scale-98"
                >
                  <Tv className="w-4 h-4" />
                  <span>Connect Receiver</span>
                </button>
              </form>
            </div>
          </div>

          {/* Compatibility badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Chrome & Edge WebRTC</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Smart TV Browsers (Tizen, WebOS)</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Tablets & Mobile Safari</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> No extensions required</span>
          </div>
        </div>
      </section>

      {/* 1-to-10 Receiver Fleet Diagram */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Architecture: 1 Broadcaster to 10 Independent Receivers
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Each receiver connects independently via WebRTC signaling. The sender retains full control: see live latency, FPS, and disconnect individual devices at any time.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
          {/* Broadcaster Device Card */}
          <div className="p-6 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border-2 border-indigo-500/40 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Monitor className="w-7 h-7" />
            </div>
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider">
                Broadcaster (Sender)
              </span>
              <h3 className="font-bold text-slate-900 dark:text-white text-base mt-1">Host Workstation</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                1080p / 60 FPS • Screen Mirroring or Media
              </p>
            </div>
            <div className="pt-2 text-xs font-mono bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300">
              Session PIN: Active • 10 Max Slots
            </div>
          </div>

          {/* Media Mesh Connector */}
          <div className="flex flex-col items-center justify-center space-y-2 text-center py-4">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium">
              <Wifi className="w-3.5 h-3.5 text-cyan-500" />
              <span>WebSocket Signaling + WebRTC SFU</span>
            </div>
            <div className="w-full border-t-2 border-dashed border-indigo-300 dark:border-indigo-800 my-2"></div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
              Single-upstream WebRTC SFU fan-out with automatic public STUN and TURN NAT traversal.
            </p>
          </div>

          {/* Receiver Fleet Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              <span>Receiver Fleet (Up to 10)</span>
              <span className="text-emerald-500 font-mono">10/10 Slots Available</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: 'Living Room TV', type: 'Smart TV', icon: Tv, latency: '14ms' },
                { name: 'Conf Room Display', type: 'Projector', icon: Monitor, latency: '18ms' },
                { name: 'Kitchen Tablet', type: 'iPad / iOS', icon: Smartphone, latency: '22ms' },
                { name: 'Auditorium Wall', type: '4K Kiosk', icon: Tv, latency: '16ms' },
              ].map((rec, i) => {
                const Icon = rec.icon;
                return (
                  <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left">
                    <div className="flex items-center justify-between">
                      <Icon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                      <span className="text-[10px] font-mono text-emerald-500 font-bold">{rec.latency}</span>
                    </div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs mt-1 truncate">
                      {rec.name}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">{rec.type}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Zap className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white text-base">Ultra-Low Latency</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Direct browser-to-browser WebRTC transport minimizes latency to ~15ms on local Wi-Fi, making presentations and dynamic media buttery smooth.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white text-base">Multi-Format Casting</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Mirror desktop screens, stream 1080p/4K video files, present slide decks and photo albums, or cast lossless music with live visualizers.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white text-base">Strict Session Security</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Pairing with temporary 6-digit PINs, QR codes, server-enforced 10-receiver boundaries, and hardened Cloud Firestore ABAC rules.
          </p>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-8 sm:p-12 text-center space-y-4 shadow-xl">
        <h2 className="text-2xl sm:text-3xl font-extrabold">Ready to cast across your screens?</h2>
        <p className="text-sm text-indigo-100 max-w-xl mx-auto">
          No proprietary hardware or apps to install. Open in any modern web browser or smart TV and start broadcasting in seconds.
        </p>
        <div className="pt-2 flex flex-wrap justify-center gap-4">
          <button
            onClick={onStartCast}
            className="px-6 py-3 rounded-xl bg-white text-indigo-700 font-bold text-sm shadow-md hover:bg-indigo-50 transition active:scale-98"
          >
            Create a Session
          </button>
          <button
            onClick={() => onNavigate('receiver')}
            className="px-6 py-3 rounded-xl bg-indigo-700/60 border border-white/20 text-white font-semibold text-sm hover:bg-indigo-700 transition active:scale-98"
          >
            Open Receiver Screen
          </button>
        </div>
      </section>
    </div>
  );
};
