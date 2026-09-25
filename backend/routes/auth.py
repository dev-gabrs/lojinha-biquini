from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token
from models import db, User
from auth_utils import is_blocked, register_failure, clear_attempts, BLOCK_MINUTES

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    name = data.get('name', '').strip()

    if not email or not password or len(password) < 8:
        return jsonify({'error': 'Dados inválidos'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'E-mail já cadastrado'}), 409

    user = User(name=name, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

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
    token = create_access_token(identity=str(user.id))
    return jsonify({'token': token, 'name': user.name}), 200