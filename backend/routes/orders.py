import re
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Cart, Order, OrderItem, User, Address
from routes.addresses import limpar, CAMPOS_OBRIGATORIOS, LIMITE_ENDERECOS

orders_bp = Blueprint('orders', __name__)

TIPOS_ENTREGA = ('retirada', 'entrega')


def limpar_telefone(valor):
    """Deixa só os números. Aceita '(54) 99999-9999' ou '54999999999'."""
    if not valor:
        return None
    digitos = re.sub(r'\D', '', str(valor))
    if len(digitos) < 10 or len(digitos) > 13:
        return None
    return digitos


def resolver_endereco(data, user_id):
    """Descobre qual endereço usar. Devolve (endereco, erro)."""
    endereco_id = data.get('endereco_id')

    # opção 1: endereço salvo
    if endereco_id:
        salvo = Address.query.get(endereco_id)
        if not salvo or salvo.user_id != user_id:
            return None, 'Endereço não encontrado'
        return salvo.to_dict(), None

    # opção 2: endereço novo digitado na hora
    novo = data.get('endereco')
    if not isinstance(novo, dict):
        return None, 'Escolha um endereço salvo ou informe um novo'

    endereco = {
        'rua': limpar(novo.get('rua'), 150),
        'numero': limpar(novo.get('numero'), 20),
        'complemento': limpar(novo.get('complemento'), 100),
        'bairro': limpar(novo.get('bairro'), 100),
        'cidade': limpar(novo.get('cidade'), 100) or 'Passo Fundo',
        'cep': limpar(novo.get('cep'), 10),
        'referencia': limpar(novo.get('referencia'), 200)
    }

    for campo in CAMPOS_OBRIGATORIOS:
        if not endereco[campo]:
            return None, f'O campo {campo} do endereço é obrigatório'

    return endereco, None

@orders_bp.route('/checkout', methods=['POST'])
@jwt_required()
def checkout():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    # --- 1. valida os dados de entrega ANTES de mexer em qualquer coisa ---
    tipo = data.get('tipo_entrega')
    if tipo not in TIPOS_ENTREGA:
        return jsonify({'error': 'Escolha retirada ou entrega'}), 400

    telefone = limpar_telefone(data.get('telefone'))
    if not telefone:
        return jsonify({'error': 'Telefone inválido'}), 400

    endereco = None
    if tipo == 'entrega':
        endereco, erro = resolver_endereco(data, user_id)
        if erro:
            return jsonify({'error': erro}), 400

    # --- 2. confere o carrinho ---
    cart = Cart.query.filter_by(user_id=user_id).first()
    if not cart or not cart.items:
        return jsonify({'error': 'Carrinho vazio'}), 400

    # --- 3. confere estoque de TUDO antes de descontar ---
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

    # --- 4. cria o pedido ---
    order = Order(
        user_id=user_id,
        total=0,
        status='pendente',
        tipo_entrega=tipo,
        telefone=telefone
    )

    if endereco:
        order.entrega_rua = endereco['rua']
        order.entrega_numero = endereco['numero']
        order.entrega_complemento = endereco['complemento']
        order.entrega_bairro = endereco['bairro']
        order.entrega_cidade = endereco['cidade']
        order.entrega_cep = endereco['cep']
        order.entrega_referencia = endereco['referencia']

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

    # --- 5. salva o endereço novo no perfil, se a cliente pediu ---
    if endereco and not data.get('endereco_id') and data.get('salvar_endereco'):
        quantidade = Address.query.filter_by(user_id=user_id).count()
        if quantidade < LIMITE_ENDERECOS:
            db.session.add(Address(
                user_id=user_id,
                apelido=limpar(data['endereco'].get('apelido'), 40),
                rua=endereco['rua'],
                numero=endereco['numero'],
                complemento=endereco['complemento'],
                bairro=endereco['bairro'],
                cidade=endereco['cidade'],
                cep=endereco['cep'],
                referencia=endereco['referencia'],
                principal=(quantidade == 0)
            ))

    # --- 6. esvazia o carrinho ---
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