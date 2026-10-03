import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { useCart } from './CartContext';
import './store.css';

const WHATSAPP = '5554993070213';

function SearchIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M15.5 15.5 21 21" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.5 3.5h2.2l2.5 10.8a1.6 1.6 0 0 0 1.6 1.2h7.9a1.6 1.6 0 0 0 1.6-1.2L20 6.6H5.4"
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      />
      <circle cx="9.5" cy="19.2" r="1.4" fill="currentColor" />
      <circle cx="16.8" cy="19.2" r="1.4" fill="currentColor" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.2c-4.8 0-8.7 3.4-8.7 7.7 0 2.4 1.3 4.6 3.3 6l-.9 3.6 3.8-2a10 10 0 0 0 2.5.3c4.8 0 8.7-3.4 8.7-7.9S16.8 3.2 12 3.2z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function StoreLayout() {
  const [categories, setCategories] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState(params.get('busca') || '');

  const { user, signOut } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/products/categories').then(setCategories).catch(() => setCategories([]));
  }, []);

  // mantém o campo em dia quando a busca muda por outro caminho
  useEffect(() => {
    setTerm(params.get('busca') || '');
  }, [params]);

  function handleSearch(event) {
    event.preventDefault();
    const next = new URLSearchParams(params);
    if (term.trim()) {
      next.set('busca', term.trim());
    } else {
      next.delete('busca');
    }
    setParams(next);
    setMenuOpen(false);
  }

  function handleSignOut() {
    signOut();
    setMenuOpen(false);
    navigate('/');
  }

  const searchField = (
    <>
      <SearchIcon />
      <input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="O que deseja procurar?"
        aria-label="Buscar produtos"
      />
    </>
  );

  return (
    <div>
      <div className="topbar">
        Entrega em Passo Fundo · Retirada combinada pelo WhatsApp
      </div>

      <header className="header">
        <div className="header__row">
          <div className="header__side">
            <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)}>
              Menu
            </button>
            <form className="search" onSubmit={handleSearch}>{searchField}</form>
          </div>

          <Link to="/" className="header__center" style={{ textDecoration: 'none' }}>
            <span className="brand">Biquínis_PF</span>
            <span className="brand__tagline">Consultora moda praia</span>
          </Link>

          <div className="header__side header__side--right">
            {user ? (
              <button onClick={handleSignOut} className="shortcut" style={{ border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}>
                <span className="shortcut__top">Olá, {user.name.split(' ')[0]}</span>
                <span className="shortcut__main">Sair</span>
              </button>
            ) : (
              <Link to="/entrar" className="shortcut">
                <span className="shortcut__top">Minha conta</span>
                <span className="shortcut__main">Entrar</span>
              </Link>
            )}

            <Link to="/carrinho" className="cart-link" aria-label={`Carrinho com ${count} itens`}>
              <CartIcon />
              <span className="cart-badge">{count}</span>
            </Link>
          </div>
        </div>

        <form className="mobile-search" onSubmit={handleSearch}>
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="O que deseja procurar?"
            aria-label="Buscar produtos"
          />
        </form>

        <nav className={menuOpen ? 'nav is-open' : 'nav'}>
          <div className="nav__inner">
            <NavLink to="/" end onClick={() => setMenuOpen(false)}>
              Todos
            </NavLink>
            {categories.map((category) => (
              <Link
                key={category}
                to={`/?categoria=${encodeURIComponent(category)}`}
                className={params.get('categoria') === category ? 'is-active' : ''}
                onClick={() => setMenuOpen(false)}
              >
                {category}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="footer">
        <div className="footer__inner">
          <div>
            <h3>Contato</h3>
            <p>
              <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noreferrer">WhatsApp (54) 99307-0213</a><br/>
              <a href="https://www.instagram.com/biquinis_pf/" target="_blank" rel="noreferrer">Instagram @biquinis_pf</a>
            </p>
          </div>
          <div>
            <h3>Entrega</h3>
            <p>Entregamos em Passo Fundo<br />Retirada combinada</p>
          </div>
          <div>
            <h3>Pagamento</h3>
            <p>Pix, cartão e boleto<br />Pagamento seguro</p>
          </div>
        </div>
      </footer>

      <a
        className="whatsapp"
        href={`https://wa.me/${WHATSAPP}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Falar no WhatsApp"
      >
        <ChatIcon />
        <span>Fale conosco</span>
      </a>
    </div>
  );
}