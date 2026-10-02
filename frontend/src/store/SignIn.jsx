import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { formStyles as styles } from '../formStyles';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await auth.signIn(email.trim(), password);
      // admin cai direto no painel; cliente volta para onde estava
      navigate(user.is_admin ? '/admin/pedidos' : from, { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <Link to="/" style={styles.brand}><h1 style={styles.brand}>Biquínis_PF</h1></Link>
      <p style={styles.tagline}>Consultora moda praia</p>

      <form onSubmit={handleSubmit} style={styles.card}>
        <h2 style={styles.title}>Entrar</h2>

        <label style={styles.label}>E-mail</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={styles.input}
          required
        />

        <label style={styles.label}>Senha</label>
        <input
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
          required
        />

        <button type="button" onClick={() => setShowPassword(!showPassword)} style={styles.toggle}>
          {showPassword ? 'Esconder senha' : 'Mostrar senha'}
        </button>

        {error && <p style={styles.error}>{error}</p>}

        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <p style={styles.footer}>
        Ainda não tem conta? <Link to="/cadastro" state={{ from }} style={styles.link}>Criar conta</Link>
      </p>
    </div>
  );
}