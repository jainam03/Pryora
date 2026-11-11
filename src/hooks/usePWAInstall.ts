import { useEffect, useState, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Module-level singleton state so navigating between LandingPageView and MainApp
// never loses a captured beforeinstallprompt event.
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    globalDeferredPrompt = null;
    notifyListeners();
  });
}

export function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    globalDeferredPrompt
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(() => isRunningStandalone());
  const [isIOS, setIsIOS] = useState<boolean>(false);

  useEffect(() => {
    const updateState = () => {
      setDeferredPrompt(globalDeferredPrompt);
      setIsInstalled(isRunningStandalone());
    };

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(userAgent) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);

    updateState();
    listeners.add(updateState);

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = () => updateState();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
    }

    return () => {
      listeners.delete(updateState);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMediaChange);
      }
    };
  }, []);

  const install = useCallback(async (): Promise<boolean> => {
    if (!globalDeferredPrompt) return false;
    try {
      await globalDeferredPrompt.prompt();
      const { outcome } = await globalDeferredPrompt.userChoice;
      if (outcome === 'accepted') {
        globalDeferredPrompt = null;
        setIsInstalled(true);
        notifyListeners();
        return true;
      }
    } catch (err) {
      console.error('PWA installation prompt error:', err);
    }
    return false;
  }, []);

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}
