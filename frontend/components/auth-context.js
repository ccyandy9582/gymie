"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../lib/api";

const STORAGE_KEY = "gymie-auth-v1";
const AuthContext = createContext(null);

function saveAuthState(nextState) {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

function loadAuthState() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [user, setUser] = useState(null);
  const [onboardingSkippedThisSession, setOnboardingSkippedThisSession] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    const persisted = loadAuthState();
    if (!persisted) {
      setIsBootstrapping(false);
      return;
    }

    setToken(persisted.accessToken || null);
    setRefreshToken(persisted.refreshToken || null);
    setUser(persisted.user || null);
    setIsBootstrapping(false);
  }, []);

  async function hydrateUser(accessToken) {
    const me = await apiRequest("/users/me", {
      token: accessToken,
    });
    setUser(me.user);
    saveAuthState({
      accessToken,
      refreshToken,
      user: me.user,
    });
    return me.user;
  }

  async function register(payload) {
    const data = await apiRequest("/auth/register", {
      method: "POST",
      body: payload,
    });

    setToken(data.tokens.accessToken);
    setRefreshToken(data.tokens.refreshToken);
    setUser(data.user);
    setOnboardingSkippedThisSession(false);
    saveAuthState({
      accessToken: data.tokens.accessToken,
      refreshToken: data.tokens.refreshToken,
      user: data.user,
    });
    return data;
  }

  async function login(email, password) {
    const data = await apiRequest("/auth/login", {
      method: "POST",
      body: { email, password },
    });

    setToken(data.tokens.accessToken);
    setRefreshToken(data.tokens.refreshToken);
    setUser(data.user);
    setOnboardingSkippedThisSession(false);
    saveAuthState({
      accessToken: data.tokens.accessToken,
      refreshToken: data.tokens.refreshToken,
      user: data.user,
    });
    return data;
  }

  async function refreshSession() {
    if (!refreshToken) {
      throw new Error("No refresh token");
    }

    const data = await apiRequest("/auth/refresh", {
      method: "POST",
      body: { refreshToken },
    });
    setToken(data.tokens.accessToken);
    setRefreshToken(data.tokens.refreshToken);
    setUser(data.user);
    saveAuthState({
      accessToken: data.tokens.accessToken,
      refreshToken: data.tokens.refreshToken,
      user: data.user,
    });
    return data;
  }

  async function authedRequest(path, options = {}) {
    if (!token) {
      throw new Error("Not authenticated");
    }

    try {
      return await apiRequest(path, {
        ...options,
        token,
      });
    } catch (error) {
      if (error.status === 401 && refreshToken) {
        const refreshed = await refreshSession();
        return apiRequest(path, {
          ...options,
          token: refreshed.tokens.accessToken,
        });
      }
      throw error;
    }
  }

  async function logout() {
    try {
      if (refreshToken) {
        await apiRequest("/auth/logout", {
          method: "DELETE",
          body: { refreshToken },
        });
      }
    } catch {
      // Best effort logout.
    }

    setToken(null);
    setRefreshToken(null);
    setUser(null);
    setOnboardingSkippedThisSession(false);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function setUserWithPersistence(nextUser) {
    setUser((prevUser) => {
      const resolvedUser = typeof nextUser === "function" ? nextUser(prevUser) : nextUser;

      if (token && refreshToken && resolvedUser) {
        saveAuthState({
          accessToken: token,
          refreshToken,
          user: resolvedUser,
        });
      }

      return resolvedUser;
    });
  }

  function skipOnboardingForSession() {
    setOnboardingSkippedThisSession(true);
  }

  function resetOnboardingSessionSkip() {
    setOnboardingSkippedThisSession(false);
  }

  const value = useMemo(
    () => ({
      token,
      refreshToken,
      user,
      onboardingSkippedThisSession,
      isBootstrapping,
      isAuthenticated: Boolean(token),
      register,
      login,
      logout,
      refreshSession,
      hydrateUser,
      authedRequest,
      setUser: setUserWithPersistence,
      skipOnboardingForSession,
      resetOnboardingSessionSkip,
    }),
    [token, refreshToken, user, onboardingSkippedThisSession, isBootstrapping],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
