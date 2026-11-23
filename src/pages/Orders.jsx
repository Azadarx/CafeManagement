import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';

function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [tables, setTables] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  // Form state for new order
  const [formData, setFormData] = useState({
    order_type: 'dine_in',
    customer_id: '',
    table_id: '',
    items: [],
    discount: '0',
    tax_amount: '0',
    special_notes: ''
  });

  // Item form state
  const [itemForm, setItemForm] = useState({
    menu_item_id: '',
    quantity: '1',
    special_instructions: ''
  });

  // Payment form state
  const [paymentData, setPaymentData] = useState({
    payment_method: 'cash',
    paid_amount: ''
  });

  // Fetch all data
  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch orders with related data
      let query = supabase
        .from('orders')
        .select(`
          *,
          customers (name, phone),
          restaurant_tables (table_number),
          order_items (*)
        `)
        .order('order_date', { ascending: false })
        .order('order_time', { ascending: false })
        .limit(100);

      if (filterStatus !== 'all') {
        query = query.eq('order_status', filterStatus);
      }

      const [ordersRes, customersRes, tablesRes, menuRes] = await Promise.all([
        query,
        supabase.from('customers').select('id, name, phone').eq('is_active', true).order('name'),
        supabase.from('restaurant_tables').select('id, table_number, status').eq('is_active', true).order('table_number'),
        supabase.from('menu_items').select('id, item_name, selling_price, is_available').eq('is_available', true).order('item_name')
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (customersRes.error) throw customersRes.error;
      if (tablesRes.error) throw tablesRes.error;
      if (menuRes.error) throw menuRes.error;

      setOrders(ordersRes.data || []);
      setCustomers(customersRes.data || []);
      setTables(tablesRes.data || []);
      setMenuItems(menuRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Error loading data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [filterStatus]);

  // Handle form change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle item form change
  const handleItemChange = (e) => {
    const { name, value } = e.target;
    setItemForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Add item to order
  const addItemToOrder = () => {
    if (!itemForm.menu_item_id || !itemForm.quantity) {
      alert('Please select item and quantity');
      return;
    }

    const menuItem = menuItems.find(m => m.id === itemForm.menu_item_id);
    if (!menuItem) return;

    const quantity = parseInt(itemForm.quantity);
    const newItem = {
      menu_item_id: menuItem.id,
      item_name: menuItem.item_name,
      quantity: quantity,
      unit_price: parseFloat(menuItem.selling_price),
      special_instructions: itemForm.special_instructions
    };

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));

    // Reset item form
    setItemForm({
      menu_item_id: '',
      quantity: '1',
      special_instructions: ''
    });
  };

  // Remove item from order
  const removeItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => 
      sum + (item.quantity * item.unit_price), 0
    );
    const discount = parseFloat(formData.discount) || 0;
    const tax = parseFloat(formData.tax_amount) || 0;
    const total = subtotal - discount + tax;

    return { subtotal, discount, tax, total };
  };

  // Open new order modal
  const openNewOrderModal = () => {
    setFormData({
      order_type: 'dine_in',
      customer_id: '',
      table_id: '',
      items: [],
      discount: '0',
      tax_amount: '0',
      special_notes: ''
    });
    setItemForm({
      menu_item_id: '',
      quantity: '1',
      special_instructions: ''
    });
    setIsModalOpen(true);
  };

  // Submit order
  const handleSubmitOrder = async (e) => {
    e.preventDefault();

    if (formData.items.length === 0) {
      alert('Please add at least one item to the order');
      return;
    }

    if (formData.order_type === 'dine_in' && !formData.table_id) {
      alert('Please select a table for dine-in orders');
      return;
    }

    const totals = calculateTotals();

    try {
      // Generate order number
      const orderNumber = 'ORD-' + Date.now();

      const now = new Date();
      const orderDate = now.toISOString().split('T')[0];
      const orderTime = now.toTimeString().split(' ')[0];

      const { data, error } = await supabase.rpc('create_order_with_items', {
        p_order_number: orderNumber,
        p_order_date: orderDate,
        p_order_time: orderTime,
        p_order_type: formData.order_type,
        p_customer_id: formData.customer_id || null,
        p_table_id: formData.table_id || null,
        p_items: JSON.stringify(formData.items),
        p_discount: totals.discount,
        p_tax_amount: totals.tax,
        p_special_notes: formData.special_notes || null,
        p_created_by: user.id
      });

      if (error) throw error;

      if (!data.success) {
        alert('Error: ' + data.error);
        return;
      }

      alert(`Order created successfully!\nKOT: ${data.kot_number}`);
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error creating order:', error);
      alert('Error creating order: ' + error.message);
    }
  };

  // Update order status
  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          order_status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating order status: ' + error.message);
    }
  };

  // Open payment modal
  const openPaymentModal = (order) => {
    setSelectedOrder(order);
    setPaymentData({
      payment_method: 'cash',
      paid_amount: order.total_amount.toString()
    });
    setIsPaymentModalOpen(true);
  };

  // Handle payment
  const handlePayment = async (e) => {
    e.preventDefault();

    const paidAmount = parseFloat(paymentData.paid_amount);
    if (paidAmount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('complete_order_payment', {
        p_order_id: selectedOrder.id,
        p_payment_method: paymentData.payment_method,
        p_paid_amount: paidAmount,
        p_updated_by: user.id
      });

      if (error) throw error;

      if (!data.success) {
        alert('Error: ' + data.error);
        return;
      }

      alert(`Payment recorded!\nStatus: ${data.payment_status}`);
      setIsPaymentModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Error: ' + error.message);
    }
  };

  // Cancel order
  const handleCancelOrder = async (orderId, orderNumber) => {
    if (!confirm(`Cancel order ${orderNumber}? This will restore inventory.`)) {
      return;
    }

    try {
      const { data, error } = await supabase.rpc('cancel_order_and_restore_inventory', {
        p_order_id: orderId
      });

      if (error) throw error;

      if (!data.success) {
        alert('Error: ' + data.error);
        return;
      }

      alert('Order cancelled successfully!');
      fetchData();
    } catch (error) {
      console.error('Error cancelling order:', error);
      alert('Error: ' + error.message);
    }
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const badges = {
      new: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'New' },
      preparing: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Preparing' },
      ready: { bg: 'bg-green-100', text: 'text-green-700', label: 'Ready' },
      served: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Served' },
      completed: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Completed' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelled' }
    };
    const badge = badges[status] || badges.new;
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const totals = calculateTotals();

  return (
    <div className="p-3 sm:p-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Orders</h1>
        <button
          onClick={openNewOrderModal}
          className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
        >
          + New Order
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
        >
          <option value="all">All Orders</option>
          <option value="new">New</option>
          <option value="preparing">Preparing</option>
          <option value="ready">Ready</option>
          <option value="served">Served</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Orders List */}
      {loading ? (
        <LoadingSpinner />
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 sm:p-8 text-center text-gray-500">
          <p className="text-sm sm:text-lg mb-2">No orders found</p>
          <p className="text-xs sm:text-sm">Create your first order to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">{order.order_number}</h3>
                  <p className="text-sm text-gray-600">
                    {new Date(order.order_date + 'T' + order.order_time).toLocaleString()}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                      {order.order_type.replace('_', ' ')}
                    </span>
                    {order.restaurant_tables && (
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                        Table: {order.restaurant_tables.table_number}
                      </span>
                    )}
                    {order.customers && (
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                        {order.customers.name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {getStatusBadge(order.order_status)}
                  <p className="text-2xl font-bold text-gray-800 mt-2">
                    ₹{parseFloat(order.total_amount).toFixed(2)}
                  </p>
                  {order.payment_status === 'paid' ? (
                    <span className="text-xs text-green-600 font-medium">✓ Paid</span>
                  ) : (
                    <span className="text-xs text-orange-600 font-medium">Unpaid</span>
                  )}
                </div>
              </div>

              {/* Order Items */}
              <div className="border-t pt-3 mb-3">
                <p className="text-sm font-medium text-gray-700 mb-2">Items:</p>
                <div className="space-y-1">
                  {order.order_items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {item.quantity}x {item.item_name}
                      </span>
                      <span className="text-gray-800 font-medium">
                        ₹{parseFloat(item.subtotal).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {order.order_status === 'new' && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'preparing')}
                    className="text-xs bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700"
                  >
                    Start Preparing
                  </button>
                )}
                {order.order_status === 'preparing' && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'ready')}
                    className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                  >
                    Mark Ready
                  </button>
                )}
                {order.order_status === 'ready' && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'served')}
                    className="text-xs bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700"
                  >
                    Mark Served
                  </button>
                )}
                {order.order_status === 'served' && order.payment_status !== 'paid' && (
                  <button
                    onClick={() => openPaymentModal(order)}
                    className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                  >
                    Complete Payment
                  </button>
                )}
                {!['completed', 'cancelled'].includes(order.order_status) && (
                  <button
                    onClick={() => handleCancelOrder(order.id, order.order_number)}
                    className="text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                  >
                    Cancel Order
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Order Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Order"
      >
        <form onSubmit={handleSubmitOrder} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Order Type *</label>
            <select
              name="order_type"
              value={formData.order_type}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="dine_in">Dine In</option>
              <option value="takeaway">Takeaway</option>
              <option value="delivery">Delivery</option>
            </select>
          </div>

          {formData.order_type === 'dine_in' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Table *</label>
              <select
                name="table_id"
                value={formData.table_id}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Select Table</option>
                {tables.filter(t => t.status === 'available').map(table => (
                  <option key={table.id} value={table.id}>
                    Table {table.table_number}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer (Optional)</label>
            <select
              name="customer_id"
              value={formData.customer_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Walk-in Customer</option>
              {customers.map(customer => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} {customer.phone && `- ${customer.phone}`}
                </option>
              ))}
            </select>
          </div>

          {/* Add Items Section */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Add Items</h3>
            <div className="space-y-3">
              <div>
                <select
                  name="menu_item_id"
                  value={itemForm.menu_item_id}
                  onChange={handleItemChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                >
                  <option value="">Select Item</option>
                  {menuItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.item_name} - ₹{parseFloat(item.selling_price).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  name="quantity"
                  value={itemForm.quantity}
                  onChange={handleItemChange}
                  min="1"
                  placeholder="Qty"
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
                <input
                  type="text"
                  name="special_instructions"
                  value={itemForm.special_instructions}
                  onChange={handleItemChange}
                  placeholder="Special instructions (optional)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
                <button
                  type="button"
                  onClick={addItemToOrder}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Added Items List */}
            {formData.items.length > 0 && (
              <div className="mt-4 border rounded-lg p-3">
                <p className="text-sm font-medium text-gray-700 mb-2">Order Items:</p>
                <div className="space-y-2">
                  {formData.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded">
                      <div className="flex-1">
                        <p className="font-medium">{item.quantity}x {item.item_name}</p>
                        {item.special_instructions && (
                          <p className="text-xs text-gray-600">{item.special_instructions}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">₹{(item.quantity * item.unit_price).toFixed(2)}</span>
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-red-600 hover:text-red-700"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {formData.items.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount (₹)</label>
                  <input
                    type="number"
                    name="discount"
                    value={formData.discount}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tax (₹)</label>
                  <input
                    type="number"
                    name="tax_amount"
                    value={formData.tax_amount}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Order Summary */}
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>₹{totals.subtotal.toFixed(2)}</span>
                  </div>
                  {totals.discount > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Discount:</span>
                      <span>-₹{totals.discount.toFixed(2)}</span>
                    </div>
                  )}
                  {totals.tax > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>Tax:</span>
                      <span>+₹{totals.tax.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg border-t pt-1">
                    <span>Total:</span>
                    <span className="text-blue-600">₹{totals.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Special Notes</label>
                <textarea
                  name="special_notes"
                  value={formData.special_notes}
                  onChange={handleChange}
                  rows="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              disabled={formData.items.length === 0}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Create Order
            </button>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={selectedOrder ? `Payment - ${selectedOrder.order_number}` : 'Payment'}
      >
        {selectedOrder && (
          <form onSubmit={handlePayment} className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <p className="text-sm text-blue-700 mb-1">Total Amount</p>
              <p className="text-2xl font-bold text-blue-600">
                ₹{parseFloat(selectedOrder.total_amount).toFixed(2)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount *</label>
              <input
                type="number"
                value={paymentData.paid_amount}
                onChange={(e) => setPaymentData(prev => ({ ...prev, paid_amount: e.target.value }))}
                step="0.01"
                min="0"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method *</label>
              <select
                value={paymentData.payment_method}
                onChange={(e) => setPaymentData(prev => ({ ...prev, payment_method: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="upi">UPI</option>
                <option value="bank">Bank Transfer</option>
              </select>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                Complete Payment
              </button>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

export default Orders;
