import React, { useState } from 'react';
import {
  Settings,
  Cpu,
  Wifi,
  Sun,
  Moon,
  Shield,
  Layers,
  Save,
  Check,
  RotateCcw,
  Info,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export const SettingsPage: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();

  const loadSavedSettings = () => {
    try {
      const raw = localStorage.getItem('uc_settings');
      return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  };
  const initial = loadSavedSettings();

  const [preferredCodec, setPreferredCodec] = useState<'H264' | 'VP8' | 'VP9'>(
    initial.preferredCodec === 'VP8' || initial.preferredCodec === 'VP9' ? initial.preferredCodec : 'H264'
  );
  const [preferredResolution, setPreferredResolution] = useState<'auto' | '1080p' | '720p' | '4k'>(
    initial.preferredResolution === 'auto' ||
      initial.preferredResolution === '720p' ||
      initial.preferredResolution === '4k'
      ? initial.preferredResolution
      : '1080p'
  );
  const [preferredFps, setPreferredFps] = useState<30 | 60>(initial.preferredFps === 30 ? 30 : 60);
  const [audioBitrate, setAudioBitrate] = useState<'128' | '256'>(initial.audioBitrate === '256' ? '256' : '128');
  const [stunServer, setStunServer] = useState(
    typeof initial.stunServer === 'string' && initial.stunServer ? initial.stunServer : 'stun:stun.l.google.com:19302'
  );
  const [turnServer, setTurnServer] = useState(typeof initial.turnServer === 'string' ? initial.turnServer : '');
  const [lowLatencyMode, setLowLatencyMode] = useState(
    typeof initial.lowLatencyMode === 'boolean' ? initial.lowLatencyMode : true
  );
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem(
      'uc_settings',
      JSON.stringify({
        preferredCodec,
        preferredResolution,
        preferredFps,
        audioBitrate,
        stunServer,
        turnServer,
        lowLatencyMode,
      })
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setPreferredCodec('H264');
    setPreferredResolution('1080p');
    setPreferredFps(60);
    setAudioBitrate('128');
    setStunServer('stun:stun.l.google.com:19302');
    setTurnServer('');
    setLowLatencyMode(true);
  };

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-8">
      <div>
        <span className="text-xs uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">
          Configuration
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
          Platform Settings
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Configure WebRTC media encoding, ICE candidate servers, and receiver limits.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Appearance Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
            <Sun className="w-4 h-4 text-amber-500" />
            <span>Theme & Display Mode</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`p-3.5 rounded-2xl border flex items-center justify-center space-x-2 font-bold text-xs transition ${
                theme === 'dark'
                  ? 'border-indigo-600 bg-slate-800 text-white shadow-xs'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Moon className="w-4 h-4 text-indigo-400" />
              <span>Dark Theme (TV Optimal)</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`p-3.5 rounded-2xl border flex items-center justify-center space-x-2 font-bold text-xs transition ${
                theme === 'light'
                  ? 'border-indigo-600 bg-slate-100 text-slate-900 shadow-xs'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Sun className="w-4 h-4 text-amber-500" />
              <span>Light Theme</span>
            </button>
          </div>
        </div>

        {/* Media & Codec Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-500" />
            <span>Video & Audio Encoding</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Preferred Video Codec
              </label>
              <select
                value={preferredCodec}
                onChange={(e) => setPreferredCodec(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
              >
                <option value="H264">H.264 (Hardware Accelerated, TV Universal)</option>
                <option value="VP8">VP8 (Web Standard)</option>
                <option value="VP9">VP9 (High Efficiency)</option>
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                H.264 offers maximum hardware decoder compatibility with Smart TVs.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Audio Bitrate (Opus)
              </label>
              <select
                value={audioBitrate}
                onChange={(e) => setAudioBitrate(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
              >
                <option value="128">128 kbps (Balanced Stereo)</option>
                <option value="256">256 kbps (Studio Lossless Quality)</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                Ultra-Low Latency Mode
              </span>
              <span className="text-[11px] text-slate-400">
                Disables receiver playout buffering to achieve ~15ms live latency.
              </span>
            </div>
            <input
              type="checkbox"
              checked={lowLatencyMode}
              onChange={(e) => setLowLatencyMode(e.target.checked)}
              className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
            />
          </div>
        </div>

        {/* Network & STUN/TURN Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
            <Wifi className="w-4 h-4 text-emerald-500" />
            <span>Interactive Connectivity (ICE / STUN / TURN)</span>
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Public STUN Server URL
            </label>
            <input
              type="text"
              value={stunServer}
              onChange={(e) => setStunServer(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Optional TURN Relay Server (for Symmetric NAT)
            </label>
            <input
              type="text"
              placeholder="turn:turn.example.com:3478"
              value={turnServer}
              onChange={(e) => setTurnServer(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono"
            />
          </div>
        </div>

        {/* Save & Reset Buttons */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            type="submit"
            className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition active:scale-98"
          >
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{saved ? 'Saved!' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
