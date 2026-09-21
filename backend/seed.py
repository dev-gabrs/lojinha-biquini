from getpass import getpass
from app import app
from models import db, User, Product

with app.app_context():
    email = input('E-mail do admin: ').strip().lower()

    if User.query.filter_by(email=email).first():
        print('Esse e-mail já está cadastrado, pulando.')
    else:
        nome = input('Nome: ').strip()
        senha = getpass('Senha (não aparece enquanto digita): ')
        if len(senha) < 8:
            print('A senha precisa ter pelo menos 8 caracteres.')
            raise SystemExit

        admin = User(name=nome, email=email, is_admin=True)
        admin.set_password(senha)
        db.session.add(admin)

    if not Product.query.filter_by(name='Produto de Teste').first():
        db.session.add(Product(
            name='Produto de Teste',
            price=10.00,
            stock=999,
            category='teste'
        ))

    db.session.commit()
    print('Pronto! Admin e produto de teste criados.')