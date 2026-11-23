import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';

function Purchases() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState(null);

  // Form state - NOW includes inventory linking
  const [formData, setFormData] = useState({
    purchase_date: new Date().toISOString().split('T')[0],
    supplier_id: '',
    item_name: '',
    quantity: '',
    unit: '',
    unit_price: '',
    payment_status: 'pending',
    paid_amount: '0',
    notes: '',
    // NEW: Inventory linking fields
    link_to_inventory: true, // Auto-link by default
    link_type: 'existing', // 'existing', 'create', 'skip'
    inventory_id: '',
    new_item_name: '',
    new_category: '',
    new_unit: '',
    new_min_stock: '0'
  });

  // Fetch suppliers for dropdown
  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  // Fetch inventory items for linking
  const fetchInventoryItems = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('id, item_name, unit, stock_quantity')
        .order('item_name', { ascending: true });

      if (error) throw error;
      setInventoryItems(data || []);
    } catch (error) {
      console.error('Error fetching inventory items:', error);
    }
  };

  // Fetch purchases with inventory link status
  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchases')
        .select(`
          *,
          suppliers (
            name
          )
        `)
        .order('purchase_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Check which purchases are linked to inventory
      if (data && data.length > 0) {
        const purchaseIds = data.map(p => p.id);
        const { data: movements } = await supabase
          .from('stock_movements')
          .select('reference_id')
          .eq('reference_type', 'purchase')
          .in('reference_id', purchaseIds);

        const linkedIds = new Set(movements?.map(m => m.reference_id) || []);
        const purchasesWithLinkStatus = data.map(p => ({
          ...p,
          is_linked: linkedIds.has(p.id)
        }));

        setPurchases(purchasesWithLinkStatus);
      } else {
        setPurchases([]);
      }
    } catch (error) {
      console.error('Error fetching purchases:', error);
      alert('Error loading purchases: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
    fetchInventoryItems();
    fetchPurchases();
  }, []);

  // Handle form change
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Calculate total amount
  const calculateTotal = () => {
    const quantity = parseFloat(formData.quantity) || 0;
    const unitPrice = parseFloat(formData.unit_price) || 0;
    return (quantity * unitPrice).toFixed(2);
  };

  // Calculate pending amount
  const calculatePending = () => {
    const total = parseFloat(calculateTotal());
    const paid = parseFloat(formData.paid_amount) || 0;
    return Math.max(0, total - paid).toFixed(2);
  };

  // Open modal for new purchase
  const openAddModal = () => {
    setEditingPurchase(null);
    setFormData({
      purchase_date: new Date().toISOString().split('T')[0],
      supplier_id: '',
      item_name: '',
      quantity: '',
      unit: '',
      unit_price: '',
      payment_status: 'pending',
      paid_amount: '0',
      notes: '',
      link_to_inventory: true,
      link_type: 'existing',
      inventory_id: '',
      new_item_name: '',
      new_category: '',
      new_unit: '',
      new_min_stock: '0'
    });
    setIsModalOpen(true);
  };

  // Open modal for editing
  const openEditModal = (purchase) => {
    setEditingPurchase(purchase);
    setFormData({
      purchase_date: purchase.purchase_date,
      supplier_id: purchase.supplier_id || '',
      item_name: purchase.item_name,
      quantity: purchase.quantity.toString(),
      unit: purchase.unit,
      unit_price: purchase.unit_price.toString(),
      payment_status: purchase.payment_status,
      paid_amount: purchase.paid_amount.toString(),
      notes: purchase.notes || '',
      link_to_inventory: false, // Don't show inventory section when editing
      link_type: 'skip',
      inventory_id: '',
      new_item_name: '',
      new_category: '',
      new_unit: '',
      new_min_stock: '0'
    });
    setIsModalOpen(true);
  };

  // Auto-fill "Create New Item" fields when item name changes
  useEffect(() => {
    if (formData.link_type === 'create' && formData.item_name) {
      setFormData(prev => ({
        ...prev,
        new_item_name: formData.item_name,
        new_unit: formData.unit
      }));
    }
  }, [formData.item_name, formData.unit, formData.link_type]);

  // Handle submit - NEW: Uses RPC function
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.item_name || !formData.quantity || !formData.unit_price || !formData.unit) {
      alert('Please fill all required fields');
      return;
    }

    const quantity = parseFloat(formData.quantity);
    const unitPrice = parseFloat(formData.unit_price);
    const totalAmount = quantity * unitPrice;
    let paidAmount = parseFloat(formData.paid_amount) || 0;

    if (paidAmount > totalAmount) {
      paidAmount = totalAmount;
    }

    const pendingAmount = totalAmount - paidAmount;

    let paymentStatus;
    if (paidAmount === 0) {
      paymentStatus = 'pending';
    } else if (paidAmount >= totalAmount) {
      paymentStatus = 'paid';
    } else {
      paymentStatus = 'partial';
    }

    try {
      if (editingPurchase) {
        // UPDATE PURCHASE using RPC
        const { data, error } = await supabase.rpc('update_purchase_and_adjust_inventory', {
          p_purchase_id: editingPurchase.id,
          p_supplier_id: formData.supplier_id || null,
          p_purchase_date: formData.purchase_date,
          p_item_name: formData.item_name,
          p_new_quantity: quantity,
          p_unit: formData.unit,
          p_unit_price: unitPrice,
          p_total_amount: totalAmount,
          p_paid_amount: paidAmount,
          p_pending_amount: pendingAmount,
          p_payment_status: paymentStatus,
          p_notes: formData.notes || null
        });

        if (error) throw error;

        if (!data.success) {
          alert('Error: ' + data.error);
          return;
        }

        alert('Purchase updated successfully!');
        setIsModalOpen(false);
        fetchPurchases();
        fetchInventoryItems();

      } else {
        // CREATE NEW PURCHASE using RPC

        // Determine inventory linking
        let inventoryId = null;
        let linkToInventory = formData.link_to_inventory && formData.link_type !== 'skip';

        if (linkToInventory) {
          if (formData.link_type === 'existing') {
            if (!formData.inventory_id) {
              alert('Please select an inventory item to link');
              return;
            }
            inventoryId = formData.inventory_id;

          } else if (formData.link_type === 'create') {
            if (!formData.new_item_name || !formData.new_unit) {
              alert('Please fill required fields for new inventory item');
              return;
            }

            // Create new inventory item first
            const { data: newItem, error: createError } = await supabase
              .from('inventory')
              .insert([{
                item_name: formData.new_item_name,
                category: formData.new_category || null,
                stock_quantity: 0, // Will be updated by RPC function
                unit: formData.new_unit,
                minimum_stock: parseFloat(formData.new_min_stock) || 0,
                created_by: user.id
              }])
              .select()
              .single();

            if (createError) throw createError;
            inventoryId = newItem.id;
          }
        }

        // Call RPC function to create purchase and update inventory atomically
        const { data, error } = await supabase.rpc('create_purchase_and_update_inventory', {
          p_supplier_id: formData.supplier_id || null,
          p_purchase_date: formData.purchase_date,
          p_item_name: formData.item_name,
          p_quantity: quantity,
          p_unit: formData.unit,
          p_unit_price: unitPrice,
          p_total_amount: totalAmount,
          p_paid_amount: paidAmount,
          p_pending_amount: pendingAmount,
          p_payment_status: paymentStatus,
          p_notes: formData.notes || null,
          p_created_by: user.id,
          p_inventory_id: inventoryId,
          p_link_to_inventory: linkToInventory
        });

        if (error) throw error;

        if (!data.success) {
          alert('Error: ' + data.error);
          return;
        }

        alert(linkToInventory ? 'Purchase created and inventory updated!' : 'Purchase created successfully!');
        setIsModalOpen(false);
        fetchPurchases();
        fetchInventoryItems();
      }
    } catch (error) {
      console.error('Error saving purchase:', error);
      alert('Error saving purchase: ' + error.message);
    }
  };

  // Handle delete - Uses RPC
  const handleDelete = async (id, itemName, isLinked) => {
    const confirmMessage = isLinked
      ? `This purchase is linked to inventory. Deleting will reverse the stock increase.\n\nAre you sure you want to delete "${itemName}"?`
      : `Are you sure you want to delete purchase "${itemName}"?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const { data, error } = await supabase.rpc('delete_purchase_and_reverse_inventory', {
        p_purchase_id: id
      });

      if (error) throw error;

      if (!data.success) {
        alert('Error: ' + data.error);
        return;
      }

      alert('Purchase deleted successfully!');
      fetchPurchases();
      fetchInventoryItems();
    } catch (error) {
      console.error('Error deleting purchase:', error);
      alert('Error deleting purchase: ' + error.message);
    }
  };

  // Calculate summary totals
  const calculateTotals = () => {
    return purchases.reduce((acc, p) => ({
      totalPurchases: acc.totalPurchases + parseFloat(p.total_amount),
      totalPaid: acc.totalPaid + parseFloat(p.paid_amount),
      totalPending: acc.totalPending + parseFloat(p.pending_amount)
    }), { totalPurchases: 0, totalPaid: 0, totalPending: 0 });
  };

  const totals = calculateTotals();

  return (
    <div className="p-3 sm:p-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Purchases</h1>
        <button
          onClick={openAddModal}
          className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm sm:text-base"
        >
          + Add Purchase
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-blue-50 border border-blue-200 p-4 sm:p-6 rounded-lg">
          <p className="text-xs sm:text-sm text-blue-700 mb-1">Total Purchases</p>
          <p className="text-2xl sm:text-3xl font-bold text-blue-600">₹{totals.totalPurchases.toFixed(2)}</p>
        </div>
        <div className="bg-green-50 border border-green-200 p-4 sm:p-6 rounded-lg">
          <p className="text-xs sm:text-sm text-green-700 mb-1">Total Paid</p>
          <p className="text-2xl sm:text-3xl font-bold text-green-600">₹{totals.totalPaid.toFixed(2)}</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 p-4 sm:p-6 rounded-lg">
          <p className="text-xs sm:text-sm text-orange-700 mb-1">Total Pending</p>
          <p className="text-2xl sm:text-3xl font-bold text-orange-600">₹{totals.totalPending.toFixed(2)}</p>
        </div>
      </div>

      {/* Purchases List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : purchases.length === 0 ? (
          <div className="p-6 sm:p-8 text-center text-gray-500">
            <p className="text-sm sm:text-lg mb-2">No purchases found</p>
            <p className="text-xs sm:text-sm">Add your first purchase to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty × Price</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Pending</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {purchases.map((purchase) => (
                  <tr key={purchase.id} className="hover:bg-gray-50">
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                      {new Date(purchase.purchase_date).toLocaleDateString()}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-800">
                      <span className="truncate max-w-[80px] sm:max-w-none inline-block">{purchase.suppliers?.name || 'N/A'}</span>
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-800">
                      <div className="flex items-center gap-1">
                        <span className="truncate max-w-[100px] sm:max-w-none">{purchase.item_name}</span>
                        {purchase.is_linked && (
                          <span className="text-green-600 flex-shrink-0" title="Linked to inventory">
                            📦
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 text-right whitespace-nowrap">
                      {parseFloat(purchase.quantity).toFixed(2)} {purchase.unit} × ₹{parseFloat(purchase.unit_price).toFixed(2)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-gray-800 text-right whitespace-nowrap">
                      ₹{parseFloat(purchase.total_amount).toFixed(2)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-green-600 text-right whitespace-nowrap">
                      ₹{parseFloat(purchase.paid_amount).toFixed(2)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right whitespace-nowrap">
                      <span className={parseFloat(purchase.pending_amount) > 0 ? 'text-orange-600 font-semibold' : 'text-gray-600'}>
                        ₹{parseFloat(purchase.pending_amount).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${purchase.payment_status === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : purchase.payment_status === 'partial'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                        {purchase.payment_status}
                      </span>
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-center whitespace-nowrap">
                      <button
                        onClick={() => openEditModal(purchase)}
                        className="text-blue-600 hover:text-blue-700 mr-1 sm:mr-2 text-xs sm:text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(purchase.id, purchase.item_name, purchase.is_linked)}
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

      {/* Add/Edit Purchase Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPurchase ? 'Edit Purchase' : 'Add New Purchase'}
      >
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date *</label>
            <input
              type="date"
              name="purchase_date"
              value={formData.purchase_date}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
            <select
              name="supplier_id"
              value={formData.supplier_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">Select Supplier (Optional)</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item/Product Name *</label>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                placeholder="0"
                step="0.01"
                min="0.01"
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
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <label className="block text-sm font-medium text-blue-700 mb-1">Total Amount (Auto-calculated)</label>
            <p className="text-2xl font-bold text-blue-600">₹{calculateTotal()}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Status *</label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="payment_status"
                  value="paid"
                  checked={formData.payment_status === 'paid'}
                  onChange={handleChange}
                  className="mr-2"
                />
                <span className="text-sm">Paid (Full payment made)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="payment_status"
                  value="partial"
                  checked={formData.payment_status === 'partial'}
                  onChange={handleChange}
                  className="mr-2"
                />
                <span className="text-sm">Partial (Some payment made)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="payment_status"
                  value="pending"
                  checked={formData.payment_status === 'pending'}
                  onChange={handleChange}
                  className="mr-2"
                />
                <span className="text-sm">Pending (No payment yet)</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid (₹)</label>
            <input
              type="number"
              name="paid_amount"
              value={formData.paid_amount}
              onChange={handleChange}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Auto-calculated Pending */}
          <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
            <label className="block text-sm font-medium text-orange-700 mb-1">Pending Amount (Auto-calculated)</label>
            <p className="text-2xl font-bold text-orange-600">₹{calculatePending()}</p>
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

          {/* INVENTORY LINKING SECTION - Only show for new purchases */}
          {!editingPurchase && (
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center mb-3">
                <input
                  type="checkbox"
                  id="link_to_inventory"
                  name="link_to_inventory"
                  checked={formData.link_to_inventory}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="link_to_inventory" className="ml-2 text-sm font-medium text-gray-700 cursor-pointer">
                  📦 Link to Inventory & Auto-Update Stock
                </label>
              </div>

              {formData.link_to_inventory && (
                <div className="bg-green-50 border border-green-200 p-4 rounded-lg space-y-3">
                  <p className="text-xs text-green-700 mb-2">
                    ✓ Stock will be automatically increased when purchase is saved
                  </p>

                  <div className="space-y-3">
                    <label className="flex items-start p-3 border-2 border-gray-300 rounded-lg cursor-pointer hover:bg-white">
                      <input
                        type="radio"
                        name="link_type"
                        value="existing"
                        checked={formData.link_type === 'existing'}
                        onChange={handleChange}
                        className="mt-1 mr-3"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-700">Link to existing inventory item</span>
                        {formData.link_type === 'existing' && (
                          <select
                            name="inventory_id"
                            value={formData.inventory_id}
                            onChange={handleChange}
                            required={formData.link_type === 'existing'}
                            className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                          >
                            <option value="">Select Inventory Item</option>
                            {inventoryItems.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.item_name} (Current: {item.stock_quantity} {item.unit})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </label>

                    <label className="flex items-start p-3 border-2 border-gray-300 rounded-lg cursor-pointer hover:bg-white">
                      <input
                        type="radio"
                        name="link_type"
                        value="create"
                        checked={formData.link_type === 'create'}
                        onChange={handleChange}
                        className="mt-1 mr-3"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-700">Create new inventory item</span>
                        {formData.link_type === 'create' && (
                          <div className="mt-3 space-y-2">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Item Name *</label>
                              <input
                                type="text"
                                name="new_item_name"
                                value={formData.new_item_name}
                                onChange={handleChange}
                                required={formData.link_type === 'create'}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Category</label>
                              <input
                                type="text"
                                name="new_category"
                                value={formData.new_category}
                                onChange={handleChange}
                                placeholder="e.g., Grains, Dairy"
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Unit *</label>
                                <input
                                  type="text"
                                  name="new_unit"
                                  value={formData.new_unit}
                                  onChange={handleChange}
                                  required={formData.link_type === 'create'}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Min Stock</label>
                                <input
                                  type="number"
                                  name="new_min_stock"
                                  value={formData.new_min_stock}
                                  onChange={handleChange}
                                  step="0.01"
                                  min="0"
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </label>

                    <label className="flex items-start p-3 border-2 border-gray-300 rounded-lg cursor-pointer hover:bg-white">
                      <input
                        type="radio"
                        name="link_type"
                        value="skip"
                        checked={formData.link_type === 'skip'}
                        onChange={handleChange}
                        className="mt-1 mr-3"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-700">Skip (don't track in inventory)</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              {editingPurchase ? 'Update Purchase' : 'Create Purchase'}
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

export default Purchases;
