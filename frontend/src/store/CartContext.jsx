import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';

const GUEST_KEY = 'guestCart';
const CartContext = createContext(null);

// visitante: o carrinho fica no navegador até ela criar conta
function readGuestCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(GUEST_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeGuestCart(items) {
  localStorage.setItem(GUEST_KEY, JSON.stringify(items));
}

export function CartProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [cart, setCart] = useState({ items: [], total: 0 });
  const [guestItems, setGuestItems] = useState(readGuestCart);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setCart(await api.get('/cart'));
    } catch {
      // carrinho é secundário: erro aqui não pode derrubar a página
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      refresh();
    } else {
      setCart({ items: [], total: 0 });
      setGuestItems(readGuestCart());
    }
  }, [user, authLoading, refresh]);

  const count = user
    ? cart.items.reduce((sum, item) => sum + item.quantity, 0)
    : guestItems.reduce((sum, item) => sum + item.quantity, 0);

  async function addItem({ productId, variationId = null, quantity = 1 }) {
    if (user) {
      await api.post('/cart/items', {
        product_id: productId,
        variation_id: variationId,
        quantity
      });
      await refresh();
      return;
    }

    const existing = guestItems.find(
      (item) => item.product_id === productId && item.variation_id === variationId
    );
    const next = existing
      ? guestItems.map((item) =>
          item === existing ? { ...item, quantity: item.quantity + quantity } : item
        )
      : [...guestItems, { product_id: productId, variation_id: variationId, quantity }];

    setGuestItems(next);
    writeGuestCart(next);
  }

  return (
    <CartContext.Provider value={{ cart, guestItems, count, refresh, addItem }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart precisa estar dentro de CartProvider');
  return context;
}