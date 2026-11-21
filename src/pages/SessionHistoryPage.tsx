import React, { useEffect, useState } from 'react';
import {
  Clock,
  Calendar,
  Users,
  Monitor,
  Film,
  Image as ImageIcon,
  Music,
  ArrowRight,
  Download,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SessionHistoryItem, MediaType } from '../types/cast';
import { getUserSessionHistory } from '../firebase/services';

interface SessionHistoryPageProps {
  onStartNewWithMedia: (type: MediaType) => void;
}

export const SessionHistoryPage: React.FC<SessionHistoryPageProps> = ({ onStartNewWithMedia }) => {
  const { user } = useAuth();
  const [history, setHistory] = useState<SessionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = async () => {
    setLoading(true);
    if (user?.uid) {
      try {
        const items = await getUserSessionHistory(user.uid);
        setHistory(items || []);
      } catch (e) {
        console.warn('Session history load notice:', e);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadHistory();
  }, [user]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const remM = m % 60;
      return `${h}h ${remM}m`;
    }
    return `${m}m ${s}s`;
  };

  const getMediaIcon = (type: MediaType) => {
    switch (type) {
      case 'video':
        return Film;
      case 'photo':
        return ImageIcon;
      case 'music':
        return Music;
      default:
        return Monitor;
    }
  };

  const totalDuration = history.reduce((acc, h) => acc + (h.durationSeconds || 0), 0);
  const peakReceiversOverall = history.reduce((max, h) => Math.max(max, h.receiverCount || 0), 0);

  const exportHistory = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(history, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `universalcast_history_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">
            Analytics & Logs
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
            Broadcast Session History
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Archived logs of ended casting sessions synced with Cloud Firestore.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadHistory}
            className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
            title="Refresh history"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {history.length > 0 && (
            <button
              onClick={exportHistory}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs uppercase font-semibold text-slate-400">Completed Sessions</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {history.length}
          </div>
          <span className="text-[11px] text-emerald-500 font-medium">Logged in Cloud Firestore</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs uppercase font-semibold text-slate-400">Total Airtime</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {formatDuration(totalDuration)}
          </div>
          <span className="text-[11px] text-indigo-500 font-medium">Screen and media streams</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs uppercase font-semibold text-slate-400">Peak Receivers</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {peakReceiversOverall} / 10
          </div>
          <span className="text-[11px] text-cyan-500 font-medium">Max concurrent fan-out</span>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-white text-base">Past Sessions Log</h3>

        {history.length === 0 ? (
          <div className="text-center py-12 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
            <Clock className="w-10 h-10 mx-auto text-slate-400" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              No previous broadcast records
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Start your first multi-screen session from the dashboard or "Start Cast" tab.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase font-semibold text-[10px] tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-4">Session Title</th>
                  <th className="py-3 px-4">Media Type</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Receivers</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {history.map((item) => {
                  const MediaIcon = getMediaIcon(item.mediaType);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                        {item.title}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 font-semibold text-[11px] capitalize">
                          <MediaIcon className="w-3.5 h-3.5" />
                          <span>{item.mediaType}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium">
                        {formatDuration(item.durationSeconds)}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        {item.receiverCount} / 10
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {new Date(item.startedAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => onStartNewWithMedia(item.mediaType)}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition"
                        >
                          <span>Re-cast</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
