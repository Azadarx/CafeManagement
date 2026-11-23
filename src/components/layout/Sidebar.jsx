function Sidebar({ currentPage, onNavigate }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'orders', label: 'Orders', icon: '🛎️' },
    { id: 'kitchen', label: 'Kitchen Display', icon: '🍳' },
    { id: 'tables', label: 'Tables', icon: '🪑' },
    { id: 'customers', label: 'Customers', icon: '👤' },
    { id: 'sales', label: 'Sales', icon: '💵' },
    { id: 'dailyhisab', label: 'Daily Hisab', icon: '💰' },
    { id: 'purchases', label: 'Purchases', icon: '🛒' },
    { id: 'inventory', label: 'Inventory', icon: '📦' },
    { id: 'suppliers', label: 'Suppliers', icon: '🏪' },
    { id: 'menucosting', label: 'Menu & Costing', icon: '📋' },
    { id: 'recipes', label: 'Recipes', icon: '🍽️' },
    { id: 'staff', label: 'Staff', icon: '👥' },
    { id: 'reports', label: 'Reports', icon: '📈' },
  ];

  return (
    <aside className="hidden lg:block w-64 bg-white border-r border-gray-200 min-h-screen sticky top-14">
      <nav className="p-4 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
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
    </aside>
  );
}

export default Sidebar;
