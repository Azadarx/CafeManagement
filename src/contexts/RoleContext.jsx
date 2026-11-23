import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { getUserRole, ROLES, hasPermission as checkPermission } from '../utils/roleManager';

const RoleContext = createContext();

export function RoleProvider({ children }) {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState(null);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadUserRole();
    } else {
      setUserRole(null);
      setIsActive(true);
      setLoading(false);
    }
  }, [user]);

  const loadUserRole = async () => {
    setLoading(true);
    try {
      const { role, is_active } = await getUserRole(user.id);
      setUserRole(role);
      setIsActive(is_active);
    } catch (error) {
      console.error('Error loading role:', error);
      // Default to staff on error
      setUserRole(ROLES.STAFF);
      setIsActive(true);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (permission) => {
    return checkPermission(userRole, permission);
  };

  const isOwner = () => userRole === ROLES.OWNER;
  const isManager = () => userRole === ROLES.MANAGER;
  const isStaff = () => userRole === ROLES.STAFF;
  const isViewer = () => userRole === ROLES.VIEWER;

  const value = {
    userRole,
    isActive,
    loading,
    hasPermission,
    isOwner,
    isManager,
    isStaff,
    isViewer,
    refreshRole: loadUserRole
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
