from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Cart, CartItem, Product, ProductVariation

cart_bp = Blueprint('cart', __name__)


def get_or_create_cart(user_id):
    cart = Cart.query.filter_by(user_id=user_id).first()
    if not cart:
        cart = Cart(user_id=user_id)
        db.session.add(cart)
        db.session.commit()
    return cart


def available_stock(product, variation):
    if variation:
        return variation.stock
    return product.stock if product.stock is not None else 0


@cart_bp.route('', methods=['GET'])
@jwt_required()
def get_cart():
    user_id = int(get_jwt_identity())
    cart = get_or_create_cart(user_id)
    return jsonify(cart.to_dict()), 200


@cart_bp.route('/items', methods=['POST'])
@jwt_required()
def add_item():
    user_id = int(get_jwt_identity())
    data = request.get_json()

    product_id = data.get('product_id')
    variation_id = data.get('variation_id')
    quantity = data.get('quantity', 1)

    product = Product.query.get(product_id)
    if not product or not product.active:
        return jsonify({'error': 'Produto não encontrado'}), 404

    variation = None
    if variation_id:
        variation = ProductVariation.query.get(variation_id)
        if not variation or variation.product_id != product.id:
            return jsonify({'error': 'Variação inválida'}), 400

    if quantity < 1:
        return jsonify({'error': 'Quantidade inválida'}), 400

    if available_stock(product, variation) < quantity:
        return jsonify({'error': 'Estoque insuficiente'}), 409

    cart = get_or_create_cart(user_id)

    existing = next((i for i in cart.items
                      if i.product_id == product_id and i.variation_id == variation_id), None)
    if existing:
        existing.quantity += quantity
    else:
        cart.items.append(CartItem(product_id=product_id, variation_id=variation_id, quantity=quantity))

    db.session.commit()
    return jsonify(cart.to_dict()), 201


@cart_bp.route('/items/<int:item_id>', methods=['PUT'])
@jwt_required()
def update_item(item_id):
    user_id = int(get_jwt_identity())
    cart = get_or_create_cart(user_id)
    item = next((i for i in cart.items if i.id == item_id), None)
    if not item:
        return jsonify({'error': 'Item não encontrado no seu carrinho'}), 404

    quantity = request.get_json().get('quantity')
    if quantity is None or quantity < 1:
        return jsonify({'error': 'Quantidade inválida'}), 400

    if available_stock(item.product, item.variation) < quantity:
        return jsonify({'error': 'Estoque insuficiente'}), 409

    item.quantity = quantity
    db.session.commit()
    return jsonify(cart.to_dict()), 200


@cart_bp.route('/items/<int:item_id>', methods=['DELETE'])
@jwt_required()
def remove_item(item_id):
    user_id = int(get_jwt_identity())
    cart = get_or_create_cart(user_id)
    item = next((i for i in cart.items if i.id == item_id), None)
    if not item:
        return jsonify({'error': 'Item não encontrado no seu carrinho'}), 404

    db.session.delete(item)
    db.session.commit()
    return jsonify(cart.to_dict()), 200