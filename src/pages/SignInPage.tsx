import React, { useState } from 'react';
import {
  Cast,
  Shield,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Globe,
  Tv,
} from 'lucide-react';
import { useAuth, AuthErrorInfo } from '../context/AuthContext';

interface SignInPageProps {
  onSignedIn: () => void;
}

export const SignInPage: React.FC<SignInPageProps> = ({ onSignedIn }) => {
  const { signInWithGoogle, authError, clearAuthError } = useAuth();
  const [loading, setLoading] = useState(false);
  const [copiedHostname, setCopiedHostname] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const firebaseProjectId = 'gen-lang-client-0443257967';
  const consoleAuthUrl = `https://console.firebase.google.com/project/${firebaseProjectId}/authentication/settings`;

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setLocalError(null);
    clearAuthError();

    try {
      const signedInUser = await signInWithGoogle();
      if (signedInUser) {
        onSignedIn();
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'userFriendlyMessage' in err) {
        setLocalError((err as AuthErrorInfo).userFriendlyMessage);
      } else if (err instanceof Error) {
        setLocalError(err.message);
      } else {
        setLocalError('Google Sign-In failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const copyHostname = () => {
    navigator.clipboard.writeText(currentHostname);
    setCopiedHostname(true);
    setTimeout(() => setCopiedHostname(false), 2000);
  };

  const activeError = authError?.userFriendlyMessage || localError;

  return (
    <div className="w-full min-h-[calc(100dvh-9rem)] flex items-center justify-center py-6 px-3 sm:px-4 box-border">
      <div className="w-full max-w-[420px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl shadow-slate-200/50 dark:shadow-none space-y-5 box-border overflow-hidden transition-colors">
        {/* Header */}
        <div className="text-center space-y-1.5">
          <div className="w-11 h-11 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Cast className="w-5 h-5" />
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Sign In to UniversalCast
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xs mx-auto">
            Authenticate with Google to host multi-screen sessions, manage receivers, and sync devices.
          </p>
        </div>

        {/* Error Alert Box */}
        {activeError && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs space-y-1.5 break-words">
            <div className="flex items-start space-x-2 text-rose-800 dark:text-rose-300 font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="block leading-relaxed">{activeError}</span>
                {authError?.code && (
                  <span className="block mt-1 font-mono text-[10px] text-rose-600 dark:text-rose-400 break-all">
                    Code: {authError.code}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Unauthorized Domain Diagnostic & Resolution Guide */}
        {authError?.isUnauthorizedDomain && (
          <div className="p-4 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 space-y-3 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center space-x-2 font-bold text-amber-900 dark:text-amber-100">
              <Globe className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Firebase Domain Authorization</span>
            </div>

            <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
              This preview domain must be added to your Firebase project&apos;s Authorized domains list.
            </p>

            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800/80 space-y-1.5">
              <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                Domain to Authorize:
              </div>
              <div className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400 break-all select-all leading-tight">
                {currentHostname}
              </div>
              <button
                type="button"
                onClick={copyHostname}
                className="w-full mt-1 inline-flex items-center justify-center space-x-1.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold hover:bg-indigo-100 transition active:scale-98"
              >
                {copiedHostname ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedHostname ? 'Copied to Clipboard' : 'Copy Domain'}</span>
              </button>
            </div>

            <div className="space-y-1 text-[11px] text-amber-900 dark:text-amber-200">
              <span className="font-bold block">1-minute setup:</span>
              <ol className="list-decimal list-inside space-y-1 pl-0.5">
                <li>
                  Open{' '}
                  <a
                    href={consoleAuthUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold underline text-indigo-600 dark:text-indigo-400 inline-flex items-center gap-0.5"
                  >
                    <span>Firebase Auth Settings</span>
                    <ExternalLink className="w-2.5 h-2.5 inline" />
                  </a>
                </li>
                <li>Scroll to <strong>Authorized domains</strong>.</li>
                <li>Click <strong>Add domain</strong> and paste this domain.</li>
                <li>Click <strong>Add</strong> and retry sign-in below.</li>
              </ol>
            </div>
          </div>
        )}

        {/* Google Sign-In Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center space-x-2.5 py-3 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700/80 font-semibold text-xs sm:text-sm transition shadow-xs active:scale-98 disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-indigo-600 shrink-0" />
          ) : (
            <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.94 0 12s.45 3.84 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
          )}
          <span className="truncate">{loading ? 'Signing in...' : 'Continue with Google'}</span>
        </button>

        {/* Receiver Note */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-start space-x-2.5 text-xs text-slate-600 dark:text-slate-300">
          <Tv className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            <strong>Joining a display?</strong> Receivers pair directly with a 6-digit PIN or QR code without signing in.
          </p>
        </div>

        {/* Security and Environment Info */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 space-y-1.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Verified Google Identity &amp; Firebase ID Tokens</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span>Zero-trust ABAC rules on Cloud Firestore</span>
          </div>
        </div>
      </div>
    </div>
  );
};
