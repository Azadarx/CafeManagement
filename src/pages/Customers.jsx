import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';
import { logCreate, logUpdate, logDelete } from '../utils/auditLogger';

function Customers() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: ''
  });

  // Credit form state
  const [creditData, setCreditData] = useState({
    transaction_date: new Date().toISOString().split('T')[0],
    amount: '',
    notes: ''
  });

  // Payment form state
  const [paymentData, setPaymentData] = useState({
    transaction_date: new Date().toISOString().split('T')[0],
    amount: '',
    payment_method: 'cash',
    notes: ''
  });

  // Fetch customers
  const fetchCustomers = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('customers')
        .select('*')
        .order('name', { ascending: true });

      if (searchQuery.trim()) {
        query = query.or(`name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
      alert('Error loading customers: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchCustomers();
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Handle form change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle credit form change
  const handleCreditChange = (e) => {
    const { name, value } = e.target;
    setCreditData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle payment form change
  const handlePaymentChange = (e) => {
    const { name, value } = e.target;
    setPaymentData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Open modal for new customer
  const openAddModal = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
      notes: ''
    });
    setIsModalOpen(true);
  };

  // Open modal for editing
  const openEditModal = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      notes: customer.notes || ''
    });
    setIsModalOpen(true);
  };

  // Open credit sale modal
  const openCreditModal = (customer) => {
    setSelectedCustomer(customer);
    setCreditData({
      transaction_date: new Date().toISOString().split('T')[0],
      amount: '',
      notes: ''
    });
    setIsCreditModalOpen(true);
  };

  // Open payment modal
  const openPaymentModal = (customer) => {
    setSelectedCustomer(customer);
    setPaymentData({
      transaction_date: new Date().toISOString().split('T')[0],
      amount: customer.outstanding_balance.toString(),
      payment_method: 'cash',
      notes: ''
    });
    setIsCreditModalOpen(true);
  };

  // Open ledger modal
  const openLedgerModal = async (customer) => {
    setSelectedCustomer(customer);
    setIsLedgerModalOpen(true);
    setLedgerLoading(true);

    try {
      const { data, error } = await supabase
        .from('customer_credit_ledger')
        .select('*')
        .eq('customer_id', customer.id)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false});

      if (error) throw error;
      setLedgerEntries(data || []);
    } catch (error) {
      console.error('Error fetching ledger:', error);
      alert('Error loading ledger: ' + error.message);
    } finally {
      setLedgerLoading(false);
    }
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name) {
      alert('Please enter customer name');
      return;
    }

    try {
      const customerData = {
        name: formData.name,
        phone: formData.phone || null,
        email: formData.email || null,
        address: formData.address || null,
        notes: formData.notes || null,
        created_by: user.id
      };

      if (editingCustomer) {
        // Update existing customer
        const { error } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', editingCustomer.id);

        if (error) throw error;

        // Log audit
        await logUpdate(user.id, 'customers', editingCustomer.id, 
          { name: editingCustomer.name }, 
          { name: formData.name },
          'Customer updated'
        );

        alert('Customer updated successfully!');
      } else {
        // Insert new customer
        const { data, error } = await supabase
          .from('customers')
          .insert([customerData])
          .select()
          .single();

        if (error) throw error;

        // Log audit
        await logCreate(user.id, 'customers', data.id, { name: formData.name }, 'Customer created');

        alert('Customer added successfully!');
      }

      setIsModalOpen(false);
      fetchCustomers();
    } catch (error) {
      console.error('Error saving customer:', error);
      alert('Error saving customer: ' + error.message);
    }
  };

  // Handle credit sale
  const handleCreditSubmit = async (e) => {
    e.preventDefault();

    const amount = parseFloat(creditData.amount);
    if (!amount || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('create_customer_credit_sale', {
        p_customer_id: selectedCustomer.id,
        p_transaction_date: creditData.transaction_date,
        p_amount: amount,
        p_reference_id: null,
        p_reference_type: 'manual',
        p_notes: creditData.notes || 'Manual credit sale',
        p_created_by: user.id
      });

      if (error) throw error;

      if (!data.success) {
        alert('Error: ' + data.error);
        return;
      }

      alert(`Credit sale recorded! New balance: ₹${data.new_balance}`);
      setIsCreditModalOpen(false);
      fetchCustomers();
    } catch (error) {
      console.error('Error recording credit sale:', error);
      alert('Error: ' + error.message);
    }
  };

  // Handle payment
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();

    const amount = parseFloat(paymentData.amount);
    if (!amount || amount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    if (amount > selectedCustomer.outstanding_balance) {
      alert(`Payment cannot exceed outstanding balance of ₹${selectedCustomer.outstanding_balance}`);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('record_customer_payment', {
        p_customer_id: selectedCustomer.id,
        p_transaction_date: paymentData.transaction_date,
        p_amount: amount,
        p_payment_method: paymentData.payment_method,
        p_notes: paymentData.notes || 'Payment received',
        p_created_by: user.id
      });

      if (error) throw error;

      if (!data.success) {
        alert('Error: ' + data.error);
        return;
      }

      await logCreate(user.id, 'customer_credit_ledger', data.ledger_id, 
        { customer_id: selectedCustomer.id, amount: amount }, 
        'Customer payment received'
      );

      alert(`Payment recorded! New balance: ₹${data.new_balance}`);
      setIsCreditModalOpen(false);
      fetchCustomers();
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Error: ' + error.message);
    }
  };

  // Handle delete
  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to delete customer "${name}"?\n\nThis will also delete all credit history for this customer.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await logDelete(user.id, 'customers', id, { name }, 'Customer deleted');

      alert('Customer deleted successfully!');
      fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
      alert('Error deleting customer: ' + error.message);
    }
  };

  // Calculate totals
  const calculateTotals = () => {
    return customers.reduce((acc, c) => ({
      totalReceivables: acc.totalReceivables + parseFloat(c.outstanding_balance || 0),
      totalSales: acc.totalSales + parseFloat(c.total_purchases || 0)
    }), { totalReceivables: 0, totalSales: 0 });
  };

  const totals = calculateTotals();

  return (
    <div className="p-3 sm:p-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Customers</h1>
        <button
          onClick={openAddModal}
          className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm sm:text-base"
        >
          + Add Customer
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-blue-50 border border-blue-200 p-4 sm:p-6 rounded-lg">
          <p className="text-xs sm:text-sm text-blue-700 mb-1">Total Customers</p>
          <p className="text-2xl sm:text-3xl font-bold text-blue-600">{customers.length}</p>
        </div>
        <div className="bg-green-50 border border-green-200 p-4 sm:p-6 rounded-lg">
          <p className="text-xs sm:text-sm text-green-700 mb-1">Total Sales</p>
          <p className="text-2xl sm:text-3xl font-bold text-green-600">₹{totals.totalSales.toFixed(2)}</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 p-4 sm:p-6 rounded-lg">
          <p className="text-xs sm:text-sm text-orange-700 mb-1">Total Receivables</p>
          <p className="text-2xl sm:text-3xl font-bold text-orange-600">₹{totals.totalReceivables.toFixed(2)}</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4 mb-4">
        <input
          type="text"
          placeholder="Search customers by name or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
        />
      </div>

      {/* Customers List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : customers.length === 0 ? (
          <div className="p-6 sm:p-8 text-center text-gray-500">
            <p className="text-sm sm:text-lg mb-2">No customers found</p>
            <p className="text-xs sm:text-sm">Add your first customer to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Purchases</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-800">
                      <span className="truncate max-w-[120px] sm:max-w-none inline-block">{customer.name}</span>
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                      {customer.phone || '-'}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 text-right whitespace-nowrap">
                      ₹{parseFloat(customer.total_purchases).toFixed(2)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right whitespace-nowrap">
                      <span className={parseFloat(customer.outstanding_balance) > 0 ? 'text-orange-600 font-semibold' : 'text-gray-600'}>
                        ₹{parseFloat(customer.outstanding_balance).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                      <div className="flex flex-wrap gap-1 justify-center text-xs">
                        <button
                          onClick={() => openCreditModal(customer)}
                          className="text-purple-600 hover:text-purple-700 font-medium whitespace-nowrap"
                        >
                          Credit
                        </button>
                        {parseFloat(customer.outstanding_balance) > 0 && (
                          <button
                            onClick={() => openPaymentModal(customer)}
                            className="text-green-600 hover:text-green-700 font-medium whitespace-nowrap"
                          >
                            Payment
                          </button>
                        )}
                        <button
                          onClick={() => openLedgerModal(customer)}
                          className="text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap"
                        >
                          Ledger
                        </button>
                        <button
                          onClick={() => openEditModal(customer)}
                          className="text-gray-600 hover:text-gray-700 font-medium whitespace-nowrap"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(customer.id, customer.name)}
                          className="text-red-600 hover:text-red-700 font-medium whitespace-nowrap"
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

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter customer name"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Enter phone number"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter email address"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Enter customer address"
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
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
              {editingCustomer ? 'Update' : 'Add'} Customer
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

      {/* Credit/Payment Modal */}
      <Modal
        isOpen={isCreditModalOpen}
        onClose={() => setIsCreditModalOpen(false)}
        title={selectedCustomer ? 
          (parseFloat(selectedCustomer.outstanding_balance) > 0 ? 
            `Payment - ${selectedCustomer.name}` : 
            `Credit Sale - ${selectedCustomer.name}`) 
          : 'Transaction'}
      >
        {selectedCustomer && parseFloat(selectedCustomer.outstanding_balance) > 0 ? (
          // Payment Form
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
              <p className="text-sm text-orange-700 mb-1">Outstanding Balance</p>
              <p className="text-2xl font-bold text-orange-600">
                ₹{parseFloat(selectedCustomer.outstanding_balance).toFixed(2)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date *</label>
              <input
                type="date"
                name="transaction_date"
                value={paymentData.transaction_date}
                onChange={handlePaymentChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount (₹) *</label>
              <input
                type="number"
                name="amount"
                value={paymentData.amount}
                onChange={handlePaymentChange}
                placeholder="0.00"
                step="0.01"
                min="0.01"
                max={selectedCustomer.outstanding_balance}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method *</label>
              <select
                name="payment_method"
                value={paymentData.payment_method}
                onChange={handlePaymentChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="upi">UPI</option>
                <option value="bank">Bank Transfer</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                name="notes"
                value={paymentData.notes}
                onChange={handlePaymentChange}
                placeholder="Payment notes"
                rows="2"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                Record Payment
              </button>
              <button
                type="button"
                onClick={() => setIsCreditModalOpen(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          // Credit Sale Form
          <form onSubmit={handleCreditSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Date *</label>
              <input
                type="date"
                name="transaction_date"
                value={creditData.transaction_date}
                onChange={handleCreditChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Credit Amount (₹) *</label>
              <input
                type="number"
                name="amount"
                value={creditData.amount}
                onChange={handleCreditChange}
                placeholder="0.00"
                step="0.01"
                min="0.01"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                name="notes"
                value={creditData.notes}
                onChange={handleCreditChange}
                placeholder="Credit sale notes"
                rows="2"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              />
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-purple-700 transition-colors"
              >
                Record Credit Sale
              </button>
              <button
                type="button"
                onClick={() => setIsCreditModalOpen(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Ledger Modal */}
      <Modal
        isOpen={isLedgerModalOpen}
        onClose={() => setIsLedgerModalOpen(false)}
        title={selectedCustomer ? `Ledger - ${selectedCustomer.name}` : 'Ledger'}
      >
        <div className="space-y-4">
          {selectedCustomer && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                <p className="text-xs text-blue-700 mb-1">Total Purchases</p>
                <p className="text-lg font-bold text-blue-600">
                  ₹{parseFloat(selectedCustomer.total_purchases).toFixed(2)}
                </p>
              </div>
              <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                <p className="text-xs text-green-700 mb-1">Total Paid</p>
                <p className="text-lg font-bold text-green-600">
                  ₹{parseFloat(selectedCustomer.total_payments).toFixed(2)}
                </p>
              </div>
              <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg">
                <p className="text-xs text-orange-700 mb-1">Outstanding</p>
                <p className="text-lg font-bold text-orange-600">
                  ₹{parseFloat(selectedCustomer.outstanding_balance).toFixed(2)}
                </p>
              </div>
            </div>
          )}

          <div>
            <h4 className="font-semibold text-gray-800 mb-3">Transaction History</h4>
            {ledgerLoading ? (
              <LoadingSpinner />
            ) : ledgerEntries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No transactions found</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {ledgerEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-600">
                          {new Date(entry.transaction_date).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            entry.transaction_type === 'credit_sale'
                              ? 'bg-purple-100 text-purple-700'
                              : entry.transaction_type === 'payment'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {entry.transaction_type === 'credit_sale' ? 'Credit' : 
                             entry.transaction_type === 'payment' ? 'Payment' : 'Adjustment'}
                          </span>
                        </td>
                        <td className={`px-3 py-2 text-right font-semibold ${
                          entry.amount > 0 ? 'text-orange-600' : 'text-green-600'
                        }`}>
                          {entry.amount > 0 ? '+' : ''}₹{Math.abs(parseFloat(entry.amount)).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-800 font-medium">
                          ₹{parseFloat(entry.balance_after).toFixed(2)}
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

export default Customers;
