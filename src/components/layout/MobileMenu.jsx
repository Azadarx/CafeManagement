import { useState } from 'react';

function MobileMenu({ currentPage, onNavigate }) {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'dailyhisab', label: 'Daily Hisab', icon: '💰' },
    { id: 'purchases', label: 'Purchases', icon: '🛒' },
    { id: 'inventory', label: 'Inventory', icon: '📦' },
    { id: 'sales', label: 'Sales', icon: '💵' },
    { id: 'suppliers', label: 'Suppliers', icon: '🏪' },
    { id: 'menucosting', label: 'Menu & Costing', icon: '📋' },
    { id: 'staff', label: 'Staff', icon: '👥' },
    { id: 'reports', label: 'Reports', icon: '📈' },
  ];

  const handleNavigate = (pageId) => {
    onNavigate(pageId);
    setIsOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-16 right-4 z-30 bg-blue-600 text-white p-3 rounded-full shadow-lg"
      >
        <span className="text-xl">{isOpen ? '✕' : '☰'}</span>
      </button>

      {isOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-20"
            onClick={() => setIsOpen(false)}
          />
          <div className="lg:hidden fixed top-14 right-0 bottom-0 w-64 bg-white shadow-xl z-30 overflow-y-auto">
            <nav className="p-4 space-y-1">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    currentPage === item.id
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </>
      )}
    </>
  );
}

export default MobileMenu;
