import React from 'react';
import {
  Users,
  Tv,
  Monitor,
  Tablet,
  Smartphone,
  Trash2,
  Clock,
  Activity,
  ArrowLeft,
  Wifi,
  ShieldAlert,
} from 'lucide-react';
import { SessionReceiver, DeviceType } from '../types/cast';

interface ReceiverManagementPageProps {
  sessionId: string;
  maxReceivers: number;
  receivers: SessionReceiver[];
  onDisconnectReceiver: (id: string) => void;
  onBack: () => void;
}

export const ReceiverManagementPage: React.FC<ReceiverManagementPageProps> = ({
  sessionId,
  maxReceivers,
  receivers,
  onDisconnectReceiver,
  onBack,
}) => {
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
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Broadcast Studio</span>
        </button>

        <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900">
          Capacity: {receivers.length} / {maxReceivers} Connected
        </span>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            Receiver Fleet Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Independently manage, inspect telemetry, or disconnect any of the up to {maxReceivers} screens currently streaming your broadcast.
          </p>
        </div>

        {receivers.length === 0 ? (
          <div className="text-center py-12 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
            <Users className="w-10 h-10 mx-auto text-slate-400" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              No receivers currently connected
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Share your session 6-digit PIN or QR code to let Smart TVs, tablets, and remote browsers join.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase font-semibold text-[10px] tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-4">Device</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Latency</th>
                  <th className="py-3 px-4">FPS</th>
                  <th className="py-3 px-4">Connected At</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {receivers.map((rec) => {
                  const DeviceIcon = getDeviceIcon(rec.deviceType);
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                            <DeviceIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">{rec.deviceName}</span>
                            <span className="text-[10px] text-slate-400 uppercase font-mono">{rec.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 text-[10px] font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Connected
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {rec.latencyMs || 15} ms
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                        {rec.fps || 60} fps
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono">
                        {new Date(rec.joinedAt).toLocaleTimeString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => onDisconnectReceiver(rec.id)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-xs font-semibold transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Disconnect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-start space-x-3 text-xs text-slate-500 dark:text-slate-400">
          <ShieldAlert className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-800 dark:text-slate-200 block">Host Security Controls</span>
            <span>
              Disconnecting a receiver closes its WebRTC data channels immediately and prevents auto-reconnection without re-entering valid session credentials.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
