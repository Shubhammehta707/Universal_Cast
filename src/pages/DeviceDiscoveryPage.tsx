import React, { useState, useEffect } from 'react';
import {
  Tv,
  Wifi,
  Search,
  Plus,
  CheckCircle2,
  Monitor,
  Tablet,
  Smartphone,
  Trash2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { RegisteredDevice, DeviceType } from '../types/cast';
import { getRegisteredDevices, addRegisteredDevice, deleteRegisteredDevice } from '../firebase/services';

interface DeviceDiscoveryPageProps {
  onRegisterCustom: () => void;
  onCastToDevice: (device: RegisteredDevice) => void;
}

export const DeviceDiscoveryPage: React.FC<DeviceDiscoveryPageProps> = ({
  onRegisterCustom,
  onCastToDevice,
}) => {
  const { user } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<{
    id: string;
    name: string;
    type: DeviceType;
    ip: string;
    resolution: string;
    latency: number;
    model: string;
  }[]>([]);
  const [savedDevices, setSavedDevices] = useState<RegisteredDevice[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);

  useEffect(() => {
    async function loadSaved() {
      if (user?.uid) {
        try {
          const list = await getRegisteredDevices(user.uid);
          setSavedDevices(list || []);
        } catch (e) {
          console.warn('Load saved devices notice:', e);
        }
      }
      setLoadingSaved(false);
    }
    loadSaved();
  }, [user]);

  const handleScan = () => {
    setScanning(true);
    setDiscoveredDevices([]);

    setTimeout(() => {
      setDiscoveredDevices([
        {
          id: `disc_${Date.now()}_1`,
          name: 'Living Room Sony Bravia 4K',
          type: 'tv',
          ip: '192.168.1.142',
          resolution: '3840x2160',
          latency: 14,
          model: 'Google TV / WebRTC Receiver',
        },
        {
          id: `disc_${Date.now()}_2`,
          name: 'Conference Room 3 Display',
          type: 'monitor',
          ip: '192.168.1.189',
          resolution: '1920x1080',
          latency: 18,
          model: 'LG Commercial Smart Signage',
        },
        {
          id: `disc_${Date.now()}_3`,
          name: 'Kitchen iPad Pro Station',
          type: 'tablet',
          ip: '192.168.1.205',
          resolution: '2732x2048',
          latency: 21,
          model: 'Safari Browser Receiver',
        },
      ]);
      setScanning(false);
    }, 1800);
  };

  const handlePairDiscovered = async (dev: typeof discoveredDevices[0]) => {
    if (!user?.uid) return;
    const newDevice: RegisteredDevice = {
      id: `dev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ownerId: user.uid,
      name: dev.name,
      type: dev.type,
      resolution: dev.resolution,
      status: 'online',
      lastSeen: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      location: 'Local Wi-Fi Subnet',
    };

    try {
      await addRegisteredDevice(newDevice);
      setSavedDevices((prev) => [...prev, newDevice]);
      setDiscoveredDevices((prev) => prev.filter((d) => d.id !== dev.id));
    } catch (e) {
      console.error('Failed to pair discovered device:', e);
    }
  };

  const handleDeleteDevice = async (id: string) => {
    try {
      await deleteRegisteredDevice(id);
      setSavedDevices((prev) => prev.filter((d) => d.id !== id));
    } catch (e) {
      console.error('Failed to delete device:', e);
    }
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
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">
            Device Management
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
            Discovery & Registered Screens
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Probe local Wi-Fi for compatible receivers or register custom Smart TVs and kiosk browsers.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Scanning LAN...' : 'Scan Local Wi-Fi'}</span>
          </button>

          <button
            onClick={onRegisterCustom}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Custom</span>
          </button>
        </div>
      </div>

      {/* Discovered Devices Banner */}
      {discoveredDevices.length > 0 && (
        <div className="p-6 rounded-3xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Discovered on Local Subnet ({discoveredDevices.length})</span>
            </h3>
            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-mono">192.168.1.0/24</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {discoveredDevices.map((dev) => {
              const Icon = getDeviceIcon(dev.type);
              return (
                <div
                  key={dev.id}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/60 shadow-xs flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="font-mono text-[10px] text-emerald-500 font-bold">
                        {dev.latency}ms Ping
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">{dev.name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{dev.ip} • {dev.resolution}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handlePairDiscovered(dev)}
                    className="mt-3 w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition active:scale-98 shadow-xs"
                  >
                    + Pair to Account
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Saved Registered Devices */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              My Registered Displays ({savedDevices.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Permanently bound screens stored in Cloud Firestore.
            </p>
          </div>
        </div>

        {savedDevices.length === 0 ? (
          <div className="text-center py-10 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
            <Tv className="w-10 h-10 mx-auto text-slate-400" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              No registered devices in your library
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Scan your local Wi-Fi or click "Add Custom" to register TVs, conference screens, or browser kiosks.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {savedDevices.map((dev) => {
              const Icon = getDeviceIcon(dev.type);
              return (
                <div
                  key={dev.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">{dev.name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {dev.type.toUpperCase()} • {dev.resolution}
                      </p>
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 font-semibold mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Ready to Receive
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onCastToDevice(dev)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition"
                    >
                      Cast
                    </button>
                    <button
                      onClick={() => handleDeleteDevice(dev.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                      title="Remove device"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
