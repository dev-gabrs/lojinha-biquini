export const formStyles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  brand: {
    fontSize: 20,
    marginBottom: 6,
    textDecoration: 'none',
    color: 'var(--texto)'
  },
  tagline: {
    fontFamily: 'var(--titulo)',
    fontSize: 9,
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    color: 'var(--cinza)',
    marginTop: 0,
    marginBottom: 28
  },
  card: {
    background: '#fff',
    border: '1px solid var(--borda)',
    borderRadius: 14,
    padding: 30,
    width: '100%',
    maxWidth: 380,
    display: 'flex',
    flexDirection: 'column'
  },
  title: { fontSize: 15, marginBottom: 22 },
  label: { fontSize: 13, color: 'var(--cinza)', marginBottom: 6 },
  input: {
    fontFamily: 'var(--corpo)',
    fontSize: 15,
    padding: '11px 13px',
    border: '1px solid var(--borda)',
    borderRadius: 9,
    marginBottom: 18,
    background: 'var(--fundo)'
  },
  hint: { fontSize: 12, color: 'var(--cinza)', marginTop: -12, marginBottom: 18 },
  toggle: {
    background: 'none',
    border: 'none',
    color: 'var(--lilas-escuro)',
    fontFamily: 'var(--corpo)',
    fontSize: 12,
    padding: 0,
    marginTop: -10,
    marginBottom: 18,
    textAlign: 'right'
  },
  error: {
    background: '#FFF0EC',
    color: '#B8341A',
    fontSize: 13,
    padding: '10px 12px',
    borderRadius: 8,
    marginTop: 0,
    marginBottom: 16
  },
  button: {
    background: 'var(--lilas-escuro)',
    color: '#fff',
    border: 'none',
    borderRadius: 9,
    padding: '13px',
    fontSize: 13,
    letterSpacing: '0.12em',
    textTransform: 'uppercase'
  },
  footer: {
    fontSize: 13,
    color: 'var(--cinza)',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 0
  },
  link: { color: 'var(--lilas-escuro)' }
};