import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './admin/Login';
import Pedidos from './admin/Pedidos';
import { getToken } from './api';

function Protegida({ children }) {
  return getToken() ? children : <Navigate to="/admin/login" replace />;
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
        <Route path="*" element={<Navigate to="/admin/pedidos" replace />} />
      </Routes>
    </BrowserRouter>
  );
}