import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';

function Inventory() {
  const { user } = useAuth();
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [stockMovements, setStockMovements] = useState([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    item_name: '',
    category: '',
    stock_quantity: '',
    unit: '',
    minimum_stock: '0',
    notes: ''
  });

  // Adjustment form state
  const [adjustmentData, setAdjustmentData] = useState({
    adjustment_type: 'increase', // increase, decrease, wastage
    quantity: '',
    adjustment_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Fetch inventory items
  const fetchInventoryItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('item_name', { ascending: true });

      if (error) throw error;
      setInventoryItems(data || []);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      alert('Error loading inventory: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventoryItems();
  }, []);

  // Handle form change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle adjustment form change
  const handleAdjustmentChange = (e) => {
    const { name, value } = e.target;
    setAdjustmentData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Open modal for new item
  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      item_name: '',
      category: '',
      stock_quantity: '',
      unit: '',
      minimum_stock: '0',
      notes: ''
    });
    setIsModalOpen(true);
  };

  // Open modal for editing
  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      item_name: item.item_name,
      category: item.category || '',
      stock_quantity: item.stock_quantity.toString(),
      unit: item.unit,
      minimum_stock: item.minimum_stock.toString(),
      notes: item.notes || ''
    });
    setIsModalOpen(true);
  };

  // Open adjustment modal
  const openAdjustmentModal = (item) => {
    setSelectedItem(item);
    setAdjustmentData({
      adjustment_type: 'increase',
      quantity: '',
      adjustment_date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setIsAdjustmentModalOpen(true);
  };

  // Open history modal
  const openHistoryModal = async (item) => {
    setSelectedItem(item);
    setIsHistoryModalOpen(true);
    setLoadingMovements(true);

    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          *,
          purchases:reference_id (
            item_name
          )
        `)
        .eq('inventory_id', item.id)
        .order('movement_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStockMovements(data || []);
    } catch (error) {
      console.error('Error fetching stock movements:', error);
      alert('Error loading stock history: ' + error.message);
    } finally {
      setLoadingMovements(false);
    }
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.item_name || !formData.stock_quantity || !formData.unit) {
      alert('Please fill all required fields');
      return;
    }

    const stockQuantity = parseFloat(formData.stock_quantity);
    const minimumStock = parseFloat(formData.minimum_stock) || 0;

    if (stockQuantity < 0 || minimumStock < 0) {
      alert('Quantities cannot be negative');
      return;
    }

    try {
      const itemData = {
        item_name: formData.item_name,
        category: formData.category || null,
        stock_quantity: stockQuantity,
        unit: formData.unit,
        minimum_stock: minimumStock,
        notes: formData.notes || null,
        created_by: user.id
      };

      if (editingItem) {
        // Update existing item
        const { error } = await supabase
          .from('inventory')
          .update(itemData)
          .eq('id', editingItem.id);

        if (error) throw error;
        alert('Inventory item updated successfully!');
      } else {
        // Insert new item
        const { error } = await supabase
          .from('inventory')
          .insert([itemData]);

        if (error) throw error;
        alert('Inventory item added successfully!');
      }

      setIsModalOpen(false);
      fetchInventoryItems();
    } catch (error) {
      console.error('Error saving inventory item:', error);
      alert('Error saving inventory item: ' + error.message);
    }
  };

  // Handle stock adjustment
  const handleAdjustment = async (e) => {
    e.preventDefault();

    if (!adjustmentData.quantity || parseFloat(adjustmentData.quantity) <= 0) {
      alert('Please enter a valid quantity');
      return;
    }

    const quantity = parseFloat(adjustmentData.quantity);
    let movementType = '';
    let finalQuantity = quantity;

    // Determine movement type and quantity sign
    if (adjustmentData.adjustment_type === 'increase') {
      movementType = 'adjustment_in';
      finalQuantity = quantity;
    } else if (adjustmentData.adjustment_type === 'decrease') {
      movementType = 'adjustment_out';
      finalQuantity = -quantity;
    } else if (adjustmentData.adjustment_type === 'wastage') {
      movementType = 'wastage';
      finalQuantity = -quantity;
    }

    // Check if decrease/wastage would result in negative stock
    const newStockQuantity = selectedItem.stock_quantity + finalQuantity;
    if (newStockQuantity < 0) {
      alert('Cannot decrease stock below zero. Current stock: ' + selectedItem.stock_quantity);
      return;
    }

    try {
      // 1. Create stock movement record
      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert([{
          inventory_id: selectedItem.id,
          movement_date: adjustmentData.adjustment_date,
          movement_type: movementType,
          quantity: finalQuantity,
          reference_type: 'manual',
          reference_id: null,
          notes: adjustmentData.notes || null,
          created_by: user.id
        }]);

      if (movementError) throw movementError;

      // 2. Update inventory stock quantity
      const updateData = {
        stock_quantity: newStockQuantity
      };

      // If wastage, also update wastage field
      if (adjustmentData.adjustment_type === 'wastage') {
        updateData.wastage = (selectedItem.wastage || 0) + quantity;
      }

      const { error: updateError } = await supabase
        .from('inventory')
        .update(updateData)
        .eq('id', selectedItem.id);

      if (updateError) throw updateError;

      alert('Stock adjusted successfully!');
      setIsAdjustmentModalOpen(false);
      fetchInventoryItems();
    } catch (error) {
      console.error('Error adjusting stock:', error);
      alert('Error adjusting stock: ' + error.message);
    }
  };

  // Handle delete
  const handleDelete = async (id, itemName) => {
    if (!confirm(`Are you sure you want to delete "${itemName}" from inventory?\n\nThis will also delete all stock movement history for this item.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('Inventory item deleted successfully!');
      fetchInventoryItems();
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      alert('Error deleting inventory item: ' + error.message);
    }
  };

  // Calculate summary stats
  const calculateStats = () => {
    const totalItems = inventoryItems.length;
    const lowStockItems = inventoryItems.filter(item =>
      parseFloat(item.stock_quantity) <= parseFloat(item.minimum_stock)
    ).length;
    const outOfStockItems = inventoryItems.filter(item =>
      parseFloat(item.stock_quantity) === 0
    ).length;
    const totalValue = inventoryItems.reduce((sum, item) =>
      sum + (parseFloat(item.stock_quantity) * parseFloat(item.last_purchase_price || 0)), 0
    );

    return { totalItems, lowStockItems, outOfStockItems, totalValue };
  };

  const stats = calculateStats();

  // Get low stock items for alert section
  const lowStockItems = inventoryItems.filter(item =>
    parseFloat(item.stock_quantity) <= parseFloat(item.minimum_stock) &&
    parseFloat(item.stock_quantity) > 0
  );

  const outOfStockItems = inventoryItems.filter(item =>
    parseFloat(item.stock_quantity) === 0
  );

  // Check if item is low stock
  const isLowStock = (item) => {
    return parseFloat(item.stock_quantity) <= parseFloat(item.minimum_stock);
  };

  // Get stock status badge
  const getStockStatusBadge = (item) => {
    const stock = parseFloat(item.stock_quantity);
    const minStock = parseFloat(item.minimum_stock);

    if (stock === 0) {
      return <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">Out of Stock</span>;
    } else if (stock <= minStock) {
      return <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">Low Stock</span>;
    } else {
      return <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">In Stock</span>;
    }
  };

  return (
    <div className="p-3 sm:p-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Inventory</h1>
        <button
          onClick={openAddModal}
          className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm sm:text-base"
        >
          + Add Item
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-blue-50 border border-blue-200 p-4 sm:p-6 rounded-lg">
          <p className="text-xs sm:text-sm text-blue-700 mb-1">Total Items</p>
          <p className="text-2xl sm:text-3xl font-bold text-blue-600">{stats.totalItems}</p>
        </div>
        <div className={`border p-4 sm:p-6 rounded-lg ${stats.lowStockItems > 0 ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
          <p className={`text-xs sm:text-sm mb-1 ${stats.lowStockItems > 0 ? 'text-orange-700' : 'text-gray-600'}`}>Low Stock Items</p>
          <p className={`text-2xl sm:text-3xl font-bold ${stats.lowStockItems > 0 ? 'text-orange-600' : 'text-gray-600'}`}>{stats.lowStockItems}</p>
        </div>
        <div className={`border p-4 sm:p-6 rounded-lg ${stats.outOfStockItems > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
          <p className={`text-xs sm:text-sm mb-1 ${stats.outOfStockItems > 0 ? 'text-red-700' : 'text-gray-600'}`}>Out of Stock</p>
          <p className={`text-2xl sm:text-3xl font-bold ${stats.outOfStockItems > 0 ? 'text-red-600' : 'text-gray-600'}`}>{stats.outOfStockItems}</p>
        </div>
        <div className="bg-green-50 border border-green-200 p-4 sm:p-6 rounded-lg">
          <p className="text-xs sm:text-sm text-green-700 mb-1">Inventory Value</p>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600">₹{stats.totalValue.toFixed(2)}</p>
        </div>
      </div>

      {/* Low Stock Alert Section */}
      {(lowStockItems.length > 0 || outOfStockItems.length > 0) && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 sm:p-4 mb-4 sm:mb-6 rounded-r-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <span className="text-xl sm:text-2xl">⚠️</span>
            </div>
            <div className="ml-2 sm:ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800 mb-2">Stock Alert</h3>

              {outOfStockItems.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs sm:text-sm font-semibold text-red-700 mb-1">Out of Stock ({outOfStockItems.length}):</p>
                  <ul className="text-xs sm:text-sm text-red-700 space-y-1">
                    {outOfStockItems.map(item => (
                      <li key={item.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                        <span className="break-words">🔴 {item.item_name} - 0 {item.unit}</span>
                        <button
                          onClick={() => openAdjustmentModal(item)}
                          className="text-xs text-red-600 hover:text-red-800 font-medium underline self-start sm:self-auto"
                        >
                          Add Stock
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {lowStockItems.length > 0 && (
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-orange-700 mb-1">Low Stock ({lowStockItems.length}):</p>
                  <ul className="text-xs sm:text-sm text-orange-700 space-y-1">
                    {lowStockItems.map(item => (
                      <li key={item.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                        <span className="break-words">
                          🟠 {item.item_name} - Current: {parseFloat(item.stock_quantity).toFixed(2)} {item.unit},
                          Min: {parseFloat(item.minimum_stock).toFixed(2)} {item.unit}
                        </span>
                        <button
                          onClick={() => openAdjustmentModal(item)}
                          className="text-xs text-orange-600 hover:text-orange-800 font-medium underline self-start sm:self-auto"
                        >
                          Add Stock
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Inventory Items Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : inventoryItems.length === 0 ? (
          <div className="p-6 sm:p-8 text-center text-gray-500">
            <p className="text-sm sm:text-lg mb-2">No inventory items found</p>
            <p className="text-xs sm:text-sm">Add your first inventory item to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Name</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Stock Quantity</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Min Stock</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {inventoryItems.map((item) => (
                  <tr key={item.id} className={`hover:bg-gray-50 ${isLowStock(item) ? 'bg-red-50' : ''}`}>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-800">
                      <span className="truncate max-w-[120px] sm:max-w-none inline-block">{item.item_name}</span>
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600">
                      {item.category ? (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                          {item.category}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className={`px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right font-semibold whitespace-nowrap ${parseFloat(item.stock_quantity) === 0 ? 'text-red-600' :
                        isLowStock(item) ? 'text-orange-600' : 'text-green-600'
                      }`}>
                      {parseFloat(item.stock_quantity).toFixed(2)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 text-right">{item.unit}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 text-right whitespace-nowrap">
                      {parseFloat(item.minimum_stock).toFixed(2)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                      {getStockStatusBadge(item)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                      <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 items-center justify-center">
                        <button
                          onClick={() => openAdjustmentModal(item)}
                          className="text-green-600 hover:text-green-700 text-xs sm:text-sm font-medium whitespace-nowrap"
                          title="Adjust Stock"
                        >
                          Adjust
                        </button>
                        <button
                          onClick={() => openHistoryModal(item)}
                          className="text-blue-600 hover:text-blue-700 text-xs sm:text-sm font-medium whitespace-nowrap"
                          title="View History"
                        >
                          History
                        </button>
                        <button
                          onClick={() => openEditModal(item)}
                          className="text-gray-600 hover:text-gray-700 text-xs sm:text-sm font-medium whitespace-nowrap"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, item.item_name)}
                          className="text-red-600 hover:text-red-700 text-xs sm:text-sm font-medium whitespace-nowrap"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Item Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Edit Inventory Item' : 'Add New Inventory Item'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
            <input
              type="text"
              name="item_name"
              value={formData.item_name}
              onChange={handleChange}
              placeholder="e.g., Rice, Sugar, Milk"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <input
              type="text"
              name="category"
              value={formData.category}
              onChange={handleChange}
              placeholder="e.g., Vegetables, Dairy, Spices"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">Optional - helps organize your inventory</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Stock *</label>
              <input
                type="number"
                name="stock_quantity"
                value={formData.stock_quantity}
                onChange={handleChange}
                placeholder="0"
                step="0.01"
                min="0"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
              <input
                type="text"
                name="unit"
                value={formData.unit}
                onChange={handleChange}
                placeholder="kg, liter, pieces"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Stock Level</label>
            <input
              type="number"
              name="minimum_stock"
              value={formData.minimum_stock}
              onChange={handleChange}
              placeholder="0"
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">Alert when stock reaches this level</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Any additional notes"
              rows="2"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              {editingItem ? 'Update' : 'Add'} Item
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

      {/* Stock Adjustment Modal */}
      <Modal
        isOpen={isAdjustmentModalOpen}
        onClose={() => setIsAdjustmentModalOpen(false)}
        title={`Adjust Stock: ${selectedItem?.item_name}`}
      >
        <form onSubmit={handleAdjustment} className="space-y-4">
          {/* Current Stock Display */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <p className="text-sm text-blue-700 mb-1">Current Stock</p>
            <p className="text-2xl font-bold text-blue-600">
              {selectedItem ? parseFloat(selectedItem.stock_quantity).toFixed(2) : '0'} {selectedItem?.unit}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Adjustment Type *</label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="adjustment_type"
                  value="increase"
                  checked={adjustmentData.adjustment_type === 'increase'}
                  onChange={handleAdjustmentChange}
                  className="mr-2"
                />
                <span className="text-sm">Increase Stock (purchase/addition)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="adjustment_type"
                  value="decrease"
                  checked={adjustmentData.adjustment_type === 'decrease'}
                  onChange={handleAdjustmentChange}
                  className="mr-2"
                />
                <span className="text-sm">Decrease Stock (usage/sale)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="adjustment_type"
                  value="wastage"
                  checked={adjustmentData.adjustment_type === 'wastage'}
                  onChange={handleAdjustmentChange}
                  className="mr-2"
                />
                <span className="text-sm">Record Wastage (damaged/expired)</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
            <input
              type="number"
              name="quantity"
              value={adjustmentData.quantity}
              onChange={handleAdjustmentChange}
              placeholder="0"
              step="0.01"
              min="0.01"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input
              type="date"
              name="adjustment_date"
              value={adjustmentData.adjustment_date}
              onChange={handleAdjustmentChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              name="notes"
              value={adjustmentData.notes}
              onChange={handleAdjustmentChange}
              placeholder="Reason for adjustment"
              rows="2"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Preview new stock */}
          {adjustmentData.quantity && (
            <div className={`border p-4 rounded-lg ${adjustmentData.adjustment_type === 'increase' ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'
              }`}>
              <p className={`text-sm mb-1 ${adjustmentData.adjustment_type === 'increase' ? 'text-green-700' : 'text-orange-700'
                }`}>
                New Stock After Adjustment
              </p>
              <p className={`text-2xl font-bold ${adjustmentData.adjustment_type === 'increase' ? 'text-green-600' : 'text-orange-600'
                }`}>
                {selectedItem && adjustmentData.quantity ? (
                  adjustmentData.adjustment_type === 'increase'
                    ? (parseFloat(selectedItem.stock_quantity) + parseFloat(adjustmentData.quantity)).toFixed(2)
                    : (parseFloat(selectedItem.stock_quantity) - parseFloat(adjustmentData.quantity)).toFixed(2)
                ) : '0'} {selectedItem?.unit}
              </p>
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Submit Adjustment
            </button>
            <button
              type="button"
              onClick={() => setIsAdjustmentModalOpen(false)}
              className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Stock Movement History Modal */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`Stock History: ${selectedItem?.item_name}`}
      >
        <div className="space-y-4">
          {/* Current Stock Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <p className="text-sm text-blue-700 mb-1">Current Stock</p>
              <p className="text-2xl font-bold text-blue-600">
                {selectedItem ? parseFloat(selectedItem.stock_quantity).toFixed(2) : '0'} {selectedItem?.unit}
              </p>
            </div>
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
              <p className="text-sm text-red-700 mb-1">Total Wastage</p>
              <p className="text-2xl font-bold text-red-600">
                {selectedItem ? parseFloat(selectedItem.wastage || 0).toFixed(2) : '0'} {selectedItem?.unit}
              </p>
            </div>
          </div>

          {/* Movement History */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Movement History</h3>
            {loadingMovements ? (
              <LoadingSpinner />
            ) : stockMovements.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No stock movements yet</p>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {stockMovements.map((movement) => (
                      <tr key={movement.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-600">
                          {new Date(movement.movement_date).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${movement.movement_type === 'purchase' ? 'bg-blue-100 text-blue-700' :
                              movement.movement_type === 'adjustment_in' ? 'bg-green-100 text-green-700' :
                                movement.movement_type === 'wastage' ? 'bg-red-100 text-red-700' :
                                  'bg-orange-100 text-orange-700'
                            }`}>
                            {movement.movement_type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className={`px-3 py-2 text-right font-semibold ${parseFloat(movement.quantity) > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                          {parseFloat(movement.quantity) > 0 ? '+' : ''}{parseFloat(movement.quantity).toFixed(2)} {selectedItem?.unit}
                        </td>
                        <td className="px-3 py-2 text-gray-600 text-xs">
                          {movement.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="pt-4">
            <button
              onClick={() => setIsHistoryModalOpen(false)}
              className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default Inventory;
