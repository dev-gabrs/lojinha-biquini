from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from models import db, Product, ProductVariation, User, CartItem, OrderItem
import math
import unicodedata

products_bp = Blueprint('products', __name__)


def is_admin_user():
    user = User.query.get(int(get_jwt_identity()))
    return user is not None and user.is_admin

def is_admin_request():
    """Igual a is_admin_user, mas numa rota pública: não quebra se não houver token."""
    try:
        verify_jwt_in_request(optional=True)
    except Exception:
        return False

    identity = get_jwt_identity()
    if not identity:
        return False

    user = User.query.get(int(identity))
    return user is not None and user.is_admin

PER_PAGE_DEFAULT = 24
PER_PAGE_MAX = 60


def normalize(text):
    """Minúsculo e sem acento, para 'biquini' encontrar 'Biquíni'."""
    if not text:
        return ''
    decomposed = unicodedata.normalize('NFKD', text)
    return ''.join(c for c in decomposed if not unicodedata.combining(c)).lower()

# Pública — qualquer cliente vê os produtos
@products_bp.route('', methods=['GET'])
def list_products():
    query = Product.query

    # só admin autenticado vê o que está fora da vitrine
    if not (request.args.get('all') == '1' and is_admin_request()):
        query = query.filter_by(active=True)

    category = (request.args.get('categoria') or '').strip()
    if category:
        query = query.filter(Product.category == category)

    query = query.order_by(Product.id.desc())

    try:
        page = max(1, int(request.args.get('page', 1)))
        per_page = int(request.args.get('per_page', PER_PAGE_DEFAULT))
    except ValueError:
        return jsonify({'error': 'Paginação inválida'}), 400
    per_page = min(max(1, per_page), PER_PAGE_MAX)

    search = normalize(request.args.get('busca', ''))

    if search:
        # a busca ignora acento, então o filtro acontece em Python
        found = [p for p in query.all() if search in normalize(p.name)]
        total = len(found)
        start = (page - 1) * per_page
        items = found[start:start + per_page]
    else:
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        items = pagination.items
        total = pagination.total

    return jsonify({
        'produtos': [p.to_dict() for p in items],
        'pagina': page,
        'total_paginas': max(1, math.ceil(total / per_page)),
        'total': total
    }), 200
@products_bp.route('/categories', methods=['GET'])
def list_categories():
    rows = db.session.query(Product.category).filter(
        Product.active.is_(True),
        Product.category.isnot(None),
        Product.category != ''
    ).distinct().all()
    return jsonify(sorted(row[0] for row in rows)), 200

@products_bp.route('/<int:product_id>', methods=['GET'])
def get_product(product_id):
    product = Product.query.get_or_404(product_id)
    return jsonify(product.to_dict()), 200


# Protegidas — só admin cadastra/edita/remove
@products_bp.route('', methods=['POST'])
@jwt_required()
def create_product():
    if not is_admin_user():
        return jsonify({'error': 'Acesso negado'}), 403

    data = request.get_json()
    name = data.get('name', '').strip()
    price = data.get('price')

    if not name or price is None:
        return jsonify({'error': 'Nome e preço são obrigatórios'}), 400

    product = Product(
        name=name,
        description=data.get('description', ''),
        price=price,
        stock=data.get('stock'),
        category=data.get('category', ''),
        image_url=data.get('image_url', '')
    )

    for v in data.get('variations', []):
        product.variations.append(ProductVariation(
            size=v.get('size'),
            color=v.get('color'),
            stock=v.get('stock', 0),
            price=v.get('price')
        ))

    db.session.add(product)
    db.session.commit()
    return jsonify(product.to_dict()), 201


@products_bp.route('/<int:product_id>', methods=['PUT'])
@jwt_required()
def update_product(product_id):
    if not is_admin_user():
        return jsonify({'error': 'Acesso negado'}), 403

    product = Product.query.get_or_404(product_id)
    data = request.get_json()

    product.name = data.get('name', product.name)
    product.description = data.get('description', product.description)
    product.price = data.get('price', product.price)

    if 'stock' in data:
        stock = data.get('stock')
        if stock is not None and (not isinstance(stock, int) or isinstance(stock, bool) or stock < 0):
            return jsonify({'error': 'Estoque inválido'}), 400
        product.stock = stock

    product.category = data.get('category', product.category)
    product.image_url = data.get('image_url', product.image_url)
    product.active = data.get('active', product.active)

    db.session.commit()
    return jsonify(product.to_dict()), 200


@products_bp.route('/<int:product_id>', methods=['DELETE'])
@jwt_required()
def delete_product(product_id):
    if not is_admin_user():
        return jsonify({'error': 'Acesso negado'}), 403

    product = Product.query.get_or_404(product_id)
    db.session.delete(product)
    db.session.commit()
    return jsonify({'message': 'Produto removido'}), 200

@products_bp.route('/<int:product_id>/variations/<int:variation_id>', methods=['PATCH'])
@jwt_required()
def update_variation(product_id, variation_id):
    if not is_admin_user():
        return jsonify({'error': 'Acesso negado'}), 403

    variation = ProductVariation.query.get_or_404(variation_id)
    if variation.product_id != product_id:
        return jsonify({'error': 'Variação não pertence a este produto'}), 400

    data = request.get_json(silent=True) or {}

    if 'stock' in data:
        stock = data.get('stock')
        if not isinstance(stock, int) or isinstance(stock, bool) or stock < 0:
            return jsonify({'error': 'Estoque inválido'}), 400
        variation.stock = stock

    if 'size' in data:
        variation.size = (data.get('size') or '').strip() or None

    if 'color' in data:
        variation.color = (data.get('color') or '').strip() or None

    db.session.commit()
    return jsonify(variation.to_dict()), 200

@products_bp.route('/<int:product_id>/variations', methods=['POST'])
@jwt_required()
def create_variation(product_id):
    if not is_admin_user():
        return jsonify({'error': 'Acesso negado'}), 403

    product = Product.query.get_or_404(product_id)
    data = request.get_json(silent=True) or {}

    size = (data.get('size') or '').strip()
    color = (data.get('color') or '').strip()
    if not size and not color:
        return jsonify({'error': 'Informe ao menos tamanho ou cor'}), 400

    stock = data.get('stock', 0)
    if not isinstance(stock, int) or isinstance(stock, bool) or stock < 0:
        return jsonify({'error': 'Estoque inválido'}), 400

    # a partir da primeira variação, o estoque passa a ser controlado por ela
    if not product.variations:
        product.stock = None

    variation = ProductVariation(
        product_id=product.id,
        size=size or None,
        color=color or None,
        stock=stock
    )
    db.session.add(variation)
    db.session.commit()
    return jsonify(variation.to_dict()), 201


@products_bp.route('/<int:product_id>/variations/<int:variation_id>', methods=['DELETE'])
@jwt_required()
def delete_variation(product_id, variation_id):
    if not is_admin_user():
        return jsonify({'error': 'Acesso negado'}), 403

    variation = ProductVariation.query.get_or_404(variation_id)
    if variation.product_id != product_id:
        return jsonify({'error': 'Variação não pertence a este produto'}), 400

    # carrinhos em aberto perdem o item, já que a opção deixou de existir
    CartItem.query.filter_by(variation_id=variation.id).delete()

    # pedidos guardam tamanho, cor e preço próprios: só soltamos a referência
    OrderItem.query.filter_by(variation_id=variation.id).update({'variation_id': None})

    db.session.delete(variation)
    db.session.commit()
    return jsonify({'message': 'Variação removida'}), 200