function Navbar({ currentUser, onLogout }) {
  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <span className="text-xl sm:text-2xl">☕</span>
          <h1 className="text-base sm:text-xl font-bold text-gray-800">Cafe Management</h1>
        </div>
        {currentUser && (
          <div className="flex items-center space-x-2 sm:space-x-4">
            <span className="text-xs sm:text-sm text-gray-600 hidden sm:inline truncate max-w-[150px] md:max-w-none">
              {currentUser.email}
            </span>
            <button
              onClick={onLogout}
              className="text-xs sm:text-sm text-red-600 hover:text-red-700 font-medium whitespace-nowrap"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
