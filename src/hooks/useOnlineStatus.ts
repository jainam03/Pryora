import { useEffect, useState } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [justReconnected, setJustReconnected] = useState<boolean>(false);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const handleOnline = () => {
      setIsOnline(true);
      setJustReconnected(true);
      window.dispatchEvent(new CustomEvent('pryora:network-restored'));
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        setJustReconnected(false);
      }, 4000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setJustReconnected(false);
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  return { isOnline, justReconnected };
}
