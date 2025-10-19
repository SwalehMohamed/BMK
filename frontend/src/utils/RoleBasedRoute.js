import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function RoleBasedRoute({ allowedRoles }) {
  const { currentUser, loading } = useAuth();
  if (loading) return null; // Or a spinner/loading component
  if (!currentUser) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(currentUser.role)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

export default RoleBasedRoute;