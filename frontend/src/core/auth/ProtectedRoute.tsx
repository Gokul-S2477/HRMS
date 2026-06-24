import React from "react";
import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "./AuthContext";

const ProtectedRoute = () => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return null;
  }

  if (isAuthenticated && user?.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
