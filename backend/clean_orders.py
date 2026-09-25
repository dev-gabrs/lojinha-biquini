import os
import uuid
from datetime import datetime, timedelta, timezone

import requests

from app import app
from models import db, Order, Payment
from orders_utils import cancelar_pedido, marcar_como_pago, STATUS_ENCERRADO_MP
from models import db, Order, Payment, LoginAttempt

MP_API = 'https://api.mercadopago.com/v1/orders'
PRAZO_MINUTOS = int(os.getenv('PRAZO_PAGAMENTO_MINUTOS', '30'))


def agora_utc():
    """O SQLite guarda as datas em UTC (3 horas à frente de Brasília)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def cabecalho():
    return {'Authorization': f"Bearer {os.getenv('MP_ACCESS_TOKEN')}"}


def consultar_mp(mp_order_id):
    resposta = requests.get(f'{MP_API}/{mp_order_id}', headers=cabecalho(), timeout=15)
    if resposta.status_code != 200:
        return None
    return resposta.json()


def cancelar_no_mp(mp_order_id):
    headers = cabecalho()
    headers['X-Idempotency-Key'] = str(uuid.uuid4())
    resposta = requests.post(f'{MP_API}/{mp_order_id}/cancel', headers=headers, timeout=15)
    return resposta.status_code == 200


def tem_boleto_aguardando(info):
    """Confere se a cliente gerou um boleto que ainda não foi pago."""
    pagamentos = (info.get('transactions') or {}).get('payments') or []
    for pagamento in pagamentos:
        metodo = pagamento.get('payment_method') or {}
        eh_boleto = metodo.get('type') == 'ticket' or metodo.get('id') == 'boleto'
        ja_terminou = pagamento.get('status') in ('processed', 'failed') + STATUS_ENCERRADO_MP
        if eh_boleto and not ja_terminou:
            return True
    return False


def processar(order):
    """Decide o que fazer com um pedido pendente. Devolve um texto pro relatório."""
    pagamento = Payment.query.filter_by(order_id=order.id).first()

    # 1. a cliente nem chegou a gerar a cobrança
    if not pagamento or not pagamento.mp_order_id:
        cancelar_pedido(order)
        return 'cancelado (cobrança nunca foi criada)'

    info = consultar_mp(pagamento.mp_order_id)
    if info is None:
        return 'não consegui consultar o Mercado Pago, fica pra próxima'

    status = info.get('status')

    # 2. foi pago, mas o webhook se perdeu
    if status == 'processed':
        marcar_como_pago(order)
        return 'estava pago, atualizado'

    # 3. o Mercado Pago já encerrou por conta própria
    if status in STATUS_ENCERRADO_MP:
        cancelar_pedido(order)
        return f'cancelado (Mercado Pago: {status})'

    # 4. boleto gerado: espera (o Mercado Pago encerra sozinho depois de 3 dias)
    if tem_boleto_aguardando(info):
        return 'boleto gerado, aguardando pagamento'

    # 5. ninguém pagou: cancela lá primeiro, e só depois aqui
    if cancelar_no_mp(pagamento.mp_order_id):
        cancelar_pedido(order)
        return 'cancelado por falta de pagamento'

    return 'não consegui cancelar no Mercado Pago, fica pra próxima'


def limpar():
    limite = agora_utc() - timedelta(minutes=PRAZO_MINUTOS)
    pendentes = Order.query.filter(
        Order.status == 'pendente',
        Order.created_at < limite
    ).all()

    print(f'{len(pendentes)} pedido(s) pendente(s) há mais de {PRAZO_MINUTOS} minuto(s)')

    for order in pendentes:
        try:
            resultado = processar(order)
        except requests.RequestException:
            resultado = 'erro de conexão, fica pra próxima'
        print(f'  Pedido #{order.id}: {resultado}')

    db.session.commit()

def clean_login_attempts():
    """Apaga tentativas de login antigas (mais de 1 dia)."""
    limite = agora_utc() - timedelta(days=1)
    apagadas = LoginAttempt.query.filter(LoginAttempt.created_at < limite).delete()
    db.session.commit()
    if apagadas:
        print(f'{apagadas} tentativa(s) de login antiga(s) apagada(s)')

if __name__ == '__main__':
    with app.app_context():
        limpar()
        clean_login_attempts()