import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'

// No máximo quantos pedidos pendentes consultamos automaticamente ao abrir.
// Cada consulta é uma chamada ao Mercado Pago — não vale a pena varrer tudo.
const MAX_AUTO_CHECK = 5

const STATUS_LABELS = {
  pendente: 'Aguardando pagamento',
  pago: 'Pago',
  enviado: 'Enviado',
  entregue: 'Entregue',
  cancelado: 'Cancelado'
}

function formatPrice(value) {
  return 'R$ ' + Number(value).toFixed(2).replace('.', ',')
}

function formatDate(value) {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function itemLabel(item) {
  const variation = [item.size, item.color].filter(Boolean).join(' / ')
  return variation ? `${item.product_name} (${variation})` : item.product_name
}

export default function MyOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.get('/orders')
      setOrders(data)
      return data
    } catch {
      setError('Não conseguimos carregar seus pedidos.')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  // Rede de segurança: se o webhook do Mercado Pago não chegou,
  // perguntamos nós mesmos sobre os pedidos ainda pendentes.
  useEffect(() => {
    let cancelled = false

    async function loadAndCheck() {
      const data = await load()
      const pending = data.filter((order) => order.status === 'pendente')
      if (pending.length === 0) return

      let changed = false
      for (const order of pending.slice(0, MAX_AUTO_CHECK)) {
        if (cancelled) return
        try {
          const result = await api.post(`/payments/consultar/${order.id}`)
          if (result.status_pedido !== 'pendente') changed = true
        } catch {
          // pedido sem cobrança criada, ou Mercado Pago fora do ar: segue o baile
        }
      }
      // só recarrega se algo realmente mudou
      if (changed && !cancelled) load()
    }

    loadAndCheck()
    return () => { cancelled = true }
  }, [load])

  async function handlePay(orderId) {
    setBusyId(orderId)
    setError('')
    try {
      const payment = await api.post(`/payments/criar/${orderId}`)
      localStorage.setItem('pendingOrderId', orderId)
      window.location.href = payment.checkout_url
    } catch (e) {
      setError(e.message)
      setBusyId(null)
    }
  }

  if (loading) {
    return <div className="page"><p className="muted">Carregando seus pedidos...</p></div>
  }

  if (orders.length === 0) {
    return (
      <div className="page">
        <h2 className="section-title">Meus pedidos</h2>
        <p className="muted">Você ainda não fez nenhum pedido.</p>
        <Link to="/" className="back-link">Ver os biquínis</Link>
      </div>
    )
  }

  return (
    <div className="page">
      <h2 className="section-title">Meus pedidos</h2>

      {error && <p className="alert">{error}</p>}

      <div className="orders-list">
        {orders.map((order) => (
          <article key={order.id} className="order-card">
            <header className="order-card__head">
              <div>
                <strong>Pedido #{order.id}</strong>
                <small className="muted">{formatDate(order.created_at)}</small>
              </div>
              <span className={`order-tag order-tag--${order.status}`}>
                {STATUS_LABELS[order.status] || order.status}
              </span>
            </header>

            <ul className="order-card__items">
              {order.items.map((item) => (
                <li key={item.id}>
                  {item.quantity}× {itemLabel(item)}
                  <span>{formatPrice(item.subtotal)}</span>
                </li>
              ))}
            </ul>

            <footer className="order-card__foot">
              <strong>{formatPrice(order.total)}</strong>
              {order.status === 'pendente' && (
                <button
                  className="add-button"
                  onClick={() => handlePay(order.id)}
                  disabled={busyId === order.id}
                >
                  {busyId === order.id ? 'Abrindo...' : 'Pagar agora'}
                </button>
              )}
            </footer>
          </article>
        ))}
      </div>
    </div>
  )
}