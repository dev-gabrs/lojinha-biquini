from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from models import db, User
from auth_utils import is_blocked, register_failure, clear_attempts, BLOCK_MINUTES

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    name = data.get('name', '').strip()
    
    if not name or len(name) < 2:
        return jsonify({'error': 'Informe seu nome'}), 400

    if not email or not password or len(password) < 8:
        return jsonify({'error': 'Dados inválidos'}), 400

    if not email or not password or len(password) < 8:
        return jsonify({'error': 'Dados inválidos'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'E-mail já cadastrado'}), 409

    user = User(name=name, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    # já entra logada depois de se cadastrar
    return jsonify({
        'access_token': create_access_token(identity=str(user.id)),
        'refresh_token': create_refresh_token(identity=str(user.id)),
        'user': {'id': user.id, 'name': user.name, 'is_admin': user.is_admin}
    }), 201

    return jsonify({'message': 'Cadastrado com sucesso'}), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'E-mail ou senha inválidos'}), 401

    if is_blocked(email):
        return jsonify({
            'error': f'Muitas tentativas. Tente de novo em {BLOCK_MINUTES} minutos.'
        }), 429

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        register_failure(email)
        return jsonify({'error': 'E-mail ou senha inválidos'}), 401

    clear_attempts(email)
    return jsonify({
        'access_token': create_access_token(identity=str(user.id)),
        'refresh_token': create_refresh_token(identity=str(user.id)),
        'user': {'id': user.id, 'name': user.name, 'is_admin': user.is_admin}
    }), 200

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Troca o token de renovação por um token de acesso novo."""
    user_id = get_jwt_identity()

    # se a conta sumiu desde o login, não renova
    user = User.query.get(int(user_id))
    if not user:
        return jsonify({'error': 'Conta não encontrada'}), 401

    return jsonify({'access_token': create_access_token(identity=user_id)}), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    """Diz quem está logado. Útil pra tela mostrar o nome e saber se é admin."""
    user = User.query.get(int(get_jwt_identity()))
    if not user:
        return jsonify({'error': 'Conta não encontrada'}), 401
    return jsonify({'id': user.id, 'name': user.name, 'is_admin': user.is_admin}), 200


@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Hoje o logout acontece no navegador. A rota existe para o dia
    em que quisermos invalidar o token do lado do servidor."""
    return jsonify({'message': 'Até logo'}), 200