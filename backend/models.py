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