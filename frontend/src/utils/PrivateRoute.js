import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function PrivateRoute() {
  const { currentUser, loading } = useAuth();
  if (loading) return null; // Or a spinner/loading component
  return currentUser ? <Outlet /> : <Navigate to="/login" replace />;
}

export default PrivateRoute;