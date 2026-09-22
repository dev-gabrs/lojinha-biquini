from functools import wraps

from flask import jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import User


def admin_required(fn):
    """Só deixa passar se o usuário logado for admin."""
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user = User.query.get(int(get_jwt_identity()))
        if not user or not user.is_admin:
            return jsonify({'error': 'Acesso negado'}), 403
        return fn(*args, **kwargs)
    return wrapper