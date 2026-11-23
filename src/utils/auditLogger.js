// Audit logging utility
import { supabase } from './supabaseClient';

export const AUDIT_ACTIONS = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LOGIN: 'login',
  LOGOUT: 'logout',
  EXPORT: 'export',
  BACKUP: 'backup',
  RESTORE: 'restore',
  PAYMENT: 'payment',
  CANCEL: 'cancel'
};

// Log an audit event
export async function logAudit({
  userId,
  actionType,
  tableName = null,
  recordId = null,
  oldValues = null,
  newValues = null,
  notes = null
}) {
  try {
    // Don't log if no user (system actions)
    if (!userId) return { success: false, error: 'No user ID provided' };

    const { error } = await supabase
      .from('audit_logs')
      .insert([{
        user_id: userId,
        action_type: actionType,
        table_name: tableName,
        record_id: recordId,
        old_values: oldValues ? JSON.stringify(oldValues) : null,
        new_values: newValues ? JSON.stringify(newValues) : null,
        notes: notes
      }]);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error logging audit:', error);
    return { success: false, error: error.message };
  }
}

// Log create action
export async function logCreate(userId, tableName, recordId, values, notes = null) {
  return await logAudit({
    userId,
    actionType: AUDIT_ACTIONS.CREATE,
    tableName,
    recordId,
    newValues: values,
    notes
  });
}

// Log update action
export async function logUpdate(userId, tableName, recordId, oldValues, newValues, notes = null) {
  return await logAudit({
    userId,
    actionType: AUDIT_ACTIONS.UPDATE,
    tableName,
    recordId,
    oldValues,
    newValues,
    notes
  });
}

// Log delete action
export async function logDelete(userId, tableName, recordId, oldValues, notes = null) {
  return await logAudit({
    userId,
    actionType: AUDIT_ACTIONS.DELETE,
    tableName,
    recordId,
    oldValues,
    notes
  });
}

// Log payment action
export async function logPayment(userId, recordId, amount, paymentMethod, notes = null) {
  return await logAudit({
    userId,
    actionType: AUDIT_ACTIONS.PAYMENT,
    tableName: 'payments',
    recordId,
    newValues: { amount, payment_method: paymentMethod },
    notes
  });
}

// Get audit logs with filters (owner only)
export async function getAuditLogs({
  userId = null,
  actionType = null,
  tableName = null,
  startDate = null,
  endDate = null,
  limit = 100
} = {}) {
  try {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (actionType) {
      query = query.eq('action_type', actionType);
    }

    if (tableName) {
      query = query.eq('table_name', tableName);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return { success: false, error: error.message };
  }
}

// Get user activity summary
export async function getUserActivitySummary(userId, days = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('audit_logs')
      .select('action_type, table_name, created_at')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Group by action type
    const summary = {};
    data.forEach(log => {
      const key = log.action_type;
      if (!summary[key]) {
        summary[key] = 0;
      }
      summary[key]++;
    });

    return { success: true, data: summary, logs: data };
  } catch (error) {
    console.error('Error fetching user activity:', error);
    return { success: false, error: error.message };
  }
}
