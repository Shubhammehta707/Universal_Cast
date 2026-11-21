import React from 'react';
import { Cast, Shield, Wifi, Cpu, Layers } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 text-xs py-8 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-6">
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center text-white">
                <Cast className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">UniversalCast</span>
            </div>
            <p className="max-w-md text-slate-600 dark:text-slate-400 leading-relaxed">
              Real-time multi-screen casting engine powered by WebRTC, media routing SFU architecture, and secure Firestore session orchestration. Mirror screens and stream media to up to 10 receivers simultaneously.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-medium">
                <Wifi className="w-2.5 h-2.5" /> mediasoup SFU
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px] font-medium">
                <Cpu className="w-2.5 h-2.5" /> H.264 / Opus
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-[10px] font-medium">
                <Shield className="w-2.5 h-2.5" /> Firestore ABAC
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[10px] font-medium">
                <Layers className="w-2.5 h-2.5" /> Max 10 Receivers
              </span>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Platform Roles</h4>
            <ul className="space-y-1.5">
              <li>Sender Broadcast Console</li>
              <li>Browser &amp; Smart TV Receiver</li>
              <li>QR &amp; 6-Digit PIN Pairing</li>
              <li>Hardware Device Registry</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Protocols &amp; Codecs</h4>
            <ul className="space-y-1.5">
              <li>WebSocket Signaling</li>
              <li>Interactive ICE (STUN / TURN)</li>
              <li>DisplayMedia API Mirroring</li>
              <li>H.264 &amp; Opus via mediasoup</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex flex-col sm:flex-row items-center justify-between text-slate-500 dark:text-slate-400">
          <p>© {new Date().getFullYear()} UniversalCast Platform. Live streams routed via mediasoup WebRTC SFU.</p>
          <div className="flex space-x-4 mt-2 sm:mt-0">
            <span>Production MVP</span>
            <span>•</span>
            <span>Zero-Trust Rules Active</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
