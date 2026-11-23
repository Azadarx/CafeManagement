import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';

function Dashboard() {
  const [stats, setStats] = useState({
    balance: 0,
    todayExpenses: 0,
    todaySales: 0,
    totalSales: 0,
    totalExpenses: 0,
    pendingPayments: 0,
    lowStockCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [debugInfo, setDebugInfo] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showDateWarning, setShowDateWarning] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    // Check if system date is in future
    const currentYear = new Date().getFullYear();
    if (currentYear > 2025) {
      setShowDateWarning(true);
    }
  }, [selectedDate]);

  const fetchDashboardData = async () => {
    setLoading(true);
    const debugLog = [];
    
    try {
      // Use selected date instead of today
      const today = selectedDate;
      debugLog.push(`Selected date: ${today}`);
      debugLog.push(`System date: ${new Date().toISOString().split('T')[0]}`);
      console.log('=== DASHBOARD DATA FETCH START ===');
      console.log('Selected date:', today);
      console.log('System date:', new Date().toISOString().split('T')[0]);

      // ============ FETCH ALL TRANSACTIONS ============
      const { data: allTransactions, error: transError } = await supabase
        .from('transactions')
        .select('*');

      if (transError) {
        console.error('❌ Error fetching transactions:', transError);
        debugLog.push(`ERROR fetching transactions: ${transError.message}`);
      } else {
        console.log('✅ All transactions fetched:', allTransactions?.length || 0);
        console.log('Transactions data:', allTransactions);
        debugLog.push(`Transactions found: ${allTransactions?.length || 0}`);
        
        if (allTransactions && allTransactions.length > 0) {
          debugLog.push('Transaction dates:');
          allTransactions.forEach(t => {
            debugLog.push(`  - ${t.transaction_date}: ${t.transaction_type} ₹${t.amount}`);
          });
        }
      }

      // ============ FETCH ALL SALES ============
      const { data: allSalesData, error: salesError } = await supabase
        .from('sales')
        .select('*');

      if (salesError) {
        console.error('❌ Error fetching sales:', salesError);
        debugLog.push(`ERROR fetching sales: ${salesError.message}`);
      } else {
        console.log('✅ All sales fetched:', allSalesData?.length || 0);
        console.log('Sales data:', allSalesData);
        debugLog.push(`Sales found: ${allSalesData?.length || 0}`);
        
        if (allSalesData && allSalesData.length > 0) {
          debugLog.push('Sales dates:');
          allSalesData.forEach(s => {
            debugLog.push(`  - ${s.sale_date}: ${s.item_name} ₹${s.total_amount}`);
          });
        }
      }

      // ============ FETCH PENDING PURCHASES ============
      const { data: pendingPurchases, error: purchasesError } = await supabase
        .from('purchases')
        .select('pending_amount, payment_status');

      if (purchasesError) {
        console.error('❌ Error fetching pending purchases:', purchasesError);
        debugLog.push(`ERROR fetching purchases: ${purchasesError.message}`);
      } else {
        console.log('✅ Purchases fetched:', pendingPurchases?.length || 0);
        debugLog.push(`Purchases found: ${pendingPurchases?.length || 0}`);
      }

      // ============ CALCULATE BALANCE ============
      let totalIncome = 0;
      let totalExpense = 0;
      let todayExpenses = 0;

      if (allTransactions) {
        allTransactions.forEach(t => {
          const amount = parseFloat(t.amount);
          if (t.transaction_type === 'income') {
            totalIncome += amount;
          } else if (t.transaction_type === 'expense') {
            totalExpense += amount;
            // Check if it's today
            if (t.transaction_date === today) {
              todayExpenses += amount;
            }
          }
        });
      }

      debugLog.push(`Total Income: ₹${totalIncome}`);
      debugLog.push(`Total Expense: ₹${totalExpense}`);
      debugLog.push(`Today's Expenses: ₹${todayExpenses}`);

      // ============ CALCULATE SALES ============
      let totalSales = 0;
      let todaySales = 0;

      if (allSalesData) {
        allSalesData.forEach(s => {
          const amount = parseFloat(s.total_amount);
          totalSales += amount;
          // Check if it's today
          if (s.sale_date === today) {
            todaySales += amount;
            console.log('Today sale found:', s.item_name, amount);
          }
        });
      }

      debugLog.push(`Total Sales: ₹${totalSales}`);
      debugLog.push(`Today's Sales: ₹${todaySales}`);

      // ============ CALCULATE PENDING PAYMENTS ============
      let pendingPayments = 0;
      if (pendingPurchases) {
        pendingPurchases.forEach(p => {
          if (p.payment_status !== 'paid') {
            pendingPayments += parseFloat(p.pending_amount || 0);
          }
        });
      }

      debugLog.push(`Pending Payments: ₹${pendingPayments}`);

      // ============ FETCH INVENTORY ============
      const { data: inventoryData, error: invError } = await supabase
        .from('inventory')
        .select('*')
        .order('stock_quantity', { ascending: true });

      if (invError) {
        console.error('❌ Error fetching inventory:', invError);
        debugLog.push(`ERROR fetching inventory: ${invError.message}`);
      } else {
        console.log('✅ Inventory items fetched:', inventoryData?.length || 0);
        debugLog.push(`Inventory items: ${inventoryData?.length || 0}`);
      }

      // Filter low stock items
      const lowStockFiltered = inventoryData?.filter(item =>
        parseFloat(item.stock_quantity) <= parseFloat(item.minimum_stock)
      ) || [];

      const lowStockCount = lowStockFiltered.length;
      debugLog.push(`Low stock items: ${lowStockCount}`);

      // ============ SET STATE ============
      setStats({
        balance: totalIncome - totalExpense,
        todayExpenses,
        todaySales,
        totalSales,
        totalExpenses: totalExpense,
        pendingPayments,
        lowStockCount
      });

      setLowStockItems(lowStockFiltered.slice(0, 5));

      // ============ FETCH RECENT DATA ============
      const { data: recent } = await supabase
        .from('transactions')
        .select('*')
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10);

      setRecentTransactions(recent || []);

      const { data: recentSalesData } = await supabase
        .from('sales')
        .select('*')
        .order('sale_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10);

      setRecentSales(recentSalesData || []);

      // Set debug info
      setDebugInfo(debugLog.join('\n'));
      
      console.log('=== DASHBOARD DATA FETCH COMPLETE ===');
      console.log('Final stats:', {
        balance: totalIncome - totalExpense,
        todayExpenses,
        todaySales,
        totalSales,
        pendingPayments,
        lowStockCount
      });

    } catch (error) {
      console.error('💥 CRITICAL ERROR:', error);
      debugLog.push(`CRITICAL ERROR: ${error.message}`);
      setDebugInfo(debugLog.join('\n'));
      alert('Error loading dashboard data. Check console (F12) for details.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Dashboard</h1>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Dashboard</h1>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <div className="w-full sm:w-auto">
            <label className="block text-xs text-gray-600 mb-1">Filter by Date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            />
          </div>
          <button
            onClick={fetchDashboardData}
            className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors sm:mt-5 text-sm sm:text-base"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* System Date Warning */}
      {showDateWarning && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 sm:p-4 mb-6 rounded-r-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <span className="text-xl sm:text-2xl">⚠️</span>
            </div>
            <div className="ml-2 sm:ml-3 flex-1">
              <h3 className="text-sm font-medium text-yellow-800 mb-1">System Date Warning</h3>
              <p className="text-xs sm:text-sm text-yellow-700">
                Your system date is set to <strong>{new Date().toLocaleDateString()}</strong> (year {new Date().getFullYear()}).
                This may affect date-based filtering. Please check your computer's date and time settings.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Debug Info - Hidden in production, accessible via URL param ?debug=true */}
      {debugInfo && new URLSearchParams(window.location.search).get('debug') === 'true' && (
        <details className="bg-gray-100 p-4 rounded-lg mb-6">
          <summary className="cursor-pointer font-semibold text-gray-700">🔍 Debug Info (Click to expand)</summary>
          <pre className="mt-2 text-xs text-gray-600 whitespace-pre-wrap">{debugInfo}</pre>
        </details>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-gray-600 text-xs sm:text-sm mb-1">Available Balance</p>
          <p className={`text-2xl sm:text-3xl font-bold ${stats.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ₹{stats.balance.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1 truncate">
            Income: ₹{(stats.balance + stats.totalExpenses).toFixed(2)} - Expenses: ₹{stats.totalExpenses.toFixed(2)}
          </p>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-lg shadow border-l-4 border-red-500">
          <p className="text-gray-600 text-xs sm:text-sm mb-1">Selected Day's Expenses</p>
          <p className="text-2xl sm:text-3xl font-bold text-red-600">₹{stats.todayExpenses.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">Total: ₹{stats.totalExpenses.toFixed(2)}</p>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-lg shadow border-l-4 border-blue-500">
          <p className="text-gray-600 text-xs sm:text-sm mb-1">Selected Day's Sales</p>
          <p className="text-2xl sm:text-3xl font-bold text-blue-600">₹{stats.todaySales.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">Total: ₹{stats.totalSales.toFixed(2)}</p>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-lg shadow border-l-4 border-orange-500">
          <p className="text-gray-600 text-xs sm:text-sm mb-1">Pending Payments</p>
          <p className="text-2xl sm:text-3xl font-bold text-orange-600">₹{stats.pendingPayments.toFixed(2)}</p>
        </div>

        <div className={`bg-white p-4 sm:p-6 rounded-lg shadow border-l-4 ${stats.lowStockCount > 0 ? 'border-red-500' : 'border-gray-300'}`}>
          <p className="text-gray-600 text-xs sm:text-sm mb-1">Low Stock Items</p>
          <p className={`text-2xl sm:text-3xl font-bold ${stats.lowStockCount > 0 ? 'text-red-600' : 'text-gray-600'}`}>
            {stats.lowStockCount}
          </p>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 sm:p-4 mb-4 sm:mb-6 rounded-r-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <span className="text-xl sm:text-2xl">⚠️</span>
            </div>
            <div className="ml-2 sm:ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800 mb-2">Inventory Alert - Low Stock</h3>
              <ul className="text-xs sm:text-sm text-red-700 space-y-1">
                {lowStockItems.map(item => (
                  <li key={item.id} className="break-words">
                    {parseFloat(item.stock_quantity) === 0 ? '🔴' : '🟠'} {item.item_name} -
                    Current: {parseFloat(item.stock_quantity).toFixed(2)} {item.unit},
                    Min: {parseFloat(item.minimum_stock).toFixed(2)} {item.unit}
                  </li>
                ))}
              </ul>
              {stats.lowStockCount > 5 && (
                <p className="text-xs text-red-600 mt-2">
                  + {stats.lowStockCount - 5} more items. Check Inventory module for full list.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="bg-white rounded-lg shadow mb-4 sm:mb-6">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800">Recent Transactions</h2>
        </div>
        {recentTransactions.length === 0 ? (
          <div className="p-6 sm:p-8 text-center text-gray-500">
            <p className="text-sm sm:text-base">No recent transactions</p>
            <p className="text-xs sm:text-sm mt-1">Add your first transaction in Daily Hisab</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {recentTransactions.map((transaction) => (
              <div key={transaction.id} className="px-4 sm:px-6 py-3 sm:py-4 hover:bg-gray-50">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2 mb-1">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${transaction.transaction_type === 'income'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                        }`}>
                        {transaction.transaction_type}
                      </span>
                      <span className="text-xs sm:text-sm font-medium text-gray-700 truncate">{transaction.category}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 break-words">{transaction.description}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(transaction.transaction_date).toLocaleDateString()} ({transaction.transaction_date})
                    </p>
                  </div>
                  <div className="ml-2 flex-shrink-0">
                    <p className={`text-base sm:text-lg font-bold whitespace-nowrap ${transaction.transaction_type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {transaction.transaction_type === 'income' ? '+' : '-'}₹{parseFloat(transaction.amount).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Sales */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800">Recent Sales</h2>
        </div>
        {recentSales.length === 0 ? (
          <div className="p-6 sm:p-8 text-center text-gray-500">
            <p className="text-sm sm:text-base">No recent sales</p>
            <p className="text-xs sm:text-sm mt-1">Add your first sale in Sales module</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {recentSales.map((sale) => (
              <div key={sale.id} className="px-4 sm:px-6 py-3 sm:py-4 hover:bg-gray-50">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2 mb-1">
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                        sale
                      </span>
                      <span className="text-xs sm:text-sm font-medium text-gray-700 truncate">{sale.item_name}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600">Quantity: {sale.quantity} × ₹{parseFloat(sale.unit_price).toFixed(2)}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(sale.sale_date).toLocaleDateString()} ({sale.sale_date})
                    </p>
                  </div>
                  <div className="ml-2 flex-shrink-0">
                    <p className="text-base sm:text-lg font-bold text-green-600 whitespace-nowrap">
                      ₹{parseFloat(sale.total_amount).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
