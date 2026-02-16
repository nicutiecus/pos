import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const token = localStorage.getItem('accessToken');
  const userRole = localStorage.getItem('userRole'); // e.g., 'ADMIN', 'MANAGER', 'CASHIER'

  // If there's no token, kick them back to login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // If specific roles are required and the user doesn't have one of them, kick them to their default view
  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    // Basic fallback routing based on role
    if (userRole === 'CASHIER') return <Navigate to="/pos" replace />;
    if (userRole === 'Tenant_Admin') return <Navigate to="/admin" replace />;
    return <Navigate to="/login" replace />;
  }

  // If they pass the checks, render the child layout (like AdminLayout)
  return <Outlet />;
};

export default ProtectedRoute;