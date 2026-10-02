import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import AdminLayout from './admin/AdminLayout';
import Pedidos from './admin/Pedidos';
import Products from './admin/Products';
import SignIn from './store/SignIn';
import SignUp from './store/SignUp';

function Protected({ children, adminOnly }) {
  const { user, loading } = useAuth();

  // espera o site descobrir se já havia alguém logado
  if (loading) return <p style={{ padding: 24, color: 'var(--cinza)' }}>Carregando...</p>;
  if (!user) return <Navigate to="/entrar" replace />;
  if (adminOnly && !user.is_admin) return <Navigate to="/" replace />;

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/entrar" element={<SignIn />} />
          <Route path="/cadastro" element={<SignUp />} />

          <Route path="/admin" element={<Protected adminOnly><AdminLayout /></Protected>}>
            <Route path="pedidos" element={<Pedidos />} />
            <Route path="produtos" element={<Products />} />
            <Route index element={<Navigate to="pedidos" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/entrar" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}