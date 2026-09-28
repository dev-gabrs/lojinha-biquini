import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
          path="/admin/pedidos"
          element={<Protegida><Pedidos /></Protegida>}
        />
        <Route
          path="/admin/produtos"
          element={<Protegida><Products /></Protegida>}
        />
        <Route path="*" element={<Navigate to="/admin/pedidos" replace />} />
      </Routes>
    </BrowserRouter>
  );
}