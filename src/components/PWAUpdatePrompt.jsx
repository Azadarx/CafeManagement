import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

function PWAUpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [updateAvailable, setUpdateAvailable],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered:', r);
      
      // Check for updates every hour
      if (r) {
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000); // Check every hour
      }
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  useEffect(() => {
    if (updateAvailable) {
      setNeedRefresh(true);
    }
  }, [updateAvailable]);

  const handleUpdate = () => {
    updateServiceWorker(true);
    setNeedRefresh(false);
  };

  if (!needRefresh) {
    return null;
  }

  return (
    <div className="fixed top-20 left-0 right-0 mx-auto max-w-lg px-4 z-50">
      <div className="bg-green-600 text-white rounded-lg shadow-xl p-4 flex items-center justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium">Update Available</p>
          <p className="text-xs opacity-90">A new version is ready</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setNeedRefresh(false)}
            className="px-3 py-1.5 text-xs font-medium bg-white/20 hover:bg-white/30 rounded transition-colors"
          >
            Later
          </button>
          <button
            onClick={handleUpdate}
            className="px-3 py-1.5 text-xs font-medium bg-white text-green-600 hover:bg-green-50 rounded transition-colors"
          >
            Update Now
          </button>
        </div>
      </div>
    </div>
  );
}

export default PWAUpdatePrompt;
