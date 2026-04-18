import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import API from "../../api/axios";
import {
  clearAuthStorage,
  getStoredUser,
  getToken,
  saveAuthSession,
  saveAuthUser,
} from "./auth";
import { getHomeRouteForRole, normalizeRole } from "./roleAccess";

type AuthContextType = {
  user: any;
  role: string;
  loading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<any>;
  logout: () => void;
  refreshUser: () => Promise<any>;
  setUser: React.Dispatch<React.SetStateAction<any>>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(getStoredUser());
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const response = await API.get("/users/me/");
      setUser(response.data);
      saveAuthUser(response.data);
      return response.data;
    } catch (error) {
      clearAuthStorage();
      setUser(null);
      throw error;
    }
  };

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    if (user) {
      setLoading(false);
      refreshUser().catch(() => undefined);
      return;
    }

    refreshUser().finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const response = await API.post("/auth/login/", { username, password });
    saveAuthSession({
      access: response.data?.access,
      refresh: response.data?.refresh,
      user: response.data?.user,
    });
    setUser(response.data?.user || null);
    return response.data?.user;
  };

  const logout = () => {
    clearAuthStorage();
    setUser(null);
    if (typeof window !== "undefined") {
      window.location.assign("/login");
    }
  };

  const value = useMemo(
    () => ({
      user,
      role: normalizeRole(user?.effective_role || user?.role),
      loading,
      isAuthenticated: Boolean(getToken()),
      login,
      logout,
      refreshUser,
      setUser,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const useHomeRoute = () => {
  const { role } = useAuth();
  return getHomeRouteForRole(role);
};
