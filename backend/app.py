import os
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
from models import db, bcrypt
from routes.auth import auth_bp
from routes.products import products_bp
from routes.cart import cart_bp
from routes.orders import orders_bp
from routes.payments import payments_bp
from routes.addresses import addresses_bp
from routes.admin import admin_bp

load_dotenv()

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///loja.db'
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY')

db.init_app(app)
bcrypt.init_app(app)
JWTManager(app)
CORS(app, origins=[os.getenv('FRONTEND_URL', 'http://localhost:5173')])

app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(products_bp, url_prefix='/api/products')
app.register_blueprint(cart_bp, url_prefix='/api/cart')
app.register_blueprint(orders_bp, url_prefix='/api/orders')
app.register_blueprint(payments_bp, url_prefix='/api/payments')
app.register_blueprint(addresses_bp, url_prefix='/api/addresses')
app.register_blueprint(admin_bp, url_prefix='/api/admin')

with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True)