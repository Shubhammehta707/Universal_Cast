import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { QRCodeDisplay } from './components/QRCodeDisplay';
import { LandingPage } from './pages/LandingPage';
import { SignInPage } from './pages/SignInPage';
import { SenderDashboard } from './pages/SenderDashboard';
import { CreateSessionPage } from './pages/CreateSessionPage';
import { PairingPage } from './pages/PairingPage';
import { ActiveCastPage } from './pages/ActiveCastPage';
import { ReceiverManagementPage } from './pages/ReceiverManagementPage';
import { BrowserReceiverPage } from './pages/BrowserReceiverPage';
import { DeviceDiscoveryPage } from './pages/DeviceDiscoveryPage';
import { DeviceRegistrationPage } from './pages/DeviceRegistrationPage';
import { SessionHistoryPage } from './pages/SessionHistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { CastSession, MediaType, RegisteredDevice } from './types/cast';
import { useSenderWebRTC } from './hooks/useWebRTC';
import { endSessionInFirestore, updateSessionInFirestore } from './firebase/services';
import { X, Copy, Check, Tv, Radio } from 'lucide-react';

function AppContent() {
  const { user } = useAuth();

  // URL Query Parser
  const [currentTab, setCurrentTab] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'receiver' || params.has('pin')) {
      return 'receiver';
    }
    return 'landing';
  });

  const [receiverInitialPin, setReceiverInitialPin] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('pin');
  });

  const [receiverInitialSessionId, setReceiverInitialSessionId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('session');
  });

  // Active Session State with sessionStorage recovery
  const [activeSession, setActiveSession] = useState<CastSession | null>(() => {
    try {
      const saved = sessionStorage.getItem('uc_active_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (activeSession) {
      sessionStorage.setItem('uc_active_session', JSON.stringify(activeSession));
    } else {
      sessionStorage.removeItem('uc_active_session');
    }
  }, [activeSession]);

  const [selectedInitialMedia, setSelectedInitialMedia] = useState<MediaType>('screen');
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [copiedModalPin, setCopiedModalPin] = useState(false);

  // Initialize WebRTC sender hook for active session
  const senderName = user?.displayName || user?.email?.split('@')[0] || 'UniversalCast Broadcaster';
  const {
    localStream,
    activeReceivers,
    isStreaming,
    startScreenCapture,
    startMediaElementCapture,
    disconnectReceiver,
    stopStream,
    stopCasting,
  } = useSenderWebRTC(
    activeSession?.id || '',
    activeSession?.pin || '',
    senderName,
    activeSession?.maxReceivers || 10
  );

  // Sync active receiver count to Firestore session document (owner-only)
  useEffect(() => {
    if (
      user &&
      activeSession?.id &&
      activeSession.senderId === user.uid &&
      activeReceivers.length !== activeSession.receiverCount
    ) {
      const nextIds = activeReceivers.map((r) => r.id);
      const nextCount = activeReceivers.length;
      updateSessionInFirestore(activeSession.id, {
        receiverCount: nextCount,
        activeReceiverIds: nextIds,
      }).catch((e) => console.warn('Sync count notice:', e));
      setActiveSession((prev) =>
        prev && prev.id === activeSession.id
          ? { ...prev, receiverCount: nextCount, activeReceiverIds: nextIds }
          : prev
      );
    }
  }, [user, activeSession, activeReceivers]);

  const handleStartSessionFlow = (mediaType: MediaType = 'screen') => {
    setSelectedInitialMedia(mediaType);
    setCurrentTab('create');
  };

  const handleSessionCreated = (session: CastSession) => {
    setActiveSession(session);
    setCurrentTab('pairing');
  };

  const handleEndSession = async () => {
    if (activeSession) {
      const closingId = activeSession.id;
      const closingSenderId = activeSession.senderId;
      stopCasting();
      try {
        if (user) {
          const idToken = await user.getIdToken();
          await fetch(`/api/sessions/${encodeURIComponent(closingId)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${idToken}` },
          }).catch(() => {});
        }
        await endSessionInFirestore(closingId, closingSenderId);
      } catch (e) {
        console.error('End session error:', e);
      }
      setActiveSession(null);
      setCurrentTab('dashboard');
    }
  };

  const handleJoinReceiverFromLanding = (pin: string) => {
    setReceiverInitialPin(pin);
    setCurrentTab('receiver');
  };

  const handleCastToDevice = (device: RegisteredDevice) => {
    handleStartSessionFlow('screen');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors selection:bg-indigo-500 selection:text-white">
      {/* Hide standard navbar when inside Receiver TV HUD */}
      {currentTab !== 'receiver' && (
        <Navbar
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          activeSessionId={activeSession?.id}
        />
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
        {currentTab === 'landing' && (
          <LandingPage
            onStartCast={() => handleStartSessionFlow('screen')}
            onJoinReceiver={handleJoinReceiverFromLanding}
            onNavigate={setCurrentTab}
          />
        )}

        {currentTab === 'signin' && (
          <SignInPage onSignedIn={() => setCurrentTab('dashboard')} />
        )}

        {currentTab === 'dashboard' && (
          <SenderDashboard
            activeSession={activeSession}
            activeReceivers={activeReceivers}
            onStartSession={handleStartSessionFlow}
            onNavigate={setCurrentTab}
            onDisconnectReceiver={disconnectReceiver}
            onEndSession={handleEndSession}
            onShowPairingModal={() => setShowPairingModal(true)}
            onQuickJoinReceiver={handleJoinReceiverFromLanding}
          />
        )}

        {currentTab === 'create' && (
          <CreateSessionPage
            initialMediaType={selectedInitialMedia}
            onSessionCreated={handleSessionCreated}
            onCancel={() => setCurrentTab(activeSession ? 'active-cast' : 'dashboard')}
            onNavigate={setCurrentTab}
          />
        )}

        {currentTab === 'pairing' && activeSession && (
          <PairingPage
            session={activeSession}
            activeReceivers={activeReceivers}
            onDisconnectReceiver={disconnectReceiver}
            onProceedToCast={() => setCurrentTab('active-cast')}
          />
        )}

        {currentTab === 'active-cast' && activeSession && (
          <ActiveCastPage
            session={activeSession}
            activeReceivers={activeReceivers}
            localStream={localStream}
            isStreaming={isStreaming}
            onStartScreenCapture={startScreenCapture}
            onStartMediaElementCapture={startMediaElementCapture}
            onDisconnectReceiver={disconnectReceiver}
            onStopStream={stopStream}
            onEndSession={handleEndSession}
            onShowPairingModal={() => setShowPairingModal(true)}
          />
        )}

        {currentTab === 'receiver-mgmt' && activeSession && (
          <ReceiverManagementPage
            sessionId={activeSession.id}
            maxReceivers={activeSession.maxReceivers}
            receivers={activeReceivers}
            onDisconnectReceiver={disconnectReceiver}
            onBack={() => setCurrentTab('active-cast')}
          />
        )}

        {currentTab === 'receiver' && (
          <BrowserReceiverPage
            initialPin={receiverInitialPin}
            initialSessionId={receiverInitialSessionId}
            onExit={() => setCurrentTab('landing')}
          />
        )}

        {currentTab === 'discovery' && (
          <DeviceDiscoveryPage
            onRegisterCustom={() => setCurrentTab('register-device')}
            onCastToDevice={handleCastToDevice}
          />
        )}

        {currentTab === 'register-device' && (
          <DeviceRegistrationPage
            onBack={() => setCurrentTab('discovery')}
            onRegistered={() => setCurrentTab('discovery')}
          />
        )}

        {currentTab === 'history' && (
          <SessionHistoryPage onStartNewWithMedia={handleStartSessionFlow} />
        )}

        {currentTab === 'settings' && <SettingsPage />}
      </main>

      {/* Pairing Modal accessible during live cast */}
      {showPairingModal && activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
            <button
              onClick={() => setShowPairingModal(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1">
              <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400">
                Pair Additional Display
              </span>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Scan or Enter PIN
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Limit of {activeSession.maxReceivers} total receivers enforced.
              </p>
            </div>

            <div className="flex justify-center p-3 bg-white rounded-2xl shadow-sm border border-slate-200">
              <QRCodeDisplay
                value={`${window.location.origin}?tab=receiver&pin=${activeSession.pin}&session=${activeSession.id}`}
                size={180}
              />
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-center space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">6-Digit PIN</span>
              <div className="font-mono text-3xl font-black tracking-widest text-indigo-600 dark:text-indigo-400">
                {activeSession.pin}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(activeSession.pin);
                  setCopiedModalPin(true);
                  setTimeout(() => setCopiedModalPin(false), 2000);
                }}
                className="inline-flex items-center space-x-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline pt-1"
              >
                {copiedModalPin ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedModalPin ? 'Copied' : 'Copy PIN'}</span>
              </button>
            </div>

            <div className="text-center text-xs font-mono text-slate-500 dark:text-slate-400">
              Active: {activeReceivers.length} / {activeSession.maxReceivers} Receivers
            </div>
          </div>
        </div>
      )}

      {currentTab !== 'receiver' && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
