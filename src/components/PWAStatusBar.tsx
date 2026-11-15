import React, { useState } from 'react';
import { CloudOff, Download, RefreshCw, Share, Wifi } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="px-3 py-1.5 rounded-xl text-xs font-semibold muse-btn-primary flex items-center gap-1.5"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center gap-1.5"
        >
          <Share className="w-3.5 h-3.5 text-blue-400" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm muse-card p-6 space-y-3">
              <h3 className="font-display font-bold text-lg">Install Muse AI on iPhone / iPad</h3>
              <ol className="list-decimal pl-5 text-xs text-[var(--text-secondary)] space-y-1.5">
                <li>Tap the <strong>Share</strong> button in the Safari toolbar.</li>
                <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2 rounded-xl text-xs font-semibold muse-btn-primary"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC<{
  isOnline: boolean;
  cachedLessonCount: number;
  cachedNoteCount: number;
  justReconnected?: boolean;
  onOpenMyLessons?: () => void;
  onOpenSavedNotes?: () => void;
}> = ({
  isOnline,
  cachedLessonCount,
  cachedNoteCount,
  justReconnected,
  onOpenMyLessons,
  onOpenSavedNotes,
}) => {
  if (isOnline && !justReconnected) return null;

  if (isOnline && justReconnected) {
    return (
      <div
        role="status"
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>Back online — Offline progress &amp; Saved Notes synced.</span>
      </div>
    );
  }

  return (
    <div
      role="status"
      data-testid="offline-banner"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-50 flex flex-wrap items-center gap-2.5 rounded-xl bg-amber-600 px-3.5 py-2.5 text-xs font-semibold text-white shadow-xl"
    >
      <CloudOff className="w-4 h-4 shrink-0" />
      <span>
        Offline Mode — {cachedLessonCount} Cached Lessons &amp; {cachedNoteCount} Saved Notes Ready
      </span>
      {onOpenMyLessons && (
        <button
          type="button"
          onClick={onOpenMyLessons}
          className="px-2.5 py-1 rounded-lg bg-black/25 hover:bg-black/35 text-white text-[11px]"
        >
          My Lessons
        </button>
      )}
      {onOpenSavedNotes && (
        <button
          type="button"
          onClick={onOpenSavedNotes}
          className="px-2.5 py-1 rounded-lg bg-black/25 hover:bg-black/35 text-white text-[11px]"
        >
          Saved Notes
        </button>
      )}
    </div>
  );
};

export const ConnectivityPill: React.FC<{
  isOnline: boolean;
  swReady: boolean;
}> = ({ isOnline, swReady }) => {
  return (
    <span
      title={
        isOnline
          ? swReady
            ? 'Online • Service Worker offline cache ready'
            : 'Online'
          : 'Offline • Serving cached My Lessons & Saved Notes'
      }
      className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border ${
        isOnline
          ? 'bg-emerald-500/10 text-[var(--accent-emerald)] border-emerald-500/30'
          : 'bg-amber-600 text-white border-amber-500'
      }`}
    >
      {isOnline ? <Wifi className="w-3 h-3" /> : <CloudOff className="w-3 h-3" />}
      <span>{isOnline ? (swReady ? 'Offline Ready' : 'Online') : 'Offline Mode'}</span>
    </span>
  );
};
