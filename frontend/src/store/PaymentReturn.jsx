import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { api } from '../api'

// Mensagens de cada situação
const MESSAGES = {
  checking: {
    title: 'Confirmando pagamento',
    text: 'Um instante, estamos verificando com o Mercado Pago.'
  },
  success: {
    title: 'Pagamento aprovado!',
    text: 'Recebemos seu pagamento. Já estamos separando seu pedido.'
  },
  failure: {
    title: 'O pagamento não foi concluído',
    text: 'Nada foi cobrado. Você pode tentar de novo quando quiser.'
  },
  pending: {
    title: 'Pagamento em análise',
    text: 'O Mercado Pago ainda está confirmando. Assim que aprovar, seu pedido entra na fila.'
  },
  unknown: {
    title: 'Não encontramos esse pedido',
    text: 'Se você acabou de pagar, confira em "Meus pedidos".'
  }
}

export default function PaymentReturn({ result }) {
  const [params] = useSearchParams()
  const [status, setStatus] = useState(null)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')

  // O Mercado Pago devolve o número do pedido em external_reference.
  // Se não vier, usamos o que o Checkout guardou no navegador.
  const orderId = params.get('external_reference') || localStorage.getItem('pendingOrderId')

  const check = useCallback(async () => {
    if (!orderId) {
      setChecking(false)
      return
    }
    setChecking(true)
    setError('')
    try {
      const data = await api.post(`/payments/consultar/${orderId}`)
      setStatus(data.status_pedido)
      // pedido resolvido: não precisa mais lembrar dele
      if (data.status_pedido !== 'pendente') {
        localStorage.removeItem('pendingOrderId')
      }
    } catch {
      setError('Não conseguimos confirmar agora. Tente novamente em instantes.')
    } finally {
      setChecking(false)
    }
  }, [orderId])

  useEffect(() => {
    check()
  }, [check])

  // A URL vem do navegador e pode ser forjada.
  // Enquanto não confirmamos, mostramos o estado neutro;
  // depois, quem decide a mensagem é o status do nosso banco.
  let shown = 'checking'
  if (!checking) {
    if (status === 'pago') shown = 'success'
    else if (status === 'cancelado') shown = 'failure'
    else if (status) shown = 'pending'
    else if (orderId) shown = result   // temos o pedido, mas a consulta falhou
    else shown = 'unknown'             // não sabemos nem qual pedido é
  }

  const message = MESSAGES[shown]

  return (
    <div className="payment-return">
      <h1>{message.title}</h1>
      <p>{message.text}</p>

      {checking && <p className="muted">Confirmando com o Mercado Pago…</p>}

      {!checking && status === 'pago' && (
        <p className="confirmed">Pedido nº {orderId} confirmado.</p>
      )}

      {!checking && status === 'pendente' && (
        <>
          <p className="muted">
            Ainda não consta como pago. Se você acabou de pagar, aguarde um instante.
          </p>
          <button className="add-button" onClick={check}>
            Verificar novamente
          </button>
        </>
      )}

      {error && <p className="alert">{error}</p>}

      <div className="payment-return-actions">
        <Link className="add-button" to="/pedidos">Ver meus pedidos</Link>
        <Link className="back-link" to="/">Voltar à loja</Link>
      </div>
    </div>
  )
}