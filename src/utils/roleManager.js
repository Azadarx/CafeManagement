// Role-based access control utilities
import { supabase } from './supabaseClient';

export const ROLES = {
  OWNER: 'owner',
  MANAGER: 'manager',
  STAFF: 'staff',
  VIEWER: 'viewer'
};

export const PERMISSIONS = {
  // Financial
  VIEW_FINANCIAL: [ROLES.OWNER, ROLES.MANAGER],
  MANAGE_FINANCIAL: [ROLES.OWNER],
  
  // Operations
  MANAGE_SALES: [ROLES.OWNER, ROLES.MANAGER, ROLES.STAFF],
  MANAGE_PURCHASES: [ROLES.OWNER, ROLES.MANAGER],
  MANAGE_INVENTORY: [ROLES.OWNER, ROLES.MANAGER],
  MANAGE_MENU: [ROLES.OWNER, ROLES.MANAGER],
  
  // Staff
  VIEW_STAFF: [ROLES.OWNER, ROLES.MANAGER],
  MANAGE_STAFF: [ROLES.OWNER],
  MANAGE_ATTENDANCE: [ROLES.OWNER, ROLES.MANAGER],
  
  // Customers & Orders
  MANAGE_CUSTOMERS: [ROLES.OWNER, ROLES.MANAGER, ROLES.STAFF],
  MANAGE_ORDERS: [ROLES.OWNER, ROLES.MANAGER, ROLES.STAFF],
  VIEW_ORDERS: [ROLES.OWNER, ROLES.MANAGER, ROLES.STAFF, ROLES.VIEWER],
  
  // Settings & Security
  MANAGE_SETTINGS: [ROLES.OWNER],
  MANAGE_USERS: [ROLES.OWNER],
  VIEW_AUDIT_LOGS: [ROLES.OWNER],
  MANAGE_BACKUP: [ROLES.OWNER],
  
  // Reports
  VIEW_REPORTS: [ROLES.OWNER, ROLES.MANAGER],
  VIEW_PROFIT: [ROLES.OWNER, ROLES.MANAGER]
};

// Get user role from database
export async function getUserRole(userId) {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role, is_active')
      .eq('user_id', userId)
      .single();

    if (error) {
      // If no role found, default to staff for existing users
      console.warn('No role found for user, defaulting to staff');
      return { role: ROLES.STAFF, is_active: true };
    }

    return data;
  } catch (error) {
    console.error('Error fetching user role:', error);
    return { role: ROLES.STAFF, is_active: true };
  }
}

// Check if user has permission
export function hasPermission(userRole, permission) {
  if (!userRole || !permission) return false;
  const allowedRoles = PERMISSIONS[permission];
  return allowedRoles ? allowedRoles.includes(userRole) : false;
}

// Initialize role for first-time user (call on first login)
export async function initializeUserRole(userId, role = ROLES.STAFF) {
  try {
    // Check if already exists
    const { data: existing } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existing) {
      return { success: true, message: 'Role already exists' };
    }

    // Create new role
    const { error } = await supabase
      .from('user_roles')
      .insert([{
        user_id: userId,
        role: role,
        is_active: true,
        assigned_by: userId, // Self-assigned for first user
        notes: 'Initial role assignment'
      }]);

    if (error) throw error;

    return { success: true, message: 'Role initialized successfully' };
  } catch (error) {
    console.error('Error initializing role:', error);
    return { success: false, error: error.message };
  }
}

// Assign role to user (owner only)
export async function assignUserRole(targetUserId, role, assignedBy, notes = '') {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .upsert([{
        user_id: targetUserId,
        role: role,
        is_active: true,
        assigned_by: assignedBy,
        notes: notes,
        updated_at: new Date().toISOString()
      }], {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error assigning role:', error);
    return { success: false, error: error.message };
  }
}

// Deactivate user (owner only)
export async function deactivateUser(userId) {
  try {
    const { error } = await supabase
      .from('user_roles')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error deactivating user:', error);
    return { success: false, error: error.message };
  }
}

// Get all users with roles (owner only)
export async function getAllUsersWithRoles() {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error fetching users:', error);
    return { success: false, error: error.message };
  }
}
