import React, { useState } from 'react';
import {
  Tv,
  Monitor,
  Tablet,
  Smartphone,
  ArrowLeft,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { RegisteredDevice, DeviceType } from '../types/cast';
import { addRegisteredDevice } from '../firebase/services';

interface DeviceRegistrationPageProps {
  onBack: () => void;
  onRegistered: () => void;
}

export const DeviceRegistrationPage: React.FC<DeviceRegistrationPageProps> = ({
  onBack,
  onRegistered,
}) => {
  const { user, signInWithGoogle } = useAuth();
  const [name, setName] = useState('');
  const [type, setType] = useState<DeviceType>('tv');
  const [resolution, setResolution] = useState('1920x1080');
  const [location, setLocation] = useState('Living Room');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!user) {
      setError('Please sign in with Google to register a display.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const ownerId = user.uid;
      const deviceId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      const device: RegisteredDevice = {
        id: deviceId,
        ownerId,
        name: name.trim().slice(0, 60),
        type,
        resolution: resolution.slice(0, 30),
        status: 'online',
        lastSeen: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        location: location.trim().slice(0, 60),
      };

      await addRegisteredDevice(device);
      onRegistered();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to register device');
    } finally {
      setLoading(false);
    }
  };

  const deviceTypes: { id: DeviceType; label: string; icon: typeof Tv }[] = [
    { id: 'tv', label: 'Smart TV', icon: Tv },
    { id: 'monitor', label: 'Desktop Monitor', icon: Monitor },
    { id: 'tablet', label: 'Tablet / iPad', icon: Tablet },
    { id: 'mobile', label: 'Mobile Screen', icon: Smartphone },
  ];

  return (
    <div className="max-w-xl mx-auto py-8 px-4 space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Devices</span>
      </button>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div>
          <span className="text-xs uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">
            Hardware Registration
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            Register Display Endpoint
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Save a fixed Smart TV, projector, or kiosk receiver to your account for 1-click casting.
          </p>
        </div>

        {!user && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start space-x-2 text-amber-900 dark:text-amber-200">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>Sign in with Google to save registered devices to your account.</span>
            </div>
            <button
              type="button"
              onClick={() => signInWithGoogle().catch(() => {})}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shrink-0"
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

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Device Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Device Classification
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {deviceTypes.map((dt) => {
                const Icon = dt.icon;
                const isSelected = type === dt.id;
                return (
                  <div
                    key={dt.id}
                    onClick={() => setType(dt.id)}
                    className={`cursor-pointer p-3 rounded-xl border flex items-center space-x-3 transition ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-bold">{dt.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Friendly Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Friendly Screen Name
            </label>
            <input
              type="text"
              required
              maxLength={60}
              placeholder="e.g. Master Bedroom LG OLED 4K"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          {/* Location & Resolution */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Room / Location
              </label>
              <input
                type="text"
                maxLength={40}
                placeholder="e.g. Living Room, Wall 2"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Display Native Resolution
              </label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
              >
                <option value="1920x1080">1080p Full HD (1920x1080)</option>
                <option value="3840x2160">4K Ultra HD (3840x2160)</option>
                <option value="2560x1440">2K QHD (2560x1440)</option>
                <option value="1280x720">720p HD (1280x720)</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center space-x-3">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim() || !user}
              className="flex-2 flex items-center justify-center space-x-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition active:scale-98 disabled:opacity-50"
            >
              <span>{loading ? 'Saving to Firestore...' : 'Register Device'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
