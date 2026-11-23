import { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';
import BottomNav from './components/layout/BottomNav';
import MobileMenu from './components/layout/MobileMenu';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
import OfflineDetector from './components/OfflineDetector';

// Import all pages
import Dashboard from './pages/Dashboard';
import DailyHisab from './pages/DailyHisab';
import Purchases from './pages/Purchases';
import Inventory from './pages/Inventory';
import Sales from './pages/Sales';
import Suppliers from './pages/Suppliers';
import MenuCosting from './pages/MenuCosting';
import Staff from './pages/Staff';
import Reports from './pages/Reports';
import RecipeManagement from './pages/RecipeManagement';
import Login from './pages/Login';
import PasswordReset from './pages/PasswordReset';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const { user, loading, signOut } = useAuth();

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      alert('Error logging out: ' + error.message);
    }
  };

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">☕</div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Handle password reset page
  if (window.location.pathname === '/password-reset') {
    return <PasswordReset />;
  }

  // Show login page if not authenticated
  if (!user) {
    return <Login />;
  }

  // Simple page rendering function
  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'dailyhisab':
        return <DailyHisab />;
      case 'purchases':
        return <Purchases />;
      case 'inventory':
        return <Inventory />;
      case 'sales':
        return <Sales />;
      case 'suppliers':
        return <Suppliers />;
      case 'menucosting':
        return <MenuCosting />;
      case 'staff':
        return <Staff />;
      case 'recipes':
        return <RecipeManagement />;
      case 'reports':
        return <Reports />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* PWA Components */}
      <OfflineDetector />
      <PWAUpdatePrompt />
      <PWAInstallPrompt />
      
      <Navbar currentUser={user} onLogout={handleLogout} />
      
      <div className="flex">
        <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
        
        <main className="flex-1 pb-20 lg:pb-6 min-h-screen">
          {renderPage()}
        </main>
      </div>

      <BottomNav currentPage={currentPage} onNavigate={setCurrentPage} />
      <MobileMenu currentPage={currentPage} onNavigate={setCurrentPage} />
    </div>
  );
}

export default App;
