import { createContext, useContext, useEffect, useState } from 'react';
import { api, setToken as saveToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [blockedMessage, setBlockedMessage] = useState('');

  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api.get('/auth/me')
      .then((me) => {
        if (me.isBlocked) {
          saveToken(null);
          setUser(null);
          setBlockedMessage('Your account has been blocked. Contact support for assistance.');
          return;
        }
        setUser(me);
      })
      .catch(() => saveToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (payload) => {
    const data = await api.post('/auth/login', payload);
    saveToken(data.token);
    const me = await api.get('/auth/me');
    if (me.isBlocked) {
      saveToken(null);
      setUser(null);
      const err = new Error('Your account has been blocked. Contact support.');
      err.status = 403;
      throw err;
    }
    setBlockedMessage('');
    setUser(me);
    return me;
  };

  const register = async (payload) => {
    const data = await api.post('/auth/register', payload);
    saveToken(data.token);
    const me = await api.get('/auth/me');
    setBlockedMessage('');
    setUser(me);
    return me;
  };

  const logout = () => {
    saveToken(null);
    setUser(null);
    setBlockedMessage('');
  };

  const refreshUser = async () => {
    const me = await api.get('/auth/me');
    if (me.isBlocked) {
      saveToken(null);
      setUser(null);
      setBlockedMessage('Your account has been blocked. Contact support for assistance.');
      return null;
    }
    setUser(me);
    return me;
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      blockedMessage,
      login,
      register,
      logout,
      refreshUser,
      isAdmin: !!user?.isAdmin
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
