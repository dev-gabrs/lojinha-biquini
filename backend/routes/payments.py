import os
import uuid
import requests
import hmac
import hashlib

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Order, Payment

payments_bp = Blueprint('payments', __name__)

MP_API = 'https://api.mercadopago.com/v1/orders'


def mp_headers():
    return {
        'Authorization': f"Bearer {os.getenv('MP_ACCESS_TOKEN')}",
        'Content-Type': 'application/json',
        'X-Idempotency-Key': str(uuid.uuid4())
    }

def assinatura_valida():
    """Confere se a notificação veio mesmo do Mercado Pago."""
    segredo = os.getenv('MP_WEBHOOK_SECRET')

    # sem segredo configurado, não dá pra validar
    if not segredo:
        print('AVISO: MP_WEBHOOK_SECRET não configurado, validação pulada')
        return True

    x_signature = request.headers.get('x-signature')
    x_request_id = request.headers.get('x-request-id')
    data_id = request.args.get('data.id')

    if not x_signature:
        return False

    ts = None
    hash_recebido = None
    for parte in x_signature.split(','):
        if '=' not in parte:
            continue
        chave, valor = parte.split('=', 1)
        chave = chave.strip()
        if chave == 'ts':
            ts = valor.strip()
        elif chave == 'v1':
            hash_recebido = valor.strip()

    if not ts or not hash_recebido:
        return False

    # monta o texto exatamente no formato que o Mercado Pago espera
    manifesto = ''
    if data_id:
        manifesto += f'id:{data_id.lower()};'
    if x_request_id:
        manifesto += f'request-id:{x_request_id};'
    manifesto += f'ts:{ts};'

    hash_calculado = hmac.new(
        segredo.encode('utf-8'),
        manifesto.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(hash_calculado, hash_recebido)


@payments_bp.route('/criar/<int:order_id>', methods=['POST'])
@jwt_required()
def criar_pagamento(order_id):
    user_id = int(get_jwt_identity())
    order = Order.query.get_or_404(order_id)

    if order.user_id != user_id:
        return jsonify({'error': 'Acesso negado'}), 403

    if order.status != 'pendente':
        return jsonify({'error': 'Este pedido já foi processado'}), 409

    # monta os itens no formato que o Mercado Pago espera
    itens = []
    for item in order.items:
        itens.append({
            'title': item.product_name,
            'quantity': item.quantity,
            'unit_price': f'{float(item.unit_price):.2f}'
        })

    corpo = {
        'type': 'online',
        'processing_mode': 'manual',
        'total_amount': f'{float(order.total):.2f}',
        'external_reference': str(order.id),
        'items': itens,
        'config': {
            'online': {
                'success_url': f"{os.getenv('FRONTEND_URL')}/pagamento/sucesso",
                'failure_url': f"{os.getenv('FRONTEND_URL')}/pagamento/erro",
                'pending_url': f"{os.getenv('FRONTEND_URL')}/pagamento/pendente",
                'auto_return': 'approved'
            }
        }
    }

    try:
        resposta = requests.post(MP_API, json=corpo, headers=mp_headers(), timeout=15)
    except requests.RequestException:
        return jsonify({'error': 'Não foi possível contatar o Mercado Pago'}), 503

    if resposta.status_code != 201:
        return jsonify({
            'error': 'Erro ao criar cobrança',
            'detalhe': resposta.json()
        }), 502

    dados = resposta.json()

    pagamento = Payment(
        order_id=order.id,
        mp_order_id=dados.get('id'),
        checkout_url=dados.get('checkout_url'),
        status='pendente'
    )
    db.session.add(pagamento)
    db.session.commit()

    return jsonify({
        'checkout_url': dados.get('checkout_url'),
        'order_id': order.id
    }), 201

## Parte que confirma o pagamento:

@payments_bp.route('/webhook', methods=['POST'])
def webhook():
    if not assinatura_valida():
        print('WEBHOOK REJEITADO: assinatura inválida')
        return jsonify({'error': 'assinatura inválida'}), 401

    dados = request.get_json(silent=True) or {}
    print('WEBHOOK RECEBIDO:', dados)

    # o Mercado Pago avisa que algo mudou, mas não confia no conteúdo:
    # vai perguntar pra API qual é o status real
    mp_order_id = request.args.get('data.id')
    if not mp_order_id and dados.get('data'):
        mp_order_id = dados['data'].get('id')

    if not mp_order_id:
        return jsonify({'ok': True}), 200

    try:
        consulta = requests.get(
            f'{MP_API}/{mp_order_id}',
            headers={'Authorization': f"Bearer {os.getenv('MP_ACCESS_TOKEN')}"},
            timeout=15
        )
    except requests.RequestException:
        return jsonify({'ok': False}), 200

    if consulta.status_code != 200:
        return jsonify({'ok': True}), 200

    info = consulta.json()
    status_mp = info.get('status')
    order_id = info.get('external_reference')
    print('STATUS NO MP:', status_mp, '| PEDIDO:', order_id)

    if not order_id:
        return jsonify({'ok': True}), 200

    order = Order.query.get(int(order_id))
    if not order:
        return jsonify({'ok': True}), 200

    pagamento = Payment.query.filter_by(order_id=order.id).first()

    if status_mp == 'processed':
        order.status = 'pago'
        if pagamento:
            pagamento.status = 'aprovado'
    elif status_mp in ('cancelled', 'expired'):
        order.status = 'cancelado'
        if pagamento:
            pagamento.status = 'cancelado'

    db.session.commit()
    return jsonify({'ok': True}), 200

## Rota de consulta para Webhook:

@payments_bp.route('/consultar/<int:order_id>', methods=['POST'])
@jwt_required()
def consultar_pagamento(order_id):
    user_id = int(get_jwt_identity())
    order = Order.query.get_or_404(order_id)

    if order.user_id != user_id:
        return jsonify({'error': 'Acesso negado'}), 403

    pagamento = Payment.query.filter_by(order_id=order.id).first()
    if not pagamento or not pagamento.mp_order_id:
        return jsonify({'error': 'Nenhuma cobrança criada para este pedido'}), 404

    try:
        consulta = requests.get(
            f'{MP_API}/{pagamento.mp_order_id}',
            headers={'Authorization': f"Bearer {os.getenv('MP_ACCESS_TOKEN')}"},
            timeout=15
        )
    except requests.RequestException:
        return jsonify({'error': 'Não foi possível contatar o Mercado Pago'}), 503

    if consulta.status_code != 200:
        return jsonify({'error': 'Erro ao consultar', 'detalhe': consulta.json()}), 502

    info = consulta.json()
    status_mp = info.get('status')
    print('CONSULTA MANUAL - STATUS NO MP:', status_mp)

    if status_mp == 'processed':
        order.status = 'pago'
        pagamento.status = 'aprovado'
    elif status_mp in ('cancelled', 'expired'):
        order.status = 'cancelado'
        pagamento.status = 'cancelado'

    db.session.commit()

    return jsonify({
        'status_pedido': order.status,
        'status_mercadopago': status_mp
    }), 200