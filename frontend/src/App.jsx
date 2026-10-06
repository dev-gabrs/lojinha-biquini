import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { CartProvider } from './store/CartContext';
import AdminLayout from './admin/AdminLayout';
import Pedidos from './admin/Pedidos';
import Products from './admin/Products';
import StoreLayout from './store/StoreLayout';
import Home from './store/Home';
import SignIn from './store/SignIn';
import SignUp from './store/SignUp';
import ProductPage from './store/ProductPage';
import Cart from './store/Cart';
import Checkout from './store/Checkout';
import PaymentReturn from './store/PaymentReturn';
import MyOrders from './store/MyOrders';

function Protected({ children, adminOnly }) {
  const { user, loading } = useAuth();

  if (loading) return <p style={{ padding: 24, color: 'var(--cinza)' }}>Carregando...</p>;
  if (!user) return <Navigate to="/entrar" replace />;
  if (adminOnly && !user.is_admin) return <Navigate to="/" replace />;

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
        <Routes>
          <Route path="/entrar" element={<SignIn />} />
          <Route path="/cadastro" element={<SignUp />} />

          <Route path="/" element={<StoreLayout />}>
            <Route index element={<Home />} />
            <Route path="produto/:id" element={<ProductPage />} />
            <Route path="carrinho" element={<Cart />} />
            <Route path="checkout" element={<Protected><Checkout /></Protected>} />
            <Route path="pagamento/sucesso" element={<PaymentReturn result="success" />} />
            <Route path="pagamento/erro" element={<PaymentReturn result="failure" />} />
            <Route path="pagamento/pendente" element={<PaymentReturn result="pending" />} />
            <Route path="pedidos" element={<Protected><MyOrders /></Protected>} />
          </Route>

          <Route path="/admin" element={<Protected adminOnly><AdminLayout /></Protected>}>
            <Route path="pedidos" element={<Pedidos />} />
            <Route path="produtos" element={<Products />} />
            <Route index element={<Navigate to="pedidos" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}