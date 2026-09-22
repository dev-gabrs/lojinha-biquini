from datetime import datetime, timedelta, timezone

from flask import Blueprint, request, jsonify
from sqlalchemy import func

from auth_utils import admin_required
from models import db, Order, Product, ProductVariation
from orders_utils import cancelar_pedido, STATUS_TRANSITIONS

admin_bp = Blueprint('admin', __name__)

PER_PAGE_DEFAULT = 20
PER_PAGE_MAX = 100
LOW_STOCK_THRESHOLD = 3


@admin_bp.route('/orders', methods=['GET'])
@admin_required
def list_orders():
    query = Order.query

    status = request.args.get('status')
    if status:
        if status not in STATUS_TRANSITIONS:
            return jsonify({'error': 'Status inválido'}), 400
        query = query.filter_by(status=status)

    try:
        page = max(1, int(request.args.get('page', 1)))
        per_page = int(request.args.get('per_page', PER_PAGE_DEFAULT))
    except ValueError:
        return jsonify({'error': 'Paginação inválida'}), 400

    per_page = min(max(1, per_page), PER_PAGE_MAX)

    paginacao = query.order_by(Order.created_at.desc()) \
        .paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'pedidos': [o.to_admin_dict() for o in paginacao.items],
        'pagina': paginacao.page,
        'total_paginas': paginacao.pages,
        'total': paginacao.total
    }), 200


@admin_bp.route('/orders/<int:order_id>', methods=['GET'])
@admin_required
def get_order(order_id):
    order = Order.query.get_or_404(order_id)
    return jsonify(order.to_admin_dict()), 200


@admin_bp.route('/orders/<int:order_id>/status', methods=['PATCH'])
@admin_required
def update_order_status(order_id):
    order = Order.query.get_or_404(order_id)
    data = request.get_json(silent=True) or {}
    novo_status = data.get('status')

    permitidos = STATUS_TRANSITIONS.get(order.status, ())
    if novo_status not in permitidos:
        return jsonify({
            'error': f'Não dá para mudar de "{order.status}" para "{novo_status}"',
            'permitidos': list(permitidos)
        }), 409

    aviso = None

    if novo_status == 'cancelado':
        # pedido pago cancelado: o estoque volta, mas o dinheiro não
        if order.status == 'pago':
            aviso = ('O estoque foi devolvido, mas o reembolso precisa ser feito '
                     'por você no painel do Mercado Pago.')
        cancelar_pedido(order)
    else:
        order.status = novo_status

    db.session.commit()

    resposta = order.to_admin_dict()
    if aviso:
        resposta['aviso'] = aviso
    return jsonify(resposta), 200


@admin_bp.route('/stats', methods=['GET'])
@admin_required
def stats():
    por_status = dict(
        db.session.query(Order.status, func.count(Order.id))
        .group_by(Order.status).all()
    )

    faturamento = db.session.query(func.sum(Order.total)).filter(
        Order.status.in_(('pago', 'enviado', 'entregue'))
    ).scalar() or 0

    ontem = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1)
    ultimas_24h = Order.query.filter(Order.created_at >= ontem).count()

    return jsonify({
        'pedidos_por_status': por_status,
        'faturamento': round(float(faturamento), 2),
        'pedidos_ultimas_24h': ultimas_24h
    }), 200


@admin_bp.route('/low-stock', methods=['GET'])
@admin_required
def low_stock():
    variacoes = ProductVariation.query.filter(
        ProductVariation.stock <= LOW_STOCK_THRESHOLD
    ).all()

    produtos = Product.query.filter(
        Product.stock.isnot(None),
        Product.stock <= LOW_STOCK_THRESHOLD,
        Product.active.is_(True)
    ).all()

    alertas = [{
        'produto': p.name,
        'variacao': None,
        'estoque': p.stock
    } for p in produtos]

    for v in variacoes:
        if v.product and v.product.active:
            alertas.append({
                'produto': v.product.name,
                'variacao': ' / '.join(d for d in (v.size, v.color) if d),
                'estoque': v.stock
            })

    return jsonify({'alertas': alertas, 'limite': LOW_STOCK_THRESHOLD}), 200