from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Cart, Order, OrderItem, User

orders_bp = Blueprint('orders', __name__)


@orders_bp.route('/checkout', methods=['POST'])
@jwt_required()
def checkout():
    user_id = int(get_jwt_identity())
    cart = Cart.query.filter_by(user_id=user_id).first()

    if not cart or not cart.items:
        return jsonify({'error': 'Carrinho vazio'}), 400

    # 1ª passada: confere se TUDO tem estoque antes de mexer em qualquer coisa
    for item in cart.items:
        if item.variation:
            disponivel = item.variation.stock
        else:
            disponivel = item.product.stock if item.product.stock is not None else 0

        if disponivel < item.quantity:
            return jsonify({
                'error': f'Estoque insuficiente para {item.product.name}',
                'produto': item.product.name,
                'disponivel': disponivel
            }), 409

    # 2ª passada: agora sim cria o pedido e desconta estoque
    order = Order(user_id=user_id, total=0, status='pendente')

    total = 0
    for item in cart.items:
        order.items.append(OrderItem(
            product_id=item.product_id,
            variation_id=item.variation_id,
            product_name=item.product.name,
            size=item.variation.size if item.variation else None,
            color=item.variation.color if item.variation else None,
            unit_price=item.unit_price(),
            quantity=item.quantity
        ))
        total += item.subtotal()

        if item.variation:
            item.variation.stock -= item.quantity
        else:
            item.product.stock -= item.quantity

    order.total = round(total, 2)

    db.session.add(order)

    # esvazia o carrinho
    for item in list(cart.items):
        db.session.delete(item)

    db.session.commit()
    return jsonify(order.to_dict()), 201


@orders_bp.route('', methods=['GET'])
@jwt_required()
def meus_pedidos():
    user_id = int(get_jwt_identity())
    orders = Order.query.filter_by(user_id=user_id).order_by(Order.created_at.desc()).all()
    return jsonify([o.to_dict() for o in orders]), 200


@orders_bp.route('/<int:order_id>', methods=['GET'])
@jwt_required()
def ver_pedido(order_id):
    user_id = int(get_jwt_identity())
    order = Order.query.get_or_404(order_id)

    user = User.query.get(user_id)
    if order.user_id != user_id and not user.is_admin:
        return jsonify({'error': 'Acesso negado'}), 403

    return jsonify(order.to_dict()), 200