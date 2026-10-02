import { createContext, useContext, useEffect, useState } from 'react';
import { api, saveTokens, clearTokens, getAccessToken } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ao abrir o site, descobre se já havia alguém logado
  useEffect(() => {
    async function loadUser() {
      if (!getAccessToken()) {
        setLoading(false);
        return;
      }
      try {
        setUser(await api.get('/auth/me'));
      } catch {
        clearTokens();
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  function applySession(data) {
    saveTokens({ access: data.access_token, refresh: data.refresh_token });
    setUser(data.user);
    return data.user;
  }

  async function signIn(email, password) {
    return applySession(await api.post('/auth/login', { email, password }));
  }

  async function signUp(name, email, password) {
    return applySession(await api.post('/auth/register', { name, email, password }));
  }

  function signOut() {
    clearTokens();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de AuthProvider');
  return context;
}