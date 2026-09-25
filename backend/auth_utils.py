from functools import wraps

from flask import jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import User
from datetime import datetime, timedelta, timezone
from models import db, LoginAttempt


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

MAX_ATTEMPTS = 5
BLOCK_MINUTES = 15


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def is_blocked(email):
    """Diz se a conta está travada por tentativas demais."""
    limite = utc_now() - timedelta(minutes=BLOCK_MINUTES)
    tentativas = LoginAttempt.query.filter(
        LoginAttempt.email == email,
        LoginAttempt.created_at >= limite
    ).count()
    return tentativas >= MAX_ATTEMPTS


def register_failure(email):
    """Anota uma tentativa que deu errado."""
    db.session.add(LoginAttempt(email=email))
    db.session.commit()


def clear_attempts(email):
    """Login deu certo: limpa o histórico de erros."""
    LoginAttempt.query.filter_by(email=email).delete()
    db.session.commit()