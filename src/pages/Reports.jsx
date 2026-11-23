import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';

function Reports() {
  const [reportType, setReportType] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  // Generate report on mount and when parameters change
  useEffect(() => {
    if (reportType === 'custom' && (!startDate || !endDate)) return;
    generateReport();
  }, [reportType, selectedDate, startDate, endDate]);

  const generateReport = async () => {
    setLoading(true);
    try {
      let start, end;

      if (reportType === 'daily') {
        start = end = selectedDate;
      } else if (reportType === 'weekly') {
        const date = new Date(selectedDate);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday
        const monday = new Date(date.setDate(diff));
        start = monday.toISOString().split('T')[0];
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);
        end = sunday.toISOString().split('T')[0];
      } else if (reportType === 'monthly') {
        const date = new Date(selectedDate);
        start = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
        end = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
      } else if (reportType === 'custom') {
        start = startDate;
        end = endDate;
      }

      // Fetch all data for the period
      const [
        { data: transactions },
        { data: sales },
        { data: purchases },
        { data: salaryPayments },
        { data: stockMovements }
      ] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .gte('transaction_date', start)
          .lte('transaction_date', end)
          .order('transaction_date'),
        supabase
          .from('sales')
          .select('*')
          .gte('sale_date', start)
          .lte('sale_date', end)
          .order('sale_date'),
        supabase
          .from('purchases')
          .select('*, suppliers(name)')
          .gte('purchase_date', start)
          .lte('purchase_date', end)
          .order('purchase_date'),
        supabase
          .from('salary_payments')
          .select('*, staff(name)')
          .gte('payment_date', start)
          .lte('payment_date', end)
          .order('payment_date'),
        supabase
          .from('stock_movements')
          .select('*, inventory(item_name, unit)')
          .gte('movement_date', start)
          .lte('movement_date', end)
          .eq('movement_type', 'wastage')
      ]);

      // Calculate totals
      const totalIncome = (transactions || [])
        .filter(t => t.transaction_type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      const totalExpenses = (transactions || [])
        .filter(t => t.transaction_type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      const totalSales = (sales || [])
        .reduce((sum, s) => sum + parseFloat(s.total_amount), 0);

      const totalPurchases = (purchases || [])
        .reduce((sum, p) => sum + parseFloat(p.total_amount), 0);

      const totalPurchasesPaid = (purchases || [])
        .reduce((sum, p) => sum + parseFloat(p.paid_amount), 0);

      const totalPurchasesPending = (purchases || [])
        .reduce((sum, p) => sum + parseFloat(p.pending_amount), 0);

      const totalSalaryPaid = (salaryPayments || [])
        .reduce((sum, sp) => sum + parseFloat(sp.amount), 0);

      // Product-wise sales (only from sales, not from transactions to avoid double counting)
      const productSales = {};
      (sales || []).forEach(sale => {
        if (!productSales[sale.item_name]) {
          productSales[sale.item_name] = {
            quantity: 0,
            amount: 0
          };
        }
        productSales[sale.item_name].quantity += sale.quantity;
        productSales[sale.item_name].amount += parseFloat(sale.total_amount);
      });

      const productWiseSales = Object.entries(productSales)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.amount - a.amount);

      // Category-wise expenses
      const categoryExpenses = {};
      (transactions || [])
        .filter(t => t.transaction_type === 'expense')
        .forEach(t => {
          const cat = t.category || 'Uncategorized';
          categoryExpenses[cat] = (categoryExpenses[cat] || 0) + parseFloat(t.amount);
        });

      const categoryWiseExpenses = Object.entries(categoryExpenses)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);

      // Wastage summary
      const totalWastage = (stockMovements || [])
        .reduce((sum, sm) => sum + Math.abs(parseFloat(sm.quantity)), 0);

      const wastageByItem = {};
      (stockMovements || []).forEach(sm => {
        const itemName = sm.inventory?.item_name || 'Unknown';
        const unit = sm.inventory?.unit || '';
        if (!wastageByItem[itemName]) {
          wastageByItem[itemName] = { quantity: 0, unit };
        }
        wastageByItem[itemName].quantity += Math.abs(parseFloat(sm.quantity));
      });

      const wastageItems = Object.entries(wastageByItem)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.quantity - a.quantity);

      // Check for potential double-counting
      const salesRecordedAsIncome = (transactions || [])
        .filter(t => t.transaction_type === 'income' && t.reference_type === 'sale')
        .length;

      setReportData({
        period: { start, end },
        summary: {
          totalIncome,
          totalExpenses,
          netCashMovement: totalIncome - totalExpenses,
          totalSales,
          totalPurchases,
          totalPurchasesPaid,
          totalPurchasesPending,
          totalSalaryPaid,
          totalWastage
        },
        productWiseSales,
        categoryWiseExpenses,
        wastageItems,
        dailyBreakdown: reportType === 'weekly' ? calculateDailyBreakdown(transactions, sales, start, end) : null,
        warnings: {
          salesRecordedAsIncome: salesRecordedAsIncome > 0,
          salesRecordedCount: salesRecordedAsIncome
        }
      });
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error generating report: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateDailyBreakdown = (transactions, sales, start, end) => {
    const days = [];
    const startDate = new Date(start);
    const endDate = new Date(end);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      
      const daySales = (sales || [])
        .filter(s => s.sale_date === dateStr)
        .reduce((sum, s) => sum + parseFloat(s.total_amount), 0);

      const dayIncome = (transactions || [])
        .filter(t => t.transaction_type === 'income' && t.transaction_date === dateStr)
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      const dayExpenses = (transactions || [])
        .filter(t => t.transaction_type === 'expense' && t.transaction_date === dateStr)
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      days.push({
        date: dateStr,
        sales: daySales,
        income: dayIncome,
        expenses: dayExpenses,
        net: dayIncome - dayExpenses
      });
    }

    return days;
  };

  const copyWhatsAppReport = () => {
    if (!reportData) return;

    const { period, summary, productWiseSales, categoryWiseExpenses } = reportData;

    let report = `☕ *CAFE DAILY REPORT*\n`;
    report += `📅 Date: ${new Date(period.start).toLocaleDateString()}`;
    if (period.start !== period.end) {
      report += ` to ${new Date(period.end).toLocaleDateString()}`;
    }
    report += `\n\n`;

    report += `*💰 SALES & INCOME*\n`;
    report += `Total Sales: ₹${summary.totalSales.toFixed(2)}\n`;
    report += `Total Income: ₹${summary.totalIncome.toFixed(2)}\n\n`;

    report += `*📊 EXPENSES*\n`;
    report += `Total Expenses: ₹${summary.totalExpenses.toFixed(2)}\n\n`;

    report += `*💵 NET CASH MOVEMENT*\n`;
    report += `${summary.netCashMovement >= 0 ? '✅' : '⚠️'} ₹${summary.netCashMovement.toFixed(2)}\n\n`;

    report += `*🛒 PURCHASES*\n`;
    report += `Total Purchases: ₹${summary.totalPurchases.toFixed(2)}\n`;
    report += `Paid: ₹${summary.totalPurchasesPaid.toFixed(2)}\n`;
    report += `Pending: ₹${summary.totalPurchasesPending.toFixed(2)}\n\n`;

    if (summary.totalSalaryPaid > 0) {
      report += `*👥 STAFF PAYMENTS*\n`;
      report += `Salary Paid: ₹${summary.totalSalaryPaid.toFixed(2)}\n\n`;
    }

    if (productWiseSales.length > 0) {
      report += `*🍽️ TOP SELLING ITEMS*\n`;
      productWiseSales.slice(0, 5).forEach((item, idx) => {
        report += `${idx + 1}. ${item.name} - ${item.quantity} units (₹${item.amount.toFixed(2)})\n`;
      });
      report += `\n`;
    }

    if (categoryWiseExpenses.length > 0) {
      report += `*📋 EXPENSE BREAKDOWN*\n`;
      categoryWiseExpenses.forEach(cat => {
        report += `• ${cat.category}: ₹${cat.amount.toFixed(2)}\n`;
      });
      report += `\n`;
    }

    report += `_Generated by Cafe Management System_`;

    navigator.clipboard.writeText(report).then(() => {
      alert('✅ Report copied to clipboard! You can now paste it in WhatsApp.');
    }).catch(err => {
      console.error('Failed to copy:', err);
      // Fallback: show in alert for manual copy
      alert(report);
    });
  };

  const downloadCSV = () => {
    if (!reportData) return;

    let csv = 'CAFE MANAGEMENT REPORT\n';
    csv += `Period:,${reportData.period.start},to,${reportData.period.end}\n\n`;

    csv += 'SUMMARY\n';
    csv += `Total Sales,₹${reportData.summary.totalSales.toFixed(2)}\n`;
    csv += `Total Income,₹${reportData.summary.totalIncome.toFixed(2)}\n`;
    csv += `Total Expenses,₹${reportData.summary.totalExpenses.toFixed(2)}\n`;
    csv += `Net Cash Movement,₹${reportData.summary.netCashMovement.toFixed(2)}\n`;
    csv += `Total Purchases,₹${reportData.summary.totalPurchases.toFixed(2)}\n`;
    csv += `Purchase Paid,₹${reportData.summary.totalPurchasesPaid.toFixed(2)}\n`;
    csv += `Purchase Pending,₹${reportData.summary.totalPurchasesPending.toFixed(2)}\n`;
    csv += `Salary Paid,₹${reportData.summary.totalSalaryPaid.toFixed(2)}\n\n`;

    if (reportData.productWiseSales.length > 0) {
      csv += 'PRODUCT-WISE SALES\n';
      csv += 'Product,Quantity,Amount\n';
      reportData.productWiseSales.forEach(item => {
        csv += `${item.name},${item.quantity},₹${item.amount.toFixed(2)}\n`;
      });
      csv += '\n';
    }

    if (reportData.categoryWiseExpenses.length > 0) {
      csv += 'CATEGORY-WISE EXPENSES\n';
      csv += 'Category,Amount\n';
      reportData.categoryWiseExpenses.forEach(cat => {
        csv += `${cat.category},₹${cat.amount.toFixed(2)}\n`;
      });
      csv += '\n';
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cafe-report-${reportData.period.start}-to-${reportData.period.end}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-3 sm:p-4 max-w-7xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">Reports</h1>

      {/* Report Type Selection */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-4">
          <button
            onClick={() => setReportType('daily')}
            className={`p-2 sm:p-4 rounded-lg border-2 transition-colors ${
              reportType === 'daily'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-xl sm:text-2xl mb-1 sm:mb-2">📅</div>
            <div className="text-xs sm:text-base font-semibold">Daily</div>
          </button>
          <button
            onClick={() => setReportType('weekly')}
            className={`p-2 sm:p-4 rounded-lg border-2 transition-colors ${
              reportType === 'weekly'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-xl sm:text-2xl mb-1 sm:mb-2">📊</div>
            <div className="text-xs sm:text-base font-semibold">Weekly</div>
          </button>
          <button
            onClick={() => setReportType('monthly')}
            className={`p-2 sm:p-4 rounded-lg border-2 transition-colors ${
              reportType === 'monthly'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-xl sm:text-2xl mb-1 sm:mb-2">📈</div>
            <div className="text-xs sm:text-base font-semibold">Monthly</div>
          </button>
          <button
            onClick={() => setReportType('custom')}
            className={`p-2 sm:p-4 rounded-lg border-2 transition-colors ${
              reportType === 'custom'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-xl sm:text-2xl mb-1 sm:mb-2">🎯</div>
            <div className="text-xs sm:text-base font-semibold">Custom</div>
          </button>
        </div>

        {/* Date Selectors */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 items-stretch sm:items-end">
          {reportType !== 'custom' ? (
            <div className="flex-1 min-w-0">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Select Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-2 sm:px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          ) : (
            <>
              <div className="flex-1 min-w-0">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-2 sm:px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-2 sm:px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </>
          )}
          <button
            onClick={generateReport}
            disabled={loading || (reportType === 'custom' && (!startDate || !endDate))}
            className="w-full sm:w-auto bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>

      {loading && <LoadingSpinner />}

      {reportData && !loading && (
        <>
          {/* Warning for double-counting */}
          {reportData.warnings.salesRecordedAsIncome && (
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 sm:p-4 mb-4 sm:mb-6 rounded-r-lg">
              <p className="text-xs sm:text-sm text-yellow-800">
                ⚠️ <strong>Note:</strong> {reportData.warnings.salesRecordedCount} sale(s) were also recorded as income in Daily Hisab. 
                Sales total shows sales records only to avoid double-counting.
              </p>
            </div>
          )}

          {/* Export Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4 sm:mb-6">
            <button
              onClick={copyWhatsAppReport}
              className="flex-1 bg-green-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <span>📱</span>
              <span>Copy for WhatsApp</span>
            </button>
            <button
              onClick={downloadCSV}
              className="flex-1 bg-purple-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
            >
              <span>📥</span>
              <span>Download CSV</span>
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="bg-green-50 border border-green-200 p-4 sm:p-6 rounded-lg">
              <p className="text-xs sm:text-sm text-green-700 mb-1">Total Sales</p>
              <p className="text-2xl sm:text-3xl font-bold text-green-600">₹{reportData.summary.totalSales.toFixed(2)}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 p-4 sm:p-6 rounded-lg">
              <p className="text-xs sm:text-sm text-blue-700 mb-1">Total Income</p>
              <p className="text-2xl sm:text-3xl font-bold text-blue-600">₹{reportData.summary.totalIncome.toFixed(2)}</p>
            </div>
            <div className="bg-red-50 border border-red-200 p-4 sm:p-6 rounded-lg">
              <p className="text-xs sm:text-sm text-red-700 mb-1">Total Expenses</p>
              <p className="text-2xl sm:text-3xl font-bold text-red-600">₹{reportData.summary.totalExpenses.toFixed(2)}</p>
            </div>
            <div className={`border p-4 sm:p-6 rounded-lg ${
              reportData.summary.netCashMovement >= 0
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-orange-50 border-orange-200'
            }`}>
              <p className={`text-xs sm:text-sm mb-1 ${
                reportData.summary.netCashMovement >= 0 ? 'text-emerald-700' : 'text-orange-700'
              }`}>Net Cash Movement</p>
              <p className={`text-2xl sm:text-3xl font-bold ${
                reportData.summary.netCashMovement >= 0 ? 'text-emerald-600' : 'text-orange-600'
              }`}>
                {reportData.summary.netCashMovement >= 0 ? '+' : ''}₹{reportData.summary.netCashMovement.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Purchase & Salary Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="bg-purple-50 border border-purple-200 p-4 sm:p-6 rounded-lg">
              <p className="text-xs sm:text-sm text-purple-700 mb-1">Total Purchases</p>
              <p className="text-xl sm:text-2xl font-bold text-purple-600">₹{reportData.summary.totalPurchases.toFixed(2)}</p>
              <div className="mt-2 text-xs text-purple-600">
                <p>Paid: ₹{reportData.summary.totalPurchasesPaid.toFixed(2)}</p>
                <p>Pending: ₹{reportData.summary.totalPurchasesPending.toFixed(2)}</p>
              </div>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 p-4 sm:p-6 rounded-lg">
              <p className="text-xs sm:text-sm text-indigo-700 mb-1">Salary Paid</p>
              <p className="text-xl sm:text-2xl font-bold text-indigo-600">₹{reportData.summary.totalSalaryPaid.toFixed(2)}</p>
            </div>
            {reportData.summary.totalWastage > 0 && (
              <div className="bg-red-50 border border-red-200 p-4 sm:p-6 rounded-lg">
                <p className="text-xs sm:text-sm text-red-700 mb-1">Total Wastage</p>
                <p className="text-xl sm:text-2xl font-bold text-red-600">{reportData.summary.totalWastage.toFixed(2)} units</p>
              </div>
            )}
          </div>

          {/* Daily Breakdown (for weekly reports) */}
          {reportData.dailyBreakdown && (
            <div className="bg-white rounded-lg shadow mb-4 sm:mb-6">
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
                <h2 className="text-base sm:text-lg font-semibold text-gray-800">Daily Breakdown</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Sales</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Income</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Expenses</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {reportData.dailyBreakdown.map((day, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-800">
                          {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 text-right">₹{day.sales.toFixed(2)}</td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-green-600 text-right">₹{day.income.toFixed(2)}</td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-red-600 text-right">₹{day.expenses.toFixed(2)}</td>
                        <td className={`px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right font-semibold ${
                          day.net >= 0 ? 'text-green-600' : 'text-orange-600'
                        }`}>
                          {day.net >= 0 ? '+' : ''}₹{day.net.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Product-wise Sales */}
          {reportData.productWiseSales.length > 0 && (
            <div className="bg-white rounded-lg shadow mb-4 sm:mb-6">
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
                <h2 className="text-base sm:text-lg font-semibold text-gray-800">Product-wise Sales</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {reportData.productWiseSales.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-800">
                          <span className="truncate max-w-[150px] sm:max-w-none inline-block">{item.name}</span>
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 text-right">{item.quantity}</td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-green-600 text-right">₹{item.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Category-wise Expenses */}
          {reportData.categoryWiseExpenses.length > 0 && (
            <div className="bg-white rounded-lg shadow mb-4 sm:mb-6">
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
                <h2 className="text-base sm:text-lg font-semibold text-gray-800">Category-wise Expenses</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">% of Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {reportData.categoryWiseExpenses.map((cat, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-800">
                          <span className="truncate max-w-[150px] sm:max-w-none inline-block">{cat.category}</span>
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-red-600 text-right">₹{cat.amount.toFixed(2)}</td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 text-right">
                          {((cat.amount / reportData.summary.totalExpenses) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Wastage Items */}
          {reportData.wastageItems.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
                <h2 className="text-base sm:text-lg font-semibold text-gray-800">Wastage Summary</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity Wasted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {reportData.wastageItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-800">
                          <span className="truncate max-w-[180px] sm:max-w-none inline-block">{item.name}</span>
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-red-600 text-right font-semibold">
                          {item.quantity.toFixed(2)} {item.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {!loading && !reportData && (
        <div className="bg-white rounded-lg shadow p-8 sm:p-12 text-center text-gray-500">
          <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">📊</div>
          <p className="text-sm sm:text-lg">Select report type and date to generate report</p>
        </div>
      )}
    </div>
  );
}

export default Reports;
