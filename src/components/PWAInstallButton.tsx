import React, { useState } from 'react';
import { Download, Share, PlusSquare, Monitor, Smartphone, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'hero' | 'mobile-menu';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);

  // Automatically suppress when already running as an installed standalone PWA
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuideModal(true);
    }
  };

  const renderTriggerButton = () => {
    if (variant === 'hero') {
      return (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`w-full sm:w-auto min-h-[44px] bg-slate-900/5 hover:bg-slate-900/10 dark:bg-slate-800/70 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300/80 dark:border-slate-700 font-semibold text-sm px-5 py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 whitespace-nowrap shrink-0 ${className}`}
        >
          <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{isIOS ? 'Install on iOS' : 'Install App'}</span>
        </button>
      );
    }

    if (variant === 'mobile-menu') {
      return (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`w-full min-h-[44px] flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 transition-colors whitespace-nowrap shrink-0 ${className}`}
        >
          <Download className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{isIOS ? 'Install PRYORA on iPhone / iPad' : 'Install PRYORA App'}</span>
        </button>
      );
    }

    // Default 'header' variant
    return (
      <button
        type="button"
        onClick={handleInstallClick}
        title="Install PRYORA as a standalone app on your device"
        className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-slate-100/90 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 transition-all active:scale-95 whitespace-nowrap shrink-0 ${className}`}
      >
        <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>{isIOS ? 'Install on iOS' : 'Install App'}</span>
      </button>
    );
  };

  return (
    <>
      {renderTriggerButton()}

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-modal-title"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-left relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 font-black text-base flex items-center justify-center shadow-sm shadow-emerald-500/20 shrink-0">
                  P
                </div>
                <div>
                  <h3
                    id="pwa-install-modal-title"
                    className="text-base font-bold text-slate-900 dark:text-white"
                  >
                    {isIOS ? 'Install PRYORA on iPhone / iPad' : 'Install PRYORA Desktop & Mobile App'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Launch directly from your home screen or dock with offline access
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close installation guide"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-3 my-4">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-start gap-3">
                  <Share className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                    <span className="font-bold block text-slate-900 dark:text-white mb-0.5">
                      1. Tap the Share button in Safari
                    </span>
                    Locate the Share icon at the bottom of your iPhone screen or top right of your iPad toolbar.
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-start gap-3">
                  <PlusSquare className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                    <span className="font-bold block text-slate-900 dark:text-white mb-0.5">
                      2. Select &ldquo;Add to Home Screen&rdquo;
                    </span>
                    Scroll down the share sheet, tap <strong>Add to Home Screen</strong>, and confirm by tapping <strong>Add</strong>.
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 my-4">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-start gap-3">
                  <Monitor className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                    <span className="font-bold block text-slate-900 dark:text-white mb-0.5">
                      Desktop (Chrome, Edge, Brave, or Safari)
                    </span>
                    Open PRYORA in a dedicated browser tab and click the <strong>Install PRYORA</strong> icon on the right side of the address bar (or select <strong>File &rarr; Add to Dock</strong> in macOS Safari).
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-start gap-3">
                  <Smartphone className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                    <span className="font-bold block text-slate-900 dark:text-white mb-0.5">
                      Android &amp; Mobile Browsers
                    </span>
                    Tap the browser menu (three dots) and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                  </div>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Remembers your last visited screen on launch</span>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
