import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const LINKS = [
  { to: '/admin/pedidos', label: 'Pedidos' },
  { to: '/admin/produtos', label: 'Produtos' }
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  function handleLogout() {
    signOut();
    navigate('/entrar');
  }

  return (
    <div>
      <header style={styles.header}>
        <div style={styles.inner}>
          <h1 style={styles.brand}>Biquínis_PF</h1>

          <nav style={styles.nav}>
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                style={({ isActive }) => ({
                  ...styles.link,
                  ...(isActive ? styles.linkActive : {})
                })}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <button onClick={handleLogout} style={styles.logout}>Sair</button>
        </div>
      </header>

      <Outlet />
    </div>
  );
}

const styles = {
  header: {
    background: '#fff',
    borderBottom: '1px solid var(--borda)'
  },
  inner: {
    maxWidth: 820,
    margin: '0 auto',
    padding: '14px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    flexWrap: 'wrap'
  },
  brand: {
    fontSize: 15,
    marginRight: 'auto'
  },
  nav: { display: 'flex', gap: 6 },
  link: {
    fontFamily: 'var(--titulo)',
    fontSize: 12,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    textDecoration: 'none',
    color: 'var(--cinza)',
    padding: '8px 14px',
    borderRadius: 20
  },
  linkActive: {
    background: 'var(--lilas-claro)',
    color: 'var(--lilas-escuro)'
  },
  logout: {
    background: 'none',
    border: '1px solid var(--borda)',
    borderRadius: 8,
    padding: '7px 14px',
    fontSize: 12,
    color: 'var(--cinza)'
  }
};