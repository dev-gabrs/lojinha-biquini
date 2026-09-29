import { useRef, useState } from 'react';
import { api } from '../api';

export default function ImageUpload({ value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setUploading(true);

    try {
      const data = await api.upload('/uploads/image', file);
      onChange(data.url);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
      // limpa o campo para permitir escolher o mesmo arquivo de novo
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div style={styles.wrapper}>
      {value && (
        <div style={styles.preview}>
          <img src={value} alt="Prévia da foto" style={styles.image} />
          <button type="button" onClick={() => onChange('')} style={styles.remove}>
            Remover
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFile}
        style={{ display: 'none' }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        style={styles.button}
      >
        {uploading ? 'Enviando...' : value ? 'Trocar foto' : 'Escolher foto'}
      </button>

      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}

const styles = {
  wrapper: { marginBottom: 16 },
  preview: { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  image: {
    width: 90,
    height: 110,
    objectFit: 'cover',
    borderRadius: 8,
    border: '1px solid var(--borda)'
  },
  remove: {
    background: 'none',
    border: '1px solid var(--borda)',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 12,
    color: 'var(--cinza)'
  },
  button: {
    background: 'none',
    border: '1px dashed var(--borda)',
    borderRadius: 8,
    padding: '12px',
    width: '100%',
    fontSize: 13,
    color: 'var(--lilas-escuro)'
  },
  error: {
    background: '#FFF0EC',
    color: '#B8341A',
    fontSize: 13,
    padding: '10px 12px',
    borderRadius: 8,
    marginTop: 10
  }
};