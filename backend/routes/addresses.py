from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Address

addresses_bp = Blueprint('addresses', __name__)

LIMITE_ENDERECOS = 10
CAMPOS_OBRIGATORIOS = ('rua', 'numero', 'bairro')


def limpar(valor, tamanho):
    """Tira espaços sobrando e corta textos grandes demais."""
    if valor is None:
        return None
    valor = str(valor).strip()
    return valor[:tamanho] if valor else None


def buscar_endereco_do_usuario(address_id, user_id):
    endereco = Address.query.get(address_id)
    if not endereco or endereco.user_id != user_id:
        return None
    return endereco


def tornar_principal(endereco, user_id):
    """Desmarca os outros e deixa só esse como principal."""
    Address.query.filter_by(user_id=user_id).update({'principal': False})
    endereco.principal = True


@addresses_bp.route('', methods=['GET'])
@jwt_required()
def listar():
    user_id = int(get_jwt_identity())
    enderecos = Address.query.filter_by(user_id=user_id) \
        .order_by(Address.principal.desc(), Address.id).all()
    return jsonify([e.to_dict() for e in enderecos]), 200


@addresses_bp.route('', methods=['POST'])
@jwt_required()
def criar():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    for campo in CAMPOS_OBRIGATORIOS:
        if not limpar(data.get(campo), 150):
            return jsonify({'error': f'O campo {campo} é obrigatório'}), 400

    quantidade = Address.query.filter_by(user_id=user_id).count()
    if quantidade >= LIMITE_ENDERECOS:
        return jsonify({'error': f'Limite de {LIMITE_ENDERECOS} endereços atingido'}), 400

    endereco = Address(
        user_id=user_id,
        apelido=limpar(data.get('apelido'), 40),
        rua=limpar(data.get('rua'), 150),
        numero=limpar(data.get('numero'), 20),
        complemento=limpar(data.get('complemento'), 100),
        bairro=limpar(data.get('bairro'), 100),
        cidade=limpar(data.get('cidade'), 100) or 'Passo Fundo',
        cep=limpar(data.get('cep'), 10),
        referencia=limpar(data.get('referencia'), 200)
    )
    db.session.add(endereco)

    # o primeiro endereço vira principal automaticamente
    if quantidade == 0 or data.get('principal'):
        db.session.flush()
        tornar_principal(endereco, user_id)

    db.session.commit()
    return jsonify(endereco.to_dict()), 201


@addresses_bp.route('/<int:address_id>', methods=['PUT'])
@jwt_required()
def editar(address_id):
    user_id = int(get_jwt_identity())
    endereco = buscar_endereco_do_usuario(address_id, user_id)
    if not endereco:
        return jsonify({'error': 'Endereço não encontrado'}), 404

    data = request.get_json() or {}

    tamanhos = {'apelido': 40, 'rua': 150, 'numero': 20, 'complemento': 100,
                'bairro': 100, 'cidade': 100, 'cep': 10, 'referencia': 200}

    for campo, tamanho in tamanhos.items():
        if campo in data:
            novo_valor = limpar(data.get(campo), tamanho)
            if campo in CAMPOS_OBRIGATORIOS and not novo_valor:
                return jsonify({'error': f'O campo {campo} não pode ficar vazio'}), 400
            setattr(endereco, campo, novo_valor)

    if data.get('principal'):
        tornar_principal(endereco, user_id)

    db.session.commit()
    return jsonify(endereco.to_dict()), 200


@addresses_bp.route('/<int:address_id>', methods=['DELETE'])
@jwt_required()
def apagar(address_id):
    user_id = int(get_jwt_identity())
    endereco = buscar_endereco_do_usuario(address_id, user_id)
    if not endereco:
        return jsonify({'error': 'Endereço não encontrado'}), 404

    era_principal = endereco.principal
    db.session.delete(endereco)
    db.session.flush()

    # se apagou o principal, o próximo da lista assume
    if era_principal:
        proximo = Address.query.filter_by(user_id=user_id).first()
        if proximo:
            proximo.principal = True

    db.session.commit()
    return jsonify({'message': 'Endereço removido'}), 200