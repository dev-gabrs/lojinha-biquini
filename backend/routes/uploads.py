import os

import cloudinary
import cloudinary.uploader
from flask import Blueprint, request, jsonify

from auth_utils import admin_required

uploads_bp = Blueprint('uploads', __name__)

MAX_BYTES = 8 * 1024 * 1024
ALLOWED_MIME = ('image/jpeg', 'image/png', 'image/webp')


def configure_cloudinary():
    cloudinary.config(
        cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
        api_key=os.getenv('CLOUDINARY_API_KEY'),
        api_secret=os.getenv('CLOUDINARY_API_SECRET'),
        secure=True
    )


@uploads_bp.route('/image', methods=['POST'])
@admin_required
def upload_image():
    if not os.getenv('CLOUDINARY_CLOUD_NAME'):
        return jsonify({'error': 'Serviço de imagens não configurado'}), 503

    file = request.files.get('file')
    if not file or not file.filename:
        return jsonify({'error': 'Nenhum arquivo enviado'}), 400

    # não confiamos na extensão do nome: o navegador informa o tipo real
    if file.mimetype not in ALLOWED_MIME:
        return jsonify({'error': 'Envie uma imagem JPG, PNG ou WEBP'}), 400

    # mede o tamanho sem carregar o arquivo inteiro na memória
    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)

    if size > MAX_BYTES:
        return jsonify({'error': 'A imagem passa de 8 MB'}), 400

    configure_cloudinary()

    try:
        result = cloudinary.uploader.upload(
            file,
            folder='biquinis-pf/produtos',
            resource_type='image',
            # guarda no máximo 1600px de largura: acima disso é desperdício
            transformation=[{'width': 1600, 'crop': 'limit'}],
            # o Cloudinary decide o melhor formato e qualidade na entrega
            fetch_format='auto',
            quality='auto'
        )
    except Exception:
        return jsonify({'error': 'Não foi possível enviar a imagem'}), 502

    return jsonify({
        'url': result['secure_url'],
        'public_id': result['public_id']
    }), 201