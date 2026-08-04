import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api, setToken as saveToken } from '../api/client';
import { getPortalPath } from '../constants/roles';

const AuthContext = createContext(null);
const SESSION_IDLE_MS = 30 * 60 * 1000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [blockedMessage, setBlockedMessage] = useState('');
  const idleTimer = useRef(null);

  const resetIdleTimer = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (!api.getToken()) return;
    idleTimer.current = setTimeout(() => {
      saveToken(null);
      setUser(null);
      setBlockedMessage('Session expired due to inactivity. Please sign in again.');
    }, SESSION_IDLE_MS);
  };

  useEffect(() => {
    const onActivity = () => resetIdleTimer();
    window.addEventListener('mousemove', onActivity);
    window.addEventListener('keydown', onActivity);
    window.addEventListener('click', onActivity);
    return () => {
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('click', onActivity);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [user]);

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
        resetIdleTimer();
      })
      .catch(() => saveToken(null))
      .finally(() => setLoading(false));
  }, []);

  const applySession = async (token) => {
    saveToken(token);
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
    resetIdleTimer();
    return me;
  };

  const login = async (payload) => {
    const data = await api.post('/auth/login', payload);
    if (data.mfaRequired) {
      const err = new Error('MFA_REQUIRED');
      err.mfaRequired = true;
      err.pendingToken = data.pendingToken;
      throw err;
    }
    return applySession(data.token);
  };

  const verifyMfa = async ({ pendingToken, mfaToken }) => {
    const data = await api.post('/mfa/verify', { pendingToken, mfaToken });
    return applySession(data.token);
  };

  const loginWithSocial = async (provider) => {
    const data = await api.post('/oauth/dev', { provider });
    return applySession(data.token);
  };

  const loginWithOtp = async ({ phone, otp, otpId }) => {
    const data = await api.post('/otp/verify-login', { phone, otp, otpId });
    return applySession(data.token);
  };

  const register = async (payload) => applySession((await api.post('/auth/register', payload)).token);

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
    resetIdleTimer();
    return me;
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      blockedMessage,
      login,
      loginWithOtp,
      verifyMfa,
      loginWithSocial,
      register,
      logout,
      refreshUser,
      isAdmin: !!user?.isAdmin,
      portalPath: user ? getPortalPath(user.role || (user.isAdmin ? 'admin' : 'passenger')) : '/home'
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
