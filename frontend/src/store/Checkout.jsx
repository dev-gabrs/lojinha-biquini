import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useCart } from './CartContext';

const EMPTY_ADDRESS = {
  apelido: '',
  rua: '',
  numero: '',
  complemento: '',
  bairro: '',
  cep: '',
  referencia: ''
};

function formatPrice(value) {
  return 'R$ ' + Number(value).toFixed(2).replace('.', ',');
}

// (00) 00000-0000 enquanto digita
function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function addressLine(address) {
  const parts = [`${address.rua}, ${address.numero}`];
  if (address.complemento) parts.push(address.complemento);
  parts.push(address.bairro);
  return parts.join(' · ');
}

export default function Checkout() {
  const { items, total, loading: cartLoading, refresh } = useCart();
  const navigate = useNavigate();

  const [addresses, setAddresses] = useState([]);
  const [deliveryType, setDeliveryType] = useState('entrega');
  const [phone, setPhone] = useState('');
  const [addressId, setAddressId] = useState(null);
  const [newAddress, setNewAddress] = useState(EMPTY_ADDRESS);
  const [saveAddress, setSaveAddress] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [pendingOrderId, setPendingOrderId] = useState(null);

  useEffect(() => {
    api.get('/addresses')
      .then((data) => {
        setAddresses(data);
        const main = data.find((item) => item.principal) || data[0];
        if (main) setAddressId(main.id);
      })
      .catch(() => setAddresses([]));
  }, []);

  // sacola vazia não tem o que finalizar
  useEffect(() => {
    if (!cartLoading && items.length === 0 && !pendingOrderId) {
      navigate('/carrinho', { replace: true });
    }
  }, [cartLoading, items.length, pendingOrderId, navigate]);

  function updateAddress(field, value) {
    setNewAddress({ ...newAddress, [field]: value });
  }

  async function startPayment(orderId) {
    const payment = await api.post(`/payments/criar/${orderId}`);
    // sai do site e vai para o ambiente do Mercado Pago
    window.location.href = payment.checkout_url;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Informe um telefone com DDD.');
      return;
    }

    const payload = { tipo_entrega: deliveryType, telefone: digits };

    if (deliveryType === 'entrega') {
      if (addressId) {
        payload.endereco_id = addressId;
      } else {
        if (!newAddress.rua.trim() || !newAddress.numero.trim() || !newAddress.bairro.trim()) {
          setError('Preencha rua, número e bairro.');
          return;
        }
        payload.endereco = newAddress;
        payload.salvar_endereco = saveAddress;
      }
    }

    setSubmitting(true);
    try {
      const order = await api.post('/orders/checkout', payload);
      setPendingOrderId(order.id);
      await refresh();
      await startPayment(order.id);
    } catch (e) {
      setError(e.message);
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function retryPayment() {
    setError('');
    setSubmitting(true);
    try {
      await startPayment(pendingOrderId);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // o pedido existe, mas o pagamento não abriu
  if (pendingOrderId && error) {
    return (
      <div className="page">
        <h2 className="section-title">Quase lá</h2>
        <div className="checkout-box">
          <p>
            Seu pedido <strong>#{pendingOrderId}</strong> foi registrado, mas não conseguimos
            abrir a tela de pagamento.
          </p>
          <p className="alert">{error}</p>
          <button onClick={retryPayment} disabled={submitting} className="add-button">
            {submitting ? 'Abrindo...' : 'Tentar pagamento de novo'}
          </button>
          <p className="cart-summary__note" style={{ marginTop: 14, marginBottom: 0 }}>
            Se não der certo, fale com a gente pelo WhatsApp informando o número do pedido.
          </p>
        </div>
      </div>
    );
  }

  if (cartLoading) {
    return <div className="page"><p className="muted">Carregando...</p></div>;
  }

  return (
    <div className="page">
      <h2 className="section-title">Finalizar compra</h2>

      <form onSubmit={handleSubmit} className="checkout">
        <div>
          <div className="checkout-box">
            <p className="field-label">Como você quer receber?</p>

            <label className={deliveryType === 'entrega' ? 'option is-selected' : 'option'}>
              <input
                type="radio"
                name="entrega"
                checked={deliveryType === 'entrega'}
                onChange={() => setDeliveryType('entrega')}
              />
              <span>
                <strong>Entrega em Passo Fundo</strong>
                <small>Combinamos o valor e o horário com você depois</small>
              </span>
            </label>

            <label className={deliveryType === 'retirada' ? 'option is-selected' : 'option'}>
              <input
                type="radio"
                name="entrega"
                checked={deliveryType === 'retirada'}
                onChange={() => setDeliveryType('retirada')}
              />
              <span>
                <strong>Retirada</strong>
                <small>Combinamos o ponto de retirada pelo WhatsApp</small>
              </span>
            </label>
          </div>

          <div className="checkout-box">
            <p className="field-label">Telefone para contato</p>
            <input
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(54) 99999-9999"
              className="store-input"
              inputMode="tel"
            />
          </div>

          {deliveryType === 'entrega' && (
            <div className="checkout-box">
              <p className="field-label">Endereço de entrega</p>

              {addresses.map((address) => (
                <label
                  key={address.id}
                  className={addressId === address.id ? 'option is-selected' : 'option'}
                >
                  <input
                    type="radio"
                    name="endereco"
                    checked={addressId === address.id}
                    onChange={() => setAddressId(address.id)}
                  />
                  <span>
                    <strong>{address.apelido || 'Endereço'}</strong>
                    <small>{addressLine(address)}</small>
                  </span>
                </label>
              ))}

              <label className={addressId === null ? 'option is-selected' : 'option'}>
                <input
                  type="radio"
                  name="endereco"
                  checked={addressId === null}
                  onChange={() => setAddressId(null)}
                />
                <span><strong>Usar outro endereço</strong></span>
              </label>

              {addressId === null && (
                <div className="address-form">
                  <div className="field-row">
                    <div style={{ flex: 2 }}>
                      <label className="small-label">Rua</label>
                      <input
                        value={newAddress.rua}
                        onChange={(e) => updateAddress('rua', e.target.value)}
                        className="store-input"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="small-label">Número</label>
                      <input
                        value={newAddress.numero}
                        onChange={(e) => updateAddress('numero', e.target.value)}
                        className="store-input"
                      />
                    </div>
                  </div>

                  <div className="field-row">
                    <div style={{ flex: 1 }}>
                      <label className="small-label">Bairro</label>
                      <input
                        value={newAddress.bairro}
                        onChange={(e) => updateAddress('bairro', e.target.value)}
                        className="store-input"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="small-label">Complemento</label>
                      <input
                        value={newAddress.complemento}
                        onChange={(e) => updateAddress('complemento', e.target.value)}
                        placeholder="apto, bloco"
                        className="store-input"
                      />
                    </div>
                  </div>

                  <label className="small-label">Ponto de referência</label>
                  <input
                    value={newAddress.referencia}
                    onChange={(e) => updateAddress('referencia', e.target.value)}
                    placeholder="prédio azul, portão ao lado da padaria"
                    className="store-input"
                  />

                  <label className="checkbox-line">
                    <input
                      type="checkbox"
                      checked={saveAddress}
                      onChange={(e) => setSaveAddress(e.target.checked)}
                    />
                    Salvar este endereço para as próximas compras
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="cart-summary">
          <h3 className="field-label">Seu pedido</h3>

          {items.map((item) => (
            <div key={item.key} className="summary-item">
              <span>
                {item.quantity}× {item.name}
                {(item.size || item.color) && (
                  <small> ({[item.size, item.color].filter(Boolean).join(' / ')})</small>
                )}
              </span>
              <strong>{formatPrice(item.subtotal)}</strong>
            </div>
          ))}

          <div className="cart-summary__line" style={{ marginTop: 14 }}>
            <span>Total</span>
            <strong>{formatPrice(total)}</strong>
          </div>

          <p className="cart-summary__note">
            O pagamento acontece no ambiente seguro do Mercado Pago. Pix, cartão ou boleto.
          </p>

          {error && <p className="alert" style={{ marginTop: 0 }}>{error}</p>}

          <button type="submit" className="add-button" disabled={submitting}>
            {submitting ? 'Preparando...' : 'Ir para o pagamento'}
          </button>

          <Link to="/carrinho" className="back-link" style={{ marginTop: 16, marginBottom: 0 }}>
            Voltar para a sacola
          </Link>
        </aside>
      </form>
    </div>
  );
}