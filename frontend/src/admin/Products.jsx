import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import ImageUpload from './ImageUpload';

function formatPrice(value) {
  return 'R$ ' + Number(value).toFixed(2).replace('.', ',');
}

const EMPTY_PRODUCT = {
  name: '',
  description: '',
  price: '',
  category: '',
  imageUrl: '',
  stock: '',
  variations: []
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [hasVariations, setHasVariations] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const navigate = useNavigate();

  const [adminSearch, setAdminSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const loadProducts = useCallback(async (pageToLoad = 1, replace = true) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ all: '1', page: String(pageToLoad), per_page: '40' });
      if (adminSearch.trim()) query.set('busca', adminSearch.trim());

      const data = await api.get(`/products?${query}`);
      setProducts((current) => (replace ? data.produtos : [...current, ...data.produtos]));
      setPage(data.pagina);
      setTotalPages(data.total_paginas);
      setTotal(data.total);
    } catch (e) {
      if (e.status === 401) return navigate('/entrar');
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [adminSearch, navigate]);

  useEffect(() => { loadProducts(1, true); }, [loadProducts]);

  function updateField(field, value) {
    setForm({ ...form, [field]: value });
  }

  function addVariation() {
    setForm({
      ...form,
      variations: [...form.variations, { size: '', color: '', stock: '' }]
    });
  }

  function updateVariation(index, field, value) {
    const next = form.variations.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    setForm({ ...form, variations: next });
  }

  function removeVariation(index) {
    setForm({ ...form, variations: form.variations.filter((_, i) => i !== index) });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');

    // brasileiro digita "89,90", o backend espera 89.90
    const price = Number(String(form.price).replace(',', '.'));
    if (!form.name.trim() || !price || price <= 0) {
      setError('Preencha o nome e um preço válido.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price,
      category: form.category.trim(),
      image_url: form.imageUrl.trim()
    };

    if (hasVariations) {
      const variations = form.variations
        .filter((item) => item.size.trim() || item.color.trim())
        .map((item) => ({
          size: item.size.trim(),
          color: item.color.trim(),
          stock: Number(item.stock) || 0
        }));

      if (variations.length === 0) {
        setError('Adicione pelo menos uma variação, ou desmarque a opção.');
        return;
      }
      payload.variations = variations;
    } else {
      payload.stock = Number(form.stock) || 0;
    }

    setSaving(true);
    try {
      await api.post('/products', payload);
      setForm(EMPTY_PRODUCT);
      setHasVariations(false);
      setNotice('Produto cadastrado.');
      await loadProducts();
    } catch (e) {
      if (e.status === 401) return navigate('/admin/login');
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // sem variações o estoque fica no produto; com variações, soma o de cada uma
  function totalStock(product) {
    if (product.variations.length > 0) {
      return product.variations.reduce((sum, item) => sum + item.stock, 0);
    }
    return product.stock ?? 0;
  }

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>Novo produto</h2>

      <form onSubmit={handleSubmit} style={styles.card}>
        <label style={styles.label}>Nome</label>
        <input
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
          style={styles.input}
        />

        <label style={styles.label}>Descrição</label>
        <textarea
          value={form.description}
          onChange={(e) => updateField('description', e.target.value)}
          rows={3}
          style={{ ...styles.input, resize: 'vertical' }}
        />

        <div style={styles.row}>
          <div style={styles.half}>
            <label style={styles.label}>Preço</label>
            <input
              value={form.price}
              onChange={(e) => updateField('price', e.target.value)}
              placeholder="89,90"
              style={styles.input}
            />
          </div>
          <div style={styles.half}>
            <label style={styles.label}>Categoria</label>
            <input
              value={form.category}
              onChange={(e) => updateField('category', e.target.value)}
              placeholder="biquíni"
              style={styles.input}
            />
          </div>
        </div>

        <label style={styles.label}>Foto</label>
        <ImageUpload
          value={form.imageUrl}
          onChange={(url) => updateField('imageUrl', url)}
        />

        <label style={styles.checkbox}>
          <input
            type="checkbox"
            checked={hasVariations}
            onChange={(e) => setHasVariations(e.target.checked)}
          />
          Tem tamanhos ou cores diferentes
        </label>

        {!hasVariations && (
          <>
            <label style={styles.label}>Quantidade em estoque</label>
            <input
              type="number"
              min="0"
              value={form.stock}
              onChange={(e) => updateField('stock', e.target.value)}
              style={styles.input}
            />
          </>
        )}

        {hasVariations && (
          <div style={styles.variations}>
            {form.variations.map((item, index) => (
              <div key={index} style={styles.variationRow}>
                <input
                  value={item.size}
                  onChange={(e) => updateVariation(index, 'size', e.target.value)}
                  placeholder="Tamanho"
                  style={{ ...styles.input, marginBottom: 0 }}
                />
                <input
                  value={item.color}
                  onChange={(e) => updateVariation(index, 'color', e.target.value)}
                  placeholder="Cor"
                  style={{ ...styles.input, marginBottom: 0 }}
                />
                <input
                  type="number"
                  min="0"
                  value={item.stock}
                  onChange={(e) => updateVariation(index, 'stock', e.target.value)}
                  placeholder="Qtd"
                  style={{ ...styles.input, marginBottom: 0, width: 80 }}
                />
                <button type="button" onClick={() => removeVariation(index)} style={styles.removeButton}>
                  ✕
                </button>
              </div>
            ))}
            <button type="button" onClick={addVariation} style={styles.addButton}>
              + Adicionar variação
            </button>
          </div>
        )}

        {error && <p style={styles.error}>{error}</p>}
        {notice && <p style={styles.success}>{notice}</p>}

        <button type="submit" disabled={saving} style={styles.submitButton}>
          {saving ? 'Salvando...' : 'Cadastrar produto'}
        </button>
      </form>

      <h2 style={{ ...styles.heading, marginTop: 40 }}>
        Produtos cadastrados {total > 0 && `(${total})`}
      </h2>

      <input
        value={adminSearch}
        onChange={(e) => setAdminSearch(e.target.value)}
        placeholder="Buscar por nome"
        style={{ ...styles.input, marginBottom: 14, width: '100%' }}
      />

      {loading && <p style={styles.muted}>Carregando...</p>}
      {!loading && products.length === 0 && <p style={styles.muted}>Nenhum produto encontrado.</p>}

      {products.map((product) => (
        <ProductRow key={product.id} product={product} onChange={loadProducts} />
      ))}

      {!loading && page < totalPages && (
        <button onClick={() => loadProducts(page + 1, false)} style={styles.addButton}>
          Carregar mais
        </button>
      )}
    </div>
  );
}

function ProductRow({ product, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [removedIds, setRemovedIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState('');
  const navigate = useNavigate();

  const totalStock = product.variations.length > 0
    ? product.variations.reduce((sum, item) => sum + item.stock, 0)
    : product.stock ?? 0;

  function startEditing() {
    setDraft({
      name: product.name,
      description: product.description || '',
      price: String(product.price).replace('.', ','),
      category: product.category || '',
      imageUrl: product.image_url || '',
      stock: product.stock ?? '',
      variations: product.variations.map((item) => ({
        id: item.id,
        size: item.size || '',
        color: item.color || '',
        stock: String(item.stock)
      }))
    });
    setRemovedIds([]);
    setRowError('');
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setDraft(null);
    setRemovedIds([]);
    setRowError('');
  }

  function updateDraft(field, value) {
    setDraft({ ...draft, [field]: value });
  }

  function updateVariation(index, field, value) {
    const next = draft.variations.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    setDraft({ ...draft, variations: next });
  }

  function addVariation() {
    setDraft({
      ...draft,
      variations: [...draft.variations, { id: null, size: '', color: '', stock: '' }]
    });
  }

  function removeVariation(index) {
    const item = draft.variations[index];
    // só precisa avisar o servidor se a variação já existia lá
    if (item.id) setRemovedIds([...removedIds, item.id]);
    setDraft({ ...draft, variations: draft.variations.filter((_, i) => i !== index) });
  }

  async function save() {
    setRowError('');

    const price = Number(String(draft.price).replace(',', '.'));
    if (!draft.name.trim() || !price || price <= 0) {
      setRowError('Nome e preço são obrigatórios.');
      return;
    }

    const invalid = draft.variations.some((item) => !item.size.trim() && !item.color.trim());
    if (invalid) {
      setRowError('Cada variação precisa de tamanho ou cor.');
      return;
    }

    setBusy(true);
    try {
      // 1. remove o que saiu
      for (const id of removedIds) {
        await api.del(`/products/${product.id}/variations/${id}`);
      }

      // 2. atualiza as que ficaram e cria as novas
      for (const item of draft.variations) {
        const body = {
          size: item.size.trim(),
          color: item.color.trim(),
          stock: Number(item.stock) || 0
        };
        if (item.id) {
          await api.patch(`/products/${product.id}/variations/${item.id}`, body);
        } else {
          await api.post(`/products/${product.id}/variations`, body);
        }
      }

      // 3. por último o produto, que define o estoque quando não há variações
      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        price,
        category: draft.category.trim(),
        image_url: draft.imageUrl.trim()
      };
      if (draft.variations.length === 0) {
        payload.stock = Number(draft.stock) || 0;
      }
      await api.put(`/products/${product.id}`, payload);

      cancelEditing();
      await onChange();
    } catch (e) {
      if (e.status === 401) return navigate('/admin/login');
      setRowError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive() {
    setBusy(true);
    setRowError('');
    try {
      await api.put(`/products/${product.id}`, { active: !product.active });
      await onChange();
    } catch (e) {
      if (e.status === 401) return navigate('/admin/login');
      setRowError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div style={styles.editCard}>
        <label style={styles.label}>Nome</label>
        <input
          value={draft.name}
          onChange={(e) => updateDraft('name', e.target.value)}
          style={styles.input}
        />

        <label style={styles.label}>Descrição</label>
        <textarea
          value={draft.description}
          onChange={(e) => updateDraft('description', e.target.value)}
          rows={3}
          style={{ ...styles.input, resize: 'vertical' }}
        />

        <div style={styles.row}>
          <div style={styles.half}>
            <label style={styles.label}>Preço</label>
            <input
              value={draft.price}
              onChange={(e) => updateDraft('price', e.target.value)}
              style={styles.input}
            />
          </div>
          <div style={styles.half}>
            <label style={styles.label}>Categoria</label>
            <input
              value={draft.category}
              onChange={(e) => updateDraft('category', e.target.value)}
              style={styles.input}
            />
          </div>
        </div>

        <label style={styles.label}>Foto</label>
        <ImageUpload
          value={draft.imageUrl}
          onChange={(url) => updateDraft('imageUrl', url)}
        />

        {draft.variations.length === 0 && (
          <>
            <label style={styles.label}>Quantidade em estoque</label>
            <input
              type="number"
              min="0"
              value={draft.stock}
              onChange={(e) => updateDraft('stock', e.target.value)}
              style={styles.input}
            />
          </>
        )}

        <label style={styles.label}>Tamanhos e cores</label>
        <div style={styles.variations}>
          {draft.variations.map((item, index) => (
            <div key={item.id ?? `novo-${index}`} style={styles.variationRow}>
              <input
                value={item.size}
                onChange={(e) => updateVariation(index, 'size', e.target.value)}
                placeholder="Tamanho"
                style={{ ...styles.input, marginBottom: 0 }}
              />
              <input
                value={item.color}
                onChange={(e) => updateVariation(index, 'color', e.target.value)}
                placeholder="Cor"
                style={{ ...styles.input, marginBottom: 0 }}
              />
              <input
                type="number"
                min="0"
                value={item.stock}
                onChange={(e) => updateVariation(index, 'stock', e.target.value)}
                placeholder="Qtd"
                style={{ ...styles.input, marginBottom: 0, width: 80 }}
              />
              <button type="button" onClick={() => removeVariation(index)} style={styles.removeButton}>
                ✕
              </button>
            </div>
          ))}
          <button type="button" onClick={addVariation} style={styles.addButton}>
            + Adicionar variação
          </button>
        </div>

        {removedIds.length > 0 && (
          <p style={styles.warning}>
            Variações removidas saem também dos carrinhos abertos das clientes.
          </p>
        )}

        {rowError && <p style={styles.error}>{rowError}</p>}

        <div style={styles.actions}>
          <button onClick={save} disabled={busy} style={styles.saveButton}>
            {busy ? 'Salvando...' : 'Salvar'}
          </button>
          <button onClick={cancelEditing} disabled={busy} style={styles.cancelButton}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...styles.listItem, opacity: product.active ? 1 : 0.55 }}>
      <div style={styles.itemInfo}>
        {product.image_url && (
          <img src={product.image_url} alt="" style={styles.thumb} />
        )}
        <div>
          <strong>{product.name}</strong>
          {!product.active && <span style={styles.inactive}>fora da vitrine</span>}
          <div style={styles.itemDetail}>
            {formatPrice(product.price)}
            {product.category && ` · ${product.category}`}
            {product.variations.length > 0 && ` · ${product.variations.length} variações`}
          </div>
          {rowError && <p style={styles.error}>{rowError}</p>}
        </div>
      </div>

      <div style={styles.rowActions}>
        <span style={{ ...styles.stock, color: totalStock <= 3 ? 'var(--coral)' : 'var(--cinza)' }}>
          {totalStock} em estoque
        </span>
        <button onClick={startEditing} style={styles.smallButton}>Editar</button>
        <button onClick={toggleActive} disabled={busy} style={styles.smallButton}>
          {product.active ? 'Tirar da vitrine' : 'Voltar à vitrine'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  page: { maxWidth: 680, margin: '0 auto', padding: '28px 20px 60px' },
  heading: { fontSize: 15, marginBottom: 16 },
  card: {
    background: '#fff',
    border: '1px solid var(--borda)',
    borderRadius: 12,
    padding: 20,
    display: 'flex',
    flexDirection: 'column'
  },
  label: { fontSize: 13, color: 'var(--cinza)', marginBottom: 6 },
  input: {
    fontFamily: 'var(--corpo)',
    fontSize: 14,
    padding: '10px 12px',
    border: '1px solid var(--borda)',
    borderRadius: 8,
    marginBottom: 16,
    background: 'var(--fundo)'
  },
  row: { display: 'flex', gap: 14 },
  half: { flex: 1, display: 'flex', flexDirection: 'column' },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
    margin: '4px 0 18px'
  },
  variations: { marginBottom: 16 },
  variationRow: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 },
  removeButton: {
    background: 'none',
    border: '1px solid var(--borda)',
    borderRadius: 8,
    padding: '9px 11px',
    color: 'var(--cinza)'
  },
  addButton: {
    background: 'none',
    border: '1px dashed var(--borda)',
    borderRadius: 8,
    padding: '10px',
    width: '100%',
    fontSize: 13,
    color: 'var(--lilas-escuro)'
  },
  submitButton: {
    background: 'var(--lilas-escuro)',
    color: '#fff',
    border: 'none',
    borderRadius: 9,
    padding: '13px',
    fontSize: 13,
    letterSpacing: '0.12em',
    textTransform: 'uppercase'
  },
  error: {
    background: '#FFF0EC',
    color: '#B8341A',
    fontSize: 13,
    padding: '10px 12px',
    borderRadius: 8
  },
  success: {
    background: '#EAF7EF',
    color: '#1E7A43',
    fontSize: 13,
    padding: '10px 12px',
    borderRadius: 8
  },
  muted: { color: 'var(--cinza)', fontSize: 14 },
  listItem: {
    background: '#fff',
    border: '1px solid var(--borda)',
    borderRadius: 10,
    padding: '14px 16px',
    marginBottom: 10,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12
  },
  itemDetail: { fontSize: 13, color: 'var(--cinza)', marginTop: 3 },
  stock: { fontSize: 13, whiteSpace: 'nowrap' },

  actions: { display: 'flex', gap: 8, marginTop: 14 },
  saveButton: {
    background: 'var(--lilas-escuro)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 18px',
    fontSize: 12,
    letterSpacing: '0.1em',
    textTransform: 'uppercase'
  },
  cancelButton: {
    background: 'none',
    border: '1px solid var(--borda)',
    borderRadius: 8,
    padding: '10px 18px',
    fontSize: 12,
    color: 'var(--cinza)'
  },
  rowActions: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  smallButton: {
    background: 'none',
    border: '1px solid var(--borda)',
    borderRadius: 8,
    padding: '7px 12px',
    fontSize: 12,
    color: 'var(--cinza)',
    whiteSpace: 'nowrap'
  },
  variationLabel: { fontSize: 13, color: 'var(--cinza)', minWidth: 90 },
  inactive: {
    fontSize: 11,
    color: 'var(--coral)',
    marginLeft: 8,
    border: '1px solid var(--coral)',
    borderRadius: 20,
    padding: '2px 8px'
  },
    editCard: {
    background: '#fff',
    border: '1px solid var(--lilas-escuro)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 10,
    display: 'flex',
    flexDirection: 'column'
  },
  itemInfo: { display: 'flex', alignItems: 'center', gap: 12 },
  thumb: {
    width: 44,
    height: 54,
    objectFit: 'cover',
    borderRadius: 6,
    border: '1px solid var(--borda)'
  },
  warning: {
    background: '#FFF7E8',
    color: '#8A6100',
    fontSize: 13,
    padding: '10px 12px',
    borderRadius: 8
  }
};