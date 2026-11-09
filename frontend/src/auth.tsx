import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ApiError, api, getToken, setToken } from "./api";
import { resetSeen } from "./seen";
import type { User } from "./types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      return;
    }
    try {
      setUser(await api.me());
    } catch (e) {
      // Só uma sessão inválida encerra o login: falha de rede ou do servidor não deve deslogar
      if (e instanceof ApiError && e.status === 401) setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const { access_token, user } = await api.login(email, password);
    resetSeen();
    setToken(access_token);
    setUser(user);
    return user;
  };

  const register = async (name: string, email: string, password: string) => {
    const { access_token, user } = await api.register(name, email, password);
    resetSeen();
    setToken(access_token);
    setUser(user);
    return user;
  };

  const logout = () => {
    resetSeen();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
