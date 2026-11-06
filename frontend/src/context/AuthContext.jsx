import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

function restoreUser() {
  try {
    const savedUser = localStorage.getItem('journal_user');
    if (savedUser) return JSON.parse(savedUser);

    const token = localStorage.getItem('journal_token');
    const payload = token?.split('.')[1];
    if (!payload) return null;
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return claims.userId ? { _id: claims.userId, name: 'Journaler' } : null;
  } catch {
    return null;
  }
}

function storeUser(user) {
  localStorage.setItem('journal_user', JSON.stringify(user));
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(restoreUser);
  const [loading, setLoading] = useState(() => !restoreUser());

  useEffect(() => {
    const token = localStorage.getItem('journal_token');
    if (!token) {
      setLoading(false);
      return;
    }
    if (!navigator.onLine) {
      setLoading(false);
      return;
    }

    api
      .get('/auth/me', { timeout: 10000 })
      .then((res) => {
        storeUser(res.data.user);
        setUser(res.data.user);
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem('journal_token');
          localStorage.removeItem('journal_user');
          setUser(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (identifier, password) => {
    const res = await api.post('/auth/login', { identifier, password });
    localStorage.setItem('journal_token', res.data.token);
    storeUser(res.data.user);
    setUser(res.data.user);
  }, []);

  const register = useCallback(async (name, username, email, password) => {
    const res = await api.post('/auth/register', { name, username, email, password });
    localStorage.setItem('journal_token', res.data.token);
    storeUser(res.data.user);
    setUser(res.data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('journal_token');
    localStorage.removeItem('journal_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
