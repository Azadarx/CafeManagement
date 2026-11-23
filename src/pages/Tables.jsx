import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';

function Tables() {
  const { user } = useAuth();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  // Form state
  const [formData, setFormData] = useState({
    table_number: '',
    table_name: '',
    capacity: '4',
    floor: '',
    notes: ''
  });

  // Fetch tables
  const fetchTables = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('restaurant_tables')
        .select(`
          *,
          orders!restaurant_tables_id_fkey (
            id,
            order_number,
            order_status,
            total_amount
          )
        `)
        .eq('is_active', true)
        .order('table_number', { ascending: true });

      if (error) throw error;

      // Process tables to get current order info
      const processedTables = (data || []).map(table => {
        const activeOrder = table.orders?.find(o => 
          ['new', 'preparing', 'ready', 'served'].includes(o.order_status)
        );
        return {
          ...table,
          current_order: activeOrder || null,
          orders: undefined // Remove orders array to clean up
        };
      });

      setTables(processedTables);
    } catch (error) {
      console.error('Error fetching tables:', error);
      alert('Error loading tables: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
    // Auto-refresh every 30 seconds for real-time updates
    const interval = setInterval(fetchTables, 30000);
    return () => clearInterval(interval);
  }, []);

  // Handle form change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Open modal for new table
  const openAddModal = () => {
    setEditingTable(null);
    setFormData({
      table_number: '',
      table_name: '',
      capacity: '4',
      floor: '',
      notes: ''
    });
    setIsModalOpen(true);
  };

  // Open modal for editing
  const openEditModal = (table) => {
    setEditingTable(table);
    setFormData({
      table_number: table.table_number,
      table_name: table.table_name || '',
      capacity: table.capacity.toString(),
      floor: table.floor || '',
      notes: table.notes || ''
    });
    setIsModalOpen(true);
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.table_number) {
      alert('Please enter table number');
      return;
    }

    const capacity = parseInt(formData.capacity);
    if (capacity <= 0) {
      alert('Capacity must be greater than 0');
      return;
    }

    try {
      const tableData = {
        table_number: formData.table_number,
        table_name: formData.table_name || null,
        capacity: capacity,
        floor: formData.floor || null,
        notes: formData.notes || null,
        created_by: user.id
      };

      if (editingTable) {
        // Update existing table
        const { error } = await supabase
          .from('restaurant_tables')
          .update(tableData)
          .eq('id', editingTable.id);

        if (error) throw error;
        alert('Table updated successfully!');
      } else {
        // Insert new table
        const { error } = await supabase
          .from('restaurant_tables')
          .insert([tableData]);

        if (error) {
          if (error.code === '23505') {
            alert('Table number already exists!');
            return;
          }
          throw error;
        }
        alert('Table added successfully!');
      }

      setIsModalOpen(false);
      fetchTables();
    } catch (error) {
      console.error('Error saving table:', error);
      alert('Error saving table: ' + error.message);
    }
  };

  // Change table status
  const changeTableStatus = async (tableId, newStatus) => {
    try {
      const { error } = await supabase
        .from('restaurant_tables')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', tableId);

      if (error) throw error;
      fetchTables();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating table status: ' + error.message);
    }
  };

  // Deactivate table
  const handleDeactivate = async (id, tableNumber) => {
    if (!confirm(`Deactivate table ${tableNumber}? This will hide it from active tables.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('restaurant_tables')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      alert('Table deactivated successfully!');
      fetchTables();
    } catch (error) {
      console.error('Error deactivating table:', error);
      alert('Error deactivating table: ' + error.message);
    }
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const badges = {
      available: { bg: 'bg-green-100', text: 'text-green-700', label: 'Available' },
      occupied: { bg: 'bg-red-100', text: 'text-red-700', label: 'Occupied' },
      reserved: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Reserved' },
      cleaning: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Cleaning' }
    };
    const badge = badges[status] || badges.available;
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  // Get status color for grid view
  const getStatusColor = (status) => {
    const colors = {
      available: 'border-green-500 bg-green-50',
      occupied: 'border-red-500 bg-red-50',
      reserved: 'border-blue-500 bg-blue-50',
      cleaning: 'border-yellow-500 bg-yellow-50'
    };
    return colors[status] || colors.available;
  };

  // Calculate stats
  const stats = {
    total: tables.length,
    available: tables.filter(t => t.status === 'available').length,
    occupied: tables.filter(t => t.status === 'occupied').length,
    reserved: tables.filter(t => t.status === 'reserved').length
  };

  return (
    <div className="p-3 sm:p-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Table Management</h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                viewMode === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Grid View
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              List View
            </button>
          </div>
          <button
            onClick={openAddModal}
            className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
          >
            + Add Table
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <p className="text-xs sm:text-sm text-blue-700 mb-1">Total Tables</p>
          <p className="text-2xl sm:text-3xl font-bold text-blue-600">{stats.total}</p>
        </div>
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
          <p className="text-xs sm:text-sm text-green-700 mb-1">Available</p>
          <p className="text-2xl sm:text-3xl font-bold text-green-600">{stats.available}</p>
        </div>
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
          <p className="text-xs sm:text-sm text-red-700 mb-1">Occupied</p>
          <p className="text-2xl sm:text-3xl font-bold text-red-600">{stats.occupied}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <p className="text-xs sm:text-sm text-blue-700 mb-1">Reserved</p>
          <p className="text-2xl sm:text-3xl font-bold text-blue-600">{stats.reserved}</p>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : tables.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 sm:p-8 text-center text-gray-500">
          <p className="text-sm sm:text-lg mb-2">No tables found</p>
          <p className="text-xs sm:text-sm">Add your first table to get started</p>
        </div>
      ) : viewMode === 'grid' ? (
        // Grid View
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {tables.map((table) => (
            <div
              key={table.id}
              className={`border-2 rounded-lg p-4 transition-all hover:shadow-lg ${getStatusColor(table.status)}`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">{table.table_number}</h3>
                  {table.table_name && (
                    <p className="text-xs text-gray-600">{table.table_name}</p>
                  )}
                </div>
                <span className="text-2xl">
                  {table.status === 'available' && '✓'}
                  {table.status === 'occupied' && '👥'}
                  {table.status === 'reserved' && '📅'}
                  {table.status === 'cleaning' && '🧹'}
                </span>
              </div>

              <div className="mb-3">
                {getStatusBadge(table.status)}
              </div>

              <div className="text-xs text-gray-600 mb-3">
                <p>Capacity: {table.capacity} persons</p>
                {table.floor && <p>Floor: {table.floor}</p>}
              </div>

              {table.current_order && (
                <div className="bg-white bg-opacity-50 border border-gray-300 rounded p-2 mb-3">
                  <p className="text-xs font-semibold text-gray-700">
                    Order: {table.current_order.order_number}
                  </p>
                  <p className="text-xs text-gray-600">
                    ₹{parseFloat(table.current_order.total_amount).toFixed(2)}
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-1">
                {table.status !== 'available' && (
                  <button
                    onClick={() => changeTableStatus(table.id, 'available')}
                    className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                  >
                    Mark Available
                  </button>
                )}
                {table.status === 'available' && (
                  <button
                    onClick={() => changeTableStatus(table.id, 'cleaning')}
                    className="text-xs bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-700"
                  >
                    Mark Cleaning
                  </button>
                )}
                <button
                  onClick={() => openEditModal(table)}
                  className="text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // List View
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Table</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Capacity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Floor</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Order</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tables.map((table) => (
                  <tr key={table.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-bold text-gray-800">
                      {table.table_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {table.table_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-center">
                      {table.capacity}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {table.floor || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(table.status)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {table.current_order ? (
                        <div>
                          <p className="font-medium">{table.current_order.order_number}</p>
                          <p className="text-xs">₹{parseFloat(table.current_order.total_amount).toFixed(2)}</p>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-wrap gap-1 justify-center text-xs">
                        {table.status !== 'available' && (
                          <button
                            onClick={() => changeTableStatus(table.id, 'available')}
                            className="text-green-600 hover:text-green-700 font-medium"
                          >
                            Free
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(table)}
                          className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeactivate(table.id, table.table_number)}
                          className="text-red-600 hover:text-red-700 font-medium"
                        >
                          Deactivate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTable ? 'Edit Table' : 'Add New Table'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Table Number *</label>
            <input
              type="text"
              name="table_number"
              value={formData.table_number}
              onChange={handleChange}
              placeholder="e.g., 1, T1, A1"
              required
              disabled={!!editingTable}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Table Name</label>
            <input
              type="text"
              name="table_name"
              value={formData.table_name}
              onChange={handleChange}
              placeholder="e.g., Window Side, Corner Table"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Capacity *</label>
              <input
                type="number"
                name="capacity"
                value={formData.capacity}
                onChange={handleChange}
                placeholder="4"
                min="1"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Floor</label>
              <input
                type="text"
                name="floor"
                value={formData.floor}
                onChange={handleChange}
                placeholder="Ground, First"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
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
              {editingTable ? 'Update' : 'Add'} Table
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

export default Tables;
