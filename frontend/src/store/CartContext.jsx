import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';

const GUEST_KEY = 'guestCart';
const CartContext = createContext(null);

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

function itemKey(productId, variationId) {
  return `${productId}-${variationId ?? 'unica'}`;
}

export function CartProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- Cliente logado: o carrinho vive no servidor ---
  const loadServerCart = useCallback(async () => {
    const data = await api.get('/cart');
    setItems(data.items.map((item) => ({
      key: itemKey(item.product_id, item.variation?.id ?? null),
      id: item.id,
      productId: item.product_id,
      variationId: item.variation?.id ?? null,
      name: item.product_name,
      imageUrl: item.image_url,
      size: item.variation?.size || null,
      color: item.variation?.color || null,
      unitPrice: item.unit_price,
      quantity: item.quantity,
      subtotal: item.subtotal,
      available: item.available_stock
    })));
  }, []);

  // --- Visitante: o carrinho vive no navegador e pode estar velho ---
  const loadGuestCart = useCallback(async () => {
    const stored = readGuestCart();
    if (stored.length === 0) {
      setItems([]);
      return;
    }

    const ids = [...new Set(stored.map((entry) => entry.product_id))];
    const products = await Promise.all(
      ids.map((id) => api.get(`/products/${id}`).catch(() => null))
    );
    const byId = new Map(products.filter(Boolean).map((product) => [product.id, product]));

    const resolved = [];
    const notes = [];
    const stillValid = [];

    for (const entry of stored) {
      const product = byId.get(entry.product_id);
      if (!product) {
        notes.push('Uma peça da sua sacola não está mais disponível.');
        continue;
      }

      const variation = entry.variation_id
        ? product.variations.find((item) => item.id === entry.variation_id)
        : null;

      if (entry.variation_id && !variation) {
        notes.push(`Uma opção de ${product.name} não está mais disponível.`);
        continue;
      }

      const available = variation ? variation.stock : (product.stock ?? 0);
      const quantity = available > 0 ? Math.min(entry.quantity, available) : entry.quantity;

      if (available > 0 && quantity < entry.quantity) {
        notes.push(`${product.name}: ajustamos a quantidade para ${quantity}.`);
      }

      const unitPrice = variation?.price ?? product.price;

      resolved.push({
        key: itemKey(product.id, variation?.id ?? null),
        id: null,
        productId: product.id,
        variationId: variation?.id ?? null,
        name: product.name,
        imageUrl: product.image_url,
        size: variation?.size || null,
        color: variation?.color || null,
        unitPrice,
        quantity,
        subtotal: Math.round(unitPrice * quantity * 100) / 100,
        available
      });

      stillValid.push({
        product_id: product.id,
        variation_id: variation?.id ?? null,
        quantity
      });
    }

    // guarda a versão já limpa, para não repetir os avisos
    writeGuestCart(stillValid);
    setItems(resolved);
    if (notes.length > 0) setWarnings(notes);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (user) {
        await loadServerCart();
      } else {
        await loadGuestCart();
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user, loadServerCart, loadGuestCart]);

  // ao entrar, o carrinho do navegador se junta ao da conta
  useEffect(() => {
    if (authLoading) return;

    async function sync() {
      if (user) {
        const stored = readGuestCart();
        if (stored.length > 0) {
          try {
            const data = await api.post('/cart/juntar', { items: stored });
            if (data.avisos?.length > 0) setWarnings(data.avisos);
            writeGuestCart([]);
          } catch {
            // se falhar, o carrinho local fica para a próxima tentativa
          }
        }
      }
      await refresh();
    }

    sync();
  }, [user, authLoading, refresh]);

  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = Math.round(items.reduce((sum, item) => sum + item.subtotal, 0) * 100) / 100;

  async function addItem({ productId, variationId = null, quantity = 1 }) {
    if (user) {
      await api.post('/cart/items', {
        product_id: productId,
        variation_id: variationId,
        quantity
      });
    } else {
      const stored = readGuestCart();
      const existing = stored.find(
        (entry) => entry.product_id === productId && entry.variation_id === variationId
      );
      const next = existing
        ? stored.map((entry) =>
            entry === existing ? { ...entry, quantity: entry.quantity + quantity } : entry
          )
        : [...stored, { product_id: productId, variation_id: variationId, quantity }];
      writeGuestCart(next);
    }
    await refresh();
  }

  async function updateQuantity(item, quantity) {
    if (quantity < 1) return;

    if (user) {
      await api.put(`/cart/items/${item.id}`, { quantity });
    } else {
      const stored = readGuestCart().map((entry) =>
        entry.product_id === item.productId && entry.variation_id === item.variationId
          ? { ...entry, quantity }
          : entry
      );
      writeGuestCart(stored);
    }
    await refresh();
  }

  async function removeItem(item) {
    if (user) {
      await api.del(`/cart/items/${item.id}`);
    } else {
      const stored = readGuestCart().filter(
        (entry) =>
          !(entry.product_id === item.productId && entry.variation_id === item.variationId)
      );
      writeGuestCart(stored);
    }
    await refresh();
  }

  function dismissWarnings() {
    setWarnings([]);
  }

  return (
    <CartContext.Provider
      value={{ items, count, total, loading, warnings, dismissWarnings, addItem, updateQuantity, removeItem, refresh }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart precisa estar dentro de CartProvider');
  return context;
}