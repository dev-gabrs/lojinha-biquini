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

LIMITE_ITENS_JUNTAR = 50
QUANTIDADE_MAXIMA = 20


def quantidade_valida(valor):
    """Aceita só número inteiro maior que zero. Devolve None se for inválido."""
    if isinstance(valor, bool) or not isinstance(valor, int):
        return None
    if valor < 1:
        return None
    return valor

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
    data = request.get_json(silent=True) or {}

    product_id = data.get('product_id')
    variation_id = data.get('variation_id')

    if not isinstance(product_id, int):
        return jsonify({'error': 'Produto inválido'}), 400

    quantity = quantidade_valida(data.get('quantity', 1))
    if not quantity:
        return jsonify({'error': 'Quantidade inválida'}), 400

    product = Product.query.get(product_id)
    if not product or not product.active:
        return jsonify({'error': 'Produto não encontrado'}), 404

    variation = None
    if variation_id is not None:
        variation = ProductVariation.query.get(variation_id)
        if not variation or variation.product_id != product.id:
            return jsonify({'error': 'Variação inválida'}), 400

    cart = get_or_create_cart(user_id)

    id_da_variacao = variation.id if variation else None
    existing = next((i for i in cart.items
                     if i.product_id == product.id and i.variation_id == id_da_variacao), None)

    # soma com o que já está no carrinho antes de conferir
    total_desejado = (existing.quantity if existing else 0) + quantity

    if total_desejado > QUANTIDADE_MAXIMA:
        return jsonify({'error': f'Máximo de {QUANTIDADE_MAXIMA} unidades por item'}), 400

    if available_stock(product, variation) < total_desejado:
        return jsonify({'error': 'Estoque insuficiente'}), 409

    if existing:
        existing.quantity = total_desejado
    else:
        cart.items.append(CartItem(
            product_id=product.id,
            variation_id=id_da_variacao,
            quantity=quantity
        ))

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

    data = request.get_json(silent=True) or {}
    quantity = quantidade_valida(data.get('quantity'))
    if not quantity:
        return jsonify({'error': 'Quantidade inválida'}), 400

    if quantity > QUANTIDADE_MAXIMA:
        return jsonify({'error': f'Máximo de {QUANTIDADE_MAXIMA} unidades por item'}), 400

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

@cart_bp.route('/juntar', methods=['POST'])
@jwt_required()
def juntar_carrinho():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    itens = data.get('items')

    if not isinstance(itens, list):
        return jsonify({'error': 'Envie uma lista de itens'}), 400

    if len(itens) > LIMITE_ITENS_JUNTAR:
        return jsonify({'error': 'Itens demais no carrinho'}), 400

    cart = get_or_create_cart(user_id)
    avisos = []

    for entrada in itens:
        if not isinstance(entrada, dict):
            continue

        # --- o produto ainda existe e está à venda? ---
        product_id = entrada.get('product_id')
        if not isinstance(product_id, int):
            continue

        product = Product.query.get(product_id)
        if not product or not product.active:
            avisos.append('Um produto do seu carrinho não está mais disponível')
            continue

        # --- a variação (tamanho/cor) ainda existe e é desse produto? ---
        variation = None
        variation_id = entrada.get('variation_id')
        if variation_id is not None:
            variation = ProductVariation.query.get(variation_id)
            if not variation or variation.product_id != product.id:
                avisos.append(f'Uma opção de {product.name} não está mais disponível')
                continue

        quantidade = quantidade_valida(entrada.get('quantity'))
        if not quantidade:
            continue

        # --- junta com o que já tinha, respeitando estoque e limite ---
        id_da_variacao = variation.id if variation else None
        existente = next((i for i in cart.items
                          if i.product_id == product.id and i.variation_id == id_da_variacao), None)

        atual = existente.quantity if existente else 0
        estoque = available_stock(product, variation)
        desejado = atual + quantidade
        nova_quantidade = min(desejado, estoque, QUANTIDADE_MAXIMA)

        if estoque == 0:
            avisos.append(f'{product.name} esgotou')
            continue

        if nova_quantidade <= atual:
            continue

        if nova_quantidade < desejado:
            avisos.append(f'{product.name}: ajustamos a quantidade para {nova_quantidade}')

        if existente:
            existente.quantity = nova_quantidade
        else:
            cart.items.append(CartItem(
                product_id=product.id,
                variation_id=id_da_variacao,
                quantity=nova_quantidade
            ))

    db.session.commit()

    resposta = cart.to_dict()
    resposta['avisos'] = avisos
    return jsonify(resposta), 200