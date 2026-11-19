import React, { useState } from 'react';
import { CheckCircle2, Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  return (
    <>
      {isInstallable ? (
        <button
          type="button"
          onClick={install}
          data-testid="pwa-install-btn"
          className="inline-flex items-center justify-center gap-2 w-full py-3 px-5 rounded-lg bg-emerald-500/20 border border-emerald-400/75 text-emerald-200 hover:bg-emerald-400 hover:text-slate-950 font-semibold tracking-widest uppercase text-xs transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          Install Cricket Max
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          data-testid="pwa-offline-guide-btn"
          className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-5 rounded-lg bg-[#0a1732]/90 border border-emerald-400/55 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-300 font-semibold tracking-widest uppercase text-xs transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          {isIOS ? (
            <Smartphone className="w-4 h-4" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
          )}
          {isIOS ? 'Install on iPhone / iPad' : 'Offline Ready · Install Guide'}
        </button>
      )}

      {showGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Install Cricket Max for Offline Play"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#020612]/85 p-4"
        >
          <div className="w-full max-w-sm rounded-xl bg-[#0b1530] border-2 border-cyan-400/70 p-6 text-left space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl font-bold tracking-wider text-amber-400">
                CRICKET MAX · OFFLINE PLAY
              </h3>
              <button
                type="button"
                aria-label="Close install instructions"
                onClick={() => setShowGuide(false)}
                className="p-1.5 rounded-lg bg-[#0c1a3a] border border-cyan-500/35 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {isIOS ? (
              <ol className="space-y-2 text-xs text-slate-200 leading-relaxed list-decimal list-inside">
                <li>
                  Tap the <strong className="text-cyan-300">Share</strong> button in Safari&apos;s toolbar.
                </li>
                <li>
                  Scroll down and tap <strong className="text-amber-300">Add to Home Screen</strong>.
                </li>
                <li>
                  Open <strong className="text-white">Cricket Max</strong> anytime — works completely offline!
                </li>
              </ol>
            ) : (
              <div className="space-y-2.5 text-xs text-slate-200 leading-relaxed">
                <p>
                  <strong className="text-emerald-300">Cricket Max</strong> caches all game assets and 2025 squads locally via its Service Worker so you can play without internet.
                </p>
                <p className="text-slate-300">
                  To save as a standalone desktop or Android app named <strong className="text-amber-300">Cricket Max</strong>, click your browser&apos;s <strong className="text-cyan-300">Install</strong> icon in the address bar or browser menu (<strong className="text-white">Save &amp; Share → Install Cricket Max</strong>).
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs uppercase tracking-wider cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      data-testid="offline-indicator"
      className="pointer-events-none fixed top-[154px] right-3 sm:top-[104px] sm:right-4 z-40 flex items-center gap-1.5 rounded-lg bg-amber-500/95 px-2.5 py-1 text-[11px] font-semibold text-slate-950 shadow-lg border border-amber-200/80"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span className="hidden sm:inline">Offline Mode · Local Cache</span>
      <span className="sm:hidden">Offline</span>
    </div>
  );
};
