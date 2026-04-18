import React from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "./AuthContext";
import { getHomeRouteForRole, roleMatches } from "./roleAccess";

type RoleRouteProps = {
  children: JSX.Element;
  allowedRoles: string[];
  loginPath?: string;
  forbiddenPath?: string;
};

const RoleRoute = ({ children, allowedRoles, loginPath = "/login", forbiddenPath }: RoleRouteProps) => {
  const { isAuthenticated, loading, role } = useAuth();

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to={loginPath} replace />;
  if (!roleMatches(role, allowedRoles)) {
    return <Navigate to={forbiddenPath || getHomeRouteForRole(role)} replace />;
  }
  return children;
};

export default RoleRoute;
