import { createContext, useContext, useEffect, useState } from 'react';
import { api, setToken as saveToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api.get('/auth/me')
      .then(setUser)
      .catch(() => saveToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (payload) => {
    const data = await api.post('/auth/login', payload);
    saveToken(data.token);
    const me = await api.get('/auth/me');
    setUser(me);
    return me;
  };

  const register = async (payload) => {
    const data = await api.post('/auth/register', payload);
    saveToken(data.token);
    const me = await api.get('/auth/me');
    setUser(me);
    return me;
  };

  const logout = () => {
    saveToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAdmin: !!user?.isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
