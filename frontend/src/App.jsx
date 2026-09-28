import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './admin/AdminLayout';
import Login from './admin/Login';
import Pedidos from './admin/Pedidos';
import Products from './admin/Products';
import { getAccessToken } from './api';

function Protegida({ children }) {
  return getAccessToken() ? children : <Navigate to="/admin/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/login" element={<Login />} />

        <Route
          path="/admin"
          element={<Protegida><AdminLayout /></Protegida>}
        >
          <Route path="pedidos" element={<Pedidos />} />
          <Route path="produtos" element={<Products />} />
          <Route index element={<Navigate to="pedidos" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/admin/pedidos" replace />} />
      </Routes>
    </BrowserRouter>
  );
}