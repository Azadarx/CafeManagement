import { useState, useEffect } from 'react';

function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                        window.navigator.standalone === true;
    
    if (isInstalled) {
      return; // Already installed, don't show prompt
    }

    // Check if user dismissed the prompt before
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      return;
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
      // Show our custom install prompt
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for successful installation
    window.addEventListener('appinstalled', () => {
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
      console.log('PWA installed successfully');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    // Clear the deferred prompt
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    // Remember dismissal for 7 days
    localStorage.setItem('pwa-install-dismissed', Date.now() + 7 * 24 * 60 * 60 * 1000);
  };

  if (!showInstallPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-20 lg:bottom-6 left-0 right-0 mx-auto max-w-lg px-4 z-50">
      <div className="bg-blue-600 text-white rounded-lg shadow-xl p-4 flex items-center justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium">Install Cafe App</p>
          <p className="text-xs opacity-90">Add to home screen for quick access</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 text-xs font-medium bg-white/20 hover:bg-white/30 rounded transition-colors"
          >
            Later
          </button>
          <button
            onClick={handleInstallClick}
            className="px-3 py-1.5 text-xs font-medium bg-white text-blue-600 hover:bg-blue-50 rounded transition-colors"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  );
}

export default PWAInstallPrompt;
