import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

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

  async function loadProducts() {
    setLoading(true);
    try {
      setProducts(await api.get('/products?all=1'));
    } catch (e) {
      if (e.status === 401) return navigate('/admin/login');
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadProducts(); }, []);

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

        <label style={styles.label}>Link da foto</label>
        <input
          value={form.imageUrl}
          onChange={(e) => updateField('imageUrl', e.target.value)}
          placeholder="https://..."
          style={styles.input}
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

      <h2 style={{ ...styles.heading, marginTop: 40 }}>Produtos cadastrados</h2>

      {loading && <p style={styles.muted}>Carregando...</p>}
      {!loading && products.length === 0 && <p style={styles.muted}>Nenhum produto ainda.</p>}

      {products.map((product) => (
        <ProductRow key={product.id} product={product} onChange={loadProducts} />
      ))}
    </div>
  );
}

function ProductRow({ product, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    name: product.name,
    price: String(product.price).replace('.', ','),
    stock: product.stock ?? '',
    variations: product.variations.map((item) => ({ id: item.id, stock: item.stock }))
  });
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState('');

  const totalStock = product.variations.length > 0
    ? product.variations.reduce((sum, item) => sum + item.stock, 0)
    : product.stock ?? 0;

  async function save() {
    setRowError('');
    const price = Number(String(draft.price).replace(',', '.'));
    if (!draft.name.trim() || !price || price <= 0) {
      setRowError('Nome e preço são obrigatórios.');
      return;
    }

    setBusy(true);
    try {
      const payload = { name: draft.name.trim(), price };
      if (product.variations.length === 0) {
        payload.stock = Number(draft.stock) || 0;
      }
      await api.put(`/products/${product.id}`, payload);

      // cada variação tem sua própria rota
      for (const item of draft.variations) {
        const original = product.variations.find((v) => v.id === item.id);
        if (original && original.stock !== Number(item.stock)) {
          await api.patch(`/products/${product.id}/variations/${item.id}`, {
            stock: Number(item.stock) || 0
          });
        }
      }

      setEditing(false);
      await onChange();
    } catch (e) {
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
      setRowError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div style={styles.listItem}>
        <div style={{ flex: 1 }}>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            style={{ ...styles.input, marginBottom: 10, width: '100%' }}
          />

          <div style={styles.row}>
            <div style={styles.half}>
              <label style={styles.label}>Preço</label>
              <input
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                style={styles.input}
              />
            </div>

            {product.variations.length === 0 && (
              <div style={styles.half}>
                <label style={styles.label}>Estoque</label>
                <input
                  type="number"
                  min="0"
                  value={draft.stock}
                  onChange={(e) => setDraft({ ...draft, stock: e.target.value })}
                  style={styles.input}
                />
              </div>
            )}
          </div>

          {product.variations.map((item, index) => (
            <div key={item.id} style={styles.variationRow}>
              <span style={styles.variationLabel}>
                {[item.size, item.color].filter(Boolean).join(' / ') || 'Variação'}
              </span>
              <input
                type="number"
                min="0"
                value={draft.variations[index].stock}
                onChange={(e) => {
                  const next = draft.variations.map((v, i) =>
                    i === index ? { ...v, stock: e.target.value } : v
                  );
                  setDraft({ ...draft, variations: next });
                }}
                style={{ ...styles.input, marginBottom: 0, width: 90 }}
              />
            </div>
          ))}

          {rowError && <p style={styles.error}>{rowError}</p>}

          <div style={styles.actions}>
            <button onClick={save} disabled={busy} style={styles.saveButton}>
              {busy ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={() => setEditing(false)} style={styles.cancelButton}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...styles.listItem, opacity: product.active ? 1 : 0.55 }}>
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

      <div style={styles.rowActions}>
        <span style={{ ...styles.stock, color: totalStock <= 3 ? 'var(--coral)' : 'var(--cinza)' }}>
          {totalStock} em estoque
        </span>
        <button onClick={() => setEditing(true)} style={styles.smallButton}>Editar</button>
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
  }
};