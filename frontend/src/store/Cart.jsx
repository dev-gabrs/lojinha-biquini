import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useCart } from './CartContext';

function formatPrice(value) {
  return 'R$ ' + Number(value).toFixed(2).replace('.', ',');
}

export default function Cart() {
  const { items, total, loading, warnings, dismissWarnings, updateQuantity, removeItem } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [actionError, setActionError] = useState('');
  const [busyKey, setBusyKey] = useState(null);

  const unavailable = items.filter((item) => item.available === 0);
  const canCheckout = items.length > 0 && unavailable.length === 0;

  async function handleQuantity(item, quantity) {
    setActionError('');
    setBusyKey(item.key);
    try {
      await updateQuantity(item, quantity);
    } catch (e) {
      setActionError(e.message);
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRemove(item) {
    setActionError('');
    setBusyKey(item.key);
    try {
      await removeItem(item);
    } catch (e) {
      setActionError(e.message);
    } finally {
      setBusyKey(null);
    }
  }

  function handleCheckout() {
    if (user) {
      navigate('/checkout');
    } else {
      // depois de entrar, volta direto para o checkout
      navigate('/entrar', { state: { from: '/checkout' } });
    }
  }

  if (loading) {
    return <div className="page"><p className="muted">Carregando sua sacola...</p></div>;
  }

  if (items.length === 0) {
    return (
      <div className="page">
        <h2 className="section-title">Sua sacola</h2>
        <p className="muted">Sua sacola está vazia.</p>
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Link to="/" className="load-more__button">Ver produtos</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h2 className="section-title">Sua sacola</h2>

      {warnings.length > 0 && (
        <div className="alert" style={{ marginBottom: 20 }}>
          {warnings.map((warning, index) => <div key={index}>{warning}</div>)}
          <button onClick={dismissWarnings} className="link-button">Entendi</button>
        </div>
      )}

      {actionError && <p className="alert" style={{ marginBottom: 20 }}>{actionError}</p>}

      <div className="cart">
        <div>
          {items.map((item) => (
            <div key={item.key} className="cart-item">
              <div className="cart-item__photo">
                {item.imageUrl && <img src={item.imageUrl} alt={item.name} />}
              </div>

              <div className="cart-item__info">
                <Link to={`/produto/${item.productId}`} className="cart-item__name">
                  {item.name}
                </Link>
                {(item.size || item.color) && (
                  <p className="cart-item__variation">
                    {[item.size, item.color].filter(Boolean).join(' / ')}
                  </p>
                )}
                <p className="cart-item__unit">{formatPrice(item.unitPrice)} cada</p>

                {item.available === 0 ? (
                  <p className="cart-item__soldout">Esgotado — remova para continuar</p>
                ) : (
                  <div className="quantity">
                    <button
                      onClick={() => handleQuantity(item, item.quantity - 1)}
                      disabled={item.quantity <= 1 || busyKey === item.key}
                      aria-label="Diminuir"
                    >
                      −
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      onClick={() => handleQuantity(item, item.quantity + 1)}
                      disabled={item.quantity >= item.available || busyKey === item.key}
                      aria-label="Aumentar"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>

              <div className="cart-item__right">
                <strong>{formatPrice(item.subtotal)}</strong>
                <button
                  onClick={() => handleRemove(item)}
                  disabled={busyKey === item.key}
                  className="link-button"
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>

        <aside className="cart-summary">
          <h3 className="field-label">Resumo</h3>
          <div className="cart-summary__line">
            <span>Produtos</span>
            <strong>{formatPrice(total)}</strong>
          </div>
          <p className="cart-summary__note">
            A entrega é combinada com você depois da compra.
          </p>

          <button className="add-button" onClick={handleCheckout} disabled={!canCheckout}>
            {user ? 'Finalizar compra' : 'Entrar para finalizar'}
          </button>

          {unavailable.length > 0 && (
            <p className="cart-item__soldout" style={{ marginTop: 12 }}>
              Remova as peças esgotadas para continuar.
            </p>
          )}

          <Link to="/" className="back-link" style={{ marginTop: 16, marginBottom: 0 }}>
            Continuar comprando
          </Link>
        </aside>
      </div>
    </div>
  );
}