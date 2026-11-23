import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';

function Sales() {
  const { user } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [filterDate, setFilterDate] = useState('');

  // NEW: Fetch inventory and menu items for linking
  const [inventoryItems, setInventoryItems] = useState([]);
  const [menuItems, setMenuItems] = useState([]);

  // Form state - UPDATED with inventory linking
  const [formData, setFormData] = useState({
    sale_date: new Date().toISOString().split('T')[0],
    sale_type: 'direct', // 'direct' (inventory item) or 'menu' (menu item with recipe)
    item_name: '',
    inventory_item_id: '',
    menu_item_id: '',
    quantity: '',
    unit_price: '',
    payment_method: 'cash',
    notes: '',
    recordAsIncome: true
  });

  // Fetch inventory items
  const fetchInventoryItems = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('id, item_name, stock_quantity, unit')
        .gt('stock_quantity', 0) // Only show items with stock
        .order('item_name', { ascending: true });

      if (error) throw error;
      setInventoryItems(data || []);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
  };

  // Fetch menu items
  const fetchMenuItems = async () => {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, item_name, selling_price, is_available')
        .eq('is_available', true)
        .order('item_name', { ascending: true });

      if (error) throw error;
      setMenuItems(data || []);
    } catch (error) {
      console.error('Error fetching menu items:', error);
    }
  };

  // Fetch sales
  const fetchSales = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('sales')
        .select('*')
        .order('sale_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (filterDate) {
        query = query.eq('sale_date', filterDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      setSales(data || []);
    } catch (error) {
      console.error('Error fetching sales:', error);
      alert('Error loading sales: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventoryItems();
    fetchMenuItems();
    fetchSales();
  }, [filterDate]);

  // Handle form change
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // When inventory item is selected, auto-fill name and price
  const handleInventorySelection = (e) => {
    const selectedId = e.target.value;
    setFormData(prev => ({ ...prev, inventory_item_id: selectedId }));

    if (selectedId) {
      const item = inventoryItems.find(i => i.id === selectedId);
      if (item) {
        setFormData(prev => ({
          ...prev,
          item_name: item.item_name,
          inventory_item_id: selectedId
        }));
      }
    }
  };

  // When menu item is selected, auto-fill name and price
  const handleMenuSelection = (e) => {
    const selectedId = e.target.value;
    setFormData(prev => ({ ...prev, menu_item_id: selectedId }));

    if (selectedId) {
      const item = menuItems.find(m => m.id === selectedId);
      if (item) {
        setFormData(prev => ({
          ...prev,
          item_name: item.item_name,
          unit_price: item.selling_price.toString(),
          menu_item_id: selectedId
        }));
      }
    }
  };

  // Calculate total amount
  const calculateTotal = () => {
    const quantity = parseFloat(formData.quantity) || 0;
    const unitPrice = parseFloat(formData.unit_price) || 0;
    return (quantity * unitPrice).toFixed(2);
  };

  // Get available stock for selected inventory item
  const getAvailableStock = () => {
    if (formData.sale_type === 'direct' && formData.inventory_item_id) {
      const item = inventoryItems.find(i => i.id === formData.inventory_item_id);
      return item ? `${parseFloat(item.stock_quantity).toFixed(2)} ${item.unit}` : 'N/A';
    }
    return 'N/A';
  };

  // Open modal for new sale
  const openAddModal = () => {
    setEditingSale(null);
    setFormData({
      sale_date: new Date().toISOString().split('T')[0],
      sale_type: 'direct',
      item_name: '',
      inventory_item_id: '',
      menu_item_id: '',
      quantity: '',
      unit_price: '',
      payment_method: 'cash',
      notes: '',
      recordAsIncome: true
    });
    setIsModalOpen(true);
  };

  // Open modal for editing
  const openEditModal = (sale) => {
    setEditingSale(sale);

    // Determine sale type based on what's linked
    let saleType = 'direct';
    if (sale.menu_item_id) {
      saleType = 'menu';
    } else if (sale.inventory_item_id) {
      saleType = 'direct';
    }

    setFormData({
      sale_date: sale.sale_date,
      sale_type: saleType,
      item_name: sale.item_name,
      inventory_item_id: sale.inventory_item_id || '',
      menu_item_id: sale.menu_item_id || '',
      quantity: sale.quantity.toString(),
      unit_price: sale.unit_price.toString(),
      payment_method: sale.payment_method,
      notes: sale.notes || '',
      recordAsIncome: false // Don't re-record when editing
    });
    setIsModalOpen(true);
  };

  // Handle submit - USES RPC FUNCTION
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.item_name || !formData.quantity || !formData.unit_price) {
      alert('Please fill all required fields');
      return;
    }

    if (formData.sale_type === 'direct' && !formData.inventory_item_id) {
      alert('Please select an inventory item');
      return;
    }

    if (formData.sale_type === 'menu' && !formData.menu_item_id) {
      alert('Please select a menu item');
      return;
    }

    const quantity = parseInt(formData.quantity);
    const unitPrice = parseFloat(formData.unit_price);
    const totalAmount = quantity * unitPrice;

    if (quantity <= 0) {
      alert('Quantity must be greater than 0');
      return;
    }

    try {
      if (editingSale) {
        // UPDATE SALE using RPC
        const { data, error } = await supabase.rpc('update_sale_and_adjust_inventory', {
          p_sale_id: editingSale.id,
          p_sale_date: formData.sale_date,
          p_item_name: formData.item_name,
          p_new_quantity: quantity,
          p_unit_price: unitPrice,
          p_total_amount: totalAmount,
          p_payment_method: formData.payment_method,
          p_notes: formData.notes || null
        });

        if (error) throw error;

        if (!data.success) {
          alert('Error: ' + data.error);
          return;
        }

        alert('Sale updated successfully!');
        setIsModalOpen(false);
        fetchSales();
        fetchInventoryItems();

      } else {
        // CREATE NEW SALE using RPC
        const { data, error } = await supabase.rpc('create_sale_with_inventory_deduction', {
          p_sale_date: formData.sale_date,
          p_item_name: formData.item_name,
          p_quantity: quantity,
          p_unit_price: unitPrice,
          p_total_amount: totalAmount,
          p_payment_method: formData.payment_method,
          p_notes: formData.notes || null,
          p_created_by: user.id,
          p_inventory_item_id: formData.sale_type === 'direct' ? formData.inventory_item_id : null,
          p_menu_item_id: formData.sale_type === 'menu' ? formData.menu_item_id : null,
          p_record_as_income: formData.recordAsIncome
        });

        if (error) throw error;

        if (!data.success) {
          // Show detailed error with available stock info
          if (data.available_stock !== undefined) {
            alert(`Cannot create sale:\n\n${data.error}\n\nAvailable: ${data.available_stock}`);
          } else if (data.insufficient_ingredients) {
            alert(`Cannot create sale:\n\n${data.error}`);
          } else {
            alert('Error: ' + data.error);
          }
          return;
        }

        alert(formData.recordAsIncome
          ? 'Sale created, inventory updated, and income recorded!'
          : 'Sale created and inventory updated!');
        setIsModalOpen(false);
        fetchSales();
        fetchInventoryItems();
      }
    } catch (error) {
      console.error('Error saving sale:', error);
      alert('Error saving sale: ' + error.message);
    }
  };

  // Handle delete - USES RPC FUNCTION
  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this sale?\n\nInventory will be restored and linked transaction will be deleted.')) {
      return;
    }

    try {
      const { data, error } = await supabase.rpc('delete_sale_and_restore_inventory', {
        p_sale_id: id
      });

      if (error) throw error;

      if (!data.success) {
        alert('Error: ' + data.error);
        return;
      }

      alert('Sale deleted successfully!');
      fetchSales();
      fetchInventoryItems();
    } catch (error) {
      console.error('Error deleting sale:', error);
      alert('Error deleting sale: ' + error.message);
    }
  };

  // Calculate total daily collection
  const calculateDailyTotal = () => {
    return sales.reduce((sum, sale) => sum + parseFloat(sale.total_amount), 0);
  };

  // Calculate product-wise breakdown
  const getProductWiseBreakdown = () => {
    const breakdown = {};

    sales.forEach(sale => {
      if (!breakdown[sale.item_name]) {
        breakdown[sale.item_name] = {
          totalQuantity: 0,
          totalAmount: 0
        };
      }
      breakdown[sale.item_name].totalQuantity += sale.quantity;
      breakdown[sale.item_name].totalAmount += parseFloat(sale.total_amount);
    });

    return Object.entries(breakdown).map(([productName, data]) => ({
      productName,
      totalQuantity: data.totalQuantity,
      totalAmount: data.totalAmount
    }));
  };

  const dailyTotal = calculateDailyTotal();
  const productBreakdown = getProductWiseBreakdown();

  return (
    <div className="p-3 sm:p-4 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Sales</h1>
        <button
          onClick={openAddModal}
          className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm sm:text-base"
        >
          + Add Sale
        </button>
      </div>

      {/* Total Daily Collection Card */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 p-4 sm:p-6 rounded-lg mb-4 sm:mb-6">
        <p className="text-xs sm:text-sm text-green-700 mb-1">Total Daily Collection</p>
        <p className="text-2xl sm:text-3xl font-bold text-green-600">₹{dailyTotal.toFixed(2)}</p>
      </div>

      {/* Product-wise Breakdown */}
      {productBreakdown.length > 0 && (
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-3">Product-wise Sales</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            {productBreakdown.map((item, index) => (
              <div key={index} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <p className="font-medium text-gray-800 mb-1 text-sm truncate">{item.productName}</p>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-600">Qty: {item.totalQuantity}</span>
                  <span className="font-semibold text-green-600">₹{item.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Date Filter */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4 mb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
          <div className="flex-1 w-full">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Filter by Date</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            />
          </div>
          {filterDate && (
            <button
              onClick={() => setFilterDate('')}
              className="w-full sm:w-auto sm:mt-6 text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear Filter
            </button>
          )}
        </div>
      </div>

      {/* Sales List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : sales.length === 0 ? (
          <div className="p-6 sm:p-8 text-center text-gray-500">
            <p className="text-sm sm:text-lg mb-2">No sales records found</p>
            <p className="text-xs sm:text-sm">Add your first sale to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Amount</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                      {new Date(sale.sale_date).toLocaleDateString()}
                    </td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-800">
                      <div className="flex items-center gap-1">
                        <span className="truncate max-w-[150px] sm:max-w-none">{sale.item_name}</span>
                        {sale.menu_item_id && (
                          <span className="text-purple-600 flex-shrink-0" title="Menu item with recipe">
                            🍽️
                          </span>
                        )}
                        {sale.inventory_item_id && (
                          <span className="text-green-600 flex-shrink-0" title="Direct inventory item">
                            📦
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 text-right">{sale.quantity}</td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 text-right whitespace-nowrap">₹{parseFloat(sale.unit_price).toFixed(2)}</td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-green-600 text-right whitespace-nowrap">
                      ₹{parseFloat(sale.total_amount).toFixed(2)}
                    </td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-center whitespace-nowrap">
                      <button
                        onClick={() => openEditModal(sale)}
                        className="text-blue-600 hover:text-blue-700 mr-2 sm:mr-3 text-xs sm:text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(sale.id)}
                        className="text-red-600 hover:text-red-700 text-xs sm:text-sm font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSale ? 'Edit Sale' : 'Add New Sale'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input
              type="date"
              name="sale_date"
              value={formData.sale_date}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Sale Type Selection - Only for new sales */}
          {!editingSale && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sale Type *</label>
              <div className="space-y-2">
                <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="sale_type"
                    value="direct"
                    checked={formData.sale_type === 'direct'}
                    onChange={handleChange}
                    className="mr-3"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">📦 Direct Inventory Item</span>
                    <p className="text-xs text-gray-500">Sell items directly from inventory (e.g., bottled water, snacks)</p>
                  </div>
                </label>
                <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="sale_type"
                    value="menu"
                    checked={formData.sale_type === 'menu'}
                    onChange={handleChange}
                    className="mr-3"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">🍽️ Menu Item (Prepared)</span>
                    <p className="text-xs text-gray-500">Sell prepared items using recipe ingredients (e.g., chai, coffee)</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Direct Inventory Item Selection */}
          {formData.sale_type === 'direct' && !editingSale && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Inventory Item *</label>
              <select
                name="inventory_item_id"
                value={formData.inventory_item_id}
                onChange={handleInventorySelection}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="">Choose an item...</option>
                {inventoryItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.item_name} (Stock: {parseFloat(item.stock_quantity).toFixed(2)} {item.unit})
                  </option>
                ))}
              </select>
              {formData.inventory_item_id && (
                <p className="text-xs text-green-600 mt-1">
                  ✓ Available stock: {getAvailableStock()}
                </p>
              )}
            </div>
          )}

          {/* Menu Item Selection */}
          {formData.sale_type === 'menu' && !editingSale && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Menu Item *</label>
              <select
                name="menu_item_id"
                value={formData.menu_item_id}
                onChange={handleMenuSelection}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="">Choose a menu item...</option>
                {menuItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.item_name} - ₹{parseFloat(item.selling_price).toFixed(2)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-purple-600 mt-1">
                ⓘ Recipe ingredients will be automatically deducted from inventory
              </p>
            </div>
          )}

          {/* Item Name (read-only after selection or editable in edit mode) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
            <input
              type="text"
              name="item_name"
              value={formData.item_name}
              onChange={handleChange}
              placeholder="Product name"
              required
              readOnly={!editingSale && (formData.inventory_item_id || formData.menu_item_id)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
            <input
              type="number"
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              placeholder="0"
              min="1"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price (₹) *</label>
            <input
              type="number"
              name="unit_price"
              value={formData.unit_price}
              onChange={handleChange}
              placeholder="0.00"
              step="0.01"
              min="0"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Auto-calculated Total */}
          <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
            <label className="block text-sm font-medium text-green-700 mb-1">Total Amount (Auto-calculated)</label>
            <p className="text-2xl font-bold text-green-600">₹{calculateTotal()}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select
              name="payment_method"
              value={formData.payment_method}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="upi">UPI</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Any additional notes"
              rows="2"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Record as Income Checkbox */}
          {!editingSale && (
            <div className="flex items-center space-x-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <input
                type="checkbox"
                id="recordAsIncome"
                name="recordAsIncome"
                checked={formData.recordAsIncome}
                onChange={handleChange}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="recordAsIncome" className="text-sm text-blue-800 cursor-pointer">
                Also record this sale as income in Daily Hisab
              </label>
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              {editingSale ? 'Update Sale' : 'Create Sale'}
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
    </div>
  );
}

export default Sales;
