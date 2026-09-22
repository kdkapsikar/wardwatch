import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, auth: null });

  useEffect(() => {
    api.me()
      .then(({ auth }) => {
        if (!auth) tokenStore.clear(); // expired or revoked token
        setState({ loading: false, auth });
      })
      .catch(() => setState({ loading: false, auth: null }));
  }, []);

  const login = useCallback(async (credentials) => {
    const { auth } = await api.login(credentials);
    setState({ loading: false, auth });
    return auth;
  }, []);

  const loginWithOtp = useCallback(async (phone, code) => {
    const { auth } = await api.verifyOtp(phone, code);
    setState({ loading: false, auth });
    return auth;
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => {});
    setState({ loading: false, auth: null });
  }, []);

  const value = useMemo(() => ({ ...state, login, loginWithOtp, logout }), [state, login, loginWithOtp, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
