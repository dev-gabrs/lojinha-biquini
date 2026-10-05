import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useCart } from './CartContext';

function formatPrice(value) {
  return 'R$ ' + Number(value).toFixed(2).replace('.', ',');
}

function variationLabel(variation) {
  return [variation.size, variation.color].filter(Boolean).join(' / ');
}

export default function ProductPage() {
  const { id } = useParams();
  const { addItem } = useCart();

  const [product, setProduct] = useState(null);
  const [selected, setSelected] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError('');
    setSelected(null);
    setQuantity(1);
    setAdded(false);

    api.get(`/products/${id}`)
      .then((data) => {
        setProduct(data);
        // uma variação só não precisa de escolha
        if (data.variations.length === 1) setSelected(data.variations[0]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page"><p className="muted">Carregando...</p></div>;
  if (!product) return <div className="page"><p className="muted">{error || 'Produto não encontrado.'}</p></div>;

  const hasVariations = product.variations.length > 0;
  const totalStock = hasVariations
    ? product.variations.reduce((sum, item) => sum + item.stock, 0)
    : product.stock ?? 0;

  // com variações, o estoque só é conhecido depois da escolha
  const available = hasVariations ? (selected ? selected.stock : null) : totalStock;
  const price = selected?.price ?? product.price;
  const soldOut = totalStock === 0;

  function chooseVariation(variation) {
    setSelected(variation);
    setQuantity(1);
    setAdded(false);
    setError('');
  }

  function changeQuantity(delta) {
    setAdded(false);
    setQuantity((current) => {
      const next = current + delta;
      if (next < 1) return 1;
      if (available !== null && next > available) return current;
      return next;
    });
  }

  async function handleAdd() {
    setError('');

    if (hasVariations && !selected) {
      setError('Escolha uma opção antes de adicionar.');
      return;
    }

    setAdding(true);
    try {
      await addItem({
        productId: product.id,
        variationId: selected ? selected.id : null,
        quantity
      });
      setAdded(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="page">
      <Link to="/" className="back-link">← Voltar para a loja</Link>

      <div className="product">
        <div className="product__photo">
          {product.image_url && <img src={product.image_url} alt={product.name} />}
        </div>

        <div>
          <h2 className="product__name">{product.name}</h2>
          <strong className="product__price">{formatPrice(price)}</strong>

          {product.description && (
            <p className="product__description">{product.description}</p>
          )}

          {hasVariations && (
            <>
              <p className="field-label">Escolha sua opção</p>
              <div className="variations">
                {product.variations.map((variation) => (
                  <button
                    key={variation.id}
                    className={selected?.id === variation.id ? 'variation is-selected' : 'variation'}
                    onClick={() => chooseVariation(variation)}
                    disabled={variation.stock === 0}
                    title={variation.stock === 0 ? 'Esgotado' : undefined}
                  >
                    {variationLabel(variation) || 'Única'}
                  </button>
                ))}
              </div>
            </>
          )}

          {!soldOut && (
            <>
              <p className="field-label">Quantidade</p>
              <div className="quantity">
                <button onClick={() => changeQuantity(-1)} aria-label="Diminuir">−</button>
                <span>{quantity}</span>
                <button
                  onClick={() => changeQuantity(1)}
                  aria-label="Aumentar"
                  disabled={available !== null && quantity >= available}
                >
                  +
                </button>
              </div>
            </>
          )}

          <button
            className="add-button"
            onClick={handleAdd}
            disabled={adding || soldOut}
          >
            {soldOut ? 'Esgotado' : adding ? 'Adicionando...' : 'Adicionar à sacola'}
          </button>

          {available !== null && available > 0 && available <= 3 && (
            <p className="stock-note">Últimas {available} unidades.</p>
          )}

          {error && <p className="alert">{error}</p>}

          {added && (
            <div className="notice">
              <span>Adicionado à sacola.</span>
              <Link to="/carrinho">Ver sacola</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}