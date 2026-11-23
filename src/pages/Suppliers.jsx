import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';

function Suppliers() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [viewingSupplier, setViewingSupplier] = useState(null);
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [supplierTotals, setSupplierTotals] = useState({});

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: ''
  });

  // Fetch suppliers
  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      
      const suppliersData = data || [];
      setSuppliers(suppliersData);

      // Fetch purchase totals for each supplier
      await fetchAllSupplierTotals(suppliersData);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      alert('Error loading suppliers: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch purchase totals for all suppliers
  const fetchAllSupplierTotals = async (suppliersData) => {
    try {
      const totalsMap = {};

      for (const supplier of suppliersData) {
        const { data: purchases } = await supabase
          .from('purchases')
          .select('total_amount, paid_amount, pending_amount')
          .eq('supplier_id', supplier.id);

        if (purchases && purchases.length > 0) {
          const totals = purchases.reduce((acc, p) => ({
            totalPurchases: acc.totalPurchases + parseFloat(p.total_amount || 0),
            totalPaid: acc.totalPaid + parseFloat(p.paid_amount || 0),
            totalPending: acc.totalPending + parseFloat(p.pending_amount || 0)
          }), { totalPurchases: 0, totalPaid: 0, totalPending: 0 });

          totalsMap[supplier.id] = totals;
        } else {
          totalsMap[supplier.id] = { totalPurchases: 0, totalPaid: 0, totalPending: 0 };
        }
      }

      setSupplierTotals(totalsMap);
    } catch (error) {
      console.error('Error fetching supplier totals:', error);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  // Handle form change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Open modal for new supplier
  const openAddModal = () => {
    setEditingSupplier(null);
    setFormData({
      name: '',
      phone: '',
      address: ''
    });
    setIsModalOpen(true);
  };

  // Open modal for editing
  const openEditModal = (supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      phone: supplier.phone || '',
      address: supplier.address || ''
    });
    setIsModalOpen(true);
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name) {
      alert('Please enter supplier name');
      return;
    }

    try {
      const supplierData = {
        name: formData.name,
        phone: formData.phone || null,
        address: formData.address || null,
        created_by: user.id
      };

      if (editingSupplier) {
        // Update existing supplier
        const { error } = await supabase
          .from('suppliers')
          .update(supplierData)
          .eq('id', editingSupplier.id);

        if (error) throw error;
        alert('Supplier updated successfully!');
      } else {
        // Insert new supplier
        const { error } = await supabase
          .from('suppliers')
          .insert([supplierData]);

        if (error) throw error;
        alert('Supplier added successfully!');
      }

      setIsModalOpen(false);
      fetchSuppliers();
    } catch (error) {
      console.error('Error saving supplier:', error);
      alert('Error saving supplier: ' + error.message);
    }
  };

  // Handle delete
  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to delete supplier "${name}"?\n\nNote: This will not delete associated purchase records.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('Supplier deleted successfully!');
      fetchSuppliers();
    } catch (error) {
      console.error('Error deleting supplier:', error);
      alert('Error deleting supplier: ' + error.message);
    }
  };

  // View purchase history
  const viewPurchaseHistory = async (supplier) => {
    setViewingSupplier(supplier);
    setIsHistoryModalOpen(true);
    setHistoryLoading(true);

    try {
      const { data, error } = await supabase
        .from('purchases')
        .select('*')
        .eq('supplier_id', supplier.id)
        .order('purchase_date', { ascending: false });

      if (error) throw error;
      setPurchaseHistory(data || []);
    } catch (error) {
      console.error('Error fetching purchase history:', error);
      alert('Error loading purchase history: ' + error.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Get supplier totals
  const getSupplierTotals = (supplierId) => {
    return supplierTotals[supplierId] || { totalPurchases: 0, totalPaid: 0, totalPending: 0 };
  };

  return (
    <div className="p-3 sm:p-4 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Suppliers</h1>
        <button
          onClick={openAddModal}
          className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm sm:text-base"
        >
          + Add Supplier
        </button>
      </div>

      {/* Suppliers List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : suppliers.length === 0 ? (
          <div className="p-6 sm:p-8 text-center text-gray-500">
            <p className="text-sm sm:text-lg mb-2">No suppliers found</p>
            <p className="text-xs sm:text-sm">Add your first supplier to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier Name</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Purchases</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Paid</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Pending</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {suppliers.map((supplier) => {
                  const totals = getSupplierTotals(supplier.id);
                  return (
                    <tr key={supplier.id} className="hover:bg-gray-50">
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-800">
                        <span className="truncate max-w-[120px] sm:max-w-none inline-block">{supplier.name}</span>
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 whitespace-nowrap">{supplier.phone || '-'}</td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 text-right whitespace-nowrap">
                        ₹{totals.totalPurchases.toFixed(2)}
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-green-600 text-right whitespace-nowrap">
                        ₹{totals.totalPaid.toFixed(2)}
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right whitespace-nowrap">
                        <span className={totals.totalPending > 0 ? 'text-orange-600 font-semibold' : 'text-gray-600'}>
                          ₹{totals.totalPending.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => viewPurchaseHistory(supplier)}
                          className="text-blue-600 hover:text-blue-700 mr-1 sm:mr-3 text-xs sm:text-sm font-medium"
                        >
                          History
                        </button>
                        <button
                          onClick={() => openEditModal(supplier)}
                          className="text-green-600 hover:text-green-700 mr-1 sm:mr-3 text-xs sm:text-sm font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(supplier.id, supplier.name)}
                          className="text-red-600 hover:text-red-700 text-xs sm:text-sm font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter supplier name"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Enter contact number"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address (Optional)</label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Enter supplier address"
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              {editingSupplier ? 'Update' : 'Add'} Supplier
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

      {/* Purchase History Modal */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`Purchase History - ${viewingSupplier?.name || ''}`}
      >
        <div className="space-y-4">
          {/* Supplier Info */}
          {viewingSupplier && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-800 mb-2">{viewingSupplier.name}</h3>
              {viewingSupplier.phone && (
                <p className="text-sm text-gray-600 mb-1">Contact: {viewingSupplier.phone}</p>
              )}
              {viewingSupplier.address && (
                <p className="text-sm text-gray-600">Address: {viewingSupplier.address}</p>
              )}
            </div>
          )}

          {/* Summary Cards */}
          {viewingSupplier && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                <p className="text-xs text-blue-700 mb-1">Total Purchases</p>
                <p className="text-lg font-bold text-blue-600">
                  ₹{getSupplierTotals(viewingSupplier.id).totalPurchases.toFixed(2)}
                </p>
              </div>
              <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                <p className="text-xs text-green-700 mb-1">Total Paid</p>
                <p className="text-lg font-bold text-green-600">
                  ₹{getSupplierTotals(viewingSupplier.id).totalPaid.toFixed(2)}
                </p>
              </div>
              <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg">
                <p className="text-xs text-orange-700 mb-1">Pending</p>
                <p className="text-lg font-bold text-orange-600">
                  ₹{getSupplierTotals(viewingSupplier.id).totalPending.toFixed(2)}
                </p>
              </div>
            </div>
          )}

          {/* Purchase History */}
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">Purchase Records</h4>
            {historyLoading ? (
              <LoadingSpinner />
            ) : purchaseHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No purchase records found</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Pending</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {purchaseHistory.map((purchase) => (
                      <tr key={purchase.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-600">
                          {new Date(purchase.purchase_date).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2 text-gray-800">{purchase.item_name}</td>
                        <td className="px-3 py-2 text-gray-600 text-right">
                          ₹{parseFloat(purchase.total_amount).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-green-600 text-right">
                          ₹{parseFloat(purchase.paid_amount).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-orange-600 text-right">
                          ₹{parseFloat(purchase.pending_amount).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            purchase.payment_status === 'paid'
                              ? 'bg-green-100 text-green-700'
                              : purchase.payment_status === 'partial'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {purchase.payment_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default Suppliers;
