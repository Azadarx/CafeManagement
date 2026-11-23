import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';

function Staff() {
  const { user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [isAttendanceHistoryModalOpen, setIsAttendanceHistoryModalOpen] = useState(false);
  const [isSalaryHistoryModalOpen, setIsSalaryHistoryModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    position: '',
    salary: '',
    joining_date: new Date().toISOString().split('T')[0],
    address: '',
    notes: ''
  });

  // Attendance form state
  const [attendanceData, setAttendanceData] = useState({
    staff_id: '',
    attendance_date: new Date().toISOString().split('T')[0],
    status: 'present',
    check_in_time: '',
    check_out_time: '',
    notes: ''
  });

  // Salary payment form state
  const [salaryData, setSalaryData] = useState({
    staff_id: '',
    payment_date: new Date().toISOString().split('T')[0],
    month: new Date().toISOString().slice(0, 7), // YYYY-MM format
    amount: '',
    payment_type: 'salary',
    payment_method: 'cash',
    notes: ''
  });

  // Fetch staff
  const fetchStaff = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setStaff(data || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
      alert('Error loading staff: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  // Handle form change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle attendance form change
  const handleAttendanceChange = (e) => {
    const { name, value } = e.target;
    setAttendanceData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle salary form change
  const handleSalaryChange = (e) => {
    const { name, value } = e.target;
    setSalaryData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Open modal for new staff
  const openAddModal = () => {
    setEditingStaff(null);
    setFormData({
      name: '',
      phone: '',
      position: '',
      salary: '',
      joining_date: new Date().toISOString().split('T')[0],
      address: '',
      notes: ''
    });
    setIsModalOpen(true);
  };

  // Open modal for editing
  const openEditModal = (staffMember) => {
    setEditingStaff(staffMember);
    setFormData({
      name: staffMember.name,
      phone: staffMember.phone || '',
      position: staffMember.position || '',
      salary: staffMember.salary.toString(),
      joining_date: staffMember.joining_date,
      address: staffMember.address || '',
      notes: staffMember.notes || ''
    });
    setIsModalOpen(true);
  };

  // Open attendance modal
  const openAttendanceModal = (staffMember) => {
    setSelectedStaff(staffMember);
    setAttendanceData({
      staff_id: staffMember.id,
      attendance_date: new Date().toISOString().split('T')[0],
      status: 'present',
      check_in_time: '',
      check_out_time: '',
      notes: ''
    });
    setIsAttendanceModalOpen(true);
  };

  // Open salary payment modal
  const openSalaryModal = (staffMember) => {
    setSelectedStaff(staffMember);
    setSalaryData({
      staff_id: staffMember.id,
      payment_date: new Date().toISOString().split('T')[0],
      month: new Date().toISOString().slice(0, 7),
      amount: staffMember.salary.toString(),
      payment_type: 'salary',
      payment_method: 'cash',
      notes: ''
    });
    setIsSalaryModalOpen(true);
  };

  // Open attendance history modal
  const openAttendanceHistory = async (staffMember) => {
    setSelectedStaff(staffMember);
    setIsAttendanceHistoryModalOpen(true);
    setHistoryLoading(true);

    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('staff_id', staffMember.id)
        .order('attendance_date', { ascending: false })
        .limit(30);

      if (error) throw error;
      setAttendanceHistory(data || []);
    } catch (error) {
      console.error('Error fetching attendance history:', error);
      alert('Error loading attendance history: ' + error.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Open salary history modal
  const openSalaryHistory = async (staffMember) => {
    setSelectedStaff(staffMember);
    setIsSalaryHistoryModalOpen(true);
    setHistoryLoading(true);

    try {
      const { data, error } = await supabase
        .from('salary_payments')
        .select('*')
        .eq('staff_id', staffMember.id)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      setSalaryHistory(data || []);
    } catch (error) {
      console.error('Error fetching salary history:', error);
      alert('Error loading salary history: ' + error.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Handle staff submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.salary || !formData.joining_date) {
      alert('Please fill all required fields');
      return;
    }

    try {
      const staffData = {
        name: formData.name,
        phone: formData.phone || null,
        position: formData.position || null,
        salary: parseFloat(formData.salary),
        joining_date: formData.joining_date,
        address: formData.address || null,
        notes: formData.notes || null,
        is_active: true,
        created_by: user.id
      };

      if (editingStaff) {
        // Update existing staff
        const { error } = await supabase
          .from('staff')
          .update(staffData)
          .eq('id', editingStaff.id);

        if (error) throw error;
        alert('Staff updated successfully!');
      } else {
        // Insert new staff
        const { error } = await supabase
          .from('staff')
          .insert([staffData]);

        if (error) throw error;
        alert('Staff added successfully!');
      }

      setIsModalOpen(false);
      fetchStaff();
    } catch (error) {
      console.error('Error saving staff:', error);
      alert('Error saving staff: ' + error.message);
    }
  };

  // Handle attendance submit
  const handleAttendanceSubmit = async (e) => {
    e.preventDefault();

    try {
      // Check if attendance already exists for this date
      const { data: existing } = await supabase
        .from('attendance')
        .select('id')
        .eq('staff_id', attendanceData.staff_id)
        .eq('attendance_date', attendanceData.attendance_date)
        .single();

      if (existing) {
        alert('Attendance already recorded for this date. Please edit the existing record.');
        return;
      }

      const attendanceRecord = {
        staff_id: attendanceData.staff_id,
        attendance_date: attendanceData.attendance_date,
        status: attendanceData.status,
        check_in_time: attendanceData.check_in_time || null,
        check_out_time: attendanceData.check_out_time || null,
        notes: attendanceData.notes || null,
        created_by: user.id
      };

      const { error } = await supabase
        .from('attendance')
        .insert([attendanceRecord]);

      if (error) throw error;
      alert('Attendance recorded successfully!');
      setIsAttendanceModalOpen(false);
      fetchStaff();
    } catch (error) {
      console.error('Error recording attendance:', error);
      alert('Error recording attendance: ' + error.message);
    }
  };

  // Handle salary payment submit
  const handleSalarySubmit = async (e) => {
    e.preventDefault();

    if (!salaryData.amount || parseFloat(salaryData.amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      const paymentRecord = {
        staff_id: salaryData.staff_id,
        payment_date: salaryData.payment_date,
        month: salaryData.month,
        amount: parseFloat(salaryData.amount),
        payment_type: salaryData.payment_type,
        payment_method: salaryData.payment_method,
        notes: salaryData.notes || null,
        created_by: user.id
      };

      const { error } = await supabase
        .from('salary_payments')
        .insert([paymentRecord]);

      if (error) throw error;
      alert('Salary payment recorded successfully!');
      setIsSalaryModalOpen(false);
      fetchStaff();
    } catch (error) {
      console.error('Error recording salary payment:', error);
      alert('Error recording salary payment: ' + error.message);
    }
  };

  // Handle delete staff
  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to delete staff member "${name}"?\n\nThis will also delete all attendance and salary records for this staff member.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('Staff deleted successfully!');
      fetchStaff();
    } catch (error) {
      console.error('Error deleting staff:', error);
      alert('Error deleting staff: ' + error.message);
    }
  };

  // Toggle active status
  const toggleActiveStatus = async (staffMember) => {
    try {
      const { error } = await supabase
        .from('staff')
        .update({ is_active: !staffMember.is_active })
        .eq('id', staffMember.id);

      if (error) throw error;
      alert(`Staff ${staffMember.is_active ? 'deactivated' : 'activated'} successfully!`);
      fetchStaff();
    } catch (error) {
      console.error('Error updating staff status:', error);
      alert('Error updating staff status: ' + error.message);
    }
  };

  return (
    <div className="p-3 sm:p-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Staff Management</h1>
        <button
          onClick={openAddModal}
          className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm sm:text-base"
        >
          + Add Staff
        </button>
      </div>

      {/* Staff List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : staff.length === 0 ? (
          <div className="p-6 sm:p-8 text-center text-gray-500">
            <p className="text-sm sm:text-lg mb-2">No staff members found</p>
            <p className="text-xs sm:text-sm">Add your first staff member to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Salary</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Joining Date</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {staff.map((staffMember) => (
                  <tr key={staffMember.id} className={`hover:bg-gray-50 ${!staffMember.is_active ? 'bg-gray-100 opacity-60' : ''}`}>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-800">
                      <span className="truncate max-w-[100px] sm:max-w-none inline-block">{staffMember.name}</span>
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600">{staffMember.position || '-'}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 whitespace-nowrap">{staffMember.phone || '-'}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-800 text-right font-semibold whitespace-nowrap">
                      ₹{parseFloat(staffMember.salary).toFixed(2)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                      {new Date(staffMember.joining_date).toLocaleDateString()}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        staffMember.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {staffMember.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                      <div className="flex flex-wrap gap-1 justify-center text-xs">
                        {staffMember.is_active && (
                          <>
                            <button
                              onClick={() => openAttendanceModal(staffMember)}
                              className="text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap"
                              title="Mark Attendance"
                            >
                              Attend
                            </button>
                            <button
                              onClick={() => openSalaryModal(staffMember)}
                              className="text-green-600 hover:text-green-700 font-medium whitespace-nowrap"
                              title="Pay Salary"
                            >
                              Pay
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => openAttendanceHistory(staffMember)}
                          className="text-purple-600 hover:text-purple-700 font-medium whitespace-nowrap"
                          title="View Attendance"
                        >
                          History
                        </button>
                        <button
                          onClick={() => openSalaryHistory(staffMember)}
                          className="text-orange-600 hover:text-orange-700 font-medium whitespace-nowrap"
                          title="View Salary Payments"
                        >
                          Salary
                        </button>
                        <button
                          onClick={() => openEditModal(staffMember)}
                          className="text-gray-600 hover:text-gray-700 font-medium whitespace-nowrap"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleActiveStatus(staffMember)}
                          className="text-yellow-600 hover:text-yellow-700 font-medium whitespace-nowrap"
                        >
                          {staffMember.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleDelete(staffMember.id, staffMember.name)}
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

      {/* Add/Edit Staff Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingStaff ? 'Edit Staff' : 'Add New Staff'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Staff name"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
              <input
                type="text"
                name="position"
                value={formData.position}
                onChange={handleChange}
                placeholder="e.g., Waiter, Cook, Manager"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Contact number"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Salary (₹) *</label>
              <input
                type="number"
                name="salary"
                value={formData.salary}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
                min="0"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Joining Date *</label>
              <input
                type="date"
                name="joining_date"
                value={formData.joining_date}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Full address"
              rows="2"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Additional notes"
              rows="2"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              {editingStaff ? 'Update' : 'Add'} Staff
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

      {/* Mark Attendance Modal */}
      <Modal
        isOpen={isAttendanceModalOpen}
        onClose={() => setIsAttendanceModalOpen(false)}
        title={`Mark Attendance - ${selectedStaff?.name}`}
      >
        <form onSubmit={handleAttendanceSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input
              type="date"
              name="attendance_date"
              value={attendanceData.attendance_date}
              onChange={handleAttendanceChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="status"
                  value="present"
                  checked={attendanceData.status === 'present'}
                  onChange={handleAttendanceChange}
                  className="mr-2"
                />
                <span className="text-sm">Present (Full day)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="status"
                  value="half-day"
                  checked={attendanceData.status === 'half-day'}
                  onChange={handleAttendanceChange}
                  className="mr-2"
                />
                <span className="text-sm">Half Day</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="status"
                  value="absent"
                  checked={attendanceData.status === 'absent'}
                  onChange={handleAttendanceChange}
                  className="mr-2"
                />
                <span className="text-sm">Absent</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="status"
                  value="leave"
                  checked={attendanceData.status === 'leave'}
                  onChange={handleAttendanceChange}
                  className="mr-2"
                />
                <span className="text-sm">On Leave</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Check-in Time</label>
              <input
                type="time"
                name="check_in_time"
                value={attendanceData.check_in_time}
                onChange={handleAttendanceChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Check-out Time</label>
              <input
                type="time"
                name="check_out_time"
                value={attendanceData.check_out_time}
                onChange={handleAttendanceChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              name="notes"
              value={attendanceData.notes}
              onChange={handleAttendanceChange}
              placeholder="Additional notes (optional)"
              rows="2"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Mark Attendance
            </button>
            <button
              type="button"
              onClick={() => setIsAttendanceModalOpen(false)}
              className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Salary Payment Modal */}
      <Modal
        isOpen={isSalaryModalOpen}
        onClose={() => setIsSalaryModalOpen(false)}
        title={`Pay Salary - ${selectedStaff?.name}`}
      >
        <form onSubmit={handleSalarySubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date *</label>
            <input
              type="date"
              name="payment_date"
              value={salaryData.payment_date}
              onChange={handleSalaryChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">For Month *</label>
            <input
              type="month"
              name="month"
              value={salaryData.month}
              onChange={handleSalaryChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹) *</label>
            <input
              type="number"
              name="amount"
              value={salaryData.amount}
              onChange={handleSalaryChange}
              placeholder="0.00"
              step="0.01"
              min="0"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Monthly salary: ₹{selectedStaff?.salary || 0}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Type *</label>
            <select
              name="payment_type"
              value={salaryData.payment_type}
              onChange={handleSalaryChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="salary">Salary</option>
              <option value="advance">Advance</option>
              <option value="bonus">Bonus</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method *</label>
            <select
              name="payment_method"
              value={salaryData.payment_method}
              onChange={handleSalaryChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="cash">Cash</option>
              <option value="bank">Bank Transfer</option>
              <option value="upi">UPI</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              name="notes"
              value={salaryData.notes}
              onChange={handleSalaryChange}
              placeholder="Additional notes (optional)"
              rows="2"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
              onClick={() => setIsSalaryModalOpen(false)}
              className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Attendance History Modal */}
      <Modal
        isOpen={isAttendanceHistoryModalOpen}
        onClose={() => setIsAttendanceHistoryModalOpen(false)}
        title={`Attendance History - ${selectedStaff?.name}`}
      >
        <div className="space-y-4">
          {historyLoading ? (
            <LoadingSpinner />
          ) : attendanceHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No attendance records found</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Check-in</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Check-out</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {attendanceHistory.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-800">
                        {new Date(record.attendance_date).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          record.status === 'present' ? 'bg-green-100 text-green-700' :
                          record.status === 'half-day' ? 'bg-yellow-100 text-yellow-700' :
                          record.status === 'leave' ? 'bg-blue-100 text-blue-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center text-gray-600">
                        {record.check_in_time || '-'}
                      </td>
                      <td className="px-3 py-2 text-center text-gray-600">
                        {record.check_out_time || '-'}
                      </td>
                      <td className="px-3 py-2 text-gray-600 text-xs">
                        {record.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* Salary History Modal */}
      <Modal
        isOpen={isSalaryHistoryModalOpen}
        onClose={() => setIsSalaryHistoryModalOpen(false)}
        title={`Salary History - ${selectedStaff?.name}`}
      >
        <div className="space-y-4">
          {historyLoading ? (
            <LoadingSpinner />
          ) : salaryHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No salary payment records found</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Method</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {salaryHistory.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-800">
                        {new Date(payment.payment_date).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {payment.month}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          payment.payment_type === 'salary' ? 'bg-green-100 text-green-700' :
                          payment.payment_type === 'advance' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {payment.payment_type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-green-600">
                        ₹{parseFloat(payment.amount).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-center text-gray-600">
                        {payment.payment_method}
                      </td>
                      <td className="px-3 py-2 text-gray-600 text-xs">
                        {payment.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default Staff;
