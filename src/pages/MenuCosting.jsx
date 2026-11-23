import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';

function MenuCosting() {
  const { user } = useAuth();
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    item_name: '',
    category: '',
    selling_price: '',
    cost_price: ''
  });

  // Fetch menu items
  const fetchMenuItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .order('item_name', { ascending: true });

      if (error) throw error;
      setMenuItems(data || []);
    } catch (error) {
      console.error('Error fetching menu items:', error);
      alert('Error loading menu items: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenuItems();
  }, []);

  // Handle form change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Calculate profit preview (frontend only)
  const calculateProfitPreview = () => {
    const selling = parseFloat(formData.selling_price) || 0;
    const cost = parseFloat(formData.cost_price) || 0;
    const profit = selling - cost;
    return profit.toFixed(2);
  };

  // Calculate profit percentage preview (frontend only)
  const calculateProfitPercentagePreview = () => {
    const selling = parseFloat(formData.selling_price) || 0;
    const cost = parseFloat(formData.cost_price) || 0;
    
    if (cost === 0) return '0.00';
    
    const percentage = ((selling - cost) / cost) * 100;
    return percentage.toFixed(2);
  };

  // Open modal for new item
  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      item_name: '',
      category: '',
      selling_price: '',
      cost_price: ''
    });
    setIsModalOpen(true);
  };

  // Open modal for editing
  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      item_name: item.item_name,
      category: item.category || '',
      selling_price: item.selling_price.toString(),
      cost_price: item.cost_price.toString()
    });
    setIsModalOpen(true);
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.item_name || !formData.selling_price || !formData.cost_price) {
      alert('Please fill all required fields');
      return;
    }

    const sellingPrice = parseFloat(formData.selling_price);
    const costPrice = parseFloat(formData.cost_price);

    if (sellingPrice < 0 || costPrice < 0) {
      alert('Prices cannot be negative');
      return;
    }

    try {
      const itemData = {
        item_name: formData.item_name,
        category: formData.category || null,
        selling_price: sellingPrice,
        cost_price: costPrice,
        created_by: user.id
      };

      if (editingItem) {
        // Update existing item
        const { error } = await supabase
          .from('menu_items')
          .update(itemData)
          .eq('id', editingItem.id);

        if (error) throw error;
        alert('Menu item updated successfully!');
      } else {
        // Insert new item
        const { error } = await supabase
          .from('menu_items')
          .insert([itemData]);

        if (error) throw error;
        alert('Menu item added successfully!');
      }

      setIsModalOpen(false);
      fetchMenuItems();
    } catch (error) {
      console.error('Error saving menu item:', error);
      alert('Error saving menu item: ' + error.message);
    }
  };

  // Handle delete
  const handleDelete = async (id, itemName) => {
    if (!confirm(`Are you sure you want to delete "${itemName}" from the menu?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('Menu item deleted successfully!');
      fetchMenuItems();
    } catch (error) {
      console.error('Error deleting menu item:', error);
      alert('Error deleting menu item: ' + error.message);
    }
  };

  // Get profit color class based on percentage
  const getProfitColorClass = (percentage) => {
    const percent = parseFloat(percentage);
    if (percent >= 50) return 'text-green-600';
    if (percent >= 25) return 'text-yellow-600';
    return 'text-orange-600';
  };

  return (
    <div className="p-3 sm:p-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Menu & Costing</h1>
        <button
          onClick={openAddModal}
          className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm sm:text-base"
        >
          + Add Menu Item
        </button>
      </div>

      {/* Menu Items List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : menuItems.length === 0 ? (
          <div className="p-6 sm:p-8 text-center text-gray-500">
            <p className="text-sm sm:text-lg mb-2">No menu items found</p>
            <p className="text-xs sm:text-sm">Add your first menu item to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Name</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Selling Price</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Cost Price</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Profit per Item</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Profit %</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {menuItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
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
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-800 text-right font-medium whitespace-nowrap">
                      ₹{parseFloat(item.selling_price).toFixed(2)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 text-right whitespace-nowrap">
                      ₹{parseFloat(item.cost_price).toFixed(2)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right whitespace-nowrap">
                      <span className={`font-semibold ${getProfitColorClass(item.profit_percentage)}`}>
                        ₹{parseFloat(item.profit_margin).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right whitespace-nowrap">
                      <span className={`font-bold ${getProfitColorClass(item.profit_percentage)}`}>
                        {parseFloat(item.profit_percentage).toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-center whitespace-nowrap">
                      <button
                        onClick={() => openEditModal(item)}
                        className="text-blue-600 hover:text-blue-700 mr-2 sm:mr-3 text-xs sm:text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id, item.item_name)}
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
        title={editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
            <input
              type="text"
              name="item_name"
              value={formData.item_name}
              onChange={handleChange}
              placeholder="e.g., Coffee, Tea, Sandwich"
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
              placeholder="e.g., Beverages, Food, Snacks"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">Optional - helps organize your menu</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price (₹) *</label>
              <input
                type="number"
                name="selling_price"
                value={formData.selling_price}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
                min="0"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price (₹) *</label>
              <input
                type="number"
                name="cost_price"
                value={formData.cost_price}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
                min="0"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Profit Preview */}
          {(formData.selling_price || formData.cost_price) && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 p-4 rounded-lg">
              <p className="text-sm font-medium text-green-700 mb-2">Profit Preview</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-green-600 mb-1">Profit per Item</p>
                  <p className="text-2xl font-bold text-green-700">₹{calculateProfitPreview()}</p>
                </div>
                <div>
                  <p className="text-xs text-green-600 mb-1">Profit Margin</p>
                  <p className="text-2xl font-bold text-green-700">{calculateProfitPercentagePreview()}%</p>
                </div>
              </div>
              <p className="text-xs text-green-600 mt-2">
                Final values will be calculated by the database after saving
              </p>
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              {editingItem ? 'Update' : 'Add'} Menu Item
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

export default MenuCosting;
