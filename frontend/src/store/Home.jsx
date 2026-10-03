import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';

function formatPrice(value) {
  return 'R$ ' + Number(value).toFixed(2).replace('.', ',');
}

function totalStock(product) {
  if (product.variations.length > 0) {
    return product.variations.reduce((sum, item) => sum + item.stock, 0);
  }
  return product.stock ?? 0;
}

export default function Home() {
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const [params] = useSearchParams();
  const category = params.get('categoria') || '';
  const search = params.get('busca') || '';

  const loadPage = useCallback(async (pageToLoad, replace) => {
    const query = new URLSearchParams({ page: String(pageToLoad) });
    if (category) query.set('categoria', category);
    if (search) query.set('busca', search);

    const data = await api.get(`/products?${query}`);
    setProducts((current) => (replace ? data.produtos : [...current, ...data.produtos]));
    setPage(data.pagina);
    setTotalPages(data.total_paginas);
    setTotal(data.total);
  }, [category, search]);

  // troca de categoria ou busca recomeça da primeira página
  useEffect(() => {
    setLoading(true);
    setError('');
    loadPage(1, true)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [loadPage]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      await loadPage(page + 1, false);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingMore(false);
    }
  }

  const title = search ? `Resultados para "${search}"` : category || 'Novidades';

  return (
    <div className="page">
      <h2 className="section-title">{title}</h2>

      {loading && <p className="muted">Carregando...</p>}
      {error && <p className="muted">{error}</p>}
      {!loading && !error && products.length === 0 && (
        <p className="muted">Nenhum produto encontrado.</p>
      )}

      <div className="product-grid">
        {products.map((product) => {
          const stock = totalStock(product);
          return (
            <Link key={product.id} to={`/produto/${product.id}`} className="card">
              <div className="card__photo">
                {product.image_url && <img src={product.image_url} alt={product.name} />}
                {stock === 0 && <span className="card__tag">Esgotado</span>}
                {stock > 0 && stock <= 3 && <span className="card__tag">Últimas peças</span>}
              </div>
              <p className="card__name">{product.name}</p>
              <strong className="card__price">{formatPrice(product.price)}</strong>
              <span className="card__button">Ver produto</span>
            </Link>
          );
        })}
      </div>

      {!loading && page < totalPages && (
        <div className="load-more">
          <button onClick={loadMore} disabled={loadingMore} className="load-more__button">
            {loadingMore ? 'Carregando...' : 'Ver mais peças'}
          </button>
          <p className="muted">Mostrando {products.length} de {total}</p>
        </div>
      )}
    </div>
  );
}