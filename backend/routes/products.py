from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Product, ProductVariation, User

products_bp = Blueprint('products', __name__)


def is_admin_user():
    user = User.query.get(int(get_jwt_identity()))
    return user is not None and user.is_admin


# Pública — qualquer cliente vê os produtos
@products_bp.route('', methods=['GET'])
def list_products():
    products = Product.query.filter_by(active=True).all()
    return jsonify([p.to_dict() for p in products]), 200


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
    product.stock = data.get('stock', product.stock)
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