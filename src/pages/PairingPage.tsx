import React, { useState } from 'react';
import {
  Copy,
  Check,
  Tv,
  ArrowRight,
  Radio,
  Users,
  ShieldCheck,
  ExternalLink,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { CastSession, SessionReceiver } from '../types/cast';
import { QRCodeDisplay } from '../components/QRCodeDisplay';

interface PairingPageProps {
  session: CastSession;
  activeReceivers: SessionReceiver[];
  onDisconnectReceiver: (id: string) => void;
  onProceedToCast: () => void;
}

export const PairingPage: React.FC<PairingPageProps> = ({
  session,
  activeReceivers,
  onDisconnectReceiver,
  onProceedToCast,
}) => {
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const receiverUrl = `${window.location.origin}?tab=receiver&pin=${session.pin}&session=${session.id}`;

  const copyPin = () => {
    navigator.clipboard.writeText(session.pin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(receiverUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center max-w-xl mx-auto space-y-2">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
            <Radio className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
            <span>Session Ready for Receivers</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
            Connect Receiver Screens
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Open the receiver URL on up to {session.maxReceivers} smart TVs, laptops, or tablets, or enter the 6-digit PIN below.
          </p>
        </div>

        {/* Pairing Panel: PIN & QR Code */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          {/* Left: 6-Digit PIN Display */}
          <div className="flex flex-col justify-between space-y-6">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
                Option 1: Manual 6-Digit PIN
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                Enter on Receiver Keypad
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Direct receivers to <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">{window.location.host}</span> and enter this temporary pairing code.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/80 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700 text-center space-y-3">
              <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Pairing PIN</span>
              <div className="font-mono text-3xl sm:text-5xl font-black tracking-widest text-indigo-600 dark:text-indigo-400">
                {session.pin}
              </div>
              <button
                onClick={copyPin}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs"
              >
                {copiedPin ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPin ? 'PIN Copied!' : 'Copy 6-Digit PIN'}</span>
              </button>
            </div>

            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
                Direct Receiver Link
              </span>
              <div className="mt-1 flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={receiverUrl}
                  className="w-full text-xs font-mono px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 truncate"
                />
                <button
                  onClick={copyLink}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition"
                  title="Copy link"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
                <a
                  href={receiverUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 transition"
                  title="Open test receiver tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>

          {/* Right: Sharp QR Code */}
          <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-center space-y-4">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
                Option 2: Instant QR Scan
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                Scan with Phone, Tablet or Smart TV
              </h3>
            </div>

            <div className="p-4 bg-white rounded-2xl shadow-md border border-slate-200">
              <QRCodeDisplay value={receiverUrl} size={210} />
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs">
              Opens the TV-optimized receiver screen directly with zero typing.
            </p>
          </div>
        </div>

        {/* Live Receiver Fleet Counter */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Connected Receivers
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Displays connecting to your session will appear here in real-time.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                  {activeReceivers.length} of {session.maxReceivers} Connected
                </span>
                <div className="w-32 bg-slate-200 dark:bg-slate-700 rounded-full h-2 mt-1 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(activeReceivers.length / session.maxReceivers) * 100}%` }}
                  ></div>
                </div>
              </div>

              <button
                onClick={onProceedToCast}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition active:scale-98"
              >
                <span>Go to Live Studio</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {activeReceivers.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 flex items-center justify-center mx-auto animate-pulse">
                <Tv className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Waiting for receivers to scan QR code or enter PIN...
              </p>
              <p className="text-[11px] text-slate-400">
                You can also proceed to the studio now; receivers can join at any time during the broadcast.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {activeReceivers.map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Tv className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[120px]">
                        {rec.deviceName}
                      </h4>
                      <p className="text-[10px] text-emerald-500 font-mono">
                        Connected • {rec.latencyMs || 15}ms
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onDisconnectReceiver(rec.id)}
                    title="Disconnect receiver"
                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
