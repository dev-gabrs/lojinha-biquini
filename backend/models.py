from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt

db = SQLAlchemy()
bcrypt = Bcrypt()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)


class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    stock = db.Column(db.Integer)  # só usado se o produto NÃO tiver variações
    category = db.Column(db.String(80))
    image_url = db.Column(db.String(300))
    active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    variations = db.relationship('ProductVariation', backref='product', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'price': float(self.price),
            'stock': self.stock,
            'category': self.category,
            'image_url': self.image_url,
            'active': self.active,
            'variations': [v.to_dict() for v in self.variations]
        }


class ProductVariation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    size = db.Column(db.String(20))    # ex: 'P', 'M', 'G' — pode deixar em branco
    color = db.Column(db.String(40))   # ex: 'Azul' — pode deixar em branco
    stock = db.Column(db.Integer, nullable=False, default=0)
    price = db.Column(db.Numeric(10, 2))  # se vazio, usa o preço do produto

    def to_dict(self):
        return {
            'id': self.id,
            'size': self.size,
            'color': self.color,
            'stock': self.stock,
            'price': float(self.price) if self.price is not None else None
        }

class Cart(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), unique=True, nullable=False)
    items = db.relationship('CartItem', backref='cart', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'items': [i.to_dict() for i in self.items],
            'total': round(sum(i.subtotal() for i in self.items), 2)
        }


class CartItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    cart_id = db.Column(db.Integer, db.ForeignKey('cart.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    variation_id = db.Column(db.Integer, db.ForeignKey('product_variation.id'), nullable=True)
    quantity = db.Column(db.Integer, nullable=False, default=1)

    product = db.relationship('Product')
    variation = db.relationship('ProductVariation')

    def unit_price(self):
        if self.variation and self.variation.price is not None:
            return float(self.variation.price)
        return float(self.product.price)

    def subtotal(self):
        return round(self.unit_price() * self.quantity, 2)

    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'product_name': self.product.name,
            'variation': self.variation.to_dict() if self.variation else None,
            'quantity': self.quantity,
            'unit_price': self.unit_price(),
            'subtotal': self.subtotal()
        }

class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    status = db.Column(db.String(30), nullable=False, default='pendente')
    total = db.Column(db.Numeric(10, 2), nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    tipo_entrega = db.Column(db.String(20), nullable=False, default='retirada')
    telefone = db.Column(db.String(20))

    # endereço copiado no momento da compra (não muda se a cliente editar depois)
    entrega_rua = db.Column(db.String(150))
    entrega_numero = db.Column(db.String(20))
    entrega_complemento = db.Column(db.String(100))
    entrega_bairro = db.Column(db.String(100))
    entrega_cidade = db.Column(db.String(100))
    entrega_cep = db.Column(db.String(10))
    entrega_referencia = db.Column(db.String(200))
    
    items = db.relationship('OrderItem', backref='order', cascade='all, delete-orphan')
    user = db.relationship('User')

    def to_dict(self):
        endereco = None
        if self.tipo_entrega == 'entrega':
            endereco = {
                'rua': self.entrega_rua,
                'numero': self.entrega_numero,
                'complemento': self.entrega_complemento,
                'bairro': self.entrega_bairro,
                'cidade': self.entrega_cidade,
                'cep': self.entrega_cep,
                'referencia': self.entrega_referencia
            }

        return {
            'id': self.id,
            'status': self.status,
            'total': float(self.total),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'tipo_entrega': self.tipo_entrega,
            'telefone': self.telefone,
            'endereco_entrega': endereco,
            'items': [i.to_dict() for i in self.items]
        }

    def to_admin_dict(self):
        dados = self.to_dict()
        dados['cliente'] = {
            'id': self.user.id,
            'nome': self.user.name,
            'email': self.user.email
        }
        return dados    


class OrderItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('order.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'))
    variation_id = db.Column(db.Integer, db.ForeignKey('product_variation.id'))

    # dados congelados no momento da compra
    product_name = db.Column(db.String(150), nullable=False)
    size = db.Column(db.String(20))
    color = db.Column(db.String(40))
    unit_price = db.Column(db.Numeric(10, 2), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)

    def subtotal(self):
        return round(float(self.unit_price) * self.quantity, 2)

    def to_dict(self):
        return {
            'id': self.id,
            'product_name': self.product_name,
            'size': self.size,
            'color': self.color,
            'unit_price': float(self.unit_price),
            'quantity': self.quantity,
            'subtotal': self.subtotal()
        }

#Modelo de pagamento

class Payment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('order.id'), nullable=False)
    mp_order_id = db.Column(db.String(80))       # id da cobrança no Mercado Pago
    checkout_url = db.Column(db.String(500))     # link pro cliente pagar
    status = db.Column(db.String(30), default='pendente')
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    order = db.relationship('Order', backref='payment')

    def to_dict(self):
        return {
            'id': self.id,
            'order_id': self.order_id,
            'status': self.status,
            'checkout_url': self.checkout_url
        }

# Modelo de endereços

class Address(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    apelido = db.Column(db.String(40))          # ex: 'Casa', 'Trabalho'
    rua = db.Column(db.String(150), nullable=False)
    numero = db.Column(db.String(20), nullable=False)
    complemento = db.Column(db.String(100))
    bairro = db.Column(db.String(100), nullable=False)
    cidade = db.Column(db.String(100), default='Passo Fundo')
    cep = db.Column(db.String(10))
    referencia = db.Column(db.String(200))      # ex: 'prédio azul, interfone 2'
    principal = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            'id': self.id,
            'apelido': self.apelido,
            'rua': self.rua,
            'numero': self.numero,
            'complemento': self.complemento,
            'bairro': self.bairro,
            'cidade': self.cidade,
            'cep': self.cep,
            'referencia': self.referencia,
            'principal': self.principal
        }