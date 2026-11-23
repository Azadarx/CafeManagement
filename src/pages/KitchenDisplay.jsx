import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

function KitchenDisplay() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterView, setFilterView] = useState('active'); // 'active', 'all'

  // Fetch active orders
  const fetchOrders = async () => {
    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          restaurant_tables (table_number),
          order_items (*)
        `)
        .order('order_date', { ascending: true })
        .order('order_time', { ascending: true });

      if (filterView === 'active') {
        query = query.in('order_status', ['new', 'preparing', 'ready']);
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [filterView]);

  // Update order status
  const updateStatus = async (orderId, newStatus) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          order_status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;
      fetchOrders();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating status: ' + error.message);
    }
  };

  // Calculate elapsed time
  const getElapsedTime = (orderDate, orderTime) => {
    const orderDateTime = new Date(`${orderDate}T${orderTime}`);
    const now = new Date();
    const diffMs = now - orderDateTime;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins}m`;
    } else {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${hours}h ${mins}m`;
    }
  };

  // Get order card color based on status and time
  const getOrderCardClass = (order) => {
    const orderDateTime = new Date(`${order.order_date}T${order.order_time}`);
    const now = new Date();
    const diffMins = Math.floor((now - orderDateTime) / 60000);

    if (order.order_status === 'new') {
      return diffMins > 10 ? 'border-red-500 bg-red-50' : 'border-blue-500 bg-blue-50';
    } else if (order.order_status === 'preparing') {
      return diffMins > 20 ? 'border-orange-500 bg-orange-50' : 'border-yellow-500 bg-yellow-50';
    } else if (order.order_status === 'ready') {
      return 'border-green-500 bg-green-50';
    }
    return 'border-gray-300 bg-white';
  };

  // Get time color
  const getTimeColor = (order) => {
    const orderDateTime = new Date(`${order.order_date}T${order.order_time}`);
    const now = new Date();
    const diffMins = Math.floor((now - orderDateTime) / 60000);

    if (order.order_status === 'new' && diffMins > 10) return 'text-red-600';
    if (order.order_status === 'preparing' && diffMins > 20) return 'text-orange-600';
    return 'text-gray-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🍳</div>
          <p className="text-gray-600">Loading kitchen orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-3 sm:p-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">🍳 Kitchen Display</h1>
            <p className="text-sm text-gray-600 mt-1">
              Last updated: {new Date().toLocaleTimeString()}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterView('active')}
              className={`px-4 py-2 rounded-lg font-medium text-sm ${
                filterView === 'active'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Active Orders
            </button>
            <button
              onClick={() => setFilterView('all')}
              className={`px-4 py-2 rounded-lg font-medium text-sm ${
                filterView === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              All Orders
            </button>
            <button
              onClick={fetchOrders}
              className="px-4 py-2 rounded-lg font-medium text-sm bg-green-600 text-white hover:bg-green-700"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-center">
            <p className="text-xs text-blue-700 mb-1">New</p>
            <p className="text-2xl font-bold text-blue-600">
              {orders.filter(o => o.order_status === 'new').length}
            </p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-center">
            <p className="text-xs text-yellow-700 mb-1">Preparing</p>
            <p className="text-2xl font-bold text-yellow-600">
              {orders.filter(o => o.order_status === 'preparing').length}
            </p>
          </div>
          <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-center">
            <p className="text-xs text-green-700 mb-1">Ready</p>
            <p className="text-2xl font-bold text-green-600">
              {orders.filter(o => o.order_status === 'ready').length}
            </p>
          </div>
        </div>
      </div>

      {/* Orders Grid */}
      {orders.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-6xl mb-4">✨</div>
          <p className="text-xl text-gray-600 font-medium">No orders in kitchen</p>
          <p className="text-sm text-gray-500 mt-2">New orders will appear here automatically</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className={`border-4 rounded-lg p-4 shadow-lg transition-all ${getOrderCardClass(order)}`}
            >
              {/* Order Header */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    {order.order_type === 'dine_in' && order.restaurant_tables
                      ? `Table ${order.restaurant_tables.table_number}`
                      : order.order_type === 'takeaway'
                      ? '📦 Takeaway'
                      : '🚗 Delivery'
                    }
                  </h2>
                  <p className="text-sm text-gray-600 font-medium">{order.order_number}</p>
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-bold ${getTimeColor(order)}`}>
                    {getElapsedTime(order.order_date, order.order_time)}
                  </div>
                  <p className="text-xs text-gray-500">
                    {new Date(`${order.order_date}T${order.order_time}`).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                </div>
              </div>

              {/* KOT Number */}
              {order.kot_number && (
                <div className="bg-white bg-opacity-70 rounded px-2 py-1 mb-3 border border-gray-300">
                  <p className="text-xs text-gray-600">KOT: <span className="font-bold">{order.kot_number}</span></p>
                </div>
              )}

              {/* Order Items */}
              <div className="mb-3">
                <div className="space-y-2">
                  {order.order_items?.map((item, idx) => (
                    <div key={idx} className="bg-white bg-opacity-70 rounded p-3 border border-gray-300">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-gray-800">{item.quantity}x</span>
                            <span className="text-lg font-semibold text-gray-800">{item.item_name}</span>
                          </div>
                          {item.special_instructions && (
                            <div className="mt-1 bg-yellow-100 border border-yellow-300 rounded px-2 py-1">
                              <p className="text-sm text-yellow-800">
                                <span className="font-semibold">Note:</span> {item.special_instructions}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Special Notes */}
              {order.special_notes && (
                <div className="bg-orange-100 border border-orange-300 rounded p-2 mb-3">
                  <p className="text-sm text-orange-800 font-medium">
                    <span className="font-bold">Order Notes:</span> {order.special_notes}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2">
                {order.order_status === 'new' && (
                  <button
                    onClick={() => updateStatus(order.id, 'preparing')}
                    className="w-full bg-yellow-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-yellow-700 transition-colors"
                  >
                    🔥 Start Preparing
                  </button>
                )}
                {order.order_status === 'preparing' && (
                  <button
                    onClick={() => updateStatus(order.id, 'ready')}
                    className="w-full bg-green-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-green-700 transition-colors"
                  >
                    ✓ Mark Ready
                  </button>
                )}
                {order.order_status === 'ready' && (
                  <button
                    onClick={() => updateStatus(order.id, 'served')}
                    className="w-full bg-purple-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-purple-700 transition-colors"
                  >
                    🍽️ Mark Served
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default KitchenDisplay;
